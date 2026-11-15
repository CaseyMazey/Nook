// Schnellnotiz per Tastenkürzel (Strg/Cmd + Alt + N), auch wenn Nook im
// Hintergrund liegt: holt das Fenster nach vorn und sagt der Web-App, dass
// sie die Schnellnotiz öffnen soll (js/today-quickcapture.js). Die Daten
// bleiben ganz in der Web-App. Ein- und ausgeschaltet wird das Kürzel von
// der Web-App (Einstellungen › Heute-Seite), die die Wahl selbst speichert.
// Ohne Electron testbar: globalShortcut und Fenster werden hereingereicht.

const ACCELERATOR = 'CommandOrControl+Alt+N';
const CHANNEL_OPEN = 'nook-quick-capture:open';
const CHANNEL_SET = 'nook-quick-capture:set-enabled';

function createQuickCapture({ globalShortcut, getWindow, accelerator = ACCELERATOR }) {
  let enabled = false;

  function bringToFront() {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send(CHANNEL_OPEN);
  }

  // → { enabled, accelerator, error? }; error 'taken', wenn ein anderes
  // Programm das Kürzel schon belegt.
  function setEnabled(on) {
    if (on && !enabled) {
      let ok = false;
      try { ok = globalShortcut.register(accelerator, bringToFront); } catch { ok = false; }
      enabled = !!ok;
      return ok ? { enabled: true, accelerator } : { enabled: false, accelerator, error: 'taken' };
    }
    if (!on && enabled) {
      globalShortcut.unregister(accelerator);
      enabled = false;
    }
    return { enabled, accelerator };
  }

  function dispose() {
    if (enabled) globalShortcut.unregister(accelerator);
    enabled = false;
  }

  return { setEnabled, dispose, bringToFront, isEnabled: () => enabled };
}

module.exports = { createQuickCapture, ACCELERATOR, CHANNEL_OPEN, CHANNEL_SET };
