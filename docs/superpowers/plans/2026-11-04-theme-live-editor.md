# Theme live bearbeiten (Etappe 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Modus „Theme live bearbeiten“, der Nook mit Musterdaten in einem abgeschotteten Fenster zeigt, in dem jedes angemeldete Element (Etappe 1: Heute + übergreifende Elemente) per Stift in Bild, Farben, Schrift, Form und Befestigung gestaltet und am eigenen Theme gespeichert wird.

**Architecture:** `js/theme-skins.js` kennt die angemeldeten Elemente und baut aus `ct.skins` ein Stylesheet über den Seitenstilen. Das Musterfenster ist dasselbe `index.html?themeLab=1` in einem Vollbild-iframe; `js/theme-lab-boot.js` ersetzt dort vor allen anderen Skripten `window.localStorage` durch einen Speicher im Arbeitsspeicher, füllt ihn mit Musterdaten und dem zu bearbeitenden Theme; `js/theme-lab.js` legt Stifte und Panel darüber. Gespeichert wird per `postMessage` im Hauptfenster.

**Tech Stack:** Plain JS ohne Build (globale Skripte), CSS, Node-Tests mit `node:test` in `desktop/test`, Canvas für Bildverkleinerung.

**Spec:** `docs/superpowers/specs/2026-11-04-theme-live-editor-design.md`

## Global Constraints

- Keine ES-Module, kein Bundler; neue Dateien als `<script>` in `index.html` in der richtigen Reihenfolge. Rechnende Dateien nutzen das Muster von `js/sync-crypto.js` (`module.exports` in Node, sonst `globalThis`).
- Keine festen Farben außerhalb von Theme-Definitionen (CLAUDE.md). UI des Editors nur mit Theme-Variablen; Nutzerfarben und Illustrationen sind erlaubt.
- UI-Texte deutsch.
- Im Musterfenster darf nichts in den echten `localStorage`, nach Supabase oder zu Google gelangen.
- `appId`, `productName`, `app://nook` nie ändern.
- Grenzen aus der Spec: Schriftgröße 80–140 %, Ecken 0–40 px, Schräglage −3° bis 3°, Deckkraft 30–100 %, Bildkante Rahmen/Fläche ≤ 1200 px, Befestigung/Extras ≤ 256 px.
- `null` = „vom Seitenstil/Theme“; `fastener.kind: 'none'` = ausdrücklich keine Befestigung.
- Deploy nur über `scripts/deploy.ps1` aus dem Hauptcheckout; `js/sync-config.js` nie committen.

## Review Focus

1. Musterfenster in Firefox (Nutzerin nutzt Firefox): greift der `localStorage`-Ersatz dort? Wenn nicht, muss das Fenster mit Hinweis abbrechen, nicht still echte Daten nutzen. → Test in Task 3 (Fake-Window mit Getter auf dem Prototyp) + Abbruchpfad in Task 6.
2. Speicher voll beim Speichern (mehrere Rahmenbilder): Hauptfenster darf das Theme nicht halb geändert zurücklassen, Musterfenster bleibt offen. → Test in Task 6 (Rollback bei Fehler in `applyLabSave`).
3. Element-Design in Cozy, wo das Element kein `::before` hat bzw. `overflow:hidden`: Rahmenbild muss trotzdem erscheinen. → Prüfschritt in Task 2 (Speiseplan als Tafel im Cozy-Stil).
4. Nachricht an das Hauptfenster von fremder Quelle (anderes Fenster, Erweiterung): wird ignoriert. → Test in Task 6 (`isLabMessage`).
5. Import eines Themes aus neuerer Version mit unbekannten Element-IDs: Rest bleibt erhalten, Hinweis erscheint. → Test in Task 1 (`sanitizeSkins` mit unbekannter ID).

---

### Task 1: Rechenkern `js/theme-skins.js`

**Files:**
- Create: `js/theme-skins.js`
- Test: `desktop/test/theme-skins.test.js`

