import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { neueSeite, type Bild, type Seite, type Strich } from '../kern/modell.ts'
import { neueSitzungsdaten, neuerSitzungsCode, neuerSitzungsSchluessel, oeffneAbgabe, oeffneBild, sitzungsSchluessel, verschluesseleAbgabe, verschluesseleBild, verschluesseleSitzung, type Sitzungsdaten } from '../kern/sitzung.ts'
import Mitmachen from '../schueler/Mitmachen.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

const laden = vi.fn()
const belegen = vi.fn()
const abgabeHolen = vi.fn()
const senden = vi.fn()
const bilderHolen = vi.fn()
const bildAblegen = vi.fn()
vi.mock('../speicher/server.ts', async (original) => ({
  ...(await original<typeof import('../speicher/server.ts')>()),
  serverVorhanden: () => true,
  mitmachenLaden: (...a: unknown[]) => laden(...a),
  platzBelegen: (...a: unknown[]) => belegen(...a),
  abgabeLaden: (...a: unknown[]) => abgabeHolen(...a),
  abgabeSpeichern: (...a: unknown[]) => senden(...a),
  bilderLaden: (...a: unknown[]) => bilderHolen(...a),
  bildSpeichern: (...a: unknown[]) => bildAblegen(...a),
}))

const probe = vi.hoisted(() => ({ nimmBild: [] as unknown[][], dateien: new Map<string, Blob>() }))
// Die Testumgebung gibt in IndexedDB gespeicherte Blobs nicht als Blob zurück: Dateien liegen hier in einer Map
vi.mock('../speicher/dateien.ts', async (original) => ({
  ...(await original<typeof import('../speicher/dateien.ts')>()),
  legeDateiAb: async (id: string, daten: Blob) => void probe.dateien.set(id, daten),
  ladeDatei: async (id: string) => probe.dateien.get(id) ?? null,
}))
vi.mock('../tafel/bilder.ts', async (original) => ({
  ...(await original<typeof import('../tafel/bilder.ts')>()),
  nimmBild: async (datei: Blob, optionen: unknown) => {
    probe.nimmBild.push([datei.type, optionen])
    probe.dateien.set('abcd1234ef', datei)
    return { dateiId: 'abcd1234ef', b: 800, h: 600 }
  },
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
async function sitzung(mehr: { vorlage?: Seite; endeInMin?: number; belegt?: string[]; gaeste?: number } = {}): Promise<Aufbau> {
  const code = neuerSitzungsCode()
  const schluesselText = neuerSitzungsSchluessel()
  const key = await sitzungsSchluessel(schluesselText)
  const daten = neueSitzungsdaten('10G1', schueler, mehr.vorlage, mehr.gaeste)
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
  bilderHolen.mockReset()
  bildAblegen.mockReset()
  bilderHolen.mockResolvedValue([])
  bildAblegen.mockResolvedValue(undefined)
  probe.nimmBild.length = 0
  probe.dateien.clear()
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
    expect(screen.getByRole('button', { name: 'Bild einfügen' })).toBeInTheDocument() // Schüler dürfen Fotos einfügen
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

  it('lässt Gäste mitmachen: Gast-Plätze stehen nicht in der Namensliste, ein Knopf nimmt den ersten freien', async () => {
    const a = await sitzung({ gaeste: 2 })
    zeige(a)
    const nutzer = userEvent.setup()
    await screen.findByRole('heading', { name: '10G1' })
    expect(screen.queryByRole('button', { name: /^Gast 1/ })).toBeNull()
    await nutzer.click(screen.getByRole('button', { name: 'Als Gast mitmachen' }))
    expect(screen.getByText('Du schreibst als Gast 1.')).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Ja, los' }))
    expect(await screen.findByTestId('zeichenflaeche')).toBeInTheDocument()
    expect(belegen.mock.calls[0][1]).toBe(a.daten.plaetze.find((p) => p.gast)!.platz)
    expect(screen.getByText(/Gast 1/)).toBeInTheDocument()
  })

  it('sagt, wenn alle Gast-Plätze vergeben sind', async () => {
    const a = await sitzung({ gaeste: 2, belegt: ['2', '3'] }) // 2 Namen, dann Gast 1 und Gast 2
    zeige(a)
    await screen.findByRole('heading', { name: '10G1' })
    expect(screen.getByRole('button', { name: 'Als Gast mitmachen' })).toBeDisabled()
    expect(screen.getByText(/Alle Gast-Plätze sind schon vergeben/)).toBeInTheDocument()
  })

  it('zeigt ohne Gäste keinen Gast-Knopf', async () => {
    const a = await sitzung()
    zeige(a)
    await screen.findByRole('heading', { name: '10G1' })
    expect(screen.queryByRole('button', { name: 'Als Gast mitmachen' })).toBeNull()
  })

  it('lädt ein eingefügtes Foto verschlüsselt hoch, bevor die Seite gesendet wird', async () => {
    const a = await sitzung()
    zeige(a)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Anna Adler' }))
    await nutzer.click(screen.getByRole('button', { name: 'Ja, das bin ich' }))
    await screen.findByTestId('zeichenflaeche')
    const foto = new File([new Uint8Array([1, 2, 3, 4, 5, 250, 251])], 'foto.jpg', { type: 'image/jpeg' })
    await nutzer.upload(screen.getByLabelText('Bilddatei wählen'), foto)
    await waitFor(() => expect(bildAblegen).toHaveBeenCalled(), { timeout: 6000 })
    // Schüler-Fotos werden klein gerechnet
    expect((probe.nimmBild[0][1] as { kompakt?: boolean }).kompakt).toBe(true)
    const [code, platz, hash, id, iv, daten] = bildAblegen.mock.calls[0]
    expect([code, platz]).toEqual([a.code, a.daten.plaetze[0].platz])
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(id).toBe('abcd1234ef')
    const klar = await oeffneBild(a.key, { iv, daten }, platz, id)
    expect([...klar!]).toEqual([1, 2, 3, 4, 5, 250, 251])
    // erst das Foto, dann die Seite – und die Seite nennt nur die Kennung
    await waitFor(() => expect(senden).toHaveBeenCalled(), { timeout: 6000 })
    expect(bildAblegen.mock.invocationCallOrder[0]).toBeLessThan(senden.mock.invocationCallOrder[0])
    const [, , , , siv, sdaten] = senden.mock.calls.at(-1)!
    const seite = (await oeffneAbgabe(a.key, { iv: siv, daten: sdaten }, platz))!.seite
    expect(seite.elemente.filter((e) => e.art === 'bild').map((e) => (e as Bild).dateiId)).toEqual(['abcd1234ef'])
    expect(sdaten).not.toContain('FOTO')
  })

  it('holt die eigenen Fotos nach einem Neuladen vom Server auf das Gerät', async () => {
    const a = await sitzung()
    const platz = a.daten.plaetze[0]
    window.localStorage.setItem(`lehrraum-mitmachen-${a.code}`, JSON.stringify({ platz: platz.platz, geheimnis: 'geheim' }))
    const bildElement: Bild = { art: 'bild', id: 'b1', x: 10, y: 10, b: 200, h: 100, dateiId: 'abcd1234ef' }
    const box = await verschluesseleAbgabe(a.key, platz.platz, neueSeite([bildElement]), 3)
    abgabeHolen.mockResolvedValue({ stand: 3, ...box })
    const fotoBox = await verschluesseleBild(a.key, platz.platz, 'abcd1234ef', new Uint8Array([9, 8, 7]))
    bilderHolen.mockResolvedValue([{ bild: 'abcd1234ef', ...fotoBox }])
    zeige(a)
    expect(await screen.findByTestId('zeichenflaeche')).toBeInTheDocument()
    const blob = probe.dateien.get('abcd1234ef')
    expect(blob).toBeDefined()
    expect(blob!.size).toBe(3)
  })

  it('nimmt nicht mehr als acht Fotos je Seite', async () => {
    const a = await sitzung()
    const platz = a.daten.plaetze[0]
    window.localStorage.setItem(`lehrraum-mitmachen-${a.code}`, JSON.stringify({ platz: platz.platz, geheimnis: 'geheim' }))
    const bilder = Array.from({ length: 8 }, (_, i): Bild => ({ art: 'bild', id: 'b' + i, x: 10, y: 10, b: 100, h: 100, dateiId: 'abcd12340' + i }))
    const box = await verschluesseleAbgabe(a.key, platz.platz, neueSeite(bilder), 3)
    abgabeHolen.mockResolvedValue({ stand: 3, ...box })
    zeige(a)
    await screen.findByTestId('zeichenflaeche')
    const nutzer = userEvent.setup()
    await nutzer.upload(screen.getByLabelText('Bilddatei wählen'), new File([new Uint8Array([1])], 'x.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByText('Höchstens 8 Fotos je Seite.')).toBeInTheDocument()
    expect(probe.nimmBild).toHaveLength(0)
  })

  it('lässt keine PDF-Dateien zu', async () => {
    const a = await sitzung()
    zeige(a)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Anna Adler' }))
    await nutzer.click(screen.getByRole('button', { name: 'Ja, das bin ich' }))
    await screen.findByTestId('zeichenflaeche')
    fireEvent.change(screen.getByLabelText('Bilddatei wählen'), { target: { files: [new File([new Uint8Array([1])], 'x.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByText('Hier gehen nur Fotos und Bilder.')).toBeInTheDocument()
    expect(probe.nimmBild).toHaveLength(0)
  })
})
