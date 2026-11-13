// Die Tafel: Kopfzeile, linke Werkzeugleiste, Zeichenfläche mit Fenstern darüber, rechte Schnellzugriffsleiste,
// unten die Seiten. Speichert automatisch auf diesem Gerät und stellt beim Öffnen die zuletzt benutzte Tafel wieder her.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Fensterebene, Schnellleiste } from '../fenster/Fensterebene.tsx'
import { einzufuegen, neueAblage, type Ablage } from '../kern/ablage.ts'
import { AUSWAHL_RAND, geloest, gruppiert, istEineGruppe } from '../kern/auswahl.ts'
import { ausfuehren, entfernenBefehl, leererVerlauf, ordnenBefehl, rueckgaengig, wiederholen, type Befehl, type Verlauf } from '../kern/befehle.ts'
import type { FensterZustand } from '../kern/fenster.ts'
import { einpassen, gesamtRahmen, zoomeUm, zuTafel, type Rechteck } from '../kern/geometrie.ts'
import { benutzteDateien, FARBEN, MAX_SEITEN, STAERKEN, neueId, neuesTafelbild, schriftgroesse, type Bild, type Element, type Kamera, type Seite, type Tafelbild } from '../kern/modell.ts'
import { RADIERER_STANDARD, type Radierer } from '../kern/radieren.ts'
import { istFarbwert, mitEigenerFarbe, normiereFarbe } from '../kern/farben.ts'
import { gehe, kopiere, seiteDazu, seiteDoppelt, seitenDazu, seiteSchieben, seiteWeg, type Buch as Seitenfolge } from '../kern/seiten.ts'
import { bitteUmDauerhaftenSpeicher, ladeAblage, ladeAlleTafeln, ladeFarbplaetze, ladeFreieTafel, merkeAblage, merkeFarbplaetze, merkeFreieTafel, oeffneKlassenTafel, speichereTafel } from '../speicher/datenbank.ts'
import { raeumeDateienAuf } from '../speicher/dateien.ts'
import { istBilddatei, nimmBild } from './bilder.ts'
import { exportierePdf, importierePdf, istPdf, kannTeilen, ladeHerunter, pdfName, teile } from './pdf.ts'
import { Symbol } from '../ui/Symbol.tsx'
import { Auswahlleiste, type Befehlsknopf } from './Auswahlleiste.tsx'

/** Steht nach dem Kopieren in der Zwischenablage des Systems (eingefügt wird in der Tafel die Kopie selbst) */
const KOPIE_HINWEIS = 'Aus einer Lehrraum-Tafel kopiert – einfügen lässt es sich nur in einer Lehrraum-Tafel.'
import { Pruefansicht } from './Pruefansicht.tsx'
import { Seitenleiste } from './Seitenleiste.tsx'
import { WERKZEUGE, Werkzeugleiste } from './Werkzeugleiste.tsx'
import { Zeichenflaeche, type Werkzeug } from './Zeichenflaeche.tsx'

type Speicherstand = 'laedt' | 'gespeichert' | 'ungespeichert' | 'fehler'
const SPEICHERTEXT: Record<Speicherstand, string> = {
  laedt: 'Wird geladen …',
  gespeichert: 'Auf diesem Gerät gespeichert',
  ungespeichert: 'Wird gespeichert …',
  fehler: 'Speichern fehlgeschlagen',
}

/** So lange nach der letzten Änderung warten, bevor gespeichert wird */
const SPEICHERN_NACH_MS = 700

/** Seiten, gezeigte Seite und der Rückgängig-Verlauf je Seite (der Verlauf wird nicht gespeichert) */
type Buch = Seitenfolge & { verlaeufe: Record<string, Verlauf> }
const LEER: Seite = { id: '', elemente: [] }

/**
 * Ohne `klasseId` öffnet sich die freie Tafel, sonst die Tafel dieser Klasse (wird beim ersten Öffnen angelegt).
 * `pruefen` blendet die Prüfansicht ein (Messwerte zum Schreiben am Gerät).
 */
