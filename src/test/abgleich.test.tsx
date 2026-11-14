// Etappe 3: Namen in Klassen, Klassen aus dem Notenbuch, verschlüsselter Abgleich zwischen Geräten.
// Der Server ist nachgebaut (Tresore im Speicher) – es wird nie mit dem echten Server gesprochen.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.tsx'
import {
  fuehreZusammen,
  gleicheMitNotenbuchAb,
  kennungAusNotenbuch,
  klassenTresor,
  namenAlsText,
  namenAusText,
  neueKlasse,
  pruefeKlasse,
  pruefeNamensliste,
  type Klasse,
  type NotenbuchKlasse,
} from '../kern/klassen.ts'
import { entschluessele, leiteSchluesselAb, neuesSalz, verschluessele } from '../kern/tresor.ts'
import { abgleichInfo, entsperre, gleicheAb, merkeGeloescht, vergissSchluessel } from '../speicher/abgleich.ts'
import { ladeBund, schluesselAus } from '../speicher/schluesselbund.ts'
import { ladeKlassen, loescheKlasse, speichereKlasse } from '../speicher/datenbank.ts'

// ---------- nachgebauter Server ----------
type Zeile = { rev: number; salt: string; iv: string; daten: string }
const server = vi.hoisted(() => ({ angemeldet: true, sitzung: true, tresore: new Map<string, Zeile>(), aufrufe: 0 }))
vi.mock('../speicher/server.ts', async (original) => {
  const echt = await original<typeof import('../speicher/server.ts')>()
  return {
    ...echt,
    serverVorhanden: () => true,
    istAngemeldet: async () => server.angemeldet,
    sitzungGespeichert: () => server.sitzung,
    beiAnmeldung: () => () => undefined,
    ladeTresor: async (art: string) => server.tresore.get(art) ?? null,
    speichereTresor: async (art: string, rev: number, salt: string, iv: string, daten: string) => {
      server.aufrufe++
      const jetzt = server.tresore.get(art)?.rev ?? 0
      if (jetzt !== rev) throw new echt.TresorKonflikt()
      server.tresore.set(art, { rev: jetzt + 1, salt, iv, daten })
      return jetzt + 1
    },
  }
})

const PW = 'geheim-123'
const WENIGE = 1000 // weniger Runden, damit die Tests schnell bleiben – das Format ist dasselbe

/** Legt die Namensliste so ab, wie das Notenbuch es tut */
async function notenbuchSchreibt(klassen: unknown[], pw = PW) {
  const salt = server.tresore.get('namen')?.salt ?? neuesSalz()
  const key = await leiteSchluesselAb(pw, salt)
  const box = await verschluessele(key, { schema: 'notenbuch/namen', version: 1, klassen })
  const rev = (server.tresore.get('namen')?.rev ?? 0) + 1
  server.tresore.set('namen', { rev, salt, iv: box.iv, daten: box.daten })
}
const nb = (id: string, name: string, schueler: [string, string, string][] = [], archiviert = false) => ({
  id,
  name,
  fach: 'Biologie',
  stufe: 'Sek I',
  schuljahr: '2026/27',
  halbjahr: null,
  archiviert,
  schueler: schueler.map(([sid, vorname, nachname]) => ({ id: sid, vorname, nachname })),
})

beforeEach(() => {
  server.angemeldet = true
  server.sitzung = true
  server.tresore.clear()
  server.aufrufe = 0
})

