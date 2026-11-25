// Geometrie-Werkzeuge über der Tafel: Lineal, Geodreieck, Winkelmesser, Zirkel. Sie liegen in Tafel-Koordinaten (wachsen
// also mit dem Zoom wie ein echtes Lineal auf dem Papier), lassen sich verschieben und um ihren Nullpunkt drehen.
// Ein Strich, der dicht an einer Kante beginnt, wird an diese Kante angelegt (gerade bzw. am Bogen entlang).
// Zirkel: Nadel im Nullpunkt, Mine auf dem Kreis mit dem Radius `radius` (cm); ein Strich dicht am Kreis läuft genau
// auf dem Kreis (wie die Mine), der Griff an der Mine zieht den Radius auf und dreht die Schenkel.
// Reine Funktionen. Die Werkzeuge ändern nie die Tafel und werden nicht gespeichert.

export const INSTRUMENTARTEN = ['lineal', 'geodreieck', 'winkelmesser', 'zirkel'] as const
export type InstrumentArt = (typeof INSTRUMENTARTEN)[number]
export const INSTRUMENT_NAMEN: Record<InstrumentArt, string> = { lineal: 'Lineal', geodreieck: 'Geodreieck', winkelmesser: 'Winkelmesser', zirkel: 'Zirkel' }

/**
 * x, y: Nullpunkt in Tafel-Koordinaten (beim Zirkel die Nadel); winkel in Grad, im Uhrzeigersinn (wie CSS rotate);
 * skala: Größe (fehlt = 1; nicht beim Zirkel); radius: nur Zirkel, in cm (fehlt = ZIRKEL_RADIUS)
 */
export type Instrument = { art: InstrumentArt; x: number; y: number; winkel: number; skala?: number; radius?: number }

export const INSTRUMENT_SKALA_MIN = 0.4
export const INSTRUMENT_SKALA_MAX = 3
export const klemmeSkala = (s: number): number => Math.round(Math.min(INSTRUMENT_SKALA_MAX, Math.max(INSTRUMENT_SKALA_MIN, s)) * 100) / 100
const massstab = (i: Instrument): number => i.skala ?? 1

/** Ein Zentimeter in Tafel-Einheiten (A4 bei 96 Punkten je Zoll, wie die Blattformate) */
export const CM = 96 / 2.54

/** Maße (cm). Lokale Koordinaten: x entlang der Messkante, y < 0 ist der Körper (über der Kante). */
export const LINEAL_LAENGE = 30
export const LINEAL_UEBERSTAND = 0.8
export const LINEAL_BREITE = 4
export const GEO_HALB = 8
export const WINKELMESSER_RADIUS = 8
/** Zirkel: Radius beim Auflegen, kleinster und größter Radius, Länge eines Schenkels (cm) */
export const ZIRKEL_RADIUS = 4
export const ZIRKEL_MIN = 0.5
export const ZIRKEL_MAX = 15
export const ZIRKEL_SCHENKEL = 9
export const zirkelRadius = (i: Instrument): number => i.radius ?? ZIRKEL_RADIUS
/** Radius auf 1 mm runden, an ganzen und halben Zentimetern einrasten (±0,1 cm), begrenzen */
export function klemmeRadius(r: number): number {
  const g = Math.min(ZIRKEL_MAX, Math.max(ZIRKEL_MIN, r))
  const halb = Math.round(g * 2) / 2
  return Math.abs(g - halb) <= 0.1 ? halb : Math.round(g * 10) / 10
}
/** „4,5 cm“ */
export const radiusText = (r: number): string => r.toFixed(1).replace('.', ',') + ' cm'

type P = [number, number]
/** Gerade Kante von a nach b mit Außennormale n – oder Bogen um den Nullpunkt (obere Hälfte) */
export type Kante = { art: 'strecke'; a: P; b: P; n: P } | { art: 'bogen'; r: number } | { art: 'kreis'; r: number }

const W = Math.SQRT1_2

/** Kanten eines aufgelegten Werkzeugs (lokal): beim Zirkel der Kreis der Mine, sonst die festen Kanten */
export function kantenVon(i: Instrument): Kante[] {
  return i.art === 'zirkel' ? [{ art: 'kreis', r: zirkelRadius(i) * CM }] : kanten(i.art)
}

