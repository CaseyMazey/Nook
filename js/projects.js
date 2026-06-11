// =========================
// PROJEKTE
// =========================
// Datenstruktur:
// projects = [{
//   id, name, description, color, createdAt, startDate, archived,
//   tasks: [{ id, text, done, isExtra, completedAt }],
//   subprojects: [{ id, title, collapsed, tasks: [...] }]
// }]

if (typeof projects === 'undefined') {
  var projects = DB.get('projects', []);
} else {
  projects = DB.get('projects', []);
}

let projectCollapsed = DB.get('projectCollapsed', {});

function saveProjects()      { DB.set('projects', projects); }
function saveCollapseState() { DB.set('projectCollapsed', projectCollapsed); }

function isCollapsed(id) { return projectCollapsed[id] !== false; }

// Migriert alte Projekte auf neue Felder
function migrateProject(p) {
  if (!p.tasks)       p.tasks       = [];
  if (!p.subprojects) p.subprojects = [];
  if (!p.startDate)   p.startDate   = p.createdAt || Date.now();
  if (p.archived === undefined) p.archived = false;
  p.subprojects.forEach(sp => {
    if (!sp.tasks)     sp.tasks     = [];
    if (sp.collapsed === undefined) sp.collapsed = true;
  });
  return p;
}
projects = projects.map(migrateProject);

// =========================
// STATS
// =========================

function getProjectStats(project) {
  // Aufgaben aus Hauptprojekt
  const coreTasks  = project.tasks.filter(t => !t.isExtra);
  const extraTasks = project.tasks.filter(t =>  t.isExtra);
  const coreDone   = coreTasks.filter(t => t.done).length;
  const extraDone  = extraTasks.filter(t => t.done).length;

  // Unterprojekt-Aufgaben mit einrechnen (für Hauptfortschritt)
  let subTotal = 0, subDone = 0;
  (project.subprojects || []).forEach(sp => {
    subTotal += sp.tasks.length;
    subDone  += sp.tasks.filter(t => t.done).length;
  });

  const totalForProgress = coreTasks.length + subTotal;
  const doneForProgress  = coreDone + subDone;
  const coreProgress     = totalForProgress === 0 ? 0 : Math.round((doneForProgress / totalForProgress) * 100);
  const extraProgress    = extraTasks.length === 0 ? 0 : Math.round((extraDone / extraTasks.length) * 100);

  // Offene Aufgaben (nur Hauptprojekt, ohne Unterprojekte)
  const openCore  = coreTasks.filter(t => !t.done).length;
  const openExtra = extraTasks.filter(t => !t.done).length;

  return {
    coreTasks, extraTasks, coreDone, extraDone,
    coreProgress, extraProgress,
    openCore, openExtra,
    subTotal, subDone
  };
}

function getSubprojectStats(sp) {
  const total = sp.tasks.length;
  const done  = sp.tasks.filter(t => t.done).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct };
}

const PROJECT_COLORS = [
  '#2563eb','#7c3aed','#db2777','#dc2626',
  '#ea580c','#ca8a04','#16a34a','#0891b2',
  '#475569','#78716c'
];

function formatStartDate(project) {
  const ts = project.startDate || project.createdAt;
  if (!ts) return null;
  const date = new Date(ts);
  const now  = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Heute gestartet';
  if (diffDays === 1) return 'Seit gestern';
  if (diffDays < 7)   return `Seit ${diffDays} Tagen`;
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `Gestartet am ${d}.${m}.${y}`;
}

// =========================
// RENDER — Übersicht
// =========================

function renderProjects() {
  const grid = document.getElementById('project-grid');
  if (!grid) return;
  grid.innerHTML = '';
  renderProjectStats();

  const active = projects.filter(p => !p.archived);
  if (active.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'project-empty-state';
    empty.textContent = 'Noch keine Projekte. Erstelle dein erstes mit „+ Neues Projekt".';
    grid.appendChild(empty);
    return;
  }
  active.forEach(project => {
    const stats = getProjectStats(project);
    grid.appendChild(buildProjectCard(project, stats));
  });
}

