// Die Zeichenfläche: nimmt Maus, Finger und Stift entgegen (Pointer Events) und zeichnet auf zwei Ebenen.
//   untere Ebene: alle fertigen Elemente   ·   obere Ebene: was gerade entsteht oder bewegt wird, Auswahlrahmen, Radierer
// Regeln der Eingabe:
//   Stift und Maus arbeiten immer mit dem gewählten Werkzeug. Ein Finger tut das auch, bis einmal ein Stift
//   benutzt wurde – danach verschiebt er die Ansicht (Handballen-Schutz). Zwei Finger verschieben und zoomen immer.
//   Mausrad verschiebt, Strg + Mausrad zoomt. Das Hand-Werkzeug verschiebt die Ansicht, am Laptop auch die
//   gehaltene Leertaste bei jedem Werkzeug.
// Regeln der Auswahl:
//   Ziehen auf freier Fläche spannt einen Rahmen auf; ausgewählt wird, was er berührt. Ziehen innerhalb des
//   Auswahlrahmens verschiebt die Auswahl, Ziehen an einem Griff ändert ihre Größe. Umschalt + Antippen nimmt
//   ein Element hinzu oder heraus.
// Regeln des Zeichnens (damit auch langsame Geräte wie ein Smartboard mitkommen):
//   Gezeichnet wird höchstens einmal je Bildwechsel, auch wenn der Stift sich öfter meldet.
//   Kommt nur ein neuer Strich dazu, wird die untere Ebene ergänzt und nicht ganz neu gezeichnet.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { auswahlRahmen, GRIFF_GROESSE, GRIFF_ZEIGER, griffBei, griffe, nurEcken, skalierung, type Griffname, type Skalierung } from '../kern/auswahl.ts'
import { beruehrtRechteck, gesamtRahmen, oberstesBei, rechteckAus, skaliert, trifft, verschiebe, verschoben, ZEILENHOEHE, zoomeUm, zuTafel, type Rechteck } from '../kern/geometrie.ts'
import { MAX_TEXT, neueId, schriftgroesse, type Element, type Form, type Formart, type Hintergrund, type Kamera, type Strich, type Text, type Zeichenwerkzeug } from '../kern/modell.ts'
import { beiBildGeladen } from './bildquellen.ts'
import { messBeginn, obenGezeichnet, untenGezeichnet } from './messung.ts'
import { SCHRIFT, zeichne, zeichneHintergrund } from './zeichnen.ts'

export type Werkzeug = 'auswahl' | 'hand' | Zeichenwerkzeug | 'radierer' | 'text' | Formart

