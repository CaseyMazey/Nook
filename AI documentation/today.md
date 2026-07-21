# Today.md

Version: 1.0

---

# Zweck

Der Today-Tab ist die persönliche Startseite des Personal Hub.

Er soll dem Nutzer innerhalb weniger Sekunden einen Überblick über den heutigen Tag geben.

Der Fokus liegt auf:

- Heute
- Jetzt
- Die nächsten Stunden

Nicht auf langfristiger Planung.

Dafür existieren Kalender, Projekte und Budget.

---

# Designprinzip

Der Today-Tab soll sich wie ein ruhiges persönliches Dashboard anfühlen.

Keine Gamification.

Keine überladenen Widgets.

Keine unnötigen Animationen.

Alle Informationen sollen sofort erfassbar sein.

---

# Hauptbereiche

Der Today-Tab besteht aus folgenden Bereichen:

1. Begrüßungsheader
2. Zeitblöcke
3. Aufgaben
4. Informationskacheln
5. Rechte Sidebar

Diese Struktur soll grundsätzlich erhalten bleiben.

---

# Komponenten

## Begrüßungsheader

Enthält:

- Begrüßung
- Benutzername
- Datum
- Kalenderwoche
- Wetter
- Uhr

Der Header bildet den Einstieg in den Tag.

---

## Zeitblöcke

Zeigt den Tagesablauf.

Jeder Block besitzt:

- Uhrzeit
- Titel
- Aufgaben
- Status

Der aktuelle Block wird hervorgehoben.

Freie Blöcke werden anders dargestellt.

---

## Aufgaben

Zeigt ausschließlich relevante Aufgaben.

Sortierung:

1. offene Aufgaben
2. erledigte Aufgaben

Aufgaben können:

- Priorität besitzen
- mehreren Blöcken zugeordnet sein
- Notizen enthalten

---

## Informationskacheln

Die Kacheln dienen als flexible Informationsfläche.

Es existieren feste und benutzerdefinierte Kacheln.

Beispiele:

- Wichtiges
- Fragen
- Berichtsheft
- To Do
- Einkaufsliste
- Begriffe

Benutzer können zusätzlich eigene Kacheln erstellen.

---

## Rechte Sidebar

Die Sidebar enthält ausschließlich Informationen, die häufig benötigt werden.

Aktuell:

- Analoge Uhr
- Schnellnotiz
- Mini-Kalender
- Nationaler Tag
- Countdowns

---

# Mini-Kalender

Der Mini-Kalender ist eine kompakte Vorschau.

Er unterstützt:

- normale Termine
- mehrtägige Termine
- wiederkehrende Termine

Beim Anklicken eines Tages öffnet sich das Tagesmodal des Kalenders.

Der Mini-Kalender besitzt keine eigene Terminverwaltung.

Er verwendet ausschließlich Daten aus dem Kalender-Modul.

---

# Wetter

Das Wetter verwendet Open-Meteo.

Unterstützt:

- GPS
- manuelle Stadt

Es wird ausschließlich das aktuelle Wetter angezeigt.

Keine Vorhersage.

---

# Schnellnotiz

Eine einzige Notiz.

Gedacht für:

- spontane Gedanken
- Telefonnummern
- kleine Erinnerungen

Nicht als Aufgabenverwaltung.

---

# Berichtsheft

Besteht aus:

- Betrieb
- Berufsschule

Speichert Texte automatisch.

---

# To-Do

Einfache persönliche Aufgaben.

Nicht identisch mit Projektaufgaben.

Nicht identisch mit Kalenderaufgaben.

---

# Einkaufsliste

Unabhängig von allen anderen Modulen.

Soll bewusst einfach bleiben.

---

# Benutzerdefinierte Kacheln

Nutzer können:

- neue Kacheln erstellen
- Listen
- Freitext

Jede Kachel besitzt:

- Titel
- Typ
- Farbe
- Dekoration

---

# Kachel-Designer

Jede Kachel kann individuell gestaltet werden.

Unterstützt:

- Hintergrundfarbe
- Washi Tape
- Büroklammer
- abgeknickte Ecke

Diese Anpassungen sind rein optisch.

---

# Zuständigkeiten

today.js ist verantwortlich für:

- Rendering
- Wetter
- Uhr
- Zeitblöcke
- Today-Aufgaben
- Schnellnotizen
- Mini-Kalender
- Sidebar
- Benutzerdefinierte Kacheln

Nicht verantwortlich für:

- Kalenderlogik
- Budget
- Projekte
- Spiele
- Bibliothek

---

# Erweiterungsregeln

Neue Features sollen:

✔ den heutigen Tag unterstützen

✔ den Tagesüberblick verbessern

✔ ohne Scrollen sichtbar bleiben

✔ bestehende Komponenten wiederverwenden

Neue Features sollen nicht:

✖ den Kalender ersetzen

✖ Projektfunktionen übernehmen

✖ Budgetfunktionen übernehmen

✖ die Sidebar überladen

✖ mehr als eine zusätzliche Hauptsektion hinzufügen

---

# Datenquellen

Today liest Daten aus:

- Kalender
- Aufgaben
- Wetter
- Einstellungen
- Benutzer
- LocalStorage

Today erzeugt selbst nur Today-spezifische Daten.

---

# Zukunft

Geplante Erweiterungen:

- Tagesziele
- Fokusmodus

---

# Bekannte Erweiterungspunkte

Hier dürfen neue Widgets ergänzt werden:

- rechte Sidebar
- Informationskacheln
- Header

Hier dürfen keine Widgets ergänzt werden:

- zwischen Zeitblöcken
- innerhalb des Mini-Kalenders
- innerhalb der Aufgabenliste