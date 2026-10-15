# Guides.md

Version: 1.0

---

# Zweck

Guides ist die persönliche Wissensbibliothek des Personal Hub.

Sie dient zum langfristigen Sammeln von Dokumentationen, Codebeispielen, Tutorials und eigenem Wissen.

Im Gegensatz zu Flashcards steht hier nicht das Lernen durch Wiederholung im Mittelpunkt, sondern das strukturierte Nachschlagen von Informationen.

---

# Ziele

Guides soll:

- eigenes Wissen dauerhaft dokumentieren
- häufig benötigte Codebeispiele speichern
- persönliche Tutorials verwalten
- Informationen schnell wiederfinden
- Markdown vollständig unterstützen
- sich wie ein kleines digitales Bücherregal anfühlen

---

# Designprinzip

Guides orientiert sich bewusst an einer kleinen Bibliothek.

Keine Listen voller Dateien.

Keine Ordnerstruktur.

Keine technische Dokumentationssoftware.

Stattdessen:

- Bücherregal
- Kapitel
- ruhige Farben
- angenehmes Lesen
- Fokus auf Inhalt

---

# Hauptbereiche

Guides besteht aus:

1. Bücherregal
2. Buchansicht
3. Kapitel
4. Detailansicht
5. Seitenleiste

---

# Bücher

Ein Buch dient als oberste Organisationsebene.

Ein Buch besitzt mindestens:

- Name
- Einbandfarbe

Intern besitzt ein Buch außerdem:

- Kapitel
- Featured Snippet
- Statistiken

Jedes Buch kann beliebig viele Kapitel enthalten.

---

# Bücherregal

Alle Bücher werden als stehende Buchrücken dargestellt.

Jedes Buch zeigt:

- Titel
- Anzahl Kapitel
- zuletzt geöffnet

Ein ausgewähltes Buch wird leicht hervorgehoben.

Optional kann zwischen Regalansicht und Listenansicht gewechselt werden.

---

# Farben

Jedes Buch besitzt eine individuelle Farbe.

Beim Erstellen kann:

- eine beliebige Farbe gewählt werden
- eine Farbe zur persönlichen Bibliothek hinzugefügt werden

Farben werden dauerhaft gespeichert und können für weitere Bücher wiederverwendet werden.

Name und Farbe eines Buches lassen sich nachträglich über „Buch bearbeiten" in der Kapitelübersicht ändern.

Gelöscht wird ein Buch ebenfalls nur dort (nicht direkt im Regal) und in zwei Schritten: zuerst wird ein Backup-Export angeboten, danach folgt die eigentliche Sicherheitsabfrage.

---

# Kapitel

Kapitel entsprechen einzelnen Dokumentationen.

Ein Kapitel besitzt mindestens:

- Titel
- Markdown-Inhalt

Optional:

- Beschreibung
- Tags
- Favorit

Intern werden zusätzlich gespeichert:

- Erstellungsdatum
- Änderungsdatum
- letzter Aufruf
- Anzahl Aufrufe

---

# Kapitelübersicht

Nach Auswahl eines Buches werden sämtliche Kapitel angezeigt.

Jedes Kapitel zeigt:

- Kapitelnummer
- Titel
- Favoritenstatus

Kapitel können:

- geöffnet
- favorisiert
- bearbeitet
- gelöscht
- exportiert werden.

Die Reihenfolge der Kapitel lässt sich per Drag & Drop am Griff (⋮⋮) ändern — mit Maus, Touch oder Pfeiltasten.

---

# Detailansicht

Beim Öffnen eines Kapitels erscheint die vollständige Dokumentation.

Die Ansicht enthält:

- Titel
- Beschreibung
- Tags
- Metadaten
- Markdown-Inhalt

Ab zwei Überschriften erscheint ein Inhaltsverzeichnis (Seitenleiste; auf schmalen Bildschirmen über dem Inhalt).

