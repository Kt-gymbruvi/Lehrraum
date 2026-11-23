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

/** Paare: zufällig gemischt, bei ungerader Zahl entsteht eine Dreiergruppe; eine einzelne Person bleibt allein. */
export function bildePaare(ids: readonly string[], zufall: Zufall = zufallBis): string[][] {
  const g = gemischt(ids, zufall)
  const paare: string[][] = []
  for (let i = 0; i + 1 < g.length; i += 2) paare.push([g[i], g[i + 1]])
  if (g.length % 2 === 1) {
    if (paare.length) paare[paare.length - 1].push(g[g.length - 1])
    else paare.push([g[0]])
  }
  return paare
}

/** Text für die Tafel: „Gruppe 1: Anna, Ben“ je Zeile (`titel` z. B. „Paar“) */
export const gruppenText = (gruppen: readonly string[][], namen: ReadonlyMap<string, string>, titel = 'Gruppe'): string =>
  gruppen.map((g, i) => `${titel} ${i + 1}: ${g.map((id) => namen.get(id) ?? '?').join(', ')}`).join('\n')

// ---- Glücksrad -------------------------------------------------------------------------------------------------
// Das Rad hat n gleich große Felder; Feld 0 beginnt oben und läuft im Uhrzeigersinn. Der Zeiger steht fest oben.
// Erst wird gelost, dann das Rad so gedreht, dass der Zeiger auf dem gelosten Feld ausläuft – der Zufall liegt allein
// in der Auslosung (`ziehe`), nie in der Animation.

const norm360 = (grad: number): number => ((grad % 360) + 360) % 360

/**
 * Neue Gesamtdrehung (Grad, im Uhrzeigersinn, nie kleiner als `aktuell`): `umdrehungen` volle Runden plus der Rest,
 * damit der Zeiger auf Feld `feld` zeigt. `versatz` (0–1) ist die Stelle im Feld; Rand und Mitte werden gemieden.
 */
export function raddrehung(aktuell: number, n: number, feld: number, versatz: number, umdrehungen: number): number {
  const breite = 360 / Math.max(1, n)
  const stelle = 0.1 + 0.8 * Math.min(1, Math.max(0, versatz))
  const ziel = (feld + stelle) * breite
  return aktuell + Math.max(0, Math.floor(umdrehungen)) * 360 + norm360(-ziel - aktuell)
}

/** Welches Feld steht bei dieser Drehung unter dem Zeiger? */
export function feldAmZeiger(drehung: number, n: number): number {
  return Math.min(n - 1, Math.floor(norm360(-drehung) / (360 / Math.max(1, n))))
}
