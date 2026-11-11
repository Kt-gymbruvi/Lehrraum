// Linke Werkzeugleiste der Tafel – bleibt dauerhaft sichtbar.
import { FARBEN, STAERKEN } from '../kern/modell.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'
import type { Werkzeug } from './Zeichenflaeche.tsx'

type Props = {
  werkzeug: Werkzeug
  farbe: string
  staerke: number
  kannZurueck: boolean
  kannVor: boolean
  leer: boolean
  beiWerkzeug: (w: Werkzeug) => void
  beiFarbe: (f: string) => void
  beiStaerke: (s: number) => void
  beiZurueck: () => void
  beiVor: () => void
  beiLeeren: () => void
}

const WERKZEUGE: { wert: Werkzeug; name: string; symbol: SymbolName; taste: string }[] = [
  { wert: 'stift', name: 'Stift', symbol: 'stift', taste: 'S' },
  { wert: 'marker', name: 'Textmarker', symbol: 'marker', taste: 'M' },
  { wert: 'radierer', name: 'Radierer', symbol: 'radierer', taste: 'R' },
]

export function Werkzeugleiste(p: Props) {
  return (
    <aside className="werkzeugleiste" aria-label="Zeichenwerkzeuge">
      <div className="gruppe" role="group" aria-label="Werkzeug">
        {WERKZEUGE.map((w) => (
          <button key={w.wert} type="button" className="leisten-knopf" aria-pressed={p.werkzeug === w.wert} aria-label={w.name} title={`${w.name} (${w.taste})`} onClick={() => p.beiWerkzeug(w.wert)}>
            <Symbol name={w.symbol} />
          </button>
        ))}
      </div>

      <div className="gruppe farben" role="group" aria-label="Farbe">
        {FARBEN.map((f) => (
          <button key={f.wert} type="button" className="farb-knopf" aria-pressed={p.farbe === f.wert} aria-label={f.name} title={f.name} onClick={() => p.beiFarbe(f.wert)}>
            <span style={{ background: f.wert }} />
          </button>
        ))}
      </div>

      <div className="gruppe" role="group" aria-label="Strichstärke">
        {STAERKEN.map((s) => (
          <button key={s.wert} type="button" className="leisten-knopf" aria-pressed={p.staerke === s.wert} aria-label={'Strichstärke ' + s.name} title={'Strichstärke ' + s.name} onClick={() => p.beiStaerke(s.wert)}>
            <span className="staerke-punkt" style={{ width: s.wert * 1.6 + 2, height: s.wert * 1.6 + 2 }} />
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
        <button type="button" className="leisten-knopf" disabled={p.leer} aria-label="Tafel leeren" title="Tafel leeren (lässt sich rückgängig machen)" onClick={p.beiLeeren}>
          <Symbol name="leeren" />
        </button>
      </div>
    </aside>
  )
}
