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

// Ein Sparziel gilt als "erfüllt", sobald der angesparte Betrag den
// Zielbetrag erreicht — steuert, ob der Archivieren-Button auf der Karte
// erscheint (siehe buildSparzielCard()).
function goalCompleted(goal){
  return goal.target > 0 && goal.current >= goal.target - 0.005;
}

// ── Archiv ───────────────────────────────────────────────────────────
// Archivieren blendet ein erfülltes Sparziel aus allen aktiven Ansichten
// aus (Finanzierungs-Grid hier, Übersicht-Liste in budget.js, Geldfluss-
// Board in budget-analysis.js, Sparprognose in budget-sparprognose.js),
// OHNE Daten zu löschen — jederzeit über das Archiv (Einstellungen-Button
// im Budget-Header, siehe budget.js) wieder rückgängig zu machen.
function archiveGoal(id){
  const g = budgetGoals.find(x => x.id === id);
  if (!g) return;
  g.archived = true;
  saveBudgetGoals();
  renderSparziele();
  if (typeof renderBudgetGoals === 'function') renderBudgetGoals();
  if (typeof renderFinanzgarten === 'function') renderFinanzgarten();
  if (typeof renderSparplaner === 'function') renderSparplaner();
}
function restoreGoal(id){
  const g = budgetGoals.find(x => x.id === id);
  if (!g) return;
  delete g.archived;
  saveBudgetGoals();
  renderSparziele();
  if (typeof renderBudgetGoals === 'function') renderBudgetGoals();
  if (typeof renderFinanzgarten === 'function') renderFinanzgarten();
  if (typeof renderSparplaner === 'function') renderSparplaner();
  if (typeof renderBudgetArchiv === 'function') renderBudgetArchiv();
}

// ── Rendering ────────────────────────────────────────────────────────
function renderSparziele(){
  // War vorher eine DOM-Klassen-Prüfung (classList.contains('hidden')) —
  // die konnte je nach Render-Reihenfolge noch den ALTEN Sichtbarkeits-
  // zustand sehen und lief dann fälschlich früh raus, sodass der
  // Geldfluss beim allerersten Öffnen des Tabs leer blieb (gemeldeter
  // Bug). budgetActiveSubtab wird in setBudgetSubtab() als Allererstes
  // gesetzt, bevor irgendein DOM angefasst wird — daher zuverlässiger.
  if (budgetActiveSubtab !== 'sparziele') return;
  if (typeof renderFinanzanalyse === 'function') renderFinanzanalyse();
  const grid = document.getElementById('sparziele-grid');
  if (!grid) return;
  grid.innerHTML = '';
  // Archivierte Sparziele gehören ins Archiv (siehe archiveGoal()), nicht
  // mehr in diese aktive Ansicht.
  const visibleGoals = budgetGoals.filter(g => !g.archived);
  if (!visibleGoals.length) {
    grid.innerHTML = '<div class="empty-state">Noch keine Sparziele. Starte mit „+ Sparziel".</div>';
    return;
  }
  visibleGoals.forEach(goal => grid.appendChild(buildSparzielCard(goal)));
}

function buildSparzielCard(goal){
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
  const emoji = PLANT_EMOJIS[goal.plantType] || '🌱';
  const hasItems = Array.isArray(goal.items) && goal.items.length > 0;
  const card = document.createElement('div'); card.className = 'sp-plan-card';

  // Bewusst minimal: Name, Priorität, Fortschritt, Wunschdatum — mehr
  // nicht. Kategorie/Beschreibung/Startdatum/Finanzierung bleiben im
  // Bearbeiten-Modal editierbar, stehen aber nicht mehr auf der Karte.
  // Die ausführliche Erklärung übernimmt vollständig die Finanzanalyse
  // (siehe budget-analysis.js) — die Karte soll nicht dieselbe
  // Geschichte noch einmal erzählen.
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
    ${(goal.eta || hasItems) ? `<div class="sp-plan-card-meta">
      ${goal.eta ? `<span>Wunsch: ${goal.eta}</span>` : ''}
      ${hasItems ? `<span>🧾 ${goal.items.length} Posten</span>` : ''}
    </div>` : ''}
    <div class="sz-card-actions">
      <button class="sz-icon-btn" data-action="deposit" title="Einzahlen">+</button>
      <button class="sz-icon-btn" data-action="withdraw" title="Abheben">−</button>
      ${goalCompleted(goal) ? '<button class="sz-icon-btn" data-action="archive" title="Archivieren">📦</button>' : ''}
      <button class="sp-add-btn sz-edit-pill" data-action="edit">✎ Bearbeiten</button>
    </div>`;

  card.querySelector('[data-action="deposit"]').addEventListener('click', () => openGoalTx(goal, 'deposit'));
  card.querySelector('[data-action="withdraw"]').addEventListener('click', () => openGoalTx(goal, 'withdraw'));
  card.querySelector('[data-action="archive"]')?.addEventListener('click', () => archiveGoal(goal.id));
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditGoalModal(goal));

  return card;
}
