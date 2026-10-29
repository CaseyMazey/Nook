// =========================
// FLASHCARDS — v2
// Stats-Bar, Modals, Session-Panel, Meatball-Menüs, Schwierige Karten
// =========================

function saveSubjects(){ DB.set('subjects', subjects); }

// Kein Streak mehr (bewusst entfernt: ein zurückgesetzter Zähler nach einem
// verpassten Tag setzt unter Druck statt zu motivieren). Der alte Key
// 'fc_streak' bleibt unangetastet im Speicher, wird aber nicht mehr gelesen.

function getTodayStr(){ return new Date().toISOString().slice(0,10); }

// =========================
// SESSION STATS (daily)
// =========================

function getSessionStats(){
  return DB.get('fc_session_stats', { date: null, learned: 0, correct: 0, wrong: 0, reps: 0 });
}

function recordAnswer(knew){
  let s = getSessionStats();
  const today = getTodayStr();
  if(s.date !== today) s = { date: today, learned: 0, correct: 0, wrong: 0, reps: 0 };
  s.learned++;
  s.reps = (s.reps||0) + 1;
  if(knew) s.correct++; else s.wrong++;
  DB.set('fc_session_stats', s);
}

// =========================
// LEITNER — geteilte Berechnungen
// calcDueCount/calcAccuracy nehmen eine flache Kartenliste, damit Global-,
// Fach- und Gruppen-Ebene dieselbe Logik nutzen statt sie zu duplizieren.
// =========================

const LEITNER_INTERVALS = [0,1,2,4,8];

// Globale Statistik zählt nur aktive Fächer — archivierte bleiben lernbar,
// sollen aber „Heute fällig“ nicht aufblähen
function allCards(){
  return subjects.filter(subj => !isSubjectArchived(subj)).flatMap(subj => subj.groups.flatMap(g => g.cards));
}

function calcDueCount(cards){
  return cards.filter(c => {
    const box = c.box||1;
    const last = c.lastSeen ? c.lastSeen.slice(0,10) : null;
    const daysAgo = last ? Math.floor((Date.now() - new Date(last))/MS_PER_DAY) : 999;
    return daysAgo >= LEITNER_INTERVALS[box-1];
  }).length;
}

function calcAccuracy(cards){
  let total=0, correct=0;
  cards.forEach(c => { if(c.totalAnswers){ total+=c.totalAnswers; correct+=(c.correctAnswers||0); } });
  return total ? Math.round((correct/total)*100) : 0;
}

// =========================
// GLOBAL STATS
// =========================

function calcGlobalStats(){
  const cards = allCards();
  const hardCards = cards.filter(c => c.hard).length;
  const dueToday = calcDueCount(cards);
  const stats = getSessionStats();
  const today2 = getTodayStr();
  const todayLearned = stats.date === today2 ? stats.learned : 0;
  const todayReps = stats.date === today2 ? (stats.reps||0) : 0;
  return { total: cards.length, dueToday, todayLearned, todayReps, hardCards };
}

function calcGlobalAccuracy(){
  return calcAccuracy(allCards());
}

// Schlichte Linien-Icons (currentColor) statt Emojis — folgen jedem Theme
function fcIcon(cls, paths){
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function renderGlobalStats(){
  const s = calcGlobalStats();
  const pct = calcGlobalAccuracy();
  const wrap = document.getElementById('fc-global-stats');
  if(!wrap) return;
  wrap.innerHTML = `
    <div class="fc-stat-card fc-stat-total">
      ${fcIcon('fc-stat-icon', '<rect x="3" y="7" width="14" height="12" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v10"/>')}
      <span class="fc-stat-value">${s.total}</span>
      <span class="fc-stat-label">Karten insgesamt</span>
    </div>
    <div class="fc-stat-card fc-stat-due">
      ${fcIcon('fc-stat-icon', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>')}
      <span class="fc-stat-value">${s.dueToday}</span>
      <span class="fc-stat-label">Heute fällig</span>
    </div>
    <div class="fc-stat-card fc-stat-rate">
      ${fcIcon('fc-stat-icon', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>')}
      <span class="fc-stat-value">${pct}%</span>
      <span class="fc-stat-label">Erfolgsquote</span>
    </div>
  `;
}

// =========================
// SUBJECT LIST + ARCHIV
// Archiv = eigene Gruppen („1. Schuljahr“ …) unter den aktiven Fächern.
// Archivierte Fächer bleiben vollständig lernbar, zählen aber nicht in der
// globalen Statistik. Daten: subject.archiveGroupId (fehlt = aktiv), die
// Gruppen unter 'fc_archive_groups' = [{ id, name }], aufgeklappte Gruppen
// unter 'fc_archive_open' ('root' = das Archiv selbst).
// =========================

let fcArchiveGroups = DB.get('fc_archive_groups', []);
let fcArchiveOpen = new Set(DB.get('fc_archive_open', []));
function saveFcArchiveGroups(){ DB.set('fc_archive_groups', fcArchiveGroups); }
function saveFcArchiveOpen(){ DB.set('fc_archive_open', [...fcArchiveOpen]); }
function toggleFcArchiveOpen(id){
  if(fcArchiveOpen.has(id)) fcArchiveOpen.delete(id); else fcArchiveOpen.add(id);
  saveFcArchiveOpen(); renderSubjectList();
}
// Verweist ein Fach auf eine aufgelöste Gruppe, gilt es wieder als aktiv
function isSubjectArchived(subj){
  return !!subj.archiveGroupId && fcArchiveGroups.some(g => g.id === subj.archiveGroupId);
}

function buildSubjectItem(subj){
  const cardCount = subj.groups.reduce((s,g)=>s+g.cards.length, 0);
  const dueCount = calcSubjectDue(subj);
  const pct = calcSubjectAccuracy(subj);
  const isActive = state.activeSubjectId === subj.id;

  const btn = document.createElement('div');
  btn.className = 'subject-item' + (isActive ? ' active' : '');
  btn.innerHTML = `
    <div class="subject-item-top">
      <span class="subject-name" title="${escHtml(subj.name)}">${escHtml(subj.name)}</span>
      ${dueCount ? `<span class="subject-due-badge" title="${dueCount} heute fällig">${dueCount}</span>` : ''}
      <button class="fc-meatball" data-subj-id="${subj.id}" title="Optionen">⋮</button>
    </div>
    <div class="subject-item-meta">
      <span class="subject-teacher">${escHtml(subj.teacher||'')}</span>
      <span class="subject-item-stats">${cardCount} Karten · ${pct}%</span>
    </div>
    <div class="subject-mini-bar"><div class="subject-mini-fill" style="width:${pct}%"></div></div>
  `;
  btn.addEventListener('click', e => {
    if(e.target.closest('.fc-meatball')) return;
    state.activeSubjectId = subj.id;
    renderSubjectList();
    renderSubjectDetail();
  });
  btn.querySelector('.fc-meatball').addEventListener('click', e => {
    e.stopPropagation();
    openSubjectMenu(subj, e.currentTarget);
  });
  return btn;
}

function renderSubjectList(){
  const list = document.getElementById('subject-list'); list.innerHTML = '';
  const empty = document.getElementById('subject-empty');
  const search = (document.getElementById('fc-subject-search')?.value||'').toLowerCase();
  const matches = s => s.name.toLowerCase().includes(search) || (s.teacher||'').toLowerCase().includes(search);
  renderGlobalStats();
  renderResumeBanner();
  maybeAutoResumeLearnSession();
  if(subjects.length === 0){ empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  const active = subjects.filter(s => !isSubjectArchived(s) && matches(s));
  active.forEach(subj => list.appendChild(buildSubjectItem(subj)));
  if(!active.length && !search){
    const p = document.createElement('p'); p.className = 'fc-archive-empty'; p.textContent = 'Alle Fächer liegen im Archiv.'; list.appendChild(p);
  }

  const archived = subjects.filter(s => isSubjectArchived(s) && matches(s));
  if(fcArchiveGroups.length && (!search || archived.length)){
    // Bei aktiver Suche ist alles mit Treffern aufgeklappt
    const open = !!search || fcArchiveOpen.has('root');
    const sec = document.createElement('div');
    sec.className = 'fc-archive' + (open ? ' open' : '');
    const head = document.createElement('button');
    head.className = 'fc-archive-head';
    head.innerHTML = `<span class="fc-archive-chevron" aria-hidden="true"></span><span>Archiv</span><span class="fc-archive-count">${subjects.filter(isSubjectArchived).length}</span>`;
    head.addEventListener('click', () => { if(!search) toggleFcArchiveOpen('root'); });
    sec.appendChild(head);

    if(open) fcArchiveGroups.forEach(group => {
      const subs = archived.filter(s => s.archiveGroupId === group.id);
      if(search && !subs.length) return;
      const gOpen = !!search || fcArchiveOpen.has(group.id);
      const gEl = document.createElement('div');
      gEl.className = 'fc-archive-group' + (gOpen ? ' open' : '');
      const gHead = document.createElement('div');
      gHead.className = 'fc-archive-group-head';
      gHead.tabIndex = 0; gHead.setAttribute('role', 'button');
      gHead.innerHTML = `<span class="fc-archive-chevron" aria-hidden="true"></span><span class="fc-archive-group-name">${escHtml(group.name)}</span><span class="fc-archive-count">${subs.length}</span><button class="fc-meatball" title="Optionen">⋮</button>`;
      const toggle = () => { if(!search) toggleFcArchiveOpen(group.id); };
      gHead.addEventListener('click', e => { if(!e.target.closest('.fc-meatball')) toggle(); });
      gHead.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); } });
      gHead.querySelector('.fc-meatball').addEventListener('click', e => { e.stopPropagation(); openFcArchiveGroupMenu(group, e.currentTarget); });
      gEl.appendChild(gHead);
      if(gOpen){
        subs.forEach(subj => gEl.appendChild(buildSubjectItem(subj)));
        if(!subs.length){
          const p = document.createElement('p'); p.className = 'fc-archive-empty'; p.textContent = 'Leer – Fächer über ⋮ → „Ins Archiv“ hierher verschieben.'; gEl.appendChild(p);
        }
      }
      sec.appendChild(gEl);
    });
    list.appendChild(sec);
  }
  if(state.activeSubjectId) renderSubjectDetail();
}

