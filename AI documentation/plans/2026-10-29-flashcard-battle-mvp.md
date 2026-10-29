# Flashcard Battle MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flashcard Battle von einem `comingSoon`-Platzhalter zu einem spielbaren MVP machen: Kartenset und Spielmodus wählen, mit Multiple-Choice-Fragen aus den eigenen Karteikarten durch einen Dungeon kämpfen, XP/Level/Kompendium/Statistik sammeln, Monster als Cozy-Home-Haustiere freischalten.

**Architecture:** Drei Schichten im Plugin-Ordner `games/flashcard-battle/`. `manifest.js` enthält die Monster-Registry (reine Daten), Statistik-Anzeige und die Cozy-Home-Haustiere und lädt `fb-core.js` vor. `fb-core.js` ist reine Logik ohne DOM und ohne `DB` (Fragen bauen, Schaden, Run-Zustandsmaschine, Fortschritt), unter `window.FBCore`, per Node testbar. `flashcard-battle.js` ist die UI (`mount`/`destroy`), liest Karten über `DB`, schreibt Fortschritt über `DB`.

**Tech Stack:** Vanilla JS mit globalen Scripts (kein Bundler, kein ES-Modul, läuft unter `file://`), CSS, Node 24 nur für die Logik-Tests (`node --test`, `node:vm`).

**Spec:** `AI documentation/flashcard-battle.md` (Version 0.2). Daneben gelten `AI documentation/games.md` und `CLAUDE.md`.

## Global Constraints

- Keine ES-Module, kein `fetch()`, keine `.json`-Dateien. Alles über `<script>`-Tags bzw. dynamisch injizierte Scripts (`CLAUDE.md`).
- `js/games.js` und `index.html` werden **nicht** geändert (Plugin-Architektur). Ausnahme: keine.
- Persistenz nur über `DB.get`/`DB.set`. Fortschritt liegt unter `gameHighscores['flashcard-battle']`, damit `checkUnlock()` in Cozy Home ihn lesen kann.
- Flashcard Battle **liest** `subjects` nur, schreibt niemals Karten, Leitner-Boxen, `fc_session_stats` oder andere Karteikarten-Daten.
- UI-Texte auf Deutsch, Code-Kommentare im Stil der übrigen Spiele (deutsch).
- Spiel-CSS darf eigene Farben haben (Ausnahme `games/<id>/` in `CLAUDE.md`).
- Zahlenwerte aus der Spec: 3 Antwortmöglichkeiten, Combo bis **x5**, falsche Antwort setzt Combo zurück, kritischer Treffer bei Antwort **innerhalb von 5 Sekunden** mit **+50 %** Schaden. Haustier-Schwellen: normal **50**, selten **25**, Boss **10** Siege.
- Alle übrigen Zahlen sind Balancing-Startwerte und stehen gesammelt in `FBCore.CONFIG` (Task 1). Nur dort ändern.
- Deploy nach Abschluss über `scripts/deploy.ps1`, nie `wrangler pages deploy .` direkt.
- Vor Code-Änderungen die Projekt-Skills `nook-architektur-guard` und `nook-konventionen` beachten, am Ende `nook-doku-status`.

## Balancing-Startwerte (`FBCore.CONFIG`)

```js
{
  playerHp: 100,
  baseDamage: 10,
  critWindowMs: 5000,
  critBonus: 1.5,
  comboStep: 0.5,          // Multiplikator = min(1 + 0.5 × (Serie − 1), 5)
  comboMax: 5,
  healBetweenRooms: 20,
  fixedRooms: 5,           // Raum 5 ist der Boss
  endlessBossEvery: 5,     // Endlos: jeder 5. Raum ist ein Boss
  endlessScale: 0.1,       // Endlos: HP und Angriff +10 % pro Raum
  cardModeBossCards: 5,    // Kartenmodus: Boss erscheint, sobald ≤ 5 Karten übrig sind (aktuelle Frage mitgezählt)
  rareChance: 0.15,
  minCards: 2,
  enemy: {
    normal: { hp: 30, atk: 15, xp: 10 },
    rare:   { hp: 40, atk: 20, xp: 25 },
    boss:   { hp: 80, atk: 25, xp: 50 }
  },
  xpPerLevel: 100          // von Level L auf L+1 braucht man 100 × L XP
}
```

## Review Focus

