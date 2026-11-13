import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { anwenden, ausfuehren, leererVerlauf, rueckgaengig, wiederholen } from '../kern/befehle.ts'
import { gesamtRahmen, oberstesBei, pfeilspitze, rahmen, textMass, trifft, verschoben } from '../kern/geometrie.ts'
import { MAX_SEITEN, neueSeite, neuesTafelbild, pruefeTafel, schriftgroesse, type Element, type Form, type Strich, type Text } from '../kern/modell.ts'
import { gehe, kopie, seiteDazu, seiteDoppelt, seiteSchieben, seiteWeg, type Buch } from '../kern/seiten.ts'
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

const strich = (id: string, y = 0): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, y, 0.5], [100, y, 0.5]] })
const text = (id: string, mehr: Partial<Text> = {}): Text => ({ art: 'text', id, x: 100, y: 100, text: 'Herz', groesse: 40, farbe: '#111111', ...mehr })
const form = (id: string, f: Form['form'], mehr: Partial<Form> = {}): Form => ({ art: 'form', id, form: f, x1: 0, y1: 0, x2: 100, y2: 60, farbe: '#c62828', staerke: 4, ...mehr })

describe('Datenmodell', () => {
  it('wandelt Tafeln der Version 1 (ohne Seiten) in eine Seite um', () => {
    const alt = { schema: 'lehrraum/tafel', version: 1, id: 'alt', titel: 'Alt', elemente: [strich('a'), strich('b')], kamera: { x: 1, y: 2, zoom: 1.5 }, geaendertAm: '2026-11-11T10:00:00.000Z' }
    const t = pruefeTafel(alt)!
    expect(t.version).toBe(3)
    expect(t.seiten).toHaveLength(1)
    expect(t.seiten[0].elemente.map((e) => e.id)).toEqual(['a', 'b'])
    expect(t).toMatchObject({ id: 'alt', titel: 'Alt', seiteNr: 0, kamera: { x: 1, y: 2, zoom: 1.5 }, fenster: [] })
  })

  it('nimmt Text und Formen an und lässt Ungültiges weg', () => {
    const t = pruefeTafel({
      ...neuesTafelbild(),
      seiten: [{ id: 's', elemente: [text('t'), form('f', 'pfeil'), text('leer', { text: '   ' }), { ...form('x', 'linie'), form: 'stern' }, { ...text('g'), groesse: 9999 }, { ...form('n', 'rechteck'), x2: 'breit' }] }],
    })!
    expect(t.seiten[0].elemente).toEqual([text('t'), form('f', 'pfeil')])
  })

  it('sorgt immer für mindestens eine Seite, begrenzt die Anzahl und verwirft doppelte Kennungen', () => {
    expect(pruefeTafel({ ...neuesTafelbild(), seiten: [] })?.seiten).toHaveLength(1)
    expect(pruefeTafel({ ...neuesTafelbild(), seiten: 'viele' })?.seiten).toHaveLength(1)
    expect(pruefeTafel({ ...neuesTafelbild(), seiten: [{ id: 'a', elemente: [] }, { id: 'a', elemente: [] }, { elemente: [] }] })?.seiten).toHaveLength(1)
    expect(pruefeTafel({ ...neuesTafelbild(), seiten: Array.from({ length: 80 }, (_, i) => ({ id: 's' + i, elemente: [] })) })?.seiten).toHaveLength(MAX_SEITEN)
  })

  it('ordnet Strichstärken Schriftgrößen zu', () => {
    expect([3, 6, 12].map(schriftgroesse)).toEqual([24, 36, 56])
  })
})

