# SPEC – PDF als Bild, ein Passwort für alles, Tafeln auf allen Geräten, Tabelle

Stand: 14.11.2026 · **freigegeben** (Etappen A und D veröffentlicht)

## Wunsch der Lehrkraft (14.11.2026)
- Eingefügte **PDFs verhalten sich wie Bilder**: drehen, verschieben, verändern, entfernen.
- **Tafeln mit Bildern und PDFs** werden gespeichert und zwischen den Geräten abgeglichen. Bei Änderungen auf zwei Geräten **gilt der neuere Stand**, kein Zusammenführen.
- **Angemeldet = alles synchronisiert**: Klassen, Tafeln, und das **Notenbuch ist zugänglich**. **Einmal das Passwort eingeben** reicht.
- **Tabelle** in der Tafel.

Entscheidungen der Lehrkraft (14.11.2026):
- PDF: **je PDF-Seite ein Bild auf einer eigenen Tafelseite**.
- Passwort: **gilt bis zum Abmelden**. Die Zeitsperre im Notenbuch entfällt. (Hinweis an die Lehrkraft: Wer das entsperrte Gerät benutzt, sieht die Noten – auf geteilten Schulgeräten nach dem Unterricht abmelden.)
- Tabelle: **Zeilen/Spalten ändern, Text in Zellen, Kopfzeile hervorheben, Spaltenbreite ziehen**.

## Etappe A – PDF als Bild (und Handballen-Schutz veröffentlichen)
- „PDF öffnen“ legt je PDF-Seite eine neue Tafelseite an; darauf liegt die PDF-Seite als **Bild-Element**, das das Blatt ausfüllt (im unendlichen Format: in Originalgröße in der Mitte).
- Das Bild verhält sich wie jedes Bild: auswählen, verschieben, Größe ändern, drehen (frei und in 90°-Schritten), löschen, rückgängig. Man kann darauf schreiben.
- **Bestehende PDF-Seiten** (PDF als fester Hintergrund) werden beim Öffnen der Tafel einmalig in ein Bild umgewandelt – sie sehen danach gleich aus. Datenmodell **Version 6** (Hintergrund kennt kein `pdf` mehr; eigenes Bild als Hintergrund bleibt möglich).
- Knöpfe „PDF-Seite drehen“, „Alle PDF-Seiten löschen“ in der Seitenleiste entfallen (das geht jetzt am Bild bzw. über die Seitenübersicht).
- PDF speichern/teilen bleibt wie bisher.
- Dazu wird der fertige, noch nicht veröffentlichte **Handballen-Schutz** mit veröffentlicht.

## Etappe B – Ein Passwort, ein Schlüsselbund auf dem Gerät
- Notenbuch, Tafel und Startseite liegen unter derselben Adresse und können daher einen gemeinsamen Speicher auf dem Gerät nutzen: **Schlüsselbund** (IndexedDB `lehrraum-schluessel`) mit den nicht exportierbaren Schlüsseln für Notenbuch, Namensliste, Klassen und Tafeln. Das Passwort selbst wird nie gespeichert.
- Das **Notenbuch-Passwort wird einmal je Gerät** abgefragt – wo es zuerst gebraucht wird: auf der Startseite direkt nach der Anmeldung, in der Tafel oder im Notenbuch. Danach öffnen sich alle ohne Rückfrage.
- **Notenbuch:** öffnet ohne Sperrbildschirm, wenn der Schlüssel da ist. Die Zeitsperre entfällt; „Jetzt sperren“ heißt künftig „Auf diesem Gerät sperren“ und löscht den Schlüsselbund (danach wieder Passwort).
- **Abmelden** (Startseite, Tafel, Quizzo, Klassenfunk, Notenbuch) löscht den Schlüsselbund auf diesem Gerät. Wer abgemeldet ist, hat keinen Zugriff aufs Notenbuch über den Server; die verschlüsselte Kopie auf dem Gerät bleibt (wie bisher).
- **Passwort im Notenbuch geändert:** Die anderen Geräte merken es beim nächsten Abgleich und fragen einmal neu.
- Ohne Notenbuch (noch nie angelegt): Die Tafel legt das Passwort fest; das Notenbuch übernimmt es beim ersten Anlegen.
- **Umsetzung (gebaut 14.11.2026):** IndexedDB `lehrraum-schluessel`, Version 1, Lager `bund`, Eintrag `bund` = `{ version: 1, basis: CryptoKey, am: ISO-Zeit }`. `basis` = `importKey('raw', Passwort, 'PBKDF2', false, ['deriveKey'])`; Schlüssel je Tresor = PBKDF2-SHA-256, 250 000 Runden, mit dessen Salz → AES-256-GCM (wie bisher). Angelegt nur mit Anmeldung; gelöscht, wenn `sb-ifdqfndsvgiyvxvxtoga-auth-token` im `localStorage` fehlt, bei „Auf diesem Gerät sperren“ und wenn die Namensliste nicht mehr passt.

