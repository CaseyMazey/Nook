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

// ── Kampf-Formeln ──

test('comboMultiplier steigt um 0.5 und deckelt bei x5', () => {
  assert.equal(FBCore.comboMultiplier(1), 1);
  assert.equal(FBCore.comboMultiplier(2), 1.5);
  assert.equal(FBCore.comboMultiplier(9), 5);
  assert.equal(FBCore.comboMultiplier(30), 5);
  assert.equal(FBCore.comboMultiplier(0), 1);
});

test('calcDamage: kritisch unter 5 s gibt +50 %', () => {
  assert.deepEqual(FBCore.calcDamage(1, 4999), { amount: 15, crit: true });
  assert.deepEqual(FBCore.calcDamage(1, 5000), { amount: 10, crit: false });
  assert.deepEqual(FBCore.calcDamage(9, 1000), { amount: 75, crit: true });
});

test('enemyStats skaliert nur im Endlosmodus', () => {
  assert.deepEqual(FBCore.enemyStats('normal', 6, 'fixed'), { hp: 30, atk: 15, xp: 10 });
  assert.deepEqual(FBCore.enemyStats('normal', 6, 'endless'), { hp: 45, atk: 23, xp: 10 });
});

test('levelFromXp: Level L braucht 100 × L XP', () => {
  assert.deepEqual(FBCore.levelFromXp(0),   { level: 1, intoLevel: 0,  needed: 100 });
  assert.deepEqual(FBCore.levelFromXp(150), { level: 2, intoLevel: 50, needed: 200 });
  assert.deepEqual(FBCore.levelFromXp(300), { level: 3, intoLevel: 0,  needed: 300 });
});

// ── Run-Logik ──

const MONSTERS = [
  { id: 'n1', name: 'N1', tier: 'normal', emoji: '🟢' },
  { id: 'n2', name: 'N2', tier: 'normal', emoji: '🦇' },
  { id: 'r1', name: 'R1', tier: 'rare',   emoji: '👻' },
  { id: 'b1', name: 'B1', tier: 'boss',   emoji: '🐉' }
];

function deckOf(n) {
  return Array.from({ length: n }, (_, i) => ({ id: 'k' + i, front: 'F' + i, back: 'B' + i }));
}
// Jede Abfrage der Uhr springt weiter: 6000 ms → nie kritisch, 1000 ms → immer kritisch
function clock(step) { let t = 0; return () => (t += step); }
function answerRight(run) { return run.question.correctIndex; }
function answerWrong(run) { return (run.question.correctIndex + 1) % run.question.options.length; }
function newRun(mode, n, seed, step = 6000) {
  return FBCore.createRun({ mode, deck: deckOf(n), monsters: MONSTERS, rng: rng(seed), now: clock(step) });
}

test('fixed: 5 Räume, der 5. ist Boss, Sieg nach dem Boss', () => {
  const run = newRun('fixed', 6, 4);
  const spawns = [run.events[0]];
  while (!run.over) spawns.push(...FBCore.answer(run, answerRight(run)).filter(e => e.type === 'spawn'));
  assert.deepEqual(spawns.map(s => s.room), [1, 2, 3, 4, 5]);
  assert.deepEqual(spawns.map(s => s.tier === 'boss'), [false, false, false, false, true]);
  assert.equal(run.won, true);
  assert.equal(run.roomsCleared, 5);
});

test('falsche Antwort: Schaden am Spieler und Combo weg', () => {
  const run = newRun('fixed', 6, 5);
  FBCore.answer(run, answerRight(run));
  assert.equal(run.streak, 1);
  const atk = run.enemy.atk;
  const ev = FBCore.answer(run, answerWrong(run));
  assert.deepEqual(ev[0], { type: 'hurt', amount: atk });
  assert.equal(run.hp, 100 - atk);
  assert.equal(run.streak, 0);
});

