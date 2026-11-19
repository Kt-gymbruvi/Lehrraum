// Gefüllte Flächen (Datenmodell Version 12): Fläche aus dem Raster, Umriss, Treffer, Verschieben, Prüfung, Entscheidung des Füllwerkzeugs
import { anwenden, zuruecknehmen } from '../kern/befehle.ts'
import { flaecheInhalt, freieFlaeche, neueFlaeche, ringFlaeche, umrisse, umrissAusMaske, vereinfache } from '../kern/flaeche.ts'
import { formAllein, fuelleFlaeche, stelleFuerFlaeche } from '../kern/fuellen.ts'
import { gedreht, imVieleck, rahmen, skaliert, trifft, verschoben } from '../kern/geometrie.ts'
import { neueSeite, pruefeElemente, pruefeTafel, neuesTafelbild, type Bild, type Element, type Form, type Strich } from '../kern/modell.ts'
import { kopie } from '../kern/seiten.ts'

/** Raster b × h mit einem Rechteck-Rahmen (Linie 1 Pixel) von (x0, y0) bis (x1, y1), optional mit Lücke */
function raster(b: number, h: number, [x0, y0, x1, y1]: number[], luecke = 0): Uint8Array {
  const s = new Uint8Array(b * h)
  for (let x = x0; x <= x1; x++) s[y0 * b + x] = s[y1 * b + x] = 1
  for (let y = y0; y <= y1; y++) s[y * b + x0] = s[y * b + x1] = 1
  for (let i = 0; i < luecke; i++) s[y0 * b + x0 + 3 + i] = 0
  return s
}
const summe = (m: Uint8Array) => m.reduce((a, c) => a + c, 0)

describe('Fläche aus dem Raster', () => {
  it('findet die geschlossene Fläche in der Linie, auch bei einer winzigen Lücke', () => {
    const m = freieFlaeche(raster(40, 40, [10, 10, 30, 30]), 40, 40, 20, 20)!
    expect(summe(m)).toBe(17 * 17) // innen 19 × 19, minus der Verbreiterung der Linie
    expect(freieFlaeche(raster(40, 40, [10, 10, 30, 30], 2), 40, 40, 20, 20)).not.toBeNull() // Lücke von 2 Pixeln schließt sich
  })

  it('füllt nichts, wenn die Fläche offen ist oder bis an den Rand reicht', () => {
    expect(freieFlaeche(raster(40, 40, [10, 10, 30, 30], 6), 40, 40, 20, 20)).toBeNull() // Lücke von 6 Pixeln
    expect(freieFlaeche(raster(40, 40, [10, 10, 30, 30]), 40, 40, 3, 3)).toBeNull() // draußen: reicht an den Rand
    expect(freieFlaeche(raster(40, 40, [10, 10, 30, 30]), 40, 40, -5, 3)).toBeNull()
  })

  it('nimmt bei einem Tipp knapp neben der Linie die nächste freie Stelle', () => {
    expect(freieFlaeche(raster(40, 40, [10, 10, 30, 30]), 40, 40, 11, 20)).not.toBeNull() // auf der Linie (verbreitert) – innen daneben
  })

  it('umreißt die Fläche und die Inseln darin', () => {
    const s = raster(60, 60, [10, 10, 50, 50])
    for (let y = 25; y <= 35; y++) for (let x = 25; x <= 35; x++) s[y * 60 + x] = 1 // ausgefüllte Insel
    const u = umrissAusMaske(freieFlaeche(s, 60, 60, 15, 15)!, 60, 60)!
    expect(ringFlaeche(u.aussen)).toBeGreaterThan(36 * 36)
    expect(ringFlaeche(u.aussen)).toBeLessThan(41 * 41)
    expect(u.loecher).toHaveLength(1)
    expect(ringFlaeche(u.loecher[0])).toBeGreaterThan(10 * 10)
    expect(u.aussen.length).toBeLessThanOrEqual(8) // ein Quadrat bleibt ein Quadrat (vereinfacht)
  })

  it('Ringe der Maske sind geschlossen; vereinfachen lässt gerade Strecken weg', () => {
    const m = new Uint8Array(25)
    for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) m[y * 5 + x] = 1
    const ringe = umrisse(m, 5, 5)
    expect(ringe).toHaveLength(1)
    expect(ringFlaeche(ringe[0])).toBe(9)
    expect(vereinfache(ringe[0], 0.5)).toHaveLength(4)
  })
})


