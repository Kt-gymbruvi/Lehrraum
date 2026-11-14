// Datenmodell der Tafel (Version 4). Reine Daten und Funktionen, kein React, kein Browser-Speicher.
// Jedes gespeicherte Tafelbild trägt schema + version; pruefeTafel() nimmt nur an, was es versteht,
// und wandelt ältere Fassungen um (Version 1: eine Fläche ohne Seiten → eine Seite; Version 2 hat
// dieselbe Gestalt wie Version 3, nur ohne Drehung, Gruppen und Dreieck; Version 3 hat dieselbe Gestalt wie
// Version 4, nur ohne Drehung und PDF-Kennung des Hintergrunds – beide werden unverändert übernommen).
import { pruefeFenster, type FensterZustand } from './fenster.ts'

export const TAFEL_SCHEMA = 'lehrraum/tafel'
export const TAFEL_VERSION = 4

/** Ein Punkt eines Strichs: x, y in Tafel-Koordinaten, Druck 0..1 */
export type Punkt = [number, number, number]

export type Zeichenwerkzeug = 'stift' | 'marker'

/** Angaben, die jedes Element haben kann */
type Gemeinsam = {
  id: string
  /** Kennung der Gruppe, zu der das Element gehört (fehlt: keine Gruppe) */
  gruppe?: string
}

export type Strich = Gemeinsam & {
  art: 'strich'
  werkzeug: Zeichenwerkzeug
  farbe: string
  /** Strichstärke in Tafel-Einheiten (bei Zoom 1 = Pixel) */
  staerke: number
  /** true: der Druck stammt von einem Stift; false: Maus/Finger, Druck wird aus dem Tempo geschätzt */
  druckEcht: boolean
  punkte: Punkt[]
}

export type Text = Gemeinsam & {
  art: 'text'
  /** linke obere Ecke (ungedreht) */
  x: number
  y: number
  text: string
  /** Schriftgröße in Tafel-Einheiten */
  groesse: number
  farbe: string
  /** Drehung in Grad im Uhrzeigersinn um die linke obere Ecke (fehlt: 0) */
  drehung?: number
}

export const FORMEN = ['rechteck', 'ellipse', 'linie', 'pfeil', 'dreieck'] as const
export type Formart = (typeof FORMEN)[number]
/** Formen mit eigener Drehung; Linie und Pfeil werden gedreht, indem sich ihre Endpunkte bewegen */
export const DREHBARE_FORMEN: readonly Formart[] = ['rechteck', 'ellipse', 'dreieck']

export type Form = Gemeinsam & {
  art: 'form'
  form: Formart
  /** Anfangs- und Endpunkt des Aufziehens (bei Rechteck, Ellipse, Dreieck: zwei gegenüberliegende Ecken, ungedreht) */
  x1: number
  y1: number
  x2: number
  y2: number
  farbe: string
  staerke: number
  /** Drehung in Grad im Uhrzeigersinn um die Mitte (nur Rechteck, Ellipse, Dreieck; fehlt: 0) */
  drehung?: number
  /**
   * Nur Dreieck: Die Grundseite liegt unten im Rahmen, die Spitze oben; spitze sagt, wo (0 = links, 1 = rechts,
   * fehlt: 0,5). So lässt sich jedes Dreieck darstellen – die längste Seite als Grundseite, gedreht.
   */
  spitze?: number
}

export type Bild = Gemeinsam & {
  art: 'bild'
  /** linke obere Ecke (ungedreht), Breite, Höhe in Tafel-Einheiten */
  x: number
  y: number
  b: number
  h: number
  /** Kennung der Bilddatei im Gerätespeicher (speicher/dateien.ts) */
  dateiId: string
  /** Drehung in Grad im Uhrzeigersinn um die linke obere Ecke (fehlt: 0) */
  drehung?: number
}

export type Element = Strich | Text | Form | Bild

/**
 * Hintergrund einer Seite, z. B. eine importierte PDF-Seite: liegt bei (0, 0), lässt sich nicht auswählen oder radieren.
 * b, h: Größe des Bildes (ungedreht). drehung: in 90°-Schritten im Uhrzeigersinn (fehlt: 0) – gedreht liegt die
 * Seite weiter bei (0, 0), mit vertauschter Breite und Höhe bei 90° und 270°. pdf: Kennung des PDF-Imports,
 * aus dem die Seite stammt (für „alle Seiten dieses PDFs löschen“; fehlt bei älteren Seiten).
 */
export type Hintergrund = { dateiId: string; b: number; h: number; drehung?: 90 | 180 | 270; pdf?: string }