**Interfaces:**
- Produces (Node: `module.exports`, Browser: global):
  - `createSkinRegistry() → { register(def), list(view?) → def[], get(id) → def|null, ids() → Set }` — Reihenfolge: Sammelelemente (`group: true`) vor Einzelelementen, sonst Anmeldereihenfolge. `view: '*'` = überall.
  - Target-Definition `{ id, label, view, selector, group?, heading?, extras?: [{ key, label, selector, kind: 'background'|'content' }] }`. Standard für `heading`: `'h1,h2,h3,h4,.panel-title,.panel-header,.panel-label'`.
  - `SKIN_TEMPLATES` (Array `{ id, label, src, slice:[t,r,b,l], width:[t,r,b,l] }`) mit genau diesen Einträgen aus den RPG-Stylesheets: `chalkboard` „Tafel“ `assets/today/chalkboard.webp` 48/48/78/48 · 16/16/26/16; `plaque` „Holzschild“ `assets/today/plaque.webp` 95 · 22; `note` „Pergament“ `assets/questboard/note.webp` 44 · 22; `note-rag` „Büttenpapier“ `assets/questboard/note-rag.webp` 40 · 22; `letter` „Brief“ `assets/today/letter.webp` 110 · 30; `notepad` „Notizblock“ `assets/today/notepad.webp` 85/40/45/85 · 30/16/18/30; `strap` „Lederriemen“ `assets/today/wallcal-strap.webp` 72/70/70/70 · 34/33/33/33; `desk` „Holztisch (Fläche)“ `assets/today/desk.webp` (Fläche, Kacheln).
  - `SKIN_FASTENERS` `{ pin: {src:'assets/questboard/pin.webp', w:19, h:25}, tack: {tack-iron.webp, 28,28}, copper: {nail-copper.webp, 24,24}, nail: {pin-nail.webp, 22,29}, seal: {seal.webp, 38,38} }` und `SEAL_FILTERS` `{ red: 'none', green: 'hue-rotate(115deg) saturate(.75) brightness(.95)', black: 'grayscale(1) brightness(.5) contrast(1.2)', blue: 'hue-rotate(200deg) saturate(.8)', gold: 'sepia(1) saturate(2.2) brightness(1.15)' }`.
  - `resolveSkinSrc(src) → string|null` (`'tpl:<id>'` → Template-Pfad, Bild-data-URL → sich selbst, sonst `null`).
  - `buildSkinCss(skins, registry) → string`.
  - `sanitizeSkins(raw, notes: Set<string>, { registry, fonts: Set<string> }) → object|null`.

- [ ] **Step 1: Tests schreiben** (`desktop/test/theme-skins.test.js`, Registry mit `today.cards` (group, Selektor `#view-today .card`) und `today.menu` (`#mealplan-widget`, extras `[{key:'deco', selector:'.x', kind:'background'}]`)):
  - `buildSkinCss({}, reg) === ''` und ein Skin nur aus `null`-Feldern erzeugt `''`.
  - Alle Regeln beginnen mit `:root[data-theme-skins] ` und jede Deklaration endet auf `!important`.
  - `colors.text: '#112233'` → enthält `#mealplan-widget{` … `color:#112233 !important`.
  - `image: {mode:'frame', src:'tpl:chalkboard', slice:[48,48,78,48], width:[16,16,26,16]}` → enthält `#mealplan-widget::before{` mit `border-image:url("assets/today/chalkboard.webp") 48 48 78 48 fill / 16px 16px 26px 16px / 0 stretch !important`, `content:'' !important`, `z-index:-1 !important`; Element-Regel enthält `isolation:isolate !important` und `background:transparent !important`.
  - `image: {mode:'tile', src:'tpl:desk'}` → `::before` mit `background:url("assets/today/desk.webp") top left / auto repeat !important` und `border-image:none !important`.
  - `shape.tilt: 2` mit Bild → `rotate(2deg)` steht in der `::before`-Regel, nicht in der Element-Regel; ohne Bild in der Element-Regel.
  - `fastener: {kind:'seal', position:'right', color:'green'}` → `::after` mit `left:86%`, `url("assets/questboard/seal.webp")`, `filter:hue-rotate(115deg)…`; `{kind:'none'}` → `::after{display:none !important}`.
  - Sammel- vor Einzelregel: Index von `#view-today .card{` < Index von `#mealplan-widget{`, auch wenn `skins` die Einzel-ID zuerst enthält.
  - `extras.deco: 'tpl:note'` → Regel `#mealplan-widget .x{background-image:url("assets/questboard/note.webp") !important…}`.
  - `sanitizeSkins`: gültiges Design bleibt gleich; unbekannte ID wird entfernt und `notes` enthält einen Eintrag, die übrigen IDs bleiben; `colors.text: 'red'` → `null`; `font.text` nicht in `fonts` → `null`; `shape.tilt: 9` → `3`, `shape.radius: -5` → `0`, `font.size: 300` → `140`; `image.src: 'data:text/html;base64,AAAA'` → Bild entfernt + Hinweis; `image.src: 'javascript:x'` → entfernt; `fastener.kind: 'rocket'` → `null`; komplett leeres Ergebnis → `null`.
