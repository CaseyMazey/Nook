# Review: Karteikarten — 2026-10-29

Geprüft: `js/flashcards.js`, `js/flashcards-import.js`, `js/flashcards-exams.js`, `css/flashcards.css`, Karteikarten-Teile von `css/pages-rpg.css`, Markup in `index.html`, Einbindung in `main.js` / `settings.js` / `hub-search.js`, Design-Vertrag `AI documentation/flashcards.md` + `flashcards-import-format.md`. Erstes Review dieses Themas.

**Stand:** Alle 23 Punkte am selben Tag umgesetzt (siehe Commit „Karteikarten: Review umgesetzt“).

**Kurzfazit:** Der Tab ist in gutem Zustand. Datenmodell und Persistenz sind sauber über `DB`, es gibt keine festen Farben, und Archiv, Prüfungen, Import und Session-Speicherung greifen sauber ineinander. Die größte Baustelle ist inhaltlich: Lernsessions zeigen immer **alle** Karten, obwohl der Knopf „Lernen (n fällig)“ anzeigt. Dazu werden die Markdown-Rückseiten aus dem Import roh angezeigt. Ein paar kleinere Fehler gibt es außerdem: einen toten Filter-Knopf, doppelte Statistikwerte und die UTC-Zeitrechnung.

## 🐞 Fehler

1. **[mittel] „Lernen (6)“ lernt trotzdem alle Karten**. Fundstellen: `js/flashcards.js:459` (Beschriftung), `startGroupsLearnSession` (`js/flashcards.js` ~742) und `flashcards-exams.js:64`. Auch Prüfungen nehmen alle Karten. Der Knopf verspricht 6 fällige Karten, die Session bringt aber auch Karten aus Box 3–5, die laut Leitner erst in Tagen dran wären. Das ist sehr wahrscheinlich ein Teil des Eindrucks „Karten doppelt sehen, obwohl ich das nicht sollte“. Vorschlag: Standardmäßig nur fällige Karten lernen. Sind keine fällig, gibt es „Alle wiederholen“ als Zweitknopf. Prüfungen bekommen die Wahl „Fällige“ / „Alle (Prüfungsvorbereitung)“. Die Doku (`flashcards.md` → Lernsession: „alle Karten dieser Gruppe“) müsste dann angepasst werden.
2. **[mittel] Filter-Knopf ohne Funktion**. Fundstelle: `index.html:818` (`#fc-filter-btn`). Es gibt keinen einzigen Listener, ein Klick passiert ins Leere. Im RPG-Theme ist er sogar als Messingknopf hervorgehoben. Vorschlag: entweder entfernen oder als echten Filter bauen, z. B. „nur fällige / nur schwierige / Box …“ für die Kartenlisten (siehe 17).
3. **[mittel] Karte löschen ohne Rückfrage**. Fundstelle: `openCardMenu` → delete (`js/flashcards.js:378`). Ein Fehlklick im ⋮-Menü löscht die Karte sofort, ohne Rückfrage und ohne Rückgängig. Vorschlag: `hubConfirm` wie bei den Prüfungen.
4. **[niedrig] „Gelernt“ und „Wiederholt“ zeigen immer dieselbe Zahl**. Fundstelle: `recordAnswer` (`js/flashcards.js:22`). `learned++` und `reps++` laufen bei jeder Antwort gemeinsam hoch, im Screenshot stand deshalb 56 / 56. Vorschlag: „Gelernt“ = verschiedene Karten heute (IDs als Set im Tagesobjekt), „Wiederholt“ = alle Antworten. Alternative: „Wiederholt“ zählt nur Karten mit vorheriger Antwort.
5. **[niedrig] Tageswechsel nach UTC statt Ortszeit**. Fundstellen: `getTodayStr` (`js/flashcards.js:12`, `toISOString`) und `calcDueCount` (`lastSeen.slice(0,10)` + `new Date('YYYY-MM-DD')` = UTC-Mitternacht).
   - In Deutschland springt „heute“ erst um 1:00 bzw. 2:00 Uhr (Sommerzeit) um.
   - Antworten zwischen 0 und 2 Uhr zählen noch zum Vortag, und „Heute schon gelernt“ zeigt bis dahin die Zahl von gestern.
   - Fälligkeiten verschieben sich ebenfalls um diese 1–2 Stunden.
   - Vorschlag: `dateKey(new Date())` aus `main.js` verwenden und `lastSeen` lokal vergleichen (`dateKey(new Date(lastSeen))`). Die Speicherform bleibt dabei gleich.
