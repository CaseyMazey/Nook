---
name: nook-feature-scaffold
description: Beschleunigt das Anlegen neuer Inhalte in Nook nach bestehenden Mustern - neue Spiele (Plugin-System), Sticker/Items im Garden-System, neue Tabs/Unterseiten mit URL-Routing, Theme-Engine-Erweiterungen, Cozy-Home-Integration und View-Lifecycle (showView/renderView). Nutze diesen Skill, wenn ein NEUES Feature, ein neues Spiel, ein neuer Sticker-Typ, eine neue Route oder ein neuer Theme-Baustein hinzugefügt werden soll - nicht für reine Bugfixes an bestehendem Code.
---

# Nook Feature-Scaffold-Skill

Kennt die wiederkehrenden Baumuster in Nook, damit neue Features konsistent zu bestehenden gebaut werden, statt jedes Mal neu erfunden zu werden. Ergänzt `nook-architektur-guard` (Regeln) und `nook-konventionen` (Stil).

## 1. Neues Spiel anlegen (Plugin-System)

Games sind selbstregistrierend - KEINE Änderung am Launcher nötig.

Schema: `games/<id>/manifest.js`, `games/<id>/<id>.js`, `games/<id>/<id>.css`

**`manifest.js` — vollständiges Interface** (aus `js/games.js` per Grep verifiziert, welche Felder tatsächlich gelesen werden):
```js
window.registerGame({
  id: 'meinspiel',            // Pflicht, muss zu games/<id>/ passen
  title: 'Mein Spiel',        // Pflicht
  description: '...',         // Pflicht (Library-Karte)
  icon: '🎮',                 // Emoji, Pflicht
  accent: 'blue',             // Akzentfarbe der Karte, oder '' für Standard
  modalSize: 'middle',        // optional: 'normal' (Default) | 'middle' | 'big' | 'very-big'
  badge: '🚧In Bearbeitung',  // optional: kleines Label auf der Karte
  comingSoon: true,           // optional: Karte ohne "Spielen"-Button, nur Meta sichtbar
  lazyLoad: true,             // optional, rein dokumentarisch — der Hub lädt <id>.js ohnehin erst on-demand

  // Generisches {label,value}-Format — Hub zeigt die ersten zwei auf der
  // Karte, alle im Stats-Modal:
  getStats() { return [{ label: '...', value: ... }]; },
  getHighscores() { return [{ label: '...', value: ... }]; }, // optional, Top-Liste im Stats-Modal
  renderStats() { return '<div>...</div>'; },                 // optional: eigenes HTML statt der generischen Liste
  resetStats() { /* löscht NUR die eigenen Daten */ },

  // Optional, nur für Cozy-Home-Integration (siehe Abschnitt 2):
  pets: [ { id, name, species, ... } ],
});
```
`mount(container)`/`destroy()` gehören NICHT ins Manifest, sondern in `<id>.js` (siehe unten) — `manifest.js` registriert nur die Meta-Daten, ein zweiter `registerGame({id, mount, destroy})`-Aufruf aus `<id>.js` merged sie beim ersten "Spielen"-Klick nach (`window.registerGame` führt bestehende und neue Config per `Object.assign` zusammen, siehe `js/games.js:24-31`).

**`<id>.js` — Lifecycle-Vertrag**, am saubersten umgesetzt in `games/memory/memory.js`:
```js
(function () {                          // ── ganze Datei in einer IIFE ──
  const state = { /* Modul-lokaler State statt globaler Variablen */ };
  let els = {};

  function mount(container) {           // container = leerer Modal-Body (games.js:561: ready.mount(body))
    container.innerHTML = `...`;
    els = { /* container.querySelector(...) */ };
    /* Event-Listener verkabeln, Startzustand rendern */
  }

  function destroy() {                  // von games.js beim Schließen aufgerufen (closeGamePlayModal())
    stopTimer();                        // WICHTIG: laufende Timer/Intervals stoppen — sonst läuft ein
  }                                      // gameId, hier "sonst zählt er im Hintergrund weiter" (memory.js:198)

  window.registerGame({ id: 'memory', mount, destroy });
})();
```
**Wichtige Abweichung vom Rest der App:** Games sind der EINZIGE Ort in Nook, wo Code bewusst NICHT im globalen Scope liegt — `<id>.js` kapselt sich in eine IIFE, damit mehrfaches Mounten/Unmounten (Spiel öffnen/schließen/erneut öffnen) keine globalen Variablen verschmutzt oder kollidieren lässt. Das widerspricht nicht `nook-architektur-guard` Punkt 4 (globaler Scope) — es ist die dokumentierte Ausnahme dafür, weil Spiele wiederholt neu gestartet werden, andere Tabs aber nur einmal beim Laden initialisiert werden.

