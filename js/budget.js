// =========================
// BUDGET
// =========================

let budgetRecurring = DB.get('budgetRecurring', []);
let budgetOnetime   = DB.get('budgetOnetime', []);
let budgetGoals     = DB.get('budgetGoals', []);
let budgetMonth     = new Date();

// =========================
// SPARPLANER — UI-Zustand
// Reine Anzeige-/Interaktionseinstellungen. Alle Ein-/Ausgaben und
// Sparziele bleiben in budgetRecurring / budgetGoals — keine
// eigene Datenhaltung.
// =========================
let budgetActiveSubtab   = DB.get('budgetActiveSubtab', 'budget');       // 'budget' | 'sparplan' | 'sparplaene'
let sparplanerScenario   = DB.get('sparplanerScenario', 'real');         // 'garant' | 'real' | 'opt'
let sparplanerSimRate    = null;                                         // Was-wäre-wenn-Override, nur zur Laufzeit (nicht persistiert)
function saveSparplanerScenario(){ DB.set('sparplanerScenario', sparplanerScenario); }
function saveBudgetActiveSubtab(){ DB.set('budgetActiveSubtab', budgetActiveSubtab); }

// =========================
// KONTOSTAND — einfaches direktes Modell
// =========================
// kontostand = exakt der manuell eingegebene Wert.
// Beim Abhaken einer Buchung wird kontostand direkt angepasst und gespeichert.
// Keine Formelberechnung aus erledigten Buchungen.
// =========================

let kontostand = DB.get('kontostand', null);

function saveKontostand() { DB.set('kontostand', kontostand); }

function saveBudgetRecurring(){ DB.set('budgetRecurring', budgetRecurring); }
function saveBudgetOnetime(){   DB.set('budgetOnetime',   budgetOnetime);   }
function saveBudgetGoals(){     DB.set('budgetGoals',     budgetGoals);     }

// Migration: add missing fields to existing entries
function migrateBudgetData() {
  let changed = false, goalsChanged = false;
  budgetRecurring.forEach(r => {
    if (!r.priority) { r.priority = 'need'; changed = true; }
    // Additiv für den Sparplaner: Sicherheit (fest/variabel) + Sonderfall-Einbeziehung.
    // Bestehende Einträge ohne diese Felder gelten als "fest" / "einbezogen" —
    // dadurch bleibt jede bisherige Berechnung (Liquidität, Kontostand, ...) unverändert.
    if (!r.certainty) { r.certainty = 'fixed'; changed = true; }
    if (r.includeInSparplan === undefined) { r.includeInSparplan = true; changed = true; }
  });
  budgetOnetime.forEach(e => {
    if (!e.priority) { e.priority = 'need'; changed = true; }
    if (e.paid === undefined) { e.paid = false; changed = true; }
  });
  budgetGoals.forEach(g => {
    if (g.eta === undefined) { g.eta = null; goalsChanged = true; }
  });
  if (changed) { saveBudgetRecurring(); saveBudgetOnetime(); }
  if (goalsChanged) { saveBudgetGoals(); }
}
migrateBudgetData();

// =========================
// HELPERS
// =========================

function budgetMonthKey(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
function budgetMonthLabel(date){
  return date.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
}
function priorityLabel(p) {
  if (p === 'must') return 'Muss';
  if (p === 'want') return 'Möchte';
  return 'Brauche';
}
function priorityClass(p) {
  if (p === 'must') return 'budget-badge-must';
  if (p === 'want') return 'budget-badge-want';
  return 'budget-badge-need';
}
function priorityBadge(p) {
  return `<span class="budget-badge ${priorityClass(p)}">${priorityLabel(p)}</span>`;
}

function recurringPaidKey(id, mk) { return `rec_paid_${id}_${mk}`; }
function isRecurringPaid(id, mk)   { return DB.get(recurringPaidKey(id, mk), false); }
function setRecurringPaid(id, mk, val) { DB.set(recurringPaidKey(id, mk), val); }

// =========================
// SPARPLANER — BERECHNUNGEN
// Arbeitet ausschließlich mit budgetRecurring / budgetGoals.
// Keine Werte sind hardcodiert — alles wird aus den echten
// Budget-Daten abgeleitet und aktualisiert sich automatisch,
// sobald sich diese Daten ändern (renderSparplaner() wird nach
// jeder Änderung erneut aufgerufen, wie überall sonst in Nook).
// =========================

// Rundet exakt auf Cent — verhindert Fließkomma-Artefakte
// (z.B. 268.29999999999995 oder Anzeige mit 3 statt 2 Nachkommastellen)
function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

// Bandbreite eines Postens: bei "variabel" varMin/varMax, sonst
// fällt beides auf den festen Betrag zurück (sichere Defaults).
function sparplanerRange(r) {
  if (r.certainty === 'variable') {
    const min = typeof r.varMin === 'number' ? r.varMin : r.amount;
    const max = typeof r.varMax === 'number' ? r.varMax : r.amount;
    return { min: round2(Math.min(min, max)), max: round2(Math.max(min, max)), avg: round2((min + max) / 2) };
  }
  return { min: r.amount, max: r.amount, avg: r.amount };
}

// Gruppiert die wiederkehrenden Posten für den Sparplaner:
// monatliche Posten nach Sicherheit (fest/variabel), jährliche
// Posten gelten als "Sonderfälle". Ausgeschlossene Posten
// (includeInSparplan === false) werden komplett ignoriert.
function sparplanerBuckets() {
  const active = budgetRecurring.filter(r => r.includeInSparplan !== false);
  const monthly = active.filter(r => r.freq === 'monthly');
  const yearly  = active.filter(r => r.freq === 'yearly');
  return {
    fixedIncome:  monthly.filter(r => r.type === 'income'  && r.certainty !== 'variable'),
    fixedExpense: monthly.filter(r => r.type === 'expense' && r.certainty !== 'variable'),
    varIncome:    monthly.filter(r => r.type === 'income'  && r.certainty === 'variable'),
    varExpense:   monthly.filter(r => r.type === 'expense' && r.certainty === 'variable'),
    sonderIncome: yearly.filter(r => r.type === 'income'),
    sonderExpense:yearly.filter(r => r.type === 'expense'),
  };
}

// Monatliche Sparrate für ein Szenario.
// WICHTIG: Sonderfälle (jährliche Posten) fließen bewusst NICHT in
// die Sparrate ein — sie sind unregelmäßig und würden die Formel
// verfälschen. Sie werden separat und transparent im Bereich
// "Einnahmen & Ausgaben" ausgewiesen. Die Formel entspricht exakt:
//   Garantiert   = Summe fester Posten
//   Realistisch  = Garantiert + Ø(variable Posten)
//   Optimistisch = Garantiert + Bestfall(variable Posten)
function sparplanerScenarioRate(scenario) {
  const b = sparplanerBuckets();
  const sum = arr => arr.reduce((s, r) => s + r.amount, 0);
  const fixedNet = round2(sum(b.fixedIncome) - sum(b.fixedExpense));

  if (scenario === 'garant') return fixedNet;

  if (scenario === 'real') {
    const varIncomeAvg  = round2(b.varIncome.reduce((s, r) => s + sparplanerRange(r).avg, 0));
    const varExpenseAvg = round2(b.varExpense.reduce((s, r) => s + sparplanerRange(r).avg, 0));
    return round2(fixedNet + varIncomeAvg - varExpenseAvg);
  }

  // Optimistisch: maximale variable Einnahmen, minimale variable Ausgaben
  const varIncomeMax = round2(b.varIncome.reduce((s, r) => s + sparplanerRange(r).max, 0));
  const varExpenseMin = round2(b.varExpense.reduce((s, r) => s + sparplanerRange(r).min, 0));
  return round2(fixedNet + varIncomeMax - varExpenseMin);
}

// Liefert die einzelnen Bestandteile einer Szenario-Berechnung —
// für die sichtbare "Rechenweg"-Anzeige, damit jeder Wert
// nachvollziehbar bleibt.
function sparplanerScenarioBreakdown(scenario) {
  const b = sparplanerBuckets();
  const sum = arr => arr.reduce((s, r) => s + r.amount, 0);
  const fixedNet = round2(sum(b.fixedIncome) - sum(b.fixedExpense));
  if (scenario === 'garant') return { fixedNet, varNet: 0, total: fixedNet };

  const key = scenario === 'real' ? 'avg' : 'max';
  const expKey = scenario === 'real' ? 'avg' : 'min';
  const varIncome = round2(b.varIncome.reduce((s, r) => s + sparplanerRange(r)[key], 0));
  const varExpense = round2(b.varExpense.reduce((s, r) => s + sparplanerRange(r)[expKey], 0));
  const varNet = round2(varIncome - varExpense);
  return { fixedNet, varNet, total: round2(fixedNet + varNet) };
}

function sparplanerAllRates() {
  return {
    garant: sparplanerScenarioRate('garant'),
    real:   sparplanerScenarioRate('real'),
    opt:    sparplanerScenarioRate('opt'),
  };
}

// ETA-Simulation — arbeitet exakt nach dem vorgegebenen Algorithmus:
// Jeden Monat kommt die volle Sparrate dazu und wird strikt nach
// Priorität verteilt. Ein Ziel bekommt erst dann Geld, wenn alle
// Ziele mit höherer Priorität vollständig finanziert sind. Bleibt in
// einem Monat nach Erreichen eines Ziels noch Geld übrig, fließt der
// Rest SOFORT (im selben Monat) ins nächste Ziel — kein Monat wird
// verschenkt.
function sparplanerETAs(monthlyRate) {
  const n = budgetGoals.length;
  const remaining = budgetGoals.map(g => round2(Math.max(0, g.target - g.current)));
  const results = new Array(n).fill(null);
  const now = new Date(); now.setDate(1); now.setHours(0, 0, 0, 0);

  // Bereits erreichte Ziele sofort markieren (kein Sparen nötig)
  remaining.forEach((r, i) => { if (r <= 0.005) results[i] = { months: 0, date: new Date(now) }; });

  const rate = round2(monthlyRate || 0);
  if (rate <= 0) {
    return budgetGoals.map((g, i) => results[i]
      ? { goal: g, reached: true, months: 0, date: results[i].date }
      : { goal: g, reached: false, months: Infinity, date: null });
  }

  const MAX_MONTHS = 1200; // Sicherheitsgrenze: 100 Jahre
  let month = 0;
  while (results.includes(null) && month < MAX_MONTHS) {
    month++;
    let pool = rate;
    for (let i = 0; i < n && pool > 0.005; i++) {
      if (remaining[i] <= 0.005) continue; // dieses Ziel ist schon voll finanziert
      const take = Math.min(pool, remaining[i]);
      remaining[i] = round2(remaining[i] - take);
      pool = round2(pool - take);
      if (remaining[i] <= 0.005 && results[i] === null) {
        const d = new Date(now); d.setMonth(d.getMonth() + month);
        results[i] = { months: month, date: d };
      }
      // Übrig gebliebener "pool" wandert in derselben Schleife (also
      // demselben Monat) automatisch zum nächsten Ziel weiter.
    }
  }

  return budgetGoals.map((g, i) => {
    if (results[i]) return { goal: g, reached: results[i].months === 0, months: results[i].months, date: results[i].date };
    return { goal: g, reached: false, months: Infinity, date: null }; // Sparrate reicht nicht innerhalb 100 Jahren
  });
}

function sparplanerFormatEtaDate(date) {
  if (!date) return '–';
  return date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
}

// Vergleich der berechneten ETA mit dem vom Nutzer gesetzten Wunschtermin
function sparplanerCompareEta(goal, computedDate) {
  if (!goal.eta) return null;
  const [y, m] = goal.eta.split('-').map(Number);
  const wishDate = new Date(y, (m || 1) - 1, 1);
  if (!computedDate) return { diffMonths: -Infinity };
  const diffMonths = (wishDate.getFullYear() - computedDate.getFullYear()) * 12
                    + (wishDate.getMonth() - computedDate.getMonth());
  return { diffMonths };
}

// =========================
// CENTRAL PROJECTION
// Alle Berechnungen basieren auf dem berechneten kontostand
// und den offenen (nicht bezahlten) Buchungen.
// =========================

function calcMonthProjection() {
  if (kontostand === null) return null;

  const now            = new Date();
  const todayDay       = now.getDate();
  const curMonth       = now.getMonth() + 1;
  const curYear        = now.getFullYear();
  const curMk          = budgetMonthKey(now);
  const curRecItems    = getMonthRecurringItems(curYear, curMonth);

  // Offene (nicht erledigte) Buchungen dieses Monats
  let pendingIncome  = 0;
  let pendingExpense = 0;
  curRecItems.forEach(item => {
    if (!isRecurringPaid(item.id, curMk)) {
      if (item.type === 'income') pendingIncome  += item.amount;
      else                        pendingExpense += item.amount;
    }
  });
  budgetOnetime.filter(e => e.monthKey === curMk && !e.paid).forEach(e => {
    if (e.type === 'income') pendingIncome  += e.amount;
    else                     pendingExpense += e.amount;
  });

  // Monatsende-Prognose: aktueller Kontostand + alle noch offenen Buchungen
  const endOfMonth = kontostand + pendingIncome - pendingExpense;

  // --- Nächster Monat ---
  const nextMonthDate  = new Date(curYear, now.getMonth() + 1, 1);
  const nextMonth      = nextMonthDate.getMonth() + 1;
  const nextYear       = nextMonthDate.getFullYear();
  const nextItems      = getMonthRecurringItems(nextYear, nextMonth);
  const nextIncomes    = nextItems.filter(i => i.type === 'income').sort((a,b) => a.day - b.day);
  const nextExpenses   = nextItems.filter(i => i.type === 'expense');
  const firstIncomeDay = nextIncomes.length > 0 ? nextIncomes[0].day : 31;
  const expensesBefore = nextExpenses.filter(i => i.day < firstIncomeDay);

  const byPrio = {
    must: expensesBefore.filter(i => i.priority === 'must').reduce((s,i) => s+i.amount, 0),
    need: expensesBefore.filter(i => i.priority === 'need').reduce((s,i) => s+i.amount, 0),
    want: expensesBefore.filter(i => i.priority === 'want').reduce((s,i) => s+i.amount, 0),
  };
  const totalBeforeSalary = byPrio.must + byPrio.need + byPrio.want;
  const gap               = endOfMonth - totalBeforeSalary;
  const canAfford         = gap >= 0;

  const afterMust   = endOfMonth - byPrio.must;
  const afterNeed   = afterMust  - byPrio.need;
  const afterWant   = afterNeed  - byPrio.want;
  const mustCovered = afterMust >= 0;
  const needCovered = afterNeed >= 0;
  const wantCovered = afterWant >= 0;

  const openMust = curRecItems
    .filter(i => i.type === 'expense' && i.priority === 'must' && !isRecurringPaid(i.id, curMk))
    .reduce((s, i) => s + i.amount, 0)
    + budgetOnetime
      .filter(e => e.monthKey === curMk && e.type === 'expense' && e.priority === 'must' && !e.paid)
      .reduce((s, e) => s + e.amount, 0);

  return {
    kontostand, pendingIncome, pendingExpense, endOfMonth,
    nextMonthDate, firstIncomeDay, expensesBefore,
    byPrio, totalBeforeSalary, gap, canAfford,
    afterMust, afterNeed, afterWant,
    mustCovered, needCovered, wantCovered,
    openMust,
  };
}

function getMonthRecurringItems(year, month) {
  return budgetRecurring.filter(r => {
    if (r.freq === 'monthly') return true;
    if (r.freq === 'yearly')  return r.dateMonth === month;
    return false;
  }).map(r => {
    const day = r.freq === 'monthly' ? r.day : r.dateDay;
    return { id: r.id, name: r.name, type: r.type, amount: r.amount, day, priority: r.priority || 'need' };
  });
}

// =========================
// FINANCIAL STATUS
// Basiert auf offenem Kontostand (bereits erledigt = bereits verbucht)
// =========================

function calcFinancialStatus(mk) {
  if (kontostand === null) return null;
  // mk = budgetMonthKey des aktuell angezeigten Monats
  const useMk = mk || budgetMonthKey(new Date());
  const useYear  = parseInt(useMk.slice(0,4));
  const useMonth = parseInt(useMk.slice(5,7));
  const curRecItems = getMonthRecurringItems(useYear, useMonth);

  // Offene Ausgaben nach Priorität — NUR type === 'expense', NUR nicht bezahlt
  const openByPrio = { must: 0, need: 0, want: 0 };
  curRecItems
    .filter(i => i.type === 'expense' && !isRecurringPaid(i.id, useMk))
    .forEach(i => {
      const p = i.priority || 'need';
      if (p === 'must' || p === 'need' || p === 'want') openByPrio[p] += i.amount;
    });
  budgetOnetime
    .filter(e => e.monthKey === useMk && e.type === 'expense' && !e.paid)
    .forEach(e => {
      const p = e.priority || 'need';
      if (p === 'must' || p === 'need' || p === 'want') openByPrio[p] += e.amount;
    });

  // Kumulative Deckungsprüfung: Kontostand → Muss → Rest → Brauche → Rest → Möchte
  const afterMust   = kontostand - openByPrio.must;
  const afterNeed   = afterMust  - openByPrio.need;
  const afterWant   = afterNeed  - openByPrio.want;
  const mustCovered = afterMust >= 0;
  const needCovered = mustCovered && afterNeed >= 0;
  const wantCovered = needCovered && afterWant >= 0;

  let status;
  if (!mustCovered)       status = 'red';
  else if (!needCovered)  status = 'orange';
  else if (!wantCovered)  status = 'yellow';
  else                    status = 'green';

  const fmt = v => Math.abs(v).toLocaleString('de-DE', {minimumFractionDigits:2});

  const checks = [];
  if (mustCovered) {
    checks.push({ icon: '✓', iconClass: 'ok',      label: 'Muss gedeckt' });
  } else {
    checks.push({ icon: '✗', iconClass: 'bad',     label: `Muss nicht gedeckt — fehlen ${fmt(afterMust)} €` });
  }
  if (!mustCovered) {
    checks.push({ icon: '–', iconClass: 'neutral', label: 'Brauche nicht auswertbar' });
  } else if (needCovered) {
    checks.push({ icon: '✓', iconClass: 'ok',      label: 'Brauche gedeckt' });
  } else {
    checks.push({ icon: '✗', iconClass: 'bad',     label: `Brauche nicht gedeckt — fehlen ${fmt(afterNeed)} €` });
  }
  if (!mustCovered || !needCovered) {
    checks.push({ icon: '–', iconClass: 'neutral', label: 'Möchte nicht auswertbar' });
  } else if (wantCovered) {
    checks.push({ icon: '✓', iconClass: 'ok',      label: 'Möchte gedeckt' });
  } else {
    checks.push({ icon: '⚠', iconClass: 'warn',   label: `Möchte nicht gedeckt — fehlen ${fmt(afterWant)} €` });
  }

  let hint;
  const restAfterAll = afterWant;
  if (status === 'green') {
    hint = restAfterAll > 0
      ? { text: `Alle Ausgaben gedeckt. Puffer: +${fmt(restAfterAll)} €`, type: 'good' }
      : { text: 'Alle Ausgaben sind gedeckt.', type: 'good' };
  } else if (status === 'yellow') {
    hint = { text: `Pflicht- und Brauche-Ausgaben gesichert. Für optionale Ausgaben fehlen ${fmt(afterWant)} €.`, type: 'warn' };
  } else if (status === 'orange') {
    hint = { text: `Brauche-Ausgaben nicht vollständig gedeckt. Fehlbetrag: ${fmt(afterNeed)} €`, type: 'bad' };
  } else {
    hint = { text: `Muss-Ausgaben nicht gedeckt. Fehlbetrag: ${fmt(afterMust)} €`, type: 'bad' };
  }

  return { status, mustCovered, needCovered, wantCovered, checks, hint,
           openMust: openByPrio.must, openNeed: openByPrio.need, openWant: openByPrio.want,
           afterMust, afterNeed, afterWant };
}

function renderFinancialStatus(fs) {
  // Update kontostand display in new card layout
  const ksDisplay = document.getElementById('b-ks-display');
  if (ksDisplay) {
    if (kontostand === null) {
      ksDisplay.textContent = '—';
      ksDisplay.className = 'b-ks-value';
    } else {
      ksDisplay.textContent = (kontostand >= 0 ? '+' : '') + kontostand.toFixed(2) + ' €';
      ksDisplay.className = 'b-ks-value' + (kontostand < 0 ? ' negative' : '');
    }
  }

  const statusInner = document.getElementById('b-status-inner');
  if (!statusInner) return;

  if (!fs) {
    statusInner.innerHTML = '<div class="b-status-header"><span class="b-status-dot" style="background:#ccc"></span><span class="b-status-text">Kontostand nicht gesetzt</span></div>';
    return;
  }

  const labels   = { green: 'Stabil', yellow: 'Eingeschränkt', orange: 'Aufpassen', red: 'Kritisch' };
  const dotColor = { green: '#5A9C28', yellow: '#D4A010', orange: '#D46010', red: '#C03020' };

  // Render checks — each item already contains its own icon, class and label from calcFinancialStatus
  const checkHtml = fs.checks.map(c => `
    <div class="b-check-item">
      <span class="b-check-icon ${c.iconClass}">${c.icon}</span>
      <span>${c.label}</span>
    </div>`).join('');

  // Hint — single consistent sentence derived from the same data
  const hintHtml = fs.hint
    ? `<div class="b-status-hint ${fs.hint.type === 'bad' ? 'bad' : fs.hint.type === 'warn' ? 'warn' : ''}">${fs.hint.text}</div>`
    : '';

  statusInner.innerHTML = `
    <div class="b-status-header">
      <span class="b-status-dot" style="background:${dotColor[fs.status]}"></span>
      <span class="b-status-text">Status: <strong>${labels[fs.status]}</strong></span>
    </div>
    <div class="b-checklist">${checkHtml}</div>
    ${hintHtml}`;
}

// =========================
// RENDER BUDGET — HAUPTFUNKTION
// =========================

function renderBudget() {
  const now    = new Date();
  const curMk  = budgetMonthKey(budgetMonth);

  document.getElementById('budget-month-label').textContent = budgetMonthLabel(budgetMonth);

  renderKontostandHeader();
  renderMainCards(budgetMonth, curMk);
  renderFinancialStatus(calcFinancialStatus(curMk));
  renderOnetimeList(curMk);
  renderRecurringList(curMk);
  renderBudgetTimeline();
  renderBudgetGoals();
  renderLiquidity();
  renderFinanzgarten();
  initSummaryCardToggles();
  initCardInlineToggles();
  initBudgetSubtabs();
  renderSparplaner();
}

// =========================
// BUDGET / SPARPROGNOSE / SPARPLÄNE — SUB-TAB-UMSCHALTER
// Wechselt nur den Inhalt innerhalb von #view-budget. Header,
// Sidebar und die restliche Nook-Navigation bleiben unberührt.
// Registry-Muster: neue Sub-Tabs werden künftig einfach als
// weiterer Eintrag ergänzt, ohne diese Funktionen anzufassen.
// =========================
const BUDGET_SUBTABS = [
  { tab: 'budget',     panelId: 'budget-panel-budget',     btnId: 'budget-subtab-btn-budget' },
  { tab: 'sparplan',   panelId: 'budget-panel-sparplan',   btnId: 'budget-subtab-btn-sparplan' },
  { tab: 'sparplaene', panelId: 'budget-panel-sparplaene', btnId: 'budget-subtab-btn-sparplaene' },
];

function applyBudgetSubtabVisibility(tab) {
  BUDGET_SUBTABS.forEach(({ tab: t, panelId, btnId }) => {
    const panel = document.getElementById(panelId);
    const btn   = document.getElementById(btnId);
    if (panel) panel.classList.toggle('hidden', t !== tab);
    if (btn)   btn.classList.toggle('active', t === tab);
  });
  // "Gespart bis..."-Zusatzrechnung gehört ausschließlich zur Sparprognose
  const savedByBtn = document.getElementById('sparplan-savedby-btn');
  if (savedByBtn) savedByBtn.classList.toggle('hidden', tab !== 'sparplan');
}

function setBudgetSubtab(tab) {
  budgetActiveSubtab = tab;
  saveBudgetActiveSubtab();
  applyBudgetSubtabVisibility(tab);
  if (tab === 'sparplan')   renderSparplaner();
  if (tab === 'sparplaene') renderSparplaene();
}

function initBudgetSubtabs() {
  BUDGET_SUBTABS.forEach(({ tab, btnId }) => {
    const btn = document.getElementById(btnId);
    if (btn && !btn._subtabBound) {
      btn._subtabBound = true;
      btn.addEventListener('click', () => setBudgetSubtab(tab));
    }
  });
  // Gespeicherten Zustand einmalig anwenden (ohne renderSparplaner erneut zu triggern)
  if (!initBudgetSubtabs._applied) {
    initBudgetSubtabs._applied = true;
    applyBudgetSubtabVisibility(budgetActiveSubtab);
  }
}

function renderKontostandHeader() {
  const valEl = document.getElementById('b-ks-header-value');
  if (!valEl) return;
  if (kontostand === null) {
    valEl.textContent = 'nicht gesetzt';
    valEl.className = 'b-ks-pill-value';
  } else {
    valEl.textContent = (kontostand >= 0 ? '+' : '') + kontostand.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
    valEl.className = 'b-ks-pill-value ' + (kontostand < 0 ? 'negative' : 'positive');
  }
  const btn = document.getElementById('budget-ks-header-btn');
  if (btn && !btn._ksBound) {
    btn._ksBound = true;
    btn.addEventListener('click', openKontostandModal);
  }
}

function renderMainCards(month, mk) {
  const recIncomes  = getMonthRecurringItems(month.getFullYear(), month.getMonth()+1).filter(i => i.type === 'income');
  const otIncomes   = budgetOnetime.filter(e => e.monthKey === mk && e.type === 'income');
  const recExpenses = getMonthRecurringItems(month.getFullYear(), month.getMonth()+1).filter(i => i.type === 'expense');
  const otExpenses  = budgetOnetime.filter(e => e.monthKey === mk && e.type === 'expense');

  function makeClickableRow(day, monthNum, name, amount, sign, paid, onToggle) {
    const el = document.createElement('div');
    el.className = 'b-main-row b-main-row-clickable' + (paid ? ' b-main-row-paid' : '');
    el.title = paid ? 'Als offen markieren' : 'Als erledigt markieren';
    el.innerHTML = `
      <span class="b-main-row-day">${String(day).padStart(2,'0')}.${String(monthNum).padStart(2,'0')}</span>
      <span class="b-main-row-name">${name}</span>
      <span class="b-main-row-check">${paid ? '✓' : ''}</span>
      <span class="b-main-row-amount ${sign === '+' ? 'income' : 'expense'}">${sign}${amount.toFixed(2)} €</span>`;
    el.addEventListener('click', onToggle);
    return el;
  }

  // ── KARTE 1: Einnahmen ───
  const incomeList  = document.getElementById('b-income-list');
  const incomeTotal = document.getElementById('b-income-total');
  incomeList.innerHTML = '';
  let openIncome = 0;

  const allIncomeRows = [];
  recIncomes.forEach(i => allIncomeRows.push({
    day: i.day||1, name: i.name, amount: i.amount,
    paid: isRecurringPaid(i.id, mk),
    onToggle: () => {
      const nowPaid = !isRecurringPaid(i.id, mk);
      setRecurringPaid(i.id, mk, nowPaid);
      kontostand = (kontostand || 0) + (nowPaid ? i.amount : -i.amount);
      saveKontostand();
      renderBudget();
    }
  }));
  otIncomes.forEach(e => allIncomeRows.push({
    day: e.day||1, name: e.name, amount: e.amount,
    paid: e.paid||false,
    onToggle: () => {
      e.paid = !e.paid;
      kontostand = (kontostand || 0) + (e.paid ? e.amount : -e.amount);
      saveKontostand();
      saveBudgetOnetime();
      renderBudget();
    }
  }));
  allIncomeRows.sort((a,b) => a.day - b.day);

  if (!allIncomeRows.length) {
    incomeList.innerHTML = '<div class="b-main-empty">Keine Einnahmen in diesem Monat.</div>';
  } else {
    allIncomeRows.forEach(row => {
      if (!row.paid) openIncome += row.amount;
      incomeList.appendChild(makeClickableRow(row.day, month.getMonth()+1, row.name, row.amount, '+', row.paid, row.onToggle));
    });
  }
  const fmtOpenIn = openIncome.toLocaleString('de-DE',{minimumFractionDigits:2});
  incomeTotal.innerHTML = `<span class="b-main-total-label">Offen</span><span class="b-main-total-value income">+${fmtOpenIn} €</span>`;
  const incSum = document.getElementById('b-income-summary-val');
  if (incSum) incSum.textContent = '+' + fmtOpenIn + ' €';

  // ── KARTE 2: Ausgaben ───
  const expenseList  = document.getElementById('b-expense-list');
  const expenseTotal = document.getElementById('b-expense-total');
  expenseList.innerHTML = '';
  let openExpTotal = 0;

  const PRIO_GROUPS = [
    {key:'must', icon:'🔴', label:'Muss'},
    {key:'need', icon:'🟡', label:'Brauche'},
    {key:'want', icon:'🟢', label:'Möchte'},
  ];

  const buildExpRows = pk => {
    const rows = [];
    recExpenses.filter(i=>(i.priority||'need')===pk).forEach(i=>rows.push({
      day:i.day||1, name:i.name, amount:i.amount,
      paid: isRecurringPaid(i.id, mk),
      onToggle: () => {
        const nowPaid = !isRecurringPaid(i.id, mk);
        setRecurringPaid(i.id, mk, nowPaid);
        kontostand = (kontostand || 0) + (nowPaid ? -i.amount : i.amount);
        saveKontostand();
        renderBudget();
      }
    }));
    otExpenses.filter(e=>(e.priority||'need')===pk).forEach(e=>rows.push({
      day:e.day||1, name:e.name, amount:e.amount,
      paid: e.paid||false,
      onToggle: () => {
        e.paid = !e.paid;
        kontostand = (kontostand || 0) + (e.paid ? -e.amount : e.amount);
        saveKontostand();
        saveBudgetOnetime();
        renderBudget();
      }
    }));
    return rows.sort((a,b)=>a.day-b.day);
  };

  let hasExp = false;
  PRIO_GROUPS.forEach(({key,icon,label})=>{
    const rows = buildExpRows(key); if(!rows.length) return; hasExp = true;
    const gh = document.createElement('div'); gh.className = 'b-main-group-head';
    gh.innerHTML = `<span>${icon}</span><span>${label}</span>`;
    expenseList.appendChild(gh);
    rows.forEach(row=>{
      if (!row.paid) openExpTotal += row.amount;
      expenseList.appendChild(makeClickableRow(row.day, month.getMonth()+1, row.name, row.amount, '-', row.paid, row.onToggle));
    });
  });

  if(!hasExp) expenseList.innerHTML = '<div class="b-main-empty">Keine Ausgaben in diesem Monat.</div>';
  const fmtOpenOut = openExpTotal.toLocaleString('de-DE',{minimumFractionDigits:2});
  expenseTotal.innerHTML = `<span class="b-main-total-label">Offen</span><span class="b-main-total-value expense">-${fmtOpenOut} €</span>`;
  const expSum = document.getElementById('b-expense-summary-val');
  if (expSum) expSum.textContent = '-' + fmtOpenOut + ' €';

  // ── KARTE 3: Verfügbar — zeigt dieselbe Prioritätsberechnung wie der Status ───
  const freeContent = document.getElementById('b-free-content');
  const freeSummary = document.getElementById('b-free-summary-val');
  freeContent.innerHTML = '';

  if (kontostand === null) {
    freeContent.innerHTML = '<div class="b-main-empty" style="padding:12px 0;">Kein Kontostand gesetzt.</div>';
    if (freeSummary) { freeSummary.textContent = '—'; freeSummary.className = 'b-mcs-value'; }
  } else {
    // Dieselbe Berechnung wie calcFinancialStatus — nach Priorität kaskadierend
    const openMust = recExpenses.filter(i=>i.priority==='must'&&!isRecurringPaid(i.id,mk)).reduce((s,i)=>s+i.amount,0)
                   + otExpenses.filter(e=>e.priority==='must'&&!e.paid).reduce((s,e)=>s+e.amount,0);
    const openNeed = recExpenses.filter(i=>(i.priority||'need')==='need'&&!isRecurringPaid(i.id,mk)).reduce((s,i)=>s+i.amount,0)
                   + otExpenses.filter(e=>(e.priority||'need')==='need'&&!e.paid).reduce((s,e)=>s+e.amount,0);
    const openWant = recExpenses.filter(i=>i.priority==='want'&&!isRecurringPaid(i.id,mk)).reduce((s,i)=>s+i.amount,0)
                   + otExpenses.filter(e=>e.priority==='want'&&!e.paid).reduce((s,e)=>s+e.amount,0);
    const openAll  = openMust + openNeed + openWant;

    const afterMust = kontostand - openMust;
    const afterNeed = afterMust  - openNeed;
    const afterWant = afterNeed  - openWant;
    const vbl       = afterWant;
    const fmt = v => v.toLocaleString('de-DE',{minimumFractionDigits:2});
    const fmtAbs = v => Math.abs(v).toLocaleString('de-DE',{minimumFractionDigits:2});

    // Prioritätszeilen
    const mustRow = openMust > 0
      ? `<div class="b-free-prio-row">
           <span class="b-free-prio-dot must"></span>
           <span class="b-free-prio-label">Nach Pflichtausgaben</span>
           <span class="b-free-prio-amt">-${fmt(openMust)} €</span>
           <span class="b-free-prio-after ${afterMust>=0?'ok':'bad'}">${afterMust>=0?'+'+fmt(afterMust):'-'+fmtAbs(afterMust)} €</span>
         </div>` : '';
    const needRow = openNeed > 0
      ? `<div class="b-free-prio-row">
           <span class="b-free-prio-dot need"></span>
           <span class="b-free-prio-label">Nach Brauche-Ausgaben</span>
           <span class="b-free-prio-amt">-${fmt(openNeed)} €</span>
           <span class="b-free-prio-after ${afterMust<0?'neutral':afterNeed>=0?'ok':'bad'}">${afterMust<0?'–':afterNeed>=0?'+'+fmt(afterNeed):'-'+fmtAbs(afterNeed)} €</span>
         </div>` : '';
    const wantRow = openWant > 0
      ? `<div class="b-free-prio-row">
           <span class="b-free-prio-dot want"></span>
           <span class="b-free-prio-label">Saldo nach allen Ausgaben</span>
           <span class="b-free-prio-amt">-${fmt(openWant)} €</span>
           <span class="b-free-prio-after ${(afterMust<0||afterNeed<0)?'neutral':afterWant>=0?'ok':'bad'}">${(afterMust<0||afterNeed<0)?'–':afterWant>=0?'+'+fmt(afterWant):'-'+fmtAbs(afterWant)} €</span>
         </div>` : '';

    freeContent.innerHTML = `
      <div class="b-free-row">
        <span class="b-free-label">Kontostand</span>
        <span class="b-free-val ${kontostand<0?'expense':''}">${kontostand<0?'':'+'}${fmt(kontostand)} €</span>
      </div>
      ${mustRow}${needRow}${wantRow}
      <div class="b-free-divider"></div>
      <div class="b-free-row b-free-row-total">
        <span class="b-free-label-big">Verbleibend</span>
        <span class="b-free-val-big ${vbl<0?'expense':'income'}">${vbl<0?'-':'+'}${fmtAbs(vbl)} €</span>
      </div>`;

    if (freeSummary) {
      freeSummary.textContent = (vbl<0?'-':'+')+fmtAbs(vbl)+' €';
      freeSummary.className = 'b-mcs-value '+(vbl<0?'expense':'income');
    }
  }
}

// =========================
// COMPACT SUMMARY CARD TOGGLES — unified group
// Alle drei Karten öffnen/schließen gleichzeitig.
// Zustand wird in localStorage gespeichert.
// =========================

const MAIN_CARDS_OPEN_KEY = 'budgetMainCardsOpen';

function setMainCardsOpen(open) {
  const details = ['bmc-income-detail','bmc-expense-detail','bmc-free-detail'];
  const arrows  = document.querySelectorAll('.b-main-card-summary .b-mcs-arrow');
  details.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = open ? 'block' : 'none';
  });
  arrows.forEach(a => { a.textContent = open ? '▲' : '▼'; });
  DB.set(MAIN_CARDS_OPEN_KEY, open);
}