describe('Namen – Logik', () => {
  it('liest eingefügte Namenslisten in allen üblichen Schreibweisen', () => {
    const l = namenAusText('Muster, Anna\n2. Ben Beispiel\nMaria Luisa\tSchmidt\n\n  Lea  \nMeier; Tom')
    expect(l.map((s) => [s.vorname, s.nachname])).toEqual([
      ['Anna', 'Muster'],
      ['Ben', 'Beispiel'],
      ['Schmidt', 'Maria Luisa'], // Tabulator wie Komma: erst Nachname, dann Vorname
      ['Lea', ''],
      ['Tom', 'Meier'],
    ])
    expect(new Set(l.map((s) => s.id)).size).toBe(5)
  })

  it('behält die Kennung, wenn der Name gleich bleibt, und schreibt „Nachname, Vorname“', () => {
    const alt = namenAusText('Muster, Anna\nBeispiel, Ben')
    const neu = namenAusText('Ben Beispiel\nCarla Neu', alt)
    expect(neu[0].id).toBe(alt[1].id)
    expect(neu[1].id).not.toBe(alt[0].id)
    expect(namenAlsText(alt)).toBe('Beispiel, Ben\nMuster, Anna')
  })

  it('übernimmt Klassen der Version 2 ohne Namen und prüft Namen in Version 3', () => {
    const k = neueKlasse({ bezeichnung: '7b', fach: '', jahrgang: '' })
    expect(pruefeKlasse({ ...k, version: 2, schueler: undefined })?.schueler).toEqual([])
    const v3 = pruefeKlasse({ ...k, schueler: [{ id: 'abcd1', vorname: 'Anna', nachname: 'Muster' }, { id: 'x', vorname: 'Kurz' }, { id: 'abcd2', vorname: '', nachname: '' }], herkunft: { notenbuch: 'nb12345' } })
    expect(v3?.schueler).toEqual([{ id: 'abcd1', vorname: 'Anna', nachname: 'Muster' }])
    expect(v3?.herkunft).toEqual({ notenbuch: 'nb12345' })
  })

  it('prüft die Namensliste des Notenbuchs – und übernimmt nichts außer Namen', () => {
    expect(pruefeNamensliste({ schema: 'anders', version: 1, klassen: [] })).toBeNull()
    const l = pruefeNamensliste({ schema: 'notenbuch/namen', version: 1, klassen: [{ ...nb('abc123', '7b', [['s1abc', 'Anna', 'Muster']]), noten: [1, 2] }] })
    expect(l).toEqual([{ id: 'abc123', name: '7b', fach: 'Biologie', archiviert: false, schueler: [{ id: 's1abc', vorname: 'Anna', nachname: 'Muster' }] }])
  })
})

describe('Klassen aus dem Notenbuch – Logik', () => {
  const liste = (...k: ReturnType<typeof nb>[]) => pruefeNamensliste({ schema: 'notenbuch/namen', version: 1, klassen: k }) as NotenbuchKlasse[]

  it('legt jede Lerngruppe als Klasse an – auf allen Geräten mit derselben Kennung', () => {
    const neu = gleicheMitNotenbuchAb([], liste(nb('abc123', '7b Bio', [['s1abc', 'Anna', 'Muster']]), nb('alt999', '5a', [], true)))
    expect(neu).toHaveLength(1) // archivierte Lerngruppen werden nicht neu angelegt
    expect(neu[0]).toMatchObject({ id: kennungAusNotenbuch('abc123'), bezeichnung: '7b Bio', jahrgang: '7', herkunft: { notenbuch: 'abc123' } })
    expect(neu[0].schueler).toHaveLength(1)
    expect(pruefeKlasse(neu[0])).not.toBeNull()
  })

  it('übernimmt Änderungen, behält Tafel und Vorlage und archiviert im Notenbuch Gelöschtes', () => {
    const [k] = gleicheMitNotenbuchAb([], liste(nb('abc123', '7b')))
    const lokal: Klasse = { ...k, tafelId: 'aaaa1111', vorlage: { format: 'a4-quer' } }
    expect(gleicheMitNotenbuchAb([lokal], liste(nb('abc123', '7b')))).toEqual([]) // nichts geändert
    const [geaendert] = gleicheMitNotenbuchAb([lokal], liste(nb('abc123', '7c', [['s1abc', 'Anna', 'Muster']])))
    expect(geaendert).toMatchObject({ bezeichnung: '7c', tafelId: 'aaaa1111', vorlage: { format: 'a4-quer' } })
    expect(geaendert.schueler).toHaveLength(1)
    const [weg] = gleicheMitNotenbuchAb([lokal], liste())
    expect(weg).toMatchObject({ id: k.id, archiviert: true, tafelId: 'aaaa1111' })
  })

  it('legt hier gelöschte Klassen nicht wieder an', () => {
    expect(gleicheMitNotenbuchAb([], liste(nb('abc123', '7b')), new Set([kennungAusNotenbuch('abc123')]))).toEqual([])
  })
})

