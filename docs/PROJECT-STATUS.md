# Projektstand – Lehrraum

Stand: 13.11.2026 · live unter https://kt-gymbruvi.github.io/Lehrraum/ (`main` = `origin/main`, zuletzt veröffentlicht am 13.11.2026 mit der überarbeiteten Prüfansicht) · Repository `Kt-gymbruvi/Lehrraum` (öffentlich), Deploy per GitHub Actions bei Push auf `main`.
Tests: 8 Testdateien, 123 Tests grün (`npm test`); Build grün (`npm run build`).

## Schreiben am SMART Board (Spezifikation P1, P2)
- **Zeichnen höchstens einmal je Bildwechsel:** Der entstehende Strich und das Verschieben der Ansicht (Finger, Auswahl-Werkzeug, Mausrad) werden gebündelt, statt bei jeder einzelnen Meldung des Stifts neu zu zeichnen. Kein Punkt geht dabei verloren. (veröffentlicht)
- **Untere Ebene wird ergänzt:** Nach einem neuen Strich wird nur dieser eingezeichnet, nicht mehr die ganze Seite. Rückgängig, Radieren, Verschieben, Zoomen zeichnen weiter alles neu. (veröffentlicht)
- **Prüfansicht** unter `#/pruefen` (freie Tafel mit Messwerten), zweispaltig: Art der Eingabe, Druck, Größe der Berührung, Meldungen und Bildwechsel je Sekunde, längste Lücke (nur während der Zeiger sich bewegt), Rechenzeit je Bild, Wartezeit der Eingabe, Einzeichnen nach dem Abheben, Angaben zum Gerät. Seit 13.11.2026: **Zähler „Angekommen seit dem Öffnen: Stift · Finger · Maus“** und **Verlauf der letzten acht Striche** mit Nummer – ein Foto zeigt einen ganzen Testdurchgang. Der Schalter „Schärfe voll/halb“ ist wieder entfernt. Die Werte stehen nur auf dem Bildschirm. Auf der normalen Tafel wird nicht gemessen.
- Gemessen am Entwicklungsrechner (Desktop), alt/neu mit nachgestellter Eingabe: Rechenzeit je Stiftmeldung bei einem langen Strich 0,56 ms → 0,08 ms; Bildabstand am Ende eines Strichs mit 1200 Punkten 12,1 ms → 6,1 ms; nach dem Abheben auf einer Seite mit 500 Strichen 4,3 ms → 1,9 ms.
- **Gemessen am SMART Board (Lehrkraft, 12./13.11.2026, drei Fotos):** SMART Board MX mit eingebautem Windows-Rechner, Firefox 140, Bildschirm 1280 × 720 bei Faktor 3 (4K), bis zu 80 Berührungen. Mit dem Finger: rund 59 Meldungen und 108 Punkte je Sekunde, 60 Bilder je Sekunde, Rechenzeit der Tafel 0,4–0,6 ms je Bild (höchstens 3 ms), längster Hänger 17–18 ms, Wartezeit der Eingabe 18 ms (höchstens 35 ms). **Die Tafel selbst kommt am Board also mit.** Die rot markierte „längste Pause“ (26–67 ms) war vermutlich ein stillstehender Finger; deshalb zählt die Lücke jetzt nur noch bei Bewegung. „Schärfe halb“ brachte keinen Unterschied in der Rechenzeit; die Lehrkraft sah dabei deutlich dickere Striche (in Chromium nicht nachvollziehbar, Firefox mit Faktor 3 hier nicht prüfbar) – der Schalter ist deshalb entfernt.
- **Befund am SMART Board:** Kein einziger gemessener Strich kam als „Stift“ an, alle als „Finger“, Berührungsgröße immer 2 × 1 px (Firefox meldet dort keine echte Größe). Mit dem Stift Geschriebenes ließ sich nur mit der Faust wegwischen, nicht mit dem Radierer der Tafel; mit dem Finger Geschriebenes nicht mit der Faust. **Vermutung (noch nicht bestätigt):** Stift und Faust erreichen die Tafel gar nicht, sondern werden von SMART Ink abgefangen, das eine eigene Schreibschicht über den Browser legt. Dann gehört die Stiftschrift nicht zur Tafel (nicht gespeichert, nicht im PDF, nicht auf den Seiten).
- **Offen:** P1 (flüssiges Schreiben) ist für den Finger nach den Werten erfüllt, für den Stift nicht prüfbar, solange SMART Ink ihn abfängt. Ob die ursprüngliche Verzögerung vom Stift (SMART Ink) oder vom Finger (alte Fassung) kam, ist offen.

