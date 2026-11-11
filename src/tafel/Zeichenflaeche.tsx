// Die Zeichenfläche: nimmt Maus, Finger und Stift entgegen (Pointer Events) und zeichnet auf zwei Ebenen.
//   untere Ebene: alle fertigen Striche   ·   obere Ebene: der Strich, der gerade entsteht, und der Radierer-Kreis
// Regeln der Eingabe:
//   Stift und Maus zeichnen immer. Ein Finger zeichnet, bis einmal ein Stift benutzt wurde – danach verschiebt er
//   (Handballen-Schutz). Zwei Finger verschieben und zoomen immer. Mausrad verschiebt, Strg + Mausrad zoomt.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { breite, pfadAusPunkten, pfadAusUmriss, stiftUmriss, trifftStrich, verschiebe, zoomeUm, zuTafel } from '../kern/geometrie.ts'
import { MARKER_DECKKRAFT, neueId, type Element, type Kamera, type Strich, type Zeichenwerkzeug } from '../kern/modell.ts'

export type Werkzeug = Zeichenwerkzeug | 'radierer'

type Props = {
  elemente: Element[]
  kamera: Kamera
  werkzeug: Werkzeug
  farbe: string
  staerke: number
  beiStrich: (s: Strich) => void
  beiRadieren: (ids: string[]) => void
  beiKamera: (k: Kamera) => void
}

/** Radius des Radierers in Bildschirm-Pixeln */
const RADIERER_RADIUS = 14

type Aktiv =
  | { art: 'zeichnen'; zeiger: number; strich: Strich }
  | { art: 'radieren'; zeiger: number; ids: Set<string>; x: number; y: number }
  | { art: 'geste'; mitteX: number; mitteY: number; abstand: number }

const pfade = new WeakMap<Strich, Path2D>()
function pfad(s: Strich): Path2D {
  let p = pfade.get(s)
  if (!p) {
    p = new Path2D(s.werkzeug === 'marker' ? pfadAusPunkten(s) : pfadAusUmriss(stiftUmriss(s)))
    pfade.set(s, p)
  }
  return p
}

function zeichneStrich(ctx: CanvasRenderingContext2D, s: Strich, frisch = false) {
  // Der entstehende Strich ändert sich ständig – seinen Pfad nicht merken
  const p = frisch ? new Path2D(s.werkzeug === 'marker' ? pfadAusPunkten(s) : pfadAusUmriss(stiftUmriss(s))) : pfad(s)
  if (s.werkzeug === 'marker') {
    ctx.globalAlpha = MARKER_DECKKRAFT
    ctx.strokeStyle = s.farbe
    ctx.lineWidth = breite(s)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(p)
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = s.farbe
    ctx.fill(p)
  }
}