- [ ] **Step 2: Tests laufen lassen** — `cd desktop && node --test test/theme-skins.test.js` → FAIL (Modul fehlt).
- [ ] **Step 3: `js/theme-skins.js` implementieren** — Regeldetails:
  - Element-Regel: `color` (text), `background` (surface ohne Bild; mit Bild `transparent`; mit `shape.opacity` als `color-mix(in srgb, X N%, transparent)`), `--sage` (accent), `border-color` (border; mit Bild `transparent`), `font-family` (font.text), `zoom: N%` (font.size ≠ 100), `border-radius`, `box-shadow` (`none` | `soft` = `0 4px 14px color-mix(in srgb, var(--shadow-tint) 35%, transparent)` | `strong` = `0 10px 28px color-mix(in srgb, var(--shadow-tint) 55%, transparent)`), `padding`, bei Bild `position:relative; isolation:isolate`.
  - Überschriften-Regel: `<sel> :is(<heading>)` mit `color` (heading) und `font-family` (font.heading).
  - `::before` nur bei Bild: `content:''; display:block; position:absolute; inset:0; z-index:-1; pointer-events:none; border-radius:inherit; filter:none; transform: rotate(tilt)|none; opacity: N/100`; Rahmen = `border-style:solid; border-color:transparent; border-width; border-image … fill …; background:none`; Fläche = `border:0; border-image:none; background:url() center / cover no-repeat`; Kacheln = `… top left / auto repeat`.
  - `::after` Befestigung: `content:''; display:block; position:absolute; top:-10px; left:14%|50%|86%; right:auto; width; height; margin-left:-w/2 px; background:url() center / contain no-repeat; filter; z-index:3; pointer-events:none`; `kind:'custom'` nutzt `fastener.src` mit 28×28.
  - Gruppen-Selektoren mit Komma werden als `:is(...)` gekapselt, damit das Präfix für alle Teile gilt.
  - `sanitizeSkins`: Farben `^#[0-9a-f]{6}$`i; Bild-Quellen `tpl:<bekannt>` oder `^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$` mit ≤ 4 MB (Befestigung/Extras ≤ 1 MB); `slice` 0–1000, `width` 0–120 (Ganzzahlen, 4 Werte); `padding` 0–60; Enums `mode`, `shadow`, `kind`, `position`, `color` (Schlüssel von `SEAL_FILTERS`); Extras nur mit beim Target angemeldetem `key`.
- [ ] **Step 4: Tests laufen lassen** — `cd desktop && npm test` → alle PASS (bestehende Tests eingeschlossen).
- [ ] **Step 5: Commit** — `git add js/theme-skins.js desktop/test/theme-skins.test.js && git commit -m "Theme-Skins: Rechenkern (Registry, CSS, Pruefung)"`

### Task 2: Skins im echten Nook anwenden und Elemente anmelden

**Files:**
- Modify: `index.html` (`<script src="js/theme-skins.js">` direkt nach `js/theme-engine.js`)
- Modify: `js/theme-skins.js` (Browser-Teil: globale Registry `nookSkinRegistry`, `registerSkinTarget(def)`, `applyThemeSkins(themeId, skinsOverride?)`, globale Targets)
- Modify: `js/theme-engine.js` (`applyThemeEngine` ruft `applyThemeSkins(id)`; `getCustomTheme` liefert bei Nachtversion `skins` der Basis mit — prüfen, `Object.assign({}, base, …)` tut das bereits)
- Modify: `js/today.js` (am Dateiende `registerSkinTarget` für die Heute-Elemente)

