// Lokaler Speicher der Tafel: IndexedDB auf diesem Gerät. Nichts davon wird an einen Server geschickt.
//   tafeln         – Tafelbilder (Schlüssel: id)
//   einstellungen  – einzelne Werte, z. B. welche Tafel zuletzt offen war
//   dateien        – Bilder und importierte PDF-Seiten (siehe dateien.ts)
//   klassen        – Klassen der Lehrkraft (Schlüssel: id)
// Die Startseite der Plattform liest „klassen“ mit (gleiche Adresse, gleiche Datenbank) – nur lesend.
import { geaendert, klassenName, pruefeKlasse, type Klasse } from '../kern/klassen.ts'
import { neuesTafelbild, pruefeTafel, type Tafelbild } from '../kern/modell.ts'

const NAME = 'lehrraum'
const VERSION = 3
const LETZTE = 'letzte-tafel'
const FREIE = 'freie-tafel'

let offen: Promise<IDBDatabase> | null = null

function oeffne(): Promise<IDBDatabase> {
  offen ??= new Promise((ok, fehler) => {
    const anfrage = indexedDB.open(NAME, VERSION)
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result
      if (!db.objectStoreNames.contains('tafeln')) db.createObjectStore('tafeln', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('einstellungen')) db.createObjectStore('einstellungen')
      if (!db.objectStoreNames.contains('dateien')) db.createObjectStore('dateien', { keyPath: 'id' }) // seit Version 2
      if (!db.objectStoreNames.contains('klassen')) db.createObjectStore('klassen', { keyPath: 'id' }) // seit Version 3
    }
    anfrage.onsuccess = () => {
      // Will ein anderer Tab (oder eine neuere Fassung) die Datenbank umbauen, diese Verbindung freigeben
      anfrage.result.onversionchange = () => {
        anfrage.result.close()
        offen = null
      }
      ok(anfrage.result)
    }
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

/** Alle gespeicherten Tafelbilder (z. B. um festzustellen, welche Bilddateien noch gebraucht werden) */
export async function ladeAlleTafeln(): Promise<Tafelbild[]> {
  const alle = await vorgang<unknown[]>('tafeln', 'readonly', (s) => s.getAll())
  return alle.map(pruefeTafel).filter((t): t is Tafelbild => t !== null)
}

export async function loescheTafel(id: string): Promise<void> {
  await vorgang('tafeln', 'readwrite', (s) => s.delete(id))
}

/**
 * Die freie Tafel (ohne Klasse). Gibt es noch keine Festlegung, gilt die zuletzt benutzte Tafel –
 * so bleibt erhalten, was vor der Einführung der Klassen gezeichnet wurde.
 */
export async function ladeFreieTafel(): Promise<Tafelbild | null> {
  const id = await vorgang<unknown>('einstellungen', 'readonly', (s) => s.get(FREIE))
  if (typeof id === 'string') return ladeTafel(id)
  const letzte = await ladeLetzteTafel()
  // Die zuletzt benutzte Tafel kann die einer Klasse sein – die ist nicht die freie Tafel
  if (!letzte || (await ladeKlassen()).some((k) => k.tafelId === letzte.id)) return null
  await merkeFreieTafel(letzte.id)
  return letzte
}
export async function merkeFreieTafel(id: string): Promise<void> {
  await vorgang('einstellungen', 'readwrite', (s) => s.put(id, FREIE))
}

// ---------- Klassen ----------
export async function ladeKlassen(): Promise<Klasse[]> {
  const alle = await vorgang<unknown[]>('klassen', 'readonly', (s) => s.getAll())
  return alle.map(pruefeKlasse).filter((k): k is Klasse => k !== null)
}
export async function ladeKlasse(id: string): Promise<Klasse | null> {
  return pruefeKlasse(await vorgang<unknown>('klassen', 'readonly', (s) => s.get(id)))
}
export async function speichereKlasse(k: Klasse): Promise<void> {
  await vorgang('klassen', 'readwrite', (s) => s.put(k))
}
/** Löscht die Klasse und ihre Tafel. Bilder der Tafel räumt das nächste Öffnen einer Tafel weg. */
export async function loescheKlasse(k: Klasse): Promise<void> {
  await vorgang('klassen', 'readwrite', (s) => s.delete(k.id))
  if (k.tafelId) await loescheTafel(k.tafelId)
}

const oeffnet = new Map<string, Promise<Tafelbild | null>>()

/**
 * Die Tafel einer Klasse; beim ersten Öffnen wird sie angelegt und in der Klasse vermerkt.
 * Liefert null, wenn es die Klasse auf diesem Gerät nicht gibt.
 * Gleichzeitige Aufrufe für dieselbe Klasse teilen sich ein Ergebnis – sonst entstünden zwei Tafeln.
 */
export function oeffneKlassenTafel(klasseId: string): Promise<Tafelbild | null> {
  let lauf = oeffnet.get(klasseId)
  if (!lauf) {
    lauf = (async () => {
      const klasse = await ladeKlasse(klasseId)
      if (!klasse) return null
      // Vorher festhalten, welche Tafel die freie ist – sonst gälte gleich die Klassentafel als zuletzt benutzt
      await ladeFreieTafel().catch(() => null)
      const vorhanden = klasse.tafelId ? await ladeTafel(klasse.tafelId) : null
      if (vorhanden) return vorhanden
      const neu = neuesTafelbild(klassenName(klasse))
      await speichereTafel(neu)
      await speichereKlasse(geaendert(klasse, { tafelId: neu.id }))
      return neu
    })().finally(() => oeffnet.delete(klasseId))
    oeffnet.set(klasseId, lauf)
  }
  return lauf
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
