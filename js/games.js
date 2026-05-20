// =========================
// GAMES
// =========================

let activeGame = 'ttt';
let gameHighscores = DB.get('gameHighscores', { ttt: {}, memory: {}, snake: 0 });
function saveHighscores(){ DB.set('gameHighscores', gameHighscores); }
window.gameHighscores = gameHighscores;
window.saveHighscores = saveHighscores;
window.renderAllHighscores = renderAllHighscores;

function initGames(){
  document.querySelectorAll('.games-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const g = btn.dataset.game;
      if(activeGame==='memory' && g!=='memory') pauseMemoryTimer();
      activeGame = g;
      document.querySelectorAll('.games-tab').forEach(b=>b.classList.toggle('active',b===btn));
      document.querySelectorAll('.game-card').forEach(p=>p.classList.toggle('hidden',p.id!==`game-${g}`));
      if(g==='ttt')    { initTTT();    window.TicTacToeGame.initTTT(); }
      if(g==='memory') { initMemory(); resumeMemoryTimer(); renderMemoryHighscores(); }
      if(g==='snake')  { initSnake();  renderAllHighscores(); }
    });
  });
  window.TicTacToeGame.initTTT();
  renderAllHighscores();
}

function fmtTime(seconds){
  const m=Math.floor(seconds/60), s=seconds%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function renderAllHighscores(){
  const panel = document.querySelector('.games-hs-panel');
  panel.innerHTML = `
    <div class="games-hs-title">🏆 Highscores</div>
    <div id="games-hs-ttt" class="games-hs-entry">
      <div class="games-hs-icon ttt-icon"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 6h14M2 12h14M6 2v14M12 2v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
      <div class="games-hs-info"><div class="games-hs-game">Tic-Tac-Toe</div><div class="games-hs-desc">Siege als X</div></div>
      <div class="games-hs-value" id="hs-val-ttt">—</div>
    </div>
    <div id="games-hs-memory" class="games-hs-entry" style="cursor:pointer;" title="Memory Highscores anzeigen">
      <div class="games-hs-icon mem-icon"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.6"/></svg></div>
      <div class="games-hs-info"><div class="games-hs-game">Memory</div><div class="games-hs-desc" id="hs-desc-memory">Beste Zeit</div></div>
      <div class="games-hs-value" id="hs-val-memory">—</div>
    </div>
    <div id="games-hs-snake" class="games-hs-entry">
      <div class="games-hs-icon snake-icon">〜</div>
      <div class="games-hs-info"><div class="games-hs-game">Snake</div><div class="games-hs-desc">Highscore</div></div>
      <div class="games-hs-value" id="hs-val-snake">—</div>
    </div>`;

  // TTT
  const tttHs = gameHighscores.ttt||{};
  document.getElementById('hs-val-ttt').textContent = tttHs.playerWins||'—';

  // Memory summary
  const memHs = gameHighscores.memory||{};
  const memEntries = Object.entries(memHs);
  if(memEntries.length>0){
    const best = memEntries.sort((a,b)=>a[1].seconds-b[1].seconds)[0];
    document.getElementById('hs-val-memory').textContent = fmtTime(best[1].seconds);
    document.getElementById('hs-desc-memory').textContent = `Beste Zeit (${best[0].replace('p','')} Paare)`;
  }

  // Snake
  const snakeBest = gameHighscores.snake||0;
  document.getElementById('hs-val-snake').textContent = snakeBest > 0 ? snakeBest : '—';

  // Click on memory row → show detail board
  document.getElementById('games-hs-memory').addEventListener('click', renderMemoryHighscores);
}

function renderMemoryHighscores(){
  const panel = document.querySelector('.games-hs-panel');
  const memHs = gameHighscores.memory||{};
  const entries = Object.entries(memHs)
    .map(([k,v])=>({pairs:parseInt(k.replace('p','')), ...v}))
    .sort((a,b)=>a.pairs-b.pairs);

  let rows = '';
  if(entries.length===0){
    rows = `<div class="mem-hs-empty">Noch keine Spiele abgeschlossen.</div>`;
  } else {
    rows = entries.map(e=>`
      <div class="mem-hs-row">
        <div class="mem-hs-pairs"><span class="mem-hs-badge">${e.pairs}</span> Paare</div>
        <div class="mem-hs-time">${fmtTime(e.seconds)}</div>
        <div class="mem-hs-moves">${e.moves} Züge</div>
      </div>`).join('');
  }

  panel.innerHTML = `
    <div class="games-hs-title">
      <button class="mem-hs-back" id="mem-hs-back-btn" title="Zurück">←</button>
      Memory Highscores
    </div>
    <div class="mem-hs-header">
      <span>Paare</span><span>Beste Zeit</span><span>Züge</span>
    </div>
    <div class="mem-hs-list">${rows}</div>`;

  document.getElementById('mem-hs-back-btn').addEventListener('click', renderAllHighscores);
}

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
  const hs=gameHighscores.ttt;
  hs.totalGames=(hs.totalGames||0)+1;
  if(r.winner==='X') hs.playerWins=(hs.playerWins||0)+1;
  saveHighscores();
  renderAllHighscores();
  ttt.gameOver=true;
}

