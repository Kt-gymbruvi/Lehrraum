// Linke Werkzeugleiste der Tafel – bleibt dauerhaft sichtbar. Zwei Knöpfe nebeneinander, damit alles ohne Rollen passt.
// Erneutes Antippen des gewählten Radierers öffnet ein Feld mit Art und Größe; es schließt sich beim Antippen
// der Tafel (oder sonst irgendwo außerhalb), mit Escape und beim Wechsel des Werkzeugs.
import { useEffect, useRef, useState } from 'react'
import { FARBEN, STAERKEN } from '../kern/modell.ts'
import { RADIERER_ARTEN, RADIERER_GROESSEN, RADIERER_RADIUS, type Radierer } from '../kern/radieren.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'
import type { Werkzeug } from './Zeichenflaeche.tsx'

type Props = {
  werkzeug: Werkzeug
  farbe: string
  staerke: number
  radierer: Radierer
  beiRadierer: (r: Radierer) => void
  kannZurueck: boolean
  kannVor: boolean
  leer: boolean
  /** Anzahl ausgewählter Elemente */
  gewaehlt: number
  /** Gibt es etwas Kopiertes zum Einfügen? */
  kannEinfuegen: boolean
  beiWerkzeug: (w: Werkzeug) => void
  beiFarbe: (f: string) => void
  beiStaerke: (s: number) => void
  beiZurueck: () => void
  beiVor: () => void
  beiLeeren: () => void
  beiEinfuegen: () => void
  beiLoeschen: () => void
  beiBild: () => void
}

export const WERKZEUGE: { wert: Werkzeug; name: string; symbol: SymbolName; taste: string }[] = [
  { wert: 'auswahl', name: 'Auswahl', symbol: 'auswahl', taste: 'A' },
  { wert: 'hand', name: 'Hand', symbol: 'hand', taste: 'H' },
  { wert: 'stift', name: 'Stift', symbol: 'stift', taste: 'S' },
  { wert: 'marker', name: 'Textmarker', symbol: 'marker', taste: 'M' },
  { wert: 'radierer', name: 'Radierer', symbol: 'radierer', taste: 'R' },
  { wert: 'text', name: 'Text', symbol: 'text', taste: 'T' },
  { wert: 'linie', name: 'Linie', symbol: 'linie', taste: 'L' },
  { wert: 'pfeil', name: 'Pfeil', symbol: 'pfeil', taste: 'P' },
  { wert: 'rechteck', name: 'Rechteck', symbol: 'rechteck', taste: 'Q' },
  { wert: 'ellipse', name: 'Ellipse', symbol: 'ellipse', taste: 'O' },
]

