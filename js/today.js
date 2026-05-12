// =========================
// HEADER & COUNTDOWN
// =========================

function updateHeader() {
  state.currentWeekId=getWeekId(state.currentDate);
  document.getElementById('week-label').textContent=`KW ${getISOWeek(state.currentDate)}`;
  document.getElementById('today-title').textContent=
    fmt(new Date(),{weekday:'long',day:'numeric',month:'long'});
  updateCountdown();
  DB.set('currentDate',state.currentDate.toISOString());
}

function updateCountdown() {
  const now=new Date(); now.setHours(0,0,0,0);
  const container=document.getElementById('countdown-display');
  container.innerHTML='';
  const candidates=[];
  const examTarget=new Date(examDate); examTarget.setHours(0,0,0,0);
  candidates.push({id:'__exam__',title:'bis Prüfung',daysLeft:Math.ceil((examTarget-now)/86400000)});
  Object.entries(events).forEach(([key,dayEvs])=>{
    dayEvs.forEach(ev=>{
      if(!ev.countdown) return;
      const evDate=parseLocalDate(key); evDate.setHours(0,0,0,0);
      const days=Math.ceil((evDate-now)/86400000);
      if(days>=0) candidates.push({id:ev.id,title:ev.title,daysLeft:days});
    });
  });
  const visible=candidates.filter(c=>{
    if(c.id==='__exam__') return countdownVisible['__exam__']!==false;
    return countdownVisible[c.id]===true;
  }).sort((a,b)=>a.daysLeft-b.daysLeft);
  const toShow=visible.length>0?visible:[candidates[0]].filter(Boolean);
  toShow.forEach(item=>{
    const entry=document.createElement('div'); entry.className='countdown-entry';
    const days=document.createElement('span'); days.className='countdown-days'; days.textContent=Math.max(0,item.daysLeft);
    const label=document.createElement('span'); label.className='countdown-label'; label.textContent=item.title;
    entry.append(days,label); container.appendChild(entry);
  });
}

document.getElementById('prev-week').addEventListener('click',()=>{
  state.currentDate.setDate(state.currentDate.getDate()-7); updateHeader(); renderView(currentView);
});
document.getElementById('next-week').addEventListener('click',()=>{
  state.currentDate.setDate(state.currentDate.getDate()+7); updateHeader(); renderView(currentView);
});
document.getElementById('exam-pill').addEventListener('click',openCountdownModal);

// =========================
// CLOCK WIDGET
// =========================

let clockInterval=null;

function startClock() {
  stopClock();
  renderClock();
  clockInterval=setInterval(renderClock,1000);
}

function stopClock() {
  if(clockInterval){ clearInterval(clockInterval); clockInterval=null; }
  const w=document.getElementById('clock-widget');
  w.innerHTML=''; w.style.display='none';
}

function renderClock() {
  const w=document.getElementById('clock-widget');
  w.style.display='block';
  const now=new Date();
  if(clockType==='digital'){
    w.innerHTML='';
    w.className='clock-digital';
    const h=String(now.getHours()).padStart(2,'0');
    const m=String(now.getMinutes()).padStart(2,'0');
    const s=String(now.getSeconds()).padStart(2,'0');
    w.textContent=`${h}:${m}:${s}`;
  } else {
    w.className='clock-analog';
    const size=90;
    const cx=size/2, cy=size/2, r=size/2-4;
    const h=now.getHours()%12, mi=now.getMinutes(), s=now.getSeconds();
    const hAngle=(h*30+mi*0.5)*Math.PI/180-Math.PI/2;
    const mAngle=(mi*6+s*0.1)*Math.PI/180-Math.PI/2;
    const sAngle=s*6*Math.PI/180-Math.PI/2;

    const hand=(angle,len,stroke,sw)=>{
      const x=cx+Math.cos(angle)*len, y=cy+Math.sin(angle)*len;
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
    };

    // Hour markers
    let markers='';
    for(let i=0;i<12;i++){
      const a=i*30*Math.PI/180-Math.PI/2;
      const x1=cx+Math.cos(a)*(r-4), y1=cy+Math.sin(a)*(r-4);
      const x2=cx+Math.cos(a)*r, y2=cy+Math.sin(a)*r;
      markers+=`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--text-3)" stroke-width="1.5"/>`;
    }

    w.innerHTML=`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--surface)" stroke="var(--border-strong)" stroke-width="1.5"/>
      ${markers}
      ${hand(hAngle,r*0.5,'var(--text)',2.5)}
      ${hand(mAngle,r*0.75,'var(--text)',2)}
      ${hand(sAngle,r*0.85,'var(--prio-1)',1.2)}
      <circle cx="${cx}" cy="${cy}" r="2.5" fill="var(--text)"/>
    </svg>`;
  }
}

