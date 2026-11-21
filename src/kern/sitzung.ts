// Mitmachen per QR-Code (SPEC-schuelerseiten.md, Etappe 1): reine Logik ohne React, Browser-Speicher und Server.
//
// Eine Sitzung gibt eine Klasse für kurze Zeit frei. Der Sitzungsschlüssel (AES-256-GCM) steckt im QR-Code hinter
// dem `#` der Adresse und geht nie an einen Server. Namensliste und Schülerseiten werden damit auf dem Gerät
// verschlüsselt; der Server sieht nur Platzkennungen (zufällig je Sitzung) und verschlüsselte Daten.

import { b64, entschluessele, unb64, verschluessele, type Box } from './tresor.ts'
import { kopiere } from './seiten.ts'
import { neueId, neueSeite, neuesTafelbild, pruefeTafel, type Element, type Seite, type Text } from './modell.ts'
import { namenSortiert, pruefeSchueler, type Schueler } from './klassen.ts'

export const SITZUNG_SCHEMA = 'lehrraum/mitmachen'
export const ABGABE_SCHEMA = 'lehrraum/abgabe'
export const SITZUNG_VERSION = 1
/** Plätze einer Freigabe: Schüler der Klasse und Gäste zusammen */
export const MAX_PLAETZE = 100
/** Plätze für Schüler, die nicht in der Liste stehen (Gast 1, Gast 2, …) */
export const MAX_GAESTE = 10
/** Bilder je Seite eines Schülers (die Lehrkraft-Seite zeigt sie alle) */
export const MAX_SCHUELER_BILDER = 8

// ---------- Zeit ----------
/** Zur Auswahl beim Freigeben (Minuten) */
export const DAUERN = [10, 20, 45, 90] as const
export const MAX_DAUER = 180
/** So lange bleiben die Seiten nach dem Ende zum Durchsehen auf dem Server (verschlüsselt), dann löscht der Server sie */
export const AUFBEWAHRUNG_STUNDEN = 48

export type Zeitraum = { beginn: string; ende: string }

const zeit = (iso: string): number => new Date(iso).getTime()
const minutenOk = (m: number): number => (Number.isFinite(m) ? Math.min(MAX_DAUER, Math.max(1, Math.round(m))) : DAUERN[0])

/** Zeitraum ab jetzt für so viele Minuten (1 bis MAX_DAUER) */
export function zeitraum(jetzt: Date, minuten: number): Zeitraum {
  const beginn = jetzt.getTime()
  return { beginn: new Date(beginn).toISOString(), ende: new Date(beginn + minutenOk(minuten) * 60_000).toISOString() }
}

/** Offen, solange das Ende nicht erreicht ist; ungültige Zeitangaben gelten als geschlossen */
export function istOffen(z: Zeitraum, jetzt: Date): boolean {
  const b = zeit(z.beginn)
  const e = zeit(z.ende)
  return Number.isFinite(b) && Number.isFinite(e) && jetzt.getTime() >= b && jetzt.getTime() < e
}

/** Verbleibende ganze Sekunden (nie negativ) */
export function restSekunden(z: Zeitraum, jetzt: Date): number {
  const e = zeit(z.ende)
  return Number.isFinite(e) ? Math.max(0, Math.ceil((e - jetzt.getTime()) / 1000)) : 0
}

/** Verlängert um Minuten ab dem späteren von Ende und jetzt, höchstens MAX_DAUER ab jetzt */
export function verlaengert(z: Zeitraum, minuten: number, jetzt: Date): Zeitraum {
  const alt = Math.max(zeit(z.ende), jetzt.getTime())
  const neu = Math.min(alt + minutenOk(minuten) * 60_000, jetzt.getTime() + MAX_DAUER * 60_000)
  return { ...z, ende: new Date(Math.max(neu, zeit(z.ende))).toISOString() }
}

