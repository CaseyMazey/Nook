// =========================
// PROJEKTWALD — forest.js
// =========================

let forestView    = DB.get('projectForestView', false);
let treeLayouts   = DB.get('treeLayouts', {}); // stabile Baumstrukturen je Projekt-ID

// =================================================
// BAUMRENDERING -> ausgelagert in project-tree.js
// Verfuegbare Funktionen:
//   drawTree(project, size)                    -> SVG-String (Waldbaum klein)
//   drawDetailTree(project, W, H, layerStart)  -> SVG-String (Detailbaum gross)
//   updateDetailTreeElements(project)          -> aktualisiert Blaetter/Aepfel
// =================================================


// =========================
// WALD HINTERGRUND
// =========================
function getForestBackground() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8ede4" stop-opacity="0.5"/><stop offset="100%" stop-color="#d4dbc8" stop-opacity="0.3"/></linearGradient>
    <linearGradient id="hillG1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8c9a3" stop-opacity="0.35"/><stop offset="100%" stop-color="#a0b88a" stop-opacity="0.2"/></linearGradient>
    <linearGradient id="groundG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c4d4a8" stop-opacity="0.4"/><stop offset="100%" stop-color="#b0c090" stop-opacity="0.25"/></linearGradient>
  </defs>
  <rect width="1200" height="700" fill="url(#skyG)"/>
  <ellipse cx="250" cy="520" rx="380" ry="180" fill="url(#hillG1)"/>
  <ellipse cx="750" cy="540" rx="420" ry="160" fill="url(#hillG1)"/>
  <ellipse cx="1100" cy="530" rx="300" ry="150" fill="url(#hillG1)"/>
  <path d="M0 480 Q150 360 300 420 Q450 360 600 400 Q750 340 900 390 Q1050 340 1200 380 L1200 700 L0 700Z" fill="#c8d4b4" opacity="0.18"/>
  <path d="M0 600 Q300 580 600 590 Q900 600 1200 585 L1200 700 L0 700Z" fill="url(#groundG)"/>
  <path d="M480 700 Q520 640 540 590 Q560 540 580 500" stroke="#c8bb96" stroke-width="28" fill="none" opacity="0.22" stroke-linecap="round"/>
  <path d="M480 700 Q520 640 540 590 Q560 540 580 500" stroke="#d4c8a0" stroke-width="14" fill="none" opacity="0.18" stroke-linecap="round"/>
  <path d="M0 630 Q200 618 400 625 Q600 612 800 620 Q1000 610 1200 616 L1200 700 L0 700Z" fill="#b8cc98" opacity="0.22"/>
  <ellipse cx="80" cy="615" rx="45" ry="25" fill="#8aab72" opacity="0.22"/>
  <ellipse cx="110" cy="608" rx="35" ry="20" fill="#9abb82" opacity="0.2"/>
  <ellipse cx="1100" cy="618" rx="50" ry="26" fill="#8aab72" opacity="0.2"/>
  <ellipse cx="380" cy="625" rx="30" ry="16" fill="#8aab72" opacity="0.17"/>
  <ellipse cx="820" cy="622" rx="28" ry="15" fill="#9abb82" opacity="0.16"/>
  <ellipse cx="200" cy="638" rx="12" ry="6" fill="#b0b09a" opacity="0.2"/>
  <ellipse cx="900" cy="642" rx="9" ry="5" fill="#b0b09a" opacity="0.18"/>
  <circle cx="160" cy="630" r="4" fill="#f0d080" opacity="0.3"/>
  <circle cx="960" cy="632" r="4" fill="#f0d080" opacity="0.28"/>
  <circle cx="720" cy="635" r="4" fill="#f0e080" opacity="0.25"/>
  <rect x="280" y="618" width="22" height="14" rx="3" fill="#8a6a42" opacity="0.18"/>
  <ellipse cx="291" cy="618" rx="11" ry="5" fill="#a07a52" opacity="0.18"/>
  <path d="M0 660 Q200 650 400 658 Q500 662 600 660" stroke="#a8c4d8" stroke-width="6" fill="none" opacity="0.15" stroke-linecap="round"/>
