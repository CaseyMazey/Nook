// =========================
// SPIEL-LOGIK: SNAKE
// Wird erst beim ersten Klick auf "Spielen" geladen.
// Ergänzt die bereits über manifest.js registrierte Karte um mount/destroy.
// =========================

(function () {

  const CELL = 20, SIZE = 380;

  const state = {
    body: [], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, food: { x: 0, y: 0 },
    score: 0, running: false, interval: null, speed: 150, canvas: null, ctx: null
  };

  let els = {};
  let keyHandler = null;

  function reset() {
    state.body = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }];
    state.dir = { x: 1, y: 0 };
    state.nextDir = { x: 1, y: 0 };
    state.score = 0;
    state.speed = 150;
    state.running = false;
    placeFood();
    els.status.textContent = '';
    els.hint.style.display = '';
  }

  function placeFood() {
    const cells = SIZE / CELL;
    let pos;
    do { pos = { x: Math.floor(Math.random() * cells), y: Math.floor(Math.random() * cells) }; }
    while (state.body.some(s => s.x === pos.x && s.y === pos.y));
    state.food = pos;
  }

  function start() {
    if (state.running) return;
    state.running = true;
    els.hint.style.display = 'none';
    state.interval = setInterval(tick, state.speed);
  }

  function stop() {
    clearInterval(state.interval);
    state.running = false;
  }

  function tick() {
    state.dir = { ...state.nextDir };
    const cells = SIZE / CELL;
    const head = { x: state.body[0].x + state.dir.x, y: state.body[0].y + state.dir.y };

    if (head.x < 0 || head.x >= cells || head.y < 0 || head.y >= cells) { gameOver(); return; }
    if (state.body.some(s => s.x === head.x && s.y === head.y)) { gameOver(); return; }

    state.body.unshift(head);

    if (head.x === state.food.x && head.y === state.food.y) {
      state.score += 10;
      if (state.score % 50 === 0 && state.speed > 60) {
        stop();
        state.speed = Math.max(60, state.speed - 15);
        state.running = false;
        start();
      }
      placeFood();
    } else {
      state.body.pop();
    }

    draw();
    els.status.textContent = `Punkte: ${state.score}`;
  }

  function gameOver() {
    stop();

    const all = DB.get('gameHighscores', {});
    // Altes Format war eine reine Zahl — nicht-destruktiv migrieren.
    const prev = typeof all.snake === 'number' ? { best: all.snake, totalGames: 0 } : (all.snake || { best: 0, totalGames: 0 });

    const isNew = state.score > (prev.best || 0);
    all.snake = {
      best: isNew ? state.score : (prev.best || 0),
      totalGames: (prev.totalGames || 0) + 1
    };
    DB.set('gameHighscores', all);

    els.status.innerHTML = `Game Over! &nbsp;<strong>${state.score} Punkte</strong>${isNew ? ' 🏆' : ''}`;
    draw(true);
  }

  function draw(dead = false) {
    const ctx = state.ctx, cs = CELL, size = SIZE;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = isDark ? '#1e1e1e' : '#f7f7f5';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    for (let x = cs / 2; x < size; x += cs) for (let y = cs / 2; y < size; y += cs) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(state.food.x * cs + 3, state.food.y * cs + 3, cs - 6, cs - 6, 4);
    ctx.fill();

    state.body.forEach((seg, i) => {
      if (dead) ctx.fillStyle = isDark ? '#444' : '#ccc';
      else if (i === 0) ctx.fillStyle = isDark ? '#f0f0ee' : '#1a1a1a';
      else { const t = Math.max(0.2, 1 - i / state.body.length); ctx.fillStyle = isDark ? `rgba(180,180,180,${t})` : `rgba(30,30,30,${t})`; }
      ctx.beginPath();
      ctx.roundRect(seg.x * cs + 2, seg.y * cs + 2, cs - 4, cs - 4, i === 0 ? cs / 2 - 1 : 4);
      ctx.fill();
    });
  }

  function handleKey(e) {
    const map = {
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
      W: { x: 0, y: -1 }, S: { x: 0, y: 1 }, A: { x: -1, y: 0 }, D: { x: 1, y: 0 }
    };
    if (e.key === ' ') { e.preventDefault(); if (!state.running) start(); return; }
    if (map[e.key]) {
      e.preventDefault();
      const nd = map[e.key];
      if (nd.x === -state.dir.x && nd.y === -state.dir.y) return;
      state.nextDir = nd;
      if (!state.running) start();
    }
  }

  // ---- Lifecycle (wird vom Hub aufgerufen) ----

  function mount(container) {
    container.innerHTML = `
      <div class="snake-wrap">
        <canvas id="snake-canvas-el" width="${SIZE}" height="${SIZE}" class="snake-canvas"></canvas>
        <div class="snake-status" id="snake-status-el"></div>
        <div class="snake-hint" id="snake-hint-el">Leertaste oder Pfeiltasten zum Starten</div>
        <button class="game-action-btn" id="snake-reset-el">Neu starten</button>
      </div>
    `;

    els = {
      canvas: container.querySelector('#snake-canvas-el'),
      status: container.querySelector('#snake-status-el'),
      hint: container.querySelector('#snake-hint-el')
    };
    state.canvas = els.canvas;
    state.ctx = els.canvas.getContext('2d');

    container.querySelector('#snake-reset-el').addEventListener('click', () => { stop(); reset(); draw(); });

    // Tastatur-Listener nur, solange Snake im Modal offen ist (siehe destroy()).
    keyHandler = handleKey;
    document.addEventListener('keydown', keyHandler);

    reset();
    draw();
  }

  function destroy() {
    // Wichtig: laufende Spielschleife und globalen Tastatur-Listener entfernen,
    // sonst läuft Snake im Hintergrund weiter, wenn das Modal geschlossen wird.
    stop();
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
  }

  window.registerGame({
    id: 'snake',
    mount,
    destroy
  });

})();
