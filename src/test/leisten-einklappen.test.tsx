// Werkzeugleisten einklappen: mehr Platz zum Beschriften; die Wahl wird je Gerät gemerkt
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Tafel from '../tafel/Tafel.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_, n) => (n === 'measureText' ? () => ({ width: 20 }) : () => undefined), set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(() => window.localStorage.removeItem('lehrraum-leisten'))

describe('Leisten einklappen', () => {
  it('klappt die linke und die rechte Leiste ein und aus und merkt sich die Wahl', async () => {
    const nutzer = userEvent.setup()
    const { container, unmount } = render(<Tafel />)
    await screen.findByText('Auf diesem Gerät gespeichert')
    const mitte = container.querySelector('.tafel-mitte')!
    expect(mitte).not.toHaveClass('links-zu')
    await nutzer.click(screen.getByRole('button', { name: 'Linke Werkzeugleiste einklappen' }))
    expect(mitte).toHaveClass('links-zu')
    expect(mitte).not.toHaveClass('rechts-zu')
    await nutzer.click(screen.getByRole('button', { name: 'Rechte Werkzeugleiste einklappen' }))
    expect(mitte).toHaveClass('rechts-zu')
    expect(JSON.parse(window.localStorage.getItem('lehrraum-leisten')!)).toEqual({ links: true, rechts: true })

    unmount()
    const neu = render(<Tafel />)
    await screen.findByText('Auf diesem Gerät gespeichert')
    expect(neu.container.querySelector('.tafel-mitte')).toHaveClass('links-zu', 'rechts-zu')
    await nutzer.click(screen.getByRole('button', { name: 'Linke Werkzeugleiste einblenden' }))
    expect(neu.container.querySelector('.tafel-mitte')).not.toHaveClass('links-zu')
  })
})
