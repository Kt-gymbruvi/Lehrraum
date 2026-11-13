// Linke Werkzeugleiste der Tafel – bleibt dauerhaft sichtbar. Zwei Knöpfe nebeneinander, damit alles ohne Rollen passt.
// Zwei Aufklappfelder rechts neben der Leiste:
//   Radierer: erneutes Antippen des gewählten Radierers öffnet Art und Größe.
//   Mehr: weitere Farben, eigene Farbplätze mit dem Farbwähler des Geräts und ein Regler für die Stärke.
// Ein Feld schließt sich beim Antippen außerhalb (auch der Tafel), mit Escape und beim Wechsel des Werkzeugs.
import { useEffect, useRef, useState } from 'react'
import { begrenzeStaerke, inLeiste, PALETTE, STAERKE_MAX, STAERKE_MIN, staerkeInLeiste } from '../kern/farben.ts'
import { FARBEN, STAERKEN } from '../kern/modell.ts'
import { RADIERER_ARTEN, RADIERER_GROESSEN, RADIERER_RADIUS, type Radierer } from '../kern/radieren.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'
import type { Werkzeug } from './Zeichenflaeche.tsx'

type Props = {
  werkzeug: Werkzeug
  farbe: string
  staerke: number
  radierer: Radierer
  /** Selbst gewählte Farben dieses Geräts (neueste zuerst) */
  eigeneFarben: string[]
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
  /** Eine Farbe aus dem Farbwähler des Geräts (kommt zu den eigenen Plätzen) */
  beiEigeneFarbe: (f: string) => void
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

type Feldart = 'radierer' | 'mehr'

/** Größe des Punktes, der eine Stärke zeigt (wie bei den drei Knöpfen, nach oben begrenzt) */
const punktGroesse = (s: number) => Math.min(30, s * 1.4 + 2)

/**
 * Ruft `tun` beim echten „change“ des Browsers auf – beim Farbwähler erst beim Schließen, beim Regler erst beim
 * Loslassen. (Reacts onChange käme bei jeder Bewegung und ergäbe viele Schritte im Verlauf.)
 */
function useFertig(ref: React.RefObject<HTMLInputElement | null>, tun: (wert: string) => void) {
  const aktuell = useRef(tun)
  aktuell.current = tun
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fertig = () => aktuell.current(el.value)
    el.addEventListener('change', fertig)
    return () => el.removeEventListener('change', fertig)
  }, [ref])
}

function MehrFeld(p: Props) {
  const waehler = useRef<HTMLInputElement>(null)
  const regler = useRef<HTMLInputElement>(null)
  /** Wert, während der Regler gezogen wird (übernommen wird erst beim Loslassen) */
  const [ziehend, setZiehend] = useState<number | null>(null)
  useFertig(waehler, (f) => p.beiEigeneFarbe(f))
  useFertig(regler, (s) => {
    setZiehend(null)
    p.beiStaerke(begrenzeStaerke(Number(s)))
  })
  const staerke = ziehend ?? p.staerke

  return (
    <>
      <p className="feld-titel">Farben</p>
      <div className="palette" role="group" aria-label="Weitere Farben">
        {PALETTE.map((f) => (
          <button key={f.wert} type="button" className="farb-knopf klein" aria-pressed={p.farbe === f.wert} aria-label={f.name} title={f.name} onClick={() => p.beiFarbe(f.wert)}>
            <span style={{ background: f.wert }} />
          </button>
        ))}
      </div>
      <p className="feld-titel">Eigene Farben</p>
      <div className="palette" role="group" aria-label="Eigene Farben">
        {p.eigeneFarben.map((f) => (
          <button key={f} type="button" className="farb-knopf klein" aria-pressed={p.farbe === f} aria-label={'Eigene Farbe ' + f} title={'Eigene Farbe ' + f} onClick={() => p.beiFarbe(f)}>
            <span style={{ background: f }} />
          </button>
        ))}
        <label className="farb-knopf klein farbwahl" title="Farbe frei wählen (wird als eigene Farbe gemerkt)">
          <Symbol name="plus" />
          <input ref={waehler} type="color" aria-label="Farbe frei wählen" defaultValue={p.farbe} />
        </label>
      </div>
      <p className="feld-titel">
        Stärke <output>{staerke}</output>
      </p>
      <div className="regler-reihe">
        <input
          ref={regler}
          type="range"
          aria-label="Strichstärke"
          min={STAERKE_MIN}
          max={STAERKE_MAX}
          step={1}
          value={staerke}
          onChange={(e) => setZiehend(begrenzeStaerke(Number(e.target.value)))}
        />
        <span className="punkt-feld">
          <span className="staerke-punkt" style={{ width: punktGroesse(staerke), height: punktGroesse(staerke), background: p.farbe }} />
        </span>
      </div>
    </>
  )
}

