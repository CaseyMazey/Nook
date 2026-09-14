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

---

# ✨ Highlights

- 🏠 Persönliches Dashboard für den Alltag, inkl. Gruppenpflichten-Planer
- 📌 Pinnwand mit freien Karten (Notizen, Checklisten, Code, Zitate u.v.m.)
- 📅 Kalender mit Termin-/Countdownsystem und optionaler Google-Calendar-Anbindung
- 💰 Budgetverwaltung mit Liquiditätsvorschau, Sparplaner (Szenarien, Zeitstrahl, Was-wäre-wenn) und optionaler Taschengeld-Automatik
- 🌱 Finanzgarten zur Visualisierung von Sparzielen
- 🪴 Garten — ein ruhiger Bilderbuch-Garten mit über 70 sammelbaren Pflanzenarten
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

# 🏠 Heute

Die Startseite dient als persönliches Kontrollzentrum.

## Enthaltene Widgets

### Unterrichtsblöcke

- Konfigurierbare Unterrichtszeiten
- Aktiver Block mit Live-Anzeige
- Fortschrittsbalken bis zum nächsten Block

### Aufgaben der Woche

- Priorisierte Wochenaufgaben mit dreistufigem Status (offen / in Bearbeitung / abgeschlossen)
- Schnelles Erstellen neuer Aufgaben

### Gruppenpflichten

Eigenständiges Rotationsplanungssystem für geteilte Pflichten (z. B. Wohnheim-/WG-Dienste):

- Beliebig viele "Pflichten" mit Personen oder Gruppen als Teilnehmer
- Automatische faire Rotation oder feste zyklische Reihenfolge
- Verknüpfte Pflichten verhindern, dass dieselbe Person in derselben Woche doppelt eingeteilt wird
- Planung wird dauerhaft gespeichert (nicht bei jedem Laden neu gewürfelt); Bearbeitungen wirken nur auf zukünftige Wochen

### Mini-Kalender

- Monatsansicht mit normalen, mehrtägigen und wiederkehrenden Terminen
- Direkte Terminanzeige und -erstellung
- Nutzt ausschließlich Daten aus dem Kalender-Modul, keine eigene Terminverwaltung

### Wetter

- Wetterdaten für frei wählbaren Ort (Open-Meteo)
- Optional automatische Standorterkennung
- Zeigt nur die aktuellen Bedingungen, keine Vorhersage

### Schnellnotiz

- Eine permanente lokale Notiz für spontane Ideen

### National Day Widget

Zeigt den aktuellen internationalen Aktionstag an, Beschreibung per Klick ausklappbar.

### Positivity

Zeigt täglich eine kurze, positive Erinnerung an.

- Eigene Kategorien (z. B. „Things To Remember“, „Self Care“, „Motivation“, „Persönliches“)
- Karten können favorisiert oder fest angepinnt werden (bleibt über Mitternacht hinweg bestehen)
- Eigene Karten erstellen, exportieren und importieren
- Automatischer Kartenwechsel bei Tageswechsel

### Countdown-System

Persönliche Ereignisse mit Resttagen (Ferien, Praktikum, Prüfungen, Geburtstage, …).

---

# 📌 Pinnwand

Eigenständiger Bereich für freie Karten — früher Teil von „Heute“, jetzt ein eigener Tab mit mehr Platz.

## Features

- 3 unabhängige Spalten im Masonry-Prinzip (keine gemeinsame Zeilenhöhe)
- Frei verschiebbare Kartenhöhe per Resize-Handle
- Mehrere Kartentypen:
  - **Standard** – freies Textfeld
  - **Angepinnt** – bleibt immer oben in der Spalte
  - **Wichtig** – auffälliger, größerer Titel
  - **Code** – für Code und Terminalbefehle, mit Copy-Funktion
  - **Checkliste** – Kästchen zum Abhaken mit Fortschrittsanzeige
  - **Zitat** – ein einzelner, groß gesetzter Satz
