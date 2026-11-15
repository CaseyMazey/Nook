# Ideen-Roadmap (Stand 2026-11-15)

Acht Ideen, die Nook ergänzen, ohne seinen Charakter zu ändern: ruhig, lokal, ohne Druck, belohnend statt mahnend. Jede Idee steht für sich und kann einzeln umgesetzt werden. Zu jeder steht hier, wie sie sich anfühlen soll, wo sie hingehört, welche Daten sie braucht und wo ihre Grenzen liegen.

Für alle gilt `CLAUDE.md`: Speichern nur über `DB.get`/`DB.set` mit eigenem Key und `saveX()`, keine festen Farben, Migrationen als IIFE, neue Inhalte bei der Suche (`registerSearchProvider`) und beim Theme-Editor (`registerSkinTarget`, Beispielwerte in `js/theme-lab-sample.js`) anmelden, reine Logik als testbarer Teil ohne DOM (`tests/`), Eintrag im Änderungsprotokoll.

## Empfohlene Reihenfolge

| # | Idee | Aufwand | Warum an dieser Stelle |
|---|------|---------|------------------------|
| 0 | Tagesverlauf sammeln (Vorarbeit fürs Jahresbuch) | klein | **Eilt:** ohne ihn fehlen dem Jahresbuch im Dezember die Karteikarten-Zahlen |
| 1 | Lieblingsgerichte im Speiseplan | klein | Du nutzt es jede Woche, schnell fertig |
| 2 | „Willkommen zurück“ | mittel | Größter Nutzen gegen Frust |
| 3 | Eine Zeile pro Tag | klein–mittel | Sollte vor dem Jahresbuch da sein, damit es darin vorkommt |
| 4 | Nook-Jahresbuch | mittel–groß | Ab Mitte Dezember sichtbar |
| 5 | Aufgaben nach Energie | klein–mittel | Unabhängig |
| 6 | Barrierefreiheit | klein | Unabhängig, teils schon vorhanden |
| 7 | Schnellnotiz per Tastenkürzel (Desktop) | mittel | Braucht ein Desktop-Release |
| 8 | Verknüpfungen Anleitungen ↔ Projekte ↔ Pinnwand | mittel | Unabhängig |

---

## 0. Vorarbeit: Tagesverlauf sammeln

**Problem:** Für das Jahresbuch ist ein Teil der Daten schon da: Aufgaben haben `completedAt`, Fokuszeit liegt je Tag in `todayFocusLog`, Sparbuchungen haben ein Datum. Bei den Karteikarten fehlt das: `fc_session_stats` hält nur den **heutigen** Tag und wird am nächsten überschrieben, und `card.lastSeen` kennt nur den letzten Zeitpunkt.

**Lösung:** In `recordAnswer()` (`js/flashcards.js`) beim Tageswechsel den alten Tag in einen neuen Key `fc_history` schreiben: `{ 'YYYY-MM-DD': { learned, reps, correct } }`. Das ist sehr klein, etwa 365 Einträge im Jahr.

**Wichtig:** Das sollte so bald wie möglich laufen. Alles vor dem Start ist für Karteikarten verloren, das Jahresbuch 2026 zeigt Karteikarten deshalb ehrlich „seit November“.

---

## 1. Lieblingsgerichte im Speiseplan

**Status:** umgesetzt in 2026.11.17 (`js/mealplan-fav.js`, `js/today-mealplan.js`, Tests in `tests/mealplan-fav.test.js`). Abweichung vom ersten Entwurf: Der Wochenhinweis zeigt nur Tage ab heute und bleibt die ganze Woche stehen, bis man ihn mit ✕ ausblendet.

**So fühlt es sich an:** Am Montag ziehst du das PDF wie gewohnt aufs Widget. Danach steht oben kurz: „⭐ Diese Woche: Lasagne (Do), Kaiserschmarrn (Fr)“. An den Tagen selbst trägt das Gericht im Widget ein ⭐ und ist leicht hervorgehoben.

**Wo:** Nur `js/today-mealplan.js` + `css/today.css` (Speiseplan-Bereich). Kein neuer Tab.

