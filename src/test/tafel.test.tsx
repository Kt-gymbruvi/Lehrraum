import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { neueSeite, neuesTafelbild, type Strich } from '../kern/modell.ts'
import { ladeLetzteTafel, ladeTafel, speichereTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

// jsdom kann nicht zeichnen: Canvas und Path2D durch Attrappen ersetzen. Geprüft wird hier die Bedienung
// (Eingabe → Striche → Speicher), nicht das Bild selbst.
beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[10, 10, 0.5], [200, 10, 0.5]] })

/** Zieht mit der Maus eine Linie über die Zeichenfläche. */
function ziehe(von: [number, number], nach: [number, number], zeiger: Partial<PointerEventInit> = {}) {
  const f = screen.getByTestId('zeichenflaeche')
  const basis = { pointerId: 1, pointerType: 'mouse', button: 0, ...zeiger }
  fireEvent.pointerDown(f, { ...basis, clientX: von[0], clientY: von[1] })
  fireEvent.pointerMove(f, { ...basis, clientX: (von[0] + nach[0]) / 2, clientY: (von[1] + nach[1]) / 2 })
  fireEvent.pointerMove(f, { ...basis, clientX: nach[0], clientY: nach[1] })
  fireEvent.pointerUp(f, { ...basis, clientX: nach[0], clientY: nach[1] })
}

const gespeichert = async () => ((await ladeLetzteTafel())?.seiten[0].elemente ?? []) as Strich[]
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')

describe('Speicher', () => {
  it('speichert und lädt ein Tafelbild, merkt sich das letzte', async () => {
    expect(await ladeLetzteTafel()).toBeNull()
    const a = { ...neuesTafelbild('A'), seiten: [neueSeite([strich('x')])] }
    const b = neuesTafelbild('B')
    await speichereTafel(a)
    await speichereTafel(b)
    expect(await ladeTafel(a.id)).toEqual(a)
    expect((await ladeLetzteTafel())?.titel).toBe('B')
    expect(await ladeTafel('gibt-es-nicht')).toBeNull()
  })
})

