# Entscheidungen – Lehrraum

Neue Entscheidungen oben anfügen: Datum, Entscheidung, Grund, verworfene Alternativen.
Grundsatzentscheidungen zur Plattform stehen in `../Kt-gymbruvi.github.io/docs/DECISIONS.md` (11.11.2026).

## 2026-11-14 – PDF-Seiten als Bild (SPEC Etappe A)
- **PDF-Seite = Bild-Element plus Blattmaß der Seite** (`Seite.blatt`) statt Hintergrund: So gilt alles, was Bilder können (drehen, verschieben, löschen, rückgängig), ohne eigene PDF-Knöpfe. Das Blatt behält das Maß der PDF-Seite, auch wenn das Bild gelöscht oder verschoben wird. Verworfen: PDF weiter als Hintergrund mit mehr Knöpfen (doppelte Bedienung).
- **Ältere PDF-Seiten werden beim Laden umgewandelt** (Version 5 → 6), so dass sie gleich aussehen; das Bild liegt zuunterst, das Geschriebene darüber bleibt unverändert. Die PDF-Kennung und „alle Seiten dieses PDFs löschen“ entfallen.
- **„Bild wählen …“ für alle Seiten lässt PDF-Seiten aus** – ein Hintergrundbild würde das Maß der PDF-Seite ändern.

## 2026-11-14 – Handballen: Stift hat Vorrang
- **Stift verwirft, was die Hand begonnen hat** (Geste oder Fingerstrich), statt übergangen zu werden.
- **Berührungen während und bis 1 s nach dem Stift sind Handballen.** Verworfen: Größe der Berührfläche auswerten (meldet Safari nicht verlässlich); Finger nach dem ersten Stift ganz abschalten (dann ginge Verschieben mit dem Finger nicht mehr).

## 2026-11-14 – Zufall & Gruppen (SPEC Etappe 4)
- **„Heute nicht da“ und „schon dran“ nicht speichern:** Das wären Anwesenheitsdaten; die gehören ins Notenbuch, nicht in die Tafel. Nach dem Schließen des Fensters ist alles weg.
- **Nur in der Klassentafel:** In der freien Tafel gibt es keine Namen; der Knopf erscheint dort nicht.
- **Gruppen als Text-Element an die Tafel:** ein Schritt im Verlauf, wie jeder andere Text verschieb- und löschbar. Verworfen: eigene Element-Art für Gruppen (mehr Code ohne Nutzen).
- **Gleichmäßige Gruppen:** Bei „Personen je Gruppe“ so viele Gruppen, dass keine größer ist als gewünscht; Größen unterscheiden sich höchstens um eins.

## 2026-11-14 – Klassen mit Namen und Abgleich (SPEC Etappe 3)
- **Notenbuch-Passwort, eigener Schlüssel:** Der Klassen-Tresor hat ein eigenes Salz; wer ihn öffnen kann, kann damit weder Notenbuch noch Namensliste öffnen. Gibt es eine Namensliste, muss das Passwort zu ihr passen – so kann kein zweites Passwort entstehen.
- **Schlüssel statt Passwort auf dem Gerät:** nicht exportierbarer `CryptoKey` in IndexedDB. Verworfen: Passwort in jedem Besuch neu fragen (lästig im Unterricht), Passwort speichern (unsicher).
- **Tafeln bleiben auf dem Gerät:** zu groß (Bilder, PDFs) und nicht gewünscht. Abgeglichen werden nur Klassen, Vorlage und Namen.
- **Kennung der Notenbuch-Klassen aus der Notenbuch-Kennung abgeleitet** (Hex-Zeichen): Zwei Geräte legen dieselbe Klasse an, ohne sich abzusprechen – keine Doppelten.
- **Neuere Änderung gewinnt je Klasse, Löschungen mit Zeitpunkt:** einfach und für eine Person mit wenigen Geräten ausreichend. Verworfen: feldweises Zusammenführen.
- **Im Notenbuch gelöscht → hier archiviert:** Die Tafel der Klasse soll nicht unbemerkt verloren gehen.
- **Namen von Notenbuch-Klassen nicht im Klassen-Tresor:** Sie stehen schon in der Namensliste; doppelt gespeichert könnten sie sich widersprechen.

## 2026-11-14 – Seitenübersicht: Umsetzung (Etappe 4)
- **Umsortieren nicht im Rückgängig-Verlauf:** Der Verlauf gehört je zu einer Seite; eine Reihenfolge der ganzen Tafel passt dort nicht hinein (wie schon „Seite nach vorne/hinten schieben“). Stattdessen „Reihenfolge zurücksetzen“, solange die Übersicht offen ist. Verworfen: eigener Verlauf für die Tafel (großer Umbau für einen seltenen Fall).
- **Finger und Stift: erst halten, dann ziehen.** Sonst ließe sich die Liste mit dem Finger nicht rollen. Die Maus zieht sofort.
- **Zeiger erst beim Ziehen einfangen:** Ein Einfangen schon beim Aufsetzen schickt den Klick an die Kachel statt an den Knopf darin – Antippen öffnete dann keine Seite.
- **Vorschaubilder nach und nach zeichnen** (je Bildwechsel höchstens 10 ms), nicht gespeichert: Die Übersicht geht sofort auf, auch mit vielen Seiten.

## 2026-11-14 – Eigenes Bild und Vorlage je Klasse: Umsetzung (Etappe 3)
- **Bild-Hintergrund wie eine PDF-Seite:** Die Seite bekommt das Seitenverhältnis des Bildes und füllt das Format aus, statt das Bild mittig mit weißem Rand zu setzen. So gibt es keinen Unterschied zwischen Bild und Blatt, und Drehen, Entfernen, Export funktionieren wie bei PDF-Seiten. Verworfen: Bild mittig im 16:9-Blatt (weißer Rand, zweite Größe zu verwalten).
- **Kein Muster auf Bildseiten:** Muster unter einem Bild wären unsichtbar, darüber störend.
- **„Als Hintergrund“ als ein Befehl:** Der Befehl `hintergrund` nimmt das Bild-Element mit (`entfernt`), damit Zurücknehmen beides in einem Schritt herstellt.
- **Vorlage bei der Klasse, nicht in der Tafel:** Klasse Version 2 mit `vorlage` (Format, Muster). Sie gilt beim ersten Anlegen der Klassentafel und für neue Seiten; das Format einer bestehenden Tafel ändert sie nicht (das ginge nur mit Rückfrage, siehe Format nicht im Verlauf). Eigene Bilder gehören nicht dazu.
- **Neue Seiten mit Vorlage bekommen deren Muster**, auch wenn die gezeigte Seite ein anderes hat: Die Vorlage ist der ausdrückliche Wunsch für diese Klasse.

