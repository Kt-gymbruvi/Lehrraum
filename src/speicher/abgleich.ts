// Abgleich der Klassen zwischen den Geräten und mit dem Notenbuch – Ende-zu-Ende verschlüsselt.
//   Tresor „namen“   (schreibt das Notenbuch): Lerngruppen mit Vor- und Nachnamen, keine Noten
//   Tresor „klassen“ (schreibt Lehrraum):      alle Klassen mit Vorlage, Namen der selbst angelegten, Löschungen
// Beide sind mit dem Passwort des Notenbuchs verschlüsselt (je eigenes Salz). Das Passwort wird einmal je Gerät
// abgefragt – hier, im Notenbuch oder auf der Startseite – und liegt danach als nicht exportierbarer Grundschlüssel im
// gemeinsamen Schlüsselbund (schluesselbund.ts), nie im Klartext. Abmelden löscht den Bund.
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
import { entschluessele, neuesSalz, verschluessele } from '../kern/tresor.ts'
import { ladeKlassen, loescheKlasse, speichereKlasse, vorgang } from './datenbank.ts'
import { basisAus, ladeBund, loescheBund, schluesselAus, speichereBund, type Bund } from './schluesselbund.ts'
import { istAngemeldet, ladeTresor, serverVorhanden, sitzungGespeichert, speichereTresor, TresorKonflikt, type TresorArt, type TresorZeile } from './server.ts'

const ALTER_SCHLUESSEL = 'tresor-schluessel' // bis Etappe B: Schlüssel nur für Lehrraum (wird beim Start entfernt)
const GELOESCHT = 'klassen-geloescht'

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