// =========================
// MEMORY
// =========================

const MEMORY_EMOJIS=['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🦆','🦅','🦉','🦋'];

const mem = {
  pairs:8, cards:[], flipped:[], matched:0, moves:0,
  timer:null, seconds:0, running:false, initialized:false, locked:false, active:false
};

function initMemory(){
  if(mem.initialized){ return; }
  mem.initialized=true;

  const slider=document.getElementById('memory-pairs-slider');
  const label=document.getElementById('memory-pairs-label');
  slider.addEventListener('input',()=>{ label.textContent=slider.value; mem.pairs=parseInt(slider.value); });

  document.getElementById('memory-start-btn').addEventListener('click', startMemoryGame);
  document.getElementById('memory-reset-btn').addEventListener('click',()=>{ stopMemoryTimer(); showMemorySetup(); });
  document.getElementById('memory-abort-btn').addEventListener('click',()=>{ stopMemoryTimer(); showMemorySetup(); });
}

function showMemorySetup(){
  mem.active=false;
  document.getElementById('memory-setup').classList.remove('hidden');
  document.getElementById('memory-game').classList.add('hidden');
  document.getElementById('memory-done').classList.add('hidden');
  mem.flipped=[]; mem.matched=0; mem.moves=0; mem.seconds=0; mem.running=false; mem.locked=false;
}

function startMemoryGame(){
  mem.pairs=parseInt(document.getElementById('memory-pairs-slider').value);
  mem.flipped=[]; mem.matched=0; mem.moves=0; mem.seconds=0;
  mem.running=false; mem.locked=false; mem.active=true;
  stopMemoryTimer();

  const emojis=MEMORY_EMOJIS.slice(0,mem.pairs);
  const deck=[...emojis,...emojis].sort(()=>Math.random()-0.5);
  mem.cards=deck.map((e,i)=>({id:i,emoji:e,flipped:false,matched:false}));

  document.getElementById('memory-setup').classList.add('hidden');
  document.getElementById('memory-game').classList.remove('hidden');
  document.getElementById('memory-done').classList.add('hidden');
  renderMemoryStats();
  renderMemoryBoard();
}

function pauseMemoryTimer(){
  if(mem.running){ clearInterval(mem.timer); mem.running=false; }
}
function resumeMemoryTimer(){
  if(mem.active && !mem.running && mem.matched<mem.pairs){
    const gameEl=document.getElementById('memory-game');
    if(gameEl && !gameEl.classList.contains('hidden')){
      mem.running=true;
      mem.timer=setInterval(()=>{ mem.seconds++; renderMemoryStats(); },1000);
    }
  }
}
function stopMemoryTimer(){ clearInterval(mem.timer); mem.timer=null; mem.running=false; }
function startMemoryTimer(){
  if(!mem.running){
    mem.running=true;
    mem.timer=setInterval(()=>{ mem.seconds++; renderMemoryStats(); },1000);
  }
}

function renderMemoryStats(){
  const m=Math.floor(mem.seconds/60),s=mem.seconds%60;
  document.getElementById('memory-stats').innerHTML=`
    <div class="memory-stat"><span class="memory-stat-label">Zeit</span><span class="memory-stat-value">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span></div>
    <div class="memory-stat"><span class="memory-stat-label">Züge</span><span class="memory-stat-value">${mem.moves}</span></div>
    <div class="memory-stat"><span class="memory-stat-label">Paare</span><span class="memory-stat-value">${mem.matched}/${mem.pairs}</span></div>`;
}

