// =========================
// FLASHCARDS — Enhanced with stats, streak, progress
// =========================

function saveSubjects(){ DB.set('subjects', subjects); }

// =========================
// STREAK SYSTEM
// =========================

function getTodayStr(){ return new Date().toISOString().slice(0,10); }

function getStreak(){
  let data = DB.get('fc_streak', { streak: 0, lastDate: null });
  return data;
}

function recordSessionDone(){
  const today = getTodayStr();
  let data = DB.get('fc_streak', { streak: 0, lastDate: null });
  if(data.lastDate === today) return; // already counted today
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const yStr = yesterday.toISOString().slice(0,10);
  if(data.lastDate === yStr){
    data.streak = (data.streak||0) + 1;
  } else {
    data.streak = 1;
  }
  data.lastDate = today;
  DB.set('fc_streak', data);
}

// =========================
// SESSION STATS (daily)
// =========================

function getSessionStats(){
  return DB.get('fc_session_stats', { date: null, learned: 0, correct: 0, wrong: 0 });
}

function recordAnswer(knew){
  let s = getSessionStats();
  const today = getTodayStr();
  if(s.date !== today) s = { date: today, learned: 0, correct: 0, wrong: 0 };
  s.learned++;
  if(knew) s.correct++; else s.wrong++;
  DB.set('fc_session_stats', s);
}

// =========================
// GLOBAL STATS
// =========================

function calcGlobalStats(){
  let total=0, dueToday=0;
  const today = getTodayStr();
  subjects.forEach(subj => subj.groups.forEach(g => g.cards.forEach(c => {
    total++;
    const box = c.box||1;
    const last = c.lastSeen ? c.lastSeen.slice(0,10) : null;
    const daysAgo = last ? Math.floor((Date.now() - new Date(last))/86400000) : 999;
    const intervals = [0,1,2,4,8];
    if(daysAgo >= intervals[box-1]) dueToday++;
  })));
  const stats = getSessionStats();
  const todayLearned = stats.date === today ? stats.learned : 0;
  const streak = getStreak();
  return { total, dueToday, todayLearned, streak: streak.streak };
}

function renderGlobalStats(){
  const s = calcGlobalStats();
  const wrap = document.getElementById('fc-global-stats');
  if(!wrap) return;
  const streak = getStreak();
  const pct = calcGlobalAccuracy();
  wrap.innerHTML = `
    <div class="fc-stat-card">
      <span class="fc-stat-icon">🗂️</span>
      <span class="fc-stat-value">${s.total}</span>
      <span class="fc-stat-label">Karten insgesamt</span>
    </div>
    <div class="fc-stat-card fc-stat-due">
      <span class="fc-stat-icon">📅</span>
      <span class="fc-stat-value">${s.dueToday}</span>
      <span class="fc-stat-label">Heute fällig</span>
    </div>
    <div class="fc-stat-card">
      <span class="fc-stat-icon">📈</span>
      <span class="fc-stat-value">${pct}%</span>
      <span class="fc-stat-label">Erfolgsquote</span>
    </div>
    <div class="fc-stat-card fc-stat-streak">
      <span class="fc-stat-icon">🔥</span>
      <span class="fc-stat-value">${streak.streak}</span>
      <span class="fc-stat-label">Tage Streak</span>
    </div>
  `;
}

function calcGlobalAccuracy(){
  let total=0, correct=0;
  subjects.forEach(subj => subj.groups.forEach(g => g.cards.forEach(c => {
    if(c.totalAnswers){ total+=c.totalAnswers; correct+=(c.correctAnswers||0); }
  })));
  if(!total) return 0;
  return Math.round((correct/total)*100);
}

// =========================
// SUBJECT LIST
// =========================

