// Die Zeichenfläche: nimmt Maus, Finger und Stift entgegen (Pointer Events) und zeichnet auf zwei Ebenen.
//   untere Ebene: alle fertigen Elemente   ·   obere Ebene: was gerade entsteht oder bewegt wird, Auswahlrahmen, Radierer
// Regeln der Eingabe:
//   Stift und Maus arbeiten immer mit dem gewählten Werkzeug. Ein Finger tut das auch, bis einmal ein Stift
//   benutzt wurde – danach verschiebt er die Ansicht (Handballen-Schutz). Zwei Finger verschieben und zoomen immer.
//   Der Stift hat immer Vorrang: Liegt die Hand schon auf, wird ihre Geste (oder ein Fingerstrich) verworfen und der
//   Stift schreibt. Berührungen während des Schreibens und kurz danach gelten als Handballen und werden übergangen.
//   Mausrad verschiebt, Strg + Mausrad zoomt. Das Hand-Werkzeug verschiebt die Ansicht, am Laptop auch die
//   gehaltene Leertaste bei jedem Werkzeug.
// Regeln der Auswahl:
//   Ziehen auf freier Fläche spannt einen Rahmen auf; ausgewählt wird, was er berührt. Ziehen innerhalb des
//   Auswahlrahmens verschiebt die Auswahl, Ziehen an einem Griff ändert ihre Größe. Umschalt + Antippen nimmt
//   ein Element hinzu oder heraus. Gehört ein Element zu einer Gruppe, wird immer die ganze Gruppe gewählt
//   (Antippen, Rahmen, Umschalt); der Radierer nimmt dagegen nur, was er berührt.
// Regeln des Radierers:
//   Der Schwamm wischt nur die überfahrenen Teile von Strichen weg (Text, Formen, Bilder bleiben); ein Strich
//   zerfällt dabei in Reststücke an seiner Stelle. Der Element-Radierer entfernt alles Berührte als Ganzes.
//   Die Größe gilt in Bildschirm-Pixeln. Ein Wischzug (Aufsetzen bis Abheben) ist ein Schritt im Verlauf.
// Regeln des Zeichnens (damit auch langsame Geräte wie ein Smartboard mitkommen):
//   Gezeichnet wird höchstens einmal je Bildwechsel, auch wenn der Stift sich öfter meldet.
//   Kommt nur ein neuer Strich dazu, wird die untere Ebene ergänzt und nicht ganz neu gezeichnet.
// Laserpointer:
//   Zeichnet einen leuchtenden roten Schweif nur auf der oberen Ebene: Jeder Punkt ist 0,7 s voll zu sehen und nach
//   1,5 s verloschen (auch während noch gezeigt wird); an der Spitze ein Leuchtpunkt.
//   Nichts davon wird gespeichert, nichts kommt in den Verlauf oder ins PDF, der Speicherstand bleibt unberührt.
// Begradigen durch Halten:
//   Steht der Stift beim Zeichnen etwa 0,6 s still, wird der Strich – wenn eine Form erkannt wird – noch vor dem
//   Abheben durch die saubere Form ersetzt. Geht es danach weiter, bleibt er freihändig. Beim Abheben entstehen
//   zwei Schritte im Verlauf (Strich hinzufügen, durch die Form ersetzen), damit Rückgängig zuerst nur begradigt.
// Tabelle:
//   Das Werkzeug fragt nach Zeilen und Spalten und legt die Tabelle an der Stelle an; danach wird die erste Zelle
//   beschrieben. Zellen beschreiben: mit dem Tabellen- oder Text-Werkzeug antippen, mit der Auswahl doppelt antippen.
//   Tab/Enter springt zur nächsten Zelle (am Ende kommt eine Zeile dazu), Umschalt + Tab zurück, Umschalt + Enter
//   bricht die Zeile um. Jede geänderte Zelle ist ein Schritt im Verlauf. Ist die Tabelle ausgewählt, lassen sich
//   die Trennlinien zwischen den Spalten ziehen.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { auswahlRahmen, drehBasis, drehwinkel, GRIFF_GROESSE, GRIFF_ZEIGER, griffBei, griffe, mitGruppen, nurEcken, skalierung, type Griffname, type Skalierung } from '../kern/auswahl.ts'
import { beruehrtRechteck, drehePunkt, drehungVon, gedreht, gesamtRahmen, oberstesBei, rechteckAus, skaliert, trifft, verschiebe, verschoben, ZEILENHOEHE, zoomeUm, zuTafel, type Rechteck } from '../kern/geometrie.ts'
import type { Befehl } from '../kern/befehle.ts'
import { begradige, HALTE_TOLERANZ, HALTEZEIT_MS } from '../kern/begradigen.ts'
import type { Werkzeug } from '../kern/einstellungen.ts'
import { kuerze, lebt, punktLeben, type Spur } from '../kern/laser.ts'
import { MAX_TEXT, MAX_ZELLTEXT, neueId, normiereWinkel, schriftgroesse, type Element, type Form, type Hintergrund, type Kamera, type Muster, type Strich, type Tabelle, type Text } from '../kern/modell.ts'
import { innen, mitSpaltenbreite, mitZelle, naechsteZelle, neueTabelle, trennerBei, zeileDazu, zelleBei, zellLage, zellRand } from '../kern/tabelle.ts'
import { Tabellenwahl } from './Tabellenwahl.tsx'
import { beginneWischzug, neueTeile, RADIERER_RADIUS, RADIERER_STANDARD, wischBefehl, wischeWeiter, type Radierer, type Wischzug } from '../kern/radieren.ts'
import { beiBildGeladen } from './bildquellen.ts'
import { messBeginn, obenGezeichnet, untenGezeichnet } from './messung.ts'
import { aufBlatt, type Blatt } from '../kern/blatt.ts'
import { schneideAufBlatt, SCHRIFT, zeichne, zeichneBlatt, zeichneHintergrund, zeichneLaser, zeichneMuster } from './zeichnen.ts'

