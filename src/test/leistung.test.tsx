import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.tsx'
import { beginne, bewegung, bildwechsel, gezeichnet, imVerlauf, KEINE, MAX_VERLAUF, MIN_SPRUNG, schliesseAb, zaehle, zahl, zeigerart, type Meldung, type Strichmessung, type Zeigerart } from '../kern/messung.ts'
import type { Strich } from '../kern/modell.ts'
import { ladeLetzteTafel } from '../speicher/datenbank.ts'
import { messung } from '../tafel/messung.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

// jsdom kann nicht zeichnen. Hier zählt eine Attrappe je Zeichenebene mit, wie oft geleert und gefüllt wurde –
// so lässt sich prüfen, wie viel die Tafel zeichnet, ohne dass ein Bild entsteht.
type Zaehler = Record<string, number>
const zaehler = new WeakMap<HTMLCanvasElement, Zaehler>()
const attrappen = new WeakMap<HTMLCanvasElement, object>()
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    let ctx = attrappen.get(this)
    if (!ctx) {
      const z: Zaehler = {}
      zaehler.set(this, z)
      ctx = new Proxy({}, { get: (_, name) => () => void (z[String(name)] = (z[String(name)] ?? 0) + 1), set: () => true })
      attrappen.set(this, ctx)
    }
    return ctx
  } as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

const flaeche = () => screen.getByTestId('zeichenflaeche')
/** Zählerstände der unteren (fertige Elemente) und der oberen Ebene (entstehender Strich) */
const ebenen = () => {
  const [unten, oben] = [...flaeche().querySelectorAll('canvas')].map((c) => ({ ...(zaehler.get(c) ?? {}) }))
  return { unten, oben }
}
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const gespeichert = async () => ((await ladeLetzteTafel())?.seiten[0].elemente ?? []) as Strich[]

function ziehe(von: [number, number], nach: [number, number], zeiger: Partial<PointerEventInit> = {}) {
  const basis = { pointerId: 1, pointerType: 'mouse', button: 0, ...zeiger }
  fireEvent.pointerDown(flaeche(), { ...basis, clientX: von[0], clientY: von[1] })
  fireEvent.pointerMove(flaeche(), { ...basis, clientX: (von[0] + nach[0]) / 2, clientY: (von[1] + nach[1]) / 2 })
  fireEvent.pointerMove(flaeche(), { ...basis, clientX: nach[0], clientY: nach[1] })
  fireEvent.pointerUp(flaeche(), { ...basis, clientX: nach[0], clientY: nach[1] })
}

