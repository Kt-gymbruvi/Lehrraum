# SPEC – Schülernamen in der Tafel, Klassen auf allen Geräten, Notenbuch auf der Plattform

Stand: 14.11.2026 · **freigegeben am 14.11.2026** · Etappen 1 und 2 veröffentlicht (`../Notenbuch`) · Etappe 3 gebaut (Lehrraum), noch nicht veröffentlicht

Umsetzung abweichend von der Tabelle unten: **eine** Tabelle `lr_tresore` mit Spalte `art` (`notenbuch`, `namen`,
`klassen`) statt drei Tabellen. Gleiche Regeln, eine Speicherfunktion `lr_tresor_speichern` (Migration `../Quizzo/supabase/migrations/011_tresore.sql`).

## Wunsch der Lehrkraft (14.11.2026)
- In der Tafel: **Zufallsschüler** und **Zufallsgruppen** mit den Namen der Klasse. Von der Tafel aus **keine Noten** o. Ä. – nur Namen.
- **Synchronisation auf allen Geräten:** Eine angelegte Klasse ist auf jedem Gerät da.
- **Verzahnung mit dem Notenbuch:** Jede Klasse im Notenbuch ist automatisch auch eine Tafel-Klasse.
- Entscheidungen: **Das Notenbuch zieht auf die Plattform um** (weg vom Claude-Artefakt). Für die Namen gilt **dasselbe Passwort wie im Notenbuch**.

## Warum der Umzug nötig ist
Das Notenbuch läuft bisher als Claude-Artefakt. Seine Daten liegen verschlüsselt im Artefakt-Speicher des Claude-Kontos (AES-256-GCM, Schlüssel aus dem Passwort mit PBKDF2 und 250 000 Runden). Die Tafel läuft unter `kt-gymbruvi.github.io`. Die beiden Seiten können nicht gegenseitig auf ihre Speicher zugreifen, ein Artefakt kann außerdem keine Daten an Supabase schicken. Automatisch geht es deshalb nur, wenn beide Anwendungen auf derselben Plattform liegen und denselben Server nutzen.

## Grundsätze
1. **Schülernamen und Noten nie im Klartext auf dem Server.** Verschlüsselt wird auf dem Gerät. Auf Supabase (Frankfurt) liegen nur verschlüsselte Daten, die ohne das Passwort niemand lesen kann, auch die Lehrkraft-Anmeldung und der Betreiber von Supabase nicht.
2. **Die Tafel sieht nie Noten.** Das Notenbuch legt zusätzlich eine eigene, verschlüsselte **Namensliste** ab: Klassen und Namen, sonst nichts. Lehrraum liest nur diese Liste und nie den Notenbuch-Tresor.
3. **Ein Passwort.** Notenbuch-Tresor und Namensliste haben je eigenes Salz und damit eigene Schlüssel, beide kommen aus demselben Passwort. Eingegeben wird es einmal je Gerät. Gespeichert wird danach nur ein **nicht auslesbarer Schlüssel** (WebCrypto, `extractable: false`) in IndexedDB, nie das Passwort selbst.
4. **Die Anmeldung bleibt das gemeinsame Lehrkraft-Konto** (wie Quizzo, Klassenfunk, Tafel). Sie entscheidet, wessen Daten geladen werden; lesen kann sie nur das Passwort.
5. Passwort vergessen heißt: Die Daten auf dem Server sind nicht mehr lesbar. Auf den Geräten bleiben sie, und ein Backup bleibt möglich.

## Datenmodell auf dem Server (Supabase, eine Migration)
| Tabelle | Inhalt | Schreibt | Liest |
|---|---|---|---|
| `nb_tresor` | Notenbuch komplett, verschlüsselt (`rev`, `salt`, `iv`, `daten`, `geaendert_am`) | Notenbuch | Notenbuch |
| `lr_namen` | Namensliste aus dem Notenbuch, verschlüsselt (`rev`, `salt`, `iv`, `daten`) | Notenbuch | Lehrraum |
| `lr_klassen` | Klassen, die in Lehrraum selbst angelegt wurden, mit Namen und Vorlage, verschlüsselt | Lehrraum | Lehrraum |

Jede Tabelle hat genau eine Zeile je Lehrkraft (`lehrkraft = auth.uid()`). RLS: lesen und schreiben nur die eigene Zeile, kein öffentlicher Zugriff. Gleichzeitiges Speichern wird über `rev` erkannt (wie bisher im Notenbuch: Rückfrage, welche Version bleibt, und die andere wird als Sicherung abgelegt).

**Inhalt der Namensliste (entschlüsselt):** je Klasse Notenbuch-Kennung, Name (z. B. „7b“), Fach, Stufe (Sek I/II), Schuljahr, archiviert; je Schüler Kennung, Vorname, Nachname. **Nicht enthalten:** Noten, Fehlzeiten, Notizen, Nachteilsausgleich, Geburtsjahr, Geschlecht, Sitzplan.

## Etappen

