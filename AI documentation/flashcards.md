# Flashcards.md

Version: 1.0

---

# Zweck

Flashcards ist das Lernsystem des Personal Hub.

Es dient zum langfristigen Lernen mit digitalen Karteikarten nach dem Leitner-Prinzip.

Der Fokus liegt auf regelmäßigem Wiederholen statt kurzfristigem Auswendiglernen.

---

# Ziele

Flashcards soll:

- Wissen langfristig festigen
- regelmäßiges Lernen motivieren
- den Lernfortschritt sichtbar machen
- mehrere Fächer verwalten
- Themen sinnvoll strukturieren
- das Lernen möglichst angenehm gestalten

---

# Designprinzip

Flashcards soll sich nicht wie klassische Lernsoftware anfühlen.

Keine überladenen Tabellen.

Keine komplizierten Einstellungen.

Keine unnötigen Statistiken.

Stattdessen:

- ruhiges Design
- klare Struktur
- motivierende Rückmeldungen
- möglichst wenige Klicks

---

# Hauptbereiche

Flashcards besteht aus vier Bereichen:

1. Statistik
2. Fächer
3. Themengruppen
4. Lernsession

---

# Statistik

Am oberen Rand befindet sich eine globale Statistik.

Sie zeigt:

- Karten insgesamt
- heute fällige Karten
- Erfolgsquote
- Lernserie (Streak)

Diese Werte werden automatisch berechnet.

---

# Fächer

Ein Fach dient als oberste Organisationsebene.

Ein Fach besitzt mindestens:

- Name

Optional:

- Lehrer

Intern besitzt ein Fach außerdem:

- Themengruppen
- Karteikarten
- Lernstatistiken

---

# Themengruppen

Jedes Fach kann beliebig viele Themengruppen besitzen.

Eine Themengruppe dient dazu, ein Fach in kleinere Themenbereiche aufzuteilen.

Beispiele:

Biologie

- Genetik
- Evolution
- Zellbiologie

Informatik

- HTML
- CSS
- JavaScript

---

# Karteikarten

Eine Karte besitzt mindestens:

- Vorderseite
- Rückseite

Intern besitzt sie zusätzlich:

- Leitner-Stufe
- letztes Lerndatum
- Gesamtantworten
- richtige Antworten
- Schwierig-Markierung

---

# Schwierige Karten

Jede Karte kann als schwierig markiert werden.

Schwierige Karten dienen ausschließlich als persönliche Markierung.

Sie verändern den Leitner-Algorithmus nicht.

Während einer Lernsession werden schwierige Karten zusätzlich im Seitenpanel angezeigt.

---

# Leitner-System

Flashcards verwendet das klassische Leitner-System.

Jede Karte befindet sich in einer von fünf Boxen.

Box 1

Neue Karten

Box 2

Lernen

Box 3

Gut

Box 4

Sehr gut

Box 5

Sicher

Je höher die Box, desto größer wird das Wiederholungsintervall.

---

# Wiederholungsintervalle

Standardmäßig werden folgende Intervalle verwendet:

Box 1

- sofort

Box 2

- nach 1 Tag

Box 3

- nach 2 Tagen

Box 4

- nach 4 Tagen

Box 5

- nach 8 Tagen

Diese Werte können zukünftig erweitert werden.

---

# Lernfortschritt

Jede Themengruppe besitzt:

- Fortschrittsbalken
- Verteilung der Leitner-Boxen
- Anzahl fälliger Karten
- Erfolgsquote

Dadurch ist jederzeit sichtbar, wie weit ein Thema gelernt wurde.

---

# Lernsession

Eine Lernsession wird für eine einzelne Themengruppe gestartet.

Dabei werden alle Karten dieser Gruppe nacheinander gelernt.

Während der Session wird ein eigenes Seitenpanel geöffnet.

---

# Lernansicht

Die Lernansicht besteht aus:

- Fortschrittsbalken
- aktuelle Karte
- Live-Statistik
- Motivation
- Antwortbuttons

---

# Karte umdrehen

Eine Karte wird zunächst mit ihrer Vorderseite angezeigt.

Durch Anklicken wird sie umgedreht.

Erst danach erscheinen die Antwortmöglichkeiten.

---

# Antworten

Nach dem Umdrehen kann der Benutzer auswählen:

- Gewusst
- Schwer
- Nicht gewusst

Die Auswahl beeinflusst automatisch die Leitner-Stufe.

---

# Leitner-Regeln

Gewusst

→ Karte steigt eine Box auf.

Schwer

→ Karte fällt eine Box zurück.

Nicht gewusst

→ Karte kehrt in Box 1 zurück.

Diese Regeln werden automatisch angewendet.

---

# Live-Statistik

Während der Lernsession werden angezeigt:

