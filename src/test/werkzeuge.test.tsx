// Unterrichtswerkzeuge der rechten Leiste: Arbeitsform, Geräuschampel, Abdecken, Scheinwerfer, Geometrie.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { pruefeFenster, schalte } from '../kern/fenster.ts'
import { AMPEL_START, farbeFuer, naechsteAmpel, pegel, ZURUECK_MS } from '../kern/geraeusch.ts'
import { anKante, CM, fangeKante, folgeZweiFingern, INSTRUMENT_SKALA_MAX, INSTRUMENT_SKALA_MIN, kanten, LINEAL_BREITE, neuesInstrument, rasteWinkel, skaliereAmGriff, teilstriche, winkelText, zuLokal, zuTafelPunkt, type Instrument } from '../kern/instrumente.ts'
import type { Strich } from '../kern/modell.ts'
import { ABDECKUNG_MIN, begrenzeScheinwerfer, GANZ_ABGEDECKT, scheinwerferPfad, schiebeKante } from '../kern/zeigen.ts'
import { ladeLetzteTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
  Element.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

const nahe = (a: number, b: number, genau = 6) => expect(a).toBeCloseTo(b, genau)

// ---------- Logik ----------
describe('Geräuschampel – Logik', () => {
  it('misst den Pegel aus den Messwerten', () => {
    expect(pegel([])).toBe(0)
    expect(pegel(new Float32Array(512))).toBe(0)
    expect(pegel(new Float32Array(512).fill(1))).toBe(100)
    expect(pegel(new Float32Array(512).fill(0.5))).toBe(91) // −6 dB
    expect(pegel(new Float32Array(512).fill(0.01))).toBe(43) // −40 dB
  })

  it('lauter sofort, leiser erst nach einer Weile und stufenweise', () => {
    expect(farbeFuer(70, 60)).toBe('rot')
    expect(farbeFuer(50, 60)).toBe('gelb')
    expect(farbeFuer(10, 60)).toBe('gruen')
    let a = naechsteAmpel(AMPEL_START, 80, 60, 0)
    expect(a.farbe).toBe('rot')
    a = naechsteAmpel(a, 10, 60, 100)
    expect(a.farbe).toBe('rot') // noch nicht lange genug leise
    a = naechsteAmpel(a, 10, 60, 100 + ZURUECK_MS - 1)
    expect(a.farbe).toBe('rot')
    a = naechsteAmpel(a, 10, 60, 100 + ZURUECK_MS)
    expect(a.farbe).toBe('gelb')
    a = naechsteAmpel(a, 10, 60, 100 + ZURUECK_MS + 10)
    expect(a.farbe).toBe('gelb')
    a = naechsteAmpel(a, 10, 60, 100 + 2 * ZURUECK_MS + 10)
    expect(a.farbe).toBe('gruen')
    // kurz leiser, dann wieder laut: bleibt rot und die Wartezeit beginnt neu
    let b = naechsteAmpel(AMPEL_START, 80, 60, 0)
    b = naechsteAmpel(b, 10, 60, 10)
    b = naechsteAmpel(b, 80, 60, 20)
    expect(b).toEqual({ farbe: 'rot', leiserSeit: null })
  })
})

describe('Fenster – Logik', () => {
  it('prüft gespeicherte Fenster der neuen Arten', () => {
    const l = pruefeFenster([
      { id: 'a', art: 'arbeitsform', x: 0, y: 0, form: 'gruppe', laut: 'leise' },
      { id: 'b', art: 'geraeusch', x: 0, y: 0, grenze: 999 },
    ])
    expect(l[0]).toMatchObject({ form: 'gruppe', laut: 'leise' })
    expect(l[1].grenze).toBe(95)
    expect(pruefeFenster([{ id: 'c', art: 'qr', x: 0, y: 0, adresse: 'https://beispiel.de/' }])).toEqual([]) // QR-Fenster gibt es nicht mehr
    expect(pruefeFenster([{ id: 'a', art: 'arbeitsform', x: 0, y: 0, form: 'quatsch' }])[0]).toMatchObject({ form: 'einzel', laut: 'still' })
    expect(schalte([], 'arbeitsform')[0]).toMatchObject({ form: 'einzel', laut: 'still' })
    expect(schalte([], 'geraeusch')[0].grenze).toBe(60)
  })
})

describe('Abdecken und Scheinwerfer – Logik', () => {
  it('Kanten der Abdeckung bleiben in der Fläche und überholen sich nicht', () => {
    let a = schiebeKante(GANZ_ABGEDECKT, 'o', 0.4)
    expect(a).toEqual({ l: 0, o: 0.4, r: 1, u: 1 })
    a = schiebeKante(a, 'o', 2)
    nahe(a.o, 1 - ABDECKUNG_MIN)
    a = schiebeKante(a, 'u', 0)
    nahe(a.u, a.o + ABDECKUNG_MIN)
    expect(schiebeKante(GANZ_ABGEDECKT, 'l', -1).l).toBe(0)
    expect(schiebeKante(GANZ_ABGEDECKT, 'l', NaN)).toBe(GANZ_ABGEDECKT)
  })

  it('Scheinwerfer bleibt auf der Fläche, mit Loch im dunklen Teil', () => {
    expect(begrenzeScheinwerfer({ x: 2, y: -1, r: 5 }, 800, 600)).toEqual({ x: 1, y: 0, r: 48 })
    expect(begrenzeScheinwerfer({ x: 0.5, y: 0.5, r: 5000 }, 800, 600).r).toBe(450)
    expect(scheinwerferPfad({ x: 0.5, y: 0.5, r: 100 }, 800, 600)).toBe('M0 0H800V600H0Z M300 300a100 100 0 1 0 200 0a100 100 0 1 0 -200 0Z')
  })
})

describe('Geometrie-Werkzeuge – Logik', () => {
  const lineal: Instrument = { art: 'lineal', x: 100, y: 200, winkel: 0 }

  it('legt einen Strich an die Kante des Lineals an, auch gedreht', () => {
    expect(fangeKante(lineal, 150, 210, 20)).toEqual(kanten('lineal')[0])
    expect(fangeKante(lineal, 150, 260, 20)).toBeNull()
    const [x, y] = anKante(lineal, kanten('lineal')[0], 150, 213, 3)
    nahe(x, 150)
    nahe(y, 203) // auf der Kante, um die halbe Strichbreite nach außen
    // obere Kante (Körper liegt dazwischen)
    const oben = fangeKante(lineal, 150, 200 - LINEAL_BREITE * CM - 5, 20)
    expect(oben).toEqual(kanten('lineal')[1])
    nahe(anKante(lineal, oben!, 150, 200 - LINEAL_BREITE * CM - 9, 2)[1], 200 - LINEAL_BREITE * CM - 2)
    // um 90° gedreht: die Kante läuft senkrecht
    const senkrecht = { ...lineal, winkel: 90 }
    const k = fangeKante(senkrecht, 90, 300, 20)!
    expect(k).toEqual(kanten('lineal')[0])
    const p = anKante(senkrecht, k, 85, 300, 0)
    nahe(p[0], 100)
    nahe(p[1], 300)
  })

  it('Geodreieck: Schenkel; Winkelmesser: am Bogen entlang', () => {
    const geo: Instrument = { art: 'geodreieck', x: 0, y: 0, winkel: 0 }
    const h = 8 * CM
    // Punkt knapp außerhalb des rechten Schenkels
    const k = fangeKante(geo, h / 2 + 5, -h / 2 - 5 + 10, 20)!
    expect(k).toEqual(kanten('geodreieck')[1])
    const [x, y] = anKante(geo, k, h / 2 + 5, -h / 2 + 5, 0)
    nahe(x + -y, h) // liegt auf der Linie x − y = h (y nach unten)
    const wm: Instrument = { art: 'winkelmesser', x: 0, y: 0, winkel: 0 }
    const r = 8 * CM
    const bogen = fangeKante(wm, 0, -r - 10, 20)!
    expect(bogen.art).toBe('bogen')
    const q = anKante(wm, bogen, r * 0.7 + 5, -r * 0.7 - 5, 2)
    nahe(Math.hypot(q[0], q[1]), r + 2)
  })

  it('dreht, rastet ein, folgt zwei Fingern und zeigt den Winkel', () => {
    expect(rasteWinkel(44)).toBe(45)
    expect(rasteWinkel(40)).toBe(40)
    expect(rasteWinkel(-181)).toBe(180)
    expect(winkelText(0)).toBe('0°')
    expect(winkelText(30)).toBe('−30°')
    expect(winkelText(-45)).toBe('45°')
    // zwei Finger: um 90° gedreht um ihre Mitte, dann verschoben
    const neu = folgeZweiFingern(lineal, [0, 0], [100, 0], [10, 10], [10, 110])
    nahe(neu.winkel, 90)
    // der Nullpunkt lag (100|200) – Mitte der Finger (50|0) → (10|60); gedreht: (−200|50) → (−190|110)
    nahe(neu.x, -190)
    nahe(neu.y, 110)
    const t = zuTafelPunkt(neu, 37, -11)
    const l = zuLokal(neu, t[0], t[1])
    nahe(l[0], 37)
    nahe(l[1], -11)
  })

  it('Größe: am Griff im Verhältnis der Abstände, begrenzt; Kanten und Anlegen gelten in Tafel-Einheiten', () => {
    const g = { ...lineal, skala: undefined }
    const doppelt = skaliereAmGriff(g, 1, [lineal.x + 100, lineal.y], [lineal.x + 200, lineal.y])
    expect(doppelt.skala).toBe(2)
    expect(skaliereAmGriff(g, 1, [lineal.x + 100, lineal.y], [lineal.x + 100000, lineal.y]).skala).toBe(INSTRUMENT_SKALA_MAX)
    expect(skaliereAmGriff(g, 1, [lineal.x + 100, lineal.y], [lineal.x + 1, lineal.y]).skala).toBe(INSTRUMENT_SKALA_MIN)
    // lokal 100 → Tafel 200 und zurück
    nahe(zuTafelPunkt(doppelt, 100, 0)[0], lineal.x + 200)
    nahe(zuLokal(doppelt, lineal.x + 200, lineal.y)[0], 100)
    // Anlegen: Abstand und Fangbereich bleiben in Tafel-Einheiten (hier: 3 Einheiten unter der Unterkante)
    const k = fangeKante(doppelt, lineal.x + 150, lineal.y + 10, 20)!
    expect(k).toEqual(kanten('lineal')[0])
    expect(fangeKante(doppelt, lineal.x + 150, lineal.y + 30, 20)).toBeNull()
    nahe(anKante(doppelt, k, lineal.x + 150, lineal.y + 10, 3)[1], lineal.y + 3)
    // zwei Finger: Spreizen vergrößert um die Mitte der Finger
    const gross = folgeZweiFingern(g, [0, 0], [100, 0], [0, 0], [200, 0])
    expect(gross.skala).toBe(2)
    nahe(gross.winkel, 0)
    expect(folgeZweiFingern(g, [0, 0], [100, 0], [10, 0], [110, 0]).skala).toBeUndefined() // nur verschoben
  })

  it('neue Werkzeuge liegen mitten in der Fläche und haben Teilstriche', () => {
    const n = neuesInstrument('lineal', 400, 300)
    nahe(n.x + 15 * CM, 400)
    expect(teilstriche('lineal')).toHaveLength(301)
    expect(teilstriche('winkelmesser')).toHaveLength(181)
    expect(teilstriche('geodreieck').filter((t) => t.text === '90')).toHaveLength(1)
  })
})

// ---------- Bedienung ----------
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const leiste = () => within(screen.getByRole('complementary', { name: 'Unterrichtswerkzeuge' }))
const gespeicherteFenster = async () => (await ladeLetzteTafel())?.fenster ?? []

describe('Arbeitsform in der Tafel', () => {
  it('Arbeitsform: Sozialform und Lautstärke wählen, wird mit der Tafel gemerkt', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Arbeitsform' }))
    const fenster = screen.getByRole('region', { name: 'Arbeitsform' })
    expect(within(fenster).getByRole('status')).toHaveAccessibleName('Einzelarbeit, Still')
    await nutzer.click(within(fenster).getByRole('button', { name: 'Gruppenarbeit' }))
    await nutzer.click(within(fenster).getByRole('button', { name: 'Flüstern' }))
    expect(within(fenster).getByRole('status')).toHaveAccessibleName('Gruppenarbeit, Flüstern')
    await waitFor(async () => expect((await gespeicherteFenster())[0]).toMatchObject({ art: 'arbeitsform', form: 'gruppe', laut: 'fluestern' }))
  })
})