1. **Gleiche Rückseiten**: Zwei Karten mit identischer Antwort dürfen nicht als „falsche“ Option neben der richtigen landen. Optionen werden nach normalisiertem Text dedupliziert (Test in Task 1).
2. **Zu kleine Sets**: Ein Set mit 0 oder 1 verwertbaren Karten ist im Setup nicht wählbar und zeigt einen Hinweis. Ein Set mit 2 Karten spielt mit 2 Optionen (Tests in Task 1 und Task 5).
3. **Doppelte oder leere Karten**: Karten mit gleicher Vorderseite kommen nur einmal ins Deck, Karten mit leerer Vorder- oder Rückseite gar nicht (Test in Task 1).
4. **Doppelklick während der Treffer-Animation**: Solange Feedback läuft, nimmt die UI keine zweite Antwort an. Kein doppelter Schaden (Prüfschritt in Task 6).
5. **Modal mitten im Run schließen**: `destroy()` stoppt alle Timer. Bereits besiegte Monster, XP und Antworten bleiben gespeichert, weil der Fortschritt nach jedem Ereignis geschrieben wird. Der Run zählt nicht als gewonnen (Prüfschritt in Task 6).

---

## Dateistruktur

| Datei | Aktion | Verantwortung |
|---|---|---|
| `games/flashcard-battle/fb-core.js` | neu | reine Spiellogik, `window.FBCore` |
| `games/flashcard-battle/manifest.js` | ändern | Monster-Registry, Stats, Haustiere, lädt `fb-core.js` vor |
| `games/flashcard-battle/flashcard-battle.js` | neu | UI: Setup, Kampf, Ergebnis, Kompendium, Statistik |
| `games/flashcard-battle/flashcard-battle.css` | neu | Spiel-Styles |
| `games/flashcard-battle/assets/monsters/` | neu (leer, `.gitkeep`) | Caseys Monster-Grafiken `<id>.png` |
| `games/cozy-home/pets.js` | ändern | neuer generischer Unlock-Typ `counter` |
| `scripts/tests/fb-core.test.js` | neu | Node-Tests für `fb-core.js` (wird nicht deployt) |
| `AI documentation/flashcard-battle.md`, `README.md` | ändern | Stand nachziehen |

---

### Task 1: Test-Setup und Fragen bauen

**Files:**
- Create: `games/flashcard-battle/fb-core.js`
- Create: `scripts/tests/fb-core.test.js`

**Interfaces:**
- Produces:
  - `FBCore.CONFIG`: Objekt wie oben
  - `FBCore.buildDeck(cards: Card[], toText: (s) => string) => DeckCard[]`. `Card` ist die Karteikarte aus `subjects[].groups[].cards[]` (`{id, front, back, ...}`). `DeckCard = { id, front, back }`, `back` schon durch `toText` in Klartext verwandelt.
  - `FBCore.makeQuestion(card: DeckCard, deck: DeckCard[], rng: () => number) => { cardId, prompt, options: string[], correctIndex }`
  - `FBCore.shuffle(arr, rng) => neues Array`
- Test-Loader: lädt `fb-core.js` per `vm.runInNewContext(code, { window: {} })` und liest `ctx.window.FBCore`. Deterministischer `rng` für Tests: einfacher Seed-Generator (z. B. mulberry32) im Testfile.

- [ ] **Step 1: Failing Tests schreiben** (`scripts/tests/fb-core.test.js`, `node:test` + `node:assert/strict`)

```js
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
  const deck = [1,2,3,4].map(i => ({ id: 'c'+i, front: 'F'+i, back: 'B'+i }));
  const q = FBCore.makeQuestion(deck[0], deck, rng(1));
  assert.equal(q.options.length, 3);
  assert.equal(q.options[q.correctIndex], 'B1');
  assert.equal(new Set(q.options).size, 3);
  assert.equal(q.prompt, 'F1');
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
```

- [ ] **Step 2: Tests laufen lassen, sie müssen scheitern**

Run: `node --test scripts/tests/`
Expected: FAIL, `fb-core.js` fehlt oder `FBCore` ist undefined.

- [ ] **Step 3: `fb-core.js` anlegen**

