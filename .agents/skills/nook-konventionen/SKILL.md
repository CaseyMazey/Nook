---
name: nook-konventionen
description: Erzwingt Stil- und Konsistenzregeln im Nook-Projekt - zentrales Farbsystem statt Ad-hoc-Hex, Deutsch/Englisch-Namenskonvention, pro-Tab-Zuständigkeiten (was ein Tab NICHT werden soll) und mobile Ansicht. Nutze diesen Skill bei jeder Änderung an UI, Styling, neuen Funktions-/Variablennamen oder wenn ein Feature erweitert wird, das an die definierte Kernaufgabe eines Tabs grenzt.
---

# Nook Konventions-Skill

Ergänzt den `nook-architektur-guard` um Stil- und Konsistenzregeln, die keine harten technischen Grenzen sind, aber die App über die Zeit einheitlich und wartbar halten.

## 1. Farbsystem

**Grundregel (vom Projekt-Owner festgelegt): Außerhalb der Spiele (`games/<id>/`) gibt es KEINE festen Farben** — weder in CSS-Regeln noch in Inline-Styles oder JS (auch kein `#fff`, `rgba(0,0,0,…)`, `white` oder Fallback in `var(--x, #hex)`). Jede UI-Farbe ist eine Theme-Variable aus `css/main.css`; bevorzugt aus Grundfarben gemischt (`color-mix(in srgb, var(--text) 8%, transparent)` für Linien/Balken, `var(--shadow-tint)` für Schatten, `var(--glass-bg)` für schwebende Knöpfe, `var(--sheen)` für Glanz auf farbigen Flächen, `--status-*` für Ampeln …), damit sie jedem Theme folgt. Fehlt eine passende Variable: neue in `main.css` (`:root` + dunkle Familie) anlegen und bei Bedarf in `deriveThemeVars()` (js/theme-engine.js) für eigene Themes ableiten. Erlaubt sind nur Theme-Definitionen selbst, vom Nutzer gewählte Datenfarben samt Voreinstellungen und Illustrationen — Letztere (z.B. die Finanzgarten-Pflanzen-SVGs in `budget.js`, Garten-/Wald-Bilder) sind wie die Spiele eine ausdrückliche Ausnahme und behalten ihre natürlichen Farben.

- Neue Farben NIEMALS als Ad-hoc-Hexwert (`#a3b8c2`) direkt im Code.
- Immer über das zentrale Farbsystem aus `js/hub-utils.js` beziehen (Basis-Hexwert-Ableitung).
- Vor dem Hinzufügen einer neuen Farbe: prüfen, ob eine bestehende Farbe im System schon passt, statt eine neue Variante abzuleiten.

**Konkrete API (`js/hub-utils.js`):**

- `initColorPickerWidget(ids, opts)` — verkabelt einen kompletten Picker-Block (natives `<input type="color">` + Vorschau + "Zur Bibliothek hinzufügen" + gespeicherte Farben). `ids = { pickerId, previewId, addBtnId, libraryId }`, `opts = { initial, gradient, onChange }`. Gibt `{ getValue, setValue }` zurück.
- `applyUserColorVars(el, hex)` — berechnet aus EINER Basisfarbe die theme-bewussten `--user-color-bg/-border/-hover/-focus/-text/-shadow`-Variablen und setzt sie direkt auf ein Element.
- `computeUserColorVars(hex, forceDark)` — dieselbe Berechnung ohne DOM-Zugriff, falls die Werte anderweitig gebraucht werden (z.B. für `hexToRgba`-Mischungen).
- `HUB_PALETTE_HEX` — Vorschlagspalette für neue Farben.

**Beispiel 1 — Picker verkabeln** (`js/calendar.js:353`):
```js
const eventColorWidget = initColorPickerWidget(
  { pickerId: 'event-modal-color', previewId: 'event-modal-color-preview', addBtnId: 'event-modal-color-add-btn', libraryId: 'event-modal-color-library' },
  { initial: DEFAULT_EVENT_COLOR }
);
```
Gleiches Muster in `js/guides.js:1042` (`guideColorWidget`) und `js/pinboard.js:292` (`deskColorWidget`).

