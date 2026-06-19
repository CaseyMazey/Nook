// =========================
// MANIFEST: NEON DODGE
// Lädt sofort beim Start (für die Library-Karte).
// Die eigentliche Spiellogik (neon-dodge.js) lädt erst beim Klick auf "Spielen".
//
// Storage-Keys (eigener Namespace, komplett unabhängig von gameHighscores
// der anderen Spiele — siehe resetStats()):
//   neon_dodge_best        Zahl  (Highscore)
//   neon_dodge_stats       { deaths, coins, longestRun }
//   neon_dodge_highscores  [{ name, score, coins }, ...]  (Top 5)
//   neon_dodge_perma       { speed, hitbox, boost }  (permanente Upgrades)
//   neon_dodge_player      Zuletzt verwendeter Spielername
// =========================

window.registerGame({
  id: 'neon-dodge',
  title: 'Neon Dodge',
  description: 'Überlebe so lange du kannst — sammle Coins, weiche allem anderen aus.',
  icon: '⚡',
  accent: 'orange',
  badge: '🚧In Bearbeitung',

  // Aktuell lädt der Hub jedes Spiel ohnehin erst bei Bedarf nach (siehe
  // games.js). Das Feld ist hier trotzdem explizit gesetzt, falls der Hub
  // das später pro Spiel konfigurierbar machen soll.
  lazyLoad: true,

  // Generisches Format: Liste aus {label, value}. Der Hub zeigt die ersten
  // zwei Einträge auf der Karte, der Statistik-Dialog zeigt alle.
  getStats() {
    const best = DB.get('neon_dodge_best', 0);
    const stats = DB.get('neon_dodge_stats', { deaths: 0, coins: 0, longestRun: 0 });

    return [
      { label: 'Highscore', value: best > 0 ? best : '—' },
      { label: 'Längster Run', value: `${(stats.longestRun || 0).toFixed(1)}s` },
      { label: 'Tode', value: stats.deaths || 0 },
      { label: 'Coins gesammelt', value: stats.coins || 0 },
      // Jeder Tod beendet aktuell den Run (kein anderes Spielende) —
      // "Anzahl Spiele" entspricht deshalb der Anzahl Tode.
      { label: 'Anzahl Spiele', value: stats.deaths || 0 }
    ];
  },

  // Optionale Bestenliste (Top 5) — wird vom Hub generisch unter den
  // normalen Stats angezeigt, falls vorhanden.
  getHighscores() {
    const list = DB.get('neon_dodge_highscores', []);
    return list.map((h, i) => ({
      label: `${i + 1}. ${h.name}`,
      value: `${h.score} Punkte · ${h.coins} Coins`
    }));
  },

  // Wird von "Highscores zurücksetzen" in den Einstellungen aufgerufen.
  // Löscht ausschließlich Neon-Dodge-eigene Daten.
  resetStats() {
    DB.set('neon_dodge_best', 0);
    DB.set('neon_dodge_stats', { deaths: 0, coins: 0, longestRun: 0 });
    DB.set('neon_dodge_highscores', []);
    DB.set('neon_dodge_perma', { speed: 0, hitbox: 0, boost: 0 });
    // Spielername bleibt bewusst erhalten — ist keine Statistik.
  }
});
