// Knopf „Hintergrund“ oben in der rechten Leiste: Muster für diese Seite oder alle Seiten wählen (mit Vorschau),
// Abstand und Linienfarbe einstellen, Muster beim PDF-Export weglassen. Jeder Wechsel lässt sich zurücknehmen.
import { useEffect, useRef, useState } from 'react'
import { FORMAT_MASS } from '../kern/blatt.ts'
import { MUSTER, MUSTERGRUPPEN, musterTeile } from '../kern/muster.ts'
import { MUSTERARTEN, type Format, type Muster, type Musterart } from '../kern/modell.ts'
import { Symbol } from '../ui/Symbol.tsx'
import { zeichneMusterteile } from './zeichnen.ts'

type Props = {
  format: Format
  /** Muster der gezeigten Seite (fehlt: leer) */
  muster?: Muster
  /** Hat die gezeigte Seite ein PDF oder Bild als Hintergrund? */
  mitHintergrund: boolean
  beiMuster: (m: Muster | undefined, alleSeiten: boolean) => void
  ohneMusterExport: boolean
  beiOhneMusterExport: (ja: boolean) => void
}

const VORSCHAU_B = 84
const VORSCHAU_H = 48

/** Kleines Bild des Musters: Linienmuster als Ausschnitt (so sieht man den Abstand), Seitenmuster als ganzes Blatt */
function Vorschau({ muster }: { muster?: Muster }) {
  const leinwand = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = leinwand.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    if (!muster) return
    const ganz = MUSTER[muster.art].nurBlatt
    const blatt = FORMAT_MASS['16:9']
    const zoom = ganz ? VORSCHAU_B / blatt[0] : 0.3
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0)
    const bereich: [number, number, number, number] = [0, 0, VORSCHAU_B / zoom, VORSCHAU_H / zoom]
    // Beschriftungen wären in der Vorschau nur Krümel – weglassen
    zeichneMusterteile(ctx, musterTeile(muster, bereich, blatt, zoom * 1.6).filter((t) => t.art !== 'text'), zoom)
  }, [muster])
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return <canvas ref={leinwand} className="muster-vorschau" width={Math.round(VORSCHAU_B * dpr)} height={Math.round(VORSCHAU_H * dpr)} aria-hidden="true" />
}

