// =========================
// TODAY — „Heute fällig“ (nur lesend)
// Kleine Zeile im Begrüßungsbereich: welche Budget-Posten heute anstehen
// (wiederkehrende Termine außer „täglich“ + Einmalbuchungen mit heutigem
// Datum, jeweils noch nicht erledigt). Bewusst KEINE Budgetfunktion auf
// der Heute-Seite (today.md: „Budgetfunktionen nicht übernehmen“) — kein
// Abhaken hier, ein Klick öffnet den Budget-Tab.
// Lädt nach allen budget*.js (liest budgetRecurring/budgetOnetime,
// recurringOccurrencesInMonth, isRecurringPaid, fmtEuro, escHtml).
// Eigener Key: todayBudgetDue (settings.js: NOOK_DATA_GROUPS „Heute“).
// =========================

let todayBudgetDue = DB.get('todayBudgetDue', true);
function saveTodayBudgetDue() { DB.set('todayBudgetDue', todayBudgetDue); }

function todayBudgetDueItems() {
  if (typeof budgetRecurring === 'undefined') return [];
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
  const iso = isoDateYMD(y, m, d), mk = budgetMonthKey(now);
  const items = [];
  budgetRecurring.forEach(r => {
    if (r.freq === 'daily' || isRecurringPaid(r.id, mk)) return;
    if (recurringOccurrencesInMonth(r, y, m).some(o => o.date === iso)) {
      items.push({ name: r.name, amount: r.amount, type: r.type });
    }
  });
  budgetOnetime.forEach(e => {
    if (e.monthKey === mk && (e.day || 1) === d && !e.paid) items.push({ name: e.name, amount: e.amount, type: e.type });
  });
  return items;
}

function renderTodayBudgetDue() {
  const block = document.getElementById('today-greeting-block');
  if (!block) return;
  let el = document.getElementById('today-budget-due');
  const hiddenBudget = typeof hiddenTabs !== 'undefined' && hiddenTabs.includes('budget');
  const items = todayBudgetDue && !hiddenBudget ? todayBudgetDueItems() : [];
  if (!items.length) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('button');
    el.type = 'button';
    el.id = 'today-budget-due';
    el.className = 'today-budget-due';
    el.title = 'Im Budget öffnen';
    el.addEventListener('click', () => showView('budget'));
    // unter Datum bzw. Fortschritts-Tracker
    const anchor = document.getElementById('today-tracker') || document.getElementById('today-subtitle');
    anchor ? anchor.after(el) : block.appendChild(el);
  }
  el.innerHTML = `<span class="today-budget-due-label">💶 Heute fällig</span>` + items.map(i =>
    `<span class="today-budget-due-item"><span>${escHtml(i.name)}</span>
       <b class="${i.type === 'income' ? 'income' : 'expense'}">${i.type === 'income' ? '+' : '−'}${fmtEuro(i.amount)}</b></span>`).join('');
}

// ── Einstellungen (Heute-Seite) ──────────────────────────────────────────
function renderTodayBudgetDueSettings() {
  const toggle = document.getElementById('setting-today-budget-due');
  if (toggle) toggle.checked = !!todayBudgetDue;
}
document.getElementById('setting-today-budget-due')?.addEventListener('change', e => {
  todayBudgetDue = e.target.checked;
  saveTodayBudgetDue();
  renderTodayBudgetDue();
});

renderTodayBudgetDue();
