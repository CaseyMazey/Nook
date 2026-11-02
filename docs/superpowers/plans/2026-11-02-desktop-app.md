# Nook Desktop-App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nook lässt sich über GitHub Releases als App für Windows, macOS und Linux herunterladen und aktualisiert sich soweit möglich selbst.

**Architecture:** Eine Electron-Hülle in `desktop/` liefert eine gefilterte Kopie der Laufzeitdateien über `app://nook/` aus. Ein Tag-gesteuerter GitHub-Workflow baut, testet und veröffentlicht. Der Hauptordner bleibt build-frei.

**Tech Stack:** Electron, electron-builder, electron-updater, `node:test`, GitHub Actions. Aktuelle stabile Versionen beim Umsetzen festpinnen.

**Spec:** `docs/superpowers/specs/2026-11-02-desktop-app-design.md`

## Global Constraints

- `appId`: `io.github.caseymazey.nook`, `productName`: `Nook`, Protokoll-Ursprung: `app://nook`. Alle drei sind ab dem ersten Release unveränderlich.
- Publish-Ziel: GitHub, Owner `CaseyMazey`, Repo `Nook`.
- Kein Build-Schritt, kein `package.json` und keine Node-Abhängigkeit im Hauptordner.
- `js/sync-config.js` kommt nie ins Paket. Einzige Quelle für Ausschlüsse ist `.assetsignore`.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Code in `desktop/` im Stil des Projekts: deutsche Kommentare, keine hartcodierten Farben im Hauptordner. Windows hat CRLF-Warnungen, das ist unkritisch.
- Der Workflow prüft: Tag == `v` + `NOOK_VERSION`.

## Review Focus

- Pfade wie `app://nook/../../secret` oder `%2e%2e` dürfen nichts außerhalb des Paketordners liefern (Test in Task 2).
- Dateinamen mit Leerzeichen und Umlauten, z. B. in `games/`, müssen trotz URL-Kodierung laden (Test in Task 2).
- Fehlende Datei, insbesondere `js/sync-config.js`: 404 ohne Absturz, Nook läuft rein lokal (Tests in Task 2 und Smoke-Test in Task 3).
- Ein Fenster-Zustand von einem abgesteckten Monitor oder eine kaputte Zustandsdatei darf das Fenster nicht unsichtbar machen (Test in Task 3).
- Eine verbotene Datei, die lokal neben dem Repo liegt, etwa unter `Backups/`, muss den Build stoppen, auch wenn jemand `.assetsignore` kaputt editiert (Test in Task 1).

---

### Task 1: Paketinhalt und Paketprüfung

**Files:**
- Create: `desktop/package.json`, `desktop/scripts/stage.js`, `desktop/test/stage.test.js`
- Modify: `.gitignore` (`desktop/.stage/`, `desktop/dist/`)

**Interfaces:**
- Produces: `parseIgnore(text: string): string[]`, `isIgnored(relPath: string, patterns: string[]): boolean`, `stageApp(rootDir: string, destDir: string): void`, `findForbidden(dir: string): string[]`. CLI: `npm run stage` schreibt nach `desktop/.stage/` und endet mit Code 1 bei Treffern.

- [ ] **Step 1: Failing Tests schreiben.** Fixture-Ordner per `fs.mkdtempSync`.
  - `isIgnored` hat dieselbe Semantik wie `Test-Ignored` in `scripts/deploy.ps1`: `isIgnored('docs/a.md',['docs'])`, `isIgnored('x/y.xcf',['*.xcf'])` sind `true`, `isIgnored('js/main.js',['docs','*.xcf'])` ist `false`.
  - `stageApp` kopiert `index.html` und `games/ä b/x.js`, aber nie `Backups/a.json`, `js/sync-config.js` und `.git/config`.
  - `findForbidden` liefert Treffer für `Backups/`, `*.xcf`, `*.docx`, `*.xlsx`, `*.keystore`, `*.jks`, `js/sync-config.js`, `AI documentation/`, `.git/`, und `[]` für einen sauberen Ordner.
  - `findForbidden` ist hartcodiert und von `.assetsignore` unabhängig: Test mit leerer Ignore-Liste plus `Backups/a.json` meldet weiterhin den Treffer.
- [ ] **Step 2:** `cd desktop && npm test`. Erwartet: FAIL, Modul fehlt.
- [ ] **Step 3:** `desktop/package.json` (`private`, `main: main.js`, Skripte `test: node --test test/`, `stage`) und `stage.js` implementieren. `stageApp` entfernt `destDir` vorher, schließt `js/sync-config.js` immer aus und liest `.assetsignore` als UTF-8.
- [ ] **Step 4:** `npm test` ist PASS. `npm run stage` läuft auf dem echten Repo durch und findet keine verbotenen Dateien.
- [ ] **Step 5: Commit** `feat(desktop): Paketinhalt und Prüfung auf private Dateien`. Diesen Plan mit committen.

