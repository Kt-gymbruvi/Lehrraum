// Etappe C: Tafeln auf allen Geräten – verschlüsselt, neuerer Stand gilt, Dateien einzeln.
// Der Server ist nachgebaut (Tabellen und Speicherbereich im Speicher) – es wird nie mit dem echten Server gesprochen.
// „Gerät wechseln“ heißt: leerer Gerätespeicher, gleicher Server.
import { render, screen } from '@testing-library/react'
import { Blob as NodeBlob } from 'node:buffer'
import { IDBFactory } from 'fake-indexeddb'
import { neueSeite, neuesTafelbild, TAFEL_VERSION, type Bild, type Strich, type Tafelbild } from '../kern/modell.ts'
import { b64 } from '../kern/tresor.ts'
import { entsperre, tafelSchluessel } from '../speicher/abgleich.ts'
import { ladeTafel, schliesseFuerTests, speichereTafel } from '../speicher/datenbank.ts'
import { ladeDatei, speichereDatei } from '../speicher/dateien.ts'
import { gleicheTafelAb, raeumeServerAuf, type Ergebnis } from '../speicher/tafelabgleich.ts'
import Tafel from '../tafel/Tafel.tsx'

type Zeile = { rev: number; salt?: string; iv: string; daten: string }
const server = vi.hoisted(() => ({
  tresore: new Map<string, Zeile>(),
  tafeln: new Map<string, Zeile>(),
  dateien: new Map<string, { daten: Blob; erstellt: string }>(),
}))
vi.mock('../speicher/server.ts', async (original) => {
  const echt = await original<typeof import('../speicher/server.ts')>()
  const speichere = (karte: Map<string, Zeile>, name: string, rev: number, zeile: Omit<Zeile, 'rev'>) => {
    const jetzt = karte.get(name)?.rev ?? 0
    if (jetzt !== rev) throw new echt.TresorKonflikt()
    karte.set(name, { rev: jetzt + 1, ...zeile })
    return jetzt + 1
  }
  return {
    ...echt,
    serverVorhanden: () => true,
    istAngemeldet: async () => true,
    sitzungGespeichert: () => true,
    beiAnmeldung: () => () => undefined,
    ladeTresor: async (art: string) => server.tresore.get(art) ?? null,
    speichereTresor: async (art: string, rev: number, salt: string, iv: string, daten: string) => speichere(server.tresore, art, rev, { salt, iv, daten }),
    ladeTafelRev: async (t: string) => server.tafeln.get(t)?.rev ?? 0,
    ladeTafelZeile: async (t: string) => server.tafeln.get(t) ?? null,
    ladeAlleTafelZeilen: async () => [...server.tafeln].map(([tafel, z]) => ({ tafel, ...z })),
    speichereTafelZeile: async (t: string, rev: number, iv: string, daten: string) => speichere(server.tafeln, t, rev, { iv, daten }),
    loescheTafelZeile: async (t: string) => void server.tafeln.delete(t),
    ladeDateiHoch: async (name: string, daten: Blob) => {
      if (!server.dateien.has(name)) server.dateien.set(name, { daten, erstellt: new Date().toISOString() })
    },
    holeDatei: async (name: string) => server.dateien.get(name)?.daten ?? null,
    listeDateien: async () => [...server.dateien].map(([name, d]) => ({ name, groesse: d.daten.size, erstellt: d.erstellt })),
    loescheDateien: async (namen: string[]) => namen.forEach((n) => server.dateien.delete(n)),
  }
})

const PW = 'geheim-123'
const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[10, 10, 0.5], [200, 10, 0.5]] })
const mit = (t: Tafelbild, ids: string[], am: string): Tafelbild => ({ ...t, seiten: [neueSeite(ids.map(strich))], geaendertAm: am })
const ids = (t: { seiten: Tafelbild['seiten'] }) => t.seiten.map((s) => s.elemente.map((e) => e.id))

async function geraetWechseln() {
  await schliesseFuerTests()
  globalThis.indexedDB = new IDBFactory()
  expect(await entsperre(PW)).toBeNull()
}
/** Übernimmt einen neuen Stand so, wie es die Tafel tut */
async function uebernimm(erg: Ergebnis, t: Tafelbild): Promise<Tafelbild> {
  if (erg.art !== 'neu') throw new Error('kein neuer Stand: ' + erg.art)
  const neu = { ...t, ...erg.inhalt }
  await speichereTafel(neu)
  await erg.bestaetige()
  return neu
}

// Blobs aus jsdom übersteht der nachgebaute Gerätespeicher nicht (anders als im Browser) – hier die von Node
const JsdomBlob = globalThis.Blob
beforeAll(() => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob
})
afterAll(() => {
  globalThis.Blob = JsdomBlob
})

