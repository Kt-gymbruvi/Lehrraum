// Begradigen durch Halten (S3): Hält die Lehrkraft den Stift am Ende eines Strichs kurz still, wird aus dem
// freihändigen Strich eine saubere Form – gerade Linie, Rechteck, Kreis/Ellipse oder Dreieck. Reine Logik ohne
// React und ohne Browser; wann gehalten wird, entscheidet die Zeichenfläche.
//
// Vorgehen: Zuerst die Linie (alle Punkte nah an der Strecke vom Anfang zum Ende). Sonst muss der Strich
// ungefähr geschlossen sein; dann werden Rechteck (kleinstes umschließendes, auch schräg), Ellipse (im selben
// Rahmen) und Dreieck (größtes Dreieck in der konvexen Hülle) angelegt und das genommen, dem die Punkte im
// Mittel am nächsten liegen. Liegt auch das zu weit weg, bleibt der Strich, wie er ist.
import { normiereWinkel, type Form, type Strich } from './modell.ts'

/** So lange (ms) muss der Stift stillstehen */
export const HALTEZEIT_MS = 600
/** So weit (Bildschirm-Pixel) darf der Stift beim Halten zittern, ohne dass die Zeit neu beginnt */
export const HALTE_TOLERANZ = 8
/** Kleinere Striche (Bildschirm-Pixel, Diagonale des Rahmens) werden nie begradigt: Punkte, Kommas, kleine Zeichen */
export const MIN_GROESSE = 24
/** Fast waagerechte und senkrechte Linien, Rechtecke und Dreiecke werden gerade gestellt (Grad) */
const EINRASTEN = 5
/** Linie: größter Abstand eines Punktes von der Strecke, im Verhältnis zu ihrer Länge */
const LINIE_ABWEICHUNG = 0.07
/** Geschlossen heißt: Die Lücke zwischen Anfang und Ende ist höchstens so groß im Verhältnis zur Weglänge */
const LUECKE = 0.2
/** Mittlerer Abstand der Punkte von der Form, im Verhältnis zur Größe (Wurzel aus Breite · Höhe) */
const FEHLER_GRENZE = 0.06
/** Fast gleich breit wie hoch: Kreis statt Ellipse */
const KREIS_VERHAELTNIS = 0.9

type P = [number, number]
export type Erkannt = 'linie' | 'rechteck' | 'ellipse' | 'dreieck'

const abstand = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1])
const GRAD = 180 / Math.PI

function abstandZurStrecke(p: P, a: P, b: P): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

/** Konvexe Hülle (Andrew), gegen den Uhrzeigersinn, ohne doppelten Endpunkt */
function huelle(punkte: P[]): P[] {
  const p = [...punkte].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const kreuz = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const unten: P[] = []
  for (const q of p) {
    while (unten.length >= 2 && kreuz(unten[unten.length - 2], unten[unten.length - 1], q) <= 0) unten.pop()
    unten.push(q)
  }
  const oben: P[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (oben.length >= 2 && kreuz(oben[oben.length - 2], oben[oben.length - 1], q) <= 0) oben.pop()
    oben.push(q)
  }
  return [...unten.slice(0, -1), ...oben.slice(0, -1)]
}

/** Rahmen mit Mitte, Breite (entlang des Winkels), Höhe und Winkel in Grad */
type Rahmen = { cx: number; cy: number; b: number; h: number; winkel: number }

/** Kleinstes umschließendes Rechteck (eine Seite liegt immer auf einer Kante der Hülle) */
function kleinsterRahmen(h: P[]): Rahmen {
  let best: Rahmen | null = null
  let bestFlaeche = Infinity
  for (let i = 0; i < h.length; i++) {
    const a = h[i]
    const b = h[(i + 1) % h.length]
    const l = abstand(a, b)
    if (!l) continue
    const ux = (b[0] - a[0]) / l
    const uy = (b[1] - a[1]) / l
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (const p of h) {
      const u = p[0] * ux + p[1] * uy
      const v = -p[0] * uy + p[1] * ux
      minU = Math.min(minU, u)
      maxU = Math.max(maxU, u)
      minV = Math.min(minV, v)
      maxV = Math.max(maxV, v)
    }
    const flaeche = (maxU - minU) * (maxV - minV)
    if (flaeche < bestFlaeche) {
      bestFlaeche = flaeche
      const mu = (minU + maxU) / 2
      const mv = (minV + maxV) / 2
      best = { cx: mu * ux - mv * uy, cy: mu * uy + mv * ux, b: maxU - minU, h: maxV - minV, winkel: Math.atan2(uy, ux) * GRAD }
    }
  }
  return best ?? { cx: h[0][0], cy: h[0][1], b: 0, h: 0, winkel: 0 }
}

