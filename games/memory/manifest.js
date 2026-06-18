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

  getStats() {
    const all = DB.get('gameHighscores', {});
    const memHs = all.memory || {};
    const entries = Object.values(memHs);
    if (!entries.length) return { statLabel: 'Best', statValue: '—', secondaryStat: 'Zeit' };
    const best = entries.sort((a, b) => a.seconds - b.seconds)[0];
    const m = Math.floor(best.seconds / 60), s = best.seconds % 60;
    return { statLabel: 'Best', statValue: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, secondaryStat: 'Zeit' };
  }
});
