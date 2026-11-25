// Untere Leiste: Seiten der Tafel – blättern, hinzufügen, duplizieren, umsortieren, löschen.
// Gestaltung „Atelier“: Die Seiten um die gezeigte herum stehen als kleine Vorschaubilder im Streifen (antippen öffnet),
// die gezeigte mit Ring; die Befehle sind nur noch Symbole.
// Hat die Seite ein Bild als Hintergrund, kommen drei Knöpfe dazu: nach links und rechts drehen (das Geschriebene
// dreht sich mit) und nur das Hintergrundbild entfernen (das Geschriebene bleibt) – alle drei lassen sich rückgängig
// machen. (PDF-Seiten sind Bild-Elemente: drehen und löschen wie jedes Bild.) Beim Löschen einer Seite aus einem
// mehrseitigen PDF fragt die Leiste, ob nur diese oder alle Seiten dieses PDFs gehen sollen.
import { useEffect, useState } from 'react'
import { MAX_SEITEN, type Format, type Seite } from '../kern/modell.ts'
import { Symbol } from '../ui/Symbol.tsx'
import { Vorschau } from './Seitenuebersicht.tsx'

/** So viele Seiten zeigt der Streifen höchstens (um die gezeigte herum) */
const IM_STREIFEN = 7
/** Breite eines Vorschaubilds im Streifen (CSS-Pixel) */
const STREIFEN_BREITE = 60

type Props = {
  /** Alle Seiten (für die Vorschaubilder; fehlt: kein Streifen) */
  seiten?: Seite[]
  format?: Format
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
  /** Wie viele Seiten stammen aus demselben PDF wie diese? (0: keine PDF-Seite) */
  pdfAnzahl: number
  /** Alle Seiten dieses PDFs löschen */
  beiPdfLoeschen: () => void
  beiDrehen: (richtung: -1 | 1) => void
  beiHintergrundWeg: () => void
  beiUebersicht: () => void
}

export function Seitenleiste(p: Props) {
  const [frage, setFrage] = useState(false)
  useEffect(() => setFrage(false), [p.nr, p.anzahl]) // Rückfrage gilt nur für die Seite, auf der sie gestellt wurde
  const voll = p.anzahl >= MAX_SEITEN
  const allePdf = p.pdfAnzahl > 1
  const von = Math.max(0, Math.min(p.nr - Math.floor(IM_STREIFEN / 2), p.anzahl - IM_STREIFEN))
  const streifen = p.seiten && p.format ? p.seiten.slice(von, von + IM_STREIFEN) : []
  const format = p.format
  return (
    <nav className={p.hintergrund ? 'seitenleiste mit-hintergrund' : 'seitenleiste'} aria-label="Seiten">
      <button type="button" className="s-knopf" aria-label="Seitenübersicht" title="Alle Seiten im Überblick" onClick={p.beiUebersicht}>
        <Symbol name="uebersicht" />
      </button>
      <button type="button" className="s-knopf" disabled={p.nr === 0} aria-label="Vorige Seite" onClick={() => p.beiGehe(p.nr - 1)}>
        <Symbol name="links" />
      </button>
      <p className={streifen.length ? 'seitenzahl unsichtbar' : 'seitenzahl'} role="status">
        Seite {p.nr + 1} von {p.anzahl}
      </p>
      {format && streifen.length > 0 && (
        <div className="seitenstreifen" role="group" aria-label="Seiten im Streifen">
          {streifen.map((seite, i) => {
            const nr = von + i
            return (
              <button key={seite.id} type="button" className="streifen-seite" aria-current={nr === p.nr ? 'page' : undefined} aria-label={`Zu Seite ${nr + 1}`} title={`Seite ${nr + 1}`} onClick={() => p.beiGehe(nr)}>
                <Vorschau seite={seite} format={format} breite={STREIFEN_BREITE} />
                <span className="streifen-nr" aria-hidden="true">{nr + 1}</span>
              </button>
            )
          })}
        </div>
      )}
      {p.weiterMitNeu && p.nr === p.anzahl - 1 ? (
        <button type="button" className="s-knopf" disabled={voll} aria-label="Neue Seite anlegen" title="Weiter: neue Seite anlegen" onClick={p.beiNeu}>
          <Symbol name="rechts" />
        </button>
      ) : (
        <button type="button" className="s-knopf" disabled={p.nr === p.anzahl - 1} aria-label="Nächste Seite" onClick={() => p.beiGehe(p.nr + 1)}>
          <Symbol name="rechts" />
        </button>
      )}
      {!(frage && allePdf) && ( // bei der Rückfrage mit drei Antworten wäre die Leiste sonst zu breit
        <>
          <span className="trenner" />
          <button type="button" className="s-knopf" disabled={voll} aria-label="Neue Seite" title="Neue Seite" onClick={p.beiNeu}>
            <Symbol name="plus" />
          </button>
          <button type="button" className="s-knopf" disabled={voll} aria-label="Seite duplizieren" title="Seite duplizieren" onClick={p.beiDoppelt}>
            <Symbol name="duplizieren" />
          </button>
          <button type="button" className="s-knopf" disabled={p.nr === 0} aria-label="Seite nach vorne schieben" title="Seite nach vorne schieben" onClick={() => p.beiSchieben(-1)}>
            <Symbol name="nachVorne" />
          </button>
          <button type="button" className="s-knopf" disabled={p.nr === p.anzahl - 1} aria-label="Seite nach hinten schieben" title="Seite nach hinten schieben" onClick={() => p.beiSchieben(1)}>
            <Symbol name="nachHinten" />
          </button>
        </>
      )}
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
            {allePdf ? 'Nur diese Seite' : 'Ja, löschen'}
          </button>
          {allePdf && (
            <button type="button" className="s-knopf mit-text gefahr" title="Alle Seiten, die aus diesem PDF stammen, mit allem, was darauf steht" onClick={p.beiPdfLoeschen}>
              Ganzes PDF ({p.pdfAnzahl} Seiten)
            </button>
          )}
          <button type="button" className="s-knopf mit-text" onClick={() => setFrage(false)}>
            Nein
          </button>
        </>
      ) : (
        <button
          type="button"
          className="s-knopf"
          disabled={p.anzahl === 1 && !p.beschrieben}
          aria-label="Seite löschen"
          title="Seite löschen"
          onClick={() => (p.beschrieben ? setFrage(true) : p.beiLoeschen())} // leere Seiten ohne Rückfrage
        >
          <Symbol name="leeren" />
        </button>
      )}
    </nav>
  )
}
