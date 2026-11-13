// Etappe 2, Teil 3: Kopieren und Einfügen (auch zwischen Tafeln), Gruppieren, Reihenfolge, Auswahlleiste
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ABLAGE_SCHEMA, einzufuegen, neueAblage, pruefeAblage } from '../kern/ablage.ts'
import { geloest, gruppiert, istEineGruppe, mitGruppen } from '../kern/auswahl.ts'
import { anwenden, ordnenBefehl, zuruecknehmen } from '../kern/befehle.ts'
import { gesamtRahmen } from '../kern/geometrie.ts'
import { neueKlasse } from '../kern/klassen.ts'
import { neueSeite, neuesTafelbild, type Bild, type Element, type Form, type Strich } from '../kern/modell.ts'
import { kopiere } from '../kern/seiten.ts'
import { speichereDatei } from '../speicher/dateien.ts'
import { ladeAblage, ladeLetzteTafel, merkeAblage, speichereKlasse, speichereTafel, vorgang } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_, n) => (n === 'measureText' ? () => ({ width: 20 }) : () => undefined), set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

const strich = (id: string, y = 0, mehr: Partial<Strich> = {}): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, y, 0.5], [100, y, 0.5]], ...mehr })
const form = (id: string, mehr: Partial<Form> = {}): Form => ({ art: 'form', id, form: 'rechteck', x1: 300, y1: 300, x2: 400, y2: 360, farbe: '#c62828', staerke: 4, ...mehr })
const ids = (l: Element[]) => l.map((e) => e.id)

describe('Ablage – Logik', () => {
  it('prüft die gespeicherte Kopie und lässt Ungültiges weg', () => {
    expect(pruefeAblage(null)).toBeNull()
    expect(pruefeAblage({ schema: 'fremd', version: 1, elemente: [strich('a')] })).toBeNull()
    expect(pruefeAblage({ schema: ABLAGE_SCHEMA, version: 2, elemente: [strich('a')] })).toBeNull()
    expect(pruefeAblage({ schema: ABLAGE_SCHEMA, version: 1, elemente: [{ art: 'unbekannt' }] })).toBeNull() // nichts Brauchbares
    expect(pruefeAblage({ schema: ABLAGE_SCHEMA, version: 1, elemente: [strich('a'), { art: 'strich', id: 'b' }] })?.elemente).toEqual([strich('a')])
    expect(pruefeAblage(neueAblage([strich('a'), form('f')]))).toEqual(neueAblage([strich('a'), form('f')]))
  })

  it('fügt mit neuen Kennungen in der Mitte ein; Gruppen bleiben Gruppen, aber eigene', () => {
    const ablage = neueAblage([strich('a', 0, { gruppe: 'g1' }), strich('b', 100, { gruppe: 'g1' }), form('f', { gruppe: 'g2' }), strich('c', 50)])
    const neu = einzufuegen(ablage, 1000, 1000)
    const r = gesamtRahmen(neu)!
    expect((r[0] + r[2]) / 2).toBeCloseTo(1000)
    expect((r[1] + r[3]) / 2).toBeCloseTo(1000)
    expect(ids(neu).some((id) => ['a', 'b', 'f', 'c'].includes(id))).toBe(false)
    expect(neu[0].gruppe).toBeDefined()
    expect(neu[0].gruppe).toBe(neu[1].gruppe)
    expect(neu[0].gruppe).not.toBe('g1')
    expect(neu[2].gruppe).not.toBe(neu[0].gruppe)
    expect(neu[3].gruppe).toBeUndefined()
    expect(ablage.elemente[0]).toEqual(strich('a', 0, { gruppe: 'g1' })) // die Kopie selbst bleibt unverändert
    // zweimal einfügen ergibt zwei verschiedene Gruppen
    expect(einzufuegen(ablage, 0, 0)[0].gruppe).not.toBe(neu[0].gruppe)
  })

  it('verschiebt beim Kopieren auf Wunsch', () => {
    const [k] = kopiere([strich('a')], 24, 24)
    expect((k as Strich).punkte[0]).toEqual([24, 24, 0.5])
  })
})

