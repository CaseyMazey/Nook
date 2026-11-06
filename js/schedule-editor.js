// =========================
// STUNDENPLAN — Bearbeitungsfenster
// Wochenübersicht (Mo–So), Tageseditor (Rahmen, Schulzeit, Pausen,
// Unterricht, Blöcke), Fächer & Lehrkräfte, Vorlagen, „Kopieren nach“.
// Daten und Berechnung: js/schedule.js. Lädt nach settings.js (nutzt
// normalizeBlockTime/formatBlockTimeLive/openBlockTimePicker für die
// 24h-Zeitfelder) und nach projects.js (Projektauswahl).
//
// Änderungen gelten immer nur für den gewählten Tag. Ersetzende Aktionen
// (Vorlage anwenden, Kopieren, Löschen) fragen nach und lassen sich mit
// „Rückgängig“ zurücknehmen.
// =========================

let scheduleEditDay = (() => { const d = new Date().getDay(); return d; })();
let scheduleEditTab = 'week'; // 'week' | 'catalog'
let scheduleUndoSnap = null;  // { label, week, lessons }

const scheduleModal = wireModal('schedule-modal-overlay', {
  closeIds: ['schedule-modal-close'],
  onClose: () => { scheduleUndoSnap = null; },
});

function openScheduleEditor(weekday) {
  if (typeof weekday === 'number') scheduleEditDay = weekday;
  scheduleEditTab = 'week';
  renderScheduleEditor();
  scheduleModal.open();
}

// Alle Stellen, die den Stundenplan anzeigen, nach einer Änderung auffrischen.
// „Rückgängig“ gilt nur für den letzten ersetzenden Schritt: jede weitere
// Änderung verwirft den gemerkten Stand, sonst würde Rückgängig sie mit
// zurücksetzen.
let scheduleUndoFresh = false;
function scheduleChanged() {
  if (scheduleUndoFresh) scheduleUndoFresh = false;
  else if (scheduleUndoSnap) { scheduleUndoSnap = null; renderScheduleUndoBar(); }
  if (typeof currentView !== 'undefined') {
    if (currentView === 'today') { renderBlocks(); renderTasks(); }
    if (currentView === 'settings') renderScheduleSettings();
  }
}
function scheduleSaveAll() {
  saveScheduleWeek(); saveScheduleLessons();
  scheduleChanged();
}

// Vor ersetzenden Aktionen: Stand merken, „Rückgängig“ anbieten
function scheduleRememberUndo(label) {
  scheduleUndoSnap = { label, week: scheduleClone(scheduleWeek), lessons: scheduleClone(scheduleLessons) };
  scheduleUndoFresh = true; // die Speicherung genau dieses Schritts verwirft ihn nicht
}
function scheduleUndo() {
  if (!scheduleUndoSnap) return;
  scheduleWeek = scheduleUndoSnap.week;
  scheduleLessons = scheduleUndoSnap.lessons;
  scheduleUndoSnap = null;
  scheduleSaveAll();
  renderScheduleEditor();
}

// Aufgaben, die einem Block zugeordnet sind (task.blocks / Alt-Feld task.block)
function scheduleTasksForBlock(id) {
  return (typeof tasks !== 'undefined' ? tasks : [])
    .filter(t => (Array.isArray(t.blocks) ? t.blocks : (t.block != null ? [t.block] : [])).includes(id));
}

// ── Einstellungen: kurze Wochenübersicht + Knopf ────────────────────────
function renderScheduleSettings() {
  const box = document.getElementById('schedule-settings-summary');
  if (!box) return;
  box.innerHTML = SCHEDULE_WEEKDAYS.map(wd => `
    <button type="button" class="schedule-summary-row" data-wd="${wd}">
      <span class="schedule-summary-day">${SCHEDULE_DAY_SHORT[wd]}</span>
      <span class="schedule-summary-text">${scheduleEsc(scheduleDaySummary(wd))}</span>
    </button>`).join('');
  box.querySelectorAll('.schedule-summary-row').forEach(b =>
    b.addEventListener('click', () => openScheduleEditor(Number(b.dataset.wd))));
}

// ── Zeitfeld (gleiches 24h-Feld wie früher in den Einstellungen) ─────────
function scheduleTimeField(value, onCommit, ariaLabel) {
  const wrap = document.createElement('div');
  wrap.className = 'bs-time-wrap';
  wrap.innerHTML = `<input class="bs-time" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" aria-label="${scheduleEsc(ariaLabel)}"/>
    <button type="button" class="bs-time-trigger" aria-label="${scheduleEsc(ariaLabel)} auswählen">▾</button>`;
  const input = wrap.querySelector('input');
  const trigger = wrap.querySelector('button');
  input.value = value || '';
  input.addEventListener('input', () => formatBlockTimeLive(input));
  input.addEventListener('change', () => {
    const normalized = normalizeBlockTime(input.value);
    if (!normalized) { input.value = value || ''; return; }
    input.value = normalized;
    if (normalized !== value) onCommit(normalized);
  });
  trigger.addEventListener('click', e => { e.stopPropagation(); openBlockTimePicker(trigger, input, { v: value }, 'v'); });
  return wrap;
}

function scheduleEl(tag, cls, html) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html != null) el.innerHTML = html;
  return el;
}
function scheduleSection(title, actionLabel, onAction) {
  const sec = scheduleEl('section', 'schedule-section');
  const head = scheduleEl('div', 'schedule-section-head');
  head.appendChild(scheduleEl('h3', 'schedule-section-title', scheduleEsc(title)));
  if (actionLabel) {
    const btn = scheduleEl('button', 'schedule-add-btn', scheduleEsc(actionLabel));
    btn.type = 'button';
    btn.addEventListener('click', onAction);
    head.appendChild(btn);
  }
  sec.appendChild(head);
  return sec;
}
function scheduleDelBtn(label, onClick) {
  const b = scheduleEl('button', 'schedule-icon-btn schedule-del', '✕');
  b.type = 'button'; b.title = label; b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}
