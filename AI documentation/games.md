# Games.md

Version: 1.0

---

# Zweck

Games ist der zentrale Spiele-Hub des Personal Hub.

Er dient ausschließlich als Launcher, Bibliothek und gemeinsame Plattform für alle Spiele.

Games selbst enthält keine Spiellogik.

Jedes Spiel wird als eigenständiges Plugin entwickelt und kann unabhängig installiert, aktualisiert oder entfernt werden.

---

# Ziele

Games soll:

- alle installierten Spiele an einem Ort sammeln
- Spiele einheitlich darstellen
- Statistiken anzeigen
- Highscores verwalten
- eine gemeinsame Gamification bereitstellen
- andere Module mit Spielen verbinden

---

# Designprinzip

Games soll sich wie eine gemütliche Spielesammlung anfühlen.

Nicht wie Steam.

Nicht wie Epic Games.

Nicht wie ein App Store.

Der Fokus liegt auf:

- kleinen Spielen
- kurzen Pausen
- Motivation
- Lernen
- Entspannung

---

# Architektur

Games besitzt keinerlei Kenntnis über einzelne Spiele.

Es kennt lediglich registrierte Plugins.

Jedes Spiel ist vollständig eigenständig.

Games stellt lediglich die Infrastruktur bereit.

---

# Plugin-System

Jedes Spiel ist ein eigenes Plugin.

Ein Plugin besteht mindestens aus:

- manifest.js
- spiel.js
- spiel.css

Das Manifest enthält ausschließlich Metadaten.

Die Spiellogik wird erst beim Start geladen.

Dadurch bleibt der Hub schnell.

---

# Spielregistrierung

Jedes Plugin registriert sich selbst.

Games kennt keine fest eingebauten Spiele.

Neue Spiele können hinzugefügt werden, ohne den Hub anzupassen.

---

# Lazy Loading

Beim Start werden ausschließlich:

- Manifest
- Metadaten
- Statistiken

geladen.

Die eigentliche Spiellogik wird erst geladen, wenn der Benutzer auf „Spielen" klickt.

Nach dem Schließen wird das Stylesheet des Spiels wieder entfernt.

---

# Game Library

Die Bibliothek zeigt alle installierten Spiele.

Jede Spielkarte enthält:

- Icon
- Titel
- Beschreibung
- zwei Kurzstatistiken
- Spielen-Button
- Statistik-Button
- Badge (optional)

---

# Suche

Die Bibliothek besitzt eine Suchfunktion.

Gefiltert wird nach dem Spieltitel.

Die Suche verändert keine Daten.

---

# Spielkarte

Eine Spielkarte zeigt ausschließlich Informationen aus dem Plugin.

Games berechnet keine Statistiken selbst.

Alle angezeigten Werte stammen vom jeweiligen Spiel.

---

# Statistiken

Jedes Spiel kann beliebige Statistiken bereitstellen.

Games behandelt diese generisch.

Eine Statistik besteht aus:

- Bezeichnung
- Wert

Die Bedeutung kennt ausschließlich das jeweilige Spiel.

---

# Highscores

Ein Spiel kann eine Bestenliste bereitstellen.

Games zeigt diese lediglich an.

Die Verwaltung erfolgt vollständig im Plugin.

---

# Spielen

Beim Start eines Spiels passiert folgendes:

1. CSS laden
2. Spiellogik laden
3. Spiel initialisieren
4. Spiel im Modal anzeigen

Games kennt dabei keinerlei Spielregeln.

---

# Modal

Alle Spiele werden innerhalb eines gemeinsamen Modals gestartet.

Plugins können ihre gewünschte Größe angeben.

Unterstützt werden:

- Normal
- Middle
- Big
- Very Big

---

# Plugin-Verantwortung

Ein Spiel ist verantwortlich für:

- Spiellogik
- Rendering
- Eingaben
- Animationen
- Speicherung eigener Daten
- Statistiken
- Highscores
- Achievements
- eigene Einstellungen

Games greift nicht in diese Bereiche ein.

---

# Game Hub API

Games stellt Plugins gemeinsame Funktionen zur Verfügung.

Dazu gehören unter anderem:

