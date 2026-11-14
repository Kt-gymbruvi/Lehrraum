// Geometrie der Tafel: Kamera (Verschieben, Zoomen), Treffer des Radierers, Umriss eines Strichs als Pfad.
import { getStroke } from 'perfect-freehand'
import { DREHBARE_FORMEN, hintergrundMass, MARKER_FAKTOR, normiereWinkel, ZOOM_MAX, ZOOM_MIN, type Bild, type Element, type Form, type Kamera, type Seite, type Strich, type Text } from './modell.ts'

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

// ---------- Drehung ----------

const RAD = Math.PI / 180

/** Punkt (x, y) um (cx, cy) gedreht; Winkel in Grad, positiv im Uhrzeigersinn (die y-Achse zeigt nach unten) */
export function drehePunkt(x: number, y: number, cx: number, cy: number, grad: number): [number, number] {
  if (!grad) return [x, y]
  const c = Math.cos(grad * RAD)
  const s = Math.sin(grad * RAD)
  const dx = x - cx
  const dy = y - cy
  return [cx + dx * c - dy * s, cy + dx * s + dy * c]
}

/** Eigene Drehung eines Elements in Grad (Striche, Linien und Pfeile haben keine – sie werden über ihre Punkte gedreht) */
export function drehungVon(e: Element): number {
  if (e.art === 'strich') return 0
  if (e.art === 'form' && !DREHBARE_FORMEN.includes(e.form)) return 0
  return e.drehung ?? 0
}

/** Mitte des ungedrehten Rahmens einer Form – um sie wirkt ihre Drehung */
const formMitte = (f: Form): [number, number] => [(f.x1 + f.x2) / 2, (f.y1 + f.y2) / 2]

/** Ungedrehter Rahmen von Text und Bild; ihre Drehung wirkt um die linke obere Ecke */
function grundRahmen(e: Text | Bild): Rechteck {
  const [b, h] = e.art === 'text' ? textMass(e) : [e.b, e.h]
  return [e.x, e.y, e.x + b, e.y + h]
}

const eckenVon = ([l, o, r, u]: Rechteck): [number, number][] => [[l, o], [r, o], [r, u], [l, u]]

/** Die vier Ecken von Text oder Bild, so wie sie zu sehen sind */
function sichtbareEcken(e: Text | Bild): [number, number][] {
  const w = drehungVon(e)
  return eckenVon(grundRahmen(e)).map(([x, y]) => drehePunkt(x, y, e.x, e.y, w))
}

/** Die Ecken eines Rechtecks (Form), so wie sie zu sehen sind */
export function rechteckEcken(f: Form): [number, number][] {
  const [mx, my] = formMitte(f)
  return eckenVon(rechteckAus(f.x1, f.y1, f.x2, f.y2)).map(([x, y]) => drehePunkt(x, y, mx, my, drehungVon(f)))
}

/** Die drei Ecken eines Dreiecks, so wie sie zu sehen sind: Grundseite unten, Spitze oben */
export function dreieckPunkte(f: Form): [number, number][] {
  const [l, o, r, u] = rechteckAus(f.x1, f.y1, f.x2, f.y2)
  const [mx, my] = formMitte(f)
  const t = f.spitze ?? 0.5
  const punkte: [number, number][] = [[l, u], [r, u], [l + (r - l) * t, o]]
  return punkte.map(([x, y]) => drehePunkt(x, y, mx, my, drehungVon(f)))
}

/** Umschließendes Rechteck von Punkten, um rand erweitert */
function huelle(punkte: [number, number][], rand = 0): Rechteck {
  const xs = punkte.map((p) => p[0])
  const ys = punkte.map((p) => p[1])
  return [Math.min(...xs) - rand, Math.min(...ys) - rand, Math.max(...xs) + rand, Math.max(...ys) + rand]
}

/**
 * Dasselbe Element, um (cx, cy) gedreht. Striche, Linien und Pfeile drehen ihre Punkte; Text, Bild, Rechteck,
 * Ellipse und Dreieck verschieben ihren Drehpunkt und merken sich den Winkel (0 wird nicht gespeichert).
 */