function openFcArchiveGroupMenu(group, anchor){
  closeAllMenus();
  const menu = document.createElement('div');
  menu.className = 'fc-context-menu';
  menu.innerHTML = `
    <button class="fc-menu-item" data-action="rename">✏️ Umbenennen</button>
    <button class="fc-menu-item fc-menu-danger" data-action="dissolve">🗑️ Gruppe auflösen</button>
  `;
  menu.querySelector('[data-action="rename"]').addEventListener('click', () => { closeAllMenus(); openFcArchiveModal(null, group); });
  menu.querySelector('[data-action="dissolve"]').addEventListener('click', async () => {
    closeAllMenus();
    const ok = await hubConfirm({ title: `„${group.name}“ auflösen?`, message: 'Die Fächer darin kommen zurück zu den aktiven Fächern. Es gehen keine Karten verloren.', confirmText: 'Auflösen', danger: true });
    if(!ok) return;
    subjects.forEach(s => { if(s.archiveGroupId === group.id) delete s.archiveGroupId; });
    fcArchiveGroups = fcArchiveGroups.filter(g => g.id !== group.id);
    fcArchiveOpen.delete(group.id);
    saveSubjects(); saveFcArchiveGroups(); saveFcArchiveOpen(); renderSubjectList();
  });
  positionMenu(menu, anchor);
}

// Ein Modal für beides: Fach in eine Archiv-Gruppe verschieben (Auswahl oder
// neue Gruppe) und eine Archiv-Gruppe umbenennen (nur Namensfeld)
let fcArchiveModalContext = null;
const fcArchiveModal = wireModal('fc-archive-modal-overlay', {
  closeIds: ['fc-archive-modal-close', 'fc-archive-modal-cancel'],
  inputId: 'fc-archive-name-input',
  saveId: 'fc-archive-modal-save',
  onClose: () => { fcArchiveModalContext = null; },
});

function syncFcArchiveNameRow(){
  const ctx = fcArchiveModalContext;
  const show = !!ctx && (!!ctx.group || document.getElementById('fc-archive-group-select').value === 'new');
  document.getElementById('fc-archive-name-row').classList.toggle('hidden', !show);
}

function openFcArchiveModal(subj, group = null){
  fcArchiveModalContext = { subjId: subj ? subj.id : null, group };
  const select = document.getElementById('fc-archive-group-select');
  const nameInput = document.getElementById('fc-archive-name-input');
  document.getElementById('fc-archive-modal-title').textContent = group ? 'Archiv-Gruppe umbenennen' : (subj && isSubjectArchived(subj) ? 'Archiv-Gruppe wechseln' : 'Ins Archiv verschieben');
  document.getElementById('fc-archive-modal-save').textContent = group ? 'Speichern' : 'Verschieben';
  document.getElementById('fc-archive-select-row').classList.toggle('hidden', !!group);
  document.getElementById('fc-archive-name-label').textContent = group ? 'Name' : 'Name der neuen Gruppe';
  nameInput.value = group ? group.name : '';
  if(!group){
    select.innerHTML = fcArchiveGroups.map(g => `<option value="${g.id}">${escHtml(g.name)}</option>`).join('') + '<option value="new">＋ Neue Gruppe…</option>';
    const current = subj && isSubjectArchived(subj) ? subj.archiveGroupId : null;
    select.value = current || (fcArchiveGroups.length ? fcArchiveGroups[fcArchiveGroups.length-1].id : 'new');
  }
  syncFcArchiveNameRow();
  fcArchiveModal.open();
  setTimeout(() => (group || select.value === 'new' ? nameInput : select).focus(), 50);
}

document.getElementById('fc-archive-group-select').addEventListener('change', () => {
  syncFcArchiveNameRow();
  if(document.getElementById('fc-archive-group-select').value === 'new') document.getElementById('fc-archive-name-input').focus();
});

document.getElementById('fc-archive-modal-save').addEventListener('click', () => {
  const ctx = fcArchiveModalContext; if(!ctx) return;
  const name = document.getElementById('fc-archive-name-input').value.trim();
  if(ctx.group){
    if(!name) return;
    ctx.group.name = name; saveFcArchiveGroups();
  } else {
    const subj = subjects.find(s => s.id === ctx.subjId); if(!subj) return;
    let groupId = document.getElementById('fc-archive-group-select').value;
    if(groupId === 'new'){
      if(!name) return;
      const g = { id: crypto.randomUUID(), name };
      fcArchiveGroups.push(g); saveFcArchiveGroups(); groupId = g.id;
    }
    subj.archiveGroupId = groupId;
    // Ziel sichtbar machen, damit das Fach nicht scheinbar verschwindet
    fcArchiveOpen.add('root'); fcArchiveOpen.add(groupId); saveFcArchiveOpen();
    saveSubjects();
  }
  fcArchiveModal.close(); renderSubjectList();
});

