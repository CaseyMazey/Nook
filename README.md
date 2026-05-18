# 🎓 Personal-Hub

Ein persönlicher Organisations-Hub für Azubis und Schüler – komplett lokal, keine Installation, kein Server.  
Einfach `index.html` im Browser öffnen und loslegen.

---

## Features

- **Heute** – Wochenaufgaben mit Prioritäten, Unterrichtsblöcke, To-Do-Liste, Berichtsheft, Schnellnotiz & eigene Kacheln
- **Karteikarten** – Lernkarten nach Fächern sortiert, mit Lernsession und Fortschrittsanzeige
- **Anleitungen** – Eigenes Entwickler-Wiki mit Kategorien, Markdown-Support, Code-Blöcken mit Copy-Button, Volltextsuche, Favoriten, Tags sowie Export & Import als `.md`-Dateien
- **Kalender** – Monatsansicht mit Terminen und Countdown-Funktion für wichtige Dates
- **Budget** – Wiederkehrende Einnahmen/Ausgaben, Sparziele und Liquiditätsvorschau
- **Spiele** – Tic-Tac-Toe, Memory und Snake zur Entspannung (mit Highscores)
- **Einstellungen** – Dark Mode, Farbanpassung, Unterrichtsblöcke konfigurieren, Backup & Restore

---

## Schnellstart

1. Repository klonen oder als ZIP herunterladen
2. `index.html` direkt im Browser öffnen
3. Fertig – keine Installation, kein Internet nötig

```bash
git clone https://github.com/CaseyMazey/Personal-HUB.git
cd Personal-HUB
# index.html im Browser öffnen
```

Oder einfach die neuste Version über **[GitHub Pages](#)** aufrufen *(Link eintragen nach Setup)*.

---

## Projektstruktur

```
Personal-HUB/
├── index.html        # Haupt-HTML
├── css/
│   └── style.css     # Alle Styles
└── js/
    ├── main.js       # State, Storage, Navigation
    ├── today.js      # Heuteseite
    ├── calendar.js   # Kalender
    ├── flashcards.js # Karteikarten
    ├── guides.js     # Anleitungen & Entwickler-Wiki
    ├── budget.js     # Budget
    ├── games.js      # Spiele
    └── settings.js   # Einstellungen & Backup
```

---

## Anleitungen-Feature

Das Anleitungen-Tab funktioniert als persönliches Entwickler-Wiki:

- Kategorien mit eigenem Emoji-Icon (z.B. 🐙 Git, 🌐 Webentwicklung)
- Anleitungen mit Titel, Kurzbeschreibung, Tags, Erstelldatum und Bearbeitungsdatum
- Vollständiger **Markdown-Support**: Überschriften, Listen, Tabellen, Code-Blöcke, fett/kursiv, Links, Textmarkierungen (`==text==`)
- **Code-Blöcke** mit Sprachmarkierung und Copy-Button
- **Volltextsuche** über alle Kategorien, Titel, Beschreibungen, Inhalte und Tags
- **Favoriten** – wichtige Anleitungen werden oben angezeigt
- **Export** einzelner Anleitungen als `.md`-Datei
- **Import** von `.md`-Dateien (mit optionalem Front Matter)
- Editor mit Vorschau-Tab und Snippet-Buttons für schnelles Schreiben

---

## Daten & Datenschutz

Alle Daten werden ausschließlich im `localStorage` des Browsers gespeichert.  
Es werden keine Daten an Server übertragen. Backup/Restore als JSON-Datei möglich.

---

## Mitmachen

Pull Requests und Issues sind willkommen! So geht's:

1. Repository forken
2. Feature-Branch erstellen (`git checkout -b feature/mein-feature`)
3. Änderungen committen (`git commit -m 'Add: mein Feature'`)
4. Branch pushen (`git push origin feature/mein-feature`)
5. Pull Request öffnen

Bugs oder Ideen? Einfach ein **[Issue öffnen](../../issues)**.

---

## Lizenz

MIT – frei nutzbar und anpassbar.
