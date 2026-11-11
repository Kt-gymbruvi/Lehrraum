import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { A4_QUER, einpassen, oberstesBei, rahmen, seitenMass, verschoben } from '../kern/geometrie.ts'
import { benutzteDateien, MAX_SEITEN, neueSeite, neuesTafelbild, pruefeTafel, type Bild, type Seite, type Strich } from '../kern/modell.ts'
import { kopie, seiteDoppelt, seitenDazu } from '../kern/seiten.ts'
import { ladeDatei, raeumeDateienAuf, speichereDatei } from '../speicher/dateien.ts'
import { ladeLetzteTafel, speichereTafel } from '../speicher/datenbank.ts'
import { istBilddatei } from '../tafel/bilder.ts'
import { istPdf, pdfName } from '../tafel/pdf.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

// Bilder entschlüsseln und PDF lesen/schreiben braucht einen echten Browser – beides wird ersetzt.
const probe = vi.hoisted(() => ({
  aufrufe: [] as unknown[][],
  fehler: null as Error | null,
  teilbar: false,
  pdfSeiten: 3,
}))
vi.mock('../tafel/bilder.ts', async (original) => ({
  ...(await original<typeof import('../tafel/bilder.ts')>()),
  nimmBild: async (datei: Blob) => {
    probe.aufrufe.push(['nimmBild', datei.type])
    if (probe.fehler) throw probe.fehler
    return { dateiId: 'ab12cd34' + probe.aufrufe.length, b: 1600, h: 800 }
  },
}))
vi.mock('../tafel/pdf.ts', async (original) => ({
  ...(await original<typeof import('../tafel/pdf.ts')>()),
  kannTeilen: () => probe.teilbar,
  importierePdf: async (_datei: Blob, platz: number, fortschritt: (nr: number, von: number) => void) => {
    probe.aufrufe.push(['importierePdf', platz])
    if (probe.fehler) throw probe.fehler
    const anzahl = Math.min(probe.pdfSeiten, platz)
    fortschritt(1, anzahl)
    return { seiten: Array.from({ length: anzahl }, (_, i): Seite => ({ id: 'pdf' + i, elemente: [], hintergrund: { dateiId: 'ffee0011' + i, b: 794, h: 1123 } })), ausgelassen: probe.pdfSeiten - anzahl }
  },
  exportierePdf: async (seiten: Seite[], titel: string) => {
    probe.aufrufe.push(['exportierePdf', seiten.length, titel])
    if (probe.fehler) throw probe.fehler
    return new Blob(['%PDF'], { type: 'application/pdf' })
  },
  ladeHerunter: (_daten: Blob, name: string) => void probe.aufrufe.push(['ladeHerunter', name]),
  teile: async (_daten: Blob, name: string) => {
    probe.aufrufe.push(['teile', name])
    return true
  },
}))

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(() => {
  vergissStift()
  probe.aufrufe = []
  probe.fehler = null
  probe.teilbar = false
  probe.pdfSeiten = 3
})

const bild = (id: string, mehr: Partial<Bild> = {}): Bild => ({ art: 'bild', id, x: 100, y: 100, b: 400, h: 200, dateiId: 'ab12cd34', ...mehr })
const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, 0, 0.5], [100, 0, 0.5]] })

