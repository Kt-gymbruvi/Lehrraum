// Inhalte der Fenster: Uhr, Timer, Stoppuhr, Würfel, Notiz. Alles läuft nur auf diesem Gerät.
import { useEffect, useRef, useState } from 'react'
import { MAX_NOTIZTEXT, NOTIZFARBEN, stoppText, wuerfle, zeitText, type FensterZustand, type NotizFarbe } from '../kern/fenster.ts'
import { Symbol } from '../ui/Symbol.tsx'

/** Ruft `tun` regelmäßig auf, solange `an` gilt. */
function useTakt(an: boolean, ms: number, tun: () => void) {
  const ref = useRef(tun)
  ref.current = tun
  useEffect(() => {
    if (!an) return
    const t = setInterval(() => ref.current(), ms)
    return () => clearInterval(t)
  }, [an, ms])
}

// ---------- Uhr ----------
export function Uhr() {
  const [jetzt, setJetzt] = useState(() => new Date())
  useTakt(true, 500, () => setJetzt(new Date()))
  return (
    <div className="uhr">
      <p className="grosse-zahl" role="timer" aria-label="Uhrzeit">
        {jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        <span className="sekunden">{String(jetzt.getSeconds()).padStart(2, '0')}</span>
      </p>
      <p className="datum">{jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    </div>
  )
}

// ---------- Timer ----------
const VORGABEN_MIN = [1, 2, 3, 5, 10, 15]

/** Drei kurze Töne am Ende. Der Ton entsteht im Gerät (Web Audio), es wird nichts geladen. */
function signal() {
  try {
    const Klasse = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Klasse) return
    const audio = new Klasse()
    for (let i = 0; i < 3; i++) {
      const ton = audio.createOscillator()
      const laut = audio.createGain()
      const start = audio.currentTime + i * 0.45
      ton.frequency.value = 880
      laut.gain.setValueAtTime(0.0001, start)
      laut.gain.exponentialRampToValueAtTime(0.4, start + 0.03)
      laut.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
      ton.connect(laut).connect(audio.destination)
      ton.start(start)
      ton.stop(start + 0.4)
    }
    setTimeout(() => void audio.close(), 2000)
  } catch {
    /* ohne Ton geht es auch – das Fenster blinkt */
  }
}

export function Timer() {
  const [dauer, setDauer] = useState(5 * 60_000)
  const [rest, setRest] = useState(5 * 60_000)
  const [bis, setBis] = useState<number | null>(null) // Zeitpunkt des Endes, solange der Timer läuft
  const [fertig, setFertig] = useState(false)

  useTakt(bis !== null, 200, () => {
    const r = Math.max(0, (bis ?? 0) - Date.now())
    setRest(r)
    if (r === 0) {
      setBis(null)
      setFertig(true)
      signal()
    }
  })

  function setze(ms: number) {
    const d = Math.min(180 * 60_000, Math.max(10_000, ms))
    setDauer(d)
    setRest(d)
    setBis(null)
    setFertig(false)
  }
  function startStopp() {
    setFertig(false)
    if (bis !== null) {
      setRest(Math.max(0, bis - Date.now()))
      setBis(null)
    } else {
      const r = rest > 0 ? rest : dauer
      setRest(r)
      setBis(Date.now() + r)
    }
  }

  const laeuft = bis !== null
  return (
    <div className={'timer' + (fertig ? ' fertig' : '')}>
      <p className="grosse-zahl" role="timer" aria-label="Restzeit">
        {zeitText(rest, true)}
      </p>
      <div className="balken" aria-hidden="true">
        <span style={{ width: `${(rest / dauer) * 100}%` }} />
      </div>
      {fertig && (
        <p className="hinweis" role="status">
          Die Zeit ist um.
        </p>
      )}
      <div className="reihe">
        <button type="button" className="f-knopf haupt" onClick={startStopp}>
          <Symbol name={laeuft ? 'pause' : 'start'} />
          {laeuft ? 'Pause' : 'Start'}
        </button>
        <button type="button" className="f-knopf" onClick={() => setze(dauer)}>
          Zurück
        </button>
      </div>
      <div className="reihe eng" role="group" aria-label="Dauer wählen">
        <button type="button" className="f-knopf klein" aria-label="Eine Minute weniger" disabled={laeuft} onClick={() => setze(dauer - 60_000)}>
          −
        </button>
        {VORGABEN_MIN.map((m) => (
          <button key={m} type="button" className="f-knopf klein" aria-pressed={dauer === m * 60_000} aria-label={`${m} Minuten`} disabled={laeuft} onClick={() => setze(m * 60_000)}>
            {m}
          </button>
        ))}
        <button type="button" className="f-knopf klein" aria-label="Eine Minute mehr" disabled={laeuft} onClick={() => setze(dauer + 60_000)}>
          +
        </button>
      </div>
    </div>
  )
}

// ---------- Stoppuhr ----------
export function Stoppuhr() {
  const [summe, setSumme] = useState(0) // bisher gelaufene Zeit ohne den aktuellen Abschnitt
  const [seit, setSeit] = useState<number | null>(null)
  const [, neuZeichnen] = useState(0)
  useTakt(seit !== null, 100, () => neuZeichnen((n) => n + 1))

  const zeit = summe + (seit !== null ? Date.now() - seit : 0)
  const laeuft = seit !== null
  return (
    <div className="stoppuhr">
      <p className="grosse-zahl" role="timer" aria-label="Gestoppte Zeit">
        {stoppText(zeit)}
      </p>
      <div className="reihe">
        <button
          type="button"
          className="f-knopf haupt"
          onClick={() => {
            if (seit !== null) {
              setSumme(summe + Date.now() - seit)
              setSeit(null)
            } else setSeit(Date.now())
          }}
        >
          <Symbol name={laeuft ? 'pause' : 'start'} />
          {laeuft ? 'Stopp' : 'Start'}
        </button>
        <button
          type="button"
          className="f-knopf"
          disabled={zeit === 0}
          onClick={() => {
            setSumme(0)
            setSeit(null)
          }}
        >
          Zurück
        </button>
      </div>
    </div>
  )
}

// ---------- Würfel ----------
/** Welche der neun Felder (3 × 3) bei welcher Augenzahl einen Punkt haben */
const AUGEN: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }

