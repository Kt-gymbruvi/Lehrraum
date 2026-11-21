// Mitmachen freigeben (Lehrkraft, Tafel einer Klasse): QR-Code für die Schüler zeigen, Zeit steuern, die Seiten der
// Schüler ansehen, ausgewählte auf die Klassentafel kopieren, den Rest löschen (SPEC-schuelerseiten.md, Etappe 4).
// Namen und Zeichnungen werden nur auf diesem Gerät entschlüsselt; der Server sieht nur Platzkennungen.
import { useEffect, useMemo, useRef, useState } from 'react'
import { DAUERN, MAX_GAESTE, MAX_VORLAGE_BILDER, beendet, loeschzeit, platzZeilen, restSekunden, seitenFuerKlassentafel, verlaengert, type AbgabeStandZeile } from '../kern/sitzung.ts'
import { klassenName, type Klasse } from '../kern/klassen.ts'
import type { Seite } from '../kern/modell.ts'
import { qrPfad } from '../kern/qrcode.ts'
import { aendereEnde, aktualisiereAbgaben, beendeUndLoesche, freigabeAdresse, ladeFreigabe, starteFreigabe, type AbgabeCache, type Freigabe } from '../speicher/freigabe.ts'
import { fehlerText, istAngemeldet, serverVorhanden } from '../speicher/server.ts'
import { Vorschau } from '../tafel/Seitenuebersicht.tsx'
import './schueler.css'

const ABRUF_MS = 5000
const STATUS_TEXT = { frei: 'noch nicht dabei', angemeldet: 'angemeldet', schreibt: 'schreibt gerade', 'hat-geschrieben': 'hat geschrieben' } as const

type Phase = 'laedt' | 'ohne-server' | 'abgemeldet' | 'neu' | 'laeuft'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

type Props = {
  klasse: Klasse
  /** Die gezeigte Seite der Tafel – auf Wunsch das Aufgabenblatt für die Schüler */
  seite: Seite
  /** Ausgewählte Schülerseiten (schon mit Beschriftung) – die Tafel hängt sie an */
  beiUebernehmen: (seiten: Seite[]) => void
  beiSchliessen: () => void
  /** Abstand der Abrufe in Millisekunden (nur für Tests anders) */
  abrufMs?: number
}

/** Restzeit für sich, damit nicht die ganze Übersicht jede Sekunde neu gezeichnet wird */
function Restzeit({ ende }: { ende: string }) {
  const [rest, setRest] = useState(() => restSekunden({ beginn: '', ende }, new Date()))
  useEffect(() => {
    setRest(restSekunden({ beginn: '', ende }, new Date()))
    const uhr = window.setInterval(() => setRest(restSekunden({ beginn: '', ende }, new Date())), 1000)
    return () => window.clearInterval(uhr)
  }, [ende])
  return rest > 0 ? <strong className="fg-rest">noch {mmss(rest)}</strong> : <strong className="fg-rest aus">Zeit ist um</strong>
}

