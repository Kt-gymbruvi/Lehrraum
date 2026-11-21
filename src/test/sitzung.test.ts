import { describe, expect, it } from 'vitest'
import { MAX_GAESTE, neuePlaetze, oeffneBild, platzZeilen, pruefeAbgabeSeite, verschluesseleBild } from '../kern/sitzung.ts'
import { neueSeite, type Element, type Strich } from '../kern/modell.ts'
import {
  AUFBEWAHRUNG_STUNDEN, MAX_DAUER, beendet, geheimnisHash, istNeuerStand, istOffen, liesMitmachen, loeschzeit, mitmachenAdresse,
  neueSitzungsdaten, neuerSitzungsCode, neuerSitzungsSchluessel, neuesPlatzGeheimnis, oeffneAbgabe, oeffneSitzung, platzName,
  pruefeSchuelerSeite, restSekunden, seitenFuerKlassentafel, sitzungsSchluessel, verlaengert, verschluesseleAbgabe,
  verschluesseleSitzung, zeitraum,
} from '../kern/sitzung.ts'

const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, 0, 0.5], [50, 10, 0.5]] })
const schueler = [
  { id: 'bea1', vorname: 'Bea', nachname: 'Zander' },
  { id: 'ant1', vorname: 'Anton', nachname: 'Adler' },
]

describe('Zeit', () => {
  const jetzt = new Date('2026-11-20T08:00:00.000Z')

  it('ist für die gewählte Dauer offen und danach geschlossen', () => {
    const z = zeitraum(jetzt, 20)
    expect(istOffen(z, jetzt)).toBe(true)
    expect(istOffen(z, new Date('2026-11-20T08:19:59Z'))).toBe(true)
    expect(istOffen(z, new Date('2026-11-20T08:20:00Z'))).toBe(false)
    expect(restSekunden(z, new Date('2026-11-20T08:19:00Z'))).toBe(60)
    expect(restSekunden(z, new Date('2026-11-20T09:00:00Z'))).toBe(0)
  })

  it('begrenzt die Dauer', () => {
    expect(restSekunden(zeitraum(jetzt, 100000), jetzt)).toBe(MAX_DAUER * 60)
    expect(restSekunden(zeitraum(jetzt, -5), jetzt)).toBe(60)
    expect(restSekunden(zeitraum(jetzt, NaN), jetzt)).toBe(600)
  })

  it('verlängert vom Ende aus, aber höchstens bis MAX_DAUER ab jetzt', () => {
    const z = zeitraum(jetzt, 20)
    expect(restSekunden(verlaengert(z, 10, jetzt), jetzt)).toBe(30 * 60)
    expect(restSekunden(verlaengert(z, 10000, jetzt), jetzt)).toBe(MAX_DAUER * 60)
    // abgelaufen: Verlängerung zählt ab jetzt
    const spaeter = new Date('2026-11-20T10:00:00Z')
    expect(restSekunden(verlaengert(z, 10, spaeter), spaeter)).toBe(600)
  })

  it('beendet sofort; Ungültiges gilt als geschlossen', () => {
    const z = beendet(zeitraum(jetzt, 20), new Date('2026-11-20T08:05:00Z'))
    expect(istOffen(z, new Date('2026-11-20T08:05:01Z'))).toBe(false)
    expect(istOffen({ beginn: 'kaputt', ende: 'kaputt' }, jetzt)).toBe(false)
    const abgelaufen = zeitraum(jetzt, 10)
    expect(beendet(abgelaufen, new Date('2026-11-20T12:00:00Z'))).toEqual(abgelaufen)
  })

  it('löscht 48 Stunden nach dem Ende', () => {
    const z = zeitraum(jetzt, 20)
    expect(AUFBEWAHRUNG_STUNDEN).toBe(48)
    expect(new Date(loeschzeit(z.ende)).getTime() - new Date(z.ende).getTime()).toBe(48 * 3_600_000)
  })
})

