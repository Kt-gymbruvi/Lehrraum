# Spezifikation – Zeichenwerkzeuge und Auswahl

Stand: 12.11.2026 · **Von der Lehrkraft freigegeben am 12.11.2026.** Umgesetzt wird in den Etappen aus Abschnitt 5; veröffentlicht wird jede Etappe erst nach Zustimmung.
Grundlage: `docs/PROJECT-STATUS.md`, `docs/DECISIONS.md`, die veröffentlichte Tafel, vier Fragerunden mit der Lehrkraft am 12.11.2026 und ihre Rückmeldung zum ersten Entwurf (Reihenfolge, Faust-Radieren, Rahmen, Griffe, Strichstärke).

Zeichen in diesem Dokument: **[Entschieden]** = Antwort der Lehrkraft. **[Vorschlag]** = von mir ergänzt, weil die Antwort es offen ließ; mit der Freigabe angenommen. Offene Fragen stehen gesammelt in Abschnitt 7.

## 1. Ziel und Rahmen

Die Tafel soll sich beim Schreiben, Wegwischen und Umordnen wie eine echte Tafel anfühlen – auf dem iPad mit Apple Pencil, am SMART Board mit Finger und Stift und am Laptop mit Maus gleichermaßen **[Entschieden: gemischt]**.

Unverändert gelten die Projektregeln: beide Leisten dauerhaft sichtbar, Bedienelemente mindestens 56 px (neu: Griffe an der Auswahl mindestens 44 px Trefferfläche), Zeichenfläche weiß, jede Änderung am Tafelinhalt lässt sich zurücknehmen, alles bleibt auf dem Gerät, keine fremden Server.

## 2. Ausgangslage

| Bereich | Heute |
|---|---|
| Stift, Textmarker | Sechs feste Farben, drei Stärken (3 / 6 / 12), gemeinsam für alle Werkzeuge. Keine Begradigung. |
| Radierer | Entfernt ganze Elemente, feste Größe. |
| Auswahl | Ein Element antippen, verschieben, umfärben, Stärke ändern, duplizieren, löschen. Keine Griffe. Ziehen auf freier Fläche verschiebt die Ansicht. |
| Einstellungen | Nach dem Neuladen immer Stift, Dunkelblau, mittel. |
| SMART Board | Laut Lehrkraft kommt die Schrift „sehr verzögert und abgehakt“; auf dem iPad läuft es besser. |

Befund im Code zum SMART Board (Vermutung, am Gerät zu bestätigen): Bei jeder einzelnen Stiftbewegung wird der ganze entstehende Strich neu berechnet und die ganze obere Zeichenebene gelöscht und neu gezeichnet – ohne Bündelung je Bildwechsel. Der Aufwand wächst mit der Strichlänge und mit der Auflösung des Displays (4K).

## 3. Anforderungen und Abnahmekriterien

### P – Schreiben am SMART Board

**P1 Flüssiges Schreiben.** Am SMART Board folgt der Strich dem Stift oder Finger ohne spürbare Verzögerung und ohne Ecken in runden Buchstaben. **[Entschieden: als Mangel gemeldet]**
- Schreibschrift in normaler Größe und normalem Tempo ergibt runde Bögen, keine Vielecke.
- Der Strich bleibt beim Schreiben höchstens eine Fingerbreite hinter der Stiftspitze zurück.
- Das gilt auch auf einer Seite mit 500 vorhandenen Strichen und bei einem langen Strich (10 Sekunden ohne Absetzen).
- Das Schreibgefühl am iPad wird dadurch nicht schlechter.

**P2 Prüfansicht.** Eine Ansicht zum Messen am Gerät zeigt, was das Gerät meldet: Art der Eingabe (Stift, Finger, Maus), Druck, Größe der Berührungsfläche, Meldungen je Sekunde, Bildwechsel je Sekunde und Rechenzeit je Meldung. **[Vorschlag]**
- Die Werte erscheinen nur auf dem Bildschirm; es wird nichts gespeichert oder gesendet.
- Mit ihr lässt sich am SMART Board klären, ob Stift und Faust unterscheidbar sind (Grundlage für R4).

### A – Auswahl