export function Freigabefenster({ klasse, seite, beiUebernehmen, beiSchliessen, abrufMs = ABRUF_MS }: Props) {
  const [phase, setPhase] = useState<Phase>('laedt')
  const [f, setF] = useState<Freigabe | null>(null)
  const [fehler, setFehler] = useState('')
  const [meldung, setMeldung] = useState('')
  const [arbeitet, setArbeitet] = useState(false)
  // Einstellungen für eine neue Freigabe
  const [minuten, setMinuten] = useState<number>(20)
  const [mitVorlage, setMitVorlage] = useState(false)
  const [gaeste, setGaeste] = useState(2)
  // laufende Freigabe
  const [staende, setStaende] = useState<AbgabeStandZeile[]>([])
  const cache = useRef<AbgabeCache>(new Map())
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set())
  const [gross, setGross] = useState<string | null>(null)
  const [loeschFrage, setLoeschFrage] = useState(false)

  // Beim Öffnen: Server da? angemeldet? läuft schon eine Freigabe dieser Klasse?
  useEffect(() => {
    let weg = false
    void (async () => {
      try {
        if (!serverVorhanden()) return setPhase('ohne-server')
        if (!(await istAngemeldet())) return setPhase('abgemeldet')
        const alt = await ladeFreigabe(klasse.id)
        if (weg) return
        setF(alt)
        setPhase(alt ? 'laeuft' : 'neu')
      } catch (e) {
        if (!weg) {
          setFehler(fehlerText(e))
          setPhase('neu')
        }
      }
    })()
    return () => {
      weg = true
    }
  }, [klasse.id])

  // Abrufen: alle paar Sekunden, solange das Fenster offen und sichtbar ist
  useEffect(() => {
    if (phase !== 'laeuft' || !f) return
    let weg = false
    let laeuft = false
    const holen = async () => {
      if (laeuft || document.visibilityState === 'hidden') return
      laeuft = true
      try {
        const s = await aktualisiereAbgaben(f, cache.current)
        if (!weg) {
          setStaende(s)
          setFehler('')
        }
      } catch (e) {
        if (!weg) setFehler(fehlerText(e))
      } finally {
        laeuft = false
      }
    }
    void holen()
    const uhr = window.setInterval(() => void holen(), abrufMs)
    return () => {
      weg = true
      window.clearInterval(uhr)
    }
  }, [phase, f, abrufMs])

  // Escape schließt (erst die große Ansicht)
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (gross) setGross(null)
      else beiSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [gross, beiSchliessen])

  const adresse = f ? freigabeAdresse(f) : ''
  const qr = useMemo(() => {
    if (!adresse) return null
    try {
      return qrPfad(adresse)
    } catch {
      return null
    }
  }, [adresse])

  const hatBilder = seite.hintergrund !== undefined || seite.elemente.some((e) => e.art === 'bild')

  async function los() {
    setArbeitet(true)
    setFehler('')
    try {
      cache.current = new Map()
      setStaende([])
      setGewaehlt(new Set())
      setF(await starteFreigabe(klasse.id, klassenName(klasse), klasse.schueler, minuten, mitVorlage ? seite : undefined, gaeste))
      setPhase('laeuft')
    } catch (e) {
      setFehler(fehlerText(e))
    } finally {
      setArbeitet(false)
    }
  }

  async function aendereZeit(neu: (z: { beginn: string; ende: string }) => { beginn: string; ende: string }) {
    if (!f) return
    setArbeitet(true)
    try {
      const z = neu({ beginn: f.beginn, ende: f.ende })
      await aendereEnde(f, z.ende)
      setF({ ...f, ende: z.ende })
      setFehler('')
    } catch (e) {
      setFehler(fehlerText(e))
    } finally {
      setArbeitet(false)
    }
  }

  async function allesLoeschen() {
    if (!f) return
    setArbeitet(true)
    try {
      await beendeUndLoesche(klasse.id, f)
      cache.current = new Map()
      setF(null)
      setStaende([])
      setGewaehlt(new Set())
      setLoeschFrage(false)
      setMeldung('Alles gelöscht.')
      setPhase('neu')
    } catch (e) {
      setFehler(fehlerText(e))
    } finally {
      setArbeitet(false)
    }
  }

  const uebernehme = () => {
    if (!f) return
    const gewaehlteSeiten = zeilen.filter((z) => gewaehlt.has(z.platz) && cache.current.has(z.platz)).map((z) => ({ name: z.name, seite: cache.current.get(z.platz)!.seite }))
    if (!gewaehlteSeiten.length) return
    beiUebernehmen(seitenFuerKlassentafel(gewaehlteSeiten, new Date()))
    setGewaehlt(new Set())
    setMeldung(`${gewaehlteSeiten.length === 1 ? '1 Seite' : `${gewaehlteSeiten.length} Seiten`} auf die Klassentafel kopiert.`)
  }

  const zeilen = f ? platzZeilen(f.daten.plaetze, staende, new Date()) : []
  // Gast-Plätze, die niemand benutzt, bleiben unsichtbar
  const sichtbar = zeilen.filter((z) => !z.gast || z.status !== 'frei')
  const dabei = sichtbar.filter((z) => z.status !== 'frei').length
  const mitSeite = zeilen.filter((z) => cache.current.has(z.platz))
  const wechsle = (platz: string) =>
    setGewaehlt((alt) => {
      const neu = new Set(alt)
      if (neu.has(platz)) neu.delete(platz)
      else neu.add(platz)
      return neu
    })
  const grossZeile = gross ? zeilen.find((z) => z.platz === gross) : undefined
  const grossSeite = gross ? cache.current.get(gross)?.seite : undefined
  const offen = f ? restSekunden({ beginn: '', ende: f.ende }, new Date()) > 0 : false

  return (
    <div className="freigabe" role="dialog" aria-label="Mitmachen freigeben">
      <header className="fg-kopf">
        <h1>Mitmachen · {klassenName(klasse)}</h1>
        <button type="button" className="f-knopf" onClick={beiSchliessen}>
          Schließen
        </button>
      </header>

      {fehler && (
        <p className="schueler-hinweis" role="alert">
          {fehler}
        </p>
      )}
      {meldung && <p role="status">{meldung}</p>}

      {phase === 'laedt' && <p>Einen Moment …</p>}
      {phase === 'ohne-server' && <p>Der Server ist noch nicht eingerichtet. Mitmachen braucht eine Verbindung.</p>}
      {phase === 'abgemeldet' && (
        <p>
          Zum Freigeben musst du angemeldet sein. <a href="#/klassen">Zu „Meine Klassen“</a> – dort kannst du dich anmelden.
        </p>
      )}

      {phase === 'neu' && (
        <section className="fg-neu">
          {klasse.schueler.length === 0 ? (
            <p>Diese Klasse hat noch keine Namen. Trage sie unter „Meine Klassen“ ein oder hole sie aus dem Notenbuch.</p>
          ) : (
            <>
              <p>Die Schüler scannen einen QR-Code, wählen ihren Namen und schreiben auf einer eigenen Seite. Du siehst alle Seiten und kannst die besten auf die Tafel der Klasse kopieren. Alles andere wird gelöscht.</p>
              <h2>Wie lange?</h2>
              <div className="fg-dauern" role="group" aria-label="Dauer">
                {DAUERN.map((m) => (
                  <button key={m} type="button" className="f-knopf" aria-pressed={minuten === m} onClick={() => setMinuten(m)}>
                    {m} Minuten
                  </button>
                ))}
              </div>
              <h2>Plätze für Gäste</h2>
              <p className="klein">Wer nicht in der Liste steht, kann als „Gast 1“, „Gast 2“ … mitmachen.</p>
              <div className="fg-dauern" role="group" aria-label="Gäste">
                {[0, 2, 5, MAX_GAESTE].map((n) => (
                  <button key={n} type="button" className="f-knopf" aria-pressed={gaeste === n} onClick={() => setGaeste(n)}>
                    {n === 0 ? 'Keine Gäste' : `${n} Gäste`}
                  </button>
                ))}
              </div>
              <label className="fg-wahl">
                <input type="checkbox" checked={mitVorlage} onChange={(e) => setMitVorlage(e.target.checked)} />
                Die gezeigte Seite als Aufgabenblatt mitschicken
              </label>
              {mitVorlage && hatBilder && <p className="klein">Bilder und PDF-Seiten gehen verschlüsselt mit (höchstens {MAX_VORLAGE_BILDER} je Freigabe).</p>}
              {mitVorlage && <p className="klein">Die Schüler bekommen eine Kopie, die sie ändern können.</p>}
              <button type="button" className="f-knopf haupt" disabled={arbeitet} onClick={() => void los()}>
                {arbeitet ? 'Wird angelegt …' : 'QR-Code erzeugen'}
              </button>
            </>
          )}
        </section>
      )}

      {phase === 'laeuft' && f && (
        <>
          <section className="fg-oben">
            <div className="fg-qr">
              {qr && (
                <svg className="qr-bild" viewBox={`0 0 ${qr.groesse} ${qr.groesse}`} role="img" aria-label="QR-Code zum Mitmachen" shapeRendering="crispEdges">
                  <rect width={qr.groesse} height={qr.groesse} fill="#ffffff" />
                  <path d={qr.pfad} fill="#000000" />
                </svg>
              )}
            </div>
            <div className="fg-info">
              <p className="fg-gross">
                <Restzeit ende={f.ende} />
              </p>
              <p>
                {dabei} von {sichtbar.length} dabei
              </p>
              {!offen && <p className="klein">Die Seiten bleiben noch bis {new Date(loeschzeit(f.ende)).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} Uhr zum Ansehen, dann werden sie gelöscht.</p>}
              <div className="fg-knoepfe">
                <button type="button" className="f-knopf" disabled={arbeitet} onClick={() => void aendereZeit((z) => verlaengert(z, 10, new Date()))}>
                  10 Minuten mehr
                </button>
                {offen && (
                  <button type="button" className="f-knopf" disabled={arbeitet} onClick={() => void aendereZeit((z) => beendet(z, new Date()))}>
                    Jetzt beenden
                  </button>
                )}
                <button type="button" className="f-knopf" onClick={() => void navigator.clipboard?.writeText(adresse).then(() => setMeldung('Adresse kopiert.'), () => setMeldung('Kopieren hat nicht geklappt.'))}>
                  Adresse kopieren
                </button>
              </div>
            </div>
          </section>

          <section aria-label="Seiten der Schüler">
            <div className="fg-leiste">
              <h2>Seiten der Schüler</h2>
              <button type="button" className="f-knopf" disabled={!mitSeite.length} onClick={() => setGewaehlt(new Set(mitSeite.map((z) => z.platz)))}>
                Alle auswählen
              </button>
              <button type="button" className="f-knopf haupt" disabled={![...gewaehlt].some((p) => cache.current.has(p))} onClick={uebernehme}>
                Auf die Klassentafel kopieren ({[...gewaehlt].filter((p) => cache.current.has(p)).length})
              </button>
            </div>
            <ul className="fg-raster">
              {sichtbar.map((z) => {
                const e = cache.current.get(z.platz)
                return (
                  <li key={z.platz} className={'fg-kachel ' + z.status}>
                    <label className="fg-wahl">
                      <input type="checkbox" disabled={!e} checked={gewaehlt.has(z.platz)} onChange={() => wechsle(z.platz)} aria-label={`${z.name} auswählen`} />
                      <span>
                        <strong>{z.name}</strong>
                        <small className="schueler-vergeben">{STATUS_TEXT[z.status]}</small>
                      </span>
                    </label>
                    {e ? (
                      <button type="button" className="fg-bild" aria-label={`Seite von ${z.name} groß ansehen`} onClick={() => setGross(z.platz)}>
                        <Vorschau seite={e.seite} format="a4-quer" breite={260} />
                      </button>
                    ) : (
                      <div className="fg-leer">noch nichts</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="fg-ende">
            {loeschFrage ? (
              <>
                <p role="alert">Alles löschen? Seiten, die du nicht auf die Klassentafel kopiert hast, sind dann endgültig weg.</p>
                <div className="fg-knoepfe">
                  <button type="button" className="f-knopf haupt" disabled={arbeitet} onClick={() => void allesLoeschen()}>
                    Ja, alles löschen
                  </button>
                  <button type="button" className="f-knopf" onClick={() => setLoeschFrage(false)}>
                    Abbrechen
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="f-knopf" onClick={() => setLoeschFrage(true)}>
                Fertig – Rest löschen
              </button>
            )}
          </section>
        </>
      )}

      {grossZeile && grossSeite && (
        <div className="fg-gross-ansicht" role="dialog" aria-label={`Seite von ${grossZeile.name}`}>
          <header className="fg-kopf">
            <h2>{grossZeile.name}</h2>
            <button type="button" className="f-knopf" aria-pressed={gewaehlt.has(grossZeile.platz)} onClick={() => wechsle(grossZeile.platz)}>
              {gewaehlt.has(grossZeile.platz) ? 'Ausgewählt' : 'Auswählen'}
            </button>
            <button type="button" className="f-knopf" onClick={() => setGross(null)}>
              Zurück
            </button>
          </header>
          <Vorschau seite={grossSeite} format="a4-quer" breite={Math.min(1100, Math.max(320, window.innerWidth - 48))} />
        </div>
      )}
    </div>
  )
}
