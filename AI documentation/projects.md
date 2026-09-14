# Projects.md

Version: 1.2

---

# Zweck

Projects ist der Bereich für größere Vorhaben innerhalb des Personal Hub.

Ein Projekt dient dazu, ein Ziel in kleinere, übersichtliche Arbeitsschritte zu unterteilen.

Im Mittelpunkt stehen Fortschritt, Motivation und langfristige Planung.

Projects ersetzt weder den Kalender noch die Aufgabenverwaltung des Today-Tabs.

---

# Ziele

Projects soll:

- langfristige Projekte organisieren
- Fortschritt sichtbar machen
- große Aufgaben in kleinere Schritte aufteilen
- Motivation durch Visualisierung schaffen
- abgeschlossene Projekte archivieren
- den Überblick über mehrere Projekte gleichzeitig ermöglichen

---

# Designprinzip

Projects soll sich nicht wie klassische Projektmanagement-Software anfühlen.

Keine Tabellen.

Keine Tickets.

Keine Kanban-Boards.

Keine Business-Optik.

Der Bereich soll ruhig, freundlich und motivierend wirken.

Fortschritt soll sichtbar werden, ohne Druck zu erzeugen.

---

# Hauptbereiche

Projects besteht aus drei Bereichen:

1. Projektwald (Übersicht — siehe eigener Abschnitt weiter unten)
2. Projektdetailseite
3. Archiv

Eine separate Kartenübersicht existiert nicht mehr — der Projektwald ist die
einzige Übersichtsansicht. Tabs (Alle/Aktiv/Abgeschlossen) zeigen die
jeweilige Projektanzahl direkt im Tab-Label an; eine eigene
Statistik-Leiste mit Gesamtfortschritt gibt es aktuell nicht.

Diese Struktur soll erhalten bleiben.

---

# Projekte

Ein Projekt besitzt mindestens:

- Name
- Erstellungsdatum

Optional:

- Beschreibung
- Priorität
- Fälligkeitsdatum

Intern besitzt jedes Projekt außerdem:

- Aufgaben
- Unterprojekte
- Archivstatus
- Änderungsdatum

---

# Prioritäten

Ein Projekt kann folgende Prioritäten besitzen:

- Niedrig
- Mittel
- Hoch

Die Priorität dient ausschließlich der Orientierung.

Sie verändert keine automatische Sortierung.

---

# Aufgaben

Jedes Projekt besitzt Aufgaben.

Eine Aufgabe besitzt mindestens:

- Titel
- Erledigt-Status

Optional:

- Beschreibung
- Checkliste
- Abschlussdatum

Aufgaben können:

- erstellt
- bearbeitet
- verschoben
- gelöscht
- abgeschlossen

werden.

---

# Kernaufgaben

Kernaufgaben beschreiben die eigentlichen Arbeitsschritte eines Projekts.

Sie fließen vollständig in den Projektfortschritt ein.

Der Fortschritt eines Projekts basiert hauptsächlich auf den Kernaufgaben.

---

# Extra-Aufgaben

Extras sind optionale Aufgaben.

Sie stellen zusätzliche Verbesserungen dar.

Extras besitzen:

- eigenen Fortschritt
- eigene Anzeige

Sie beeinflussen den Hauptfortschritt nicht.

Dadurch bleibt der eigentliche Projektfortschritt aussagekräftig.

---

# Unterprojekte

Ein Projekt kann beliebig viele Unterprojekte besitzen.

Ein Unterprojekt besitzt:

- Titel
- Aufgaben
- Fortschritt

Unterprojekte dienen zur logischen Strukturierung größerer Projekte.

Sie besitzen keine eigene Detailseite.

---

# Fortschritt

Der Projektfortschritt berechnet sich automatisch.

Berücksichtigt werden:

- Kernaufgaben
- Aufgaben der Unterprojekte

Extras werden separat berechnet.

---

# Projektdetailseite

Jedes Projekt besitzt eine eigene Detailansicht.

Sie besteht aus:

- Hero
- Projektbaum
- Informationskarte
- Aufgabenbereich

Diese Ansicht dient als Arbeitsbereich des Projekts.

---

# Hero

Der Hero zeigt die wichtigsten Informationen des Projekts.

Dazu gehören:

- Projektname
- Beschreibung
- Status
- Fortschritt
- Projektlandschaft

Die Landschaft dient ausschließlich der Atmosphäre.

---

# Informationskarte

Die Informationskarte zeigt unter anderem:

- Status
- Startdatum
- Fälligkeitsdatum
- Unterprojekte

Weitere Informationen können später ergänzt werden.

---

# Aufgabenbereich

Der untere Bereich der Detailseite zeigt sämtliche Aufgaben.

Aufgaben sind nach Bereichen organisiert.

Dazu gehören:

- Hauptprojekt
- Unterprojekte
- Extras

