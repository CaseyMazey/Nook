# Tools.md

Version: 1.0

---

# Zweck

Der Tools-Tab ist ein kleiner Werkzeugkasten: Helfer, die man kurz aufmacht, benutzt und wieder verlässt.

Jedes Werkzeug ist für sich allein verständlich und braucht keine Einrichtung.

---

# Designprinzip

- Jedes Werkzeug ist eine eigene Karte im Raster (`.tool-card`, breite Werkzeuge mit `.tool-card--wide`).
- Ein Werkzeug = eine Datei (`js/tools-<name>.js`), Styles gemeinsam in `css/tools.css`.
- Ruhig und sofort benutzbar: Sinnvolle Startwerte statt leerer Formulare, letzte Einstellungen werden gemerkt.
- Größere Eingaben (Notenmanager, Entscheidungshilfe) laufen in Modals über `wireModal()`, Löschen immer mit `hubConfirm()`.
- Escape schließt das oberste Tools-Fenster (`toolsHandleEscape` in tools.js).
- Werkzeug-Leiste oben (`TOOLS_LIST`, `toolsShowTool()` in tools.js), Optik wie die Sprungleiste der Einstellungen: „Alle“ zeigt das Raster, ein Werkzeug steht allein (Wahl gemerkt unter `toolsActiveTool`). Neue Werkzeuge bekommen einen Eintrag in `TOOLS_LIST`; Sprünge aus der Suche wählen ihr Werkzeug über `toolsShowTool()`.

---

# Werkzeuge

| Werkzeug | Datei | DB-Keys |
|---|---|---|
| Taschenrechner (Tastatur, Verlauf, Ausdruckszeile mit Klammern/^/√/log2/Hex) | `tools-calculator.js` | `toolsCalcHistory` |
| Focus Timer (Pomodoro, Ton/Benachrichtigung, Notiz, 7-Tage-Verlauf) | `tools-timer.js` | `toolsFocusTimer`, `toolsPomodoroLog`, `toolsPomodoroHistory` |
| Stoppuhr & Countdown | `tools-stopwatch.js` | `toolsStopwatch` |
| Converter (inkl. Fläche, Volumen, Geschwindigkeit) | `tools-converter.js` | `toolsConverterState` |
| Zahlensysteme (Binär/Oktal/Dezimal/Hex mit Rechenweg) | `tools-numbase.js` | `toolsNumbaseState` |
| Datumsrechner (Zeitraum, Arbeitstage, Datum ± Tage) | `tools-date.js` | `toolsDateState` |
| Datenübertragungsraten-Rechner (Lernmodus, Übungsmodus, Formelsammlung) | `tools-datarate.js` | `toolsDataRateState`, `toolsDataRatePractice` |
| Subnetz-Rechner (IPv4/IPv6, Lernmodus, Aufteilen) | `tools-subnet.js` | `toolsSubnetState` |
| Notenmanager (Ausbildungsjahre, Fächer, Leistungen, Zeugnisse, IHK-Punkte) | `tools-notenmanager.js` | `noten*` |
| Entscheidungshilfe (Blatt, Optionen-Matrix, Zufallsrad, Rückblick, Archiv) | `tools-decision.js` | `toolsDecisions` |
| Textwerkzeuge (Zähler, Zeichen-Limit, Umformungen) | `tools-text.js` | `toolsTextState` |

Leiste: `toolsActiveTool` (gewähltes Werkzeug), `toolsNavConfig` (Reihenfolge, ausgeblendete Werkzeuge).

Neuere Werkzeuge bringen ihre Karte selbst mit (`tools<Name>CardHtml()` in ihrer Datei, von `initTools` ins Raster gesetzt) — so bleibt tools.js schlank. Gemeinsame Helfer in tools.js: `toolsUnlockAudio()`/`toolsPlayChime()` (Ton), `toolsPrint(html)` (Drucken), `toolsShowTool(id)`. Lernmodus-Bausteine (`drSection`, `drResultSection` …) aus tools-datarate.js nutzen auch Subnetz und Zahlensysteme.

