// Bilddateien für die Tafel vorbereiten: prüfen, zu große Bilder verkleinern, im Gerätespeicher ablegen.
// (Braucht einen echten Browser; in Tests wird dieses Modul ersetzt.)
import { speichereDatei } from '../speicher/dateien.ts'
import { merkeBildquelle } from './bildquellen.ts'

export const BILDARTEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
/** Längste Kante, mit der ein Bild gespeichert wird – größere werden verkleinert (Speicherplatz, Tempo) */
export const MAX_KANTE = 2400
export const MAX_DATEI = 40 * 1024 * 1024

export type FertigesBild = { dateiId: string; b: number; h: number }

/** Schülerseite: kleiner (längste Kante 1600), immer JPEG mit weißem Grund, höchstens `KOMPAKT_MAX` Byte – die Fotos gehen verschlüsselt über den Server */
export type BildOptionen = { maxKante?: number; kompakt?: boolean }
export const SCHUELER_BILD: BildOptionen = { maxKante: 1600, kompakt: true }
export const KOMPAKT_MAX = 1_200_000

export const istBilddatei = (d: { type: string }) => BILDARTEN.includes(d.type)

/** Canvas → Blob; JPEG für Fotos und PDF-Seiten (klein), PNG wo Durchsichtigkeit zählt */
export function alsBlob(canvas: HTMLCanvasElement, typ: 'image/png' | 'image/jpeg', guete = 0.9): Promise<Blob> {
  return new Promise((ok, fehler) => canvas.toBlob((b) => (b ? ok(b) : fehler(new Error('Das Bild lässt sich nicht speichern.'))), typ, guete))
}

/** Legt ein fertiges Canvas (z. B. eine PDF-Seite) als Datei ab. */
export async function speichereCanvas(canvas: HTMLCanvasElement, typ: 'image/png' | 'image/jpeg' = 'image/jpeg'): Promise<string> {
  const id = await speichereDatei(await alsBlob(canvas, typ))
  merkeBildquelle(id, await createImageBitmap(canvas))
  return id
}

/**
 * Nimmt eine Bilddatei (Auswahl, Zwischenablage, Hineinziehen) entgegen und legt sie im Gerätespeicher ab.
 * Wirft einen Fehler mit deutscher Meldung, wenn die Datei kein lesbares Bild ist.
 */
export async function nimmBild(datei: Blob, optionen: BildOptionen = {}): Promise<FertigesBild> {
  if (!istBilddatei(datei)) throw new Error('Diese Datei ist kein Bild (möglich sind PNG, JPEG, WebP, GIF, SVG).')
  if (datei.size > MAX_DATEI) throw new Error('Das Bild ist zu groß (höchstens 40 MB).')
  let bild: ImageBitmap
  try {
    bild = await createImageBitmap(datei)
  } catch {
    throw new Error('Das Bild lässt sich nicht lesen.')
  }
  const { width: b, height: h } = bild
  if (!b || !h) throw new Error('Das Bild lässt sich nicht lesen.')
  const f = Math.min(1, (optionen.maxKante ?? MAX_KANTE) / Math.max(b, h))
  // Kleine Bilder unverändert ablegen; große (und SVG, das sonst als Code gespeichert bliebe) neu zeichnen
  if (f === 1 && datei.type !== 'image/svg+xml' && !optionen.kompakt) {
    const dateiId = await speichereDatei(datei)
    merkeBildquelle(dateiId, bild)
    return { dateiId, b, h }
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(b * f)
  canvas.height = Math.round(h * f)
  const ctx = canvas.getContext('2d')!
  if (optionen.kompakt) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(bild, 0, 0, canvas.width, canvas.height)
  if (optionen.kompakt) {
    // JPEG; ist die Datei noch zu groß, wird die Güte schrittweise gesenkt
    let blob = await alsBlob(canvas, 'image/jpeg', 0.8)
    for (const g of [0.65, 0.5, 0.4]) {
      if (blob.size <= KOMPAKT_MAX) break
      blob = await alsBlob(canvas, 'image/jpeg', g)
    }
    if (blob.size > KOMPAKT_MAX) throw new Error('Das Bild ist zu groß. Bitte ein kleineres Bild nehmen.')
    const dateiId = await speichereDatei(blob)
    merkeBildquelle(dateiId, await createImageBitmap(canvas))
    return { dateiId, b: canvas.width, h: canvas.height }
  }
  const dateiId = await speichereCanvas(canvas, datei.type === 'image/jpeg' ? 'image/jpeg' : 'image/png')
  return { dateiId, b: canvas.width, h: canvas.height }
}