export type { Werkzeug }


type Props = {
  elemente: Element[]
  /** z. B. eine importierte PDF-Seite; liegt unter allem und lässt sich nicht verändern */
  hintergrund?: Hintergrund
  /** Muster der Seite (liniert, kariert …); liegt unter allem */
  muster?: Muster
  kamera: Kamera
  werkzeug: Werkzeug
  farbe: string
  staerke: number
  /** Art und Größe des Radierers (fehlt: Schwamm, mittel) */
  radierer?: Radierer
  /** Kennungen der ausgewählten Elemente */
  auswahl: string[]
  beiHinzu: (e: Element) => void
  beiRadieren: (ids: string[]) => void
  /** Ein fertiger Wischzug des Schwamms */
  beiBefehl: (b: Befehl) => void
  beiErsetzen: (vorher: Element[], nachher: Element[]) => void
  beiAuswahl: (ids: string[]) => void
  beiKamera: (k: Kamera) => void
  /** Größe des Blatts (Tafel mit festem Format) oder null/fehlt: unendliche Fläche */
  blatt?: Blatt | null
  /** Begrenzt eine Ansicht beim Verschieben und Zoomen (auf das Blatt); fehlt: keine Grenze */
  begrenze?: (k: Kamera) => Kamera
}

/** Fangradius der Auswahl in Bildschirm-Pixeln */
const FANG_RADIUS = 8
const DOPPELTIPP_MS = 450
/** Kürzere Wege (Bildschirm-Pixel) gelten als Antippen, nicht als Ziehen */
const TIPP_WEG = 4

const vorschau = (a: Extract<Aktiv, { art: 'skalieren' }>) =>
  a.s ? a.originale.map((e) => skaliert(e, a.s!.ax, a.s!.ay, a.s!.sx, a.s!.sy, a.s!.gleichmaessig)) : a.originale

type Aktiv =
  /** halt: wo der Stift zuletzt stillzustehen begann (Bildschirm); begradigt: die erkannte Form nach dem Halten */
  | { art: 'zeichnen'; zeiger: number; strich: Strich; halt: { x: number; y: number }; begradigt: Form | Strich | null }
  | { art: 'form'; zeiger: number; form: Form }
  | { art: 'zeigen'; zeiger: number; spur: Spur }
  /** x/y: Zeiger (Bildschirm), vx/vy: wo er zuletzt war; wisch: der Wischzug des Schwamms (Element-Radierer: null) */
  | { art: 'radieren'; zeiger: number; ids: Set<string>; x: number; y: number; vx: number; vy: number; wisch: Wischzug | null }
  /** tipp: das angetippte Element – wird bei einem bloßen Antippen (ohne Ziehen) allein ausgewählt */
  | { art: 'ziehen'; zeiger: number; startX: number; startY: number; originale: Element[]; dx: number; dy: number; tipp: Element | null }
  | { art: 'skalieren'; zeiger: number; griff: Griffname; startX: number; startY: number; inhalt: Rechteck; originale: Element[]; s: Skalierung | null }
  /** Drehen um die Mitte (cx, cy) der Auswahl; x/y: Zeiger (Tafel-Koordinaten), basis: bisherige Drehung zum Einrasten */
  | { art: 'drehen'; zeiger: number; cx: number; cy: number; startX: number; startY: number; x: number; y: number; basis: number; originale: Element[]; winkel: number }
  /** Auswahlrahmen aufziehen (Tafel-Koordinaten); dazu: was schon vorher ausgewählt war und bleibt (Umschalt) */
  | { art: 'rahmen'; zeiger: number; x1: number; y1: number; x2: number; y2: number; dazu: string[] }
  | { art: 'schwenken'; zeiger: number; x: number; y: number }
  | { art: 'geste'; mitteX: number; mitteY: number; abstand: number }
  /** Breite einer Tabellenspalte ziehen: startX in den Koordinaten der Tabelle */
  | { art: 'spalte'; zeiger: number; t: Tabelle; spalte: number; startX: number; breite: number; neu: Tabelle }

/** zelle: es wird eine Zelle einer Tabelle beschrieben (x, y: ihre linke obere Ecke, gedreht wie die Tabelle) */
type Editor = { id: string | null; x: number; y: number; groesse: number; farbe: string; text: string; vorher: Text | null; zelle?: { t: Tabelle; r: number; s: number } }

