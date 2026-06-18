// =========================
// MANIFEST: TIC-TAC-TOE
// Lädt sofort beim Start (für die Library-Karte).
// Die eigentliche Spiellogik (ttt.js) lädt erst beim Klick auf "Spielen".
// =========================

window.registerGame({
  id: 'ttt',
  title: 'Tic-Tac-Toe',
  description: 'Fordere die KI oder einen Freund heraus!',
  icon: '⭕',
  accent: 'purple',

  getStats() {
    const all = DB.get('gameHighscores', {});
    const wins = all.ttt?.playerWins || 0;
    return { statLabel: 'Siege', statValue: wins, secondaryStat: 'Gewonnen' };
  }
});