IIFE, setzt `window.FBCore = { CONFIG, shuffle, buildDeck, makeQuestion }`. Kopfkommentar im Stil der anderen Spiele (Zweck, wird vom Manifest vorgeladen, kein DOM, kein `DB`). Normalisierung für Vergleiche: `trim`, Mehrfach-Leerzeichen zu einem, `toLowerCase` (wie `fcCardKey` in `js/flashcards.js`). `makeQuestion` nimmt bis zu 2 Distraktoren aus den übrigen Deck-Karten, deren normalisierte Rückseite sich von der richtigen und voneinander unterscheidet, zufällig über `rng`.

- [ ] **Step 4: Tests laufen lassen, sie müssen bestehen**

Run: `node --test scripts/tests/`
Expected: PASS, 4 Tests.

- [ ] **Step 5: Commit**

```bash
git add games/flashcard-battle/fb-core.js scripts/tests/fb-core.test.js
git commit -m "Flashcard Battle: Fragen-Logik (Deck, Multiple Choice) mit Node-Tests"
```

---

### Task 2: Kampf-Formeln und Level

**Files:**
- Modify: `games/flashcard-battle/fb-core.js`
- Test: `scripts/tests/fb-core.test.js`

**Interfaces:**
- Produces:
  - `FBCore.comboMultiplier(streak: number) => number`. Ergibt `min(1 + comboStep × (streak − 1), comboMax)`, bei `streak < 1` gilt 1.
  - `FBCore.calcDamage(streak: number, answerMs: number) => { amount: number, crit: boolean }`. `crit = answerMs < critWindowMs`, `amount = Math.round(baseDamage × comboMultiplier(streak) × (crit ? critBonus : 1))`.
  - `FBCore.enemyStats(tier: 'normal'|'rare'|'boss', room: number, mode: 'fixed'|'endless'|'cards') => { hp, atk, xp }`. Skaliert nur in `endless` mit `× (1 + endlessScale × (room − 1))`, gerundet. `xp` wird nicht skaliert.
  - `FBCore.levelFromXp(xp: number) => { level, intoLevel, needed }`

- [ ] **Step 1: Failing Tests schreiben**

```js
test('comboMultiplier steigt um 0.5 und deckelt bei x5', () => {
  assert.equal(FBCore.comboMultiplier(1), 1);
  assert.equal(FBCore.comboMultiplier(2), 1.5);
  assert.equal(FBCore.comboMultiplier(9), 5);
  assert.equal(FBCore.comboMultiplier(30), 5);
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
```

- [ ] **Step 2: Run** `node --test scripts/tests/`. Expected: FAIL bei den 4 neuen Tests.
- [ ] **Step 3: Die vier Funktionen in `fb-core.js` ergänzen** (Signaturen oben, nur Werte aus `CONFIG`).
- [ ] **Step 4: Run** `node --test scripts/tests/`. Expected: PASS, 8 Tests.
- [ ] **Step 5: Commit** mit `"Flashcard Battle: Schaden, Combo, kritische Treffer, Level"`.

---

### Task 3: Run-Zustandsmaschine (drei Spielmodi)

**Files:**
- Modify: `games/flashcard-battle/fb-core.js`
- Test: `scripts/tests/fb-core.test.js`

**Interfaces:**
- Consumes: alles aus Task 1 und 2.
- Produces:
  - `FBCore.createRun({ mode, deck, monsters, rng, now }) => Run`. `monsters` ist `FB_MONSTERS` (Task 4: `{ id, name, tier, emoji, sprite? }[]`), `now()` liefert ms (für Tests injizierbar). Gibt `run` zurück, schon mit erstem Gegner und erster Frage.
  - `Run = { mode, hp, maxHp, room, roomsCleared, enemy: { monsterId, tier, hp, maxHp, atk, xp }, streak, maxStreak, queue: DeckCard[], question, questionStartedAt, over: boolean, won: boolean, events: Event[] }`. `events` enthält die Startereignisse (`spawn` für den ersten Gegner).
  - `FBCore.answer(run, optionIndex: number) => Event[]`. Verändert `run`, berechnet `answerMs = now() − questionStartedAt`, stellt die nächste Frage. Nach `over` wirkungslos (gibt `[]` zurück).
  - `Event` (in dieser Reihenfolge, wenn mehrere):
    - `{ type: 'hit', amount, crit, streak }` oder `{ type: 'hurt', amount }`
    - `{ type: 'defeat', monsterId, tier, xp }`
    - `{ type: 'heal', amount }` (nur `fixed`, nach jedem Sieg außer dem letzten, gedeckelt auf `maxHp`)
    - `{ type: 'retreat', monsterId }` (nur `cards`, wenn der Boss einen Gegner ablöst)
    - `{ type: 'spawn', monsterId, tier, room }`
    - `{ type: 'end', won, mode, roomsCleared, maxStreak }`

