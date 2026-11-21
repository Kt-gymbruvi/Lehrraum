import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.tsx'
import { namenAusText, neueKlasse, type Klasse } from '../kern/klassen.ts'
import { neueSeite, type Bild, type Seite, type Strich, type Text } from '../kern/modell.ts'
import { pruefeFreigabeMerk, platzZeilen, sitzungsSchluessel, verschluesseleAbgabe, verschluesseleBild, oeffneSitzung, type Sitzungsdaten } from '../kern/sitzung.ts'
import { gemerkteFreigabe } from '../speicher/freigabe.ts'
import { Freigabefenster } from '../schueler/Freigabefenster.tsx'
import { speichereKlasse } from '../speicher/datenbank.ts'
import { vergissStift } from '../tafel/Zeichenflaeche.tsx'

// ---------- nachgemachter Server ----------
type Zeile = { stand: number; belegt: boolean; iv: string | null; daten: string | null; geaendert_am: string }
const store: { sitzung: { code: string; beginn: string; ende: string; iv: string; daten: string } | null; abgaben: Map<string, Zeile>; bilder: Map<string, { iv: string; daten: string }>; angemeldet: boolean } = { sitzung: null, abgaben: new Map(), bilder: new Map(), angemeldet: true }
// Die Testumgebung gibt in IndexedDB gespeicherte Blobs nicht als Blob zurück: Dateien liegen hier in einer Map
const dateien = vi.hoisted(() => new Map<string, Blob>())
vi.mock('../speicher/dateien.ts', async (original) => ({
  ...(await original<typeof import('../speicher/dateien.ts')>()),
  legeDateiAb: async (id: string, daten: Blob) => void dateien.set(id, daten),
  ladeDatei: async (id: string) => dateien.get(id) ?? null,
  ladeDateiEintrag: async (id: string) => (dateien.has(id) ? { id, typ: 'image/jpeg', daten: dateien.get(id)! } : null),
}))
const lege = vi.fn()
const setzeEnde = vi.fn()
const loesche = vi.fn()
vi.mock('../speicher/server.ts', async (original) => ({
  ...(await original<typeof import('../speicher/server.ts')>()),
  serverVorhanden: () => true,
  istAngemeldet: async () => store.angemeldet,
  legeSitzungAn: async (code: string, ende: string, iv: string, daten: string, plaetze: string[]) => {
    lege(code, ende, iv, daten, plaetze)
    store.sitzung = { code, beginn: new Date().toISOString(), ende, iv, daten }
    store.abgaben = new Map(plaetze.map((p) => [p, { stand: 0, belegt: false, iv: null, daten: null, geaendert_am: new Date().toISOString() }]))
  },
  ladeSitzungZeile: async (code: string) => (store.sitzung?.code === code ? { ...store.sitzung, loeschen_am: store.sitzung.ende } : null),
  ladeAbgabeStaende: async () => [...store.abgaben].map(([platz, z]) => ({ platz, belegt: z.belegt, stand: z.stand, geaendert_am: z.geaendert_am })),
  ladeAbgabeZeile: async (_c: string, platz: string) => store.abgaben.get(platz) ?? null,
  ladeBildZeile: async (_c: string, platz: string, bild: string) => {
    const z = store.bilder.get(`${platz}/${bild}`)
    return z ? { bild, ...z } : null
  },
  setzeSitzungEnde: async (code: string, ende: string) => {
    setzeEnde(code, ende)
    if (store.sitzung) store.sitzung.ende = ende
  },
  loescheSitzung: async (code: string) => {
    loesche(code)
    store.sitzung = null
    store.abgaben = new Map()
  },
}))

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  globalThis.Path2D = class {} as unknown as typeof Path2D
  HTMLElement.prototype.setPointerCapture = () => undefined
})

const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, 0, 0.5], [50, 10, 0.5]] })
const klasse = (namen = 'Adler, Anna\nBerg, Ben\nChen, Clara'): Klasse => ({ ...neueKlasse({ bezeichnung: '10G1', fach: '', jahrgang: '' }), schueler: namenAusText(namen) })
const gezeigteSeite: Seite = neueSeite([strich('v1')])

