// Klassen der Lehrkraft (Version 3): Bezeichnung, Fach, Jahrgang, die Tafel der Klasse, ihre Vorlage (Format und
// Muster) und die Namen der Schülerinnen und Schüler. Version 1 hatte noch keine Vorlage, Version 2 keine Namen;
// beide werden ohne übernommen.
// Herkunft: selbst angelegt oder aus dem Notenbuch (dann pflegt das Notenbuch Bezeichnung, Fach und Namen).
// Reine Daten und Funktionen. Auf dem Gerät liegen die Klassen in IndexedDB; zum Server gehen sie nur verschlüsselt
// (siehe kern/tresor.ts und speicher/abgleich.ts). Noten gibt es hier nicht – nur Namen.
import { istFormat, neueId, pruefeMuster, STANDARD_FORMAT, type Format, type Muster } from './modell.ts'

export const KLASSE_SCHEMA = 'lehrraum/klasse'
export const KLASSE_VERSION = 3

/** Vorlage einer Klasse: Format ihrer Tafel (beim Anlegen) und Muster neuer Seiten (fehlt: leer) */
export type Vorlage = { format: Format; muster?: Muster }

export type Schueler = { id: string; vorname: string; nachname: string }

export type Klasse = {
  schema: typeof KLASSE_SCHEMA
  version: typeof KLASSE_VERSION
  id: string
  /** z. B. „7b“ oder „Q1“ */
  bezeichnung: string
  /** z. B. „Biologie“ */
  fach: string
  /** z. B. „7“ oder „12/13“ (optional) */
  jahrgang: string
  archiviert: boolean
  /** Kennung des Tafelbilds dieser Klasse auf DIESEM Gerät; null, solange die Tafel hier noch nie geöffnet wurde */
  tafelId: string | null
  /** fehlt: 16:9, leere Seiten */
  vorlage?: Vorlage
  /** Namen der Klasse (nur Vor- und Nachname) */
  schueler: Schueler[]
  /** fehlt: selbst angelegt; sonst die Kennung der Lerngruppe im Notenbuch */
  herkunft?: { notenbuch: string }
  geaendertAm: string
}

export const GRENZEN = { bezeichnung: 30, fach: 40, jahrgang: 10, name: 40 }
export const MAX_KLASSEN = 60
export const MAX_SCHUELER = 60

export type KlassenEingabe = { bezeichnung: string; fach: string; jahrgang: string }

const sauber = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, max) : '')
const istKennung = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8,64}$/.test(x)
const istSchuelerKennung = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-z]{4,64}$/.test(x)
const istNotenbuchKennung = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-z]{4,32}$/.test(x)

/** Prüft die Eingabe im Formular. Liefert Meldungen (leer = alles in Ordnung). */
export function pruefeEingabe(e: KlassenEingabe): string[] {
  const fehler: string[] = []
  if (!e.bezeichnung.trim()) fehler.push('Bitte eine Bezeichnung eingeben, z. B. „7b“.')
  if (e.bezeichnung.trim().length > GRENZEN.bezeichnung) fehler.push(`Die Bezeichnung ist zu lang (höchstens ${GRENZEN.bezeichnung} Zeichen).`)
  if (e.fach.trim().length > GRENZEN.fach) fehler.push(`Das Fach ist zu lang (höchstens ${GRENZEN.fach} Zeichen).`)
  if (e.jahrgang.trim().length > GRENZEN.jahrgang) fehler.push(`Der Jahrgang ist zu lang (höchstens ${GRENZEN.jahrgang} Zeichen).`)
  return fehler
}

export function neueKlasse(e: KlassenEingabe): Klasse {
  return {
    schema: KLASSE_SCHEMA,
    version: KLASSE_VERSION,
    id: neueId(),
    bezeichnung: sauber(e.bezeichnung, GRENZEN.bezeichnung),
    fach: sauber(e.fach, GRENZEN.fach),
    jahrgang: sauber(e.jahrgang, GRENZEN.jahrgang),
    archiviert: false,
    tafelId: null,
    schueler: [],
    geaendertAm: new Date().toISOString(),
  }
}

