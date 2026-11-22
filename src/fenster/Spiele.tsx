// Fenster „Spiele“: Die Klasse spielt gegeneinander (Vier gewinnt, Mühle, Schach). Die Tafel legt einen Raum an, zeigt den
// QR-Code und legt fest, welche Spiele erlaubt sind; die Schüler kommen über die Lobby auf der Startseite, bieten Spiele an
// und steigen bei anderen ein. Hier sieht die Lehrkraft, wer im Raum ist, wer ein Spiel anbietet und welche Partien laufen.
// Nichts wird gespeichert: Der Code bleibt nur bis zum Schließen des Tabs im Browser, Spitznamen gehen nur über den Echtzeit-Kanal.
import { useEffect, useMemo, useRef, useState } from 'react'
import { qrPfad } from '../kern/qrcode.ts'
import { angebote, laufende, lobbyAdresse, neuerCode, SPIEL_IDS, SPIELE, istCode, type SpielId, type Teilnehmer } from '../kern/spielraum.ts'
import { oeffneRaum, type Spielraum, type Verbindung } from '../speicher/spielraum.ts'
import './spiele.css'

const SCHLUESSEL = 'lehrraum-spielraum'

function gemerkt(): { code: string; erlaubt: SpielId[] } {
  try {
    const x = JSON.parse(sessionStorage.getItem(SCHLUESSEL) ?? 'null') as { code?: unknown; erlaubt?: unknown } | null
    if (x && istCode(x.code)) {
      const erlaubt = Array.isArray(x.erlaubt) ? SPIEL_IDS.filter((s) => (x.erlaubt as unknown[]).includes(s)) : SPIEL_IDS
      return { code: x.code, erlaubt }
    }
  } catch {
    /* ohne Speicher: neuer Code */
  }
  return { code: neuerCode(), erlaubt: SPIEL_IDS }
}

const zufallsId = () => {
  const z = new Uint32Array(2)
  crypto.getRandomValues(z)
  return 'tafel-' + z[0].toString(36) + z[1].toString(36)
}

export function Spiele() {
  const start = useMemo(gemerkt, [])
  const [code, setCode] = useState(start.code)
  const [erlaubt, setErlaubt] = useState<SpielId[]>(start.erlaubt)
  const [liste, setListe] = useState<Teilnehmer[]>([])
  const [verbindung, setVerbindung] = useState<Verbindung>('verbindet')
  const id = useRef(zufallsId())
  const raum = useRef<Spielraum | null>(null)
  const erlaubtRef = useRef(erlaubt)
  erlaubtRef.current = erlaubt

  useEffect(() => {
    try {
      sessionStorage.setItem(SCHLUESSEL, JSON.stringify({ code, erlaubt }))
    } catch {
      /* egal */
    }
  }, [code, erlaubt])

  // Raum öffnen (und bei neuem Code wechseln); beim Schließen des Fensters verlassen
  useEffect(() => {
    setListe([])
    const r = oeffneRaum(code, id.current, erlaubtRef.current, setListe, setVerbindung)
    raum.current = r
    return () => {
      r.schliessen()
      raum.current = null
    }
  }, [code])

  const adresse = lobbyAdresse(code)
  const qr = useMemo(() => qrPfad(adresse), [adresse])
  const schueler = liste.filter((t) => !t.leitung)
  const offen = angebote(liste)
  const partien = laufende(liste)

  const umschalten = (spiel: SpielId) => {
    const neu = SPIEL_IDS.filter((s) => (s === spiel ? !erlaubt.includes(s) : erlaubt.includes(s)))
    setErlaubt(neu)
    raum.current?.setzeErlaubt(neu)
  }

  return (
    <div className="spiele">
      <div className="spiele-kopf">
        <svg className="spiele-qr" viewBox={`0 0 ${qr.groesse} ${qr.groesse}`} role="img" aria-label={`QR-Code zum Spielraum ${code}`} shapeRendering="crispEdges">
          <rect width={qr.groesse} height={qr.groesse} fill="#ffffff" />
          <path d={qr.pfad} fill="#000000" />
        </svg>
        <div className="spiele-info">
          <p className="hinweis klein">Raumcode</p>
          <p className="spiele-code" aria-label={`Raumcode ${code.split('').join(' ')}`}>
            {code}
          </p>
          <p className="hinweis klein">Die Schüler scannen den QR-Code.</p>
          <button type="button" className="f-knopf klein" onClick={() => setCode(neuerCode())} title="Neuer Raum mit neuem Code – der alte bleibt leer">
            Neuer Code
          </button>
        </div>
      </div>

      <p className="hinweis klein spiele-status" role="status">
        {verbindung === 'nicht-eingerichtet' ? 'Der Server ist hier nicht eingerichtet.' : verbindung === 'verbunden' ? 'Raum ist offen.' : verbindung === 'verbindet' ? 'Verbinde …' : 'Verbindung weg – es wird erneut versucht.'}
      </p>

      <fieldset className="spiele-erlaubt">
        <legend>Erlaubte Spiele</legend>
        {SPIEL_IDS.map((s) => (
          <label key={s}>
            <input type="checkbox" checked={erlaubt.includes(s)} onChange={() => umschalten(s)} />
            {SPIELE[s]}
          </label>
        ))}
      </fieldset>

      <p className="spiele-zahlen">
        <strong>{schueler.length}</strong> im Raum · <strong>{offen.length}</strong> {offen.length === 1 ? 'Angebot' : 'Angebote'} · <strong>{partien.length}</strong> {partien.length === 1 ? 'Partie läuft' : 'Partien laufen'}
      </p>

      {offen.length > 0 && (
        <ul className="spiele-liste" aria-label="Angebote">
          {offen.map((t) => (
            <li key={t.id}>
              {t.name} sucht {t.angebot!.spiel === 'chaos-flitzer' ? 'Mitspieler: ' : ''}
              {SPIELE[t.angebot!.spiel]}
            </li>
          ))}
        </ul>
      )}
      {partien.length > 0 && (
        <ul className="spiele-liste" aria-label="Laufende Partien">
          {partien.map((p) => (
            <li key={p.partie}>
              {p.spiel === 'chaos-flitzer' ? `${p.a} spielt ${SPIELE[p.spiel]} (${p.b})` : `${p.a} gegen ${p.b} – ${SPIELE[p.spiel]}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
