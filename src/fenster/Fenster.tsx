// Ein Fenster über der Tafel: Titelzeile zum Verschieben, Einklappen, Schließen. Der Inhalt bleibt auch
// eingeklappt eingebaut (nur versteckt), damit ein laufender Timer weiterläuft.
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { begrenze, FENSTERNAMEN, type FensterZustand } from '../kern/fenster.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'

type Props = {
  fenster: FensterZustand
  beiBewegen: (x: number, y: number) => void
  beiEinklappen: () => void
  beiSchliessen: () => void
  beiVorn: () => void
  children: ReactNode
}

export function Fenster({ fenster: f, beiBewegen, beiEinklappen, beiSchliessen, beiVorn, children }: Props) {
  const rahmen = useRef<HTMLElement>(null)
  const zug = useRef<{ zeiger: number; dx: number; dy: number } | null>(null)
  const name = FENSTERNAMEN[f.art]

  function greifen(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return // Knöpfe in der Titelzeile bleiben Knöpfe
    if (e.pointerType === 'mouse' && e.button !== 0) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* nicht jeder Browser erlaubt das für jeden Zeiger */
    }
    zug.current = { zeiger: e.pointerId, dx: e.clientX - f.x, dy: e.clientY - f.y }
  }
  function ziehen(e: ReactPointerEvent<HTMLDivElement>) {
    const z = zug.current
    const el = rahmen.current
    const flaeche = el?.parentElement
    if (!z || z.zeiger !== e.pointerId || !el || !flaeche) return
    const [x, y] = begrenze(e.clientX - z.dx, e.clientY - z.dy, flaeche.clientWidth, flaeche.clientHeight, el.offsetWidth)
    if (x !== f.x || y !== f.y) beiBewegen(x, y)
  }
  const loslassen = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (zug.current?.zeiger === e.pointerId) zug.current = null
  }

  return (
    <section
      ref={rahmen}
      className={`fenster fenster-${f.art}${f.eingeklappt ? ' eingeklappt' : ''}${f.farbe ? ' notiz-' + f.farbe : ''}`}
      style={{ left: `min(${f.x}px, calc(100% - 3.5rem))`, top: `min(${f.y}px, calc(100% - 3.5rem))` }}
      aria-label={name}
      onPointerDownCapture={beiVorn}
    >
      <div className="fenster-titel" onPointerDown={greifen} onPointerMove={ziehen} onPointerUp={loslassen} onPointerCancel={loslassen}>
        <Symbol name={f.art as SymbolName} />
        <h2>{name}</h2>
        <button type="button" className="fenster-knopf" aria-label={`${name} ${f.eingeklappt ? 'ausklappen' : 'einklappen'}`} aria-expanded={!f.eingeklappt} onClick={beiEinklappen}>
          <Symbol name={f.eingeklappt ? 'ausklappen' : 'einklappen'} />
        </button>
        <button type="button" className="fenster-knopf" aria-label={`${name} schließen`} onClick={beiSchliessen}>
          <Symbol name="schliessen" />
        </button>
      </div>
      <div className="fenster-inhalt" hidden={f.eingeklappt}>
        {children}
      </div>
    </section>
  )
}