describe('Seiten', () => {
  const buch = (n: number, nr = 0): Buch => ({ seiten: Array.from({ length: n }, (_, i) => ({ id: 's' + i, elemente: [strich('e' + i)] })), nr })
  const ids = (b: Buch) => b.seiten.map((s) => s.id).join(',')

  it('fügt hinter der gezeigten Seite eine leere ein und zeigt sie', () => {
    const b = seiteDazu(buch(3, 1))
    expect(b.nr).toBe(2)
    expect(b.seiten).toHaveLength(4)
    expect(b.seiten[2].elemente).toEqual([])
    expect([b.seiten[0].id, b.seiten[1].id, b.seiten[3].id]).toEqual(['s0', 's1', 's2'])
  })

  it('dupliziert mit neuen Kennungen, ohne das Original zu berühren', () => {
    const vorher = buch(2, 0)
    const b = seiteDoppelt(vorher)
    expect(b.nr).toBe(1)
    expect(b.seiten[1].id).not.toBe('s0')
    expect(b.seiten[1].elemente[0]).toMatchObject({ art: 'strich', punkte: [[0, 0, 0.5], [100, 0, 0.5]] })
    expect(b.seiten[1].elemente[0].id).not.toBe('e0')
    expect(vorher.seiten).toHaveLength(2)
  })

  it('löscht die gezeigte Seite; die letzte wird geleert statt gelöscht', () => {
    expect(ids(seiteWeg(buch(3, 1)))).toBe('s0,s2')
    expect(seiteWeg(buch(3, 2)).nr).toBe(1)
    const eine = seiteWeg(buch(1))
    expect(eine.seiten).toHaveLength(1)
    expect(eine.seiten[0].elemente).toEqual([])
  })

  it('schiebt Seiten nach vorne und hinten, blättert in Grenzen, hält die Höchstzahl ein', () => {
    expect(ids(seiteSchieben(buch(3, 0), 1))).toBe('s1,s0,s2')
    expect(seiteSchieben(buch(3, 0), 1).nr).toBe(1)
    expect(ids(seiteSchieben(buch(3, 0), -1))).toBe('s0,s1,s2')
    expect(gehe(buch(3), 99).nr).toBe(2)
    expect(gehe(buch(3), -5).nr).toBe(0)
    expect(seiteDazu(buch(MAX_SEITEN)).seiten).toHaveLength(MAX_SEITEN)
    expect(seiteDoppelt(buch(MAX_SEITEN)).seiten).toHaveLength(MAX_SEITEN)
  })
})

describe('Geometrie von Text und Formen', () => {
  it('schätzt die Größe von Text und bildet Rahmen', () => {
    expect(textMass(text('t', { text: 'ab\nabcd', groesse: 20 }))).toEqual([4 * 20 * 0.55, 2 * 20 * 1.25])
    expect(rahmen(form('f', 'rechteck', { x1: 100, y1: 60, x2: 0, y2: 0, staerke: 4 }))).toEqual([-2, -2, 102, 62])
    expect(rahmen(strich('s', 10))).toEqual([-3, 7, 103, 13])
    expect(gesamtRahmen([strich('s', 10), form('f', 'linie', { x1: 200, y1: 200, x2: 300, y2: 250, staerke: 2 })])).toEqual([-3, 7, 301, 251])
    expect(gesamtRahmen([])).toBeNull()
  })

  it('trifft Rechteck und Ellipse am Rand, nicht in der Mitte', () => {
    const r = form('r', 'rechteck', { x2: 200, y2: 200 })
    expect(trifft(r, 0, 100, 3)).toBe(true)
    expect(trifft(r, 100, 100, 3)).toBe(false) // Inneres bleibt frei zum Hineinschreiben
    expect(trifft(r, 260, 100, 3)).toBe(false)
    const e = form('e', 'ellipse', { x2: 200, y2: 100 })
    expect(trifft(e, 200, 50, 3)).toBe(true)
    expect(trifft(e, 100, 50, 3)).toBe(false)
  })

  it('trifft Linien, Pfeile und Text; das oberste Element gewinnt', () => {
    const l = form('l', 'pfeil', { x2: 100, y2: 100 })
    expect(trifft(l, 50, 52, 3)).toBe(true)
    expect(trifft(l, 50, 80, 3)).toBe(false)
    const t = text('t')
    expect(trifft(t, 110, 120, 0)).toBe(true)
    expect(trifft(t, 90, 120, 3)).toBe(false)
    expect(oberstesBei([strich('unten', 120), t], 110, 120, 4)?.id).toBe('t')
    expect(oberstesBei([t], 0, 0, 4)).toBeNull()
  })

  it('verschiebt Elemente unter Beibehaltung der Kennung; Kopien bekommen eine neue', () => {
    expect(verschoben(text('t'), 5, -5)).toEqual(text('t', { x: 105, y: 95 }))
    expect(verschoben(form('f', 'linie'), 10, 10)).toMatchObject({ id: 'f', x1: 10, y1: 10, x2: 110, y2: 70 })
    expect(verschoben(strich('s'), 1, 2).punkte).toEqual([[1, 2, 0.5], [101, 2, 0.5]])
    const k = kopie(text('t'), 24, 24) as Text
    expect(k.id).not.toBe('t')
    expect([k.x, k.y, k.text]).toEqual([124, 124, 'Herz'])
  })

  it('legt die Pfeilspitze ans Ende und begrenzt sie bei kurzen Pfeilen', () => {
    const [a, b] = pfeilspitze(form('p', 'pfeil', { x1: 0, y1: 0, x2: 100, y2: 0 }))
    expect(a[0]).toBeLessThan(100)
    expect(a[1]).toBeCloseTo(-b[1])
    const kurz = pfeilspitze(form('p', 'pfeil', { x1: 0, y1: 0, x2: 10, y2: 0 }))
    expect(Math.hypot(kurz[0][0] - 10, kurz[0][1])).toBeCloseTo(6)
  })
})

