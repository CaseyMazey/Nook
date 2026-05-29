// =========================
// BUDGET
// =========================

let budgetRecurring = DB.get('budgetRecurring', []);
let budgetOnetime   = DB.get('budgetOnetime', []);
let budgetGoals     = DB.get('budgetGoals', []);
let budgetMonth     = new Date();
let kontostand      = DB.get('kontostand', null);

function saveBudgetRecurring(){ DB.set('budgetRecurring', budgetRecurring); }
function saveBudgetOnetime(){   DB.set('budgetOnetime',   budgetOnetime);   }
function saveBudgetGoals(){     DB.set('budgetGoals',     budgetGoals);     }

// Migration: add missing fields to existing entries
function migrateBudgetData() {
  let changed = false;
  budgetRecurring.forEach(r => {
    if (!r.priority) { r.priority = 'need'; changed = true; }
  });
  budgetOnetime.forEach(e => {
    if (!e.priority) { e.priority = 'need'; changed = true; }
    if (e.paid === undefined) { e.paid = false; changed = true; }
  });
  if (changed) { saveBudgetRecurring(); saveBudgetOnetime(); }
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
function getRecurringForMonth(date){
  const m = date.getMonth()+1;
  return budgetRecurring.filter(r => {
    if (r.freq === 'monthly') return true;
    if (r.freq === 'yearly')  return r.dateMonth === m;
    return false;
  });
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
// CENTRAL PROJECTION
// Single source of truth for all financial calculations.
//
// MODEL:
// kontostand is the real current balance — mutated directly when the user
// confirms a booking (paid toggle). It already reflects all confirmed
// transactions. calcMonthProjection only adds what is still PENDING.
//
// pending = unpaid AND (day >= today for recurring)
// endOfMonth = kontostand + pendingIncome - pendingExpense
//
// Doppelverrechnung is impossible by design:
// The paid-toggle mutates kontostand exactly once (on the state change),
// then saves. On re-render the entry is already marked paid and skipped.
// =========================

function calcMonthProjection() {
  if (kontostand === null) return null;

  const now      = new Date();
  const todayDay = now.getDate();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();
  const curMk    = budgetMonthKey(now);

  const curRecItems = getMonthRecurringItems(curYear, curMonth);

  // Pending = not yet paid AND not yet past (day >= today)
  let pendingIncome  = 0;
  let pendingExpense = 0;
  curRecItems.forEach(item => {
    if (!isRecurringPaid(item.id, curMk) && item.day >= todayDay) {
      if (item.type === 'income') pendingIncome  += item.amount;
      else                        pendingExpense += item.amount;
    }
  });

  // One-time entries: unpaid only
  budgetOnetime.filter(e => e.monthKey === curMk && !e.paid).forEach(e => {
    if (e.type === 'income') pendingIncome  += e.amount;
    else                     pendingExpense += e.amount;
  });

  // kontostand already includes all confirmed transactions
  const endOfMonth = kontostand + pendingIncome - pendingExpense;

  // --- Next month: expenses before first income ---
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

  // Still-pending must-expenses this month
  const openMust = curRecItems
    .filter(i => i.type === 'expense' && i.priority === 'must'
                 && !isRecurringPaid(i.id, curMk) && i.day >= todayDay)
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
// FINANCIAL STATUS BAR
// Uses calcMonthProjection() — same data as the forecast below.
// =========================

function calcFinancialStatus() {
  const proj = calcMonthProjection();
  if (!proj) return null;

  const { mustCovered, needCovered, wantCovered, afterMust, afterNeed, gap, openMust } = proj;

  // Status is derived purely from coverage flags — all three matter.
  // red:    must not covered
  // yellow: must+need covered, but want not fully covered
  // green:  everything covered
  const status = !mustCovered ? 'red' : !needCovered ? 'red' : !wantCovered ? 'yellow' : 'green';
  // Note: needCovered=false also means mustCovered might barely pass but total is still critical.
  // We treat must+need both as hard requirements → red if either fails.
  // Only want is treated as soft → yellow.

  // Per-tier check items: each has a label, icon, iconClass, and a summary line.
  // These are built entirely from the data — no hardcoded positive texts for uncovered tiers.
  const checks = [];

  // ── MUSS ──
  if (mustCovered) {
    checks.push({ icon: '✓', iconClass: 'ok', label: 'Muss-Ausgaben sind gedeckt.' });
  } else {
    checks.push({ icon: '✗', iconClass: 'bad', label: `Muss-Ausgaben nicht gedeckt. Fehlbetrag: ${Math.abs(afterMust).toFixed(2)} €` });
  }

  // ── BRAUCHE ──
  if (!mustCovered) {
    // Can't even evaluate need if must already fails
    checks.push({ icon: '–', iconClass: 'neutral', label: 'Brauche-Ausgaben (nicht auswertbar)' });
  } else if (needCovered) {
    checks.push({ icon: '✓', iconClass: 'ok', label: 'Brauche-Ausgaben sind gedeckt.' });
  } else {
    checks.push({ icon: '✗', iconClass: 'bad', label: `Brauche-Ausgaben nicht vollständig gedeckt. Fehlbetrag: ${Math.abs(afterNeed).toFixed(2)} €` });
  }

  // ── MÖCHTE ──
  if (!mustCovered || !needCovered) {
    checks.push({ icon: '–', iconClass: 'neutral', label: 'Möchte-Ausgaben (nicht auswertbar)' });
  } else if (wantCovered) {
    checks.push({ icon: '✓', iconClass: 'ok', label: 'Möchte-Ausgaben sind gedeckt.' });
  } else {
    checks.push({ icon: '⚠', iconClass: 'warn', label: 'Für optionale Ausgaben reicht es nicht ganz.' });
  }

  // ── Summary hint — one sentence that matches the status exactly ──
  let hint = null;
  if (status === 'green') {
    hint = gap > 0
      ? { text: `Nach allen Ausgaben bleiben dir noch ${gap.toFixed(2)} € übrig.`, type: 'good' }
      : { text: 'Alle Ausgaben sind gedeckt.', type: 'good' };
  } else if (status === 'yellow') {
    hint = { text: `Für optionale Ausgaben fehlen noch ${Math.abs(gap).toFixed(2)} €. Pflichtausgaben sind gesichert.`, type: 'warn' };
  } else {
    // red
    if (!mustCovered) {
      hint = { text: `Muss-Ausgaben nicht gedeckt — es fehlen ${Math.abs(afterMust).toFixed(2)} €.`, type: 'bad' };
    } else {
      hint = { text: `Brauche-Ausgaben nicht vollständig gedeckt — es fehlen ${Math.abs(afterNeed).toFixed(2)} €.`, type: 'bad' };
    }
  }

  return { status, mustCovered, needCovered, wantCovered, checks, hint };
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

  const labels   = { green: 'Stabil', yellow: 'Aufpassen', red: 'Kritisch' };
  const dotColor = { green: 'green', yellow: 'yellow', red: 'red' };

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
      <span class="b-status-dot ${dotColor[fs.status]}"></span>
      <span class="b-status-text">Status: <span class="status-word ${dotColor[fs.status]}">${labels[fs.status]}</span></span>
    </div>
    <div class="b-checklist">${checkHtml}</div>
    ${hintHtml}`;
}

// =========================
// RENDER BUDGET
// =========================

function renderBudget(){
  const now      = new Date();
  const curMkNow = budgetMonthKey(now);
  const viewMk   = budgetMonthKey(budgetMonth);

  // ── All recurring entries that fire this month ──────────────────────────
  const monthRec         = getRecurringForMonth(now);
  const recIncome        = monthRec.filter(r => r.type === 'income');
  const recExpMonthly    = monthRec.filter(r => r.type === 'expense' && r.freq === 'monthly');
  const recExpYearly     = monthRec.filter(r => r.type === 'expense' && r.freq === 'yearly');

  const totalRecIncome   = recIncome.reduce((s,r)  => s + r.amount, 0);
  const totalFixkosten   = recExpMonthly.reduce((s,r) => s + r.amount, 0);
  const totalSonderkosten= recExpYearly.reduce((s,r)  => s + r.amount, 0);

  // One-time entries
  const otIncome   = budgetOnetime.filter(e => e.monthKey===curMkNow && e.type==='income').reduce((s,e)=>s+e.amount,0);
  const otExpense  = budgetOnetime.filter(e => e.monthKey===curMkNow && e.type==='expense').reduce((s,e)=>s+e.amount,0);

  const totalIn    = totalRecIncome + otIncome;
  const totalOut   = totalFixkosten + totalSonderkosten + otExpense;
  const balance    = totalIn - totalOut;

  const yearlyCount     = recExpYearly.length;
  const yearlyCountText = yearlyCount === 1 ? '1 jährliche Abbuchung' : `${yearlyCount} jährliche Abbuchungen`;
  const otExpText       = otExpense > 0
    ? `-${otExpense.toLocaleString('de-DE',{minimumFractionDigits:2})} €`
    : 'Keine';

  // ── KPI GRID ─────────────────────────────────────────────────────────────
  document.getElementById('budget-summary-bar').innerHTML = `
    <div class="budget-kpi-grid budget-kpi-grid-4">
      <div class="budget-kpi-card">
        <div class="budget-kpi-left">
          <div class="budget-kpi-label">Einnahmen</div>
          <div class="budget-kpi-value income">+${totalIn.toLocaleString('de-DE',{minimumFractionDigits:2})} &euro;</div>
          <div class="budget-kpi-sub">Im ${now.toLocaleDateString('de-DE',{month:'long'})}</div>
        </div>
        <div class="budget-kpi-icon green">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <path d="M14 24C14 24 5 19 5 11C5 7 9 4 14 4C19 4 23 7 23 11C23 19 14 24 14 24Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M14 24L14 4M14 13C11 10 7 10 5.5 12M14 17C17 14 21 14 22.5 16" stroke="currentColor" stroke-width="1" opacity=".5"/>
          </svg>
        </div>
      </div>
      <div class="budget-kpi-card">
        <div class="budget-kpi-left">
          <div class="budget-kpi-label">Fixkosten</div>
          <div class="budget-kpi-value expense">-${totalFixkosten.toLocaleString('de-DE',{minimumFractionDigits:2})} &euro;</div>
          <div class="budget-kpi-sub">Monatliche Fixkosten</div>
        </div>
        <div class="budget-kpi-icon red">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <rect x="5" y="5" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M9 14h10M9 10h6M9 18h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
      <div class="budget-kpi-card budget-kpi-card-yearly ${totalSonderkosten === 0 ? 'budget-kpi-card-muted' : ''}">
        <div class="budget-kpi-left">
          <div class="budget-kpi-label">Sonderkosten</div>
          <div class="budget-kpi-value ${totalSonderkosten > 0 ? 'expense' : 'muted'}">
            ${totalSonderkosten > 0 ? '-' + totalSonderkosten.toLocaleString('de-DE',{minimumFractionDigits:2}) + ' &euro;' : '—'}
          </div>
          <div class="budget-kpi-sub">${totalSonderkosten > 0 ? yearlyCountText : 'Keine diesen Monat'}</div>
        </div>
        <div class="budget-kpi-icon olive">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="9" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M14 9v5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
      <div class="budget-kpi-card">
        <div class="budget-kpi-left">
          <div class="budget-kpi-label">Verfügbar</div>
          <div class="budget-kpi-value ${balance>=0?'positive':'negative'}">${balance>=0?'+':''}${Math.abs(balance).toLocaleString('de-DE',{minimumFractionDigits:2})} &euro;</div>
          <div class="budget-kpi-sub">Aktuell verfügbar</div>
        </div>
        <div class="budget-kpi-icon olive">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <rect x="4" y="8" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M4 12h20" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="19" cy="17" r="2" fill="currentColor" opacity=".6"/>
          </svg>
        </div>
      </div>
    </div>`;

  renderFinancialStatus(calcFinancialStatus());

  document.getElementById('budget-month-label').textContent = budgetMonthLabel(budgetMonth);

  // ── ONE-TIME LIST ─────────────────────────────────────────────────────────
  const onetimeList = document.getElementById('budget-onetime-list');
  onetimeList.innerHTML = '';
  const otEntries = budgetOnetime.filter(e => e.monthKey === viewMk);

  if (otEntries.length === 0) {
    onetimeList.innerHTML = '<div class="empty-state">Keine einmaligen Buchungen in diesem Monat.</div>';
  } else {
    const otIncomes  = otEntries.filter(e => e.type === 'income');
    const otExpenses = otEntries.filter(e => e.type === 'expense');

    function renderOtGroup(entries, type) {
      if (!entries.length) return;
      const header = document.createElement('div');
      header.className = 'b-section-label';
      header.innerHTML = `<span class="b-section-dot ${type}"></span>${type === 'income' ? 'Einnahmen' : 'Ausgaben'}`;
      onetimeList.appendChild(header);
      entries.forEach(e => {
        onetimeList.appendChild(makeBudgetRow({
          name: e.name, amount: e.amount, type: e.type,
          priority: e.priority || 'need', paid: e.paid || false,
          onDel:        () => { budgetOnetime = budgetOnetime.filter(x => x.id !== e.id); saveBudgetOnetime(); renderBudget(); },
          onPaidToggle: () => {
            const nowPaid = !e.paid;
            e.paid = nowPaid;
            if (nowPaid) { kontostand += e.type === 'income' ? e.amount : -e.amount; }
            else         { kontostand += e.type === 'income' ? -e.amount : e.amount; }
            DB.set('kontostand', kontostand);
            saveBudgetOnetime();
            renderBudget();
          }
        }));
      });
    }
    renderOtGroup(otIncomes, 'income');
    renderOtGroup(otExpenses, 'expense');
  }

  // ── RECURRING LIST ────────────────────────────────────────────────────────
  // Income group (all frequencies), then Expense split into: monthly fixkosten / yearly sonderkosten
  const prioOrder = { must: 0, need: 1, want: 2, none: 1 };
  function sortByPrioDay(arr) {
    return arr.slice().sort((a, b) => {
      const pa = prioOrder[a.priority] ?? 1, pb = prioOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      const da = a.freq === 'monthly' ? (a.day||1) : (a.dateDay||1);
      const db = b.freq === 'monthly' ? (b.day||1) : (b.dateDay||1);
      return da - db;
    });
  }

  const allRecIncomes       = sortByPrioDay(budgetRecurring.filter(r => r.type === 'income'));
  const allRecExpMonthly    = sortByPrioDay(budgetRecurring.filter(r => r.type === 'expense' && r.freq === 'monthly'));
  const allRecExpYearly     = sortByPrioDay(budgetRecurring.filter(r => r.type === 'expense' && r.freq === 'yearly'));

  const recList = document.getElementById('budget-recurring-list');
  recList.innerHTML = '';

  if (budgetRecurring.length === 0) {
    recList.innerHTML = '<div class="empty-state">Noch keine wiederkehrenden Posten.</div>';
  } else {

    // Helper: render a subgroup with its own header and sum
    function renderRecSubgroup(entries, type, headerLabel, sumLabel, freqOverride) {
      if (!entries.length) return;

      const header = document.createElement('div');
      header.className = 'b-section-label';
      const dotCls = type === 'income' ? 'income' : (freqOverride === 'yearly' ? 'expense-yearly' : 'expense');
      header.innerHTML = `<span class="b-section-dot ${dotCls}"></span>${headerLabel}`;
      recList.appendChild(header);

      entries.forEach(r => {
        const recPaid = isRecurringPaid(r.id, viewMk);
        // Frequency chip replaces plain subtitle text
        const freqChip = r.freq === 'monthly'
          ? `<span class="b-freq-chip monthly">Monatlich</span>`
          : `<span class="b-freq-chip yearly">Jährlich · ${r.dateDay}.${String(r.dateMonth).padStart(2,'0')}.</span>`;

        recList.appendChild(makeBudgetRow({
          name: r.name, amount: r.amount, type: r.type,
          priority: r.priority || 'need', paid: recPaid,
          subtitleHtml: freqChip,
          onEdit:       () => openRecurringModal(r),
          onDel:        () => { budgetRecurring = budgetRecurring.filter(x => x.id !== r.id); saveBudgetRecurring(); renderBudget(); },
          onPaidToggle: () => {
            const nowPaid = !recPaid;
            setRecurringPaid(r.id, viewMk, nowPaid);
            if (nowPaid) { kontostand += r.type === 'income' ? r.amount : -r.amount; }
            else         { kontostand += r.type === 'income' ? -r.amount : r.amount; }
            DB.set('kontostand', kontostand);
            renderBudget();
          }
        }));
      });

      const total  = entries.reduce((s, r) => s + r.amount, 0);
      const sumRow = document.createElement('div');
      sumRow.className = 'b-sum-row' + (freqOverride === 'yearly' ? ' b-sum-row-yearly' : '');
      sumRow.innerHTML = `
        <span class="b-sum-label">${sumLabel}</span>
        <span class="b-sum-value ${type === 'income' ? 'income' : 'expense'}">${type === 'income' ? '+' : '-'}${total.toLocaleString('de-DE',{minimumFractionDigits:2})} €</span>`;
      recList.appendChild(sumRow);
    }

    // Income (all)
    renderRecSubgroup(allRecIncomes, 'income', 'Einnahmen', 'Summe Einnahmen', null);
    // Monthly expenses = Fixkosten
    renderRecSubgroup(allRecExpMonthly, 'expense', 'Monatliche Fixkosten', 'Monatliche Gesamtkosten', 'monthly');
    // Yearly expenses = Sonderkosten
    renderRecSubgroup(allRecExpYearly, 'expense', 'Jährliche Sonderkosten', 'Jährliche Sonderkosten', 'yearly');
  }

  renderBudgetTimeline();
  renderBudgetGoals();
  renderLiquidity();
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

function fmtEur(amount) {
  return (amount >= 0 ? '+' : '') + amount.toFixed(2) + ' €';
}

// Kontostand Modal
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
  DB.set('kontostand', kontostand);
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
    const nm   = document.createElement('span'); nm.className = 'budget-row-name'; nm.textContent = goal.name;
    const del  = document.createElement('button'); del.className = 'task-delete'; del.textContent = '✕'; del.style.opacity = '0';
    card.addEventListener('mouseenter', () => del.style.opacity = '1');
    card.addEventListener('mouseleave', () => del.style.opacity = '0');
    del.addEventListener('click', () => { budgetGoals = budgetGoals.filter(g => g.id !== goal.id); saveBudgetGoals(); renderBudgetGoals(); });
    head.append(nm, del);
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

let recurringType     = 'income';
let recurringFreq     = 'monthly';
let recurringPriority = 'need';
let recurringEditId   = null;

function openRecurringModal(entry = null) {
  recurringEditId = entry ? entry.id : null;

  document.getElementById('recurring-modal-title').textContent =
    entry ? 'Buchung bearbeiten' : 'Wiederkehrender Posten';

  if (entry) {
    document.getElementById('recurring-name').value   = entry.name;
    document.getElementById('recurring-amount').value = entry.amount;
    recurringType     = entry.type;
    recurringFreq     = entry.freq;
    recurringPriority = (entry.priority && entry.priority !== 'none') ? entry.priority : 'need';
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
    ['recurring-name','recurring-amount','recurring-day','recurring-date-day','recurring-date-month']
      .forEach(id => document.getElementById(id).value = '');
    recurringType = 'income'; recurringFreq = 'monthly'; recurringPriority = 'need';
  }

  ['income','expense'].forEach(t =>
    document.getElementById(`recurring-type-${t}`).classList.toggle('active', t === recurringType));
  ['monthly','yearly'].forEach(f =>
    document.getElementById(`recurring-freq-${f}`).classList.toggle('active', f === recurringFreq));
  ['must','need','want'].forEach(p =>
    document.getElementById(`recurring-prio-${p}`).classList.toggle('active', p === recurringPriority));

  document.getElementById('recurring-day-row').classList.toggle('hidden',  recurringFreq !== 'monthly');
  document.getElementById('recurring-date-row').classList.toggle('hidden', recurringFreq !== 'yearly');
  // Priority row: always visible, but dimmed for income entries
  document.getElementById('recurring-prio-row').classList.remove('hidden');
  document.getElementById('recurring-prio-row').classList.toggle('budget-prio-row-dimmed', recurringType !== 'expense');

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
  const amount = parseFloat(document.getElementById('recurring-amount').value) || 0;

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
  document.getElementById('onetime-name').value = ''; document.getElementById('onetime-amount').value = '';
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
  budgetOnetime.push({
    id: crypto.randomUUID(), name, type: onetimeType, amount,
    monthKey: budgetMonthKey(budgetMonth),
    priority: onetimeType === 'expense' ? onetimePriority : 'none',
    paid: false,
  });
  saveBudgetOnetime();
  document.getElementById('onetime-modal-overlay').classList.add('hidden');
  renderBudget();
});

// =========================
// GOAL MODALS
// =========================

document.getElementById('add-goal-btn').addEventListener('click', () => {
  document.getElementById('goal-name').value = ''; document.getElementById('goal-target').value = '';
  document.getElementById('goal-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('goal-name').focus(), 50);
});
document.getElementById('goal-modal-close').addEventListener('click',  () => document.getElementById('goal-modal-overlay').classList.add('hidden'));
document.getElementById('goal-cancel').addEventListener('click',        () => document.getElementById('goal-modal-overlay').classList.add('hidden'));
document.getElementById('goal-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('goal-modal-overlay'))
    document.getElementById('goal-modal-overlay').classList.add('hidden');
});
document.getElementById('goal-save').addEventListener('click', () => {
  const name = document.getElementById('goal-name').value.trim();
  if (!name) return;
  const target = parseFloat(document.getElementById('goal-target').value) || 0;
  budgetGoals.push({ id: crypto.randomUUID(), name, target, current: 0 });
  saveBudgetGoals();
  document.getElementById('goal-modal-overlay').classList.add('hidden');
  renderBudgetGoals();
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
  goalTxTarget = null;
});

// Wire secondary add-buttons — bind directly, no DOMContentLoaded proxy needed
// (DOMContentLoaded may have already fired by the time budget.js runs in a SPA)
function bindSecondaryButtons() {
  const pairs = [
    ['add-recurring-btn-2', 'add-recurring-btn'],
    ['add-onetime-btn-2',   'add-onetime-btn'],
    ['add-goal-btn-2',      'add-goal-btn'],
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
