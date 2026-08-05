// =========================
// BUDGET — FINANZANALYSE
// Kein Bericht, kein Datenausschnitt pro Ziel — die Analyse gruppiert
// nach BEDEUTUNG ("was kann ich sofort bezahlen", "was braucht
// Aufmerksamkeit") statt nach Objekt, und formuliert wo möglich einen
// konkreten, handlungsrelevanten Hinweis (💡) statt nur Zahlen zu
// wiederholen. Baut AUSSCHLIESSLICH auf bereits vorhandenen Funktionen
// auf — keine eigene Datenhaltung, keine neue Berechnung:
//   - goalMonthlyReserveEquivalent()               (budget-sparziele.js)
//   - financingFreeForIncome()/-WarningsForConsumer (budget-financing.js)
//   - fmtEuro()/round2()                            (budget.js)
// Die Sparziel-Karten selbst bleiben bewusst minimal (Name, Priorität,
// Fortschritt, Wunschtermin, eine Finanzierungszeile) — die Erklärung,
// WARUM das so ist, gehört ausschließlich hierher, nicht doppelt auf
// die Karte.
// Muss NACH budget-sparziele.js und budget-financing.js geladen werden.
// =========================

// ── Sparziele in Bedeutungs-Gruppen einsortieren ────────────────────
function categorizeGoalsForAnalysis(){
  const groups = { instant: [], monthly: [], attention: [] };
  budgetGoals.forEach(goal => {
    const funding = Array.isArray(goal.funding) ? goal.funding : [];
    const fundingTotal = round2(funding.reduce((s, f) => s + f.amount, 0));
    const monthlyNeed = goalMonthlyReserveEquivalent(goal);
    const remaining = round2(Math.max(0, goal.target - goal.current));
    const entry = { goal, funding, fundingTotal, monthlyNeed, remaining };

    if (!funding.length) {
      groups.attention.push(entry);
    } else if (monthlyNeed > 0.005) {
      groups.monthly.push(entry); // Überschuss/Fehlbetrag zeigt sich in der Zeile selbst
    } else if (round2(fundingTotal - remaining) >= -0.005) {
      groups.instant.push(entry);
    } else {
      groups.attention.push(entry); // Finanzierung vorhanden, reicht aber nicht
    }
  });
  return groups;
}

// ── Ein konkreter, handlungsrelevanter Hinweis statt reiner Zahlen ──
// Wählt das erste zutreffende Muster — max. EIN Satz, kein Aufzählen
// aller theoretisch möglichen Aussagen.
function buildGoalInsight(entry){
  const { goal, funding, fundingTotal, monthlyNeed, remaining } = entry;
  const sourceNames = funding.map(f => budgetRecurring.find(r => r.id === f.sourceId)?.name).filter(Boolean);

  // Höchste Priorität: eine genutzte Quelle ist inzwischen insgesamt
  // überplant (unabhängig davon, wodurch) — das betrifft den Nutzer
  // unmittelbar, bevor irgendetwas anderes relevant wird.
  for (const f of funding) {
    if (typeof financingFreeForIncome === 'function' && financingFreeForIncome(f.sourceId) < -0.005) {
      const rec = budgetRecurring.find(r => r.id === f.sourceId);
      return { icon: '⚠', text: `Dein ${rec ? rec.name : 'Einkommen'} ist bereits vollständig für andere Verpflichtungen eingeplant.` };
    }
  }

  if (monthlyNeed > 0.005) {
    const diff = round2(fundingTotal - monthlyNeed);
    if (diff >= -0.005 && funding.length === 1) {
      return { icon: '💡', text: `Wenn du dein ${sourceNames[0]} vollständig für dieses Ziel verwendest, bleiben dir monatlich noch ${fmtEuro(Math.max(0, diff))} übrig.` };
    }
    return null; // die Zahlenzeile in der "Monatliche Sparziele"-Gruppe reicht hier bereits
  }

  // Kein Monatsbedarf (kein Plan/Wunschtermin) und vollständig finanziert:
  if (funding.length === 1) {
    return { icon: '💡', text: `Dieses Ziel kannst du bereits mit deinem nächsten ${sourceNames[0]} bezahlen.` };
  }
  const linkedPlan = typeof sparplanForGoal === 'function' ? sparplanForGoal(goal.id) : null;
  if (!linkedPlan) {
    return { icon: '💡', text: `Du musst für dieses Ziel gar keinen langfristigen Sparplan anlegen.` };
  }
  return { icon: '💡', text: `Dieses Ziel ist vollständig über deine Finanzierungsquellen finanziert.` };
}