describe('Befehl „ersetzen“', () => {
  it('ändert Elemente an ihrer Stelle und lässt sich zurücknehmen und wiederholen', () => {
    const alle: Element[] = [strich('a'), text('t'), strich('b')]
    const neu = text('t', { text: 'Kreislauf' })
    let z = ausfuehren(alle, leererVerlauf(), { art: 'ersetzen', vorher: [alle[1]], nachher: [neu] })
    expect(z.elemente).toEqual([alle[0], neu, alle[2]])
    z = rueckgaengig(z.elemente, z.verlauf)
    expect(z.elemente).toEqual(alle)
    z = wiederholen(z.elemente, z.verlauf)
    expect(z.elemente[1]).toBe(neu)
    expect(anwenden(alle, { art: 'ersetzen', vorher: [], nachher: [text('fremd')] })).toEqual(alle) // Unbekanntes ändert nichts
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
const tippe = (x: number, y: number) => {
  fireEvent.pointerDown(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
  fireEvent.pointerUp(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
}
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const tafel = async () => (await ladeLetzteTafel())!
const seite = async (nr = 0) => (await tafel()).seiten[nr].elemente
const knopf = (name: string) => screen.getByRole('button', { name })

describe('Formen und Text auf der Tafel', () => {
  it('zieht Rechteck, Ellipse, Linie und Pfeil auf; ein bloßes Antippen erzeugt nichts', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    for (const [name, y] of [['Rechteck', 10], ['Ellipse', 110], ['Linie', 210], ['Pfeil', 310]] as const) {
      await nutzer.click(knopf(name))
      ziehe([20, y], [220, y + 80])
    }
    tippe(400, 400)
    await waitFor(async () => expect((await seite()).map((e) => (e as Form).form)).toEqual(['rechteck', 'ellipse', 'linie', 'pfeil']))
    expect((await seite())[3]).toMatchObject({ art: 'form', x1: 20, y1: 310, x2: 220, y2: 390, staerke: 6, farbe: '#0b1f4d' })
  })

  it('schreibt Text an die angetippte Stelle, in gewählter Farbe und Größe', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Grün'))
    await nutzer.click(knopf('Strichstärke breit'))
    await nutzer.keyboard('t')
    expect(knopf('Text')).toHaveAttribute('aria-pressed', 'true')
    tippe(200, 150)
    const feld = screen.getByRole('textbox', { name: 'Text auf der Tafel' })
    await nutzer.type(feld, 'Systole{Enter}Diastole')
    expect(knopf('Text')).toHaveAttribute('aria-pressed', 'true') // Buchstaben im Text schalten kein Werkzeug um
    tippe(600, 500) // daneben tippen übernimmt den Text
    expect(screen.queryByRole('textbox', { name: 'Text auf der Tafel' })).not.toBeInTheDocument()
    await waitFor(async () => expect(await seite()).toHaveLength(1))
    expect((await seite())[0]).toMatchObject({ art: 'text', text: 'Systole\nDiastole', farbe: '#1b6b43', groesse: 56, x: 200 })
  })

  it('verwirft leeren Text und Abbruch mit Escape', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Text'))
    tippe(100, 100)
    tippe(300, 300) // nichts geschrieben
    tippe(100, 100)
    await nutzer.type(screen.getByRole('textbox', { name: 'Text auf der Tafel' }), 'doch nicht{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Text auf der Tafel' })).not.toBeInTheDocument()
    ziehe([5, 5], [6, 6]) // irgendeine echte Änderung abwarten können
    await nutzer.click(knopf('Stift'))
    ziehe([10, 400], [90, 400])
    await waitFor(async () => expect((await seite()).map((e) => e.art)).toEqual(['strich']))
  })

  it('ändert vorhandenen Text per Doppeltipp; leerer Text löscht ihn; beides lässt sich zurücknehmen', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([text('t')])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    tippe(110, 120)
    tippe(110, 120)
    const feld = screen.getByRole('textbox', { name: 'Text auf der Tafel' })
    expect(feld).toHaveValue('Herz')
    await nutzer.type(feld, 'zyklus')
    tippe(700, 500)
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ id: 't', text: 'Herzzyklus' }))
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ text: 'Herz' }))
    await nutzer.click(knopf('Text'))
    tippe(110, 120) // mit dem Textwerkzeug genügt ein Tipp
    await nutzer.clear(screen.getByRole('textbox', { name: 'Text auf der Tafel' }))
    tippe(700, 500)
    await waitFor(async () => expect(await seite()).toEqual([]))
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect(await seite()).toHaveLength(1))
  })
})

