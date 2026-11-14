// „Meine Klassen“: Klassen anlegen, bearbeiten, kopieren, archivieren, löschen – und die Tafel einer Klasse öffnen.
// Dazu die Namen der Schülerinnen und Schüler (nur Vor- und Nachname). Klassen aus dem Notenbuch kommen von selbst;
// ihre Bezeichnung, ihr Fach und ihre Namen pflegt das Notenbuch. Mit Anmeldung und Notenbuch-Passwort werden die
// Klassen verschlüsselt zwischen den Geräten abgeglichen (speicher/abgleich.ts), sonst bleiben sie auf diesem Gerät.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FORMAT_NAME } from '../kern/blatt.ts'
import {
  geaendert,
  GRENZEN,
  klassenName,
  kopierteKlasse,
  MAX_KLASSEN,
  MAX_SCHUELER,
  namenAlsText,
  namenAusText,
  namenSortiert,
  neueKlasse,
  pruefeEingabe,
  sortiert,
  vorlageAus,
  type Klasse,
  type KlassenEingabe,
  type Vorlage,
} from '../kern/klassen.ts'
import { FORMATE, istFormat, MUSTERARTEN, STANDARD_FORMAT, type Format, type Musterart } from '../kern/modell.ts'
import { MUSTER, MUSTERGRUPPEN } from '../kern/muster.ts'
import { gleicheAb, merkeGeloescht, vergissSchluessel } from '../speicher/abgleich.ts'
import { ladeKlassen, loescheKlasse, speichereKlasse } from '../speicher/datenbank.ts'
import { beiAnmeldung } from '../speicher/server.ts'
import { Symbol } from '../ui/Symbol.tsx'
import { AbgleichHinweis, standText, useAbgleich } from './Abgleich.tsx'
import './klassen.css'

const LEER: KlassenEingabe = { bezeichnung: '', fach: '', jahrgang: '' }

/** Vorlage im Formular: Format der Tafel und Art des Musters ('' = leer); Abstand und Farbe bleiben, wie sie waren */
type VorlageEingabe = { format: Format; art: Musterart | '' }
const vorlageEingabe = (v?: Vorlage): VorlageEingabe => ({ format: v?.format ?? STANDARD_FORMAT, art: v?.muster?.art ?? '' })
function vorlageVon(e: VorlageEingabe, alt?: Vorlage): Vorlage | undefined {
  if (!e.art || (MUSTER[e.art].nurBlatt && e.format === 'unendlich')) return vorlageAus(e.format)
  return vorlageAus(e.format, { ...alt?.muster, art: e.art })
}
/** Kurzbeschreibung der Vorlage auf der Karte (leer: Standard) */
const vorlageText = (v?: Vorlage) => (v ? [FORMAT_NAME[v.format], v.muster && MUSTER[v.muster.art].name].filter(Boolean).join(' · ') : '')

