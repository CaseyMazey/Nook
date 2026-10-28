// =========================
// TOOLS — 6) ENTSCHEIDUNGSHILFE
// Ein Entscheidungsblatt pro Dilemma: Wichtigkeit, Best/Worst Case,
// Bauchgefühl, Plus/Minus, Entscheidung + nächste Schritte — und zur Not
// eine Münze. Die Karte listet alle Blätter, bearbeitet wird im Modal
// (speichert bei jeder Eingabe, wie die Schnellnotiz).
// Dazu: Optionen-Matrix (gewichtete Kriterien), Zufallsrad über die
// Optionen, Rückblick („War die Entscheidung gut?“) und Archiv.
// Benötigt tools.js (Grundgerüst mit #tool-decision + Modal) zuvor geladen.
// =========================

const DECISION_IMPORTANCE = ['Nervig', 'Trivial', 'Lohnend', 'Gewichtig', 'Lebensverändernd'];
const DECISION_INDECISION = ['Wankelmütig', 'Unschlüssig', 'Neutral', 'Tendenz', 'Steht fest'];

let toolsDecisions = DB.get('toolsDecisions', []);
function saveToolsDecisions() { DB.set('toolsDecisions', toolsDecisions); }

let decisionEditId = null;
let decisionModal = null;
let decisionShowArchive = false;

const DECISION_REVIEW_RATINGS = ['👍 Gut', '😐 Teils', '👎 Nicht gut'];

// Ältere Blätter kennen Matrix/Rückblick noch nicht — Felder ergänzen
function decisionEnsureFields(d) {
  if (!d.matrix) d.matrix = { options: [], criteria: [], scores: {} };
  if (d.reviewNote === undefined) d.reviewNote = '';
  return d;
}
toolsDecisions.forEach(decisionEnsureFields);

function decisionReviewDue(d) {
  return !!d.reviewAt && !d.review && d.reviewAt <= dateKey(new Date());
}

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
  const archived = toolsDecisions.filter(d => d.archived).length;
  const visible = toolsDecisions.filter(d => !!d.archived === decisionShowArchive);
  // Fällige Rückblicke zuerst, dann offene, dann entschiedene
  const rank = d => decisionReviewDue(d) ? 0 : d.decision.trim() ? 2 : 1;
  const sorted = visible.sort((a, b) => (rank(a) - rank(b)) || b.createdAt - a.createdAt);
  empty.classList.toggle('hidden', sorted.length > 0 || decisionShowArchive);
  const toggle = document.getElementById('decision-archive-toggle');
  toggle.classList.toggle('hidden', !archived && !decisionShowArchive);
  toggle.textContent = decisionShowArchive ? '← Zurück zu den aktuellen' : `Archiv (${archived})`;
  list.innerHTML = sorted.map(d => {
    const decided = !!d.decision.trim();
    const due = decisionReviewDue(d);
    const meta = [];
    if (due) meta.push('Rückblick fällig');
    if (d.importance != null) meta.push(DECISION_IMPORTANCE[d.importance]);
    if (d.dueDate && !decided) meta.push(`bis ${decisionFmtDate(d.dueDate)}`);
    if (decided) meta.push(`→ ${d.decision.trim().split('\n')[0]}`);
    if (d.review) meta.push(DECISION_REVIEW_RATINGS[d.review.rating]);
    return `<button type="button" class="decision-item${decided ? ' decision-item--done' : ''}${due ? ' decision-item--due' : ''}" data-id="${d.id}">
      <span class="decision-item-status">${due ? '🔁' : decided ? (d.forNow ? '⏳' : '✔') : '?'}</span>
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
      <button type="button" class="decision-pro-del" title="Entfernen" aria-label="Eintrag entfernen">✕</button>
    </div>`).join('');
  decisionRenderTally();
}

function decisionRenderTally() {
  const d = decisionCurrent();
  if (!d) return;
  const plus = d.pros.filter(p => p.sign === '+' && p.text.trim()).length;
  const minus = d.pros.filter(p => p.sign === '-' && p.text.trim()).length;
  document.getElementById('decision-pros-tally').textContent = (plus || minus) ? `${plus} Plus · ${minus} Minus` : '';
}

