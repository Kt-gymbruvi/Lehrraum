// Die Tafel: Kopfzeile, linke Werkzeugleiste, Zeichenfläche mit Fenstern darüber, rechte Schnellzugriffsleiste,
// unten die Seiten. Speichert automatisch auf diesem Gerät und stellt beim Öffnen die zuletzt benutzte Tafel wieder her.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Fensterebene, Schnellleiste } from '../fenster/Fensterebene.tsx'
import { einzufuegen, neueAblage, type Ablage } from '../kern/ablage.ts'
import { AUSWAHL_RAND, geloest, gruppiert, istEineGruppe } from '../kern/auswahl.ts'
import { ausfuehrenAuf, entfernenBefehl, inhaltVon, leererVerlauf, ordnenBefehl, rueckgaengigAuf, wiederholenAuf, type Befehl, type Inhalt, type Verlauf } from '../kern/befehle.ts'
import type { FensterZustand } from '../kern/fenster.ts'
import { einpassen, gesamtRahmen, textMass, zoomeUm, zuTafel, type Rechteck } from '../kern/geometrie.ts'
import { alsHintergrundBefehl, aufsBlattBefehl, begrenzt, bildHintergrund, bildHintergrundBefehl, blattVon, eingepasst, istEingepasst, seitenMitUeberstand, type Blatt } from '../kern/blatt.ts'
import { geaendert, vorlageAus, type Klasse } from '../kern/klassen.ts'
import { benutzteDateien, MAX_SEITEN, MAX_TEXT, neueId, neuesTafelbild, schriftgroesse, type Bild, type Element, type Format, type Kamera, type Muster, type Seite, type Tafelbild } from '../kern/modell.ts'
import { gleichesMuster } from '../kern/muster.ts'
import type { Radierer } from '../kern/radieren.ts'
import { istFarbwert, mitEigenerFarbe, normiereFarbe } from '../kern/farben.ts'
import { drehBefehl, gehe, hintergrundWegBefehl, inReihenfolge, kopiere, seiteDazu, seiteDoppelt, seiteDoppeltBei, seitenDazu, seiteSchieben, seiteVerschieben, seiteWeg, seiteWegBei, type Buch as Seitenfolge } from '../kern/seiten.ts'
import { Seitenuebersicht } from './Seitenuebersicht.tsx'
import { STANDARD_EINSTELLUNGEN } from '../kern/einstellungen.ts'
import { bitteUmDauerhaftenSpeicher, ladeAblage, ladeKlasse, speichereKlasse, ladeAlleTafeln, ladeEinstellungen, ladeFarbplaetze, ladeFreieTafel, merkeAblage, merkeEinstellungen, merkeFarbplaetze, merkeFreieTafel, oeffneKlassenTafel, speichereTafel } from '../speicher/datenbank.ts'
import { raeumeDateienAuf } from '../speicher/dateien.ts'
import { gleicheAb } from '../speicher/abgleich.ts'
import { istBilddatei, nimmBild } from './bilder.ts'
import { exportierePdf, importierePdf, istPdf, kannTeilen, ladeHerunter, pdfName, teile } from './pdf.ts'
import { Symbol } from '../ui/Symbol.tsx'
import { Auswahlleiste, type Befehlsknopf } from './Auswahlleiste.tsx'
import { Formatwahl } from './Formatwahl.tsx'
import { Hintergrundwahl } from './Hintergrundwahl.tsx'

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
/** Seite mit neuem Inhalt; Kennung und eigenes Blattmaß (PDF-Seite) bleiben */
const alsSeite = (s: Seite, i: Inhalt): Seite => ({ id: s.id, ...inhaltVon(i), ...(s.blatt ? { blatt: s.blatt } : {}) })

/**
 * Ohne `klasseId` öffnet sich die freie Tafel, sonst die Tafel dieser Klasse (wird beim ersten Öffnen angelegt).
 * `pruefen` blendet die Prüfansicht ein (Messwerte zum Schreiben am Gerät).
 */