function renderProjectStats() {
  const bar = document.getElementById('project-stats-bar');
  if (!bar) return;
  const active   = projects.filter(p => !p.archived).length;
  const archived = projects.filter(p =>  p.archived).length;
  let totalCore = 0, totalDone = 0;
  projects.filter(p => !p.archived).forEach(p => {
    const s = getProjectStats(p);
    totalCore += s.coreTasks.length + s.subTotal;
    totalDone += s.coreDone + s.subDone;
  });
  const overall = totalCore === 0 ? 0 : Math.round((totalDone / totalCore) * 100);
  bar.innerHTML = `
    <span class="proj-stat"><strong>${active}</strong> aktiv</span>
    <span class="proj-stat-sep">·</span>
    <span class="proj-stat"><strong>${archived}</strong> archiviert</span>
    <span class="proj-stat-sep">·</span>
    <span class="proj-stat"><strong>${overall}%</strong> Gesamtfortschritt</span>
  `;
}

// =========================
// PROJEKT KARTE
// =========================

function buildProjectCard(project, stats) {
  const collapsed = isCollapsed(project.id);

  const card = document.createElement('div');
  card.className = 'project-card' + (collapsed ? ' collapsed' : '');
  card.id = `proj-card-${project.id}`;
  card.style.setProperty('--proj-color', project.color || '#2563eb');

  // ---- Header ----
  const header = document.createElement('div');
  header.className = 'project-card-header';
  header.style.cursor = 'pointer';
  header.addEventListener('click', () => toggleProjectCollapse(project.id));

  const chevron = document.createElement('span');
  chevron.className = 'project-chevron';
  chevron.innerHTML = collapsed
    ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 5.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 8.5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const colorDot = document.createElement('div');
  colorDot.className = 'project-color-dot';
  colorDot.style.background = project.color || '#2563eb';

  const titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'flex:1;min-width:0;';

  const titleEl = document.createElement('div');
  titleEl.className = 'project-card-title';
  titleEl.textContent = project.name;
  titleWrap.appendChild(titleEl);

  if (project.description) {
    const desc = document.createElement('div');
    desc.className = 'project-card-desc';
    desc.textContent = project.description;
    titleWrap.appendChild(desc);
  }

  // Offene Aufgaben Badge (nur eingeklappt)
  const openBadge = document.createElement('div');
  openBadge.className = 'project-open-badge';
  const openTotal = stats.openCore + stats.openExtra;
  if (openTotal > 0) {
    let parts = [];
    if (stats.openCore  > 0) parts.push(`${stats.openCore} Kern`);
    if (stats.openExtra > 0) parts.push(`${stats.openExtra} Extra`);
    openBadge.innerHTML = `<span class="proj-open-count">${openTotal} offen</span><span class="proj-open-detail">${parts.join(', ')}</span>`;
  }
  titleWrap.appendChild(openBadge);

  // Startdatum
  const dateLabel = formatStartDate(project);
  if (dateLabel) {
    const dateLine = document.createElement('div');
    dateLine.className = 'project-start-date';
    dateLine.textContent = dateLabel;
    titleWrap.appendChild(dateLine);
  }

  const actions = document.createElement('div');
  actions.className = 'project-card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'task-delete';
  editBtn.textContent = '✎';
  editBtn.title = 'Bearbeiten';
  editBtn.addEventListener('click', e => { e.stopPropagation(); openProjectModal(project); });

  const delBtn = document.createElement('button');
  delBtn.className = 'task-delete';
  delBtn.textContent = '✕';
  delBtn.title = 'Löschen';
  delBtn.addEventListener('click', e => {
    e.stopPropagation();
    openConfirmModal(
      `Projekt löschen?`,
      `„${project.name}" wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
      'Löschen',
      'danger',
      () => {
        projects = projects.filter(p => p.id !== project.id);
        delete projectCollapsed[project.id];
        saveProjects(); saveCollapseState(); renderProjects();
      }
    );
  });

  actions.append(editBtn, delBtn);
  header.append(chevron, colorDot, titleWrap, actions);
  card.appendChild(header);

  // ---- Progress ----
  const progressSection = document.createElement('div');
  progressSection.className = 'project-progress-section';

  const coreRow = document.createElement('div');
  coreRow.className = 'project-progress-row';
  const coreLabel = document.createElement('span');
  coreLabel.className = 'project-progress-label';
  coreLabel.textContent = `Kernaufgaben ${stats.coreDone}/${stats.coreTasks.length + stats.subTotal}`;
  const corePct = document.createElement('span');
  corePct.className = 'project-progress-pct';
  corePct.textContent = `${stats.coreProgress}%`;
  coreRow.append(coreLabel, corePct);

  const coreBarWrap = document.createElement('div');
  coreBarWrap.className = 'project-bar-wrap';
  const coreBar = document.createElement('div');
  coreBar.className = 'project-bar-fill' + (stats.coreProgress === 100 ? ' complete' : '');
  coreBar.style.width = `${stats.coreProgress}%`;
  coreBar.style.background = stats.coreProgress === 100 ? '#16a34a' : (project.color || '#2563eb');
  coreBarWrap.appendChild(coreBar);
  progressSection.append(coreRow, coreBarWrap);

  if (stats.extraTasks.length > 0) {
    const extraRow = document.createElement('div');
    extraRow.className = 'project-progress-row';
    extraRow.style.marginTop = '8px';
    const extraLabel = document.createElement('span');
    extraLabel.className = 'project-progress-label';
    extraLabel.textContent = `Extras ${stats.extraDone}/${stats.extraTasks.length}`;
    const extraPct = document.createElement('span');
    extraPct.className = 'project-progress-pct project-progress-pct--extra';
    extraPct.textContent = `+${stats.extraProgress}%`;
    extraRow.append(extraLabel, extraPct);
    const extraBarWrap = document.createElement('div');
    extraBarWrap.className = 'project-bar-wrap project-bar-wrap--extra';
    const extraBar = document.createElement('div');
    extraBar.className = 'project-bar-fill project-bar-fill--extra';
    extraBar.style.width = `${stats.extraProgress}%`;
    extraBarWrap.appendChild(extraBar);
    progressSection.append(extraRow, extraBarWrap);
  }
  card.appendChild(progressSection);

  // ---- Ausklappbarer Bereich ----
  const expandable = document.createElement('div');
  expandable.className = 'project-expandable';

  const taskSection = document.createElement('div');
  taskSection.className = 'project-task-section';

  const coreTasks  = project.tasks.filter(t => !t.isExtra);
  const extraTasks = project.tasks.filter(t =>  t.isExtra);

  if (coreTasks.length === 0 && extraTasks.length === 0 && (project.subprojects || []).length === 0) {
    const hint = document.createElement('div');
    hint.className = 'project-task-empty';
    hint.textContent = 'Noch keine Aufgaben.';
    taskSection.appendChild(hint);
  }

  coreTasks.forEach(task => taskSection.appendChild(buildTaskRow(task, project, null)));

  if (extraTasks.length > 0) {
    const extraDivider = document.createElement('div');
    extraDivider.className = 'project-section-divider';
    extraDivider.textContent = '✦ Extras';
    taskSection.appendChild(extraDivider);
    extraTasks.forEach(task => taskSection.appendChild(buildTaskRow(task, project, null)));
  }

  // ---- Unterprojekte ----
  (project.subprojects || []).forEach(sp => {
    taskSection.appendChild(buildSubprojectSection(sp, project));
  });

  expandable.appendChild(taskSection);

  // ---- Footer ----
  const footer = document.createElement('div');
  footer.className = 'project-card-footer';

  const addCoreBtn = document.createElement('button');
  addCoreBtn.className = 'project-add-task-btn';
  addCoreBtn.textContent = '+ Aufgabe';
  addCoreBtn.addEventListener('click', () => openAddTaskModal(project.id, false, null));

  const addExtraBtn = document.createElement('button');
  addExtraBtn.className = 'project-add-task-btn project-add-task-btn--extra';
  addExtraBtn.textContent = '+ Extra';
  addExtraBtn.addEventListener('click', () => openAddTaskModal(project.id, true, null));

  const addSubBtn = document.createElement('button');
  addSubBtn.className = 'project-add-task-btn project-add-task-btn--sub';
  addSubBtn.textContent = '+ Unterprojekt';
  addSubBtn.addEventListener('click', () => openAddSubprojectModal(project.id));

  const archiveBtn = document.createElement('button');
  archiveBtn.className = 'project-add-task-btn project-add-task-btn--archive';
  archiveBtn.textContent = '⊘ Archivieren';
  archiveBtn.addEventListener('click', () => {
    openConfirmModal(
      `Projekt archivieren?`,
      `Das Projekt „${project.name}" wird ins Archiv verschoben. Es bleibt vollständig erhalten und kann wiederhergestellt werden.`,
      'Archivieren',
      'neutral',
      () => {
        const idx = projects.findIndex(p => p.id === project.id);
        if (idx !== -1) projects[idx].archived = true;
        saveProjects(); renderProjects();
      }
    );
  });

  footer.append(addCoreBtn, addExtraBtn, addSubBtn, archiveBtn);
  expandable.appendChild(footer);

  card.appendChild(expandable);
  return card;
}