describe('Auswählen, verschieben, ändern', () => {
  const vorlage = () => speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([strich('s', 50), form('f', 'linie', { x1: 300, y1: 300, x2: 400, y2: 300 })])] })

  it('verschiebt das angetippte Element; Rückgängig stellt die Lage wieder her', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    expect(screen.queryByRole('toolbar', { name: 'Befehle für die Auswahl' })).toBeNull()
    await nutzer.click(knopf('Auswahl'))
    ziehe([50, 50], [150, 250])
    await waitFor(async () => expect(((await seite())[0] as Strich).punkte[0]).toEqual([100, 250, 0.5]))
    expect(((await seite())[1] as Form).x1).toBe(300) // das andere Element bleibt liegen
    expect(screen.getByRole('toolbar', { name: 'Befehle für die Auswahl' })).toBeInTheDocument() // die Leiste an der Auswahl
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect(((await seite())[0] as Strich).punkte[0]).toEqual([0, 50, 0.5]))
  })

  it('färbt um, ändert die Stärke, dupliziert und löscht die Auswahl (Knopf und Tasten)', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.keyboard('a')
    tippe(350, 300)
    await nutzer.click(knopf('Rot'))
    await nutzer.click(knopf('Strichstärke fein'))
    await waitFor(async () => expect((await seite())[1]).toMatchObject({ id: 'f', farbe: '#c62828', staerke: 3 }))
    expect((await seite())[0]).toMatchObject({ farbe: '#0b1f4d', staerke: 6 })
    await nutzer.keyboard('{Control>}d{/Control}')
    await waitFor(async () => expect(await seite()).toHaveLength(3))
    expect((await seite())[2]).toMatchObject({ art: 'form', x1: 324, y1: 324, farbe: '#c62828' })
    await nutzer.keyboard('{Delete}') // die Kopie ist jetzt ausgewählt
    await waitFor(async () => expect((await seite()).map((e) => e.id)).toEqual(['s', 'f']))
    tippe(350, 300)
    await nutzer.click(knopf('Auswahl löschen'))
    await waitFor(async () => expect((await seite()).map((e) => e.id)).toEqual(['s']))
    expect(knopf('Seite leeren')).toBeEnabled() // ohne Auswahl leert derselbe Knopf die Seite
  })

  it('Ziehen auf freier Fläche verschiebt nicht mehr die Ansicht; das Hand-Werkzeug tut es', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    tippe(50, 50)
    expect(knopf('Auswahl löschen')).toBeInTheDocument()
    ziehe([600, 100], [640, 160]) // Rahmen über leere Fläche: hebt die Auswahl auf, wählt nichts
    expect(knopf('Seite leeren')).toBeInTheDocument()
    await nutzer.keyboard('h')
    expect(knopf('Hand')).toHaveAttribute('aria-pressed', 'true')
    ziehe([600, 100], [640, 160])
    await waitFor(async () => expect((await tafel()).kamera).toEqual({ x: 40, y: 60, zoom: 1 }))
    expect(await seite()).toHaveLength(2)
  })

  it('der Radierer entfernt auch Formen und Text', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([text('t'), form('f', 'rechteck', { x1: 300, y1: 300, x2: 400, y2: 400 }), strich('s', 500)])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Radierer'))
    ziehe([110, 90], [110, 140]) // über den Text
    ziehe([290, 350], [310, 350]) // über den Rand des Rechtecks
    ziehe([350, 340], [350, 360]) // im Inneren des Rechtecks: trifft nichts
    await waitFor(async () => expect((await seite()).map((e) => e.id)).toEqual(['s']))
  })
})

