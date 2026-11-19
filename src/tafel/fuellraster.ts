// Raster für das Füllwerkzeug: zeichnet alle Linien der Seite so, wie sie jetzt auf dem Bildschirm stehen, auf eine
// unsichtbare Fläche und merkt sich, wo etwas steht (1) und wo frei ist (0). Bilder (z. B. PDF-Seiten) und schon
// gefüllte Flächen zählen nicht als Linie; Formen zählen nur mit ihrem Umriss. Die Auswertung selbst ist reine
// Logik in kern/flaeche.ts.
import type { Element, Kamera } from '../kern/modell.ts'
import { zeichne } from './zeichnen.ts'

/** Ab dieser Deckkraft (von 255) zählt ein Pixel als Linie – auch der Rand der Kantenglättung und der Textmarker */
const SCHWELLE = 40

export function linienRaster(elemente: Element[], kamera: Kamera, b: number, h: number): Uint8Array | null {
  if (b < 2 || h < 2) return null
  try {
    const leinwand = document.createElement('canvas')
    leinwand.width = b
    leinwand.height = h
    const ctx = leinwand.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.setTransform(kamera.zoom, 0, 0, kamera.zoom, kamera.x, kamera.y)
    for (const e of elemente) {
      if (e.art === 'bild' || (e.art === 'strich' && e.flaeche)) continue
      if (e.art === 'form' && e.gefuellt) {
        const { gefuellt: _weg, ...umriss } = e
        zeichne(ctx, umriss, true)
      } else zeichne(ctx, e, true)
    }
    const pixel = ctx.getImageData(0, 0, b, h).data
    const sperre = new Uint8Array(b * h)
    for (let i = 0; i < sperre.length; i++) sperre[i] = pixel[i * 4 + 3] > SCHWELLE ? 1 : 0
    return sperre
  } catch {
    return null
  }
}
