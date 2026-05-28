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

  const { mustCovered, needCovered, wantCovered, afterMust, afterNeed, afterWant, openMust, gap } = proj;

  const status = !mustCovered ? 'red' : !needCovered ? 'yellow' : 'green';

  const hints = [];
  if (status === 'green') {
    hints.push({ icon: '✓', text: 'Alle Ausgaben sind gedeckt.', type: 'good' });
    // gap = endOfMonth - totalBeforeSalary, which is the same number shown as "Puffer" in the forecast
    if (gap > 0) hints.push({ icon: '✓', text: `Nach allen Ausgaben bleiben dir noch ${gap.toFixed(2)} €.`, type: 'good' });
  }
  if (status === 'yellow') {
    hints.push({ icon: '✓', text: 'Muss-Ausgaben sind gedeckt.', type: 'good' });
    hints.push({ icon: '✓', text: 'Brauche-Ausgaben sind gedeckt.', type: 'good' });
    hints.push({ icon: '⚠', text: 'Für alle Möchte-Ausgaben reicht es nicht ganz.', type: 'warn' });
    hints.push({ icon: '→', text: `Nach Muss & Brauche bleiben noch ${afterNeed.toFixed(2)} € für Extras.`, type: 'info' });
  }
  if (status === 'red') {
    hints.push({ icon: '!', text: 'Nicht alle Muss-Ausgaben sind gedeckt.', type: 'bad' });
    if (afterMust < 0) hints.push({ icon: '→', text: `Dir fehlen ${Math.abs(afterMust).toFixed(2)} € für deine Muss-Ausgaben.`, type: 'bad' });
    if (openMust > 0)  hints.push({ icon: '→', text: `Noch ${openMust.toFixed(2)} € offene Muss-Ausgaben diesen Monat.`, type: 'bad' });
  }

  return { status, mustCovered, needCovered, wantCovered, hints };
}

function renderFinancialStatus(fs) {
  const existing = document.getElementById('budget-status-bar');
  if (existing) existing.remove();
  if (!fs) return;

  const bar = document.createElement('div');
  bar.id = 'budget-status-bar';
  bar.className = `budget-status-bar budget-status-${fs.status}`;

  const labels    = { green: 'Stabil', yellow: 'Aufpassen', red: 'Kritisch' };
  const mustIcon  = fs.mustCovered ? '✓' : '✗';
  const needIcon  = fs.needCovered ? '✓' : (fs.mustCovered ? '–' : '✗');
  const wantIcon  = fs.wantCovered ? '✓' : '–';
  const mustClass = fs.mustCovered ? 'status-check-ok' : 'status-check-bad';
  const needClass = fs.needCovered ? 'status-check-ok' : (fs.mustCovered ? 'status-check-warn' : 'status-check-bad');
  const wantClass = fs.wantCovered ? 'status-check-ok' : 'status-check-neutral';

  bar.innerHTML = `
    <div class="budget-status-left">
      <span class="budget-status-dot budget-status-dot-${fs.status}"></span>
      <span class="budget-status-label">${labels[fs.status]}</span>
    </div>
    <div class="budget-status-checks">
      <span class="budget-status-check ${mustClass}"><span class="status-check-icon">${mustIcon}</span> Muss</span>
      <span class="budget-status-check ${needClass}"><span class="status-check-icon">${needIcon}</span> Brauche</span>
      <span class="budget-status-check ${wantClass}"><span class="status-check-icon">${wantIcon}</span> Möchte</span>
    </div>
    <div class="budget-status-hints">
      ${fs.hints.map(h => `<span class="budget-status-hint budget-hint-${h.type}">${h.icon} ${h.text}</span>`).join('')}
    </div>`;

  document.getElementById('budget-summary-bar').after(bar);
}

// =========================
// RENDER BUDGET
// =========================