// =========================
// UNTERPROJEKT
// =========================

function buildSubprojectSection(sp, project) {
  const spStats = getSubprojectStats(sp);
  const wrap = document.createElement('div');
  wrap.className = 'subproject-wrap';
  wrap.id = `subproj-${sp.id}`;

  // Header
  const head = document.createElement('div');
  head.className = 'subproject-header';
  head.style.cursor = 'pointer';

  const spChevron = document.createElement('span');
  spChevron.className = 'subproject-chevron';
  spChevron.innerHTML = sp.collapsed
    ? `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 5.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 8.5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const spTitle = document.createElement('span');
  spTitle.className = 'subproject-title';
  spTitle.textContent = sp.title;

  const spProgress = document.createElement('span');
  spProgress.className = 'subproject-progress';
  spProgress.textContent = `${spStats.done}/${spStats.total}`;

  const spBarWrap = document.createElement('div');
  spBarWrap.className = 'subproject-bar-wrap';
  const spBar = document.createElement('div');
  spBar.className = 'subproject-bar-fill';
  spBar.style.cssText = `width:${spStats.pct}%;background:${spStats.pct === 100 ? '#16a34a' : 'var(--proj-color, #2563eb)'};`;
  spBarWrap.appendChild(spBar);

  const spActions = document.createElement('div');
  spActions.className = 'subproject-actions';

  const spAddBtn = document.createElement('button');
  spAddBtn.className = 'task-delete';
  spAddBtn.textContent = '+';
  spAddBtn.title = 'Aufgabe hinzufügen';
  spAddBtn.addEventListener('click', e => { e.stopPropagation(); openAddTaskModal(project.id, false, sp.id); });

  const spDelBtn = document.createElement('button');
  spDelBtn.className = 'task-delete';
  spDelBtn.textContent = '✕';
  spDelBtn.title = 'Unterprojekt löschen';
  spDelBtn.addEventListener('click', e => {
    e.stopPropagation();
    openConfirmModal(
      `Unterprojekt löschen?`,
      `„${sp.title}" und alle enthaltenen Aufgaben werden gelöscht.`,
      'Löschen',
      'danger',
      () => {
        const proj = projects.find(p => p.id === project.id);
        if (proj) proj.subprojects = proj.subprojects.filter(s => s.id !== sp.id);
        saveProjects(); renderProjects();
      }
    );
  });

  spActions.append(spAddBtn, spDelBtn);
  head.append(spChevron, spTitle, spProgress, spBarWrap, spActions);

  head.addEventListener('click', () => {
    sp.collapsed = !sp.collapsed;
    saveProjects();
    const body = wrap.querySelector('.subproject-body');
    if (body) body.classList.toggle('collapsed', sp.collapsed);
    spChevron.innerHTML = sp.collapsed
      ? `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 5.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 8.5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  });

  const body = document.createElement('div');
  body.className = 'subproject-body' + (sp.collapsed ? ' collapsed' : '');

  if (sp.tasks.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'project-task-empty';
    hint.style.paddingLeft = '32px';
    hint.textContent = 'Noch keine Aufgaben in diesem Unterprojekt.';
    body.appendChild(hint);
  } else {
    sp.tasks.forEach(task => body.appendChild(buildTaskRow(task, project, sp)));
  }

  wrap.append(head, body);
  return wrap;
}

// =========================
// AUFGABE ZEILE
// =========================

function buildTaskRow(task, project, subproject) {
  const row = document.createElement('div');
  row.className = 'project-task-row' + (task.done ? ' done' : '') + (task.isExtra ? ' extra' : '');
  if (subproject) row.style.paddingLeft = '32px';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = task.done;
  cb.className = 'project-task-cb';
  cb.style.accentColor = project.color || '#2563eb';
  cb.addEventListener('change', () => {
    task.done = cb.checked;
    task.completedAt = cb.checked ? Date.now() : null;
    saveProjects(); renderProjects();
  });

  const label = document.createElement('span');
  label.className = 'project-task-label';
  label.textContent = task.text;
  // Inline bearbeiten per Doppelklick
  label.title = 'Doppelklick zum Bearbeiten';
  label.addEventListener('dblclick', () => startInlineEdit(label, task, project));

  const taskActions = document.createElement('div');
  taskActions.className = 'project-task-row-actions';

  // Verschieben-Button
  const moveBtn = document.createElement('button');
  moveBtn.className = 'task-delete proj-task-move';
  moveBtn.textContent = '⇄';
  moveBtn.title = 'Verschieben';
  moveBtn.addEventListener('click', e => { e.stopPropagation(); openMoveTaskModal(task, project, subproject); });

  const del = document.createElement('button');
  del.className = 'task-delete project-task-del';
  del.textContent = '✕';
  del.addEventListener('click', () => {
    if (subproject) {
      subproject.tasks = subproject.tasks.filter(t => t.id !== task.id);
    } else {
      project.tasks = project.tasks.filter(t => t.id !== task.id);
    }
    saveProjects(); renderProjects();
  });

  taskActions.append(moveBtn, del);
  row.append(cb, label, taskActions);
  return row;
}

function startInlineEdit(labelEl, task, project) {
  if (labelEl.querySelector('input')) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.text;
  input.className = 'project-task-inline-input';
  labelEl.textContent = '';
  labelEl.appendChild(input);
  input.focus();
  input.select();

  const commit = () => {
    const val = input.value.trim();
    if (val) task.text = val;
    saveProjects();
    renderProjects();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { input.value = task.text; input.blur(); }
  });
}

// =========================
// COLLAPSE / EXPAND
// =========================

function toggleProjectCollapse(id) {
  const wasCollapsed = isCollapsed(id);
  projectCollapsed[id] = !wasCollapsed;
  saveCollapseState();

  const card = document.getElementById(`proj-card-${id}`);
  if (!card) return;

  if (wasCollapsed) {
    card.classList.remove('collapsed');
    const chevron = card.querySelector('.project-chevron');
    if (chevron) chevron.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 8.5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  } else {
    card.classList.add('collapsed');
    const chevron = card.querySelector('.project-chevron');
    if (chevron) chevron.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 5.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
}

// =========================
// ARCHIV MODAL
// =========================

function openArchiveModal() {
  renderArchiveList();
  document.getElementById('project-archive-overlay').classList.remove('hidden');
}
function closeArchiveModal() {
  document.getElementById('project-archive-overlay').classList.add('hidden');
}

function renderArchiveList() {
  const list = document.getElementById('project-archive-list');
  list.innerHTML = '';
  const archived = projects.filter(p => p.archived);

  if (archived.length === 0) {
    const p = document.createElement('p');
    p.className = 'modal-hint';
    p.textContent = 'Noch keine archivierten Projekte.';
    list.appendChild(p);
    return;
  }

  archived.forEach(project => {
    const stats = getProjectStats(project);
    const row = document.createElement('div');
    row.className = 'archive-project-row';

    const dot = document.createElement('div');
    dot.className = 'project-color-dot';
    dot.style.background = project.color || '#2563eb';
    dot.style.flexShrink = '0';

    const info = document.createElement('div');
    info.className = 'archive-project-info';

    const name = document.createElement('div');
    name.className = 'archive-project-name';
    name.textContent = project.name;

    const meta = document.createElement('div');
    meta.className = 'archive-project-meta';
    meta.textContent = `${stats.coreDone}/${stats.coreTasks.length} Kernaufgaben · ${stats.coreProgress}%`;
    if (stats.extraTasks.length > 0) {
      meta.textContent += ` · ${stats.extraDone}/${stats.extraTasks.length} Extras`;
    }

    info.append(name, meta);

    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn-ghost';
    restoreBtn.style.fontSize = '12px';
    restoreBtn.textContent = '↩ Wiederherstellen';
    restoreBtn.addEventListener('click', () => {
      const idx = projects.findIndex(p => p.id === project.id);
      if (idx !== -1) projects[idx].archived = false;
      saveProjects(); renderArchiveList(); renderProjects();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-ghost';
    deleteBtn.style.cssText = 'font-size:12px;color:var(--prio-1);border-color:var(--prio-1);';
    deleteBtn.textContent = '✕ Löschen';
    deleteBtn.addEventListener('click', () => {
      openConfirmModal(
        `Projekt endgültig löschen?`,
        `„${project.name}" wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
        'Löschen',
        'danger',
        () => {
          projects = projects.filter(p => p.id !== project.id);
          delete projectCollapsed[project.id];
          saveProjects(); saveCollapseState();
          renderArchiveList(); renderProjects();
        }
      );
    });

    btns.append(restoreBtn, deleteBtn);
    row.append(dot, info, btns);
    list.appendChild(row);
  });
}

