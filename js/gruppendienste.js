// =========================
// GRUPPENDIENSTE — eigenständiges Planungssystem
// Today sidebar widget + "Pflichten verwalten"-Übersicht + Pflicht-Editor
//
// Ersetzt die frühere Freitext-Wochenplan-Version (drei fest verdrahtete
// Dienste, jede Woche von Hand eingetragen). Jetzt: beliebig viele
// "Pflichten" mit Personen/Gruppen, automatischer fairer Rotation ODER
// fester zyklischer Reihenfolge, gegenseitiger Verknüpfung (verhindert
// Doppel-Belegung derselben Person in derselben Woche), und einer
// GESPEICHERTEN Planung (gdSchedule) — nichts wird bei jedem Laden neu
// gewürfelt. Bearbeitungen berechnen nur die Zukunft neu (ab der
// aktuellen Woche); vergangene Wochen bleiben unangetastet.
//
// Der alte Datenbestand (DB-Key 'gruppendienstePlan') wird bewusst nicht
// mehr gelesen/geschrieben, aber auch nicht gelöscht — bestehende Daten
// gehen nicht verloren, sind nur nicht mehr Teil dieser Verwaltung.
//
// Lädt nach main.js (DB, getWeekId/getWeekStart/getISOWeek, parseLocalDate,
// dateKey, fmt) und hub-utils.js (wireModal, hubConfirm).
// =========================

// =========================
// DATENMODELL
// =========================
let gdPeople   = DB.get('gdPeople', []);    // [{id, name}]
let gdGroups   = DB.get('gdGroups', []);    // [{id, name, memberIds:[personId...]}]
let gdDuties   = DB.get('gdDuties', []);    // [{id,name,icon,startDate,endDate,participants,seatsRegular,seatsErsatz,rotationMode,fixedOrder,autoRotationOrder,linkedDutyIds}]
let gdSchedule = DB.get('gdSchedule', {});  // { [dutyId]: { [weekId]: {regular:[{type,id}...], ersatz:[{type,id}...]} } }

function gdSavePeople()   { DB.set('gdPeople', gdPeople); }
function gdSaveGroups()   { DB.set('gdGroups', gdGroups); }
function gdSaveDuties()   { DB.set('gdDuties', gdDuties); }
function gdSaveSchedule() { DB.set('gdSchedule', gdSchedule); }

function gdEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function gdId() { return crypto.randomUUID(); }
function gdFmtDate(str) { return str ? fmt(parseLocalDate(str), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; }
function gdShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =========================
// LOOKUP-HELFER
// participants/fixedOrder-Einträge sind "Referenzen": {type:'person'|'group', id}
// =========================
function gdFindPerson(id) { return gdPeople.find(p => p.id === id); }
function gdFindGroup(id)  { return gdGroups.find(g => g.id === id); }
function gdFindDuty(id)   { return gdDuties.find(d => d.id === id); }
function gdPersonName(id) { const p = gdFindPerson(id); return p ? p.name : '?'; }
function gdGroupMemberIds(id) { const g = gdFindGroup(id); return g ? g.memberIds.slice() : []; }

function gdRefName(ref) {
  if (!ref) return '?';
  if (ref.type === 'person') return gdPersonName(ref.id);
  const g = gdFindGroup(ref.id);
  return g ? g.name : '?';
}

// Teilnehmer (Personen + Gruppen) zu einer flachen, deduplizierten
// Personen-ID-Liste expandieren — Grundlage für die Auto-Rotation.
function gdExpandParticipantsToPeople(participants) {
  const set = new Set();
  (participants || []).forEach(ref => {
    if (ref.type === 'person') set.add(ref.id);
    else if (ref.type === 'group') gdGroupMemberIds(ref.id).forEach(pid => set.add(pid));
  });
  return Array.from(set);
}

// =========================
// WOCHEN-HELFER
// =========================
function gdCutoverWeekId() { return getWeekId(new Date()); }

function gdWeekIdsInRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return [];
  const start = getWeekStart(parseLocalDate(startDateStr));
  const end   = parseLocalDate(endDateStr);
  const ids = [];
  let cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 2000) {
    ids.push(getWeekId(cur));
    cur.setDate(cur.getDate() + 7);
    guard++;
  }
  return ids;
}

// =========================
// ROTATIONSALGORITHMUS
// =========================

