// Alles, was Lehrraum vom Server braucht – an einer Stelle. Benutzt nur, was Quizzo und Klassenfunk schon
// bereitstellen (Tabellen mit Zugriffsregeln, Funktionen spiel_erstellen und kf_sitzung_starten).
// Schülernamen gehen nur verschlüsselt über den Server (Tresore, siehe unten). In Tests wird dieses Modul ersetzt.
import { db, supabase } from './supabase.ts'

export const serverVorhanden = (): boolean => supabase !== null

// ---------- Anmeldung der Lehrkraft ----------
export async function istAngemeldet(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return data.session !== null
}

/** Meldet Änderungen der Anmeldung (auch aus einem anderen Tab). Liefert die Funktion zum Abbestellen. */
export function beiAnmeldung(tun: (angemeldet: boolean) => void): () => void {
  if (!supabase) return () => undefined
  const { data } = supabase.auth.onAuthStateChange((_ereignis, sitzung) => tun(sitzung !== null))
  return () => data.subscription.unsubscribe()
}

export async function melde_an(email: string, passwort: string): Promise<void> {
  const { error } = await db().auth.signInWithPassword({ email, password: passwort })
  if (error) throw error
}

// ---------- Quizzo ----------
export type QuizKurz = { id: string; titel: string; anzahl: number; ordner: string | null }
export type Spielmodus = 'klassisch' | 'team'

export async function ladeQuizze(): Promise<QuizKurz[]> {
  const { data, error } = await db().from('quizze').select('id, titel, ordner, fragen(count)').order('geaendert_am', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as { id: string; titel: string; ordner: string | null; fragen: { count: number }[] | null }[]).map((q) => ({
    id: q.id,
    titel: q.titel,
    ordner: q.ordner ?? null,
    anzahl: q.fragen?.[0]?.count ?? 0,
  }))
}

async function aufruf<T>(funktion: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(funktion, args)
  if (error) throw error
  return data as T
}

export const starteSpiel = (quizId: string, modus: Spielmodus, teams: number | null) =>
  aufruf<{ id: string; pin: string }>('spiel_erstellen', { p_quiz_id: quizId, p_modus: modus, p_teams: modus === 'team' ? teams : null })

/** Löscht das Spiel samt Spitznamen, Antworten und Punkten (wie „Beenden“ in Quizzo). */
export async function beendeSpiel(id: string): Promise<void> {
  const { error } = await db().from('spiele').delete().eq('id', id)
  if (error) throw error
}

// ---------- Klassenfunk ----------
export type PraesentationKurz = { id: string; titel: string; anzahl: number }

export async function ladePraesentationen(): Promise<PraesentationKurz[]> {
  const { data, error } = await db().from('kf_praesentationen').select('id, titel, kf_folien(count)').order('geaendert_am', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as { id: string; titel: string; kf_folien: { count: number }[] | null }[]).map((p) => ({ id: p.id, titel: p.titel, anzahl: p.kf_folien?.[0]?.count ?? 0 }))
}

export const starteSitzung = (praesentationId: string) => aufruf<{ id: string; pin: string }>('kf_sitzung_starten', { p_praesentation: praesentationId })

/** Löscht die Sitzung samt allen Antworten (wie „Beenden“ in Klassenfunk). */
export async function beendeSitzung(id: string): Promise<void> {
  const { error } = await db().from('kf_sitzungen').delete().eq('id', id)
  if (error) throw error
}

// ---------- Tresore (lr_tresore): verschlüsselte Inhalte je Lehrkraft ----------
// „namen“ schreibt das Notenbuch (Lerngruppen und Namen), „klassen“ schreibt Lehrraum (Klassen aller Geräte).
// Der Server sieht nur Salz, IV und verschlüsselte Daten.
export type TresorArt = 'namen' | 'klassen'
export type TresorZeile = { rev: number; salt: string; iv: string; daten: string }

export class TresorKonflikt extends Error {
  constructor() {
    super('Der Inhalt wurde inzwischen auf einem anderen Gerät geändert.')
  }
}

export async function ladeTresor(art: TresorArt): Promise<TresorZeile | null> {
  const { data, error } = await db().from('lr_tresore').select('rev, salt, iv, daten').eq('art', art).maybeSingle()
  if (error) throw error
  return (data as TresorZeile | null) ?? null
}

/** Speichert nur, wenn auf dem Server noch die Fassung `revErwartet` liegt (0 = noch keine); sonst TresorKonflikt. */
export async function speichereTresor(art: TresorArt, revErwartet: number, salt: string, iv: string, daten: string): Promise<number> {
  const { data, error } = await db().rpc('lr_tresor_speichern', { p_art: art, p_rev_erwartet: revErwartet, p_salt: salt, p_iv: iv, p_daten: daten })
  if (error) {
    if (/konflikt/.test(error.message ?? '')) throw new TresorKonflikt()
    throw error
  }
  return data as number
}

/** Übersetzt typische Fehlermeldungen ins Deutsche. */
export function fehlerText(fehler: unknown): string {
  const msg = fehler instanceof Error ? fehler.message : typeof fehler === 'object' && fehler && 'message' in fehler ? String((fehler as { message: unknown }).message) : String(fehler)
  if (msg.startsWith('QUIZZO: ')) return msg.slice('QUIZZO: '.length) // Meldungen aus den Datenbank-Funktionen sind schon deutsch
  if (/invalid login credentials/i.test(msg)) return 'E-Mail-Adresse oder Passwort ist falsch.'
  if (/rate limit|too many/i.test(msg)) return 'Zu viele Versuche. Bitte warte einen Moment.'
  if (/failed to fetch|network/i.test(msg)) return 'Keine Verbindung zum Server.'
  if (/jwt|not authenticated|permission|row-level/i.test(msg)) return 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.'
  if (/noch nicht eingerichtet/.test(msg)) return msg
  return 'Etwas ist schiefgelaufen: ' + msg
}
