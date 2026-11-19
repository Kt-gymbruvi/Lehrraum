// Gefüllte Flächen: aus einem Raster der Linien (1 = Linie, 0 = frei) wird die geschlossene Fläche um einen Punkt
// herausgesucht und als Vieleck mit Löchern umrissen. Reine Funktionen auf Zahlenfeldern – das Raster selbst
// zeichnet die Zeichenfläche (tafel/fuellraster.ts). Reicht die Fläche bis an den Rand des Rasters, ist sie nicht
// geschlossen und es wird nichts gefüllt.
import { neueId, type Punkt, type Strich } from './modell.ts'

export type Ring = [number, number][]

/** Linien um einen Pixel verbreitern: so schließen sich kleine Lücken von Hand gezeichneter Linien */
export function verbreitere(sperre: Uint8Array, b: number, h: number): Uint8Array {
  const aus = new Uint8Array(sperre)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < b; x++) {
      const i = y * b + x
      if (sperre[i]) {
        if (x > 0) aus[i - 1] = 1
        if (x < b - 1) aus[i + 1] = 1
        if (y > 0) aus[i - b] = 1
        if (y < h - 1) aus[i + b] = 1
      }
    }
  }
  return aus
}

/**
 * Die freie Fläche um (sx, sy): Maske (1 = gehört dazu) oder null, wenn der Punkt auf einer Linie liegt, nichts frei
 * ist oder die Fläche den Rand erreicht (nicht geschlossen). Liegt der Punkt knapp neben einer Linie, wird der
 * nächste freie Punkt genommen (Fingerbreite).
 */
export function freieFlaeche(sperre: Uint8Array, b: number, h: number, sx: number, sy: number): Uint8Array | null {
  const x0 = Math.round(sx)
  const y0 = Math.round(sy)
  if (x0 < 0 || y0 < 0 || x0 >= b || y0 >= h) return null
  const fest = verbreitere(sperre, b, h)
  let start = -1
  for (let r = 0; r <= 4 && start < 0; r++) {
    for (let dy = -r; dy <= r && start < 0; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = x0 + dx
        const y = y0 + dy
        if (x >= 0 && y >= 0 && x < b && y < h && !fest[y * b + x]) {
          start = y * b + x
          break
        }
      }
    }
  }
  if (start < 0) return null
  const maske = new Uint8Array(b * h)
  const stapel = [start]
  maske[start] = 1
  while (stapel.length) {
    const i = stapel.pop()!
    const x = i % b
    const y = (i - x) / b
    if (x === 0 || y === 0 || x === b - 1 || y === h - 1) return null // bis an den Rand: nicht geschlossen
    for (const n of [i - 1, i + 1, i - b, i + b]) {
      if (!maske[n] && !fest[n]) {
        maske[n] = 1
        stapel.push(n)
      }
    }
  }
  return maske
}

/** Die Ränder einer Maske als geschlossene Ringe (Ecken der Pixel) – außen und die Löcher */
export function umrisse(maske: Uint8Array, b: number, h: number): Ring[] {
  const breiteEcken = b + 1
  const ausgang = new Map<number, number[]>() // Ecke → Ecken, zu denen eine Randkante von dort führt
  const kante = (x0: number, y0: number, x1: number, y1: number) => {
    const von = y0 * breiteEcken + x0
    const liste = ausgang.get(von)
    const nach = y1 * breiteEcken + x1
    if (liste) liste.push(nach)
    else ausgang.set(von, [nach])
  }
  const drin = (x: number, y: number) => x >= 0 && y >= 0 && x < b && y < h && maske[y * b + x] === 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < b; x++) {
      if (!maske[y * b + x]) continue
      if (!drin(x, y - 1)) kante(x, y, x + 1, y) // oben
      if (!drin(x + 1, y)) kante(x + 1, y, x + 1, y + 1) // rechts
      if (!drin(x, y + 1)) kante(x + 1, y + 1, x, y + 1) // unten
      if (!drin(x - 1, y)) kante(x, y + 1, x, y) // links
    }
  }
  const ringe: Ring[] = []
  for (const [anfang] of ausgang) {
    let liste = ausgang.get(anfang)
    while (liste && liste.length) {
      const ring: Ring = []
      let jetzt = anfang
      for (;;) {
        ring.push([jetzt % breiteEcken, Math.floor(jetzt / breiteEcken)])
        const l = ausgang.get(jetzt)
        const naechste = l?.pop()
        if (naechste === undefined) break
        jetzt = naechste
        if (jetzt === anfang) break
      }
      if (ring.length >= 4) ringe.push(ring)
      liste = ausgang.get(anfang)
    }
  }
  return ringe
}