export const geaendert = (k: Klasse, neu: Partial<Omit<Klasse, 'schema' | 'version' | 'id'>>): Klasse => ({
  ...k,
  ...neu,
  ...(neu.bezeichnung !== undefined ? { bezeichnung: sauber(neu.bezeichnung, GRENZEN.bezeichnung) || k.bezeichnung } : {}),
  ...(neu.fach !== undefined ? { fach: sauber(neu.fach, GRENZEN.fach) } : {}),
  ...(neu.jahrgang !== undefined ? { jahrgang: sauber(neu.jahrgang, GRENZEN.jahrgang) } : {}),
  geaendertAm: new Date().toISOString(),
})

/** Kopie einer Klasse (z. B. fürs neue Schuljahr): gleiche Angaben und Namen, eigene Kennung, eigene leere Tafel.
 *  Die Kopie ist immer eine eigene Klasse – auch wenn das Original aus dem Notenbuch stammt. */
export const kopierteKlasse = (k: Klasse): Klasse => ({
  ...neueKlasse({ bezeichnung: (k.bezeichnung + ' (Kopie)').slice(0, GRENZEN.bezeichnung), fach: k.fach, jahrgang: k.jahrgang }),
  ...(k.vorlage ? { vorlage: k.vorlage } : {}),
  schueler: k.schueler.map((s) => ({ ...s })),
})

/** Vorlage, wenn sie etwas anderes sagt als der Standard (16:9, leer) – sonst undefined */
export function vorlageAus(format: Format, muster?: Muster): Vorlage | undefined {
  if (format === STANDARD_FORMAT && !muster) return undefined
  return muster ? { format, muster } : { format }
}

function pruefeVorlage(x: unknown): Vorlage | undefined {
  if (typeof x !== 'object' || x === null) return undefined
  const v = x as Record<string, unknown>
  if (!istFormat(v.format)) return undefined
  return vorlageAus(v.format, pruefeMuster(v.muster))
}

/** Anzeigename, auch als Titel der Tafel: „7b Biologie“ */
export const klassenName = (k: Pick<Klasse, 'bezeichnung' | 'fach'>): string => [k.bezeichnung, k.fach].filter(Boolean).join(' ')

const reihenfolge = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })
/** Aktive zuerst, dann nach Bezeichnung (5a vor 10b) und Fach */
export const sortiert = (klassen: Klasse[]): Klasse[] =>
  [...klassen].sort((a, b) => Number(a.archiviert) - Number(b.archiviert) || reihenfolge.compare(a.bezeichnung, b.bezeichnung) || reihenfolge.compare(a.fach, b.fach))

// ---------- Namen ----------
/** Prüft eine Namensliste: nur gültige Einträge mit Vor- oder Nachnamen, Kennungen eindeutig, höchstens MAX_SCHUELER */
export function pruefeSchueler(roh: unknown): Schueler[] {
  if (!Array.isArray(roh)) return []
  const gesehen = new Set<string>()
  const liste: Schueler[] = []
  for (const x of roh) {
    if (typeof x !== 'object' || x === null) continue
    const s = x as Record<string, unknown>
    if (!istSchuelerKennung(s.id) || gesehen.has(s.id)) continue
    const vorname = sauber(s.vorname, GRENZEN.name)
    const nachname = sauber(s.nachname, GRENZEN.name)
    if (!vorname && !nachname) continue
    gesehen.add(s.id)
    liste.push({ id: s.id, vorname, nachname })
    if (liste.length >= MAX_SCHUELER) break
  }
  return liste
}

/** Namen alphabetisch nach Nachname, dann Vorname */
export const namenSortiert = (liste: Schueler[]): Schueler[] =>
  [...liste].sort((a, b) => reihenfolge.compare(a.nachname, b.nachname) || reihenfolge.compare(a.vorname, b.vorname))

/** Für das Eingabefeld: eine Person je Zeile, „Nachname, Vorname“ */
export const namenAlsText = (liste: Schueler[]): string =>
  namenSortiert(liste)
    .map((s) => (s.nachname && s.vorname ? `${s.nachname}, ${s.vorname}` : s.nachname || s.vorname))
    .join('\n')