// =========================
// BLOCKS
// =========================

function saveBlocks() { DB.set('blocks',blocks); }

function renderBlocks() {
  const row=document.getElementById('blocks-row');
  row.innerHTML='';
  const activeBlock=getCurrentBlock();
  blocks.forEach(block=>{
    const isActive=activeBlock&&activeBlock.id===block.id&&isToday(state.currentDate);
    const slot=document.createElement('div');
    // FIX: active block uses colored border instead of background fill
    slot.className='block-slot'+(block.free?' free':'')+(isActive?' active-block':'');
    const time=document.createElement('div'); time.className='block-time'; time.textContent=`${block.start} – ${block.end}`;
    const label=document.createElement('div'); label.className='block-label'; label.textContent=block.label;
    if(block.free){const t=document.createElement('span');t.className='free-tag';t.textContent='frei';label.appendChild(t);}
    if(isActive){const t=document.createElement('span');t.className='active-tag';t.textContent='jetzt';label.appendChild(t);}
    const ul=document.createElement('ul'); ul.className='block-tasks'; ul.id=`block-${block.id}`;
    slot.append(time,label,ul); row.appendChild(slot);
  });
  getWeekTasks(state.currentWeekId).filter(t=>!t.done).forEach(task=>{
    const ul=document.getElementById(`block-${task.block}`); if(!ul) return;
    const li=document.createElement('li'); li.textContent=task.title; ul.appendChild(li);
  });
}

// =========================
// TASKS
// =========================

function getWeekTasks(weekId) { return tasks[weekId]||[]; }
function saveTasks() { DB.set('tasks',tasks); }

function renderTasks() {
  const weekId=state.currentWeekId;
  const list=document.getElementById('task-list');
  const empty=document.getElementById('task-empty');
  const count=document.getElementById('task-count');
  list.innerHTML='';
  const weekTasks=[...getWeekTasks(weekId)].sort((a,b)=>a.priority-b.priority||a.title.localeCompare(b.title));
  count.textContent=weekTasks.filter(t=>!t.done).length||'';
  if(weekTasks.length===0){empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  weekTasks.forEach(task=>{
    const li=document.createElement('li'); li.className='task-item'+(task.done?' done':'');
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=task.done;
    cb.addEventListener('change',()=>{task.done=cb.checked;saveTasks();renderTasks();renderBlocks();});
    const dot=document.createElement('div'); dot.className='prio-dot'; dot.dataset.prio=task.priority;
    const info=document.createElement('div'); info.className='task-info';
    const title=document.createElement('span'); title.className='task-title'; title.textContent=task.title;
    title.addEventListener('click',()=>openTaskModal(task)); info.appendChild(title);
    if(task.notes){const sub=document.createElement('span');sub.className='task-sub';sub.textContent=task.notes;info.appendChild(sub);}
    const badge=document.createElement('span'); badge.className='task-block-badge'; badge.textContent=`B${task.block}`;
    const del=document.createElement('button'); del.className='task-delete'; del.textContent='✕';
    del.addEventListener('click',()=>{tasks[weekId]=tasks[weekId].filter(t=>t.id!==task.id);saveTasks();renderTasks();renderBlocks();});
    li.append(cb,dot,info,badge,del); list.appendChild(li);
  });
}

// =========================
// TASK MODAL
// =========================

const taskOverlay=document.getElementById('modal-overlay');

function openTaskModal(existingTask=null) {
  state.editingTask=existingTask;
  state.selectedPriority=existingTask?existingTask.priority:2;
  document.getElementById('modal-title').textContent=existingTask?'Aufgabe bearbeiten':'Neue Aufgabe';
  document.getElementById('modal-task-input').value=existingTask?existingTask.title:'';
  document.getElementById('modal-task-notes').value=existingTask?.notes||'';
  const sel=document.getElementById('modal-block-select'); sel.innerHTML='';
  blocks.forEach(b=>{
    const opt=document.createElement('option'); opt.value=b.id;
    opt.textContent=`${b.label} (${b.start}–${b.end})`;
    if(existingTask?existingTask.block===b.id:b.id===2) opt.selected=true;
    sel.appendChild(opt);
  });
  document.querySelectorAll('.prio-btn').forEach(b=>b.classList.toggle('active',Number(b.dataset.prio)===state.selectedPriority));
  taskOverlay.classList.remove('hidden');
  setTimeout(()=>document.getElementById('modal-task-input').focus(),50);
}
function closeTaskModal(){taskOverlay.classList.add('hidden');state.editingTask=null;}

document.getElementById('add-task-btn').addEventListener('click',()=>openTaskModal());
document.getElementById('modal-close').addEventListener('click',closeTaskModal);
document.getElementById('modal-cancel').addEventListener('click',closeTaskModal);
taskOverlay.addEventListener('click',e=>{if(e.target===taskOverlay)closeTaskModal();});

document.querySelectorAll('.prio-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    state.selectedPriority=Number(btn.dataset.prio);
    document.querySelectorAll('.prio-btn').forEach(b=>b.classList.toggle('active',b===btn));
  });
});
document.getElementById('modal-task-input').addEventListener('keydown',e=>{
  if(e.key==='Enter') document.getElementById('modal-save').click();
  if(e.key==='Escape') closeTaskModal();
});
document.getElementById('modal-save').addEventListener('click',()=>{
  const title=document.getElementById('modal-task-input').value.trim(); if(!title) return;
  const block=Number(document.getElementById('modal-block-select').value);
  const notesTxt=document.getElementById('modal-task-notes').value.trim();
  const weekId=state.currentWeekId;
  if(!tasks[weekId]) tasks[weekId]=[];
  if(state.editingTask){Object.assign(state.editingTask,{title,block,priority:state.selectedPriority,notes:notesTxt});}
  else{tasks[weekId].push({id:crypto.randomUUID(),title,done:false,priority:state.selectedPriority,block,notes:notesTxt});}
  saveTasks();closeTaskModal();renderTasks();renderBlocks();
});