export function Werkzeugleiste(p: Props) {
  const ausloeser = { radierer: useRef<HTMLButtonElement>(null), mehr: useRef<HTMLButtonElement>(null) }
  const feldRef = useRef<HTMLDivElement>(null)
  /** Offenes Feld mit seiner Lage (Bildschirm) oder null */
  const [feld, setFeld] = useState<{ art: Feldart; links: number; oben: number } | null>(null)
  // Das Feld des Radierers gehört zum Radierer: wird ein anderes Werkzeug gewählt, ist es zu
  const offen = feld && (feld.art !== 'radierer' || p.werkzeug === 'radierer') ? feld : null
  const offeneArt = offen?.art ?? null

  useEffect(() => {
    if (!offeneArt) return
    const draussen = (e: PointerEvent) => {
      const ziel = e.target as Node
      if (feldRef.current?.contains(ziel) || ausloeser[offeneArt].current?.contains(ziel)) return
      setFeld(null)
    }
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && setFeld(null)
    document.addEventListener('pointerdown', draussen, true)
    window.addEventListener('keydown', taste)
    return () => {
      document.removeEventListener('pointerdown', draussen, true)
      window.removeEventListener('keydown', taste)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeneArt])

  /** Öffnet das Feld rechts neben der ganzen Leiste, auf Höhe seines Knopfes – oder schließt es wieder */
  const umschalten = (art: Feldart, hoehe: number) => {
    if (offeneArt === art) return setFeld(null)
    const knopf = ausloeser[art].current
    const r = knopf?.getBoundingClientRect()
    const leiste = knopf?.closest('aside')?.getBoundingClientRect()
    setFeld({ art, links: (leiste?.right ?? r?.right ?? 64) + 8, oben: Math.max(8, Math.min(r?.top ?? 8, window.innerHeight - hoehe)) })
  }

  const waehle = (w: Werkzeug) => {
    if (w === 'radierer' && p.werkzeug === 'radierer') return umschalten('radierer', 240)
    if (offeneArt === 'radierer' || w !== p.werkzeug) setFeld(null)
    p.beiWerkzeug(w)
  }
  const artName = RADIERER_ARTEN.find((a) => a.wert === p.radierer.art)?.name ?? ''
  // Farbe oder Stärke außerhalb der Leiste: der Knopf „Mehr“ zeigt sie als Punkt
  const besonders = !inLeiste(p.farbe) || !staerkeInLeiste(p.staerke)

  return (
    <aside className="werkzeugleiste links" aria-label="Zeichenwerkzeuge">
      <div className="gruppe" role="group" aria-label="Werkzeug">
        {WERKZEUGE.map((w) =>
          w.wert === 'radierer' ? (
            <button
              key={w.wert}
              ref={ausloeser.radierer}
              type="button"
              className="leisten-knopf hat-feld"
              aria-pressed={p.werkzeug === w.wert}
              aria-label={w.name}
              aria-expanded={offeneArt === 'radierer'}
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
        <button
          ref={ausloeser.mehr}
          type="button"
          className="farb-knopf mehr"
          aria-pressed={besonders}
          aria-expanded={offeneArt === 'mehr'}
          aria-label="Mehr Farben und Stärken"
          title="Mehr Farben, eigene Farben und Stärke"
          onClick={() => umschalten('mehr', 420)}
        >
          {besonders ? <span className="staerke-punkt" style={{ width: Math.max(8, Math.min(22, punktGroesse(p.staerke))), height: Math.max(8, Math.min(22, punktGroesse(p.staerke))), background: p.farbe }} /> : <Symbol name="palette" />}
        </button>
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
        <div
          ref={feldRef}
          className="aufklappfeld"
          role="dialog"
          aria-label={offen.art === 'radierer' ? 'Art und Größe des Radierers' : 'Mehr Farben und Stärken'}
          style={{ left: offen.links, top: offen.oben }}
        >
          {offen.art === 'mehr' ? (
            <MehrFeld {...p} />
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </aside>
  )
}
