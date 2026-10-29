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
  };

  // Vergleichsschlüssel wie fcCardKey im Karteikarten-Tab
  function norm(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }

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
      const front = String(c.front || '').trim();
      const back = String(toText(c.back || '')).trim();
      const key = norm(front);
      if (!front || !back || seen.has(key)) return;
      seen.add(key);
      deck.push({ id: c.id, front, back });
    });
    return deck;
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

  window.FBCore = {
    CONFIG, shuffle, buildDeck, makeQuestion,
    comboMultiplier, calcDamage, enemyStats, levelFromXp
  };

})();