function initSummaryCardToggles() {
  // Apply saved state (default: closed)
  const isOpen = DB.get(MAIN_CARDS_OPEN_KEY, false);
  setMainCardsOpen(isOpen);

  document.querySelectorAll('.b-main-card-summary').forEach(btn => {
    if (btn._summaryBound) return;
    btn._summaryBound = true;
    btn.addEventListener('click', () => {
      const currentlyOpen = DB.get(MAIN_CARDS_OPEN_KEY, false);
      setMainCardsOpen(!currentlyOpen);
    });
  });
}

// =========================
// INLINE CARD CONTENT TOGGLES — persistent state, default collapsed
// =========================

const CARD_OPEN_KEYS = {
  'budget-recurring-list': 'budgetCardOpen_recurring',
  'budget-onetime-list':   'budgetCardOpen_onetime',
  'budget-goals-list':     'budgetCardOpen_goals',
};

function initCardInlineToggles() {
  document.querySelectorAll('.b-card-toggle-btn').forEach(btn => {
    if (btn._cardToggleBound) return;
    btn._cardToggleBound = true;

    const targetId  = btn.dataset.target;
    const storageKey = CARD_OPEN_KEYS[targetId] || null;

    // Apply saved state (default: collapsed = false)
    const isOpen = storageKey ? DB.get(storageKey, false) : false;
    const list   = document.getElementById(targetId);
    const arrow  = btn.querySelector('.b-card-arrow');
    if (list)  list.style.display  = isOpen ? 'block' : 'none';
    if (arrow) arrow.textContent   = isOpen ? '▼' : '▶';

    btn.addEventListener('click', () => {
      const nowOpen = list.style.display === 'none';
      list.style.display = nowOpen ? 'block' : 'none';
      if (arrow) arrow.textContent = nowOpen ? '▼' : '▶';
      if (storageKey) DB.set(storageKey, nowOpen);
    });
  });
}

// =========================
// ONE-TIME LIST
// =========================

function renderOnetimeList(mk) {
  const onetimeList = document.getElementById('budget-onetime-list');
  onetimeList.innerHTML = '';
  const otEntries = budgetOnetime.filter(e => e.monthKey === mk);
  if (!otEntries.length) { onetimeList.innerHTML = '<div class="empty-state">Keine einmaligen Buchungen in diesem Monat.</div>'; return; }
  function renderOtGroup(entries, type) {
    if (!entries.length) return;
    const header = document.createElement('div'); header.className = 'b-section-label';
    header.innerHTML = `<span class="b-section-dot ${type}"></span>${type==='income'?'Einnahmen':'Ausgaben'}`;
    onetimeList.appendChild(header);
    entries.forEach(e => {
      onetimeList.appendChild(makeBudgetRow({
        name:e.name, amount:e.amount, type:e.type, priority:e.priority||'need', paid:e.paid||false,
        onDel: ()=>{ budgetOnetime=budgetOnetime.filter(x=>x.id!==e.id); saveBudgetOnetime(); renderBudget(); },
        onPaidToggle: ()=>{
          const nowPaid = !e.paid; e.paid = nowPaid;
          kontostand = (kontostand || 0) + (nowPaid ? (e.type==='income' ? e.amount : -e.amount) : (e.type==='income' ? -e.amount : e.amount));
          saveKontostand(); saveBudgetOnetime(); renderBudget();
        }
      }));
    });
  }
  renderOtGroup(otEntries.filter(e=>e.type==='income'), 'income');
  renderOtGroup(otEntries.filter(e=>e.type==='expense'),'expense');
}

// =========================
// RECURRING LIST
// =========================

function renderRecurringList(mk) {
  const prioOrder = {must:0,need:1,want:2,none:1};
  function sortByPrioDay(arr) {
    return arr.slice().sort((a,b)=>{
      const pa=prioOrder[a.priority]??1, pb=prioOrder[b.priority]??1;
      if(pa!==pb) return pa-pb;
      const da=a.freq==='monthly'?(a.day||1):(a.dateDay||1);
      const db=b.freq==='monthly'?(b.day||1):(b.dateDay||1);
      return da-db;
    });
  }
  const allRecIncomes    = sortByPrioDay(budgetRecurring.filter(r=>r.type==='income'));
  const allRecExpMonthly = sortByPrioDay(budgetRecurring.filter(r=>r.type==='expense'&&r.freq==='monthly'));
  const allRecExpYearly  = sortByPrioDay(budgetRecurring.filter(r=>r.type==='expense'&&r.freq==='yearly'));
  const recList = document.getElementById('budget-recurring-list');
  recList.innerHTML = '';
  if (!budgetRecurring.length) { recList.innerHTML = '<div class="empty-state">Noch keine wiederkehrenden Posten.</div>'; return; }

  function renderRecSubgroup(entries, type, headerLabel, sumLabel, freqOverride) {
    if (!entries.length) return;
    const header = document.createElement('div'); header.className = 'b-section-label';
    const dotCls = type==='income'?'income':(freqOverride==='yearly'?'expense-yearly':'expense');
    header.innerHTML = `<span class="b-section-dot ${dotCls}"></span>${headerLabel}`;
    recList.appendChild(header);
    entries.forEach(r => {
      const recPaid = isRecurringPaid(r.id, mk);
      const freqChip = r.freq==='monthly'
        ? `<span class="b-freq-chip monthly">Monatlich</span>`
        : `<span class="b-freq-chip yearly">J\u00e4hrlich \u00b7 ${r.dateDay}.${String(r.dateMonth).padStart(2,'0')}.</span>`;
      recList.appendChild(makeBudgetRow({
        name:r.name, amount:r.amount, type:r.type, priority:r.priority||'need', paid:recPaid, subtitleHtml:freqChip,
        onEdit: ()=>openRecurringModal(r),
        onDel:  ()=>{ budgetRecurring=budgetRecurring.filter(x=>x.id!==r.id); saveBudgetRecurring(); renderBudget(); },
        onPaidToggle: ()=>{
          const np = !recPaid; setRecurringPaid(r.id, mk, np);
          kontostand = (kontostand || 0) + (np ? (r.type==='income' ? r.amount : -r.amount) : (r.type==='income' ? -r.amount : r.amount));
          saveKontostand(); renderBudget();
        }
      }));
    });
    const total=entries.reduce((s,r)=>s+r.amount,0);
    const sumRow=document.createElement('div');
    sumRow.className='b-sum-row'+(freqOverride==='yearly'?' b-sum-row-yearly':'');
    sumRow.innerHTML=`<span class="b-sum-label">${sumLabel}</span><span class="b-sum-value ${type==='income'?'income':'expense'}">${type==='income'?'+':'-'}${total.toLocaleString('de-DE',{minimumFractionDigits:2})} \u20ac</span>`;
    recList.appendChild(sumRow);
  }
  renderRecSubgroup(allRecIncomes,   'income', 'Einnahmen','Summe Einnahmen',null);
  renderRecSubgroup(allRecExpMonthly,'expense','Monatliche Fixkosten','Monatliche Gesamtkosten','monthly');
  renderRecSubgroup(allRecExpYearly, 'expense','J\u00e4hrliche Sonderkosten','J\u00e4hrliche Sonderkosten','yearly');
}


// =========================
// LIQUIDITY FORECAST
// Uses calcMonthProjection() — same data as the status bar above.
// =========================

function renderLiquidity() {
  const container = document.getElementById('budget-liquidity');
  container.innerHTML = '';

  // Update kontostand adjust button binding (the button is in the static HTML)
  const ksBtn = document.getElementById('kontostand-edit-btn');
  if (ksBtn) ksBtn.addEventListener('click', openKontostandModal);

  const proj = calcMonthProjection();

  // If no kontostand set, show prompt inside liquidity area
  if (kontostand === null) {
    container.innerHTML = `
      <div class="b-liquidity-card" style="align-items:center;justify-content:center;min-height:180px;">
        <div style="text-align:center;">
          <div class="b-liq-title" style="margin-bottom:12px;">Liquiditätsvorschau</div>
          <p style="font-size:13px;color:var(--b-warm-gray);margin-bottom:16px;">Kein Kontostand gesetzt.</p>
          <button class="budget-action-btn outlined" onclick="openKontostandModal()">Kontostand eingeben</button>
        </div>
      </div>`;
    return;
  }

  if (!proj || budgetRecurring.length === 0) {
    container.innerHTML = `
      <div class="b-liquidity-card" style="min-height:180px;">
        <div class="b-liq-header">
          <span class="b-liq-title">Liquiditätsvorschau</span>
        </div>
        <p style="font-size:13px;color:var(--b-warm-gray);padding:8px 0;">Keine wiederkehrenden Buchungen vorhanden.</p>
      </div>`;
    return;
  }

  const {
    pendingIncome, pendingExpense, endOfMonth,
    nextMonthDate, firstIncomeDay, expensesBefore,
    byPrio, totalBeforeSalary, gap, canAfford,
  } = proj;

  const now = new Date();

  const card = document.createElement('div');
  card.className = 'b-liquidity-card' + (canAfford ? '' : ' warn');

  // Expenses before salary grouped by priority
  const expenseGroupHTML = ['must','need','want'].map(prio => {
    const items = expensesBefore.filter(i => i.priority === prio);
    if (!items.length) return '';
    return items.map(i => `
      <div class="b-liq-expense-item">
        <span>${i.name} ${priorityBadge(i.priority)}</span>
        <span class="expense">-${i.amount.toLocaleString('de-DE',{minimumFractionDigits:2})} €</span>
      </div>`).join('');
  }).join('');

  const nextMonthName = nextMonthDate.toLocaleDateString('de-DE', {month:'long'});

  card.innerHTML = `
    <div class="b-liq-header">
      <span class="b-liq-title">Liquiditätsvorschau &middot; ${nextMonthName}</span>
      <span class="b-liq-badge ${canAfford ? 'ok' : 'warn'}">${canAfford ? '✓ Ausreichend' : '⚠ Puffer fehlt'}</span>
    </div>
    <div class="b-liq-row">
      <span class="b-liq-row-label">Du startest mit</span>
      <span class="b-liq-row-value ${endOfMonth >= 0 ? 'income' : 'expense'}">${endOfMonth >= 0 ? '+' : ''}${endOfMonth.toLocaleString('de-DE',{minimumFractionDigits:2})} €</span>
    </div>
    <div class="b-liq-row">
      <span class="b-liq-row-label">Ausgaben vor ${firstIncomeDay > 28 ? 'Monatsende' : 'Tag ' + firstIncomeDay} (vor Gehalt)</span>
      <span class="b-liq-row-value expense">-${totalBeforeSalary.toLocaleString('de-DE',{minimumFractionDigits:2})} €</span>
    </div>
    ${expenseGroupHTML ? `<div class="b-liq-expense-list">${expenseGroupHTML}</div>` : ''}
    <div class="b-liq-divider"></div>
    <div class="b-liq-total-row">
      <span class="b-liq-total-label">${canAfford ? 'Puffer nach Ausgaben' : 'Fehlender Betrag'}</span>
      <span class="b-liq-total-value ${canAfford ? 'income' : 'expense'}">${canAfford ? '+' : ''}${gap.toLocaleString('de-DE',{minimumFractionDigits:2})} €</span>
    </div>`;

  container.appendChild(card);
}

// =========================
// FINANZGARTEN
// =========================

// =============================================================
// FINANZBAUM — eigene konfigurierbare Wachstumsstufen
// Standardwerte; überschreibbar per Modal → localStorage
// =============================================================

const FINANZBAUM_DEFAULT_LEVELS = [
  { min: 0,    label: 'Münze im Boden', stage: 'seed'        },
  { min: 250,  label: 'Geldspross',     stage: 'sprout'      },
  { min: 500,  label: 'Münzpflanze',    stage: 'small_plant' },
  { min: 1000, label: 'Kleiner Geldbaum', stage: 'medium_plant'},
  { min: 2000, label: 'Großer Geldbaum',  stage: 'large_plant' },
  { min: 3000, label: 'Blühender Geldbaum', stage: 'flowering' },
];

// Lädt konfigurierte Stufen aus localStorage, oder Defaults
function getTreeLevels() {
  const saved = DB.get('finanzbaumLevels', null);
  if (!saved || !Array.isArray(saved) || saved.length !== 6) return FINANZBAUM_DEFAULT_LEVELS;
  // Merge saved mins with fixed labels/stages
  return FINANZBAUM_DEFAULT_LEVELS.map((def, i) => ({
    ...def,
    min: typeof saved[i] === 'number' ? saved[i] : def.min,
  }));
}

function getTreeStage(ks) {
  const levels = getTreeLevels();
  if (ks === null || ks < 0) return levels[0];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (ks >= levels[i].min) return levels[i];
  }
  return levels[0];
}

// Alias für Mini-Bar-Rendering (braucht alle Level)
function getGardenTreeLevels() { return getTreeLevels(); }

// =============================================================
// FINANZBAUM SVGs — 6 eigene Stufen, Münzbaum-Thema
// Erkennbar: Münzen als Blätter/Früchte, goldene Akzente
// Stil: cozy, handgezeichnet, klar anders als Sparziel-Pflanzen
// =============================================================

