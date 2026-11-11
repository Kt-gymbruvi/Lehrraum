// Die Tafel: Kopfzeile, linke Werkzeugleiste, Zeichenfläche mit Fenstern darüber, rechte Schnellzugriffsleiste,
// unten die Seiten. Speichert automatisch auf diesem Gerät und stellt beim Öffnen die zuletzt benutzte Tafel wieder her.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Fensterebene, Schnellleiste } from '../fenster/Fensterebene.tsx'
import { ausfuehren, entfernenBefehl, leererVerlauf, rueckgaengig, wiederholen, type Befehl, type Verlauf } from '../kern/befehle.ts'
import type { FensterZustand } from '../kern/fenster.ts'
import { zoomeUm } from '../kern/geometrie.ts'
import { FARBEN, STAERKEN, neuesTafelbild, schriftgroesse, type Element, type Kamera, type Seite, type Tafelbild } from '../kern/modell.ts'
import { gehe, kopie, seiteDazu, seiteDoppelt, seiteSchieben, seiteWeg, type Buch as Seitenfolge } from '../kern/seiten.ts'
import { bitteUmDauerhaftenSpeicher, ladeLetzteTafel, speichereTafel } from '../speicher/datenbank.ts'
import { Symbol } from '../ui/Symbol.tsx'
import { Seitenleiste } from './Seitenleiste.tsx'
import { WERKZEUGE, Werkzeugleiste } from './Werkzeugleiste.tsx'
import { Zeichenflaeche, type Werkzeug } from './Zeichenflaeche.tsx'

type Speicherstand = 'laedt' | 'gespeichert' | 'ungespeichert' | 'fehler'
const SPEICHERTEXT: Record<Speicherstand, string> = {
  laedt: 'Wird geladen …',
  gespeichert: 'Auf diesem Gerät gespeichert',
  ungespeichert: 'Wird gespeichert …',
  fehler: 'Speichern fehlgeschlagen',
}

/** So lange nach der letzten Änderung warten, bevor gespeichert wird */
const SPEICHERN_NACH_MS = 700

/** Seiten, gezeigte Seite und der Rückgängig-Verlauf je Seite (der Verlauf wird nicht gespeichert) */
type Buch = Seitenfolge & { verlaeufe: Record<string, Verlauf> }
const LEER: Seite = { id: '', elemente: [] }