</svg>`;
}

// =========================
// WALD RENDERN
// =========================
function renderForest() {
  const container = document.getElementById('project-forest');
  if (!container) return;
  container.innerHTML = '';

  const bgWrap = document.createElement('div');
  bgWrap.className = 'forest-bg';
  bgWrap.innerHTML = getForestBackground();
  container.appendChild(bgWrap);

  const allProjects = projects;
  if (allProjects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'forest-empty';
    empty.textContent = 'Dein Wald ist noch leer. Erstelle dein erstes Projekt.';
    container.appendChild(empty);
    return;
  }

  const cols     = Math.min(allProjects.length, 4);
  const rows     = Math.ceil(allProjects.length / cols);
  const treeSize = Math.min(180, Math.max(120, Math.floor(container.clientWidth / (cols + 0.5))));

  allProjects.forEach((project, i) => {
    const col  = i % cols;
    const row  = Math.floor(i / cols);
    const rng  = seededRand(idToSeed(project.id) + 42);

    const jitterX = (rng() - 0.5) * 40;
    const jitterY = (rng() - 0.5) * 20;
    const colW    = 100 / cols;
    const xPct    = colW * col + colW / 2 + jitterX / 12;
    const yBase   = 25 + row * (55 / Math.max(rows, 1));
    const yPct    = Math.min(78, yBase + jitterY / 8);

    const wrap = document.createElement('div');
    wrap.className = 'forest-tree-wrap' + (project.archived ? ' archived' : '');
    wrap.style.cssText = `left:${xPct}%;top:${yPct}%;width:${treeSize}px;`;

    const svgWrap = document.createElement('div');
    svgWrap.className = 'forest-tree-svg';
    svgWrap.innerHTML = drawTree(project, treeSize);

    const allTasks = (project.subprojects || []).flatMap(sp => sp.tasks || []);
    const total    = allTasks.length;
    const done     = allTasks.filter(t => t.done).length;
    const pct      = total === 0 ? 0 : Math.round(done / total * 100);

    const statusDot = document.createElement('span');
    statusDot.className = 'forest-tree-dot';
    statusDot.style.background = project.archived ? '#d97706' : (pct === 100 ? '#16a34a' : (project.color || '#4a7c59'));

    const nameEl = document.createElement('span');
    nameEl.className = 'forest-tree-name';
    nameEl.textContent = project.name;

    const labelTop = document.createElement('div');
    labelTop.style.cssText = 'display:flex;align-items:center;gap:4px;';
    labelTop.append(statusDot, nameEl);

    const bar = document.createElement('div');
    bar.className = 'forest-tree-bar';
    const fill = document.createElement('div');
    fill.className = 'forest-tree-bar-fill';
    fill.style.cssText = `width:${pct}%;background:${project.archived ? '#d97706' : (project.color || '#4a7c59')};`;
    bar.appendChild(fill);
    const pctLabel = document.createElement('span');
    pctLabel.className = 'forest-tree-pct';
    pctLabel.textContent = `${pct}%`;

    const progressRow = document.createElement('div');
    progressRow.className = 'forest-tree-progress';
    progressRow.append(bar, pctLabel);

    const labelBox = document.createElement('div');
    labelBox.className = 'forest-tree-label';
    labelBox.append(labelTop, progressRow);

    wrap.append(svgWrap, labelBox);
    wrap.addEventListener('click', () => openProjectDetail(project.id));

    container.appendChild(wrap);
  });
}

// =========================
// TOGGLE LOGIK
// =========================
function switchToCardView() {
  forestView = false;
  DB.set('projectForestView', false);
  document.getElementById('project-grid').style.display   = '';
  document.getElementById('project-forest').style.display = 'none';
  document.getElementById('view-project-detail').style.display = 'none';
  document.getElementById('proj-view-cards').classList.add('active');
  document.getElementById('proj-view-forest').classList.remove('active');
}

function switchToForestView() {
  forestView = true;
  DB.set('projectForestView', true);
  document.getElementById('project-grid').style.display   = 'none';
  document.getElementById('project-forest').style.display = '';
  document.getElementById('view-project-detail').style.display = 'none';
  document.getElementById('proj-view-cards').classList.remove('active');
  document.getElementById('proj-view-forest').classList.add('active');
  renderForest();
}

document.getElementById('proj-view-cards').addEventListener('click', switchToCardView);
document.getElementById('proj-view-forest').addEventListener('click', switchToForestView);

if (forestView) switchToForestView();

// =========================
// DETAILANSICHT
// =========================
let currentDetailProject = null;
let detailSubLayer = 0;

function openProjectDetail(projectId) {
  currentDetailProject = projects.find(p => p.id === projectId);
  if (!currentDetailProject) return;
  detailSubLayer = 0;

  const vh = document.querySelector('#view-projects > .view-header');
  if (vh) vh.style.display = 'none';
  const dc = document.querySelector('#view-projects .dash-content');
  if (dc) dc.classList.add('pdt-active');

  document.getElementById('project-grid').style.display   = 'none';
  document.getElementById('project-forest').style.display = 'none';
  document.getElementById('view-project-detail').style.display = '';

  renderProjectDetail();
}

function closeProjectDetail() {
  const vh = document.querySelector('#view-projects > .view-header');
  if (vh) vh.style.display = '';
  const dc = document.querySelector('#view-projects .dash-content');
  if (dc) dc.classList.remove('pdt-active');

  document.getElementById('view-project-detail').style.display = 'none';
  currentDetailProject = null;
  switchToForestView();
}

function renderProjectDetail() {
  const p = currentDetailProject;
  if (!p) return;

  document.getElementById('proj-detail-name').textContent   = p.name;
  document.getElementById('proj-detail-desc').textContent   = p.description || '';
  document.getElementById('proj-detail-status').textContent = p.archived ? 'Archiviert' : 'Aktives Projekt';
  document.getElementById('proj-detail-status').className   = 'pdt-status-badge' + (p.archived ? ' archived' : '');

  const allTasks = (p.subprojects||[]).flatMap(sp => sp.tasks||[]);
  const total    = allTasks.length;
  const done     = allTasks.filter(t => t.done).length;
  const pct      = total === 0 ? 0 : Math.round(done / total * 100);

  document.getElementById('proj-detail-pct').textContent       = pct + '%';
  document.getElementById('proj-detail-bar-fill').style.cssText = `width:${pct}%;background:${p.color||'#4a7c59'};`;
  document.getElementById('proj-detail-task-count').textContent = `${done} / ${total} Aufgaben`;
  document.getElementById('proj-detail-sub-count').textContent  = `${p.subprojects.length} Unterprojekte`;
  document.getElementById('proj-detail-startdate').textContent  = formatStartDate(p) || '—';
  document.getElementById('proj-detail-color-dot').style.background = p.color || '#4a7c59';

  // Neue Felder
  const colorNameEl = document.getElementById('proj-detail-color-name');
  if (colorNameEl) colorNameEl.textContent = p.color || '#4a7c59';
  const statusValEl = document.getElementById('proj-detail-status-val');
  if (statusValEl) { statusValEl.textContent = p.archived ? 'Archiviert' : 'Aktiv'; statusValEl.style.color = p.archived ? '#d97706' : '#16a34a'; }
  const subValEl = document.getElementById('proj-detail-sub-val');
  if (subValEl) subValEl.textContent = p.subprojects.length;

  // Baum
  const treeContainer = document.getElementById('proj-detail-tree');
  const W = 520, H = 480;
  treeContainer.style.width  = W + 'px';
  treeContainer.style.height = H + 'px';
  treeContainer.innerHTML = drawDetailTree(p, W, H, detailSubLayer * 7);

  // Interaktion: Klick auf Blätter/Äpfel
  treeContainer.querySelectorAll('.detail-leaf, .detail-apple').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const taskId = el.dataset.taskId;
      const spId   = el.dataset.spId;
      const sp     = p.subprojects.find(s => s.id === spId);
      if (!sp) return;
      const task   = sp.tasks.find(t => t.id === taskId);
      if (!task) return;
      openTaskDetail(task, sp, p);
    });
  });

  // Mehr-Äste-Button
  const moreBtn = document.getElementById('proj-detail-more-branches');
  if (p.subprojects.length > 7) {
    moreBtn.style.display = '';
    moreBtn.textContent   = detailSubLayer === 0 ? `▸ Weitere Äste (${p.subprojects.length - 7})` : '◂ Erste Äste';
  } else {
    moreBtn.style.display = 'none';
  }

  renderDetailTiles();
}

function renderDetailTiles() {
  const p    = currentDetailProject;
  const grid = document.getElementById('proj-detail-tiles');
  grid.innerHTML = '';

  const layerStart  = detailSubLayer * 7;
  const visibleSubs = p.subprojects.slice(layerStart, layerStart + 7);

  if (visibleSubs.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:20px;">Noch keine Unterprojekte. Füge über „+ Ast hinzufügen" einen hinzu.</div>';
    return;
  }

  visibleSubs.forEach(sp => {
    const stats = getSubprojectStats(sp);
    const tile  = document.createElement('div');
    tile.className = 'detail-tile';

    const head = document.createElement('div');
    head.className = 'detail-tile-head';
    const title = document.createElement('div');
    title.className = 'detail-tile-title';
    title.textContent = sp.title;
    const meta = document.createElement('div');
    meta.className = 'detail-tile-meta';
    meta.textContent = `${stats.done}/${stats.total}`;
    head.append(title, meta);

    const barWrap = document.createElement('div');
    barWrap.className = 'detail-tile-bar-wrap';
    const barFill = document.createElement('div');
    barFill.className = 'detail-tile-bar-fill';
    barFill.style.cssText = `width:${stats.pct}%;background:${stats.pct===100?'#16a34a':(p.color||'#4a7c59')};`;
    barWrap.appendChild(barFill);

    const taskList = document.createElement('div');
    taskList.className = 'detail-tile-tasks';

    if (sp.tasks.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'detail-tile-empty';
      hint.textContent = 'Noch keine Aufgaben.';
      taskList.appendChild(hint);
    }

    sp.tasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'detail-tile-task-row' + (task.done ? ' done' : '') + (task.isExtra ? ' extra' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = task.done;
      cb.className = 'project-task-cb';
      cb.style.accentColor = p.color || '#4a7c59';
      cb.addEventListener('change', () => {
        task.done = cb.checked;
        task.completedAt = cb.checked ? Date.now() : null;
        saveProjects();
        // NUR Blätter/Äpfel neu zeichnen — Baumstruktur bleibt!
        updateDetailTreeElements(p);
        renderDetailTiles();
        if (forestView) renderForest();
      });
      const label = document.createElement('span');
      label.className = 'detail-tile-task-label';
      label.textContent = task.text;
      if (task.description || (task.checklist && task.checklist.length)) {
        const dot = document.createElement('span');
        dot.className = 'detail-task-has-detail';
        dot.textContent = '·';
        label.appendChild(dot);
      }
      label.addEventListener('click', () => openTaskDetail(task, sp, p));
      label.style.cursor = 'pointer';
      if (task.isExtra) {
        const badge = document.createElement('span');
        badge.className = 'detail-tile-extra-badge';
        badge.textContent = '✦';
        row.append(cb, label, badge);
      } else {
        row.append(cb, label);
      }
      taskList.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'detail-tile-add-btn';
    addBtn.textContent = '+ Aufgabe hinzufügen';
    addBtn.addEventListener('click', () => openAddTaskModalFromDetail(p.id, sp.id));
    taskList.appendChild(addBtn);

    tile.append(head, barWrap, taskList);
    grid.appendChild(tile);
  });
}


// updateDetailTreeElements -> project-tree.js


// =========================
// AUFGABE DETAIL MODAL
// =========================
let currentTaskDetail = null;

function openTaskDetail(task, sp, project) {
  currentTaskDetail = { task, sp, project };
  document.getElementById('task-detail-title').textContent = task.text;
  document.getElementById('task-detail-sp').textContent    = sp.title;
  document.getElementById('task-detail-type').textContent  = task.isExtra ? '✦ Extra' : '◉ Kern';
  document.getElementById('task-detail-desc').value        = task.description || '';
  document.getElementById('task-detail-done-cb').checked   = task.done;
  renderTaskDetailChecklist();
  document.getElementById('task-detail-overlay').classList.remove('hidden');
}

function closeTaskDetail() {
  document.getElementById('task-detail-overlay').classList.add('hidden');
  currentTaskDetail = null;
}

function renderTaskDetailChecklist() {
  const { task } = currentTaskDetail;
  const list = document.getElementById('task-detail-checklist');
  list.innerHTML = '';
  (task.checklist || []).forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'task-cl-row' + (item.done ? ' done' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = item.done; cb.className = 'project-task-cb';
    cb.addEventListener('change', () => { item.done = cb.checked; saveProjects(); renderTaskDetailChecklist(); });
    const lbl = document.createElement('span');
    lbl.className = 'task-cl-label'; lbl.textContent = item.text;
    const del = document.createElement('button');
    del.className = 'task-delete'; del.textContent = '✕';
    del.addEventListener('click', () => { task.checklist.splice(i, 1); saveProjects(); renderTaskDetailChecklist(); });
    row.append(cb, lbl, del);
    list.appendChild(row);
  });
}

document.getElementById('task-detail-desc').addEventListener('input', () => {
  if (!currentTaskDetail) return;
  currentTaskDetail.task.description = document.getElementById('task-detail-desc').value;
  saveProjects();
});

document.getElementById('task-detail-done-cb').addEventListener('change', () => {
  if (!currentTaskDetail) return;
  currentTaskDetail.task.done = document.getElementById('task-detail-done-cb').checked;
  currentTaskDetail.task.completedAt = currentTaskDetail.task.done ? Date.now() : null;
  saveProjects();
  if (currentDetailProject) { updateDetailTreeElements(currentDetailProject); renderDetailTiles(); }
});

document.getElementById('task-detail-add-cl').addEventListener('click', () => {
  const input = document.getElementById('task-detail-cl-input');
  const text  = input.value.trim();
  if (!text || !currentTaskDetail) return;
  if (!currentTaskDetail.task.checklist) currentTaskDetail.task.checklist = [];
  currentTaskDetail.task.checklist.push({ id: crypto.randomUUID(), text, done: false });
  input.value = '';
  saveProjects(); renderTaskDetailChecklist();
});
document.getElementById('task-detail-cl-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('task-detail-add-cl').click();
});
document.getElementById('task-detail-close').addEventListener('click', closeTaskDetail);
document.getElementById('task-detail-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('task-detail-overlay')) closeTaskDetail();
});

// =========================
// AUFGABE AUS DETAIL HINZUFÜGEN
// =========================
function openAddTaskModalFromDetail(projectId, subprojectId) {
  closeTaskDetail();
  addTaskTargetProjectId    = projectId;
  addTaskIsExtra            = false;
  addTaskTargetSubprojectId = subprojectId;
  const proj = projects.find(p => p.id === projectId);
  const sp   = (proj.subprojects||[]).find(s => s.id === subprojectId);
  document.getElementById('project-task-modal-title').textContent = `Aufgabe zu „${sp ? sp.title : ''}"`;
  document.getElementById('project-task-input').value = '';
  document.getElementById('project-task-desc-input').value = '';
  document.getElementById('task-type-core').classList.add('active');
  document.getElementById('task-type-extra').classList.remove('active');
  addTaskIsExtra = false;
  document.getElementById('project-task-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('project-task-input').focus(), 50);
}

