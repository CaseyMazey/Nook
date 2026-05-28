// =========================
// EVENTS
// =========================

function saveEvents(){DB.set('events',events);}
let eventModalTarget=null;

// =========================
// COUNTDOWN CLEANUP beim Laden
// =========================
(function cleanupExpiredCountdowns(){
  const now=new Date(); now.setHours(0,0,0,0);
  let changed=false;
  const validCountdownIds=new Set();
  Object.entries(events).forEach(([key,dayEvs])=>{
    dayEvs.forEach(ev=>{
      if(!ev.countdown) return;
      const evDate=parseLocalDate(key); evDate.setHours(0,0,0,0);
      const daysLeft=Math.ceil((evDate-now)/86400000);
      if(daysLeft>=0){ validCountdownIds.add(ev.id); }
      else { ev.countdown=false; changed=true; }
    });
  });
  Object.keys(countdownVisible).forEach(id=>{
    if(id==='__exam__'){ delete countdownVisible[id]; changed=true; return; }
    if(!validCountdownIds.has(id)){ delete countdownVisible[id]; changed=true; }
  });
  if(changed){ saveEvents(); DB.set('countdownVisible',countdownVisible); }
})();

// =========================
// EVENT MODAL
// =========================

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
    else delete countdownVisible[ev.id];
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
// CALENDAR
// Neue Task-Logik: getTasksForCalendarDay(date)
// Offene Tasks: sichtbar ab createdAt
// Erledigte Tasks: sichtbar wenn completedAt >= Tagesbeginn (historisch korrekt)
// Erledigte Tasks: abgeschwächt dargestellt
// =========================

let calDate=new Date();

function renderCalendar(){
  const grid=document.getElementById('calendar-grid'); grid.innerHTML='';
  const year=calDate.getFullYear(), month=calDate.getMonth();
  document.getElementById('cal-title').textContent=calDate.toLocaleDateString('de-DE',{month:'long',year:'numeric'});

  const kwHead=document.createElement('div'); kwHead.className='cal-day-name cal-kw-head'; kwHead.textContent='KW'; grid.appendChild(kwHead);
  ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(d=>{
    const el=document.createElement('div'); el.className='cal-day-name'; el.textContent=d; grid.appendChild(el);
  });

  const firstDay=new Date(year,month,1);
  const startOffset=(firstDay.getDay()+6)%7;
  const daysInMonth=new Date(year,month+1,0).getDate();
  const daysInPrev=new Date(year,month,0).getDate();

  const allDays=[];
  for(let i=startOffset-1;i>=0;i--)
    allDays.push({date:new Date(year,month-1,daysInPrev-i),otherMonth:true});
  for(let d=1;d<=daysInMonth;d++)
    allDays.push({date:new Date(year,month,d),otherMonth:false});
  const remainder=(7-(allDays.length%7))%7;
  for(let d=1;d<=remainder;d++)
    allDays.push({date:new Date(year,month+1,d),otherMonth:true});

  for(let i=0;i<allDays.length;i+=7){
    const week=allDays.slice(i,i+7);
    const kwEl=document.createElement('div'); kwEl.className='cal-kw-cell';
    kwEl.textContent=getISOWeek(week[0].date); grid.appendChild(kwEl);

    week.forEach(({date,otherMonth})=>{
      const key=dateKey(date);
      const dayEvs=(events[key]||[]).slice().sort((a,b)=>(a.time||'').localeCompare(b.time||''));

      // Datum-basierte Task-Abfrage statt weekId
      const dayTasks = getTasksForCalendarDay(date);

      const el=document.createElement('div');
      el.className='cal-day'
        +(otherMonth?' other-month':'')
        +(isToday(date)?' is-today':'')
        +(date.getDay()===0||date.getDay()===6?' weekend':'');
      el.style.cursor='pointer';

      const num=document.createElement('span'); num.className='cal-day-num'; num.textContent=date.getDate(); el.appendChild(num);
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
        const pill=document.createElement('div');
        // Erledigte Tasks abgeschwächt darstellen
        pill.className=`cal-task-pill prio-${t.priority}`+(t.done?' cal-task-pill--done':'');
        pill.textContent=t.title;
        if(t.done) pill.title='Erledigt';
        items.appendChild(pill);
      });

      const totalAll=dayEvs.length+dayTasks.length;
      if(totalAll>shown){
        const more=document.createElement('div');
        more.className='cal-more';
        more.textContent=`+${totalAll-shown} weitere`;
        items.appendChild(more);
      }
      el.appendChild(items);
      if(!otherMonth) el.addEventListener('click',()=>openCalDayModal(key,date));
      grid.appendChild(el);
    });
  }
}

document.getElementById('cal-prev').addEventListener('click',()=>{calDate.setMonth(calDate.getMonth()-1);renderCalendar();});
document.getElementById('cal-next').addEventListener('click',()=>{calDate.setMonth(calDate.getMonth()+1);renderCalendar();});

// =========================
// CALENDAR DAY MODAL
// Zeigt historisch korrekte Task-Liste für den angeklickten Tag.
// Offene und erledigte Tasks sichtbar, erledigte visuell abgeschwächt.
// =========================