`tools.js` enthält das HTML-Grundgerüst (`initTools`) und die geteilte Dateneinheiten-Registry `DR_UNIT_FACTORS` (Converter + Datenrate). Alle Keys beginnen mit `tools` oder `noten` und landen damit automatisch in der Backup-Gruppe „Tools“ (`NOOK_DATA_GROUPS` in settings.js) — neue Werkzeuge halten sich an diese Präfixe.

Lade-Reihenfolge: Die Tools-Skripte stehen in `index.html` **vor** `settings.js`, weil settings.js beim Start `showView()` aufruft und ein Neuladen auf `#tools` sonst `initTools` noch nicht kennt.

---

# Hinweise je Werkzeug

**Focus Timer:** misst über einen Endzeitpunkt (`endsAt`), nicht über gezählte Ticks — Browser drosseln Hintergrund-Tabs. Die laufende Phase wird gespeichert und übersteht ein Neuladen. Phasen gehen nie automatisch weiter (bewusste Bestätigung). Restzeit im Tab-Titel, Ton per Web Audio, Benachrichtigung nur auf Wunsch.

**Notenmanager:** deutsche Notenskala 1–6, Eingabe auch als Tendenz (`2-` = 2,25, `2+` = 1,75, `1-2` = 1,5). Fachschnitt gewichtet, Jahresschnitt = Mittel der Fachschnitte, Zeugnisschnitt ungewichtet. „Was brauche ich?“ rechnet die nötige Note für einen Ziel-Schnitt aus. Kategorien sind global.

**Entscheidungshilfe:** ein Blatt pro Dilemma, speichert bei jeder Eingabe. Leere Blätter werden beim Schließen verworfen. „Nächste Schritte“ lassen sich über `addWeekTasksFromLines()` (today.js) als Wochenaufgaben anlegen. Optionen-Matrix: Kriterien mit Gewicht 1–5, Bewertung 1–5, gewichtete Summe. Rückblick: Termin wählen, danach „War die Entscheidung gut?“; fällige Rückblicke stehen oben in der Liste. Archivierte Blätter liegen hinter „Archiv (n)“.

**Datumsrechner:** Arbeitstage = Mo–Fr ohne gesetzliche Feiertage des im Kalender gewählten Bundeslands; gelesen über `getHolidaysForYear()` (calendar.js), nur lesend. Legt keine Termine an.

**Subnetz / Zahlensysteme:** reine Rechner mit Lernmodus. IPv6 und große Zahlen über BigInt.

---

# Zuständigkeiten

tools-*.js ist verantwortlich für:

- die Werkzeuge selbst und ihre eigenen Daten
- eigene Suchquellen (`registerSearchProvider`: Entscheidungen, Notenmanager)

Nicht verantwortlich für:

- Aufgabenverwaltung (Heute/Projekte) — Werkzeuge legen höchstens über die Funktionen des Ziel-Tabs etwas dort an
- Termine (Kalender), Geld (Budget), Lernkarten (Karteikarten), Anleitungen (Anleitungen)

---

# Erweiterungsregeln

Neue Werkzeuge sollen:

✔ eigenständig und ohne Einrichtung benutzbar sein

✔ eine eigene Datei und eine eigene Karte bekommen

✔ ihre Daten unter einem `tools…`-Key speichern

✔ geteilte Helfer nutzen (`wireModal`, `hubConfirm`, `escHtml`, `dateKey`, `parseGermanNumber`)

Neue Werkzeuge sollen nicht:

✖ zu einer Verwaltung werden, die einem anderen Tab gehört (keine zweite Aufgabenliste, kein Kalender, kein Budget)

✖ fremde Tab-Daten direkt ändern

✖ feste Farben verwenden (alles über Theme-Tokens)
