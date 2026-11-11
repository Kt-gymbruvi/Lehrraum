# Projektstand – Lehrraum

Stand: 11.11.2026 · **nur lokal**, noch kein GitHub-Repository, nicht veröffentlicht.
Tests: 6 Testdateien, 92 Tests grün (`npm test`); Build grün (`npm run build`).

## Implementiert (Etappen 1.3, 2a, 2b, 2c, 3a und 5a der Roadmap)
- **Gerüst:** Vite/React/TypeScript/Tailwind wie Quizzo, HashRouter, Deploy-Workflow vorbereitet (läuft erst nach einem Push).
- **Tafel** (`#/tafel`):
  - Stift (dicker bei mehr Druck; bei Maus und Finger wird der Druck aus dem Tempo geschätzt), Textmarker (breit, durchscheinend), Radierer (entfernt ganze Striche, die er berührt).
  - **Text:** an die angetippte Stelle schreiben (mehrzeilig), Größe über die drei Stärke-Knöpfe; vorhandenen Text mit dem Textwerkzeug antippen oder mit der Auswahl doppelt antippen, um ihn zu ändern; leerer Text verschwindet.
  - **Formen:** Linie, Pfeil, Rechteck, Ellipse durch Aufziehen.
  - **Bilder:** über den Knopf in der linken Leiste (auch mehrere), per Einfügen aus der Zwischenablage oder Hineinziehen. PNG, JPEG, WebP, GIF, SVG; Bilder über 2400 px Kantenlänge werden verkleinert. Sie erscheinen eingepasst in der Mitte des Ausschnitts und lassen sich verschieben, duplizieren, löschen, radieren.
  - **PDF öffnen** (Kopfzeile): Jede PDF-Seite wird eine Tafelseite mit der PDF-Seite als festem Hintergrund zum Beschriften. Auf einer frischen Tafel ersetzt das PDF die leere Seite, sonst kommen die Seiten hinter die gezeigte. „Seite leeren“ lässt den Hintergrund stehen.
  - **Als PDF speichern** (Kopfzeile): alle Seiten in ein PDF (leere Seiten A4 quer, PDF-Seiten in Originalgröße, Gezeichnetes außerhalb vergrößert die Seite). Auf Geräten mit Teilen-Menü zusätzlich **Als PDF teilen** – auf dem iPad der Weg zu Goodnotes.
  - **Auswahl:** Element antippen, verschieben, umfärben, Stärke bzw. Schriftgröße ändern, duplizieren (Strg + D), löschen (Entf). Ziehen auf freier Fläche verschiebt die Ansicht.
  - **Seiten** (Leiste unten): blättern (auch Bild auf/ab), neue Seite, Seite duplizieren, nach vorne/hinten schieben, löschen (beschriebene Seiten mit Rückfrage). Jede Seite hat ihren eigenen Rückgängig-Verlauf; nach dem Neuladen erscheint die zuletzt gezeigte Seite.
  - Sechs Farben, drei Strichstärken, linke Werkzeugleiste dauerhaft sichtbar (zweispaltig, damit alle neun Werkzeuge ohne Rollen passen).
  - Rückgängig/Wiederholen (bis 200 Schritte je Seite), „Seite leeren“ lässt sich zurücknehmen.
  - Eingabe: Stift und Maus zeichnen; ein Finger zeichnet, bis einmal ein Stift benutzt wurde, danach verschiebt er (Handballen-Schutz); zwei Finger verschieben und zoomen; Mausrad verschiebt, Strg + Mausrad zoomt; Zoom-Knöpfe und „Ansicht zurücksetzen“.
  - Tastatur: A Auswahl, S Stift, M Textmarker, R oder E Radierer, T Text, L Linie, P Pfeil, Q Rechteck, O Ellipse, Strg + Z, Strg + Y bzw. Strg + Umschalt + Z, Strg + D, Entf, Bild auf/ab.
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
- **Dateispeicher:** Bilder und PDF-Seiten liegen als Dateien in IndexedDB (`dateien`), das Tafelbild nennt nur ihre Kennung. Unbenutzte Dateien werden beim Öffnen der Tafel entfernt.
- **Datenmodell Version 2** (`lehrraum/tafel`): Titel, Seiten mit Elementen (Strich, Text, Form, Bild) und optionalem Hintergrund, gezeigte Seite, Kamera, Fenster; Prüfung beim Laden. Tafeln der Version 1 (eine Fläche ohne Seiten) werden beim Laden in eine Seite umgewandelt und beim nächsten Speichern als Version 2 abgelegt.

