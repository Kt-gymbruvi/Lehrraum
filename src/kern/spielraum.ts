// Spielraum der Klasse (Fenster „Spiele“): Raumcode, Adresse der Lobby und die Auswertung der Anwesenheit.
// Reine Funktionen. Der Raum selbst läuft auf der Startseite (`spielen/lobby/`, Echtzeit-Kanal `spielraum-<Code>`);
// die Tafel ist dort die „Leitung“: Sie legt den Raum an, zeigt den QR-Code und legt fest, welche Spiele erlaubt sind.
// Das Format der Anwesenheit ist in `../Kt-gymbruvi.github.io/spielen/raum.js` beschrieben.

export const SPIELE = { 'vier-gewinnt': 'Vier gewinnt', muehle: 'Mühle', schach: 'Schach' } as const
export type SpielId = keyof typeof SPIELE
export const SPIEL_IDS = Object.keys(SPIELE) as SpielId[]

const ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ohne leicht verwechselbare Zeichen (I, O, 0, 1)
export const CODE_LAENGE = 6

/** Adresse der Plattform: Der QR-Code muss auf den Handys der Schüler funktionieren, auch wenn die Tafel lokal läuft. */
export const PLATTFORM = 'https://kt-gymbruvi.github.io'

/** Zufälliger Raumcode aus sechs Zeichen; `zufall` liefert Zahlen 0 ≤ x < 1 (für Tests ersetzbar). */
export function neuerCode(zufall?: () => number): string {
  let code = ''
  if (zufall) {
    for (let i = 0; i < CODE_LAENGE; i++) code += ZEICHEN[Math.floor(zufall() * ZEICHEN.length)]
    return code
  }
  const z = new Uint32Array(CODE_LAENGE)
  crypto.getRandomValues(z)
  for (const x of z) code += ZEICHEN[x % ZEICHEN.length]
  return code
}

export const istCode = (c: unknown): c is string => typeof c === 'string' && new RegExp(`^[${ZEICHEN}]{${CODE_LAENGE}}$`).test(c)

/** Name des Echtzeit-Kanals – gleich wie auf der Startseite (`spielen/raum.js`). */
export const kanalName = (code: string) => `spielraum-${code}`

/** Adresse der Lobby für den QR-Code und zum Weitersagen. */
export const lobbyAdresse = (code: string) => `${PLATTFORM}/spielen/lobby/?raum=${code}`

const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Spitznamen: höchstens 20 Zeichen, keine Steuerzeichen oder spitzen Klammern. */
export const bereinige = (n: unknown): string =>
  String(n ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, 20)

export type Teilnehmer = {
  id: string
  name: string
  leitung: boolean
  /** bietet dieses Spiel an */
  angebot?: { partie: string; spiel: SpielId }
  /** spielt gerade */
  spielt?: { partie: string; spiel: SpielId; gegner: string }
}

const istSpiel = (s: unknown): s is SpielId => typeof s === 'string' && Object.prototype.hasOwnProperty.call(SPIELE, s)

/** Macht aus den rohen Anwesenheitsangaben (von fremden Geräten!) eine geprüfte Liste; Ungültiges fällt weg. */
export function pruefeTeilnehmer(roh: unknown): Teilnehmer[] {
  if (!Array.isArray(roh)) return []
  const ids = new Set<string>()
  const liste: Teilnehmer[] = []
  for (const x of roh) {
    if (!istObjekt(x) || typeof x.id !== 'string' || !x.id || x.id.length > 40 || ids.has(x.id)) continue
    ids.add(x.id)
    const t: Teilnehmer = { id: x.id, name: bereinige(x.name) || 'Gast', leitung: x.rolle === 'leitung' }
    if (istObjekt(x.angebot) && istSpiel(x.angebot.spiel) && typeof x.angebot.partie === 'string') t.angebot = { partie: x.angebot.partie.slice(0, 20), spiel: x.angebot.spiel }
    if (istObjekt(x.spielt) && istSpiel(x.spielt.spiel) && typeof x.spielt.partie === 'string') {
      t.spielt = { partie: x.spielt.partie.slice(0, 20), spiel: x.spielt.spiel, gegner: bereinige(x.spielt.gegner) || 'Gast' }
    }
    liste.push(t)
  }
  return liste
}

/** Laufende Partien (jede nur einmal, auch wenn beide Spieler sie melden). */
export function laufende(liste: Teilnehmer[]): { partie: string; spiel: SpielId; a: string; b: string }[] {
  const gesehen = new Set<string>()
  const l: { partie: string; spiel: SpielId; a: string; b: string }[] = []
  for (const t of liste) {
    if (!t.spielt || gesehen.has(t.spielt.partie)) continue
    gesehen.add(t.spielt.partie)
    l.push({ partie: t.spielt.partie, spiel: t.spielt.spiel, a: t.name, b: t.spielt.gegner })
  }
  return l
}

/** Offene Angebote der Schüler (nicht der Leitung). */
export const angebote = (liste: Teilnehmer[]) => liste.filter((t) => !t.leitung && t.angebot && !t.spielt)

/** Anwesenheit, die die Tafel selbst meldet (Leitung mit der Liste der erlaubten Spiele). */
export function leitungsAngaben(id: string, erlaubt: readonly SpielId[]) {
  return { id, name: 'Tafel', rolle: 'leitung' as const, spiele: SPIEL_IDS.filter((s) => erlaubt.includes(s)) }
}
