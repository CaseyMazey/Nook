// Tests für „Willkommen zurück“ (js/today-welcome.js), reiner Teil.
// Ausführen: node --test tests/   (Node 18+, keine Abhängigkeiten)
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../js/today-welcome.js');

const at = (day, h = 12) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };

test('Eine Pause beginnt nach vier Tagen', () => {
  assert.equal(W.daysBetween('2026-11-10', '2026-11-15'), 5);
  assert.equal(W.daysBetween('2026-10-24', '2026-10-26'), 2, 'über die Zeitumstellung');
  assert.equal(W.isBreak('2026-11-11', '2026-11-15'), true);
  assert.equal(W.isBreak('2026-11-12', '2026-11-15'), false);
  assert.equal(W.isBreak(null, '2026-11-15'), false, 'erster Start ist keine Pause');
  assert.equal(W.isBreak('2026-12-28', '2027-01-02'), true, 'über den Jahreswechsel');
});

test('Liegen geblieben ist nur, was davor offen war', () => {
  const tasks = [
    { id: 'a', status: 'open', createdAt: at('2026-11-02') },
    { id: 'b', status: 'in_progress', createdAt: at('2026-11-10', 23) },
    { id: 'c', status: 'completed', createdAt: at('2026-11-01') },
    { id: 'd', status: 'open', createdAt: at('2026-11-15') },
    { id: 'e', status: 'open', createdAt: at('2026-11-01'), someday: true },
    { id: 'f', done: false, createdAt: at('2026-11-03') },
    { id: 'g', done: true, createdAt: at('2026-11-03') },
  ];
  assert.deepEqual(W.leftovers(tasks, '2026-11-10').map(t => t.id), ['a', 'b', 'f']);
  assert.deepEqual(W.leftovers(tasks, null), []);
});

test('Tage dazwischen ohne Rand', () => {
  assert.deepEqual(W.daysInBetween('2026-11-10', '2026-11-14'), ['2026-11-11', '2026-11-12', '2026-11-13']);
  assert.deepEqual(W.daysInBetween('2026-11-14', '2026-11-15'), []);
});