/** Beendet sofort (ein schon abgelaufener Zeitraum bleibt, wie er ist) */
export const beendet = (z: Zeitraum, jetzt: Date): Zeitraum => (istOffen(z, jetzt) ? { ...z, ende: jetzt.toISOString() } : z)

/** Zeitpunkt, ab dem der Server die Sitzung samt Seiten löscht */
export const loeschzeit = (ende: string): string => new Date(zeit(ende) + AUFBEWAHRUNG_STUNDEN * 3_600_000).toISOString()

// ---------- Kennungen und Schlüssel ----------
const b64url = (daten: Uint8Array | ArrayBuffer): string => b64(daten).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (s: string): Uint8Array<ArrayBuffer> => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  return unb64(t + '='.repeat((4 - (t.length % 4)) % 4))
}

const CODE = /^[A-Za-z0-9_-]{22}$/
const SCHLUESSEL = /^[A-Za-z0-9_-]{43}$/
const KENNUNG = /^[0-9A-Za-z_-]{1,64}$/

export const istSitzungsCode = (x: unknown): x is string => typeof x === 'string' && CODE.test(x)
export const istSitzungsSchluessel = (x: unknown): x is string => typeof x === 'string' && SCHLUESSEL.test(x)

/** Zufälliger Sitzungscode (128 Bit): findet die Sitzung auf dem Server, entschlüsselt nichts */
export const neuerSitzungsCode = (): string => b64url(crypto.getRandomValues(new Uint8Array(16)))

/** Zufälliger Sitzungsschlüssel (256 Bit) als Text für den QR-Code; er verlässt das Gerät der Lehrkraft nur im `#`-Teil der Adresse */
export const neuerSitzungsSchluessel = (): string => b64url(crypto.getRandomValues(new Uint8Array(32)))

/** Schlüssel aus dem Text im QR-Code; nicht exportierbar. Wirft bei ungültigem Text. */
export async function sitzungsSchluessel(text: string): Promise<CryptoKey> {
  if (!istSitzungsSchluessel(text)) throw new Error('Ungültiger Sitzungsschlüssel')
  return crypto.subtle.importKey('raw', unb64url(text), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** Geheimnis eines belegten Platzes: Das Gerät des Schülers behält es, der Server nur den Hash davon */
export const neuesPlatzGeheimnis = (): string => b64url(crypto.getRandomValues(new Uint8Array(16)))

export async function geheimnisHash(geheimnis: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(geheimnis)))
  return Array.from(h, (x) => x.toString(16).padStart(2, '0')).join('')
}

// ---------- Adresse im QR-Code ----------
/** Adresse der Schülerseite; Code und Schlüssel stehen hinter dem `#` und gehen nie an einen Server */
export function mitmachenAdresse(basis: string, code: string, schluessel: string): string {
  return `${basis.split('#')[0]}#/mitmachen/${code}/${schluessel}`
}

/** Liest Code und Schlüssel aus dem `#`-Teil der Adresse; sonst null */
export function liesMitmachen(hash: string): { code: string; schluessel: string } | null {
  const m = /^#?\/?mitmachen\/([^/]+)\/([^/]+)\/?$/.exec(hash)
  return m && istSitzungsCode(m[1]) && istSitzungsSchluessel(m[2]) ? { code: m[1], schluessel: m[2] } : null
}

// ---------- Seiten von Schülern ----------
/** Obergrenze für die Größe einer verschlüsselten Seite (Zeichen des JSON) */
export const MAX_ABGABE_ZEICHEN = 2_000_000

/**
 * Prüft eine Seite mit der Prüfung der Tafel; das Hintergrundbild fällt immer weg, Bild-Elemente nur ohne `mitBildern`.
 * (Die Vorlage der Lehrkraft geht ohne Bilder hinaus; die Seiten der Schüler dürfen Fotos enthalten.)
 */
