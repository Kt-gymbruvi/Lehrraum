// Einheitliche Symbole (eigene Zeichnungen, 24 × 24, Linie in der Textfarbe) – gleicher Stil wie gemeinsam/symbole.js der Startseite.

const ZEICHNUNGEN = {
  stift: 'M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1zM14 7l3 3',
  marker: 'M14 4l6 6-8 8H6v-6zM4 21h16',
  radierer: 'M7 20h11M5.5 13.5l8-8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12 19H8.5l-3-3a1.8 1.8 0 0 1 0-2.5zM9.5 9.5l5 5',
  zurueck: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  vor: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  leeren: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  haus: 'M4 11l8-7 8 7M6 10v10h12V10',
  uhr: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  timer: 'M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9v4l2.5 2.5M9 2h6',
  stoppuhr: 'M12 6a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 6V3M10 3h4M12 13.5l3-3M18.5 6.5L20 5',
  wuerfel: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  notiz: 'M5 4h14v10l-5 6H5zM14 20v-6h5',
  schliessen: 'M6 6l12 12M18 6L6 18',
  einklappen: 'M6 15l6-6 6 6',
  ausklappen: 'M6 9l6 6 6-6',
  start: 'M8 5l11 7-11 7z',
  pause: 'M8 5v14M16 5v14',
} as const

export type SymbolName = keyof typeof ZEICHNUNGEN

export function Symbol({ name }: { name: SymbolName }) {
  return (
    <svg className="symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ZEICHNUNGEN[name]} />
    </svg>
  )
}
