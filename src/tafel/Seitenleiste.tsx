// Untere Leiste: Seiten der Tafel – blättern, hinzufügen, duplizieren, umsortieren, löschen.
// Hat die Seite ein Bild als Hintergrund, kommen drei Knöpfe dazu: nach links und rechts drehen (das Geschriebene
// dreht sich mit) und nur das Hintergrundbild entfernen (das Geschriebene bleibt) – alle drei lassen sich rückgängig
// machen. (PDF-Seiten sind Bild-Elemente: drehen und löschen wie jedes Bild.)
import { useEffect, useState } from 'react'
import { MAX_SEITEN } from '../kern/modell.ts'
import { Symbol } from '../ui/Symbol.tsx'

type Props = {
  nr: number
  anzahl: number
  /** Hat die aktuelle Seite Inhalt? (dann fragt „Löschen“ nach) */
  beschrieben: boolean
  /** Hat die aktuelle Seite ein Bild als Hintergrund? */
  hintergrund: boolean
  beiGehe: (nr: number) => void
  /** Blätter mit fester Größe: auf der letzten Seite legt der Pfeil nach rechts eine neue Seite an */
  weiterMitNeu?: boolean
  beiNeu: () => void
  beiDoppelt: () => void
  beiSchieben: (richtung: -1 | 1) => void
  beiLoeschen: () => void
  beiDrehen: (richtung: -1 | 1) => void
  beiHintergrundWeg: () => void
  beiUebersicht: () => void
}

export function Seitenleiste(p: Props) {
  const [frage, setFrage] = useState(false)
  useEffect(() => setFrage(false), [p.nr, p.anzahl]) // Rückfrage gilt nur für die Seite, auf der sie gestellt wurde
  const voll = p.anzahl >= MAX_SEITEN
  return (
    <nav className={p.hintergrund ? 'seitenleiste mit-hintergrund' : 'seitenleiste'} aria-label="Seiten">
      <button type="button" className="s-knopf" aria-label="Seitenübersicht" title="Alle Seiten im Überblick" onClick={p.beiUebersicht}>
        <Symbol name="uebersicht" />
      </button>
      <button type="button" className="s-knopf" disabled={p.nr === 0} aria-label="Vorige Seite" onClick={() => p.beiGehe(p.nr - 1)}>
        <Symbol name="links" />
      </button>
      <p className="seitenzahl" role="status">
        Seite {p.nr + 1} von {p.anzahl}
      </p>
      {p.weiterMitNeu && p.nr === p.anzahl - 1 ? (
        <button type="button" className="s-knopf" disabled={voll} aria-label="Neue Seite anlegen" title="Neue Seite anlegen" onClick={p.beiNeu}>
          <Symbol name="plus" />
        </button>
      ) : (
        <button type="button" className="s-knopf" disabled={p.nr === p.anzahl - 1} aria-label="Nächste Seite" onClick={() => p.beiGehe(p.nr + 1)}>
          <Symbol name="rechts" />
        </button>
      )}
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
      {p.hintergrund && !frage && ( // während der Rückfrage nicht – sonst wird die Leiste zu breit
        <>
          <span className="trenner" />
          <button type="button" className="s-knopf" aria-label="Hintergrundbild nach links drehen" title={`Hintergrundbild nach links drehen – das Geschriebene dreht sich mit`} onClick={() => p.beiDrehen(-1)}>
            <Symbol name="drehenLinks" />
          </button>
          <button type="button" className="s-knopf" aria-label="Hintergrundbild nach rechts drehen" title={`Hintergrundbild nach rechts drehen – das Geschriebene dreht sich mit`} onClick={() => p.beiDrehen(1)}>
            <Symbol name="drehenRechts" />
          </button>
          <button
            type="button"
            className="s-knopf"
            aria-label="Hintergrundbild entfernen"
            title="Nur das Hintergrundbild entfernen – das Geschriebene bleibt (lässt sich rückgängig machen)"
            onClick={p.beiHintergrundWeg}
          >
            <Symbol name="hintergrundWeg" />
          </button>
        </>
      )}
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