function pruefeSeite(roh: unknown, mitBildern: boolean): Seite | null {
  // pruefeTafel wirft Ungültiges still weg und ersetzt es durch eine leere Seite: also Form und Kennung vorher prüfen
  if (typeof roh !== 'object' || roh === null) return null
  const r = roh as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id || !Array.isArray(r.elemente)) return null
  const t = pruefeTafel({ ...neuesTafelbild(), seiten: [roh] })
  const s = t?.seiten[0]
  if (!s || s.id !== r.id) return null
  const { hintergrund: _weg, ...rest } = s
  return { ...rest, elemente: mitBildern ? s.elemente : s.elemente.filter((e) => e.art !== 'bild') }
}

/** Seite ohne Bilder und Hintergrund (Vorlage) */
export const pruefeSchuelerSeite = (roh: unknown): Seite | null => pruefeSeite(roh, false)
/** Seite eines Schülers: Striche, Texte, Formen, Tabellen und Fotos (als Bild-Elemente mit Kennung der Datei) */
export const pruefeAbgabeSeite = (roh: unknown): Seite | null => pruefeSeite(roh, true)

export type Platz = { platz: string; vorname: string; nachname: string; /** Platz für Schüler, die nicht in der Liste stehen */ gast?: true }

/** Inhalt der verschlüsselten Sitzungsdaten: Klasse, Plätze mit Namen, auf Wunsch eine Vorlage als Hintergrund */
export type Sitzungsdaten = { schema: typeof SITZUNG_SCHEMA; version: typeof SITZUNG_VERSION; klasse: string; plaetze: Platz[]; vorlage?: Seite }

/** Plätze für alle Schüler der Klasse (nach Namen sortiert), jeder mit neuer, zufälliger Platzkennung – nicht die Schülerkennung */
export function neuePlaetze(schueler: Schueler[], gaeste = 0): Platz[] {
  const namen = namenSortiert(pruefeSchueler(schueler)).map((s): Platz => ({ platz: neueId(), vorname: s.vorname, nachname: s.nachname }))
  const anzahl = Math.max(0, Math.min(MAX_GAESTE, Math.floor(Number.isFinite(gaeste) ? gaeste : 0)))
  const gaesteListe = Array.from({ length: anzahl }, (_, i): Platz => ({ platz: neueId(), vorname: 'Gast', nachname: String(i + 1), gast: true }))
  return [...namen, ...gaesteListe]
}

export function neueSitzungsdaten(klasse: string, schueler: Schueler[], vorlage?: Seite, gaeste = 0): Sitzungsdaten {
  const v = vorlage ? pruefeSchuelerSeite(vorlage) : null
  return { schema: SITZUNG_SCHEMA, version: SITZUNG_VERSION, klasse: klasse.slice(0, 80), plaetze: neuePlaetze(schueler, gaeste), ...(v ? { vorlage: v } : {}) }
}

/** Prüft entschlüsselte Sitzungsdaten; null bei allem Unbrauchbaren */
export function pruefeSitzungsdaten(roh: unknown): Sitzungsdaten | null {
  if (typeof roh !== 'object' || roh === null) return null
  const r = roh as Record<string, unknown>
  if (r.schema !== SITZUNG_SCHEMA || r.version !== SITZUNG_VERSION || typeof r.klasse !== 'string' || !Array.isArray(r.plaetze)) return null
  const gesehen = new Set<string>()
  const plaetze: Platz[] = []
  for (const x of r.plaetze) {
    if (typeof x !== 'object' || x === null) continue
    const p = x as Record<string, unknown>
    if (typeof p.platz !== 'string' || !KENNUNG.test(p.platz) || gesehen.has(p.platz)) continue
    const vorname = typeof p.vorname === 'string' ? p.vorname.slice(0, 40) : ''
    const nachname = typeof p.nachname === 'string' ? p.nachname.slice(0, 40) : ''
    if (!vorname && !nachname) continue
    gesehen.add(p.platz)
    plaetze.push({ platz: p.platz, vorname, nachname, ...(p.gast === true ? { gast: true as const } : {}) })
    if (plaetze.length >= MAX_PLAETZE) break
  }
  const vorlage = r.vorlage === undefined ? null : pruefeSchuelerSeite(r.vorlage)
  return { schema: SITZUNG_SCHEMA, version: SITZUNG_VERSION, klasse: r.klasse.slice(0, 80), plaetze, ...(vorlage ? { vorlage } : {}) }
}

