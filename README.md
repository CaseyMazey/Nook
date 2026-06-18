# 🎓 Personal Hub

Ein persönlicher Organisations-Hub für Ausbildung, Schule, Studium und Alltag.

Der Personal Hub läuft komplett lokal im Browser und kombiniert Organisation, Lernen, Finanzen, Wissensmanagement und Produktivität in einer einzigen gemütlichen Oberfläche.

Keine Installation. Kein Server. Keine Cloud-Pflicht.

```bash
git clone https://github.com/CaseyMazey/Personal-HUB.git
cd Personal-HUB
```

Anschließend einfach `index.html` öffnen.

---

# ✨ Highlights

- 🏠 Persönliches Dashboard für den Alltag
- 📅 Kalender mit Termin- und Countdownsystem
- 💰 Budgetverwaltung mit Liquiditätsvorschau
- 🌱 Finanzgarten zur Visualisierung von Sparzielen
- 📚 Karteikarten mit Leitner-System und Lernstatistiken
- 📝 Persönliches Markdown-Wiki
- 📁 Projektverwaltung
- 🎮 Modularer Spiele-Hub
- 🌤 Wetterwidget mit Standortauswahl
- 🎉 National-Day-Widget
- 💾 Vollständig lokale Datenspeicherung

---

# 🏠 Heute

Die Startseite dient als persönliches Kontrollzentrum.

## Enthaltene Widgets

### Unterrichtsblöcke

- Konfigurierbare Unterrichtszeiten
- Aktiver Block mit Live-Anzeige
- Fortschrittsbalken bis zum nächsten Block

### Aufgaben der Woche

- Priorisierte Wochenaufgaben
- Schnelles Erstellen neuer Aufgaben
- Statusverwaltung

### Mini-Kalender

- Monatsansicht
- Direkte Terminanzeige
- Neue Termine erstellen
- Navigation zwischen Monaten

### Wetter

- Wetterdaten für frei wählbaren Ort
- Optional automatische Standorterkennung
- Anzeige aktueller Bedingungen

### Schnellnotiz

- Permanente lokale Notizen
- Ideal für spontane Ideen

### National Day Widget

Zeigt den aktuellen internationalen Aktionstag an.

Beispiele:

- Weltumwelttag
- Weltmeertag
- National Repeat Day

Per Klick kann die Beschreibung direkt ausgeklappt werden.

### Countdown-System

Persönliche Ereignisse mit Resttagen.

Beispiele:

- Ferien
- Praktikum
- Prüfungen
- Geburtstage

### Freie Kacheln

Eigene Notizkarten für:

- To-Dos
- Einkaufslisten
- Berichtsheft
- Definitionen
- Unterrichtsfragen
- Eigene Kategorien

Die Karten erhalten automatisch eine zufällige Cozy-Farbvariante und behalten diese dauerhaft.

---

# 📚 Karteikarten

Lernsystem für Ausbildung, Schule oder Studium.

## Features

- Fächer und Themengruppen 
- Lernkarten 
- Leitner-System 
- Lernsessions 
- Lernfortschritt und Statistiken 
- Lernserien (Streaks) 
- Schwierige Karten markieren 
- Kartenexport 
- Lokale Speicherung 
- Einklappbare Bereiche 

---

# 📝 Anleitungen

Persönliches Wissensarchiv mit Markdown-Unterstützung.

## Features

- Kategorien
- Favoriten
- Volltextsuche
- Markdown
- Syntax Highlighting
- Codeblöcke mit Copy-Funktion
- Tabellen
- Listen
- Export & Import

Ideal für:

- Git-Befehle
- Linux-Kommandos
- Programmiernotizen
- Dokumentationen
- Tutorials

---

# 📅 Kalender

Vollständige Terminverwaltung.

## Features

- Monatsansicht
- Tagesansicht
- ISO-Kalenderwochen
- Countdown-Ereignisse
- Wiederkehrende Termine
- Notizen

