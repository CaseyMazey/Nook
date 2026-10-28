// =========================
// TOOLS — 6) ENTSCHEIDUNGSHILFE
// Ein Entscheidungsblatt pro Dilemma: Wichtigkeit, Best/Worst Case,
// Bauchgefühl, Plus/Minus, Entscheidung + nächste Schritte — und zur Not
// eine Münze. Die Karte listet alle Blätter, bearbeitet wird im Modal
// (speichert bei jeder Eingabe, wie die Schnellnotiz).
// Benötigt tools.js (Grundgerüst mit #tool-decision + Modal) zuvor geladen.
// =========================

const DECISION_IMPORTANCE = ['Nervig', 'Trivial', 'Lohnend', 'Gewichtig', 'Lebensverändernd'];
const DECISION_INDECISION = ['Wankelmütig', 'Unschlüssig', 'Neutral', 'Tendenz', 'Steht fest'];

let toolsDecisions = DB.get('toolsDecisions', []);
function saveToolsDecisions() { DB.set('toolsDecisions', toolsDecisions); }

let decisionEditId = null;
let decisionModal = null;

function decisionCurrent() {
  return toolsDecisions.find(d => d.id === decisionEditId) || null;
}

function decisionFmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function renderDecisionList() {
  const list = document.getElementById('decision-list');
  const empty = document.getElementById('decision-empty');
  if (!list) return;
  const sorted = [...toolsDecisions].sort((a, b) => (!!a.decision.trim() - !!b.decision.trim()) || b.createdAt - a.createdAt);
  empty.classList.toggle('hidden', sorted.length > 0);
  list.innerHTML = sorted.map(d => {
    const decided = !!d.decision.trim();
    const meta = [];
    if (d.importance != null) meta.push(DECISION_IMPORTANCE[d.importance]);
    if (d.dueDate && !decided) meta.push(`bis ${decisionFmtDate(d.dueDate)}`);
    if (decided) meta.push(`→ ${d.decision.trim().split('\n')[0]}`);
    return `<button type="button" class="decision-item${decided ? ' decision-item--done' : ''}" data-id="${d.id}">
      <span class="decision-item-status">${decided ? (d.forNow ? '⏳' : '✔') : '?'}</span>
      <span class="decision-item-main">
        <span class="decision-item-title">${escHtml(d.dilemma.trim() || 'Ohne Titel')}</span>
        ${meta.length ? `<span class="decision-item-meta">${escHtml(meta.join(' · '))}</span>` : ''}
      </span>
    </button>`;
  }).join('');
}

function decisionRenderScale(groupId, labels, value) {
  document.getElementById(groupId).innerHTML = labels.map((l, i) =>
    `<button type="button" class="decision-scale-btn${value === i ? ' active' : ''}" data-i="${i}" role="radio" aria-checked="${value === i}">${l}</button>`
  ).join('');
}

function decisionRenderPros() {
  const d = decisionCurrent();
  if (!d) return;
  document.getElementById('decision-pros').innerHTML = d.pros.map(p => `
    <div class="decision-pro" data-id="${p.id}">
      <button type="button" class="decision-pro-sign decision-pro-sign--${p.sign === '+' ? 'plus' : 'minus'}" title="Plus/Minus wechseln">${p.sign === '+' ? '+' : '−'}</button>
      <input type="text" class="decision-pro-text" value="${escHtml(p.text)}" placeholder="${p.sign === '+' ? 'Was spricht dafür?' : 'Was spricht dagegen?'}" autocomplete="off">
      <button type="button" class="decision-pro-del" title="Entfernen">✕</button>
    </div>`).join('');
  const plus = d.pros.filter(p => p.sign === '+' && p.text.trim()).length;
  const minus = d.pros.filter(p => p.sign === '-' && p.text.trim()).length;
  document.getElementById('decision-pros-tally').textContent = (plus || minus) ? `${plus} Plus · ${minus} Minus` : '';
}

