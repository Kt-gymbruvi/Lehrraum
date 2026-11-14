// Zeichnet Elemente der Tafel auf ein Canvas – für die Zeichenfläche und für den PDF-Export.
import { breite, dreieckPunkte, drehungVon, pfadAusPunkten, pfadAusUmriss, pfeilspitze, rechteckEcken, stiftUmriss, ZEILENHOEHE } from '../kern/geometrie.ts'
import { hintergrundMass, MARKER_DECKKRAFT, type Element, type Hintergrund, type Seite, type Strich } from '../kern/modell.ts'
import { bildquelle } from './bildquellen.ts'
import { abschnitte, type Spur } from '../kern/laser.ts'

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

/** Hintergrund bei (0, 0); gedreht um seine Mitte, sodass auch die gedrehte Seite bei (0, 0) beginnt */
export function zeichneHintergrund(ctx: Ctx, h: Hintergrund) {
  if (!h.drehung) return zeichneBild(ctx, h.dateiId, 0, 0, h.b, h.h)
  const [b, hoehe] = hintergrundMass(h)
  ctx.save()
  ctx.translate(b / 2, hoehe / 2)
  ctx.rotate((h.drehung * Math.PI) / 180)
  zeichneBild(ctx, h.dateiId, -h.b / 2, -h.h / 2, h.b, h.h)
  ctx.restore()
}

/** Zeichnet etwas, das um (x, y) gedreht ist, so als stünde es gerade bei (0, 0) */
function gedrehtBei(ctx: Ctx, x: number, y: number, grad: number, tun: () => void) {
  ctx.save()
  ctx.translate(x, y)
  if (grad) ctx.rotate((grad * Math.PI) / 180)
  tun()
  ctx.restore()
}

/** Geschlossener Linienzug durch die Punkte */
function vieleck(ctx: Ctx, punkte: [number, number][]) {
  ctx.moveTo(punkte[0][0], punkte[0][1])
  for (const [x, y] of punkte.slice(1)) ctx.lineTo(x, y)
  ctx.closePath()
}

/** frisch = true: der Strich entsteht oder wird bewegt – seinen Pfad nicht merken */
export function zeichne(ctx: Ctx, e: Element, frisch = false) {
  if (e.art === 'bild') return gedrehtBei(ctx, e.x, e.y, drehungVon(e), () => zeichneBild(ctx, e.dateiId, 0, 0, e.b, e.h))
  if (e.art === 'text') {
    gedrehtBei(ctx, e.x, e.y, drehungVon(e), () => {
      ctx.fillStyle = e.farbe
      ctx.font = `${e.groesse}px ${SCHRIFT}`
      ctx.textBaseline = 'top'
      e.text.split('\n').forEach((zeile, i) => ctx.fillText(zeile, 0, (i * ZEILENHOEHE + (ZEILENHOEHE - 1) / 2) * e.groesse))
    })
    return
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (e.art === 'form') {
    ctx.strokeStyle = e.farbe
    ctx.lineWidth = e.staerke
    ctx.beginPath()
    if (e.form === 'rechteck') vieleck(ctx, rechteckEcken(e))
    else if (e.form === 'dreieck') vieleck(ctx, dreieckPunkte(e))
    else if (e.form === 'ellipse') ctx.ellipse((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2, Math.abs(e.x2 - e.x1) / 2, Math.abs(e.y2 - e.y1) / 2, (drehungVon(e) * Math.PI) / 180, 0, Math.PI * 2)
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
// ---------- Blatt (Tafel mit festem Format) ----------
/**
 * Zeichnet das weiße Blatt mit runden Ecken und feinem Schatten (Rundung und Schatten in Bildschirm-Pixeln,
 * unabhängig vom Zoom). Ohne shadowBlur – das kostet langsame Geräte bei jedem Verschieben zu viel Zeit.
 */
export function zeichneBlatt(ctx: Ctx, b: number, h: number, zoom: number) {
  const r = 14 / zoom
  ctx.save()
  for (const [abstand, deckkraft] of [[4, 0.035], [2, 0.05], [1, 0.07]] as const) {
    const a = abstand / zoom
    ctx.beginPath()
    ctx.roundRect(-a, -a + a / 2, b + 2 * a, h + 2 * a, r + a)
    ctx.fillStyle = `rgba(10, 45, 83, ${deckkraft})`
    ctx.fill()
  }
  ctx.beginPath()
  ctx.roundRect(0, 0, b, h, r)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()
}

/** Beschränkt alles weitere Zeichnen auf das Blatt (vorher ctx.save(), danach ctx.restore()) */
export function schneideAufBlatt(ctx: Ctx, b: number, h: number, zoom: number) {
  ctx.beginPath()
  ctx.roundRect(0, 0, b, h, 14 / zoom)
  ctx.clip()
}

export function zeichneSeite(ctx: Ctx, s: Seite, ausschnitt: [number, number, number, number], massstab: number) {
  const [l, o, b, h] = ausschnitt
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, b * massstab, h * massstab)
  ctx.setTransform(massstab, 0, 0, massstab, -l * massstab, -o * massstab)
  if (s.hintergrund) zeichneHintergrund(ctx, s.hintergrund)
  for (const e of s.elemente) zeichne(ctx, e, true)
}

// ---------- Laserpointer (nur auf der Zeichenfläche, nie im PDF) ----------
/**
 * Schichten des Leuchtens von außen nach innen: weicher roter Schein, kräftiges Rot, fast weißer heißer Kern –
 * so wirkt die Spur wie ein echter Laserstrahl. Breiten in Bildschirm-Pixeln (unabhängig vom Zoom). Bewusst ohne
 * shadowBlur: der kostet langsame Geräte wie ein SMART Board zu viel Zeit.
 */
const LASER_SCHICHTEN = [
  { breite: 30, farbe: 'rgba(255, 25, 35, 0.1)' },
  { breite: 17, farbe: 'rgba(255, 30, 40, 0.22)' },
  { breite: 9, farbe: 'rgba(255, 40, 50, 0.85)' },
  { breite: 3, farbe: 'rgba(255, 246, 246, 0.95)' },
]

/** Zeichnet die Spuren als leuchtenden Schweif (dünner und blasser zum Ende hin) und den Leuchtpunkt an der Spitze */
export function zeichneLaser(ctx: Ctx, spuren: Spur[], jetzt: number, zoom: number, punkt: { x: number; y: number; hell: number } | null) {
  const stuecke = spuren.flatMap((s) => abschnitte(s, jetzt))
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const schicht of LASER_SCHICHTEN) {
    ctx.strokeStyle = schicht.farbe
    for (const st of stuecke) {
      ctx.globalAlpha = st.leben
      ctx.lineWidth = (schicht.breite * (0.25 + 0.75 * st.leben)) / zoom
      ctx.beginPath()
      st.punkte.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.stroke()
    }
  }
  if (punkt && punkt.hell > 0) {
    const r = 18 / zoom
    const g = ctx.createRadialGradient(punkt.x, punkt.y, 0, punkt.x, punkt.y, r)
    if (g) {
      g.addColorStop(0, 'rgba(255, 255, 255, 1)')
      g.addColorStop(0.16, 'rgba(255, 236, 236, 1)')
      g.addColorStop(0.3, 'rgba(255, 45, 55, 0.95)')
      g.addColorStop(0.55, 'rgba(255, 35, 45, 0.3)')
      g.addColorStop(1, 'rgba(255, 30, 40, 0)')
      ctx.globalAlpha = punkt.hell
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(punkt.x, punkt.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}
