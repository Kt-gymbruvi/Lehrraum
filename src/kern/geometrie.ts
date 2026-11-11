// Geometrie der Tafel: Kamera (Verschieben, Zoomen), Treffer des Radierers, Umriss eines Strichs als Pfad.
import { getStroke } from 'perfect-freehand'
import { MARKER_FAKTOR, ZOOM_MAX, ZOOM_MIN, type Kamera, type Strich } from './modell.ts'

/** Bildschirmpunkt (Pixel in der Zeichenfläche) → Tafel-Koordinaten */
export function zuTafel(k: Kamera, sx: number, sy: number): [number, number] {
  return [(sx - k.x) / k.zoom, (sy - k.y) / k.zoom]
}

/** Zoomt so, dass der Bildschirmpunkt (sx, sy) an seiner Stelle bleibt. */
export function zoomeUm(k: Kamera, sx: number, sy: number, faktor: number): Kamera {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k.zoom * faktor))
  const [tx, ty] = zuTafel(k, sx, sy)
  return { zoom, x: sx - tx * zoom, y: sy - ty * zoom }
}

export const verschiebe = (k: Kamera, dx: number, dy: number): Kamera => ({ ...k, x: k.x + dx, y: k.y + dy })

/** Tatsächliche Breite eines Strichs auf der Tafel */
export const breite = (s: Strich): number => (s.werkzeug === 'marker' ? s.staerke * MARKER_FAKTOR : s.staerke)

/** Abstand des Punktes p zur Strecke a–b */
export function abstandZurStrecke(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const laenge2 = dx * dx + dy * dy
  const t = laenge2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / laenge2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Berührt ein Kreis (Radierer) mit Mittelpunkt (x, y) und Radius r den Strich? */
export function trifftStrich(s: Strich, x: number, y: number, r: number): boolean {
  const grenze = r + breite(s) / 2
  const p = s.punkte
  if (p.length === 1) return Math.hypot(x - p[0][0], y - p[0][1]) <= grenze
  for (let i = 1; i < p.length; i++) {
    if (abstandZurStrecke(x, y, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]) <= grenze) return true
  }
  return false
}

/** Umriss eines Stiftstrichs (Vieleck) – dicker bei mehr Druck. */
export function stiftUmriss(s: Strich): number[][] {
  return getStroke(s.punkte, {
    size: s.staerke * 1.6,
    thinning: s.druckEcht ? 0.6 : 0.4,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: !s.druckEcht,
    last: true,
  })
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Vieleck → SVG-Pfad mit weichen Übergängen (für Path2D) */
export function pfadAusUmriss(umriss: number[][]): string {
  if (umriss.length < 2) return ''
  const teile: (string | number)[] = ['M', r2(umriss[0][0]), r2(umriss[0][1]), 'Q']
  for (let i = 0; i < umriss.length; i++) {
    const [x0, y0] = umriss[i]
    const [x1, y1] = umriss[(i + 1) % umriss.length]
    teile.push(r2(x0), r2(y0), r2((x0 + x1) / 2), r2((y0 + y1) / 2))
  }
  teile.push('Z')
  return teile.join(' ')
}

/** Mittellinie eines Strichs als SVG-Pfad (für den Textmarker: eine gleichmäßig breite Linie) */
export function pfadAusPunkten(s: Strich): string {
  const p = s.punkte
  if (p.length === 1) return `M ${r2(p[0][0])} ${r2(p[0][1])} l 0.01 0`
  let d = `M ${r2(p[0][0])} ${r2(p[0][1])}`
  for (let i = 1; i < p.length - 1; i++) {
    d += ` Q ${r2(p[i][0])} ${r2(p[i][1])} ${r2((p[i][0] + p[i + 1][0]) / 2)} ${r2((p[i][1] + p[i + 1][1]) / 2)}`
  }
  const l = p[p.length - 1]
  return d + ` L ${r2(l[0])} ${r2(l[1])}`
}
