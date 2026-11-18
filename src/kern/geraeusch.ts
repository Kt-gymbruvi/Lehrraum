// Geräuschampel: aus den Messwerten des Mikrofons einen Pegel 0–100 machen und daraus Grün, Gelb oder Rot.
// Reine Funktionen. Gemessen wird nur auf dem Gerät; es wird nichts aufgenommen, gespeichert oder gesendet.

export type Ampelfarbe = 'gruen' | 'gelb' | 'rot'
export const AMPEL_NAMEN: Record<Ampelfarbe, string> = { gruen: 'Grün', gelb: 'Gelb', rot: 'Rot' }

/** Unterhalb davon (dBFS) gilt Stille: Pegel 0 */
const LEISESTE_DB = -70

/**
 * Pegel 0–100 aus einem Block Messwerte (−1 … 1): Effektivwert in Dezibel, −70 dB = 0, 0 dB = 100.
 * Leere Blöcke und Stille ergeben 0.
 */
export function pegel(werte: ArrayLike<number>): number {
  if (!werte.length) return 0
  let summe = 0
  for (let i = 0; i < werte.length; i++) summe += werte[i] * werte[i]
  const rms = Math.sqrt(summe / werte.length)
  if (!(rms > 0)) return 0
  const db = 20 * Math.log10(rms)
  return Math.round(Math.min(100, Math.max(0, ((db - LEISESTE_DB) / -LEISESTE_DB) * 100)))
}

/** Glättet den Pegel: steigt schnell, fällt langsam (sonst flackert die Anzeige bei jeder Silbe). */
export function glaette(alt: number, neu: number): number {
  const faktor = neu > alt ? 0.6 : 0.15
  return alt + (neu - alt) * faktor
}

/** Abstand der gelben Stufe unter der Grenze */
export const GELB_ABSTAND = 12
/** So lange (ms) muss es leiser bleiben, bis die Ampel wieder eine Stufe zurückschaltet */
export const ZURUECK_MS = 1500

export type Ampelstand = { farbe: Ampelfarbe; /** seit wann der Pegel unter der Stufe der jetzigen Farbe liegt (ms), sonst null */ leiserSeit: number | null }

const STUFE: Record<Ampelfarbe, number> = { gruen: 0, gelb: 1, rot: 2 }
const FARBE: Ampelfarbe[] = ['gruen', 'gelb', 'rot']

/** Welche Farbe der Pegel allein ergäbe */
export function farbeFuer(p: number, grenze: number): Ampelfarbe {
  if (p >= grenze) return 'rot'
  if (p >= grenze - GELB_ABSTAND) return 'gelb'
  return 'gruen'
}

/**
 * Nächster Stand der Ampel: Lauter wird sofort angezeigt, leiser erst, wenn es ZURUECK_MS lang leiser geblieben ist.
 * So bleibt Rot sichtbar und springt nicht bei jeder Atempause auf Grün.
 */
export function naechsteAmpel(stand: Ampelstand, p: number, grenze: number, jetzt: number): Ampelstand {
  const ziel = farbeFuer(p, grenze)
  if (STUFE[ziel] >= STUFE[stand.farbe]) return { farbe: ziel, leiserSeit: null }
  if (stand.leiserSeit === null) return { farbe: stand.farbe, leiserSeit: jetzt }
  if (jetzt - stand.leiserSeit < ZURUECK_MS) return stand
  // eine Stufe zurück; ist es noch leiser, folgt die nächste Stufe wieder erst nach der Wartezeit
  const eine = FARBE[STUFE[stand.farbe] - 1]
  return { farbe: eine, leiserSeit: STUFE[ziel] < STUFE[eine] ? jetzt : null }
}

export const AMPEL_START: Ampelstand = { farbe: 'gruen', leiserSeit: null }
