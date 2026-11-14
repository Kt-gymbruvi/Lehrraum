// Etappe 4, Teil 2: Begradigen durch Halten (S3)
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { begradige, erkenne, HALTEZEIT_MS } from '../kern/begradigen.ts'
import { rechteckEcken, dreieckPunkte } from '../kern/geometrie.ts'
import type { Form, Punkt, Strich } from '../kern/modell.ts'
import { ladeLetzteTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { setzeHaltezeit, vergissStift } from '../tafel/Zeichenflaeche.tsx'

/** Gleichbleibendes „Zittern“ der Hand (kein Zufall, damit die Tests immer gleich laufen) */
const zittern = (i: number, staerke: number) => staerke * Math.sin(i * 2.17) * Math.cos(i * 0.73)

function strich(punkte: [number, number][], werkzeug: 'stift' | 'marker' = 'stift', z = 2): Strich {
  return { art: 'strich', id: 'x', werkzeug, farbe: '#c62828', staerke: 6, druckEcht: false, punkte: punkte.map(([x, y], i): Punkt => [x + zittern(i, z), y + zittern(i + 50, z), 0.5]) }
}
/** Punkte entlang eines Streckenzugs, etwa alle 4 Einheiten */
function zug(ecken: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < ecken.length - 1; i++) {
    const [a, b] = [ecken[i], ecken[i + 1]]
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4))
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  out.push(ecken[ecken.length - 1])
  return out
}
function ellipse(cx: number, cy: number, a: number, b: number, grad = 0, umlauf = 1): [number, number][] {
  const w = (grad * Math.PI) / 180
  return Array.from({ length: 121 }, (_, i) => {
    const t = (i / 120) * Math.PI * 2 * umlauf
    const [u, v] = [a * Math.cos(t), b * Math.sin(t)]
    return [cx + u * Math.cos(w) - v * Math.sin(w), cy + u * Math.sin(w) + v * Math.cos(w)] as [number, number]
  })
}
const nah = (a: number, b: number, d = 6) => Math.abs(a - b) <= d

describe('Begradigen – Erkennung', () => {
  it('gerade Linie: wird zur Linie in Farbe und Stärke, mit der Kennung des Strichs; fast waagerecht wird waagerecht', () => {
    const f = begradige(strich(zug([[100, 100], [400, 112]]))) as Form
    expect(f).toMatchObject({ art: 'form', form: 'linie', id: 'x', farbe: '#c62828', staerke: 6 })
    expect(nah(f.x1, 100) && nah(f.x2, 400)).toBe(true)
    expect(f.y1).toBeCloseTo(f.y2) // 2,3° schräg → eingerastet
    const schraeg = begradige(strich(zug([[100, 100], [300, 250]]))) as Form
    expect(schraeg.form).toBe('linie')
    expect(nah(schraeg.y2 - schraeg.y1, 150)).toBe(true)
  })

  it('Rechteck – auch schräg; schräg gezeichnet bleibt schräg', () => {
    const r = begradige(strich(zug([[100, 100], [400, 100], [400, 300], [100, 300], [100, 104]]))) as Form
    expect(r).toMatchObject({ form: 'rechteck', id: 'x' })
    expect(r.drehung).toBeUndefined()
    expect(nah(Math.abs(r.x2 - r.x1), 300) && nah(Math.abs(r.y2 - r.y1), 200)).toBe(true)
    // um 30° gedreht
    const w = (30 * Math.PI) / 180
    const ecke = (u: number, v: number): [number, number] => [250 + u * Math.cos(w) - v * Math.sin(w), 200 + u * Math.sin(w) + v * Math.cos(w)]
    const s = begradige(strich(zug([ecke(-150, -80), ecke(150, -80), ecke(150, 80), ecke(-150, 80), ecke(-150, -76)]))) as Form
    expect(s.form).toBe('rechteck')
    expect(nah(s.drehung ?? 0, 30, 2)).toBe(true)
    const ecken = rechteckEcken(s)
    expect(ecken.some(([x, y]) => nah(x, ecke(-150, -80)[0]) && nah(y, ecke(-150, -80)[1]))).toBe(true)
  })

  it('Kreis und Ellipse; fast rund wird ein Kreis, auch zweimal umfahren', () => {
    const k = begradige(strich(ellipse(300, 300, 100, 96))) as Form
    expect(k.form).toBe('ellipse')
    expect(Math.abs(k.x2 - k.x1)).toBeCloseTo(Math.abs(k.y2 - k.y1))
    expect(k.drehung).toBeUndefined()
    expect(erkenne(strich(ellipse(300, 300, 100, 98, 0, 2)))).toBe('ellipse')
    const e = begradige(strich(ellipse(300, 300, 160, 70, 20))) as Form
    expect(e.form).toBe('ellipse')
    expect(nah(e.drehung ?? 0, 20, 3)).toBe(true)
    expect(nah(Math.abs(e.x2 - e.x1), 320, 10) && nah(Math.abs(e.y2 - e.y1), 140, 10)).toBe(true)
  })

  it('Dreieck: die Ecken liegen dort, wo sie gezeichnet wurden', () => {
    const ecken: [number, number][] = [[100, 300], [400, 300], [180, 80]]
    const d = begradige(strich(zug([...ecken, [102, 296]]))) as Form
    expect(d.form).toBe('dreieck')
    const p = dreieckPunkte(d)
    for (const [x, y] of ecken) expect(p.some(([px, py]) => nah(px, x, 8) && nah(py, y, 8))).toBe(true)
    // Spitze nach unten, schräg
    const unten: [number, number][] = [[100, 100], [300, 140], [160, 320]]
    const u = begradige(strich(zug([...unten, [104, 102]]))) as Form
    expect(u.form).toBe('dreieck')
    const q = dreieckPunkte(u)
    for (const [x, y] of unten) expect(q.some(([px, py]) => nah(px, x, 8) && nah(py, y, 8))).toBe(true)
  })

  it('nichts erkannt: offene Bögen, Wellen, Hin und Her, zu kleine Striche', () => {
    expect(erkenne(strich(zug([[100, 100], [200, 300], [300, 100]])))).toBeNull() // ein V
    expect(erkenne(strich(ellipse(300, 300, 100, 100).slice(0, 70)))).toBeNull() // halber Kreis
    expect(erkenne(strich(Array.from({ length: 80 }, (_, i) => [100 + i * 4, 200 + 40 * Math.sin(i / 6)] as [number, number])))).toBeNull()
    expect(erkenne(strich(zug([[100, 100], [400, 100], [100, 102]]), 'stift', 0.5))).toBeNull()
    expect(erkenne(strich(zug([[100, 100], [110, 104]]), 'stift', 0))).toBeNull()
    // dieselbe kleine Linie, aber vergrößert angesehen: groß genug
    expect(erkenne(strich(zug([[100, 100], [110, 104]]), 'stift', 0), 4)).toBe('linie')
  })

  it('Textmarker: nur die gerade Linie, und er bleibt ein Textmarker-Strich', () => {
    const m = begradige(strich(zug([[100, 100], [400, 130]]), 'marker')) as Strich
    expect(m).toMatchObject({ art: 'strich', werkzeug: 'marker', id: 'x', farbe: '#c62828', staerke: 6 })
    expect(m.punkte).toHaveLength(2)
    expect(erkenne(strich(zug([[100, 100], [400, 100], [400, 300], [100, 300], [100, 104]]), 'marker'))).toBeNull()
  })
})