/** Kanten eines Werkzeugs in lokalen Koordinaten (Tafel-Einheiten); Zirkel: Kreis mit dem Radius beim Auflegen */
export function kanten(art: InstrumentArt): Kante[] {
  if (art === 'zirkel') return [{ art: 'kreis', r: ZIRKEL_RADIUS * CM }]
  if (art === 'lineal') {
    const l = -LINEAL_UEBERSTAND * CM
    const r = (LINEAL_LAENGE + LINEAL_UEBERSTAND) * CM
    const o = -LINEAL_BREITE * CM
    return [
      { art: 'strecke', a: [l, 0], b: [r, 0], n: [0, 1] },
      { art: 'strecke', a: [l, o], b: [r, o], n: [0, -1] },
    ]
  }
  const h = GEO_HALB * CM
  if (art === 'geodreieck')
    return [
      { art: 'strecke', a: [-h, 0], b: [h, 0], n: [0, 1] },
      { art: 'strecke', a: [h, 0], b: [0, -h], n: [W, -W] },
      { art: 'strecke', a: [0, -h], b: [-h, 0], n: [-W, -W] },
    ]
  const r = WINKELMESSER_RADIUS * CM
  return [
    { art: 'strecke', a: [-r, 0], b: [r, 0], n: [0, 1] },
    { art: 'bogen', r },
  ]
}

/** Zirkel (lokal): Spitze der Nadel im Nullpunkt, Mine bei (r, 0), Gelenk oben dazwischen */
export function zirkelLage(radiusCm: number): { mine: P; gelenk: P } {
  const r = radiusCm * CM
  const l = ZIRKEL_SCHENKEL * CM
  const h = Math.sqrt(Math.max(l * l - (r / 2) * (r / 2), CM * CM))
  return { mine: [r, 0], gelenk: [r / 2, -h] }
}

/** Ein Schenkel als schmales Viereck von a nach b (Breite unten wa, oben wb) */
function schenkel(a: P, b: P, wa: number, wb: number): string {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const nx = -(b[1] - a[1]) / l
  const ny = (b[0] - a[0]) / l
  const f = (x: number) => Math.round(x * 100) / 100
  return `M${f(a[0] + nx * wa)} ${f(a[1] + ny * wa)}L${f(b[0] + nx * wb)} ${f(b[1] + ny * wb)}L${f(b[0] - nx * wb)} ${f(b[1] - ny * wb)}L${f(a[0] - nx * wa)} ${f(a[1] - ny * wa)}Z`
}

/** Umriss des Körpers in lokalen Koordinaten als SVG-Pfad (radius: nur Zirkel, cm) */
export function umriss(art: InstrumentArt, radius = ZIRKEL_RADIUS): string {
  if (art === 'zirkel') {
    const { mine, gelenk } = zirkelLage(radius)
    const k = 0.55 * CM // Gelenk
    return (
      schenkel([0, 0], gelenk, 0.04 * CM, 0.3 * CM) +
      schenkel(mine, gelenk, 0.12 * CM, 0.3 * CM) +
      `M${gelenk[0] - k} ${gelenk[1]}a${k} ${k} 0 1 0 ${2 * k} 0a${k} ${k} 0 1 0 ${-2 * k} 0Z` +
      schenkel([gelenk[0], gelenk[1] - k * 0.6], [gelenk[0], gelenk[1] - 2 * CM], 0.22 * CM, 0.22 * CM)
    )
  }
  if (art === 'lineal') {
    const l = -LINEAL_UEBERSTAND * CM
    const r = (LINEAL_LAENGE + LINEAL_UEBERSTAND) * CM
    return `M${l} 0H${r}V${-LINEAL_BREITE * CM}H${l}Z`
  }
  if (art === 'geodreieck') {
    const h = GEO_HALB * CM
    return `M${-h} 0H${h}L0 ${-h}Z`
  }
  const r = WINKELMESSER_RADIUS * CM
  return `M${-r} 0A${r} ${r} 0 0 1 ${r} 0Z`
}

const rad = (g: number) => (g * Math.PI) / 180

