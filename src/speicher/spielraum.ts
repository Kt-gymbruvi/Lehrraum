// Echtzeit-Kanal des Spielraums (Supabase Realtime, nur „Anwesenheit“ – es wird nichts in der Datenbank gespeichert).
// Die Tafel ist die Leitung des Raums; die Schüler kommen über die Lobby auf der Startseite (`spielen/lobby/`).
// Wie alle Serverzugriffe liegt auch dieser an einer Stelle; Tests ersetzen dieses Modul.
import type { RealtimeChannel } from '@supabase/supabase-js'
import { kanalName, leitungsAngaben, pruefeTeilnehmer, type SpielId, type Teilnehmer } from '../kern/spielraum.ts'
import { db } from './supabase.ts'

export type Spielraum = {
  /** Erlaubte Spiele ändern (wird allen im Raum gemeldet) */
  setzeErlaubt: (spiele: readonly SpielId[]) => void
  schliessen: () => void
}

export type Verbindung = 'verbindet' | 'verbunden' | 'getrennt' | 'nicht-eingerichtet'

/**
 * Raum betreten (als Leitung). `beiAnwesenheit` bekommt bei jeder Änderung die geprüfte Liste aller im Raum.
 * Ohne eingerichteten Server (keine Schlüssel) meldet `beiVerbindung` „nicht-eingerichtet“.
 */
export function oeffneRaum(code: string, id: string, erlaubt: readonly SpielId[], beiAnwesenheit: (liste: Teilnehmer[]) => void, beiVerbindung: (v: Verbindung) => void): Spielraum {
  let kanal: RealtimeChannel | null = null
  let aktuell = erlaubt
  try {
    kanal = db().channel(kanalName(code), { config: { broadcast: { self: false }, presence: { key: id } } })
  } catch {
    beiVerbindung('nicht-eingerichtet')
    return { setzeErlaubt: () => undefined, schliessen: () => undefined }
  }
  const k = kanal
  k.on('presence', { event: 'sync' }, () => {
    const zustand = k.presenceState() as Record<string, unknown[]>
    // je Schlüssel gilt die jüngste Angabe
    beiAnwesenheit(pruefeTeilnehmer(Object.values(zustand).map((metas) => metas[metas.length - 1])))
  })
  beiVerbindung('verbindet')
  k.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      beiVerbindung('verbunden')
      void k.track(leitungsAngaben(id, aktuell))
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') beiVerbindung('getrennt')
  })
  return {
    setzeErlaubt(spiele) {
      aktuell = spiele
      void k.track(leitungsAngaben(id, aktuell))
    },
    schliessen() {
      void k.untrack()
      void db().removeChannel(k)
    },
  }
}
