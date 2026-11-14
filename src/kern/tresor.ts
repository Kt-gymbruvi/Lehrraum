// Verschlüsselung der Tresore (lr_tresore) – im selben Format wie das Notenbuch:
// PBKDF2-SHA256 mit 250 000 Runden → AES-256-GCM, Salz, IV und Daten als Base64.
// Der Schlüssel ist nicht exportierbar: Er lässt sich auf dem Gerät speichern (IndexedDB), aber nie auslesen.
// Das Passwort selbst wird nirgends gespeichert.

export const RUNDEN = 250_000

const kodierer = new TextEncoder()
const dekodierer = new TextDecoder()

export function b64(daten: ArrayBuffer | Uint8Array): string {
  const b = daten instanceof Uint8Array ? daten : new Uint8Array(daten)
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

export function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  return b
}

export const neuesSalz = (): string => b64(crypto.getRandomValues(new Uint8Array(16)))

/** Schlüssel aus Passwort und Salz (Base64); nicht exportierbar */
export async function leiteSchluesselAb(passwort: string, salz: string, runden = RUNDEN): Promise<CryptoKey> {
  const basis = await crypto.subtle.importKey('raw', kodierer.encode(passwort), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(salz), iterations: runden, hash: 'SHA-256' }, basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export type Box = { iv: string; daten: string }

export async function verschluessele(schluessel: CryptoKey, inhalt: unknown): Promise<Box> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, schluessel, kodierer.encode(JSON.stringify(inhalt)))
  return { iv: b64(iv), daten: b64(ct) }
}

/** Entschlüsselt; wirft bei falschem Schlüssel (oder veränderten Daten) */
export async function entschluessele(schluessel: CryptoKey, box: Box): Promise<unknown> {
  const klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, schluessel, unb64(box.daten))
  return JSON.parse(dekodierer.decode(klar))
}
