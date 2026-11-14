// Hintergründe Etappe 3: eigenes Bild als Hintergrund (B1, B2) und Vorlage je Klasse (V1).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.tsx'
import { ausfuehrenAuf, leererVerlauf, rueckgaengigAuf } from '../kern/befehle.ts'
import { alsHintergrundBefehl, bildHintergrund, bildHintergrundBefehl } from '../kern/blatt.ts'
import { kopierteKlasse, neueKlasse, pruefeKlasse, vorlageAus, type Klasse } from '../kern/klassen.ts'
import { neueSeite, neuesTafelbild, type Bild, type Strich } from '../kern/modell.ts'
import { seiteDazu } from '../kern/seiten.ts'
import { ladeKlasse, ladeKlassen, ladeLetzteTafel, ladeTafel, oeffneKlassenTafel, speichereKlasse, speichereTafel } from '../speicher/datenbank.ts'
import Tafel from '../tafel/Tafel.tsx'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

// Bilder entschlüsseln braucht einen echten Browser – ersetzt.
vi.mock('../tafel/bilder.ts', async (original) => ({
  ...(await original<typeof import('../tafel/bilder.ts')>()),
  nimmBild: async () => ({ dateiId: 'ab12cd3401', b: 800, h: 800 }),
}))

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

const bild = (id: string, mehr: Partial<Bild> = {}): Bild => ({ art: 'bild', id, x: 100, y: 100, b: 400, h: 200, dateiId: 'ab12cd34', ...mehr })
const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, 0, 0.5], [100, 0, 0.5]] })
const klasse = (mehr: Partial<Klasse> = {}): Klasse => ({ ...neueKlasse({ bezeichnung: '7b', fach: 'Mathe', jahrgang: '' }), ...mehr })

