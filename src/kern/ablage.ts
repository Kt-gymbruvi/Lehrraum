// Kopieren und Einfügen innerhalb von Lehrraum: Die Kopie (Ablage) gilt für alle Tafeln dieses Geräts, bleibt
// nach dem Neuladen erhalten und ersetzt jeweils die vorige. Sie geht nie in die Zwischenablage des Systems
// (Kopieren nach außen ist nicht vorgesehen) und liegt nur auf dem Gerät (speicher/datenbank.ts).
import { gesamtRahmen } from './geometrie.ts'
import { pruefeElemente, type Element } from './modell.ts'
import { kopiere } from './seiten.ts'

export const ABLAGE_SCHEMA = 'lehrraum/ablage'
/** Version der Ablage; die Elemente darin haben die Gestalt des Tafel-Datenmodells (Version 3) */
export const ABLAGE_VERSION = 1

export type Ablage = { schema: typeof ABLAGE_SCHEMA; version: typeof ABLAGE_VERSION; elemente: Element[] }

export const neueAblage = (elemente: Element[]): Ablage => ({ schema: ABLAGE_SCHEMA, version: ABLAGE_VERSION, elemente })

/** Prüft eine gespeicherte Ablage; ungültige Elemente fallen weg. Liefert null, wenn nichts Brauchbares darin ist. */
export function pruefeAblage(roh: unknown): Ablage | null {
  if (typeof roh !== 'object' || roh === null) return null
  const a = roh as Record<string, unknown>
  if (a.schema !== ABLAGE_SCHEMA || a.version !== ABLAGE_VERSION) return null
  const elemente = pruefeElemente(a.elemente)
  return elemente.length ? neueAblage(elemente) : null
}

/**
 * Die einzufügenden Elemente: Kopien mit neuen Kennungen (Gruppen bleiben Gruppen), so verschoben, dass ihre
 * Mitte bei (mx, my) liegt – der Mitte des sichtbaren Ausschnitts.
 */
export function einzufuegen(ablage: Ablage, mx: number, my: number): Element[] {
  const r = gesamtRahmen(ablage.elemente)
  if (!r) return []
  return kopiere(ablage.elemente, mx - (r[0] + r[2]) / 2, my - (r[1] + r[3]) / 2)
}
