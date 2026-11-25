// Linke Werkzeugleiste der Tafel (eine Spalte, je Werkzeugfamilie ein Knopf) und die Kontext-Kapsel über der Tafel.
// Die Kapsel zeigt nur, was zum gewählten Werkzeug passt:
//   Auswahl: Rechteck oder Lasso; ist etwas ausgewählt, auch Farbe und Stärke (färbt um, ändert die Stärke).
//   Hand: nur ein Hinweis.          Stift, Textmarker: Farbe und Stärke.
//   Radierer: Element oder Schwamm, drei Größen.   Text, Tabelle: Farbe und Schriftgröße.
//   Formen: Füllung (Rechteck, Ellipse), Pfeilspitzen (Pfeil), Linienart, Farbe und Stärke.
//   Füllen: Farbe.                   Laserpointer: nur ein Hinweis.
// Dazu immer die Varianten der Familie (z. B. Stift | Textmarker). Einfügen und Seite leeren sind keine Einstellungen
// eines Werkzeugs: sie stehen in der Seitenleiste unten (auf der Schülerseite am Ende der Kapsel).
// „Mehr“ öffnet darunter weitere Farben, eigene Farbplätze und (wo Stärke passt) den Regler.
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
import { BUEHNEN_FAMILIEN, FAMILIEN, familieVon, kapselInhalt, merke, vertreter, type FamilienId, type Zuletzt } from '../kern/werkzeugfamilien.ts'
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