### Task 2: App-Protokoll

**Files:**
- Create: `desktop/lib/protocol.js`, `desktop/test/protocol.test.js`

**Interfaces:**
- Produces: `resolveAppPath(rootDir: string, requestUrl: string): string | null`. `null` bei fremdem Host oder Pfadausbruch; `/` wird zu `index.html`. Der Query-String wird ignoriert.

- [ ] **Step 1: Failing Tests.** Mit Root `R`: `app://nook/` → `R/index.html`; `app://nook/js/main.js?x=1` → `R/js/main.js`; `app://nook/games/%C3%A4%20b/x.js` → `R/games/ä b/x.js`; `app://nook/../../secret`, `app://nook/%2e%2e/secret`, `app://nook/..%5Csecret`, `app://evil/index.html` → `null`; ungültige Kodierung `app://nook/%E0%A4%A` → `null`.
- [ ] **Step 2:** Tests laufen lassen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren mit `new URL`, `decodeURIComponent` in `try/catch`, `path.resolve` und einem Präfix-Check mit `rootDir + path.sep`.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5: Commit** `feat(desktop): sichere Pfadauflösung für app://`.

### Task 3: Hauptprozess und Smoke-Test

**Files:**
- Create: `desktop/main.js`, `desktop/lib/window-state.js`, `desktop/test/window-state.test.js`, `desktop/build/icon.png` (Kopie von `assets/icons/icon-512.png`)
- Modify: `desktop/package.json` (Dependency `electron`, Build-Konfiguration, Skript `start`, `pack`)

**Interfaces:**
- Consumes: `resolveAppPath` aus Task 2, `.stage/` aus Task 1.
- Produces: `loadWindowState(file: string, displays: Bounds[]): Bounds` und `saveWindowState(file: string, bounds: Bounds): void`. Umgebungsvariable `NOOK_SMOKE=1`: Die App lädt, prüft und beendet sich mit Code 0 oder 1.

- [ ] **Step 1: Failing Tests für `loadWindowState`.** Fehlende oder kaputte Datei → Standard `{width:1280,height:820}`; gespeicherte Lage ohne Überschneidung mit einem Display → Standardgröße ohne `x`/`y`; gültige Lage → unverändert.
- [ ] **Step 2:** Tests FAIL, dann `window-state.js` implementieren, Tests PASS.
- [ ] **Step 3: `main.js` schreiben.**
  - `protocol.registerSchemesAsPrivileged` vor `ready` mit `standard`, `secure`, `supportFetchAPI`; Handler nutzt `resolveAppPath` und `net.fetch` auf `file://`, sonst Status 404.
  - Root: `process.resourcesPath/nook` wenn gepackt, sonst `desktop/.stage`.
  - `setWindowOpenHandler` und `will-navigate`: `http(s)` über `shell.openExternal`, alles außer `app://nook` wird blockiert.
  - Fensterzustand beim Schließen speichern. `requestSingleInstanceLock`, damit zwei Instanzen sich nicht den Speicher teilen.
  - Smoke-Modus: Nach `did-finish-load` 3 s warten, per `executeJavaScript` prüfen, dass `typeof showView === 'function'` und `.view.active` existiert. Exit 1, wenn das fehlt, oder bei einer Konsolenmeldung auf Fehler-Level, die mit `Uncaught` beginnt. Fehlgeschlagene CDN-Ladevorgänge zählen nicht, weil der Build-Rechner keine Rolle spielen darf.
- [ ] **Step 4: Build-Konfiguration.** `extraResources` von `.stage` nach `nook`; `win.target: nsis`, `linux.target: AppImage`, `mac.target: dmg` mit `x64` und `arm64`, `mac.identity: null`, `publish` wie in den Constraints, `nsis.deleteAppDataOnUninstall: false`, `releaseType: draft`.
- [ ] **Step 5: Prüfen.** `npm run stage`, `npm run pack`, dann den Smoke-Test: `NOOK_SMOKE=1 desktop/dist/win-unpacked/Nook.exe`. Erwartet: Exit 0.
- [ ] **Step 6: Daten-Test von Hand.** App starten, Aufgabe anlegen, beenden, neu starten: Aufgabe ist da. Tabs und ein Spiel durchklicken: Keine Fehler, das Spiel lädt nach. `navigator.serviceWorker`-Fehler dürfen nicht sichtbar werden (stiller `catch` in `js/pwa.js`).
- [ ] **Step 7: Commit** `feat(desktop): Electron-Hülle mit app://-Protokoll und Smoke-Test`.

### Task 4: Updates

**Files:**
- Create: `desktop/lib/updates.js`, `desktop/test/updates.test.js`
- Modify: `desktop/main.js`, `desktop/package.json` (Dependency `electron-updater`)

