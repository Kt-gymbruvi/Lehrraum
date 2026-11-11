// Bilder zum Zeichnen bereithalten: Die Zeichenfläche fragt nach einer Kennung; ist das Bild noch nicht im
// Arbeitsspeicher, wird es aus dem Gerätespeicher geladen und die Fläche danach neu gezeichnet.
import { ladeDatei } from '../speicher/dateien.ts'

type Quelle = ImageBitmap | HTMLImageElement
const fertig = new Map<string, Quelle | null>() // null = Datei fehlt oder ist kein Bild
const unterwegs = new Map<string, Promise<Quelle | null>>()
const hoerer = new Set<() => void>()

async function entschluessle(daten: Blob): Promise<Quelle> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(daten)
  // ältere Browser: über ein <img>
  const adresse = URL.createObjectURL(daten)
  try {
    const bild = new Image()
    bild.src = adresse
    await bild.decode()
    return bild
  } finally {
    URL.revokeObjectURL(adresse)
  }
}

/** Lädt ein Bild (einmal) und merkt es sich. Liefert null, wenn es die Datei nicht gibt. */
export function ladeBildquelle(id: string): Promise<Quelle | null> {
  if (fertig.has(id)) return Promise.resolve(fertig.get(id) ?? null)
  let p = unterwegs.get(id)
  if (!p) {
    p = ladeDatei(id)
      .then((daten) => (daten ? entschluessle(daten) : null))
      .catch(() => null)
      .then((q) => {
        fertig.set(id, q)
        unterwegs.delete(id)
        hoerer.forEach((h) => h())
        return q
      })
    unterwegs.set(id, p)
  }
  return p
}

/** Für das Zeichnen: das Bild, wenn es schon da ist – sonst undefined (lädt dann im Hintergrund) oder null (fehlt). */
export function bildquelle(id: string): Quelle | null | undefined {
  if (fertig.has(id)) return fertig.get(id)
  void ladeBildquelle(id)
  return undefined
}

/** Ein frisch eingefügtes Bild gleich bereitstellen, ohne es erst wieder aus dem Speicher zu lesen. */
export function merkeBildquelle(id: string, q: Quelle) {
  fertig.set(id, q)
}

/** Meldet, wenn ein Bild fertig geladen ist. Liefert die Funktion zum Abbestellen. */
export function beiBildGeladen(tun: () => void): () => void {
  hoerer.add(tun)
  return () => {
    hoerer.delete(tun)
  }
}
