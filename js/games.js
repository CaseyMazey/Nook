// =========================
// GAME HUB — games.js
// Lädt Spiele dynamisch aus games/games.json
// index.html wird für Spiele nie mehr angefasst
// =========================

window.GameHub = window.GameHub || {
  registry:         {},
  activeGame:       null,
  initializedGames: new Set(),
  hubReady:         false
};

// =========================
// PERSISTENZ
// =========================

let gameHighscores = DB.get('gameHighscores', {});

function saveHighscores() {
  DB.set('gameHighscores', gameHighscores);
}

window.gameHighscores     = gameHighscores;
window.saveHighscores     = saveHighscores;
window.renderAllHighscores = renderAllHighscores; // legacy-kompatibel

// =========================
// REGISTER GAME
// Spiele rufen dies am Ende ihrer game.js auf.
// Meta-Infos (name, icon, …) kommen aus manifest.json
// und werden hier automatisch ergänzt — game.js
// muss sie nicht mehr selbst mitbringen.
// =========================

window.registerGame = function (gameConfig) {
  if (!gameConfig || !gameConfig.id) {
    console.warn('registerGame: ungültige Config, id fehlt.');
    return;
  }

  const existing = window.GameHub.registry[gameConfig.id] || {};

  // Manifest-Daten haben Vorrang vor hardcoded Werten in game.js
  window.GameHub.registry[gameConfig.id] = Object.assign({}, gameConfig, existing);

  console.log(`🎮 Registriert: ${gameConfig.id}`);
};

// =========================
// DYNAMISCHES LADEN
// =========================

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Nicht doppelt laden
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s    = document.createElement('script');
    s.src      = src;
    s.onload   = resolve;
    s.onerror  = () => {
      console.warn(`GameHub: Script nicht gefunden – ${src}`);
      resolve(); // nicht reject — fehlendes Spiel soll Hub nicht blocken
    };
    document.head.appendChild(s);
  });
}

function loadStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link  = document.createElement('link');
  link.rel    = 'stylesheet';
  link.href   = href;
  document.head.appendChild(link);
}

