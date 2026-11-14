import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { drehBasis, drehwinkel, griffe, nurEcken, rasteWinkel } from '../kern/auswahl.ts'
import { beruehrtRechteck, dreieckPunkte, drehePunkt, gedreht, rahmen, skaliert, trifft } from '../kern/geometrie.ts'
import { neueSeite, neuesTafelbild, normiereWinkel, pruefeTafel, type Bild, type Form, type Strich, type Text } from '../kern/modell.ts'
import { kopie } from '../kern/seiten.ts'
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

const text = (mehr: Partial<Text> = {}): Text => ({ art: 'text', id: 't', x: 0, y: 0, text: 'Herz', groesse: 40, farbe: '#111111', ...mehr })
const form = (f: Form['form'], mehr: Partial<Form> = {}): Form => ({ art: 'form', id: 'f', form: f, x1: 0, y1: 0, x2: 100, y2: 60, farbe: '#c62828', staerke: 4, ...mehr })
const strich: Strich = { art: 'strich', id: 's', werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, 0, 0.5], [100, 0, 0.5]] }
const bild: Bild = { art: 'bild', id: 'b', x: 0, y: 0, b: 200, h: 100, dateiId: 'abcdef12' }
const nahe = (a: number[], b: number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 6))

describe('Drehen – Logik', () => {
  it('rechnet Winkel in Grad, im Uhrzeigersinn, auf -180 bis 180', () => {
    expect(normiereWinkel(190)).toBe(-170)
    expect(normiereWinkel(-180)).toBe(180)
    expect(normiereWinkel(540)).toBe(180)
    expect(normiereWinkel(-30)).toBe(-30)
    nahe(drehePunkt(10, 0, 0, 0, 90), [0, 10]) // nach rechts → nach unten
  })

  it('dreht Striche und Linien über ihre Punkte, ohne eigenen Winkel', () => {
    const s = gedreht(strich, 50, 0, 90)
    nahe(s.punkte[0], [50, -50, 0.5])
    nahe(s.punkte[1], [50, 50, 0.5])
    const l = gedreht(form('linie'), 0, 0, 180)
    nahe([l.x1, l.y1, l.x2, l.y2], [0, 0, -100, -60])
    expect(l.drehung).toBeUndefined()
  })

  it('dreht Text um die Mitte: er steht danach hochkant an derselben Stelle', () => {
    // „Herz“ in 40 ist geschätzt 88 × 50 groß, Mitte (44, 25)
    const t = gedreht(text(), 44, 25, 90)
    expect(t.drehung).toBe(90)
    nahe([t.x, t.y], [69, -19])
    nahe(rahmen(t), [19, -19, 69, 69])
    const zurueck = gedreht(t, 44, 25, -90)
    expect(zurueck.drehung).toBeUndefined() // 0 wird nicht gespeichert
    nahe([zurueck.x, zurueck.y], [0, 0])
  })

  it('Rechteck, Ellipse, Bild und Dreieck behalten ihre Maße und merken sich den Winkel', () => {
    const r = gedreht(form('rechteck'), 50, 30, 90)
    expect(r).toMatchObject({ x1: 0, y1: 0, x2: 100, y2: 60, drehung: 90 })
    nahe(rahmen(r), [18, -22, 82, 82]) // 60 × 100 um die Mitte, plus halbe Strichstärke
    nahe(rahmen(gedreht(form('ellipse'), 50, 30, 90)), [18, -22, 82, 82])
    const b = gedreht(bild, 100, 50, 180)
    nahe([b.x, b.y], [200, 100])
    nahe(rahmen(b), [0, 0, 200, 100])
    expect(gedreht(form('dreieck'), 0, 0, 30).drehung).toBe(30)
    expect(gedreht(form('rechteck', { drehung: 170 }), 50, 30, 20).drehung).toBe(-170)
  })

  it('Radierer und Auswahl treffen gedrehte Elemente dort, wo sie zu sehen sind', () => {
    const t = gedreht(text(), 44, 25, 90)
    expect(trifft(t, 40, 60, 0)).toBe(true)
    expect(trifft(t, 80, 10, 0)).toBe(false) // dort stand der Text vor dem Drehen
    const r = gedreht(form('rechteck'), 50, 30, 90)
    expect(trifft(r, 20, 30, 0)).toBe(true) // neuer linker Rand
    expect(trifft(r, 0, 30, 0)).toBe(false) // alter linker Rand
    expect(trifft(r, 50, 30, 0)).toBe(false) // Inneres bleibt frei
    expect(beruehrtRechteck(t, [30, 40, 35, 45])).toBe(true) // Rahmen ganz im gedrehten Text
    expect(beruehrtRechteck(t, [70, 0, 90, 20])).toBe(false)
    expect(beruehrtRechteck(r, [15, 25, 25, 35])).toBe(true)
    expect(beruehrtRechteck(r, [-5, 25, 5, 35])).toBe(false)
  })

  it('Dreieck: Grundseite unten, Spitze an der gewählten Stelle; getroffen wird der Rand', () => {
    nahe(dreieckPunkte(form('dreieck')).flat(), [0, 60, 100, 60, 50, 0])
    nahe(dreieckPunkte(form('dreieck', { spitze: 0 })).flat(), [0, 60, 100, 60, 0, 0])
    expect(trifft(form('dreieck'), 25, 30, 1)).toBe(true) // linke Seite
    expect(trifft(form('dreieck'), 50, 40, 1)).toBe(false) // innen
    expect(rahmen(form('dreieck'))).toEqual([-2, -2, 102, 62])
  })

  it('gedrehte Formen haben nur Eckgriffe; gleichmäßiges Strecken behält Winkel und Mitte im Verhältnis', () => {
    expect(nurEcken([strich, form('rechteck', { drehung: 30 })])).toBe(true)
    expect(nurEcken([strich, form('linie')])).toBe(false)
    const r = skaliert(form('rechteck', { drehung: 30 }), 0, 0, 2, 2, true)
    expect(r).toMatchObject({ x1: 0, y1: 0, x2: 200, y2: 120, drehung: 30, staerke: 8 })
    expect(griffe([0, 0, 200, 100], 1, nurEcken([form('rechteck', { drehung: 30 })])).map((g) => g.name)).toEqual(['nw', 'no', 'so', 'sw', 'drehen'])
  })

  it('rastet bei 0°, 45°, 90° … ein, mit Umschalt in 15°-Schritten', () => {
    expect(rasteWinkel(43, false)).toBe(45)
    expect(rasteWinkel(39, false)).toBe(39)
    expect(rasteWinkel(-178, false)).toBe(180)
    expect(rasteWinkel(100, true)).toBe(105)
    expect(drehwinkel(0, 0, 10, 0, 0, 10, 0, false)).toBeCloseTo(90) // von rechts nach unten
    expect(drehwinkel(0, 0, 0, -10, -10, 0, 0, false)).toBeCloseTo(-90)
    // Ein Bild, das schon um 30° steht, rastet bei 45° (gesamt) ein, nicht bei 45° Drehung
    const roh12 = [Math.cos((12 * Math.PI) / 180) * 10, Math.sin((12 * Math.PI) / 180) * 10]
    expect(drehwinkel(0, 0, 10, 0, roh12[0], roh12[1], 30, false)).toBeCloseTo(15)
    expect(drehBasis([form('rechteck', { drehung: 30 })])).toBe(30)
    expect(drehBasis([form('rechteck', { drehung: 30 }), strich])).toBe(0)
  })
})

