// Seiten eines Tafelbilds: hinzufügen, duplizieren, löschen, umsortieren, blättern; PDF-Seiten drehen und ihren
// Hintergrund entfernen. Reine Funktionen.
import type { Befehl } from './befehle.ts'
import { gedreht, verschoben } from './geometrie.ts'
import { hintergrundMass, MAX_SEITEN, neueId, neueSeite, type Element, type Hintergrund, type Muster, type Seite } from './modell.ts'

export type Buch = { seiten: Seite[]; nr: number }

const grenze = (nr: number, anzahl: number) => Math.min(anzahl - 1, Math.max(0, nr))

export const gehe = (b: Buch, nr: number): Buch => ({ ...b, nr: grenze(nr, b.seiten.length) })

/** Neue leere Seite hinter der aktuellen; sie wird gleich gezeigt. */
export function seiteDazu(b: Buch, vorlage?: { muster?: Muster }): Buch {
  if (b.seiten.length >= MAX_SEITEN) return b
  const seiten = [...b.seiten]
  // Die neue Seite bekommt das Muster der Vorlage (Klasse) oder – ohne Vorlage – das Muster der Seite, von der aus
  // sie angelegt wird (nicht deren PDF- oder Bild-Hintergrund)
  const muster = vorlage ? vorlage.muster : b.seiten[b.nr]?.muster
  seiten.splice(b.nr + 1, 0, muster ? { ...neueSeite(), muster } : neueSeite())
  return { seiten, nr: b.nr + 1 }
}

/** Kopie eines Elements mit neuer Kennung, auf Wunsch versetzt */
export function kopie(e: Element, dx = 0, dy = 0): Element {
  const id = neueId()
  if (e.art === 'strich') return { ...e, id, punkte: e.punkte.map(([x, y, d]) => [x + dx, y + dy, d]) }
  if (e.art === 'text' || e.art === 'bild') return { ...e, id, x: e.x + dx, y: e.y + dy }
  return { ...e, id, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy }
}

/**
 * Kopien mehrerer Elemente mit neuen Kennungen, auf Wunsch versetzt. Gruppen bleiben erhalten: Was zusammen
 * gruppiert war, bildet in der Kopie wieder eine Gruppe – mit neuer Kennung, getrennt vom Original.
 */
export function kopiere(elemente: Element[], dx = 0, dy = 0): Element[] {
  const gruppen = new Map<string, string>()
  return elemente.map((e) => {
    const k = kopie(e, dx, dy)
    if (!e.gruppe) return k
    if (!gruppen.has(e.gruppe)) gruppen.set(e.gruppe, neueId())
    return { ...k, gruppe: gruppen.get(e.gruppe)! }
  })
}

/** Kopie der aktuellen Seite direkt dahinter (mit neuen Kennungen); sie wird gleich gezeigt. */
export function seiteDoppelt(b: Buch): Buch {
  if (b.seiten.length >= MAX_SEITEN) return b
  const seiten = [...b.seiten]
  seiten.splice(b.nr + 1, 0, { ...b.seiten[b.nr], id: neueId(), elemente: kopiere(b.seiten[b.nr].elemente) })
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

/** Löscht mehrere Seiten (Stellen in der Folge). Bleibt keine übrig, gibt es eine leere. Gezeigt wird die Seite an derselben Stelle. */
export function seitenWeg(b: Buch, nrs: number[]): Buch {
  const weg = new Set(nrs)
  const seiten = b.seiten.filter((_, i) => !weg.has(i))
  if (!seiten.length) return { seiten: [neueSeite()], nr: 0 }
  const davor = nrs.filter((n) => n < b.nr).length // gelöschte Seiten vor der gezeigten
  return { seiten, nr: grenze(b.nr - davor, seiten.length) }
}

/** Stellen aller Seiten, die aus demselben PDF stammen wie die gezeigte (leer, wenn sie keines hat) */
export function pdfSeiten(b: Buch): number[] {
  const pdf = b.seiten[b.nr]?.hintergrund?.pdf
  if (!pdf) return []
  return b.seiten.flatMap((s, i) => (s.hintergrund?.pdf === pdf ? [i] : []))
}

/**
 * Dreht eine Seite mit Hintergrund um 90° im Uhrzeigersinn (richtung 1) oder dagegen (−1). Alles darauf Geschriebene
 * dreht sich mit, die Seite liegt danach wieder bei (0, 0). Ein Schritt im Verlauf. Ohne Hintergrund: null.
 */
export function drehBefehl(s: Seite, richtung: 1 | -1): Befehl | null {
  const h = s.hintergrund
  if (!h) return null
  const [b, hoehe] = hintergrundMass(h)
  const grad = 90 * richtung
  // um die Mitte drehen, dann so verschieben, dass die gedrehte Seite wieder bei (0, 0) beginnt
  const dx = (hoehe - b) / 2
  const dy = (b - hoehe) / 2
  const neu = s.elemente.map((e) => verschoben(gedreht(e, b / 2, hoehe / 2, grad), dx, dy))
  const drehung = ((((h.drehung ?? 0) + grad) % 360) + 360) % 360
  const nachher: Hintergrund = { ...h }
  if (drehung) nachher.drehung = drehung as 90 | 180 | 270
  else delete nachher.drehung
  return { art: 'hintergrund', vorher: h, nachher, elementeVorher: s.elemente, elementeNachher: neu }
}

/** Entfernt den Hintergrund (die PDF-Seite); was darauf geschrieben wurde, bleibt. Ein Schritt im Verlauf. */
export function hintergrundWegBefehl(s: Seite): Befehl | null {
  if (!s.hintergrund) return null
  return { art: 'hintergrund', vorher: s.hintergrund, elementeVorher: [], elementeNachher: [] }
}
