// Einheitliche Symbole (eigene Zeichnungen, 24 × 24, Linie in der Textfarbe) – gleicher Stil wie gemeinsam/symbole.js der Startseite.

const ZEICHNUNGEN = {
  stift: 'M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1zM14 7l3 3',
  marker: 'M14 4l6 6-8 8H6v-6zM4 21h16',
  radierer: 'M7 20h11M5.5 13.5l8-8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12 19H8.5l-3-3a1.8 1.8 0 0 1 0-2.5zM9.5 9.5l5 5',
  zurueck: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  vor: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  leeren: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  haus: 'M4 11l8-7 8 7M6 10v10h12V10',
} as const

export type SymbolName = keyof typeof ZEICHNUNGEN

export function Symbol({ name }: { name: SymbolName }) {
  return (
    <svg className="symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ZEICHNUNGEN[name]} />
    </svg>
  )
}
