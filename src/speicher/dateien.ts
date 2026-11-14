// Bilder und importierte PDF-Seiten: liegen als Dateien (Blob) in IndexedDB auf diesem Gerät, getrennt vom
// Tafelbild, das nur ihre Kennung nennt. Mit dem Tafel-Abgleich (tafelabgleich.ts) gehen sie zusätzlich
// verschlüsselt auf den Server; fehlt eine Datei hier, wird sie von dort geholt.
import { neueId } from '../kern/modell.ts'
import { vorgang } from './datenbank.ts'

export type Datei = { id: string; typ: string; daten: Blob }

export async function speichereDatei(daten: Blob): Promise<string> {
  const datei: Datei = { id: neueId(), typ: daten.type || 'application/octet-stream', daten }
  await vorgang('dateien', 'readwrite', (s) => s.put(datei))
  return datei.id
}

/** Holt eine fehlende Datei (vom Server) – wird vom Tafel-Abgleich gesetzt */
let nachladen: ((id: string) => Promise<Datei | null>) | null = null
export function setzeNachladen(tun: typeof nachladen) {
  nachladen = tun
}

export async function ladeDateiEintrag(id: string): Promise<Datei | null> {
  const d = await vorgang<Datei | undefined>('dateien', 'readonly', (s) => s.get(id))
  return d?.daten instanceof Blob ? d : null
}

export async function ladeDatei(id: string): Promise<Blob | null> {
  const d = await ladeDateiEintrag(id)
  if (d) return d.daten
  const geholt = await nachladen?.(id).catch(() => null)
  if (!geholt) return null
  await vorgang('dateien', 'readwrite', (s) => s.put(geholt))
  return geholt.daten
}

/**
 * Löscht Dateien, die kein Tafelbild mehr braucht. Wird nur beim Öffnen der Tafel aufgerufen – dann gibt es
 * keinen Rückgängig-Verlauf, der ein gelöschtes Bild zurückholen könnte.
 */
export async function raeumeDateienAuf(benutzt: ReadonlySet<string>): Promise<number> {
  const alle = await vorgang<IDBValidKey[]>('dateien', 'readonly', (s) => s.getAllKeys())
  const weg = alle.filter((k): k is string => typeof k === 'string' && !benutzt.has(k))
  for (const id of weg) await vorgang('dateien', 'readwrite', (s) => s.delete(id))
  return weg.length
}
