// Etappe D: Tabelle in der Tafel (Werkzeug, Zellen, Zeilen/Spalten, Kopfzeile, Spaltenbreite).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { rahmen, skaliert, trifft, verschoben, ZEILENHOEHE } from '../kern/geometrie.ts'
import { neueSeite, neuesTafelbild, pruefeTafel, TABELLE_MAX_SPALTEN, TABELLE_MAX_ZEILEN, type Tabelle } from '../kern/modell.ts'
import { kopiere } from '../kern/seiten.ts'
import { gitter, minSpalte, mitSchrift, mitSpaltenbreite, mitZelle, naechsteZelle, neueTabelle, spalteDazu, spalteWeg, tabellenMass, trennerBei, zeileDazu, zeilenHoehen, zeileWeg, zelleBei, zellRand } from '../kern/tabelle.ts'
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

const t3 = (): Tabelle => ({ ...neueTabelle(100, 50, 3, 3, 20, '#0b1f4d'), id: 'tab1' })

describe('Tabelle – Logik', () => {
  it('neue Tabelle: 3 × 3, Kopfzeile, Maße aus Spalten und Text', () => {
    const t = t3()
    expect(t.zellen).toEqual([['', '', ''], ['', '', ''], ['', '', '']])
    expect(t.kopf).toBe(true)
    const zeile = 20 * ZEILENHOEHE + 2 * zellRand(t)
    expect(tabellenMass(t)).toEqual([360, 3 * zeile])
    // ein Zeilenumbruch macht die Zeile höher
    const zwei = mitZelle(t, 1, 2, 'a\nb')
    expect(zeilenHoehen(zwei)[1]).toBeCloseTo(2 * 20 * ZEILENHOEHE + 2 * zellRand(t))
    expect(gitter(zwei).ys).toHaveLength(4)
    expect(neueTabelle(0, 0, 99, 99, 20, '#000000').zellen).toHaveLength(TABELLE_MAX_ZEILEN)
    expect(neueTabelle(0, 0, 99, 99, 20, '#000000').spalten).toHaveLength(TABELLE_MAX_SPALTEN)
  })

  it('findet Zelle und Trennlinie – auch gedreht', () => {
    const t = t3()
    expect(zelleBei(t, 105, 55)).toEqual([0, 0])
    expect(zelleBei(t, 100 + 250, 50 + 40)).toEqual([1, 2])
    expect(zelleBei(t, 90, 55)).toBeNull()
    expect(trennerBei(t, 220, 60, 5)).toBe(0)
    expect(trennerBei(t, 460, 60, 5)).toBe(2) // rechte Außenkante: letzte Spalte
    expect(trennerBei(t, 160, 60, 5)).toBeNull()
    const gedreht: Tabelle = { ...t, drehung: 90 } // um die linke obere Ecke: die erste Zeile liegt nun rechts unten von (100, 50)
    expect(zelleBei(gedreht, 95, 55)).toEqual([0, 0])
    expect(trifft(gedreht, 95, 300, 0)).toBe(true)
    expect(trifft(gedreht, 300, 60, 0)).toBe(false)
  })

  it('Zeilen und Spalten dazu und weg – mit Grenzen', () => {
    const t = mitZelle(mitZelle(t3(), 0, 0, 'A'), 2, 2, 'Z')
    const mehr = zeileDazu(t, 0)!
    expect(mehr.zellen.map((z) => z[0])).toEqual(['A', '', '', ''])
    expect(zeileWeg(mehr, 1)!.zellen).toEqual(t.zellen)
    const breit = spalteDazu(t, 0)!
    expect(breit.zellen[0]).toEqual(['A', '', '', ''])
    expect(breit.spalten).toHaveLength(4)
    expect(spalteWeg(breit, 1)).toEqual(t)
    expect(zeileWeg({ ...t, zellen: [['a', 'b', 'c']] }, 0)).toBeNull()
    expect(spalteWeg({ ...t, spalten: [100], zellen: [['a']] }, 0)).toBeNull()
    expect(zeileDazu(neueTabelle(0, 0, TABELLE_MAX_ZEILEN, 1, 20, '#000000'), 0)).toBeNull()
    expect(spalteDazu(neueTabelle(0, 0, 1, TABELLE_MAX_SPALTEN, 20, '#000000'), 0)).toBeNull()
  })

  it('Spaltenbreite, nächste Zelle, Schriftgröße', () => {
    const t = t3()
    expect(mitSpaltenbreite(t, 1, 3).spalten[1]).toBe(minSpalte(20))
    expect(mitSpaltenbreite(t, 1, 200).spalten).toEqual([120, 200, 120])
    expect(naechsteZelle(t, 0, 2, 1)).toEqual([1, 0])
    expect(naechsteZelle(t, 1, 0, -1)).toEqual([0, 2])
    expect(naechsteZelle(t, 2, 2, 1)).toBeNull()
    expect(naechsteZelle(t, 0, 0, -1)).toBeNull()
    const gross = mitSchrift(t, 40)
    expect(gross).toMatchObject({ groesse: 40, spalten: [240, 240, 240] })
  })

  it('verschieben, vergrößern, kopieren wie andere Elemente', () => {
    const t = t3()
    expect(verschoben(t, 10, 5)).toMatchObject({ x: 110, y: 55 })
    const s = skaliert(t, 100, 50, 2, 2, true)
    expect(s).toMatchObject({ x: 100, y: 50, groesse: 40, spalten: [240, 240, 240] })
    expect(rahmen(s)[2]).toBeCloseTo(100 + 720)
    const k = kopiere([t])[0] as Tabelle
    expect(k.id).not.toBe(t.id)
    expect(k.zellen).toEqual(t.zellen)
  })

  it('wird gespeichert und geprüft; Unsinn fällt weg', () => {
    const t = { ...mitZelle(t3(), 0, 1, 'Art'), drehung: 30 }
    const tafel = { ...neuesTafelbild(), seiten: [neueSeite([t])] }
    expect(tafel.version).toBe(7)
    expect(pruefeTafel(JSON.parse(JSON.stringify(tafel)))).toEqual(tafel)
    const roh = (x: object) => pruefeTafel({ ...tafel, seiten: [{ id: 'a', elemente: [{ ...t, ...x }] }] })!.seiten[0].elemente
    expect(roh({ spalten: [] })).toEqual([])
    expect(roh({ zellen: [] })).toEqual([])
    expect(roh({ spalten: [100, -5] })).toEqual([])
    expect(roh({ groesse: 2 })).toEqual([])
    // fehlende Zellen werden leer, zu viele abgeschnitten, kein Text: leer
    expect((roh({ zellen: [['a'], ['b', 'c', 'd', 'e'], 7] })[0] as Tabelle).zellen).toEqual([['a', '', ''], ['b', 'c', 'd'], ['', '', '']])
    expect(roh({ kopf: 'ja' })[0]).not.toHaveProperty('kopf')
  })
})