document.getElementById('project-archive-btn').addEventListener('click', openArchiveModal);
document.getElementById('project-archive-close').addEventListener('click', closeArchiveModal);
document.getElementById('project-archive-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('project-archive-overlay')) closeArchiveModal();
});

// =========================
// BESTÄTIGUNGS-MODAL
// =========================

function openConfirmModal(title, message, confirmText, style, onConfirm) {
  const overlay = document.getElementById('proj-confirm-overlay');
  document.getElementById('proj-confirm-title').textContent = title;
  document.getElementById('proj-confirm-message').textContent = message;
  const btn = document.getElementById('proj-confirm-ok');
  btn.textContent = confirmText;
  btn.className = style === 'danger' ? 'btn-primary proj-confirm-danger' : 'btn-primary';
  overlay.classList.remove('hidden');
  btn.onclick = () => {
    overlay.classList.add('hidden');
    onConfirm();
  };
}

document.getElementById('proj-confirm-cancel').addEventListener('click', () => {
  document.getElementById('proj-confirm-overlay').classList.add('hidden');
});
document.getElementById('proj-confirm-x') && document.getElementById('proj-confirm-x').addEventListener('click', () => {
  document.getElementById('proj-confirm-overlay').classList.add('hidden');
});
document.getElementById('proj-confirm-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('proj-confirm-overlay'))
    document.getElementById('proj-confirm-overlay').classList.add('hidden');
});

