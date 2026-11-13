# Entscheidungen – Lehrraum

Neue Entscheidungen oben anfügen: Datum, Entscheidung, Grund, verworfene Alternativen.
Grundsatzentscheidungen zur Plattform stehen in `../Kt-gymbruvi.github.io/docs/DECISIONS.md` (11.11.2026).

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
