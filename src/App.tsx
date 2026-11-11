import { Navigate, Route, Routes } from 'react-router-dom'
import Tafel from './tafel/Tafel.tsx'

// Bisher gibt es nur die Tafel. „Unterrichten“ und „Bibliothek“ kommen als eigene Routen dazu, sobald sie gebaut sind.
export default function App() {
  return (
    <Routes>
      <Route path="/tafel" element={<Tafel />} />
      <Route path="*" element={<Navigate to="/tafel" replace />} />
    </Routes>
  )
}
