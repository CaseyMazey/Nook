const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createQuickCapture, ACCELERATOR, CHANNEL_OPEN } = require('../lib/quick-capture.js');

function fakeShortcut({ taken = false } = {}) {
  const registered = new Map();
  return {
    registered,
    register(acc, cb) { if (taken) return false; registered.set(acc, cb); return true; },
    unregister(acc) { registered.delete(acc); },
  };
}

function fakeWindow() {
  const calls = [];
  return {
    calls,
    minimized: true,
    isDestroyed: () => false,
    isMinimized() { return this.minimized; },
    restore() { calls.push('restore'); this.minimized = false; },
    show() { calls.push('show'); },
    focus() { calls.push('focus'); },
    webContents: { send: (ch) => calls.push('send:' + ch) },
  };
}

test('Kürzel wird erst auf Wunsch der Web-App angemeldet und wieder abgemeldet', () => {
  const gs = fakeShortcut();
  const qc = createQuickCapture({ globalShortcut: gs, getWindow: () => null });
  assert.equal(gs.registered.size, 0);
  assert.deepEqual(qc.setEnabled(true), { enabled: true, accelerator: ACCELERATOR });
  assert.ok(gs.registered.has(ACCELERATOR));
  assert.deepEqual(qc.setEnabled(true), { enabled: true, accelerator: ACCELERATOR }, 'doppelt anmelden schadet nicht');
  assert.deepEqual(qc.setEnabled(false), { enabled: false, accelerator: ACCELERATOR });
  assert.equal(gs.registered.size, 0);
});

test('Belegtes Kürzel meldet einen freundlichen Fehler statt abzustürzen', () => {
  const qc = createQuickCapture({ globalShortcut: fakeShortcut({ taken: true }), getWindow: () => null });
  assert.deepEqual(qc.setEnabled(true), { enabled: false, accelerator: ACCELERATOR, error: 'taken' });
  assert.equal(qc.isEnabled(), false);
});

test('Das Kürzel holt das Fenster nach vorn und öffnet die Schnellnotiz', () => {
  const gs = fakeShortcut();
  const win = fakeWindow();
  const qc = createQuickCapture({ globalShortcut: gs, getWindow: () => win });
  qc.setEnabled(true);
  gs.registered.get(ACCELERATOR)();
  assert.deepEqual(win.calls, ['restore', 'show', 'focus', 'send:' + CHANNEL_OPEN]);
});

test('Ohne Fenster passiert nichts; dispose meldet ab', () => {
  const gs = fakeShortcut();
  const qc = createQuickCapture({ globalShortcut: gs, getWindow: () => null });
  qc.setEnabled(true);
  assert.doesNotThrow(() => gs.registered.get(ACCELERATOR)());
  qc.dispose();
  assert.equal(gs.registered.size, 0);
});