**Grundidee: Stichwörter statt einzelner Gerichte.** Die Kantine kocht viele Varianten desselben Gerichts („Nudeln Bolognese“, „Spaghetti mit Erbsen-Bolognese“, „Gemüsebolognese“). Ein Liebling ist deshalb ein **Wort**, das in vielen Gerichten vorkommen kann: „Bolognese“ markiert alle drei.

**Daten:** Neuer Key `mealPlanFavorites`: eine Liste von Stichwörtern, z.B. `['bolognese', 'lasagne', 'kaiserschmarrn']`.

**Bedienung:**
- **Direkt eintragen (Hauptweg):** Im Widget-Kopf ein ⭐-Knopf → kleiner Dialog „Lieblingsgerichte“. Oben ein Feld „Gerichte markieren, die dieses Wort enthalten:“ + Hinzufügen, darunter die Liste der Stichwörter als Chips (✕ zum Entfernen, Klick zum Umbenennen).
- **Live-Vorschau im Dialog:** Unter jedem Stichwort steht, worauf es in der aktuellen Woche passt, z.B. „Bolognese → Mo: Nudeln Bolognese, Do: Spaghetti mit Erbsen-Bolognese“ oder „diese Woche nicht dabei“. So siehst du sofort, ob ein Wort zu viel oder zu wenig trifft.
- **Kurzweg am Gericht:** ☆ neben einem Gericht öffnet denselben Dialog mit dem Gericht vorausgefüllt. Du kürzt es auf das Stichwort, das du willst (z.B. „Spaghetti mit Erbsen-Bolognese“ → „Bolognese“).

**Erkennung (reiner, testbarer Teil):** `mealPlanMatchFavorites(text, favorites)` → Liste der getroffenen Stichwörter:
- Groß-/Kleinschreibung egal, Umlaute und `ß` vereinheitlicht („Käsespätzle“ = „kaesespaetzle“).
- **Treffer auch mitten im Wort**, damit „Bolognese“ auf „Erbsen-Bolognese“ und „Gemüsebolognese“ passt. Das ist bei deutschen zusammengesetzten Wörtern nötig.
- Nebenwirkung: Ein sehr kurzes Wort wie „Reis“ träfe auch „Preiselbeeren“. Die Live-Vorschau zeigt das sofort. Zusätzlich gibt es eine Option pro Stichwort: steht es in Anführungszeichen (`"Reis"`), zählt nur das ganze Wort.
- Tests mit echten Gerichtsnamen aus einem alten Plan (Bolognese-Varianten, VEGAN-Präfix, Umlaute, Anführungszeichen-Regel).

**Wochenhinweis:** Erscheint nach dem Import und bleibt an dem Tag oben im Widget. Mit ✕ ausblendbar; das gilt für diese Woche.

**Grenzen:** Kein Vorschau-Feature (der Plan kommt erst montags für die laufende Woche), keine Benachrichtigungen, keine Bewertungen.

**Optional später:** Ein „Mag ich nicht“-Stichwort, das Gerichte nur dezent ausgraut. Nur bauen, wenn du es wirklich willst.

---

## 2. „Willkommen zurück“

**Ausgangslage im Code:** Offene Aufgaben haben kein Fälligkeitsdatum; `getTasksForTile()` (`js/main.js`) zeigt **alle** offenen Aufgaben, egal wie alt. Nach einer Pause (Urlaub, krank, Prüfungsphase) liegt deshalb einfach ein Haufen alter Aufgaben da.

**So fühlt es sich an:** Öffnest du Nook nach **mindestens 4 Tagen** zum ersten Mal, erscheint oben auf der Heute-Seite eine ruhige Karte:

> Schön, dass du wieder da bist.
> 6 Aufgaben sind aus der Zeit davor noch offen. Was machen wir damit?
> [Alle behalten] [Durchsehen] [Später]

