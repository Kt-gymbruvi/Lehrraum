// PDF-Seiten drehen, nur den PDF-Hintergrund entfernen, alle Seiten eines PDFs löschen
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ausfuehrenAuf, leererVerlauf, rueckgaengigAuf, wiederholenAuf, type Inhalt } from '../kern/befehle.ts'
import { seitenMass } from '../kern/geometrie.ts'
import { hintergrundMass, neueSeite, neuesTafelbild, pruefeTafel, type Hintergrund, type Seite, type Strich, type Text } from '../kern/modell.ts'
import { drehBefehl, hintergrundWegBefehl, pdfSeiten, seitenWeg } from '../kern/seiten.ts'
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

const hg = (pdf?: string, mehr: Partial<Hintergrund> = {}): Hintergrund => ({ dateiId: 'ffee0011', b: 794, h: 1123, ...(pdf ? { pdf } : {}), ...mehr })
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
  it('Version 4 merkt sich Drehung und PDF-Kennung; Unsinn fällt weg, Version 3 wird übernommen', () => {
    const t = pruefeTafel({
      ...neuesTafelbild(),
      seiten: [
        { id: 'a', elemente: [], hintergrund: hg('abcdef12', { drehung: 90 }) },
        { id: 'b', elemente: [], hintergrund: { ...hg(), drehung: 45, pdf: '../x' } },
      ],
    })!
    expect(t.version).toBe(5)
    expect(t.seiten[0].hintergrund).toEqual(hg('abcdef12', { drehung: 90 }))
    expect(t.seiten[1].hintergrund).toEqual(hg())
    const alt = pruefeTafel({ ...neuesTafelbild(), version: 3, seiten: [{ id: 'a', elemente: [], hintergrund: hg() }] })!
    expect(alt.version).toBe(5)
    expect(alt.seiten[0].hintergrund).toEqual(hg())
  })

  it('gedreht vertauscht die sichtbare Breite und Höhe der Seite', () => {
    expect(hintergrundMass(hg())).toEqual([794, 1123])
    expect(hintergrundMass(hg(undefined, { drehung: 90 }))).toEqual([1123, 794])
    expect(hintergrundMass(hg(undefined, { drehung: 180 }))).toEqual([794, 1123])
    expect(seitenMass(seite('a', hg(undefined, { drehung: 270 })))).toEqual([0, 0, 1123, 794])
  })

  it('Drehen nach rechts nimmt das Geschriebene mit; viermal gedreht ist alles wie vorher', () => {
    const s0 = seite('a', hg('abcdef12'), [strich('s', [[10, 20], [100, 20]])])
    const b = drehBefehl(s0, 1)!
    expect(b).toMatchObject({ art: 'hintergrund', nachher: { drehung: 90, pdf: 'abcdef12' } })
    // im Uhrzeigersinn: (x, y) → (Höhe − y, x)
    const p = (b.art === 'hintergrund' && (b.elementeNachher[0] as Strich).punkte) || []
    nah(p[0], [1103, 10, 0.5])
    nah(p[1], [1103, 100, 0.5])

    let i: Inhalt = { elemente: s0.elemente, hintergrund: s0.hintergrund }
    let v = leererVerlauf()
    for (let n = 0; n < 4; n++) {
      ;({ inhalt: i, verlauf: v } = ausfuehrenAuf(i, v, drehBefehl({ id: 'a', ...i }, 1)!))
    }
    expect(i.hintergrund).toEqual(hg('abcdef12')) // keine Drehung mehr eingetragen
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
    const start = { elemente: [s], hintergrund: hg('abcdef12', { drehung: 180 }) }
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

  it('findet alle Seiten desselben PDFs und löscht mehrere Seiten auf einmal', () => {
    const seiten = [seite('x'), seite('p1', hg('aaaaaaaa')), seite('q', hg('bbbbbbbb')), seite('p2', hg('aaaaaaaa')), seite('alt', hg())]
    expect(pdfSeiten({ seiten, nr: 3 })).toEqual([1, 3])
    expect(pdfSeiten({ seiten, nr: 0 })).toEqual([])
    expect(pdfSeiten({ seiten, nr: 4 })).toEqual([]) // ältere Seiten ohne Kennung
    expect(seitenWeg({ seiten, nr: 3 }, [1, 3])).toEqual({ seiten: [seiten[0], seiten[2], seiten[4]], nr: 2 })
    expect(seitenWeg({ seiten, nr: 1 }, [1, 3])).toMatchObject({ nr: 1 })
    const leer = seitenWeg({ seiten: seiten.slice(1, 2), nr: 0 }, [0])
    expect(leer.seiten).toHaveLength(1)
    expect(leer.seiten[0].hintergrund).toBeUndefined()
  })
})