describe('Bilder und Hintergründe im Datenmodell', () => {
  it('nimmt Bilder und Seitenhintergründe an, verwirft Ungültiges', () => {
    const t = pruefeTafel({
      ...neuesTafelbild(),
      seiten: [
        { id: 'a', hintergrund: { dateiId: 'ffee0011', b: 794, h: 1123 }, elemente: [bild('gut'), bild('breite', { b: -5 }), bild('datei', { dateiId: '../x' }), { ...bild('ohne'), dateiId: undefined }] },
        { id: 'b', hintergrund: { dateiId: 'ffee0011', b: 0, h: 10 }, elemente: [] },
      ],
    })!
    expect(t.seiten[0].elemente).toEqual([bild('gut')])
    expect(t.seiten[0].hintergrund).toEqual({ dateiId: 'ffee0011', b: 794, h: 1123 })
    expect(t.seiten[1].hintergrund).toBeUndefined()
  })

  it('zählt auf, welche Dateien ein Tafelbild braucht', () => {
    const seiten = [neueSeite([bild('a'), strich('s'), bild('b', { dateiId: 'bb22cc33' })], { dateiId: 'ffee0011', b: 1, h: 1 }), neueSeite([bild('c')])]
    expect([...benutzteDateien(seiten)].sort()).toEqual(['ab12cd34', 'bb22cc33', 'ffee0011'])
  })

  it('Bilder lassen sich greifen, verschieben und kopieren; Hintergründe wandern beim Duplizieren mit', () => {
    expect(rahmen(bild('a'))).toEqual([100, 100, 500, 300])
    expect(oberstesBei([bild('a')], 300, 200, 4)?.id).toBe('a') // überall auf dem Bild, nicht nur am Rand
    expect(oberstesBei([bild('a')], 600, 200, 4)).toBeNull()
    expect(verschoben(bild('a'), 10, -10)).toEqual(bild('a', { x: 110, y: 90 }))
    expect(kopie(bild('a'), 24, 24)).toMatchObject({ art: 'bild', x: 124, y: 124, dateiId: 'ab12cd34' })
    const h = { dateiId: 'ffee0011', b: 794, h: 1123 }
    expect(seiteDoppelt({ seiten: [neueSeite([bild('a')], h)], nr: 0 }).seiten[1].hintergrund).toEqual(h)
  })

  it('passt neue Bilder in den sichtbaren Ausschnitt ein, ohne kleine zu vergrößern', () => {
    expect(einpassen(1600, 800, 600, 600)).toEqual([600, 300])
    expect(einpassen(300, 1200, 600, 600)).toEqual([150, 600])
    expect(einpassen(200, 100, 600, 600)).toEqual([200, 100])
  })
})

describe('Seitenmaß für den PDF-Export', () => {
  it('leere Seite: A4 quer; mit PDF-Hintergrund: dessen Größe', () => {
    expect(seitenMass(neueSeite())).toEqual([0, 0, ...A4_QUER])
    expect(seitenMass(neueSeite([], { dateiId: 'ffee0011', b: 794, h: 1123 }))).toEqual([0, 0, 794, 1123])
  })

  it('wächst mit dem Gezeichneten (auch nach links und oben) und lässt Rand', () => {
    expect(seitenMass(neueSeite([bild('a', { x: 1000, y: 700, b: 400, h: 300 })]))).toEqual([0, 0, 1424, 1024])
    expect(seitenMass(neueSeite([bild('a', { x: -200, y: -100, b: 100, h: 100 })]))).toEqual([-224, -124, 1347, 918])
  })
})

describe('PDF-Seiten einfügen', () => {
  const pdf = (n: number): Seite[] => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, elemente: [] }))
  it('ersetzt eine einzelne leere Seite, sonst kommen die Seiten hinter die gezeigte', () => {
    expect(seitenDazu({ seiten: [neueSeite()], nr: 0 }, pdf(2))).toMatchObject({ nr: 0, seiten: [{ id: 'p0' }, { id: 'p1' }] })
    const b = seitenDazu({ seiten: [neueSeite([strich('s')]), neueSeite()], nr: 0 }, pdf(2))
    expect(b.nr).toBe(1)
    expect(b.seiten.map((s) => s.id).slice(1, 3)).toEqual(['p0', 'p1'])
    expect(b.seiten).toHaveLength(4)
  })
  it('hält die Höchstzahl der Seiten ein', () => {
    const voll = { seiten: Array.from({ length: MAX_SEITEN - 1 }, () => neueSeite([strich('s')])), nr: 0 }
    expect(seitenDazu(voll, pdf(5)).seiten).toHaveLength(MAX_SEITEN)
    expect(seitenDazu({ ...voll, seiten: [...voll.seiten, neueSeite()] }, pdf(5))).toMatchObject({ nr: 0 })
  })
})

