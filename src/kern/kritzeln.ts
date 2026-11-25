// Kritzeln zum Löschen: Streicht die Lehrkraft mit Stift (oder Textmarker) etwas mehrmals hin und her durch,
// verschwindet das Durchgestrichene – und der Kritzel-Strich selbst. Reine Logik ohne React und ohne Browser;
// die Zeichenfläche fragt beim Abheben, ob der Strich ein Kritzeln war und was er löscht.
//
// Ein Strich gilt als Kritzeln, wenn er oft die Richtung umkehrt (mindestens KEHREN_MIN mal, Zickzack in jede
// Richtung), sein Weg ein Vielfaches seiner Ausdehnung ist und er nicht winzig ist. Gelöscht wird, was der
// Kritzel-Strich berührt und was zu einem guten Teil unter dem Gekritzel liegt – eine lange Linie, die nur
// durchkreuzt wird, oder eine große gefüllte Fläche bleiben. Bilder, PDF-Seiten und Tabellen werden nie
// weggekritzelt. Trifft das Gekritzel nichts, bleibt es ein ganz normaler Strich.
import { rahmen, trifft } from './geometrie.ts'
import type { Element, Strich } from './modell.ts'

/** So oft muss der Strich mindestens umkehren (5 Teilstücke: hin, her, hin, her, hin) */
export const KEHREN_MIN = 4
/** Weg des Strichs im Verhältnis zur Diagonale seines Rahmens */
const WEG_FAKTOR = 3.5
/** Kleinere Kritzel (Bildschirm-Pixel, Diagonale) zählen nicht: kleine Zeichen wie „w“ oder „m“ */
const MIN_GROESSE = 30
/** Abstand der Stützpunkte (Bildschirm-Pixel), damit Zittern keine Umkehr vortäuscht */
const SCHRITT = 6
/** Eine Umkehr: Richtungswechsel um mehr als 120° gegenüber dem laufenden Teilstück */
const UMKEHR_COS = -0.5
/** Dieser Anteil des Rahmens eines Elements muss im Rahmen des Gekritzels liegen */
const ANTEIL_DARUNTER = 0.4

type P = [number, number]

/** Stützpunkte im Abstand von mindestens `schritt` (Tafel-Einheiten) */
function stuetzpunkte(s: Strich, schritt: number): P[] {
  const p: P[] = []
  for (const [x, y] of s.punkte) {
    const l = p[p.length - 1]
    if (!l || Math.hypot(x - l[0], y - l[1]) >= schritt) p.push([x, y])
  }
  return p
}

/** Wie oft kehrt der Strich die Richtung um? (zoom: Bildschirm-Pixel je Tafel-Einheit) */
export function umkehrungen(s: Strich, zoom = 1): number {
  const p = stuetzpunkte(s, SCHRITT / zoom)
  let anzahl = 0
  let beginn = 0 // Anfang des laufenden Teilstücks
  for (let i = 1; i < p.length; i++) {
    const [bx, by] = [p[i - 1][0] - p[beginn][0], p[i - 1][1] - p[beginn][1]]
    const lb = Math.hypot(bx, by)
    const [sx, sy] = [p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]]
    const ls = Math.hypot(sx, sy)
    if (lb < (2 * SCHRITT) / zoom || !ls) continue // das Teilstück hat noch keine klare Richtung
    if ((bx * sx + by * sy) / (lb * ls) < UMKEHR_COS) {
      anzahl++
      beginn = i - 1
    }
  }
  return anzahl
}

/** Ist der Strich ein Kritzeln (Zickzack zum Durchstreichen)? */
export function istKritzeln(s: Strich, zoom = 1): boolean {
  if (s.flaeche || s.punkte.length < 8) return false
  const xs = s.punkte.map((p) => p[0])
  const ys = s.punkte.map((p) => p[1])
  const diagonale = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  if (diagonale * zoom < MIN_GROESSE) return false
  let weg = 0
  for (let i = 1; i < s.punkte.length; i++) weg += Math.hypot(s.punkte[i][0] - s.punkte[i - 1][0], s.punkte[i][1] - s.punkte[i - 1][1])
  if (weg < WEG_FAKTOR * diagonale) return false
  return umkehrungen(s, zoom) >= KEHREN_MIN
}

const flaecheVon = ([l, o, r, u]: number[]) => Math.max(0, r - l) * Math.max(0, u - o)

/**
 * Was löscht dieses Gekritzel? Kennungen der Elemente (leer: kein Kritzeln oder nichts darunter – dann bleibt
 * der Strich ein normaler Strich).
 */
export function kritzelZiele(s: Strich, elemente: Element[], zoom = 1): string[] {
  if (!istKritzeln(s, zoom)) return []
  const r = Math.max(s.staerke / 2, 2 / zoom)
  const [kl, ko, kr, ku] = rahmen(s)
  const punkte = stuetzpunkte(s, Math.max(r, 2 / zoom))
  const ziele: string[] = []
  for (const e of elemente) {
    if (e.id === s.id || e.art === 'bild' || e.art === 'tabelle') continue
    const [l, o, re, u] = rahmen(e)
    // auch schmale Elemente (waagerechte Linie) haben so eine Fläche
    const er = [l - r, o - r, re + r, u + r]
    const innen = [Math.max(er[0], kl), Math.max(er[1], ko), Math.min(er[2], kr), Math.min(er[3], ku)]
    if (flaecheVon(innen) < ANTEIL_DARUNTER * flaecheVon(er)) continue
    if (punkte.some(([x, y]) => trifft(e, x, y, r))) ziele.push(e.id)
  }
  return ziele
}
