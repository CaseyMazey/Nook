# 🎓 Nook.

Ein persönlicher Organisations-Hub für Ausbildung, Schule, Studium und Alltag.

Nook läuft komplett lokal im Browser und kombiniert Organisation, Lernen, Finanzen, Wissensmanagement und Produktivität in einer einzigen gemütlichen Oberfläche.

Keine Installation. Kein Server. Keine Cloud-Pflicht.

```bash
git clone https://github.com/CaseyMazey/Nook.git
cd Nook
```

Anschließend einfach `index.html` öffnen — oder den Ordner mit einem beliebigen statischen Server bereitstellen.

Für Funktionen, die einen sicheren Browser-Kontext brauchen (Google-Calendar-Anmeldung, Installierbarkeit/Offline-Zugriff als PWA), muss Nook über `https://` oder `http://localhost` laufen, nicht per direktem Öffnen der Datei — dafür gibt es eine laufende Deploy-Version.

📖 **Eine ausführliche, nutzerfreundliche Beschreibung jedes Bereichs findest du im [Nook-Wiki](https://github.com/CaseyMazey/Nook/wiki).** Dieses README konzentriert sich auf Setup, Architektur und Weiterentwicklung.

---

# ✨ Highlights

- 🏠 Persönliches Dashboard für den Alltag, inkl. Gruppenpflichten-Planer
- 📌 Pinnwand mit freien Karten (Notizen, Checklisten, Code, Zitate u.v.m.)
- 📅 Kalender mit Termin-/Countdownsystem und optionaler Google-Calendar-Anbindung (in Bearbeitung)
- 💰 Budgetverwaltung mit Liquiditätsvorschau, Sparplaner (Szenarien, Zeitstrahl, Was-wäre-wenn) und optionaler Taschengeld-Automatik
- 🌱 Finanzgarten zur Visualisierung von Sparzielen
- 🪴 Garten — ein ruhiger Bilderbuch-Garten mit über 70 sammelbaren Pflanzenarten (ganz früher Entwicklungsstand, bisher Anpflanzen, Verteilen & rudimentärer Pflanzendex)
- 📚 Karteikarten mit Leitner-System und Lernstatistiken
- 📝 Persönliches Markdown-Wiki
- 📁 Projektverwaltung mit vollständigem Projektwald (Baum-Customizing, URL-Routing)
- 🧰 Werkzeugkasten (Taschenrechner, Focus Timer, Converter, Datenübertragungsraten-Rechner mit Lernmodus, Notenmanager)
- 🎮 Modularer Spiele-Hub inkl. spielübergreifendem virtuellem Haustier-System
- 🌟 Tägliche Positivity-Erinnerungen
- 🌤 Wetterwidget mit Standortauswahl
- 🎉 National-Day-Widget
- 🎨 6 eingebaute Themes + eigener Theme-Builder für individuelle Farbschemata
- 💾 Lokale Datenspeicherung mit optionalem Geräte-Sync
- 📲 Installierbar als PWA mit Offline-Zugriff (bei Nutzung über `https://`)

---

# 📖 Bereiche im Überblick

Kurzüberblick pro Bereich — die vollständige Nutzer-Doku mit allen Optionen und Details steht im [Wiki](https://github.com/CaseyMazey/Nook/wiki).

### 🏠 Heute

Persönliche Startseite: Unterrichtsblöcke, Wochenaufgaben, Gruppenpflichten-Planer, Mini-Kalender, Wetter, Schnellnotiz, National-Day- und Positivity-Widget.
→ [Wiki: Heute](https://github.com/CaseyMazey/Nook/wiki/Heute)

### 📌 Pinnwand

Freie Karten (Notizen, Checklisten, Code, Zitate, …) in drei Masonry-Spalten, inklusive eigenem Kachel-Designer.
→ [Wiki: Pinnwand](https://github.com/CaseyMazey/Nook/wiki/Pinnwand)

### 📅 Kalender

Vollständige Terminverwaltung mit wiederkehrenden und mehrtägigen Terminen, Feiertagen/Geburtstagen sowie optionaler Google-Calendar-Anbindung *(in Bearbeitung)*.
→ [Wiki: Kalender](https://github.com/CaseyMazey/Nook/wiki/Kalender)

### 💰 Budget

Monatsdashboard, die Finanzierungs-Engine „Jedem Euro einen Job“, Sparprognose & eigene Sparpläne sowie getrennte Schuldenverwaltung.
→ [Wiki: Übersicht](https://github.com/CaseyMazey/Nook/wiki/Budget-Übersicht) · [Finanzierung](https://github.com/CaseyMazey/Nook/wiki/Budget-Finanzierung) · [Sparplaner](https://github.com/CaseyMazey/Nook/wiki/Budget-Sparplaner) · [Schulden](https://github.com/CaseyMazey/Nook/wiki/Budget-Schulden)

### 🌱 Finanzgarten

Kontostand und Sparziele als wachsende Pflanzen, direkt in Budget — rein zur Motivation, ohne Bestrafung.
→ [Wiki: Finanzgarten](https://github.com/CaseyMazey/Nook/wiki/Finanzgarten)

### 🪴 Garten *(ganz früher Entwicklungsstand)*

Ein eigenständiger, ruhiger Bilderbuch-Garten zum Sammeln, über 70 Pflanzenarten geplant. Aktuell funktionieren das Anpflanzen im Anzuchtfeld, das Verteilen ausgewachsener Pflanzen im Garten sowie eine rudimentäre Grundversion des Pflanzendex — Pflanzenstand (Gartenrätsel) existiert noch nicht.
→ [Wiki: Garten](https://github.com/CaseyMazey/Nook/wiki/Garten)

### 📚 Karteikarten

Lernsystem nach dem Leitner-Prinzip mit Fächern, Themengruppen, Lernsessions und Statistiken.
→ [Wiki: Karteikarten](https://github.com/CaseyMazey/Nook/wiki/Karteikarten)

### 📝 Anleitungen

Persönliches Markdown-Bücherregal für Notizen, Code-Beispiele und Dokumentation.
→ [Wiki: Anleitungen](https://github.com/CaseyMazey/Nook/wiki/Anleitungen)

### 📁 Projekte

Langfristige Vorhaben im Projektwald — jedes Projekt wächst als eigener, individualisierbarer Baum.
→ [Wiki: Projekte](https://github.com/CaseyMazey/Nook/wiki/Projekte)

### 🧰 Tools

Taschenrechner, Focus Timer, Converter, Datenübertragungsraten-Rechner mit Lernmodus, Notenmanager.
→ [Wiki: Tools](https://github.com/CaseyMazey/Nook/wiki/Tools)

### ⚙️ Einstellungen

Themes & Theme-Builder, Tab-Verwaltung, Backup, optionaler Geräte-Sync, Google-Calendar-Verbindung.
→ [Wiki: Einstellungen](https://github.com/CaseyMazey/Nook/wiki/Einstellungen)

---

# 🎮 Spiele

Lokaler Cozy-Game-Hub mit modularer Plugin-Architektur und spielübergreifendem virtuellem Haustier-System (Cozy Home).
→ [Wiki: Spiele](https://github.com/CaseyMazey/Nook/wiki/Spiele) für die Übersicht aller Spiele und Cozy-Home-Features.

Dieser Abschnitt bleibt im README ausführlich, weil er zugleich als **Anleitung zum Hinzufügen eigener Spiele** dient.

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
   window.GAMES_LIST = ['ttt', 'memory', 'snake', 'neon-dodge', 'flashcard-battle', 'debug-hero', 'cozy-home', 'meinspiel'];
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

# 🎨 Design

Nook nutzt ein gemütliches, papierinspiriertes Design.

## Designziele

- Cozy UI
- Wenig visuelles Chaos
- Ruhige Farben
- Gute Lesbarkeit
- Lokale Nutzung
- Produktivität ohne Überforderung

Inspiriert von: Notion, Cozy Productivity Apps, Nintendo Switch UI, Animal Crossing, digitalen Notizbüchern.

Jeder größere Bereich (Kalender, Budget, Projekte, Garten, Games, …) hat zusätzlich sein eigenes, ausführliches Design-/Architekturkonzept unter `AI documentation/`.

---

# 🏗 Architektur

Ein paar technische Grundentscheidungen, die für die Weiterentwicklung relevant sind:

- **Kein Build-Schritt, kein Bundler.** Reine `<script src="...">`-Tags in fester Reihenfolge in `index.html`, ein gemeinsamer globaler Scope, keine ES-Module. Größere Bereiche sind auf mehrere Dateien mit fest dokumentierter Ladereihenfolge aufgeteilt (z. B. Budget: 8 Dateien, Google-Calendar-Integration: separate Dateien für Anmeldung/API/Sync/Einstellungen-UI).
- **Eine einzige Persistenzschicht.** Alle Daten laufen über einen zentralen `DB`-Wrapper auf `localStorage` (`DB.get`/`DB.set`) — jedes Feature bekommt einen eigenen Key. Änderungen am Datenformat laufen über einmalige Migrationen beim Laden, nie über stillschweigendes Verwerfen alter Daten.
- **Läuft direkt über `file://`.** Für Funktionen, die einen sicheren Browser-Kontext brauchen (Google-Calendar-Anmeldung, Installierbarkeit/Offline-Cache als PWA), muss Nook stattdessen über `https://`/`http://localhost` laufen — die App bleibt dabei überall sonst unverändert nutzbar.
- **Selbstregistrierende Plugin-Architekturen** für Erweiterbarkeit: Spiele (`games/<id>/`) und externe Kalender-Anbieter registrieren sich jeweils selbst bei ihrem Hub, der keine einzelnen Implementierungen kennen muss — neue Spiele/Anbieter erfordern keine Änderung am jeweiligen Hub.
- **Optionale externe Anbindungen bleiben additiv.** Geräte-Sync (Supabase) und Google Calendar funktionieren beide nur nach ausdrücklicher Anmeldung und verändern nichts an Nooks lokalem Grundverhalten, solange man sie nicht aktiv nutzt.

`AI documentation/` (budget.md, calendar.md, flashcards.md, games.md, garden.md, guides.md, projects.md, today.md) enthält pro Bereich das ausführliche, technische Design-/Architekturkonzept für die Weiterentwicklung — das [Wiki](https://github.com/CaseyMazey/Nook/wiki) richtet sich dagegen an Endnutzer.

---

# 💾 Speicherung

Alle Daten werden über den zentralen `DB`-Wrapper lokal in `localStorage` gespeichert — es wird kein Server benötigt. Optional lassen sich Daten geräteübergreifend synchronisieren (siehe [Wiki: Einstellungen](https://github.com/CaseyMazey/Nook/wiki/Einstellungen)); ganz ohne Anmeldung bleibt Nook trotzdem vollständig lokal nutzbar.

---

# 🚧 Aktueller Entwicklungsstand

Nook befindet sich weiterhin in aktiver Entwicklung.

## Geplant

- **Garten** *(ganz früher Entwicklungsstand — bisher funktionieren Anpflanzen im Anzuchtfeld, Verteilen der Pflanzen im Garten und eine rudimentäre Pflanzendex-Grundversion)*: Pflanzendex weiter ausbauen, Pflanzenstand/Gartenrätsel, Beau (die Gartenkatze), seltene Ereignisse (Schmetterlinge, Wetter, Fee/Shiny-Verwandlung), Mystery-Samen, Laden & Münzen, Tageszeit-/Wetterstimmung, weitere Gartenbereiche
- **Projekte**: Meilensteine, Aufgaben-Abhängigkeiten, Vorlagen, Tags, Notizen, Dateianhänge
- **Kalender**: Wochen-/Jahresansicht, Drag & Drop für Termine, ICS-Import/Export, weitere externe Kalender-Anbieter (z. B. Outlook/CalDAV) neben Google
- **Budget**: Diagramme, Kategorien, CSV-Import/Export, Jahresübersicht, mehrere Konten
- **Spiele**: Debug Hero und Flashcard Battle sind bisher nur als Platzhalter angelegt, noch keine Spiellogik; weitere spielübergreifende Cozy-Home-Haustiere, Spielzeitstatistiken
- **Tools**: Signallaufzeiten-Rechner, Netzwerktechnik/IPv4/Subnetting-Modul
- **Karteikarten**: Karten-Import, Bilder auf Karteikarten, Markdown-Unterstützung

## Laufend

- Projekte-Tab: weitere Optimierungen
