// Linke Werkzeugleiste der Tafel – bleibt dauerhaft sichtbar. Zwei Knöpfe nebeneinander, damit alles ohne Rollen passt.
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
  /** Anzahl ausgewählter Elemente */
  gewaehlt: number
  beiWerkzeug: (w: Werkzeug) => void
  beiFarbe: (f: string) => void
  beiStaerke: (s: number) => void
  beiZurueck: () => void
  beiVor: () => void
  beiLeeren: () => void
  beiDoppeln: () => void
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
  return (
    <aside className="werkzeugleiste links" aria-label="Zeichenwerkzeuge">
      <div className="gruppe" role="group" aria-label="Werkzeug">
        {WERKZEUGE.map((w) => (
          <button key={w.wert} type="button" className="leisten-knopf" aria-pressed={p.werkzeug === w.wert} aria-label={w.name} title={`${w.name} (${w.taste})`} onClick={() => p.beiWerkzeug(w.wert)}>
            <Symbol name={w.symbol} />
          </button>
        ))}
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
        <button type="button" className="leisten-knopf" disabled={p.gewaehlt === 0} aria-label="Auswahl duplizieren" title="Auswahl duplizieren (Strg + D)" onClick={p.beiDoppeln}>
          <Symbol name="duplizieren" />
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
    </aside>
  )
}