describe('Gruppen und Reihenfolge – Logik', () => {
  const liste = [strich('a', 0, { gruppe: 'g' }), strich('b', 50), strich('c', 100, { gruppe: 'g' }), strich('d', 150)]

  it('wählt immer die ganze Gruppe', () => {
    expect(mitGruppen(liste, ['a'])).toEqual(['a', 'c'])
    expect(mitGruppen(liste, ['b', 'c'])).toEqual(['a', 'b', 'c'])
    expect(mitGruppen(liste, ['d'])).toEqual(['d'])
  })

  it('gruppiert, erkennt eine Gruppe und löst sie', () => {
    expect(istEineGruppe([liste[0], liste[2]])).toBe(true)
    expect(istEineGruppe([liste[0]])).toBe(false) // ein einzelnes Element ist keine Gruppe zum Lösen
    expect(istEineGruppe([liste[0], liste[1]])).toBe(false)
    const neu = gruppiert([liste[0], liste[1]], 'h')
    expect(neu.map((e) => e.gruppe)).toEqual(['h', 'h']) // die alte Gruppe geht in der neuen auf
    expect(geloest(neu).every((e) => !('gruppe' in e))).toBe(true)
  })

  it('bringt ganz nach vorne und ganz nach hinten – und zurück', () => {
    const vorne = ordnenBefehl(liste, ['a', 'c'], 'vorne')!
    expect(ids(anwenden(liste, vorne))).toEqual(['b', 'd', 'a', 'c'])
    expect(zuruecknehmen(anwenden(liste, vorne), vorne)).toEqual(liste)
    const hinten = ordnenBefehl(liste, ['d'], 'hinten')!
    expect(ids(anwenden(liste, hinten))).toEqual(['d', 'a', 'b', 'c'])
    expect(ordnenBefehl(liste, ['d'], 'vorne')).toBeNull() // liegt schon vorne: kein Schritt im Verlauf
    expect(ordnenBefehl(liste, [], 'vorne')).toBeNull()
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
const seite = async () => (await ladeLetzteTafel())!.seiten[0].elemente
const knopf = (name: string) => screen.getByRole('button', { name })
const leiste = () => screen.getByRole('toolbar', { name: 'Befehle für die Auswahl' })
const anDerAuswahl = (name: string) => within(leiste()).getByRole('button', { name })
const vorlage = () => speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([strich('a', 50), strich('b', 150), form('r')])] })

describe('Kopieren und Einfügen – Bedienung', () => {
  it('Kopieren an der Auswahl, Einfügen links: in der Mitte, ausgewählt, ein Schritt zum Zurücknehmen', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    expect(knopf('Einfügen')).toBeDisabled() // noch nichts kopiert
    await nutzer.click(knopf('Auswahl'))
    expect(screen.queryByRole('toolbar', { name: 'Befehle für die Auswahl' })).toBeNull()
    tippe(50, 50)
    await nutzer.click(anDerAuswahl('Kopieren'))
    expect(knopf('Einfügen')).toBeEnabled()
    await waitFor(async () => expect((await ladeAblage())?.elemente).toEqual([strich('a', 50)]))
    await nutzer.click(knopf('Einfügen'))
    await waitFor(async () => expect(await seite()).toHaveLength(4))
    const neu = (await seite())[3] as Strich
    expect(neu.id).not.toBe('a')
    expect(neu.punkte.map((p) => p.slice(0, 2))).toEqual([[350, 300], [450, 300]]) // Mitte der Fläche (800 × 600)
    expect(knopf('Auswahl löschen')).toBeInTheDocument() // das Eingefügte ist ausgewählt
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect(ids(await seite())).toEqual(['a', 'b', 'r']))
  })

  it('Ausschneiden nimmt weg und merkt die Kopie; Strg + V fügt ein', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    tippe(50, 150)
    await nutzer.click(anDerAuswahl('Ausschneiden'))
    await waitFor(async () => expect(ids(await seite())).toEqual(['a', 'r']))
    tippe(50, 50)
    fireEvent.cut(document.body, { clipboardData: { setData: vi.fn() } }) // Strg + X
    await waitFor(async () => expect(ids(await seite())).toEqual(['r']))
    await waitFor(async () => expect((await ladeAblage())?.elemente.map((e) => e.id)).toEqual(['a']))
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true }) // kein Einfügen-Ereignis: nach kurzer Zeit trotzdem
    await waitFor(async () => expect(await seite()).toHaveLength(2))
    expect((await seite())[1]).toMatchObject({ art: 'strich', punkte: [[0, 50, 0.5], [100, 50, 0.5]].map(([x, y, p]) => [x + 350, y + 250, p]) })
  })

  it('Strg + C setzt einen Hinweis in die Zwischenablage des Systems; Strg + V fügt genau einmal ein', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    const setData = vi.fn()
    fireEvent.copy(document.body, { clipboardData: { setData } })
    expect(setData).not.toHaveBeenCalled() // ohne Auswahl bleibt Strg + C beim Browser
    tippe(50, 50)
    fireEvent.copy(document.body, { clipboardData: { setData } }) // folgt im Browser auf Strg + C
    expect(setData).toHaveBeenCalledWith('text/plain', expect.stringContaining('Lehrraum'))
    await waitFor(() => expect(knopf('Einfügen')).toBeEnabled())
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true })
    fireEvent.paste(document.body) // ohne Dateien von außen
    await waitFor(async () => expect(await seite()).toHaveLength(4))
    await act(() => new Promise((r) => setTimeout(r, 300))) // der geplante Ersatz darf nicht noch einmal einfügen
    expect(await seite()).toHaveLength(4)
  })

  it('Strg + C ohne Kopieren-Ereignis des Browsers kopiert nach kurzer Zeit trotzdem', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    tippe(50, 150)
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true })
    await waitFor(async () => expect((await ladeAblage())?.elemente).toEqual([strich('b', 150)]))
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true })
    await waitFor(async () => expect(ids(await seite())).toEqual(['a', 'r']))
  })

  it('die Kopie gilt auch in einer anderen Tafel (hier: der Tafel einer Klasse) und nach dem Neuladen', async () => {
    const nutzer = userEvent.setup()
    await merkeAblage(neueAblage([strich('a', 0, { gruppe: 'g' }), strich('b', 40, { gruppe: 'g' })]))
    const k = neueKlasse({ bezeichnung: '7b', fach: 'Biologie', jahrgang: '' })
    await speichereKlasse(k)
    render(<Tafel klasseId={k.id} />)
    await bereit()
    await waitFor(() => expect(knopf('Einfügen')).toBeEnabled())
    await nutzer.click(knopf('Einfügen'))
    await waitFor(async () => expect(await seite()).toHaveLength(2))
    const [x, y] = await seite()
    expect(x.gruppe).toBeDefined()
    expect(x.gruppe).toBe(y.gruppe)
    expect(x.gruppe).not.toBe('g')
    expect(anDerAuswahl('Gruppe lösen')).toBeInTheDocument()
  })

  it('ein kopiertes Bild bleibt erhalten, auch wenn keine Tafel es mehr zeigt', async () => {
    const behalten = await speichereDatei(new Blob(['kopiert'], { type: 'image/png' }))
    const weg = await speichereDatei(new Blob(['alt'], { type: 'image/png' }))
    const bild: Bild = { art: 'bild', id: 'i', x: 0, y: 0, b: 100, h: 50, dateiId: behalten }
    await merkeAblage(neueAblage([bild]))
    await vorlage()
    render(<Tafel />)
    await bereit()
    const dateien = () => vorgang<IDBValidKey[]>('dateien', 'readonly', (s) => s.getAllKeys())
    // aufgeräumt wird das unbenutzte Bild, aber nicht das kopierte
    await waitFor(async () => expect(await dateien()).toEqual([behalten]))
    expect(weg).not.toBe(behalten)
  })
})

