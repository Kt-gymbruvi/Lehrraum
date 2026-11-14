import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { aendere, begrenze, MAX_FENSTER, nachVorn, pruefeFenster, schalte, schliesse, stoppText, zeitText, type FensterZustand } from '../kern/fenster.ts'
import { neuesTafelbild, pruefeTafel } from '../kern/modell.ts'
import { ladeLetzteTafel, speichereTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})

describe('Fenster-Logik', () => {
  it('öffnet Fenster versetzt; Einzelfenster schalten ein und aus, Notizen kommen dazu', () => {
    let l = schalte([], 'uhr')
    l = schalte(l, 'timer')
    expect(l.map((f) => f.art)).toEqual(['uhr', 'timer'])
    expect([l[1].x, l[1].y]).not.toEqual([l[0].x, l[0].y])
    l = schalte(l, 'uhr')
    expect(l.map((f) => f.art)).toEqual(['timer'])
    l = schalte(schalte(l, 'notiz'), 'notiz')
    expect(l.map((f) => f.art)).toEqual(['timer', 'notiz', 'notiz'])
    expect(l[1]).toMatchObject({ text: '', farbe: 'gelb' })
    expect(l[2].farbe).toBe('gruen')
  })

  it('begrenzt die Anzahl der Fenster', () => {
    let l: FensterZustand[] = []
    for (let i = 0; i < MAX_FENSTER + 5; i++) l = schalte(l, 'notiz')
    expect(l).toHaveLength(MAX_FENSTER)
  })

  it('schließen, ändern, nach vorne holen', () => {
    const l = schalte(schalte(schalte([], 'uhr'), 'timer'), 'stoppuhr')
    expect(nachVorn(l, l[0].id).map((f) => f.art)).toEqual(['timer', 'stoppuhr', 'uhr'])
    expect(nachVorn(l, l[2].id)).toBe(l) // schon vorne: keine neue Liste
    expect(nachVorn(l, 'fremd')).toBe(l)
    expect(schliesse(l, l[1].id).map((f) => f.art)).toEqual(['uhr', 'stoppuhr'])
    expect(aendere(l, l[0].id, { x: 300, eingeklappt: true })[0]).toMatchObject({ art: 'uhr', x: 300, eingeklappt: true })
  })

  it('hält Fenster beim Verschieben erreichbar', () => {
    expect(begrenze(100, 80, 1000, 600, 300)).toEqual([100, 80])
    expect(begrenze(5000, 5000, 1000, 600, 300)).toEqual([944, 544])
    expect(begrenze(-5000, -50, 1000, 600, 300)).toEqual([-244, 0])
  })

  it('prüft gespeicherte Fenster', () => {
    const l = pruefeFenster([
      { id: 'a', art: 'uhr', x: 10.4, y: 20, eingeklappt: true },
      { id: 'b', art: 'uhr', x: 0, y: 0 }, // zweite Uhr: nicht erlaubt
      { id: 'a', art: 'timer' }, // doppelte Kennung
      { id: 'c', art: 'rakete' },
      { id: 'd', art: 'notiz', text: 'Hefte einsammeln', farbe: 'lila', x: 'links', y: 1e9 },
      'unsinn',
    ])
    expect(l).toEqual([
      { id: 'a', art: 'uhr', x: 10, y: 20, eingeklappt: true },
      { id: 'd', art: 'notiz', x: 0, y: 20000, eingeklappt: false, text: 'Hefte einsammeln', farbe: 'gelb' },
    ])
    expect(pruefeFenster(undefined)).toEqual([])
  })

  it('Tafeln aus der ersten Fassung (ohne Fenster) bleiben ladbar', () => {
    const { fenster: _weg, ...alt } = neuesTafelbild()
    expect(pruefeTafel(alt)?.fenster).toEqual([])
  })

  it('schreibt Zeiten lesbar', () => {
    expect(zeitText(0)).toBe('0:00')
    expect(zeitText(125_000)).toBe('2:05')
    expect(zeitText(3_725_000)).toBe('1:02:05')
    expect(zeitText(59_001, true)).toBe('1:00') // Countdown rundet auf
    expect(zeitText(-5)).toBe('0:00')
    expect(stoppText(61_234)).toBe('1:01,2')
  })

  it('ein gespeichertes Würfel-Fenster (gibt es nicht mehr) fällt beim Laden weg', () => {
    expect(pruefeFenster([{ id: 'w', art: 'wuerfel', x: 1, y: 1 }, { id: 'u', art: 'uhr', x: 1, y: 1 }]).map((f) => f.art)).toEqual(['uhr'])
  })
})