## Etappe C – Tafeln auf allen Geräten
- **Jede Tafel** (Klassentafeln und die freie Tafel) wird nach dem Speichern verschlüsselt hochgeladen und auf den anderen Geräten beim Öffnen, beim Zurückkehren zur Seite und alle 30 Sekunden (wenn gerade nicht geschrieben wird) geholt.
- **Neuerer Stand gilt:** Wurde dieselbe Tafel auf zwei Geräten geändert, gewinnt die zuletzt gespeicherte; das andere Gerät lädt sie mit dem Hinweis „Auf einem anderen Gerät geändert – neuer Stand geladen“. Kein Zusammenführen.
- Die Tafel einer Klasse ist auf allen Geräten **dieselbe** (bisher hatte jedes Gerät eine eigene). Gibt es auf mehreren Geräten schon eine eigene Tafel derselben Klasse, gilt die zuletzt geänderte; die anderen bleiben als „Ältere Tafel von 7b (Gerät …)“ in der Seitenübersicht bzw. als Kopie erhalten – nichts geht verloren.
- **Bilder und PDF-Seiten** werden einzeln verschlüsselt in einen eigenen, privaten Speicherbereich hochgeladen (Supabase Storage, Frankfurt), nur einmal je Datei, und auf anderen Geräten geladen, sobald die Tafel sie braucht. Nicht mehr gebrauchte Dateien werden gelegentlich auch auf dem Server gelöscht.
- Verschlüsselt mit einem zufälligen Tafel-Schlüssel, der im (passwortgeschützten) Klassen-Tresor liegt: Eine Passwortänderung muss so nicht alle Tafeln neu verschlüsseln.
- Neu auf dem Server (Migration `012` im Quizzo-Repo, von der Lehrkraft im SQL Editor auszuführen): Tabelle `lr_tafeln` (je Tafel eine Zeile, nur verschlüsselt, nur eigene Zeilen) und privater Speicherbereich `lr-dateien` (nur eigener Ordner).
- Anzeige in der Kopfzeile: „Gespeichert · auf allen Geräten“ bzw. „Nur auf diesem Gerät“ / „Wird hochgeladen …“.
- **Grenzen:** Der Speicher des kostenlosen Supabase-Tarifs ist begrenzt (1 GB für Dateien). Große PDFs (viele Seiten) belegen viel davon; die Tafel zeigt den belegten Platz unter „Meine Klassen“ an.
- Offline: Schreiben geht immer; hochgeladen wird, sobald wieder Verbindung besteht.
- **Umsetzung (veröffentlicht 14.11.2026):** siehe `docs/PROJECT-STATUS.md` und `docs/DECISIONS.md` (Etappe C). Abweichung: Abgeglichen wird nur der Inhalt (Titel, Format, Seiten); Ansicht, gezeigte Seite und Fenster bleiben je Gerät.

## Etappe D – Tabelle
- Werkzeug **„Tabelle“** in der linken Leiste: Antippen auf der Tafel öffnet die Wahl von Zeilen und Spalten (Vorgabe 3 × 3, bis 20 × 10), dann liegt die Tabelle dort.
- **Text in Zellen:** Zelle doppelt antippen (bzw. mit dem Text-Werkzeug antippen) → tippen; Tab/Enter springt zur nächsten Zelle. Mit dem Stift kann man zusätzlich frei darüber schreiben.
- **Kopfzeile hervorheben** (an/aus): erste Zeile fett und farbig hinterlegt.
- **Zeilen und Spalten** hinzufügen/entfernen über die Auswahlleiste der Tabelle (an der gewählten Zelle bzw. am Ende).
- **Spaltenbreite ziehen:** Ist die Tabelle ausgewählt, lassen sich die Trennlinien zwischen Spalten ziehen. Zeilenhöhe passt sich dem Text an.
- Als Ganzes verschieben, vergrößern, drehen, kopieren, löschen wie andere Elemente; alles rückgängig machbar; im PDF-Export und in der Seitenübersicht sichtbar.
- Neue Element-Art `tabelle` (Datenmodell Version 7 bzw. zusammen mit Etappe A Version 6).

## Reihenfolge
A → D → B → C. A und D sind unabhängig und schnell nutzbar; C braucht B. Jede Etappe einzeln testen und erst nach Zustimmung veröffentlichen.

## Nicht in diesem Umfang
- Gleichzeitiges Arbeiten an derselben Tafel auf zwei Geräten in Echtzeit (z. B. iPad und Board live).
- Zusammenführen von Änderungen.
- Teilen von Tafeln mit anderen Lehrkräften.