function openDecision(id) {
  const d = toolsDecisions.find(x => x.id === id);
  if (!d) return;
  decisionEditId = id;
  document.getElementById('decision-dilemma').value = d.dilemma;
  document.getElementById('decision-created').textContent = decisionFmtDate(d.createdAt ? dateKey(new Date(d.createdAt)) : '');
  document.getElementById('decision-due').value = d.dueDate || '';
  ['best', 'worst', 'gut', 'gutConclusion', 'rationalConclusion', 'decision', 'nextSteps'].forEach(k => {
    document.querySelector(`[data-decision-field="${k}"]`).value = d[k] || '';
  });
  document.getElementById('decision-best-pipe').checked = !!d.bestPipe;
  document.getElementById('decision-worst-apoc').checked = !!d.worstApoc;
  document.getElementById('decision-for-now').checked = !!d.forNow;
  decisionRenderScale('decision-importance', DECISION_IMPORTANCE, d.importance);
  decisionRenderScale('decision-indecision', DECISION_INDECISION, d.indecision);
  decisionRenderPros();
  document.getElementById('decision-coin-result').textContent = '';
  decisionModal.open();
}

function newDecision() {
  const d = {
    id: crypto.randomUUID(), createdAt: Date.now(),
    dilemma: '', dueDate: '', importance: null, indecision: null,
    best: '', bestPipe: false, worst: '', worstApoc: false,
    gut: '', gutConclusion: '',
    pros: [{ id: crypto.randomUUID(), sign: '+', text: '' }, { id: crypto.randomUUID(), sign: '-', text: '' }],
    rationalConclusion: '', decision: '', forNow: false, nextSteps: '',
  };
  toolsDecisions.push(d);
  saveToolsDecisions();
  renderDecisionList();
  openDecision(d.id);
  document.getElementById('decision-dilemma').focus();
}

function decisionUpdate(patch) {
  const d = decisionCurrent();
  if (!d) return;
  Object.assign(d, patch);
  saveToolsDecisions();
  renderDecisionList();
}

function decisionFlipCoin() {
  const out = document.getElementById('decision-coin-result');
  out.classList.remove('decision-coin-result--flip');
  void out.offsetWidth;   // Animation neu starten
  out.textContent = Math.random() < 0.5 ? '🪙 Kopf' : '🪙 Zahl';
  out.classList.add('decision-coin-result--flip');
}