// ---------- Bedienung ----------
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_, n) => (n === 'measureText' ? () => ({ width: 20 }) : () => undefined), set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(() => {
  vergissStift()
  setzeHaltezeit(30)
})
afterAll(() => setzeHaltezeit(HALTEZEIT_MS))

const flaeche = () => screen.getByTestId('zeichenflaeche')
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const seite = async () => (await ladeLetzteTafel())!.seiten[0].elemente
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))
const basis = { pointerId: 1, pointerType: 'pen', button: 0, pressure: 0.5 }
/** Zeichnet den Streckenzug; halten: so lange am Ende stillhalten, bevor der Stift abhebt */
async function zeichneZug(ecken: [number, number][], halten: number) {
  const p = zug(ecken)
  fireEvent.pointerDown(flaeche(), { ...basis, clientX: p[0][0], clientY: p[0][1] })
  for (const [x, y] of p.slice(1)) fireEvent.pointerMove(flaeche(), { ...basis, clientX: x, clientY: y })
  if (halten) await warte(halten)
  const [x, y] = p[p.length - 1]
  fireEvent.pointerUp(flaeche(), { ...basis, clientX: x, clientY: y })
}
const RECHTECK: [number, number][] = [[100, 100], [400, 100], [400, 300], [100, 300], [100, 104]]

describe('Begradigen – Bedienung', () => {
  it('Halten macht aus dem Strich ein Rechteck; Rückgängig bringt zuerst den Freihand-Strich, dann nichts', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await zeichneZug(RECHTECK, 80)
    await waitFor(async () => expect(await seite()).toHaveLength(1))
    const [f] = await seite()
    expect(f).toMatchObject({ art: 'form', form: 'rechteck', farbe: '#0b1f4d', staerke: 6 })
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ art: 'strich', id: f.id }))
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect(await seite()).toHaveLength(0))
    await nutzer.click(screen.getByRole('button', { name: 'Wiederholen' }))
    await nutzer.click(screen.getByRole('button', { name: 'Wiederholen' }))
    await waitFor(async () => expect((await seite())[0]).toMatchObject({ art: 'form', form: 'rechteck', id: f.id }))
  })

  it('ohne Halten wird nie begradigt; wird nichts erkannt, bleibt der Strich', async () => {
    render(<Tafel />)
    await bereit()
    await zeichneZug(RECHTECK, 0)
    await waitFor(async () => expect(await seite()).toHaveLength(1))
    expect((await seite())[0].art).toBe('strich')
    await zeichneZug([[100, 400], [200, 600], [300, 400]], 80) // ein V
    await waitFor(async () => expect(await seite()).toHaveLength(2))
    expect((await seite())[1].art).toBe('strich')
  })

  it('weiterschreiben nach dem Halten: der Strich bleibt freihändig', async () => {
    render(<Tafel />)
    await bereit()
    const p = zug([[100, 100], [400, 100]])
    fireEvent.pointerDown(flaeche(), { ...basis, clientX: 100, clientY: 100 })
    for (const [x, y] of p.slice(1)) fireEvent.pointerMove(flaeche(), { ...basis, clientX: x, clientY: y })
    await warte(80) // jetzt wäre es eine Linie …
    for (const [x, y] of zug([[400, 100], [400, 300]]).slice(1)) fireEvent.pointerMove(flaeche(), { ...basis, clientX: x, clientY: y })
    fireEvent.pointerUp(flaeche(), { ...basis, clientX: 400, clientY: 300 }) // … aber es ging weiter
    await waitFor(async () => expect(await seite()).toHaveLength(1))
    expect((await seite())[0]).toMatchObject({ art: 'strich' })
    expect(((await seite())[0] as Strich).punkte.length).toBeGreaterThan(100)
  })
})