**Interfaces:**
- Consumes: Task 1 (`createSkinRegistry`, `buildSkinCss`).
- Produces: `registerSkinTarget(def)`, `applyThemeSkins(themeId: string, skinsOverride?: object)`, `nookSkinRegistry` (Instanz von `createSkinRegistry`). `applyThemeSkins` setzt/entfernt `data-theme-skins` auf `<html>` und schreibt `<style id="theme-skins">` (am Ende von `<head>`, damit es nach allen Stylesheets kommt).

- [ ] **Step 1: Targets anmelden** — in `js/theme-skins.js`: `global.sidebar` `#sidebar`, `global.nav` `#sidebar .nav-btn`, `global.nav-active` `#sidebar .nav-btn.active`, `global.button` `.btn-primary` (alle `view:'*'`). In `js/today.js` (`view:'today'`): `today.cards` (group) `#view-today :is(.block-slot, #panel-tasks, #gd-widget, #clock-sidebar-panel, #panel-quicknote, #mealplan-widget, #today-mini-cal, #national-day-widget)`, `today.board` `#today-main, #today-right`, `today.banner` `#today-main-header`, `today.blocks` `#blocks-row .block-slot`, `today.tasks` `#panel-tasks` (extras `ribbon` „Lesezeichen“ `> .panel-header::after` kind `background`), `today.duties` `#gd-widget`, `today.clock` `#clock-sidebar-panel` (extras `case` „Uhr-Gehäuse“ `.rpg-clock-img` kind `content`, `face` „Zifferblatt“ `.clock-analog` kind `background`), `today.quicknote` `#panel-quicknote`, `today.minical` `#today-mini-cal`, `today.menu` `#mealplan-widget`, `today.dayinfo` `#national-day-widget`. Der Riemen des Mini-Kalenders ist sein Rahmenbild (Vorlage `strap`), kein Extra.
- [ ] **Step 2: `applyThemeSkins` + Aufruf in `applyThemeEngine`** einbauen; ohne Skins wird das `<style>` geleert und das Attribut entfernt.
- [ ] **Step 3: Im Browser prüfen** (lokaler Server, Cozy-Stil und RPG-Stil je einmal): in der Konsole einem eigenen Theme `skins = { 'today.menu': { image:{mode:'frame', src:'tpl:chalkboard', slice:[48,48,78,48], width:[16,16,26,16]}, colors:{text:'#f2efe6'}, fastener:{kind:'nail', position:'center'} } }` setzen, `setTheme(id)`. Erwartung: Speiseplan als Tafel mit heller Schrift und Nagel in beiden Stilen, keine anderen Elemente verändert, keine Konsolenfehler. Danach `skins` entfernen → Ursprungsoptik zurück.
- [ ] **Step 4: Commit** — `git commit -m "Theme-Skins: im Theme anwenden, Heute-Elemente angemeldet"`

### Task 3: Abgeschottetes Musterfenster (Boot)

**Files:**
- Create: `js/theme-lab-boot.js` (erstes `<script>` in `index.html`, vor `js/main.js`)
- Modify: `js/sync.js` (`initSync()` beginnt mit `if (window.NOOK_THEME_LAB) return;`), `js/pwa.js` (keine Registrierung im Lab), `js/settings.js` (`checkBackupReminder()` tut im Lab nichts)
- Test: `desktop/test/theme-lab-boot.test.js`

**Interfaces:**
- Produces: `createMemoryStorage(initial?: object) → Storage-ähnlich` (`getItem`, `setItem` (Werte als String), `removeItem`, `clear`, `key(i)`, `length`), `installThemeLab(win, { sample, copyKeys }) → boolean`, Globale `window.NOOK_THEME_LAB` (true im Lab), `window.NOOK_THEME_LAB_FAILED` (true, wenn der Ersatz nicht greift), `window.NOOK_THEME_LAB_THEME_ID` (aus `?theme=`).
- `installThemeLab` liest vor dem Ersetzen aus dem echten Speicher genau die Schlüssel `copyKeys = ['customThemes','theme','themeFamily','themeBackgrounds','themeAutoMode','dayNightToggle','uiFontScale','hubUserColors','tabOrder','hiddenTabs','userName']`, ersetzt `win.localStorage` per `Object.defineProperty(win, 'localStorage', { configurable: true, get: () => mem })`, prüft `win.localStorage === mem`, füllt `mem` mit `sample` und den kopierten Werten (kopierte gewinnen), setzt `theme` auf `NOOK_THEME_LAB_THEME_ID`, und verschluckt `storage`-Events (`win.addEventListener('storage', e => e.stopImmediatePropagation(), true)`).

