# Today.md

Version: 1.2

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
3. Aufgaben (darunter die Gruppenpflichten)
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
- optional: Fortschritts-Tracker (z.B. „Ausbildung 64 / 156 Wochen“, js/today-tracker.js)
- optional: „📅 Heute“ — die heutigen Termine aus dem Kalender (js/today-events.js, Key `todayEventsDue`)
- optional: „💶 Heute fällig“ — heute anstehende Budget-Posten (js/today-budget.js, Key `todayBudgetDue`)

Die drei optionalen Zeilen sind nur lesend und lassen sich unter Einstellungen → Heute-Seite abschalten; ein Klick führt in den zuständigen Tab (Kalender-Tagesfenster bzw. Budget). Die Uhr steht in der rechten Spalte.

Der Header bildet den Einstieg in den Tag.

---

## Zeitblöcke (Stundenplan)

Zeigt den Tagesablauf des **angezeigten Wochentags** — jeder Wochentag hat eine eigene Struktur (js/schedule.js, bearbeitet in js/schedule-editor.js: Einstellungen → Stundenplan oder ✎ über der Zeitleiste).

Ein Tag besteht aus:

- Tagesrahmen (Beginn/Ende) — außerhalb ist Feierabend
- optional Schulzeit, darin Unterrichtsstunden (Fach, Lehrkraft, Raum, Thema)
- Pausen
- Projekt-/Arbeitsblöcke (bestehendes Projekt oder Aktivität: Lernen, Organisation, Sonstiges, Freie Zeit)

Die Zeitleiste wird daraus berechnet (`scheduleComputeSegments`): Pause vor Unterricht vor Schulzeit vor Block; unverplante Arbeitszeit erscheint als „Nicht zugewiesen“. Blöcke, die in Pausen oder Unterricht ragen, werden dort nur nicht angezeigt — gespeichert wird nie etwas still verändert, der Editor zeigt einen Hinweis.

Über der Zeitleiste schaltet „Heute / Morgen“ auf den Stundenplan des Folgetags (nur Vorschau; Aufgabenliste und Woche bleiben, in den Blöcken stehen die noch offenen Aufgaben). Ein „+“ in Projekt-/Arbeitsblöcken öffnet „Neue Aufgabe“ mit diesem Block. Bleibt Nook über Mitternacht offen, springt die Seite selbst auf den neuen Tag (`todayMinuteTick`).

Der aktuelle Abschnitt wird hervorgehoben (JETZT). Pausen sind schmale Markierungen, Blockarten haben je eine Akzentfarbe. Die Zeitleiste ist eine seitlich scrollende Zeile (Desktop und Handy, Mausrad scrollt seitlich); sie rückt den laufenden Abschnitt in die Mitte, sobald sich Tag oder laufender Abschnitt ändern (Prüfung jede Minute), und behält sonst die Scrollposition.

Aufgaben hängen wie bisher per `task.blocks` an Block-IDs. Block-IDs sind nur innerhalb eines Tages eindeutig: Kopien eines Tages behalten sie, damit eine Aufgabe an allen Tagen mit diesem Block erscheint.

Daten: `scheduleWeek` (Tage), `scheduleLessons`, `scheduleSubjects`, `scheduleTeachers`, `scheduleTemplates`. Der alte Key `blocks` war die Quelle der einmaligen Übernahme (Mo–Fr) und wird nicht mehr geschrieben.

Vorlagen sind Ausgangspunkte: Anwenden kopiert sie in den Tag, spätere Änderungen an Vorlage oder Tag beeinflussen sich nicht. Dabei behalten bestehende Blöcke ihre IDs (gleicher Name, sonst der Reihe nach), damit Aufgaben-Zuordnungen bleiben. Ersetzende Aktionen (Vorlage, Kopieren, Löschen) fragen nach und lassen sich einmal rückgängig machen.

Tests der Berechnung: `node --test tests/schedule.test.js`.

---

## Aufgaben

Zeigt ausschließlich relevante Aufgaben.

Sortierung:

1. offene Aufgaben
2. erledigte Aufgaben

Aufgaben können:

- Priorität besitzen
- mehreren Blöcken zugeordnet sein (`task.blocks`; Alt-Feld `task.block` liest `taskBlockIds()` in main.js mit)
- Notizen enthalten

Löschen geht ohne Rückfrage, dafür gibt es 8 Sekunden „Rückgängig“ (`hubUndo`, hub-utils.js).

## Gruppenpflichten

Eigenes Planungssystem unter den Aufgaben (js/gruppendienste.js): Pflichten mit Personen/Gruppen, automatischer fairer Rotation oder fester Reihenfolge, Verknüpfung gegen Doppelbelegung, gespeicherte Planung (`gdSchedule`, nur die Zukunft wird neu berechnet) und PDF-/Druckexport. Die Woche folgt der Kopf-Woche (`todayShiftWeek`). Personen und Gruppen werden unter „Pflichten verwalten → Personen & Gruppen verwalten“ umbenannt, geändert und weich gelöscht (`deleted: true`, damit vergangene Wochen ihre Namen behalten).

---

## Rechte Sidebar

