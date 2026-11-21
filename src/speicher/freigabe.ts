// Freigabe einer Klasse für Schülerseiten, Seite der Lehrkraft: starten, wiederfinden, Seiten der Schüler abrufen.
// Alles Verschlüsselte wird hier auf dem Gerät ver- und entschlüsselt; der Server sieht nur Code, Zeit und Platzkennungen.
import {
  MAX_VORLAGE_BILDER, VORLAGE_PLATZ, bildTyp, mitmachenAdresse, neueSitzungsdaten, neuerSitzungsCode, neuerSitzungsSchluessel, oeffneAbgabe, oeffneBild, oeffneSitzung, pruefeFreigabeMerk, sitzungsSchluessel, verschluesseleBild, verschluesseleSitzung, zeitraum,
  type FreigabeMerk, type Sitzungsdaten,
} from '../kern/sitzung.ts'
import type { Schueler } from '../kern/klassen.ts'
import { benutzteDateien, type Seite } from '../kern/modell.ts'
import { bytesVon, ladeDatei, ladeDateiEintrag, legeDateiAb } from './dateien.ts'
import { ladeAbgabeStaende, ladeAbgabeZeile, ladeBildZeile, ladeSitzungZeile, legeSitzungAn, loescheSitzung, setzeSitzungEnde, vorlageBildLaden, vorlageBildSpeichern, type AbgabeStand } from './server.ts'

export type Freigabe = { code: string; schluesselText: string; schluessel: CryptoKey; daten: Sitzungsdaten; beginn: string; ende: string }

const merkName = (klasseId: string) => `lehrraum-freigabe-${klasseId}`

// ---------- Merken (nur auf diesem Gerät, nur Code und Schlüssel; beides wird mit der Freigabe wertlos) ----------
export function gemerkteFreigabe(klasseId: string): FreigabeMerk | null {
  try {
    return pruefeFreigabeMerk(JSON.parse(window.localStorage.getItem(merkName(klasseId)) ?? 'null'))
  } catch {
    return null
  }
}
export function merkeFreigabe(klasseId: string, m: FreigabeMerk): void {
  try {
    window.localStorage.setItem(merkName(klasseId), JSON.stringify(m))
  } catch {
    /* ohne Speicher findet die Lehrkraft die Freigabe nach dem Neuladen nicht wieder – der QR-Code funktioniert weiter */
  }
}
export function vergissFreigabe(klasseId: string): void {
  try {
    window.localStorage.removeItem(merkName(klasseId))
  } catch {
    /* nichts zu tun */
  }
}

/** Adresse der Schülerseite für den QR-Code: Schlüssel und Code stehen nur hinter dem # */
export const freigabeAdresse = (f: Pick<Freigabe, 'code' | 'schluesselText'>): string =>
  mitmachenAdresse(`${window.location.origin}${window.location.pathname}`, f.code, f.schluesselText)

// ---------- Starten und Wiederfinden ----------
/** Legt eine Freigabe an: Namensliste (und Vorlage) verschlüsselt, Plätze zufällig, Zeit in Minuten ab jetzt */
/** gaeste: zusätzliche Plätze „Gast 1“, „Gast 2“ … für Schüler, die nicht in der Liste stehen */
export async function starteFreigabe(klasseId: string, klasse: string, schueler: Schueler[], minuten: number, vorlage?: Seite, gaeste = 0): Promise<Freigabe> {
  const code = neuerSitzungsCode()
  const schluesselText = neuerSitzungsSchluessel()
  const schluessel = await sitzungsSchluessel(schluesselText)
  const daten = neueSitzungsdaten(klasse, schueler, vorlage, gaeste)
  if (!daten.plaetze.length) throw new Error('Die Klasse hat noch keine Namen.')
  // Bilder und PDF-Seiten des Aufgabenblatts: zuerst alle verschlüsseln (so scheitert zu Große schon vor dem Anlegen)
  const dateiIds = daten.vorlage ? [...benutzteDateien([daten.vorlage])] : []
  if (dateiIds.length > MAX_VORLAGE_BILDER) throw new Error(`Das Aufgabenblatt hat zu viele Bilder (höchstens ${MAX_VORLAGE_BILDER}).`)
  const bilder: { id: string; iv: string; daten: string }[] = []
  for (const id of dateiIds) {
    const blob = await ladeDatei(id)
    if (!blob) throw new Error('Ein Bild des Aufgabenblatts ist auf diesem Gerät nicht verfügbar.')
    bilder.push({ id, ...(await verschluesseleBild(schluessel, VORLAGE_PLATZ, id, await bytesVon(blob))) })
  }
  const z = zeitraum(new Date(), minuten)
  const box = await verschluesseleSitzung(schluessel, daten)
  await legeSitzungAn(code, z.ende, box.iv, box.daten, daten.plaetze.map((p) => p.platz))
  try {
    for (const b of bilder) await vorlageBildSpeichern(code, b.id, b.iv, b.daten)
  } catch (fehler) {
    await loescheSitzung(code).catch(() => undefined) // lieber keine Freigabe als eine mit unvollständigem Aufgabenblatt
    throw fehler
  }
  merkeFreigabe(klasseId, { code, schluessel: schluesselText })
  return { code, schluesselText, schluessel, daten, beginn: z.beginn, ende: z.ende }
}

