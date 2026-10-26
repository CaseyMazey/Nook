// =========================
// TODAY — Schnellnotiz „Ablegen“
// Legt den markierten Text (oder die ganze Schnellnotiz) beim zuständigen
// Tab ab: als Pinnwand-Karte, Projektaufgabe(n) oder Wochenaufgabe(n).
// Die Heute-Seite übernimmt dabei KEINE Funktionen anderer Tabs
// (today.md): angelegt wird über deren eigene Funktionen
// (addDeskCardFromText in pinboard.js, addProjectTasksFromLines in
// projects.js) im jeweils eigenen Datenformat; bearbeitet wird weiterhin
// dort. Die Funktionen werden erst beim Klick gebraucht, daher spielt die
// Ladereihenfolge gegenüber pinboard.js/projects.js keine Rolle.
// =========================

let qnSendTarget = 'pinboard';
let qnSendRange = null;   // { start, end } der Auswahl im Textfeld, null = ganze Notiz

const qnSendModal = wireModal('qn-send-modal-overlay', {
  closeIds: ['qn-send-close', 'qn-send-cancel'],
});

// Zeilen ohne Aufzählungszeichen, leere Zeilen weg
function qnSendLines(text) {
  return text.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);
}

function qnSendText() {
  const qn = document.getElementById('quicknote');
  return qnSendRange ? qn.value.slice(qnSendRange.start, qnSendRange.end) : qn.value;
}

function qnSendFillSubprojects() {
  const proj = (typeof projects !== 'undefined' ? projects : []).find(p => p.id === document.getElementById('qn-send-project').value);
  const sel = document.getElementById('qn-send-subproject');
  sel.innerHTML = `<option value="">${escHtml(proj?.mainTasksLabel || 'Hauptaufgaben')}</option>`
    + (proj?.subprojects || []).map(sp => `<option value="${sp.id}">${escHtml(sp.title)}</option>`).join('');
}

function qnSendUpdate() {
  document.querySelectorAll('.qn-send-target').forEach(b => {
    const on = b.dataset.target === qnSendTarget;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  document.getElementById('qn-send-project-fields').classList.toggle('hidden', qnSendTarget !== 'project');
  const lines = qnSendLines(qnSendText());
  const hint = document.getElementById('qn-send-hint');
  const saveBtn = document.getElementById('qn-send-save');
  const noProjects = qnSendTarget === 'project' && !document.getElementById('qn-send-project').options.length;
  if (qnSendTarget === 'pinboard') hint.textContent = 'Erste Zeile wird der Titel, der Rest der Text der Karte.';
  else if (noProjects) hint.textContent = 'Es gibt noch kein aktives Projekt.';
  else hint.textContent = lines.length === 1 ? 'Wird als eine Aufgabe angelegt.' : `Wird als ${lines.length} Aufgaben angelegt (eine pro Zeile).`;
  saveBtn.disabled = !lines.length || noProjects;
}

function openQuicknoteSend() {
  const qn = document.getElementById('quicknote');
  if (!qn || !qn.value.trim()) {
    hubAlert('Schnellnotiz ist leer', 'Schreib zuerst etwas in die Schnellnotiz — oder markiere den Teil, den du ablegen möchtest.');
    return;
  }
  const hasSel = qn.selectionEnd > qn.selectionStart && qn.value.slice(qn.selectionStart, qn.selectionEnd).trim();
  qnSendRange = hasSel ? { start: qn.selectionStart, end: qn.selectionEnd } : null;
  document.getElementById('qn-send-title').textContent = hasSel ? 'Markierten Text ablegen' : 'Schnellnotiz ablegen';
  document.getElementById('qn-send-preview').textContent = qnSendText().trim();

  const projSel = document.getElementById('qn-send-project');
  const active = (typeof projects !== 'undefined' ? projects : []).filter(p => !p.archived);
  projSel.innerHTML = active.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  const lastProj = DB.get('qnSendLastProject', null);
  if (lastProj && active.some(p => p.id === lastProj)) projSel.value = lastProj;
  qnSendFillSubprojects();

  qnSendTarget = DB.get('qnSendLastTarget', 'pinboard');
  document.getElementById('qn-send-remove').checked = true;
  qnSendUpdate();
  qnSendModal.open();
}

function qnShowSentHint(label, view) {
  const hint = document.getElementById('qn-sent-hint');
  if (!hint) return;
  hint.textContent = `→ ${label}`;
  hint.onclick = () => showView(view);
  hint.classList.remove('hidden');
  clearTimeout(qnShowSentHint._t);
  qnShowSentHint._t = setTimeout(() => hint.classList.add('hidden'), 6000);
}

document.getElementById('qn-send-btn')?.addEventListener('click', openQuicknoteSend);
// Auswahl im Textfeld nicht verlieren, wenn der Knopf gedrückt wird
document.getElementById('qn-send-btn')?.addEventListener('mousedown', e => e.preventDefault());
document.querySelectorAll('.qn-send-target').forEach(b => b.addEventListener('click', () => {
  qnSendTarget = b.dataset.target;
  qnSendUpdate();
}));
document.getElementById('qn-send-project')?.addEventListener('change', () => { qnSendFillSubprojects(); qnSendUpdate(); });

document.getElementById('qn-send-save')?.addEventListener('click', () => {
  const text = qnSendText();
  const lines = qnSendLines(text);
  if (!lines.length) return;
  let done = null;

  if (qnSendTarget === 'pinboard' && typeof addDeskCardFromText === 'function') {
    const all = text.trim().split('\n');
    const title = all[0].trim().slice(0, 80);
    const content = all.slice(1).join('\n').trim();
    addDeskCardFromText(title, content);
    done = ['In „Pinnwand“ abgelegt', 'pinboard'];
  } else if (qnSendTarget === 'project' && typeof addProjectTasksFromLines === 'function') {
    const pid = document.getElementById('qn-send-project').value;
    const spid = document.getElementById('qn-send-subproject').value || null;
    const n = addProjectTasksFromLines(pid, spid, lines);
    if (!n) return;
    DB.set('qnSendLastProject', pid);
    const name = projects.find(p => p.id === pid)?.name || 'Projekt';
    done = [`${n === 1 ? 'Aufgabe' : n + ' Aufgaben'} in „${name}“ abgelegt`, 'projects'];
  } else if (qnSendTarget === 'task') {
    lines.forEach(title => {
      const t = { id: crypto.randomUUID(), title, notes: '', priority: 2, blocks: [], createdAt: Date.now() };
      setTaskStatus(t, 'open');
      tasks.push(t);
    });
    saveTasks();
    renderTasks();
    renderBlocks();
    done = [`${lines.length === 1 ? 'Wochenaufgabe' : lines.length + ' Wochenaufgaben'} angelegt`, 'today'];
  }
  if (!done) return;
  DB.set('qnSendLastTarget', qnSendTarget);

  if (document.getElementById('qn-send-remove').checked) {
    const qn = document.getElementById('quicknote');
    qn.value = qnSendRange
      ? (qn.value.slice(0, qnSendRange.start) + qn.value.slice(qnSendRange.end)).replace(/\n{3,}/g, '\n\n')
      : '';
    quicknote = qn.value;
    DB.set('quicknote', quicknote);
  }
  qnSendModal.close();
  qnShowSentHint(done[0], done[1]);
});