// =========================
// PROJEKT MODAL (Neu / Bearbeiten)
// =========================

let editingProject = null;
let selectedProjectColor = PROJECT_COLORS[0];

function openProjectModal(existing = null) {
  editingProject = existing || null;
  selectedProjectColor = existing ? (existing.color || PROJECT_COLORS[0]) : PROJECT_COLORS[0];

  document.getElementById('project-modal-title').textContent = existing ? 'Projekt bearbeiten' : 'Neues Projekt';
  document.getElementById('project-modal-name').value = existing ? existing.name : '';
  document.getElementById('project-modal-desc').value = existing ? (existing.description || '') : '';

  // Startdatum
  const sdInput = document.getElementById('project-modal-startdate');
  if (existing && existing.startDate) {
    const d = new Date(existing.startDate);
    sdInput.value = d.toISOString().slice(0, 10);
  } else {
    sdInput.value = new Date().toISOString().slice(0, 10);
  }

  renderColorPicker();
  document.getElementById('project-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('project-modal-name').focus(), 50);
}

function closeProjectModal() {
  document.getElementById('project-modal-overlay').classList.add('hidden');
  editingProject = null;
}

function renderColorPicker() {
  const picker = document.getElementById('project-color-picker');
  picker.innerHTML = '';
  PROJECT_COLORS.forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'project-color-btn' + (color === selectedProjectColor ? ' active' : '');
    btn.style.background = color;
    btn.dataset.color = color;
    btn.title = color;
    btn.addEventListener('click', () => {
      selectedProjectColor = color;
      document.querySelectorAll('.project-color-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.color === color);
      });
    });
    picker.appendChild(btn);
  });
}

