// Brücke zwischen Web-App und Hauptprozess: Update-Knopf unter
// Einstellungen › Über Nook (js/settings.js) und das Schnellnotiz-Kürzel
// (js/today-quickcapture.js, desktop/lib/quick-capture.js). Die Web-App
// erkennt die Desktop-App an window.nookDesktop; im Browser gibt es das
// Objekt nicht.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nookDesktop', {
  updates: {
    check: () => ipcRenderer.invoke('nook-updates:check'),
    download: () => ipcRenderer.invoke('nook-updates:download'),
    install: () => ipcRenderer.invoke('nook-updates:install'),
    openReleasePage: () => ipcRenderer.invoke('nook-updates:open-release-page'),
    onProgress: (callback) => {
      ipcRenderer.on('nook-updates:progress', (_event, state) => callback(state));
    },
  },
  quickCapture: {
    setEnabled: (on) => ipcRenderer.invoke('nook-quick-capture:set-enabled', !!on),
    onOpen: (callback) => {
      ipcRenderer.on('nook-quick-capture:open', () => callback());
    },
  },
});
