// =========================
// MANIFEST: MEMORY
// Lädt sofort beim Start (für die Library-Karte).
// Die eigentliche Spiellogik (memory.js) lädt erst beim Klick auf "Spielen".
// =========================

window.registerGame({
  id: 'memory',
  title: 'Memory',
  description: 'Trainiere dein Gedächtnis und schlage deine Zeit!',
  icon: '🧩',
  accent: 'blue',

  // Generisches Format: Liste aus {label, value}. Der Hub zeigt die ersten
  // zwei Einträge auf der Karte, der Stats-Dialog zeigt alle.
  getStats() {
    const all = DB.get('gameHighscores', {});
    const memory = all.memory || {};
    const bestEntries = Object.entries(memory).filter(([key]) => key !== 'totalGames');
    const best = bestEntries.length
      ? bestEntries.map(([, v]) => v).sort((a, b) => a.seconds - b.seconds)[0]
      : null;

    const bestLabel = best
      ? `${String(Math.floor(best.seconds / 60)).padStart(2, '0')}:${String(best.seconds % 60).padStart(2, '0')}`
      : '—';

    return [
      { label: 'Beste Zeit', value: bestLabel },
      { label: 'Spiele gespielt', value: memory.totalGames || 0 }
    ];
  },

  resetStats() {
    const all = DB.get('gameHighscores', {});
    delete all.memory;
    DB.set('gameHighscores', all);
  }
});
