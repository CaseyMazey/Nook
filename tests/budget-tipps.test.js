// Tests für die Budget-Tipps (js/budget-tipps.js, reiner Teil) und die Abo-Jahreskosten (js/budget-abos.js).
// Ausführen: node --test tests/   (Node 18+, keine Abhängigkeiten)
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/budget-tipps.js');
const A = require('../js/budget-abos.js');

const yearly = (id, name, amount, dateDay, dateMonth) => ({ id, name, amount, type: 'expense', freq: 'yearly', dateDay, dateMonth });

test('Rücklage: Summe, Monatsbetrag aufgerundet, nächste Zahlung', () => {
  const r = T.yearlyReserve([
    yearly('a', 'Kfz-Versicherung', 312, 2, 3),
    yearly('b', 'Haftpflicht', 60, 15, 1),
    yearly('c', 'Amazon Prime', 89.9, 20, 11),
    { id: 'd', name: 'Miete', amount: 450, type: 'expense', freq: 'monthly', day: 1 },
  ], [], '2026-11-15');
  assert.equal(r.total, 461.9);
  assert.equal(r.monthly, 39);
  assert.deepEqual(r.items.map(i => i.name), ['Amazon Prime', 'Haftpflicht', 'Kfz-Versicherung']);
  assert.equal(r.next.date, '2026-11-20');
  assert.equal(r.daysToNext, 5);
  assert.equal(r.goal, null);
  assert.equal(r.missing, 89.9);
});

test('Rücklage: nächstes Jahr, 29.02. in kurzen Jahren, ohne jährliche Posten null', () => {
  assert.equal(T.nextYearlyDate({ dateDay: 2, dateMonth: 3 }, '2026-11-15'), '2027-03-02');
  assert.equal(T.nextYearlyDate({ dateDay: 29, dateMonth: 2 }, '2026-11-15'), '2027-02-28');
  assert.equal(T.yearlyReserve([{ id: 'x', name: 'Miete', amount: 450, type: 'expense', freq: 'monthly' }], [], '2026-11-15'), null);
});

test('Rücklage anlegen: Sparziel mit Finanzierung aus der Einnahme', () => {
  const r = T.yearlyReserve([yearly('a', 'Kfz-Versicherung', 300, 2, 3)], [], '2026-11-15');
  const g = T.reserveGoal(r, { id: 'gehalt' }, '2026-11-15', 'g1');
  assert.equal(g.target, 300);
  assert.equal(g.yearlyReserve, true);
  assert.equal(g.reserveActive, true);
  assert.deepEqual(g.funding, [{ id: 'g1-f', sourceId: 'gehalt', amount: 25 }]);
  assert.equal(g.priority, 'must');
  const noSource = T.reserveGoal(r, null, '2026-11-15', 'g2');
  assert.equal(noSource.reserveActive, false);
  assert.deepEqual(noSource.funding, []);
});

test('Rücklage vorhanden: Abweichung und was für die nächste Zahlung fehlt', () => {
  const goal = { id: 'g', yearlyReserve: true, target: 300, current: 250 };
  const r = T.yearlyReserve([yearly('a', 'Kfz', 300, 2, 3), yearly('b', 'Prime', 89.9, 20, 11)], [goal], '2026-11-15');
  assert.equal(r.goal, goal);
  assert.equal(r.targetOff, true);
  assert.equal(r.missing, 0, 'Prime (89,90 €) ist mit 250 € gedeckt');
  assert.equal(T.yearlyReserve([yearly('a', 'Kfz', 300, 2, 3)], [{ ...goal, archived: true }], '2026-11-15').goal, null);
});

test('Sparvorschlag: nur in der letzten Monatswoche, 80 % auf 5 € abgerundet', () => {
  const goals = [{ id: 'u', name: 'Urlaub', target: 600, current: 100, priority: 'want' }, { id: 'n', name: 'Notgroschen', target: 1000, current: 0, priority: 'must' }];
  assert.equal(T.monthEndSuggestion({ gap: 100 }, goals, '2026-11-20', null), null, 'zu früh');
  const s = T.monthEndSuggestion({ gap: 103 }, goals, '2026-11-25', null);
  assert.equal(s.amount, 80);
  assert.equal(s.goals[0].name, 'Notgroschen', 'wichtigstes Ziel zuerst');
  assert.equal(T.monthEndSuggestion({ gap: 103 }, goals, '2026-11-25', '2026-11'), null, 'für diesen Monat ausgeblendet');
  assert.equal(T.monthEndSuggestion({ gap: 11 }, goals, '2026-11-30', null), null, 'unter 10 €');
  assert.equal(T.monthEndSuggestion({ gap: 500 }, [{ id: 'v', target: 100, current: 100 }], '2026-11-30', null), null, 'kein offenes Ziel');
  assert.equal(T.monthEndSuggestion(null, goals, '2026-11-30', null), null, 'ohne Kontostand');
});

