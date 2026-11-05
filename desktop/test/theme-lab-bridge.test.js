// Brücke Hauptfenster ↔ Musterfenster ("Theme live bearbeiten"): Nachrichtenprüfung
// und Speichern mit Rückrollen (js/theme-skins.js).
const test = require('node:test');
const assert = require('node:assert');
const S = require('../../js/theme-skins.js');

const frame = { name: 'lab-iframe' };
const other = { name: 'fremd' };

test('isLabMessage: nur eigenes Fenster mit Lab-Typ', () => {
  assert.strictEqual(S.isLabMessage({ source: frame, data: { type: 'nook-theme-lab:save' } }, frame), true);
  assert.strictEqual(S.isLabMessage({ source: other, data: { type: 'nook-theme-lab:save' } }, frame), false);
  assert.strictEqual(S.isLabMessage({ source: frame, data: { type: 'save' } }, frame), false);
  assert.strictEqual(S.isLabMessage({ source: frame, data: 'nook-theme-lab:save' }, frame), false);
  assert.strictEqual(S.isLabMessage({ source: frame, data: null }, frame), false);
  assert.strictEqual(S.isLabMessage({ source: null, data: { type: 'nook-theme-lab:save' } }, null), false);
  assert.strictEqual(S.isLabMessage(null, frame), false);
});

const themes = () => [
  { id: 'a', name: 'A', skins: { 'today.menu': { colors: { text: '#111111' } } } },
  { id: 'b', name: 'B' },
];

test('applyLabSave: speichert bereinigte Skins', () => {
  const t = themes();
  let saved = 0;
  const res = S.applyLabSave(t, 'b', { x: 1 }, {
    sanitize: s => (s.x ? { 'today.menu': { colors: { text: '#222222' } } } : null),
    save: () => { saved++; }
  });
  assert.deepStrictEqual(res, { ok: true });
  assert.strictEqual(saved, 1);
  assert.deepStrictEqual(t[1].skins, { 'today.menu': { colors: { text: '#222222' } } });
});

test('applyLabSave: leeres Ergebnis entfernt skins', () => {
  const t = themes();
  const res = S.applyLabSave(t, 'a', {}, { sanitize: () => null, save: () => {} });
  assert.strictEqual(res.ok, true);
  assert.ok(!('skins' in t[0]));
});

test('applyLabSave: wirft save, wird der alte Stand wiederhergestellt', () => {
  const t = themes();
  const before = JSON.parse(JSON.stringify(t[0].skins));
  const res = S.applyLabSave(t, 'a', {}, {
    sanitize: () => ({ 'today.menu': { colors: { text: '#999999' } } }),
    save: () => { throw new Error('QuotaExceededError'); }
  });
  assert.strictEqual(res.ok, false);
  assert.match(res.message, /Speicher|Quota/i);
  assert.deepStrictEqual(t[0].skins, before);
});

test('applyLabSave: Rückrollen ohne vorherige skins entfernt das Feld wieder', () => {
  const t = themes();
  const res = S.applyLabSave(t, 'b', {}, {
    sanitize: () => ({ 'today.menu': { colors: { text: '#999999' } } }),
    save: () => { throw new Error('voll'); }
  });
  assert.strictEqual(res.ok, false);
  assert.ok(!('skins' in t[1]));
});

test('applyLabSave: unbekannte themeId', () => {
  let saved = 0;
  const res = S.applyLabSave(themes(), 'zzz', {}, { sanitize: s => s, save: () => { saved++; } });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(saved, 0);
});