/** Dreht den Rahmen um Vielfache von 90°, bis sein Winkel zwischen −45° und 45° liegt; fast gerade wird gerade */
function aufrecht(r: Rahmen): Rahmen {
  let { b, h } = r
  let w = normiereWinkel(r.winkel)
  while (w > 45) {
    w -= 90
    ;[b, h] = [h, b]
  }
  while (w <= -45) {
    w += 90
    ;[b, h] = [h, b]
  }
  if (Math.abs(w) < EINRASTEN) w = 0
  return { ...r, b, h, winkel: w }
}

/** Punkt in die Koordinaten des Rahmens (Mitte = 0, Achsen entlang des Rahmens) */
function lokal(p: P, r: Rahmen): P {
  const c = Math.cos(r.winkel / GRAD)
  const s = Math.sin(r.winkel / GRAD)
  const dx = p[0] - r.cx
  const dy = p[1] - r.cy
  return [dx * c + dy * s, -dx * s + dy * c]
}

function abstandZumRechteck(p: P, r: Rahmen): number {
  const [u, v] = lokal(p, r)
  const dx = Math.abs(u) - r.b / 2
  const dy = Math.abs(v) - r.h / 2
  if (dx > 0 || dy > 0) return Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  return Math.min(-dx, -dy)
}

/** Näherung: Abstand entlang des Strahls von der Mitte durch den Punkt */
function abstandZurEllipse(p: P, r: Rahmen): number {
  const [u, v] = lokal(p, r)
  const a = r.b / 2
  const b = r.h / 2
  const k = Math.hypot(u / a, v / b)
  if (!k) return Math.min(a, b)
  return Math.hypot(u, v) * Math.abs(1 - 1 / k)
}

/** Größtes Dreieck aus Punkten der Hülle (bei vielen Punkten aus einer gleichmäßigen Auswahl) */
function groesstesDreieck(h: P[]): [P, P, P] | null {
  const schritt = Math.max(1, Math.ceil(h.length / 48))
  const q = h.filter((_, i) => i % schritt === 0)
  let best: [P, P, P] | null = null
  let bestFlaeche = 0
  for (let i = 0; i < q.length; i++)
    for (let j = i + 1; j < q.length; j++)
      for (let k = j + 1; k < q.length; k++) {
        const f = Math.abs((q[j][0] - q[i][0]) * (q[k][1] - q[i][1]) - (q[j][1] - q[i][1]) * (q[k][0] - q[i][0])) / 2
        if (f > bestFlaeche) {
          bestFlaeche = f
          best = [q[i], q[j], q[k]]
        }
      }
  return best
}

const mittel = (punkte: P[], f: (p: P) => number) => punkte.reduce((s, p) => s + f(p), 0) / punkte.length

/** Welche Form steckt im Strich? Nur die Art – für Tests und die Anzeige. */
export function erkenne(s: Strich, zoom = 1): Erkannt | null {
  const e = begradige(s, zoom)
  if (!e) return null
  return e.art === 'strich' ? 'linie' : (e.form as Erkannt)
}

/**
 * Die saubere Form zum Strich, oder null, wenn nichts erkannt wird. Sie trägt die Kennung des Strichs (so ersetzt
 * sie ihn als ein Schritt im Verlauf), seine Farbe und Stärke. Der Textmarker wird nur zur geraden Linie und bleibt
 * ein Textmarker-Strich; der Stift wird zur Form. zoom: Maßstab der Ansicht (die Mindestgröße gilt auf dem Bildschirm).
 */
