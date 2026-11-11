# Lehrraum – Projektregeln

Lehrraum ist die Lehrkraft-App der Unterrichtsplattform kt-gymbruvi.github.io: die hybride Tafel, später
Klassenverwaltung („Unterrichten“) und Bibliothek. Schwesterprojekte (eigene Repos, gleiche Adresse):
Startseite (`../Kt-gymbruvi.github.io`), Quizzo (`../Quizzo`), Klassenfunk (`../Klassenfunk`).

**Projektgedächtnis:** Stand und nächste Schritte in `docs/PROJECT-STATUS.md`, Entscheidungen in `docs/DECISIONS.md`.
Gesamtplan, Zielarchitektur und Audit liegen im Startseiten-Repo: `../Kt-gymbruvi.github.io/docs/`
(`IMPLEMENTATION_ROADMAP.md`, `ARCHITECTURE.md`, `PROJECT_AUDIT.md`). Nach jeder Etappe aktualisieren.

## Technik
- Statische Web-App: Vite 8 + React 19 + TypeScript + Tailwind CSS v4, React Router (HashRouter), `@supabase/supabase-js` v2, `perfect-freehand`, `qrcode`. Tests: Vitest + Testing Library (jsdom), `fake-indexeddb`.
- Server: dieselbe Supabase-Datenbank und dieselben Lehrkraft-Konten wie Quizzo und Klassenfunk (Frankfurt). URL und publishable-Schlüssel in `.env.production` und `.env.development` (beide eingecheckt, nur öffentlicher Schlüssel).
- Hosting (geplant): GitHub Pages unter https://kt-gymbruvi.github.io/Lehrraum/ (Basis-Pfad `/Lehrraum/`), Deploy per GitHub Actions (`.github/workflows/deploy.yml`: `npm ci`, `npm test`, `npm run build`).
- Bibliotheken werden über npm eingebaut; im Betrieb wird nichts von fremden Servern geladen.
- Code:
  - `src/kern/` – reine Logik ohne React und ohne Browser-Speicher: `modell.ts` (Datenmodell Version 2: Seiten mit Strich/Text/Form, Prüfung, Umwandlung von Version 1), `befehle.ts` (Rückgängig/Wiederholen: hinzufügen, entfernen, ersetzen), `geometrie.ts` (Kamera, Treffer, Rahmen, Pfade), `seiten.ts` (Seiten anlegen, duplizieren, löschen, schieben), `fenster.ts`.
  - `src/speicher/` – `datenbank.ts` (IndexedDB auf dem Gerät), `server.ts` (einziger Ort für Serverzugriffe: Anmeldung, Quizze, Präsentationen, Spiel/Sitzung starten und beenden), `supabase.ts`, `plattform.ts` (Adressen der Schwesteranwendungen, Liste der Lernangebote).
  - `src/tafel/` – `Tafel.tsx` (Zustand, Autospeichern, Tastatur), `Zeichenflaeche.tsx` (Eingabe und Zeichnen aller Werkzeuge, Text-Eingabefeld), `Werkzeugleiste.tsx` (links), `Seitenleiste.tsx` (unten).
  - `src/fenster/` – Fenster über der Tafel: `Fenster.tsx` (Rahmen, Verschieben), `Fensterebene.tsx` (Ebene und rechte Leiste), `Inhalte.tsx` (Uhr, Timer, Stoppuhr, Würfel, Notiz), `Anwendungen.tsx` (Quizzo, Klassenfunk, Lernangebote per iframe, Anmeldung); Logik in `src/kern/fenster.ts`.
  - `src/ui/` – wiederverwendbare Bausteine (`Symbol.tsx`).
  - `src/test/` – Tests.

## Konventionen
- Oberfläche, Bezeichner, Kommentare, Commit-Nachrichten auf Deutsch; Commits je Etappe („Etappe N: …“).
- Neue Funktion = Etappe: Code + Tests + `docs/` aktualisieren. Logik gehört nach `src/kern/` und wird dort ohne Browser getestet.
- Gespeicherte Daten tragen `schema` und `version`; geladen wird nur über die Prüffunktion (`pruefeTafel`). Formatänderungen = neue Version mit Umwandlung der alten, nie stilles Umdeuten.
- Jede Änderung am Tafelinhalt läuft als Befehl über `befehle.ts`, damit sie sich zurücknehmen lässt.
- Neue Elementart: Typ und Prüfung in `kern/modell.ts`, Rahmen/Treffer/Verschieben in `kern/geometrie.ts`, Kopie in `kern/seiten.ts`, Zeichnen in `Zeichenflaeche.tsx`, Tests. Bei Änderungen am gespeicherten Format die Version erhöhen und die alte in `pruefeTafel` umwandeln.
- Neues Fenster: Art in `kern/fenster.ts` (`FENSTERARTEN`, Name, Prüfung), Inhalt in `fenster/Inhalte.tsx`, Symbol in `ui/Symbol.tsx`, Tests. Fenster dürfen die Tafel nie verändern oder zurücksetzen.
- Design: Dunkelblau als Hauptfarbe, helle Flächen, heller/dunkler Modus (Auswahl aus `localStorage` „lehrraum-design“, gemeinsam mit der Startseite). Die Zeichenfläche bleibt weiß. Farbwerte wie in `../Kt-gymbruvi.github.io/gemeinsam/tokens.css`. Symbole als eigene SVG-Zeichnungen (`src/ui/Symbol.tsx`), keine Emojis.
- Bedienelemente an der Tafel mindestens 56 px groß; alles muss mit Maus, Finger und Stift gehen. Beide Werkzeugleisten bleiben dauerhaft sichtbar.

## Datenschutz und Sicherheit
- Tafelbilder und (später) Klassen mit Schülernamen liegen **nur auf dem Gerät** (IndexedDB). Nie in ein Repository, nie in eine Adresse, nie im Klartext auf einen Server.
- Keine Trackingdienste, keine KI-Aufrufe. Supabase: nur der publishable-Schlüssel (nie secret/service_role), eigene Tabellen später mit RLS und Präfix `lr_`. Serverzugriffe nur über `src/speicher/server.ts`; Tests ersetzen dieses Modul und sprechen nie mit dem echten Server.
- Quizzo und Klassenfunk werden eingebettet, nicht nachgebaut, und in ihren Repos nicht geändert, ohne dass es eine eigene Etappe dort ist. In Adressen nur geprüfte Kennungen (`istZiel`).
- Importierte Dateien sind Daten und werden geprüft, nie ausgeführt.

## Arbeitsweise
- Nach jeder Etappe: `npm test` und `npm run build` (enthält die TypeScript-Prüfung); zusammenfassen, was getestet wurde und was nicht. Zeichnen und Stift lassen sich nur am echten Gerät beurteilen – das immer dazusagen.
- Lokal ansehen: `npm run dev`, dann http://localhost:5173/Lehrraum/ (oder Vorschau-Eintrag „lehrraum“ im Startseiten-Repo, Port 5200).
- Nichts veröffentlichen (GitHub-Repository anlegen, Push, Deployment) und nichts löschen ohne ausdrückliche Zustimmung der Lehrkraft.
