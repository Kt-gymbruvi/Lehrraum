// Klassen der Lehrkraft (Version 1): Bezeichnung, Fach, Jahrgang und die Tafel der Klasse.
// Reine Daten und Funktionen. Klassen liegen nur auf dem Gerät (IndexedDB) – nie auf einem Server.
// Schülerlisten, Sitzordnung und Gruppen kommen als eigene Etappe dazu.
import { neueId } from './modell.ts'

export const KLASSE_SCHEMA = 'lehrraum/klasse'
export const KLASSE_VERSION = 1

export type Klasse = {
  schema: typeof KLASSE_SCHEMA
  version: typeof KLASSE_VERSION
  id: string
  /** z. B. „7b“ oder „Q1“ */
  bezeichnung: string
  /** z. B. „Biologie“ */
  fach: string
  /** z. B. „7“ oder „12/13“ (optional) */
  jahrgang: string
  archiviert: boolean
  /** Kennung des Tafelbilds dieser Klasse; null, solange die Tafel noch nie geöffnet wurde */
  tafelId: string | null
  geaendertAm: string
}

export const GRENZEN = { bezeichnung: 30, fach: 40, jahrgang: 10 }
export const MAX_KLASSEN = 60

export type KlassenEingabe = { bezeichnung: string; fach: string; jahrgang: string }

const sauber = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, max) : '')

/** Prüft die Eingabe im Formular. Liefert Meldungen (leer = alles in Ordnung). */
export function pruefeEingabe(e: KlassenEingabe): string[] {
  const fehler: string[] = []
  if (!e.bezeichnung.trim()) fehler.push('Bitte eine Bezeichnung eingeben, z. B. „7b“.')
  if (e.bezeichnung.trim().length > GRENZEN.bezeichnung) fehler.push(`Die Bezeichnung ist zu lang (höchstens ${GRENZEN.bezeichnung} Zeichen).`)
  if (e.fach.trim().length > GRENZEN.fach) fehler.push(`Das Fach ist zu lang (höchstens ${GRENZEN.fach} Zeichen).`)
  if (e.jahrgang.trim().length > GRENZEN.jahrgang) fehler.push(`Der Jahrgang ist zu lang (höchstens ${GRENZEN.jahrgang} Zeichen).`)
  return fehler
}

export function neueKlasse(e: KlassenEingabe): Klasse {
  return {
    schema: KLASSE_SCHEMA,
    version: KLASSE_VERSION,
    id: neueId(),
    bezeichnung: sauber(e.bezeichnung, GRENZEN.bezeichnung),
    fach: sauber(e.fach, GRENZEN.fach),
    jahrgang: sauber(e.jahrgang, GRENZEN.jahrgang),
    archiviert: false,
    tafelId: null,
    geaendertAm: new Date().toISOString(),
  }
}

export const geaendert = (k: Klasse, neu: Partial<Omit<Klasse, 'schema' | 'version' | 'id'>>): Klasse => ({
  ...k,
  ...neu,
  ...(neu.bezeichnung !== undefined ? { bezeichnung: sauber(neu.bezeichnung, GRENZEN.bezeichnung) || k.bezeichnung } : {}),
  ...(neu.fach !== undefined ? { fach: sauber(neu.fach, GRENZEN.fach) } : {}),
  ...(neu.jahrgang !== undefined ? { jahrgang: sauber(neu.jahrgang, GRENZEN.jahrgang) } : {}),
  geaendertAm: new Date().toISOString(),
})

/** Kopie einer Klasse (z. B. fürs neue Schuljahr): gleiche Angaben, eigene Kennung, eigene leere Tafel. */
export const kopierteKlasse = (k: Klasse): Klasse => ({ ...neueKlasse({ bezeichnung: (k.bezeichnung + ' (Kopie)').slice(0, GRENZEN.bezeichnung), fach: k.fach, jahrgang: k.jahrgang }) })

/** Anzeigename, auch als Titel der Tafel: „7b Biologie“ */
export const klassenName = (k: Pick<Klasse, 'bezeichnung' | 'fach'>): string => [k.bezeichnung, k.fach].filter(Boolean).join(' ')

const reihenfolge = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })
/** Aktive zuerst, dann nach Bezeichnung (5a vor 10b) und Fach */
export const sortiert = (klassen: Klasse[]): Klasse[] =>
  [...klassen].sort((a, b) => Number(a.archiviert) - Number(b.archiviert) || reihenfolge.compare(a.bezeichnung, b.bezeichnung) || reihenfolge.compare(a.fach, b.fach))

/** Prüft eine gespeicherte Klasse; liefert sie bereinigt oder null. */
export function pruefeKlasse(roh: unknown): Klasse | null {
  if (typeof roh !== 'object' || roh === null) return null
  const k = roh as Record<string, unknown>
  if (k.schema !== KLASSE_SCHEMA || k.version !== KLASSE_VERSION) return null
  if (typeof k.id !== 'string' || !/^[0-9a-f]{8,64}$/.test(k.id)) return null
  const bezeichnung = sauber(k.bezeichnung, GRENZEN.bezeichnung)
  if (!bezeichnung) return null
  return {
    schema: KLASSE_SCHEMA,
    version: KLASSE_VERSION,
    id: k.id,
    bezeichnung,
    fach: sauber(k.fach, GRENZEN.fach),
    jahrgang: sauber(k.jahrgang, GRENZEN.jahrgang),
    archiviert: k.archiviert === true,
    tafelId: typeof k.tafelId === 'string' && /^[0-9a-f]{8,64}$/.test(k.tafelId) ? k.tafelId : null,
    geaendertAm: typeof k.geaendertAm === 'string' ? k.geaendertAm : new Date().toISOString(),
  }
}