function scheduleToggle(checked, label, onChange) {
  const wrap = scheduleEl('label', 'schedule-toggle');
  wrap.innerHTML = `<span class="toggle"><input type="checkbox" ${checked ? 'checked' : ''}/><span class="toggle-slider"></span></span><span>${scheduleEsc(label)}</span>`;
  wrap.querySelector('input').addEventListener('change', e => onChange(e.target.checked));
  return wrap;
}

// ── Fenster aufbauen ────────────────────────────────────────────────────
function renderScheduleEditor() {
  document.querySelectorAll('#schedule-tabs .toggle-select-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === scheduleEditTab));
  document.getElementById('schedule-week-pane').classList.toggle('hidden', scheduleEditTab !== 'week');
  document.getElementById('schedule-catalog-pane').classList.toggle('hidden', scheduleEditTab !== 'catalog');
  renderScheduleUndoBar();
  if (scheduleEditTab === 'week') { renderScheduleWeekStrip(); renderScheduleDayEditor(); }
  else renderScheduleCatalog();
}
document.querySelectorAll('#schedule-tabs .toggle-select-btn').forEach(b =>
  b.addEventListener('click', () => { scheduleEditTab = b.dataset.tab; renderScheduleEditor(); }));

function renderScheduleUndoBar() {
  const bar = document.getElementById('schedule-undo-bar');
  bar.classList.toggle('hidden', !scheduleUndoSnap);
  if (!scheduleUndoSnap) return;
  bar.innerHTML = `<span>${scheduleEsc(scheduleUndoSnap.label)}</span>`;
  const btn = scheduleEl('button', 'schedule-undo-btn', '↶ Rückgängig');
  btn.type = 'button';
  btn.addEventListener('click', scheduleUndo);
  bar.appendChild(btn);
}

// Wochenübersicht: jeder Tag mit Kurzinfo, Klick wechselt den Tag
function renderScheduleWeekStrip() {
  const strip = document.getElementById('schedule-week-strip');
  strip.innerHTML = '';
  SCHEDULE_WEEKDAYS.forEach(wd => {
    const day = scheduleDay(wd);
    const issues = scheduleValidateDay(day, scheduleLessonsForWeekday(wd)).length;
    const btn = scheduleEl('button', 'schedule-day-tab' + (wd === scheduleEditDay ? ' active' : '') + (day.enabled ? '' : ' off'));
    btn.type = 'button';
    btn.setAttribute('aria-pressed', wd === scheduleEditDay ? 'true' : 'false');
    btn.innerHTML = `<span class="schedule-day-tab-name">${SCHEDULE_DAY_SHORT[wd]}${issues ? ' <span class="schedule-day-tab-warn" title="Hinweise vorhanden">⚠</span>' : ''}</span>
      <span class="schedule-day-tab-info">${scheduleEsc(scheduleDaySummary(wd))}</span>`;
    btn.addEventListener('click', () => { scheduleEditDay = wd; renderScheduleEditor(); });
    strip.appendChild(btn);
  });
}

// ── Tageseditor ─────────────────────────────────────────────────────────
function renderScheduleDayEditor() {
  const wd = scheduleEditDay;
  const day = scheduleDay(wd);
  const host = document.getElementById('schedule-day-editor');
  const scrollTop = host.closest('.modal-box')?.scrollTop;
  host.innerHTML = '';
  const commit = () => { saveScheduleWeek(); scheduleChanged(); renderScheduleEditor(); };

  // Kopf: Tag an/aus + Rahmen
  const frame = scheduleSection(SCHEDULE_DAY_NAMES[wd]);
  const frameRow = scheduleEl('div', 'schedule-row schedule-frame-row');
  frameRow.appendChild(scheduleToggle(day.enabled, 'Arbeits- oder Schultag', on => { day.enabled = on; commit(); }));
  if (day.enabled) {
    const times = scheduleEl('div', 'schedule-times');
    times.append(scheduleEl('span', 'schedule-field-label', 'Beginn'),
      scheduleTimeField(day.start, v => { day.start = v; commit(); }, 'Tagesbeginn'),
      scheduleEl('span', 'schedule-field-label', 'Ende'),
      scheduleTimeField(day.end, v => { day.end = v; commit(); }, 'Tagesende'));
    frameRow.appendChild(times);
  }
  frame.appendChild(frameRow);
  host.appendChild(frame);

  if (!day.enabled) {
    host.appendChild(scheduleEl('p', 'schedule-hint', 'An diesem Tag wird kein Stundenplan angezeigt (Freier Tag). Einschalten oder eine Vorlage anwenden, um ihn zu planen.'));
    host.appendChild(buildScheduleDayActions(wd));
    restoreScroll();
    return;
  }

  // Schulzeit
  const schoolSec = scheduleSection('Schule');
  const schoolRow = scheduleEl('div', 'schedule-row');
  schoolRow.appendChild(scheduleToggle(!!day.school, 'Schulzeit an diesem Tag', on => {
    day.school = on ? { start: day.start, end: scheduleFromMin(Math.min(scheduleToMin(day.end), scheduleToMin(day.start) + 300)) } : null;
    commit();
  }));
  if (day.school) {
    const times = scheduleEl('div', 'schedule-times');
    times.append(scheduleEl('span', 'schedule-field-label', 'von'),
      scheduleTimeField(day.school.start, v => { day.school.start = v; commit(); }, 'Schulbeginn'),
      scheduleEl('span', 'schedule-field-label', 'bis'),
      scheduleTimeField(day.school.end, v => { day.school.end = v; commit(); }, 'Schulende'));
    schoolRow.appendChild(times);
  }
  schoolSec.appendChild(schoolRow);
  host.appendChild(schoolSec);

  // Pausen
  const brSec = scheduleSection('Pausen', '+ Pause', () => {
    const last = day.breaks.map(b => scheduleToMin(b.end)).filter(v => v !== null).sort((a, b) => b - a)[0];
    const a = last != null ? Math.min(last + 60, scheduleToMin(day.end) - 15) : scheduleToMin(day.start) + 90;
    day.breaks.push({ id: scheduleNewId(), label: 'Pause', start: scheduleFromMin(a), end: scheduleFromMin(a + 15) });
    commit();
  });
  const sortedBreaks = day.breaks.slice().sort((a, b) => (scheduleToMin(a.start) ?? 0) - (scheduleToMin(b.start) ?? 0));
  if (!sortedBreaks.length) brSec.appendChild(scheduleEl('p', 'schedule-empty', 'Keine Pausen.'));
  sortedBreaks.forEach(br => {
    const row = scheduleEl('div', 'schedule-row schedule-item');
    row.dataset.ref = 'break:' + br.id;
    const name = scheduleEl('input', 'modal-input schedule-name');
    name.value = br.label || ''; name.placeholder = 'Pause'; name.setAttribute('aria-label', 'Name der Pause');
    name.addEventListener('input', () => { br.label = name.value; saveScheduleWeek(); scheduleChanged(); });
    row.append(name,
      scheduleTimeField(br.start, v => { br.start = v; commit(); }, 'Pausenbeginn'),
      scheduleEl('span', 'schedule-dash', '–'),
      scheduleTimeField(br.end, v => { br.end = v; commit(); }, 'Pausenende'),
      scheduleDelBtn('Pause löschen', () => { day.breaks = day.breaks.filter(x => x !== br); commit(); }));
    brSec.appendChild(row);
  });
  host.appendChild(brSec);

  // Unterricht (an Tagen mit Schulzeit; ohne Schulzeit nur übrig gebliebene
  // Stunden, damit sie sich löschen lassen)
  if (day.school) host.appendChild(buildScheduleLessonSection(wd, day));
  else if (scheduleLessonsForWeekday(wd).length) host.appendChild(buildScheduleOrphanLessons(wd));

  // Blöcke
  host.appendChild(buildScheduleBlockSection(wd, day, commit));

  // Hinweise + Vorschau
  const issues = scheduleValidateDay(day, scheduleLessonsForWeekday(wd));
  if (issues.length) {
    const box = scheduleEl('div', 'schedule-issues');
    box.setAttribute('role', 'status');
    box.innerHTML = `<strong>⚠ Bitte prüfen</strong><ul>${issues.map(i => `<li>${scheduleEsc(i.msg)}</li>`).join('')}</ul>
      <p>Überschneidende Teile von Blöcken werden in der Tagesansicht nicht gezeigt — gespeichert bleibt alles.</p>`;
    host.appendChild(box);
    const refs = new Set(issues.map(i => i.ref));
    host.querySelectorAll('.schedule-item[data-ref]').forEach(r => r.classList.toggle('schedule-invalid', refs.has(r.dataset.ref)));
  }
  host.appendChild(buildSchedulePreview(wd));
  host.appendChild(buildScheduleDayActions(wd));
  restoreScroll();

  function restoreScroll() {
    const box = host.closest('.modal-box');
    if (box && typeof scrollTop === 'number') box.scrollTop = scrollTop;
  }
}

// Auswahl für einen Block: allgemeine Aktivitäten + bestehende Projekte
function buildScheduleKindSelect(block) {
  const sel = scheduleEl('select', 'modal-select schedule-kind');
  sel.setAttribute('aria-label', 'Aktivität oder Projekt');
  const activeProjects = (typeof projects !== 'undefined' ? projects : []).filter(p => !p.archived);
  let html = '<optgroup label="Aktivität">' + Object.entries(SCHEDULE_BLOCK_KINDS)
    .filter(([k]) => k !== 'project')
    .map(([k, v]) => `<option value="kind:${k}">${v.icon} ${scheduleEsc(v.label)}</option>`).join('') + '</optgroup>';
  if (activeProjects.length) {
    html += '<optgroup label="Projekte">' + activeProjects
      .map(p => `<option value="project:${scheduleEsc(p.id)}">🌳 ${scheduleEsc(p.name)}</option>`).join('') + '</optgroup>';
  }
  // Zugewiesenes, inzwischen archiviertes/gelöschtes Projekt bleibt sichtbar
  if (block.kind === 'project' && block.projectId != null && !activeProjects.some(p => p.id === block.projectId)) {
    const name = scheduleNames.project(block.projectId);
    html += `<option value="project:${scheduleEsc(block.projectId)}">🌳 ${scheduleEsc(name || 'Projekt (nicht mehr vorhanden)')}</option>`;
  }
  sel.innerHTML = html;
  sel.value = block.kind === 'project' ? 'project:' + block.projectId : 'kind:' + block.kind;
  return sel;
}

function buildScheduleBlockSection(wd, day, commit) {
  const sec = scheduleSection(day.school ? 'Projekt- und Arbeitsblöcke (nach der Schule)' : 'Projekt- und Arbeitsblöcke', '+ Block', () => {
    const slot = scheduleSuggestBlockSlot(day);
    day.blocks.push({ id: scheduleNewId(), label: '', start: slot.start, end: slot.end, kind: 'other', projectId: null });
    commit();
  });
  const sorted = day.blocks.slice().sort((a, b) => (scheduleToMin(a.start) ?? 0) - (scheduleToMin(b.start) ?? 0));
  if (!sorted.length) sec.appendChild(scheduleEl('p', 'schedule-empty', 'Noch keine Blöcke — die Arbeitszeit erscheint als „nicht zugewiesen“.'));
  sec.appendChild(scheduleEl('p', 'schedule-hint', '▲ ▼ tauscht die Aktivität mit dem Nachbarblock, die Zeiten bleiben. Gilt nur für diesen Tag.'));

  // Tauschen: Inhalt (inkl. ID → Aufgaben wandern mit) wechselt, Zeiten bleiben
  const swap = (a, b) => {
    ['id', 'label', 'kind', 'projectId'].forEach(k => { const t = a[k]; a[k] = b[k]; b[k] = t; });
    commit();
  };
  sorted.forEach((bl, i) => {
    const row = scheduleEl('div', 'schedule-row schedule-item schedule-block-row' + ' seg-kind-' + bl.kind);
    row.dataset.ref = 'block:' + bl.id;
    const order = scheduleEl('div', 'schedule-order');
    const up = scheduleEl('button', 'schedule-icon-btn', '▲'); up.type = 'button';
    up.title = 'Mit dem Block davor tauschen'; up.setAttribute('aria-label', 'Mit dem Block davor tauschen');
    up.disabled = i === 0; up.addEventListener('click', () => swap(bl, sorted[i - 1]));
    const down = scheduleEl('button', 'schedule-icon-btn', '▼'); down.type = 'button';
    down.title = 'Mit dem Block danach tauschen'; down.setAttribute('aria-label', 'Mit dem Block danach tauschen');
    down.disabled = i === sorted.length - 1; down.addEventListener('click', () => swap(bl, sorted[i + 1]));
    order.append(up, down);

    const name = scheduleEl('input', 'modal-input schedule-name');
    name.value = bl.label || '';
    name.placeholder = scheduleBlockDisplayName(Object.assign({}, bl, { label: '' }));
    name.setAttribute('aria-label', 'Name des Blocks');
    name.addEventListener('input', () => { bl.label = name.value; saveScheduleWeek(); scheduleChanged(); renderSchedulePreviewOnly(wd); });

    const sel = buildScheduleKindSelect(bl);
    sel.addEventListener('change', () => {
      const [type, val] = [sel.value.slice(0, sel.value.indexOf(':')), sel.value.slice(sel.value.indexOf(':') + 1)];
      if (type === 'project') { bl.kind = 'project'; bl.projectId = val; }
      else { bl.kind = val; bl.projectId = null; }
      commit();
    });

    row.append(order, name, sel,
      scheduleTimeField(bl.start, v => { bl.start = v; commit(); }, 'Blockbeginn'),
      scheduleEl('span', 'schedule-dash', '–'),
      scheduleTimeField(bl.end, v => { bl.end = v; commit(); }, 'Blockende'),
      scheduleDelBtn('Block löschen', async () => {
        const used = scheduleTasksForBlock(bl.id).length;
        const elsewhere = scheduleBlockWeekdays(bl.id).filter(d => d !== SCHEDULE_DAY_SHORT[wd]);
        const ok = await hubConfirm({
          title: 'Block löschen?',
          message: `„${scheduleBlockDisplayName(bl)}“ wird nur am ${SCHEDULE_DAY_NAMES[wd]} gelöscht.`
            + (used ? ` ${used} ${used === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} diesem Block zugeordnet` + (elsewhere.length ? ` und ${used === 1 ? 'bleibt' : 'bleiben'} an ${elsewhere.join(', ')} sichtbar.` : '.') : ''),
          confirmText: 'Löschen', danger: true,
        });
        if (!ok) return;
        scheduleRememberUndo(`Block „${scheduleBlockDisplayName(bl)}“ gelöscht`);
        day.blocks = day.blocks.filter(x => x !== bl);
        commit();
      }));
    sec.appendChild(row);
  });
  return sec;
}

// Unterrichtsstunden eines Wochentags
function buildScheduleLessonSection(wd, day) {
  const commitLessons = () => { saveScheduleLessons(); scheduleChanged(); renderScheduleEditor(); };
  const sec = scheduleSection('Unterricht', '+ Stunde', () => {
    const own = scheduleLessonsForWeekday(wd);
    const gap = scheduleComputeSegments(day, own, {}).segments.find(s => s.type === 'school');
    const start = gap ? gap.start : day.school.start;
    const end = gap ? scheduleFromMin(Math.min(scheduleToMin(gap.end), scheduleToMin(gap.start) + 90)) : scheduleFromMin(scheduleToMin(start) + 45);
    scheduleLessons.push({ id: scheduleNewId(), weekday: wd, start, end, subjectId: null, teacherId: null, room: '', notes: '' });
    commitLessons();
  });
  if (!scheduleSubjects.length) {
    const hint = scheduleEl('p', 'schedule-hint', 'Tipp: Unter „Fächer &amp; Lehrkräfte“ angelegte Fächer und Lehrkräfte lassen sich hier auswählen. ');
    const link = scheduleEl('button', 'schedule-link-btn', 'Jetzt anlegen');
    link.type = 'button';
    link.addEventListener('click', () => { scheduleEditTab = 'catalog'; renderScheduleEditor(); });
    hint.appendChild(link);
    sec.appendChild(hint);
  }
  const own = scheduleLessonsForWeekday(wd);
  if (!own.length) sec.appendChild(scheduleEl('p', 'schedule-empty', 'Noch keine Stunden — die Schulzeit erscheint als „Unterricht“.'));
  own.forEach(l => {
    const row = scheduleEl('div', 'schedule-row schedule-item schedule-lesson-row');
    row.dataset.ref = 'lesson:' + l.id;
    const subj = scheduleEl('select', 'modal-select');
    subj.setAttribute('aria-label', 'Fach');
    subj.innerHTML = '<option value="">— Fach —</option>' + scheduleSubjects.map(s => `<option value="${scheduleEsc(s.id)}">${scheduleEsc(s.name)}</option>`).join('');
    subj.value = l.subjectId || '';
    subj.addEventListener('change', () => { l.subjectId = subj.value || null; commitLessons(); });

    // Lehrkräfte, die das Fach unterrichten, zuerst
    const teach = scheduleEl('select', 'modal-select');
    teach.setAttribute('aria-label', 'Lehrkraft');
    const fits = scheduleTeachers.filter(t => l.subjectId && t.subjectIds.includes(l.subjectId));
    const rest = scheduleTeachers.filter(t => !fits.includes(t));
    const opt = t => `<option value="${scheduleEsc(t.id)}">${scheduleEsc(t.name)}</option>`;
    teach.innerHTML = '<option value="">— Lehrkraft —</option>'
      + (fits.length ? `<optgroup label="Unterrichtet dieses Fach">${fits.map(opt).join('')}</optgroup>` : '')
      + (rest.length ? `<optgroup label="${fits.length ? 'Weitere' : 'Lehrkräfte'}">${rest.map(opt).join('')}</optgroup>` : '');
    teach.value = l.teacherId || '';
    teach.addEventListener('change', () => { l.teacherId = teach.value || null; commitLessons(); });

    const room = scheduleEl('input', 'modal-input schedule-room');
    room.value = l.room || ''; room.placeholder = 'Raum'; room.setAttribute('aria-label', 'Raum');
    room.addEventListener('input', () => { l.room = room.value; saveScheduleLessons(); scheduleChanged(); });
    const notes = scheduleEl('input', 'modal-input schedule-notes');
    notes.value = l.notes || ''; notes.placeholder = 'Thema / Notiz'; notes.setAttribute('aria-label', 'Thema oder Notiz');
    notes.addEventListener('input', () => { l.notes = notes.value; saveScheduleLessons(); scheduleChanged(); });

    row.append(subj, teach,
      scheduleTimeField(l.start, v => { l.start = v; commitLessons(); }, 'Stundenbeginn'),
      scheduleEl('span', 'schedule-dash', '–'),
      scheduleTimeField(l.end, v => { l.end = v; commitLessons(); }, 'Stundenende'),
      room, notes,
      scheduleDelBtn('Stunde löschen', () => {
        scheduleRememberUndo('Unterrichtsstunde gelöscht');
        scheduleLessons = scheduleLessons.filter(x => x !== l);
        commitLessons();
      }));
    sec.appendChild(row);
  });
  return sec;
}

// Stunden eines Tages ohne Schulzeit: werden in Heute nicht gezeigt —
// hier sichtbar machen, damit man sie löschen oder die Schulzeit wieder
// einschalten kann.
function buildScheduleOrphanLessons(wd) {
  const sec = scheduleSection('Unterricht (ohne Schulzeit)');
  sec.appendChild(scheduleEl('p', 'schedule-hint', 'An diesem Tag ist keine Schulzeit eingestellt, deshalb erscheinen diese Stunden nicht in „Heute“. Schulzeit oben einschalten oder die Stunden löschen.'));
  scheduleLessonsForWeekday(wd).forEach(l => {
    const row = scheduleEl('div', 'schedule-row schedule-item schedule-lesson-row');
    row.dataset.ref = 'lesson:' + l.id;
    const name = scheduleNames.subject(l.subjectId) || 'Unterricht';
    const extra = [scheduleNames.teacher(l.teacherId), l.room && 'Raum ' + l.room].filter(Boolean).join(' · ');
    row.append(scheduleEl('span', 'schedule-orphan-label', `${scheduleEsc(l.start)}–${scheduleEsc(l.end)} · ${scheduleEsc(name)}${extra ? ' · ' + scheduleEsc(extra) : ''}`),
      scheduleDelBtn('Stunde löschen', () => {
        scheduleRememberUndo('Unterrichtsstunde gelöscht');
        scheduleLessons = scheduleLessons.filter(x => x !== l);
        saveScheduleLessons(); scheduleChanged(); renderScheduleEditor();
      }));
    sec.appendChild(row);
  });
  const all = scheduleEl('button', 'schedule-link-btn', 'Alle löschen');
  all.type = 'button';
  all.addEventListener('click', () => {
    scheduleRememberUndo('Unterrichtsstunden ohne Schulzeit gelöscht');
    scheduleLessons = scheduleLessons.filter(x => x.weekday !== wd);
    saveScheduleLessons(); scheduleChanged(); renderScheduleEditor();
  });
  sec.appendChild(all);
  return sec;
}

// Vorschau: so erscheint der Tag in „Heute“
function buildSchedulePreview(wd) {
  const sec = scheduleSection('Vorschau');
  sec.id = 'schedule-preview';
  fillSchedulePreview(sec, wd);
  return sec;
}
function fillSchedulePreview(sec, wd) {
  sec.querySelectorAll('.schedule-preview-list, .schedule-empty').forEach(n => n.remove());
  const plan = scheduleComputeSegments(scheduleDay(wd), scheduleLessonsForWeekday(wd), scheduleNames);
  if (plan.off) { sec.appendChild(scheduleEl('p', 'schedule-empty', 'Freier Tag')); return; }
  const list = scheduleEl('ol', 'schedule-preview-list');
  plan.segments.forEach(s => {
    const extra = s.type === 'lesson' ? [s.teacher, s.room && 'Raum ' + s.room].filter(Boolean).join(' · ')
      : s.type === 'block' && s.project && s.project !== s.label ? '🌳 ' + s.project : '';
    const li = scheduleEl('li', `schedule-preview-item seg-${s.type}` + (s.kind ? ' seg-kind-' + s.kind : ''));
    li.innerHTML = `<span class="schedule-preview-time">${s.start}–${s.end}</span><span class="schedule-preview-label">${scheduleEsc(s.label)}</span>${extra ? `<span class="schedule-preview-extra">${scheduleEsc(extra)}</span>` : ''}`;
    list.appendChild(li);
  });
  const end = scheduleEl('li', 'schedule-preview-item seg-end', `<span class="schedule-preview-time">ab ${plan.end}</span><span class="schedule-preview-label">Feierabend</span>`);
  list.appendChild(end);
  sec.appendChild(list);
}
function renderSchedulePreviewOnly(wd) {
  const sec = document.getElementById('schedule-preview');
  if (sec) fillSchedulePreview(sec, wd);
}

// Beim Anwenden einer Vorlage die IDs der bisherigen Blöcke des Tages
// übernehmen — so bleiben Aufgaben-Zuordnungen und die gleichen IDs an den
// übrigen Wochentagen erhalten. Zuerst nach gleichem Namen, danach der Reihe
// nach (1. Block → 1. Block); übrige Vorlagenblöcke bekommen neue IDs.
function scheduleKeepBlockIds(oldBlocks, newBlocks) {
  const byStart = list => list.slice().sort((a, b) => (scheduleToMin(a.start) ?? 0) - (scheduleToMin(b.start) ?? 0));
  const free = byStart(oldBlocks);
  const target = byStart(newBlocks);
  const take = b => { free.splice(free.indexOf(b), 1); return b.id; };
  const assigned = new Map();
  target.forEach(nb => {
    const name = scheduleBlockDisplayName(nb).toLowerCase();
    const same = free.find(ob => scheduleBlockDisplayName(ob).toLowerCase() === name);
    if (same) assigned.set(nb, take(same));
  });
  target.forEach(nb => {
    if (assigned.has(nb)) return;
    assigned.set(nb, free.length ? take(free[0]) : scheduleNewId());
  });
  newBlocks.forEach(nb => { nb.id = assigned.get(nb); });
}

// ── Vorlagen anwenden / speichern, Tag kopieren ─────────────────────────
function buildScheduleDayActions(wd) {
  const sec = scheduleSection('Vorlagen & Kopieren');
  const day = scheduleDay(wd);

  // Vorlage anwenden
  const tplRow = scheduleEl('div', 'schedule-row schedule-actions-row');
  const tplSel = scheduleEl('select', 'modal-select');
  tplSel.setAttribute('aria-label', 'Vorlage');
  tplSel.innerHTML = '<option value="">Vorlage wählen …</option>' + scheduleTemplates.map(t => `<option value="${scheduleEsc(t.id)}">${scheduleEsc(t.name)}</option>`).join('');
  const applyBtn = scheduleEl('button', 'btn-ghost', 'Anwenden'); applyBtn.type = 'button';
  applyBtn.addEventListener('click', async () => {
    const tpl = scheduleTemplates.find(t => t.id === tplSel.value);
    if (!tpl) return;
    const copy = scheduleNormalizeDay(scheduleClone(tpl.day));
    copy.enabled = true;
    scheduleKeepBlockIds(day.blocks, copy.blocks);
    copy.breaks.forEach(b => { b.id = scheduleNewId(); });
    // Aufgaben, deren Block es nach dem Anwenden an diesem Tag nicht mehr gibt
    const keptIds = new Set(copy.blocks.map(b => b.id));
    const lost = new Set(day.blocks.filter(b => !keptIds.has(b.id)).flatMap(b => scheduleTasksForBlock(b.id).map(t => t.id))).size;
    const ok = await hubConfirm({
      title: `Vorlage auf ${SCHEDULE_DAY_NAMES[wd]} anwenden?`,
      message: `„${tpl.name}“ ersetzt Zeiten, Schulzeit, Pausen und Blöcke von ${SCHEDULE_DAY_NAMES[wd]}. Unterrichtsstunden und alle anderen Tage bleiben unverändert. Blöcke, die es schon gab, behalten ihre Aufgaben.`
        + (lost ? ` ${lost} ${lost === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} Blöcken zugeordnet, die wegfallen, und ${lost === 1 ? 'erscheint' : 'erscheinen'} an diesem Tag danach nicht mehr in einem Block.` : '')
        + ' Mit „Rückgängig“ lässt sich das zurücknehmen.',
      confirmText: 'Anwenden',
    });
    if (!ok) return;
    scheduleRememberUndo(`Vorlage „${tpl.name}“ auf ${SCHEDULE_DAY_NAMES[wd]} angewendet`);
    scheduleWeek.days[wd] = copy;
    scheduleSaveAll();
    renderScheduleEditor();
  });
  tplRow.append(tplSel, applyBtn);
  sec.appendChild(tplRow);

  // Als Vorlage speichern
  const saveRow = scheduleEl('div', 'schedule-row schedule-actions-row');
  const nameInput = scheduleEl('input', 'modal-input');
  nameInput.placeholder = 'Name der neuen Vorlage'; nameInput.setAttribute('aria-label', 'Name der neuen Vorlage');
  const saveBtn = scheduleEl('button', 'btn-ghost', 'Als Vorlage speichern'); saveBtn.type = 'button';
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    scheduleTemplates.push({ id: 'tpl-' + scheduleNewId(), name, day: Object.assign(scheduleClone(day), { enabled: true }) });
    saveScheduleTemplates();
    renderScheduleEditor();
  });
  saveRow.append(nameInput, saveBtn);
  sec.appendChild(saveRow);

  // Kopieren nach …
  const copyWrap = scheduleEl('div', 'schedule-copy');
  copyWrap.appendChild(scheduleEl('span', 'schedule-field-label', `${SCHEDULE_DAY_NAMES[wd]} kopieren nach:`));
  const checks = scheduleEl('div', 'schedule-copy-days');
  SCHEDULE_WEEKDAYS.filter(x => x !== wd).forEach(x => {
    const lab = scheduleEl('label', 'schedule-copy-day', `<input type="checkbox" value="${x}"/> ${SCHEDULE_DAY_SHORT[x]}`);
    checks.appendChild(lab);
  });
  const withLessons = scheduleEl('label', 'schedule-copy-day', '<input type="checkbox" checked/> Unterricht mitkopieren');
  const copyBtn = scheduleEl('button', 'btn-ghost', 'Kopieren'); copyBtn.type = 'button';
  copyBtn.addEventListener('click', async () => {
    const targets = [...checks.querySelectorAll('input:checked')].map(i => Number(i.value));
    if (!targets.length) return;
    const lessonsToo = withLessons.querySelector('input').checked;
    const names = targets.map(t => SCHEDULE_DAY_NAMES[t]).join(', ');
    const ok = await hubConfirm({
      title: 'Tag kopieren?',
      message: `Zeiten, Pausen und Blöcke von ${SCHEDULE_DAY_NAMES[wd]} ersetzen die von ${names}.`
        + (lessonsToo ? ' Der Unterricht dieser Tage wird ebenfalls ersetzt.' : ' Der Unterricht dieser Tage bleibt.')
        + ' Danach bleibt jeder Tag einzeln bearbeitbar. Mit „Rückgängig“ lässt sich das zurücknehmen.',
      confirmText: 'Kopieren',
    });
    if (!ok) return;
    scheduleRememberUndo(`${SCHEDULE_DAY_NAMES[wd]} nach ${names} kopiert`);
    targets.forEach(t => {
      // gleiche Block-IDs: Aufgaben eines Blocks erscheinen auch am Zieltag
      scheduleWeek.days[t] = scheduleClone(day);
      if (lessonsToo) {
        scheduleLessons = scheduleLessons.filter(l => l.weekday !== t)
          .concat(scheduleLessonsForWeekday(wd).map(l => Object.assign(scheduleClone(l), { id: scheduleNewId(), weekday: t })));
      }
    });
    scheduleSaveAll();
    renderScheduleEditor();
  });
  copyWrap.append(checks, withLessons, copyBtn);
  sec.appendChild(copyWrap);
  return sec;
}

