# 🎓 Personal Hub

Ein persönlicher Organisations-Hub für Azubis, Schüler und Entwickler — komplett lokal, ohne Server oder Installation.  
Einfach `index.html` im Browser öffnen und loslegen.

Der Fokus liegt auf einem gemütlichen, produktiven Workspace mit Lernen, Organisation, Budgetplanung, Wissenssammlung und kleinen Spielen zur Entspannung.

---

## Features

### 🏠 Heute
Die zentrale Startseite für den Alltag.

Enthält unter anderem:

- Wochenaufgaben mit Prioritäten
- Unterrichtsblöcke & aktuelle Blöcke
- To-Do-Liste
- Einkaufsliste
- Schnellnotizen
- Berichtsheft
- Eigene Kacheln
- Countdown-System
- Analoge & digitale Uhr
- Wetteranzeige
- National Day Widget
- Mini-Kalender
- Stark überarbeitetes cozy UI-Layout

---

### 📚 Karteikarten
Lernsystem mit Fächern, Themengruppen und Lernsessions.

Features:

- Fächer & Themengruppen
- Lernsessions
- Fortschrittsanzeige
- Einklappbare Gruppen
- Lokale Speicherung
- Minimalistische Lernoberfläche

---

### 📝 Anleitungen
Persönliches Entwickler-Wiki mit Markdown-Support.

Features:

- Kategorien mit Emojis
- Vollständiger Markdown-Support
- Code-Blöcke mit Copy-Button
- Favoriten & Bookmarks
- Volltextsuche
- Tabellen, Listen, Syntax-Highlighting
- Export & Import als `.md`
- Codeblock-Bookmarks

Ideal für:
- Programmiernotizen
- Linux-Befehle
- Git-Guides
- Webentwicklung
- Eigene Dokumentation

---

### 📅 Kalender
Monatskalender mit Terminverwaltung.

Features:

- Termine mit Uhrzeit
- Countdown-Events
- Notizen pro Termin
- ISO-Kalenderwochen
- Monatsnavigation
- Tagesansicht mit Events

---

### 💰 Budget
Persönliche Finanzübersicht mit Fokus auf Alltag & Ausbildung.

Features:

- Einnahmen & Ausgaben
- Wiederkehrende Buchungen
- Einmalige Buchungen
- Sparziele
- Liquiditätsvorschau
- Kontostand-System
- Monatsübersichten
- Cozy Dashboard-Design

---

### 🎮 Spiele
Kleiner lokaler Game Hub zur Entspannung.

Aktuell enthalten:

- Tic-Tac-Toe
- Memory
- Snake

Das Spiele-System wurde auf ein modulares Plugin-System umgebaut:

- Dynamisches Laden über `games.json`
- Eigene `manifest.json` pro Spiel
- Automatische Registrierung
- Isolierte CSS-Dateien
- Plugin-Architektur mit Lifecycle-System

> Hinweis:  
> Der neue Games Hub befindet sich aktuell noch im Umbau.  
> Das neue Mockup/UI ist bereits integriert, einige Funktionen des neuen Hubs sind aber noch nicht vollständig aktiv.  
> Die alten Spiel-Dateien funktionieren weiterhin.

---

### 📁 Projekte
Eigener Bereich für Projekte und langfristige Aufgaben.

Gedacht für:

- Projektplanung
- Ideen
- Entwicklungsfortschritt
- Eigene Roadmaps
- Langfristige Organisation

---

### ⚙️ Einstellungen
Anpassung des Hubs.

Features:

- Dark Mode
- Digitale / analoge Uhr
- Unterrichtsblöcke konfigurieren
- Backup & Restore
- Lokale Speicherung

> Die frühere Farbanpassung wurde entfernt, da das UI inzwischen ein festes, konsistentes Design-System nutzt.

---

## Design

Der Hub nutzt ein cozy/minimalistisches UI mit Fokus auf:

- ruhige Farben
- weiche Karten
- angenehme Lesbarkeit
- wenig visuelles Chaos
- produktives Arbeiten ohne Überforderung

Inspirationen:

- Notion
- Cozy Desktop Apps
- Steam Deck / Launcher UIs
- Nintendo Switch Dashboard
- Moderne Productivity Apps

---

## Schnellstart

1. Repository klonen oder ZIP herunterladen
2. `index.html` im Browser öffnen
3. Fertig — keine Installation nötig

```bash
git clone https://github.com/CaseyMazey/Personal-HUB.git
cd Personal-HUB
