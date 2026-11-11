// Seiten eines Tafelbilds: hinzufügen, duplizieren, löschen, umsortieren, blättern. Reine Funktionen.
import { MAX_SEITEN, neueId, neueSeite, type Element, type Seite } from './modell.ts'

export type Buch = { seiten: Seite[]; nr: number }

const grenze = (nr: number, anzahl: number) => Math.min(anzahl - 1, Math.max(0, nr))

export const gehe = (b: Buch, nr: number): Buch => ({ ...b, nr: grenze(nr, b.seiten.length) })

/** Neue leere Seite hinter der aktuellen; sie wird gleich gezeigt. */
export function seiteDazu(b: Buch): Buch {
  if (b.seiten.length >= MAX_SEITEN) return b
  const seiten = [...b.seiten]
  seiten.splice(b.nr + 1, 0, neueSeite())
  return { seiten, nr: b.nr + 1 }
}

/** Kopie eines Elements mit neuer Kennung, auf Wunsch versetzt */
export function kopie(e: Element, dx = 0, dy = 0): Element {
  const id = neueId()
  if (e.art === 'strich') return { ...e, id, punkte: e.punkte.map(([x, y, d]) => [x + dx, y + dy, d]) }
  if (e.art === 'text' || e.art === 'bild') return { ...e, id, x: e.x + dx, y: e.y + dy }
  return { ...e, id, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy }
}

/** Kopie der aktuellen Seite direkt dahinter (mit neuen Kennungen); sie wird gleich gezeigt. */
export function seiteDoppelt(b: Buch): Buch {
  if (b.seiten.length >= MAX_SEITEN) return b
  const seiten = [...b.seiten]
  seiten.splice(b.nr + 1, 0, { ...b.seiten[b.nr], id: neueId(), elemente: b.seiten[b.nr].elemente.map((e) => kopie(e)) })
  return { seiten, nr: b.nr + 1 }
}

/** Löscht die aktuelle Seite. Die letzte Seite wird nicht gelöscht, sondern geleert. */
export function seiteWeg(b: Buch): Buch {
  if (b.seiten.length === 1) return { seiten: [neueSeite()], nr: 0 }
  const seiten = b.seiten.filter((_, i) => i !== b.nr)
  return { seiten, nr: grenze(b.nr, seiten.length) }
}

/** Schiebt die aktuelle Seite um eine Stelle nach vorne (-1) oder hinten (+1); sie bleibt die gezeigte. */
export function seiteSchieben(b: Buch, richtung: -1 | 1): Buch {
  const ziel = b.nr + richtung
  if (ziel < 0 || ziel >= b.seiten.length) return b
  const seiten = [...b.seiten]
  ;[seiten[b.nr], seiten[ziel]] = [seiten[ziel], seiten[b.nr]]
  return { seiten, nr: ziel }
}

/** Fügt mehrere Seiten (z. B. aus einem PDF) hinter der gezeigten ein und zeigt die erste davon. Überzählige fallen weg. */
export function seitenDazu(b: Buch, neue: Seite[]): Buch {
  const platz = Math.max(0, MAX_SEITEN - b.seiten.length)
  const dazu = neue.slice(0, platz)
  if (!dazu.length) return b
  // Eine einzelne leere Seite ohne Hintergrund wird durch das Eingefügte ersetzt (frische Tafel + PDF öffnen)
  const leer = b.seiten.length === 1 && !b.seiten[0].elemente.length && !b.seiten[0].hintergrund
  if (leer) return { seiten: neue.slice(0, MAX_SEITEN), nr: 0 }
  const seiten = [...b.seiten]
  seiten.splice(b.nr + 1, 0, ...dazu)
  return { seiten, nr: b.nr + 1 }
}