// Ein Blatt gilt als leer, wenn in KEINEM Feld etwas steht — dann wird es
// beim Schließen verworfen statt als Leiche in der Liste zu bleiben.
function decisionIsEmpty(d) {
  const texts = ['dilemma', 'best', 'worst', 'gut', 'gutConclusion', 'rationalConclusion', 'decision', 'nextSteps', 'dueDate'];
  return texts.every(k => !String(d[k] || '').trim())
    && d.importance == null && d.indecision == null
    && !d.bestPipe && !d.worstApoc && !d.forNow
    && !d.pros.some(p => p.text.trim())
    && !d.matrix.options.some(o => o.name.trim()) && !d.matrix.criteria.some(c => c.name.trim());
}

// ── Optionen-Matrix ──────────────────────────────────────
function decisionMatrixTotals(d) {
  const m = d.matrix;
  return m.options.map(o => m.criteria.reduce((sum, c) => sum + (Number(m.scores[`${o.id}|${c.id}`]) || 0) * (Number(c.weight) || 1), 0));
}

function renderDecisionMatrix() {
  const d = decisionCurrent();
  const box = document.getElementById('decision-matrix');
  if (!d || !box) return;
  const m = d.matrix;
  if (!m.options.length && !m.criteria.length) {
    box.innerHTML = '<div class="decision-steps-hint">Mehr als zwei Möglichkeiten? Lege Optionen und Kriterien an — Nook rechnet die gewichtete Summe aus.</div>';
    return;
  }
  const scoreSel = (o, c) => {
    const v = m.scores[`${o.id}|${c.id}`] ?? '';
    return `<select class="decision-matrix-score" data-o="${o.id}" data-c="${c.id}" aria-label="${escHtml(o.name || 'Option')} bei ${escHtml(c.name || 'Kriterium')}">
      <option value=""${v === '' ? ' selected' : ''}>–</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${Number(v) === n ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
  };
  box.innerHTML = `<div class="decision-matrix-wrap"><table class="decision-matrix-table">
    <thead><tr><th>Kriterium</th><th title="Gewichtung">×</th>${m.options.map(o => `<th><span class="decision-matrix-cell"><input type="text" class="decision-matrix-name" data-o="${o.id}" value="${escHtml(o.name)}" placeholder="Option" autocomplete="off"><button type="button" class="decision-pro-del" data-del-o="${o.id}" title="Option entfernen" aria-label="Option entfernen">✕</button></span></th>`).join('')}</tr></thead>
    <tbody>${m.criteria.map(c => `<tr>
      <td><span class="decision-matrix-cell"><input type="text" class="decision-matrix-name" data-c="${c.id}" value="${escHtml(c.name)}" placeholder="Kriterium" autocomplete="off"><button type="button" class="decision-pro-del" data-del-c="${c.id}" title="Kriterium entfernen" aria-label="Kriterium entfernen">✕</button></span></td>
      <td><select class="decision-matrix-weight" data-c="${c.id}" aria-label="Gewichtung">${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${Number(c.weight) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></td>
      ${m.options.map(o => `<td>${scoreSel(o, c)}</td>`).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="2">Summe</td>${m.options.map(o => `<td class="decision-matrix-total" data-total-o="${o.id}"></td>`).join('')}</tr></tfoot>
  </table></div>`;
  renderDecisionMatrixTotals();
}

function renderDecisionMatrixTotals() {
  const d = decisionCurrent();
  if (!d) return;
  const totals = decisionMatrixTotals(d);
  const best = Math.max(...totals, 0);
  d.matrix.options.forEach((o, i) => {
    const cell = document.querySelector(`#decision-matrix [data-total-o="${o.id}"]`);
    if (!cell) return;
    cell.textContent = totals[i];
    cell.classList.toggle('decision-matrix-total--best', best > 0 && totals[i] === best);
  });
}

// ── Zufallsrad: Namen kurz durchlaufen lassen, dann stehen bleiben ──
function decisionSpinWheel() {
  const d = decisionCurrent();
  const out = document.getElementById('decision-coin-result');
  const names = (d?.matrix.options || []).map(o => o.name.trim()).filter(Boolean);
  if (names.length < 2) { out.textContent = 'Erst mindestens 2 Optionen unter „Optionen vergleichen“ eintragen.'; return; }
  const pick = names[Math.floor(Math.random() * names.length)];
  if (typeof reduceMotion !== 'undefined' && reduceMotion) { out.textContent = `🎡 ${pick}`; return; }
  let i = 0, delay = 50;
  const step = () => {
    out.textContent = `🎡 ${names[i++ % names.length]}`;
    delay *= 1.18;
    if (delay < 320) setTimeout(step, delay);
    else out.textContent = `🎡 ${pick}`;
  };
  step();
}

// ── Rückblick ──
function renderDecisionReview() {
  const d = decisionCurrent();
  if (!d) return;
  const decided = !!d.decision.trim();
  document.getElementById('decision-review-box').classList.toggle('hidden', !decided && !d.archived);
  const sel = document.getElementById('decision-review-in');
  sel.value = '';
  const when = document.getElementById('decision-review-when');
  when.textContent = d.reviewAt ? (d.review ? `Rückblick am ${decisionFmtDate(d.review.at)}` : decisionReviewDue(d) ? 'Rückblick ist fällig' : `Rückblick am ${decisionFmtDate(d.reviewAt)}`) : '';
  const showRate = !!d.reviewAt && (d.reviewAt <= dateKey(new Date()) || !!d.review);
  document.getElementById('decision-review-rate').classList.toggle('hidden', !showRate);
  decisionRenderScale('decision-review-rating', DECISION_REVIEW_RATINGS, d.review ? d.review.rating : null);
  document.getElementById('decision-archived').checked = !!d.archived;
}

function openDecision(id) {
  const d = toolsDecisions.find(x => x.id === id);
  if (!d) return;
  decisionEditId = id;
  document.getElementById('decision-dilemma').value = d.dilemma;
  document.getElementById('decision-created').textContent = decisionFmtDate(d.createdAt ? dateKey(new Date(d.createdAt)) : '');
  document.getElementById('decision-due').value = d.dueDate || '';
  decisionEnsureFields(d);
  ['best', 'worst', 'gut', 'gutConclusion', 'rationalConclusion', 'decision', 'nextSteps', 'reviewNote'].forEach(k => {
    document.querySelector(`[data-decision-field="${k}"]`).value = d[k] || '';
  });
  document.getElementById('decision-best-pipe').checked = !!d.bestPipe;
  document.getElementById('decision-worst-apoc').checked = !!d.worstApoc;
  document.getElementById('decision-for-now').checked = !!d.forNow;
  decisionRenderScale('decision-importance', DECISION_IMPORTANCE, d.importance);
  decisionRenderScale('decision-indecision', DECISION_INDECISION, d.indecision);
  decisionRenderPros();
  renderDecisionMatrix();
  renderDecisionReview();
  document.getElementById('decision-coin-result').textContent = '';
  document.getElementById('decision-steps-hint').textContent = '';
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
    matrix: { options: [], criteria: [], scores: {} }, reviewNote: '',
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
  const wasDecided = !!d.decision.trim();
  Object.assign(d, patch);
  if (!wasDecided && d.decision.trim() && !d.decidedAt) d.decidedAt = Date.now();
  saveToolsDecisions();   // Liste wird erst beim Schließen neu gezeichnet
  if ('decision' in patch && wasDecided !== !!d.decision.trim()) renderDecisionReview();
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
      const d = decisionCurrent();
      if (d && decisionIsEmpty(d)) {
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
    decisionRenderTally();
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
  document.getElementById('decision-wheel-btn').addEventListener('click', decisionSpinWheel);

  // Optionen-Matrix
  const matrix = document.getElementById('decision-matrix');
  const addTo = (kind) => {
    const d = decisionCurrent();
    if (!d) return;
    const item = kind === 'options' ? { id: crypto.randomUUID(), name: '' } : { id: crypto.randomUUID(), name: '', weight: 3 };
    d.matrix[kind].push(item);
    // Leere Matrix: direkt zwei Optionen bzw. ein Kriterium dazu, damit eine Tabelle entsteht
    if (kind === 'options' && !d.matrix.criteria.length) d.matrix.criteria.push({ id: crypto.randomUUID(), name: '', weight: 3 });
    if (kind === 'criteria' && !d.matrix.options.length) d.matrix.options.push({ id: crypto.randomUUID(), name: '' }, { id: crypto.randomUUID(), name: '' });
    saveToolsDecisions();
    renderDecisionMatrix();
    matrix.querySelector(`[data-${kind === 'options' ? 'o' : 'c'}="${item.id}"].decision-matrix-name`)?.focus();
  };
  document.getElementById('decision-matrix-add-option').addEventListener('click', () => addTo('options'));
  document.getElementById('decision-matrix-add-criterion').addEventListener('click', () => addTo('criteria'));
  matrix.addEventListener('input', e => {
    const d = decisionCurrent();
    if (!d || !e.target.classList.contains('decision-matrix-name')) return;
    const item = e.target.dataset.o ? d.matrix.options.find(o => o.id === e.target.dataset.o) : d.matrix.criteria.find(c => c.id === e.target.dataset.c);
    if (item) { item.name = e.target.value; saveToolsDecisions(); }
  });
  matrix.addEventListener('change', e => {
    const d = decisionCurrent();
    if (!d) return;
    if (e.target.classList.contains('decision-matrix-score')) {
      const key = `${e.target.dataset.o}|${e.target.dataset.c}`;
      if (e.target.value) d.matrix.scores[key] = Number(e.target.value); else delete d.matrix.scores[key];
    } else if (e.target.classList.contains('decision-matrix-weight')) {
      const c = d.matrix.criteria.find(x => x.id === e.target.dataset.c);
      if (c) c.weight = Number(e.target.value);
    } else return;
    saveToolsDecisions();
    renderDecisionMatrixTotals();
  });
  matrix.addEventListener('click', e => {
    const d = decisionCurrent();
    const btn = e.target.closest('[data-del-o], [data-del-c]');
    if (!d || !btn) return;
    if (btn.dataset.delO) d.matrix.options = d.matrix.options.filter(o => o.id !== btn.dataset.delO);
    else d.matrix.criteria = d.matrix.criteria.filter(c => c.id !== btn.dataset.delC);
    Object.keys(d.matrix.scores).forEach(k => { if (k.includes(btn.dataset.delO || btn.dataset.delC)) delete d.matrix.scores[k]; });
    saveToolsDecisions();
    renderDecisionMatrix();
  });

  // Rückblick & Archiv
  document.getElementById('decision-review-in').addEventListener('change', e => {
    const d = decisionCurrent();
    if (!d || e.target.value === '') return;
    const at = new Date(); at.setDate(at.getDate() + Number(e.target.value));
    decisionUpdate({ reviewAt: dateKey(at) });
    renderDecisionReview();
  });
  document.getElementById('decision-review-rating').addEventListener('click', e => {
    const btn = e.target.closest('.decision-scale-btn');
    const d = decisionCurrent();
    if (!btn || !d) return;
    const rating = Number(btn.dataset.i);
    decisionUpdate({ review: d.review && d.review.rating === rating ? null : { rating, at: dateKey(new Date()) } });
    renderDecisionReview();
  });
  document.getElementById('decision-archived').addEventListener('change', e => decisionUpdate({ archived: e.target.checked }));
  document.getElementById('decision-archive-toggle').addEventListener('click', () => {
    decisionShowArchive = !decisionShowArchive;
    renderDecisionList();
  });

  // Nächste Schritte → Wochenaufgaben (über die Funktion von Heute, today.js)
  document.getElementById('decision-steps-to-tasks').addEventListener('click', () => {
    const d = decisionCurrent();
    const hint = document.getElementById('decision-steps-hint');
    if (!d || typeof addWeekTasksFromLines !== 'function') return;
    const n = addWeekTasksFromLines(d.nextSteps.split('\n'));
    hint.textContent = n ? `${n === 1 ? 'Eine Wochenaufgabe' : n + ' Wochenaufgaben'} angelegt ✓` : 'Erst nächste Schritte eintragen — eine Aufgabe pro Zeile.';
  });

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
    text: [d.best, d.worst, d.gut, d.nextSteps, d.reviewNote, ...d.pros.map(p => p.text), ...(d.matrix ? d.matrix.options.map(o => o.name) : [])].join(' '),
    open: () => { showView('tools'); toolsShowTool('decision'); openDecision(d.id); },
  })),
});