describe('Zeichnen ohne unnötige Arbeit', () => {
  it('zeichnet beim Schreiben höchstens einmal je Bildwechsel und verliert dabei keinen Punkt', async () => {
    render(<Tafel />)
    await bereit()
    const basis = { pointerId: 1, pointerType: 'mouse', button: 0 }
    fireEvent.pointerDown(flaeche(), { ...basis, clientX: 10, clientY: 10 })
    const vorher = ebenen().oben.clearRect
    for (let i = 1; i <= 30; i++) fireEvent.pointerMove(flaeche(), { ...basis, clientX: 10 + i * 5, clientY: 10 + i * 2 })
    // 30 Meldungen in einem Atemzug: noch nichts gezeichnet, erst beim nächsten Bildwechsel – und dann genau einmal
    expect(ebenen().oben.clearRect).toBe(vorher)
    await waitFor(() => expect(ebenen().oben.clearRect).toBe(vorher + 1))
    fireEvent.pointerUp(flaeche(), { ...basis, clientX: 160, clientY: 70 })
    await waitFor(async () => expect(await gespeichert()).toHaveLength(1))
    expect((await gespeichert())[0].punkte).toHaveLength(31)
  })

  /** So viele Flächen füllt das Blatt beim Zeichnen: drei Schichten Schatten und das weiße Blatt */
  const BLATT_FLAECHEN = 4
  it('ergänzt nach einem neuen Strich nur diesen, statt alles neu zu zeichnen', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    ziehe([10, 10], [200, 10])
    await waitFor(async () => expect(await gespeichert()).toHaveLength(1))
    const a = ebenen().unten

    ziehe([10, 60], [200, 60])
    await waitFor(async () => expect(await gespeichert()).toHaveLength(2))
    const b = ebenen().unten
    expect(b.clearRect).toBe(a.clearRect) // die untere Ebene wurde nicht geleert …
    expect(b.fill).toBe(a.fill + 1) // … und nur der neue Strich kam dazu

    // Rückgängig muss alles neu zeichnen (ein Strich weniger) …
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect(await gespeichert()).toHaveLength(1))
    const c = ebenen().unten
    expect(c.clearRect).toBe(b.clearRect + 1)
    expect(c.fill).toBe(b.fill + 1 + BLATT_FLAECHEN) // ein Strich und das Blatt (neue Tafeln haben das Format 16:9)

    // … und Wiederholen zeichnet den Strich wieder ein, obwohl er schon einmal eingezeichnet war
    await nutzer.click(screen.getByRole('button', { name: 'Wiederholen' }))
    await waitFor(async () => expect(await gespeichert()).toHaveLength(2))
    const d = ebenen().unten
    expect(d.clearRect).toBe(c.clearRect)
    expect(d.fill).toBe(c.fill + 1)
  })

  it('meldet die verschobene Ansicht gebündelt weiter; beim Loslassen gilt der letzte Stand', async () => {
    render(<Tafel />)
    await bereit()
    fireEvent.pointerDown(flaeche(), { pointerId: 9, pointerType: 'pen', clientX: 5, clientY: 5 }) // ab jetzt verschieben Finger
    fireEvent.pointerUp(flaeche(), { pointerId: 9, pointerType: 'pen', clientX: 5, clientY: 5 })
    const vorher = ebenen().unten.clearRect
    const finger = { pointerId: 2, pointerType: 'touch' }
    const uhr = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000) // nicht gleich nach dem Stift (sonst Handballen)
    fireEvent.pointerDown(flaeche(), { ...finger, clientX: 100, clientY: 100 })
    uhr.mockRestore()
    for (let i = 1; i <= 20; i++) fireEvent.pointerMove(flaeche(), { ...finger, clientX: 100 + i * 3, clientY: 100 + i })
    expect(ebenen().unten.clearRect).toBe(vorher) // 20 Bewegungen, noch kein Neuzeichnen
    fireEvent.pointerUp(flaeche(), { ...finger, clientX: 160, clientY: 120 })
    await waitFor(async () => expect((await ladeLetzteTafel())?.kamera).toEqual({ x: 60, y: 20, zoom: 1 }))
    expect(ebenen().unten.clearRect).toBe(vorher + 1)
  })
})