describe('Geräuschampel in der Tafel', () => {
  const echteMedien = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
  afterEach(() => {
    if (echteMedien) Object.defineProperty(navigator, 'mediaDevices', echteMedien)
    else delete (navigator as unknown as Record<string, unknown>).mediaDevices
    delete (window as unknown as Record<string, unknown>).AudioContext
  })

  function mitMikrofon(getUserMedia: () => Promise<MediaStream>, wert = 0.5) {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    const geschlossen = vi.fn(() => Promise.resolve())
    class Attrappe {
      createAnalyser() {
        return { fftSize: 0, getFloatTimeDomainData: (p: Float32Array) => p.fill(wert) }
      }
      createMediaStreamSource() {
        return { connect: () => undefined }
      }
      close = geschlossen
    }
    ;(window as unknown as Record<string, unknown>).AudioContext = Attrappe
    return geschlossen
  }

  it('startet erst auf Knopfdruck, zeigt Rot bei Lärm und gibt das Mikrofon beim Schließen frei', async () => {
    const nutzer = userEvent.setup()
    const stopp = vi.fn()
    const holen = vi.fn(() => Promise.resolve({ getTracks: () => [{ stop: stopp }] } as unknown as MediaStream))
    const geschlossen = mitMikrofon(holen)
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Geräuschampel' }))
    const fenster = screen.getByRole('region', { name: 'Geräuschampel' })
    expect(holen).not.toHaveBeenCalled()
    expect(within(fenster).getByRole('status')).toHaveAccessibleName('Ampel aus')
    await nutzer.click(within(fenster).getByRole('button', { name: 'Start' }))
    expect(holen).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(within(fenster).getByRole('status')).toHaveAccessibleName('Ampel: Rot'), { timeout: 2000 })
    await nutzer.click(screen.getByRole('button', { name: 'Geräuschampel schließen' }))
    expect(stopp).toHaveBeenCalled()
    expect(geschlossen).toHaveBeenCalled()
  })

  it('erklärt, wenn das Mikrofon nicht erlaubt ist', async () => {
    const nutzer = userEvent.setup()
    mitMikrofon(() => Promise.reject(Object.assign(new Error('nein'), { name: 'NotAllowedError' })))
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Geräuschampel' }))
    await nutzer.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('nicht erlaubt')
  })

  it('ohne Mikrofon im Browser: Hinweis statt Fehler', async () => {
    const nutzer = userEvent.setup()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Geräuschampel' }))
    await nutzer.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('alert')).toHaveTextContent('nicht verfügbar')
  })
})