const abstandZurGeraden = (p: [number, number], a: [number, number], b: [number, number]): number => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy)
  return l === 0 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / l
}

function dp(p: Ring, von: number, bis: number, eps: number, behalten: boolean[]) {
  let weit = 0
  let index = -1
  for (let i = von + 1; i < bis; i++) {
    const d = abstandZurGeraden(p[i], p[von], p[bis])
    if (d > weit) {
      weit = d
      index = i
    }
  }
  if (index >= 0 && weit > eps) {
    behalten[index] = true
    dp(p, von, index, eps, behalten)
    dp(p, index, bis, eps, behalten)
  }
}

/** Vereinfacht einen geschlossenen Ring (Douglas und Peucker); eps in Pixeln */
export function vereinfache(ring: Ring, eps: number): Ring {
  if (ring.length < 4) return ring
  // Zwei weit auseinander liegende Punkte teilen den Ring in zwei Hälften
  let fern = 0
  for (let i = 1; i < ring.length; i++) if (Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]) > Math.hypot(ring[fern][0] - ring[0][0], ring[fern][1] - ring[0][1])) fern = i
  if (!fern) return ring
  const behalten = new Array<boolean>(ring.length).fill(false)
  behalten[0] = true
  behalten[fern] = true
  dp(ring, 0, fern, eps, behalten)
  const zurueck = [...ring.slice(fern), ring[0]]
  const b2 = new Array<boolean>(zurueck.length).fill(false)
  b2[0] = true
  b2[zurueck.length - 1] = true
  dp(zurueck, 0, zurueck.length - 1, eps, b2)
  const erste = ring.filter((_, i) => behalten[i])
  const zweite = zurueck.filter((_, i) => b2[i]).slice(1, -1)
  return [...erste, ...zweite]
}

/** Flächeninhalt eines Rings (immer positiv) */
export function ringFlaeche(ring: readonly (readonly number[])[]): number {
  let s = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  return Math.abs(s) / 2
}

/** Flächeninhalt einer gefüllten Fläche (ohne Löcher) */
export const flaecheInhalt = (s: Strich): number => ringFlaeche(s.punkte) - (s.loecher ?? []).reduce((summe, l) => summe + ringFlaeche(l), 0)

/**
 * Aus der Maske den äußeren Umriss und die Löcher bilden (Pixel-Koordinaten, vereinfacht). Kleine Löcher
 * (unter 6 Pixel) fallen weg. null, wenn nichts Brauchbares übrig bleibt.
 */
export function umrissAusMaske(maske: Uint8Array, b: number, h: number, eps = 0.8): { aussen: Ring; loecher: Ring[] } | null {
  const ringe = umrisse(maske, b, h)
    .map((r) => vereinfache(r, eps))
    .filter((r) => r.length >= 3)
    .sort((a, c) => ringFlaeche(c) - ringFlaeche(a))
  if (!ringe.length || ringFlaeche(ringe[0]) < 4) return null
  return { aussen: ringe[0], loecher: ringe.slice(1).filter((r) => ringFlaeche(r) >= 6).slice(0, 40) }
}

const alsPunkte = (r: Ring): Punkt[] => r.map(([x, y]): Punkt => [x, y, 0.5])

/** Eine gefüllte Fläche (Strich mit `flaeche`) aus Ringen in Tafel-Koordinaten; rand: schmaler Rand, der unter die Linien reicht */
export function neueFlaeche(aussen: Ring, loecher: Ring[], farbe: string, rand: number): Strich {
  return {
    art: 'strich',
    id: neueId(),
    werkzeug: 'stift',
    farbe,
    staerke: rand,
    druckEcht: false,
    punkte: alsPunkte(aussen),
    flaeche: true,
    ...(loecher.length ? { loecher: loecher.map(alsPunkte) } : {}),
  }
}