- **Durchsehen** öffnet eine kurze Liste. Pro Aufgabe gibt es drei Knöpfe: *diese Woche*, *irgendwann*, *erledigt / weg* (weg mit `hubUndo`).
- **Alle behalten** schließt die Karte, nichts ändert sich.
- Daneben ein kurzer Hinweis, was in der Zwischenzeit lag, z.B. Termine, die vorbei sind, oder ob ein neuer Speiseplan fehlt. Nur zum Lesen, ohne Vorwurf.

**Daten:**
- Neuer Key `lastOpenedDay` (`'YYYY-MM-DD'`), einmal pro Tag beim Start gesetzt. Der alte Wert wird vorher gelesen, das ergibt die Lücke.
- „Irgendwann“ braucht einen Platz für Aufgaben ohne Druck: neues Feld `task.someday = true`. Solche Aufgaben blendet `getTasksForTile()` aus und zeigt sie gesammelt in einer zugeklappten Zeile „Irgendwann (4)“ unter der Aufgabenliste.
- Key `welcomeBackSeen` (Datum), damit die Karte am selben Tag nicht wiederkommt.

**Grenzen:** Kein Zähler „X Tage verpasst“, keine Serien, keine roten Zahlen. Abschaltbar unter Einstellungen → Heute-Seite. Die Schwelle (4 Tage) steht als Konstante in einer Zeile.

**Testbar:** Lücke berechnen, welche Aufgaben „von davor“ sind (offen und `createdAt` vor dem letzten Öffnen).

**Offene Frage:** Soll „Irgendwann“ auch im Projekte-Tab auftauchen? Vorschlag: nein, zuerst nur Heute.

---

## 3. Eine Zeile pro Tag

**So fühlt es sich an:** Ein kleines Feld auf der Heute-Seite: „Wie war dein Tag? (ein Satz)“ und optional eines von 5 Symbolen (🌧 ☁️ ⛅ 🌤 ☀️, Wetter statt Gesichter). Ab 17 Uhr erscheint es offen, vorher nur als kleine Zeile, damit der Morgen ruhig bleibt. Gibt es einen Eintrag von heute vor einem Jahr, steht er klein darüber: *„Heute vor einem Jahr: Erster Tag in der neuen Abteilung.“*

**Wo:** Eigene Datei `js/today-dayline.js` (lädt nach `today.js`), gerendert in der rechten Spalte wie die Schnellnotiz. Beachtet `today.md`: es ist ein neuer, eigener Baustein und doppelt nichts.

**Daten:** Key `dayLines`: `{ 'YYYY-MM-DD': { text, mood } }`, `mood` 1–5 oder `null`.

**Bedienung:**
- Speichert beim Tippen (entprellt), höchstens etwa 200 Zeichen.
- Ein Knopf „Alle Zeilen“ öffnet eine schlichte Liste nach Monaten, nur zum Lesen und Bearbeiten.
- Suche: Provider „Tageszeilen“, Treffer springen zum Tag.

**Grenzen:** Keine Serie, keine Erinnerung, keine Auswertung „deine Stimmung sinkt“. Die Symbole fließen nur ins Jahresbuch ein (z.B. „dein sonnigster Monat“). Abschaltbar.

**Theme-Lab:** Beispielzeile in `js/theme-lab-sample.js`, Element mit `registerSkinTarget` anmelden.

---

## 4. Nook-Jahresbuch

**So fühlt es sich an:** Ab dem **15. Dezember** liegt auf der Heute-Seite ein kleines Buch: „Dein Jahr 2026“. Ein Klick öffnet es groß, man blättert Seite für Seite (Pfeile, Wischen, Tastatur). Der Stil kommt vom Theme, im RPG-Stil sieht es wie ein Ledereinband aus. Bis Ende Januar bleibt es da, danach findet man es unter Einstellungen → Über Nook → „Jahresbücher“.