export function Zeichenflaeche({ elemente, kamera, werkzeug, farbe, staerke, beiStrich, beiRadieren, beiKamera }: Props) {
  const rahmen = useRef<HTMLDivElement>(null)
  const unten = useRef<HTMLCanvasElement>(null)
  const oben = useRef<HTMLCanvasElement>(null)
  const [groesse, setGroesse] = useState({ b: 0, h: 0, dpr: 1 })
  const [versteckt, setVersteckt] = useState<Set<string>>(new Set())

  // Aktuelle Werte für die Eingabe-Funktionen (die sich sonst bei jedem Zeichnen neu anmelden müssten)
  const stand = useRef({ elemente, kamera, werkzeug, farbe, staerke, versteckt })
  stand.current = { elemente, kamera, werkzeug, farbe, staerke, versteckt }

  const zeiger = useRef(new Map<number, { x: number; y: number; typ: string }>())
  const aktiv = useRef<Aktiv | null>(null)
  const stiftGesehen = useRef(false)

  // ---------- Größe der Fläche verfolgen ----------
  useLayoutEffect(() => {
    const el = rahmen.current
    if (!el) return
    const messen = () => setGroesse({ b: el.clientWidth, h: el.clientHeight, dpr: window.devicePixelRatio || 1 })
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [])

  /** Bereitet eine Ebene vor: leeren und Kamera einstellen. Liefert null, wenn es (noch) nichts zu zeichnen gibt. */
  function ebene(canvas: HTMLCanvasElement | null, k: Kamera) {
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return null
    const { dpr } = groesse
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(dpr * k.zoom, 0, 0, dpr * k.zoom, dpr * k.x, dpr * k.y)
    return ctx
  }

  // ---------- Untere Ebene: alle fertigen Striche ----------
  useEffect(() => {
    const ctx = ebene(unten.current, kamera)
    if (!ctx) return
    for (const s of elemente) if (!versteckt.has(s.id)) zeichneStrich(ctx, s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elemente, kamera, groesse, versteckt])

  function zeichneOben() {
    const k = stand.current.kamera
    const ctx = ebene(oben.current, k)
    const a = aktiv.current
    if (!ctx || !a) return
    if (a.art === 'zeichnen') zeichneStrich(ctx, a.strich, true)
    if (a.art === 'radieren') {
      const [x, y] = zuTafel(k, a.x, a.y)
      ctx.beginPath()
      ctx.arc(x, y, RADIERER_RADIUS / k.zoom, 0, Math.PI * 2)
      ctx.lineWidth = 2 / k.zoom
      ctx.strokeStyle = '#46557a'
      ctx.stroke()
    }
  }
  useEffect(zeichneOben)

  // ---------- Eingabe ----------
  function ort(e: { clientX: number; clientY: number }): [number, number] {
    const r = rahmen.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  const finger = () => [...zeiger.current.values()].filter((z) => z.typ === 'touch')

  function gesteBeginnen() {
    const f = finger()
    if (!f.length) {
      aktiv.current = null
      return
    }
    const a = f[0]
    const b = f[1] ?? a
    aktiv.current = { art: 'geste', mitteX: (a.x + b.x) / 2, mitteY: (a.y + b.y) / 2, abstand: Math.hypot(a.x - b.x, a.y - b.y) }
  }

  function radiere(a: Extract<Aktiv, { art: 'radieren' }>) {
    const k = stand.current.kamera
    const [x, y] = zuTafel(k, a.x, a.y)
    let neu = false
    for (const s of stand.current.elemente) {
      if (!a.ids.has(s.id) && trifftStrich(s, x, y, RADIERER_RADIUS / k.zoom)) {
        a.ids.add(s.id)
        neu = true
      }
    }
    if (neu) setVersteckt(new Set(a.ids))
  }

  function runter(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* manche Browser erlauben das nicht für jeden Zeiger */
    }
    const [x, y] = ort(e)
    zeiger.current.set(e.pointerId, { x, y, typ: e.pointerType })
    if (e.pointerType === 'pen') stiftGesehen.current = true

    if (e.pointerType === 'touch' && (stiftGesehen.current || finger().length >= 2)) {
      // Zweiter Finger während des Zeichnens: den angefangenen Strich verwerfen und verschieben/zoomen
      if (aktiv.current && aktiv.current.art !== 'geste') setVersteckt(new Set())
      gesteBeginnen()
      zeichneOben()
      return
    }
    if (aktiv.current) return // es wird schon mit einem anderen Zeiger gearbeitet

    const s = stand.current
    if (s.werkzeug === 'radierer') {
      const a: Aktiv = { art: 'radieren', zeiger: e.pointerId, ids: new Set(), x, y }
      aktiv.current = a
      radiere(a)
    } else {
      const [tx, ty] = zuTafel(s.kamera, x, y)
      const stift = e.pointerType === 'pen'
      aktiv.current = {
        art: 'zeichnen',
        zeiger: e.pointerId,
        strich: { art: 'strich', id: neueId(), werkzeug: s.werkzeug, farbe: s.farbe, staerke: s.staerke, druckEcht: stift, punkte: [[tx, ty, stift ? e.pressure || 0.5 : 0.5]] },
      }
    }
    zeichneOben()
  }

  function bewegt(e: ReactPointerEvent<HTMLDivElement>) {
    const z = zeiger.current.get(e.pointerId)
    const a = aktiv.current
    if (!z || !a) return
    const [x, y] = ort(e)
    z.x = x
    z.y = y

    if (a.art === 'geste') {
      const f = finger()
      if (!f.length) return
      const p = f[0]
      const q = f[1] ?? p
      const mitteX = (p.x + q.x) / 2
      const mitteY = (p.y + q.y) / 2
      const abstand = Math.hypot(p.x - q.x, p.y - q.y)
      let k = verschiebe(stand.current.kamera, mitteX - a.mitteX, mitteY - a.mitteY)
      if (f.length >= 2 && a.abstand > 0 && abstand > 0) k = zoomeUm(k, mitteX, mitteY, abstand / a.abstand)
      aktiv.current = { art: 'geste', mitteX, mitteY, abstand }
      stand.current.kamera = k
      beiKamera(k)
      return
    }
    if (a.zeiger !== e.pointerId) return

    if (a.art === 'radieren') {
      a.x = x
      a.y = y
      radiere(a)
    } else {
      // Zwischenpunkte, die der Browser zusammengefasst hat, mitnehmen (glattere Linien bei schnellem Stift)
      const k = stand.current.kamera
      const einzeln = e.nativeEvent.getCoalescedEvents?.() ?? []
      for (const ev of einzeln.length ? einzeln : [e.nativeEvent]) {
        const [sx, sy] = ort(ev)
        const [tx, ty] = zuTafel(k, sx, sy)
        const letzter = a.strich.punkte[a.strich.punkte.length - 1]
        if (Math.hypot(tx - letzter[0], ty - letzter[1]) * k.zoom < 0.5) continue
        a.strich.punkte.push([tx, ty, a.strich.druckEcht ? ev.pressure || letzter[2] : 0.5])
      }
    }
    zeichneOben()
  }

  function hoch(e: ReactPointerEvent<HTMLDivElement>, abgebrochen = false) {
    if (!zeiger.current.delete(e.pointerId)) return
    const a = aktiv.current
    if (!a) return

    if (a.art === 'geste') {
      gesteBeginnen() // mit den verbleibenden Fingern weiter – oder Ende
      return
    }
    if (a.zeiger !== e.pointerId) return
    aktiv.current = null

    if (a.art === 'zeichnen' && !abgebrochen) {
      // Den fertigen Strich sofort unten einzeichnen, damit er beim Leeren der oberen Ebene nicht kurz verschwindet
      const ctx = unten.current?.getContext('2d')
      if (ctx) zeichneStrich(ctx, a.strich)
      beiStrich(a.strich)
    }
    if (a.art === 'radieren') {
      if (a.ids.size && !abgebrochen) beiRadieren([...a.ids])
      setVersteckt(new Set())
    }
    zeichneOben()
  }

  // Mausrad: verschieben; mit Strg (oder Zwei-Finger-Zoom am Trackpad): zoomen
  useEffect(() => {
    const el = rahmen.current
    if (!el) return
    const rad = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const k = stand.current.kamera
      const neu = e.ctrlKey || e.metaKey ? zoomeUm(k, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01)) : verschiebe(k, -e.deltaX, -e.deltaY)
      stand.current.kamera = neu
      beiKamera(neu)
    }
    el.addEventListener('wheel', rad, { passive: false })
    return () => el.removeEventListener('wheel', rad)
  }, [beiKamera])

  const { b, h, dpr } = groesse
  return (
    <div
      ref={rahmen}
      className={'zeichenflaeche werkzeug-' + werkzeug}
      role="img"
      aria-label="Tafel – Zeichenfläche"
      data-testid="zeichenflaeche"
      onPointerDown={runter}
      onPointerMove={bewegt}
      onPointerUp={(e) => hoch(e)}
      onPointerCancel={(e) => hoch(e, true)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={unten} width={Math.round(b * dpr)} height={Math.round(h * dpr)} />
      <canvas ref={oben} width={Math.round(b * dpr)} height={Math.round(h * dpr)} />
    </div>
  )
}
