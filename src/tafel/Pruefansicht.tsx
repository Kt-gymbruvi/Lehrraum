// Prüfansicht (#/pruefen): zeigt beim Schreiben auf der Tafel, was das Gerät meldet (Stift, Finger, Druck, Größe der
// Berührung) und wie schnell die Tafel zeichnet. Gedacht zum Messen am echten Gerät, z. B. am Smartboard.
// Die Werte stehen nur auf dem Bildschirm – nichts wird gespeichert oder gesendet.
import { useEffect, useReducer, useRef } from 'react'
import { beginne, bewegung, bildwechsel, schliesseAb, zahl, zeigerart, ZEIGERNAME, type Meldung, type Strichmessung, type Zeigerart } from '../kern/messung.ts'
import { messung } from './messung.ts'

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
      <Zeile name="Längste Pause" wert={`${zahl(s.pauseMax)} ms`} auffaellig={s.pauseMax > GRENZE.pause} />
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

type Props = {
  /** Anzahl der Elemente auf der gezeigten Seite */
  elemente: number
  schaerfe: number
  beiSchaerfe: (s: number) => void
}

export function Pruefansicht({ elemente, schaerfe, beiSchaerfe }: Props) {
  const [, zeigeNeu] = useReducer((n: number) => n + 1, 0)
  const zeiger = useRef(new Map<number, Zeiger>())
  const haupt = useRef<number | null>(null)
  const geaendert = useRef(false)

  useEffect(() => {
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
        if (messung.lauf) messung.letzter = schliesseAb(messung.lauf, performance.now())
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
      messung.lauf = null
      messung.letzter = null
      window.removeEventListener('pointerdown', runter, wahl)
      window.removeEventListener('pointermove', bewegt, wahl)
      window.removeEventListener('pointerup', hoch, wahl)
      window.removeEventListener('pointercancel', hoch, wahl)
      cancelAnimationFrame(bild)
      clearInterval(anzeige)
    }
  }, [])

  const jetzt = [...zeiger.current.values()]
  const ebene = typeof document === 'undefined' ? null : document.querySelector<HTMLCanvasElement>('.zeichenflaeche canvas')
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const zusammengefasst = typeof PointerEvent !== 'undefined' && 'getCoalescedEvents' in PointerEvent.prototype

  return (
    <aside className="pruefansicht" aria-label="Prüfansicht">
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

      <h3>Letzter Strich</h3>
      {messung.letzter ? <Strich s={messung.letzter} /> : <p>Noch keiner</p>}

      <h3>Gerät</h3>
      <dl>
        <Zeile name="Zeichenfläche" wert={ebene ? `${ebene.width} × ${ebene.height} Pixel (Faktor ${zahl(dpr * schaerfe, 2)})` : '–'} />
        <Zeile name="Bildschirm" wert={typeof screen === 'undefined' ? '–' : `${screen.width} × ${screen.height}`} />
        <Zeile name="Auf der Seite" wert={elemente === 1 ? '1 Element' : `${elemente} Elemente`} />
        <Zeile name="Zwischenpunkte" wert={zusammengefasst ? 'liefert der Browser' : 'liefert der Browser nicht'} />
        <Zeile name="Berührungen" wert={`bis zu ${typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints || 0} gleichzeitig`} />
      </dl>
      <p className="klein browser">{typeof navigator === 'undefined' ? '' : navigator.userAgent}</p>

      <div className="knoepfe" role="group" aria-label="Schärfe der Zeichenfläche">
        <span>Schärfe</span>
        <button type="button" className="f-knopf" aria-pressed={schaerfe === 1} onClick={() => beiSchaerfe(1)}>
          voll
        </button>
        <button type="button" className="f-knopf" aria-pressed={schaerfe !== 1} onClick={() => beiSchaerfe(0.5)}>
          halb
        </button>
        <a className="f-knopf" href="#/tafel">
          Schließen
        </a>
      </div>
    </aside>
  )
}