type Props = {
  elemente: Element[]
  /** z. B. eine importierte PDF-Seite; liegt unter allem und lässt sich nicht verändern */
  hintergrund?: Hintergrund
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
/** Kürzere Wege (Bildschirm-Pixel) gelten als Antippen, nicht als Ziehen */
const TIPP_WEG = 4

const vorschau = (a: Extract<Aktiv, { art: 'skalieren' }>) =>
  a.s ? a.originale.map((e) => skaliert(e, a.s!.ax, a.s!.ay, a.s!.sx, a.s!.sy, a.s!.gleichmaessig)) : a.originale

type Aktiv =
  | { art: 'zeichnen'; zeiger: number; strich: Strich }
  | { art: 'form'; zeiger: number; form: Form }
  | { art: 'radieren'; zeiger: number; ids: Set<string>; x: number; y: number }
  /** tipp: das angetippte Element – wird bei einem bloßen Antippen (ohne Ziehen) allein ausgewählt */
  | { art: 'ziehen'; zeiger: number; startX: number; startY: number; originale: Element[]; dx: number; dy: number; tipp: Element | null }
  | { art: 'skalieren'; zeiger: number; griff: Griffname; startX: number; startY: number; inhalt: Rechteck; originale: Element[]; s: Skalierung | null }
  /** Auswahlrahmen aufziehen (Tafel-Koordinaten); dazu: was schon vorher ausgewählt war und bleibt (Umschalt) */
  | { art: 'rahmen'; zeiger: number; x1: number; y1: number; x2: number; y2: number; dazu: string[] }
  | { art: 'schwenken'; zeiger: number; x: number; y: number }
  | { art: 'geste'; mitteX: number; mitteY: number; abstand: number }

type Editor = { id: string | null; x: number; y: number; groesse: number; farbe: string; text: string; vorher: Text | null }

/** Wurde in dieser Sitzung schon ein Stift benutzt? Dann verschieben Finger nur noch (gilt über Seitenwechsel hinweg). */
let stiftGesehen = false
/** Nur für Tests: den Handballen-Schutz zurücksetzen */
export const vergissStift = () => {
  stiftGesehen = false
}

export function Zeichenflaeche({ elemente, hintergrund, kamera, werkzeug, farbe, staerke, auswahl, beiHinzu, beiRadieren, beiErsetzen, beiAuswahl, beiKamera }: Props) {
  const rahmen = useRef<HTMLDivElement>(null)
  const unten = useRef<HTMLCanvasElement>(null)
  const oben = useRef<HTMLCanvasElement>(null)
  const [groesse, setGroesse] = useState({ b: 0, h: 0, dpr: 1 })
  const [versteckt, setVersteckt] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<Editor | null>(null)
  // Bilder werden nachgeladen; ist eines da, neu zeichnen
  const [bildStand, setBildStand] = useState(0)
  useEffect(() => beiBildGeladen(() => setBildStand((n) => n + 1)), [])

  /** Eine verschobene Ansicht, die erst mit dem nächsten Bildwechsel weitergemeldet wird */
  const kameraOffen = useRef<Kamera | null>(null)
  // Aktuelle Werte für die Eingabe-Funktionen (die sich sonst bei jedem Zeichnen neu anmelden müssten)
  const stand = useRef({ elemente, kamera, werkzeug, farbe, staerke, auswahl, editor })
  stand.current = { elemente, kamera: kameraOffen.current ?? kamera, werkzeug, farbe, staerke, auswahl, editor }

  const zeiger = useRef(new Map<number, { x: number; y: number; typ: string }>())
  const aktiv = useRef<Aktiv | null>(null)
  const letzterTipp = useRef<{ id: string; zeit: number } | null>(null)

  // ---------- Leertaste gehalten: Ansicht verschieben (am Laptop, bei jedem Werkzeug) ----------
  const [leertaste, setLeertaste] = useState(false)
  useEffect(() => {
    const imFeld = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null
      return !!ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.tagName === 'SELECT' || ziel.isContentEditable)
    }
    const runter = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (imFeld(e) || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault() // sonst rollt die Seite oder der zuletzt geklickte Knopf wird noch einmal gedrückt
      setLeertaste(true)
    }
    const hoch = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') setLeertaste(false)
    }
    const weg = () => setLeertaste(false)
    window.addEventListener('keydown', runter)
    window.addEventListener('keyup', hoch)
    window.addEventListener('blur', weg)
    return () => {
      window.removeEventListener('keydown', runter)
      window.removeEventListener('keyup', hoch)
      window.removeEventListener('blur', weg)
    }
  }, [])
  const leer = useRef(leertaste)
  leer.current = leertaste

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
  /** Was die untere Ebene gerade zeigt – um nach einem neuen Strich nur diesen zu ergänzen */
  const gezeigt = useRef<{ elemente: Element[]; rest: unknown[] } | null>(null)
  /** Beim Abheben schon unten eingezeichnet – muss beim Ergänzen nicht noch einmal gezeichnet werden */
  const schonFest = useRef(new WeakSet<Element>())
  useEffect(() => {
    const beginn = messBeginn()
    const rest = [hintergrund, kamera, groesse, versteckt, bildStand]
    const alt = gezeigt.current
    gezeigt.current = { elemente, rest }
    const nurDazu = alt !== null && alt.rest.every((x, i) => x === rest[i]) && alt.elemente.length <= elemente.length && alt.elemente.every((e, i) => e === elemente[i])
    if (nurDazu) {
      // Alles Bisherige steht noch da: nur das Neue einzeichnen. Bei vollen Seiten spart das nach jedem Strich viel Zeit.
      const ctx = unten.current?.getContext('2d')
      if (ctx) for (const e of elemente.slice(alt.elemente.length)) if (!schonFest.current.has(e) && !versteckt.has(e.id)) zeichne(ctx, e)
    } else {
      schonFest.current = new WeakSet()
      const ctx = ebene(unten.current, kamera)
      if (!ctx) {
        gezeigt.current = null
        return
      }
      if (hintergrund) zeichneHintergrund(ctx, hintergrund)
      for (const e of elemente) if (!versteckt.has(e.id)) zeichne(ctx, e)
    }
    untenGezeichnet(beginn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elemente, hintergrund, kamera, groesse, versteckt, bildStand])

  function zeichneOben() {
    const beginn = messBeginn()
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
    const bewegt = a?.art === 'ziehen' ? a.originale.map((e) => verschoben(e, a.dx, a.dy)) : a?.art === 'skalieren' ? vorschau(a) : null
    bewegt?.forEach((e) => zeichne(ctx, e, true))
    // Auswahlrahmen mit Griffen (die Griffe nur, solange nichts bewegt wird)
    const gewaehlt = bewegt ?? s.elemente.filter((e) => s.auswahl.includes(e.id) && e.id !== s.editor?.id)
    const inhalt = gesamtRahmen(gewaehlt)
    if (inhalt) {
      const r = auswahlRahmen(inhalt, k.zoom)
      ctx.setLineDash([8 / k.zoom, 6 / k.zoom])
      ctx.lineWidth = 2 / k.zoom
      ctx.strokeStyle = '#1d5fd1'
      ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1])
      ctx.setLineDash([])
      if (!bewegt && s.werkzeug === 'auswahl') {
        const g = GRIFF_GROESSE / k.zoom
        ctx.fillStyle = '#ffffff'
        for (const griff of griffe(r, k.zoom, nurEcken(gewaehlt))) {
          ctx.fillRect(griff.x - g / 2, griff.y - g / 2, g, g)
          ctx.strokeRect(griff.x - g / 2, griff.y - g / 2, g, g)
        }
      }
    }
    // Rahmen, der gerade aufgezogen wird
    if (a?.art === 'rahmen') {
      const [l, o, re, u] = rechteckAus(a.x1, a.y1, a.x2, a.y2)
      ctx.fillStyle = 'rgba(29, 95, 209, 0.08)'
      ctx.fillRect(l, o, re - l, u - o)
      ctx.setLineDash([6 / k.zoom, 4 / k.zoom])
      ctx.lineWidth = 1.5 / k.zoom
      ctx.strokeStyle = '#1d5fd1'
      ctx.strokeRect(l, o, re - l, u - o)
      ctx.setLineDash([])
    }
    obenGezeichnet(beginn)
  }

  /** Auswahlrahmen und Griffe der aktuellen Auswahl (Tafel-Koordinaten) oder null */
  function auswahlLage() {
    const s = stand.current
    const gewaehlt = s.elemente.filter((e) => s.auswahl.includes(e.id))
    const inhalt = gesamtRahmen(gewaehlt)
    if (!inhalt) return null
    const r = auswahlRahmen(inhalt, s.kamera.zoom)
    return { gewaehlt, inhalt, rahmen: r, griffe: griffe(r, s.kamera.zoom, nurEcken(gewaehlt)) }
  }
  useEffect(zeichneOben)

  // ---------- Höchstens einmal je Bildwechsel zeichnen ----------
  // Stift und Finger melden sich oft mehrmals je Bild. Jedes Mal zu zeichnen (oder die Ansicht zu verschieben)
  // kostet ein langsames Gerät mehr Zeit, als es hat – dann hinkt die Schrift nach und wird eckig.
  const geplant = useRef(0)
  const erledige = useRef(() => {})
  erledige.current = () => {
    geplant.current = 0
    const k = kameraOffen.current
    kameraOffen.current = null
    if (k) beiKamera(k) // aus der geänderten Ansicht folgt das Neuzeichnen beider Ebenen
    else zeichneOben()
  }
  /** Zeichnet beim nächsten Bildwechsel (mehrere Aufrufe bis dahin zählen als einer). */
  function plane() {
    if (geplant.current) return
    if (typeof requestAnimationFrame !== 'function') erledige.current()
    else geplant.current = requestAnimationFrame(() => erledige.current())
  }
  /** Zeichnet jetzt gleich und verwirft, was noch geplant war. */
  function sofort() {
    if (geplant.current && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(geplant.current)
    erledige.current()
  }
  useEffect(
    () => () => {
      if (geplant.current && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(geplant.current)
    },
    [],
  )

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

  /** Aufsetzen mit dem Auswahl-Werkzeug: Griff, Auswahl verschieben, Element wählen oder Rahmen aufziehen */
  function waehleAus(e: ReactPointerEvent<HTMLDivElement>, tx: number, ty: number, fang: number) {
    const s = stand.current
    const zoom = s.kamera.zoom
    // Ein Doppeltipp zählt nur, wenn direkt davor dasselbe Element bloß angetippt wurde
    const vorher = letzterTipp.current
    letzterTipp.current = null
    const lage = auswahlLage()
    const griff = lage && !e.shiftKey ? griffBei(lage.griffe, tx, ty, zoom) : null
    if (griff && lage) {
      aktiv.current = { art: 'skalieren', zeiger: e.pointerId, griff: griff.name, startX: tx, startY: ty, inhalt: lage.inhalt, originale: lage.gewaehlt, s: null }
      return
    }
    const treffer = oberstesBei(s.elemente, tx, ty, fang)
    if (e.shiftKey) {
      // Umschalt: das angetippte Element hinzunehmen oder herausnehmen; auf freier Fläche einen Rahmen dazu aufziehen
      if (treffer) {
        zeiger.current.delete(e.pointerId)
        beiAuswahl(s.auswahl.includes(treffer.id) ? s.auswahl.filter((id) => id !== treffer.id) : [...s.auswahl, treffer.id])
      } else aktiv.current = { art: 'rahmen', zeiger: e.pointerId, x1: tx, y1: ty, x2: tx, y2: ty, dazu: s.auswahl }
      return
    }
    if (treffer?.art === 'text' && vorher?.id === treffer.id && Date.now() - vorher.zeit < DOPPELTIPP_MS) {
      zeiger.current.delete(e.pointerId)
      beiAuswahl([treffer.id])
      bearbeite(treffer)
      return
    }
    const [l, o, r, u] = lage?.rahmen ?? [0, 0, -1, -1]
    const imRahmen = tx >= l && tx <= r && ty >= o && ty <= u
    if (imRahmen && lage) {
      // Innerhalb des Auswahlrahmens (auch zwischen den Buchstaben) verschiebt Ziehen die ganze Auswahl
      aktiv.current = { art: 'ziehen', zeiger: e.pointerId, startX: tx, startY: ty, originale: lage.gewaehlt, dx: 0, dy: 0, tipp: treffer }
    } else if (treffer) {
      beiAuswahl([treffer.id])
      aktiv.current = { art: 'ziehen', zeiger: e.pointerId, startX: tx, startY: ty, originale: [treffer], dx: 0, dy: 0, tipp: treffer }
    } else {
      if (s.auswahl.length) beiAuswahl([])
      aktiv.current = { art: 'rahmen', zeiger: e.pointerId, x1: tx, y1: ty, x2: tx, y2: ty, dazu: [] }
    }
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

    if (w === 'hand' || leer.current) {
      aktiv.current = { art: 'schwenken', zeiger: e.pointerId, x, y }
      return
    }
    if (w === 'radierer') {
      const a: Aktiv = { art: 'radieren', zeiger: e.pointerId, ids: new Set(), x, y }
      aktiv.current = a
      radiere(a)
    } else if (w === 'auswahl') {
      waehleAus(e, tx, ty, fang)
      if (!aktiv.current) return
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

  /** Am Laptop zeigt der Mauszeiger, was ein Klick an dieser Stelle täte (Griff, Verschieben) */
  function zeigeMauszeiger(e: ReactPointerEvent<HTMLDivElement>) {
    const el = rahmen.current
    if (!el) return
    let zeiger = ''
    const lage = stand.current.werkzeug === 'auswahl' && !leer.current ? auswahlLage() : null
    if (lage) {
      const [x, y] = ort(e)
      const [tx, ty] = zuTafel(stand.current.kamera, x, y)
      const griff = griffBei(lage.griffe, tx, ty, stand.current.kamera.zoom)
      const [l, o, r, u] = lage.rahmen
      zeiger = griff ? GRIFF_ZEIGER[griff.name] : tx >= l && tx <= r && ty >= o && ty <= u ? 'move' : ''
    }
    if (el.style.cursor !== zeiger) el.style.cursor = zeiger
  }

  function bewegt(e: ReactPointerEvent<HTMLDivElement>) {
    const z = zeiger.current.get(e.pointerId)
    const a = aktiv.current
    if (!a && e.pointerType === 'mouse') zeigeMauszeiger(e)
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
      kameraOffen.current = neu
      plane()
      return
    }
    if (a.zeiger !== e.pointerId) return
    const [tx, ty] = zuTafel(k, x, y)

    if (a.art === 'schwenken') {
      const neu = verschiebe(k, x - a.x, y - a.y)
      a.x = x
      a.y = y
      stand.current.kamera = neu
      kameraOffen.current = neu
      plane()
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
    } else if (a.art === 'skalieren') {
      if (!a.s) setVersteckt(new Set(a.originale.map((el) => el.id)))
      a.s = skalierung(a.griff, a.inhalt, tx - a.startX, ty - a.startY)
    } else if (a.art === 'rahmen') {
      a.x2 = tx
      a.y2 = ty
    } else if (a.art === 'form') {
      a.form.x2 = tx
      a.form.y2 = ty
    } else {
      // Zwischenpunkte, die der Browser zusammengefasst hat, mitnehmen (glattere Linien bei schnellem Stift)
      const einzeln = e.nativeEvent.getCoalescedEvents?.() ?? []
      const r = rahmen.current!.getBoundingClientRect() // einmal je Meldung messen, nicht je Punkt
      for (const ev of einzeln.length ? einzeln : [e.nativeEvent]) {
        const [px, py] = zuTafel(k, ev.clientX - r.left, ev.clientY - r.top)
        const letzter = a.strich.punkte[a.strich.punkte.length - 1]
        if (Math.hypot(px - letzter[0], py - letzter[1]) * k.zoom < 0.5) continue
        a.strich.punkte.push([px, py, a.strich.druckEcht ? ev.pressure || letzter[2] : 0.5])
      }
    }
    plane()
  }

  function hoch(e: ReactPointerEvent<HTMLDivElement>, abgebrochen = false) {
    if (!zeiger.current.delete(e.pointerId)) return
    if (kameraOffen.current) sofort() // die zuletzt verschobene Ansicht gilt ab jetzt
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
      const beginn = messBeginn()
      const ctx = unten.current?.getContext('2d')
      if (!ctx) return
      zeichne(ctx, el)
      schonFest.current.add(el)
      untenGezeichnet(beginn)
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
      } else if (!abgebrochen && a.tipp) {
        // Bloßes Antippen: merken für den Doppeltipp; ein anderes Element im Auswahlrahmen wird allein ausgewählt
        letzterTipp.current = { id: a.tipp.id, zeit: Date.now() }
        if (!stand.current.auswahl.includes(a.tipp.id)) beiAuswahl([a.tipp.id])
      }
      setVersteckt(new Set())
    }
    if (a.art === 'skalieren') {
      const s = a.s
      if (!abgebrochen && s && (Math.abs(s.sx - 1) > 1e-3 || Math.abs(s.sy - 1) > 1e-3)) {
        const neu = vorschau(a)
        neu.forEach(fest)
        beiErsetzen(a.originale, neu)
      }
      setVersteckt(new Set())
    }
    if (a.art === 'rahmen' && !abgebrochen) {
      const weit = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) * k.zoom >= TIPP_WEG
      const r = rechteckAus(a.x1, a.y1, a.x2, a.y2)
      const neu = weit ? stand.current.elemente.filter((el) => !a.dazu.includes(el.id) && beruehrtRechteck(el, r)).map((el) => el.id) : []
      if (neu.length) beiAuswahl([...a.dazu, ...neu])
    }
    sofort()
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
      kameraOffen.current = neu
      plane()
    }
    el.addEventListener('wheel', rad, { passive: false })
    return () => el.removeEventListener('wheel', rad)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { b, h, dpr } = groesse
  const zeilen = editor ? editor.text.split('\n') : []
  return (
    <div
      ref={rahmen}
      className={'zeichenflaeche werkzeug-' + werkzeug + (leertaste ? ' leertaste' : '')}
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