/** Lokaler Punkt → Tafel */
export function zuTafelPunkt(i: Instrument, lx: number, ly: number): P {
  const c = Math.cos(rad(i.winkel))
  const s = Math.sin(rad(i.winkel))
  const m = massstab(i)
  return [i.x + m * (lx * c - ly * s), i.y + m * (lx * s + ly * c)]
}

/** Tafel → lokaler Punkt */
export function zuLokal(i: Instrument, tx: number, ty: number): P {
  const c = Math.cos(rad(i.winkel))
  const s = Math.sin(rad(i.winkel))
  const dx = tx - i.x
  const dy = ty - i.y
  const m = massstab(i)
  return [(dx * c + dy * s) / m, (-dx * s + dy * c) / m]
}

/** Nächster Punkt auf der Kante (lokal) */
function aufKanteLokal(k: Kante, lx: number, ly: number): P {
  if (k.art === 'strecke') {
    const [ax, ay] = k.a
    const vx = k.b[0] - ax
    const vy = k.b[1] - ay
    const t = Math.min(1, Math.max(0, ((lx - ax) * vx + (ly - ay) * vy) / (vx * vx + vy * vy)))
    return [ax + t * vx, ay + t * vy]
  }
  if (k.art === 'kreis') {
    const phi = lx === 0 && ly === 0 ? 0 : Math.atan2(ly, lx)
    return [k.r * Math.cos(phi), k.r * Math.sin(phi)]
  }
  // obere Hälfte: Winkel −π … 0 (y nach unten)
  let phi = Math.atan2(ly, lx)
  if (phi > 0) phi = lx < 0 ? -Math.PI : 0
  return [k.r * Math.cos(phi), k.r * Math.sin(phi)]
}

/** Richtung von der Kante nach außen an der Stelle p (lokal) */
function aussen(k: Kante, p: P): P {
  if (k.art === 'strecke') return k.n
  const l = Math.hypot(p[0], p[1]) || 1
  return [p[0] / l, p[1] / l]
}

/** Die Kante, an der ein Strich anliegt, der bei (tx, ty) beginnt – höchstens `fang` (Tafel-Einheiten) entfernt, sonst null */
export function fangeKante(i: Instrument, tx: number, ty: number, fang: number): Kante | null {
  const [lx, ly] = zuLokal(i, tx, ty)
  let beste: Kante | null = null
  let besterAbstand = fang / massstab(i) // gerechnet wird lokal, `fang` gilt in Tafel-Einheiten
  for (const k of kantenVon(i)) {
    const p = aufKanteLokal(k, lx, ly)
    const d = Math.hypot(lx - p[0], ly - p[1])
    if (d <= besterAbstand) {
      beste = k
      besterAbstand = d
    }
  }
  return beste
}

/**
 * Legt einen Punkt des Strichs an die Kante: nächster Punkt auf der Kante, um `abstand` nach außen versetzt
 * (die halbe Strichstärke – so liegt der Strich an der Kante an, nicht darunter). Ergebnis in Tafel-Koordinaten.
 */
export function anKante(i: Instrument, k: Kante, tx: number, ty: number, abstand: number): P {
  const [lx, ly] = zuLokal(i, tx, ty)
  const p = aufKanteLokal(k, lx, ly)
  const n = aussen(k, p)
  // Zirkel: die Mine zeichnet genau auf dem Kreis, nicht daneben
  const a = k.art === 'kreis' ? 0 : abstand / massstab(i) // der Abstand gilt in Tafel-Einheiten, gerechnet wird lokal
  return zuTafelPunkt(i, p[0] + n[0] * a, p[1] + n[1] * a)
}

/** Winkel auf (−180, 180] */
export function normiere(w: number): number {
  const x = ((w % 360) + 360) % 360
  return x > 180 ? x - 360 : x
}

/** Rastet auf volle 15° ein, wenn der Winkel höchstens 2° daneben liegt */
export function rasteWinkel(w: number): number {
  const n = normiere(w)
  const r = Math.round(n / 15) * 15
  return normiere(Math.abs(n - r) <= 2 ? r : Math.round(n * 10) / 10)
}

/** Anzeige des Winkels gegen die Waagerechte, gegen den Uhrzeigersinn positiv wie in der Mathematik: −179° … 180° */
export function winkelText(w: number): string {
  const g = Math.round(normiere(-w))
  return g < 0 ? `−${-g}°` : `${g}°`
}