beforeEach(async () => {
  server.tresore.clear()
  server.tafeln.clear()
  server.dateien.clear()
  expect(await entsperre(PW, { neu: true })).toBeNull()
})

describe('Tafel-Schlüssel', () => {
  it('liegt im Klassen-Tresor und ist auf jedem Gerät derselbe', async () => {
    const t = mit(neuesTafelbild('7b'), ['a'], '2026-11-14T10:00:00Z')
    await speichereTafel(t)
    expect(await gleicheTafelAb('k-aaaa1111', t)).toEqual({ art: 'gleich' })
    await geraetWechseln()
    expect(tafelSchluessel()).not.toBeNull()
    const leer = neuesTafelbild('7b')
    const erg = await gleicheTafelAb('k-aaaa1111', leer)
    expect(erg).toMatchObject({ art: 'neu', meldung: 'Tafel von einem anderen Gerät geladen' })
    expect(ids((erg as unknown as { inhalt: Tafelbild }).inhalt)).toEqual([['a']])
  }, 30_000)
})

describe('Tafel abgleichen', () => {
  it('lädt nur verschlüsselt hoch und lädt nichts doppelt', async () => {
    const t = mit(neuesTafelbild('Biologie 7b'), ['geheimer-strich'], '2026-11-14T10:00:00Z')
    expect(await gleicheTafelAb('frei', t)).toEqual({ art: 'gleich' })
    const z = server.tafeln.get('frei')!
    expect(z.rev).toBe(1)
    expect(atob(z.daten)).not.toMatch(/Biologie|geheimer/)
    // Ansicht, gezeigte Seite und Fenster sind keine Änderung
    expect(await gleicheTafelAb('frei', { ...t, kamera: { x: 5, y: 5, zoom: 2 }, seiteNr: 0, fenster: [{ id: 'u', art: 'uhr', x: 1, y: 1, eingeklappt: false }] })).toEqual({ art: 'gleich' })
    expect(server.tafeln.get('frei')!.rev).toBe(1)
  }, 30_000)

  it('übernimmt Änderungen eines anderen Geräts; bei Änderungen auf beiden gilt die zuletzt geänderte', async () => {
    const a1 = mit(neuesTafelbild(), ['a'], '2026-11-14T10:00:00Z')
    await gleicheTafelAb('frei', a1)
    await geraetWechseln()
    let b = await uebernimm(await gleicheTafelAb('frei', neuesTafelbild()), neuesTafelbild())
    // Gerät B ändert, Gerät A (unverändert seit dem Abgleich) bekommt den neuen Stand
    b = mit(b, ['a', 'b'], '2026-11-14T11:00:00Z')
    expect(await gleicheTafelAb('frei', b)).toEqual({ art: 'gleich' })
    expect(server.tafeln.get('frei')!.rev).toBe(2)
    // Beide ändern: B später → B gilt
    const b2 = mit(b, ['a', 'b', 'b2'], '2026-11-14T12:30:00Z')
    expect(await gleicheTafelAb('frei', b2)).toEqual({ art: 'gleich' })
    const b3 = mit(b2, ['x'], '2026-11-14T12:00:00Z') // „ältere“ Änderung hier
    const erg = await gleicheTafelAb('frei', b3)
    expect(erg).toEqual({ art: 'gleich' }) // Server unverändert seit eigenem Hochladen → einfach hochladen
    // Jetzt echter Konflikt: auf dem Server ein neuerer Stand von „Gerät A“
    const stand = server.tafeln.get('frei')!
    const fremd = mit(neuesTafelbild(), ['von-a'], '2026-11-14T13:00:00Z')
    await speichereTafel(fremd) // nur, um mit demselben Schlüssel zu verpacken: wie Gerät A
    await gleicheTafelAb('k-hilfe000', fremd)
    server.tafeln.set('frei', { ...server.tafeln.get('k-hilfe000')!, rev: stand.rev + 1 })
    const hier = mit(b3, ['hier'], '2026-11-14T12:45:00Z')
    const neu = await gleicheTafelAb('frei', hier)
    expect(neu).toMatchObject({ art: 'neu', meldung: 'Auf einem anderen Gerät geändert – neuer Stand geladen' })
    expect(ids((neu as unknown as { inhalt: Tafelbild }).inhalt)).toEqual([['von-a']])
  }, 30_000)

  it('zwei schon vorhandene Tafeln derselben Klasse: die neuere gilt, die ältere hängt beschriftet hinten an', async () => {
    await gleicheTafelAb('k-bbbb2222', mit(neuesTafelbild('7b'), ['alt'], '2026-11-01T10:00:00Z'))
    await geraetWechseln()
    const hier = mit(neuesTafelbild('7b'), ['neu'], '2026-11-10T10:00:00Z')
    await speichereTafel(hier)
    const erg = await gleicheTafelAb('k-bbbb2222', hier)
    expect(erg).toMatchObject({ art: 'neu', meldung: 'Tafeln zusammengelegt – die ältere steht auf den letzten Seiten' })
    const zusammen = (erg as unknown as { inhalt: Tafelbild }).inhalt
    expect(zusammen.seiten).toHaveLength(2)
    expect(zusammen.seiten[0].elemente.map((e) => e.id)).toEqual(['neu'])
    const beschriftung = zusammen.seiten[1].elemente.find((e) => e.art === 'text')
    expect(beschriftung).toMatchObject({ text: expect.stringMatching(/^Ältere Tafel von 7b \(anderes Gerät, /) })
    expect(server.tafeln.get('k-bbbb2222')!.rev).toBe(1) // erst hochladen, wenn die Tafel es zeigt
    await uebernimm(erg, hier)
    expect(server.tafeln.get('k-bbbb2222')!.rev).toBe(2)
    expect(await gleicheTafelAb('k-bbbb2222', (await ladeTafel(hier.id))!)).toEqual({ art: 'gleich' })
  }, 30_000)

  it('eine Tafel aus einer neueren Fassung wird nicht überschrieben', async () => {
    const t = mit(neuesTafelbild(), ['a'], '2026-11-14T10:00:00Z')
    await gleicheTafelAb('frei', t)
    const key = await tafelSchluessel()!
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const roh = new TextEncoder().encode(JSON.stringify({ schema: 'lehrraum/tafel', version: TAFEL_VERSION + 1, inhalt: { titel: 'x', format: 'unendlich', seiten: [], geaendertAm: '2027-01-01T00:00:00Z' } }))
    server.tafeln.set('frei', { rev: 5, iv: b64(iv), daten: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, roh)) })
    expect(await gleicheTafelAb('frei', mit(t, ['b'], '2026-11-14T11:00:00Z'))).toMatchObject({ art: 'fehler', meldung: expect.stringMatching(/neueren Fassung/) })
    expect(server.tafeln.get('frei')!.rev).toBe(5)
  }, 30_000)
})

