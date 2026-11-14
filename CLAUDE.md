# Lehrraum – Projektregeln

Lehrraum ist die Lehrkraft-App der Unterrichtsplattform kt-gymbruvi.github.io: die hybride Tafel, später
Klassenverwaltung („Unterrichten“) und Bibliothek. Schwesterprojekte (eigene Repos, gleiche Adresse):
Startseite (`../Kt-gymbruvi.github.io`), Quizzo (`../Quizzo`), Klassenfunk (`../Klassenfunk`).

**Projektgedächtnis:** Stand und nächste Schritte in `docs/PROJECT-STATUS.md`, Entscheidungen in `docs/DECISIONS.md`, freigegebene Spezifikationen in `docs/SPEC-*.md`.
Gesamtplan, Zielarchitektur und Audit liegen im Startseiten-Repo: `../Kt-gymbruvi.github.io/docs/`
(`IMPLEMENTATION_ROADMAP.md`, `ARCHITECTURE.md`, `PROJECT_AUDIT.md`). Nach jeder Etappe aktualisieren.

## Technik
- Statische Web-App: Vite 8 + React 19 + TypeScript + Tailwind CSS v4, React Router (HashRouter), `@supabase/supabase-js` v2, `perfect-freehand`, `qrcode`, `pdfjs-dist` (PDF lesen) und `pdf-lib` (PDF schreiben) – die beiden letzten werden erst bei Bedarf geladen. Tests: Vitest + Testing Library (jsdom), `fake-indexeddb`.
- Server: dieselbe Supabase-Datenbank und dieselben Lehrkraft-Konten wie Quizzo und Klassenfunk (Frankfurt). URL und publishable-Schlüssel in `.env.production` und `.env.development` (beide eingecheckt, nur öffentlicher Schlüssel).
- Hosting: GitHub Pages unter https://kt-gymbruvi.github.io/Lehrraum/ (Basis-Pfad `/Lehrraum/`), Deploy per GitHub Actions (`.github/workflows/deploy.yml`: `npm ci`, `npm test`, `npm run build`).
- Bibliotheken werden über npm eingebaut; im Betrieb wird nichts von fremden Servern geladen.
- Code:
  - `src/kern/` – reine Logik ohne React und ohne Browser-Speicher: `modell.ts` (Datenmodell Version 5: Format der Tafel, Seiten mit Muster und Strich/Text/Form/Bild, Drehung, Gruppe, Hintergrund mit Drehung und PDF-Kennung, Prüfung, Umwandlung von Version 1 bis 4), `befehle.ts` (Rückgängig/Wiederholen: hinzufügen, entfernen, ersetzen, ordnen, zerlegen, hintergrund, muster; `…Auf` für Elemente und Hintergrund einer Seite), `radieren.ts` (Art und Größe des Radierers, Schwamm: Striche teilen, Wischzug), `farben.ts` (Palette, eigene Farbplätze, Bereich des Stärke-Reglers), `begradigen.ts` (Begradigen durch Halten: Strich → Linie, Rechteck, Ellipse, Dreieck), `laser.ts` (Laserpointer: Alter der Punkte, Schweif), `einstellungen.ts` (Typ `Werkzeug`; zuletzt benutztes Werkzeug, Farbe, Stärke, Radierer: Prüfung, Start mit dem Stift), `geometrie.ts` (Kamera, Treffer, Rahmen, Pfade, Strecken), `blatt.ts` (Seiten mit fester Größe: Formate, Ansicht einpassen und begrenzen, Inhalt aufs Blatt holen; eigenes Bild als Hintergrund), `muster.ts` (Muster als Hintergrund: Namen, Gruppen, Linien/Punkte/Beschriftung je Bereich), `auswahl.ts` (Griffe am Auswahlrahmen, Ziehen an Griffen, Drehen, Gruppen), `ablage.ts` (Kopie zum Einfügen, auch zwischen Tafeln: Prüfung, Einfügen in der Mitte), `seiten.ts` (Seiten anlegen, duplizieren, löschen – auch alle Seiten eines PDFs –, schieben; PDF-Seiten drehen, Hintergrund entfernen; Elemente kopieren), `fenster.ts`, `klassen.ts` (Klassen Version 2: Modell, Vorlage aus Format und Muster, Prüfung, Sortierung), `messung.ts` (Auswertung für die Prüfansicht).
  - `src/speicher/` – `datenbank.ts` (IndexedDB auf dem Gerät: Tafeln, Einstellungen, Klassen, Kopie zum Einfügen, eigene Farbplätze, zuletzt benutzte Werkzeugwahl; freie Tafel und Tafel je Klasse), `dateien.ts` (Bilder und PDF-Seiten als Dateien), `server.ts` (einziger Ort für Serverzugriffe: Anmeldung, Quizze, Präsentationen, Spiel/Sitzung starten und beenden), `supabase.ts`, `plattform.ts` (Adressen der Schwesteranwendungen, Liste der Lernangebote).
  - `src/tafel/` – `Tafel.tsx` (Zustand, Autospeichern, Tastatur), `Zeichenflaeche.tsx` (Eingabe und Zeichnen aller Werkzeuge, Text-Eingabefeld, Laserpointer-Spur nur auf der oberen Ebene), `Werkzeugleiste.tsx` (links), `Auswahlleiste.tsx` (Befehle an der Auswahl), `Seitenleiste.tsx` (unten), `Formatwahl.tsx` (Knopf und Feld „Format“ in der Kopfzeile), `Hintergrundwahl.tsx` (Knopf und Feld „Hintergrund“ oben in der rechten Leiste), `zeichnen.ts` (Elemente auf ein Canvas zeichnen – für Fläche und Export; dazu `zeichneLaser`, nur für die Fläche), `bildquellen.ts` (geladene Bilder), `bilder.ts` (Bilddateien annehmen), `pdf.ts` (PDF öffnen, speichern, teilen), `Pruefansicht.tsx` und `messung.ts` (Messwerte zum Schreiben am Gerät unter `#/pruefen`; nur Anzeige, nichts wird gespeichert oder gesendet).
  - `src/klassen/` – `Klassen.tsx` (Seite „Meine Klassen“, `#/klassen`, mit Vorlage für die Tafel).
  - `src/fenster/` – Fenster über der Tafel: `Fenster.tsx` (Rahmen, Verschieben), `Fensterebene.tsx` (Ebene und rechte Leiste), `Inhalte.tsx` (Uhr, Timer, Stoppuhr, Würfel, Notiz), `Anwendungen.tsx` (Quizzo, Klassenfunk, Lernangebote per iframe, Anmeldung); Logik in `src/kern/fenster.ts`.
  - `src/ui/` – wiederverwendbare Bausteine (`Symbol.tsx`).
  - `src/test/` – Tests.