**Seiten (nur solche mit Inhalt, eine leere Seite fällt weg):**
1. Titel: Jahr und dein Name (falls gesetzt).
2. **Geschafft:** erledigte Aufgaben, der fleißigste Monat.
3. **Gelernt:** Karteikarten (aus `fc_history`, Vorarbeit 0), bestandene Prüfungen.
4. **Fokus:** Fokusstunden aus `todayFocusLog`, der längste Fokustag.
5. **Gespart:** gesparter Betrag, erreichte Sparziele (aus `budget-sparziele.js`). Nur positive Aussagen, keine Ausgaben-Bilanz.
6. **Gewachsen:** was im Garten/Wald dazukam (`gardenDex`).
7. **Projekte:** abgeschlossene Projekte.
8. **Deine Zeilen:** 3–5 Tageszeilen über das Jahr verteilt, der sonnigste Monat (falls Idee 3 läuft).
9. Schluss: ein ruhiger Satz, z.B. „Schön, dass du dir Zeit für dich genommen hast.“

**Wo:** `js/today-yearbook.js` + `css/today-yearbook.css`. Reiner Teil `NookYearbook` (Kennzahlen aus schlichten Listen, wie `NookReview` in `js/today-review.js`) mit Tests in `tests/`. Vieles aus `NookReview.stats()` lässt sich übernehmen, nur mit einem Jahr statt einer Woche.

**Daten:** Nichts Neues außer `yearbookSeen` (Jahr) und einem Schnappschuss `yearbooks: { 2026: {…Kennzahlen} }`, der beim ersten Öffnen im Januar eingefroren wird. So bleibt das Buch gleich, auch wenn später alte Aufgaben gelöscht werden.

**Grenzen:** Kein Teilen-Knopf, keine Ranglisten, keine Vergleiche mit anderen. Optional ein „Als Bild speichern“ für dich selbst, aber erst später.

**Offene Frage:** Soll es auch einen Vergleich zum Vorjahr geben („mehr Fokuszeit als 2025“)? Vorschlag: erst ab dem zweiten Jahrbuch und nur, wenn es positiv ist.

---

## 5. Aufgaben nach Energie

**So fühlt es sich an:** Eine Aufgabe bekommt beim Anlegen oder Bearbeiten optional ein Kärtchen: 🍃 *klein* oder 🔥 *braucht Kraft*. Über der Aufgabenliste gibt es einen Schalter „🍃 Wenig Energie heute“. Ist er an, zeigt Nook nur die kleinen Aufgaben, die anderen sind zugeklappt („5 weitere für einen besseren Tag“). Der Schalter gilt nur für heute und ist morgen wieder aus.

**Daten:**
- Neues Feld `task.energy`: `'low' | 'high' | undefined`. Alte Aufgaben brauchen keine Migration, `undefined` heißt „nicht angegeben“ und bleibt im Modus sichtbar.
- Key `todayLowEnergy`: das Datum, an dem der Modus an ist.

**Zusammenspiel:** Der Fokusmodus (`js/today-focus.js`) bevorzugt im Wenig-Energie-Modus den 25-Minuten-Timer. Projekte-Aufgaben bleiben zuerst außen vor.

**Grenzen:** Keine automatische Einschätzung und keine Statistik „du bist oft müde“.

---

## 6. Barrierefreiheit

**Schon da:** Die globale Schriftgröße (`--user-font-scale`, Einstellungen → Darstellung, `js/main.js`) und an einigen Stellen `prefers-reduced-motion`.

**Neu:**
- **Schalter „Weniger Bewegung“** unter Einstellungen → Darstellung: setzt `data-reduce-motion` auf `<html>` (wie die Theme-Attribute). In `css/main.css` greift dann eine gemeinsame Regel, die Animationen und Übergänge stark verkürzt. Er wirkt zusätzlich zur Systemeinstellung, falls jemand die am System nicht ändern kann oder will. Key `reduceMotion`. Spiele dürfen das respektieren, müssen aber nicht.
- **Sichtbarer Tastatur-Fokus** überall (`:focus-visible` mit einer Theme-Farbe), danach die wichtigsten Tabs einmal nur mit der Tastatur durchgehen.
- **Lesbare Schrift** als Option (z.B. Atkinson Hyperlegible, lokal in `fonts/`, kein CDN, damit es offline läuft).
- Eine kurze Prüfung pro Tab mit dem Skill `design:accessibility-review`: Kontraste in hellen und dunklen Themes, Beschriftungen an Symbol-Knöpfen.

