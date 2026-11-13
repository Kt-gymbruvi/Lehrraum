import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { auswahlRahmen, griffBei, griffe, GRIFF_TREFFER, nurEcken, skalierung } from '../kern/auswahl.ts'
import { beruehrtRechteck, skaliert, streckeBeruehrt } from '../kern/geometrie.ts'
import { neueSeite, neuesTafelbild, type Bild, type Form, type Strich, type Text } from '../kern/modell.ts'
import { ladeLetzteTafel, speichereTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

const strich = (id: string, y = 0, x = 0): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[x, y, 0.5], [x + 100, y, 0.5]] })
const text = (id: string, mehr: Partial<Text> = {}): Text => ({ art: 'text', id, x: 600, y: 100, text: 'Herz', groesse: 40, farbe: '#111111', ...mehr })
const form = (id: string, f: Form['form'], mehr: Partial<Form> = {}): Form => ({ art: 'form', id, form: f, x1: 300, y1: 300, x2: 400, y2: 400, farbe: '#c62828', staerke: 4, ...mehr })
const bild: Bild = { art: 'bild', id: 'b', x: 0, y: 0, b: 200, h: 100, dateiId: 'abcdef12' }

describe('Auswahl – Logik', () => {
  it('erkennt, ob eine Strecke ein Rechteck berührt', () => {
    expect(streckeBeruehrt(-10, 5, 30, 5, [0, 0, 10, 10])).toBe(true) // quer hindurch, beide Enden draußen
    expect(streckeBeruehrt(-10, -10, 30, -1, [0, 0, 10, 10])).toBe(false)
    expect(streckeBeruehrt(2, 2, 3, 3, [0, 0, 10, 10])).toBe(true) // ganz innen
    expect(streckeBeruehrt(-5, 20, 20, -5, [0, 0, 10, 10])).toBe(true) // schräg über die Ecke
    expect(streckeBeruehrt(-5, 30, 30, -5, [0, 0, 10, 10])).toBe(false) // schräg daran vorbei
  })

  it('wählt, was der Rahmen berührt – auch ohne es ganz zu umschließen', () => {
    expect(beruehrtRechteck(strich('s', 50), [40, 0, 60, 200])).toBe(true) // schneidet den Strich nur in der Mitte
    expect(beruehrtRechteck(strich('s', 50), [40, 60, 60, 200])).toBe(false) // knapp darunter (Breite 6 → bis 53)
    expect(beruehrtRechteck(strich('s', 50), [40, 52, 60, 200])).toBe(true) // berührt den Rand der Linie
    expect(beruehrtRechteck(form('r', 'rechteck'), [320, 320, 380, 380])).toBe(false) // nur im leeren Inneren
    expect(beruehrtRechteck(form('r', 'rechteck'), [390, 320, 420, 380])).toBe(true) // über den rechten Rand
    expect(beruehrtRechteck(form('e', 'ellipse'), [300, 300, 310, 310])).toBe(false) // Ecke außerhalb des Bogens
    expect(beruehrtRechteck(form('e', 'ellipse'), [345, 290, 355, 305])).toBe(true) // oberer Scheitel
    expect(beruehrtRechteck(text('t'), [650, 120, 700, 130])).toBe(true)
    expect(beruehrtRechteck(bild, [190, 90, 300, 300])).toBe(true)
  })

  it('streckt Elemente um einen festen Punkt; Strichstärke nur beim gleichmäßigen Strecken', () => {
    const s = skaliert(strich('s', 50), 0, 0, 2, 2, true)
    expect(s.punkte.map(([x, y]) => [x, y])).toEqual([[0, 100], [200, 100]])
    expect(s.staerke).toBe(12)
    expect(skaliert(strich('s', 50), 0, 0, 2, 1, false)).toMatchObject({ staerke: 6, punkte: [[0, 50, 0.5], [200, 50, 0.5]] })
    expect(skaliert(form('f', 'linie'), 300, 300, 0.5, 0.5, true)).toMatchObject({ x1: 300, y1: 300, x2: 350, y2: 350, staerke: 2 })
    expect(skaliert(text('t'), 600, 100, 1.5, 1.5, true)).toMatchObject({ x: 600, y: 100, groesse: 60 })
    expect(skaliert(bild, 200, 100, 0.5, 0.5, true)).toMatchObject({ x: 100, y: 50, b: 100, h: 50 })
    expect(skaliert(text('t'), 0, 0, 100, 100, true).groesse).toBe(400) // Grenze der Prüfung
  })

  it('setzt Ecken- und Seitengriffe; bei kleiner Auswahl nur Ecken, nach außen gerückt', () => {
    const gross = griffe([0, 0, 200, 100], 1, false)
    expect(gross.map((g) => g.name)).toEqual(['nw', 'no', 'so', 'sw', 'n', 'o', 's', 'w', 'drehen'])
    expect(gross.find((g) => g.name === 'o')).toMatchObject({ x: 200, y: 50 })
    expect(gross.find((g) => g.name === 'drehen')).toMatchObject({ x: 100, y: -48 }) // 48 px über der Oberkante
    expect(griffe([0, 0, 200, 100], 1, true)).toHaveLength(5) // Text oder Bild in der Auswahl: Ecken und Drehgriff
    expect(griffe([0, 0, 200, 60], 1, false)).toHaveLength(5) // zu flach für Seitengriffe
    const klein = griffe([0, 0, 10, 10], 1, false)
    // 44 px Abstand; der Drehgriff 48 px über den nach außen gerückten Ecken
    expect(klein.map((g) => [g.x, g.y])).toEqual([[-17, -17], [27, -17], [27, 27], [-17, 27], [5, -65]])
    // beim Hineinzoomen genügt in Tafel-Einheiten weniger Abstand
    expect(griffe([0, 0, 50, 50], 2, false)).toHaveLength(9)
    expect(nurEcken([strich('s'), text('t')])).toBe(true)
    expect(nurEcken([strich('s'), form('f', 'pfeil')])).toBe(false)
  })

  it('jeder Griff ist auf mindestens 44 px greifbar, auch wenn er kleiner gezeichnet ist', () => {
    const g = griffe([0, 0, 200, 100], 1, false)
    expect(griffBei(g, 200 + 20, 50 - 20, 1)?.name).toBe('o')
    expect(griffBei(g, 200 + GRIFF_TREFFER / 2 + 2, 50, 1)).toBeNull()
    expect(griffBei(g, 200 + 20, 50, 2)).toBeNull() // bei Zoom 2 sind 20 Einheiten 40 px
    expect(griffBei(g, 3, 4, 1)?.name).toBe('nw')
    expect(auswahlRahmen([0, 0, 10, 10], 2)).toEqual([-3, -3, 13, 13])
  })

  it('Eckgriffe behalten das Verhältnis, Seitengriffe strecken in eine Richtung, nichts wird umgestülpt', () => {
    const inhalt: [number, number, number, number] = [0, 0, 200, 100]
    expect(skalierung('so', inhalt, 200, 100)).toEqual({ ax: 0, ay: 0, sx: 2, sy: 2, gleichmaessig: true })
    expect(skalierung('so', inhalt, 200, 0).sx).toBeCloseTo(1.8) // der Zug wird auf die Diagonale übertragen
    expect(skalierung('nw', inhalt, -200, -100)).toMatchObject({ ax: 200, ay: 100, sx: 2 })
    expect(skalierung('o', inhalt, 100, 40)).toEqual({ ax: 0, ay: 50, sx: 1.5, sy: 1, gleichmaessig: false })
    expect(skalierung('n', inhalt, 0, 50)).toMatchObject({ ay: 100, sx: 1, sy: 0.5 })
    expect(skalierung('so', inhalt, -1000, -1000).sx).toBeCloseTo(8 / 200) // höchstens bis 8 Einheiten klein
    expect(skalierung('w', inhalt, 1000, 0).sx).toBeCloseTo(8 / 200)
    expect(skalierung('so', [0, 0, 4, 4], -10, -10).sx).toBe(1) // schon Winziges wird nicht noch kleiner
  })
})