function openSubjectMenu(subj, anchor){
  closeAllMenus();
  const menu = document.createElement('div');
  menu.className = 'fc-context-menu';
  const archived = isSubjectArchived(subj);
  menu.innerHTML = `
    <button class="fc-menu-item" data-action="edit">✏️ Bearbeiten</button>
    ${archived ? `<button class="fc-menu-item" data-action="archive">🗄️ Archiv-Gruppe wechseln</button>
    <button class="fc-menu-item" data-action="unarchive">↩️ Aus dem Archiv holen</button>`
      : `<button class="fc-menu-item" data-action="archive">🗄️ Ins Archiv…</button>`}
    <button class="fc-menu-item" data-action="export">📤 Exportieren</button>
    <button class="fc-menu-item fc-menu-danger" data-action="delete">🗑️ Löschen</button>
  `;
  menu.querySelector('[data-action="edit"]').addEventListener('click', () => { closeAllMenus(); openSubjectEditModal(subj); });
  menu.querySelector('[data-action="archive"]').addEventListener('click', () => { closeAllMenus(); openFcArchiveModal(subj); });
  menu.querySelector('[data-action="unarchive"]')?.addEventListener('click', () => { closeAllMenus(); delete subj.archiveGroupId; saveSubjects(); renderSubjectList(); });
  menu.querySelector('[data-action="export"]').addEventListener('click', () => { closeAllMenus(); exportSubject(subj); });
  menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
    closeAllMenus();
    if(!confirm(`Fach "${subj.name}" wirklich löschen? Alle Karten gehen verloren.`)) return;
    subjects = subjects.filter(s => s.id !== subj.id);
    if(state.activeSubjectId === subj.id){ state.activeSubjectId = null; document.getElementById('flashcard-subject-view').classList.add('hidden'); document.getElementById('flashcard-placeholder').classList.remove('hidden'); renderSubjectToc(null); }
    saveSubjects(); renderSubjectList();
  });
  positionMenu(menu, anchor);
}

function openGroupMenu(subj, group, anchor){
  closeAllMenus();
  const menu = document.createElement('div');
  menu.className = 'fc-context-menu';
  menu.innerHTML = `
    <button class="fc-menu-item" data-action="rename">✏️ Umbenennen</button>
    <button class="fc-menu-item" data-action="export">📤 Exportieren</button>
    <button class="fc-menu-item fc-menu-danger" data-action="delete">🗑️ Löschen</button>
  `;
  menu.querySelector('[data-action="rename"]').addEventListener('click', () => { closeAllMenus(); openGroupModal(subj.id, group); });
  menu.querySelector('[data-action="export"]').addEventListener('click', () => { closeAllMenus(); exportGroup(subj, group); });
  menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
    closeAllMenus();
    if(!confirm(`Gruppe "${group.name}" wirklich löschen?`)) return;
    subj.groups = subj.groups.filter(g => g.id !== group.id);
    (subj.exams || []).forEach(ex => { ex.groupIds = ex.groupIds.filter(id => id !== group.id); });
    saveSubjects(); renderGroupList(subj); renderExamList(subj);
  });
  positionMenu(menu, anchor);
}

function openCardMenu(subj, group, fc, anchor){
  closeAllMenus();
  const menu = document.createElement('div');
  menu.className = 'fc-context-menu';
  const isHard = !!fc.hard;
  menu.innerHTML = `
    <button class="fc-menu-item" data-action="edit">✏️ Bearbeiten</button>
    <button class="fc-menu-item" data-action="duplicate">📋 Duplizieren</button>
    <button class="fc-menu-item" data-action="hard">${isHard ? '⭐ Schwierig entfernen' : '⭐ Als schwierig markieren'}</button>
    <button class="fc-menu-item" data-action="export">📤 Exportieren</button>
    <button class="fc-menu-item fc-menu-danger" data-action="delete">🗑️ Löschen</button>
  `;
  menu.querySelector('[data-action="edit"]').addEventListener('click', () => { closeAllMenus(); openFcModal(subj.id, group.id, fc); });
  menu.querySelector('[data-action="duplicate"]').addEventListener('click', () => {
    closeAllMenus();
    const copy = {...fc, id: crypto.randomUUID(), box:1, lastSeen:null, totalAnswers:0, correctAnswers:0, front: fc.front+' (Kopie)'};
    group.cards.push(copy); saveSubjects(); renderGroupList(subj);
  });
  menu.querySelector('[data-action="hard"]').addEventListener('click', () => {
    closeAllMenus();
    fc.hard = !fc.hard; saveSubjects(); renderGroupList(subj); renderGlobalStats();
    if(learnSession.active && learnSession.subjId===subj.id && learnSession.groupIds.includes(group.id)) renderHardCardsPanel(subj);
  });
  menu.querySelector('[data-action="export"]').addEventListener('click', () => { closeAllMenus(); exportCard(fc); });
  menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
    closeAllMenus();
    group.cards = group.cards.filter(c => c.id !== fc.id); saveSubjects(); renderGroupList(subj);
  });
  positionMenu(menu, anchor);
}

function positionMenu(menu, anchor){
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.cssText = `position:fixed;z-index:9999;top:${r.bottom+4}px;left:${r.left}px;`;
  // Flip left if overflow right
  const mr = menu.getBoundingClientRect();
  if(mr.right > window.innerWidth - 8) menu.style.left = Math.max(8, r.right - mr.width) + 'px';
  // Flip up if overflow bottom (z.B. über der Bottom-Nav am Handy)
  if(mr.bottom > window.innerHeight - 8) menu.style.top = Math.max(8, r.top - mr.height - 4) + 'px';
}

function closeAllMenus(){
  document.querySelectorAll('.fc-context-menu').forEach(m => m.remove());
}
document.addEventListener('click', () => closeAllMenus());
document.addEventListener('keydown', e => { if(e.key==='Escape') closeAllMenus(); });

// =========================
// SUBJECT DETAIL
// =========================

function calcSubjectDue(subj){
  return calcDueCount(subj.groups.flatMap(g => g.cards));
}

function calcSubjectAccuracy(subj){
  return calcAccuracy(subj.groups.flatMap(g => g.cards));
}

function renderSubjectDetail(){
  const subj = subjects.find(s => s.id === state.activeSubjectId); if(!subj) return;
  document.getElementById('flashcard-placeholder').classList.add('hidden');
  document.getElementById('flashcard-subject-view').classList.remove('hidden');
  document.getElementById('subject-detail-title').textContent = subj.name;
  document.getElementById('subject-detail-meta').textContent = subj.teacher ? `Lehrer: ${subj.teacher}` : '';
  renderExamList(subj);
  renderGroupList(subj);
}

// =========================
// GROUP LIST
// =========================

