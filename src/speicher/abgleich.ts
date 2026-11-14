// Abgleich der Klassen zwischen den Geräten und mit dem Notenbuch – Ende-zu-Ende verschlüsselt.
//   Tresor „namen“   (schreibt das Notenbuch): Lerngruppen mit Vor- und Nachnamen, keine Noten
//   Tresor „klassen“ (schreibt Lehrraum):      alle Klassen mit Vorlage, Namen der selbst angelegten, Löschungen
// Beide sind mit dem Passwort des Notenbuchs verschlüsselt. Es wird einmal je Gerät abgefragt; gespeichert wird
// nur der daraus abgeleitete, nicht exportierbare Schlüssel (IndexedDB, Lager „einstellungen“) – nie das Passwort.
// Ohne Server, ohne Anmeldung oder ohne Passwort bleiben die Klassen einfach auf diesem Gerät.
import {
  fuehreZusammen,
  gleicheMitNotenbuchAb,
  klassenTresor,
  pruefeGeloescht,
  pruefeKlassenTresor,
  pruefeNamensliste,
  type Geloescht,
  type KlassenTresor,
  type NotenbuchKlasse,
} from '../kern/klassen.ts'
import { entschluessele, leiteSchluesselAb, neuesSalz, verschluessele } from '../kern/tresor.ts'
import { ladeKlassen, loescheKlasse, speichereKlasse, vorgang } from './datenbank.ts'
import { istAngemeldet, ladeTresor, serverVorhanden, speichereTresor, TresorKonflikt, type TresorArt, type TresorZeile } from './server.ts'

const SCHLUESSEL = 'tresor-schluessel'
const GELOESCHT = 'klassen-geloescht'

type Gespeichert = { salt: string; key: CryptoKey }
/** `ersetze`: Der Klassen-Tresor auf dem Server (diese Fassung) ist mit einem alten Passwort verschlüsselt und wird überschrieben. */
type Schluessel = { namen?: Gespeichert; klassen?: Gespeichert & { ersetze?: number } }

export type Stand = 'ohne-server' | 'abgemeldet' | 'gesperrt' | 'laeuft' | 'bereit' | 'fehler'
export type AbgleichInfo = { stand: Stand; zuletzt: Date | null; meldung: string; notenbuch: boolean }

let info: AbgleichInfo = { stand: serverVorhanden() ? 'abgemeldet' : 'ohne-server', zuletzt: null, meldung: '', notenbuch: false }
const zuhoerer = new Set<(i: AbgleichInfo) => void>()

function setze(neu: Partial<AbgleichInfo>) {
  info = { ...info, ...neu }
  for (const z of zuhoerer) z(info)
}
export const abgleichInfo = (): AbgleichInfo => info
/** Meldet jede Änderung des Abgleich-Stands; liefert die Funktion zum Abbestellen. */
export function beiAbgleich(tun: (i: AbgleichInfo) => void): () => void {
  zuhoerer.add(tun)
  return () => zuhoerer.delete(tun)
}

// ---------- Gespeicherte Schlüssel und Löschungen ----------
async function ladeSchluessel(): Promise<Schluessel> {
  const s = await vorgang<unknown>('einstellungen', 'readonly', (l) => l.get(SCHLUESSEL))
  if (typeof s !== 'object' || s === null) return {}
  const ok = (g: unknown): g is Gespeichert => typeof g === 'object' && g !== null && typeof (g as Gespeichert).salt === 'string' && (g as Gespeichert).key instanceof CryptoKey
  const r = s as Schluessel
  return { ...(ok(r.namen) ? { namen: r.namen } : {}), ...(ok(r.klassen) ? { klassen: r.klassen } : {}) }
}
const merkeSchluessel = (s: Schluessel) => vorgang('einstellungen', 'readwrite', (l) => l.put(s, SCHLUESSEL))

/** Vergisst die Schlüssel auf diesem Gerät (z. B. beim Abmelden). Die Klassen bleiben hier. */
export async function vergissSchluessel(): Promise<void> {
  await vorgang('einstellungen', 'readwrite', (l) => l.delete(SCHLUESSEL))
  setze({ stand: serverVorhanden() ? 'gesperrt' : 'ohne-server', notenbuch: false })
}

async function ladeGeloescht(): Promise<Geloescht[]> {
  return pruefeGeloescht(await vorgang<unknown>('einstellungen', 'readonly', (l) => l.get(GELOESCHT)))
}
const speichereGeloescht = (g: Geloescht[]) => vorgang('einstellungen', 'readwrite', (l) => l.put(g, GELOESCHT))

/** Vermerkt eine hier gelöschte Klasse, damit sie auch auf den anderen Geräten verschwindet. */
export async function merkeGeloescht(id: string): Promise<void> {
  const alt = (await ladeGeloescht()).filter((g) => g.id !== id)
  await speichereGeloescht([...alt, { id, am: new Date().toISOString() }])
}

// ---------- Passwort ----------
class Gesperrt extends Error {}

async function oeffne(zeile: TresorZeile, s: Gespeichert | undefined): Promise<unknown> {
  if (!s || s.salt !== zeile.salt) throw new Gesperrt()
  try {
    return await entschluessele(s.key, { iv: zeile.iv, daten: zeile.daten })
  } catch {
    throw new Gesperrt() // anderes Passwort (z. B. im Notenbuch geändert)
  }
}

async function versuche(pw: string, zeile: TresorZeile): Promise<Gespeichert | null> {
  const key = await leiteSchluesselAb(pw, zeile.salt)
  try {
    await entschluessele(key, { iv: zeile.iv, daten: zeile.daten })
    return { salt: zeile.salt, key }
  } catch {
    return null
  }
}

