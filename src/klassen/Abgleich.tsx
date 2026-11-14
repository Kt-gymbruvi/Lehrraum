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
  const [fehler, setFehler] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  async function absenden(e: FormEvent) {
    e.preventDefault()
    setLaeuft(true)
    setFehler('')
    const f = await entsperre(pw)
    setLaeuft(false)
    if (f) setFehler(f)
    else setPw('')
  }
  return (
    <section className="abgleich-hinweis" aria-label="Klassen entsperren">
      <h2>Klassen und Namen entsperren</h2>
      <p>
        Klassen und Schülernamen werden verschlüsselt abgeglichen – mit dem <b>Passwort deines Notenbuchs</b>. Auf diesem Gerät fragt Lehrraum einmal danach; gespeichert wird nur ein daraus abgeleiteter
        Schlüssel, nie das Passwort.
      </p>
      {meldung && <p className="fehler">{meldung}</p>}
      <form className="anmeldung" onSubmit={absenden} noValidate>
        <label>
          Passwort des Notenbuchs
          <input type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <button type="submit" className="f-knopf haupt" disabled={laeuft || !pw}>
          {laeuft ? 'Wird geprüft …' : 'Entsperren'}
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
