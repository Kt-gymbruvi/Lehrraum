// Radieren: Art und Größe des Radierers und der Schwamm, der nur die überwischten Teile von Strichen wegnimmt.
// Ein Wischzug (Aufsetzen bis Abheben) wird zu einem einzigen Befehl „zerlegen“ (ein Schritt im Verlauf).
import type { Befehl } from './befehle.ts'
import { abstandZurStrecke, breite } from './geometrie.ts'
import { neueId, type Element, type Punkt, type Strich } from './modell.ts'

/** Schwamm: wischt Teile von Strichen weg · Element: entfernt alles Berührte als Ganzes */
export type RadiererArt = 'schwamm' | 'element'
export type RadiererGroesse = 'klein' | 'mittel' | 'gross'
export type Radierer = { art: RadiererArt; groesse: RadiererGroesse }

export const RADIERER_STANDARD: Radierer = { art: 'schwamm', groesse: 'mittel' }

/** Radius in Bildschirm-Pixeln – ändert sich beim Zoomen nicht */
export const RADIERER_RADIUS: Record<RadiererGroesse, number> = { klein: 8, mittel: 18, gross: 40 }

export const RADIERER_ARTEN: { wert: RadiererArt; name: string; titel: string }[] = [
  { wert: 'schwamm', name: 'Schwamm', titel: 'Schwamm – wischt nur die überfahrenen Teile von Strichen weg; Text, Formen und Bilder bleiben' },
  { wert: 'element', name: 'Element', titel: 'Element-Radierer – entfernt alles Berührte als Ganzes' },
]
export const RADIERER_GROESSEN: { wert: RadiererGroesse; name: string }[] = [
  { wert: 'klein', name: 'Klein' },
  { wert: 'mittel', name: 'Mittel' },
  { wert: 'gross', name: 'Groß' },
]

type Rechteck = [number, number, number, number]

/** Umgebendes Rechteck der Mittellinie eines Strichs (gemerkt – Striche werden nie verändert, nur ersetzt) */
const umgebung = new WeakMap<Strich, Rechteck>()
function mittelRahmen(s: Strich): Rechteck {
  let r = umgebung.get(s)
  if (!r) {
    r = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, y] of s.punkte) {
      if (x < r[0]) r[0] = x
      if (y < r[1]) r[1] = y
      if (x > r[2]) r[2] = x
      if (y > r[3]) r[3] = y
    }
    umgebung.set(s, r)
  }
  return r
}

const zwischen = (p: Punkt, q: Punkt, t: number): Punkt => (t <= 0 ? p : t >= 1 ? q : [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t])

/**
 * Welcher Teil der Strecke p–q liegt näher als `grenze` an der Strecke a–b (der Bahn des Schwamms)?
 * Liefert [t0, t1] (Anteile der Strecke p–q) oder null. Der Abstand ändert sich entlang p–q konvex,
 * darum ist der Teil immer ein einziges Stück: erst den nächsten Punkt suchen, dann beide Ränder eingrenzen.
 */
function innenAnteil(p: Punkt, q: Punkt, a: [number, number], b: [number, number], grenze: number): [number, number] | null {
  // Schnell aussortieren, was weit weg liegt
  if (Math.min(p[0], q[0]) > Math.max(a[0], b[0]) + grenze || Math.max(p[0], q[0]) < Math.min(a[0], b[0]) - grenze) return null
  if (Math.min(p[1], q[1]) > Math.max(a[1], b[1]) + grenze || Math.max(p[1], q[1]) < Math.min(a[1], b[1]) - grenze) return null
  const f = (t: number) => {
    const [x, y] = zwischen(p, q, t)
    return abstandZurStrecke(x, y, a[0], a[1], b[0], b[1])
  }
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    if (f(m1) <= f(m2)) hi = m2
    else lo = m1
  }
  const tm = (lo + hi) / 2
  const nah = Math.min(f(0), f(1), f(tm))
  if (nah >= grenze) return null // nur gestreift oder gar nicht berührt
  const mitte = f(0) < grenze ? 0 : f(1) < grenze ? 1 : tm
  const rand = (aussen: number, innen: number) => {
    for (let i = 0; i < 40; i++) {
      const m = (aussen + innen) / 2
      if (f(m) < grenze) innen = m
      else aussen = m
    }
    return (aussen + innen) / 2
  }
  const t0 = f(0) < grenze ? 0 : rand(0, mitte)
  const t1 = f(1) < grenze ? 1 : rand(1, mitte)
  return [t0, t1]
}

/** Länge der Mittellinie */
const laenge = (punkte: Punkt[]) => punkte.reduce((summe, p, i) => (i ? summe + Math.hypot(p[0] - punkte[i - 1][0], p[1] - punkte[i - 1][1]) : 0), 0)