/**
 * Liest eine eingefügte Namensliste: eine Person je Zeile, „Nachname, Vorname“ oder „Vorname Nachname“
 * (dann ist das letzte Wort der Nachname). Tabulatoren (aus Tabellen kopiert) gelten wie ein Komma.
 * Wer schon in `alt` steht (gleicher Name), behält seine Kennung.
 */
export function namenAusText(text: string, alt: Schueler[] = []): Schueler[] {
  const schluessel = (v: string, n: string) => (v + '|' + n).toLocaleLowerCase('de')
  const frei = new Map<string, Schueler[]>()
  for (const s of alt) frei.set(schluessel(s.vorname, s.nachname), [...(frei.get(schluessel(s.vorname, s.nachname)) ?? []), s])
  const liste: Schueler[] = []
  for (const zeile of text.split(/\r?\n/)) {
    const z = zeile.replace(/^\s*\d+[.)]\s*/, '').trim() // „1. Muster, Anna“ aus nummerierten Listen
    if (!z) continue
    let vorname: string
    let nachname: string
    const teile = z.split(/\s*[,;\t]\s*/).filter(Boolean)
    if (teile.length >= 2) {
      nachname = teile[0]
      vorname = teile[1]
    } else {
      const woerter = z.split(/\s+/)
      nachname = woerter.length > 1 ? woerter[woerter.length - 1] : ''
      vorname = woerter.length > 1 ? woerter.slice(0, -1).join(' ') : woerter[0]
    }
    vorname = sauber(vorname, GRENZEN.name)
    nachname = sauber(nachname, GRENZEN.name)
    if (!vorname && !nachname) continue
    const bisher = frei.get(schluessel(vorname, nachname))?.shift()
    liste.push({ id: bisher?.id ?? neueId(), vorname, nachname })
    if (liste.length >= MAX_SCHUELER) break
  }
  return liste
}

/** Prüft eine gespeicherte Klasse; liefert sie bereinigt oder null. */
export function pruefeKlasse(roh: unknown): Klasse | null {
  if (typeof roh !== 'object' || roh === null) return null
  const k = roh as Record<string, unknown>
  if (k.schema !== KLASSE_SCHEMA || (k.version !== 1 && k.version !== 2 && k.version !== KLASSE_VERSION)) return null
  if (!istKennung(k.id)) return null
  const bezeichnung = sauber(k.bezeichnung, GRENZEN.bezeichnung)
  if (!bezeichnung) return null
  const vorlage = k.version !== 1 ? pruefeVorlage(k.vorlage) : undefined
  const herkunft = k.version === KLASSE_VERSION && typeof k.herkunft === 'object' && k.herkunft !== null ? (k.herkunft as Record<string, unknown>).notenbuch : undefined
  return {
    schema: KLASSE_SCHEMA,
    version: KLASSE_VERSION,
    id: k.id,
    bezeichnung,
    fach: sauber(k.fach, GRENZEN.fach),
    jahrgang: sauber(k.jahrgang, GRENZEN.jahrgang),
    archiviert: k.archiviert === true,
    tafelId: istKennung(k.tafelId) ? k.tafelId : null,
    ...(vorlage ? { vorlage } : {}),
    schueler: k.version === KLASSE_VERSION ? pruefeSchueler(k.schueler) : [],
    ...(istNotenbuchKennung(herkunft) ? { herkunft: { notenbuch: herkunft } } : {}),
    geaendertAm: typeof k.geaendertAm === 'string' ? k.geaendertAm : new Date().toISOString(),
  }
}

// ---------- Klassen aus dem Notenbuch ----------
/** Eine Lerngruppe aus der Namensliste des Notenbuchs (schema „notenbuch/namen“) */
export type NotenbuchKlasse = { id: string; name: string; fach: string; archiviert: boolean; schueler: Schueler[] }