/** Ein Schüler (Gerät) belegt einen Platz und schreibt – direkt in den nachgemachten Server */
async function schuelerSchreibt(klasseId: string, platzNr: number, seite: Seite, stand = 5) {
  const merk = gemerkteFreigabe(klasseId)!
  const key = await sitzungsSchluessel(merk.schluessel)
  const daten = (await oeffneSitzung(key, { iv: store.sitzung!.iv, daten: store.sitzung!.daten })) as Sitzungsdaten
  const platz = daten.plaetze[platzNr].platz
  const box = await verschluesseleAbgabe(key, platz, seite, stand)
  store.abgaben.set(platz, { stand, belegt: true, iv: box.iv, daten: box.daten, geaendert_am: new Date().toISOString() })
  return daten.plaetze[platzNr]
}

const zeige = (k: Klasse, mehr: Partial<React.ComponentProps<typeof Freigabefenster>> = {}) => {
  const beiUebernehmen = vi.fn()
  const beiSchliessen = vi.fn()
  render(<Freigabefenster klasse={k} seite={gezeigteSeite} beiUebernehmen={beiUebernehmen} beiSchliessen={beiSchliessen} abrufMs={40} {...mehr} />)
  return { beiUebernehmen, beiSchliessen }
}

beforeEach(() => {
  vergissStift()
  store.sitzung = null
  store.abgaben = new Map()
  store.bilder = new Map()
  dateien.clear()
  store.angemeldet = true
  lege.mockReset()
  setzeEnde.mockReset()
  loesche.mockReset()
  window.localStorage.clear()
})

describe('Freigabe – Logik', () => {
  it('ordnet jedem Platz einen Stand zu: frei, angemeldet, schreibt gerade, hat geschrieben', () => {
    const plaetze = [
      { platz: 'a', vorname: 'Anna', nachname: 'Adler' },
      { platz: 'b', vorname: 'Ben', nachname: 'Berg' },
      { platz: 'c', vorname: 'Clara', nachname: 'Chen' },
      { platz: 'd', vorname: 'David', nachname: 'Dorn' },
    ]
    const jetzt = new Date('2026-11-21T09:00:00Z')
    const z = platzZeilen(
      plaetze,
      [
        { platz: 'a', belegt: false, stand: 0, geaendert_am: jetzt.toISOString() },
        { platz: 'b', belegt: true, stand: 0, geaendert_am: jetzt.toISOString() },
        { platz: 'c', belegt: true, stand: 4, geaendert_am: '2026-11-21T08:59:30Z' },
        { platz: 'd', belegt: true, stand: 9, geaendert_am: '2026-11-21T08:50:00Z' },
      ],
      jetzt,
    )
    expect(z.map((x) => x.status)).toEqual(['frei', 'angemeldet', 'schreibt', 'hat-geschrieben'])
    expect(z[0].name).toBe('Anna Adler')
    // fehlende Zeile = frei
    expect(platzZeilen(plaetze, [], jetzt).every((x) => x.status === 'frei')).toBe(true)
  })

  it('prüft die gemerkte Freigabe', () => {
    expect(pruefeFreigabeMerk({ code: 'c'.repeat(22), schluessel: 'k'.repeat(43) })).toEqual({ code: 'c'.repeat(22), schluessel: 'k'.repeat(43) })
    expect(pruefeFreigabeMerk({ code: 'kurz', schluessel: 'k'.repeat(43) })).toBeNull()
    expect(pruefeFreigabeMerk(null)).toBeNull()
  })
})