// Verknüpfungsgruppe (Connected Component) einer Pflicht über linkedDutyIds
// (beidseitig gepflegt, siehe Speichern-Handler unten).
function gdConnectedComponent(dutyId) {
  const visited = new Set();
  const queue = [dutyId];
  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const d = gdFindDuty(id);
    if (!d) continue;
    (d.linkedDutyIds || []).forEach(lid => { if (!visited.has(lid)) queue.push(lid); });
  }
  return Array.from(visited).map(gdFindDuty).filter(Boolean);
}

// EINE gemeinsame Warteschlange für alle automatischen Pflichten einer
// Verknüpfungsgruppe ableiten (statt pro Pflicht getrennt) — sonst "sieht"
// die Wasser-Warteschlange nicht, dass jemand letzte Woche schon bei Müll
// dran war, und dieselbe Person rotiert ungebremst zwischen den verknüpften
// Pflichten hin und her, statt wirklich Pause zu bekommen. Wer in IRGENDEINER
// Pflicht der Gruppe zuletzt dran war (regulär oder Ersatz, auch bei fester
// Reihenfolge), steht entsprechend weiter hinten. Personen ohne Historie
// kommen in autoRotationOrder-Reihenfolge (einmalig gemischt beim Speichern)
// dazu. Kein separat gepflegter Zeiger nötig — robust gegenüber Bearbeitungen.
function gdDeriveComponentQueue(component) {
  const poolIds = new Set();
  component.forEach(d => { if (d.rotationMode === 'auto') gdExpandParticipantsToPeople(d.participants).forEach(pid => poolIds.add(pid)); });

  const cutover = gdCutoverWeekId();
  const events = []; // { week, id } — jede Zuteilung einer Pool-Person in irgendeiner Pflicht der Gruppe
  component.forEach(d => {
    const history = gdSchedule[d.id] || {};
    Object.keys(history).filter(w => w < cutover).sort().forEach(w => {
      const entry = history[w];
      [...(entry.regular || []), ...(entry.ersatz || [])].forEach(ref => {
        if (ref.type === 'person' && poolIds.has(ref.id)) events.push({ week: w, id: ref.id });
      });
    });
  });
  events.sort((a, b) => a.week < b.week ? -1 : a.week > b.week ? 1 : 0);

  const lastSeenIdx = new Map(); // personId -> Index des letzten Vorkommens (über alle Pflichten der Gruppe)
  events.forEach((e, idx) => lastSeenIdx.set(e.id, idx));

  const seen = Array.from(lastSeenIdx.entries()).sort((a, b) => a[1] - b[1]).map(e => e[0]);
  const base = [];
  component.forEach(d => (d.autoRotationOrder || []).forEach(pid => { if (poolIds.has(pid) && !base.includes(pid)) base.push(pid); }));
  const unseen = base.filter(pid => !lastSeenIdx.has(pid));
  const known = new Set([...seen, ...unseen]);
  const extra = Array.from(poolIds).filter(pid => !known.has(pid)); // Sicherheitsnetz, falls autoRotationOrder veraltet ist
  return [...seen, ...unseen, ...extra];
}