/** Verschiebt um (dx, dy) Tafel-Einheiten */
export const verschiebeInstrument = (i: Instrument, dx: number, dy: number): Instrument => ({ ...i, x: i.x + dx, y: i.y + dy })

/**
 * Drehen am Griff: um den Nullpunkt, von der Richtung beim Greifen (start) zur jetzigen Richtung des Zeigers (jetzt).
 * startWinkel: Winkel des Werkzeugs beim Greifen.
 */
export function dreheAmGriff(i: Instrument, startWinkel: number, start: P, jetzt: P): Instrument {
  const a0 = Math.atan2(start[1] - i.y, start[0] - i.x)
  const a1 = Math.atan2(jetzt[1] - i.y, jetzt[0] - i.x)
  return { ...i, winkel: rasteWinkel(startWinkel + ((a1 - a0) * 180) / Math.PI) }
}

/** Größe ändern am Griff: im Verhältnis der Abstände von Nullpunkt zum Zeiger (start = beim Greifen, jetzt = jetzt) */
export function skaliereAmGriff(i: Instrument, startSkala: number, start: P, jetzt: P): Instrument {
  const d0 = Math.hypot(start[0] - i.x, start[1] - i.y)
  if (d0 < 1) return i
  const d1 = Math.hypot(jetzt[0] - i.x, jetzt[1] - i.y)
  return { ...i, skala: klemmeSkala(startSkala * (d1 / d0)) }
}

/** Zirkel: Der Griff an der Mine folgt dem Zeiger – Radius = Abstand zur Nadel, die Schenkel drehen mit */
export function radiusAmGriff(i: Instrument, jetzt: P): Instrument {
  const dx = jetzt[0] - i.x
  const dy = jetzt[1] - i.y
  const d = Math.hypot(dx, dy)
  if (d < 1) return i
  return { ...i, radius: klemmeRadius(d / CM), winkel: rasteWinkel((Math.atan2(dy, dx) * 180) / Math.PI) }
}

/**
 * Zwei Finger: Das Werkzeug folgt beiden Fingern (Drehen, Verschieben und Größe – Spreizen vergrößert).
 * start: Werkzeug beim Aufsetzen; a0, b0: Finger beim Aufsetzen; a1, b1: Finger jetzt (alles Tafel-Koordinaten).
 */
export function folgeZweiFingern(start: Instrument, a0: P, b0: P, a1: P, b1: P): Instrument {
  const d = Math.atan2(b1[1] - a1[1], b1[0] - a1[0]) - Math.atan2(b0[1] - a0[1], b0[0] - a0[0])
  const m0: P = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2]
  const m1: P = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2]
  const c = Math.cos(d)
  const s = Math.sin(d)
  const abstand0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1])
  const abstand1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1])
  const alt = massstab(start)
  const neu = abstand0 > 1 && start.art !== 'zirkel' ? klemmeSkala(alt * (abstand1 / abstand0)) : alt
  const f = neu / alt
  const vx = (start.x - m0[0]) * f
  const vy = (start.y - m0[1]) * f
  const ergebnis = { ...start, x: m1[0] + vx * c - vy * s, y: m1[1] + vx * s + vy * c, winkel: normiere(start.winkel + (d * 180) / Math.PI) }
  return neu === alt ? ergebnis : { ...ergebnis, skala: neu }
}

/** Neues Werkzeug mitten in der sichtbaren Fläche (mx, my: Mitte in Tafel-Koordinaten), waagerecht */
export function neuesInstrument(art: InstrumentArt, mx: number, my: number): Instrument {
  if (art === 'zirkel') return { art, x: mx - (ZIRKEL_RADIUS / 2) * CM, y: my + 2 * CM, winkel: 0, radius: ZIRKEL_RADIUS }
  if (art === 'lineal') return { art, x: mx - (LINEAL_LAENGE / 2) * CM, y: my + (LINEAL_BREITE / 2) * CM, winkel: 0 }
  const h = (art === 'geodreieck' ? GEO_HALB : WINKELMESSER_RADIUS) * CM
  return { art, x: mx, y: my + h / 2, winkel: 0 }
}

/** Teilstriche und Beschriftung (lokal, Tafel-Einheiten): l = Länge, text = Beschriftung oder leer */
export type Teilstrich = { a: P; b: P; text?: string; t?: P }