## 2026-11-14 – Muster: Umsetzung (Etappe 2)
- **Muster noch in Version 5:** Version 5 (Format) ist noch nicht veröffentlicht; das Muster kommt deshalb ohne eigene Versionsnummer dazu. Ältere Tafeln (bis Version 4) haben kein Muster.
- **Gezeichnet, nicht gespeichert:** Muster sind eine Angabe an der Seite (`art`, `abstand`, `farbe`) und werden bei jedem Zeichnen berechnet – scharf bei jedem Zoom, kein Speicher, Radierer und Auswahl erfassen sie nie. Linien einer Farbe und Breite in einem Pfad, damit Verschieben flüssig bleibt.
- **Feld deckend statt Glas:** Das Feld „Hintergrund“ ist groß und voller Text; als Glas schien die Seitenleiste durch.
- **„Muster beim Export weglassen“ wird nicht gespeichert:** ein seltener Wunsch für einen einzelnen Export; nach dem Neuladen gilt wieder „mit Muster“.

## 2026-11-14 – Seitenformat: Umsetzung (Etappe 1)
- **Format nicht im Verlauf:** Der Rückgängig-Verlauf gehört je zu einer Seite, das Format zur ganzen Tafel. Das Format lässt sich stattdessen jederzeit zurückstellen, ohne dass etwas verloren geht; „Inhalt einpassen“ ist je Seite ein Schritt im Verlauf.
- **Abschneiden statt verbieten:** Elemente dürfen über den Blattrand ragen (z. B. beim Verschieben); gezeigt und exportiert wird nur, was auf dem Blatt liegt. Das Gespeicherte bleibt vollständig.
- **Blatt auf das Canvas gezeichnet** (statt eines eigenen HTML-Elements): so passen Zoom, Verschieben und Abschneiden ohne zweite Rechnung zusammen. Schatten ohne `shadowBlur`, damit Verschieben am SMART Board flüssig bleibt.
- **16:9 = 1600 × 900 Tafel-Einheiten:** bei Zoom 1 etwa so groß wie ein Laptop-Bildschirm; Strichstärken und Schriftgrößen behalten ihr gewohntes Verhältnis.

## 2026-11-14 – Umfang „Seitenformat und Hintergründe“ (Antworten der Lehrkraft)
- **Feste Seiten wie in GoodNotes, 16:9 als Standard:** passt genau auf das SMART Board; A4 hoch/quer und „Unendlich“ bleiben wählbar. Bestehende Tafeln werden zu „Unendlich“, damit sich an ihnen nichts ändert.
- **Gewünscht:** Muster wählbar (liniert, kariert …), für diese Seite oder alle Seiten; eigenes Bild als Hintergrund; Vorlage je Klasse; Seitenübersicht. Export ohne Muster nehme ich mit („wie du willst“).
- **Verworfen:** Sportfelder als Hintergrund, Taktiktafel mit Spielerplättchen, Abdecken/Aufdecken (vorerst), farbige Hintergründe – das Blatt bleibt weiß.

## 2026-11-14 – Aussehen im Stil von Apple (Wunsch der Lehrkraft)
- **Schwebende Leisten neben dem Blatt, nicht darüber:** Die Leisten behalten ihren eigenen Platz; das Blatt wird nicht unter sie gezogen. Sonst lägen der Anfang einer Seite und PDF-Seiten (beide oben links) unter der linken Leiste.
- **Glas nur, wo es trägt:** Halbdurchsichtige Flächen mit Unschärfe für alle Leisten; Fenster (Uhr, Timer, Quizzo …) bleiben deckend, damit ihr Inhalt am Beamer gut lesbar ist. Im dunklen Modus ist das Glas fast deckend (92 %), sonst wirkt es über dem weißen Blatt grau.
- **Eine kräftige Hervorhebung:** nur das gewählte Werkzeug. Farbe (Ring) und Stärke (leichte Fläche) zurückhaltender – so sieht man auf einen Blick, womit man gerade schreibt.
- **Türkis statt Gelb im dunklen Modus**, wie inzwischen in `tokens.css` der Startseite.
- **Systemschrift statt `ui-rounded`/Nunito:** wirkt auf Apple-Geräten wie eine Apple-App und braucht weiterhin keine geladene Schrift.

## 2026-11-14 – PDF-Seiten drehen und entfernen (Wunsch der Lehrkraft)
- **Drehen in 90°-Schritten mit dem Geschriebenen:** Das gedrehte Bild wird nicht neu gerechnet. Der Hintergrund merkt sich nur `drehung`, gezeichnet wird gedreht um die Mitte. Die Elemente werden um die Seitenmitte gedreht und so verschoben, dass die Seite wieder bei (0, 0) beginnt. Viermal Drehen ergibt genau den Anfang, ohne Rundungsfehler im Bild. Verworfen: ein neues, gedrehtes Bild speichern, weil das bei jedem Drehen an Schärfe verliert und mehr Speicher braucht.
- **Datenmodell Version 4** statt stillem Umdeuten: `drehung` und `pdf` sind neue Angaben am Hintergrund. Version 3 wird unverändert übernommen. Eine mit Version 4 gespeicherte Tafel kann die frühere Fassung nicht mehr öffnen, deshalb auf jedem Gerät einmal neu laden.
- **Neuer Befehl `hintergrund`** (vorher/nachher plus geänderte Elemente) statt neuer Signaturen für alle Befehle: Die bestehenden Funktionen bleiben, wie sie sind. Neue Hüllen `ausfuehrenAuf`/`rueckgaengigAuf`/`wiederholenAuf` arbeiten auf Elementen und Hintergrund. So sind Drehen und Entfernen je ein Schritt, den Rückgängig zurücknimmt.
- **„Alle Seiten dieses PDFs“ über eine Kennung je Import** (`pdf`) statt über den Dateinamen oder aufeinanderfolgende Seiten: Seiten können verschoben oder dupliziert sein, gehören aber weiter zusammen. Ältere PDF-Seiten haben keine Kennung und werden nicht erraten.
- **Seitenlöschen bleibt ohne Rückgängig** wie bisher (Seiten liegen außerhalb des Verlaufs je Seite). Dafür gibt es eine Rückfrage mit drei Antworten.