export default function Tafel({ klasseId, pruefen = false }: { klasseId?: string; pruefen?: boolean }) {
  const [kopf, setKopf] = useState<Pick<Tafelbild, 'schema' | 'version' | 'id' | 'titel'> | null>(null)
  const [buch, setBuch] = useState<Buch>({ seiten: [LEER], nr: 0, verlaeufe: {} })
  const [kamera, setKameraRoh] = useState<Kamera>({ x: 0, y: 0, zoom: 1 })
  const [format, setFormat] = useState<Format>('unendlich')
  const [fenster, setFenster] = useState<FensterZustand[]>([])
  const [werkzeug, setWerkzeug] = useState<Werkzeug>(STANDARD_EINSTELLUNGEN.werkzeug)
  const [farbe, setFarbe] = useState<string>(STANDARD_EINSTELLUNGEN.farbe)
  const [staerke, setStaerke] = useState<number>(STANDARD_EINSTELLUNGEN.staerke)
  const [radierer, setRadierer] = useState<Radierer>(STANDARD_EINSTELLUNGEN.radierer)
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
  /** Die Klasse dieser Tafel (für ihre Vorlage); null bei der freien Tafel */
  const [klasse, setKlasse] = useState<Klasse | null>(null)
  const hintergrundBildWahl = useRef<HTMLInputElement>(null)
  const hintergrundFuerAlle = useRef(false)

  const seite = buch.seiten[buch.nr] ?? LEER
  const verlauf = buch.verlaeufe[seite.id] ?? leererVerlauf()
  // Ausgewählt kann nur sein, was es auf der gezeigten Seite (noch) gibt
  const auswahl = auswahlRoh.filter((id) => seite.elemente.some((e) => e.id === id))
  const gewaehlte = seite.elemente.filter((e) => auswahl.includes(e.id))

  // ---------- Blatt: Seiten mit fester Größe ----------
  // Größe der Fläche (für Einpassen und Begrenzen der Ansicht)
  const [mass, setMass] = useState({ b: 0, h: 0 })
  useLayoutEffect(() => {
    const el = flaeche.current
    if (!el) return
    const messen = () => setMass((alt) => (alt.b === el.clientWidth && alt.h === el.clientHeight ? alt : { b: el.clientWidth, h: el.clientHeight }))
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [fehlt])
  const blattB = blattVon(format, seite)?.[0]
  const blattH = blattVon(format, seite)?.[1]
  // dasselbe Blatt behält dieselbe Liste – sonst zeichnete die Fläche bei jedem Durchlauf ganz neu
  const blatt = useMemo<Blatt | null>(() => (blattB !== undefined && blattH !== undefined ? [blattB, blattH] : null), [blattB, blattH])
  const begrenze = useCallback((k: Kamera) => begrenzt(k, blatt, mass.b, mass.h), [blatt, mass])
  const setKamera = useCallback((k: Kamera | ((alt: Kamera) => Kamera)) => setKameraRoh((alt) => begrenze(typeof k === 'function' ? k(alt) : k)), [begrenze])
  const passeEin = useCallback(() => {
    if (blatt && mass.b > 0 && mass.h > 0) setKameraRoh(eingepasst(blatt, mass.b, mass.h))
  }, [blatt, mass])
  // Neue Seite, anderes Blatt oder anderes Format: das ganze Blatt zeigen
  useEffect(passeEin, [seite.id, blatt, format]) // eslint-disable-line react-hooks/exhaustive-deps
  // Andere Größe der Fläche: war das ganze Blatt zu sehen, bleibt es so; sonst nur begrenzen
  const altesMass = useRef(mass)
  useEffect(() => {
    const vorher = altesMass.current
    altesMass.current = mass
    if (!blatt) return
    setKameraRoh((k) => (vorher.b <= 0 || istEingepasst(k, blatt, vorher.b, vorher.h) ? (mass.b > 0 ? eingepasst(blatt, mass.b, mass.h) : k) : begrenzt(k, blatt, mass.b, mass.h)))
  }, [mass]) // eslint-disable-line react-hooks/exhaustive-deps
  const ueberstand = useMemo(() => (format === 'unendlich' ? 0 : seitenMitUeberstand(buch.seiten, format)), [buch.seiten, format])
  /** Holt auf allen Seiten den Inhalt aufs Blatt – je Seite ein Schritt in ihrem Verlauf */
  const inhaltEinpassen = () =>
    setBuch((alt) => {
      const verlaeufe = { ...alt.verlaeufe }
      const seiten = alt.seiten.map((s) => {
        const b = blattVon(format, s)
        const befehl = b && aufsBlattBefehl(s, b)
        if (!befehl) return s
        const neu = ausfuehrenAuf(inhaltVon(s), alt.verlaeufe[s.id] ?? leererVerlauf(), befehl)
        verlaeufe[s.id] = neu.verlauf
        return { ...s, elemente: neu.inhalt.elemente }
      })
      return { ...alt, seiten, verlaeufe }
    })

  // ---------- Einstellungen merken (je Gerät): erst nach dem Laden, und ohne den Speicherstand der Tafel zu berühren ----------
  const einstellungenDa = useRef(false)
  useEffect(() => {
    if (!einstellungenDa.current) return
    merkeEinstellungen({ werkzeug, farbe, staerke, radierer }).catch(() => undefined) // misslingt es, startet die Tafel eben wie neu
  }, [werkzeug, farbe, staerke, radierer])

  // ---------- Laden: zuletzt benutzte Tafel oder eine neue ----------
  useEffect(() => {
    let abgebrochen = false
    // Die zuletzt benutzten Einstellungen kommen zusammen mit der Tafel – so ist alles da, bevor gezeichnet wird
    Promise.all([(klasseId ? oeffneKlassenTafel(klasseId) : ladeFreieTafel()).catch(() => null), ladeEinstellungen().catch(() => STANDARD_EINSTELLUNGEN)])
      .then(async ([gefunden, e]) => {
        if (abgebrochen) return
        if (klasseId && !gefunden) {
          setFehlt(true)
          return
        }
        if (klasseId) {
          const holeKlasse = () => ladeKlasse(klasseId).then((k) => !abgebrochen && k && setKlasse(k), () => undefined)
          void holeKlasse()
          // Neue Namen aus dem Notenbuch oder von anderen Geräten (still im Hintergrund)
          void gleicheAb().then(holeKlasse)
        }
        setWerkzeug(e.werkzeug)
        setFarbe(e.farbe)
        setStaerke(e.staerke)
        setRadierer(e.radierer)
        einstellungenDa.current = true
        const t = gefunden ?? neuesTafelbild()
        if (!gefunden) void merkeFreieTafel(t.id).catch(() => undefined) // neue freie Tafel: gleich festhalten, welche es ist
        setKopf({ schema: t.schema, version: t.version, id: t.id, titel: t.titel })
        setFormat(t.format)
        setBuch({ seiten: t.seiten, nr: t.seiteNr, verlaeufe: {} })
        setKameraRoh(t.kamera) // mit festem Format wird gleich danach eingepasst
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
    aktuell.current = { ...kopf, format, seiten: buch.seiten, seiteNr: buch.nr, kamera, fenster, geaendertAm: '' }
    if (!geladen.current) {
      geladen.current = true // der erste Durchlauf ist das Laden selbst, keine Änderung
      return
    }
    offen.current = true
    setSpeicher('ungespeichert')
    const warten = setTimeout(jetztSpeichern, SPEICHERN_NACH_MS)
    return () => clearTimeout(warten)
  }, [kopf, format, buch.seiten, buch.nr, kamera, fenster, jetztSpeichern])

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
  /** Wendet eine Änderung (Elemente, Hintergrund und Verlauf) auf die gezeigte Seite an. */
  const aendereSeite = useCallback((tun: (inhalt: Inhalt, verlauf: Verlauf) => { inhalt: Inhalt; verlauf: Verlauf }) => {
    setBuch((alt) => {
      const s = alt.seiten[alt.nr]
      if (!s) return alt
      const neu = tun(inhaltVon(s), alt.verlaeufe[s.id] ?? leererVerlauf())
      if (neu.inhalt.elemente === s.elemente && neu.inhalt.hintergrund === s.hintergrund && neu.inhalt.muster === s.muster) return alt
      const seite = alsSeite(s, neu.inhalt)
      return { ...alt, seiten: alt.seiten.map((x) => (x === s ? seite : x)), verlaeufe: { ...alt.verlaeufe, [s.id]: neu.verlauf } }
    })
  }, [])
  const fuehreAus = useCallback((b: Befehl | null) => b && aendereSeite((i, v) => ausfuehrenAuf(i, v, b)), [aendereSeite])

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
      aendereSeite((i, v) => {
        const b = entfernenBefehl(i.elemente, ids)
        return b ? ausfuehrenAuf(i, v, b) : { inhalt: i, verlauf: v }
      }),
    [aendereSeite],
  )
  const beiErsetzen = useCallback((vorher: Element[], nachher: Element[]) => fuehreAus({ art: 'ersetzen', vorher, nachher }), [fuehreAus])
  const zurueck = useCallback(() => aendereSeite(rueckgaengigAuf), [aendereSeite])
  const vor = useCallback(() => aendereSeite(wiederholenAuf), [aendereSeite])

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
  /** Schreibt einen Text (z. B. die Gruppen aus „Zufall & Gruppen“) in die Mitte des sichtbaren Ausschnitts und wählt ihn aus */
  const schreibeText = (text: string) => {
    const [mx, my] = zuTafel(kamera, (flaeche.current?.clientWidth || 800) / 2, (flaeche.current?.clientHeight || 600) / 2)
    const e: Element = { art: 'text', id: neueId(), x: 0, y: 0, text: text.slice(0, MAX_TEXT), groesse: 36, farbe }
    const [b, h] = textMass(e)
    const neu = { ...e, x: Math.round(mx - b / 2), y: Math.round(my - h / 2) }
    fuehreAus({ art: 'hinzufuegen', elemente: [neu] })
    setWerkzeug('auswahl')
    setAuswahl([neu.id])
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
    if (werkzeug === 'radierer' || werkzeug === 'laser') setWerkzeug('stift')
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

  // ---------- Muster (Hintergrund) ----------
  const [ohneMusterExport, setOhneMusterExport] = useState(false)
  /** Muster für die gezeigte Seite oder alle Seiten (ohne PDF/Bild-Hintergrund) – je Seite ein Schritt im Verlauf */
  const setzeMuster = (m: Muster | undefined, alleSeiten: boolean) =>
    setBuch((alt) => {
      const verlaeufe = { ...alt.verlaeufe }
      const seiten = alt.seiten.map((s, i) => {
        if ((!alleSeiten && i !== alt.nr) || s.hintergrund || gleichesMuster(s.muster, m)) return s
        const neu = ausfuehrenAuf(inhaltVon(s), alt.verlaeufe[s.id] ?? leererVerlauf(), { art: 'muster', vorher: s.muster, nachher: m })
        verlaeufe[s.id] = neu.verlauf
        return alsSeite(s, neu.inhalt)
      })
      return { ...alt, seiten, verlaeufe }
    })

  /** Ein eigenes Bild wird Hintergrund dieser Seite oder aller Seiten (PDF-Seiten bleiben) – je Seite ein Schritt */
  async function setzeBildHintergrund(datei: Blob, alleSeiten: boolean) {
    setMeldung({ text: 'Bild wird eingesetzt …', laeuft: true })
    try {
      const h = bildHintergrund(await nimmBild(datei), format)
      setBuch((alt) => {
        const verlaeufe = { ...alt.verlaeufe }
        const seiten = alt.seiten.map((s, i) => {
          const befehl = (i === alt.nr || (alleSeiten && !s.blatt)) && bildHintergrundBefehl(s, h) // „alle“ lässt PDF-Seiten aus
          if (!befehl) return s
          const neu = ausfuehrenAuf(inhaltVon(s), alt.verlaeufe[s.id] ?? leererVerlauf(), befehl)
          verlaeufe[s.id] = neu.verlauf
          return alsSeite(s, neu.inhalt)
        })
        return { ...alt, seiten, verlaeufe }
      })
      setMeldung(null)
    } catch (e) {
      fehlerMeldung(e)
    }
  }
  /** Format der Tafel und Muster dieser Seite als Vorlage der Klasse merken */
  const merkeVorlage = () => {
    if (!klasse) return
    const neu = geaendert(klasse, { vorlage: vorlageAus(format, seite.muster) })
    speichereKlasse(neu).then(
      () => setKlasse(neu),
      () => setMeldung({ text: 'Die Vorlage ließ sich auf diesem Gerät nicht speichern.', fehler: true }),
    )
  }
  const vorlageGemerkt = !!klasse && JSON.stringify(klasse.vorlage ?? null) === JSON.stringify(vorlageAus(format, seite.muster) ?? null)
  /** Neue Seite: mit Vorlage der Klasse deren Muster, sonst das Muster der gezeigten Seite */
  const neueSeiteAnlegen = (amEnde = false) =>
    blaettern((b) => seiteDazu(amEnde ? gehe(b, b.seiten.length - 1) : b, klasse?.vorlage ? { muster: klasse.vorlage.muster } : undefined))
  /** Seitenübersicht offen? (dann gelten die Tastenkürzel der Tafel nicht) */
  const [uebersicht, setUebersicht] = useState(false)
  const uebersichtOffen = useRef(false)
  uebersichtOffen.current = uebersicht

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
      if (format === 'unendlich') setKamera({ x: 0, y: 0, zoom: 1 }) // sonst wird die neue Seite eingepasst
      setMeldung({ text: (seiten.length === 1 ? '1 Seite eingefügt.' : `${seiten.length} Seiten eingefügt.`) + (ausgelassen ? ` ${ausgelassen} weitere passen nicht mehr (höchstens ${MAX_SEITEN}).` : ''), fehler: ausgelassen > 0 })
    } catch (e) {
      fehlerMeldung(e)
    }
  }

  async function alsPdf(weitergeben: boolean) {
    setMeldung({ text: 'PDF wird erstellt …', laeuft: true })
    try {
      const titel = kopf?.titel ?? 'Tafel'
      const pdf = await exportierePdf(buch.seiten, titel, (nr, von) => setMeldung({ text: `PDF: Seite ${nr} von ${von} …`, laeuft: true }), format, !ohneMusterExport)
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
      if (uebersichtOffen.current) return
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
      if (uebersichtOffen.current) return
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
    ...(gewaehlte.length === 1 && gewaehlte[0].art === 'bild'
      ? [
          {
            name: 'Als Hintergrund',
            symbol: 'hintergrund' as const,
            titel: 'Als Hintergrund festlegen – liegt dann fest unter allem (lässt sich rückgängig machen)',
            tun: () => {
              fuehreAus(alsHintergrundBefehl(seite, gewaehlte[0] as Bild, format))
              setAuswahl([])
            },
          },
        ]
      : []),
    { name: 'Löschen', symbol: 'leeren', titel: 'Löschen (Entf)', tun: loescheAuswahl },
  ]

  const zoomen = (faktor: number) => setKamera((k) => zoomeUm(k, (mass.b || window.innerWidth) / 2, (mass.h || window.innerHeight) / 2, faktor))
  const ansichtZurueck = () => (blatt ? passeEin() : setKamera({ x: 0, y: 0, zoom: 1 }))

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
        <input
          ref={hintergrundBildWahl}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          hidden
          aria-label="Bild für den Hintergrund wählen"
          onChange={(e) => {
            const datei = e.target.files?.[0]
            if (datei) void setzeBildHintergrund(datei, hintergrundFuerAlle.current)
            e.target.value = ''
          }}
        />
        <input ref={bildWahl} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple hidden aria-label="Bilddatei wählen" onChange={(e) => { nimmDateien([...(e.target.files ?? [])]); e.target.value = '' }} />
        <Formatwahl format={format} ueberstand={ueberstand} beiFormat={setFormat} beiEinpassen={inhaltEinpassen} />
        <div className="zoom" role="group" aria-label="Ansicht">
          <button type="button" className="kopf-knopf" aria-label="Verkleinern" onClick={() => zoomen(1 / 1.25)}>
            −
          </button>
          <button type="button" className="kopf-knopf breit" aria-label={blatt ? 'Ganzes Blatt zeigen' : 'Ansicht zurücksetzen'} title={blatt ? 'Ganzes Blatt zeigen' : 'Ansicht zurücksetzen'} onClick={ansichtZurueck}>
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
            className={blatt ? 'tafel-flaeche mit-blatt' : 'tafel-flaeche'}
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
              muster={seite.muster}
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
              blatt={blatt}
              begrenze={begrenze}
            />
            {leistenRahmen && <Auswahlleiste rahmen={leistenRahmen} knoepfe={auswahlKnoepfe} />}
            <Fensterebene fenster={fenster} beiAendern={setFenster} schueler={klasseId ? (klasse?.schueler ?? []) : null} beiText={schreibeText} />
            {pruefen && <Pruefansicht elemente={seite.elemente.length} />}
          </div>
          <Seitenleiste
            nr={buch.nr}
            anzahl={buch.seiten.length}
            beschrieben={seite.elemente.length > 0 || seite.hintergrund !== undefined}
            beiGehe={(nr) => blaettern((b) => gehe(b, nr))}
            weiterMitNeu={format !== 'unendlich'}
            beiNeu={() => neueSeiteAnlegen()}
            beiDoppelt={() => blaettern(seiteDoppelt)}
            beiSchieben={(r) => blaettern((b) => seiteSchieben(b, r))}
            beiLoeschen={() => blaettern(seiteWeg)}
            hintergrund={!!seite.hintergrund}
            beiDrehen={(r) => fuehreAus(drehBefehl(seite, r))}
            beiHintergrundWeg={() => fuehreAus(hintergrundWegBefehl(seite))}
            beiUebersicht={() => {
              setAuswahl([])
              setUebersicht(true)
            }}
          />
        </div>
        <Schnellleiste
          fenster={fenster}
          beiAendern={setFenster}
          klasse={!!klasseId}
          vorne={
            <Hintergrundwahl
              format={format}
              muster={seite.muster}
              hintergrund={!!seite.hintergrund}
              beiMuster={setzeMuster}
              beiBild={(alleSeiten) => {
                hintergrundFuerAlle.current = alleSeiten
                hintergrundBildWahl.current?.click()
              }}
              klasse={klasse ? { name: klasse.bezeichnung, gemerkt: vorlageGemerkt } : undefined}
              beiVorlage={merkeVorlage}
              ohneMusterExport={ohneMusterExport}
              beiOhneMusterExport={setOhneMusterExport}
            />
          }
        />
      </div>
      {uebersicht && (
        <Seitenuebersicht
          seiten={buch.seiten}
          nr={buch.nr}
          format={format}
          beiGehe={(nr) => {
            blaettern((b) => gehe(b, nr))
            setUebersicht(false)
          }}
          beiVerschieben={(von, nach) => blaettern((b) => seiteVerschieben(b, von, nach))}
          beiReihenfolge={(ids) => blaettern((b) => inReihenfolge(b, ids))}
          beiDoppelt={(nr) => blaettern((b) => seiteDoppeltBei(b, nr))}
          beiLoeschen={(nr) => blaettern((b) => seiteWegBei(b, nr))}
          beiNeu={() => neueSeiteAnlegen(true)}
          beiSchliessen={() => setUebersicht(false)}
        />
      )}
    </div>
  )
}
