// Muster als Hintergrund einer Seite (liniert, kariert, Koordinatensystem …): Namen, Gruppen und die Linien,
// Punkte und Beschriftungen, aus denen ein Muster in einem Bereich besteht. Reine Rechnung ohne Browser –
// gezeichnet wird in tafel/zeichnen.ts. Muster werden nie als Bild gespeichert und bleiben bei jedem Zoom scharf.
import type { Blatt } from './blatt.ts'
import type { Muster, Musterart } from './modell.ts'

export type Musterteil =
  | { art: 'linie'; x1: number; y1: number; x2: number; y2: number; farbe: string; breite: number }
  | { art: 'punkt'; x: number; y: number; r: number; farbe: string }
  | { art: 'text'; x: number; y: number; text: string; groesse: number; farbe: string; ausrichtung: 'links' | 'mitte' | 'rechts' }

/** [links, oben, rechts, unten] in Tafel-Koordinaten */
export type Bereich = [number, number, number, number]

type Angaben = {
  name: string
  gruppe: 'Allgemein' | 'Mathematik' | 'Sprachen, Musik, Ordnen'
  /** richtet sich am Blatt aus – gibt es nur in festen Formaten */
  nurBlatt?: boolean
  /** Abstand (eng, mittel, weit) in Tafel-Einheiten; fehlt: nicht einstellbar */
  abstand?: [number, number, number]
}

export const MUSTER: Record<Musterart, Angaben> = {
  liniert: { name: 'Liniert', gruppe: 'Allgemein', abstand: [40, 56, 72] },
  'liniert-rand': { name: 'Liniert mit Rand', gruppe: 'Allgemein', abstand: [40, 56, 72] },
  'kariert-klein': { name: 'Kariert klein', gruppe: 'Allgemein', abstand: [20, 26, 32] },
  'kariert-gross': { name: 'Kariert groß', gruppe: 'Allgemein', abstand: [48, 64, 80] },
  punkte: { name: 'Punkteraster', gruppe: 'Allgemein', abstand: [28, 40, 56] },
  lineatur: { name: 'Schreiblineatur', gruppe: 'Allgemein', abstand: [96, 128, 160] },
  millimeter: { name: 'Millimeterpapier', gruppe: 'Mathematik', abstand: [6, 8, 10] },
  'koordinaten-1': { name: 'Koordinaten (1. Quadrant)', gruppe: 'Mathematik', nurBlatt: true, abstand: [40, 50, 64] },
  'koordinaten-4': { name: 'Koordinaten (4 Quadranten)', gruppe: 'Mathematik', nurBlatt: true, abstand: [40, 50, 64] },
  isometrisch: { name: 'Isometrisch', gruppe: 'Mathematik', abstand: [28, 36, 48] },
  noten: { name: 'Notenlinien', gruppe: 'Sprachen, Musik, Ordnen', abstand: [10, 14, 18] },
  cornell: { name: 'Cornell-Notizen', gruppe: 'Sprachen, Musik, Ordnen', nurBlatt: true, abstand: [40, 56, 72] },
  'spalten-2': { name: 'Zwei Spalten', gruppe: 'Sprachen, Musik, Ordnen', nurBlatt: true },
  'spalten-3': { name: 'Drei Spalten', gruppe: 'Sprachen, Musik, Ordnen', nurBlatt: true },
  wochenplan: { name: 'Wochenplan', gruppe: 'Sprachen, Musik, Ordnen', nurBlatt: true },
}

export const MUSTERGRUPPEN = ['Allgemein', 'Mathematik', 'Sprachen, Musik, Ordnen'] as const

/** Linienfarben: so hell, dass Schrift in jeder Stiftfarbe deutlich darüber steht */
export const MUSTERFARBEN = { grau: '#c5cdd9', blau: '#a6c4e8' } as const
const RAND = '#e8a2a2'
const ACHSE = '#7d899c'
/** Beschriftung (Achsen, Spaltenköpfe) */
const SCHRIFTFARBE = '#8995a8'
const DUENN = 1.2
const KRAEFTIG = 2
/** Engere Linien als so viele Bildschirm-Pixel werden weggelassen (sonst nur grauer Brei und viel Arbeit) */
const MIN_PX = 3