**Grenzen:** Keine eigene Hochkontrast-Theme-Familie, die Themes regeln Farben weiter selbst.

---

## 7. Schnellnotiz per Tastenkürzel (Desktop)

**So fühlt es sich an:** Du arbeitest in einem anderen Programm, drückst `Strg + Alt + N`, und ein kleines, schlichtes Nook-Fenster erscheint mitten auf dem Bildschirm: ein Textfeld, `Enter` speichert in den Brain Dump, `Esc` schließt. Fertig in drei Sekunden.

**Technik (`desktop/`):**
- `globalShortcut.register()` in `desktop/main.js` nach `app.whenReady()`, beim Beenden `unregisterAll()`.
- **Stufe 1 (einfach, empfohlen zuerst):** Das Kürzel holt das Hauptfenster nach vorn und öffnet per IPC (`preload.js` → `window.nookDesktop.onQuickCapture(cb)`) das Brain-Dump-Eingabefeld. Die Daten bleiben ganz im Web-Teil, `today-braindump.js` bekommt nur eine Funktion „Eingabe öffnen“.
- **Stufe 2 (optional):** Ein eigenes kleines Fenster ohne Rahmen. Das braucht einen Weg zurück ins Hauptfenster (IPC → Hauptfenster schreibt in `brainDump`), weil die Daten in dessen `localStorage` liegen. Erst bauen, wenn Stufe 1 sich als zu umständlich anfühlt.
- Das Kürzel lässt sich in den Einstellungen ändern oder abschalten (nur sichtbar, wenn `window.nookDesktop` existiert). Ist es schon von einem anderen Programm belegt, kommt ein freundlicher Hinweis statt eines Fehlers.
- Tests in `desktop/test/`, danach ein Release nach dem Ablauf in `CLAUDE.md`.

**Grenzen:** Kein Tray-Icon und kein Autostart in diesem Schritt. Die Web-Version bleibt unverändert, dort gibt es weiter `Strg/⌘ + K`.

**Nie ändern:** `appId`, `productName`, `app://nook`.

---

## 8. Verknüpfungen zwischen Anleitungen, Projekten und Pinnwand

**So fühlt es sich an:** In einem Projekt gibt es einen Bereich „Verknüpft“ mit „+ Verknüpfen“. Ein kleiner Suchdialog findet Anleitungen und Pinnwand-Zettel, ein Klick hängt sie an. In der Anleitung steht dann unten: „Verwendet in: Projekt Umzug“. Ein Klick springt jeweils hin.

**Technik:**
- Die Auswahl nutzt die vorhandenen Suchquellen (`hub-search.js`, Provider von `guides.js`, `pinboard.js`, `projects.js`), damit kein Tab den anderen kennen muss. Dafür bekommt `hub-search.js` eine kleine lesende Funktion `searchPick({ providers, onPick })`. Sie schreibt nichts, so bleibt der Vertrag in `search.md` gültig.
- Gespeichert wird nur **eine Richtung**, beim Projekt: `project.links = [{ provider, id }]`. Die Rückrichtung („Verwendet in“) wird beim Anzeigen berechnet, indem man die Projekte liest. Lesen über Tab-Grenzen ist erlaubt, fremde Daten ändern nicht.
- Gelöschtes Ziel: Der Link zeigt „nicht mehr vorhanden“ und lässt sich mit einem Klick entfernen. Es wird nicht still aufgeräumt.

**Offene Frage:** Sollen auch Karteikarten-Fächer verknüpfbar sein (z.B. „Prüfungsprojekt“ ↔ Fach)? Vorschlag: ja, als zweiter Schritt, wenn das Grundgerüst steht.

---

## Bewusst gestrichen

- **Einkaufsliste aus dem Speiseplan:** Nook liest schon den Kantinenplan, das deckt den Bedarf.
- **Speiseplan-Vorschau / Freitags-Hinweis:** Der Plan erscheint erst montags für die laufende Woche.
