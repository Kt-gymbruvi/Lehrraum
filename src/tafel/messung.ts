// Verbindet die Zeichenfläche mit der Prüfansicht: Solange die Prüfansicht offen ist, meldet die Zeichenfläche,
// wie lange sie für jedes Bild rechnet. Ist sie zu, kostet das nichts. Nichts wird gespeichert oder gesendet.
import { gezeichnet, KEINE, type Lauf, type Strichmessung, type Zeigerart } from '../kern/messung.ts'

type Zustand = {
  /** Nur bei offener Prüfansicht wird gemessen */
  aktiv: boolean
  /** Der Strich, der gerade entsteht */
  lauf: Lauf | null
  /** Abgeschlossene Striche, neuester zuerst */
  verlauf: Strichmessung[]
  /** Striche je Eingabeart seit dem Öffnen der Prüfansicht */
  anzahl: Record<Zeigerart, number>
  /** Wird aufgerufen, wenn sich der Verlauf ändert */
  beiAenderung: (() => void) | null
}

export const messung: Zustand = { aktiv: false, lauf: null, verlauf: [], anzahl: KEINE, beiAenderung: null }

export function setzeZurueck() {
  messung.lauf = null
  messung.verlauf = []
  messung.anzahl = KEINE
}

/** Zeitpunkt für eine Messung – oder 0, wenn nicht gemessen wird */
export const messBeginn = (): number => (messung.aktiv ? performance.now() : 0)

/** Die obere Ebene (der entstehende Strich) wurde gezeichnet. */
export function obenGezeichnet(beginn: number) {
  if (messung.aktiv && messung.lauf) gezeichnet(messung.lauf, performance.now() - beginn)
}

/**
 * Die untere Ebene (alles Fertige) wurde gezeichnet. Während eines Strichs zählt das zu dessen Rechenzeit
 * (z. B. beim Verschieben der Ansicht); nach dem Abheben ist es das „Einzeichnen“ des fertigen Strichs.
 */
export function untenGezeichnet(beginn: number) {
  if (!messung.aktiv) return
  const dauer = performance.now() - beginn
  const [letzter, ...rest] = messung.verlauf
  if (messung.lauf) gezeichnet(messung.lauf, dauer, false)
  else if (letzter) {
    messung.verlauf = [{ ...letzter, einzeichnen: (letzter.einzeichnen ?? 0) + dauer }, ...rest]
    messung.beiAenderung?.()
  }
}