const AUSWAHL_WAHL: { wert: AuswahlArt; name: string; symbol: SymbolName; titel: string }[] = [
  { wert: 'rechteck', name: 'Rechteck-Auswahl', symbol: 'auswahl', titel: 'Rechteck aufziehen: alles, was es berührt, wird ausgewählt' },
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

/** Ein Segment in der Kapsel: mehrere Knöpfe, einer gedrückt */
function Segment({ name, kinder }: { name: string; kinder: React.ReactNode }) {
  return (
    <div className="varianten" role="group" aria-label={name}>
      {kinder}
    </div>
  )
}
function SegmentKnopf(p: { an: boolean; name: string; titel?: string; text?: string; beiKlick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="variante" aria-pressed={p.an} aria-label={p.name} title={p.titel ?? p.name} onClick={p.beiKlick}>
      {p.children}
      {p.text && <span>{p.text}</span>}
    </button>
  )
}
const Trenner = () => <span className="trenner" aria-hidden="true" />

/** Formen: Füllung (Rechteck, Ellipse), Spitzen (Pfeil), Linienart (alle) */
function FormWahl({ art, wahl, beiWahl }: { art: 'rechteck' | 'ellipse' | 'linie' | 'pfeil'; wahl: Formwahl; beiWahl: (w: Formwahl) => void }) {
  return (
    <>
      {(art === 'rechteck' || art === 'ellipse') && (
        <>
          <Segment
            name="Füllung"
            kinder={
              <SegmentKnopf an={wahl.gefuellt} name="Ausgefüllt" titel={wahl.gefuellt ? 'Ausgefüllt – antippen: nur der Umriss' : 'Nur der Umriss – antippen: innen mit der Farbe ausgefüllt'} beiKlick={() => beiWahl({ ...wahl, gefuellt: !wahl.gefuellt })}>
                <Symbol name={art} voll={wahl.gefuellt} />
              </SegmentKnopf>
            }
          />
          <Trenner />
        </>
      )}
      {art === 'pfeil' && (
        <>
          <Segment name="Pfeilspitzen" kinder={[false, true].map((b) => (
            <SegmentKnopf key={String(b)} an={wahl.beidseitig === b} name={b ? 'Beide Richtungen' : 'Eine Richtung'} titel={b ? 'Spitzen an beiden Enden' : 'Spitze am Ende'} beiKlick={() => beiWahl({ ...wahl, beidseitig: b })}>
              <Symbol name={b ? 'pfeilBeide' : 'pfeil'} />
            </SegmentKnopf>
          ))} />
          <Trenner />
        </>
      )}
      <Segment name="Linienart" kinder={LINIENARTEN.map((l) => (
        <SegmentKnopf key={l} an={wahl.linienart === l} name={LINIEN_NAME[l]} beiKlick={() => beiWahl({ ...wahl, linienart: l })}>
          <Symbol name={LINIEN_SYMBOL[l]} />
        </SegmentKnopf>
      ))} />
      <Trenner />
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

function MehrFeld(p: Props & { mitStaerke: boolean }) {
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
      {p.mitStaerke && (
      <>
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
      )}
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
 * zuletzt benutzt wurde; Varianten und Einstellungen stehen in der Kapsel über der Tafel.
 */
export function Werkzeugleiste(p: Props) {
  const zuletzt = useZuletzt(p.werkzeug)
  const auswahlName = AUSWAHL_WAHL.find((a) => a.wert === p.auswahlArt)?.name ?? ''
  const artName = RADIERER_ARTEN.find((a) => a.wert === p.radierer.art)?.name ?? ''

  const familienKnopf = (id: FamilienId) => {
    const fam = FAMILIEN.find((f) => f.id === id)!
    const wert = vertreter(fam, zuletzt)
    const w = WERKZEUGE.find((x) => x.wert === wert)!
    const symbol = w.wert === 'auswahl' && p.auswahlArt === 'lasso' ? 'lasso' : w.wert === 'radierer' && p.radierer.art === 'schwamm' ? 'schwamm' : w.symbol
    const f = p.formwahl
    const istFlaeche = w.wert === 'rechteck' || w.wert === 'ellipse'
    const zeichen: SymbolName = w.wert === 'linie' && f.linienart !== 'voll' ? LINIEN_SYMBOL[f.linienart] : w.wert === 'pfeil' && f.beidseitig ? 'pfeilBeide' : symbol
    const titel =
      w.wert === 'auswahl'
        ? `${w.name}: ${auswahlName} (${w.taste})`
        : w.wert === 'radierer'
          ? `${w.name}: ${artName} (${w.taste})`
          : istFlaeche || w.wert === 'linie' || w.wert === 'pfeil'
            ? `${w.name}${formBeschreibung(w.wert, f)} (${w.taste})`
            : w.wert === 'laser'
              ? `${w.name} (${w.taste}) – zeigen, die Spur verschwindet von selbst`
              : w.wert === 'fuellen'
                ? `${w.name} (${w.taste}) – Fläche antippen: mit der gewählten Farbe füllen (noch einmal: Füllung weg)`
                : w.wert === 'tabelle'
                  ? `${w.name} (${w.taste}) – antippen, Zeilen und Spalten wählen; Zellen antippen zum Schreiben`
                  : `${w.name} (${w.taste})`
    return (
      <button key={id} type="button" className="leisten-knopf" aria-pressed={p.werkzeug === w.wert} aria-label={w.name} title={titel} onClick={() => p.beiWerkzeug(w.wert)}>
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
 * Kapsel über der Tafel: Varianten der gewählten Werkzeugfamilie und die Einstellungen, die zum Werkzeug passen
 * (siehe oben). Einfügen und Seite leeren stehen bei der Lehrkraft in der Seitenleiste unten (`ohneBearbeiten`),
 * auf der Schülerseite (ohne Seitenleiste) am Ende der Kapsel.
 */
export function Kontextkapsel(p: Props & { ohneBearbeiten?: boolean }) {
  const mehrKnopf = useRef<HTMLButtonElement>(null)
  const { feld, setFeld, feldRef } = useFeld<'mehr'>()
  useSchliessenDraussen(!!feld, () => [feldRef.current, mehrKnopf.current], () => setFeld(null))
  const umschalten = () => {
    if (feld) return setFeld(null)
    const r = mehrKnopf.current?.getBoundingClientRect()
    setFeld({ art: 'mehr', links: Math.max(8, Math.min(r?.left ?? 8, window.innerWidth - 340)), oben: (r?.bottom ?? 64) + 8 })
  }
  const familie = familieVon(p.werkzeug)
  const inhalt = kapselInhalt(p.werkzeug, p.gewaehlt)
  const w = p.werkzeug
  const schrift = w === 'text' || w === 'tabelle'
  // Farbe oder Stärke außerhalb der Kapsel: der Knopf „Mehr“ zeigt sie als Punkt
  const besonders = !inLeiste(p.farbe) || (inhalt.staerke && !staerkeInLeiste(p.staerke))
  const mehrOffen = feld && inhalt.farben ? feld : null
  // Ohne „Bearbeiten“ am Ende steht nach der letzten Gruppe kein Trenner

  return (
    <div className="kontextkapsel" role="toolbar" aria-label="Einstellungen des Werkzeugs">
      {familie.glieder.length > 1 && (
        <>
          <div className="varianten" role="radiogroup" aria-label="Art des Werkzeugs">
            {familie.glieder.map((g) => {
              const x = WERKZEUGE.find((y) => y.wert === g)!
              return (
                <button key={g} type="button" role="radio" className="variante" aria-checked={w === g} aria-label={x.name} title={`${x.name} (${x.taste})`} onClick={() => p.beiWerkzeug(g)}>
                  <Symbol name={x.symbol} />
                  {familie.glieder.length <= 2 && <span>{x.name}</span>}
                </button>
              )
            })}
          </div>
          <Trenner />
        </>
      )}
      {w === 'auswahl' && (
        <>
          <Segment
            name="Art der Auswahl"
            kinder={AUSWAHL_WAHL.map((a) => (
              <SegmentKnopf key={a.wert} an={p.auswahlArt === a.wert} name={a.name} titel={a.titel} text={a.wert === 'lasso' ? 'Lasso' : 'Rechteck'} beiKlick={() => p.beiAuswahlArt(a.wert)}>
                <Symbol name={a.symbol} />
              </SegmentKnopf>
            ))}
          />
          <Trenner />
        </>
      )}
      {w === 'radierer' && (
        <>
          <Segment
            name="Art des Radierers"
            kinder={RADIERER_ARTEN.map((a) => (
              <SegmentKnopf key={a.wert} an={p.radierer.art === a.wert} name={a.wert === 'schwamm' ? 'Schwamm' : 'Element-Radierer'} titel={a.titel} text={a.name} beiKlick={() => p.beiRadierer({ ...p.radierer, art: a.wert })}>
                <Symbol name={a.wert === 'schwamm' ? 'schwamm' : 'radierer'} />
              </SegmentKnopf>
            ))}
          />
          <Trenner />
          <Segment
            name="Größe des Radierers"
            kinder={RADIERER_GROESSEN.map((g) => {
              const d = Math.min(26, RADIERER_RADIUS[g.wert] * 0.5 + 8)
              return (
                <SegmentKnopf key={g.wert} an={p.radierer.groesse === g.wert} name={'Radierer ' + g.name} titel={'Größe: ' + g.name} beiKlick={() => p.beiRadierer({ ...p.radierer, groesse: g.wert })}>
                  <span className="radierer-kreis" style={{ width: d, height: d }} />
                </SegmentKnopf>
              )
            })}
          />
          <Trenner />
        </>
      )}
      {(w === 'rechteck' || w === 'ellipse' || w === 'linie' || w === 'pfeil') && <FormWahl art={w} wahl={p.formwahl} beiWahl={p.beiFormwahl} />}
      {inhalt.farben && (
        <>
          <div className="kapsel-gruppe" role="group" aria-label="Farbe">
            {FARBEN.map((f) => (
              <button key={f.wert} type="button" className="farb-knopf" aria-pressed={p.farbe === f.wert} aria-label={f.name} title={f.name} onClick={() => p.beiFarbe(f.wert)}>
                <span style={{ background: f.wert, color: f.wert }} />
              </button>
            ))}
            <button
              ref={mehrKnopf}
              type="button"
              className="farb-knopf mehr"
              aria-pressed={besonders}
              aria-expanded={!!mehrOffen}
              aria-label={inhalt.staerke ? 'Mehr Farben und Stärken' : 'Mehr Farben'}
              title={inhalt.staerke ? 'Mehr Farben, eigene Farben und Stärke' : 'Mehr Farben und eigene Farben'}
              onClick={umschalten}
            >
              {besonders ? <span className="staerke-punkt" style={{ width: Math.max(8, Math.min(22, punktGroesse(p.staerke))), height: Math.max(8, Math.min(22, punktGroesse(p.staerke))), background: p.farbe }} /> : <Symbol name="palette" />}
            </button>
          </div>
          <Trenner />
        </>
      )}
      {inhalt.staerke && (
        <>
          <div className="kapsel-gruppe" role="group" aria-label={schrift ? 'Schriftgröße' : 'Strichstärke'}>
            {STAERKEN.map((s) => (
              <button key={s.wert} type="button" className="leisten-knopf schmal" aria-pressed={p.staerke === s.wert} aria-label={'Strichstärke ' + s.name} title={(schrift ? 'Schriftgröße: ' : 'Strichstärke: ') + s.name} onClick={() => p.beiStaerke(s.wert)}>
                <span className="staerke-punkt" style={{ width: s.wert * 1.4 + 2, height: s.wert * 1.4 + 2 }} />
              </button>
            ))}
          </div>
          <Trenner />
        </>
      )}
      {inhalt.hinweis && (
        <>
          <p className="kapsel-hinweis">{inhalt.hinweis}</p>
          <Trenner />
        </>
      )}
      {!p.ohneBearbeiten && <Bearbeiten {...p} knopf="leisten-knopf" />}
      {mehrOffen &&
        createPortal(
          <div ref={feldRef} className="aufklappfeld von-oben" role="dialog" aria-label={inhalt.staerke ? 'Mehr Farben und Stärken' : 'Mehr Farben'} style={{ left: mehrOffen.links, top: mehrOffen.oben }}>
            <MehrFeld {...p} mitStaerke={inhalt.staerke} />
          </div>,
          document.body,
        )}
    </div>
  )
}

/** Einfügen und Seite leeren (bzw. Auswahl löschen) – in der Seitenleiste unten oder am Ende der Kapsel */
export function Bearbeiten(p: Pick<Props, 'kannEinfuegen' | 'beiEinfuegen' | 'gewaehlt' | 'leer' | 'beiLoeschen' | 'beiLeeren'> & { knopf: string }) {
  return (
    <div className="kapsel-gruppe" role="group" aria-label="Bearbeiten">
      <button type="button" className={p.knopf} disabled={!p.kannEinfuegen} aria-label="Einfügen" title="Kopiertes einfügen – auch aus einer anderen Tafel (Strg + V)" onClick={p.beiEinfuegen}>
        <Symbol name="einfuegen" />
      </button>
      <button
        type="button"
        className={p.knopf}
        disabled={p.gewaehlt === 0 && p.leer}
        aria-label={p.gewaehlt ? 'Auswahl löschen' : 'Seite leeren'}
        title={p.gewaehlt ? 'Auswahl löschen (Entf)' : 'Seite leeren (lässt sich rückgängig machen)'}
        onClick={p.gewaehlt ? p.beiLoeschen : p.beiLeeren}
      >
        <Symbol name={p.gewaehlt ? 'leeren' : 'schwamm'} />
      </button>
    </div>
  )
}
