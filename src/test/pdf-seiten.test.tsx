// PDF-Seiten sind seit Version 6 Bild-Elemente auf einer Seite mit eigenem Blattmaß (ältere werden beim Laden
// umgewandelt); ein eigenes Hintergrundbild lässt sich weiter drehen und entfernen.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ausfuehrenAuf, leererVerlauf, rueckgaengigAuf, wiederholenAuf, type Inhalt } from '../kern/befehle.ts'
import { blattVon } from '../kern/blatt.ts'
import { seitenMass } from '../kern/geometrie.ts'
import { benutzteDateien, hintergrundMass, neueSeite, neuesTafelbild, pdfAlsBild, pruefeTafel, type Bild, type Hintergrund, type Seite, type Strich, type Text } from '../kern/modell.ts'
import { drehBefehl, hintergrundWegBefehl, seitenWeg } from '../kern/seiten.ts'
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

const hg = (mehr: Partial<Hintergrund> = {}): Hintergrund => ({ dateiId: 'ffee0011', b: 794, h: 1123, ...mehr })
/** eine PDF-Seite, wie sie bis Version 5 gespeichert wurde */
const altPdf = (mehr: Partial<Hintergrund> = {}) => ({ ...hg(mehr), pdf: 'abcdef12' })
const strich = (id: string, punkte: [number, number][]): Strich => ({
  art: 'strich',
  id,
  werkzeug: 'stift',
  farbe: '#0b1f4d',
  staerke: 6,
  druckEcht: false,
  punkte: punkte.map(([x, y]) => [x, y, 0.5]),
})
const seite = (id: string, h?: Hintergrund, elemente: Seite['elemente'] = []): Seite => (h ? { id, elemente, hintergrund: h } : { id, elemente })
const nah = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6))

