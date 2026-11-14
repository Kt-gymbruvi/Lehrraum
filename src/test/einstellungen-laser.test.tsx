// Etappe 5: Laserpointer (L1) und Einstellungen merken (E1)
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EINSTELLUNGEN_SCHEMA, neueEinstellungen, pruefeEinstellungen, STANDARD_EINSTELLUNGEN, startWerkzeug } from '../kern/einstellungen.ts'
import { neueSeite, neuesTafelbild, type Strich } from '../kern/modell.ts'
import { ladeEinstellungen, ladeLetzteTafel, merkeEinstellungen, speichereTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_, n) => (n === 'measureText' ? () => ({ width: 20 }) : () => undefined), set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

describe('Einstellungen – Logik', () => {
  it('prüft gespeicherte Einstellungen; Unbekanntes wird zur Voreinstellung', () => {
    expect(pruefeEinstellungen(null)).toEqual(STANDARD_EINSTELLUNGEN)
    expect(pruefeEinstellungen({ schema: 'fremd', version: 1, werkzeug: 'marker' })).toEqual(STANDARD_EINSTELLUNGEN)
    expect(pruefeEinstellungen({ schema: EINSTELLUNGEN_SCHEMA, version: 2, werkzeug: 'marker' })).toEqual(STANDARD_EINSTELLUNGEN)
    const gut = { werkzeug: 'marker' as const, farbe: '#6a1b9a', staerke: 9, radierer: { art: 'element' as const, groesse: 'gross' as const } }
    expect(pruefeEinstellungen(neueEinstellungen(gut))).toEqual(gut)
    expect(pruefeEinstellungen({ schema: EINSTELLUNGEN_SCHEMA, version: 1, werkzeug: 'zauberstab', farbe: 'javascript:', staerke: 500, radierer: { art: 'feuer', groesse: 'klein' } })).toEqual({
      ...STANDARD_EINSTELLUNGEN,
      staerke: 30,
      radierer: { art: 'schwamm', groesse: 'klein' },
    })
    expect(pruefeEinstellungen({ schema: EINSTELLUNGEN_SCHEMA, version: 1, farbe: '#ABCDEF' }).farbe).toBe('#abcdef')
  })

  it('Radierer, Laserpointer und Hand werden beim Start zum Stift; anderes bleibt', () => {
    expect(['radierer', 'laser', 'hand'].map((w) => startWerkzeug(w as 'radierer'))).toEqual(['stift', 'stift', 'stift'])
    expect(startWerkzeug('auswahl')).toBe('auswahl')
    expect(startWerkzeug('ellipse')).toBe('ellipse')
    expect(pruefeEinstellungen({ ...neueEinstellungen(STANDARD_EINSTELLUNGEN), werkzeug: 'laser' }).werkzeug).toBe('stift')
  })
})

const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const knopf = (name: string) => screen.getByRole('button', { name })
const gedrueckt = (name: string) => expect(knopf(name)).toHaveAttribute('aria-pressed', 'true')

describe('Einstellungen merken – Bedienung', () => {
  it('Werkzeug, Farbe, Stärke und Radierer sind nach dem Neuladen wie zuletzt', async () => {
    const nutzer = userEvent.setup()
    const { unmount } = render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Radierer'))
    await nutzer.click(knopf('Radierer'))
    await nutzer.click(knopf('Element-Radierer'))
    await nutzer.click(knopf('Radierer Groß'))
    await nutzer.click(knopf('Textmarker'))
    await nutzer.click(knopf('Rot'))
    await nutzer.click(knopf('Strichstärke breit'))
    await waitFor(async () => expect(await ladeEinstellungen()).toMatchObject({ werkzeug: 'marker', farbe: '#c62828', staerke: 12, radierer: { art: 'element', groesse: 'gross' } }))
    expect(screen.getByText('Auf diesem Gerät gespeichert')).toBeInTheDocument() // nur Einstellungen: die Tafel bleibt „gespeichert“
    unmount()
    render(<Tafel />)
    await bereit()
    gedrueckt('Textmarker')
    gedrueckt('Rot')
    gedrueckt('Strichstärke breit')
    await nutzer.click(knopf('Radierer'))
    await nutzer.click(knopf('Radierer'))
    gedrueckt('Element-Radierer')
    gedrueckt('Radierer Groß')
  })

  it('war zuletzt der Radierer gewählt, beginnt die Tafel mit dem Stift', async () => {
    await merkeEinstellungen({ ...STANDARD_EINSTELLUNGEN, werkzeug: 'radierer', farbe: '#1b6b43' })
    render(<Tafel />)
    await bereit()
    gedrueckt('Stift')
    gedrueckt('Grün')
  })
})

describe('Laserpointer', () => {
  const strich: Strich = { art: 'strich', id: 's', werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, 50, 0.5], [300, 50, 0.5]] }

  it('zeigt nur: nichts wird gezeichnet, gespeichert oder in den Verlauf gelegt; Taste Z wählt ihn', async () => {
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([strich])] })
    render(<Tafel />)
    await bereit()
    fireEvent.keyDown(window, { key: 'z' })
    gedrueckt('Laserpointer')
    const flaeche = screen.getByTestId('zeichenflaeche')
    const basis = { pointerId: 1, pointerType: 'pen', button: 0, pressure: 0.5 }
    fireEvent.pointerDown(flaeche, { ...basis, clientX: 10, clientY: 10 })
    for (let i = 1; i <= 20; i++) fireEvent.pointerMove(flaeche, { ...basis, clientX: 10 + i * 10, clientY: 10 + i * 5 })
    fireEvent.pointerUp(flaeche, { ...basis, clientX: 210, clientY: 110 })
    // fährt auch über den Strich, ohne ihn zu verändern
    fireEvent.pointerDown(flaeche, { ...basis, clientX: 100, clientY: 0 })
    fireEvent.pointerMove(flaeche, { ...basis, clientX: 100, clientY: 100 })
    fireEvent.pointerUp(flaeche, { ...basis, clientX: 100, clientY: 100 })
    await new Promise((r) => setTimeout(r, 800))
    expect(screen.getByText('Auf diesem Gerät gespeichert')).toBeInTheDocument()
    expect(screen.queryByText('Wird gespeichert …')).toBeNull()
    expect(knopf('Rückgängig')).toBeDisabled()
    expect((await ladeLetzteTafel())!.seiten[0].elemente).toEqual([strich])
  })

  it('eine Farbe wählen wechselt vom Laserpointer zum Stift', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Laserpointer'))
    await nutzer.click(knopf('Blau'))
    gedrueckt('Stift')
  })
})
