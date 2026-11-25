// Linke Werkzeugleiste der Tafel (eine Spalte, je Werkzeugfamilie ein Knopf) und die Kontext-Kapsel über der Tafel
// (Varianten, Farben, Stärke, Einfügen, Leeren) – beide bleiben dauerhaft sichtbar. Aufklappfelder:
//   Auswahl: erneutes Antippen der gewählten Auswahl öffnet Rechteck oder Lasso.
//   Radierer: erneutes Antippen des gewählten Radierers öffnet Art und Größe.
//   Rechteck, Ellipse, Linie, Pfeil: erneutes Antippen öffnet Füllung, Linienart (durchgezogen, gestrichelt, gepunktet)
//   und beim Pfeil eine oder zwei Spitzen.
//   Mehr (in der Kapsel, Feld darunter): weitere Farben, eigene Farbplätze mit dem Farbwähler des Geräts und ein Regler für die Stärke.
// Ein Feld schließt sich beim Antippen außerhalb (auch der Tafel), mit Escape und beim Wechsel des Werkzeugs.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AuswahlArt } from '../kern/auswahl.ts'
import type { Formwahl } from '../kern/einstellungen.ts'
import type { InstrumentArt } from '../kern/instrumente.ts'
import { LINIENARTEN, type Linienart } from '../kern/modell.ts'
import { begrenzeStaerke, inLeiste, PALETTE, STAERKE_MAX, STAERKE_MIN, staerkeInLeiste } from '../kern/farben.ts'
import { FARBEN, STAERKEN } from '../kern/modell.ts'
import { RADIERER_ARTEN, RADIERER_GROESSEN, RADIERER_RADIUS, type Radierer } from '../kern/radieren.ts'
import { Geometriewahl } from './Geometriewahl.tsx'
import { useSchliessenDraussen } from './handballen.ts'
import { Symbol, type SymbolName } from '../ui/Symbol.tsx'
import { BUEHNEN_FAMILIEN, FAMILIEN, familieVon, merke, vertreter, type FamilienId, type Zuletzt } from '../kern/werkzeugfamilien.ts'
import type { Werkzeug } from './Zeichenflaeche.tsx'

type Props = {
  werkzeug: Werkzeug
  farbe: string
  staerke: number
  radierer: Radierer
  /** Selbst gewählte Farben dieses Geräts (neueste zuerst) */
  eigeneFarben: string[]
  beiRadierer: (r: Radierer) => void
  /** Auswahl mit Rechteck oder Lasso */
  auswahlArt: AuswahlArt
  beiAuswahlArt: (a: AuswahlArt) => void
  /** Füllung, Linienart und Pfeilspitzen neuer Formen */
  formwahl: Formwahl
  beiFormwahl: (w: Formwahl) => void
  leer: boolean
  /** Anzahl ausgewählter Elemente */
  gewaehlt: number
  /** Gibt es etwas Kopiertes zum Einfügen? */
  kannEinfuegen: boolean
  beiWerkzeug: (w: Werkzeug) => void
  beiFarbe: (f: string) => void
  /** Eine Farbe aus dem Farbwähler des Geräts (kommt zu den eigenen Plätzen) */
  beiEigeneFarbe: (f: string) => void
  beiStaerke: (s: number) => void
  beiLeeren: () => void
  beiEinfuegen: () => void
  beiLoeschen: () => void
  /** fehlt: kein Bild-Knopf (Schülerseite) */
  beiBild?: () => void
  /** fehlt (beiInstrument): kein Geometrie-Knopf (Schülerseite). instrumente: Welche Geometrie-Werkzeuge liegen auf der Tafel? */
  instrumente?: InstrumentArt[]
  beiInstrument?: (art: InstrumentArt) => void
  /** Bühne (Präsentieren): nur Stift, Radierer und Laser, dazu ein Knopf zum Verlassen */
  buehne?: boolean
  beiBuehneEnde?: () => void
}