6. **[niedrig] Sprung aus der Suche beendet eine laufende Session ohne „Pausieren“**. Fundstelle: Suchquelle `open()` (`js/flashcards.js:1195`). Dort wird `closeSessionPanel()` statt `pauseLearnSession()` aufgerufen. Der Stand bleibt zwar erhalten, aber als „nicht pausiert“: Nach dem nächsten Neuladen startet die Session ungefragt wieder. Vorschlag: `pauseLearnSession()` verwenden.
7. **[niedrig] Sprung zu „schwierige Karte“ sucht die Gruppe über den Titeltext**. Fundstelle: `jumpToHardCard` (`js/flashcards.js` ~823). Bei zwei gleich benannten Themen springt er zum falschen. Inzwischen gibt es `data-group-id` an `.group-card`, die Suche sollte darüber laufen. Die Karte selbst wird außerdem nicht hervorgehoben.
8. **[niedrig] Zahlen in der Prüfungskarte und in der Session weichen ab**. Fundstelle: `flashcards-exams.js:60`. Die Prüfungskarte zählt Karten inklusive Doppelter (gleiche Vorderseite in zwei Themen), die Session zeigt sie nur einmal, also z. B. 67 gegenüber 64. Vorschlag: auch dort `uniqueCardsByFront` zählen.

## 🧹 Doppelter Code & Aufräumen

9. **Native `confirm()` neben `hubConfirm`**. Fundstellen: Fach löschen (`:325`), Gruppe löschen (`:346`). Der Rest des Tabs (Archiv, Prüfungen, Session) nutzt `hubConfirm`. Der Browser-Dialog passt optisch nicht und wirkt im RPG-Theme besonders fremd.
10. **Drei fast gleiche Export-Funktionen**. Fundstelle: `exportSubject` / `exportGroup` / `exportCard` (`:1153–1182`). Alle drei machen dasselbe: Blob bauen, `<a download>` erzeugen und klicken. Ein Helfer `fcDownloadJson(name, obj)` würde reichen. Die Dateinamen werden nicht bereinigt (`/`, `:` im Fachnamen).
11. **Inline-Styles in `renderGroupList`**. Fundstellen: `:445, :456, :458, :516, :519`. Dazu kommen `endLearnSession` (`:1087, :1112`) und `index.html:814–818`. Farben sind keine dabei (also regelkonform), aber Abstände und Schriftgrößen gehören in `flashcards.css`, sonst kann das RPG-Theme sie nur mit `!important` übersteuern.
12. **Verwaiste Daten nach dem Löschen**.
    - Ein gelöschtes Fach lässt seine IDs in `collapsedGroups` und ggf. einen gespeicherten Session-Stand (`fc_learn_session`) zurück. Schaden entsteht nicht, weil beim Lesen gefiltert wird, aber der Speicher wächst.
    - Vorschlag: beim Löschen mit aufräumen.
13. **`calcGroupDue` / `calcGroupAccuracy` / `calcSubjectDue` / `calcSubjectAccuracy`** sind nur noch Einzeiler um `calcDueCount` / `calcAccuracy`. Kosmetik, darf bleiben.

## ⚡ Optimierung

14. **Fachsuche rendert bei jedem Tastendruck die ganze Fachansicht neu**. `renderSubjectList()` ruft am Ende `renderSubjectDetail()` auf, das wiederum Prüfungen, alle Gruppen samt Kartenzeilen und das Inhaltsverzeichnis neu baut. Bei aufgeklappten Gruppen mit über 200 Karten passiert das bei jedem Buchstaben. Vorschlag: Die Suche rendert nur die Liste. `renderSubjectDetail` läuft nur, wenn sich das aktive Fach oder seine Daten ändern.
15. **Ein Klick auf ein Fach rendert die Detailansicht doppelt**. Fundstelle: `buildSubjectItem` (`renderSubjectList(); renderSubjectDetail();`), wobei `renderSubjectList` selbst schon `renderSubjectDetail` aufruft. Die Lösung fällt mit 14 zusammen.

## 📏 Regelverstöße (Farben, Architektur, Doku)

