// Aufliegende Hand neben offenen Feldern (Hintergrund, Format, Radierer, Mehr Farben …).
// Am iPad liegt beim Schreiben mit dem Stift oft die Hand auf. Ein Feld, das sich beim Antippen außerhalb schließt,
// ging dann sofort wieder zu: Der Stift tippt den Knopf an, das Feld öffnet sich, die Hand berührt die Tafel – und
// das Feld ist weg, bevor man es sieht. Deshalb gelten Finger-Berührungen kurz nach dem Stift (und zweite Finger)
// nicht als „außerhalb antippen“.
import { useEffect, useRef } from 'react'

/** So lange nach der letzten Stiftbewegung gilt eine Berührung mit der Hand als aufgelegte Hand (ms) */
export const HAND_NACH_STIFT_MS = 2000

/** Wann der Stift zuletzt aufsetzte, sich bewegte (auch schwebend) oder abhob */
let letzterStift = -Infinity
let beobachtet = false

function merke(e: PointerEvent) {
  if (e.pointerType === 'pen') letzterStift = Date.now()
}

/** Beobachtet den Stift auf der ganzen Seite (einmal; vor allen anderen, weil am Fenster und in der Einfangphase) */
function beobachteStift() {
  if (beobachtet || typeof window === 'undefined') return
  beobachtet = true
  for (const art of ['pointerdown', 'pointermove', 'pointerup'] as const) window.addEventListener(art, merke, { capture: true, passive: true })
}

/** Nur für Tests: den Stift vergessen */
export const vergissStiftNebenan = () => {
  letzterStift = -Infinity
}

/** Ist diese Berührung die aufgelegte Hand – ein Finger kurz nach dem Stift oder ein weiterer Finger? */
export function istHandballen(e: PointerEvent | { pointerType: string; isPrimary?: boolean }): boolean {
  if (e.pointerType !== 'touch') return false
  return e.isPrimary === false || Date.now() - letzterStift < HAND_NACH_STIFT_MS
}

/**
 * Schließt ein offenes Feld beim Antippen außerhalb (nicht aber durch die aufgelegte Hand) und mit Escape.
 * `innen` liefert die Elemente, die als „innen“ zählen (das Feld und sein Knopf).
 */
export function useSchliessenDraussen(offen: boolean, innen: () => (Node | null | undefined)[], schliessen: () => void) {
  const aktuell = useRef({ innen, schliessen })
  aktuell.current = { innen, schliessen }
  useEffect(() => beobachteStift(), [])
  useEffect(() => {
    if (!offen) return
    const draussen = (e: PointerEvent) => {
      const ziel = e.target as Node
      if (aktuell.current.innen().some((el) => el?.contains(ziel))) return
      if (istHandballen(e)) return
      aktuell.current.schliessen()
    }
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && aktuell.current.schliessen()
    document.addEventListener('pointerdown', draussen, true)
    window.addEventListener('keydown', taste)
    return () => {
      document.removeEventListener('pointerdown', draussen, true)
      window.removeEventListener('keydown', taste)
    }
  }, [offen])
}