describe('Freigabefenster', () => {
  it('verlangt eine Anmeldung', async () => {
    store.angemeldet = false
    zeige(klasse())
    expect(await screen.findByText(/musst du angemeldet sein/)).toBeInTheDocument()
  })

  it('sagt, wenn die Klasse noch keine Namen hat', async () => {
    zeige(klasse(''))
    expect(await screen.findByText(/noch keine Namen/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'QR-Code erzeugen' })).toBeNull()
  })

  it('legt die Freigabe verschlüsselt an und zeigt QR-Code, Zeit und Zahl der Schüler', async () => {
    const k = klasse()
    zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: '45 Minuten' }))
    await nutzer.click(screen.getByRole('button', { name: 'QR-Code erzeugen' }))
    expect(await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })).toBeInTheDocument()
    expect(screen.getByText('0 von 3 dabei')).toBeInTheDocument()
    expect(screen.getByText(/noch 4\d:\d\d/)).toBeInTheDocument()
    const [code, ende, , daten, plaetze] = lege.mock.calls[0]
    expect(daten).not.toContain('Adler')
    expect(plaetze).toHaveLength(5) // 3 Namen + 2 Gäste (Standard)
    expect(new Date(ende).getTime() - Date.now()).toBeGreaterThan(44 * 60_000)
    const merk = gemerkteFreigabe(k.id)
    expect(merk?.code).toBe(code)
  })

  it('schickt die gezeigte Seite nur auf Wunsch als Aufgabenblatt mit', async () => {
    const k = klasse()
    zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByLabelText('Die gezeigte Seite als Aufgabenblatt mitschicken'))
    await nutzer.click(screen.getByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    const merk = gemerkteFreigabe(k.id)!
    const daten = (await oeffneSitzung(await sitzungsSchluessel(merk.schluessel), { iv: lege.mock.calls[0][2], daten: lege.mock.calls[0][3] }))!
    expect(daten.vorlage?.elemente).toHaveLength(1)
  })

  it('zeigt die Seite eines Schülers, lässt auswählen und gibt sie mit Namen zum Kopieren frei', async () => {
    const k = klasse()
    const { beiUebernehmen } = zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    await schuelerSchreibt(k.id, 0, neueSeite([strich('s1'), strich('s2')]))
    const wahl = await screen.findByRole('checkbox', { name: 'Anna Adler auswählen' })
    await waitFor(() => expect(wahl).toBeEnabled())
    expect(screen.getByText('1 von 3 dabei')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Ben Berg auswählen' })).toBeDisabled()
    await nutzer.click(wahl)
    await nutzer.click(screen.getByRole('button', { name: /Auf die Klassentafel kopieren \(1\)/ }))
    expect(beiUebernehmen).toHaveBeenCalledTimes(1)
    const [seiten] = beiUebernehmen.mock.calls[0] as [Seite[]]
    expect(seiten).toHaveLength(1)
    expect(seiten[0].elemente).toHaveLength(3)
    const beschriftung = seiten[0].elemente.at(-1) as Text
    expect(beschriftung.text).toMatch(/^Anna Adler, \d\d\.\d\d\.\d{4}$/)
    expect(await screen.findByText(/1 Seite auf die Klassentafel kopiert/)).toBeInTheDocument()
  })

  it('öffnet eine Seite groß', async () => {
    const k = klasse()
    zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    await schuelerSchreibt(k.id, 1, neueSeite([strich('s1')]))
    await nutzer.click(await screen.findByRole('button', { name: 'Seite von Ben Berg groß ansehen' }))
    expect(screen.getByRole('dialog', { name: 'Seite von Ben Berg' })).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Zurück' }))
    expect(screen.queryByRole('dialog', { name: 'Seite von Ben Berg' })).toBeNull()
  })

  it('verlängert und beendet die Zeit', async () => {
    const k = klasse()
    zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    const vorher = new Date(store.sitzung!.ende).getTime()
    await nutzer.click(screen.getByRole('button', { name: '10 Minuten mehr' }))
    await waitFor(() => expect(setzeEnde).toHaveBeenCalledTimes(1))
    expect(new Date(setzeEnde.mock.calls[0][1]).getTime() - vorher).toBe(10 * 60_000)
    await nutzer.click(screen.getByRole('button', { name: 'Jetzt beenden' }))
    await waitFor(() => expect(setzeEnde).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Zeit ist um')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Jetzt beenden' })).toBeNull()
  })

  it('findet eine laufende Freigabe nach dem Neuladen wieder', async () => {
    const k = klasse()
    const erstes = render(<Freigabefenster klasse={k} seite={gezeigteSeite} beiUebernehmen={vi.fn()} beiSchliessen={vi.fn()} abrufMs={40} />)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    erstes.unmount()
    zeige(k)
    expect(await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'QR-Code erzeugen' })).toBeNull()
    expect(lege).toHaveBeenCalledTimes(1)
  })

  it('löscht auf Nachfrage alles und vergisst die Freigabe', async () => {
    const k = klasse()
    zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    await nutzer.click(screen.getByRole('button', { name: 'Fertig – Rest löschen' }))
    expect(loesche).not.toHaveBeenCalled() // erst fragen
    await nutzer.click(screen.getByRole('button', { name: 'Ja, alles löschen' }))
    await waitFor(() => expect(loesche).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: 'QR-Code erzeugen' })).toBeInTheDocument()
    expect(gemerkteFreigabe(k.id)).toBeNull()
  })

  it('vergisst eine Freigabe, die es auf dem Server nicht mehr gibt', async () => {
    const k = klasse()
    window.localStorage.setItem(`lehrraum-freigabe-${k.id}`, JSON.stringify({ code: 'c'.repeat(22), schluessel: 'k'.repeat(43) }))
    zeige(k)
    expect(await screen.findByRole('button', { name: 'QR-Code erzeugen' })).toBeInTheDocument()
    expect(gemerkteFreigabe(k.id)).toBeNull()
  })
})

