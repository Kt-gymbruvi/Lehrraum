// Rückgängig und Wiederholen: Jede Änderung an der Tafel ist ein Befehl, der sich umkehren lässt.
// Reine Funktionen – die Liste der Elemente wird nie verändert, sondern neu gebildet.
import type { Element, Hintergrund } from './modell.ts'

export type Befehl =
  | { art: 'hinzufuegen'; elemente: Element[] }
  /** stellen: an welcher Stelle der Liste das Element lag (für das Wiederherstellen in gleicher Reihenfolge) */
  | { art: 'entfernen'; eintraege: { stelle: number; element: Element }[] }
  /** Elemente durch geänderte Fassungen mit derselben Kennung ersetzen (verschieben, umfärben, Text ändern) */
  | { art: 'ersetzen'; vorher: Element[]; nachher: Element[] }
  /** Reihenfolge ändern (was später kommt, liegt oben): Kennungen aller Elemente vorher und nachher */
  | { art: 'ordnen'; vorher: string[]; nachher: string[] }
  /**
   * Elemente an ihrer Stelle durch Teile ersetzen (Schwamm: ein Strich zerfällt in Reststücke, vielleicht keine).
   * stelle: wo das Element vorher lag – zum Wiederherstellen, auch wenn kein Teil übrig blieb.
   */
  | { art: 'zerlegen'; eintraege: { stelle: number; vorher: Element; nachher: Element[] }[] }
  /**
   * Hintergrund der Seite ändern (PDF-Seite drehen oder entfernen); beim Drehen drehen sich die Elemente mit
   * (geänderte Fassungen mit derselben Kennung). Fehlt nachher, ist der Hintergrund danach weg.
   */
  | { art: 'hintergrund'; vorher?: Hintergrund; nachher?: Hintergrund; elementeVorher: Element[]; elementeNachher: Element[] }

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

/**
 * Legt die Elemente ganz nach vorne (oben auf alles andere) oder ganz nach hinten; ihre Reihenfolge
 * untereinander bleibt. Liefert null, wenn sich nichts ändert.
 */
export function ordnenBefehl(elemente: Element[], ids: Iterable<string>, richtung: 'vorne' | 'hinten'): Befehl | null {
  const menge = new Set(ids)
  const gewaehlt = elemente.filter((e) => menge.has(e.id))
  const rest = elemente.filter((e) => !menge.has(e.id))
  const neu = richtung === 'vorne' ? [...rest, ...gewaehlt] : [...gewaehlt, ...rest]
  if (!gewaehlt.length || neu.every((e, i) => e === elemente[i])) return null
  return { art: 'ordnen', vorher: elemente.map((e) => e.id), nachher: neu.map((e) => e.id) }
}

const tausche = (elemente: Element[], neu: Element[]): Element[] => {
  const nach = new Map(neu.map((e) => [e.id, e]))
  return elemente.map((e) => nach.get(e.id) ?? e)
}

/** Ordnet die Elemente nach der Liste von Kennungen; was darin fehlt, kommt in alter Reihenfolge ans Ende. */
function ordne(elemente: Element[], reihenfolge: string[]): Element[] {
  const stelle = new Map(reihenfolge.map((id, i) => [id, i]))
  const bekannt = elemente.filter((e) => stelle.has(e.id)).sort((a, b) => stelle.get(a.id)! - stelle.get(b.id)!)
  return [...bekannt, ...elemente.filter((e) => !stelle.has(e.id))]
}

export function anwenden(elemente: Element[], b: Befehl): Element[] {
  if (b.art === 'hinzufuegen') return [...elemente, ...b.elemente]
  if (b.art === 'ersetzen') return tausche(elemente, b.nachher)
  if (b.art === 'hintergrund') return b.elementeNachher.length ? tausche(elemente, b.elementeNachher) : elemente
  if (b.art === 'ordnen') return ordne(elemente, b.nachher)
  if (b.art === 'zerlegen') {
    const teile = new Map(b.eintraege.map((e) => [e.vorher.id, e.nachher]))
    return elemente.flatMap((e) => teile.get(e.id) ?? [e])
  }
  const weg = new Set(b.eintraege.map((e) => e.element.id))
  return elemente.filter((e) => !weg.has(e.id))
}

/** Setzt Elemente wieder an ihre alte Stelle (aufsteigend, damit die Stellen stimmen) */
function einsetzen(elemente: Element[], eintraege: { stelle: number; element: Element }[]): Element[] {
  const neu = [...elemente]
  for (const { stelle, element } of [...eintraege].sort((a, c) => a.stelle - c.stelle)) {
    neu.splice(Math.min(stelle, neu.length), 0, element)
  }
  return neu
}

export function zuruecknehmen(elemente: Element[], b: Befehl): Element[] {
  if (b.art === 'hinzufuegen') {
    const weg = new Set(b.elemente.map((e) => e.id))
    return elemente.filter((e) => !weg.has(e.id))
  }
  if (b.art === 'ersetzen') return tausche(elemente, b.vorher)
  if (b.art === 'hintergrund') return b.elementeVorher.length ? tausche(elemente, b.elementeVorher) : elemente
  if (b.art === 'ordnen') return ordne(elemente, b.vorher)
  if (b.art === 'zerlegen') {
    // Teile weg, dann die ursprünglichen Elemente wieder an ihre Stelle
    const weg = new Set(b.eintraege.flatMap((e) => e.nachher.map((t) => t.id)))
    return einsetzen(
      elemente.filter((e) => !weg.has(e.id)),
      b.eintraege.map((e) => ({ stelle: e.stelle, element: e.vorher })),
    )
  }
  return einsetzen(elemente, b.eintraege)
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

// ---------- Für die ganze Seite: Elemente und Hintergrund ----------
/** Was ein Befehl an einer Seite ändern kann */
export type Inhalt = { elemente: Element[]; hintergrund?: Hintergrund }

/** Hintergrund nach dem Ausführen (vor = true) oder Zurücknehmen des Befehls; andere Befehle lassen ihn, wie er ist */
function neuerHintergrund(i: Inhalt, b: Befehl | undefined, vor: boolean): Hintergrund | undefined {
  if (b?.art !== 'hintergrund') return i.hintergrund
  return vor ? b.nachher : b.vorher
}
const mit = (elemente: Element[], h: Hintergrund | undefined): Inhalt => (h ? { elemente, hintergrund: h } : { elemente })

export function ausfuehrenAuf(i: Inhalt, verlauf: Verlauf, b: Befehl): { inhalt: Inhalt; verlauf: Verlauf } {
  const r = ausfuehren(i.elemente, verlauf, b)
  return { inhalt: mit(r.elemente, neuerHintergrund(i, b, true)), verlauf: r.verlauf }
}
export function rueckgaengigAuf(i: Inhalt, verlauf: Verlauf): { inhalt: Inhalt; verlauf: Verlauf } {
  const b = verlauf.zurueck[verlauf.zurueck.length - 1]
  if (!b) return { inhalt: i, verlauf }
  const r = rueckgaengig(i.elemente, verlauf)
  return { inhalt: mit(r.elemente, neuerHintergrund(i, b, false)), verlauf: r.verlauf }
}
export function wiederholenAuf(i: Inhalt, verlauf: Verlauf): { inhalt: Inhalt; verlauf: Verlauf } {
  const b = verlauf.vor[verlauf.vor.length - 1]
  if (!b) return { inhalt: i, verlauf }
  const r = wiederholen(i.elemente, verlauf)
  return { inhalt: mit(r.elemente, neuerHintergrund(i, b, true)), verlauf: r.verlauf }
}
