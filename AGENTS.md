# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

Nook is a personal organization hub (dashboard, calendar, budget, flashcards, wiki, projects, tools, games) that runs entirely client-side. There is no backend, no build step, and no package.json. It is opened directly as `index.html` (`file://`), which is why several architectural choices (script-tag loading, no `fetch()` for local files, no ES modules/bundler) are load-bearing, not accidental.

The UI language is German; keep new UI strings, comments, and variable names in the existing style (German UI text, German or mixed German/English code comments — follow whatever the surrounding file already does).

## Running / testing

No install, build, lint, or test commands exist. To work on the app, open `index.html` in a browser (or serve the folder with any static file server). Verify changes by opening the relevant tab in a browser and exercising it manually — there is no automated test suite.

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

`js/hub-utils.js` holds cross-tab shared utilities loaded right after `main.js`: the user color system (`HUB_PALETTE_HEX`, `hubUserColors`, `initColorPickerWidget`, `computeUserColorVars`/`applyUserColorVars` — theme-aware derived colors from one base hex) and the shared code-block renderer (`renderCodeBlock`, used by Guides and Pinboard code cards). Reach for these instead of re-implementing color pickers or code blocks in a new tab.

### Games: self-registering plugin architecture

`js/games.js` is a pure launcher/container — it has zero knowledge of any individual game. It only knows the IDs in `games/games-list.js` (`window.GAMES_LIST`), and renders whatever registers itself via `window.registerGame(config)` into `window.GameHub.registry`.

Each game lives in `games/<id>/` and provides:
- `manifest.js` — metadata (title, description, icon, `getStats()`, `resetStats()`); loads immediately at hub startup so the library card can render.
- `<id>.js` — actual game logic (`mount(container)`/`destroy()`); lazy-loaded only on first "Spielen" click.
- `<id>.css` — injected on open, removed on close.

To add a game: create `games/<id>/` with the three files above, then add `<id>` to `window.GAMES_LIST` in `games/games-list.js`. Nothing in `games.js` or `index.html` needs to change. A work-in-progress game can ship as a manifest-only stub with `comingSoon: true` (no `.js`/`.css` needed yet).

Cozy Home (`games/cozy-home/`) additionally acts as a cross-game virtual pet system: other games can declare pets in their own `manifest.js`; Cozy Home scans `window.GameHub.registry` and merges them in without knowing their IDs in advance. Preferences/food/toys are registry-driven (`FOOD_REGISTRY`, `TOY_REGISTRY`, `PREFERENCE_LEVELS`) — adding a new food/toy/pet is data-only, no code changes.

### `AI documentation/`

Per-tab spec documents (`budget.md`, `calendar.md`, `today.md`, etc.) describing each tab's purpose, design principles, ownership boundaries ("Zuständigkeiten": what the tab is/isn't responsible for), and explicit extension rules (what new features should/shouldn't do). These are product/design intent, not always in sync with current code structure (e.g. `budget.md` predates the multi-file Budget split) — treat them as the design contract to honor when extending a tab, but verify current file layout against the actual `js/`/`css/` files rather than assuming the doc is current.

## Conventions worth following

- New persisted data goes through `DB.get`/`DB.set` with a dedicated key and a `saveX()` setter, following the existing pattern in `main.js`/each tab file.
- New user-facing colors should go through the shared color system in `hub-utils.js`, not ad-hoc hex handling, so they stay theme-aware (light/dark auto-adjustment).
- Respect each tab's stated non-responsibilities in `AI documentation/*.md` (e.g. Budget must not become bookkeeping software; Today must not duplicate Calendar/Projects/Budget functionality) when deciding where a new feature belongs.
