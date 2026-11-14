// Seitenformat und Blätter (Spezifikation Hintergründe, F1–F4): Logik in kern/blatt.ts und Bedienung an der Tafel.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { aufBlatt, aufsBlattBefehl, begrenzt, BLATT_RAND, blattVon, eingepasst, FORMAT_MASS, istEingepasst, passZoom, ragtHinaus, seitenMitUeberstand } from '../kern/blatt.ts'
import { ausfuehren, leererVerlauf } from '../kern/befehle.ts'
import { gesamtRahmen, seitenMass } from '../kern/geometrie.ts'
import { neueSeite, neuesTafelbild, pruefeTafel, ZOOM_MAX, type Strich } from '../kern/modell.ts'
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

const strich = (id: string, x1: number, y1: number, x2: number, y2: number): Strich => ({
  art: 'strich',
  id,
  werkzeug: 'stift',
  farbe: '#0b1f4d',
  staerke: 6,
  druckEcht: false,
  punkte: [[x1, y1, 0.5], [x2, y2, 0.5]],
})

describe('Blatt – Logik', () => {
  it('neue Tafeln haben das Format 16:9; ältere Tafeln werden unendlich, Version 5 behält ihr Format', () => {
    expect(neuesTafelbild().format).toBe('16:9')
    const v4 = { ...neuesTafelbild(), version: 4, format: undefined }
    expect(pruefeTafel(v4)?.format).toBe('unendlich')
    expect(pruefeTafel({ ...neuesTafelbild(), format: 'a4-hoch' })?.format).toBe('a4-hoch')
    expect(pruefeTafel({ ...neuesTafelbild(), format: 'riesig' })?.format).toBe('unendlich')
    // auch Version 4 mit einem (unerwarteten) Format bleibt unendlich – nichts wird still umgedeutet
    expect(pruefeTafel({ ...neuesTafelbild(), version: 4, format: '16:9' })?.format).toBe('unendlich')
  })

  it('Blatt einer Seite: Format, Hintergrund behält seine Größe, unendlich hat keins', () => {
    const leer = neueSeite()
    expect(blattVon('16:9', leer)).toEqual([1600, 900])
    expect(blattVon('a4-hoch', leer)).toEqual([794, 1123])
    expect(blattVon('unendlich', leer)).toBeNull()
    const pdf = neueSeite([], { dateiId: 'abcdef12', b: 1000, h: 500, drehung: 90 })
    expect(blattVon('16:9', pdf)).toEqual([500, 1000])
    expect(blattVon('unendlich', pdf)).toBeNull()
  })

  it('Einpassen zeigt das ganze Blatt mittig mit Rand', () => {
    const k = eingepasst(FORMAT_MASS['16:9'], 1000, 800)
    expect(k.zoom).toBeCloseTo((1000 - 2 * BLATT_RAND) / 1600)
    expect(k.x).toBeCloseTo(BLATT_RAND)
    expect(k.y).toBeCloseTo((800 - 900 * k.zoom) / 2)
    expect(istEingepasst(k, FORMAT_MASS['16:9'], 1000, 800)).toBe(true)
    expect(istEingepasst({ ...k, zoom: k.zoom * 2 }, FORMAT_MASS['16:9'], 1000, 800)).toBe(false)
  })

  it('Begrenzen: nicht kleiner als das ganze Blatt, höchstens ZOOM_MAX, das Blatt bleibt im Bild', () => {
    const blatt = FORMAT_MASS['16:9']
    const min = passZoom(blatt, 1000, 800)
    // zu weit herausgezoomt → ganzes Blatt, mittig
    expect(begrenzt({ x: 0, y: 0, zoom: 0.1 }, blatt, 1000, 800)).toEqual(eingepasst(blatt, 1000, 800))
    expect(begrenzt({ x: 0, y: 0, zoom: 99 }, blatt, 1000, 800).zoom).toBe(ZOOM_MAX)
    // hineingezoomt und weit weggeschoben → der Blattrand bleibt am Flächenrand
    const k = begrenzt({ x: 5000, y: 5000, zoom: 2 }, blatt, 1000, 800)
    expect(k).toEqual({ zoom: 2, x: BLATT_RAND, y: BLATT_RAND })
    const r = begrenzt({ x: -99999, y: -99999, zoom: 2 }, blatt, 1000, 800)
    expect(r.x + 1600 * 2).toBeCloseTo(1000 - BLATT_RAND)
    expect(r.y + 900 * 2).toBeCloseTo(800 - BLATT_RAND)
    // eine gültige Ansicht bleibt dieselbe
    const gut = { x: -100, y: -50, zoom: 1 }
    expect(begrenzt(gut, blatt, 1000, 800)).toBe(gut)
    expect(min).toBeLessThan(1)
    // ohne Blatt oder ohne gemessene Fläche: keine Grenze
    const frei = { x: 123, y: 4, zoom: 0.3 }
    expect(begrenzt(frei, null, 1000, 800)).toBe(frei)
    expect(begrenzt(frei, blatt, 0, 0)).toBe(frei)
  })

  it('findet Inhalt außerhalb des Blatts und holt ihn aufs Blatt – rückgängig zu machen', () => {
    const blatt = FORMAT_MASS['16:9']
    const drin = neueSeite([strich('a', 100, 100, 300, 100)])
    const weit = neueSeite([strich('b', 100, 100, 300, 100), strich('c', 2500, 1800, 2600, 1900)])
    expect(ragtHinaus(drin, blatt)).toBe(false)
    expect(ragtHinaus(weit, blatt)).toBe(true)
    expect(aufsBlattBefehl(drin, blatt)).toBeNull()
    expect(seitenMitUeberstand([drin, weit, weit], '16:9')).toBe(2)
    expect(seitenMitUeberstand([weit], 'unendlich')).toBe(0)

    const befehl = aufsBlattBefehl(weit, blatt)!
    const neu = ausfuehren(weit.elemente, leererVerlauf(), befehl).elemente
    const r = gesamtRahmen(neu)!
    expect(r[0]).toBeGreaterThanOrEqual(0)
    expect(r[1]).toBeGreaterThanOrEqual(0)
    expect(r[2]).toBeLessThanOrEqual(1600)
    expect(r[3]).toBeLessThanOrEqual(900)
    expect(neu.map((e) => e.id)).toEqual(['b', 'c'])
    // nur verschoben, wenn es nicht zu groß ist: Größe bleibt
    const verrutscht = neueSeite([strich('d', 1700, 100, 1800, 100)])
    const nur = ausfuehren(verrutscht.elemente, leererVerlauf(), aufsBlattBefehl(verrutscht, blatt)!).elemente[0] as Strich
    expect(nur.punkte[1][0] - nur.punkte[0][0]).toBeCloseTo(100)
    expect(nur.staerke).toBe(6)
  })

  it('liegt ein Punkt auf dem Blatt?', () => {
    expect(aufBlatt([1600, 900], 0, 0)).toBe(true)
    expect(aufBlatt([1600, 900], 1600, 900)).toBe(true)
    expect(aufBlatt([1600, 900], -1, 10)).toBe(false)
    expect(aufBlatt([1600, 900], 10, 901)).toBe(false)
  })

  it('Export: mit Blatt ist die PDF-Seite genau so groß wie das Blatt', () => {
    const s = neueSeite([strich('a', 100, 100, 3000, 100)])
    expect(seitenMass(s, [1600, 900])).toEqual([0, 0, 1600, 900])
    expect(seitenMass(s)[2]).toBeGreaterThan(2900) // unendlich: wie bisher alles Beschriebene
  })
})

