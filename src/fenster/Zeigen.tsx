// Abdecken und Scheinwerfer: Ebenen über der Tafel (unter den Fenstern), die nur verdecken – die Tafel bleibt, wie sie ist.
// Logik in kern/zeigen.ts. Nichts davon wird gespeichert.
import { useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { begrenzeScheinwerfer, scheinwerferPfad, schiebeKante, type Abdeckung, type Kante, type Scheinwerfer } from '../kern/zeigen.ts'
import { Symbol } from '../ui/Symbol.tsx'

const KANTEN: { k: Kante; name: string; waagerecht: boolean }[] = [
  { k: 'o', name: 'oben', waagerecht: true },
  { k: 'u', name: 'unten', waagerecht: true },
  { k: 'l', name: 'links', waagerecht: false },
  { k: 'r', name: 'rechts', waagerecht: false },
]

function fange(e: ReactPointerEvent<Element>) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    /* nicht jeder Browser erlaubt das für jeden Zeiger */
  }
}

/** Abdeckung: ein Vorhang, dessen vier Kanten sich an Griffen aufziehen lassen */
export function AbdeckEbene({ wert, beiAendern, beiSchliessen }: { wert: Abdeckung; beiAendern: (a: Abdeckung) => void; beiSchliessen: () => void }) {
  const ebene = useRef<HTMLDivElement>(null)
  const zug = useRef<{ zeiger: number; kante: Kante } | null>(null)

  function ziehen(e: ReactPointerEvent<HTMLDivElement>) {
    const z = zug.current
    const r = ebene.current?.getBoundingClientRect()
    if (!z || z.zeiger !== e.pointerId || !r || !r.width || !r.height) return
    const anteil = z.kante === 'l' || z.kante === 'r' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height
    beiAendern(schiebeKante(wert, z.kante, anteil))
  }
  const loslassen = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (zug.current?.zeiger === e.pointerId) zug.current = null
  }
  function taste(e: ReactKeyboardEvent<HTMLDivElement>, kante: Kante) {
    const schritt = e.shiftKey ? 0.1 : 0.02
    const richtung = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!richtung) return
    e.preventDefault()
    e.stopPropagation() // Pfeiltasten sollen hier nicht die Tafel bewegen
    beiAendern(schiebeKante(wert, kante, wert[kante] + richtung * schritt))
  }

  return (
    <div ref={ebene} className="zeige-ebene">
      <div
        className="abdeckung"
        role="region"
        aria-label="Abdeckung"
        style={{ left: `${wert.l * 100}%`, top: `${wert.o * 100}%`, width: `${(wert.r - wert.l) * 100}%`, height: `${(wert.u - wert.o) * 100}%` }}
        onPointerDown={(e) => e.target === e.currentTarget && e.preventDefault()}
      >
        {KANTEN.map(({ k, name, waagerecht }) => (
          <div
            key={k}
            className={`abdeck-griff griff-${k}`}
            role="slider"
            tabIndex={0}
            aria-label={`Abdeckung ${name} aufziehen`}
            aria-orientation={waagerecht ? 'vertical' : 'horizontal'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(wert[k] * 100)}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return
              e.preventDefault()
              fange(e)
              zug.current = { zeiger: e.pointerId, kante: k }
            }}
            onPointerMove={ziehen}
            onPointerUp={loslassen}
            onPointerCancel={loslassen}
            onKeyDown={(e) => taste(e, k)}
          >
            <span />
          </div>
        ))}
        <button type="button" className="ebene-schliessen" aria-label="Abdeckung entfernen" title="Abdeckung entfernen" onClick={beiSchliessen}>
          <Symbol name="schliessen" />
        </button>
      </div>
    </div>
  )
}

/** Scheinwerfer: alles dunkel bis auf einen Kreis. Ziehen im Dunkeln verschiebt ihn, der Griff am Rand ändert die Größe. */
export function ScheinwerferEbene({ wert, beiAendern, beiSchliessen }: { wert: Scheinwerfer; beiAendern: (s: Scheinwerfer) => void; beiSchliessen: () => void }) {
  const ebene = useRef<HTMLDivElement>(null)
  const [mass, setMass] = useState({ b: 0, h: 0 })
  const zug = useRef<{ zeiger: number; art: 'schieben' | 'groesse'; x: number; y: number; start: Scheinwerfer } | null>(null)

  useLayoutEffect(() => {
    const el = ebene.current
    if (!el) return
    const messen = () => setMass({ b: el.clientWidth, h: el.clientHeight })
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [])

  const { b, h } = mass
  const s = begrenzeScheinwerfer(wert, b, h)
  const cx = s.x * b
  const cy = s.y * h
  const randPunkt = (grad: number) => {
    const w = (grad * Math.PI) / 180
    return { left: Math.min(b - 28, Math.max(28, cx + s.r * Math.cos(w))), top: Math.min(h - 28, Math.max(28, cy + s.r * Math.sin(w))) }
  }

  function greifen(e: ReactPointerEvent<Element>, art: 'schieben' | 'groesse') {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    fange(e)
    zug.current = { zeiger: e.pointerId, art, x: e.clientX, y: e.clientY, start: s }
  }
  function ziehen(e: ReactPointerEvent<Element>) {
    const z = zug.current
    if (!z || z.zeiger !== e.pointerId || !b || !h) return
    if (z.art === 'schieben') beiAendern(begrenzeScheinwerfer({ ...z.start, x: z.start.x + (e.clientX - z.x) / b, y: z.start.y + (e.clientY - z.y) / h }, b, h))
    else {
      const r = ebene.current!.getBoundingClientRect()
      beiAendern(begrenzeScheinwerfer({ ...z.start, r: Math.hypot(e.clientX - r.left - cx, e.clientY - r.top - cy) }, b, h))
    }
  }
  const loslassen = (e: ReactPointerEvent<Element>) => {
    if (zug.current?.zeiger === e.pointerId) zug.current = null
  }

  return (
    <div ref={ebene} className="zeige-ebene">
      {b > 0 && (
        <svg className="scheinwerfer" width={b} height={h} role="img" aria-label="Scheinwerfer">
          <path d={scheinwerferPfad(s, b, h)} fillRule="evenodd" onPointerDown={(e) => greifen(e, 'schieben')} onPointerMove={ziehen} onPointerUp={loslassen} onPointerCancel={loslassen} />
        </svg>
      )}
      {b > 0 && (
        <>
          <div
            className="scheinwerfer-griff"
            role="slider"
            tabIndex={0}
            aria-label="Größe des Scheinwerfers"
            aria-valuenow={s.r}
            style={randPunkt(45)}
            onPointerDown={(e) => greifen(e, 'groesse')}
            onPointerMove={ziehen}
            onPointerUp={loslassen}
            onPointerCancel={loslassen}
            onKeyDown={(e) => {
              const richtung = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
              if (!richtung) return
              e.preventDefault()
              e.stopPropagation()
              beiAendern(begrenzeScheinwerfer({ ...s, r: s.r + richtung * 16 }, b, h))
            }}
          >
            <span />
          </div>
        </>
      )}
      {/* Größe noch unbekannt: oben rechts – ausschalten lässt er sich immer */}
      <button type="button" className="ebene-schliessen" aria-label="Scheinwerfer ausschalten" title="Scheinwerfer ausschalten" style={b > 0 ? randPunkt(-45) : { left: 'calc(100% - 2rem)', top: '2rem' }} onClick={beiSchliessen}>
        <Symbol name="schliessen" />
      </button>
    </div>
  )
}
