import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ersetzt den Supabase-Client: geprüft wird, was an den Server geht (Namen der Funktionen und Felder) und wie
// Fehler weitergegeben werden – nicht die Datenbank (die prüft die Migration 017 in Quizzo).
const rpc = vi.fn()
const abfragen: { tabelle: string; aufrufe: [string, unknown[]][] }[] = []
vi.mock('../speicher/supabase.ts', () => {
  const kette = (eintrag: (typeof abfragen)[number]): unknown =>
    new Proxy({}, {
      get: (_, name: string) => {
        if (name === 'then') return (ok: (x: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
        return (...args: unknown[]) => {
          eintrag.aufrufe.push([name, args])
          return kette(eintrag)
        }
      },
    })
  const client = {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (tabelle: string) => {
      const eintrag = { tabelle, aufrufe: [] as [string, unknown[]][] }
      abfragen.push(eintrag)
      return kette(eintrag)
    },
  }
  return { supabase: client, db: () => client }
})

const s = await import('../speicher/server.ts')
const code = 'abcdefghijklmnopqrstuv'

beforeEach(() => {
  rpc.mockReset()
  abfragen.length = 0
})

describe('Schülerseiten – Serverzugriff', () => {
  it('legt Freigabe und Plätze mit den Feldern der Funktion an', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await s.legeSitzungAn(code, '2026-11-20T09:00:00.000Z', 'iviviviviviv', 'daten', ['p1', 'p2'])
    expect(rpc).toHaveBeenCalledWith('lr_sitzung_anlegen', { p_code: code, p_ende: '2026-11-20T09:00:00.000Z', p_iv: 'iviviviviviv', p_daten: 'daten', p_plaetze: ['p1', 'p2'] })
  })

  it('ändert das Ende und gibt Plätze frei', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await s.setzeSitzungEnde(code, '2026-11-20T09:30:00.000Z')
    await s.gibPlatzFrei(code, 'p1')
    expect(rpc).toHaveBeenNthCalledWith(1, 'lr_sitzung_zeit', { p_code: code, p_ende: '2026-11-20T09:30:00.000Z' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'lr_platz_freigeben', { p_code: code, p_platz: 'p1' })
  })

  it('nennt bei den Plätzen die Spalten und fragt nie das Geheimnis-Hash ab', async () => {
    await s.ladeAbgabeStaende(code)
    await s.ladeAbgabeZeile(code, 'p1')
    const spalten = abfragen.filter((a) => a.tabelle === 'lr_abgaben').flatMap((a) => a.aufrufe.filter(([n]) => n === 'select').map(([, args]) => String(args[0])))
    expect(spalten).toHaveLength(2)
    for (const sp of spalten) {
      expect(sp).not.toContain('*')
      expect(sp).not.toContain('geheimnis')
    }
  })

  it('Schüler: laden, belegen, speichern über die Funktionen', async () => {
    const hash = 'a'.repeat(64)
    rpc.mockResolvedValueOnce({ data: { iv: 'i', daten: 'd', beginn: 'b', ende: 'e', plaetze: [{ platz: 'p1', belegt: false }] }, error: null })
    expect((await s.mitmachenLaden(code)).plaetze).toHaveLength(1)
    rpc.mockResolvedValueOnce({ data: true, error: null })
    expect(await s.platzBelegen(code, 'p1', hash)).toBe(true)
    rpc.mockResolvedValueOnce({ data: false, error: null })
    expect(await s.platzBelegen(code, 'p1', hash)).toBe(false)
    rpc.mockResolvedValueOnce({ data: 4, error: null })
    expect(await s.abgabeSpeichern(code, 'p1', hash, 4, 'iv', 'daten')).toBe(4)
    expect(rpc).toHaveBeenLastCalledWith('lr_abgabe_speichern', { p_code: code, p_platz: 'p1', p_hash: hash, p_stand: 4, p_iv: 'iv', p_daten: 'daten' })
    rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await s.abgabeLaden(code, 'p1', hash)).toBeNull()
  })

  it('gibt Fehler der Datenbank weiter, deutsch über fehlerText', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'QUIZZO: Die Zeit ist um.' } })
    const fehler = await s.abgabeSpeichern(code, 'p1', 'a'.repeat(64), 1, 'iv', 'd').catch((e) => e)
    expect(s.fehlerText(fehler)).toBe('Die Zeit ist um.')
    await expect(s.mitmachenLaden(code)).rejects.toBeTruthy()
  })

  it('Fotos: Schüler legen sie verschlüsselt ab und holen sie zurück, die Lehrkraft liest einzelne', async () => {
    const hash = 'a'.repeat(64)
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await s.bildSpeichern(code, 'p1', hash, 'abcd1234', 'ivivivivivivi', 'daten')
    expect(rpc).toHaveBeenLastCalledWith('lr_bild_speichern', { p_code: code, p_platz: 'p1', p_hash: hash, p_bild: 'abcd1234', p_iv: 'ivivivivivivi', p_daten: 'daten' })
    rpc.mockResolvedValueOnce({ data: [{ bild: 'abcd1234', iv: 'i', daten: 'd' }], error: null })
    expect(await s.bilderLaden(code, 'p1', hash)).toHaveLength(1)
    expect(rpc).toHaveBeenLastCalledWith('lr_bilder_laden', { p_code: code, p_platz: 'p1', p_hash: hash })
    rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await s.bilderLaden(code, 'p1', hash)).toEqual([])
    await s.ladeBildZeile(code, 'p1', 'abcd1234')
    const lesen = abfragen.filter((a) => a.tabelle === 'lr_bilder').flatMap((a) => a.aufrufe.filter(([n]) => n === 'select').map(([, args]) => String(args[0])))
    expect(lesen).toEqual(['bild, iv, daten'])
  })

  it('Fotos: Fehler wie „Zu viele Fotos.“ kommen deutsch an', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'QUIZZO: Zu viele Fotos.' } })
    const fehler = await s.bildSpeichern(code, 'p1', 'a'.repeat(64), 'abcd1234', 'ivivivivivivi', 'd').catch((e) => e)
    expect(s.fehlerText(fehler)).toBe('Zu viele Fotos.')
  })

  it('Aufgabenblatt: die Lehrkraft legt Bilder ab, Schüler holen sie einzeln', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await s.vorlageBildSpeichern(code, 'abcd1234', 'ivivivivivivi', 'daten')
    expect(rpc).toHaveBeenLastCalledWith('lr_vorlagebild_speichern', { p_code: code, p_bild: 'abcd1234', p_iv: 'ivivivivivivi', p_daten: 'daten' })
    rpc.mockResolvedValueOnce({ data: { bild: 'abcd1234', iv: 'i', daten: 'd' }, error: null })
    expect((await s.vorlageBildLaden(code, 'abcd1234'))?.daten).toBe('d')
    expect(rpc).toHaveBeenLastCalledWith('lr_vorlagebild_laden', { p_code: code, p_bild: 'abcd1234' })
    rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await s.vorlageBildLaden(code, 'abcd1234')).toBeNull()
  })

  it('Aufgabenblatt: Fehler wie „zu viele Bilder“ kommen deutsch an', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'QUIZZO: Das Aufgabenblatt hat zu viele Bilder.' } })
    const fehler = await s.vorlageBildSpeichern(code, 'abcd1234', 'ivivivivivivi', 'd').catch((x) => x)
    expect(s.fehlerText(fehler)).toBe('Das Aufgabenblatt hat zu viele Bilder.')
  })
})
