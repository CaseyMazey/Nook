// =========================
// GAME HUB
// Reiner Launcher/Container: Registry, Library-Rendering, Suche, Modal.
// Kennt keine einzelne Spiel-ID — alles kommt aus window.GAMES_LIST
// (games/games-list.js) und den selbst-registrierenden Spiel-Dateien.
//
// Ladestrategie pro Spiel:
//   1. games/<id>/manifest.js   → lädt sofort (Meta + getStats, für die Karte)
//   2. games/<id>/<id>.js       → lädt erst beim ersten Klick auf "Spielen"
//   3. games/<id>/<id>.css      → wird beim Öffnen injiziert, beim Schließen entfernt
// =========================

window.GameHub = {
  registry: {},
  activeGame: null,
  initialized: false,
  loadedCss: new Map() // gameId -> <link>-Element
};

// Spiele rufen das selbst auf (in manifest.js UND später nochmal in <id>.js).
// Mehrfache Aufrufe werden zusammengeführt, nicht überschrieben — so kann
// manifest.js zuerst die Meta-Daten registrieren und <id>.js später nur
// mount/destroy ergänzen.
window.registerGame = function (gameConfig) {
  if (!gameConfig || !gameConfig.id) {
    console.warn('registerGame: ungültige Config, id fehlt.');
    return;
  }
  const existing = window.GameHub.registry[gameConfig.id] || {};
  window.GameHub.registry[gameConfig.id] = Object.assign({}, existing, gameConfig);
};

let lastSearchTerm = '';

// =========================
// SCRIPT/CSS-LOADER
// Funktioniert unter file:// (kein fetch() — nur <script>/<link>-Tags,
// die der Browser ganz normal lädt, anders als fetch()/XHR).
// =========================

function loadScript(src) {
  return new Promise(resolve => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => {
      console.warn(`GameHub: Skript nicht gefunden – ${src}`);
      resolve(); // ein fehlendes Spiel soll den Hub nicht blockieren
    };
    document.head.appendChild(s);
  });
}

function loadGameCss(id) {
  if (window.GameHub.loadedCss.has(id)) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `games/${id}/${id}.css`;
    link.onload = () => resolve();
    link.onerror = () => {
      console.warn(`GameHub: CSS nicht gefunden – games/${id}/${id}.css`);
      resolve(); // fehlende CSS soll das Spiel nicht blockieren
    };
    document.head.appendChild(link);
    window.GameHub.loadedCss.set(id, link);
  });
}

function unloadGameCss(id) {
  const link = window.GameHub.loadedCss.get(id);
  if (link) {
    link.remove();
    window.GameHub.loadedCss.delete(id);
  }
}

// =========================
// INIT
// Wird von main.js über renderView('games') aufgerufen.
// =========================

async function initGames() {

  if (window.GameHub.initialized) {
    // Tab erneut geöffnet: nur Stats/Highscores auf den Karten auffrischen.
    renderLibraryGrid();
    return;
  }

  window.GameHub.initialized = true;

  const view = document.getElementById('view-games');
  if (!view) return;

  renderGamesHub(view); // Shell + leeres Grid
  wireSearch();
  wireLibraryGrid();

  await Promise.all(
    (window.GAMES_LIST || []).map(id => loadScript(`games/${id}/manifest.js`))
  );
  renderLibraryGrid();
}
window.initGames = initGames;

// =========================
// KARTEN-DATEN
// Der Hub weiß hier nichts über einzelne Spiele — nur, dass eine ID
// in GAMES_LIST steht und sich (hoffentlich) registriert hat.
// =========================

function buildCardList() {
  return (window.GAMES_LIST || [])
    .map(id => window.GameHub.registry[id])
    .filter(Boolean)
    .map(game => {
      const fallbackStats = game.comingSoon
        ? { statLabel: 'Status', statValue: '—', secondaryStat: 'Bald da' }
        : { statLabel: '–', statValue: '–', secondaryStat: '–' };
      const stats = typeof game.getStats === 'function' ? game.getStats() : fallbackStats;

      return {
        ...game,
        ...stats,
        button: game.comingSoon ? 'Bald verfügbar' : 'Spielen',
        badge: game.comingSoon ? 'Bald verfügbar' : null
      };
    });
}