describe('Gruppen und Reihenfolge – Bedienung', () => {
  it('Gruppieren: Antippen wählt die ganze Gruppe; Lösen und Rückgängig', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    tippe(50, 50)
    expect(within(leiste()).queryByRole('button', { name: 'Gruppieren' })).toBeNull() // erst ab zwei Elementen
    ziehe([50, 20], [60, 170]) // beide Striche
    await nutzer.click(anDerAuswahl('Gruppieren'))
    await waitFor(async () => {
      const [a, b, r] = await seite()
      expect(a.gruppe).toBeDefined()
      expect(b.gruppe).toBe(a.gruppe)
      expect(r.gruppe).toBeUndefined()
    })
    tippe(800, 600) // Auswahl aufheben
    tippe(50, 50) // nur einen Strich antippen …
    expect(anDerAuswahl('Gruppe lösen')).toBeInTheDocument() // … gewählt ist die ganze Gruppe
    await nutzer.keyboard('{Control>}g{/Control}')
    await waitFor(async () => expect((await seite()).every((e) => e.gruppe === undefined)).toBe(true))
    expect(anDerAuswahl('Gruppieren')).toBeInTheDocument()
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect((await seite())[0].gruppe).toBeDefined())
  })

  it('ein Rahmen, der nur ein Gruppenmitglied berührt, wählt die ganze Gruppe; der Radierer nimmt nur, was er berührt', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([strich('a', 50, { gruppe: 'g' }), strich('b', 150, { gruppe: 'g' }), form('r')])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    ziehe([40, 40], [60, 60]) // berührt nur Strich a
    await nutzer.keyboard('{Delete}')
    await waitFor(async () => expect(ids(await seite())).toEqual(['r']))
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect(ids(await seite())).toEqual(['a', 'b', 'r']))
    await nutzer.click(knopf('Radierer'))
    ziehe([50, 40], [50, 60])
    await waitFor(async () => expect(ids(await seite())).toEqual(['b', 'r']))
    expect((await seite())[0].gruppe).toBe('g')
  })

  it('ganz nach vorne und ganz nach hinten, je ein Schritt zum Zurücknehmen', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    tippe(50, 50)
    await nutzer.click(anDerAuswahl('Ganz nach vorne'))
    await waitFor(async () => expect(ids(await seite())).toEqual(['b', 'r', 'a']))
    tippe(350, 300) // Rand des Rechtecks
    await nutzer.click(anDerAuswahl('Ganz nach hinten'))
    await waitFor(async () => expect(ids(await seite())).toEqual(['r', 'b', 'a']))
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect(ids(await seite())).toEqual(['b', 'r', 'a']))
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect(ids(await seite())).toEqual(['a', 'b', 'r']))
  })
})