describe('PDF-Seiten – Logik', () => {
  it('Version 6: PDF-Seiten aus älteren Tafeln werden ein Bild, das das Blatt ausfüllt – auch gedreht', () => {
    const t = pruefeTafel({
      ...neuesTafelbild(),
      version: 5,
      seiten: [
        { id: 'a', elemente: [strich('s', [[1, 2]])], hintergrund: altPdf(), muster: { art: 'liniert' } },
        { id: 'b', elemente: [], hintergrund: altPdf({ drehung: 90 }) },
        { id: 'c', elemente: [], hintergrund: altPdf({ drehung: 180 }) },
        { id: 'd', elemente: [], hintergrund: altPdf({ drehung: 270 }) },
        { id: 'e', elemente: [], hintergrund: hg() }, // eigenes Bild bleibt Hintergrund
      ],
    })!
    expect(t.version).toBe(6)
    const [a, b, c, d, e] = t.seiten
    expect(a.hintergrund).toBeUndefined()
    expect(a.blatt).toEqual({ b: 794, h: 1123 })
    expect(a.muster).toEqual({ art: 'liniert' })
    expect(a.elemente.map((x) => x.art)).toEqual(['bild', 'strich']) // das Bild liegt unter dem Geschriebenen
    expect(a.elemente[0]).toMatchObject({ art: 'bild', x: 0, y: 0, b: 794, h: 1123, dateiId: 'ffee0011' })
    expect(b.blatt).toEqual({ b: 1123, h: 794 })
    expect(b.elemente[0]).toMatchObject({ x: 1123, y: 0, drehung: 90 })
    expect(c.elemente[0]).toMatchObject({ x: 794, y: 1123, drehung: 180 })
    expect(d.elemente[0]).toMatchObject({ x: 0, y: 794, drehung: -90 })
    expect(e).toMatchObject({ hintergrund: hg() })
    expect(e.blatt).toBeUndefined()
    expect(benutzteDateien(t.seiten).has('ffee0011')).toBe(true)
    // gespeichert und wieder geladen bleibt es so
    expect(pruefeTafel(JSON.parse(JSON.stringify(t)))).toEqual(t)
  })

  it('das Blatt einer PDF-Seite hat ihr Maß – in festen Formaten, nicht auf der unendlichen Fläche', () => {
    const s = { ...neueSeite(pdfAlsBild(hg()).elemente), blatt: { b: 794, h: 1123 } }
    expect(blattVon('16:9', s)).toEqual([794, 1123])
    expect(blattVon('unendlich', s)).toBeNull()
    expect(blattVon('16:9', neueSeite())).not.toEqual([794, 1123])
    const unsinn = pruefeTafel({ ...neuesTafelbild(), seiten: [{ id: 'a', elemente: [], blatt: { b: -1, h: 'x' } }] })!
    expect(unsinn.seiten[0].blatt).toBeUndefined()
  })

  it('gedreht vertauscht die sichtbare Breite und Höhe der Seite', () => {
    expect(hintergrundMass(hg())).toEqual([794, 1123])
    expect(hintergrundMass(hg({ drehung: 90 }))).toEqual([1123, 794])
    expect(hintergrundMass(hg({ drehung: 180 }))).toEqual([794, 1123])
    expect(seitenMass(seite('a', hg({ drehung: 270 })))).toEqual([0, 0, 1123, 794])
  })

  it('Drehen nach rechts nimmt das Geschriebene mit; viermal gedreht ist alles wie vorher', () => {
    const s0 = seite('a', hg(), [strich('s', [[10, 20], [100, 20]])])
    const b = drehBefehl(s0, 1)!
    expect(b).toMatchObject({ art: 'hintergrund', nachher: { drehung: 90 } })
    // im Uhrzeigersinn: (x, y) → (Höhe − y, x)
    const p = (b.art === 'hintergrund' && (b.elementeNachher[0] as Strich).punkte) || []
    nah(p[0], [1103, 10, 0.5])
    nah(p[1], [1103, 100, 0.5])

    let i: Inhalt = { elemente: s0.elemente, hintergrund: s0.hintergrund }
    let v = leererVerlauf()
    for (let n = 0; n < 4; n++) {
      ;({ inhalt: i, verlauf: v } = ausfuehrenAuf(i, v, drehBefehl({ id: 'a', ...i }, 1)!))
    }
    expect(i.hintergrund).toEqual(hg()) // keine Drehung mehr eingetragen
    nah((i.elemente[0] as Strich).punkte[0], [10, 20, 0.5])
    // links herum ist die Umkehrung von rechts herum
    const r = ausfuehrenAuf(i, v, drehBefehl({ id: 'a', ...i }, -1)!).inhalt
    expect(r.hintergrund?.drehung).toBe(270)
    nah((r.elemente[0] as Strich).punkte[0], [20, 794 - 10, 0.5])
  })

  it('auch Texte drehen sich mit; ohne Hintergrund gibt es nichts zu drehen', () => {
    const t: Text = { art: 'text', id: 't', x: 50, y: 60, text: 'Hallo', farbe: '#0b1f4d', groesse: 24 }
    const b = drehBefehl(seite('a', hg(), [t]), 1)!
    expect(b.art === 'hintergrund' && b.elementeNachher[0]).toMatchObject({ drehung: 90 })
    expect(drehBefehl(seite('a'), 1)).toBeNull()
    expect(hintergrundWegBefehl(seite('a'))).toBeNull()
  })

  it('Hintergrund entfernen lässt das Geschriebene; Rückgängig und Wiederholen', () => {
    const s = strich('s', [[0, 0], [5, 5]])
    const start = { elemente: [s], hintergrund: hg({ drehung: 180 }) }
    const weg = ausfuehrenAuf(start, leererVerlauf(), hintergrundWegBefehl({ id: 'a', ...start })!)
    expect(weg.inhalt).toEqual({ elemente: [s] })
    const zurueck = rueckgaengigAuf(weg.inhalt, weg.verlauf)
    expect(zurueck.inhalt).toEqual(start)
    expect(wiederholenAuf(zurueck.inhalt, zurueck.verlauf).inhalt).toEqual({ elemente: [s] })
    // andere Befehle lassen den Hintergrund, wie er ist
    const dazu = ausfuehrenAuf(start, leererVerlauf(), { art: 'hinzufuegen', elemente: [strich('t', [[1, 1]])] })
    expect(dazu.inhalt.hintergrund).toBe(start.hintergrund)
    expect(rueckgaengigAuf(dazu.inhalt, dazu.verlauf).inhalt.hintergrund).toBe(start.hintergrund)
  })

  it('löscht mehrere Seiten auf einmal', () => {
    const seiten = [seite('x'), seite('p1', hg()), seite('q'), seite('p2'), seite('alt', hg())]
    expect(seitenWeg({ seiten, nr: 3 }, [1, 3])).toEqual({ seiten: [seiten[0], seiten[2], seiten[4]], nr: 2 })
    expect(seitenWeg({ seiten, nr: 1 }, [1, 3])).toMatchObject({ nr: 1 })
    const leer = seitenWeg({ seiten: seiten.slice(1, 2), nr: 0 }, [0])
    expect(leer.seiten).toHaveLength(1)
    expect(leer.seiten[0].hintergrund).toBeUndefined()
  })
})