describe('Datenmodell Version 3', () => {
  it('übernimmt Version 2 unverändert und speichert in der aktuellen Version', () => {
    const t = pruefeTafel({ ...neuesTafelbild(), version: 2, seiten: [{ id: 's', elemente: [text(), form('rechteck')] }] })!
    expect(t.version).toBe(6)
    expect(t.seiten[0].elemente).toEqual([text(), form('rechteck')])
  })

  it('prüft Drehung, Gruppe und Dreieck', () => {
    const t = pruefeTafel({
      ...neuesTafelbild(),
      seiten: [
        {
          id: 's',
          elemente: [
            text({ drehung: 370, gruppe: 'g1' }),
            form('rechteck', { drehung: 0 }),
            { ...form('linie'), id: 'l', drehung: 45 },
            { ...form('dreieck'), id: 'd', spitze: 2, drehung: -90 },
            { ...bild, drehung: 'schief', gruppe: 7 },
            { ...strich, drehung: 30, gruppe: 'g1' },
            { ...form('stern' as Form['form']), id: 'x' },
          ],
        },
      ],
    })!
    const [tx, r, l, d, b, s, ...rest] = t.seiten[0].elemente
    expect(tx).toMatchObject({ drehung: 10, gruppe: 'g1' })
    expect(r).not.toHaveProperty('drehung') // 0 wird nicht gespeichert
    expect(l).not.toHaveProperty('drehung') // Linien drehen über ihre Punkte
    expect(d).toMatchObject({ form: 'dreieck', spitze: 1, drehung: -90 })
    expect(b).not.toHaveProperty('drehung')
    expect(b).not.toHaveProperty('gruppe')
    expect(s).toMatchObject({ gruppe: 'g1' })
    expect(s).not.toHaveProperty('drehung')
    expect(rest).toEqual([])
  })

  it('Kopien behalten Drehung und Spitze', () => {
    expect(kopie(form('dreieck', { drehung: 20, spitze: 0.3 }), 10, 0)).toMatchObject({ x1: 10, drehung: 20, spitze: 0.3 })
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
const tippe = (x: number, y: number) => {
  fireEvent.pointerDown(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
  fireEvent.pointerUp(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
}
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const tafel = async () => (await ladeLetzteTafel())!
const seite = async () => (await tafel()).seiten[0].elemente
const knopf = (name: string) => screen.getByRole('button', { name })

describe('Drehen – Bedienung', () => {
  it('der Drehgriff dreht um die Mitte, rastet bei 90° ein; ein Schritt im Verlauf', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([form('rechteck', { x1: 100, y1: 100, x2: 300, y2: 200 })])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    tippe(100, 150)
    // Rahmen 92..308 × 92..208, Mitte (200, 150): Drehgriff 48 px über der Oberkante bei (200, 44)
    ziehe([200, 44], [303, 147]) // fast genau nach rechts: 88,3° → rastet bei 90° ein
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ x1: 100, y1: 100, x2: 300, y2: 200, drehung: 90 }))
    expect((await tafel()).version).toBe(6)
    tippe(100, 150) // dort war der linke Rand – nach dem Drehen ist da nichts
    expect(knopf('Seite leeren')).toBeInTheDocument()
    tippe(200, 50) // jetzt liegt dort die obere Schmalseite
    expect(knopf('Auswahl löschen')).toBeInTheDocument()
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect((await seite())[0]).not.toHaveProperty('drehung'))
  })

  it('gedrehter Text lässt sich weiter ändern und bleibt gedreht', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([text({ x: 300, y: 300, drehung: 90 })])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    // um 90° um die linke obere Ecke (300, 300) gedreht: liegt jetzt bei x 250..300, y 300..388
    tippe(275, 340)
    tippe(275, 340)
    const feld = screen.getByRole('textbox', { name: 'Text auf der Tafel' })
    await nutzer.type(feld, 'schlag')
    tippe(700, 100)
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ text: 'Herzschlag', drehung: 90, x: 300, y: 300 }))
  })
})
