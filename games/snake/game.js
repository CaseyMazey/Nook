// ==========================================
// SNAKE — games/snake/game.js
// Self-contained plugin: rendert eigenes HTML,
// registriert sich beim GameHub
// ==========================================

(function () {

  // ---- Konstanten ----
  const CELL  = 20;
  const SIZE  = 380;
  const CELLS = SIZE / CELL; // 19

  // ---- State ----
  const s = {
    body:     [],
    dir:      { x: 1, y: 0 },
    nextDir:  { x: 1, y: 0 },
    food:     { x: 0, y: 0 },
    score:    0,
    running:  false,
    interval: null,
    speed:    150,
    canvas:   null,
    ctx:      null,
    initialized: false,
    // Keyboard handler reference for cleanup
    _keyHandler: null
  };

  // ---- HTML ----
  function buildHTML() {
    return `
      <div class="game-card-title-block" style="padding:24px 28px 0;">
        <h2 class="game-card-title">Snake</h2>
        <p class="game-card-sub">Fris das Essen, werde länger, überlebe.</p>
      </div>

      <div class="snake-area">
        <div class="snake-left">
          <div id="snake-status" class="snake-status-new"></div>
          <canvas id="snake-canvas" width="${SIZE}" height="${SIZE}"></canvas>
          <div id="snake-hint" class="snake-hint-new">
            Pfeiltasten oder WASD &middot; Leertaste zum Starten
          </div>
          <button class="game-action-btn" id="snake-reset-btn"
            style="margin:0 28px 24px;">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M2 7.5A5.5 5.5 0 0 1 12.5 4M2 7.5l2-2M2 7.5l2 2"
                stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Neues Spiel starten
          </button>
        </div>

        <div class="snake-right">
          <div class="game-setting-label" style="margin-bottom:12px;">Steuerung</div>
          <div class="snake-controls-grid">
            <div></div>
            <div class="snake-key">↑ W</div>
            <div></div>
            <div class="snake-key">← A</div>
            <div class="snake-key">↓ S</div>
            <div class="snake-key">→ D</div>
          </div>
          <div class="snake-key snake-key-space" style="margin-top:12px;">
            Leertaste — Start
          </div>
        </div>
      </div>
    `;
  }

  // ---- Init (einmalig) ----
  function init(container) {
    if (s.initialized) return;
    s.initialized = true;

    container.innerHTML = buildHTML();

    s.canvas = container.querySelector('#snake-canvas');
    s.ctx    = s.canvas.getContext('2d');

    container.querySelector('#snake-reset-btn').addEventListener('click', () => {
      stop();
      reset(container);
      draw();
    });

    // Keyboard handler — gespeichert für späteres removeEventListener
    s._keyHandler = (e) => handleKey(e, container);
    document.addEventListener('keydown', s._keyHandler);

    reset(container);
    draw();
  }

  // ---- Mount: nichts Besonderes nötig ----
  function mount() {}

  // ---- Destroy: Keyboard-Listener entfernen, Timer stoppen ----
  function destroy() {
    stop();
    if (s._keyHandler) {
      document.removeEventListener('keydown', s._keyHandler);
      s._keyHandler = null;
      s.initialized = false; // erlaubt Re-Init bei erneutem Öffnen
    }
  }

  // ---- Keyboard-Handler ----
  function handleKey(e, container) {
    // Nur reagieren wenn Snake aktives Spiel ist
    if (window.GameHub && window.GameHub.activeGame !== 'snake') return;

    const dirMap = {
      ArrowUp:    { x: 0, y: -1 }, ArrowDown:  { x: 0, y: 1 },
      ArrowLeft:  { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 }, s: { x: 0, y: 1 },
      a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
      W: { x: 0, y: -1 }, S: { x: 0, y: 1 },
      A: { x: -1, y: 0 }, D: { x: 1, y: 0 }
    };

    if (e.key === ' ') {
      e.preventDefault();
      if (!s.running) start();
      return;
    }

    const nd = dirMap[e.key];
    if (nd) {
      e.preventDefault();
      // Entgegengesetzte Richtung blockieren
      if (nd.x === -s.dir.x && nd.y === -s.dir.y) return;
      s.nextDir = nd;
      if (!s.running) start();
    }
  }

  // ---- Reset ----
  function reset(container) {
    s.body    = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }];
    s.dir     = { x: 1, y: 0 };
    s.nextDir = { x: 1, y: 0 };
    s.score   = 0;
    s.speed   = 150;
    s.running = false;
    placeFood();

    const c   = container || document.getElementById('game-snake');
    const status = c && c.querySelector('#snake-status');
    const hint   = c && c.querySelector('#snake-hint');
    if (status) status.textContent = '';
    if (hint)   hint.style.display = '';
  }

  // ---- Futter platzieren ----
  function placeFood() {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * CELLS),
        y: Math.floor(Math.random() * CELLS)
      };
    } while (s.body.some(b => b.x === pos.x && b.y === pos.y));
    s.food = pos;
  }

  // ---- Spiel starten / stoppen ----
  function start() {
    if (s.running) return;
    s.running  = true;
    const c    = document.getElementById('game-snake');
    const hint = c && c.querySelector('#snake-hint');
    if (hint) hint.style.display = 'none';
    s.interval = setInterval(tick, s.speed);
  }

  function stop() {
    clearInterval(s.interval);
    s.interval = null;
    s.running  = false;
  }

  // ---- Spielschritt ----
  function tick() {
    s.dir = { ...s.nextDir };
    const head = { x: s.body[0].x + s.dir.x, y: s.body[0].y + s.dir.y };

    // Wandkollision
    if (head.x < 0 || head.x >= CELLS || head.y < 0 || head.y >= CELLS) {
      gameOver(); return;
    }
    // Selbstkollision
    if (s.body.some(b => b.x === head.x && b.y === head.y)) {
      gameOver(); return;
    }

    s.body.unshift(head);

    if (head.x === s.food.x && head.y === s.food.y) {
      s.score += 10;
      // Alle 50 Punkte schneller
      if (s.score % 50 === 0 && s.speed > 60) {
        stop();
        s.speed = Math.max(60, s.speed - 15);
        s.running = false;
        start();
      }
      placeFood();
    } else {
      s.body.pop();
    }

    draw();

    const c      = document.getElementById('game-snake');
    const status = c && c.querySelector('#snake-status');
    if (status) status.textContent = `Punkte: ${s.score}`;
  }

  // ---- Game Over ----
  function gameOver() {
    stop();
    const isNew = s.score > (window.gameHighscores.snake || 0);
    if (isNew) {
      window.gameHighscores.snake = s.score;
      window.saveHighscores();
      window.renderAllHighscores();
    }
    const c      = document.getElementById('game-snake');
    const status = c && c.querySelector('#snake-status');
    if (status) {
      status.innerHTML =
        `Game Over! &nbsp;<strong>${s.score} Punkte</strong>${isNew ? ' 🏆' : ''}`;
    }
    draw(true);
  }

  // ---- Canvas zeichnen ----
  function draw(dead = false) {
    if (!s.ctx) return;
    const ctx    = s.ctx;
    const cs     = CELL;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Hintergrund
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = isDark ? '#1e1e1e' : '#f7f7f5';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Gitter-Punkte
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    for (let x = cs / 2; x < SIZE; x += cs) {
      for (let y = cs / 2; y < SIZE; y += cs) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Futter
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(s.food.x * cs + 3, s.food.y * cs + 3, cs - 6, cs - 6, 4);
    ctx.fill();

    // Schlange
    s.body.forEach((seg, i) => {
      if (dead) {
        ctx.fillStyle = isDark ? '#444' : '#ccc';
      } else if (i === 0) {
        ctx.fillStyle = isDark ? '#f0f0ee' : '#1a1a1a';
      } else {
        const t = Math.max(0.2, 1 - i / s.body.length);
        ctx.fillStyle = isDark
          ? `rgba(180,180,180,${t})`
          : `rgba(30,30,30,${t})`;
      }
      ctx.beginPath();
      ctx.roundRect(
        seg.x * cs + 2, seg.y * cs + 2,
        cs - 4, cs - 4,
        i === 0 ? cs / 2 - 1 : 4
      );
      ctx.fill();
    });
  }

  // ---- Highscore-Wert für Panel ----
  function getHighscore() {
    const best = window.gameHighscores.snake || 0;
    return best > 0 ? best : '—';
  }

  // ---- Registrierung ----
  // Meta-Infos kommen aus manifest.json
  window.registerGame({
    id: 'snake',
    init,
    mount,
    destroy,
    getHighscore
  });

})();