- richtige Antworten
- falsche Antworten
- verbleibende Karten

Die Werte aktualisieren sich sofort.

---

# Motivation

Während einer Lernsession werden kleine Motivationsnachrichten eingeblendet.

Beispiele:

- Los geht's
- Erste Karte geschafft
- Mehr als die Hälfte geschafft
- Fast geschafft

Diese Nachrichten dienen ausschließlich der Motivation.

---

# Sessionabschluss

Nach Abschluss einer Lernsession erscheint eine Zusammenfassung.

Sie zeigt:

- bearbeitete Karten
- richtige Antworten
- falsche Antworten
- Erfolgsquote
- aktuelle Lernserie
- Veränderungen der Leitner-Boxen

Von dort aus kann die Session erneut gestartet oder geschlossen werden.

---

# Lernserie

Für jeden Tag mit mindestens einer abgeschlossenen Lernsession wird die Lernserie erhöht.

Die Serie wird in Tagen gespeichert.

Sie dient ausschließlich der Motivation.

---

# Tagesstatistik

Für jeden Kalendertag werden gespeichert:

- gelernte Karten
- Wiederholungen
- richtige Antworten
- falsche Antworten

Diese Werte werden täglich automatisch zurückgesetzt.

---

# Erfolgsquote

Die globale Erfolgsquote berechnet sich aus:

richtige Antworten

geteilt durch

alle beantworteten Karten.

Sie wird automatisch aktualisiert.

---

# Suche

Die Fächerliste besitzt eine Suchfunktion.

Gesucht wird nach:

- Fachname
- Lehrer

Die Suche filtert die Liste sofort während der Eingabe.

---

# Kontextmenüs

Fächer

- bearbeiten
- exportieren
- löschen

Themengruppen

- umbenennen
- exportieren
- löschen

Karteikarten

- bearbeiten
- duplizieren
- schwierig markieren
- exportieren
- löschen

---

# Export

Exportiert werden können:

- einzelne Karte
- Themengruppe
- gesamtes Fach

Exportiert wird als JSON.

Dabei werden nur die eigentlichen Lerndaten exportiert.

Persönliche Statistiken werden bewusst nicht übernommen.

---

# Import

Import ist für zukünftige Versionen vorgesehen.

Importierte Karten sollen automatisch fehlende Standardwerte erhalten.

Dadurch bleiben ältere Exportdateien kompatibel.

---

# Speicherung

Flashcards speichert unter anderem:

- Fächer
- Themengruppen
- Karteikarten
- Leitner-Stufen
- letzte Wiederholung
- richtige Antworten
- Gesamtantworten
- schwierige Karten
- Lernserie
- Tagesstatistiken
- eingeklappte Themengruppen

Alle Daten werden lokal gespeichert.

---

# Zuständigkeiten

flashcards.js ist verantwortlich für:

- Fachverwaltung
- Themengruppen
- Karteikarten
- Leitner-System
- Lernsession
- Statistiken
- Lernserie
- Export
- Suchfunktion
- Kontextmenüs

Nicht verantwortlich für:

- Kalender
- Projekte
- Today
- Games
- Budget

---

# Datenmodell

Flashcards verwaltet:

- Fächer
- Themengruppen
- Karteikarten
- Leitner-Stufen
- Tagesstatistiken
- Lernserie
- schwierige Karten

Andere Module dürfen diese Daten lesen.

Flashcards bleibt die einzige Quelle für Lerndaten.

---

# Erweiterungsregeln

Neue Funktionen sollen:

✔ das Lernen angenehmer machen

✔ das Leitner-System sinnvoll ergänzen

✔ bestehende Karteien kompatibel halten

✔ den ruhigen Charakter des Personal Hub erhalten

Neue Funktionen sollen nicht:

✖ das Leitner-System ersetzen

✖ unnötig komplex werden

✖ klassische LMS-Systeme nachbauen

✖ Business-Lernplattformen imitieren

✖ bestehende Lerndaten inkompatibel machen

---

# Zukunft

Geplante Erweiterungen:

- Import von Karteikarten
- Bilder auf Karteikarten
- Markdown-Unterstützung
- Lernziele
- tägliche Erinnerungen
- Statistiken über längere Zeiträume
- Kategorien
- Tags
- Zufallsmodus
- Audiokarten
- mehrere Leitner-Profile
- Synchronisation

---

# Entwicklungsrichtlinien

Bei Änderungen an Flashcards gelten folgende Regeln:

- Das Leitner-System bleibt die Grundlage des Lernens.
- Bestehende Karteien müssen weiterhin funktionieren.
- Statistiken dürfen erweitert, aber nicht verfälscht werden.
- Neue Funktionen sollen das Lernen vereinfachen und nicht komplizierter machen.
- Flashcards bleibt das zentrale Lernsystem des Personal Hub.