// ---------- Bedienung ----------
const flaeche = () => screen.getByTestId('zeichenflaeche')
function ziehe(von: [number, number], nach: [number, number], mehr: Record<string, unknown> = {}) {
  const basis = { pointerId: 1, pointerType: 'mouse', button: 0, ...mehr }
  fireEvent.pointerDown(flaeche(), { ...basis, clientX: von[0], clientY: von[1] })
  fireEvent.pointerMove(flaeche(), { ...basis, clientX: (von[0] + nach[0]) / 2, clientY: (von[1] + nach[1]) / 2 })
  fireEvent.pointerMove(flaeche(), { ...basis, clientX: nach[0], clientY: nach[1] })
  fireEvent.pointerUp(flaeche(), { ...basis, clientX: nach[0], clientY: nach[1] })
}
const tippe = (x: number, y: number, mehr: Record<string, unknown> = {}) => {
  fireEvent.pointerDown(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y, ...mehr })
  fireEvent.pointerUp(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y, ...mehr })
}
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const tafel = async () => (await ladeLetzteTafel())!
const seite = async () => (await tafel()).seiten[0].elemente
const knopf = (name: string) => screen.getByRole('button', { name })
const ids = async () => (await seite()).map((e) => e.id)

describe('Auswahl – Bedienung', () => {
  const vorlage = () =>
    speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([strich('a', 50), strich('b', 150), form('r', 'rechteck'), text('t')])] })

  it('ein Rahmen wählt, was er berührt; Antippen einer freien Stelle hebt die Auswahl auf', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    ziehe([50, 20], [60, 170]) // schmaler Rahmen quer über beide Striche
    expect(knopf('Auswahl löschen')).toBeInTheDocument()
    tippe(800, 600)
    expect(knopf('Seite leeren')).toBeInTheDocument()
    ziehe([320, 320], [380, 380]) // nur im leeren Inneren des Rechtecks: nichts
    expect(knopf('Seite leeren')).toBeInTheDocument()
    ziehe([50, 20], [395, 320]) // Striche und der obere Rand des Rechtecks, nicht der Text
    await nutzer.keyboard('{Delete}')
    await waitFor(async () => expect(await ids()).toEqual(['t']))
  })

  it('Umschalt + Antippen nimmt hinzu und heraus; Strg + A wählt alles; Escape hebt auf', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    tippe(50, 50)
    tippe(50, 150, { shiftKey: true })
    tippe(300, 350, { shiftKey: true })
    tippe(50, 50, { shiftKey: true }) // wieder heraus
    await nutzer.keyboard('{Delete}')
    await waitFor(async () => expect(await ids()).toEqual(['a', 't']))

    await nutzer.click(knopf('Stift'))
    await nutzer.keyboard('{Control>}a{/Control}')
    expect(knopf('Auswahl')).toHaveAttribute('aria-pressed', 'true')
    await nutzer.keyboard('{Escape}')
    expect(knopf('Seite leeren')).toBeInTheDocument()
    await nutzer.keyboard('{Control>}a{/Control}{Delete}')
    await waitFor(async () => expect(await ids()).toEqual([]))
  })

  it('Ziehen irgendwo im Auswahlrahmen verschiebt die ganze Auswahl in einem Schritt', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    ziehe([50, 20], [60, 170])
    ziehe([80, 100], [130, 140]) // zwischen den beiden Strichen, auf keinem davon
    await waitFor(async () => expect(((await seite())[1] as Strich).punkte[0]).toEqual([50, 190, 0.5]))
    expect(((await seite())[0] as Strich).punkte[0]).toEqual([50, 90, 0.5])
    expect((await seite())[2]).toMatchObject({ x1: 300 }) // nicht ausgewählt
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect(((await seite())[0] as Strich).punkte[0]).toEqual([0, 50, 0.5]))
    expect(((await seite())[1] as Strich).punkte[0]).toEqual([0, 150, 0.5])
  })

  it('Eckgriff vergrößert gleichmäßig samt Strichstärke, Seitengriff streckt ohne sie; je ein Schritt', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([form('r', 'rechteck', { x1: 100, y1: 100, x2: 300, y2: 200 })])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    tippe(100, 150)
    // Inhalt 98..302 × 98..202, Rahmen 6 px weiter: Eckgriff unten rechts bei (308, 208)
    ziehe([312, 212], [414, 264])
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ x1: 101, y1: 101, x2: 401, y2: 251, staerke: 6 }))
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ x2: 300, staerke: 4 }))
    ziehe([308, 150], [408, 150]) // Seitengriff rechts
    const sx = 1 + 100 / 204 // der linke Rand des Inhalts (98) bleibt stehen
    await waitFor(async () => expect(((await seite())[0] as Form).x2).toBeCloseTo(98 + 202 * sx))
    expect((await seite())[0]).toMatchObject({ y1: 100, y2: 200, staerke: 4 })
    expect(((await seite())[0] as Form).x1).toBeCloseTo(98 + 2 * sx)
  })

  it('Text wird am Eckgriff größer und bleibt Text; Seitengriffe gibt es dann nicht', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([text('t', { x: 100, y: 100, groesse: 40 })])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    tippe(120, 120)
    // Text „Herz“ (geschätzt 88 × 50): Rahmen 94..194 × 94..156, Ecke unten rechts (194, 156)
    ziehe([194, 156], [194 + 88, 156 + 50])
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ art: 'text', text: 'Herz', x: 100, y: 100, groesse: 80 }))
    ziehe([200, 125], [260, 125]) // dort wäre ein Seitengriff: verschiebt stattdessen
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ x: 160, groesse: 80 }))
  })

  it('mit gehaltener Leertaste verschiebt jedes Werkzeug die Ansicht, statt zu zeichnen', async () => {
    render(<Tafel />)
    await bereit()
    fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    ziehe([100, 100], [150, 120])
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })
    await waitFor(async () => expect((await tafel()).kamera).toEqual({ x: 50, y: 20, zoom: 1 }))
    ziehe([100, 300], [200, 300])
    await waitFor(async () => expect(await seite()).toHaveLength(1)) // danach zeichnet der Stift wieder
  })
})
