# Search.md

Version: 1.0

---

# Zweck

Die globale Suche (`Strg + K` / `⌘ + K`, Lupe in der Seitenleiste, auf dem Handy oben auf der Mehr-Seite) findet Inhalte aus allen Tabs an einer Stelle und springt direkt dorthin.

Sie macht vorhandene Inhalte auffindbar — sie ist **keine** weitere Notiz-, Aufgaben- oder Datenverwaltung.

---

# Was die Suche ist — und was nicht

✔ findet und öffnet

✔ liest die Daten der Tabs, wie sie gerade im Speicher sind

✖ legt nichts an, ändert nichts, löscht nichts

✖ hat keinen eigenen Datenbestand / Index auf der Festplatte

✖ ersetzt nicht die Suchen innerhalb einzelner Tabs (Anleitungen, Karteikarten, Projekte …)

Einzige eigene Daten: `searchRecent` — die zuletzt geöffneten Treffer (max. 8, nur Verweise `{ p: Quelle, id }`).

---

# Bedienung

- Tippen filtert sofort; Groß-/Kleinschreibung und Akzente/Umlaute sind egal („ubung“ findet „Übung“, „ss“ findet „ß“).
- Mehrere Wörter: alle müssen vorkommen (in Titel, Fundort, Stichworten oder Inhalt).
- Reihenfolge: Titel-Anfang > Titel > Fundort/Stichworte > Inhalt; Gruppen nach ihrem besten Treffer.
- Höchstens 5 Treffer pro Bereich, „+ N weitere“ klappt den Bereich auf.
- `↑ ↓` wählen, `Enter` öffnet, `Esc` schließt. Leeres Feld zeigt „Zuletzt geöffnet“.
- Ein Treffer im Inhalt zeigt einen kurzen Auszug mit markiertem Suchwort.

---

# Architektur

Kern: `js/hub-search.js` + `css/hub-search.css`, geladen direkt nach `hub-utils.js`. Der Kern kennt **keinen** Tab.

Jeder Tab meldet am Ende seiner eigenen Datei eine Suchquelle an:

```js
registerSearchProvider({
  id: 'guides', label: 'Anleitungen', icon: '📖', view: 'guides',
  items: () => [{ id, title, sub, text, keywords, icon, open() }, …],
});
```

- `items()` wird bei jedem Öffnen frisch gebaut (kein Cache, nichts veraltet).
- `open()` nutzt die vorhandenen Funktionen des Tabs (Tab wechseln, Bearbeiten-Fenster öffnen, Eintrag hervorheben über `searchFlashElement()`).
- Quellen ausgeblendeter Tabs (`hiddenTabs`) werden übersprungen.
- Eine fehlerhafte Quelle bricht die Suche nicht ab (wird übersprungen, Warnung in der Konsole).

Aktuelle Quellen:

| Quelle | Datei | Inhalt | Klick öffnet |
|---|---|---|---|
| Anleitungen | guides.js | Titel, Tags, Beschreibung, Inhalt | das Kapitel |
| Karteikarten | flashcards.js | Vorder-/Rückseite | Fach + Bearbeiten-Fenster der Karte |
| Projekte | projects.js | Projekte, Äste, Aufgaben (ohne Archiv) | Projekt-Detail bzw. Aufgaben-Detail |
| Pinnwand | pinboard.js | Kartentitel, Text, Listeneinträge | Pinnwand, Karte hervorgehoben |
| Kalender | calendar.js | Termine, Serien, Geburtstage | Termin-Fenster (im richtigen Monat) |
| Budget | budget.js | Posten, Einmalbuchungen, Sparziele, Schulden | jeweiliges Bearbeiten-Fenster |
| Quests | questboard.js | Quests | Quest-Fenster |
| Aufgaben (Heute) | today.js | Wochenaufgaben | Aufgaben-Fenster |

---

# Erweiterungsregeln

Neue Bereiche:

✔ eigene Quelle in der eigenen Tab-Datei anmelden — der Kern bleibt unverändert

✔ `open()` über bestehende Funktionen des Tabs, nicht über fremdes DOM

Die Suche soll nicht:

✖ Daten schreiben (Ausnahme: `searchRecent`)

✖ einen dauerhaften Index speichern

✖ zur Befehlszentrale mit vielen Aktionen werden, bevor das bewusst entschieden ist

---

# Zukunft

- Befehle (z. B. „> Neuer Termin“, „> Timer 25 min“) — Phase 2, nur nach Entscheidung.
- Weitere Quellen (Tools, Spiele, Garten-Pflanzendex), wenn sinnvoll.
