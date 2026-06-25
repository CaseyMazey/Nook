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

  // ────────────────────────────────────
  // CROSS-GAME-HAUSTIERE
  //
  // Jedes Spiel definiert seine eigenen Haustiere hier vollständig.
  // Cozy Home liest diese Daten und baut den Shop daraus.
  // Kein Hardcode in Cozy Home – nur das Spiel kennt seine Assets.
  //
  // assets.basePath  → Ordner mit icon.png, default.png, sleep.png usw.
  //                    Fehlende Bilder fallen automatisch auf default.png zurück.
  //
  // unlock           → Generische Freischaltbedingung.
  //   type:            "highscore" | "gamesPlayed" | "achievement" | ...
  //   target:          Spiel-ID, gegen die geprüft wird
  //   value:           Schwellenwert
  //   description:     Menschenlesbare Bedingung (wird im Shop angezeigt)
  //
  // shopPrice        → Coins-Preis nach dem Freischalten
  // sourceGame       → Spiel-ID für "Exklusiv aus …"-Anzeige
  // ────────────────────────────────────
  pets: [
    {
      id:                    "snake",
      name:                  "Schlängel",
      species:               "Schlange",
      description:           "Eine entspannte Schlange, die das gemütliche Leben in Cozy Home genießt.",
      favoriteFood:          "mouse",
      favoriteFoodName:      "Maus",
      favoriteFoodEmoji:     "🐭",
      favoriteActivity:      "Schlafen",
      traits:                "Gemütlich",
      playHappinessBase:     8,
      playHappinessBall:     12,
      hungerDecayMultiplier: 0.8,
      sourceGame:            "snake",
      shopPrice:             200,
      assets: {
        basePath: "games/snake/assets/pets/snake/"
      },
      thoughts: {
        hungry: ["💭 Ich könnte eine Maus vertragen...", "💭 Hunger..."],
        tired:  ["💭 Ich rolle mich kurz ein.", "💭 Ein Nickerchen wäre schön."],
        lonely: ["💭 Ist hier jemand?", "💭 Etwas Gesellschaft wäre schön."],
        happy:  ["💭 Es ist so gemütlich hier!", "💭 Zzzz...", "💭 Perfektes Wetter zum Dösen."]
      },
      unlock: {
        type:        "highscore",
        target:      "snake",
        value:       250,
        description: "Erreiche 250 Punkte in Snake."
      }
    }
  ]

});
