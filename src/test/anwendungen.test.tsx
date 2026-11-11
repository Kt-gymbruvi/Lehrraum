import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { pruefeFenster, schalte } from '../kern/fenster.ts'
import { neuesTafelbild } from '../kern/modell.ts'
import { ladeLetzteTafel, speichereTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'

// Der Server und die Liste der Lernangebote werden ersetzt – Tests sprechen nie mit dem echten Server.
const server = vi.hoisted(() => ({
  angemeldet: false,
  hoerer: [] as ((an: boolean) => void)[],
  aufrufe: [] as unknown[][],
  fehler: null as Error | null,
}))
vi.mock('../speicher/server.ts', async (original) => {
  const echt = await original<typeof import('../speicher/server.ts')>()
  const merke =
    <T,>(name: string, ergebnis: T) =>
    async (...args: unknown[]) => {
      server.aufrufe.push([name, ...args])
      if (server.fehler) throw server.fehler
      return ergebnis
    }
  return {
    fehlerText: echt.fehlerText,
    serverVorhanden: () => true,
    istAngemeldet: async () => server.angemeldet,
    beiAnmeldung: (tun: (an: boolean) => void) => {
      server.hoerer.push(tun)
      return () => undefined
    },
    melde_an: async (email: string, passwort: string) => {
      if (passwort !== 'richtig') throw new Error('Invalid login credentials')
      server.aufrufe.push(['melde_an', email])
      server.angemeldet = true
      server.hoerer.forEach((h) => h(true))
    },
    ladeQuizze: async () => [
      { id: 'q-herz', titel: 'Herz und Kreislauf', anzahl: 12, ordner: 'Klasse 7' },
      { id: 'q-evo', titel: 'Evolution', anzahl: 1, ordner: null },
      { id: 'q-leer', titel: 'Entwurf', anzahl: 0, ordner: null },
    ],
    starteSpiel: merke('starteSpiel', { id: 'spiel-123', pin: '111111' }),
    beendeSpiel: merke('beendeSpiel', undefined),
    ladePraesentationen: async () => [{ id: 'p-1', titel: 'Einstieg Ökologie', anzahl: 4 }],
    starteSitzung: merke('starteSitzung', { id: 'sitzung-9', pin: '222222' }),
    beendeSitzung: merke('beendeSitzung', undefined),
  }
})
vi.mock('../speicher/plattform.ts', async (original) => ({
  ...(await original<typeof import('../speicher/plattform.ts')>()),
  ladeLernangebote: async () => ({
    faecher: [
      { id: 'bio', name: 'Biologie' },
      { id: 'sport', name: 'Sport' },
    ],
    stufen: [
      { id: '7', name: 'Klasse 7' },
      { id: 'sek2', name: 'Klasse 12/13' },
    ],
    angebote: [
      { ordner: 'blut', titel: 'Blut', text: 'Blutkörperchen', fach: 'bio', stufen: ['7'] },
      { ordner: 'synapse', titel: 'Synapse', text: 'Reizweiterleitung', fach: 'bio', stufen: ['sek2'] },
      { ordner: 'taktikboard', titel: 'Taktikboard', text: 'Spielzüge', fach: 'sport', stufen: [] },
    ],
  }),
}))

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(() => {
  server.angemeldet = true
  server.hoerer = []
  server.aufrufe = []
  server.fehler = null
})

const leiste = () => within(screen.getByRole('complementary', { name: 'Unterrichtswerkzeuge' }))
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const rahmen = (name: string) => screen.getByTitle(name) as HTMLIFrameElement
const gespeichert = async () => (await ladeLetzteTafel())?.fenster ?? []

describe('Anwendungsfenster – Logik', () => {
  it('merkt sich Ziel und Größe nur bei Anwendungsfenstern und nur mit unbedenklichen Zeichen', () => {
    expect(
      pruefeFenster([
        { id: 'a', art: 'quizzo', x: 1, y: 2, ziel: '3f2b-77', gross: true },
        { id: 'b', art: 'lernangebote', x: 1, y: 2, ziel: '../../boese' },
        { id: 'c', art: 'uhr', x: 1, y: 2, ziel: 'abc', gross: true },
      ]),
    ).toEqual([
      { id: 'a', art: 'quizzo', x: 1, y: 2, eingeklappt: false, ziel: '3f2b-77', gross: true },
      { id: 'b', art: 'lernangebote', x: 1, y: 2, eingeklappt: false },
      { id: 'c', art: 'uhr', x: 1, y: 2, eingeklappt: false },
    ])
    expect(schalte(schalte([], 'quizzo'), 'quizzo')).toEqual([]) // höchstens ein Quizzo-Fenster
  })
})

describe('Quizzo aus der Tafel', () => {
  it('verlangt die Anmeldung, meldet falsche Passwörter verständlich und zeigt danach die Quizze', async () => {
    server.angemeldet = false
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Quizzo' }))
    await nutzer.click(await screen.findByRole('button', { name: 'Anmelden' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte E-Mail-Adresse und Passwort eingeben.')
    await nutzer.type(screen.getByLabelText('E-Mail'), 'lehrkraft@example.org')
    await nutzer.type(screen.getByLabelText('Passwort'), 'falsch')
    await nutzer.click(screen.getByRole('button', { name: 'Anmelden' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-Mail-Adresse oder Passwort ist falsch.')
    await nutzer.clear(screen.getByLabelText('Passwort'))
    await nutzer.type(screen.getByLabelText('Passwort'), 'richtig')
    await nutzer.click(screen.getByRole('button', { name: 'Anmelden' }))
    expect(await screen.findByText('Herz und Kreislauf')).toBeInTheDocument()
    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument()
  })

  it('startet ein Quiz im Teammodus, zeigt Quizzo im Fenster und merkt sich das laufende Spiel', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Quizzo' }))
    expect(await screen.findByText('Klasse 7 · 12 Fragen')).toBeInTheDocument()
    expect(screen.getByText('1 Frage')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entwurf starten' })).toBeDisabled() // ohne Fragen kein Spiel
    await nutzer.type(screen.getByRole('searchbox', { name: 'Quizze durchsuchen' }), 'herz')
    expect(screen.queryByText('Evolution')).not.toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Teams' }))
    await nutzer.selectOptions(screen.getByLabelText('Anzahl'), '4')
    await nutzer.click(screen.getByRole('button', { name: 'Herz und Kreislauf starten' }))
    await waitFor(() => expect(rahmen('Quizzo – laufendes Spiel').src).toMatch(/\/Quizzo\/#\/leiten\/spiel\/spiel-123$/))
    expect(server.aufrufe).toContainEqual(['starteSpiel', 'q-herz', 'team', 4])
    await waitFor(async () => expect((await gespeichert())[0]).toMatchObject({ art: 'quizzo', ziel: 'spiel-123' }))
  })

  it('beendet das Spiel erst nach Rückfrage und kehrt zur Auswahl zurück', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), fenster: [{ id: 'f', art: 'quizzo', x: 10, y: 10, eingeklappt: false, ziel: 'spiel-123' }] })
    render(<Tafel />)
    await waitFor(() => expect(rahmen('Quizzo – laufendes Spiel')).toBeInTheDocument()) // nach dem Neuladen läuft das Spiel weiter
    await nutzer.click(screen.getByRole('button', { name: 'Beenden' }))
    expect(screen.getByText('Spiel beenden? Alle Spieldaten werden gelöscht.')).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Nein' }))
    expect(server.aufrufe).toEqual([])
    await nutzer.click(screen.getByRole('button', { name: 'Beenden' }))
    await nutzer.click(screen.getByRole('button', { name: 'Ja, beenden' }))
    expect(await screen.findByText('Herz und Kreislauf')).toBeInTheDocument()
    expect(server.aufrufe).toEqual([['beendeSpiel', 'spiel-123']])
    await waitFor(async () => expect((await gespeichert())[0].ziel).toBeUndefined())
  })

  it('zeigt einen Fehler, wenn das Starten nicht klappt, und bleibt in der Auswahl', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Quizzo' }))
    const knopf = await screen.findByRole('button', { name: 'Evolution starten' })
    server.fehler = new Error('Failed to fetch')
    await nutzer.click(knopf)
    expect(await screen.findByRole('alert')).toHaveTextContent('Keine Verbindung zum Server.')
    expect(screen.queryByTitle('Quizzo – laufendes Spiel')).not.toBeInTheDocument()
  })

  it('lässt sich auf die ganze Fläche vergrößern; die Tafel bleibt erhalten', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), elemente: [{ art: 'strich', id: 's', werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[1, 1, 0.5], [9, 9, 0.5]] }] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Quizzo' }))
    await nutzer.click(screen.getByRole('button', { name: 'Quizzo vergrößern' }))
    expect(screen.getByRole('region', { name: 'Quizzo' })).toHaveClass('gross')
    await nutzer.click(screen.getByRole('button', { name: 'Quizzo verkleinern' }))
    expect(screen.getByRole('region', { name: 'Quizzo' })).not.toHaveClass('gross')
    await nutzer.click(screen.getByRole('button', { name: 'Quizzo schließen' }))
    await waitFor(async () => expect(await gespeichert()).toEqual([]))
    expect((await ladeLetzteTafel())?.elemente).toHaveLength(1)
  })
})

describe('Klassenfunk aus der Tafel', () => {
  it('startet eine Sitzung und beendet sie wieder', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Klassenfunk' }))
    expect(await screen.findByText('4 Folien')).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Einstieg Ökologie starten' }))
    await waitFor(() => expect(rahmen('Klassenfunk – laufende Sitzung').src).toMatch(/\/Klassenfunk\/#\/leiten\/sitzung\/sitzung-9$/))
    await nutzer.click(screen.getByRole('button', { name: 'Beenden' }))
    await nutzer.click(screen.getByRole('button', { name: 'Ja, beenden' }))
    expect(await screen.findByText('Einstieg Ökologie')).toBeInTheDocument()
    expect(server.aufrufe).toEqual([
      ['starteSitzung', 'p-1'],
      ['beendeSitzung', 'sitzung-9'],
    ])
  })
})

describe('Lernangebote in der Tafel', () => {
  it('filtert ohne Anmeldung nach Fach, Jahrgang und Suche, öffnet ein Angebot und zeigt den QR-Code', async () => {
    server.angemeldet = false
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Lernangebote' }))
    expect(await screen.findByText('Synapse')).toBeInTheDocument()
    await nutzer.selectOptions(screen.getByLabelText('Jahrgang'), '7')
    expect(screen.queryByText('Synapse')).not.toBeInTheDocument()
    expect(screen.getByText('Taktikboard')).toBeInTheDocument() // „für alle Jahrgänge“ bleibt
    await nutzer.selectOptions(screen.getByLabelText('Fach'), 'bio')
    expect(screen.queryByText('Taktikboard')).not.toBeInTheDocument()
    await nutzer.type(screen.getByRole('searchbox', { name: 'Lernangebote durchsuchen' }), 'gibt es nicht')
    expect(screen.getByText('Nichts gefunden.')).toBeInTheDocument()
    await nutzer.clear(screen.getByRole('searchbox', { name: 'Lernangebote durchsuchen' }))
    await nutzer.click(screen.getByRole('button', { name: 'Blut öffnen' }))
    expect(rahmen('Blut').src).toMatch(/\/lernen\/blut\/$/)
    await nutzer.click(screen.getByRole('button', { name: 'QR-Code für die Klasse' }))
    expect(await screen.findByRole('img', { name: 'QR-Code zu diesem Lernangebot' })).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml/))
    expect(screen.getByText(/\/lernen\/blut\/$/)).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: '← Auswahl' }))
    expect(screen.getByText('Synapse')).toBeInTheDocument()
  })
})