async function loadManifest(gameId) {
  try {
    const res = await fetch(`games/${gameId}/manifest.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function loadAllGames() {
  // games.json holen
  let gameIds = [];
  try {
    const res  = await fetch('games/games.json');
    const data = await res.json();
    // Beide Formate unterstützen: ["ttt"] oder { "games": ["ttt"] }
    gameIds = Array.isArray(data) ? data : (data.games || []);
  } catch (err) {
    console.error('GameHub: games.json konnte nicht geladen werden.', err);
    return;
  }

  // Pro Spiel: manifest → script → style
  for (const id of gameIds) {
    // 1. Manifest laden und vorab in Registry eintragen
    const manifest = await loadManifest(id);
    if (manifest) {
      window.GameHub.registry[id] = Object.assign(
        { id },
        manifest,
        window.GameHub.registry[id] || {} // bereits registrierte Logik nicht überschreiben
      );
    }

    // 2. Style laden (non-blocking)
    loadStyle(`games/${id}/style.css`);

    // 3. Script laden — game.js ruft registerGame() auf und ergänzt die Logik
    await loadScript(`games/${id}/game.js`);
  }

  // Alle Spiele geladen → Hub initialisieren
  initHub();
}

// =========================
// HUB INITIALISIERUNG
// =========================

function initHub() {
  renderGameTabs();
  renderGameCards();
  wireTabClicks();
  renderAllHighscores();

  // Erstes Spiel öffnen
  const firstId = Object.keys(window.GameHub.registry)[0];
  if (firstId) {
    const firstTab = document.querySelector(`.games-tab[data-game="${firstId}"]`);
    if (firstTab) firstTab.classList.add('active');
    openGame(firstId);
  }
}

// Wird von main.js via renderView('games') aufgerufen.
// Nach dem ersten Mal nur noch Highscores aktualisieren.
function initGames() {
  if (window.GameHub.hubReady) {
    renderAllHighscores();
    return;
  }
  window.GameHub.hubReady = true;
  loadAllGames();
}

// =========================
// TABS
// =========================

function renderGameTabs() {
  const container = document.querySelector('.games-tabs');
  if (!container) return;

  container.innerHTML = '';

  Object.values(window.GameHub.registry).forEach(game => {
    const btn          = document.createElement('button');
    btn.className      = 'games-tab';
    btn.dataset.game   = game.id;
    btn.innerHTML      = `
      <span class="games-tab-icon">${game.icon || '🎮'}</span>
      <span class="games-tab-title">${game.name || game.id}</span>
    `;
    container.appendChild(btn);
  });
}

function wireTabClicks() {
  const container = document.querySelector('.games-tabs');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.games-tab');
    if (!btn) return;

    document.querySelectorAll('.games-tab').forEach(t =>
      t.classList.toggle('active', t === btn)
    );

    openGame(btn.dataset.game);
  });
}

// =========================
// GAME CARDS
// =========================

function renderGameCards() {
  const area = document.querySelector('.games-area');
  if (!area) return;

  area.innerHTML = '';

  Object.values(window.GameHub.registry).forEach(game => {
    const card     = document.createElement('div');
    card.id        = `game-${game.id}`;
    card.className = 'game-card hidden';
    area.appendChild(card);
  });
}

// =========================
// SPIEL ÖFFNEN
// =========================

function openGame(gameId) {
  const registry = window.GameHub.registry;
  const game     = registry[gameId];

  if (!game) {
    console.warn(`openGame: "${gameId}" nicht in Registry.`);
    return;
  }

  // Vorheriges Spiel zerstören
  if (window.GameHub.activeGame && window.GameHub.activeGame !== gameId) {
    const prev = registry[window.GameHub.activeGame];
    if (prev && typeof prev.destroy === 'function') {
      try { prev.destroy(); } catch (err) { console.error(err); }
    }
  }

  // Alle Cards ausblenden
  document.querySelectorAll('.game-card').forEach(c => c.classList.add('hidden'));

  // Diese Card einblenden
  const card = document.getElementById(`game-${gameId}`);
  if (!card) {
    console.warn(`openGame: kein Card-Element für "${gameId}"`);
    return;
  }
  card.classList.remove('hidden');

  // Init: nur einmal
  if (!window.GameHub.initializedGames.has(gameId)) {
    if (typeof game.init === 'function') {
      try { game.init(card); } catch (err) { console.error(err); }
    }
    window.GameHub.initializedGames.add(gameId);
  }

  // Mount: bei jedem Öffnen
  if (typeof game.mount === 'function') {
    try { game.mount(card); } catch (err) { console.error(err); }
  }

  window.GameHub.activeGame = gameId;
  renderAllHighscores();
}

// =========================
// HIGHSCORES
// =========================

function renderAllHighscores() {
  const panel = document.querySelector('.games-hs-panel');
  if (!panel) return;

  panel.innerHTML = `<div class="games-hs-title">🏆 Highscores</div>`;

  Object.values(window.GameHub.registry).forEach(game => {
    let score = '—';
    if (typeof game.getHighscore === 'function') {
      try {
        const raw = game.getHighscore();
        if (raw !== null && raw !== undefined && raw !== '') score = raw;
      } catch (err) { console.error(err); }
    }

    const entry       = document.createElement('div');
    entry.className   = 'games-hs-entry';
    entry.id          = `games-hs-${game.id}`;
    entry.innerHTML   = `
      <div class="games-hs-icon">${game.icon || '🎮'}</div>
      <div class="games-hs-info">
        <div class="games-hs-game">${game.name || game.id}</div>
        <div class="games-hs-desc">${game.highscoreLabel || 'Highscore'}</div>
      </div>
      <div class="games-hs-value" id="hs-val-${game.id}">${score}</div>
    `;
    panel.appendChild(entry);
  });
}

// =========================
// PUBLIC API FÜR SPIELE
// =========================

window.GameHubAPI = {

  getHighscores() {
    return gameHighscores;
  },

  saveHighscores() {
    saveHighscores();
  },

  setHighscore(gameId, data) {
    gameHighscores[gameId] = data;
    saveHighscores();
    renderAllHighscores();
  },

  updateHighscore(gameId, key, value) {
    if (!gameHighscores[gameId]) gameHighscores[gameId] = {};
    gameHighscores[gameId][key] = value;
    saveHighscores();
    renderAllHighscores();
  },

  refreshHighscores() {
    renderAllHighscores();
  }
};

// =========================
// DEBUG
// =========================

window.GameHubDebug = {
  registry()    { console.log(window.GameHub.registry); },
  active()      { console.log(window.GameHub.activeGame); },
  initialized() { console.log([...window.GameHub.initializedGames]); }
};