test('fixed: Heilung nach Sieg, gedeckelt auf maxHp', () => {
  const run = newRun('fixed', 6, 6);
  run.hp = 90;
  run.enemy.hp = 1;
  const ev = FBCore.answer(run, answerRight(run));
  assert.deepEqual(ev.find(e => e.type === 'heal'), { type: 'heal', amount: 10 });
  assert.equal(run.hp, 100);
});

test('endless: Raum 5 und 10 sind Boss, Ende nur durch HP 0', () => {
  const run = newRun('endless', 6, 7);
  const spawns = [run.events[0]];
  while (run.room < 11) spawns.push(...FBCore.answer(run, answerRight(run)).filter(e => e.type === 'spawn'));
  assert.deepEqual(spawns.filter(s => s.tier === 'boss').map(s => s.room), [5, 10]);
  assert.equal(run.over, false);
  let last = [];
  while (!run.over) last = FBCore.answer(run, answerWrong(run));
  const end = last.find(e => e.type === 'end');
  assert.equal(end.won, false);
  assert.equal(end.roomsCleared, 10);
  assert.equal(run.hp, 0);
});

test('cards: jede Karte höchstens einmal, Boss bei 5 übrigen Karten', () => {
  const run = newRun('cards', 8, 8);
  const asked = [run.question.cardId];
  const perAnswer = [];
  let i = 0;
  while (!run.over) {
    perAnswer.push(FBCore.answer(run, i++ % 2 === 0 ? answerRight(run) : answerWrong(run)));
    if (!run.over) asked.push(run.question.cardId);
  }
  assert.equal(asked.length, 8);
  assert.equal(new Set(asked).size, 8);
  const types = perAnswer.map(ev => ev.map(e => e.type + (e.tier ? ':' + e.tier : '')));
  assert.ok(types[2].includes('retreat'));
  assert.ok(types[2].includes('spawn:boss'));
  assert.equal(types.flat().filter(t => t === 'retreat').length, 1);
  assert.equal(types.flat().filter(t => t === 'spawn:boss').length, 1);
});

test('cards: Ende nach der letzten Karte, Sieg bei HP > 0', () => {
  const run = newRun('cards', 8, 9);
  let answers = 0, last = [];
  while (!run.over) {
    last = FBCore.answer(run, answerWrong(run));
    answers++;
    if (last.some(e => e.type === 'spawn' && e.tier === 'boss')) run.enemy.atk = 1;
  }
  assert.equal(answers, 8);
  assert.ok(run.hp > 0);
  assert.equal(last.find(e => e.type === 'end').won, true);
});

test('cards: Boss besiegt mit übrigen Karten → nächster Boss, Ende erst nach der letzten Karte', () => {
  const run = newRun('cards', 8, 10);
  let answers = 0;
  const all = [];
  while (!run.over) {
    all.push(...FBCore.answer(run, answerRight(run)));
    answers++;
  }
  assert.equal(answers, 8);
  assert.ok(all.filter(e => e.type === 'defeat' && e.tier === 'boss').length >= 1);
  assert.equal(all.find(e => e.type === 'end').won, true);
});

test('cards: höchstens 5 Karten → erster Gegner ist Boss', () => {
  assert.equal(newRun('cards', 5, 11).events[0].tier, 'boss');
  assert.notEqual(newRun('cards', 6, 11).events[0].tier, 'boss');
});

test('answer nach Run-Ende tut nichts', () => {
  const run = newRun('fixed', 6, 12);
  run.hp = 1;
  FBCore.answer(run, answerWrong(run));
  assert.equal(run.over, true);
  assert.equal(run.won, false);
  assert.deepEqual(FBCore.answer(run, 0), []);
});

test('kritischer Treffer erhöht Schaden im Run', () => {
  const run = newRun('fixed', 6, 13, 1000);
  const hit = FBCore.answer(run, answerRight(run))[0];
  assert.deepEqual(hit, { type: 'hit', amount: 15, crit: true, streak: 1 });
});

