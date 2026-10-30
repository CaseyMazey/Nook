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
- heute schon gelernt (Antworten heute, über alle Fächer)
- Erfolgsquote

Bewusst nicht „heute fällig“: eine große Zahl offener Karten wirkt wie ein Berg, das heute Geschaffte motiviert. Fällige Karten stehen weiterhin je Fach, Thema und im Inhaltsverzeichnis.

Bewusst ohne Lernserie (Streak): Ein Zähler, der nach einem verpassten Tag auf null fällt, setzt unter Druck statt zu motivieren. Bitte nicht wieder einführen.

Diese Werte werden automatisch berechnet. Archivierte Fächer zählen nicht mit.

Kompakt in einer Zeile (Icon, Zahl, Beschriftung), mit schlichten Linien-Icons statt Emojis. Im RPG-Theme sind die drei Kennzahlen kein Papier, sondern Werkstoffe (Holzschild, Lederriemen, Messingschild), damit sie sich vom Inhalt abheben.

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

Die Fachliste ist kompakt (Name + fällig-Zahl, darunter Lehrer, Kartenzahl und Quote) und scrollt am Desktop in sich, damit auch viele Fächer Platz haben. Im RPG-Theme ist sie eine Kreidetafel wie der Speiseplan in „Heute“.

---

# Archiv

Unter den aktiven Fächern liegt ein aufklappbares Archiv mit eigenen Gruppen (z. B. „1. Schuljahr“, „2. Schuljahr“). Fächer werden über ⋮ → „Ins Archiv…“ in eine bestehende oder neue Gruppe verschoben und über „Aus dem Archiv holen“ zurückgeholt.

- Archivierte Fächer bleiben vollständig nutzbar und lernbar, sie zählen nur nicht mehr in der globalen Statistik (Karten insgesamt, Erfolgsquote).
- Die Suche findet auch archivierte Fächer und klappt die passenden Gruppen auf.
- „Gruppe auflösen“ holt alle Fächer der Gruppe zurück zu den aktiven Fächern, es gehen nie Karten verloren.

Gespeichert als `subject.archiveGroupId` (fehlt = aktiv) im Key `subjects`, die Gruppen unter `fc_archive_groups = [{ id, name }]`, aufgeklappte Gruppen unter `fc_archive_open` (`'root'` = das Archiv selbst). Verweist ein Fach auf eine nicht mehr vorhandene Gruppe, gilt es als aktiv.

---

# Inhaltsverzeichnis

Unter der Fächerliste steht für das gewählte Fach ein Inhaltsverzeichnis: Prüfungen und Themengruppen (mit Kartenzahl bzw. fälligen Karten). Ein Klick springt zur Stelle und klappt die Themengruppe dabei auf. „Alle ein-/aufklappen“ schaltet alle Themengruppen auf einmal. Auf dem Handy startet es zugeklappt.

Es ist reine Navigation und ändert keine Lerndaten (nur den Klappzustand).

---

# Themengruppen

Jedes Fach kann beliebig viele Themengruppen besitzen.

Eingeklappt nimmt eine Themengruppe nur eine schmale Zeile ein: Kopfzeile und dünner Leitner-Balken (Verteilung als Tooltip).

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

# Prüfungen

Eine Prüfung fasst mehrere Themengruppen eines Fachs zusammen, die in derselben Klassenarbeit oder Prüfung abgefragt werden.

Eine Prüfung besitzt:

- Name
- zugeordnete Themengruppen

Sie wird als eine Lernsession über alle Karten ihrer Themen gelernt, bewusst durchgemischt (eine normale Themengruppen-Session bleibt nach Leitner-Box sortiert).

Prüfungen stehen im Fach über den Themengruppen. Anlegen und Bearbeiten über „+ Prüfung“, Löschen entfernt nur die Zusammenfassung, nie Themen oder Karten.

Beim Markdown-Import legt die Zeile `Prüfung: Name` unter `# Fach` die Prüfung an bzw. ergänzt sie.