## 2026-11-14 – Laserpointer und Einstellungen merken (L1, E1)
- **Laserpointer, überarbeitet nach Rückmeldung der Lehrkraft („sieht nicht cool aus“, Vorbild GoodNotes):** statt einer flachen roten Linie, die als Ganzes verblasst, jetzt ein Schweif wie bei einem echten Laserpointer: Jeder Punkt altert für sich (0,7 s voll, nach 1,5 s weg – entspricht der Spezifikation „etwa 1,5 Sekunden nach dem Zeichnen“), der Schweif wird zum Ende dünner und blasser, beim Stillhalten bleibt nur der Leuchtpunkt. Verworfen: die ganze Geste bis zum Abheben stehen lassen – wirkt wie ein roter Stift, nicht wie ein Laser. Gezeichnet in vier Schichten (weiter Schein, Schein, Rot, fast weißer Kern) und ein Leuchtpunkt mit Farbverlauf; bewusst ohne `shadowBlur`, der langsame Geräte wie das SMART Board bremst. Für wenige Pfade je Bild wird der Schweif in zehn Helligkeitsstufen zusammengefasst. Breiten in Bildschirm-Pixeln (unabhängig vom Zoom).
- **Spur nur auf der oberen Ebene** der Zeichenfläche (kein Element, kein Befehl): so steht sie nie im Verlauf, nie im Gespeicherten oder im PDF, und der Speicherstand ändert sich nicht. Das Verblassen läuft mit höchstens einem Bild je Bildwechsel, solange etwas zu sehen ist.
- **Platz und Taste:** zwölfter Knopf in der untersten Reihe neben „Bild“ (W1: zwölf Knöpfe in sechs Reihen); Taste Z („zeigen“), weil L schon die Linie ist. Strg + Z bleibt Rückgängig.
- **Einstellungen getrennt von den Farbplätzen** unter eigenem Schlüssel `werkzeugwahl` mit Schema `lehrraum/einstellungen` Version 1; die Prüfung ersetzt Unbekanntes einzeln durch die Voreinstellung, statt alles zu verwerfen. Gemerkt wird sofort bei jeder Änderung (eine kleine Schreibaktion), ohne den Speicherstand der Tafel zu berühren.
- **Laden zusammen mit der Tafel:** sonst könnten die gemerkten Einstellungen eine Wahl überschreiben, die schon vor dem Ende des Ladens getroffen wurde.
- **Start mit dem Stift** nach Radierer, Laserpointer oder Hand (Vorschlag der Spezifikation); Auswahl, Text und Formwerkzeuge bleiben erhalten. Gespeichert wird trotzdem das tatsächliche Werkzeug, damit Art und Größe des Radierers erhalten bleiben.

## 2026-11-14 – Stift, Teil 2: Begradigen durch Halten (S3)
- **Haltezeit 0,6 s, Zittern bis 8 Bildschirm-Pixel** zählt als Stillstehen (Vorschlag aus der Spezifikation; am SMART Board und iPad nachprüfen). Die Form erscheint noch vor dem Abheben. Bewegt sich der Stift danach weiter, gilt die Form nicht mehr und der Strich bleibt freihändig – so wird beim Schreiben mit Denkpause nichts begradigt.
- **Erkennung ohne Lernverfahren, nur Geometrie** (keine KI-Aufrufe): erst die Linie (alle Punkte höchstens 7 % der Länge von der Strecke, kein Hin und Her). Sonst muss der Strich fast geschlossen sein (Lücke höchstens 20 % des Wegs); dann werden Rechteck (kleinstes umschließendes, auch schräg), Ellipse (im selben Rahmen) und Dreieck (größtes Dreieck in der konvexen Hülle) verglichen und die Form mit dem kleinsten mittleren Abstand genommen, wenn dieser höchstens 6 % der Größe beträgt. Fünfecke und ähnlich runde Vielecke werden dadurch zum Kreis; Herz, Stern, „8“ und offene Bögen bleiben Striche.
- **Einrasten:** bis 5° Abweichung werden Linien waagerecht/senkrecht und Rechtecke, Ellipsen und Dreiecke gerade gestellt; darüber bleiben sie schräg (Spezifikation: „Schräg gezeichnete Rechtecke bleiben schräg“). Fast runde Ellipsen (Achsen höchstens 10 % verschieden) werden zum Kreis, Dreiecke mit fast mittiger oder fast rechtwinkliger Spitze genau so.
- **Zwei Schritte im Verlauf mit vorhandenen Befehlen:** „hinzufügen“ (der freihändige Strich), dann „ersetzen“ (die Form mit derselben Kennung). Rückgängig bringt so zuerst den Strich zurück (Spezifikation). Kein neuer Befehl, kein neues Datenmodell – das Dreieck mit `spitze` gab es schon seit Version 3.
- **Textmarker** wird nur zur geraden Linie (ein Strich mit zwei Punkten) und bleibt Textmarker.
- **Stärke der Form = eingestellte Stärke** wie beim Formwerkzeug; der freihändige Stiftstrich wirkt etwas breiter. Bewusst nicht angeglichen, damit Formen aus Werkzeug und Begradigen gleich aussehen; nach der Prüfung am Gerät ggf. nachjustieren.