**A1 Rahmen aufziehen.** Mit dem Auswahl-Werkzeug auf freier Fläche ziehen spannt ein Rechteck auf; nach dem Loslassen ist ausgewählt, was der Rahmen berührt – es muss nicht ganz umschlossen sein. **[Entschieden]**
- Ein Rahmen über drei Elemente wählt genau diese drei; um alle liegt ein gemeinsamer Auswahlrahmen.
- Antippen einer freien Stelle hebt die Auswahl auf.
- Am Laptop fügt Umschalt + Antippen ein Element hinzu oder nimmt es heraus; Strg + A wählt alles auf der Seite.
- Der PDF-Hintergrund einer Seite wird nie ausgewählt.

**A2 Gemeinsam bearbeiten.** Alles, was heute für ein Element geht, geht für die ganze Auswahl: verschieben, umfärben, Stärke ändern, duplizieren, löschen. **[Entschieden]**
- Ziehen an einer beliebigen Stelle innerhalb des Auswahlrahmens verschiebt die Auswahl (auch zwischen den Buchstaben).
- Jede dieser Aktionen ist genau ein Schritt im Verlauf.

**A3 Größe ändern.** Der Auswahlrahmen hat Griffe. Eckgriffe behalten das Seitenverhältnis, Seitengriffe strecken oder stauchen in eine Richtung. Bilder und Text bleiben immer proportional. **[Entschieden]**
- Enthält die Auswahl ein Bild oder einen Text, gibt es nur Eckgriffe. **[Vorschlag]**
- Bei Handschrift und Formen wächst die Strichstärke am Eckgriff mit; am Seitengriff bleibt sie gleich. **[Entschieden]**
- Bei Text ändert sich die Schriftgröße; der Text bleibt bearbeitbar.
- Nichts lässt sich kleiner als etwa 8 Tafel-Einheiten ziehen oder umstülpen.
- Jeder Griff hat eine Trefferfläche von mindestens 44 px, auch wenn er kleiner gezeichnet ist (etwa 16 px). **[Entschieden: 44 px]**
- Ist die Auswahl so klein, dass sich die Trefferflächen überlappen würden, gibt es nur Eckgriffe und Drehgriff, und sie rücken nach außen. **[Vorschlag]**

**A4 Drehen.** Ein Drehgriff über dem Auswahlrahmen dreht die Auswahl um ihre Mitte. **[Entschieden]**
- In der Nähe von 0°, 45°, 90° usw. rastet die Drehung leicht ein; am Laptop dreht Umschalt in 15°-Schritten. **[Vorschlag]**
- Gedrehter Text und gedrehte Bilder erscheinen im PDF-Export genauso wie auf der Tafel.
- Gedrehter Text lässt sich weiter ändern; das Eingabefeld steht dabei gerade. **[Vorschlag]**
- Radierer und Auswahl treffen gedrehte Elemente dort, wo sie zu sehen sind.

**A5 Kopieren und Einfügen.** Ausgewähltes lässt sich kopieren und ausschneiden und auf derselben Seite, einer anderen Seite oder der Tafel einer anderen Klasse einfügen. **[Entschieden: auch zwischen Tafeln, nicht nach außen]**
- Strg + C, Strg + X, Strg + V; für Finger und Stift je ein Knopf.
- Eingefügtes erscheint in der Mitte des sichtbaren Ausschnitts und ist danach ausgewählt.
- Die Kopie bleibt nach dem Wechsel der Tafel und nach dem Neuladen verfügbar, liegt nur auf dem Gerät und ersetzt die vorige Kopie.
- Kopierte Bilder bleiben erhalten, auch wenn das Original gelöscht wurde (das Aufräumen der Bilddateien beachtet die Kopie).
- Einfügen eines Bildes aus einem anderen Programm funktioniert weiter wie heute.

**A6 Gruppieren.** Mehrere Elemente lassen sich zu einer Gruppe verbinden und wieder lösen. **[Entschieden]**
- Antippen eines Gruppenmitglieds wählt die ganze Gruppe.
- Gruppen bleiben beim Speichern, Duplizieren, Kopieren und im PDF erhalten.
- Gruppen in Gruppen gibt es nicht; wer Gruppen gruppiert, erhält eine große Gruppe. **[Vorschlag]**
- Der Element-Radierer entfernt nur das berührte Element, nicht die ganze Gruppe. **[Vorschlag]**