- Eigener Kachel-Designer für benutzerdefinierte Karten (Hintergrundfarbe, Washi Tape, Büroklammer, abgeknickte Ecke)
- Farbe, Spalte und Stil frei editierbar

Ideal für: To-Dos, Einkaufslisten, Berichtsheft, Definitionen, Unterrichtsfragen, eigene Kategorien.

---

# 📚 Karteikarten

Lernsystem für Ausbildung, Schule oder Studium.

## Features

- Fächer und Themengruppen
- Leitner-System (5 Boxen, automatisch wachsende Wiederholungsintervalle)
- Lernsessions mit Live-Statistik, Motivationsnachrichten und Abschlusszusammenfassung
- Lernfortschritt und Statistiken je Themengruppe
- Lernserien (Streaks) und Tagesstatistiken
- Schwierige Karten markieren
- Kartenexport als JSON (Import ist geplant)
- Lokale Speicherung

---

# 📝 Anleitungen

Persönliches Wissensarchiv mit Markdown-Unterstützung.

## Features

- Kategorien und Favoriten
- Volltextsuche
- Markdown mit Syntax Highlighting
- Codeblöcke mit Copy-Funktion
- Tabellen und Listen
- Export & Import

Ideal für: Git-Befehle, Linux-Kommandos, Programmiernotizen, Dokumentationen, Tutorials.

---

# 📅 Kalender

Vollständige Terminverwaltung — die alleinige Quelle für Terminverwaltung im Hub.

## Features

- Monatsansicht und Tagesansicht
- ISO-Kalenderwochen
- Countdown-Termine
- Wiederkehrende Termine (täglich/wöchentlich/monatlich/jährlich, eigenes Intervall, mehrere Wochentage, Serienbearbeitung mit Ausnahmen)
- Individuelle Terminfarben
- Geburtstage (eigenes System, automatische jährliche Wiederholung) und offline berechnete Feiertage (bundesweit + Bundesland)
- Monatsziele und automatische Monatsstatistik
- Mondphase und Wetter im saisonalen Hero

## Mehrtägige Termine

Termine können über mehrere Tage laufen (Ferien, Praktika, Urlaube, …) und werden automatisch als durchgehender Balken über den gesamten Zeitraum dargestellt.

## Google Calendar (optional)

Google-Kalender lassen sich optional verbinden (Einstellungen → „Google Calendar“):

- Anmeldung mit einer eigenen, kostenlos erstellbaren Google-Client-ID (OAuth) — funktioniert nur über `https://`/`http://localhost`, nicht beim direkten Öffnen von `index.html`
- Auswahl, welche Google-Kalender in Nook angezeigt werden
- Automatischer Abgleich inkl. Löschungen, wahlweise in festem Intervall oder manuell per Klick
- Google-Termine sind klar als solche erkennbar (eigenes Präfix statt neuer Optik) und bleiben ein reiner Nur-Lese-Spiegel, getrennt von Nooks eigenen Terminen gespeichert — bearbeitet werden sie weiterhin in Google
- Optional: einzelne oder mehrtägige Nook-Termine zu Google übertragen (Terminserien werden aktuell nicht exportiert)
- Architektur bewusst offen für weitere externe Kalender-Anbieter neben Google

---

# 💰 Budget

Persönliche Finanzübersicht mit Fokus auf Ausbildung und Alltag.

## Monatsübersicht

Zeigt Einnahmen (offen/erhalten), Ausgaben (🔴 Muss / 🟡 Brauche / 🟢 Möchte, direkt als bezahlt markierbar) und das freie Budget (Kontostand − offene Ausgaben).

## Liquiditätsvorschau

Zeigt Startkapital des nächsten Monats, Ausgaben vor Gehaltseingang, Puffer und kritische Zeiträume — rechnet immer ab dem heutigen Tag.

## Finanzierung — „Jedem Euro einen Job“

