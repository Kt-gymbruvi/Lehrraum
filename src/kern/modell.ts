// Datenmodell der Tafel (Version 2). Reine Daten und Funktionen, kein React, kein Browser-Speicher.
// Jedes gespeicherte Tafelbild trägt schema + version; pruefeTafel() nimmt nur an, was es versteht,
// und wandelt ältere Fassungen um (Version 1: eine Fläche ohne Seiten → eine Seite).
import { pruefeFenster, type FensterZustand } from './fenster.ts'

export const TAFEL_SCHEMA = 'lehrraum/tafel'
export const TAFEL_VERSION = 2

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

export type Text = {
  art: 'text'
  id: string
  /** linke obere Ecke */
  x: number
  y: number
  text: string
  /** Schriftgröße in Tafel-Einheiten */
  groesse: number
  farbe: string
}

export const FORMEN = ['rechteck', 'ellipse', 'linie', 'pfeil'] as const
export type Formart = (typeof FORMEN)[number]

export type Form = {
  art: 'form'
  id: string
  form: Formart
  /** Anfangs- und Endpunkt des Aufziehens (bei Rechteck und Ellipse: zwei gegenüberliegende Ecken) */
  x1: number
  y1: number
  x2: number
  y2: number
  farbe: string
  staerke: number
}

export type Bild = {
  art: 'bild'
  id: string
  /** linke obere Ecke, Breite, Höhe in Tafel-Einheiten */
  x: number
  y: number
  b: number
  h: number
  /** Kennung der Bilddatei im Gerätespeicher (speicher/dateien.ts) */
  dateiId: string
}

export type Element = Strich | Text | Form | Bild

/** Hintergrund einer Seite, z. B. eine importierte PDF-Seite: liegt bei (0, 0), lässt sich nicht auswählen oder radieren */
export type Hintergrund = { dateiId: string; b: number; h: number }

export type Seite = { id: string; elemente: Element[]; hintergrund?: Hintergrund }

export type Kamera = { x: number; y: number; zoom: number }

