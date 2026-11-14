// Einstellungen merken (E1): Werkzeug, Farbe, Stärke, Art und Größe des Radierers sind nach dem Neuladen so wie
// zuletzt – je Gerät und Browser, für alle Tafeln gemeinsam. (Die eigenen Farbplätze liegen getrennt, siehe farben.ts.)
// Reine Daten und Prüfung, kein Browser-Speicher.
import { begrenzeStaerke, istFarbwert, normiereFarbe } from './farben.ts'
import { FARBEN, FORMEN, STAERKEN, type Formart, type Zeichenwerkzeug } from './modell.ts'
import { RADIERER_ARTEN, RADIERER_GROESSEN, RADIERER_STANDARD, type Radierer } from './radieren.ts'

export type Werkzeug = 'auswahl' | 'hand' | Zeichenwerkzeug | 'radierer' | 'text' | 'tabelle' | Formart | 'laser'

/** Alle Werkzeuge, die gemerkt werden können (das Dreieck gibt es nur über das Begradigen, nicht als Werkzeug) */
const WERKZEUG_WERTE: readonly Werkzeug[] = ['auswahl', 'hand', 'stift', 'marker', 'radierer', 'text', 'tabelle', 'laser', ...FORMEN.filter((f) => f !== 'dreieck')]

export const EINSTELLUNGEN_SCHEMA = 'lehrraum/einstellungen'
export const EINSTELLUNGEN_VERSION = 1

export type Einstellungen = { werkzeug: Werkzeug; farbe: string; staerke: number; radierer: Radierer }

export const STANDARD_EINSTELLUNGEN: Einstellungen = { werkzeug: 'stift', farbe: FARBEN[0].wert, staerke: STAERKEN[1].wert, radierer: RADIERER_STANDARD }

/** Mit diesem Werkzeug beginnt die Tafel: Radierer, Laserpointer und Hand werden zum Stift (nach dem Laden will man schreiben) */
export const startWerkzeug = (w: Werkzeug): Werkzeug => (w === 'radierer' || w === 'laser' || w === 'hand' ? 'stift' : w)

/** Prüft gespeicherte Einstellungen; Unbekanntes oder Fehlendes wird durch die Voreinstellung ersetzt. */
export function pruefeEinstellungen(roh: unknown): Einstellungen {
  const s = STANDARD_EINSTELLUNGEN
  if (!roh || typeof roh !== 'object') return s
  const x = roh as Record<string, unknown>
  if (x.schema !== EINSTELLUNGEN_SCHEMA || x.version !== EINSTELLUNGEN_VERSION) return s
  const werkzeug = WERKZEUG_WERTE.includes(x.werkzeug as Werkzeug) ? startWerkzeug(x.werkzeug as Werkzeug) : s.werkzeug
  const farbe = istFarbwert(x.farbe) ? normiereFarbe(x.farbe) : s.farbe
  const staerke = typeof x.staerke === 'number' && Number.isFinite(x.staerke) ? begrenzeStaerke(x.staerke) : s.staerke
  const r = (x.radierer && typeof x.radierer === 'object' ? x.radierer : {}) as Record<string, unknown>
  const radierer: Radierer = {
    art: RADIERER_ARTEN.some((a) => a.wert === r.art) ? (r.art as Radierer['art']) : s.radierer.art,
    groesse: RADIERER_GROESSEN.some((g) => g.wert === r.groesse) ? (r.groesse as Radierer['groesse']) : s.radierer.groesse,
  }
  return { werkzeug, farbe, staerke, radierer }
}

/** Zum Speichern: mit Schema und Version */
export const neueEinstellungen = (e: Einstellungen) => ({ schema: EINSTELLUNGEN_SCHEMA, version: EINSTELLUNGEN_VERSION, werkzeug: e.werkzeug, farbe: e.farbe, staerke: e.staerke, radierer: { art: e.radierer.art, groesse: e.radierer.groesse } })
