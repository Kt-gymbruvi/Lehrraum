# Projektstand – Lehrraum

Stand: 11.11.2026 · **nur lokal**, noch kein GitHub-Repository, nicht veröffentlicht.
Tests: 3 Testdateien, 40 Tests grün (`npm test`); Build grün (`npm run build`).

## Implementiert (Etappen 1.3, 2a und 3a der Roadmap)
- **Gerüst:** Vite/React/TypeScript/Tailwind wie Quizzo, HashRouter, Deploy-Workflow vorbereitet (läuft erst nach einem Push).
- **Tafel** (`#/tafel`):
  - Stift (dicker bei mehr Druck; bei Maus und Finger wird der Druck aus dem Tempo geschätzt), Textmarker (breit, durchscheinend), Radierer (entfernt ganze Striche, die er berührt).
  - Sechs Farben, drei Strichstärken, linke Werkzeugleiste dauerhaft sichtbar.
  - Rückgängig/Wiederholen (bis 200 Schritte), „Tafel leeren“ lässt sich zurücknehmen.
  - Eingabe: Stift und Maus zeichnen; ein Finger zeichnet, bis einmal ein Stift benutzt wurde, danach verschiebt er (Handballen-Schutz); zwei Finger verschieben und zoomen; Mausrad verschiebt, Strg + Mausrad zoomt; Zoom-Knöpfe und „Ansicht zurücksetzen“.
  - Tastatur: S Stift, M Textmarker, R oder E Radierer, Strg + Z, Strg + Y bzw. Strg + Umschalt + Z.
  - Automatisches Speichern auf dem Gerät (0,7 s nach der letzten Änderung, sofort beim Wegschalten/Schließen), Wiederherstellen der zuletzt benutzten Tafel, Anzeige des Speicherstands; bittet den Browser um dauerhaften Speicher.
- **Fenster über der Tafel** (rechte Leiste, dauerhaft sichtbar): Uhr (mit Datum), Timer (1–15 min per Knopf, ± Minute, Start/Pause, Zurück, drei Signaltöne und Blinken am Ende), Stoppuhr (Zehntelsekunden), Würfel (1–3 Würfel, Summe), Notizen als Klebezettel (mehrere, vier Farben, Text wird gespeichert).
  - Fenster lassen sich an der Titelzeile verschieben, einklappen (Timer läuft weiter) und schließen; angetippte Fenster kommen nach vorne. Zwischen den Fenstern bleibt die Tafel beschreibbar.
  - Welche Fenster offen sind, wo sie liegen und der Notiztext werden mit der Tafel gespeichert. Laufende Zeiten (Timer, Stoppuhr) und Würfelergebnisse nicht.
- **Datenmodell Version 1** (`lehrraum/tafel`): Titel, Striche, Kamera, Fenster; Prüfung beim Laden. Tafeln ohne Fensterliste (erste Fassung) bleiben ladbar.

## Getestet / nicht getestet
- Automatisch: Datenmodell und Prüfung, Rückgängig/Wiederholen, Geometrie, Speicher, Bedienung der Tafel (Zeichnen, Farbe, Stärke, Textmarker, Radierer, Leeren, Tastatur, Wiederherstellen, Handballen-Schutz, Zoom), Fenster (Logik, Öffnen/Schließen, Verschieben, Einklappen, Timer und Stoppuhr mit gestellter Zeit, Würfel, Notiz speichern).
- Von Hand in der Vorschau (Desktop-Browser): Zeichnen mit der Maus, nachgestellte Stifteingabe mit wechselndem Druck, Textmarker, Radierer, Neuladen; alle fünf Fenster geöffnet, verschoben, Timer gestartet, gewürfelt, Notiz geschrieben.
- **Nicht getestet:** echtes iPad mit Apple Pencil, Smartboard, Fingerbedienung, Zwei-Finger-Zoom am Gerät, Schreibgefühl und Verzögerung, sehr viele Striche (Tempo), Signalton des Timers (in der Vorschau nicht hörbar geprüft; iPad-Browser geben Ton erst nach einer Berührung frei – der Start-Knopf zählt als solche).

## Bekannte Grenzen
- Es gibt genau eine Tafel; kein Titel ändern, keine neue Tafel, keine Seiten, kein Export.
- Der Radierer löscht ganze Striche, keine Teilstücke.
- Bei jeder Änderung werden alle Striche neu gezeichnet – bei sehr vollen Tafeln eventuell zu langsam (am Gerät prüfen).
- Der Knopf „Zur Startseite“ führt auf `/` – in der lokalen Vorschau also nicht auf die Startseite.
- Keine Anmeldung, keine Verbindung zu Supabase (für die Tafel bisher nicht nötig).
- Fenster haben eine feste Größe (nur die Notiz lässt sich am Textfeld ziehen); auf schmalen Bildschirmen überdecken sie sich.
- Notizen lassen sich noch nicht auf die Tafel „ablegen“ – dafür braucht es Textelemente (Etappe 2b).
- Noch nicht in der rechten Leiste: Zufallsschüler, Gruppen (brauchen Klassen, Phase 4), Lautstärkeampel, Arbeitsauftrag, Stundenablauf, QR-Code (3b), Quizzo, Klassenfunk, Lernangebote (5a).

## Nächste Schritte
1. **Erprobung am iPad und am Smartboard** (Roadmap: vor allem Weiteren). Dafür muss die App veröffentlicht oder im WLAN erreichbar sein.
2. Je nach Ergebnis nachbessern (Glättung, Strichstärken, Handballen-Schutz).
3. Phase 5a: Quizzo, Klassenfunk und Lernangebote als Fenster aus der Tafel starten (braucht Anmeldung und Supabase). Danach 2b (Auswahl, Text, Formen, Bilder, Seiten).