document.getElementById('project-modal-close').addEventListener('click', closeProjectModal);
document.getElementById('project-modal-cancel').addEventListener('click', closeProjectModal);
document.getElementById('project-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('project-modal-overlay')) closeProjectModal();
});
document.getElementById('project-modal-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('project-modal-save').click();
  if (e.key === 'Escape') closeProjectModal();
});

document.getElementById('project-modal-save').addEventListener('click', () => {
  const name = document.getElementById('project-modal-name').value.trim();
  if (!name) return;
  const description = document.getElementById('project-modal-desc').value.trim();
  const sdVal = document.getElementById('project-modal-startdate').value;
  const startDate = sdVal ? new Date(sdVal).getTime() : Date.now();

  if (editingProject) {
    const idx = projects.findIndex(p => p.id === editingProject.id);
    if (idx !== -1) {
      projects[idx].name        = name;
      projects[idx].description = description;
      projects[idx].color       = selectedProjectColor;
      projects[idx].startDate   = startDate;
    }
  } else {
    projects.push({
      id:          crypto.randomUUID(),
      name,
      description,
      color:       selectedProjectColor,
      createdAt:   Date.now(),
      startDate,
      archived:    false,
      tasks:       [],
      subprojects: []
    });
  }

  saveProjects(); closeProjectModal(); renderProjects();
});