function renderBudget(){
  const now       = new Date();
  const monthRec  = getRecurringForMonth(now);
  const curMkNow  = budgetMonthKey(now);

  const recIncome  = monthRec.filter(r=>r.type==='income') .reduce((s,r)=>s+r.amount,0);
  const recExpense = monthRec.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  const otIncome   = budgetOnetime.filter(e=>e.monthKey===curMkNow&&e.type==='income') .reduce((s,e)=>s+e.amount,0);
  const otExpense  = budgetOnetime.filter(e=>e.monthKey===curMkNow&&e.type==='expense').reduce((s,e)=>s+e.amount,0);
  const totalIn = recIncome+otIncome, totalOut = recExpense+otExpense, balance = totalIn-totalOut;

  document.getElementById('budget-summary-bar').innerHTML = `
    <div class="budget-summary-grid">
      <div class="budget-stat income">
        <div class="budget-stat-label">Einnahmen &middot; ${budgetMonthLabel(now)}</div>
        <div class="budget-stat-value">+${totalIn.toFixed(2)} &euro;</div>
      </div>
      <div class="budget-stat expense">
        <div class="budget-stat-label">Ausgaben &middot; ${budgetMonthLabel(now)}</div>
        <div class="budget-stat-value">-${totalOut.toFixed(2)} &euro;</div>
      </div>
      <div class="budget-stat ${balance>=0?'positive':'negative'}">
        <div class="budget-stat-label">Verfügbar</div>
        <div class="budget-stat-value">${balance>=0?'+':''}${balance.toFixed(2)} &euro;</div>
      </div>
    </div>`;

  renderFinancialStatus(calcFinancialStatus());

  document.getElementById('budget-month-label').textContent = budgetMonthLabel(budgetMonth);

  // One-time list
  const viewMk     = budgetMonthKey(budgetMonth);
  const onetimeList = document.getElementById('budget-onetime-list');
  onetimeList.innerHTML = '';
  const otEntries  = budgetOnetime.filter(e => e.monthKey === viewMk);
  if (otEntries.length === 0) {
    onetimeList.innerHTML = '<div class="empty-state">Keine einmaligen Buchungen in diesem Monat.</div>';
  } else {
    otEntries.forEach(e => {
      onetimeList.appendChild(makeBudgetRow({
        name: e.name, amount: e.amount, type: e.type,
        priority: e.priority || 'need', paid: e.paid || false,
        onDel:        () => { budgetOnetime = budgetOnetime.filter(x => x.id !== e.id); saveBudgetOnetime(); renderBudget(); },
        onPaidToggle: () => {
          const nowPaid = !e.paid;
          e.paid = nowPaid;
          // Mutate kontostand to reflect this real transaction
          if (nowPaid) {
            kontostand += e.type === 'income' ? e.amount : -e.amount;
          } else {
            kontostand += e.type === 'income' ? -e.amount : e.amount;
          }
          DB.set('kontostand', kontostand);
          saveBudgetOnetime();
          renderBudget();
        }
      }));
    });
  }

  // Recurring list — sorted: must first, then need, then want; within same priority by day
  const prioOrder = { must: 0, need: 1, want: 2, none: 1 };
  const sortedRecurring = [...budgetRecurring].sort((a, b) => {
    const pa = prioOrder[a.priority] ?? 1;
    const pb = prioOrder[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    const da = a.freq === 'monthly' ? (a.day || 1) : (a.dateDay || 1);
    const db = b.freq === 'monthly' ? (b.day || 1) : (b.dateDay || 1);
    return da - db;
  });

  const recList = document.getElementById('budget-recurring-list');
  recList.innerHTML = '';
  if (sortedRecurring.length === 0) {
    recList.innerHTML = '<div class="empty-state">Noch keine wiederkehrenden Posten.</div>';
  } else {
    sortedRecurring.forEach(r => {
      const sub = r.freq === 'monthly'
        ? `jeden ${r.day}.`
        : `${r.dateDay}.${String(r.dateMonth).padStart(2,'0')}. · jährlich`;
      const recPaid = isRecurringPaid(r.id, viewMk);
      recList.appendChild(makeBudgetRow({
        name: r.name, amount: r.amount, type: r.type,
        priority: r.priority || 'need', paid: recPaid, subtitle: sub,
        onEdit:       () => openRecurringModal(r),
        onDel:        () => { budgetRecurring = budgetRecurring.filter(x => x.id !== r.id); saveBudgetRecurring(); renderBudget(); },
        onPaidToggle: () => {
          const nowPaid = !recPaid;
          setRecurringPaid(r.id, viewMk, nowPaid);
          // Mutate kontostand to reflect this real transaction
          if (nowPaid) {
            kontostand += r.type === 'income' ? r.amount : -r.amount;
          } else {
            kontostand += r.type === 'income' ? -r.amount : r.amount;
          }
          DB.set('kontostand', kontostand);
          renderBudget();
        }
      }));
    });
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

  // Kontostand bar
  const kBar = document.createElement('div');
  kBar.className = 'liquidity-kontostand-bar';
  if (kontostand === null) {
    kBar.innerHTML = `
      <span class="liquidity-kontostand-label">Kontostand nicht gesetzt</span>
      <button class="btn-ghost liquidity-edit-btn" id="kontostand-edit-btn" style="font-size:12px;padding:4px 12px;">Kontostand eingeben</button>`;
  } else {
    kBar.innerHTML = `
      <span class="liquidity-kontostand-label">Kontostand</span>
      <span class="liquidity-kontostand-value" style="color:${kontostand>=0?'var(--budget-income)':'var(--budget-expense)'}">
        ${kontostand>=0?'+':''}${kontostand.toFixed(2)} €
      </span>
      <button class="btn-ghost liquidity-edit-btn" id="kontostand-edit-btn" style="font-size:12px;padding:4px 12px;">Anpassen</button>`;
  }
  container.appendChild(kBar);
  document.getElementById('kontostand-edit-btn').addEventListener('click', openKontostandModal);

  // Get the central projection — bail if not available
  const proj = calcMonthProjection();
  if (!proj) return;

  const {
    kontostand: ks, pendingIncome, pendingExpense, endOfMonth,
    nextMonthDate, firstIncomeDay, expensesBefore,
    byPrio, totalBeforeSalary, gap, canAfford,
  } = proj;

  const now           = new Date();

  const grid = document.createElement('div');
  grid.className = 'liquidity-grid';

  // Card 1: This month
  const card1 = document.createElement('div');
  card1.className = 'liquidity-card';
  card1.innerHTML = `
    <div class="liquidity-card-title">Dieser Monat</div>
    <div class="liquidity-row">
      <span class="liquidity-row-label">Kontostand jetzt</span>
      <span class="liquidity-row-value">${fmtEur(ks)}</span>
    </div>
    <div class="liquidity-row">
      <span class="liquidity-row-label">Noch eingehend</span>
      <span class="liquidity-row-value income">+${pendingIncome.toFixed(2)} €</span>
    </div>
    <div class="liquidity-row">
      <span class="liquidity-row-label">Noch ausgehend</span>
      <span class="liquidity-row-value expense">-${pendingExpense.toFixed(2)} €</span>
    </div>
    <div class="liquidity-divider"></div>
    <div class="liquidity-row liquidity-row-total">
      <span class="liquidity-row-label">Voraussichtlich Ende ${now.toLocaleDateString('de-DE',{month:'long'})}</span>
      <span class="liquidity-row-value ${endOfMonth>=0?'income':'expense'}">${fmtEur(endOfMonth)}</span>
    </div>`;

  // Card 2: Next month — expenses grouped by priority (must first)
  const expenseGroupHTML = ['must','need','want'].map(prio => {
    const items = expensesBefore.filter(i => i.priority === prio);
    if (!items.length) return '';
    return items.map(i => `
      <div class="liquidity-expense-item">
        <span>${i.name} ${priorityBadge(i.priority)}</span>
        <span class="expense">-${i.amount.toFixed(2)} €</span>
      </div>`).join('');
  }).join('');

  const card2 = document.createElement('div');
  card2.className = `liquidity-card ${canAfford ? 'liquidity-ok' : 'liquidity-warn'}`;
  const nextMonthName = nextMonthDate.toLocaleDateString('de-DE', {month:'long'});
  card2.innerHTML = `
    <div class="liquidity-card-title">
      ${nextMonthName}
      <span class="liquidity-status-badge ${canAfford?'ok':'warn'}">${canAfford ? '✓ Ausreichend' : '⚠ Puffer fehlt'}</span>
    </div>
    <div class="liquidity-row">
      <span class="liquidity-row-label">Du startest mit</span>
      <span class="liquidity-row-value ${endOfMonth>=0?'income':'expense'}">${fmtEur(endOfMonth)}</span>
    </div>
    <div class="liquidity-row">
      <span class="liquidity-row-label">Ausgaben vor ${firstIncomeDay>28?'Monatsende':'Tag '+firstIncomeDay} (vor Gehalt)</span>
      <span class="liquidity-row-value expense">-${totalBeforeSalary.toFixed(2)} €</span>
    </div>
    ${expenseGroupHTML ? `<div class="liquidity-expense-list">${expenseGroupHTML}</div>` : ''}
    <div class="liquidity-divider"></div>
    <div class="liquidity-row liquidity-row-total">
      <span class="liquidity-row-label">${canAfford ? 'Puffer nach Ausgaben' : 'Fehlender Betrag'}</span>
      <span class="liquidity-row-value ${canAfford?'income':'expense'}">${canAfford?'+':''}${gap.toFixed(2)} €</span>
    </div>`;

  grid.append(card1, card2);
  container.appendChild(grid);
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

function makeBudgetRow({ name, amount, type, priority, paid, subtitle, onEdit, onDel, onPaidToggle }) {
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

  if (subtitle) {
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
document.getElementById('budget-month-prev').addEventListener('click', () => {
  budgetMonth = new Date(budgetMonth.getFullYear(), budgetMonth.getMonth()-1, 1); renderBudget();
});
document.getElementById('budget-month-next').addEventListener('click', () => {
  budgetMonth = new Date(budgetMonth.getFullYear(), budgetMonth.getMonth()+1, 1); renderBudget();
});

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
  document.getElementById('recurring-prio-row').classList.toggle('hidden', recurringType !== 'expense');

  document.getElementById('recurring-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('recurring-name').focus(), 50);
}

document.getElementById('add-recurring-btn').addEventListener('click', () => openRecurringModal());

['income','expense'].forEach(t => {
  document.getElementById(`recurring-type-${t}`).addEventListener('click', () => {
    recurringType = t;
    ['income','expense'].forEach(x =>
      document.getElementById(`recurring-type-${x}`).classList.toggle('active', x === t));
    document.getElementById('recurring-prio-row').classList.toggle('hidden', t !== 'expense');
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
