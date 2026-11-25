// Knopf „Geometrie“ in der linken Leiste: schaltet die Kapsel über der Tafel auf Lineal, Geodreieck, Winkelmesser
// und Zirkel um (wie bei den Stiften erscheint die Auswahl oben). Ein Punkt zeigt, dass etwas auf der Tafel liegt.
import { INSTRUMENT_NAMEN, INSTRUMENTARTEN, type InstrumentArt } from '../kern/instrumente.ts'
import { Symbol } from '../ui/Symbol.tsx'

export function Geometriewahl({ an, offen, beiKlick }: { an: InstrumentArt[]; offen: boolean; beiKlick: () => void }) {
  return (
    <button
      type="button"
      className={'leisten-knopf' + (an.length ? ' liegt' : '')}
      aria-label="Geometrie"
      aria-pressed={offen}
      title={INSTRUMENTARTEN.map((a) => INSTRUMENT_NAMEN[a]).join(', ') + ' – Auswahl in der Leiste oben'}
      onClick={beiKlick}
    >
      <Symbol name="geometrie" />
    </button>
  )
}
