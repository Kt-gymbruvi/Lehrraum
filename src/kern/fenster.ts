// Fenster über der Tafel (Uhr, Timer, Stoppuhr, Zufall & Gruppen, Notiz): welche offen sind, wo sie liegen, was vorne ist.
// Reine Funktionen. Die Reihenfolge der Liste ist die Stapelfolge: das letzte Fenster liegt vorne.
import { neueId } from './modell.ts'

export const FENSTERARTEN = ['uhr', 'timer', 'stoppuhr', 'zufall', 'notiz', 'quizzo', 'klassenfunk', 'lernangebote'] as const
export type FensterArt = (typeof FENSTERARTEN)[number]

export const NOTIZFARBEN = ['gelb', 'gruen', 'rosa', 'blau'] as const
export type NotizFarbe = (typeof NOTIZFARBEN)[number]

export type FensterZustand = {
  id: string
  art: FensterArt
  /** Linke obere Ecke in Pixeln, gemessen von der linken oberen Ecke der Zeichenfläche */
  x: number
  y: number
  eingeklappt: boolean
  /** nur Notiz */
  text?: string
  farbe?: NotizFarbe
  /** nur Anwendungsfenster: was gerade läuft – Kennung des Spiels bzw. der Sitzung, oder der Ordner des Lernangebots */
  ziel?: string
  /** nur Anwendungsfenster: füllt die ganze Tafelfläche */
  gross?: boolean
}

export const FENSTERNAMEN: Record<FensterArt, string> = { uhr: 'Uhr', timer: 'Timer', stoppuhr: 'Stoppuhr', zufall: 'Zufall & Gruppen', notiz: 'Notiz', quizzo: 'Quizzo', klassenfunk: 'Klassenfunk', lernangebote: 'Lernangebote' }

/** Fenster, die eine andere Anwendung der Plattform zeigen (größer, lassen sich auf die ganze Fläche vergrößern) */
/** Nur in der Tafel einer Klasse (braucht ihre Namen) */
export const NUR_KLASSE: ReadonlySet<FensterArt> = new Set(['zufall'])

export const ANWENDUNGEN: ReadonlySet<FensterArt> = new Set(['quizzo', 'klassenfunk', 'lernangebote'])
/** Kennung eines Spiels, einer Sitzung oder ein Ordnername – nur solche Zeichen gelangen in eine Adresse */
export const istZiel = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(x)

/** Von diesen Arten kann es mehrere Fenster geben; alle anderen höchstens einmal. */
export const MEHRFACH: ReadonlySet<FensterArt> = new Set(['notiz'])
export const MAX_FENSTER = 12
export const MAX_NOTIZTEXT = 2000

/**
 * Knopf in der rechten Leiste: öffnet ein Fenster. Gibt es die Art schon (und nur einmal erlaubt), wird es
 * geschlossen – der Knopf schaltet also ein und aus. Neue Fenster liegen leicht versetzt, damit sie sich nicht verdecken.
 */
export function schalte(liste: FensterZustand[], art: FensterArt): FensterZustand[] {
  if (!MEHRFACH.has(art) && liste.some((f) => f.art === art)) return liste.filter((f) => f.art !== art)
  if (liste.length >= MAX_FENSTER) return liste
  const versatz = (liste.length % 6) * 28
  const neu: FensterZustand = { id: neueId(), art, x: 24 + versatz, y: 24 + versatz, eingeklappt: false }
  if (art === 'notiz') {
    neu.text = ''
    neu.farbe = NOTIZFARBEN[liste.filter((f) => f.art === 'notiz').length % NOTIZFARBEN.length]
  }
  return [...liste, neu]
}

export const schliesse = (liste: FensterZustand[], id: string): FensterZustand[] => liste.filter((f) => f.id !== id)

/** Holt ein Fenster nach vorne (ans Ende der Liste). Ist es schon vorne, bleibt die Liste dieselbe. */
export function nachVorn(liste: FensterZustand[], id: string): FensterZustand[] {
  const f = liste.find((x) => x.id === id)
  if (!f || liste[liste.length - 1] === f) return liste
  return [...liste.filter((x) => x !== f), f]
}

export function aendere(liste: FensterZustand[], id: string, neu: Partial<Omit<FensterZustand, 'id' | 'art'>>): FensterZustand[] {
  return liste.map((f) => (f.id === id ? { ...f, ...neu } : f))
}

/** Hält die linke obere Ecke so, dass vom Fenster mindestens die Titelzeile erreichbar bleibt. */
export function begrenze(x: number, y: number, flaecheB: number, flaecheH: number, fensterB: number): [number, number] {
  const rand = 56 // so viel vom Fenster bleibt immer sichtbar
  return [Math.round(Math.min(Math.max(x, rand - fensterB), Math.max(0, flaecheB - rand))), Math.round(Math.min(Math.max(y, 0), Math.max(0, flaecheH - rand)))]
}

const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const zahl = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(Math.min(20000, Math.max(-2000, x))) : 0)

/** Prüft gespeicherte Fenster; Unbekanntes und Doppeltes fällt weg. */
export function pruefeFenster(roh: unknown): FensterZustand[] {
  if (!Array.isArray(roh)) return []
  const liste: FensterZustand[] = []
  const ids = new Set<string>()
  for (const x of roh) {
    if (!istObjekt(x) || typeof x.id !== 'string' || !x.id || ids.has(x.id)) continue
    const art = FENSTERARTEN.find((a) => a === x.art)
    if (!art || (!MEHRFACH.has(art) && liste.some((f) => f.art === art)) || liste.length >= MAX_FENSTER) continue
    ids.add(x.id)
    const f: FensterZustand = { id: x.id, art, x: zahl(x.x), y: zahl(x.y), eingeklappt: x.eingeklappt === true }
    if (art === 'notiz') {
      f.text = typeof x.text === 'string' ? x.text.slice(0, MAX_NOTIZTEXT) : ''
      f.farbe = NOTIZFARBEN.find((n) => n === x.farbe) ?? 'gelb'
    }
    if (ANWENDUNGEN.has(art)) {
      if (istZiel(x.ziel)) f.ziel = x.ziel
      if (x.gross === true) f.gross = true
    }
    liste.push(f)
  }
  return liste
}

// ---------- Zeit (Logik der Fenster, ohne Oberfläche) ----------

/** 125000 ms → „2:05“; ab einer Stunde „1:02:05“. Für den Countdown wird aufgerundet (0:01 bis zum Schluss). */
export function zeitText(ms: number, aufrunden = false): string {
  const s = Math.max(0, aufrunden ? Math.ceil(ms / 1000) : Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`
}

/** Zehntelsekunden für die Stoppuhr: 61234 ms → „1:01,2“ */
export const stoppText = (ms: number): string => `${zeitText(ms)},${Math.floor((Math.max(0, ms) % 1000) / 100)}`
