// Datenmodell der Tafel (Version 1). Reine Daten und Funktionen, kein React, kein Browser-Speicher.
// Jedes gespeicherte Tafelbild trägt schema + version; pruefeTafel() nimmt nur an, was es versteht.

import { pruefeFenster, type FensterZustand } from './fenster.ts'

export const TAFEL_SCHEMA = 'lehrraum/tafel'
export const TAFEL_VERSION = 1

/** Ein Punkt eines Strichs: x, y in Tafel-Koordinaten, Druck 0..1 */
export type Punkt = [number, number, number]

export type Zeichenwerkzeug = 'stift' | 'marker'

export type Strich = {
  art: 'strich'
  id: string
  werkzeug: Zeichenwerkzeug
  farbe: string
  /** Strichstärke in Tafel-Einheiten (bei Zoom 1 = Pixel) */
  staerke: number
  /** true: der Druck stammt von einem Stift; false: Maus/Finger, Druck wird aus dem Tempo geschätzt */
  druckEcht: boolean
  punkte: Punkt[]
}

/** Bisher gibt es nur Striche; Text, Formen und Bilder folgen als weitere Arten. */
export type Element = Strich

export type Kamera = { x: number; y: number; zoom: number }

export type Tafelbild = {
  schema: typeof TAFEL_SCHEMA
  version: typeof TAFEL_VERSION
  id: string
  titel: string
  elemente: Element[]
  kamera: Kamera
  /** Offene Fenster über der Tafel (Uhr, Timer, Notizen …) – gehören nicht zum Tafelbild selbst */
  fenster: FensterZustand[]
  geaendertAm: string
}

export const FARBEN = [
  { wert: '#0b1f4d', name: 'Dunkelblau' },
  { wert: '#111111', name: 'Schwarz' },
  { wert: '#c62828', name: 'Rot' },
  { wert: '#1b6b43', name: 'Grün' },
  { wert: '#1d4fc4', name: 'Blau' },
  { wert: '#e68a00', name: 'Orange' },
] as const

export const STAERKEN = [
  { wert: 3, name: 'fein' },
  { wert: 6, name: 'mittel' },
  { wert: 12, name: 'breit' },
] as const

/** Der Textmarker ist immer breiter als der Stift mit derselben Einstellung. */
export const MARKER_FAKTOR = 4
export const MARKER_DECKKRAFT = 0.35

export const ZOOM_MIN = 0.2
export const ZOOM_MAX = 5

/** Zufällige Kennung; crypto.randomUUID fehlt auf http-Seiten (Test im WLAN), deshalb getRandomValues. */
export function neueId(): string {
  const z = new Uint8Array(12)
  crypto.getRandomValues(z)
  return Array.from(z, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function neuesTafelbild(titel = 'Tafel'): Tafelbild {
  return {
    schema: TAFEL_SCHEMA,
    version: TAFEL_VERSION,
    id: neueId(),
    titel,
    elemente: [],
    kamera: { x: 0, y: 0, zoom: 1 },
    fenster: [],
    geaendertAm: new Date().toISOString(),
  }
}

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function pruefeStrich(x: unknown): Strich | null {
  if (!istObjekt(x) || x.art !== 'strich' || typeof x.id !== 'string') return null
  if (x.werkzeug !== 'stift' && x.werkzeug !== 'marker') return null
  if (typeof x.farbe !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(x.farbe)) return null
  if (!istZahl(x.staerke) || x.staerke <= 0 || x.staerke > 200) return null
  if (!Array.isArray(x.punkte) || x.punkte.length === 0) return null
  const punkte: Punkt[] = []
  for (const p of x.punkte) {
    if (!Array.isArray(p) || !istZahl(p[0]) || !istZahl(p[1])) return null
    punkte.push([p[0], p[1], istZahl(p[2]) ? Math.min(1, Math.max(0, p[2])) : 0.5])
  }
  return { art: 'strich', id: x.id, werkzeug: x.werkzeug, farbe: x.farbe, staerke: x.staerke, druckEcht: x.druckEcht === true, punkte }
}

/**
 * Prüft Daten aus dem Speicher oder aus einer Datei. Liefert ein gültiges Tafelbild oder null.
 * Unbekannte Elemente werden weggelassen, statt das ganze Bild zu verwerfen.
 * Hier kommen später die Umwandlungen älterer Versionen dazu (v1 → v2 …).
 */
export function pruefeTafel(roh: unknown): Tafelbild | null {
  if (!istObjekt(roh) || roh.schema !== TAFEL_SCHEMA || roh.version !== TAFEL_VERSION) return null
  if (typeof roh.id !== 'string' || !roh.id) return null
  const elemente = (Array.isArray(roh.elemente) ? roh.elemente : []).map(pruefeStrich).filter((s): s is Strich => s !== null)
  const k = istObjekt(roh.kamera) ? roh.kamera : {}
  const zoom = istZahl(k.zoom) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k.zoom)) : 1
  return {
    schema: TAFEL_SCHEMA,
    version: TAFEL_VERSION,
    id: roh.id,
    titel: typeof roh.titel === 'string' && roh.titel.trim() ? roh.titel.trim().slice(0, 200) : 'Tafel',
    elemente,
    kamera: { x: istZahl(k.x) ? k.x : 0, y: istZahl(k.y) ? k.y : 0, zoom },
    fenster: pruefeFenster(roh.fenster), // fehlt bei Tafeln aus der ersten Fassung: dann leer
    geaendertAm: typeof roh.geaendertAm === 'string' ? roh.geaendertAm : new Date().toISOString(),
  }
}
