// =========================
// GAME HUB — Cozy Mockup Version
// =========================

window.GameHub = {
  initialized: false
};

// =========================
// MOCK GAME DATA
// =========================

const MOCK_GAMES = [
  {
    id: 'flashcard-battle',
    title: 'Flashcard Battle',
    description: 'Kämpfe gegen den Wissens-Boss und steige im Level auf!',
    image: 'assets/games/flashcard-battle.png',
    accent: '',
    statLabel: 'Level',
    statValue: 'LVL 8',
    secondaryStat: '850 XP',
    badge: 'Neu',
    button: 'Spielen'
  },

  {
    id: 'snake',
    title: 'Snake',
    description: 'Der Klassiker. Wie lange schaffst du es?',
    image: 'assets/games/snake.png',
    accent: '',
    statLabel: 'Best',
    statValue: '240',
    secondaryStat: 'Punkte',
    button: 'Spielen'
  },

  {
    id: 'memory',
    title: 'Memory',
    description: 'Trainiere dein Gedächtnis und schlage deine Zeit!',
    image: 'assets/games/memory.png',
    accent: 'blue',
    statLabel: 'Best',
    statValue: '01:24',
    secondaryStat: 'Zeit',
    button: 'Spielen'
  },

  {
    id: 'debug-hero',
    title: 'Debug Hero',
    description: 'Finde den Fehler im Code und werde zum Debug Master!',
    image: 'assets/games/debug-hero.png',
    accent: 'orange',
    statLabel: 'Level',
    statValue: 'LVL 5',
    secondaryStat: '620 XP',
    button: 'Spielen'
  },

  {
    id: 'ttt',
    title: 'Tic-Tac-Toe',
    description: 'Fordere die KI oder einen Freund heraus!',
    image: 'assets/games/ttt.png',
    accent: 'purple',
    statLabel: 'Siege',
    statValue: '18',
    secondaryStat: 'Gewonnen',
    button: 'Spielen'
  },

  {
    id: 'virtual-pet',
    title: 'Virtual Pet',
    description: 'Kümmere dich um dein Pet und lass es wachsen!',
    image: 'assets/games/virtual-pet.png',
    accent: 'pink',
    statLabel: 'Happiness',
    statValue: '85%',
    secondaryStat: 'Glücklich',
    badge: 'Neu',
    badgeClass: 'pink',
    button: 'Öffnen'
  }
];

// =========================
// INIT
// =========================

function initGames() {

  if (window.GameHub.initialized) return;

  window.GameHub.initialized = true;

  const view = document.getElementById('view-games');

  if (!view) return;

  renderGamesHub(view);
}

window.initGames = initGames;

// =========================
// RENDER
// =========================

