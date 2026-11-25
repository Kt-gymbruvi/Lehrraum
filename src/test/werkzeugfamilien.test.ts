import { describe, expect, it } from 'vitest'
import { FAMILIEN, familieVon, kapselInhalt, merke, vertreter } from '../kern/werkzeugfamilien.ts'

describe('Werkzeugfamilien', () => {
  it('jedes Werkzeug gehört zu genau einer Familie', () => {
    const alle = FAMILIEN.flatMap((f) => f.glieder)
    expect(new Set(alle).size).toBe(alle.length)
    expect(familieVon('marker').id).toBe('stift')
    expect(familieVon('pfeil').id).toBe('formen')
    expect(familieVon('hand').id).toBe('auswahl')
  })

  it('der Knopf einer Familie steht für das zuletzt benutzte Werkzeug, sonst für das erste', () => {
    const formen = familieVon('rechteck')
    expect(vertreter(formen, {})).toBe('rechteck')
    const z = merke({}, 'pfeil')
    expect(vertreter(formen, z)).toBe('pfeil')
    expect(vertreter(familieVon('stift'), z)).toBe('stift')
  })

  it('merken ändert nur die eigene Familie und lässt Gleiches unverändert', () => {
    const z = merke(merke({}, 'marker'), 'ellipse')
    expect(z).toEqual({ stift: 'marker', formen: 'ellipse' })
    expect(merke(z, 'marker')).toBe(z)
  })

  it('die Kapsel zeigt nur, was zum Werkzeug passt', () => {
    for (const w of ['stift', 'marker', 'text', 'tabelle', 'rechteck', 'ellipse', 'linie', 'pfeil'] as const) expect(kapselInhalt(w, 0)).toEqual({ farben: true, staerke: true })
    expect(kapselInhalt('radierer', 0)).toEqual({ farben: false, staerke: false })
    expect(kapselInhalt('fuellen', 0)).toEqual({ farben: true, staerke: false })
    expect(kapselInhalt('laser', 0)).toMatchObject({ farben: false, staerke: false, hinweis: expect.any(String) })
    expect(kapselInhalt('hand', 0)).toMatchObject({ farben: false, staerke: false, hinweis: expect.any(String) })
    // Auswahl: Farbe und Stärke erst, wenn etwas ausgewählt ist
    expect(kapselInhalt('auswahl', 0)).toEqual({ farben: false, staerke: false })
    expect(kapselInhalt('auswahl', 2)).toEqual({ farben: true, staerke: true })
  })
})
