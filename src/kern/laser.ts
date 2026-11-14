// Laserpointer (L1): Wie lange welcher Teil der Spur zu sehen ist. Reine Logik ohne Browser; gezeichnet wird in
// tafel/zeichnen.ts (zeichneLaser). Jeder Punkt der Spur altert für sich – so zieht der Laser einen leuchtenden
// Schweif hinter sich her, der vom Ende her dünner wird und verlischt, auch während noch gezeigt wird.

/** So lange (ms) ist ein Punkt der Spur voll zu sehen … */
export const LASER_VOLL = 700
/** … und nach so langer Zeit (ms) ganz verschwunden (Spezifikation: etwa 1,5 Sekunden nach dem Zeichnen) */
export const LASER_LEBEN = 1500
/** So schnell (ms) verlischt der Leuchtpunkt nach dem Abheben */
export const LASER_PUNKT_WEG = 300

/** Eine Spur (Tafel-Koordinaten mit Zeitpunkt in ms); ende: wann abgehoben wurde (null: es wird noch gezeigt) */
export type Spur = { punkte: [number, number, number][]; ende: number | null }

/** Wie viel von einem Punkt des Alters `alter` (ms) noch zu sehen ist: 1 = ganz, 0 = verschwunden */
export function leben(alter: number): number {
  if (alter <= LASER_VOLL) return 1
  return Math.max(0, 1 - (alter - LASER_VOLL) / (LASER_LEBEN - LASER_VOLL))
}

/** Ist von der Spur noch etwas zu sehen (Schweif oder Leuchtpunkt)? */
export function lebt(s: Spur, jetzt: number): boolean {
  if (s.ende === null || jetzt - s.ende < LASER_PUNKT_WEG) return true
  const neuester = s.punkte[s.punkte.length - 1]
  return !!neuester && jetzt - neuester[2] < LASER_LEBEN
}

/** Helligkeit des Leuchtpunkts an der Spitze: beim Zeigen 1, nach dem Abheben schnell 0 */
export const punktLeben = (s: Spur, jetzt: number): number => (s.ende === null ? 1 : Math.max(0, 1 - (jetzt - s.ende) / LASER_PUNKT_WEG))

/**
 * Teilt die Spur in zusammenhängende Stücke gleicher Helligkeit (in `stufen` Stufen), damit sie mit wenigen Pfaden
 * gezeichnet werden kann. Verschwundene Stücke fehlen.
 */
export function abschnitte(s: Spur, jetzt: number, stufen = 10): { leben: number; punkte: [number, number][] }[] {
  const out: { leben: number; punkte: [number, number][] }[] = []
  let aktuell: { leben: number; punkte: [number, number][] } | null = null
  for (let i = 1; i < s.punkte.length; i++) {
    const [x0, y0] = s.punkte[i - 1]
    const [x1, y1, t] = s.punkte[i]
    const l = Math.ceil(leben(jetzt - t) * stufen) / stufen
    if (l <= 0) {
      aktuell = null
      continue
    }
    if (aktuell && aktuell.leben === l) aktuell.punkte.push([x1, y1])
    else {
      aktuell = { leben: l, punkte: [[x0, y0], [x1, y1]] }
      out.push(aktuell)
    }
  }
  return out
}

/** Verschwundene Punkte vorne abschneiden (einer bleibt als Anfang des nächsten Stücks) */
export function kuerze(s: Spur, jetzt: number): void {
  let weg = 0
  while (weg < s.punkte.length - 1 && jetzt - s.punkte[weg + 1][2] >= LASER_LEBEN) weg++
  if (weg) s.punkte.splice(0, weg)
}
