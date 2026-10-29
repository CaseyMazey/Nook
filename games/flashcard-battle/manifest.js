// =========================
// MANIFEST: FLASHCARD BATTLE
// Lädt sofort beim Start (für die Library-Karte).
// Die eigentliche Spiel-UI (flashcard-battle.js) lädt erst beim Klick auf "Spielen".
// Lädt fb-core.js (reine Spiellogik) vorab, damit getStats() und
// flashcard-battle.js dieselben Regeln nutzen.
// Konzept: AI documentation/flashcard-battle.md
// =========================

(function () {
  if (!document.querySelector('script[src="games/flashcard-battle/fb-core.js"]')) {
    const s = document.createElement('script');
    s.src = 'games/flashcard-battle/fb-core.js';
    document.head.appendChild(s);
  }
})();

// ────────────────────────────────────
// MONSTER-REGISTRY (reine Daten)
//
// tier:   "normal" | "rare" | "boss"
// emoji:  Platzhalter, solange es keine Grafik gibt
// sprite: optional, Pfad zur Monster-Grafik
//         (games/flashcard-battle/assets/monsters/<id>.png)
// pet:    optional, Cozy-Home-Haustier-Felder wie in games/snake/manifest.js
//         (name, species, description, favoriteFood, … thoughts). Nur
//         eintragen, wenn unter games/flashcard-battle/assets/pets/<id>/
//         default.png, icon.png und sleep.png liegen.
// ────────────────────────────────────
window.FB_MONSTERS = [
  { id: 'schleimling',  name: 'Schleimling',      tier: 'normal', emoji: '🟢' },
  { id: 'fledermaus',   name: 'Flatterfrage',     tier: 'normal', emoji: '🦇' },
  { id: 'ratte',        name: 'Bücherratte',      tier: 'normal', emoji: '🐀' },
  { id: 'irrlicht',     name: 'Irrlicht',         tier: 'rare',   emoji: '👻' },
  { id: 'wissensboss',  name: 'Der Wissens-Boss', tier: 'boss',   emoji: '🐉' }
];

// Siege gegen ein Monster, bis es als Haustier freigeschaltet ist
window.FB_PET_WINS = { normal: 50, rare: 25, boss: 10 };

function readFlashcardBattleProgress() {
  return DB.get('gameHighscores', {})['flashcard-battle'] || {};
}

window.registerGame({
  id: 'flashcard-battle',
  title: 'Flashcard Battle',
  modalSize: "large",
  description: 'Kämpfe gegen den Wissens-Boss und steige im Level auf!',
  icon: '🃏',
  accent: '',

  getStats() {
    const p = readFlashcardBattleProgress();
    const c = p.counters || {};
    const level = window.FBCore ? window.FBCore.levelFromXp(p.xp || 0).level : '—';
    return [
      { label: 'Level', value: level },
      { label: 'Siege', value: p.runsWon || 0 },
      { label: 'Endlos-Rekord', value: (p.bestEndless || 0) + ' Räume' },
      { label: 'Besiegte Monster', value: c.monstersDefeated || 0 },
      { label: 'Höchste Combo', value: c.maxCombo || 0 },
      { label: 'Kritische Treffer', value: c.crits || 0 },
      { label: 'Lern-Streak', value: (p.streak?.days || 0) + (p.streak?.days === 1 ? ' Tag' : ' Tage') }
    ];
  },

  resetStats() {
    const all = DB.get('gameHighscores', {});
    delete all['flashcard-battle'];
    DB.set('gameHighscores', all);
  },

  // Cozy Home sammelt diese Haustiere ein (collectCrossGamePets in pets.js)
  pets: window.FB_MONSTERS.filter(m => m.pet).map(m => ({
    ...m.pet,
    id: 'fb-' + m.id,
    sourceGame: 'flashcard-battle',
    shopPrice: 200,
    assets: { basePath: 'games/flashcard-battle/assets/pets/' + m.id + '/' },
    unlock: {
      type: 'counter',
      target: 'flashcard-battle',
      counter: 'defeat:' + m.id,
      value: window.FB_PET_WINS[m.tier],
      description: 'Besiege ' + m.name + ' ' + window.FB_PET_WINS[m.tier] + '× in Flashcard Battle'
    }
  }))
});
