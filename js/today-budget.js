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
  // „Bis zum nächsten Geld“ hängt an derselben Stelle (main.js ruft nur diese Funktion auf).
  if (typeof renderTodayBudgetDaily === 'function') setTimeout(renderTodayBudgetDaily, 0);
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

// ── „Bis zum nächsten Geld“ (nur lesend) ─────────────────────────────────
// Ein ruhiger Satz: was vom Kontostand bis zur nächsten Einnahme frei bleibt,
// geteilt durch die Tage bis dahin. Rechnung: BudgetTipps.nextMoneyWindow
// (budget-tipps.js) mit allen offenen Posten bis zum Tag vor dem Geld.
// Eigener Key: todayBudgetDaily (settings.js: NOOK_DATA_GROUPS „Heute“).
let todayBudgetDaily = DB.get('todayBudgetDaily', true);
function saveTodayBudgetDaily() { DB.set('todayBudgetDaily', todayBudgetDaily); }

// Gemeinsame Zeile für kleine Info-Chips (diese Zeile + „Lernplan“,
// today-lernplan.js): nebeneinander statt je eine volle Zeile, damit der
// Kopf der Heute-Seite ruhig bleibt. Steht direkt über der Wochen-Navigation;
// leer wird sie wieder entfernt.
function todayInfoRow(create = true) {
  let row = document.getElementById('today-info-row');
  if (!row && create) {
    const block = document.getElementById('today-greeting-block');
    if (!block) return null;
    row = document.createElement('div');
    row.id = 'today-info-row';
    row.className = 'today-info-row';
    const nav = document.getElementById('week-nav');
    nav ? nav.before(row) : block.appendChild(row);
  }
  return row;
}
function todayInfoRowTidy() {
  const row = todayInfoRow(false);
  if (row && !row.children.length) row.remove();
}

function renderTodayBudgetDaily() {
  let el = document.getElementById('today-budget-daily');
  const hiddenBudget = typeof hiddenTabs !== 'undefined' && hiddenTabs.includes('budget');
  const w = todayBudgetDaily && !hiddenBudget && typeof BudgetTipps !== 'undefined' && typeof nextMoneyEvents === 'function'
    ? BudgetTipps.nextMoneyWindow({ today: todayIso(), balance: kontostand, events: nextMoneyEvents() })
    : null;
  if (!w) { el?.remove(); todayInfoRowTidy(); return; }
  const row = todayInfoRow();
  if (!row) return;
  if (!el) {
    el = document.createElement('button');
    el.type = 'button';
    el.id = 'today-budget-daily';
    el.className = 'today-chip';
    el.addEventListener('click', () => showView('budget'));
    row.appendChild(el);
  }
  const when = `${w.date.slice(8, 10)}.${w.date.slice(5, 7)}.`;
  el.title = w.available > 0
    ? `Bis zum nächsten Geld (${w.name} am ${when}) bleiben etwa ${fmtEuro(w.perDay)} pro Tag. Klick öffnet das Budget.`
    : `Bis zum nächsten Geld (${w.name} am ${when}) ist alles verplant. Klick öffnet das Budget.`;
  el.innerHTML = w.available > 0
    ? `🌤️ <b>${fmtEuro(w.perDay)}</b> pro Tag bis ${when}`
    : `🌤️ bis ${when} alles verplant`;
}

// ── Einstellungen (Heute-Seite) ──────────────────────────────────────────
function renderTodayBudgetDueSettings() {
  const toggle = document.getElementById('setting-today-budget-due');
  if (toggle) toggle.checked = !!todayBudgetDue;
  const daily = document.getElementById('setting-today-budget-daily');
  if (daily) daily.checked = !!todayBudgetDaily;
}
document.getElementById('setting-today-budget-due')?.addEventListener('change', e => {
  todayBudgetDue = e.target.checked;
  saveTodayBudgetDue();
  renderTodayBudgetDue();
});
document.getElementById('setting-today-budget-daily')?.addEventListener('change', e => {
  todayBudgetDaily = e.target.checked;
  saveTodayBudgetDaily();
  renderTodayBudgetDaily();
});

renderTodayBudgetDue();
