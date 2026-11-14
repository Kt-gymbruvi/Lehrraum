// Knopf „Format“ in der Kopfzeile: Blätter in 16:9, A4 hoch, A4 quer oder eine unendliche Fläche.
// Ragt nach dem Umstellen Inhalt über ein Blatt hinaus, bietet das Feld „Inhalt einpassen“ an. Das Format
// selbst lässt sich jederzeit zurückstellen – dabei geht nichts verloren, Inhalt neben dem Blatt ist nur verdeckt.
import { useEffect, useRef, useState } from 'react'
import { FORMAT_NAME } from '../kern/blatt.ts'
import { FORMATE, type Format } from '../kern/modell.ts'
import { Symbol } from '../ui/Symbol.tsx'

type Props = {
  format: Format
  /** Wie viele Seiten haben Inhalt außerhalb ihres Blatts? */
  ueberstand: number
  beiFormat: (f: Format) => void
  beiEinpassen: () => void
}

export function Formatwahl({ format, ueberstand, beiFormat, beiEinpassen }: Props) {
  const [lage, setLage] = useState<{ rechts: number; oben: number } | null>(null)
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

  const umschalten = () => {
    if (offen) return setLage(null)
    const r = knopf.current?.getBoundingClientRect()
    setLage({ rechts: Math.max(8, window.innerWidth - (r?.right ?? window.innerWidth - 8)), oben: (r?.bottom ?? 56) + 8 })
  }

  return (
    <>
      <button ref={knopf} type="button" className="kopf-knopf" aria-label="Format der Seiten" aria-expanded={offen} title="Format der Seiten: 16:9, A4 oder unendlich" onClick={umschalten}>
        <Symbol name="format" />
      </button>
      {lage && (
        <div ref={feld} className="aufklappfeld formatfeld" role="dialog" aria-label="Format der Seiten" style={{ right: lage.rechts, top: lage.oben }}>
          <p className="feld-titel">Format der Seiten</p>
          <div className="formatwahl" role="group" aria-label="Format">
            {FORMATE.map((f) => (
              <button key={f} type="button" className="format-knopf" aria-pressed={f === format} onClick={() => beiFormat(f)}>
                <span className={'format-bild format-' + f.replace(':', '-')} aria-hidden="true" />
                {FORMAT_NAME[f]}
              </button>
            ))}
          </div>
          {ueberstand > 0 && (
            <div className="format-hinweis" role="status">
              <p>
                {ueberstand === 1 ? '1 Seite hat' : `${ueberstand} Seiten haben`} Inhalt außerhalb des Blatts. Er ist nicht verloren, aber verdeckt.
              </p>
              <button type="button" className="f-knopf haupt" onClick={beiEinpassen}>
                Inhalt einpassen
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