**A7 Reihenfolge.** Ausgewähltes lässt sich ganz nach vorne oder ganz nach hinten legen. **[Entschieden]**
- Ein Bild, das Handschrift verdeckt, liegt nach „nach hinten“ unter der Handschrift; ein Schritt im Verlauf.

**A8 Auswahlleiste.** Die Befehle für Ausgewähltes (Kopieren, Duplizieren, Gruppieren/Lösen, nach vorne, nach hinten, Löschen) stehen in einer kleinen Leiste direkt an der Auswahl. In der linken Leiste wird der Knopf „Duplizieren“ zu „Einfügen“. **[Vorschlag]**
- Die Auswahlleiste erscheint nur bei einer Auswahl, verdeckt die Auswahl nicht und bleibt im sichtbaren Bereich.

### H – Ansicht verschieben

**H1 Hand-Werkzeug.** Ein eigenes Werkzeug „Hand“ in der linken Leiste verschiebt die Ansicht durch Ziehen. **[Entschieden]**
- Taste H wählt es; am Laptop verschiebt außerdem Leertaste halten und ziehen, bei jedem Werkzeug.
- Zwei Finger, Mausrad und Zoom-Knöpfe arbeiten wie heute.
- Mit dem Auswahl-Werkzeug verschiebt Ziehen auf freier Fläche die Ansicht nicht mehr (dort entsteht der Rahmen, A1).

### R – Radierer

**R1 Zwei Radierer.** Umschaltbar zwischen „Schwamm“ und „Element-Radierer“. **[Entschieden]**
- Schwamm: wischt nur die überfahrenen Teile von Stift- und Textmarkerstrichen weg. Text, Formen und Bilder bleiben stehen.
- Element-Radierer: entfernt wie heute alles Berührte als Ganzes.
- Der Schwamm ist die Voreinstellung. **[Vorschlag]**

**R2 Teilstücke.** Ein Strich, der in der Mitte überwischt wird, zerfällt in zwei Striche mit unveränderter Farbe und Stärke.
- Die stehen gebliebenen Teile bleiben an ihrem Platz; nur die Schnittenden dürfen sich leicht verändern.
- Ein Wischzug (Aufsetzen bis Abheben) ist ein Schritt im Verlauf; Rückgängig stellt alles her.
- Sehr kurze Reste (kürzer als die Strichbreite) verschwinden.
- Die Reststücke lassen sich einzeln auswählen und verschieben.

**R3 Größe.** Der Radierer hat drei Größen (klein, mittel, groß); ein Kreis zeigt die Größe beim Radieren. **[Entschieden: wählbar; drei Stufen sind Vorschlag]**
- Die Größe gilt in Bildschirm-Maß und ändert sich beim Zoomen nicht.

**R4 Radieren mit Handrücken oder Faust.** Am SMART Board gilt wie an jeder SMART-Board-Tafel: Der Stift schreibt immer, Handrücken oder Faust radieren immer – ohne Werkzeugwechsel, auch im Wechsel. **[Entschieden]**
- Die Faust wischt wie der Schwamm, in der Größe der Berührung, bei jedem Werkzeug.
- Nach dem Wischen schreibt der Stift sofort weiter; nach dem Schreiben wischt die Faust sofort wieder.
- Ein beim Aufsetzen der Hand begonnener Strich wird verworfen und nicht gezeichnet.
- Am iPad mit Apple Pencil löscht der aufliegende Handballen nie etwas.
- Meldet ein Gerät keine Berührungsgröße, bleibt alles wie heute; es entsteht kein Fehler.
- Wie die Tafel die Faust am SMART Board vom Handballen am iPad unterscheidet, wird am Gerät geklärt (7.1). Gelingt das nicht sicher von selbst, gibt es einen Schalter „Mit der Hand radieren“, der je Gerät gemerkt wird.

### S – Stift, Textmarker, Farben, Stärken