// Berechnet die Pflichten einer Verknüpfungsgruppe gemeinsam neu — nur ab
// der aktuellen Woche (Cutover), vergangene Wochen in gdSchedule bleiben
// unverändert stehen.
function gdRecomputeComponent(dutyId) {
  const component = gdConnectedComponent(dutyId);
  if (!component.length) return;
  const cutover = gdCutoverWeekId();

  const dutyWeekIndex = {}; // dutyId -> Map(weekId -> Index seit Pflicht-Start, für feste Reihenfolge)
  component.forEach(d => {
    const map = new Map();
    gdWeekIdsInRange(d.startDate, d.endDate).forEach((w, i) => map.set(w, i));
    dutyWeekIndex[d.id] = map;
  });

  const weekSet = new Set();
  component.forEach(d => dutyWeekIndex[d.id].forEach((_, w) => { if (w >= cutover) weekSet.add(w); }));
  const weeks = Array.from(weekSet).sort();

  const dutyPools = {}; // dutyId -> Set(personId), nur für automatische Pflichten gebraucht
  component.forEach(d => { if (d.rotationMode === 'auto') dutyPools[d.id] = new Set(gdExpandParticipantsToPeople(d.participants)); });

  // EINE geteilte Warteschlange für die ganze Verknüpfungsgruppe (statt pro
  // Pflicht) — siehe gdDeriveComponentQueue. Jede Zuteilung, ob automatisch
  // oder fest, schiebt die betroffene Person hier ans Ende, damit sie in
  // JEDER Pflicht der Gruppe erstmal seltener dran ist, nicht nur in der,
  // die sie gerade hatte.
  const sharedQueue = gdDeriveComponentQueue(component);
  const sharedPoolIds = new Set(sharedQueue);
  // Verschiebt die angegebenen Personen ans Ende der geteilten Warteschlange
  // (ihre relative Reihenfolge untereinander bleibt erhalten); Personen
  // außerhalb der Auto-Teilnehmerkreise der Gruppe werden ignoriert.
  function gdMoveToBack(queue, pids) {
    const move = new Set(pids.filter(pid => sharedPoolIds.has(pid)));
    if (!move.size) return;
    const moved = queue.filter(pid => move.has(pid));
    const remaining = queue.filter(pid => !move.has(pid));
    queue.length = 0;
    queue.push(...remaining, ...moved);
  }

  weeks.forEach(weekId => {
    const usedThisWeek = new Set(); // Personen-IDs, diese Woche schon in der Verknüpfungsgruppe verplant
    component.forEach(d => {
      if (!dutyWeekIndex[d.id].has(weekId)) return;
      if (!gdSchedule[d.id]) gdSchedule[d.id] = {};

      if (d.rotationMode === 'fixed') {
        const order = d.fixedOrder || [];
        if (!order.length) { gdSchedule[d.id][weekId] = { regular: [], ersatz: [] }; return; }
        const idx = dutyWeekIndex[d.id].get(weekId) % order.length;
        const ref = order[idx];
        const pids = gdExpandParticipantsToPeople([ref]);
        pids.forEach(pid => usedThisWeek.add(pid));
        gdMoveToBack(sharedQueue, pids);
        gdSchedule[d.id][weekId] = { regular: [ref], ersatz: [] };
        return;
      }

      // Automatischer Modus: Auswahl aus der geteilten Warteschlange, gefiltert
      // auf den Teilnehmerkreis dieser Pflicht, mit Kollisionsvermeidung über
      // die ganze Verknüpfungsgruppe hinweg. Jede Person wird für diese
      // Pflicht/Woche GENAU EINMAL betrachtet (erst alle nicht-kollidierenden,
      // dann bei Bedarf die zurückgestellten Kollisionen) — das schließt
      // Selbst-Duplikate innerhalb derselben Pflicht strukturell aus.
      const pool = dutyPools[d.id];
      const need = (d.seatsRegular || 0) + (d.seatsErsatz || 0);
      const filled = [];
      const filledSet = new Set();
      const deferred = [];
      for (const candidate of sharedQueue) {
        if (!pool.has(candidate)) continue;
        if (filled.length >= need) break;
        if (usedThisWeek.has(candidate)) { deferred.push(candidate); continue; }
        filled.push(candidate); filledSet.add(candidate);
      }
      for (const candidate of deferred) {
        if (filled.length >= need) break;
        filled.push(candidate); filledSet.add(candidate); // unvermeidbare Kollision akzeptiert
      }
      filled.forEach(pid => usedThisWeek.add(pid));
      gdMoveToBack(sharedQueue, filled);

      gdSchedule[d.id][weekId] = {
        regular: filled.slice(0, d.seatsRegular || 0).map(pid => ({ type: 'person', id: pid })),
        ersatz:  filled.slice(d.seatsRegular || 0, need).map(pid => ({ type: 'person', id: pid })),
      };
    });
  });

  gdSaveSchedule();
}

// =========================
// KACHEL — dynamische Liste aller in der angezeigten Woche aktiven Pflichten
// =========================
let gdWidgetViewDate = new Date();

function gdActiveDutiesForWeek(date) {
  const weekId = getWeekId(date);
  return gdDuties
    .filter(d => gdWeekIdsInRange(d.startDate, d.endDate).includes(weekId))
    .map(d => ({ duty: d, entry: (gdSchedule[d.id] || {})[weekId] }));
}

function gdColHtmlForDuty(duty, entry) {
  const regularNames = (entry?.regular || []).map(gdRefName).map(gdEsc);
  const ersatzNames  = (entry?.ersatz  || []).map(gdRefName).map(gdEsc);
  const regLine = regularNames.length ? regularNames.join(' · ') : '—';
  const ersLine = ersatzNames.length ? `<div class="gd-col-ersatz">Ersatz: ${ersatzNames.join(' · ')}</div>` : '';
  return `
    <div class="gd-col">
      <div class="gd-col-title"><span class="gd-col-icon">${duty.icon || '📋'}</span>${gdEsc(duty.name)}</div>
      <div class="gd-col-names">${regLine}</div>
      ${ersLine}
    </div>`;
}

