// Auswahlrahmen und seine Griffe: wo sie liegen, welcher getroffen ist und wie ein Zug am Griff die Auswahl streckt.
// Reine Logik in Tafel-Koordinaten; Maße auf dem Bildschirm werden mit dem Zoom umgerechnet.
import { drehungVon, type Rechteck } from './geometrie.ts'
import { normiereWinkel, type Element } from './modell.ts'

/** Abstand zwischen Inhalt und gezeichnetem Auswahlrahmen, in Bildschirm-Pixeln */
export const AUSWAHL_RAND = 6
/** So groß wird ein Griff gezeichnet (Bildschirm-Pixel) … */
export const GRIFF_GROESSE = 16
/** … und so groß ist die Fläche, in der er sich greifen lässt (Projektregel: mindestens 44 px) */
export const GRIFF_TREFFER = 44
/** Kleiner als so viele Tafel-Einheiten lässt sich nichts ziehen */
export const MIN_GROESSE = 8
/** So weit (Bildschirm-Pixel) über den oberen Griffen sitzt der Drehgriff – genug, dass sich die Trefferflächen nicht überlappen */
export const DREH_ABSTAND = 48
/** In dieser Nähe (Grad) zu 0°, 45°, 90° … rastet die Drehung ein */
export const RAST_GRAD = 5

/** Griffe zum Ändern der Größe: Ecken und Seiten nach Himmelsrichtung */
export type Griffname = 'nw' | 'n' | 'no' | 'o' | 'so' | 's' | 'sw' | 'w'
export type Griff = { name: Griffname | 'drehen'; x: number; y: number }

/** Mauszeiger am Laptop für jeden Griff */
export const GRIFF_ZEIGER: Record<Griffname | 'drehen', string> = {
  drehen: 'grab',
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

/**
 * Bilder und Text bleiben immer proportional – dann gibt es nur Eckgriffe. Ebenso bei gedrehten Rechtecken,
 * Ellipsen und Dreiecken: In einer Richtung gestreckt wären sie schief verzerrt.
 */
export const nurEcken = (elemente: Element[]) => elemente.some((e) => e.art === 'bild' || e.art === 'text' || drehungVon(e) !== 0)

/**
 * Die Griffe am Auswahlrahmen: Ecken, Seiten und darüber der Drehgriff. Ist die Auswahl so klein, dass sich
 * die Trefferflächen überlappen würden, fallen die Seitengriffe weg und die Eckgriffe rücken nach außen.
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
  const drehen: Griff = { name: 'drehen', x: mx, y: my - hh - DREH_ABSTAND / zoom }
  if (nurEckgriffe || re - l < 2 * abstand || u - o < 2 * abstand) return [...ecken, drehen]
  return [...ecken, { name: 'n', x: mx, y: o }, { name: 'o', x: re, y: my }, { name: 's', x: mx, y: u }, { name: 'w', x: l, y: my }, drehen]
}

/** Einrasten: in der Nähe von Vielfachen von 45° auf diese; mit stufen (Umschalt am Laptop) in 15°-Schritten */
export function rasteWinkel(roh: number, stufen: boolean): number {
  const w = normiereWinkel(roh)
  if (stufen) return normiereWinkel(Math.round(w / 15) * 15)
  const naechster = Math.round(w / 45) * 45
  return normiereWinkel(Math.abs(w - naechster) <= RAST_GRAD ? naechster : w)
}

/**
 * Wie weit ein Zug am Drehgriff dreht (Grad): der Winkel, den der Zeiger seit dem Greifen um die Mitte (cx, cy)
 * überstrichen hat. basis: die bisherige Drehung – eingerastet wird beim Ergebnis (basis + Drehung), damit ein
 * schräg stehendes Bild wieder gerade wird.
 */
export function drehwinkel(cx: number, cy: number, startX: number, startY: number, x: number, y: number, basis: number, stufen: boolean): number {
  const roh = ((Math.atan2(y - cy, x - cx) - Math.atan2(startY - cy, startX - cx)) * 180) / Math.PI
  return normiereWinkel(rasteWinkel(basis + roh, stufen) - basis)
}

// ---------- Gruppen ----------

/** Die Kennungen samt aller Elemente, die mit einem davon in einer Gruppe sind (Antippen eines Mitglieds wählt die Gruppe) */
export function mitGruppen(elemente: Element[], ids: Iterable<string>): string[] {
  const menge = new Set(ids)
  const gruppen = new Set(elemente.filter((e) => menge.has(e.id) && e.gruppe).map((e) => e.gruppe))
  return elemente.filter((e) => menge.has(e.id) || (e.gruppe !== undefined && gruppen.has(e.gruppe))).map((e) => e.id)
}

/** Ist die Auswahl genau eine Gruppe? Dann bietet die Auswahlleiste „Gruppe lösen“ an, sonst „Gruppieren“. */
export const istEineGruppe = (gewaehlt: Element[]) => gewaehlt.length > 1 && gewaehlt.every((e) => e.gruppe !== undefined && e.gruppe === gewaehlt[0].gruppe)

/** Die Elemente als eine Gruppe (vorhandene Gruppen darin gehen in der neuen auf – Gruppen in Gruppen gibt es nicht) */
export const gruppiert = (gewaehlt: Element[], gruppe: string): Element[] => gewaehlt.map((e) => ({ ...e, gruppe }))

/** Die Elemente ohne Gruppe */
export const geloest = (gewaehlt: Element[]): Element[] =>
  gewaehlt.map((e) => {
    const ohne = { ...e }
    delete ohne.gruppe
    return ohne
  })

/** Die bisherige Drehung, an der eingerastet wird: die des einen ausgewählten Elements, sonst 0 */
export const drehBasis = (elemente: Element[]) => (elemente.length === 1 ? drehungVon(elemente[0]) : 0)

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
