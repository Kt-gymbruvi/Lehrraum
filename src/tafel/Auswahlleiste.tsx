// Kleine Leiste direkt an der Auswahl mit den Befehlen für das Ausgewählte (Spezifikation A8).
// Sie steht unter der Auswahl, sonst darüber (über dem Drehgriff) – nie auf der Auswahl und immer im sichtbaren Bereich.
import { useLayoutEffect, useRef } from 'react'
import { DREH_ABSTAND, GRIFF_TREFFER } from '../kern/auswahl.ts'
import type { Rechteck } from '../kern/geometrie.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'

export type Befehlsknopf = { name: string; symbol: SymbolName; titel: string; tun: () => void }

/** Abstand zu den Griffen und zum Rand der Tafelfläche (Pixel) */
const ABSTAND = 12
const RAND = 8

/** rahmen: der gezeichnete Auswahlrahmen in Pixeln der Tafelfläche */
export function Auswahlleiste({ rahmen, knoepfe }: { rahmen: Rechteck; knoepfe: Befehlsknopf[] }) {
  const leiste = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = leiste.current
    const flaeche = el?.parentElement
    if (!el || !flaeche) return
    const [l, o, r, u] = rahmen
    const [b, h] = [el.offsetWidth, el.offsetHeight]
    const [breite, hoehe] = [flaeche.clientWidth, flaeche.clientHeight]
    const [mx, my] = [(l + r) / 2, (o + u) / 2]
    const halb = GRIFF_TREFFER / 2
    // Unter den unteren Griffen (bei kleinen Auswahlen rücken sie nach außen) – oder über dem Drehgriff
    const unten = Math.max(u, my + halb) + halb + ABSTAND
    const oben = Math.min(o, my - halb) - DREH_ABSTAND - halb - ABSTAND - h
    const y = unten + h <= hoehe - RAND ? unten : oben >= RAND ? oben : Math.max(RAND, Math.min(unten, hoehe - h - RAND))
    const x = Math.max(RAND, Math.min(mx - b / 2, breite - b - RAND))
    el.style.left = `${Math.round(x)}px`
    el.style.top = `${Math.round(y)}px`
  })

  return (
    <div ref={leiste} className="auswahlleiste" role="toolbar" aria-label="Befehle für die Auswahl">
      {knoepfe.map((k) => (
        <button key={k.name} type="button" className="leisten-knopf" aria-label={k.name} title={k.titel} onClick={k.tun}>
          <Symbol name={k.symbol} />
        </button>
      ))}
    </div>
  )
}