## Implementiert (Etappen 1.3, 2a, 2b, 2c, 3a, 4.1 und 5a der Roadmap)
- **Meine Klassen** (`#/klassen`): Klassen mit Bezeichnung, Fach und Jahrgang anlegen, bearbeiten, kopieren, archivieren und wiederherstellen, löschen (mit Rückfrage, samt Tafel). `#/klassen?neu=1` öffnet gleich das Formular. Alles liegt nur auf dem Gerät.
- **Eine Tafel je Klasse** (`#/tafel?klasse=<Kennung>`): wird beim ersten Öffnen angelegt und heißt wie die Klasse („7b Biologie“). `#/tafel` ohne Klasse ist die freie Tafel; was vor den Klassen gezeichnet wurde, bleibt dort. In der Kopfzeile der Tafel führt ein Knopf zu den Klassen.
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
- Automatisch: Datenmodell und Prüfung, Rückgängig/Wiederholen, Geometrie, Speicher, Bedienung der Tafel (Zeichnen, Farbe, Stärke, Textmarker, Radierer, Leeren, Tastatur, Wiederherstellen, Handballen-Schutz, Zoom), Fenster (Logik, Öffnen/Schließen, Verschieben, Einklappen, Timer und Stoppuhr mit gestellter Zeit, Würfel, Notiz speichern), Anwendungen mit ersetztem Server (Anmeldung mit falschem und richtigem Passwort, Quiz im Teammodus starten, Beenden mit Rückfrage, Fehler beim Starten, Vergrößern, Klassenfunk-Sitzung, Lernangebote filtern/öffnen/QR), Version-1-Umwandlung, Seiten (Logik und Bedienung), Text (schreiben, ändern, verwerfen), Formen, Auswahl (verschieben, umfärben, duplizieren, löschen), Radierer auf Text und Formen, Bilder und Hintergründe im Datenmodell, Seitenmaß für den Export, Dateispeicher (Aufräumen), Bedienung von Bild einfügen/PDF öffnen/PDF speichern/Teilen mit ersetztem Bild- und PDF-Modul, Klassen (Logik, Speicher, Seite mit Anlegen/Bearbeiten/Kopieren/Archivieren/Löschen), Tafel je Klasse getrennt von der freien Tafel, kein doppeltes Anlegen, Bilder anderer Tafeln bleiben beim Aufräumen erhalten.
- Von Hand in der Vorschau (Desktop-Browser): Zeichnen mit der Maus, nachgestellte Stifteingabe mit wechselndem Druck, Textmarker, Radierer, Neuladen; alle fünf Fenster geöffnet, verschoben, Timer gestartet, gewürfelt, Notiz geschrieben; Lernangebote: alle 41 geladen, eines geöffnet und vergrößert; Quizzo-Fenster zeigt die Anmeldung; Text geschrieben, Rechteck, Ellipse und Pfeil gezeichnet, Element ausgewählt, Seite angelegt; eine gespeicherte Tafel der Version 1 wurde dabei geladen und umgewandelt; **mit echten Dateien:** ein PNG eingefügt, zwei Seiten als PDF erzeugt (gültiges PDF 1.7) und dieses PDF wieder geöffnet – beide Seiten erschienen als Hintergrund.
- Veröffentlichte Fassung geprüft (Desktop-Browser): Zeichnen und Speichern, Lernangebote-Fenster lädt alle 41 Einträge von derselben Adresse, Quizzo-Fenster zeigt die Anmeldung, keine Fehler in der Konsole.
- Veröffentlichte Fassung am 12.11.2026 geprüft: Klasse angelegt, sie erscheint auf der Startseite der Plattform, „Zur Tafel“ öffnet ihre Tafel mit dem Klassennamen, Klasse wieder gelöscht; Haus-Knopf führt zur Startseite.
- Klassen von Hand in der Vorschau: Klasse angelegt, ihre Tafel geöffnet (Titel stimmt), freie Tafel daneben, Klasse gelöscht.
- Etappe „Schreiben am SMART Board“, automatisch: gebündeltes Zeichnen (30 Meldungen → ein Bild, alle Punkte bleiben), Ergänzen der unteren Ebene (auch nach Rückgängig/Wiederholen), gebündeltes Verschieben der Ansicht, Messlogik, Prüfansicht (Stift mit echtem Druck, große Berührung, Schärfe, kein Messen auf der normalen Tafel). Von Hand im Browser (Desktop, Maus): Strich, Rechteck, Auswahl verschieben, Ansicht verschieben, Schärfe halb; Vergleichsmessung alt/neu mit nachgestellter Eingabe.
- Veröffentlichte Fassung am 12.11.2026 geprüft (Desktop-Browser): `#/pruefen` zeigt die Prüfansicht, ein Strich wird gezeichnet und gemessen, keine Fehler in der Konsole. Ein Gerät, das die Tafel schon offen hatte, zeigt die neue Fassung erst nach dem Neuladen der Seite (bis dahin springt `#/pruefen` auf die normale Tafel).
- **Nicht getestet – wichtig:** die Etappe „Schreiben am SMART Board“ am SMART Board selbst und am iPad (Schreibgefühl, Verzögerung, ob das iPad unverändert gut läuft).
- **Nicht getestet – wichtig:** Quizzo und Klassenfunk gegen den echten Server. Es wurde nicht angemeldet, kein echtes Spiel und keine echte Sitzung gestartet. Ob die eingebettete Beamer-Ansicht im Fenster gut bedienbar ist, zeigt sich erst mit Anmeldung.
- **Nicht getestet:** große oder gescannte PDFs aus dem Unterricht (Tempo, Speicher), kennwortgeschützte PDFs, das Teilen-Menü und der Weg zu Goodnotes am iPad, Einfügen aus der Zwischenablage mit echten Bildern, Speichergrenzen bei vielen Bildern.
- **Nicht getestet:** echtes iPad mit Apple Pencil, Smartboard, Fingerbedienung, Zwei-Finger-Zoom am Gerät, Schreibgefühl und Verzögerung, sehr viele Striche (Tempo), Signalton des Timers (in der Vorschau nicht hörbar geprüft; iPad-Browser geben Ton erst nach einer Berührung frei – der Start-Knopf zählt als solche).