### Etappe 1 – Notenbuch zieht um (neues Repo `Notenbuch`, https://kt-gymbruvi.github.io/Notenbuch/)
- Quelltext des Artefakts übernehmen. Es bleibt reines HTML/JS ohne Build, wie die Startseite.
- Schrift (Atkinson Hyperlegible) liegt dann im Repo, nichts wird von fremden Servern geladen.
- Der Abgleich über `window.claude` wird durch Supabase (`nb_tresor`) ersetzt. Verschlüsselung, Sperrbildschirm, automatische Sicherungen und Konfliktabfrage bleiben, wie sie sind.
- Angemeldet wird mit dem gemeinsamen Lehrkraft-Konto. Ist man schon in Quizzo, der Tafel oder auf der Startseite angemeldet, gilt das auch hier.
- **Übernahme der vorhandenen Daten:** im alten Artefakt „Backup speichern“, im neuen Notenbuch „Backup einspielen“. Das alte Artefakt bleibt unverändert stehen, bis Sie es nicht mehr brauchen.
- Rückweg „← Lehrraum“ zur Startseite, Eintrag „Notenbuch“ in der Seitenleiste (nur angemeldet), Impressum/Datenschutz ergänzen.
- Prüfen: alle Ansichten wie bisher, Handy und iPad, hell und dunkel, Sync zwischen zwei Geräten.

### Etappe 2 – Notenbuch legt die Namensliste ab
- Nach jedem Speichern im Notenbuch wird auch `lr_namen` aktualisiert, mit demselben Passwort und eigenem Salz.
- Im Notenbuch steht ein Hinweis, dass Klassen und Namen (ohne Noten) für die Tafel freigegeben sind.

### Etappe 3 – Lehrraum: Klassen mit Namen und Abgleich
- Klasse Version 3: `schueler` (Kennung, Vorname, Nachname) und `herkunft` (`lehrraum` oder `notenbuch` mit Notenbuch-Kennung). Version 2 wird ohne Namen übernommen.
- **Notenbuch-Klassen erscheinen automatisch** und sind gekennzeichnet. Namen, Bezeichnung und Archivieren werden im Notenbuch geändert und nicht in Lehrraum. Tafel und Vorlage bleiben Sache von Lehrraum. Wird eine Klasse im Notenbuch gelöscht, wird sie in Lehrraum archiviert und nicht gelöscht, damit die Tafel erhalten bleibt.
- **Eigene Lehrraum-Klassen** (z. B. AGs ohne Notenbuch) bekommen eine Namensliste (einfügen aus einer Liste, einzeln ergänzen) und werden über `lr_klassen` synchronisiert.
- Beim ersten Mal fragt Lehrraum einmal je Gerät nach dem Notenbuch-Passwort. Anzeige: „Klassen synchronisiert“ bzw. „nur auf diesem Gerät“.
- Die Startseite (`gemeinsam/klassen.js`) liest weiter nur Bezeichnung und Fach. Prüfen, ob Version 3 dort ankommt.

### Etappe 4 – Tafel: Fenster „Zufall & Gruppen“
- Neues Fenster in der rechten Leiste, nur in einer Klassentafel mit Namen.
- **Zufallsschüler:** groß lesbar am Beamer, mit kurzer Auswahl-Animation (abschaltbar), „ohne Wiederholung“ bis alle dran waren.
- **Gruppen:** nach Anzahl der Gruppen oder nach Gruppengröße, neu mischen, groß anzeigen.
- **Heute nicht da:** Namen antippen und für diese Stunde ausnehmen. Das wird nirgends gespeichert und hat keine Verbindung zu den Fehlzeiten im Notenbuch.
- Angezeigt wird der Vorname, bei gleichen Vornamen mit Anfangsbuchstaben des Nachnamens.
- Das Fenster verändert die Tafel nicht. Auf Wunsch „Gruppen an die Tafel schreiben“ als Text-Element (rückgängig machbar).

## Nicht in diesem Umfang
- Noten, Fehlzeiten oder Notizen in der Tafel (ausdrücklich nicht gewünscht).
- Synchronisation der **Tafelbilder** selbst zwischen Geräten. Die Klasse und ihre Vorlage sind überall da, das Gezeichnete bleibt vorerst auf dem Gerät, auf dem es entstand. Das wäre eine eigene Etappe.
- Schülerzugänge irgendeiner Art.

## Offen / bitte bestätigen
- **Ort des Notenbuchs:** eigenes Repo `Notenbuch` (Empfehlung: eigene Regeln, eigener Stand, wie Quizzo und Klassenfunk) oder ein Ordner im Startseiten-Repo.
- **Datenschutz:** Für Noten und Schülernamen auf privaten Geräten und in einem eigenen Speicher braucht man in Niedersachsen in der Regel die Genehmigung der Schulleitung (das galt auch schon für das Notenbuch als Artefakt). Durch die Verschlüsselung auf dem Gerät und den Serverstandort Frankfurt wird es eher einfacher als bisher. Das sollten Sie trotzdem mit der Schulleitung bzw. dem Datenschutzbeauftragten klären, bevor echte Daten umziehen.
- Die Migration für die drei Tabellen liegt wie bisher im Quizzo-Repo (`supabase/migrations/011_…`) und muss in Supabase ausgeführt werden.
