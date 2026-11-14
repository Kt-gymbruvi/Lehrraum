// Muster als Hintergrund (Spezifikation Hintergründe, M1–M3, E1): Logik in kern/muster.ts und Bedienung an der Tafel.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ausfuehrenAuf, leererVerlauf, rueckgaengigAuf, wiederholenAuf } from '../kern/befehle.ts'
import { MUSTERARTEN, neueSeite, neuesTafelbild, pruefeTafel, type Muster } from '../kern/modell.ts'
import { abstandVon, gleichesMuster, MUSTER, musterTeile } from '../kern/muster.ts'
import { gehe, seiteDazu } from '../kern/seiten.ts'
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

const BLATT: [number, number] = [1600, 900]
const linien = (m: Muster, blatt: [number, number] | null = BLATT, bereich: [number, number, number, number] = [0, 0, 1600, 900], zoom = 1) =>
  musterTeile(m, bereich, blatt, zoom).filter((t) => t.art === 'linie')

describe('Muster – Logik', () => {
  it('jede Art liefert auf einem Blatt etwas und bleibt im Blatt', () => {
    for (const art of MUSTERARTEN) {
      const teile = musterTeile({ art }, [-500, -500, 3000, 3000], BLATT, 1)
      expect(teile.length, art).toBeGreaterThan(0)
      for (const t of teile) {
        if (t.art === 'linie' && art !== 'isometrisch') {
          expect(Math.min(t.x1, t.x2), art).toBeGreaterThanOrEqual(0)
          expect(Math.max(t.y1, t.y2), art).toBeLessThanOrEqual(900)
        }
      }
    }
  })

  it('Abstand: eng hat mehr Linien als mittel, mittel mehr als weit', () => {
    const anzahl = (abstand?: 'eng' | 'weit') => linien({ art: 'liniert', ...(abstand ? { abstand } : {}) }).length
    expect(anzahl('eng')).toBeGreaterThan(anzahl())
    expect(anzahl()).toBeGreaterThan(anzahl('weit'))
    expect(abstandVon({ art: 'liniert' })).toBe(56)
    expect(abstandVon({ art: 'spalten-2' })).toBe(0)
  })

  it('Farbe: grau oder blau; Rand ist rot', () => {
    const grau = linien({ art: 'liniert-rand' })
    const blau = linien({ art: 'liniert-rand', farbe: 'blau' })
    expect(new Set(grau.map((t) => t.farbe)).size).toBe(2) // Linien und Rand
    expect(grau[0].farbe).not.toBe(blau[0].farbe)
    expect(grau.at(-1)!.farbe).toBe(blau.at(-1)!.farbe) // der Rand bleibt gleich
  })

  it('unendliche Fläche: Linienmuster füllen den sichtbaren Bereich, Seitenmuster entfallen', () => {
    const weit = linien({ art: 'kariert-gross' }, null, [5000, 5000, 5800, 5400])
    expect(weit.length).toBeGreaterThan(10)
    expect(weit.every((t) => Math.max(t.x1, t.x2) >= 5000 && Math.min(t.y1, t.y2) <= 5400)).toBe(true)
    expect(musterTeile({ art: 'cornell' }, [0, 0, 1600, 900], null, 1)).toEqual([])
    expect(musterTeile({ art: 'koordinaten-4' }, [0, 0, 1600, 900], null, 1)).toEqual([])
  })

  it('zu fein für den Zoom: dichte Linien fallen weg, statt einen grauen Brei zu zeichnen', () => {
    expect(linien({ art: 'kariert-klein' }, null, [0, 0, 100000, 100000], 0.05)).toEqual([])
    // Millimeterpapier zeigt dann nur noch jede fünfte Linie
    const nah = linien({ art: 'millimeter' }, BLATT, [0, 0, 1600, 900], 1).length
    const fern = linien({ art: 'millimeter' }, BLATT, [0, 0, 1600, 900], 0.3).length
    expect(fern).toBeLessThan(nah / 3)
    expect(fern).toBeGreaterThan(0)
  })

  it('Koordinatensystem und Wochenplan haben Beschriftungen', () => {
    const k = musterTeile({ art: 'koordinaten-4' }, [0, 0, 1600, 900], BLATT, 1).filter((t) => t.art === 'text').map((t) => (t.art === 'text' ? t.text : ''))
    expect(k).toEqual(expect.arrayContaining(['x', 'y', '0', '1', '-1']))
    const w = musterTeile({ art: 'wochenplan' }, [0, 0, 1600, 900], BLATT, 1).flatMap((t) => (t.art === 'text' ? [t.text] : []))
    expect(w).toEqual(['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'])
  })

  it('gleiches Muster erkennen', () => {
    expect(gleichesMuster(undefined, undefined)).toBe(true)
    expect(gleichesMuster({ art: 'liniert' }, { art: 'liniert' })).toBe(true)
    expect(gleichesMuster({ art: 'liniert' }, { art: 'liniert', abstand: 'eng' })).toBe(false)
    expect(gleichesMuster({ art: 'liniert' }, undefined)).toBe(false)
  })

  it('Prüfung: Muster bleibt erhalten, Unsinn fällt weg; Version 4 hat keins', () => {
    const t = { ...neuesTafelbild(), seiten: [{ ...neueSeite(), muster: { art: 'kariert-klein', abstand: 'eng', farbe: 'blau', extra: 1 } }, { ...neueSeite(), muster: { art: 'karo' } }] }
    const g = pruefeTafel(t)!
    expect(g.seiten[0].muster).toEqual({ art: 'kariert-klein', abstand: 'eng', farbe: 'blau' })
    expect(g.seiten[1].muster).toBeUndefined()
    expect(pruefeTafel({ ...t, version: 4 })!.seiten[0].muster).toBeUndefined()
  })

  it('Befehl „muster“: ausführen, zurücknehmen, wiederholen – die Elemente bleiben', () => {
    const start = { elemente: [] }
    const a = ausfuehrenAuf(start, leererVerlauf(), { art: 'muster', nachher: { art: 'liniert' } })
    expect(a.inhalt.muster).toEqual({ art: 'liniert' })
    const b = rueckgaengigAuf(a.inhalt, a.verlauf)
    expect(b.inhalt.muster).toBeUndefined()
    expect(wiederholenAuf(b.inhalt, b.verlauf).inhalt.muster).toEqual({ art: 'liniert' })
  })

  it('eine neue Seite übernimmt das Muster der Seite, von der aus sie angelegt wird', () => {
    const b = { seiten: [{ ...neueSeite(), muster: { art: 'noten' } as Muster }, neueSeite()], nr: 0 }
    expect(seiteDazu(b).seiten[1].muster).toEqual({ art: 'noten' })
    expect(seiteDazu(gehe(b, 1)).seiten[2].muster).toBeUndefined()
  })

  it('alle Arten haben einen Namen und eine Gruppe', () => {
    for (const art of MUSTERARTEN) expect(MUSTER[art].name.length).toBeGreaterThan(2)
  })
})