**Beispiel 2 — gespeicherte Farbe auf ein Element anwenden** (`js/pinboard.js:98`):
```js
if (card.color) {
  applyUserColorVars(el, card.color);
  el.style.background = 'var(--user-color-bg)';
  el.style.setProperty('--card-fg', 'var(--user-color-text)');
  el.style.setProperty('--card-border', 'var(--user-color-border)');
}
```
Gleiches Muster in `js/guides.js:284`. `js/calendar.js:834/865` nutzt `computeUserColorVars(ev.color, true)` direkt (ohne Element), wenn nur die berechneten Werte gebraucht werden, nicht das Setzen von CSS-Variablen.

## 2. Sprachkonvention (Deutsch/Englisch)

- UI-Texte (alles, was der Nutzer sieht): Deutsch.
- Code: Variablen-/Funktionsnamen überwiegend Englisch, Kommentare gemischt Deutsch/Englisch je nach bestehendem Stil in der jeweiligen Datei.
- Bei Unsicherheit: bestehenden Stil in der Datei, die gerade bearbeitet wird, übernehmen statt eine neue Konvention einzuführen.

**Befund (geprüft: `budget.js`, `garden.js`, `flashcards.js`, `gruppendienste.js`):** Die Englisch-Konvention ist kein Dogma — es gibt einen konsistenten, bewussten Ausreißer-Cluster: **deutsche Domänenbegriffe bleiben deutsch**, wenn sie ein Nook-spezifisches Kernkonzept ohne saubere, natürlich lesbare englische Entsprechung benennen. Konkret in `budget.js`:
```js
let kontostand;
function saveKontostand() { ... }
function renderKontostandHeader() { ... }
function renderFinanzgarten() { ... }
const kontostandModal = ...
function openKontostandModal() { ... }
```
Dasselbe Muster zieht sich bis in die **Dateinamen**: `budget-sparziele.js`, `budget-sparplaene.js`, `budget-sparprognose.js`, `budget-taschengeld.js`, `gruppendienste.js` (samt `renderGruppendienste()`). `garden.js` dagegen ist durchgehend englisch benannt (`gardenStickers`, `gardenDex`, `renderGarden()`), obwohl das UI-Label "Garten" heißt — hier gab es offenbar eine passende englische Übersetzung, die genutzt wurde.

**Regel für neue Namen:** Erst prüfen, ob es eine natürliche, kurze englische Entsprechung gibt (→ nutzen, wie bei Garden). Wenn nicht (Nook-eigener Begriff wie "Finanzgarten", "Sparziel", "Gruppendienst" ohne 1:1-Übersetzung) → deutscher Begriff ist im bestehenden Code akzeptiert, aber dann konsequent auch im Dateinamen/allen Funktionsnamen dieses Konzepts, nicht nur teilweise.

## 3. Tab-Zuständigkeiten (Nicht-Zuständigkeiten)

Jeder Tab hat eine klar definierte Kernaufgabe UND explizite Grenzen, was er nicht werden soll. Vor jeder Feature-Erweiterung prüfen: passt das neue Feature zur Kernaufgabe des Tabs, oder wandert der Tab damit in Richtung einer Zuständigkeit, die er laut Design-Vertrag nicht haben soll?

Jede `AI documentation/*.md`-Datei (außer `garden.md`, siehe unten) hat zwei relevante Abschnitte: `# Zuständigkeiten` → `Nicht verantwortlich für:` (Liste anderer Tabs/Features, die dieser Tab nicht doppelt implementieren soll) und `# Erweiterungsregeln` → `Neue Funktionen sollen nicht:` (inhaltliche Leitplanken, was das Feature-Design nicht werden soll).

**Budget** (`budget.md`):
- Nicht verantwortlich für: Kalender, Projekte, Guides, Flashcards, Games.
- Soll nicht: ✖ zu einer Buchhaltungssoftware werden · ✖ Bankfunktionen ersetzen · ✖ den Nutzer mit Zahlen überfordern · ✖ unnötig kompliziert werden.
- Zusätzlich explizit: „Die Finanzierung ersetzt keine Buchhaltung — sie bleibt eine Planungshilfe, keine Nachverfolgung tatsächlicher Kontobewegungen." / „Planung steht vor Buchhaltung."

**Calendar** (`calendar.md`):
- Nicht verantwortlich für: Projektplanung, Budget, Today-Aufgaben, Spiele, Bibliothek.
- Soll nicht: ✖ den Today-Tab ersetzen · ✖ Projektfunktionen übernehmen · ✖ Aufgaben doppelt verwalten · ✖ den Hero überladen · ✖ die Monatsansicht mit zu vielen Informationen füllen.

