# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nook is a personal organization hub (dashboard, calendar, budget, flashcards, wiki, projects, tools, games) that runs entirely client-side. There is no backend, no build step, and no `package.json` in the root folder (the Electron desktop app in `desktop/` has its own, see below). It is opened directly as `index.html` (`file://`), which is why several architectural choices (script-tag loading, no `fetch()` for local files, no ES modules/bundler) are load-bearing, not accidental.

The UI language is German; keep new UI strings, comments, and variable names in the existing style (German UI text, German or mixed German/English code comments — follow whatever the surrounding file already does).

## Running / testing

No install, build, or lint commands exist for the web app. The only automated web-app tests cover the pure schedule calculation: `node --test tests/schedule.test.js` (Node 18+, no dependencies; `tests/` is excluded from deploys). The desktop app has its own tests, see "Desktop app". To work on the app, open `index.html` in a browser (or serve the folder with any static file server). Verify changes by opening the relevant tab in a browser and exercising it manually — there is no automated test suite for the web app.

## Architecture

### Global-script, no-bundler model

All JS files are loaded via plain `<script src="...">` tags in `index.html`, in a specific order, and share one global scope — there are no ES modules and no `import`/`export`. Load order matters: later files reference `let`/`const`/functions defined by earlier files (e.g. `hub-utils.js` needs `DB` from `main.js`; `budget-sparziele.js` must load after `budget.js`; `budget-financing.js` after that). When adding a new file, add its `<script>` tag in the correct position in `index.html` and respect these dependencies.

`fetch()`/`XMLHttpRequest` do not work under `file://`, so nothing in the app uses them for local data — module registration and lazy-loading (see Games below) is done via dynamically injected `<script>`/`<link>` tags instead, and static config is plain `.js` files that set `window.X`, not `.json`.

### State & persistence (`js/main.js`)

- `DB` (`js/main.js`) is a tiny localStorage wrapper: `DB.get(key, fallback)` / `DB.set(key, val)`, JSON-serialized. It is the single persistence mechanism for the whole app — every feature's data lives under its own localStorage key(s), loaded once at startup into a top-level `let`, with a `saveX()` function that calls `DB.set` after mutation.
- Global mutable `let` variables declared at the top of `main.js` (`tasks`, `events`, `eventSeries`, `blocks`, `theme`, etc.) hold app state; per-tab files declare their own similarly-scoped globals (e.g. `budgetRecurring`, `budgetGoals` in `budget.js`).
- One-time migrations for old data shapes are run as an IIFE at load time (see `migrateTasksIfNeeded` in `main.js`, or the `hubUserColors` string→object migration in `hub-utils.js`). Follow this pattern when changing a stored data shape — never break existing users' localStorage.
- Theming is attribute-driven: `data-theme` (specific theme name) and `data-theme-family` (`light`/`dark`) on `<html>`, set via the central `setTheme()` in `main.js`. Never toggle theme by any other path.

### View / tab switching

`index.html` contains one `<div class="view" id="view-<name>">` per tab. `showView(name)` (main.js) toggles `.active` and calls `renderView(name)`, which dispatches to each tab's own `renderX()`/`initX()` entry point. Each tab's rendering, state, and DOM are owned entirely by that tab's JS/CSS file(s) — cross-tab reads are allowed (e.g. Today reads Calendar/Task data), but a tab should not reach into another tab's DOM or mutate its state directly.

### Per-tab file layout

Most tabs are one `js/<tab>.js` + one `css/<tab>.css`. Larger tabs are split into several `js/<tab>-<part>.js` files that share globals and must load in dependency order (documented in a header comment at the top of each file) — Budget is the largest example: `budget.js` (core: overview + Finanzgarten + sub-tab switcher) → `budget-sparziele.js` (savings goals, the single source of truth other budget files read from) → `budget-financing.js` (shared funding/reservation engine) → `budget-analysis.js`, `budget-debts.js`, `budget-sparprognose.js`, `budget-sparplaene.js`.

`js/hub-utils.js` holds cross-tab shared utilities loaded right after `main.js`: the user color system (`HUB_PALETTE_HEX`, `hubUserColors`, `initColorPickerWidget`, `computeUserColorVars`/`applyUserColorVars` — theme-aware derived colors from one base hex) and the shared code-block renderer (`renderCodeBlock`, used by Guides). It also has the only HTML escaper `escHtml`, the dialogs `hubConfirm`/`hubAlert`, the undo notice `hubUndo(message, restore)` and `loadScriptOnce(src)` for lazily loaded vendor scripts. Reach for these instead of re-implementing color pickers, code blocks, escaping or dialogs in a new tab.

`js/hub-search.js` (loaded right after `hub-utils.js`) is the global search (`Strg/⌘ + K`). Like the games launcher it knows no tab: each tab registers its own read-only source at the end of its own file via `registerSearchProvider({ id, label, icon, view, items })`, where each item has an `open()` that jumps there using that tab's existing functions. A new tab with user content should register a provider too. Contract: `AI documentation/search.md` (search never writes data except `searchRecent`).

### Theme-Skins and "Theme live bearbeiten"