**Referenz-Vorlage zum Kopieren:** `games/memory/` — kein Cozy-Home-Pet, keine komplexe Sub-State-Maschine wie Tic-Tac-Toe (Varianten/KI-Schwierigkeit/History), kein eigener DB-Namespace wie Neon Dodge (`neon_dodge_*`-Keys statt des gemeinsamen `gameHighscores`), sondern der generische, kürzeste vollständige Fall: ein `DB.get('gameHighscores', {})`-Eintrag unter dem eigenen Spielnamen, simples `getStats()`/`resetStats()`, sauberes `mount()`/`destroy()` mit Timer-Cleanup. Für ein Spiel MIT Cozy-Home-Pet zusätzlich `games/snake/manifest.js` als Vorlage nehmen (siehe Abschnitt 2). CSS-Klassen im Muster `.<id>-*` präfixen (z.B. `.memory-board`), kein Scoping-Mechanismus nötig, da immer nur ein Spiel gleichzeitig gemountet ist und dessen CSS beim Schließen wieder entfernt wird (`unloadGameCss()`).

Falls eine neue Spiel-Idee eine Launcher-Änderung zu benötigen SCHEINT: das ist ein Warnsignal. Erst hinterfragen, ob das Spiel wirklich außerhalb des Plugin-Systems liegen muss, bevor der Launcher angefasst wird.

## 2. Cozy Home - virtuelles Haustiersystem (cross-Game)

Die Schnittstelle ist bewusst schmal und läuft über GENAU ZWEI Kanäle — kein Funktionsaufruf, kein Custom Event:

**a) Deklarativ, statisch — nur fürs Haustier selbst:** Ein Spiel trägt optional ein `pets`-Array in sein eigenes `manifest.js` ein (vollständiges, verifiziertes Feld-Set, siehe `games/snake/manifest.js:58-90`):
```js
pets: [{
  id, name, species, description,
  favoriteFood, favoriteFoodName, favoriteFoodEmoji, favoriteActivity, traits,
  playHappinessBase, playHappinessBall, hungerDecayMultiplier,
  sourceGame,                       // eigene Spiel-ID, für "Exklusiv aus …"
  shopPrice,
  assets: { basePath: "games/<id>/assets/pets/<petId>/" },  // icon.png/default.png/sleep.png..., fehlende fallen auf default.png zurück
  thoughts: { hungry: [...], tired: [...], lonely: [...], happy: [...] },  // Sprechblasen-Texte
  unlock: { type: "highscore" | "gamesPlayed", target: "<eigene-spiel-id>", value: 250, description: "..." },
}]
```
`games/cozy-home/pets.js:231-245` (`collectCrossGamePets()`) scannt beim Mount `window.GameHub.registry`, sammelt aus jedem Eintrag mit einem `pets`-Array die Definitionen ein und merged sie in `PET_DEFINITIONS` (bereits vorhandene IDs werden nicht überschrieben). Ein neues Pet anzulegen ist damit rein datengetrieben: Array-Eintrag im eigenen Manifest + Asset-Ordner, keine Änderung an Cozy-Home-Code nötig.

**b) Geteilter State — nur zum Lesen, nicht zum Schreiben:** Die `unlock`-Bedingung wird von `checkUnlock()` in `games/cozy-home/pets.js:190-218` generisch ausgewertet, indem **derselbe** `DB.get('gameHighscores', {})`-Key gelesen wird, den jedes Spiel für sein eigenes `getStats()`/`resetStats()` sowieso pflegt (`type: "highscore"` → `scores[target].best`, `type: "gamesPlayed"` → `scores[target].totalGames`). Neue `unlock.type`-Werte werden in `checkUnlock()` selbst ergänzt (Kommentar zeigt vorbereitete, noch ungenutzte Typen wie `"achievement"`).