function renderMemoryBoard(){
  const board=document.getElementById('memory-board'); board.innerHTML='';
  const total=mem.pairs*2;
  const cols=total<=6?3:total<=12?4:total<=20?5:5;
  board.style.gridTemplateColumns=`repeat(${cols},70px)`;

  mem.cards.forEach((card,idx)=>{
    const el=document.createElement('div');
    el.className='mem-card'+(card.flipped||card.matched?' flipped':'')+(card.matched?' matched':'');
    el.innerHTML=`<div class="mem-card-inner"><div class="mem-card-front">?</div><div class="mem-card-back">${card.emoji}</div></div>`;
    if(!card.matched) el.addEventListener('click',()=>flipMemCard(idx));
    board.appendChild(el);
  });
}

function flipMemCard(idx){
  if(mem.locked) return;
  const card=mem.cards[idx];
  if(card.flipped||card.matched) return;
  startMemoryTimer();
  card.flipped=true; mem.flipped.push(idx);
  renderMemoryBoard();
  if(mem.flipped.length===2){
    mem.moves++; mem.locked=true;
    const [a,b]=mem.flipped;
    if(mem.cards[a].emoji===mem.cards[b].emoji){
      mem.cards[a].matched=mem.cards[b].matched=true;
      mem.matched++; mem.flipped=[]; mem.locked=false;
      renderMemoryBoard(); renderMemoryStats();
      if(mem.matched===mem.pairs) finishMemory();
    } else {
      setTimeout(()=>{
        mem.cards[a].flipped=mem.cards[b].flipped=false;
        mem.flipped=[]; mem.locked=false;
        renderMemoryBoard(); renderMemoryStats();
      },900);
    }
  }
}

function finishMemory(){
  stopMemoryTimer(); mem.active=false;
  const key=`p${mem.pairs}`, hs=gameHighscores.memory||{};
  const prev=hs[key]; let newBest=false;
  if(!prev||mem.seconds<prev.seconds||(mem.seconds===prev.seconds&&mem.moves<prev.moves)){
    hs[key]={seconds:mem.seconds,moves:mem.moves}; gameHighscores.memory=hs;
    saveHighscores(); newBest=true;
  }
  const m=Math.floor(mem.seconds/60),s=mem.seconds%60;
  const done=document.getElementById('memory-done');
  done.className='memory-done-new';
  done.innerHTML=`
    <div class="memory-done-title">🎉 Geschafft!</div>
    <div class="memory-done-stats">
      ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} &middot; ${mem.moves} Züge
      ${newBest?'<span class="memory-new-best">&nbsp;🏆 Neuer Rekord!</span>':''}
    </div>
    <div class="memory-done-btns">
      <button class="game-toggle-btn active" id="memory-play-again">Nochmal</button>
      <button class="game-toggle-btn" id="memory-change-pairs">Einstellungen</button>
    </div>`;
  document.getElementById('memory-game').classList.add('hidden');
  document.getElementById('memory-play-again').addEventListener('click', startMemoryGame);
  document.getElementById('memory-change-pairs').addEventListener('click', showMemorySetup);
  renderMemoryHighscores();
}

// =========================
// SNAKE
// =========================

const SNAKE_CELL=20, SNAKE_SIZE=380;
const snake={
  body:[],dir:{x:1,y:0},nextDir:{x:1,y:0},food:{x:0,y:0},
  score:0,running:false,interval:null,speed:150,initialized:false,canvas:null,ctx:null
};

function initSnake(){
  if(snake.initialized){ return; }
  snake.initialized=true;
  snake.canvas=document.getElementById('snake-canvas');
  snake.ctx=snake.canvas.getContext('2d');
  document.getElementById('snake-reset-btn').addEventListener('click',()=>{ stopSnake(); resetSnake(); drawSnake(); });
  document.addEventListener('keydown', handleSnakeKey);
  resetSnake(); drawSnake();
}

