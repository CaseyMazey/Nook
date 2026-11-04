const test = require('node:test');
const assert = require('node:assert');
const { isNewer, createUpdateController } = require('../lib/updates.js');

// Nachbau von electron-updater: checkForUpdates/downloadUpdate von außen steuerbar.
function fakeUpdater({ latest = '2026.11.5', failCheck = false } = {}) {
  const handlers = {};
  let release;
  const u = {
    autoDownload: true,
    downloads: 0,
    on(name, fn) { handlers[name] = fn; },
    emit(name, arg) { handlers[name] && handlers[name](arg); },
    async checkForUpdates() {
      if (failCheck) throw new Error('offline');
      return { updateInfo: { version: latest } };
    },
    downloadUpdate() {
      u.downloads++;
      return new Promise((resolve) => { release = resolve; });
    },
    finishDownload() { release(); },
  };
  return u;
}
const tick = () => new Promise((r) => setImmediate(r));
const quiet = async (fn) => {
  const warn = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = warn; }
};

test('neuere Versionen werden erkannt', () => {
  assert.strictEqual(isNewer('v2026.11.2', '2026.11.1'), true);
  assert.strictEqual(isNewer('v2026.12.1', '2026.11.9'), true);
  assert.strictEqual(isNewer('v2027.1.1', '2026.12.9'), true);
});

test('Vergleich ist numerisch', () => {
  assert.strictEqual(isNewer('v2026.11.10', '2026.11.9'), true);
  assert.strictEqual(isNewer('v2026.11.9', '2026.11.10'), false);
});

test('gleiche oder ältere Version ist nicht neuer', () => {
  assert.strictEqual(isNewer('v2026.11.1', '2026.11.1'), false);
  assert.strictEqual(isNewer('2026.11.1', '2026.11.1'), false);
  assert.strictEqual(isNewer('v2026.10.9', '2026.11.1'), false);
});

test('ungültiger Tag ist nicht neuer', () => {
  assert.strictEqual(isNewer('latest', '2026.11.1'), false);
  assert.strictEqual(isNewer('', '2026.11.1'), false);
  assert.strictEqual(isNewer('v2026.11', '2026.11.1'), false);
  assert.strictEqual(isNewer('v2026.11.x', '2026.11.1'), false);
  assert.strictEqual(isNewer(undefined, '2026.11.1'), false);
  assert.strictEqual(isNewer('v2026.11.2', 'kaputt'), false);
});

test('Controller: neueste Version installiert ergibt current', async () => {
  const c = createUpdateController({ currentVersion: '2026.11.5', autoUpdater: fakeUpdater() });
  assert.deepStrictEqual(await c.check(), { status: 'current', version: '2026.11.5' });
});

test('Controller: neuere Version ist installierbar, Download erst auf Anfrage', async () => {
  const u = fakeUpdater();
  const c = createUpdateController({ currentVersion: '2026.11.4', autoUpdater: u });
  assert.strictEqual(u.autoDownload, false);
  assert.deepStrictEqual(await c.check(), { status: 'available', version: '2026.11.5', canInstall: true });
  assert.strictEqual(u.downloads, 0);
});

test('Controller: Download meldet Fortschritt und endet mit downloaded', async () => {
  const u = fakeUpdater();
  const seen = [];
  const c = createUpdateController({ currentVersion: '2026.11.4', autoUpdater: u, onProgress: (s) => seen.push(s.status + (s.percent ?? '')) });
  await c.check();
  const p = c.download();
  u.emit('download-progress', { percent: 42.4 });
  u.finishDownload();
  assert.deepStrictEqual(await p, { status: 'downloaded', version: '2026.11.5' });
  assert.deepStrictEqual(seen, ['available', 'downloading0', 'downloading42', 'downloaded']);
});

test('Controller: zweiter Download-Aufruf lädt nicht doppelt', async () => {
  const u = fakeUpdater();
  const c = createUpdateController({ currentVersion: '2026.11.4', autoUpdater: u });
  await c.check();
  const a = c.download();
  const b = c.download();
  u.finishDownload();
  await Promise.all([a, b]);
  assert.strictEqual(u.downloads, 1);
  assert.strictEqual((await c.download()).status, 'downloaded');
  assert.strictEqual(u.downloads, 1);
});

test('Controller: Prüfen während eines Downloads ändert den Zustand nicht', async () => {
  const u = fakeUpdater();
  const c = createUpdateController({ currentVersion: '2026.11.4', autoUpdater: u });
  await c.check();
  const p = c.download();
  assert.strictEqual((await c.check()).status, 'downloading');
  u.finishDownload();
  await p;
  assert.strictEqual((await c.check()).status, 'downloaded');
});

test('Controller: gleichzeitige Prüfungen teilen sich einen Aufruf', async () => {
  const u = fakeUpdater();
  let calls = 0;
  const orig = u.checkForUpdates;
  u.checkForUpdates = async () => { calls++; await tick(); return orig(); };
  const c = createUpdateController({ currentVersion: '2026.11.4', autoUpdater: u });
  await Promise.all([c.check(), c.check()]);
  assert.strictEqual(calls, 1);
});

test('Controller: Fehler bei der Prüfung ergibt error', async () => {
  const c = createUpdateController({ currentVersion: '2026.11.4', autoUpdater: fakeUpdater({ failCheck: true }) });
  assert.deepStrictEqual(await quiet(() => c.check()), { status: 'error' });
});

test('Controller ohne autoUpdater (macOS): nur Hinweis, kein Download', async () => {
  const c = createUpdateController({ currentVersion: '2026.11.4', autoUpdater: null, fetchLatestTag: async () => 'v2026.11.5' });
  assert.deepStrictEqual(await c.check(), { status: 'available', version: '2026.11.5', canInstall: false });
  assert.strictEqual((await c.download()).status, 'available');
  const d = createUpdateController({ currentVersion: '2026.11.5', autoUpdater: null, fetchLatestTag: async () => 'v2026.11.5' });
  assert.strictEqual((await d.check()).status, 'current');
});
