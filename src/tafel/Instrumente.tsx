// Lineal, Geodreieck, Winkelmesser und Zirkel über der Zeichenfläche. Sie liegen in Tafel-Koordinaten und wachsen mit dem Zoom.
// Ziehen am Körper verschiebt, zwei Finger drehen und verschieben, der runde Griff dreht um den Nullpunkt.
// Das Anlegen des Stifts an die Kanten geschieht in der Zeichenfläche (kern/instrumente.ts: fangeKante, anKante).
import { memo, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { zuTafel } from '../kern/geometrie.ts'
import {
  CM,
  dreheAmGriff,
  folgeZweiFingern,
  griffe,
  INSTRUMENT_NAMEN,
  INSTRUMENT_SKALA_MAX,
  INSTRUMENT_SKALA_MIN,
  klemmeRadius,
  klemmeSkala,
  radiusAmGriff,
  radiusText,
  ZIRKEL_RADIUS,
  zirkelLage,
  zirkelRadius,
  rasteWinkel,
  skaliereAmGriff,
  teilstriche,
  umriss,
  verschiebeInstrument,
  winkelText,
  zuTafelPunkt,
  type Instrument,
  type InstrumentArt,
} from '../kern/instrumente.ts'
import type { Kamera } from '../kern/modell.ts'
import { Symbol } from '../ui/Symbol.tsx'
import { istHandballen } from './handballen.ts'
import '../fenster/werkzeuge.css'

type P = [number, number]
type Modus = 'schieben' | 'drehen' | 'groesse' | 'radius'

/** Teilstriche und Zahlen – ändern sich nie, deshalb nur einmal je Art gezeichnet */
const Skala = memo(function Skala({ art }: { art: InstrumentArt }) {
  const striche = teilstriche(art)
  const pfad = striche.map((t) => `M${t.a[0]} ${t.a[1]}L${t.b[0]} ${t.b[1]}`).join('')
  return (
    <g className="skala">
      <path d={pfad} />
      {striche.map((t, i) =>
        t.text && t.t ? (
          <text key={i} x={t.t[0]} y={t.t[1]} fontSize={0.34 * CM} textAnchor="middle" dominantBaseline="central">
            {t.text}
          </text>
        ) : null,
      )}
    </g>
  )
})

type Props = {
  liste: Instrument[]
  kamera: Kamera
  beiAendern: (art: InstrumentArt, neu: Instrument | null) => void
}

export function Instrumente({ liste, kamera, beiAendern }: Props) {
  const ebene = useRef<HTMLDivElement>(null)
  /** Finger bzw. Zeiger auf einem Werkzeug: wo sie beim Aufsetzen waren und jetzt sind (Tafel-Koordinaten) */
  const zeiger = useRef(new Map<number, { start: P; jetzt: P }>())
  const zug = useRef<{ art: InstrumentArt; start: Instrument; modus: Modus } | null>(null)
  const stand = useRef({ liste, kamera })
  stand.current = { liste, kamera }

  // Ein anderes Werkzeug oder Schließen beendet einen laufenden Zug
  useEffect(() => {
    if (zug.current && !liste.some((i) => i.art === zug.current!.art)) {
      zug.current = null
      zeiger.current.clear()
    }
  }, [liste])

  const tafelPunkt = (e: { clientX: number; clientY: number }): P => {
    const r = ebene.current!.getBoundingClientRect()
    return zuTafel(stand.current.kamera, e.clientX - r.left, e.clientY - r.top)
  }

  function greifen(e: ReactPointerEvent<Element>, i: Instrument, modus: Modus) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (istHandballen(e.nativeEvent) && !zeiger.current.size) return // aufliegende Hand beim Schreiben: Werkzeug bleibt liegen
    e.preventDefault()
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* nicht jeder Browser erlaubt das für jeden Zeiger */
    }
    if (zug.current && zug.current.art !== i.art) return
    const p = tafelPunkt(e)
    zeiger.current.set(e.pointerId, { start: p, jetzt: p })
    // Neuer Ausgangspunkt für alle Finger, damit der Wechsel von einem auf zwei Finger nicht springt
    for (const z of zeiger.current.values()) z.start = z.jetzt
    zug.current = { art: i.art, start: i, modus: modus !== 'schieben' && zeiger.current.size === 1 ? modus : 'schieben' }
  }

  function ziehen(e: ReactPointerEvent<Element>) {
    const z = zeiger.current.get(e.pointerId)
    const zg = zug.current
    if (!z || !zg) return
    z.jetzt = tafelPunkt(e)
    const finger = [...zeiger.current.values()]
    let neu: Instrument
    if (zg.modus === 'drehen') neu = dreheAmGriff(zg.start, zg.start.winkel, z.start, z.jetzt)
    else if (zg.modus === 'radius') neu = radiusAmGriff(zg.start, z.jetzt)
    else if (zg.modus === 'groesse') neu = skaliereAmGriff(zg.start, zg.start.skala ?? 1, z.start, z.jetzt)
    else if (finger.length >= 2) neu = folgeZweiFingern(zg.start, finger[0].start, finger[1].start, finger[0].jetzt, finger[1].jetzt)
    else neu = verschiebeInstrument(zg.start, z.jetzt[0] - z.start[0], z.jetzt[1] - z.start[1])
    beiAendern(zg.art, neu)
  }

  function loslassen(e: ReactPointerEvent<Element>) {
    if (!zeiger.current.delete(e.pointerId)) return
    const zg = zug.current
    if (!zg) return
    if (!zeiger.current.size) {
      zug.current = null
      const fertig = stand.current.liste.find((i) => i.art === zg.art)
      // Mit zwei Fingern gedreht: am Ende auf volle 15° einrasten, wenn es knapp daneben liegt
      if (fertig && zg.modus === 'schieben') {
        const w = rasteWinkel(fertig.winkel)
        if (w !== fertig.winkel) beiAendern(fertig.art, { ...fertig, winkel: w })
      }
      return
    }
    // ein Finger bleibt: von hier aus weiter verschieben
    const jetzt = stand.current.liste.find((i) => i.art === zg.art)
    for (const z of zeiger.current.values()) z.start = z.jetzt
    if (jetzt) zug.current = { art: zg.art, start: jetzt, modus: 'schieben' }
  }

  const k = kamera
  const bildschirm = (i: Instrument, p: P) => {
    const [tx, ty] = zuTafelPunkt(i, p[0], p[1])
    return { left: k.x + tx * k.zoom, top: k.y + ty * k.zoom }
  }

  return (
    <div ref={ebene} className="instrumente">
      <svg className="instrument-flaeche" aria-hidden="true">
        <g transform={`translate(${k.x} ${k.y}) scale(${k.zoom})`}>
          {liste.map((i) => (
            <g key={i.art} className={'instrument instrument-' + i.art} transform={`translate(${i.x} ${i.y}) rotate(${i.winkel}) scale(${i.skala ?? 1})`}>
              <path
                className="instrument-koerper"
                d={umriss(i.art, zirkelRadius(i))}
                strokeWidth={1.5 / (k.zoom * (i.skala ?? 1))}
                onPointerDown={(e) => greifen(e, i, 'schieben')}
                onPointerMove={ziehen}
                onPointerUp={loslassen}
                onPointerCancel={loslassen}
              />
              <g strokeWidth={1 / (k.zoom * (i.skala ?? 1))}>
                <Skala art={i.art} />
              </g>
              {i.art === 'zirkel' && (
                <>
                  {/* Kreis der Mine: hier entlang zeichnet der Stift */}
                  <circle className="zirkel-kreis" r={zirkelRadius(i) * CM} strokeWidth={1.5 / k.zoom} strokeDasharray={`${6 / k.zoom} ${5 / k.zoom}`} />
                  <circle className="zirkel-mine" cx={zirkelLage(zirkelRadius(i)).mine[0]} r={3 / k.zoom} />
                </>
              )}
              <circle className="nullpunkt" r={4 / (k.zoom * (i.skala ?? 1))} />
            </g>
          ))}
        </g>
      </svg>
      {liste.map((i) => {
        const g = griffe(i.art, zirkelRadius(i))
        const zirkel = i.art === 'zirkel'
        const name = INSTRUMENT_NAMEN[i.art]
        return (
          <div key={i.art}>
            <div
              className="instrument-griff"
              role="slider"
              tabIndex={0}
              aria-label={`${name} drehen`}
              aria-valuemin={-180}
              aria-valuemax={180}
              aria-valuenow={Math.round(i.winkel)}
              aria-valuetext={winkelText(i.winkel)}
              title="Ziehen: um den Nullpunkt drehen"
              style={bildschirm(i, g.drehen)}
              onPointerDown={(e) => greifen(e, i, 'drehen')}
              onPointerMove={ziehen}
              onPointerUp={loslassen}
              onPointerCancel={loslassen}
              onKeyDown={(e) => {
                const richtung = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0
                if (!richtung) return
                e.preventDefault()
                e.stopPropagation() // Pfeiltasten sollen hier nicht die Tafel bewegen
                beiAendern(i.art, { ...i, winkel: rasteWinkel(i.winkel + richtung * (e.shiftKey ? 15 : 1)) })
              }}
            >
              <Symbol name="drehenRechts" />
            </div>
            {zirkel ? (
              <div
                className="instrument-griff groesse"
                role="slider"
                tabIndex={0}
                aria-label="Radius des Zirkels"
                aria-valuemin={5}
                aria-valuemax={150}
                aria-valuenow={Math.round(zirkelRadius(i) * 10)}
                aria-valuetext={radiusText(zirkelRadius(i))}
                title="Ziehen: Radius aufziehen und Zirkel drehen – Doppeltippen: 4 cm"
                style={bildschirm(i, g.groesse)}
                onPointerDown={(e) => greifen(e, i, 'radius')}
                onPointerMove={ziehen}
                onPointerUp={loslassen}
                onPointerCancel={loslassen}
                onDoubleClick={() => beiAendern(i.art, { ...i, radius: ZIRKEL_RADIUS })}
                onKeyDown={(e) => {
                  const richtung = e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-' ? -1 : 0
                  if (!richtung) return
                  e.preventDefault()
                  e.stopPropagation()
                  beiAendern(i.art, { ...i, radius: klemmeRadius(zirkelRadius(i) + richtung * (e.shiftKey ? 1 : 0.1)) })
                }}
              >
                <Symbol name="groesse" />
              </div>
            ) : (
            <div
              className="instrument-griff groesse"
              role="slider"
              tabIndex={0}
              aria-label={`Größe von ${name}`}
              aria-valuemin={Math.round(INSTRUMENT_SKALA_MIN * 100)}
              aria-valuemax={Math.round(INSTRUMENT_SKALA_MAX * 100)}
              aria-valuenow={Math.round((i.skala ?? 1) * 100)}
              aria-valuetext={`${Math.round((i.skala ?? 1) * 100)} %`}
              title="Ziehen: Größe ändern – Doppeltippen: Normalgröße"
              style={bildschirm(i, g.groesse)}
              onPointerDown={(e) => greifen(e, i, 'groesse')}
              onPointerMove={ziehen}
              onPointerUp={loslassen}
              onPointerCancel={loslassen}
              onDoubleClick={() => beiAendern(i.art, { ...i, skala: undefined })}
              onKeyDown={(e) => {
                const richtung = e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-' ? -1 : 0
                if (!richtung) return
                e.preventDefault()
                e.stopPropagation()
                beiAendern(i.art, { ...i, skala: klemmeSkala((i.skala ?? 1) + richtung * 0.1) })
              }}
            >
              <Symbol name="groesse" />
            </div>
            )}
            <span className="instrument-winkel" style={bildschirm(i, g.winkel)} aria-hidden="true">
              {zirkel ? 'r = ' + radiusText(zirkelRadius(i)) : winkelText(i.winkel)}
            </span>
            <button type="button" className="instrument-schliessen" aria-label={`${name} wegnehmen`} title={`${name} wegnehmen`} style={bildschirm(i, g.schliessen)} onClick={() => beiAendern(i.art, null)}>
              <Symbol name="schliessen" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
