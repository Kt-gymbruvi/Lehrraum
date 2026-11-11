// Die Zeichenfläche: nimmt Maus, Finger und Stift entgegen (Pointer Events) und zeichnet auf zwei Ebenen.
//   untere Ebene: alle fertigen Elemente   ·   obere Ebene: was gerade entsteht oder bewegt wird, Auswahlrahmen, Radierer
// Regeln der Eingabe:
//   Stift und Maus arbeiten immer mit dem gewählten Werkzeug. Ein Finger tut das auch, bis einmal ein Stift
//   benutzt wurde – danach verschiebt er die Ansicht (Handballen-Schutz). Zwei Finger verschieben und zoomen immer.
//   Mausrad verschiebt, Strg + Mausrad zoomt. Mit dem Auswahlwerkzeug verschiebt Ziehen auf freier Fläche die Ansicht.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { breite, gesamtRahmen, oberstesBei, pfadAusPunkten, pfadAusUmriss, pfeilspitze, stiftUmriss, trifft, verschiebe, verschoben, ZEILENHOEHE, zoomeUm, zuTafel } from '../kern/geometrie.ts'
import { MARKER_DECKKRAFT, MAX_TEXT, neueId, schriftgroesse, type Element, type Form, type Formart, type Kamera, type Strich, type Text, type Zeichenwerkzeug } from '../kern/modell.ts'

export type Werkzeug = 'auswahl' | Zeichenwerkzeug | 'radierer' | 'text' | Formart

type Props = {
  elemente: Element[]
  kamera: Kamera
  werkzeug: Werkzeug
  farbe: string
  staerke: number
  /** Kennungen der ausgewählten Elemente */
  auswahl: string[]
  beiHinzu: (e: Element) => void
  beiRadieren: (ids: string[]) => void
  beiErsetzen: (vorher: Element[], nachher: Element[]) => void
  beiAuswahl: (ids: string[]) => void
  beiKamera: (k: Kamera) => void
}

/** Radius des Radierers und Fangradius der Auswahl in Bildschirm-Pixeln */
const RADIERER_RADIUS = 14
const FANG_RADIUS = 8
const DOPPELTIPP_MS = 450
export const SCHRIFT = 'ui-rounded, "Nunito", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

type Aktiv =
  | { art: 'zeichnen'; zeiger: number; strich: Strich }
  | { art: 'form'; zeiger: number; form: Form }
  | { art: 'radieren'; zeiger: number; ids: Set<string>; x: number; y: number }
  | { art: 'ziehen'; zeiger: number; startX: number; startY: number; originale: Element[]; dx: number; dy: number }
  | { art: 'schwenken'; zeiger: number; x: number; y: number }
  | { art: 'geste'; mitteX: number; mitteY: number; abstand: number }

type Editor = { id: string | null; x: number; y: number; groesse: number; farbe: string; text: string; vorher: Text | null }

/** Wurde in dieser Sitzung schon ein Stift benutzt? Dann verschieben Finger nur noch (gilt über Seitenwechsel hinweg). */
let stiftGesehen = false
/** Nur für Tests: den Handballen-Schutz zurücksetzen */
export const vergissStift = () => {
  stiftGesehen = false
}

const pfade = new WeakMap<Strich, Path2D>()
const strichPfad = (s: Strich) => new Path2D(s.werkzeug === 'marker' ? pfadAusPunkten(s) : pfadAusUmriss(stiftUmriss(s)))

