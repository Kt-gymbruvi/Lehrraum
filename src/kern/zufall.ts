// Zufallsschüler und Zufallsgruppen aus den Namen einer Klasse. Reine Funktionen, nichts wird gespeichert.
// Der Zufall kommt aus crypto.getRandomValues (gleichmäßig, ohne Schieflage); Tests geben eigene Zahlen vor.
import type { Schueler } from './klassen.ts'

/** Zufallszahl 0 ≤ z < n, gleichmäßig verteilt */
export function zufallBis(n: number): number {
  if (n <= 1) return 0
  const grenze = Math.floor(0x1_0000_0000 / n) * n // Werte darüber verwerfen, sonst wären kleine Zahlen häufiger
  const z = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(z)
    if (z[0] < grenze) return z[0] % n
  }
}
export type Zufall = (n: number) => number

/** Mischt eine Kopie (Fisher-Yates) */
export function gemischt<T>(liste: readonly T[], zufall: Zufall = zufallBis): T[] {
  const a = [...liste]
  for (let i = a.length - 1; i > 0; i--) {
    const j = zufall(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Anzeigenamen: der Vorname; gibt es ihn mehrfach, mit Anfangsbuchstaben des Nachnamens („Anna M.“),
 * reicht das nicht, mit ganzem Nachnamen. Ohne Vornamen der Nachname.
 */
export function anzeigeNamen(schueler: readonly Schueler[]): Map<string, string> {
  const schluessel = (s: string) => s.toLocaleLowerCase('de')
  const vorname = (s: Schueler) => s.vorname || s.nachname
  const zaehle = (werte: string[]) => werte.reduce((m, w) => m.set(schluessel(w), (m.get(schluessel(w)) ?? 0) + 1), new Map<string, number>())
  const vornamen = zaehle(schueler.map(vorname))
  const kurz = (s: Schueler) => (s.vorname && s.nachname ? `${s.vorname} ${s.nachname[0]}.` : vorname(s))
  const kurze = zaehle(schueler.filter((s) => (vornamen.get(schluessel(vorname(s))) ?? 0) > 1).map(kurz))
  const namen = new Map<string, string>()
  for (const s of schueler) {
    if ((vornamen.get(schluessel(vorname(s))) ?? 0) <= 1) namen.set(s.id, vorname(s))
    else if ((kurze.get(schluessel(kurz(s))) ?? 0) <= 1) namen.set(s.id, kurz(s))
    else namen.set(s.id, [s.vorname, s.nachname].filter(Boolean).join(' '))
  }
  return namen
}

/**
 * Zieht eine Kennung aus `ids`. Mit `ohneWiederholung` nur aus denen, die in `dran` noch fehlen;
 * waren alle dran, beginnt eine neue Runde (`neueRunde`). Liefert null, wenn niemand da ist.
 */
export function ziehe(ids: readonly string[], dran: ReadonlySet<string>, ohneWiederholung: boolean, zufall: Zufall = zufallBis): { id: string; neueRunde: boolean } | null {
  if (!ids.length) return null
  const offen = ohneWiederholung ? ids.filter((id) => !dran.has(id)) : [...ids]
  const neueRunde = ohneWiederholung && offen.length === 0
  const aus = neueRunde ? [...ids] : offen
  return { id: aus[zufall(aus.length)], neueRunde }
}

export type Gruppenart = 'anzahl' | 'groesse'

/** Wie viele Gruppen entstehen: bei „groesse“ so viele, dass keine Gruppe größer als gewünscht ist */
export function gruppenAnzahl(personen: number, art: Gruppenart, wert: number): number {
  if (personen <= 0) return 0
  const w = Math.max(1, Math.floor(wert))
  return Math.min(personen, art === 'anzahl' ? w : Math.ceil(personen / w))
}

/** Verteilt die Kennungen gemischt auf Gruppen; die Größen unterscheiden sich höchstens um eins. */
export function bildeGruppen(ids: readonly string[], art: Gruppenart, wert: number, zufall: Zufall = zufallBis): string[][] {
  const n = gruppenAnzahl(ids.length, art, wert)
  if (!n) return []
  const gruppen: string[][] = Array.from({ length: n }, () => [])
  gemischt(ids, zufall).forEach((id, i) => gruppen[i % n].push(id))
  return gruppen
}

/** Text für die Tafel: „Gruppe 1: Anna, Ben“ je Zeile */
export const gruppenText = (gruppen: readonly string[][], namen: ReadonlyMap<string, string>): string =>
  gruppen.map((g, i) => `Gruppe ${i + 1}: ${g.map((id) => namen.get(id) ?? '?').join(', ')}`).join('\n')
