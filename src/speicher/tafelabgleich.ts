// Tafeln auf allen Geräten (SPEC-tafeln-abgleich-pdf-tabelle, Etappe C) – Ende-zu-Ende verschlüsselt.
//   lr_tafeln   – je Tafel eine Zeile: „frei“ oder „k-<Klasse>“; Inhalt verschlüsselt mit dem Tafel-Schlüssel
//   lr-dateien  – Bilder und PDF-Seiten, je Datei einmal, ebenfalls verschlüsselt
// Abgeglichen wird nur der Inhalt (Titel, Format, Seiten). Ansicht, gezeigte Seite und offene Fenster bleiben je Gerät.
// Haben zwei Geräte dieselbe Tafel geändert, gilt die zuletzt geänderte – kein Zusammenführen. Nur wenn auf
// zwei Geräten schon vor dem ersten Abgleich eine eigene Tafel derselben Klasse bestand, hängt die ältere als
// „Ältere Tafel …“ hinten an, damit nichts verloren geht.
import { STANDARD_EINSTELLUNGEN } from '../kern/einstellungen.ts'
import { benutzteDateien, MAX_SEITEN, neueId, pruefeTafel, TAFEL_SCHEMA, TAFEL_VERSION, type Seite, type Tafelbild } from '../kern/modell.ts'
import { b64, unb64 } from '../kern/tresor.ts'
import { abgleichInfo, gleicheAb, tafelSchluessel } from './abgleich.ts'
import { ladeAlleTafeln, vorgang } from './datenbank.ts'
import { ladeDateiEintrag, setzeNachladen, type Datei } from './dateien.ts'
import {
  holeDatei,
  istAngemeldet,
  ladeAlleTafelZeilen,
  ladeDateiHoch,
  ladeTafelRev,
  ladeTafelZeile,
  listeDateien,
  loescheDateien,
  serverVorhanden,
  speichereTafelZeile,
  TresorKonflikt,
  type TafelZeile,
} from './server.ts'

const STAND = 'tafel-abgleich' // je Tafel: zuletzt abgeglichene Fassung und Prüfsumme des Inhalts
const HOCHGELADEN = 'dateien-hochgeladen' // Kennungen der Dateien, die schon auf dem Server liegen
const AUFGERAEUMT = 'dateien-aufgeraeumt' // wann zuletzt auf dem Server aufgeräumt wurde

export const kennungFuer = (klasseId?: string): string => (klasseId ? 'k-' + klasseId : 'frei')

type Inhalt = Pick<Tafelbild, 'titel' | 'format' | 'seiten' | 'geaendertAm'>
type Verpackt = { schema: 'lehrraum/tafel'; version: number; inhalt: Inhalt }
type Stand = Record<string, { rev: number; pruef: string }>

// ---------- Verschlüsseln ----------
async function verschluessele(key: CryptoKey, daten: Uint8Array<ArrayBuffer>): Promise<{ iv: Uint8Array<ArrayBuffer>; ct: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  return {
    iv,
    ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, daten),
  }
}
const text = new TextEncoder()

async function packe(key: CryptoKey, t: Inhalt): Promise<{ iv: string; daten: string }> {
  const v: Verpackt = {
    schema: 'lehrraum/tafel',
    version: TAFEL_VERSION,
    inhalt: {
      titel: t.titel,
      format: t.format,
      seiten: t.seiten,
      geaendertAm: t.geaendertAm,
    },
  }
  const { iv, ct } = await verschluessele(key, text.encode(JSON.stringify(v)))
  return { iv: b64(iv), daten: b64(ct) }
}

class Unlesbar extends Error {}
class ZuNeu extends Error {}

/** Entschlüsselt und prüft eine Tafel vom Server */
async function packeAus(key: CryptoKey, z: TafelZeile): Promise<Inhalt> {
  let roh: unknown
  try {
    roh = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(z.iv) }, key, unb64(z.daten))))
  } catch {
    throw new Unlesbar()
  }
  const v = roh as Verpackt
  if (typeof v !== 'object' || v === null || v.schema !== 'lehrraum/tafel') throw new Unlesbar()
  if (typeof v.version !== 'number' || v.version > TAFEL_VERSION) throw new ZuNeu()
  const t = pruefeTafel({
    ...v.inhalt,
    schema: TAFEL_SCHEMA,
    version: v.version,
    id: 'server',
    seiteNr: 0,
    kamera: { x: 0, y: 0, zoom: 1 },
    fenster: [],
  })
  if (!t) throw new Unlesbar()
  return {
    titel: t.titel,
    format: t.format,
    seiten: t.seiten,
    geaendertAm: typeof v.inhalt.geaendertAm === 'string' ? v.inhalt.geaendertAm : '',
  }
}