/** Sichtbare Breite und Höhe eines Hintergrunds (mit Drehung) */
export const hintergrundMass = (h: Hintergrund): [number, number] => (h.drehung === 90 || h.drehung === 270 ? [h.h, h.b] : [h.b, h.h])

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
  if (!istDateiId(h.dateiId) || !istMass(h.b) || !istMass(h.h)) return undefined
  const g: Hintergrund = { dateiId: h.dateiId, b: h.b, h: h.h }
  if (h.drehung === 90 || h.drehung === 180 || h.drehung === 270) g.drehung = h.drehung
  if (typeof h.pdf === 'string' && /^[0-9a-f]{8,64}$/.test(h.pdf)) g.pdf = h.pdf
  return g
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

/** Winkel auf -180 < w ≤ 180 Grad bringen */
export function normiereWinkel(w: number): number {
  const r = (((w + 180) % 360) + 360) % 360 - 180
  return r === -180 ? 180 : r
}

/** Gruppe und Drehung nur übernehmen, wenn sie gültig sind und etwas bedeuten (keine Drehung 0 speichern) */
function zusatz(x: Record<string, unknown>, drehbar: boolean): { gruppe?: string; drehung?: number } {
  const z: { gruppe?: string; drehung?: number } = {}
  if (typeof x.gruppe === 'string' && x.gruppe.length > 0 && x.gruppe.length <= 64) z.gruppe = x.gruppe
  if (drehbar && istZahl(x.drehung)) {
    const w = normiereWinkel(x.drehung)
    if (Math.abs(w) > 1e-9) z.drehung = w
  }
  return z
}

function pruefeElement(x: unknown): Element | null {
  if (!istObjekt(x) || typeof x.id !== 'string' || !x.id) return null
  if (x.art === 'bild') {
    if (!istZahl(x.x) || !istZahl(x.y) || !istMass(x.b) || !istMass(x.h) || !istDateiId(x.dateiId)) return null
    return { art: 'bild', id: x.id, x: x.x, y: x.y, b: x.b, h: x.h, dateiId: x.dateiId, ...zusatz(x, true) }
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
    return { art: 'strich', id: x.id, werkzeug: x.werkzeug, farbe: x.farbe, staerke: x.staerke, druckEcht: x.druckEcht === true, punkte, ...zusatz(x, false) }
  }
  if (x.art === 'text') {
    if (!istZahl(x.x) || !istZahl(x.y) || typeof x.text !== 'string' || !x.text.trim()) return null
    if (!istZahl(x.groesse) || x.groesse < 6 || x.groesse > 400) return null
    return { art: 'text', id: x.id, x: x.x, y: x.y, text: x.text.slice(0, MAX_TEXT), groesse: x.groesse, farbe: x.farbe, ...zusatz(x, true) }
  }
  if (x.art === 'form') {
    const form = FORMEN.find((f) => f === x.form)
    if (!form || !istStaerke(x.staerke) || ![x.x1, x.y1, x.x2, x.y2].every(istZahl)) return null
    const f: Form = { art: 'form', id: x.id, form, x1: x.x1 as number, y1: x.y1 as number, x2: x.x2 as number, y2: x.y2 as number, farbe: x.farbe, staerke: x.staerke, ...zusatz(x, DREHBARE_FORMEN.includes(form)) }
    if (form === 'dreieck' && istZahl(x.spitze) && x.spitze !== 0.5) f.spitze = Math.min(1, Math.max(0, x.spitze))
    return f
  }
  return null
}

/** Unbekannte oder kaputte Elemente werden weggelassen, statt das ganze Bild zu verwerfen. */
export const pruefeElemente = (x: unknown): Element[] => (Array.isArray(x) ? x : []).map(pruefeElement).filter((e): e is Element => e !== null)

/**
 * Prüft Daten aus dem Speicher oder aus einer Datei. Liefert ein gültiges Tafelbild (immer in der
 * aktuellen Version) oder null. Versteht Version 1 (ohne Seiten), 2, 3 und 4.
 */
export function pruefeTafel(roh: unknown): Tafelbild | null {
  if (!istObjekt(roh) || roh.schema !== TAFEL_SCHEMA) return null
  if (typeof roh.id !== 'string' || !roh.id) return null

  let seiten: Seite[]
  if (roh.version === 1) {
    seiten = [neueSeite(pruefeElemente(roh.elemente))] // Version 1: alles lag auf einer Fläche
  } else if (roh.version === 2 || roh.version === 3 || roh.version === 4) {
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