export function gedreht<T extends Element>(e: T, cx: number, cy: number, grad: number): T {
  if (e.art === 'strich') return { ...e, punkte: e.punkte.map(([x, y, d]) => [...drehePunkt(x, y, cx, cy, grad), d]) }
  if (e.art === 'form' && !DREHBARE_FORMEN.includes(e.form)) {
    const [x1, y1] = drehePunkt(e.x1, e.y1, cx, cy, grad)
    const [x2, y2] = drehePunkt(e.x2, e.y2, cx, cy, grad)
    return { ...e, x1, y1, x2, y2 }
  }
  const winkel = normiereWinkel(drehungVon(e) + grad)
  const ohne: Record<string, unknown> = { ...e }
  delete ohne.drehung
  if (Math.abs(winkel) > 1e-9) ohne.drehung = winkel
  if (e.art === 'form') {
    const [mx, my] = formMitte(e)
    const [nx, ny] = drehePunkt(mx, my, cx, cy, grad)
    return { ...ohne, x1: e.x1 + nx - mx, y1: e.y1 + ny - my, x2: e.x2 + nx - mx, y2: e.y2 + ny - my } as T
  }
  const t = e as Text | Bild
  const [x, y] = drehePunkt(t.x, t.y, cx, cy, grad)
  return { ...ohne, x, y } as T
}

/** Umschließendes Rechteck [links, oben, rechts, unten] eines Elements, so wie es zu sehen ist, einschließlich Strichbreite */
export function rahmen(e: Element): [number, number, number, number] {
  if (e.art === 'bild' || e.art === 'text') return drehungVon(e) ? huelle(sichtbareEcken(e)) : grundRahmen(e)
  if (e.art === 'form') {
    const r = e.staerke / 2
    const w = drehungVon(e)
    if (e.form === 'dreieck') return huelle(dreieckPunkte(e), r)
    if (w && e.form === 'rechteck') return huelle(rechteckEcken(e), r)
    if (w && e.form === 'ellipse') {
      const [mx, my] = formMitte(e)
      const [a, b] = [Math.abs(e.x2 - e.x1) / 2, Math.abs(e.y2 - e.y1) / 2]
      const [c, s] = [Math.cos(w * RAD), Math.sin(w * RAD)]
      const hx = Math.hypot(a * c, b * s)
      const hy = Math.hypot(a * s, b * c)
      return [mx - hx - r, my - hy - r, mx + hx + r, my + hy + r]
    }
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

function trifftForm(f: Form, qx: number, qy: number, r: number): boolean {
  const grenze = r + f.staerke / 2
  if (f.form === 'linie' || f.form === 'pfeil') return abstandZurStrecke(qx, qy, f.x1, f.y1, f.x2, f.y2) <= grenze
  // Den Punkt in die ungedrehte Lage der Form zurückdrehen
  const [fx, fy] = formMitte(f)
  const [x, y] = drehePunkt(qx, qy, fx, fy, -drehungVon(f))
  if (f.form === 'dreieck') {
    const p = dreieckPunkte({ ...f, drehung: 0 })
    return [0, 1, 2].some((i) => abstandZurStrecke(x, y, p[i][0], p[i][1], p[(i + 1) % 3][0], p[(i + 1) % 3][1]) <= grenze)
  }
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
  const [px, py] = drehePunkt(x, y, e.x, e.y, -drehungVon(e))
  const [l, o, re, u] = grundRahmen(e)
  return px >= l - r && px <= re + r && py >= o - r && py <= u + r
}

/** Das oberste Element an dieser Stelle (zuletzt gezeichnete liegen oben) oder null */
export function oberstesBei(elemente: Element[], x: number, y: number, r: number): Element | null {
  for (let i = elemente.length - 1; i >= 0; i--) if (trifft(elemente[i], x, y, r)) return elemente[i]
  return null
}

/** Rechteck [links, oben, rechts, unten] */
export type Rechteck = [number, number, number, number]

/** Rechteck aus zwei beliebigen Ecken */
export const rechteckAus = (x1: number, y1: number, x2: number, y2: number): Rechteck => [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)]

const imRechteck = (x: number, y: number, [l, o, r, u]: Rechteck) => x >= l && x <= r && y >= o && y <= u
const erweitert = ([l, o, r, u]: Rechteck, d: number): Rechteck => [l - d, o - d, r + d, u + d]

/** Berührt die Strecke a–b das Rechteck? (Abschneiden nach Liang und Barsky) */
export function streckeBeruehrt(ax: number, ay: number, bx: number, by: number, r: Rechteck): boolean {
  if (imRechteck(ax, ay, r) || imRechteck(bx, by, r)) return true
  const dx = bx - ax
  const dy = by - ay
  const p = [-dx, dx, -dy, dy]
  const q = [ax - r[0], r[2] - ax, ay - r[1], r[3] - ay]
  let t0 = 0
  let t1 = 1
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false
      continue
    }
    const t = q[i] / p[i]
    if (p[i] < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return false
  }
  return true
}