**Was NICHT geteilt wird:** `FOOD_REGISTRY`, `TOY_REGISTRY` und `PREFERENCE_LEVELS` (Cozy Homes eigenes Futter/Spielzeug/Vorlieben-System) sind rein interne `const`-Objekte direkt in `games/cozy-home/cozy-home.js` (Zeile ~203-247, ~538-547) — kein anderes Spiel kann darüber eigenes Futter/Spielzeug registrieren, nur Pets sind cross-Game. Der Laufzeit-State des Haustiers selbst (Hunger/Energie/Happiness) lebt ausschließlich im eigenen Cozy-Home-Save, wird nirgends an das Ursprungsspiel zurückgemeldet.

## 3. Sticker-Architektur (Garden: Pflanzendex, Anzuchtfeld)

Zwei getrennte Schritte — Katalog-Daten (statisch, `js/garden-catalog.js`) vs. Instanz erzeugen (Laufzeit, `js/garden.js`):

**Neue Farbvariante einer bestehenden Pflanze:** Bild-Datei in `img/decor/` ablegen (Dateiname-Schema `<präfix>_<variantenname>.png`, z.B. `rose_pink.png`) + Dateiname in `window.GARDEN_ASSET_FILES` (`garden-catalog.js:16-38`) ergänzen. `buildGardenCatalog()` gruppiert automatisch nach dem Teil vor dem ersten `_` — fertig, kein weiterer Schritt nötig. Optional: Zusatz-Tags für diese Variante in `window.GARDEN_VARIANT_TAGS` (z.B. `'rose_pink.png': ['pink']`); `"shiny"`-Varianten sind über `GARDEN_SHINY_WEIGHT` (0.15) automatisch selten.

**Neue Pflanze (neuer Namens-Präfix):** Zusätzlich ein Eintrag in `window.GARDEN_PLANT_META` (`garden-catalog.js:60ff`) mit `label` (deutscher Anzeigename), `category`, `tags` (für spätere Gartenrätsel) und `form` — `form` muss einen bestehenden Schlüssel aus `window.GARDEN_FORM_DEFS` referenzieren (`flower` | `tree` | `bush` | `berry` | `vine` | `hanging` | `groundcover`), der den generischen Pflanzenkörper (`img/decor/stem_small.png` usw.) und die Anker-Koordinaten für die Blüte/Frucht festlegt. Falls der Präfix nur eine lose Kategorie ist (mehrere unterschiedliche Pflanzen, keine Farbvarianten derselben Pflanze — Beispiel `berry_*`: Brombeere/Blaubeere/Himbeere sind verschiedene Pflanzen), den Präfix zusätzlich in `GARDEN_STANDALONE_PREFIXES` eintragen, sonst würden alle Dateien fälschlich als Farbvarianten EINER Pflanze gruppiert.

**Instanz erzeugen (Laufzeit):** `addGardenPlant(plantId)` in `js/garden.js:378-401` baut den vollständigen Sticker-Datensatz auf einmal (kein separates Nachreichen von Feldern später — siehe `nook-architektur-guard`, Migrationsprinzip):
```js
function addGardenPlant(plantId) {
  const plant = gardenPlantById(plantId);
  const variant = gardenPickVariant(plant);       // gewichtete Zufallsauswahl der Farbvariante
  const sticker = { id: crypto.randomUUID(), type: 'plant', plantId, scene: 'nursery',
                     x, y, scale: 1, flipX: false, order: Date.now(),
                     growthStage: 'seed', decorationAsset: variant.file, plantedAt: Date.now() };
  gardenStickers.push(sticker);
  saveGardenStickers();
  registerGardenDiscovery(plant, variant);         // trägt automatisch ins Pflanzendex ein
  renderGardenNursery();
  startGardenGrowthTicker();
}
```
Der Pflanzendex-Eintrag (`gardenDex`) wird NICHT manuell gepflegt — `registerGardenDiscovery()` (`garden.js:411-422`) erkennt selbst, ob Pflanze/Variante neu ist, trägt `firstSeen`/`variants` ein und zeigt eine Entdeckungs-Notiz. Ein neuer Sticker-TYP (aktuell existiert nur `type: 'plant'`, Deko/Easter-Eggs sind laut `garden.md` für später vorgesehen) müsste dieselbe gemeinsame `gardenStickers`-Struktur nutzen (`type`/`tags` unterscheiden, nicht ein Parallelsystem) — siehe `AI documentation/garden.md`, Abschnitt "Sticker-Architektur".

Dieses Muster ist die Vorlage für ähnliche "Sammelbare Items"-Features in anderen Tabs, falls sowas mal gebraucht wird.