Die Sidebar enthält ausschließlich Informationen, die häufig benötigt werden.

Aktuell:

- Analoge Uhr
- Schnellnotiz
- Speiseplan
- Mini-Kalender
- Nationaler Tag („Heute ist“)

Countdowns und die Positivity-Karte stehen in der linken Navigationsleiste (am Handy im Mehr-Menü), nicht in dieser Spalte.

---

# Mini-Kalender

Der Mini-Kalender ist eine kompakte Vorschau.

Er unterstützt:

- normale Termine
- mehrtägige Termine
- wiederkehrende Termine

Beim Anklicken eines Tages öffnet sich das Tagesmodal des Kalenders.

Der Mini-Kalender besitzt keine eigene Terminverwaltung.

Er verwendet ausschließlich Daten aus dem Kalender-Modul (`getEventsForRange`, also auch Serien und den Google-Spiegel).

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


**🧠 Brain Dump** (js/today-braindump.js): Knopf im Schnellnotiz-Kopf öffnet ein Modal mit einem Brain-Dump-Blatt — großes Ziel, Startdatum und Rubriken (Anrufen, Schreiben, Mailen, Termin machen, Nachhaken, Ansprechen, Recherchieren/Lernen, Machen/Erschaffen, Was ich machen WILL, Top-Prioritäten). Einträge lassen sich abhaken, entfernen oder per ↗ als Wochenaufgabe anlegen (Top-Prioritäten mit hoher Priorität). Bewusst als Modal, damit die Sidebar nicht wächst. Der Zähler am Knopf zeigt offene Einträge. DB-Key `brainDump`.

---

# Speiseplan

Zeigt Menü 1–3 und Dessert der Kantine für heute (am Wochenende: Montag), mit Pfeilen zu anderen Wochentagen.

Quelle ist das wöchentliche Speiseplan-PDF aus Dock B (Browser-Export einer Intrexx-Tabelle mit Textebene). Der Nutzer gibt es per Button oder Drag & Drop, Nook liest es lokal mit pdf.js (liegt in `js/vendor/pdfjs`, wird erst beim ersten Import über `loadScriptOnce` geladen, funktioniert offline) und zeigt das Ergebnis zur Kontrolle im Modal, bevor gespeichert wird. Schlägt das Laden fehl, öffnet das Modal leer zum Eintragen von Hand.

Code: `js/today-mealplan.js`, DB-Key `mealPlanWeeks` (nach Montag der Woche; es wird immer nur die aktuelle Woche gehalten, Speichern ersetzt die vorige).

Keine Suppen, Beilagen oder Allergene — bewusst nur, was für die Essensauswahl gebraucht wird.

---

# RPG-Stil: „Der Schreibtisch des Reisenden“

Im Heute-Stil `rpg` (Theme-Engine, `data-today-style="rpg"`, css/today-rpg.css) ist Heute ein eigener Ort statt Zettel auf Brettern: eine Mahagoni-Tischplatte (nur Heute hat sie), auf der jedes Widget ein **anderer Gegenstand** ist — Aufgaben als aufgeschlagenes Reisetagebuch (zwei Bildhälften, Liste läuft über beide Seiten), Unterrichtsblöcke als Messingschilder, Speiseplan als Kreidetafel, Gruppenpflichten als Brief mit Wachssiegel, Schnellnotiz als Notizblatt, Mini-Kalender als Abreißkalender, Uhr als astronomische Taschenuhr. Alle Gegenstände sind generierte Bilder (`assets/today/`) als mitwachsende 9-Slice-Rahmen — das Layout und alle Funktionen bleiben unverändert, nur die Optik wechselt.

Regel für neue Widgets im RPG-Stil: lieber ein eigener Gegenstand als noch ein Pergament-Zettel; keine Szene, in die Inhalte gequetscht werden.

Ohne Scrollen (gilt für **alle** Themes): Ab 1500 px Breite stehen die Widgets der rechten Spalte in zwei Stapeln nebeneinander (Uhr · Schnellnotiz · Kalender | Speiseplan · Heute ist), die Hauptspalte wird dafür schmaler (css/today.css). Die Stapel-Container legt `initTodayRightStacks()` in js/today.js an; darunter sind sie `display: contents` mit fester `order`, die Spalte sieht also aus wie immer. css/today-rpg.css setzt für den RPG-Stil nur eigene Maße (Rahmen, Abstände, kleinere Taschenuhr). Neue Widgets der rechten Spalte in `TODAY_RIGHT_STACKS` eintragen (sonst Stapel 2).

---

# Verschoben nach Pinnwand

Folgende Bereiche gehörten ursprünglich zu Today, wurden aber in einen eigenständigen Pinnwand-Tab ausgelagert (siehe README: "früher Teil von 'Heute', jetzt ein eigener Tab mit mehr Platz"):

- Informationskacheln (freie Kartenfläche)
- Berichtsheft (Betrieb/Berufsschule)
- To-Do
- Einkaufsliste
- Wichtiges, Fragen für den Unterricht, Begriffe & Definitionen
- benutzerdefinierte Kacheln (heute Karten mit frei wählbarer Farbe, siehe `pinboard.md`)

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
