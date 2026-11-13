// Auswahlrahmen und seine Griffe: wo sie liegen, welcher getroffen ist und wie ein Zug am Griff die Auswahl streckt.
// Reine Logik in Tafel-Koordinaten; Maße auf dem Bildschirm werden mit dem Zoom umgerechnet.
import type { Rechteck } from './geometrie.ts'
import type { Element } from './modell.ts'

/** Abstand zwischen Inhalt und gezeichnetem Auswahlrahmen, in Bildschirm-Pixeln */
export const AUSWAHL_RAND = 6
/** So groß wird ein Griff gezeichnet (Bildschirm-Pixel) … */
export const GRIFF_GROESSE = 16
/** … und so groß ist die Fläche, in der er sich greifen lässt (Projektregel: mindestens 44 px) */
export const GRIFF_TREFFER = 44
/** Kleiner als so viele Tafel-Einheiten lässt sich nichts ziehen */
export const MIN_GROESSE = 8

export type Griffname = 'nw' | 'n' | 'no' | 'o' | 'so' | 's' | 'sw' | 'w'
export type Griff = { name: Griffname; x: number; y: number }

/** Mauszeiger am Laptop für jeden Griff */
export const GRIFF_ZEIGER: Record<Griffname, string> = {
  nw: 'nwse-resize',
  so: 'nwse-resize',
  no: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  o: 'ew-resize',
  w: 'ew-resize',
}

/** Der gezeichnete Auswahlrahmen: Inhalt plus etwas Rand */
export function auswahlRahmen(inhalt: Rechteck, zoom: number): Rechteck {
  const r = AUSWAHL_RAND / zoom
  return [inhalt[0] - r, inhalt[1] - r, inhalt[2] + r, inhalt[3] + r]
}

/** Bilder und Text bleiben immer proportional – dann gibt es nur Eckgriffe. */
export const nurEcken = (elemente: Element[]) => elemente.some((e) => e.art === 'bild' || e.art === 'text')

/**
 * Die Griffe am Auswahlrahmen. Ist die Auswahl so klein, dass sich die Trefferflächen überlappen würden,
 * fallen die Seitengriffe weg und die Eckgriffe rücken nach außen.
 */
export function griffe(r: Rechteck, zoom: number, nurEckgriffe: boolean): Griff[] {
  const [l, o, re, u] = r
  const mx = (l + re) / 2
  const my = (o + u) / 2
  const abstand = GRIFF_TREFFER / zoom
  const hb = Math.max((re - l) / 2, abstand / 2)
  const hh = Math.max((u - o) / 2, abstand / 2)
  const ecken: Griff[] = [
    { name: 'nw', x: mx - hb, y: my - hh },
    { name: 'no', x: mx + hb, y: my - hh },
    { name: 'so', x: mx + hb, y: my + hh },
    { name: 'sw', x: mx - hb, y: my + hh },
  ]
  if (nurEckgriffe || re - l < 2 * abstand || u - o < 2 * abstand) return ecken
  return [...ecken, { name: 'n', x: mx, y: o }, { name: 'o', x: re, y: my }, { name: 's', x: mx, y: u }, { name: 'w', x: l, y: my }]
}

/** Der Griff, dessen Trefferfläche den Punkt enthält (bei mehreren der nächste), sonst null */
export function griffBei(liste: Griff[], x: number, y: number, zoom: number): Griff | null {
  const halb = GRIFF_TREFFER / 2 / zoom
  let bester: Griff | null = null
  let besterAbstand = Infinity
  for (const g of liste) {
    const d = Math.max(Math.abs(g.x - x), Math.abs(g.y - y))
    if (d <= halb && d < besterAbstand) {
      bester = g
      besterAbstand = d
    }
  }
  return bester
}

/** Fester Punkt (ax, ay) und Streckung in beide Richtungen */
export type Skalierung = { ax: number; ay: number; sx: number; sy: number; gleichmaessig: boolean }

/**
 * Wie weit ein Zug am Griff die Auswahl streckt. inhalt: Rahmen der ausgewählten Elemente,
 * dx/dy: Weg des Zeigers seit dem Greifen (Tafel-Einheiten). Die gegenüberliegende Ecke bzw. Seite bleibt stehen.
 * Eckgriffe behalten das Seitenverhältnis; nichts wird kleiner als MIN_GROESSE oder umgestülpt.
 */
export function skalierung(name: Griffname, inhalt: Rechteck, dx: number, dy: number): Skalierung {
  const [l, o, r, u] = inhalt
  const b = Math.max(r - l, 1e-6)
  const h = Math.max(u - o, 1e-6)
  const rx = name.includes('o') ? 1 : name.includes('w') ? -1 : 0 // nach rechts (1), links (-1) oder gar nicht
  const ry = name.includes('s') ? 1 : name.startsWith('n') ? -1 : 0
  const ax = rx === 1 ? l : rx === -1 ? r : (l + r) / 2
  const ay = ry === 1 ? o : ry === -1 ? u : (o + u) / 2
  if (rx !== 0 && ry !== 0) {
    // Ecke: den Zug auf die Diagonale übertragen, damit das Verhältnis bleibt
    const [vx, vy] = [rx * b, ry * h]
    const s = 1 + (dx * vx + dy * vy) / (vx * vx + vy * vy)
    const g = Math.max(s, Math.min(1, MIN_GROESSE / Math.max(b, h)))
    return { ax, ay, sx: g, sy: g, gleichmaessig: true }
  }
  const sx = rx === 0 ? 1 : Math.max(1 + (rx * dx) / b, Math.min(1, MIN_GROESSE / b))
  const sy = ry === 0 ? 1 : Math.max(1 + (ry * dy) / h, Math.min(1, MIN_GROESSE / h))
  return { ax, ay, sx, sy, gleichmaessig: false }
}
