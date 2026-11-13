// Etappe 4, Teil 1: mehr Farben und eigene Farbplätze (S1), Regler für die Stärke (S2), Knopf „Mehr“ (W1)
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { begrenzeStaerke, FARBPLAETZE_SCHEMA, inLeiste, MAX_EIGENE, mitEigenerFarbe, neueFarbplaetze, PALETTE, pruefeFarbplaetze, staerkeInLeiste } from '../kern/farben.ts'
import { neueSeite, neuesTafelbild, type Strich } from '../kern/modell.ts'
import { ladeFarbplaetze, ladeLetzteTafel, merkeFarbplaetze, speichereTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_, n) => (n === 'measureText' ? () => ({ width: 20 }) : () => undefined), set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

describe('Farben und Stärken – Logik', () => {
  it('die Palette hat rund 18 gültige, verschiedene Farben, die sechs der Leiste zuerst', () => {
    expect(PALETTE).toHaveLength(18)
    expect(new Set(PALETTE.map((f) => f.wert)).size).toBe(18)
    expect(PALETTE.every((f) => /^#[0-9a-f]{6}$/.test(f.wert))).toBe(true)
    expect(PALETTE.slice(0, 6).every((f) => inLeiste(f.wert))).toBe(true)
    expect(PALETTE.map((f) => f.name)).toEqual(expect.arrayContaining(['Gelb', 'Hellgrün', 'Rosa']))
  })

  it('eigene Farben: neueste vorne, ohne Doppel, höchstens sechs; Palettenfarben brauchen keinen Platz', () => {
    let p: string[] = []
    p = mitEigenerFarbe(p, '#123ABC')
    expect(p).toEqual(['#123abc'])
    p = mitEigenerFarbe(p, '#00ff00')
    p = mitEigenerFarbe(p, '#123abc') // schon da: nach vorne
    expect(p).toEqual(['#123abc', '#00ff00'])
    const vorher = p
    expect(mitEigenerFarbe(p, '#c62828')).toBe(vorher) // Rot steht in der Palette
    expect(mitEigenerFarbe(p, 'rot')).toBe(vorher)
    for (let i = 0; i < 8; i++) p = mitEigenerFarbe(p, `#00000${i}`)
    expect(p).toHaveLength(MAX_EIGENE)
    expect(p[0]).toBe('#000007')
    expect(p).not.toContain('#123abc') // die älteste wurde verdrängt
  })

  it('prüft gespeicherte Farbplätze', () => {
    expect(pruefeFarbplaetze(null)).toEqual([])
    expect(pruefeFarbplaetze({ schema: 'fremd', version: 1, farben: ['#123456'] })).toEqual([])
    expect(pruefeFarbplaetze({ schema: FARBPLAETZE_SCHEMA, version: 2, farben: ['#123456'] })).toEqual([])
    expect(pruefeFarbplaetze({ schema: FARBPLAETZE_SCHEMA, version: 1, farben: ['#123456', 'javascript:', '#ABCDEF', '#abcdef', 7] })).toEqual(['#123456', '#abcdef'])
    expect(pruefeFarbplaetze(neueFarbplaetze(['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777']))).toHaveLength(6)
  })

  it('Stärke: Regler 1 bis 30, ganze Zahlen; die drei Knöpfe liegen bei 3, 6, 12', () => {
    expect(begrenzeStaerke(0)).toBe(1)
    expect(begrenzeStaerke(99)).toBe(30)
    expect(begrenzeStaerke(8.6)).toBe(9)
    expect(begrenzeStaerke(NaN)).toBe(6)
    expect([3, 6, 12].every(staerkeInLeiste)).toBe(true)
    expect(staerkeInLeiste(9)).toBe(false)
  })
})

// ---------- Bedienung ----------
const flaeche = () => screen.getByTestId('zeichenflaeche')
function ziehe(von: [number, number], nach: [number, number]) {
  const basis = { pointerId: 1, pointerType: 'mouse', button: 0 }
  fireEvent.pointerDown(flaeche(), { ...basis, clientX: von[0], clientY: von[1] })
  fireEvent.pointerMove(flaeche(), { ...basis, clientX: (von[0] + nach[0]) / 2, clientY: (von[1] + nach[1]) / 2 })
  fireEvent.pointerMove(flaeche(), { ...basis, clientX: nach[0], clientY: nach[1] })
  fireEvent.pointerUp(flaeche(), { ...basis, clientX: nach[0], clientY: nach[1] })
}
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const seite = async () => (await ladeLetzteTafel())!.seiten[0].elemente
const knopf = (name: string) => screen.getByRole('button', { name })
const mehr = () => knopf('Mehr Farben und Stärken')
const feld = () => screen.queryByRole('dialog', { name: 'Mehr Farben und Stärken' })
const imFeld = () => within(feld()!)
const strich: Strich = { art: 'strich', id: 's', werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, 50, 0.5], [300, 50, 0.5]] }

