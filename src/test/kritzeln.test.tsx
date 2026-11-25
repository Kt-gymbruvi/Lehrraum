// Kritzeln zum Löschen und Fenster in der Mitte
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mittig, schalte } from '../kern/fenster.ts'
import { istKritzeln, kritzelZiele } from '../kern/kritzeln.ts'
import { neueSeite, neuesTafelbild, type Bild, type Element, type Punkt, type Strich, type Text } from '../kern/modell.ts'
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

const strich = (id: string, punkte: Punkt[], mehr: Partial<Strich> = {}): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#111111', staerke: 4, druckEcht: false, punkte, ...mehr })

/** Zickzack: `beine` Teilstücke der Länge `laenge` waagerecht hin und her, je Teilstück `drift` nach unten, ab (x, y) */
function zickzack(x: number, y: number, beine: number, laenge: number, drift: number, winkel = 0): Punkt[] {
  const p: Punkt[] = []
  const [c, s] = [Math.cos((winkel * Math.PI) / 180), Math.sin((winkel * Math.PI) / 180)]
  for (let b = 0; b < beine; b++) {
    for (let i = 0; i <= 10; i++) {
      const u = b % 2 === 0 ? (i / 10) * laenge : laenge - (i / 10) * laenge
      const v = (b + i / 10) * drift
      p.push([x + u * c - v * s, y + u * s + v * c, 0.5])
    }
  }
  return p
}

describe('Kritzeln – Erkennen', () => {
  it('oft hin und her durchgestrichen ist ein Kritzeln – auch schräg', () => {
    expect(istKritzeln(strich('k', zickzack(0, 0, 6, 100, 4)))).toBe(true)
    expect(istKritzeln(strich('k', zickzack(0, 0, 7, 80, 5, 35)))).toBe(true)
    expect(istKritzeln(strich('k', zickzack(0, 0, 6, 50, 3, 90)))).toBe(true)
  })

  it('normale Striche, Schrift und kleine Zeichen sind kein Kritzeln', () => {
    expect(istKritzeln(strich('l', [[0, 0, 0.5], [50, 0, 0.5], [100, 0, 0.5], [150, 0, 0.5], [200, 0, 0.5], [250, 0, 0.5], [300, 0, 0.5], [350, 0, 0.5]]))).toBe(false)
    // Kreis
    const kreis = Array.from({ length: 60 }, (_, i): Punkt => [100 + 50 * Math.cos(i / 6), 100 + 50 * Math.sin(i / 6), 0.5])
    expect(istKritzeln(strich('o', kreis))).toBe(false)
    // „mmmm“ in Schreibschrift: Bögen, die nach rechts weiterlaufen
    const mmmm = Array.from({ length: 160 }, (_, i): Punkt => [i, 30 - 30 * Math.abs(Math.sin((i / 160) * 8 * Math.PI)), 0.5])
    expect(istKritzeln(strich('m', mmmm))).toBe(false)
    // nur zweimal hin und her
    expect(istKritzeln(strich('z', zickzack(0, 0, 3, 100, 4)))).toBe(false)
    // zu klein (ein kleines Zeichen)
    expect(istKritzeln(strich('k', zickzack(0, 0, 6, 15, 1)))).toBe(false)
    // beim Hineinzoomen ist dasselbe Gekritzel auf dem Bildschirm groß genug
    expect(istKritzeln(strich('k', zickzack(0, 0, 6, 15, 1)), 4)).toBe(true)
    // gefüllte Flächen sind nie Kritzeln
    expect(istKritzeln(strich('f', zickzack(0, 0, 6, 100, 4), { flaeche: true }))).toBe(false)
  })
})

describe('Kritzeln – was gelöscht wird', () => {
  const wort = strich('w', [[20, 10, 0.5], [40, 0, 0.5], [60, 20, 0.5], [80, 5, 0.5]])
  const text: Text = { art: 'text', id: 't', x: 10, y: 0, text: 'Herz', groesse: 20, farbe: '#111111' }
  const langeLinie = strich('lang', [[-500, 12, 0.5], [600, 12, 0.5]])
  const daneben = strich('daneben', [[400, 400, 0.5], [450, 420, 0.5]])
  const bild: Bild = { art: 'bild', id: 'b', x: 0, y: 0, b: 100, h: 30, dateiId: 'abcd1234' }
  const kritzel = strich('k', zickzack(0, 0, 8, 100, 4))

  it('löscht, was unter dem Gekritzel liegt; durchkreuzte lange Linien, Entferntes und Bilder bleiben', () => {
    const elemente: Element[] = [bild, wort, text, langeLinie, daneben]
    expect(kritzelZiele(kritzel, elemente)).toEqual(['w', 't'])
  })

  it('trifft das Gekritzel nichts, bleibt es ein Strich', () => {
    expect(kritzelZiele(kritzel, [daneben])).toEqual([])
    expect(kritzelZiele(strich('s', [[0, 0, 0.5], [100, 0, 0.5]]), [wort])).toEqual([]) // kein Kritzeln
  })
})

describe('Fenster in der Mitte', () => {
  it('neue Fenster liegen mittig, leicht versetzt, und passen auf die Fläche', () => {
    const l = schalte(schalte([], 'uhr'), 'timer')
    expect(l.map((f) => f.mitte)).toEqual([0, 28])
    expect(mittig(1000, 800, 200, 100)).toEqual([400, 350])
    expect(mittig(1000, 800, 200, 100, 28)).toEqual([428, 378])
    expect(mittig(300, 200, 400, 300)).toEqual([8, 8]) // größer als die Fläche: oben links
  })
})

// ---------- Bedienung ----------
const flaeche = () => screen.getByTestId('zeichenflaeche')
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const seite = async () => (await ladeLetzteTafel())!.seiten[0].elemente

function zeichne(punkte: Punkt[]) {
  const basis = { pointerId: 1, pointerType: 'mouse', button: 0 }
  fireEvent.pointerDown(flaeche(), { ...basis, clientX: punkte[0][0], clientY: punkte[0][1] })
  for (const [x, y] of punkte.slice(1)) fireEvent.pointerMove(flaeche(), { ...basis, clientX: x, clientY: y })
  const [x, y] = punkte[punkte.length - 1]
  fireEvent.pointerUp(flaeche(), { ...basis, clientX: x, clientY: y })
}

describe('Kritzeln – in der Tafel', () => {
  it('Durchkritzeln löscht das Geschriebene und das Gekritzel in einem Schritt; Rückgängig holt es zurück', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([strich('a', [[120, 110, 0.5], [160, 100, 0.5], [200, 115, 0.5]]), strich('b', [[400, 400, 0.5], [450, 400, 0.5]])])] })
    render(<Tafel />)
    await bereit()
    zeichne(zickzack(100, 95, 8, 120, 3))
    await waitFor(async () => expect((await seite()).map((e) => e.id)).toEqual(['b']))
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect((await seite()).map((e) => e.id)).toEqual(['a', 'b']))
  })

  it('ein Zickzack auf leerer Fläche bleibt ein Strich', async () => {
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([])] })
    render(<Tafel />)
    await bereit()
    zeichne(zickzack(100, 300, 8, 120, 3))
    await waitFor(async () => expect(await seite()).toHaveLength(1))
  })
})