/**
 * Wischt mit dem Schwamm (Kreis mit Radius r, gezogen von a nach b – alles in Tafel-Koordinaten) über einen Strich.
 * Liefert null, wenn der Strich nicht berührt wird; sonst die stehen gebliebenen Teile (vielleicht keine).
 * Die Teile behalten Farbe, Stärke, Werkzeug und Gruppe und bekommen neue Kennungen. Reste, die kürzer als die
 * Strichbreite sind, verschwinden.
 */
export function wische(s: Strich, ax: number, ay: number, bx: number, by: number, r: number): Strich[] | null {
  const grenze = r + breite(s) / 2
  const [l, o, re, u] = mittelRahmen(s)
  if (l > Math.max(ax, bx) + grenze || re < Math.min(ax, bx) - grenze || o > Math.max(ay, by) + grenze || u < Math.min(ay, by) - grenze) return null
  const a: [number, number] = [ax, ay]
  const b: [number, number] = [bx, by]
  const p = s.punkte
  if (p.length === 1) return abstandZurStrecke(p[0][0], p[0][1], ax, ay, bx, by) < grenze ? [] : null

  const teile: Punkt[][] = []
  let beruehrt = false
  let jetzt: Punkt[] | null = abstandZurStrecke(p[0][0], p[0][1], ax, ay, bx, by) < grenze ? null : [p[0]]
  if (!jetzt) beruehrt = true
  for (let i = 1; i < p.length; i++) {
    const anteil = innenAnteil(p[i - 1], p[i], a, b, grenze)
    if (!anteil) {
      ;(jetzt ??= [p[i - 1]]).push(p[i])
      continue
    }
    beruehrt = true
    const [t0, t1] = anteil
    if (jetzt) {
      if (t0 > 0) jetzt.push(zwischen(p[i - 1], p[i], t0))
      teile.push(jetzt)
    }
    jetzt = t1 < 1 ? [zwischen(p[i - 1], p[i], t1), p[i]] : null
  }
  if (!beruehrt) return null
  if (jetzt) teile.push(jetzt)
  const mindestens = breite(s)
  return teile.filter((t) => t.length > 1 && laenge(t) >= mindestens).map((punkte) => ({ ...s, id: neueId(), punkte }))
}

/** Ein laufender Wischzug: die Elemente, wie sie gerade aussehen, und woher die neuen Teile stammen */
export type Wischzug = {
  elemente: Element[]
  /** Kennung eines Teils → Kennung des ursprünglichen Strichs */
  herkunft: Map<string, string>
  /** Kennungen der ursprünglichen Striche, die schon berührt wurden */
  beruehrt: Set<string>
}

export const beginneWischzug = (elemente: Element[]): Wischzug => ({ elemente, herkunft: new Map(), beruehrt: new Set() })

/** Führt den Schwamm von a nach b weiter. Liefert true, wenn sich etwas geändert hat. Text, Formen und Bilder bleiben. */
export function wischeWeiter(z: Wischzug, ax: number, ay: number, bx: number, by: number, r: number): boolean {
  let geaendert = false
  const neu = z.elemente.flatMap((e): Element[] => {
    if (e.art !== 'strich') return [e]
    const teile = wische(e, ax, ay, bx, by, r)
    if (!teile) return [e]
    geaendert = true
    const ursprung = z.herkunft.get(e.id) ?? e.id
    z.herkunft.delete(e.id)
    z.beruehrt.add(ursprung)
    for (const t of teile) z.herkunft.set(t.id, ursprung)
    return teile
  })
  if (geaendert) z.elemente = neu
  return geaendert
}

/** Die Teile, die aus berührten Strichen entstanden sind (zum Zeichnen während des Wischens) */
export const neueTeile = (z: Wischzug): Element[] => z.elemente.filter((e) => z.herkunft.has(e.id))

/** Der Befehl zum fertigen Wischzug (bezogen auf die Elemente vor dem Wischen) oder null, wenn nichts berührt wurde */
export function wischBefehl(vorher: Element[], z: Wischzug): Befehl | null {
  if (!z.beruehrt.size) return null
  const teile = new Map<string, Element[]>()
  for (const e of z.elemente) {
    const u = z.herkunft.get(e.id)
    if (u) teile.set(u, [...(teile.get(u) ?? []), e])
  }
  const eintraege = vorher.flatMap((element, stelle) => (z.beruehrt.has(element.id) ? [{ stelle, vorher: element, nachher: teile.get(element.id) ?? [] }] : []))
  return eintraege.length ? { art: 'zerlegen', eintraege } : null
}