export default function Tafel() {
  const [kopf, setKopf] = useState<Pick<Tafelbild, 'schema' | 'version' | 'id' | 'titel'> | null>(null)
  const [buch, setBuch] = useState<Buch>({ seiten: [LEER], nr: 0, verlaeufe: {} })
  const [kamera, setKamera] = useState<Kamera>({ x: 0, y: 0, zoom: 1 })
  const [fenster, setFenster] = useState<FensterZustand[]>([])
  const [werkzeug, setWerkzeug] = useState<Werkzeug>('stift')
  const [farbe, setFarbe] = useState<string>(FARBEN[0].wert)
  const [staerke, setStaerke] = useState<number>(STAERKEN[1].wert)
  const [auswahlRoh, setAuswahl] = useState<string[]>([])
  const [speicher, setSpeicher] = useState<Speicherstand>('laedt')

  const seite = buch.seiten[buch.nr] ?? LEER
  const verlauf = buch.verlaeufe[seite.id] ?? leererVerlauf()
  // Ausgewählt kann nur sein, was es auf der gezeigten Seite (noch) gibt
  const auswahl = auswahlRoh.filter((id) => seite.elemente.some((e) => e.id === id))
  const gewaehlte = seite.elemente.filter((e) => auswahl.includes(e.id))

  // ---------- Laden: zuletzt benutzte Tafel oder eine neue ----------
  useEffect(() => {
    let abgebrochen = false
    ladeLetzteTafel()
      .catch(() => null)
      .then((gefunden) => {
        if (abgebrochen) return
        const t = gefunden ?? neuesTafelbild()
        setKopf({ schema: t.schema, version: t.version, id: t.id, titel: t.titel })
        setBuch({ seiten: t.seiten, nr: t.seiteNr, verlaeufe: {} })
        setKamera(t.kamera)
        setFenster(t.fenster)
        setSpeicher('gespeichert')
      })
    return () => {
      abgebrochen = true
    }
  }, [])

  // ---------- Automatisch speichern ----------
  const aktuell = useRef<Tafelbild | null>(null)
  const offen = useRef(false) // gibt es Ungespeichertes?
  const geladen = useRef(false)

  const jetztSpeichern = useCallback(() => {
    const t = aktuell.current
    if (!t || !offen.current) return
    offen.current = false
    speichereTafel({ ...t, geaendertAm: new Date().toISOString() }).then(
      () => setSpeicher(offen.current ? 'ungespeichert' : 'gespeichert'),
      () => {
        offen.current = true
        setSpeicher('fehler')
      },
    )
  }, [])

  useEffect(() => {
    if (!kopf) return
    aktuell.current = { ...kopf, seiten: buch.seiten, seiteNr: buch.nr, kamera, fenster, geaendertAm: '' }
    if (!geladen.current) {
      geladen.current = true // der erste Durchlauf ist das Laden selbst, keine Änderung
      return
    }
    offen.current = true
    setSpeicher('ungespeichert')
    const warten = setTimeout(jetztSpeichern, SPEICHERN_NACH_MS)
    return () => clearTimeout(warten)
  }, [kopf, buch.seiten, buch.nr, kamera, fenster, jetztSpeichern])

  // Beim Verlassen oder Wegschalten sofort speichern (Schutz vor versehentlichem Schließen)
  useEffect(() => {
    const sichern = () => {
      if (document.visibilityState === 'hidden') jetztSpeichern()
    }
    document.addEventListener('visibilitychange', sichern)
    window.addEventListener('pagehide', jetztSpeichern)
    return () => {
      document.removeEventListener('visibilitychange', sichern)
      window.removeEventListener('pagehide', jetztSpeichern)
    }
  }, [jetztSpeichern])

  // ---------- Änderungen an der gezeigten Seite ----------
  /** Wendet eine Änderung (Elemente + Verlauf) auf die gezeigte Seite an. */
  const aendereSeite = useCallback((tun: (elemente: Element[], verlauf: Verlauf) => { elemente: Element[]; verlauf: Verlauf }) => {
    setBuch((alt) => {
      const s = alt.seiten[alt.nr]
      if (!s) return alt
      const neu = tun(s.elemente, alt.verlaeufe[s.id] ?? leererVerlauf())
      if (neu.elemente === s.elemente) return alt
      return { ...alt, seiten: alt.seiten.map((x) => (x === s ? { ...s, elemente: neu.elemente } : x)), verlaeufe: { ...alt.verlaeufe, [s.id]: neu.verlauf } }
    })
  }, [])
  const fuehreAus = useCallback((b: Befehl | null) => b && aendereSeite((e, v) => ausfuehren(e, v, b)), [aendereSeite])

  const dauerhaftGefragt = useRef(false)
  const beiHinzu = useCallback(
    (e: Element) => {
      fuehreAus({ art: 'hinzufuegen', elemente: [e] })
      if (!dauerhaftGefragt.current) {
        dauerhaftGefragt.current = true
        void bitteUmDauerhaftenSpeicher()
      }
    },
    [fuehreAus],
  )
  const entferne = useCallback(
    (ids: string[]) =>
      aendereSeite((e, v) => {
        const b = entfernenBefehl(e, ids)
        return b ? ausfuehren(e, v, b) : { elemente: e, verlauf: v }
      }),
    [aendereSeite],
  )
  const beiErsetzen = useCallback((vorher: Element[], nachher: Element[]) => fuehreAus({ art: 'ersetzen', vorher, nachher }), [fuehreAus])
  const zurueck = useCallback(() => aendereSeite(rueckgaengig), [aendereSeite])
  const vor = useCallback(() => aendereSeite(wiederholen), [aendereSeite])

  const loescheAuswahl = () => {
    entferne(auswahl)
    setAuswahl([])
  }
  const dopple = () => {
    if (!gewaehlte.length) return
    const kopien = gewaehlte.map((e) => kopie(e, 24, 24))
    fuehreAus({ art: 'hinzufuegen', elemente: kopien })
    setAuswahl(kopien.map((e) => e.id))
  }
  /** Farbe wählen: gilt für Neues – und färbt die Auswahl um */
  const waehleFarbe = (f: string) => {
    setFarbe(f)
    if (werkzeug === 'radierer') setWerkzeug('stift')
    const andere = gewaehlte.filter((e) => e.farbe !== f)
    if (andere.length) beiErsetzen(andere, andere.map((e) => ({ ...e, farbe: f })))
  }
  /** Stärke wählen: gilt für Neues – und ändert Strichbreite bzw. Schriftgröße der Auswahl */
  const waehleStaerke = (s: number) => {
    setStaerke(s)
    const neu = gewaehlte.map((e): Element => (e.art === 'text' ? { ...e, groesse: schriftgroesse(s) } : { ...e, staerke: s }))
    const geaendert = gewaehlte.filter((e, i) => JSON.stringify(e) !== JSON.stringify(neu[i]))
    if (geaendert.length) beiErsetzen(geaendert, neu.filter((_, i) => geaendert.includes(gewaehlte[i])))
  }
  const waehleWerkzeug = (w: Werkzeug) => {
    setWerkzeug(w)
    if (w !== 'auswahl') setAuswahl([])
  }

  // ---------- Seiten ----------
  const blaettern = (tun: (b: Seitenfolge) => Seitenfolge) => {
    setAuswahl([])
    setBuch((alt) => ({ ...alt, ...tun(alt) }))
  }

  // ---------- Tastatur ----------
  const tasten = useRef({ zurueck, vor, loescheAuswahl, dopple, waehleWerkzeug, auswahl })
  tasten.current = { zurueck, vor, loescheAuswahl, dopple, waehleWerkzeug, auswahl }
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null
      if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.tagName === 'SELECT' || ziel.isContentEditable)) return
      const t = tasten.current
      const k = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z' && !e.shiftKey) t.zurueck()
        else if (k === 'y' || (k === 'z' && e.shiftKey)) t.vor()
        else if (k === 'd' && t.auswahl.length) t.dopple()
        else return
        e.preventDefault()
        return
      }
      if (e.altKey) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && t.auswahl.length) {
        e.preventDefault()
        t.loescheAuswahl()
      } else if (e.key === 'PageDown') blaettern((b) => gehe(b, b.nr + 1))
      else if (e.key === 'PageUp') blaettern((b) => gehe(b, b.nr - 1))
      else {
        const w = WERKZEUGE.find((x) => x.taste.toLowerCase() === k) ?? (k === 'e' ? WERKZEUGE.find((x) => x.wert === 'radierer') : undefined)
        if (w) t.waehleWerkzeug(w.wert)
      }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [])

  const zoomen = (faktor: number) => setKamera((k) => zoomeUm(k, window.innerWidth / 2, window.innerHeight / 2, faktor))
  const ansichtZurueck = () => setKamera({ x: 0, y: 0, zoom: 1 })

  return (
    <div className="tafel">
      <header className="tafel-kopf">
        <a className="kopf-knopf" href="/" aria-label="Zur Startseite Lehrraum" title="Zur Startseite">
          <Symbol name="haus" />
        </a>
        <h1>{kopf?.titel ?? 'Tafel'}</h1>
        <p className={'speicherstand ' + speicher} role="status">
          {SPEICHERTEXT[speicher]}
        </p>
        <div className="zoom" role="group" aria-label="Ansicht">
          <button type="button" className="kopf-knopf" aria-label="Verkleinern" onClick={() => zoomen(1 / 1.25)}>
            −
          </button>
          <button type="button" className="kopf-knopf breit" aria-label="Ansicht zurücksetzen" title="Ansicht zurücksetzen" onClick={ansichtZurueck}>
            {Math.round(kamera.zoom * 100)} %
          </button>
          <button type="button" className="kopf-knopf" aria-label="Vergrößern" onClick={() => zoomen(1.25)}>
            +
          </button>
        </div>
      </header>
      <div className="tafel-mitte">
        <Werkzeugleiste
          werkzeug={werkzeug}
          farbe={farbe}
          staerke={staerke}
          kannZurueck={verlauf.zurueck.length > 0}
          kannVor={verlauf.vor.length > 0}
          leer={seite.elemente.length === 0}
          gewaehlt={auswahl.length}
          beiWerkzeug={waehleWerkzeug}
          beiFarbe={waehleFarbe}
          beiStaerke={waehleStaerke}
          beiZurueck={zurueck}
          beiVor={vor}
          beiLeeren={() => entferne(seite.elemente.map((e) => e.id))}
          beiDoppeln={dopple}
          beiLoeschen={loescheAuswahl}
        />
        <div className="tafel-spalte">
          <div className="tafel-flaeche">
            <Zeichenflaeche
              key={seite.id}
              elemente={seite.elemente}
              kamera={kamera}
              werkzeug={werkzeug}
              farbe={farbe}
              staerke={staerke}
              auswahl={auswahl}
              beiHinzu={beiHinzu}
              beiRadieren={entferne}
              beiErsetzen={beiErsetzen}
              beiAuswahl={setAuswahl}
              beiKamera={setKamera}
            />
            <Fensterebene fenster={fenster} beiAendern={setFenster} />
          </div>
          <Seitenleiste
            nr={buch.nr}
            anzahl={buch.seiten.length}
            beschrieben={seite.elemente.length > 0}
            beiGehe={(nr) => blaettern((b) => gehe(b, nr))}
            beiNeu={() => blaettern(seiteDazu)}
            beiDoppelt={() => blaettern(seiteDoppelt)}
            beiSchieben={(r) => blaettern((b) => seiteSchieben(b, r))}
            beiLoeschen={() => blaettern(seiteWeg)}
          />
        </div>
        <Schnellleiste fenster={fenster} beiAendern={setFenster} />
      </div>
    </div>
  )
}