function renderSubjectList(){
  const list=document.getElementById('subject-list'); list.innerHTML='';
  const empty=document.getElementById('subject-empty');
  if(subjects.length===0){ empty.classList.remove('hidden'); renderGlobalStats(); return; }
  empty.classList.add('hidden');
  renderGlobalStats();
  subjects.forEach(subj=>{
    const cardCount=subj.groups.reduce((s,g)=>s+g.cards.length,0);
    const dueCount=calcSubjectDue(subj);
    const pct=calcSubjectAccuracy(subj);
    const btn=document.createElement('button'); btn.className='subject-item'+(state.activeSubjectId===subj.id?' active':'');
    const streakD = getStreak();
    btn.innerHTML=`
      <div class="subject-item-top">
        <span class="subject-name">${escHtml(subj.name)}</span>
      </div>
      <span class="subject-teacher">${escHtml(subj.teacher||'')}</span>
      <div class="subject-item-stats">
        <span>${cardCount} Karten</span>
        <span class="subject-due">${dueCount} fällig</span>
        <span>${pct}%</span>
      </div>
      <div class="subject-mini-bar"><div class="subject-mini-fill" style="width:${pct}%"></div></div>
    `;
    btn.addEventListener('click',()=>{ state.activeSubjectId=subj.id; renderSubjectList(); renderSubjectDetail(); });
    btn.style.position='relative';
    const del=document.createElement('button'); del.className='task-delete'; del.textContent='✕';
    del.style.cssText='opacity:0;position:absolute;right:10px;top:10px;';
    btn.addEventListener('mouseenter',()=>del.style.opacity='1');
    btn.addEventListener('mouseleave',()=>del.style.opacity='0');
    del.addEventListener('click',e=>{
      e.stopPropagation();
      subjects=subjects.filter(s=>s.id!==subj.id);
      if(state.activeSubjectId===subj.id){ state.activeSubjectId=null; document.getElementById('flashcard-subject-view').classList.add('hidden'); document.getElementById('flashcard-placeholder').classList.remove('hidden'); }
      saveSubjects(); renderSubjectList();
    });
    btn.appendChild(del); list.appendChild(btn);
  });
  if(state.activeSubjectId) renderSubjectDetail();
}

function calcSubjectDue(subj){
  const intervals=[0,1,2,4,8];
  let due=0;
  subj.groups.forEach(g=>g.cards.forEach(c=>{
    const box=c.box||1;
    const last=c.lastSeen?c.lastSeen.slice(0,10):null;
    const daysAgo=last?Math.floor((Date.now()-new Date(last))/86400000):999;
    if(daysAgo>=intervals[box-1]) due++;
  }));
  return due;
}

function calcSubjectAccuracy(subj){
  let total=0,correct=0;
  subj.groups.forEach(g=>g.cards.forEach(c=>{
    if(c.totalAnswers){ total+=c.totalAnswers; correct+=(c.correctAnswers||0); }
  }));
  if(!total) return 0;
  return Math.round((correct/total)*100);
}

// =========================
// SUBJECT DETAIL
// =========================

function renderSubjectDetail(){
  const subj=subjects.find(s=>s.id===state.activeSubjectId); if(!subj) return;
  document.getElementById('flashcard-placeholder').classList.add('hidden');
  document.getElementById('flashcard-subject-view').classList.remove('hidden');
  document.getElementById('subject-detail-title').textContent=subj.name;
  document.getElementById('subject-detail-meta').textContent=subj.teacher?`Lehrer: ${subj.teacher}`:'';
  renderGroupList(subj);
}