describe('Fenster über der Tafel', () => {
  const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
  const leiste = () => within(screen.getByRole('complementary', { name: 'Unterrichtswerkzeuge' }))

  it('öffnet und schließt die Uhr über die rechte Leiste', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    expect(screen.queryByRole('region', { name: 'Uhr' })).not.toBeInTheDocument()
    await nutzer.click(leiste().getByRole('button', { name: 'Uhr' }))
    expect(within(screen.getByRole('region', { name: 'Uhr' })).getByRole('timer', { name: 'Uhrzeit' })).toHaveTextContent(/^\d\d:\d\d\d\d$/)
    expect(leiste().getByRole('button', { name: 'Uhr' })).toHaveAttribute('aria-pressed', 'true')
    await nutzer.click(screen.getByRole('button', { name: 'Uhr schließen' }))
    expect(screen.queryByRole('region', { name: 'Uhr' })).not.toBeInTheDocument()
  })

  it('die Tafel bleibt beim Öffnen von Fenstern erhalten und beschreibbar', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    const f = screen.getByTestId('zeichenflaeche')
    const zieh = (y: number) => {
      fireEvent.pointerDown(f, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: y })
      fireEvent.pointerMove(f, { pointerId: 1, pointerType: 'mouse', clientX: 90, clientY: y })
      fireEvent.pointerUp(f, { pointerId: 1, pointerType: 'mouse', clientX: 90, clientY: y })
    }
    zieh(400)
    await nutzer.click(leiste().getByRole('button', { name: 'Uhr' }))
    await nutzer.click(leiste().getByRole('button', { name: 'Stoppuhr' }))
    zieh(450)
    await waitFor(async () => {
      const t = await ladeLetzteTafel()
      expect(t?.seiten[0].elemente).toHaveLength(2)
      expect(t?.fenster.map((x) => x.art)).toEqual(['uhr', 'stoppuhr'])
    })
  })

  it('Notiz: Text und Farbe werden gespeichert und nach dem Schließen der Seite wiederhergestellt', async () => {
    const nutzer = userEvent.setup()
    const { unmount } = render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Neue Notiz' }))
    await nutzer.type(screen.getByRole('textbox', { name: 'Notiztext' }), 'Hefte einsammeln')
    await nutzer.click(screen.getByRole('button', { name: 'Notizfarbe Blau' }))
    await waitFor(async () => expect((await ladeLetzteTafel())?.fenster[0]).toMatchObject({ art: 'notiz', text: 'Hefte einsammeln', farbe: 'blau' }))
    unmount()
    render(<Tafel />)
    expect(await screen.findByDisplayValue('Hefte einsammeln')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stift' })).toHaveAttribute('aria-pressed', 'true') // Tippen von „s“ oder „m“ in der Notiz wechselt kein Werkzeug
  })

  it('einklappen versteckt den Inhalt, das Fenster bleibt', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), fenster: [{ id: 'w', art: 'stoppuhr', x: 40, y: 40, eingeklappt: false }] })
    render(<Tafel />)
    const fenster = await screen.findByRole('region', { name: 'Stoppuhr' })
    expect(within(fenster).getByRole('timer', { name: 'Gestoppte Zeit' })).toBeVisible()
    await nutzer.click(screen.getByRole('button', { name: 'Stoppuhr einklappen' }))
    expect(within(fenster).queryByRole('timer', { name: 'Gestoppte Zeit' })).not.toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Stoppuhr ausklappen' }))
    expect(within(fenster).getByRole('timer', { name: 'Gestoppte Zeit' })).toBeVisible()
  })

  it('verschiebt ein Fenster an der Titelzeile', async () => {
    await speichereTafel({ ...neuesTafelbild(), fenster: [{ id: 'u', art: 'uhr', x: 40, y: 40, eingeklappt: false }] })
    render(<Tafel />)
    const fenster = await screen.findByRole('region', { name: 'Uhr' })
    const flaeche = fenster.parentElement!
    Object.defineProperty(flaeche, 'clientWidth', { value: 1000 })
    Object.defineProperty(flaeche, 'clientHeight', { value: 700 })
    const titel = within(fenster).getByRole('heading', { name: 'Uhr' }).parentElement!
    fireEvent.pointerDown(titel, { pointerId: 3, pointerType: 'touch', clientX: 100, clientY: 60 })
    fireEvent.pointerMove(titel, { pointerId: 3, pointerType: 'touch', clientX: 400, clientY: 260 })
    fireEvent.pointerUp(titel, { pointerId: 3, pointerType: 'touch', clientX: 400, clientY: 260 })
    await waitFor(async () => expect((await ladeLetzteTafel())?.fenster[0]).toMatchObject({ x: 340, y: 240 }))
  })
  describe('mit gestellter Zeit', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
    afterEach(() => vi.useRealTimers())

    it('Timer: zählt herunter, pausiert, meldet das Ende', async () => {
      const nutzer = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await speichereTafel({ ...neuesTafelbild(), fenster: [{ id: 't', art: 'timer', x: 40, y: 40, eingeklappt: false }] })
      render(<Tafel />)
      const zeit = await screen.findByRole('timer', { name: 'Restzeit' })
      expect(zeit).toHaveTextContent('5:00')
      await nutzer.click(screen.getByRole('button', { name: '1 Minuten' }))
      expect(zeit).toHaveTextContent('1:00')
      await nutzer.click(screen.getByRole('button', { name: 'Start' }))
      act(() => void vi.advanceTimersByTime(20_000))
      expect(zeit).toHaveTextContent('0:40')
      await nutzer.click(screen.getByRole('button', { name: 'Pause' }))
      act(() => void vi.advanceTimersByTime(30_000))
      expect(zeit).toHaveTextContent('0:40') // pausiert
      await nutzer.click(screen.getByRole('button', { name: 'Start' }))
      act(() => void vi.advanceTimersByTime(41_000))
      expect(zeit).toHaveTextContent('0:00')
      expect(screen.getByText('Die Zeit ist um.')).toBeInTheDocument()
      await nutzer.click(screen.getByRole('button', { name: 'Zurück' }))
      expect(zeit).toHaveTextContent('1:00')
    })

    it('Stoppuhr: läuft, hält an, läuft weiter, setzt zurück', async () => {
      const nutzer = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await speichereTafel({ ...neuesTafelbild(), fenster: [{ id: 's', art: 'stoppuhr', x: 40, y: 40, eingeklappt: false }] })
      render(<Tafel />)
      const zeit = await screen.findByRole('timer', { name: 'Gestoppte Zeit' })
      await nutzer.click(screen.getByRole('button', { name: 'Start' }))
      act(() => void vi.advanceTimersByTime(12_300))
      await nutzer.click(screen.getByRole('button', { name: 'Stopp' }))
      const erste = zeit.textContent!
      expect(erste).toMatch(/^0:12,[3-9]$/)
      act(() => void vi.advanceTimersByTime(5_000))
      expect(zeit).toHaveTextContent(erste)
      await nutzer.click(screen.getByRole('button', { name: 'Start' }))
      act(() => void vi.advanceTimersByTime(3_000))
      expect(zeit.textContent).toMatch(/^0:15,/)
      await nutzer.click(screen.getByRole('button', { name: 'Stopp' }))
      await nutzer.click(screen.getByRole('button', { name: 'Zurück' }))
      expect(zeit).toHaveTextContent('0:00,0')
    })
  })
})
