// Ein Fenster über der Tafel: Titelzeile zum Verschieben, Einklappen, Schließen. Der Inhalt bleibt auch
// eingeklappt eingebaut (nur versteckt), damit ein laufender Timer weiterläuft. Fenster haben unten rechts
// einen Eckgriff wie Bilder: Ziehen vergrößert oder verkleinert den Inhalt gleichmäßig (Doppeltippen: zurück auf 100 %).
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { begrenze, FENSTERNAMEN, neueSkala, SKALA_MAX, SKALA_MIN, skalaSchritt, type FensterZustand } from '../kern/fenster.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'

type Props = {
  fenster: FensterZustand
  beiBewegen: (x: number, y: number) => void
  beiEinklappen: () => void
  beiSkala?: (skala: number) => void
  beiSchliessen: () => void
  beiVorn: () => void
  children: ReactNode
}

export function Fenster({ fenster: f, beiBewegen, beiEinklappen, beiSkala, beiSchliessen, beiVorn, children }: Props) {
  const rahmen = useRef<HTMLElement>(null)
  const zug = useRef<{ zeiger: number; dx: number; dy: number } | null>(null)
  const name = FENSTERNAMEN[f.art]
  const skala = f.skala ?? 1
  const inhalt = useRef<HTMLDivElement>(null)
  const griffZug = useRef<{ zeiger: number; x: number; y: number; start: number; b: number; h: number; platzB: number; platzH: number } | null>(null)

  function griffGreifen(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = inhalt.current
    const flaeche = rahmen.current?.parentElement
    if (!el || !flaeche) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* nicht jeder Browser erlaubt das für jeden Zeiger */
    }
    const r = el.getBoundingClientRect()
    const fl = flaeche.getBoundingClientRect()
    const rand = 8
    griffZug.current = { zeiger: e.pointerId, x: e.clientX, y: e.clientY, start: skala, b: r.width, h: r.height, platzB: fl.right - r.left - rand, platzH: fl.bottom - r.top - rand }
  }
  function griffZiehen(e: ReactPointerEvent<HTMLDivElement>) {
    const z = griffZug.current
    if (!z || z.zeiger !== e.pointerId) return
    const neu = neueSkala(z.start, z.b, z.h, e.clientX - z.x, e.clientY - z.y, z.platzB, z.platzH)
    if (neu !== skala) beiSkala?.(neu)
  }
  const griffLoslassen = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (griffZug.current?.zeiger === e.pointerId) griffZug.current = null
  }

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
      <div ref={inhalt} className="fenster-inhalt" hidden={f.eingeklappt} style={skala !== 1 ? { zoom: skala } : undefined}>
        {children}
      </div>
      {beiSkala && !f.eingeklappt && (
        <div
          className="fenster-griff"
          role="slider"
          tabIndex={0}
          aria-label={`Größe von ${name}`}
          aria-valuemin={Math.round(SKALA_MIN * 100)}
          aria-valuemax={Math.round(SKALA_MAX * 100)}
          aria-valuenow={Math.round(skala * 100)}
          aria-valuetext={`${Math.round(skala * 100)} %`}
          title="Ziehen: Größe ändern – Doppeltippen: Normalgröße"
          onPointerDown={griffGreifen}
          onPointerMove={griffZiehen}
          onPointerUp={griffLoslassen}
          onPointerCancel={griffLoslassen}
          onDoubleClick={() => beiSkala(1)}
          onKeyDown={(e) => {
            const richtung = e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-' ? -1 : 0
            if (!richtung) return
            e.preventDefault()
            e.stopPropagation() // Pfeiltasten sollen hier nicht die Tafel bewegen
            beiSkala(skalaSchritt(skala, richtung))
          }}
        />
      )}
    </section>
  )
}
