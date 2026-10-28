// =========================
// TODAY — Brain Dump
// Großer Bruder der Schnellnotiz: alles aus dem Kopf aufs Blatt, gleich
// sortiert nach Art (anrufen, schreiben, mailen, …). Öffnet sich als Modal
// über den Knopf im Schnellnotiz-Kopf, damit die Sidebar nicht wächst
// (today.md: Sidebar nicht überladen). Einträge lassen sich abhaken oder
// als Wochenaufgabe übernehmen — wie „Ablegen“ in today-quicknote-send.js.
// Braucht tasks/saveTasks/renderTasks aus main.js/today.js (erst beim Klick).
// =========================

const BRAINDUMP_SECTIONS = [
  { id: 'call',     icon: '📞', label: 'Anrufen' },
  { id: 'text',     icon: '💬', label: 'Schreiben' },
  { id: 'email',    icon: '✉️', label: 'Mailen' },
  { id: 'schedule', icon: '📅', label: 'Termin machen' },
  { id: 'follow',   icon: '🔁', label: 'Nachhaken' },
  { id: 'speak',    icon: '🗣️', label: 'Ansprechen' },
  { id: 'research', icon: '🔍', label: 'Recherchieren / Nachschauen / Lernen', wide: true },
  { id: 'create',   icon: '🛠️', label: 'Machen / Erschaffen', wide: true },
  { id: 'want',     icon: '🌱', label: 'Was ich machen WILL' },
  { id: 'prio',     icon: '⭐', label: 'Top-Prioritäten / Was ich machen MUSS' },
];

let brainDump = DB.get('brainDump', { goal: '', startDate: '', items: {} });
function saveBrainDump() { DB.set('brainDump', brainDump); }

const brainDumpModal = wireModal('braindump-modal-overlay', {
  closeIds: ['braindump-close', 'braindump-done'],
  onClose: () => updateBrainDumpBtn(),
});

function brainDumpOpenCount() {
  return Object.values(brainDump.items).reduce((n, list) => n + list.filter(i => !i.done).length, 0);
}

function updateBrainDumpBtn() {
  const badge = document.getElementById('braindump-count');
  if (!badge) return;
  const n = brainDumpOpenCount();
  badge.textContent = n;
  badge.classList.toggle('hidden', !n);
}

function renderBrainDumpSection(sec) {
  const list = brainDump.items[sec.id] || [];
  return `<div class="bd-sec${sec.wide ? ' bd-sec--wide' : ''}" data-sec="${sec.id}">
    <div class="bd-sec-head"><span>${sec.icon}</span>${sec.label}</div>
    <ul class="bd-list">${list.map(i => `
      <li class="bd-item${i.done ? ' bd-item--done' : ''}" data-id="${i.id}">
        <input type="checkbox" class="bd-check" ${i.done ? 'checked' : ''} aria-label="Erledigt">
        <span class="bd-text">${escHtml(i.text)}</span>
        ${i.sent ? '<span class="bd-sent" title="Als Wochenaufgabe angelegt">✅</span>'
                 : '<button type="button" class="bd-act bd-to-task" title="Als Wochenaufgabe anlegen">↗</button>'}
        <button type="button" class="bd-act bd-del" title="Entfernen">✕</button>
      </li>`).join('')}
    </ul>
    <input type="text" class="bd-add" placeholder="+ hinzufügen …" autocomplete="off" aria-label="${sec.label}: Eintrag hinzufügen">
  </div>`;
}

function renderBrainDump(focusSec) {
  document.getElementById('braindump-goal').value = brainDump.goal;
  const start = document.getElementById('braindump-start');
  start.textContent = brainDump.startDate ? new Date(brainDump.startDate + 'T00:00').toLocaleDateString('de-DE') : '—';
  document.getElementById('braindump-grid').innerHTML = BRAINDUMP_SECTIONS.map(renderBrainDumpSection).join('');
  if (focusSec) document.querySelector(`.bd-sec[data-sec="${focusSec}"] .bd-add`)?.focus();
  updateBrainDumpBtn();
}