Regeln (aus der Spec, hier festgelegt):
- **fixed**: Räume 1 bis `fixedRooms`, der letzte ist Boss. Gewonnen, wenn der Boss besiegt ist.
- **endless**: Raum n ist Boss, wenn `n % endlessBossEvery === 0`. Kein Sieg, Ende bei HP ≤ 0, `won: false`. `roomsCleared` ist der Rekordwert.
- **cards**: Jede Deck-Karte genau einmal (gemischt), keine Wiederholung bei falscher Antwort. „Übrig“ heißt: noch nicht beantwortet, die aktuelle Frage eingeschlossen. Sobald nach einer Antwort nur noch ≤ `cardModeBossCards` Karten übrig sind und der aktuelle Gegner kein Boss ist, kommt der Boss. Lebt der alte Gegner noch, erst `retreat` (zählt nicht als besiegt), dann `spawn`. Wurde er gerade besiegt, direkt `spawn`. Bei höchstens `cardModeBossCards` Karten im Deck ist der erste Gegner direkt der Boss. Ende, wenn keine Karte mehr übrig ist (`won = hp > 0`) oder wenn der Boss besiegt ist (`won = true`, auch wenn noch Karten übrig sind).
- **fixed/endless**: Wenn die Queue leer ist, wird das Deck neu gemischt.
- In allen Modi ist bei HP ≤ 0 Schluss, mit `won: false`.
- Nicht-Boss-Gegner: `rare`, wenn `rng() < rareChance`, sonst `normal`. Das Monster wird zufällig aus `monsters` dieser Stufe gewählt.
- Falsche Antwort: Spieler verliert `enemy.atk`, `streak = 0`.

- [ ] **Step 1: Failing Tests schreiben.** Hilfsfunktionen im Test: `deckOf(n)` baut n Karten, `answerRight(run)` und `answerWrong(run)` wählen über `run.question.correctIndex` die richtige bzw. eine falsche Option. `now` als Zähler-Fake, der pro Aufruf 6000 ms weiterläuft (also nie kritisch), außer ein Test braucht anderes.

```js
test('fixed: 5 Räume, der 5. ist Boss, Sieg nach dem Boss', () => {
  const run = FBCore.createRun({ mode: 'fixed', deck: deckOf(6), monsters: MONSTERS, rng: rng(4), now: slowClock() });
  const spawns = [run.events[0]];
  while (!run.over) spawns.push(...FBCore.answer(run, answerRight(run)).filter(e => e.type === 'spawn'));
  assert.deepEqual(spawns.map(s => s.room), [1, 2, 3, 4, 5]);
  assert.equal(spawns[4].tier, 'boss');
  assert.equal(run.won, true);
});

test('falsche Antwort: Schaden am Spieler und Combo weg', () => {
  const run = FBCore.createRun({ mode: 'fixed', deck: deckOf(6), monsters: MONSTERS, rng: rng(5), now: slowClock() });
  FBCore.answer(run, answerRight(run));
  const ev = FBCore.answer(run, answerWrong(run));
  assert.deepEqual(ev[0], { type: 'hurt', amount: 15 });
  assert.equal(run.hp, 85);
  assert.equal(run.streak, 0);
});

test('Heilung nach Sieg in fixed, gedeckelt auf maxHp', () => { /* hp auf 90 setzen, Gegner besiegen → hp 100, heal-Event amount 10 */ });

test('endless: Raum 5 und 10 sind Boss, Ende nur durch HP 0', () => { /* 10 Räume richtig spielen, Tiers prüfen; dann nur falsch antworten bis over; won === false, roomsCleared === 10 */ });

test('cards: jede Karte höchstens einmal, Boss bei 5 übrigen Karten', () => {
  // 8 Karten, abwechselnd richtig/falsch: nach der 3. Antwort sind 5 übrig → genau ein Boss-spawn,
  // davor genau ein retreat (der erste Gegner lebt noch); keine cardId doppelt; Ende spätestens nach 8 Fragen
});

test('cards: Ende nach der letzten Karte, Sieg bei HP > 0', () => { /* 8 Karten, nur falsch bis auf eine Antwort pro 5 Fragen, Boss überlebt → nach 8 Fragen end.won === (run.hp > 0); dafür im Test enemy.atk des Bosses auf 5 setzen, damit HP > 0 bleibt */ });

test('cards: Boss besiegt beendet den Run vorzeitig mit Sieg', () => { /* 8 Karten, Boss-HP im Test auf 1 setzen, sobald er erscheint → nächste richtige Antwort: defeat + end.won === true, obwohl Karten übrig */ });

test('cards: höchstens 5 Karten → erster Gegner ist Boss', () => { /* deckOf(5) → run.events[0].tier === 'boss' */ });

test('answer nach Run-Ende tut nichts', () => { /* nach over: FBCore.answer(run, 0) → [] */ });

test('kritischer Treffer erhöht Schaden im Run', () => { /* now liefert 1000 ms Abstand → hit.crit === true, amount 15 */ });
```