// ── Fortschritt ──

test('startRun: Streak zählt Folgetage, gleicher Tag nicht doppelt', () => {
  let p = FBCore.startRun(FBCore.emptyProgress(), '2026-10-29');
  p = FBCore.startRun(p, '2026-10-29');
  assert.deepEqual([p.totalGames, p.streak.days], [2, 1]);
  p = FBCore.startRun(p, '2026-10-30');
  assert.equal(p.streak.days, 2);
  p = FBCore.startRun(p, '2026-11-02');
  assert.equal(p.streak.days, 1);
});

test('startRun: Streak über Monatswechsel', () => {
  let p = FBCore.startRun(FBCore.emptyProgress(), '2026-10-31');
  p = FBCore.startRun(p, '2026-11-01');
  assert.equal(p.streak.days, 2);
});

test('applyEvents zählt Treffer, Siege, XP und Rekord', () => {
  const p = FBCore.applyEvents(FBCore.emptyProgress(), [
    { type: 'spawn', monsterId: 'irrlicht', tier: 'rare', room: 1 },
    { type: 'hit', amount: 15, crit: true, streak: 3 },
    { type: 'hurt', amount: 20 },
    { type: 'defeat', monsterId: 'irrlicht', tier: 'rare', xp: 25 },
    { type: 'end', won: false, mode: 'endless', roomsCleared: 7, maxStreak: 3 }
  ]);
  assert.equal(p.counters.correct, 1);
  assert.equal(p.counters.crits, 1);
  assert.equal(p.counters.wrong, 1);
  assert.equal(p.counters.maxCombo, 3);
  assert.equal(p.counters.monstersDefeated, 1);
  assert.equal(p.counters['defeat:irrlicht'], 1);
  assert.equal(p.xp, 25);
  assert.equal(p.seen.irrlicht, true);
  assert.equal(p.bestEndless, 7);
  assert.equal(p.runsWon, 0);
});

test('applyEvents: gewonnener Run zählt runsWon, Original bleibt unverändert', () => {
  const before = FBCore.emptyProgress();
  const p = FBCore.applyEvents(before, [{ type: 'end', won: true, mode: 'fixed', roomsCleared: 5, maxStreak: 2 }]);
  assert.equal(p.runsWon, 1);
  assert.equal(p.bestEndless, 0);
  assert.equal(before.runsWon, 0);
});

test('applyEvents verträgt alten, unvollständigen Speicherstand', () => {
  const p = FBCore.applyEvents({ totalGames: 3 }, [{ type: 'hurt', amount: 5 }]);
  assert.equal(p.totalGames, 3);
  assert.equal(p.counters.wrong, 1);
});

// ── Review-Fixes ──

test('startQuestionTimer: Kritisch-Fenster startet erst, wenn die Frage gezeigt wird', () => {
  let t = 0;
  const run = FBCore.createRun({ mode: 'fixed', deck: deckOf(6), monsters: MONSTERS, rng: rng(14), now: () => t });
  t = 1000; FBCore.answer(run, answerRight(run));
  t = 5000; FBCore.startQuestionTimer(run);   // Feedback-Pause vorbei, Frage erscheint
  t = 9500;                                   // 4,5 s nach Erscheinen
  const hit = FBCore.answer(run, answerRight(run))[0];
  assert.equal(hit.crit, true);
});

test('abortRun: Endlos-Rekord bleibt beim Aufgeben erhalten, kein Sieg', () => {
  const run = newRun('endless', 6, 15);
  while (run.room < 4) FBCore.answer(run, answerRight(run));
  const ev = FBCore.abortRun(run);
  assert.deepEqual(ev, [{ type: 'end', won: false, mode: 'endless', roomsCleared: 3, maxStreak: run.maxStreak, aborted: true }]);
  assert.equal(run.over, true);
  const p = FBCore.applyEvents(FBCore.emptyProgress(), ev);
  assert.equal(p.bestEndless, 3);
  assert.equal(p.runsWon, 0);
  assert.deepEqual(FBCore.abortRun(run), []);
});