## 2026-11-14 – Stift, Teil 1: mehr Farben, eigene Farbplätze, Stärke-Regler (S1, S2, W1)
- **Aufteilung:** Teil 1 baut S1, S2 und den Knopf „Mehr“ (W1). Das Begradigen durch Halten (S3, Formerkennung) folgt als Teil 2. Den Laserpointer (zweites neues Werkzeug aus W1) bringt Etappe 5.
- **Ein Feld „Mehr“ für Farben und Stärke**, als siebter Knopf in der Farbgruppe; es öffnet sich wie das Radierer-Feld rechts neben der Leiste und schließt sich beim Antippen außerhalb, mit Escape und beim Werkzeugwechsel. Liegt Farbe oder Stärke außerhalb der Leiste, ist „Mehr“ gedrückt und zeigt einen Punkt in Farbe und Stärke (S1, S2: „erkennbar“, „als Punkt“).
- **Palette mit 18 Farben**, die sechs der Leiste zuerst, dazu u. a. Gelb, Hellgrün, Rosa, Hellblau (Textmarker) und Weiß (für Bilder und PDF-Seiten).
- **Eigene Farbplätze nur aus dem Farbwähler des Geräts** (Palettenfarben brauchen keinen Platz), neueste vorne, höchstens sechs, gespeichert in IndexedDB (Lager `einstellungen`, Schlüssel `farbplaetze`, Schema `lehrraum/farbplaetze` Version 1, beim Laden geprüft). Verworfen: `localStorage` – die Tafel speichert alles Übrige ebenfalls in IndexedDB.
- **Farbwähler und Regler wirken erst beim Loslassen** (Ereignis „change“ des Browsers), sonst entstünde bei jeder Bewegung ein Schritt im Verlauf, wenn etwas ausgewählt ist. Der Regler zeigt den Wert schon beim Ziehen.
- **Leiste bei 700 px sichtbarer Höhe:** Mit dem Knopf „Mehr“ ragte sie 27 px über den Rand. Unter 47rem Höhe werden Abstände und Farbknöpfe etwas dichter (Farbknöpfe 32 statt 36 px hoch); dann passt sie bei 1024 × 700 genau. Am echten iPad nachsehen (Spezifikation 7.2).

## 2026-11-13 – Radierer, Teil 1: Schwamm, Teilstücke, Größen (R1–R3)
- **Aufteilung:** Teil 1 baut R1–R3. R4 (Radieren mit Faust oder Handrücken) folgt als Teil 2 erst nach der Messung am SMART Board – ob und wie die Faust beim Browser ankommt und wie sie sich vom Handballen am iPad unterscheiden lässt, ist noch offen (Spezifikation 7.1).
- **Schnitt genau am Rand des Schwamms:** Jede Teilstrecke eines Strichs wird gegen die Bahn des Schwamms seit der letzten Meldung (Kreis, entlang einer Strecke gezogen) geprüft; der Abstand ändert sich entlang einer Strecke konvex, darum lässt sich der überwischte Teil genau eingrenzen und dort ein Schnittpunkt einsetzen (Druck dazwischen gemittelt). So bleiben die Reste an ihrem Platz, auch bei Strichen mit wenigen Punkten und schneller Bewegung. Verworfen: nur Punkte wegnehmen (Lücken je nach Punktabstand, lange gerade Stücke würden ganz verschwinden) und alle Striche vorher fein unterteilen (macht gespeicherte Tafeln größer).
- **Berührt heißt: der Kreis berührt den sichtbaren Strich** (Radius + halbe Strichbreite) – wie beim Element-Radierer. Beim breiten Textmarker wird dadurch auch eine etwas breitere Lücke gewischt.
- **Neuer Befehl `zerlegen`** (je Strich: Stelle, Original, Teile) statt Entfernen + Hinzufügen: die Teile liegen an der Stelle des Originals in der Reihenfolge (wichtig für Textmarker über Text), ein Wischzug ist ein Schritt im Verlauf, Zurücknehmen setzt das Original wieder an seine Stelle. Kein neues Datenmodell nötig: Teile sind gewöhnliche Striche mit neuen Kennungen (Gruppe bleibt).
- **Art und Größe im Aufklappfeld am Radierer** (zweites Antippen, wie in W1 vorgesehen; kleines Dreieck am Knopf als Hinweis). Das Feld steht rechts neben der Leiste und schließt sich beim Antippen außerhalb, mit Escape und beim Werkzeugwechsel; das Antippen der Tafel radiert dabei gleich. Der Knopf zeigt Schwamm oder Radierer. Größen 8, 18 und 40 px Radius (Bildschirm).
- **Kreis auch beim Schweben** von Maus oder Stift, nicht nur beim Radieren – so sieht man die Größe vor dem Aufsetzen.
- Art und Größe werden erst mit E1 (Etappe 5) über das Neuladen hinweg gemerkt; bis dahin startet der Radierer als Schwamm, mittel.

## 2026-11-13 – Auswahl, Teil 3: Kopieren, Gruppieren, Reihenfolge, Auswahlleiste
- **Die Kopie liegt in IndexedDB** (Lager `einstellungen`, Schlüssel `ablage`, eigenes Schema `lehrraum/ablage` Version 1, Elemente wie im Tafel-Datenmodell, beim Laden geprüft). So gilt sie für alle Tafeln, übersteht das Neuladen und bleibt auf dem Gerät. Verworfen: die Zwischenablage des Systems – dort lassen sich keine eigenen Daten zuverlässig ablegen, und Kopieren nach außen ist nicht vorgesehen.
- **Hinweistext in der Zwischenablage des Systems beim Kopieren:** Sonst läge dort noch ein früher kopiertes Bild, und Strg + V (das zuerst nach Dateien von außen schaut) würde dieses einfügen. Was danach in einem anderen Programm kopiert wird, ersetzt den Hinweis und wird wie bisher eingefügt. Strg + C/X/V werden nicht verhindert, damit der Browser seine Ereignisse schickt; kommt keines (manche Geräte, Bildschirmtastaturen), geschieht es nach 150 ms trotzdem – nie doppelt.
- **Gruppe als Kennung am Element** (`gruppe`, schon in Version 3), keine eigene Gruppen-Liste: Speichern, Kopieren, PDF und Radierer brauchen dafür nichts Neues. Gruppen in Gruppen gibt es nicht (Spezifikation). Kopien bekommen eigene, neue Gruppen-Kennungen.
- **Reihenfolge als eigener Befehl `ordnen`** (Liste der Kennungen vorher/nachher) statt Entfernen + Hinzufügen: ein Schritt im Verlauf, und Elemente, die zwischendurch hinzukommen, bleiben, wo sie sind.
- **Auswahlleiste** unter der Auswahl (unter den Griffen), sonst über dem Drehgriff, immer in der Fläche; während des Ziehens ausgeblendet, damit sie nicht an der alten Stelle im Weg steht. „Ausschneiden“ ist zusätzlich zur Spezifikation in der Leiste, weil es sonst nur über die Tastatur ginge.
- **Aufräumen der Bilddateien bricht ab, wenn die Tafel schon geschlossen ist** (z. B. schneller Wechsel zwischen Klassentafeln); beim nächsten Öffnen wird aufgeräumt.

