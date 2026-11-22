// Spielraum der Klasse: Logik (Code, Adresse, Prüfung der Anwesenheit) und das Fenster „Spiele“ (Server ersetzt).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pruefeFenster, schalte } from '../kern/fenster.ts'
import { angebote, istCode, kanalName, laufende, leitungsAngaben, lobbyAdresse, neuerCode, pruefeTeilnehmer } from '../kern/spielraum.ts'
import type { Teilnehmer } from '../kern/spielraum.ts'

const raum = vi.hoisted(() => ({
  geoeffnet: [] as { code: string; erlaubt: string[] }[],
  setzeErlaubt: vi.fn(),
  schliessen: vi.fn(),
  senden: null as null | ((l: Teilnehmer[]) => void),
}))
vi.mock('../speicher/spielraum.ts', () => ({
  oeffneRaum: (code: string, _id: string, erlaubt: string[], beiAnwesenheit: (l: Teilnehmer[]) => void, beiVerbindung: (v: 'verbunden') => void) => {
    raum.geoeffnet.push({ code, erlaubt })
    raum.senden = beiAnwesenheit
    beiVerbindung('verbunden')
    return { setzeErlaubt: raum.setzeErlaubt, schliessen: raum.schliessen }
  },
}))

const { Spiele } = await import('../fenster/Spiele.tsx')

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  raum.geoeffnet.length = 0
  raum.setzeErlaubt.mockClear()
  raum.schliessen.mockClear()
})

