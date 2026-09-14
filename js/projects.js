// =========================
// PROJEKTE
// =========================
// Datenstruktur:
// projects = [{
//   id, name, description, priority, dueDate, createdAt, startDate, updatedAt, archived,
//   tasks: [{ id, text, done, isExtra, completedAt }],
//   subprojects: [{ id, title, collapsed, tasks: [...] }]
// }]

if (typeof projects === 'undefined') {
  var projects = DB.get('projects', []);
} else {
  projects = DB.get('projects', []);
}

function saveProjects() { DB.set('projects', projects); }

// Migriert alte Projekte auf neue Felder
function migrateProject(p) {
  if (!p.tasks)       p.tasks       = [];
  if (!p.subprojects) p.subprojects = [];
  if (!p.startDate)   p.startDate   = p.createdAt || Date.now();
  if (p.archived === undefined) p.archived = false;
  if (!p.priority)    p.priority    = 'Mittel';
  if (!p.updatedAt)   p.updatedAt   = p.createdAt || Date.now();
  // dueDate bleibt undefined wenn nicht gesetzt
  p.subprojects.forEach(sp => {
    if (!sp.tasks)     sp.tasks     = [];
    if (sp.collapsed === undefined) sp.collapsed = true;
  });
  // img/cherryblossom.png -> img/appleblossom.png umbenannt (DECOR_REGISTRY-
  // Id in project-tree.js ebenfalls) — bereits gespeicherte Zuweisungen
  // (task.decorId) und Customizing-Auswahl (p.customizing) migrieren, statt
  // sie ensureTaskDecor() als ungültig verwerfen und NEU würfeln zu lassen:
  // eine schon gewachsene Blüte darf durch die Umbenennung nicht plötzlich
  // zu einer anderen Sorte werden.
  [...p.tasks, ...p.subprojects.flatMap(sp => sp.tasks)].forEach(t => {
    if (t.decorId === 'cherryblossom') t.decorId = 'appleblossom';
  });
  if (p.customizing) {
    ['core', 'extra'].forEach(cat => {
      if (Array.isArray(p.customizing[cat])) {
        p.customizing[cat] = p.customizing[cat].map(id => id === 'cherryblossom' ? 'appleblossom' : id);
      }
    });
  }
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

// Formatiert das Fälligkeitsdatum inkl. Resttage/Überfällig-Hinweis.
// Gibt null zurück, wenn kein dueDate gesetzt ist (Feld bleibt dann in der
// Infokarte versteckt, siehe renderProjectDetail() in forest.js).
function formatDueDate(project) {
  if (!project.dueDate) return null;
  const date = new Date(project.dueDate);
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  const dateStr = `${d}.${m}.${y}`;
  if (project.archived) return { text: dateStr, overdue: false };

  const now = new Date();
  const diffDays = Math.ceil((date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / (1000 * 60 * 60 * 24));
  if (diffDays < 0)  return { text: `Überfällig seit ${Math.abs(diffDays)} Tag${Math.abs(diffDays) === 1 ? '' : 'en'} (${dateStr})`, overdue: true };
  if (diffDays === 0) return { text: `Heute fällig (${dateStr})`, overdue: false };
  if (diffDays === 1) return { text: `Morgen fällig (${dateStr})`, overdue: false };
  return { text: `Fällig am ${dateStr}`, overdue: false };
}

// Datumsfeld (<input type="date"> liefert "YYYY-MM-DD") <-> Timestamp, immer
// in lokaler Zeit statt UTC (new Date("YYYY-MM-DD") parst als UTC-Mitternacht,
// was je nach Zeitzone einen Tag verrutschen lässt — sowohl beim Zurückschreiben
// ins Feld als auch bei Tage-Differenzen wie "Überfällig seit X Tagen").
function dateInputToTimestamp(val) {
  if (!val) return null;
  const [y, m, d] = val.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
function timestampToDateInput(ts) {
  if (!ts) return '';
  const d  = new Date(ts);
  const y  = d.getFullYear();
  const m  = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// =========================
// RENDER — Übersicht
// =========================

// Projektwald ist die einzige Übersicht — renderProjects() bleibt nur als
// Dispatch-Ziel bestehen, da renderView('projects') (main.js) genau diesen
// Funktionsnamen aufruft.
function renderProjects() {
  renderForest();
}

function startInlineEdit(labelEl, task, project, onDone) {
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
    if (typeof onDone === 'function') onDone(); else renderProjects();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { input.value = task.text; input.blur(); }
  });
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

    const info = document.createElement('div');
    info.className = 'archive-project-info';

    const name = document.createElement('div');
    name.className = 'archive-project-name';
    name.textContent = project.name;

    const meta = document.createElement('div');
    meta.className = 'archive-project-meta';
    meta.textContent = `${stats.coreDone + stats.subDone}/${stats.coreTasks.length + stats.subTotal} Kernaufgaben · ${stats.coreProgress}%`;
    if (stats.extraTasks.length > 0) {
      meta.textContent += ` · ${stats.extraDone}/${stats.extraTasks.length} Extras`;
    }

    info.append(name, meta);

    const btns = document.createElement('div');
    btns.className = 'archive-project-actions';

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn-ghost archive-project-restore-btn';
    restoreBtn.textContent = '↩ Wiederherstellen';
    restoreBtn.addEventListener('click', () => {
      const idx = projects.findIndex(p => p.id === project.id);
      if (idx !== -1) projects[idx].archived = false;
      saveProjects(); renderArchiveList(); renderProjects();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-ghost archive-project-delete-btn';
    deleteBtn.textContent = '✕ Löschen';
    deleteBtn.addEventListener('click', () => {
      openConfirmModal(
        `Projekt endgültig löschen?`,
        `„${project.name}" wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
        'Löschen',
        'danger',
        () => {
          projects = projects.filter(p => p.id !== project.id);
          saveProjects();
          renderArchiveList(); renderProjects();
        }
      );
    });

    btns.append(restoreBtn, deleteBtn);
    row.append(info, btns);
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
let selectedPriority = 'Mittel';

function openProjectModal(existing = null) {
  editingProject   = existing || null;
  selectedPriority = existing ? (existing.priority || 'Mittel') : 'Mittel';

  document.getElementById('project-modal-title').textContent = existing ? 'Projekt bearbeiten' : 'Neues Projekt';
  document.getElementById('project-modal-name').value = existing ? existing.name : '';
  document.getElementById('project-modal-desc').value = existing ? (existing.description || '') : '';

  // Startdatum
  const startInput = document.getElementById('project-modal-startdate');
  if (startInput) startInput.value = existing ? timestampToDateInput(existing.startDate) : '';

  // Fälligkeit
  const dueInput = document.getElementById('project-modal-due');
  if (dueInput) dueInput.value = existing ? timestampToDateInput(existing.dueDate) : '';

  // Priorität Buttons
  ['low','mid','high'].forEach(k => {
    const map = { low:'Niedrig', mid:'Mittel', high:'Hoch' };
    const btn = document.getElementById(`prio-${k}`);
    if (btn) btn.classList.toggle('active', map[k] === selectedPriority);
  });

  document.getElementById('project-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('project-modal-name').focus(), 50);
}

function closeProjectModal() {
  document.getElementById('project-modal-overlay').classList.add('hidden');
  editingProject = null;
}

// Priorität Buttons
['low','mid','high'].forEach(k => {
  const map = { low:'Niedrig', mid:'Mittel', high:'Hoch' };
  const btn = document.getElementById(`prio-${k}`);
  if (btn) btn.addEventListener('click', () => {
    selectedPriority = map[k];
    ['low','mid','high'].forEach(j => {
      const b = document.getElementById(`prio-${j}`);
      if (b) b.classList.toggle('active', map[j] === selectedPriority);
    });
  });
});

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
  const startVal  = document.getElementById('project-modal-startdate') ? document.getElementById('project-modal-startdate').value : '';
  const dueVal    = document.getElementById('project-modal-due') ? document.getElementById('project-modal-due').value : '';
  const dueDate   = dateInputToTimestamp(dueVal);
  const now = Date.now();

  if (editingProject) {
    const idx = projects.findIndex(p => p.id === editingProject.id);
    if (idx !== -1) {
      // Leeres Startdatum-Feld setzt nicht auf "kein Datum" zurück, sondern auf
      // das Erstellungsdatum — formatStartDate() fällt ohnehin darauf zurück,
      // sobald project.startDate leer ist.
      projects[idx].name        = name;
      projects[idx].description = description;
      projects[idx].priority    = selectedPriority;
      projects[idx].startDate   = dateInputToTimestamp(startVal) || projects[idx].createdAt || now;
      projects[idx].dueDate     = dueDate;
      projects[idx].updatedAt   = now;
    }
  } else {
    projects.push({
      id:          crypto.randomUUID(),
      name,
      description,
      priority:    selectedPriority,
      dueDate,
      createdAt:   now,
      startDate:   dateInputToTimestamp(startVal) || now,
      updatedAt:   now,
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
    proj.tasks.push(newTask);
  }
  proj.updatedAt = Date.now();
  // Ziel-Id vor closeAddTaskModal() sichern — die setzt addTaskTargetProjectId
  // sofort auf null zurück, sonst schlägt der Detailseiten-Refresh-Check unten fehl.
  const savedTargetProjectId = addTaskTargetProjectId;
  saveProjects(); closeAddTaskModal(); renderProjects();
  if (typeof currentDetailProject !== "undefined" && currentDetailProject && currentDetailProject.id === savedTargetProjectId) {
    renderProjectDetail();
  }
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

  proj.subprojects.push({
    id:        crypto.randomUUID(),
    title,
    collapsed: false,
    tasks:     []
  });
  proj.updatedAt = Date.now();
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
  if (typeof currentDetailProject !== "undefined" && currentDetailProject && currentDetailProject.id === project.id) {
    renderProjectDetail();
  }
});

// =========================
// BUTTONS IN DER VIEW
// =========================

document.getElementById('add-project-btn').addEventListener('click', () => openProjectModal());

// Kein Init-Aufruf von renderProjects() hier nötig: forest.js (lädt danach)
// ruft switchToForestView() bereits unconditional bei eigenem Laden auf,
// was renderForest() intern anstößt. Ein Aufruf hier wäre zu früh —
// renderForest() existiert erst, sobald forest.js geladen ist.