describe('Dateien im Gerätespeicher', () => {
  it('speichert, lädt und räumt Unbenutztes auf', async () => {
    const a = await speichereDatei(new Blob(['eins'], { type: 'image/png' }))
    const b = await speichereDatei(new Blob(['zwei'], { type: 'image/jpeg' }))
    expect(a).toMatch(/^[0-9a-f]{24}$/)
    expect(a).not.toBe(b)
    expect(await ladeDatei('gibt-es-nicht')).toBeNull()
    // (Der Inhalt selbst lässt sich hier nicht prüfen: die Testumgebung gibt gespeicherte Blobs nicht als Blob zurück.)
    expect(await raeumeDateienAuf(new Set([a, b]))).toBe(0) // alles in Gebrauch: nichts wird gelöscht
    expect(await raeumeDateienAuf(new Set([b]))).toBe(1)
    expect(await raeumeDateienAuf(new Set([b]))).toBe(0)
    expect(await raeumeDateienAuf(new Set())).toBe(1)
  })

  it('erkennt Bild- und PDF-Dateien und bildet unbedenkliche Dateinamen', () => {
    expect(istBilddatei({ type: 'image/png' })).toBe(true)
    expect(istBilddatei({ type: 'application/pdf' })).toBe(false)
    expect(istPdf({ type: 'application/pdf' })).toBe(true)
    expect(istPdf({ type: '', name: 'Arbeitsblatt.PDF' })).toBe(true)
    expect(istPdf({ type: 'image/png', name: 'bild.png' })).toBe(false)
    expect(pdfName('Herz und Kreislauf: 7b/2')).toBe('Herz-und-Kreislauf-7b2.pdf')
    expect(pdfName('  ')).toBe('Tafel.pdf')
  })
})

// ---------- Bedienung ----------
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const tafel = async () => (await ladeLetzteTafel())!
const knopf = (name: string) => screen.getByRole('button', { name })
const datei = (name: string, typ: string) => new File(['x'], name, { type: typ })

describe('Bilder auf der Tafel', () => {
  it('fügt ein gewähltes Bild eingepasst in die Mitte ein und wählt es aus; Rückgängig entfernt es', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.upload(screen.getByLabelText('Bilddatei wählen'), datei('herz.png', 'image/png'))
    await waitFor(async () => expect((await tafel()).seiten[0].elemente).toHaveLength(1))
    const e = (await tafel()).seiten[0].elemente[0] as Bild
    expect(e).toMatchObject({ art: 'bild', dateiId: 'ab12cd341' })
    expect(e.b / e.h).toBe(2) // Seitenverhältnis bleibt
    expect(e.b).toBeLessThanOrEqual(1600)
    expect(knopf('Auswahl')).toHaveAttribute('aria-pressed', 'true')
    expect(knopf('Auswahl löschen')).toBeInTheDocument()
    await nutzer.click(knopf('Rückgängig'))
    await waitFor(async () => expect((await tafel()).seiten[0].elemente).toEqual([]))
  })

  it('nimmt Bilder aus der Zwischenablage und per Hineinziehen; mehrere liegen versetzt', async () => {
    render(<Tafel />)
    await bereit()
    fireEvent.paste(window, { clipboardData: { files: [datei('a.png', 'image/png')] } })
    await waitFor(async () => expect((await tafel()).seiten[0].elemente).toHaveLength(1))
    const flaeche = screen.getByTestId('zeichenflaeche').parentElement!
    fireEvent.drop(flaeche, { dataTransfer: { files: [datei('b.jpg', 'image/jpeg'), datei('c.webp', 'image/webp')], types: ['Files'] } })
    await waitFor(async () => expect((await tafel()).seiten[0].elemente).toHaveLength(3))
    const [, b, c] = (await tafel()).seiten[0].elemente as Bild[]
    expect([c.x - b.x, c.y - b.y]).toEqual([24, 24])
  })

  it('meldet verständlich, wenn eine Datei nicht passt oder nicht lesbar ist', async () => {
    const nutzer = userEvent.setup({ applyAccept: false })
    render(<Tafel />)
    await bereit()
    await nutzer.upload(screen.getByLabelText('Bilddatei wählen'), datei('notizen.docx', 'application/msword'))
    expect(await screen.findByText('Diese Datei lässt sich nicht einfügen (möglich sind Bilder und PDF).')).toBeInTheDocument()
    probe.fehler = new Error('Das Bild lässt sich nicht lesen.')
    await nutzer.upload(screen.getByLabelText('Bilddatei wählen'), datei('kaputt.png', 'image/png'))
    expect(await screen.findByText('Das Bild lässt sich nicht lesen.')).toBeInTheDocument()
    expect((await ladeLetzteTafel())?.seiten[0].elemente ?? []).toEqual([])
  })

  it('Farbe und Stärke lassen ein ausgewähltes Bild unverändert', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: [neueSeite([bild('a')])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Auswahl'))
    const f = screen.getByTestId('zeichenflaeche')
    fireEvent.pointerDown(f, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 300, clientY: 200 })
    fireEvent.pointerUp(f, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 300, clientY: 200 })
    await nutzer.click(knopf('Rot'))
    await nutzer.click(knopf('Strichstärke breit'))
    expect(knopf('Rückgängig')).toBeDisabled() // nichts wurde geändert
    await nutzer.click(knopf('Auswahl duplizieren'))
    await waitFor(async () => expect((await tafel()).seiten[0].elemente).toEqual([bild('a'), expect.objectContaining({ art: 'bild', x: 124, y: 124, dateiId: 'ab12cd34' })]))
  })
})

