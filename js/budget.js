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

const GARDEN_TREE_LEVELS = [
  { min: 0,    label: 'Samen',           stage: 'seed'        },
  { min: 100,  label: 'Keimling',        stage: 'sprout'      },
  { min: 200,  label: 'Kleine Pflanze',  stage: 'small_plant' },
  { min: 300, label: 'Mittlere Pflanze',stage: 'medium_plant'},
  { min: 400, label: 'Großer Baum',     stage: 'large_plant' },
  { min: 500, label: 'Blühender Baum',  stage: 'flowering'   },
];

function getTreeStage(ks) {
  if (ks === null || ks < 0) return GARDEN_TREE_LEVELS[0];
  for (let i = GARDEN_TREE_LEVELS.length - 1; i >= 0; i--) {
    if (ks >= GARDEN_TREE_LEVELS[i].min) return GARDEN_TREE_LEVELS[i];
  }
  return GARDEN_TREE_LEVELS[0];
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
const PLANT_COLORS = {
  sunflower:     { stem: '#8B9E3A', leaf: '#A8BC48', bloom: '#F5C518', bloomAlt: '#E89B10' },
  cactus:        { stem: '#4A9E5C', leaf: '#5CB87A', bloom: '#F87171', bloomAlt: '#DC2626' },
  bonsai:        { stem: '#6B4226', leaf: '#5A8A3C', bloom: '#F9A8D4', bloomAlt: '#EC4899' },
  potplant:      { stem: '#5C8A3C', leaf: '#7AAF50', bloom: '#86EFAC', bloomAlt: '#4ADE80' },
  cherryblossom: { stem: '#7A4A2A', leaf: '#6B8C3E', bloom: '#FBCFE8', bloomAlt: '#F9A8D4' },
};

function getColors(plantType) {
  return PLANT_COLORS[plantType] || PLANT_COLORS.sunflower;
}

// SVG stages — parameterized by plantType colors
function buildPlantSvg(stage, plantType) {
  const c = getColors(plantType || 'sunflower');
  const s = c.stem, l = c.leaf, b = c.bloom, ba = c.bloomAlt;

  const svgs = {
    seed: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="62" rx="16" ry="5" fill="#C5A882" opacity=".3"/>
      <ellipse cx="40" cy="58" rx="10" ry="8" fill="#8B6340" opacity=".9"/>
      <ellipse cx="40" cy="55" rx="7" ry="6" fill="#A07848"/>
      <ellipse cx="38" cy="53" rx="2" ry="3" fill="#C09A62" opacity=".6"/>
    </svg>`,
    sprout: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="66" rx="16" ry="4" fill="#C5A882" opacity=".28"/>
      <rect x="37" y="63" width="6" height="5" rx="2" fill="#8B6340"/>
      <line x1="40" y1="62" x2="40" y2="34" stroke="${s}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M40 50 Q28 44 26 33 Q36 33 40 46" fill="${l}" opacity=".9"/>
      <path d="M40 44 Q52 38 54 27 Q44 27 40 40" fill="${s}" opacity=".8"/>
    </svg>`,
    small_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="68" rx="17" ry="4" fill="#C5A882" opacity=".28"/>
      <rect x="36" y="64" width="8" height="6" rx="3" fill="#8B6340"/>
      <line x1="40" y1="63" x2="40" y2="26" stroke="${s}" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M40 52 Q24 46 22 32 Q34 30 40 46" fill="${l}"/>
      <path d="M40 44 Q56 38 58 24 Q46 22 40 38" fill="${s}" opacity=".85"/>
      <path d="M40 36 Q28 26 30 16 Q40 16 40 28" fill="${l}" opacity=".75"/>
    </svg>`,
    medium_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="70" rx="18" ry="4" fill="#C5A882" opacity=".28"/>
      <rect x="36" y="65" width="8" height="7" rx="3" fill="#7A5630"/>
      <line x1="40" y1="64" x2="40" y2="22" stroke="${s}" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="40" y1="52" x2="26" y2="42" stroke="${s}" stroke-width="2" stroke-linecap="round"/>
      <line x1="40" y1="44" x2="54" y2="34" stroke="${s}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="24" cy="38" r="11" fill="${l}" opacity=".88"/>
      <circle cx="56" cy="30" r="11" fill="${s}" opacity=".82"/>
      <circle cx="40" cy="18" r="13" fill="${l}"/>
    </svg>`,
    large_plant: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="72" rx="19" ry="4" fill="#C5A882" opacity=".28"/>
      <rect x="36" y="67" width="8" height="7" rx="3" fill="#7A5630"/>
      <line x1="40" y1="66" x2="40" y2="18" stroke="${s}" stroke-width="4" stroke-linecap="round"/>
      <line x1="40" y1="56" x2="23" y2="44" stroke="${s}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="40" y1="48" x2="57" y2="36" stroke="${s}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="40" y1="40" x2="25" y2="26" stroke="${s}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="21" cy="40" r="12" fill="${l}" opacity=".88"/>
      <circle cx="59" cy="32" r="12" fill="${s}" opacity=".84"/>
      <circle cx="23" cy="23" r="10" fill="${l}" opacity=".9"/>
      <circle cx="40" cy="14" r="13" fill="${s}"/>
    </svg>`,
    flowering: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="72" rx="19" ry="4" fill="#C5A882" opacity=".28"/>
      <rect x="36" y="67" width="8" height="7" rx="3" fill="#7A5630"/>
      <line x1="40" y1="66" x2="40" y2="16" stroke="${s}" stroke-width="4" stroke-linecap="round"/>
      <line x1="40" y1="54" x2="22" y2="42" stroke="${s}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="40" y1="46" x2="58" y2="34" stroke="${s}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="20" cy="38" r="11" fill="${l}" opacity=".88"/>
      <circle cx="60" cy="30" r="11" fill="${s}" opacity=".84"/>
      <circle cx="40" cy="12" r="12" fill="${l}"/>
      <!-- Blüten -->
      <circle cx="12" cy="20" r="6" fill="${b}" opacity=".92"/>
      <circle cx="68" cy="16" r="5" fill="${ba}" opacity=".88"/>
      <circle cx="40" cy="4"  r="5" fill="${b}" opacity=".9"/>
      <circle cx="54" cy="8"  r="4" fill="${ba}" opacity=".82"/>
      <circle cx="26" cy="10" r="4" fill="${b}" opacity=".82"/>
    </svg>`,
  };
  return svgs[stage] || svgs.seed;
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
        <div class="b-garden-svg">${buildPlantSvg(treeLevel.stage, 'bonsai')}</div>
        <div class="b-garden-plant-name">Finanzbaum</div>
        <div class="b-garden-plant-val">${treeKsStr}</div>
        <div class="b-garden-mini-bar">
          ${GARDEN_TREE_LEVELS.map((lv, i) => `<div class="b-garden-pip${kontostand !== null && kontostand >= lv.min ? ' filled' : ''}"></div>`).join('')}
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

  // Goal selector dropdown
  const selectBtn = card.querySelector('#garden-select-goal-btn');
  if (selectBtn && budgetGoals.length > 0) {
    selectBtn.addEventListener('click', () => {
      // Remove existing dropdown
      document.getElementById('garden-dropdown')?.remove();
      const dd = document.createElement('div');
      dd.id = 'garden-dropdown';
      dd.className = 'b-garden-dropdown';
      budgetGoals.forEach(g => {
        const item = document.createElement('button');
        item.className = 'b-garden-dropdown-item' + (g.id === (activeGoal?.id) ? ' active' : '');
        const emoji = PLANT_EMOJIS[g.plantType] || '🌱';
        const pct   = g.target > 0 ? Math.min(100, Math.round((g.current/g.target)*100)) : 0;
        item.innerHTML = `<span>${emoji} ${g.name}</span><span class="b-garden-dd-pct">${pct}%</span>`;
        item.addEventListener('click', () => {
          DB.set('gardenActiveGoalId', g.id);
          dd.remove();
          renderFinanzgarten();
        });
        dd.appendChild(item);
      });
      selectBtn.parentElement.appendChild(dd);
      // Close on outside click
      setTimeout(() => document.addEventListener('click', function close(e) {
        if (!dd.contains(e.target) && e.target !== selectBtn) { dd.remove(); document.removeEventListener('click', close); }
      }), 10);
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
    const nm   = document.createElement('span'); nm.className = 'budget-row-name'; nm.textContent = goal.name;
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