## Bekannte Grenzen
- Je Klasse gibt es genau eine Tafel (mit beliebig vielen Seiten), dazu die freie Tafel; kein Titel ändern, keine zweite Tafel pro Klasse.
- **Klassen haben noch keine Schülerliste**, keine Sitzordnung, keine Gruppen und keinen Goodnotes-Link; Zufallsschüler und Gruppen fehlen deshalb weiter in der rechten Leiste.
- Klassen und Tafeln liegen nur auf dem Gerät und im jeweiligen Browser; es gibt keine Übertragung auf ein anderes Gerät.
- Wird eine Klasse archiviert, bleibt ihre Tafel erhalten, ist aber erst nach „Wiederherstellen“ wieder erreichbar.
- Bilder lassen sich nicht skalieren, drehen oder zuschneiden. Animierte GIFs stehen still.
- PDF-Seiten werden als Bild übernommen: Text im PDF ist danach nicht mehr markierbar, und das exportierte PDF enthält ebenfalls Bilder (größer als ein Text-PDF, nicht durchsuchbar).
- Der Export verwendet die Schrift des jeweiligen Geräts; Text kann im PDF minimal anders umbrechen als auf der Tafel eines anderen Geräts.
- Es gibt keine Export-/Importdatei für die ganze Tafel (zum Übertragen auf ein anderes Gerät) – nur PDF.
- Auswahl: immer nur ein Element durch Antippen (kein Rahmen-Aufziehen für mehrere), kein Skalieren oder Drehen, kein Gruppieren.
- Seiten: keine Miniaturen; Seiten löschen und umsortieren lässt sich nicht rückgängig machen (deshalb die Rückfrage). Alle Seiten teilen sich eine Ansicht (Zoom/Verschiebung); Seiten ohne PDF haben kein sichtbares Seitenformat.
- Die Größe von Text wird für Auswahl und Radierer geschätzt; bei sehr breiten oder schmalen Buchstaben sitzt der Auswahlrahmen nicht genau.
- Der Radierer löscht ganze Elemente, keine Teilstücke. Rechteck und Ellipse werden nur am Rand getroffen.
- Beim Radieren, Verschieben, Zoomen und Rückgängig werden alle Striche neu gezeichnet (höchstens einmal je Bildwechsel) – bei sehr vollen Tafeln eventuell zu langsam (am Gerät prüfen). Nur ein neuer Strich wird ergänzt, ohne alles neu zu zeichnen.
- Der entstehende Strich wird je Bild ganz neu berechnet; bei sehr langen Strichen wächst der Aufwand mit der Länge.
- Die Prüfansicht misst nur die Rechenzeit der Tafel, nicht die Verzögerung des Displays selbst; „Längster Hänger“ und „Wartezeit der Eingabe“ zeigen aber, wenn das Gerät nicht hinterherkommt. Was SMART Ink abfängt, sieht sie gar nicht.
- Firefox meldet am SMART Board keine Größe der Berührung (immer 2 × 1 px); eine Faust lässt sich dort nicht an der Größe erkennen.
- In der lokalen Vorschau zeigen die Anwendungsfenster auf die veröffentlichte Plattform (`kt-gymbruvi.github.io`); dort ist man getrennt angemeldet, Quizzo fragt im Fenster also noch einmal nach dem Konto. Veröffentlicht entfällt das.
- Schließt man ein Anwendungsfenster, während ein Spiel läuft, bleibt das Spiel auf dem Server (Quizzo räumt es nach 6 Stunden auf). Sauber beendet wird es über „Beenden“.
- Die Lernangebote-Liste beachtet die in `lernen/#bearbeiten` gespeicherte Ordnung (Datenbank) noch nicht, nur `angebote.js`.
- Kein Abmelden in Lehrraum (würde auch Quizzo und Klassenfunk abmelden; dort geht es).
- Anwendungsfenster sind 40 rem breit; auf schmalen Bildschirmen ragen sie über den Rand (dann vergrößern).
- Ergebnisse lassen sich noch nicht auf die Tafel übernehmen (Etappe 5b, braucht Änderungen in Quizzo und Klassenfunk).
- Fenster haben eine feste Größe (nur die Notiz lässt sich am Textfeld ziehen); auf schmalen Bildschirmen überdecken sie sich.
- Notizen lassen sich noch nicht auf die Tafel „ablegen“ (Textelemente gibt es jetzt, die Verbindung fehlt).
- Noch nicht in der rechten Leiste: Zufallsschüler, Gruppen (brauchen Klassen, Phase 4), Lautstärkeampel, Arbeitsauftrag, Stundenablauf, QR-Code (3b).

