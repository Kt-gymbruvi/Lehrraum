// Gestaltung „Atelier“, Schritt 7: Bühne (Präsentieren) – nur Ansicht, nichts wird gespeichert
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BUEHNEN_FAMILIEN, FAMILIEN } from '../kern/werkzeugfamilien.ts'
import { neueSeite, neuesTafelbild } from '../kern/modell.ts'
import { ladeLetzteTafel, speichereTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_, n) => (n === 'measureText' ? () => ({ width: 20 }) : () => undefined), set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const knopf = (name: string) => screen.getByRole('button', { name })
const fehlt = (name: string) => expect(screen.queryByRole('button', { name })).toBeNull()

describe('Bühne – Logik', () => {
  it('zeigt nur Familien, die es gibt: Stift, Formen, Radierer, Laser', () => {
    expect(BUEHNEN_FAMILIEN).toEqual(['stift', 'formen', 'radierer', 'laser'])
    for (const id of BUEHNEN_FAMILIEN) expect(FAMILIEN.some((f) => f.id === id)).toBe(true)
  })
})

describe('Bühne – Bedienung', () => {
  it('Präsentieren blendet alles Übrige aus; Esc und „Beenden“ führen zurück', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Präsentieren'))
    expect(document.querySelector('.tafel')).toHaveClass('buehne')
    expect(screen.getByText('Seite 1 von 1')).toBeInTheDocument()
    for (const name of ['Stift', 'Rechteck', 'Radierer', 'Laserpointer']) expect(knopf(name)).toBeInTheDocument()
    for (const name of ['Auswahl', 'Text', 'Mehr Farben und Stärken', 'Seitenübersicht', 'Präsentieren', 'Rückgängig']) fehlt(name)
    expect(screen.queryByRole('complementary', { name: 'Unterrichtswerkzeuge' })).toBeNull()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('.tafel')).not.toHaveClass('buehne')
    expect(knopf('Auswahl')).toBeInTheDocument()

    await nutzer.click(knopf('Präsentieren'))
    await nutzer.click(knopf('Präsentieren beenden'))
    expect(document.querySelector('.tafel')).not.toHaveClass('buehne')
    await nutzer.click(knopf('Präsentieren'))
    await nutzer.click(knopf('Alle Leisten zeigen'))
    expect(document.querySelector('.tafel')).not.toHaveClass('buehne')
  })

  it('zeigt nur das Wesentliche: Farbe und Stärke beim Stift, Füllung bei Formen – nichts bei Laser', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Präsentieren'))
    const kapsel = () => screen.queryByRole('toolbar', { name: 'Einstellungen des Werkzeugs' })
    expect(kapsel()).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Farbe' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Strichstärke' })).toBeInTheDocument()
    fehlt('Einfügen')
    fehlt('Mehr Farben und Stärken')

    await nutzer.click(knopf('Rechteck'))
    expect(screen.getByRole('button', { name: 'Ausgefüllt' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Linienart' })).toBeNull()

    await nutzer.click(knopf('Radierer'))
    expect(screen.getByRole('group', { name: 'Größe des Radierers' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Farbe' })).toBeNull()

    await nutzer.click(knopf('Laserpointer'))
    expect(kapsel()).toBeNull()
  })

  it('Pfeiltasten und Knöpfe blättern; die Tafel bleibt unverändert gespeichert', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite(), neueSeite(), neueSeite()] })
    const vorher = (await ladeLetzteTafel())!
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Präsentieren'))
    expect(screen.getByText('Seite 1 von 3')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Seite 2 von 3')).toBeInTheDocument()
    await nutzer.click(knopf('Nächste Seite'))
    expect(screen.getByText('Seite 3 von 3')).toBeInTheDocument()
    expect(knopf('Nächste Seite')).toBeDisabled()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await nutzer.click(knopf('Vorige Seite'))
    expect(screen.getByText('Seite 1 von 3')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 700))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten).toEqual(vorher.seiten))
  })
})