function renderGroupList(subj){
  const list = document.getElementById('group-list'); list.innerHTML = '';
  if(subj.groups.length === 0){
    const p = document.createElement('p'); p.className='empty-state'; p.textContent='Noch keine Themengruppen.'; list.appendChild(p); renderSubjectToc(subj); return;
  }
  subj.groups.forEach(group => {
    const collapsed = collapsedGroups.has(group.id);
    const boxes = [0,0,0,0,0];
    group.cards.forEach(c => { const b=(c.box||1)-1; boxes[b]=(boxes[b]||0)+1; });
    const dueCount = calcGroupDue(group);
    const pct = calcGroupAccuracy(group);
    const totalCards = group.cards.length;

    const card = document.createElement('div'); card.className='group-card' + (collapsed ? ' collapsed' : ''); card.dataset.groupId = group.id;

    // Header
    const head = document.createElement('div'); head.className='group-header';
    const headLeft = document.createElement('div'); headLeft.style.cssText='display:flex;align-items:center;gap:10px;flex:1;cursor:pointer;min-width:0;';
    const toggleIcon = document.createElement('span'); toggleIcon.className='group-toggle-icon'; toggleIcon.textContent=collapsed?'▶':'▼';
    const title = document.createElement('span'); title.className='group-title'; title.textContent=group.name;
    const meta = document.createElement('span'); meta.className='group-count'; meta.textContent=`${totalCards} Karten${dueCount>0?' · '+dueCount+' fällig':''}`;
    headLeft.append(toggleIcon, title, meta);
    headLeft.addEventListener('click', () => {
      if(collapsedGroups.has(group.id)){ collapsedGroups.delete(group.id); } else { collapsedGroups.add(group.id); }
      DB.set('collapsedGroups', [...collapsedGroups]); renderGroupList(subj);
    });

    const actions = document.createElement('div'); actions.className='group-actions';
    const addCardBtn = document.createElement('button'); addCardBtn.className='btn-ghost'; addCardBtn.style.cssText='font-size:12px;padding:5px 10px;'; addCardBtn.textContent='+ Karte';
    addCardBtn.addEventListener('click', () => openFcModal(subj.id, group.id));
    const learnBtn = document.createElement('button'); learnBtn.className='btn-primary'; learnBtn.style.cssText='font-size:12px;padding:5px 10px;';
    learnBtn.textContent = dueCount>0 ? `▶ Lernen (${dueCount})` : '▶ Lernsession';
    learnBtn.addEventListener('click', () => startLearnSession(subj.id, group.id));
    const meatball = document.createElement('button'); meatball.className='fc-meatball'; meatball.textContent='⋮';
    meatball.addEventListener('click', e => { e.stopPropagation(); openGroupMenu(subj, group, meatball); });
    actions.append(addCardBtn, learnBtn, meatball);
    head.append(headLeft, actions);
    card.appendChild(head);

    // Leitner progress bar
    const progRow = document.createElement('div'); progRow.className='group-progress-row';
    const colors = ['var(--leitner-1)','var(--leitner-2)','var(--leitner-3)','var(--leitner-4)','var(--leitner-5)'];
    const labels = ['Neu','Lernen','Gut','Sehr gut','Sicher'];
    const leitnerBar = document.createElement('div'); leitnerBar.className='leitner-bar';
    boxes.forEach((cnt,i) => {
      if(!cnt) return;
      const seg = document.createElement('div'); seg.className='leitner-seg';
      seg.style.cssText = `width:${totalCards>0?(cnt/totalCards)*100:0}%;background:${colors[i]};`;
      seg.title = `Fach ${i+1}: ${cnt} Karte${cnt!==1?'n':''}`;
      leitnerBar.appendChild(seg);
    });
    const leitnerLegend = document.createElement('div'); leitnerLegend.className='leitner-legend';
    progRow.title = labels.map((l,i) => boxes[i] ? `${l}: ${boxes[i]}` : '').filter(Boolean).join(' · ');
    boxes.forEach((cnt,i) => {
      if(!cnt) return;
      const badge = document.createElement('span'); badge.className='leitner-badge';
      badge.style.setProperty('--lc', colors[i]);
      badge.textContent = `${labels[i]} (${cnt})`;
      leitnerLegend.appendChild(badge);
    });
    progRow.append(leitnerBar, leitnerLegend);
    card.appendChild(progRow);

    // Cards list
    if(!collapsed && group.cards.length > 0){
      const cardsList = document.createElement('div'); cardsList.className='cards-list';
      [...group.cards].sort((a,b)=>(b.box||1)-(a.box||1)).forEach(fc => {
        const row = document.createElement('div'); row.className='fc-row';
        const front = document.createElement('span'); front.className='fc-front';
        front.innerHTML = (fc.hard ? '<span class="fc-hard-star" title="Schwierig">⭐</span> ' : '') + escHtml(fc.front);
        const back = document.createElement('span'); back.className='fc-back'; back.textContent=fc.back;
        const boxLabel = labels[(fc.box||1)-1];
        const boxBadge = document.createElement('span'); boxBadge.className='fc-box';
        boxBadge.style.setProperty('--lc', colors[(fc.box||1)-1]);
        boxBadge.textContent = boxLabel;
        const meatball = document.createElement('button'); meatball.className='fc-meatball fc-card-meatball'; meatball.textContent='⋮';
        meatball.addEventListener('click', e => { e.stopPropagation(); openCardMenu(subj, group, fc, meatball); });
        row.append(front, back, boxBadge, meatball);
        cardsList.appendChild(row);
      });
      card.appendChild(cardsList);
    }

    list.appendChild(card);
  });

  // Themengruppe hinzufügen Button am Ende
  const addGroupWrap = document.createElement('div');
  addGroupWrap.style.cssText = 'padding:10px 0;';
  const addGroupBtn2 = document.createElement('button');
  addGroupBtn2.className = 'btn-ghost';
  addGroupBtn2.style.cssText = 'width:100%;font-size:13px;';
  addGroupBtn2.textContent = '+ Themengruppe hinzufügen';
  addGroupBtn2.addEventListener('click', () => openGroupModal(subj.id));
  addGroupWrap.appendChild(addGroupBtn2);
  list.appendChild(addGroupWrap);
  renderSubjectToc(subj);
}

// =========================
// INHALTSVERZEICHNIS (linke Spalte unter „Fächer“)
// Prüfungen + Themengruppen des gewählten Fachs; Klick klappt die Gruppe
// auf und springt hin. Reine Navigation, ändert nur collapsedGroups.
// =========================

function renderSubjectToc(subj){
  const toc = document.getElementById('fc-toc');
  const body = document.getElementById('fc-toc-body');
  if(!toc || !body) return;
  if(!subj || (!subj.groups.length && !(subj.exams || []).length)){ toc.classList.add('hidden'); return; }
  toc.classList.remove('hidden');
  const exams = subj.exams || [];
  const allCollapsed = subj.groups.length > 0 && subj.groups.every(g => collapsedGroups.has(g.id));
  body.innerHTML = `
    ${exams.length ? `<div class="fc-toc-section">Prüfungen</div>
      ${exams.map(ex => `<button class="fc-toc-item fc-toc-exam" data-exam-id="${ex.id}"><span class="fc-toc-name">${escHtml(ex.name)}</span></button>`).join('')}` : ''}
    <div class="fc-toc-section">Themen <button class="fc-toc-toggle-all">${allCollapsed ? 'Alle aufklappen' : 'Alle einklappen'}</button></div>
    ${subj.groups.map(g => {
      const due = calcDueCount(g.cards);
      return `<button class="fc-toc-item" data-group-id="${g.id}"><span class="fc-toc-name">${escHtml(g.name)}</span><span class="fc-toc-count${due ? ' subject-due' : ''}">${due ? due + ' fällig' : g.cards.length}</span></button>`;
    }).join('')}`;

  body.querySelectorAll('.fc-toc-item[data-group-id]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.groupId;
    if(collapsedGroups.has(id)){ collapsedGroups.delete(id); DB.set('collapsedGroups', [...collapsedGroups]); renderGroupList(subj); }
    document.querySelector(`.group-card[data-group-id="${id}"]`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }));
  body.querySelectorAll('.fc-toc-exam').forEach(btn => btn.addEventListener('click', () => {
    document.querySelector(`.fc-exam-card[data-exam-id="${btn.dataset.examId}"]`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }));
  body.querySelector('.fc-toc-toggle-all')?.addEventListener('click', () => {
    subj.groups.forEach(g => { if(allCollapsed) collapsedGroups.delete(g.id); else collapsedGroups.add(g.id); });
    DB.set('collapsedGroups', [...collapsedGroups]); renderGroupList(subj);
  });
}