describe('Muster – Bedienung', () => {
  const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
  const muster = async () => (await ladeLetzteTafel())?.seiten.map((s) => s.muster)

  it('wählt ein Muster für diese Seite, ändert Abstand und Farbe, nimmt es zurück', async () => {
    const nutzer = userEvent.setup()
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Hintergrund' }))
    const feld = screen.getByRole('dialog', { name: 'Hintergrund' })
    expect(within(feld).getByRole('button', { name: 'Leer' })).toHaveAttribute('aria-pressed', 'true')
    await nutzer.click(within(feld).getByRole('button', { name: 'Liniert' }))
    await waitFor(async () => expect(await muster()).toEqual([{ art: 'liniert' }]))
    await nutzer.click(within(feld).getByRole('button', { name: 'Eng' }))
    await nutzer.click(within(feld).getByRole('button', { name: 'Blau' }))
    await waitFor(async () => expect(await muster()).toEqual([{ art: 'liniert', abstand: 'eng', farbe: 'blau' }]))
    // Ein anderes Muster behält Abstand und Farbe
    await nutzer.click(within(feld).getByRole('button', { name: 'Kariert groß' }))
    await waitFor(async () => expect(await muster()).toEqual([{ art: 'kariert-gross', abstand: 'eng', farbe: 'blau' }]))
    await nutzer.keyboard('{Escape}')
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect(await muster()).toEqual([{ art: 'liniert', abstand: 'eng', farbe: 'blau' }]))
  })

  it('„Alle Seiten“ gilt für jede Seite ohne PDF-Hintergrund; neue Seiten übernehmen das Muster', async () => {
    const nutzer = userEvent.setup()
    const pdfSeite = neueSeite([], { dateiId: 'abcdef12', b: 800, h: 600 })
    await speichereTafel({ ...neuesTafelbild('Drei'), seiten: [neueSeite(), pdfSeite, neueSeite()] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Hintergrund' }))
    const feld = screen.getByRole('dialog', { name: 'Hintergrund' })
    await nutzer.click(within(feld).getByRole('button', { name: 'Alle Seiten' }))
    await nutzer.click(within(feld).getByRole('button', { name: 'Notenlinien' }))
    await waitFor(async () => expect(await muster()).toEqual([{ art: 'noten' }, undefined, { art: 'noten' }]))
    await nutzer.keyboard('{Escape}')
    await nutzer.click(screen.getByRole('button', { name: 'Neue Seite' }))
    await waitFor(async () => expect(await muster()).toEqual([{ art: 'noten' }, { art: 'noten' }, undefined, { art: 'noten' }]))
  })

  it('auf einer PDF-Seite ist „Diese Seite“ gesperrt; Seitenmuster nur in festen Formaten', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild('PDF', 'unendlich'), seiten: [neueSeite([], { dateiId: 'abcdef12', b: 800, h: 600 })] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Hintergrund' }))
    const feld = screen.getByRole('dialog', { name: 'Hintergrund' })
    expect(within(feld).getByText(/hat ein PDF oder Bild als Hintergrund/)).toBeInTheDocument()
    expect(within(feld).getByRole('button', { name: 'Liniert' })).toBeDisabled()
    await nutzer.click(within(feld).getByRole('button', { name: 'Alle Seiten' }))
    expect(within(feld).getByRole('button', { name: 'Liniert' })).toBeEnabled()
    expect(within(feld).getByRole('button', { name: 'Cornell-Notizen' })).toBeDisabled() // unendliche Tafel
  })
})
