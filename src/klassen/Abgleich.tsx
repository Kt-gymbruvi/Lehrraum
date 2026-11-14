// Abgleich auf der Klassenseite: Stand in der Kopfzeile und – wenn nötig – Anmeldung oder Passwort.
import { useEffect, useState, type FormEvent } from 'react'
import { Anmeldung } from '../fenster/Anwendungen.tsx'
import { abgleichInfo, beiAbgleich, entsperre, gleicheAb, type AbgleichInfo } from '../speicher/abgleich.ts'

export function useAbgleich(): AbgleichInfo {
  const [info, setInfo] = useState(abgleichInfo)
  useEffect(() => beiAbgleich(setInfo), [])
  return info
}

const uhrzeit = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/** Kurzer Text für die Kopfzeile */
export function standText(i: AbgleichInfo): string {
  switch (i.stand) {
    case 'ohne-server':
    case 'abgemeldet':
    case 'gesperrt':
      return 'Nur auf diesem Gerät'
    case 'laeuft':
      return 'Wird abgeglichen …'
    case 'bereit':
      return 'Klassen synchronisiert' + (i.zuletzt ? ' · ' + uhrzeit(i.zuletzt) : '')
    case 'fehler':
      return 'Nicht abgeglichen'
  }
}

/** Hinweis mit Anmeldung bzw. Passwortfeld; nichts, wenn alles läuft */
export function AbgleichHinweis({ info }: { info: AbgleichInfo }) {
  const [anmelden, setAnmelden] = useState(false)
  if (info.stand === 'abgemeldet')
    return (
      <section className="abgleich-hinweis" aria-label="Klassen auf allen Geräten">
        <h2>Klassen auf allen Geräten</h2>
        <p>Mit dem Lehrkraft-Konto angemeldet erscheinen deine Klassen auf jedem Gerät – und die Lerngruppen aus dem Notenbuch kommen automatisch dazu.</p>
        {anmelden ? (
          <Anmeldung />
        ) : (
          <button type="button" className="f-knopf haupt" onClick={() => setAnmelden(true)}>
            Anmelden
          </button>
        )}
      </section>
    )
  if (info.stand === 'gesperrt') return <Passwort meldung={info.meldung} />
  if (info.stand === 'fehler')
    return (
      <section className="abgleich-hinweis" aria-label="Abgleich">
        <p className="fehler" role="alert">
          {info.meldung || 'Der Abgleich hat nicht geklappt.'}
        </p>
        <button type="button" className="f-knopf" onClick={() => void gleicheAb()}>
          Erneut versuchen
        </button>
      </section>
    )
  return null
}

function Passwort({ meldung }: { meldung: string }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [neu, setNeu] = useState(false) // noch kein Notenbuch: Passwort hier festlegen
  const [fehler, setFehler] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  async function absenden(e: FormEvent) {
    e.preventDefault()
    if (neu && pw !== pw2) return setFehler('Die Passwörter stimmen nicht überein.')
    setLaeuft(true)
    setFehler('')
    const f = await entsperre(pw, { neu })
    setLaeuft(false)
    if (f === 'neu') setNeu(true)
    else if (f) setFehler(f)
    else {
      setPw('')
      setPw2('')
    }
  }
  return (
    <section className="abgleich-hinweis" aria-label="Klassen entsperren">
      <h2>{neu ? 'Passwort festlegen' : 'Klassen und Namen entsperren'}</h2>
      {neu ? (
        <p>
          Es gibt noch kein Notenbuch. Lege hier das Passwort fest, mit dem Klassen und Namen verschlüsselt werden – das Notenbuch übernimmt es später. Es gibt keine Passwort-Zurücksetzung.
        </p>
      ) : (
        <p>
          Klassen und Schülernamen werden verschlüsselt abgeglichen – mit dem <b>Passwort deines Notenbuchs</b>. Einmal je Gerät eingegeben, öffnen sich danach auch Notenbuch und Startseite ohne
          Rückfrage. Gespeichert wird nur ein nicht auslesbarer Schlüssel, nie das Passwort; Abmelden löscht ihn.
        </p>
      )}
      {meldung && <p className="fehler">{meldung}</p>}
      <form className="anmeldung" onSubmit={absenden} noValidate>
        <label>
          {neu ? 'Neues Passwort (mind. 8 Zeichen)' : 'Passwort des Notenbuchs'}
          <input type="password" autoComplete={neu ? 'new-password' : 'off'} value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {neu && (
          <label>
            Passwort wiederholen
            <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </label>
        )}
        <button type="submit" className="f-knopf haupt" disabled={laeuft || !pw || (neu && !pw2)}>
          {laeuft ? 'Wird geprüft …' : neu ? 'Passwort festlegen' : 'Entsperren'}
        </button>
        {fehler && (
          <p className="fehler" role="alert">
            {fehler}
          </p>
        )}
      </form>
    </section>
  )
}
