// Tabelle auf der Tafel: Maße, Zellen, Zeilen und Spalten ändern. Reine Logik, kein React.
// Die Breite jeder Spalte ist gespeichert, die Höhe einer Zeile ergibt sich aus dem Text (eine Zeile mehr je
// Zeilenumbruch). Gedreht wird – wie Text und Bild – um die linke obere Ecke.
import { drehePunkt, drehungVon, ZEILENHOEHE } from './geometrie.ts'
import { MAX_ZELLTEXT, neueId, TABELLE_MAX_SPALTEN, TABELLE_MAX_ZEILEN, type Tabelle, type Text } from './modell.ts'

/** Innenabstand einer Zelle (Anteil der Schriftgröße) */
const RAND = 0.35
/** Vorgabe beim Anlegen */
export const TABELLE_VORGABE = { zeilen: 3, spalten: 3 }

/** Breite einer neuen Spalte bei dieser Schriftgröße */
export const spaltenBreite = (groesse: number) => Math.round(groesse * 6)
/** Kleinste Spaltenbreite (beim Ziehen) */
export const minSpalte = (groesse: number) => Math.max(8, groesse * 1.5)

export const zellRand = (t: Tabelle) => t.groesse * RAND

/** Eine neue Tabelle mit der linken oberen Ecke bei (x, y) */
export function neueTabelle(x: number, y: number, zeilen: number, spalten: number, groesse: number, farbe: string): Tabelle {
  const z = Math.min(TABELLE_MAX_ZEILEN, Math.max(1, Math.round(zeilen)))
  const s = Math.min(TABELLE_MAX_SPALTEN, Math.max(1, Math.round(spalten)))
  return {
    art: 'tabelle',
    id: neueId(),
    x,
    y,
    spalten: Array.from({ length: s }, () => spaltenBreite(groesse)),
    zellen: Array.from({ length: z }, () => Array.from({ length: s }, () => '')),
    groesse,
    farbe,
    kopf: true,
  }
}

/** Höhe jeder Zeile: so viele Textzeilen, wie die längste Zelle der Zeile hat (mindestens eine) */
export function zeilenHoehen(t: Tabelle): number[] {
  return t.zellen.map((z) => Math.max(1, ...z.map((text) => text.split('\n').length)) * t.groesse * ZEILENHOEHE + 2 * zellRand(t))
}

/** Breite und Höhe der ungedrehten Tabelle */
export function tabellenMass(t: Tabelle): [number, number] {
  return [t.spalten.reduce((a, b) => a + b, 0), zeilenHoehen(t).reduce((a, b) => a + b, 0)]
}

/** Lage der Zellgrenzen (ungedreht, ab der linken oberen Ecke): xs hat spalten+1, ys zeilen+1 Einträge */
export function gitter(t: Tabelle): { xs: number[]; ys: number[] } {
  const xs = [0]
  for (const b of t.spalten) xs.push(xs[xs.length - 1] + b)
  const ys = [0]
  for (const h of zeilenHoehen(t)) ys.push(ys[ys.length - 1] + h)
  return { xs, ys }
}

/** Ein Tafelpunkt in den ungedrehten Koordinaten der Tabelle (0, 0 = linke obere Ecke) */
export function innen(t: Tabelle, x: number, y: number): [number, number] {
  const [px, py] = drehePunkt(x, y, t.x, t.y, -drehungVon(t))
  return [px - t.x, py - t.y]
}

/** Die Zelle an einem Tafelpunkt oder null */
export function zelleBei(t: Tabelle, x: number, y: number): [number, number] | null {
  const [ix, iy] = innen(t, x, y)
  const { xs, ys } = gitter(t)
  if (ix < 0 || iy < 0 || ix > xs[xs.length - 1] || iy > ys[ys.length - 1]) return null
  const s = Math.max(0, xs.findIndex((v) => v > ix) - 1)
  const z = Math.max(0, ys.findIndex((v) => v > iy) - 1)
  return [Math.min(z, t.zellen.length - 1), Math.min(s, t.spalten.length - 1)]
}