/** Prüft die entschlüsselte Namensliste des Notenbuchs; null, wenn sie nicht stimmt. */
export function pruefeNamensliste(roh: unknown): NotenbuchKlasse[] | null {
  if (typeof roh !== 'object' || roh === null) return null
  const l = roh as Record<string, unknown>
  if (l.schema !== 'notenbuch/namen' || l.version !== 1 || !Array.isArray(l.klassen)) return null
  const klassen: NotenbuchKlasse[] = []
  for (const x of l.klassen) {
    if (typeof x !== 'object' || x === null) continue
    const k = x as Record<string, unknown>
    if (!istNotenbuchKennung(k.id) || klassen.some((v) => v.id === k.id)) continue
    klassen.push({ id: k.id, name: sauber(k.name, GRENZEN.bezeichnung) || 'Lerngruppe', fach: sauber(k.fach, GRENZEN.fach), archiviert: k.archiviert === true, schueler: pruefeSchueler(k.schueler) })
    if (klassen.length >= MAX_KLASSEN) break
  }
  return klassen
}

/** Kennung der Lehrraum-Klasse zu einer Notenbuch-Lerngruppe – auf allen Geräten dieselbe (Hex der Notenbuch-Kennung) */
export const kennungAusNotenbuch = (nbId: string): string =>
  Array.from(nbId)
    .map((z) => z.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 64)
    .padEnd(8, '0')

/** Jahrgang aus dem Namen der Lerngruppe: „7b“ → „7“, „10 Bio“ → „10“, sonst leer */
const jahrgangAus = (name: string) => name.match(/^(\d{1,2})(?!\d)/)?.[1] ?? ''

const gleicheNamen = (a: Schueler[], b: Schueler[]) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Gleicht die Klassen mit der Namensliste des Notenbuchs ab. Liefert die Klassen, die neu sind oder sich geändert haben.
 * - Jede Lerngruppe des Notenbuchs wird eine Klasse (archivierte nur, wenn es sie hier schon gibt).
 * - Bezeichnung, Fach, Namen und „archiviert“ kommen aus dem Notenbuch; Tafel und Vorlage bleiben.
 * - Fehlt eine Lerngruppe im Notenbuch (dort gelöscht), wird ihre Klasse archiviert, nicht gelöscht – die Tafel bleibt.
 * - `geloescht`: Kennungen, die die Lehrkraft hier gelöscht hat – die werden nicht wieder angelegt.
 */
export function gleicheMitNotenbuchAb(lokal: Klasse[], notenbuch: NotenbuchKlasse[], geloescht: ReadonlySet<string> = new Set()): Klasse[] {
  const aenderungen: Klasse[] = []
  const vorhanden = new Map(lokal.filter((k) => k.herkunft).map((k) => [k.herkunft!.notenbuch, k]))
  for (const nb of notenbuch) {
    const alt = vorhanden.get(nb.id)
    vorhanden.delete(nb.id)
    const werte = { bezeichnung: nb.name, fach: nb.fach, archiviert: nb.archiviert, schueler: nb.schueler }
    if (!alt) {
      const id = kennungAusNotenbuch(nb.id)
      if (nb.archiviert || geloescht.has(id) || lokal.some((k) => k.id === id)) continue
      aenderungen.push({ ...neueKlasse({ bezeichnung: nb.name, fach: nb.fach, jahrgang: jahrgangAus(nb.name) }), id, schueler: nb.schueler, herkunft: { notenbuch: nb.id } })
    } else if (alt.bezeichnung !== werte.bezeichnung || alt.fach !== werte.fach || alt.archiviert !== werte.archiviert || !gleicheNamen(alt.schueler, werte.schueler)) {
      aenderungen.push({ ...geaendert(alt, werte), schueler: nb.schueler })
    }
  }
  // Im Notenbuch gelöscht: archivieren
  for (const k of vorhanden.values()) if (!k.archiviert) aenderungen.push(geaendert(k, { archiviert: true }))
  return aenderungen
}

// ---------- Abgleich der Klassen zwischen den Geräten ----------
/** Inhalt des verschlüsselten Tresors „klassen“ (alle Klassen; Namen nur von selbst angelegten, Tafeln nie) */
/** `tafelSchluessel`: zufälliger AES-256-Schlüssel (Base64) für die Tafeln auf allen Geräten (seit Etappe C) */
export type KlassenTresor = { schema: 'lehrraum/klassen'; version: 1; klassen: Klasse[]; geloescht: Geloescht[]; tafelSchluessel?: string }
/** 32 Byte als Base64 */
export const istTafelSchluessel = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(x)
/** Gelöschte Klasse: Kennung und Zeitpunkt – damit sie auf anderen Geräten nicht wieder auftaucht */
export type Geloescht = { id: string; am: string }

