// ==========================================
// MEMORY — games/memory/game.js
// Self-contained plugin: rendert eigenes HTML,
// registriert sich beim GameHub
// ==========================================

(function () {

  // ---- Konstanten ----
  const EMOJIS = [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼',
    '🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔',
    '🦆','🦅','🦉','🦋'
  ];

  // ---- State ----
  const mem = {
    pairs:    8,
    cards:    [],
    flipped:  [],
    matched:  0,
    moves:    0,
    timer:    null,
    seconds:  0,
    running:  false,
    locked:   false,
    active:   false,
    initialized: false
  };

  // ---- HTML ----
  function buildHTML() {
    return `
      <div class="game-card-title-block" style="padding:24px 28px 0;">
        <h2 class="game-card-title">Memory</h2>
        <p class="game-card-sub">Finde alle Kartenpaare.</p>
      </div>

      <!-- Setup screen -->
      <div id="memory-setup" class="memory-setup-screen">
        <div class="game-setting-group">
          <span class="game-setting-label">
            Kartenpaare: <span id="memory-pairs-label">8</span>
          </span>
          <input type="range" id="memory-pairs-slider"
            min="3" max="20" value="8" class="mem-slider"/>
          <div class="mem-slider-marks">
            <span>3</span><span>8</span><span>14</span><span>20</span>
          </div>
        </div>
        <button class="game-action-btn" id="memory-start-btn"
          style="width:auto;align-self:flex-start;padding:12px 32px;font-size:14px;">
          Spielen
        </button>
      </div>

      <!-- Active game -->
      <div id="memory-game" class="hidden">
        <div class="memory-active-header">
          <div id="memory-stats" class="memory-stats-new"></div>
          <div style="display:flex;gap:8px;">
            <button class="game-toggle-btn" id="memory-abort-btn">Beenden</button>
            <button class="game-toggle-btn" id="memory-reset-btn">Neu</button>
          </div>
        </div>
        <div id="memory-board" class="memory-board-new"></div>
      </div>

      <!-- Done screen -->
      <div id="memory-done" class="memory-done-new hidden"></div>
    `;
  }

  // ---- Hilfsfunktionen ----
  function fmtTime(seconds) {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // ---- Init (einmalig) ----
  function init(container) {
    if (mem.initialized) return;
    mem.initialized = true;

    container.innerHTML = buildHTML();

    const slider = container.querySelector('#memory-pairs-slider');
    const label  = container.querySelector('#memory-pairs-label');
    slider.addEventListener('input', () => {
      label.textContent = slider.value;
      mem.pairs = parseInt(slider.value);
    });

    container.querySelector('#memory-start-btn')
      .addEventListener('click', startGame);
    container.querySelector('#memory-reset-btn')
      .addEventListener('click', () => { stopTimer(); showSetup(container); });
    container.querySelector('#memory-abort-btn')
      .addEventListener('click', () => { stopTimer(); showSetup(container); });
  }

  // ---- Mount: Timer resumieren wenn Tab wieder aktiv ----
  function mount() {
    resumeTimer();
  }

  // ---- Destroy: Timer stoppen wenn Spiel verlassen ----
  function destroy() {
    pauseTimer();
  }

  // ---- Setup-Screen ----
  function showSetup(container) {
    mem.active = false;
    container.querySelector('#memory-setup').classList.remove('hidden');
    container.querySelector('#memory-game').classList.add('hidden');
    container.querySelector('#memory-done').classList.add('hidden');
    mem.flipped = []; mem.matched = 0; mem.moves = 0;
    mem.seconds = 0; mem.running = false; mem.locked = false;
  }

  // ---- Spiel starten ----
  function startGame() {
    const container = document.getElementById('game-memory');
    if (!container) return;

    mem.pairs   = parseInt(container.querySelector('#memory-pairs-slider').value);
    mem.flipped = []; mem.matched = 0; mem.moves = 0; mem.seconds = 0;
    mem.running = false; mem.locked = false; mem.active = true;
    stopTimer();

    const emojis = EMOJIS.slice(0, mem.pairs);
    const deck   = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    mem.cards    = deck.map((e, i) => ({ id: i, emoji: e, flipped: false, matched: false }));

    container.querySelector('#memory-setup').classList.add('hidden');
    container.querySelector('#memory-game').classList.remove('hidden');
    container.querySelector('#memory-done').classList.add('hidden');
    renderStats(container);
    renderBoard(container);
  }

  // ---- Timer ----
  function pauseTimer() {
    if (mem.running) { clearInterval(mem.timer); mem.running = false; }
  }
  function resumeTimer() {
    const container = document.getElementById('game-memory');
    if (!mem.active || mem.running || mem.matched >= mem.pairs) return;
    const gameEl = container && container.querySelector('#memory-game');
    if (gameEl && !gameEl.classList.contains('hidden')) {
      mem.running = true;
      mem.timer   = setInterval(() => {
        mem.seconds++;
        const c = document.getElementById('game-memory');
        if (c) renderStats(c);
      }, 1000);
    }
  }
  function stopTimer() { clearInterval(mem.timer); mem.timer = null; mem.running = false; }
  function startTimer() {
    if (!mem.running) {
      mem.running = true;
      mem.timer   = setInterval(() => {
        mem.seconds++;
        const c = document.getElementById('game-memory');
        if (c) renderStats(c);
      }, 1000);
    }
  }

  // ---- Stats rendern ----
  function renderStats(container) {
    const m = Math.floor(mem.seconds / 60), s = mem.seconds % 60;
    container.querySelector('#memory-stats').innerHTML = `
      <div class="memory-stat">
        <span class="memory-stat-label">Zeit</span>
        <span class="memory-stat-value">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span>
      </div>
      <div class="memory-stat">
        <span class="memory-stat-label">Züge</span>
        <span class="memory-stat-value">${mem.moves}</span>
      </div>
      <div class="memory-stat">
        <span class="memory-stat-label">Paare</span>
        <span class="memory-stat-value">${mem.matched}/${mem.pairs}</span>
      </div>`;
  }

  // ---- Board rendern ----
  function renderBoard(container) {
    const board = container.querySelector('#memory-board');
    board.innerHTML = '';

    const total = mem.pairs * 2;
    const cols  = total <= 6 ? 3 : total <= 12 ? 4 : 5;
    board.style.gridTemplateColumns = `repeat(${cols}, 70px)`;

    mem.cards.forEach((card, idx) => {
      const el = document.createElement('div');
      el.className = 'mem-card'
        + (card.flipped || card.matched ? ' flipped' : '')
        + (card.matched ? ' matched' : '');
      el.innerHTML = `
        <div class="mem-card-inner">
          <div class="mem-card-front">?</div>
          <div class="mem-card-back">${card.emoji}</div>
        </div>`;
      if (!card.matched) {
        el.addEventListener('click', () => flipCard(idx, container));
      }
      board.appendChild(el);
    });
  }

  // ---- Karte umdrehen ----
  function flipCard(idx, container) {
    if (mem.locked) return;
    const card = mem.cards[idx];
    if (card.flipped || card.matched) return;

    startTimer();
    card.flipped = true;
    mem.flipped.push(idx);
    renderBoard(container);

    if (mem.flipped.length === 2) {
      mem.moves++;
      mem.locked = true;
      const [a, b] = mem.flipped;
      if (mem.cards[a].emoji === mem.cards[b].emoji) {
        mem.cards[a].matched = mem.cards[b].matched = true;
        mem.matched++;
        mem.flipped = [];
        mem.locked  = false;
        renderBoard(container);
        renderStats(container);
        if (mem.matched === mem.pairs) finish(container);
      } else {
        setTimeout(() => {
          mem.cards[a].flipped = mem.cards[b].flipped = false;
          mem.flipped = [];
          mem.locked  = false;
          renderBoard(container);
          renderStats(container);
        }, 900);
      }
    }
  }

  // ---- Spiel beendet ----
  function finish(container) {
    stopTimer();
    mem.active = false;

    const key  = `p${mem.pairs}`;
    const hs   = window.gameHighscores.memory || {};
    const prev = hs[key];
    let   newBest = false;

    if (!prev || mem.seconds < prev.seconds ||
       (mem.seconds === prev.seconds && mem.moves < prev.moves)) {
      hs[key] = { seconds: mem.seconds, moves: mem.moves };
      window.gameHighscores.memory = hs;
      window.saveHighscores();
      newBest = true;
    }

    const done = container.querySelector('#memory-done');
    done.className = 'memory-done-new';
    done.innerHTML = `
      <div class="memory-done-title">🎉 Geschafft!</div>
      <div class="memory-done-stats">
        ${fmtTime(mem.seconds)} &middot; ${mem.moves} Züge
        ${newBest ? '<span class="memory-new-best">&nbsp;🏆 Neuer Rekord!</span>' : ''}
      </div>
      <div class="memory-done-btns">
        <button class="game-toggle-btn active" id="memory-play-again">Nochmal</button>
        <button class="game-toggle-btn" id="memory-change-pairs">Einstellungen</button>
      </div>`;

    container.querySelector('#memory-game').classList.add('hidden');
    container.querySelector('#memory-play-again')
      .addEventListener('click', startGame);
    container.querySelector('#memory-change-pairs')
      .addEventListener('click', () => showSetup(container));

    window.renderAllHighscores();
    renderMemoryHighscores();
  }

  // ---- Highscore-Detail-Panel ----
  function renderMemoryHighscores() {
    const panel = document.querySelector('.games-hs-panel');
    if (!panel) return;

    const hs      = window.gameHighscores.memory || {};
    const entries = Object.entries(hs)
      .map(([k, v]) => ({ pairs: parseInt(k.replace('p', '')), ...v }))
      .sort((a, b) => a.pairs - b.pairs);

    const rows = entries.length === 0
      ? `<div class="mem-hs-empty">Noch keine Spiele abgeschlossen.</div>`
      : entries.map(e => `
          <div class="mem-hs-row">
            <div class="mem-hs-pairs">
              <span class="mem-hs-badge">${e.pairs}</span> Paare
            </div>
            <div class="mem-hs-time">${fmtTime(e.seconds)}</div>
            <div class="mem-hs-moves">${e.moves} Züge</div>
          </div>`).join('');

    panel.innerHTML = `
      <div class="games-hs-title">
        <button class="mem-hs-back" id="mem-hs-back-btn" title="Zurück">←</button>
        Memory Highscores
      </div>
      <div class="mem-hs-header">
        <span>Paare</span><span>Beste Zeit</span><span>Züge</span>
      </div>
      <div class="mem-hs-list">${rows}</div>`;

    panel.querySelector('#mem-hs-back-btn')
      .addEventListener('click', () => window.renderAllHighscores());
  }

  // ---- Highscore-Wert für Panel ----
  function getHighscore() {
    const hs      = window.gameHighscores.memory || {};
    const entries = Object.entries(hs);
    if (entries.length === 0) return '—';
    const best = entries.sort((a, b) => a[1].seconds - b[1].seconds)[0];
    return fmtTime(best[1].seconds);
  }

  // ---- Registrierung ----
  // Meta-Infos kommen aus manifest.json
  window.registerGame({
    id: 'memory',
    init,
    mount,
    destroy,
    getHighscore
  });

})();