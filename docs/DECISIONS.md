# Entscheidungen – Lehrraum

Neue Entscheidungen oben anfügen: Datum, Entscheidung, Grund, verworfene Alternativen.
Grundsatzentscheidungen zur Plattform stehen in `../Kt-gymbruvi.github.io/docs/DECISIONS.md` (11.11.2026).

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
