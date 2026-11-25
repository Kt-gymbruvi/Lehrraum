// Etappe 4: Fenster „Zufall & Gruppen“ in der Tafel einer Klasse.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.tsx'
import { schalte, pruefeFenster } from '../kern/fenster.ts'
import { namenAusText, neueKlasse, type Schueler } from '../kern/klassen.ts'
import { anzeigeNamen, bildeGruppen, bildePaare, feldAmZeiger, gemischt, gruppenAnzahl, gruppenText, raddrehung, ziehe } from '../kern/zufall.ts'
import { ladeKlasse, ladeTafel, speichereKlasse } from '../speicher/datenbank.ts'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})
beforeEach(vergissStift)

const s = (id: string, vorname: string, nachname: string): Schueler => ({ id, vorname, nachname })
/** vorhersehbarer „Zufall“: immer die erste Möglichkeit */
const erster = () => 0

describe('Zufall – Logik', () => {
  it('Anzeigenamen: Vorname, bei Gleichheit mit Anfangsbuchstaben, notfalls ganz', () => {
    const n = anzeigeNamen([s('a1aa', 'Anna', 'Muster'), s('b2bb', 'Anna', 'Beispiel'), s('c3cc', 'Ben', 'Muster'), s('d4dd', 'Lea', 'Meier'), s('e5ee', 'Lea', 'Müller'), s('f6ff', '', 'Ohne')])
    expect([...n.values()]).toEqual(['Anna M.', 'Anna B.', 'Ben', 'Lea Meier', 'Lea Müller', 'Ohne'])
  })

  it('zieht ohne Wiederholung, bis alle dran waren – dann neue Runde', () => {
    const ids = ['a', 'b', 'c']
    const dran = new Set<string>()
    for (let i = 0; i < 3; i++) {
      const z = ziehe(ids, dran, true)!
      expect(dran.has(z.id)).toBe(false)
      expect(z.neueRunde).toBe(false)
      dran.add(z.id)
    }
    expect(ziehe(ids, dran, true)?.neueRunde).toBe(true)
    expect(ziehe([], dran, true)).toBeNull()
    expect(ziehe(ids, new Set(['a', 'b', 'c']), false, erster)).toEqual({ id: 'a', neueRunde: false })
  })

  it('Gruppen: nach Anzahl oder Größe, Größen unterscheiden sich höchstens um eins, niemand fehlt', () => {
    const ids = Array.from({ length: 23 }, (_, i) => 'p' + i)
    expect(gruppenAnzahl(23, 'anzahl', 4)).toBe(4)
    expect(gruppenAnzahl(23, 'groesse', 4)).toBe(6)
    expect(gruppenAnzahl(3, 'anzahl', 10)).toBe(3)
    for (const [art, wert] of [['anzahl', 4], ['groesse', 4], ['groesse', 3]] as const) {
      const g = bildeGruppen(ids, art, wert)
      const groessen = g.map((x) => x.length)
      expect(Math.max(...groessen) - Math.min(...groessen)).toBeLessThanOrEqual(1)
      if (art === 'groesse') expect(Math.max(...groessen)).toBeLessThanOrEqual(wert)
      expect(g.flat().sort()).toEqual([...ids].sort())
    }
    expect(gemischt([1, 2, 3, 4], erster)).toEqual([2, 3, 4, 1])
    expect(gruppenText([['a', 'b'], ['c']], new Map([['a', 'Anna'], ['b', 'Ben'], ['c', 'Carla']]))).toBe('Gruppe 1: Anna, Ben\nGruppe 2: Carla')
  })

  it('Paare: alle sind dabei, bei ungerader Zahl eine Dreiergruppe, eine einzelne Person bleibt allein', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const p = bildePaare(ids)
    expect(p.map((x) => x.length)).toEqual([2, 2, 2])
    expect(p.flat().sort()).toEqual(ids)
    const ungerade = bildePaare(['a', 'b', 'c', 'd', 'e'])
    expect(ungerade.map((x) => x.length).sort()).toEqual([2, 3])
    expect(bildePaare(['a'])).toEqual([['a']])
    expect(bildePaare([])).toEqual([])
    expect(gruppenText([['a', 'b']], new Map([['a', 'Anna'], ['b', 'Ben']]), 'Paar')).toBe('Paar 1: Anna, Ben')
  })

  it('Glücksrad: das Rad läuft immer auf das gezogene Feld aus und nie rückwärts', () => {
    for (const n of [2, 3, 7, 24]) {
      for (let feld = 0; feld < n; feld++) {
        for (const aktuell of [0, 123.4, 1800, 3999.9]) {
          for (const versatz of [0, 0.5, 1]) {
            const neu = raddrehung(aktuell, n, feld, versatz, 5)
            expect(neu).toBeGreaterThanOrEqual(aktuell + 5 * 360)
            expect(neu).toBeLessThan(aktuell + 6 * 360 + 1e-6)
            expect(feldAmZeiger(neu, n)).toBe(feld)
          }
        }
      }
    }
  })

  it('das Fenster lässt sich speichern und wieder laden', () => {
    const l = schalte([], 'zufall')
    const { mitte, ...gespeichert } = l[0] // „mitte“ gilt nur gleich nach dem Öffnen und wird nicht gespeichert
    expect(mitte).toBe(0)
    expect(pruefeFenster(JSON.parse(JSON.stringify(l)))).toEqual([gespeichert])
  })
})