## 4. Neue Tabs / Unterseiten mit interner Navigation (Projekte-Tab als Referenz)

**Kein echtes Deep-Linking auf einzelne Projekte — bewusst so, nicht geplant.** Eine Projekt-spezifische URL-Route (z.B. eine ID in der Adresszeile, die einen Reload auf genau dieses Projekt zurückführt) existiert im aktuellen Code nicht und ist auch nicht vorgesehen. Grep über `js/*.js` nach `hash`/`pushState`/`replaceState`/`URLSearchParams` findet außerhalb von `main.js` keine Treffer. Was tatsächlich läuft:

- **App-weites, generisches Tab-Routing** (main.js, gilt für ALLE Tabs gleich, nicht Projects-spezifisch): `showView(name)` spiegelt beim Tab-Wechsel den Tab-Namen per `history.replaceState(null, '', '#'+name)` in die URL (main.js:483-485, KEIN `location.hash=`, damit kein zusätzlicher History-Eintrag und kein rekursives `hashchange` entsteht). Ein `hashchange`-Listener (main.js:496-499) erlaubt manuelles Ändern des Hashs/Zurück-Navigation, um zu einem Tab zurückzuspringen. `settings.js:349` liest `location.hash` einmalig beim Start für die initiale View. Das reicht bis `#projects` — NICHT bis zu einem einzelnen Projekt.
- **Projekt-Detailansicht selbst ist reiner In-Memory-State, nicht URL-gebunden:** `openProjectDetail(projectId)`/`closeProjectDetail()` in `js/forest.js:466-495` setzen eine globale Variable `currentDetailProject` und blenden `#view-project-detail` per `style.display` ein/aus — keine Hash-/Query-Param-Änderung, kein Reload würde zur Detailansicht zurückführen, kein Teilen-Link auf ein bestimmtes Projekt möglich.

**Bestätigt (Rückfrage beim Projekt-Owner):** Der Git-Commit-Titel „Projekte: URL-Routing" (81ea225) meint ausschließlich die interne Navigation zwischen Wald-Übersicht und Projekt-Detailansicht — also genau die zwei Punkte oben (das generische `#<tabname>`-Hash-Routing aus `main.js` + `openProjectDetail()`/`closeProjectDetail()` als In-Memory-Zustandsmaschine). NICHT gemeint und nicht geplant: einzelne Projekte über die URL teil- oder direkt aufrufbar machen. Für einen neuen Tab mit ähnlicher Übersicht↔Detail-Navigation ist dieses Zwei-Schichten-Muster (App-weiter Tab-Hash + tab-interner In-Memory-State für die Unteransicht, ohne eigene URL-Reflektion der Unteransicht) die aktuelle Vorlage — nicht ein eigenes URL-Schema pro Unteransicht erfinden.

## 5. Theme-Engine-Erweiterung (Einstellungen)