// =========================
// QUICKNOTE + BERICHTSHEFT
// =========================

const qn=document.getElementById('quicknote');
qn.value=quicknote;
let noteTimer;
qn.addEventListener('input',()=>{
  quicknote=qn.value; DB.set('quicknote',quicknote);
  clearTimeout(noteTimer);
  const hint=document.getElementById('note-saved'); hint.classList.remove('show');
  noteTimer=setTimeout(()=>hint.classList.add('show'),800);
});

const berichtBetrieb=document.getElementById('bericht-betrieb');
const berichtSchule=document.getElementById('bericht-schule');
berichtBetrieb.value=berichtsheft.betrieb;
berichtSchule.value=berichtsheft.schule;
let berichtTimer;
function saveBericht() {
  berichtsheft={betrieb:berichtBetrieb.value,schule:berichtSchule.value};
  DB.set('berichtsheft',berichtsheft);
  clearTimeout(berichtTimer);
  const hint=document.getElementById('bericht-saved'); hint.classList.remove('show');
  berichtTimer=setTimeout(()=>hint.classList.add('show'),800);
}
berichtBetrieb.addEventListener('input',saveBericht);
berichtSchule.addEventListener('input',saveBericht);

// =========================
// NOTES
// =========================

function saveNotes(){DB.set('notes',notes);}
function renderNotes(){
  [['exam-notes','note-list-exam'],['class-questions','note-list-questions'],['terms','note-list-terms']].forEach(([key,listId])=>{
    const ul=document.getElementById(listId); if(!ul) return;
    ul.innerHTML='';
    (notes[key]||[]).forEach((text,idx)=>{
      const li=document.createElement('li'); li.className='note-item';
      const span=document.createElement('span'); span.textContent=text;
      const del=document.createElement('button'); del.className='note-del'; del.textContent='✕';
      del.addEventListener('click',()=>{notes[key].splice(idx,1);saveNotes();renderNotes();});
      li.append(span,del); ul.appendChild(li);
    });
  });
}

let noteModalKey=null;
const NOTE_LABELS={'exam-notes':'Wichtiges','class-questions':'Fragen für den Unterricht','terms':'Begriffe & Definitionen'};