describe('Zusammenführen zwischen Geräten – Logik', () => {
  const k = (b: string, am: string, mehr: Partial<Klasse> = {}): Klasse => ({ ...neueKlasse({ bezeichnung: b, fach: '', jahrgang: '' }), geaendertAm: am, ...mehr })

  it('neuere Fassung gewinnt, die Tafel bleibt beim Gerät, Löschungen gelten', () => {
    const a = k('7b', '2026-11-01T10:00:00Z', { tafelId: 'aaaa1111' })
    const b = k('8c', '2026-11-01T10:00:00Z')
    const vonServer = { ...a, bezeichnung: '7b neu', geaendertAm: '2026-11-02T10:00:00Z', tafelId: null }
    const fremd = k('9d', '2026-11-01T10:00:00Z')
    const r = fuehreZusammen([a, b], [], { ...klassenTresor([vonServer, fremd], [{ id: b.id, am: '2026-11-03T00:00:00Z' }]) })
    expect(r.speichern.map((x) => [x.bezeichnung, x.tafelId]).sort()).toEqual([
      ['7b neu', 'aaaa1111'],
      ['9d', null],
    ])
    expect(r.loeschen.map((x) => x.id)).toEqual([b.id])
    expect(r.tresor.klassen.map((x) => x.bezeichnung).sort()).toEqual(['7b neu', '9d'])
    expect(r.tresor.klassen.every((x) => x.tafelId === null)).toBe(true) // Tafeln gehen nie auf den Server
  })

  it('eine nach dem Löschen geänderte Klasse bleibt', () => {
    const a = k('7b', '2026-11-05T10:00:00Z')
    const r = fuehreZusammen([a], [{ id: a.id, am: '2026-11-04T00:00:00Z' }], null)
    expect(r.loeschen).toEqual([])
    expect(r.tresor.klassen).toHaveLength(1)
  })

  it('Namen von Notenbuch-Klassen stehen nicht im Klassen-Tresor', () => {
    const a = k('7b', '2026-11-01T10:00:00Z', { herkunft: { notenbuch: 'abc123' }, schueler: [{ id: 's1abc', vorname: 'Anna', nachname: 'Muster' }] })
    expect(klassenTresor([a], []).klassen[0].schueler).toEqual([])
  })
})

describe('Verschlüsselung', () => {
  it('ist mit dem Notenbuch-Format kompatibel und erkennt ein falsches Passwort', async () => {
    const salt = neuesSalz()
    const key = await leiteSchluesselAb(PW, salt, WENIGE)
    const box = await verschluessele(key, { hallo: 'Welt' })
    expect(await entschluessele(await leiteSchluesselAb(PW, salt, WENIGE), box)).toEqual({ hallo: 'Welt' })
    await expect(entschluessele(await leiteSchluesselAb('falsch', salt, WENIGE), box)).rejects.toThrow()
    expect(atob(box.daten)).not.toContain('Welt')
  })
})