export type Tafelbild = {
  schema: typeof TAFEL_SCHEMA
  version: typeof TAFEL_VERSION
  id: string
  titel: string
  /** mindestens eine Seite */
  seiten: Seite[]
  /** welche Seite gerade zu sehen ist (0 = erste) */
  seiteNr: number
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

/** Schriftgröße zu einer Strichstärke (fein, mittel, breit → klein, mittel, groß) */
export const schriftgroesse = (staerke: number): number => (staerke <= 3 ? 24 : staerke <= 6 ? 36 : 56)

/** Der Textmarker ist immer breiter als der Stift mit derselben Einstellung. */
export const MARKER_FAKTOR = 4
export const MARKER_DECKKRAFT = 0.35

export const ZOOM_MIN = 0.2
export const ZOOM_MAX = 5
export const MAX_SEITEN = 60
export const MAX_TEXT = 2000

/** Zufällige Kennung; crypto.randomUUID fehlt auf http-Seiten (Test im WLAN), deshalb getRandomValues. */
export function neueId(): string {
  const z = new Uint8Array(12)
  crypto.getRandomValues(z)
  return Array.from(z, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const neueSeite = (elemente: Element[] = [], hintergrund?: Hintergrund): Seite => ({ id: neueId(), elemente, ...(hintergrund ? { hintergrund } : {}) })

/** Kennungen von Dateien – nur solche Zeichen */
export const istDateiId = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8,64}$/.test(x)
const istMass = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 100000

function pruefeHintergrund(x: unknown): Hintergrund | undefined {
  if (typeof x !== 'object' || x === null) return undefined
  const h = x as Record<string, unknown>
  return istDateiId(h.dateiId) && istMass(h.b) && istMass(h.h) ? { dateiId: h.dateiId, b: h.b, h: h.h } : undefined
}

/** Alle Dateien, die ein Tafelbild braucht (Bilder und Hintergründe) */
export function benutzteDateien(seiten: Seite[]): Set<string> {
  const ids = new Set<string>()
  for (const s of seiten) {
    if (s.hintergrund) ids.add(s.hintergrund.dateiId)
    for (const e of s.elemente) if (e.art === 'bild') ids.add(e.dateiId)
  }
  return ids
}

export function neuesTafelbild(titel = 'Tafel'): Tafelbild {
  return {
    schema: TAFEL_SCHEMA,
    version: TAFEL_VERSION,
    id: neueId(),
    titel,
    seiten: [neueSeite()],
    seiteNr: 0,
    kamera: { x: 0, y: 0, zoom: 1 },
    fenster: [],
    geaendertAm: new Date().toISOString(),
  }
}

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const istFarbe = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x)
const istStaerke = (x: unknown): x is number => istZahl(x) && x > 0 && x <= 200

function pruefeElement(x: unknown): Element | null {
  if (!istObjekt(x) || typeof x.id !== 'string' || !x.id) return null
  if (x.art === 'bild') {
    if (!istZahl(x.x) || !istZahl(x.y) || !istMass(x.b) || !istMass(x.h) || !istDateiId(x.dateiId)) return null
    return { art: 'bild', id: x.id, x: x.x, y: x.y, b: x.b, h: x.h, dateiId: x.dateiId }
  }
  if (!istFarbe(x.farbe)) return null
  if (x.art === 'strich') {
    if (x.werkzeug !== 'stift' && x.werkzeug !== 'marker') return null
    if (!istStaerke(x.staerke) || !Array.isArray(x.punkte) || x.punkte.length === 0) return null
    const punkte: Punkt[] = []
    for (const p of x.punkte) {
      if (!Array.isArray(p) || !istZahl(p[0]) || !istZahl(p[1])) return null
      punkte.push([p[0], p[1], istZahl(p[2]) ? Math.min(1, Math.max(0, p[2])) : 0.5])
    }
    return { art: 'strich', id: x.id, werkzeug: x.werkzeug, farbe: x.farbe, staerke: x.staerke, druckEcht: x.druckEcht === true, punkte }
  }
  if (x.art === 'text') {
    if (!istZahl(x.x) || !istZahl(x.y) || typeof x.text !== 'string' || !x.text.trim()) return null
    if (!istZahl(x.groesse) || x.groesse < 6 || x.groesse > 400) return null
    return { art: 'text', id: x.id, x: x.x, y: x.y, text: x.text.slice(0, MAX_TEXT), groesse: x.groesse, farbe: x.farbe }
  }
  if (x.art === 'form') {
    const form = FORMEN.find((f) => f === x.form)
    if (!form || !istStaerke(x.staerke) || ![x.x1, x.y1, x.x2, x.y2].every(istZahl)) return null
    return { art: 'form', id: x.id, form, x1: x.x1 as number, y1: x.y1 as number, x2: x.x2 as number, y2: x.y2 as number, farbe: x.farbe, staerke: x.staerke }
  }
  return null
}

/** Unbekannte oder kaputte Elemente werden weggelassen, statt das ganze Bild zu verwerfen. */
const pruefeElemente = (x: unknown): Element[] => (Array.isArray(x) ? x : []).map(pruefeElement).filter((e): e is Element => e !== null)

/**
 * Prüft Daten aus dem Speicher oder aus einer Datei. Liefert ein gültiges Tafelbild (immer in der
 * aktuellen Version) oder null. Versteht Version 1 (ohne Seiten) und Version 2.
 */
export function pruefeTafel(roh: unknown): Tafelbild | null {
  if (!istObjekt(roh) || roh.schema !== TAFEL_SCHEMA) return null
  if (typeof roh.id !== 'string' || !roh.id) return null

  let seiten: Seite[]
  if (roh.version === 1) {
    seiten = [neueSeite(pruefeElemente(roh.elemente))] // Version 1: alles lag auf einer Fläche
  } else if (roh.version === 2) {
    const ids = new Set<string>()
    seiten = (Array.isArray(roh.seiten) ? roh.seiten : []).slice(0, MAX_SEITEN).flatMap((s): Seite[] => {
      if (!istObjekt(s) || typeof s.id !== 'string' || !s.id || ids.has(s.id)) return []
      ids.add(s.id)
      const hintergrund = pruefeHintergrund(s.hintergrund)
      return [{ id: s.id, elemente: pruefeElemente(s.elemente), ...(hintergrund ? { hintergrund } : {}) }]
    })
    if (!seiten.length) seiten = [neueSeite()]
  } else return null

  const k = istObjekt(roh.kamera) ? roh.kamera : {}
  const zoom = istZahl(k.zoom) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k.zoom)) : 1
  return {
    schema: TAFEL_SCHEMA,
    version: TAFEL_VERSION,
    id: roh.id,
    titel: typeof roh.titel === 'string' && roh.titel.trim() ? roh.titel.trim().slice(0, 200) : 'Tafel',
    seiten,
    seiteNr: istZahl(roh.seiteNr) ? Math.min(seiten.length - 1, Math.max(0, Math.round(roh.seiteNr))) : 0,
    kamera: { x: istZahl(k.x) ? k.x : 0, y: istZahl(k.y) ? k.y : 0, zoom },
    fenster: pruefeFenster(roh.fenster), // fehlt bei Tafeln aus der ersten Fassung: dann leer
    geaendertAm: typeof roh.geaendertAm === 'string' ? roh.geaendertAm : new Date().toISOString(),
  }
}
