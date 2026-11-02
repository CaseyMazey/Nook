const test = require('node:test');
const assert = require('node:assert');
const { buildMenuTemplate } = require('../lib/menu');

function roles(entry) {
  return entry.submenu.filter((item) => item.role).map((item) => item.role);
}

test('Windows und Linux: Bearbeiten, Ansicht, Fenster', () => {
  for (const platform of ['win32', 'linux']) {
    assert.deepStrictEqual(buildMenuTemplate(platform).map((m) => m.label), ['Bearbeiten', 'Ansicht', 'Fenster']);
  }
});

test('macOS: App-Menü steht vorn und hat about, hide, quit', () => {
  const template = buildMenuTemplate('darwin');
  assert.deepStrictEqual(template.map((m) => m.label), ['Nook', 'Bearbeiten', 'Ansicht', 'Fenster']);
  assert.deepStrictEqual(roles(template[0]), ['about', 'hide', 'quit']);
});

test('Rollen der Menüs', () => {
  const [edit, view, win] = buildMenuTemplate('win32');
  assert.deepStrictEqual(roles(edit), ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']);
  assert.deepStrictEqual(roles(view), ['reload', 'resetZoom', 'zoomIn', 'zoomOut', 'togglefullscreen']);
  assert.deepStrictEqual(roles(win), ['minimize', 'close']);
});

test('keine DevTools, keine Links, jeder Eintrag mit deutschem Text', () => {
  for (const platform of ['win32', 'linux', 'darwin']) {
    for (const menu of buildMenuTemplate(platform)) {
      for (const item of menu.submenu) {
        assert.notStrictEqual(item.role, 'toggleDevTools');
        assert.strictEqual(item.click, undefined);
        if (item.type !== 'separator') assert.ok(item.label, `Text fehlt: ${item.role}`);
      }
    }
  }
});
