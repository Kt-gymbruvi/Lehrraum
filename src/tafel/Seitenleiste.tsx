// Untere Leiste: Seiten der Tafel – blättern, hinzufügen, duplizieren, umsortieren, löschen.
// Hat die Seite eine PDF-Seite als Hintergrund, kommen drei Knöpfe dazu: nach links und rechts drehen (das
// Geschriebene dreht sich mit) und nur den PDF-Hintergrund entfernen (das Geschriebene bleibt) – alle drei lassen
// sich rückgängig machen. Beim Löschen einer Seite aus einem mehrseitigen PDF fragt die Leiste, ob nur diese oder
// alle Seiten dieses PDFs gehen sollen.
import { useEffect, useState } from 'react'
import { MAX_SEITEN } from '../kern/modell.ts'
import { Symbol } from '../ui/Symbol.tsx'

type Props = {
  nr: number
  anzahl: number
  /** Hat die aktuelle Seite Inhalt? (dann fragt „Löschen“ nach) */
  beschrieben: boolean
  /** Hat die aktuelle Seite eine PDF-Seite (oder ein anderes Bild) als Hintergrund? */
  pdf: boolean
  /** Wie viele Seiten der Tafel stammen aus demselben PDF wie die aktuelle (0: unbekannt) */
  pdfAnzahl: number
  beiGehe: (nr: number) => void
  beiNeu: () => void
  beiDoppelt: () => void
  beiSchieben: (richtung: -1 | 1) => void
  beiLoeschen: () => void
  beiPdfLoeschen: () => void
  beiDrehen: (richtung: -1 | 1) => void
  beiHintergrundWeg: () => void
}

export function Seitenleiste(p: Props) {
  const [frage, setFrage] = useState(false)
  useEffect(() => setFrage(false), [p.nr, p.anzahl]) // Rückfrage gilt nur für die Seite, auf der sie gestellt wurde
  const voll = p.anzahl >= MAX_SEITEN
  const allePdf = p.pdfAnzahl > 1
  return (
    <nav className={p.pdf ? 'seitenleiste mit-pdf' : 'seitenleiste'} aria-label="Seiten">
      <button type="button" className="s-knopf" disabled={p.nr === 0} aria-label="Vorige Seite" onClick={() => p.beiGehe(p.nr - 1)}>
        <Symbol name="links" />
      </button>
      <p className="seitenzahl" role="status">
        Seite {p.nr + 1} von {p.anzahl}
      </p>
      <button type="button" className="s-knopf" disabled={p.nr === p.anzahl - 1} aria-label="Nächste Seite" onClick={() => p.beiGehe(p.nr + 1)}>
        <Symbol name="rechts" />
      </button>
      {!(frage && allePdf) && ( // bei der Rückfrage mit drei Antworten wäre die Leiste sonst zu breit
        <>
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
        </>
      )}
      {p.pdf && !frage && ( // während der Rückfrage nicht – sonst wird die Leiste zu breit
        <>
          <span className="trenner" />
          <button type="button" className="s-knopf" aria-label="PDF-Seite nach links drehen" title="PDF-Seite nach links drehen – das Geschriebene dreht sich mit" onClick={() => p.beiDrehen(-1)}>
            <Symbol name="drehenLinks" />
          </button>
          <button type="button" className="s-knopf" aria-label="PDF-Seite nach rechts drehen" title="PDF-Seite nach rechts drehen – das Geschriebene dreht sich mit" onClick={() => p.beiDrehen(1)}>
            <Symbol name="drehenRechts" />
          </button>
          <button
            type="button"
            className="s-knopf"
            aria-label="PDF-Hintergrund entfernen"
            title="Nur die PDF-Seite entfernen – das Geschriebene bleibt (lässt sich rückgängig machen)"
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
            {allePdf ? 'Nur diese Seite' : 'Ja, löschen'}
          </button>
          {allePdf && (
            <button type="button" className="s-knopf mit-text gefahr" onClick={p.beiPdfLoeschen}>
              Alle {p.pdfAnzahl} PDF-Seiten
            </button>
          )}
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