/** Prüfsumme des Inhalts (ohne Zeitpunkt): gleich ⇔ nichts geändert */
async function pruefsumme(t: Pick<Tafelbild, 'titel' | 'format' | 'seiten'>): Promise<string> {
  return b64(await crypto.subtle.digest('SHA-256', text.encode(JSON.stringify([t.titel, t.format, t.seiten]))))
}

// ---------- Stand je Tafel ----------
async function ladeStand(): Promise<Stand> {
  const s = await vorgang<unknown>('einstellungen', 'readonly', (l) => l.get(STAND))
  return typeof s === 'object' && s !== null ? (s as Stand) : {}
}
async function merkeStand(kennung: string, rev: number, pruef: string) {
  const s = await ladeStand()
  await vorgang('einstellungen', 'readwrite', (l) => l.put({ ...s, [kennung]: { rev, pruef } }, STAND))
}

// ---------- Dateien ----------
async function ladeHochgeladen(): Promise<Set<string>> {
  const l = await vorgang<unknown>('einstellungen', 'readonly', (x) => x.get(HOCHGELADEN))
  return new Set(Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : [])
}

/** Datei verschlüsseln: [2 Byte Länge des Typs][Typ][Daten] */
async function packeDatei(key: CryptoKey, d: Datei): Promise<Blob> {
  const typ = text.encode(d.typ.slice(0, 200))
  const daten = new Uint8Array(await d.daten.arrayBuffer())
  const klar = new Uint8Array(2 + typ.length + daten.length)
  klar[0] = typ.length >> 8
  klar[1] = typ.length & 255
  klar.set(typ, 2)
  klar.set(daten, 2 + typ.length)
  const { iv, ct } = await verschluessele(key, klar)
  return new Blob([iv, ct], { type: 'application/octet-stream' })
}

async function packeDateiAus(key: CryptoKey, id: string, b: Blob): Promise<Datei> {
  const roh = new Uint8Array(await b.arrayBuffer())
  const klar = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: roh.slice(0, 12) }, key, roh.slice(12)))
  const n = (klar[0] << 8) | klar[1]
  const typ = new TextDecoder().decode(klar.slice(2, 2 + n))
  return { id, typ, daten: new Blob([klar.slice(2 + n)], { type: typ }) }
}

/** Lädt alle Dateien der Seiten hoch, die noch nicht auf dem Server liegen */
async function ladeDateienHoch(key: CryptoKey, seiten: Seite[]) {
  const schon = await ladeHochgeladen()
  const neu: string[] = []
  for (const id of benutzteDateien(seiten)) {
    if (schon.has(id)) continue
    const d = await ladeDateiEintrag(id)
    if (!d) continue // fehlt auch hier (z. B. noch nicht geholt) – dann hat sie ein anderes Gerät schon hochgeladen
    await ladeDateiHoch(id, await packeDatei(key, d))
    neu.push(id)
  }
  if (neu.length) await vorgang('einstellungen', 'readwrite', (l) => l.put([...schon, ...neu].slice(-5000), HOCHGELADEN))
}

// Fehlende Dateien beim Zeichnen vom Server holen
setzeNachladen(async (id) => {
  if (!serverVorhanden()) return null
  const key = await tafelSchluessel()
  if (!key) return null
  const b = await holeDatei(id)
  return b ? packeDateiAus(key, id, b) : null
})

// ---------- Ältere Tafel anhängen ----------
function geraet(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac/.test(ua)) return 'Mac'
  return 'anderes Gerät'
}

