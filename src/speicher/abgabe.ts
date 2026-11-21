// Schickt die Seite eines Schülers verschlüsselt an den Server: gebündelt (nach kurzer Ruhe), mit steigendem Stand,
// bei Netzproblemen mit Wiederholung. Nichts davon bleibt auf dem Gerät. Der Server wird nur über server.ts erreicht.
import { verschluesseleAbgabe } from '../kern/sitzung.ts'
import type { Seite } from '../kern/modell.ts'
import { abgabeSpeichern } from './server.ts'

export type SendeStand = 'bereit' | 'wartet' | 'sendet' | 'gesendet' | 'fehler' | 'zeit-um' | 'verloren' | 'fotos'

export type AbgabeSpeicher = {
  /** Neuer Stand der Seite: wird nach kurzer Ruhe gesendet */
  melde: (seite: Seite) => void
  /** Sofort senden (z. B. beim Verlassen der Seite oder am Ende der Zeit) */
  sendeJetzt: () => Promise<void>
  /** Nichts mehr senden */
  stoppe: () => void
}

export type AbgabeOptionen = {
  code: string
  platz: string
  hash: string
  schluessel: CryptoKey
  /** Stand, der schon auf dem Server liegt (0 = noch nichts) */
  stand0: number
  beiStand: (s: SendeStand) => void
  /** Vor dem Senden einer Seite: z. B. neue Fotos hochladen (die Seite nennt nur ihre Kennungen). Ein Fehler bricht das Senden ab. */
  vorbereiten?: (seite: Seite) => Promise<void>
  /** So lange nach der letzten Änderung warten (ms) */
  ruhe?: number
  /** So lange nach einem Fehler bis zum nächsten Versuch (ms) */
  wiederholung?: number
}

/** Stand, der nie kleiner wird: Sekunden seit 1.1.2026, mindestens eins mehr als der letzte */
const sekundenStand = () => Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 1000)

export function erzeugeAbgabeSpeicher(o: AbgabeOptionen): AbgabeSpeicher {
  const ruhe = o.ruhe ?? 1500
  const wiederholung = o.wiederholung ?? 5000
  let offen: Seite | null = null // noch nicht bestätigt
  let stand = o.stand0
  let uhr: ReturnType<typeof setTimeout> | null = null
  let laeuft: Promise<void> | null = null
  let aus = false
  let blockiert = false // Fotos zu viele/zu groß: erst nach einer neuen Änderung wieder versuchen

  const plane = (ms: number) => {
    if (uhr) clearTimeout(uhr)
    uhr = setTimeout(() => void sendeJetzt(), ms)
  }

  async function sendeJetzt(): Promise<void> {
    if (uhr) clearTimeout(uhr)
    uhr = null
    if (laeuft) return laeuft // läuft schon; danach wird nachgesehen, ob wieder etwas offen ist
    if (aus || blockiert || !offen) return
    laeuft = (async () => {
      const seite = offen
      if (!seite) return
      o.beiStand('sendet')
      try {
        await o.vorbereiten?.(seite)
        stand = Math.max(stand + 1, sekundenStand())
        const box = await verschluesseleAbgabe(o.schluessel, o.platz, seite, stand)
        stand = await abgabeSpeichern(o.code, o.platz, o.hash, stand, box.iv, box.daten)
        if (offen === seite) offen = null
        if (!offen) o.beiStand('gesendet')
      } catch (e) {
        const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
        if (/Zeit ist um|gibt es nicht/.test(text)) {
          aus = true
          o.beiStand('zeit-um')
        } else if (/anderen Gerät/.test(text)) {
          aus = true
          o.beiStand('verloren')
        } else if (/Zu viele Fotos|zu groß|zusammen/.test(text)) {
          // nicht wiederholen: erst eine neue Änderung (z. B. ein Foto weniger) sendet wieder
          blockiert = true
          o.beiStand('fotos')
        } else {
          o.beiStand('fehler')
          if (!aus) plane(wiederholung)
        }
      } finally {
        laeuft = null
      }
      if (!aus && !blockiert && offen && !uhr) plane(ruhe) // währenddessen kam Neues dazu
    })()
    return laeuft
  }

  return {
    melde(seite) {
      if (aus) return
      offen = seite
      blockiert = false
      o.beiStand('wartet')
      plane(ruhe)
    },
    sendeJetzt,
    stoppe() {
      aus = true
      if (uhr) clearTimeout(uhr)
      uhr = null
    },
  }
}
