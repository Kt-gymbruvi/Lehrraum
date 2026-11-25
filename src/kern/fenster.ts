// Fenster über der Tafel (Uhr, Timer, Stoppuhr, Zufall & Gruppen, Notiz, Arbeitsform, Geräuschampel): welche offen sind, wo sie liegen, was vorne ist.
// Reine Funktionen. Die Reihenfolge der Liste ist die Stapelfolge: das letzte Fenster liegt vorne.
import { neueId } from './modell.ts'

export const FENSTERARTEN = ['uhr', 'timer', 'stoppuhr', 'zufall', 'notiz', 'arbeitsform', 'geraeusch'] as const
export type FensterArt = (typeof FENSTERARTEN)[number]

export const NOTIZFARBEN = ['gelb', 'gruen', 'rosa', 'blau'] as const
export type NotizFarbe = (typeof NOTIZFARBEN)[number]

/** Arbeitsform-Schild: Sozialform und erlaubte Lautstärke */
export const ARBEITSFORMEN = ['einzel', 'partner', 'gruppe', 'plenum'] as const
export type Arbeitsform = (typeof ARBEITSFORMEN)[number]
export const ARBEITSFORM_NAMEN: Record<Arbeitsform, string> = { einzel: 'Einzelarbeit', partner: 'Partnerarbeit', gruppe: 'Gruppenarbeit', plenum: 'Plenum' }
export const LAUTSTAERKEN = ['still', 'fluestern', 'leise', 'normal'] as const
export type Lautstaerke = (typeof LAUTSTAERKEN)[number]
export const LAUTSTAERKE_NAMEN: Record<Lautstaerke, string> = { still: 'Still', fluestern: 'Flüstern', leise: 'Leise sprechen', normal: 'Normal sprechen' }

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
  /** nur Arbeitsform */
  form?: Arbeitsform
  laut?: Lautstaerke
  /** nur Geräuschampel: ab welchem Pegel (0–100) die Ampel rot wird */
  grenze?: number
  /** Vergrößerung des Inhalts, fehlt = 1 */
  skala?: number
  /**
   * Nur gleich nach dem Öffnen: das Fenster wird mittig auf die Tafel gelegt, sobald seine Größe bekannt ist
   * (Wert = Versatz in Pixeln, damit mehrere neue Fenster sich nicht genau verdecken). Wird nie gespeichert.
   */
  mitte?: number
}

export const FENSTERNAMEN: Record<FensterArt, string> = { uhr: 'Uhr', timer: 'Timer', stoppuhr: 'Stoppuhr', zufall: 'Zufall & Gruppen', notiz: 'Notiz', arbeitsform: 'Arbeitsform', geraeusch: 'Geräuschampel' }

/** Reihenfolge und Gruppen der Knöpfe in der rechten Leiste: Zeit, dann Unterricht */
export const LEISTENGRUPPEN: FensterArt[][] = [
  ['uhr', 'timer', 'stoppuhr'],
  ['zufall', 'notiz', 'arbeitsform', 'geraeusch'],
]
/** Beschriftung in der Leiste, wo der Name zu lang ist (weiches Trennzeichen) */
export const LEISTENNAMEN: Partial<Record<FensterArt, string>> = { geraeusch: 'Geräusch\u00adampel' }

/** Nur in der Tafel einer Klasse (braucht ihre Namen) */
export const NUR_KLASSE: ReadonlySet<FensterArt> = new Set(['zufall'])

/** Von diesen Arten kann es mehrere Fenster geben; alle anderen höchstens einmal. */
export const MEHRFACH: ReadonlySet<FensterArt> = new Set(['notiz'])
export const MAX_FENSTER = 12
export const MAX_NOTIZTEXT = 2000
export const GRENZE_MIN = 20
export const GRENZE_MAX = 95
export const GRENZE_STANDARD = 60

/**
 * Knopf in der rechten Leiste: öffnet ein Fenster. Gibt es die Art schon (und nur einmal erlaubt), wird es
 * geschlossen – der Knopf schaltet also ein und aus. Neue Fenster erscheinen in der Mitte der Tafel (`mitte`),
 * leicht versetzt, damit sie sich nicht verdecken.
 */