Über das Kapitelmenü kann das Kapitel gedruckt bzw. als PDF gespeichert werden. Gedruckt wird nur der Kapitelinhalt.

---

# Markdown

Guides unterstützt unter anderem:

- Überschriften
- Listen
- Tabellen
- Links
- Fett
- Kursiv
- Markierungen
- Inline-Code
- Codeblöcke
- Trennlinien
- Querverweise zwischen Kapiteln

Markdown wird automatisch gerendert.

---

# Querverweise

Kapitel können aufeinander verweisen:

- `[[Kapitel]]` — sucht zuerst im aktuellen Buch, dann in allen Büchern
- `[[Buch/Kapitel]]` — legt das Buch fest
- `[[Kapitel|Anzeigetext]]` — eigener Linktext

Verweise hängen am Titel. Existiert das Ziel nicht (mehr), wird der Verweis als „nicht gefunden" markiert.

---

# Codeblöcke

Codeblöcke besitzen eine eigene Darstellung.

Sie zeigen:

- Programmiersprache
- Kopierbutton
- Bookmark
- Featured-Snippet-Stern

Codeblöcke werden automatisch erkannt.

Gängige Sprachen (u. a. JavaScript/TypeScript, Python, Bash/PowerShell, HTML/XML, CSS, JSON, SQL, C-artige Sprachen) erhalten ein schlankes, eigenes Syntax-Highlighting ohne externe Bibliothek. Unbekannte Sprachen bleiben ungefärbt.

---

# Code kopieren

Jeder Codeblock besitzt einen Kopierbutton.

Beim Anklicken wird der komplette Codeblock in die Zwischenablage kopiert.

Anschließend erscheint eine kurze Bestätigung.

---

# Code-Bookmarks

Beliebige Codeblöcke können als Bookmark markiert werden.

Bookmarks dienen dazu:

- häufig verwendete Snippets schneller wiederzufinden
- innerhalb langer Dokumentationen zu navigieren

Bookmarks verändern den Inhalt eines Guides nicht.

---

# Bookmark-Navigation

Während ein Kapitel geöffnet ist, erscheint eine Bookmark-Karte in der Seitenleiste.

Sie zeigt:

- Anzahl Bookmarks
- Navigation zwischen Bookmarks
- Liste aller gespeicherten Bookmarks

Beim Anklicken wird automatisch zum entsprechenden Codeblock gescrollt.

---

# Featured Snippet

Jedes Buch kann genau ein Featured Snippet besitzen.

Dieses stammt aus einem beliebigen Codeblock eines Kapitels.

Das Featured Snippet erscheint dauerhaft in der Seitenleiste des Buches.

Es dient als Schnellzugriff auf besonders häufig verwendeten Code.

---

# Seitenleiste

Die Seitenleiste zeigt Informationen zum aktuellen Buch.

Unter anderem:

- Erstellungsdatum
- letzte Änderung
- letzter Aufruf
- Anzahl Kapitel
- Favoriten
- meist gelesenes Kapitel
- Featured Snippet

Beim Öffnen eines Kapitels werden zusätzlich die Bookmarks angezeigt.

---

# Suche

Die Suchfunktion durchsucht sämtliche Kapitel.

Gesucht wird in:

- Titel
- Beschreibung
- Inhalt
- Tags

Die Ergebnisse erscheinen sofort während der Eingabe.

Die Seitenleiste zeigt währenddessen die Treffer je Buch sowie Codeblöcke, die den Suchbegriff enthalten — direkt kopierbar.

---

# Favoriten

Kapitel können als Favorit markiert werden.

Favoriten dienen ausschließlich der persönlichen Organisation.

Sie beeinflussen keine anderen Funktionen.

---

# Editor

Kapitel werden in einem integrierten Markdown-Editor erstellt.

Der Editor besitzt:

- Bearbeitungsmodus
- geteilte Ansicht (Editor und Live-Vorschau nebeneinander)
- Vorschau

