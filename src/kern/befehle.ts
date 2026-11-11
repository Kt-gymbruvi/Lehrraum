// Rückgängig und Wiederholen: Jede Änderung an der Tafel ist ein Befehl, der sich umkehren lässt.
// Reine Funktionen – die Liste der Elemente wird nie verändert, sondern neu gebildet.
import type { Element } from './modell.ts'

export type Befehl =
  | { art: 'hinzufuegen'; elemente: Element[] }
  /** stellen: an welcher Stelle der Liste das Element lag (für das Wiederherstellen in gleicher Reihenfolge) */
  | { art: 'entfernen'; eintraege: { stelle: number; element: Element }[] }
  /** Elemente durch geänderte Fassungen mit derselben Kennung ersetzen (verschieben, umfärben, Text ändern) */
  | { art: 'ersetzen'; vorher: Element[]; nachher: Element[] }

export type Verlauf = { zurueck: Befehl[]; vor: Befehl[] }

export const leererVerlauf = (): Verlauf => ({ zurueck: [], vor: [] })

/** Höchstens so viele Schritte merken (ältere fallen weg). */
export const MAX_SCHRITTE = 200

/** Baut den Befehl „diese Elemente entfernen“ mit ihren aktuellen Stellen. Unbekannte Kennungen werden übergangen. */
export function entfernenBefehl(elemente: Element[], ids: Iterable<string>): Befehl | null {
  const menge = new Set(ids)
  const eintraege = elemente.flatMap((element, stelle) => (menge.has(element.id) ? [{ stelle, element }] : []))
  return eintraege.length ? { art: 'entfernen', eintraege } : null
}

const tausche = (elemente: Element[], neu: Element[]): Element[] => {
  const nach = new Map(neu.map((e) => [e.id, e]))
  return elemente.map((e) => nach.get(e.id) ?? e)
}

export function anwenden(elemente: Element[], b: Befehl): Element[] {
  if (b.art === 'hinzufuegen') return [...elemente, ...b.elemente]
  if (b.art === 'ersetzen') return tausche(elemente, b.nachher)
  const weg = new Set(b.eintraege.map((e) => e.element.id))
  return elemente.filter((e) => !weg.has(e.id))
}

export function zuruecknehmen(elemente: Element[], b: Befehl): Element[] {
  if (b.art === 'hinzufuegen') {
    const weg = new Set(b.elemente.map((e) => e.id))
    return elemente.filter((e) => !weg.has(e.id))
  }
  if (b.art === 'ersetzen') return tausche(elemente, b.vorher)
  // Entferntes wieder an die alte Stelle setzen (aufsteigend, damit die Stellen stimmen)
  const neu = [...elemente]
  for (const { stelle, element } of [...b.eintraege].sort((a, c) => a.stelle - c.stelle)) {
    neu.splice(Math.min(stelle, neu.length), 0, element)
  }
  return neu
}

/** Führt einen neuen Befehl aus. Damit verfällt alles, was man „wiederholen“ könnte. */
export function ausfuehren(elemente: Element[], verlauf: Verlauf, b: Befehl): { elemente: Element[]; verlauf: Verlauf } {
  return {
    elemente: anwenden(elemente, b),
    verlauf: { zurueck: [...verlauf.zurueck, b].slice(-MAX_SCHRITTE), vor: [] },
  }
}

export function rueckgaengig(elemente: Element[], verlauf: Verlauf): { elemente: Element[]; verlauf: Verlauf } {
  const b = verlauf.zurueck[verlauf.zurueck.length - 1]
  if (!b) return { elemente, verlauf }
  return {
    elemente: zuruecknehmen(elemente, b),
    verlauf: { zurueck: verlauf.zurueck.slice(0, -1), vor: [...verlauf.vor, b] },
  }
}

export function wiederholen(elemente: Element[], verlauf: Verlauf): { elemente: Element[]; verlauf: Verlauf } {
  const b = verlauf.vor[verlauf.vor.length - 1]
  if (!b) return { elemente, verlauf }
  return {
    elemente: anwenden(elemente, b),
    verlauf: { zurueck: [...verlauf.zurueck, b], vor: verlauf.vor.slice(0, -1) },
  }
}