/** Linke obere Ecke (ungedreht, relativ zur Tabelle), Breite und Höhe einer Zelle */
export function zellLage(t: Tabelle, zeile: number, spalte: number): { x: number; y: number; b: number; h: number } {
  const { xs, ys } = gitter(t)
  return { x: xs[spalte], y: ys[zeile], b: t.spalten[spalte], h: ys[zeile + 1] - ys[zeile] }
}

/** Die Trennlinie zwischen zwei Spalten nahe einem Tafelpunkt (Index der Spalte links davon) oder null */
export function trennerBei(t: Tabelle, x: number, y: number, fang: number): number | null {
  const [ix, iy] = innen(t, x, y)
  const { xs, ys } = gitter(t)
  if (iy < -fang || iy > ys[ys.length - 1] + fang) return null
  let beste: number | null = null
  let abstand = fang
  // auch die rechte Außenkante: so wird die letzte Spalte breiter
  for (let i = 1; i < xs.length; i++) {
    const d = Math.abs(xs[i] - ix)
    if (d <= abstand) {
      abstand = d
      beste = i - 1
    }
  }
  return beste
}

/** Neue Breite einer Spalte (nicht schmaler als minSpalte) */
export function mitSpaltenbreite(t: Tabelle, spalte: number, breite: number): Tabelle {
  const spalten = t.spalten.map((b, i) => (i === spalte ? Math.max(minSpalte(t.groesse), Math.round(breite)) : b))
  return { ...t, spalten }
}

export function mitZelle(t: Tabelle, zeile: number, spalte: number, text: string): Tabelle {
  return { ...t, zellen: t.zellen.map((z, r) => (r === zeile ? z.map((c, s) => (s === spalte ? text.slice(0, MAX_ZELLTEXT) : c)) : z)) }
}

/** Eine leere Zeile nach der Zeile `nach` (−1: ganz oben); null, wenn die Tabelle schon voll ist */
export function zeileDazu(t: Tabelle, nach: number): Tabelle | null {
  if (t.zellen.length >= TABELLE_MAX_ZEILEN) return null
  const zellen = [...t.zellen]
  zellen.splice(nach + 1, 0, t.spalten.map(() => ''))
  return { ...t, zellen }
}

export function zeileWeg(t: Tabelle, zeile: number): Tabelle | null {
  if (t.zellen.length <= 1) return null
  return { ...t, zellen: t.zellen.filter((_, i) => i !== zeile) }
}

/** Eine leere Spalte nach der Spalte `nach`, so breit wie diese */
export function spalteDazu(t: Tabelle, nach: number): Tabelle | null {
  if (t.spalten.length >= TABELLE_MAX_SPALTEN) return null
  const i = Math.min(Math.max(-1, nach), t.spalten.length - 1)
  const spalten = [...t.spalten]
  spalten.splice(i + 1, 0, t.spalten[Math.max(0, i)] ?? spaltenBreite(t.groesse))
  return { ...t, spalten, zellen: t.zellen.map((z) => [...z.slice(0, i + 1), '', ...z.slice(i + 1)]) }
}

export function spalteWeg(t: Tabelle, spalte: number): Tabelle | null {
  if (t.spalten.length <= 1) return null
  return { ...t, spalten: t.spalten.filter((_, i) => i !== spalte), zellen: t.zellen.map((z) => z.filter((_, i) => i !== spalte)) }
}

/** Nächste (richtung 1) oder vorige (−1) Zelle in Lesereihenfolge; null am Anfang bzw. Ende */
export function naechsteZelle(t: Tabelle, zeile: number, spalte: number, richtung: 1 | -1): [number, number] | null {
  const n = t.spalten.length
  const i = zeile * n + spalte + richtung
  if (i < 0 || i >= t.zellen.length * n) return null
  return [Math.floor(i / n), i % n]
}

/** Andere Schriftgröße für Text oder Tabelle (bei der Tabelle wachsen die Spalten mit) */
export function mitSchrift<T extends Text | Tabelle>(e: T, groesse: number): T {
  if (e.art === 'text') return { ...e, groesse }
  const f = groesse / e.groesse
  return { ...e, groesse, spalten: (e as Tabelle).spalten.map((b) => Math.round(b * f)) }
}