/** Lädt eine gemerkte Freigabe vom Server; null (und vergessen), wenn es sie nicht mehr gibt */
export async function ladeFreigabe(klasseId: string): Promise<Freigabe | null> {
  const m = gemerkteFreigabe(klasseId)
  if (!m) return null
  const zeile = await ladeSitzungZeile(m.code)
  const schluessel = await sitzungsSchluessel(m.schluessel)
  const daten = zeile && (await oeffneSitzung(schluessel, { iv: zeile.iv, daten: zeile.daten }))
  if (!zeile || !daten) {
    vergissFreigabe(klasseId)
    return null
  }
  return { code: m.code, schluesselText: m.schluessel, schluessel, daten, beginn: zeile.beginn, ende: zeile.ende }
}

/** Neues Ende (verlängern oder jetzt beenden) */
export const aendereEnde = (f: Freigabe, ende: string): Promise<void> => setzeSitzungEnde(f.code, ende)

/** Löscht die Freigabe samt aller Schülerseiten sofort und vergisst sie auf diesem Gerät */
export async function beendeUndLoesche(klasseId: string, f: Freigabe): Promise<void> {
  await loescheSitzung(f.code)
  vergissFreigabe(klasseId)
}

// ---------- Abrufen ----------
/** Zuletzt entschlüsselte Seiten je Platz mit ihrem Stand – nur neuere Stände werden noch einmal geholt */
export type AbgabeCache = Map<string, { stand: number; seite: Seite }>

/** Legt die Fotos einer Schülerseite im Gerätespeicher ab (entschlüsselt). true, wenn noch eines fehlt. */
async function holeFotos(f: Freigabe, platz: string, seite: Seite): Promise<boolean> {
  let fehlt = false
  const vorlageIds = f.daten.vorlage ? benutzteDateien([f.daten.vorlage]) : new Set<string>()
  for (const id of benutzteDateien([seite])) {
    if (await ladeDateiEintrag(id)) continue
    // Bild des Aufgabenblatts, das hier nicht mehr liegt (etwa weil die Seite inzwischen gelöscht wurde): vom Server
    const vorlage = vorlageIds.has(id)
    const z = vorlage ? await vorlageBildLaden(f.code, id) : await ladeBildZeile(f.code, platz, id)
    const bytes = z && (await oeffneBild(f.schluessel, { iv: z.iv, daten: z.daten }, vorlage ? VORLAGE_PLATZ : platz, id))
    if (!bytes) {
      fehlt = true
      continue
    }
    await legeDateiAb(id, new Blob([bytes], { type: bildTyp(bytes) }))
  }
  return fehlt
}

/** Holt den Stand aller Plätze und lädt dazu nur die Seiten, die neuer sind als im Cache */
export async function aktualisiereAbgaben(f: Freigabe, cache: AbgabeCache): Promise<AbgabeStand[]> {
  const staende = await ladeAbgabeStaende(f.code)
  for (const s of staende) {
    if (s.stand <= 0 || s.stand <= (cache.get(s.platz)?.stand ?? 0)) continue
    const zeile = await ladeAbgabeZeile(f.code, s.platz)
    if (!zeile?.iv || !zeile.daten) continue
    const a = await oeffneAbgabe(f.schluessel, { iv: zeile.iv, daten: zeile.daten }, s.platz)
    if (!a) continue
    // Fotos der Seite zuerst auf dieses Gerät holen (sonst zeigt die Vorschau Lücken); fehlt eines, später noch einmal
    if (await holeFotos(f, s.platz, a.seite)) continue
    cache.set(s.platz, { stand: a.stand, seite: a.seite })
  }
  return staende
}
