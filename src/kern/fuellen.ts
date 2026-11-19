// Füllwerkzeug: Antippen einer Fläche (Rechteck, Ellipse, Dreieck) füllt sie mit der gewählten Farbe.
// Ist sie schon in genau dieser Farbe gefüllt, wird die Füllung wieder weggenommen. Eine Form hat eine Farbe –
// Umriss und Füllung wechseln also zusammen. Reine Funktion; die Änderung läuft als Befehl „ersetzen“ (rückgängig machbar).
import { imInnern } from './geometrie.ts'
import type { Element, Form } from './modell.ts'

/** Die oberste Fläche, in der (x, y) liegt, und wie sie nach dem Füllen aussieht – oder null, wenn dort keine Fläche ist */
export function fuelleBei(elemente: Element[], x: number, y: number, farbe: string): { vorher: Form; nachher: Form } | null {
  for (let i = elemente.length - 1; i >= 0; i--) {
    const e = elemente[i]
    if (e.art !== 'form' || !imInnern(e, x, y)) continue
    if (e.gefuellt && e.farbe === farbe) {
      const { gefuellt: _weg, ...ohne } = e
      return { vorher: e, nachher: ohne }
    }
    return { vorher: e, nachher: { ...e, farbe, gefuellt: true } }
  }
  return null
}
