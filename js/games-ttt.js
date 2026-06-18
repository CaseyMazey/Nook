// =========================
// GAME: TIC-TAC-TOE
// Registriert sich selbst bei window.GameHub über registerGame().
// Wird vom Hub (games.js) in das Play-Modal gemountet.
// =========================

(function () {

  const state = {
    board: Array(9).fill(null),
    current: 'X',
    vsAI: true,
    difficulty: 'medium',
    scores: { X: 0, O: 0, draw: 0 },
    gameOver: false
  };

  let els = {};

  // ---- Highscores ----

  function readHighscores() {
    const all = DB.get('gameHighscores', {});
    if (!all.ttt) all.ttt = {};
    return all;
  }

  // ---- Spiellogik ----

  function checkWinner(board) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line: [a, b, c] };
      }
    }
    if (board.every(Boolean)) return { winner: 'draw', line: [] };
    return null;
  }

  function aiMove(board) {
    const empty = board.map((_, i) => i).filter(i => !board[i]);
    if (!empty.length) return -1;

    if (state.difficulty === 'easy'   && Math.random() < 0.85) return empty[Math.floor(Math.random() * empty.length)];
    if (state.difficulty === 'medium' && Math.random() < 0.5)  return empty[Math.floor(Math.random() * empty.length)];
    if (state.difficulty === 'hard'   && Math.random() < 0.2)  return empty[Math.floor(Math.random() * empty.length)];

    for (const i of empty) { const b = [...board]; b[i] = 'O'; if (checkWinner(b)?.winner === 'O') return i; }
    for (const i of empty) { const b = [...board]; b[i] = 'X'; if (checkWinner(b)?.winner === 'X') return i; }
    if (!board[4]) return 4;
    const corners = [0, 2, 6, 8].filter(i => !board[i]);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // ---- Render ----

  function render() {
    const result = checkWinner(state.board);

    els.board.innerHTML = '';
    state.board.forEach((cell, i) => {
      const btn = document.createElement('button');
      btn.className = 'ttt-cell'
        + (cell ? ` filled ${cell === 'X' ? 'x-cell' : 'o-cell'}` : '')
        + (result?.line?.includes(i) ? ' winning' : '');
      btn.textContent = cell || '';
      btn.disabled = !!cell || !!result || state.gameOver;
      btn.addEventListener('click', () => handleCellClick(i));
      els.board.appendChild(btn);
    });

    if (result) {
      els.status.textContent = result.winner === 'draw' ? 'Unentschieden 🤝' : `Spieler ${result.winner} gewinnt! 🎉`;
      els.status.className = 'ttt-status-new win';
    } else {
      const cls = state.current === 'X' ? 'ttt-turn-x' : 'ttt-turn-o';
      els.status.innerHTML = `<span class="${cls}">Spieler ${state.current}</span>&nbsp;ist dran`;
      els.status.className = 'ttt-status-new';
    }

    els.score.innerHTML = `
      <span class="ttt-score-x">✕ ${state.scores.X || 0}</span>
      <span class="ttt-score-sep">—</span>
      <span>${state.scores.draw || 0}</span>
      <span class="ttt-score-sep">—</span>
      <span class="ttt-score-o">○ ${state.scores.O || 0}</span>`;
  }

  function handleCellClick(i) {
    if (state.board[i] || state.gameOver) return;
    state.board[i] = state.current;

    const r = checkWinner(state.board);
    if (r) { handleEnd(r); render(); return; }

    state.current = state.current === 'X' ? 'O' : 'X';
    render();

    if (state.vsAI && state.current === 'O' && !checkWinner(state.board)) {
      setTimeout(() => {
        const move = aiMove(state.board);
        if (move === -1) return;
        state.board[move] = 'O';
        const r2 = checkWinner(state.board);
        if (r2) handleEnd(r2); else state.current = 'X';
        render();
      }, 300);
    }
  }

  function handleEnd(r) {
    if (r.winner === 'draw') state.scores.draw++;
    else state.scores[r.winner] = (state.scores[r.winner] || 0) + 1;

    // Nur echte Partien (mit Ergebnis für den Spieler) fließen in die Highscores ein.
    const all = readHighscores();
    all.ttt.totalGames = (all.ttt.totalGames || 0) + 1;
    if (r.winner === 'X') all.ttt.playerWins = (all.ttt.playerWins || 0) + 1;
    DB.set('gameHighscores', all);

    state.gameOver = true;
  }

  function reset() {
    state.board = Array(9).fill(null);
    state.current = 'X';
    state.gameOver = false;
    render();
  }

  function setMode(vsAI) {
    state.vsAI = vsAI;
    els.optAi.classList.toggle('active', vsAI);
    els.optP2.classList.toggle('active', !vsAI);
    els.diffGroup.style.display = vsAI ? '' : 'none';
    reset();
  }

  function setDifficulty(d) {
    state.difficulty = d;
    ['easy', 'medium', 'hard'].forEach(x => els.diff[x].classList.toggle('active', x === d));
    reset();
  }

  // ---- Lifecycle (wird vom Hub aufgerufen) ----

  function mount(container) {
    container.innerHTML = `
      <div class="game-setting-group">
        <span class="game-setting-label">Modus</span>
        <div class="game-toggle-group">
          <button class="game-toggle-btn active" data-mode="ai">Gegen KI</button>
          <button class="game-toggle-btn" data-mode="p2">2 Spieler</button>
        </div>
      </div>
      <div class="game-setting-group" id="ttt-diff-group">
        <span class="game-setting-label">Schwierigkeit</span>
        <div class="game-toggle-group">
          <button class="game-toggle-btn" data-diff="easy">Leicht</button>
          <button class="game-toggle-btn active" data-diff="medium">Mittel</button>
          <button class="game-toggle-btn" data-diff="hard">Schwer</button>
        </div>
      </div>
      <div class="ttt-status-new" id="ttt-status-el"></div>
      <div class="ttt-board" id="ttt-board-el"></div>
      <div class="ttt-score" id="ttt-score-el"></div>
      <button class="game-action-btn" id="ttt-reset-el">Neues Spiel</button>
    `;

    els = {
      board: container.querySelector('#ttt-board-el'),
      status: container.querySelector('#ttt-status-el'),
      score: container.querySelector('#ttt-score-el'),
      optAi: container.querySelector('[data-mode="ai"]'),
      optP2: container.querySelector('[data-mode="p2"]'),
      diffGroup: container.querySelector('#ttt-diff-group'),
      diff: {
        easy: container.querySelector('[data-diff="easy"]'),
        medium: container.querySelector('[data-diff="medium"]'),
        hard: container.querySelector('[data-diff="hard"]')
      }
    };

    els.optAi.addEventListener('click', () => setMode(true));
    els.optP2.addEventListener('click', () => setMode(false));
    ['easy', 'medium', 'hard'].forEach(d => els.diff[d].addEventListener('click', () => setDifficulty(d)));
    container.querySelector('#ttt-reset-el').addEventListener('click', reset);

    state.board = Array(9).fill(null);
    state.current = 'X';
    state.gameOver = false;
    state.scores = { X: 0, O: 0, draw: 0 };
    render();
  }

  function destroy() {
    // Keine Timer/Intervalle bei TTT — nichts aufzuräumen.
  }

  function getStats() {
    const all = DB.get('gameHighscores', {});
    const wins = all.ttt?.playerWins || 0;
    return { statLabel: 'Siege', statValue: wins, secondaryStat: 'Gewonnen' };
  }

  window.registerGame({
    id: 'ttt',
    title: 'Tic-Tac-Toe',
    description: 'Fordere die KI oder einen Freund heraus!',
    icon: '⭕',
    accent: 'purple',
    mount,
    destroy,
    getStats
  });

})();