- [ ] **Step 1: Tests schreiben** — Fake-Window, dessen `localStorage` ein Getter auf dem Prototyp ist (wie im Browser) und auf einen echten Map-Speicher zeigt:
  - `installThemeLab` gibt `true` zurück; danach landet `win.localStorage.setItem('tasks','[1]')` nicht im echten Speicher; `getItem('tasks')` liefert `'[1]'`.
  - `customThemes` aus dem echten Speicher ist im Lab lesbar; Schreiben darauf ändert den echten Speicher nicht.
  - Musterdaten stehen bereit (`sample = { blocks: '[…]' }`), kopierte Schlüssel überschreiben gleichnamige Musterdaten.
  - Fake-Window mit nicht konfigurierbarem `localStorage` (defineProperty wirft) → `installThemeLab` gibt `false` zurück und schreibt nichts.
  - `createMemoryStorage`: `setItem('a', 5)` → `getItem('a') === '5'`, `length`, `key(0)`, `removeItem`, `clear`.
- [ ] **Step 2: Tests laufen lassen** → FAIL.
- [ ] **Step 3: Implementieren** — Datei läuft im Browser nur bei `new URLSearchParams(location.search).get('themeLab') === '1'`; sonst nichts. `sample` kommt aus `window.THEME_LAB_SAMPLE` (Task 4, Datei wird vor dem Boot-Skript geladen; bis dahin `{}`).
- [ ] **Step 4: Gating** in `sync.js`, `pwa.js`, `settings.js` (je eine Zeile, mit Kommentar).
- [ ] **Step 5: Tests** — `cd desktop && npm test` → PASS.
- [ ] **Step 6: Im Browser prüfen** — `index.html?themeLab=1` öffnen: in der Konsole `localStorage.setItem('x','1')`, dann im normalen Tab `localStorage.getItem('x') === null`; Sync zeigt „nicht angemeldet“, Netzwerk-Tab ohne Anfragen an `supabase.co` außer evtl. Einstellungen-Abfrage, ohne Anmeldung.
- [ ] **Step 7: Commit** — `git commit -m "Theme-Lab: abgeschotteter Speicher im Musterfenster"`

### Task 4: Musterdaten für alle Seiten

**Files:**
- Create: `js/theme-lab-sample.js` (`window.THEME_LAB_SAMPLE = { … }`, Werte als JSON-Strings wie `DB.set` sie schreibt), in `index.html` direkt vor `js/theme-lab-boot.js`

**Interfaces:**
- Produces: `window.THEME_LAB_SAMPLE: { [key: string]: string }`.

- [ ] **Step 1: Datenformen ermitteln** — für jeden Schlüssel das Format aus dem Code lesen (Lade-/Migrationsfunktionen der jeweiligen Datei), nicht raten: `blocks`, `tasks`, `events`, `eventSeries`, `quicknote`, `mealPlanWeeks` (Woche der aktuellen KW + Folgewoche, damit der Speiseplan immer Daten hat), `gdGroups`, `gdPeople`, `gdDuties`, `gdSchedule`, `countdownVisible`, `todayTracker`, `subjects` (2 Fächer, je 2 Themen, je 6 Karten), Anleitungen (Schlüssel aus `js/guides*.js` ermitteln), `projects`, `deskCards`, `questCards`, `questWallet`, `kontostand`, `budgetRecurring`, `budgetOnetime`, `budgetGoals`, `budgetDebts`, `notes`, `shoppingList`.
- [ ] **Step 2: Datei schreiben** — Datumsangaben relativ zu „heute“ berechnen (die Datei ist ein Skript, kein JSON), damit Heute, Kalender und Speiseplan immer gefüllt sind. Nur erfundene, neutrale Inhalte (Fächer „Biologie“, „Geschichte“; Personen „Alex“, „Sam“, „Robin“, „Kim“).
- [ ] **Step 3: Im Browser prüfen** — `index.html?themeLab=1`: jede Seite öffnen (Heute, Kalender, Pinnwand, Projekte, Questboard, Karteikarten, Anleitungen, Budget, Spiele, Tools, Einstellungen). Erwartung: keine Konsolenfehler, alle zehn Heute-Elemente aus Task 2 sichtbar mit Inhalt, jede Seite zeigt Beispielinhalte.
- [ ] **Step 4: Commit** — `git commit -m "Theme-Lab: Musterdaten fuer alle Seiten"`

