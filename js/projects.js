// =========================
// PROJEKTE
// =========================
// Datenstruktur:
// projects = [{
//   id, name, description, color, createdAt, archived,
//   tasks: [{ id, text, done, isExtra, completedAt }]
// }]
//
// Collapse-State: projectCollapsed = { [id]: true/false }
// Standard: alle eingeklappt

if (typeof projects === 'undefined') {
  var projects = DB.get('projects', []);
} else {
  projects = DB.get('projects', []);
}

// Collapse-State persistent — Standard: true (eingeklappt)
let projectCollapsed = DB.get('projectCollapsed', {});

function saveProjects()   { DB.set('projects', projects); }
function saveCollapseState() { DB.set('projectCollapsed', projectCollapsed); }

// Ist ein Projekt eingeklappt? Default: ja
function isCollapsed(id) {
  return projectCollapsed[id] !== false;
}

// =========================
// STATS
// =========================

function getProjectStats(project) {
  const coreTasks  = project.tasks.filter(t => !t.isExtra);
  const extraTasks = project.tasks.filter(t =>  t.isExtra);
  const coreDone   = coreTasks.filter(t => t.done).length;
  const extraDone  = extraTasks.filter(t => t.done).length;
  const coreProgress  = coreTasks.length  === 0 ? 0 : Math.round((coreDone  / coreTasks.length)  * 100);
  const extraProgress = extraTasks.length === 0 ? 0 : Math.round((extraDone / extraTasks.length) * 100);
  return { coreTasks, extraTasks, coreDone, extraDone, coreProgress, extraProgress };
}

const PROJECT_COLORS = [
  '#2563eb','#7c3aed','#db2777','#dc2626',
  '#ea580c','#ca8a04','#16a34a','#0891b2',
  '#475569','#78716c'
];

// =========================
// RENDER — Übersicht
// =========================