Die mit `/* … */` skizzierten Tests schreibt die ausführende Person vollständig aus, die Kommentare legen die Assertions fest.

- [ ] **Step 2: Run** `node --test scripts/tests/`. Expected: FAIL bei den neuen Tests.
- [ ] **Step 3: `createRun` und `answer` in `fb-core.js` ergänzen**, dazu die interne Hilfsfunktion `spawnNext(run, rng)`.
- [ ] **Step 4: Run** `node --test scripts/tests/`. Expected: alle Tests PASS.
- [ ] **Step 5: Commit** mit `"Flashcard Battle: Run-Logik für Feste Räume, Endlos und Kartenmodus"`.

---

### Task 4: Fortschritt, Manifest und Monster-Registry

**Files:**
- Modify: `games/flashcard-battle/fb-core.js`
- Modify: `games/flashcard-battle/manifest.js`
- Create: `games/flashcard-battle/assets/monsters/.gitkeep`
- Test: `scripts/tests/fb-core.test.js`

**Interfaces:**
- Consumes: `Event` aus Task 3, `levelFromXp` aus Task 2.
- Produces:
  - `FBCore.emptyProgress() => Progress`
  - `Progress = { totalGames, runsWon, bestEndless, xp, counters: { correct, wrong, crits, maxCombo, monstersDefeated, ['defeat:<monsterId>']: n }, seen: { [monsterId]: true }, streak: { last: 'YYYY-MM-DD' | null, days } }`
  - `FBCore.startRun(progress, today: 'YYYY-MM-DD') => Progress`: `totalGames + 1`, Lern-Streak: gleicher Tag bleibt, Vortag gibt `days + 1`, sonst `days = 1`.
  - `FBCore.applyEvents(progress, events: Event[]) => Progress`: `hit` zählt `correct`, bei `crit` auch `crits`, `maxCombo = max(…, streak)`; `hurt` zählt `wrong`; `defeat` addiert `xp`, `monstersDefeated` und `counters['defeat:'+id]`; `spawn` setzt `seen[id] = true`; `end` mit `won` zählt `runsWon`, im Endlosmodus `bestEndless = max(…, roomsCleared)`.
  - Beide Funktionen sind rein (neues Objekt, fehlende Felder aus `emptyProgress` ergänzen, damit alte Speicherstände nicht brechen).
  - `window.FB_MONSTERS` in `manifest.js`: `{ id, name, tier, emoji, sprite?, pet? }[]`. Platzhalter-Startbesetzung, Casey ersetzt Namen und Grafiken später:
    - normal: `schleimling` „Schleimling“ 🟢, `fledermaus` „Flatterfrage“ 🦇, `ratte` „Bücherratte“ 🐀
    - rare: `irrlicht` „Irrlicht“ 👻
    - boss: `wissensboss` „Der Wissens-Boss“ 🐉
  - `sprite` (optional): `games/flashcard-battle/assets/monsters/<id>.png`. Die UI zeigt das Bild, ohne Bild das Emoji.
  - `pet` (optional, nur wenn Casey Haustier-Grafiken unter `games/flashcard-battle/assets/pets/<id>/` mit `default.png`, `icon.png`, `sleep.png` angelegt hat): Felder wie bei Snake (`name`, `species`, `description`, `favoriteFood`, … `thoughts`). Im MVP hat noch kein Monster ein `pet`.
  - Manifest-Feld `pets`: `FB_MONSTERS.filter(m => m.pet).map(m => ({ ...m.pet, id: 'fb-' + m.id, sourceGame: 'flashcard-battle', shopPrice: 200, assets: { basePath: 'games/flashcard-battle/assets/pets/' + m.id + '/' }, unlock: { type: 'counter', target: 'flashcard-battle', counter: 'defeat:' + m.id, value: PET_WINS[m.tier], description: 'Besiege ' + m.name + ' ' + PET_WINS[m.tier] + '× in Flashcard Battle' } }))` mit `PET_WINS = { normal: 50, rare: 25, boss: 10 }`.

