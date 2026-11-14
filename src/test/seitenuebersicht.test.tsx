// Hintergründe Etappe 4: Seitenübersicht (Ü1) – Logik in kern/seiten.ts und Bedienung.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { neueSeite, neuesTafelbild, type Seite, type Strich } from '../kern/modell.ts'
import { inReihenfolge, seiteDoppeltBei, seiteVerschieben, seiteWegBei, type Buch } from '../kern/seiten.ts'
import { ladeLetzteTafel, speichereTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {
    moveTo() {}
    lineTo() {}
    arc() {}
  } as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, 0, 0.5], [100, 0, 0.5]] })
const seite = (id: string, beschrieben = true): Seite => ({ id, elemente: beschrieben ? [strich('s' + id)] : [] })
const buch = (nr = 0): Buch => ({ seiten: ['a', 'b', 'c', 'd'].map((id) => seite(id)), nr })
const ids = (b: Buch) => b.seiten.map((s) => s.id).join('')

describe('Seitenübersicht – Logik', () => {
  it('verschiebt eine Seite an eine andere Stelle; die gezeigte Seite bleibt die gezeigte', () => {
    const b = seiteVerschieben(buch(1), 0, 2)
    expect(ids(b)).toBe('bcad')
    expect(b.seiten[b.nr].id).toBe('b')
    const c = seiteVerschieben(buch(0), 0, 3)
    expect(ids(c)).toBe('bcda')
    expect(c.nr).toBe(3)
    expect(seiteVerschieben(buch(), 2, 2)).toEqual(buch())
    expect(seiteVerschieben(buch(), 0, 9).seiten).toHaveLength(4)
  })

  it('stellt eine Reihenfolge wieder her', () => {
    const b = inReihenfolge(seiteVerschieben(buch(2), 3, 0), ['a', 'b', 'c', 'd'])
    expect(ids(b)).toBe('abcd')
    expect(b.nr).toBe(2)
  })

  it('dupliziert und löscht an einer Stelle, ohne die gezeigte Seite zu wechseln', () => {
    const d = seiteDoppeltBei(buch(3), 0)
    expect(d.seiten).toHaveLength(5)
    expect(d.seiten[1].elemente[0].id).not.toBe('sa') // neue Kennungen
    expect(d.seiten[d.nr].id).toBe('d')
    const w = seiteWegBei(buch(3), 1)
    expect(ids(w)).toBe('acd')
    expect(w.seiten[w.nr].id).toBe('d')
    const selbst = seiteWegBei(buch(1), 1) // die gezeigte selbst: die nächste rückt nach
    expect(selbst.seiten[selbst.nr].id).toBe('c')
  })
})