export const abstandVon = (m: Muster): number => {
  const a = MUSTER[m.art].abstand
  if (!a) return 0
  return m.abstand === 'eng' ? a[0] : m.abstand === 'weit' ? a[2] : a[1]
}
export const farbeVon = (m: Muster): string => (m.farbe === 'blau' ? MUSTERFARBEN.blau : MUSTERFARBEN.grau)

/** Sind zwei Muster gleich? (beide fehlen = leeres Blatt) */
export const gleichesMuster = (a?: Muster, b?: Muster): boolean => (a?.art ?? '') === (b?.art ?? '') && a?.abstand === b?.abstand && a?.farbe === b?.farbe

/** Werte k·schritt + versatz, die im Bereich [von, bis] liegen (höchstens grenze viele) */
function raster(von: number, bis: number, schritt: number, versatz = 0, grenze = 2000): number[] {
  const werte: number[] = []
  for (let v = Math.ceil((von - versatz) / schritt) * schritt + versatz; v <= bis + 1e-9 && werte.length < grenze; v += schritt) werte.push(v)
  return werte
}

const waagrecht = (y: number, b: Bereich, farbe: string, breite = DUENN): Musterteil => ({ art: 'linie', x1: b[0], y1: y, x2: b[2], y2: y, farbe, breite })
const senkrecht = (x: number, b: Bereich, farbe: string, breite = DUENN): Musterteil => ({ art: 'linie', x1: x, y1: b[1], x2: x, y2: b[3], farbe, breite })
const text = (x: number, y: number, t: string, groesse: number, ausrichtung: 'links' | 'mitte' | 'rechts' = 'links'): Musterteil => ({ art: 'text', x, y, text: t, groesse, farbe: SCHRIFTFARBE, ausrichtung })

/** Versatz, mit dem ein Raster mittig auf dem Blatt sitzt (gleich breite Ränder) */
const mittig = (laenge: number, schritt: number) => (laenge % schritt) / 2

/**
 * Teile, aus denen das Muster im Bereich besteht. blatt: das Blatt (festes Format) oder null (unendliche Fläche –
 * Linienmuster laufen endlos weiter, Muster nur fürs Blatt entfallen). zoom: Bildschirm-Pixel je Tafel-Einheit.
 */
