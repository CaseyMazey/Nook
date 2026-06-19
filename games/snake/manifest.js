// =========================
// MANIFEST: SNAKE
// Lädt sofort beim Start (für die Library-Karte).
// Die eigentliche Spiellogik (snake.js) lädt erst beim Klick auf "Spielen".
// =========================

// Snake hat seine Highscores früher als reine Zahl gespeichert
// (all.snake = 240). Für "Spiele gespielt" brauchen wir ein Objekt —
// diese Funktion liest beide Formate und migriert nicht-destruktiv.
function readSnakeStats(all) {
  const raw = all.snake;
  if (typeof raw === 'number') return { best: raw, totalGames: 0 };
  return raw || { best: 0, totalGames: 0 };
}

window.registerGame({
  id: 'snake',
  title: 'Snake',
  description: 'Der Klassiker. Wie lange schaffst du es?',
  icon: '🐍',
  accent: '',

  // Generisches Format: Liste aus {label, value}. Der Hub zeigt die ersten
  // zwei Einträge auf der Karte, der Stats-Dialog zeigt alle.
  getStats() {
    const snake = readSnakeStats(DB.get('gameHighscores', {}));
    return [
      { label: 'Highscore', value: snake.best > 0 ? snake.best : '—' },
      { label: 'Spiele gespielt', value: snake.totalGames || 0 }
    ];
  },

  resetStats() {
    const all = DB.get('gameHighscores', {});
    delete all.snake;
    DB.set('gameHighscores', all);
  },

  getPets() {
    return [
      {
        id: 'slangel',
        name: 'Schlängel',

        sourceGame: 'snake',

        image: 'games/snake/assets/slangel.png',

        personality: 'Rollt sich gerne unter Decken ein.',

        unlockCondition: {
          type: 'highscore',
          value: 500
        }
      }
    ];
  }

});