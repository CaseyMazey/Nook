// =========================
// TIC-TAC-TOE — game.js
// Self-contained: renders its own HTML, then registers with GameHub
// =========================

(function () {

  // --- State ---
  const ttt = {
    board: Array(9).fill(null),
    current: 'X', vsAI: true, difficulty: 'medium',
    scores: { X: 0, O: 0, draw: 0 },
    gameOver: false,
    initialized: false
  };

  // --- HTML template ---
  function buildHTML() {
    return `
      <div class="game-card-left">
        <div class="game-card-title-block" style="padding:24px 28px 0;">
          <h2 class="game-card-title">Tic-Tac-Toe</h2>
          <p class="game-card-sub">Klassisches 3×3 Spiel.</p>
        </div>

        <div class="game-setting-group">
          <span class="game-setting-label">Spielmodus</span>
          <div class="game-toggle-group">
            <button class="game-toggle-btn active" id="ttt-opt-ai">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 13c0-3 11-3 11 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
              vs KI
            </button>
            <button class="game-toggle-btn" id="ttt-opt-p2">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5" cy="5" r="2" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="5" r="2" stroke="currentColor" stroke-width="1.4"/><path d="M1 13c0-2.5 4-2.5 4-2.5s4 0 4 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
              vs Spieler 2
            </button>
          </div>
        </div>

        <div class="game-setting-group" id="ttt-diff-group">
          <span class="game-setting-label">Schwierigkeit</span>
          <div class="game-toggle-group">
            <button class="game-toggle-btn" id="ttt-diff-easy">Leicht</button>
            <button class="game-toggle-btn active" id="ttt-diff-medium">Mittel</button>
            <button class="game-toggle-btn" id="ttt-diff-hard">Schwer</button>
          </div>
        </div>
      </div>

      <div class="game-card-right">
        <div id="ttt-status" class="ttt-status-new"></div>
        <div id="ttt-board" class="ttt-board-new"></div>
        <div id="ttt-score" class="ttt-score-new"></div>
      </div>

      <div class="game-card-footer">
        <button class="game-action-btn" id="ttt-reset-btn">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5A5.5 5.5 0 0 1 12.5 4M2 7.5l2-2M2 7.5l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Neues Spiel starten
        </button>
      </div>
    `;
  }

  // --- Init ---
  function init(container) {
    if (ttt.initialized) return;
    ttt.initialized = true;

    container.innerHTML = buildHTML();

    document.getElementById('ttt-opt-ai').addEventListener('click', () => {
      ttt.vsAI = true;
      document.getElementById('ttt-opt-ai').classList.add('active');
      document.getElementById('ttt-opt-p2').classList.remove('active');
      document.getElementById('ttt-diff-group').style.display = '';
      resetTTT();
    });

    document.getElementById('ttt-opt-p2').addEventListener('click', () => {
      ttt.vsAI = false;
      document.getElementById('ttt-opt-p2').classList.add('active');
      document.getElementById('ttt-opt-ai').classList.remove('active');
      document.getElementById('ttt-diff-group').style.display = 'none';
      resetTTT();
    });

    ['easy', 'medium', 'hard'].forEach(d => {
      document.getElementById(`ttt-diff-${d}`).addEventListener('click', () => {
        ttt.difficulty = d;
        ['easy', 'medium', 'hard'].forEach(x =>
          document.getElementById(`ttt-diff-${x}`).classList.toggle('active', x === d)
        );
        resetTTT();
      });
    });

    document.getElementById('ttt-reset-btn').addEventListener('click', resetTTT);
    renderTTT();
  }

  // --- Game logic ---
  function resetTTT() {
    ttt.board = Array(9).fill(null);
    ttt.current = 'X';
    ttt.gameOver = false;
    renderTTT();
  }

  function tttAIMove(board) {
    const empty = board.map((_, i) => i).filter(i => !board[i]);
    if (!empty.length) return -1;
    if (ttt.difficulty === 'easy'   && Math.random() < 0.85) return empty[Math.floor(Math.random() * empty.length)];
    if (ttt.difficulty === 'medium' && Math.random() < 0.5)  return empty[Math.floor(Math.random() * empty.length)];
    if (ttt.difficulty === 'hard'   && Math.random() < 0.2)  return empty[Math.floor(Math.random() * empty.length)];
    for (const i of empty) { const b = [...board]; b[i] = 'O'; if (checkWin(b) === 'O') return i; }
    for (const i of empty) { const b = [...board]; b[i] = 'X'; if (checkWin(b) === 'X') return i; }
    if (!board[4]) return 4;
    const corners = [0, 2, 6, 8].filter(i => !board[i]);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    return empty[Math.floor(Math.random() * empty.length)];
  }

  function checkWin(board) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a, b, c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    return null;
  }

  function checkWinner(board) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a, b, c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line: [a, b, c] };
    if (board.every(Boolean)) return { winner: 'draw', line: [] };
    return null;
  }

  function renderTTT() {
    const boardEl = document.getElementById('ttt-board');
    if (!boardEl) return;
    boardEl.innerHTML = '';

    const result = checkWinner(ttt.board);

    ttt.board.forEach((cell, i) => {
      const btn = document.createElement('button');
      btn.className = 'ttt-cell'
        + (cell ? ` filled ${cell === 'X' ? 'x-cell' : 'o-cell'}` : '')
        + (result?.line?.includes(i) ? ' winning' : '');
      btn.textContent = cell || '';
      btn.disabled = !!cell || !!result || ttt.gameOver;
      btn.addEventListener('click', () => {
        if (ttt.board[i] || ttt.gameOver) return;
        ttt.board[i] = ttt.current;
        const r = checkWinner(ttt.board);
        if (r) { handleEnd(r); renderTTT(); return; }
        ttt.current = ttt.current === 'X' ? 'O' : 'X';
        renderTTT();
        if (ttt.vsAI && ttt.current === 'O' && !checkWinner(ttt.board)) {
          setTimeout(() => {
            const move = tttAIMove(ttt.board);
            if (move === -1) return;
            ttt.board[move] = 'O';
            const r2 = checkWinner(ttt.board);
            if (r2) handleEnd(r2); else ttt.current = 'X';
            renderTTT();
          }, 300);
        }
      });
      boardEl.appendChild(btn);
    });

    const status = document.getElementById('ttt-status');
    if (result) {
      status.textContent = result.winner === 'draw' ? 'Unentschieden 🤝' : `Spieler ${result.winner} gewinnt! 🎉`;
      status.className = 'ttt-status-new win';
    } else {
      const cls = ttt.current === 'X' ? 'ttt-turn-x' : 'ttt-turn-o';
      status.innerHTML = `<span class="${cls}">Spieler ${ttt.current}</span>&nbsp;ist dran`;
      status.className = 'ttt-status-new';
    }

    const scoreEl = document.getElementById('ttt-score');
    if (scoreEl) {
      scoreEl.innerHTML = `
        <span class="ttt-score-x">✕ ${ttt.scores.X || 0}</span>
        <span class="ttt-score-sep">—</span>
        <span>${ttt.scores.draw || 0}</span>
        <span class="ttt-score-sep">—</span>
        <span class="ttt-score-o">○ ${ttt.scores.O || 0}</span>`;
    }
  }

  function handleEnd(r) {
    if (r.winner === 'draw') ttt.scores.draw++;
    else ttt.scores[r.winner] = (ttt.scores[r.winner] || 0) + 1;

    const hs = window.gameHighscores.ttt || {};
    hs.totalGames = (hs.totalGames || 0) + 1;
    if (r.winner === 'X') hs.playerWins = (hs.playerWins || 0) + 1;
    window.gameHighscores.ttt = hs;
    window.saveHighscores();
    window.renderAllHighscores();
    ttt.gameOver = true;
  }

  function destroy() {
    // Nothing persistent to clean up for TTT
  }

  function getHighscore() {
    const hs = window.gameHighscores.ttt || {};
    return hs.playerWins > 0 ? hs.playerWins : '—';
  }

  // --- Register ---
  // Meta-Infos (name, icon, highscoreLabel) kommen aus manifest.json
  // Hier nur noch die Spiellogik registrieren.
  window.registerGame({
    id: 'ttt',
    init,
    destroy,
    getHighscore
  });

})();