// =========================
// AUFGABE HINZUFÜGEN MODAL
// =========================

let addTaskTargetProjectId  = null;
let addTaskIsExtra          = false;
let addTaskTargetSubprojectId = null;

function openAddTaskModal(projectId, isExtra, subprojectId) {
  addTaskTargetProjectId    = projectId;
  addTaskIsExtra            = isExtra;
  addTaskTargetSubprojectId = subprojectId || null;
  const proj = projects.find(p => p.id === projectId);
  let titleText = isExtra ? `Extra zu „${proj ? proj.name : ''}"` : `Aufgabe zu „${proj ? proj.name : ''}"`;
  if (subprojectId && proj) {
    const sp = (proj.subprojects || []).find(s => s.id === subprojectId);
    if (sp) titleText = `Aufgabe zu „${sp.title}"`;
  }
  document.getElementById('project-task-modal-title').textContent = titleText;
  document.getElementById('project-task-input').value = '';
  document.getElementById('project-task-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('project-task-input').focus(), 50);
}

function closeAddTaskModal() {
  document.getElementById('project-task-modal-overlay').classList.add('hidden');
  addTaskTargetProjectId = null;
}

document.getElementById('project-task-modal-close').addEventListener('click', closeAddTaskModal);
document.getElementById('project-task-modal-cancel').addEventListener('click', closeAddTaskModal);
document.getElementById('project-task-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('project-task-modal-overlay')) closeAddTaskModal();
});
document.getElementById('project-task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('project-task-modal-save').click();
  if (e.key === 'Escape') closeAddTaskModal();
});

document.getElementById('project-task-modal-save').addEventListener('click', () => {
  const text = document.getElementById('project-task-input').value.trim();
  if (!text || !addTaskTargetProjectId) return;
  const proj = projects.find(p => p.id === addTaskTargetProjectId);
  if (!proj) return;

  const descVal = (document.getElementById("project-task-desc-input") || {value:""}).value.trim();
  const newTask = { id: crypto.randomUUID(), text, description: descVal, done: false, isExtra: addTaskIsExtra, completedAt: null, checklist: [] };

  if (addTaskTargetSubprojectId) {
    const sp = (proj.subprojects || []).find(s => s.id === addTaskTargetSubprojectId);
    if (sp) sp.tasks.push(newTask);
  } else {
    projectCollapsed[addTaskTargetProjectId] = false;
    saveCollapseState();
    proj.tasks.push(newTask);
  }
  saveProjects(); closeAddTaskModal(); renderProjects();
  if (typeof currentDetailProject !== "undefined" && currentDetailProject && currentDetailProject.id === addTaskTargetProjectId) renderProjectDetail();
  saveProjects(); closeAddTaskModal(); renderProjects();
});

// =========================
// UNTERPROJEKT MODAL
// =========================

let addSubprojectTargetId = null;