function handleSnakeKey(e){
  if(activeGame!=='snake') return;
  const map={
    ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
    w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0},
    W:{x:0,y:-1},S:{x:0,y:1},A:{x:-1,y:0},D:{x:1,y:0}
  };
  if(e.key===' '){ e.preventDefault(); if(!snake.running) startSnake(); return; }
  if(map[e.key]){
    e.preventDefault();
    const nd=map[e.key];
    if(nd.x===-snake.dir.x&&nd.y===-snake.dir.y) return;
    snake.nextDir=nd;
    if(!snake.running) startSnake();
  }
}

function resetSnake(){
  snake.body=[{x:9,y:9},{x:8,y:9},{x:7,y:9}];
  snake.dir={x:1,y:0}; snake.nextDir={x:1,y:0};
  snake.score=0; snake.speed=150; snake.running=false;
  placeSnakeFood();
  document.getElementById('snake-status').textContent='';
  const hint=document.getElementById('snake-hint');
  if(hint) hint.style.display='';
}

function placeSnakeFood(){
  const cells=SNAKE_SIZE/SNAKE_CELL; let pos;
  do{ pos={x:Math.floor(Math.random()*cells),y:Math.floor(Math.random()*cells)}; }
  while(snake.body.some(s=>s.x===pos.x&&s.y===pos.y));
  snake.food=pos;
}

function startSnake(){
  if(snake.running) return;
  snake.running=true;
  const hint=document.getElementById('snake-hint');
  if(hint) hint.style.display='none';
  snake.interval=setInterval(tickSnake, snake.speed);
}

function stopSnake(){ clearInterval(snake.interval); snake.running=false; }

function tickSnake(){
  snake.dir={...snake.nextDir};
  const cells=SNAKE_SIZE/SNAKE_CELL;
  const head={x:snake.body[0].x+snake.dir.x, y:snake.body[0].y+snake.dir.y};
  if(head.x<0||head.x>=cells||head.y<0||head.y>=cells){ gameOverSnake(); return; }
  if(snake.body.some(s=>s.x===head.x&&s.y===head.y)){ gameOverSnake(); return; }
  snake.body.unshift(head);
  if(head.x===snake.food.x&&head.y===snake.food.y){
    snake.score+=10;
    if(snake.score%50===0&&snake.speed>60){
      stopSnake(); snake.speed=Math.max(60,snake.speed-15); snake.running=false; startSnake();
    }
    placeSnakeFood();
  } else { snake.body.pop(); }
  drawSnake();
  document.getElementById('snake-status').textContent=`Punkte: ${snake.score}`;
}

function gameOverSnake(){
  stopSnake();
  const isNew=snake.score>(gameHighscores.snake||0);
  if(isNew){ gameHighscores.snake=snake.score; saveHighscores(); renderAllHighscores(); }
  document.getElementById('snake-status').innerHTML=
    `Game Over! &nbsp;<strong>${snake.score} Punkte</strong>${isNew?' 🏆':''}`;
  drawSnake(true);
}

function drawSnake(dead=false){
  const ctx=snake.ctx, cs=SNAKE_CELL, size=SNAKE_SIZE;
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  ctx.clearRect(0,0,size,size);
  ctx.fillStyle=isDark?'#1e1e1e':'#f7f7f5';
  ctx.fillRect(0,0,size,size);
  // Subtle grid dots
  ctx.fillStyle=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)';
  for(let x=cs/2;x<size;x+=cs) for(let y=cs/2;y<size;y+=cs){
    ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.fill();
  }
  // Food
  ctx.fillStyle='#ef4444';
  ctx.beginPath();
  ctx.roundRect(snake.food.x*cs+3, snake.food.y*cs+3, cs-6, cs-6, 4);
  ctx.fill();
  // Snake
  snake.body.forEach((seg,i)=>{
    if(dead) ctx.fillStyle=isDark?'#444':'#ccc';
    else if(i===0) ctx.fillStyle=isDark?'#f0f0ee':'#1a1a1a';
    else { const t=Math.max(0.2,1-i/snake.body.length); ctx.fillStyle=isDark?`rgba(180,180,180,${t})`:`rgba(30,30,30,${t})`; }
    ctx.beginPath();
    ctx.roundRect(seg.x*cs+2, seg.y*cs+2, cs-4, cs-4, i===0?cs/2-1:4);
    ctx.fill();
  });
}
