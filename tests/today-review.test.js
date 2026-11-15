// Tests für Wochenrückblick (js/today-review.js) und Fokusmodus (js/today-focus.js), reine Teile.
// Ausführen: node --test tests/   (Node 18+, keine Abhängigkeiten)
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/today-review.js');
const F = require('../js/today-focus.js');

const euro = v => v.toFixed(2).replace('.', ',') + ' €';
const at = (day, h = 12) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };

test('Rückblick erscheint Sa/So für die laufende Woche, Mo für die vergangene', () => {
  // 15.11.2026 ist ein Sonntag
  assert.deepEqual(R.reviewWeek('2026-11-14'), { start: '2026-11-09', end: '2026-11-15', nextStart: '2026-11-16', nextEnd: '2026-11-22' });
  assert.equal(R.reviewWeek('2026-11-15').start, '2026-11-09');
  assert.equal(R.reviewWeek('2026-11-16').start, '2026-11-09', 'Montag zeigt die vergangene Woche');
  assert.equal(R.reviewWeek('2026-11-17'), null);
  assert.equal(R.reviewWeek('2026-11-13'), null);
  assert.equal(R.reviewWeek('2027-01-02').start, '2026-12-28', 'über den Jahreswechsel');
});

test('Kennzahlen zählen nur, was in der Woche liegt', () => {
  const week = R.reviewWeek('2026-11-15');
  const s = R.stats({
    week,
    tasks: [{ completedAt: at('2026-11-10') }, { completedAt: at('2026-11-15', 23) }, { completedAt: at('2026-11-08') }, { completedAt: null }],
    cards: [{ lastSeen: at('2026-11-12') }, { lastSeen: new Date(at('2026-11-13')).toISOString() }, { lastSeen: at('2026-11-02') }, {}],
    focusLog: { '2026-11-10': 50, '2026-11-11': 25, '2026-11-01': 90 },
    savings: [{ date: '2026-11-12', amount: 60 }, { date: '2026-11-14', amount: -10 }, { date: '2026-11-20', amount: 99 }],
  });
  assert.deepEqual(s, { tasksDone: 2, cardsLearned: 2, focusMinutes: 75, saved: 50 });
  assert.deepEqual(R.doneParts(s, euro), ['✓ 2 Aufgaben erledigt', '📚 2 Karten gelernt', '🎯 1 Std. 15 Min. Fokus', '🌱 50,00 € gespart']);
});

test('Leere Woche ergibt keine Bausteine; Einzahl richtig', () => {
  const week = R.reviewWeek('2026-11-15');
  assert.deepEqual(R.doneParts(R.stats({ week }), euro), []);
  assert.deepEqual(R.doneParts({ tasksDone: 1, cardsLearned: 1, focusMinutes: 45, saved: 0 }, euro), ['✓ 1 Aufgabe erledigt', '📚 1 Karte gelernt', '🎯 45 Min. Fokus']);
  assert.equal(R.hours(120), '2 Std.');
});

const plan = { off: false, segments: [
  { start: '08:00', end: '09:30', type: 'block', label: 'Projekt ATLAS', id: 1 },
  { start: '09:30', end: '09:45', type: 'break', label: 'Pause' },
  { start: '09:45', end: '11:15', type: 'block', label: 'Lernen', id: 2 },
] };

test('Fokus: laufender Block, Pause, nächster Block, Feierabend', () => {
  const c = F.current(plan, F.toMin('08:20'));
  assert.equal(c.seg.label, 'Projekt ATLAS');
  assert.equal(c.now, true);
  assert.equal(c.minutesLeft, 70);
  const p = F.current(plan, F.toMin('09:35'));
  assert.equal(p.seg.type, 'break');
  assert.equal(p.next.label, 'Lernen');
  const before = F.current(plan, F.toMin('07:30'));
  assert.deepEqual([before.now, before.seg.label, before.minutesLeft], [false, 'Projekt ATLAS', 30]);
  assert.equal(F.current(plan, F.toMin('12:00')), null);
  assert.equal(F.current({ off: true, segments: [] }, 600), null);
});

test('Fokus: Uhr und Tageslog', () => {
  assert.equal(F.clock(25 * 60), '25:00');
  assert.equal(F.clock(61.4), '01:01');
  let log = F.addMinutes({}, '2026-11-15', 24.6);
  log = F.addMinutes(log, '2026-11-15', 25);
  assert.deepEqual(log, { '2026-11-15': 50 });
  assert.deepEqual(F.addMinutes({ '2026-08-01': 30 }, '2026-11-15', 0.5), {}, 'unter 1 Minute zählt nicht, Altes fällt weg');
});