describe('Gefüllte Fläche als Element', () => {
  const f: Strich = neueFlaeche([[0, 0], [100, 0], [100, 100], [0, 100]], [[[40, 40], [60, 40], [60, 60], [40, 60]]] as never, '#c62828', 3)

  it('trifft im Inneren, aber nicht in einem Loch', () => {
    expect(f.loecher).toHaveLength(1)
    expect(imVieleck(f, 10, 10)).toBe(true)
    expect(imVieleck(f, 50, 50)).toBe(false)
    expect(imVieleck(f, 150, 50)).toBe(false)
    expect(trifft(f, 20, 80, 0)).toBe(true)
    expect(trifft(f, 50, 50, 0)).toBe(false)
    expect(trifft(f, 120, 50, 0)).toBe(false)
    expect(trifft(f, 101, 50, 2)).toBe(true) // der Rand zählt mit
  })

  it('wandert, wächst, dreht sich und wird kopiert – Löcher gehen mit', () => {
    const v = verschoben(f, 10, 5)
    expect(v.punkte[0]).toEqual([10, 5, 0.5])
    expect(v.loecher![0][0]).toEqual([50, 45, 0.5])
    const s = skaliert(f, 0, 0, 2, 2, false)
    expect(s.loecher![0][2]).toEqual([120, 120, 0.5])
    const g = gedreht(f, 0, 0, 90)
    expect(g.loecher![0][0][0]).toBeCloseTo(-40)
    expect(g.loecher![0][0][1]).toBeCloseTo(40)
    const k = kopie(f, 5, 5) as Strich
    expect(k.id).not.toBe(f.id)
    expect(k.flaeche).toBe(true)
    expect(k.loecher![0][0]).toEqual([45, 45, 0.5])
    expect(rahmen(f)[0]).toBeLessThan(0) // Rand ragt über den Umriss
  })

  it('wird geprüft und gespeichert; Kaputtes fällt weg', () => {
    const ok = pruefeElemente([f])[0] as Strich
    expect(ok.flaeche).toBe(true)
    expect(ok.loecher).toHaveLength(1)
    expect(pruefeElemente([{ ...f, loecher: [[[1, 2, 0.5]], [['a', 2]]] }])[0]).not.toHaveProperty('loecher') // Löcher mit zu wenig Punkten
    expect((pruefeElemente([{ ...f, punkte: [[0, 0, 0.5], [1, 1, 0.5]] }])[0] as Strich).flaeche).toBeUndefined() // kein Vieleck
    const roh = pruefeTafel({ ...neuesTafelbild(), seiten: [neueSeite([f])] })!
    expect((roh.seiten[0].elemente[0] as Strich).flaeche).toBe(true)
    expect(roh.version).toBe(12)
  })
})

describe('Füllwerkzeug – Entscheidung', () => {
  const f = (id: string, mehr: Partial<Form> = {}): Form => ({ art: 'form', id, form: 'rechteck', x1: 0, y1: 0, x2: 100, y2: 100, farbe: '#111111', staerke: 4, ...mehr })
  const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#111111', staerke: 4, druckEcht: false, punkte: [[10, 10, 0.5], [90, 90, 0.5]] })
  const ringe = { aussen: [[0, 0], [100, 0], [100, 100], [0, 100]] as [number, number][], loecher: [] }

  it('eine einzelne Form wird selbst gefüllt, mit etwas darin die Fläche', () => {
    expect(formAllein([f('r')], 50, 50, '#c62828')?.nachher).toMatchObject({ gefuellt: true, farbe: '#c62828' })
    expect(formAllein([f('r'), strich('s')], 50, 50, '#c62828')).toBeNull()
    expect(formAllein([f('r'), { art: 'bild', id: 'b', x: 0, y: 0, b: 500, h: 500, dateiId: 'd' } as Bild], 50, 50, '#c62828')).not.toBeNull() // ein Bild darunter stört nicht
  })

  it('füllt eine neue Fläche unter den Linien, aber über Bildern', () => {
    const bild = { art: 'bild', id: 'b', x: 0, y: 0, b: 500, h: 500, dateiId: 'd' } as Bild
    const liste: Element[] = [bild, strich('s')]
    const b = fuelleFlaeche(liste, 50, 50, '#c62828', ringe, 3)!
    expect(b).toMatchObject({ art: 'hinzufuegen', stelle: 1 })
    const danach = anwenden(liste, b)
    expect(danach.map((e) => e.art)).toEqual(['bild', 'strich', 'strich'])
    expect((danach[1] as Strich).flaeche).toBe(true) // unter dem Strich
    expect(zuruecknehmen(danach, b)).toEqual(liste)
    expect(stelleFuerFlaeche(danach)).toBe(2)
  })

  it('dieselbe Fläche noch einmal: umfärben, in derselben Farbe: Füllung weg; kleinere Fläche darin: neu', () => {
    const alt = neueFlaeche(ringe.aussen, [], '#c62828', 3)
    const gleich = fuelleFlaeche([alt], 50, 50, '#1d4fc4', ringe, 3)!
    expect(gleich).toMatchObject({ art: 'ersetzen' })
    expect((anwenden([alt], gleich)[0] as Strich).farbe).toBe('#1d4fc4')
    expect(fuelleFlaeche([alt], 50, 50, '#c62828', ringe, 3)).toMatchObject({ art: 'entfernen' })
    const klein = { aussen: [[40, 40], [60, 40], [60, 60], [40, 60]] as [number, number][], loecher: [] }
    const innen = fuelleFlaeche([alt], 50, 50, '#1d4fc4', klein, 3)!
    expect(innen).toMatchObject({ art: 'hinzufuegen', stelle: 1 })
    expect(flaecheInhalt(alt)).toBe(10000)
  })

  it('ohne Umriss (offene Fläche) passiert nichts – außer dort liegt schon eine Füllung', () => {
    expect(fuelleFlaeche([strich('s')], 50, 50, '#c62828', null, 3)).toBeNull()
    const alt = neueFlaeche(ringe.aussen, [], '#c62828', 3)
    expect(fuelleFlaeche([alt], 50, 50, '#1d4fc4', null, 3)).toMatchObject({ art: 'ersetzen' })
  })
})