// ---------- Schlüsselbund und Löschungen ----------
/** „Auf diesem Gerät sperren“: löscht den Schlüsselbund – auch das Notenbuch fragt dann wieder nach dem Passwort. Die Klassen bleiben hier. */
export async function vergissSchluessel(): Promise<void> {
  await loescheBund()
  setze({ stand: serverVorhanden() ? 'gesperrt' : 'ohne-server', notenbuch: false, meldung: '' })
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

/** Öffnet einen Tresor mit dem Bund; null, wenn das Passwort nicht passt */
async function oeffne(zeile: TresorZeile, bund: Bund): Promise<unknown> {
  try {
    return await entschluessele(await schluesselAus(bund, zeile.salt), { iv: zeile.iv, daten: zeile.daten })
  } catch {
    return undefined
  }
}

/**
 * Entsperrt den Abgleich auf diesem Gerät mit dem Passwort des Notenbuchs und legt den Schlüsselbund an.
 * Geprüft wird an der Namensliste des Notenbuchs, sonst am Klassen-Tresor, sonst am Notenbuch selbst.
 * Gibt es noch nichts davon, legt dieses Passwort das Notenbuch-Passwort fest – das verlangt `neu` (zweimal eingegeben).
 * Liefert eine Fehlermeldung, 'neu' (bitte bestätigen lassen) oder null.
 */
export async function entsperre(pw: string, { neu = false }: { neu?: boolean } = {}): Promise<string | 'neu' | null> {
  if (!pw) return 'Bitte das Passwort eingeben.'
  try {
    const basis = await basisAus(pw)
    const probe: Bund = { version: 1, basis, am: 'probe-' + Math.random() }
    const [namen, klassen] = await Promise.all([ladeTresor('namen'), ladeTresor('klassen')])
    if (namen) {
      if ((await oeffne(namen, probe)) === undefined) return 'Das Passwort passt nicht zum Notenbuch.'
    } else if (klassen) {
      if ((await oeffne(klassen, probe)) === undefined) return 'Das Passwort passt nicht zu den gespeicherten Klassen.'
    } else {
      const notenbuch = await ladeTresor('notenbuch')
      if (notenbuch) {
        if ((await oeffne(notenbuch, probe)) === undefined) return 'Das Passwort passt nicht zum Notenbuch.'
      } else if (!neu) return 'neu'
      else if (pw.length < 8) return 'Mindestens 8 Zeichen.'
    }
    await speichereBund(basis)
  } catch (e) {
    setze({ stand: 'fehler', meldung: 'Keine Verbindung zum Server.' })
    console.warn(e)
    return 'Keine Verbindung zum Server.'
  }
  setze({ meldung: '' })
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

let alterSchluesselWeg = false

async function einmal(): Promise<void> {
  if (!serverVorhanden()) return setze({ stand: 'ohne-server' })
  try {
    if (!alterSchluesselWeg) {
      await vorgang('einstellungen', 'readwrite', (l) => l.delete(ALTER_SCHLUESSEL))
      alterSchluesselWeg = true
    }
    if (!(await istAngemeldet())) {
      // Abgemeldet (hier oder in einer anderen Anwendung der Plattform): Schlüsselbund weg.
      // Nur wenn die Anmeldung wirklich fehlt – nicht, wenn sie bloß ohne Netz nicht erneuert werden konnte.
      if (!sitzungGespeichert()) await loescheBund()
      return setze({ stand: 'abgemeldet', notenbuch: false })
    }
    const bund = await ladeBund()
    if (!bund) return setze({ stand: 'gesperrt', notenbuch: false })
    setze({ stand: 'laeuft' })

    for (let versuch = 0; versuch < 3; versuch++) {
      const [namenZeile, klassenZeile] = await Promise.all([ladeTresor('namen'), ladeTresor('klassen')])
      // Namensliste des Notenbuchs (fehlt sie, bleibt alles, wie es ist). Sie gilt: Passt der Bund nicht, ist er veraltet.
      let notenbuch: NotenbuchKlasse[] | null = null
      if (namenZeile) {
        const inhalt = await oeffne(namenZeile, bund)
        if (inhalt === undefined) throw new Gesperrt()
        notenbuch = pruefeNamensliste(inhalt)
        if (!notenbuch) console.warn('Namensliste des Notenbuchs nicht lesbar')
      }
      // Klassen der anderen Geräte. Passen sie nicht, obwohl die Namensliste passt, wurde das Passwort im Notenbuch
      // geändert: dann gilt der Stand dieses Geräts und der Tresor wird mit neuem Salz neu verschlüsselt.
      let server: KlassenTresor | null = null
      let salz = klassenZeile?.salt ?? neuesSalz()
      if (klassenZeile) {
        const inhalt = await oeffne(klassenZeile, bund)
        if (inhalt !== undefined) server = pruefeKlassenTresor(inhalt)
        else if (namenZeile) salz = neuesSalz()
        else throw new Gesperrt()
      }

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
      if (JSON.stringify(neu) !== bisher || !klassenZeile || klassenZeile.salt !== salz) {
        const box = await verschluessele(await schluesselAus(bund, salz), neu)
        try {
          await speichereTresor('klassen' satisfies TresorArt, klassenZeile?.rev ?? 0, salz, box.iv, box.daten)
        } catch (e) {
          if (e instanceof TresorKonflikt) continue // ein anderes Gerät war schneller: neu laden und zusammenführen
          throw e
        }
      }
      return setze({ stand: 'bereit', zuletzt: new Date(), meldung: '', notenbuch: notenbuch !== null })
    }
    setze({ stand: 'fehler', meldung: 'Mehrere Geräte speichern gerade gleichzeitig – gleich noch einmal versuchen.' })
  } catch (e) {
    if (e instanceof Gesperrt) {
      // Das Passwort wurde (im Notenbuch) geändert: Der Bund ist veraltet – weg damit, einmal neu fragen
      await loescheBund()
      return setze({ stand: 'gesperrt', notenbuch: false, meldung: 'Das Passwort wurde geändert. Bitte neu eingeben.' })
    }
    console.warn('Abgleich der Klassen fehlgeschlagen', e)
    setze({ stand: 'fehler', meldung: 'Keine Verbindung zum Server – die Klassen bleiben vorerst auf diesem Gerät.' })
  }
}