export const WERKZEUGE: { wert: Werkzeug; name: string; symbol: SymbolName; taste: string }[] = [
  { wert: 'auswahl', name: 'Auswahl', symbol: 'auswahl', taste: 'A' },
  { wert: 'hand', name: 'Hand', symbol: 'hand', taste: 'H' },
  { wert: 'stift', name: 'Stift', symbol: 'stift', taste: 'S' },
  { wert: 'marker', name: 'Textmarker', symbol: 'marker', taste: 'M' },
  { wert: 'radierer', name: 'Radierer', symbol: 'radierer', taste: 'R' },
  { wert: 'text', name: 'Text', symbol: 'text', taste: 'T' },
  { wert: 'tabelle', name: 'Tabelle', symbol: 'tabelle', taste: 'K' },
  { wert: 'linie', name: 'Linie', symbol: 'linie', taste: 'L' },
  { wert: 'pfeil', name: 'Pfeil', symbol: 'pfeil', taste: 'P' },
  { wert: 'rechteck', name: 'Rechteck', symbol: 'rechteck', taste: 'Q' },
  { wert: 'ellipse', name: 'Ellipse', symbol: 'ellipse', taste: 'O' },
  { wert: 'fuellen', name: 'Füllen', symbol: 'farbeimer', taste: 'F' },
  { wert: 'laser', name: 'Laserpointer', symbol: 'laser', taste: 'Z' },
]

/** Werkzeuge, deren Feld sich durch erneutes Antippen öffnet – mit der Höhe des Feldes */
const FELD_HOEHE = { auswahl: 140, radierer: 240, rechteck: 240, ellipse: 240, linie: 140, pfeil: 240 } as const
type Werkzeugfeld = keyof typeof FELD_HOEHE
const hatFeld = (w: Werkzeug): w is Werkzeugfeld => w in FELD_HOEHE

const AUSWAHL_WAHL: { wert: AuswahlArt; name: string; symbol: SymbolName; titel: string }[] = [
  { wert: 'rechteck', name: 'Rechteck', symbol: 'auswahl', titel: 'Rechteck aufziehen: alles, was es berührt, wird ausgewählt' },
  { wert: 'lasso', name: 'Lasso', symbol: 'lasso', titel: 'Frei umfahren: ausgewählt wird, was überwiegend innerhalb liegt' },
]

const LINIEN_NAME: Record<Linienart, string> = { voll: 'Durchgezogen', gestrichelt: 'Gestrichelt', gepunktet: 'Gepunktet' }
const LINIEN_SYMBOL: Record<Linienart, SymbolName> = { voll: 'linie', gestrichelt: 'linieGestrichelt', gepunktet: 'liniePunkte' }

/** Kurz, was gerade für neue Formen gilt (für den Titel des Knopfes) */
function formBeschreibung(w: Werkzeug, f: Formwahl): string {
  const teile = [
    ...((w === 'rechteck' || w === 'ellipse') && f.gefuellt ? ['ausgefüllt'] : []),
    ...(f.linienart !== 'voll' ? [LINIEN_NAME[f.linienart].toLowerCase()] : []),
    ...(w === 'pfeil' && f.beidseitig ? ['in beide Richtungen'] : []),
  ]
  return teile.length ? ', ' + teile.join(', ') : ''
}

