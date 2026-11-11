// Lokaler Speicher der Tafel: IndexedDB auf diesem Gerät. Nichts davon wird an einen Server geschickt.
//   tafeln         – Tafelbilder (Schlüssel: id)
//   einstellungen  – einzelne Werte, z. B. welche Tafel zuletzt offen war
//   dateien        – Bilder und importierte PDF-Seiten (siehe dateien.ts)
import { pruefeTafel, type Tafelbild } from '../kern/modell.ts'

const NAME = 'lehrraum'
const VERSION = 2
const LETZTE = 'letzte-tafel'

let offen: Promise<IDBDatabase> | null = null

function oeffne(): Promise<IDBDatabase> {
  offen ??= new Promise((ok, fehler) => {
    const anfrage = indexedDB.open(NAME, VERSION)
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result
      if (!db.objectStoreNames.contains('tafeln')) db.createObjectStore('tafeln', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('einstellungen')) db.createObjectStore('einstellungen')
      if (!db.objectStoreNames.contains('dateien')) db.createObjectStore('dateien', { keyPath: 'id' }) // seit Version 2
    }
    anfrage.onsuccess = () => ok(anfrage.result)
    anfrage.onerror = () => {
      offen = null
      fehler(anfrage.error ?? new Error('Der Speicher dieses Geräts lässt sich nicht öffnen.'))
    }
  })
  return offen
}

export function vorgang<T>(lager: string, art: IDBTransactionMode, tun: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return oeffne().then(
    (db) =>
      new Promise<T>((ok, fehler) => {
        const t = db.transaction(lager, art)
        const anfrage = tun(t.objectStore(lager))
        t.oncomplete = () => ok(anfrage.result)
        t.onerror = () => fehler(t.error ?? new Error('Speichern fehlgeschlagen.'))
        t.onabort = () => fehler(t.error ?? new Error('Speichern abgebrochen (Speicher voll?).'))
      }),
  )
}

export async function speichereTafel(t: Tafelbild): Promise<void> {
  await vorgang('tafeln', 'readwrite', (s) => s.put(t))
  await vorgang('einstellungen', 'readwrite', (s) => s.put(t.id, LETZTE))
}

export async function ladeTafel(id: string): Promise<Tafelbild | null> {
  return pruefeTafel(await vorgang<unknown>('tafeln', 'readonly', (s) => s.get(id)))
}

/** Die zuletzt benutzte Tafel (für die Wiederherstellung nach dem Schließen) oder null */
export async function ladeLetzteTafel(): Promise<Tafelbild | null> {
  const id = await vorgang<unknown>('einstellungen', 'readonly', (s) => s.get(LETZTE))
  return typeof id === 'string' ? ladeTafel(id) : null
}

/** Bittet den Browser, den Speicher dieser Seite nicht von sich aus zu leeren. */
export async function bitteUmDauerhaftenSpeicher(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** Nur für Tests: Verbindung schließen, damit die Datenbank gelöscht werden kann. */
export async function schliesseFuerTests(): Promise<void> {
  if (offen) (await offen).close()
  offen = null
}
