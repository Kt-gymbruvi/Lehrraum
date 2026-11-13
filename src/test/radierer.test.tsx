// Etappe 3, Teil 1: Schwamm und Element-Radierer (R1), Teilstücke (R2), drei Größen (R3)
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { anwenden, zuruecknehmen } from '../kern/befehle.ts'
import { neueSeite, neuesTafelbild, type Element, type Form, type Strich, type Text } from '../kern/modell.ts'
import { beginneWischzug, wischBefehl, wische, wischeWeiter } from '../kern/radieren.ts'
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

const strich = (id: string, punkte: Strich['punkte'], mehr: Partial<Strich> = {}): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#c62828', staerke: 6, druckEcht: false, punkte, ...mehr })
const waagrecht = (id: string, y: number, bis = 200) => strich(id, [[0, y, 0.5], [bis / 2, y, 0.5], [bis, y, 0.5]])
const text: Text = { art: 'text', id: 't', x: 0, y: 200, text: 'Herz', groesse: 40, farbe: '#111111' }
const form: Form = { art: 'form', id: 'f', form: 'rechteck', x1: 0, y1: 300, x2: 100, y2: 360, farbe: '#c62828', staerke: 4 }
const ids = (l: Element[]) => l.map((e) => e.id)
const xs = (s: Strich) => s.punkte.map((p) => Math.round(p[0] * 100) / 100)

