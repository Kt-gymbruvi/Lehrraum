# Spezifikation – Seitenformat, Hintergründe, Seitenübersicht

Stand: 14.11.2026 · **Von der Lehrkraft freigegeben am 14.11.2026** (offene Fragen in Abschnitt 7: es gelten meine Vorschläge). Umgesetzt wird in den Etappen aus Abschnitt 5; veröffentlicht wird jede Etappe erst nach Zustimmung.
Grundlage: Wunsch der Lehrkraft vom 14.11.2026 („nur das Sichtbare beschreiben, dann die nächste Seite – wie GoodNotes“, „Hintergründe wählbar wie bei Classroom Screen“), meine Vorschläge dazu und ihre Antworten am selben Tag.

Zeichen in diesem Dokument: **[Entschieden]** = Antwort der Lehrkraft. **[Vorschlag]** = von mir ergänzt, weil die Antwort es offen ließ; mit der Freigabe angenommen. Offene Fragen stehen in Abschnitt 7.

## 1. Ziel und Rahmen

Eine Tafel soll sich wahlweise wie ein **Heft mit festen Seiten** verhalten: Man beschreibt, was man sieht, und blättert dann weiter. Jede Seite kann ein **Muster** (liniert, kariert …) oder ein **eigenes Bild** als Hintergrund haben.

Unverändert gelten die Projektregeln: Die Zeichenfläche bleibt **weiß** **[Entschieden]** – es gibt keine farbigen Hintergründe. Beide Leisten bleiben sichtbar, Bedienelemente mindestens 56 px, jede Änderung am Tafelinhalt lässt sich zurücknehmen, Bilder bleiben auf dem Gerät.

Nicht Teil dieser Spezifikation **[Entschieden]**: Sportfelder als Hintergrund, Taktiktafel mit Spielerplättchen, Abdecken/Aufdecken.

## 2. Ausgangslage

| Bereich | Heute |
|---|---|
| Fläche | Jede Seite ist unendlich groß; man verschiebt und zoomt frei. |
| Hintergrund | Nur PDF-Seiten (aus einem PDF-Import): liegen bei (0, 0), lassen sich drehen und entfernen. |
| Blättern | Pfeile „Vorige/Nächste Seite“ und „+“ in der Seitenleiste. |
| Export | Eine PDF-Seite ist so groß wie der PDF-Hintergrund, sonst mindestens A4 quer plus alles Beschriebene. |
| Klassen | Jede Klasse hat ihre eigene Tafel; sonst keine Voreinstellungen. |

## 3. Anforderungen und Abnahmekriterien

### F – Seitenformat

**F1 Format der Tafel.** Jede Tafel hat ein Format: **16:9 (Bildschirm)**, **A4 hoch**, **A4 quer** oder **Unendlich**. **[Entschieden: 16:9 als Standard]**
- Neue Tafeln (frei und je Klasse) beginnen mit 16:9 – außer die Klasse hat eine eigene Vorlage (V1).
- Bestehende Tafeln werden zu „Unendlich“ und sehen genau aus wie vorher. **[Vorschlag]**
- Das Format lässt sich mit dem Knopf „Format“ in der Kopfzeile ändern und jederzeit zurückstellen; dabei geht nichts verloren. **[Vorschlag; umgesetzt ohne Eintrag im Verlauf – der Verlauf gehört je zu einer Seite, das Format zur ganzen Tafel. „Inhalt einpassen“ ist dagegen je Seite ein Schritt im Verlauf.]**
- Wird eine beschriebene Tafel auf ein festes Format umgestellt und liegt Inhalt außerhalb des Blatts, erscheint ein Hinweis („3 Seiten haben Inhalt außerhalb des Blatts“) mit dem Knopf **„Inhalt einpassen“**, der diesen Inhalt je Seite verkleinert und aufs Blatt setzt. Ohne Einpassen bleibt der Inhalt gespeichert, ist aber erst nach dem Zurückstellen wieder zu sehen. **[Vorschlag – siehe Frage 1]**

**F2 Blatt mit fester Größe.** In einem festen Format ist jede Seite ein Blatt: 16:9 = 1600 × 900 Tafel-Einheiten, A4 hoch = 794 × 1123, A4 quer = 1123 × 794. **[Vorschlag]**
- Beim Öffnen und beim Blättern wird das Blatt so eingepasst, dass es ganz sichtbar ist und den Platz zwischen den Leisten füllt.
- Hineinzoomen bleibt möglich; weiter heraus als „ganzes Blatt“ geht es nicht. Beim Verschieben bleibt das Blatt immer zum Teil im Bild.
- Ein Knopf **„Einpassen“** (Kopfzeile, bei der Zoom-Kapsel) zeigt wieder das ganze Blatt.
- Um das Blatt liegt die ruhige Fläche der Umgebung, wie heute um die Zeichenfläche.
- Außerhalb des Blatts beginnt kein Strich. Ein Strich, der über den Rand hinausläuft, wird am Rand abgeschnitten angezeigt und exportiert; ebenso Elemente, die man über den Rand schiebt. **[Vorschlag]**
- PDF-Seiten behalten ihre eigene Größe, auch in einer Tafel mit festem Format; eingepasst wird dann die PDF-Seite.