describe('PDF öffnen und speichern', () => {
  it('öffnet ein PDF auf einer frischen Tafel: jede Seite wird eine Tafelseite mit Hintergrund', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.upload(screen.getByLabelText('PDF-Datei wählen'), datei('arbeitsblatt.pdf', 'application/pdf'))
    expect(await screen.findByText('3 Seiten eingefügt.')).toBeInTheDocument()
    expect(screen.getByText('Seite 1 von 3')).toBeInTheDocument()
    await waitFor(async () => expect((await tafel()).seiten.map((s) => s.hintergrund?.dateiId)).toEqual(['ffee00110', 'ffee00111', 'ffee00112']))
    expect(probe.aufrufe[0]).toEqual(['importierePdf', MAX_SEITEN])
    // Darauf zeichnen: der Strich gehört zur Seite, der Hintergrund bleibt
    const f = screen.getByTestId('zeichenflaeche')
    fireEvent.pointerDown(f, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(f, { pointerId: 1, pointerType: 'mouse', clientX: 90, clientY: 40 })
    fireEvent.pointerUp(f, { pointerId: 1, pointerType: 'mouse', clientX: 90, clientY: 40 })
    await nutzer.click(knopf('Seite leeren'))
    await waitFor(async () => expect((await tafel()).seiten[0]).toMatchObject({ elemente: [], hintergrund: { dateiId: 'ffee00110' } }))
  })

  it('hängt ein PDF hinter die gezeigte Seite, wenn die Tafel schon beschrieben ist, und meldet Überzähliges', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild(), seiten: Array.from({ length: MAX_SEITEN - 2 }, () => neueSeite([strich('s')])) })
    render(<Tafel />)
    await bereit()
    await nutzer.upload(screen.getByLabelText('PDF-Datei wählen'), datei('lang.pdf', 'application/pdf'))
    expect(await screen.findByText(`2 Seiten eingefügt. 1 weitere passen nicht mehr (höchstens ${MAX_SEITEN}).`)).toBeInTheDocument()
    expect(screen.getByText(`Seite 2 von ${MAX_SEITEN}`)).toBeInTheDocument()
  })

  it('meldet unlesbare PDFs und lässt die Tafel unverändert', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    probe.fehler = new Error('Die Datei ist kein lesbares PDF.')
    await nutzer.upload(screen.getByLabelText('PDF-Datei wählen'), datei('kaputt.pdf', 'application/pdf'))
    expect(await screen.findByText('Die Datei ist kein lesbares PDF.')).toBeInTheDocument()
    expect(screen.getByText('Seite 1 von 1')).toBeInTheDocument()
  })

  it('speichert alle Seiten als PDF unter dem Titel der Tafel', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild('Herz und Kreislauf'), seiten: [neueSeite([strich('a')]), neueSeite()] })
    render(<Tafel />)
    await bereit()
    expect(screen.queryByRole('button', { name: 'Als PDF teilen' })).not.toBeInTheDocument() // dieses Gerät kann nicht teilen
    await nutzer.click(knopf('Als PDF speichern'))
    expect(await screen.findByText('PDF gespeichert.')).toBeInTheDocument()
    expect(probe.aufrufe).toEqual([
      ['exportierePdf', 2, 'Herz und Kreislauf'],
      ['ladeHerunter', 'Herz-und-Kreislauf.pdf'],
    ])
  })

  it('bietet „Teilen“ an, wenn das Gerät es kann (z. B. iPad → Goodnotes)', async () => {
    probe.teilbar = true
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(knopf('Als PDF teilen'))
    await waitFor(() => expect(probe.aufrufe).toEqual([['exportierePdf', 1, 'Tafel'], ['teile', 'Tafel.pdf']]))
  })
})
