// Kleines Feld beim Anlegen einer Tabelle: Zeilen und Spalten wählen (Vorgabe 3 × 3, bis 20 × 10).
import { useEffect, useState } from 'react'
import { TABELLE_MAX_SPALTEN, TABELLE_MAX_ZEILEN } from '../kern/modell.ts'
import { TABELLE_VORGABE } from '../kern/tabelle.ts'

type Props = {
  /** Lage in der Zeichenfläche (Bildschirm-Pixel) */
  links: number
  oben: number
  beiFertig: (zeilen: number, spalten: number) => void
  beiAbbrechen: () => void
}

function Zaehler({ name, wert, max, beiWert }: { name: string; wert: number; max: number; beiWert: (n: number) => void }) {
  return (
    <div className="tabellenwahl-zeile" role="group" aria-label={name}>
      <span>{name}</span>
      <button type="button" className="f-knopf klein" aria-label={`${name}: weniger`} disabled={wert <= 1} onClick={() => beiWert(wert - 1)}>
        −
      </button>
      <output aria-live="polite">{wert}</output>
      <button type="button" className="f-knopf klein" aria-label={`${name}: mehr`} disabled={wert >= max} onClick={() => beiWert(wert + 1)}>
        +
      </button>
    </div>
  )
}

export function Tabellenwahl({ links, oben, beiFertig, beiAbbrechen }: Props) {
  const [zeilen, setZeilen] = useState(TABELLE_VORGABE.zeilen)
  const [spalten, setSpalten] = useState(TABELLE_VORGABE.spalten)
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') beiAbbrechen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [beiAbbrechen])
  return (
    <div
      className="aufklappfeld tabellenwahl"
      role="dialog"
      aria-label="Tabelle einfügen"
      style={{ left: links, top: oben }}
      onPointerDown={(e) => e.stopPropagation()} // Tippen im Feld zeichnet nicht auf der Tafel
    >
      <Zaehler name="Zeilen" wert={zeilen} max={TABELLE_MAX_ZEILEN} beiWert={setZeilen} />
      <Zaehler name="Spalten" wert={spalten} max={TABELLE_MAX_SPALTEN} beiWert={setSpalten} />
      <div className="reihe">
        <button type="button" className="f-knopf haupt" onClick={() => beiFertig(zeilen, spalten)}>
          Einfügen
        </button>
        <button type="button" className="f-knopf" onClick={beiAbbrechen}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