const FINANZBAUM_SVGS = {
  seed:    `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="gc" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFE870"/><stop offset="50%" stop-color="#F5C518"/><stop offset="100%" stop-color="#C07C00"/></radialGradient></defs>
<ellipse cx="40" cy="68" rx="22" ry="6" fill="#C8A058" opacity=".3"/>
<path d="M22 65 Q40 57 58 65 Q48 72 40 73 Q32 72 22 65Z" fill="#B8883A"/>
<path d="M26 64 Q40 57 54 64 Q45 70 40 71 Q35 70 26 64Z" fill="#C89848"/>
<ellipse cx="40" cy="57" rx="11" ry="3.5" fill="#9A7020" opacity=".32"/>
<circle cx="40" cy="49" r="12" fill="url(#gc)"/>
<circle cx="40" cy="49" r="9.5" fill="none" stroke="#C8A010" stroke-width="1.2" opacity=".5"/>
<text x="40" y="53.5" text-anchor="middle" font-size="11" fill="#8A6008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="35" cy="44" rx="3.5" ry="2" fill="white" opacity=".4" transform="rotate(-25 35 44)"/>
<path d="M30 59 Q40 54 50 59 L50 64 Q40 68 30 64Z" fill="#B8883A"/>
</svg>`,
  sprout:    `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="gc" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFE870"/><stop offset="50%" stop-color="#F5C518"/><stop offset="100%" stop-color="#C07C00"/></radialGradient></defs>
<ellipse cx="40" cy="70" rx="20" ry="5" fill="#C8A058" opacity=".28"/>
<path d="M24 67 Q40 59 56 67 Q47 73 40 74 Q33 73 24 67Z" fill="#B8883A"/>
<path d="M28 66 Q40 59 52 66 Q44 72 40 73 Q36 72 28 66Z" fill="#C89848"/>
<path d="M40 65 Q39 55 40 38" stroke="#5A9C28" stroke-width="3.5" stroke-linecap="round" fill="none"/>
<path d="M39 54 Q29 50 27 41 Q36 40 39 50" fill="#6AA83A"/>
<path d="M41 50 Q51 46 53 37 Q44 36 41 46" fill="#7AC840" opacity=".9"/>
<circle cx="40" cy="34" r="9" fill="url(#gc)"/>
<circle cx="40" cy="34" r="7" fill="none" stroke="#C8A010" stroke-width="1" opacity=".5"/>
<text x="40" y="38" text-anchor="middle" font-size="7.5" fill="#8A6008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="35" cy="29" rx="2.8" ry="1.6" fill="white" opacity=".42" transform="rotate(-20 35 29)"/>
</svg>`,
  small_plant:    `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
<radialGradient id="gc" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFE870"/><stop offset="50%" stop-color="#F5C518"/><stop offset="100%" stop-color="#C07C00"/></radialGradient>
<radialGradient id="gl" cx="40%" cy="30%" r="70%"><stop offset="0%" stop-color="#90D855"/><stop offset="100%" stop-color="#4A9020"/></radialGradient>
</defs>
<ellipse cx="40" cy="71" rx="21" ry="5.5" fill="#C8A058" opacity=".28"/>
<path d="M22 68 Q40 60 58 68 Q48 74 40 75 Q32 74 22 68Z" fill="#B8883A"/>
<path d="M26 67 Q40 60 54 67 Q46 73 40 74 Q34 73 26 67Z" fill="#C89848"/>
<path d="M40 67 Q39 57 40 44" stroke="#4A8820" stroke-width="4" stroke-linecap="round" fill="none"/>
<path d="M39 57 Q26 52 24 42 Q35 40 39 52" fill="url(#gl)"/>
<path d="M41 52 Q54 47 56 37 Q45 35 41 47" fill="url(#gl)" opacity=".88"/>
<path d="M39 47 Q29 39 31 29 Q40 29 39 40" fill="url(#gl)" opacity=".8"/>
<path d="M41 43 Q51 35 53 25 Q43 25 41 36" fill="url(#gl)" opacity=".8"/>
<line x1="39" y1="56" x2="25" y2="49" stroke="#4A8820" stroke-width="2" stroke-linecap="round"/>
<circle cx="22" cy="47" r="9" fill="url(#gc)"/>
<circle cx="22" cy="47" r="7" fill="none" stroke="#D0A808" stroke-width="1" opacity=".52"/>
<text x="22" y="51" text-anchor="middle" font-size="7.5" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="17" cy="42" rx="2.8" ry="1.6" fill="white" opacity=".4" transform="rotate(-22 17 42)"/>
<line x1="41" y1="51" x2="55" y2="44" stroke="#4A8820" stroke-width="2" stroke-linecap="round"/>
<circle cx="58" cy="42" r="9" fill="url(#gc)"/>
<circle cx="58" cy="42" r="7" fill="none" stroke="#D0A808" stroke-width="1" opacity=".52"/>
<text x="58" y="46" text-anchor="middle" font-size="7.5" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="53" cy="37" rx="2.8" ry="1.6" fill="white" opacity=".4" transform="rotate(-22 53 37)"/>
<circle cx="40" cy="26" r="10" fill="url(#gc)"/>
<circle cx="40" cy="26" r="7.5" fill="none" stroke="#D0A808" stroke-width="1" opacity=".52"/>
<text x="40" y="30.5" text-anchor="middle" font-size="8" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="34" cy="21" rx="3.2" ry="1.8" fill="white" opacity=".42" transform="rotate(-22 34 21)"/>
</svg>`,
  medium_plant:    `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
<radialGradient id="gc" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFE870"/><stop offset="50%" stop-color="#F5C518"/><stop offset="100%" stop-color="#C07C00"/></radialGradient>
<radialGradient id="gk" cx="40%" cy="30%" r="70%"><stop offset="0%" stop-color="#90D855"/><stop offset="100%" stop-color="#3A8010"/></radialGradient>
<radialGradient id="gt" cx="30%" cy="20%" r="80%"><stop offset="0%" stop-color="#C8924A"/><stop offset="100%" stop-color="#7A4A18"/></radialGradient>
</defs>
<ellipse cx="40" cy="73" rx="24" ry="6" fill="#C8A058" opacity=".28"/>
<path d="M19 69 Q40 60 61 69 Q50 77 40 78 Q30 77 19 69Z" fill="#B8883A"/>
<path d="M23 68 Q40 61 57 68 Q47 75 40 76 Q33 75 23 68Z" fill="#C89848"/>
<path d="M39 68 Q37 57 38 45 Q39 35 40 25" stroke="url(#gt)" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M41 68 Q40 57 40 45 Q40 35 41 25" stroke="#C8924A" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".38"/>
<path d="M38 52 Q26 47 21 37" stroke="url(#gt)" stroke-width="4.5" stroke-linecap="round" fill="none"/>
<path d="M40 46 Q53 41 57 31" stroke="url(#gt)" stroke-width="4.5" stroke-linecap="round" fill="none"/>
<path d="M39 38 Q29 30 30 20" stroke="url(#gt)" stroke-width="3.5" stroke-linecap="round" fill="none"/>
<path d="M41 34 Q50 26 51 16" stroke="url(#gt)" stroke-width="3.5" stroke-linecap="round" fill="none"/>
<ellipse cx="18" cy="32" rx="14" ry="10" fill="url(#gk)" opacity=".88"/>
<ellipse cx="60" cy="27" rx="13" ry="10" fill="url(#gk)" opacity=".88"/>
<ellipse cx="26" cy="16" rx="13" ry="9" fill="url(#gk)" opacity=".88"/>
<ellipse cx="40" cy="12" rx="16" ry="10" fill="url(#gk)"/>
<ellipse cx="52" cy="14" rx="11" ry="8" fill="url(#gk)" opacity=".85"/>
<ellipse cx="24" cy="26" rx="6" ry="3.5" fill="#F0C820" opacity=".68" transform="rotate(-28 24 26)"/>
<ellipse cx="54" cy="21" rx="6" ry="3.5" fill="#F0C820" opacity=".68" transform="rotate(26 54 21)"/>
<circle cx="15" cy="28" r="9" fill="url(#gc)"/>
<circle cx="15" cy="28" r="7" fill="none" stroke="#D0A808" stroke-width="1" opacity=".55"/>
<text x="15" y="32.5" text-anchor="middle" font-size="7.5" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="9" cy="23" rx="2.8" ry="1.6" fill="white" opacity=".42" transform="rotate(-22 9 23)"/>
<circle cx="63" cy="23" r="9" fill="url(#gc)"/>
<circle cx="63" cy="23" r="7" fill="none" stroke="#D0A808" stroke-width="1" opacity=".55"/>
<text x="63" y="27.5" text-anchor="middle" font-size="7.5" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="57" cy="18" rx="2.8" ry="1.6" fill="white" opacity=".42" transform="rotate(-22 57 18)"/>
<circle cx="25" cy="12" r="8.5" fill="url(#gc)"/>
<text x="25" y="16" text-anchor="middle" font-size="7" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="20" cy="8" rx="2.6" ry="1.5" fill="white" opacity=".4" transform="rotate(-22 20 8)"/>
<circle cx="55" cy="10" r="8.5" fill="url(#gc)"/>
<text x="55" y="14" text-anchor="middle" font-size="7" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<circle cx="40" cy="8" r="10" fill="url(#gc)"/>
<circle cx="40" cy="8" r="7.5" fill="none" stroke="#D0A808" stroke-width="1.2" opacity=".55"/>
<text x="40" y="12.5" text-anchor="middle" font-size="8" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="34" cy="4" rx="3.2" ry="1.8" fill="white" opacity=".44" transform="rotate(-22 34 4)"/>
</svg>`,
  large_plant:    `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
<radialGradient id="gc" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFE870"/><stop offset="50%" stop-color="#F5C518"/><stop offset="100%" stop-color="#C07C00"/></radialGradient>
<radialGradient id="gk" cx="40%" cy="30%" r="70%"><stop offset="0%" stop-color="#94DC58"/><stop offset="100%" stop-color="#38800E"/></radialGradient>
<radialGradient id="gt" cx="30%" cy="20%" r="80%"><stop offset="0%" stop-color="#D09A50"/><stop offset="100%" stop-color="#7A4A18"/></radialGradient>
</defs>
<ellipse cx="40" cy="74" rx="26" ry="6.5" fill="#C8A058" opacity=".3"/>
<path d="M16 70 Q40 61 64 70 Q52 78 40 80 Q28 78 16 70Z" fill="#B8883A"/>
<path d="M20 69 Q40 62 60 69 Q49 76 40 77 Q31 76 20 69Z" fill="#C89848"/>
<path d="M38 70 Q36 58 37 44 Q38 32 39 20" stroke="url(#gt)" stroke-width="9" stroke-linecap="round" fill="none"/>
<path d="M43 70 Q42 58 41 44 Q40 32 41 20" stroke="#C8924A" stroke-width="4.5" stroke-linecap="round" fill="none" opacity=".38"/>
<path d="M37 55 Q22 48 16 36" stroke="url(#gt)" stroke-width="6" stroke-linecap="round" fill="none"/>
<path d="M41 48 Q56 41 62 29" stroke="url(#gt)" stroke-width="6" stroke-linecap="round" fill="none"/>
<path d="M38 42 Q22 33 22 20" stroke="url(#gt)" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M42 38 Q57 29 56 16" stroke="url(#gt)" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M38 30 Q29 22 31 12" stroke="url(#gt)" stroke-width="3.5" stroke-linecap="round" fill="none"/>
<path d="M42 27 Q50 19 50 9" stroke="url(#gt)" stroke-width="3.5" stroke-linecap="round" fill="none"/>
<ellipse cx="40" cy="22" rx="32" ry="21" fill="url(#gk)" opacity=".52"/>
<ellipse cx="13" cy="31" rx="17" ry="12" fill="url(#gk)" opacity=".86"/>
<ellipse cx="65" cy="25" rx="16" ry="12" fill="url(#gk)" opacity=".86"/>
<ellipse cx="19" cy="17" rx="15" ry="11" fill="url(#gk)" opacity=".88"/>
<ellipse cx="58" cy="13" rx="14" ry="10" fill="url(#gk)" opacity=".88"/>
<ellipse cx="40" cy="10" rx="18" ry="11" fill="url(#gk)"/>
<ellipse cx="18" cy="26" rx="8" ry="4.5" fill="#F0C820" opacity=".7" transform="rotate(-30 18 26)"/>
<ellipse cx="60" cy="20" rx="8" ry="4.5" fill="#F0C820" opacity=".7" transform="rotate(28 60 20)"/>
<ellipse cx="22" cy="15" rx="7" ry="4" fill="#F8D840" opacity=".65" transform="rotate(-22 22 15)"/>
<ellipse cx="56" cy="11" rx="7" ry="4" fill="#F8D840" opacity=".65" transform="rotate(20 56 11)"/>
<ellipse cx="36" cy="8" rx="6" ry="3.5" fill="#F0C820" opacity=".62" transform="rotate(-12 36 8)"/>
<ellipse cx="46" cy="7" rx="6" ry="3.5" fill="#F0C820" opacity=".62" transform="rotate(12 46 7)"/>
<circle cx="11" cy="26" r="10" fill="url(#gc)"/>
<circle cx="11" cy="26" r="7.5" fill="none" stroke="#D0A808" stroke-width="1.2" opacity=".58"/>
<text x="11" y="30.5" text-anchor="middle" font-size="8" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="5" cy="20" rx="3.2" ry="1.8" fill="white" opacity=".44" transform="rotate(-22 5 20)"/>
<circle cx="67" cy="20" r="10" fill="url(#gc)"/>
<circle cx="67" cy="20" r="7.5" fill="none" stroke="#D0A808" stroke-width="1.2" opacity=".58"/>
<text x="67" y="24.5" text-anchor="middle" font-size="8" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="61" cy="14" rx="3.2" ry="1.8" fill="white" opacity=".44" transform="rotate(-22 61 14)"/>
<circle cx="17" cy="13" r="9.5" fill="url(#gc)"/>
<text x="17" y="17.5" text-anchor="middle" font-size="7.5" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="11" cy="8" rx="3" ry="1.7" fill="white" opacity=".42" transform="rotate(-22 11 8)"/>
<circle cx="57" cy="8" r="9.5" fill="url(#gc)"/>
<text x="57" y="12.5" text-anchor="middle" font-size="7.5" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<circle cx="32" cy="6" r="9" fill="url(#gc)"/>
<text x="32" y="10.5" text-anchor="middle" font-size="7" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<circle cx="50" cy="5" r="9" fill="url(#gc)"/>
<text x="50" y="9.5" text-anchor="middle" font-size="7" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<circle cx="40" cy="5" r="11" fill="url(#gc)"/>
<circle cx="40" cy="5" r="8" fill="none" stroke="#D0A808" stroke-width="1.2" opacity=".58"/>
<text x="40" y="9.5" text-anchor="middle" font-size="8.5" fill="#7A5008" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="33" cy="1" rx="3.5" ry="2" fill="white" opacity=".46" transform="rotate(-22 33 1)"/>
<path d="M4 42 L5.2 38 L6.4 42 L5.2 46Z" fill="#FFE040" opacity=".8"/>
<path d="M75 36 L76.2 32 L77.4 36 L76.2 40Z" fill="#FFE040" opacity=".78"/>
<circle cx="4" cy="50" r="2.2" fill="#FFE566" opacity=".65"/>
<circle cx="76" cy="44" r="2.2" fill="#FFE566" opacity=".62"/>
</svg>`,
  flowering:    `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
<radialGradient id="gc" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFF090"/><stop offset="45%" stop-color="#F5C518"/><stop offset="100%" stop-color="#B87800"/></radialGradient>
<radialGradient id="gk" cx="40%" cy="28%" r="70%"><stop offset="0%" stop-color="#98E060"/><stop offset="100%" stop-color="#368010"/></radialGradient>
<radialGradient id="gt" cx="28%" cy="18%" r="78%"><stop offset="0%" stop-color="#D4A050"/><stop offset="100%" stop-color="#6A3808"/></radialGradient>
</defs>
<ellipse cx="40" cy="76" rx="28" ry="6" fill="#C8A058" opacity=".28"/>
<path d="M15 72 Q40 63 65 72 Q52 80 40 80 Q28 80 15 72Z" fill="#B8883A"/>
<path d="M19 71 Q40 63 61 71 Q49 78 40 79 Q31 78 19 71Z" fill="#C89848"/>
<ellipse cx="28" cy="75" rx="6" ry="3" fill="#F0C820" opacity=".62"/>
<ellipse cx="52" cy="75" rx="5" ry="2.8" fill="#F0C820" opacity=".58"/>
<ellipse cx="40" cy="77" rx="4" ry="2.2" fill="#F5CC30" opacity=".55"/>
<path d="M38 72 Q36 60 37 47 Q38 36 39 22" stroke="url(#gt)" stroke-width="10" stroke-linecap="round" fill="none"/>
<path d="M44 72 Q43 60 42 47 Q41 36 42 22" stroke="#C8924A" stroke-width="5" stroke-linecap="round" fill="none" opacity=".35"/>
<path d="M37 50 Q34 45 36 40" stroke="#C08030" stroke-width="1.5" fill="none" opacity=".3" stroke-linecap="round"/>
<path d="M43 46 Q41 41 43 36" stroke="#C08030" stroke-width="1.2" fill="none" opacity=".25" stroke-linecap="round"/>
<path d="M37 57 Q21 50 15 37" stroke="url(#gt)" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M42 50 Q57 43 63 30" stroke="url(#gt)" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M37 44 Q20 35 21 21" stroke="url(#gt)" stroke-width="5.5" stroke-linecap="round" fill="none"/>
<path d="M43 40 Q59 31 57 17" stroke="url(#gt)" stroke-width="5.5" stroke-linecap="round" fill="none"/>
<path d="M38 33 Q27 23 29 11" stroke="url(#gt)" stroke-width="4" stroke-linecap="round" fill="none"/>
<path d="M43 30 Q52 20 52 8" stroke="url(#gt)" stroke-width="4" stroke-linecap="round" fill="none"/>
<ellipse cx="40" cy="26" rx="34" ry="24" fill="url(#gk)" opacity=".48"/>
<ellipse cx="12" cy="32" rx="18" ry="13" fill="url(#gk)" opacity=".84"/>
<ellipse cx="66" cy="27" rx="17" ry="13" fill="url(#gk)" opacity=".84"/>
<ellipse cx="17" cy="18" rx="16" ry="12" fill="url(#gk)" opacity=".88"/>
<ellipse cx="62" cy="14" rx="15" ry="11" fill="url(#gk)" opacity=".88"/>
<ellipse cx="40" cy="12" rx="20" ry="13" fill="url(#gk)"/>
<ellipse cx="14" cy="28" rx="9" ry="5" fill="#90C840" opacity=".6" transform="rotate(-28 14 28)"/>
<ellipse cx="64" cy="24" rx="9" ry="5" fill="#90C840" opacity=".6" transform="rotate(24 64 24)"/>
<ellipse cx="20" cy="15" rx="8" ry="4.5" fill="#A8D848" opacity=".55" transform="rotate(-20 20 15)"/>
<ellipse cx="59" cy="11" rx="8" ry="4.5" fill="#A8D848" opacity=".55" transform="rotate(18 59 11)"/>
<ellipse cx="36" cy="7" rx="7" ry="4" fill="#B8E050" opacity=".5" transform="rotate(-10 36 7)"/>
<ellipse cx="46" cy="6" rx="7" ry="4" fill="#B8E050" opacity=".5" transform="rotate(10 46 6)"/>
<circle cx="10" cy="28" r="10.5" fill="url(#gc)"/>
<circle cx="10" cy="28" r="8" fill="none" stroke="#E8B800" stroke-width="1.4" opacity=".62"/>
<text x="10" y="32.5" text-anchor="middle" font-size="8" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="3" cy="22" rx="3.5" ry="2" fill="white" opacity=".45" transform="rotate(-22 3 22)"/>
<circle cx="68" cy="23" r="10.5" fill="url(#gc)"/>
<circle cx="68" cy="23" r="8" fill="none" stroke="#E8B800" stroke-width="1.4" opacity=".62"/>
<text x="68" y="27.5" text-anchor="middle" font-size="8" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="61" cy="17" rx="3.5" ry="2" fill="white" opacity=".45" transform="rotate(-22 61 17)"/>
<circle cx="17" cy="14" r="9.5" fill="url(#gc)"/>
<circle cx="17" cy="14" r="7" fill="none" stroke="#E8B800" stroke-width="1.2" opacity=".58"/>
<text x="17" y="18.5" text-anchor="middle" font-size="7.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="11" cy="9" rx="3" ry="1.7" fill="white" opacity=".42" transform="rotate(-22 11 9)"/>
<circle cx="60" cy="10" r="9.5" fill="url(#gc)"/>
<circle cx="60" cy="10" r="7" fill="none" stroke="#E8B800" stroke-width="1.2" opacity=".58"/>
<text x="60" y="14.5" text-anchor="middle" font-size="7.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="54" cy="5" rx="3" ry="1.7" fill="white" opacity=".42" transform="rotate(-22 54 5)"/>
<circle cx="30" cy="8" r="9" fill="url(#gc)"/>
<text x="30" y="12.5" text-anchor="middle" font-size="7" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="24" cy="3" rx="2.8" ry="1.6" fill="white" opacity=".4" transform="rotate(-22 24 3)"/>
<circle cx="52" cy="7" r="9" fill="url(#gc)"/>
<text x="52" y="11.5" text-anchor="middle" font-size="7" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<circle cx="40" cy="5" r="11" fill="url(#gc)"/>
<circle cx="40" cy="5" r="8.5" fill="none" stroke="#F0C800" stroke-width="1.8" opacity=".68"/>
<text x="40" y="9.5" text-anchor="middle" font-size="8.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="33" cy="1" rx="3.8" ry="2.2" fill="white" opacity=".48" transform="rotate(-22 33 1)"/>
<path d="M3 44 L4.4 39.5 L5.8 44 L4.4 48.5Z" fill="#FFE040" opacity=".86"/>
<path d="M4.4 38 L9.4 44 L4.4 50 L-0.6 44Z" fill="#FFEE80" opacity=".5" transform="rotate(45 4.4 44)"/>
<path d="M75 38 L76.4 33.5 L77.8 38 L76.4 42.5Z" fill="#FFE040" opacity=".84"/>
<path d="M76.4 32 L81.4 38 L76.4 44 L71.4 38Z" fill="#FFEE80" opacity=".48" transform="rotate(45 76.4 38)"/>
<path d="M5 20 L6.1 16.4 L7.2 20 L6.1 23.6Z" fill="#FFD820" opacity=".76"/>
<path d="M74 15 L75.1 11.4 L76.2 15 L75.1 18.6Z" fill="#FFD820" opacity=".74"/>
<circle cx="4" cy="52" r="2.2" fill="#FFE566" opacity=".68"/>
<circle cx="76" cy="46" r="2.2" fill="#FFE566" opacity=".65"/>
<circle cx="5" cy="28" r="1.8" fill="#FFF0A0" opacity=".62"/>
<circle cx="75" cy="22" r="1.8" fill="#FFF0A0" opacity=".6"/>
</svg>`,
};

function buildFinanzbaumSvg(stage) {
  return FINANZBAUM_SVGS[stage] || FINANZBAUM_SVGS.seed;
}
function getGoalStage(pct) {
  if (pct >= 100) return 'flowering';
  if (pct >= 80)  return 'large_plant';
  if (pct >= 60)  return 'medium_plant';
  if (pct >= 40)  return 'small_plant';
  if (pct >= 20)  return 'sprout';
  return 'seed';
}

// Plant-type emoji map
const PLANT_EMOJIS = {
  sunflower:     '🌻',
  cactus:        '🌵',
  bonsai:        '🌳',
  potplant:      '🪴',
  cherryblossom: '🌸',
};
const PLANT_NAMES = {
  sunflower:     'Sonnenblume',
  cactus:        'Kaktus',
  bonsai:        'Bonsai',
  potplant:      'Zimmerpflanze',
  cherryblossom: 'Kirschblüte',
};

// Plant-type specific tint colors for SVG (stem/leaf color)
// =============================================================
// PLANT SVGS — 5 Pflanzen × 6 Stufen = 30 einzigartige SVGs
// Jede Pflanze hat ihre eigene eindeutige Silhouette.
// viewBox: 80×80 · fill="none" baseline
// =============================================================

