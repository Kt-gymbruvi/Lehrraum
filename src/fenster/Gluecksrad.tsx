// Glücksrad für „Zufall & Gruppen“: nur die Zeichnung. Welches Feld gewinnt, entscheidet das Fenster (kern/zufall.ts);
// hier dreht sich das Rad nur auf die vorgegebene Gesamtdrehung zu und läuft weich aus.
import { useMemo } from 'react'

export type Feld = { id: string; name: string; /** schon gezogen (nur Anzeige: blasser) */ verbraucht?: boolean }
type Props = {
  felder: readonly Feld[]
  /** Gesamtdrehung in Grad, im Uhrzeigersinn; wächst von Wurf zu Wurf */
  drehung: number
  /** Dauer des Auslaufens in ms, 0 = sofort */
  dauer: number
  /** Feld hervorheben (Gewinner nach dem Stillstand) */
  gewinner: string | null
}

const R = 96 // Radius der Felder im Koordinatensystem −100…100
const FARBEN = ['rad-f0', 'rad-f1', 'rad-f2'] as const

const punkt = (winkel: number, r: number): [number, number] => {
  const w = ((winkel - 90) * Math.PI) / 180 // 0° = oben
  return [Math.cos(w) * r, Math.sin(w) * r]
}
const f = (z: number) => z.toFixed(2)

/** Kürzt lange Namen, damit sie ins Feld passen */
const kurz = (name: string, max: number) => (name.length > max ? name.slice(0, Math.max(1, max - 1)) + '…' : name)

export function Gluecksrad({ felder, drehung, dauer, gewinner }: Props) {
  const n = felder.length
  const breite = 360 / Math.max(1, n)
  const schrift = Math.max(2.6, Math.min(8, 220 / Math.max(6, n) / 1.5))
  const maxZeichen = Math.round(Math.max(7, Math.min(16, 56 / schrift + 4)))

  const keile = useMemo(
    () =>
      felder.map((feld, i) => {
        const a0 = i * breite
        const a1 = (i + 1) * breite
        const [x0, y0] = punkt(a0, R)
        const [x1, y1] = punkt(a1, R)
        const pfad = n === 1 ? '' : `M0 0 L${f(x0)} ${f(y0)} A${R} ${R} 0 ${breite > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)} Z`
        // Nie dieselbe Farbe neben sich, auch nicht zwischen letztem und erstem Feld
        let farbe: number = i % 3
        if (n > 1 && i === n - 1 && farbe === 0) farbe = 3
        return { feld, i, pfad, farbe, mitte: a0 + breite / 2 }
      }),
    [felder, breite, n],
  )

  return (
    <div className="rad" role="img" aria-label={`Glücksrad mit ${n} Feldern`}>
      <svg viewBox="-106 -106 212 212" className="rad-bild" aria-hidden="true">
        <g className="rad-dreh" style={{ transform: `rotate(${drehung}deg)`, transition: dauer ? `transform ${dauer}ms cubic-bezier(0.1, 0.62, 0.08, 1)` : 'none' }}>
          {n === 1 ? <circle r={R} className="rad-f0" /> : null}
          {keile.map(({ feld, i, pfad, farbe, mitte }) => (
            <g key={feld.id} className={'rad-feld ' + (feld.verbraucht ? 'verbraucht ' : '') + (gewinner === feld.id ? 'gewinner' : '')}>
              {pfad && <path d={pfad} className={n > 1 ? (farbe === 3 ? 'rad-f3' : FARBEN[farbe]) : ''} />}
              <text transform={`rotate(${f(mitte - 90)}) translate(${R - 6} 0)`} textAnchor="end" dominantBaseline="central" fontSize={schrift} className="rad-name" data-feld={i}>
                {kurz(feld.name, maxZeichen)}
              </text>
            </g>
          ))}
          <circle r={R} className="rad-rand" />
        </g>
        <circle r="9" className="rad-nabe" />
        {/* Zeiger: fest, oben, zeigt nach unten auf das Rad */}
        <path d="M0 -86 L-8 -104 L8 -104 Z" className="rad-zeiger" />
      </svg>
    </div>
  )
}
