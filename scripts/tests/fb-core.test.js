// =========================
// TESTS: FLASHCARD BATTLE – Spiellogik (games/flashcard-battle/fb-core.js)
// Ausführen: node --test scripts/tests/
// fb-core.js ist ein normales Browser-Script (setzt window.FBCore) und wird
// hier per vm im selben Kontext mit leerem window geladen (gleicher Realm,
// sonst schlägt deepStrictEqual bei Arrays fehl).
// =========================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CORE_PATH = path.join(__dirname, '..', '..', 'games', 'flashcard-battle', 'fb-core.js');
globalThis.window = {};
vm.runInThisContext(fs.readFileSync(CORE_PATH, 'utf8'), { filename: CORE_PATH });
const FBCore = globalThis.window.FBCore;

// Deterministischer Zufall (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Fragen ──

test('buildDeck: doppelte Vorderseiten nur einmal, leere Karten raus', () => {
  const deck = FBCore.buildDeck([
    { id: 'a', front: 'Hund', back: 'dog' },
    { id: 'b', front: '  hund ', back: 'dog2' },
    { id: 'c', front: 'Katze', back: '' },
    { id: 'd', front: '', back: 'x' },
    { id: 'e', front: 'Maus', back: '**mouse**' }
  ], s => s.replace(/\*/g, ''));
  assert.deepEqual(deck.map(c => c.id), ['a', 'e']);
  assert.equal(deck[1].back, 'mouse');
});

test('makeQuestion: 3 Optionen, richtige genau einmal', () => {
  const deck = [1, 2, 3, 4].map(i => ({ id: 'c' + i, front: 'F' + i, back: 'B' + i }));
  const q = FBCore.makeQuestion(deck[0], deck, rng(1));
  assert.equal(q.options.length, 3);
  assert.equal(q.options[q.correctIndex], 'B1');
  assert.equal(new Set(q.options).size, 3);
  assert.equal(q.prompt, 'F1');
  assert.equal(q.cardId, 'c1');
});

test('makeQuestion: gleiche Rückseiten anderer Karten sind keine Distraktoren', () => {
  const deck = [
    { id: 'a', front: 'A', back: 'gleich' },
    { id: 'b', front: 'B', back: ' Gleich ' },
    { id: 'c', front: 'C', back: 'anders' }
  ];
  const q = FBCore.makeQuestion(deck[0], deck, rng(2));
  assert.deepEqual([...q.options].sort(), ['anders', 'gleich']);
});

test('makeQuestion: Set mit 2 Karten ergibt 2 Optionen', () => {
  const deck = [{ id: 'a', front: 'A', back: 'x' }, { id: 'b', front: 'B', back: 'y' }];
  assert.equal(FBCore.makeQuestion(deck[0], deck, rng(3)).options.length, 2);
});