function gdBuildWidget() {
  const main = document.getElementById('today-main');
  if (!main) return;
  let widget = document.getElementById('gd-widget');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'gd-widget';
    widget.className = 'panel gd-widget';
    const tasksPanel = document.getElementById('panel-tasks');
    if (tasksPanel && tasksPanel.parentNode === main) tasksPanel.insertAdjacentElement('afterend', widget);
    else main.appendChild(widget);
  }

  const kw = getISOWeek(gdWidgetViewDate);
  const active = gdActiveDutiesForWeek(gdWidgetViewDate);

  const bodyHtml = active.length
    ? `<div class="gd-row">${active.map(a => gdColHtmlForDuty(a.duty, a.entry)).join('')}</div>`
    : `<div class="gd-empty">Für KW ${kw} sind keine Pflichten eingetragen.</div>`;

  widget.innerHTML = `
    <div class="panel-header">
      <button type="button" class="gd-title-btn" id="gd-toggle-btn" aria-expanded="false">
        <span class="gd-arrow">▶</span>
        <span class="panel-label">Gruppenpflichten</span>
      </button>
      <div style="display:flex;gap:8px;align-items:center;">
        <div class="gd-week-nav">
          <button type="button" class="week-btn" id="gd-week-prev" aria-label="Vorherige Woche">&#8249;</button>
          <span id="gd-week-nav-label">KW ${kw}</span>
          <button type="button" class="week-btn" id="gd-week-next" aria-label="Nächste Woche">&#8250;</button>
        </div>
        <button type="button" class="icon-btn gd-edit-btn" id="gd-edit-btn" title="Pflichten verwalten" aria-label="Pflichten verwalten">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2.3l2.4 2.4-8.1 8.1-3.1.7.7-3.1 8.1-8.1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
    <div class="gd-body">${bodyHtml}</div>`;

  document.getElementById('gd-edit-btn')?.addEventListener('click', gdOpenOverview);
  document.getElementById('gd-week-prev')?.addEventListener('click', () => { gdWidgetViewDate.setDate(gdWidgetViewDate.getDate() - 7); gdBuildWidget(); });
  document.getElementById('gd-week-next')?.addEventListener('click', () => { gdWidgetViewDate.setDate(gdWidgetViewDate.getDate() + 7); gdBuildWidget(); });
  // Accordion-Umschalter: wirkt sich nur auf Mobile aus (siehe gd-body-Regel
  // in today.css, @media max-width:480px) — auf Desktop bleibt gd-body
  // unabhängig von dieser Klasse immer sichtbar.
  document.getElementById('gd-toggle-btn')?.addEventListener('click', () => {
    const isOpen = widget.classList.toggle('gd-open');
    document.getElementById('gd-toggle-btn')?.setAttribute('aria-expanded', String(isOpen));
  });
}

function renderGruppendienste() { gdBuildWidget(); }

// =========================
// ÜBERSICHT — "Pflichten verwalten"-Modal
// =========================
const gdOverviewModal = wireModal('gd-overview-modal-overlay', { closeIds: ['gd-overview-close'] });

function gdOpenOverview() {
  gdRenderOverviewList();
  gdOverviewModal.open();
}

function gdDutyMetaLine(d) {
  const parts = [];
  parts.push(`${gdFmtDate(d.startDate)} – ${gdFmtDate(d.endDate)}`);
  const n = (d.participants || []).length;
  parts.push(`${n} Teilnehmer`);
  parts.push(d.rotationMode === 'fixed' ? 'Feste Reihenfolge' : 'Automatisch');
  return parts.join(' · ');
}

function gdRenderOverviewList() {
  const list = document.getElementById('gd-overview-list');
  if (!list) return;
  if (gdDuties.length === 0) {
    list.innerHTML = '<div class="gd-overview-empty">Noch keine Pflichten angelegt.</div>';
    return;
  }
  list.innerHTML = gdDuties.map(d => `
    <div class="gd-overview-item" data-id="${d.id}">
      <span class="gd-overview-icon">${d.icon || '📋'}</span>
      <div class="gd-overview-info">
        <div class="gd-overview-name">${gdEsc(d.name)}</div>
        <div class="gd-overview-meta">${gdEsc(gdDutyMetaLine(d))}</div>
      </div>
      <div class="gd-overview-actions">
        <button type="button" class="icon-btn gd-overview-edit" title="Bearbeiten">✎</button>
        <button type="button" class="icon-btn gd-overview-delete" title="Löschen">✕</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.gd-overview-edit').forEach(btn => {
    btn.addEventListener('click', () => gdOpenDutyEditor(btn.closest('.gd-overview-item').dataset.id));
  });
  list.querySelectorAll('.gd-overview-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.gd-overview-item').dataset.id;
      const d = gdFindDuty(id);
      if (!d) return;
      const ok = await hubConfirm({
        title: 'Pflicht löschen?',
        message: `„${d.name}" wird inklusive geplanter Zuteilungen gelöscht.`,
        confirmText: 'Löschen',
        danger: true,
      });
      if (!ok) return;
      gdDeleteDuty(id);
      gdRenderOverviewList();
      gdBuildWidget();
    });
  });
}