**Today** (`today.md`):
- Nicht verantwortlich für: Kalenderlogik, Budget, Projekte, Spiele, Bibliothek, Pinnwand (freie Karten/Berichtsheft/To-Do/Einkaufsliste/Kacheln — gehört zu `pinboard.js`).
- Soll nicht: ✖ den Kalender ersetzen · ✖ Projektfunktionen übernehmen · ✖ Budgetfunktionen übernehmen · ✖ die Sidebar überladen · ✖ mehr als eine zusätzliche Hauptsektion hinzufügen · ✖ freie Karten/Kacheln zurück nach Today verlagern.

**Projects** (`projects.md`):
- Nicht verantwortlich für: Kalender, Budget, Today, Games, Bibliothek.
- Soll nicht: ✖ klassische Business-Projektverwaltung nachbilden · ✖ Kanban ersetzen · ✖ Kalenderfunktionen übernehmen · ✖ doppelte Aufgabenverwaltung einführen · ✖ den Projektwald als einzige Ansicht voraussetzen.

**Flashcards** (`flashcards.md`):
- Nicht verantwortlich für: Kalender, Projekte, Today, Games, Budget.
- Soll nicht: ✖ das Leitner-System ersetzen · ✖ unnötig komplex werden · ✖ klassische LMS-Systeme nachbauen · ✖ Business-Lernplattformen imitieren · ✖ bestehende Lerndaten inkompatibel machen.

**Guides** (`guides.md`):
- Nicht verantwortlich für: Flashcards, Projekte, Kalender, Games, Budget.
- Soll nicht: ✖ zu einer klassischen Wiki-Software werden · ✖ unnötig komplex werden · ✖ den Fokus von Dokumentationen auf Aufgaben verschieben · ✖ bestehende Guides inkompatibel machen.

**Games** (`games.md`):
- Nicht verantwortlich für (Hub-Launcher selbst): Spiellogik, Highscore-Berechnung, Spielregeln, Speicherstände einzelner Spiele, Rendering einzelner Spiele — „liegen vollständig beim jeweiligen Plugin".
- Soll nicht: ✖ Wissen über einzelne Spiele enthalten · ✖ Spiellogik in den Hub verschieben · ✖ Plugincode ersetzen · ✖ feste Abhängigkeiten zwischen Spielen erzeugen.

**Garden** (`garden.md`) — **Sonderfall, andere Struktur als die übrigen Tabs:** hat zwar einen `# Zuständigkeiten`-Abschnitt mit `Nicht verantwortlich für:` (Projektbäume/Wald in `project-tree.js`/`forest.js` — eigenständiges System, Garden darf die Optik aufgreifen aber kein eigenes Baum-System auf deren Kosten bauen; Budget/Münzen-Ökonomie außerhalb von Garden; Cozy-Home-Haustiersystem — Beau ist ein eigenständiger Garten-Bewohner, keine Cozy-Home-Integration), **aber KEINEN** `# Erweiterungsregeln`-Abschnitt mit ✔/✖-Liste wie die anderen Tabs. Stattdessen gibt es lockerere Prosa-Leitplanken unter `# Entwicklungsrichtlinien`: „Jedes neue Feature muss den „wichtigsten Design-Test" oben bestehen, bevor es gebaut wird." und „Keine großen Änderungen an bestehenden Nook-Komponenten/Tabs nur um ein Garden-Feature umzusetzen." Bei Garden-Erweiterungen also `garden.md` von vorne lesen (den „Design-Test"-Abschnitt), nicht nur nach einer ✖-Liste suchen.

**Kein `AI documentation/*.md` vorhanden für:** Pinboard (Pinnwand), Tools, Settings. Bei Änderungen an diesen drei Tabs gibt es keinen dokumentierten Design-Vertrag zum Gegenlesen — im Zweifel den bestehenden Code als Vorlage nehmen und bei größeren Erweiterungen kurz nachfragen statt eine Zuständigkeitsgrenze zu erfinden.

Bei einer Anfrage, die eine Tab-Grenze berührt: kurz auf das Spannungsfeld hinweisen, bevor implementiert wird, statt stillschweigend die Zuständigkeit auszuweiten.

