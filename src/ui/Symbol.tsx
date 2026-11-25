// Einheitliche Symbole (eigene Zeichnungen, 24 × 24, Linie in der Textfarbe) – gleicher Stil wie gemeinsam/symbole.js der Startseite.

const ZEICHNUNGEN = {
  stift: 'M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1zM14 7l3 3',
  // Textmarker: schräger Schaft, Keilspitze und darunter ein breiter Strich
  marker: 'M14.5 3.5l6 6-7 7-6-6zM8.5 11.5l-3 3 4 4 3-3M5.5 14.5L3 19h4.5l2-0.5M3 21.5h8',
  // Lasso: Schlinge mit Seilende
  lasso: 'M12 4c4.4 0 8 2.2 8 5s-3.6 5-8 5-8-2.2-8-5 3.6-5 8-5zM7.5 13c-1.5 1.5-1 3.5.5 3.5s2 2-.5 4',
  radierer: 'M7 20h11M5.5 13.5l8-8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12 19H8.5l-3-3a1.8 1.8 0 0 1 0-2.5zM9.5 9.5l5 5',
  palette: 'M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 21 9.8C21 6 17 3 12 3zM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01M17 11h.01',
  schwamm: 'M5 9h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 13h.01M12 15h.01M16 13h.01M4 5c2.5-1.5 5.5 1.5 8 0s5.5 1.5 8 0',
  drehenRechts: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  drehenLinks: 'M4 12a8 8 0 1 0 2.34-5.66M4 4v5h5',
  hintergrundWeg: 'M6 3h8l4 4v14H6zM14 3v4h4M9.5 11.5l5 5M14.5 11.5l-5 5',
  laser:'M3.5 20.5l8-8M15 9h.01M15 3v2.5M21 9h-2.5M19.2 4.8l-1.8 1.8M19.2 13.2l-1.8-1.8M10.8 4.8l1.8 1.8',
  zurueck: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  vor: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  leeren: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  haus: 'M4 11l8-7 8 7M6 10v10h12V10',
  auswahl: 'M5 3l14 8-6 2-2 6z',
  hand: 'M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v6M17 12V9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.6-2.2L4.3 15.6a1.5 1.5 0 0 1 2.3-1.9L8 15.5',
  text: 'M5 7V4h14v3M12 4v16M9 20h6',
  tabelle: 'M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14M15 5v14',
  zeileDazu: 'M4 4h16v9H4zM4 8.5h16M12 15.5v5M9.5 18h5',
  zeileWeg: 'M4 4h16v9H4zM4 8.5h16M9.5 18h5',
  spalteDazu: 'M4 4h9v16H4zM8.5 4v16M18 9.5v5M15.5 12h5',
  spalteWeg: 'M4 4h9v16H4zM8.5 4v16M15.5 12h5',
  kopfzeile: 'M4 5h16v14H4zM4 10h16M7 7.5h10',
  linie: 'M5 19L19 5',
  pfeil: 'M5 19L19 5M10 5h9v9',
  pfeilBeide: 'M5 19L19 5M11 5h8v8M5 11v8h8',
  linieGestrichelt: 'M5 19l3-3M10.5 13.5l3-3M16 8l3-3',
  liniePunkte: 'M4.3 19a.7 .7 0 1 0 1.4 0a.7 .7 0 1 0-1.4 0M9 14.3a.7 .7 0 1 0 1.4 0a.7 .7 0 1 0-1.4 0M13.6 9.7a.7 .7 0 1 0 1.4 0a.7 .7 0 1 0-1.4 0M18.3 5a.7 .7 0 1 0 1.4 0a.7 .7 0 1 0-1.4 0',
  // Pfeil umkehren: zwei gegenläufige Pfeile
  umkehren: 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4',
  rechteck: 'M4 6h16v12H4z',
  ellipse: 'M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z',
  // Ausfüllen: Fläche mit Schraffur
  fuellen: 'M4 4h16v16H4zM4 12l8-8M4 20L20 4M12 20l8-8',
  duplizieren: 'M8 8h12v12H8zM16 8V4H4v12h4',
  kopieren: 'M9 3h6v3H9zM9 4.5H6v16h12v-16h-3M9.5 11h5M9.5 15h5',
  einfuegen: 'M9 3h6v3H9zM9 4.5H6v16h12v-16h-3M12 9.5v7M9 13.5l3 3 3-3',
  ausschneiden: 'M6 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5zM6 15.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5zM8.2 7.2L20 17M8.2 16.8L20 7',
  gruppieren: 'M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4M7 7h6v6H7zM11 11h6v6h-6z',
  loesen: 'M4 4h7v7H4zM13 13h7v7h-7z',
  ganzVorne: 'M5 3h14M12 21V7M7 12l5-5 5 5',
  ganzHinten: 'M5 21h14M12 3v14M7 12l5 5 5-5',
  links: 'M15 6l-6 6 6 6',
  rechts: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  klassen: 'M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20a6 6 0 0 1 12 0M16 5.2a3 3 0 0 1 0 5.6M17.5 14.3A6 6 0 0 1 21 20',
  bearbeiten: 'M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z',
  archiv: 'M4 5h16v4H4zM6 9v10h12V9M10 13h4',
  tafel: 'M3 4h18v12H3zM8 20l2-4M16 20l-2-4',
  bild: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  pdfOeffnen: 'M6 3h8l4 4v14H6zM14 3v4h4M12 17v-6M9 14l3-3 3 3',
  pdfSpeichern: 'M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14l3 3 3-3',
  teilen: 'M12 15V4M8 8l4-4 4 4M5 12v8h14v-8',
  nachVorne: 'M11 6l-6 6 6 6M5 12h9M19 5v14',
  nachHinten: 'M13 6l6 6-6 6M19 12h-9M5 5v14',
  uhr: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  timer: 'M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9v4l2.5 2.5M9 2h6',
  stoppuhr: 'M12 6a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 6V3M10 3h4M12 13.5l3-3M18.5 6.5L20 5',
  notiz: 'M5 4h14v10l-5 6H5zM14 20v-6h5',
  zufall: 'M4 7h3l10 10h3M4 17h3l3-3M14 10l3-3h3M17 4l3 3-3 3M17 14l3 3-3 3',
  schliessen: 'M6 6l12 12M18 6L6 18',
  farbeimer: 'M5 12l7-7 7 7-6 6a2 2 0 0 1-2.8 0zM5 12h14M20.5 15.5c1 1.4 1.5 2.3 1.5 3a1.5 1.5 0 0 1-3 0c0-.7.5-1.6 1.5-3z',
  groesse: 'M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7',
  leisteLinks: 'M4 5h16v14H4zM9 5v14',
  leisteRechts: 'M4 5h16v14H4zM15 5v14',
  einklappen: 'M6 15l6-6 6 6',
  ausklappen: 'M6 9l6 6 6-6',
  start: 'M8 5l11 7-11 7z',
  pause: 'M8 5v14M16 5v14',
  arbeitsform: 'M8 5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5zM16 5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5zM3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0',
  einzel: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 20a6 6 0 0 1 12 0',
  partner: 'M8 5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5zM16 5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5zM3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0',
  gruppe: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5.5 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18.5 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 12a3 3 0 0 1 6 0M2.5 18a3 3 0 0 1 6 0M15.5 18a3 3 0 0 1 6 0',
  plenum: 'M3 3h18v9H3zM6 16a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM12 16a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM18 16a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z',
  still: 'M3 9h4l5-4v14l-5-4H3zM16 9.5l5 5M21 9.5l-5 5',
  fluestern: 'M3 9h4l5-4v14l-5-4H3zM15.5 10a3 3 0 0 1 0 4',
  leise: 'M3 9h4l5-4v14l-5-4H3zM15.5 10a3 3 0 0 1 0 4M18 7.5a6.5 6.5 0 0 1 0 9',
  normal: 'M3 9h4l5-4v14l-5-4H3zM15.5 10a3 3 0 0 1 0 4M18 7.5a6.5 6.5 0 0 1 0 9M20.5 5a10 10 0 0 1 0 14',
  geraeusch: 'M8 2h8v20H8zM12 4.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 15.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  mikrofon: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  abdecken: 'M4 4h16v16H4zM4 7.5h16M4 11h16M4 14.5h16M10 14.5v3h4v-3',
  scheinwerfer: 'M3 3h18v18H3zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  geometrie: 'M2 18h20L12 8zM7 18v-2M12 18v-3M17 18v-2',
  lineal: 'M2 16L16 2l6 6L8 22zM6 12l2.5 2.5M9 9l2 2M12 6l2.5 2.5',
  geodreieck: 'M2 18h20L12 8zM7 18v-2M12 18v-3M17 18v-2',
  winkelmesser: 'M3 18a9 9 0 0 1 18 0zM12 18l4.5-6.5',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18v2M18 18h2v2',
  // Mitmachen: Tablet mit Stift (Schüler schreiben auf eigenen Seiten)
  mitmachen: 'M4 5h13a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM7 9h6M7 12.5h4M20.5 6.5l-6.5 6.5-.8 2.3 2.3-.8 6.5-6.5a1.2 1.2 0 0 0-1.5-1.5z',
  format: 'M3 6h12v9H3zM17 9h4v11h-8v-3',
  hintergrund: 'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16',
  uebersicht: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  // Präsentieren: Bildschirm auf einem Ständer mit Abspielzeichen
  praesentieren: 'M3 4h18v12H3zM12 16v4M8 20h8M10 7.5v5l4-2.5z',
  // Alle Leisten zeigen (Bühne verlassen): vier Ecken
  leistenZeigen: 'M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4',
} as const

export type SymbolName = keyof typeof ZEICHNUNGEN

/** voll: die Zeichnung ausgefüllt (z. B. ausgefülltes Rechteck) */
export function Symbol({ name, voll = false }: { name: SymbolName; voll?: boolean }) {
  return (
    <svg className="symbol" viewBox="0 0 24 24" fill={voll ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ZEICHNUNGEN[name]} />
    </svg>
  )
}