## Konventionen
- Oberfläche, Bezeichner, Kommentare, Commit-Nachrichten auf Deutsch; Commits je Etappe („Etappe N: …“).
- Neue Funktion = Etappe: Code + Tests + `docs/` aktualisieren. Logik gehört nach `src/kern/` und wird dort ohne Browser getestet.
- Gespeicherte Daten tragen `schema` und `version`; geladen wird nur über die Prüffunktion (`pruefeTafel`). Formatänderungen = neue Version mit Umwandlung der alten, nie stilles Umdeuten.
- Jede Änderung am Tafelinhalt läuft als Befehl über `befehle.ts`, damit sie sich zurücknehmen lässt.
- Zeichenfläche: höchstens einmal je Bildwechsel zeichnen (`plane()`), nie bei jeder einzelnen Stiftmeldung; die untere Ebene nur ganz neu zeichnen, wenn sich mehr geändert hat als ein hinzugekommenes Element. Änderungen daran mit `#/pruefen` nachmessen.
- Neue Elementart: Typ und Prüfung in `kern/modell.ts`, Rahmen/Treffer/Verschieben/Strecken/Berühren (`rahmen`, `trifft`, `verschoben`, `skaliert`, `beruehrtRechteck`) in `kern/geometrie.ts`, Kopie in `kern/seiten.ts`, Zeichnen in `Zeichenflaeche.tsx`, Tests. Bei Änderungen am gespeicherten Format die Version erhöhen und die alte in `pruefeTafel` umwandeln.
- Neues Fenster: Art in `kern/fenster.ts` (`FENSTERARTEN`, Name, Prüfung), Inhalt in `fenster/Inhalte.tsx`, Symbol in `ui/Symbol.tsx`, Tests. Fenster dürfen die Tafel nie verändern oder zurücksetzen.
- Design: ruhig wie ein Werkzeug von Apple – weißes Blatt mit runden Ecken, Leisten als schwebende Glasflächen (`--glas`, Unschärfe der Werkzeugleisten nur über `::before`, sonst verschwinden ihre Aufklappfelder), nur das gewählte Werkzeug kräftig hervorgehoben. Dunkelblau als Hauptfarbe (dunkler Modus: Türkis), helle Flächen, heller/dunkler Modus (Auswahl aus `localStorage` „lehrraum-design“, gemeinsam mit der Startseite). Die Zeichenfläche bleibt weiß. Farbwerte wie in `../Kt-gymbruvi.github.io/gemeinsam/tokens.css`. Symbole als eigene SVG-Zeichnungen (`src/ui/Symbol.tsx`), keine Emojis.
- Bedienelemente an der Tafel mindestens 56 px groß; Griffe an der Auswahl (Größe ändern, Drehen) mindestens 44 px Trefferfläche, auch wenn sie kleiner gezeichnet sind. Alles muss mit Maus, Finger und Stift gehen. Beide Werkzeugleisten bleiben dauerhaft sichtbar.

