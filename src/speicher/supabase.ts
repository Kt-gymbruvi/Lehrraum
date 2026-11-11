import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { istGeheimerSchluessel } from './schluessel.ts'

// Dieselbe Supabase-Datenbank und dieselben Lehrkraft-Konten wie Quizzo und Klassenfunk.
// Nur der ÖFFENTLICHE Schlüssel (publishable) darf hier stehen; die Zugriffsregeln prüft die Datenbank.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

function erstelleClient(): SupabaseClient | null {
  if (!url || !key) return null
  if (istGeheimerSchluessel(key)) throw new Error('Geheimer Supabase-Schlüssel erkannt – bitte nur den publishable-Schlüssel verwenden!')
  // Die Anmeldung liegt im localStorage unter demselben Namen wie bei Quizzo und Klassenfunk (gleiche Adresse):
  // Wer dort angemeldet ist, ist es auch hier – und umgekehrt.
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
}

export const supabase = erstelleClient()

export function db(): SupabaseClient {
  if (!supabase) throw new Error('Der Server ist noch nicht eingerichtet.')
  return supabase
}