- Registrierung
- Modal
- Statistiken
- Highscore-Anzeige
- gemeinsames Styling
- gemeinsame UI-Komponenten

---

# Coming Soon

Spiele können als "Coming Soon" markiert werden.

Diese erscheinen bereits in der Bibliothek.

Sie können jedoch nicht gestartet werden.

---

# Badges

Plugins können eigene Badges definieren.

Beispiele:

- Neu
- Update
- Event
- Beta

Games zeigt diese lediglich an.

---

# Gamification

Games bildet die Grundlage für die globale Gamification des Personal Hub.

Langfristig werden unter anderem unterstützt:

- XP
- Level
- Achievements
- Tagesaufgaben
- Spielserien (Streaks)
- Gesamtspielzeit

Diese Daten sind hubweit verfügbar.

---

# Cozy Home Integration

Ist Cozy Home installiert, erscheint im Game Hub eine Live-Haustierkarte.

Diese zeigt:

- aktuelles Haustier
- Stimmung
- Wohlbefinden
- Zimmer
- Wetter
- Jahreszeit

Außerdem können grundlegende Aktionen direkt ausgeführt werden:

- Streicheln
- Füttern
- Spielen
- Schlafen

Games speichert dabei keinerlei Haustierdaten.

Alle Daten stammen ausschließlich aus Cozy Home. :contentReference[oaicite:0]{index=0}

---

# Profilbereich

Der rechte Bereich des Game Hub dient der Gamification.

Langfristig werden dort unter anderem angezeigt:

- Spielerlevel
- XP
- Streak
- Gesamtspielzeit
- Tagesaufgaben
- Achievements

Derzeit dient dieser Bereich teilweise noch als Platzhalter.

---

# Speicherung

Games speichert selbst nur hubweite Informationen.

Plugins speichern ihre eigenen Daten selbst.

Dadurch bleiben Spiele vollständig voneinander getrennt.

---

# Zuständigkeiten

games.js ist verantwortlich für:

- Pluginverwaltung
- Registrierung
- Bibliothek
- Suche
- Starten von Spielen
- Lazy Loading
- Spielmodale
- Statistikdialog
- Plugin-Kommunikation

Nicht verantwortlich für:

- Spiellogik
- Highscore-Berechnung
- Spielregeln
- Speicherstände einzelner Spiele
- Rendering einzelner Spiele

Diese Aufgaben liegen vollständig beim jeweiligen Plugin. :contentReference[oaicite:1]{index=1}

---

# Plugin-Schnittstelle

Ein Spiel sollte mindestens bereitstellen:

- ID
- Titel
- Beschreibung
- Icon
- Manifest
- mount()
- destroy()

Optional:

- getStats()
- getHighscores()
- resetStats()
- Badge
- Coming Soon Status
- Modalgröße

---

# Erweiterungsregeln

Neue Funktionen sollen:

✔ den Hub verbessern

✔ für alle Spiele nutzbar sein

✔ pluginunabhängig bleiben

✔ bestehende Plugins nicht verändern müssen

Neue Funktionen sollen nicht:

✖ Wissen über einzelne Spiele enthalten

✖ Spiellogik in den Hub verschieben

✖ Plugincode ersetzen

✖ feste Abhängigkeiten zwischen Spielen erzeugen

---

# Zukunft

Geplante Erweiterungen:

- Plugin Manager
- Spielbewertungen
- Kategorien
- Favoriten
- Zuletzt gespielt
- Spielzeitstatistiken
- Cloud-Synchronisation
- Online-Highscores
- Multiplayer-Unterstützung
- Erfolge über mehrere Spiele hinweg
- Saisonale Events
- Plugin-Updates

---

# Entwicklungsrichtlinien

Bei Änderungen am Game Hub gelten folgende Regeln:

- Games bleibt ein generischer Launcher.
- Jedes Spiel bleibt vollständig eigenständig.
- Der Hub kennt keine Spielregeln.
- Plugins dürfen unabhängig voneinander entwickelt werden.
- Neue Spiele müssen ohne Änderungen am Hub integriert werden können.
- Gemeinsame Funktionen werden ausschließlich über die Plugin-Schnittstelle bereitgestellt.