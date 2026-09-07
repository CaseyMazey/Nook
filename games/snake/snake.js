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
    // Migrations-/Lese-Logik lebt zentral in manifest.js (readSnakeStats),
    // das vor snake.js lädt — nicht hier nochmal duplizieren.
    const prev = readSnakeStats(all);

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

  // Gemeinsamer Richtungswechsel für Tastatur, Touch-Kreuz und Swipe-Gesten.
  // Eine 180°-Wende wird ignoriert (state.nextDir bleibt unverändert), aber
  // das Spiel muss trotzdem starten — sonst bleibt ein erster Tap auf die
  // "Gegenrichtung" (z.B. "Links" direkt nach dem Öffnen, während die
  // Schlange nach rechts startet) wirkungslos, ohne jedes Feedback.
  function setDirection(nd) {
    if (!nd) return;
    const reversed = nd.x === -state.dir.x && nd.y === -state.dir.y;
    if (!reversed) state.nextDir = nd;
    if (!state.running) start();
  }

  const DIR_MAP = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

  function handleKey(e) {
    const map = {
      ArrowUp: DIR_MAP.up, ArrowDown: DIR_MAP.down, ArrowLeft: DIR_MAP.left, ArrowRight: DIR_MAP.right,
      w: DIR_MAP.up, s: DIR_MAP.down, a: DIR_MAP.left, d: DIR_MAP.right,
      W: DIR_MAP.up, S: DIR_MAP.down, A: DIR_MAP.left, D: DIR_MAP.right
    };
    if (e.key === ' ') { e.preventDefault(); if (!state.running) start(); return; }
    if (map[e.key]) {
      e.preventDefault();
      setDirection(map[e.key]);
    }
  }

  // Swipe-Erkennung auf dem Canvas selbst — die Achse mit der größeren
  // Auslenkung bestimmt die Richtung, kurze Taps (< 20px) werden ignoriert.
  let touchStart = null;

  function handleTouchStart(e) {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e) {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR_MAP.right : DIR_MAP.left) : (dy > 0 ? DIR_MAP.down : DIR_MAP.up));
  }

  // ---- Lifecycle (wird vom Hub aufgerufen) ----

  function mount(container) {
    container.innerHTML = `
      <div class="snake-wrap">
        <canvas id="snake-canvas-el" width="${SIZE}" height="${SIZE}" class="snake-canvas"></canvas>
        <div class="snake-status" id="snake-status-el"></div>
        <div class="snake-hint" id="snake-hint-el">Leertaste/Pfeiltasten zum Starten, auf dem Handy wischen oder das Kreuz nutzen</div>
        <div class="snake-touch-controls">
          <button class="snake-touch-btn snake-touch-up" data-dir="up" aria-label="Hoch">▲</button>
          <button class="snake-touch-btn snake-touch-left" data-dir="left" aria-label="Links">◀</button>
          <button class="snake-touch-btn snake-touch-down" data-dir="down" aria-label="Runter">▼</button>
          <button class="snake-touch-btn snake-touch-right" data-dir="right" aria-label="Rechts">▶</button>
        </div>
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

    // "pointer: coarse" allein erkennt Touch nicht auf jedem Gerät zuverlässig
    // (siehe snake.css) — zusätzlich per JS prüfen und das Touch-Kreuz notfalls
    // erzwingen, sonst haben Nutzer ohne Tastatur keinerlei Steuerung.
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      container.querySelector('.snake-wrap').classList.add('has-touch');
    }

    container.querySelector('#snake-reset-el').addEventListener('click', () => { stop(); reset(); draw(); });

    els.canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    els.canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.querySelectorAll('.snake-touch-btn').forEach(btn => {
      btn.addEventListener('click', () => setDirection(DIR_MAP[btn.dataset.dir]));
    });

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