/** Feld der Formwerkzeuge: Füllung (Rechteck, Ellipse), Spitzen (Pfeil), Linienart (alle) */
function FormFeld({ art, wahl, beiWahl }: { art: 'rechteck' | 'ellipse' | 'linie' | 'pfeil'; wahl: Formwahl; beiWahl: (w: Formwahl) => void }) {
  return (
    <>
      {(art === 'rechteck' || art === 'ellipse') && (
        <div className="feld-reihe" role="group" aria-label="Füllung">
          {[false, true].map((g) => (
            <button
              key={String(g)}
              type="button"
              className="leisten-knopf mit-text"
              aria-pressed={wahl.gefuellt === g}
              aria-label={g ? 'Ausgefüllt' : 'Umriss'}
              title={g ? 'Innen mit der Farbe ausgefüllt' : 'Nur der Umriss – innen frei zum Hineinschreiben'}
              onClick={() => beiWahl({ ...wahl, gefuellt: g })}
            >
              <Symbol name={art} voll={g} />
              <span>{g ? 'Ausgefüllt' : 'Umriss'}</span>
            </button>
          ))}
        </div>
      )}
      {art === 'pfeil' && (
        <div className="feld-reihe" role="group" aria-label="Pfeilspitzen">
          {[false, true].map((b) => (
            <button
              key={String(b)}
              type="button"
              className="leisten-knopf mit-text"
              aria-pressed={wahl.beidseitig === b}
              aria-label={b ? 'Beide Richtungen' : 'Eine Richtung'}
              title={b ? 'Spitzen an beiden Enden' : 'Spitze am Ende'}
              onClick={() => beiWahl({ ...wahl, beidseitig: b })}
            >
              <Symbol name={b ? 'pfeilBeide' : 'pfeil'} />
              <span>{b ? 'Beide' : 'Eine'}</span>
            </button>
          ))}
        </div>
      )}
      <div className="feld-reihe" role="group" aria-label="Linienart">
        {LINIENARTEN.map((l) => (
          <button key={l} type="button" className="leisten-knopf mit-text" aria-pressed={wahl.linienart === l} aria-label={LINIEN_NAME[l]} title={LINIEN_NAME[l]} onClick={() => beiWahl({ ...wahl, linienart: l })}>
            <Symbol name={LINIEN_SYMBOL[l]} />
            <span>{LINIEN_NAME[l]}</span>
          </button>
        ))}
      </div>
    </>
  )
}

/** Größe des Punktes, der eine Stärke zeigt (wie bei den drei Knöpfen, nach oben begrenzt) */
const punktGroesse = (s: number) => Math.min(30, s * 1.4 + 2)

/**
 * Ruft `tun` beim echten „change“ des Browsers auf – beim Farbwähler erst beim Schließen, beim Regler erst beim
 * Loslassen. (Reacts onChange käme bei jeder Bewegung und ergäbe viele Schritte im Verlauf.)
 */
function useFertig(ref: React.RefObject<HTMLInputElement | null>, tun: (wert: string) => void) {
  const aktuell = useRef(tun)
  aktuell.current = tun
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fertig = () => aktuell.current(el.value)
    el.addEventListener('change', fertig)
    return () => el.removeEventListener('change', fertig)
  }, [ref])
}

function MehrFeld(p: Props) {
  const waehler = useRef<HTMLInputElement>(null)
  const regler = useRef<HTMLInputElement>(null)
  /** Wert, während der Regler gezogen wird (übernommen wird erst beim Loslassen) */
  const [ziehend, setZiehend] = useState<number | null>(null)
  useFertig(waehler, (f) => p.beiEigeneFarbe(f))
  useFertig(regler, (s) => {
    setZiehend(null)
    p.beiStaerke(begrenzeStaerke(Number(s)))
  })
  const staerke = ziehend ?? p.staerke

  return (
    <>
      <p className="feld-titel">Farben</p>
      <div className="palette" role="group" aria-label="Weitere Farben">
        {PALETTE.map((f) => (
          <button key={f.wert} type="button" className="farb-knopf klein" aria-pressed={p.farbe === f.wert} aria-label={f.name} title={f.name} onClick={() => p.beiFarbe(f.wert)}>
            <span style={{ background: f.wert }} />
          </button>
        ))}
      </div>
      <p className="feld-titel">Eigene Farben</p>
      <div className="palette" role="group" aria-label="Eigene Farben">
        {p.eigeneFarben.map((f) => (
          <button key={f} type="button" className="farb-knopf klein" aria-pressed={p.farbe === f} aria-label={'Eigene Farbe ' + f} title={'Eigene Farbe ' + f} onClick={() => p.beiFarbe(f)}>
            <span style={{ background: f }} />
          </button>
        ))}
        <label className="farb-knopf klein farbwahl" title="Farbe frei wählen (wird als eigene Farbe gemerkt)">
          <Symbol name="plus" />
          <input ref={waehler} type="color" aria-label="Farbe frei wählen" defaultValue={p.farbe} />
        </label>
      </div>
      <p className="feld-titel">
        Stärke <output>{staerke}</output>
      </p>
      <div className="regler-reihe">
        <input
          ref={regler}
          type="range"
          aria-label="Strichstärke"
          min={STAERKE_MIN}
          max={STAERKE_MAX}
          step={1}
          value={staerke}
          onChange={(e) => setZiehend(begrenzeStaerke(Number(e.target.value)))}
        />
        <span className="punkt-feld">
          <span className="staerke-punkt" style={{ width: punktGroesse(staerke), height: punktGroesse(staerke), background: p.farbe }} />
        </span>
      </div>
    </>
  )
}