/** Die Tafel gehört zum Gerät; Namen von Notenbuch-Klassen bringt das Notenbuch selbst mit */
const fuerDenTresor = (k: Klasse): Klasse => ({ ...k, tafelId: null, schueler: k.herkunft ? [] : k.schueler })

export function pruefeGeloescht(roh: unknown): Geloescht[] {
  if (!Array.isArray(roh)) return []
  return roh
    .filter((x): x is Geloescht => typeof x === 'object' && x !== null && istKennung((x as Geloescht).id) && typeof (x as Geloescht).am === 'string')
    .map((g) => ({ id: g.id, am: g.am }))
    .slice(-500)
}

export function pruefeKlassenTresor(roh: unknown): KlassenTresor | null {
  if (typeof roh !== 'object' || roh === null) return null
  const t = roh as Record<string, unknown>
  if (t.schema !== 'lehrraum/klassen' || t.version !== 1 || !Array.isArray(t.klassen)) return null
  return {
    schema: 'lehrraum/klassen',
    version: 1,
    klassen: t.klassen.map(pruefeKlasse).filter((k): k is Klasse => k !== null),
    geloescht: pruefeGeloescht(t.geloescht),
    ...(istTafelSchluessel(t.tafelSchluessel) ? { tafelSchluessel: t.tafelSchluessel } : {}),
  }
}

export function klassenTresor(klassen: Klasse[], geloescht: Geloescht[], tafelSchluessel?: string): KlassenTresor {
  const nachId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  return {
    schema: 'lehrraum/klassen',
    version: 1,
    klassen: klassen.map(fuerDenTresor).sort(nachId),
    geloescht: [...geloescht].sort(nachId),
    ...(tafelSchluessel ? { tafelSchluessel } : {}),
  }
}

/**
 * Führt die Klassen dieses Geräts mit denen vom Server zusammen.
 * Gleiche Klasse auf beiden Seiten: die zuletzt geänderte gewinnt (die Tafel dieses Geräts bleibt).
 * Gelöschte Klassen bleiben gelöscht, wenn sie danach nicht mehr geändert wurden.
 * Liefert, was hier zu speichern und zu löschen ist, und den neuen Inhalt für den Server.
 */
export function fuehreZusammen(lokal: Klasse[], geloeschtLokal: Geloescht[], server: KlassenTresor | null): { speichern: Klasse[]; loeschen: Klasse[]; geloescht: Geloescht[]; tresor: KlassenTresor } {
  const geloescht = new Map<string, string>()
  for (const g of [...geloeschtLokal, ...(server?.geloescht ?? [])]) if (!geloescht.has(g.id) || g.am > geloescht.get(g.id)!) geloescht.set(g.id, g.am)
  const hier = new Map(lokal.map((k) => [k.id, k]))
  const ergebnis = new Map(hier)
  const speichern: Klasse[] = []
  for (const s of server?.klassen ?? []) {
    const h = hier.get(s.id)
    if (!h) {
      speichern.push(s)
      ergebnis.set(s.id, s)
    } else if (s.geaendertAm > h.geaendertAm) {
      // Namen von Notenbuch-Klassen kommen vom Notenbuch, nicht aus diesem Tresor
      const neu: Klasse = { ...s, tafelId: h.tafelId, schueler: s.herkunft ? h.schueler : s.schueler }
      speichern.push(neu)
      ergebnis.set(s.id, neu)
    }
  }
  const loeschen: Klasse[] = []
  for (const [id, am] of geloescht) {
    const k = ergebnis.get(id)
    if (k && k.geaendertAm <= am) {
      ergebnis.delete(id)
      if (hier.has(id)) loeschen.push(hier.get(id)!)
      const i = speichern.findIndex((x) => x.id === id)
      if (i >= 0) speichern.splice(i, 1)
    }
  }
  const alleGeloescht = [...geloescht].map(([id, am]) => ({ id, am }))
  return { speichern, loeschen, geloescht: alleGeloescht, tresor: klassenTresor([...ergebnis.values()], alleGeloescht) }
}
