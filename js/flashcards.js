// =========================
// FLASHCARDS — with collapsible groups
// =========================

function saveSubjects(){DB.set('subjects',subjects);}

function renderSubjectList(){
  const list=document.getElementById('subject-list'); list.innerHTML='';
  const empty=document.getElementById('subject-empty');
  if(subjects.length===0){empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  subjects.forEach(subj=>{
    const cardCount=subj.groups.reduce((s,g)=>s+g.cards.length,0);
    const btn=document.createElement('button'); btn.className='subject-item'+(state.activeSubjectId===subj.id?' active':'');
    btn.innerHTML=`<span class="subject-name">${escHtml(subj.name)}</span><span class="subject-teacher">${escHtml(subj.teacher||'')}</span><span class="subject-count">${cardCount} Karten</span>`;
    btn.addEventListener('click',()=>{state.activeSubjectId=subj.id;renderSubjectList();renderSubjectDetail();});
    btn.style.position='relative';
    const del=document.createElement('button'); del.className='task-delete'; del.textContent='✕';
    del.style.cssText='opacity:0;position:absolute;right:10px;top:50%;transform:translateY(-50%)';
    btn.addEventListener('mouseenter',()=>del.style.opacity='1');
    btn.addEventListener('mouseleave',()=>del.style.opacity='0');
    del.addEventListener('click',e=>{
      e.stopPropagation();
      subjects=subjects.filter(s=>s.id!==subj.id);
      if(state.activeSubjectId===subj.id){state.activeSubjectId=null;document.getElementById('flashcard-subject-view').classList.add('hidden');document.getElementById('flashcard-placeholder').classList.remove('hidden');}
      saveSubjects();renderSubjectList();
    });
    btn.appendChild(del); list.appendChild(btn);
  });
  if(state.activeSubjectId) renderSubjectDetail();
}

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

    // Header with collapse toggle
    const head=document.createElement('div'); head.className='group-header';
    const headLeft=document.createElement('div'); headLeft.style.cssText='display:flex;align-items:center;gap:10px;flex:1;cursor:pointer;';

    const toggleIcon=document.createElement('span'); toggleIcon.className='group-toggle-icon'; toggleIcon.textContent=collapsed?'▶':'▼';
    const title=document.createElement('span'); title.className='group-title'; title.textContent=group.name;
    const count=document.createElement('span'); count.className='group-count'; count.textContent=`${group.cards.length} Karten`;

    headLeft.append(toggleIcon,title,count);
    headLeft.addEventListener('click',()=>{
      if(collapsedGroups.has(group.id)){ collapsedGroups.delete(group.id); }
      else { collapsedGroups.add(group.id); }
      DB.set('collapsedGroups',[...collapsedGroups]);
      renderGroupList(subj);
    });

    const actions=document.createElement('div'); actions.className='group-actions';
    const addCardBtn=document.createElement('button'); addCardBtn.className='btn-ghost'; addCardBtn.style.fontSize='12px'; addCardBtn.style.padding='5px 10px'; addCardBtn.textContent='+ Karte';
    addCardBtn.addEventListener('click',()=>openFcModal(subj.id,group.id));
    const learnBtn=document.createElement('button'); learnBtn.className='btn-primary'; learnBtn.style.fontSize='12px'; learnBtn.style.padding='5px 10px'; learnBtn.textContent='Lernsession';
    learnBtn.addEventListener('click',()=>startLearnSession(subj.id,group.id));
    const delGroupBtn=document.createElement('button'); delGroupBtn.className='task-delete'; delGroupBtn.style.opacity='1'; delGroupBtn.textContent='✕';
    delGroupBtn.addEventListener('click',()=>{subj.groups=subj.groups.filter(g=>g.id!==group.id);saveSubjects();renderGroupList(subj);});
    actions.append(addCardBtn,learnBtn,delGroupBtn);

    head.append(headLeft,actions);
    card.appendChild(head);

    // Cards — only shown if not collapsed
    if(!collapsed && group.cards.length>0){
      const cardsList=document.createElement('div'); cardsList.className='cards-list';
      group.cards.sort((a,b)=>(b.box||1)-(a.box||1)).forEach(fc=>{
        const row=document.createElement('div'); row.className='fc-row';
        const front=document.createElement('span'); front.className='fc-front'; front.textContent=fc.front;
        const back=document.createElement('span'); back.className='fc-back'; back.textContent=fc.back;
        const boxBadge=document.createElement('span'); boxBadge.className='fc-box'; boxBadge.textContent=`Fach ${fc.box||1}`;
        const rowActions=document.createElement('div'); rowActions.style.cssText='display:flex;gap:4px;flex-shrink:0;';
        const editBtn=document.createElement('button'); editBtn.className='task-delete'; editBtn.textContent='✎';
        editBtn.addEventListener('click',()=>openFcModal(subj.id,group.id,fc));
        const delBtn=document.createElement('button'); delBtn.className='task-delete'; delBtn.textContent='✕';
        delBtn.addEventListener('click',()=>{group.cards=group.cards.filter(c=>c.id!==fc.id);saveSubjects();renderGroupList(subj);});
        rowActions.append(editBtn,delBtn);
        row.append(front,back,boxBadge,rowActions); cardsList.appendChild(row);
      });
      card.appendChild(cardsList);
    }

    list.appendChild(card);
  });
}

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
function closeFcModal(){document.getElementById('fc-modal-overlay').classList.add('hidden');fcModalContext=null;state.editingCard=null;}