Zentrale Engine, über die Einnahmen konkret Sparzielen, Schulden oder Ausgaben zugeordnet werden. Interaktiver Geldfluss-Planer per Drag & Drop, inklusive Kapazitätsgrenzen je Karte.

## Sparplaner (Sub-Tabs Prognose & Sparpläne)

- **Sparprognose**: berechnet aus wiederkehrenden Posten drei Sparraten-Szenarien (🔒 Garantiert, 📊 Realistisch, 🚀 Optimistisch), inkl. Zeitstrahl und „Was-wäre-wenn?“-Simulator
- **Sparpläne**: eigenständige, vom Nutzer angelegte Spar-Vorhaben mit Zielbetrag, Zieldatum und Einzahlungs-Einträgen, optional mit einem Sparziel verknüpft

## Schulden & Raten

Getrennt von Sparzielen verwaltet (eine Schuld wird getilgt, nicht gespart), ebenfalls über die Finanzierung-Engine aus Einnahmen bedienbar.

## Taschengeld (optional)

Automatische Tagegeld-Berechnung, z. B. für Ausbildungsberufe mit wechselnden Praxis-/Schulphasen: unterschiedliche Sätze für Wochentag/Samstag/Sonntag/Feiertag, Berücksichtigung eines festen Heimfahrt-Wochentags sowie Abwesenheiten. Läuft als virtuelle Einnahme automatisch in Monatsübersicht, Finanzstatus und Liquiditätsvorschau ein.

---

# 🌱 Finanzgarten

Gamifizierte Darstellung von Kontostand und Sparzielen, direkt in Budget.

## Finanzbaum

Wächst mit dem Kontostand, unabhängig von einzelnen Sparzielen: Samen → Keimling → Kleine Pflanze → Mittlere Pflanze → Großer Baum → Blühender Baum.

## Sparziel-Pflanzen

Jedes Sparziel kann eine eigene Pflanze besitzen (🌻 Sonnenblume, 🌵 Kaktus, 🌳 Bonsai, 🪴 Zimmerpflanze, 🌸 Kirschblüte), live mit dem jeweiligen Fortschritt verknüpft. Keine Bestrafung bei Ausgaben — rein positive Motivation.

> Der Finanzgarten ist unabhängig vom separaten Garten-Tab entstanden — beide sind eigenständige, ähnliche Wachstums-Visualisierungen für unterschiedliche Daten.

---

# 🪴 Garten

Ein ruhiger, illustrierter „Bilderbuch-Garten“ zum Sammeln und Anschauen — kein Farming- oder Idle-Game. Leitidee: „Show the moments, not the movement“ — Zustände wechseln sichtbar, aber selten und in klaren Sprüngen statt flüssiger Animation.

## Anzuchtfeld

Neue Pflanzen wachsen zunächst im Anzuchtfeld, in vier sichtbaren Stufen: Samen → Keimling → junge Pflanze → ausgewachsen (insgesamt ca. 30 Minuten reale Zeit, läuft auch weiter, während der Garten geschlossen ist). Erst ausgewachsene Pflanzen lassen sich per Drag in den Garten umpflanzen und dort frei verschieben.

## Pflanzen & Pflanzendex

Über 70 Pflanzenarten (Blumen, Obst, Nüsse) — mehrere davon mit unterschiedlichen Farbvarianten und seltenen „Shiny“-Varianten. Jede erstmals platzierte Pflanze bzw. Farbvariante wird automatisch im Pflanzendex festgehalten (Bild, Name, entdeckte Varianten, Erstentdeckungsdatum).

## Pflanzenstand

Optionale, rein tag-basierte Gartenrätsel: passende Pflanzen (z. B. nach Farbe, Jahreszeit oder „essbar“) in eine Drop-Zone ziehen, um ein Rätsel zu lösen und ein neues freizuschalten.