/** Die sichtbaren Linien einer Form als Strecken [x1, y1, x2, y2] (die Ellipse als Vieleck) */
function formStrecken(f: Form): [number, number, number, number][] {
  if (f.form === 'linie') return [[f.x1, f.y1, f.x2, f.y2]]
  if (f.form === 'pfeil') {
    const [a, b] = pfeilspitze(f)
    return [[f.x1, f.y1, f.x2, f.y2], [a[0], a[1], f.x2, f.y2], [b[0], b[1], f.x2, f.y2]]
  }
  const ring = (p: [number, number][]) => p.map((a, i) => [...a, ...p[(i + 1) % p.length]] as [number, number, number, number])
  if (f.form === 'rechteck') return ring(rechteckEcken(f))
  if (f.form === 'dreieck') return ring(dreieckPunkte(f))
  const [l, o, r, u] = rechteckAus(f.x1, f.y1, f.x2, f.y2)
  const [mx, my, a, b] = [(l + r) / 2, (o + u) / 2, (r - l) / 2, (u - o) / 2]
  const n = 32
  const w = drehungVon(f)
  return ring(Array.from({ length: n }, (_, i) => drehePunkt(mx + a * Math.cos((i / n) * 2 * Math.PI), my + b * Math.sin((i / n) * 2 * Math.PI), mx, my, w)))
}

/**
 * Berührt das Element das Rechteck (Auswahlrahmen)? Es muss nicht ganz darin liegen. Bei Strichen und Formen
 * zählt die sichtbare Linie – ein Rahmen im leeren Inneren eines Rechtecks berührt es nicht.
 */
export function beruehrtRechteck(e: Element, r: Rechteck): boolean {
  const [l, o, re, u] = rahmen(e)
  if (re < r[0] || l > r[2] || u < r[1] || o > r[3]) return false
  if (e.art === 'text' || e.art === 'bild') {
    const w = drehungVon(e)
    if (!w) return true
    // Gedreht: eine Kante liegt im Rahmen – oder der Rahmen liegt ganz im Text bzw. Bild
    const ecken = sichtbareEcken(e)
    if (ecken.some((p, i) => streckeBeruehrt(p[0], p[1], ecken[(i + 1) % 4][0], ecken[(i + 1) % 4][1], r))) return true
    const [px, py] = drehePunkt(r[0], r[1], e.x, e.y, -w)
    const g = grundRahmen(e)
    return px >= g[0] && px <= g[2] && py >= g[1] && py <= g[3]
  }
  if (e.art === 'form') {
    const g = erweitert(r, e.staerke / 2)
    return formStrecken(e).some(([ax, ay, bx, by]) => streckeBeruehrt(ax, ay, bx, by, g))
  }
  const g = erweitert(r, breite(e) / 2)
  const p = e.punkte
  if (p.length === 1) return imRechteck(p[0][0], p[0][1], g)
  for (let i = 1; i < p.length; i++) if (streckeBeruehrt(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], g)) return true
  return false
}

const klemme = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))