const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const leiste = () => within(screen.getByRole('navigation', { name: 'Seiten' }))

describe('Hintergrundbild und PDF-Seiten – Bedienung', () => {
  it('Knöpfe nur auf Seiten mit Hintergrundbild; Drehen und Entfernen lassen sich zurücknehmen und werden gespeichert', async () => {
    const nutzer = userEvent.setup()
    const s = strich('s', [[10, 20], [100, 20]])
    await speichereTafel({ ...neuesTafelbild(), seiten: [seite('a', hg(), [s]), neueSeite()] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Hintergrundbild nach rechts drehen' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten[0].hintergrund?.drehung).toBe(90))
    nah(((await ladeLetzteTafel())!.seiten[0].elemente[0] as Strich).punkte[0], [1103, 10, 0.5])

    await nutzer.click(leiste().getByRole('button', { name: 'Hintergrundbild entfernen' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten[0].hintergrund).toBeUndefined())
    expect((await ladeLetzteTafel())!.seiten[0].elemente).toHaveLength(1) // das Geschriebene bleibt
    expect(leiste().queryByRole('button', { name: 'Hintergrundbild nach rechts drehen' })).toBeNull()

    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten[0].hintergrund).toEqual(hg({ drehung: 90 })))
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten[0].hintergrund).toEqual(hg()))
    nah(((await ladeLetzteTafel())!.seiten[0].elemente[0] as Strich).punkte[0], [10, 20, 0.5])

    await nutzer.click(leiste().getByRole('button', { name: 'Nächste Seite' }))
    expect(leiste().queryByRole('button', { name: 'Hintergrundbild nach links drehen' })).toBeNull()
  })

  it('eine ältere PDF-Seite ist nach dem Öffnen ein Bild: keine Hintergrund-Knöpfe, Löschen mit der gewohnten Rückfrage', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild('PDF', '16:9'), seiten: [{ id: 'p1', elemente: [], hintergrund: altPdf() } as unknown as Seite, neueSeite()] })
    render(<Tafel />)
    await bereit()
    expect(leiste().queryByRole('button', { name: /Hintergrundbild/ })).toBeNull()
    await waitFor(async () => {
      const s0 = (await ladeLetzteTafel())!.seiten[0]
      expect(s0.blatt).toEqual({ b: 794, h: 1123 })
      expect((s0.elemente[0] as Bild).dateiId).toBe('ffee0011')
    })
    await nutzer.click(leiste().getByRole('button', { name: 'Seite löschen' }))
    expect(leiste().queryByRole('button', { name: /PDF-Seiten/ })).toBeNull()
    await nutzer.click(leiste().getByRole('button', { name: 'Ja, löschen' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten).toHaveLength(1))
  })
})