**S1 Mehr Farben.** Die sechs Farben bleiben in der Leiste. Ein Knopf „Mehr“ öffnet eine größere Palette und einen Farbwähler; selbst gewählte Farben bleiben als eigene Plätze gespeichert. **[Entschieden]**
- Die Palette enthält rund 18 gut lesbare Farben, darunter typische Textmarkerfarben (Gelb, Hellgrün, Rosa). **[Vorschlag]**
- Bis zu sechs eigene Plätze je Gerät; eine neue Farbe verdrängt die älteste. **[Vorschlag]**
- Eine Farbe aus „Mehr“ wirkt wie eine Leistenfarbe: auf Neues oder auf die Auswahl.
- Die gewählte Farbe ist in der Leiste erkennbar, auch wenn sie keine der sechs ist.
- Der Farbwähler ist der des Geräts; es wird nichts geladen.

**S2 Mehr Stärken.** Die drei Knöpfe bleiben. Im Feld „Mehr“ gibt es einen Regler für Zwischenwerte und für sehr feine und sehr breite Striche. **[Entschieden]**
- Bereich etwa 1 bis 30; die drei Knöpfe entsprechen 3, 6 und 12. **[Vorschlag]**
- Bei einem Zwischenwert ist keiner der drei Knöpfe gedrückt; die Leiste zeigt die Stärke als Punkt.
- Die Schriftgröße neuer Texte richtet sich weiter nach den drei Stufen; feiner geht es über die Griffe (A3). **[Vorschlag]**

**S3 Begradigen durch Halten.** Wird der Stift am Ende eines Strichs kurz stillgehalten, wird der Strich zu einer sauberen Form: gerade Linie, Rechteck, Kreis/Ellipse oder Dreieck. **[Entschieden]**
- Haltezeit etwa 0,6 Sekunden; die saubere Form erscheint noch vor dem Abheben. **[Vorschlag]**
- Das Ergebnis ist eine normale Form in Farbe und Stärke des Strichs: auswählbar, skalierbar, drehbar.
- Schräg gezeichnete Rechtecke bleiben schräg.
- Wird nichts erkannt, bleibt der Strich, wie er ist. Ohne Halten wird nie begradigt.
- Rückgängig macht zuerst die Begradigung rückgängig (der freihändige Strich ist wieder da), ein zweites Mal entfernt den Strich.
- Der Textmarker wird beim Halten nur zur geraden Linie und bleibt Textmarker. **[Vorschlag]**
- Das Dreieck gibt es nur über die Erkennung, nicht als eigenes Werkzeug. **[Vorschlag]**

### L – Laserpointer

**L1 Zeigen.** Ein Werkzeug, dessen Spur nach kurzer Zeit von selbst verschwindet. **[Entschieden]**
- Die Spur ist rot und verblasst etwa 1,5 Sekunden nach dem Zeichnen. **[Vorschlag]**
- Sie wird nicht gespeichert, steht nicht im Verlauf und erscheint nicht im PDF.
- Der Speicherstand springt beim Zeigen nicht auf „Wird gespeichert“.

### E – Einstellungen merken

**E1 Zuletzt benutzt.** Werkzeug, Farbe, Stärke, Radierer-Art und -Größe und die eigenen Farbplätze sind nach dem Neuladen so wie zuletzt. **[Entschieden]**
- Gemerkt wird je Gerät und Browser, für alle Tafeln gemeinsam.
- War zuletzt Radierer, Laserpointer oder Hand gewählt, startet die Tafel mit dem Stift. **[Vorschlag]**

### W – Leiste

**W1 Platz.** Die linke Leiste erhält zwei Werkzeuge (Hand, Laserpointer – zwölf Knöpfe in sechs Reihen) und den Knopf „Mehr“. **[Vorschlag]**
- Auf einem iPad im Querformat (sichtbare Höhe ab 700 px) passt alles ohne Rollen.
- Erneutes Antippen des gewählten Radierers öffnet dessen Art und Größe.
- Aufklappfelder schließen sich beim Antippen der Tafel und verdecken die Leiste nicht dauerhaft.

## 4. Folgen für die Technik