Eigene Themes, Hintergrundbilder und Grafik-Themes leben in `js/theme-engine.js` + `css/theme-engine.css` (aus dem Fork „Core" übernommen, ersetzt den früheren `js/theme-builder.js`). Die Engine ist **absichtlich NICHT** an das Farbsystem aus `hub-utils.js` (`initColorPickerWidget`/`computeUserColorVars`) angebunden — `hub-utils.js` leitet die Darstellung EINES UI-Elements aus einer Nutzerfarbe ab, die Theme-Engine baut ein KOMPLETTES Theme (`--bg`/`--surface`/`--text`/`--sage`/… fürs ganze `:root`). Sie nutzt nur `mixHex()` aus hub-utils.js als Rechenhilfe.

**Aufbau:**
```js
// js/theme-engine.js
let customThemes = DB.get('customThemes', []);
// [{id, name, family, coreColors:{bg,surface,nav,modal,text,border,accent,font},
//   cardOpacity, fontSize, bg:{source,data,name,size,dim},
//   calendar:{imageTheme}, startHeader:{banner}, branding:{theme}, graphics:{mode,theme}}]
let themeBackgrounds = DB.get('themeBackgrounds', {});  // Bild der 6 eingebauten Themes

deriveThemeVars(core, cardOpacityPct, fontSizePct)        // Kernfarben -> alle CSS-Variablen
applyThemeEngine(id)                                      // von setTheme() (main.js) aufgerufen
```
Ein eigenes Theme ist ein weiterer gültiger `theme`-Wert (seine ID) — `setTheme()` (main.js) bleibt der EINZIGE Ort, der `theme` setzt, und ruft danach `applyThemeEngine(theme)` auf (Farben live aus `coreColors` abgeleitet, Hintergrund, Kalenderbild, Start-Banner, Icon). Altes Format `{id,name,family,vars}` wird beim Laden per IIFE migriert.

**Neue Editor-OPTION:** Feld im Modal (`#theme-builder-<name>`) + in `readThemeBuilderCore()`/`fillThemeBuilderForm()`/`saveThemeBuilder()` + ggf. `deriveThemeVars()` und `CUSTOM_THEME_VARS` ergänzen. Neue CSS-Variable aus dem Theme → in `main.css` einen Default in `:root` setzen.
**Neues festes Theme** (wie Cotton Candy): Eintrag in `PRESET_THEMES` (gleiches Format wie `customThemes`, ID mit Präfix `preset_`) — erscheint automatisch in der Auswahl, ist nicht löschbar, ✎ speichert eine Kopie. Fest in CSS gibt es nur noch `light` (Anzeige „Cozy") und `dark` („Classic Dark"); Midnight/Forest/Espresso/OLED wurden entfernt (`REMOVED_BUILTIN_THEMES` in main.js migriert auf `dark`).
**Neues Grafik-Set** (wie Cozy/Sci-Fi): Bilder als WebP nach `assets/themes/<id>/` (`background`, `spring/summer/fall/winter`, `banner-day/-night`, `icon.png`), Eintrag in `GRAPHICS_THEMES`, plus die Attributselektoren in `css/calendar.css` (`[data-cal-image-theme]`) und `css/today.css` (`[data-start-header-theme]`).
**Schriftgrößen:** jede `font-size` in `css/` ist `calc(Npx * var(--core-font-scale))` — neue Regeln genauso schreiben. Echte Code-Darstellung nutzt `var(--core-code-font)`, nicht `var(--mono)` (das wird von eigenen Themes auf die Theme-Schrift gesetzt).

## 6. Multi-File-Tab-Split (für wachsende Tabs, z.B. Budget)

Budget ist das einzige Beispiel im Code für einen auf mehrere Dateien gesplitteten Tab — konkretes, verifiziertes Muster als Vorlage:

**Datei-Aufteilung + Ladereihenfolge** (`index.html`, in dieser Reihenfolge):
```
js/budget.js              — Kern: Datenmodell (kontostand, budgetRecurring, budgetGoals, ...),
                             Übersicht-Rendering, Finanzgarten, Sub-Tab-Switcher
js/budget-taschengeld.js
js/budget-sparziele.js    — Sparziele; Single Source of Truth, die andere Budget-Dateien lesen
js/budget-financing.js    — Finanzierungs-Engine ("Jedem Euro einen Job")
js/budget-analysis.js
js/budget-debts.js
js/budget-sparprognose.js
js/budget-sparplaene.js
```
Jede Folgedatei dokumentiert ihre eigene Positionsanforderung als Kopfkommentar statt sich implizit auf die `index.html`-Reihenfolge zu verlassen — Vorlage aus `budget.js` Zeile 1-7: *"Lade-Reihenfolge: budget.js -> budget-sparprognose.js -> budget-sparplaene.js"*; `budget-financing.js` dokumentiert explizit: *"Muss NACH budget.js und budget-sparziele.js geladen werden (nutzt `goalMonthlyReserveEquivalent()`) und VOR budget-sparprognose.js (nutzt `sparplanTotalReserved()`)."*

**Praktisches Vorgehen für einen neuen wachsenden Tab:**
1. Kernfunktionalität + Datenmodell bleibt in `<tab>.js`, jede neue Datei bekommt einen klar abgegrenzten fachlichen Ausschnitt (nicht nach Dateigröße splitten, sondern nach Konzept, wie Budget es nach Sparziele/Financing/Analysis/Debts trennt).
2. Neue Datei-Kopf dokumentiert explizit, wovor/wonach sie laden muss und WARUM (welche Funktion/Variable aus welcher Vorgängerdatei sie braucht) — Budget-Kommentarstil 1:1 übernehmen.
3. `<script>`-Tag an der richtigen Stelle in `index.html` einfügen (siehe `nook-architektur-guard`, Abschnitt 2 für die volle App-Ladereihenfolge).
4. Falls eine Datei als "Single Source of Truth" für ein Konzept dient (wie `budget-sparziele.js` für Sparziele), das im Kopfkommentar der Datei selbst UND in allen lesenden Folgedateien vermerken.

## 7. View-Lifecycle (showView/renderView)

**Befund, ebenfalls abweichend vom Platzhalter — es gibt KEINEN generischen Cleanup-/Unmount-Hook.** `showView(name)` (main.js:469-486) macht ausschließlich: alle `.view`-Elemente/`.nav-btn` deaktivieren → das Ziel-`.view` + zugehörige Nav-Buttons aktivieren → `currentView = name` setzen → `renderView(name)` aufrufen → URL-Hash aktualisieren. `renderView(name)` (main.js:534-546) dispatcht nur an die render-Funktion des NEU betretenen Tabs (`if(name==='garden'){ renderGarden(); }` usw.) — es gibt keinerlei Aufruf für den Tab, der gerade VERLASSEN wird, keine `onLeave`/`destroy`-Callback-Konvention wie im Games-Plugin-System (Abschnitt 1).

**Das etablierte Muster für Cleanup ist deshalb Selbst-Terminierung durch Polling gegen den globalen `currentView`-State**, nicht ein externer Cleanup-Aufruf. Bestes Beispiel — `startGardenGrowthTicker()` in `js/garden.js:682-694`:
```js
function startGardenGrowthTicker() {
  clearInterval(_gardenGrowthTicker);
  if (!nurserySticker().some(p => gardenGrowthStage(p.plantedAt).key !== 'grown')) return;
  _gardenGrowthTicker = setInterval(() => {
    // Prüft bei JEDEM Tick selbst, ob die Ansicht noch aktiv ist — main.js
    // ruft beim Verlassen NICHTS auf, das den Ticker stoppen würde.
    if (currentView !== 'garden' || gardenActiveSubtab !== 'garden') { clearInterval(_gardenGrowthTicker); return; }
    if (!nurserySticker().some(p => gardenGrowthStage(p.plantedAt).key !== 'grown')) clearInterval(_gardenGrowthTicker);
    // sonst: neu rendern
  }, 1000);
}
```
Verwandtes, schwächeres Muster (Render-Guard statt Interval-Selbstabbruch) in `js/calendar.js:477`: `if (currentView === 'calendar') renderCalendar();` — verhindert unnötiges Rendern eines gerade unsichtbaren Tabs, kein Interval beteiligt.

**Nicht jeder Timer braucht das:** `js/today.js:326` (Sidebar-Uhr), `js/positivity.js:612` (Positivity-Widget) und `js/pwa.js:23` (Service-Worker-Update-Check) laufen bewusst OHNE `currentView`-Guard weiter, unabhängig vom aktiven Tab — vertretbar, weil sie global/günstig sind bzw. ihr Widget auf mehreren Tabs sichtbar sein kann. `js/tools-timer.js` läuft ebenfalls tab-unabhängig weiter, weil ein laufender Timer beim Tab-Wechsel absichtlich weiterlaufen soll (Feature, kein Bug).

**Für ein neues Feature mit Interval/Timer:** Falls es nur auf einem Tab sichtbar/relevant ist, selbst einen `currentView`-Check (und ggf. Subtab-Check wie `gardenActiveSubtab`) an den Anfang der Intervall-Callback setzen und bei Nichtübereinstimmung `clearInterval()` aufrufen — wie `garden.js`, nicht auf einen externen Cleanup-Aufruf von `showView()` warten, den es nicht gibt.

## Vorgehen

1. Zuerst klären: welches der 7 Muster oben betrifft die Anfrage?
2. Passendes bestehendes Beispiel im Code als Vorlage lesen (nicht aus dem Gedächtnis nachbauen).
3. Neues Feature strukturell identisch zur Vorlage aufbauen, nur Inhalt/Namen anpassen.
4. Am Ende gegen `nook-architektur-guard` und `nook-konventionen` gegenchecken.
5. Bei Abschnitt 4 (interne Navigation statt echtem URL-Routing) und 5 (Theme-Engine) gilt: die Befunde weichen vom ursprünglich angenommenen Muster ab (siehe dortige Hinweise, für Abschnitt 4 bereits geklärt und bestätigt) — bei ähnlich gelagerten neuen Fällen ohne bestätigten Befund im Zweifel vor der Umsetzung kurz nachfragen statt ein nicht existierendes Muster fortzuschreiben.
