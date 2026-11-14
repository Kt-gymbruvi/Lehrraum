// Fenster, die eine andere Anwendung der Plattform in die Tafel holen: Quizzo, Klassenfunk, Lernangebote.
// Quizzo und Klassenfunk werden unverändert eingebettet (gleiche Adresse, gleiche Anmeldung); Lehrraum
// startet nur das Spiel bzw. die Sitzung über die vorhandenen Datenbankfunktionen.
import QRCode from 'qrcode'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { klassenfunkSitzung, ladeLernangebote, lernangebot, quizzoSpiel, type Lernliste } from '../speicher/plattform.ts'
import { beendeSitzung, beendeSpiel, beiAnmeldung, fehlerText, istAngemeldet, ladePraesentationen, ladeQuizze, melde_an, serverVorhanden, starteSitzung, starteSpiel, type Spielmodus } from '../speicher/server.ts'
import { Symbol } from '../ui/Symbol.tsx'
import './anwendungen.css'

type ZielProps = { ziel: string | undefined; beiZiel: (ziel: string | undefined) => void }

const klein = (s: string) => s.toLocaleLowerCase('de')

// ---------- Anmeldung der Lehrkraft ----------
function useAngemeldet(): boolean | null {
  const [an, setAn] = useState<boolean | null>(null)
  useEffect(() => {
    let aktiv = true
    istAngemeldet().then((a) => aktiv && setAn(a), () => aktiv && setAn(false))
    const abbestellen = beiAnmeldung((a) => aktiv && setAn(a))
    return () => {
      aktiv = false
      abbestellen()
    }
  }, [])
  return an
}

export function Anmeldung() {
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  async function absenden(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !passwort) return setFehler('Bitte E-Mail-Adresse und Passwort eingeben.')
    setLaeuft(true)
    setFehler('')
    try {
      await melde_an(email.trim(), passwort)
    } catch (err) {
      setFehler(fehlerText(err))
    } finally {
      setLaeuft(false)
    }
  }
  return (
    <form className="anmeldung" onSubmit={absenden} noValidate>
      <p className="hinweis">Anmeldung für Lehrkräfte – dasselbe Konto wie bei Quizzo.</p>
      <label>
        E-Mail
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Passwort
        <input type="password" autoComplete="current-password" value={passwort} onChange={(e) => setPasswort(e.target.value)} />
      </label>
      <button type="submit" className="f-knopf haupt" disabled={laeuft}>
        Anmelden
      </button>
      {fehler && (
        <p className="fehler" role="alert">
          {fehler}
        </p>
      )}
    </form>
  )
}

/** Zeigt den Inhalt nur angemeldeten Lehrkräften, sonst die Anmeldung. */
function NurAngemeldet({ children }: { children: ReactNode }) {
  const an = useAngemeldet()
  if (!serverVorhanden()) return <p className="hinweis">Der Server ist in dieser Umgebung nicht eingerichtet.</p>
  if (an === null) return <p className="hinweis">Einen Moment …</p>
  return an ? <>{children}</> : <Anmeldung />
}