- [ ] **Step 1: Failing Tests für `startRun` und `applyEvents` schreiben**

```js
test('startRun: Streak zählt Folgetage, gleicher Tag nicht doppelt', () => {
  let p = FBCore.startRun(FBCore.emptyProgress(), '2026-10-29');
  p = FBCore.startRun(p, '2026-10-29');
  assert.deepEqual([p.totalGames, p.streak.days], [2, 1]);
  p = FBCore.startRun(p, '2026-10-30');
  assert.equal(p.streak.days, 2);
  p = FBCore.startRun(p, '2026-11-02');
  assert.equal(p.streak.days, 1);
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
  assert.equal(p.counters['defeat:irrlicht'], 1);
  assert.equal(p.xp, 25);
  assert.equal(p.seen.irrlicht, true);
  assert.equal(p.bestEndless, 7);
  assert.equal(p.runsWon, 0);
});

test('applyEvents verträgt alten, unvollständigen Speicherstand', () => {
  const p = FBCore.applyEvents({ totalGames: 3 }, [{ type: 'hurt', amount: 5 }]);
  assert.equal(p.totalGames, 3);
  assert.equal(p.counters.wrong, 1);
});
```

- [ ] **Step 2: Run** `node --test scripts/tests/`. Expected: FAIL.
- [ ] **Step 3: `emptyProgress`, `startRun` und `applyEvents` in `fb-core.js` ergänzen.**
- [ ] **Step 4: Run** `node --test scripts/tests/`. Expected: PASS.
- [ ] **Step 5: `manifest.js` umbauen.** `comingSoon` bleibt bis Task 7 drin. Das Manifest lädt `fb-core.js` per injiziertem `<script>` vor, nach dem Muster in `games/cozy-home/manifest.js`. Es definiert `window.FB_MONSTERS` und `pets` wie oben. `getStats()` gibt `[{ label: 'Level', value }, { label: 'Siege', value: runsWon }, { label: 'Endlos-Rekord', value: bestEndless + ' Räume' }, { label: 'Besiegte Monster', … }, { label: 'Höchste Combo', … }, { label: 'Kritische Treffer', … }, { label: 'Lern-Streak', value: days + ' Tage' }]` zurück. Es liest `DB.get('gameHighscores', {})['flashcard-battle']`, Level nur über `window.FBCore?.levelFromXp`, sonst `'—'`. `resetStats()` löscht `gameHighscores['flashcard-battle']`, wie bei Memory.
- [ ] **Step 6: Prüfen.** `preview_start` mit `nook-static`, Spiele-Tab öffnen. Die Karte zeigt weiter „Bald verfügbar“, die Konsole ist fehlerfrei, `window.FBCore` und `window.FB_MONSTERS` sind definiert.
- [ ] **Step 7: Commit** mit `"Flashcard Battle: Fortschritt, Monster-Registry und Statistik im Manifest"`.

---

### Task 5: Cozy Home: Unlock-Typ `counter`

**Files:**
- Modify: `games/cozy-home/pets.js:190-215` (`checkUnlock`)

**Interfaces:**
- Produces: `checkUnlock({ type: 'counter', target, counter, value })` gibt `true`, wenn `(DB.get('gameHighscores', {})[target]?.counters?.[counter] ?? 0) >= value`. Bleibt generisch, kein Spielname im Code.

- [ ] **Step 1: Neuen `case "counter"` ergänzen**, mit einer Kommentarzeile im Stil der vorhandenen Cases (z. B. „Zählerstand, den ein Spiel unter gameHighscores[target].counters führt“).
- [ ] **Step 2: Im Browser prüfen.** In der Konsole: `DB.set('gameHighscores', {...DB.get('gameHighscores', {}), 'fb-test': { counters: { x: 3 } }})`, dann `checkUnlock({type:'counter', target:'fb-test', counter:'x', value:3})` ergibt `true`, mit `value:4` ergibt es `false`. Den Testeintrag `fb-test` danach wieder entfernen. Cozy Home öffnen: Shop lädt wie vorher, keine Warnung „unbekannter Typ“.
- [ ] **Step 3: Commit** mit `"Cozy Home: generischer Unlock-Typ counter für spielübergreifende Haustiere"`.