describe('Fenster „Zufall & Gruppen“', () => {
  const zeige = (adresse: string) =>
    render(
      <MemoryRouter initialEntries={[adresse]}>
        <App />
      </MemoryRouter>,
    )

  it('gibt es nur in der Tafel einer Klasse', async () => {
    zeige('/tafel')
    await screen.findByRole('button', { name: 'Stoppuhr' })
    expect(screen.queryByRole('button', { name: 'Zufall & Gruppen' })).not.toBeInTheDocument()
  })

  it('lost aus, nimmt Fehlende aus, bildet Gruppen und schreibt sie an die Tafel – rückgängig machbar', async () => {
    const nutzer = userEvent.setup()
    const k = { ...neueKlasse({ bezeichnung: '7b', fach: 'Biologie', jahrgang: '' }), schueler: namenAusText('Muster, Anna\nBeispiel, Ben\nTest, Carla\nProbe, David') }
    await speichereKlasse(k)
    zeige(`/tafel?klasse=${k.id}`)
    await screen.findByRole('heading', { name: /^(7b Biologie|8c)$/ }) // erst wenn die Tafel geladen ist
    await nutzer.click(screen.getByRole('button', { name: 'Zufall & Gruppen' }))
    const fenster = within(await screen.findByRole('region', { name: 'Zufall & Gruppen' }))
    await waitFor(() => expect(fenster.getByRole('button', { name: 'Auslosen' })).toBeEnabled())

    // Heute nicht da: Anna und Ben
    await nutzer.click(fenster.getByRole('button', { name: 'Heute nicht da' }))
    await nutzer.click(fenster.getByRole('button', { name: 'Anna' }))
    await nutzer.click(fenster.getByRole('button', { name: 'Ben' }))
    expect(fenster.getByText('2 von 4 da')).toBeInTheDocument()

    // Auslosen ohne Animation: nur Carla oder David, ohne Wiederholung beide
    await nutzer.click(fenster.getByRole('button', { name: /^Wer ist dran/ }))
    await nutzer.click(fenster.getByLabelText('Mit Animation'))
    if ((fenster.getByLabelText('Mit Animation') as HTMLInputElement).checked) await nutzer.click(fenster.getByLabelText('Mit Animation'))
    const gezogen: string[] = []
    for (let i = 0; i < 2; i++) {
      await nutzer.click(fenster.getByRole('button', { name: 'Auslosen' }))
      gezogen.push(fenster.getByRole('status').textContent ?? '')
    }
    expect(gezogen.sort()).toEqual(['Carla', 'David'])
    await nutzer.click(fenster.getByRole('button', { name: 'Auslosen' }))
    expect(fenster.getByText('Alle waren dran – neue Runde.')).toBeInTheDocument()

    // Gruppen: zwei Gruppen aus den beiden Anwesenden
    await nutzer.click(fenster.getByRole('button', { name: 'Gruppen' }))
    await nutzer.click(fenster.getByRole('button', { name: 'Gruppen bilden' }))
    const gruppen = fenster.getByRole('list', { name: 'Gruppen' })
    expect(within(gruppen).getAllByRole('heading')).toHaveLength(2)
    expect(gruppen.textContent).not.toMatch(/Anna|Ben/)

    // An die Tafel: ein Text-Element; Rückgängig nimmt es wieder weg
    await nutzer.click(fenster.getByRole('button', { name: 'An die Tafel schreiben' }))
    const text = async () => {
      const tafelId = (await ladeKlasse(k.id))?.tafelId
      return (await ladeTafel(tafelId!))?.seiten[0].elemente.filter((e) => e.art === 'text') ?? []
    }
    await waitFor(async () => expect((await text()).map((e) => (e.art === 'text' ? e.text : ''))).toEqual([expect.stringMatching(/^Gruppe 1: (Carla|David)\nGruppe 2: (Carla|David)$/)]))
    await nutzer.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(async () => expect(await text()).toEqual([]))
    // Nichts von „Heute nicht da“ wurde in der Klasse gespeichert
    expect((await ladeKlasse(k.id))?.schueler).toHaveLength(4)
  }, 20_000)

  it('Paare bilden und mit dem Glücksrad auslosen', async () => {
    const nutzer = userEvent.setup()
    const k = { ...neueKlasse({ bezeichnung: '9a', fach: 'Sport', jahrgang: '' }), schueler: namenAusText('Muster, Anna\nBeispiel, Ben\nTest, Carla\nProbe, David\nNeu, Emil') }
    await speichereKlasse(k)
    zeige(`/tafel?klasse=${k.id}`)
    await screen.findByRole('heading', { name: '9a Sport' })
    await nutzer.click(screen.getByRole('button', { name: 'Zufall & Gruppen' }))
    const fenster = within(await screen.findByRole('region', { name: 'Zufall & Gruppen' }))
    await waitFor(() => expect(fenster.getByRole('button', { name: 'Auslosen' })).toBeEnabled())

    // Paare: fünf Personen = ein Paar und eine Dreiergruppe
    await nutzer.click(fenster.getByRole('button', { name: 'Paare' }))
    await nutzer.click(fenster.getByRole('button', { name: 'Paare bilden' }))
    const paare = fenster.getByRole('list', { name: 'Paare' })
    expect(within(paare).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Paar 1', 'Dreiergruppe'])
    expect(paare.textContent).toMatch(/Anna/)

    // Glücksrad (ohne Animation): ein Feld je Person, danach steht der Name unter dem Rad
    await nutzer.click(fenster.getByRole('button', { name: /^Wer ist dran/ }))
    await nutzer.click(fenster.getByRole('button', { name: 'Glücksrad' }))
    expect(fenster.getByRole('img', { name: 'Glücksrad mit 5 Feldern' })).toBeInTheDocument()
    await nutzer.click(fenster.getByLabelText('Mit Animation'))
    if ((fenster.getByLabelText('Mit Animation') as HTMLInputElement).checked) await nutzer.click(fenster.getByLabelText('Mit Animation'))
    await nutzer.click(fenster.getByRole('button', { name: 'Rad drehen' }))
    await waitFor(() => expect(fenster.getByRole('status').textContent).toMatch(/^(Anna|Ben|Carla|David|Emil)$/))
  }, 20_000)

  it('ohne Namen ein Hinweis mit dem Weg zu „Meine Klassen“', async () => {
    const nutzer = userEvent.setup()
    const k = neueKlasse({ bezeichnung: '8c', fach: '', jahrgang: '' })
    await speichereKlasse(k)
    zeige(`/tafel?klasse=${k.id}`)
    await screen.findByRole('heading', { name: /^(7b Biologie|8c)$/ }) // erst wenn die Tafel geladen ist
    await nutzer.click(screen.getByRole('button', { name: 'Zufall & Gruppen' }))
    expect(await screen.findByText(/hat noch keine Namen/)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Zufall & Gruppen' })).getByRole('link', { name: 'Meine Klassen' })).toHaveAttribute('href', '#/klassen')
  })
})