## 2026-11-13 – Auswahl, Teil 2: Drehen und Datenmodell Version 3
- **Winkel in Grad, im Uhrzeigersinn, auf −180 bis 180 gebracht**; 0 wird nicht gespeichert. Grad statt Bogenmaß, weil sich Einrasten und Prüfen so lesbar schreiben lassen und die gespeicherten Werte verständlich bleiben.
- **Wer dreht wie:** Striche, Linien und Pfeile drehen ihre Punkte (kein eigener Winkel – sie sind schon frei geformt). Text und Bild drehen um ihre linke obere Ecke, Rechteck, Ellipse und Dreieck um ihre Mitte. Beim Drehen einer Auswahl wandert der jeweilige Drehpunkt um die Mitte der Auswahl und der Winkel kommt hinzu – das Ergebnis ist für jeden Drehpunkt dasselbe. Linke obere Ecke bei Text, damit das gerade Eingabefeld beim Ändern dort beginnt, wo der Text anfängt, und die geschätzte Textbreite den Drehpunkt nicht verschiebt.
- **Der Auswahlrahmen bleibt achsparallel** und umschließt das Gedrehte. Verworfen: ein mitgedrehter Rahmen für einzelne Elemente – mehr Aufwand bei den Griffen, für den Unterricht kein erkennbarer Gewinn.
- **Gedrehte Rechtecke, Ellipsen, Texte und Bilder nur mit Eckgriffen:** In einer Richtung gestreckt würde ein gedrehtes Rechteck zum Parallelogramm, das sich im Modell nicht abbilden lässt.
- **Drehgriff 48 px über den oberen Griffen** (bei kleinen Auswahlen über den nach außen gerückten Ecken), damit sich die 44-px-Trefferflächen nicht überlappen. Er bleibt oben, auch wenn die Auswahl am oberen Rand liegt (dann erst die Ansicht verschieben).
- **Einrasten am Gesamtwinkel** eines einzelnen Elements (±5° um Vielfache von 45°), bei mehreren am Drehwinkel. So wird ein schräg stehendes Bild mit einem Zug wieder gerade.
- **Version 3 auf einmal:** `drehung`, `gruppe` und die Formart `dreieck` kommen gemeinsam, auch wenn Gruppen erst in Teil 3 und Dreiecke erst mit dem Begradigen (Etappe 4) benutzt werden – so gibt es nur einen Formatwechsel. Das Dreieck wird als Rahmen mit Grundseite unten, Lage der Spitze (`spitze`, 0–1) und Drehung gespeichert: Damit lässt sich jedes Dreieck darstellen (längste Seite als Grundseite), und Strecken, Drehen und Treffer funktionieren wie bei Rechteck und Ellipse.
- **Folge für das Veröffentlichen:** Die bisher veröffentlichte Fassung lehnt Version 3 ab. Ein Gerät, das noch die alte Fassung geladen hat, fände eine schon als Version 3 gespeicherte Tafel nicht und legte eine neue an (die alte bliebe im Speicher erhalten). Deshalb nach dem Veröffentlichen die Seite auf jedem Gerät einmal neu laden.

## 2026-11-13 – Auswahl, erster Teil (Spezifikation A1–A3, H1)
- **Etappe 2 in drei Teilen** (Lehrkraft: „Etappe 2 starten“, vor dem Test am SMART Board): 1. Rahmen, mehrere Elemente, Größe ändern, Hand-Werkzeug; 2. Drehen mit Datenmodell Version 3; 3. Kopieren/Einfügen, Gruppieren, Reihenfolge, Auswahlleiste. Grund: Teil 1 braucht keine Änderung am gespeicherten Format und lässt sich für sich prüfen; Version 3 kommt in einem Schritt mit allen neuen Feldern statt in zwei Versionen.
- **„Berührt“ heißt: die sichtbare Linie liegt im Rahmen** (Strich mit halber Breite, Formen als Strecken, die Ellipse als 32-Eck), bei Text und Bild genügt der umschließende Rahmen. Ein Rahmen im leeren Inneren eines großen Rechtecks wählt es nicht – sonst ließe sich darin Geschriebenes nicht für sich auswählen. Verworfen: Treffer über den umschließenden Rahmen (wählt bei schrägen Strichen zu viel).
- **Griffe:** gezeichnet 16 px, greifbar 44 × 44 px (Quadrat um den Griff, bei Überlappung der nächste). Seitengriffe nur, wenn die Auswahl auf dem Bildschirm mindestens 88 px breit und hoch ist; sonst rücken die Eckgriffe auf 44 px Abstand nach außen. Griffe gehen vor allem anderen; mit Umschalt werden sie übergangen (dann gilt Hinzunehmen/Herausnehmen).
- **Am Eckgriff zählt der Zug entlang der Diagonale**, damit das Verhältnis bleibt und die Auswahl dem Zeiger ruhig folgt. Strichstärke wächst mit (bis 200), Schriftgröße bleibt in den Grenzen der Prüfung (6–400). Mindestgröße: keine Richtung kleiner als 8 Einheiten, was schon kleiner ist, wird nicht noch kleiner.
- **Ziehen im Auswahlrahmen verschiebt die Auswahl**, auch über nicht ausgewählten Elementen darin; ein bloßes Antippen eines solchen Elements wählt dann nur dieses. Antippen einer freien Stelle im Rahmen lässt die Auswahl stehen (zwischen Buchstaben soll sie nicht verloren gehen).
- **Leertaste** verschiebt am Laptop die Ansicht und wird dafür abgefangen; Knöpfe lösen sich dann nicht mehr mit der Leertaste aus (Eingabetaste geht). Verworfen: nur auf der Zeichenfläche hören – dort hat die Tastatur nie den Fokus.
- **Finger nach einem Stift** verschieben weiter nur die Ansicht, auch auf Griffen (Handballen-Schutz unverändert). Ob das am iPad stört, zeigt die Prüfung am Gerät.

