import { beforeEach, describe, expect, it, vi } from 'vitest'
import { neueSeite, type Seite, type Strich } from '../kern/modell.ts'
import { neuerSitzungsSchluessel, oeffneAbgabe, sitzungsSchluessel } from '../kern/sitzung.ts'
import { erzeugeAbgabeSpeicher, type SendeStand } from '../speicher/abgabe.ts'

const senden = vi.fn()
vi.mock('../speicher/server.ts', () => ({ abgabeSpeichern: (...a: unknown[]) => senden(...a) }))

const strich = (id: string): Strich => ({ art: 'strich', id, werkzeug: 'stift', farbe: '#0b1f4d', staerke: 6, druckEcht: false, punkte: [[0, 0, 0.5], [50, 10, 0.5]] })
const seiteMit = (...ids: string[]): Seite => neueSeite(ids.map(strich))
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))
const bis = async (bed: () => boolean) => {
  for (let i = 0; i < 200 && !bed(); i++) await warte(10)
  expect(bed()).toBe(true)
}

async function aufbauen(mehr: { stand0?: number } = {}) {
  const schluessel = await sitzungsSchluessel(neuerSitzungsSchluessel())
  const staende: SendeStand[] = []
  const speicher = erzeugeAbgabeSpeicher({ code: 'c'.repeat(22), platz: 'p1', hash: 'a'.repeat(64), schluessel, stand0: mehr.stand0 ?? 0, beiStand: (s) => staende.push(s), ruhe: 20, wiederholung: 30 })
  return { schluessel, staende, speicher }
}

beforeEach(() => { senden.mockReset() })

describe('Abgabe-Speicher', () => {
  it('bündelt schnelle Änderungen und sendet nur die letzte, verschlüsselt', async () => {
    senden.mockImplementation(async (_c, _p, _h, stand) => stand)
    const { schluessel, staende, speicher } = await aufbauen()
    speicher.melde(seiteMit('a'))
    speicher.melde(seiteMit('a', 'b'))
    speicher.melde(seiteMit('a', 'b', 'c'))
    await bis(() => staende.at(-1) === 'gesendet')
    expect(senden).toHaveBeenCalledTimes(1)
    const [code, platz, hash, stand, iv, daten] = senden.mock.calls[0]
    expect([code, platz, hash]).toEqual(['c'.repeat(22), 'p1', 'a'.repeat(64)])
    expect(daten).not.toContain('"strich"')
    const offen = await oeffneAbgabe(schluessel, { iv, daten }, 'p1')
    expect(offen?.seite.elemente).toHaveLength(3)
    expect(offen?.stand).toBe(stand)
  })

  it('zählt den Stand hoch, auch über den schon gespeicherten hinaus', async () => {
    senden.mockImplementation(async (_c, _p, _h, stand) => stand)
    const { staende, speicher } = await aufbauen({ stand0: 5_000_000_000 > 2_000_000_000 ? 1_000_000_000 : 0 })
    speicher.melde(seiteMit('a'))
    await bis(() => staende.at(-1) === 'gesendet')
    speicher.melde(seiteMit('a', 'b'))
    await bis(() => senden.mock.calls.length === 2)
    expect(senden.mock.calls[1][3]).toBeGreaterThan(senden.mock.calls[0][3])
    expect(senden.mock.calls[0][3]).toBeGreaterThan(1_000_000_000)
  })

  it('wiederholt nach einem Fehler, bis es klappt, ohne etwas zu verlieren', async () => {
    senden.mockRejectedValueOnce({ message: 'Failed to fetch' }).mockImplementation(async (_c, _p, _h, stand) => stand)
    const { staende, speicher } = await aufbauen()
    speicher.melde(seiteMit('a'))
    await bis(() => staende.at(-1) === 'gesendet')
    expect(staende).toContain('fehler')
    expect(senden).toHaveBeenCalledTimes(2)
  })

  it('sendet, was während des Sendens dazukommt, danach noch', async () => {
    let frei: () => void = () => undefined
    senden.mockImplementationOnce(() => new Promise<number>((ok) => (frei = () => ok(1)))).mockImplementation(async (_c, _p, _h, stand) => stand)
    const { schluessel, speicher } = await aufbauen()
    speicher.melde(seiteMit('a'))
    await bis(() => senden.mock.calls.length === 1)
    speicher.melde(seiteMit('a', 'b'))
    frei()
    await bis(() => senden.mock.calls.length === 2)
    const [, , , , iv, daten] = senden.mock.calls[1]
    expect((await oeffneAbgabe(schluessel, { iv, daten }, 'p1'))?.seite.elemente).toHaveLength(2)
  })

  it('sendet auf Wunsch sofort', async () => {
    senden.mockImplementation(async (_c, _p, _h, stand) => stand)
    const { speicher } = await aufbauen()
    speicher.melde(seiteMit('a'))
    await speicher.sendeJetzt()
    expect(senden).toHaveBeenCalledTimes(1)
  })

  it('hört auf, wenn die Zeit um ist', async () => {
    senden.mockImplementation(() => Promise.reject({ message: 'QUIZZO: Die Zeit ist um.' }))
    const { staende, speicher } = await aufbauen()
    speicher.melde(seiteMit('a'))
    await bis(() => staende.at(-1) === 'zeit-um')
    speicher.melde(seiteMit('a', 'b'))
    await warte(120)
    expect(senden).toHaveBeenCalledTimes(1)
  })

  it('meldet, wenn der Platz einem anderen Gerät gehört, und sendet nicht weiter', async () => {
    senden.mockImplementation(() => Promise.reject({ message: 'QUIZZO: Dieser Platz gehört einem anderen Gerät.' }))
    const { staende, speicher } = await aufbauen()
    speicher.melde(seiteMit('a'))
    await bis(() => staende.at(-1) === 'verloren')
    await warte(120)
    expect(senden).toHaveBeenCalledTimes(1)
  })

  it('sendet nach stoppe nichts mehr', async () => {
    senden.mockImplementation(async (_c, _p, _h, stand) => stand)
    const { speicher } = await aufbauen()
    speicher.melde(seiteMit('a'))
    speicher.stoppe()
    await warte(120)
    expect(senden).not.toHaveBeenCalled()
  })
})