describe('Bild als Hintergrund – Logik', () => {
  it('passt das Bild ins Blatt des Formats ein; unendlich höchstens 1600 lang', () => {
    expect(bildHintergrund({ dateiId: 'ab12cd34', b: 800, h: 800 }, '16:9')).toEqual({ dateiId: 'ab12cd34', b: 900, h: 900 })
    expect(bildHintergrund({ dateiId: 'ab12cd34', b: 4000, h: 1000 }, '16:9')).toEqual({ dateiId: 'ab12cd34', b: 1600, h: 400 })
    expect(bildHintergrund({ dateiId: 'ab12cd34', b: 400, h: 300 }, 'unendlich')).toEqual({ dateiId: 'ab12cd34', b: 400, h: 300 })
    expect(bildHintergrund({ dateiId: 'ab12cd34', b: 3200, h: 1000 }, 'unendlich')).toEqual({ dateiId: 'ab12cd34', b: 1600, h: 500 })
  })

  it('PDF-Seiten bekommen kein Bild als Hintergrund', () => {
    const h = { dateiId: 'ab12cd34', b: 900, h: 900 }
    expect(bildHintergrundBefehl(neueSeite([], { dateiId: 'ffee0011', b: 794, h: 1123, pdf: 'ffee0012' }), h)).toBeNull()
    expect(bildHintergrundBefehl(neueSeite(), h)).toMatchObject({ art: 'hintergrund', nachher: h })
  })

  it('„Als Hintergrund“: das Bild verschwindet als Element und kommt beim Zurücknehmen an seine Stelle zurück', () => {
    const s = neueSeite([strich('a'), bild('b'), strich('c')])
    const befehl = alsHintergrundBefehl(s, s.elemente[1] as Bild, '16:9')!
    const a = ausfuehrenAuf({ elemente: s.elemente }, leererVerlauf(), befehl)
    expect(a.inhalt.elemente.map((e) => e.id)).toEqual(['a', 'c'])
    expect(a.inhalt.hintergrund).toEqual({ dateiId: 'ab12cd34', b: 1600, h: 800 })
    const z = rueckgaengigAuf(a.inhalt, a.verlauf)
    expect(z.inhalt.elemente.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(z.inhalt.hintergrund).toBeUndefined()
  })
})

describe('Vorlage je Klasse – Logik', () => {
  it('Vorlage nur, wenn sie vom Standard abweicht; Prüfung und Kopie', () => {
    expect(vorlageAus('16:9')).toBeUndefined()
    expect(vorlageAus('a4-hoch')).toEqual({ format: 'a4-hoch' })
    expect(vorlageAus('16:9', { art: 'kariert-klein' })).toEqual({ format: '16:9', muster: { art: 'kariert-klein' } })
    const k = klasse({ vorlage: { format: 'a4-quer', muster: { art: 'liniert', farbe: 'blau' } } })
    expect(k.version).toBe(2)
    expect(pruefeKlasse(JSON.parse(JSON.stringify(k)))).toEqual(k)
    expect(pruefeKlasse({ ...k, vorlage: { format: 'riesig' } })!.vorlage).toBeUndefined()
    expect(pruefeKlasse({ ...k, vorlage: { format: 'a4-hoch', muster: { art: 'karo' } } })!.vorlage).toEqual({ format: 'a4-hoch' })
    expect(pruefeKlasse({ ...k, version: 1 })).toMatchObject({ id: k.id, bezeichnung: '7b' }) // Version 1: ohne Vorlage übernommen
    expect(pruefeKlasse({ ...k, version: 1 })!.vorlage).toBeUndefined()
    expect(kopierteKlasse(k).vorlage).toEqual(k.vorlage)
  })

  it('neue Seiten: Muster der Vorlage statt des Musters der aktuellen Seite', () => {
    const b = { seiten: [{ ...neueSeite(), muster: { art: 'noten' as const } }], nr: 0 }
    expect(seiteDazu(b, { muster: { art: 'punkte' } }).seiten[1].muster).toEqual({ art: 'punkte' })
    expect(seiteDazu(b, {}).seiten[1].muster).toBeUndefined() // Vorlage ohne Muster: leer
  })

  it('die Tafel einer Klasse entsteht im Format und mit dem Muster der Vorlage', async () => {
    const k = klasse({ vorlage: { format: 'a4-hoch', muster: { art: 'lineatur' } } })
    await speichereKlasse(k)
    const t = (await oeffneKlassenTafel(k.id))!
    expect(t.format).toBe('a4-hoch')
    expect(t.seiten[0].muster).toEqual({ art: 'lineatur' })
  })
})

// ---------- Bedienung ----------
const bereit = () => screen.findByText('Auf diesem Gerät gespeichert')
const flaeche = () => screen.getByTestId('zeichenflaeche')
const tippe = (x: number, y: number) => {
  fireEvent.pointerDown(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
  fireEvent.pointerUp(flaeche(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
}
const zeige = (adresse: string) =>
  render(
    <MemoryRouter initialEntries={[adresse]}>
      <App />
    </MemoryRouter>,
  )

describe('Bild als Hintergrund – Bedienung', () => {
  it('„Bild wählen …“ im Feld Hintergrund setzt das Bild auf alle Seiten außer PDF-Seiten', async () => {
    const nutzer = userEvent.setup()
    const pdfSeite = neueSeite([], { dateiId: 'ffee0011', b: 794, h: 1123, pdf: 'ffee0012' })
    await speichereTafel({ ...neuesTafelbild('Drei'), seiten: [neueSeite(), pdfSeite, neueSeite()] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Hintergrund' }))
    const feld = screen.getByRole('dialog', { name: 'Hintergrund' })
    await nutzer.click(within(feld).getByRole('button', { name: 'Alle Seiten' }))
    await nutzer.click(within(feld).getByRole('button', { name: 'Bild wählen …' }))
    await nutzer.upload(screen.getByLabelText('Bild für den Hintergrund wählen'), new File(['x'], 'tafel.png', { type: 'image/png' }))
    await waitFor(async () =>
      expect((await ladeLetzteTafel())!.seiten.map((s) => s.hintergrund?.dateiId)).toEqual(['ab12cd3401', 'ffee0011', 'ab12cd3401']),
    )
    expect((await ladeLetzteTafel())!.seiten[0].hintergrund).toMatchObject({ b: 900, h: 900 })
    // Auf der Seite mit Bild heißt der Knopf in der Seitenleiste „Hintergrundbild entfernen“
    await nutzer.keyboard('{Escape}')
    await nutzer.click(screen.getByRole('button', { name: 'Hintergrundbild entfernen' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten[0].hintergrund).toBeUndefined())
  })

  it('ein ausgewähltes Bild wird mit „Als Hintergrund“ zum Hintergrund – und zurück', async () => {
    const nutzer = userEvent.setup()
    await speichereTafel({ ...neuesTafelbild('Bild', 'unendlich'), seiten: [neueSeite([strich('a'), bild('b')])] })
    render(<Tafel />)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Auswahl' }))
    tippe(300, 200)
    const leiste = screen.getByRole('toolbar', { name: 'Befehle für die Auswahl' })
    await nutzer.click(within(leiste).getByRole('button', { name: 'Als Hintergrund' }))
    await waitFor(async () => {
      const s = (await ladeLetzteTafel())!.seiten[0]
      expect(s.elemente.map((e) => e.id)).toEqual(['a'])
      expect(s.hintergrund).toEqual({ dateiId: 'ab12cd34', b: 400, h: 200 })
    })
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect((await ladeLetzteTafel())!.seiten[0].elemente.map((e) => e.id)).toEqual(['a', 'b']))
  })
})

describe('Vorlage je Klasse – Bedienung', () => {
  it('Format und Hintergrund im Formular der Klasse wählen; die Karte zeigt die Vorlage', async () => {
    const nutzer = userEvent.setup()
    zeige('/klassen?neu=1')
    await screen.findByRole('form', { name: 'Neue Klasse' })
    await nutzer.type(screen.getByLabelText('Bezeichnung'), '5c')
    await nutzer.selectOptions(screen.getByLabelText('Format'), 'a4-hoch')
    await nutzer.selectOptions(screen.getByLabelText('Hintergrund neuer Seiten'), 'kariert-klein')
    await nutzer.click(screen.getByRole('button', { name: 'Klasse anlegen' }))
    expect(await screen.findByText('Vorlage: A4 hoch · Kariert klein')).toBeInTheDocument()
    expect((await ladeKlassen())[0].vorlage).toEqual({ format: 'a4-hoch', muster: { art: 'kariert-klein' } })
  })

  it('an der Tafel: Muster wählen, „Für 7b Mathe merken“ – neue Seiten bekommen das Muster der Vorlage', async () => {
    const nutzer = userEvent.setup()
    const t = { ...neuesTafelbild('7b Mathe'), seiten: [neueSeite()] }
    await speichereTafel(t)
    const k = klasse({ tafelId: t.id })
    await speichereKlasse(k)
    zeige(`/tafel?klasse=${k.id}`)
    await bereit()
    await nutzer.click(screen.getByRole('button', { name: 'Hintergrund' }))
    const feld = screen.getByRole('dialog', { name: 'Hintergrund' })
    await nutzer.click(within(feld).getByRole('button', { name: 'Punkteraster' }))
    await nutzer.click(await within(feld).findByRole('button', { name: 'Für 7b merken' }))
    await waitFor(async () => expect((await ladeKlasse(k.id))!.vorlage).toEqual({ format: '16:9', muster: { art: 'punkte' } }))
    expect(within(feld).getByRole('button', { name: 'Vorlage von 7b' })).toBeDisabled()
    // Auf der Seite wieder „Leer“ – eine neue Seite bekommt trotzdem das Muster der Vorlage
    await nutzer.click(within(feld).getByRole('button', { name: 'Leer' }))
    await nutzer.keyboard('{Escape}')
    await nutzer.click(screen.getByRole('button', { name: 'Neue Seite' }))
    await waitFor(async () => expect((await ladeTafel(t.id))!.seiten.map((s) => s.muster)).toEqual([undefined, { art: 'punkte' }]))
  })
})
