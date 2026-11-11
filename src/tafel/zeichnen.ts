// Zeichnet Elemente der Tafel auf ein Canvas – für die Zeichenfläche und für den PDF-Export.
import { breite, pfadAusPunkten, pfadAusUmriss, pfeilspitze, stiftUmriss, ZEILENHOEHE } from '../kern/geometrie.ts'
import { MARKER_DECKKRAFT, type Element, type Hintergrund, type Seite, type Strich } from '../kern/modell.ts'
import { bildquelle } from './bildquellen.ts'

export const SCHRIFT = 'ui-rounded, "Nunito", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const pfade = new WeakMap<Strich, Path2D>()
const strichPfad = (s: Strich) => new Path2D(s.werkzeug === 'marker' ? pfadAusPunkten(s) : pfadAusUmriss(stiftUmriss(s)))

/** Bild einzeichnen; solange es noch lädt oder fehlt, ein grauer Platzhalter */
function zeichneBild(ctx: Ctx, dateiId: string, x: number, y: number, b: number, h: number) {
  const q = bildquelle(dateiId)
  if (q) {
    ctx.drawImage(q, x, y, b, h)
    return
  }
  ctx.fillStyle = '#eef1f6'
  ctx.fillRect(x, y, b, h)
  ctx.strokeStyle = '#cdd5e3'
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, b, h)
  if (q === null) {
    ctx.fillStyle = '#46557a'
    ctx.font = `20px ${SCHRIFT}`
    ctx.textBaseline = 'top'
    ctx.fillText('Bild fehlt auf diesem Gerät', x + 12, y + 12)
  }
}

export const zeichneHintergrund = (ctx: Ctx, h: Hintergrund) => zeichneBild(ctx, h.dateiId, 0, 0, h.b, h.h)

/** frisch = true: der Strich entsteht oder wird bewegt – seinen Pfad nicht merken */
export function zeichne(ctx: Ctx, e: Element, frisch = false) {
  if (e.art === 'bild') return zeichneBild(ctx, e.dateiId, e.x, e.y, e.b, e.h)
  if (e.art === 'text') {
    ctx.fillStyle = e.farbe
    ctx.font = `${e.groesse}px ${SCHRIFT}`
    ctx.textBaseline = 'top'
    e.text.split('\n').forEach((zeile, i) => ctx.fillText(zeile, e.x, e.y + (i * ZEILENHOEHE + (ZEILENHOEHE - 1) / 2) * e.groesse))
    return
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (e.art === 'form') {
    ctx.strokeStyle = e.farbe
    ctx.lineWidth = e.staerke
    ctx.beginPath()
    if (e.form === 'rechteck') ctx.rect(Math.min(e.x1, e.x2), Math.min(e.y1, e.y2), Math.abs(e.x2 - e.x1), Math.abs(e.y2 - e.y1))
    else if (e.form === 'ellipse') ctx.ellipse((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2, Math.abs(e.x2 - e.x1) / 2, Math.abs(e.y2 - e.y1) / 2, 0, 0, Math.PI * 2)
    else {
      ctx.moveTo(e.x1, e.y1)
      ctx.lineTo(e.x2, e.y2)
      if (e.form === 'pfeil') {
        const [a, b] = pfeilspitze(e)
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(e.x2, e.y2)
        ctx.lineTo(b[0], b[1])
      }
    }
    ctx.stroke()
    return
  }
  let p = frisch ? undefined : pfade.get(e)
  if (!p) {
    p = strichPfad(e)
    if (!frisch) pfade.set(e, p)
  }
  if (e.werkzeug === 'marker') {
    ctx.globalAlpha = MARKER_DECKKRAFT
    ctx.strokeStyle = e.farbe
    ctx.lineWidth = breite(e)
    ctx.stroke(p)
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = e.farbe
    ctx.fill(p)
  }
}

/** Zeichnet eine ganze Seite (weißer Grund, Hintergrund, Elemente). Bilder müssen vorher geladen sein. */
export function zeichneSeite(ctx: Ctx, s: Seite, ausschnitt: [number, number, number, number], massstab: number) {
  const [l, o, b, h] = ausschnitt
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, b * massstab, h * massstab)
  ctx.setTransform(massstab, 0, 0, massstab, -l * massstab, -o * massstab)
  if (s.hintergrund) zeichneHintergrund(ctx, s.hintergrund)
  for (const e of s.elemente) zeichne(ctx, e, true)
}