describe('Kennungen und Adresse', () => {
  it('erzeugt zufällige Codes und Schlüssel in fester Form', () => {
    const codes = new Set(Array.from({ length: 50 }, neuerSitzungsCode))
    expect(codes.size).toBe(50)
    expect([...codes][0]).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(neuerSitzungsSchluessel()).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('baut die Adresse mit Schlüssel hinter dem # und liest sie zurück', () => {
    const code = neuerSitzungsCode()
    const schluessel = neuerSitzungsSchluessel()
    const adresse = mitmachenAdresse('https://kt-gymbruvi.github.io/Lehrraum/#/tafel', code, schluessel)
    expect(adresse).toBe(`https://kt-gymbruvi.github.io/Lehrraum/#/mitmachen/${code}/${schluessel}`)
    expect(adresse.split('#')[0]).not.toContain(schluessel)
    expect(liesMitmachen(new URL(adresse).hash)).toEqual({ code, schluessel })
  })

  it('weist ungültige Adressen ab', () => {
    const code = neuerSitzungsCode()
    expect(liesMitmachen('#/tafel')).toBeNull()
    expect(liesMitmachen(`#/mitmachen/${code}/kurz`)).toBeNull()
    expect(liesMitmachen(`#/mitmachen/zu-kurz/${neuerSitzungsSchluessel()}`)).toBeNull()
    expect(liesMitmachen(`#/mitmachen/${code}/${neuerSitzungsSchluessel()}/mehr`)).toBeNull()
  })

  it('verweigert einen ungültigen Schlüssel', async () => {
    await expect(sitzungsSchluessel('x')).rejects.toThrow()
  })

  it('hasht das Platzgeheimnis, ohne es zu verraten', async () => {
    const g = neuesPlatzGeheimnis()
    const h = await geheimnisHash(g)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toContain(g)
    expect(await geheimnisHash(g)).toBe(h)
    expect(await geheimnisHash(neuesPlatzGeheimnis())).not.toBe(h)
  })
})

describe('Sitzungsdaten', () => {
  it('legt Plätze nach Namen sortiert mit eigenen Kennungen an', () => {
    const d = neueSitzungsdaten('10G1', schueler)
    expect(d.plaetze.map((p) => p.nachname)).toEqual(['Adler', 'Zander'])
    expect(d.plaetze.every((p) => !['ant1', 'bea1'].includes(p.platz))).toBe(true)
    expect(new Set(d.plaetze.map((p) => p.platz)).size).toBe(2)
    expect(platzName(d.plaetze[0])).toBe('Anton Adler')
  })

  it('übersteht Verschlüsseln und Öffnen, mit falschem Schlüssel nicht', async () => {
    const schluessel = await sitzungsSchluessel(neuerSitzungsSchluessel())
    const d = neueSitzungsdaten('10G1', schueler)
    const box = await verschluesseleSitzung(schluessel, d)
    expect(box.daten).not.toContain('Adler')
    expect(await oeffneSitzung(schluessel, box)).toEqual(d)
    expect(await oeffneSitzung(await sitzungsSchluessel(neuerSitzungsSchluessel()), box)).toBeNull()
  })

  it('erkennt veränderte Daten', async () => {
    const schluessel = await sitzungsSchluessel(neuerSitzungsSchluessel())
    const box = await verschluesseleSitzung(schluessel, neueSitzungsdaten('10G1', schueler))
    const kaputt = { ...box, daten: box.daten.slice(0, -4) + (box.daten.endsWith('AAAA') ? 'BBBB' : 'AAAA') }
    expect(await oeffneSitzung(schluessel, kaputt)).toBeNull()
  })

  it('nimmt eine Vorlage ohne Bilder mit', () => {
    const bild = { art: 'bild', id: 'b1', x: 0, y: 0, b: 10, h: 10, datei: '0123456789abcdef' } as unknown as Element
    const vorlage = neueSeite([strich('s1'), bild])
    const d = neueSitzungsdaten('10G1', schueler, vorlage)
    expect(d.vorlage?.elemente.map((e) => e.art)).toEqual(['strich'])
  })
})

describe('Seiten der Schüler', () => {
  it('verschlüsselt an den Platz gebunden', async () => {
    const schluessel = await sitzungsSchluessel(neuerSitzungsSchluessel())
    const seite = neueSeite([strich('s1')])
    const box = await verschluesseleAbgabe(schluessel, 'platz1', seite, 3)
    expect(box.daten).not.toContain('platz1')
    const offen = await oeffneAbgabe(schluessel, box, 'platz1')
    expect(offen?.stand).toBe(3)
    expect(offen?.seite.elemente).toHaveLength(1)
    // dieselbe Box unter einem anderen Platz = untergeschoben
    expect(await oeffneAbgabe(schluessel, box, 'platz2')).toBeNull()
    expect(await oeffneAbgabe(await sitzungsSchluessel(neuerSitzungsSchluessel()), box, 'platz1')).toBeNull()
  })

  it('wirft bei ungültiger oder zu großer Seite', async () => {
    const schluessel = await sitzungsSchluessel(neuerSitzungsSchluessel())
    await expect(verschluesseleAbgabe(schluessel, 'p', { id: 5 } as never, 1)).rejects.toThrow()
    await expect(verschluesseleAbgabe(schluessel, 'bad id', neueSeite(), 1)).rejects.toThrow()
    const viele = neueSeite(Array.from({ length: 3000 }, (_, i) => ({ ...strich(`s${i}`), punkte: Array.from({ length: 400 }, (_, k): [number, number, number] => [k * 1.234567, k * 2.345678, 0.5]) })))
    await expect(verschluesseleAbgabe(schluessel, 'p', viele, 1)).rejects.toThrow(/groß/)
  })

  it('wirft Bilder aus Schülerseiten heraus', () => {
    const bild = { art: 'bild', id: 'b1', x: 0, y: 0, b: 10, h: 10, datei: '0123456789abcdef' } as unknown as Element
    expect(pruefeSchuelerSeite(neueSeite([strich('s1'), bild]))?.elemente.map((e) => e.art)).toEqual(['strich'])
    expect(pruefeSchuelerSeite('unsinn')).toBeNull()
  })

  it('lässt nur höhere Stände gelten', () => {
    expect(istNeuerStand(1, undefined)).toBe(true)
    expect(istNeuerStand(2, 1)).toBe(true)
    expect(istNeuerStand(1, 1)).toBe(false)
    expect(istNeuerStand(0, 5)).toBe(false)
    expect(istNeuerStand(NaN, 1)).toBe(false)
  })
})

describe('Übernehmen auf die Klassentafel', () => {
  it('liefert neue Seiten mit neuen Kennungen und Beschriftung', () => {
    const original = neueSeite([strich('s1'), strich('s2')])
    const neu = seitenFuerKlassentafel([{ name: 'Anton Adler', seite: original }], new Date(2026, 10, 20))
    expect(neu).toHaveLength(1)
    expect(neu[0].id).not.toBe(original.id)
    const ids = neu[0].elemente.map((e) => e.id)
    expect(ids).not.toContain('s1')
    expect(new Set(ids).size).toBe(3)
    const beschriftung = neu[0].elemente.at(-1)
    expect(beschriftung?.art === 'text' && beschriftung.text).toBe('Anton Adler, 20.11.2026')
    // das Original bleibt unverändert
    expect(original.elemente).toHaveLength(2)
  })
})

describe('Gäste und Fotos', () => {
  const bild = { art: 'bild', id: 'b1', x: 0, y: 0, b: 10, h: 10, dateiId: '0123456789abcdef' } as unknown as Element

  it('legt Gast-Plätze nach den Namen an, mit eigener Kennung', () => {
    const p = neuePlaetze(schueler, 3)
    expect(p.map(platzName)).toEqual(['Anton Adler', 'Bea Zander', 'Gast 1', 'Gast 2', 'Gast 3'])
    expect(p.filter((x) => x.gast)).toHaveLength(3)
    expect(new Set(p.map((x) => x.platz)).size).toBe(5)
    expect(neuePlaetze(schueler)).toHaveLength(2)
  })

  it('begrenzt die Zahl der Gäste', () => {
    expect(neuePlaetze(schueler, 999).filter((x) => x.gast)).toHaveLength(MAX_GAESTE)
    expect(neuePlaetze(schueler, -4).filter((x) => x.gast)).toHaveLength(0)
    expect(neuePlaetze(schueler, NaN).filter((x) => x.gast)).toHaveLength(0)
  })

  it('behält die Gast-Markierung durch Verschlüsseln und Prüfen', async () => {
    const schluessel = await sitzungsSchluessel(neuerSitzungsSchluessel())
    const d = neueSitzungsdaten('10G1', schueler, undefined, 2)
    const offen = await oeffneSitzung(schluessel, await verschluesseleSitzung(schluessel, d))
    expect(offen?.plaetze.filter((p) => p.gast).map(platzName)).toEqual(['Gast 1', 'Gast 2'])
    expect(offen?.plaetze.find((p) => p.vorname === 'Anton')?.gast).toBeUndefined()
  })

  it('markiert Gäste in der Übersicht', () => {
    const p = neuePlaetze(schueler, 1)
    const z = platzZeilen(p, [], new Date())
    expect(z.map((x) => !!x.gast)).toEqual([false, false, true])
  })

  it('Seiten der Schüler dürfen Fotos enthalten, die Vorlage nicht', async () => {
    const seite = neueSeite([strich('s1'), bild])
    expect(pruefeAbgabeSeite(seite)?.elemente.map((e) => e.art)).toEqual(['strich', 'bild'])
    expect(pruefeSchuelerSeite(seite)?.elemente.map((e) => e.art)).toEqual(['strich'])
    const schluessel = await sitzungsSchluessel(neuerSitzungsSchluessel())
    const box = await verschluesseleAbgabe(schluessel, 'p1', seite, 1)
    expect((await oeffneAbgabe(schluessel, box, 'p1'))?.seite.elemente.map((e) => e.art)).toEqual(['strich', 'bild'])
  })

  it('verschlüsselt Fotos an Platz und Kennung gebunden', async () => {
    const schluessel = await sitzungsSchluessel(neuerSitzungsSchluessel())
    const bytes = new Uint8Array([0, 1, 2, 3, 250, 255])
    const box = await verschluesseleBild(schluessel, 'p1', 'abcd1234', bytes)
    expect(box.daten).not.toContain('AAEC')
    expect([...(await oeffneBild(schluessel, box, 'p1', 'abcd1234'))!]).toEqual([...bytes])
    // unter anderem Platz, anderer Kennung oder mit falschem Schlüssel: nicht lesbar
    expect(await oeffneBild(schluessel, box, 'p2', 'abcd1234')).toBeNull()
    expect(await oeffneBild(schluessel, box, 'p1', 'abcd9999')).toBeNull()
    expect(await oeffneBild(await sitzungsSchluessel(neuerSitzungsSchluessel()), box, 'p1', 'abcd1234')).toBeNull()
  })

  it('weist zu große Fotos ab', async () => {
    const schluessel = await sitzungsSchluessel(neuerSitzungsSchluessel())
    await expect(verschluesseleBild(schluessel, 'p1', 'abcd1234', new Uint8Array(2_000_000))).rejects.toThrow(/zu groß/)
  })
})