export function musterTeile(m: Muster, bereich: Bereich, blatt: Blatt | null, zoom: number): Musterteil[] {
  const angaben = MUSTER[m.art]
  if (angaben.nurBlatt && !blatt) return []
  const a = abstandVon(m)
  const farbe = farbeVon(m)
  // auf einem Blatt nur das Blatt füllen, sonst den sichtbaren Bereich
  const b: Bereich = blatt ? [Math.max(0, bereich[0]), Math.max(0, bereich[1]), Math.min(blatt[0], bereich[2]), Math.min(blatt[1], bereich[3])] : bereich
  if (b[2] <= b[0] || b[3] <= b[1]) return []
  const dicht = (schritt: number) => schritt * zoom < MIN_PX
  const teile: Musterteil[] = []

  switch (m.art) {
    case 'liniert':
    case 'liniert-rand': {
      if (dicht(a)) break
      // Auf dem Blatt bleibt oben eine Kopfzeile frei
      const start = blatt ? Math.max(b[1], 1.5 * a) : b[1]
      for (const y of raster(start, b[3], a)) teile.push(waagrecht(y, b, farbe))
      if (m.art === 'liniert-rand') teile.push(senkrecht(80, b, RAND, 1.5))
      break
    }
    case 'kariert-klein':
    case 'kariert-gross':
    case 'millimeter': {
      const vx = blatt ? mittig(blatt[0], a * (m.art === 'millimeter' ? 10 : 1)) : 0
      const vy = blatt ? mittig(blatt[1], a * (m.art === 'millimeter' ? 10 : 1)) : 0
      const stufe = (i: number) => (m.art !== 'millimeter' ? DUENN : i % 10 === 0 ? 1.6 : i % 5 === 0 ? 1.1 : 0.6)
      const ganz = m.art !== 'millimeter' || !dicht(a)
      const schritt = ganz ? a : a * 5 // zu fein: nur jede fünfte Linie des Millimeterpapiers
      if (dicht(schritt)) break
      for (const x of raster(b[0], b[2], schritt, vx)) teile.push(senkrecht(x, b, farbe, stufe(Math.round((x - vx) / a))))
      for (const y of raster(b[1], b[3], schritt, vy)) teile.push(waagrecht(y, b, farbe, stufe(Math.round((y - vy) / a))))
      break
    }
    case 'punkte': {
      if (dicht(a)) break
      const vx = blatt ? mittig(blatt[0], a) : 0
      const vy = blatt ? mittig(blatt[1], a) : 0
      const xs = raster(b[0], b[2], a, vx, 400)
      const ys = raster(b[1], b[3], a, vy, 400)
      for (const y of ys) for (const x of xs) teile.push({ art: 'punkt', x, y, r: 1.8, farbe: farbe === MUSTERFARBEN.grau ? '#aab4c3' : '#86aedd' })
      break
    }
    case 'lineatur': {
      // Je Zeile vier Linien: Ober-, Mittel-, Grund- und Unterlinie (Grundlinie kräftiger), dazwischen Abstand
      const r = a / 4.5
      if (dicht(r)) break
      const versatz = blatt ? 0.5 * a : 0
      for (const y of raster(b[1] - a, b[3], a, versatz)) {
        if (blatt && (y < 0.4 * a || y + 3 * r > blatt[1])) continue // nur ganze Zeilen aufs Blatt
        teile.push(waagrecht(y, b, farbe), waagrecht(y + r, b, farbe), waagrecht(y + 2 * r, b, ACHSE, 1.4), waagrecht(y + 3 * r, b, farbe))
      }
      break
    }
    case 'isometrisch': {
      // Dreiecksraster: senkrechte Linien und Linien unter ±30°
      const w = (a * Math.sqrt(3)) / 2
      if (dicht(w)) break
      const t = Math.tan(Math.PI / 6)
      for (const x of raster(b[0], b[2], w)) teile.push(senkrecht(x, b, farbe))
      for (const s of [t, -t]) {
        // y = s·x + c, c läuft in Schritten von a
        const cs = [b[1] - s * b[0], b[1] - s * b[2], b[3] - s * b[0], b[3] - s * b[2]]
        for (const c of raster(Math.min(...cs), Math.max(...cs), a)) teile.push({ art: 'linie', x1: b[0], y1: s * b[0] + c, x2: b[2], y2: s * b[2] + c, farbe, breite: DUENN })
      }
      break
    }
    case 'noten': {
      // Notensysteme: fünf Linien im Abstand a, von System zu System 12·a
      if (dicht(a)) break
      const hoehe = 12 * a
      const versatz = blatt ? mittig(blatt[1] - 4 * a, hoehe) : 0
      for (const y of raster(b[1] - 4 * a, b[3], hoehe, versatz)) for (let i = 0; i < 5; i++) if (y + i * a >= b[1] && y + i * a <= b[3]) teile.push(waagrecht(y + i * a, b, ACHSE, 1))
      break
    }
    case 'koordinaten-1':
    case 'koordinaten-4':
      if (blatt) teile.push(...koordinaten(m.art === 'koordinaten-4', a, blatt, farbe))
      break
    case 'cornell': {
      if (!blatt) break
      const [B, H] = blatt
      const spalte = Math.round(B * 0.3)
      const unten = Math.round(H * 0.78)
      const kopf = 1.5 * a
      if (!dicht(a)) for (const y of raster(kopf, unten - a / 2, a)) teile.push({ art: 'linie', x1: spalte, y1: y, x2: B, y2: y, farbe, breite: DUENN })
      teile.push({ art: 'linie', x1: spalte, y1: 0, x2: spalte, y2: unten, farbe: ACHSE, breite: 1.4 })
      teile.push(waagrecht(unten, [0, 0, B, H], ACHSE, 1.4))
      teile.push(text(16, 14, 'Stichworte', 18), text(spalte + 16, 14, 'Notizen', 18), text(16, unten + 14, 'Zusammenfassung', 18))
      break
    }
    case 'spalten-2':
    case 'spalten-3':
    case 'wochenplan': {
      if (!blatt) break
      const [B, H] = blatt
      const n = m.art === 'spalten-2' ? 2 : m.art === 'spalten-3' ? 3 : 5
      const kopf = m.art === 'wochenplan' ? 64 : 80
      teile.push(waagrecht(kopf, [0, 0, B, H], ACHSE, 1.4))
      for (let i = 1; i < n; i++) teile.push(senkrecht(Math.round((B * i) / n), [0, 0, B, H], ACHSE, 1.4))
      if (m.art === 'wochenplan')
        ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'].forEach((tag, i) => teile.push(text(((i + 0.5) * B) / n, 20, tag, 22, 'mitte')))
      break
    }
  }
  return teile
}

