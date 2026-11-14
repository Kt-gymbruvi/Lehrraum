// Fenster „Zufall & Gruppen“: Zufallsschüler und Zufallsgruppen aus den Namen der Klasse.
// Nur Namen, keine Noten. „Heute nicht da“ und „schon dran“ gelten nur, solange das Fenster offen ist –
// nichts davon wird gespeichert. Die Tafel ändert sich nur über „An die Tafel schreiben“ (rückgängig machbar).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Schueler } from '../kern/klassen.ts'
import { anzeigeNamen, bildeGruppen, gruppenText, zufallBis, ziehe, type Gruppenart } from '../kern/zufall.ts'

type Props = { schueler: Schueler[] | null; beiAnTafel: (text: string) => void }
type Ansicht = 'wer' | 'gruppen' | 'da'

const DAUER = 1200 // ms Auswahl-Animation
const TAKT = 80

const ruhigGewuenscht = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Zufall({ schueler, beiAnTafel }: Props) {
  const [ansicht, setAnsicht] = useState<Ansicht>('wer')
  const [fehlen, setFehlen] = useState<ReadonlySet<string>>(new Set())
  const [dran, setDran] = useState<ReadonlySet<string>>(new Set())
  const [ohneWiederholung, setOhneWiederholung] = useState(true)
  const [animation, setAnimation] = useState(() => !ruhigGewuenscht())
  const [gezogen, setGezogen] = useState<string | null>(null)
  const [zeige, setZeige] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [hinweis, setHinweis] = useState('')
  const [art, setArt] = useState<Gruppenart>('anzahl')
  const [wert, setWert] = useState(4)
  const [gruppen, setGruppen] = useState<string[][]>([])
  const uhren = useRef<number[]>([])

  const namen = useMemo(() => anzeigeNamen(schueler ?? []), [schueler])
  const sortiert = useMemo(() => [...(schueler ?? [])].sort((a, b) => (namen.get(a.id) ?? '').localeCompare(namen.get(b.id) ?? '', 'de')), [schueler, namen])
  const da = sortiert.map((s) => s.id).filter((id) => !fehlen.has(id))

  useEffect(() => () => uhren.current.forEach((u) => window.clearTimeout(u)), [])

  if (!schueler) return <p className="hinweis zufall-leer">Zufall &amp; Gruppen gibt es in der Tafel einer Klasse.</p>
  if (!schueler.length)
    return (
      <p className="hinweis zufall-leer">
        Diese Klasse hat noch keine Namen. Trage sie unter <a href="#/klassen">Meine Klassen</a> ein – oder im Notenbuch.
      </p>
    )

  function ziehen() {
    const z = ziehe(da, dran, ohneWiederholung)
    if (!z || laeuft) return
    const fertig = () => {
      setLaeuft(false)
      setGezogen(z.id)
      setZeige(z.id)
      setDran((alt) => new Set([...(z.neueRunde ? [] : alt), z.id]))
      setHinweis(z.neueRunde ? 'Alle waren dran – neue Runde.' : '')
    }
    uhren.current.forEach((u) => window.clearTimeout(u))
    uhren.current = []
    if (!animation || da.length < 2) return fertig()
    setLaeuft(true)
    setHinweis('')
    for (let t = 0; t < DAUER; t += TAKT) uhren.current.push(window.setTimeout(() => setZeige(da[zufallBis(da.length)]), t))
    uhren.current.push(window.setTimeout(fertig, DAUER))
  }

  const umschalten = (id: string) =>
    setFehlen((alt) => {
      const neu = new Set(alt)
      if (neu.has(id)) neu.delete(id)
      else neu.add(id)
      return neu
    })

  const offen = da.filter((id) => !dran.has(id)).length
  const max = Math.max(1, da.length)

  return (
    <div className="zufall">
      <div className="reihe eng zufall-reiter" role="group" aria-label="Ansicht">
        <button type="button" className="f-knopf klein" aria-pressed={ansicht === 'wer'} onClick={() => setAnsicht('wer')}>
          Wer ist dran?
        </button>
        <button type="button" className="f-knopf klein" aria-pressed={ansicht === 'gruppen'} onClick={() => setAnsicht('gruppen')}>
          Gruppen
        </button>
        <button type="button" className="f-knopf klein" aria-pressed={ansicht === 'da'} onClick={() => setAnsicht('da')}>
          Heute nicht da{fehlen.size ? ` (${fehlen.size})` : ''}
        </button>
      </div>

      {ansicht === 'wer' && (
        <>
          <p className={'zufall-name' + (laeuft ? ' laeuft' : '')} role="status" aria-live="polite" aria-label={laeuft ? 'Wird ausgelost' : gezogen ? `Dran: ${namen.get(gezogen)}` : 'Noch niemand ausgelost'}>
            {zeige ? namen.get(zeige) : '?'}
          </p>
          {hinweis && <p className="hinweis">{hinweis}</p>}
          <div className="reihe">
            <button type="button" className="f-knopf haupt" disabled={!da.length || laeuft} onClick={ziehen}>
              Auslosen
            </button>
            {ohneWiederholung && dran.size > 0 && (
              <button
                type="button"
                className="f-knopf"
                onClick={() => {
                  setDran(new Set())
                  setHinweis('')
                }}
              >
                Neue Runde
              </button>
            )}
          </div>
          <label className="zufall-schalter">
            <input type="checkbox" checked={ohneWiederholung} onChange={(e) => setOhneWiederholung(e.target.checked)} />
            Ohne Wiederholung{ohneWiederholung ? ` – noch ${offen} von ${da.length}` : ''}
          </label>
          <label className="zufall-schalter">
            <input type="checkbox" checked={animation} onChange={(e) => setAnimation(e.target.checked)} />
            Mit Animation
          </label>
        </>
      )}

      {ansicht === 'gruppen' && (
        <>
          <div className="reihe zufall-einstellung">
            <label>
              <select value={art} aria-label="Gruppen bilden nach" onChange={(e) => setArt(e.target.value === 'groesse' ? 'groesse' : 'anzahl')}>
                <option value="anzahl">Anzahl der Gruppen</option>
                <option value="groesse">Personen je Gruppe</option>
              </select>
            </label>
            <div className="reihe eng" role="group" aria-label={art === 'anzahl' ? 'Anzahl der Gruppen' : 'Personen je Gruppe'}>
              <button type="button" className="f-knopf klein" aria-label="weniger" disabled={wert <= (art === 'anzahl' ? 2 : 1)} onClick={() => setWert((w) => Math.max(art === 'anzahl' ? 2 : 1, w - 1))}>
                −
              </button>
              <output className="zufall-wert">{Math.min(wert, max)}</output>
              <button type="button" className="f-knopf klein" aria-label="mehr" disabled={wert >= max} onClick={() => setWert((w) => Math.min(max, w + 1))}>
                +
              </button>
            </div>
          </div>
          <div className="reihe">
            <button type="button" className="f-knopf haupt" disabled={da.length < 2} onClick={() => setGruppen(bildeGruppen(da, art, Math.min(wert, max)))}>
              {gruppen.length ? 'Neu mischen' : 'Gruppen bilden'}
            </button>
            {gruppen.length > 0 && (
              <button type="button" className="f-knopf" onClick={() => beiAnTafel(gruppenText(gruppen, namen))}>
                An die Tafel schreiben
              </button>
            )}
          </div>
          {gruppen.length > 0 && (
            <ol className="zufall-gruppen" aria-label="Gruppen">
              {gruppen.map((g, i) => (
                <li key={i}>
                  <h3>Gruppe {i + 1}</h3>
                  <ul>
                    {g.map((id) => (
                      <li key={id}>{namen.get(id)}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {ansicht === 'da' && (
        <>
          <p className="hinweis">Antippen, wer heute fehlt. Gilt nur für diese Stunde und wird nirgends gespeichert.</p>
          <div className="zufall-anwesend" role="group" aria-label="Heute nicht da">
            {sortiert.map((s) => (
              <button key={s.id} type="button" className="f-knopf klein" aria-pressed={fehlen.has(s.id)} onClick={() => umschalten(s.id)}>
                {namen.get(s.id)}
              </button>
            ))}
          </div>
          <p className="hinweis">
            {da.length} von {sortiert.length} da
          </p>
        </>
      )}
    </div>
  )
}