**F3 Blättern.** In einem festen Format blättert man mit den Pfeilen der Seitenleiste und mit den Tasten Bild auf / Bild ab. **[Vorschlag]**
- Auf der letzten Seite wird aus „Nächste Seite“ der Knopf **„+ Neue Seite“**.
- Eine neue Seite übernimmt das Muster der Seite, von der aus sie angelegt wird (nicht deren Bild- oder PDF-Hintergrund).
- Der Wechsel geschieht ohne spürbare Wartezeit, auch mit 50 Seiten.

**F4 Export.** In einem festen Format wird jede Seite beim PDF-Export genau so groß wie das Blatt (16:9, A4 hoch, A4 quer). Bei „Unendlich“ bleibt es wie heute.

### M – Muster als Hintergrund

**M1 Auswahl.** In der rechten Leiste gibt es den Knopf **„Hintergrund“**. Er öffnet ein Feld mit Vorschaubildern in Gruppen: **[Vorschlag zur Liste – siehe Frage 2]**

| Gruppe | Muster |
|---|---|
| Allgemein | Leer · Liniert · Liniert mit Rand · Kariert klein · Kariert groß · Punkteraster · Schreiblineatur (Ober-, Mittel-, Unterlänge) |
| Mathematik und Naturwissenschaften | Millimeterpapier · Koordinatensystem (1. Quadrant) · Koordinatensystem (vier Quadranten) · Isometrisches Raster |
| Sprachen, Musik, Ordnen | Notenlinien · Cornell-Notizen · Zwei Spalten · Drei Spalten · Wochenplan (Mo–Fr) |

- Muster werden gezeichnet, nicht als Bild hinterlegt: Sie bleiben bei jedem Zoom scharf, brauchen keinen Speicher, und Radierer und Auswahl erfassen sie nie.
- Linienmuster (Liniert, Kariert, Punkte, Millimeter, Isometrisch, Notenlinien, Lineatur) laufen bei „Unendlich“ endlos weiter; Seitenmuster (Cornell, Spalten, Wochenplan) und die Koordinatensysteme gibt es nur in festen Formaten, weil sie sich am Blatt ausrichten.
- Die Lineatur ist in 16:9 so groß gewählt, dass man am SMART Board bequem darauf schreibt.

**M2 Abstand und Farbe.** Bei Linienmustern lässt sich der **Abstand** (eng, mittel, weit) und die **Linienfarbe** (hellgrau oder hellblau) wählen. Der Rand bei „Liniert mit Rand“ ist zartrot. Die Linien sind so hell, dass Schrift in jeder Stiftfarbe deutlich darüber steht. **[Vorschlag]**

**M3 Nur diese Seite oder alle Seiten.** Im Feld wählt man, ob das Muster für **diese Seite** oder für **alle Seiten** gilt. **[Entschieden]**
- „Alle Seiten“ lässt Seiten mit PDF- oder Bild-Hintergrund unverändert. **[Vorschlag]**
- Jeder Wechsel ist genau ein Schritt im Verlauf, auch „alle Seiten“.

### B – Eigenes Bild als Hintergrund

**B1 Bild wählen.** Im Feld „Hintergrund“ gibt es **„Eigenes Bild …“**: Man wählt ein Bild (PNG, JPEG, WebP, SVG – SVG wird wie heute zu einem Pixelbild). **[Entschieden]**
- In einem festen Format wird das Bild ganz ins Blatt eingepasst und mittig gesetzt; bei „Unendlich“ liegt es bei (0, 0) in seiner Größe, höchstens so groß wie eine PDF-Seite. **[Vorschlag]**
- Das Bild liegt fest: nicht auswählbar, nicht radierbar – wie heute eine PDF-Seite. Entfernen geht wie bei PDF-Seiten über „Hintergrund entfernen“.
- Auch „nur diese Seite“ oder „alle Seiten“ wählbar; das Bild wird dabei nur einmal gespeichert.

**B2 Bild der Tafel zum Hintergrund machen.** Ist genau ein Bild ausgewählt, bietet die Auswahlleiste **„Als Hintergrund“** an: Das Bild wird zum festen Hintergrund dieser Seite. **[Vorschlag]**

### V – Vorlage je Klasse

