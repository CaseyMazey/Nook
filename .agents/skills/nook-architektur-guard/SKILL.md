---
name: nook-architektur-guard
description: Erzwingt die Kernarchitektur-Regeln des Projekts Nook (client-seitige Organisations-App ohne Backend/Build-Schritt, geladen über file://). Nutze diesen Skill bei JEDER Code-Änderung in Nook - neue Features, Bugfixes, Refactoring - bevor Code geschrieben oder verändert wird. Verhindert typische Fehler wie ES-Module, fetch() für lokale Daten, direkten localStorage-Zugriff statt DB-Wrapper, globale Namenskollisionen und Tab-übergreifende Mutationen.
---

# Nook Architektur-Guard

Nook ist eine persönliche, client-seitige Organisations-App (Dashboard, Kalender, Budget, Karteikarten, Wiki, Projekte, Tools, Spiele). Sie läuft **ausschließlich** als `index.html` über `file://` - ohne Backend, ohne Build-Schritt, ohne `package.json`. Diese Beschränkung ist bewusst und nicht verhandelbar. Jede Code-Änderung muss diese Checkliste bestehen, BEVOR sie geschrieben wird.

## Checkliste vor jeder Änderung

### 1. Kein Build-Tooling
- ❌ KEINE ES-Module (`import`/`export`)
- ❌ KEIN Bundler-Syntax (Webpack, Vite, Rollup-Konventionen)
- ❌ KEIN `fetch()`/`XMLHttpRequest` für lokale Daten (funktioniert nicht über `file://`)
- ❌ KEINE neuen `package.json`-Abhängigkeiten
- ✅ Klassisches `<script>`-Tag-Loading, alles im globalen Scope
- ✅ Statische Konfiguration als reines `.js`, das `window.X` setzt (Beispiel: `games/games-list.js` setzt `window.GAMES_LIST`), nicht als `.json`
- ✅ Modul-/Asset-Nachladen zur Laufzeit läuft über dynamisch injizierte `<script>`/`<link>`-Tags, nicht über `fetch()` — konkret in `js/games.js:41-77`:
  ```js
  // Ladestrategie pro Spiel (Kopfkommentar games.js):
  //   1. games/<id>/manifest.js   → lädt sofort (Meta + getStats, für die Karte)
  //   2. games/<id>/<id>.js       → lädt erst beim ersten Klick auf "Spielen"
  //   3. games/<id>/<id>.css      → wird beim Öffnen injiziert, beim Schließen entfernt
  function loadScript(src) { /* erzeugt <script src>, hängt an document.head, resolved via onload */ }
  function loadGameCss(id) { /* erzeugt <link rel="stylesheet" href="games/<id>/<id>.css"> */ }
  function unloadGameCss(id) { /* entfernt das <link>-Element wieder */ }
  ```

### 2. Script-Ladereihenfolge (`index.html`, ab Zeile ~2949)
Tatsächliche Reihenfolge (Auszug, Kernkette):
```
js/main.js
js/hub-utils.js
...
js/calendar.js
js/today.js
...
js/budget.js
js/budget-taschengeld.js
js/budget-sparziele.js
js/budget-financing.js
js/budget-analysis.js
js/budget-debts.js
js/budget-sparprognose.js
js/budget-sparplaene.js
js/projects.js
js/project-tree.js
js/forest.js
js/garden-catalog.js
js/garden.js
...
js/games.js
games/games-list.js
js/settings.js
js/theme-engine.js
...
```
- `js/hub-utils.js` lädt direkt nach `main.js` (braucht `DB`), vor allen Tab-Skripten (Kommentar-Header in `hub-utils.js`).
- Budget-Reihenfolge ist explizit dokumentiert (Kopfkommentar in `budget.js`): *"Lade-Reihenfolge: budget.js -> budget-sparprognose.js -> budget-sparplaene.js"*. `budget-financing.js` muss laut eigenem Kopfkommentar NACH `budget.js` und `budget-sparziele.js` geladen werden (nutzt `goalMonthlyReserveEquivalent()`) und VOR `budget-sparprognose.js` (nutzt `sparplanTotalReserved()`).
- `garden.js` braucht `GARDEN_CATALOG`/`gardenPickVariant` aus `js/garden-catalog.js`, das daher davor geladen wird.
- Neue Datei hinzufügen: erst prüfen, welche bestehenden Funktionen/Variablen sie braucht, dann an der richtigen Stelle in der `<script>`-Reihenfolge in `index.html` einfügen. Bei mehrteiligen Tabs (Budget-Muster) im neuen Dateikopf per Kommentar dokumentieren, wovor/wonach sie laden muss (siehe `budget-financing.js`-Kopf als Vorlage).

### 3. Persistenz nur über DB-Wrapper
- ALLE persistenten Daten laufen über `DB.get(key, fallback)` / `DB.set(key, val)` aus `js/main.js` (Zeile 5-12) - NIEMALS direkter `localStorage`-Zugriff.
- Jedes Feature bekommt seinen EIGENEN Key, geladen einmalig in eine Top-Level-`let`-Variable, mit dediziertem `saveX()`-Setter nach dem Muster `function saveX(){ DB.set('key', x); }`. Konkrete Beispiele aus dem echten Code:
  ```js
  // main.js
  let blocks = DB.get('blocks', DEFAULT_BLOCKS);
  let eventSeries = DB.get('eventSeries', []);
  function saveEventSeries(){ DB.set('eventSeries', eventSeries); }

  // garden.js
  let gardenStickers = DB.get('gardenStickers', null);
  let gardenDex = DB.get('gardenDex', {});
  function saveGardenStickers() { DB.set('gardenStickers', gardenStickers); }
  function saveGardenDex()      { DB.set('gardenDex', gardenDex); }

  // budget.js
  let budgetRecurring = DB.get('budgetRecurring', []);
  let budgetGoals     = DB.get('budgetGoals', []);
  function saveBudgetRecurring(){ DB.set('budgetRecurring', budgetRecurring); }
  function saveBudgetGoals(){     DB.set('budgetGoals',     budgetGoals);     }
  ```
- Nach jeder Mutation eines State-Objekts: zugehörige `saveX()`-Funktion aufrufen.
- Alte Datenformate NIEMALS stillschweigend verwerfen - einmalige Migration als IIFE beim Laden, siehe `migrateTasksIfNeeded()` (main.js:76) fürs alte Wochen-Task-Format, oder die Sticker-Vereinheitlichung in `garden.js` (Zeile 35-57: `gardenPlants`/`gardenNursery` → `gardenStickers`, inkl. `localStorage.removeItem(...)` der alten Keys erst NACH erfolgreicher Migration). Für sich änderndes Feld-Format (nicht ganze Struktur) siehe `migrateGoalFunding()` in `budget-financing.js` (goal.fundingSources → goal.funding).

### 4. Globaler Scope - Namenskollisionen vermeiden
- Vor dem Anlegen neuer Funktions-/Variablennamen: bestehenden Code nach demselben Namen durchsuchen (Grep über alle `js/`-Dateien).
- Feature-Präfix verwenden, wie es der bestehende Code konsequent tut: `gardenStickers`/`gardenDex`/`renderGarden()` (Garden), `budgetRecurring`/`budgetGoals`/`renderBudget()` (Budget). Keine generischen Namen wie `data`, `save`, `items`, `state` auf Top-Level (die `state`-Objekt-Ausnahme in `main.js` selbst ist bereits vergeben - nicht erneut verwenden).

### 5. Views/Tabs - lesen ja, mutieren nein
- Ein `<div class="view" id="view-<name>">` pro Tab in `index.html`, gesteuert über `showView(name)` (main.js:469) und `renderView(name)` (main.js:534), das an das jeweilige Tab-Entry-Point dispatcht, z.B.:
  ```js
  if(name==='budget')  { renderBudget(); }
  if(name==='garden')  { renderGarden(); }
  if(name==='games')   { initGames(); }
  ```
- Neuen Tab hinzufügen: eigenen `if(name==='xyz'){ renderXyz(); }`-Zweig in `renderView()` ergänzen plus Eintrag in `viewMap` (automatisch über `.view`-Querying) - siehe bestehende Zweige als Vorlage.
- Tabs DÜRFEN den State anderer Tabs LESEN (z.B. Today liest Kalender-/Task-Daten über `getTasksForTile()`/`getTasksForCalendarDay()`, main.js:316-368).
- Tabs DÜRFEN NIEMALS den State eines anderen Tabs direkt MUTIEREN. Ziel-Tab stellt dafür eine eigene Funktion bereit statt dass ein anderer Tab z.B. direkt `budgetGoals.push(...)` aufruft.
- Ausnahme/Vorbild für kontrollierte Cross-Tab-Integration: `games/cozy-home/pets.js` (`collectCrossGamePets()`, Zeile 231-245) liest nach dem Laden aller Manifeste `window.GameHub.registry` durch und übernimmt bei jedem Spiel mit einem `pets`-Array (Beispiel: `games/snake/manifest.js:58ff`, Pet `"snake"`/"Schlängel") dessen Einträge in `PET_DEFINITIONS` — bereits vorhandene IDs werden nicht überschrieben. Cozy Home liest damit nur die von anderen Spielen selbst deklarierten Daten, statt deren internen State zu kennen oder zu verändern.

### 6. Farben
- Neue Farben NIEMALS als Ad-hoc-Hexwerte im Code. Immer über das zentrale Farbsystem aus `js/hub-utils.js`:
  - `HUB_PALETTE_HEX` als Vorschlagspalette
  - `initColorPickerWidget(ids, opts)` zum Verkabeln eines kompletten Picker-Blocks (natives `<input type="color">` + Vorschau + Bibliothek), siehe Doku-Kommentar in `hub-utils.js:138-188`
  - `applyUserColorVars(el, hex)` / `computeUserColorVars(hex)` liefern die theme-bewusst abgeleiteten `--user-color-bg/-border/-hover/-focus/-text/-shadow`-Variablen aus EINER Basisfarbe - so werden neue Farbflächen automatisch light/dark-tauglich, ohne dass der aufrufende Tab selbst zwischen Themes unterscheiden muss.
  - `renderCodeBlock(code, lang, opts)` für Code-Darstellung. Laut Kopfkommentar in `hub-utils.js` für Guides UND Pinboard gedacht, aktuell (geprüft per Grep) wird die Funktion aber nur noch von `js/guides.js` aufgerufen — falls Pinboard wieder Code-Karten bekommt, diese Funktion wiederverwenden statt neu zu bauen, aber nicht davon ausgehen, dass Pinboard sie heute schon nutzt.

## Vorgehen bei jeder Anfrage

1. Betroffene(n) Tab(s) identifizieren und relevante Dateien lesen (inkl. `AI documentation/*.md` für den Tab, falls vorhanden - z.B. `AI documentation/garden.md` für die Sticker-Architektur - aber im Hinterkopf behalten, dass diese Doku nicht immer 1:1 mit dem Code synchron ist, im Zweifel Code als Quelle der Wahrheit nehmen).
2. Checkliste oben durchgehen, BEVOR Code geschrieben wird.
3. Bei Unsicherheit über Ladereihenfolge oder Scope: bestehenden Code als Vorlage nehmen (z.B. den Budget-Dateikopf-Kommentarstil für neue mehrteilige Tabs), nicht raten.
4. Nach der Änderung: kurz gegen die Checkliste zurückprüfen, bevor die Antwort abgeschlossen wird.

## Bekannte Ausnahmen / Sonderfälle

- Games (`games/<id>/`) sind ein selbstregistrierendes Plugin-System (`js/games.js` kennt nur `window.GAMES_LIST` aus `games/games-list.js` und rendert, was sich via `window.registerGame(config)` in `window.GameHub.registry` einträgt). Neue Spiele brauchen nur `manifest.js` (Metadaten, lädt sofort), `<id>.js` (Logik, lazy-loaded bei erstem "Spielen"-Klick, `mount()`/`destroy()`), `<id>.css` (injected on open) plus einen Eintrag in `games/games-list.js` - keine Änderung an `index.html` oder `js/games.js`. Falls eine Spiel-Änderung eine Launcher-Änderung zu erfordern scheint, ist das ein Signal, dass etwas gegen die Architektur läuft - erst hinterfragen, bevor `js/games.js` angefasst wird.
- Cozy Home (`games/cozy-home/`) fungiert als cross-Game virtuelles Haustiersystem, aber nur beim **Haustier selbst** ist das wirklich cross-Game: Andere Spiele deklarieren optional ein `pets`-Array in ihrem eigenen `manifest.js` (Beispiel: `games/snake/manifest.js:58ff`, Pet `"snake"`) — `collectCrossGamePets()` in `games/cozy-home/pets.js:231-245` scannt beim Mount `window.GameHub.registry` und merged diese Einträge in `PET_DEFINITIONS`, ohne die Spiel-IDs vorher zu kennen. **Futter/Spielzeug/Vorlieben-Level dagegen sind rein interne Cozy-Home-Registries**, NICHT von anderen Spielen deklarierbar: `FOOD_REGISTRY`, `TOY_REGISTRY` und `PREFERENCE_LEVELS` sind `const`-Objekte direkt in `games/cozy-home/cozy-home.js` (Zeile ~203-247, ~538-547) — neues Futter/Spielzeug bedeutet dort einen Eintrag in dieser Datei zu ergänzen, keine cross-Game-Registrierung.
