// Seitenübersicht (Spezifikation Hintergründe, Ü1): alle Seiten als Vorschaubilder im Raster. Antippen öffnet eine
// Seite, Ziehen sortiert um, an jedem Bild „Duplizieren“ und „Löschen“. Die Vorschaubilder entstehen auf dem Gerät aus
// dem Tafelinhalt und werden nicht gespeichert; sie werden nach und nach gezeichnet (einige je Bildwechsel), damit die
// Übersicht auch mit vielen Seiten sofort aufgeht.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ZeigerEreignis } from 'react'
import { blattVon, FORMAT_MASS } from '../kern/blatt.ts'
import { seitenMass } from '../kern/geometrie.ts'
import { benutzteDateien, MAX_SEITEN, type Format, type Seite } from '../kern/modell.ts'
import { Symbol } from '../ui/Symbol.tsx'
import { beiBildGeladen } from './bildquellen.ts'
import { zeichneSeite } from './zeichnen.ts'

/** Breite der Vorschaubilder in CSS-Pixeln (gezeichnet wird in der Auflösung des Bildschirms) */
const VORSCHAU_BREITE = 320
/** Ab dieser Strecke (Pixel) ist ein Tippen ein Ziehen */
const ZIEH_SCHWELLE = 8
/** So lange (ms) muss ein Finger oder Stift auf einer Seite liegen, bis sie sich ziehen lässt – vorher rollt die Liste */
const HALTEN_MS = 300

// ---------- Zeichnen nach und nach ----------
const warteschlange: (() => void)[] = []
let geplant = false
function abarbeiten() {
  const ende = performance.now() + 10
  while (warteschlange.length && performance.now() < ende) warteschlange.shift()!()
  geplant = warteschlange.length > 0
  if (geplant) requestAnimationFrame(abarbeiten)
}
function spaeter(tun: () => void) {
  warteschlange.push(tun)
  if (!geplant) {
    geplant = true
    requestAnimationFrame(abarbeiten)
  }
}