export function Wuerfel() {
  const [anzahl, setAnzahl] = useState(1)
  const [wurf, setWurf] = useState<number[]>([])
  const [nr, setNr] = useState(0)
  const werfen = (n = anzahl) => {
    setWurf(Array.from({ length: n }, () => wuerfle()))
    setNr((x) => x + 1)
  }
  return (
    <div className="wuerfel">
      <div className="wuerfel-feld" role="status" aria-label={wurf.length ? `Gewürfelt: ${wurf.join(', ')}` : 'Noch nicht gewürfelt'} key={nr}>
        {(wurf.length ? wurf : Array.from({ length: anzahl }, () => 0)).map((w, i) => (
          <span className={'wuerfel-bild' + (w ? '' : ' leer')} key={i} aria-hidden="true">
            {Array.from({ length: 9 }, (_, feld) => (
              <i key={feld} className={AUGEN[w]?.includes(feld) ? 'auge' : ''} />
            ))}
          </span>
        ))}
      </div>
      {wurf.length > 1 && <p className="hinweis">Summe: {wurf.reduce((a, b) => a + b, 0)}</p>}
      <div className="reihe">
        <button type="button" className="f-knopf haupt" onClick={() => werfen()}>
          Würfeln
        </button>
        <div className="reihe eng" role="group" aria-label="Anzahl der Würfel">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              className="f-knopf klein"
              aria-pressed={anzahl === n}
              aria-label={n === 1 ? 'Ein Würfel' : `${n} Würfel`}
              onClick={() => {
                setAnzahl(n)
                setWurf([])
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Notiz ----------
const FARBNAMEN: Record<NotizFarbe, string> = { gelb: 'Gelb', gruen: 'Grün', rosa: 'Rosa', blau: 'Blau' }

export function Notiz({ fenster, beiAendern }: { fenster: FensterZustand; beiAendern: (neu: { text?: string; farbe?: NotizFarbe }) => void }) {
  return (
    <div className="notiz">
      <textarea value={fenster.text ?? ''} maxLength={MAX_NOTIZTEXT} placeholder="Notiz …" aria-label="Notiztext" onChange={(e) => beiAendern({ text: e.target.value })} />
      <div className="reihe eng" role="group" aria-label="Farbe der Notiz">
        {NOTIZFARBEN.map((n) => (
          <button key={n} type="button" className={'notiz-farbe notiz-' + n} aria-pressed={fenster.farbe === n} aria-label={'Notizfarbe ' + FARBNAMEN[n]} title={FARBNAMEN[n]} onClick={() => beiAendern({ farbe: n })} />
        ))}
      </div>
    </div>
  )
}