Kein Verwelken, kein Zeitdruck, keine Pflicht wiederzukommen — Garten ist bewusst frei von jeder Art von FOMO oder Gamification-Zwang.

---

# 🧰 Tools

Kleiner Werkzeugkasten direkt in Nook — für den Ausbildungsalltag und schnelle Alltagsrechnungen.

## Enthalten

### Taschenrechner

- Grundrechenarten mit Verlaufsfunktion
- Deutsche Komma-Schreibweise

### Focus Timer

- Pomodoro-Prinzip (Fokus, kurze Pause, lange Pause)
- Visueller Fortschrittsring
- Sitzungszähler

### Converter

- Einheitenumrechnung für gängige Größen

### Datenübertragungsraten-Rechner

- Umrechnung zwischen Datenübertragungseinheiten (z. B. Bit/s, Byte/s, kBit/s, MBit/s)
- **Lernmodus**: erklärt den Rechenweg didaktisch Schritt für Schritt (Gegeben → Gesucht → Formel → Formel umstellen → Einheiten umrechnen → Werte einsetzen → Berechnen → Ergebnis)
- Geeignet zur Prüfungsvorbereitung (IT-Berufe)

### Notenmanager

Verwaltung von Schul- und Ausbildungsnoten über mehrere Ausbildungsjahre hinweg.

- Ausbildungsjahre mit eigenen Fächern
- Globale Notenkategorien mit Standardgewichtung (z. B. Klausur, mündlich, Projekt)
- Leistungen pro Fach mit Datum, Kategorie, Note und individueller Gewichtung
- Zeugnisse im Karten-Design, inkl. „Zeugnisse vergleichen“-Ansicht
- Eingabe im deutschen Komma-Format

### Geplante Module

- **Signallaufzeiten** – Berechnung von Signalausbreitung und -verzögerung
- **Netzwerktechnik / IPv4 / Subnetting** – CIDR-Tabelle, Netzmasken, Host- und Broadcast-Berechnung

---

# 📁 Projekte

Bereich für langfristige Planung — Softwareprojekte, Ausbildungsthemen, Roadmaps, Ideen, langfristige Ziele.

## Projektwald

Der Projektwald ist die alleinige Übersichtsansicht — eine separate Kartenliste gibt es nicht mehr. Jedes Projekt wächst als eigener PNG-Baum vor einer illustrierten Waldlandschaft, gestaffelt in vier Tiefenreihen (hinten kleiner und enger, vorne größer, mit mehr Abstand). Tabs (Alle/Aktiv/Abgeschlossen) zeigen die jeweilige Projektanzahl direkt im Label; Suche und Prioritätsfilter sind schwebende Pills über der Landschaft.

## Projektbaum & Customizing

Jedes Projekt bekommt dauerhaft eine von 5 Baumvarianten zugewiesen; abgeschlossene/archivierte Projekte zeigen eine herbstliche Version. Auf der Projekt-Detailseite wachsen erledigte Kernaufgaben als Obst, erledigte Extraaufgaben als Blüten in die Baumkrone — über 70 Frucht-/Blumensorten stehen im Customizing-Modal zur Auswahl.

## Weitere Funktionen

- URL-Routing: Projekte und ihre Detailseite sind direkt verlinkbar
- Eigenständige mobile Detailansicht
- Kern- und Extra-Aufgaben (Extras beeinflussen den Hauptfortschritt nicht), Unterprojekte, automatische Fortschrittsberechnung
- Archivierung abgeschlossener/inaktiver Projekte (jederzeit wiederherstellbar), ohne den Wald zu überladen
- Inline-Bearbeitung von Aufgaben per Doppelklick

---

# 🎮 Spiele

Lokaler Cozy-Game-Hub mit modularer Plugin-Architektur.

## Enthaltene Spiele

- Tic-Tac-Toe
- Memory
- Snake (bringt ein eigenes Cozy-Home-Haustier mit)
- Neon Dodge
- Flashcard Battle (wip)
- Debug Hero (wip)
- Cozy Home (virtuelles Haustier)