## Getestet / nicht getestet
- Automatisch: Datenmodell und Prüfung, Rückgängig/Wiederholen, Geometrie, Speicher, Bedienung der Tafel (Zeichnen, Farbe, Stärke, Textmarker, Radierer, Leeren, Tastatur, Wiederherstellen, Handballen-Schutz, Zoom), Fenster (Logik, Öffnen/Schließen, Verschieben, Einklappen, Timer und Stoppuhr mit gestellter Zeit, Würfel, Notiz speichern), Anwendungen mit ersetztem Server (Anmeldung mit falschem und richtigem Passwort, Quiz im Teammodus starten, Beenden mit Rückfrage, Fehler beim Starten, Vergrößern, Klassenfunk-Sitzung, Lernangebote filtern/öffnen/QR), Version-1-Umwandlung, Seiten (Logik und Bedienung), Text (schreiben, ändern, verwerfen), Formen, Auswahl (verschieben, umfärben, duplizieren, löschen), Radierer auf Text und Formen, Bilder und Hintergründe im Datenmodell, Seitenmaß für den Export, Dateispeicher (Aufräumen), Bedienung von Bild einfügen/PDF öffnen/PDF speichern/Teilen mit ersetztem Bild- und PDF-Modul.
- Von Hand in der Vorschau (Desktop-Browser): Zeichnen mit der Maus, nachgestellte Stifteingabe mit wechselndem Druck, Textmarker, Radierer, Neuladen; alle fünf Fenster geöffnet, verschoben, Timer gestartet, gewürfelt, Notiz geschrieben; Lernangebote: alle 41 geladen, eines geöffnet und vergrößert; Quizzo-Fenster zeigt die Anmeldung; Text geschrieben, Rechteck, Ellipse und Pfeil gezeichnet, Element ausgewählt, Seite angelegt; eine gespeicherte Tafel der Version 1 wurde dabei geladen und umgewandelt; **mit echten Dateien:** ein PNG eingefügt, zwei Seiten als PDF erzeugt (gültiges PDF 1.7) und dieses PDF wieder geöffnet – beide Seiten erschienen als Hintergrund.
- **Nicht getestet – wichtig:** Quizzo und Klassenfunk gegen den echten Server. Es wurde nicht angemeldet, kein echtes Spiel und keine echte Sitzung gestartet. Ob die eingebettete Beamer-Ansicht im Fenster gut bedienbar ist, zeigt sich erst mit Anmeldung.
- **Nicht getestet:** große oder gescannte PDFs aus dem Unterricht (Tempo, Speicher), kennwortgeschützte PDFs, das Teilen-Menü und der Weg zu Goodnotes am iPad, Einfügen aus der Zwischenablage mit echten Bildern, Speichergrenzen bei vielen Bildern.
- **Nicht getestet:** echtes iPad mit Apple Pencil, Smartboard, Fingerbedienung, Zwei-Finger-Zoom am Gerät, Schreibgefühl und Verzögerung, sehr viele Striche (Tempo), Signalton des Timers (in der Vorschau nicht hörbar geprüft; iPad-Browser geben Ton erst nach einer Berührung frei – der Start-Knopf zählt als solche).

