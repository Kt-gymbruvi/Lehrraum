// Seiten mit fester Größe („Blätter“ wie in einem Heft): Maße der Formate, Ansicht einpassen und begrenzen,
// Inhalt außerhalb des Blatts finden und aufs Blatt holen. Reine Funktionen, ohne React und ohne Browser.
import type { Befehl } from './befehle.ts'
import { gesamtRahmen, skaliert, verschoben } from './geometrie.ts'
import { hintergrundMass, ZOOM_MAX, type Format, type Kamera, type Seite } from './modell.ts'

/** Maße der Blätter in Tafel-Einheiten (bei Zoom 1 = Pixel); A4 bei 96 Punkten je Zoll */
export const FORMAT_MASS: Record<Exclude<Format, 'unendlich'>, [number, number]> = {
  '16:9': [1600, 900],
  'a4-hoch': [794, 1123],
  'a4-quer': [1123, 794],
}

export const FORMAT_NAME: Record<Format, string> = {
  '16:9': '16:9 (Bildschirm)',
  'a4-hoch': 'A4 hoch',
  'a4-quer': 'A4 quer',
  unendlich: 'Unendlich',
}

/** Abstand (Bildschirm-Pixel) zwischen eingepasstem Blatt und dem Rand der Fläche */
export const BLATT_RAND = 16
/** Abstand (Tafel-Einheiten), den eingepasster Inhalt vom Blattrand hält */
const INHALT_RAND = 24

export type Blatt = [number, number]

/**
 * Größe des Blatts einer Seite oder null (unendliche Fläche).
 * Eine Seite mit Hintergrund (PDF-Seite, Bild) behält dessen Größe – auch in einer Tafel mit festem Format.
 */
export function blattVon(format: Format, seite: Seite): Blatt | null {
  if (format === 'unendlich') return null
  if (seite.hintergrund) return hintergrundMass(seite.hintergrund)
  return FORMAT_MASS[format]
}

/** Zoom, bei dem das ganze Blatt in die Fläche passt */
export function passZoom(blatt: Blatt, flaecheB: number, flaecheH: number): number {
  return Math.min((flaecheB - 2 * BLATT_RAND) / blatt[0], (flaecheH - 2 * BLATT_RAND) / blatt[1])
}

/** Ansicht, die das ganze Blatt mittig zeigt */
export function eingepasst(blatt: Blatt, flaecheB: number, flaecheH: number): Kamera {
  const zoom = passZoom(blatt, flaecheB, flaecheH)
  return { zoom, x: (flaecheB - blatt[0] * zoom) / 2, y: (flaecheH - blatt[1] * zoom) / 2 }
}

/** Zeigt die Ansicht gerade genau das ganze Blatt (Zoom wie beim Einpassen)? */
export const istEingepasst = (k: Kamera, blatt: Blatt, flaecheB: number, flaecheH: number): boolean =>
  Math.abs(k.zoom - passZoom(blatt, flaecheB, flaecheH)) < 1e-6

/** Lage einer Achse: kleiner als die Fläche → mittig; größer → der Blattrand bleibt höchstens BLATT_RAND vom Flächenrand */
function achse(pos: number, groesse: number, flaeche: number): number {
  if (groesse + 2 * BLATT_RAND <= flaeche) return (flaeche - groesse) / 2
  return Math.min(BLATT_RAND, Math.max(flaeche - BLATT_RAND - groesse, pos))
}

/**
 * Begrenzt eine Ansicht auf das Blatt: nicht weiter heraus als „ganzes Blatt“, nicht weiter hinein als ZOOM_MAX,
 * und das Blatt bleibt im Bild. Ändert sich der Zoom, bleibt die Mitte der Fläche an ihrem Ort auf der Tafel.
 * Ohne Blatt (unendlich) oder ohne gemessene Fläche bleibt die Ansicht, wie sie ist.
 */
export function begrenzt(k: Kamera, blatt: Blatt | null, flaecheB: number, flaecheH: number): Kamera {
  if (!blatt || flaecheB <= 2 * BLATT_RAND || flaecheH <= 2 * BLATT_RAND) return k
  const min = passZoom(blatt, flaecheB, flaecheH)
  const zoom = Math.min(Math.max(min, ZOOM_MAX), Math.max(min, k.zoom))
  let { x, y } = k
  if (zoom !== k.zoom) {
    x = flaecheB / 2 - ((flaecheB / 2 - k.x) / k.zoom) * zoom
    y = flaecheH / 2 - ((flaecheH / 2 - k.y) / k.zoom) * zoom
  }
  const neu = { zoom, x: achse(x, blatt[0] * zoom, flaecheB), y: achse(y, blatt[1] * zoom, flaecheH) }
  return neu.x === k.x && neu.y === k.y && neu.zoom === k.zoom ? k : neu
}

/** Liegt der Punkt (Tafel-Koordinaten) auf dem Blatt? */
export const aufBlatt = (blatt: Blatt, x: number, y: number): boolean => x >= 0 && y >= 0 && x <= blatt[0] && y <= blatt[1]

/** Ragt Inhalt der Seite über das Blatt hinaus? (eine halbe Einheit Spielraum für Rundungen) */
export function ragtHinaus(seite: Seite, blatt: Blatt): boolean {
  const r = gesamtRahmen(seite.elemente)
  return !!r && (r[0] < -0.5 || r[1] < -0.5 || r[2] > blatt[0] + 0.5 || r[3] > blatt[1] + 0.5)
}

/** Wie viele Seiten hätten im Format Inhalt außerhalb ihres Blatts? */
export function seitenMitUeberstand(seiten: Seite[], format: Format): number {
  return seiten.filter((s) => {
    const b = blattVon(format, s)
    return !!b && ragtHinaus(s, b)
  }).length
}

/**
 * Holt den Inhalt einer Seite aufs Blatt: verkleinert ihn (nur wenn nötig, Strichstärke wächst mit) und schiebt ihn
 * so wenig wie möglich, bis er mit etwas Rand auf dem Blatt liegt. Liefert einen Befehl (rückgängig zu machen) oder null.
 */
export function aufsBlattBefehl(seite: Seite, blatt: Blatt): Befehl | null {
  if (!ragtHinaus(seite, blatt)) return null
  const r = gesamtRahmen(seite.elemente)!
  const [b, h] = [r[2] - r[0], r[3] - r[1]]
  const f = Math.min(1, (blatt[0] - 2 * INHALT_RAND) / b, (blatt[1] - 2 * INHALT_RAND) / h)
  const klein = f < 1 ? seite.elemente.map((e) => skaliert(e, r[0], r[1], f, f, true)) : seite.elemente
  const neu = gesamtRahmen(klein)!
  const lage = (von: number, bis: number, max: number) => Math.min(Math.max(von, INHALT_RAND), Math.max(INHALT_RAND, max - INHALT_RAND - (bis - von))) - von
  const dx = lage(neu[0], neu[2], blatt[0])
  const dy = lage(neu[1], neu[3], blatt[1])
  return { art: 'ersetzen', vorher: seite.elemente, nachher: klein.map((e) => verschoben(e, dx, dy)) }
}
