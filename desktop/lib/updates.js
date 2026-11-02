// Update-Prüfung über GitHub Releases. Läuft nur in der gepackten App.
// electron und electron-updater werden erst in startUpdates geladen, damit
// isNewer unter reinem Node testbar bleibt.

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

function startUpdates(win) {
  const { app, dialog, net, session, shell } = require('electron');
  if (process.env.NOOK_SMOKE === '1' || !app.isPackaged) return;

  if (process.platform === 'darwin') {
    checkGithubRelease(win, { app, dialog, net, shell });
    return;
  }

  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', (err) => console.warn('Update-Fehler:', err));
    autoUpdater.on('update-downloaded', async (info) => {
      try {
        const { response } = await dialog.showMessageBox(win, {
          type: 'info',
          buttons: ['Jetzt neu starten', 'Später'],
          defaultId: 0,
          cancelId: 1,
          title: 'Update bereit',
          message: `Nook ${info.version} ist heruntergeladen.`,
          detail: 'Jetzt neu starten, um das Update zu installieren? Sonst wird es beim nächsten Beenden installiert.',
        });
        if (response === 0) await installAfterFlush(autoUpdater, session);
      } catch (err) {
        console.warn('Update-Dialog fehlgeschlagen:', err);
      }
    });
    autoUpdater.checkForUpdates().catch((err) => console.warn('Update-Prüfung fehlgeschlagen:', err));
  } catch (err) {
    console.warn('Updates nicht verfügbar:', err);
  }
}

// macOS: ohne Signierung kein Auto-Update, nur Hinweis mit Link.
async function checkGithubRelease(win, { app, dialog, net, shell }) {
  try {
    const res = await net.fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const release = await res.json();
    if (!isNewer(release.tag_name, app.getVersion())) return;
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Release-Seite öffnen', 'Später'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update verfügbar',
      message: `Nook ${String(release.tag_name).replace(/^v/, '')} ist verfügbar.`,
      detail: 'Lade die neue Version von der Release-Seite herunter.',
    });
    if (response === 0) await shell.openExternal(RELEASES_PAGE);
  } catch (err) {
    console.warn('Update-Prüfung fehlgeschlagen:', err);
  }
}

module.exports = { isNewer, startUpdates };