function renderProjects() {
  const grid = document.getElementById('project-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Stats-Bar oben rendern
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
  // Gesamtfortschritt über alle aktiven Projekte
  let totalCore = 0, totalDone = 0;
  projects.filter(p => !p.archived).forEach(p => {
    const core = p.tasks.filter(t => !t.isExtra);
    totalCore += core.length;
    totalDone += core.filter(t => t.done).length;
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
// PROJEKT KARTE BAUEN
// =========================

function buildProjectCard(project, stats) {
  const collapsed = isCollapsed(project.id);

  const card = document.createElement('div');
  card.className = 'project-card' + (collapsed ? ' collapsed' : '');
  card.id = `proj-card-${project.id}`;
  card.style.setProperty('--proj-color', project.color || '#2563eb');

  // ---- Header (immer sichtbar) ----
  const header = document.createElement('div');
  header.className = 'project-card-header';
  header.style.cursor = 'pointer';
  header.addEventListener('click', () => toggleProjectCollapse(project.id));

  // Chevron
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

  // Action-Buttons (edit, archive, delete)
  const actions = document.createElement('div');
  actions.className = 'project-card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'task-delete';
  editBtn.textContent = '✎';
  editBtn.title = 'Bearbeiten';
  editBtn.addEventListener('click', e => { e.stopPropagation(); openProjectModal(project); });

  const archBtn = document.createElement('button');
  archBtn.className = 'task-delete';
  archBtn.textContent = '⊘';
  archBtn.title = 'Archivieren';
  archBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (confirm(`Projekt „${project.name}" archivieren?`)) {
      const idx = projects.findIndex(p => p.id === project.id);
      if (idx !== -1) projects[idx].archived = true;
      saveProjects();
      renderProjects();
    }
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'task-delete';
  delBtn.textContent = '✕';
  delBtn.title = 'Löschen';
  delBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (confirm(`Projekt „${project.name}" dauerhaft löschen?`)) {
      projects = projects.filter(p => p.id !== project.id);
      delete projectCollapsed[project.id];
      saveProjects();
      saveCollapseState();
      renderProjects();
    }
  });

  actions.append(editBtn, archBtn, delBtn);
  header.append(chevron, colorDot, titleWrap, actions);
  card.appendChild(header);

  // ---- Progress (immer sichtbar) ----
  const progressSection = document.createElement('div');
  progressSection.className = 'project-progress-section';

  const coreRow = document.createElement('div');
  coreRow.className = 'project-progress-row';
  const coreLabel = document.createElement('span');
  coreLabel.className = 'project-progress-label';
  coreLabel.textContent = `Kernaufgaben ${stats.coreDone}/${stats.coreTasks.length}`;
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
  // Kein display:none — CSS regelt das über max-height + overflow

  // Aufgabenliste
  const taskSection = document.createElement('div');
  taskSection.className = 'project-task-section';

  const coreTasks  = project.tasks.filter(t => !t.isExtra);
  const extraTasks = project.tasks.filter(t =>  t.isExtra);

  if (coreTasks.length === 0 && extraTasks.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'project-task-empty';
    hint.textContent = 'Noch keine Aufgaben.';
    taskSection.appendChild(hint);
  }

  coreTasks.forEach(task => taskSection.appendChild(buildTaskRow(task, project)));

  if (extraTasks.length > 0) {
    const extraDivider = document.createElement('div');
    extraDivider.className = 'project-section-divider';
    extraDivider.textContent = '✦ Extras';
    taskSection.appendChild(extraDivider);
    extraTasks.forEach(task => taskSection.appendChild(buildTaskRow(task, project)));
  }

  expandable.appendChild(taskSection);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'project-card-footer';

  const addCoreBtn = document.createElement('button');
  addCoreBtn.className = 'project-add-task-btn';
  addCoreBtn.textContent = '+ Aufgabe';
  addCoreBtn.addEventListener('click', () => openAddTaskModal(project.id, false));

  const addExtraBtn = document.createElement('button');
  addExtraBtn.className = 'project-add-task-btn project-add-task-btn--extra';
  addExtraBtn.textContent = '+ Extra';
  addExtraBtn.title = 'Extra-Aufgabe hinzufügen';
  addExtraBtn.addEventListener('click', () => openAddTaskModal(project.id, true));

  footer.append(addCoreBtn, addExtraBtn);
  expandable.appendChild(footer);

  card.appendChild(expandable);
  return card;
}

function buildTaskRow(task, project) {
  const row = document.createElement('div');
  row.className = 'project-task-row' + (task.done ? ' done' : '') + (task.isExtra ? ' extra' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = task.done;
  cb.className = 'project-task-cb';
  cb.addEventListener('change', () => {
    task.done = cb.checked;
    task.completedAt = cb.checked ? Date.now() : null;
    saveProjects();
    renderProjects();
  });

  const label = document.createElement('span');
  label.className = 'project-task-label';
  label.textContent = task.text;

  const del = document.createElement('button');
  del.className = 'task-delete project-task-del';
  del.textContent = '✕';
  del.addEventListener('click', () => {
    project.tasks = project.tasks.filter(t => t.id !== task.id);
    saveProjects();
    renderProjects();
  });

  row.append(cb, label, del);
  return row;
}

// =========================
// COLLAPSE / EXPAND
// =========================

function toggleProjectCollapse(id) {
  const wasCollapsed = isCollapsed(id);
  projectCollapsed[id] = !wasCollapsed;
  saveCollapseState();

  // DOM direkt updaten statt komplett neu rendern (smoother)
  const card = document.getElementById(`proj-card-${id}`);
  if (!card) return;

  if (wasCollapsed) {
    card.classList.remove('collapsed');
    // Chevron auf "offen" setzen
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
      saveProjects();
      renderArchiveList();
      renderProjects();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-ghost';
    deleteBtn.style.cssText = 'font-size:12px;color:var(--prio-1);border-color:var(--prio-1);';
    deleteBtn.textContent = '✕ Löschen';
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Projekt „${project.name}" endgültig löschen?`)) {
        projects = projects.filter(p => p.id !== project.id);
        delete projectCollapsed[project.id];
        saveProjects();
        saveCollapseState();
        renderArchiveList();
        renderProjects();
      }
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

  if (editingProject) {
    const idx = projects.findIndex(p => p.id === editingProject.id);
    if (idx !== -1) {
      projects[idx].name        = name;
      projects[idx].description = description;
      projects[idx].color       = selectedProjectColor;
    }
  } else {
    projects.push({
      id:          crypto.randomUUID(),
      name,
      description,
      color:       selectedProjectColor,
      createdAt:   Date.now(),
      archived:    false,
      tasks:       []
    });
  }

  saveProjects();
  closeProjectModal();
  renderProjects();
});

// =========================
// AUFGABE HINZUFÜGEN MODAL
// =========================

let addTaskTargetProjectId = null;
let addTaskIsExtra = false;

function openAddTaskModal(projectId, isExtra = false) {
  addTaskTargetProjectId = projectId;
  addTaskIsExtra = isExtra;
  const proj = projects.find(p => p.id === projectId);
  document.getElementById('project-task-modal-title').textContent =
    isExtra
      ? `Extra zu „${proj ? proj.name : ''}"`
      : `Aufgabe zu „${proj ? proj.name : ''}"`;
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

  // Projekt beim Hinzufügen einer Aufgabe automatisch aufklappen
  projectCollapsed[addTaskTargetProjectId] = false;
  saveCollapseState();

  proj.tasks.push({
    id:          crypto.randomUUID(),
    text,
    done:        false,
    isExtra:     addTaskIsExtra,
    completedAt: null
  });
  saveProjects();
  closeAddTaskModal();
  renderProjects();
});

// =========================
// BUTTONS IN DER VIEW
// =========================

document.getElementById('add-project-btn').addEventListener('click', () => openProjectModal());

// =========================
// Init
// =========================

renderProjects();