/** Hängt die Seiten der älteren Tafel hinten an, die erste mit einer Beschriftung */
export function mitAelterer(neuere: Inhalt, aeltere: Inhalt, herkunft: string): Inhalt {
  const datum = aeltere.geaendertAm ? new Date(aeltere.geaendertAm).toLocaleDateString('de-DE') : ''
  const platz = MAX_SEITEN - neuere.seiten.length
  if (platz <= 0) return neuere
  const angehaengt = aeltere.seiten.slice(0, platz).map((s, i) =>
    i === 0
      ? {
          ...s,
          elemente: [
            ...s.elemente,
            {
              art: 'text' as const,
              id: neueId(),
              x: 20,
              y: 20,
              text: `Ältere Tafel von ${aeltere.titel} (${herkunft}${datum ? ', ' + datum : ''})`,
              groesse: 24,
              farbe: STANDARD_EINSTELLUNGEN.farbe,
            },
          ],
        }
      : s,
  )
  return { ...neuere, seiten: [...neuere.seiten, ...angehaengt] }
}

const istLeer = (t: Pick<Tafelbild, 'seiten'>) => t.seiten.length === 1 && t.seiten[0].elemente.length === 0 && !t.seiten[0].hintergrund

// ---------- Abgleich einer Tafel ----------
export type Ergebnis =
  | { art: 'nur-hier' } // ohne Anmeldung, Passwort oder Server
  | { art: 'gleich' } // auf allen Geräten derselbe Stand
  /** anderer Stand vom Server: hier zeigen und danach `bestaetige()` – erst dann gilt er als übernommen */
  | { art: 'neu'; inhalt: Inhalt; meldung: string; bestaetige: () => Promise<void> }
  | { art: 'fehler'; meldung: string }

const KEINE_VERBINDUNG: Ergebnis = { art: 'fehler', meldung: 'Keine Verbindung – nur auf diesem Gerät gespeichert' }
const GLEICHZEITIG: Ergebnis = { art: 'fehler', meldung: 'Mehrere Geräte speichern gerade gleichzeitig' }

/**
 * Gleicht eine Tafel ab: lädt die eigene Änderung hoch bzw. liefert den neueren Stand vom Server.
 * `lokal` ist der zuletzt hier gespeicherte Stand.
 */
export async function gleicheTafelAb(kennung: string, lokal: Tafelbild): Promise<Ergebnis> {
  if (!serverVorhanden()) return { art: 'nur-hier' }
  try {
    if (!(await istAngemeldet())) return { art: 'nur-hier' }
    let keyP = tafelSchluessel()
    if (!keyP) {
      await gleicheAb()
      keyP = tafelSchluessel()
    }
    if (!keyP) return abgleichInfo().stand === 'fehler' ? KEINE_VERBINDUNG : { art: 'nur-hier' }
    const key = await keyP
    const pruef = await pruefsumme(lokal)
    const hochladen = async (inhalt: Inhalt, erwartet: number, p: string) => {
      await ladeDateienHoch(key, inhalt.seiten)
      const { iv, daten } = await packe(key, inhalt)
      await merkeStand(kennung, await speichereTafelZeile(kennung, erwartet, iv, daten), p)
    }

    for (let versuch = 0; versuch < 3; versuch++) {
      try {
        const stand = (await ladeStand())[kennung]
        const rev = await ladeTafelRev(kennung)
        if (rev === 0) {
          await hochladen(lokal, 0, pruef) // noch nicht auf dem Server
          return { art: 'gleich' }
        }
        if (stand && stand.rev === rev) {
          // Server unverändert: eigene Änderung hochladen (oder nichts tun)
          if (stand.pruef !== pruef) await hochladen(lokal, rev, pruef)
          return { art: 'gleich' }
        }

        // Auf dem Server liegt ein anderer Stand
        const zeile = await ladeTafelZeile(kennung)
        if (!zeile) continue
        const server = await packeAus(key, zeile)
        const serverPruef = await pruefsumme(server)
        const uebernehmen = (meldung: string): Ergebnis => ({ art: 'neu', inhalt: server, meldung, bestaetige: () => merkeStand(kennung, zeile.rev, serverPruef) })
        if (serverPruef === pruef) {
          await merkeStand(kennung, zeile.rev, pruef)
          return { art: 'gleich' }
        }
        // Hier nichts geändert seit dem letzten Abgleich: den neuen Stand übernehmen
        if (stand && stand.pruef === pruef) return uebernehmen('Auf einem anderen Gerät geändert – neuer Stand geladen')
        const hierNeuer = lokal.geaendertAm > server.geaendertAm
        if (!stand) {
          // Erster Abgleich dieser Tafel auf diesem Gerät
          if (istLeer(lokal)) return uebernehmen('Tafel von einem anderen Gerät geladen')
          if (istLeer(server)) {
            await hochladen(lokal, zeile.rev, pruef)
            return { art: 'gleich' }
          }
          // Auf beiden Seiten eine eigene Tafel: die neuere gilt, die ältere hängt hinten an – nichts geht verloren.
          // Hochgeladen wird erst, wenn die Tafel den zusammengelegten Stand zeigt.
          const zusammen = hierNeuer ? mitAelterer(lokal, server, 'anderes Gerät') : mitAelterer(server, lokal, geraet())
          return {
            art: 'neu',
            inhalt: zusammen,
            meldung: 'Tafeln zusammengelegt – die ältere steht auf den letzten Seiten',
            bestaetige: async () => hochladen(zusammen, zeile.rev, await pruefsumme(zusammen)),
          }
        }
        // Hier und auf einem anderen Gerät geändert: die zuletzt geänderte gilt
        if (hierNeuer) {
          await hochladen(lokal, zeile.rev, pruef)
          return { art: 'gleich' }
        }
        return uebernehmen('Auf einem anderen Gerät geändert – neuer Stand geladen')
      } catch (e) {
        if (e instanceof TresorKonflikt) continue // ein anderes Gerät war schneller: neu vergleichen
        throw e
      }
    }
    return GLEICHZEITIG
  } catch (e) {
    if (e instanceof ZuNeu) return { art: 'fehler', meldung: 'Diese Tafel wurde mit einer neueren Fassung gespeichert – bitte die Seite neu laden' }
    if (e instanceof Unlesbar) return { art: 'fehler', meldung: 'Die Tafel auf dem Server ist nicht lesbar – nur auf diesem Gerät gespeichert' }
    console.warn('Abgleich der Tafel fehlgeschlagen', e)
    return KEINE_VERBINDUNG
  }
}

