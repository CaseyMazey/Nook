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
// DUNGEONS & MONSTER (reine Daten)
// Neuer Dungeon: Eintrag in FB_DUNGEONS plus seine Monster in FB_MONSTERS.
//
// Grafiken: Original nach assets/_raw/flashcard-battle/{dungeons,monsters}/
// legen und scripts/optimize-fb-assets.py ausführen. Das Ergebnis landet unter
//   games/flashcard-battle/assets/dungeons/<dungeon-id>.png  (Hintergrund)
//   games/flashcard-battle/assets/monsters/<monster-id>.png  (transparent)
// Solange eine Datei fehlt, zeigt das Spiel den Farbverlauf bzw. das Emoji.
//
// colors: Farbverlauf ohne Hintergrundbild
// tier:   "normal" | "rare" | "boss"
// ────────────────────────────────────
window.FB_DUNGEONS = [
  { id: 'tempel',     name: 'Der überwucherte Tempel',    icon: '🌿', colors: ['#5f7f4f', '#c9bb94', '#3f9c94'] },
  { id: 'bibliothek', name: 'Die verzauberte Bibliothek', icon: '🔮', colors: ['#1d2550', '#5a2f8c', '#c9a23f'] },
  { id: 'hoehlen',    name: 'Die Drachenhöhlen',          icon: '🌋', colors: ['#7a1f1f', '#d9702a', '#33353b'] }
];

window.FB_MONSTERS = [
  { id: 'schleimling',      name: 'Schleimling',            tier: 'normal', dungeon: 'tempel',     emoji: '🟢' },
  { id: 'pilzling',         name: 'Pilzling',               tier: 'normal', dungeon: 'tempel',     emoji: '🍄' },
  { id: 'dornwusel',        name: 'Dornwusel',              tier: 'normal', dungeon: 'tempel',     emoji: '🌵' },
  { id: 'moosgeist',        name: 'Moosgeist',              tier: 'rare',   dungeon: 'tempel',     emoji: '🍃' },
  { id: 'wurzelhueter',     name: 'Der uralte Wurzelhüter', tier: 'boss',   dungeon: 'tempel',     emoji: '🌳' },

  { id: 'flatterfrage',     name: 'Flatterfrage',           tier: 'normal', dungeon: 'bibliothek', emoji: '🦇' },
  { id: 'buecherwurm',      name: 'Bücherwurm',             tier: 'normal', dungeon: 'bibliothek', emoji: '📖' },
  { id: 'tintenrabe',       name: 'Tintenrabe',             tier: 'normal', dungeon: 'bibliothek', emoji: '🐦‍⬛' },
  { id: 'runenwaechter',    name: 'Runenwächter',           tier: 'rare',   dungeon: 'bibliothek', emoji: '🔮' },
  { id: 'archivar',         name: 'Der Archivar',           tier: 'boss',   dungeon: 'bibliothek', emoji: '📚' },

  { id: 'funkenkobold',     name: 'Funkenkobold',           tier: 'normal', dungeon: 'hoehlen',    emoji: '🔥' },
  { id: 'kristallkrabbler', name: 'Kristallkrabbler',       tier: 'normal', dungeon: 'hoehlen',    emoji: '🦀' },
  { id: 'hoehlendrache',    name: 'Höhlendrache',           tier: 'normal', dungeon: 'hoehlen',    emoji: '🐲' },
  { id: 'kristallfuchs',    name: 'Kristallfuchs',          tier: 'rare',   dungeon: 'hoehlen',    emoji: '🦊' },
  { id: 'urdrache',         name: 'Der Urdrache',           tier: 'boss',   dungeon: 'hoehlen',    emoji: '🐉' }
];

function readFlashcardBattleProgress() {
  return DB.get('gameHighscores', {})['flashcard-battle'] || {};
}

window.registerGame({
  id: 'flashcard-battle',
  title: 'Flashcard Battle',
  modalSize: "big",
  description: 'Kämpfe gegen den Wissens-Boss und steige im Level auf!',
  icon: '🃏',
  accent: '',

  getStats() {
    const p = readFlashcardBattleProgress();
    const c = p.counters || {};
    const core = window.FBCore;
    const level = core ? core.levelFromXp(p.xp || 0).level : '—';
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const streak = core ? core.currentStreak(p, today) : (p.streak?.days || 0);
    const rooms = p.bestEndless || 0;
    return [
      { label: 'Level', value: level },
      { label: 'Siege', value: p.runsWon || 0 },
      { label: 'Endlos-Rekord', value: rooms + (rooms === 1 ? ' Raum' : ' Räume') },
      { label: 'Besiegte Monster', value: c.monstersDefeated || 0 },
      { label: 'Höchste Combo', value: c.maxCombo || 0 },
      { label: 'Kritische Treffer', value: c.crits || 0 },
      { label: 'Lern-Streak', value: streak + (streak === 1 ? ' Tag' : ' Tage') }
    ];
  },

  resetStats() {
    const all = DB.get('gameHighscores', {});
    delete all['flashcard-battle'];
    DB.set('gameHighscores', all);
  }
});