function renderGroupList(subj){
  const list=document.getElementById('group-list'); list.innerHTML='';
  if(subj.groups.length===0){
    const p=document.createElement('p'); p.className='empty-state'; p.textContent='Noch keine Themengruppen.'; list.appendChild(p); return;
  }
  subj.groups.forEach(group=>{
    const collapsed=collapsedGroups.has(group.id);
    const card=document.createElement('div'); card.className='group-card';

    // Leitner distribution
    const boxes=[0,0,0,0,0];
    group.cards.forEach(c=>{ const b=(c.box||1)-1; boxes[b]=(boxes[b]||0)+1; });
    const dueCount=calcGroupDue(group);
    const pct=calcGroupAccuracy(group);

    // Header
    const head=document.createElement('div'); head.className='group-header';
    const headLeft=document.createElement('div'); headLeft.style.cssText='display:flex;align-items:center;gap:10px;flex:1;cursor:pointer;';
    const toggleIcon=document.createElement('span'); toggleIcon.className='group-toggle-icon'; toggleIcon.textContent=collapsed?'▶':'▼';
    const title=document.createElement('span'); title.className='group-title'; title.textContent=group.name;
    const count=document.createElement('span'); count.className='group-count'; count.textContent=`${group.cards.length} Karten`;
    headLeft.append(toggleIcon,title,count);
    headLeft.addEventListener('click',()=>{
      if(collapsedGroups.has(group.id)){ collapsedGroups.delete(group.id); } else { collapsedGroups.add(group.id); }
      DB.set('collapsedGroups',[...collapsedGroups]); renderGroupList(subj);
    });

    const actions=document.createElement('div'); actions.className='group-actions';
    const addCardBtn=document.createElement('button'); addCardBtn.className='btn-ghost'; addCardBtn.style.cssText='font-size:12px;padding:5px 10px;'; addCardBtn.textContent='+ Karte';
    addCardBtn.addEventListener('click',()=>openFcModal(subj.id,group.id));
    const learnBtn=document.createElement('button'); learnBtn.className='btn-primary'; learnBtn.style.cssText='font-size:12px;padding:5px 10px;';
    learnBtn.textContent=dueCount>0?`Lernen (${dueCount})`:'Lernsession';
    learnBtn.addEventListener('click',()=>startLearnSession(subj.id,group.id));
    const delGroupBtn=document.createElement('button'); delGroupBtn.className='task-delete'; delGroupBtn.style.opacity='1'; delGroupBtn.textContent='✕';
    delGroupBtn.addEventListener('click',()=>{ subj.groups=subj.groups.filter(g=>g.id!==group.id); saveSubjects(); renderGroupList(subj); });
    actions.append(addCardBtn,learnBtn,delGroupBtn);
    head.append(headLeft,actions);
    card.appendChild(head);

    // Group progress bar + leitner badges
    const progRow=document.createElement('div'); progRow.className='group-progress-row';
    const totalCards=group.cards.length||1;
    const leitnerBar=document.createElement('div'); leitnerBar.className='leitner-bar';
    const colors=['#e07a5f','#f2cc8f','#81b29a','#3d7a8a','#2c5f6e']; // Box 1-5
    boxes.forEach((cnt,i)=>{
      if(!cnt) return;
      const seg=document.createElement('div'); seg.className='leitner-seg';
      seg.style.cssText=`width:${(cnt/totalCards)*100}%;background:${colors[i]};`;
      seg.title=`Fach ${i+1}: ${cnt} Karte${cnt!==1?'n':''}`;
      leitnerBar.appendChild(seg);
    });
    const leitnerLegend=document.createElement('div'); leitnerLegend.className='leitner-legend';
    const labels=['Neu','Lernen','Gut','Sehr gut','Sicher'];
    boxes.forEach((cnt,i)=>{ if(!cnt) return;
      const badge=document.createElement('span'); badge.className='leitner-badge';
      badge.style.cssText=`background:${colors[i]}22;color:${colors[i]};border:1px solid ${colors[i]}44;`;
      badge.textContent=`${labels[i]} (${cnt})`;
      leitnerLegend.appendChild(badge);
    });
    progRow.append(leitnerBar, leitnerLegend);
    card.appendChild(progRow);

    // Cards list
    if(!collapsed && group.cards.length>0){
      const cardsList=document.createElement('div'); cardsList.className='cards-list';
      group.cards.sort((a,b)=>(b.box||1)-(a.box||1)).forEach(fc=>{
        const row=document.createElement('div'); row.className='fc-row';
        const front=document.createElement('span'); front.className='fc-front'; front.textContent=fc.front;
        const back=document.createElement('span'); back.className='fc-back'; back.textContent=fc.back;
        const boxLabel=['Neu','Lernen','Gut','Sehr gut','Sicher'][(fc.box||1)-1];
        const boxColors=['#e07a5f','#f2cc8f','#81b29a','#3d7a8a','#2c5f6e'];
        const boxBadge=document.createElement('span'); boxBadge.className='fc-box';
        boxBadge.style.cssText=`background:${boxColors[(fc.box||1)-1]}22;color:${boxColors[(fc.box||1)-1]};border:1px solid ${boxColors[(fc.box||1)-1]}44;`;
        boxBadge.textContent=boxLabel;
        const rowActions=document.createElement('div'); rowActions.style.cssText='display:flex;gap:4px;flex-shrink:0;';
        const editBtn=document.createElement('button'); editBtn.className='task-delete'; editBtn.textContent='✎';
        editBtn.addEventListener('click',()=>openFcModal(subj.id,group.id,fc));
        const delBtn=document.createElement('button'); delBtn.className='task-delete'; delBtn.textContent='✕';
        delBtn.addEventListener('click',()=>{ group.cards=group.cards.filter(c=>c.id!==fc.id); saveSubjects(); renderGroupList(subj); });
        rowActions.append(editBtn,delBtn);
        row.append(front,back,boxBadge,rowActions); cardsList.appendChild(row);
      });
      card.appendChild(cardsList);
    }

    list.appendChild(card);
  });
}