describe('Abdecken, Scheinwerfer und Geometrie in der Tafel', () => {
  it('Abdecken: aufziehen mit der Tastatur, entfernen; die Tafel bleibt unverändert', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    const knopf = leiste().getByRole('button', { name: 'Abdecken' })
    await nutzer.click(knopf)
    expect(knopf).toHaveAttribute('aria-pressed', 'true')
    const griff = screen.getByRole('slider', { name: 'Abdeckung oben aufziehen' })
    fireEvent.keyDown(griff, { key: 'ArrowDown', shiftKey: true })
    expect(griff).toHaveAttribute('aria-valuenow', '10')
    expect(screen.getByRole('region', { name: 'Abdeckung' }).style.top).toBe('10%')
    await nutzer.click(screen.getByRole('button', { name: 'Abdeckung entfernen' }))
    expect(screen.queryByRole('region', { name: 'Abdeckung' })).not.toBeInTheDocument()
    expect(knopf).toHaveAttribute('aria-pressed', 'false')
    expect((await ladeLetzteTafel())?.seiten[0].elemente ?? []).toEqual([])
  })

  it('Scheinwerfer ein- und ausschalten', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Scheinwerfer' }))
    expect(screen.getByRole('button', { name: 'Scheinwerfer ausschalten' })).toBeInTheDocument()
    await nutzer.click(leiste().getByRole('button', { name: 'Scheinwerfer' }))
    expect(screen.queryByRole('button', { name: 'Scheinwerfer ausschalten' })).not.toBeInTheDocument()
  })

  it('Lineal: auflegen, Strich an der Kante wird gerade, freier Strich bleibt frei, drehen, wegnehmen', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    const geometrie = leiste().getByRole('button', { name: 'Geometrie' })
    await nutzer.click(geometrie)
    await nutzer.click(within(screen.getByRole('dialog', { name: 'Geometrie' })).getByRole('button', { name: 'Lineal' }))
    expect(geometrie).toHaveClass('an')
    const drehen = screen.getByRole('slider', { name: 'Lineal drehen' })
    expect(drehen).toHaveAttribute('aria-valuetext', '0°')

    // jsdom: Fläche 800 × 600 angenommen, Ansicht ohne Verschiebung und Zoom 1 → Messkante bei y = 300 + 2 cm
    const kante = 300 + (LINEAL_BREITE / 2) * CM
    const f = screen.getByTestId('zeichenflaeche')
    const ziehe = (punkte: [number, number][], id: number) => {
      const basis = { pointerId: id, pointerType: 'mouse', button: 0 }
      fireEvent.pointerDown(f, { ...basis, clientX: punkte[0][0], clientY: punkte[0][1] })
      for (const [x, y] of punkte.slice(1)) fireEvent.pointerMove(f, { ...basis, clientX: x, clientY: y })
      fireEvent.pointerUp(f, { ...basis, clientX: punkte[punkte.length - 1][0], clientY: punkte[punkte.length - 1][1] })
    }
    ziehe(
      [
        [100, kante + 10],
        [200, kante + 18],
        [300, kante + 4],
      ],
      1,
    )
    ziehe(
      [
        [100, 520],
        [300, 560],
      ],
      2,
    )
    await waitFor(async () => expect((await ladeLetzteTafel())?.seiten[0].elemente).toHaveLength(2))
    const [angelegt, frei] = (await ladeLetzteTafel())!.seiten[0].elemente as Strich[]
    const halb = angelegt.staerke / 2
    for (const [, y] of angelegt.punkte) nahe(y, kante + halb, 3)
    expect(angelegt.punkte.map((p) => Math.round(p[0]))).toEqual([100, 200, 300])
    expect(frei.punkte.some(([, y]) => y > 540)).toBe(true)

    fireEvent.keyDown(drehen, { key: 'ArrowUp', shiftKey: true })
    expect(drehen).toHaveAttribute('aria-valuetext', '15°')
    await nutzer.click(screen.getByRole('button', { name: 'Lineal wegnehmen' }))
    expect(screen.queryByRole('slider', { name: 'Lineal drehen' })).not.toBeInTheDocument()
    expect(geometrie).not.toHaveClass('an')
    // die Striche bleiben, das Lineal war nie Teil der Tafel
    expect((await ladeLetzteTafel())?.seiten[0].elemente).toHaveLength(2)
  })

  it('Lineal verschieben mit der Maus und mit zwei Fingern drehen', async () => {
    const nutzer = userEvent.setup()
    const { container } = render(<Tafel />)
    await bereit()
    await nutzer.click(leiste().getByRole('button', { name: 'Geometrie' }))
    await nutzer.click(within(screen.getByRole('dialog', { name: 'Geometrie' })).getByRole('button', { name: 'Lineal' }))
    const koerper = container.querySelector('.instrument-koerper')!
    const lage = () => container.querySelector('.instrument')!.getAttribute('transform')
    const vorher = lage()
    act(() => {
      fireEvent.pointerDown(koerper, { pointerId: 5, pointerType: 'mouse', button: 0, clientX: 300, clientY: 300 })
      fireEvent.pointerMove(koerper, { pointerId: 5, pointerType: 'mouse', clientX: 340, clientY: 320 })
      fireEvent.pointerUp(koerper, { pointerId: 5, pointerType: 'mouse', clientX: 340, clientY: 320 })
    })
    expect(lage()).not.toBe(vorher)
    expect(lage()).toMatch(/rotate\(0\) scale\(1\)$/)
    act(() => {
      fireEvent.pointerDown(koerper, { pointerId: 6, pointerType: 'touch', isPrimary: true, clientX: 200, clientY: 300 })
      fireEvent.pointerDown(koerper, { pointerId: 7, pointerType: 'touch', isPrimary: false, clientX: 400, clientY: 300 })
      fireEvent.pointerMove(koerper, { pointerId: 7, pointerType: 'touch', clientX: 200 + 200 * Math.cos(Math.PI / 6), clientY: 300 + 200 * Math.sin(Math.PI / 6) })
      fireEvent.pointerUp(koerper, { pointerId: 7, pointerType: 'touch' })
      fireEvent.pointerUp(koerper, { pointerId: 6, pointerType: 'touch' })
    })
    expect(lage()).toMatch(/rotate\(30\) scale\(1\)$/)
    expect(screen.getByRole('slider', { name: 'Lineal drehen' })).toHaveAttribute('aria-valuetext', '−30°')
  })
})