- Farben: keine festen Werte in `flashcards.css` oder in den Karteikarten-Teilen des RPG-CSS ✔. Architektur (DB-Wrapper, keine Module, kein `fetch`, Ladereihenfolge dokumentiert) ✔. Backup/Reset decken `subjects`, `collapsedGroups` und `fc_*` ab, also auch Archiv und Session ✔.

16. **Doku-Abgleich**.
    - `flashcards.md` → „Lernsession“ beginnt noch mit „wird für eine einzelne Themengruppe gestartet“, Prüfungen stehen erst weiter unten. Kleine Umformulierung reicht.
    - „Export: als JSON“: Die Dateien lassen sich nirgends wieder importieren. Das steht zwar unter „Zukunft“, ist aber im Alltag eine Sackgasse (siehe 21).

## 💡 Verbesserungen & fehlende Features

17. **Rückseite als Markdown darstellen** (steht in der Doku unter „Zukunft: Markdown-Unterstützung“).
    - Der Import speichert absichtlich rohen Markdown, angezeigt wird er aber per `textContent`. Man sieht also `**fett**`, `- ` und ```` ``` ````.
    - Gerade bei den von Claude erzeugten Karten mit Listen, Code und (laut deinen Tutor-Anweisungen) Schaubildern lohnt sich das am meisten.
    - Vorschlag: den vorhandenen `renderMarkdown` aus `guides.js` bzw. `renderCodeBlock` aus `hub-utils.js` in einen geteilten Helfer ziehen und für Rückseite und Kartenliste nutzen. Escapen muss dabei erhalten bleiben.
18. **Tastatur in der Lernsession**.
    - Die Karte ist ein `<div onclick>` ohne `tabindex` und `role`, mit Tastatur also nicht umdrehbar.
    - Vorschlag: Leertaste/Enter = umdrehen, 1/2/3 = Nicht gewusst/Schwer/Gewusst, Esc = pausieren. Plus `aria-live` für den Wechsel der Karte.
    - Den ⋮-Knöpfen an Gruppen und Karten fehlen `title`/`aria-label`.
19. **Gruppen-Sessions immer in derselben Reihenfolge**. Gruppen werden nur nach Box sortiert, innerhalb einer Box nicht gemischt. „Nochmal“ bringt so exakt dieselbe Reihenfolge, und man lernt die Abfolge mit. Vorschlag: innerhalb einer Box mischen. Die Doku nennt „Zufallsmodus“ ohnehin als Idee.
20. **Karte in ein anderes Thema verschieben**. Bisher geht das nur über Löschen und Neu-Anlegen, wobei die Lernstatistik verloren geht. Ein Eintrag „Verschieben nach …“ im ⋮-Menü der Karte würde reichen.
21. **Export als Markdown im Import-Format**. Eine `.md` statt nur JSON exportieren, dann lassen sich Fach und Thema wieder importieren, teilen oder an Claude geben (z. B. „ergänze Karten zu diesem Thema“). Das schließt die Lücke aus 16, ohne einen zweiten JSON-Import zu bauen.
22. **Rückmeldung nach der Session: welche Karten falsch waren**. Die Zusammenfassung zeigt nur Zahlen. Eine kurze Liste der „Nicht gewusst“-Karten mit einem Knopf „Nur diese nochmal“ wäre beim Prüfungslernen sehr nützlich und bleibt im Leitner-Rahmen.
23. **Filter für die Kartenliste** (würde 2 sinnvoll machen): fällig / schwierig / Box 1 / Text suchen innerhalb des Fachs. Die globale Suche findet zwar Karten, aber nicht gefiltert nach Lernstand.

## Empfohlene Reihenfolge

| # | Was | Aufwand |
|---|---|---|
| 1 | Nur fällige Karten lernen (+ „Alle wiederholen“), Prüfungen mit Wahl | mittel |
| 17 | Rückseite als Markdown (geteilter Renderer aus Anleitungen) | mittel |
| 2 + 23 | Filter-Knopf entfernen oder echten Kartenfilter bauen | klein / mittel |
| 3 + 9 | Löschen immer mit `hubConfirm` (Karte, Gruppe, Fach) | klein |
| 4 + 5 | Tagesstatistik korrigieren (Gelernt ≠ Wiederholt, Ortszeit) | klein |
