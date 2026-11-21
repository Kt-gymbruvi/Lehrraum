// Schülerseite (#/mitmachen/<Code>/<Schlüssel>): QR-Code scannen → Namen wählen → auf der eigenen Seite schreiben.
// Kein Konto. Der Schlüssel steht nur im #-Teil der Adresse; Namensliste und Seite werden auf dem Gerät ver- und
// entschlüsselt, der Server sieht nur Platzkennungen und verschlüsselte Daten (SPEC-schuelerseiten.md).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { benutzteDateien, neueId, neueSeite, type Seite } from '../kern/modell.ts'
import { kopiere } from '../kern/seiten.ts'
import { MAX_SCHUELER_BILDER, geheimnisHash, istSitzungsCode, istSitzungsSchluessel, neuesPlatzGeheimnis, oeffneAbgabe, oeffneBild, oeffneSitzung, platzName, restSekunden, sitzungsSchluessel, verschluesseleBild, type Platz, type Sitzungsdaten } from '../kern/sitzung.ts'
import { erzeugeAbgabeSpeicher, type AbgabeSpeicher, type SendeStand } from '../speicher/abgabe.ts'
import { ladeDatei, legeDateiAb } from '../speicher/dateien.ts'
import { abgabeLaden, bildSpeichern, bilderLaden, fehlerText, mitmachenLaden, platzBelegen, serverVorhanden } from '../speicher/server.ts'
import Tafel from '../tafel/Tafel.tsx'
import './schueler.css'

type Kontext = { schluessel: CryptoKey; daten: Sitzungsdaten; ende: string; belegt: Set<string> }
type Start = { platz: Platz; geheimnis: string; hash: string; seite: Seite; stand: number; /** Fotos, die schon auf dem Server liegen */ bilder: string[] }

const SPEICHER_TEXT: Record<SendeStand, string> = {
  bereit: 'Bereit',
  wartet: 'Wird gesendet …',
  sendet: 'Wird gesendet …',
  gesendet: 'Gesendet',
  fehler: 'Keine Verbindung – ich versuche es weiter',
  'zeit-um': 'Die Zeit ist um',
  verloren: 'Dieser Name wird auf einem anderen Gerät benutzt',
  fotos: 'Zu viele oder zu große Fotos – bitte eines entfernen',
}

/** Bytes eines Blobs (jsdom kennt arrayBuffer() nicht überall) */
const bytesVon = (b: Blob): Promise<ArrayBuffer> =>
  typeof b.arrayBuffer === 'function'
    ? b.arrayBuffer()
    : new Promise((ok, fehler) => {
        const l = new FileReader()
        l.onload = () => ok(l.result as ArrayBuffer)
        l.onerror = () => fehler(l.error)
        l.readAsArrayBuffer(b)
      })

// ---------- Platz auf diesem Gerät merken (nur Platz und Geheimnis, nie Namen oder Inhalte) ----------
const merkeSchluessel = (code: string) => `lehrraum-mitmachen-${code}`
function gemerkt(code: string): { platz: string; geheimnis: string } | null {
  try {
    const w = JSON.parse(window.localStorage.getItem(merkeSchluessel(code)) ?? 'null')
    return w && typeof w.platz === 'string' && typeof w.geheimnis === 'string' ? w : null
  } catch {
    return null
  }
}
function merke(code: string, platz: string, geheimnis: string) {
  try {
    window.localStorage.setItem(merkeSchluessel(code), JSON.stringify({ platz, geheimnis }))
  } catch {
    /* ohne Speicher gilt der Platz nur bis zum Neuladen */
  }
}

/** Die erste Seite: Vorlage der Lehrkraft (als Kopie mit neuen Kennungen) oder eine leere Seite */
function startSeite(daten: Sitzungsdaten): Seite {
  const v = daten.vorlage
  if (!v) return neueSeite()
  return { ...v, id: neueId(), elemente: kopiere(v.elemente) }
}