/**
 * Entsperrt den Abgleich auf diesem Gerät mit dem Passwort des Notenbuchs.
 * Gibt es schon eine Namensliste des Notenbuchs, muss das Passwort zu ihr passen; sonst zum Klassen-Tresor.
 * Liefert eine Fehlermeldung oder null.
 */
export async function entsperre(pw: string): Promise<string | null> {
  if (!pw) return 'Bitte das Passwort eingeben.'
  try {
    const [namen, klassen] = await Promise.all([ladeTresor('namen'), ladeTresor('klassen')])
    const neu: Schluessel = {}
    if (namen) {
      const s = await versuche(pw, namen)
      if (!s) return 'Das Passwort passt nicht zum Notenbuch.'
      neu.namen = s
    }
    const s = klassen ? await versuche(pw, klassen) : null
    if (s) neu.klassen = s
    else if (klassen && !namen) return 'Das Passwort passt nicht zu den gespeicherten Klassen.'
    else {
      // Noch kein Klassen-Tresor – oder das Notenbuch-Passwort wurde geändert: dann neu verschlüsseln
      // (es gilt der Stand dieses Geräts). Eigenes Salz, damit es ein eigener Schlüssel ist.
      const salt = neuesSalz()
      neu.klassen = { salt, key: await leiteSchluesselAb(pw, salt), ...(klassen ? { ersetze: klassen.rev } : {}) }
    }
    await merkeSchluessel(neu)
  } catch (e) {
    setze({ stand: 'fehler', meldung: 'Keine Verbindung zum Server.' })
    console.warn(e)
    return 'Keine Verbindung zum Server.'
  }
  await gleicheAb()
  return null
}

// ---------- Abgleich ----------
let laeuft: Promise<void> | null = null
let nochmal = false

/** Gleicht ab, wenn möglich. Nie ein Fehler – der Stand steht danach in abgleichInfo(). */
export function gleicheAb(): Promise<void> {
  if (laeuft) {
    nochmal = true
    return laeuft
  }
  laeuft = (async () => {
    await null
    try {
      await einmal()
    } finally {
      laeuft = null
      if (nochmal) {
        nochmal = false
        void gleicheAb()
      }
    }
  })()
  return laeuft
}

async function einmal(): Promise<void> {
  if (!serverVorhanden()) return setze({ stand: 'ohne-server' })
  try {
    if (!(await istAngemeldet())) return setze({ stand: 'abgemeldet', notenbuch: false })
    const s = await ladeSchluessel()
    if (!s.klassen) return setze({ stand: 'gesperrt', notenbuch: false })
    setze({ stand: 'laeuft' })

    for (let versuch = 0; versuch < 3; versuch++) {
      const [namenZeile, klassenZeile] = await Promise.all([ladeTresor('namen'), ladeTresor('klassen')])
      // Namensliste des Notenbuchs (fehlt sie, bleibt alles, wie es ist)
      let notenbuch: NotenbuchKlasse[] | null = null
      if (namenZeile) {
        notenbuch = pruefeNamensliste(await oeffne(namenZeile, s.namen))
        if (!notenbuch) console.warn('Namensliste des Notenbuchs nicht lesbar')
      }
      // Klassen der anderen Geräte
      let server: KlassenTresor | null = null
      const ersetzen = klassenZeile && s.klassen.ersetze === klassenZeile.rev
      if (klassenZeile && !ersetzen) server = pruefeKlassenTresor(await oeffne(klassenZeile, s.klassen))

      const erg = fuehreZusammen(await ladeKlassen(), await ladeGeloescht(), server)
      for (const k of erg.loeschen) await loescheKlasse(k)
      for (const k of erg.speichern) await speichereKlasse(k)
      await speichereGeloescht(erg.geloescht)
      if (notenbuch) {
        const weg = new Set(erg.geloescht.map((g) => g.id))
        for (const k of gleicheMitNotenbuchAb(await ladeKlassen(), notenbuch, weg)) await speichereKlasse(k)
      }

      const neu = klassenTresor(await ladeKlassen(), erg.geloescht)
      const bisher = server ? JSON.stringify(klassenTresor(server.klassen, server.geloescht)) : null
      if (JSON.stringify(neu) !== bisher || !klassenZeile || klassenZeile.salt !== s.klassen.salt) {
        const box = await verschluessele(s.klassen.key, neu)
        try {
          await speichereTresor('klassen' satisfies TresorArt, klassenZeile?.rev ?? 0, s.klassen.salt, box.iv, box.daten)
        } catch (e) {
          if (e instanceof TresorKonflikt) continue // ein anderes Gerät war schneller: neu laden und zusammenführen
          throw e
        }
        if (s.klassen.ersetze !== undefined) await merkeSchluessel({ ...s, klassen: { salt: s.klassen.salt, key: s.klassen.key } })
      }
      return setze({ stand: 'bereit', zuletzt: new Date(), meldung: '', notenbuch: notenbuch !== null })
    }
    setze({ stand: 'fehler', meldung: 'Mehrere Geräte speichern gerade gleichzeitig – gleich noch einmal versuchen.' })
  } catch (e) {
    if (e instanceof Gesperrt) {
      // Passwort wurde (im Notenbuch) geändert oder der Schlüssel passt nicht mehr: neu fragen
      await vorgang('einstellungen', 'readwrite', (l) => l.delete(SCHLUESSEL))
      return setze({ stand: 'gesperrt', notenbuch: false, meldung: 'Das Passwort wurde geändert. Bitte neu eingeben.' })
    }
    console.warn('Abgleich der Klassen fehlgeschlagen', e)
    setze({ stand: 'fehler', meldung: 'Keine Verbindung zum Server – die Klassen bleiben vorerst auf diesem Gerät.' })
  }
}