export const verschluesseleSitzung = (schluessel: CryptoKey, daten: Sitzungsdaten): Promise<Box> => verschluessele(schluessel, daten)

export async function oeffneSitzung(schluessel: CryptoKey, box: Box): Promise<Sitzungsdaten | null> {
  try {
    return pruefeSitzungsdaten(await entschluessele(schluessel, box))
  } catch {
    return null
  }
}

/** Anzeigename eines Platzes: „Vorname Nachname“ */
export const platzName = (p: Pick<Platz, 'vorname' | 'nachname'>): string => [p.vorname, p.nachname].filter(Boolean).join(' ')

export type Abgabe = { schema: typeof ABGABE_SCHEMA; version: typeof SITZUNG_VERSION; platz: string; stand: number; seite: Seite }

/**
 * Verschlüsselt die Seite eines Schülers. Die Platzkennung steckt im Inhalt, damit der Server keine Seite unter
 * einem fremden Platz unterschieben kann; `stand` zählt hoch, damit ein älterer Stand einen neueren nie ersetzt.
 * Wirft, wenn die Seite ungültig oder zu groß ist.
 */
export async function verschluesseleAbgabe(schluessel: CryptoKey, platz: string, seite: Seite, stand: number): Promise<Box> {
  const sauber = pruefeAbgabeSeite(seite)
  if (!sauber || !KENNUNG.test(platz)) throw new Error('Ungültige Seite')
  const abgabe: Abgabe = { schema: ABGABE_SCHEMA, version: SITZUNG_VERSION, platz, stand, seite: sauber }
  if (JSON.stringify(abgabe).length > MAX_ABGABE_ZEICHEN) throw new Error('Seite zu groß')
  return verschluessele(schluessel, abgabe)
}

/** Entschlüsselt und prüft eine Abgabe; null bei falschem Schlüssel, veränderten Daten oder fremdem Platz */
export async function oeffneAbgabe(schluessel: CryptoKey, box: Box, platz: string): Promise<Abgabe | null> {
  try {
    const r = (await entschluessele(schluessel, box)) as Record<string, unknown> | null
    if (!r || r.schema !== ABGABE_SCHEMA || r.version !== SITZUNG_VERSION || r.platz !== platz) return null
    if (typeof r.stand !== 'number' || !Number.isFinite(r.stand)) return null
    const seite = pruefeAbgabeSeite(r.seite)
    return seite ? { schema: ABGABE_SCHEMA, version: SITZUNG_VERSION, platz, stand: r.stand, seite } : null
  } catch {
    return null
  }
}

// ---------- Fotos ----------
/** Obergrenze für ein verschlüsseltes Foto (Zeichen Base64); der Server prüft dasselbe */
export const MAX_BILD_ZEICHEN = 2_500_000

/**
 * Verschlüsselt die Bytes eines Fotos. Platz und Kennung des Bildes sind als zusätzliche Angabe gebunden: Der Server
 * kann ein Foto weder unter einem anderen Platz noch unter einer anderen Kennung unterschieben.
 */
export async function verschluesseleBild(schluessel: CryptoKey, platz: string, bildId: string, bytes: ArrayBuffer | Uint8Array): Promise<Box> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`bild/${platz}/${bildId}`) }, schluessel, bytes as BufferSource)
  const box = { iv: b64(iv), daten: b64(ct) }
  if (box.daten.length > MAX_BILD_ZEICHEN) throw new Error('Das Foto ist zu groß.')
  return box
}

