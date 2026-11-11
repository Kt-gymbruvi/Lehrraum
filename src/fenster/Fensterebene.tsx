// Ebene über der Zeichenfläche mit allen offenen Fenstern – und die rechte Leiste, die sie öffnet.
import { aendere, FENSTERARTEN, FENSTERNAMEN, MEHRFACH, nachVorn, schalte, schliesse, type FensterZustand } from '../kern/fenster.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'
import { Fenster } from './Fenster.tsx'
import { Notiz, Stoppuhr, Timer, Uhr, Wuerfel } from './Inhalte.tsx'

type Props = { fenster: FensterZustand[]; beiAendern: (neu: (alt: FensterZustand[]) => FensterZustand[]) => void }

export function Fensterebene({ fenster, beiAendern }: Props) {
  return (
    <div className="fensterebene">
      {fenster.map((f) => (
        <Fenster
          key={f.id}
          fenster={f}
          beiBewegen={(x, y) => beiAendern((alt) => aendere(alt, f.id, { x, y }))}
          beiEinklappen={() => beiAendern((alt) => aendere(alt, f.id, { eingeklappt: !f.eingeklappt }))}
          beiSchliessen={() => beiAendern((alt) => schliesse(alt, f.id))}
          beiVorn={() => beiAendern((alt) => nachVorn(alt, f.id))}
        >
          {f.art === 'uhr' && <Uhr />}
          {f.art === 'timer' && <Timer />}
          {f.art === 'stoppuhr' && <Stoppuhr />}
          {f.art === 'wuerfel' && <Wuerfel />}
          {f.art === 'notiz' && <Notiz fenster={f} beiAendern={(neu) => beiAendern((alt) => aendere(alt, f.id, neu))} />}
        </Fenster>
      ))}
    </div>
  )
}

/** Rechte Schnellzugriffsleiste – bleibt dauerhaft sichtbar. */
export function Schnellleiste({ fenster, beiAendern }: Props) {
  return (
    <aside className="werkzeugleiste rechts" aria-label="Unterrichtswerkzeuge">
      <div className="gruppe">
        {FENSTERARTEN.map((art) => {
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
    </aside>
  )
}