function openAddSubprojectModal(projectId) {
  addSubprojectTargetId = projectId;
  const proj = projects.find(p => p.id === projectId);
  document.getElementById('proj-sub-modal-title').textContent = `Unterprojekt zu „${proj ? proj.name : ''}"`;
  document.getElementById('proj-sub-input').value = '';
  document.getElementById('proj-sub-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('proj-sub-input').focus(), 50);
}

function closeAddSubprojectModal() {
  document.getElementById('proj-sub-modal-overlay').classList.add('hidden');
  addSubprojectTargetId = null;
}

document.getElementById('proj-sub-modal-close').addEventListener('click', closeAddSubprojectModal);
document.getElementById('proj-sub-modal-cancel').addEventListener('click', closeAddSubprojectModal);
document.getElementById('proj-sub-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('proj-sub-modal-overlay')) closeAddSubprojectModal();
});
document.getElementById('proj-sub-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('proj-sub-modal-save').click();
  if (e.key === 'Escape') closeAddSubprojectModal();
});

document.getElementById('proj-sub-modal-save').addEventListener('click', () => {
  const title = document.getElementById('proj-sub-input').value.trim();
  if (!title || !addSubprojectTargetId) return;
  const proj = projects.find(p => p.id === addSubprojectTargetId);
  if (!proj) return;
  if (!proj.subprojects) proj.subprojects = [];

  projectCollapsed[addSubprojectTargetId] = false;
  saveCollapseState();

  proj.subprojects.push({
    id:        crypto.randomUUID(),
    title,
    collapsed: false,
    tasks:     []
  });
  saveProjects(); closeAddSubprojectModal(); renderProjects();
});

// =========================
// AUFGABE VERSCHIEBEN MODAL
// =========================

let moveTaskData = null;

function openMoveTaskModal(task, project, subproject) {
  moveTaskData = { task, project, subproject };

  const select = document.getElementById('proj-move-target');
  select.innerHTML = '';

  // Option: Kernaufgaben (Hauptprojekt)
  const optCore = document.createElement('option');
  optCore.value = '__core__';
  optCore.textContent = `📋 Kernaufgaben (${project.name})`;
  select.appendChild(optCore);

  // Option: Extras (Hauptprojekt)
  const optExtra = document.createElement('option');
  optExtra.value = '__extra__';
  optExtra.textContent = `✦ Extras (${project.name})`;
  select.appendChild(optExtra);

  // Optionen: Unterprojekte
  (project.subprojects || []).forEach(sp => {
    const opt = document.createElement('option');
    opt.value = sp.id;
    opt.textContent = `▸ ${sp.title}`;
    select.appendChild(opt);
  });

  // Aktuellen Ziel vorauswählen
  if (subproject) {
    select.value = subproject.id;
  } else if (task.isExtra) {
    select.value = '__extra__';
  } else {
    select.value = '__core__';
  }

  document.getElementById('proj-move-task-name').textContent = `„${task.text}"`;
  document.getElementById('proj-move-modal-overlay').classList.remove('hidden');
}

function closeMoveTaskModal() {
  document.getElementById('proj-move-modal-overlay').classList.add('hidden');
  moveTaskData = null;
}

document.getElementById('proj-move-modal-close').addEventListener('click', closeMoveTaskModal);
document.getElementById('proj-move-modal-cancel').addEventListener('click', closeMoveTaskModal);
document.getElementById('proj-move-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('proj-move-modal-overlay')) closeMoveTaskModal();
});

document.getElementById('proj-move-modal-save').addEventListener('click', () => {
  if (!moveTaskData) return;
  const { task, project, subproject } = moveTaskData;
  const target = document.getElementById('proj-move-target').value;

  // Aus aktuellem Ort entfernen
  if (subproject) {
    subproject.tasks = subproject.tasks.filter(t => t.id !== task.id);
  } else {
    project.tasks = project.tasks.filter(t => t.id !== task.id);
  }

  // An Zielort hinzufügen
  if (target === '__core__') {
    task.isExtra = false;
    project.tasks.push(task);
  } else if (target === '__extra__') {
    task.isExtra = true;
    project.tasks.push(task);
  } else {
    const sp = (project.subprojects || []).find(s => s.id === target);
    if (sp) sp.tasks.push(task);
  }

  saveProjects(); closeMoveTaskModal(); renderProjects();
});

// =========================
// BUTTONS IN DER VIEW
// =========================

document.getElementById('add-project-btn').addEventListener('click', () => openProjectModal());

// =========================
// Init
// =========================

renderProjects();
