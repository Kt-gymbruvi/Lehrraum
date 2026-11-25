// Inhalte der Fenster: Uhr, Timer, Stoppuhr, Notiz, Arbeitsform, Geräuschampel. Alles läuft nur auf diesem Gerät.
import { useEffect, useRef, useState } from 'react'
import {
  ARBEITSFORM_NAMEN,
  ARBEITSFORMEN,
  GRENZE_MAX,
  GRENZE_MIN,
  GRENZE_STANDARD,
  LAUTSTAERKE_NAMEN,
  LAUTSTAERKEN,
  MAX_NOTIZTEXT,
  NOTIZFARBEN,
  stoppText,
  zeitText,
  type FensterZustand,
  type NotizFarbe,
} from '../kern/fenster.ts'
import { AMPEL_NAMEN, AMPEL_START, glaette, naechsteAmpel, pegel, type Ampelstand } from '../kern/geraeusch.ts'
import { stoppAnteil, timerAnteil, timerStufe } from '../kern/fenster.ts'
import { Symbol } from '../ui/Symbol.tsx'

type Aenderung = Partial<Omit<FensterZustand, 'id' | 'art'>>

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

/**
 * Ring um die große Zahl (Timer und Stoppuhr): Spur und Bogen, der Bogen zeigt den Anteil 0 … 1.
 * Bei 1 ist der Ring voll; beim Timer läuft er leer, bei der Stoppuhr einmal je Minute um.
 */
function Ring({ anteil, stufe = 'normal', children }: { anteil: number; stufe?: string; children: React.ReactNode }) {
  return (
    <div className={'zeitring zeitring-' + stufe}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="zeitring-spur" cx="60" cy="60" r="54" />
        <circle className="zeitring-bogen" cx="60" cy="60" r="54" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 * (1 - anteil)} transform="rotate(-90 60 60)" />
      </svg>
      <div className="zeitring-mitte">{children}</div>
    </div>
  )
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
      <Ring anteil={timerAnteil(rest, dauer)} stufe={timerStufe(rest, dauer, fertig)}>
        <p className="grosse-zahl" role="timer" aria-label="Restzeit">
          {zeitText(rest, true)}
        </p>
      </Ring>
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
      <Ring anteil={zeit > 0 && zeit % 60_000 === 0 ? 1 : stoppAnteil(zeit)} stufe={laeuft ? 'laeuft' : 'normal'}>
        <p className="grosse-zahl" role="timer" aria-label="Gestoppte Zeit">
          {stoppText(zeit)}
        </p>
      </Ring>
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