---

### Task 6: Spiel-UI: Setup, Kampf, Ergebnis

**Files:**
- Create: `games/flashcard-battle/flashcard-battle.js`
- Create: `games/flashcard-battle/flashcard-battle.css`

**Interfaces:**
- Consumes: `FBCore.*` (Tasks 1 bis 4), `window.FB_MONSTERS`, globale `subjects`-Daten über `DB.get('subjects', [])`, `isSubjectArchived` und `fcPlainPreview` aus `js/flashcards.js` (mit `typeof`-Prüfung, Fallback: nicht archiviert bzw. `String(s)`).
- Produces: `Object.assign(window.GameHub.registry['flashcard-battle'], { mount(container), destroy() })` nach dem Muster in `games/memory/memory.js`.

Bildschirme (alle innerhalb des Containers, CSS-Präfix `fb-`):

1. **Setup**
   - Kartenset wählen, gruppiert: pro nicht archiviertem Fach ein Eintrag „ganzes Fach“ plus je ein Eintrag pro Thema (Gruppe), jeweils mit Kartenzahl nach `buildDeck`.
   - Sets mit weniger als `CONFIG.minCards` Karten sind deaktiviert, mit dem Hinweis „Mindestens 2 Karten nötig“.
   - Gibt es gar keine Fächer: Hinweis „Lege zuerst im Karteikarten-Tab Karten an.“
   - Spielmodus wählen (3 Kacheln): „Feste Räume“, „Endlos“, „Nach Kartenanzahl“, je mit einer Zeile Erklärung aus der Spec-Tabelle.
   - Knopf „Kampf starten“, deaktiviert ohne gültige Auswahl.
   - Daneben Level und XP-Balken (`levelFromXp`) sowie Knöpfe „Kompendium“ und „Statistik“ (Task 7).
2. **Kampf**
   - Oben Spieler-HP-Balken, Gegner mit Name, Bild/Emoji, HP-Balken, Raum („Raum 3/5“ bzw. „Raum 7“ bzw. „noch 12 Karten“), Combo-Anzeige („Combo x2.5“).
   - Frage (`prompt`), darunter die Antwort-Knöpfe, Tasten 1 bis 3 wählen ebenfalls.
   - Ein sichtbarer 5-Sekunden-Balken zeigt das Fenster für den kritischen Treffer.
   - Nach einer Antwort: richtige Option grün und, falls falsch gewählt, gewählte Option rot; Schadenszahl am Ziel, bei Kritisch „Kritisch!“. Etwa 800 ms Feedback, in dieser Zeit sind alle Eingaben gesperrt, danach die nächste Frage.
   - Kommt ein Boss, gibt es einen kurzen Hinweis „Ein Boss erscheint!“.
3. **Ergebnis**
   - „Gewonnen!“ oder „Besiegt“ (Endlos: „Raum X erreicht“), dazu gewonnene XP in diesem Run, besiegte Monster, höchste Combo, Level-Aufstieg falls passiert.
   - Knöpfe „Nochmal“ (gleiches Set, gleicher Modus) und „Zurück“.

Speichern: beim Start `startRun`, nach jedem `answer` sofort `applyEvents` auf `gameHighscores['flashcard-battle']` schreiben (siehe Review Focus 5). `rng = Math.random`, `now = () => performance.now()`, `today` als lokales `YYYY-MM-DD`.

`destroy()`: Feedback-Timeout und Krit-Balken-Animation stoppen, Keydown-Listener entfernen, Zustand leeren.

CSS: `modalSize: "large"` ist gesetzt. Das Layout muss auch auf schmalen Viewports funktionieren (Antwort-Knöpfe untereinander, unter 480 px Breite volle Breite). Lange Antworten werden umgebrochen, nie abgeschnitten.