export default function Klassen() {
  const [klassen, setKlassen] = useState<Klasse[] | null>(null)
  const [fehler, setFehler] = useState('')
  /** null = Formular zu; 'neu' = neue Klasse; sonst die Kennung der Klasse, die bearbeitet wird */
  const [offen, setOffen] = useState<string | null>(null)
  const [eingabe, setEingabe] = useState<KlassenEingabe>(LEER)
  const [vorlage, setVorlage] = useState<VorlageEingabe>(vorlageEingabe())
  const [eingabeFehler, setEingabeFehler] = useState<string[]>([])
  const [loeschFrage, setLoeschFrage] = useState<string | null>(null)
  /** Klasse, deren Namen gerade bearbeitet werden, und der Text im Eingabefeld */
  const [namenOffen, setNamenOffen] = useState<string | null>(null)
  const [namenText, setNamenText] = useState('')
  const [suche, setSuche] = useSearchParams()
  const erstesFeld = useRef<HTMLInputElement>(null)
  const abgleich = useAbgleich()

  const laden = () =>
    ladeKlassen().then(
      (k) => setKlassen(sortiert(k)),
      () => setFehler('Der Speicher dieses Geräts lässt sich nicht lesen.'),
    )
  useEffect(() => {
    void laden()
    void gleicheAb()
    // Änderungen anderer Geräte und des Notenbuchs: jede Minute und beim Zurückkehren zur Seite
    const uhr = window.setInterval(() => void gleicheAb(), 60_000)
    const sichtbar = () => document.visibilityState === 'visible' && void gleicheAb()
    document.addEventListener('visibilitychange', sichtbar)
    const abbestellen = beiAnmeldung(() => void gleicheAb())
    return () => {
      window.clearInterval(uhr)
      document.removeEventListener('visibilitychange', sichtbar)
      abbestellen()
    }
  }, [])
  // Nach jedem Abgleich die Liste neu lesen
  useEffect(() => {
    if (abgleich.stand === 'bereit') void laden()
  }, [abgleich])

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

  function oeffne(was: string, werte: KlassenEingabe, v?: Vorlage) {
    setOffen(was)
    setEingabe(werte)
    setVorlage(vorlageEingabe(v))
    setEingabeFehler([])
    setLoeschFrage(null)
    setNamenOffen(null)
  }

  /** Führt eine Änderung aus, lädt die Liste neu und gleicht ab; Fehler erscheinen oben. */
  async function tue(aenderung: () => Promise<void>) {
    setFehler('')
    try {
      await aenderung()
    } catch {
      setFehler('Das Speichern hat nicht geklappt.')
    }
    await laden()
    void gleicheAb()
  }

  function oeffneNamen(k: Klasse) {
    setOffen(null)
    setLoeschFrage(null)
    setNamenOffen(k.id)
    setNamenText(namenAlsText(k.schueler))
  }
  const erkannt = namenAusText(namenText)

  function absenden(e: FormEvent) {
    e.preventDefault()
    const probleme = pruefeEingabe(eingabe)
    if (offen === 'neu' && (klassen?.length ?? 0) >= MAX_KLASSEN) probleme.push(`Mehr als ${MAX_KLASSEN} Klassen gehen nicht – bitte alte löschen.`)
    setEingabeFehler(probleme)
    if (probleme.length) return
    const alt = klassen?.find((k) => k.id === offen)
    const v = vorlageVon(vorlage, alt?.vorlage)
    void tue(() => speichereKlasse(alt ? geaendert(alt, { ...eingabe, vorlage: v }) : { ...neueKlasse(eingabe), ...(v ? { vorlage: v } : {}) }))
    setOffen(null)
  }

  const aktiv = (klassen ?? []).filter((k) => !k.archiviert)
  const archiv = (klassen ?? []).filter((k) => k.archiviert)
  const ausNotenbuch = !!klassen?.find((k) => k.id === offen)?.herkunft

  const formular = (
    <form className="klassen-formular" onSubmit={absenden} noValidate aria-label={offen === 'neu' ? 'Neue Klasse' : 'Klasse bearbeiten'}>
      <label>
        Bezeichnung
        <input ref={erstesFeld} value={eingabe.bezeichnung} readOnly={ausNotenbuch} maxLength={GRENZEN.bezeichnung} placeholder="7b" onChange={(e) => setEingabe({ ...eingabe, bezeichnung: e.target.value })} />
      </label>
      <label>
        Fach
        <input value={eingabe.fach} readOnly={ausNotenbuch} maxLength={GRENZEN.fach} placeholder="Biologie" list="faecher" onChange={(e) => setEingabe({ ...eingabe, fach: e.target.value })} />
      </label>
      {ausNotenbuch && <small>Bezeichnung und Fach kommen aus dem Notenbuch und werden dort geändert.</small>}
      <label>
        Jahrgang <small>(freiwillig)</small>
        <input value={eingabe.jahrgang} maxLength={GRENZEN.jahrgang} placeholder="7" onChange={(e) => setEingabe({ ...eingabe, jahrgang: e.target.value })} />
      </label>
      <fieldset className="vorlage">
        <legend>Vorlage für die Tafel</legend>
        <label>
          Format
          <select value={vorlage.format} onChange={(e) => istFormat(e.target.value) && setVorlage({ ...vorlage, format: e.target.value })}>
            {FORMATE.map((f) => (
              <option key={f} value={f}>
                {FORMAT_NAME[f]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hintergrund neuer Seiten
          <select value={vorlage.art} onChange={(e) => setVorlage({ ...vorlage, art: (MUSTERARTEN as readonly string[]).includes(e.target.value) ? (e.target.value as Musterart) : '' })}>
            <option value="">Leer</option>
            {MUSTERGRUPPEN.map((g) => (
              <optgroup key={g} label={g}>
                {MUSTERARTEN.filter((a) => MUSTER[a].gruppe === g).map((a) => (
                  <option key={a} value={a} disabled={!!MUSTER[a].nurBlatt && vorlage.format === 'unendlich'}>
                    {MUSTER[a].name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <small>Das Format gilt, wenn die Tafel der Klasse angelegt wird; der Hintergrund für jede neue Seite.</small>
      </fieldset>
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
            {k.herkunft && <p className="klassen-herkunft">aus dem Notenbuch</p>}
            {k.vorlage && <p className="klassen-vorlage">Vorlage: {vorlageText(k.vorlage)}</p>}
          </div>
          {namenOffen === k.id ? (
            <form
              className="klassen-formular"
              aria-label={`Namen von ${klassenName(k)}`}
              onSubmit={(e) => {
                e.preventDefault()
                void tue(() => speichereKlasse(geaendert(k, { schueler: namenAusText(namenText, k.schueler) })))
                setNamenOffen(null)
              }}
            >
              <label>
                Namen, eine Person je Zeile
                <textarea rows={10} value={namenText} placeholder={'Muster, Anna\nBeispiel, Ben'} onChange={(e) => setNamenText(e.target.value)} />
              </label>
              <small>
                „Nachname, Vorname“ oder „Vorname Nachname“ – auch aus einer Tabelle kopiert. {erkannt.length} {erkannt.length === 1 ? 'Name' : 'Namen'} erkannt
                {erkannt.length >= MAX_SCHUELER ? ` (höchstens ${MAX_SCHUELER})` : ''}.
              </small>
              <div className="reihe">
                <button type="submit" className="f-knopf haupt">
                  Namen speichern
                </button>
                <button type="button" className="f-knopf" onClick={() => setNamenOffen(null)}>
                  Abbrechen
                </button>
              </div>
            </form>
          ) : k.schueler.length ? (
            <details className="klassen-namen">
              <summary>
                {k.schueler.length} {k.schueler.length === 1 ? 'Name' : 'Namen'}
              </summary>
              <ol>
                {namenSortiert(k.schueler).map((s) => (
                  <li key={s.id}>{[s.vorname, s.nachname].filter(Boolean).join(' ')}</li>
                ))}
              </ol>
            </details>
          ) : (
            <p className="klassen-namen leer">{k.herkunft ? 'Im Notenbuch noch ohne Namen' : 'Noch keine Namen'}</p>
          )}
          {!k.archiviert && (
            <a className="f-knopf haupt breit" href={`#/tafel?klasse=${k.id}`} aria-label={`Zur Tafel von ${klassenName(k)}`}>
              <Symbol name="tafel" />
              Zur Tafel
            </a>
          )}
          {loeschFrage === k.id ? (
            <div className="reihe" role="group" aria-label="Löschen bestätigen">
              <span className="rueckfrage">Klasse und ihre Tafel endgültig löschen?</span>
              <button
                type="button"
                className="f-knopf gefahr"
                onClick={() =>
                  void tue(async () => {
                    await merkeGeloescht(k.id)
                    await loescheKlasse(k)
                  })
                }
              >
                Ja, löschen
              </button>
              <button type="button" className="f-knopf" onClick={() => setLoeschFrage(null)}>
                Nein
              </button>
            </div>
          ) : (
            <div className="reihe klein" role="group" aria-label={`Aktionen für ${klassenName(k)}`}>
              <button type="button" className="f-knopf" onClick={() => oeffne(k.id, { bezeichnung: k.bezeichnung, fach: k.fach, jahrgang: k.jahrgang }, k.vorlage)}>
                Bearbeiten
              </button>
              {!k.herkunft && (
                <button type="button" className="f-knopf" onClick={() => oeffneNamen(k)}>
                  Namen
                </button>
              )}
              <button type="button" className="f-knopf" disabled={(klassen?.length ?? 0) >= MAX_KLASSEN} onClick={() => void tue(() => speichereKlasse(kopierteKlasse(k)))}>
                Kopieren
              </button>
              {/* Klassen aus dem Notenbuch werden dort archiviert; gelöscht werden sie hier erst danach */}
              {!k.herkunft && (
                <button type="button" className="f-knopf" onClick={() => void tue(() => speichereKlasse(geaendert(k, { archiviert: !k.archiviert })))}>
                  {k.archiviert ? 'Wiederherstellen' : 'Archivieren'}
                </button>
              )}
              {(!k.herkunft || k.archiviert) && (
                <button type="button" className="f-knopf" onClick={() => setLoeschFrage(k.id)}>
                  Löschen
                </button>
              )}
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
        <span className={'speicherstand' + (abgleich.stand === 'fehler' ? ' fehler' : '')} role="status">
          {standText(abgleich)}
        </span>
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
        <AbgleichHinweis info={abgleich} />
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
            {abgleich.stand === 'bereit' ? (
              <p className="hinweis fuss">
                Klassen und Namen werden verschlüsselt mit deinen anderen Geräten abgeglichen{abgleich.notenbuch ? ', die Lerngruppen des Notenbuchs kommen automatisch dazu' : ''}. Die Tafeln bleiben auf
                dem Gerät, auf dem sie entstanden sind. Noten gibt es hier nicht – nur Namen.{' '}
                <button type="button" className="text-knopf" onClick={() => void vergissSchluessel()}>
                  Passwort auf diesem Gerät vergessen
                </button>
              </p>
            ) : (
              <p className="hinweis fuss">Klassen, Namen und Tafeln liegen nur auf diesem Gerät. Auf einem anderen Gerät oder in einem anderen Browser siehst du sie erst mit Anmeldung und Notenbuch-Passwort.</p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