describe('Schwamm – Logik', () => {
  it('teilt einen in der Mitte überwischten Strich in zwei Striche gleicher Farbe und Stärke', () => {
    const s = waagrecht('s', 0)
    const teile = wische(s, 100, 0, 100, 0, 10)! // Grenze: Radius 10 + halbe Strichbreite 3
    expect(teile).toHaveLength(2)
    expect(xs(teile[0])).toEqual([0, 87])
    expect(xs(teile[1])).toEqual([113, 200])
    for (const t of teile) {
      expect(t).toMatchObject({ art: 'strich', werkzeug: 'stift', farbe: '#c62828', staerke: 6, druckEcht: false })
      expect(t.id).not.toBe('s')
    }
    expect(teile[0].id).not.toBe(teile[1].id)
  })

  it('lässt unberührte und nur gestreifte Striche in Ruhe', () => {
    const s = waagrecht('s', 0)
    expect(wische(s, 100, 50, 100, 50, 10)).toBeNull()
    expect(wische(s, 100, 13, 100, 13, 10)).toBeNull() // genau am Rand
    expect(wische(s, 100, 12, 100, 12, 10)).not.toBeNull()
  })

  it('wischt die ganze Bahn zwischen zwei Meldungen, auch bei schneller Bewegung', () => {
    const s = strich('s', [[0, 0, 0.5], [200, 0, 0.5]]) // eine lange Strecke ohne Zwischenpunkte
    const teile = wische(s, 100, -50, 100, 50, 10)!
    expect(teile.map(xs)).toEqual([[0, 87], [113, 200]])
  })

  it('lässt Reste verschwinden, die kürzer als die Strichbreite sind; ein Punkt verschwindet ganz', () => {
    expect(wische(strich('s', [[0, 0, 0.5], [20, 0, 0.5]]), 10, 0, 10, 0, 4)).toEqual([])
    expect(wische(strich('p', [[5, 5, 0.5]]), 5, 8, 5, 8, 4)).toEqual([])
    expect(wische(strich('p', [[5, 5, 0.5]]), 50, 50, 50, 50, 4)).toBeNull()
  })

  it('behält den Druck des Stifts an den Schnittenden und die Gruppe', () => {
    const s = strich('s', [[0, 0, 0], [100, 0, 1]], { druckEcht: true, gruppe: 'g' })
    const [erster, zweiter] = wische(s, 50, 0, 50, 0, 7)!
    const ende = erster.punkte[erster.punkte.length - 1]
    expect(ende[0]).toBeCloseTo(40)
    expect(ende[2]).toBeCloseTo(0.4)
    expect(zweiter.punkte[0][2]).toBeCloseTo(0.6)
    expect(erster.gruppe).toBe('g')
    expect(zweiter.gruppe).toBe('g')
  })

  it('rechnet beim Textmarker mit dessen breiterem Strich', () => {
    expect(wische(waagrecht('m', 0, 200), 100, 20, 100, 20, 10)).toBeNull()
    expect(wische({ ...waagrecht('m', 0, 200), werkzeug: 'marker' }, 100, 20, 100, 20, 10)).toHaveLength(2)
  })

  it('ein Wischzug wird ein Befehl: Teile an der alten Stelle, Zurücknehmen stellt alles her', () => {
    const vorher: Element[] = [waagrecht('a', 0), text, waagrecht('b', 100, 20), form]
    const z = beginneWischzug(vorher)
    expect(wischeWeiter(z, 50, -20, 50, 20, 10)).toBe(true) // a wird geteilt
    expect(wischeWeiter(z, 150, -20, 150, 20, 10)).toBe(true) // ein Teil von a noch einmal
    expect(wischeWeiter(z, 0, 210, 100, 210, 10)).toBe(false) // über den Text: bleibt
    expect(wischeWeiter(z, 0, 330, 100, 330, 30)).toBe(false) // über das Rechteck: bleibt
    expect(wischeWeiter(z, 0, 100, 20, 100, 10)).toBe(true) // b verschwindet ganz
    const b = wischBefehl(vorher, z)!
    expect(b.art).toBe('zerlegen')
    const nachher = anwenden(vorher, b)
    expect(nachher).toHaveLength(5)
    expect(nachher.slice(0, 3).map((e) => xs(e as Strich)[0])).toEqual([0, 63, 163]) // drei Reste von a, in Reihenfolge
    expect(ids(nachher.slice(3))).toEqual(['t', 'f']) // Text und Rechteck an ihrer Stelle, b ist weg
    expect(zuruecknehmen(nachher, b)).toEqual(vorher)
    expect(anwenden(zuruecknehmen(nachher, b), b)).toEqual(nachher) // Wiederholen
  })

  it('ohne Berührung entsteht kein Befehl', () => {
    const vorher: Element[] = [waagrecht('a', 0)]
    const z = beginneWischzug(vorher)
    expect(wischeWeiter(z, 0, 300, 100, 300, 10)).toBe(false)
    expect(wischBefehl(vorher, z)).toBeNull()
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
const feld = () => screen.queryByRole('dialog', { name: 'Art und Größe des Radierers' })
const vorlage = () => speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([waagrecht('a', 50, 300), text, form])] })

describe('Radierer – Bedienung', () => {
  it('der Schwamm ist voreingestellt: teilt den Strich, Text und Rechteck bleiben, ein Schritt zum Zurücknehmen', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Radierer'))
    ziehe([150, 20], [150, 80]) // quer über den Strich
    ziehe([50, 190], [50, 260]) // über den Text
    ziehe([50, 290], [50, 310]) // über den Rand des Rechtecks
    await waitFor(async () => expect(await seite()).toHaveLength(4))
    const [l, r, t, f] = await seite()
    expect([t.id, f.id]).toEqual(['t', 'f'])
    expect(xs(l as Strich)[0]).toBe(0)
    expect(xs(r as Strich).at(-1)).toBe(300)
    expect(l).toMatchObject({ farbe: '#c62828', staerke: 6 })
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect(ids(await seite())).toEqual(['a', 't', 'f']))
  })

  it('noch einmal antippen öffnet Art und Größe; Antippen der Tafel, Escape und ein anderes Werkzeug schließen', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Radierer'))
    expect(feld()).toBeNull()
    await nutzer.click(knopf('Radierer'))
    expect(feld()).not.toBeNull()
    expect(knopf('Schwamm')).toHaveAttribute('aria-pressed', 'true')
    expect(knopf('Radierer Mittel')).toHaveAttribute('aria-pressed', 'true')
    await nutzer.click(knopf('Radierer Groß'))
    expect(knopf('Radierer Groß')).toHaveAttribute('aria-pressed', 'true')
    expect(feld()).not.toBeNull() // bleibt offen, damit sich auch die Art wählen lässt
    fireEvent.pointerDown(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 600, clientY: 600 })
    fireEvent.pointerUp(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 600, clientY: 600 })
    expect(feld()).toBeNull()
    await nutzer.click(knopf('Radierer'))
    expect(feld()).not.toBeNull()
    await nutzer.keyboard('{Escape}')
    expect(feld()).toBeNull()
    await nutzer.click(knopf('Radierer'))
    await nutzer.click(knopf('Stift'))
    expect(feld()).toBeNull()
    await nutzer.click(knopf('Radierer'))
    expect(feld()).toBeNull() // erst das zweite Antippen öffnet
    expect(knopf('Radierer')).toHaveAttribute('title', expect.stringContaining('Schwamm'))
  })

  it('die Größe zählt: klein und mittel verfehlen den Strich, groß wischt ihn ganz weg', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Radierer'))
    const groesse = async (name: string) => {
      await nutzer.click(knopf('Radierer')) // das Feld schließt sich beim Radieren; noch einmal öffnen
      await nutzer.click(knopf('Radierer ' + name))
    }
    await groesse('Klein')
    ziehe([0, 75], [300, 75]) // 25 Pixel neben dem Strich entlang
    await groesse('Mittel')
    ziehe([0, 75], [300, 75])
    await new Promise((r) => setTimeout(r, 50))
    expect(ids(await seite())).toEqual(['a', 't', 'f'])
    await groesse('Groß')
    ziehe([0, 75], [300, 75])
    await waitFor(async () => expect(ids(await seite())).toEqual(['t', 'f']))
  })

  it('der Element-Radierer entfernt das Berührte als Ganzes', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Radierer'))
    await nutzer.click(knopf('Radierer'))
    await nutzer.click(knopf('Element-Radierer'))
    expect(knopf('Element-Radierer')).toHaveAttribute('aria-pressed', 'true')
    ziehe([150, 40], [150, 60])
    ziehe([50, 190], [50, 260])
    await waitFor(async () => expect(ids(await seite())).toEqual(['f']))
  })
})
