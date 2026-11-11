// Geometrie der Tafel: Kamera (Verschieben, Zoomen), Treffer des Radierers, Umriss eines Strichs als Pfad.
import { getStroke } from 'perfect-freehand'
import { MARKER_FAKTOR, ZOOM_MAX, ZOOM_MIN, type Element, type Form, type Kamera, type Strich, type Text } from './modell.ts'

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

// ---------- Text und Formen ----------

/** Zeilenabstand eines Textes als Vielfaches der Schriftgröße */
export const ZEILENHOEHE = 1.25

/**
 * Geschätzte Größe eines Textes (Breite, Höhe) – ohne Browser berechenbar. Die Zeichenfläche misst beim
 * Zeichnen genau; für Auswahl und Radierer genügt die Schätzung (mittlere Zeichenbreite 0,55 der Schriftgröße).
 */
export function textMass(t: Text): [number, number] {
  const zeilen = t.text.split('\n')
  const laengste = Math.max(1, ...zeilen.map((z) => z.length))
  return [laengste * t.groesse * 0.55, zeilen.length * t.groesse * ZEILENHOEHE]
}

/** Umschließendes Rechteck [links, oben, rechts, unten] eines Elements, einschließlich Strichbreite */
export function rahmen(e: Element): [number, number, number, number] {
  if (e.art === 'text') {
    const [b, h] = textMass(e)
    return [e.x, e.y, e.x + b, e.y + h]
  }
  if (e.art === 'form') {
    const r = e.staerke / 2
    return [Math.min(e.x1, e.x2) - r, Math.min(e.y1, e.y2) - r, Math.max(e.x1, e.x2) + r, Math.max(e.y1, e.y2) + r]
  }
  const r = breite(e) / 2
  let [l, o, re, u] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of e.punkte) {
    l = Math.min(l, x)
    o = Math.min(o, y)
    re = Math.max(re, x)
    u = Math.max(u, y)
  }
  return [l - r, o - r, re + r, u + r]
}

/** Gemeinsamer Rahmen mehrerer Elemente oder null, wenn es keine gibt */
export function gesamtRahmen(elemente: Element[]): [number, number, number, number] | null {
  if (!elemente.length) return null
  const alle = elemente.map(rahmen)
  return [Math.min(...alle.map((r) => r[0])), Math.min(...alle.map((r) => r[1])), Math.max(...alle.map((r) => r[2])), Math.max(...alle.map((r) => r[3]))]
}

function trifftForm(f: Form, x: number, y: number, r: number): boolean {
  const grenze = r + f.staerke / 2
  if (f.form === 'linie' || f.form === 'pfeil') return abstandZurStrecke(x, y, f.x1, f.y1, f.x2, f.y2) <= grenze
  const [l, o, re, u] = [Math.min(f.x1, f.x2), Math.min(f.y1, f.y2), Math.max(f.x1, f.x2), Math.max(f.y1, f.y2)]
  if (f.form === 'rechteck') {
    // nur der Rand zählt – das Innere bleibt frei, damit man hineinschreiben und dort radieren kann
    const aussen = x >= l - grenze && x <= re + grenze && y >= o - grenze && y <= u + grenze
    const innen = x > l + grenze && x < re - grenze && y > o + grenze && y < u - grenze
    return aussen && !innen
  }
  // Ellipse: Abstand vom Rand näherungsweise über den normierten Radius
  const [mx, my, a, b] = [(l + re) / 2, (o + u) / 2, Math.max(1e-6, (re - l) / 2), Math.max(1e-6, (u - o) / 2)]
  const n = Math.hypot((x - mx) / a, (y - my) / b)
  return Math.abs(n - 1) * Math.min(a, b) <= grenze
}

/** Berührt ein Kreis mit Mittelpunkt (x, y) und Radius r das Element? (Radierer und Auswahl) */
export function trifft(e: Element, x: number, y: number, r: number): boolean {
  if (e.art === 'strich') return trifftStrich(e, x, y, r)
  if (e.art === 'form') return trifftForm(e, x, y, r)
  const [l, o, re, u] = rahmen(e)
  return x >= l - r && x <= re + r && y >= o - r && y <= u + r
}

/** Das oberste Element an dieser Stelle (zuletzt gezeichnete liegen oben) oder null */
export function oberstesBei(elemente: Element[], x: number, y: number, r: number): Element | null {
  for (let i = elemente.length - 1; i >= 0; i--) if (trifft(elemente[i], x, y, r)) return elemente[i]
  return null
}

/** Dasselbe Element (gleiche Kennung), um dx/dy verschoben */
export function verschoben<T extends Element>(e: T, dx: number, dy: number): T {
  if (e.art === 'strich') return { ...e, punkte: e.punkte.map(([x, y, d]) => [x + dx, y + dy, d]) }
  if (e.art === 'text') return { ...e, x: e.x + dx, y: e.y + dy }
  return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy }
}

/** Die zwei Endpunkte der Pfeilspitze am Ende (x2, y2) */
export function pfeilspitze(f: Form): [[number, number], [number, number]] {
  const winkel = Math.atan2(f.y2 - f.y1, f.x2 - f.x1)
  const laenge = Math.min(Math.hypot(f.x2 - f.x1, f.y2 - f.y1) * 0.6, 10 + f.staerke * 3)
  const ecke = (w: number): [number, number] => [f.x2 - laenge * Math.cos(winkel + w), f.y2 - laenge * Math.sin(winkel + w)]
  return [ecke(0.45), ecke(-0.45)]
}
