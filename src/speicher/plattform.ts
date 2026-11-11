// Adressen der Schwesteranwendungen auf derselben Plattform (Startseite, Quizzo, Klassenfunk, Lernangebote).
// Veröffentlicht liegen alle unter derselben Adresse wie Lehrraum. In der lokalen Vorschau zeigt Lehrraum auf
// die veröffentlichte Plattform – dort ist man dann getrennt angemeldet.
export const PLATTFORM: string = (import.meta.env.VITE_PLATTFORM as string | undefined) ?? (import.meta.env.DEV ? 'https://kt-gymbruvi.github.io' : window.location.origin)

/** Kennungen aus der Datenbank bzw. Ordnernamen – nur solche Zeichen dürfen in eine Adresse */
export const istKennung = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(x)

export const quizzoSpiel = (id: string) => `${PLATTFORM}/Quizzo/#/leiten/spiel/${id}`
export const klassenfunkSitzung = (id: string) => `${PLATTFORM}/Klassenfunk/#/leiten/sitzung/${id}`
export const lernangebot = (ordner: string) => `${PLATTFORM}/lernen/${ordner}/`

export type Lernangebot = { ordner: string; titel: string; text: string; fach: string; stufen: string[] }
export type Lernliste = { angebote: Lernangebot[]; faecher: { id: string; name: string }[]; stufen: { id: string; name: string }[] }

type Fenster = Window & { ANGEBOTE?: unknown; FAECHER?: unknown; STUFEN?: unknown }
const namen = (x: unknown): { id: string; name: string }[] =>
  (Array.isArray(x) ? x : []).flatMap((e) => (e && typeof e.id === 'string' && typeof e.name === 'string' ? [{ id: e.id, name: e.name }] : []))

let liste: Promise<Lernliste> | null = null

/**
 * Liest die Liste der Lernangebote aus der Startseite (lernen/angebote.js – dieselbe Datei, aus der die
 * Lernübersicht entsteht). Es ist ein Skript der eigenen Plattform; es legt nur Listen an.
 */
export function ladeLernangebote(): Promise<Lernliste> {
  liste ??= new Promise<Lernliste>((ok, fehler) => {
    const skript = document.createElement('script')
    skript.src = `${PLATTFORM}/lernen/angebote.js`
    skript.onload = () => {
      const w = window as Fenster
      const angebote = (Array.isArray(w.ANGEBOTE) ? w.ANGEBOTE : []).flatMap((a): Lernangebot[] =>
        a && istKennung(a.ordner) && typeof a.titel === 'string' && a.sichtbar !== false
          ? [{ ordner: a.ordner, titel: a.titel, text: typeof a.text === 'string' ? a.text : '', fach: typeof a.fach === 'string' ? a.fach : '', stufen: Array.isArray(a.stufen) ? a.stufen.filter((s: unknown) => typeof s === 'string') : [] }]
          : [],
      )
      ok({ angebote, faecher: namen(w.FAECHER), stufen: namen(w.STUFEN) })
    }
    skript.onerror = () => {
      liste = null // beim nächsten Öffnen noch einmal versuchen
      skript.remove()
      fehler(new Error('Die Liste der Lernangebote ist nicht erreichbar.'))
    }
    document.head.append(skript)
  })
  return liste
}
