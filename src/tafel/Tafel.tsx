// Die Tafel: Kopfzeile, linke Werkzeugleiste, Zeichenfläche. Speichert automatisch auf diesem Gerät
// und stellt beim Öffnen die zuletzt benutzte Tafel wieder her.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ausfuehren, entfernenBefehl, leererVerlauf, rueckgaengig, wiederholen, type Befehl, type Verlauf } from '../kern/befehle.ts'
import { zoomeUm } from '../kern/geometrie.ts'
import { FARBEN, STAERKEN, neuesTafelbild, type Element, type Kamera, type Strich, type Tafelbild } from '../kern/modell.ts'
import { bitteUmDauerhaftenSpeicher, ladeLetzteTafel, speichereTafel } from '../speicher/datenbank.ts'
import { Symbol } from '../ui/Symbol.tsx'
import { Werkzeugleiste } from './Werkzeugleiste.tsx'
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

export default function Tafel() {
  const [kopf, setKopf] = useState<Pick<Tafelbild, 'schema' | 'version' | 'id' | 'titel'> | null>(null)
  const [inhalt, setInhalt] = useState<{ elemente: Element[]; verlauf: Verlauf }>({ elemente: [], verlauf: leererVerlauf() })
  const [kamera, setKamera] = useState<Kamera>({ x: 0, y: 0, zoom: 1 })
  const [werkzeug, setWerkzeug] = useState<Werkzeug>('stift')
  const [farbe, setFarbe] = useState<string>(FARBEN[0].wert)
  const [staerke, setStaerke] = useState<number>(STAERKEN[1].wert)
  const [speicher, setSpeicher] = useState<Speicherstand>('laedt')

  // ---------- Laden: zuletzt benutzte Tafel oder eine neue ----------
  useEffect(() => {
    let abgebrochen = false
    ladeLetzteTafel()
      .catch(() => null)
      .then((gefunden) => {
        if (abgebrochen) return
        const t = gefunden ?? neuesTafelbild()
        setKopf({ schema: t.schema, version: t.version, id: t.id, titel: t.titel })
        setInhalt({ elemente: t.elemente, verlauf: leererVerlauf() })
        setKamera(t.kamera)
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
    aktuell.current = { ...kopf, elemente: inhalt.elemente, kamera, geaendertAm: '' }
    if (!geladen.current) {
      geladen.current = true // der erste Durchlauf ist das Laden selbst, keine Änderung
      return
    }
    offen.current = true
    setSpeicher('ungespeichert')
    const warten = setTimeout(jetztSpeichern, SPEICHERN_NACH_MS)
    return () => clearTimeout(warten)
  }, [kopf, inhalt.elemente, kamera, jetztSpeichern])

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

  // ---------- Änderungen ----------
  const fuehreAus = useCallback((b: Befehl | null) => {
    if (b) setInhalt((alt) => ausfuehren(alt.elemente, alt.verlauf, b))
  }, [])
  const dauerhaftGefragt = useRef(false)
  const beiStrich = useCallback(
    (s: Strich) => {
      fuehreAus({ art: 'hinzufuegen', elemente: [s] })
      if (!dauerhaftGefragt.current) {
        dauerhaftGefragt.current = true
        void bitteUmDauerhaftenSpeicher()
      }
    },
    [fuehreAus],
  )
  const beiRadieren = useCallback((ids: string[]) => setInhalt((alt) => {
    const b = entfernenBefehl(alt.elemente, ids)
    return b ? ausfuehren(alt.elemente, alt.verlauf, b) : alt
  }), [])
  const zurueck = useCallback(() => setInhalt((alt) => rueckgaengig(alt.elemente, alt.verlauf)), [])
  const vor = useCallback(() => setInhalt((alt) => wiederholen(alt.elemente, alt.verlauf)), [])
  const leeren = useCallback(() => setInhalt((alt) => {
    const b = entfernenBefehl(alt.elemente, alt.elemente.map((e) => e.id))
    return b ? ausfuehren(alt.elemente, alt.verlauf, b) : alt
  }), [])

  // ---------- Tastatur ----------
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null
      if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z' && !e.shiftKey) zurueck()
        else if (k === 'y' || (k === 'z' && e.shiftKey)) vor()
        else return
        e.preventDefault()
        return
      }
      if (e.altKey) return
      if (k === 's') setWerkzeug('stift')
      else if (k === 'm') setWerkzeug('marker')
      else if (k === 'r' || k === 'e') setWerkzeug('radierer')
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [zurueck, vor])

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
          kannZurueck={inhalt.verlauf.zurueck.length > 0}
          kannVor={inhalt.verlauf.vor.length > 0}
          leer={inhalt.elemente.length === 0}
          beiWerkzeug={setWerkzeug}
          beiFarbe={(f) => {
            setFarbe(f)
            if (werkzeug === 'radierer') setWerkzeug('stift')
          }}
          beiStaerke={setStaerke}
          beiZurueck={zurueck}
          beiVor={vor}
          beiLeeren={leeren}
        />
        <Zeichenflaeche elemente={inhalt.elemente} kamera={kamera} werkzeug={werkzeug} farbe={farbe} staerke={staerke} beiStrich={beiStrich} beiRadieren={beiRadieren} beiKamera={setKamera} />
      </div>
    </div>
  )
}
