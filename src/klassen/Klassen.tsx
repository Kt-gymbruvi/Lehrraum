// „Meine Klassen“: Klassen anlegen, bearbeiten, kopieren, archivieren, löschen – und die Tafel einer Klasse öffnen.
// Alles liegt nur auf diesem Gerät. Schülerlisten kommen als eigene Etappe dazu.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { geaendert, GRENZEN, klassenName, kopierteKlasse, MAX_KLASSEN, neueKlasse, pruefeEingabe, sortiert, type Klasse, type KlassenEingabe } from '../kern/klassen.ts'
import { ladeKlassen, loescheKlasse, speichereKlasse } from '../speicher/datenbank.ts'
import { Symbol } from '../ui/Symbol.tsx'
import './klassen.css'

const LEER: KlassenEingabe = { bezeichnung: '', fach: '', jahrgang: '' }

export default function Klassen() {
  const [klassen, setKlassen] = useState<Klasse[] | null>(null)
  const [fehler, setFehler] = useState('')
  /** null = Formular zu; 'neu' = neue Klasse; sonst die Kennung der Klasse, die bearbeitet wird */
  const [offen, setOffen] = useState<string | null>(null)
  const [eingabe, setEingabe] = useState<KlassenEingabe>(LEER)
  const [eingabeFehler, setEingabeFehler] = useState<string[]>([])
  const [loeschFrage, setLoeschFrage] = useState<string | null>(null)
  const [suche, setSuche] = useSearchParams()
  const erstesFeld = useRef<HTMLInputElement>(null)

  const laden = () =>
    ladeKlassen().then(
      (k) => setKlassen(sortiert(k)),
      () => setFehler('Der Speicher dieses Geräts lässt sich nicht lesen.'),
    )
  useEffect(() => {
    void laden()
  }, [])

  // …/#/klassen?neu=1 (z. B. von der Startseite) öffnet gleich das Formular
  useEffect(() => {
    if (suche.get('neu') && klassen) {
      oeffne('neu', LEER)
      setSuche({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klassen])

  useEffect(() => {
    if (offen) erstesFeld.current?.focus()
  }, [offen])

  function oeffne(was: string, werte: KlassenEingabe) {
    setOffen(was)
    setEingabe(werte)
    setEingabeFehler([])
    setLoeschFrage(null)
  }

  /** Führt eine Änderung aus und lädt die Liste neu; Fehler erscheinen oben. */
  async function tue(aenderung: () => Promise<void>) {
    setFehler('')
    try {
      await aenderung()
    } catch {
      setFehler('Das Speichern hat nicht geklappt.')
    }
    await laden()
  }

  function absenden(e: FormEvent) {
    e.preventDefault()
    const probleme = pruefeEingabe(eingabe)
    if (offen === 'neu' && (klassen?.length ?? 0) >= MAX_KLASSEN) probleme.push(`Mehr als ${MAX_KLASSEN} Klassen gehen nicht – bitte alte löschen.`)
    setEingabeFehler(probleme)
    if (probleme.length) return
    const alt = klassen?.find((k) => k.id === offen)
    void tue(() => speichereKlasse(alt ? geaendert(alt, eingabe) : neueKlasse(eingabe)))
    setOffen(null)
  }

  const aktiv = (klassen ?? []).filter((k) => !k.archiviert)
  const archiv = (klassen ?? []).filter((k) => k.archiviert)

  const formular = (
    <form className="klassen-formular" onSubmit={absenden} noValidate aria-label={offen === 'neu' ? 'Neue Klasse' : 'Klasse bearbeiten'}>
      <label>
        Bezeichnung
        <input ref={erstesFeld} value={eingabe.bezeichnung} maxLength={GRENZEN.bezeichnung} placeholder="7b" onChange={(e) => setEingabe({ ...eingabe, bezeichnung: e.target.value })} />
      </label>
      <label>
        Fach
        <input value={eingabe.fach} maxLength={GRENZEN.fach} placeholder="Biologie" list="faecher" onChange={(e) => setEingabe({ ...eingabe, fach: e.target.value })} />
      </label>
      <label>
        Jahrgang <small>(freiwillig)</small>
        <input value={eingabe.jahrgang} maxLength={GRENZEN.jahrgang} placeholder="7" onChange={(e) => setEingabe({ ...eingabe, jahrgang: e.target.value })} />
      </label>
      <datalist id="faecher">
        <option value="Biologie" />
        <option value="Sport" />
      </datalist>
      {eingabeFehler.map((f) => (
        <p className="fehler" role="alert" key={f}>
          {f}
        </p>
      ))}
      <div className="reihe">
        <button type="submit" className="f-knopf haupt">
          {offen === 'neu' ? 'Klasse anlegen' : 'Speichern'}
        </button>
        <button type="button" className="f-knopf" onClick={() => setOffen(null)}>
          Abbrechen
        </button>
      </div>
    </form>
  )

  const karte = (k: Klasse) => (
    <li key={k.id} className={'klassen-karte' + (k.archiviert ? ' archiviert' : '')}>
      {offen === k.id ? (
        formular
      ) : (
        <>
          <div className="klassen-kopf">
            <h3>{k.bezeichnung}</h3>
            <p>{[k.fach, k.jahrgang && 'Jahrgang ' + k.jahrgang].filter(Boolean).join(' · ') || 'ohne Fach'}</p>
          </div>
          {!k.archiviert && (
            <a className="f-knopf haupt breit" href={`#/tafel?klasse=${k.id}`} aria-label={`Zur Tafel von ${klassenName(k)}`}>
              <Symbol name="tafel" />
              Zur Tafel
            </a>
          )}
          {loeschFrage === k.id ? (
            <div className="reihe" role="group" aria-label="Löschen bestätigen">
              <span className="rueckfrage">Klasse und ihre Tafel endgültig löschen?</span>
              <button type="button" className="f-knopf gefahr" onClick={() => void tue(() => loescheKlasse(k))}>
                Ja, löschen
              </button>
              <button type="button" className="f-knopf" onClick={() => setLoeschFrage(null)}>
                Nein
              </button>
            </div>
          ) : (
            <div className="reihe klein" role="group" aria-label={`Aktionen für ${klassenName(k)}`}>
              <button type="button" className="f-knopf" onClick={() => oeffne(k.id, { bezeichnung: k.bezeichnung, fach: k.fach, jahrgang: k.jahrgang })}>
                Bearbeiten
              </button>
              <button type="button" className="f-knopf" disabled={(klassen?.length ?? 0) >= MAX_KLASSEN} onClick={() => void tue(() => speichereKlasse(kopierteKlasse(k)))}>
                Kopieren
              </button>
              <button type="button" className="f-knopf" onClick={() => void tue(() => speichereKlasse(geaendert(k, { archiviert: !k.archiviert })))}>
                {k.archiviert ? 'Wiederherstellen' : 'Archivieren'}
              </button>
              <button type="button" className="f-knopf" onClick={() => setLoeschFrage(k.id)}>
                Löschen
              </button>
            </div>
          )}
        </>
      )}
    </li>
  )

  return (
    <div className="klassen-seite">
      <header className="tafel-kopf">
        <a className="kopf-knopf" href="/" aria-label="Zur Startseite Lehrraum" title="Zur Startseite">
          <Symbol name="haus" />
        </a>
        <h1>Meine Klassen</h1>
        <span className="speicherstand">Nur auf diesem Gerät gespeichert</span>
        <a className="kopf-knopf breit" href="#/tafel">
          Freie Tafel
        </a>
      </header>
      <main>
        {fehler && (
          <p className="fehler" role="alert">
            {fehler}
          </p>
        )}
        {klassen === null && !fehler && <p className="hinweis">Klassen werden geladen …</p>}
        {klassen && (
          <>
            <ul className="klassen-liste">
              {aktiv.map(karte)}
              <li className="klassen-karte neu">
                {offen === 'neu' ? (
                  formular
                ) : (
                  <button type="button" className="neu-knopf" onClick={() => oeffne('neu', LEER)}>
                    <Symbol name="plus" />
                    Neue Klasse anlegen
                  </button>
                )}
              </li>
            </ul>
            {!aktiv.length && offen !== 'neu' && <p className="hinweis">Noch keine Klasse. Lege die erste an – jede Klasse bekommt ihre eigene Tafel.</p>}
            {archiv.length > 0 && (
              <section aria-labelledby="archiv-titel">
                <h2 id="archiv-titel">Archiv</h2>
                <ul className="klassen-liste">{archiv.map(karte)}</ul>
              </section>
            )}
            <p className="hinweis fuss">
              Klassen und ihre Tafeln liegen nur auf diesem Gerät. Auf einem anderen Gerät oder in einem anderen Browser siehst du sie nicht. Schülernamen werden hier noch nicht erfasst.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