function renderGamesHub(view) {

  view.innerHTML = `
    <div class="games-shell">

      <div class="games-mock-wrapper">

        <div class="games-layout">

          <!-- LEFT -->
          <div class="games-main">

            <!-- HEADER -->
            <div class="games-header">

              <div class="games-title-row">

                <div class="games-title-icon">
                  <img
                    src="assets/games/controller.png"
                    alt="Controller"
                    class="games-controller-image"
                  >
                </div>

                <div>
                  <h1 class="games-title">Spiele</h1>
                </div>

              </div>

              <p class="games-subtitle">
                Kurze Pausen. Kleine Challenges. Große Erfolge.
              </p>

            </div>

            <!-- SEARCH -->
            <div class="games-toolbar">

              <div class="games-search">

                <svg viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                  <path
                    d="M20 20L17 17"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>

                <input
                  type="text"
                  placeholder="Spiel suchen..."
                  id="games-search-input"
                />

              </div>

            </div>

            <!-- LIBRARY -->
            <div class="games-library-header">
              <h2 class="games-library-title">Game Library</h2>
            </div>

            <div class="games-library-grid">
              ${MOCK_GAMES.map(renderGameCard).join('')}
            </div>

          </div>

          <!-- RIGHT -->
          <div class="games-right">

            <!-- PROFILE -->
            <div class="games-side-card">

              <div class="profile-top">

                <img
                  src="assets/games/profile.png"
                  class="profile-avatar"
                >

                <div class="profile-info">
                  <div class="profile-level">
                    Level 12
                  </div>

                  <div class="profile-xp">
                    1.240 / 1.800 XP
                  </div>

                  <div class="profile-bar">
                    <div class="profile-bar-fill"></div>
                  </div>
                </div>

              </div>

              <div class="profile-stats">

                <div class="profile-stat">
                  <span>🔥</span>
                  <strong>12</strong>
                  <small>Tage Streak</small>
                </div>

                <div class="profile-stat">
                  <span>⭐</span>
                  <strong>1.240</strong>
                  <small>Gesamt XP</small>
                </div>

                <div class="profile-stat">
                  <span>🕒</span>
                  <strong>32h</strong>
                  <small>Spielzeit</small>
                </div>

              </div>

            </div>

            <!-- PET -->
            <div class="games-side-card">

              <div class="pet-header">
                <span>Dein Pet</span>
                <span class="pet-mood">Glücklich 😊</span>
              </div>

              <img
                src="assets/games/pet.png"
                class="pet-room-image"
              >

              <div class="pet-progress">
                <div class="pet-progress-fill"></div>
              </div>

              <div class="pet-actions">

                <button>🤍</button>
                <button>🍚</button>
                <button>🎮</button>
                <button>💤</button>

              </div>

            </div>

            <!-- DAILY -->
            <div class="games-side-card">

              <div class="daily-header">
                <span>Tägliche Challenge</span>
                <small>23:12:45 verbleibend</small>
              </div>

              <div class="daily-text">
                Gewinne 1 Spiel in Flashcard Battle
              </div>

              <div class="daily-progress">
                <div class="daily-progress-fill"></div>
              </div>

              <div class="daily-footer">
                <span>Belohnung: ⭐ 75 XP</span>
                <span>0 / 1</span>
              </div>

              <button class="daily-button">
                Challenge anzeigen
              </button>

            </div>

            <!-- ACHIEVEMENTS -->
            <div class="games-side-card">

              <div class="achievements-header">
                <span>Neueste Achievements</span>
                <small>Alle anzeigen</small>
              </div>

              <div class="achievement-item">

                <div class="achievement-icon trophy">
                  🏆
                </div>

                <div class="achievement-info">
                  <strong>Erster Sieg</strong>
                  <small>Gewinne dein erstes Spiel</small>
                </div>

                <div class="achievement-xp">
                  +50 XP
                </div>

              </div>

              <div class="achievement-item">

                <div class="achievement-icon memory">
                  🧩
                </div>

                <div class="achievement-info">
                  <strong>Memorizer</strong>
                  <small>Schließe Memory (8 Paare) ab</small>
                </div>

                <div class="achievement-xp">
                  +75 XP
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  `;

  wireSearch();
}

// =========================
// GAME CARD
// =========================

function renderGameCard(game) {

  return `
    <div
      class="game-library-card ${game.accent || ''}"
      data-game-title="${game.title.toLowerCase()}"
    >

      ${game.badge ? `
        <div class="game-badge ${game.badgeClass || ''}">
          ${game.badge}
        </div>
      ` : ''}

      <div class="game-card-main">

        <img
          class="game-card-icon"
          src="${game.image}"
          alt="${game.title}"
        >

        <div class="game-card-text">

          <div class="game-card-title">
            ${game.title}
          </div>

          <div class="game-card-description">
            ${game.description}
          </div>

        </div>

      </div>

      <div class="game-card-stats">

        <div class="game-card-stat">
          <span class="game-card-stat-label">
            ${game.statLabel}
          </span>

          <span class="game-card-stat-value">
            ${game.statValue}
          </span>
        </div>

        <div class="game-card-stat">
          <span class="game-card-stat-label">
            Fortschritt
          </span>

          <span class="game-card-stat-value">
            ${game.secondaryStat}
          </span>
        </div>

      </div>

      <div class="game-card-actions">

        <button class="game-play-btn">
          ${game.button}
        </button>

        <button class="game-stats-btn">
          📊
        </button>

      </div>

    </div>
  `;
}

// =========================
// SEARCH
// =========================

function wireSearch() {

  const input = document.getElementById('games-search-input');

  if (!input) return;

  input.addEventListener('input', () => {

    const value = input.value.trim().toLowerCase();

    document
      .querySelectorAll('.game-library-card')
      .forEach(card => {

        const title = card.dataset.gameTitle || '';

        const visible = title.includes(value);

        card.style.display = visible ? '' : 'none';
      });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initGames();
});