// Prüfansicht (#/pruefen): zeigt beim Schreiben auf der Tafel, was das Gerät meldet (Stift, Finger, Druck, Größe der
// Berührung) und wie schnell die Tafel zeichnet. Gedacht zum Messen am echten Gerät, z. B. am Smartboard.
// Die Werte stehen nur auf dem Bildschirm – nichts wird gespeichert oder gesendet.
import { useEffect, useReducer, useRef } from 'react'
import { beginne, bewegung, bildwechsel, imVerlauf, schliesseAb, zaehle, zahl, zeigerart, ZEIGERNAME, type Meldung, type Strichmessung, type Zeigerart } from '../kern/messung.ts'
import { messung, setzeZurueck } from './messung.ts'

type Zeiger = { art: Zeigerart; druck: number; breite: number; hoehe: number }

/** Ab diesen Werten ist beim Schreiben mit Rucken oder eckiger Schrift zu rechnen */
const GRENZE = { pause: 50, bildpause: 50, rechnen: 8, warten: 30 }

const aufFlaeche = (e: Event) => e.target instanceof Element && e.target.closest('.zeichenflaeche') !== null

function meldungAus(e: PointerEvent, zeit: number): Meldung {
  const wartezeit = zeit - e.timeStamp
  return {
    zeit,
    wartezeit: Number.isFinite(wartezeit) && wartezeit >= 0 && wartezeit < 10_000 ? wartezeit : null,
    punkte: e.getCoalescedEvents?.().length || 1,
    druck: e.pressure || 0,
    breite: e.width || 0,
    hoehe: e.height || 0,
    x: e.clientX,
    y: e.clientY,
  }
}

const flaeche = (b: number, h: number) => `${zahl(b)} × ${zahl(h)} px`

function Zeile({ name, wert, auffaellig }: { name: string; wert: string; auffaellig?: boolean }) {
  return (
    <>
      <dt>{name}</dt>
      <dd className={auffaellig ? 'auffaellig' : undefined}>{wert}</dd>
    </>
  )
}

function Strich({ s }: { s: Strichmessung }) {
  return (
    <dl>
      <Zeile name="Eingabe" wert={`${ZEIGERNAME[s.art]}, ${zahl(s.dauer / 1000, 1)} s`} />
      <Zeile name="Druck" wert={`${zahl(s.druckMin, 2)} bis ${zahl(s.druckMax, 2)} – ${s.druckEcht ? 'echter Druck' : 'kein echter Druck'}`} />
      <Zeile name="Größte Berührung" wert={flaeche(s.breiteMax, s.hoeheMax)} />
      <Zeile name="Meldungen" wert={`${zahl(s.meldungenJeSekunde)} je Sekunde (${zahl(s.punkteJeSekunde)} Punkte)`} />
      <Zeile name="Längste Lücke" wert={`${zahl(s.pauseMax)} ms`} auffaellig={s.pauseMax > GRENZE.pause} />
      <Zeile name="Bildwechsel" wert={`${zahl(s.bildwechselJeSekunde)} je Sekunde`} />
      <Zeile name="Längster Hänger" wert={`${zahl(s.bildpauseMax)} ms`} auffaellig={s.bildpauseMax > GRENZE.bildpause} />
      <Zeile
        name="Rechenzeit je Bild"
        wert={s.rechenMittel === null ? '–' : `${zahl(s.rechenMittel, 1)} ms (höchstens ${zahl(s.rechenMax, 1)} ms)`}
        auffaellig={s.rechenMittel !== null && s.rechenMittel > GRENZE.rechnen}
      />
      <Zeile
        name="Wartezeit der Eingabe"
        wert={s.wartenMittel === null ? 'meldet der Browser nicht' : `${zahl(s.wartenMittel)} ms (höchstens ${zahl(s.wartenMax)} ms)`}
        auffaellig={s.wartenMittel !== null && s.wartenMittel > GRENZE.warten}
      />
      <Zeile name="Einzeichnen danach" wert={s.einzeichnen === null ? '–' : `${zahl(s.einzeichnen, 1)} ms`} auffaellig={(s.einzeichnen ?? 0) > GRENZE.bildpause} />
    </dl>
  )
}

