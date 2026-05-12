// =========================
// EVENTS
// =========================

function saveEvents(){DB.set('events',events);}
let eventModalTarget=null;

function openEventModal(key,day,existingEvent=null){
  state.editingEvent=existingEvent?{key,event:existingEvent}:null;
  eventModalTarget={key,day};
  document.getElementById('event-modal-title').textContent=existingEvent?'Termin bearbeiten':'Neuer Termin';
  document.getElementById('event-modal-date-input').value=key;
  document.getElementById('event-modal-input').value=existingEvent?existingEvent.title:'';
  document.getElementById('event-modal-notes').value=existingEvent?.notes||'';
  document.getElementById('event-modal-time').value=existingEvent?.time||'';
  document.getElementById('event-modal-countdown').checked=existingEvent?.countdown||false;
  document.getElementById('event-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('event-modal-input').focus(),50);
}
function closeEventModal(){
  document.getElementById('event-modal-overlay').classList.add('hidden');
  state.editingEvent=null; eventModalTarget=null;
}

document.getElementById('event-modal-close').addEventListener('click',closeEventModal);
document.getElementById('event-modal-cancel').addEventListener('click',closeEventModal);
document.getElementById('event-modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('event-modal-overlay'))closeEventModal();});
document.getElementById('event-modal-input').addEventListener('keydown',e=>{
  if(e.key==='Enter') document.getElementById('event-modal-save').click();
  if(e.key==='Escape') closeEventModal();
});
document.getElementById('event-modal-save').addEventListener('click',()=>{
  const title=document.getElementById('event-modal-input').value.trim(); if(!title) return;
  const dateVal=document.getElementById('event-modal-date-input').value;
  const key=dateVal||(eventModalTarget?eventModalTarget.key:dateKey(new Date()));
  const time=document.getElementById('event-modal-time').value;
  const notesTxt=document.getElementById('event-modal-notes').value.trim();
  const countdown=document.getElementById('event-modal-countdown').checked;
  if(state.editingEvent){
    const oldKey=state.editingEvent.key; const ev=state.editingEvent.event;
    events[oldKey]=(events[oldKey]||[]).filter(e=>e.id!==ev.id);
    if(!events[key]) events[key]=[];
    events[key].push({...ev,title,time,notes:notesTxt,countdown});
    if(countdown) countdownVisible[ev.id]=true;
  } else {
    const id=crypto.randomUUID();
    if(!events[key]) events[key]=[];
    events[key].push({id,title,time,notes:notesTxt,countdown});
    if(countdown) countdownVisible[id]=true;
  }
  saveEvents(); DB.set('countdownVisible',countdownVisible);
  closeEventModal();
  if(currentView==='calendar') renderCalendar();
  updateCountdown();
  document.getElementById('cal-day-modal-overlay').classList.add('hidden');
});
document.getElementById('cal-add-event-btn').addEventListener('click',()=>{
  const today=new Date(); openEventModal(dateKey(today),today);
});

// =========================
// CALENDAR — FIX: today has border, not filled background
// =========================

let calDate=new Date();

function renderCalendar(){
  const grid=document.getElementById('calendar-grid'); grid.innerHTML='';
  const year=calDate.getFullYear(), month=calDate.getMonth();
  document.getElementById('cal-title').textContent=calDate.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(d=>{
    const el=document.createElement('div'); el.className='cal-day-name'; el.textContent=d; grid.appendChild(el);
  });
  const firstDay=new Date(year,month,1);
  const startOffset=(firstDay.getDay()+6)%7;
  const daysInMonth=new Date(year,month+1,0).getDate();
  const daysInPrev=new Date(year,month,0).getDate();
  for(let i=startOffset-1;i>=0;i--){
    const el=document.createElement('div'); el.className='cal-day other-month'; el.textContent=daysInPrev-i; grid.appendChild(el);
  }
  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(year,month,d), weekId=getWeekId(date), key=dateKey(date);
    const dayEvs=(events[key]||[]).slice().sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    const dayTasks=(tasks[weekId]||[]).filter(t=>!t.done);
    const el=document.createElement('div');
    // FIX: is-today uses border highlight, not black background
    el.className='cal-day'+(isToday(date)?' is-today':'')+(date.getDay()===0||date.getDay()===6?' weekend':'');
    el.style.cursor='pointer';
    const num=document.createElement('span'); num.className='cal-day-num'; num.textContent=d; el.appendChild(num);
    const items=document.createElement('div'); items.className='cal-items';
    let shown=0;
    dayEvs.forEach(ev=>{
      if(shown>=3) return; shown++;
      const pill=document.createElement('div');
      pill.className='cal-event-pill'+(ev.countdown?' countdown-pill':'');
      pill.textContent=(ev.time?ev.time+' ':'')+ev.title; pill.title=ev.notes||'';
      items.appendChild(pill);
    });
    dayTasks.forEach(t=>{
      if(shown>=3) return; shown++;
      const pill=document.createElement('div'); pill.className=`cal-task-pill prio-${t.priority}`; pill.textContent=t.title;
      items.appendChild(pill);
    });
    const totalAll=dayEvs.length+dayTasks.length;
    if(totalAll>shown){const more=document.createElement('div');more.className='cal-more';more.textContent=`+${totalAll-shown} weitere`;items.appendChild(more);}
    el.appendChild(items);
    el.addEventListener('click',()=>openCalDayModal(key,date));
    grid.appendChild(el);
  }
  const total=startOffset+daysInMonth, remainder=(7-(total%7))%7;
  for(let d=1;d<=remainder;d++){
    const el=document.createElement('div'); el.className='cal-day other-month'; el.textContent=d; grid.appendChild(el);
  }
}

document.getElementById('cal-prev').addEventListener('click',()=>{calDate.setMonth(calDate.getMonth()-1);renderCalendar();});
document.getElementById('cal-next').addEventListener('click',()=>{calDate.setMonth(calDate.getMonth()+1);renderCalendar();});

let calDayTarget=null;
function openCalDayModal(key,date){
  calDayTarget={key,date};
  document.getElementById('cal-day-modal-title').textContent=date.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
  const content=document.getElementById('cal-day-modal-content'); content.innerHTML='';
  const dayEvs=(events[key]||[]).slice().sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const weekId=getWeekId(date), dayTasks=(tasks[weekId]||[]).filter(t=>!t.done);
  if(dayEvs.length===0&&dayTasks.length===0){
    const p=document.createElement('p'); p.className='modal-hint'; p.textContent='Keine Einträge für diesen Tag.'; content.appendChild(p);
  }
  if(dayEvs.length>0){
    const head=document.createElement('div'); head.className='cal-day-section-head'; head.textContent='Termine'; content.appendChild(head);
    dayEvs.forEach(ev=>{
      const row=document.createElement('div'); row.className='cal-day-ev-row';
      const left=document.createElement('div'); left.className='cal-day-ev-left';
      if(ev.time){const t=document.createElement('span');t.className='cal-day-ev-time';t.textContent=ev.time;left.appendChild(t);}
      const tit=document.createElement('span'); tit.className='cal-day-ev-title'; tit.textContent=ev.title; left.appendChild(tit);
      if(ev.notes){const n=document.createElement('span');n.className='cal-day-ev-notes';n.textContent=ev.notes;left.appendChild(n);}
      const actions=document.createElement('div'); actions.style.cssText='display:flex;gap:4px;flex-shrink:0;';
      const edit=document.createElement('button'); edit.className='task-delete'; edit.textContent='✎';
      edit.addEventListener('click',()=>{closeCalDayModal();openEventModal(key,date,ev);});
      const del=document.createElement('button'); del.className='task-delete'; del.textContent='✕';
      del.addEventListener('click',()=>{events[key]=(events[key]||[]).filter(e=>e.id!==ev.id);saveEvents();updateCountdown();renderCalendar();openCalDayModal(key,date);});
      actions.append(edit,del); row.append(left,actions); content.appendChild(row);
    });
  }
  if(dayTasks.length>0){
    const head=document.createElement('div'); head.className='cal-day-section-head'; head.textContent='Offene Aufgaben'; content.appendChild(head);
    dayTasks.forEach(t=>{
      const row=document.createElement('div'); row.className='cal-day-ev-row';
      const left=document.createElement('div'); left.className='cal-day-ev-left';
      const tit=document.createElement('span'); tit.className='cal-day-ev-title'; tit.textContent=t.title; left.appendChild(tit);
      if(t.notes){const n=document.createElement('span');n.className='cal-day-ev-notes';n.textContent=t.notes;left.appendChild(n);}
      row.appendChild(left); content.appendChild(row);
    });
  }
  document.getElementById('cal-day-modal-overlay').classList.remove('hidden');
}
function closeCalDayModal(){document.getElementById('cal-day-modal-overlay').classList.add('hidden');calDayTarget=null;}
document.getElementById('cal-day-modal-close').addEventListener('click',closeCalDayModal);
document.getElementById('cal-day-modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('cal-day-modal-overlay'))closeCalDayModal();});
document.getElementById('cal-day-add-event').addEventListener('click',()=>{if(!calDayTarget)return;closeCalDayModal();openEventModal(calDayTarget.key,calDayTarget.date);});

// =========================
// COUNTDOWN MODAL
// =========================

function openCountdownModal(){renderCountdownList();document.getElementById('countdown-modal-overlay').classList.remove('hidden');}
function closeCountdownModal(){document.getElementById('countdown-modal-overlay').classList.add('hidden');}

function renderCountdownList(){
  const list=document.getElementById('countdown-list'); list.innerHTML='';
  const now=new Date(); now.setHours(0,0,0,0);
  list.appendChild(makeCountdownRow('__exam__','Prüfung',Math.ceil((new Date(examDate)-now)/86400000),true));
  const allC=[];
  Object.entries(events).forEach(([key,dayEvs])=>{
    dayEvs.forEach(ev=>{
      if(!ev.countdown) return;
      const evDate=parseLocalDate(key); evDate.setHours(0,0,0,0);
      allC.push({id:ev.id,title:ev.title,daysLeft:Math.ceil((evDate-now)/86400000)});
    });
  });
  allC.sort((a,b)=>a.daysLeft-b.daysLeft).forEach(c=>list.appendChild(makeCountdownRow(c.id,c.title,c.daysLeft,false)));
  if(allC.length===0){const p=document.createElement('p');p.className='modal-hint';p.textContent='Noch keine Countdown-Termine.';list.appendChild(p);}
}
function makeCountdownRow(id,title,days,isExam){
  const row=document.createElement('div'); row.className='countdown-row';
  const info=document.createElement('div'); info.className='countdown-row-info';
  const name=document.createElement('span'); name.className='countdown-row-title'; name.textContent=title;
  const badge=document.createElement('span'); badge.className='countdown-row-days'; badge.textContent=`${Math.max(0,days)} Tage`;
  info.append(name,badge);
  const lbl=document.createElement('label'); lbl.className='toggle';
  const cb=document.createElement('input'); cb.type='checkbox';
  cb.checked=isExam?countdownVisible['__exam__']!==false:countdownVisible[id]===true;
  cb.addEventListener('change',()=>{countdownVisible[id]=cb.checked;DB.set('countdownVisible',countdownVisible);updateCountdown();});
  const slider=document.createElement('span'); slider.className='toggle-slider';
  lbl.append(cb,slider); row.append(info,lbl); return row;
}
document.getElementById('countdown-modal-close').addEventListener('click',closeCountdownModal);
document.getElementById('countdown-modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('countdown-modal-overlay'))closeCountdownModal();});