export function Werkzeugleiste(p: Props) {
  const radiererKnopf = useRef<HTMLButtonElement>(null)
  const feldRef = useRef<HTMLDivElement>(null)
  /** Lage des Feldes „Art und Größe des Radierers“ (Bildschirm) oder null, wenn zu */
  const [feld, setFeld] = useState<{ links: number; oben: number } | null>(null)
  const offen = feld !== null && p.werkzeug === 'radierer'

  useEffect(() => {
    if (!offen) return
    const draussen = (e: PointerEvent) => {
      const ziel = e.target as Node
      if (feldRef.current?.contains(ziel) || radiererKnopf.current?.contains(ziel)) return
      setFeld(null)
    }
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && setFeld(null)
    document.addEventListener('pointerdown', draussen, true)
    window.addEventListener('keydown', taste)
    return () => {
      document.removeEventListener('pointerdown', draussen, true)
      window.removeEventListener('keydown', taste)
    }
  }, [offen])

  const waehle = (w: Werkzeug) => {
    if (w !== 'radierer' || p.werkzeug !== 'radierer') {
      setFeld(null)
      p.beiWerkzeug(w)
      return
    }
    if (offen) return setFeld(null)
    // rechts neben die ganze Leiste, auf Höhe des Knopfes
    const r = radiererKnopf.current?.getBoundingClientRect()
    const leiste = radiererKnopf.current?.closest('aside')?.getBoundingClientRect()
    setFeld({ links: (leiste?.right ?? r?.right ?? 64) + 8, oben: Math.max(8, Math.min(r?.top ?? 8, window.innerHeight - 240)) })
  }
  const artName = RADIERER_ARTEN.find((a) => a.wert === p.radierer.art)?.name ?? ''

  return (
    <aside className="werkzeugleiste links" aria-label="Zeichenwerkzeuge">
      <div className="gruppe" role="group" aria-label="Werkzeug">
        {WERKZEUGE.map((w) =>
          w.wert === 'radierer' ? (
            <button
              key={w.wert}
              ref={radiererKnopf}
              type="button"
              className="leisten-knopf hat-feld"
              aria-pressed={p.werkzeug === w.wert}
              aria-label={w.name}
              aria-expanded={offen}
              title={`${w.name}: ${artName} (${w.taste}) – noch einmal antippen: Art und Größe`}
              onClick={() => waehle(w.wert)}
            >
              <Symbol name={p.radierer.art === 'schwamm' ? 'schwamm' : 'radierer'} />
            </button>
          ) : (
            <button key={w.wert} type="button" className="leisten-knopf" aria-pressed={p.werkzeug === w.wert} aria-label={w.name} title={`${w.name} (${w.taste})`} onClick={() => waehle(w.wert)}>
              <Symbol name={w.symbol} />
            </button>
          ),
        )}
        <button type="button" className="leisten-knopf" aria-label="Bild einfügen" title="Bild einfügen (auch per Einfügen aus der Zwischenablage oder Hineinziehen)" onClick={p.beiBild}>
          <Symbol name="bild" />
        </button>
      </div>

      <div className="gruppe" role="group" aria-label="Farbe">
        {FARBEN.map((f) => (
          <button key={f.wert} type="button" className="farb-knopf" aria-pressed={p.farbe === f.wert} aria-label={f.name} title={f.name} onClick={() => p.beiFarbe(f.wert)}>
            <span style={{ background: f.wert }} />
          </button>
        ))}
      </div>

      <div className="gruppe drei" role="group" aria-label="Strichstärke und Schriftgröße">
        {STAERKEN.map((s) => (
          <button key={s.wert} type="button" className="leisten-knopf schmal" aria-pressed={p.staerke === s.wert} aria-label={'Strichstärke ' + s.name} title={'Strichstärke und Schriftgröße: ' + s.name} onClick={() => p.beiStaerke(s.wert)}>
            <span className="staerke-punkt" style={{ width: s.wert * 1.4 + 2, height: s.wert * 1.4 + 2 }} />
          </button>
        ))}
      </div>

      <div className="gruppe" role="group" aria-label="Verlauf">
        <button type="button" className="leisten-knopf" disabled={!p.kannZurueck} aria-label="Rückgängig" title="Rückgängig (Strg + Z)" onClick={p.beiZurueck}>
          <Symbol name="zurueck" />
        </button>
        <button type="button" className="leisten-knopf" disabled={!p.kannVor} aria-label="Wiederholen" title="Wiederholen (Strg + Y)" onClick={p.beiVor}>
          <Symbol name="vor" />
        </button>
        <button type="button" className="leisten-knopf" disabled={!p.kannEinfuegen} aria-label="Einfügen" title="Kopiertes einfügen – auch aus einer anderen Tafel (Strg + V)" onClick={p.beiEinfuegen}>
          <Symbol name="einfuegen" />
        </button>
        <button
          type="button"
          className="leisten-knopf"
          disabled={p.gewaehlt === 0 && p.leer}
          aria-label={p.gewaehlt ? 'Auswahl löschen' : 'Seite leeren'}
          title={p.gewaehlt ? 'Auswahl löschen (Entf)' : 'Seite leeren (lässt sich rückgängig machen)'}
          onClick={p.gewaehlt ? p.beiLoeschen : p.beiLeeren}
        >
          <Symbol name="leeren" />
        </button>
      </div>

      {offen && (
        <div ref={feldRef} className="aufklappfeld" role="dialog" aria-label="Art und Größe des Radierers" style={{ left: feld.links, top: feld.oben }}>
          <div className="feld-reihe" role="group" aria-label="Art des Radierers">
            {RADIERER_ARTEN.map((a) => (
              <button
                key={a.wert}
                type="button"
                className="leisten-knopf mit-text"
                aria-pressed={p.radierer.art === a.wert}
                aria-label={a.wert === 'schwamm' ? 'Schwamm' : 'Element-Radierer'}
                title={a.titel}
                onClick={() => p.beiRadierer({ ...p.radierer, art: a.wert })}
              >
                <Symbol name={a.wert === 'schwamm' ? 'schwamm' : 'radierer'} />
                <span>{a.name}</span>
              </button>
            ))}
          </div>
          <div className="feld-reihe" role="group" aria-label="Größe des Radierers">
            {RADIERER_GROESSEN.map((g) => {
              const d = Math.min(40, RADIERER_RADIUS[g.wert] * 0.9 + 6)
              return (
                <button key={g.wert} type="button" className="leisten-knopf" aria-pressed={p.radierer.groesse === g.wert} aria-label={'Radierer ' + g.name} title={'Größe: ' + g.name} onClick={() => p.beiRadierer({ ...p.radierer, groesse: g.wert })}>
                  <span className="radierer-kreis" style={{ width: d, height: d }} />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
}