**Interfaces:**
- Produces: `isNewer(latestTag: string, current: string): boolean`, `startUpdates(win: BrowserWindow): void`.

- [ ] **Step 1: Failing Tests.** `isNewer('v2026.11.2','2026.11.1')` und `isNewer('v2026.12.1','2026.11.9')` und `isNewer('v2027.1.1','2026.12.9')` sind `true`; gleiche Version, ältere Version und ein ungültiger Tag sind `false`. Numerischer Vergleich: `2026.11.10` ist neuer als `2026.11.9`.
- [ ] **Step 2:** FAIL, implementieren, PASS.
- [ ] **Step 3: `startUpdates` implementieren.**
  - Nicht im Smoke-Modus und nicht ungepackt.
  - Windows und Linux: `autoUpdater` mit `autoDownload` und `autoInstallOnAppQuit`; bei `update-downloaded` nativer Dialog „Jetzt neu starten“ / „Später“.
  - macOS: `net.fetch` auf `https://api.github.com/repos/CaseyMazey/Nook/releases/latest`, bei `isNewer` Dialog mit Link zur Release-Seite.
  - Jeder Fehler landet nur in `console.warn`, inklusive `autoUpdater`-Event `error`.
- [ ] **Step 4:** Tests PASS, der Smoke-Test bleibt Exit 0.
- [ ] **Step 5: Commit** `feat(desktop): Update-Prüfung über GitHub Releases`.

### Task 5: Release-Workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: Skripte `test`, `stage`, Smoke-Modus, Build-Konfiguration.

- [ ] **Step 1: Workflow schreiben.** Trigger `push: tags: ['v*']`, `permissions: contents: write`.
  - Job `check`: Bricht ab, wenn der Tag nicht zu `window.NOOK_VERSION` passt.
  - Job `build`, Matrix `windows-latest`, `macos-latest`, `ubuntu-latest`, `fail-fast: true`: `npm ci`, `npm test`, Version aus Tag setzen mit `npm version --no-git-tag-version`, `npm run stage`, `electron-builder --dir`, Smoke-Test (Linux mit `xvfb-run` und `--no-sandbox`), dann `electron-builder --publish always`.
  - Job `publish`, `needs: build`: `gh release edit "$TAG" --draft=false`.
- [ ] **Step 2: Lokal prüfen.** `package-lock.json` ist committet, Pfade der entpackten Apps stimmen mit `desktop/dist` nach Task 3 überein.
- [ ] **Step 3: Commit** `ci: Release-Workflow für Windows, macOS und Linux`.
- [ ] **Step 4: Test-Release erst mit Caseys Freigabe.** Branch und Tag pushen sind sichtbare Aktionen. Tag `v2026.11.1` als erster Lauf. Erwartet: Drei Builds grün, Release mit `.exe`, `.AppImage`, zwei `.dmg` und `latest*.yml`.
- [ ] **Step 5: Download prüfen.** Dateilisten der Release-Artefakte auf private Dateinamen prüfen, indem der `win-unpacked`-Inhalt durch `findForbidden` läuft.
- [ ] **Step 6: Update-Test.** Installierte Version, dann Release mit höherer Version: Update kommt an, Daten bleiben. Backup aus der Web-Version in die App einspielen. `collectBackupEntries` schließt nur Sync-Interna und Caches aus, deckt also alle Nutzerdaten ab.

### Task 6: Doku und Hinweistext

**Files:**
- Modify: `index.html:1636`, `README.md`, `CLAUDE.md`, `js/nook-version.js`

- [ ] **Step 1:** Hinweis `gcal-unsupported-hint` so ändern, dass er auch in der App stimmt: Google-Anmeldung ist in der Desktop-App und beim direkten Öffnen der Datei nicht verfügbar, nur in der Web-Version.
- [ ] **Step 2:** `README.md`: Download-Abschnitt mit Link auf `releases/latest`, Schritte für SmartScreen (Weitere Informationen → Trotzdem ausführen) und Gatekeeper (Systemeinstellungen → Datenschutz & Sicherheit → Trotzdem öffnen), Hinweis zur Datenübernahme per Backup und zu den fehlenden Funktionen.
- [ ] **Step 3:** `CLAUDE.md`: Abschnitt zu `desktop/`, Release-Ablauf und unveränderlicher `appId`. Der Satz „no package.json“ gilt ab jetzt für den Hauptordner.
- [ ] **Step 4:** Änderungsprotokoll-Eintrag in `js/nook-version.js`, `scripts/deploy.ps1` ausführen, weil sich der Web-Hinweis ändert. Prüfen, dass `desktop/` nicht mit deployt wurde.
- [ ] **Step 5: Commit** `docs: Download-Anleitung und Desktop-App in der Projektdoku`.