describe('Abgleich mit nachgebautem Server', () => {
  it('ohne Anmeldung bleibt alles auf dem Gerät', async () => {
    server.angemeldet = false
    await gleicheAb()
    expect(abgleichInfo().stand).toBe('abgemeldet')
    expect(server.tresore.size).toBe(0)
  })

  it('entsperrt mit dem Notenbuch-Passwort, übernimmt Lerngruppen und lädt die Klassen verschlüsselt hoch', async () => {
    await notenbuchSchreibt([nb('abc123', '7b', [['s1abc', 'Anna', 'Muster']])])
    await speichereKlasse(neueKlasse({ bezeichnung: 'AG', fach: 'Sport', jahrgang: '' }))
    await gleicheAb()
    expect(abgleichInfo().stand).toBe('gesperrt')
    expect(await entsperre('falsch')).toBe('Das Passwort passt nicht zum Notenbuch.')
    expect(await entsperre(PW)).toBeNull()
    expect(abgleichInfo()).toMatchObject({ stand: 'bereit', notenbuch: true })
    const klassen = await ladeKlassen()
    expect(klassen.map((k) => k.bezeichnung).sort()).toEqual(['7b', 'AG'])
    expect(klassen.find((k) => k.herkunft)?.schueler[0].vorname).toBe('Anna')
    const zeile = server.tresore.get('klassen')!
    // Klartext darf nicht vorkommen – geprüft an den entschlüsselten Bytes, nicht am Base64 (dort kann „AG“ zufällig stehen)
    expect(atob(zeile.daten)).not.toMatch(/Sport|Anna|Muster/)
    expect(zeile.salt).not.toBe(server.tresore.get('namen')!.salt) // eigener Schlüssel
  }, 20_000)

  it('zweites Gerät bekommt die Klassen, Löschungen kommen an, nichts wird doppelt hochgeladen', async () => {
    // Gerät 1 – noch kein Notenbuch: Das Passwort wird hier festgelegt
    await speichereKlasse(neueKlasse({ bezeichnung: '9a', fach: 'Biologie', jahrgang: '9' }))
    expect(await entsperre(PW)).toBe('neu')
    expect(await entsperre('kurz', { neu: true })).toBe('Mindestens 8 Zeichen.')
    expect(await entsperre(PW, { neu: true })).toBeNull()
    const hochgeladen = server.aufrufe
    await gleicheAb()
    expect(server.aufrufe).toBe(hochgeladen) // unverändert: kein neues Speichern
    // Gerät 2 (leerer Speicher, gleicher Server)
    for (const k of await ladeKlassen()) await loescheKlasse(k)
    const { IDBFactory } = await import('fake-indexeddb')
    const { schliesseFuerTests } = await import('../speicher/datenbank.ts')
    await schliesseFuerTests()
    globalThis.indexedDB = new IDBFactory()
    expect(await entsperre(PW)).toBeNull()
    const [k] = await ladeKlassen()
    expect(k.bezeichnung).toBe('9a')
    // Gerät 2 löscht – der Tresor merkt es sich
    await merkeGeloescht(k.id)
    await loescheKlasse(k)
    await gleicheAb()
    expect(await ladeKlassen()).toEqual([])
    expect(abgleichInfo().stand).toBe('bereit')
  }, 30_000)

  it('ein im Notenbuch geändertes Passwort fragt neu – danach wird neu verschlüsselt', async () => {
    await notenbuchSchreibt([nb('abc123', '7b')])
    expect(await entsperre(PW)).toBeNull()
    await notenbuchSchreibt([nb('abc123', '7b')], 'neues-pw')
    const altesSalz = server.tresore.get('klassen')!.salt
    await gleicheAb()
    expect(abgleichInfo().stand).toBe('gesperrt')
    expect(await ladeBund()).toBeNull() // veralteter Schlüsselbund ist weg – auch das Notenbuch fragt neu
    expect(await entsperre(PW)).toBe('Das Passwort passt nicht zum Notenbuch.')
    expect(await entsperre('neues-pw')).toBeNull()
    expect(abgleichInfo().stand).toBe('bereit')
    expect(await ladeKlassen()).toHaveLength(1)
    expect(server.tresore.get('klassen')!.salt).not.toBe(altesSalz) // mit dem neuen Passwort neu verschlüsselt
  }, 30_000)
})

describe('Seite „Meine Klassen“ mit Namen', () => {
  it('zeigt Klassen aus dem Notenbuch mit ihren Namen – bearbeitbar ist nur, was zu Lehrraum gehört', async () => {
    await notenbuchSchreibt([nb('abc123', '7b', [['s1abc', 'Anna', 'Muster'], ['s2abc', 'Ben', 'Beispiel']])])
    expect(await entsperre(PW)).toBeNull()
    const nutzer = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/klassen']}>
        <App />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: '7b' })
    expect(screen.getByText('aus dem Notenbuch')).toBeInTheDocument()
    expect(screen.getByText('2 Namen')).toBeInTheDocument()
    const aktionen = within(screen.getByRole('group', { name: /^Aktionen für 7b/ }))
    expect(aktionen.queryByRole('button', { name: 'Namen' })).not.toBeInTheDocument()
    expect(aktionen.queryByRole('button', { name: 'Archivieren' })).not.toBeInTheDocument()
    expect(aktionen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument()
    await nutzer.click(aktionen.getByRole('button', { name: 'Bearbeiten' }))
    expect(screen.getByLabelText('Bezeichnung')).toHaveAttribute('readonly')
    expect(await screen.findByText(/Klassen synchronisiert/)).toBeInTheDocument()
  }, 20_000)

  it('trägt Namen einer eigenen Klasse ein', async () => {
    server.angemeldet = false
    await speichereKlasse(neueKlasse({ bezeichnung: 'AG', fach: 'Sport', jahrgang: '' }))
    const nutzer = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/klassen']}>
        <App />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: 'AG' })
    expect(screen.getByText('Noch keine Namen')).toBeInTheDocument()
    expect(screen.getByText('Nur auf diesem Gerät')).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Namen' }))
    await nutzer.type(screen.getByLabelText(/Namen, eine Person je Zeile/), 'Muster, Anna{Enter}Ben Beispiel')
    expect(screen.getByText(/2 Namen erkannt/)).toBeInTheDocument()
    await nutzer.click(screen.getByRole('button', { name: 'Namen speichern' }))
    expect(await screen.findByText('2 Namen')).toBeInTheDocument()
    await waitFor(async () => expect((await ladeKlassen())[0].schueler.map((s) => s.vorname)).toEqual(['Anna', 'Ben']))
  })
})

