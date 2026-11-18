// Anmeldung der Lehrkraft (dasselbe Konto wie bei Quizzo und Klassenfunk) – für den Abgleich der Klassen.
import { useState, type FormEvent } from 'react'
import { fehlerText, melde_an } from '../speicher/server.ts'
import './anmeldung.css'

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