export function begradige(s: Strich, zoom = 1): Form | Strich | null {
  const punkte: P[] = []
  for (const [x, y] of s.punkte) if (!punkte.length || abstand(punkte[punkte.length - 1], [x, y]) > 1e-6) punkte.push([x, y])
  if (punkte.length < 2) return null
  const xs = punkte.map((p) => p[0])
  const ys = punkte.map((p) => p[1])
  if (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * zoom < MIN_GROESSE) return null

  let weg = 0
  for (let i = 1; i < punkte.length; i++) weg += abstand(punkte[i - 1], punkte[i])
  const anfang = punkte[0]
  const ende = punkte[punkte.length - 1]
  const luecke = abstand(anfang, ende)

  // Gerade Linie: alle Punkte nah an der Strecke, kein Hin und Her
  if (luecke >= 0.8 * weg && Math.max(...punkte.map((p) => abstandZurStrecke(p, anfang, ende))) <= LINIE_ABWEICHUNG * luecke) {
    let [a, b] = [anfang, ende]
    const w = Math.atan2(b[1] - a[1], b[0] - a[0]) * GRAD
    const naechste = Math.round(w / 90) * 90
    if (Math.abs(w - naechste) < EINRASTEN) {
      // um die Mitte gerade stellen
      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      const halb = luecke / 2
      const c = Math.round(Math.cos(naechste / GRAD))
      const si = Math.round(Math.sin(naechste / GRAD))
      a = [mx - c * halb, my - si * halb]
      b = [mx + c * halb, my + si * halb]
    }
    if (s.werkzeug === 'marker') return { ...s, punkte: [[a[0], a[1], 0.5], [b[0], b[1], 0.5]] }
    return { art: 'form', id: s.id, form: 'linie', x1: a[0], y1: a[1], x2: b[0], y2: b[1], farbe: s.farbe, staerke: s.staerke }
  }
  if (s.werkzeug === 'marker') return null
  if (luecke > LUECKE * weg) return null // offen: ein Haken, eine Welle, ein Buchstabe

  const h = huelle(punkte)
  if (h.length < 3) return null
  const rahmen = kleinsterRahmen(h)
  if (Math.min(rahmen.b, rahmen.h) < 0.12 * Math.max(rahmen.b, rahmen.h)) return null // flach: eher hin und her als eine Fläche
  const groesse = Math.sqrt(rahmen.b * rahmen.h)
  const dreieck = groesstesDreieck(h)

  const kandidaten: { art: 'rechteck' | 'ellipse' | 'dreieck'; fehler: number }[] = [
    { art: 'rechteck', fehler: mittel(punkte, (p) => abstandZumRechteck(p, rahmen)) / groesse },
    { art: 'ellipse', fehler: mittel(punkte, (p) => abstandZurEllipse(p, rahmen)) / groesse },
  ]
  if (dreieck) {
    const [a, b, c] = dreieck
    kandidaten.push({ art: 'dreieck', fehler: mittel(punkte, (p) => Math.min(abstandZurStrecke(p, a, b), abstandZurStrecke(p, b, c), abstandZurStrecke(p, c, a))) / groesse })
  }
  const best = kandidaten.reduce((x, y) => (y.fehler < x.fehler ? y : x))
  if (best.fehler > FEHLER_GRENZE) return null

  const grund = { art: 'form' as const, id: s.id, farbe: s.farbe, staerke: s.staerke }
  if (best.art === 'dreieck') return alsDreieck(dreieck!, grund)
  let r = aufrecht(rahmen)
  if (best.art === 'ellipse' && Math.min(r.b, r.h) >= KREIS_VERHAELTNIS * Math.max(r.b, r.h)) {
    const d = (r.b + r.h) / 2
    r = { ...r, b: d, h: d, winkel: 0 }
  }
  return { ...grund, form: best.art, x1: r.cx - r.b / 2, y1: r.cy - r.h / 2, x2: r.cx + r.b / 2, y2: r.cy + r.h / 2, ...(r.winkel ? { drehung: r.winkel } : {}) }
}

/**
 * Dreieck aus drei Ecken: Die längste Seite wird die Grundseite (unten im Rahmen), die dritte Ecke die Spitze;
 * der Rahmen wird um seine Mitte gedreht, bis die Grundseite dort liegt, wo sie gezeichnet wurde.
 */
function alsDreieck(ecken: [P, P, P], grund: Pick<Form, 'art' | 'id' | 'farbe' | 'staerke'>): Form {
  const seiten: [P, P, P][] = [
    [ecken[0], ecken[1], ecken[2]],
    [ecken[1], ecken[2], ecken[0]],
    [ecken[2], ecken[0], ecken[1]],
  ]
  let [a, b, c] = seiten.reduce((x, y) => (abstand(y[0], y[1]) > abstand(x[0], x[1]) ? y : x))
  const laenge = abstand(a, b)
  let ux = (b[0] - a[0]) / laenge
  let uy = (b[1] - a[1]) / laenge
  // „Oben“ im ungedrehten Rahmen ist (0, −1); gedreht um den Winkel der Grundseite: (uy, −ux)
  if ((c[0] - a[0]) * uy - (c[1] - a[1]) * ux < 0) {
    ;[a, b] = [b, a]
    ux = -ux
    uy = -uy
  }
  const nx = uy
  const ny = -ux
  const hoehe = (c[0] - a[0]) * nx + (c[1] - a[1]) * ny
  let spitze = ((c[0] - a[0]) * ux + (c[1] - a[1]) * uy) / laenge
  spitze = Math.min(1, Math.max(0, spitze))
  // fast gleichschenklig oder fast rechtwinklig: genau so
  for (const ziel of [0, 0.5, 1]) if (Math.abs(spitze - ziel) < 0.04) spitze = ziel
  const cx = a[0] + (ux * laenge) / 2 + (nx * hoehe) / 2
  const cy = a[1] + (uy * laenge) / 2 + (ny * hoehe) / 2
  let winkel = normiereWinkel(Math.atan2(uy, ux) * GRAD)
  for (const ziel of [-180, -90, 0, 90, 180]) if (Math.abs(winkel - ziel) < EINRASTEN) winkel = ziel
  winkel = normiereWinkel(winkel)
  return {
    ...grund,
    form: 'dreieck',
    x1: cx - laenge / 2,
    y1: cy - hoehe / 2,
    x2: cx + laenge / 2,
    y2: cy + hoehe / 2,
    ...(Math.abs(winkel) > 1e-9 ? { drehung: winkel } : {}),
    ...(spitze !== 0.5 ? { spitze } : {}),
  }
}
