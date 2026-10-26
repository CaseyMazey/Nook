// =========================
// BUDGET — RATEN & SCHULDEN
// Bewusst getrennt von budgetGoals (budget-sparziele.js): eine Schuld
// wird GETILGT, nicht gespart. Strukturell fast identisch (Betrag,
// Fortschritt, Finanzierung — nutzt dieselbe Financing-Engine aus
// budget-financing.js), aber andere Sprache:
//   Zielbetrag      -> Ursprünglicher Betrag
//   Aktueller Betrag -> Bereits bezahlt
//   Einzahlen        -> Bezahlen
//   Sparziel erreicht -> Vollständig beglichen
// Muss NACH budget.js und budget-financing.js geladen werden.
// =========================

function debtRemaining(debt){
  return round2(Math.max(0, (debt.originalAmount || 0) - (debt.paidAmount || 0)));
}
function debtProgressPct(debt){
  if (!debt.originalAmount) return 0;
  return Math.min(100, Math.round(((debt.paidAmount || 0) / debt.originalAmount) * 100));
}
function debtSettled(debt){
  return debtRemaining(debt) <= 0.005;
}

// ── Archiv ───────────────────────────────────────────────────────────
// Siehe archiveGoal()/restoreGoal() in budget-sparziele.js — gleiches
// Prinzip, nur für vollständig beglichene Schulden.
function archiveDebt(id){
  const d = budgetDebts.find(x => x.id === id);
  if (!d) return;
  d.archived = true;
  saveBudgetDebts();
  renderSchulden();
  if (typeof renderFinanzanalyse === 'function') renderFinanzanalyse();
}
function restoreDebt(id){
  const d = budgetDebts.find(x => x.id === id);
  if (!d) return;
  delete d.archived;
  saveBudgetDebts();
  renderSchulden();
  if (typeof renderFinanzanalyse === 'function') renderFinanzanalyse();
  if (typeof renderBudgetArchiv === 'function') renderBudgetArchiv();
}

// ── Rendering ────────────────────────────────────────────────────────
function renderSchulden(){
  if (budgetActiveSubtab !== 'schulden') return;
  const grid = document.getElementById('schulden-grid');
  if (!grid) return;
  grid.innerHTML = '';
  // Archivierte Schulden gehören ins Archiv (siehe archiveDebt()), nicht
  // mehr in diese aktive Ansicht.
  const visibleDebts = budgetDebts.filter(d => !d.archived);
  if (!visibleDebts.length) {
    grid.innerHTML = '<div class="empty-state">Keine offenen Raten oder Schulden. Starte mit „+ Schuld".</div>';
    return;
  }
  visibleDebts.forEach(debt => grid.appendChild(buildDebtCard(debt)));
}

function buildDebtCard(debt){
  const remaining = debtRemaining(debt);
  const pct = debtProgressPct(debt);
  const settled = remaining <= 0.005;
  const fundingLabel = fundingBreakdownLabel(debt.funding);
  const card = document.createElement('div'); card.className = 'sp-plan-card';

  card.innerHTML = `
    <div class="sp-plan-card-head">
      <span class="sp-plan-card-name">💳 ${escHtml(debt.name)}</span>
      ${priorityBadge(debt.priority || 'need')}
    </div>
    <div class="budget-goal-bar sp-plan-bar"><div class="budget-goal-fill" style="width:${pct}%"></div></div>
    <div class="sp-plan-card-row">
      <span class="sp-plan-card-amounts">${settled ? 'Vollständig beglichen' : `Restschuld ${fmtEuro(remaining)}`}</span>
      <span class="sp-plan-card-pct">${pct}%</span>
    </div>
    ${debt.dueDate ? `<div class="sp-plan-card-meta"><span>Fällig: ${sparplanFormatDate(debt.dueDate)}</span></div>` : ''}
    ${fundingLabel ? `<div class="sp-plan-card-meta"><span>💳 ${fundingLabel}</span></div>` : ''}
    <div class="sz-card-actions">
      <button class="sz-icon-btn" data-action="pay" title="Bezahlen" ${settled ? 'disabled' : ''}>+</button>
      ${settled ? '<button class="sz-icon-btn" data-action="archive" title="Archivieren">📦</button>' : ''}
      <button class="sp-add-btn sz-edit-pill" data-action="edit">✎ Bearbeiten</button>
    </div>`;

  card.querySelector('[data-action="pay"]').addEventListener('click', () => openDebtTx(debt));
  card.querySelector('[data-action="archive"]')?.addEventListener('click', () => archiveDebt(debt.id));
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditDebtModal(debt));

  return card;
}