### Task 5: Editor im Musterfenster

**Files:**
- Create: `js/theme-lab.js` (lädt als letztes Skript, tut nur bei `window.NOOK_THEME_LAB` etwas), `css/theme-lab.css`
- Modify: `index.html` (Skript + Stylesheet)

**Interfaces:**
- Consumes: `nookSkinRegistry`, `applyThemeSkins`, `sanitizeSkins`, `SKIN_TEMPLATES`, `SKIN_FASTENERS`, `SEAL_FILTERS`, `FONT_CATEGORIES`/`CUSTOM_FONT_FILES` (theme-engine), der Nook-Farbwähler (normale `<input type="color">`).
- Produces: Nachrichten an `window.parent`: `{ type: 'nook-theme-lab:save', themeId, skins }`, `{ type: 'nook-theme-lab:close' }`; empfängt `{ type: 'nook-theme-lab:saved' }` / `{ type: 'nook-theme-lab:save-failed', message }`.
- Interner Zustand: `labSkins` (Arbeitskopie von `ct.skins`), `labHistory` (bis 50 Stände für Rückgängig), `labDirty`.

- [ ] **Step 1: Leiste oben** — Seitenwahl (alle Tabs per `showView`), „Rückgängig“, Speicherbedarf (`JSON.stringify(labSkins).length` als KB/MB), „Speichern“, „Abbrechen“ (fragt bei `labDirty` mit `hubConfirm`). Bei `NOOK_THEME_LAB_FAILED`: nur Hinweis „Das Musterfenster konnte nicht sicher von deinen Daten getrennt werden …“ und „Schließen“.
- [ ] **Step 2: Stifte** — für jedes Target der aktuellen Seite (`nookSkinRegistry.list(currentView)`, Sammelelemente zuerst, `'*'` immer) ein Knopf ✎ mit Namen als Tooltip, `position:fixed` an der rechten oberen Ecke von `document.querySelector(selector)` (bei Mehrfach-Treffern das erste sichtbare). Neu positionieren bei Scroll, Resize, Seitenwechsel und alle 500 ms (einfacher Abgleich statt MutationObserver). Sammelelemente bekommen ihren Knopf in der Leiste („Alle Karten“), nicht auf einer Karte.
- [ ] **Step 3: Panel** (rechts, 360 px) mit den sieben Abschnitten der Spec; jede Änderung → `labSkins[id]` setzen, `sanitizeSkins` auf den einen Eintrag, `applyThemeSkins(themeId, labSkins)`, Stand auf `labHistory`.
  - Bild: Modus (keins/Fläche/Kacheln/Rahmen), Vorlagen-Kacheln aus `SKIN_TEMPLATES`, „Eigenes Bild“ (Datei → verkleinern auf ≤ 1200 px Kante; Alpha-Kanal prüfen: mit Transparenz PNG, sonst `toDataURL('image/webp', 0.85)`, Rückfall JPEG wenn das Ergebnis nicht mit `data:image/webp` beginnt), Rahmen: 4 Zahlenfelder „Ecke im Bild“ + 4 „Randbreite“, gekoppelt per Schloss-Schalter; Vorschau des Bildes mit vier Hilfslinien an den Ecken-Werten.
  - Farben: fünf Felder mit Schalter „vom Theme“.
  - Schrift: zwei Auswahlen aus allen bekannten Stacks + „vom Theme“, Größe 80–140 %.
  - Form, Befestigung (mit Siegelfarbe bei `seal`, Datei bei `custom` → ≤ 256 px PNG), Extras (Datei oder Vorlage), „Zurücksetzen“.
