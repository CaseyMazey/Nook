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

// ── Rendering ────────────────────────────────────────────────────────
function renderSparziele(){
  if (document.getElementById('budget-panel-sparziele')?.classList.contains('hidden')) return;
  if (typeof renderFinanzanalyse === 'function') renderFinanzanalyse();
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

  // Bewusst minimal — Kategorie/Beschreibung/Startdatum bleiben im
  // Bearbeiten-Modal editierbar, stehen aber nicht mehr auf der Karte.
  // Die ausführliche Erklärung übernimmt die Finanzanalyse (siehe
  // budget-analysis.js) — die Karte soll nicht dieselbe Geschichte
  // noch einmal erzählen.
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
    ${goal.eta ? `<div class="sp-plan-card-meta"><span>Wunsch: ${goal.eta}</span></div>` : ''}
    ${fundingLabel ? `<div class="sp-plan-card-meta"><span>💳 ${fundingLabel}</span></div>` : ''}
    <div class="sz-card-actions">
      <button class="sz-icon-btn" data-action="deposit" title="Einzahlen">+</button>
      <button class="sz-icon-btn" data-action="withdraw" title="Abheben">−</button>
      <button class="sp-add-btn sz-edit-pill" data-action="edit">✎ Bearbeiten</button>
    </div>`;

  card.querySelector('[data-action="deposit"]').addEventListener('click', () => openGoalTx(goal, 'deposit'));
  card.querySelector('[data-action="withdraw"]').addEventListener('click', () => openGoalTx(goal, 'withdraw'));
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditGoalModal(goal));

  return card;
}