export default function Tafel({ klasseId, pruefen = false }: { klasseId?: string; pruefen?: boolean }) {
  const [kopf, setKopf] = useState<Pick<Tafelbild, 'schema' | 'version' | 'id' | 'titel'> | null>(null)
  const [buch, setBuch] = useState<Buch>({ seiten: [LEER], nr: 0, verlaeufe: {} })
  const [kamera, setKamera] = useState<Kamera>({ x: 0, y: 0, zoom: 1 })
  const [fenster, setFenster] = useState<FensterZustand[]>([])
  const [werkzeug, setWerkzeug] = useState<Werkzeug>('stift')
  const [farbe, setFarbe] = useState<string>(FARBEN[0].wert)
  const [staerke, setStaerke] = useState<number>(STAERKEN[1].wert)
  const [radierer, setRadierer] = useState<Radierer>(RADIERER_STANDARD)
  const [eigeneFarben, setEigeneFarben] = useState<string[]>([])
  const [auswahlRoh, setAuswahl] = useState<string[]>([])
  const [speicher, setSpeicher] = useState<Speicherstand>('laedt')
  /** Die Klasse aus der Adresse gibt es auf diesem Gerät nicht */
  const [fehlt, setFehlt] = useState(false)
  /** Hinweis in der Kopfzeile: Fortschritt, Erfolg oder Fehler bei Bildern und PDF */
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean; laeuft?: boolean } | null>(null)
  const flaeche = useRef<HTMLDivElement>(null)
  const bildWahl = useRef<HTMLInputElement>(null)
  const pdfWahl = useRef<HTMLInputElement>(null)
  const [teilbar] = useState(kannTeilen)

  const seite = buch.seiten[buch.nr] ?? LEER
  const verlauf = buch.verlaeufe[seite.id] ?? leererVerlauf()
  // Ausgewählt kann nur sein, was es auf der gezeigten Seite (noch) gibt
  const auswahl = auswahlRoh.filter((id) => seite.elemente.some((e) => e.id === id))
  const gewaehlte = seite.elemente.filter((e) => auswahl.includes(e.id))

  // ---------- Laden: zuletzt benutzte Tafel oder eine neue ----------
  useEffect(() => {
    let abgebrochen = false
    ;(klasseId ? oeffneKlassenTafel(klasseId) : ladeFreieTafel())
      .catch(() => null)
      .then(async (gefunden) => {
        if (abgebrochen) return
        if (klasseId && !gefunden) {
          setFehlt(true)
          return
        }
        const t = gefunden ?? neuesTafelbild()
        if (!gefunden) void merkeFreieTafel(t.id).catch(() => undefined) // neue freie Tafel: gleich festhalten, welche es ist
        setKopf({ schema: t.schema, version: t.version, id: t.id, titel: t.titel })
        setBuch({ seiten: t.seiten, nr: t.seiteNr, verlaeufe: {} })
        setKamera(t.kamera)
        setFenster(t.fenster)
        setSpeicher('gespeichert')
        // Bilder wegräumen, die keine Tafel mehr braucht – dabei ALLE Tafeln berücksichtigen, nicht nur diese,
        // und die Kopie zum Einfügen (ein kopiertes Bild bleibt einfügbar, auch wenn das Original gelöscht ist)
        void Promise.all([ladeAlleTafeln(), ladeAblage().catch(() => null)])
          .then(([alle, kopie]) => {
            if (abgebrochen) return // Tafel schon wieder geschlossen: beim nächsten Öffnen wird aufgeräumt
            const seiten = [...alle, t].flatMap((x) => x.seiten)
            if (kopie) seiten.push({ id: '', elemente: kopie.elemente })
            return raeumeDateienAuf(benutzteDateien(seiten))
          })
          .catch(() => undefined)
      })
    return () => {
      abgebrochen = true
    }
  }, [klasseId])

  // ---------- Automatisch speichern ----------
  const aktuell = useRef<Tafelbild | null>(null)
  const offen = useRef(false) // gibt es Ungespeichertes?
  const geladen = useRef(false)

  const jetztSpeichern = useCallback(() => {
    const t = aktuell.current
    if (!t || !offen.current) return
    offen.current = false
    speichereTafel({ ...t, geaendertAm: new Date().toISOString() }).then(
      () => setSpeicher(offen.current ? 'ungespeichert' : 'gespeichert'),
      () => {
        offen.current = true
        setSpeicher('fehler')
      },
    )
  }, [])

  useEffect(() => {
    if (!kopf) return
    aktuell.current = { ...kopf, seiten: buch.seiten, seiteNr: buch.nr, kamera, fenster, geaendertAm: '' }
    if (!geladen.current) {
      geladen.current = true // der erste Durchlauf ist das Laden selbst, keine Änderung
      return
    }
    offen.current = true
    setSpeicher('ungespeichert')
    const warten = setTimeout(jetztSpeichern, SPEICHERN_NACH_MS)
    return () => clearTimeout(warten)
  }, [kopf, buch.seiten, buch.nr, kamera, fenster, jetztSpeichern])

  // Beim Verlassen oder Wegschalten sofort speichern (Schutz vor versehentlichem Schließen)
  useEffect(() => {
    const sichern = () => {
      if (document.visibilityState === 'hidden') jetztSpeichern()
    }
    document.addEventListener('visibilitychange', sichern)
    window.addEventListener('pagehide', jetztSpeichern)
    return () => {
      document.removeEventListener('visibilitychange', sichern)
      window.removeEventListener('pagehide', jetztSpeichern)
    }
  }, [jetztSpeichern])

  // ---------- Änderungen an der gezeigten Seite ----------
  /** Wendet eine Änderung (Elemente + Verlauf) auf die gezeigte Seite an. */
  const aendereSeite = useCallback((tun: (elemente: Element[], verlauf: Verlauf) => { elemente: Element[]; verlauf: Verlauf }) => {
    setBuch((alt) => {
      const s = alt.seiten[alt.nr]
      if (!s) return alt
      const neu = tun(s.elemente, alt.verlaeufe[s.id] ?? leererVerlauf())
      if (neu.elemente === s.elemente) return alt
      return { ...alt, seiten: alt.seiten.map((x) => (x === s ? { ...s, elemente: neu.elemente } : x)), verlaeufe: { ...alt.verlaeufe, [s.id]: neu.verlauf } }
    })
  }, [])
  const fuehreAus = useCallback((b: Befehl | null) => b && aendereSeite((e, v) => ausfuehren(e, v, b)), [aendereSeite])

  const dauerhaftGefragt = useRef(false)
  const beiHinzu = useCallback(
    (e: Element) => {
      fuehreAus({ art: 'hinzufuegen', elemente: [e] })
      if (!dauerhaftGefragt.current) {
        dauerhaftGefragt.current = true
        void bitteUmDauerhaftenSpeicher()
      }
    },
    [fuehreAus],
  )
  const entferne = useCallback(
    (ids: string[]) =>
      aendereSeite((e, v) => {
        const b = entfernenBefehl(e, ids)
        return b ? ausfuehren(e, v, b) : { elemente: e, verlauf: v }
      }),
    [aendereSeite],
  )
  const beiErsetzen = useCallback((vorher: Element[], nachher: Element[]) => fuehreAus({ art: 'ersetzen', vorher, nachher }), [fuehreAus])
  const zurueck = useCallback(() => aendereSeite(rueckgaengig), [aendereSeite])
  const vor = useCallback(() => aendereSeite(wiederholen), [aendereSeite])

  const loescheAuswahl = () => {
    entferne(auswahl)
    setAuswahl([])
  }
  const dopple = () => {
    if (!gewaehlte.length) return
    const kopien = kopiere(gewaehlte, 24, 24) // eine kopierte Gruppe ist wieder eine (eigene) Gruppe
    fuehreAus({ art: 'hinzufuegen', elemente: kopien })
    setAuswahl(kopien.map((e) => e.id))
  }

  // ---------- Kopieren, Ausschneiden, Einfügen (auch zwischen Tafeln; die Kopie liegt nur auf dem Gerät) ----------
  const [ablage, setAblage] = useState<Ablage | null>(null)
  useEffect(() => {
    let weg = false
    ladeAblage()
      .then((a) => {
        if (!weg && a) setAblage((jetzt) => jetzt ?? a)
      })
      .catch(() => undefined)
    return () => {
      weg = true
    }
  }, [])
  /**
   * Kopiert die Auswahl in die Ablage. Zusätzlich kommt ein kurzer Hinweis in die Zwischenablage des Systems –
   * sonst läge dort noch ein früher kopiertes Bild, und Strg + V würde dieses statt der Kopie einfügen.
   * (Beim Kopieren mit Strg + C setzt das Kopieren-Ereignis den Hinweis selbst.)
   */
  const kopiereAuswahl = (hinweisSchonGesetzt = false) => {
    if (!gewaehlte.length) return
    if (!hinweisSchonGesetzt) navigator.clipboard?.writeText(KOPIE_HINWEIS).catch(() => undefined)
    const a = neueAblage(gewaehlte)
    setAblage(a)
    merkeAblage(a).catch(() => setMeldung({ text: 'Die Kopie ließ sich auf diesem Gerät nicht speichern.', fehler: true }))
  }
  const schneideAus = (hinweisSchonGesetzt = false) => {
    kopiereAuswahl(hinweisSchonGesetzt)
    loescheAuswahl()
  }
  /** Fügt die Kopie in der Mitte des sichtbaren Ausschnitts ein und wählt sie aus */
  const fuegeEin = () => {
    if (!ablage) return
    const [mx, my] = zuTafel(kamera, (flaeche.current?.clientWidth || 800) / 2, (flaeche.current?.clientHeight || 600) / 2)
    const neu = einzufuegen(ablage, mx, my)
    if (!neu.length) return
    fuehreAus({ art: 'hinzufuegen', elemente: neu })
    setWerkzeug('auswahl')
    setAuswahl(neu.map((e) => e.id))
  }

  // ---------- Gruppieren und Reihenfolge ----------
  const eineGruppe = istEineGruppe(gewaehlte)
  const gruppiereOderLoese = () => {
    if (gewaehlte.length < 2) return
    beiErsetzen(gewaehlte, eineGruppe ? geloest(gewaehlte) : gruppiert(gewaehlte, neueId()))
  }
  const ordne = (richtung: 'vorne' | 'hinten') => fuehreAus(ordnenBefehl(seite.elemente, auswahl, richtung))
  /** Farbe wählen: gilt für Neues – und färbt die Auswahl um */
  const waehleFarbe = (f: string) => {
    setFarbe(f)
    if (werkzeug === 'radierer') setWerkzeug('stift')
    const andere = gewaehlte.filter((e): e is Exclude<Element, Bild> => e.art !== 'bild' && e.farbe !== f)
    if (andere.length) beiErsetzen(andere, andere.map((e) => ({ ...e, farbe: f })))
  }
  // Eigene Farbplätze (je Gerät): laden; eine Farbe aus dem Farbwähler kommt vorne dazu
  useEffect(() => {
    let weg = false
    ladeFarbplaetze()
      .then((f) => !weg && setEigeneFarben((jetzt) => (jetzt.length ? jetzt : f)))
      .catch(() => undefined)
    return () => {
      weg = true
    }
  }, [])
  const waehleEigeneFarbe = (f: string) => {
    if (!istFarbwert(f)) return
    waehleFarbe(normiereFarbe(f))
    const neu = mitEigenerFarbe(eigeneFarben, f)
    if (neu === eigeneFarben) return
    setEigeneFarben(neu)
    merkeFarbplaetze(neu).catch(() => setMeldung({ text: 'Die Farbe ließ sich auf diesem Gerät nicht merken.', fehler: true }))
  }
  /** Stärke wählen: gilt für Neues – und ändert Strichbreite bzw. Schriftgröße der Auswahl */
  const waehleStaerke = (s: number) => {
    setStaerke(s)
    const neu = gewaehlte.map((e): Element => (e.art === 'bild' ? e : e.art === 'text' ? { ...e, groesse: schriftgroesse(s) } : { ...e, staerke: s }))
    const geaendert = gewaehlte.filter((e, i) => JSON.stringify(e) !== JSON.stringify(neu[i]))
    if (geaendert.length) beiErsetzen(geaendert, neu.filter((_, i) => geaendert.includes(gewaehlte[i])))
  }
  const waehleWerkzeug = (w: Werkzeug) => {
    setWerkzeug(w)
    if (w !== 'auswahl') setAuswahl([])
  }
  /** Strg + A: alles auf der Seite auswählen (der Hintergrund gehört nicht dazu) */
  const waehleAlles = () => {
    setWerkzeug('auswahl')
    setAuswahl(seite.elemente.map((e) => e.id))
  }

  // ---------- Seiten ----------
  const blaettern = (tun: (b: Seitenfolge) => Seitenfolge) => {
    setAuswahl([])
    setBuch((alt) => ({ ...alt, ...tun(alt) }))
  }

  // ---------- Bilder und PDF ----------
  useEffect(() => {
    if (!meldung || meldung.laeuft) return
    const t = setTimeout(() => setMeldung(null), meldung.fehler ? 9000 : 5000)
    return () => clearTimeout(t)
  }, [meldung])
  const fehlerMeldung = (e: unknown) => setMeldung({ text: e instanceof Error ? e.message : 'Das hat nicht geklappt.', fehler: true })

  /** Legt Bilder in die Mitte des sichtbaren Ausschnitts (mehrere leicht versetzt) und wählt das letzte aus. */
  async function fuegeBilderEin(dateien: Blob[]) {
    if (!dateien.length) return
    setMeldung({ text: dateien.length === 1 ? 'Bild wird eingefügt …' : 'Bilder werden eingefügt …', laeuft: true })
    try {
      const b = flaeche.current?.clientWidth || 800
      const h = flaeche.current?.clientHeight || 600
      const [mx, my] = zuTafel(kamera, b / 2, h / 2)
      let letzte = ''
      for (const [i, datei] of dateien.entries()) {
        const fertig = await nimmBild(datei)
        const [bb, bh] = einpassen(fertig.b, fertig.h, (b * 0.6) / kamera.zoom, (h * 0.6) / kamera.zoom)
        const bild: Bild = { art: 'bild', id: neueId(), x: Math.round(mx - bb / 2 + i * 24), y: Math.round(my - bh / 2 + i * 24), b: bb, h: bh, dateiId: fertig.dateiId }
        beiHinzu(bild)
        letzte = bild.id
      }
      setWerkzeug('auswahl')
      setAuswahl([letzte])
      setMeldung(null)
    } catch (e) {
      fehlerMeldung(e)
    }
  }

  async function oeffnePdf(datei: Blob) {
    const platz = buch.seiten.length === 1 && !seite.elemente.length && !seite.hintergrund ? MAX_SEITEN : MAX_SEITEN - buch.seiten.length
    if (platz <= 0) return setMeldung({ text: `Mehr als ${MAX_SEITEN} Seiten gehen nicht.`, fehler: true })
    setMeldung({ text: 'PDF wird geöffnet …', laeuft: true })
    try {
      const { seiten, ausgelassen } = await importierePdf(datei, platz, (nr, von) => setMeldung({ text: `PDF: Seite ${nr} von ${von} …`, laeuft: true }))
      blaettern((b) => seitenDazu(b, seiten))
      setKamera({ x: 0, y: 0, zoom: 1 })
      setMeldung({ text: (seiten.length === 1 ? '1 Seite eingefügt.' : `${seiten.length} Seiten eingefügt.`) + (ausgelassen ? ` ${ausgelassen} weitere passen nicht mehr (höchstens ${MAX_SEITEN}).` : ''), fehler: ausgelassen > 0 })
    } catch (e) {
      fehlerMeldung(e)
    }
  }

  async function alsPdf(weitergeben: boolean) {
    setMeldung({ text: 'PDF wird erstellt …', laeuft: true })
    try {
      const titel = kopf?.titel ?? 'Tafel'
      const pdf = await exportierePdf(buch.seiten, titel, (nr, von) => setMeldung({ text: `PDF: Seite ${nr} von ${von} …`, laeuft: true }))
      if (weitergeben) {
        setMeldung(null)
        await teile(pdf, pdfName(titel), titel)
      } else {
        ladeHerunter(pdf, pdfName(titel))
        setMeldung({ text: 'PDF gespeichert.' })
      }
    } catch (e) {
      fehlerMeldung(e)
    }
  }

  /** Dateien aus Auswahl, Zwischenablage oder Hineinziehen: Bilder kommen auf die Seite, ein PDF wird zu neuen Seiten. */
  function nimmDateien(dateien: File[]) {
    const pdf = dateien.find(istPdf)
    const bilder = dateien.filter(istBilddatei)
    if (pdf) void oeffnePdf(pdf)
    else if (bilder.length) void fuegeBilderEin(bilder)
    else if (dateien.length) setMeldung({ text: 'Diese Datei lässt sich nicht einfügen (möglich sind Bilder und PDF).', fehler: true })
  }
  const dateien = useRef(nimmDateien)
  dateien.current = nimmDateien
  /**
   * Strg + C / X / V: Kommt danach kein Ereignis des Browsers (manche Geräte und Bildschirmtastaturen senden keins),
   * wird nach kurzer Zeit trotzdem kopiert, ausgeschnitten oder eingefügt – sonst erledigt das Ereignis es.
   */
  const ersatzGeplant = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ersatzWeg = () => {
    if (ersatzGeplant.current) clearTimeout(ersatzGeplant.current)
    ersatzGeplant.current = null
  }
  // Strg + C / Strg + X: über die Ereignisse des Browsers, damit der Hinweis in die Zwischenablage des Systems kommt
  useEffect(() => {
    const kopieren = (e: ClipboardEvent) => {
      const ziel = e.target as HTMLElement | null
      if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.isContentEditable)) return
      if (!tasten.current.auswahl.length) return
      ersatzWeg()
      e.preventDefault()
      e.clipboardData?.setData('text/plain', KOPIE_HINWEIS)
      if (e.type === 'cut') tasten.current.schneideAus(true)
      else tasten.current.kopiereAuswahl(true)
    }
    window.addEventListener('copy', kopieren)
    window.addEventListener('cut', kopieren)
    return () => {
      window.removeEventListener('copy', kopieren)
      window.removeEventListener('cut', kopieren)
    }
  }, [])
  useEffect(() => {
    const einfuegen = (e: ClipboardEvent) => {
      const ziel = e.target as HTMLElement | null
      if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA')) return
      ersatzWeg()
      const gefunden = [...(e.clipboardData?.files ?? [])]
      e.preventDefault()
      if (gefunden.length) dateien.current(gefunden)
      else tasten.current.fuegeEin() // nichts von außen: die Kopie aus der Tafel einfügen
    }
    window.addEventListener('paste', einfuegen)
    return () => window.removeEventListener('paste', einfuegen)
  }, [])

  // ---------- Tastatur ----------
  const tasten = useRef({ zurueck, vor, loescheAuswahl, dopple, waehleWerkzeug, waehleAlles, kopiereAuswahl, schneideAus, fuegeEin, gruppiereOderLoese, auswahl })
  tasten.current = { zurueck, vor, loescheAuswahl, dopple, waehleWerkzeug, waehleAlles, kopiereAuswahl, schneideAus, fuegeEin, gruppiereOderLoese, auswahl }
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null
      if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.tagName === 'SELECT' || ziel.isContentEditable)) return
      const t = tasten.current
      const k = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z' && !e.shiftKey) t.zurueck()
        else if (k === 'y' || (k === 'z' && e.shiftKey)) t.vor()
        else if (k === 'd' && t.auswahl.length) t.dopple()
        else if (k === 'a') t.waehleAlles()
        else if (k === 'g' && t.auswahl.length > 1) t.gruppiereOderLoese()
        else if (k === 'v' || ((k === 'c' || k === 'x') && t.auswahl.length)) {
          // nicht verhindern: sonst käme kein Ereignis des Browsers (und kein Bild aus der Zwischenablage) mehr
          ersatzWeg()
          ersatzGeplant.current = setTimeout(() => {
            ersatzGeplant.current = null
            const jetzt = tasten.current
            if (k === 'v') jetzt.fuegeEin()
            else if (k === 'x') jetzt.schneideAus()
            else jetzt.kopiereAuswahl()
          }, 150)
          return
        } else return
        e.preventDefault()
        return
      }
      if (e.altKey) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && t.auswahl.length) {
        e.preventDefault()
        t.loescheAuswahl()
      } else if (e.key === 'Escape' && t.auswahl.length) setAuswahl([])
      else if (e.key === 'PageDown') blaettern((b) => gehe(b, b.nr + 1))
      else if (e.key === 'PageUp') blaettern((b) => gehe(b, b.nr - 1))
      else {
        const w = WERKZEUGE.find((x) => x.taste.toLowerCase() === k) ?? (k === 'e' ? WERKZEUGE.find((x) => x.wert === 'radierer') : undefined)
        if (w) t.waehleWerkzeug(w.wert)
      }
    }
    window.addEventListener('keydown', taste)
    return () => {
      window.removeEventListener('keydown', taste)
      ersatzWeg()
    }
  }, [])

  // ---------- Auswahlleiste ----------
  // Solange auf der Fläche gezogen wird (Verschieben, Drehen, Größe), steht die Leiste nicht im Weg
  const [zieht, setZieht] = useState(false)
  const inhalt = werkzeug === 'auswahl' && !zieht ? gesamtRahmen(gewaehlte) : null
  const leistenRahmen: Rechteck | null = inhalt && [
    kamera.x + inhalt[0] * kamera.zoom - AUSWAHL_RAND,
    kamera.y + inhalt[1] * kamera.zoom - AUSWAHL_RAND,
    kamera.x + inhalt[2] * kamera.zoom + AUSWAHL_RAND,
    kamera.y + inhalt[3] * kamera.zoom + AUSWAHL_RAND,
  ]
  const auswahlKnoepfe: Befehlsknopf[] = [
    { name: 'Kopieren', symbol: 'kopieren', titel: 'Kopieren – einfügen lässt es sich auch in einer anderen Tafel (Strg + C)', tun: () => kopiereAuswahl() },
    { name: 'Ausschneiden', symbol: 'ausschneiden', titel: 'Ausschneiden (Strg + X)', tun: () => schneideAus() },
    { name: 'Auswahl duplizieren', symbol: 'duplizieren', titel: 'Duplizieren (Strg + D)', tun: dopple },
    ...(gewaehlte.length > 1
      ? [
          eineGruppe
            ? { name: 'Gruppe lösen', symbol: 'loesen' as const, titel: 'Gruppe lösen (Strg + G)', tun: gruppiereOderLoese }
            : { name: 'Gruppieren', symbol: 'gruppieren' as const, titel: 'Gruppieren – Antippen wählt dann alles zusammen (Strg + G)', tun: gruppiereOderLoese },
        ]
      : []),
    { name: 'Ganz nach vorne', symbol: 'ganzVorne', titel: 'Ganz nach vorne – liegt über allem anderen', tun: () => ordne('vorne') },
    { name: 'Ganz nach hinten', symbol: 'ganzHinten', titel: 'Ganz nach hinten – liegt unter allem anderen', tun: () => ordne('hinten') },
    { name: 'Löschen', symbol: 'leeren', titel: 'Löschen (Entf)', tun: loescheAuswahl },
  ]

  const zoomen = (faktor: number) => setKamera((k) => zoomeUm(k, window.innerWidth / 2, window.innerHeight / 2, faktor))
  const ansichtZurueck = () => setKamera({ x: 0, y: 0, zoom: 1 })

  if (fehlt) {
    return (
      <main className="hinweisseite">
        <h1>Diese Klasse gibt es auf diesem Gerät nicht</h1>
        <p>Klassen und ihre Tafeln werden nur auf dem Gerät gespeichert, auf dem sie angelegt wurden.</p>
        <p>
          <a className="f-knopf haupt" href="#/klassen">
            Zu meinen Klassen
          </a>{' '}
          <a className="f-knopf" href="#/tafel">
            Freie Tafel öffnen
          </a>
        </p>
      </main>
    )
  }

  return (
    <div className="tafel">
      <header className="tafel-kopf">
        <a className="kopf-knopf" href="/" aria-label="Zur Startseite Lehrraum" title="Zur Startseite">
          <Symbol name="haus" />
        </a>
        <a className="kopf-knopf" href="#/klassen" aria-label="Meine Klassen" title="Meine Klassen">
          <Symbol name="klassen" />
        </a>
        <h1>{kopf?.titel ?? 'Tafel'}</h1>
        <p className={'speicherstand ' + (meldung ? (meldung.fehler ? 'fehler' : 'hinweis') : speicher)} role="status">
          {meldung?.text ?? SPEICHERTEXT[speicher]}
        </p>
        <div className="zoom" role="group" aria-label="PDF">
          <button type="button" className="kopf-knopf" aria-label="PDF öffnen" title="PDF öffnen – jede Seite wird eine Tafelseite zum Beschriften" disabled={meldung?.laeuft} onClick={() => pdfWahl.current?.click()}>
            <Symbol name="pdfOeffnen" />
          </button>
          <button type="button" className="kopf-knopf" aria-label="Als PDF speichern" title="Alle Seiten als PDF speichern" disabled={meldung?.laeuft} onClick={() => void alsPdf(false)}>
            <Symbol name="pdfSpeichern" />
          </button>
          {teilbar && (
            <button type="button" className="kopf-knopf" aria-label="Als PDF teilen" title="Als PDF teilen, z. B. an Goodnotes" disabled={meldung?.laeuft} onClick={() => void alsPdf(true)}>
              <Symbol name="teilen" />
            </button>
          )}
        </div>
        <input ref={pdfWahl} type="file" accept="application/pdf,.pdf" hidden aria-label="PDF-Datei wählen" onChange={(e) => { nimmDateien([...(e.target.files ?? [])]); e.target.value = '' }} />
        <input ref={bildWahl} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple hidden aria-label="Bilddatei wählen" onChange={(e) => { nimmDateien([...(e.target.files ?? [])]); e.target.value = '' }} />
        <div className="zoom" role="group" aria-label="Ansicht">
          <button type="button" className="kopf-knopf" aria-label="Verkleinern" onClick={() => zoomen(1 / 1.25)}>
            −
          </button>
          <button type="button" className="kopf-knopf breit" aria-label="Ansicht zurücksetzen" title="Ansicht zurücksetzen" onClick={ansichtZurueck}>
            {Math.round(kamera.zoom * 100)} %
          </button>
          <button type="button" className="kopf-knopf" aria-label="Vergrößern" onClick={() => zoomen(1.25)}>
            +
          </button>
        </div>
      </header>
      <div className="tafel-mitte">
        <Werkzeugleiste
          werkzeug={werkzeug}
          farbe={farbe}
          staerke={staerke}
          radierer={radierer}
          beiRadierer={setRadierer}
          eigeneFarben={eigeneFarben}
          beiEigeneFarbe={waehleEigeneFarbe}
          kannZurueck={verlauf.zurueck.length > 0}
          kannVor={verlauf.vor.length > 0}
          leer={seite.elemente.length === 0}
          gewaehlt={auswahl.length}
          beiWerkzeug={waehleWerkzeug}
          beiFarbe={waehleFarbe}
          beiStaerke={waehleStaerke}
          beiZurueck={zurueck}
          beiVor={vor}
          beiLeeren={() => entferne(seite.elemente.map((e) => e.id))}
          kannEinfuegen={ablage !== null}
          beiEinfuegen={fuegeEin}
          beiLoeschen={loescheAuswahl}
          beiBild={() => bildWahl.current?.click()}
        />
        <div className="tafel-spalte">
          <div
            className="tafel-flaeche"
            ref={flaeche}
            onPointerDown={(e) => (e.target as HTMLElement).closest('[data-testid="zeichenflaeche"]') && setZieht(true)}
            onPointerUp={() => setZieht(false)}
            onPointerCancel={() => setZieht(false)}
            onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
            onDrop={(e) => {
              if (!e.dataTransfer.files.length) return
              e.preventDefault()
              nimmDateien([...e.dataTransfer.files])
            }}
          >
            <Zeichenflaeche
              key={seite.id}
              elemente={seite.elemente}
              hintergrund={seite.hintergrund}
              kamera={kamera}
              werkzeug={werkzeug}
              farbe={farbe}
              staerke={staerke}
              radierer={radierer}
              auswahl={auswahl}
              beiHinzu={beiHinzu}
              beiRadieren={entferne}
              beiBefehl={fuehreAus}
              beiErsetzen={beiErsetzen}
              beiAuswahl={setAuswahl}
              beiKamera={setKamera}
            />
            {leistenRahmen && <Auswahlleiste rahmen={leistenRahmen} knoepfe={auswahlKnoepfe} />}
            <Fensterebene fenster={fenster} beiAendern={setFenster} />
            {pruefen && <Pruefansicht elemente={seite.elemente.length} />}
          </div>
          <Seitenleiste
            nr={buch.nr}
            anzahl={buch.seiten.length}
            beschrieben={seite.elemente.length > 0 || seite.hintergrund !== undefined}
            beiGehe={(nr) => blaettern((b) => gehe(b, nr))}
            beiNeu={() => blaettern(seiteDazu)}
            beiDoppelt={() => blaettern(seiteDoppelt)}
            beiSchieben={(r) => blaettern((b) => seiteSchieben(b, r))}
            beiLoeschen={() => blaettern(seiteWeg)}
          />
        </div>
        <Schnellleiste fenster={fenster} beiAendern={setFenster} />
      </div>
    </div>
  )
}