## Mehrtägige Termine

Termine können über mehrere Tage laufen.

Beispiele:

- Ferien
- Praktika
- Projekte
- Urlaube

Diese werden automatisch über den gesamten Zeitraum dargestellt.

---

# 💰 Budget

Persönliche Finanzübersicht mit Fokus auf Ausbildung und Alltag.

## Monatsübersicht

### Einnahmen

Zeigt:

- offene Einnahmen
- bereits erhaltene Einnahmen
- Monatssumme

### Ausgaben

Unterteilt in:

- 🔴 Muss
- 🟡 Brauche
- 🟢 Möchte

Ausgaben können direkt als bezahlt markiert werden.

### Freies Budget

Berechnet automatisch:

```text
Kontostand
- Offene Ausgaben
----------------
Verbleibend
```

## Liquiditätsvorschau

Zeigt:

- Startkapital des nächsten Monats
- Ausgaben vor Gehaltseingang
- Puffer nach Ausgaben
- Kritische Zeiträume

---

# 🌱 Finanzgarten

Gamifizierte Darstellung von Kontostand und Sparzielen.

## Finanzbaum

Der Finanzbaum wächst mit deinem Kontostand.

Wachstumsstufen:

```text
Samen
Keimling
Kleine Pflanze
Mittlere Pflanze
Großer Baum
Blühender Baum
```

## Sparziel-Pflanzen

Jedes Sparziel kann eine eigene Pflanze besitzen:

- 🌻 Sonnenblume
- 🌵 Kaktus
- 🌳 Bonsai
- 🪴 Zimmerpflanze
- 🌸 Kirschblüte

Jede Pflanzenart besitzt eigene SVG-Grafiken und individuelle Wachstumsstufen.

### Besonderheiten

- Live-Verknüpfung mit Sparzielen
- Fortschrittsanzeige
- Automatische Aktualisierung
- Keine Bestrafung bei Ausgaben
- Fokus auf positive Motivation

---

# 📁 Projekte

Bereich für langfristige Planung.

## Geeignet für

- Softwareprojekte
- Ausbildungsthemen
- Roadmaps
- Ideen
- Langfristige Ziele

🚧 Projektgarten noch in Bearbeitung

---

# 🎮 Spiele

Kleiner lokaler Cozy-Game-Hub.

## Enthalten

- Snake
- Memory
- Tic-Tac-Toe

## Plugin-System

Der Spielebereich ist eine vollständig modulare Plugin-Architektur. Der Hub (`js/games.js`) kennt kein einzelnes Spiel – er weiß nur, welche IDs in `games/games-list.js` eingetragen sind, und zeigt an, was sich selbst bei ihm registriert.

Jedes Spiel bringt mit:

- ein leichtgewichtiges `manifest.js` (Titel, Beschreibung, Icon, Statistiken) – lädt sofort beim Start
- eine eigene `<id>.js` mit der eigentlichen Spiellogik – lädt erst beim Klick auf „Spielen“
- eine eigene `<id>.css` – wird beim Öffnen eingebunden und beim Schließen wieder entfernt

Highscores, Statistiken und das Zurücksetzen der eigenen Daten verwaltet jedes Spiel selbst. Weder `games.js` noch die Einstellungen kennen einzelne Spiele-IDs.

> **Warum keine `games.json`?** Der Hub läuft direkt über `file://`, ohne Server. `fetch()`/`XMLHttpRequest` werden von Browsern für lokale Dateien blockiert – `<script src="...">` und `<link href="...">` aber nicht. Deshalb ist die Spieleliste eine kleine JS-Datei (`games-list.js`) statt einer JSON-Datei, und jedes Spiel registriert sich aktiv selbst, statt vom Hub eingelesen zu werden.

## Eigenes Spiel hinzufügen

1. Neuen Ordner anlegen: `games/meinspiel/`