// Auf dem Handy steht das Verzeichnis über dem Inhalt — dort zugeklappt starten
if(window.matchMedia('(max-width: 480px)').matches) document.getElementById('fc-toc')?.removeAttribute('open');

function calcGroupDue(group){
  return calcDueCount(group.cards);
}

function calcGroupAccuracy(group){
  return calcAccuracy(group.cards);
}

// =========================
// MODALS: FACH ERSTELLEN
// =========================

const subjectModal = wireModal('fc-subject-modal-overlay', {
  closeIds: ['fc-subject-modal-close', 'fc-subject-modal-cancel'],
  inputId: 'fc-subject-name-input',
  saveId: 'fc-subject-modal-save',
});
function openSubjectModal(){
  document.getElementById('fc-subject-name-input').value = '';
  document.getElementById('fc-subject-teacher-input').value = '';
  subjectModal.open();
  setTimeout(() => document.getElementById('fc-subject-name-input').focus(), 50);
}
function closeSubjectModal(){ subjectModal.close(); }

document.getElementById('fc-subject-modal-save').addEventListener('click', () => {
  const name = document.getElementById('fc-subject-name-input').value.trim();
  const teacher = document.getElementById('fc-subject-teacher-input').value.trim();
  if(!name) return;
  subjects.push({ id: crypto.randomUUID(), name, teacher, groups: [] });
  saveSubjects(); closeSubjectModal(); renderSubjectList();
});

// Beide Add-Subject Buttons
document.getElementById('add-subject-btn').addEventListener('click', openSubjectModal);
document.getElementById('add-subject-btn-2').addEventListener('click', openSubjectModal);

// =========================
// MODALS: FACH BEARBEITEN
// =========================

let editingSubjectId = null;
const subjectEditModal = wireModal('fc-subject-edit-modal-overlay', {
  closeIds: ['fc-subject-edit-modal-close', 'fc-subject-edit-modal-cancel'],
  inputId: 'fc-subject-edit-name-input',
  saveId: 'fc-subject-edit-modal-save',
  onClose: () => { editingSubjectId = null; },
});

function openSubjectEditModal(subj){
  editingSubjectId = subj.id;
  document.getElementById('fc-subject-edit-name-input').value = subj.name;
  document.getElementById('fc-subject-edit-teacher-input').value = subj.teacher||'';
  subjectEditModal.open();
  setTimeout(() => document.getElementById('fc-subject-edit-name-input').focus(), 50);
}
function closeSubjectEditModal(){ subjectEditModal.close(); }

document.getElementById('fc-subject-edit-modal-save').addEventListener('click', () => {
  const name = document.getElementById('fc-subject-edit-name-input').value.trim();
  const teacher = document.getElementById('fc-subject-edit-teacher-input').value.trim();
  if(!name || !editingSubjectId) return;
  const subj = subjects.find(s => s.id === editingSubjectId); if(!subj) return;
  subj.name = name; subj.teacher = teacher;
  saveSubjects(); closeSubjectEditModal(); renderSubjectList();
  if(state.activeSubjectId === editingSubjectId) renderSubjectDetail();
});

// =========================
// MODALS: THEMENGRUPPE
// =========================

let groupModalContext = null; // { subjId, group? }
const groupModal = wireModal('fc-group-modal-overlay', {
  closeIds: ['fc-group-modal-close', 'fc-group-modal-cancel'],
  inputId: 'fc-group-name-input',
  saveId: 'fc-group-modal-save',
  onClose: () => { groupModalContext = null; },
});

function openGroupModal(subjId, existingGroup=null){
  groupModalContext = { subjId, group: existingGroup };
  document.getElementById('fc-group-modal-title').textContent = existingGroup ? 'Themengruppe umbenennen' : 'Neue Themengruppe';
  document.getElementById('fc-group-modal-save').textContent = existingGroup ? 'Speichern' : 'Erstellen';
  document.getElementById('fc-group-name-input').value = existingGroup ? existingGroup.name : '';
  groupModal.open();
  setTimeout(() => document.getElementById('fc-group-name-input').focus(), 50);
}
function closeGroupModal(){ groupModal.close(); }

document.getElementById('fc-group-modal-save').addEventListener('click', () => {
  const name = document.getElementById('fc-group-name-input').value.trim();
  if(!name || !groupModalContext) return;
  const subj = subjects.find(s => s.id === groupModalContext.subjId); if(!subj) return;
  if(groupModalContext.group){
    groupModalContext.group.name = name;
  } else {
    subj.groups.push({ id: crypto.randomUUID(), name, cards: [] });
  }
  saveSubjects(); closeGroupModal(); renderGroupList(subj);
});

document.getElementById('add-group-btn').addEventListener('click', () => {
  const subj = subjects.find(s => s.id === state.activeSubjectId); if(!subj) return;
  openGroupModal(subj.id);
});

// =========================
// FC MODAL (Karte)
// =========================

let fcModalContext = null;
// Kein saveId — Vorder-/Rückseite sind Textareas, Enter soll dort einen
// Zeilenumbruch einfügen, nicht speichern. Escape schließt trotzdem (über
// inputId), Enter im Feld hat keine Sonderbedeutung.
const fcModal = wireModal('fc-modal-overlay', {
  closeIds: ['fc-modal-close', 'fc-modal-cancel'],
  inputId: 'fc-modal-front',
  onClose: () => { fcModalContext = null; state.editingCard = null; },
});

function openFcModal(subjId, groupId, existingCard=null){
  fcModalContext = { subjId, groupId, card: existingCard };
  state.editingCard = existingCard;
  document.getElementById('fc-modal-title').textContent = existingCard ? 'Karteikarte bearbeiten' : 'Neue Karteikarte';
  document.getElementById('fc-modal-front').value = existingCard ? existingCard.front : '';
  document.getElementById('fc-modal-back').value = existingCard ? existingCard.back : '';
  fcModal.open();
  setTimeout(() => document.getElementById('fc-modal-front').focus(), 50);
}
function closeFcModal(){ fcModal.close(); }

document.getElementById('fc-modal-save').addEventListener('click', () => {
  const front = document.getElementById('fc-modal-front').value.trim();
  const back = document.getElementById('fc-modal-back').value.trim();
  if(!front||!back||!fcModalContext) return;
  const subj = subjects.find(s => s.id === fcModalContext.subjId);
  const group = subj?.groups.find(g => g.id === fcModalContext.groupId); if(!group) return;
  if(state.editingCard){ Object.assign(state.editingCard, {front, back}); }
  else { group.cards.push({id:crypto.randomUUID(),front,back,box:1,lastSeen:null,totalAnswers:0,correctAnswers:0,hard:false}); }
  saveSubjects(); closeFcModal(); renderGroupList(subj);
});

// Fach-Suchfeld
document.getElementById('fc-subject-search')?.addEventListener('input', () => renderSubjectList());

// =========================
// LEARN SESSION (Panel)
// =========================

const learnSession = {
  active: false,
  queue: [],
  index: 0,
  flipped: false,
  subjId: null,
  groupIds: [],   // eine Themengruppe oder alle Themen einer Prüfung
  exam: null,     // { id, name } bei Prüfungs-Session, sonst null
  stats: { correct: 0, wrong: 0 },
  leitnerChanges: [] // { card, from, to }
};

function startLearnSession(subjId, groupId){
  startGroupsLearnSession(subjId, [groupId], null);
}

// Themengruppen der laufenden Session (nur noch existierende)
function learnSessionGroups(subj){
  return (subj?.groups || []).filter(g => learnSession.groupIds.includes(g.id));
}