## Plugin-System

Der Spielebereich ist eine vollständig modulare Plugin-Architektur. Der Hub (`js/games.js`) kennt kein einzelnes Spiel – er weiß nur, welche IDs in `games/games-list.js` eingetragen sind, und zeigt an, was sich selbst bei ihm registriert.

Jedes Spiel bringt mit:

- ein leichtgewichtiges `manifest.js` (Titel, Beschreibung, Icon, Statistiken) – lädt sofort beim Start
- eine eigene `<id>.js` mit der eigentlichen Spiellogik – lädt erst beim Klick auf „Spielen“
- eine eigene `<id>.css` – wird beim Öffnen eingebunden und beim Schließen wieder entfernt

Highscores, Statistiken und das Zurücksetzen der eigenen Daten verwaltet jedes Spiel selbst. Weder `games.js` noch die Einstellungen kennen einzelne Spiele-IDs.

> **Warum keine `games.json`?** Der Hub läuft direkt über `file://`, ohne Server. `fetch()`/`XMLHttpRequest` werden von Browsern für lokale Dateien blockiert – `<script src="...">` und `<link href="...">` aber nicht. Deshalb ist die Spieleliste eine kleine JS-Datei (`games-list.js`) statt einer JSON-Datei, und jedes Spiel registriert sich aktiv selbst, statt vom Hub eingelesen zu werden.

## 🐾 Cozy Home — Virtuelles Haustier

Ein eigenständiges Spiel im Games Hub, das gleichzeitig als spielübergreifendes Haustier-System dient.

### Features

- Mehrere Haustiere (Katze, Hund, Maus, …) mit individuellen Persönlichkeiten, Lieblingsessen und -aktivitäten
- Bedürfnisse: Hunger, Energie, Zuneigung – verändern sich auch offline (Offline-Fortschritt)
- Datengetriebenes Vorlieben-System: `FOOD_REGISTRY`, `TOY_REGISTRY` und `PREFERENCE_LEVELS` bestimmen, was ein Haustier mag – Vorlieben werden nach und nach „entdeckt“ und in den Aktions-Dropdowns angezeigt
- Inventar & Shop: Futter und Spielzeug kaufen und verfüttern
- Tagesaufgaben mit Coin-Belohnung
- Zimmer-Szene mit Schichten für Jahreszeit, Tageszeit und Wetter (CSS-Filter statt Bild-Duplikate)
- Gedanken-Sprechblasen je nach Zustand (hungrig, müde, einsam, zufrieden)

### Spielübergreifendes Haustier-System

Andere Spiele können eigene Haustiere beisteuern, ohne dass Cozy Home sie kennt:

- Jedes Spiel definiert optionale Haustiere in seinem eigenen `manifest.js` (aktuell z. B. Snake)
- Cozy Home durchsucht `window.GameHub.registry` und führt fremde Haustiere automatisch in seine Haustier-Liste zusammen
- Der Shop trennt automatisch zwischen Standard-Artikeln und spielübergreifenden Artikeln
- Fremde Assets (Bilder etc.) bleiben immer im Ordner des jeweiligen Spiels – Cozy Home übernimmt oder verlinkt sie nur

Futter, Spielzeug und Vorlieben-Level sind dagegen rein interne Cozy-Home-Registries — nicht von anderen Spielen deklarierbar.

### Live-Pet-Karte im Games Hub

In der Seitenleiste des Games Hub erscheint automatisch eine Live-Karte des aktiven Haustiers, sobald Cozy Home installiert ist:

- Zeigt dasselbe Zimmer (Jahreszeit, Tageszeit, Wetter) wie in Cozy Home
- Wohlbefinden-Anzeige (Mittelwert aus Hunger, Energie, Zuneigung)
- Direkte Aktionen: Streicheln, Füttern, Spielen – ohne das Spiel öffnen zu müssen

