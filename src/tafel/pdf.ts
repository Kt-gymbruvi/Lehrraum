// PDF hinein und hinaus. Beide Bibliotheken werden erst geladen, wenn man sie braucht (sie sind groß),
// und stecken im eigenen Paket – es wird nichts von fremden Servern geholt.
//   Import:  PDF.js (Mozilla) zeichnet jede Seite als Bild; das Bild wird Hintergrund einer Tafelseite.
//   Export:  jede Tafelseite wird gezeichnet und mit pdf-lib als Seite in ein PDF gelegt.
// (Braucht einen echten Browser; in Tests wird dieses Modul ersetzt.)
import { seitenMass } from '../kern/geometrie.ts'
import { benutzteDateien, MAX_SEITEN, neueId, neueSeite, type Seite } from '../kern/modell.ts'
import { alsBlob, speichereCanvas } from './bilder.ts'
import { ladeBildquelle } from './bildquellen.ts'
import { zeichneSeite } from './zeichnen.ts'

/** PDF-Maße sind Punkte (72 je Zoll), die Tafel rechnet in Bildschirm-Pixeln (96 je Zoll) */
const PX_JE_PUNKT = 96 / 72
/** PDF-Seiten werden doppelt so fein gezeichnet, wie sie auf der Tafel groß sind – scharf auch beim Hineinzoomen */
const IMPORT_SCHAERFE = 2
/** Längste Kante einer exportierten Seite in Pixeln (begrenzt Speicher auf älteren Geräten) */
const EXPORT_MAX_KANTE = 3000
export const MAX_PDF = 60 * 1024 * 1024

export const istPdf = (d: { type: string; name?: string }) => d.type === 'application/pdf' || /\.pdf$/i.test(d.name ?? '')

/**
 * Liest ein PDF und liefert je Seite eine Tafelseite mit der PDF-Seite als Hintergrund.
 * `fortschritt` meldet, wie weit der Import ist. Höchstens `platz` Seiten (und nie mehr als MAX_SEITEN).
 */
export async function importierePdf(datei: Blob, platz: number, fortschritt: (seite: number, von: number) => void): Promise<{ seiten: Seite[]; ausgelassen: number }> {
  if (datei.size > MAX_PDF) throw new Error('Das PDF ist zu groß (höchstens 60 MB).')
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const aufgabe = pdfjs.getDocument({ data: new Uint8Array(await datei.arrayBuffer()) })
  let dokument
  try {
    dokument = await aufgabe.promise
  } catch (e) {
    const name = (e as { name?: string })?.name
    throw new Error(name === 'PasswordException' ? 'Das PDF ist mit einem Kennwort geschützt.' : 'Die Datei ist kein lesbares PDF.')
  }
  try {
    const anzahl = Math.min(dokument.numPages, platz, MAX_SEITEN)
    const seiten: Seite[] = []
    const pdf = neueId() // alle Seiten dieses Imports gehören zusammen (zum gemeinsamen Löschen)
    for (let nr = 1; nr <= anzahl; nr++) {
      fortschritt(nr, anzahl)
      const pdfSeite = await dokument.getPage(nr)
      const ansicht = pdfSeite.getViewport({ scale: PX_JE_PUNKT * IMPORT_SCHAERFE })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(ansicht.width)
      canvas.height = Math.ceil(ansicht.height)
      await pdfSeite.render({ canvas, viewport: ansicht }).promise
      const dateiId = await speichereCanvas(canvas, 'image/jpeg')
      seiten.push(neueSeite([], { dateiId, b: Math.round(canvas.width / IMPORT_SCHAERFE), h: Math.round(canvas.height / IMPORT_SCHAERFE), pdf }))
      pdfSeite.cleanup()
    }
    return { seiten, ausgelassen: dokument.numPages - anzahl }
  } finally {
    void aufgabe.destroy()
  }
}

/** Zeichnet alle Seiten und baut daraus ein PDF. */
export async function exportierePdf(seiten: Seite[], titel: string, fortschritt: (seite: number, von: number) => void): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  await Promise.all([...benutzteDateien(seiten)].map(ladeBildquelle)) // alle Bilder müssen vor dem Zeichnen da sein
  const pdf = await PDFDocument.create()
  pdf.setTitle(titel)
  pdf.setCreator('Lehrraum')
  const canvas = document.createElement('canvas')
  for (const [i, s] of seiten.entries()) {
    fortschritt(i + 1, seiten.length)
    const ausschnitt = seitenMass(s)
    const [, , b, h] = ausschnitt
    const massstab = Math.min(2, EXPORT_MAX_KANTE / Math.max(b, h))
    canvas.width = Math.round(b * massstab)
    canvas.height = Math.round(h * massstab)
    zeichneSeite(canvas.getContext('2d')!, s, ausschnitt, massstab)
    const bild = await pdf.embedJpg(await (await alsBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer())
    const seite = pdf.addPage([b / PX_JE_PUNKT, h / PX_JE_PUNKT])
    seite.drawImage(bild, { x: 0, y: 0, width: b / PX_JE_PUNKT, height: h / PX_JE_PUNKT })
  }
  const bytes = await pdf.save()
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}

/** Dateiname aus dem Titel: nur unbedenkliche Zeichen */
export const pdfName = (titel: string) => (titel.trim().replace(/[^\p{L}\p{N} _-]+/gu, '').replace(/\s+/g, '-').slice(0, 60) || 'Tafel') + '.pdf'

/** Lädt eine Datei herunter. */
export function ladeHerunter(daten: Blob, name: string) {
  const adresse = URL.createObjectURL(daten)
  const a = document.createElement('a')
  a.href = adresse
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(adresse), 10_000)
}

/** Kann dieses Gerät Dateien über das Teilen-Menü weitergeben (z. B. an Goodnotes)? */
export function kannTeilen(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'probe.pdf', { type: 'application/pdf' })] })
  } catch {
    return false
  }
}

/** Öffnet das Teilen-Menü des Geräts. Liefert false, wenn die Lehrkraft abbricht. */
export async function teile(daten: Blob, name: string, titel: string): Promise<boolean> {
  try {
    await navigator.share({ files: [new File([daten], name, { type: 'application/pdf' })], title: titel })
    return true
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return false
    throw new Error('Das Teilen hat nicht geklappt.')
  }
}