- [ ] **Step 1: `flashcard-battle.js` mit Setup-Bildschirm und `mount`/`destroy` schreiben, CSS für Setup.**
- [ ] **Step 2: Im Browser prüfen.** `comingSoon` in `manifest.js` dafür vorübergehend auskommentieren (endgültig in Task 7). Testdaten im Karteikarten-Tab: ein Fach mit 6 Karten, ein Thema mit 1 Karte. Erwartet: das Thema mit 1 Karte ist deaktiviert und zeigt den Hinweis, „Kampf starten“ bleibt ohne Auswahl aus.
- [ ] **Step 3: Kampf- und Ergebnisbildschirm schreiben, CSS dazu.**
- [ ] **Step 4: Im Browser prüfen, für jeden der drei Modi einen Run**:
  - Feste Räume: 5 Räume, Boss in Raum 5, Heilung sichtbar, Ergebnis „Gewonnen!“.
  - Endlos: Boss in Raum 5, absichtlich verlieren, Ergebnis zeigt den erreichten Raum.
  - Kartenmodus mit 6 Karten: nach der ersten Antwort sind 5 übrig, also kommt der Boss; nach 6 Fragen ist der Run zu Ende.
  - Ein Set mit 2 Karten zeigt 2 Optionen.
  - Schnell doppelt klicken: nur ein Treffer (Review Focus 4).
  - Mitten im Run das Modal schließen und wieder öffnen: keine Konsolenfehler, kein weiterlaufender Timer, besiegte Monster stehen in `DB.get('gameHighscores')['flashcard-battle'].counters` (Review Focus 5).
  - Tasten 1 bis 3 funktionieren.
  - Ansicht in `resize_window` mobile prüfen.
  - Karteikarten-Tab: Leitner-Boxen und „Heute schon gelernt“ unverändert.
- [ ] **Step 5: Commit** mit `"Flashcard Battle: spielbare UI (Setup, Kampf, Ergebnis)"`.

---

### Task 7: Kompendium, Statistik, Freigabe und Doku

**Files:**
- Modify: `games/flashcard-battle/flashcard-battle.js`
- Modify: `games/flashcard-battle/flashcard-battle.css`
- Modify: `games/flashcard-battle/manifest.js` (`comingSoon` entfernen)
- Modify: `AI documentation/flashcard-battle.md`, `README.md:249`

**Interfaces:**
- Consumes: `Progress` aus Task 4, `FB_MONSTERS`, `PET_WINS` (im Manifest als `window.FB_PET_WINS` exportieren, damit die UI dieselben Zahlen zeigt).

- [ ] **Step 1: Kompendium-Bildschirm.** Raster aller `FB_MONSTERS`. Unbekannt (`!seen[id]`): Silhouette/„???“. Gesehen: Bild/Emoji, Name, Stufe (normal/selten/Boss), „Besiegt: n×“. Hat das Monster ein `pet`, zusätzlich der Fortschritt „Haustier: n/50“ (bzw. 25/10). Ohne `pet` gibt es keine Haustier-Zeile.
- [ ] **Step 2: Statistik-Bildschirm.** Gewonnene Kämpfe, besiegte Monster, richtige und falsche Antworten, höchste Combo, kritische Treffer, gesammelte XP, Level, Endlos-Rekord, Lern-Streak.
- [ ] **Step 3: `comingSoon: true` aus `manifest.js` entfernen**, den Platzhalter-Kopfkommentar durch einen normalen ersetzen (wie Memory: „Lädt sofort beim Start …“).
- [ ] **Step 4: Im Browser prüfen.** Die Spielkarte zeigt „Spielen“ und die ersten zwei Stats (Level, Siege). Nach einem Run zeigt das Kompendium die getroffenen Monster. Der Stats-Dialog im Hub zeigt alle Werte, „Zurücksetzen“ leert sie. Der Node-Testlauf `node --test scripts/tests/` ist weiter grün.
- [ ] **Step 5: Doku nachziehen.** In `flashcard-battle.md`: Version 1.0, Abschnitt „Balancing-Startwerte“ mit den Zahlen aus `CONFIG` und dem Hinweis, dass sie dort gepflegt werden; neuer Abschnitt „Technik“ (Dateien, `FBCore`, Speicher-Key, Unlock-Typ `counter`, wie Casey Monster und Haustier-Grafiken ergänzt); im MVP nur Multiple Choice, Ankreuzaufgaben später. In `README.md` Flashcard Battle aus der Platzhalter-Zeile nehmen und kurz unter den fertigen Spielen eintragen.
- [ ] **Step 6: Commit** mit `"Flashcard Battle: Kompendium, Statistik, Spiel freigeschaltet"`.
- [ ] **Step 7: Deploy** über `scripts/deploy.ps1` und den Projekt-Skill `nook-doku-status` ausführen.