/** Offenes Aufklappfeld mit seiner Lage */
function useFeld<A extends string>() {
  const feldRef = useRef<HTMLDivElement>(null)
  const [feld, setFeld] = useState<{ art: A; links: number; oben: number } | null>(null)
  return { feld, setFeld, feldRef }
}

/**
 * Linke Leiste „Atelier“: eine Spalte, je Werkzeugfamilie ein Knopf. Er steht für das Werkzeug, das in seiner Familie
 * zuletzt benutzt wurde; die anderen stehen als Varianten in der Kapsel. Erneutes Antippen öffnet wie bisher das Feld
 * mit Art und Größe (Radierer), Rechteck oder Lasso (Auswahl) oder Füllung und Linienart (Formen).
 */
export function Werkzeugleiste(p: Props) {
  const ausloeser = { auswahl: useRef<HTMLButtonElement>(null), radierer: useRef<HTMLButtonElement>(null), rechteck: useRef<HTMLButtonElement>(null), ellipse: useRef<HTMLButtonElement>(null), linie: useRef<HTMLButtonElement>(null), pfeil: useRef<HTMLButtonElement>(null) }
  const { feld, setFeld, feldRef } = useFeld<Werkzeugfeld>()
  // Die Felder der Werkzeuge gehören zu ihrem Werkzeug: wird ein anderes gewählt, sind sie zu
  const offen = feld && p.werkzeug === feld.art ? feld : null
  const offeneArt = offen?.art ?? null
  const zuletzt = useZuletzt(p.werkzeug)

  useSchliessenDraussen(!!offeneArt, () => [feldRef.current, offeneArt && ausloeser[offeneArt].current], () => setFeld(null))

  /** Öffnet das Feld rechts neben der ganzen Leiste, auf Höhe seines Knopfes – oder schließt es wieder */
  const umschalten = (art: Werkzeugfeld, hoehe: number) => {
    if (offeneArt === art) return setFeld(null)
    const knopf = ausloeser[art].current
    const r = knopf?.getBoundingClientRect()
    const leiste = knopf?.closest('aside')?.getBoundingClientRect()
    setFeld({ art, links: (leiste?.right ?? r?.right ?? 64) + 8, oben: Math.max(8, Math.min(r?.top ?? 8, window.innerHeight - hoehe)) })
  }

  const waehle = (w: Werkzeug) => {
    if (hatFeld(w) && p.werkzeug === w) return umschalten(w, FELD_HOEHE[w])
    setFeld(null)
    p.beiWerkzeug(w)
  }
  const auswahlName = AUSWAHL_WAHL.find((a) => a.wert === p.auswahlArt)?.name ?? ''
  const artName = RADIERER_ARTEN.find((a) => a.wert === p.radierer.art)?.name ?? ''

  const familienKnopf = (id: FamilienId) => {
    const fam = FAMILIEN.find((f) => f.id === id)!
    const wert = vertreter(fam, zuletzt)
    const w = WERKZEUGE.find((x) => x.wert === wert)!
    const feldArt = hatFeld(w.wert) ? w.wert : null
    const symbol = w.wert === 'auswahl' && p.auswahlArt === 'lasso' ? 'lasso' : w.wert === 'radierer' && p.radierer.art === 'schwamm' ? 'schwamm' : w.symbol
    const f = p.formwahl
    const istFlaeche = w.wert === 'rechteck' || w.wert === 'ellipse'
    const zeichen: SymbolName = w.wert === 'linie' && f.linienart !== 'voll' ? LINIEN_SYMBOL[f.linienart] : w.wert === 'pfeil' && f.beidseitig ? 'pfeilBeide' : symbol
    const titel =
      w.wert === 'auswahl'
        ? `${w.name}: ${auswahlName} (${w.taste}) – noch einmal antippen: Rechteck oder Lasso`
        : w.wert === 'radierer'
          ? `${w.name}: ${artName} (${w.taste}) – noch einmal antippen: Art und Größe`
          : istFlaeche || w.wert === 'linie' || w.wert === 'pfeil'
            ? `${w.name}${formBeschreibung(w.wert, f)} (${w.taste}) – noch einmal antippen: ${istFlaeche ? 'Füllung und ' : ''}Linienart${w.wert === 'pfeil' ? ' und Spitzen' : ''}`
            : w.wert === 'laser'
              ? `${w.name} (${w.taste}) – zeigen, die Spur verschwindet von selbst`
              : w.wert === 'fuellen'
                ? `${w.name} (${w.taste}) – Rechteck, Ellipse oder Dreieck antippen: mit der gewählten Farbe füllen (noch einmal: Füllung weg)`
                : w.wert === 'tabelle'
                  ? `${w.name} (${w.taste}) – antippen, Zeilen und Spalten wählen; Zellen antippen zum Schreiben`
                  : `${w.name} (${w.taste})`
    return (
      <button
        key={id}
        ref={feldArt ? ausloeser[feldArt] : undefined}
        type="button"
        className={'leisten-knopf' + (feldArt ? ' hat-feld' : '')}
        aria-pressed={p.werkzeug === w.wert}
        aria-label={w.name}
        aria-expanded={feldArt ? offeneArt === feldArt : undefined}
        title={titel}
        onClick={() => waehle(w.wert)}
      >
        <Symbol name={zeichen} voll={f.gefuellt && istFlaeche} />
      </button>
    )
  }

  if (p.buehne)
    return (
      <aside className="werkzeugleiste links buehne-leiste" aria-label="Zeichenwerkzeuge">
        <div className="gruppe" role="group" aria-label="Werkzeug">
          {BUEHNEN_FAMILIEN.map(familienKnopf)}
        </div>
        {p.beiBuehneEnde && (
          <div className="gruppe">
            <button type="button" className="leisten-knopf" aria-label="Alle Leisten zeigen" title="Alle Leisten zeigen – Präsentieren beenden (Esc)" onClick={p.beiBuehneEnde}>
              <Symbol name="leistenZeigen" />
            </button>
          </div>
        )}
      </aside>
    )

  return (
    <aside className="werkzeugleiste links" aria-label="Zeichenwerkzeuge">
      <div className="gruppe" role="group" aria-label="Werkzeug">
        {familienKnopf('auswahl')}
      </div>
      <div className="gruppe" role="group" aria-label="Schreiben">
        {familienKnopf('stift')}
        {familienKnopf('radierer')}
      </div>
      <div className="gruppe" role="group" aria-label="Gestalten">
        {familienKnopf('text')}
        {familienKnopf('formen')}
        {familienKnopf('fuellen')}
        {p.beiBild && (
          <button type="button" className="leisten-knopf" aria-label="Bild einfügen" title="Bild einfügen (auch per Einfügen aus der Zwischenablage oder Hineinziehen)" onClick={p.beiBild}>
            <Symbol name="bild" />
          </button>
        )}
      </div>
      <div className="gruppe" role="group" aria-label="Zeigen">
        {p.beiInstrument && <Geometriewahl an={p.instrumente ?? []} beiInstrument={p.beiInstrument} />}
        {familienKnopf('laser')}
      </div>

      {offen &&
        createPortal(
          <div
            ref={feldRef}
            className="aufklappfeld"
            role="dialog"
            aria-label={offen.art === 'radierer' ? 'Art und Größe des Radierers' : offen.art === 'auswahl' ? 'Art der Auswahl' : 'Form: Füllung, Linienart, Spitzen'}
            style={{ left: offen.links, top: offen.oben }}
          >
            {offen.art === 'rechteck' || offen.art === 'ellipse' || offen.art === 'linie' || offen.art === 'pfeil' ? (
              <FormFeld art={offen.art} wahl={p.formwahl} beiWahl={p.beiFormwahl} />
            ) : offen.art === 'auswahl' ? (
              <div className="feld-reihe" role="group" aria-label="Art der Auswahl">
                {AUSWAHL_WAHL.map((a) => (
                  <button
                    key={a.wert}
                    type="button"
                    className="leisten-knopf mit-text"
                    aria-pressed={p.auswahlArt === a.wert}
                    aria-label={a.name}
                    title={a.titel}
                    onClick={() => {
                      p.beiAuswahlArt(a.wert)
                      setFeld(null)
                    }}
                  >
                    <Symbol name={a.symbol} />
                    <span>{a.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="feld-reihe" role="group" aria-label="Art des Radierers">
                  {RADIERER_ARTEN.map((a) => (
                    <button
                      key={a.wert}
                      type="button"
                      className="leisten-knopf mit-text"
                      aria-pressed={p.radierer.art === a.wert}
                      aria-label={a.wert === 'schwamm' ? 'Schwamm' : 'Element-Radierer'}
                      title={a.titel}
                      onClick={() => p.beiRadierer({ ...p.radierer, art: a.wert })}
                    >
                      <Symbol name={a.wert === 'schwamm' ? 'schwamm' : 'radierer'} />
                      <span>{a.name}</span>
                    </button>
                  ))}
                </div>
                <div className="feld-reihe" role="group" aria-label="Größe des Radierers">
                  {RADIERER_GROESSEN.map((g) => {
                    const d = Math.min(40, RADIERER_RADIUS[g.wert] * 0.9 + 6)
                    return (
                      <button key={g.wert} type="button" className="leisten-knopf" aria-pressed={p.radierer.groesse === g.wert} aria-label={'Radierer ' + g.name} title={'Größe: ' + g.name} onClick={() => p.beiRadierer({ ...p.radierer, groesse: g.wert })}>
                        <span className="radierer-kreis" style={{ width: d, height: d }} />
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>,
          document.body, // nicht in der Leiste: Safari am iPad schneidet feste Felder in einer rollbaren Leiste ab
        )}
    </aside>
  )
}

/** Merkt je Familie das zuletzt benutzte Werkzeug (nur solange die Tafel offen ist) */
function useZuletzt(werkzeug: Werkzeug): Zuletzt {
  const [zuletzt, setZuletzt] = useState<Zuletzt>(() => merke({}, werkzeug))
  const aktuell = merke(zuletzt, werkzeug)
  useEffect(() => {
    if (aktuell !== zuletzt) setZuletzt(aktuell)
  }, [aktuell, zuletzt])
  return aktuell
}

/**
 * Kapsel über der Tafel: Varianten der gewählten Werkzeugfamilie, Farben, Stärke, Einfügen und Leeren.
 * „Mehr“ öffnet darunter weitere Farben, eigene Farbplätze und den Regler für die Stärke.
 */
export function Kontextkapsel(p: Props) {
  const mehrKnopf = useRef<HTMLButtonElement>(null)
  const { feld, setFeld, feldRef } = useFeld<'mehr'>()
  useSchliessenDraussen(!!feld, () => [feldRef.current, mehrKnopf.current], () => setFeld(null))
  const umschalten = () => {
    if (feld) return setFeld(null)
    const r = mehrKnopf.current?.getBoundingClientRect()
    setFeld({ art: 'mehr', links: Math.max(8, Math.min(r?.left ?? 8, window.innerWidth - 340)), oben: (r?.bottom ?? 64) + 8 })
  }
  const familie = familieVon(p.werkzeug)
  // Farbe oder Stärke außerhalb der Kapsel: der Knopf „Mehr“ zeigt sie als Punkt
  const besonders = !inLeiste(p.farbe) || !staerkeInLeiste(p.staerke)

  return (
    <div className="kontextkapsel" role="toolbar" aria-label="Farbe, Stärke und Varianten">
      {familie.glieder.length > 1 && (
        <>
          <div className="varianten" role="radiogroup" aria-label="Art des Werkzeugs">
            {familie.glieder.map((g) => {
              const w = WERKZEUGE.find((x) => x.wert === g)!
              return (
                <button key={g} type="button" role="radio" className="variante" aria-checked={p.werkzeug === g} aria-label={w.name} title={`${w.name} (${w.taste})`} onClick={() => p.beiWerkzeug(g)}>
                  <Symbol name={w.symbol} />
                  {familie.glieder.length <= 2 && <span>{w.name}</span>}
                </button>
              )
            })}
          </div>
          <span className="trenner" aria-hidden="true" />
        </>
      )}
      <div className="kapsel-gruppe" role="group" aria-label="Farbe">
        {FARBEN.map((f) => (
          <button key={f.wert} type="button" className="farb-knopf" aria-pressed={p.farbe === f.wert} aria-label={f.name} title={f.name} onClick={() => p.beiFarbe(f.wert)}>
            <span style={{ background: f.wert, color: f.wert }} />
          </button>
        ))}
        <button ref={mehrKnopf} type="button" className="farb-knopf mehr" aria-pressed={besonders} aria-expanded={!!feld} aria-label="Mehr Farben und Stärken" title="Mehr Farben, eigene Farben und Stärke" onClick={umschalten}>
          {besonders ? <span className="staerke-punkt" style={{ width: Math.max(8, Math.min(22, punktGroesse(p.staerke))), height: Math.max(8, Math.min(22, punktGroesse(p.staerke))), background: p.farbe }} /> : <Symbol name="palette" />}
        </button>
      </div>
      <span className="trenner" aria-hidden="true" />
      <div className="kapsel-gruppe" role="group" aria-label="Strichstärke und Schriftgröße">
        {STAERKEN.map((s) => (
          <button key={s.wert} type="button" className="leisten-knopf schmal" aria-pressed={p.staerke === s.wert} aria-label={'Strichstärke ' + s.name} title={'Strichstärke und Schriftgröße: ' + s.name} onClick={() => p.beiStaerke(s.wert)}>
            <span className="staerke-punkt" style={{ width: s.wert * 1.4 + 2, height: s.wert * 1.4 + 2 }} />
          </button>
        ))}
      </div>
      <span className="trenner" aria-hidden="true" />
      <div className="kapsel-gruppe" role="group" aria-label="Bearbeiten">
        <button type="button" className="leisten-knopf" disabled={!p.kannEinfuegen} aria-label="Einfügen" title="Kopiertes einfügen – auch aus einer anderen Tafel (Strg + V)" onClick={p.beiEinfuegen}>
          <Symbol name="einfuegen" />
        </button>
        <button
          type="button"
          className="leisten-knopf"
          disabled={p.gewaehlt === 0 && p.leer}
          aria-label={p.gewaehlt ? 'Auswahl löschen' : 'Seite leeren'}
          title={p.gewaehlt ? 'Auswahl löschen (Entf)' : 'Seite leeren (lässt sich rückgängig machen)'}
          onClick={p.gewaehlt ? p.beiLoeschen : p.beiLeeren}
        >
          <Symbol name="leeren" />
        </button>
      </div>
      {feld &&
        createPortal(
          <div ref={feldRef} className="aufklappfeld von-oben" role="dialog" aria-label="Mehr Farben und Stärken" style={{ left: feld.links, top: feld.oben }}>
            <MehrFeld {...p} />
          </div>,
          document.body,
        )}
    </div>
  )
}