## 2026-11-13 – Erste Messung am SMART Board, Prüfansicht überarbeitet
- **Befund:** Am SMART Board MX (Windows, Firefox 140, 4K bei Faktor 3) braucht die Tafel 0,4–0,6 ms je Bild bei 60 Bildern je Sekunde – sie ist nicht der Engpass. Alle gemessenen Striche kamen als „Finger“ an; Stiftschrift ließ sich nur mit der Faust löschen, nicht mit dem Radierer der Tafel. Vermutung: SMART Ink fängt Stift und Faust ab und zeichnet in eine eigene Schicht über dem Browser. Wird am Gerät geprüft, bevor daraus Folgen gezogen werden.
- **Keine weiteren Eingriffe ins Zeichnen** (Auflösung begrenzen, Vorhersage, langen Strich teilweise berechnen), solange die Werte das nicht verlangen.
- **Schalter „Schärfe voll/halb“ entfernt:** Er brachte am Board keinen Unterschied in der Rechenzeit, und die Lehrkraft sah damit dickere Striche, die sich hier nicht nachstellen ließen. Ein Prüfwerkzeug, das selbst Fragen aufwirft, hilft nicht.
- **Lücke zählt nur bei Bewegung** (mindestens 6 px zwischen zwei Meldungen): Ein stillstehender Finger meldet nichts; das wurde bisher als rote „längste Pause“ angezeigt, obwohl nichts hakte.
- **Zähler je Eingabeart und Verlauf der letzten acht Striche mit Nummer:** Die Lehrkraft konnte die Fotos den Handlungen nicht mehr zuordnen. Jetzt zeigt ein Foto nach dem ganzen Durchgang alles – und „Stift 0“ zeigt sofort, dass ein Stift die Seite nicht erreicht.
- **Prüfansicht zweispaltig**, damit sie bei 720 px Höhe ohne Rollen passt (rollen geht nicht, weil sie Berührungen an die Tafel durchlässt).

## 2026-11-12 – Schreiben am SMART Board, erster Teil (Spezifikation P1, P2)
- **Gezeichnet wird höchstens einmal je Bildwechsel** (`requestAnimationFrame`): Stiftmeldungen sammeln nur Punkte, das Zeichnen folgt gebündelt. Beim Aufsetzen und Abheben wird sofort gezeichnet. Grund: Bisher wurde bei jeder Meldung der ganze Strich neu berechnet und die Ebene neu gezeichnet; ein langsames Gerät kommt damit nicht hinterher.
- **Auch die Ansicht wird gebündelt weitergemeldet** (Verschieben mit Finger, Auswahl-Werkzeug, Mausrad): Jede Änderung der Ansicht zeichnet alle Elemente neu, das soll nicht öfter als einmal je Bild geschehen. Beim Loslassen gilt sofort der letzte Stand.
- **Die untere Ebene wird ergänzt, wenn nur etwas hinzukommt.** Erkannt wird das daran, dass die bisherigen Elemente unverändert vorne in der Liste stehen und sich sonst nichts geändert hat (Ansicht, Größe, Verstecktes, Bilder). Der beim Abheben schon eingezeichnete Strich wird nicht doppelt gezeichnet; nach jedem vollständigen Neuzeichnen gilt dieser Merker nicht mehr (sonst fehlte der Strich nach Rückgängig + Wiederholen).
- **Prüfansicht als eigene Adresse `#/pruefen`** auf der freien Tafel statt als Knopf in der Leiste: Sie wird selten gebraucht und soll im Unterricht nicht im Weg sein. Sie misst über eigene Zuhörer am Fenster und greift nicht in die Eingabe ein. Die Zeichenfläche meldet ihre Rechenzeiten nur, solange die Prüfansicht offen ist (`tafel/messung.ts`).
- **Messwerte nur auf dem Bildschirm**, kein Speichern, kein Senden, kein Kopier-Knopf – die Lehrkraft fotografiert sie. So bleibt es bei „keine Trackingdienste“.
- **Schalter „Schärfe voll/halb“ nur in der Prüfansicht:** ein Versuch am Gerät, ob die Auflösung der Zeichenfläche (4K) bremst. Erst wenn das Messwerte zeigen, wird die Auflösung im Normalbetrieb begrenzt. (Am 13.11.2026 wieder entfernt, siehe oben.)
- Zurückgestellt, bis Messwerte vom SMART Board vorliegen: langen Strich nur am Ende neu berechnen (Gefahr sichtbarer Nahtstellen), Vorhersage der Stiftposition, Zeichenebene ohne Abgleich mit dem Bildaufbau (`desynchronized`, kann flackern).

## 2026-11-12 – Spezifikation Zeichenwerkzeuge und Auswahl freigegeben
Einzelheiten und Abnahmekriterien in `docs/SPEC-zeichenwerkzeuge-und-auswahl.md`. Entschieden von der Lehrkraft:
- **Zuerst das Schreiben am SMART Board**, dann Auswahl, Radierer, Stift, Laserpointer und Einstellungen. Grund: Die Verzögerung dort stört den täglichen Gebrauch am meisten.
- **Mehrfachauswahl per Rahmen** mit dem Auswahl-Werkzeug; ausgewählt wird, was der Rahmen berührt. Ziehen auf freier Fläche verschiebt die Ansicht dann nicht mehr – dafür ein eigenes **Hand-Werkzeug**. Verworfen: Lasso.
- **Größe ändern:** Eckgriffe proportional, Seitengriffe frei; Bilder und Text immer proportional; die Strichstärke wächst am Eckgriff mit. **Drehen** über einen Drehgriff.
- **Griffe an der Auswahl: mindestens 44 px Trefferfläche** (neue Regel neben den 56 px für Knöpfe, auch in `CLAUDE.md`).
- **Kopieren und Einfügen auch zwischen Tafeln**, die Kopie bleibt auf dem Gerät. Nicht nach außen in andere Programme.
- **Zwei Radierer:** Schwamm (Teilstücke von Handschrift, lässt Text, Formen und Bilder stehen) und Element-Radierer (wie bisher), Größe wählbar.
- **Am SMART Board schreibt der Stift immer und die Faust radiert immer**; am iPad löscht der Handballen nie. Wie die Tafel beides unterscheidet, wird am Gerät geklärt; notfalls ein Schalter je Gerät.
- **Farben:** sechs in der Leiste, dazu „Mehr“ mit größerer Palette, Farbwähler und eigenen Plätzen. **Stärken:** drei Knöpfe plus Regler.
- **Begradigen durch Halten** zu Linie, Rechteck, Kreis/Ellipse und Dreieck.
- Außerdem: Gruppieren, Reihenfolge, Laserpointer, Einstellungen merken.
- Nicht gewünscht: eigene Farbe und Stärke je Werkzeug, Radieren über Stifttaste, automatischer Wechsel zur Auswahl nach einer Form.

