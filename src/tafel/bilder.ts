// Bilddateien für die Tafel vorbereiten: prüfen, zu große Bilder verkleinern, im Gerätespeicher ablegen.
// (Braucht einen echten Browser; in Tests wird dieses Modul ersetzt.)
import { speichereDatei } from '../speicher/dateien.ts'
import { merkeBildquelle } from './bildquellen.ts'

export const BILDARTEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
/** Längste Kante, mit der ein Bild gespeichert wird – größere werden verkleinert (Speicherplatz, Tempo) */
export const MAX_KANTE = 2400
export const MAX_DATEI = 40 * 1024 * 1024

export type FertigesBild = { dateiId: string; b: number; h: number }

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
export async function nimmBild(datei: Blob): Promise<FertigesBild> {
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
  const f = Math.min(1, MAX_KANTE / Math.max(b, h))
  // Kleine Bilder unverändert ablegen; große (und SVG, das sonst als Code gespeichert bliebe) neu zeichnen
  if (f === 1 && datei.type !== 'image/svg+xml') {
    const dateiId = await speichereDatei(datei)
    merkeBildquelle(dateiId, bild)
    return { dateiId, b, h }
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(b * f)
  canvas.height = Math.round(h * f)
  canvas.getContext('2d')!.drawImage(bild, 0, 0, canvas.width, canvas.height)
  const dateiId = await speichereCanvas(canvas, datei.type === 'image/jpeg' ? 'image/jpeg' : 'image/png')
  return { dateiId, b: canvas.width, h: canvas.height }
}