// =========================
// RENDER: HUB-SHELL
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
                <div class="games-title-icon">🎮</div>
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
                  <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M20 20L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <input type="text" placeholder="Spiel suchen..." id="games-search-input"/>
              </div>
            </div>

            <!-- LIBRARY -->
            <div class="games-library-header">
              <h2 class="games-library-title">Game Library</h2>
            </div>

            <div class="games-library-grid"></div>

          </div>

          <!-- RIGHT (Deko-Mockup, wird später mit echten Daten verbunden) -->
          <div class="games-right">

            <!-- PROFILE -->
            <div class="games-side-card">
              <div class="profile-top">
                <img src="assets/games/profile.png" class="profile-avatar">
                <div class="profile-info">
                  <div class="profile-level">Level 12</div>
                  <div class="profile-xp">1.240 / 1.800 XP</div>
                  <div class="profile-bar"><div class="profile-bar-fill"></div></div>
                </div>
              </div>
              <div class="profile-stats">
                <div class="profile-stat"><span>🔥</span><strong>12</strong><small>Tage Streak</small></div>
                <div class="profile-stat"><span>⭐</span><strong>1.240</strong><small>Gesamt XP</small></div>
                <div class="profile-stat"><span>🕒</span><strong>32h</strong><small>Spielzeit</small></div>
              </div>
            </div>

            <!-- PET -->
            <div class="games-side-card">
              <div class="pet-header">
                <span>Dein Pet</span>
                <span class="pet-mood">Glücklich 😊</span>
              </div>
              <img src="assets/games/pet.png" class="pet-room-image">
              <div class="pet-progress"><div class="pet-progress-fill"></div></div>
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
              <div class="daily-text">Gewinne 1 Spiel in Flashcard Battle</div>
              <div class="daily-progress"><div class="daily-progress-fill"></div></div>
              <div class="daily-footer">
                <span>Belohnung: ⭐ 75 XP</span>
                <span>0 / 1</span>
              </div>
              <button class="daily-button">Challenge anzeigen</button>
            </div>

            <!-- ACHIEVEMENTS -->
            <div class="games-side-card">
              <div class="achievements-header">
                <span>Neueste Achievements</span>
                <small>Alle anzeigen</small>
              </div>
              <div class="achievement-item">
                <div class="achievement-icon trophy">🏆</div>
                <div class="achievement-info">
                  <strong>Erster Sieg</strong>
                  <small>Gewinne dein erstes Spiel</small>
                </div>
                <div class="achievement-xp">+50 XP</div>
              </div>
              <div class="achievement-item">
                <div class="achievement-icon memory">🧩</div>
                <div class="achievement-info">
                  <strong>Memorizer</strong>
                  <small>Schließe Memory (8 Paare) ab</small>
                </div>
                <div class="achievement-xp">+75 XP</div>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  `;

  renderLibraryGrid();
}

// =========================
// RENDER: LIBRARY GRID
// =========================

function renderLibraryGrid() {
  const grid = document.querySelector('.games-library-grid');
  if (!grid) return;

  const cards = buildCardList();
  grid.innerHTML = cards.length
    ? cards.map(renderGameCard).join('')
    : `<p class="games-library-empty">Lädt Spiele…</p>`;

  applySearchFilter(lastSearchTerm);
}

function renderGameCard(game) {
  const disabled = !!game.comingSoon;

  return `
    <div
      class="game-library-card ${game.accent || ''} ${disabled ? 'coming-soon' : ''}"
      data-game-title="${game.title.toLowerCase()}"
    >

      ${game.badge ? `<div class="game-badge">${game.badge}</div>` : ''}

      <div class="game-card-main">
        <div class="game-card-icon-tile">${game.icon || '🎮'}</div>
        <div class="game-card-text">
          <div class="game-card-title">${game.title}</div>
          <div class="game-card-description">${game.description || ''}</div>
        </div>
      </div>

      <div class="game-card-stats">
        <div class="game-card-stat">
          <span class="game-card-stat-label">${game.statLabel}</span>
          <span class="game-card-stat-value">${game.statValue}</span>
        </div>
        <div class="game-card-stat">
          <span class="game-card-stat-label">${disabled ? 'Status' : 'Fortschritt'}</span>
          <span class="game-card-stat-value">${game.secondaryStat}</span>
        </div>
      </div>

      <div class="game-card-actions">
        <button class="game-play-btn" data-game-id="${game.id}" ${disabled ? 'disabled' : ''}>
          ${game.button}
        </button>
      </div>

    </div>
  `;
}

// =========================
// SUCHE
// =========================

function wireSearch() {
  const input = document.getElementById('games-search-input');
  if (!input) return;

  input.addEventListener('input', () => {
    lastSearchTerm = input.value.trim().toLowerCase();
    applySearchFilter(lastSearchTerm);
  });
}

function applySearchFilter(term) {
  document.querySelectorAll('.game-library-card').forEach(card => {
    const title = card.dataset.gameTitle || '';
    card.style.display = title.includes(term) ? '' : 'none';
  });
}

// =========================
// LIBRARY-KLICKS (Spielen-Button)
// =========================

function wireLibraryGrid() {
  const grid = document.querySelector('.games-library-grid');
  if (!grid) return;

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.game-play-btn');
    if (!btn || btn.disabled) return;
    openGamePlayModal(btn.dataset.gameId);
  });
}

// =========================
// PLAY-MODAL
// Lädt die eigentliche Spiellogik (<id>.js) + CSS (<id>.css) erst hier,
// beim ersten Öffnen — nicht beim Start der App.
// =========================

async function openGamePlayModal(gameId) {
  const game = window.GameHub.registry[gameId];
  if (!game || game.comingSoon) return;

  window.GameHub.activeGame = gameId;

  document.getElementById('games-play-modal-icon').textContent = game.icon || '🎮';
  document.getElementById('games-play-modal-name').textContent = game.title;

  const body = document.getElementById('games-play-modal-body');
  body.innerHTML = `<p class="games-play-loading">Lädt…</p>`;

  document.getElementById('games-play-modal-overlay').classList.remove('hidden');

  // Wichtig: BEIDE awaiten, nicht nur das Script. Sonst kann mount() das
  // Board bauen, bevor das Stylesheet geladen ist — die Zellen rendern
  // dann kurz mit Browser-Default-Größe (siehe Bugfix-Notiz unten).
  const cssReady = loadGameCss(gameId);
  const scriptReady = typeof game.mount === 'function'
    ? Promise.resolve()
    : loadScript(`games/${gameId}/${gameId}.js`);

  await Promise.all([cssReady, scriptReady]);

  // Falls der Nutzer in der Ladezeit schon wieder geschlossen oder ein
  // anderes Spiel geöffnet hat: nicht mehr in ein fremdes Modal mounten.
  if (window.GameHub.activeGame !== gameId) return;

  const ready = window.GameHub.registry[gameId];
  body.innerHTML = '';

  if (typeof ready.mount === 'function') {
    try { ready.mount(body); } catch (err) { console.error(err); }
  } else {
    body.innerHTML = `<p class="games-play-loading">Spiel konnte nicht geladen werden.</p>`;
  }
}

function closeGamePlayModal() {
  const gameId = window.GameHub.activeGame;
  const game = window.GameHub.registry[gameId];

  if (game && typeof game.destroy === 'function') {
    try { game.destroy(); } catch (err) { console.error(err); }
  }
  if (gameId) unloadGameCss(gameId);

  document.getElementById('games-play-modal-overlay').classList.add('hidden');
  document.getElementById('games-play-modal-body').innerHTML = '';
  window.GameHub.activeGame = null;

  // Highscores können sich geändert haben → Karten aktualisieren.
  renderLibraryGrid();
}

function wireGamePlayModal() {
  const overlay = document.getElementById('games-play-modal-overlay');
  if (!overlay) return;

  document.getElementById('games-play-modal-close').addEventListener('click', closeGamePlayModal);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeGamePlayModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeGamePlayModal();
  });
}

// Das Modal-Markup liegt statisch in index.html und existiert unabhängig
// vom Spiele-Tab — daher wird es sofort beim Laden verkabelt
// (gleiches Muster wie die Modals in budget.js).
wireGamePlayModal();
