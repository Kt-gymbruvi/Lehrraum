// Werkzeugfamilien (Gestaltung „Atelier“): Die linke Leiste zeigt je Familie einen Knopf – mit dem Werkzeug, das
// in dieser Familie zuletzt benutzt wurde. Die anderen Werkzeuge der Familie stehen als Varianten in der Kapsel
// über der Tafel (z. B. Stift | Textmarker). Bild und Geometrie sind keine Werkzeuge und stehen außerhalb.
import type { Werkzeug } from './einstellungen.ts'

export type FamilienId = 'auswahl' | 'stift' | 'radierer' | 'text' | 'formen' | 'fuellen' | 'laser'
export type Familie = { id: FamilienId; glieder: readonly Werkzeug[] }

export const FAMILIEN: readonly Familie[] = [
  { id: 'auswahl', glieder: ['auswahl', 'hand'] },
  { id: 'stift', glieder: ['stift', 'marker'] },
  { id: 'radierer', glieder: ['radierer'] },
  { id: 'text', glieder: ['text', 'tabelle'] },
  { id: 'formen', glieder: ['rechteck', 'ellipse', 'linie', 'pfeil'] },
  { id: 'fuellen', glieder: ['fuellen'] },
  { id: 'laser', glieder: ['laser'] },
]

/** Zuletzt benutztes Werkzeug je Familie */
export type Zuletzt = Partial<Record<FamilienId, Werkzeug>>

export function familieVon(w: Werkzeug): Familie {
  return FAMILIEN.find((f) => f.glieder.includes(w)) ?? FAMILIEN[0]
}

/** Das Werkzeug, für das der Knopf der Familie steht */
export function vertreter(f: Familie, zuletzt: Zuletzt): Werkzeug {
  const w = zuletzt[f.id]
  return w && f.glieder.includes(w) ? w : f.glieder[0]
}

/** Merkt ein Werkzeug als zuletzt benutzt in seiner Familie (gibt bei keiner Änderung dasselbe Objekt zurück) */
export function merke(zuletzt: Zuletzt, w: Werkzeug): Zuletzt {
  const id = familieVon(w).id
  return zuletzt[id] === w ? zuletzt : { ...zuletzt, [id]: w }
}

/**
 * Auf der Bühne (Präsentieren) zeigt die linke Leiste nur diese Familien. Dazu gibt es eine schlanke Kapsel mit dem
 * Wesentlichen: Variante, Farbe, Stärke, Füllung/Pfeilspitzen der Formen, Art und Größe des Radierers (kein „Mehr“, keine Linienart).
 */
export const BUEHNEN_FAMILIEN: readonly FamilienId[] = ['stift', 'formen', 'radierer', 'laser']

/**
 * Was die Kapsel über der Tafel für ein Werkzeug zeigt – außer den Varianten der Familie, den eigenen Einstellungen
 * (Rechteck/Lasso, Art und Größe des Radierers, Füllung/Linienart/Spitzen der Formen) und „Einfügen/Leeren“.
 * Auswahl: Farbe und Stärke nur, wenn etwas ausgewählt ist (sie ändern dann die Auswahl).
 */
export function kapselInhalt(w: Werkzeug, gewaehlt: number): { farben: boolean; staerke: boolean; hinweis?: string } {
  switch (w) {
    case 'auswahl':
      return { farben: gewaehlt > 0, staerke: gewaehlt > 0 }
    case 'hand':
      return { farben: false, staerke: false, hinweis: 'Tafel verschieben – mit zwei Fingern zoomen' }
    case 'radierer':
      return { farben: false, staerke: false }
    case 'fuellen':
      return { farben: true, staerke: false }
    case 'laser':
      return { farben: false, staerke: false, hinweis: 'Zeigen – die Spur verschwindet von selbst' }
    default:
      return { farben: true, staerke: true }
  }
}