function calcGroupDue(group){
  const intervals=[0,1,2,4,8]; let due=0;
  group.cards.forEach(c=>{
    const box=c.box||1;
    const last=c.lastSeen?c.lastSeen.slice(0,10):null;
    const daysAgo=last?Math.floor((Date.now()-new Date(last))/86400000):999;
    if(daysAgo>=intervals[box-1]) due++;
  });
  return due;
}

function calcGroupAccuracy(group){
  let total=0,correct=0;
  group.cards.forEach(c=>{ if(c.totalAnswers){ total+=c.totalAnswers; correct+=(c.correctAnswers||0); } });
  if(!total) return 0;
  return Math.round((correct/total)*100);
}

// =========================
// ADD SUBJECT / GROUP
// =========================

document.getElementById('add-subject-btn').addEventListener('click',()=>{
  const name=prompt('Fachname:'); if(!name?.trim()) return;
  const teacher=prompt('Lehrer (optional):');
  subjects.push({id:crypto.randomUUID(),name:name.trim(),teacher:(teacher||'').trim(),groups:[]});
  saveSubjects(); renderSubjectList();
});

document.getElementById('add-group-btn').addEventListener('click',()=>{
  const subj=subjects.find(s=>s.id===state.activeSubjectId); if(!subj) return;
  const name=prompt('Name der Themengruppe:'); if(!name?.trim()) return;
  subj.groups.push({id:crypto.randomUUID(),name:name.trim(),cards:[]});
  saveSubjects(); renderGroupList(subj);
});

// =========================
// FC MODAL
// =========================

let fcModalContext=null;

function openFcModal(subjId,groupId,existingCard=null){
  fcModalContext={subjId,groupId,card:existingCard};
  state.editingCard=existingCard;
  document.getElementById('fc-modal-title').textContent=existingCard?'Karteikarte bearbeiten':'Neue Karteikarte';
  document.getElementById('fc-modal-front').value=existingCard?existingCard.front:'';
  document.getElementById('fc-modal-back').value=existingCard?existingCard.back:'';
  document.getElementById('fc-modal-overlay').classList.remove('hidden');
  setTimeout(()=>document.getElementById('fc-modal-front').focus(),50);
}
function closeFcModal(){ document.getElementById('fc-modal-overlay').classList.add('hidden'); fcModalContext=null; state.editingCard=null; }

document.getElementById('fc-modal-close').addEventListener('click',closeFcModal);
document.getElementById('fc-modal-cancel').addEventListener('click',closeFcModal);
document.getElementById('fc-modal-overlay').addEventListener('click',e=>{ if(e.target===document.getElementById('fc-modal-overlay')) closeFcModal(); });
document.getElementById('fc-modal-save').addEventListener('click',()=>{
  const front=document.getElementById('fc-modal-front').value.trim();
  const back=document.getElementById('fc-modal-back').value.trim();
  if(!front||!back||!fcModalContext) return;
  const subj=subjects.find(s=>s.id===fcModalContext.subjId);
  const group=subj?.groups.find(g=>g.id===fcModalContext.groupId); if(!group) return;
  if(state.editingCard){ Object.assign(state.editingCard,{front,back}); }
  else { group.cards.push({id:crypto.randomUUID(),front,back,box:1,lastSeen:null,totalAnswers:0,correctAnswers:0}); }
  saveSubjects(); closeFcModal(); renderGroupList(subj);
});

