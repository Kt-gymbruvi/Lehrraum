# SPEC – Schülerseiten: Mitmachen per QR-Code (Entwurf)

Stand: 20.11.2026 · Entwurf, Entscheidungen der Lehrkraft eingetragen · Etappe 1 gebaut (`src/kern/sitzung.ts`, `src/test/sitzung.test.ts`), nicht veröffentlicht

## Wunsch der Lehrkraft (20.11.2026)
- In der Tafel einer Klasse (z. B. 10G1) einen **QR-Code zeigen**, der die Klasse **für einen festgelegten Zeitraum** freigibt.
- Die Schüler haben iPads. Sie scannen den Code und **wählen ihren Namen aus der Klassenliste** (sie kennen sich ja). Danach hat jeder Schüler **eine eigene Seite**, auf der er schreibt und zeichnet. Die Seite ist unter seinem Namen abgelegt.
- Die Lehrkraft sieht **alle Seiten frei** (nach Schüler wählbar), auch schon während der Phase.
- Danach wählt sie aus, **was behalten wird**; das wird auf die **Klassentafel kopiert**. Alles Übrige wird **automatisch gelöscht**.

## Grundsätze
1. **Keine Klarnamen und keine Schülerarbeiten im Klartext auf dem Server.** Namensliste und Seiten werden auf dem Gerät mit einem **Sitzungsschlüssel** verschlüsselt. Der Schlüssel steckt im QR-Code hinter dem `#` der Adresse; dieser Teil wird vom Browser nie an einen Server geschickt.
2. **Die Schüler brauchen kein Konto.** Zugang = QR-Code (Sitzungscode + Schlüssel) und gewählter Name. Zeitlich begrenzt, danach nimmt der Server nichts mehr an.
3. **Die Namensliste kommt vom Gerät der Lehrkraft** (aus dem entschlüsselten Klassen-Tresor), wird für die Sitzung neu mit dem Sitzungsschlüssel verschlüsselt und nur dafür abgelegt. Das Notenbuch-Passwort verlässt das Gerät der Lehrkraft nie; Noten sind nie beteiligt.
4. **Löschung ist Standard**, Behalten die Ausnahme (siehe „Ablauf und Löschen“).
5. Die Schüler-Seite ist **nicht** die Lehrkraft-App: eigener, schlanker Einstieg (`#/mitmachen/<code>`), keine Tafelwerkzeuge der Lehrkraft, keine Klassen, keine anderen Tafeln.

## Ablauf
1. **Lehrkraft:** In der Tafel einer Klasse „Mitmachen freigeben“ → Dauer wählen (z. B. 10 / 20 / 45 Minuten) und Startvorlage (leere Seite oder aktuelle Tafelseite als Aufgabenblatt, Muster wie bei der Klasse). Es entsteht ein Fenster mit QR-Code, Restzeit und Zahl der angemeldeten Schüler.
2. **Schüler:** scannt, sieht die Namensliste der Klasse, tippt seinen Namen. Ein gewählter Name ist **belegt** (zweites Gerät fragt nach); die Lehrkraft kann einen Namen freigeben, wenn ein Gerät wechselt.
3. **Schreiben:** Zeichenfläche mit Stift, Radierer, Farben, Text, Formen, Rückgängig; die Seite wird laufend verschlüsselt gespeichert (kleine Pakete, ca. alle paar Sekunden), auch bei kurzem Netzverlust zwischengespeichert.
4. **Ende:** Läuft die Zeit ab, wird die Seite gesperrt („Zeit ist um“); die Lehrkraft kann vorher verlängern oder vorzeitig beenden.
5. **Lehrkraft prüft:** Übersicht aller Schüler (Kachelraster, nach Namen), Einzelansicht beliebig wählbar, schon während der Phase.
6. **Übernehmen:** Einzelne Seiten markieren → „Auf Klassentafel kopieren“ (als neue Seiten der Klassentafel, Titel „Name, Datum“, über `befehle.ts` rücknehmbar). Alles andere wird gelöscht.

## Ablauf und Löschen (Vorschlag, bitte bestätigen)
- Nach Ablauf der Zeit bleiben die Seiten **bis zu 48 Stunden** zum Durchsehen auf dem Server (nur verschlüsselt), länger nie.
- „Fertig / Verwerfen“ löscht sofort alles. Beim Übernehmen wird nur das Markierte kopiert, der Rest gelöscht.
- Löschung serverseitig per geplanter Funktion (nicht nur bei Öffnen der App), damit auch bei vergessener Sitzung nichts liegen bleibt.

## Datenmodell (Server, eine Migration in `../Quizzo/supabase/migrations/`)
| Tabelle | Inhalt |
|---|---|
| `lr_sitzungen` | Code (zufällig, lang), Besitzer, Beginn, Ende, Löschzeit, verschlüsselte Namensliste |
| `lr_abgaben` | Sitzung, Platzkennung (pseudonym, nicht der Name), belegt, verschlüsselte Seite (`iv`, `daten`), Stand |

- RLS: Lehrkraft liest und löscht nur eigene Sitzungen. Anonyme Schüler dürfen **nur über gesicherte Funktionen** (`lr_mitmachen_*`): Sitzung per Code lesen, Platz belegen, **nur die eigene Abgabe** schreiben (Platz-Geheimnis, beim Belegen vergeben), und nur bis zum Ende. Keine Tabellen-Direktzugriffe für Anonyme.
- Der Servername sieht nur Platzkennungen, nie Namen oder Zeichnungen.
- Bilder: zunächst **keine Bilder/Fotos** der Schüler (nur Strich, Text, Formen); sonst Speicherbereich und Größenbegrenzung nötig.

## Entschieden (20.11.2026, Lehrkraft)
1. **Aufbewahrung:** 48 Stunden nach Ablauf, dann löscht der Server automatisch.
2. **Sichtbarkeit:** Schüler sehen nur die eigene Seite, nur die Lehrkraft sieht alle.
3. **Live-Ansicht:** Die Übersicht der Lehrkraft ruft alle paar Sekunden ab (kein echtes Streaming).
4. **Aufgabenblatt:** Je Freigabe wählbar: leere Seite oder aktuelle Tafelseite als nicht veränderbarer Hintergrund.

## Offene Entscheidungen
5. **Datenschutz:** Schülerarbeiten (auch verschlüsselt) auf dem Server und Namen im QR-Code-Fluss mit Schulleitung/Datenschutzbeauftragten klären, bevor es im Unterricht läuft.
6. Missbrauch: Wer den QR-Code fotografiert, kommt hinein. Gegenmaßnahmen: kurze Dauer, belegte Namen, Lehrkraft kann Plätze sperren, Code nur auf dem Beamer.

## Etappen (1 und 2 gebaut, Migration 017 noch nicht auf dem Server ausgeführt)
1. Kern: Sitzung, Schlüssel, Verschlüsselung von Seite und Namensliste (`src/kern/`, Tests ohne Browser).
2. Server: Migration, Funktionen, RLS, Löschfunktion; `server.ts` erweitern.
3. Schülerseite: Einstieg, Namenswahl, Zeichenfläche (abgespeckt), Autospeichern.
4. Lehrkraft: Freigabefenster mit QR-Code und Zeit, Übersicht, Übernehmen, Aufräumen.
5. Prüfung am echten iPad mit Stift und mehreren Geräten gleichzeitig.