function openBrainDump(focusId) {
  renderBrainDump();
  brainDumpModal.open();
  if (focusId) {
    const el = document.querySelector(`.bd-item[data-id="${focusId}"]`);
    el?.scrollIntoView({ block: 'center' });
    el?.classList.add('bd-item--flash');
  }
}

function brainDumpFind(id) {
  for (const sec in brainDump.items) {
    const item = brainDump.items[sec].find(i => i.id === id);
    if (item) return { sec, item };
  }
  return null;
}

document.getElementById('braindump-btn')?.addEventListener('click', () => openBrainDump());

document.getElementById('braindump-goal')?.addEventListener('input', e => {
  brainDump.goal = e.target.value;
  saveBrainDump();
});

const brainDumpGrid = document.getElementById('braindump-grid');
brainDumpGrid?.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.classList.contains('bd-add')) return;
  e.preventDefault();
  const text = e.target.value.trim();
  if (!text) return;
  const sec = e.target.closest('.bd-sec').dataset.sec;
  (brainDump.items[sec] ||= []).push({ id: crypto.randomUUID(), text, done: false });
  if (!brainDump.startDate) brainDump.startDate = dateKey(new Date());
  saveBrainDump();
  renderBrainDump(sec);
});

brainDumpGrid?.addEventListener('change', e => {
  if (!e.target.classList.contains('bd-check')) return;
  const hit = brainDumpFind(e.target.closest('.bd-item').dataset.id);
  if (!hit) return;
  hit.item.done = e.target.checked;
  saveBrainDump();
  e.target.closest('.bd-item').classList.toggle('bd-item--done', hit.item.done);
  updateBrainDumpBtn();
});

brainDumpGrid?.addEventListener('click', e => {
  const row = e.target.closest('.bd-item');
  if (!row) return;
  const hit = brainDumpFind(row.dataset.id);
  if (!hit) return;
  if (e.target.closest('.bd-del')) {
    brainDump.items[hit.sec] = brainDump.items[hit.sec].filter(i => i !== hit.item);
  } else if (e.target.closest('.bd-to-task')) {
    const t = { id: crypto.randomUUID(), title: hit.item.text, notes: '', priority: hit.sec === 'prio' ? 1 : 2, blocks: [], createdAt: Date.now() };
    setTaskStatus(t, 'open');
    tasks.push(t);
    saveTasks();
    renderTasks();
    renderBlocks();
    hit.item.sent = true;
  } else return;
  saveBrainDump();
  renderBrainDump();
});

document.getElementById('braindump-clear-done')?.addEventListener('click', () => {
  for (const sec in brainDump.items) brainDump.items[sec] = brainDump.items[sec].filter(i => !i.done);
  saveBrainDump();
  renderBrainDump();
});

document.getElementById('braindump-reset')?.addEventListener('click', async () => {
  if (!(await hubConfirm({ title: 'Neues Blatt anfangen?', message: 'Alle Einträge und das große Ziel werden geleert.', confirmText: 'Leeren', danger: true }))) return;
  brainDump = { goal: '', startDate: '', items: {} };
  saveBrainDump();
  renderBrainDump();
});

updateBrainDumpBtn();

// =========================
// SUCHQUELLE (js/hub-search.js, AI documentation/search.md) — nur lesen
// =========================
registerSearchProvider({
  id: 'braindump', label: 'Brain Dump', icon: '🧠', view: 'today',
  items: () => BRAINDUMP_SECTIONS.flatMap(sec => (brainDump.items[sec.id] || []).map(i => ({
    id: i.id, icon: i.done ? '✔️' : sec.icon, title: i.text,
    sub: `Brain Dump · ${sec.label}`, text: '',
    open: () => { showView('today'); openBrainDump(i.id); },
  }))),
});
