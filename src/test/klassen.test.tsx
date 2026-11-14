import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.tsx'
import { geaendert, klassenName, kopierteKlasse, neueKlasse, pruefeEingabe, pruefeKlasse, sortiert, type Klasse } from '../kern/klassen.ts'
import { neueSeite, neuesTafelbild, type Bild, type Strich } from '../kern/modell.ts'
import { raeumeDateienAuf, speichereDatei } from '../speicher/dateien.ts'
import { ladeAlleTafeln, ladeFreieTafel, ladeKlasse, ladeKlassen, ladeTafel, loescheKlasse, oeffneKlassenTafel, speichereKlasse, speichereTafel } from '../speicher/datenbank.ts'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

const klasse = (bezeichnung: string, fach = 'Biologie', mehr: Partial<Klasse> = {}): Klasse => ({ ...neueKlasse({ bezeichnung, fach, jahrgang: '' }), ...mehr })
const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, 0, 0.5], [100, 0, 0.5]] })
const zeige = (adresse: string) =>
  render(
    <MemoryRouter initialEntries={[adresse]}>
      <App />
    </MemoryRouter>,
  )

describe('Klassen – Logik', () => {
  it('legt Klassen bereinigt an und prüft die Eingabe', () => {
    const k = neueKlasse({ bezeichnung: '  7b ', fach: ' Biologie  ', jahrgang: '7' })
    expect(k).toMatchObject({ bezeichnung: '7b', fach: 'Biologie', jahrgang: '7', archiviert: false, tafelId: null, version: 3, schueler: [] })
    expect(k.id).toMatch(/^[0-9a-f]{24}$/)
    expect(klassenName(k)).toBe('7b Biologie')
    expect(klassenName({ bezeichnung: 'Q1', fach: '' })).toBe('Q1')
    expect(pruefeEingabe({ bezeichnung: ' ', fach: '', jahrgang: '' })).toEqual(['Bitte eine Bezeichnung eingeben, z. B. „7b“.'])
    expect(pruefeEingabe({ bezeichnung: 'x'.repeat(31), fach: '', jahrgang: '' })).toHaveLength(1)
    expect(pruefeEingabe({ bezeichnung: '7b', fach: 'Sport', jahrgang: '' })).toEqual([])
  })

  it('ändert, kopiert und sortiert (aktive zuerst, 5a vor 10b)', () => {
    const k = klasse('7b', 'Biologie', { tafelId: 'aabbccdd0011' })
    expect(geaendert(k, { bezeichnung: '  ', fach: 'Sport' })).toMatchObject({ id: k.id, bezeichnung: '7b', fach: 'Sport', tafelId: 'aabbccdd0011' })
    const kopie = kopierteKlasse(k)
    expect(kopie).toMatchObject({ bezeichnung: '7b (Kopie)', fach: 'Biologie', tafelId: null, archiviert: false })
    expect(kopie.id).not.toBe(k.id)
    const liste = [klasse('10b'), klasse('5a', 'Sport'), klasse('Q1', 'Biologie', { archiviert: true }), klasse('5a', 'Biologie')]
    expect(sortiert(liste).map(klassenName)).toEqual(['5a Biologie', '5a Sport', '10b Biologie', 'Q1 Biologie'])
  })

  it('prüft gespeicherte Klassen', () => {
    const k = klasse('7b')
    expect(pruefeKlasse(JSON.parse(JSON.stringify(k)))).toEqual(k)
    expect(pruefeKlasse({ ...k, version: 4 })).toBeNull()
    expect(pruefeKlasse({ ...k, id: '../x' })).toBeNull()
    expect(pruefeKlasse({ ...k, bezeichnung: '  ' })).toBeNull()
    expect(pruefeKlasse({ ...k, tafelId: 'kein gültiger wert', archiviert: 'ja' })).toMatchObject({ tafelId: null, archiviert: false })
    expect(pruefeKlasse(null)).toBeNull()
  })
})