Cozy Home ist rein datengetrieben aufgebaut: neue Haustiere, Futter- oder Spielzeugarten erfordern ausschließlich neue Registry-Einträge, keine Codeänderungen.

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

# ⚙️ Einstellungen

Konfiguration des gesamten Hubs.

## Darstellung

- 6 eingebaute Themes (Hell, Dunkel, Midnight, Forest, Espresso, OLED), umschaltbar direkt über die Navigation
- Eigener Theme-Builder für individuelle Farbschemata (Hintergrund/Fläche/Text/Akzent) inklusive eigenem Hintergrundbild
- Persönliche Farbbibliothek für Termine, Karten u. a. — automatisch theme-gerecht für Hell/Dunkel abgeleitet, keine feste Palette

## Tabs

- Sichtbarkeit einzelner Tabs ein-/ausblenden
- Eigene Reihenfolge in Sidebar/Navigation per Pfeiltasten festlegen

## Google Calendar

Verbinden/Trennen, Auswahl der in Nook angezeigten Google-Kalender, Sync-Intervall und optionaler Termin-Export — Details siehe Abschnitt „Kalender“.

## Geräte-Sync (optional)

Per E-Mail-Login (Magic Link) lassen sich Daten geräteübergreifend synchronisieren. Ohne Anmeldung bleibt Nook exakt wie gewohnt rein lokal nutzbar — Sync ist ein rein additives Extra, nie Voraussetzung.

## Weitere Einstellungen

- Unterrichtsblöcke, Wetterstandort, Positivity-Kategorien
- Backup: vollständiger Export/Import aller Daten als JSON-Datei
- Spieldaten (inkl. Cozy Home) zurücksetzen

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

---

# 💾 Speicherung

Alle Daten werden primär lokal gespeichert, es wird kein Server benötigt.

Gespeichert werden unter anderem: Termine, Aufgaben, Gruppenpflichten, Budgetdaten, Sparziele, Finanzgarten, Garten (Pflanzen, Pflanzendex), Karteikarten, Projekte, Anleitungen, Pinnwand-Karten, Notenmanager-Daten, Positivity-Karten und -Kategorien, Spielstände (inkl. Cozy Home), Theme-Einstellungen und persönliche Farben, Google-Calendar-Verbindungseinstellungen, allgemeine Einstellungen.

Optional lassen sich diese Daten geräteübergreifend synchronisieren (siehe „Einstellungen → Geräte-Sync“) — ganz ohne Anmeldung bleibt Nook trotzdem vollständig lokal nutzbar.

---

# 🚧 Aktueller Entwicklungsstand

Nook befindet sich weiterhin in aktiver Entwicklung.

## Geplant

- **Garten**: Beau (die Gartenkatze), seltene Ereignisse (Schmetterlinge, Wetter, Fee/Shiny-Verwandlung), Mystery-Samen, Laden & Münzen, Tageszeit-/Wetterstimmung, weitere Gartenbereiche
- **Projekte**: Meilensteine, Aufgaben-Abhängigkeiten, Vorlagen, Tags, Notizen, Dateianhänge
- **Kalender**: Wochen-/Jahresansicht, Drag & Drop für Termine, ICS-Import/Export, weitere externe Kalender-Anbieter (z. B. Outlook/CalDAV) neben Google
- **Budget**: Diagramme, Kategorien, CSV-Import/Export, Jahresübersicht, mehrere Konten
- **Spiele**: Debug Hero und Flashcard Battle fertigstellen, weitere spielübergreifende Cozy-Home-Haustiere, Spielzeitstatistiken
- **Tools**: Signallaufzeiten-Rechner, Netzwerktechnik/IPv4/Subnetting-Modul
- **Karteikarten**: Karten-Import, Bilder auf Karteikarten, Markdown-Unterstützung

## Laufend

- Aufräumen ungenutzter Altlasten (Dead-Code-Audit)