function initDecisionTool() {
  decisionModal = wireModal('decision-modal-overlay', {
    closeIds: ['decision-modal-close', 'decision-done-btn'],
    onClose: () => {
      // Komplett leere Blätter nicht als Leiche in der Liste lassen
      const d = decisionCurrent();
      if (d && !d.dilemma.trim() && !d.best.trim() && !d.worst.trim() && !d.gut.trim() && !d.decision.trim() && !d.pros.some(p => p.text.trim())) {
        toolsDecisions = toolsDecisions.filter(x => x.id !== d.id);
        saveToolsDecisions();
      }
      decisionEditId = null;
      renderDecisionList();
    },
  });

  document.getElementById('decision-add-btn').addEventListener('click', newDecision);
  document.getElementById('decision-list').addEventListener('click', e => {
    const item = e.target.closest('.decision-item');
    if (item) openDecision(item.dataset.id);
  });

  document.getElementById('decision-dilemma').addEventListener('input', e => decisionUpdate({ dilemma: e.target.value }));
  document.getElementById('decision-due').addEventListener('change', e => decisionUpdate({ dueDate: e.target.value }));
  document.querySelectorAll('[data-decision-field]').forEach(el =>
    el.addEventListener('input', () => decisionUpdate({ [el.dataset.decisionField]: el.value })));
  document.getElementById('decision-best-pipe').addEventListener('change', e => decisionUpdate({ bestPipe: e.target.checked }));
  document.getElementById('decision-worst-apoc').addEventListener('change', e => decisionUpdate({ worstApoc: e.target.checked }));
  document.getElementById('decision-for-now').addEventListener('change', e => decisionUpdate({ forNow: e.target.checked }));

  [['decision-importance', 'importance', DECISION_IMPORTANCE], ['decision-indecision', 'indecision', DECISION_INDECISION]].forEach(([gid, key, labels]) => {
    document.getElementById(gid).addEventListener('click', e => {
      const btn = e.target.closest('.decision-scale-btn');
      if (!btn) return;
      const i = Number(btn.dataset.i);
      const val = decisionCurrent()?.[key] === i ? null : i;   // nochmal klicken = abwählen
      decisionUpdate({ [key]: val });
      decisionRenderScale(gid, labels, val);
    });
  });

  // Plus/Minus-Liste
  const pros = document.getElementById('decision-pros');
  pros.addEventListener('input', e => {
    const row = e.target.closest('.decision-pro');
    const p = decisionCurrent()?.pros.find(x => x.id === row?.dataset.id);
    if (!p) return;
    p.text = e.target.value;
    saveToolsDecisions();
    const d = decisionCurrent();
    const plus = d.pros.filter(x => x.sign === '+' && x.text.trim()).length;
    const minus = d.pros.filter(x => x.sign === '-' && x.text.trim()).length;
    document.getElementById('decision-pros-tally').textContent = (plus || minus) ? `${plus} Plus · ${minus} Minus` : '';
  });
  pros.addEventListener('click', e => {
    const row = e.target.closest('.decision-pro');
    const d = decisionCurrent();
    if (!row || !d) return;
    if (e.target.closest('.decision-pro-sign')) {
      const p = d.pros.find(x => x.id === row.dataset.id);
      p.sign = p.sign === '+' ? '-' : '+';
    } else if (e.target.closest('.decision-pro-del')) {
      d.pros = d.pros.filter(x => x.id !== row.dataset.id);
    } else return;
    saveToolsDecisions();
    decisionRenderPros();
  });
  pros.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.classList.contains('decision-pro-text')) return;
    e.preventDefault();
    const d = decisionCurrent();
    const cur = d.pros.find(x => x.id === e.target.closest('.decision-pro').dataset.id);
    const p = { id: crypto.randomUUID(), sign: cur.sign === '+' ? '-' : '+', text: '' };
    d.pros.splice(d.pros.indexOf(cur) + 1, 0, p);
    saveToolsDecisions();
    decisionRenderPros();
    pros.querySelector(`[data-id="${p.id}"] .decision-pro-text`)?.focus();
  });
  document.querySelectorAll('[data-decision-add-pro]').forEach(btn => btn.addEventListener('click', () => {
    const d = decisionCurrent();
    if (!d) return;
    const p = { id: crypto.randomUUID(), sign: btn.dataset.decisionAddPro, text: '' };
    d.pros.push(p);
    saveToolsDecisions();
    decisionRenderPros();
    pros.querySelector(`[data-id="${p.id}"] .decision-pro-text`)?.focus();
  }));

  document.getElementById('decision-coin-btn').addEventListener('click', decisionFlipCoin);

  document.getElementById('decision-delete-btn').addEventListener('click', async () => {
    const d = decisionCurrent();
    if (!d) return;
    if (!(await hubConfirm({ title: 'Entscheidung löschen?', message: `„${d.dilemma.trim() || 'Ohne Titel'}“ wird entfernt.`, confirmText: 'Löschen', danger: true }))) return;
    toolsDecisions = toolsDecisions.filter(x => x.id !== d.id);
    saveToolsDecisions();
    decisionModal.close();
  });

  renderDecisionList();
}

// =========================
// SUCHQUELLE (js/hub-search.js, AI documentation/search.md) — nur lesen
// =========================
registerSearchProvider({
  id: 'decisions', label: 'Entscheidungen', icon: '⚖️', view: 'tools',
  items: () => toolsDecisions.map(d => ({
    id: d.id, icon: d.decision.trim() ? '✔' : '⚖️', title: d.dilemma.trim() || 'Ohne Titel',
    sub: d.decision.trim() ? `Entschieden: ${d.decision.trim().split('\n')[0]}` : 'Entscheidungshilfe',
    text: [d.best, d.worst, d.gut, d.nextSteps, ...d.pros.map(p => p.text)].join(' '),
    open: () => { showView('tools'); openDecision(d.id); },
  })),
});