function gdDeleteDuty(id) {
  const affected = gdDuties.filter(d => (d.linkedDutyIds || []).includes(id)).map(d => d.id);
  gdDuties = gdDuties.filter(d => d.id !== id);
  gdDuties.forEach(d => { d.linkedDutyIds = (d.linkedDutyIds || []).filter(lid => lid !== id); });
  delete gdSchedule[id];
  gdSaveDuties();
  gdSaveSchedule();
  affected.forEach(aid => gdRecomputeComponent(aid));
}

document.getElementById('gd-overview-add')?.addEventListener('click', () => gdOpenDutyEditor(null));

// =========================
// PFLICHT-EDITOR
// =========================
const GD_SECTIONS = ['general', 'participants', 'seats', 'rotation', 'links'];
const gdDutyModal = wireModal('gd-duty-modal-overlay', { closeIds: ['gd-duty-modal-close', 'gd-duty-cancel'] });

let gdEditingDutyId = null;        // null = Neuanlage
let gdEditingParticipants = [];    // Arbeitskopie: [{type,id}]
let gdEditingFixedOrder = [];      // Arbeitskopie für Modus 'fixed'
let gdEditingLinks = [];           // Arbeitskopie: [dutyId...]
let gdEditingIcon = '🗑️';
let gdEditingMode = 'auto';

function gdShowSection(section) {
  GD_SECTIONS.forEach(s => {
    document.getElementById(`gd-duty-section-${s}`)?.classList.toggle('hidden', s !== section);
    document.querySelector(`.gd-section-tab[data-section="${s}"]`)?.classList.toggle('active', s === section);
  });
}
document.querySelectorAll('.gd-section-tab').forEach(btn => {
  btn.addEventListener('click', () => gdShowSection(btn.dataset.section));
});