function shuffleCards(cards){
  const a = [...cards];
  for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Gleiche Vorderseite = gleiche Karte. In einer Prüfung über mehrere Themen
// steckt dieselbe Frage oft in zwei Themengruppen (z. B. aus zwei
// Lernzetteln) — in der Session soll sie trotzdem nur einmal kommen.
function fcCardKey(c){ return String(c.front || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function uniqueCardsByFront(cards){
  const seen = new Set();
  return cards.filter(c => { const k = fcCardKey(c); if(seen.has(k)) return false; seen.add(k); return true; });
}

// Gemeinsamer Einstieg: eine Themengruppe (nach Leitner-Box sortiert) oder
// eine Prüfung = mehrere Themengruppen, bewusst durchgemischt.
// Liegt für genau diese Themen noch eine gespeicherte Session vor, geht es
// dort weiter; eine andere offene Session wird nur nach Rückfrage verworfen.
// opts.fresh: immer neu beginnen („Nochmal“)
function startGroupsLearnSession(subjId, groupIds, exam, opts = {}){
  const saved = getSavedLearnSession();
  if(saved && !opts.fresh){
    if(isSameLearnTarget(saved, subjId, groupIds)){ if(resumeLearnSession()) return; }
    else {
      const info = savedLearnSessionInfo(saved);
      if(info){
        hubConfirm({
          title: 'Offene Session verwerfen?',
          message: `„${info.label}“ (${info.subj.name}) ist noch offen, ${info.rest} von ${info.total} Karten übrig. Startest du eine neue Session, geht dieser Stand verloren. Deine Antworten bis dahin bleiben gespeichert.`,
          confirmText: 'Neue Session starten', danger: true,
        }).then(ok => { if(ok) startGroupsLearnSession(subjId, groupIds, exam, { fresh: true }); });
        return;
      }
    }
  }
  const subj = subjects.find(s => s.id === subjId);
  learnSession.groupIds = groupIds;
  const groups = learnSessionGroups(subj);
  const all = groups.flatMap(g => g.cards);
  if(!subj || all.length === 0) return;
  const ordered = exam ? shuffleCards(all) : [...all].sort((a,b) => (a.box||1)-(b.box||1));
  openLearnSession(subj, groupIds, exam, uniqueCardsByFront(ordered), 0, { correct: 0, wrong: 0 }, []);
}

function openLearnSession(subj, groupIds, exam, queue, index, stats, leitnerChanges){
  learnSession.active = true;
  learnSession.groupIds = groupIds;
  learnSession.queue = queue;
  learnSession.index = index;
  learnSession.flipped = false;
  learnSession.subjId = subj.id;
  learnSession.exam = exam;
  learnSession.stats = { correct: stats.correct || 0, wrong: stats.wrong || 0 };
  learnSession.leitnerChanges = leitnerChanges || [];
  const groups = learnSessionGroups(subj);

  // Session-Panel öffnen + Layout-Klasse
  document.getElementById('flashcard-layout')?.classList.add('session-open');
  const panel = document.getElementById('fc-session-panel');
  panel.classList.remove('hidden');
  document.getElementById('fc-session-panel-title').textContent = exam ? 'Prüfung lernen' : 'Lernsession';
  // Kontext bleibt während der ganzen Session sichtbar: wofür lerne ich gerade?
  const topicRow = exam
    ? `<div class="fc-session-ctx-row"><span class="fc-session-ctx-lbl">Prüfung</span><span class="fc-session-ctx-group">${escHtml(exam.name)}</span></div>
       <div class="fc-session-ctx-row"><span class="fc-session-ctx-lbl">Themen · gemischt</span><span class="fc-session-ctx-topics">${groups.map(g => escHtml(g.name)).join(' · ')}</span></div>`
    : `<div class="fc-session-ctx-row"><span class="fc-session-ctx-lbl">Thema</span><span class="fc-session-ctx-group">${escHtml(groups[0].name)}</span></div>`;
  document.getElementById('fc-session-context').innerHTML = `
    <div class="fc-session-ctx-row"><span class="fc-session-ctx-lbl">Fach</span><span class="fc-session-ctx-subject">${escHtml(subj.name)}</span></div>
    ${subj.teacher ? `<div class="fc-session-ctx-row"><span class="fc-session-ctx-lbl">Lehrer</span><span>${escHtml(subj.teacher)}</span></div>` : ''}
    ${topicRow}`;

  // Heutiger Fortschritt + Schwierige Karten im Panel
  renderTodayProgress();
  renderHardCardsPanel(subj);
  renderGlobalStats();
  showLearnCard();
  // Liste/Fächer sind jetzt ausgeblendet — Blatt an den Anfang holen
  panel.scrollIntoView({ block: 'start' });
  saveLearnSessionState(false);
  renderResumeBanner();
}

// =========================
// SESSION SPEICHERN / PAUSIEREN
// Der Stand der laufenden Session liegt unter 'fc_learn_session'
// ({ subjId, groupIds, exam, queueIds, index, stats, leitnerChanges, paused }),
// damit Neuladen nichts verliert. Nur Karten-IDs, die Karten selbst bleiben
// in 'subjects'. paused = bewusst pausiert (Hinweis „Fortsetzen“ über den
// Fächern); sonst geht es beim nächsten Öffnen des Tabs von selbst weiter.
// =========================

function getSavedLearnSession(){
  const s = DB.get('fc_learn_session', null);
  return s && Array.isArray(s.queueIds) && Array.isArray(s.groupIds) ? s : null;
}
function clearSavedLearnSession(){ DB.set('fc_learn_session', null); }

function saveLearnSessionState(paused){
  if(!learnSession.active) return;
  DB.set('fc_learn_session', {
    subjId: learnSession.subjId,
    groupIds: learnSession.groupIds,
    exam: learnSession.exam,
    queueIds: learnSession.queue.map(c => c.id),
    index: learnSession.index,
    stats: learnSession.stats,
    leitnerChanges: learnSession.leitnerChanges,
    paused: !!paused,
    savedAt: new Date().toISOString(),
  });
}

function isSameLearnTarget(saved, subjId, groupIds){
  const a = [...saved.groupIds].sort().join('|'), b = [...groupIds].sort().join('|');
  return saved.subjId === subjId && a === b;
}

// Gespeicherte Reihenfolge auf die aktuellen Karten abbilden (gelöschte
// Karten fallen raus). null, wenn nichts mehr zu lernen ist.
function savedLearnSessionInfo(saved){
  const subj = subjects.find(s => s.id === saved.subjId);
  if(!subj) return null;
  const byId = new Map(subj.groups.filter(g => saved.groupIds.includes(g.id)).flatMap(g => g.cards).map(c => [c.id, c]));
  const done = saved.queueIds.slice(0, saved.index).map(id => byId.get(id)).filter(Boolean);
  const rest = saved.queueIds.slice(saved.index).map(id => byId.get(id)).filter(Boolean);
  if(!rest.length) return null;
  const label = saved.exam ? saved.exam.name : (subj.groups.find(g => g.id === saved.groupIds[0])?.name || 'Lernsession');
  return { subj, done, restCards: rest, rest: rest.length, total: done.length + rest.length, label };
}

function resumeLearnSession(){
  const saved = getSavedLearnSession();
  const info = saved && savedLearnSessionInfo(saved);
  if(!info){ clearSavedLearnSession(); renderResumeBanner(); return false; }
  if(state.activeSubjectId !== info.subj.id){ state.activeSubjectId = info.subj.id; renderSubjectList(); }
  openLearnSession(info.subj, saved.groupIds, saved.exam, [...info.done, ...info.restCards], info.done.length, saved.stats || {}, saved.leitnerChanges);
  return true;
}

function renderResumeBanner(){
  const el = document.getElementById('fc-resume-banner');
  if(!el) return;
  const saved = getSavedLearnSession();
  const info = saved && !learnSession.active ? savedLearnSessionInfo(saved) : null;
  el.classList.toggle('hidden', !info);
  if(!info){ el.innerHTML = ''; return; }
  const st = saved.stats || {};
  el.innerHTML = `
    <div class="fc-resume-text">
      <span class="fc-resume-label">Pausierte Session</span>
      <span class="fc-resume-title">${escHtml(info.label)} <span class="fc-resume-subj">· ${escHtml(info.subj.name)}</span></span>
      <span class="fc-resume-meta">noch ${info.rest} von ${info.total} Karten · ✓ ${st.correct || 0} · ✗ ${st.wrong || 0}</span>
    </div>
    <div class="fc-resume-actions">
      <button class="btn-ghost fc-resume-drop">Verwerfen</button>
      <button class="btn-primary fc-resume-go">▶ Fortsetzen</button>
    </div>`;
  el.querySelector('.fc-resume-go').addEventListener('click', () => resumeLearnSession());
  el.querySelector('.fc-resume-drop').addEventListener('click', async () => {
    const ok = await hubConfirm({ title: 'Session verwerfen?', message: 'Der Stand der Session geht verloren. Deine bisherigen Antworten (Leitner-Boxen) bleiben gespeichert.', confirmText: 'Verwerfen', danger: true });
    if(ok){ clearSavedLearnSession(); renderResumeBanner(); }
  });
}

// Nach einem Neuladen mitten in der Session: beim ersten Öffnen des Tabs
// direkt weitermachen (bewusst pausierte Sessions warten auf „Fortsetzen“)
let fcAutoResumeChecked = false;
function maybeAutoResumeLearnSession(){
  if(fcAutoResumeChecked) return;
  fcAutoResumeChecked = true;
  const saved = getSavedLearnSession();
  if(saved && !saved.paused && !learnSession.active) setTimeout(() => resumeLearnSession(), 0);
}

function renderTodayProgress(){
  const grid = document.getElementById('fc-today-progress-grid');
  if(!grid) return;
  const today = getTodayStr();
  const stats = getSessionStats();
  const learned = stats.date === today ? stats.learned : 0;
  const reps = stats.date === today ? (stats.reps||0) : 0;
  const correct = stats.date === today ? stats.correct : 0;
  const wrong = stats.date === today ? stats.wrong : 0;
  const totalAnswered = correct + wrong;
  const pct = totalAnswered > 0 ? Math.round((correct/totalAnswered)*100) : 0;
  grid.innerHTML = `
    <div class="fc-progress-mini">${fcIcon('fc-progress-mini-icon', '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>')}<span class="fc-progress-mini-val">${learned}</span><span class="fc-progress-mini-lbl">Gelernt</span></div>
    <div class="fc-progress-mini">${fcIcon('fc-progress-mini-icon', '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5"/><path d="M4 20v-4.5h4.5"/>')}<span class="fc-progress-mini-val">${reps}</span><span class="fc-progress-mini-lbl">Wiederholt</span></div>
    <div class="fc-progress-mini">${fcIcon('fc-progress-mini-icon', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>')}<span class="fc-progress-mini-val">${pct}%</span><span class="fc-progress-mini-lbl">Richtig</span></div>
  `;
}

function renderHardCardsPanel(subj){
  const hardList = document.getElementById('fc-hard-list');
  const hardCount = document.getElementById('fc-hard-count');
  const hard = learnSessionGroups(subj).flatMap(g => g.cards).filter(c => c.hard);
  hardCount.textContent = hard.length;
  hardList.innerHTML = '';
  if(hard.length === 0){
    const empty = document.createElement('div');
    empty.className = 'fc-hard-empty';
    empty.textContent = 'Keine schwierigen Karten';
    hardList.appendChild(empty);
    return;
  }
  hard.forEach(fc => {
    const row = document.createElement('div');
    row.className = 'fc-hard-item';
    row.innerHTML = `<span>${escHtml(fc.front)}</span>`;
    row.title = 'Klicken um zur Karte zu springen';
    row.addEventListener('click', () => jumpToHardCard(subj, subj.groups.find(g => g.cards.includes(fc)), fc));
    hardList.appendChild(row);
  });
}

function jumpToHardCard(subj, group, fc){
  // Aktuelle Lernsession pausieren und direkt zur Karte im Fach springen
  pauseLearnSession();
  state.activeSubjectId = subj.id;
  renderSubjectList();
  renderSubjectDetail();
  collapsedGroups.delete(group.id);
  DB.set('collapsedGroups', [...collapsedGroups]);
  renderGroupList(subj);
  setTimeout(() => {
    const groupCards = document.querySelectorAll('.group-card');
    groupCards.forEach(gc => {
      const titleEl = gc.querySelector('.group-title');
      if(titleEl && titleEl.textContent === group.name){
        gc.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, 60);
}

function showLearnCard(){
  const q = learnSession.queue, total = q.length, idx = learnSession.index;
  if(idx >= total){ endLearnSession(); return; }

  document.getElementById('learn-done').classList.add('hidden');
  document.getElementById('learn-actions').classList.add('hidden');
  document.getElementById('learn-card-wrap').style.display = '';

  document.getElementById('learn-progress-label').textContent = `${idx+1} / ${total}`;
  document.getElementById('learn-progress-bar').style.width = `${(idx/total)*100}%`;

  const remaining = total - idx;
  const motivEl = document.getElementById('learn-motivation');
  if(motivEl){
    const txt = getMotivationText(remaining, total);
    motivEl.textContent = txt; motivEl.style.display = txt ? '' : 'none';
  }

  const card = q[idx];
  const inner = document.getElementById('learn-card-inner');
  inner.classList.remove('flipped');
  learnSession.flipped = false;
  document.getElementById('learn-card-front').textContent = card.front;
  document.getElementById('learn-card-back').textContent = card.back;
  document.getElementById('learn-card-hint').textContent = 'Klicken für die Antwort';
  updateLiveStats();
}

// Erneutes Klicken dreht die Karte hin und her (Frage nochmal ansehen);
// die Antwort-Knöpfe bleiben nach dem ersten Umdrehen stehen
window.flipLearnCard = function(){
  learnSession.flipped = !learnSession.flipped;
  document.getElementById('learn-card-inner').classList.toggle('flipped', learnSession.flipped);
  document.getElementById('learn-card-hint').textContent = learnSession.flipped ? 'Klicken für die Frage' : 'Klicken für die Antwort';
  document.getElementById('learn-actions').classList.remove('hidden');
  document.getElementById('learn-actions').style.display = 'flex';
};

function updateLiveStats(){
  const total = learnSession.queue.length;
  const remaining = total - learnSession.index;
  const el = document.getElementById('learn-live-stats'); if(!el) return;
  el.innerHTML = `
    <div class="learn-stat"><span class="learn-stat-val learn-stat-correct">✓ ${learnSession.stats.correct}</span><span class="learn-stat-lbl">Richtig</span></div>
    <div class="learn-stat"><span class="learn-stat-val learn-stat-wrong">✗ ${learnSession.stats.wrong}</span><span class="learn-stat-lbl">Falsch</span></div>
    <div class="learn-stat"><span class="learn-stat-val">${remaining}</span><span class="learn-stat-lbl">Verbleibend</span></div>
  `;
}

function getMotivationText(remaining, total){
  if(remaining === 0) return '';
  if(remaining === 1) return '🏁 Noch 1 Karte – fast geschafft!';
  if(remaining <= 3) return `✨ Noch ${remaining} Karten!`;
  if(remaining === total) return '🚀 Los geht\'s!';
  const done = total - remaining;
  if(done === 1) return '👍 Erste Karte geschafft!';
  if(remaining < total/2) return '⚡ Mehr als die Hälfte geschafft!';
  return '';
}

document.getElementById('learn-knew').addEventListener('click', () => answerLearn(true, 'easy'));
document.getElementById('learn-hard').addEventListener('click', () => answerLearn(false, 'hard'));
document.getElementById('learn-didnt').addEventListener('click', () => answerLearn(false, 'repeat'));

function answerLearn(knew, mode){
  const q = learnSession.queue, card = q[learnSession.index];
  const subj = subjects.find(s => s.id === learnSession.subjId);
  const groups = learnSessionGroups(subj);
  {
    // Doppelte (gleiche Vorderseite in anderen Themen der Session) bekommen
    // dieselbe Bewertung, sonst tauchen sie später wieder als fällig auf
    const key = fcCardKey(card);
    const realCards = groups.flatMap(g => g.cards).filter(c => c.id === card.id || fcCardKey(c) === key);
    realCards.forEach(realCard => {
      const oldBox = realCard.box || 1;
      if(mode === 'easy') realCard.box = Math.min(oldBox+1, 5);
      else if(mode === 'hard') realCard.box = Math.max(oldBox-1, 1);
      else realCard.box = 1; // repeat
      realCard.lastSeen = new Date().toISOString();
      realCard.totalAnswers = (realCard.totalAnswers||0) + 1;
      if(knew) realCard.correctAnswers = (realCard.correctAnswers||0) + 1;
      if(realCard.id === card.id && realCard.box !== oldBox) learnSession.leitnerChanges.push({ front: realCard.front, from: oldBox, to: realCard.box });
    });
    if(realCards.length) saveSubjects();
  }
  if(knew) learnSession.stats.correct++; else learnSession.stats.wrong++;
  recordAnswer(knew);
  renderTodayProgress();
  if(subj) renderHardCardsPanel(subj);
  learnSession.index++;
  if(learnSession.index >= q.length){
    endLearnSession();
    if(subj){ renderGroupList(subj); renderExamList(subj); }
    renderSubjectList();
  } else {
    saveLearnSessionState(false);
    showLearnCard();
  }
}

function endLearnSession(){
  learnSession.active = false;
  clearSavedLearnSession();
  const total = learnSession.queue.length;
  const correct = learnSession.stats.correct;
  const wrong = learnSession.stats.wrong;
  const pct = total > 0 ? Math.round((correct/total)*100) : 0;
  let rating = pct===100?'🏆 Perfekt!':pct>=80?'⭐ Super!':pct>=60?'👍 Gut!':'💪 Weiter so!';

  // Leitner-Veränderungen
  const up = learnSession.leitnerChanges.filter(c => c.to > c.from).length;
  const down = learnSession.leitnerChanges.filter(c => c.to < c.from).length;
  const leitnerHTML = (up||down) ? `
    <div style="font-size:12px;color:var(--text-3);margin-top:6px;">
      ${up ? `<span class="fc-tone" style="--fc-tone-src:var(--leitner-3);">▲ ${up} Karte${up!==1?'n':''} aufgestiegen</span>` : ''}
      ${up&&down?' · ':''}
      ${down ? `<span class="fc-tone">▼ ${down} Karte${down!==1?'n':''} zurückgefallen</span>` : ''}
    </div>` : '';

  document.getElementById('learn-card-wrap').style.display = 'none';
  document.getElementById('learn-actions').style.display = 'none';
  document.getElementById('learn-progress-bar').style.width = '100%';
  document.getElementById('learn-progress-label').textContent = `${total} / ${total}`;
  const motivEl = document.getElementById('learn-motivation');
  if(motivEl) motivEl.style.display = 'none';
  updateLiveStats();

  document.getElementById('learn-done').classList.remove('hidden');
  document.getElementById('learn-done').innerHTML = `
    <div class="session-done-wrap">
      <div class="session-done-emoji">${rating}</div>
      <div class="session-done-stats">
        <div class="session-done-stat"><span class="session-done-val">${total}</span><span class="session-done-lbl">Bearbeitet</span></div>
        <div class="session-done-stat"><span class="session-done-val learn-stat-correct">✓ ${correct}</span><span class="session-done-lbl">Richtig</span></div>
        <div class="session-done-stat"><span class="session-done-val learn-stat-wrong">✗ ${wrong}</span><span class="session-done-lbl">Falsch</span></div>
        <div class="session-done-stat"><span class="session-done-val">${pct}%</span><span class="session-done-lbl">Quote</span></div>
      </div>
      ${leitnerHTML}
      <div class="modal-actions" style="justify-content:center;gap:10px;margin-top:14px;">
        <button id="learn-restart" class="btn-primary">Nochmal</button>
        <button id="learn-close-panel" class="btn-ghost">Schließen</button>
      </div>
    </div>
  `;
  document.getElementById('learn-restart').addEventListener('click', () => startGroupsLearnSession(learnSession.subjId, learnSession.groupIds, learnSession.exam, { fresh: true }));
  document.getElementById('learn-close-panel').addEventListener('click', closeSessionPanel);
  renderGlobalStats();
}

function closeSessionPanel(){
  learnSession.active = false;
  document.getElementById('fc-session-panel').classList.add('hidden');
  document.getElementById('flashcard-layout')?.classList.remove('session-open');
  renderGlobalStats();
  renderResumeBanner();
}

// ✕ und „Pausieren“ behalten den Stand, „Beenden“ verwirft ihn
function pauseLearnSession(){
  if(learnSession.active) saveLearnSessionState(true);
  closeSessionPanel();
}
function stopLearnSession(){
  clearSavedLearnSession();
  closeSessionPanel();
}

document.getElementById('fc-session-panel-close').addEventListener('click', pauseLearnSession);
document.getElementById('fc-session-pause')?.addEventListener('click', pauseLearnSession);
document.getElementById('fc-session-end')?.addEventListener('click', stopLearnSession);

// =========================
// EXPORT
// =========================

function stripCardForExport(c){
  return { id: c.id, front: c.front, back: c.back };
}

function exportSubject(subj){
  const data = JSON.stringify({
    name: subj.name,
    teacher: subj.teacher || '',
    groups: subj.groups.map(g => ({ name: g.name, cards: g.cards.map(stripCardForExport) }))
  }, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`${subj.name}.json`; a.click();
  URL.revokeObjectURL(url);
}

function exportGroup(subj, group){
  const data = JSON.stringify({
    subjectName: subj.name,
    group: { name: group.name, cards: group.cards.map(stripCardForExport) }
  }, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`${subj.name}_${group.name}.json`; a.click();
  URL.revokeObjectURL(url);
}

function exportCard(fc){
  const data = JSON.stringify(stripCardForExport(fc), null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`${fc.front.slice(0,30)}.json`; a.click();
  URL.revokeObjectURL(url);
}


// =========================
// SUCHQUELLE (js/hub-search.js, AI documentation/search.md) — nur lesen;
// open() springt zum Eintrag über die Funktionen dieses Tabs.
// =========================
registerSearchProvider({
  id: 'flashcards', label: 'Karteikarten', icon: '🗂️', view: 'flashcards',
  items: () => subjects.flatMap(subj => (subj.groups || []).flatMap(group => (group.cards || []).map(fc => ({
    id: fc.id, title: fc.front || '(leere Karte)', sub: `${subj.name} › ${group.name}`, text: fc.back || '',
    open: () => {
      showView('flashcards');
      closeSessionPanel();
      state.activeSubjectId = subj.id;
      renderSubjectList();
      renderSubjectDetail();
      openFcModal(subj.id, group.id, fc);
    },
  })))),
});