describe('Spielraum – Logik', () => {
  it('erzeugt Codes aus sechs eindeutigen Zeichen', () => {
    const code = neuerCode()
    expect(code).toHaveLength(6)
    expect(istCode(code)).toBe(true)
    expect(neuerCode(() => 0)).toBe('AAAAAA')
    expect(istCode('AAAAAI')).toBe(false) // I gibt es nicht
    expect(istCode('abc123')).toBe(false)
    expect(istCode(123456)).toBe(false)
  })

  it('baut Kanalname und Adresse für die Startseite', () => {
    expect(kanalName('K7P2QX')).toBe('spielraum-K7P2QX')
    expect(lobbyAdresse('K7P2QX')).toBe('https://kt-gymbruvi.github.io/spielen/lobby/?raum=K7P2QX')
  })

  it('prüft die Anwesenheit fremder Geräte', () => {
    const l = pruefeTeilnehmer([
      { id: 'a', name: '  Anna<b>  ', rolle: 'spieler', angebot: { partie: 'P1', spiel: 'schach' } },
      { id: 'a', name: 'Doppelt' },
      { id: 'b', name: 'B'.repeat(50), spielt: { partie: 'P2', spiel: 'muehle', gegner: 'Carla' } },
      { id: 'c', name: 'Leitung', rolle: 'leitung', angebot: { partie: 'P3', spiel: 'unbekannt' } },
      { name: 'ohne Kennung' },
      'quatsch',
      null,
    ])
    expect(l.map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(l[0]).toMatchObject({ name: 'Annab', angebot: { spiel: 'schach' } })
    expect(l[1].name).toHaveLength(20)
    expect(l[2].leitung).toBe(true)
    expect(l[2].angebot).toBeUndefined() // unbekanntes Spiel fällt weg
    expect(pruefeTeilnehmer('nichts')).toEqual([])
  })

  it('zählt Angebote und laufende Partien richtig', () => {
    const l = pruefeTeilnehmer([
      { id: 'a', name: 'Anna', angebot: { partie: 'P1', spiel: 'schach' } },
      { id: 'b', name: 'Ben', spielt: { partie: 'P2', spiel: 'muehle', gegner: 'Carla' } },
      { id: 'c', name: 'Carla', spielt: { partie: 'P2', spiel: 'muehle', gegner: 'Ben' } },
      { id: 'd', name: 'Leitung', rolle: 'leitung', angebot: { partie: 'P9', spiel: 'schach' } },
    ])
    expect(angebote(l).map((t) => t.name)).toEqual(['Anna'])
    expect(laufende(l)).toEqual([{ partie: 'P2', spiel: 'muehle', a: 'Ben', b: 'Carla' }])
  })

  it('meldet die Tafel als Leitung mit den erlaubten Spielen in fester Reihenfolge', () => {
    expect(leitungsAngaben('t1', ['schach', 'vier-gewinnt'])).toEqual({ id: 't1', name: 'Tafel', rolle: 'leitung', spiele: ['vier-gewinnt', 'schach'] })
  })

  it('das Fenster lässt sich öffnen, speichern und wieder laden', () => {
    const l = schalte([], 'spiele')
    expect(l).toHaveLength(1)
    expect(schalte(l, 'spiele')).toEqual([]) // zweiter Klick schließt
    expect(pruefeFenster(JSON.parse(JSON.stringify(l)))).toEqual(l)
  })
})

describe('Fenster „Spiele“', () => {
  it('öffnet einen Raum und zeigt Code und QR-Code', () => {
    render(<Spiele />)
    expect(raum.geoeffnet).toHaveLength(1)
    const code = raum.geoeffnet[0].code
    expect(istCode(code)).toBe(true)
    expect(screen.getByText(code)).toBeTruthy()
    expect(screen.getByRole('img', { name: `QR-Code zum Spielraum ${code}` })).toBeTruthy()
    expect(raum.geoeffnet[0].erlaubt).toEqual(['vier-gewinnt', 'muehle', 'schach', 'chaos-flitzer'])
  })

  it('behält den Code beim erneuten Öffnen im selben Tab', () => {
    const erste = render(<Spiele />)
    const code = raum.geoeffnet[0].code
    erste.unmount()
    expect(raum.schliessen).toHaveBeenCalled()
    render(<Spiele />)
    expect(raum.geoeffnet[1].code).toBe(code)
  })

  it('meldet geänderte Spiele an den Raum', () => {
    render(<Spiele />)
    fireEvent.click(screen.getByLabelText('Mühle'))
    expect(raum.setzeErlaubt).toHaveBeenLastCalledWith(['vier-gewinnt', 'schach', 'chaos-flitzer'])
    fireEvent.click(screen.getByLabelText('Mühle'))
    expect(raum.setzeErlaubt).toHaveBeenLastCalledWith(['vier-gewinnt', 'muehle', 'schach', 'chaos-flitzer'])
  })

  it('„Neuer Code“ wechselt den Raum', () => {
    render(<Spiele />)
    const alt = raum.geoeffnet[0].code
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Code' }))
    expect(raum.geoeffnet).toHaveLength(2)
    expect(raum.geoeffnet[1].code).not.toBe(alt)
    expect(raum.schliessen).toHaveBeenCalledTimes(1)
  })

  it('zeigt Teilnehmer, Angebote und laufende Partien', () => {
    render(<Spiele />)
    act(() => {
      raum.senden?.(
        pruefeTeilnehmer([
          { id: 't', name: 'Tafel', rolle: 'leitung' },
          { id: 'a', name: 'Anna', angebot: { partie: 'P1', spiel: 'schach' } },
          { id: 'b', name: 'Ben', spielt: { partie: 'P2', spiel: 'muehle', gegner: 'Carla' } },
          { id: 'c', name: 'Carla', spielt: { partie: 'P2', spiel: 'muehle', gegner: 'Ben' } },
          { id: 'd', name: 'Dora', angebot: { partie: 'ABC234', spiel: 'chaos-flitzer', code: 'ABC234', belegt: 2 } },
          { id: 'e', name: 'Emil', spielt: { partie: 'XYZ789', spiel: 'chaos-flitzer', gegner: '4 Spieler' } },
        ]),
      )
    })
    expect(screen.getByText('Dora sucht Mitspieler: Chaos-Flitzer 3000')).toBeTruthy()
    expect(screen.getByText('Emil spielt Chaos-Flitzer 3000 (4 Spieler)')).toBeTruthy()
    expect(screen.getByText('Anna sucht Schach')).toBeTruthy()
    expect(screen.getByText('Ben gegen Carla – Mühle')).toBeTruthy()
    expect(screen.getByText(/im Raum/).textContent).toContain('5')
  })
})