describe('Seiten der Tafel', () => {
  const leiste = () => within(screen.getByRole('navigation', { name: 'Seiten' }))

  it('legt Seiten an, blättert, und jede Seite behält ihren Inhalt und ihren Verlauf', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    expect(leiste().getByRole('status')).toHaveTextContent('Seite 1 von 1')
    expect(leiste().getByRole('button', { name: 'Seite löschen' })).toBeDisabled() // einzige, leere Seite
    ziehe([10, 10], [100, 10])
    await nutzer.click(leiste().getByRole('button', { name: 'Neue Seite' }))
    expect(leiste().getByRole('status')).toHaveTextContent('Seite 2 von 2')
    expect(knopf('Rückgängig')).toBeDisabled() // neue Seite, eigener Verlauf
    ziehe([10, 50], [100, 50])
    ziehe([10, 90], [100, 90])
    await waitFor(async () => expect((await tafel()).seiten.map((s) => s.elemente.length)).toEqual([1, 2]))
    expect((await tafel()).seiteNr).toBe(1)
    await nutzer.click(leiste().getByRole('button', { name: 'Vorige Seite' }))
    expect(leiste().getByRole('button', { name: 'Vorige Seite' })).toBeDisabled()
    await nutzer.click(knopf('Rückgängig')) // nimmt den Strich von Seite 1 zurück, nicht die von Seite 2
    await waitFor(async () => expect((await tafel()).seiten.map((s) => s.elemente.length)).toEqual([0, 2]))
    await nutzer.keyboard('{PageDown}')
    expect(leiste().getByRole('status')).toHaveTextContent('Seite 2 von 2')
  })

  it('dupliziert, sortiert um und löscht mit Rückfrage', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [{ id: 'eins', elemente: [strich('a')] }, { id: 'zwei', elemente: [] }] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Seite duplizieren' }))
    await waitFor(async () => expect((await tafel()).seiten.map((s) => s.elemente.length)).toEqual([1, 1, 0]))
    expect(leiste().getByRole('status')).toHaveTextContent('Seite 2 von 3')
    await nutzer.click(leiste().getByRole('button', { name: 'Seite nach hinten schieben' }))
    await waitFor(async () => expect((await tafel()).seiten.map((s) => s.id)[1]).toBe('zwei'))
    expect(leiste().getByRole('status')).toHaveTextContent('Seite 3 von 3')

    await nutzer.click(leiste().getByRole('button', { name: 'Seite löschen' }))
    expect(leiste().getByText('Seite 3 löschen?')).toBeInTheDocument()
    await nutzer.click(leiste().getByRole('button', { name: 'Nein' }))
    expect((await tafel()).seiten).toHaveLength(3)
    await nutzer.click(leiste().getByRole('button', { name: 'Seite löschen' }))
    await nutzer.click(leiste().getByRole('button', { name: 'Ja, löschen' }))
    await waitFor(async () => expect((await tafel()).seiten.map((s) => s.id)).toEqual(['eins', 'zwei']))
    expect(leiste().getByRole('status')).toHaveTextContent('Seite 2 von 2')
    await nutzer.click(leiste().getByRole('button', { name: 'Seite löschen' })) // leere Seite: ohne Rückfrage
    await waitFor(async () => expect((await tafel()).seiten.map((s) => s.id)).toEqual(['eins']))
  })

  it('öffnet nach dem Neuladen die zuletzt gezeigte Seite', async () => {
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite(), neueSeite([strich('a')]), neueSeite()], seiteNr: 1 })
    render(<Tafel />)
    await bereit()
    expect(leiste().getByRole('status')).toHaveTextContent('Seite 2 von 3')
    expect(knopf('Seite leeren')).toBeEnabled()
  })
})
