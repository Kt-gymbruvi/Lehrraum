// Ein Fenster über der Tafel: Titelzeile zum Verschieben, Einklappen, Schließen. Der Inhalt bleibt auch
// eingeklappt eingebaut (nur versteckt), damit ein laufender Timer weiterläuft. Fenster haben unten rechts
// einen Eckgriff wie Bilder: Ziehen vergrößert oder verkleinert den Inhalt gleichmäßig (Doppeltippen: zurück auf 100 %).
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { begrenze, FENSTERNAMEN, mittig, neueSkala, SKALA_MAX, SKALA_MIN, skalaSchritt, type FensterZustand } from '../kern/fenster.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'

type Props = {
  fenster: FensterZustand
  beiBewegen: (x: number, y: number) => void
  /** neu geöffnet: Lage in der Mitte der Tafel übernehmen (und die Markierung `mitte` entfernen) */
  beiMitte?: (x: number, y: number) => void
  beiEinklappen: () => void
  beiSkala?: (skala: number) => void
  beiSchliessen: () => void
  beiVorn: () => void
  children: ReactNode
}

export function Fenster({ fenster: f, beiBewegen, beiMitte, beiEinklappen, beiSkala, beiSchliessen, beiVorn, children }: Props) {
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
    zug.current = { zeiger: e.pointerId, dx: e.clientX - f.x, dy: e.clientY - oben }
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

  // Neu geöffnet: sobald die Größe bekannt ist, mittig auf die Tafel legen (vor dem ersten Bild, kein Springen)
  const mitte = f.mitte
  useLayoutEffect(() => {
    const el = rahmen.current
    const flaeche = el?.parentElement
    if (mitte === undefined || !el || !flaeche || !beiMitte) return
    const [x, y] = mittig(flaeche.clientWidth, flaeche.clientHeight, el.offsetWidth, el.offsetHeight, mitte)
    beiMitte(x, y)
  }, [mitte, beiMitte])

  // Wird das Fenster höher (z. B. Gruppen gebildet), schiebt es sich nach oben, damit der untere Rand sichtbar bleibt.
  // Gespeichert wird die Lage nicht verändert – nur die Anzeige.
  const [mass, setMass] = useState<{ h: number; platz: number } | null>(null)
  useLayoutEffect(() => {
    const el = rahmen.current
    const flaeche = el?.parentElement
    if (!el || !flaeche) return
    const messen = () => setMass((alt) => (alt && alt.h === el.offsetHeight && alt.platz === flaeche.clientHeight ? alt : { h: el.offsetHeight, platz: flaeche.clientHeight }))
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(el)
    beobachter.observe(flaeche)
    return () => beobachter.disconnect()
  }, [])
  const oben = mass && mass.h > 0 ? Math.max(4, Math.min(f.y, mass.platz - mass.h - 8)) : f.y

  return (
    <section
      ref={rahmen}
      className={`fenster fenster-${f.art}${f.eingeklappt ? ' eingeklappt' : ''}${f.farbe ? ' notiz-' + f.farbe : ''}`}
      style={{ left: `min(${f.x}px, calc(100% - 3.5rem))`, top: `min(${oben}px, calc(100% - 3.5rem))` }}
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