describe('Blatt – Bedienung', () => {
  const ziehe = (von: [number, number], nach: [number, number]) => {
    const f = screen.getByTestId('zeichenflaeche')
    const basis = { pointerId: 1, pointerType: 'mouse', button: 0 }
    fireEvent.pointerDown(f, { ...basis, clientX: von[0], clientY: von[1] })
    fireEvent.pointerMove(f, { ...basis, clientX: nach[0], clientY: nach[1] })
    fireEvent.pointerUp(f, { ...basis, clientX: nach[0], clientY: nach[1] })
  }
  const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')

  it('neben dem Blatt beginnt kein Strich, auf dem Blatt schon', async () => {
    render(<Tafel />)
    await bereit()
    ziehe([1700, 100], [1800, 100]) // rechts neben dem Blatt (1600 breit)
    ziehe([100, 100], [200, 100])
    await waitFor(async () => expect((await ladeLetzteTafel())?.seiten[0].elemente).toHaveLength(1))
    expect((await ladeLetzteTafel())?.format).toBe('16:9')
  })

  it('auf der letzten Seite legt der Pfeil nach rechts eine neue Seite an', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    expect(screen.queryByRole('button', { name: 'Nächste Seite' })).toBeNull()
    await nutzer.click(screen.getByRole('button', { name: 'Neue Seite anlegen' }))
    expect(screen.getByText('Seite 2 von 2')).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Vorige Seite' }))
    expect(screen.getByRole('button', { name: 'Nächste Seite' })).toBeEnabled()
  })

  it('unendliche Tafel: der Pfeil bleibt auf der letzten Seite gesperrt', async () => {
    await speichereTafel(neuesTafelbild('Alt', 'unendlich'))
    render(<Tafel />)
    await bereit()
    expect(screen.getByRole('button', { name: 'Nächste Seite' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Neue Seite anlegen' })).toBeNull()
  })

  it('Format umstellen, Inhalt einpassen und zurücknehmen', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild('Alt', 'unendlich'), seiten: [neueSeite([strich('a', 100, 100, 300, 100), strich('b', 3000, 2000, 3200, 2000)])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Format der Seiten' }))
    expect(screen.getByRole('button', { name: 'Unendlich' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Inhalt einpassen' })).toBeNull()

    await nutzer.click(screen.getByRole('button', { name: '16:9 (Bildschirm)' }))
    expect(screen.getByRole('button', { name: '16:9 (Bildschirm)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/1 Seite hat Inhalt außerhalb des Blatts/)).toBeInTheDocument()
    await waitFor(async () => expect((await ladeLetzteTafel())?.format).toBe('16:9'))

    await nutzer.click(screen.getByRole('button', { name: 'Inhalt einpassen' }))
    expect(screen.queryByText(/außerhalb des Blatts/)).toBeNull()
    await waitFor(async () => {
      const r = gesamtRahmen((await ladeLetzteTafel())!.seiten[0].elemente)!
      expect(r[2]).toBeLessThanOrEqual(1600)
      expect(r[3]).toBeLessThanOrEqual(900)
    })

    await nutzer.keyboard('{Escape}')
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect(gesamtRahmen((await ladeLetzteTafel())!.seiten[0].elemente)![2]).toBeGreaterThan(3000))
  })
})
