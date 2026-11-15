// Tests für das Nook-Jahresbuch (js/today-yearbook.js), reiner Teil.
// Ausführen: node --test tests/   (Node 18+, keine Abhängigkeiten)
const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('../js/today-yearbook.js');

const at = (day, h = 12) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };

test('Das Buch liegt vom 15. Dezember bis Ende Januar bereit', () => {
  assert.equal(Y.seasonYear('2026-12-14'), null);
  assert.equal(Y.seasonYear('2026-12-15'), 2026);
  assert.equal(Y.seasonYear('2026-12-31'), 2026);
  assert.equal(Y.seasonYear('2027-01-31'), 2026);
  assert.equal(Y.seasonYear('2027-02-01'), null);
  assert.equal(Y.seasonYear('2026-11-15'), null);
});

test('Kennzahlen zählen nur das gewählte Jahr', () => {
  const s = Y.stats({
    year: 2026,
    tasks: [
      { status: 'completed', completedAt: at('2026-03-02') }, { status: 'completed', completedAt: at('2026-03-20') },
      { status: 'completed', completedAt: at('2026-07-01') }, { status: 'completed', completedAt: at('2025-12-30') },
      { status: 'open', completedAt: null }, { done: true, completedAt: at('2026-07-04') },
    ],
    projects: [{ tasks: [{ done: true, completedAt: at('2026-05-05') }, { done: false }],
      subprojects: [{ tasks: [{ done: true, completedAt: new Date(at('2026-06-01')).toISOString() }, { done: true, completedAt: at('2025-06-01') }] }] }],
    fcHistory: { '2026-11-10': { learned: 12 }, '2026-11-12': { learned: 8 }, '2025-12-01': { learned: 99 } },
    focusLog: { '2026-02-01': 50, '2026-02-03': 125, '2025-01-01': 600 },
    savings: [{ date: '2026-04-01', amount: 100 }, { date: '2026-05-01', amount: -20 }, { date: '2025-04-01', amount: 999 }],
    goals: [{ target: 100, current: 120 }, { target: 200, current: 50 }, { target: 0, current: 0 }],
    gardenDex: { a: { firstSeen: at('2026-08-01') }, b: { firstSeen: at('2025-08-01') } },
    dayLines: { '2026-01-02': { text: 'x', mood: 2 } },
  });
  assert.equal(s.tasksDone, 4);
  assert.equal(s.busiestMonth, 2, 'März (zwei Aufgaben)');
  assert.equal(s.projectSteps, 2);
  assert.equal(s.cardsLearned, 20);
  assert.equal(s.cardDays, 2);
  assert.equal(s.cardsSince, '2026-11-10', 'Verlauf beginnt spät im Jahr');
  assert.equal(s.focusMinutes, 175);
  assert.deepEqual(s.focusBest, { date: '2026-02-03', minutes: 125 });
  assert.equal(s.saved, 80);
  assert.equal(s.goalsFull, 1);
  assert.equal(s.gardenNew, 1);
  assert.equal(s.lineCount, 1);
});

test('Sonnigster Monat braucht mindestens drei Symbole', () => {
  const lines = {
    '2026-05-01': { text: 'a', mood: 5 }, '2026-05-02': { text: 'b', mood: 5 },
    '2026-06-01': { text: 'c', mood: 4 }, '2026-06-02': { text: 'd', mood: 4 }, '2026-06-03': { text: '', mood: 3 },
  };
  const s = Y.stats({ year: 2026, dayLines: lines });
  assert.equal(s.sunniestMonth, 5, 'Juni – der Mai hat nur zwei');
  assert.deepEqual(s.picks.map(p => p.text), ['a', 'b', 'c', 'd'], 'Zitate nur mit Text');
});

test('Seiten nur mit Inhalt; ein leeres Jahr ist ein ruhiges Jahr', () => {
  const empty = Y.stats({ year: 2026 });
  assert.deepEqual(Y.pages(empty).map(p => p.kind), ['title', 'quiet', 'end']);
  const some = Y.stats({ year: 2026, focusLog: { '2026-01-05': 30 }, gardenDex: { a: { firstSeen: at('2026-02-02') } } });
  assert.deepEqual(Y.pages(some).map(p => p.kind), ['title', 'focus', 'garden', 'end']);
});

test('Verteilte Auswahl und Stunden', () => {
  assert.deepEqual(Y.pickSpread([1, 2, 3, 4, 5, 6, 7, 8, 9], 5), [1, 3, 5, 7, 9]);
  assert.deepEqual(Y.pickSpread([1, 2], 5), [1, 2]);
  assert.equal(Y.hours(175), '2 Std. 55 Min.');
  assert.equal(Y.hours(40), '40 Min.');
  assert.equal(Y.hours(120), '2 Std.');
});