**V1 Vorlage merken.** Jede Klasse kann sich **Format und Muster** merken („Sport 9a: 16:9, leer“, „Mathe 7b: A4 hoch, kariert klein“). **[Entschieden]**
- Einstellen lässt sich das auf der Karte der Klasse unter „Meine Klassen“ und im Feld „Hintergrund“ mit **„Für 7b merken“**, wenn die Tafel zu einer Klasse gehört. **[Vorschlag]**
- Die Vorlage gilt, wenn die Tafel der Klasse zum ersten Mal angelegt wird, und für jede neue Seite, die man mit „+“ anlegt. Bestehende Seiten ändert sie nicht. **[Vorschlag]**
- Eigene Bilder gehören nicht zur Vorlage (sie liegen in der Tafel, nicht bei der Klasse). **[Vorschlag]**

### Ü – Seitenübersicht

**Ü1 Übersicht.** Ein Knopf in der Seitenleiste öffnet eine Übersicht aller Seiten als Vorschaubilder im Raster. **[Entschieden]**
- Antippen öffnet die Seite; die aktuelle Seite ist hervorgehoben.
- Ziehen eines Vorschaubilds sortiert die Seite um (ein Schritt im Verlauf). Mit Maus, Finger und Stift.
- Am Vorschaubild gibt es „Duplizieren“ und „Löschen“ (mit Rückfrage wie heute).
- Die Vorschaubilder entstehen auf dem Gerät aus dem Tafelinhalt und werden nicht gespeichert; auch mit 50 Seiten öffnet die Übersicht ohne spürbare Wartezeit. **[Vorschlag]**
- Mit Escape oder „Fertig“ zurück zur Tafel.

### E – Export ohne Muster

**E1** Beim Export gibt es die Wahl **„mit Hintergrundmuster“** (Standard) oder **„nur Geschriebenes“**. Eigene Bilder und PDF-Seiten werden immer mit exportiert. **[Lehrkraft: „wie du willst“ – aufgenommen, weil es wenig Aufwand ist]**

## 4. Datenmodell

**Tafel Version 5** **[Vorschlag]**:
- Tafelbild bekommt `format: 'unendlich' | '16:9' | 'a4-hoch' | 'a4-quer'`.
- Seite bekommt `muster?: { art, abstand?, farbe? }`. Der vorhandene `hintergrund` (Datei, Größe, Drehung, PDF-Kennung) bleibt und trägt künftig auch eigene Bilder (ohne PDF-Kennung).
- `pruefeTafel` wandelt Version 1–4 um: `format: 'unendlich'`, kein Muster – an bestehenden Tafeln ändert sich nichts.

**Klasse Version 2** **[Vorschlag]**: optional `vorlage: { format, muster }`; Version 1 wird ohne Vorlage übernommen. Die Startseite liest das Lager `klassen` direkt (`../Kt-gymbruvi.github.io/gemeinsam/klassen.js`) – dort ist vor dem Veröffentlichen zu prüfen, dass sie Klassen der Version 2 weiter anzeigt; nötigenfalls wird sie in einer eigenen Etappe angepasst.

Logik (Muster als Linien berechnen, Blatt einpassen, Zoom begrenzen, Inhalt einpassen, Vorlagen) liegt in `src/kern/` und wird dort ohne Browser getestet.

## 5. Etappen

1. **Seitenformat und Blättern** – F1–F4, Datenmodell Version 5 (nur `format`).
2. **Muster** – M1–M3, Knopf und Feld „Hintergrund“, E1.
3. **Eigenes Bild und Vorlage je Klasse** – B1, B2, V1, Klasse Version 2.
4. **Seitenübersicht** – Ü1.

Nach jeder Etappe: Tests, Build, Prüfung im Browser hell und dunkel und bei 1024 × 700; Zeichnen und Stift am Gerät prüft die Lehrkraft.

## 6. Was am Gerät zu prüfen bleibt

- Ist 16:9 am SMART Board und am iPad die richtige Blattgröße (Schriftgröße, Strichstärke im Verhältnis)?
- Sind die Musterlinien am Beamer zu sehen, ohne zu stören?
- Bleibt das Schreiben auf einer Seite mit Muster so flüssig wie ohne (Messung mit `#/pruefen`)?

## 7. Offene Fragen an die Lehrkraft

1. **Format nachträglich ändern:** Reicht der Hinweis mit „Inhalt einpassen“ (F1), oder soll das Format einer beschriebenen Tafel gar nicht mehr umstellbar sein?
2. **Musterliste:** Fehlt etwas Wichtiges für deine Fächer, oder ist etwas überflüssig?
3. **Blattgröße 16:9:** In Ordnung, dass das Blatt immer ganz auf den Bildschirm passt und man zum Schreiben kleiner Details hineinzoomt?