describe('Messung – Logik', () => {
  // Ohne Angabe bewegt sich der Zeiger je Millisekunde um einen Pixel nach rechts
  const m = (zeit: number, mehr: Partial<Meldung> = {}): Meldung => ({ zeit, wartezeit: 4, punkte: 1, druck: 0.5, breite: 1, hoehe: 1, x: zeit, y: 0, ...mehr })

  it('benennt die Art der Eingabe', () => {
    expect(['pen', 'touch', 'mouse', ''].map(zeigerart)).toEqual(['stift', 'finger', 'maus', 'unbekannt'])
  })

  it('rechnet Meldungen, Punkte und Bildwechsel je Sekunde und merkt sich die längste Pause', () => {
    const lauf = beginne('finger', m(1000))
    for (let i = 1; i <= 10; i++) bewegung(lauf, m(1000 + i * 10, { punkte: 2 }))
    bewegung(lauf, m(1200, { wartezeit: 40 })) // ein Hänger: 100 ms Pause
    for (let i = 1; i <= 6; i++) bildwechsel(lauf, 1000 + i * 16)
    bildwechsel(lauf, 1200)
    const s = schliesseAb(lauf, 1500)
    expect(s).toMatchObject({ art: 'finger', dauer: 500, meldungenJeSekunde: 22, punkteJeSekunde: 42, pauseMax: 100, bildwechselJeSekunde: 14, bildpauseMax: 104, wartenMax: 40, einzeichnen: null })
    expect(s.wartenMittel).toBeCloseTo((11 * 4 + 40) / 12)
  })

  it('zählt eine Lücke nur, wenn sich der Zeiger dabei bewegt hat (stillstehender Finger meldet nichts)', () => {
    const lauf = beginne('finger', m(0))
    bewegung(lauf, m(10))
    bewegung(lauf, m(300, { x: 12 })) // 290 ms nichts gemeldet, aber nur 2 px weiter: Finger stand still
    bewegung(lauf, m(320, { x: 40 }))
    expect(schliesseAb(lauf, 330).pauseMax).toBe(20)
    bewegung(lauf, m(400, { x: 40, y: 30 })) // 80 ms Lücke mit 30 px Sprung: das macht die Schrift eckig
    expect(schliesseAb(lauf, 410).pauseMax).toBe(80)
    expect(MIN_SPRUNG).toBeGreaterThan(2)
  })

  it('führt einen Verlauf (neuester zuerst, begrenzt) und zählt je Eingabeart', () => {
    const s = (art: Zeigerart) => schliesseAb(beginne(art, m(0)), 10)
    let verlauf: Strichmessung[] = []
    let anzahl = KEINE
    for (let i = 0; i < MAX_VERLAUF + 3; i++) {
      const neu = s(i === 0 ? 'stift' : 'finger')
      verlauf = imVerlauf(verlauf, neu)
      anzahl = zaehle(anzahl, neu.art)
    }
    expect(verlauf).toHaveLength(MAX_VERLAUF)
    expect(verlauf.every((x) => x.art === 'finger')).toBe(true) // der Stiftstrich ist herausgefallen …
    expect(anzahl).toEqual({ stift: 1, finger: MAX_VERLAUF + 2, maus: 0, unbekannt: 0 }) // … gezählt bleibt er
    expect(KEINE.stift).toBe(0)
  })

  it('erkennt echten Druck und die größte Berührungsfläche', () => {
    const stift = beginne('stift', m(0, { druck: 0.2 }))
    bewegung(stift, m(10, { druck: 0.7 }))
    expect(schliesseAb(stift, 20)).toMatchObject({ druckMin: 0.2, druckMax: 0.7, druckEcht: true })

    const faust = beginne('finger', m(0, { breite: 20, hoehe: 24 }))
    bewegung(faust, m(10, { breite: 90, hoehe: 110 }))
    bewegung(faust, m(20, { breite: 60, hoehe: 70 }))
    expect(schliesseAb(faust, 30)).toMatchObject({ druckEcht: false, breiteMax: 90, hoeheMax: 110 })
  })

  it('mittelt die Rechenzeit je Bild; ohne Bild und ohne Wartezeit bleibt der Wert offen', () => {
    const lauf = beginne('maus', m(0, { wartezeit: null }))
    expect(schliesseAb(lauf, 0)).toMatchObject({ rechenMittel: null, wartenMittel: null, meldungenJeSekunde: 0 })
    gezeichnet(lauf, 2)
    gezeichnet(lauf, 6)
    gezeichnet(lauf, 4, false) // gehört zum selben Bild wie das vorige
    expect(schliesseAb(lauf, 100)).toMatchObject({ rechenMittel: 6, rechenMax: 6 })
  })

  it('schreibt Zahlen mit deutschem Komma', () => {
    expect([zahl(3.14159, 2), zahl(59.6), zahl(0.5, 1)]).toEqual(['3,14', '60', '0,5'])
  })
})