/** Kurzfassung der letzten Striche – so passt ein ganzer Testdurchgang auf ein Foto */
function Verlauf({ striche, ab }: { striche: Strichmessung[]; ab: number }) {
  return (
    <table className="verlauf">
      <thead>
        <tr>
          <th>Nr.</th>
          <th>Eingabe</th>
          <th>Druck</th>
          <th>Berührung</th>
          <th>Lücke</th>
        </tr>
      </thead>
      <tbody>
        {striche.map((s, i) => (
          <tr key={ab - i}>
            <td>{ab - i}</td>
            <td>
              {ZEIGERNAME[s.art]}, {zahl(s.dauer / 1000, 1)} s
            </td>
            <td>{s.druckEcht ? 'echt' : 'keiner'}</td>
            <td>{flaeche(s.breiteMax, s.hoeheMax)}</td>
            <td className={s.pauseMax > GRENZE.pause ? 'auffaellig' : undefined}>{zahl(s.pauseMax)} ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Anzahl der Elemente auf der gezeigten Seite */
export function Pruefansicht({ elemente }: { elemente: number }) {
  const [, zeigeNeu] = useReducer((n: number) => n + 1, 0)
  const zeiger = useRef(new Map<number, Zeiger>())
  const haupt = useRef<number | null>(null)
  const geaendert = useRef(false)

  useEffect(() => {
    setzeZurueck()
    messung.aktiv = true
    messung.beiAenderung = zeigeNeu
    const merke = (e: PointerEvent): Meldung => {
      const m = meldungAus(e, performance.now())
      zeiger.current.set(e.pointerId, { art: zeigerart(e.pointerType), druck: m.druck, breite: m.breite, hoehe: m.hoehe })
      geaendert.current = true
      return m
    }
    const runter = (e: PointerEvent) => {
      if (!aufFlaeche(e)) return
      const m = merke(e)
      if (haupt.current === null) {
        haupt.current = e.pointerId
        messung.lauf = beginne(zeigerart(e.pointerType), m)
      }
    }
    const bewegt = (e: PointerEvent) => {
      if (!zeiger.current.has(e.pointerId)) return
      const m = merke(e)
      if (e.pointerId === haupt.current && messung.lauf) bewegung(messung.lauf, m)
    }
    const hoch = (e: PointerEvent) => {
      if (!zeiger.current.delete(e.pointerId)) return
      if (e.pointerId === haupt.current) {
        if (messung.lauf) {
          const s = schliesseAb(messung.lauf, performance.now())
          messung.verlauf = imVerlauf(messung.verlauf, s)
          messung.anzahl = zaehle(messung.anzahl, s.art)
        }
        messung.lauf = null
        haupt.current = null
      }
      zeigeNeu()
    }
    // Vor allen anderen zuhören (capture), ohne die Eingabe zu verändern
    const wahl = { capture: true, passive: true }
    window.addEventListener('pointerdown', runter, wahl)
    window.addEventListener('pointermove', bewegt, wahl)
    window.addEventListener('pointerup', hoch, wahl)
    window.addEventListener('pointercancel', hoch, wahl)

    // Bildwechsel des Browsers mitzählen: Bleibt einer aus, hängt die Seite
    let bild = 0
    const takt = () => {
      if (messung.lauf) bildwechsel(messung.lauf, performance.now())
      bild = requestAnimationFrame(takt)
    }
    bild = requestAnimationFrame(takt)
    // Die Anzeige „Jetzt“ nur ein paarmal je Sekunde auffrischen, damit das Anzeigen die Messung nicht stört
    const anzeige = setInterval(() => {
      if (!geaendert.current) return
      geaendert.current = false
      zeigeNeu()
    }, 250)

    return () => {
      messung.aktiv = false
      messung.beiAenderung = null
      setzeZurueck()
      window.removeEventListener('pointerdown', runter, wahl)
      window.removeEventListener('pointermove', bewegt, wahl)
      window.removeEventListener('pointerup', hoch, wahl)
      window.removeEventListener('pointercancel', hoch, wahl)
      cancelAnimationFrame(bild)
      clearInterval(anzeige)
    }
  }, [])

  const jetzt = [...zeiger.current.values()]
  const [letzter, ...frueher] = messung.verlauf
  const a = messung.anzahl
  const gesamt = a.stift + a.finger + a.maus + a.unbekannt
  const ebene = typeof document === 'undefined' ? null : document.querySelector<HTMLCanvasElement>('.zeichenflaeche canvas')
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const zusammengefasst = typeof PointerEvent !== 'undefined' && 'getCoalescedEvents' in PointerEvent.prototype

  return (
    <aside className="pruefansicht" aria-label="Prüfansicht">
      <div className="spalte">
        <h2>Prüfansicht</h2>
        <p className="klein">Schreib oder wisch auf der Tafel. Die Werte stehen nur hier auf dem Bildschirm.</p>

        <h3>Jetzt</h3>
        <p data-testid="pruef-jetzt">
          {jetzt.length === 0
            ? 'Keine Berührung'
            : jetzt.map((z, i) => (
                <span key={i} className="zeile">
                  {ZEIGERNAME[z.art]} · Druck {zahl(z.druck, 2)} · {flaeche(z.breite, z.hoehe)}
                </span>
              ))}
        </p>

        <h3>Angekommen seit dem Öffnen</h3>
        <p data-testid="pruef-anzahl">
          Stift {a.stift} · Finger {a.finger} · Maus {a.maus}
          {a.unbekannt ? ` · unbekannt ${a.unbekannt}` : ''}
        </p>

        <h3>{letzter ? `Letzter Strich (Nr. ${gesamt})` : 'Letzter Strich'}</h3>
        {letzter ? <Strich s={letzter} /> : <p>Noch keiner</p>}
      </div>

      <div className="spalte">
        {frueher.length > 0 && (
          <>
            <h3>Davor</h3>
            <Verlauf striche={frueher} ab={gesamt - 1} />
          </>
        )}

        <h3>Gerät</h3>
        <dl>
          <Zeile name="Zeichenfläche" wert={ebene ? `${ebene.width} × ${ebene.height} Pixel (Faktor ${zahl(dpr, 2)})` : '–'} />
          <Zeile name="Bildschirm" wert={typeof screen === 'undefined' ? '–' : `${screen.width} × ${screen.height}`} />
          <Zeile name="Auf der Seite" wert={elemente === 1 ? '1 Element' : `${elemente} Elemente`} />
          <Zeile name="Zwischenpunkte" wert={zusammengefasst ? 'liefert der Browser' : 'liefert der Browser nicht'} />
          <Zeile name="Berührungen" wert={`bis zu ${typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints || 0} gleichzeitig`} />
        </dl>
        <p className="klein browser">{typeof navigator === 'undefined' ? '' : navigator.userAgent}</p>

        <div className="knoepfe">
          <a className="f-knopf" href="#/tafel">
            Schließen
          </a>
        </div>
      </div>
    </aside>
  )
}
