// Tests für die Abo-Hinweise (js/budget-abos.js) und die Preiserhöhung im Import (js/budget-import.js).
// Ausführen: node --test tests/   (Node 18+, keine Abhängigkeiten)
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/budget-import.js');
const A = require('../js/budget-abos.js');

const euro = v => v.toFixed(2).replace('.', ',') + ' €';
const rec = (id, name, amount, freq = 'monthly', type = 'expense') => ({ id, name, amount, freq, type });

test('Dienste werden erkannt, auch in Bank-Schreibweise', () => {
  assert.equal(A.service('SPOTIFY AB').name, 'Spotify');
  assert.equal(A.service('Apple Music').name, 'Apple Music');
  assert.equal(A.service('YouTube Music').name, 'YouTube Music');
  assert.equal(A.service('YouTube Premium').name, 'YouTube Premium');
  assert.equal(A.service('Netflix International B.V.').name, 'Netflix');
  assert.equal(A.service('Miete'), null);
});

test('Kündigen-Links nur, wo eine geprüfte Seite bekannt ist', () => {
  assert.match(A.cancelUrl('Spotify'), /^https:\/\/www\.spotify\.com\//);
  assert.equal(A.cancelUrl('Sky'), null);
  assert.equal(A.cancelUrl('Stadtwerke'), null);
  for (const s of A.SERVICES) if (s.cancel) assert.match(s.cancel, /^https:\/\//, s.name);
});

test('Zwei Musik-Abos ergeben einen Hinweis mit Monatssumme', () => {
  const d = A.duplicates([rec('a', 'Spotify', 10.99), rec('b', 'Apple Music', 10.99), rec('c', 'Miete', 650)]);
  assert.equal(d.length, 1);
  assert.equal(d[0].kind, 'group');
  assert.equal(d[0].monthly, 21.98);
  assert.equal(A.hintText(d[0], euro), 'Zwei Musik-Abos: Spotify und Apple Music, zusammen 21,98 € im Monat.');
});

test('Jährliche Abos zählen anteilig, Einnahmen nie', () => {
  const d = A.duplicates([rec('a', 'Netflix', 13.99), rec('b', 'Amazon Prime', 89.9, 'yearly'), rec('c', 'Netflix Gutschrift', 13.99, 'monthly', 'income')]);
  assert.equal(d.length, 1);
  assert.equal(d[0].entries.length, 2);
  assert.equal(d[0].monthly, Math.round((13.99 + 89.9 / 12) * 100) / 100);
});

test('Derselbe Posten zweimal; verschiedene Dienste ohne Gruppe nicht', () => {
  const d = A.duplicates([rec('a', 'Handyvertrag', 15), rec('b', 'HANDYVERTRAG', 15), rec('c', 'Adobe', 24), rec('d', 'YouTube Premium', 12.99)]);
  assert.equal(d.length, 1);
  assert.equal(d[0].kind, 'same');
  assert.match(A.hintText(d[0], euro), /„Handyvertrag“ steht zweimal in deinen Posten, zusammen 30,00 € im Monat\./);
});

test('Die Hinweis-ID ändert sich, wenn ein Abo dazukommt', () => {
  const one = A.duplicates([rec('a', 'Spotify', 10), rec('b', 'Deezer', 11)])[0].id;
  const two = A.duplicates([rec('a', 'Spotify', 10), rec('b', 'Deezer', 11), rec('c', 'Tidal', 11)])[0].id;
  assert.notEqual(one, two);
  assert.equal(one.split('|')[0], two.split('|')[0]);
});

const monthly = (name, amounts, day = '03') => amounts.map((amount, i) => ({ date: `2026-${String(6 + i).padStart(2, '0')}-${day}`, amount, name, purpose: '' }));

test('Preiserhöhung: neuer Preis zählt, nicht der Durchschnitt', () => {
  const f = I.findRecurring(monthly('Netflix', [13.99, 13.99, 13.99, 13.99, 15.99, 15.99]), '2026-11-15');
  assert.equal(f.length, 1);
  assert.deepEqual(f[0].hike, { from: 13.99, to: 15.99, date: '2026-10-03' });
  assert.equal(f[0].average, 15.99);
  assert.equal(f[0].varies, false);
  assert.equal(I.toBudgetEntry(f[0]).amount, 15.99);
});

test('Keine Preiserhöhung bei schwankenden Rechnungen, kleinen Cent-Beträgen oder Preissenkung', () => {
  const today = '2026-11-15';
  assert.equal(I.findRecurring(monthly('Stadtwerke', [61, 58, 72, 64, 66, 70]), today)[0].hike, null);
  assert.equal(I.findRecurring(monthly('Zeitung', [4.99, 4.99, 4.99, 5.19]), today)[0].hike, null, 'unter 0,50 €');
  assert.equal(I.findRecurring(monthly('Handy', [20, 20, 20, 15, 15]), today)[0].hike, null);
});

test('Wöchentliches Abo mit Preiserhöhung wird trotz strenger Betragsregel gefunden', () => {
  const rows = [0, 7, 14, 21, 28, 35].map((d, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10), amount: i < 3 ? 19.99 : 22.99, name: 'Gemüsekiste', purpose: '' }));
  const f = I.findRecurring(rows, '2026-11-10');
  assert.equal(f.length, 1);
  assert.equal(f[0].freq, 'weekly');
  assert.equal(f[0].hike.to, 22.99);
});

test('Vorhandener Posten mit altem Preis wird zum Anpassen vorgeschlagen', () => {
  const f = I.findRecurring(monthly('Netflix', [13.99, 13.99, 13.99, 15.99]), '2026-11-15')[0];
  const existing = { id: 'n', name: 'Netflix', type: 'expense', freq: 'monthly', amount: 13.99, certainty: 'fixed' };
  assert.equal(I.findExisting(f, [existing]), existing);
  assert.deepEqual(I.amountChange(f, existing), { from: 13.99, to: 15.99 });
  assert.equal(I.amountChange(f, { ...existing, amount: 15.99 }), null, 'Betrag passt schon');
  assert.equal(I.amountChange(f, { ...existing, certainty: 'variable' }), null, 'variable Posten bleiben');
  assert.equal(I.amountChange(f, { ...existing, freq: 'yearly' }), null, 'anderer Rhythmus');
});