// ── Lesezeit, Debug-Werte, Review-Minors ──

test('CONFIG: 10 s Lesezeit als Standard', () => {
  assert.equal(FBCore.CONFIG.readMs, 10000);
});

test('applyConfig überschreibt Werte, resetConfig stellt Standard wieder her', () => {
  FBCore.applyConfig({ baseDamage: 50, readMs: 2000, enemy: { boss: { hp: 5 } }, unbekannt: 1, playerHp: 'x' });
  assert.equal(FBCore.CONFIG.baseDamage, 50);
  assert.equal(FBCore.CONFIG.readMs, 2000);
  assert.equal(FBCore.CONFIG.enemy.boss.hp, 5);
  assert.equal(FBCore.CONFIG.enemy.boss.atk, 25);
  assert.equal(FBCore.CONFIG.playerHp, 100);
  assert.equal('unbekannt' in FBCore.CONFIG, false);
  FBCore.applyConfig({ baseDamage: 20 });
  assert.equal(FBCore.CONFIG.readMs, 10000);      // jede Anwendung startet bei den Standardwerten
  FBCore.resetConfig();
  assert.equal(FBCore.CONFIG.baseDamage, 10);
  assert.equal(FBCore.CONFIG.enemy.boss.hp, 80);
});

test('playable: braucht mindestens 2 unterschiedliche Antworten', () => {
  assert.equal(FBCore.playable([{ id: 'a', front: 'A', back: 'Ja' }, { id: 'b', front: 'B', back: ' ja' }]), false);
  assert.equal(FBCore.playable([{ id: 'a', front: 'A', back: 'Ja' }, { id: 'b', front: 'B', back: 'Nein' }]), true);
  assert.equal(FBCore.playable([{ id: 'a', front: 'A', back: 'Ja' }]), false);
});

test('plainText: entfernt nur Markdown-Formatierung, keine Inhaltszeichen', () => {
  assert.equal(FBCore.plainText('snake_case'), 'snake_case');
  assert.equal(FBCore.plainText('3*4=12'), '3*4=12');
  assert.equal(FBCore.plainText('a|b'), 'a|b');
  assert.equal(FBCore.plainText('**horse** und __Pferd__'), 'horse und Pferd');
  assert.equal(FBCore.plainText('*kursiv* und `code`'), 'kursiv und code');
  assert.equal(FBCore.plainText('# Titel\n- eins\n- zwei'), 'Titel\neins\nzwei');
  assert.equal(FBCore.plainText('a  b\n\n\n  c '), 'a b\nc');
  assert.equal(FBCore.plainText('```js\nlet x = 1;\n```'), 'let x = 1;');
  assert.equal(FBCore.plainText('~~alt~~ ==neu=='), 'alt neu');
});

test('buildDeck: Vorderseite wird ebenfalls als Klartext angezeigt', () => {
  const deck = FBCore.buildDeck([{ id: 'a', front: '**Hund**', back: 'dog' }], FBCore.plainText);
  assert.equal(deck[0].front, 'Hund');
});

test('currentStreak: veralteter Streak zählt als 0', () => {
  const p = { streak: { last: '2026-10-27', days: 7 } };
  assert.equal(FBCore.currentStreak(p, '2026-10-28'), 7);
  assert.equal(FBCore.currentStreak(p, '2026-10-27'), 7);
  assert.equal(FBCore.currentStreak(p, '2026-10-29'), 0);
  assert.equal(FBCore.currentStreak({}, '2026-10-29'), 0);
});

test('createRun mit leerer Monster-Liste stürzt nicht ab', () => {
  const run = FBCore.createRun({ mode: 'fixed', deck: deckOf(4), monsters: [], rng: rng(16), now: clock(6000) });
  assert.equal(typeof run.enemy.monsterId, 'string');
});
