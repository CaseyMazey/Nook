// =========================
// MANIFEST: SNAKE
// Lädt sofort beim Start (für die Library-Karte).
// Die eigentliche Spiellogik (snake.js) lädt erst beim Klick auf "Spielen".
// =========================

window.registerGame({
  id: 'snake',
  title: 'Snake',
  description: 'Der Klassiker. Wie lange schaffst du es?',
  icon: '🐍',
  accent: '',

  getStats() {
    const all = DB.get('gameHighscores', {});
    const best = all.snake || 0;
    return { statLabel: 'Best', statValue: best > 0 ? best : '—', secondaryStat: 'Punkte' };
  }
});
