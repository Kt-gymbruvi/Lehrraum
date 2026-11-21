import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { neueSeite, type Seite, type Strich } from '../kern/modell.ts'
import { neueSitzungsdaten, neuerSitzungsCode, neuerSitzungsSchluessel, oeffneAbgabe, sitzungsSchluessel, verschluesseleAbgabe, verschluesseleSitzung, type Sitzungsdaten } from '../kern/sitzung.ts'
import Mitmachen from '../schueler/Mitmachen.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

const laden = vi.fn()
const belegen = vi.fn()
const abgabeHolen = vi.fn()
const senden = vi.fn()
vi.mock('../speicher/server.ts', async (original) => ({
  ...(await original<typeof import('../speicher/server.ts')>()),
  serverVorhanden: () => true,
  mitmachenLaden: (...a: unknown[]) => laden(...a),
  platzBelegen: (...a: unknown[]) => belegen(...a),
  abgabeLaden: (...a: unknown[]) => abgabeHolen(...a),
  abgabeSpeichern: (...a: unknown[]) => senden(...a),
}))

// jsdom kann nicht zeichnen: Canvas und Path2D durch Attrappen ersetzen (wie in tafel.test.tsx)
beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})

const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[10, 10, 0.5], [200, 10, 0.5]] })
const schueler = [
  { id: 'anna1', vorname: 'Anna', nachname: 'Adler' },
  { id: 'ben01', vorname: 'Ben', nachname: 'Berg' },
]

function ziehe(von: [number, number], nach: [number, number]) {
  const f = screen.getByTestId('zeichenflaeche')
  const basis = { pointerId: 1, pointerType: 'mouse', button: 0 }
  fireEvent.pointerDown(f, { ...basis, clientX: von[0], clientY: von[1] })
  fireEvent.pointerMove(f, { ...basis, clientX: (von[0] + nach[0]) / 2, clientY: (von[1] + nach[1]) / 2 })
  fireEvent.pointerMove(f, { ...basis, clientX: nach[0], clientY: nach[1] })
  fireEvent.pointerUp(f, { ...basis, clientX: nach[0], clientY: nach[1] })
}

type Aufbau = { code: string; schluesselText: string; daten: Sitzungsdaten; key: CryptoKey }
/** Richtet den (nachgemachten) Server ein: Sitzung mit Namensliste, optional Vorlage und Ablaufzeit */
async function sitzung(mehr: { vorlage?: Seite; endeInMin?: number; belegt?: string[] } = {}): Promise<Aufbau> {
  const code = neuerSitzungsCode()
  const schluesselText = neuerSitzungsSchluessel()
  const key = await sitzungsSchluessel(schluesselText)
  const daten = neueSitzungsdaten('10G1', schueler, mehr.vorlage)
  const box = await verschluesseleSitzung(key, daten)
  const ende = new Date(Date.now() + (mehr.endeInMin ?? 20) * 60_000).toISOString()
  laden.mockResolvedValue({ ...box, beginn: new Date().toISOString(), ende, plaetze: daten.plaetze.map((p, i) => ({ platz: p.platz, belegt: !!mehr.belegt?.includes(String(i)) })) })
  return { code, schluesselText, daten, key }
}

const zeige = (a: Pick<Aufbau, 'code' | 'schluesselText'>) =>
  render(
    <MemoryRouter initialEntries={[`/mitmachen/${a.code}/${a.schluesselText}`]}>
      <Routes>
        <Route path="/mitmachen/:code/:schluessel" element={<Mitmachen />} />
        <Route path="*" element={<p>anderswo</p>} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vergissStift()
  laden.mockReset()
  belegen.mockReset()
  abgabeHolen.mockReset()
  senden.mockReset()
  window.localStorage.clear()
  belegen.mockResolvedValue(true)
  abgabeHolen.mockResolvedValue(null)
  senden.mockImplementation(async (_c: string, _p: string, _h: string, stand: number) => stand)
})

describe('Schülerseite: Einstieg', () => {
  it('zeigt die Namen der Klasse; vergebene sind gesperrt', async () => {
    const a = await sitzung({ belegt: ['1'] })
    zeige(a)
    expect(await screen.findByRole('heading', { name: '10G1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anna Adler' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Ben Berg/ })).toBeDisabled()
    expect(screen.getByText(/schon vergeben/)).toBeInTheDocument()
  })

  it('fragt vor dem Belegen nach und kann zurück', async () => {
    const a = await sitzung()
    zeige(a)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Anna Adler' }))
    expect(screen.getByText('Bist du Anna Adler?')).toBeInTheDocument()
    expect(belegen).not.toHaveBeenCalled()
    await nutzer.click(screen.getByRole('button', { name: 'Zurück' }))
    expect(screen.getByRole('button', { name: 'Anna Adler' })).toBeInTheDocument()
  })

  it('meldet einen ungültigen Link und einen falschen Schlüssel', async () => {
    const a = await sitzung()
    zeige({ code: 'kurz', schluesselText: a.schluesselText })
    expect(await screen.findByText('Dieser Link stimmt nicht')).toBeInTheDocument()
  })

  it('zeigt bei falschem Schlüssel, dass der Link unvollständig ist', async () => {
    const a = await sitzung()
    zeige({ code: a.code, schluesselText: neuerSitzungsSchluessel() })
    expect(await screen.findByText(/unvollständig/)).toBeInTheDocument()
  })

  it('zeigt die Meldung des Servers, wenn die Zeit um ist', async () => {
    laden.mockRejectedValue({ message: 'QUIZZO: Die Zeit ist um.' })
    zeige({ code: neuerSitzungsCode(), schluesselText: neuerSitzungsSchluessel() })
    expect(await screen.findByText('Die Zeit ist um.')).toBeInTheDocument()
  })
})