- **Datenmodell Version 3:** neue Felder `drehung` (Text, Bild, Rechteck, Ellipse, Dreieck) und `gruppe` (alle Elemente), neue Formart `dreieck`. Version 2 wird beim Laden unverändert übernommen und beim nächsten Speichern als Version 3 abgelegt. Freie Farben und Stärken bis 200 lässt die Prüfung schon heute zu.
- **Befehle:** ein Sammelbefehl, der mehrere Änderungen zu einem Schritt bündelt (Schwamm, Reihenfolge, Gruppieren, Einfügen).
- **Kern:** Rahmen-Treffer, Skalieren, Drehen, Strich teilen und Formerkennung als reine Logik in `src/kern/` mit Tests ohne Browser.
- **Speicher:** Einstellungen und Kopie im vorhandenen Lager `einstellungen`; das Aufräumen der Bilddateien beachtet die Kopie. Das Lager `klassen` bleibt unberührt, die Startseite muss nicht angepasst werden.
- **Zeichnen:** `zeichnen.ts` bleibt der eine Weg für Tafel und PDF-Export.

## 5. Reihenfolge der Etappen

1. **Schreiben am SMART Board** (P1, P2) – zuerst, weil es den täglichen Gebrauch betrifft. **[Entschieden]** Stand 12.11.2026: erster Teil veröffentlicht (gebündeltes Zeichnen, Prüfansicht `#/pruefen`), am SMART Board noch nicht gemessen; P1 gilt erst nach dem Test am Gerät als erfüllt.
2. **Auswahl** (A1–A8, H1, Datenmodell Version 3). **[Entschieden]** In drei Teilen (13.11.2026): Teil 1 A1–A3 und H1 (veröffentlicht am 13.11.2026), Teil 2 A4 mit Datenmodell Version 3 (lokal fertig, nicht veröffentlicht), Teil 3 A5–A8 (lokal fertig, nicht veröffentlicht; die Auswahlleiste hat zusätzlich „Ausschneiden“).
3. **Radierer** (R1–R4).
4. **Stift** (S1–S3, W1).
5. **Laserpointer und Einstellungen merken** (L1, E1).

Jede Etappe endet mit Tests, Build, aktualisierten `docs/` und einer Prüfung am Gerät durch die Lehrkraft. Veröffentlicht wird erst nach Zustimmung.

## 6. Nicht Teil dieser Spezifikation

- Automatischer Wechsel zurück zum Auswahl-Werkzeug nach einer Form oder einem Text (nicht gewählt).
- Eigene Farbe und Stärke je Werkzeug (nicht gewählt).
- Radieren über Stifttaste, Stiftrückseite oder Doppeltipp am Apple Pencil (nicht gewählt).
- Lasso-Auswahl (Rahmen gewählt).
- Kopieren nach außen als Bild in andere Programme.
- Bilder zuschneiden; Text, Formen, Bilder, Seiten, PDF und Fenster darüber hinaus (eigene Spezifikationen).

## 7. Offene Punkte

Alle drei klären sich erst am Gerät; keiner braucht vor der Freigabe eine Entscheidung.

1. **Was meldet das SMART Board dem Browser?** Teilweise geklärt (13.11.2026): SMART Board MX, eingebauter Windows-Rechner, Firefox 140. Finger kommen an, Größe der Berührung meldet Firefox nicht (2 × 1 px). Stift und Faust kamen in der Messung nicht an – vermutlich fängt SMART Ink sie ab. Offen: Was kommt an, wenn SMART Ink für den Browser aus ist, und meldet Edge die Größe der Berührung? Davon hängt ab, ob R4 von selbst funktioniert oder den Schalter braucht.
2. **Passt die Leiste?** Zwölf Werkzeuge plus „Mehr“ auf dem kleinsten iPad im Querformat.
3. **Messwerte für P1.** „Ohne spürbare Verzögerung“ erhält Zahlen, sobald die Prüfansicht am SMART Board Werte geliefert hat.

## 8. Prüfung am Gerät

Automatische Tests decken Logik und Bedienung ab. Nur am echten Gerät zu beurteilen und nach jeder Etappe von der Lehrkraft zu prüfen: Schreibgefühl und Verzögerung (iPad, SMART Board), Radieren mit der Faust, Griffe mit dem Finger, Begradigen durch Halten, Platz in der Leiste.
