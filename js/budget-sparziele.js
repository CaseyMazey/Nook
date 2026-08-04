// =========================
// BUDGET — SPARZIELE
// Zentraler Sub-Tab zwischen Budget und Sparprognose. Sparziele
// (budgetGoals, siehe budget.js) sind die EINZIGE Datenquelle für
// Name/Zielbetrag/Priorität/Kategorie/Beschreibung/Start- und
// Wunschdatum/Finanzierung/Reservierung. Sparprognose und Sparpläne
// lesen ausschließlich hier — sie legen selbst keine Sparziele mehr an
// und halten keine eigenen Kopien dieser Felder.
// Der geteilte Finanzierungs-Editor (renderFundingEditor/readFundingEditor)
// und die Reservierungs-Engine (sparplanTotalReserved/sparplanReservedForIncome)
// leben seit der "Jedem Euro einen Job"-Umstellung in budget-financing.js,
// das direkt NACH dieser Datei geladen wird ("Sparziel = Verbraucher" ist
// hier definiert, "Finanzierung" ist Engine-Zuständigkeit dort).
// Muss NACH budget.js geladen werden (siehe Reihenfolge in index.html).
// =========================

// Monats-Äquivalent des Betrags, den EIN Sparziel realistisch pro Monat
// braucht — dient als Vorschlags-/Referenzgröße im Finanzierungs-Editor
// (budget-financing.js: renderFundingEditor()), NICHT mehr als Basis der
// eigentlichen Reservierungsrechnung (die nutzt seit der Engine-Umstellung
// die tatsächlich vom Nutzer eingetragenen Beträge, siehe
// sparplanTotalReserved() in budget-financing.js):
// - besitzt das Ziel einen Sparplan, ist dessen Ratenrhythmus die
//   genaueste Quelle (sparplanMonthlyEquivalent(), budget-sparplaene.js)
// - ohne Sparplan wird der Restbetrag auf die Monate bis zum
//   Wunschtermin verteilt (Näherung); ohne Wunschtermin lässt sich
//   ohne weitere Angabe kein Monatsbetrag ableiten (dann 0)
function goalMonthlyReserveEquivalent(goal){
  const linkedPlan = typeof sparplanForGoal === 'function' ? sparplanForGoal(goal.id) : null;
  if (linkedPlan && typeof sparplanMonthlyEquivalent === 'function') {
    return sparplanMonthlyEquivalent(linkedPlan);
  }
  const remaining = round2(Math.max(0, goal.target - goal.current));
  if (remaining <= 0.005) return 0;
  if (goal.eta && typeof sparplanerMonthsUntil === 'function') {
    const etaDate = new Date((goal.eta.length === 7 ? goal.eta + '-01' : goal.eta) + 'T00:00:00');
    const months = Math.max(1, sparplanerMonthsUntil(etaDate));
    return round2(remaining / months);
  }
  return 0;
}

// ── Status-Zeile pro Sparziel-Karte ─────────────────────────────────
// Zeigt auf einen Blick, welche Funktionen für dieses Sparziel bereits
// eingerichtet sind. "Sparprognose aktiv" ist für jedes Sparziel immer
// wahr, da die Sparprognose seit dieser Umstellung automatisch ALLE
// Sparziele einbezieht (keine separate Aktivierung nötig).
function sparzielStatus(goal){
  const linkedPlan = typeof sparplanForGoal === 'function' ? sparplanForGoal(goal.id) : null;
  return {
    sparprognose: true,
    sparplan:  !!linkedPlan,
    funding:   Array.isArray(goal.funding) && goal.funding.length > 0,
    reserve:   !!goal.reserveActive,
  };
}
function sparzielStatusHtml(goal){
  const s = sparzielStatus(goal);
  const items = [
    ['Sparprognose aktiv', s.sparprognose],
    ['Sparplan vorhanden', s.sparplan],
    ['Finanzierungsquelle', s.funding],
    ['Reservierung aktiv', s.reserve],
  ];
  return items.map(([label, on]) =>
    `<span class="sz-status-chip${on ? ' sz-status-chip--on' : ''}">${on ? '✓' : '·'} ${label}</span>`
  ).join('');
}

// ── Rendering ────────────────────────────────────────────────────────
function renderSparziele(){
  if (document.getElementById('budget-panel-sparziele')?.classList.contains('hidden')) return;
  const grid = document.getElementById('sparziele-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!budgetGoals.length) {
    grid.innerHTML = '<div class="empty-state">Noch keine Sparziele. Starte mit „+ Sparziel".</div>';
    return;
  }
  budgetGoals.forEach(goal => grid.appendChild(buildSparzielCard(goal)));
}

function buildSparzielCard(goal){
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
  const emoji = PLANT_EMOJIS[goal.plantType] || '🌱';
  const card = document.createElement('div'); card.className = 'sp-plan-card';

  const metaParts = [];
  if (goal.category) metaParts.push(goal.category);
  if (goal.startDate) metaParts.push(`ab ${sparplanFormatDate(goal.startDate)}`);
  if (goal.eta) metaParts.push(`Wunsch: ${goal.eta}`);
  const fundingLabel = fundingBreakdownLabel(goal.funding);

  card.innerHTML = `
    <div class="sp-plan-card-head">
      <span class="sp-plan-card-name">${emoji} ${goal.name}</span>
      ${priorityBadge(goal.priority || 'need')}
    </div>
    <div class="budget-goal-bar sp-plan-bar"><div class="budget-goal-fill" style="width:${pct}%"></div></div>
    <div class="sp-plan-card-row">
      <span class="sp-plan-card-amounts">${fmtEuro(goal.current)} <span class="sp-plan-card-amounts-of">/ ${fmtEuro(goal.target)}</span></span>
      <span class="sp-plan-card-pct">${pct}%</span>
    </div>
    ${goal.description ? `<div class="sp-source-note" style="margin:4px 0 0;">${goal.description}</div>` : ''}
    ${metaParts.length ? `<div class="sp-plan-card-meta"><span>${metaParts.join(' · ')}</span></div>` : ''}
    ${fundingLabel ? `<div class="sp-plan-card-meta"><span>💳 ${fundingLabel}${goal.reserveActive ? ' (reserviert)' : ''}</span></div>` : ''}
    <div class="sz-status-row">${sparzielStatusHtml(goal)}</div>
    <div class="modal-actions" style="padding-top:8px;justify-content:flex-start;gap:6px;">
      <button class="btn-ghost sz-card-btn" data-action="deposit">Einzahlen</button>
      <button class="btn-ghost sz-card-btn" data-action="withdraw">Abheben</button>
      <button class="btn-ghost sz-card-btn" data-action="edit">Bearbeiten</button>
      <button class="btn-ghost sz-card-btn" data-action="delete">Löschen</button>
    </div>`;

  card.querySelector('[data-action="deposit"]').addEventListener('click', () => openGoalTx(goal, 'deposit'));
  card.querySelector('[data-action="withdraw"]').addEventListener('click', () => openGoalTx(goal, 'withdraw'));
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditGoalModal(goal));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => {
    if (!confirm(`Sparziel "${goal.name}" wirklich löschen?`)) return;
    budgetGoals = budgetGoals.filter(g => g.id !== goal.id);
    const activeId = DB.get('gardenActiveGoalId', null);
    if (activeId === goal.id) DB.set('gardenActiveGoalId', null);
    saveBudgetGoals();
    renderSparziele();
    renderBudgetGoals();
    renderFinanzgarten();
    if (typeof renderSparplaner === 'function') renderSparplaner();
  });

  return card;
}