- [ ] **Step 4: Speichern** — `postMessage` an `window.parent` mit `targetOrigin = location.protocol === 'file:' ? '*' : location.origin`; Knopf zeigt „Speichert…“ bis `saved`/`save-failed`; bei `save-failed` Meldung im Panel, Fenster bleibt offen.
- [ ] **Step 5: Handy** — unter 900 px Breite statt Stiften ein Hinweis „Zum Bearbeiten einen größeren Bildschirm nutzen“; Ansehen bleibt möglich.
- [ ] **Step 6: Im Browser prüfen** (direkt `index.html?themeLab=1&theme=<eigenes Theme>`): Speiseplan per Stift als Tafel (Vorlage), Kreideschrift (Farbe + Schrift), Nagel mittig; Blöcke mit eigenem hochgeladenem Bild als Rahmen; Rückgängig nimmt den letzten Schritt zurück; Zurücksetzen entfernt das Design; keine Konsolenfehler.
- [ ] **Step 7: Commit** — `git commit -m "Theme-Lab: Editor mit Stiften und Panel"`

### Task 6: Einstieg und Speichern im Hauptfenster, Export/Import

**Files:**
- Modify: `js/theme-engine.js`, `index.html`, `css/theme-engine.css`
- Test: `desktop/test/theme-lab-bridge.test.js`

**Interfaces:**
- Consumes: Task 1 (`sanitizeSkins`), Task 5 (Nachrichtenformat).
- Produces (in `js/theme-skins.js`, damit in Node testbar): `isLabMessage(event, frameWindow) → boolean` (nur `event.source === frameWindow` und `event.data.type` beginnt mit `'nook-theme-lab:'`), `applyLabSave(themes: object[], themeId, skins, { sanitize, save }) → { ok: boolean, message?: string }` — ersetzt `skins` des Themes, ruft `save()`; wirft `save()`, wird der alte Stand wiederhergestellt und `{ ok:false, message }` zurückgegeben.

- [ ] **Step 1: Tests schreiben** — `isLabMessage`: richtige Quelle + Typ → true; fremde Quelle → false; Typ ohne Präfix → false; `data` kein Objekt → false. `applyLabSave`: speichert bereinigte Skins; bei werfendem `save` ist `themes[i].skins` danach wieder der alte Wert (tief gleich) und `ok === false`; unbekannte `themeId` → `ok:false`.
- [ ] **Step 2: Tests laufen lassen** → FAIL; **Step 3:** in `js/theme-skins.js` implementieren; **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Einstieg** — Knopf „Theme live bearbeiten“ im Theme-Editor (neben „Speichern“) und als Symbol ✦ an eigenen Themes in der Auswahl. Ist das aktive Theme ein Preset oder eingebaut, zuerst eine Kopie „<Name> (eigen)“ anlegen (wie ✎ es heute tut) und aktivieren. Öffnet ein Vollbild-Overlay mit `<iframe src="index.html?themeLab=1&theme=<id>">`; ungespeicherte Änderungen im Theme-Editor vorher speichern lassen (Rückfrage).
- [ ] **Step 6: Nachrichten** — `message`-Listener prüft `isLabMessage`, bei `save` → `applyLabSave(customThemes, id, skins, { sanitize: s => sanitizeSkins(s, notes, ctx), save: saveCustomThemes })`, Antwort ans iframe, bei Erfolg Overlay schließen und `setTheme(id)`. `close` schließt das Overlay.
- [ ] **Step 7: Export/Import** — `sanitizeImportedTheme` übernimmt `src.skins` über `sanitizeSkins` (Hinweise in `notes`); Export braucht keine Änderung (kopiert das ganze Theme).
- [ ] **Step 8: Im Browser prüfen** — kompletter Ablauf aus der Spec („Von Hand im Browser“): echtes Nook → Theme live bearbeiten → Speiseplan als Tafel → Speichern → echtes Nook zeigt die Tafel; echte Aufgaben/Termine unverändert (vorher/nachher `localStorage.getItem('tasks')` vergleichen); Theme exportieren, löschen, importieren → Tafel wieder da.
- [ ] **Step 9: Doku** — `CLAUDE.md`: Absatz „Theme-Skins“ (neue Tabs melden gestaltbare Elemente mit `registerSkinTarget` am Dateiende an, wie bei der Suche; Musterdaten in `js/theme-lab-sample.js` ergänzen). README-Label laut Skill `nook-doku-status` prüfen.
- [ ] **Step 10: Commit + Deploy** — `git commit -m "Theme live bearbeiten: Einstieg, Speichern, Export/Import"`, push, `scripts/deploy.ps1`.