// ---------- Arbeitsform ----------
/** Schild für die Klasse: Sozialform und erlaubte Lautstärke – groß lesbar, mit dem Eckgriff noch größer */
export function Arbeitsform({ fenster, beiAendern }: { fenster: FensterZustand; beiAendern: (neu: Aenderung) => void }) {
  const form = fenster.form ?? 'einzel'
  const laut = fenster.laut ?? 'still'
  return (
    <div className="arbeitsform">
      <div className={'schild laut-' + laut} role="status" aria-label={`${ARBEITSFORM_NAMEN[form]}, ${LAUTSTAERKE_NAMEN[laut]}`}>
        <span className="schild-symbol">
          <Symbol name={form} />
        </span>
        <p className="schild-name">{ARBEITSFORM_NAMEN[form]}</p>
        <p className="schild-laut">
          <Symbol name={laut} />
          {LAUTSTAERKE_NAMEN[laut]}
        </p>
      </div>
      <div className="reihe eng" role="group" aria-label="Arbeitsform wählen">
        {ARBEITSFORMEN.map((a) => (
          <button key={a} type="button" className="f-knopf symbol-knopf" aria-pressed={form === a} aria-label={ARBEITSFORM_NAMEN[a]} title={ARBEITSFORM_NAMEN[a]} onClick={() => beiAendern({ form: a })}>
            <Symbol name={a} />
          </button>
        ))}
      </div>
      <div className="reihe eng" role="group" aria-label="Lautstärke wählen">
        {LAUTSTAERKEN.map((l) => (
          <button key={l} type="button" className="f-knopf symbol-knopf" aria-pressed={laut === l} aria-label={LAUTSTAERKE_NAMEN[l]} title={LAUTSTAERKE_NAMEN[l]} onClick={() => beiAendern({ laut: l })}>
            <Symbol name={l} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- Geräuschampel ----------
type Messung = { strom: MediaStream; audio: AudioContext; analyse: AnalyserNode; puffer: Float32Array<ArrayBuffer> }

function mikrofonFehler(err: unknown): string {
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Das Mikrofon ist nicht erlaubt. In den Einstellungen des Browsers lässt es sich für diese Seite freigeben.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Es wurde kein Mikrofon gefunden.'
  if (name === 'NotReadableError') return 'Das Mikrofon wird gerade von einer anderen Anwendung benutzt.'
  return 'Das Mikrofon ließ sich nicht einschalten.'
}

/**
 * Ampel nach der Lautstärke im Raum. Das Mikrofon läuft erst nach „Start“ und nur, solange das Fenster offen ist.
 * Gemessen wird nur der Pegel auf diesem Gerät – nichts wird aufgenommen, gespeichert oder gesendet.
 */
export function Geraeuschampel({ fenster, beiAendern }: { fenster: FensterZustand; beiAendern: (neu: Aenderung) => void }) {
  const grenze = fenster.grenze ?? GRENZE_STANDARD
  const [an, setAn] = useState(false)
  const [startet, setStartet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [wert, setWert] = useState(0)
  const [ampel, setAmpel] = useState<Ampelstand>(AMPEL_START)
  const messung = useRef<Messung | null>(null)
  const geglaettet = useRef(0)
  const grenzeRef = useRef(grenze)
  grenzeRef.current = grenze
  const offen = useRef(true)

  function gibFrei() {
    const m = messung.current
    messung.current = null
    if (!m) return
    for (const spur of m.strom.getTracks()) spur.stop()
    void m.audio.close().catch(() => {})
  }
  function stoppe() {
    gibFrei()
    geglaettet.current = 0
    setWert(0)
    setAmpel(AMPEL_START)
    setAn(false)
  }
  // Fenster zu: Mikrofon aus
  useEffect(() => {
    offen.current = true
    return () => {
      offen.current = false
      gibFrei()
    }
  }, [])

  async function starte() {
    setFehler('')
    const Klasse = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!navigator.mediaDevices?.getUserMedia || !Klasse) {
      setFehler('Das Mikrofon ist hier nicht verfügbar (nur über eine sichere Verbindung).')
      return
    }
    setStartet(true)
    try {
      const strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      if (!offen.current) {
        for (const spur of strom.getTracks()) spur.stop() // Fenster wurde inzwischen geschlossen
        return
      }
      const audio = new Klasse()
      const analyse = audio.createAnalyser()
      analyse.fftSize = 2048
      audio.createMediaStreamSource(strom).connect(analyse) // nur zur Messung, nicht zu den Lautsprechern
      messung.current = { strom, audio, analyse, puffer: new Float32Array(analyse.fftSize) }
      setAn(true)
    } catch (err) {
      setFehler(mikrofonFehler(err))
    } finally {
      setStartet(false)
    }
  }

  useTakt(an, 100, () => {
    const m = messung.current
    if (!m) return
    m.analyse.getFloatTimeDomainData(m.puffer)
    const p = glaette(geglaettet.current, pegel(m.puffer))
    geglaettet.current = p
    setWert(p)
    setAmpel((a) => naechsteAmpel(a, p, grenzeRef.current, Date.now()))
  })

  const farbe = an ? ampel.farbe : null
  return (
    <div className="geraeusch">
      <div className="ampel-reihe">
        <div className="ampel" role="status" aria-label={farbe ? `Ampel: ${AMPEL_NAMEN[farbe]}` : 'Ampel aus'}>
          {(['rot', 'gelb', 'gruen'] as const).map((f) => (
            <span key={f} className={'licht licht-' + f + (farbe === f ? ' an' : '')} />
          ))}
        </div>
        <div className="ampel-steuerung">
          <div className="pegel" aria-hidden="true">
            <span className="pegel-wert" style={{ width: `${Math.round(wert)}%` }} />
            <span className="pegel-grenze" style={{ left: `${grenze}%` }} />
          </div>
          <label className="regler">
            Rot ab
            <input type="range" min={GRENZE_MIN} max={GRENZE_MAX} step={1} value={grenze} aria-label="Grenze für Rot" onChange={(e) => beiAendern({ grenze: Number(e.target.value) })} />
          </label>
          <button type="button" className={'f-knopf' + (an ? '' : ' haupt')} disabled={startet} onClick={() => (an ? stoppe() : void starte())}>
            <Symbol name={an ? 'pause' : 'mikrofon'} />
            {an ? 'Stopp' : startet ? 'Einen Moment …' : 'Start'}
          </button>
        </div>
      </div>
      {fehler && (
        <p className="fehler" role="alert">
          {fehler}
        </p>
      )}
      <p className="hinweis klein">Nur der Pegel wird auf diesem Gerät gemessen – nichts wird aufgenommen oder gesendet.</p>
    </div>
  )
}