Jeder Bereich besitzt:

- Fortschrittsbalken
- Aufgabenliste
- Hinzufügen-Button

---

# Projektwald

Der Projektwald ist die einzige Übersichtsansicht (siehe Hauptbereiche oben).

Er visualisiert jedes Projekt als Baum vor einer illustrierten Waldlandschaft (`img/forest/forest.png`).

Implementiert in `forest.js` (Projektwald-Ansicht, Projektdetailseite) und `project-tree.js` (PNG-Baumvarianten-Zuweisung + Detailbaum-Rendering) — `projects.js` selbst rendert keine Übersicht mehr, siehe Zuständigkeiten unten.

Die Wald-Übersicht hat keinen gemeinsamen Hintergrundbalken mehr: Tabs (Alle/Aktiv/Abgeschlossen — Abgeschlossen = archivierte Projekte), Suchfeld und Prioritäts-Filter-Button sind einzelne, schwebende Glas-Pills direkt über der Landschaft (`.forest-toolbar` ist nur noch ein transparenter Layout-Wrapper). Diese Filter beeinflussen nur, welche Bäume angezeigt werden — Archivstatus, Suche & Filter sind reine Anzeigefilter der Waldansicht und verändern keine Projektdaten. Die Bäume stehen in vier festen Tiefenreihen (3/4/3/4, hinterste bis vorderste Reihe, `FOREST_ROW_COUNTS`/`generateForestSlots()`): Reihe bestimmt zuerst die Position (zentriert, mit der Tiefe wachsender Baumabstand), erst danach wird die Größe aus der Tiefe abgeleitet (hinten kleiner & enger, vorne größer & mit deutlich mehr Abstand) — keine Zufallspositionen. Unter jedem Baum sitzt eine schlichte Karte (Statuspunkt, Name, Fortschrittsbalken, Prozentwert) — ohne Äpfel/Blüten, die bleiben der Projektdetailseite vorbehalten. Die Legende unten zeigt nur noch Aktives/Abgeschlossenes Projekt + Hover-Hinweis, passt sich in der Breite an ihren Inhalt an und beansprucht nicht mehr die volle Breite.

---

# Projektbaum

Waldübersicht und Projektdetailseite zeigen **denselben** PNG-Baum pro Projekt — kein separates SVG-System mehr für die Detailseite.

PNG-Bäume aus `img/trees/tree_<n>.png` (aktives Projekt) bzw. `img/trees/tree_<n>_fall.png` (abgeschlossenes/archiviertes Projekt), `n` = 1–5. Jedes Projekt bekommt beim ersten Rendern per `getOrAssignTreeVariant()` (`project-tree.js`) dauerhaft eine der 5 Varianten zugewiesen (`project.treeVariant`) und behält sie — dieselbe Variante wird von `buildForestTree()` (Waldübersicht) und `updateDetailTreeElements()` (Detailseite) verwendet. Fehlt eine PNG-Datei, fällt der `<img>`-`onerror`-Handler automatisch auf Variante 1 zurück — weitere Varianten lassen sich also einfach durch Ablegen zusätzlicher PNGs ergänzen.

Auf der Detailseite (Hero, ca. 60vh hoch, Baum ca. 50% größer als in der Waldübersicht und mittig im sichtbaren Bereich der Baumspalte zentriert) werden erledigte Aufgaben als Deko auf die Baumkrone gelegt: Obst für erledigte Kernaufgaben, Blumen für erledigte Extraaufgaben (welche Sorte je Aufgabenart wählbar ist, konfiguriert das Customizing-Modal, `DECOR_REGISTRY`/`DECOR_META`/`DECOR_FILES` in `project-tree.js` — Dateien nach dem Muster `{name}_{farbe}.png` werden dort automatisch als Farbvarianten einer Sorte gruppiert). Die Positionen streuen deterministisch (Seed = Aufgaben-ID, nicht Projekt-ID — bleibt dadurch stabil, wenn andere Aufgaben (ab)gehakt werden) innerhalb einer Ellipse, die konservativ innerhalb der Krone aller 5 Varianten bleibt (`CANOPY_ELLIPSE`, `pickCanopySlot()`), mit Mindestabstand zwischen gleichzeitig sichtbaren Objekten (`DECOR_MIN_DIST`) gegen Überlappungen — Stamm/Boden bleiben immer frei. Gedeckelt bei je 8 Stück; rein dekorativ, nicht 1:1 mit einzelnen Aufgaben klickbar.

