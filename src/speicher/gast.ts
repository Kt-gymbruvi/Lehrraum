// Gastmodus der Tafel (#/tafel?gast=1): ohne Anmeldung nutzbar, nichts bleibt erhalten.
// Der Gast arbeitet in einer eigenen, kurzlebigen Datenbank („lehrraum-gast“), die beim Start geleert wird –
// die Tafeln, Klassen und Einstellungen der Lehrkraft auf diesem Gerät bleiben unberührt. Kein Abgleich mit dem Server.

/**
 * Gilt die aktuelle Adresse als Gastmodus? (liest den Hash, damit Speicher und Oberfläche immer übereinstimmen)
 * Auch die Schülerseite (#/mitmachen/…) arbeitet in der Gast-Datenbank: Schüler-Geräte behalten nichts von der Lehrkraft,
 * und ein Test auf dem Gerät der Lehrkraft berührt deren Tafeln nicht.
 */
export function istGast(): boolean {
  try {
    return /[?&]gast=1(&|$)/.test(window.location.hash) || /^#\/?mitmachen\//.test(window.location.hash)
  } catch {
    return false
  }
}

/** Name der Datenbank: Gäste bekommen eine eigene */
export const datenbankName = () => (istGast() ? 'lehrraum-gast' : 'lehrraum')

/** Leert die Gast-Datenbank (beim Start eines Gastbesuchs). Gelingt es nicht, wird trotzdem weitergemacht. */
export function leereGastDatenbank(): Promise<void> {
  return new Promise((ok) => {
    try {
      const a = indexedDB.deleteDatabase('lehrraum-gast')
      a.onsuccess = a.onerror = a.onblocked = () => ok()
    } catch {
      ok()
    }
  })
}