function zeichne(ctx: CanvasRenderingContext2D, e: Element, frisch = false) {
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
  // Der entstehende oder bewegte Strich ändert sich ständig – seinen Pfad nicht merken
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

export function Zeichenflaeche({ elemente, kamera, werkzeug, farbe, staerke, auswahl, beiHinzu, beiRadieren, beiErsetzen, beiAuswahl, beiKamera }: Props) {
  const rahmen = useRef<HTMLDivElement>(null)
  const unten = useRef<HTMLCanvasElement>(null)
  const oben = useRef<HTMLCanvasElement>(null)
  const [groesse, setGroesse] = useState({ b: 0, h: 0, dpr: 1 })
  const [versteckt, setVersteckt] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<Editor | null>(null)

  // Aktuelle Werte für die Eingabe-Funktionen (die sich sonst bei jedem Zeichnen neu anmelden müssten)
  const stand = useRef({ elemente, kamera, werkzeug, farbe, staerke, auswahl, editor })
  stand.current = { elemente, kamera, werkzeug, farbe, staerke, auswahl, editor }

  const zeiger = useRef(new Map<number, { x: number; y: number; typ: string }>())
  const aktiv = useRef<Aktiv | null>(null)
  const letzterTipp = useRef<{ id: string; zeit: number } | null>(null)

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

  // ---------- Untere Ebene: alle fertigen Elemente ----------
  useEffect(() => {
    const ctx = ebene(unten.current, kamera)
    if (!ctx) return
    for (const e of elemente) if (!versteckt.has(e.id)) zeichne(ctx, e)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elemente, kamera, groesse, versteckt])

  function zeichneOben() {
    const s = stand.current
    const k = s.kamera
    const ctx = ebene(oben.current, k)
    if (!ctx) return
    const a = aktiv.current
    if (a?.art === 'zeichnen') zeichne(ctx, a.strich, true)
    if (a?.art === 'form') zeichne(ctx, a.form)
    if (a?.art === 'radieren') {
      const [x, y] = zuTafel(k, a.x, a.y)
      ctx.beginPath()
      ctx.arc(x, y, RADIERER_RADIUS / k.zoom, 0, Math.PI * 2)
      ctx.lineWidth = 2 / k.zoom
      ctx.strokeStyle = '#46557a'
      ctx.stroke()
    }
    const bewegt = a?.art === 'ziehen' ? a.originale.map((e) => verschoben(e, a.dx, a.dy)) : null
    bewegt?.forEach((e) => zeichne(ctx, e, true))
    // Auswahlrahmen
    const gewaehlt = bewegt ?? s.elemente.filter((e) => s.auswahl.includes(e.id) && e.id !== s.editor?.id)
    const r = gesamtRahmen(gewaehlt)
    if (r) {
      const rand = 6 / k.zoom
      ctx.setLineDash([8 / k.zoom, 6 / k.zoom])
      ctx.lineWidth = 2 / k.zoom
      ctx.strokeStyle = '#1d5fd1'
      ctx.strokeRect(r[0] - rand, r[1] - rand, r[2] - r[0] + 2 * rand, r[3] - r[1] + 2 * rand)
      ctx.setLineDash([])
    }
  }
  useEffect(zeichneOben)

  // ---------- Text schreiben ----------
  function oeffneEditor(e: Editor) {
    if (e.id) setVersteckt(new Set([e.id]))
    setEditor(e)
  }
  /** Übernimmt den Text aus dem Eingabefeld auf die Tafel (oder verwirft ihn). */
  function schliesseEditor(uebernehmen = true) {
    const e = stand.current.editor
    if (!e) return
    setEditor(null)
    setVersteckt(new Set())
    if (!uebernehmen) return
    const text = e.text.replace(/\s+$/, '')
    if (e.vorher) {
      if (!text.trim()) beiRadieren([e.vorher.id])
      else if (text !== e.vorher.text) beiErsetzen([e.vorher], [{ ...e.vorher, text }])
    } else if (text.trim()) {
      const neu: Text = { art: 'text', id: neueId(), x: e.x, y: e.y, text, groesse: e.groesse, farbe: e.farbe }
      beiHinzu(neu)
      beiAuswahl([neu.id])
    }
  }
  const bearbeite = (t: Text) => oeffneEditor({ id: t.id, x: t.x, y: t.y, groesse: t.groesse, farbe: t.farbe, text: t.text, vorher: t })

  // Werkzeugwechsel beendet das Schreiben
  useEffect(() => {
    if (werkzeug !== 'text' && werkzeug !== 'auswahl') schliesseEditor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [werkzeug])

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
    for (const e of stand.current.elemente) {
      if (!a.ids.has(e.id) && trifft(e, x, y, RADIERER_RADIUS / k.zoom)) {
        a.ids.add(e.id)
        neu = true
      }
    }
    if (neu) setVersteckt(new Set(a.ids))
  }

  function runter(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return // im Eingabefeld: normales Tippen und Markieren
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    if (stand.current.editor) {
      schliesseEditor() // Tippen neben das Eingabefeld übernimmt den Text
      return
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* manche Browser erlauben das nicht für jeden Zeiger */
    }
    const [x, y] = ort(e)
    zeiger.current.set(e.pointerId, { x, y, typ: e.pointerType })
    if (e.pointerType === 'pen') stiftGesehen = true

    if (e.pointerType === 'touch' && (stiftGesehen || finger().length >= 2)) {
      // Zweiter Finger während der Arbeit: das Angefangene verwerfen und verschieben/zoomen
      if (aktiv.current && aktiv.current.art !== 'geste') setVersteckt(new Set())
      gesteBeginnen()
      zeichneOben()
      return
    }
    if (aktiv.current) return // es wird schon mit einem anderen Zeiger gearbeitet

    const s = stand.current
    const [tx, ty] = zuTafel(s.kamera, x, y)
    const fang = FANG_RADIUS / s.kamera.zoom
    const w = s.werkzeug

    if (w === 'radierer') {
      const a: Aktiv = { art: 'radieren', zeiger: e.pointerId, ids: new Set(), x, y }
      aktiv.current = a
      radiere(a)
    } else if (w === 'auswahl') {
      const treffer = oberstesBei(s.elemente, tx, ty, fang)
      if (!treffer) {
        beiAuswahl([])
        aktiv.current = { art: 'schwenken', zeiger: e.pointerId, x, y }
      } else {
        const jetzt = Date.now()
        const doppelt = letzterTipp.current?.id === treffer.id && jetzt - letzterTipp.current.zeit < DOPPELTIPP_MS
        letzterTipp.current = { id: treffer.id, zeit: jetzt }
        if (doppelt && treffer.art === 'text') {
          zeiger.current.delete(e.pointerId)
          beiAuswahl([treffer.id])
          bearbeite(treffer)
          return
        }
        const ids = s.auswahl.includes(treffer.id) ? s.auswahl : [treffer.id]
        if (ids !== s.auswahl) beiAuswahl(ids)
        aktiv.current = { art: 'ziehen', zeiger: e.pointerId, startX: tx, startY: ty, originale: s.elemente.filter((el) => ids.includes(el.id)), dx: 0, dy: 0 }
      }
    } else if (w === 'text') {
      zeiger.current.delete(e.pointerId)
      const treffer = oberstesBei(s.elemente.filter((el) => el.art === 'text'), tx, ty, fang)
      if (treffer?.art === 'text') bearbeite(treffer)
      else oeffneEditor({ id: null, x: tx, y: ty - schriftgroesse(s.staerke) * 0.6, groesse: schriftgroesse(s.staerke), farbe: s.farbe, text: '', vorher: null })
      return
    } else if (w === 'stift' || w === 'marker') {
      const stift = e.pointerType === 'pen'
      aktiv.current = {
        art: 'zeichnen',
        zeiger: e.pointerId,
        strich: { art: 'strich', id: neueId(), werkzeug: w, farbe: s.farbe, staerke: s.staerke, druckEcht: stift, punkte: [[tx, ty, stift ? e.pressure || 0.5 : 0.5]] },
      }
    } else {
      aktiv.current = { art: 'form', zeiger: e.pointerId, form: { art: 'form', id: neueId(), form: w, x1: tx, y1: ty, x2: tx, y2: ty, farbe: s.farbe, staerke: s.staerke } }
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
    const k = stand.current.kamera

    if (a.art === 'geste') {
      const f = finger()
      if (!f.length) return
      const p = f[0]
      const q = f[1] ?? p
      const mitteX = (p.x + q.x) / 2
      const mitteY = (p.y + q.y) / 2
      const abstand = Math.hypot(p.x - q.x, p.y - q.y)
      let neu = verschiebe(k, mitteX - a.mitteX, mitteY - a.mitteY)
      if (f.length >= 2 && a.abstand > 0 && abstand > 0) neu = zoomeUm(neu, mitteX, mitteY, abstand / a.abstand)
      aktiv.current = { art: 'geste', mitteX, mitteY, abstand }
      stand.current.kamera = neu
      beiKamera(neu)
      return
    }
    if (a.zeiger !== e.pointerId) return
    const [tx, ty] = zuTafel(k, x, y)

    if (a.art === 'schwenken') {
      const neu = verschiebe(k, x - a.x, y - a.y)
      a.x = x
      a.y = y
      stand.current.kamera = neu
      beiKamera(neu)
      return
    }
    if (a.art === 'radieren') {
      a.x = x
      a.y = y
      radiere(a)
    } else if (a.art === 'ziehen') {
      const erstmals = a.dx === 0 && a.dy === 0
      a.dx = tx - a.startX
      a.dy = ty - a.startY
      if (erstmals && (a.dx !== 0 || a.dy !== 0)) setVersteckt(new Set(a.originale.map((el) => el.id)))
    } else if (a.art === 'form') {
      a.form.x2 = tx
      a.form.y2 = ty
    } else {
      // Zwischenpunkte, die der Browser zusammengefasst hat, mitnehmen (glattere Linien bei schnellem Stift)
      const einzeln = e.nativeEvent.getCoalescedEvents?.() ?? []
      for (const ev of einzeln.length ? einzeln : [e.nativeEvent]) {
        const [sx, sy] = ort(ev)
        const [px, py] = zuTafel(k, sx, sy)
        const letzter = a.strich.punkte[a.strich.punkte.length - 1]
        if (Math.hypot(px - letzter[0], py - letzter[1]) * k.zoom < 0.5) continue
        a.strich.punkte.push([px, py, a.strich.druckEcht ? ev.pressure || letzter[2] : 0.5])
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
    const k = stand.current.kamera
    // Fertiges sofort unten einzeichnen, damit es beim Leeren der oberen Ebene nicht kurz verschwindet
    const fest = (el: Element) => {
      const ctx = unten.current?.getContext('2d')
      if (ctx) zeichne(ctx, el)
    }

    if (a.art === 'zeichnen' && !abgebrochen) {
      fest(a.strich)
      beiHinzu(a.strich)
    }
    if (a.art === 'form' && !abgebrochen && Math.hypot(a.form.x2 - a.form.x1, a.form.y2 - a.form.y1) * k.zoom >= 4) {
      fest(a.form)
      beiHinzu(a.form)
    }
    if (a.art === 'radieren') {
      if (a.ids.size && !abgebrochen) beiRadieren([...a.ids])
      setVersteckt(new Set())
    }
    if (a.art === 'ziehen') {
      if (!abgebrochen && Math.hypot(a.dx, a.dy) * k.zoom >= 2) {
        const neu = a.originale.map((el) => verschoben(el, a.dx, a.dy))
        neu.forEach(fest)
        beiErsetzen(a.originale, neu)
      }
      setVersteckt(new Set())
    }
    zeichneOben()
  }

  // Mausrad: verschieben; mit Strg (oder Zwei-Finger-Zoom am Trackpad): zoomen
  useEffect(() => {
    const el = rahmen.current
    if (!el) return
    const rad = (e: WheelEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
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
  const zeilen = editor ? editor.text.split('\n') : []
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
      {editor && (
        <textarea
          className="text-eingabe"
          aria-label="Text auf der Tafel"
          autoFocus
          maxLength={MAX_TEXT}
          value={editor.text}
          cols={Math.max(8, ...zeilen.map((z) => z.length + 2))}
          rows={Math.max(1, zeilen.length)}
          style={{
            left: kamera.x + editor.x * kamera.zoom,
            top: kamera.y + editor.y * kamera.zoom,
            fontSize: editor.groesse * kamera.zoom,
            lineHeight: ZEILENHOEHE,
            color: editor.farbe,
            fontFamily: SCHRIFT,
          }}
          onChange={(e) => setEditor({ ...editor, text: e.target.value })}
          onBlur={() => schliesseEditor()}
          onKeyDown={(e) => {
            e.stopPropagation() // Buchstaben sollen kein Werkzeug umschalten
            if (e.key === 'Escape') schliesseEditor(false)
          }}
        />
      )}
    </div>
  )
}