Die eigentliche Aufgaben-Interaktion (abhaken, Details öffnen, Unterprojekte/„Äste" verwalten) läuft ausschließlich über die Kacheln im Aufgabenbereich (`renderDetailTiles()`), nicht über den Baum.

---

# Archiv

Abgeschlossene Projekte können archiviert werden.

Archivierte Projekte:

- erscheinen nicht mehr in der normalen Übersicht
- bleiben vollständig erhalten
- können wiederhergestellt werden
- können endgültig gelöscht werden

---

# Bearbeitung

Projekte können:

- erstellt
- bearbeitet
- archiviert
- wiederhergestellt
- gelöscht

werden.

---

# Inline-Bearbeitung

Aufgaben können direkt bearbeitet werden.

Ein Doppelklick öffnet die Bearbeitung ohne separates Fenster.

Dadurch bleiben Änderungen schnell und unkompliziert.

---

# Verschieben

Aufgaben können zwischen Bereichen verschoben werden.

Mögliche Ziele:

- Kernaufgaben
- Extras
- Unterprojekte

Dadurch kann die Projektstruktur jederzeit angepasst werden.

---

# Speicherung

Projects speichert unter anderem:

- Projekte
- Aufgaben
- Unterprojekte
- Fortschritt
- Archivstatus
- Priorität
- Fälligkeitsdatum
- Änderungsdatum

Alle Daten werden lokal gespeichert.

---

# Zuständigkeiten

Der Bereich ist auf drei Dateien aufgeteilt:

- **projects.js** — Projektverwaltung, Aufgabenverwaltung, Unterprojekte, Fortschrittsberechnung, Archiv, Modalfenster (Projekt/Aufgabe/Unterprojekt/Verschieben), Inline-Bearbeitung. `renderProjects()` ist hier nur noch ein Dispatch auf `renderForest()` (forest.js) — keine eigene Kartenübersicht mehr.
- **forest.js** — Projektwald-Ansicht (Landschaft, Baum-Positionen, Tabs/Suche/Filter, Legende) und Projektdetailseite (Hero, Informationskarte, Aufgabenbereich)
- **project-tree.js** — PNG-Baumvarianten-Zuweisung (`getOrAssignTreeVariant`, gemeinsam für Waldübersicht + Detailseite) und Detailbaum-Rendering (`updateDetailTreeElements`, PNG + Apfel/Blüten-Deko), von forest.js verwendet

`projects.js` greift auf `currentDetailProject`/`renderProjectDetail()` aus `forest.js` zu, um nach dem Speichern ggf. die Detailseite neu zu rendern — das ist die einzige direkte Verbindung zwischen den Dateien.

Nicht verantwortlich für:

- Kalender
- Budget
- Today
- Games
- Bibliothek

---

# Datenmodell

Projects verwaltet unter anderem:

- Projekte
- Aufgaben
- Unterprojekte
- Extras
- Checklisten
- Archivstatus
- Prioritäten
- Fälligkeiten
- Fortschritt

Andere Module dürfen diese Informationen lesen.

Projects bleibt die einzige Quelle für Projektdaten.

---

# Erweiterungsregeln

Neue Funktionen sollen:

✔ große Projekte besser strukturieren

✔ vorhandene Datenmodelle erweitern

✔ den Projektbaum sinnvoll ergänzen

✔ den gemütlichen Charakter des Personal Hub erhalten

✔ bestehende Projekte kompatibel halten

Neue Funktionen sollen nicht:

✖ klassische Business-Projektverwaltung nachbilden

✖ Kanban ersetzen

✖ Kalenderfunktionen übernehmen

✖ doppelte Aufgabenverwaltung einführen

✖ den Projektwald als einzige Ansicht voraussetzen

---

# Zukunft

Geplante Erweiterungen:

- Projektbaum vollständig fertigstellen
- Projekt-Meilensteine
- Abhängigkeiten zwischen Aufgaben
- Projektvorlagen
- Tags
- Filter
- Suche
- Projektnotizen
- Dateianhänge
- Zeitplanung
- Fortschrittsverlauf
- automatische Projektstatistiken

---

# Bekannte Erweiterungspunkte

Neue Komponenten dürfen ergänzt werden:

- Projektdetailseite
- Informationskarte
- Aufgabenbereich
- Archiv
- Projektstatistik
- Projektwald

Neue Informationen dürfen ergänzt werden:

- Projektnotizen
- Meilensteine
- Tags
- Anhänge
- Zeitaufwand
- Projektaktivität

Der Projektbaum darf während der Entwicklung erweitert oder verändert werden, solange seine Funktion als motivierende Visualisierung erhalten bleibt.

---

# Entwicklungsrichtlinien

Bei Änderungen an Projects gelten folgende Regeln:

- Bestehendes Verhalten darf nicht ohne ausdrücklichen Auftrag verändert werden.
- Neue Funktionen sollen bestehende Datenmodelle erweitern statt ersetzen.
- Der Projektbaum befindet sich in aktiver Entwicklung und darf weiter ausgebaut werden.
- Bereits gespeicherte Projekte müssen weiterhin kompatibel bleiben.
- Projects bleibt die einzige Quelle für Projektverwaltung innerhalb des Personal Hub.