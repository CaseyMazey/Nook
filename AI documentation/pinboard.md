# Pinnwand

Freie Kartenfläche für alles, was keinen festen Platz in einem anderen Tab hat: Notizen, Checklisten, Code-Schnipsel, Zitate, Berichtsheft.

Früher Teil von Today (siehe `today.md`, „Verschoben nach Pinnwand“), jetzt ein eigener Tab.

Dateien: `js/pinboard.js`, `css/pinboard.css`, `css/pinboard-rpg.css`.

---

# Aufbau

- 3 unabhängige Spalten (Masonry-Prinzip), jede Karte kennt ihre Spalte und Reihenfolge.
- Angepinnte Karten stehen immer oben in ihrer Spalte.
- Karten ohne feste Höhe wachsen mit dem Text. Eine gezogene Höhe bleibt, bis sie per Doppelklick auf den Griff oder mit Entf zurückgesetzt wird.
- Verschieben: Griff ziehen oder Pfeiltasten auf dem Griff. Die Spalte lässt sich auch im Karten-Dialog wählen.

## Kartenstile

| Stil | Inhalt |
|---|---|
| Standard, Angepinnt, Wichtig, Zitat | freies Textfeld (`content`) |
| Code | Textfeld in Code-Schrift mit Kopieren-Knopf (`content`) |
| Checkliste | Einträge (`items`) mit Abhaken, Bearbeiten, Sortieren, Fortschritt |
| Berichtsheft | zwei feste Felder (`betrieb`, `schule`), nur als neue Karte wählbar, kein Stilwechsel |

Ein Stilwechsel zwischen Text und Checkliste wandelt den Inhalt um (Zeilen ↔ Einträge, erledigte Einträge als `☑`). Es bleibt nie Inhalt unsichtbar in einer Karte liegen.

---

# Daten

- Alle Karten liegen unter dem Key `deskCards`. Speichern immer über `saveDeskCards()`.
- Texteingaben speichern entprellt (`saveDeskCardsSoon()`, 400 ms), beim Verlassen des Felds oder der Seite sofort.
- `saveDeskCards()` führt Änderungen anderer Geräte pro Karte zusammen, bevor es schreibt. Ändern beide Geräte dieselbe Karte, gewinnt die lokale Fassung.
- Andere Tabs legen Karten nur über `addDeskCardFromText()` an (Schnellnotiz „Ablegen“).

---

# Zuständigkeiten

Verantwortlich für:

- freie Karten und ihre Anordnung
- Checklisten ohne Datum und ohne Projektbezug
- das Berichtsheft

Nicht verantwortlich für:

- Aufgaben mit Datum oder Wochenbezug (Today)
- Termine (Calendar)
- Projektaufgaben (Projects)
- ausführliche Dokumentation (Guides)
- Lernkarten (Flashcards)

---

# Erweiterungsregeln

Neue Funktionen sollen:

✔ Karten schnell und ohne Formulare bedienbar halten
✔ auf jeder Kartenfarbe lesbar bleiben (`--card-fg` statt `--text`)
✔ im Stil „rpg“ und am Handy funktionieren
✔ per Tastatur bedienbar sein

Neue Funktionen sollen nicht:

✖ zu einer Aufgabenverwaltung mit Fälligkeiten werden
✖ Wiki-Funktionen der Guides nachbauen
✖ Inhalte unsichtbar in Karten liegen lassen
✖ Karten mit vielen festen Feldern überladen
