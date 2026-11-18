// QR-Code als SVG-Pfad: aus einer Adresse die Felder des Codes (Bibliothek `qrcode`, rechnet nur, lädt nichts).
import QRCode from 'qrcode'

/** Ruhezone um den Code (Felder) – nötig, damit Handys ihn sicher erkennen */
export const QR_RAND = 2

/**
 * Pfad aller dunklen Felder (ein Feld = 1 × 1) und die Seitenlänge samt Ruhezone.
 * Waagerecht benachbarte Felder werden zu einem Rechteck zusammengefasst (kürzerer Pfad, keine Haarlinien).
 */
export function qrPfad(text: string): { groesse: number; pfad: string } {
  const m = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
  const teile: string[] = []
  for (let r = 0; r < m.size; r++) {
    let c = 0
    while (c < m.size) {
      if (!m.data[r * m.size + c]) {
        c++
        continue
      }
      const start = c
      while (c < m.size && m.data[r * m.size + c]) c++
      teile.push(`M${start + QR_RAND} ${r + QR_RAND}h${c - start}v1h${start - c}z`)
    }
  }
  return { groesse: m.size + 2 * QR_RAND, pfad: teile.join('') }
}
