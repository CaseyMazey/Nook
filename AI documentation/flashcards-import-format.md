# Karteikarten-Import: Markdown-Format

Version: 1

Dieses Format liest der Import im Karteikarten-Tab (`js/flashcards-import.js`, Knopf „⬆ Import“).
Es ist bewusst einfach und stabil gehalten, damit es auch später (z. B. für „Flashcard Battle“) weiterverwendet werden kann.
Änderungen am Format nur abwärtskompatibel: alte Dateien müssen immer importierbar bleiben.

---

# Aufbau

| Markdown | wird in Nook zu |
|---|---|
| `# Name` | Fach |
| `Lehrer: Name` (direkt unter `#`, optional) | Lehrer des Fachs |
| `## Name` | Themengruppe im Fach |
| `### Text` | eine Karte, der Text ist die Vorderseite |
| alles unter `###` bis zur nächsten `#`/`##`/`###`-Überschrift | Rückseite der Karte |

- Die Vorderseite ist genau eine Zeile.
- Die Rückseite darf mehrere Zeilen, Listen, `####`-Zwischentitel, **fett** und Code-Blöcke enthalten. Sie wird als Text (roher Markdown) gespeichert.
- Innerhalb von Code-Blöcken (```` ``` ```` oder `~~~`) zählen `#`-Zeilen nicht als Überschrift.
- Leere Zeilen am Anfang und Ende einer Rückseite werden entfernt, Einrückungen bleiben erhalten.
- HTML-Kommentare in eigener Zeile (`<!-- … -->`) außerhalb von Karten werden ignoriert.
- Eine Datei darf mehrere Fächer und Themengruppen enthalten. Gleich benannte Fächer/Gruppen werden zusammengeführt.

---

# Verhalten beim Import

- Vorschau vor dem Speichern: Anzahl neuer und doppelter Karten pro Fach und Themengruppe, plus Hinweise.
- Ziel pro Fach wählbar: neues Fach anlegen oder in ein bestehendes Fach einfügen. Ein Fach mit gleichem Namen (Groß-/Kleinschreibung egal) ist vorausgewählt.
- Themengruppen werden über den Namen zugeordnet. Fehlt die Gruppe im Ziel-Fach, wird sie neu angelegt.
- Doppelte Karten (gleiche Vorderseite in derselben Themengruppe, Groß-/Kleinschreibung und Leerraum egal) werden übersprungen, auch innerhalb derselben Datei.
- Neue Karten starten in Leitner-Box 1, ohne Statistik, nicht als schwierig markiert.
- Übersprungen (mit Hinweis): Karten ohne Rückseite, Karten vor dem ersten `##`, Text außerhalb einer Karte. `##` ohne vorheriges `#` landet im Fach „Import“.

---

# Vorlage für Claude

Diesen Text kann man Claude zusammen mit einem Lernzettel geben. Derselbe Text steckt im Import-Fenster hinter „📋 Format/Vorlage kopieren“ (`FC_IMPORT_TEMPLATE` in `js/flashcards-import.js`; bei Änderungen beide Stellen anpassen).

````text
Erstelle mir zu diesem Lernzettel eine Markdown-Datei mit Karteikarten für meine App Nook. Halte dich genau an dieses Format:

# Fachname
Lehrer: Name (optional, diese Zeile kann fehlen)

## Themengruppe

### Frage oder Begriff (Vorderseite, genau eine Zeile)
Antwort (Rückseite). Darf mehrere Zeilen, Listen und Code enthalten
und geht bis zur nächsten Überschrift.

### Nächste Frage
- Listenpunkt
- Listenpunkt

Regeln:
- "#" = Fach, "##" = Themengruppe, "###" = eine Karte. Jede Karte steht unter einem "##".
- Die Vorderseite ist die "###"-Zeile, die Rückseite ist alles darunter bis zur nächsten "#", "##" oder "###"-Überschrift.
- In Antworten keine Überschriften mit 1–3 "#" verwenden (für Zwischentitel "####" oder **fett**).
- Code in Antworten als Code-Block mit ``` – darin dürfen auch #-Zeilen stehen.
- Jede Vorderseite pro Themengruppe nur einmal, kurz und eindeutig formulieren.
- Antworten knapp halten: das Wichtigste zuerst, lieber mehrere kleine Karten als eine riesige.
- Nur die Markdown-Datei ausgeben, keine Einleitung, keine Erklärung davor oder danach.

Beispiel:

# LF 3 Netzwerke
Lehrer: Herr Müller

## Subnetting

### Wie viele nutzbare Hosts hat ein /26-Netz?
62 Hosts: 2^6 = 64 Adressen, minus Netz- und Broadcastadresse.

### Wofür steht CIDR?
Classless Inter-Domain Routing
````