describe('Tabelle – Bedienung', () => {
  const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
  const flaeche = () => screen.getByTestId('zeichenflaeche')
  const tippe = (x: number, y: number) => {
    fireEvent.pointerDown(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
    fireEvent.pointerUp(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
  }
  const tabelle = async () => (await ladeLetzteTafel())?.seiten[0].elemente.find((e): e is Tabelle => e.art === 'tabelle')

  it('anlegen mit Zeilen/Spalten, Zellen beschreiben mit Tab und Enter, Rückgängig je Zelle', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild('Tabelle', 'unendlich'), seiten: [neueSeite()] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Tabelle' }))
    tippe(100, 80)
    const feld = within(screen.getByRole('dialog', { name: 'Tabelle einfügen' }))
    await nutzer.click(feld.getByRole('button', { name: 'Spalten: weniger' }))
    await nutzer.click(feld.getByRole('button', { name: 'Zeilen: weniger' }))
    await nutzer.click(feld.getByRole('button', { name: 'Einfügen' }))
    expect(screen.queryByRole('dialog', { name: 'Tabelle einfügen' })).not.toBeInTheDocument()

    expect(screen.getByRole('textbox', { name: 'Zelle 1/1 der Tabelle' })).toHaveFocus()
    await nutzer.keyboard('Vogel{Tab}Anzahl{Enter}Spatz{Tab}12{Tab}')
    // am Ende kam eine Zeile dazu
    await waitFor(async () => expect((await tabelle())?.zellen).toEqual([['Vogel', 'Anzahl'], ['Spatz', '12'], ['', '']]))
    expect(screen.getByRole('textbox', { name: 'Zelle 3/1 der Tabelle' })).toBeInTheDocument()
    await nutzer.keyboard('{Escape}')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' })) // die neue Zeile samt „12“
    await waitFor(async () => expect((await tabelle())?.zellen).toEqual([['Vogel', 'Anzahl'], ['Spatz', '']]))
  }, 20_000)

  it('Auswahlleiste: Zeile und Spalte anfügen und entfernen, Kopfzeile aus; Zelle mit dem Text-Werkzeug ändern', async () => {
    const nutzer = userEvent.setup()
    const t = mitZelle(t3(), 1, 1, 'alt')
    await speichereTafel({ ...neuesTafelbild('Tabelle', 'unendlich'), seiten: [neueSeite([t])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Auswahl' }))
    tippe(150, 60)
    const leiste = within(await screen.findByRole('toolbar', { name: 'Befehle für die Auswahl' }))
    await nutzer.click(leiste.getByRole('button', { name: 'Zeile hinzufügen' }))
    await waitFor(async () => expect((await tabelle())?.zellen).toHaveLength(4))
    await nutzer.click(leiste.getByRole('button', { name: 'Spalte hinzufügen' }))
    await waitFor(async () => expect((await tabelle())?.spalten).toHaveLength(4))
    await nutzer.click(leiste.getByRole('button', { name: 'Letzte Spalte entfernen' }))
    await nutzer.click(leiste.getByRole('button', { name: 'Letzte Zeile entfernen' }))
    await nutzer.click(leiste.getByRole('button', { name: 'Kopfzeile aus' }))
    await waitFor(async () => expect(await tabelle()).toEqual({ ...t, kopf: undefined }))
    expect((await tabelle())?.kopf).toBeUndefined()

    // Text-Werkzeug auf eine Zelle: diese Zelle beschreiben
    await nutzer.click(screen.getByRole('button', { name: 'Text' }))
    const [x, y] = [t.x + 120 + 60, t.y + zeilenHoehen(t)[0] + 5]
    tippe(x, y)
    const zelle = screen.getByRole('textbox', { name: 'Zelle 2/2 der Tabelle' })
    expect(zelle).toHaveValue('alt')
    await nutzer.clear(zelle)
    await nutzer.type(zelle, 'neu')
    tippe(700, 500) // daneben tippen übernimmt
    await waitFor(async () => expect((await tabelle())?.zellen[1][1]).toBe('neu'))
    expect((await ladeLetzteTafel())?.seiten[0].elemente).toHaveLength(1) // kein Textfeld angelegt
  }, 20_000)

  it('Spaltenbreite ziehen an der Trennlinie der ausgewählten Tabelle – ein Schritt im Verlauf', async () => {
    const nutzer = userEvent.setup()
    const t = t3()
    await speichereTafel({ ...neuesTafelbild('Tabelle', 'unendlich'), seiten: [neueSeite([t])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Auswahl' }))
    tippe(150, 60)
    await screen.findByRole('toolbar', { name: 'Befehle für die Auswahl' })
    const y = t.y + 30
    fireEvent.pointerDown(flaeche(), { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 220, clientY: y })
    fireEvent.pointerMove(flaeche(), { pointerId: 2, pointerType: 'mouse', clientX: 270, clientY: y + 40 })
    fireEvent.pointerUp(flaeche(), { pointerId: 2, pointerType: 'mouse', clientX: 270, clientY: y + 40 })
    await waitFor(async () => expect((await tabelle())?.spalten).toEqual([170, 120, 120]))
    expect((await tabelle())).toMatchObject({ x: 100, y: 50 }) // nicht verschoben
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect((await tabelle())?.spalten).toEqual([120, 120, 120]))
  })

  it('den Würfel gibt es nicht mehr', async () => {
    render(<Tafel />)
    await bereit()
    expect(screen.queryByRole('button', { name: 'Würfel' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stoppuhr' })).toBeInTheDocument()
  })
})