export function schalte(liste: FensterZustand[], art: FensterArt): FensterZustand[] {
  if (!MEHRFACH.has(art) && liste.some((f) => f.art === art)) return liste.filter((f) => f.art !== art)
  if (liste.length >= MAX_FENSTER) return liste
  const versatz = (liste.length % 6) * 28
  const neu: FensterZustand = { id: neueId(), art, x: 24 + versatz, y: 24 + versatz, eingeklappt: false, mitte: versatz }
  if (art === 'notiz') {
    neu.text = ''
    neu.farbe = NOTIZFARBEN[liste.filter((f) => f.art === 'notiz').length % NOTIZFARBEN.length]
  }
  if (art === 'arbeitsform') {
    neu.form = 'einzel'
    neu.laut = 'still'
  }
  if (art === 'geraeusch') neu.grenze = GRENZE_STANDARD
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

// ---------- Größe (Eckgriff unten rechts, wie bei Bildern) ----------
export const SKALA_MIN = 0.5
export const SKALA_MAX = 4
const rundeSkala = (s: number) => Math.round(s * 100) / 100

/**
 * Neue Vergrößerung beim Ziehen am Eckgriff: Der Inhalt wächst gleichmäßig wie ein Bild, gemessen am Zugweg
 * entlang seiner Diagonale. b, h: Größe des Inhalts beim Greifen (Bildschirm-Pixel); dx, dy: Zugweg;
 * platzB, platzH: Platz bis zum Rand der Fläche – darüber hinaus wächst der Inhalt nicht (war er schon größer, bleibt er).
 */
export function neueSkala(start: number, b: number, h: number, dx: number, dy: number, platzB = Infinity, platzH = Infinity): number {
  if (!(b > 0 && h > 0)) return start
  const faktor = 1 + (dx * b + dy * h) / (b * b + h * h)
  const grenze = Math.max(start, Math.min(SKALA_MAX, start * Math.min(platzB / b, platzH / h)))
  return rundeSkala(Math.min(grenze, Math.max(SKALA_MIN, start * faktor)))
}

/** Tastatur am Griff: ein Schritt größer oder kleiner */
export const skalaSchritt = (s: number, richtung: 1 | -1): number => rundeSkala(Math.min(SKALA_MAX, Math.max(SKALA_MIN, s + richtung * 0.1)))

/**
 * Linke obere Ecke für ein neues Fenster der Größe b × h in der Mitte einer Fläche platzB × platzH,
 * um `versatz` nach rechts unten verschoben; passt es nicht ganz hinein, liegt es oben links am Rand.
 */
export function mittig(platzB: number, platzH: number, b: number, h: number, versatz = 0): [number, number] {
  const rand = 8
  const x = Math.max(rand, Math.min((platzB - b) / 2 + versatz, platzB - b - rand))
  const y = Math.max(rand, Math.min((platzH - h) / 2 + versatz, platzH - h - rand))
  return [Math.round(x), Math.round(y)]
}

/** Hält die linke obere Ecke so, dass vom Fenster mindestens die Titelzeile erreichbar bleibt. */
export function begrenze(x: number, y: number, flaecheB: number, flaecheH: number, fensterB: number): [number, number] {
  const rand = 56 // so viel vom Fenster bleibt immer sichtbar
  return [Math.round(Math.min(Math.max(x, rand - fensterB), Math.max(0, flaecheB - rand))), Math.round(Math.min(Math.max(y, 0), Math.max(0, flaecheH - rand)))]
}

const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const zahl = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(Math.min(20000, Math.max(-2000, x))) : 0)

/** Prüft gespeicherte Fenster; Unbekanntes und Doppeltes fällt weg (auch die früheren Fenster Quizzo, Klassenfunk, Lernangebote). */
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
    if (art === 'arbeitsform') {
      f.form = ARBEITSFORMEN.find((a) => a === x.form) ?? 'einzel'
      f.laut = LAUTSTAERKEN.find((a) => a === x.laut) ?? 'still'
    }
    if (art === 'geraeusch') f.grenze = typeof x.grenze === 'number' && Number.isFinite(x.grenze) ? Math.round(Math.min(GRENZE_MAX, Math.max(GRENZE_MIN, x.grenze))) : GRENZE_STANDARD
    if (typeof x.skala === 'number' && Number.isFinite(x.skala) && x.skala !== 1) {
      f.skala = rundeSkala(Math.min(SKALA_MAX, Math.max(SKALA_MIN, x.skala)))
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

// ---------- Ring um Timer und Stoppuhr ----------
/** Anteil des Timer-Rings, der noch steht (1 = volle Zeit, 0 = abgelaufen) */
export const timerAnteil = (rest: number, dauer: number): number => (dauer > 0 ? Math.min(1, Math.max(0, rest / dauer)) : 0)

/**
 * Farbe des Timers: „knapp“ (orange) in der letzten Minute – bei kurzen Timern im letzten Viertel –,
 * „fertig“ (rot) wenn die Zeit um ist, sonst „normal“.
 */
export function timerStufe(rest: number, dauer: number, fertig: boolean): 'normal' | 'knapp' | 'fertig' {
  if (fertig) return 'fertig'
  return rest > 0 && rest < dauer && rest <= Math.min(60_000, dauer / 4) ? 'knapp' : 'normal'
}

/** Der Ring der Stoppuhr läuft jede Minute einmal um (Anteil 0 … 1 der laufenden Minute) */
export const stoppAnteil = (ms: number): number => (Math.max(0, ms) % 60_000) / 60_000
