import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import Klassen from './klassen/Klassen.tsx'
import Tafel from './tafel/Tafel.tsx'

/** #/tafel öffnet die freie Tafel, #/tafel?klasse=<Kennung> die Tafel einer Klasse */
function TafelSeite() {
  const [suche] = useSearchParams()
  const klasse = suche.get('klasse')
  const gueltig = klasse && /^[0-9a-f]{8,64}$/.test(klasse) ? klasse : undefined
  // key: beim Wechsel der Klasse die Tafel ganz neu aufbauen (eigener Verlauf, eigene Auswahl)
  return <Tafel key={gueltig ?? 'frei'} klasseId={gueltig} />
}

// „Bibliothek“ und weitere Bereiche kommen als eigene Routen dazu, sobald sie gebaut sind.
export default function App() {
  return (
    <Routes>
      <Route path="/tafel" element={<TafelSeite />} />
      <Route path="/klassen" element={<Klassen />} />
      <Route path="*" element={<Navigate to="/tafel" replace />} />
    </Routes>
  )
}