function gdOpenDutyEditor(dutyId) {
  gdEditingDutyId = dutyId;
  const d = dutyId ? gdFindDuty(dutyId) : null;

  document.getElementById('gd-duty-modal-title').textContent = d ? 'Pflicht bearbeiten' : 'Neue Pflicht';
  document.getElementById('gd-duty-name').value  = d?.name || '';
  document.getElementById('gd-duty-start').value = d?.startDate || dateKey(new Date());
  document.getElementById('gd-duty-end').value   = d?.endDate || '';
  document.getElementById('gd-duty-seats-regular').value = d?.seatsRegular ?? 2;
  document.getElementById('gd-duty-seats-ersatz').value  = d?.seatsErsatz ?? 0;

  gdEditingIcon         = d?.icon || '🗑️';
  gdEditingParticipants = d ? d.participants.map(r => ({ ...r })) : [];
  gdEditingFixedOrder   = d ? (d.fixedOrder || []).map(r => ({ ...r })) : [];
  gdEditingLinks        = d ? (d.linkedDutyIds || []).slice() : [];
  gdEditingMode         = d?.rotationMode || 'auto';

  document.querySelectorAll('#gd-duty-icon-picker .recurring-icon-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.icon === gdEditingIcon));

  document.getElementById('gd-duty-delete').classList.toggle('hidden', !d);
  document.getElementById('gd-new-group-form').classList.add('hidden');
  document.getElementById('gd-links-list').classList.add('hidden');

  gdSyncRotationButtons();
  gdRenderPeoplePicker();
  gdRenderGroupsPicker();
  gdRenderParticipantsOverview();
  gdRenderLinksSummary();

  gdShowSection('general');
  gdDutyModal.open();
}

document.querySelectorAll('#gd-duty-icon-picker .recurring-icon-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    gdEditingIcon = btn.dataset.icon;
    document.querySelectorAll('#gd-duty-icon-picker .recurring-icon-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});

// ---- Teilnehmer ----
function gdRenderPeoplePicker() {
  const wrap = document.getElementById('gd-duty-people-picker');
  if (!wrap) return;
  wrap.innerHTML = gdPeople.map(p => {
    const active = gdEditingParticipants.some(r => r.type === 'person' && r.id === p.id);
    return `<button type="button" class="gd-chip${active ? ' active' : ''}" data-id="${p.id}">${gdEsc(p.name)}</button>`;
  }).join('');
  wrap.querySelectorAll('.gd-chip').forEach(btn => {
    btn.addEventListener('click', () => gdToggleParticipant({ type: 'person', id: btn.dataset.id }));
  });
}
function gdRenderGroupsPicker() {
  const wrap = document.getElementById('gd-duty-groups-picker');
  if (!wrap) return;
  wrap.innerHTML = gdGroups.map(g => {
    const active = gdEditingParticipants.some(r => r.type === 'group' && r.id === g.id);
    return `<button type="button" class="gd-chip${active ? ' active' : ''}" data-id="${g.id}">${gdEsc(g.name)} <span style="opacity:.65;">(${g.memberIds.length})</span></button>`;
  }).join('');
  wrap.querySelectorAll('.gd-chip').forEach(btn => {
    btn.addEventListener('click', () => gdToggleParticipant({ type: 'group', id: btn.dataset.id }));
  });
}
function gdToggleParticipant(ref) {
  const idx = gdEditingParticipants.findIndex(r => r.type === ref.type && r.id === ref.id);
  if (idx >= 0) gdEditingParticipants.splice(idx, 1);
  else gdEditingParticipants.push(ref);
  gdRenderPeoplePicker();
  gdRenderGroupsPicker();
  gdRenderParticipantsOverview();
}
function gdRenderParticipantsOverview() {
  const wrap = document.getElementById('gd-participants-overview');
  if (!wrap) return;
  wrap.innerHTML = gdEditingParticipants.map(ref => `
    <span class="gd-chip active" data-type="${ref.type}" data-id="${ref.id}">${gdEsc(gdRefName(ref))}<span class="gd-chip-remove" title="Entfernen">✕</span></span>
  `).join('');
  wrap.querySelectorAll('.gd-chip-remove').forEach(x => {
    x.addEventListener('click', e => {
      const chip = e.target.closest('.gd-chip');
      gdToggleParticipant({ type: chip.dataset.type, id: chip.dataset.id });
    });
  });
}

document.getElementById('gd-new-person-add')?.addEventListener('click', () => {
  const input = document.getElementById('gd-new-person-name');
  const name = input.value.trim();
  if (!name) return;
  const person = { id: gdId(), name };
  gdPeople.push(person);
  gdSavePeople();
  input.value = '';
  gdEditingParticipants.push({ type: 'person', id: person.id });
  gdRenderPeoplePicker();
  gdRenderParticipantsOverview();
});

document.getElementById('gd-new-group-toggle')?.addEventListener('click', () => {
  const form = document.getElementById('gd-new-group-form');
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) gdRenderNewGroupMembers();
});
function gdRenderNewGroupMembers() {
  const wrap = document.getElementById('gd-new-group-members');
  wrap.innerHTML = gdPeople.map(p => `<button type="button" class="gd-chip" data-id="${p.id}">${gdEsc(p.name)}</button>`).join('')
    || '<span class="modal-hint">Erst Personen anlegen (Bereich „Teilnehmer" → Personen).</span>';
  wrap.querySelectorAll('.gd-chip').forEach(btn => btn.addEventListener('click', () => btn.classList.toggle('active')));
}
document.getElementById('gd-new-group-add')?.addEventListener('click', () => {
  const nameInput = document.getElementById('gd-new-group-name');
  const name = nameInput.value.trim();
  if (!name) return;
  const memberIds = Array.from(document.querySelectorAll('#gd-new-group-members .gd-chip.active')).map(b => b.dataset.id);
  const group = { id: gdId(), name, memberIds };
  gdGroups.push(group);
  gdSaveGroups();
  nameInput.value = '';
  document.getElementById('gd-new-group-form').classList.add('hidden');
  gdEditingParticipants.push({ type: 'group', id: group.id });
  gdRenderGroupsPicker();
  gdRenderParticipantsOverview();
});

// ---- Besetzung ----
function gdUpdateSeatsHint() {
  const disabled = gdEditingMode === 'fixed';
  document.getElementById('gd-duty-seats-regular').disabled = disabled;
  document.getElementById('gd-duty-seats-ersatz').disabled  = disabled;
  document.getElementById('gd-duty-seats-hint').textContent = disabled
    ? 'Bei fester Reihenfolge wird die Besetzung nicht verwendet — jeder Eintrag deckt die ganze Woche ab.'
    : 'Wird nur bei automatischer Rotation verwendet.';
}

// ---- Rotation ----
function gdSyncRotationButtons() {
  document.getElementById('gd-rotation-auto').classList.toggle('active', gdEditingMode === 'auto');
  document.getElementById('gd-rotation-fixed').classList.toggle('active', gdEditingMode === 'fixed');
  document.getElementById('gd-duty-fixed-order-row').classList.toggle('hidden', gdEditingMode !== 'fixed');
  gdUpdateSeatsHint();
  gdRenderFixedOrderList();
}
document.getElementById('gd-rotation-auto')?.addEventListener('click', () => { gdEditingMode = 'auto'; gdSyncRotationButtons(); });
document.getElementById('gd-rotation-fixed')?.addEventListener('click', () => { gdEditingMode = 'fixed'; gdSyncRotationButtons(); });

function gdRenderFixedOrderList() {
  const wrap = document.getElementById('gd-duty-fixed-order-list');
  if (!wrap) return;
  // Reihenfolge an aktuelle Teilnehmer angleichen: entfernte raus, neue hinten an.
  gdEditingFixedOrder = gdEditingFixedOrder.filter(ref => gdEditingParticipants.some(p => p.type === ref.type && p.id === ref.id));
  gdEditingParticipants.forEach(ref => {
    if (!gdEditingFixedOrder.some(o => o.type === ref.type && o.id === ref.id)) gdEditingFixedOrder.push(ref);
  });

  if (!gdEditingFixedOrder.length) {
    wrap.innerHTML = '<span class="modal-hint">Erst Teilnehmer im Bereich „Teilnehmer" hinzufügen.</span>';
    return;
  }
  wrap.innerHTML = gdEditingFixedOrder.map((ref, i) => `
    <div class="gd-order-row" data-idx="${i}">
      <span class="gd-order-row-label">${i + 1}. ${gdEsc(gdRefName(ref))}</span>
      <div class="gd-order-row-btns">
        <button type="button" class="icon-btn gd-order-up" title="Nach oben verschieben" ${i === 0 ? 'disabled' : ''}>⬆</button>
        <button type="button" class="icon-btn gd-order-down" title="Nach unten verschieben" ${i === gdEditingFixedOrder.length - 1 ? 'disabled' : ''}>⬇</button>
      </div>
    </div>`).join('');

  wrap.querySelectorAll('.gd-order-up').forEach(btn => btn.addEventListener('click', () => {
    const i = Number(btn.closest('.gd-order-row').dataset.idx);
    gdSwapFixedOrder(i, i - 1);
  }));
  wrap.querySelectorAll('.gd-order-down').forEach(btn => btn.addEventListener('click', () => {
    const i = Number(btn.closest('.gd-order-row').dataset.idx);
    gdSwapFixedOrder(i, i + 1);
  }));
}
function gdSwapFixedOrder(i, j) {
  if (j < 0 || j >= gdEditingFixedOrder.length) return;
  const tmp = gdEditingFixedOrder[i];
  gdEditingFixedOrder[i] = gdEditingFixedOrder[j];
  gdEditingFixedOrder[j] = tmp;
  gdRenderFixedOrderList();
}

// ---- Verknüpfte Pflichten ----
document.getElementById('gd-links-toggle')?.addEventListener('click', () => {
  const list = document.getElementById('gd-links-list');
  list.classList.toggle('hidden');
  if (!list.classList.contains('hidden')) gdRenderLinksList();
});
function gdRenderLinksList() {
  const wrap = document.getElementById('gd-links-list');
  const others = gdDuties.filter(d => d.id !== gdEditingDutyId);
  if (!others.length) { wrap.innerHTML = '<span class="modal-hint">Keine weiteren Pflichten vorhanden.</span>'; return; }
  wrap.innerHTML = others.map(d => {
    const active = gdEditingLinks.includes(d.id);
    return `<button type="button" class="gd-chip${active ? ' active' : ''}" data-id="${d.id}">${d.icon || '📋'} ${gdEsc(d.name)}</button>`;
  }).join('');
  wrap.querySelectorAll('.gd-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const idx = gdEditingLinks.indexOf(id);
      if (idx >= 0) gdEditingLinks.splice(idx, 1); else gdEditingLinks.push(id);
      gdRenderLinksList();
      gdRenderLinksSummary();
    });
  });
}
function gdRenderLinksSummary() {
  const el = document.getElementById('gd-links-summary');
  if (!el) return;
  el.textContent = gdEditingLinks.length
    ? gdEditingLinks.map(id => gdFindDuty(id)?.name).filter(Boolean).join(', ')
    : '—';
}

