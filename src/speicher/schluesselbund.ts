// Schlüsselbund dieses Geräts – gemeinsam mit dem Notenbuch und der Startseite (gleiche Adresse, gleicher Speicher).
//   IndexedDB „lehrraum-schluessel“, Lager „bund“, Eintrag „bund“: { version: 1, basis: CryptoKey, am: ISO-Zeit }
// `basis` ist das Notenbuch-Passwort als nicht exportierbarer PBKDF2-Schlüssel: Daraus lassen sich die Schlüssel für
// Notenbuch, Namensliste und Klassen ableiten (je eigenes Salz), das Passwort selbst lässt sich nie auslesen.
// Wer das Passwort zuerst bekommt (Startseite, Tafel oder Notenbuch), legt den Bund an; Abmelden und „Auf diesem
// Gerät sperren“ löschen ihn. Das Format ist in ../../docs/SPEC-tafeln-abgleich-pdf-tabelle.md beschrieben und
// im Notenbuch (index.html) und auf der Startseite (gemeinsam/schluesselbund.js) gleich umgesetzt.
import { RUNDEN, unb64 } from '../kern/tresor.ts'

const NAME = 'lehrraum-schluessel'
const LAGER = 'bund'

export type Bund = { version: 1; basis: CryptoKey; am: string }

function oeffne(): Promise<IDBDatabase> {
  return new Promise((ok, fehler) => {
    const a = indexedDB.open(NAME, 1)
    a.onupgradeneeded = () => {
      if (!a.result.objectStoreNames.contains(LAGER)) a.result.createObjectStore(LAGER)
    }
    a.onsuccess = () => ok(a.result)
    a.onerror = () => fehler(a.error)
    a.onblocked = () => fehler(new Error('Schlüsselbund blockiert'))
  })
}

async function vorgang<T>(art: IDBTransactionMode, tun: (l: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await oeffne()
  try {
    return await new Promise<T>((ok, fehler) => {
      const t = db.transaction(LAGER, art)
      const anfrage = tun(t.objectStore(LAGER))
      t.oncomplete = () => ok(anfrage.result as T)
      t.onerror = () => fehler(t.error)
      t.onabort = () => fehler(t.error)
    })
  } finally {
    db.close() // gleich wieder freigeben – Notenbuch und Startseite öffnen dieselbe Datenbank
  }
}

/** Der Bund dieses Geräts oder null (nie ein Fehler) */
export async function ladeBund(): Promise<Bund | null> {
  try {
    const b = await vorgang<unknown>('readonly', (l) => l.get(LAGER))
    if (typeof b !== 'object' || b === null) return null
    const r = b as Bund
    return r.version === 1 && r.basis instanceof CryptoKey && typeof r.am === 'string' ? r : null
  } catch {
    return null
  }
}

/** Grundschlüssel aus dem Passwort – nicht exportierbar */
export const basisAus = (passwort: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', new TextEncoder().encode(passwort), 'PBKDF2', false, ['deriveKey'])

export async function speichereBund(basis: CryptoKey): Promise<void> {
  const b: Bund = { version: 1, basis, am: new Date().toISOString() }
  await vorgang('readwrite', (l) => l.put(b, LAGER))
}

/** Löscht den Bund (Abmelden, „Auf diesem Gerät sperren“, geändertes Passwort). Nie ein Fehler. */
export async function loescheBund(): Promise<void> {
  try {
    await vorgang('readwrite', (l) => l.delete(LAGER))
  } catch {
    // nichts zu löschen
  }
}

// Abgeleitete Schlüssel bleiben im Speicher der Seite (je Bund und Salz) – PBKDF2 kostet jedes Mal Zeit.
const abgeleitet = new Map<string, Promise<CryptoKey>>()

/** Schlüssel für ein Salz – gleich dem, den leiteSchluesselAb(passwort, salz) liefert */
export function schluesselAus(bund: Bund, salz: string, runden = RUNDEN): Promise<CryptoKey> {
  const merk = bund.am + '|' + salz + '|' + runden
  let k = abgeleitet.get(merk)
  if (!k) {
    k = crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(salz), iterations: runden, hash: 'SHA-256' }, bund.basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    abgeleitet.set(merk, k)
    k.catch(() => abgeleitet.delete(merk))
  }
  return k
}
