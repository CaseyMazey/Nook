// =========================
// SPIEL-LOGIK: MEMORY
// Wird erst beim ersten Klick auf "Spielen" geladen.
// Ergänzt die bereits über manifest.js registrierte Karte um mount/destroy.
// =========================

(function () {

  const MEMORY_EMOJIS = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🦆','🦅','🦉','🦋'];

  const state = {
    pairs: 8, cards: [], flipped: [], matched: 0, moves: 0,
    timer: null, seconds: 0, running: false, locked: false, active: false
  };

  let els = {};

  function readAll() {
    const all = DB.get('gameHighscores', {});
    if (!all.memory) all.memory = {};
    return all;
  }

  function fmtTime(seconds) {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function startTimer() {
    if (!state.running) {
      state.running = true;
      state.timer = setInterval(() => { state.seconds++; renderStats(); }, 1000);
    }
  }
  function stopTimer() {
    clearInterval(state.timer);
    state.timer = null;
    state.running = false;
  }

  function renderStats() {
    els.stats.innerHTML = `
      <div class="memory-stat"><span class="memory-stat-label">Zeit</span><span class="memory-stat-value">${fmtTime(state.seconds)}</span></div>
      <div class="memory-stat"><span class="memory-stat-label">Züge</span><span class="memory-stat-value">${state.moves}</span></div>
      <div class="memory-stat"><span class="memory-stat-label">Paare</span><span class="memory-stat-value">${state.matched}/${state.pairs}</span></div>`;
  }

  function renderBoard() {
    els.board.innerHTML = '';
    const total = state.pairs * 2;
    const cols = total <= 6 ? 3 : total <= 12 ? 4 : 5;
    els.board.style.gridTemplateColumns = `repeat(${cols}, 70px)`;

    state.cards.forEach((card, idx) => {
      const el = document.createElement('div');
      el.className = 'mem-card' + (card.flipped || card.matched ? ' flipped' : '') + (card.matched ? ' matched' : '');
      el.innerHTML = `<div class="mem-card-inner"><div class="mem-card-front">?</div><div class="mem-card-back">${card.emoji}</div></div>`;
      if (!card.matched) el.addEventListener('click', () => flip(idx));
      els.board.appendChild(el);
    });
  }

  function showSetup() {
    state.active = false;
    els.setup.classList.remove('hidden');
    els.game.classList.add('hidden');
    els.done.classList.add('hidden');
    state.flipped = []; state.matched = 0; state.moves = 0; state.seconds = 0;
    state.running = false; state.locked = false;
  }

  function start() {
    state.pairs = parseInt(els.slider.value);
    state.flipped = []; state.matched = 0; state.moves = 0; state.seconds = 0;
    state.running = false; state.locked = false; state.active = true;
    stopTimer();

    const emojis = MEMORY_EMOJIS.slice(0, state.pairs);
    const deck = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    state.cards = deck.map((e, i) => ({ id: i, emoji: e, flipped: false, matched: false }));

    els.setup.classList.add('hidden');
    els.game.classList.remove('hidden');
    els.done.classList.add('hidden');
    renderStats();
    renderBoard();
  }

  function flip(idx) {
    if (state.locked) return;
    const card = state.cards[idx];
    if (card.flipped || card.matched) return;

    startTimer();
    card.flipped = true;
    state.flipped.push(idx);
    renderBoard();

    if (state.flipped.length === 2) {
      state.moves++;
      state.locked = true;
      const [a, b] = state.flipped;
      if (state.cards[a].emoji === state.cards[b].emoji) {
        state.cards[a].matched = state.cards[b].matched = true;
        state.matched++; state.flipped = []; state.locked = false;
        renderBoard(); renderStats();
        if (state.matched === state.pairs) finish();
      } else {
        setTimeout(() => {
          state.cards[a].flipped = state.cards[b].flipped = false;
          state.flipped = []; state.locked = false;
          renderBoard(); renderStats();
        }, 900);
      }
    }
  }

  function finish() {
    stopTimer();
    state.active = false;

    const key = `p${state.pairs}`;
    const all = readAll();
    const prev = all.memory[key];
    let newBest = false;
    if (!prev || state.seconds < prev.seconds || (state.seconds === prev.seconds && state.moves < prev.moves)) {
      all.memory[key] = { seconds: state.seconds, moves: state.moves };
      DB.set('gameHighscores', all);
      newBest = true;
    }

    els.done.className = 'memory-done-new';
    els.done.innerHTML = `
      <div class="memory-done-title">🎉 Geschafft!</div>
      <div class="memory-done-stats">
        ${fmtTime(state.seconds)} &middot; ${state.moves} Züge
        ${newBest ? '<span class="memory-new-best">&nbsp;🏆 Neuer Rekord!</span>' : ''}
      </div>
      <div class="memory-done-btns">
        <button class="game-toggle-btn active" id="memory-again-el">Nochmal</button>
        <button class="game-toggle-btn" id="memory-settings-el">Einstellungen</button>
      </div>`;
    els.game.classList.add('hidden');
    els.done.classList.remove('hidden');
    els.done.querySelector('#memory-again-el').addEventListener('click', start);
    els.done.querySelector('#memory-settings-el').addEventListener('click', showSetup);
  }

  // ---- Lifecycle (wird vom Hub aufgerufen) ----

  function mount(container) {
    container.innerHTML = `
      <div id="memory-setup-el">
        <div class="game-setting-group">
          <span class="game-setting-label">Paare: <span id="memory-pairs-label-el">8</span></span>
          <input type="range" min="4" max="20" step="2" value="8" id="memory-pairs-slider-el" class="memory-slider"/>
        </div>
        <button class="game-action-btn" id="memory-start-el">Spiel starten</button>
      </div>
      <div id="memory-game-el" class="hidden">
        <div class="memory-top">
          <div class="memory-stats" id="memory-stats-el"></div>
          <button class="game-toggle-btn" id="memory-abort-el">Abbrechen</button>
        </div>
        <div class="memory-board" id="memory-board-el"></div>
      </div>
      <div id="memory-done-el" class="hidden"></div>
    `;

    els = {
      setup: container.querySelector('#memory-setup-el'),
      game: container.querySelector('#memory-game-el'),
      done: container.querySelector('#memory-done-el'),
      slider: container.querySelector('#memory-pairs-slider-el'),
      label: container.querySelector('#memory-pairs-label-el'),
      stats: container.querySelector('#memory-stats-el'),
      board: container.querySelector('#memory-board-el')
    };

    els.slider.addEventListener('input', () => {
      els.label.textContent = els.slider.value;
      state.pairs = parseInt(els.slider.value);
    });
    container.querySelector('#memory-start-el').addEventListener('click', start);
    container.querySelector('#memory-abort-el').addEventListener('click', () => { stopTimer(); showSetup(); });

    showSetup();
  }

  function destroy() {
    // Wichtig: laufenden Timer abbrechen, sonst zählt er im Hintergrund weiter.
    stopTimer();
  }

  window.registerGame({
    id: 'memory',
    mount,
    destroy
  });

})();