## 2026-11-12 – Meine Klassen und eine Tafel je Klasse (Etappe 4.1)
- **Klassen sind ein eigenes Datenmodell** (`lehrraum/klasse`, Version 1) im IndexedDB-Lager `klassen` (Datenbank-Version 3): Bezeichnung, Fach, Jahrgang, archiviert, `tafelId`. Nur auf dem Gerät. Schülernamen kommen später in dasselbe Modell (neue Version).
- **Die Klasse zeigt auf ihre Tafel** (`tafelId`), nicht umgekehrt – eine Tafel bleibt ein eigenständiges Dokument. Angelegt wird sie erst beim ersten Öffnen.
- **Adresse `#/tafel?klasse=<Kennung>`:** So kann die Startseite direkt in die Tafel einer Klasse verlinken. In die Adresse gelangt nur die zufällige Kennung, kein Name.
- **Die freie Tafel wird festgehalten** (`freie-tafel` in den Einstellungen). Ohne Festlegung gilt die zuletzt benutzte Tafel, sofern sie keiner Klasse gehört – so bleibt erhalten, was vor den Klassen gezeichnet wurde. Vor dem Anlegen einer Klassentafel wird die freie Tafel festgehalten.
- **Gleichzeitiges Öffnen derselben Klasse teilt sich ein Ergebnis** (`oeffneKlassenTafel`). Beim Ausprobieren waren sonst zwei Tafeln für eine Klasse entstanden (doppelt ausgeführte Ladeschritte).
- **Aufräumen der Bilddateien berücksichtigt alle Tafeln**, nicht mehr nur die geöffnete – sonst hätte das Öffnen einer Tafel die Bilder der anderen gelöscht.
- **Löschen einer Klasse löscht ihre Tafel** (mit Rückfrage); Archivieren behält sie. Kopieren übernimmt nur die Angaben, nicht die Tafel (gedacht fürs neue Schuljahr).
- **Die Startseite liest die Klassen mit** (`gemeinsam/klassen.js` dort): gleiche Adresse, gleiche Datenbank, nur lesend, und sie schließt die Verbindung sofort wieder. Ändert sich das Format der Klassen, muss das Skript der Startseite mitgeändert werden.

## 2026-11-11 – Bilder und PDF (Rest von 2b, Etappe 2c)
- **Bilddaten getrennt vom Tafelbild:** IndexedDB-Lager `dateien` (Datenbank-Version 2), das Tafelbild speichert nur `dateiId`. So bleibt das automatische Speichern klein und schnell, auch mit vielen Bildern.
- **Aufräumen nur beim Öffnen der Tafel:** Dann gibt es keinen Rückgängig-Verlauf, der ein gelöschtes Bild zurückholen könnte.
- **PDF-Seiten werden als Bild (JPEG, doppelte Auflösung) zum Seitenhintergrund** (`Seite.hintergrund`). Der Hintergrund ist kein Element: nicht auswählbar, nicht radierbar, „Seite leeren“ lässt ihn stehen. Verworfen: das PDF bei jedem Zeichnen neu rendern (langsam, PDF.js müsste immer geladen sein).
- **Export als Bild je Seite** (JPEG in pdf-lib) statt als Vektoren: ein Zeichenweg für Tafel und Export (`zeichnen.ts`), dafür nicht durchsuchbar und größer. Reicht für Goodnotes und zum Ausdrucken.
- **PDF.js und pdf-lib werden erst bei Bedarf geladen** (eigene Dateien im Paket, zusammen rund 2 MB) – die Tafel startet ohne sie. Beide stammen aus dem eigenen Paket, nichts von fremden Servern.
- **Seitengröße beim Export:** PDF-Seiten behalten ihre Größe; Seiten ohne Hintergrund sind mindestens A4 quer ab der Ecke (0, 0) und wachsen mit dem Gezeichneten. Solange es kein sichtbares Seitenformat gibt, geht so nichts verloren.
- **Goodnotes über das Teilen-Menü** (`navigator.share` mit Datei) – die dokumentierte Betriebssystemfunktion. Der Knopf erscheint nur, wo das Gerät Dateien teilen kann; sonst bleibt „Als PDF speichern“.
- **Große Bilder werden auf 2400 px verkleinert**, SVG wird beim Einfügen in ein Pixelbild umgewandelt (kein fremder Code im Speicher).
- **Bild- und PDF-Verarbeitung stecken in `tafel/bilder.ts` und `tafel/pdf.ts`**; Tests ersetzen beide Module, weil die Testumgebung weder Bilder entschlüsseln noch PDFs zeichnen kann. Der echte Weg wurde von Hand im Browser geprüft.

## 2026-11-11 – Text, Formen, Auswahl und Seiten (Etappe 2b)
- **Datenmodell Version 2:** Ein Tafelbild hat Seiten (`seiten`, `seiteNr`), jede mit eigenen Elementen. `pruefeTafel` versteht Version 1 und wandelt sie in eine Seite um; die alte Fassung wird erst beim nächsten Speichern überschrieben. Elemente sind `strich`, `text`, `form`.
- **Neuer Befehl `ersetzen`** (vorher/nachher mit gleicher Kennung) für Verschieben, Umfärben, Größe und Textänderung – ein Schritt im Verlauf, Reihenfolge der Elemente bleibt.
- **Verlauf je Seite**, nicht je Tafel: „Rückgängig“ wirkt immer auf das, was man sieht. Seitenoperationen (anlegen, löschen, schieben) stehen nicht im Verlauf; Löschen einer beschriebenen Seite fragt nach.
- **Text wird in einem Eingabefeld über der Fläche geschrieben** und erst beim Verlassen als Element auf die Tafel gelegt. So funktionieren Bildschirmtastatur, Korrektur und Markieren wie gewohnt. Gezeichnet wird der Text auf dem Canvas in derselben Schrift.
- **Textgröße wird ohne Browser geschätzt** (0,55 × Schriftgröße je Zeichen), damit Auswahl und Radierer in `kern/` testbar bleiben. Ungenau bei ungewöhnlichen Buchstabenbreiten – bewusst in Kauf genommen.
- **Rechteck und Ellipse zählen nur am Rand als getroffen:** Man soll hineinschreiben und innen radieren können, ohne die Form zu erwischen.
- **Strichstärke und Schriftgröße teilen sich die drei Knöpfe** (fein/mittel/breit = 24/36/56) – keine vierte Knopfgruppe in der Leiste.
- **Farbe und Stärke wirken auf die Auswahl**, wenn etwas ausgewählt ist; sonst gelten sie für Neues.
- **Linke Leiste zweispaltig**, weil neun Werkzeuge einspaltig auf einem iPad im Querformat nicht ohne Rollen passen (Vorgabe: Leisten dauerhaft sichtbar).
- **Der Handballen-Schutz gilt für die ganze Sitzung** (Merker außerhalb der Komponente), nicht nur bis zum nächsten Seitenwechsel.
- Zurückgestellt: Bilder (brauchen Dateispeicher), Mehrfachauswahl per Rahmen, Skalieren, Miniaturen der Seiten.

