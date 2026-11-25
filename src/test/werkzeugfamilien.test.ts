import { describe, expect, it } from 'vitest'
import { FAMILIEN, familieVon, merke, vertreter } from '../kern/werkzeugfamilien.ts'

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
})
