import { anwenden, ausfuehren, entfernenBefehl, leererVerlauf, MAX_SCHRITTE, rueckgaengig, wiederholen } from '../kern/befehle.ts'
import { abstandZurStrecke, pfadAusPunkten, pfadAusUmriss, stiftUmriss, trifftStrich, verschiebe, zoomeUm, zuTafel } from '../kern/geometrie.ts'
import { neueId, neueSeite, neuesTafelbild, pruefeTafel, ZOOM_MAX, ZOOM_MIN, type Element, type Strich } from '../kern/modell.ts'

const strich = (id: string, punkte: [number, number, number][] = [[0, 0, 0.5], [100, 0, 0.5]], mehr: Partial<Strich> = {}): Strich => ({
  art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte, ...mehr,
})

describe('Modell', () => {
  it('erzeugt eindeutige Kennungen', () => {
    const ids = new Set(Array.from({ length: 200 }, neueId))
    expect(ids.size).toBe(200)
    expect([...ids][0]).toMatch(/^[0-9a-f]{24}$/)
  })

  it('neues Tafelbild ist gültig und leer', () => {
    const t = neuesTafelbild()
    expect(pruefeTafel(t)).toEqual(t)
    expect(t.seiten).toHaveLength(1)
    expect(t.seiten[0].elemente).toEqual([])
    expect(t.seiteNr).toBe(0)
    expect(t.kamera).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('übersteht Speichern als JSON', () => {
    const t = { ...neuesTafelbild('7b'), seiten: [neueSeite([strich('a'), strich('b', [[1, 2, 0.9]], { werkzeug: 'marker', druckEcht: true })]), neueSeite()], seiteNr: 1 }
    expect(pruefeTafel(JSON.parse(JSON.stringify(t)))).toEqual(t)
  })

  it('lehnt fremde Daten und unbekannte Versionen ab', () => {
    expect(pruefeTafel(null)).toBeNull()
    expect(pruefeTafel('tafel')).toBeNull()
    expect(pruefeTafel({ ...neuesTafelbild(), schema: 'etwas/anderes' })).toBeNull()
    expect(pruefeTafel({ ...neuesTafelbild(), version: 5 })).toBeNull()
    expect(pruefeTafel({ ...neuesTafelbild(), id: '' })).toBeNull()
  })

  it('lässt kaputte Elemente weg, statt das ganze Bild zu verwerfen', () => {
    const t = pruefeTafel({
      ...neuesTafelbild(),
      seiten: [{ id: 's', elemente: [strich('gut'), { art: 'bild', id: 'x' }, { ...strich('farbe'), farbe: 'red' }, { ...strich('leer'), punkte: [] }, { ...strich('nan'), punkte: [[NaN, 0, 0.5]] }, 7] }],
    })
    expect(t?.seiten[0].elemente.map((e) => e.id)).toEqual(['gut'])
  })

  it('begrenzt Zoom und Druck, ergänzt fehlende Werte', () => {
    const t = pruefeTafel({ ...neuesTafelbild(), titel: '  ', kamera: { x: 'a', zoom: 99 }, seiteNr: 7, seiten: [{ id: 's', elemente: [{ ...strich('a'), punkte: [[1, 2, 7], [3, 4]] }] }] })
    expect(t?.seiteNr).toBe(0)
    expect(t?.kamera).toEqual({ x: 0, y: 0, zoom: ZOOM_MAX })
    expect(t?.titel).toBe('Tafel')
    expect((t?.seiten[0].elemente[0] as Strich).punkte).toEqual([[1, 2, 1], [3, 4, 0.5]])
  })
})

describe('Rückgängig und Wiederholen', () => {
  it('zeichnen, zurück, wieder vor', () => {
    let z = ausfuehren([], leererVerlauf(), { art: 'hinzufuegen', elemente: [strich('a')] })
    z = ausfuehren(z.elemente, z.verlauf, { art: 'hinzufuegen', elemente: [strich('b')] })
    expect(z.elemente.map((e) => e.id)).toEqual(['a', 'b'])
    z = rueckgaengig(z.elemente, z.verlauf)
    expect(z.elemente.map((e) => e.id)).toEqual(['a'])
    z = rueckgaengig(z.elemente, z.verlauf)
    expect(z.elemente).toEqual([])
    z = rueckgaengig(z.elemente, z.verlauf) // nichts mehr da: bleibt, wie es ist
    expect(z.elemente).toEqual([])
    z = wiederholen(z.elemente, z.verlauf)
    z = wiederholen(z.elemente, z.verlauf)
    expect(z.elemente.map((e) => e.id)).toEqual(['a', 'b'])
    expect(wiederholen(z.elemente, z.verlauf).elemente).toBe(z.elemente)
  })

  it('eine neue Änderung löscht das, was man wiederholen könnte', () => {
    let z = ausfuehren([], leererVerlauf(), { art: 'hinzufuegen', elemente: [strich('a')] })
    z = rueckgaengig(z.elemente, z.verlauf)
    z = ausfuehren(z.elemente, z.verlauf, { art: 'hinzufuegen', elemente: [strich('b')] })
    expect(z.verlauf.vor).toEqual([])
    expect(z.elemente.map((e) => e.id)).toEqual(['b'])
  })

  it('Radiertes kommt an der alten Stelle zurück', () => {
    const alle = ['a', 'b', 'c', 'd'].map((id) => strich(id))
    const b = entfernenBefehl(alle, ['d', 'b', 'gibt-es-nicht'])!
    let z = ausfuehren(alle, leererVerlauf(), b)
    expect(z.elemente.map((e) => e.id)).toEqual(['a', 'c'])
    z = rueckgaengig(z.elemente, z.verlauf)
    expect(z.elemente.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(z.elemente[1]).toBe(alle[1])
  })

  it('Tafel leeren lässt sich zurücknehmen; nichts zu entfernen ergibt keinen Befehl', () => {
    const alle = [strich('a'), strich('b')]
    const z = ausfuehren(alle, leererVerlauf(), entfernenBefehl(alle, ['a', 'b'])!)
    expect(z.elemente).toEqual([])
    expect(rueckgaengig(z.elemente, z.verlauf).elemente).toEqual(alle)
    expect(entfernenBefehl(alle, [])).toBeNull()
    expect(entfernenBefehl(alle, ['x'])).toBeNull()
  })

  it('verändert die übergebene Liste nicht und merkt sich höchstens MAX_SCHRITTE', () => {
    const alle = [strich('a')]
    anwenden(alle, { art: 'hinzufuegen', elemente: [strich('b')] })
    expect(alle).toHaveLength(1)
    let z = { elemente: [] as Element[], verlauf: leererVerlauf() }
    for (let i = 0; i < MAX_SCHRITTE + 20; i++) z = ausfuehren(z.elemente, z.verlauf, { art: 'hinzufuegen', elemente: [strich('s' + i)] })
    expect(z.verlauf.zurueck).toHaveLength(MAX_SCHRITTE)
    expect(z.elemente).toHaveLength(MAX_SCHRITTE + 20)
  })
})

describe('Geometrie', () => {
  it('rechnet Bildschirm- in Tafel-Koordinaten um', () => {
    expect(zuTafel({ x: 0, y: 0, zoom: 1 }, 10, 20)).toEqual([10, 20])
    expect(zuTafel({ x: 100, y: 50, zoom: 2 }, 300, 250)).toEqual([100, 100])
    expect(verschiebe({ x: 1, y: 2, zoom: 3 }, 10, -2)).toEqual({ x: 11, y: 0, zoom: 3 })
  })

  it('zoomt um einen festen Punkt und hält die Grenzen ein', () => {
    const k = { x: 40, y: -10, zoom: 1.5 }
    const vorher = zuTafel(k, 200, 120)
    const nachher = zuTafel(zoomeUm(k, 200, 120, 1.7), 200, 120)
    expect(nachher[0]).toBeCloseTo(vorher[0])
    expect(nachher[1]).toBeCloseTo(vorher[1])
    expect(zoomeUm(k, 0, 0, 1000).zoom).toBe(ZOOM_MAX)
    expect(zoomeUm(k, 0, 0, 0.0001).zoom).toBe(ZOOM_MIN)
  })

  it('misst den Abstand zu einer Strecke', () => {
    expect(abstandZurStrecke(50, 10, 0, 0, 100, 0)).toBe(10)
    expect(abstandZurStrecke(-30, 40, 0, 0, 100, 0)).toBe(50) // vor dem Anfang: Abstand zum Endpunkt
    expect(abstandZurStrecke(3, 4, 0, 0, 0, 0)).toBe(5) // Strecke ohne Länge
  })

  it('Radierer trifft Striche in der Nähe, nicht weiter weg', () => {
    const s = strich('a') // waagerecht von 0 bis 100, 6 breit
    expect(trifftStrich(s, 50, 0, 5)).toBe(true)
    expect(trifftStrich(s, 50, 7, 5)).toBe(true) // 7 ≤ 5 + 3
    expect(trifftStrich(s, 50, 9, 5)).toBe(false)
    expect(trifftStrich(s, 120, 0, 5)).toBe(false)
    expect(trifftStrich(strich('p', [[10, 10, 0.5]]), 12, 10, 1)).toBe(true) // einzelner Punkt
    // der breite Textmarker wird früher getroffen
    expect(trifftStrich(strich('m', undefined, { werkzeug: 'marker' }), 50, 15, 5)).toBe(true)
  })

  it('erzeugt Pfade für Stift und Textmarker', () => {
    const s = strich('a', [[0, 0, 0.5], [20, 5, 0.6], [40, 0, 0.7], [60, 10, 0.4]])
    const umriss = stiftUmriss(s)
    expect(umriss.length).toBeGreaterThan(4)
    expect(pfadAusUmriss(umriss)).toMatch(/^M [\d.-]+ [\d.-]+ Q .* Z$/)
    expect(pfadAusUmriss([])).toBe('')
    expect(pfadAusPunkten(s)).toMatch(/^M 0 0 Q 20 5 30 2.5 .* L 60 10$/)
    expect(pfadAusPunkten(strich('p', [[3, 4, 0.5]]))).toBe('M 3 4 l 0.01 0')
  })
})
