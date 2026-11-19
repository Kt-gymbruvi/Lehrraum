// Füllwerkzeug: Fläche antippen = mit der gewählten Farbe füllen, noch einmal = Füllung weg
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fuelleBei } from '../kern/fuellen.ts'
import { imInnern } from '../kern/geometrie.ts'
import { neueSeite, neuesTafelbild, type Form } from '../kern/modell.ts'
import { ladeLetzteTafel, speichereTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

const form = (id: string, mehr: Partial<Form> = {}): Form => ({ art: 'form', id, form: 'rechteck', x1: 300, y1: 300, x2: 400, y2: 360, farbe: '#c62828', staerke: 4, ...mehr })

describe('Füllen – Logik', () => {
  it('erkennt das Innere von Rechteck, Ellipse und Dreieck, auch gedreht', () => {
    expect(imInnern(form('r'), 350, 330)).toBe(true)
    expect(imInnern(form('r'), 450, 330)).toBe(false)
    const e = form('e', { form: 'ellipse' })
    expect(imInnern(e, 350, 330)).toBe(true)
    expect(imInnern(e, 302, 302)).toBe(false) // Ecke des Rahmens, nicht der Ellipse
    expect(imInnern(form('l', { form: 'linie' }), 350, 330)).toBe(false)
    expect(imInnern(form('g', { drehung: 90 }), 350, 280)).toBe(true) // um 90° gedreht ragt es nach oben
  })

  it('füllt die oberste Fläche mit der Farbe, ein zweites Mal nimmt die Füllung weg', () => {
    const unten = form('unten')
    const oben = form('oben', { x1: 320, y1: 310, x2: 380, y2: 350 })
    const f = fuelleBei([unten, oben], 350, 330, '#1565c0')!
    expect(f.vorher.id).toBe('oben')
    expect(f.nachher).toEqual({ ...oben, farbe: '#1565c0', gefuellt: true })
    expect(fuelleBei([unten, oben], 305, 305, '#1565c0')!.vorher.id).toBe('unten') // nur im unteren
    expect(fuelleBei([unten, oben], 10, 10, '#1565c0')).toBeNull()
    const gefuellt = f.nachher
    const weg = fuelleBei([unten, gefuellt], 350, 330, '#1565c0')!.nachher
    expect(weg.gefuellt).toBeUndefined()
    expect(fuelleBei([unten, gefuellt], 350, 330, '#2e7d32')!.nachher).toMatchObject({ farbe: '#2e7d32', gefuellt: true }) // andere Farbe: umfärben
  })
})

describe('Füllen – Bedienung', () => {
  beforeAll(() => {
    const ctx = new Proxy({}, { get: (_, n) => (n === 'measureText' ? () => ({ width: 20 }) : () => undefined), set: () => true })
    HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
    globalThis.Path2D = class {} as unknown as typeof Path2D
    HTMLElement.prototype.setPointerCapture = () => undefined
  })
  beforeEach(vergissStift)

  it('Füllwerkzeug wählen, Fläche antippen, rückgängig machen', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([form('r')])] })
    render(<Tafel />)
    await screen.findByText('Auf diesem Gerät gespeichert')
    await nutzer.click(screen.getByRole('button', { name: 'Füllen' }))
    await nutzer.click(screen.getByRole('button', { name: 'Blau' }))
    const flaeche = screen.getByTestId('zeichenflaeche')
    const basis = { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 350, clientY: 330 }
    fireEvent.pointerDown(flaeche, basis)
    fireEvent.pointerUp(flaeche, basis)
    await waitFor(async () => {
      const f = (await ladeLetzteTafel())!.seiten[0].elemente[0] as Form
      expect(f.gefuellt).toBe(true)
      expect(f.farbe).not.toBe('#c62828')
    })
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect(((await ladeLetzteTafel())!.seiten[0].elemente[0] as Form).gefuellt).toBeUndefined())
  })
})