document.getElementById('task-type-core').addEventListener('click', () => {
  addTaskIsExtra = false;
  document.getElementById('task-type-core').classList.add('active');
  document.getElementById('task-type-extra').classList.remove('active');
});
document.getElementById('task-type-extra').addEventListener('click', () => {
  addTaskIsExtra = true;
  document.getElementById('task-type-extra').classList.add('active');
  document.getElementById('task-type-core').classList.remove('active');
});

// =========================
// DETAIL VIEW EVENTS
// =========================
document.getElementById('proj-detail-back').addEventListener('click', closeProjectDetail);
document.getElementById('proj-detail-more-branches').addEventListener('click', () => {
  detailSubLayer = detailSubLayer === 0 ? 1 : 0;
  renderProjectDetail();
});
document.getElementById('proj-detail-add-branch').addEventListener('click', () => {
  if (currentDetailProject) openAddSubprojectModal(currentDetailProject.id);
});
// Neuer sichtbarer "Ast hinzufügen" Button
const _addBranchVisible = document.getElementById('proj-detail-add-branch-visible');
if (_addBranchVisible) _addBranchVisible.addEventListener('click', () => {
  if (currentDetailProject) openAddSubprojectModal(currentDetailProject.id);
});
// Bearbeiten Button
const _editBtn = document.getElementById('proj-detail-edit-btn');
if (_editBtn) _editBtn.addEventListener('click', () => {
  if (currentDetailProject) openProjectModal(currentDetailProject);
});