## Rückmeldung aus der Erprobung (Lehrkraft, 12.11.2026)
- **Am SMART Board kommt die Schrift sehr verzögert und abgehakt**; am iPad läuft es besser. Ursache noch nicht gemessen. Vermutung im Code: Bei jeder Stiftbewegung wird der ganze entstehende Strich neu berechnet und die obere Zeichenebene ganz neu gezeichnet, ohne Bündelung je Bildwechsel.

## Nächste Schritte
Für Zeichenwerkzeuge und Auswahl gilt die freigegebene Spezifikation `docs/SPEC-zeichenwerkzeuge-und-auswahl.md` (12.11.2026). Umgesetzt und veröffentlicht ist davon der erste Teil von Etappe 1.
1. **Schreiben am SMART Board** (Spezifikation P1, P2): Erster Teil veröffentlicht und am Board gemessen (siehe oben). Die überarbeitete Prüfansicht ist veröffentlicht. Als Nächstes am Board:
   - **SMART Ink prüfen:** mit dem Stift schreiben, dann in der Tafel auf „Neue Seite“ tippen. Bleibt die Stiftschrift stehen, liegt sie in der Schicht von SMART Ink, nicht in der Tafel.
   - **SMART Ink für den Browser ausschalten** (über das SMART-Ink-Bedienelement oben rechts im Fenster, „SMART Ink ausschalten“ → „In dieser Anwendung“; ggf. die Schul-IT fragen), dann in `#/pruefen` nacheinander mit Finger, Stift und Faust je einen Strich, ein Foto. Dasselbe in Microsoft Edge (meldet vermutlich die Größe der Berührung, Firefox nicht).
   - Danach R4 (Faust) festlegen: Kommt die Faust als große Berührung, als Radierer des Stifts oder gar nicht an?
2. **Auswahl** (A1–A8, H1): Rahmen, mehrere Elemente, Größe ändern, Drehen, Kopieren/Einfügen, Gruppieren, Reihenfolge, Hand-Werkzeug; Datenmodell Version 3.
3. **Radierer** (R1–R4): Schwamm und Element-Radierer, drei Größen, Radieren mit Handrücken oder Faust.
4. **Stift** (S1–S3, W1): mehr Farben, Regler für die Stärke, Begradigen durch Halten.
5. **Laserpointer und Einstellungen merken** (L1, E1).
6. Weiter offen: Erprobung am iPad (Handballen, Zwei-Finger-Zoom, Text mit Bildschirmtastatur, PDF, Teilen an Goodnotes), Quizzo und Klassenfunk mit echter Anmeldung (Lehrkraft).
7. Phase 4 weiter: Schülerliste, Zufall und Gruppen, Sitzordnung, Goodnotes-Link. Danach 2d und 3b.
