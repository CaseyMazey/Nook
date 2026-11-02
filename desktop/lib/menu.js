// Deutsches Anwendungsmenü. Nur die Vorlage, ohne electron: So bleibt sie unter
// reinem Node testbar. Die Rollen bringen die Tastenkürzel mit (Cmd+C/V auf macOS).

function buildMenuTemplate(platform) {
  const template = [
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo', label: 'Rückgängig' },
        { role: 'redo', label: 'Wiederholen' },
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einfügen' },
        { role: 'selectAll', label: 'Alles auswählen' },
      ],
    },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload', label: 'Neu laden' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Originalgröße' },
        { role: 'zoomIn', label: 'Vergrößern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' },
      ],
    },
    {
      label: 'Fenster',
      submenu: [
        { role: 'minimize', label: 'Minimieren' },
        { role: 'close', label: 'Schließen' },
      ],
    },
  ];

  if (platform === 'darwin') {
    template.unshift({
      label: 'Nook',
      submenu: [
        { role: 'about', label: 'Über Nook' },
        { type: 'separator' },
        { role: 'hide', label: 'Nook ausblenden' },
        { type: 'separator' },
        { role: 'quit', label: 'Nook beenden' },
      ],
    });
  }

  return template;
}

module.exports = { buildMenuTemplate };
