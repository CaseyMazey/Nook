// =========================
// SPIEL-KERN: FLASHCARD BATTLE
// Reine Spiellogik – kein DOM, kein DB. Wird von manifest.js vorgeladen,
// damit Manifest (Stats) und flashcard-battle.js (UI) dieselben Regeln nutzen.
// Getestet mit: node --test "scripts/tests/*.test.js"
// Alle Balancing-Werte stehen gesammelt in CONFIG – nur dort ändern.
// =========================

(function () {

  const CONFIG = {
    playerHp: 100,
    baseDamage: 10,
    readMs: 10000,           // Lesezeit für die Frage, bevor die Antworten erscheinen (vorher per Klick überspringbar)
    critWindowMs: 5000,      // zählt erst ab Erscheinen der Antworten
    critBonus: 1.5,
    comboStep: 0.5,          // Multiplikator = min(1 + 0.5 × (Serie − 1), 5)
    comboMax: 5,
    healBetweenRooms: 40,    // Feste Räume: Heilung nach jedem Raum (nach dem Miniboss)
    fixedRooms: 5,           // danach kommt der große Boss
    monstersPerRoom: 5,      // der letzte Gegner eines Raums ist der Miniboss
    endlessBossEvery: 5,     // Endlos: jeder 5. Raum ist ein Boss
    endlessScale: 0.1,       // Endlos: HP und Angriff +10 % pro Raum
    cardModeBossCards: 5,    // Kartenmodus: Boss erscheint, sobald ≤ 5 Karten übrig sind (aktuelle Frage mitgezählt)
    rareChance: 0.15,
    minCards: 2,
    enemy: {
      normal: { hp: 30, atk: 15, xp: 10 },
      rare:   { hp: 40, atk: 20, xp: 25 },
      miniboss: { hp: 50, atk: 20, xp: 35 },
      boss:   { hp: 80, atk: 25, xp: 50 }
    },
    xpPerLevel: 100          // von Level L auf L+1 braucht man 100 × L XP
  };

  // ── Debug-/Test-Werte ──
  // CONFIG bleibt dasselbe Objekt; applyConfig() setzt erst alles auf die
  // Standardwerte zurück und übernimmt dann nur bekannte Zahlen-Felder.
  const DEFAULTS = JSON.parse(JSON.stringify(CONFIG));

  function resetConfig() {
    Object.keys(DEFAULTS).forEach(k => {
      if (k === 'enemy') Object.keys(DEFAULTS.enemy).forEach(t => Object.assign(CONFIG.enemy[t], DEFAULTS.enemy[t]));
      else CONFIG[k] = DEFAULTS[k];
    });
  }

  function applyConfig(overrides) {
    resetConfig();
    const o = overrides || {};
    const num = v => typeof v === 'number' && isFinite(v);
    Object.keys(DEFAULTS).forEach(k => {
      if (k === 'enemy') {
        Object.keys(DEFAULTS.enemy).forEach(t => Object.keys(DEFAULTS.enemy[t]).forEach(s => {
          const v = o.enemy?.[t]?.[s];
          if (num(v)) CONFIG.enemy[t][s] = v;
        }));
      } else if (num(o[k])) {
        CONFIG[k] = o[k];
      }
    });
  }

  // Vergleichsschlüssel wie fcCardKey im Karteikarten-Tab
  function norm(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }

  // Markdown → Klartext: nur Formatierung entfernen (Paare wie **x**, `x`,
  // Überschriften-/Listenzeichen), Inhaltszeichen wie _ * | bleiben stehen.
  function plainText(md) {
    return String(md || '')
      .replace(/(```|~~~)[\w+#.-]*\n?/g, '')
      .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/==(.+?)==/g, '$1')
      .replace(/`([^`\n]+)`/g, '$1')
      .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1$2')
      .replace(/(^|[^\w])_(?!\s)([^_\n]+?)_(?!\w)/g, '$1$2')
      .replace(/[ \t]+/g, ' ')                  // Zeilenumbrüche bleiben (Listen in Antworten)
      .split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Karteikarten → Deck: leere Karten raus, gleiche Vorderseite nur einmal
  function buildDeck(cards, toText) {
    const seen = new Set();
    const deck = [];
    (cards || []).forEach(c => {
      const front = String(toText(c.front || '')).trim();
      const back = String(toText(c.back || '')).trim();
      const key = norm(c.front);
      if (!front || !back || seen.has(key)) return;
      seen.add(key);
      deck.push({ id: c.id, front, back });
    });
    return deck;
  }

  // Spielbar, wenn es genug unterschiedliche Antworten für Multiple Choice gibt
  function playable(deck) {
    return new Set((deck || []).map(c => norm(c.back))).size >= CONFIG.minCards;
  }

  // Multiple Choice: richtige Rückseite + bis zu 2 Distraktoren mit anderem Text
  function makeQuestion(card, deck, rng) {
    const used = new Set([norm(card.back)]);
    const distractors = [];
    shuffle(deck.filter(c => c.id !== card.id), rng).forEach(c => {
      if (distractors.length >= 2 || used.has(norm(c.back))) return;
      used.add(norm(c.back));
      distractors.push(c.back);
    });
    const options = shuffle([card.back, ...distractors], rng);
    return { cardId: card.id, prompt: card.front, options, correctIndex: options.indexOf(card.back) };
  }

  // ── Kampf-Formeln ──

  function comboMultiplier(streak) {
    if (streak < 1) return 1;
    return Math.min(1 + CONFIG.comboStep * (streak - 1), CONFIG.comboMax);
  }

  // Kritisch, wenn innerhalb des Zeitfensters richtig geantwortet wurde
  function calcDamage(streak, answerMs) {
    const crit = answerMs < CONFIG.critWindowMs;
    const amount = Math.round(CONFIG.baseDamage * comboMultiplier(streak) * (crit ? CONFIG.critBonus : 1));
    return { amount, crit };
  }

  // Nur im Endlosmodus werden HP und Angriff pro Raum stärker, XP bleibt gleich
  function enemyStats(tier, room, mode) {
    const base = CONFIG.enemy[tier];
    const scale = mode === 'endless' ? 1 + CONFIG.endlessScale * (room - 1) : 1;
    return { hp: Math.round(base.hp * scale), atk: Math.round(base.atk * scale), xp: base.xp };
  }

  function levelFromXp(xp) {
    let level = 1;
    let rest = Math.max(0, xp || 0);
    while (rest >= CONFIG.xpPerLevel * level) {
      rest -= CONFIG.xpPerLevel * level;
      level++;
    }
    return { level, intoLevel: rest, needed: CONFIG.xpPerLevel * level };
  }

  // ── Run (ein Dungeon-Durchlauf) ──
  // Modi: 'fixed' (feste Räume), 'endless', 'cards' (jede Karte einmal).
  // answer() liefert Ereignisse, aus denen UI und Fortschritt lesen.
  // fixed: run.room = Raum (1–fixedRooms, danach Endboss), run.fight = Gegner im Raum.
  // endless/cards: run.room zählt jeden Gegner.

  function isBossNext(run) {
    const nextRoom = run.room + 1;
    if (run.mode === 'endless') return nextRoom % CONFIG.endlessBossEvery === 0;
    return run.unanswered <= CONFIG.cardModeBossCards;
  }

  function randomTier(run) { return run._rng() < CONFIG.rareChance ? 'rare' : 'normal'; }

  // Feste Räume: weiterzählen und Stufe bestimmen (Miniboss am Raumende, Endboss nach dem letzten Raum)
  function advanceFixed(run) {
    if (run.room === 0) { run.room = 1; run.fight = 1; }
    else if (run.fight < CONFIG.monstersPerRoom) run.fight++;
    else { run.room++; run.fight = 1; }
    if (run.room > CONFIG.fixedRooms) return 'boss';
    return run.fight >= CONFIG.monstersPerRoom ? 'miniboss' : randomTier(run);
  }

  function pickMonster(run, tier) {
    const pool = run._monsters.filter(m => m.tier === tier);
    const list = pool.length ? pool : run._monsters;
    if (!list.length) return { id: 'unbekannt', name: 'Unbekanntes Monster', tier, emoji: '❔' };
    return list[Math.floor(run._rng() * list.length)];
  }

  function spawnNext(run, ev) {
    let tier;
    if (run.mode === 'fixed') tier = advanceFixed(run);
    else { tier = isBossNext(run) ? 'boss' : randomTier(run); run.room++; }
    const monster = pickMonster(run, tier);
    const stats = enemyStats(tier, run.room, run.mode);
    run.enemy = { monsterId: monster.id, tier, hp: stats.hp, maxHp: stats.hp, atk: stats.atk, xp: stats.xp };
    const spawn = { type: 'spawn', monsterId: monster.id, tier, room: run.room };
    if (run.mode === 'fixed') spawn.fight = run.fight;
    ev.push(spawn);
  }

  function nextQuestion(run) {
    if (!run.queue.length) run.queue = shuffle(run.deck, run._rng);
    const card = run.queue.shift();
    run.question = makeQuestion(card, run.deck, run._rng);
    run.questionStartedAt = run._now();
  }

  function endRun(run, won, ev, aborted) {
    run.over = true;
    run.won = won;
    run.question = null;
    const end = { type: 'end', won, mode: run.mode, roomsCleared: run.roomsCleared, maxStreak: run.maxStreak };
    if (aborted) end.aborted = true;
    ev.push(end);
  }

  // Die UI ruft das auf, sobald die Frage wirklich sichtbar ist (nach der
  // Feedback-Pause), damit das 5-Sekunden-Fenster nicht schon vorher läuft.
  function startQuestionTimer(run) {
    if (!run.over) run.questionStartedAt = run._now();
  }

  // Aufgeben / Fenster schließen: kein Sieg, aber der Endlos-Rekord zählt
  function abortRun(run) {
    if (run.over) return [];
    const ev = [];
    endRun(run, false, ev, true);
    run.events.push(...ev);
    return ev;
  }

  function createRun({ mode, deck, monsters, rng = Math.random, now = () => Date.now() }) {
    const run = {
      mode, hp: CONFIG.playerHp, maxHp: CONFIG.playerHp, room: 0, fight: 0, roomsCleared: 0,
      enemy: null, streak: 0, maxStreak: 0,
      deck, queue: shuffle(deck, rng), unanswered: deck.length,
      question: null, questionStartedAt: 0, over: false, won: false, events: [],
      _rng: rng, _now: now, _monsters: monsters
    };
    spawnNext(run, run.events);
    nextQuestion(run);
    return run;
  }

  function answer(run, optionIndex) {
    if (run.over) return [];
    const ev = [];
    const answerMs = run._now() - run.questionStartedAt;
    if (run.mode === 'cards') run.unanswered--;

    if (optionIndex === run.question.correctIndex) {
      run.streak++;
      run.maxStreak = Math.max(run.maxStreak, run.streak);
      const dmg = calcDamage(run.streak, answerMs);
      run.enemy.hp = Math.max(0, run.enemy.hp - dmg.amount);
      ev.push({ type: 'hit', amount: dmg.amount, crit: dmg.crit, streak: run.streak });

      if (run.enemy.hp === 0) {
        const e = run.enemy;
        ev.push({ type: 'defeat', monsterId: e.monsterId, tier: e.tier, xp: e.xp });
        // Feste Räume zählen geschaffte Räume (Miniboss), die anderen Modi jeden Gegner
        if (run.mode !== 'fixed' || e.tier === 'miniboss') run.roomsCleared++;
        run.enemy = null;
        // Kartenmodus: Boss besiegt, aber noch Karten übrig → nächster Boss (jede Karte kommt dran)
        if (e.tier === 'boss' && run.mode === 'fixed') { endRun(run, true, ev); }
        else if (run.mode === 'cards' && run.unanswered === 0) { endRun(run, true, ev); }
        else {
          if (run.mode === 'fixed' && e.tier === 'miniboss') {
            const heal = Math.min(CONFIG.healBetweenRooms, run.maxHp - run.hp);
            if (heal > 0) { run.hp += heal; ev.push({ type: 'heal', amount: heal }); }
          }
          spawnNext(run, ev);
        }
      }
    } else {
      run.streak = 0;
      run.hp = Math.max(0, run.hp - run.enemy.atk);
      ev.push({ type: 'hurt', amount: run.enemy.atk });
      if (run.hp === 0) endRun(run, false, ev);
    }

    if (!run.over && run.mode === 'cards') {
      if (run.unanswered === 0) endRun(run, run.hp > 0, ev);
      else if (run.enemy.tier !== 'boss' && run.unanswered <= CONFIG.cardModeBossCards) {
        // Der Boss löst den aktuellen Gegner ab – zählt nicht als besiegt
        ev.push({ type: 'retreat', monsterId: run.enemy.monsterId });
        spawnNext(run, ev);
      }
    }

    if (!run.over) nextQuestion(run);
    run.events.push(...ev);
    return ev;
  }

  // ── Fortschritt (liegt unter gameHighscores['flashcard-battle']) ──
  // Rein: gibt immer ein neues Objekt zurück und ergänzt fehlende Felder,
  // damit ältere Speicherstände nicht brechen.

  function emptyProgress() {
    return {
      totalGames: 0, runsWon: 0, bestEndless: 0, xp: 0,
      counters: { correct: 0, wrong: 0, crits: 0, maxCombo: 0, monstersDefeated: 0 },
      seen: {},
      streak: { last: null, days: 0 }
    };
  }

  function normalizeProgress(p) {
    const base = emptyProgress();
    const src = p || {};
    return {
      ...base, ...src,
      counters: { ...base.counters, ...(src.counters || {}) },
      seen: { ...(src.seen || {}) },
      streak: { ...base.streak, ...(src.streak || {}) }
    };
  }

  // 'YYYY-MM-DD' → Tagesnummer (UTC, nur zum Vergleichen aufeinanderfolgender Tage)
  function dayNumber(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  }

  function startRun(progress, today) {
    const p = normalizeProgress(progress);
    p.totalGames++;
    const last = p.streak.last;
    if (last !== today) {
      const consecutive = last && dayNumber(today) - dayNumber(last) === 1;
      p.streak = { last: today, days: consecutive ? p.streak.days + 1 : 1 };
    }
    return p;
  }

  // Anzeige: ein Streak gilt nur, wenn zuletzt heute oder gestern gespielt wurde
  function currentStreak(progress, today) {
    const s = progress?.streak;
    if (!s || !s.last) return 0;
    return dayNumber(today) - dayNumber(s.last) <= 1 ? s.days : 0;
  }

  function applyEvents(progress, events) {
    const p = normalizeProgress(progress);
    const c = p.counters;
    (events || []).forEach(e => {
      if (e.type === 'hit') {
        c.correct++;
        if (e.crit) c.crits++;
        c.maxCombo = Math.max(c.maxCombo, e.streak);
      } else if (e.type === 'hurt') {
        c.wrong++;
      } else if (e.type === 'defeat') {
        p.xp += e.xp;
        c.monstersDefeated++;
        c['defeat:' + e.monsterId] = (c['defeat:' + e.monsterId] || 0) + 1;
      } else if (e.type === 'spawn') {
        p.seen[e.monsterId] = true;
      } else if (e.type === 'end') {
        if (e.won) p.runsWon++;
        if (e.mode === 'endless') p.bestEndless = Math.max(p.bestEndless, e.roomsCleared);
      }
    });
    return p;
  }

  window.FBCore = {
    CONFIG, DEFAULTS, applyConfig, resetConfig,
    shuffle, plainText, buildDeck, playable, makeQuestion,
    comboMultiplier, calcDamage, enemyStats, levelFromXp,
    createRun, answer, startQuestionTimer, abortRun,
    emptyProgress, startRun, applyEvents, currentStreak
  };

})();