/** Koordinatensystem mit Gitter, Achsen, Pfeilen und Zahlen (Einheit u); vier Quadranten: Ursprung in der Mitte */
function koordinaten(vier: boolean, u: number, [B, H]: Blatt, farbe: string): Musterteil[] {
  const x0 = vier ? Math.round(B / 2 / u) * u : 2 * u
  const y0 = vier ? Math.round(H / 2 / u) * u : Math.floor((H - 1.5 * u) / u) * u
  const ganz: Bereich = [0, 0, B, H]
  const teile: Musterteil[] = []
  for (const x of raster(0, B, u, x0 % u)) teile.push(senkrecht(x, ganz, farbe))
  for (const y of raster(0, H, u, y0 % u)) teile.push(waagrecht(y, ganz, farbe))
  // Achsen mit Pfeilspitze (ein Stück vor dem Rand)
  const xEnde = B - u / 2
  const yEnde = u / 2
  const xStart = vier ? u / 2 : x0
  const yStart = vier ? H - u / 2 : y0
  const p = 12
  const achse = (x1: number, y1: number, x2: number, y2: number): Musterteil => ({ art: 'linie', x1, y1, x2, y2, farbe: ACHSE, breite: KRAEFTIG })
  teile.push(achse(xStart, y0, xEnde, y0), achse(xEnde, y0, xEnde - p, y0 - p / 1.6), achse(xEnde, y0, xEnde - p, y0 + p / 1.6))
  teile.push(achse(x0, yStart, x0, yEnde), achse(x0, yEnde, x0 - p / 1.6, yEnde + p), achse(x0, yEnde, x0 + p / 1.6, yEnde + p))
  teile.push(text(xEnde - 4, y0 + 10, 'x', 20, 'rechts'), text(x0 + 12, yEnde - 4, 'y', 20))
  // Zahlen an den Achsen (bei kleiner Einheit nur jede zweite)
  const jede = u < 45 ? 2 : 1
  for (let x = x0 + u * jede; x < xEnde - u / 2; x += u * jede) teile.push(text(x, y0 + 8, String(Math.round((x - x0) / u)), 15, 'mitte'))
  for (let x = x0 - u * jede; vier && x > u / 2; x -= u * jede) teile.push(text(x, y0 + 8, String(Math.round((x - x0) / u)), 15, 'mitte'))
  for (let y = y0 - u * jede; y > yEnde + u / 2; y -= u * jede) teile.push(text(x0 - 8, y - 8, String(Math.round((y0 - y) / u)), 15, 'rechts'))
  for (let y = y0 + u * jede; vier && y < H - u / 2; y += u * jede) teile.push(text(x0 - 8, y - 8, String(Math.round((y0 - y) / u)), 15, 'rechts'))
  teile.push(text(x0 - 8, y0 + 8, '0', 15, 'rechts'))
  return teile
}
