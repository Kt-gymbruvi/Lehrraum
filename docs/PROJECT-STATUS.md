# Projektstand – Lehrraum

Stand: 11.11.2026 · **nur lokal**, noch kein GitHub-Repository, nicht veröffentlicht.
Tests: 4 Testdateien, 48 Tests grün (`npm test`); Build grün (`npm run build`).

## Implementiert (Etappen 1.3, 2a, 3a und 5a der Roadmap)
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
- **Anwendungen in der Tafel** (zweite Gruppe der rechten Leiste):
  - **Quizzo:** eigene Quizze auflisten und durchsuchen, Modus Einzeln oder Teams (2–6), „Starten“ ruft die vorhandene Datenbankfunktion `spiel_erstellen` auf und zeigt Quizzos Beamer-Ansicht im Fenster. „Beenden“ fragt nach und löscht das Spiel samt Spieldaten.
  - **Klassenfunk:** Präsentationen auflisten, Sitzung über `kf_sitzung_starten` starten, Beamer-Ansicht im Fenster, „Beenden“ löscht die Sitzung.
  - **Lernangebote:** Liste aus `lernen/angebote.js` der Startseite, Filter nach Fach und Jahrgang, Suche, Anzeige im Fenster, QR-Code für die Klasse. Ohne Anmeldung.
  - Anwendungsfenster lassen sich auf die ganze Tafelfläche vergrößern. Das laufende Spiel bzw. die Sitzung wird mit der Tafel gemerkt und ist nach dem Neuladen wieder da.
  - **Anmeldung** für Lehrkräfte im Fenster (dasselbe Konto wie Quizzo). Veröffentlicht unter derselben Adresse gilt eine bestehende Quizzo-Anmeldung automatisch.
  - An Quizzo und Klassenfunk wurde dafür nichts geändert.
- **Datenmodell Version 1** (`lehrraum/tafel`): Titel, Striche, Kamera, Fenster; Prüfung beim Laden. Tafeln ohne Fensterliste (erste Fassung) bleiben ladbar.

## Getestet / nicht getestet
- Automatisch: Datenmodell und Prüfung, Rückgängig/Wiederholen, Geometrie, Speicher, Bedienung der Tafel (Zeichnen, Farbe, Stärke, Textmarker, Radierer, Leeren, Tastatur, Wiederherstellen, Handballen-Schutz, Zoom), Fenster (Logik, Öffnen/Schließen, Verschieben, Einklappen, Timer und Stoppuhr mit gestellter Zeit, Würfel, Notiz speichern), Anwendungen mit ersetztem Server (Anmeldung mit falschem und richtigem Passwort, Quiz im Teammodus starten, Beenden mit Rückfrage, Fehler beim Starten, Vergrößern, Klassenfunk-Sitzung, Lernangebote filtern/öffnen/QR).
- Von Hand in der Vorschau (Desktop-Browser): Zeichnen mit der Maus, nachgestellte Stifteingabe mit wechselndem Druck, Textmarker, Radierer, Neuladen; alle fünf Fenster geöffnet, verschoben, Timer gestartet, gewürfelt, Notiz geschrieben; Lernangebote: alle 41 geladen, eines geöffnet und vergrößert; Quizzo-Fenster zeigt die Anmeldung.
- **Nicht getestet – wichtig:** Quizzo und Klassenfunk gegen den echten Server. Es wurde nicht angemeldet, kein echtes Spiel und keine echte Sitzung gestartet. Ob die eingebettete Beamer-Ansicht im Fenster gut bedienbar ist, zeigt sich erst mit Anmeldung.
- **Nicht getestet:** echtes iPad mit Apple Pencil, Smartboard, Fingerbedienung, Zwei-Finger-Zoom am Gerät, Schreibgefühl und Verzögerung, sehr viele Striche (Tempo), Signalton des Timers (in der Vorschau nicht hörbar geprüft; iPad-Browser geben Ton erst nach einer Berührung frei – der Start-Knopf zählt als solche).

## Bekannte Grenzen
- Es gibt genau eine Tafel; kein Titel ändern, keine neue Tafel, keine Seiten, kein Export.
- Der Radierer löscht ganze Striche, keine Teilstücke.
- Bei jeder Änderung werden alle Striche neu gezeichnet – bei sehr vollen Tafeln eventuell zu langsam (am Gerät prüfen).
- Der Knopf „Zur Startseite“ führt auf `/` – in der lokalen Vorschau also nicht auf die Startseite.
- In der lokalen Vorschau zeigen die Anwendungsfenster auf die veröffentlichte Plattform (`kt-gymbruvi.github.io`); dort ist man getrennt angemeldet, Quizzo fragt im Fenster also noch einmal nach dem Konto. Veröffentlicht entfällt das.
- Schließt man ein Anwendungsfenster, während ein Spiel läuft, bleibt das Spiel auf dem Server (Quizzo räumt es nach 6 Stunden auf). Sauber beendet wird es über „Beenden“.
- Die Lernangebote-Liste beachtet die in `lernen/#bearbeiten` gespeicherte Ordnung (Datenbank) noch nicht, nur `angebote.js`.
- Kein Abmelden in Lehrraum (würde auch Quizzo und Klassenfunk abmelden; dort geht es).
- Anwendungsfenster sind 40 rem breit; auf schmalen Bildschirmen ragen sie über den Rand (dann vergrößern).
- Ergebnisse lassen sich noch nicht auf die Tafel übernehmen (Etappe 5b, braucht Änderungen in Quizzo und Klassenfunk).
- Fenster haben eine feste Größe (nur die Notiz lässt sich am Textfeld ziehen); auf schmalen Bildschirmen überdecken sie sich.
- Notizen lassen sich noch nicht auf die Tafel „ablegen“ – dafür braucht es Textelemente (Etappe 2b).
- Noch nicht in der rechten Leiste: Zufallsschüler, Gruppen (brauchen Klassen, Phase 4), Lautstärkeampel, Arbeitsauftrag, Stundenablauf, QR-Code (3b).

## Nächste Schritte
1. **Erprobung am iPad und am Smartboard** (Roadmap: vor allem Weiteren). Dafür muss die App veröffentlicht oder im WLAN erreichbar sein.
2. Je nach Ergebnis nachbessern (Glättung, Strichstärken, Handballen-Schutz).
3. Quizzo und Klassenfunk mit echter Anmeldung ausprobieren (Lehrkraft).
4. Phase 2b: Auswahl, Text, Formen, Pfeile, Bilder, Seiten. Danach Phase 4 (Klassen) und 2c (PDF).
