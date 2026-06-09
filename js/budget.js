// =========================
// BUDGET
// =========================

let budgetRecurring = DB.get('budgetRecurring', []);
let budgetOnetime   = DB.get('budgetOnetime', []);
let budgetGoals     = DB.get('budgetGoals', []);
let budgetMonth     = new Date();

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

function calcFinancialStatus() {
  if (kontostand === null) return null;
  const curMk       = budgetMonthKey(new Date());
  const curRecItems = getMonthRecurringItems(new Date().getFullYear(), new Date().getMonth()+1);

  // Offene Ausgaben nach Priorität
  const openByPrio = { must: 0, need: 0, want: 0 };
  curRecItems.filter(i => i.type === 'expense' && !isRecurringPaid(i.id, curMk))
    .forEach(i => { openByPrio[i.priority || 'need'] = (openByPrio[i.priority || 'need'] || 0) + i.amount; });
  budgetOnetime.filter(e => e.monthKey === curMk && e.type === 'expense' && !e.paid)
    .forEach(e => { openByPrio[e.priority || 'need'] = (openByPrio[e.priority || 'need'] || 0) + e.amount; });

  const afterMust   = kontostand - openByPrio.must;
  const afterNeed   = afterMust  - openByPrio.need;
  const afterWant   = afterNeed  - openByPrio.want;
  const mustCovered = afterMust >= 0;
  const needCovered = afterNeed >= 0;
  const wantCovered = afterWant >= 0;
  const gap         = afterWant;
  const status      = !mustCovered ? 'red' : !needCovered ? 'red' : !wantCovered ? 'yellow' : 'green';

  const checks = [];
  if (mustCovered) {
    checks.push({ icon: '✓', iconClass: 'ok', label: 'Muss-Ausgaben sind gedeckt.' });
  } else {
    checks.push({ icon: '✗', iconClass: 'bad', label: `Muss-Ausgaben nicht gedeckt. Fehlbetrag: ${Math.abs(afterMust).toFixed(2)} €` });
  }
  if (!mustCovered) {
    checks.push({ icon: '–', iconClass: 'neutral', label: 'Brauche-Ausgaben (nicht auswertbar)' });
  } else if (needCovered) {
    checks.push({ icon: '✓', iconClass: 'ok', label: 'Brauche-Ausgaben sind gedeckt.' });
  } else {
    checks.push({ icon: '✗', iconClass: 'bad', label: `Brauche-Ausgaben nicht vollständig gedeckt. Fehlbetrag: ${Math.abs(afterNeed).toFixed(2)} €` });
  }
  if (!mustCovered || !needCovered) {
    checks.push({ icon: '–', iconClass: 'neutral', label: 'Möchte-Ausgaben (nicht auswertbar)' });
  } else if (wantCovered) {
    checks.push({ icon: '✓', iconClass: 'ok', label: 'Möchte-Ausgaben sind gedeckt.' });
  } else {
    checks.push({ icon: '⚠', iconClass: 'warn', label: 'Für optionale Ausgaben reicht es nicht ganz.' });
  }

  let hint = null;
  if (status === 'green') {
    hint = gap > 0
      ? { text: `Nach allen offenen Ausgaben bleiben dir noch ${gap.toFixed(2)} € übrig.`, type: 'good' }
      : { text: 'Alle offenen Ausgaben sind gedeckt.', type: 'good' };
  } else if (status === 'yellow') {
    hint = { text: `Für optionale Ausgaben fehlen noch ${Math.abs(gap).toFixed(2)} €. Pflichtausgaben sind gesichert.`, type: 'warn' };
  } else {
    hint = !mustCovered
      ? { text: `Muss-Ausgaben nicht gedeckt — es fehlen ${Math.abs(afterMust).toFixed(2)} €.`, type: 'bad' }
      : { text: `Brauche-Ausgaben nicht vollständig gedeckt — es fehlen ${Math.abs(afterNeed).toFixed(2)} €.`, type: 'bad' };
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
// RENDER BUDGET — HAUPTFUNKTION
// =========================

function renderBudget() {
  const now    = new Date();
  const curMk  = budgetMonthKey(budgetMonth);

  document.getElementById('budget-month-label').textContent = budgetMonthLabel(budgetMonth);

  renderKontostandHeader();
  renderMainCards(budgetMonth, curMk);
  renderFinancialStatus(calcFinancialStatus());
  renderOnetimeList(curMk);
  renderRecurringList(curMk);
  renderBudgetTimeline();
  renderBudgetGoals();
  renderLiquidity();
  renderFinanzgarten();
  initSummaryCardToggles();
  initCardInlineToggles();
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

  // ── KARTE 3: Verfügbar ───
  const freeContent = document.getElementById('b-free-content');
  const freeSummary = document.getElementById('b-free-summary-val');
  freeContent.innerHTML = '';

  if (kontostand === null) {
    freeContent.innerHTML = '<div class="b-main-empty" style="padding:12px 0;">Kein Kontostand gesetzt.</div>';
    if (freeSummary) { freeSummary.textContent = '—'; freeSummary.className = 'b-mcs-value'; }
  } else {
    const vbl = kontostand - openExpTotal;
    const fmt = v => v.toLocaleString('de-DE',{minimumFractionDigits:2});
    const vs  = vbl < 0 ? '-' : '+';
    freeContent.innerHTML = `
      <div class="b-free-row">
        <span class="b-free-label">Kontostand</span>
        <span class="b-free-val ${kontostand<0?'expense':''}">${kontostand<0?'':'+'}${fmt(kontostand)} €</span>
      </div>
      <div class="b-free-row">
        <span class="b-free-label">Offene Ausgaben</span>
        <span class="b-free-val expense">-${fmt(openExpTotal)} €</span>
      </div>
      <div class="b-free-divider"></div>
      <div class="b-free-row b-free-row-total">
        <span class="b-free-label-big">Verbleibend</span>
        <span class="b-free-val-big ${vbl<0?'expense':'income'}">${vs}${fmt(Math.abs(vbl))} €</span>
      </div>`;
    if (freeSummary) {
      freeSummary.textContent = vs + fmt(Math.abs(vbl)) + ' €';
      freeSummary.className = 'b-mcs-value ' + (vbl < 0 ? 'expense' : 'income');
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

function fmtEur(amount) {
  return (amount >= 0 ? '+' : '') + amount.toFixed(2) + ' €';
}

// =========================
// FINANZGARTEN
// =========================

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
  seed:         `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gc" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFE566"/>
      <stop offset="55%" stop-color="#F5C518"/>
      <stop offset="100%" stop-color="#C8960A"/>
    </radialGradient>
  </defs>
  <ellipse cx="40" cy="64" rx="22" ry="7" fill="#C8A058" opacity=".3"/>
  <path d="M20 61 Q40 53 60 61 Q50 68 40 70 Q30 68 20 61Z" fill="#B8883A"/>
  <path d="M25 60 Q40 54 55 60 Q46 66 40 68 Q34 66 25 60Z" fill="#C89848"/>
  <ellipse cx="40" cy="53" rx="12" ry="4" fill="#9A7020" opacity=".35"/>
  <circle cx="40" cy="45" r="14" fill="url(#gc)"/>
  <circle cx="40" cy="45" r="11" fill="none" stroke="#C8A010" stroke-width="1.2" opacity=".55"/>
  <text x="40" y="50" text-anchor="middle" font-size="12" fill="#8A6008" font-weight="700" font-family="serif">€</text>
  <ellipse cx="34" cy="39" rx="4" ry="2.2" fill="white" opacity=".4" transform="rotate(-25 34 39)"/>
  <path d="M28 55 Q40 50 52 55 L52 61 Q40 65 28 61Z" fill="#B8883A"/>
</svg>`,
  sprout:       `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gc" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFE566"/>
      <stop offset="55%" stop-color="#F5C518"/>
      <stop offset="100%" stop-color="#C8960A"/>
    </radialGradient>
  </defs>
  <ellipse cx="40" cy="67" rx="22" ry="6" fill="#C8A058" opacity=".28"/>
  <path d="M22 64 Q40 55 58 64 Q48 71 40 72 Q32 71 22 64Z" fill="#B8883A"/>
  <path d="M28 63 Q40 55 52 63 Q44 69 40 71 Q36 69 28 63Z" fill="#C89848"/>
  <path d="M40 63 Q38 50 40 32" stroke="#5A9C28" stroke-width="4" stroke-linecap="round" fill="none"/>
  <path d="M39 52 Q27 47 24 37 Q34 36 39 48" fill="#6AA83A"/>
  <path d="M41 47 Q53 42 56 32 Q46 31 41 43" fill="#7AC840" opacity=".9"/>
  <circle cx="40" cy="28" r="10" fill="url(#gc)"/>
  <circle cx="40" cy="28" r="7.5" fill="none" stroke="#C8A010" stroke-width="1" opacity=".5"/>
  <text x="40" y="32.5" text-anchor="middle" font-size="8" fill="#8A6008" font-weight="700" font-family="serif">€</text>
  <ellipse cx="35" cy="23" rx="3" ry="1.8" fill="white" opacity=".42" transform="rotate(-20 35 23)"/>
</svg>`,
  small_plant:  `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gc" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFE566"/>
      <stop offset="55%" stop-color="#F5C518"/>
      <stop offset="100%" stop-color="#C8960A"/>
    </radialGradient>
    <radialGradient id="gl" cx="40%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#8ED855"/>
      <stop offset="100%" stop-color="#4A9020"/>
    </radialGradient>
  </defs>
  <ellipse cx="40" cy="70" rx="23" ry="6" fill="#C8A058" opacity=".28"/>
  <path d="M21 66 Q40 57 59 66 Q49 74 40 75 Q31 74 21 66Z" fill="#B8883A"/>
  <path d="M26 65 Q40 57 54 65 Q46 72 40 73 Q34 72 26 65Z" fill="#C89848"/>
  <path d="M40 65 Q38 53 39 38" stroke="#4A8820" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  <path d="M38 56 Q24 50 22 38 Q33 36 38 50" fill="url(#gl)"/>
  <path d="M41 49 Q55 43 57 31 Q46 29 41 43" fill="url(#gl)" opacity=".88"/>
  <path d="M39 42 Q28 34 30 22 Q40 22 39 34" fill="url(#gl)" opacity=".82"/>
  <path d="M41 38 Q52 30 54 18 Q44 18 41 30" fill="url(#gl)" opacity=".82"/>
  <line x1="39" y1="53" x2="24" y2="46" stroke="#4A8820" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="21" cy="43" r="10" fill="url(#gc)"/>
  <circle cx="21" cy="43" r="7.5" fill="none" stroke="#D0A808" stroke-width="1" opacity=".55"/>
  <text x="21" y="47.5" text-anchor="middle" font-size="8" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <ellipse cx="15" cy="37" rx="3" ry="1.8" fill="white" opacity=".42" transform="rotate(-22 15 37)"/>
  <line x1="41" y1="45" x2="56" y2="38" stroke="#4A8820" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="59" cy="35" r="10" fill="url(#gc)"/>
  <circle cx="59" cy="35" r="7.5" fill="none" stroke="#D0A808" stroke-width="1" opacity=".55"/>
  <text x="59" y="39.5" text-anchor="middle" font-size="8" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <ellipse cx="53" cy="29" rx="3" ry="1.8" fill="white" opacity=".42" transform="rotate(-22 53 29)"/>
  <circle cx="40" cy="20" r="11" fill="url(#gc)"/>
  <circle cx="40" cy="20" r="8.5" fill="none" stroke="#D0A808" stroke-width="1" opacity=".55"/>
  <text x="40" y="25" text-anchor="middle" font-size="9" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <ellipse cx="33" cy="14" rx="3.5" ry="2" fill="white" opacity=".44" transform="rotate(-22 33 14)"/>
</svg>`,
  medium_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gc" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFE566"/><stop offset="55%" stop-color="#F5C518"/><stop offset="100%" stop-color="#C8960A"/></radialGradient>
    <radialGradient id="gk" cx="40%" cy="30%" r="70%"><stop offset="0%" stop-color="#8ED855"/><stop offset="100%" stop-color="#3A8010"/></radialGradient>
    <radialGradient id="gt" cx="30%" cy="20%" r="80%"><stop offset="0%" stop-color="#C8924A"/><stop offset="100%" stop-color="#7A4A18"/></radialGradient>
  </defs>
  <ellipse cx="40" cy="72" rx="25" ry="7" fill="#C8A058" opacity=".3"/>
  <path d="M18 68 Q40 58 62 68 Q50 76 40 78 Q30 76 18 68Z" fill="#B8883A"/>
  <path d="M23 67 Q40 59 57 67 Q48 74 40 76 Q32 74 23 67Z" fill="#C89848"/>
  <path d="M38 68 Q36 58 37 44 Q38 30 38 18" stroke="url(#gt)" stroke-width="8" stroke-linecap="round" fill="none"/>
  <path d="M42 68 Q41 58 40 44 Q40 30 41 18" stroke="#C8924A" stroke-width="4" stroke-linecap="round" fill="none" opacity=".4"/>
  <path d="M38 50 Q25 44 20 33" stroke="url(#gt)" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <path d="M40 43 Q53 37 58 26" stroke="url(#gt)" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <path d="M38 36 Q27 26 28 15" stroke="url(#gt)" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  <path d="M40 32 Q50 22 50 11" stroke="url(#gt)" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  <ellipse cx="18" cy="28" rx="16" ry="12" fill="url(#gk)" opacity=".88"/>
  <ellipse cx="60" cy="22" rx="16" ry="12" fill="url(#gk)" opacity=".88"/>
  <ellipse cx="25" cy="11" rx="14" ry="10" fill="url(#gk)" opacity=".88"/>
  <ellipse cx="40" cy="7" rx="18" ry="11" fill="url(#gk)"/>
  <ellipse cx="53" cy="9" rx="12" ry="8" fill="url(#gk)" opacity=".85"/>
  <ellipse cx="26" cy="22" rx="7" ry="4" fill="#F0C820" opacity=".7" transform="rotate(-28 26 22)"/>
  <ellipse cx="52" cy="18" rx="7" ry="4" fill="#F0C820" opacity=".7" transform="rotate(26 52 18)"/>
  <ellipse cx="34" cy="14" rx="6" ry="3.5" fill="#F0C820" opacity=".68" transform="rotate(-18 34 14)"/>
  <ellipse cx="48" cy="12" rx="6" ry="3.5" fill="#F0C820" opacity=".68" transform="rotate(15 48 12)"/>
  <circle cx="15" cy="23" r="10" fill="url(#gc)"/>
  <circle cx="15" cy="23" r="7.5" fill="none" stroke="#D0A808" stroke-width="1" opacity=".6"/>
  <text x="15" y="27.5" text-anchor="middle" font-size="8" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <ellipse cx="8" cy="17" rx="3.2" ry="1.8" fill="white" opacity=".44" transform="rotate(-22 8 17)"/>
  <circle cx="63" cy="17" r="10" fill="url(#gc)"/>
  <circle cx="63" cy="17" r="7.5" fill="none" stroke="#D0A808" stroke-width="1" opacity=".6"/>
  <text x="63" y="21.5" text-anchor="middle" font-size="8" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <ellipse cx="56" cy="11" rx="3.2" ry="1.8" fill="white" opacity=".44" transform="rotate(-22 56 11)"/>
  <circle cx="22" cy="8" r="9.5" fill="url(#gc)"/>
  <text x="22" y="12.5" text-anchor="middle" font-size="7.5" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <ellipse cx="16" cy="3" rx="3" ry="1.7" fill="white" opacity=".42" transform="rotate(-22 16 3)"/>
  <circle cx="55" cy="6" r="9.5" fill="url(#gc)"/>
  <text x="55" y="10.5" text-anchor="middle" font-size="7.5" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <circle cx="40" cy="4" r="11" fill="url(#gc)"/>
  <circle cx="40" cy="4" r="8" fill="none" stroke="#D0A808" stroke-width="1.2" opacity=".6"/>
  <text x="40" y="8.5" text-anchor="middle" font-size="9" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <ellipse cx="32" cy="-2" rx="4" ry="2.2" fill="white" opacity=".46" transform="rotate(-22 32 -2)"/>
</svg>`,
  large_plant:  `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gc" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFE566"/><stop offset="55%" stop-color="#F5C518"/><stop offset="100%" stop-color="#C8960A"/></radialGradient>
    <radialGradient id="gc2" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#FFE980"/><stop offset="55%" stop-color="#F5C518"/><stop offset="100%" stop-color="#B8840A"/></radialGradient>
    <radialGradient id="gk" cx="40%" cy="30%" r="70%"><stop offset="0%" stop-color="#90D860"/><stop offset="100%" stop-color="#3A8010"/></radialGradient>
    <radialGradient id="gt" cx="30%" cy="20%" r="80%"><stop offset="0%" stop-color="#C8924A"/><stop offset="100%" stop-color="#7A4A18"/></radialGradient>
    <filter id="ds"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#8B6010" flood-opacity=".2"/></filter>
  </defs>
  <ellipse cx="40" cy="74" rx="27" ry="7" fill="#C8A058" opacity=".32"/>
  <path d="M16 70 Q40 59 64 70 Q52 79 40 80 Q28 79 16 70Z" fill="#B8883A"/>
  <path d="M20 69 Q40 60 60 69 Q50 77 40 78 Q30 77 20 69Z" fill="#C89848"/>
  <path d="M38 16 Q37 16 36 70" stroke="url(#gt)" stroke-width="10" stroke-linecap="round" fill="none"/>
  <path d="M43 16 Q42 38 41 54 Q40 62 40 70" stroke="#C8924A" stroke-width="5" stroke-linecap="round" fill="none" opacity=".4"/>
  <path d="M37 52 Q22 46 16 33" stroke="url(#gt)" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M41 44 Q56 38 62 25" stroke="url(#gt)" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M37 40 Q20 30 20 16" stroke="url(#gt)" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <path d="M41 35 Q58 26 56 12" stroke="url(#gt)" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <ellipse cx="40" cy="18" rx="34" ry="22" fill="url(#gk)" opacity=".55"/>
  <ellipse cx="14" cy="28" rx="18" ry="13" fill="url(#gk)" opacity=".88"/>
  <ellipse cx="64" cy="21" rx="17" ry="12" fill="url(#gk)" opacity=".88"/>
  <ellipse cx="18" cy="13" rx="15" ry="11" fill="url(#gk)" opacity=".88"/>
  <ellipse cx="56" cy="9" rx="14" ry="10" fill="url(#gk)" opacity=".88"/>
  <ellipse cx="40" cy="6" rx="22" ry="13" fill="url(#gk)"/>
  <ellipse cx="20" cy="24" rx="9" ry="5" fill="#F0C820" opacity=".72" transform="rotate(-30 20 24)"/>
  <ellipse cx="58" cy="17" rx="9" ry="5" fill="#F0C820" opacity=".72" transform="rotate(28 58 17)"/>
  <ellipse cx="22" cy="12" rx="8" ry="4.5" fill="#F8D840" opacity=".68" transform="rotate(-22 22 12)"/>
  <ellipse cx="55" cy="8" rx="8" ry="4.5" fill="#F8D840" opacity=".68" transform="rotate(20 55 8)"/>
  <ellipse cx="35" cy="6" rx="7" ry="4" fill="#F0C820" opacity=".65" transform="rotate(-14 35 6)"/>
  <ellipse cx="47" cy="5" rx="7" ry="4" fill="#F0C820" opacity=".65" transform="rotate(14 47 5)"/>
  <circle cx="12" cy="23" r="11" fill="url(#gc2)" filter="url(#ds)"/><circle cx="12" cy="23" r="8.5" fill="none" stroke="#D0A808" stroke-width="1.2" opacity=".6"/>
  <text x="12" y="27.5" text-anchor="middle" font-size="9" fill="#7A5008" font-weight="700" font-family="serif">€</text><ellipse cx="5" cy="17" rx="3.5" ry="2" fill="white" opacity=".45" transform="rotate(-22 5 17)"/>
  <circle cx="67" cy="16" r="11" fill="url(#gc2)" filter="url(#ds)"/><circle cx="67" cy="16" r="8.5" fill="none" stroke="#D0A808" stroke-width="1.2" opacity=".6"/>
  <text x="67" y="20.5" text-anchor="middle" font-size="9" fill="#7A5008" font-weight="700" font-family="serif">€</text><ellipse cx="60" cy="10" rx="3.5" ry="2" fill="white" opacity=".45" transform="rotate(-22 60 10)"/>
  <circle cx="16" cy="9" r="10.5" fill="url(#gc2)" filter="url(#ds)"/>
  <text x="16" y="13.5" text-anchor="middle" font-size="8.5" fill="#7A5008" font-weight="700" font-family="serif">€</text><ellipse cx="9" cy="4" rx="3.2" ry="1.8" fill="white" opacity=".44" transform="rotate(-22 9 4)"/>
  <circle cx="57" cy="5" r="10.5" fill="url(#gc2)" filter="url(#ds)"/>
  <text x="57" y="9.5" text-anchor="middle" font-size="8.5" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <circle cx="36" cy="4" r="11" fill="url(#gc2)" filter="url(#ds)"/>
  <text x="36" y="8.5" text-anchor="middle" font-size="9" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <circle cx="54" cy="4" r="11" fill="url(#gc2)" filter="url(#ds)"/>
  <text x="54" y="8.5" text-anchor="middle" font-size="9" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <circle cx="40" cy="0" r="13" fill="url(#gc2)" filter="url(#ds)"/>
  <circle cx="40" cy="0" r="10" fill="none" stroke="#E0B000" stroke-width="1.5" opacity=".65"/>
  <text x="40" y="4.5" text-anchor="middle" font-size="11" fill="#7A5008" font-weight="700" font-family="serif">€</text>
  <ellipse cx="31" cy="-6" rx="4.5" ry="2.5" fill="white" opacity=".48" transform="rotate(-22 31 -6)"/>
  <path d="M4 36 L5.5 30 L7 36 L5.5 42Z" fill="#FFE566" opacity=".8"/>
  <path d="M74 30 L75.5 24 L77 30 L75.5 36Z" fill="#FFE566" opacity=".78"/>
  <circle cx="4" cy="44" r="2.5" fill="#FFE566" opacity=".68"/>
  <circle cx="76" cy="40" r="2.5" fill="#FFE566" opacity=".65"/>
</svg>`,
  flowering:    `<svg viewBox="0 0 340 340" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
  <radialGradient id="g-coin-a" cx="38%" cy="32%" r="62%">
    <stop offset="0%"   stop-color="#FFF3A0"/>
    <stop offset="40%"  stop-color="#F5C518"/>
    <stop offset="100%" stop-color="#C07C00"/>
  </radialGradient>
  <radialGradient id="g-coin-b" cx="38%" cy="32%" r="62%">
    <stop offset="0%"   stop-color="#FFEEA0"/>
    <stop offset="45%"  stop-color="#E8B010"/>
    <stop offset="100%" stop-color="#A06400"/>
  </radialGradient>
  <radialGradient id="g-coin-c" cx="38%" cy="32%" r="62%">
    <stop offset="0%"   stop-color="#FFE566"/>
    <stop offset="50%"  stop-color="#D4980C"/>
    <stop offset="100%" stop-color="#8A5400"/>
  </radialGradient>
  <radialGradient id="g-trunk" cx="28%" cy="18%" r="75%">
    <stop offset="0%"   stop-color="#D4A055"/>
    <stop offset="60%"  stop-color="#A06428"/>
    <stop offset="100%" stop-color="#6A3C10"/>
  </radialGradient>
  <radialGradient id="g-branch" cx="28%" cy="18%" r="75%">
    <stop offset="0%"   stop-color="#C89040"/>
    <stop offset="100%" stop-color="#7A4A18"/>
  </radialGradient>
  <radialGradient id="g-leaf-dk" cx="42%" cy="28%" r="70%">
    <stop offset="0%"   stop-color="#E8B820"/>
    <stop offset="55%"  stop-color="#C48C08"/>
    <stop offset="100%" stop-color="#8A5C00"/>
  </radialGradient>
  <radialGradient id="g-leaf-md" cx="42%" cy="28%" r="70%">
    <stop offset="0%"   stop-color="#F5CC30"/>
    <stop offset="55%"  stop-color="#D4A010"/>
    <stop offset="100%" stop-color="#9A6A00"/>
  </radialGradient>
  <radialGradient id="g-leaf-lt" cx="42%" cy="28%" r="70%">
    <stop offset="0%"   stop-color="#FFDE60"/>
    <stop offset="55%"  stop-color="#E8B820"/>
    <stop offset="100%" stop-color="#B48000"/>
  </radialGradient>
  <radialGradient id="g-ground" cx="50%" cy="30%" r="70%">
    <stop offset="0%"   stop-color="#F5CC30"/>
    <stop offset="60%"  stop-color="#C8960C"/>
    <stop offset="100%" stop-color="#8A5C00"/>
  </radialGradient>
  <radialGradient id="g-mound" cx="50%" cy="20%" r="65%">
    <stop offset="0%"   stop-color="#D4A855"/>
    <stop offset="100%" stop-color="#8A5820"/>
  </radialGradient>
</defs>
<ellipse cx="170" cy="303" rx="92" ry="18" fill="#C49030" opacity=".28"/>
<path d="M96 295 Q170 278 244 295 Q226 310 170 313 Q114 310 96 295Z" fill="url(#g-mound)"/>
<path d="M104 293 Q170 279 236 293 Q218 306 170 309 Q122 306 104 293Z" fill="#D4A845"/>
<ellipse cx="115" cy="301" rx="9"  ry="5"  fill="url(#g-ground)" opacity=".82"/>
<ellipse cx="130" cy="307" rx="7"  ry="4"  fill="url(#g-ground)" opacity=".75"/>
<ellipse cx="148" cy="310" rx="8"  ry="4.5" fill="url(#g-ground)" opacity=".72"/>
<ellipse cx="168" cy="311" rx="6"  ry="3.5" fill="url(#g-ground)" opacity=".7"/>
<ellipse cx="187" cy="310" rx="8"  ry="4.5" fill="url(#g-ground)" opacity=".72"/>
<ellipse cx="206" cy="306" rx="7"  ry="4"  fill="url(#g-ground)" opacity=".75"/>
<ellipse cx="222" cy="299" rx="9"  ry="5"  fill="url(#g-ground)" opacity=".82"/>
<ellipse cx="140" cy="304" rx="5"  ry="3"  fill="#F5CC30" opacity=".6"/>
<ellipse cx="200" cy="303" rx="5"  ry="3"  fill="#F5CC30" opacity=".6"/>
<ellipse cx="160" cy="308" rx="4"  ry="2.5" fill="#FFDE60" opacity=".55"/>
<ellipse cx="180" cy="308" rx="4"  ry="2.5" fill="#FFDE60" opacity=".55"/>
<ellipse cx="108" cy="298" rx="4"  ry="2.5" fill="#F0C020" opacity=".55"/>
<ellipse cx="230" cy="296" rx="4"  ry="2.5" fill="#F0C020" opacity=".55"/>
<path d="M155 292 Q149 268 147 242 Q145 218 148 194 Q150 172 154 152 Q156 136 158 118" stroke="url(#g-trunk)" stroke-width="26" stroke-linecap="round" fill="none"/>
<path d="M175 292 Q171 268 170 242 Q169 218 170 194 Q171 172 173 152 Q175 136 176 118" stroke="url(#g-branch)" stroke-width="16" stroke-linecap="round" fill="none" opacity=".45"/>
<path d="M155 270 Q151 258 152 246" stroke="#C08030" stroke-width="3" stroke-linecap="round" fill="none" opacity=".35"/>
<path d="M165 265 Q163 252 164 240" stroke="#C08030" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".3"/>
<path d="M153 200 Q126 186 112 168" stroke="url(#g-branch)" stroke-width="14" stroke-linecap="round" fill="none"/>
<path d="M160 185 Q136 168 124 148" stroke="url(#g-branch)" stroke-width="12" stroke-linecap="round" fill="none"/>
<path d="M163 170 Q148 148 144 126" stroke="url(#g-branch)" stroke-width="10" stroke-linecap="round" fill="none"/>
<path d="M168 200 Q194 186 208 168" stroke="url(#g-branch)" stroke-width="14" stroke-linecap="round" fill="none"/>
<path d="M166 185 Q190 168 202 148" stroke="url(#g-branch)" stroke-width="12" stroke-linecap="round" fill="none"/>
<path d="M165 170 Q182 148 186 126" stroke="url(#g-branch)" stroke-width="10" stroke-linecap="round" fill="none"/>
<path d="M162 155 Q162 132 162 112" stroke="url(#g-branch)" stroke-width="11" stroke-linecap="round" fill="none"/>
<path d="M153 145 Q136 124 128 102" stroke="url(#g-branch)" stroke-width="8" stroke-linecap="round" fill="none"/>
<path d="M170 140 Q186 119 192 96" stroke="url(#g-branch)" stroke-width="8" stroke-linecap="round" fill="none"/>
<ellipse cx="170" cy="145" rx="110" ry="86" fill="url(#g-leaf-dk)" opacity=".62"/>
<ellipse cx="170" cy="138" rx="100" ry="80" fill="url(#g-leaf-md)" opacity=".72"/>
<ellipse cx="108" cy="162" rx="52"  ry="38" fill="url(#g-leaf-dk)" opacity=".8"/>
<ellipse cx="232" cy="156" rx="50"  ry="36" fill="url(#g-leaf-dk)" opacity=".8"/>
<ellipse cx="115" cy="130" rx="48"  ry="36" fill="url(#g-leaf-md)" opacity=".82"/>
<ellipse cx="226" cy="124" rx="46"  ry="34" fill="url(#g-leaf-md)" opacity=".82"/>
<ellipse cx="135" cy="108" rx="44"  ry="32" fill="url(#g-leaf-lt)" opacity=".84"/>
<ellipse cx="205" cy="103" rx="44"  ry="32" fill="url(#g-leaf-lt)" opacity=".84"/>
<ellipse cx="170" cy="96"  rx="52"  ry="36" fill="url(#g-leaf-lt)" opacity=".88"/>
<ellipse cx="155" cy="80"  rx="40"  ry="28" fill="url(#g-leaf-lt)" opacity=".85"/>
<ellipse cx="185" cy="78"  rx="38"  ry="26" fill="url(#g-leaf-lt)" opacity=".85"/>
<ellipse cx="170" cy="68"  rx="46"  ry="30" fill="url(#g-leaf-lt)"/>
<ellipse cx="92"  cy="175" rx="20" ry="12" fill="url(#g-leaf-md)" transform="rotate(-22 92 175)"/>
<ellipse cx="248" cy="170" rx="20" ry="12" fill="url(#g-leaf-md)" transform="rotate(20 248 170)"/>
<ellipse cx="82"  cy="148" rx="18" ry="11" fill="url(#g-leaf-lt)" transform="rotate(-28 82 148)"/>
<ellipse cx="260" cy="142" rx="18" ry="11" fill="url(#g-leaf-lt)" transform="rotate(25 260 142)"/>
<ellipse cx="100" cy="118" rx="18" ry="11" fill="url(#g-leaf-dk)" transform="rotate(-20 100 118)"/>
<ellipse cx="242" cy="113" rx="18" ry="11" fill="url(#g-leaf-dk)" transform="rotate(18 242 113)"/>
<ellipse cx="120" cy="95"  rx="16" ry="10" fill="url(#g-leaf-md)" transform="rotate(-14 120 95)"/>
<ellipse cx="222" cy="90"  rx="16" ry="10" fill="url(#g-leaf-md)" transform="rotate(14 222 90)"/>
<ellipse cx="140" cy="70"  rx="16" ry="10" fill="url(#g-leaf-lt)" transform="rotate(-10 140 70)"/>
<ellipse cx="200" cy="67"  rx="15" ry="9"  fill="url(#g-leaf-lt)" transform="rotate(10 200 67)"/>
<ellipse cx="170" cy="55"  rx="18" ry="10" fill="url(#g-leaf-lt)"/>
<ellipse cx="154" cy="62"  rx="14" ry="8"  fill="url(#g-leaf-md)" transform="rotate(-8 154 62)"/>
<ellipse cx="186" cy="60"  rx="13" ry="8"  fill="url(#g-leaf-md)" transform="rotate(8 186 60)"/>
<circle cx="94"  cy="164" r="15"  fill="url(#g-coin-b)"/>
<circle cx="94"  cy="164" r="11.5" fill="none" stroke="#E8B000" stroke-width="1.5" opacity=".65"/>
<circle cx="94"  cy="164" r="8.5"  fill="none" stroke="#F5D040" stroke-width="0.8" opacity=".4"/>
<text x="94"  y="168.5" text-anchor="middle" font-size="9" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="87" cy="157" rx="4" ry="2.3" fill="white" opacity=".42" transform="rotate(-22 87 157)"/>
<circle cx="248" cy="158" r="15"  fill="url(#g-coin-b)"/>
<circle cx="248" cy="158" r="11.5" fill="none" stroke="#E8B000" stroke-width="1.5" opacity=".65"/>
<text x="248" y="162.5" text-anchor="middle" font-size="9" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="241" cy="151" rx="4" ry="2.3" fill="white" opacity=".42" transform="rotate(-22 241 151)"/>
<circle cx="106" cy="130" r="14"  fill="url(#g-coin-a)"/>
<circle cx="106" cy="130" r="10.5" fill="none" stroke="#F0C000" stroke-width="1.5" opacity=".6"/>
<text x="106" y="134" text-anchor="middle" font-size="8.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="99" cy="124" rx="3.5" ry="2" fill="white" opacity=".44" transform="rotate(-22 99 124)"/>
<circle cx="236" cy="124" r="14"  fill="url(#g-coin-a)"/>
<circle cx="236" cy="124" r="10.5" fill="none" stroke="#F0C000" stroke-width="1.5" opacity=".6"/>
<text x="236" y="128" text-anchor="middle" font-size="8.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="229" cy="118" rx="3.5" ry="2" fill="white" opacity=".44" transform="rotate(-22 229 118)"/>
<circle cx="130" cy="104" r="14"  fill="url(#g-coin-b)"/>
<circle cx="130" cy="104" r="10.5" fill="none" stroke="#E8B000" stroke-width="1.5" opacity=".62"/>
<text x="130" y="108" text-anchor="middle" font-size="8.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="123" cy="98"  rx="3.5" ry="2" fill="white" opacity=".42" transform="rotate(-22 123 98)"/>
<circle cx="211" cy="100" r="14"  fill="url(#g-coin-b)"/>
<circle cx="211" cy="100" r="10.5" fill="none" stroke="#E8B000" stroke-width="1.5" opacity=".62"/>
<text x="211" y="104" text-anchor="middle" font-size="8.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="204" cy="94"  rx="3.5" ry="2" fill="white" opacity=".42" transform="rotate(-22 204 94)"/>
<circle cx="148" cy="82"  r="13"  fill="url(#g-coin-a)"/>
<circle cx="148" cy="82"  r="9.5"  fill="none" stroke="#F0C000" stroke-width="1.5" opacity=".6"/>
<text x="148" y="86"   text-anchor="middle" font-size="8"   fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="142" cy="76" rx="3.2" ry="1.8" fill="white" opacity=".44" transform="rotate(-22 142 76)"/>
<circle cx="194" cy="78"  r="13"  fill="url(#g-coin-a)"/>
<circle cx="194" cy="78"  r="9.5"  fill="none" stroke="#F0C000" stroke-width="1.5" opacity=".6"/>
<text x="194" y="82"   text-anchor="middle" font-size="8"   fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="188" cy="72" rx="3.2" ry="1.8" fill="white" opacity=".44" transform="rotate(-22 188 72)"/>
<circle cx="148" cy="148" r="12"  fill="url(#g-coin-c)"/>
<circle cx="148" cy="148" r="9"    fill="none" stroke="#D8A400" stroke-width="1.2" opacity=".58"/>
<text x="148" y="152" text-anchor="middle" font-size="7.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="143" cy="143" rx="3" ry="1.7" fill="white" opacity=".38" transform="rotate(-22 143 143)"/>
<circle cx="192" cy="145" r="12"  fill="url(#g-coin-c)"/>
<circle cx="192" cy="145" r="9"    fill="none" stroke="#D8A400" stroke-width="1.2" opacity=".58"/>
<text x="192" y="149" text-anchor="middle" font-size="7.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="187" cy="140" rx="3" ry="1.7" fill="white" opacity=".38" transform="rotate(-22 187 140)"/>
<circle cx="122" cy="158" r="11"  fill="url(#g-coin-c)"/>
<text x="122" y="162" text-anchor="middle" font-size="7" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="117" cy="153" rx="2.8" ry="1.6" fill="white" opacity=".38" transform="rotate(-22 117 153)"/>
<circle cx="220" cy="153" r="11"  fill="url(#g-coin-c)"/>
<text x="220" y="157" text-anchor="middle" font-size="7" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="215" cy="148" rx="2.8" ry="1.6" fill="white" opacity=".38" transform="rotate(-22 215 148)"/>
<circle cx="170" cy="120" r="11"  fill="url(#g-coin-c)"/>
<circle cx="170" cy="120" r="8"    fill="none" stroke="#D8A400" stroke-width="1" opacity=".55"/>
<text x="170" y="124" text-anchor="middle" font-size="7" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="165" cy="115" rx="2.8" ry="1.6" fill="white" opacity=".38" transform="rotate(-22 165 115)"/>
<circle cx="170" cy="60"  r="18"  fill="url(#g-coin-a)"/>
<circle cx="170" cy="60"  r="14"   fill="none" stroke="#F5C800" stroke-width="2"   opacity=".7"/>
<circle cx="170" cy="60"  r="10"   fill="none" stroke="#E0A800" stroke-width="0.8" opacity=".45"/>
<text x="170" y="65"   text-anchor="middle" font-size="11"  fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="161" cy="52" rx="5.5" ry="3.2" fill="white" opacity=".5" transform="rotate(-22 161 52)"/>
<circle cx="115" cy="172" r="10"  fill="url(#g-coin-b)"/>
<text x="115" y="176" text-anchor="middle" font-size="6.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="110" cy="168" rx="2.5" ry="1.5" fill="white" opacity=".36" transform="rotate(-22 110 168)"/>
<circle cx="227" cy="167" r="10"  fill="url(#g-coin-b)"/>
<text x="227" y="171" text-anchor="middle" font-size="6.5" fill="#7A4C00" font-weight="700" font-family="Georgia,serif">€</text>
<ellipse cx="222" cy="163" rx="2.5" ry="1.5" fill="white" opacity=".36" transform="rotate(-22 222 163)"/>
<path d="M72 140 L73.6 134 L75.2 140 L73.6 146Z" fill="#FFE040" opacity=".88"/>
<path d="M73.6 132 L79.6 140 L73.6 148 L67.6 140Z" fill="#FFEE80" opacity=".55" transform="rotate(45 73.6 140)"/>
<circle cx="73.6" cy="140" r="2" fill="#FFF5B0" opacity=".7"/>
<path d="M272 128 L273.6 122 L275.2 128 L273.6 134Z" fill="#FFE040" opacity=".85"/>
<path d="M273.6 120 L279.6 128 L273.6 136 L267.6 128Z" fill="#FFEE80" opacity=".52" transform="rotate(45 273.6 128)"/>
<circle cx="273.6" cy="128" r="2" fill="#FFF5B0" opacity=".68"/>
<path d="M76 104 L77.2 99.4 L78.4 104 L77.2 108.6Z" fill="#FFD820" opacity=".8"/>
<circle cx="77.2" cy="104" r="1.5" fill="#FFF0A0" opacity=".65"/>
<path d="M266 98 L267.2 93.4 L268.4 98 L267.2 102.6Z" fill="#FFD820" opacity=".78"/>
<circle cx="267.2" cy="98" r="1.5" fill="#FFF0A0" opacity=".62"/>
<path d="M138 46 L139.5 41 L141 46 L139.5 51Z" fill="#FFE040" opacity=".82"/>
<path d="M139.5 39 L144.5 46 L139.5 53 L134.5 46Z" fill="#FFEE80" opacity=".48" transform="rotate(45 139.5 46)"/>
<path d="M202 43 L203.5 38 L205 43 L203.5 48Z" fill="#FFE040" opacity=".8"/>
<path d="M203.5 36 L208.5 43 L203.5 50 L198.5 43Z" fill="#FFEE80" opacity=".46" transform="rotate(45 203.5 43)"/>
<circle cx="90"  cy="88" r="2.5" fill="#FFE566" opacity=".7"/>
<circle cx="253" cy="82" r="2.5" fill="#FFE566" opacity=".68"/>
<circle cx="120" cy="56" r="2"   fill="#FFF0A0" opacity=".72"/>
<circle cx="220" cy="52" r="2"   fill="#FFF0A0" opacity=".7"/>
<path d="M85 170 L86.2 166 L87.4 170 L86.2 174Z"  fill="#FFD820" opacity=".72"/>
<path d="M258 163 L259.2 159 L260.4 163 L259.2 167Z" fill="#FFD820" opacity=".7"/>
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
    const del  = document.createElement('button'); del.className = 'task-delete'; del.textContent = '✕'; del.style.opacity = '0';
    card.addEventListener('mouseenter', () => del.style.opacity = '1');
    card.addEventListener('mouseleave', () => del.style.opacity = '0');
    del.addEventListener('click', () => {
      budgetGoals = budgetGoals.filter(g => g.id !== goal.id);
      // If the active garden goal was deleted, clear the stored ID
      const activeId = DB.get('gardenActiveGoalId', null);
      if (activeId === goal.id) DB.set('gardenActiveGoalId', null);
      saveBudgetGoals(); renderBudgetGoals(); renderFinanzgarten();
    });
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
  document.getElementById('goal-name').value = '';
  document.getElementById('goal-target').value = '';
  document.getElementById('goal-current').value = '';
  // Reset plant selector to first option
  const firstRadio = document.querySelector('input[name="goal-plant"]');
  if (firstRadio) firstRadio.checked = true;
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
  const target    = parseFloat(document.getElementById('goal-target').value) || 0;
  const current   = parseFloat(document.getElementById('goal-current').value) || 0;
  const plantRadio = document.querySelector('input[name="goal-plant"]:checked');
  const plantType = plantRadio ? plantRadio.value : 'sunflower';
  budgetGoals.push({ id: crypto.randomUUID(), name, target, current, plantType });
  saveBudgetGoals();
  document.getElementById('goal-modal-overlay').classList.add('hidden');
  renderBudgetGoals();
  renderFinanzgarten();
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
  goalTxTarget = null;
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
