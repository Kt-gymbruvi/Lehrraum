import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { istGast } from './speicher/gast.ts'
import './index.css'

// Heller oder dunkler Modus: dieselbe Auswahl wie auf der Startseite (gleiche Adresse, gleicher Speicher im Gerät)
try {
  const design = localStorage.getItem('lehrraum-design')
  if (design === 'hell' || design === 'dunkel') document.documentElement.dataset.design = design
} catch {
  /* ohne Speicher gilt die Einstellung des Geräts */
}

// Wechsel zwischen Gastmodus und normaler Tafel: neu laden, damit der richtige Speicher geöffnet wird
// (sonst könnte ein Gast in den Speicher der Lehrkraft schreiben – oder umgekehrt)
let warGast = istGast()
window.addEventListener('hashchange', () => {
  if (istGast() !== warGast) window.location.reload()
})

// HashRouter: funktioniert auf GitHub Pages ohne Server-Weiterleitungen (z. B. …/Lehrraum/#/tafel)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
