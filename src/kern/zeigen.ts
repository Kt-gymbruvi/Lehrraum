// Abdecken und Scheinwerfer: Ebenen über der Tafel, die nur verdecken – sie ändern nie die Tafel.
// Reine Funktionen; alle Maße in Bildschirm-Pixeln der Fläche. Nichts davon wird gespeichert.

/** Abdeckung: das verdeckte Rechteck (links, oben, rechts, unten) als Anteil der Fläche, 0 … 1 */
export type Abdeckung = { l: number; o: number; r: number; u: number }
export type Kante = 'l' | 'o' | 'r' | 'u'

/** Zu Beginn ist alles verdeckt */
export const GANZ_ABGEDECKT: Abdeckung = { l: 0, o: 0, r: 1, u: 1 }
/** So schmal (Anteil) wird die Abdeckung höchstens – sonst ließen sich ihre Griffe nicht mehr greifen */
export const ABDECKUNG_MIN = 0.06

const klemme = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))

/** Schiebt eine Kante der Abdeckung auf `anteil`; die gegenüberliegende Kante bleibt, der Rest wird mindestens ABDECKUNG_MIN breit. */
export function schiebeKante(a: Abdeckung, kante: Kante, anteil: number): Abdeckung {
  if (!Number.isFinite(anteil)) return a
  switch (kante) {
    case 'l':
      return { ...a, l: klemme(anteil, 0, a.r - ABDECKUNG_MIN) }
    case 'r':
      return { ...a, r: klemme(anteil, a.l + ABDECKUNG_MIN, 1) }
    case 'o':
      return { ...a, o: klemme(anteil, 0, a.u - ABDECKUNG_MIN) }
    case 'u':
      return { ...a, u: klemme(anteil, a.o + ABDECKUNG_MIN, 1) }
  }
}

/** Scheinwerfer: Mitte des hellen Kreises als Anteil der Fläche, Halbmesser in Pixeln */
export type Scheinwerfer = { x: number; y: number; r: number }
export const SCHEINWERFER_START: Scheinwerfer = { x: 0.5, y: 0.5, r: 140 }
export const SCHEINWERFER_MIN = 48

/** Hält den Kreis auf der Fläche (b × h Pixel) und in sinnvoller Größe */
export function begrenzeScheinwerfer(s: Scheinwerfer, b: number, h: number): Scheinwerfer {
  if (!(b > 0 && h > 0)) return s
  const r = Math.round(klemme(s.r, SCHEINWERFER_MIN, Math.max(SCHEINWERFER_MIN, Math.min(b, h) * 0.75)))
  return { x: klemme(s.x, 0, 1), y: klemme(s.y, 0, 1), r }
}

/**
 * Fläche mit Loch als SVG-Pfad (mit fill-rule „evenodd“): außen das Rechteck b × h, innen der Kreis.
 * Nur der dunkle Teil fängt Berührungen; durch das Loch sieht man die Tafel.
 */
export function scheinwerferPfad(s: Scheinwerfer, b: number, h: number): string {
  const cx = s.x * b
  const cy = s.y * h
  return `M0 0H${b}V${h}H0Z M${cx - s.r} ${cy}a${s.r} ${s.r} 0 1 0 ${2 * s.r} 0a${s.r} ${s.r} 0 1 0 ${-2 * s.r} 0Z`
}
