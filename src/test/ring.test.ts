// Gestaltung „Atelier“: Ring um Timer und Stoppuhr
import { describe, expect, it } from 'vitest'
import { stoppAnteil, timerAnteil, timerStufe } from '../kern/fenster.ts'

describe('Ring um Timer und Stoppuhr', () => {
  it('der Timer-Ring läuft von voll nach leer', () => {
    expect(timerAnteil(300_000, 300_000)).toBe(1)
    expect(timerAnteil(150_000, 300_000)).toBe(0.5)
    expect(timerAnteil(0, 300_000)).toBe(0)
    expect(timerAnteil(10, 0)).toBe(0)
  })

  it('letzte Minute orange (bei kurzen Timern das letzte Viertel), abgelaufen rot', () => {
    expect(timerStufe(300_000, 300_000, false)).toBe('normal')
    expect(timerStufe(61_000, 300_000, false)).toBe('normal')
    expect(timerStufe(60_000, 300_000, false)).toBe('knapp')
    expect(timerStufe(1_000, 300_000, false)).toBe('knapp')
    expect(timerStufe(0, 300_000, true)).toBe('fertig')
    // 1-Minuten-Timer: nicht gleich zu Beginn orange, erst in den letzten 15 Sekunden
    expect(timerStufe(60_000, 60_000, false)).toBe('normal')
    expect(timerStufe(20_000, 60_000, false)).toBe('normal')
    expect(timerStufe(15_000, 60_000, false)).toBe('knapp')
  })

  it('der Stoppuhr-Ring läuft jede Minute einmal um', () => {
    expect(stoppAnteil(0)).toBe(0)
    expect(stoppAnteil(30_000)).toBe(0.5)
    expect(stoppAnteil(90_000)).toBe(0.5)
  })
})