## Bekannte Grenzen
- Es gibt genau eine Tafel; kein Titel ändern, keine neue Tafel, kein Export.
- Bilder lassen sich nicht skalieren, drehen oder zuschneiden. Animierte GIFs stehen still.
- PDF-Seiten werden als Bild übernommen: Text im PDF ist danach nicht mehr markierbar, und das exportierte PDF enthält ebenfalls Bilder (größer als ein Text-PDF, nicht durchsuchbar).
- Der Export verwendet die Schrift des jeweiligen Geräts; Text kann im PDF minimal anders umbrechen als auf der Tafel eines anderen Geräts.
- Es gibt keine Export-/Importdatei für die ganze Tafel (zum Übertragen auf ein anderes Gerät) – nur PDF.
- Auswahl: immer nur ein Element durch Antippen (kein Rahmen-Aufziehen für mehrere), kein Skalieren oder Drehen, kein Gruppieren.
- Seiten: keine Miniaturen; Seiten löschen und umsortieren lässt sich nicht rückgängig machen (deshalb die Rückfrage). Alle Seiten teilen sich eine Ansicht (Zoom/Verschiebung); Seiten ohne PDF haben kein sichtbares Seitenformat.
- Die Größe von Text wird für Auswahl und Radierer geschätzt; bei sehr breiten oder schmalen Buchstaben sitzt der Auswahlrahmen nicht genau.
- Der Radierer löscht ganze Elemente, keine Teilstücke. Rechteck und Ellipse werden nur am Rand getroffen.
- Bei jeder Änderung werden alle Striche neu gezeichnet – bei sehr vollen Tafeln eventuell zu langsam (am Gerät prüfen).
- Der Knopf „Zur Startseite“ führt auf `/` – in der lokalen Vorschau also nicht auf die Startseite.
- In der lokalen Vorschau zeigen die Anwendungsfenster auf die veröffentlichte Plattform (`kt-gymbruvi.github.io`); dort ist man getrennt angemeldet, Quizzo fragt im Fenster also noch einmal nach dem Konto. Veröffentlicht entfällt das.
- Schließt man ein Anwendungsfenster, während ein Spiel läuft, bleibt das Spiel auf dem Server (Quizzo räumt es nach 6 Stunden auf). Sauber beendet wird es über „Beenden“.
- Die Lernangebote-Liste beachtet die in `lernen/#bearbeiten` gespeicherte Ordnung (Datenbank) noch nicht, nur `angebote.js`.
- Kein Abmelden in Lehrraum (würde auch Quizzo und Klassenfunk abmelden; dort geht es).
- Anwendungsfenster sind 40 rem breit; auf schmalen Bildschirmen ragen sie über den Rand (dann vergrößern).
- Ergebnisse lassen sich noch nicht auf die Tafel übernehmen (Etappe 5b, braucht Änderungen in Quizzo und Klassenfunk).
- Fenster haben eine feste Größe (nur die Notiz lässt sich am Textfeld ziehen); auf schmalen Bildschirmen überdecken sie sich.
- Notizen lassen sich noch nicht auf die Tafel „ablegen“ (Textelemente gibt es jetzt, die Verbindung fehlt).
- Noch nicht in der rechten Leiste: Zufallsschüler, Gruppen (brauchen Klassen, Phase 4), Lautstärkeampel, Arbeitsauftrag, Stundenablauf, QR-Code (3b).

## Nächste Schritte
1. **Erprobung am iPad und am Smartboard** (Roadmap: vor allem Weiteren). Dafür muss die App veröffentlicht oder im WLAN erreichbar sein.
2. Je nach Ergebnis nachbessern (Glättung, Strichstärken, Handballen-Schutz).
3. Quizzo und Klassenfunk mit echter Anmeldung ausprobieren (Lehrkraft).
4. Phase 4: Klassen, Zufall und Gruppen, Goodnotes-Link, Klassen-Kacheln auf der Startseite. Danach 2d (Hintergründe, Vorlagen) und 3b.