## Datenschutz und Sicherheit
- Die Startseite (`../Kt-gymbruvi.github.io/gemeinsam/klassen.js`) liest das Lager `klassen` direkt aus IndexedDB. Änderungen am Format der Klassen oder am Namen von Datenbank/Lager dort mitziehen.
- Tafelbilder und Klassen (später mit Schülernamen) liegen **nur auf dem Gerät** (IndexedDB). Nie in ein Repository, nie in eine Adresse, nie im Klartext auf einen Server.
- Keine Trackingdienste, keine KI-Aufrufe. Supabase: nur der publishable-Schlüssel (nie secret/service_role), eigene Tabellen später mit RLS und Präfix `lr_`. Serverzugriffe nur über `src/speicher/server.ts`; Tests ersetzen dieses Modul und sprechen nie mit dem echten Server.
- Quizzo und Klassenfunk werden eingebettet, nicht nachgebaut, und in ihren Repos nicht geändert, ohne dass es eine eigene Etappe dort ist. In Adressen nur geprüfte Kennungen (`istZiel`).
- Importierte Dateien sind Daten und werden geprüft, nie ausgeführt (SVG wird beim Einfügen zu einem Pixelbild). Bilder und PDFs bleiben auf dem Gerät.
- Tests ersetzen `tafel/bilder.ts` und `tafel/pdf.ts` (jsdom kann keine Bilder oder PDFs verarbeiten); Änderungen dort immer mit echten Dateien im Browser prüfen.

## Arbeitsweise
- Nach jeder Etappe: `npm test` und `npm run build` (enthält die TypeScript-Prüfung); zusammenfassen, was getestet wurde und was nicht. Zeichnen und Stift lassen sich nur am echten Gerät beurteilen – das immer dazusagen.
- Lokal ansehen: `npm run dev`, dann http://localhost:5173/Lehrraum/ (oder Vorschau-Eintrag „lehrraum“ im Startseiten-Repo, Port 5200).
- Nichts veröffentlichen (Push auf `main` löst das Deployment aus) und nichts löschen ohne ausdrückliche Zustimmung der Lehrkraft. Auf diesem Rechner gibt es kein `gh`; den Stand eines Laufs zeigt https://api.github.com/repos/Kt-gymbruvi/Lehrraum/actions/runs.