// =========================
// LEARN SESSION
// =========================

let learnSessionStats = { correct: 0, wrong: 0 };

function startLearnSession(subjId,groupId){
  const subj=subjects.find(s=>s.id===subjId);
  const group=subj?.groups.find(g=>g.id===groupId); if(!group||group.cards.length===0) return;
  // Sort by box asc (lower box = higher priority), then by lastSeen
  const sorted=[...group.cards].sort((a,b)=>(a.box||1)-(b.box||1));
  state.learnQueue=sorted; state.learnIndex=0; state.learnFlipped=false;
  state.learnSubjId=subjId; state.learnGroupId=groupId;
  learnSessionStats={ correct:0, wrong:0 };
  showLearnCard();
  document.getElementById('learn-modal-title').textContent=`${group.name}`;
  document.getElementById('learn-modal-overlay').classList.remove('hidden');
  updateLiveStats();
}

function updateLiveStats(){
  const total=state.learnQueue.length;
  const done=state.learnIndex;
  const remaining=total-done;
  const el=document.getElementById('learn-live-stats');
  if(!el) return;
  el.innerHTML=`
    <div class="learn-stat"><span class="learn-stat-val learn-stat-correct">✓ ${learnSessionStats.correct}</span><span class="learn-stat-lbl">Richtig</span></div>
    <div class="learn-stat"><span class="learn-stat-val learn-stat-wrong">✗ ${learnSessionStats.wrong}</span><span class="learn-stat-lbl">Falsch</span></div>
    <div class="learn-stat"><span class="learn-stat-val">${remaining}</span><span class="learn-stat-lbl">Verbleibend</span></div>
  `;
}

function getMotivationText(remaining, total){
  if(remaining===0) return '';
  if(remaining===1) return '🏁 Noch 1 Karte – fast geschafft!';
  if(remaining<=3) return `✨ Noch ${remaining} Karten!`;
  if(remaining===total) return '🚀 Los geht\'s!';
  const done=total-remaining;
  if(done===1) return '👍 Erste Karte geschafft!';
  const dayStats=getSessionStats();
  if(dayStats.date===getTodayStr() && dayStats.learned>=10) return `🔥 Heute bereits ${dayStats.learned} Karten gelernt!`;
  if(remaining<total/2) return '⚡ Mehr als die Hälfte geschafft!';
  return '';
}

function showLearnCard(){
  const q=state.learnQueue, total=q.length, idx=state.learnIndex;
  const remaining=total-idx;
  document.getElementById('learn-progress-label').textContent=`${idx+1} / ${total}`;
  document.getElementById('learn-progress-bar').style.width=`${(idx/total)*100}%`;
  document.getElementById('learn-done').classList.add('hidden');
  document.getElementById('learn-actions').classList.add('hidden');
  document.getElementById('learn-card-wrap').style.display='';
  const motivEl=document.getElementById('learn-motivation');
  if(motivEl){ const txt=getMotivationText(remaining,total); motivEl.textContent=txt; motivEl.style.display=txt?'':'none'; }
  const card=q[idx];
  const inner=document.getElementById('learn-card-inner');
  inner.classList.remove('flipped');
  state.learnFlipped=false;
  document.getElementById('learn-card-front').textContent=card.front;
  document.getElementById('learn-card-back').textContent=card.back;
  document.getElementById('learn-card-hint').textContent='Klicken zum Umdrehen';
  updateLiveStats();
}

window.flipLearnCard=function(){
  if(state.learnFlipped) return;
  state.learnFlipped=true;
  document.getElementById('learn-card-inner').classList.add('flipped');
  document.getElementById('learn-card-hint').textContent='';
  document.getElementById('learn-actions').classList.remove('hidden');
};

document.getElementById('learn-knew').addEventListener('click',()=>answerLearn(true));
document.getElementById('learn-didnt').addEventListener('click',()=>answerLearn(false));

