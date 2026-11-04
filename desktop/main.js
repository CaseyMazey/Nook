// Hauptprozess der Desktop-App: liefert die Web-App über app://nook aus und
// verwaltet das Fenster. appId und Ursprung app://nook dürfen sich nach dem
// ersten Release nie mehr ändern, sonst scheint der localStorage verschwunden.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, Menu, net, protocol, screen, session, shell } = require('electron');

const { buildMenuTemplate } = require('./lib/menu.js');
const { resolveAppPath } = require('./lib/protocol.js');
const { startUpdates } = require('./lib/updates.js');
const { loadWindowState, saveWindowState } = require('./lib/window-state.js');

const APP_SCHEME = 'app';
const APP_HOST = 'nook';
const START_URL = `${APP_SCHEME}://${APP_HOST}/index.html`;

const SMOKE = process.env.NOOK_SMOKE === '1';
const SMOKE_SETTLE_MS = 3000;
const SMOKE_TIMEOUT_MS = 60000;

let mainWindow = null;

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Der Smoke-Test darf nie echte Nutzerdaten anfassen und nicht an einer gerade
// laufenden Nook-Instanz scheitern. Ein ausdrückliches --user-data-dir gilt weiter.
if (SMOKE && !app.commandLine.hasSwitch('user-data-dir')) {
  const smokeDir = path.join(os.tmpdir(), 'nook-smoke');
  // Fester Ordner, vor jedem Lauf geleert: bleibt frisch und sammelt sich nicht an.
  fs.rmSync(smokeDir, { recursive: true, force: true });
  fs.mkdirSync(smokeDir, { recursive: true });
  app.setPath('userData', smokeDir);
}

function appRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'nook') : path.join(__dirname, '.stage');
}

function windowStateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

// localStorage wird verzögert geschrieben; das hier bringt ihn sicher auf die Platte.
function flushStorage() {
  if (app.isReady()) session.defaultSession.flushStorageData();
}

function notFound() {
  return new Response('Nicht gefunden', { status: 404 });
}

async function handleAppRequest(request) {
  try {
    const file = resolveAppPath(appRoot(), request.url);
    if (file === null) return notFound();
    const stat = await fs.promises.stat(file);
    if (!stat.isFile()) return notFound();
    return await net.fetch(pathToFileURL(file).toString());
  } catch {
    return notFound();
  }
}

// new URL(...).origin taugt hier nicht: Für eigene Protokolle liefert Node 'null'.
function isAppUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST;
  } catch {
    return false;
  }
}

function openIfExternal(raw) {
  try {
    const { protocol: scheme } = new URL(raw);
    if (scheme === 'http:' || scheme === 'https:' || scheme === 'mailto:') {
      shell.openExternal(raw).catch((err) => console.error('Link ließ sich nicht öffnen:', err));
    }
  } catch {
    // Keine gültige Adresse: blockieren reicht.
  }
}

function createWindow() {
  const state = loadWindowState(windowStateFile(), screen.getAllDisplays().map((d) => d.workArea));
  const win = new BrowserWindow({
    ...state,
    show: false,
    title: 'Nook',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    openIfExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openIfExternal(url);
  });

  win.on('close', () => {
    try {
      saveWindowState(windowStateFile(), win.getNormalBounds());
    } catch (err) {
      console.error('Fensterzustand ließ sich nicht speichern:', err);
    }
  });
  // Abmelden oder Herunterfahren unter Windows läuft nicht über before-quit.
  win.on('session-end', flushStorage);
  win.on('blur', flushStorage);
  win.on('hide', flushStorage);
  win.on('closed', () => {
    mainWindow = null;
  });

  if (SMOKE) attachSmokeChecks(win);
  else win.once('ready-to-show', () => win.show());

  win.loadURL(START_URL);
  return win;
}

// Beendet die App mit Code 0 oder 1. Fehlgeschlagene CDN-Ladevorgänge zählen
// nicht, weil der Build-Rechner keine Rolle spielen darf.
function attachSmokeChecks(win) {
  const fail = (reason) => {
    console.error('Smoke-Test fehlgeschlagen: ' + reason);
    app.exit(1);
  };

  setTimeout(() => fail('Zeitüberschreitung'), SMOKE_TIMEOUT_MS);

  win.webContents.on('console-message', ({ level, message }) => {
    if (level === 'error' && message.startsWith('Uncaught')) fail(message);
  });
  win.webContents.on('render-process-gone', (_event, details) => fail('Renderer beendet: ' + details.reason));
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) fail(`Laden fehlgeschlagen: ${url} (${code} ${description})`);
  });

  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const ok = await win.webContents.executeJavaScript(
          "typeof showView === 'function' && document.querySelector('.view.active') !== null",
        );
        if (!ok) return fail('showView oder .view.active fehlt');
        console.log('Smoke-Test bestanden.');
        app.exit(0);
      } catch (err) {
        fail('Prüfung im Renderer: ' + err.message);
      }
    }, SMOKE_SETTLE_MS);
  });
}

// Zwei Instanzen dürfen sich nicht denselben Speicher teilen.
if (!app.requestSingleInstanceLock()) {
  app.exit(SMOKE ? 1 : 0);
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  // Nook ist ein einziges Fenster: Zu ist auf allen Systemen gleich Beenden.
  app.on('window-all-closed', () => app.quit());

  // before-quit reicht nicht allein: Die Seite lebt da noch und schreibt in
  // pagehide weiter (js/pinboard.js), deshalb auch in will-quit.
  app.on('before-quit', flushStorage);
  app.on('will-quit', flushStorage);

  app.whenReady().then(() => {
    protocol.handle(APP_SCHEME, handleAppRequest);
    // Gleich der appId aus package.json. Die Methode gibt es nur unter Windows.
    if (process.platform === 'win32') app.setAppUserModelId('io.github.caseymazey.nook');
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(process.platform)));
    mainWindow = createWindow();
    startUpdates(mainWindow);
  });
}