// ---- Speichern / Löschen ----
document.getElementById('gd-duty-save')?.addEventListener('click', () => {
  const name      = document.getElementById('gd-duty-name').value.trim();
  const startDate = document.getElementById('gd-duty-start').value;
  const endDate   = document.getElementById('gd-duty-end').value;

  if (!name) { gdShowSection('general'); document.getElementById('gd-duty-name').focus(); return; }
  if (!startDate || !endDate || endDate < startDate) { gdShowSection('general'); document.getElementById('gd-duty-end').focus(); return; }
  if (gdEditingParticipants.length === 0) { gdShowSection('participants'); return; }

  const seatsRegular = Math.max(0, parseInt(document.getElementById('gd-duty-seats-regular').value, 10) || 0);
  const seatsErsatz  = Math.max(0, parseInt(document.getElementById('gd-duty-seats-ersatz').value, 10) || 0);

  let duty = gdEditingDutyId ? gdFindDuty(gdEditingDutyId) : null;
  if (!duty) { duty = { id: gdId() }; gdDuties.push(duty); }

  duty.name          = name;
  duty.icon          = gdEditingIcon;
  duty.startDate      = startDate;
  duty.endDate        = endDate;
  duty.participants   = gdEditingParticipants.map(r => ({ ...r }));
  duty.seatsRegular   = seatsRegular;
  duty.seatsErsatz    = seatsErsatz;
  duty.rotationMode   = gdEditingMode;
  duty.fixedOrder     = gdEditingFixedOrder.map(r => ({ ...r }));
  duty.autoRotationOrder = gdShuffle(gdExpandParticipantsToPeople(duty.participants));

  // Verknüpfungen beidseitig synchronisieren.
  gdDuties.forEach(d => {
    if (d.id === duty.id) return;
    const shouldBeLinked = gdEditingLinks.includes(d.id);
    const isLinked = (d.linkedDutyIds || []).includes(duty.id);
    if (shouldBeLinked && !isLinked) (d.linkedDutyIds = d.linkedDutyIds || []).push(duty.id);
    if (!shouldBeLinked && isLinked) d.linkedDutyIds = d.linkedDutyIds.filter(id => id !== duty.id);
  });
  duty.linkedDutyIds = gdEditingLinks.slice();

  gdSaveDuties();
  gdRecomputeComponent(duty.id);
  gdDutyModal.close();
  gdRenderOverviewList();
  gdBuildWidget();
});