/** Wurde in dieser Sitzung schon ein Stift benutzt? Dann verschieben Finger nur noch (gilt über Seitenwechsel hinweg). */
let stiftGesehen = false
/** Wann der Stift zuletzt die Fläche berührte (ms) – kurz danach aufgelegte Finger sind der Handballen */
let letzterStift = -Infinity
const BALLEN_MS = 1000
/** Nur für Tests: den Handballen-Schutz zurücksetzen */
export const vergissStift = () => {
  stiftGesehen = false
  letzterStift = -Infinity
}
/** So lange muss der Stift zum Begradigen stillstehen (ms) */
let haltezeit = HALTEZEIT_MS
/** Nur für Tests: kürzere Haltezeit */
export const setzeHaltezeit = (ms: number) => {
  haltezeit = ms
}

const keineGrenze = (k: Kamera) => k

export function Zeichenflaeche({ elemente, hintergrund, muster, kamera, werkzeug, farbe, staerke, radierer = RADIERER_STANDARD, auswahl, beiHinzu, beiRadieren, beiBefehl, beiErsetzen, beiAuswahl, beiKamera, blatt = null, begrenze = keineGrenze }: Props) {
  const rahmen = useRef<HTMLDivElement>(null)
  const unten = useRef<HTMLCanvasElement>(null)
  const oben = useRef<HTMLCanvasElement>(null)
  const [groesse, setGroesse] = useState({ b: 0, h: 0, dpr: 1 })
  const [versteckt, setVersteckt] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<Editor | null>(null)
  /** Feld „Tabelle einfügen“: wo angetippt wurde (Tafel) und wo das Feld steht (Bildschirm) */
  const [wahl, setWahl] = useState<{ tx: number; ty: number; x: number; y: number } | null>(null)
  // Bilder werden nachgeladen; ist eines da, neu zeichnen
  const [bildStand, setBildStand] = useState(0)
  useEffect(() => beiBildGeladen(() => setBildStand((n) => n + 1)), [])

  /** Eine verschobene Ansicht, die erst mit dem nächsten Bildwechsel weitergemeldet wird */
  const kameraOffen = useRef<Kamera | null>(null)
  // Aktuelle Werte für die Eingabe-Funktionen (die sich sonst bei jedem Zeichnen neu anmelden müssten)
  const stand = useRef({ elemente, kamera, werkzeug, farbe, staerke, radierer, auswahl, editor, blatt, begrenze })
  stand.current = { elemente, kamera: kameraOffen.current ?? kamera, werkzeug, farbe, staerke, radierer, auswahl, editor, blatt, begrenze }
  /** Wo Maus oder schwebender Stift gerade ist (Bildschirm) – dort zeigt ein Kreis die Größe des Radierers (beim Laserpointer: ein roter Punkt) */
  const schwebe = useRef<{ x: number; y: number } | null>(null)
  /** Spuren des Laserpointers: nur hier auf der oberen Ebene, nie gespeichert, nicht im Verlauf */
  const spuren = useRef<Spur[]>([])
  const nachgeplant = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const rest = [hintergrund, kamera, groesse, versteckt, bildStand, blatt, muster]
    const alt = gezeigt.current
    gezeigt.current = { elemente, rest }
    const nurDazu = alt !== null && alt.rest.every((x, i) => x === rest[i]) && alt.elemente.length <= elemente.length && alt.elemente.every((e, i) => e === elemente[i])
    if (nurDazu) {
      // Alles Bisherige steht noch da: nur das Neue einzeichnen. Bei vollen Seiten spart das nach jedem Strich viel Zeit.
      const ctx = unten.current?.getContext('2d')
      if (ctx) {
        ctx.save()
        if (blatt) schneideAufBlatt(ctx, blatt[0], blatt[1], kamera.zoom)
        for (const e of elemente.slice(alt.elemente.length)) if (!schonFest.current.has(e) && !versteckt.has(e.id)) zeichne(ctx, e)
        ctx.restore()
      }
    } else {
      schonFest.current = new WeakSet()
      const ctx = ebene(unten.current, kamera)
      if (!ctx) {
        gezeigt.current = null
        return
      }
      ctx.save()
      if (blatt) {
        // Festes Format: weißes Blatt, und nichts ragt darüber hinaus
        zeichneBlatt(ctx, blatt[0], blatt[1], kamera.zoom)
        schneideAufBlatt(ctx, blatt[0], blatt[1], kamera.zoom)
      }
      if (muster && !hintergrund) {
        // nur den sichtbaren Ausschnitt mustern (auf der unendlichen Fläche läuft das Muster endlos weiter)
        const z = kamera.zoom
        zeichneMuster(ctx, muster, [-kamera.x / z, -kamera.y / z, (groesse.b - kamera.x) / z, (groesse.h - kamera.y) / z], blatt, z)
      }
      if (hintergrund) zeichneHintergrund(ctx, hintergrund)
      for (const e of elemente) if (!versteckt.has(e.id)) zeichne(ctx, e)
      ctx.restore()
    }
    untenGezeichnet(beginn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elemente, hintergrund, kamera, groesse, versteckt, bildStand, blatt, muster])

  function zeichneOben() {
    const beginn = messBeginn()
    const s = stand.current
    const k = s.kamera
    const ctx = ebene(oben.current, k)
    if (!ctx) return
    const a = aktiv.current
    // Was entsteht oder bewegt wird, endet wie auf der unteren Ebene am Blattrand
    const aufsBlatt = (tun: () => void) => {
      ctx.save()
      if (s.blatt) schneideAufBlatt(ctx, s.blatt[0], s.blatt[1], k.zoom)
      tun()
      ctx.restore()
    }
    aufsBlatt(() => {
      if (a?.art === 'zeichnen') zeichne(ctx, a.begradigt ?? a.strich, true)
      if (a?.art === 'form') zeichne(ctx, a.form)
      if (a?.art === 'radieren' && a.wisch) neueTeile(a.wisch).forEach((e) => zeichne(ctx, e))
    })
    // Laserpointer: leuchtender Schweif, der hinten verlischt, und ein Leuchtpunkt an der Spitze
    const jetzt = Date.now()
    spuren.current = spuren.current.filter((sp) => lebt(sp, jetzt))
    spuren.current.forEach((sp) => kuerze(sp, jetzt))
    let punkt: { x: number; y: number; hell: number } | null = null
    const kopf = (sp: Spur) => sp.punkte[sp.punkte.length - 1]
    if (a?.art === 'zeigen') punkt = { x: kopf(a.spur)[0], y: kopf(a.spur)[1], hell: 1 }
    else if (!a && s.werkzeug === 'laser' && schwebe.current) {
      const [x, y] = zuTafel(k, schwebe.current.x, schwebe.current.y)
      punkt = { x, y, hell: 1 }
    } else {
      const letzte = spuren.current[spuren.current.length - 1]
      if (letzte) punkt = { x: kopf(letzte)[0], y: kopf(letzte)[1], hell: punktLeben(letzte, jetzt) }
    }
    if (spuren.current.length || punkt) zeichneLaser(ctx, spuren.current, jetzt, k.zoom, punkt)
    // Der Schweif altert auch, während noch gezeigt wird: im nächsten Bild weiterzeichnen
    // (ohne Bildwechsel-Takt, z. B. in Tests, etwas später)
    if (spuren.current.length) {
      if (typeof requestAnimationFrame === 'function') plane()
      else if (!nachgeplant.current)
        nachgeplant.current = setTimeout(() => {
          nachgeplant.current = null
          plane()
        }, 16)
    }
    // Kreis in der Größe des Radierers: beim Radieren und wenn Maus oder Stift darüber schweben
    const kreis = a?.art === 'radieren' ? a : !a && s.werkzeug === 'radierer' ? schwebe.current : null
    if (kreis) {
      const [x, y] = zuTafel(k, kreis.x, kreis.y)
      ctx.beginPath()
      ctx.arc(x, y, RADIERER_RADIUS[s.radierer.groesse] / k.zoom, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(70, 85, 122, 0.08)'
      ctx.fill()
      ctx.lineWidth = 2 / k.zoom
      ctx.strokeStyle = '#46557a'
      ctx.stroke()
    }
    const bewegt =
      a?.art === 'ziehen'
        ? a.originale.map((e) => verschoben(e, a.dx, a.dy))
        : a?.art === 'skalieren'
          ? vorschau(a)
          : a?.art === 'drehen'
            ? a.originale.map((e) => gedreht(e, a.cx, a.cy, a.winkel))
            : a?.art === 'spalte'
              ? [a.neu]
              : null
    if (bewegt) aufsBlatt(() => bewegt.forEach((e) => zeichne(ctx, e, true)))
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
          if (griff.name === 'drehen') {
            // Drehgriff: Kreis über dem Rahmen, mit einer Linie zur oberen Kante
            ctx.beginPath()
            ctx.moveTo(griff.x, r[1])
            ctx.lineTo(griff.x, griff.y + g / 2)
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(griff.x, griff.y, g / 2, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            continue
          }
          ctx.fillRect(griff.x - g / 2, griff.y - g / 2, g, g)
          ctx.strokeRect(griff.x - g / 2, griff.y - g / 2, g, g)
        }
      }
    }
    // Beim Drehen den Winkel neben dem Zeiger anzeigen
    if (a?.art === 'drehen') {
      const text = `${Math.round(normiereWinkel(a.basis + a.winkel))}°`
      const groesse = 16 / k.zoom
      ctx.font = `600 ${groesse}px ${SCHRIFT}`
      ctx.textBaseline = 'top'
      const breite = ctx.measureText(text).width
      const [x, y] = [a.x + 20 / k.zoom, a.y + 20 / k.zoom]
      ctx.fillStyle = '#1d5fd1'
      ctx.fillRect(x - 6 / k.zoom, y - 4 / k.zoom, breite + 12 / k.zoom, groesse + 8 / k.zoom)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(text, x, y)
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
      if (haltUhr.current) clearTimeout(haltUhr.current)
      if (nachgeplant.current) clearTimeout(nachgeplant.current)
    },
    [],
  )

  // ---------- Begradigen durch Halten ----------
  const haltUhr = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Beginnt die Haltezeit neu; steht der Stift dann noch, wird der Strich – wenn möglich – zur Form */
  function halteAn(a: Extract<Aktiv, { art: 'zeichnen' }>) {
    if (haltUhr.current) clearTimeout(haltUhr.current)
    haltUhr.current = setTimeout(() => {
      haltUhr.current = null
      if (aktiv.current !== a) return
      a.begradigt = begradige(a.strich, stand.current.kamera.zoom)
      if (a.begradigt) plane()
    }, haltezeit)
  }

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
    if (e.zelle) {
      const { t, r, s } = e.zelle
      if (text !== t.zellen[r][s]) beiErsetzen([t], [mitZelle(t, r, s, text)])
      return
    }
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
  /** Eine Zelle der Tabelle beschreiben */
  function bearbeiteZelle(t: Tabelle, r: number, s: number) {
    const l = zellLage(t, r, s)
    const [x, y] = drehePunkt(t.x + l.x, t.y + l.y, t.x, t.y, drehungVon(t))
    setVersteckt(new Set())
    setEditor({ id: null, x, y, groesse: t.groesse, farbe: t.farbe, text: t.zellen[r][s], vorher: null, zelle: { t, r, s } })
    if (!stand.current.auswahl.includes(t.id) || stand.current.auswahl.length !== 1) beiAuswahl([t.id])
  }
  /** Die Zelle an der Stelle (Tafel) beschreiben; liefert false, wenn dort keine Tabelle ist */
  function zelleAntippen(tx: number, ty: number, fang: number): boolean {
    const t = oberstesBei(stand.current.elemente.filter((el) => el.art === 'tabelle'), tx, ty, fang)
    const z = t?.art === 'tabelle' ? zelleBei(t, tx, ty) : null
    if (t?.art !== 'tabelle' || !z) return false
    bearbeiteZelle(t, z[0], z[1])
    return true
  }
  /** Tab/Enter in einer Zelle: übernehmen und zur nächsten (1) oder vorigen (−1) Zelle; am Ende eine neue Zeile */
  function zelleWeiter(richtung: 1 | -1) {
    const e = stand.current.editor
    if (!e?.zelle) return
    const { t, r, s } = e.zelle
    let neu = mitZelle(t, r, s, e.text.replace(/\s+$/, ''))
    let ziel = naechsteZelle(neu, r, s, richtung)
    if (!ziel && richtung === 1) {
      const mehr = zeileDazu(neu, neu.zellen.length - 1)
      if (mehr) {
        neu = mehr
        ziel = [r + 1, 0]
      }
    }
    if (JSON.stringify(neu) !== JSON.stringify(t)) beiErsetzen([t], [neu])
    if (ziel) bearbeiteZelle(neu, ziel[0], ziel[1])
    else setEditor(null)
  }
  /** „Einfügen“ im Feld Tabelle: anlegen, auswählen und die erste Zelle beschreiben */
  function legeTabelleAn(zeilen: number, spalten: number) {
    if (!wahl) return
    const s = stand.current
    const t = neueTabelle(wahl.tx, wahl.ty, zeilen, spalten, schriftgroesse(s.staerke), s.farbe)
    setWahl(null)
    beiHinzu(t)
    bearbeiteZelle(t, 0, 0)
  }

  // Werkzeugwechsel beendet das Schreiben
  useEffect(() => {
    if (werkzeug !== 'text' && werkzeug !== 'auswahl' && werkzeug !== 'tabelle') schliesseEditor()
    if (werkzeug !== 'tabelle') setWahl(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [werkzeug])

  // ---------- Eingabe ----------
  function ort(e: { clientX: number; clientY: number }): [number, number] {
    const r = rahmen.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  const finger = () => [...zeiger.current.values()].filter((z) => z.typ === 'touch')

  function gesteBeginnen() {
    // Eine angefangene Spur des Laserpointers verblasst wie nach dem Abheben
    if (aktiv.current?.art === 'zeigen') aktiv.current.spur.ende = Date.now()
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
    const r = RADIERER_RADIUS[stand.current.radierer.groesse] / k.zoom
    if (a.wisch) {
      // Schwamm: die ganze Bahn seit der letzten Meldung wischen, damit bei schneller Bewegung nichts stehen bleibt
      const [vx, vy] = zuTafel(k, a.vx, a.vy)
      const vorher = a.wisch.beruehrt.size
      wischeWeiter(a.wisch, vx, vy, x, y, r)
      if (a.wisch.beruehrt.size !== vorher) setVersteckt(new Set(a.wisch.beruehrt))
      return
    }
    let neu = false
    for (const e of stand.current.elemente) {
      if (!a.ids.has(e.id) && trifft(e, x, y, r)) {
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
      if (griff.name === 'drehen') {
        const [l, o, r, u] = lage.inhalt
        aktiv.current = { art: 'drehen', zeiger: e.pointerId, cx: (l + r) / 2, cy: (o + u) / 2, startX: tx, startY: ty, x: tx, y: ty, basis: drehBasis(lage.gewaehlt), originale: lage.gewaehlt, winkel: 0 }
      } else {
        aktiv.current = { art: 'skalieren', zeiger: e.pointerId, griff: griff.name, startX: tx, startY: ty, inhalt: lage.inhalt, originale: lage.gewaehlt, s: null }
      }
      return
    }
    // Eine ausgewählte Tabelle: Trennlinie zwischen Spalten ziehen
    const eine = lage && !e.shiftKey && lage.gewaehlt.length === 1 && lage.gewaehlt[0].art === 'tabelle' ? lage.gewaehlt[0] : null
    const trenner = eine ? trennerBei(eine, tx, ty, fang * 1.5) : null
    if (eine && trenner !== null) {
      aktiv.current = { art: 'spalte', zeiger: e.pointerId, t: eine, spalte: trenner, startX: innen(eine, tx, ty)[0], breite: eine.spalten[trenner], neu: eine }
      return
    }
    const treffer = oberstesBei(s.elemente, tx, ty, fang)
    if (e.shiftKey) {
      // Umschalt: das angetippte Element hinzunehmen oder herausnehmen; auf freier Fläche einen Rahmen dazu aufziehen
      if (treffer) {
        zeiger.current.delete(e.pointerId)
        const gruppe = mitGruppen(s.elemente, [treffer.id])
        beiAuswahl(s.auswahl.includes(treffer.id) ? s.auswahl.filter((id) => !gruppe.includes(id)) : [...s.auswahl, ...gruppe.filter((id) => !s.auswahl.includes(id))])
      } else aktiv.current = { art: 'rahmen', zeiger: e.pointerId, x1: tx, y1: ty, x2: tx, y2: ty, dazu: s.auswahl }
      return
    }
    if ((treffer?.art === 'text' || treffer?.art === 'tabelle') && vorher?.id === treffer.id && Date.now() - vorher.zeit < DOPPELTIPP_MS) {
      zeiger.current.delete(e.pointerId)
      if (treffer.art === 'tabelle') {
        zelleAntippen(tx, ty, fang)
        return
      }
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
      const ids = mitGruppen(s.elemente, [treffer.id]) // ein Gruppenmitglied wählt die ganze Gruppe
      beiAuswahl(ids)
      aktiv.current = { art: 'ziehen', zeiger: e.pointerId, startX: tx, startY: ty, originale: s.elemente.filter((el) => ids.includes(el.id)), dx: 0, dy: 0, tipp: treffer }
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
    if (wahl) {
      setWahl(null) // Tippen neben das Feld „Tabelle einfügen“ schließt es
      return
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* manche Browser erlauben das nicht für jeden Zeiger */
    }
    const [x, y] = ort(e)
    const laufend = aktiv.current
    const laufendTyp = laufend && laufend.art !== 'geste' ? zeiger.current.get(laufend.zeiger)?.typ : undefined
    if (e.pointerType === 'touch' && stiftGesehen && (laufendTyp === 'pen' || Date.now() - letzterStift < BALLEN_MS)) {
      // Handballen beim Schreiben: merken (damit das Abheben nichts auslöst), sonst nichts tun
      zeiger.current.set(e.pointerId, { x, y, typ: 'ballen' })
      return
    }
    zeiger.current.set(e.pointerId, { x, y, typ: e.pointerType })
    if (e.pointerType === 'pen') {
      stiftGesehen = true
      letzterStift = Date.now()
      // Der Stift hat Vorrang: eine Geste der aufliegenden Hand oder ein Fingerstrich wird verworfen
      if (laufend && (laufend.art === 'geste' || laufendTyp === 'touch')) {
        for (const z of zeiger.current.values()) if (z.typ === 'touch') z.typ = 'ballen'
        if (haltUhr.current) clearTimeout(haltUhr.current)
        haltUhr.current = null
        if (laufend.art !== 'geste') setVersteckt(new Set())
        aktiv.current = null
        zeichneOben()
      }
    }

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
    // Neben dem Blatt beginnt nichts Neues (Stift, Textmarker, Formen, Text)
    if (s.blatt && !aufBlatt(s.blatt, tx, ty) && w !== 'radierer' && w !== 'auswahl' && w !== 'laser') {
      zeiger.current.delete(e.pointerId)
      return
    }
    if (w === 'radierer') {
      const a: Aktiv = { art: 'radieren', zeiger: e.pointerId, ids: new Set(), x, y, vx: x, vy: y, wisch: s.radierer.art === 'schwamm' ? beginneWischzug(s.elemente) : null }
      aktiv.current = a
      radiere(a)
    } else if (w === 'auswahl') {
      waehleAus(e, tx, ty, fang)
      if (!aktiv.current) return
    } else if (w === 'tabelle') {
      zeiger.current.delete(e.pointerId)
      if (zelleAntippen(tx, ty, fang)) return
      const r = rahmen.current!
      setWahl({ tx, ty, x: Math.max(8, Math.min(x, r.clientWidth - 248)), y: Math.max(8, Math.min(y, r.clientHeight - 168)) })
      return
    } else if (w === 'text') {
      zeiger.current.delete(e.pointerId)
      if (zelleAntippen(tx, ty, fang)) return
      const treffer = oberstesBei(s.elemente.filter((el) => el.art === 'text'), tx, ty, fang)
      if (treffer?.art === 'text') bearbeite(treffer)
      else oeffneEditor({ id: null, x: tx, y: ty - schriftgroesse(s.staerke) * 0.6, groesse: schriftgroesse(s.staerke), farbe: s.farbe, text: '', vorher: null })
      return
    } else if (w === 'laser') {
      const spur: Spur = { punkte: [[tx, ty, Date.now()]], ende: null }
      spuren.current.push(spur)
      aktiv.current = { art: 'zeigen', zeiger: e.pointerId, spur }
    } else if (w === 'stift' || w === 'marker') {
      const stift = e.pointerType === 'pen'
      const a: Aktiv = {
        art: 'zeichnen',
        zeiger: e.pointerId,
        strich: { art: 'strich', id: neueId(), werkzeug: w, farbe: s.farbe, staerke: s.staerke, druckEcht: stift, punkte: [[tx, ty, stift ? e.pressure || 0.5 : 0.5]] },
        halt: { x, y },
        begradigt: null,
      }
      aktiv.current = a
      halteAn(a)
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
      const eine = lage.gewaehlt.length === 1 && lage.gewaehlt[0].art === 'tabelle' ? lage.gewaehlt[0] : null
      const trenner = !griff && eine ? trennerBei(eine, tx, ty, (FANG_RADIUS * 1.5) / stand.current.kamera.zoom) : null
      zeiger = griff ? GRIFF_ZEIGER[griff.name] : trenner !== null ? 'col-resize' : tx >= l && tx <= r && ty >= o && ty <= u ? 'move' : ''
    }
    if (stand.current.werkzeug === 'laser' && !leer.current) zeiger = 'none' // der rote Punkt ersetzt den Mauszeiger
    if (el.style.cursor !== zeiger) el.style.cursor = zeiger
  }

  function bewegt(e: ReactPointerEvent<HTMLDivElement>) {
    const z = zeiger.current.get(e.pointerId)
    const a = aktiv.current
    if (!a && e.pointerType === 'mouse') zeigeMauszeiger(e)
    if (!a && e.pointerType !== 'touch' && (stand.current.werkzeug === 'radierer' || stand.current.werkzeug === 'laser')) {
      const [x, y] = ort(e)
      schwebe.current = { x, y }
      plane()
    }
    if (e.pointerType === 'pen') letzterStift = Date.now()
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
      neu = stand.current.begrenze(neu)
      aktiv.current = { art: 'geste', mitteX, mitteY, abstand }
      stand.current.kamera = neu
      kameraOffen.current = neu
      plane()
      return
    }
    if (a.zeiger !== e.pointerId) return
    const [tx, ty] = zuTafel(k, x, y)

    if (a.art === 'schwenken') {
      const neu = stand.current.begrenze(verschiebe(k, x - a.x, y - a.y))
      a.x = x
      a.y = y
      stand.current.kamera = neu
      kameraOffen.current = neu
      plane()
      return
    }
    if (a.art === 'radieren') {
      a.vx = a.x
      a.vy = a.y
      a.x = x
      a.y = y
      radiere(a)
    } else if (a.art === 'ziehen') {
      const erstmals = a.dx === 0 && a.dy === 0
      a.dx = tx - a.startX
      a.dy = ty - a.startY
      if (erstmals && (a.dx !== 0 || a.dy !== 0)) setVersteckt(new Set(a.originale.map((el) => el.id)))
    } else if (a.art === 'drehen') {
      if (a.x === a.startX && a.y === a.startY) setVersteckt(new Set(a.originale.map((el) => el.id)))
      a.x = tx
      a.y = ty
      a.winkel = drehwinkel(a.cx, a.cy, a.startX, a.startY, tx, ty, a.basis, e.shiftKey)
    } else if (a.art === 'skalieren') {
      if (!a.s) setVersteckt(new Set(a.originale.map((el) => el.id)))
      a.s = skalierung(a.griff, a.inhalt, tx - a.startX, ty - a.startY)
    } else if (a.art === 'spalte') {
      if (a.neu === a.t) setVersteckt(new Set([a.t.id]))
      a.neu = mitSpaltenbreite(a.t, a.spalte, a.breite + innen(a.t, tx, ty)[0] - a.startX)
    } else if (a.art === 'rahmen') {
      a.x2 = tx
      a.y2 = ty
    } else if (a.art === 'form') {
      a.form.x2 = tx
      a.form.y2 = ty
    } else if (a.art === 'zeigen') {
      const letzter = a.spur.punkte[a.spur.punkte.length - 1]
      if (Math.hypot(tx - letzter[0], ty - letzter[1]) * k.zoom >= 0.5) a.spur.punkte.push([tx, ty, Date.now()])
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
      // Weiter als ein Zittern bewegt: die Haltezeit beginnt neu, eine schon erkannte Form gilt nicht mehr
      if (Math.hypot(x - a.halt.x, y - a.halt.y) > HALTE_TOLERANZ) {
        a.halt = { x, y }
        a.begradigt = null
        halteAn(a)
      }
    }
    plane()
  }

  function hoch(e: ReactPointerEvent<HTMLDivElement>, abgebrochen = false) {
    if (e.pointerType === 'pen') letzterStift = Date.now()
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
    if (haltUhr.current) clearTimeout(haltUhr.current)
    haltUhr.current = null
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

    if (a.art === 'zeigen') {
      // nichts speichern, nichts in den Verlauf: die Spur verblasst nur
      a.spur.ende = Date.now()
      plane()
    }
    if (a.art === 'zeichnen' && !abgebrochen) {
      if (a.begradigt) {
        // zwei Schritte: Rückgängig bringt zuerst den freihändigen Strich zurück
        fest(a.begradigt)
        beiHinzu(a.strich)
        beiBefehl({ art: 'ersetzen', vorher: [a.strich], nachher: [a.begradigt] })
      } else {
        fest(a.strich)
        beiHinzu(a.strich)
      }
    }
    if (a.art === 'form' && !abgebrochen && Math.hypot(a.form.x2 - a.form.x1, a.form.y2 - a.form.y1) * k.zoom >= 4) {
      fest(a.form)
      beiHinzu(a.form)
    }
    if (a.art === 'radieren') {
      if (a.wisch) {
        const b = abgebrochen ? null : wischBefehl(stand.current.elemente, a.wisch)
        if (b) beiBefehl(b)
      } else if (a.ids.size && !abgebrochen) beiRadieren([...a.ids])
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
        if (!stand.current.auswahl.includes(a.tipp.id)) beiAuswahl(mitGruppen(stand.current.elemente, [a.tipp.id]))
      }
      setVersteckt(new Set())
    }
    if (a.art === 'drehen') {
      if (!abgebrochen && Math.abs(a.winkel) > 1e-6) {
        const neu = a.originale.map((el) => gedreht(el, a.cx, a.cy, a.winkel))
        neu.forEach(fest)
        beiErsetzen(a.originale, neu)
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
    if (a.art === 'spalte') {
      if (!abgebrochen && a.neu.spalten[a.spalte] !== a.t.spalten[a.spalte]) {
        fest(a.neu)
        beiErsetzen([a.t], [a.neu])
      }
      setVersteckt(new Set())
    }
    if (a.art === 'rahmen' && !abgebrochen) {
      const weit = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) * k.zoom >= TIPP_WEG
      const r = rechteckAus(a.x1, a.y1, a.x2, a.y2)
      const beruehrt = weit ? stand.current.elemente.filter((el) => beruehrtRechteck(el, r)).map((el) => el.id) : []
      const neu = mitGruppen(stand.current.elemente, beruehrt).filter((id) => !a.dazu.includes(id))
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
      const neu = stand.current.begrenze(e.ctrlKey || e.metaKey ? zoomeUm(k, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01)) : verschiebe(k, -e.deltaX, -e.deltaY))
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
  const zelle = editor?.zelle ? { ...editor.zelle, l: zellLage(editor.zelle.t, editor.zelle.r, editor.zelle.s), rand: zellRand(editor.zelle.t) } : null
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
      onPointerLeave={() => {
        if (!schwebe.current) return
        schwebe.current = null
        plane()
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={unten} width={Math.round(b * dpr)} height={Math.round(h * dpr)} />
      <canvas ref={oben} width={Math.round(b * dpr)} height={Math.round(h * dpr)} />
      {editor && (
        <textarea
          className={zelle ? 'text-eingabe zell-eingabe' : 'text-eingabe'}
          aria-label={zelle ? `Zelle ${zelle.r + 1}/${zelle.s + 1} der Tabelle` : 'Text auf der Tafel'}
          autoFocus
          maxLength={zelle ? MAX_ZELLTEXT : MAX_TEXT}
          value={editor.text}
          cols={zelle ? undefined : Math.max(8, ...zeilen.map((z) => z.length + 2))}
          rows={Math.max(1, zeilen.length)}
          style={{
            left: kamera.x + editor.x * kamera.zoom,
            top: kamera.y + editor.y * kamera.zoom,
            fontSize: editor.groesse * kamera.zoom,
            lineHeight: ZEILENHOEHE,
            color: editor.farbe,
            fontFamily: SCHRIFT,
            ...(zelle
              ? {
                  width: zelle.l.b * kamera.zoom,
                  minHeight: zelle.l.h * kamera.zoom,
                  padding: zelle.rand * kamera.zoom,
                  fontWeight: zelle.t.kopf && zelle.r === 0 ? 700 : undefined,
                  transform: drehungVon(zelle.t) ? `rotate(${drehungVon(zelle.t)}deg)` : undefined,
                }
              : {}),
          }}
          onChange={(e) => setEditor({ ...editor, text: e.target.value })}
          onBlur={() => schliesseEditor()}
          onKeyDown={(e) => {
            e.stopPropagation() // Buchstaben sollen kein Werkzeug umschalten
            if (e.key === 'Escape') schliesseEditor(false)
            if (zelle && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) {
              e.preventDefault()
              zelleWeiter(e.key === 'Tab' && e.shiftKey ? -1 : 1)
            }
          }}
        />
      )}
      {wahl && <Tabellenwahl links={wahl.x} oben={wahl.y} beiFertig={legeTabelleAn} beiAbbrechen={() => setWahl(null)} />}
    </div>
  )
}