const minutenSekunden = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function Mitmachen() {
  const { code = '', schluessel = '' } = useParams()
  const gueltig = istSitzungsCode(code) && istSitzungsSchluessel(schluessel)
  const [kontext, setKontext] = useState<Kontext | null>(null)
  const [start, setStart] = useState<Start | null>(null)
  const [fehler, setFehler] = useState('')
  const [hinweis, setHinweis] = useState('')
  const [frage, setFrage] = useState<Platz | null>(null) // Name angetippt, wartet auf „Ja, das bin ich“
  const [arbeitet, setArbeitet] = useState(false)

  /** Plätze neu laden (wer ist inzwischen belegt?) */
  const ladeNeu = useCallback(async (key: CryptoKey): Promise<Kontext> => {
    const info = await mitmachenLaden(code)
    const daten = await oeffneSitzung(key, info)
    if (!daten) throw new Error('Dieser Link ist unvollständig. Bitte den QR-Code noch einmal scannen.')
    return { schluessel: key, daten, ende: info.ende, belegt: new Set(info.plaetze.filter((p) => p.belegt).map((p) => p.platz)) }
  }, [code])

  /** Belegt den Platz (oder bestätigt den eigenen) und holt die eigene Seite – oder die Vorlage */
  const beginne = useCallback(
    async (k: Kontext, platz: Platz, geheimnis: string): Promise<boolean> => {
      const hash = await geheimnisHash(geheimnis)
      if (!(await platzBelegen(code, platz.platz, hash))) return false
      merke(code, platz.platz, geheimnis)
      const zeile = await abgabeLaden(code, platz.platz, hash)
      const alt = zeile?.daten && zeile.iv ? await oeffneAbgabe(k.schluessel, { iv: zeile.iv, daten: zeile.daten }, platz.platz) : null
      // eigene Fotos vom Server auf dieses Gerät holen (der Gerätespeicher der Schülerseite wird bei jedem Start geleert)
      const bilder: string[] = []
      for (const b of await bilderLaden(code, platz.platz, hash)) {
        const bytes = await oeffneBild(k.schluessel, { iv: b.iv, daten: b.daten }, platz.platz, b.bild)
        if (!bytes) continue
        await legeDateiAb(b.bild, new Blob([bytes], { type: 'image/jpeg' }))
        bilder.push(b.bild)
      }
      setStart({ platz, geheimnis, hash, seite: alt?.seite ?? startSeite(k.daten), stand: zeile?.stand ?? 0, bilder })
      return true
    },
    [code],
  )

  useEffect(() => {
    if (!gueltig) return
    let weg = false
    // anderer Link (anderer Code oder Schlüssel): von vorn anfangen
    setFehler('')
    setKontext(null)
    setStart(null)
    setFrage(null)
    void (async () => {
      try {
        if (!serverVorhanden()) throw new Error('Der Server ist noch nicht eingerichtet.')
        const k = await ladeNeu(await sitzungsSchluessel(schluessel))
        if (weg) return
        setKontext(k)
        // Dasselbe Gerät kommt zurück (Neuladen, Seite geschlossen): gleich weiterschreiben
        const alt = gemerkt(code)
        const platz = alt && k.daten.plaetze.find((p) => p.platz === alt.platz)
        if (alt && platz) await beginne(k, platz, alt.geheimnis)
      } catch (e) {
        if (!weg) setFehler(fehlerText(e))
      }
    })()
    return () => {
      weg = true
    }
  }, [gueltig, code, schluessel, ladeNeu, beginne])

  const bestaetige = async () => {
    if (!kontext || !frage) return
    setArbeitet(true)
    setHinweis('')
    try {
      if (!(await beginne(kontext, frage, neuesPlatzGeheimnis()))) {
        setHinweis(`„${platzName(frage)}“ ist schon vergeben. Bist du es doch und hast das Gerät gewechselt? Dann sag der Lehrkraft Bescheid.`)
        setKontext(await ladeNeu(kontext.schluessel))
      }
    } catch (e) {
      setHinweis(fehlerText(e))
    } finally {
      setFrage(null)
      setArbeitet(false)
    }
  }

  if (!gueltig) return <Hinweis titel="Dieser Link stimmt nicht">Bitte scanne den QR-Code noch einmal.</Hinweis>
  if (fehler) return <Hinweis titel="Hier geht es nicht weiter">{fehler}</Hinweis>
  if (start && kontext) return <Schreiben code={code} kontext={kontext} start={start} />
  if (!kontext) return <Hinweis titel="Einen Moment …">Die Klasse wird geladen.</Hinweis>

  const gaeste = kontext.daten.plaetze.filter((p) => p.gast)
  const freierGast = gaeste.find((g) => !kontext.belegt.has(g.platz))
  return (
    <main className="schueler-seite">
      <h1>{kontext.daten.klasse || 'Mitmachen'}</h1>
      {frage ? (
        <section aria-live="polite">
          <p className="schueler-frage">{frage.gast ? `Du schreibst als ${platzName(frage)}.` : `Bist du ${platzName(frage)}?`}</p>
          <div className="schueler-knoepfe">
            <button type="button" className="f-knopf haupt" disabled={arbeitet} onClick={() => void bestaetige()}>
              {frage.gast ? 'Ja, los' : 'Ja, das bin ich'}
            </button>
            <button type="button" className="f-knopf" disabled={arbeitet} onClick={() => setFrage(null)}>
              Zurück
            </button>
          </div>
        </section>
      ) : (
        <>
          <p>Tippe auf deinen Namen.</p>
          {hinweis && (
            <p className="schueler-hinweis" role="alert">
              {hinweis}
            </p>
          )}
          <ul className="schueler-namen">
            {kontext.daten.plaetze
              .filter((p) => !p.gast)
              .map((p) => {
              const belegt = kontext.belegt.has(p.platz)
              return (
                <li key={p.platz}>
                  <button type="button" className="f-knopf" disabled={belegt} onClick={() => (setHinweis(''), setFrage(p))}>
                    <span>
                      {platzName(p)}
                      {belegt && <small className="schueler-vergeben">schon vergeben</small>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {gaeste.length > 0 && (
            <section className="schueler-gast">
              <p>Dein Name steht nicht in der Liste?</p>
              <button type="button" className="f-knopf" disabled={!freierGast} onClick={() => (setHinweis(''), freierGast && setFrage(freierGast))}>
                Als Gast mitmachen
              </button>
              {!freierGast && <p className="schueler-hinweis">Alle Gast-Plätze sind schon vergeben. Sag der Lehrkraft Bescheid.</p>}
            </section>
          )}
        </>
      )}
    </main>
  )
}

function Hinweis({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <main className="schueler-seite">
      <h1>{titel}</h1>
      <p role="status">{children}</p>
    </main>
  )
}

// ---------- Schreiben ----------
/** Restzeit für sich: die Tafel wird dafür nicht jede Sekunde neu gezeichnet */
function Restzeit({ ende, beiDrei, beiNull }: { ende: string; beiDrei: () => void; beiNull: () => void }) {
  const [rest, setRest] = useState(() => restSekunden({ beginn: '', ende }, new Date()))
  const hilfe = useRef({ beiDrei, beiNull })
  hilfe.current = { beiDrei, beiNull }
  useEffect(() => {
    const uhr = window.setInterval(() => setRest(restSekunden({ beginn: '', ende }, new Date())), 1000)
    return () => window.clearInterval(uhr)
  }, [ende])
  useEffect(() => {
    if (rest === 3) hilfe.current.beiDrei() // kurz vor Schluss alles Offene senden – danach nimmt der Server nichts mehr an
    if (rest <= 0) hilfe.current.beiNull()
  }, [rest])
  return <span aria-label="Restzeit"> · noch {minutenSekunden(rest)}</span>
}

function Schreiben({ code, kontext, start }: { code: string; kontext: Kontext; start: Start }) {
  const [sende, setSende] = useState<SendeStand>('bereit')
  const [zeitUm, setZeitUm] = useState(() => restSekunden({ beginn: '', ende: kontext.ende }, new Date()) <= 0)
  const speicher = useRef<AbgabeSpeicher | null>(null)
  const hochgeladen = useRef(new Set(start.bilder))

  useEffect(() => {
    const s = erzeugeAbgabeSpeicher({
      code,
      platz: start.platz.platz,
      hash: start.hash,
      schluessel: kontext.schluessel,
      stand0: start.stand,
      beiStand: setSende,
      // Fotos gehen einzeln und verschlüsselt voraus; die Seite nennt danach nur ihre Kennungen
      vorbereiten: async (seite) => {
        for (const id of benutzteDateien([seite])) {
          if (hochgeladen.current.has(id)) continue
          const blob = await ladeDatei(id)
          if (!blob) continue
          const box = await verschluesseleBild(kontext.schluessel, start.platz.platz, id, await bytesVon(blob))
          await bildSpeichern(code, start.platz.platz, start.hash, id, box.iv, box.daten)
          hochgeladen.current.add(id)
        }
      },
    })
    speicher.current = s
    // Beim Verlassen oder Wegschalten sofort senden
    const jetzt = () => void s.sendeJetzt()
    const sichtbar = () => document.visibilityState === 'hidden' && jetzt()
    document.addEventListener('visibilitychange', sichtbar)
    window.addEventListener('pagehide', jetzt)
    return () => {
      document.removeEventListener('visibilitychange', sichtbar)
      window.removeEventListener('pagehide', jetzt)
      s.stoppe()
      speicher.current = null
    }
  }, [code, start, kontext.schluessel])

  const aus = zeitUm || sende === 'zeit-um' || sende === 'verloren'
  return (
    <Tafel
      gast
      schueler={{
        seite: start.seite,
        titel: kontext.daten.klasse || 'Mitmachen',
        beiAenderung: (s) => speicher.current?.melde(s),
        gesperrt: aus,
        maxBilder: MAX_SCHUELER_BILDER,
        gesperrtText: sende === 'verloren' ? 'Dieser Name wird auf einem anderen Gerät benutzt.' : 'Die Zeit ist um. Deine Seite ist gespeichert.',
        speicherText: zeitUm && sende !== 'verloren' ? 'Die Zeit ist um' : SPEICHER_TEXT[sende],
        kopfzeile: (
          <p className="schueler-kopfzeile">
            <strong>{platzName(start.platz)}</strong>
            <Restzeit ende={kontext.ende} beiDrei={() => void speicher.current?.sendeJetzt()} beiNull={() => setZeitUm(true)} />
          </p>
        ),
      }}
    />
  )
}
