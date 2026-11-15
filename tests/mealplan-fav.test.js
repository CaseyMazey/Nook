// Tests für die Lieblingsgerichte im Speiseplan (js/mealplan-fav.js), reiner Teil.
// Ausführen: node --test tests/   (Node 18+, keine Abhängigkeiten)
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/mealplan-fav.js');

test('Ein Stichwort trifft alle Varianten eines Gerichts', () => {
  assert.ok(F.matches('Nudeln Bolognese', 'Bolognese'));
  assert.ok(F.matches('Spaghetti mit Erbsen-Bolognese', 'Bolognese'));
  assert.ok(F.matches('Gemüsebolognese mit Parmesan', 'bolognese'));
  assert.ok(F.matches('VEGAN Linsen-Bolognese', 'Bolognese'));
  assert.ok(!F.matches('Spaghetti Napoli', 'Bolognese'));
});

test('Groß-/Kleinschreibung und Umlaute spielen keine Rolle', () => {
  assert.ok(F.matches('KÄSESPÄTZLE mit Röstzwiebeln', 'käsespätzle'));
  assert.ok(F.matches('Käsespätzle', 'Kaesespaetzle'));
  assert.ok(F.matches('Grießbrei mit Zimt', 'griessbrei'));
  assert.ok(F.matches('Crème brûlée', 'creme brulee'));
});

test('In Anführungszeichen zählt nur das ganze Wort', () => {
  assert.ok(F.matches('Preiselbeeren mit Vanilleeis', 'Reis'), 'ohne Anführungszeichen auch mitten im Wort');
  assert.ok(!F.matches('Preiselbeeren mit Vanilleeis', '"Reis"'));
  assert.ok(F.matches('Hähnchen-Curry mit Reis', '"Reis"'));
  assert.ok(F.matches('Reis-Pfanne', '„Reis“'), 'deutsche Anführungszeichen');
  assert.ok(F.matches('Chili sin Carne', '"chili sin carne"'), 'auch mehrere Wörter');
});

test('Leere Eingaben treffen nichts', () => {
  assert.ok(!F.matches('Nudeln Bolognese', ''));
  assert.ok(!F.matches('Nudeln Bolognese', '""'));
  assert.ok(!F.matches('', 'Bolognese'));
  assert.ok(!F.matches('Nudeln Bolognese', '  - '));
});

test('Hinzufügen ohne Doppelte, Umbenennen und Entfernen', () => {
  let list = F.add([], ' Bolognese ');
  assert.deepEqual(list, ['Bolognese']);
  assert.deepEqual(F.add(list, 'bolognese'), ['Bolognese'], 'gleiches Wort anders geschrieben');
  assert.deepEqual(F.add(list, '"Bolognese"'), ['Bolognese', '"Bolognese"'], 'ganzes Wort ist ein anderes Stichwort');
  assert.deepEqual(F.add(list, '   '), ['Bolognese']);
  list = F.add(list, 'Lasagne');
  assert.deepEqual(F.rename(list, 1, 'Gemüselasagne'), ['Bolognese', 'Gemüselasagne']);
  assert.deepEqual(F.rename(list, 1, ''), ['Bolognese'], 'leer = entfernen');
  assert.deepEqual(F.rename(list, 1, 'BOLOGNESE'), ['Bolognese'], 'Doppelte fallen weg');
  assert.equal(F.add([], 'x'.repeat(80))[0].length, F.MAX_LEN);
});

test('Vorschlag aus einem Gericht und Anzeigename', () => {
  assert.equal(F.suggest('VEGAN  Linsen-Bolognese'), 'Linsen-Bolognese');
  assert.equal(F.label('"Reis"'), 'Reis');
  assert.equal(F.label('Bolognese'), 'Bolognese');
});

test('Treffer der Woche je Stichwort, ab einem Tag', () => {
  const slots = ['menu1', 'menu2', 'menu3', 'dessert'];
  const week = { days: [
    { menu1: 'Nudeln Bolognese', menu2: 'Hähnchen-Curry mit Reis', menu3: '', dessert: 'Obstsalat' },
    { menu1: 'Spaghetti Napoli', menu2: '', menu3: '', dessert: '' },
    { menu1: '', menu2: '', menu3: '', dessert: '' },
    { menu1: 'Spaghetti mit Erbsen-Bolognese', menu2: '', menu3: '', dessert: 'Kaiserschmarrn' },
    null,
  ] };
  const all = F.weekHits(week, ['Bolognese', 'Kaiserschmarrn', 'Lasagne'], slots);
  assert.deepEqual(all.map(h => [h.fav, h.dishes.map(d => d.dayIndex)]), [
    ['Bolognese', [0, 3]], ['Kaiserschmarrn', [3]], ['Lasagne', []],
  ]);
  assert.deepEqual(F.weekHits(week, ['Bolognese'], slots, 1)[0].dishes.map(d => d.text), ['Spaghetti mit Erbsen-Bolognese']);
  assert.deepEqual(F.weekHits(null, ['Bolognese'], slots), [{ fav: 'Bolognese', dishes: [] }]);
  assert.deepEqual(F.hitsFor('Nudeln Bolognese', ['Lasagne', 'Bolognese', 'Nudeln']), ['Bolognese', 'Nudeln']);
});