describe('Klassen – Speicher', () => {
  it('speichert, lädt und löscht Klassen samt ihrer Tafel', async () => {
    const tafel = neuesTafelbild('7b Biologie')
    await speichereTafel(tafel)
    const k = klasse('7b', 'Biologie', { tafelId: tafel.id })
    await speichereKlasse(k)
    await speichereKlasse(klasse('9a'))
    expect((await ladeKlassen()).map((x) => x.bezeichnung).sort()).toEqual(['7b', '9a'])
    expect(await ladeKlasse(k.id)).toEqual(k)
    await loescheKlasse(k)
    expect(await ladeKlasse(k.id)).toBeNull()
    expect(await ladeTafel(tafel.id)).toBeNull()
    expect(await ladeKlassen()).toHaveLength(1)
  })

  it('die freie Tafel ist nie die Tafel einer Klasse', async () => {
    expect(await ladeFreieTafel()).toBeNull()
    const klassenTafel = neuesTafelbild('7b')
    await speichereKlasse(klasse('7b', 'Biologie', { tafelId: klassenTafel.id }))
    await speichereTafel(klassenTafel) // zuletzt benutzt ist jetzt die Klassentafel
    expect(await ladeFreieTafel()).toBeNull()
    const frei = neuesTafelbild('Tafel')
    await speichereTafel(frei)
    expect((await ladeFreieTafel())?.id).toBe(frei.id)
    await speichereTafel(klassenTafel) // danach wieder mit der Klasse gearbeitet: die freie Tafel bleibt dieselbe
    expect((await ladeFreieTafel())?.id).toBe(frei.id)
  })

  it('Bilder anderer Tafeln bleiben beim Aufräumen erhalten', async () => {
    const a = await speichereDatei(new Blob(['a'], { type: 'image/png' }))
    const b = await speichereDatei(new Blob(['b'], { type: 'image/png' }))
    const bild = (dateiId: string): Bild => ({ art: 'bild', id: 'x' + dateiId, x: 0, y: 0, b: 10, h: 10, dateiId })
    const frei = { ...neuesTafelbild(), seiten: [neueSeite([bild(a)])] }
    const klassenTafel = { ...neuesTafelbild('7b'), seiten: [neueSeite([bild(b)])] }
    const k = klasse('7b', 'Biologie', { tafelId: klassenTafel.id })
    await speichereTafel(klassenTafel)
    await speichereKlasse(k)
    await speichereTafel(frei)
    expect(await ladeAlleTafeln()).toHaveLength(2)
    zeige('/tafel') // öffnet die freie Tafel und räumt auf
    await screen.findByText('Auf diesem Gerät gespeichert')
    await waitFor(async () => expect(await raeumeDateienAuf(new Set([a, b]))).toBe(0)) // beide Dateien sind noch da
    expect(await raeumeDateienAuf(new Set())).toBe(2)
  })
})