## 2026-11-11 – Quizzo, Klassenfunk und Lernangebote in der Tafel (Etappe 5a)
- **Einbetten statt nachbauen:** Lehrraum startet Spiel bzw. Sitzung über die vorhandenen Funktionen (`spiel_erstellen`, `kf_sitzung_starten`) und zeigt dann die unveränderte Beamer-Ansicht der jeweiligen Anwendung in einem iframe. Quizzo und Klassenfunk bleiben unberührt und testen sich weiter selbst.
- **Gleiche Datenbank, gleiches Konto:** `@supabase/supabase-js` mit dem publishable-Schlüssel wie Quizzo. Die Anmeldung liegt im `localStorage` derselben Adresse und gilt damit für alle drei Anwendungen. Deshalb kein „Abmelden“ in Lehrraum.
- **Der ganze Serverzugriff steht in `src/speicher/server.ts`**; Tests ersetzen dieses Modul und sprechen nie mit dem echten Server. Lehrraum liest nur Titel eigener Quizze/Präsentationen – keine Schülerdaten.
- **Das laufende Spiel wird im Fenster gemerkt** (`ziel`), damit ein Neuladen der Tafel das Spiel nicht verliert. In eine Adresse gelangen nur Kennungen aus Buchstaben, Ziffern und Bindestrich (`istZiel`).
- **Beenden mit Rückfrage**, weil dabei die Spieldaten gelöscht werden.
- **Lernangebote aus `lernen/angebote.js` der Startseite** (als Skript der eigenen Plattform geladen) statt aus der Tabelle `lernangebote`: Nur die Datei enthält alle Angebote; die Tabelle enthält nur geänderte Einträge. Verworfen: Liste in Lehrraum kopieren (würde bei jedem neuen Angebot veralten).
- **`.env.development` ist eingecheckt** (nur öffentlicher Schlüssel), damit die Vorschau ohne Handarbeit läuft. Im Testmodus wird keine Verbindung eingerichtet.
- **QR-Code** mit der Bibliothek `qrcode` (MIT) als eingebettetes SVG-Bild.

## 2026-11-11 – Fenster über der Tafel (Etappe 3a)
- **Fenster sind eine eigene Ebene über der Zeichenfläche** und gehören nicht zu den Tafelelementen: Sie werden nicht mitgezoomt, nicht radiert und stehen nicht im Rückgängig-Verlauf. Gespeichert werden sie aber mit der Tafel (`fenster` im Tafelbild), damit die Aufstellung beim nächsten Öffnen wieder da ist.
- **Die Ebene fängt keine Eingaben ab** (`pointer-events: none`), nur die Fenster selbst – so bleibt die Tafel daneben beschreibbar.
- **Uhr, Timer, Stoppuhr, Würfel je einmal** (der Leistenknopf schaltet ein/aus), **Notizen beliebig oft** (höchstens 12 Fenster).
- **Eingeklappte Fenster bleiben eingebaut**, nur versteckt – ein laufender Timer läuft weiter.
- **Timer als eigene Komponente** statt das Werkzeug der Startseite per iframe einzubetten: Ein kleines Fenster braucht eine andere Aufteilung als die Beamer-Seite, und so bleibt die Tafel ohne zweite Seite ladbar. Der Timer der Startseite bleibt unverändert bestehen.
- **Laufende Zeiten werden nicht gespeichert:** Ein Timer, der nach dem Neuladen „irgendwo“ weiterläuft, wäre verwirrender als einer, der neu gestellt wird.
- **Würfel mit `crypto.getRandomValues` und Verwerfen schiefer Werte** – jede Augenzahl gleich wahrscheinlich.

## 2026-11-11 – Zeichenfläche (Etappe 2a)
- **Eigene Zeichenfläche auf Canvas**, Striche mit `perfect-freehand` (MIT). Zwei Ebenen: unten alle fertigen Striche, oben nur der entstehende Strich – so muss beim Schreiben nicht alles neu gezeichnet werden.
- **Pointer Events für Maus, Finger und Stift.** Druck nur vom Stift (`pointerType: 'pen'`); bei Maus/Finger schätzt die Bibliothek ihn aus dem Tempo. Zwischenpunkte über `getCoalescedEvents`.
- **Handballen-Schutz:** Sobald einmal ein Stift benutzt wurde, verschieben Finger nur noch. Verworfen: Finger immer zeichnen lassen (Handballen malt mit) oder nie (dann wäre die Tafel am Smartboard ohne Stift unbenutzbar).
- **Radierer löscht ganze Striche.** Einfach, schnell, sauber rückgängig zu machen. Teilweises Radieren würde Striche zerschneiden; bei Bedarf später.
- **Textmarker als gleichmäßig breite, durchscheinende Linie** statt als Umriss – sonst entstehen dunkle Stellen, wo sich der Umriss überlappt.
- **Eine Kamera für alles:** Koordinaten der Striche sind Tafel-Einheiten, die Ansicht (Verschieben, Zoom 20–500 %) ist getrennt. Damit sind Seiten- und Whiteboardmodus später dieselben Daten.
- **Rückgängig über Befehle** (hinzufügen/entfernen mit Stelle), nicht über Kopien des ganzen Bildes; der Verlauf wird nicht gespeichert.
- **Speicher:** IndexedDB `lehrraum` (`tafeln`, `einstellungen`), Speichern 0,7 s nach der letzten Änderung und beim Wegschalten. `localStorage` wäre für Tafelbilder zu klein.
- **Noch keine Anmeldung und kein Supabase:** Die Tafel braucht beides nicht; es kommt mit dem ersten Baustein, der Serverdaten liest (Quiz starten, Phase 5a).