Die zuletzt genutzte Ansicht wird gemerkt. Ungespeicherte Änderungen werden vor dem Schließen abgefragt.

Zusätzlich stehen Schnellbausteine zur Verfügung.

---

# Schnellbausteine

Folgende Elemente können per Klick eingefügt werden:

- Überschrift
- Unterüberschrift
- Codeblock
- Liste
- Fett
- Markierung
- Trennlinie
- Querverweis

Markierter Text wird vom Baustein eingerahmt. Die Bausteine dienen ausschließlich als Schreibunterstützung.

---

# Vorschau

Der Vorschaumodus verwendet denselben Renderer wie die Detailansicht.

Dadurch entspricht die Vorschau jederzeit exakt dem späteren Ergebnis.

---

# Export

Einzelne Kapitel können als Markdown-Datei exportiert werden.

Exportiert werden:

- Titel
- Beschreibung
- Tags
- Favorit
- Erstellungs- und Änderungsdatum
- Inhalt

Die Metadaten werden als Front Matter gespeichert und beim Import wieder übernommen.

Ganze Bücher lassen sich als Backup-Datei (`.nook-buch.json`) exportieren — mit allen Kapiteln, Statistiken, Featured Snippet und Code-Bookmarks. Beim Import entsteht immer ein neues Buch; vorhandene Bücher werden nie überschrieben.

---

# Import

Markdown-Dateien können in ein Buch importiert werden.

Unterstützt werden:

- einzelne Dateien
- mehrere Dateien gleichzeitig

Vorhandenes Front Matter wird automatisch übernommen.

Fehlende Informationen werden ergänzt.

---

# Speicherung

Guides speichert unter anderem:

- Bücher
- Farben
- Kapitel
- Markdown
- Tags
- Favoriten
- Statistiken
- Featured Snippet
- Code-Bookmarks
- persönliche Farbpalette

Alle Daten werden lokal gespeichert.

---

# Zuständigkeiten

guides.js ist verantwortlich für:

- Bücher
- Kapitel
- Markdown-Renderer
- Editor
- Live-Vorschau
- Suche
- Favoriten
- Bookmarks
- Featured Snippets
- Export
- Import
- Statistiken

Nicht verantwortlich für:

- Flashcards
- Projekte
- Kalender
- Games
- Budget

---

# Datenmodell

Guides verwaltet:

- Bücher
- Kapitel
- Markdown-Inhalte
- Tags
- Favoriten
- Bookmarks
- Featured Snippets
- Farbpalette
- Nutzungsstatistiken

Andere Module dürfen diese Daten lesen.

Guides bleibt die einzige Quelle für Dokumentationen.

---

# Erweiterungsregeln

Neue Funktionen sollen:

✔ das Schreiben vereinfachen

✔ das Lesen angenehmer machen

✔ Markdown vollständig unterstützen

✔ bestehende Dokumentationen kompatibel halten

✔ den Bibliothekscharakter erhalten

Neue Funktionen sollen nicht:

✖ zu einer klassischen Wiki-Software werden

✖ unnötig komplex werden

✖ den Fokus von Dokumentationen auf Aufgaben verschieben

✖ bestehende Guides inkompatibel machen

---

# Zukunft

Geplante Erweiterungen:

- Bilder in Markdown
- Kapitel-Untergliederung
- Versionsverlauf
- Anhänge
- Code-Ausführung für unterstützte Sprachen
- Cloud-Synchronisation

---

# Entwicklungsrichtlinien

Bei Änderungen an Guides gelten folgende Regeln:

- Guides bleibt die zentrale Wissensbibliothek des Personal Hub.
- Markdown bleibt das primäre Dokumentationsformat.
- Bestehende Dokumentationen müssen kompatibel bleiben.
- Neue Funktionen sollen den Schreib- und Lesefluss verbessern.
- Die Bibliotheksoptik und der ruhige Charakter bleiben erhalten.