function Vorschau({ seite, format }: { seite: Seite; format: Format }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const blatt = blattVon(format, seite)
  const ausschnitt = seitenMass(seite, blatt)
  const [, , b, h] = ausschnitt
  useEffect(() => {
    let lebt = true
    const zeichnen = () => {
      const c = canvas.current
      if (!lebt || !c) return
      const dichte = Math.min(2, window.devicePixelRatio || 1)
      const massstab = (VORSCHAU_BREITE * dichte) / b
      c.width = Math.round(b * massstab)
      c.height = Math.round(h * massstab)
      const ctx = c.getContext('2d')
      if (ctx) zeichneSeite(ctx, seite, ausschnitt, massstab, blatt)
    }
    spaeter(zeichnen)
    // Bilder und PDF-Seiten kommen erst nach und nach aus dem Speicher – dann noch einmal zeichnen
    const abbestellen = benutzteDateien([seite]).size ? beiBildGeladen(() => spaeter(zeichnen)) : () => undefined
    return () => {
      lebt = false
      abbestellen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Seiten sind unveränderlich: neue Seite = neues Objekt
  }, [seite, format])
  // Vorläufige Größe im richtigen Seitenverhältnis, bis gezeichnet ist (sonst springt das Raster)
  return <canvas ref={canvas} className="vorschau-bild" width={VORSCHAU_BREITE} height={Math.max(1, Math.round((VORSCHAU_BREITE * h) / b))} aria-hidden="true" />
}

type Props = {
  seiten: Seite[]
  nr: number
  format: Format
  beiGehe: (nr: number) => void
  beiVerschieben: (von: number, nach: number) => void
  /** Reihenfolge wiederherstellen (Kennungen der Seiten) */
  beiReihenfolge: (ids: string[]) => void
  beiDoppelt: (nr: number) => void
  beiLoeschen: (nr: number) => void
  beiNeu: () => void
  beiSchliessen: () => void
}

type Zug = { fange: () => void; nr: number; zeiger: number; x: number; y: number; rollen: number; gezogen: boolean; gehoben: boolean; uhr?: ReturnType<typeof setTimeout> }

export function Seitenuebersicht(p: Props) {
  const raster = useRef<HTMLOListElement>(null)
  const zug = useRef<Zug | null>(null)
  /** Nach einem Ziehen oder Rollen keinen Klick als „Seite öffnen“ werten */
  const klickWeg = useRef(false)
  const [ziehen, setZiehen] = useState<{ von: number; ziel: number } | null>(null)
  const [frage, setFrage] = useState<number | null>(null)
  /** Reihenfolge beim ersten Umsortieren – für „Reihenfolge zurücksetzen“ */
  const [vorher, setVorher] = useState<string[] | null>(null)
  const voll = p.seiten.length >= MAX_SEITEN

  useEffect(() => {
    raster.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus({ preventScroll: false })
    raster.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' })
    // nur beim Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (frage !== null) setFrage(null)
      else p.beiSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [frage, p])

  /** Stelle der Seite unter dem Zeiger (oder null) */
  function stelleBei(x: number, y: number): number | null {
    for (const el of raster.current?.querySelectorAll<HTMLElement>('[data-nr]') ?? []) {
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return Number(el.dataset.nr)
    }
    return null
  }

  const verschiebe = (von: number, nach: number) => {
    if (von === nach) return
    setVorher((alt) => alt ?? p.seiten.map((s) => s.id))
    setFrage(null)
    p.beiVerschieben(von, nach)
  }

  function runter(e: ZeigerEreignis<HTMLLIElement>, nr: number) {
    if (zug.current || (e.target as HTMLElement).closest('.vs-befehle') || (e.pointerType === 'mouse' && e.button !== 0)) return
    // Den Zeiger erst einfangen, wenn gezogen oder gerollt wird – sonst ginge der Klick an die Kachel statt an den Knopf
    const kachel = e.currentTarget
    const fange = () => kachel.setPointerCapture?.(e.pointerId)
    klickWeg.current = false
    const z: Zug = { fange, nr, zeiger: e.pointerId, x: e.clientX, y: e.clientY, rollen: raster.current?.scrollTop ?? 0, gezogen: false, gehoben: e.pointerType === 'mouse' }
    if (!z.gehoben) {
      z.uhr = setTimeout(() => {
        z.fange()
        z.gehoben = true
        z.gezogen = true
        klickWeg.current = true
        setZiehen({ von: nr, ziel: nr })
      }, HALTEN_MS)
    }
    zug.current = z
  }
  function bewegt(e: ZeigerEreignis<HTMLLIElement>) {
    const z = zug.current
    if (!z || z.zeiger !== e.pointerId) return
    const dx = e.clientX - z.x
    const dy = e.clientY - z.y
    const weit = Math.hypot(dx, dy) > ZIEH_SCHWELLE
    if (!z.gehoben) {
      // Finger oder Stift vor dem Halten: die Liste rollt
      if (weit) {
        if (!klickWeg.current) z.fange()
        clearTimeout(z.uhr)
        klickWeg.current = true
        if (raster.current) raster.current.scrollTop = z.rollen - dy
      }
      return
    }
    if (!z.gezogen) {
      if (!weit) return
      z.fange()
      z.gezogen = true
      klickWeg.current = true
      setZiehen({ von: z.nr, ziel: z.nr })
    }
    // Am oberen oder unteren Rand rollt die Liste mit
    const r = raster.current?.getBoundingClientRect()
    if (r && raster.current) {
      if (e.clientY < r.top + 40) raster.current.scrollTop -= 12
      else if (e.clientY > r.bottom - 40) raster.current.scrollTop += 12
    }
    const ziel = stelleBei(e.clientX, e.clientY)
    if (ziel !== null) setZiehen((alt) => (alt && alt.ziel !== ziel ? { ...alt, ziel } : alt))
  }
  function hoch(e: ZeigerEreignis<HTMLLIElement>, abbrechen = false) {
    const z = zug.current
    if (!z || z.zeiger !== e.pointerId) return
    clearTimeout(z.uhr)
    zug.current = null
    if (z.gezogen && !abbrechen) {
      const ziel = stelleBei(e.clientX, e.clientY) ?? ziehen?.ziel ?? z.nr
      verschiebe(z.nr, ziel)
    }
    setZiehen(null)
  }

  const oeffne = (nr: number) => {
    if (klickWeg.current) {
      klickWeg.current = false
      return
    }
    p.beiGehe(nr)
  }

  return (
    <div className="seitenuebersicht" role="dialog" aria-modal="true" aria-label="Seitenübersicht">
      <header className="vs-kopf">
        <h2>
          Seiten <span>{p.seiten.length}</span>
        </h2>
        <p className="vs-hinweis">Antippen öffnet eine Seite. Ziehen sortiert um – mit Finger oder Stift erst kurz halten.</p>
        {vorher && (
          <button
            type="button"
            className="f-knopf"
            onClick={() => {
              p.beiReihenfolge(vorher)
              setVorher(null)
            }}
          >
            Reihenfolge zurücksetzen
          </button>
        )}
        <button type="button" className="f-knopf haupt" onClick={p.beiSchliessen}>
          Fertig
        </button>
      </header>
      <ol
        ref={raster}
        className="vs-raster"
        // Kacheln im Seitenverhältnis des Formats (unendlich: 4 : 3); abweichende Seiten (PDF) passen sich ein
        style={{ '--vs-verhaeltnis': p.format === 'unendlich' ? '4 / 3' : `${FORMAT_MASS[p.format][0]} / ${FORMAT_MASS[p.format][1]}` } as CSSProperties}
      >
        {p.seiten.map((s, i) => {
          const ziel = ziehen && ziehen.ziel === i && ziehen.von !== i ? (ziehen.ziel < ziehen.von ? ' ziel-vor' : ' ziel-nach') : ''
          const beschrieben = s.elemente.length > 0 || s.hintergrund !== undefined
          return (
            <li
              key={s.id}
              data-nr={i}
              className={'vs-kachel' + (i === p.nr ? ' aktuell' : '') + (ziehen?.von === i ? ' gehoben' : '') + ziel}
              onPointerDown={(e) => runter(e, i)}
              onPointerMove={bewegt}
              onPointerUp={(e) => hoch(e)}
              onPointerCancel={(e) => hoch(e, true)}
            >
              <button type="button" className="vs-seite" aria-current={i === p.nr ? 'page' : undefined} aria-label={`Seite ${i + 1} öffnen`} onClick={() => oeffne(i)}>
                <Vorschau seite={s} format={p.format} />
              </button>
              {frage === i ? (
                <div className="vs-befehle frage" role="group" aria-label={`Seite ${i + 1} löschen?`}>
                  <span>Löschen?</span>
                  <button
                    type="button"
                    className="s-knopf mit-text gefahr"
                    onClick={() => {
                      setFrage(null)
                      setVorher(null)
                      p.beiLoeschen(i)
                    }}
                  >
                    Ja
                  </button>
                  <button type="button" className="s-knopf mit-text" onClick={() => setFrage(null)}>
                    Nein
                  </button>
                </div>
              ) : (
                <div className="vs-befehle">
                  <span className="vs-nummer">{i + 1}</span>
                  <button
                    type="button"
                    className="s-knopf"
                    disabled={voll}
                    aria-label={`Seite ${i + 1} duplizieren`}
                    title="Duplizieren"
                    onClick={() => {
                      setVorher(null)
                      p.beiDoppelt(i)
                    }}
                  >
                    <Symbol name="duplizieren" />
                  </button>
                  <button
                    type="button"
                    className="s-knopf"
                    disabled={p.seiten.length === 1 && !beschrieben}
                    aria-label={`Seite ${i + 1} löschen`}
                    title="Löschen"
                    onClick={() => {
                      if (beschrieben) return setFrage(i)
                      setVorher(null)
                      p.beiLoeschen(i)
                    }}
                  >
                    <Symbol name="leeren" />
                  </button>
                </div>
              )}
            </li>
          )
        })}
        <li className="vs-kachel neu">
          <button type="button" className="vs-seite" disabled={voll} onClick={p.beiNeu}>
            <Symbol name="plus" />
            Neue Seite
          </button>
        </li>
      </ol>
    </div>
  )
}