describe('Schlüsselbund – ein Passwort für Tafel, Notenbuch und Startseite', () => {
  it('legt nur einen nicht auslesbaren Grundschlüssel ab – daraus ergeben sich dieselben Schlüssel wie aus dem Passwort', async () => {
    await notenbuchSchreibt([nb('abc123', '7b')])
    expect(await entsperre(PW)).toBeNull()
    const bund = await ladeBund()
    expect(bund?.basis.extractable).toBe(false)
    expect(bund?.basis.algorithm.name).toBe('PBKDF2')
    expect(JSON.stringify(bund)).not.toContain(PW)
    // So öffnet das Notenbuch seine Namensliste mit dem Bund – ohne Passwort
    const zeile = server.tresore.get('namen')!
    const inhalt = await entschluessele(await schluesselAus(bund!, zeile.salt), zeile)
    expect(inhalt).toMatchObject({ schema: 'notenbuch/namen' })
  }, 20_000)

  it('prüft das Passwort am Notenbuch, wenn es weder Namensliste noch Klassen gibt', async () => {
    const salt = neuesSalz()
    const box = await verschluessele(await leiteSchluesselAb(PW, salt), { v: 1, classes: [] })
    server.tresore.set('notenbuch', { rev: 1, salt, ...box })
    expect(await entsperre('falsch')).toBe('Das Passwort passt nicht zum Notenbuch.')
    expect(await ladeBund()).toBeNull()
    expect(await entsperre(PW)).toBeNull()
    expect(await ladeBund()).not.toBeNull()
  }, 20_000)

  it('Abmelden (auch in einer anderen Anwendung) und „Auf diesem Gerät sperren“ löschen den Bund', async () => {
    await notenbuchSchreibt([nb('abc123', '7b')])
    expect(await entsperre(PW)).toBeNull()
    // ohne Netz nicht erneuerbar, aber noch angemeldet: Bund bleibt
    server.angemeldet = false
    await gleicheAb()
    expect(await ladeBund()).not.toBeNull()
    // wirklich abgemeldet: Bund weg
    server.sitzung = false
    await gleicheAb()
    expect(abgleichInfo().stand).toBe('abgemeldet')
    expect(await ladeBund()).toBeNull()
    // wieder angemeldet: einmal Passwort, dann sperren
    server.angemeldet = server.sitzung = true
    expect(await entsperre(PW)).toBeNull()
    await vergissSchluessel()
    expect(await ladeBund()).toBeNull()
    expect(abgleichInfo().stand).toBe('gesperrt')
  }, 20_000)

  it('Seite „Meine Klassen“: ohne Notenbuch wird das Passwort festgelegt (zweimal eingegeben)', async () => {
    const nutzer = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/klassen']}>
        <App />
      </MemoryRouter>,
    )
    await nutzer.type(await screen.findByLabelText('Passwort des Notenbuchs'), PW)
    await nutzer.click(screen.getByRole('button', { name: 'Entsperren' }))
    expect(await screen.findByRole('heading', { name: 'Passwort festlegen' })).toBeInTheDocument()
    await nutzer.type(screen.getByLabelText('Passwort wiederholen'), 'anders-123')
    await nutzer.click(screen.getByRole('button', { name: 'Passwort festlegen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('stimmen nicht überein')
    await nutzer.clear(screen.getByLabelText('Passwort wiederholen'))
    await nutzer.type(screen.getByLabelText('Passwort wiederholen'), PW)
    await nutzer.click(screen.getByRole('button', { name: 'Passwort festlegen' }))
    expect(await screen.findByText(/Klassen synchronisiert/, {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(await ladeBund()).not.toBeNull()
  }, 30_000)
})