const PLANT_SVGS = {

  // ─────────────────────────────────────────────────────────────
  // 🌻 SONNENBLUME
  // Erkennbar: langer gerader Stängel, runde Blüte mit Strahlen
  // ─────────────────────────────────────────────────────────────
  sunflower: {
    seed: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="64" rx="18" ry="5" fill="#C5A882" opacity=".28"/>
      <ellipse cx="40" cy="60" rx="9" ry="7" fill="#8B6340"/>
      <ellipse cx="40" cy="57" rx="6" ry="5" fill="#A07848"/>
      <line x1="37" y1="55" x2="38" y2="52" stroke="#C09A62" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>
      <line x1="43" y1="54" x2="42" y2="51" stroke="#C09A62" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>
    </svg>`,
    sprout: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="68" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <line x1="40" y1="66" x2="40" y2="44" stroke="#7A9B3A" stroke-width="3" stroke-linecap="round"/>
      <!-- Kleines Keimblatt links -->
      <path d="M40 56 Q30 52 29 44 Q37 44 40 52" fill="#A8C848"/>
      <!-- Kleines Keimblatt rechts -->
      <path d="M40 52 Q50 48 51 40 Q43 40 40 48" fill="#8FB83A" opacity=".85"/>
      <!-- Tiny knospe oben -->
      <ellipse cx="40" cy="43" rx="3" ry="4" fill="#C8D870"/>
    </svg>`,
    small_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="70" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <!-- Stängel — gerade, charakteristisch für Sonnenblume -->
      <line x1="40" y1="68" x2="40" y2="22" stroke="#5A8A20" stroke-width="3" stroke-linecap="round"/>
      <!-- Blätter am Stängel — herzförmig, rau -->
      <path d="M40 58 Q26 54 24 42 Q36 42 40 54" fill="#7AAF38"/>
      <path d="M40 50 Q54 46 56 34 Q44 34 40 46" fill="#8FBF40" opacity=".88"/>
      <path d="M40 42 Q28 36 30 24 Q40 24 40 36" fill="#7AAF38" opacity=".8"/>
      <!-- Knospe — rund geschlossen -->
      <circle cx="40" cy="19" r="5" fill="#C8C840"/>
      <path d="M40 19 Q37 14 40 11 Q43 14 40 19" fill="#8B9E3A"/>
    </svg>`,
    medium_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="72" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <line x1="40" y1="70" x2="40" y2="18" stroke="#4A7A18" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Mehrere Blätter, herzförmig -->
      <path d="M40 62 Q24 56 22 42 Q36 40 40 56" fill="#7AAF38"/>
      <path d="M40 54 Q56 48 58 34 Q44 32 40 48" fill="#8FBF40" opacity=".85"/>
      <path d="M40 46 Q26 38 28 26 Q40 24 40 38" fill="#7AAF38" opacity=".8"/>
      <path d="M40 38 Q52 32 54 20 Q44 18 40 30" fill="#8FBF40" opacity=".75"/>
      <!-- Knospe — deutlicher, halb offen -->
      <circle cx="40" cy="15" r="7" fill="#D4C840"/>
      <path d="M40 15 Q35 9 40 6 Q45 9 40 15" fill="#8B9E3A"/>
      <path d="M40 15 Q33 11 31 6 Q37 5 40 10" fill="#A0B030" opacity=".7"/>
    </svg>`,
    large_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="74" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <line x1="40" y1="72" x2="40" y2="16" stroke="#3A6A10" stroke-width="4" stroke-linecap="round"/>
      <!-- Viele Blätter -->
      <path d="M40 64 Q22 56 20 40 Q36 38 40 56" fill="#6A9F28"/>
      <path d="M40 56 Q58 48 60 32 Q44 30 40 48" fill="#7AAF38" opacity=".85"/>
      <path d="M40 48 Q24 40 26 26 Q40 24 40 38" fill="#6A9F28" opacity=".8"/>
      <path d="M40 40 Q54 34 56 20 Q44 18 40 32" fill="#7AAF38" opacity=".75"/>
      <!-- Blüte fast offen — deutliche Knospe mit Blütenblatt-Ansätzen -->
      <circle cx="40" cy="13" r="9" fill="#C8B030"/>
      <!-- Blütenblätter beginnen sich zu zeigen -->
      <ellipse cx="40" cy="5" rx="4" ry="6" fill="#E8C830" opacity=".8"/>
      <ellipse cx="32" cy="8" rx="4" ry="6" fill="#E8C830" opacity=".7" transform="rotate(-45 32 8)"/>
      <ellipse cx="48" cy="8" rx="4" ry="6" fill="#E8C830" opacity=".7" transform="rotate(45 48 8)"/>
    </svg>`,
    flowering: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="74" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <line x1="40" y1="72" x2="40" y2="24" stroke="#3A6A10" stroke-width="4" stroke-linecap="round"/>
      <!-- Blätter -->
      <path d="M40 64 Q23 56 21 42 Q37 40 40 56" fill="#6A9F28"/>
      <path d="M40 56 Q57 48 59 34 Q43 32 40 48" fill="#7AAF38" opacity=".85"/>
      <path d="M40 48 Q25 40 27 28 Q40 26 40 40" fill="#6A9F28" opacity=".8"/>
      <!-- Blüte — große Sonnenblume, strahlende Blütenblätter -->
      <!-- Blütenblätter (Strahlen) -->
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#F5C518"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#F5C518" transform="rotate(30 40 22)"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#F5C518" transform="rotate(60 40 22)"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#F5C518" transform="rotate(90 40 22)"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#F5C518" transform="rotate(120 40 22)"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#F5C518" transform="rotate(150 40 22)"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#E8B820" transform="rotate(180 40 22)"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#E8B820" transform="rotate(210 40 22)"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#E8B820" transform="rotate(240 40 22)"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#E8B820" transform="rotate(270 40 22)"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#E8B820" transform="rotate(300 40 22)"/>
      <ellipse cx="40" cy="10" rx="4.5" ry="8" fill="#E8B820" transform="rotate(330 40 22)"/>
      <!-- Blütenmitte — braune Scheibe -->
      <circle cx="40" cy="22" r="10" fill="#6B4010"/>
      <circle cx="40" cy="22" r="8"  fill="#7A4A18"/>
      <!-- Muster auf Blütenmitte -->
      <circle cx="37" cy="20" r="1.2" fill="#5A3008" opacity=".6"/>
      <circle cx="43" cy="20" r="1.2" fill="#5A3008" opacity=".6"/>
      <circle cx="40" cy="25" r="1.2" fill="#5A3008" opacity=".6"/>
      <circle cx="37" cy="25" r="1"   fill="#5A3008" opacity=".4"/>
      <circle cx="43" cy="25" r="1"   fill="#5A3008" opacity=".4"/>
    </svg>`,
  },

  // ─────────────────────────────────────────────────────────────
  // 🌵 KAKTUS
  // Erkennbar: säulenförmig, Stacheln, niemals Baumsylhouette
  // ─────────────────────────────────────────────────────────────
  cactus: {
    seed: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="64" rx="18" ry="5" fill="#C5A882" opacity=".28"/>
      <!-- Sandiger Boden -->
      <ellipse cx="40" cy="62" rx="12" ry="3" fill="#D4B882" opacity=".5"/>
      <!-- Winziger Kaktus-Samen: oval, stachelig -->
      <ellipse cx="40" cy="57" rx="7" ry="6" fill="#5A8A40"/>
      <line x1="36" y1="53" x2="34" y2="50" stroke="#4A7A30" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="40" y1="52" x2="40" y2="49" stroke="#4A7A30" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="44" y1="53" x2="46" y2="50" stroke="#4A7A30" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    sprout: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="68" rx="16" ry="4" fill="#C5A882" opacity=".28"/>
      <!-- Boden -->
      <ellipse cx="40" cy="66" rx="10" ry="2.5" fill="#D4B882" opacity=".45"/>
      <!-- Kleiner runder Kaktus-Knubbel -->
      <ellipse cx="40" cy="58" rx="8" ry="10" fill="#5A9A48"/>
      <!-- Stacheln -->
      <line x1="32" y1="55" x2="28" y2="52" stroke="#3A6A28" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="32" y1="60" x2="27" y2="60" stroke="#3A6A28" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="48" y1="55" x2="52" y2="52" stroke="#3A6A28" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="48" y1="60" x2="53" y2="60" stroke="#3A6A28" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="40" y1="48" x2="40" y2="44" stroke="#3A6A28" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    small_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="70" rx="16" ry="4" fill="#C5A882" opacity=".28"/>
      <ellipse cx="40" cy="68" rx="10" ry="2.5" fill="#D4B882" opacity=".4"/>
      <!-- Kleiner Säulenkaktus -->
      <rect x="34" y="40" width="12" height="28" rx="6" fill="#5A9A48"/>
      <!-- Rippen -->
      <line x1="40" y1="40" x2="40" y2="68" stroke="#4A8038" stroke-width="1" opacity=".5"/>
      <!-- Stacheln gleichmäßig -->
      <line x1="34" y1="48" x2="29" y2="46" stroke="#2A5A18" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="34" y1="54" x2="29" y2="52" stroke="#2A5A18" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="34" y1="60" x2="29" y2="58" stroke="#2A5A18" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="46" y1="48" x2="51" y2="46" stroke="#2A5A18" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="46" y1="54" x2="51" y2="52" stroke="#2A5A18" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="46" y1="60" x2="51" y2="58" stroke="#2A5A18" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="40" y1="40" x2="40" y2="36" stroke="#2A5A18" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    medium_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="72" rx="16" ry="4" fill="#C5A882" opacity=".28"/>
      <ellipse cx="40" cy="70" rx="10" ry="2.5" fill="#D4B882" opacity=".4"/>
      <!-- Hauptstamm — höher -->
      <rect x="35" y="28" width="10" height="42" rx="5" fill="#5A9A48"/>
      <line x1="40" y1="28" x2="40" y2="70" stroke="#4A8038" stroke-width="1" opacity=".45"/>
      <!-- Linker Arm -->
      <path d="M35 50 Q22 50 22 38 Q22 30 28 30 Q34 30 35 38" fill="#4A9040"/>
      <!-- Rechter Arm -->
      <path d="M45 46 Q58 46 58 34 Q58 26 52 26 Q46 26 45 34" fill="#5A9A48"/>
      <!-- Stacheln am Stamm -->
      <line x1="35" y1="36" x2="30" y2="34" stroke="#2A5A18" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="45" y1="36" x2="50" y2="34" stroke="#2A5A18" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="35" y1="58" x2="30" y2="56" stroke="#2A5A18" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="45" y1="58" x2="50" y2="56" stroke="#2A5A18" stroke-width="1.4" stroke-linecap="round"/>
      <!-- Stacheln an Armen -->
      <line x1="24" y1="36" x2="21" y2="33" stroke="#2A5A18" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="56" y1="32" x2="59" y2="29" stroke="#2A5A18" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`,
    large_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="74" rx="16" ry="4" fill="#C5A882" opacity=".28"/>
      <ellipse cx="40" cy="72" rx="10" ry="2.5" fill="#D4B882" opacity=".4"/>
      <!-- Großer Hauptstamm -->
      <rect x="35" y="18" width="10" height="54" rx="5" fill="#4A9040"/>
      <line x1="40" y1="18" x2="40" y2="72" stroke="#3A7830" stroke-width="1" opacity=".4"/>
      <!-- Linker Arm — kürzer, nach oben -->
      <path d="M35 44 Q18 44 18 28 Q18 18 26 18 Q34 18 35 28" fill="#4A9040"/>
      <!-- Linker Arm Rippe -->
      <line x1="26" y1="18" x2="26" y2="44" stroke="#3A7830" stroke-width="0.8" opacity=".4"/>
      <!-- Rechter Arm — höher angesetzt -->
      <path d="M45 38 Q62 38 62 22 Q62 12 54 12 Q46 12 45 22" fill="#5A9A48"/>
      <line x1="54" y1="12" x2="54" y2="38" stroke="#3A7830" stroke-width="0.8" opacity=".4"/>
      <!-- Stacheln -->
      <line x1="35" y1="26" x2="30" y2="23" stroke="#1A4A10" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="35" y1="56" x2="30" y2="53" stroke="#1A4A10" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="45" y1="26" x2="50" y2="23" stroke="#1A4A10" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="45" y1="56" x2="50" y2="53" stroke="#1A4A10" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="18" y1="26" x2="14" y2="24" stroke="#1A4A10" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="62" y1="20" x2="66" y2="18" stroke="#1A4A10" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`,
    flowering: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="74" rx="16" ry="4" fill="#C5A882" opacity=".28"/>
      <ellipse cx="40" cy="72" rx="10" ry="2.5" fill="#D4B882" opacity=".4"/>
      <!-- Großer Hauptstamm -->
      <rect x="35" y="18" width="10" height="54" rx="5" fill="#4A9040"/>
      <line x1="40" y1="18" x2="40" y2="72" stroke="#3A7830" stroke-width="1" opacity=".4"/>
      <!-- Linker Arm -->
      <path d="M35 44 Q18 44 18 28 Q18 18 26 18 Q34 18 35 28" fill="#4A9040"/>
      <line x1="26" y1="18" x2="26" y2="44" stroke="#3A7830" stroke-width="0.8" opacity=".4"/>
      <!-- Rechter Arm -->
      <path d="M45 38 Q62 38 62 22 Q62 12 54 12 Q46 12 45 22" fill="#5A9A48"/>
      <line x1="54" y1="12" x2="54" y2="38" stroke="#3A7830" stroke-width="0.8" opacity=".4"/>
      <!-- Stacheln -->
      <line x1="35" y1="30" x2="30" y2="27" stroke="#1A4A10" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="35" y1="58" x2="30" y2="55" stroke="#1A4A10" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="45" y1="30" x2="50" y2="27" stroke="#1A4A10" stroke-width="1.4" stroke-linecap="round"/>
      <line x1="45" y1="58" x2="50" y2="55" stroke="#1A4A10" stroke-width="1.4" stroke-linecap="round"/>
      <!-- Blüten oben auf allen 3 Spitzen -->
      <!-- Blüte auf Hauptstamm -->
      <circle cx="40" cy="15" r="5" fill="#F8E8F0"/>
      <circle cx="40" cy="15" r="3" fill="#F87090"/>
      <circle cx="40" cy="9"  r="3.5" fill="#F87090" opacity=".85"/>
      <circle cx="33" cy="11" r="3"   fill="#F87090" opacity=".75"/>
      <circle cx="47" cy="11" r="3"   fill="#F87090" opacity=".75"/>
      <circle cx="34" cy="18" r="3"   fill="#F87090" opacity=".7"/>
      <circle cx="46" cy="18" r="3"   fill="#F87090" opacity=".7"/>
      <!-- Blüte auf linkem Arm -->
      <circle cx="26" cy="15" r="4" fill="#F8D8E8"/>
      <circle cx="26" cy="15" r="2.5" fill="#F87090"/>
      <!-- Blüte auf rechtem Arm -->
      <circle cx="54" cy="9"  r="4" fill="#F8D8E8"/>
      <circle cx="54" cy="9"  r="2.5" fill="#F87090"/>
    </svg>`,
  },

  // ─────────────────────────────────────────────────────────────
  // 🌳 BONSAI
  // Erkennbar: asymmetrischer, gekrümmter Stamm, breite flache Krone
  // Immer kompakt, nie zu groß
  // ─────────────────────────────────────────────────────────────
  bonsai: {
    seed: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="64" rx="18" ry="5" fill="#C5A882" opacity=".28"/>
      <!-- Flache Bonsai-Schale schon sichtbar -->
      <rect x="28" y="60" width="24" height="7" rx="3" fill="#C08A50"/>
      <rect x="26" y="65" width="28" height="3" rx="1.5" fill="#A07040"/>
      <!-- Samen in der Schale -->
      <ellipse cx="40" cy="60" rx="6" ry="4.5" fill="#7A5A30"/>
      <ellipse cx="40" cy="58.5" rx="4.5" ry="3" fill="#9A7240"/>
    </svg>`,
    sprout: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Bonsai-Schale -->
      <rect x="27" y="60" width="26" height="7" rx="3" fill="#C08A50"/>
      <rect x="25" y="65" width="30" height="3" rx="1.5" fill="#A07040"/>
      <!-- Erster kleiner Trieb — schon leicht schräg -->
      <path d="M40 60 Q38 50 36 40" stroke="#6B4226" stroke-width="3" stroke-linecap="round" fill="none"/>
      <!-- Erstes Blättchen -->
      <path d="M36 40 Q28 38 27 32 Q34 32 36 38" fill="#5A8A3C"/>
      <path d="M36 40 Q44 36 45 28 Q38 28 36 36" fill="#6A9A48" opacity=".85"/>
    </svg>`,
    small_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Bonsai-Schale -->
      <rect x="26" y="62" width="28" height="8" rx="3.5" fill="#C08A50"/>
      <rect x="24" y="68" width="32" height="3" rx="1.5" fill="#A07040"/>
      <!-- Stamm — schräg, charakteristisch für Bonsai -->
      <path d="M40 62 Q36 52 34 38 Q33 30 36 22" stroke="#6B4226" stroke-width="4" stroke-linecap="round" fill="none"/>
      <!-- Kleiner Seitenzweig links unten -->
      <path d="M36 48 Q24 46 22 38" stroke="#7A4E2A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <!-- Blattmasse — klein, kompakt -->
      <circle cx="22" cy="36" r="8" fill="#5A8A3C" opacity=".88"/>
      <circle cx="34" cy="20" r="9" fill="#6A9A48"/>
      <circle cx="42" cy="25" r="7" fill="#5A8A3C" opacity=".82"/>
    </svg>`,
    medium_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Bonsai-Schale — etwas breiter -->
      <rect x="22" y="64" width="36" height="8" rx="4" fill="#C08A50"/>
      <rect x="20" y="70" width="40" height="3.5" rx="1.5" fill="#A07040"/>
      <!-- Stamm — S-Kurve, typischer Bonsai -->
      <path d="M40 64 Q37 54 35 44 Q32 34 36 24 Q38 18 42 14" stroke="#5A3818" stroke-width="5" stroke-linecap="round" fill="none"/>
      <!-- Zweige -->
      <path d="M36 44 Q22 42 18 32" stroke="#7A4E2A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M38 32 Q52 28 56 18" stroke="#7A4E2A" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Blattwolken — flach und breit -->
      <ellipse cx="18" cy="28" rx="11" ry="8"  fill="#5A8A3C" opacity=".9"/>
      <ellipse cx="56" cy="16" rx="9"  ry="7"  fill="#6A9A48" opacity=".85"/>
      <ellipse cx="40" cy="12" rx="12" ry="7"  fill="#5A8A3C"/>
      <ellipse cx="54" cy="22" rx="8"  ry="6"  fill="#6A9A48" opacity=".8"/>
    </svg>`,
    large_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Bonsai-Schale — groß und flach -->
      <rect x="18" y="66" width="44" height="8" rx="4" fill="#B87A40"/>
      <rect x="16" y="72" width="48" height="4" rx="2" fill="#9A6430"/>
      <!-- Markante S-Kurve -->
      <path d="M40 66 Q36 56 33 46 Q30 36 34 26 Q37 18 42 12" stroke="#4A2E10" stroke-width="6" stroke-linecap="round" fill="none"/>
      <!-- Seitenzweige — mehrere Ebenen -->
      <path d="M34 52 Q18 50 14 38" stroke="#6B4226" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M36 38 Q54 34 58 22" stroke="#6B4226" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M38 28 Q22 24 20 14" stroke="#6B4226" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Blattwolken — flache, breite Ebenen, typisch Bonsai -->
      <ellipse cx="14" cy="34" rx="12" ry="8"  fill="#4A7A30" opacity=".9"/>
      <ellipse cx="58" cy="20" rx="11" ry="7"  fill="#5A8A3C" opacity=".88"/>
      <ellipse cx="20" cy="12" rx="11" ry="7"  fill="#4A7A30" opacity=".88"/>
      <ellipse cx="42" cy="8"  rx="14" ry="7"  fill="#5A8A3C"/>
      <ellipse cx="58" cy="10" rx="9"  ry="6"  fill="#4A7A30" opacity=".82"/>
    </svg>`,
    flowering: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Bonsai-Schale -->
      <rect x="16" y="66" width="48" height="8" rx="4" fill="#B87A40"/>
      <rect x="14" y="72" width="52" height="4" rx="2" fill="#9A6430"/>
      <!-- Stamm -->
      <path d="M40 66 Q36 56 33 46 Q30 36 34 26 Q37 18 42 12" stroke="#4A2E10" stroke-width="6" stroke-linecap="round" fill="none"/>
      <!-- Zweige -->
      <path d="M34 52 Q18 50 14 38" stroke="#6B4226" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M36 38 Q54 34 58 22" stroke="#6B4226" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M38 28 Q22 24 20 14" stroke="#6B4226" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Blattwolken -->
      <ellipse cx="14" cy="34" rx="13" ry="9"  fill="#4A7A30" opacity=".85"/>
      <ellipse cx="58" cy="20" rx="12" ry="8"  fill="#5A8A3C" opacity=".82"/>
      <ellipse cx="20" cy="12" rx="12" ry="8"  fill="#4A7A30" opacity=".85"/>
      <ellipse cx="42" cy="8"  rx="15" ry="8"  fill="#5A8A3C"/>
      <ellipse cx="58" cy="10" rx="10" ry="7"  fill="#4A7A30" opacity=".8"/>
      <!-- Rosa Blüten über die Krone gestreut -->
      <circle cx="10" cy="30" r="4"  fill="#F9A8D4" opacity=".9"/>
      <circle cx="18" cy="25" r="3.5" fill="#FBCFE8" opacity=".85"/>
      <circle cx="55" cy="15" r="4"  fill="#F9A8D4" opacity=".9"/>
      <circle cx="62" cy="22" r="3"  fill="#FBCFE8" opacity=".8"/>
      <circle cx="16" cy="7"  r="3.5" fill="#F9A8D4" opacity=".85"/>
      <circle cx="28" cy="5"  r="3"  fill="#FBCFE8" opacity=".8"/>
      <circle cx="42" cy="3"  r="3.5" fill="#F9A8D4" opacity=".88"/>
      <circle cx="52" cy="5"  r="3"  fill="#FBCFE8" opacity=".78"/>
      <circle cx="62" cy="8"  r="3.5" fill="#F9A8D4" opacity=".82"/>
    </svg>`,
  },

  // ─────────────────────────────────────────────────────────────
  // 🪴 ZIMMERPFLANZE
  // Erkennbar: IMMER im Blumentopf, tropische breite Blätter
  // ─────────────────────────────────────────────────────────────
  potplant: {
    seed: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Topf — immer vorhanden -->
      <path d="M28 56 L32 72 L48 72 L52 56 Z" fill="#C07848"/>
      <rect x="26" y="53" width="28" height="5" rx="2.5" fill="#D08858"/>
      <!-- Erde im Topf -->
      <ellipse cx="40" cy="56" rx="12" ry="3.5" fill="#6B4226"/>
      <!-- Samen sichtbar in der Erde -->
      <ellipse cx="40" cy="55" rx="4" ry="3" fill="#8B5E30"/>
      <ellipse cx="40" cy="54" rx="3" ry="2" fill="#A07848"/>
    </svg>`,
    sprout: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Topf -->
      <path d="M28 56 L32 72 L48 72 L52 56 Z" fill="#C07848"/>
      <rect x="26" y="53" width="28" height="5" rx="2.5" fill="#D08858"/>
      <ellipse cx="40" cy="56" rx="12" ry="3.5" fill="#6B4226"/>
      <!-- Kleiner Stängel -->
      <line x1="40" y1="55" x2="40" y2="38" stroke="#5A8A3C" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Erstes Blättchen — rund tropisch -->
      <ellipse cx="33" cy="36" rx="8" ry="5" fill="#6AAF48" transform="rotate(-30 33 36)"/>
      <ellipse cx="47" cy="34" rx="8" ry="5" fill="#5A9A38" transform="rotate(30 47 34)"/>
    </svg>`,
    small_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Topf -->
      <path d="M26 58 L30 74 L50 74 L54 58 Z" fill="#C07848"/>
      <rect x="24" y="55" width="32" height="5" rx="2.5" fill="#D08858"/>
      <ellipse cx="40" cy="58" rx="14" ry="4" fill="#6B4226"/>
      <!-- Stängel -->
      <line x1="40" y1="57" x2="40" y2="30" stroke="#4A7A2C" stroke-width="3" stroke-linecap="round"/>
      <!-- Monstera-artige Blätter — herzförmig mit Kerben -->
      <path d="M40 48 Q24 44 20 30 Q30 26 40 40" fill="#5A9A38"/>
      <path d="M22 32 Q20 26 24 22" stroke="#5A9A38" stroke-width="1" fill="none"/>
      <path d="M40 42 Q56 38 60 24 Q50 20 40 34" fill="#6AAF48" opacity=".88"/>
      <path d="M58 26 Q60 20 56 16" stroke="#6AAF48" stroke-width="1" fill="none"/>
      <!-- Kleines Blatt oben -->
      <ellipse cx="40" cy="28" rx="7" ry="5" fill="#5A9A38" opacity=".85"/>
    </svg>`,
    medium_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Topf -->
      <path d="M24 60 L28 76 L52 76 L56 60 Z" fill="#C07848"/>
      <rect x="22" y="56" width="36" height="6" rx="3" fill="#D08858"/>
      <ellipse cx="40" cy="60" rx="16" ry="4.5" fill="#6B4226"/>
      <!-- Stängel -->
      <line x1="40" y1="59" x2="40" y2="22" stroke="#3A6A1C" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Große tropische Blätter — Monstera-Silhouette -->
      <path d="M40 52 Q20 46 16 28 Q28 22 40 42" fill="#4A8A28"/>
      <!-- Einschnitte -->
      <path d="M18 30 Q16 24 20 18" stroke="#4A8A28" stroke-width="1.5" fill="none"/>
      <path d="M40 44 Q60 38 64 20 Q52 14 40 34" fill="#5A9A38" opacity=".88"/>
      <path d="M62 22 Q64 16 60 10" stroke="#5A9A38" stroke-width="1.5" fill="none"/>
      <path d="M40 36 Q24 28 26 14 Q36 10 40 24" fill="#4A8A28" opacity=".82"/>
      <path d="M40 30 Q56 24 58 10 Q48 6 40 20" fill="#5A9A38" opacity=".78"/>
    </svg>`,
    large_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Topf — breiter -->
      <path d="M20 62 L24 78 L56 78 L60 62 Z" fill="#B86A38"/>
      <rect x="18" y="58" width="44" height="6" rx="3" fill="#C87848"/>
      <ellipse cx="40" cy="62" rx="20" ry="5" fill="#5A3818"/>
      <!-- Mehrere Stängel aus dem Topf -->
      <line x1="40" y1="61" x2="40" y2="16" stroke="#3A6A1C" stroke-width="4" stroke-linecap="round"/>
      <line x1="36" y1="61" x2="28" y2="30" stroke="#3A6A1C" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="44" y1="61" x2="52" y2="28" stroke="#3A6A1C" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Üppige Blätter, gross -->
      <path d="M40 54 Q16 46 12 24 Q28 18 40 44" fill="#4A8A28"/>
      <path d="M14 28 Q12 20 16 12" stroke="#4A8A28" stroke-width="1.5" fill="none"/>
      <path d="M40 46 Q64 38 68 16 Q52 10 40 36" fill="#5A9A38" opacity=".88"/>
      <path d="M66 20 Q68 12 64 6" stroke="#5A9A38" stroke-width="1.5" fill="none"/>
      <path d="M28 30 Q12 24 14 10 Q24 6 28 18" fill="#4A8A28" opacity=".85"/>
      <path d="M52 28 Q68 22 66 8 Q56 4 52 16" fill="#5A9A38" opacity=".82"/>
      <ellipse cx="40" cy="14" rx="12" ry="8" fill="#6AAF48" opacity=".75"/>
    </svg>`,
    flowering: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Topf -->
      <path d="M20 62 L24 78 L56 78 L60 62 Z" fill="#B86A38"/>
      <rect x="18" y="58" width="44" height="6" rx="3" fill="#C87848"/>
      <ellipse cx="40" cy="62" rx="20" ry="5" fill="#5A3818"/>
      <!-- Stängel -->
      <line x1="40" y1="61" x2="40" y2="14" stroke="#2A5A0C" stroke-width="4" stroke-linecap="round"/>
      <line x1="36" y1="61" x2="26" y2="28" stroke="#2A5A0C" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="44" y1="61" x2="54" y2="26" stroke="#2A5A0C" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Blätter -->
      <path d="M40 54 Q14 44 10 22 Q28 16 40 44" fill="#3A7818"/>
      <path d="M12 26 Q10 18 14 10" stroke="#3A7818" stroke-width="1.5" fill="none"/>
      <path d="M40 46 Q66 36 70 14 Q52 8 40 36" fill="#4A8828" opacity=".88"/>
      <path d="M68 18 Q70 10 66 4" stroke="#4A8828" stroke-width="1.5" fill="none"/>
      <path d="M26 28 Q10 22 12 8 Q22 4 26 16" fill="#3A7818" opacity=".85"/>
      <path d="M54 26 Q70 20 68 6 Q58 2 54 14" fill="#4A8828" opacity=".82"/>
      <!-- Kleine weiße Blüten -->
      <circle cx="40" cy="12" r="5" fill="white" opacity=".9"/>
      <circle cx="40" cy="12" r="3" fill="#FFE8B0"/>
      <circle cx="16" cy="18" r="4.5" fill="white" opacity=".85"/>
      <circle cx="16" cy="18" r="2.5" fill="#FFE8B0"/>
      <circle cx="64" cy="10" r="4.5" fill="white" opacity=".85"/>
      <circle cx="64" cy="10" r="2.5" fill="#FFE8B0"/>
    </svg>`,
  },

  // ─────────────────────────────────────────────────────────────
  // 🌸 KIRSCHBLÜTE
  // 0–60%: normaler Baum mit grünen Blättern
  // 80%: erste vereinzelte rosa Blüten
  // 100%: voller Kirschblütenbaum
  // ─────────────────────────────────────────────────────────────
  cherryblossom: {
    seed: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="64" rx="18" ry="5" fill="#C5A882" opacity=".28"/>
      <ellipse cx="40" cy="60" rx="9" ry="7" fill="#6B4226"/>
      <ellipse cx="40" cy="57" rx="6" ry="5" fill="#8B5C30"/>
      <!-- Kleine rötliche Keimlinge angedeutet -->
      <line x1="38" y1="55" x2="37" y2="51" stroke="#9A7A5A" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>
      <line x1="42" y1="54" x2="43" y2="50" stroke="#9A7A5A" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>
    </svg>`,
    sprout: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="68" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <!-- Dünner Stamm -->
      <line x1="40" y1="67" x2="40" y2="40" stroke="#8B5C30" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Erste grüne Blättchen — spitz wie Kirschblätter -->
      <path d="M40 52 Q30 48 28 40 Q36 38 40 48" fill="#6A9A3A"/>
      <path d="M40 48 Q50 44 52 36 Q44 34 40 44" fill="#7AAF42" opacity=".88"/>
    </svg>`,
    small_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="70" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <!-- Stamm — leicht verdreht, charakteristisch -->
      <path d="M40 69 Q41 58 39 44 Q38 34 40 22" stroke="#7A4A20" stroke-width="4" stroke-linecap="round" fill="none"/>
      <!-- Zweige -->
      <path d="M39 44 Q26 40 22 28" stroke="#8B5C30" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M40 35 Q52 30 56 18" stroke="#8B5C30" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Grüne Blattwolken — oval, charakteristisch Kirsche -->
      <ellipse cx="22" cy="25" rx="10" ry="7" fill="#5A9A3A" opacity=".9"/>
      <ellipse cx="56" cy="16" rx="9"  ry="7" fill="#6AAF42" opacity=".85"/>
      <ellipse cx="40" cy="19" rx="11" ry="7" fill="#5A9A3A"/>
    </svg>`,
    medium_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="72" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <!-- Stamm — stärker, typisch Kirschbaum -->
      <path d="M40 71 Q42 60 38 48 Q36 38 40 24 Q41 16 42 10" stroke="#6B3A18" stroke-width="5" stroke-linecap="round" fill="none"/>
      <!-- Seitenzweige -->
      <path d="M38 52 Q22 48 16 34" stroke="#7A4A20" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M40 40 Q56 34 62 20" stroke="#7A4A20" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M41 28 Q26 22 24 10" stroke="#7A4A20" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Grüne Krone — breit und üppig -->
      <ellipse cx="16" cy="30" rx="12" ry="9"  fill="#4A8A28" opacity=".9"/>
      <ellipse cx="62" cy="18" rx="11" ry="8"  fill="#5A9A32" opacity=".85"/>
      <ellipse cx="24" cy="8"  rx="11" ry="7"  fill="#4A8A28" opacity=".88"/>
      <ellipse cx="42" cy="7"  rx="14" ry="8"  fill="#5A9A32"/>
      <ellipse cx="56" cy="10" rx="9"  ry="6"  fill="#4A8A28" opacity=".82"/>
    </svg>`,
    large_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="74" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <!-- Kräftiger Stamm -->
      <path d="M40 73 Q43 62 38 50 Q35 40 40 26 Q42 16 42 8" stroke="#5A3010" stroke-width="6" stroke-linecap="round" fill="none"/>
      <!-- Große Äste -->
      <path d="M38 54 Q20 50 14 34" stroke="#6B3A18" stroke-width="3.5" stroke-linecap="round" fill="none"/>
      <path d="M40 42 Q58 36 65 20" stroke="#6B3A18" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M41 30 Q24 24 22 10" stroke="#6B3A18" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M42 20 Q58 14 62 4" stroke="#6B3A18" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Krone — hauptsächlich grün mit ERSTEN vereinzelten rosa Blüten -->
      <ellipse cx="14" cy="30" rx="13" ry="10" fill="#4A8A28" opacity=".88"/>
      <ellipse cx="65" cy="18" rx="12" ry="9"  fill="#5A9A32" opacity=".84"/>
      <ellipse cx="22" cy="8"  rx="12" ry="8"  fill="#4A8A28" opacity=".88"/>
      <ellipse cx="42" cy="5"  rx="16" ry="9"  fill="#5A9A32"/>
      <ellipse cx="60" cy="7"  rx="10" ry="7"  fill="#4A8A28" opacity=".82"/>
      <!-- Erste vereinzelte rosa Blüten — noch wenige -->
      <circle cx="10" cy="24" r="3.5" fill="#FBCFE8" opacity=".9"/>
      <circle cx="18" cy="20" r="3"   fill="#F9A8D4" opacity=".85"/>
      <circle cx="66" cy="12" r="3.5" fill="#FBCFE8" opacity=".88"/>
      <circle cx="28" cy="5"  r="3"   fill="#F9A8D4" opacity=".82"/>
      <circle cx="52" cy="4"  r="3.5" fill="#FBCFE8" opacity=".85"/>
    </svg>`,
    flowering: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="74" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <!-- Stamm — nun dunkelgrau/braun, wie echter Kirschbaum im Frühling -->
      <path d="M40 73 Q43 62 38 50 Q35 40 40 26 Q42 16 42 8" stroke="#4A2A08" stroke-width="6" stroke-linecap="round" fill="none"/>
      <!-- Äste -->
      <path d="M38 54 Q20 50 14 34" stroke="#5A3010" stroke-width="3.5" stroke-linecap="round" fill="none"/>
      <path d="M40 42 Q58 36 65 20" stroke="#5A3010" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M41 30 Q24 24 22 10" stroke="#5A3010" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M42 20 Q58 14 62 4" stroke="#5A3010" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- VOLLE rosa Krone — Haupteindruck rosa, Frühling -->
      <ellipse cx="14" cy="30" rx="14" ry="11" fill="#FBCFE8" opacity=".88"/>
      <ellipse cx="65" cy="18" rx="13" ry="10" fill="#F9A8D4" opacity=".85"/>
      <ellipse cx="22" cy="8"  rx="13" ry="9"  fill="#FBCFE8" opacity=".9"/>
      <ellipse cx="42" cy="5"  rx="18" ry="10" fill="#F9A8D4" opacity=".92"/>
      <ellipse cx="60" cy="8"  rx="11" ry="8"  fill="#FBCFE8" opacity=".85"/>
      <!-- Einzelne Blüten sichtbar — 5-blättrig -->
      <!-- Blüte 1 -->
      <circle cx="8"  cy="26" r="5" fill="#F9A8D4" opacity=".9"/>
      <circle cx="8"  cy="26" r="2.5" fill="#F472B6"/>
      <!-- Blüte 2 -->
      <circle cx="20" cy="16" r="4.5" fill="#FBCFE8" opacity=".88"/>
      <circle cx="20" cy="16" r="2"   fill="#F472B6"/>
      <!-- Blüte 3 -->
      <circle cx="38" cy="3"  r="5" fill="#F9A8D4" opacity=".9"/>
      <circle cx="38" cy="3"  r="2.5" fill="#F472B6"/>
      <!-- Blüte 4 -->
      <circle cx="60" cy="4"  r="4.5" fill="#FBCFE8" opacity=".88"/>
      <circle cx="60" cy="4"  r="2"   fill="#F472B6"/>
      <!-- Blüte 5 -->
      <circle cx="67" cy="14" r="5" fill="#F9A8D4" opacity=".88"/>
      <circle cx="67" cy="14" r="2.5" fill="#F472B6"/>
      <!-- Herabfallende Blütenblätter -->
      <ellipse cx="22" cy="44" rx="2" ry="3.5" fill="#FBCFE8" opacity=".6" transform="rotate(20 22 44)"/>
      <ellipse cx="56" cy="40" rx="2" ry="3.5" fill="#F9A8D4" opacity=".55" transform="rotate(-15 56 40)"/>
      <ellipse cx="14" cy="48" rx="1.5" ry="3" fill="#FBCFE8" opacity=".5" transform="rotate(35 14 48)"/>
    </svg>`,
  },

};

function buildPlantSvg(stage, plantType) {
  const type = plantType || 'sunflower';
  const plantSet = PLANT_SVGS[type] || PLANT_SVGS.sunflower;
  return plantSet[stage] || plantSet.seed;
}

// Kept for backward compat (used in progress bar color)
function getColors(plantType) {
  const MAP = {
    sunflower:     { stem: '#8B9E3A', leaf: '#A8BC48' },
    cactus:        { stem: '#4A9E5C', leaf: '#5CB87A' },
    bonsai:        { stem: '#6B4226', leaf: '#5A8A3C' },
    potplant:      { stem: '#5C8A3C', leaf: '#7AAF50' },
    cherryblossom: { stem: '#7A4A2A', leaf: '#6B8C3E' },
  };
  return MAP[plantType] || MAP.sunflower;
}

function renderFinanzgarten() {
  const card = document.getElementById('budget-garden-card');
  if (!card) return;

  // Finanzbaum
  const treeLevel = getTreeStage(kontostand);
  const treeKsStr = kontostand !== null
    ? kontostand.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €'
    : '—';

  // Active goal — persisted by ID
  let activeGoalId = DB.get('gardenActiveGoalId', null);
  let activeGoal   = budgetGoals.find(g => g.id === activeGoalId) || budgetGoals[0] || null;
  if (activeGoal && activeGoal.id !== activeGoalId) DB.set('gardenActiveGoalId', activeGoal.id);

  let goalPct = 0, goalStage = 'seed';
  if (activeGoal) {
    goalPct   = activeGoal.target > 0 ? Math.min(100, Math.round((activeGoal.current / activeGoal.target) * 100)) : 0;
    goalStage = getGoalStage(goalPct);
  }
  const plantType  = activeGoal?.plantType || 'sunflower';
  const plantEmoji = PLANT_EMOJIS[plantType] || '🌱';
  const plantName  = PLANT_NAMES[plantType] || 'Pflanze';

  // Render
  card.innerHTML = `
    <div class="b-garden-header">
      <div class="b-garden-title-block">
        <span class="b-garden-emoji">🌿</span>
        <span class="b-garden-title">Finanzgarten</span>
      </div>
      ${budgetGoals.length > 0 ? `
        <button class="b-garden-select-btn" id="garden-select-goal-btn">
          ${activeGoal ? `${plantEmoji} ${activeGoal.name}` : 'Ziel wählen'}
          <span class="b-garden-select-arrow">▾</span>
        </button>` : ''}
    </div>

    <div class="b-garden-scene">
      <!-- Finanzbaum links -->
      <div class="b-garden-plant">
        <div class="b-garden-stage-label">${treeLevel.label}</div>
        <div class="b-garden-svg">${buildFinanzbaumSvg(treeLevel.stage)}</div>
        <div class="b-garden-plant-name">Finanzbaum</div>
        <div class="b-garden-plant-val">${treeKsStr}</div>
        <div class="b-garden-mini-bar">
          ${getGardenTreeLevels().map((lv) => `<div class="b-garden-pip${kontostand !== null && kontostand >= lv.min ? ' filled' : ''}"></div>`).join('')}
        </div>
      </div>

      <!-- Trennlinie -->
      <div class="b-garden-fence">
        ${Array(6).fill('<div class="b-garden-fence-post"></div>').join('')}
        <div class="b-garden-fence-rail"></div>
      </div>

      <!-- Sparziel rechts -->
      <div class="b-garden-plant">
        ${activeGoal ? `
          <div class="b-garden-stage-label">${goalPct}%</div>
          <div class="b-garden-svg">${buildPlantSvg(goalStage, plantType)}</div>
          <div class="b-garden-plant-name">${activeGoal.name}</div>
          <div class="b-garden-plant-val">${activeGoal.current.toLocaleString('de-DE',{minimumFractionDigits:2})} / ${activeGoal.target.toLocaleString('de-DE',{minimumFractionDigits:2})} €</div>
          <div class="b-garden-progress-bar">
            <div class="b-garden-progress-fill" style="width:${goalPct}%; background: linear-gradient(to right, ${getColors(plantType).leaf}, ${getColors(plantType).stem})"></div>
          </div>
        ` : `
          <div class="b-garden-stage-label" style="opacity:.4">—</div>
          <div class="b-garden-svg b-garden-svg-empty">${buildPlantSvg('seed','sunflower')}</div>
          <div class="b-garden-plant-name" style="color:var(--text-3)">Kein Ziel</div>
          <div class="b-garden-plant-val" style="color:var(--text-3);font-size:11px;">Sparziel hinzufügen</div>
        `}
      </div>
    </div>
    <div class="b-garden-ground"></div>
  `;

  // Goal selector dropdown — angehängt an body, um overflow:hidden der Card zu umgehen
  const selectBtn = card.querySelector('#garden-select-goal-btn');
  if (selectBtn && budgetGoals.length > 0) {
    selectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Bestehende Dropdowns entfernen
      document.getElementById('garden-dropdown')?.remove();

      const dd = document.createElement('div');
      dd.id = 'garden-dropdown';
      dd.className = 'b-garden-dropdown';

      budgetGoals.forEach(g => {
        const item = document.createElement('button');
        item.className = 'b-garden-dropdown-item' + (g.id === activeGoal?.id ? ' active' : '');
        const emoji = PLANT_EMOJIS[g.plantType] || '🌱';
        const pct   = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
        item.innerHTML = `<span>${emoji} ${g.name}</span><span class="b-garden-dd-pct">${pct}%</span>`;
        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          DB.set('gardenActiveGoalId', g.id);
          dd.remove();
          renderFinanzgarten();
        });
        dd.appendChild(item);
      });

      // Position: direkt unterhalb des Buttons, fixed im Viewport
      document.body.appendChild(dd);
      const rect = selectBtn.getBoundingClientRect();
      dd.style.position = 'fixed';
      dd.style.top  = (rect.bottom + 4) + 'px';
      dd.style.right = (window.innerWidth - rect.right) + 'px';
      dd.style.left = 'auto';

      // Schließen bei Klick außerhalb
      function closeDropdown(ev) {
        if (!dd.contains(ev.target) && ev.target !== selectBtn) {
          dd.remove();
          document.removeEventListener('click', closeDropdown);
        }
      }
      setTimeout(() => document.addEventListener('click', closeDropdown), 10);
    });
  }
}

// Kontostand Modal — bearbeitet kontostand direkt
function openKontostandModal() {
  document.getElementById('kontostand-input').value = kontostand !== null ? kontostand.toFixed(2) : '';
  document.getElementById('kontostand-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('kontostand-input').focus(), 50);
}
document.getElementById('kontostand-modal-close').addEventListener('click', () => document.getElementById('kontostand-modal-overlay').classList.add('hidden'));
document.getElementById('kontostand-cancel').addEventListener('click',       () => document.getElementById('kontostand-modal-overlay').classList.add('hidden'));
document.getElementById('kontostand-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('kontostand-modal-overlay')) document.getElementById('kontostand-modal-overlay').classList.add('hidden');
});
document.getElementById('kontostand-save').addEventListener('click', () => {
  const val = parseFloat(document.getElementById('kontostand-input').value);
  if (isNaN(val)) return;
  kontostand = val;
  saveKontostand();
  document.getElementById('kontostand-modal-overlay').classList.add('hidden');
  renderBudget();
});

// =========================
// BUDGET ROW
// =========================

function makeBudgetRow({ name, amount, type, priority, paid, subtitle, subtitleHtml, onEdit, onDel, onPaidToggle }) {
  const row = document.createElement('div');
  row.className = 'budget-row' + (paid ? ' budget-row-paid' : '');

  const left = document.createElement('div');
  left.className = 'budget-row-left';

  const nameRow = document.createElement('div');
  nameRow.className = 'budget-row-name-row';
  const nm = document.createElement('span');
  nm.className = 'budget-row-name';
  nm.textContent = name;
  if (type === 'expense') {
    const badge = document.createElement('span');
    badge.className = `budget-badge ${priorityClass(priority)}`;
    badge.textContent = priorityLabel(priority);
    nameRow.append(nm, badge);
  } else {
    nameRow.append(nm);
  }
  left.appendChild(nameRow);

  if (subtitleHtml) {
    const sub = document.createElement('div');
    sub.className = 'budget-row-sub-html';
    sub.innerHTML = subtitleHtml;
    left.appendChild(sub);
  } else if (subtitle) {
    const sub = document.createElement('span');
    sub.className = 'budget-row-sub';
    sub.textContent = subtitle;
    left.appendChild(sub);
  }

  const right = document.createElement('div');
  right.className = 'budget-row-right';

  const paidBtn = document.createElement('button');
  paidBtn.className = 'budget-paid-btn' + (paid ? ' paid' : '');
  paidBtn.title = paid ? 'Als offen markieren' : 'Als bezahlt markieren';
  paidBtn.textContent = paid ? '✓' : '○';
  paidBtn.addEventListener('click', e => { e.stopPropagation(); onPaidToggle(); });

  const amt = document.createElement('span');
  amt.className = 'budget-row-amount';
  amt.textContent = (type === 'income' ? '+' : '-') + amount.toFixed(2) + ' €';
  amt.style.color = type === 'income' ? 'var(--budget-income)' : 'var(--budget-expense)';

  const del = document.createElement('button');
  del.className = 'task-delete';
  del.textContent = '✕';
  del.addEventListener('click', onDel);

  if (onEdit) {
    const editBtn = document.createElement('button');
    editBtn.className = 'budget-edit-btn';
    editBtn.title = 'Bearbeiten';
    editBtn.innerHTML = '&#9998;';
    editBtn.addEventListener('click', e => { e.stopPropagation(); onEdit(); });
    right.append(paidBtn, amt, editBtn, del);
  } else {
    right.append(paidBtn, amt, del);
  }

  row.append(left, right);
  return row;
}

// =========================
// TIMELINE
// =========================

function renderBudgetTimeline(){
  const tl = document.getElementById('budget-timeline');
  tl.innerHTML = '';
  const now = new Date(); now.setHours(0,0,0,0);
  const upcoming = [];

  for (let offset = 0; offset < 60; offset++) {
    const d  = new Date(now); d.setDate(now.getDate() + offset);
    const dy = d.getDate(), dm = d.getMonth() + 1;
    const mk = budgetMonthKey(d);
    budgetRecurring.forEach(r => {
      let match = false;
      if (r.freq === 'monthly' && r.day === dy) match = true;
      if (r.freq === 'yearly' && r.dateDay === dy && r.dateMonth === dm) match = true;
      if (match) {
        upcoming.push({
          date: new Date(d), name: r.name, amount: r.amount,
          type: r.type, priority: r.priority || 'need',
          paid: isRecurringPaid(r.id, mk)
        });
      }
    });
  }

  const prioOrder = { must: 0, need: 1, want: 2, none: 1 };
  upcoming.sort((a,b) => {
    const dd = a.date - b.date;
    if (dd !== 0) return dd;
    return (prioOrder[a.priority] ?? 1) - (prioOrder[b.priority] ?? 1);
  });

  upcoming.slice(0, 10).forEach(item => {
    const row = document.createElement('div');
    row.className = 'budget-timeline-row' + (item.paid ? ' budget-row-paid' : '');
    const ds = document.createElement('span'); ds.className = 'budget-timeline-date';
    ds.textContent = item.date.toLocaleDateString('de-DE', {day:'numeric', month:'short'});
    const nm = document.createElement('span'); nm.className = 'budget-timeline-name';
    nm.textContent = item.name;
    const badgeEl = document.createElement('span');
    if (item.type === 'expense') {
      badgeEl.className = `budget-badge ${priorityClass(item.priority)}`;
      badgeEl.textContent = priorityLabel(item.priority);
    }
    const am = document.createElement('span'); am.className = 'budget-timeline-amount';
    am.textContent = (item.type === 'income' ? '+' : '-') + item.amount.toFixed(2) + ' €';
    am.style.color = item.type === 'income' ? 'var(--budget-income)' : 'var(--budget-expense)';
    row.append(ds, nm, badgeEl, am);
    tl.appendChild(row);
  });

  if (upcoming.length === 0) tl.innerHTML = '<div class="empty-state">Keine bevorstehenden Buchungen.</div>';
}

// =========================
// GOALS
// =========================

function renderBudgetGoals(){
  const container = document.getElementById('budget-goals-list');
  container.innerHTML = '';
  if (budgetGoals.length === 0) { container.innerHTML = '<div class="empty-state">Noch keine Sparziele.</div>'; return; }
  budgetGoals.forEach(goal => {
    const pct  = goal.target > 0 ? Math.min(100, Math.round((goal.current/goal.target)*100)) : 0;
    const card = document.createElement('div'); card.className = 'budget-goal-card';
    const head = document.createElement('div'); head.className = 'budget-goal-head';
    const emoji = PLANT_EMOJIS[goal.plantType] || '🌱';
    const nm   = document.createElement('span'); nm.className = 'budget-row-name';
    nm.innerHTML = `<span class="budget-goal-emoji">${emoji}</span> ${goal.name}`;

    const actions = document.createElement('div'); actions.className = 'budget-goal-actions';
    const editBtn = document.createElement('button'); editBtn.className = 'budget-edit-btn';
    editBtn.title = 'Bearbeiten'; editBtn.innerHTML = '&#9998;';
    editBtn.addEventListener('click', e => { e.stopPropagation(); openEditGoalModal(goal); });
    const del  = document.createElement('button'); del.className = 'task-delete'; del.textContent = '✕';
    del.addEventListener('click', () => {
      budgetGoals = budgetGoals.filter(g => g.id !== goal.id);
      // If the active garden goal was deleted, clear the stored ID
      const activeId = DB.get('gardenActiveGoalId', null);
      if (activeId === goal.id) DB.set('gardenActiveGoalId', null);
      saveBudgetGoals(); renderBudgetGoals(); renderFinanzgarten(); renderSparplaner();
    });
    actions.append(editBtn, del);
    head.append(nm, actions);
    const bar  = document.createElement('div'); bar.className = 'budget-goal-bar';
    const fill = document.createElement('div'); fill.className = 'budget-goal-fill'; fill.style.width = pct + '%';
    bar.appendChild(fill);
    const info = document.createElement('div'); info.className = 'budget-goal-info-row';
    const txt  = document.createElement('span');
    txt.style.cssText = 'font-size:12px;color:var(--text-3);font-family:var(--mono);';
    txt.textContent = `${goal.current.toFixed(2)} € / ${goal.target.toFixed(2)} € (${pct}%)`;
    const btns = document.createElement('div'); btns.style.cssText = 'display:flex;gap:6px;';
    const dep  = document.createElement('button'); dep.className = 'btn-ghost'; dep.style.cssText = 'font-size:11px;padding:3px 10px;'; dep.textContent = 'Einzahlen';
    dep.addEventListener('click', () => openGoalTx(goal, 'deposit'));
    const wit  = document.createElement('button'); wit.className = 'btn-ghost'; wit.style.cssText = 'font-size:11px;padding:3px 10px;'; wit.textContent = 'Abheben';
    wit.addEventListener('click', () => openGoalTx(goal, 'withdraw'));
    btns.append(dep, wit); info.append(txt, btns);
    card.append(head, bar, info);
    container.appendChild(card);
  });
}

// =========================
// SPARPLÄNE — DATENMODELL
// Komplett unabhängig von budgetGoals/budgetRecurring und von der
// Sparprognose. Beantwortet "Ich möchte X bis Y — wie muss ich
// sparen?" statt "Was schafft mein aktuelles Budget?".
// Struktur je Plan:
//   { id, name, image, targetAmount (Zahl|null — null = ergibt sich
//     aus der Summe der Raten), startDate, endDate, interval,
//     method: 'constant'|'increasing'|'decreasing'|'custom',
//     entries: [{ id, date, amount, done }], linkedToBudget (reserviert
//     für eine spätere, hier bewusst noch nicht gebaute Budget-Kopplung),
//     createdAt }
// =========================
let budgetSavingsPlans = DB.get('budgetSavingsPlans', []);
function saveBudgetSavingsPlans(){ DB.set('budgetSavingsPlans', budgetSavingsPlans); }

const SP_INTERVAL_META = {
  daily:    { label: 'Täglich' },
  weekly:   { label: 'Wöchentlich' },
  biweekly: { label: 'Zweiwöchentlich' },
  monthly:  { label: 'Monatlich' },
  custom:   { label: 'Individuell' }, // Fallback für ältere Pläne ohne echtes Intervall
};
// Beschriftung der Positionen im individuellen Sparplan (KEINE Kalender-
// daten — nur "Woche N"/"Tag N"/... je nach gewähltem Intervall).
const SP_POSITION_LABELS = { daily: 'Tag', weekly: 'Woche', biweekly: '14 Tage', monthly: 'Monat' };
const SP_METHOD_META = {
  constant:   { label: 'Konstant' },
  increasing: { label: 'Steigend' },
  decreasing: { label: 'Fallend' },
  custom:     { label: 'Individuell' },
};

// Registry der Erzeugungs-Methoden innerhalb von "Individuell". Rein
// beschreibend (Label/Icon/Text) — die eigentliche Erzeugungslogik lebt
// zentral in sparplanGenFixed()/sparplanGenRandom(), damit hier später
// leicht weitere Methoden ergänzt werden können, ohne Berechnungscode
// zu duplizieren.
const SP_CUSTOM_GENERATORS = {
  fixed:    { label: 'Fester Betrag',     icon: '💶' },
  random:   { label: 'Zufällige Beträge', icon: '🎲' },
  manual:   { label: 'Eigene Einträge',   icon: '✏️' },
  template: { label: 'Aus Vorlage',       icon: '📋' },
};

// Registry für künftige Sparvorlagen (1-Cent-Challenge, 5-Euro-Schein-
// Challenge, Münz-Challenge, Zufalls-Challenge, steigend/fallend, ...).
// Bewusst noch leer — eine Vorlage ist später nur ein weiterer Eintrag
// mit { label, icon, desc, build(count) => [Beträge] }, ohne dass
// Wizard- oder Speicherlogik angepasst werden muss.
const SP_TEMPLATE_REGISTRY = {};

function sparplanNewId() { return `sp_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`; }

// Lokales Datum → 'YYYY-MM-DD', ohne UTC-Verschiebung (analog budgetMonthKey)
// — wird nur noch von den Varianten "Zielbetrag"/"Sparrate" benutzt, die
// echte Kalendertermine haben. "Individuell" arbeitet rein positionsbasiert.
function sparplanDateStr(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function sparplanFormatDate(dateStr){
  if (!dateStr) return '–';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function sparplanPositionLabel(interval, position){
  return `${SP_POSITION_LABELS[interval] || 'Rate'} ${position}`;
}
// Zeigt eine Rate an — je nach Plantyp entweder als Position ("Woche 3",
// nur "Individuell") oder als echtes Kalenderdatum (alle anderen Varianten).
// Zentrale Stelle, damit Karte/Detailansicht nicht zwischen beiden Fällen
// unterscheiden müssen.
function sparplanEntryLabel(plan, entry){
  if (plan.method === 'custom') return sparplanPositionLabel(plan.interval, plan.entries.indexOf(entry) + 1);
  return sparplanFormatDate(entry.date);
}
// Liefert die offenen/erledigten Raten eines Plans in der richtigen
// Reihenfolge. Bei "Individuell" entspricht die Array-Reihenfolge bereits
// der Position (keine Kalenderdaten, daher keine Sortierung nötig); bei
// den anderen Varianten wird chronologisch nach Datum sortiert. Einzige
// Stelle im Code, an der Raten-Reihenfolge entschieden wird.
function sparplanOrderedEntries(plan, done){
  const filtered = plan.entries.filter(e => e.done === done);
  if (plan.method === 'custom') return filtered;
  return filtered.sort((a, b) => a.date.localeCompare(b.date));
}

// Nächster Termin je Intervall — 'T00:00:00' verhindert UTC-Tagesverschiebung
// (gleiches Muster wie beim "Gespart bis..."-Rechner weiter unten).
function sparplanAddInterval(date, interval){
  const d = new Date(date);
  if (interval === 'monthly') { d.setMonth(d.getMonth() + 1); return d; }
  const days = interval === 'weekly' ? 7 : interval === 'biweekly' ? 14 : 1;
  d.setDate(d.getDate() + days);
  return d;
}
function sparplanGenerateDates(startStr, endStr, interval){
  const dates = [];
  let cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  if (cur > end) return [cur];
  let guard = 0;
  while (cur <= end && guard < 2000) {
    dates.push(new Date(cur));
    cur = sparplanAddInterval(cur, interval);
    guard++;
  }
  return dates;
}

// ── Individuell-Generatoren — zentrale Erzeugungslogik für Beträge.
// Liefern reine Betrags-Listen (keine Kalenderdaten!) — die Position
// jeder Rate ergibt sich ausschließlich aus ihrem Index in der bereits
// bestehenden Liste (spwCustomEntries.length + i), berechnet an der
// einzigen Stelle im Wizard, an der Einträge angehängt werden. ──
function sparplanGenFixed({ amount, count }){
  return new Array(count).fill(round2(amount));
}
// Ganzzahliger Zufallsbetrag zwischen min und max (inklusive). Mit
// "Vielfaches von" werden ausschließlich Vielfache dieses Werts erzeugt,
// die innerhalb von [min, max] liegen — sonst ein gleichverteilter
// ganzzahliger Wert im Bereich.
function sparplanRandomAmount(min, max, multipleOf){
  if (multipleOf && multipleOf > 0) {
    const first = Math.ceil(min / multipleOf) * multipleOf;
    const last  = Math.floor(max / multipleOf) * multipleOf;
    if (last < first) return Math.round(first);
    const steps = Math.round((last - first) / multipleOf);
    return first + Math.floor(Math.random() * (steps + 1)) * multipleOf;
  }
  const lo = Math.ceil(min), hi = Math.floor(max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
function sparplanGenRandom({ min, max, count, multipleOf }){
  return Array.from({ length: count }, () => sparplanRandomAmount(min, max, multipleOf));
}

// Verteilt einen Zielbetrag auf n Termine nach Sparart. Rundungsdifferenzen
// landen bewusst auf dem letzten Termin, damit die Summe exakt stimmt.
function sparplanDistribute(n, total, method){
  if (n <= 0) return [];
  if (n === 1 || method === 'constant') {
    const each = round2(total / n);
    const arr = new Array(n).fill(each);
    arr[n - 1] = round2(total - each * (n - 1));
    return arr;
  }
  // steigend/fallend: lineare Rampe (60% → 140% des Durchschnitts), danach
  // exakt auf die Zielsumme skaliert.
  const avg = total / n;
  const lo = avg * 0.6, hi = avg * 1.4;
  let arr = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    arr.push(lo + (hi - lo) * t);
  }
  if (method === 'decreasing') arr.reverse();
  const rawSum = arr.reduce((s, v) => s + v, 0);
  arr = arr.map(v => round2(v * total / rawSum));
  const diff = round2(total - arr.reduce((s, v) => s + v, 0));
  arr[arr.length - 1] = round2(arr[arr.length - 1] + diff);
  return arr;
}
function sparplanBuildEntries(dates, amounts){
  const stamp = Date.now().toString(36);
  return dates.map((d, i) => ({ id: `spe_${stamp}_${i}`, date: sparplanDateStr(d), amount: amounts[i], done: false }));
}

// ── Abgeleitete Werte — nichts wird redundant gespeichert ──────
function sparplanTargetAmount(plan){
  return typeof plan.targetAmount === 'number' && plan.targetAmount > 0
    ? plan.targetAmount
    : round2(plan.entries.reduce((s, e) => s + e.amount, 0));
}
function sparplanCurrentAmount(plan){
  return round2(plan.entries.filter(e => e.done).reduce((s, e) => s + e.amount, 0));
}
function sparplanNextEntry(plan){
  return sparplanOrderedEntries(plan, false)[0] || null;
}
function sparplanProgressPct(plan){
  const target = sparplanTargetAmount(plan);
  if (!target) return plan.entries.length && plan.entries.every(e => e.done) ? 100 : 0;
  return Math.min(100, Math.round((sparplanCurrentAmount(plan) / target) * 100));
}
function sparplanEndDate(plan){
  if (plan.endDate) return plan.endDate;
  const last = plan.entries[plan.entries.length - 1];
  return last ? last.date : null;
}
// "Individuell" hat keine Kalenderdaten — hier zählt die Anzahl noch
// offener Raten statt der verbleibenden Zeit bis zu einem Datum.
function sparplanRemainingTimeLabel(plan){
  if (plan.method === 'custom') {
    const remaining = plan.entries.filter(e => !e.done).length;
    if (remaining === 0) return 'Abgeschlossen';
    return remaining === 1 ? 'noch 1 Rate' : `noch ${remaining} Raten`;
  }
  const endStr = sparplanEndDate(plan);
  if (!endStr) return '–';
  const months = sparplanerMonthsUntil(new Date(endStr + 'T00:00:00'));
  if (months <= 0) return 'diese Periode';
  return months === 1 ? 'noch 1 Monat' : `noch ${months} Monate`;
}
function getSparplanById(id){ return budgetSavingsPlans.find(p => p.id === id) || null; }

// =========================
// SPARPLÄNE — RENDERING
// =========================
function buildSparplanCard(plan){
  const target  = sparplanTargetAmount(plan);
  const current = sparplanCurrentAmount(plan);
  const pct     = sparplanProgressPct(plan);
  const next    = sparplanNextEntry(plan);

  const card = document.createElement('div'); card.className = 'sp-plan-card';
  card.innerHTML = `
    <div class="sp-plan-card-head">
      <span class="sp-plan-card-name">${plan.image ? plan.image + ' ' : '🐷 '}${plan.name}</span>
      <span class="budget-badge sp-plan-badge">${SP_INTERVAL_META[plan.interval]?.label || plan.interval}</span>
    </div>
    <div class="budget-goal-bar sp-plan-bar"><div class="budget-goal-fill" style="width:${pct}%"></div></div>
    <div class="sp-plan-card-row">
      <span class="sp-plan-card-amounts">${fmtEuro(current)} <span class="sp-plan-card-amounts-of">/ ${fmtEuro(target)}</span></span>
      <span class="sp-plan-card-pct">${pct}%</span>
    </div>
    <div class="sp-plan-card-meta">
      <span>${next ? `Nächste Rate: ${fmtEuro(next.amount)} · ${sparplanEntryLabel(plan, next)}` : 'Alle Raten erledigt 🎉'}</span>
      <span>${sparplanRemainingTimeLabel(plan)}</span>
    </div>
    <button class="btn-ghost sp-plan-open-btn">Öffnen</button>`;
  card.querySelector('.sp-plan-open-btn').addEventListener('click', () => openSparplanDetail(plan.id));
  return card;
}
function renderSparplaeneGrid(){
  const grid = document.getElementById('sparplaene-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (budgetSavingsPlans.length === 0) {
    grid.innerHTML = '<div class="empty-state">Noch keine Sparpläne. Starte mit „+ Sparplan".</div>';
    return;
  }
  budgetSavingsPlans.forEach(plan => grid.appendChild(buildSparplanCard(plan)));
}
function renderSparplaene(){
  if (document.getElementById('budget-panel-sparplaene')?.classList.contains('hidden')) return;
  renderSparplaeneGrid();
}

// =========================
// SPARPLANER — RENDERING
// =========================

const SCENARIO_META = {
  garant: { label: 'Garantiert', desc: 'Nur feste Einnahmen & Ausgaben',   icon: '🛡️' },
  real:   { label: 'Realistisch', desc: '+ Ø variable Ein- & Ausgaben',    icon: '📊' },
  opt:    { label: 'Optimistisch',desc: 'Beste Fälle ein- & Ausgaben',     icon: '⭐' },
};

function renderSparplaner() {
  if (document.getElementById('budget-panel-sparplan')?.classList.contains('hidden')) return;

  const rates = sparplanerAllRates();
  const activeRate = sparplanerSimRate !== null ? sparplanerSimRate : rates[sparplanerScenario];

  renderSparplanScenarios(rates);
  renderSparplanIncomeExpense();
  renderSparplanGoals(rates);
  renderSparplanTimeline(activeRate);
  renderSparplanSimulator(rates);
  renderSparplanSummary(rates);
}

function fmtEuro(v) {
  const r = round2(v);
  return (r < 0 ? '-' : '') + Math.abs(r).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function renderSparplanScenarios(rates) {
  const el = document.getElementById('sparplan-scenarios');
  if (!el) return;
  el.innerHTML = `
    <div class="sp-scenarios-grid">
      ${['garant','real','opt'].map(key => {
        const m = SCENARIO_META[key];
        const bd = sparplanerScenarioBreakdown(key);
        const rechenweg = key === 'garant'
          ? `${fmtEuro(bd.fixedNet)} fest`
          : `${fmtEuro(bd.fixedNet)} fest ${bd.varNet >= 0 ? '+' : '−'} ${fmtEuro(Math.abs(bd.varNet))} ${key === 'real' ? 'Ø variabel' : 'Bestfall variabel'}`;
        return `
        <button class="sp-scen-card" data-scen="${key}" title="Als Basis für Zeitstrahl &amp; Simulator verwenden">
          <div class="sp-scen-eyebrow sp-scen-${key}">${m.icon} ${m.label}</div>
          <div class="sp-scen-desc">${m.desc}</div>
          <div class="sp-scen-value sp-scen-${key}">${fmtEuro(rates[key])}</div>
          <div class="sp-scen-sub">${rates[key] >= 0 ? 'verfügbar' : 'Unterdeckung'} / Monat</div>
          <div class="sp-scen-formula">${rechenweg} = ${fmtEuro(rates[key])}</div>
        </button>`;
      }).join('')}
    </div>
    <div class="sp-source-note" style="margin:8px 0 0;">ℹ️ Sonderfälle (jährliche Posten) fließen bewusst nicht automatisch in die Sparrate ein — sie sind unregelmäßig. Du siehst sie separat unten bei "Einnahmen &amp; Ausgaben" und kannst sie beim Bearbeiten eines Postens optional einbeziehen.</div>`;
  el.querySelectorAll('.sp-scen-card').forEach(card => {
    card.addEventListener('click', () => {
      sparplanerScenario = card.dataset.scen;
      saveSparplanerScenario();
      renderSparplaner();
    });
  });
}

function renderSparplanIncomeExpense() {
  const el = document.getElementById('sparplan-income-expense');
  if (!el) return;
  const b = sparplanerBuckets();
  const sum = arr => arr.reduce((s, r) => s + r.amount, 0);

  function rowHtml(r) {
    const range = r.certainty === 'variable' ? sparplanerRange(r) : null;
    const right = range
      ? `<span class="sp-row-range">${range.min.toLocaleString('de-DE',{minimumFractionDigits:0,maximumFractionDigits:2})}–${range.max.toLocaleString('de-DE',{minimumFractionDigits:0,maximumFractionDigits:2})} €</span><span class="sp-row-amt ${r.type}">Ø ${fmtEuro(range.avg)}</span>`
      : `<span></span><span class="sp-row-amt ${r.type}">${r.type === 'income' ? '+' : '−'}${fmtEuro(Math.abs(r.amount))}</span>`;
    return `<div class="sp-row"><span class="sp-row-name">${r.name}</span>${right}</div>`;
  }

  function group(label, cls, entries, totalLabel, total) {
    if (!entries.length) return '';
    return `
      <div class="sp-group">
        <div class="sp-group-label ${cls}"><span class="dot"></span> ${label}</div>
        ${entries.map(rowHtml).join('')}
        <div class="sp-group-total"><span>${totalLabel}</span><span>${fmtEuro(total)}</span></div>
      </div>`;
  }

  const fixedAll   = [...b.fixedIncome, ...b.fixedExpense];
  const varAll     = [...b.varIncome, ...b.varExpense];
  const sonderAll  = [...b.sonderIncome, ...b.sonderExpense];
  const fixedNet   = sum(b.fixedIncome) - sum(b.fixedExpense);
  const varNetAvg  = b.varIncome.reduce((s,r)=>s+sparplanerRange(r).avg,0) - b.varExpense.reduce((s,r)=>s+sparplanerRange(r).avg,0);
  const sonderNet  = sum(b.sonderIncome) - sum(b.sonderExpense);

  if (!fixedAll.length && !varAll.length && !sonderAll.length) {
    el.innerHTML = '<div class="empty-state">Noch keine wiederkehrenden Posten im Budget-Tab angelegt.</div>';
    return;
  }

  el.innerHTML =
    group('Garantiert', 'garant', fixedAll, 'Summe garantiert', fixedNet) +
    group('Variabel (Ø)', 'variabel', varAll, 'Saldo Ø', varNetAvg) +
    group('Sonderfälle', 'sonder', sonderAll, 'Saldo / Jahr', sonderNet) +
    `<div class="sp-source-note">↺ Einnahmen &amp; Ausgaben werden 1:1 aus dem Budget-Tab übernommen. Sicherheit (fest/variabel) und Einbeziehung von Sonderfällen lassen sich dort beim Bearbeiten eines Postens einstellen.</div>`;
}

function renderSparplanGoals(rates) {
  const el = document.getElementById('sparplan-goals');
  if (!el) return;
  if (!budgetGoals.length) {
    el.innerHTML = '<div class="empty-state">Noch keine Sparziele — leg oben eines an.</div>';
    return;
  }

  const etaByScenario = {
    garant: sparplanerETAs(rates.garant),
    real:   sparplanerETAs(rates.real),
    opt:    sparplanerETAs(rates.opt),
  };

  const rows = budgetGoals.map((g, i) => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    const emoji = PLANT_EMOJIS[g.plantType] || '🌱';
    const gEta = etaByScenario.garant[i], rEta = etaByScenario.real[i], oEta = etaByScenario.opt[i];

    let compareHtml = '<span class="sp-goal-compare none">– keine ETA</span>';
    if (g.eta) {
      const cmp = sparplanerCompareEta(g, rEta.date);
      if (!rEta.reached && cmp) {
        if (cmp.diffMonths === -Infinity) {
          compareHtml = `<span class="sp-goal-compare late">🔴 kein Sparbetrag verfügbar</span>`;
        } else if (cmp.diffMonths > 0) {
          compareHtml = `<span class="sp-goal-compare early">🟢 ${cmp.diffMonths} Mon. früher</span>`;
        } else if (cmp.diffMonths < 0) {
          compareHtml = `<span class="sp-goal-compare late">🔴 ${Math.abs(cmp.diffMonths)} Mon. später</span>`;
        } else {
          compareHtml = `<span class="sp-goal-compare early">🟢 genau im Plan</span>`;
        }
      } else if (rEta.reached) {
        compareHtml = `<span class="sp-goal-compare early">🟢 bereits erreicht</span>`;
      }
    }

    return `
      <div class="sp-goal-row">
        <div class="sp-goal-order">
          <button class="sp-order-btn" data-i="${i}" data-dir="-1" ${i===0?'disabled':''} title="Nach oben">▲</button>
          <span class="sp-goal-prio">${i + 1}</span>
          <button class="sp-order-btn" data-i="${i}" data-dir="1" ${i===budgetGoals.length-1?'disabled':''} title="Nach unten">▼</button>
        </div>
        <div class="sp-goal-name">
          <div class="sp-goal-name-top">${emoji} ${g.name} <span class="sp-goal-target">${fmtEuro(g.target)}</span></div>
          <div class="sp-goal-bar"><div class="sp-goal-fill" style="width:${pct}%"></div></div>
          <div class="sp-goal-progress-txt">${fmtEuro(g.current)} / ${fmtEuro(g.target)}</div>
        </div>
        <div class="sp-goal-eta-block">
          <span class="g" title="Garantiert">${gEta.reached ? 'erreicht' : sparplanerFormatEtaDate(gEta.date)}</span>
          <span class="r" title="Realistisch">${rEta.reached ? 'erreicht' : sparplanerFormatEtaDate(rEta.date)}</span>
          <span class="o" title="Optimistisch">${oEta.reached ? 'erreicht' : sparplanerFormatEtaDate(oEta.date)}</span>
        </div>
        ${compareHtml}
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="sp-goal-table-head"><span></span><span>Ziel</span><span>Fortschritt</span><span>ETA (G/R/O)</span><span>Vergleich</span></div>
    ${rows}
    <div class="sp-source-note">↕ Priorität per ▲ ▼ ändern — sobald ein Ziel erreicht ist, fließt der volle Sparbetrag automatisch ins nächste. Wunschtermin (ETA) lässt sich beim Bearbeiten eines Ziels setzen.</div>`;

  el.querySelectorAll('.sp-order-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.i, 10);
      const dir = parseInt(btn.dataset.dir, 10);
      const j = i + dir;
      if (j < 0 || j >= budgetGoals.length) return;
      [budgetGoals[i], budgetGoals[j]] = [budgetGoals[j], budgetGoals[i]];
      saveBudgetGoals();
      renderSparplaner();
    });
  });
}

function renderSparplanTimeline(activeRate) {
  const titleEl = document.getElementById('sparplan-timeline-title');
  const el = document.getElementById('sparplan-timeline');
  if (!el) return;

  const scenarioLabel = sparplanerSimRate !== null ? 'Simulation' : SCENARIO_META[sparplanerScenario].label;
  if (titleEl) titleEl.innerHTML = `🧭 Zeitstrahl <span style="font-weight:400;color:var(--text-3)">— Szenario: ${scenarioLabel}</span>`;

  if (!budgetGoals.length) {
    el.innerHTML = '<div class="empty-state">Noch keine Sparziele vorhanden.</div>';
    return;
  }

  const etas = sparplanerETAs(activeRate).filter(e => !e.reached && e.date);
  if (!etas.length) {
    el.innerHTML = '<div class="empty-state">Bei aktuellem Sparbetrag ist kein Ziel mehr offen oder die Sparrate reicht nicht aus.</div>';
    return;
  }
  etas.sort((a, b) => a.date - b.date);

  // ── Echte proportionale Zeitachse ──────────────────────────
  // Die Position jeder Karte richtet sich nach dem tatsächlichen
  // Datumsabstand, nicht nach der Reihenfolge der Ziele.
  const startDate = new Date(); startDate.setHours(0, 0, 0, 0);
  const endDate = etas[etas.length - 1].date;
  const totalMs = Math.max(1, endDate - startDate);
  const totalDays = totalMs / MS_PER_DAY;

  // Achsenbreite proportional zur Zeitspanne (mehr Zeit = mehr Platz),
  // mit sinnvollen Grenzen für sehr kurze bzw. sehr lange Horizonte.
  const trackWidth = Math.round(Math.min(2600, Math.max(680, totalDays * 2.6)));
  const CARD_W  = 116;              // an .sp-tl-card min-width in CSS gekoppelt
  const MIN_GAP = CARD_W + 18;      // Mindestabstand, bevor eine neue Zeile beginnt
  const ROW_H   = 108;              // vertikaler Abstand zwischen Zeilen

  // X-Position (px) je Ziel — proportional zum tatsächlichen Datum
  const points = etas.map(e => ({
    e,
    x: Math.round(((e.date - startDate) / totalMs) * trackWidth),
  }));

  // Überlappungs-Schutz: Ziele, die zeitlich zu nah beieinander liegen,
  // wandern in eine zusätzliche Zeile — die X-Position (= das Datum)
  // bleibt dabei exakt erhalten, nur die Höhe verschiebt sich.
  const rowsLastX = [];
  points.forEach(p => {
    let row = rowsLastX.findIndex(lastX => p.x - lastX >= MIN_GAP);
    if (row === -1) { row = rowsLastX.length; rowsLastX.push(p.x); }
    else rowsLastX[row] = p.x;
    p.row = row;
  });
  const maxRow = points.reduce((m, p) => Math.max(m, p.row), 0);

  // Jahresmarkierungen entlang der Achse
  const years = [];
  for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
    const jan1 = new Date(y, 0, 1);
    const clamped = jan1 < startDate ? startDate : jan1;
    years.push({ year: y, x: Math.round(((clamped - startDate) / totalMs) * trackWidth) });
  }

  const axisHeight = 40 + (maxRow + 1) * ROW_H + 30;

  const yearHtml = years.map(y => `
    <div class="sp-tl-year-line" style="left:${y.x}px"></div>
    <div class="sp-tl-year-label" style="left:${y.x}px">${y.year}</div>`).join('');

  const pointHtml = points.map(p => {
    const g = p.e.goal;
    const connectorH = 26 + p.row * ROW_H;
    return `
      <div class="sp-tl-point" style="left:${p.x}px">
        <div class="sp-tl-dot"></div>
        <div class="sp-tl-connector" style="height:${connectorH}px"></div>
        <div class="sp-tl-card" style="top:${connectorH + 6}px">
          <div class="sp-tl-month">${sparplanerFormatEtaDate(p.e.date)}</div>
          <div class="sp-tl-icon">${PLANT_EMOJIS[g.plantType] || '🌱'}</div>
          <div class="sp-tl-goal">${g.name}</div>
          <div class="sp-tl-amt">${fmtEuro(g.target)} erreicht</div>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="sp-timeline-wrap">
      <div class="sp-timeline-axis" style="width:${trackWidth}px;height:${axisHeight}px;">
        <div class="sp-tl-baseline" style="width:${trackWidth}px"></div>
        ${yearHtml}
        ${pointHtml}
      </div>
    </div>`;
}

function renderSparplanSimulator(rates) {
  const el = document.getElementById('sparplan-simulator');
  if (!el) return;

  const baseRate = rates[sparplanerScenario];
  const current = sparplanerSimRate !== null ? sparplanerSimRate : baseRate;
  const min = Math.min(0, Math.floor(baseRate - Math.abs(baseRate || 100)));
  const max = Math.ceil(Math.abs(baseRate || 100) * 2) + Math.abs(baseRate || 100);

  const topGoal = budgetGoals[0];
  const simEtas = sparplanerETAs(current);
  const topEtaHtml = topGoal
    ? `<div class="sp-sim-hint">${PLANT_EMOJIS[topGoal.plantType] || '🌱'} ${topGoal.name} bei diesem Betrag: <b>${simEtas[0].reached ? 'bereits erreicht' : sparplanerFormatEtaDate(simEtas[0].date)}</b></div>`
    : `<div class="sp-sim-hint">Noch keine Sparziele angelegt.</div>`;

  el.innerHTML = `
    <div class="sp-panel-title">🔮 Was-wäre-wenn?</div>
    <div style="font-size:11.5px;color:var(--text-3);margin-top:2px;">Monatlicher Sparbetrag — alle Prognosen aktualisieren sich sofort</div>
    <div class="sp-sim-value">${fmtEuro(current)}</div>
    <input type="range" min="${min}" max="${max}" value="${current}" step="1" class="sp-sim-slider" id="sparplan-sim-slider">
    <div class="sp-sim-labels"><span>${fmtEuro(min)}</span><span>${fmtEuro(baseRate)} ${SCENARIO_META[sparplanerScenario].label.toLowerCase()}</span><span>${fmtEuro(max)}</span></div>
    ${topEtaHtml}
    ${sparplanerSimRate !== null ? `<button class="sp-sim-reset" id="sparplan-sim-reset">Zurücksetzen</button>` : ''}
  `;

  const slider = document.getElementById('sparplan-sim-slider');
  slider.addEventListener('input', () => {
    sparplanerSimRate = parseFloat(slider.value);
    renderSparplanTimeline(sparplanerSimRate);
    renderSparplanSimulatorHintOnly();
  });
  slider.addEventListener('change', () => {
    // Volles Re-Render nach Loslassen, damit Titel/Reset-Button konsistent sind
    renderSparplaner();
  });

  const resetBtn = document.getElementById('sparplan-sim-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => { sparplanerSimRate = null; renderSparplaner(); });
}

// Leichtgewichtiges Update während des Sliders (kein volles Re-Render,
// um unnötige DOM-Operationen bei jeder Mausbewegung zu vermeiden).
function renderSparplanSimulatorHintOnly() {
  const valueEl = document.querySelector('#sparplan-simulator .sp-sim-value');
  const hintEl  = document.querySelector('#sparplan-simulator .sp-sim-hint');
  if (valueEl) valueEl.textContent = fmtEuro(sparplanerSimRate);
  if (hintEl && budgetGoals[0]) {
    const e = sparplanerETAs(sparplanerSimRate)[0];
    hintEl.innerHTML = `${PLANT_EMOJIS[budgetGoals[0].plantType] || '🌱'} ${budgetGoals[0].name} bei diesem Betrag: <b>${e.reached ? 'bereits erreicht' : sparplanerFormatEtaDate(e.date)}</b>`;
  }
}

function renderSparplanSummary(rates) {
  const el = document.getElementById('sparplan-tip-banner');
  if (!el) return;

  const bullets = [];
  bullets.push(`Garantiert stehen dir ${fmtEuro(rates.garant)} / Monat sicher zur Verfügung, realistisch im Schnitt ${fmtEuro(rates.real)}.`);

  const topGoal = budgetGoals[0];
  if (topGoal) {
    const rEta = sparplanerETAs(rates.real)[0];
    if (rEta.reached) {
      bullets.push(`Dein wichtigstes Ziel „${topGoal.name}“ ist bereits erreicht. 🎉`);
    } else if (rEta.date) {
      const cmp = sparplanerCompareEta(topGoal, rEta.date);
      bullets.push(`„${topGoal.name}“ erreichst du im realistischen Szenario voraussichtlich ${sparplanerFormatEtaDate(rEta.date)}.`);
      if (cmp && cmp.diffMonths !== -Infinity) {
        if (cmp.diffMonths > 0) bullets.push(`🟢 Das ist etwa ${cmp.diffMonths} Monate früher als dein Wunschtermin.`);
        else if (cmp.diffMonths < 0) bullets.push(`🔴 Nach aktueller Planung verfehlst du deinen Wunschtermin um ${Math.abs(cmp.diffMonths)} Monate.`);
      }
    } else {
      bullets.push(`Bei der aktuellen Sparrate ist kein Zeitpunkt für „${topGoal.name}“ absehbar.`);
    }
  }

  el.innerHTML = `
    <div class="b-tip-left">
      <div class="b-tip-icon">🌱</div>
      <div>
        <div class="b-tip-eyebrow">Zusammenfassung</div>
        <div class="b-tip-text"><ul>${bullets.map(b => `<li>${b}</li>`).join('')}</ul></div>
      </div>
    </div>`;
}

// Month navigation
// Month navigation — bind to both old IDs (in case they exist in index.html)
// and new nav IDs (from redesigned budget_section.html)
function bindMonthNav() {
  ['budget-month-prev', 'budget-month-nav-prev'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el._monthNavBound) {
      el._monthNavBound = true;
      el.addEventListener('click', () => {
        budgetMonth = new Date(budgetMonth.getFullYear(), budgetMonth.getMonth()-1, 1);
        renderBudget();
      });
    }
  });
  ['budget-month-next', 'budget-month-nav-next'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el._monthNavBound) {
      el._monthNavBound = true;
      el.addEventListener('click', () => {
        budgetMonth = new Date(budgetMonth.getFullYear(), budgetMonth.getMonth()+1, 1);
        renderBudget();
      });
    }
  });
}
bindMonthNav();

// =========================
// RECURRING MODAL (create + edit)
// =========================

let recurringType      = 'income';
let recurringFreq      = 'monthly';
let recurringPriority  = 'need';
let recurringCertainty = 'fixed';
let recurringEditId    = null;

// Sichtbarkeit der Sparplaner-Zusatzfelder je nach Rhythmus/Sicherheit
function updateRecurringSparplanFieldsVisibility() {
  document.getElementById('recurring-certainty-row').classList.toggle('hidden', recurringFreq !== 'monthly');
  document.getElementById('recurring-var-range-row').classList.toggle('hidden', recurringFreq !== 'monthly' || recurringCertainty !== 'variable');
  document.getElementById('recurring-sparplan-include-row').classList.toggle('hidden', recurringFreq !== 'yearly');

  // Bei "Variabel" ist der Betrag immer der Durchschnitt aus Min/Max —
  // manuelle Eingabe würde sonst von der Spanne abweichen können.
  const amountField = document.getElementById('recurring-amount');
  const isVariable = recurringFreq === 'monthly' && recurringCertainty === 'variable';
  amountField.readOnly = isVariable;
  amountField.classList.toggle('modal-input-readonly', isVariable);
  if (isVariable) syncRecurringAmountFromRange();
}

function syncRecurringAmountFromRange() {
  const min = parseFloat(document.getElementById('recurring-var-min').value);
  const max = parseFloat(document.getElementById('recurring-var-max').value);
  const avg = round2(((isNaN(min) ? 0 : min) + (isNaN(max) ? 0 : max)) / 2);
  document.getElementById('recurring-amount').value = avg;
}

function openRecurringModal(entry = null) {
  recurringEditId = entry ? entry.id : null;

  document.getElementById('recurring-modal-title').textContent =
    entry ? 'Buchung bearbeiten' : 'Wiederkehrender Posten';

  if (entry) {
    document.getElementById('recurring-name').value   = entry.name;
    document.getElementById('recurring-amount').value = entry.amount;
    recurringType      = entry.type;
    recurringFreq       = entry.freq;
    recurringPriority   = (entry.priority && entry.priority !== 'none') ? entry.priority : 'need';
    recurringCertainty  = entry.certainty === 'variable' ? 'variable' : 'fixed';
    document.getElementById('recurring-var-min').value = entry.varMin ?? '';
    document.getElementById('recurring-var-max').value = entry.varMax ?? '';
    document.getElementById('recurring-sparplan-include').checked = entry.includeInSparplan !== false;
    if (entry.freq === 'monthly') {
      document.getElementById('recurring-day').value        = entry.day || '';
      document.getElementById('recurring-date-day').value   = '';
      document.getElementById('recurring-date-month').value = '';
    } else {
      document.getElementById('recurring-day').value        = '';
      document.getElementById('recurring-date-day').value   = entry.dateDay   || '';
      document.getElementById('recurring-date-month').value = entry.dateMonth || '';
    }
  } else {
    ['recurring-name','recurring-amount','recurring-day','recurring-date-day','recurring-date-month','recurring-var-min','recurring-var-max']
      .forEach(id => document.getElementById(id).value = '');
    recurringType = 'income'; recurringFreq = 'monthly'; recurringPriority = 'need'; recurringCertainty = 'fixed';
    document.getElementById('recurring-sparplan-include').checked = true;
  }

  ['income','expense'].forEach(t =>
    document.getElementById(`recurring-type-${t}`).classList.toggle('active', t === recurringType));
  ['monthly','yearly'].forEach(f =>
    document.getElementById(`recurring-freq-${f}`).classList.toggle('active', f === recurringFreq));
  ['must','need','want'].forEach(p =>
    document.getElementById(`recurring-prio-${p}`).classList.toggle('active', p === recurringPriority));
  ['fixed','variable'].forEach(c =>
    document.getElementById(`recurring-certainty-${c}`).classList.toggle('active', c === recurringCertainty));

  document.getElementById('recurring-day-row').classList.toggle('hidden',  recurringFreq !== 'monthly');
  document.getElementById('recurring-date-row').classList.toggle('hidden', recurringFreq !== 'yearly');
  // Priority row: always visible, but dimmed for income entries
  document.getElementById('recurring-prio-row').classList.remove('hidden');
  document.getElementById('recurring-prio-row').classList.toggle('budget-prio-row-dimmed', recurringType !== 'expense');
  updateRecurringSparplanFieldsVisibility();

  document.getElementById('recurring-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('recurring-name').focus(), 50);
}

document.getElementById('add-recurring-btn').addEventListener('click', () => openRecurringModal());

['income','expense'].forEach(t => {
  document.getElementById(`recurring-type-${t}`).addEventListener('click', () => {
    recurringType = t;
    ['income','expense'].forEach(x =>
      document.getElementById(`recurring-type-${x}`).classList.toggle('active', x === t));
    document.getElementById('recurring-prio-row').classList.toggle('budget-prio-row-dimmed', t !== 'expense');
  });
});
['monthly','yearly'].forEach(f => {
  document.getElementById(`recurring-freq-${f}`).addEventListener('click', () => {
    recurringFreq = f;
    ['monthly','yearly'].forEach(x =>
      document.getElementById(`recurring-freq-${x}`).classList.toggle('active', x === f));
    document.getElementById('recurring-day-row').classList.toggle('hidden',  f !== 'monthly');
    document.getElementById('recurring-date-row').classList.toggle('hidden', f !== 'yearly');
    updateRecurringSparplanFieldsVisibility();
  });
});
['fixed','variable'].forEach(c => {
  document.getElementById(`recurring-certainty-${c}`).addEventListener('click', () => {
    recurringCertainty = c;
    ['fixed','variable'].forEach(x =>
      document.getElementById(`recurring-certainty-${x}`).classList.toggle('active', x === c));
    updateRecurringSparplanFieldsVisibility();
  });
});
['recurring-var-min','recurring-var-max'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    if (recurringCertainty === 'variable') syncRecurringAmountFromRange();
  });
});
['must','need','want'].forEach(p => {
  document.getElementById(`recurring-prio-${p}`).addEventListener('click', () => {
    recurringPriority = p;
    ['must','need','want'].forEach(x =>
      document.getElementById(`recurring-prio-${x}`).classList.toggle('active', x === p));
  });
});

document.getElementById('recurring-modal-close').addEventListener('click',  () => document.getElementById('recurring-modal-overlay').classList.add('hidden'));
document.getElementById('recurring-cancel').addEventListener('click',        () => document.getElementById('recurring-modal-overlay').classList.add('hidden'));
document.getElementById('recurring-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('recurring-modal-overlay'))
    document.getElementById('recurring-modal-overlay').classList.add('hidden');
});

document.getElementById('recurring-save').addEventListener('click', () => {
  const name = document.getElementById('recurring-name').value.trim();
  if (!name) return;

  // Sparplaner-Zusatzfelder — nur relevant/gesetzt je nach Rhythmus
  const certainty = recurringFreq === 'monthly' ? recurringCertainty : 'fixed';
  let varMin, varMax, amount;
  if (certainty === 'variable') {
    varMin = parseFloat(document.getElementById('recurring-var-min').value);
    varMax = parseFloat(document.getElementById('recurring-var-max').value);
    if (isNaN(varMin)) varMin = 0;
    if (isNaN(varMax)) varMax = 0;
    // amount ist bei Variabel IMMER der Durchschnitt aus Min/Max —
    // niemals ein separat eingegebener Wert (Quelle des früheren Bugs).
    amount = round2((varMin + varMax) / 2);
  } else {
    amount = parseFloat(document.getElementById('recurring-amount').value) || 0;
  }
  const includeInSparplan = recurringFreq === 'yearly'
    ? document.getElementById('recurring-sparplan-include').checked
    : true;

  function applySparplanFields(e) {
    e.certainty = certainty;
    if (certainty === 'variable') { e.varMin = varMin; e.varMax = varMax; }
    else { delete e.varMin; delete e.varMax; }
    e.includeInSparplan = includeInSparplan;
  }

  if (recurringEditId) {
    const idx = budgetRecurring.findIndex(r => r.id === recurringEditId);
    if (idx !== -1) {
      const e = budgetRecurring[idx];
      e.name     = name;
      e.amount   = amount;
      e.type     = recurringType;
      e.freq     = recurringFreq;
      e.priority = recurringType === 'expense' ? recurringPriority : 'none';
      if (recurringFreq === 'monthly') {
        e.day = parseInt(document.getElementById('recurring-day').value) || 1;
        delete e.dateDay; delete e.dateMonth;
      } else {
        e.dateDay   = parseInt(document.getElementById('recurring-date-day').value)   || 1;
        e.dateMonth = parseInt(document.getElementById('recurring-date-month').value) || 1;
        delete e.day;
      }
      applySparplanFields(e);
    }
  } else {
    const entry = {
      id: crypto.randomUUID(), name, amount,
      type: recurringType, freq: recurringFreq,
      priority: recurringType === 'expense' ? recurringPriority : 'none',
    };
    if (recurringFreq === 'monthly') {
      entry.day = parseInt(document.getElementById('recurring-day').value) || 1;
    } else {
      entry.dateDay   = parseInt(document.getElementById('recurring-date-day').value)   || 1;
      entry.dateMonth = parseInt(document.getElementById('recurring-date-month').value) || 1;
    }
    applySparplanFields(entry);
    budgetRecurring.push(entry);
  }

  saveBudgetRecurring();
  document.getElementById('recurring-modal-overlay').classList.add('hidden');
  recurringEditId = null;
  renderBudget();
});

// =========================
// ONE-TIME MODAL
// =========================

let onetimeType = 'expense', onetimePriority = 'need';

document.getElementById('add-onetime-btn').addEventListener('click', () => {
  document.getElementById('onetime-name').value = '';
  document.getElementById('onetime-amount').value = '';
  // Heutiges Datum als Standard
  const todayIso = new Date().toISOString().slice(0, 10);
  const dateField = document.getElementById('onetime-date');
  if (dateField) dateField.value = todayIso;
  onetimeType = 'expense'; onetimePriority = 'need';
  ['income','expense'].forEach(t =>
    document.getElementById(`onetime-type-${t}`).classList.toggle('active', t === 'expense'));
  ['must','need','want'].forEach(p =>
    document.getElementById(`onetime-prio-${p}`).classList.toggle('active', p === 'need'));
  document.getElementById('onetime-prio-row').classList.remove('hidden');
  document.getElementById('onetime-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('onetime-name').focus(), 50);
});

['income','expense'].forEach(t => {
  document.getElementById(`onetime-type-${t}`).addEventListener('click', () => {
    onetimeType = t;
    ['income','expense'].forEach(x =>
      document.getElementById(`onetime-type-${x}`).classList.toggle('active', x === t));
    document.getElementById('onetime-prio-row').classList.toggle('hidden', t !== 'expense');
  });
});
['must','need','want'].forEach(p => {
  document.getElementById(`onetime-prio-${p}`).addEventListener('click', () => {
    onetimePriority = p;
    ['must','need','want'].forEach(x =>
      document.getElementById(`onetime-prio-${x}`).classList.toggle('active', x === p));
  });
});

document.getElementById('onetime-modal-close').addEventListener('click',  () => document.getElementById('onetime-modal-overlay').classList.add('hidden'));
document.getElementById('onetime-cancel').addEventListener('click',        () => document.getElementById('onetime-modal-overlay').classList.add('hidden'));
document.getElementById('onetime-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('onetime-modal-overlay'))
    document.getElementById('onetime-modal-overlay').classList.add('hidden');
});
document.getElementById('onetime-save').addEventListener('click', () => {
  const name = document.getElementById('onetime-name').value.trim();
  if (!name) return;
  const amount = parseFloat(document.getElementById('onetime-amount').value) || 0;
  // Tag aus Datumsfeld lesen — Fallback: heutiger Tag
  const dateField = document.getElementById('onetime-date');
  let day = new Date().getDate();
  if (dateField && dateField.value) {
    const parsed = new Date(dateField.value);
    if (!isNaN(parsed)) day = parsed.getDate();
  }
  budgetOnetime.push({
    id: crypto.randomUUID(), name, type: onetimeType, amount,
    monthKey: budgetMonthKey(budgetMonth),
    priority: onetimeType === 'expense' ? onetimePriority : 'none',
    paid: false,
    day,
  });
  saveBudgetOnetime();
  document.getElementById('onetime-modal-overlay').classList.add('hidden');
  renderBudget();
});

// =========================
// GOAL MODALS
// =========================

// editingGoalId !== null  → goal-save aktualisiert das bestehende Ziel (Name/Icon/
// Zielbetrag/ETA), der angesparte Betrag bleibt unberührt (nur über Einzahlen/Abheben).
// editingGoalId === null → goal-save legt ein neues Ziel an (inkl. Startbetrag).
let editingGoalId = null;

function closeGoalModal() {
  document.getElementById('goal-modal-overlay').classList.add('hidden');
  editingGoalId = null;
}

document.getElementById('add-goal-btn').addEventListener('click', () => {
  editingGoalId = null;
  document.getElementById('goal-modal-title').textContent = 'Neues Sparziel';
  document.getElementById('goal-current-row').classList.remove('hidden');
  document.getElementById('goal-name').value = '';
  document.getElementById('goal-target').value = '';
  document.getElementById('goal-current').value = '';
  document.getElementById('goal-eta').value = '';
  // Reset plant selector to first option
  const firstRadio = document.querySelector('input[name="goal-plant"]');
  if (firstRadio) firstRadio.checked = true;
  document.getElementById('goal-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('goal-name').focus(), 50);
});

function openEditGoalModal(goal) {
  editingGoalId = goal.id;
  document.getElementById('goal-modal-title').textContent = 'Sparziel bearbeiten';
  // Der angesparte Betrag wird hier bewusst nicht angezeigt/editiert —
  // Änderungen daran laufen ausschließlich über Einzahlen/Abheben.
  document.getElementById('goal-current-row').classList.add('hidden');
  document.getElementById('goal-name').value = goal.name;
  document.getElementById('goal-target').value = goal.target;
  document.getElementById('goal-eta').value = goal.eta || '';
  const radio = document.querySelector(`input[name="goal-plant"][value="${goal.plantType}"]`);
  if (radio) radio.checked = true;
  else { const firstRadio = document.querySelector('input[name="goal-plant"]'); if (firstRadio) firstRadio.checked = true; }
  document.getElementById('goal-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('goal-name').focus(), 50);
}

document.getElementById('goal-modal-close').addEventListener('click',  closeGoalModal);
document.getElementById('goal-cancel').addEventListener('click',        closeGoalModal);
document.getElementById('goal-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('goal-modal-overlay')) closeGoalModal();
});
document.getElementById('goal-save').addEventListener('click', () => {
  const name = document.getElementById('goal-name').value.trim();
  if (!name) return;
  const target    = parseFloat(document.getElementById('goal-target').value) || 0;
  const plantRadio = document.querySelector('input[name="goal-plant"]:checked');
  const plantType = plantRadio ? plantRadio.value : 'sunflower';
  const etaVal = document.getElementById('goal-eta').value || null;

  if (editingGoalId) {
    const goal = budgetGoals.find(g => g.id === editingGoalId);
    if (goal) {
      goal.name = name;
      goal.target = target;
      goal.plantType = plantType;
      goal.eta = etaVal;
    }
    editingGoalId = null;
  } else {
    const current = parseFloat(document.getElementById('goal-current').value) || 0;
    budgetGoals.push({ id: crypto.randomUUID(), name, target, current, plantType, eta: etaVal });
  }
  saveBudgetGoals();
  document.getElementById('goal-modal-overlay').classList.add('hidden');
  renderBudgetGoals();
  renderFinanzgarten();
  renderSparplaner();
});

let goalTxTarget = null, goalTxMode = 'deposit';
function openGoalTx(goal, mode) {
  goalTxTarget = goal; goalTxMode = mode;
  document.getElementById('goal-tx-title').textContent =
    mode === 'deposit' ? `Einzahlen — ${goal.name}` : `Abheben — ${goal.name}`;
  document.getElementById('goal-tx-amount').value = '';
  document.getElementById('goal-tx-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('goal-tx-amount').focus(), 50);
}
document.getElementById('goal-tx-close').addEventListener('click',  () => document.getElementById('goal-tx-modal-overlay').classList.add('hidden'));
document.getElementById('goal-tx-cancel').addEventListener('click', () => document.getElementById('goal-tx-modal-overlay').classList.add('hidden'));
document.getElementById('goal-tx-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('goal-tx-modal-overlay'))
    document.getElementById('goal-tx-modal-overlay').classList.add('hidden');
});
document.getElementById('goal-tx-save').addEventListener('click', () => {
  if (!goalTxTarget) return;
  const amt = parseFloat(document.getElementById('goal-tx-amount').value) || 0;
  goalTxTarget.current = Math.max(0,
    goalTxMode === 'deposit' ? goalTxTarget.current + amt : goalTxTarget.current - amt);
  saveBudgetGoals();
  document.getElementById('goal-tx-modal-overlay').classList.add('hidden');
  renderBudgetGoals();
  renderFinanzgarten();
  renderSparplaner();
  goalTxTarget = null;
});

// =========================
// "GESPART BIS..." — kleine, eigenständige Zusatzrechnung
// Bewusst UNABHÄNGIG von Sparzielen: nutzt ausschließlich Datum,
// Szenario-Sparrate und optional den Kontostand. Ändert nichts am
// Sparplan selbst und wird von keiner anderen Funktion aufgerufen.
// =========================

// Monate zwischen heute und einem Zieldatum, als reine Kalendermonat-
// Differenz (konsistent mit der ETA-Logik an anderer Stelle).
function sparplanerMonthsUntil(targetDate) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate); target.setHours(0, 0, 0, 0);
  return (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
}

function sparplanerSavedBy(targetDate, scenario) {
  const months = Math.max(0, sparplanerMonthsUntil(targetDate));
  const rate = sparplanerScenarioRate(scenario);
  const saved = round2(months * rate);
  return { months, rate, saved };
}

let savedByScenario = null; // wird beim Öffnen mit dem aktuell aktiven Sparplaner-Szenario vorbelegt

function openSparplanSavedByModal() {
  document.getElementById('sparplan-savedby-result').innerHTML = '';
  document.getElementById('sparplan-savedby-date').value = '';
  savedByScenario = sparplanerScenario;
  ['garant','real','opt'].forEach(s =>
    document.getElementById(`sparplan-savedby-scen-${s}`).classList.toggle('active', s === savedByScenario));

  const kRow = document.getElementById('sparplan-savedby-kontostand-row');
  kRow.classList.toggle('hidden', kontostand === null);
  document.getElementById('sparplan-savedby-include-kontostand').checked = false;

  document.getElementById('sparplan-savedby-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('sparplan-savedby-date').focus(), 50);
}

const savedByBtn = document.getElementById('sparplan-savedby-btn');
if (savedByBtn) savedByBtn.addEventListener('click', openSparplanSavedByModal);

['garant','real','opt'].forEach(s => {
  document.getElementById(`sparplan-savedby-scen-${s}`).addEventListener('click', () => {
    savedByScenario = s;
    ['garant','real','opt'].forEach(x =>
      document.getElementById(`sparplan-savedby-scen-${x}`).classList.toggle('active', x === s));
  });
});

document.getElementById('sparplan-savedby-close').addEventListener('click', () =>
  document.getElementById('sparplan-savedby-modal-overlay').classList.add('hidden'));
document.getElementById('sparplan-savedby-cancel').addEventListener('click', () =>
  document.getElementById('sparplan-savedby-modal-overlay').classList.add('hidden'));
document.getElementById('sparplan-savedby-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('sparplan-savedby-modal-overlay'))
    document.getElementById('sparplan-savedby-modal-overlay').classList.add('hidden');
});

document.getElementById('sparplan-savedby-calc').addEventListener('click', () => {
  const dateVal = document.getElementById('sparplan-savedby-date').value;
  const resultEl = document.getElementById('sparplan-savedby-result');
  if (!dateVal) {
    resultEl.innerHTML = '<div class="sp-savedby-hint">Bitte zuerst ein Datum auswählen.</div>';
    return;
  }
  const targetDate = new Date(dateVal + 'T00:00:00');
  const { months, rate, saved } = sparplanerSavedBy(targetDate, savedByScenario);

  const includeKontostand = kontostand !== null && document.getElementById('sparplan-savedby-include-kontostand').checked;
  const total = includeKontostand ? round2(kontostand + saved) : saved;
  const dateLabel = targetDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (months <= 0) {
    resultEl.innerHTML = `<div class="sp-savedby-hint">Das gewählte Datum liegt im aktuellen Monat oder in der Vergangenheit — in diesem Zeitraum kommt noch nichts Neues hinzu.</div>`;
    return;
  }

  resultEl.innerHTML = `
    <div class="sp-savedby-result">
      <div class="sp-savedby-headline">Bis zum ${dateLabel} könntest du ungefähr</div>
      <div class="sp-savedby-total">${fmtEuro(total)}</div>
      <div class="sp-savedby-sub">angespart haben.</div>
      <div class="sp-savedby-breakdown">
        <div class="sp-savedby-row"><span>Zeitraum</span><span>${months} Monat${months === 1 ? '' : 'e'}</span></div>
        <div class="sp-savedby-row"><span>Szenario</span><span>${SCENARIO_META[savedByScenario].label}</span></div>
        <div class="sp-savedby-row"><span>Sparbetrag</span><span>${fmtEuro(rate)} / Monat</span></div>
        <div class="sp-savedby-calc">${months} × ${fmtEuro(rate)} = ${fmtEuro(saved)}</div>
        ${includeKontostand ? `<div class="sp-savedby-calc">${fmtEuro(kontostand)} + ${fmtEuro(saved)} = ${fmtEuro(total)}</div>` : ''}
      </div>
    </div>`;
});

// Wire secondary add-buttons — bind directly, no DOMContentLoaded proxy needed
// (DOMContentLoaded may have already fired by the time budget.js runs in a SPA)
// =========================
// FINANZBAUM KONFIGURATION
// =========================

function openFinanzbaumModal() {
  const levels = getTreeLevels();
  const rows   = document.getElementById('finanzbaum-config-rows');
  rows.innerHTML = '';
  levels.forEach((lv, i) => {
    const row = document.createElement('div');
    row.className = 'finanzbaum-config-row';
    row.innerHTML = `
      <label class="finanzbaum-config-label">${lv.label}</label>
      <div class="finanzbaum-config-input-wrap">
        <input type="number" class="modal-input finanzbaum-min-input" data-index="${i}"
          value="${lv.min}" min="0" step="50"
          style="width:110px;padding:6px 10px;font-size:13px;"
          ${i === 0 ? 'disabled title="Startpunkt ist immer 0 €"' : ''}/>
        <span class="finanzbaum-config-unit">€</span>
      </div>`;
    rows.appendChild(row);
  });
  document.getElementById('finanzbaum-modal-overlay').classList.remove('hidden');
}

document.getElementById('finanzbaum-config-btn').addEventListener('click', openFinanzbaumModal);
document.getElementById('finanzbaum-modal-close').addEventListener('click',  () => document.getElementById('finanzbaum-modal-overlay').classList.add('hidden'));
document.getElementById('finanzbaum-config-cancel').addEventListener('click', () => document.getElementById('finanzbaum-modal-overlay').classList.add('hidden'));
document.getElementById('finanzbaum-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('finanzbaum-modal-overlay'))
    document.getElementById('finanzbaum-modal-overlay').classList.add('hidden');
});

document.getElementById('finanzbaum-config-save').addEventListener('click', () => {
  const inputs = document.querySelectorAll('.finanzbaum-min-input');
  const mins   = Array.from(inputs).map((inp, i) => {
    if (i === 0) return 0; // Stufe 0 immer 0
    return Math.max(0, parseFloat(inp.value) || 0);
  });
  // Validierung: aufsteigend
  for (let i = 1; i < mins.length; i++) {
    if (mins[i] <= mins[i-1]) {
      inputs[i].setCustomValidity(`Muss größer als ${mins[i-1]} sein`);
      inputs[i].reportValidity();
      return;
    }
    inputs[i].setCustomValidity('');
  }
  DB.set('finanzbaumLevels', mins);
  document.getElementById('finanzbaum-modal-overlay').classList.add('hidden');
  renderFinanzgarten();
});

function bindSecondaryButtons() {
  const pairs = [
    ['add-recurring-btn-2',   'add-recurring-btn'],
    ['add-onetime-btn-2',     'add-onetime-btn'],
    ['add-goal-btn-2',        'add-goal-btn'],
    ['sparplan-add-goal-btn', 'add-goal-btn'],
  ];
  pairs.forEach(([srcId, targetId]) => {
    const srcEl    = document.getElementById(srcId);
    const targetEl = document.getElementById(targetId);
    if (srcEl && targetEl && !srcEl._secondaryBound) {
      srcEl._secondaryBound = true;
      srcEl.addEventListener('click', () => targetEl.click());
    }
  });
  // Re-run month nav binding in case the nav buttons appeared after initial load
  bindMonthNav();
}
bindSecondaryButtons();

// =========================
// SPARPLÄNE — ASSISTENT (Wizard)
// 3 Hauptvarianten, wie im Konzept beschrieben:
//   'target' — Zielbetrag bekannt, Nook berechnet die Sparrate
//   'rate'   — Sparrate bekannt, Nook berechnet den Endbetrag
//   'custom' — Individuell: EINE Ratenliste, die per Werkzeugleiste
//              additiv befüllt wird (siehe unten)
//
// Die Individuell-Variante hat KEINEN eigenen Zielbetrag — die Summe
// ergibt sich ausschließlich aus den erzeugten Einträgen. Die vier
// Werkzeuge (Registry: SP_CUSTOM_GENERATORS) sind keine exklusiven
// Varianten, sondern hängen ihr Ergebnis an dieselbe Liste
// (spwCustomEntries / #spw-custom-rows) an — beliebig oft kombinierbar.
// =========================
let spwVariant = null;
let spwMethod  = 'constant';
let spwInterval = 'weekly'; // gemeinsames Intervall für den GESAMTEN individuellen Plan
let spwCustomEntries = []; // [{amount}] — DIE eine Ratenliste, additiv befüllt. Position = Index im Array, keine Kalenderdaten.
let spwGeneratorMethodsUsed = new Set(); // welche Werkzeuge für diesen Plan benutzt wurden (fürs Detail-Label)
let spwRandomPreview = [];  // Vorschau-Puffer für "Zufällige Beträge" (reine Beträge), vor "Zur Liste hinzufügen"

function showSpwStep(step) {
  ['variant', 'target', 'rate', 'custom'].forEach(s => {
    const el = document.getElementById(`sparplan-wizard-step-${s}`);
    if (el) el.classList.toggle('hidden', s !== step);
  });
  document.getElementById('sparplan-wizard-back').classList.toggle('hidden', step === 'variant');
  document.getElementById('sparplan-wizard-save').classList.toggle('hidden', step === 'variant');
}

// Schaltet innerhalb der Individuell-Variante zwischen der Hauptansicht
// (Werkzeugleiste + Liste) und den einzelnen Generator-Formularen um.
// Die sichtbare DOM-Klasse ist die einzige Zustandsquelle.
function showSpwCustomSection(section) {
  document.getElementById('spw-custom-main').classList.toggle('hidden',         section !== 'main');
  document.getElementById('spw-custom-form-fixed').classList.toggle('hidden',   section !== 'fixed');
  document.getElementById('spw-custom-form-random').classList.toggle('hidden',  section !== 'random');
  document.getElementById('spw-custom-form-template').classList.toggle('hidden',section !== 'template');
  // Speichern ist nur in der Hauptansicht sinnvoll (dort liegt die Liste)
  document.getElementById('sparplan-wizard-save').classList.toggle('hidden', section !== 'main');
}

function renderSpwCustomRows() {
  const wrap = document.getElementById('spw-custom-rows');
  if (!wrap) return;
  wrap.innerHTML = '';
  spwCustomEntries.forEach((entry, i) => {
    const row = document.createElement('div'); row.className = 'sp-wizard-custom-row';
    row.innerHTML = `
      <span class="sp-wizard-custom-position">${sparplanPositionLabel(spwInterval, i + 1)}</span>
      <input type="number" class="modal-input spw-custom-amount" placeholder="0.00 €" step="0.01" min="0" value="${entry.amount ?? ''}"/>
      <button class="task-delete spw-custom-remove" title="Entfernen">✕</button>`;
    row.querySelector('.spw-custom-amount').addEventListener('input', e => {
      entry.amount = parseFloat(e.target.value) || 0;
      updateSpwCustomSum();
    });
    row.querySelector('.spw-custom-remove').addEventListener('click', () => {
      spwCustomEntries.splice(i, 1);
      renderSpwCustomRows();
    });
    wrap.appendChild(row);
  });
  updateSpwCustomSum();
}
function updateSpwCustomSum() {
  const sumEl = document.getElementById('spw-custom-sum');
  if (!sumEl) return;
  const sum = round2(spwCustomEntries.reduce((s, e) => s + (e.amount || 0), 0));
  sumEl.textContent = spwCustomEntries.length ? `${spwCustomEntries.length} Rate(n) · Summe ${fmtEuro(sum)}` : '';
}

function updateSpwTargetPreview() {
  const previewEl = document.getElementById('spw-target-preview');
  if (!previewEl) return;
  const amount = parseFloat(document.getElementById('spw-target-amount').value);
  const start  = document.getElementById('spw-target-start').value;
  const end    = document.getElementById('spw-target-end').value;
  const interval = document.getElementById('spw-target-interval').value;
  if (!amount || amount <= 0 || !start || !end) { previewEl.textContent = ''; return; }
  const dates = sparplanGenerateDates(start, end, interval);
  if (!dates.length) { previewEl.textContent = ''; return; }
  const amounts = sparplanDistribute(dates.length, round2(amount), spwMethod);
  previewEl.innerHTML = spwMethod === 'constant'
    ? `${dates.length} Rate(n) à ${fmtEuro(amounts[0])}`
    : `${dates.length} Rate(n) von ${fmtEuro(amounts[0])} bis ${fmtEuro(amounts[amounts.length - 1])}`;
}
function updateSpwRatePreview() {
  const previewEl = document.getElementById('spw-rate-preview');
  if (!previewEl) return;
  const rate = parseFloat(document.getElementById('spw-rate-amount').value);
  const start = document.getElementById('spw-rate-start').value;
  const end   = document.getElementById('spw-rate-end').value;
  const interval = document.getElementById('spw-rate-interval').value;
  if (!rate || rate <= 0 || !start || !end) { previewEl.textContent = ''; return; }
  const dates = sparplanGenerateDates(start, end, interval);
  const total = round2(rate * dates.length);
  previewEl.innerHTML = `${dates.length} Rate(n) × ${fmtEuro(round2(rate))} = <b>${fmtEuro(total)}</b> erreichbar`;
}

// ── "Fester Betrag" — Live-Vorschau + Erzeugung ──
function readSpwFixedParams() {
  return {
    amount: parseFloat(document.getElementById('spw-fixed-amount').value),
    count:  parseInt(document.getElementById('spw-fixed-count').value, 10),
  };
}
function updateSpwFixedPreview() {
  const previewEl = document.getElementById('spw-fixed-preview');
  if (!previewEl) return;
  const { amount, count } = readSpwFixedParams();
  if (!amount || amount <= 0 || !count || count <= 0) { previewEl.textContent = ''; return; }
  const from = spwCustomEntries.length + 1, to = spwCustomEntries.length + count;
  const range = count > 1 ? `${sparplanPositionLabel(spwInterval, from)}–${to}` : sparplanPositionLabel(spwInterval, from);
  previewEl.innerHTML = `${range}: ${count} × ${fmtEuro(round2(amount))} = <b>${fmtEuro(round2(amount * count))}</b>`;
}
function applySpwFixedGenerate() {
  const { amount, count } = readSpwFixedParams();
  if (!amount || amount <= 0 || !count || count <= 0) {
    alert('Bitte Betrag und Anzahl angeben.'); return;
  }
  spwCustomEntries.push(...sparplanGenFixed({ amount, count }).map(a => ({ amount: a })));
  spwGeneratorMethodsUsed.add('fixed');
  renderSpwCustomRows();
  showSpwCustomSection('main');
}

// ── "Zufällige Beträge" — Vorschau mit Neu-generieren/Übernehmen.
// Nur ganze Euro (siehe sparplanRandomAmount). ──
function readSpwRandomParams() {
  return {
    min:   parseFloat(document.getElementById('spw-random-min').value),
    max:   parseFloat(document.getElementById('spw-random-max').value),
    count: parseInt(document.getElementById('spw-random-count').value, 10),
    multipleOf: document.getElementById('spw-random-multiple-toggle').checked
      ? parseFloat(document.getElementById('spw-random-multiple').value) || 0
      : 0,
  };
}
function renderSpwRandomPreview() {
  const listEl = document.getElementById('spw-random-preview-list');
  const sumEl  = document.getElementById('spw-random-preview-sum');
  if (!listEl || !sumEl) return;
  listEl.innerHTML = '';
  const baseIndex = spwCustomEntries.length; // Vorschau schließt an bereits vorhandene Raten an
  spwRandomPreview.forEach((amount, i) => {
    const row = document.createElement('div'); row.className = 'sp-detail-entry-row';
    row.innerHTML = `<span>${sparplanPositionLabel(spwInterval, baseIndex + i + 1)}</span><span class="sp-detail-entry-amount">${fmtEuro(amount)}</span>`;
    listEl.appendChild(row);
  });
  const sum = round2(spwRandomPreview.reduce((s, a) => s + a, 0));
  sumEl.innerHTML = `${spwRandomPreview.length} Rate(n) · Summe <b>${fmtEuro(sum)}</b>`;
  document.getElementById('spw-random-preview-wrap').classList.remove('hidden');
}
function applySpwRandomGenerate() {
  const { min, max, count, multipleOf } = readSpwRandomParams();
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= min || !count || count <= 0) {
    alert('Bitte einen gültigen Von/Bis-Betrag und eine Anzahl angeben.'); return;
  }
  spwRandomPreview = sparplanGenRandom({ min, max, count, multipleOf });
  renderSpwRandomPreview();
}

// ── "Aus Vorlage" — Platzhalter, Registry ist bewusst noch leer ──
function renderSpwTemplateList() {
  const wrap = document.getElementById('spw-template-list');
  if (!wrap) return;
  const keys = Object.keys(SP_TEMPLATE_REGISTRY);
  if (keys.length === 0) {
    wrap.innerHTML = '<div class="empty-state">Noch keine Vorlagen verfügbar — kommt in einem späteren Update (z. B. 1-Cent-Challenge, 5-Euro-Schein-Challenge, Münz-Challenge).</div>';
    return;
  }
  wrap.innerHTML = '';
  keys.forEach(key => {
    const tpl = SP_TEMPLATE_REGISTRY[key];
    const item = document.createElement('div'); item.className = 'sp-template-item';
    item.innerHTML = `<span>${tpl.icon || '📋'} ${tpl.label}</span><span class="badge-soon">Bald</span>`;
    wrap.appendChild(item);
  });
}

function openSparplanWizard() {
  spwVariant = null;
  spwMethod  = 'constant';
  spwInterval = 'weekly';
  spwCustomEntries = [];
  spwGeneratorMethodsUsed = new Set();
  spwRandomPreview = [];
  document.getElementById('sparplan-wizard-title').textContent = 'Neuer Sparplan';
  ['spw-target-name','spw-target-amount','spw-target-start','spw-target-end',
   'spw-rate-name','spw-rate-amount','spw-rate-start','spw-rate-end',
   'spw-custom-name',
   'spw-fixed-amount','spw-fixed-count',
   'spw-random-min','spw-random-max','spw-random-count','spw-random-multiple',
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('spw-target-interval').value = 'monthly';
  document.getElementById('spw-rate-interval').value   = 'monthly';
  document.getElementById('spw-target-preview').textContent = '';
  document.getElementById('spw-rate-preview').textContent   = '';
  document.getElementById('spw-fixed-preview').textContent  = '';
  document.getElementById('spw-random-multiple-toggle').checked = false;
  document.getElementById('spw-random-multiple-row').classList.add('hidden');
  document.getElementById('spw-random-preview-wrap').classList.add('hidden');
  document.querySelectorAll('#sparplan-wizard-step-target .toggle-select-btn').forEach(b => b.classList.toggle('active', b.dataset.method === 'constant'));
  document.querySelectorAll('#spw-custom-interval-picker .toggle-select-btn').forEach(b => b.classList.toggle('active', b.dataset.interval === 'weekly'));
  renderSpwCustomRows();
  showSpwCustomSection('main');
  showSpwStep('variant');
  document.getElementById('sparplan-wizard-modal-overlay').classList.remove('hidden');
}
function closeSparplanWizard() {
  document.getElementById('sparplan-wizard-modal-overlay').classList.add('hidden');
}

document.querySelectorAll('.sp-wizard-variant-btn[data-variant]').forEach(btn => {
  btn.addEventListener('click', () => {
    spwVariant = btn.dataset.variant;
    showSpwStep(spwVariant);
    if (spwVariant === 'custom') showSpwCustomSection('main');
  });
});
document.querySelectorAll('#sparplan-wizard-step-target .toggle-select-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#sparplan-wizard-step-target .toggle-select-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    spwMethod = btn.dataset.method;
    updateSpwTargetPreview();
  });
});
['spw-target-amount','spw-target-start','spw-target-end','spw-target-interval'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateSpwTargetPreview);
});
['spw-rate-amount','spw-rate-start','spw-rate-end','spw-rate-interval'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateSpwRatePreview);
});

// Gemeinsames Intervall für den GESAMTEN individuellen Plan. Wirkt sich
// nur auf die Positions-Beschriftung aus ("Woche N" → "Tag N" etc.) —
// bereits vorhandene Raten werden dabei automatisch mit-relabelt, da die
// Beschriftung nie gespeichert, sondern immer aus spwInterval berechnet
// wird (renderSpwCustomRows()).
document.querySelectorAll('#spw-custom-interval-picker .toggle-select-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#spw-custom-interval-picker .toggle-select-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    spwInterval = btn.dataset.interval;
    renderSpwCustomRows();
    updateSpwFixedPreview();
  });
});

// Werkzeugleiste innerhalb "Individuell" — jedes Werkzeug hängt seine
// Einträge an die bestehende Liste an, statt sie zu ersetzen. Beliebig
// oft und in beliebiger Reihenfolge kombinierbar. Positionen ergeben
// sich zentral aus der Listenlänge zum Zeitpunkt des Anhängens.
document.querySelectorAll('#spw-custom-main .sp-wizard-toolbar [data-generator]').forEach(btn => {
  btn.addEventListener('click', () => {
    const gen = btn.dataset.generator;
    if (gen === 'manual') {
      spwCustomEntries.push({ amount: null });
      spwGeneratorMethodsUsed.add('manual');
      renderSpwCustomRows();
    } else if (gen === 'fixed') {
      updateSpwFixedPreview();
      showSpwCustomSection('fixed');
    } else if (gen === 'random') {
      document.getElementById('spw-random-preview-wrap').classList.add('hidden');
      showSpwCustomSection('random');
    } else if (gen === 'template') {
      renderSpwTemplateList();
      showSpwCustomSection('template');
    }
  });
});
document.getElementById('spw-fixed-back').addEventListener('click', () => showSpwCustomSection('main'));
document.getElementById('spw-random-back').addEventListener('click', () => showSpwCustomSection('main'));
document.getElementById('spw-template-back').addEventListener('click', () => showSpwCustomSection('main'));

['spw-fixed-amount','spw-fixed-count'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateSpwFixedPreview);
});
document.getElementById('spw-fixed-generate').addEventListener('click', applySpwFixedGenerate);

document.getElementById('spw-random-multiple-toggle').addEventListener('change', e => {
  document.getElementById('spw-random-multiple-row').classList.toggle('hidden', !e.target.checked);
});
document.getElementById('spw-random-generate').addEventListener('click', applySpwRandomGenerate);
document.getElementById('spw-random-regenerate').addEventListener('click', applySpwRandomGenerate);
document.getElementById('spw-random-apply').addEventListener('click', () => {
  if (!spwRandomPreview.length) return;
  spwCustomEntries.push(...spwRandomPreview.map(amount => ({ amount })));
  spwGeneratorMethodsUsed.add('random');
  renderSpwCustomRows();
  showSpwCustomSection('main');
});

document.getElementById('sparplan-wizard-back').addEventListener('click', () => { spwVariant = null; showSpwStep('variant'); });
document.getElementById('sparplan-wizard-close').addEventListener('click', closeSparplanWizard);
document.getElementById('sparplan-wizard-cancel').addEventListener('click', closeSparplanWizard);
document.getElementById('sparplan-wizard-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('sparplan-wizard-modal-overlay')) closeSparplanWizard();
});

document.getElementById('sparplan-wizard-save').addEventListener('click', () => {
  let plan = null;

  if (spwVariant === 'target') {
    const name   = document.getElementById('spw-target-name').value.trim();
    const amount = parseFloat(document.getElementById('spw-target-amount').value);
    const start  = document.getElementById('spw-target-start').value;
    const end    = document.getElementById('spw-target-end').value;
    const interval = document.getElementById('spw-target-interval').value;
    if (!name || !amount || amount <= 0 || !start || !end || start > end) {
      alert('Bitte Name, Zielbetrag sowie ein gültiges Start- und Zieldatum angeben.'); return;
    }
    const dates   = sparplanGenerateDates(start, end, interval);
    const amounts = sparplanDistribute(dates.length, round2(amount), spwMethod);
    plan = { id: sparplanNewId(), name, image: null, targetAmount: round2(amount),
      startDate: start, endDate: end, interval, method: spwMethod,
      entries: sparplanBuildEntries(dates, amounts), linkedToBudget: false, createdAt: Date.now() };

  } else if (spwVariant === 'rate') {
    const name  = document.getElementById('spw-rate-name').value.trim();
    const rate  = parseFloat(document.getElementById('spw-rate-amount').value);
    const start = document.getElementById('spw-rate-start').value;
    const end   = document.getElementById('spw-rate-end').value;
    const interval = document.getElementById('spw-rate-interval').value;
    if (!name || !rate || rate <= 0 || !start || !end || start > end) {
      alert('Bitte Name, Sparrate sowie ein gültiges Start- und Enddatum angeben.'); return;
    }
    const dates   = sparplanGenerateDates(start, end, interval);
    const amounts = new Array(dates.length).fill(round2(rate));
    plan = { id: sparplanNewId(), name, image: null, targetAmount: null,
      startDate: start, endDate: end, interval, method: 'constant',
      entries: sparplanBuildEntries(dates, amounts), linkedToBudget: false, createdAt: Date.now() };

  } else if (spwVariant === 'custom') {
    const name  = document.getElementById('spw-custom-name').value.trim();
    // KEINE Sortierung — die Array-Reihenfolge IST die Position (Woche 1,
    // Woche 2, ...), es gibt keine Kalenderdaten zum Sortieren.
    const valid = spwCustomEntries.filter(e => e.amount > 0);
    if (!name || valid.length === 0) {
      alert('Bitte einen Namen und mindestens eine gültige Rate angeben.'); return;
    }
    const stamp = Date.now().toString(36);
    // Kein Zielbetrag: die Summe ergibt sich ausschließlich aus den
    // erzeugten/eingetragenen Raten (sparplanTargetAmount() leitet sie
    // bei targetAmount:null automatisch aus entries[] ab). Kein Start-/
    // Enddatum: plan.interval ist das gemeinsame Intervall, anhand dessen
    // sparplanEntryLabel() die Positionen ("Woche N") beschriftet.
    plan = { id: sparplanNewId(), name, image: null, targetAmount: null,
      startDate: null, endDate: null, interval: spwInterval, method: 'custom',
      generatorMethods: [...spwGeneratorMethodsUsed],
      entries: valid.map((e, i) => ({ id: `spe_${stamp}_${i}`, amount: round2(e.amount), done: false })),
      linkedToBudget: false, createdAt: Date.now() };
  }

  if (!plan) return;
  budgetSavingsPlans.push(plan);
  saveBudgetSavingsPlans();
  closeSparplanWizard();
  renderSparplaeneGrid();
});

const spAddPlanBtn = document.getElementById('sparplan-add-plan-btn');
if (spAddPlanBtn) spAddPlanBtn.addEventListener('click', openSparplanWizard);

// =========================
// SPARPLÄNE — DETAILANSICHT
// Stammdaten, Fortschritt, Historie, zukünftige Raten, Bearbeiten,
// Löschen. Jede Rate ist einzeln als erledigt markierbar.
// =========================
let spDetailPlanId  = null;
let spDetailEditing = false;

function openSparplanDetail(id) {
  spDetailPlanId  = id;
  spDetailEditing = false;
  renderSparplanDetailBody();
  document.getElementById('sparplan-detail-modal-overlay').classList.remove('hidden');
}
function closeSparplanDetail() {
  document.getElementById('sparplan-detail-modal-overlay').classList.add('hidden');
  spDetailPlanId = null;
}

function renderSparplanDetailBody() {
  const plan = getSparplanById(spDetailPlanId);
  const body = document.getElementById('sparplan-detail-body');
  if (!plan) { closeSparplanDetail(); return; }

  document.getElementById('sparplan-detail-title').textContent = plan.name;
  const target  = sparplanTargetAmount(plan);
  const current = sparplanCurrentAmount(plan);
  const pct     = sparplanProgressPct(plan);
  const done     = sparplanOrderedEntries(plan, true);
  const upcoming = sparplanOrderedEntries(plan, false);

  // Individuell kann aus mehreren Werkzeugen zusammengesetzt sein
  // (z. B. Fester Betrag + Zufällig) — alle benutzten Werkzeuge werden
  // angezeigt. plan.generatorMethod (Einzahl) bleibt als Fallback für
  // Pläne, die vor dieser Umstellung erzeugt wurden.
  let methodLabel = SP_METHOD_META[plan.method]?.label || plan.method;
  if (plan.method === 'custom') {
    if (Array.isArray(plan.generatorMethods) && plan.generatorMethods.length) {
      methodLabel = plan.generatorMethods.map(m => SP_CUSTOM_GENERATORS[m]?.label || m).join(' + ');
    } else if (plan.generatorMethod && SP_CUSTOM_GENERATORS[plan.generatorMethod]) {
      methodLabel = SP_CUSTOM_GENERATORS[plan.generatorMethod].label;
    }
  }
  const nameField = spDetailEditing
    ? `<input type="text" class="modal-input" id="sp-detail-edit-name" value="${plan.name}" style="max-width:220px;"/>`
    : `<span>${plan.name}</span>`;
  const targetField = (spDetailEditing && typeof plan.targetAmount === 'number')
    ? `<input type="number" class="modal-input" id="sp-detail-edit-target" value="${plan.targetAmount}" step="0.01" min="0" style="max-width:140px;"/>`
    : `<span>${fmtEuro(target)}</span>`;

  // "Individuell" hat keinen Zeitraum (keine Kalenderdaten) — stattdessen
  // die Anzahl der Raten anzeigen.
  const zeitraumRow = plan.method === 'custom'
    ? `<div class="sp-detail-row"><span>Anzahl Raten</span><span>${plan.entries.length}</span></div>`
    : `<div class="sp-detail-row"><span>Zeitraum</span><span>${sparplanFormatDate(plan.startDate)} – ${sparplanFormatDate(plan.endDate)}</span></div>`;

  body.innerHTML = `
    <div class="sp-detail-stammdaten">
      <div class="sp-detail-row"><span>Name</span>${nameField}</div>
      <div class="sp-detail-row"><span>Zielbetrag</span>${targetField}</div>
      ${zeitraumRow}
      <div class="sp-detail-row"><span>Intervall</span><span>${SP_INTERVAL_META[plan.interval]?.label || plan.interval}</span></div>
      <div class="sp-detail-row"><span>Sparart</span><span>${methodLabel}</span></div>
    </div>
    ${spDetailEditing ? `<div class="modal-row" style="flex-direction:row;gap:8px;margin-top:8px;">
        <button class="btn-ghost" id="sp-detail-edit-cancel">Abbrechen</button>
        <button class="btn-primary" id="sp-detail-edit-save">Speichern</button>
      </div>` : ''}

    <div class="budget-goal-bar sp-plan-bar" style="margin-top:14px;"><div class="budget-goal-fill" style="width:${pct}%"></div></div>
    <div class="sp-plan-card-row"><span>${fmtEuro(current)} / ${fmtEuro(target)}</span><span>${pct}%</span></div>

    <div class="sp-detail-section-title">Zukünftige Raten</div>
    <div class="sp-detail-entry-list" id="sp-detail-upcoming">${upcoming.length ? '' : '<div class="empty-state">Keine offenen Raten mehr.</div>'}</div>

    <div class="sp-detail-section-title">Historie</div>
    <div class="sp-detail-entry-list" id="sp-detail-history">${done.length ? '' : '<div class="empty-state">Noch nichts erledigt.</div>'}</div>`;

  if (spDetailEditing) {
    document.getElementById('sp-detail-edit-cancel').addEventListener('click', () => { spDetailEditing = false; renderSparplanDetailBody(); });
    document.getElementById('sp-detail-edit-save').addEventListener('click', () => {
      const newName = document.getElementById('sp-detail-edit-name').value.trim();
      if (newName) plan.name = newName;
      const targetInput = document.getElementById('sp-detail-edit-target');
      if (targetInput) {
        const v = parseFloat(targetInput.value);
        if (v > 0) plan.targetAmount = round2(v);
      }
      saveBudgetSavingsPlans();
      spDetailEditing = false;
      renderSparplanDetailBody();
      renderSparplaeneGrid();
    });
  }

  const upcomingEl = document.getElementById('sp-detail-upcoming');
  upcoming.forEach(e => {
    const row = document.createElement('div'); row.className = 'sp-detail-entry-row';
    row.innerHTML = `<span>${sparplanEntryLabel(plan, e)}</span><span class="sp-detail-entry-amount">${fmtEuro(e.amount)}</span>`;
    const btn = document.createElement('button'); btn.className = 'btn-ghost sp-detail-entry-btn'; btn.textContent = 'Erledigt';
    btn.addEventListener('click', () => { e.done = true; saveBudgetSavingsPlans(); renderSparplanDetailBody(); renderSparplaeneGrid(); });
    row.appendChild(btn);
    upcomingEl.appendChild(row);
  });
  const historyEl = document.getElementById('sp-detail-history');
  done.forEach(e => {
    const row = document.createElement('div'); row.className = 'sp-detail-entry-row sp-detail-entry-row--done';
    row.innerHTML = `<span>${sparplanEntryLabel(plan, e)}</span><span class="sp-detail-entry-amount">${fmtEuro(e.amount)}</span>`;
    const btn = document.createElement('button'); btn.className = 'btn-ghost sp-detail-entry-btn'; btn.textContent = 'Rückgängig';
    btn.addEventListener('click', () => { e.done = false; saveBudgetSavingsPlans(); renderSparplanDetailBody(); renderSparplaeneGrid(); });
    row.appendChild(btn);
    historyEl.appendChild(row);
  });
}

document.getElementById('sparplan-detail-edit-btn').addEventListener('click', () => { spDetailEditing = true; renderSparplanDetailBody(); });
document.getElementById('sparplan-detail-close').addEventListener('click', closeSparplanDetail);
document.getElementById('sparplan-detail-done-btn').addEventListener('click', closeSparplanDetail);
document.getElementById('sparplan-detail-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('sparplan-detail-modal-overlay')) closeSparplanDetail();
});
document.getElementById('sparplan-detail-delete').addEventListener('click', () => {
  if (!spDetailPlanId) return;
  if (!confirm('Diesen Sparplan wirklich löschen?')) return;
  budgetSavingsPlans = budgetSavingsPlans.filter(p => p.id !== spDetailPlanId);
  saveBudgetSavingsPlans();
  closeSparplanDetail();
  renderSparplaeneGrid();
});