function answerLearn(knew){
  const q=state.learnQueue, card=q[state.learnIndex];
  const subj=subjects.find(s=>s.id===state.learnSubjId);
  const group=subj?.groups.find(g=>g.id===state.learnGroupId);
  if(group){
    const realCard=group.cards.find(c=>c.id===card.id);
    if(realCard){
      realCard.box=knew?Math.min((realCard.box||1)+1,5):1;
      realCard.lastSeen=new Date().toISOString();
      realCard.totalAnswers=(realCard.totalAnswers||0)+1;
      if(knew) realCard.correctAnswers=(realCard.correctAnswers||0)+1;
      saveSubjects();
    }
  }
  if(knew) learnSessionStats.correct++; else learnSessionStats.wrong++;
  recordAnswer(knew);
  state.learnIndex++;
  if(state.learnIndex>=q.length){
    // Session abgeschlossen
    recordSessionDone();
    showSessionDone(q.length);
    document.getElementById('learn-card-wrap').style.display='none';
    document.getElementById('learn-actions').classList.add('hidden');
    document.getElementById('learn-progress-bar').style.width='100%';
    document.getElementById('learn-progress-label').textContent=`${q.length} / ${q.length}`;
    const motivEl=document.getElementById('learn-motivation');
    if(motivEl){ motivEl.style.display='none'; }
    updateLiveStats();
    if(group) renderGroupList(subj);
    renderSubjectList();
  } else {
    showLearnCard();
  }
}

function showSessionDone(total){
  const correct=learnSessionStats.correct;
  const wrong=learnSessionStats.wrong;
  const pct=total>0?Math.round((correct/total)*100):0;
  const streak=getStreak();
  let rating='';
  if(pct===100) rating='🏆 Perfekt!';
  else if(pct>=80) rating='⭐ Super!';
  else if(pct>=60) rating='👍 Gut!';
  else rating='💪 Weiter so!';
  document.getElementById('learn-done').classList.remove('hidden');
  document.getElementById('learn-done').innerHTML=`
    <div class="session-done-wrap">
      <div class="session-done-emoji">${rating}</div>
      <div class="session-done-stats">
        <div class="session-done-stat">
          <span class="session-done-val">${total}</span>
          <span class="session-done-lbl">Bearbeitet</span>
        </div>
        <div class="session-done-stat learn-stat-correct">
          <span class="session-done-val">✓ ${correct}</span>
          <span class="session-done-lbl">Richtig</span>
        </div>
        <div class="session-done-stat learn-stat-wrong">
          <span class="session-done-val">✗ ${wrong}</span>
          <span class="session-done-lbl">Falsch</span>
        </div>
        <div class="session-done-stat">
          <span class="session-done-val">${pct}%</span>
          <span class="session-done-lbl">Trefferquote</span>
        </div>
      </div>
      ${streak.streak>1?`<div class="session-done-streak">🔥 ${streak.streak} Tage Lernserie!</div>`:''}
      <div class="modal-actions" style="justify-content:center;gap:10px;">
        <button id="learn-restart" class="btn-primary">Nochmal</button>
        <button id="learn-back-subject" class="btn-ghost">Zum Fach</button>
      </div>
    </div>
  `;
  document.getElementById('learn-restart').addEventListener('click',()=>startLearnSession(state.learnSubjId,state.learnGroupId));
  document.getElementById('learn-back-subject').addEventListener('click',()=>{
    document.getElementById('learn-modal-overlay').classList.add('hidden');
  });
}

document.getElementById('learn-modal-close').addEventListener('click',()=>{
  document.getElementById('learn-modal-overlay').classList.add('hidden');
  const subj=subjects.find(s=>s.id===state.learnSubjId);
  if(subj){ renderGroupList(subj); renderSubjectList(); }
});
document.getElementById('learn-modal-overlay').addEventListener('click',e=>{
  if(e.target===document.getElementById('learn-modal-overlay')){
    document.getElementById('learn-modal-overlay').classList.add('hidden');
    const subj=subjects.find(s=>s.id===state.learnSubjId);
    if(subj){ renderGroupList(subj); renderSubjectList(); }
  }
});
