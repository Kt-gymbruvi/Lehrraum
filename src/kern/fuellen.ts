// Füllwerkzeug: Antippen füllt eine Fläche mit der gewählten Farbe.
//  · Ein einzelnes Rechteck, Ellipse oder Dreieck (nichts anderes darin oder darüber): die Form wird ausgefüllt.
//  · Sonst jede in sich geschlossene Fläche, auch von Hand gezeichnet: eine gefüllte Fläche (Strich mit `flaeche`)
//    entsteht unter den Linien – ihren Umriss liefert die Zeichenfläche aus einem Raster (kern/flaeche.ts).
// Ist die Fläche schon in genau dieser Farbe gefüllt, wird die Füllung wieder weggenommen; eine andere Farbe färbt um.
// Eine Form oder Fläche hat eine Farbe – Umriss und Füllung wechseln also zusammen. Reine Funktionen; jede
// Änderung läuft als Befehl (rückgängig machbar).
import type { Befehl } from './befehle.ts'
import { flaecheInhalt, neueFlaeche, type Ring } from './flaeche.ts'
import { imInnern, imVieleck, rahmen } from './geometrie.ts'
import type { Element, Form, Strich } from './modell.ts'

/** Die oberste Fläche (Rechteck, Ellipse, Dreieck), in der (x, y) liegt, und wie sie nach dem Füllen aussieht */
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

const istFlaeche = (e: Element): e is Strich => e.art === 'strich' && e.flaeche === true
const ueberlappt = (a: [number, number, number, number], b: [number, number, number, number]) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]

/**
 * Gilt der Tipp einer einzelnen Form, in oder an der nichts anderes liegt (außer gefüllten Flächen und Bildern)?
 * Dann wird die Form selbst gefüllt – sie wächst und wandert dann mit. Sonst null.
 */
export function formAllein(elemente: Element[], x: number, y: number, farbe: string): { vorher: Form; nachher: Form } | null {
  const f = fuelleBei(elemente, x, y, farbe)
  if (!f) return null
  const r = rahmen(f.vorher)
  const andere = elemente.some((e) => e.id !== f.vorher.id && e.art !== 'bild' && !istFlaeche(e) && ueberlappt(rahmen(e), r))
  return andere ? null : f
}

/** Die oberste gefüllte Fläche, in der (x, y) liegt */
export function flaecheBei(elemente: Element[], x: number, y: number): Strich | null {
  for (let i = elemente.length - 1; i >= 0; i--) {
    const e = elemente[i]
    if (istFlaeche(e) && imVieleck(e, x, y)) return e
  }
  return null
}

/** Wohin eine neue gefüllte Fläche kommt: über Bilder und frühere Flächen, unter alle Linien und alles Übrige */
export function stelleFuerFlaeche(elemente: Element[]): number {
  let n = 0
  while (n < elemente.length && (elemente[n].art === 'bild' || istFlaeche(elemente[n]))) n++
  return n
}

/** Wie nah der Inhalt einer neuen Fläche an dem einer bestehenden liegen muss, damit es dieselbe Fläche ist */
const GLEICH = 0.12

/**
 * Entscheidet, was das Füllen an (x, y) tut, wenn die Zeichenfläche den Umriss ermittelt hat (ringe) oder nicht (null).
 * rand: Breite des Randes, der unter die Linien reicht (Tafel-Einheiten).
 * Ergebnis: ein Befehl – oder null, wenn dort nichts zu füllen ist (offene Fläche, kein Umriss).
 */
export function fuelleFlaeche(elemente: Element[], x: number, y: number, farbe: string, ringe: { aussen: Ring; loecher: Ring[] } | null, rand: number): Befehl | null {
  const alt = flaecheBei(elemente, x, y)
  const neu = ringe ? neueFlaeche(ringe.aussen, ringe.loecher, farbe, rand) : null
  // Dieselbe Fläche wie eine schon gefüllte (oder nicht zu ermitteln, aber dort gefüllt): umfärben oder Füllung wegnehmen
  if (alt && (!neu || Math.abs(flaecheInhalt(neu) - flaecheInhalt(alt)) <= GLEICH * flaecheInhalt(alt))) {
    if (alt.farbe === farbe) return { art: 'entfernen', eintraege: [{ stelle: elemente.indexOf(alt), element: alt }] }
    return { art: 'ersetzen', vorher: [alt], nachher: [{ ...alt, farbe }] }
  }
  if (!neu) return null
  return { art: 'hinzufuegen', elemente: [neu], stelle: stelleFuerFlaeche(elemente) }
}
