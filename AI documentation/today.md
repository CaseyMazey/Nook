# Today.md

Version: 1.1

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
4. Rechte Sidebar

Diese Struktur soll grundsätzlich erhalten bleiben.

Hinweis: Freie Informationskacheln (Wichtiges, Fragen, Berichtsheft, To-Do, Einkaufsliste, benutzerdefinierte Kacheln) gehörten früher zu Today, sind aber inzwischen ein eigener Tab — siehe Abschnitt "Verschoben nach Pinnwand".

---

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

## Rechte Sidebar

Die Sidebar enthält ausschließlich Informationen, die häufig benötigt werden.

Aktuell:

- Analoge Uhr
- Schnellnotiz
- Speiseplan
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

**↗ Ablegen** (js/today-quicknote-send.js): markierter Text oder die ganze Notiz wird beim zuständigen Tab abgelegt — als Pinnwand-Karte (erste Zeile = Titel), als Projektaufgabe(n) oder Wochenaufgabe(n) (eine pro Zeile, Aufzählungszeichen werden entfernt). Angelegt wird über die Funktionen des Ziel-Tabs (`addDeskCardFromText` in pinboard.js, `addProjectTasksFromLines` in projects.js) in dessen Datenformat; die Heute-Seite übernimmt dabei keine Pinnwand- oder Projektfunktionen. Danach wird der Text standardmäßig aus der Schnellnotiz entfernt (abschaltbar), ein kurzer Link im Kopf führt zum Ziel.

---

# Speiseplan

Zeigt Menü 1–3 und Dessert der Kantine für heute (am Wochenende: Montag), mit Pfeilen zu anderen Wochentagen.

Quelle ist das wöchentliche Speiseplan-PDF aus Dock B (Browser-Export einer Intrexx-Tabelle mit Textebene). Der Nutzer gibt es per Button oder Drag & Drop, Nook liest es lokal mit pdf.js (lazy von cdnjs geladen) und zeigt das Ergebnis zur Kontrolle im Modal, bevor gespeichert wird. Ohne Internet bleibt das Modal zum Eintragen von Hand.

Code: `js/today-mealplan.js`, DB-Key `mealPlanWeeks` (nach Montag der Woche; es wird immer nur die aktuelle Woche gehalten, Speichern ersetzt die vorige).

Keine Suppen, Beilagen oder Allergene — bewusst nur, was für die Essensauswahl gebraucht wird.

---

# RPG-Stil: „Der Schreibtisch des Reisenden“

Im Heute-Stil `rpg` (Theme-Engine, `data-today-style="rpg"`, css/today-rpg.css) ist Heute ein eigener Ort statt Zettel auf Brettern: eine Mahagoni-Tischplatte (nur Heute hat sie), auf der jedes Widget ein **anderer Gegenstand** ist — Aufgaben als aufgeschlagenes Reisetagebuch (zwei Bildhälften, Liste läuft über beide Seiten), Unterrichtsblöcke als Messingschilder, Speiseplan als Kreidetafel, Gruppenpflichten als Brief mit Wachssiegel, Schnellnotiz als Notizblatt, Mini-Kalender als Abreißkalender, Uhr als astronomische Taschenuhr. Alle Gegenstände sind generierte Bilder (`assets/today/`) als mitwachsende 9-Slice-Rahmen — das Layout und alle Funktionen bleiben unverändert, nur die Optik wechselt.

Regel für neue Widgets im RPG-Stil: lieber ein eigener Gegenstand als noch ein Pergament-Zettel; keine Szene, in die Inhalte gequetscht werden.

Ohne Scrollen: Ab 1500 px Breite stehen die Widgets der rechten Spalte im RPG-Stil in zwei Stapeln nebeneinander (Uhr · Schnellnotiz · Kalender | Speiseplan · Heute ist). Die Stapel-Container legt `initTodayRightStacks()` in js/today.js an; in allen anderen Stilen sind sie `display: contents` mit fester `order`, das Layout bleibt dort unverändert. Neue Widgets der rechten Spalte in `TODAY_RIGHT_STACKS` eintragen (sonst Stapel 2).

---

# Verschoben nach Pinnwand

Folgende Bereiche gehörten ursprünglich zu Today, wurden aber in einen eigenständigen Pinnwand-Tab ausgelagert (siehe README: "früher Teil von 'Heute', jetzt ein eigener Tab mit mehr Platz"):

- Informationskacheln (freie Kartenfläche)
- Berichtsheft (Betrieb/Berufsschule)
- To-Do
- Einkaufsliste
- Wichtiges, Fragen für den Unterricht, Begriffe & Definitionen
- benutzerdefinierte Kacheln inkl. Kachel-Designer (Hintergrundfarbe, Washi Tape, Büroklammer, abgeknickte Ecke)

Today besitzt hierfür keine eigene Logik mehr. Neue Kartentypen oder Kachel-artige Funktionen gehören in die Pinnwand, nicht in Today.

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
- Speiseplan (today-mealplan.js)
- Sidebar

Nicht verantwortlich für:

- Kalenderlogik
- Budget
- Projekte
- Spiele
- Bibliothek
- Pinnwand (freie Karten, Berichtsheft, To-Do, Einkaufsliste, benutzerdefinierte Kacheln — siehe `pinboard.js`)

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

✖ freie Karten/Kacheln zurück nach Today verlagern (gehören zur Pinnwand)

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
- Header

Hier dürfen keine Widgets ergänzt werden:

- zwischen Zeitblöcken
- innerhalb des Mini-Kalenders
- innerhalb der Aufgabenliste