// ── Fächer, Lehrkräfte, Vorlagen verwalten ──────────────────────────────
function renderScheduleCatalog() {
  const host = document.getElementById('schedule-catalog-pane');
  host.innerHTML = '';

  const subjSec = scheduleSection('Fächer', '+ Fach', () => {
    scheduleSubjects.push({ id: 'sub-' + scheduleNewId(), name: '' });
    saveScheduleSubjects(); renderScheduleCatalog();
    host.querySelector('.schedule-subject-row:last-of-type input')?.focus();
  });
  if (!scheduleSubjects.length) subjSec.appendChild(scheduleEl('p', 'schedule-empty', 'Noch keine Fächer.'));
  scheduleSubjects.forEach(s => {
    const row = scheduleEl('div', 'schedule-row schedule-item schedule-subject-row');
    const name = scheduleEl('input', 'modal-input schedule-name');
    name.value = s.name; name.placeholder = 'z.B. Anwendungsentwicklung'; name.setAttribute('aria-label', 'Name des Fachs');
    name.addEventListener('input', () => { s.name = name.value; saveScheduleSubjects(); scheduleChanged(); });
    const used = scheduleLessons.filter(l => l.subjectId === s.id).length;
    row.append(name, scheduleEl('span', 'schedule-meta', used ? `${used} ${used === 1 ? 'Stunde' : 'Stunden'}` : ''),
      scheduleDelBtn('Fach löschen', async () => {
        if (used) {
          const ok = await hubConfirm({ title: 'Fach löschen?', message: `„${s.name || 'Fach'}“ ist ${used} ${used === 1 ? 'Stunde' : 'Stunden'} zugeordnet. Die Stunden bleiben, zeigen dann aber kein Fach mehr.`, confirmText: 'Löschen', danger: true });
          if (!ok) return;
          scheduleLessons.forEach(l => { if (l.subjectId === s.id) l.subjectId = null; });
          saveScheduleLessons();
        }
        scheduleSubjects = scheduleSubjects.filter(x => x !== s);
        scheduleTeachers.forEach(t => { t.subjectIds = t.subjectIds.filter(id => id !== s.id); });
        saveScheduleSubjects(); saveScheduleTeachers(); scheduleChanged(); renderScheduleCatalog();
      }));
    subjSec.appendChild(row);
  });
  host.appendChild(subjSec);

  const teachSec = scheduleSection('Lehrkräfte', '+ Lehrkraft', () => {
    scheduleTeachers.push({ id: 'tea-' + scheduleNewId(), name: '', subjectIds: [] });
    saveScheduleTeachers(); renderScheduleCatalog();
    host.querySelector('.schedule-teacher-row:last-of-type input')?.focus();
  });
  if (!scheduleTeachers.length) teachSec.appendChild(scheduleEl('p', 'schedule-empty', 'Noch keine Lehrkräfte.'));
  scheduleTeachers.forEach(t => {
    const row = scheduleEl('div', 'schedule-row schedule-item schedule-teacher-row');
    const name = scheduleEl('input', 'modal-input schedule-name');
    name.value = t.name; name.placeholder = 'z.B. Frau Muster'; name.setAttribute('aria-label', 'Name der Lehrkraft');
    name.addEventListener('input', () => { t.name = name.value; saveScheduleTeachers(); scheduleChanged(); });
    const subs = scheduleEl('div', 'schedule-teacher-subjects');
    if (!scheduleSubjects.length) subs.appendChild(scheduleEl('span', 'schedule-meta', 'Fächer oben anlegen, dann hier zuordnen'));
    scheduleSubjects.forEach(s => {
      const lab = scheduleEl('label', 'schedule-chip' + (t.subjectIds.includes(s.id) ? ' active' : ''),
        `<input type="checkbox" ${t.subjectIds.includes(s.id) ? 'checked' : ''}/> ${scheduleEsc(s.name || 'Fach')}`);
      lab.querySelector('input').addEventListener('change', e => {
        t.subjectIds = e.target.checked ? [...t.subjectIds, s.id] : t.subjectIds.filter(id => id !== s.id);
        lab.classList.toggle('active', e.target.checked);
        saveScheduleTeachers();
      });
      subs.appendChild(lab);
    });
    const used = scheduleLessons.filter(l => l.teacherId === t.id).length;
    row.append(name, subs, scheduleDelBtn('Lehrkraft löschen', async () => {
      if (used) {
        const ok = await hubConfirm({ title: 'Lehrkraft löschen?', message: `„${t.name || 'Lehrkraft'}“ ist ${used} ${used === 1 ? 'Stunde' : 'Stunden'} zugeordnet. Die Stunden bleiben, zeigen dann aber keine Lehrkraft mehr.`, confirmText: 'Löschen', danger: true });
        if (!ok) return;
        scheduleLessons.forEach(l => { if (l.teacherId === t.id) l.teacherId = null; });
        saveScheduleLessons();
      }
      scheduleTeachers = scheduleTeachers.filter(x => x !== t);
      saveScheduleTeachers(); scheduleChanged(); renderScheduleCatalog();
    }));
    teachSec.appendChild(row);
  });
  host.appendChild(teachSec);

  // Vorlagen umbenennen/löschen — angewendete Tage sind Kopien und bleiben unberührt
  const tplSec = scheduleSection('Tagesvorlagen');
  tplSec.appendChild(scheduleEl('p', 'schedule-hint', 'Vorlagen sind nur Ausgangspunkte: Ändern oder Löschen einer Vorlage verändert keinen Tag, auf den sie schon angewendet wurde. Neue Vorlagen speicherst du im Tageseditor.'));
  if (!scheduleTemplates.length) tplSec.appendChild(scheduleEl('p', 'schedule-empty', 'Keine Vorlagen.'));
  scheduleTemplates.forEach(tpl => {
    const row = scheduleEl('div', 'schedule-row schedule-item');
    const name = scheduleEl('input', 'modal-input schedule-name');
    name.value = tpl.name; name.setAttribute('aria-label', 'Name der Vorlage');
    name.addEventListener('input', () => { tpl.name = name.value; saveScheduleTemplates(); });
    const d = tpl.day;
    const info = [`${d.start}–${d.end}`, d.school ? `Schule bis ${d.school.end}` : '', `${(d.blocks || []).length} Blöcke`].filter(Boolean).join(' · ');
    row.append(name, scheduleEl('span', 'schedule-meta', scheduleEsc(info)), scheduleDelBtn('Vorlage löschen', async () => {
      const ok = await hubConfirm({ title: 'Vorlage löschen?', message: `„${tpl.name}“ wird gelöscht. Tage, auf die sie angewendet wurde, bleiben unverändert.`, confirmText: 'Löschen', danger: true });
      if (!ok) return;
      scheduleTemplates = scheduleTemplates.filter(x => x !== tpl);
      saveScheduleTemplates(); renderScheduleCatalog();
    }));
    tplSec.appendChild(row);
  });
  const restore = scheduleEl('button', 'schedule-link-btn', 'Mitgelieferte Vorlagen wiederherstellen');
  restore.type = 'button';
  restore.addEventListener('click', () => {
    const have = new Set(scheduleTemplates.map(t => t.id));
    scheduleDefaultTemplates().forEach(t => { if (!have.has(t.id)) scheduleTemplates.push(t); });
    saveScheduleTemplates(); renderScheduleCatalog();
  });
  tplSec.appendChild(restore);
  host.appendChild(tplSec);
}

// Startet Nook direkt in den Einstellungen, liefen sie vor dieser Datei —
// die Stundenplan-Übersicht dort jetzt nachtragen.
if (typeof currentView !== 'undefined' && currentView === 'settings') renderScheduleSettings();

// ── Einstiege ───────────────────────────────────────────────────────────
document.getElementById('schedule-open-btn')?.addEventListener('click', () => openScheduleEditor());
document.getElementById('today-schedule-edit-btn')?.addEventListener('click', () => openScheduleEditor(state.currentDate.getDay()));
