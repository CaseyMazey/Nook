// =========================
// FLASHCARDS — Prüfungen
// Eine Prüfung fasst mehrere Themengruppen eines Fachs zusammen, die in
// derselben Klassenarbeit/Prüfung abgefragt werden. Gelernt wird sie als
// EINE Session über alle Karten, bewusst durchgemischt.
//
// Lade-Reihenfolge: main.js (subjects, state) -> hub-utils.js (wireModal,
// hubConfirm) -> flashcards.js (saveSubjects, startGroupsLearnSession,
// calcDueCount, fcIcon, closeAllMenus, positionMenu) -> flashcards-exams.js
//
// Daten: subject.exams = [{ id, name, groupIds: [] }] — Teil von 'subjects'
// (kein eigener Key). Fehlt das Feld bei älteren Fächern, gilt [].
// Gelöschte Themengruppen werden beim Lesen ignoriert und beim Löschen der
// Gruppe aus allen Prüfungen ausgetragen (flashcards.js).
// =========================

function examGroups(subj, exam){
  return subj.groups.filter(g => exam.groupIds.includes(g.id));
}

function renderExamList(subj){
  const wrap = document.getElementById('fc-exam-list');
  if(!wrap) return;
  const exams = subj.exams || [];
  wrap.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'fc-exam-head';
  head.innerHTML = `<span class="fc-exam-head-label">Prüfungen</span>`;
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-ghost fc-exam-add';
  addBtn.textContent = '+ Prüfung';
  addBtn.disabled = subj.groups.length === 0;
  addBtn.title = subj.groups.length ? 'Themengruppen zu einer Prüfung zusammenfassen' : 'Erst Themengruppen anlegen';
  addBtn.addEventListener('click', () => openExamModal(subj));
  head.appendChild(addBtn);
  wrap.appendChild(head);

  if(!exams.length){
    const hint = document.createElement('div');
    hint.className = 'fc-exam-empty';
    hint.textContent = 'Fasse die Themen der nächsten Prüfung zusammen, um sie gemischt zu lernen.';
    wrap.appendChild(hint);
    renderSubjectToc(subj);
    return;
  }

  exams.forEach(exam => {
    const groups = examGroups(subj, exam);
    const cards = groups.flatMap(g => g.cards);
    const due = calcDueCount(cards);

    const card = document.createElement('div');
    card.className = 'fc-exam-card';
    card.dataset.examId = exam.id;
    card.innerHTML = `
      ${fcIcon('fc-exam-icon', '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="m9 13 2 2 4-4"/>')}
      <div class="fc-exam-main">
        <div class="fc-exam-name">${escHtml(exam.name)}</div>
        <div class="fc-exam-meta">${groups.length} ${groups.length!==1?'Themen':'Thema'} · ${cards.length} Karten${due ? ` · <span class="subject-due">${due} fällig</span>` : ''}</div>
        <div class="fc-exam-topics">${groups.map(g => `<span class="fc-exam-topic">${escHtml(g.name)}</span>`).join('')}</div>
      </div>
      <div class="fc-exam-actions">
        <button class="btn-primary fc-exam-learn" ${cards.length ? '' : 'disabled'}>▶ Gemischt lernen</button>
        <button class="fc-meatball" title="Optionen">⋮</button>
      </div>`;
    card.querySelector('.fc-exam-learn').addEventListener('click', () => startGroupsLearnSession(subj.id, exam.groupIds, { id: exam.id, name: exam.name }));
    card.querySelector('.fc-meatball').addEventListener('click', e => { e.stopPropagation(); openExamMenu(subj, exam, e.currentTarget); });
    wrap.appendChild(card);
  });
  renderSubjectToc(subj);
}

function openExamMenu(subj, exam, anchor){
  closeAllMenus();
  const menu = document.createElement('div');
  menu.className = 'fc-context-menu';
  menu.innerHTML = `
    <button class="fc-menu-item" data-action="edit">✏️ Bearbeiten</button>
    <button class="fc-menu-item fc-menu-danger" data-action="delete">🗑️ Löschen</button>
  `;
  menu.querySelector('[data-action="edit"]').addEventListener('click', () => { closeAllMenus(); openExamModal(subj, exam); });
  menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    closeAllMenus();
    const ok = await hubConfirm({
      title: 'Prüfung löschen?',
      message: `„${exam.name}“ wird entfernt. Die Themengruppen und Karten bleiben erhalten.`,
      confirmText: 'Löschen', danger: true,
    });
    if(!ok) return;
    subj.exams = (subj.exams || []).filter(x => x.id !== exam.id);
    saveSubjects(); renderExamList(subj);
  });
  positionMenu(menu, anchor);
}

// =========================
// MODAL: Prüfung anlegen / bearbeiten
// =========================

let examModalContext = null; // { subjId, exam? }
const examModal = wireModal('fc-exam-modal-overlay', {
  closeIds: ['fc-exam-modal-close', 'fc-exam-modal-cancel'],
  inputId: 'fc-exam-name-input',
  saveId: 'fc-exam-modal-save',
  onClose: () => { examModalContext = null; },
});

function openExamModal(subj, exam = null){
  examModalContext = { subjId: subj.id, exam };
  document.getElementById('fc-exam-modal-title').textContent = exam ? 'Prüfung bearbeiten' : 'Neue Prüfung';
  document.getElementById('fc-exam-modal-save').textContent = exam ? 'Speichern' : 'Erstellen';
  document.getElementById('fc-exam-name-input').value = exam ? exam.name : '';
  // Neue Prüfung: alle Themen vorausgewählt — meist gehört der ganze Stoff dazu
  const selected = new Set(exam ? exam.groupIds : subj.groups.map(g => g.id));
  document.getElementById('fc-exam-group-list').innerHTML = subj.groups.map(g => `
    <label class="fc-exam-check">
      <input type="checkbox" value="${g.id}" ${selected.has(g.id) ? 'checked' : ''}>
      <span>${escHtml(g.name)}</span>
      <span class="fc-exam-check-count">${g.cards.length}</span>
    </label>`).join('');
  examModal.open();
  setTimeout(() => document.getElementById('fc-exam-name-input').focus(), 50);
}

document.getElementById('fc-exam-modal-save').addEventListener('click', () => {
  if(!examModalContext) return;
  const name = document.getElementById('fc-exam-name-input').value.trim();
  const groupIds = [...document.querySelectorAll('#fc-exam-group-list input:checked')].map(i => i.value);
  if(!name || !groupIds.length) return;
  const subj = subjects.find(s => s.id === examModalContext.subjId); if(!subj) return;
  if(!subj.exams) subj.exams = [];
  if(examModalContext.exam) Object.assign(examModalContext.exam, { name, groupIds });
  else subj.exams.push({ id: crypto.randomUUID(), name, groupIds });
  saveSubjects(); examModal.close(); renderExamList(subj);
});