document.getElementById('gd-duty-delete')?.addEventListener('click', async () => {
  if (!gdEditingDutyId) return;
  const d = gdFindDuty(gdEditingDutyId);
  const ok = await hubConfirm({
    title: 'Pflicht löschen?',
    message: `„${d?.name}" wird inklusive geplanter Zuteilungen gelöscht.`,
    confirmText: 'Löschen',
    danger: true,
  });
  if (!ok) return;
  gdDeleteDuty(gdEditingDutyId);
  gdDutyModal.close();
  gdRenderOverviewList();
  gdBuildWidget();
});

// Einmalige Migration: Rotationsalgorithmus wurde von getrennten Pro-Pflicht-
// Warteschlangen auf eine geteilte Warteschlange pro Verknüpfungsgruppe
// umgestellt (siehe gdDeriveComponentQueue/gdRecomputeComponent) — die alte
// Version konnte dieselbe Person kurz hintereinander in verschiedenen
// verknüpften Pflichten einteilen. Bereits berechnete zukünftige Wochen
// müssen einmalig mit dem neuen Algorithmus neu berechnet werden; die
// Vergangenheit bleibt unangetastet (gdRecomputeComponent rechnet nur ab
// der aktuellen Woche neu).
(function gdMigrateSharedQueueAlgo() {
  if (DB.get('gdScheduleAlgoV2', false)) return;
  const visited = new Set();
  gdDuties.forEach(d => {
    if (visited.has(d.id)) return;
    gdConnectedComponent(d.id).forEach(cd => visited.add(cd.id));
    gdRecomputeComponent(d.id);
  });
  DB.set('gdScheduleAlgoV2', true);
})();

renderGruppendienste();
