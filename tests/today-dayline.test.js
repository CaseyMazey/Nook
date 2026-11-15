// Tests für „Eine Zeile pro Tag“ (js/today-dayline.js), reiner Teil.
// Ausführen: node --test tests/   (Node 18+, keine Abhängigkeiten)
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/today-dayline.js');

test('Heute vor einem Jahr, auch am 29. Februar', () => {
  assert.equal(D.yearAgo('2026-11-15'), '2025-11-15');
  assert.equal(D.yearAgo('2028-02-29'), '2027-02-28');
  assert.equal(D.yearAgo('2027-01-01'), '2026-01-01');
});

test('Eintrag setzen, kürzen, leeren', () => {
  let l = D.setEntry({}, '2026-11-15', { text: '  Erster   Schnee!  ' });
  assert.deepEqual(l, { '2026-11-15': { text: 'Erster Schnee!', mood: null } });
  l = D.setEntry(l, '2026-11-15', { mood: 5 });
  assert.deepEqual(l['2026-11-15'], { text: 'Erster Schnee!', mood: 5 });
  l = D.setEntry(l, '2026-11-15', { mood: 9 });
  assert.equal(l['2026-11-15'].mood, null, 'unbekanntes Symbol fällt weg');
  l = D.setEntry(l, '2026-11-15', { text: '' });
  assert.deepEqual(l, {}, 'ohne Text und Symbol kein Eintrag');
  assert.deepEqual(D.setEntry({}, '2026-11-14', { mood: 2 }), { '2026-11-14': { text: '', mood: 2 } }, 'nur ein Symbol reicht');
  assert.equal(D.setEntry({}, 'x', { text: 'a'.repeat(300) }).x.text.length, D.MAX_LEN);
});

test('Nach Monaten gruppiert, neueste zuerst', () => {
  const g = D.byMonth({
    '2026-10-03': { text: 'a', mood: 1 }, '2026-11-15': { text: 'b', mood: null }, '2026-11-02': { text: 'c', mood: 3 },
  });
  assert.deepEqual(g.map(x => [x.month, x.entries.map(e => e.date)]), [
    ['2026-11', ['2026-11-15', '2026-11-02']], ['2026-10', ['2026-10-03']],
  ]);
  assert.equal(D.moodIcon(5), '☀️');
  assert.equal(D.moodIcon(null), '');
});
