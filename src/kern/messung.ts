// Messung für die Prüfansicht: Was meldet das Gerät beim Schreiben, und wie schnell kommt die Tafel hinterher?
// Reine Logik ohne Browser. Die Werte werden nur angezeigt – nichts davon wird gespeichert oder gesendet.

export type Zeigerart = 'stift' | 'finger' | 'maus' | 'unbekannt'

export const zeigerart = (pointerType: string): Zeigerart => (pointerType === 'pen' ? 'stift' : pointerType === 'touch' ? 'finger' : pointerType === 'mouse' ? 'maus' : 'unbekannt')

export const ZEIGERNAME: Record<Zeigerart, string> = { stift: 'Stift', finger: 'Finger', maus: 'Maus', unbekannt: 'unbekannt' }

/** Eine Meldung des Browsers über einen Zeiger (Aufsetzen oder Bewegung) */
export type Meldung = {
  /** Zeitpunkt der Verarbeitung in Millisekunden */
  zeit: number
  /** Wie lange die Meldung auf ihre Verarbeitung gewartet hat (ms); null, wenn der Browser das nicht hergibt */
  wartezeit: number | null
  /** Wie viele einzelne Punkte der Browser in dieser Meldung zusammengefasst hat (mindestens 1) */
  punkte: number
  druck: number
  /** Größe der Berührungsfläche in Pixeln */
  breite: number
  hoehe: number
}

/** Laufende Messung eines Strichs, vom Aufsetzen bis zum Abheben */
export type Lauf = {
  art: Zeigerart
  beginn: number
  letzteMeldung: number
  meldungen: number
  punkte: number
  pauseMax: number
  wartenSumme: number
  wartenAnzahl: number
  wartenMax: number
  druckMin: number
  druckMax: number
  breiteMax: number
  hoeheMax: number
  /** Bildwechsel des Browsers während des Strichs */
  bildwechsel: number
  letzterBildwechsel: number
  bildpauseMax: number
  /** Wie oft die Tafel gezeichnet hat und wie lange sie dafür gerechnet hat */
  gezeichnet: number
  rechenSumme: number
  rechenMax: number
}

/** Ergebnis eines abgeschlossenen Strichs */
export type Strichmessung = {
  art: Zeigerart
  /** Dauer in Millisekunden */
  dauer: number
  meldungenJeSekunde: number
  punkteJeSekunde: number
  /** Längste Pause zwischen zwei Meldungen (ms) – große Werte heißen: Die Schrift wird eckig */
  pauseMax: number
  bildwechselJeSekunde: number
  /** Längste Pause zwischen zwei Bildwechseln (ms) – große Werte heißen: Es ruckelt */
  bildpauseMax: number
  /** Rechenzeit der Tafel je gezeichnetem Bild (ms); null, wenn nichts gezeichnet wurde */
  rechenMittel: number | null
  rechenMax: number
  /** Wartezeit der Eingabe bis zur Verarbeitung (ms); null, wenn der Browser sie nicht hergibt */
  wartenMittel: number | null
  wartenMax: number
  druckMin: number
  druckMax: number
  /** Meldet das Gerät echten, wechselnden Druck? */
  druckEcht: boolean
  breiteMax: number
  hoeheMax: number
  /** Rechenzeit für das Einzeichnen des fertigen Strichs (ms); kommt nach dem Abheben dazu */
  einzeichnen: number | null
}

export function beginne(art: Zeigerart, m: Meldung): Lauf {
  const lauf: Lauf = {
    art,
    beginn: m.zeit,
    letzteMeldung: m.zeit,
    meldungen: 0,
    punkte: 0,
    pauseMax: 0,
    wartenSumme: 0,
    wartenAnzahl: 0,
    wartenMax: 0,
    druckMin: m.druck,
    druckMax: m.druck,
    breiteMax: 0,
    hoeheMax: 0,
    bildwechsel: 0,
    letzterBildwechsel: m.zeit,
    bildpauseMax: 0,
    gezeichnet: 0,
    rechenSumme: 0,
    rechenMax: 0,
  }
  merke(lauf, m)
  return lauf
}

function merke(lauf: Lauf, m: Meldung) {
  if (m.wartezeit !== null) {
    lauf.wartenSumme += m.wartezeit
    lauf.wartenAnzahl++
    lauf.wartenMax = Math.max(lauf.wartenMax, m.wartezeit)
  }
  lauf.druckMin = Math.min(lauf.druckMin, m.druck)
  lauf.druckMax = Math.max(lauf.druckMax, m.druck)
  lauf.breiteMax = Math.max(lauf.breiteMax, m.breite)
  lauf.hoeheMax = Math.max(lauf.hoeheMax, m.hoehe)
}

/** Eine Bewegungsmeldung während des Strichs */
export function bewegung(lauf: Lauf, m: Meldung) {
  lauf.meldungen++
  lauf.punkte += Math.max(1, m.punkte)
  lauf.pauseMax = Math.max(lauf.pauseMax, m.zeit - lauf.letzteMeldung)
  lauf.letzteMeldung = m.zeit
  merke(lauf, m)
}

/** Der Browser hat ein neues Bild begonnen */
export function bildwechsel(lauf: Lauf, zeit: number) {
  lauf.bildwechsel++
  lauf.bildpauseMax = Math.max(lauf.bildpauseMax, zeit - lauf.letzterBildwechsel)
  lauf.letzterBildwechsel = zeit
}

/**
 * Die Tafel hat gezeichnet und dafür `dauer` Millisekunden gerechnet. `neuesBild = false`: Die Rechenzeit gehört
 * zum selben Bild wie die vorige (z. B. untere und obere Ebene beim Verschieben der Ansicht).
 */
export function gezeichnet(lauf: Lauf, dauer: number, neuesBild = true) {
  if (neuesBild) lauf.gezeichnet++
  lauf.rechenSumme += dauer
  lauf.rechenMax = Math.max(lauf.rechenMax, dauer)
}

const jeSekunde = (anzahl: number, dauer: number) => (dauer > 0 ? (anzahl * 1000) / dauer : 0)

export function schliesseAb(lauf: Lauf, zeit: number): Strichmessung {
  const dauer = Math.max(0, zeit - lauf.beginn)
  return {
    art: lauf.art,
    dauer,
    meldungenJeSekunde: jeSekunde(lauf.meldungen, dauer),
    punkteJeSekunde: jeSekunde(lauf.punkte, dauer),
    pauseMax: lauf.pauseMax,
    bildwechselJeSekunde: jeSekunde(lauf.bildwechsel, dauer),
    bildpauseMax: lauf.bildpauseMax,
    rechenMittel: lauf.gezeichnet ? lauf.rechenSumme / lauf.gezeichnet : null,
    rechenMax: lauf.rechenMax,
    wartenMittel: lauf.wartenAnzahl ? lauf.wartenSumme / lauf.wartenAnzahl : null,
    wartenMax: lauf.wartenMax,
    druckMin: lauf.druckMin,
    druckMax: lauf.druckMax,
    // Maus und Finger melden einen festen Wert (meist 0,5 oder 0); ein echter Stift schwankt
    druckEcht: lauf.druckMax - lauf.druckMin > 0.05,
    breiteMax: lauf.breiteMax,
    hoeheMax: lauf.hoeheMax,
    einzeichnen: null,
  }
}

/** Zahl für die Anzeige: deutsches Komma, feste Nachkommastellen */
export const zahl = (n: number, stellen = 0) => n.toFixed(stellen).replace('.', ',')