/** Teilstriche eines Werkzeugs: Zentimeter/Millimeter an der Messkante, Grad am Bogen */
export function teilstriche(art: InstrumentArt): Teilstrich[] {
  const liste: Teilstrich[] = []
  if (art === 'zirkel') return liste
  const mm = CM / 10
  if (art === 'lineal') {
    for (let i = 0; i <= LINEAL_LAENGE * 10; i++) {
      const lang = i % 10 === 0 ? 0.6 * CM : i % 5 === 0 ? 0.42 * CM : 0.25 * CM
      liste.push({ a: [i * mm, 0], b: [i * mm, -lang], ...(i % 10 === 0 ? { text: String(i / 10), t: [i * mm, -0.95 * CM] as P } : {}) })
    }
    return liste
  }
  if (art === 'geodreieck') {
    const h = GEO_HALB * CM
    for (let i = -(GEO_HALB - 1) * 10; i <= (GEO_HALB - 1) * 10; i++) {
      const lang = i % 10 === 0 ? 0.6 * CM : i % 5 === 0 ? 0.42 * CM : 0.25 * CM
      liste.push({ a: [i * mm, 0], b: [i * mm, -lang], ...(i % 10 === 0 && i !== 0 ? { text: String(Math.abs(i / 10)), t: [i * mm, -0.95 * CM] as P } : {}) })
    }
    // Gradbogen um den Nullpunkt
    const r = 4.9 * CM
    for (let g = 0; g <= 180; g++) {
      const lang = g % 10 === 0 ? 0.7 * CM : g % 5 === 0 ? 0.45 * CM : 0.25 * CM
      const c = Math.cos(rad(g))
      const s = -Math.sin(rad(g))
      const punkt = (rr: number): P => [rr * c, rr * s]
      if (Math.abs(r * c) + Math.abs(r * s) > h - 0.2 * CM) continue
      liste.push({ a: punkt(r), b: punkt(r - lang), ...(g % 10 === 0 ? { text: String(g), t: punkt(r - 1.15 * CM) } : {}) })
    }
    return liste
  }
  const r = WINKELMESSER_RADIUS * CM
  for (let g = 0; g <= 180; g++) {
    const lang = g % 10 === 0 ? 0.8 * CM : g % 5 === 0 ? 0.5 * CM : 0.28 * CM
    const c = Math.cos(rad(g))
    const s = -Math.sin(rad(g))
    const punkt = (rr: number): P => [rr * c, rr * s]
    liste.push({ a: punkt(r), b: punkt(r - lang), ...(g % 10 === 0 ? { text: String(g), t: punkt(r - 1.3 * CM) } : {}) })
  }
  return liste
}

/** Wo die Griffe liegen (lokal): drehen, schließen, Winkelanzeige, Größe (Zirkel: Radius an der Mine) */
export function griffe(art: InstrumentArt, radius = ZIRKEL_RADIUS): { drehen: P; schliessen: P; winkel: P; groesse: P } {
  if (art === 'zirkel') {
    const { mine, gelenk } = zirkelLage(radius)
    return { drehen: [gelenk[0], gelenk[1] - 2.9 * CM], schliessen: [-1.4 * CM, -1.4 * CM], winkel: [mine[0] / 2, 1 * CM], groesse: mine }
  }
  if (art === 'lineal') return { drehen: [(LINEAL_LAENGE - 1.2) * CM, -2.75 * CM], schliessen: [1.2 * CM, -2.75 * CM], winkel: [(LINEAL_LAENGE / 2) * CM, -2.75 * CM], groesse: [(LINEAL_LAENGE + LINEAL_UEBERSTAND) * CM, -LINEAL_BREITE * CM] }
  if (art === 'geodreieck') return { drehen: [0, -6.4 * CM], schliessen: [-1.7 * CM, -2.3 * CM], winkel: [1.7 * CM, -2.3 * CM], groesse: [GEO_HALB * CM, 0] }
  return { drehen: [0, -4.6 * CM], schliessen: [-2.2 * CM, -2 * CM], winkel: [2.2 * CM, -2 * CM], groesse: [WINKELMESSER_RADIUS * CM, 0] }
}