describe('Bilder und PDF-Seiten', () => {
  it('gehen einmal verschlüsselt hoch und kommen auf dem anderen Gerät beim Zeichnen', async () => {
    const id = await speichereDatei(new Blob(['BILD-INHALT'], { type: 'image/png' }))
    const bild: Bild = { art: 'bild', id: 'bild1', x: 0, y: 0, b: 100, h: 50, dateiId: id }
    const t = { ...neuesTafelbild(), seiten: [neueSeite([bild])], geaendertAm: '2026-11-14T10:00:00Z' }
    await gleicheTafelAb('frei', t)
    expect(server.dateien.size).toBe(1)
    expect(await server.dateien.get(id)!.daten.text()).not.toContain('BILD-INHALT')
    await gleicheTafelAb('frei', { ...t, titel: 'anders' })
    expect(server.dateien.size).toBe(1) // nicht noch einmal
    await geraetWechseln()
    const geholt = await ladeDatei(id)
    expect(geholt?.type).toBe('image/png')
    expect(await geholt?.text()).toBe('BILD-INHALT')
  }, 30_000)

  it('räumt auf dem Server nur ungebrauchte, ältere Dateien weg', async () => {
    const id = await speichereDatei(new Blob(['x'], { type: 'image/png' }))
    const t = { ...neuesTafelbild(), seiten: [neueSeite([{ art: 'bild', id: 'b', x: 0, y: 0, b: 1, h: 1, dateiId: id } as Bild])], geaendertAm: '2026-11-14T10:00:00Z' }
    await gleicheTafelAb('frei', t)
    server.dateien.set('alt00000', { daten: new Blob(['y']), erstellt: '2026-11-01T00:00:00Z' })
    server.dateien.set('frisch00', { daten: new Blob(['z']), erstellt: new Date().toISOString() })
    expect(await raeumeServerAuf()).toBe(1)
    expect([...server.dateien.keys()].sort()).toEqual([id, 'frisch00'].sort())
    expect(await raeumeServerAuf()).toBe(0) // höchstens einmal am Tag
  }, 30_000)
})

describe('Tafel zeigt den Abgleich', () => {
  beforeAll(() => {
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true })
    HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
    globalThis.Path2D = class {} as unknown as typeof Path2D
  })

  it('„Gespeichert · auf allen Geräten“ und der Stand vom anderen Gerät', async () => {
    await gleicheTafelAb('frei', mit(neuesTafelbild(), ['von-anderem-geraet'], '2026-11-14T10:00:00Z'))
    await geraetWechseln()
    render(<Tafel />)
    expect(await screen.findByText('Tafel von einem anderen Gerät geladen', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(await screen.findByText('Gespeichert · auf allen Geräten', {}, { timeout: 15_000 })).toBeInTheDocument()
  }, 30_000)
})