Gespeichert als `subject.exams = [{ id, name, groupIds }]` im Key `subjects`. Ältere Fächer ohne das Feld gelten als „keine Prüfungen“. Wird eine Themengruppe gelöscht, wird sie aus allen Prüfungen ausgetragen.

Umgesetzt in `js/flashcards-exams.js` (lädt nach `flashcards-import.js`).

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

Anfang (neue und zurückgefallene Karten)

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

Eine Lernsession wird für eine Themengruppe oder eine Prüfung (mehrere Themen) gestartet.

Auswahl der Karten (Leitner-Regel):

- **Standard: nur fällige Karten** – „▶ Lernen (n)“ an der Gruppe, „▶ Fällige lernen (n)“ an der Prüfung.
- **Alle Karten** – ist nichts fällig, wird der Knopf zu „↻ Alle wiederholen“; außerdem im ⋮-Menü der Gruppe und als „Alle mischen“ an der Prüfung (Prüfungsvorbereitung).
- **Nur die falschen** – „↻ Nur diese nochmal“ im Sessionabschluss.
- Ist nichts fällig und wird trotzdem „fällig“ gestartet, kommt ein Hinweis statt einer leeren Session.

Reihenfolge: Themen nach Leitner-Box, innerhalb einer Box gemischt (sonst lernt man die Reihenfolge mit); Prüfungen ganz gemischt.

Fälligkeit und „heute“ richten sich nach dem lokalen Kalendertag (nicht UTC). Karten mit gleicher Vorderseite (Groß-/Kleinschreibung und Leerraum egal) kommen nur einmal; das betrifft vor allem Prüfungen, in denen dieselbe Frage in zwei Themen steckt. Die Antwort gilt dann für alle gleichen Karten der Session.

Der Stand (Reihenfolge, Position, Richtig/Falsch) wird nach jeder Antwort unter `fc_learn_session` gespeichert:

- Neuladen verliert nichts: beim nächsten Öffnen des Tabs geht die Session von selbst weiter.
- „⏸ Pausieren“ (und ✕) schließt die Session mit Stand; über den Fächern erscheint „Pausierte Session“ mit „Fortsetzen“ / „Verwerfen“. Startet man dieselbe Gruppe/Prüfung erneut, geht es ebenfalls dort weiter.
- „Beenden“ verwirft den Stand. Eine andere Session zu starten, während eine offen ist, fragt vorher nach.
- Leitner-Boxen werden ohnehin bei jeder Antwort sofort gespeichert; verworfen wird nur der Session-Stand.

Die Lernsession nimmt den ganzen Bereich ein: Kopfleiste (Titel, Import, + Fach), Fächer, Kartenliste und Statistik sind währenddessen ausgeblendet. Man soll nicht vorab die nächsten Fragen samt Antworten sehen können, die Session ist nur zum Lernen.

Unter 1024px Breite (Tablet/Handy) liegt sie als Vollbild-Blatt über der Seite.

Die Session passt immer in die Fensterhöhe, man muss nicht scrollen; die Lernkarte nimmt den freien Platz ein, sehr lange Antworten scrollen innerhalb der Karte.

Links steht dauerhaft, wofür gelernt wird (Fach, Lehrer, Thema), darunter Heutiger Fortschritt und Schwierige Karten. Auf dem Handy steht der Kontext als eine Zeile oben, Heutiger Fortschritt und Schwierige Karten entfallen dort.

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

Durch Anklicken wird sie umgedreht. Erneutes Anklicken dreht sie zurück (Frage nochmal lesen), beliebig oft.

Erst nach dem ersten Umdrehen erscheinen die Antwortmöglichkeiten; sie bleiben dann stehen.

Die Rückseite wird als Markdown dargestellt (Listen, **fett**, Tabellen, Code-Blöcke für Schaubilder) – mit dem Renderer der Anleitungen (`renderMarkdown` aus `guides.js`, nur lesend genutzt). Auch in der Kartenliste steht immer die ganze, formatierte Antwort, damit man dort durchlesen und lernen kann. Nicht kürzen.

Tastatur: Leertaste/Enter dreht um, 1/2/3 = Nicht gewusst/Schwer/Gewusst, Esc pausiert. Die Karte ist fokussierbar.