function renderGoalLine(entry, opts){
  const { goal, funding, fundingTotal, monthlyNeed, remaining } = entry;
  const emoji = PLANT_EMOJIS[goal.plantType] || '🌱';
  const el = document.createElement('div');
  el.className = 'fin-analysis-item';

  if (opts === 'instant') {
    const names = funding.map(f => budgetRecurring.find(r => r.id === f.sourceId)?.name).filter(Boolean).join(' + ');
    el.innerHTML = `
      <div class="fin-analysis-item-head">${emoji} ${goal.name} <span class="fin-analysis-item-amount">${fmtEuro(remaining)}</span></div>
      <div class="fin-analysis-item-line">→ kann komplett durch ${names || 'deine hinterlegte Finanzierung'} bezahlt werden.</div>`;
  } else if (opts === 'monthly') {
    const diff = round2(fundingTotal - monthlyNeed);
    const statusLine = diff >= -0.005
      ? `<div class="fin-analysis-item-line fin-analysis-item-line--ok">${diff > 0.005 ? `${fmtEuro(diff)} bleiben übrig` : 'genau gedeckt'}</div>`
      : `<div class="fin-analysis-item-line fin-analysis-item-line--warn">⚠ Es fehlen ${fmtEuro(Math.abs(diff))}/Monat</div>`;
    el.innerHTML = `
      <div class="fin-analysis-item-head">${emoji} ${goal.name}</div>
      <div class="fin-analysis-item-line">${fmtEuro(monthlyNeed)}/Monat nötig · ${fmtEuro(fundingTotal)}/Monat verfügbar</div>
      ${statusLine}`;
  } else { // attention
    const label = funding.length
      ? `Finanzierung reicht nicht — es fehlen ${fmtEuro(Math.abs(round2((monthlyNeed > 0.005 ? monthlyNeed : remaining) - fundingTotal)))}`
      : 'nutzt aktuell das allgemeine Sparpotenzial';
    el.innerHTML = `<div class="fin-analysis-item-head">${emoji} ${goal.name} <span class="fin-analysis-item-amount">${fmtEuro(remaining)}</span></div>
      <div class="fin-analysis-item-line fin-analysis-item-line--warn">${label}</div>`;
  }

  const insight = (opts === 'instant' || opts === 'monthly') ? buildGoalInsight(entry) : null;
  if (insight) {
    const insightEl = document.createElement('div');
    insightEl.className = `fin-analysis-insight${insight.icon === '⚠' ? ' fin-analysis-insight--warn' : ''}`;
    insightEl.textContent = `${insight.icon} ${insight.text}`;
    el.appendChild(insightEl);
  }
  return el;
}

// ── Ausgaben (wiederkehrend & einmalig) ─────────────────────────────
function renderExpenseLine(expense){
  const funding = Array.isArray(expense.funding) ? expense.funding : [];
  const el = document.createElement('div');
  el.className = 'fin-analysis-item';

  if (!funding.length) {
    el.innerHTML = `<div class="fin-analysis-item-head">${expense.name} <span class="fin-analysis-item-amount">${fmtEuro(expense.amount)}</span></div>
      <div class="fin-analysis-item-line fin-analysis-item-line--warn">läuft aus dem allgemeinen Budget</div>`;
    return el;
  }
  const assigned = round2(funding.reduce((s, f) => s + f.amount, 0));
  const diff = round2(assigned - expense.amount);
  const sourceLines = funding.map(f => {
    const rec = budgetRecurring.find(r => r.id === f.sourceId);
    const icon = typeof incomeIcon === 'function' ? incomeIcon(rec?.name) : '';
    return `<div class="fin-analysis-item-line">${icon} ${rec ? rec.name : '?'} ${fmtEuro(f.amount)}</div>`;
  }).join('');
  const statusLine = Math.abs(diff) < 0.005
    ? `<div class="fin-analysis-item-line fin-analysis-item-line--ok">✅ vollständig finanziert</div>`
    : diff > 0
      ? `<div class="fin-analysis-item-line fin-analysis-item-line--ok">✅ vollständig finanziert (${fmtEuro(diff)} Puffer)</div>`
      : `<div class="fin-analysis-item-line fin-analysis-item-line--warn">⚠ ${fmtEuro(Math.abs(diff))} fehlen</div>`;
  el.innerHTML = `<div class="fin-analysis-item-head">${expense.name} <span class="fin-analysis-item-amount">${fmtEuro(expense.amount)}</span></div>${sourceLines}${statusLine}`;
  return el;
}

