// =========================
// BUDGET — KERN (Übersicht + Finanzgarten)
// Teil 1/3 des Budget-Moduls. Enthält Datenmodell, Helpers, Übersicht-
// Rendering, Finanzgarten und den Sub-Tab-Switcher, der budget.js,
// budget-sparprognose.js und budget-sparplaene.js verbindet.
// Lade-Reihenfolge: budget.js -> budget-sparprognose.js -> budget-sparplaene.js
// =========================

// =========================
// BUDGET
// =========================

let budgetRecurring = DB.get('budgetRecurring', []);
let budgetOnetime   = DB.get('budgetOnetime', []);
let budgetGoals     = DB.get('budgetGoals', []);
// Raten & Schulden — bewusst getrennt von budgetGoals: eine Schuld wird
// GETILGT, nicht "gespart". Strukturell fast identisch (Betrag,
// Fortschritt, Finanzierung), aber andere Sprache und andere Bedeutung
// für den Nutzer (siehe budget-debts.js).
let budgetDebts      = DB.get('budgetDebts', []);
let budgetMonth     = new Date();

let budgetActiveSubtab   = DB.get('budgetActiveSubtab', 'budget');       // 'budget' | 'sparplan' | 'sparplaene'
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
function saveBudgetDebts(){     DB.set('budgetDebts',     budgetDebts);     }