describe('Prüfansicht', () => {
  const oeffne = (adresse: string) =>
    render(
      <MemoryRouter initialEntries={[adresse]}>
        <App />
      </MemoryRouter>,
    )

  it('fehlt auf der normalen Tafel; dort wird nicht gemessen', async () => {
    oeffne('/tafel')
    await bereit()
    expect(screen.queryByLabelText('Prüfansicht')).not.toBeInTheDocument()
    ziehe([10, 10], [100, 10])
    expect(messung.aktiv).toBe(false)
    expect(messung.verlauf).toEqual([])
  })

  it('zeigt nach einem Strich mit dem Stift Eingabeart und echten Druck', async () => {
    oeffne('/pruefen')
    await bereit()
    expect(screen.getByLabelText('Prüfansicht')).toHaveTextContent('Noch keiner')
    const stift = { pointerId: 4, pointerType: 'pen', width: 1, height: 1 }
    fireEvent.pointerDown(flaeche(), { ...stift, clientX: 10, clientY: 10, pressure: 0.2 })
    fireEvent.pointerMove(flaeche(), { ...stift, clientX: 60, clientY: 30, pressure: 0.5 })
    await waitFor(() => expect(screen.getByTestId('pruef-jetzt')).toHaveTextContent('Stift · Druck 0,50'))
    fireEvent.pointerMove(flaeche(), { ...stift, clientX: 120, clientY: 40, pressure: 0.9 })
    fireEvent.pointerUp(flaeche(), { ...stift, clientX: 120, clientY: 40, pressure: 0 })

    const ansicht = screen.getByLabelText('Prüfansicht')
    expect(ansicht).toHaveTextContent('Stift,')
    expect(ansicht).toHaveTextContent('echter Druck')
    expect(ansicht).not.toHaveTextContent('kein echter Druck')
    expect(screen.getByTestId('pruef-jetzt')).toHaveTextContent('Keine Berührung')
    await waitFor(() => expect(ansicht).toHaveTextContent('1 Element'))
    expect(messung.verlauf[0]?.einzeichnen).not.toBeNull()
    expect(screen.getByTestId('pruef-anzahl')).toHaveTextContent('Stift 1 · Finger 0 · Maus 0')
    // Der Strich ist trotz Messung ganz normal auf der Tafel gelandet
    await waitFor(async () => expect(await gespeichert()).toHaveLength(1))
  })

  it('zeigt bei einer großen Berührung (Faust) deren Größe', async () => {
    oeffne('/pruefen')
    await bereit()
    const faust = { pointerId: 7, pointerType: 'touch' }
    fireEvent.pointerDown(flaeche(), { ...faust, clientX: 200, clientY: 200, width: 30, height: 40 })
    fireEvent.pointerMove(flaeche(), { ...faust, clientX: 260, clientY: 210, width: 96, height: 120 })
    fireEvent.pointerUp(flaeche(), { ...faust, clientX: 260, clientY: 210, width: 96, height: 120 })
    const ansicht = screen.getByLabelText('Prüfansicht')
    expect(ansicht).toHaveTextContent('Finger,')
    expect(ansicht).toHaveTextContent('kein echter Druck')
    expect(ansicht).toHaveTextContent('96 × 120 px')
  })

  it('zeigt einen ganzen Testdurchgang auf einen Blick: Zähler, letzter Strich mit Nummer, Verlauf davor', async () => {
    oeffne('/pruefen')
    await bereit()
    ziehe([10, 10], [100, 10], { pointerId: 1, pointerType: 'touch' })
    ziehe([10, 60], [100, 60], { pointerId: 2, pointerType: 'pen', pressure: 0.5 })
    ziehe([10, 110], [100, 110], { pointerId: 3, pointerType: 'mouse' })
    expect(screen.getByTestId('pruef-anzahl')).toHaveTextContent('Stift 1 · Finger 1 · Maus 1')
    expect(screen.getByText('Letzter Strich (Nr. 3)')).toBeInTheDocument()
    const zeilen = screen.getAllByRole('row').slice(1) // ohne Kopfzeile
    expect(zeilen.map((z) => z.textContent?.slice(0, 7))).toEqual(['2Stift,', '1Finger'])
    expect(screen.queryByRole('button', { name: 'halb' })).not.toBeInTheDocument() // den Schärfe-Versuch gibt es nicht mehr
  })

  it('hört beim Schließen auf zu messen und vergisst die Werte', async () => {
    const { unmount } = oeffne('/pruefen')
    await bereit()
    expect(messung.aktiv).toBe(true)
    ziehe([10, 10], [100, 10])
    expect(messung.verlauf).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Schließen' })).toHaveAttribute('href', '#/tafel')
    unmount()
    expect(messung.aktiv).toBe(false)
    expect(messung.verlauf).toEqual([])
    expect(messung.anzahl).toEqual(KEINE)
  })
})
