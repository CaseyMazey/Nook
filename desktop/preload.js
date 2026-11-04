// Brücke zwischen Web-App und Hauptprozess, nur für den Update-Knopf unter
// Einstellungen › Über Nook (js/settings.js). Die Web-App erkennt die
// Desktop-App an window.nookDesktop; im Browser gibt es das Objekt nicht.
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
});
