// Ebene über der Zeichenfläche mit allen offenen Fenstern – und die rechte Leiste, die sie öffnet.
import type { ReactNode } from 'react'
import { aendere, FENSTERNAMEN, LEISTENGRUPPEN, LEISTENNAMEN, MEHRFACH, nachVorn, NUR_KLASSE, schalte, schliesse, type FensterZustand } from '../kern/fenster.ts'
import type { Schueler } from '../kern/klassen.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'
import { Fenster } from './Fenster.tsx'
import { Arbeitsform, Geraeuschampel, Notiz, Stoppuhr, Timer, Uhr } from './Inhalte.tsx'
import { Zufall } from './Zufall.tsx'
import './werkzeuge.css'

type Props = { fenster: FensterZustand[]; beiAendern: (neu: (alt: FensterZustand[]) => FensterZustand[]) => void }

/** schueler: Namen der Klasse (null in der freien Tafel); beiText: schreibt einen Text in die Mitte der Tafel */
export function Fensterebene({ fenster, beiAendern, schueler = null, beiText }: Props & { schueler?: Schueler[] | null; beiText?: (text: string) => void }) {
  return (
    <div className="fensterebene">
      {fenster.map((f) => {
        const aendereF = (neu: Parameters<typeof aendere>[2]) => beiAendern((alt) => aendere(alt, f.id, neu))
        return (
          <Fenster
            key={f.id}
            fenster={f}
            beiBewegen={(x, y) => aendereF({ x, y })}
            beiEinklappen={() => aendereF({ eingeklappt: !f.eingeklappt })}
            beiSkala={(skala) => aendereF({ skala: skala === 1 ? undefined : skala })}
            beiSchliessen={() => beiAendern((alt) => schliesse(alt, f.id))}
            beiVorn={() => beiAendern((alt) => nachVorn(alt, f.id))}
          >
            {f.art === 'uhr' && <Uhr />}
            {f.art === 'timer' && <Timer />}
            {f.art === 'stoppuhr' && <Stoppuhr />}
            {f.art === 'zufall' && <Zufall schueler={schueler} beiAnTafel={(t) => beiText?.(t)} />}
            {f.art === 'notiz' && <Notiz fenster={f} beiAendern={aendereF} />}
            {f.art === 'arbeitsform' && <Arbeitsform fenster={f} beiAendern={aendereF} />}
            {f.art === 'geraeusch' && <Geraeuschampel fenster={f} beiAendern={aendereF} />}
          </Fenster>
        )
      })}
    </div>
  )
}

/** Was in der Leiste unter „Zeigen“ steht: Abdecken und Scheinwerfer (liegen über der Tafel, nicht in Fenstern) */
export type Zeigewerkzeuge = {
  abdecken: boolean
  scheinwerfer: boolean
  beiAbdecken: () => void
  beiScheinwerfer: () => void
}

/** Rechte Schnellzugriffsleiste – bleibt dauerhaft sichtbar. */
/** vorne: Knöpfe der Tafel, die oben in der Leiste stehen (z. B. „Hintergrund“) */
/** klasse: Tafel einer Klasse – nur dann gibt es „Zufall & Gruppen“ */
/** beiMitmachen: Knopf „Mitmachen“ (QR-Code für die Schüler) – nur in der Tafel einer Klasse */
export function Schnellleiste({ fenster, beiAendern, vorne, klasse = false, zeigen, beiMitmachen }: Props & { vorne?: ReactNode; klasse?: boolean; zeigen?: Zeigewerkzeuge; beiMitmachen?: () => void }) {
  return (
    <aside className="werkzeugleiste rechts" aria-label="Unterrichtswerkzeuge">
      {vorne && <div className="gruppe">{vorne}</div>}
      {LEISTENGRUPPEN.map((gruppe, i) => (
        <div className="gruppe" key={i}>
          {gruppe
            .filter((a) => klasse || !NUR_KLASSE.has(a) || fenster.some((f) => f.art === a))
            .map((art) => {
              const offen = fenster.some((f) => f.art === art)
              const mehrfach = MEHRFACH.has(art)
              const name = mehrfach ? `Neue ${FENSTERNAMEN[art]}` : FENSTERNAMEN[art]
              return (
                <button key={art} type="button" className="leisten-knopf mit-text" aria-pressed={mehrfach ? undefined : offen} aria-label={name} title={name} onClick={() => beiAendern((alt) => schalte(alt, art))}>
                  <Symbol name={art as SymbolName} />
                  <span>{LEISTENNAMEN[art] ?? FENSTERNAMEN[art]}</span>
                </button>
              )
            })}
        </div>
      ))}
      {klasse && beiMitmachen && (
        <div className="gruppe">
          <button type="button" className="leisten-knopf mit-text" aria-label="Mitmachen freigeben" title="Die Klasse schreibt auf eigenen Seiten mit: QR-Code zeigen, Seiten ansehen und übernehmen" onClick={beiMitmachen}>
            <Symbol name="mitmachen" />
            <span>Mitmachen</span>
          </button>
        </div>
      )}
      {zeigen && (
        <div className="gruppe">
          <button type="button" className="leisten-knopf mit-text" aria-pressed={zeigen.abdecken} aria-label="Abdecken" title="Tafel abdecken und Stück für Stück aufdecken" onClick={zeigen.beiAbdecken}>
            <Symbol name="abdecken" />
            <span>Abdecken</span>
          </button>
          <button type="button" className="leisten-knopf mit-text" aria-pressed={zeigen.scheinwerfer} aria-label="Scheinwerfer" title="Alles abdunkeln bis auf einen Kreis" onClick={zeigen.beiScheinwerfer}>
            <Symbol name="scheinwerfer" />
            <span>Scheinwerfer</span>
          </button>
        </div>
      )}
    </aside>
  )
}
