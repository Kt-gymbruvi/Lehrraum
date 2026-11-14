// Ebene über der Zeichenfläche mit allen offenen Fenstern – und die rechte Leiste, die sie öffnet.
import type { ReactNode } from 'react'
import { aendere, ANWENDUNGEN, FENSTERARTEN, FENSTERNAMEN, MEHRFACH, nachVorn, NUR_KLASSE, schalte, schliesse, type FensterZustand } from '../kern/fenster.ts'
import type { Schueler } from '../kern/klassen.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'
import { Fenster } from './Fenster.tsx'
import { Klassenfunk, Lernangebote, Quizzo } from './Anwendungen.tsx'
import { Notiz, Stoppuhr, Timer, Uhr, Wuerfel } from './Inhalte.tsx'
import { Zufall } from './Zufall.tsx'

type Props = { fenster: FensterZustand[]; beiAendern: (neu: (alt: FensterZustand[]) => FensterZustand[]) => void }

/** schueler: Namen der Klasse (null in der freien Tafel); beiText: schreibt einen Text in die Mitte der Tafel */
export function Fensterebene({ fenster, beiAendern, schueler = null, beiText }: Props & { schueler?: Schueler[] | null; beiText?: (text: string) => void }) {
  return (
    <div className="fensterebene">
      {fenster.map((f) => (
        <Fenster
          key={f.id}
          fenster={f}
          beiBewegen={(x, y) => beiAendern((alt) => aendere(alt, f.id, { x, y }))}
          beiEinklappen={() => beiAendern((alt) => aendere(alt, f.id, { eingeklappt: !f.eingeklappt }))}
          beiGross={() => beiAendern((alt) => aendere(alt, f.id, { gross: !f.gross }))}
          beiSchliessen={() => beiAendern((alt) => schliesse(alt, f.id))}
          beiVorn={() => beiAendern((alt) => nachVorn(alt, f.id))}
        >
          {f.art === 'uhr' && <Uhr />}
          {f.art === 'timer' && <Timer />}
          {f.art === 'stoppuhr' && <Stoppuhr />}
          {f.art === 'wuerfel' && <Wuerfel />}
          {f.art === 'zufall' && <Zufall schueler={schueler} beiAnTafel={(t) => beiText?.(t)} />}
          {f.art === 'notiz' && <Notiz fenster={f} beiAendern={(neu) => beiAendern((alt) => aendere(alt, f.id, neu))} />}
          {f.art === 'quizzo' && <Quizzo ziel={f.ziel} beiZiel={(ziel) => beiAendern((alt) => aendere(alt, f.id, { ziel }))} />}
          {f.art === 'klassenfunk' && <Klassenfunk ziel={f.ziel} beiZiel={(ziel) => beiAendern((alt) => aendere(alt, f.id, { ziel }))} />}
          {f.art === 'lernangebote' && <Lernangebote ziel={f.ziel} beiZiel={(ziel) => beiAendern((alt) => aendere(alt, f.id, { ziel }))} />}
        </Fenster>
      ))}
    </div>
  )
}

/** Rechte Schnellzugriffsleiste – bleibt dauerhaft sichtbar. */
/** vorne: Knöpfe der Tafel, die oben in der Leiste stehen (z. B. „Hintergrund“) */
/** klasse: Tafel einer Klasse – nur dann gibt es „Zufall & Gruppen“ */
export function Schnellleiste({ fenster, beiAendern, vorne, klasse = false }: Props & { vorne?: ReactNode; klasse?: boolean }) {
  return (
    <aside className="werkzeugleiste rechts" aria-label="Unterrichtswerkzeuge">
      {vorne && <div className="gruppe">{vorne}</div>}
      {[FENSTERARTEN.filter((a) => !ANWENDUNGEN.has(a) && (klasse || !NUR_KLASSE.has(a) || fenster.some((f) => f.art === a))), FENSTERARTEN.filter((a) => ANWENDUNGEN.has(a))].map((arten, i) => (
      <div className="gruppe" key={i}>
        {arten.map((art) => {
          const offen = fenster.some((f) => f.art === art)
          const mehrfach = MEHRFACH.has(art)
          const name = mehrfach ? `Neue ${FENSTERNAMEN[art]}` : FENSTERNAMEN[art]
          return (
            <button key={art} type="button" className="leisten-knopf mit-text" aria-pressed={mehrfach ? undefined : offen} aria-label={name} title={name} onClick={() => beiAendern((alt) => schalte(alt, art))}>
              <Symbol name={art as SymbolName} />
              <span>{FENSTERNAMEN[art]}</span>
            </button>
          )
        })}
      </div>
      ))}
    </aside>
  )
}
