# Projektstand – Lehrraum

Stand: 11.11.2026 · **nur lokal**, noch kein GitHub-Repository, nicht veröffentlicht.
Tests: 2 Testdateien, 24 Tests grün (`npm test`); Build grün (`npm run build`).

## Implementiert (Etappen 1.3 und 2a der Roadmap)
- **Gerüst:** Vite/React/TypeScript/Tailwind wie Quizzo, HashRouter, Deploy-Workflow vorbereitet (läuft erst nach einem Push).
- **Tafel** (`#/tafel`):
  - Stift (dicker bei mehr Druck; bei Maus und Finger wird der Druck aus dem Tempo geschätzt), Textmarker (breit, durchscheinend), Radierer (entfernt ganze Striche, die er berührt).
  - Sechs Farben, drei Strichstärken, linke Werkzeugleiste dauerhaft sichtbar.
  - Rückgängig/Wiederholen (bis 200 Schritte), „Tafel leeren“ lässt sich zurücknehmen.
  - Eingabe: Stift und Maus zeichnen; ein Finger zeichnet, bis einmal ein Stift benutzt wurde, danach verschiebt er (Handballen-Schutz); zwei Finger verschieben und zoomen; Mausrad verschiebt, Strg + Mausrad zoomt; Zoom-Knöpfe und „Ansicht zurücksetzen“.
  - Tastatur: S Stift, M Textmarker, R oder E Radierer, Strg + Z, Strg + Y bzw. Strg + Umschalt + Z.
  - Automatisches Speichern auf dem Gerät (0,7 s nach der letzten Änderung, sofort beim Wegschalten/Schließen), Wiederherstellen der zuletzt benutzten Tafel, Anzeige des Speicherstands; bittet den Browser um dauerhaften Speicher.
- **Datenmodell Version 1** (`lehrraum/tafel`): Titel, Striche, Kamera; Prüfung beim Laden.

## Getestet / nicht getestet
- Automatisch: Datenmodell und Prüfung, Rückgängig/Wiederholen, Geometrie, Speicher, Bedienung der Tafel (Zeichnen, Farbe, Stärke, Textmarker, Radierer, Leeren, Tastatur, Wiederherstellen, Handballen-Schutz, Zoom).
- Von Hand in der Vorschau (Desktop-Browser): Zeichnen mit der Maus, nachgestellte Stifteingabe mit wechselndem Druck, Textmarker, Radierer, Neuladen.
- **Nicht getestet:** echtes iPad mit Apple Pencil, Smartboard, Fingerbedienung, Zwei-Finger-Zoom am Gerät, Schreibgefühl und Verzögerung, sehr viele Striche (Tempo).

## Bekannte Grenzen
- Es gibt genau eine Tafel; kein Titel ändern, keine neue Tafel, keine Seiten, kein Export.
- Der Radierer löscht ganze Striche, keine Teilstücke.
- Bei jeder Änderung werden alle Striche neu gezeichnet – bei sehr vollen Tafeln eventuell zu langsam (am Gerät prüfen).
- Der Knopf „Zur Startseite“ führt auf `/` – in der lokalen Vorschau also nicht auf die Startseite.
- Keine Anmeldung, keine Verbindung zu Supabase (für die Tafel bisher nicht nötig).
- Die rechte Leiste (Werkzeug-Fenster) fehlt noch.

## Nächste Schritte
1. **Erprobung am iPad und am Smartboard** (Roadmap: vor allem Weiteren). Dafür muss die App veröffentlicht oder im WLAN erreichbar sein.
2. Je nach Ergebnis nachbessern (Glättung, Strichstärken, Handballen-Schutz).
3. Phase 3a: Fenstersystem mit Uhr, Timer, Stoppuhr, Würfel, Notiz. Danach 5a (Quizzo/Klassenfunk aus der Tafel) und 2b (Auswahl, Text, Formen, Bilder, Seiten).