Custom themes can carry per-element designs in `ct.skins` (image as 9-slice frame/fill/tile, colors, fonts, shape, fastener, extra images). `js/theme-skins.js` (loads after `theme-engine.js`) holds the pure core (`buildSkinCss`, `sanitizeSkins`, `isLabMessage`, `applyLabSave`, tested in `desktop/test/theme-skins.test.js` and `theme-lab-bridge.test.js`) and writes `<style id="theme-skins">` via `applyThemeSkins()`, which `applyThemeEngine()` calls. Like search, the editor knows no tab: each tab announces its stylable elements at the end of its own file with `registerSkinTarget({ id, label, view, selector, group?, extras? })` (files loading before `theme-skins.js` push onto `window.__pendingSkinTargets`). Stage 1 covers Today plus global elements; adding a tab = register its elements, no editor change.

The editor ("Theme live bearbeiten", ✦ on own themes or in the theme editor) opens `index.html?themeLab=1&theme=<id>` in a full-screen iframe. There, `js/theme-lab-boot.js` (first script) replaces `window.localStorage` with an in-memory store before anything else runs, fills it with `js/theme-lab-sample.js` plus the theme keys, and sets `window.NOOK_THEME_LAB` (sync, service worker and backup reminders stay off). If the replacement does not take, `NOOK_THEME_LAB_FAILED` is set and the editor only shows a notice. `js/theme-lab-panel.js` + `js/theme-lab.js` (last scripts) draw pencils and the panel; saving goes via `postMessage` to the main window, which checks and stores. When a tab gets new data keys that its stylable elements need to be visible, add sample values to `js/theme-lab-sample.js`. Never read or write real data from inside the lab.

### Games: self-registering plugin architecture

`js/games.js` is a pure launcher/container — it has zero knowledge of any individual game. It only knows the IDs in `games/games-list.js` (`window.GAMES_LIST`), and renders whatever registers itself via `window.registerGame(config)` into `window.GameHub.registry`.

Each game lives in `games/<id>/` and provides:
- `manifest.js` — metadata (title, description, icon, `getStats()`, `resetStats()`); loads immediately at hub startup so the library card can render.
- `<id>.js` — actual game logic (`mount(container)`/`destroy()`); lazy-loaded only on first "Spielen" click.
- `<id>.css` — injected on open, removed on close.

To add a game: create `games/<id>/` with the three files above, then add `<id>` to `window.GAMES_LIST` in `games/games-list.js`. Nothing in `games.js` or `index.html` needs to change. A work-in-progress game can ship as a manifest-only stub with `comingSoon: true` (no `.js`/`.css` needed yet).

Cozy Home (`games/cozy-home/`) additionally acts as a cross-game virtual pet system: other games can declare pets in their own `manifest.js`; Cozy Home scans `window.GameHub.registry` and merges them in without knowing their IDs in advance. Preferences/food/toys are registry-driven (`FOOD_REGISTRY`, `TOY_REGISTRY`, `PREFERENCE_LEVELS`) — adding a new food/toy/pet is data-only, no code changes.

### Desktop app (`desktop/`)

Electron shell around the unchanged web app, with its own `desktop/package.json` (the only `package.json` in the repo) and `node_modules`. It serves the app via the `app://nook` protocol. `desktop/` and `.github/` are listed in `.assetsignore` so they are not deployed; deployment honours `.assetsignore` only through `scripts/deploy.ps1`.

- Tests: `cd desktop && npm test`.
- Release: raise `NOOK_VERSION` in `js/nook-version.js` (plus a changelog entry), then push the tag `v<NOOK_VERSION>`. The workflow `.github/workflows/release.yml` builds for Windows, macOS and Linux and publishes via GitHub Releases (also the source of the in-app update check).
- **Never change** `appId` (`io.github.caseymazey.nook`), `productName` (`Nook`) or the origin `app://nook`: they determine where user data lives, so changing any of them makes users lose access to their data.

### `AI documentation/`

Per-tab spec documents (`budget.md`, `calendar.md`, `today.md`, etc.) describing each tab's purpose, design principles, ownership boundaries ("Zuständigkeiten": what the tab is/isn't responsible for), and explicit extension rules (what new features should/shouldn't do). These are product/design intent, not always in sync with current code structure (e.g. `budget.md` predates the multi-file Budget split) — treat them as the design contract to honor when extending a tab, but verify current file layout against the actual `js/`/`css/` files rather than assuming the doc is current.

## Conventions worth following

- New persisted data goes through `DB.get`/`DB.set` with a dedicated key and a `saveX()` setter, following the existing pattern in `main.js`/each tab file.
- New user-facing colors should go through the shared color system in `hub-utils.js`, not ad-hoc hex handling, so they stay theme-aware (light/dark auto-adjustment).
- **No hardcoded colors anywhere outside `games/<id>/`** (rule set by the project owner): no hex/rgb/named colors in CSS rules, inline styles or JS. Every UI color is a theme variable defined in `css/main.css` (`:root` + `[data-theme-family="dark"]`), ideally derived from the base tokens via `color-mix()` (`--text`, `--surface-solid`, `--bg`, `--sage`, `--shadow-tint` …) so it follows every theme automatically. Custom/preset themes set their values in `deriveThemeVars()` (`js/theme-engine.js`). Allowed literals: theme definitions themselves (token blocks in `main.css`, `PRESET_THEMES`/`THEME_REGISTRY`), user-chosen data colors and their defaults (palette, card/category colors), and illustration artwork (e.g. the Finanzgarten plant SVGs in `budget.js`, garden/forest images) — illustrations are an explicit exception like the games and keep their natural colors.
- Respect each tab's stated non-responsibilities in `AI documentation/*.md` (e.g. Budget must not become bookkeeping software; Today must not duplicate Calendar/Projects/Budget functionality) when deciding where a new feature belongs.