document.getElementById('fc-modal-close').addEventListener('click',closeFcModal);
document.getElementById('fc-modal-cancel').addEventListener('click',closeFcModal);
document.getElementById('fc-modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('fc-modal-overlay'))closeFcModal();});
document.getElementById('fc-modal-save').addEventListener('click',()=>{
  const front=document.getElementById('fc-modal-front').value.trim();
  const back=document.getElementById('fc-modal-back').value.trim();
  if(!front||!back||!fcModalContext) return;
  const subj=subjects.find(s=>s.id===fcModalContext.subjId);
  const group=subj?.groups.find(g=>g.id===fcModalContext.groupId); if(!group) return;
  if(state.editingCard){ Object.assign(state.editingCard,{front,back}); }
  else { group.cards.push({id:crypto.randomUUID(),front,back,box:1,lastSeen:null}); }
  saveSubjects(); closeFcModal(); renderGroupList(subj);
});

// =========================
// LEARN SESSION (Leitner)
// =========================

function startLearnSession(subjId,groupId){
  const subj=subjects.find(s=>s.id===subjId);
  const group=subj?.groups.find(g=>g.id===groupId); if(!group||group.cards.length===0) return;
  const sorted=[...group.cards].sort((a,b)=>(a.box||1)-(b.box||1));
  state.learnQueue=sorted; state.learnIndex=0; state.learnFlipped=false;
  state.learnSubjId=subjId; state.learnGroupId=groupId;
  showLearnCard();
  document.getElementById('learn-modal-title').textContent=`${group.name} — ${group.cards.length} Karten`;
  document.getElementById('learn-modal-overlay').classList.remove('hidden');
}

function showLearnCard(){
  const q=state.learnQueue, total=q.length, idx=state.learnIndex;
  document.getElementById('learn-progress-label').textContent=`${idx+1} / ${total}`;
  document.getElementById('learn-progress-bar').style.width=`${(idx/total)*100}%`;
  document.getElementById('learn-done').classList.add('hidden');
  document.getElementById('learn-actions').classList.add('hidden');
  document.getElementById('learn-card-wrap').style.display='';
  const card=q[idx];
  const inner=document.getElementById('learn-card-inner');
  inner.classList.remove('flipped');
  state.learnFlipped=false;
  document.getElementById('learn-card-front').textContent=card.front;
  document.getElementById('learn-card-back').textContent=card.back;
  document.getElementById('learn-card-hint').textContent='Klicken zum Umdrehen';
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
      saveSubjects();
    }
  }
  state.learnIndex++;
  if(state.learnIndex>=q.length){
    document.getElementById('learn-card-wrap').style.display='none';
    document.getElementById('learn-actions').classList.add('hidden');
    document.getElementById('learn-progress-bar').style.width='100%';
    document.getElementById('learn-progress-label').textContent=`${q.length} / ${q.length}`;
    document.getElementById('learn-done').classList.remove('hidden');
    document.getElementById('learn-done-text').textContent=`Geschafft! ${q.length} Karten durchgegangen.`;
    if(group) renderGroupList(subj);
  } else { showLearnCard(); }
}

document.getElementById('learn-restart').addEventListener('click',()=>startLearnSession(state.learnSubjId,state.learnGroupId));
document.getElementById('learn-modal-close').addEventListener('click',()=>{
  document.getElementById('learn-modal-overlay').classList.add('hidden');
  const subj=subjects.find(s=>s.id===state.learnSubjId);
  if(subj) renderGroupList(subj);
});
document.getElementById('learn-modal-overlay').addEventListener('click',e=>{
  if(e.target===document.getElementById('learn-modal-overlay')){
    document.getElementById('learn-modal-overlay').classList.add('hidden');
    const subj=subjects.find(s=>s.id===state.learnSubjId);
    if(subj) renderGroupList(subj);
  }
});


