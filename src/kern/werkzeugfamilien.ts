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

/** Auf der Bühne (Präsentieren) zeigt die linke Leiste nur diese Familien */
export const BUEHNEN_FAMILIEN: readonly FamilienId[] = ['stift', 'radierer', 'laser']