describe('Seitenübersicht – Bedienung', () => {
  const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
  const reihenfolge = async () => (await ladeLetzteTafel())!.seiten.map((s) => s.id).join('')
  const oeffnen = async (nutzer: ReturnType<typeof userEvent.setup>) => {
    await nutzer.click(screen.getByRole('button', { name: 'Seitenübersicht' }))
    return screen.getByRole('dialog', { name: 'Seitenübersicht' })
  }
  const vorlage = () => speichereTafel({ ...neuesTafelbild('Vier'), seiten: [seite('a'), seite('b'), seite('c'), seite('d', false)] })

  it('zeigt alle Seiten, hebt die aktuelle hervor; Antippen öffnet eine Seite, Escape schließt', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    let feld = await oeffnen(nutzer)
    expect(within(feld).getAllByRole('button', { name: /^Seite \d öffnen$/ })).toHaveLength(4)
    expect(within(feld).getByRole('button', { name: 'Seite 1 öffnen' })).toHaveAttribute('aria-current', 'page')
    await nutzer.click(within(feld).getByRole('button', { name: 'Seite 3 öffnen' }))
    expect(screen.queryByRole('dialog', { name: 'Seitenübersicht' })).toBeNull()
    expect(screen.getByText('Seite 3 von 4')).toBeInTheDocument()
    feld = await oeffnen(nutzer)
    expect(within(feld).getByRole('button', { name: 'Seite 3 öffnen' })).toHaveAttribute('aria-current', 'page')
    await nutzer.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Seitenübersicht' })).toBeNull()
    expect(screen.getByText('Seite 3 von 4')).toBeInTheDocument()
  })

  it('Duplizieren, Löschen mit Rückfrage (leere Seite ohne), neue Seite am Ende', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    const feld = await oeffnen(nutzer)
    await nutzer.click(within(feld).getByRole('button', { name: 'Seite 2 duplizieren' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten).toHaveLength(5))
    expect(within(feld).getByRole('button', { name: 'Seite 1 öffnen' })).toHaveAttribute('aria-current', 'page')
    await nutzer.click(within(feld).getByRole('button', { name: 'Seite 1 löschen' }))
    const frage = within(feld).getByRole('group', { name: 'Seite 1 löschen?' })
    await nutzer.click(within(frage).getByRole('button', { name: 'Nein' }))
    expect(await reihenfolge()).toMatch(/^ab.{6,}cd$/)
    await nutzer.click(within(feld).getByRole('button', { name: 'Seite 1 löschen' }))
    await nutzer.click(within(feld).getByRole('button', { name: 'Ja' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten.map((s) => s.id)[0]).toBe('b'))
    await nutzer.click(within(feld).getByRole('button', { name: 'Seite 4 löschen' })) // leer: ohne Rückfrage
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten).toHaveLength(3))
    await nutzer.click(within(feld).getByRole('button', { name: 'Neue Seite' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten).toHaveLength(4))
    expect(within(feld).getByRole('button', { name: 'Seite 4 öffnen' })).toHaveAttribute('aria-current', 'page')
  })

  it('Ziehen mit der Maus sortiert um; „Reihenfolge zurücksetzen“ nimmt es zurück', async () => {
    const nutzer = userEvent.setup()
    await vorlage()
    render(<Tafel />)
    await bereit()
    const feld = await oeffnen(nutzer)
    // Kacheln nebeneinander, je 100 Pixel breit
    for (const el of feld.querySelectorAll<HTMLElement>('[data-nr]')) {
      const i = Number(el.dataset.nr)
      el.getBoundingClientRect = () => ({ left: i * 100, right: i * 100 + 90, top: 0, bottom: 100, width: 90, height: 100, x: i * 100, y: 0, toJSON: () => '' })
    }
    const kachel = feld.querySelector<HTMLElement>('[data-nr="0"]')!
    const basis = { pointerId: 3, pointerType: 'mouse', button: 0 }
    fireEvent.pointerDown(kachel, { ...basis, clientX: 40, clientY: 50 })
    fireEvent.pointerMove(kachel, { ...basis, clientX: 150, clientY: 50 })
    fireEvent.pointerMove(kachel, { ...basis, clientX: 240, clientY: 50 })
    fireEvent.pointerUp(kachel, { ...basis, clientX: 240, clientY: 50 })
    await waitFor(async () => expect(await reihenfolge()).toBe('bcad'))
    expect(screen.getByRole('dialog', { name: 'Seitenübersicht' })).toBeInTheDocument() // Ziehen öffnet keine Seite
    expect(within(feld).getByRole('button', { name: 'Seite 3 öffnen' })).toHaveAttribute('aria-current', 'page') // die gezeigte wanderte mit
    await nutzer.click(within(feld).getByRole('button', { name: 'Reihenfolge zurücksetzen' }))
    await waitFor(async () => expect(await reihenfolge()).toBe('abcd'))
    await nutzer.click(within(feld).getByRole('button', { name: 'Fertig' }))
    expect(screen.getByText('Seite 1 von 4')).toBeInTheDocument()
  })

  it('solange die Übersicht offen ist, gelten die Tastenkürzel der Tafel nicht', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild('Zwei'), seiten: [neueSeite(), neueSeite()] })
    render(<Tafel />)
    await bereit()
    await oeffnen(nutzer)
    await nutzer.keyboard('{PageDown}')
    expect(screen.getByText('Seite 1 von 2')).toBeInTheDocument()
  })
})