// ---------- Gemeinsame Bausteine ----------
/** Lädt eine Liste beim Öffnen; liefert Liste, Fehlertext und „noch am Laden“. */
function useListe<T>(laden: () => Promise<T>): { daten: T | null; fehler: string } {
  const [zustand, setZustand] = useState<{ daten: T | null; fehler: string }>({ daten: null, fehler: '' })
  useEffect(() => {
    let aktiv = true
    laden().then(
      (daten) => aktiv && setZustand({ daten, fehler: '' }),
      (e) => aktiv && setZustand({ daten: null, fehler: fehlerText(e) }),
    )
    return () => {
      aktiv = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return zustand
}

/** Die eingebettete Anwendung mit einer Zeile zum Beenden darüber. */
function Laufend({ titel, adresse, beendenText, beiBeenden }: { titel: string; adresse: string; beendenText: string; beiBeenden: () => Promise<void> }) {
  const [frage, setFrage] = useState(false)
  const [fehler, setFehler] = useState('')
  return (
    <div className="laufend">
      <div className="reihe links">
        {frage ? (
          <>
            <span className="hinweis">{beendenText}</span>
            <button type="button" className="f-knopf haupt" onClick={() => beiBeenden().catch((e) => setFehler(fehlerText(e)))}>
              Ja, beenden
            </button>
            <button type="button" className="f-knopf" onClick={() => setFrage(false)}>
              Nein
            </button>
          </>
        ) : (
          <button type="button" className="f-knopf" onClick={() => setFrage(true)}>
            Beenden
          </button>
        )}
        {fehler && (
          <span className="fehler" role="alert">
            {fehler}
          </span>
        )}
      </div>
      <iframe title={titel} src={adresse} allow="fullscreen; autoplay" />
    </div>
  )
}

function Auswahlliste<T extends { id: string; titel: string; anzahl: number }>({
  eintraege,
  leer,
  einheit,
  suchName,
  zusatz,
  beiWahl,
}: {
  eintraege: T[]
  leer: string
  einheit: [string, string]
  suchName: string
  zusatz?: (e: T) => string | null
  beiWahl: (e: T) => Promise<void>
}) {
  const [suche, setSuche] = useState('')
  const [fehler, setFehler] = useState('')
  const [startet, setStartet] = useState<string | null>(null)
  if (!eintraege.length) return <p className="hinweis">{leer}</p>
  const treffer = eintraege.filter((e) => klein(e.titel + ' ' + (zusatz?.(e) ?? '')).includes(klein(suche.trim())))
  return (
    <>
      <input className="suche" type="search" placeholder="Suchen …" aria-label={suchName} value={suche} onChange={(e) => setSuche(e.target.value)} />
      {fehler && (
        <p className="fehler" role="alert">
          {fehler}
        </p>
      )}
      <ul className="auswahl">
        {treffer.map((e) => (
          <li key={e.id}>
            <span className="eintrag">
              <b>{e.titel}</b>
              <small>{[zusatz?.(e), `${e.anzahl} ${e.anzahl === 1 ? einheit[0] : einheit[1]}`].filter(Boolean).join(' · ')}</small>
            </span>
            <button
              type="button"
              className="f-knopf haupt"
              disabled={startet !== null || e.anzahl === 0}
              aria-label={`${e.titel} starten`}
              onClick={() => {
                setStartet(e.id)
                setFehler('')
                beiWahl(e)
                  .catch((err) => setFehler(fehlerText(err)))
                  .finally(() => setStartet(null))
              }}
            >
              <Symbol name="start" />
              Starten
            </button>
          </li>
        ))}
        {!treffer.length && <li className="hinweis">Nichts gefunden.</li>}
      </ul>
    </>
  )
}

// ---------- Quizzo ----------
function QuizAuswahl({ beiZiel }: Pick<ZielProps, 'beiZiel'>) {
  const { daten, fehler } = useListe(ladeQuizze)
  const [modus, setModus] = useState<Spielmodus>('klassisch')
  const [teams, setTeams] = useState(2)
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>
  if (!daten) return <p className="hinweis">Quizze werden geladen …</p>
  return (
    <>
      <div className="reihe links" role="group" aria-label="Spielmodus">
        <button type="button" className="f-knopf" aria-pressed={modus === 'klassisch'} onClick={() => setModus('klassisch')}>
          Einzeln
        </button>
        <button type="button" className="f-knopf" aria-pressed={modus === 'team'} onClick={() => setModus('team')}>
          Teams
        </button>
        {modus === 'team' && (
          <label className="teams">
            Anzahl
            <select value={teams} onChange={(e) => setTeams(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <Auswahlliste
        eintraege={daten}
        leer="Du hast noch keine Quizze. Lege sie in Quizzo an."
        einheit={['Frage', 'Fragen']}
        suchName="Quizze durchsuchen"
        zusatz={(q) => q.ordner}
        beiWahl={async (q) => beiZiel((await starteSpiel(q.id, modus, teams)).id)}
      />
    </>
  )
}

export function Quizzo({ ziel, beiZiel }: ZielProps) {
  return (
    <NurAngemeldet>
      {ziel ? (
        <Laufend titel="Quizzo – laufendes Spiel" adresse={quizzoSpiel(ziel)} beendenText="Spiel beenden? Alle Spieldaten werden gelöscht." beiBeenden={async () => { await beendeSpiel(ziel); beiZiel(undefined) }} />
      ) : (
        <QuizAuswahl beiZiel={beiZiel} />
      )}
    </NurAngemeldet>
  )
}

// ---------- Klassenfunk ----------
function PraesentationAuswahl({ beiZiel }: Pick<ZielProps, 'beiZiel'>) {
  const { daten, fehler } = useListe(ladePraesentationen)
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>
  if (!daten) return <p className="hinweis">Präsentationen werden geladen …</p>
  return (
    <Auswahlliste
      eintraege={daten}
      leer="Du hast noch keine Präsentationen. Lege sie in Klassenfunk an."
      einheit={['Folie', 'Folien']}
      suchName="Präsentationen durchsuchen"
      beiWahl={async (p) => beiZiel((await starteSitzung(p.id)).id)}
    />
  )
}

export function Klassenfunk({ ziel, beiZiel }: ZielProps) {
  return (
    <NurAngemeldet>
      {ziel ? (
        <Laufend titel="Klassenfunk – laufende Sitzung" adresse={klassenfunkSitzung(ziel)} beendenText="Sitzung beenden? Alle Antworten werden gelöscht." beiBeenden={async () => { await beendeSitzung(ziel); beiZiel(undefined) }} />
      ) : (
        <PraesentationAuswahl beiZiel={beiZiel} />
      )}
    </NurAngemeldet>
  )
}

// ---------- Lernangebote (ohne Anmeldung – sie sind öffentlich) ----------
function QrBild({ adresse }: { adresse: string }) {
  const [bild, setBild] = useState('')
  useEffect(() => {
    let aktiv = true
    QRCode.toString(adresse, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }).then(
      (svg) => aktiv && setBild('data:image/svg+xml;utf8,' + encodeURIComponent(svg)),
      () => aktiv && setBild(''),
    )
    return () => {
      aktiv = false
    }
  }, [adresse])
  return (
    <div className="qr">
      {bild && <img src={bild} alt="QR-Code zu diesem Lernangebot" />}
      <p>{adresse.replace(/^https?:\/\//, '')}</p>
    </div>
  )
}

function LernAuswahl({ liste, beiZiel }: { liste: Lernliste } & Pick<ZielProps, 'beiZiel'>) {
  const [fach, setFach] = useState('')
  const [stufe, setStufe] = useState('')
  const [suche, setSuche] = useState('')
  const s = klein(suche.trim())
  const treffer = liste.angebote.filter((a) => (!fach || a.fach === fach) && (!stufe || !a.stufen.length || a.stufen.includes(stufe)) && klein(a.titel + ' ' + a.text).includes(s))
  return (
    <>
      <div className="reihe links">
        <select aria-label="Fach" value={fach} onChange={(e) => setFach(e.target.value)}>
          <option value="">Alle Fächer</option>
          {liste.faecher.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select aria-label="Jahrgang" value={stufe} onChange={(e) => setStufe(e.target.value)}>
          <option value="">Alle Jahrgänge</option>
          {liste.stufen.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <input className="suche" type="search" placeholder="Suchen …" aria-label="Lernangebote durchsuchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
      </div>
      <ul className="auswahl">
        {treffer.map((a) => (
          <li key={a.ordner}>
            <span className="eintrag">
              <b>{a.titel}</b>
              <small>{a.text}</small>
            </span>
            <button type="button" className="f-knopf haupt" aria-label={`${a.titel} öffnen`} onClick={() => beiZiel(a.ordner)}>
              Öffnen
            </button>
          </li>
        ))}
        {!treffer.length && <li className="hinweis">Nichts gefunden.</li>}
      </ul>
    </>
  )
}

export function Lernangebote({ ziel, beiZiel }: ZielProps) {
  const { daten, fehler } = useListe(ladeLernangebote)
  const [qr, setQr] = useState(false)
  if (ziel) {
    const adresse = lernangebot(ziel)
    const titel = daten?.angebote.find((a) => a.ordner === ziel)?.titel ?? 'Lernangebot'
    return (
      <div className="laufend">
        <div className="reihe links">
          <button type="button" className="f-knopf" onClick={() => { setQr(false); beiZiel(undefined) }}>
            ← Auswahl
          </button>
          <button type="button" className="f-knopf" aria-pressed={qr} onClick={() => setQr(!qr)}>
            <Symbol name="qr" />
            QR-Code für die Klasse
          </button>
          <b className="laufend-titel">{titel}</b>
        </div>
        {qr ? <QrBild adresse={adresse} /> : <iframe title={titel} src={adresse} allow="fullscreen; autoplay" />}
      </div>
    )
  }
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>
  if (!daten) return <p className="hinweis">Lernangebote werden geladen …</p>
  return <LernAuswahl liste={daten} beiZiel={beiZiel} />
}
