// Knopf „Geometrie“ in der linken Leiste: Lineal, Geodreieck, Winkelmesser auf die Tafel legen und wieder wegnehmen.
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { INSTRUMENT_NAMEN, INSTRUMENTARTEN, type InstrumentArt } from '../kern/instrumente.ts'
import { Symbol } from '../ui/Symbol.tsx'
import { useSchliessenDraussen } from './handballen.ts'

/** Knopf „Geometrie“ mit Feld: Lineal, Geodreieck, Winkelmesser ein- und ausschalten */
export function Geometriewahl({ an, beiInstrument }: { an: InstrumentArt[]; beiInstrument: (art: InstrumentArt) => void }) {
  const [lage, setLage] = useState<{ links: number; oben: number } | null>(null)
  const knopf = useRef<HTMLButtonElement>(null)
  const feld = useRef<HTMLDivElement>(null)
  const offen = lage !== null
  useSchliessenDraussen(offen, () => [feld.current, knopf.current], () => setLage(null))
  const umschalten = () => {
    if (offen) return setLage(null)
    const leiste = knopf.current?.closest('aside')?.getBoundingClientRect()
    const r = knopf.current?.getBoundingClientRect()
    setLage({ links: (leiste?.right ?? r?.right ?? 64) + 8, oben: Math.max(8, Math.min(r?.top ?? 8, window.innerHeight - 240)) })
  }
  return (
    <>
      <button ref={knopf} type="button" className={'leisten-knopf hat-feld' + (an.length ? ' an' : '')} aria-label="Geometrie" aria-expanded={offen} title="Lineal, Geodreieck, Winkelmesser" onClick={umschalten}>
        <Symbol name="geometrie" />
      </button>
      {lage &&
        createPortal(
          <div ref={feld} className="aufklappfeld geometriefeld" role="dialog" aria-label="Geometrie" style={{ left: lage.links, top: lage.oben }}>
            <p className="feld-titel">Auf die Tafel legen</p>
            {INSTRUMENTARTEN.map((art) => (
              <button
                key={art}
                type="button"
                className="feld-zeile"
                aria-pressed={an.includes(art)}
                onClick={() => {
                  beiInstrument(art)
                  setLage(null)
                }}
              >
                <Symbol name={art} />
                {INSTRUMENT_NAMEN[art]}
              </button>
            ))}
            <p className="hinweis klein">Ziehen verschiebt, der runde Griff dreht. Ein Strich dicht an der Kante wird angelegt.</p>
          </div>,
          document.body,
        )}
    </>
  )
}