test('Sparvorschlag: nie mehr als dem Ziel noch fehlt', () => {
  const s = T.monthEndSuggestion({ gap: 300 }, [{ id: 'k', name: 'Kopfhörer', target: 150, current: 120 }], '2026-02-25', null);
  assert.equal(s.amount, 240);
  assert.equal(T.suggestFor(s, s.goals[0]), 30);
});

test('Bis zum nächsten Geld: offene Ausgaben bis zum Vortag, pro Tag geteilt', () => {
  const w = T.nextMoneyWindow({ today: '2026-11-15', balance: 300, events: [
    { date: '2026-11-10', amount: 20, income: false, name: 'Handy (überfällig)' },
    { date: '2026-11-20', amount: 40, income: false, name: 'Fitness' },
    { date: '2026-11-30', amount: 500, income: true, name: 'Taschengeld' },
    { date: '2026-11-30', amount: 450, income: false, name: 'Miete am Zahltag' },
    { date: '2026-12-01', amount: 63, income: false, name: 'Ticket' },
  ] });
  assert.equal(w.date, '2026-11-30');
  assert.equal(w.name, 'Taschengeld');
  assert.equal(w.days, 15);
  assert.equal(w.available, 240);
  assert.equal(w.perDay, 16);
});

test('Bis zum nächsten Geld: heutige Einnahme zählt schon, nichts in Sicht oder kein Kontostand → null', () => {
  const w = T.nextMoneyWindow({ today: '2026-11-15', balance: 10, events: [
    { date: '2026-11-15', amount: 100, income: true, name: 'Nebenjob' },
    { date: '2026-12-15', amount: 100, income: true, name: 'Nebenjob' },
  ] });
  assert.equal(w.available, 110);
  assert.equal(w.days, 30);
  assert.equal(T.nextMoneyWindow({ today: '2026-11-15', balance: 10, events: [] }), null);
  assert.equal(T.nextMoneyWindow({ today: '2026-11-15', balance: null, events: [{ date: '2026-11-20', amount: 1, income: true }] }), null);
  assert.equal(T.nextMoneyWindow({ today: '2026-11-15', balance: 10, events: [{ date: '2027-02-01', amount: 1, income: true }] }), null, 'über 45 Tage');
});

test('Bis zum nächsten Geld: alles verplant ergibt einen negativen Rest', () => {
  const w = T.nextMoneyWindow({ today: '2026-11-15', balance: 50, events: [
    { date: '2026-11-16', amount: 80, income: false, name: 'Rechnung' },
    { date: '2026-11-18', amount: 100, income: true, name: 'Gehalt' },
  ] });
  assert.equal(w.available, -30);
});

test('Vorlagen: jede Vorlage ergibt gültige Posten', () => {
  for (const [id, t] of Object.entries(T.TEMPLATES)) {
    assert.ok(t.items.length >= 3, id);
    for (const it of t.items) {
      const e = T.templateEntry(it, { id: 'x', startMonth: '2026-11' });
      assert.ok(e.name && e.amount > 0, `${id}: ${it.name}`);
      assert.ok(['income', 'expense'].includes(e.type));
      if (e.type === 'expense') { assert.ok(['must', 'need', 'want'].includes(e.priority)); assert.deepEqual(e.funding, []); }
      else { assert.equal(e.priority, 'none'); assert.ok(e.icon); }
      if (e.freq === 'yearly') assert.ok(e.dateDay >= 1 && e.dateMonth >= 1 && e.dateMonth <= 12 && e.day === undefined);
      else { assert.equal(e.freq, 'monthly'); assert.ok(e.day >= 1 && e.day <= 31); }
      assert.equal(e.startMonth, '2026-11');
    }
  }
});

test('Abo-Jahreskosten: ab zwei erkannten Abos, jährliche anteilig', () => {
  const rec = (name, amount, freq = 'monthly') => ({ id: name, name, amount, freq, type: 'expense' });
  assert.equal(A.totals([rec('Spotify', 10.99), rec('Miete', 450)]), null);
  const t = A.totals([rec('Spotify', 10.99), rec('Netflix', 13.99), rec('Amazon Prime', 89.9, 'yearly'), rec('Miete', 450)]);
  assert.equal(t.count, 3);
  assert.equal(t.monthly, Math.round((10.99 + 13.99 + 89.9 / 12) * 100) / 100);
  assert.equal(t.yearly, Math.round(t.monthly * 12 * 100) / 100);
});
