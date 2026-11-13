// Farben und Stärken über die Leiste hinaus: Palette, eigene Farbplätze (je Gerät gespeichert), Regler für die Stärke.
import { FARBEN, STAERKEN } from './modell.ts'

/** Gut lesbare Farben für das Feld „Mehr“ – die sechs der Leiste zuerst, dann typische Textmarkerfarben */
export const PALETTE: { wert: string; name: string }[] = [
  ...FARBEN,
  { wert: '#6a1b9a', name: 'Violett' },
  { wert: '#ad1457', name: 'Weinrot' },
  { wert: '#00838f', name: 'Petrol' },
  { wert: '#6d4c41', name: 'Braun' },
  { wert: '#757575', name: 'Grau' },
  { wert: '#ffffff', name: 'Weiß' },
  { wert: '#fdd835', name: 'Gelb' },
  { wert: '#76d13b', name: 'Hellgrün' },
  { wert: '#f06292', name: 'Rosa' },
  { wert: '#29b6f6', name: 'Hellblau' },
  { wert: '#26a69a', name: 'Türkis' },
  { wert: '#ff7043', name: 'Lachs' },
]

/** Höchstens so viele eigene Farben je Gerät; eine neue verdrängt die älteste */
export const MAX_EIGENE = 6

/** Bereich des Reglers; die drei Knöpfe der Leiste liegen bei 3, 6 und 12 */
export const STAERKE_MIN = 1
export const STAERKE_MAX = 30

export const FARBPLAETZE_SCHEMA = 'lehrraum/farbplaetze'
export const FARBPLAETZE_VERSION = 1
export type Farbplaetze = { schema: typeof FARBPLAETZE_SCHEMA; version: typeof FARBPLAETZE_VERSION; farben: string[] }

export const istFarbwert = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x)
/** Farben einheitlich in Kleinbuchstaben (der Farbwähler des Geräts liefert sie so, gespeicherte Werte vielleicht nicht) */
export const normiereFarbe = (f: string): string => f.toLowerCase()

/** Prüft gespeicherte Farbplätze; Ungültiges und Doppeltes fällt weg. */
export function pruefeFarbplaetze(x: unknown): string[] {
  if (typeof x !== 'object' || x === null) return []
  const r = x as Record<string, unknown>
  if (r.schema !== FARBPLAETZE_SCHEMA || r.version !== FARBPLAETZE_VERSION || !Array.isArray(r.farben)) return []
  const farben: string[] = []
  for (const f of r.farben) if (istFarbwert(f) && !farben.includes(normiereFarbe(f))) farben.push(normiereFarbe(f))
  return farben.slice(0, MAX_EIGENE)
}

export const neueFarbplaetze = (farben: string[]): Farbplaetze => ({ schema: FARBPLAETZE_SCHEMA, version: FARBPLAETZE_VERSION, farben })

/**
 * Nimmt eine selbst gewählte Farbe in die eigenen Plätze auf: vorne, ohne Doppel, höchstens MAX_EIGENE.
 * Farben aus der Palette brauchen keinen Platz – sie bleiben unverändert.
 */
export function mitEigenerFarbe(plaetze: string[], farbe: string): string[] {
  const f = normiereFarbe(farbe)
  if (!istFarbwert(f) || PALETTE.some((p) => p.wert === f)) return plaetze
  return [f, ...plaetze.filter((x) => x !== f)].slice(0, MAX_EIGENE)
}

/** Ist die Farbe eine der sechs in der Leiste? */
export const inLeiste = (farbe: string): boolean => FARBEN.some((f) => f.wert === normiereFarbe(farbe))
/** Ist die Stärke einer der drei Knöpfe? */
export const staerkeInLeiste = (s: number): boolean => STAERKEN.some((x) => x.wert === s)
/** Regler-Wert begrenzen und auf ganze Zahlen runden */
export const begrenzeStaerke = (s: number): number => Math.min(STAERKE_MAX, Math.max(STAERKE_MIN, Math.round(Number.isFinite(s) ? s : 6)))
