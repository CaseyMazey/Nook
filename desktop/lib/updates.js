// Update-Prüfung über GitHub Releases. Läuft nur in der gepackten App.
// electron und electron-updater werden erst in startUpdates geladen, damit
// isNewer und createUpdateController unter reinem Node testbar bleiben.
//
// Zwei Wege führen hierher: die automatische Prüfung beim Start und der Knopf
// "Nach Updates suchen" unter Einstellungen › Über Nook (über preload.js).
// Beide nutzen denselben Controller, damit nichts doppelt heruntergeladen wird.

const RELEASES_API = 'https://api.github.com/repos/CaseyMazey/Nook/releases/latest';
const RELEASES_PAGE = 'https://github.com/CaseyMazey/Nook/releases/latest';

function parseVersion(raw) {
  if (typeof raw !== 'string') return null;
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(raw.trim());
  return match ? match.slice(1).map(Number) : null;
}

// true, wenn latestTag (z. B. "v2026.11.2") neuer ist als current ("2026.11.1").
function isNewer(latestTag, current) {
  const a = parseVersion(latestTag);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

// Zustand der Updates für die Oberfläche. Ergebnisse von check/download:
//   { status: 'current', version }               neueste Version installiert
//   { status: 'available', version, canInstall }  neuer; canInstall false = nur Release-Seite (macOS)
//   { status: 'downloading', version, percent }
//   { status: 'downloaded', version }             bereit zum Neustart
//   { status: 'error' }
// deps:
//   currentVersion  installierte Version
//   autoUpdater     electron-updater (null unter macOS: ohne Signierung kein Auto-Update)
//   fetchLatestTag  () => Promise<string>, Tag des neuesten Releases (nur ohne autoUpdater)
//   onProgress      (state) => void, Fortschritt fürs Fenster
function createUpdateController({ currentVersion, autoUpdater, fetchLatestTag, onProgress = () => {} }) {
  let state = { status: 'idle' };
  let checking = null;
  let downloading = null;

  const set = (next) => { state = next; onProgress(state); return state; };

  if (autoUpdater) {
    autoUpdater.autoDownload = false;
    autoUpdater.on('download-progress', (p) => {
      if (state.status === 'downloading') set({ ...state, percent: Math.round(p.percent || 0) });
    });
  }

  async function runCheck() {
    if (state.status === 'downloading' || state.status === 'downloaded') return state;
    try {
      if (autoUpdater) {
        const result = await autoUpdater.checkForUpdates();
        const version = result && result.updateInfo && result.updateInfo.version;
        if (version && isNewer(version, currentVersion)) return set({ status: 'available', version, canInstall: true });
        return set({ status: 'current', version: currentVersion });
      }
      const tag = await fetchLatestTag();
      if (isNewer(tag, currentVersion)) {
        return set({ status: 'available', version: String(tag).replace(/^v/, ''), canInstall: false });
      }
      return set({ status: 'current', version: currentVersion });
    } catch (err) {
      console.warn('Update-Prüfung fehlgeschlagen:', err);
      return set({ status: 'error' });
    }
  }

  function check() {
    if (!checking) checking = runCheck().finally(() => { checking = null; });
    return checking;
  }

  function download() {
    if (state.status === 'downloaded') return Promise.resolve(state);
    if (downloading) return downloading;
    if (!autoUpdater || state.status !== 'available') return Promise.resolve(state);
    const version = state.version;
    set({ status: 'downloading', version, percent: 0 });
    downloading = autoUpdater.downloadUpdate()
      .then(() => set({ status: 'downloaded', version }))
      .catch((err) => {
        console.warn('Update-Download fehlgeschlagen:', err);
        return set({ status: 'error' });
      })
      .finally(() => { downloading = null; });
    return downloading;
  }

  return { check, download, getState: () => state };
}

// Vor dem Neustart muss der Speicher auf der Platte sein: quitAndInstall kann
// den Installer starten, bevor die Beenden-Ereignisse durchgelaufen sind.
async function installAfterFlush(autoUpdater, session) {
  try {
    await session.defaultSession.flushStorageData();
  } catch (err) {
    console.warn('Speicher ließ sich vor dem Update nicht sichern:', err);
  }
  autoUpdater.quitAndInstall(false, true);
}

async function fetchLatestTagWith(net) {
  const res = await net.fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const release = await res.json();
  return release.tag_name;
}

// Registriert die IPC-Kanäle für preload.js und startet die automatische
// Prüfung. Außerhalb der gepackten App (und im Smoke-Test) antworten die
// Kanäle mit 'unsupported', damit die Oberfläche das sagen kann.
function startUpdates(win) {
  const { app, dialog, ipcMain, net, session, shell } = require('electron');
  const supported = process.env.NOOK_SMOKE !== '1' && app.isPackaged;

  let autoUpdater = null;
  if (supported && process.platform !== 'darwin') {
    try {
      ({ autoUpdater } = require('electron-updater'));
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on('error', (err) => console.warn('Update-Fehler:', err));
    } catch (err) {
      console.warn('Updates nicht verfügbar:', err);
    }
  }

  const send = (state) => {
    if (!win.isDestroyed()) win.webContents.send('nook-updates:progress', state);
  };
  const controller = supported
    ? createUpdateController({
      currentVersion: app.getVersion(),
      autoUpdater,
      fetchLatestTag: () => fetchLatestTagWith(net),
      onProgress: send,
    })
    : null;

  ipcMain.handle('nook-updates:check', () => (controller ? controller.check() : { status: 'unsupported' }));
  ipcMain.handle('nook-updates:download', () => (controller ? controller.download() : { status: 'unsupported' }));
  ipcMain.handle('nook-updates:install', async () => {
    if (!controller || controller.getState().status !== 'downloaded' || !autoUpdater) return false;
    await installAfterFlush(autoUpdater, session);
    return true;
  });
  ipcMain.handle('nook-updates:open-release-page', () => shell.openExternal(RELEASES_PAGE));

  if (!controller) return;
  startupCheck(win, controller, { autoUpdater, dialog, session, shell });
}

// Beim Start wie bisher: unter Windows/Linux im Hintergrund herunterladen und
// dann den Neustart anbieten, unter macOS auf die Release-Seite hinweisen.
async function startupCheck(win, controller, { autoUpdater, dialog, session, shell }) {
  try {
    const result = await controller.check();
    if (result.status !== 'available') return;
    if (!result.canInstall) {
      const { response } = await dialog.showMessageBox(win, {
        type: 'info',
        buttons: ['Release-Seite öffnen', 'Später'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update verfügbar',
        message: `Nook ${result.version} ist verfügbar.`,
        detail: 'Lade die neue Version von der Release-Seite herunter.',
      });
      if (response === 0) await shell.openExternal(RELEASES_PAGE);
      return;
    }
    const done = await controller.download();
    if (done.status !== 'downloaded') return;
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Jetzt neu starten', 'Später'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update bereit',
      message: `Nook ${done.version} ist heruntergeladen.`,
      detail: 'Jetzt neu starten, um das Update zu installieren? Sonst wird es beim nächsten Beenden installiert.',
    });
    if (response === 0) await installAfterFlush(autoUpdater, session);
  } catch (err) {
    console.warn('Update-Prüfung fehlgeschlagen:', err);
  }
}

module.exports = { isNewer, createUpdateController, startUpdates };