// ---------- Belegter Speicher und Aufräumen ----------
export const SPEICHER_GRENZE = 1_000_000_000 // kostenloser Supabase-Tarif: 1 GB für Dateien

/** Belegter Platz für Bilder und PDF-Seiten auf dem Server (Bytes) oder null */
export async function belegterSpeicher(): Promise<number | null> {
  try {
    if (!serverVorhanden() || !(await istAngemeldet()) || !tafelSchluessel()) return null
    return (await listeDateien()).reduce((s, d) => s + d.groesse, 0)
  } catch {
    return null
  }
}

/**
 * Löscht auf dem Server Dateien, die keine Tafel (auf dem Server oder hier) mehr braucht – höchstens einmal am Tag,
 * und nur Dateien, die älter als ein Tag sind (eine gerade hochgeladene gehört vielleicht zu einer Tafel, die gleich folgt).
 */
export async function raeumeServerAuf(jetzt = Date.now()): Promise<number> {
  try {
    const zuletzt = await vorgang<unknown>('einstellungen', 'readonly', (l) => l.get(AUFGERAEUMT))
    if (typeof zuletzt === 'number' && jetzt - zuletzt < 86_400_000) return 0
    const keyP = tafelSchluessel()
    if (!serverVorhanden() || !keyP || !(await istAngemeldet())) return 0
    const key = await keyP
    const benutzt = benutzteDateien((await ladeAlleTafeln()).flatMap((t) => t.seiten))
    for (const z of await ladeAlleTafelZeilen()) {
      try {
        for (const id of benutzteDateien((await packeAus(key, z)).seiten)) benutzt.add(id)
      } catch {
        return 0 // eine Tafel ist nicht lesbar: lieber nichts löschen
      }
    }
    const grenze = new Date(jetzt - 86_400_000).toISOString()
    const weg = (await listeDateien()).filter((d) => !benutzt.has(d.name) && d.erstellt && d.erstellt < grenze).map((d) => d.name)
    await loescheDateien(weg)
    if (weg.length) {
      const schon = await ladeHochgeladen()
      for (const id of weg) schon.delete(id)
      await vorgang('einstellungen', 'readwrite', (l) => l.put([...schon], HOCHGELADEN))
    }
    await vorgang('einstellungen', 'readwrite', (l) => l.put(jetzt, AUFGERAEUMT))
    return weg.length
  } catch (e) {
    console.warn('Aufräumen auf dem Server fehlgeschlagen', e)
    return 0
  }
}