let calDayTarget=null;
function openCalDayModal(key,date){
  calDayTarget={key,date};
  document.getElementById('cal-day-modal-title').textContent=
    date.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
  const content=document.getElementById('cal-day-modal-content'); content.innerHTML='';

  const dayEvs=(events[key]||[]).slice().sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  // Datum-basierte Tasks für diesen Tag
  const dayTasks = getTasksForCalendarDay(date);
  const openTasks = dayTasks.filter(t=>!t.done);
  const doneTasks = dayTasks.filter(t=>t.done);

  if(dayEvs.length===0 && dayTasks.length===0){
    const p=document.createElement('p'); p.className='modal-hint';
    p.textContent='Keine Einträge für diesen Tag.'; content.appendChild(p);
  }

  // Termine
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
      del.addEventListener('click',()=>{
        events[key]=(events[key]||[]).filter(e=>e.id!==ev.id);
        saveEvents();updateCountdown();renderCalendar();openCalDayModal(key,date);
      });
      actions.append(edit,del); row.append(left,actions); content.appendChild(row);
    });
  }

  // Offene Aufgaben
  if(openTasks.length>0){
    const head=document.createElement('div'); head.className='cal-day-section-head'; head.textContent='Offene Aufgaben'; content.appendChild(head);
    openTasks.forEach(t=>{
      const row=document.createElement('div'); row.className='cal-day-ev-row';
      const left=document.createElement('div'); left.className='cal-day-ev-left';
      const dot=document.createElement('span'); dot.className='cal-task-dot'; dot.dataset.prio=t.priority; left.appendChild(dot);
      const tit=document.createElement('span'); tit.className='cal-day-ev-title'; tit.textContent=t.title; left.appendChild(tit);
      if(t.notes){const n=document.createElement('span');n.className='cal-day-ev-notes';n.textContent=t.notes;left.appendChild(n);}
      row.appendChild(left); content.appendChild(row);
    });
  }

  // Erledigte Aufgaben — historisch sichtbar, visuell abgeschwächt
  if(doneTasks.length>0){
    const head=document.createElement('div'); head.className='cal-day-section-head cal-day-section-head--done'; head.textContent='Erledigt'; content.appendChild(head);
    doneTasks.forEach(t=>{
      const row=document.createElement('div'); row.className='cal-day-ev-row cal-day-ev-row--done';
      const left=document.createElement('div'); left.className='cal-day-ev-left';
      const dot=document.createElement('span'); dot.className='cal-task-dot'; dot.dataset.prio=t.priority; left.appendChild(dot);
      const tit=document.createElement('span'); tit.className='cal-day-ev-title'; tit.textContent=t.title; left.appendChild(tit);
      if(t.notes){const n=document.createElement('span');n.className='cal-day-ev-notes';n.textContent=t.notes;left.appendChild(n);}
      row.appendChild(left); content.appendChild(row);
    });
  }

  document.getElementById('cal-day-modal-overlay').classList.remove('hidden');
}
function closeCalDayModal(){document.getElementById('cal-day-modal-overlay').classList.add('hidden');calDayTarget=null;}
document.getElementById('cal-day-modal-close').addEventListener('click',closeCalDayModal);
document.getElementById('cal-day-modal-overlay').addEventListener('click',e=>{
  if(e.target===document.getElementById('cal-day-modal-overlay'))closeCalDayModal();
});

document.getElementById('cal-day-add-event').addEventListener('click',()=>{
  if(!calDayTarget) return;
  const {key,date}=calDayTarget;
  closeCalDayModal();
  openEventModal(key,date);
});

// =========================
// COUNTDOWN MODAL
// =========================

function openCountdownModal(){renderCountdownList();document.getElementById('countdown-modal-overlay').classList.remove('hidden');}
function closeCountdownModal(){document.getElementById('countdown-modal-overlay').classList.add('hidden');}

function renderCountdownList(){
  const list=document.getElementById('countdown-list'); list.innerHTML='';
  const now=new Date(); now.setHours(0,0,0,0);
  const allC=[];
  Object.entries(events).forEach(([key,dayEvs])=>{
    dayEvs.forEach(ev=>{
      if(!ev.countdown) return;
      const evDate=parseLocalDate(key); evDate.setHours(0,0,0,0);
      const daysLeft=Math.ceil((evDate-now)/86400000);
      if(daysLeft>=0) allC.push({id:ev.id,title:ev.title,daysLeft});
    });
  });
  allC.sort((a,b)=>a.daysLeft-b.daysLeft).forEach(c=>list.appendChild(makeCountdownRow(c.id,c.title,c.daysLeft)));
  if(allC.length===0){
    const p=document.createElement('p'); p.className='modal-hint';
    p.textContent='Noch keine Countdown-Termine. Aktiviere die Countdown-Option beim Erstellen eines Termins.';
    list.appendChild(p);
  }
}

function makeCountdownRow(id,title,days){
  const row=document.createElement('div'); row.className='countdown-row';
  const info=document.createElement('div'); info.className='countdown-row-info';
  const name=document.createElement('span'); name.className='countdown-row-title'; name.textContent=title;
  const badge=document.createElement('span'); badge.className='countdown-row-days'; badge.textContent=`${days} Tage`;
  info.append(name,badge);
  const lbl=document.createElement('label'); lbl.className='toggle';
  const cb=document.createElement('input'); cb.type='checkbox';
  cb.checked=countdownVisible[id]===true;
  cb.addEventListener('change',()=>{
    if(cb.checked) countdownVisible[id]=true;
    else delete countdownVisible[id];
    DB.set('countdownVisible',countdownVisible);
    updateCountdown();
  });
  const slider=document.createElement('span'); slider.className='toggle-slider';
  lbl.append(cb,slider); row.append(info,lbl); return row;
}

document.getElementById('countdown-modal-close').addEventListener('click',closeCountdownModal);
document.getElementById('countdown-modal-overlay').addEventListener('click',e=>{
  if(e.target===document.getElementById('countdown-modal-overlay'))closeCountdownModal();
});