---

# Antworten

Nach dem Umdrehen kann der Benutzer auswählen:

- Gewusst
- Schwer
- Nicht gewusst

Die Auswahl beeinflusst automatisch die Leitner-Stufe.

Die Knöpfe heißen genau so (nicht „Leicht“/„Wiederholen“ — man denkt beim Lernen in gewusst/nicht gewusst) und zeigen darunter klein, was mit der Karte passiert. „Schwer“ zählt in der Statistik als falsch.

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
- Veränderungen der Leitner-Boxen
- die nicht gewussten/schweren Karten als Liste

Von dort: „↻ Nur diese nochmal“ (nur die falschen), „Alle nochmal“ oder schließen.

---

# Tagesstatistik

Für jeden Kalendertag werden gespeichert:

- gelernte Karten (verschiedene Karten an diesem Tag)
- Wiederholungen (alle Antworten, auch mehrfach dieselbe Karte)
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
- ins Archiv / aus dem Archiv
- exportieren (Markdown)
- löschen

Themengruppen

- alle Karten wiederholen
- umbenennen
- exportieren (Markdown)
- löschen

Karteikarten

- bearbeiten
- verschieben nach … (anderes Thema, auch anderes Fach; Lernstand bleibt)
- duplizieren
- schwierig markieren
- exportieren (Markdown)
- löschen

Löschen fragt immer nach (Nook-Dialog, nicht der Browser-Dialog).

---

# Kartenfilter

„Filter“ im Fachkopf öffnet eine Leiste: Textsuche in Vorder- und Rückseite sowie Alle / Fällig / Schwierig / Anfang (Box 1). Gefiltert werden nur die Kartenlisten des Fachs, Themen ohne Treffer werden ausgeblendet, Themen mit Treffern aufgeklappt. Reiner Anzeigefilter, wird beim Fachwechsel zurückgesetzt.

---

# Export

Exportiert werden können:

- einzelne Karte
- Themengruppe
- gesamtes Fach

Exportiert wird als Markdown im Import-Format (`flashcards-import-format.md`), damit sich Exporte wieder importieren, teilen oder an Claude geben lassen. Überschriften `#`–`###` in Rückseiten werden dabei zu `####`, damit der Re-Import sie nicht als neue Karte liest.

Exportiert werden nur Fach, Lehrer, Themen, Vorder- und Rückseiten. Persönliche Statistiken und Leitner-Boxen werden bewusst nicht übernommen, Prüfungen ebenfalls nicht.

---

# Import

Über „⬆ Import“ in der Kopfzeile lassen sich ganze Kartensätze aus Markdown anlegen (Datei `.md`/`.txt` wählen oder Text einfügen).

Gedacht für Lernzettel: Claude erstellt zu einem Lernzettel eine passende `.md`-Datei, Nook importiert sie.

Format: `# Fach`, `## Themengruppe`, `### Vorderseite`, darunter die Rückseite bis zur nächsten Überschrift.

Genaue Regeln und die Vorlage für Claude: `flashcards-import-format.md` (auch im Import-Fenster über „Format/Vorlage kopieren“).

Ablauf:

- Vorschau zeigt neue und doppelte Karten pro Fach und Themengruppe sowie Hinweise zu übersprungenen Teilen
- pro Fach wählbar: neues Fach oder in bestehendes Fach einfügen
- erst „Importieren“ speichert
- doppelte Karten (gleiche Vorderseite in derselben Themengruppe) werden nicht doppelt angelegt

Importierte Karten erhalten automatisch die Standardwerte (Box 1, keine Statistik, nicht schwierig).

Die Datei wird per FileReader gelesen, nicht per fetch (Nook läuft unter file://).

Umgesetzt in `js/flashcards-import.js` (lädt nach `flashcards.js`).

Ein Import der JSON-Exportdateien ist weiterhin für zukünftige Versionen vorgesehen.

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
- Export
- Markdown-Import
- Prüfungen
- Archiv
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

- Bilder auf Karteikarten
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