## 4. Mobile Ansicht

- Neue UI-Komponenten immer gegen die mobile Ansicht denken - kein automatisches CSS-Preprocessing vorhanden (kein Build-Schritt), also müssen responsive Regeln manuell konsistent zum bestehenden Muster ergänzt werden.
- Bestehende mobile Lösungen (z.B. aus dem Projekte-Tab) als Vorlage nehmen statt ein neues Muster zu erfinden.

**Die zwei App-weiten Standard-Breakpoints** (durchgängig genutzt, z.B. `css/main.css:546/550`, `css/today.css:453/458`, `css/projects.css:827/895`):
- `@media (max-width: 1024px)` — "Tablet/schmales Desktop": Sidebar bleibt, aber mehrspaltige Layouts werden einspaltig, Innenabstände schrumpfen.
- `@media (max-width: 480px)` — "Phone", dieselbe Schwelle wie `#mobile-bottom-nav` in `css/main.css`: Sidebar wird komplett ausgeblendet (`#sidebar { display: none; }`), stattdessen erscheint die feste Bottom-Nav; `.view`-Padding wird um den Bottom-Nav-Bereich + `env(safe-area-inset-bottom)` ergänzt.

**Drittes Muster — `@media (hover: none)`** (`css/projects.css:1095`), für Bedienelemente, die per CSS nur bei `:hover` sichtbar sind (z.B. Umbenennen/Verschieben/Löschen-Icons je Zeile): auf Touch-Geräten gibt es keinen Hover-Zustand, das Element wäre sonst unbedienbar. Hier wird die Bedingung nach der tatsächlichen Ursache ("kein Hover verfügbar") benannt statt nach einer Breitenschwelle — bei ähnlichen hover-only-Interaktionen dieses Muster statt eines weiteren `max-width`-Breakpoints verwenden.

**Viertes Muster — JS-gesteuertes DOM-Umhängen statt reinem CSS-Reflow** (Projekte-Tab, `js/forest.js`): Manche Inhalte lassen sich unterhalb eines Breakpoints nicht einfach per CSS umfließen, weil sie im Desktop-Layout strukturell an einer anderen Stelle sitzen (z.B. eine Info-Karte, die auf Desktop Teil eines 3-Spalten-Heros ist, auf Mobile aber in ein eigenes Modal soll). Muster: ein `window.matchMedia(...)` mit Callback, das bei Breakpoint-Wechsel dieselben DOM-Elemente per `appendChild` in einen anderen Container umhängt, statt sie zu klonen oder zwei getrennte Versionen zu rendern.
```js
// js/forest.js
const pdtInfoMobileQuery = window.matchMedia('(max-width: 1024px)');
function placePdtInfoCard(isMobile) { /* hängt .pdt-left/.pdt-info-card zwischen Hero und Modal-Slot um */ }

const MOBILE_FOREST_BREAKPOINT = 480;
const forestActionsMobileQuery = window.matchMedia(`(max-width: ${MOBILE_FOREST_BREAKPOINT}px)`);
function placeForestActionButtons(isMobile) { /* hängt Archiv/Neues-Projekt-Buttons um */ }
```
Dasselbe Prinzip nutzt `js/main.js` (`placeSidebarWidgets()`) tab-übergreifend, um Positivity/Countdown-Widgets zwischen Desktop-Sidebar und der mobilen "Mehr"-Seite umzuhängen — bei neuen sidebar-artigen Widgets, die auf Mobile woanders hinsollen, dieses Muster statt einer zweiten Render-Funktion verwenden.

## Vorgehen

1. Vor UI-/Styling-Änderungen: betroffene bestehende Tabs als Stilvorlage lesen.
2. Bei neuen Namen: kurz gegen Punkt 2 prüfen.
3. Bei Feature-Erweiterungen: kurz gegen Punkt 3 prüfen, ob eine Tab-Grenze berührt wird — bei Pinboard/Tools/Settings gibt es keine Doku zum Gegenlesen, dort im Zweifel nachfragen.
4. Bei neuen UI-Elementen: Punkt 4 nicht vergessen, auch wenn nicht explizit danach gefragt wurde — insbesondere bei Elementen, die auf Desktop hover-abhängig sind oder strukturell zwischen Layout-Bereichen wechseln müssen.