/**
 * Dasselbe Element, gestreckt um den festen Punkt (ax, ay): waagrecht um sx, senkrecht um sy.
 * mitStaerke: Strich- und Linienbreite wachsen mit (beim gleichmäßigen Vergrößern am Eckgriff).
 * Text und Bilder werden nur gleichmäßig verändert (sx gilt dann für beide Richtungen).
 */
export function skaliert<T extends Element>(e: T, ax: number, ay: number, sx: number, sy: number, mitStaerke: boolean): T {
  const x = (v: number) => ax + (v - ax) * sx
  const y = (v: number) => ay + (v - ay) * sy
  if (e.art === 'text') return { ...e, x: x(e.x), y: ay + (e.y - ay) * sx, groesse: klemme(e.groesse * sx, 6, 400) }
  if (e.art === 'bild') return { ...e, x: x(e.x), y: ay + (e.y - ay) * sx, b: e.b * sx, h: e.h * sx }
  const staerke = mitStaerke ? klemme(e.staerke * sx, 0.5, 200) : e.staerke
  if (e.art === 'strich') return { ...e, staerke, punkte: e.punkte.map(([px, py, d]) => [x(px), y(py), d]) }
  return { ...e, staerke, x1: x(e.x1), y1: y(e.y1), x2: x(e.x2), y2: y(e.y2) }
}

/** Dasselbe Element (gleiche Kennung), um dx/dy verschoben */
export function verschoben<T extends Element>(e: T, dx: number, dy: number): T {
  if (e.art === 'strich') return { ...e, punkte: e.punkte.map(([x, y, d]) => [x + dx, y + dy, d]) }
  if (e.art === 'text' || e.art === 'bild') return { ...e, x: e.x + dx, y: e.y + dy }
  return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy }
}

/** Die zwei Endpunkte der Pfeilspitze am Ende (x2, y2) */
export function pfeilspitze(f: Form): [[number, number], [number, number]] {
  const winkel = Math.atan2(f.y2 - f.y1, f.x2 - f.x1)
  const laenge = Math.min(Math.hypot(f.x2 - f.x1, f.y2 - f.y1) * 0.6, 10 + f.staerke * 3)
  const ecke = (w: number): [number, number] => [f.x2 - laenge * Math.cos(winkel + w), f.y2 - laenge * Math.sin(winkel + w)]
  return [ecke(0.45), ecke(-0.45)]
}

// ---------- Seitenmaß für den PDF-Export ----------

/** A4 quer bei 96 Punkten pro Zoll – so groß ist eine Seite mindestens, wenn sie keinen Hintergrund hat */
export const A4_QUER: [number, number] = [1123, 794]
const SEITENRAND = 24

/**
 * Der Ausschnitt [links, oben, Breite, Höhe], der beim Export zu einer PDF-Seite wird:
 * mit Hintergrund genau dessen Fläche (plus was darüber hinausragt), sonst mindestens A4 quer ab (0, 0)
 * und alles Gezeichnete mit etwas Rand.
 */
export function seitenMass(s: Seite): [number, number, number, number] {
  const inhalt = gesamtRahmen(s.elemente)
  const basis: [number, number, number, number] = s.hintergrund ? [0, 0, ...hintergrundMass(s.hintergrund)] : [0, 0, A4_QUER[0], A4_QUER[1]]
  if (!inhalt) return [basis[0], basis[1], basis[2] - basis[0], basis[3] - basis[1]]
  const l = Math.min(basis[0], inhalt[0] - SEITENRAND)
  const o = Math.min(basis[1], inhalt[1] - SEITENRAND)
  const r = Math.max(basis[2], inhalt[2] + SEITENRAND)
  const u = Math.max(basis[3], inhalt[3] + SEITENRAND)
  return [Math.floor(l), Math.floor(o), Math.ceil(r - l), Math.ceil(u - o)]
}

/** Größe (Breite, Höhe), in der ein neues Bild auf die Tafel kommt: höchstens maxB breit bzw. maxH hoch, nie vergrößert */
export function einpassen(b: number, h: number, maxB: number, maxH: number): [number, number] {
  const f = Math.min(1, maxB / b, maxH / h)
  return [Math.round(b * f), Math.round(h * f)]
}