// Rundet exakt auf Cent — verhindert Fließkomma-Artefakte
// (z.B. 268.29999999999995 oder Anzeige mit 3 statt 2 Nachkommastellen).
// Bewusst HIER (budget.js, lädt als erstes) statt in budget-sparprognose.js:
// budget-sparziele.js und budget-financing.js rufen das schon beim Laden
// des Skripts auf (Migrationen), nicht erst bei einer späteren
// Nutzerinteraktion — zu diesem Zeitpunkt wäre budget-sparprognose.js
// noch gar nicht geladen gewesen (ReferenceError in echten Browsern,
// von einem jsdom-Test mit zusammengefügten Skripten nicht erkennbar).
function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function fmtEuro(v) {
  const r = round2(v);
  return (r < 0 ? '-' : '') + Math.abs(r).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

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
    // "Jedem Euro einen Job": Finanzierung nur für Ausgaben relevant.
    // Fehlende Zuordnung bleibt der unveränderte Normalfall (ganz normal
    // aus dem allgemeinen Topf bezahlt) — kein Zwang, keine Warnung.
    if (r.type === 'expense' && !Array.isArray(r.funding)) { r.funding = []; changed = true; }
  });
  budgetOnetime.forEach(e => {
    if (!e.priority) { e.priority = 'need'; changed = true; }
    if (e.paid === undefined) { e.paid = false; changed = true; }
    if (e.type === 'expense' && !Array.isArray(e.funding)) { e.funding = []; changed = true; }
  });
  budgetGoals.forEach(g => {
    if (g.eta === undefined) { g.eta = null; goalsChanged = true; }
    // Priorität analog zu Ausgaben (must/need/want) — steuert die
    // Zuteilungsreihenfolge in der Sparprognose (sparplanerETAs()).
    if (!g.priority) { g.priority = 'need'; goalsChanged = true; }
    // Sparziele-Umstellung: das Sparziel ist jetzt die zentrale Entität —
    // Kategorie/Beschreibung/Startdatum sind rein informativ, Finanzierung
    // & Reservierung leben ab jetzt hier (statt am Sparplan).
    if (g.category === undefined)    { g.category = null;    goalsChanged = true; }
    if (g.description === undefined) { g.description = null; goalsChanged = true; }
    if (g.startDate === undefined)   { g.startDate = null;    goalsChanged = true; }
    // Hinweis: die eigentliche Konvertierung von altem g.fundingSources
    // (Liste von IDs) zu g.funding (Liste von {sourceId, amount}) läuft in
    // budget-financing.js (braucht goalMonthlyReserveEquivalent() aus
    // budget-sparziele.js, die hier noch nicht geladen ist). Hier nur der
    // Default für wirklich neue Sparziele ohne jegliches Finanzierungsfeld.
    if (!Array.isArray(g.funding) && !Array.isArray(g.fundingSources)) { g.funding = []; goalsChanged = true; }
    if (g.reserveActive === undefined)    { g.reserveActive = false; goalsChanged = true; }
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
  { tab: 'sparziele',  panelId: 'budget-panel-sparziele',  btnId: 'budget-subtab-btn-sparziele' },
  { tab: 'sparplan',   panelId: 'budget-panel-sparplan',   btnId: 'budget-subtab-btn-sparplan' },
  { tab: 'sparplaene', panelId: 'budget-panel-sparplaene', btnId: 'budget-subtab-btn-sparplaene' },
  { tab: 'schulden',   panelId: 'budget-panel-schulden',   btnId: 'budget-subtab-btn-schulden' },
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
  if (tab === 'sparziele')  { if (typeof renderSparziele === 'function') renderSparziele(); }
  if (tab === 'sparplan')   renderSparplaner();
  if (tab === 'sparplaene') renderSparplaene();
  if (tab === 'schulden')   { if (typeof renderSchulden === 'function') renderSchulden(); }
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
  // Zuordnung je Einnahme — bewusst MINIMAL: nur "reserviert · frei".
  // Die Frage "Wofür?" beantwortet jetzt die Ausgabe selbst ("Bezahlt
  // durch"), nicht mehr die Einnahme — hier zählt nur noch "Wie viel
  // bekomme ich, wie viel ist frei?". Die ausführliche Aufschlüsselung
  // bleibt als Klick-Detail erreichbar (openIncomeBreakdown()).
  if (typeof financingAllocatedForIncome === 'function') {
    recIncomes.forEach(i => {
      const allocated = financingAllocatedForIncome(i.id, mk);
      if (allocated > 0.005) {
        const free = Math.max(0, round2(i.amount - allocated));
        const note = document.createElement('div');
        note.className = 'b-main-row-note b-main-row-note-clickable';
        note.textContent = `${allocated.toLocaleString('de-DE',{minimumFractionDigits:2})} € reserviert · ${free.toLocaleString('de-DE',{minimumFractionDigits:2})} € frei`;
        note.title = 'Aufschlüsselung anzeigen';
        note.addEventListener('click', () => {
          if (typeof openIncomeBreakdown === 'function') openIncomeBreakdown(i.id, mk);
        });
        incomeList.appendChild(note);
      }
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
      day:i.day||1, name:i.name, amount:i.amount, funding:i.funding,
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
      day:e.day||1, name:e.name, amount:e.amount, funding:e.funding,
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
      // "Jedem Euro einen Job" — zeigt direkt bei der Ausgabe, WOFÜR sie
      // bezahlt wird (nicht nur additiv bei der Einnahme). Beantwortet die
      // Frage "Wofür?" statt nur "Wie viel ist reserviert?".
      if (Array.isArray(row.funding) && row.funding.length) {
        const block = document.createElement('div');
        block.className = 'b-main-funding-block';
        const label = document.createElement('div');
        label.className = 'b-main-funding-label';
        label.textContent = 'Bezahlt durch';
        block.appendChild(label);
        row.funding.forEach(f => {
          const rec = budgetRecurring.find(r => r.id === f.sourceId);
          const item = document.createElement('div');
          item.className = 'b-main-funding-item';
          const icon = typeof incomeIcon === 'function' ? incomeIcon(rec?.name) : '';
          item.textContent = `${icon} ${rec ? rec.name : '?'} ${fmtEuro(f.amount)}`;
          block.appendChild(item);
        });
        expenseList.appendChild(block);
        const warning = typeof financingWarningsForConsumer === 'function'
          ? financingWarningsForConsumer(row.funding, row.amount) : null;
        if (warning) {
          const warnEl = document.createElement('div');
          warnEl.className = 'b-main-row-note b-main-row-warning';
          warnEl.textContent = `⚠ ${warning}`;
          expenseList.appendChild(warnEl);
        }
      }
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
    // Verknüpften Sparplan (falls vorhanden) rein informativ anzeigen —
    // sparplanForGoal() lebt in budget-sparplaene.js (später geladen),
    // daher defensiv per typeof prüfen (gleiches Muster wie bindMonthNav).
    const linkedPlan = typeof sparplanForGoal === 'function' ? sparplanForGoal(goal.id) : null;
    const linkHint = linkedPlan ? ` <span class="budget-badge" title="Verknüpfter Sparplan">🔗 ${linkedPlan.name}</span>` : '';
    nm.innerHTML = `<span class="budget-goal-emoji">${emoji}</span> ${goal.name} ${priorityBadge(goal.priority || 'need')}${linkHint}`;

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

// "Jedem Euro einen Job": Finanzierung ist nur für Ausgaben sinnvoll —
// Einnahmen können nicht sich selbst finanzieren. Referenzbetrag für die
// Live-Diff-Anzeige ist der aktuell eingetragene Ausgabenbetrag.
function updateRecurringFundingVisibility() {
  const show = recurringType === 'expense';
  document.getElementById('recurring-funding-row').classList.toggle('hidden', !show);
  document.getElementById('recurring-funding-list').classList.toggle('hidden', !show);
}
function currentRecurringAmount() {
  return parseFloat(document.getElementById('recurring-amount').value) || 0;
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
  updateRecurringFundingVisibility();
  if (typeof renderFundingEditor === 'function') {
    renderFundingEditor(document.getElementById('recurring-funding-list'), (entry && entry.funding) || [], currentRecurringAmount, 'rec-funding');
  }

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
    updateRecurringFundingVisibility();
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

document.getElementById('recurring-amount').addEventListener('input', () => {
  if (recurringType === 'expense' && typeof updateFundingDiff === 'function') {
    updateFundingDiff(document.getElementById('recurring-funding-list'), currentRecurringAmount(), 'rec-funding');
  }
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
  const fundingVal = (recurringType === 'expense' && typeof readFundingEditor === 'function')
    ? readFundingEditor(document.getElementById('recurring-funding-list'), 'rec-funding')
    : null;

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
      if (recurringType === 'expense') e.funding = fundingVal; else delete e.funding;
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
    if (recurringType === 'expense') entry.funding = fundingVal;
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

// "Jedem Euro einen Job": Finanzierung nur für Ausgaben, gilt (anders
// als bei wiederkehrenden Ausgaben) NUR für den Monat dieser Buchung —
// die Engine wertet das über monthKey in financingAllocatedForIncome()
// bereits automatisch aus (budget-financing.js).
function updateOnetimeFundingVisibility() {
  const show = onetimeType === 'expense';
  document.getElementById('onetime-funding-row').classList.toggle('hidden', !show);
  document.getElementById('onetime-funding-list').classList.toggle('hidden', !show);
}
function currentOnetimeAmount() {
  return parseFloat(document.getElementById('onetime-amount').value) || 0;
}

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
  updateOnetimeFundingVisibility();
  if (typeof renderFundingEditor === 'function') {
    renderFundingEditor(document.getElementById('onetime-funding-list'), [], currentOnetimeAmount, 'onetime-funding');
  }
  document.getElementById('onetime-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('onetime-name').focus(), 50);
});

document.getElementById('onetime-amount').addEventListener('input', () => {
  if (onetimeType === 'expense' && typeof updateFundingDiff === 'function') {
    updateFundingDiff(document.getElementById('onetime-funding-list'), currentOnetimeAmount, 'onetime-funding');
  }
});

['income','expense'].forEach(t => {
  document.getElementById(`onetime-type-${t}`).addEventListener('click', () => {
    onetimeType = t;
    ['income','expense'].forEach(x =>
      document.getElementById(`onetime-type-${x}`).classList.toggle('active', x === t));
    document.getElementById('onetime-prio-row').classList.toggle('hidden', t !== 'expense');
    updateOnetimeFundingVisibility();
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
    ...(onetimeType === 'expense' && typeof readFundingEditor === 'function'
      ? { funding: readFundingEditor(document.getElementById('onetime-funding-list'), 'onetime-funding') }
      : {}),
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
// NEU: Priorität des Sparziels (must/need/want) — nutzt dieselbe Badge-/
// Button-Logik wie die Ausgaben-Priorität (priorityBadge(), .budget-prio-btn).
let goalPriority = 'need';

function setGoalPriorityButtons(p) {
  ['must','need','want'].forEach(x => {
    const btn = document.getElementById(`goal-prio-${x}`);
    if (btn) btn.classList.toggle('active', x === p);
  });
}
['must','need','want'].forEach(p => {
  const btn = document.getElementById(`goal-prio-${p}`);
  if (btn) btn.addEventListener('click', () => { goalPriority = p; setGoalPriorityButtons(p); });
});

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
  document.getElementById('goal-category').value = '';
  document.getElementById('goal-description').value = '';
  document.getElementById('goal-startdate').value = '';
  document.getElementById('goal-reserve-active').checked = false;
  goalPriority = 'need';
  setGoalPriorityButtons(goalPriority);
  document.getElementById('goal-delete').classList.add('hidden');
  if (typeof renderFundingEditor === 'function') {
    renderFundingEditor(document.getElementById('goal-funding-list'), [], null, 'goal-funding');
  }
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
  document.getElementById('goal-category').value = goal.category || '';
  document.getElementById('goal-description').value = goal.description || '';
  document.getElementById('goal-startdate').value = goal.startDate || '';
  document.getElementById('goal-reserve-active').checked = !!goal.reserveActive;
  goalPriority = goal.priority || 'need';
  setGoalPriorityButtons(goalPriority);
  document.getElementById('goal-delete').classList.remove('hidden');
  if (typeof renderFundingEditor === 'function') {
    const suggestedTotal = typeof goalMonthlyReserveEquivalent === 'function' ? goalMonthlyReserveEquivalent(goal) : null;
    renderFundingEditor(document.getElementById('goal-funding-list'), goal.funding || [], suggestedTotal > 0 ? suggestedTotal : null, 'goal-funding');
  }
  const radio = document.querySelector(`input[name="goal-plant"][value="${goal.plantType}"]`);
  if (radio) radio.checked = true;
  else { const firstRadio = document.querySelector('input[name="goal-plant"]'); if (firstRadio) firstRadio.checked = true; }
  document.getElementById('goal-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('goal-name').focus(), 50);
}

document.getElementById('goal-modal-close').addEventListener('click',  closeGoalModal);
document.getElementById('goal-cancel').addEventListener('click',        closeGoalModal);
document.getElementById('goal-delete').addEventListener('click', () => {
  if (!editingGoalId) return;
  const goal = budgetGoals.find(g => g.id === editingGoalId);
  if (!goal) return;
  if (!confirm(`Sparziel "${goal.name}" wirklich löschen?`)) return;
  budgetGoals = budgetGoals.filter(g => g.id !== goal.id);
  const activeId = DB.get('gardenActiveGoalId', null);
  if (activeId === goal.id) DB.set('gardenActiveGoalId', null);
  saveBudgetGoals();
  closeGoalModal();
  renderBudgetGoals();
  renderFinanzgarten();
  if (typeof renderSparziele === 'function') renderSparziele();
  if (typeof renderSparplaner === 'function') renderSparplaner();
});
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
  const categoryVal    = document.getElementById('goal-category').value.trim() || null;
  const descriptionVal = document.getElementById('goal-description').value.trim() || null;
  const startDateVal   = document.getElementById('goal-startdate').value || null;
  const reserveActiveVal = document.getElementById('goal-reserve-active').checked;
  const fundingVal = typeof readFundingEditor === 'function'
    ? readFundingEditor(document.getElementById('goal-funding-list'), 'goal-funding')
    : [];

  if (editingGoalId) {
    const goal = budgetGoals.find(g => g.id === editingGoalId);
    if (goal) {
      goal.name = name;
      goal.target = target;
      goal.plantType = plantType;
      goal.eta = etaVal;
      goal.priority = goalPriority;
      goal.category = categoryVal;
      goal.description = descriptionVal;
      goal.startDate = startDateVal;
      goal.reserveActive = reserveActiveVal;
      goal.funding = fundingVal;
    }
    editingGoalId = null;
  } else {
    const current = parseFloat(document.getElementById('goal-current').value) || 0;
    budgetGoals.push({
      id: crypto.randomUUID(), name, target, current, plantType, eta: etaVal, priority: goalPriority,
      category: categoryVal, description: descriptionVal, startDate: startDateVal,
      reserveActive: reserveActiveVal, funding: fundingVal,
    });
  }
  saveBudgetGoals();
  document.getElementById('goal-modal-overlay').classList.add('hidden');
  renderBudgetGoals();
  renderFinanzgarten();
  renderSparplaner();
  if (typeof renderSparziele === 'function') renderSparziele();
});

// Ein gemeinsames Modal für Sparziel-Transaktionen (Einzahlen/Abheben)
// UND Schulden-Zahlungen (Bezahlen) — strukturell identisch (ein Betrag,
// eine Zielgröße), nur die Sprache unterscheidet sich. txKind steuert,
// welches Objekt/welche Felder betroffen sind.
// =========================
// DEBT MODAL (Raten & Schulden — create + edit)
// Strukturell fast identisch zum Sparziel-Modal, bewusst andere Sprache.
// =========================
let editingDebtId = null;
let debtPriority = 'need';

function setDebtPriorityButtons(p) {
  ['must','need','want'].forEach(x => {
    const btn = document.getElementById(`debt-prio-${x}`);
    if (btn) btn.classList.toggle('active', x === p);
  });
}
['must','need','want'].forEach(p => {
  const btn = document.getElementById(`debt-prio-${p}`);
  if (btn) btn.addEventListener('click', () => { debtPriority = p; setDebtPriorityButtons(p); });
});

function closeDebtModal() {
  document.getElementById('debt-modal-overlay').classList.add('hidden');
  editingDebtId = null;
}

document.getElementById('debt-add-btn').addEventListener('click', () => {
  editingDebtId = null;
  document.getElementById('debt-modal-title').textContent = 'Neue Schuld';
  document.getElementById('debt-paid-row').classList.remove('hidden');
  document.getElementById('debt-name').value = '';
  document.getElementById('debt-original').value = '';
  document.getElementById('debt-paid').value = '';
  document.getElementById('debt-duedate').value = '';
  document.getElementById('debt-description').value = '';
  document.getElementById('debt-reserve-active').checked = false;
  debtPriority = 'need';
  setDebtPriorityButtons(debtPriority);
  document.getElementById('debt-delete').classList.add('hidden');
  if (typeof renderFundingEditor === 'function') {
    renderFundingEditor(document.getElementById('debt-funding-list'), [], null, 'debt-funding');
  }
  document.getElementById('debt-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('debt-name').focus(), 50);
});

function openEditDebtModal(debt) {
  editingDebtId = debt.id;
  document.getElementById('debt-modal-title').textContent = 'Schuld bearbeiten';
  // Der bereits bezahlte Betrag wird hier bewusst nicht angezeigt/editiert —
  // Änderungen laufen ausschließlich über "Bezahlen".
  document.getElementById('debt-paid-row').classList.add('hidden');
  document.getElementById('debt-name').value = debt.name;
  document.getElementById('debt-original').value = debt.originalAmount;
  document.getElementById('debt-duedate').value = debt.dueDate || '';
  document.getElementById('debt-description').value = debt.description || '';
  document.getElementById('debt-reserve-active').checked = !!debt.reserveActive;
  debtPriority = debt.priority || 'need';
  setDebtPriorityButtons(debtPriority);
  document.getElementById('debt-delete').classList.remove('hidden');
  if (typeof renderFundingEditor === 'function') {
    renderFundingEditor(document.getElementById('debt-funding-list'), debt.funding || [], null, 'debt-funding');
  }
  document.getElementById('debt-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('debt-name').focus(), 50);
}

document.getElementById('debt-modal-close').addEventListener('click', closeDebtModal);
document.getElementById('debt-cancel').addEventListener('click',       closeDebtModal);
document.getElementById('debt-delete').addEventListener('click', () => {
  if (!editingDebtId) return;
  const debt = budgetDebts.find(d => d.id === editingDebtId);
  if (!debt) return;
  if (!confirm(`Schuld "${debt.name}" wirklich löschen?`)) return;
  budgetDebts = budgetDebts.filter(d => d.id !== debt.id);
  saveBudgetDebts();
  closeDebtModal();
  if (typeof renderSchulden === 'function') renderSchulden();
  if (typeof renderFinanzanalyse === 'function') renderFinanzanalyse();
});
document.getElementById('debt-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('debt-modal-overlay')) closeDebtModal();
});
document.getElementById('debt-save').addEventListener('click', () => {
  const name = document.getElementById('debt-name').value.trim();
  if (!name) return;
  const originalAmount = parseFloat(document.getElementById('debt-original').value) || 0;
  const dueDateVal = document.getElementById('debt-duedate').value || null;
  const descriptionVal = document.getElementById('debt-description').value.trim() || null;
  const reserveActiveVal = document.getElementById('debt-reserve-active').checked;
  const fundingVal = typeof readFundingEditor === 'function'
    ? readFundingEditor(document.getElementById('debt-funding-list'), 'debt-funding')
    : [];

  if (editingDebtId) {
    const debt = budgetDebts.find(d => d.id === editingDebtId);
    if (debt) {
      debt.name = name;
      debt.originalAmount = originalAmount;
      debt.dueDate = dueDateVal;
      debt.description = descriptionVal;
      debt.priority = debtPriority;
      debt.reserveActive = reserveActiveVal;
      debt.funding = fundingVal;
    }
    editingDebtId = null;
  } else {
    const paidAmount = parseFloat(document.getElementById('debt-paid').value) || 0;
    budgetDebts.push({
      id: crypto.randomUUID(), name, originalAmount, paidAmount,
      dueDate: dueDateVal, description: descriptionVal, priority: debtPriority,
      reserveActive: reserveActiveVal, funding: fundingVal, createdAt: Date.now(),
    });
  }
  saveBudgetDebts();
  closeDebtModal();
  if (typeof renderSchulden === 'function') renderSchulden();
  if (typeof renderFinanzanalyse === 'function') renderFinanzanalyse();
});

let goalTxTarget = null, goalTxMode = 'deposit', goalTxKind = 'goal';
function openGoalTx(goal, mode) {
  goalTxTarget = goal; goalTxMode = mode; goalTxKind = 'goal';
  document.getElementById('goal-tx-title').textContent =
    mode === 'deposit' ? `Einzahlen — ${goal.name}` : `Abheben — ${goal.name}`;
  document.getElementById('goal-tx-amount').value = '';
  document.getElementById('goal-tx-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('goal-tx-amount').focus(), 50);
}
function openDebtTx(debt) {
  goalTxTarget = debt; goalTxMode = 'pay'; goalTxKind = 'debt';
  document.getElementById('goal-tx-title').textContent = `Bezahlen — ${debt.name}`;
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
  if (goalTxKind === 'debt') {
    goalTxTarget.paidAmount = Math.min(goalTxTarget.originalAmount,
      Math.max(0, (goalTxTarget.paidAmount || 0) + amt));
    saveBudgetDebts();
    if (typeof renderSchulden === 'function') renderSchulden();
    if (typeof renderFinanzanalyse === 'function') renderFinanzanalyse();
  } else {
    goalTxTarget.current = Math.max(0,
      goalTxMode === 'deposit' ? goalTxTarget.current + amt : goalTxTarget.current - amt);
    saveBudgetGoals();
    renderBudgetGoals();
    renderFinanzgarten();
    renderSparplaner();
    if (typeof renderSparziele === 'function') renderSparziele();
  }
  document.getElementById('goal-tx-modal-overlay').classList.add('hidden');
  goalTxTarget = null;
});

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

// Wire secondary add-buttons — bind directly, no DOMContentLoaded proxy needed
// (DOMContentLoaded may have already fired by the time budget.js runs in a SPA)
function bindSecondaryButtons() {
  const pairs = [
    ['add-recurring-btn-2',   'add-recurring-btn'],
    ['add-onetime-btn-2',     'add-onetime-btn'],
    ['add-goal-btn-2',        'add-goal-btn'],
    ['sparziel-add-btn-2',    'add-goal-btn'],
  ];
  pairs.forEach(([srcId, targetId]) => {
    const srcEl    = document.getElementById(srcId);
    const targetEl = document.getElementById(targetId);
    if (srcEl && targetEl && !srcEl._secondaryBound) {
      srcEl._secondaryBound = true;
      srcEl.addEventListener('click', () => targetEl.click());
    }
  });
  // Sparprognose legt keine Sparziele mehr selbst an (Sparziele sind jetzt
  // ausschließlich im Tab "Sparziele" verwaltet) — der Button dort wechselt
  // stattdessen den Subtab und öffnet von dort aus das Sparziel-Modal.
  const sparplanGoalBtn = document.getElementById('sparplan-add-goal-btn');
  if (sparplanGoalBtn && !sparplanGoalBtn._secondaryBound) {
    sparplanGoalBtn._secondaryBound = true;
    sparplanGoalBtn.addEventListener('click', () => {
      setBudgetSubtab('sparziele');
      document.getElementById('add-goal-btn')?.click();
    });
  }
  // Re-run month nav binding in case the nav buttons appeared after initial load
  // (bindMonthNav lebt in budget-sparprognose.js, das erst nach budget.js geladen wird —
  // beim allerersten Aufruf hier ist es u.U. noch nicht definiert; die eigene
  // Selbstinvocation von budget-sparprognose.js übernimmt das initiale Binding)
  if (typeof bindMonthNav === 'function') bindMonthNav();
}
bindSecondaryButtons();
