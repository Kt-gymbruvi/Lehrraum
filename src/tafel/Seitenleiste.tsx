// Untere Leiste: Seiten der Tafel – blättern, hinzufügen, duplizieren, umsortieren, löschen.
import { useEffect, useState } from 'react'
import { MAX_SEITEN } from '../kern/modell.ts'
import { Symbol } from '../ui/Symbol.tsx'

type Props = {
  nr: number
  anzahl: number
  /** Hat die aktuelle Seite Inhalt? (dann fragt „Löschen“ nach) */
  beschrieben: boolean
  beiGehe: (nr: number) => void
  beiNeu: () => void
  beiDoppelt: () => void
  beiSchieben: (richtung: -1 | 1) => void
  beiLoeschen: () => void
}

export function Seitenleiste(p: Props) {
  const [frage, setFrage] = useState(false)
  useEffect(() => setFrage(false), [p.nr, p.anzahl]) // Rückfrage gilt nur für die Seite, auf der sie gestellt wurde
  const voll = p.anzahl >= MAX_SEITEN
  return (
    <nav className="seitenleiste" aria-label="Seiten">
      <button type="button" className="s-knopf" disabled={p.nr === 0} aria-label="Vorige Seite" onClick={() => p.beiGehe(p.nr - 1)}>
        <Symbol name="links" />
      </button>
      <p className="seitenzahl" role="status">
        Seite {p.nr + 1} von {p.anzahl}
      </p>
      <button type="button" className="s-knopf" disabled={p.nr === p.anzahl - 1} aria-label="Nächste Seite" onClick={() => p.beiGehe(p.nr + 1)}>
        <Symbol name="rechts" />
      </button>
      <span className="trenner" />
      <button type="button" className="s-knopf mit-text" disabled={voll} onClick={p.beiNeu}>
        <Symbol name="plus" />
        Neue Seite
      </button>
      <button type="button" className="s-knopf mit-text" disabled={voll} onClick={p.beiDoppelt}>
        <Symbol name="duplizieren" />
        Seite duplizieren
      </button>
      <button type="button" className="s-knopf" disabled={p.nr === 0} aria-label="Seite nach vorne schieben" title="Seite nach vorne schieben" onClick={() => p.beiSchieben(-1)}>
        <Symbol name="nachVorne" />
      </button>
      <button type="button" className="s-knopf" disabled={p.nr === p.anzahl - 1} aria-label="Seite nach hinten schieben" title="Seite nach hinten schieben" onClick={() => p.beiSchieben(1)}>
        <Symbol name="nachHinten" />
      </button>
      {frage ? (
        <>
          <span className="rueckfrage">Seite {p.nr + 1} löschen?</span>
          <button type="button" className="s-knopf mit-text gefahr" onClick={p.beiLoeschen}>
            Ja, löschen
          </button>
          <button type="button" className="s-knopf mit-text" onClick={() => setFrage(false)}>
            Nein
          </button>
        </>
      ) : (
        <button
          type="button"
          className="s-knopf mit-text"
          disabled={p.anzahl === 1 && !p.beschrieben}
          onClick={() => (p.beschrieben ? setFrage(true) : p.beiLoeschen())} // leere Seiten ohne Rückfrage
        >
          <Symbol name="leeren" />
          Seite löschen
        </button>
      )}
    </nav>
  )
}
