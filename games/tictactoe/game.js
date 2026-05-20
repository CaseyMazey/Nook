window.TicTacToeGame = (() => {
// =========================
// TIC-TAC-TOE
// =========================

const ttt = {
  board: Array(9).fill(null),
  current: 'X', vsAI: true, difficulty: 'medium',
  scores: {X:0,O:0,draw:0}, gameOver: false, initialized: false
};

function initTTT(){
  if(ttt.initialized){ return; }
  ttt.initialized = true;

  document.getElementById('ttt-opt-ai').addEventListener('click',()=>{
    ttt.vsAI=true;
    document.getElementById('ttt-opt-ai').classList.add('active');
    document.getElementById('ttt-opt-p2').classList.remove('active');
    document.getElementById('ttt-diff-group').style.display='';
    resetTTT();
  });
  document.getElementById('ttt-opt-p2').addEventListener('click',()=>{
    ttt.vsAI=false;
    document.getElementById('ttt-opt-p2').classList.add('active');
    document.getElementById('ttt-opt-ai').classList.remove('active');
    document.getElementById('ttt-diff-group').style.display='none';
    resetTTT();
  });

  ['easy','medium','hard'].forEach(d=>{
    document.getElementById(`ttt-diff-${d}`).addEventListener('click',()=>{
      ttt.difficulty=d;
      ['easy','medium','hard'].forEach(x=>
        document.getElementById(`ttt-diff-${x}`).classList.toggle('active',x===d));
      resetTTT();
    });
  });

  document.getElementById('ttt-reset-btn').addEventListener('click', resetTTT);
  renderTTT();
}

function resetTTT(){
  ttt.board=Array(9).fill(null); ttt.current='X'; ttt.gameOver=false;
  renderTTT();
}

function tttAIMove(board){
  const empty=board.map((_,i)=>i).filter(i=>!board[i]);
  if(!empty.length) return -1;
  if(ttt.difficulty==='easy'   && Math.random()<0.85) return empty[Math.floor(Math.random()*empty.length)];
  if(ttt.difficulty==='medium' && Math.random()<0.5)  return empty[Math.floor(Math.random()*empty.length)];
  if(ttt.difficulty==='hard'   && Math.random()<0.2)  return empty[Math.floor(Math.random()*empty.length)];
  for(const i of empty){ const b=[...board]; b[i]='O'; if(checkTTTWin(b)==='O') return i; }
  for(const i of empty){ const b=[...board]; b[i]='X'; if(checkTTTWin(b)==='X') return i; }
  if(!board[4]) return 4;
  const corners=[0,2,6,8].filter(i=>!board[i]);
  if(corners.length) return corners[Math.floor(Math.random()*corners.length)];
  return empty[Math.floor(Math.random()*empty.length)];
}

function checkTTTWin(board){
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const [a,b,c] of lines) if(board[a]&&board[a]===board[b]&&board[a]===board[c]) return board[a];
  return null;
}
function checkTTTWinner(board){
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const [a,b,c] of lines) if(board[a]&&board[a]===board[b]&&board[a]===board[c]) return {winner:board[a],line:[a,b,c]};
  if(board.every(Boolean)) return {winner:'draw',line:[]};
  return null;
}

function renderTTT(){
  const boardEl = document.getElementById('ttt-board'); boardEl.innerHTML='';
  const result = checkTTTWinner(ttt.board);

  ttt.board.forEach((cell,i)=>{
    const btn = document.createElement('button');
    btn.className = 'ttt-cell'
      + (cell ? ` filled ${cell==='X'?'x-cell':'o-cell'}` : '')
      + (result?.line?.includes(i) ? ' winning' : '');
    btn.textContent = cell||'';
    btn.disabled = !!cell||!!result||ttt.gameOver;
    btn.addEventListener('click',()=>{
      if(ttt.board[i]||ttt.gameOver) return;
      ttt.board[i]=ttt.current;
      const r=checkTTTWinner(ttt.board);
      if(r){ handleTTTEnd(r); renderTTT(); return; }
      ttt.current=ttt.current==='X'?'O':'X';
      renderTTT();
      if(ttt.vsAI&&ttt.current==='O'&&!checkTTTWinner(ttt.board)){
        setTimeout(()=>{
          const move=tttAIMove(ttt.board); if(move===-1) return;
          ttt.board[move]='O';
          const r2=checkTTTWinner(ttt.board);
          if(r2) handleTTTEnd(r2); else ttt.current='X';
          renderTTT();
        },300);
      }
    });
    boardEl.appendChild(btn);
  });

  const status = document.getElementById('ttt-status');
  if(result){
    status.textContent = result.winner==='draw' ? 'Unentschieden 🤝' : `Spieler ${result.winner} gewinnt! 🎉`;
    status.className='ttt-status-new win';
  } else {
    const cls = ttt.current==='X'?'ttt-turn-x':'ttt-turn-o';
    status.innerHTML=`<span class="${cls}">Spieler ${ttt.current}</span>&nbsp;ist dran`;
    status.className='ttt-status-new';
  }

  document.getElementById('ttt-score').innerHTML=`
    <span class="ttt-score-x">✕ ${ttt.scores.X||0}</span>
    <span class="ttt-score-sep">—</span>
    <span>${ttt.scores.draw||0}</span>
    <span class="ttt-score-sep">—</span>
    <span class="ttt-score-o">○ ${ttt.scores.O||0}</span>`;
}

function handleTTTEnd(r){
  if(r.winner==='draw') ttt.scores.draw++;
  else ttt.scores[r.winner]=(ttt.scores[r.winner]||0)+1;
  const hs=window.gameHighscores.ttt;
  hs.totalGames=(hs.totalGames||0)+1;
  if(r.winner==='X') hs.playerWins=(hs.playerWins||0)+1;
  window.saveHighscores();
  window.renderAllHighscores();
  ttt.gameOver=true;
}
return {
  initTTT,
  resetTTT,
  renderTTT
};

})();