const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const leiste = () => within(screen.getByRole('navigation', { name: 'Seiten' }))

describe('PDF-Seiten – Bedienung', () => {
  it('Knöpfe nur auf Seiten mit PDF; Drehen und Entfernen lassen sich zurücknehmen und werden gespeichert', async () => {
    const nutzer = userEvent.setup()
    const s = strich('s', [[10, 20], [100, 20]])
    await speichereTafel({ ...neuesTafelbild(), seiten: [seite('a', hg('abcdef12'), [s]), neueSeite()] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'PDF-Seite nach rechts drehen' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten[0].hintergrund?.drehung).toBe(90))
    nah(((await ladeLetzteTafel())!.seiten[0].elemente[0] as Strich).punkte[0], [1103, 10, 0.5])

    await nutzer.click(leiste().getByRole('button', { name: 'PDF-Hintergrund entfernen' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten[0].hintergrund).toBeUndefined())
    expect((await ladeLetzteTafel())!.seiten[0].elemente).toHaveLength(1) // das Geschriebene bleibt
    expect(leiste().queryByRole('button', { name: 'PDF-Seite nach rechts drehen' })).toBeNull()

    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten[0].hintergrund).toEqual(hg('abcdef12', { drehung: 90 })))
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten[0].hintergrund).toEqual(hg('abcdef12')))
    nah(((await ladeLetzteTafel())!.seiten[0].elemente[0] as Strich).punkte[0], [10, 20, 0.5])

    await nutzer.click(leiste().getByRole('button', { name: 'Nächste Seite' }))
    expect(leiste().queryByRole('button', { name: 'PDF-Seite nach links drehen' })).toBeNull()
  })

  it('beim Löschen einer PDF-Seite: nur diese oder alle Seiten dieses PDFs', async () => {
    const nutzer = userEvent.setup()
    const seiten = [neueSeite([strich('s', [[0, 0]])]), seite('p1', hg('abcdef12')), seite('p2', hg('abcdef12')), seite('p3', hg('abcdef12'))]
    await speichereTafel({ ...neuesTafelbild(), seiten })
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Nächste Seite' }))
    await nutzer.click(leiste().getByRole('button', { name: 'Seite löschen' }))
    expect(leiste().getByText('Seite 2 löschen?')).toBeInTheDocument()
    expect(leiste().getByRole('button', { name: 'Nur diese Seite' })).toBeInTheDocument()
    await nutzer.click(leiste().getByRole('button', { name: 'Alle 3 PDF-Seiten' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten.map((x) => x.id)).toEqual([seiten[0].id]))
    expect(leiste().getByText('Seite 1 von 1')).toBeInTheDocument()
  })

  it('bei nur einer Seite aus dem PDF bleibt die gewohnte Rückfrage', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [seite('p1', hg('abcdef12')), neueSeite()] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Seite löschen' }))
    expect(leiste().queryByRole('button', { name: /PDF-Seiten/ })).toBeNull()
    await nutzer.click(leiste().getByRole('button', { name: 'Ja, löschen' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten).toHaveLength(1))
  })
})
