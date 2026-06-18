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

  // Generisches Format: Liste aus {label, value}. Der Hub zeigt die ersten
  // zwei Einträge auf der Karte, der Stats-Dialog zeigt alle.
  getStats() {
    const all = DB.get('gameHighscores', {});
    const ttt = all.ttt || {};
    return [
      { label: 'Siege', value: ttt.playerWins || 0 },
      { label: 'Niederlagen', value: ttt.opponentWins || 0 },
      { label: 'Unentschieden', value: ttt.draws || 0 }
    ];
  },

  resetStats() {
    const all = DB.get('gameHighscores', {});
    delete all.ttt;
    DB.set('gameHighscores', all);
  }
});