describe('Seite „Meine Klassen“', () => {
  it('legt die erste Klasse an und prüft die Eingabe', async () => {
    const nutzer = userEvent.setup()
    zeige('/klassen')
    expect(await screen.findByText(/Noch keine Klasse/)).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Neue Klasse anlegen' }))
    await nutzer.click(screen.getByRole('button', { name: 'Klasse anlegen' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte eine Bezeichnung eingeben')
    await nutzer.type(screen.getByLabelText('Bezeichnung'), '7b')
    await nutzer.type(screen.getByLabelText('Fach'), 'Biologie')
    await nutzer.type(screen.getByLabelText(/Jahrgang/), '7')
    await nutzer.click(screen.getByRole('button', { name: 'Klasse anlegen' }))
    expect(await screen.findByRole('heading', { name: '7b' })).toBeInTheDocument()
    expect(screen.getByText('Biologie · Jahrgang 7')).toBeInTheDocument()
    expect(await ladeKlassen()).toMatchObject([{ bezeichnung: '7b', fach: 'Biologie', jahrgang: '7' }])
    expect(screen.getByRole('link', { name: 'Zur Tafel von 7b Biologie' })).toHaveAttribute('href', expect.stringMatching(/^#\/tafel\?klasse=[0-9a-f]{24}$/))
  })

  it('öffnet mit ?neu=1 gleich das Formular', async () => {
    zeige('/klassen?neu=1')
    expect(await screen.findByRole('form', { name: 'Neue Klasse' })).toBeInTheDocument()
    expect(screen.getByLabelText('Bezeichnung')).toHaveFocus()
  })

  it('bearbeitet, kopiert, archiviert und stellt wieder her', async () => {
    const nutzer = userEvent.setup()
    await speichereKlasse(klasse('9a', 'Biologie'))
    zeige('/klassen')
    const aktionen = () => within(screen.getByRole('group', { name: /^Aktionen für 9a/ }))
    await screen.findByRole('heading', { name: '9a' })
    await nutzer.click(aktionen().getByRole('button', { name: 'Bearbeiten' }))
    await nutzer.clear(screen.getByLabelText('Fach'))
    await nutzer.type(screen.getByLabelText('Fach'), 'Sport')
    await nutzer.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Sport')).toBeInTheDocument()

    await nutzer.click(aktionen().getByRole('button', { name: 'Kopieren' }))
    expect(await screen.findByRole('heading', { name: '9a (Kopie)' })).toBeInTheDocument()

    await nutzer.click(within(screen.getByRole('group', { name: 'Aktionen für 9a Sport' })).getByRole('button', { name: 'Archivieren' }))
    const archiv = await screen.findByRole('region', { name: 'Archiv' })
    expect(within(archiv).getByRole('heading', { name: '9a' })).toBeInTheDocument()
    expect(within(archiv).queryByRole('link', { name: /Zur Tafel/ })).not.toBeInTheDocument() // archivierte Klassen öffnen keine Tafel
    await nutzer.click(within(archiv).getByRole('button', { name: 'Wiederherstellen' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Archiv' })).not.toBeInTheDocument())
    expect((await ladeKlassen()).map((k) => [k.bezeichnung, k.fach, k.archiviert])).toEqual(expect.arrayContaining([['9a', 'Sport', false], ['9a (Kopie)', 'Sport', false]]))
  })

  it('löscht erst nach Rückfrage – samt der Tafel der Klasse', async () => {
    const nutzer = userEvent.setup()
    const tafel = { ...neuesTafelbild('Q1 Biologie'), seiten: [neueSeite([strich('s')])] }
    await speichereTafel(tafel)
    await speichereKlasse(klasse('Q1', 'Biologie', { tafelId: tafel.id }))
    zeige('/klassen')
    await screen.findByRole('heading', { name: 'Q1' })
    await nutzer.click(screen.getByRole('button', { name: 'Löschen' }))
    expect(screen.getByText('Klasse und ihre Tafel endgültig löschen?')).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Nein' }))
    expect(await ladeKlassen()).toHaveLength(1)
    await nutzer.click(screen.getByRole('button', { name: 'Löschen' }))
    await nutzer.click(screen.getByRole('button', { name: 'Ja, löschen' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Q1' })).not.toBeInTheDocument())
    expect(await ladeKlassen()).toEqual([])
    expect(await ladeTafel(tafel.id)).toBeNull()
  })
})

describe('Eine Tafel je Klasse', () => {
  const zieh = (y: number) => {
    const f = screen.getByTestId('zeichenflaeche')
    fireEvent.pointerDown(f, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: y })
    fireEvent.pointerMove(f, { pointerId: 1, pointerType: 'mouse', clientX: 90, clientY: y })
    fireEvent.pointerUp(f, { pointerId: 1, pointerType: 'mouse', clientX: 90, clientY: y })
  }

  it('legt beim ersten Öffnen die Tafel der Klasse an und merkt sie sich', async () => {
    const k = klasse('7b')
    await speichereKlasse(k)
    zeige(`/tafel?klasse=${k.id}`)
    expect(await screen.findByRole('heading', { name: '7b Biologie' })).toBeInTheDocument()
    zieh(40)
    await waitFor(async () => {
      const tafelId = (await ladeKlasse(k.id))?.tafelId
      expect(tafelId).toBeTruthy()
      expect((await ladeTafel(tafelId!))?.seiten[0].elemente).toHaveLength(1)
    })
    expect(screen.getByRole('link', { name: 'Meine Klassen' })).toHaveAttribute('href', '#/klassen')
  })

  it('jede Klasse und die freie Tafel behalten ihren eigenen Inhalt', async () => {
    const tafelA = { ...neuesTafelbild('7b Biologie'), seiten: [neueSeite([strich('a1'), strich('a2')])] }
    const a = klasse('7b', 'Biologie', { tafelId: tafelA.id })
    const b = klasse('9a', 'Sport')
    const frei = { ...neuesTafelbild('Tafel'), seiten: [neueSeite([strich('f')])] }
    await speichereKlasse(a)
    await speichereKlasse(b)
    await speichereTafel(tafelA)
    await speichereTafel(frei) // zuletzt wurde an der freien Tafel gearbeitet (wie vor der Einführung der Klassen)

    const { unmount } = zeige(`/tafel?klasse=${b.id}`)
    expect(await screen.findByRole('heading', { name: '9a Sport' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeDisabled() // neue, leere Tafel
    zieh(60)
    await waitFor(async () => expect((await ladeTafel((await ladeKlasse(b.id))!.tafelId!))?.seiten[0].elemente).toHaveLength(1))
    unmount()

    expect((await ladeTafel(tafelA.id))?.seiten[0].elemente).toHaveLength(2)
    expect((await ladeFreieTafel())?.seiten[0].elemente.map((e) => e.id)).toEqual(['f'])
    zeige('/tafel')
    expect(await screen.findByRole('heading', { name: 'Tafel' })).toBeInTheDocument()
    // (die Überschrift steht schon vor dem Laden da – auf den Inhalt warten)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeEnabled())
  })

  it('legt auch bei doppeltem Öffnen nur eine Tafel an (z. B. schnelles Neuladen)', async () => {
    const k = klasse('7b')
    await speichereKlasse(k)
    const [a, b] = await Promise.all([oeffneKlassenTafel(k.id), oeffneKlassenTafel(k.id)])
    expect(a?.id).toBe(b?.id)
    expect(await ladeAlleTafeln()).toHaveLength(1)
    // …und ebenso, wenn die Seite ihre Ladeschritte doppelt ausführt (Entwicklungsmodus)
    render(
      <StrictMode>
        <MemoryRouter initialEntries={[`/tafel?klasse=${k.id}`]}>
          <App />
        </MemoryRouter>
      </StrictMode>,
    )
    expect(await screen.findByRole('heading', { name: '7b Biologie' })).toBeInTheDocument()
    expect(await ladeAlleTafeln()).toHaveLength(1)
    expect((await ladeKlasse(k.id))?.tafelId).toBe(a?.id)
    expect(await oeffneKlassenTafel('0123456789abcdef01234567')).toBeNull()
  })

  it('die freie Tafel ist nach dem Neuladen wieder da – auch im Entwicklungsmodus', async () => {
    const einmal = () =>
      render(
        <StrictMode>
          <MemoryRouter initialEntries={['/tafel']}>
            <App />
          </MemoryRouter>
        </StrictMode>,
      )
    const { unmount } = einmal()
    await screen.findByText('Auf diesem Gerät gespeichert')
    zieh(40)
    await waitFor(async () => expect((await ladeFreieTafel())?.seiten[0].elemente).toHaveLength(1))
    unmount()
    einmal()
    await screen.findByText('Auf diesem Gerät gespeichert')
    expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeEnabled()
    expect(await ladeAlleTafeln()).toHaveLength(1)
  })

  it('zeigt einen Hinweis, wenn es die Klasse auf diesem Gerät nicht gibt', async () => {
    zeige('/tafel?klasse=0123456789abcdef01234567')
    expect(await screen.findByRole('heading', { name: 'Diese Klasse gibt es auf diesem Gerät nicht' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zu meinen Klassen' })).toHaveAttribute('href', '#/klassen')
    expect(await ladeAlleTafeln()).toEqual([]) // es wurde nichts angelegt
  })

  it('eine ungültige Kennung in der Adresse öffnet die freie Tafel', async () => {
    zeige('/tafel?klasse=../../boese')
    expect(await screen.findByRole('heading', { name: 'Tafel' })).toBeInTheDocument()
  })
})