describe('Tafel: Knopf „Mitmachen“', () => {
  const tafel = (adresse: string) =>
    render(
      <MemoryRouter initialEntries={[adresse]}>
        <App />
      </MemoryRouter>,
    )

  it('gibt es nur in der Tafel einer Klasse und öffnet das Freigabefenster', async () => {
    tafel('/tafel')
    await screen.findByRole('button', { name: 'Stoppuhr' })
    expect(screen.queryByRole('button', { name: 'Mitmachen freigeben' })).toBeNull()
  })

  it('öffnet in der Klassentafel das Fenster mit Dauer und Aufgabenblatt', async () => {
    const k = klasse()
    await speichereKlasse(k)
    tafel(`/tafel?klasse=${k.id}`)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Mitmachen freigeben' }))
    expect(await screen.findByRole('dialog', { name: 'Mitmachen freigeben' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'QR-Code erzeugen' })).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('dialog', { name: 'Mitmachen freigeben' })).toBeNull()
  })
})

describe('Freigabefenster: Gäste', () => {
  it('legt Gast-Plätze an (Standard zwei) und zeigt sie erst, wenn jemand sie benutzt', async () => {
    const k = klasse()
    zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    expect(lege.mock.calls[0][4]).toHaveLength(5)
    expect(screen.getByText('0 von 3 dabei')).toBeInTheDocument()
    expect(screen.queryByText('Gast 1')).toBeNull()
    await schuelerSchreibt(k.id, 3, neueSeite([strich('g1')]))
    expect(await screen.findByText('Gast 1')).toBeInTheDocument()
    expect(await screen.findByText('1 von 4 dabei')).toBeInTheDocument()
    expect(screen.queryByText('Gast 2')).toBeNull()
  })

  it('legt auf Wunsch keine Gast-Plätze an', async () => {
    const k = klasse()
    zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Keine Gäste' }))
    await nutzer.click(screen.getByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    expect(lege.mock.calls[0][4]).toHaveLength(3)
  })

  it('übernimmt eine Gast-Seite mit der Beschriftung „Gast 1“', async () => {
    const k = klasse()
    const { beiUebernehmen } = zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    await schuelerSchreibt(k.id, 3, neueSeite([strich('g1')]))
    const wahl = await screen.findByRole('checkbox', { name: 'Gast 1 auswählen' })
    await waitFor(() => expect(wahl).toBeEnabled())
    await nutzer.click(wahl)
    await nutzer.click(screen.getByRole('button', { name: /Auf die Klassentafel kopieren \(1\)/ }))
    const beschriftung = (beiUebernehmen.mock.calls[0][0] as Seite[])[0].elemente.at(-1) as Text
    expect(beschriftung.text).toMatch(/^Gast 1, /)
  })
})

describe('Freigabefenster: Fotos der Schüler', () => {
  const foto: Bild = { art: 'bild', id: 'f1', x: 10, y: 10, b: 400, h: 300, dateiId: 'abcd1234ef' }

  async function fotoHochladen(klasseId: string, platzNr: number, bytes: number[]) {
    const merk = gemerkteFreigabe(klasseId)!
    const key = await sitzungsSchluessel(merk.schluessel)
    const daten = (await oeffneSitzung(key, { iv: store.sitzung!.iv, daten: store.sitzung!.daten })) as Sitzungsdaten
    const platz = daten.plaetze[platzNr].platz
    store.bilder.set(`${platz}/abcd1234ef`, await verschluesseleBild(key, platz, 'abcd1234ef', new Uint8Array(bytes)))
  }

  it('holt die Fotos einer Seite, entschlüsselt sie auf das Gerät und zeigt die Seite erst dann', async () => {
    const k = klasse()
    zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    // die Seite ist da, ihr Foto noch nicht
    await schuelerSchreibt(k.id, 0, neueSeite([strich('s1'), foto]))
    await waitFor(() => expect(screen.getByText('1 von 3 dabei')).toBeInTheDocument())
    expect(screen.getByRole('checkbox', { name: 'Anna Adler auswählen' })).toBeDisabled()
    expect(dateien.size).toBe(0)
    // jetzt kommt das Foto an: beim nächsten Abruf erscheint die Seite
    await fotoHochladen(k.id, 0, [1, 2, 3, 250])
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Anna Adler auswählen' })).toBeEnabled(), { timeout: 4000 })
    const blob = dateien.get('abcd1234ef')!
    expect(blob.size).toBe(4)
    expect(blob.type).toBe('image/jpeg')
  })

  it('gibt Seiten mit Fotos zum Kopieren frei (das Bild-Element bleibt erhalten)', async () => {
    const k = klasse()
    const { beiUebernehmen } = zeige(k)
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    await fotoHochladen(k.id, 1, [7, 7, 7])
    await schuelerSchreibt(k.id, 1, neueSeite([foto]))
    const wahl = await screen.findByRole('checkbox', { name: 'Ben Berg auswählen' })
    await waitFor(() => expect(wahl).toBeEnabled(), { timeout: 4000 })
    await nutzer.click(wahl)
    await nutzer.click(screen.getByRole('button', { name: /Auf die Klassentafel kopieren \(1\)/ }))
    const seiten = beiUebernehmen.mock.calls[0][0] as Seite[]
    expect(seiten[0].elemente.filter((x) => x.art === 'bild').map((x) => (x as Bild).dateiId)).toEqual(['abcd1234ef'])
  })
})

describe('Tafel: Seiten übernehmen ist rücknehmbar', () => {
  it('Rückgängig nimmt die kopierten Seiten weg, Wiederholen bringt sie zurück', async () => {
    const k = klasse()
    await speichereKlasse(k)
    render(
      <MemoryRouter initialEntries={[`/tafel?klasse=${k.id}`]}>
        <App />
      </MemoryRouter>,
    )
    const nutzer = userEvent.setup()
    await nutzer.click(await screen.findByRole('button', { name: 'Mitmachen freigeben' }))
    await nutzer.click(await screen.findByRole('button', { name: 'QR-Code erzeugen' }))
    await screen.findByRole('img', { name: 'QR-Code zum Mitmachen' })
    await schuelerSchreibt(k.id, 0, neueSeite([strich('s1'), strich('s2')]))
    const wahl = await screen.findByRole('checkbox', { name: 'Anna Adler auswählen' }, { timeout: 8000 })
    await waitFor(() => expect(wahl).toBeEnabled(), { timeout: 8000 })
    await nutzer.click(wahl)
    await nutzer.click(screen.getByRole('button', { name: /Auf die Klassentafel kopieren/ }))
    await nutzer.click(screen.getByRole('button', { name: 'Schließen' }))
    // die leere Seite wurde durch Annas Seite ersetzt
    expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeEnabled()
    const zurueck = screen.getByRole('button', { name: 'Rückgängig' })
    expect(zurueck).toBeEnabled()
    await nutzer.click(zurueck)
    expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeEnabled()
    await nutzer.click(screen.getByRole('button', { name: 'Wiederholen' }))
    expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeEnabled()
    // Strg + Z geht auch
    await nutzer.keyboard('{Control>}z{/Control}')
    expect(screen.getByRole('button', { name: 'Seite leeren' })).toBeDisabled()
  }, 20000)
})