export function Hintergrundwahl({ format, muster, mitHintergrund, beiMuster, ohneMusterExport, beiOhneMusterExport }: Props) {
  const [lage, setLage] = useState<{ rechts: number; oben: number } | null>(null)
  const [alle, setAlle] = useState(false)
  const knopf = useRef<HTMLButtonElement>(null)
  const feld = useRef<HTMLDivElement>(null)
  const offen = lage !== null

  useEffect(() => {
    if (!offen) return
    const draussen = (e: PointerEvent) => {
      const ziel = e.target as Node
      if (feld.current?.contains(ziel) || knopf.current?.contains(ziel)) return
      setLage(null)
    }
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && setLage(null)
    document.addEventListener('pointerdown', draussen, true)
    window.addEventListener('keydown', taste)
    return () => {
      document.removeEventListener('pointerdown', draussen, true)
      window.removeEventListener('keydown', taste)
    }
  }, [offen])

  /** Öffnet das Feld links neben der rechten Leiste, auf Höhe des Knopfes */
  const umschalten = () => {
    if (offen) return setLage(null)
    const leiste = knopf.current?.closest('aside')?.getBoundingClientRect()
    const r = knopf.current?.getBoundingClientRect()
    setLage({ rechts: window.innerWidth - (leiste?.left ?? window.innerWidth - 100) + 8, oben: Math.max(8, r?.top ?? 8) })
  }

  const unendlich = format === 'unendlich'
  const gesperrt = !alle && mitHintergrund
  const angaben = muster ? MUSTER[muster.art] : null
  const waehle = (art: Musterart | null) => beiMuster(art ? { art, ...(muster?.abstand ? { abstand: muster.abstand } : {}), ...(muster?.farbe ? { farbe: muster.farbe } : {}) } : undefined, alle)
  const aendere = (neu: Partial<Muster>) => {
    if (!muster) return
    const m: Muster = { art: muster.art }
    const abstand = 'abstand' in neu ? neu.abstand : muster.abstand
    const farbe = 'farbe' in neu ? neu.farbe : muster.farbe
    if (abstand) m.abstand = abstand
    if (farbe) m.farbe = farbe
    beiMuster(m, alle)
  }

  return (
    <>
      <button ref={knopf} type="button" className="leisten-knopf mit-text" aria-label="Hintergrund" aria-expanded={offen} title="Hintergrund: liniert, kariert, Koordinatensystem …" onClick={umschalten}>
        <Symbol name="hintergrund" />
        <span>Hintergrund</span>
      </button>
      {lage && (
        <div ref={feld} className="aufklappfeld hintergrundfeld" role="dialog" aria-label="Hintergrund" style={{ right: lage.rechts, top: lage.oben, maxHeight: window.innerHeight - lage.oben - 8 }}>
          <div className="segmente" role="group" aria-label="Gilt für">
            <button type="button" aria-pressed={!alle} onClick={() => setAlle(false)}>
              Diese Seite
            </button>
            <button type="button" aria-pressed={alle} onClick={() => setAlle(true)}>
              Alle Seiten
            </button>
          </div>
          {gesperrt && <p className="feld-hinweis">Diese Seite hat ein PDF oder Bild als Hintergrund – dort gibt es kein Muster.</p>}
          {alle && <p className="feld-hinweis">Seiten mit PDF oder Bild als Hintergrund bleiben, wie sie sind.</p>}
          <div className="muster-liste">
            {MUSTERGRUPPEN.map((gruppe, i) => (
              <section key={gruppe} aria-label={gruppe}>
                <p className="feld-titel">{gruppe}</p>
                <div className="muster-raster">
                  {i === 0 && (
                    <button type="button" className="muster-knopf" aria-pressed={!muster} disabled={gesperrt} onClick={() => waehle(null)}>
                      <Vorschau />
                      Leer
                    </button>
                  )}
                  {MUSTERARTEN.filter((a) => MUSTER[a].gruppe === gruppe).map((art) => {
                    const nurBlatt = unendlich && MUSTER[art].nurBlatt
                    return (
                      <button
                        key={art}
                        type="button"
                        className="muster-knopf"
                        aria-pressed={muster?.art === art}
                        disabled={gesperrt || nurBlatt}
                        title={nurBlatt ? 'Nur mit festem Format (16:9 oder A4)' : undefined}
                        onClick={() => waehle(art)}
                      >
                        <Vorschau muster={{ art, ...(muster?.farbe ? { farbe: muster.farbe } : {}) }} />
                        {MUSTER[art].name}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
          {angaben?.abstand && !gesperrt && (
            <div className="segmente" role="group" aria-label="Abstand">
              {(['eng', undefined, 'weit'] as const).map((a) => (
                <button key={a ?? 'mittel'} type="button" aria-pressed={muster?.abstand === a} onClick={() => aendere({ abstand: a })}>
                  {a === 'eng' ? 'Eng' : a === 'weit' ? 'Weit' : 'Mittel'}
                </button>
              ))}
            </div>
          )}
          {muster && !gesperrt && (
            <div className="segmente" role="group" aria-label="Linienfarbe">
              <button type="button" aria-pressed={!muster.farbe} onClick={() => aendere({ farbe: undefined })}>
                Grau
              </button>
              <button type="button" aria-pressed={muster.farbe === 'blau'} onClick={() => aendere({ farbe: 'blau' })}>
                Blau
              </button>
            </div>
          )}
          <label className="feld-schalter">
            <input type="checkbox" checked={ohneMusterExport} onChange={(e) => beiOhneMusterExport(e.target.checked)} />
            Muster beim PDF-Export weglassen
          </label>
        </div>
      )}
    </>
  )
}