describe('Feld „Mehr“ – Bedienung', () => {
  it('Farbe aus der Palette: gilt für Neues und für die Auswahl (ein Schritt); die Leiste zeigt sie an „Mehr“', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([strich])] })
    render(<Tafel />)
    await bereit()
    expect(mehr()).toHaveAttribute('aria-pressed', 'false')
    await nutzer.click(knopf('Auswahl'))
    await nutzer.keyboard('{Control>}a{/Control}')
    await nutzer.click(mehr())
    expect(feld()).not.toBeNull()
    await nutzer.click(imFeld().getByRole('button', { name: 'Violett' }))
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ id: 's', farbe: '#6a1b9a' }))
    expect(mehr()).toHaveAttribute('aria-pressed', 'true')
    const leiste = within(screen.getByRole('group', { name: 'Farbe' }))
    expect(leiste.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')).toEqual([mehr()])
    await nutzer.click(knopf('Stift'))
    expect(feld()).toBeNull()
    ziehe([0, 200], [200, 200])
    await waitFor(async () => expect(await seite()).toHaveLength(2))
    expect((await seite())[1]).toMatchObject({ farbe: '#6a1b9a', staerke: 6 })
    await nutzer.click(knopf('Rückgängig'))
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect(await seite()).toEqual([strich]))
  })

  it('Farbwähler des Geräts: die Farbe wird gewählt und als eigener Platz gemerkt – auch nach dem Neuladen', async () => {
    const nutzer = userEvent.setup()
    await merkeFarbplaetze(['#00ff00'])
    const { unmount } = render(<Tafel />)
    await bereit()
    await nutzer.click(mehr())
    expect(imFeld().getByRole('button', { name: 'Eigene Farbe #00ff00' })).toBeInTheDocument()
    fireEvent.change(imFeld().getByLabelText('Farbe frei wählen'), { target: { value: '#123abc' } })
    await waitFor(async () => expect(await ladeFarbplaetze()).toEqual(['#123abc', '#00ff00']))
    expect(imFeld().getByRole('button', { name: 'Eigene Farbe #123abc' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.pointerDown(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 600, clientY: 600 })
    fireEvent.pointerUp(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 600, clientY: 600 })
    expect(feld()).toBeNull() // Antippen der Tafel schließt
    ziehe([0, 100], [200, 100])
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ farbe: '#123abc' }))
    unmount()
    render(<Tafel />)
    await bereit()
    await nutzer.click(mehr())
    expect(imFeld().getAllByRole('button', { name: /^Eigene Farbe/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Eigene Farbe #123abc', 'Eigene Farbe #00ff00'])
    await nutzer.keyboard('{Escape}')
    expect(feld()).toBeNull()
  })

  it('Regler: Zwischenwert gilt für Neues und für die Auswahl; dann ist keiner der drei Knöpfe gedrückt', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([strich])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    await nutzer.keyboard('{Control>}a{/Control}')
    await nutzer.click(mehr())
    fireEvent.change(imFeld().getByRole('slider', { name: 'Strichstärke' }), { target: { value: '9' } })
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ id: 's', staerke: 9 }))
    expect(imFeld().getByText('9')).toBeInTheDocument()
    for (const name of ['Strichstärke fein', 'Strichstärke mittel', 'Strichstärke breit']) expect(knopf(name)).toHaveAttribute('aria-pressed', 'false')
    expect(mehr()).toHaveAttribute('aria-pressed', 'true')
    await nutzer.click(knopf('Stift'))
    ziehe([0, 200], [200, 200])
    await waitFor(async () => expect((await seite())[1]).toMatchObject({ staerke: 9 }))
    await nutzer.click(knopf('Strichstärke mittel'))
    expect(mehr()).toHaveAttribute('aria-pressed', 'false')
  })
})
