import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Heller oder dunkler Modus: dieselbe Auswahl wie auf der Startseite (gleiche Adresse, gleicher Speicher im Gerät)
try {
  const design = localStorage.getItem('lehrraum-design')
  if (design === 'hell' || design === 'dunkel') document.documentElement.dataset.design = design
} catch {
  /* ohne Speicher gilt die Einstellung des Geräts */
}

// HashRouter: funktioniert auf GitHub Pages ohne Server-Weiterleitungen (z. B. …/Lehrraum/#/tafel)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