2. Darin `manifest.js` erstellen – registriert Metadaten und optional Statistiken:

   ```js
   window.registerGame({
     id: 'meinspiel',
     title: 'Mein Spiel',
     description: 'Kurze Beschreibung für die Karte.',
     icon: '🎲',
     accent: 'blue', // optional: '', 'blue', 'orange', 'purple', 'pink'

     getStats() {
       // optional – Liste von {label, value}. Karte zeigt die ersten
       // zwei Einträge, der Statistik-Dialog zeigt alle.
       return [{ label: 'Highscore', value: 0 }];
     },

     resetStats() {
       // optional – wird von "Highscores zurücksetzen" in den
       // Einstellungen aufgerufen.
     }
   });
   ```

3. `meinspiel.js` erstellen – die eigentliche Spiellogik. Lädt erst beim ersten Klick auf "Spielen", ergänzt nur `mount`/`destroy` zur bereits registrierten Karte:

   ```js
   (function () {
     function mount(container) {
       container.innerHTML = `<p>Hier kommt das Spiel hin.</p>`;
       // DOM aufbauen, Events binden, State initialisieren
     }

     function destroy() {
       // Timer, Intervalle oder globale Event-Listener aufräumen
     }

     window.registerGame({ id: 'meinspiel', mount, destroy });
   })();
   ```

4. `meinspiel.css` erstellen – nur die Styles, die das Spiel selbst braucht.

5. Die ID in `games/games-list.js` eintragen:

   ```js
   window.GAMES_LIST = ['ttt', 'memory', 'snake', 'meinspiel'];
   ```

Das war's – `js/games.js` und `index.html` müssen dafür nicht angefasst werden.

### Platzhalter ohne Logik

Spiele, die noch in Arbeit sind, brauchen nur ein `manifest.js` mit `comingSoon: true`. Sie erscheinen dann als "Bald verfügbar"-Karte, ganz ohne `<id>.js`/`<id>.css`:

```js
window.registerGame({
  id: 'meinspiel',
  title: 'Mein Spiel',
  description: '...',
  icon: '🎲',
  comingSoon: true
});
```

---

# ⚙️ Einstellungen

Konfiguration des gesamten Hubs.

## Enthalten

- Unterrichtsblöcke
- Wetterstandort
- Backup & Restore
- Datenexport
- Datenimport

## Dark Mode

Der Dark Mode kann direkt über das Symbol in der Navigation umgeschaltet werden.

---

# 🎨 Design

Der Hub nutzt ein gemütliches, papierinspiriertes Design.

## Farbpalette

| Bereich | Farbe |
|----------|----------|
| Sage | `#D1D1C2` |
| Wichtiges | `#F5EBDF` |
| Fragen | `#D9D8CA` |
| Berichtsheft | `#DED1C1` |
| Schnellnotiz | `#F6E4BF` |

## Designziele

- Cozy UI
- Wenig visuelles Chaos
- Ruhige Farben
- Gute Lesbarkeit
- Lokale Nutzung
- Produktivität ohne Überforderung

Inspiriert von:

- Notion
- Cozy Productivity Apps
- Nintendo Switch UI
- Animal Crossing
- Digitale Notizbücher

---

# 💾 Speicherung

Alle Daten werden lokal gespeichert.

Es werden keine Server benötigt.

Gespeichert werden unter anderem:

- Termine
- Aufgaben
- Budgetdaten
- Sparziele
- Finanzgarten
- Karteikarten
- Projekte
- Anleitungen
- Einstellungen

---

# 🚧 Aktueller Entwicklungsstand

Der Hub befindet sich weiterhin in aktiver Entwicklung.

Geplante Erweiterungen:

- Weitere Spiele-Plugins
- Game-Hub Funktionalität ergänzen
- Zusätzliche Finanzgarten-Pflanzen
- Erweiterte Projektverwaltung
- Fertigstellung des Projektwaldes