describe('Schülerseite: Schreiben', () => {
  it('belegt den Platz mit dem Hash des Geheimnisses, zeigt die Tafel ohne Lehrkraft-Funktionen', async () => {
    const a = await sitzung()
    zeige(a)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Anna Adler' }))
    await nutzer.click(screen.getByRole('button', { name: 'Ja, das bin ich' }))
    expect(await screen.findByTestId('zeichenflaeche')).toBeInTheDocument()
    const [code, platz, hash] = belegen.mock.calls[0]
    expect(code).toBe(a.code)
    expect(platz).toBe(a.daten.plaetze[0].platz)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(screen.getByText(/Anna Adler/)).toBeInTheDocument()
    // keine PDF-, Bild-, Seiten- und Klassenfunktionen
    expect(screen.queryByRole('button', { name: 'PDF öffnen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bild einfügen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Neue Seite anlegen' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Meine Klassen' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Seiten' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Stift' })).toBeInTheDocument()
  })

  it('schickt einen gezeichneten Strich verschlüsselt an den Server', async () => {
    const a = await sitzung()
    zeige(a)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Anna Adler' }))
    await nutzer.click(screen.getByRole('button', { name: 'Ja, das bin ich' }))
    await screen.findByTestId('zeichenflaeche')
    ziehe([20, 20], [220, 80])
    await waitFor(() => expect(senden).toHaveBeenCalled(), { timeout: 5000 })
    const [code, platz, , stand, iv, daten] = senden.mock.calls.at(-1)!
    expect(code).toBe(a.code)
    expect(platz).toBe(a.daten.plaetze[0].platz)
    expect(daten).not.toContain('strich')
    const offen = await oeffneAbgabe(a.key, { iv, daten }, platz)
    expect(offen?.seite.elemente).toHaveLength(1)
    expect(offen?.stand).toBe(stand)
    expect(await screen.findByText('Gesendet')).toBeInTheDocument()
  })

  it('fängt mit der Vorlage der Lehrkraft an (als Kopie mit neuen Kennungen)', async () => {
    const vorlage = neueSeite([strich('v1'), strich('v2')])
    const a = await sitzung({ vorlage })
    zeige(a)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Anna Adler' }))
    await nutzer.click(screen.getByRole('button', { name: 'Ja, das bin ich' }))
    await screen.findByTestId('zeichenflaeche')
    expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeEnabled()
  })

  it('findet nach einem Neuladen den Platz und die eigene Seite wieder', async () => {
    const a = await sitzung()
    const platz = a.daten.plaetze[1]
    window.localStorage.setItem(`lehrraum-mitmachen-${a.code}`, JSON.stringify({ platz: platz.platz, geheimnis: 'geheim' }))
    const box = await verschluesseleAbgabe(a.key, platz.platz, neueSeite([strich('s1')]), 7)
    abgabeHolen.mockResolvedValue({ stand: 7, ...box })
    zeige(a)
    expect(await screen.findByTestId('zeichenflaeche')).toBeInTheDocument()
    expect(screen.getByText(/Ben Berg/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeEnabled()
  })

  it('sagt, wenn der Name schon vergeben ist, und bleibt bei der Liste', async () => {
    const a = await sitzung()
    belegen.mockResolvedValue(false)
    zeige(a)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Anna Adler' }))
    await nutzer.click(screen.getByRole('button', { name: 'Ja, das bin ich' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/schon vergeben/)
    expect(screen.queryByTestId('zeichenflaeche')).toBeNull()
  })

  it('sperrt die Seite, wenn der Server „Zeit ist um“ meldet', async () => {
    const a = await sitzung()
    senden.mockImplementation(() => Promise.reject({ message: 'QUIZZO: Die Zeit ist um.' }))
    zeige(a)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Anna Adler' }))
    await nutzer.click(screen.getByRole('button', { name: 'Ja, das bin ich' }))
    await screen.findByTestId('zeichenflaeche')
    ziehe([20, 20], [220, 80])
    expect(await screen.findByRole('alert', undefined, { timeout: 5000 })).toHaveTextContent(/Die Zeit ist um/)
  })
})