// ── Rendering ────────────────────────────────────────────────────────
// ── Schulden ─────────────────────────────────────────────────────────
function renderDebtLine(debt){
  const remaining = debtRemaining(debt);
  const funding = Array.isArray(debt.funding) ? debt.funding : [];
  const el = document.createElement('div');
  el.className = 'fin-analysis-item';

  if (remaining <= 0.005) {
    el.innerHTML = `<div class="fin-analysis-item-head">💳 ${debt.name}</div>
      <div class="fin-analysis-item-line fin-analysis-item-line--ok">✅ Vollständig beglichen.</div>`;
    return el;
  }

  const sourcesHtml = funding.length
    ? funding.map(f => {
        const rec = budgetRecurring.find(r => r.id === f.sourceId);
        const icon = typeof incomeIcon === 'function' ? incomeIcon(rec?.name) : '';
        return `<div class="fin-analysis-item-line">${icon} ${rec ? rec.name : '?'} ${fmtEuro(f.amount)}</div>`;
      }).join('')
    : '';
  const statusHtml = funding.length
    ? '' // Betrag/Deckung ist bei Schulden weniger relevant als "wie viel noch offen" — keine zusaetzliche Ok/Warn-Zeile noetig
    : `<div class="fin-analysis-item-line fin-analysis-item-line--warn">nutzt aktuell das allgemeine Sparpotenzial</div>`;

  el.innerHTML = `<div class="fin-analysis-item-head">💳 ${debt.name} <span class="fin-analysis-item-amount">Restschuld ${fmtEuro(remaining)}</span></div>
    ${sourcesHtml}${statusHtml}`;
  return el;
}

// ── Rendering ────────────────────────────────────────────────────────
function renderFinanzanalyse(){
  const body = document.getElementById('finanzanalyse-body');
  if (!body) return;
  body.innerHTML = '';

  const groups = categorizeGoalsForAnalysis();
  const mk = budgetMonthKey(budgetMonth);
  const expenses = [
    ...budgetRecurring.filter(r => r.type === 'expense'),
    ...budgetOnetime.filter(e => e.type === 'expense' && e.monthKey === mk),
  ];
  const debts = Array.isArray(budgetDebts) ? budgetDebts : [];

  if (!budgetGoals.length && !expenses.length && !debts.length) {
    body.innerHTML = '<div class="empty-state">Noch keine Sparziele, Schulden oder Ausgaben zum Analysieren.</div>';
    return;
  }

  function section(title, entries, renderFn, opts){
    if (!entries.length) return;
    const sec = document.createElement('div');
    sec.className = 'fin-analysis-section';
    const head = document.createElement('div');
    head.className = 'fin-analysis-section-title';
    head.textContent = title;
    sec.appendChild(head);
    entries.forEach(e => sec.appendChild(renderFn(e, opts)));
    body.appendChild(sec);
  }

  section('✅ Sofort finanzierbar', groups.instant, renderGoalLine, 'instant');
  section('💰 Monatliche Sparziele', groups.monthly, renderGoalLine, 'monthly');
  section('⚠ Finanzierung fehlt', groups.attention, renderGoalLine, 'attention');
  section('💳 Schulden', debts, renderDebtLine);
  section('📦 Ausgaben', expenses, renderExpenseLine);

  if (!body.children.length) {
    body.innerHTML = '<div class="empty-state">Noch keine Sparziele, Schulden oder Ausgaben zum Analysieren.</div>';
  }
}
