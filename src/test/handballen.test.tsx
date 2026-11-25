// Aufliegende Hand neben offenen Feldern: Am iPad schloss die Hand ein gerade mit dem Stift geöffnetes Feld
// (Hintergrund, Radierer …) sofort wieder – es schien, als ginge es gar nicht auf.
import { fireEvent, render, screen } from '@testing-library/react'
import Tafel from '../tafel/Tafel.tsx'
import { istHandballen, vergissStiftNebenan } from '../tafel/handballen.ts'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {
    moveTo() {}
    lineTo() {}
    arc() {}
  } as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(() => {
  vergissStift()
  vergissStiftNebenan()
})

const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const flaeche = () => screen.getByTestId('zeichenflaeche')
/** Tippt einen Knopf mit dem Stift an (so, wie es am iPad ankommt) */
function stiftTippt(el: Element) {
  const z = { pointerId: 7, pointerType: 'pen', button: 0, isPrimary: true }
  fireEvent.pointerDown(el, z)
  fireEvent.pointerUp(el, z)
  fireEvent.click(el)
}
const hand = (el: Element, mehr: object = {}) => fireEvent.pointerDown(el, { pointerId: 20, pointerType: 'touch', button: 0, isPrimary: true, clientX: 50, clientY: 50, ...mehr })

describe('Aufliegende Hand', () => {
  it('erkennt Finger kurz nach dem Stift und zweite Finger als Hand – Maus und Stift nie', () => {
    expect(istHandballen({ pointerType: 'touch', isPrimary: true })).toBe(false)
    expect(istHandballen({ pointerType: 'touch', isPrimary: false })).toBe(true)
    expect(istHandballen({ pointerType: 'mouse', isPrimary: false })).toBe(false)
  })

  it('das Feld „Hintergrund“ bleibt offen, wenn nach dem Stift die Hand aufliegt; ein Finger später schließt es', async () => {
    render(<Tafel />)
    await bereit()
    stiftTippt(screen.getByRole('button', { name: 'Hintergrund' }))
    expect(screen.getByRole('dialog', { name: 'Hintergrund' })).toBeTruthy()
    hand(flaeche())
    expect(screen.getByRole('dialog', { name: 'Hintergrund' })).toBeTruthy()
    vergissStiftNebenan() // einige Sekunden später: ein Finger tippt bewusst daneben
    hand(flaeche())
    expect(screen.queryByRole('dialog', { name: 'Hintergrund' })).toBeNull()
  })

  it('Art des Radierers in der Kapsel: trotz aufliegender Hand mit dem Stift wählbar', async () => {
    render(<Tafel />)
    await bereit()
    stiftTippt(screen.getByRole('button', { name: 'Radierer' }))
    hand(flaeche())
    hand(flaeche(), { pointerId: 21, isPrimary: false })
    stiftTippt(screen.getByRole('button', { name: 'Schwamm' }))
    expect(screen.getByRole('button', { name: 'Schwamm' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('„Mehr Farben“ mit dem Stift geöffnet: auch eine Hand, die erst Sekunden später aufliegt, schließt das Feld nicht', async () => {
    render(<Tafel />)
    await bereit()
    const jetzt = Date.now()
    const uhr = vi.spyOn(Date, 'now').mockReturnValue(jetzt)
    const mehr = () => screen.queryByRole('dialog', { name: 'Mehr Farben und Stärken' })
    try {
      stiftTippt(screen.getByRole('button', { name: 'Mehr Farben und Stärken' }))
      uhr.mockReturnValue(jetzt + 5000) // man liest das Feld, dann legt sich die Hand auf
      hand(flaeche())
      expect(mehr()).toBeTruthy()
      // Der Stift daneben schließt es
      fireEvent.pointerDown(flaeche(), { pointerId: 7, pointerType: 'pen', button: 0, isPrimary: true })
      expect(mehr()).toBeNull()
    } finally {
      uhr.mockRestore()
    }
  })

  it('ein mit dem Finger geöffnetes Feld schließt ein Finger daneben weiterhin', async () => {
    render(<Tafel />)
    await bereit()
    fireEvent.click(screen.getByRole('button', { name: 'Hintergrund' }))
    expect(screen.getByRole('dialog', { name: 'Hintergrund' })).toBeTruthy()
    hand(flaeche())
    expect(screen.queryByRole('dialog', { name: 'Hintergrund' })).toBeNull()
  })

  it('ein mit dem Stift geöffnetes Textfeld bleibt offen, wenn die Hand die Tafel berührt', async () => {
    render(<Tafel />)
    await bereit()
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    const z = { pointerId: 8, pointerType: 'pen', button: 0, isPrimary: true, clientX: 200, clientY: 200 }
    fireEvent.pointerDown(flaeche(), z)
    fireEvent.pointerUp(flaeche(), z)
    expect(document.querySelector('.zeichenflaeche textarea')).not.toBeNull()
    hand(flaeche(), { clientX: 400, clientY: 400 })
    expect(document.querySelector('.zeichenflaeche textarea')).not.toBeNull()
  })

  it('Felder hängen direkt an der Seite, nicht in der rollbaren Leiste (Safari schneidet sie dort ab)', async () => {
    render(<Tafel />)
    await bereit()
    stiftTippt(screen.getByRole('button', { name: 'Mehr Farben und Stärken' }))
    const feld = screen.getByRole('dialog', { name: 'Mehr Farben und Stärken' })
    expect(feld.closest('.kontextkapsel')).toBeNull()
    expect(feld.parentElement).toBe(document.body)
    stiftTippt(screen.getByRole('button', { name: 'Mehr Farben und Stärken' }))
    expect(screen.queryByRole('dialog', { name: 'Mehr Farben und Stärken' })).toBeNull()
    stiftTippt(screen.getByRole('button', { name: 'Hintergrund' }))
    expect(screen.getByRole('dialog', { name: 'Hintergrund' }).closest('aside')).toBeNull()
  })
})