/** Entschlüsselt ein Foto; null bei falschem Schlüssel, veränderten Daten oder fremdem Platz */
export async function oeffneBild(schluessel: CryptoKey, box: Box, platz: string, bildId: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: new TextEncoder().encode(`bild/${platz}/${bildId}`) }, schluessel, unb64(box.daten))
    return new Uint8Array(klar)
  } catch {
    return null
  }
}

/** Neuer Stand gilt nur, wenn er höher ist als der gespeicherte */
export const istNeuerStand = (neu: number, alt: number | undefined): boolean => Number.isFinite(neu) && (alt === undefined || neu > alt)

// ---------- Übernehmen auf die Klassentafel ----------
const datumText = (d: Date): string => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

/**
 * Ausgewählte Schülerseiten als neue Seiten für die Klassentafel: alles mit neuen Kennungen, oben links die
 * Beschriftung „Name, Datum“ (kleine graue Schrift). Die Seiten selbst fügt die Tafel über `befehle.ts` ein.
 */
export function seitenFuerKlassentafel(abgaben: { name: string; seite: Seite }[], datum: Date): Seite[] {
  return abgaben.map(({ name, seite }) => {
    const beschriftung: Text = { art: 'text', id: neueId(), x: 24, y: 24, text: `${name}, ${datumText(datum)}`.slice(0, 120), groesse: 18, farbe: '#6b7280' }
    const { id: _id, elemente, ...rest } = seite
    const neu: Seite = { ...neueSeite(kopiere(elemente) as Element[]), ...rest }
    return { ...neu, elemente: [...neu.elemente, beschriftung] }
  })
}

// ---------- Übersicht der Lehrkraft ----------
/** So lange nach der letzten Änderung gilt ein Platz als „schreibt gerade“ */
export const SCHREIBT_SEKUNDEN = 60

export type PlatzStatus = 'frei' | 'angemeldet' | 'schreibt' | 'hat-geschrieben'
export type PlatzZeile = { platz: string; name: string; status: PlatzStatus; stand: number; gast?: true }
export type AbgabeStandZeile = { platz: string; belegt: boolean; stand: number; geaendert_am: string }

/** Eine Zeile je Platz in der Reihenfolge der Namensliste: frei, angemeldet, schreibt gerade oder hat geschrieben */
export function platzZeilen(plaetze: Platz[], staende: AbgabeStandZeile[], jetzt: Date): PlatzZeile[] {
  const nachPlatz = new Map(staende.map((s) => [s.platz, s]))
  return plaetze.map((p) => {
    const s = nachPlatz.get(p.platz)
    const name = platzName(p)
    const gast = p.gast ? { gast: true as const } : {}
    if (!s || !s.belegt) return { platz: p.platz, name, status: 'frei', stand: s?.stand ?? 0, ...gast }
    if (s.stand <= 0) return { platz: p.platz, name, status: 'angemeldet', stand: 0, ...gast }
    const her = (jetzt.getTime() - new Date(s.geaendert_am).getTime()) / 1000
    return { platz: p.platz, name, status: her < SCHREIBT_SEKUNDEN ? 'schreibt' : 'hat-geschrieben', stand: s.stand, ...gast }
  })
}

/** Auf dem Gerät der Lehrkraft gemerkt, damit sie die Freigabe nach einem Neuladen wiederfindet (der Schlüssel steht sonst nur im QR-Code) */
export type FreigabeMerk = { code: string; schluessel: string }
export function pruefeFreigabeMerk(roh: unknown): FreigabeMerk | null {
  if (typeof roh !== 'object' || roh === null) return null
  const r = roh as Record<string, unknown>
  return istSitzungsCode(r.code) && istSitzungsSchluessel(r.schluessel) ? { code: r.code, schluessel: r.schluessel } : null
}