function openNoteModal(key,label){
  noteModalKey=key;
  document.getElementById('note-modal-title').textContent=`${label||key} — Notiz hinzufügen`;
  document.getElementById('note-modal-input').value='';
  document.getElementById('note-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('note-modal-input').focus(),50);
}
function closeNoteModal(){document.getElementById('note-modal-overlay').classList.add('hidden');noteModalKey=null;}

document.getElementById('note-modal-close').addEventListener('click',closeNoteModal);
document.getElementById('note-modal-cancel').addEventListener('click',closeNoteModal);
document.getElementById('note-modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('note-modal-overlay'))closeNoteModal();});

// Unified note save — handles both regular notes and custom tile lists
document.getElementById('note-modal-save').addEventListener('click',()=>{
  const text=document.getElementById('note-modal-input').value.trim();
  if(!text||!noteModalKey) return;

  if(noteModalKey.startsWith('__custom__')){
    const tileId=noteModalKey.replace('__custom__','');
    const tile=customTiles.find(t=>t.id===tileId); if(!tile) return;
    if(!tile.items) tile.items=[];
    tile.items.push({id:crypto.randomUUID(),text,done:false});
    saveCustomTiles(); renderCustomTiles(); closeNoteModal();
  } else if(noteModalKey==='__todo__'){
    if(!generalTodos) generalTodos=[];
    generalTodos.push({id:crypto.randomUUID(),text,done:false});
    saveTodos(); renderTodos(); closeNoteModal();
  } else {
    if(!notes[noteModalKey]) notes[noteModalKey]=[];
    notes[noteModalKey].push(text); saveNotes(); renderNotes(); closeNoteModal();
  }
});

document.querySelectorAll('.add-note-btn').forEach(btn=>{
  btn.addEventListener('click',()=>openNoteModal(btn.dataset.key,NOTE_LABELS[btn.dataset.key]));
});

// =========================
// CUSTOM TILES — FIX: list items now have checkboxes
// =========================

function saveCustomTiles(){DB.set('customTiles',customTiles);}

function renderCustomTiles(){
  const container=document.getElementById('custom-tiles');
  container.innerHTML='';
  customTiles.forEach(tile=>{
    const panel=document.createElement('div'); panel.className='panel';
    const header=document.createElement('div'); header.className='panel-header';
    const label=document.createElement('span'); label.className='panel-label'; label.textContent=tile.title;
    const right=document.createElement('div'); right.style.cssText='display:flex;gap:6px;align-items:center;';

    if(tile.type==='list'){
      const addBtn=document.createElement('button'); addBtn.className='icon-btn'; addBtn.textContent='+';
      addBtn.addEventListener('click',()=>{
        noteModalKey='__custom__'+tile.id;
        document.getElementById('note-modal-title').textContent=`${tile.title} — Eintrag hinzufügen`;
        document.getElementById('note-modal-input').value='';
        document.getElementById('note-modal-overlay').classList.remove('hidden');
        setTimeout(()=>document.getElementById('note-modal-input').focus(),50);
      });
      right.appendChild(addBtn);
    }

    const delBtn=document.createElement('button'); delBtn.className='icon-btn'; delBtn.textContent='✕';
    delBtn.style.opacity='0';
    panel.addEventListener('mouseenter',()=>delBtn.style.opacity='1');
    panel.addEventListener('mouseleave',()=>delBtn.style.opacity='0');
    delBtn.addEventListener('click',()=>{customTiles=customTiles.filter(t=>t.id!==tile.id);saveCustomTiles();renderCustomTiles();});
    right.appendChild(delBtn);
    header.append(label,right); panel.appendChild(header);

    if(tile.type==='note'){
      const ta=document.createElement('textarea');
      ta.className='custom-tile-textarea'; ta.value=tile.content||''; ta.placeholder='Notizen...';
      ta.addEventListener('input',()=>{tile.content=ta.value;saveCustomTiles();});
      panel.appendChild(ta);
    } else {
      // Checklist — items are {id, text, done}
      // Migrate old string items
      if(tile.items && tile.items.length>0 && typeof tile.items[0]==='string'){
        tile.items=tile.items.map(s=>({id:crypto.randomUUID(),text:s,done:false}));
        saveCustomTiles();
      }
      const ul=document.createElement('ul'); ul.className='checklist';
      (tile.items||[]).forEach((item,idx)=>{
        const li=document.createElement('li'); li.className='checklist-item'+(item.done?' done':'');
        const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=item.done;
        cb.addEventListener('change',()=>{item.done=cb.checked;saveCustomTiles();renderCustomTiles();});
        const span=document.createElement('span'); span.textContent=item.text||item;
        const del=document.createElement('button'); del.className='note-del'; del.textContent='✕';
        del.addEventListener('click',()=>{tile.items.splice(idx,1);saveCustomTiles();renderCustomTiles();});
        li.append(cb,span,del); ul.appendChild(li);
      });
      if((tile.items||[]).length===0){
        const empty=document.createElement('div'); empty.className='empty-state'; empty.textContent='Noch keine Einträge.';
        ul.appendChild(empty);
      }
      panel.appendChild(ul);
    }
    container.appendChild(panel);
  });
}

// Tile creation modal
let selectedTileType='note';

document.getElementById('add-tile-btn').addEventListener('click',()=>{
  document.getElementById('tile-modal-title').value='';
  selectedTileType='note';
  document.querySelectorAll('.tile-type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type==='note'));
  document.getElementById('tile-type-desc').textContent='Freies Textfeld, wie die Schnellnotiz.';
  document.getElementById('tile-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('tile-modal-title').focus(),50);
});

document.querySelectorAll('.tile-type-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    selectedTileType=btn.dataset.type;
    document.querySelectorAll('.tile-type-btn').forEach(b=>b.classList.toggle('active',b===btn));
    document.getElementById('tile-type-desc').textContent=
      selectedTileType==='note'?'Freies Textfeld, wie die Schnellnotiz.':'Checkliste mit Kästchen zum Abhaken.';
  });
});

document.getElementById('tile-modal-close').addEventListener('click',()=>document.getElementById('tile-modal-overlay').classList.add('hidden'));
document.getElementById('tile-modal-cancel').addEventListener('click',()=>document.getElementById('tile-modal-overlay').classList.add('hidden'));
document.getElementById('tile-modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('tile-modal-overlay'))document.getElementById('tile-modal-overlay').classList.add('hidden');});

document.getElementById('tile-modal-save').addEventListener('click',()=>{
  const title=document.getElementById('tile-modal-title').value.trim(); if(!title) return;
  const tile={id:crypto.randomUUID(),title,type:selectedTileType,content:'',items:[]};
  customTiles.push(tile); saveCustomTiles();
  document.getElementById('tile-modal-overlay').classList.add('hidden');
  renderCustomTiles();
});


// =========================
// REFRESH (called on every view switch to today)
// =========================

function refreshTodayTextareas(){
  // Re-read from localStorage so data is always current
  quicknote = DB.get('quicknote', '');
  document.getElementById('quicknote').value = quicknote;

  berichtsheft = DB.get('berichtsheft', { betrieb: '', schule: '' });
  document.getElementById('bericht-betrieb').value = berichtsheft.betrieb || '';
  document.getElementById('bericht-schule').value  = berichtsheft.schule  || '';
}

// =========================
// GENERAL TO DO TILE
// =========================

function saveTodos(){ DB.set('generalTodos', generalTodos); }

function renderTodos(){
  const ul = document.getElementById('todo-list');
  if(!ul) return;
  ul.innerHTML = '';
  (generalTodos||[]).forEach((item, idx)=>{
    const li = document.createElement('li'); li.className = 'checklist-item' + (item.done?' done':'');
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = item.done;
    cb.addEventListener('change', ()=>{ item.done = cb.checked; saveTodos(); renderTodos(); });
    const span = document.createElement('span'); span.textContent = item.text;
    const del = document.createElement('button'); del.className = 'note-del'; del.textContent = '✕';
    del.addEventListener('click', ()=>{ generalTodos.splice(idx,1); saveTodos(); renderTodos(); });
    li.append(cb, span, del); ul.appendChild(li);
  });
  if(!generalTodos||generalTodos.length===0){
    const empty = document.createElement('div'); empty.className='empty-state'; empty.textContent='Noch keine Einträge.';
    ul.appendChild(empty);
  }
}

document.getElementById('add-todo-btn').addEventListener('click', ()=>{
  noteModalKey = '__todo__';
  document.getElementById('note-modal-title').textContent = 'To Do — Eintrag hinzufügen';
  document.getElementById('note-modal-input').value = '';
  document.getElementById('note-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('note-modal-input').focus(), 50);
});

renderTodos();