describe('Tafel', () => {
  it('zeigt die Werkzeuge; Stift ist gewählt, Rückgängig anfangs aus', async () => {
    render(<Tafel />)
    await bereit()
    expect(screen.getByRole('button', { name: 'Stift' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Textmarker' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeDisabled()
  })

  it('zeichnet einen Strich mit gewählter Farbe und Stärke und speichert ihn von selbst', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Rot' }))
    await nutzer.click(screen.getByRole('button', { name: 'Strichstärke breit' }))
    ziehe([10, 10], [200, 80])
    await waitFor(async () => expect(await gespeichert()).toHaveLength(1))
    const [s] = await gespeichert()
    expect(s).toMatchObject({ werkzeug: 'stift', farbe: '#c62828', staerke: 12, druckEcht: false })
    expect(s.punkte.length).toBeGreaterThanOrEqual(3)
    expect(s.punkte[0].slice(0, 2)).toEqual([10, 10])
  })

  it('Textmarker, Rückgängig und Wiederholen – auch per Tastatur', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    ziehe([10, 10], [100, 10])
    await nutzer.keyboard('m')
    expect(screen.getByRole('button', { name: 'Textmarker' })).toHaveAttribute('aria-pressed', 'true')
    ziehe([10, 50], [100, 50])
    await waitFor(async () => expect((await gespeichert()).map((e) => e.werkzeug)).toEqual(['stift', 'marker']))

    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect(await gespeichert()).toHaveLength(1))
    await nutzer.keyboard('{Control>}z{/Control}')
    await waitFor(async () => expect(await gespeichert()).toHaveLength(0))
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeDisabled()
    await nutzer.keyboard('{Control>}y{/Control}')
    await nutzer.click(screen.getByRole('button', { name: 'Wiederholen' }))
    await waitFor(async () => expect(await gespeichert()).toHaveLength(2))
  })

  it('Radierer entfernt nur getroffene Striche; Leeren lässt sich zurücknehmen', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    ziehe([10, 10], [200, 10])
    ziehe([10, 300], [200, 300])
    await nutzer.click(screen.getByRole('button', { name: 'Radierer' }))
    await nutzer.click(screen.getByRole('button', { name: 'Radierer' })) // noch einmal: Art und Größe
    await nutzer.click(screen.getByRole('button', { name: 'Element-Radierer' }))
    ziehe([100, 0], [100, 40]) // quer über den ersten Strich
    await waitFor(async () => expect(await gespeichert()).toHaveLength(1))
    expect((await gespeichert())[0].punkte[0][1]).toBe(300)

    await nutzer.click(screen.getByRole('button', { name: 'Seite leeren' }))
    await waitFor(async () => expect(await gespeichert()).toHaveLength(0))
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect(await gespeichert()).toHaveLength(2))
  })

  it('stellt die zuletzt benutzte Tafel nach dem Schließen wieder her', async () => {
    await speichereTafel({ ...neuesTafelbild('Herz und Kreislauf', 'unendlich'), seiten: [neueSeite([strich('a'), strich('b')])], kamera: { x: 5, y: 6, zoom: 2 } })
    render(<Tafel />)
    expect(await screen.findByRole('heading', { name: 'Herz und Kreislauf' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ansicht zurücksetzen' })).toHaveTextContent('200 %')
    expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeDisabled() // der Verlauf beginnt neu
  })

  it('nach einem Stift zeichnen Finger nicht mehr, sondern verschieben (Handballen-Schutz)', async () => {
    render(<Tafel />)
    await bereit()
    ziehe([10, 10], [100, 10], { pointerType: 'touch', pointerId: 5 }) // Finger zeichnet, solange kein Stift da war
    ziehe([10, 50], [100, 50], { pointerType: 'pen', pointerId: 6, pressure: 0.8 })
    ziehe([10, 70], [100, 70], { pointerType: 'touch', pointerId: 8 }) // gleich nach dem Stift: Handballen, tut nichts
    const spaeter = Date.now() + 2000
    const uhr = vi.spyOn(Date, 'now').mockReturnValue(spaeter)
    ziehe([10, 90], [100, 130], { pointerType: 'touch', pointerId: 7 }) // später: verschieben
    uhr.mockRestore()
    await waitFor(async () => expect((await ladeLetzteTafel())?.kamera).toEqual({ x: 90, y: 40, zoom: 1 }))
    const e = await gespeichert()
    expect(e).toHaveLength(2)
    expect(e[1]).toMatchObject({ druckEcht: true })
    expect(e[1].punkte[0][2]).toBeCloseTo(0.8)
  })

  it('aufgelegte Hand: der Stift schreibt trotzdem, die Ansicht bleibt (Handballen-Schutz)', async () => {
    render(<Tafel />)
    await bereit()
    const f = screen.getByTestId('zeichenflaeche')
    const hand = { pointerId: 20, pointerType: 'touch' }
    // 1. Noch kein Stift benutzt: die Hand liegt zuerst auf und malt – der Stift verwirft das und schreibt
    fireEvent.pointerDown(f, { ...hand, clientX: 300, clientY: 300 })
    fireEvent.pointerMove(f, { ...hand, clientX: 320, clientY: 310 })
    ziehe([10, 10], [100, 10], { pointerType: 'pen', pointerId: 21 })
    fireEvent.pointerMove(f, { ...hand, clientX: 350, clientY: 330 })
    fireEvent.pointerUp(f, { ...hand, clientX: 350, clientY: 330 })
    // 2. Später: Hand liegt auf (würde verschieben), dann setzt der Stift an – er schreibt, die Ansicht bleibt stehen
    const uhr = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000)
    fireEvent.pointerDown(f, { ...hand, pointerId: 22, clientX: 300, clientY: 300 })
    fireEvent.pointerDown(f, { pointerId: 23, pointerType: 'pen', clientX: 10, clientY: 50 })
    fireEvent.pointerMove(f, { ...hand, pointerId: 22, clientX: 340, clientY: 330 }) // Hand rutscht mit
    fireEvent.pointerMove(f, { pointerId: 23, pointerType: 'pen', clientX: 100, clientY: 50 })
    // 3. Während des Schreibens kommt ein zweiter Teil der Hand dazu: kein Zoom, der Strich bleibt
    fireEvent.pointerDown(f, { ...hand, pointerId: 24, clientX: 250, clientY: 320 })
    fireEvent.pointerMove(f, { ...hand, pointerId: 24, clientX: 200, clientY: 380 })
    fireEvent.pointerMove(f, { pointerId: 23, pointerType: 'pen', clientX: 150, clientY: 50 })
    fireEvent.pointerUp(f, { pointerId: 23, pointerType: 'pen', clientX: 150, clientY: 50 })
    fireEvent.pointerUp(f, { ...hand, pointerId: 22, clientX: 340, clientY: 330 })
    fireEvent.pointerUp(f, { ...hand, pointerId: 24, clientX: 200, clientY: 380 })
    uhr.mockRestore()
    await waitFor(async () => expect(await gespeichert()).toHaveLength(2))
    const e = await gespeichert()
    expect(e.every((x) => x.druckEcht)).toBe(true) // nur Stiftstriche, nichts von der Hand
    expect(e[1].punkte.at(-1)?.[0]).toBe(150)
    expect((await ladeLetzteTafel())?.kamera).toMatchObject({ x: 0, y: 0, zoom: 1 })
  })

  it('Zoom-Knöpfe ändern die Ansicht und setzen sie zurück (unendliche Fläche)', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel(neuesTafelbild('Tafel', 'unendlich'))
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Vergrößern' }))
    expect(screen.getByRole('button', { name: 'Ansicht zurücksetzen' })).toHaveTextContent('125 %')
    await nutzer.click(screen.getByRole('button', { name: 'Ansicht zurücksetzen' }))
    expect(screen.getByRole('button', { name: 'Ansicht zurücksetzen' })).toHaveTextContent('100 %')
  })
})
