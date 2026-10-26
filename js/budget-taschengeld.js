// =========================
// BUDGET — TASCHENGELD-BERECHNUNG (optional, persönliche Funktion)
// Lädt direkt nach budget.js (braucht round2/isoDateYMD/fmtEuro/DB/
// budgetMonthKey) und nach calendar.js (braucht getHolidaysForYear für
// Feiertage — bewusst KEINE zweite Kalenderlogik).
//
// Architektur: Taschengeld lebt NICHT als Eintrag in budgetRecurring.
// Stattdessen liefert getTaschengeldMonthEntry() bei aktivierter Funktion
// einen virtuellen Einnahme-Eintrag, den budget.js' getMonthRecurringItems()
// optional mit-einbindet (typeof-Check, gleiches Muster wie renderSparziele
// u.a.). Dadurch fließt Taschengeld automatisch korrekt in Hauptkarten,
// Finanzstatus, Liquiditätsvorschau und Kontostand-Buchung — ohne dass
// diese Funktionen etwas von Taschengeld wissen müssen.
//
// Bewusst NICHT eingebunden: Finanzierung (budget-financing.js),
// Sparprognose (budget-sparprognose.js) und Geldfluss-Planer
// (budget-analysis.js) — die lesen budgetRecurring direkt und gehen von
// einem festen Betrag pro Posten aus (gilt schon für alle bestehenden
// Einnahmen, nicht taschengeld-spezifisch). Das dort nachzurüsten wäre ein
// deutlich größerer Eingriff in den laut Doku fehleranfälligen
// Geldfluss-Planer — bewusste Scope-Entscheidung.
// =========================

const TASCHENGELD_ENTRY_ID = 'taschengeld-auto';

const TASCHENGELD_DEFAULTS = {
  enabled: false,
  rates: { weekday: 7, saturday: 10, sunday: 10, holiday: 10 },
  // anchorMonday: ISO-Datum (beliebiger Tag) einer Heimfahrt-Woche — wird
  // beim Rechnen immer auf den Montag dieser Woche normalisiert.
  homeTrip: { enabled: false, weekday: 5, anchorMonday: null },
  absences: [], // [{ id, name, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }]
  // Im Kalender angeklickte Tage, an denen ich da bin: { 'YYYY-MM-DD': true }.
  // Hat ein Monat mindestens einen angeklickten Tag, zählen NUR diese Tage.
  // Monate ohne angeklickte Tage werden mit homeTrip/absences geschätzt.
  presentDays: {},
};

function loadBudgetTaschengeld() {
  const saved = DB.get('budgetTaschengeld', {});
  return {
    enabled: saved.enabled ?? TASCHENGELD_DEFAULTS.enabled,
    rates: Object.assign({}, TASCHENGELD_DEFAULTS.rates, saved.rates || {}),
    homeTrip: Object.assign({}, TASCHENGELD_DEFAULTS.homeTrip, saved.homeTrip || {}),
    absences: Array.isArray(saved.absences) ? saved.absences : [],
    presentDays: (saved.presentDays && typeof saved.presentDays === 'object') ? saved.presentDays : {},
  };
}
let budgetTaschengeld = loadBudgetTaschengeld();
function saveBudgetTaschengeld() { DB.set('budgetTaschengeld', budgetTaschengeld); }

// Fixierte tatsächliche Beträge je Monat (Monatsschlüssel -> Betrag).
// Wird gesetzt, wenn die Taschengeld-Zeile als "erhalten" markiert wird —
// ab dann bleibt dieser Monat unabhängig von späteren Regeländerungen fest
// (siehe freezeTaschengeldMonth/unfreezeTaschengeldMonth).
let budgetTaschengeldActuals = DB.get('budgetTaschengeldActuals', {});
function saveBudgetTaschengeldActuals() { DB.set('budgetTaschengeldActuals', budgetTaschengeldActuals); }

function freezeTaschengeldMonth(mk, amount) {
  budgetTaschengeldActuals[mk] = amount;
  saveBudgetTaschengeldActuals();
}
function unfreezeTaschengeldMonth(mk) {
  delete budgetTaschengeldActuals[mk];
  saveBudgetTaschengeldActuals();
}

// =========================
// BERECHNUNGS-ENGINE
// =========================

function tgMondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = Montag ... 6 = Sonntag
  d.setDate(d.getDate() - dow);
  return d;
}

// Heimfahrt-Wochen: jede 2. Woche ab der Ausgangswoche (anchorMonday).
// Modulo mit +14 abgesichert, damit auch ein Anker in der Zukunft (oder
// eine krumme Kalenderwochen-Differenz) korrekt bleibt.
function tgIsHomeTripWeek(date, tg = budgetTaschengeld) {
  const cfg = tg.homeTrip;
  if (!cfg.enabled || !cfg.anchorMonday) return false;
  const monday = tgMondayOf(date);
  const anchor = tgMondayOf(new Date(cfg.anchorMonday + 'T00:00:00'));
  const diffDays = Math.round((monday - anchor) / 86400000);
  return ((diffDays % 14) + 14) % 14 === 0;
}

function tgFindAbsence(dateStr, tg = budgetTaschengeld) {
  return tg.absences.find(a => a.start && a.end && dateStr >= a.start && dateStr <= a.end) || null;
}

// Hat dieser Monat angeklickte Tage? Dann gilt der Kalender statt der Schätzung.
function tgMonthHasMarks(year, month, tg = budgetTaschengeld) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return Object.keys(tg.presentDays || {}).some(k => k.startsWith(prefix) && tg.presentDays[k]);
}

// =========================
// ZENTRALES TAGESMODELL — einzige Quelle für alle Taschengeld-Berechnungen
// (Übersicht-Einnahme, Aufschlüsselungs-Modal UND alle drei
// Prognose-Szenarien in budget-sparprognose.js). Für jeden Kalendertag
// eines Monats wird einmal bestimmt: Wochentag-Kategorie, Feiertag,
// Abwesenheit, Heimfahrt-Betroffenheit. Alle Aggregationen (Realistisch/
// Garantiert/Optimistisch) bauen NUR auf diesem Array auf — es gibt
// bewusst keine zweite, abweichende Tagesklassifikation.
//
// Zwei Modi je Monat:
//  • Kalender (Monat hat angeklickte Tage): bezahlt wird genau jeder
//    angeklickte Tag — Heimfahrt/Abwesenheit spielen keine Rolle.
//  • Schätzung (nichts angeklickt, z.B. kommende Monate für die Prognose):
//    Heimfahrt-Wochen ohne Sa/So (der Freitag wird immer bezahlt),
//    Abwesenheiten ohne jeden Tag.
// Feiertage zählen wie ihr Wochentag (Mo–Fr-Satz bzw. Sa/So-Satz) —
// es gibt keinen eigenen Feiertagssatz (Klarstellung der Nutzerin, Okt. 2026).
// =========================
function computeTaschengeldDays(year, month, tg = budgetTaschengeld) {
  const rates = tg.rates;
  const daysInMonth = new Date(year, month, 0).getDate();
  const calendarMode = tgMonthHasMarks(year, month, tg);

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dateStr = isoDateYMD(year, month, d);
    const dow = date.getDay(); // 0 = Sonntag ... 6 = Samstag
    const category = dow === 6 ? 'saturday' : dow === 0 ? 'sunday' : 'weekday';
    const marked = !!(tg.presentDays && tg.presentDays[dateStr]);
    const homeTripWeek = !calendarMode && tgIsHomeTripWeek(date, tg);
    days.push({
      date: dateStr, dow, category, rate: rates[category] ?? 0,
      calendarMode, isMarked: marked,
      // Kalender-Modus: nicht angeklickt = nicht da (zählt wie Abwesenheit)
      isAbsence: calendarMode ? !marked : !!tgFindAbsence(dateStr, tg),
      isHomeTripWeek: homeTripWeek,
      // Sa/So einer Heimfahrt-Woche — die eigentlich "verlorenen" Tage.
      isHomeTripAffected: homeTripWeek && (dow === 6 || dow === 0),
    });
  }
  return days;
}

// Aggregiert computeTaschengeldDays() zu Tagesanzahlen je Kategorie plus
// den daraus resultierenden Beträgen — Grundlage für den Monatsbetrag
// (getTaschengeldMonthEntry), die Aufschlüsselungs-Ansicht UND die
// Szenarien "Realistisch"/"Garantiert" in der Prognose (siehe
// tgScenarioAmount — beide sind bei Taschengeld deterministisch und
// daher identisch, anders als bei variablen Budget-Posten mit echter
// Min/Max-Bandbreite).
// Priorität je Tag: Abwesenheit/nicht angeklickt > Heimfahrt (Sa/So) > Sa/So > Mo-Fr.
function computeTaschengeldBreakdown(year, month, tg = budgetTaschengeld) {
  const days = computeTaschengeldDays(year, month, tg);
  const counts = { weekday: 0, saturday: 0, sunday: 0, holiday: 0 };
  let homeTripDeducted = 0, absenceDeducted = 0;

  days.forEach(day => {
    if (day.isAbsence) { absenceDeducted++; return; }
    if (day.isHomeTripAffected) { homeTripDeducted++; return; }
    counts[day.category]++;
  });

  const rates = tg.rates;
  const amounts = {
    weekday:  round2(counts.weekday  * rates.weekday),
    saturday: round2(counts.saturday * rates.saturday),
    sunday:   round2(counts.sunday   * rates.sunday),
    holiday:  0, // kein eigener Feiertagssatz mehr (Feld bleibt nur für Altdaten)
  };
  const total = round2(amounts.weekday + amounts.saturday + amounts.sunday);
  const calendarMode = days.length > 0 && days[0].calendarMode;

  return { counts, rates, amounts, total, homeTripDeducted, absenceDeducted, calendarMode };
}

// Heimfahrt-Wochenenden, die für den Optimistisch-Bonus grundsätzlich in
// Frage kommen: Samstag als Anker, dessen Woche als Heimfahrt-Woche gilt,
// UND weder Samstag noch der zugehörige Sonntag in einer Abwesenheit
// liegen (eine Abwesenheit — z.B. ein Praktikum — ist ein harter,
// äußerer Umstand, den auch das optimistische Szenario nicht
// wegdiskutieren darf). Wochenenden, deren Sonntag in den Folgemonat
// fällt, werden hier bewusst nicht gezählt (Monatsgrenze).
function tgOptimisticCandidates(year, month) {
  const days = computeTaschengeldDays(year, month);
  const daysInMonth = days.length;
  const candidates = [];
  days.forEach(day => {
    if (day.dow !== 6 || !day.isHomeTripWeek || day.isAbsence) return;
    const satDay = parseInt(day.date.slice(8, 10), 10);
    if (satDay >= daysInMonth) return;
    const sunday = days[satDay]; // Index satDay entspricht Tag (satDay+1)
    if (!sunday || sunday.isAbsence) return;
    candidates.push({ saturday: day, sunday });
  });
  return candidates;
}

// Optimistisches Szenario: baut auf der Realistisch-Summe auf und nimmt
// zusätzlich an, dass ich im besten Fall bis zu 2 der tatsächlich als
// Heimfahrt geplanten Wochenenden dieses Monats doch im AWG verbringe
// (volles Wochenende: Samstag + Sonntag). Bewusst kalenderbasiert und
// gedeckelt (tgOptimisticCandidates) statt einer pauschalen 2×20€-Annahme
// — ein Monat mit weniger als 2 verfügbaren Heimfahrt-Wochenenden (oder
// keinem) bekommt entsprechend weniger oder gar keinen Bonus.
function computeTaschengeldOptimistic(year, month) {
  const base = computeTaschengeldBreakdown(year, month);
  const candidates = tgOptimisticCandidates(year, month);
  const bonusWeekends = Math.min(2, candidates.length);
  const rates = budgetTaschengeld.rates;
  const bonusAmount = round2(bonusWeekends * (rates.saturday + rates.sunday));
  const total = round2(base.total + bonusAmount);
  return { base, bonusWeekends, availableWeekends: candidates.length, bonusAmount, total };
}

// Zentraler Einstiegspunkt für die Prognose (budget-sparprognose.js).
// scenario: 'garant' | 'real' | 'opt'. 0, wenn die Funktion deaktiviert ist.
function tgScenarioAmount(scenario, year, month) {
  if (!budgetTaschengeld.enabled) return 0;
  if (scenario === 'opt') return computeTaschengeldOptimistic(year, month).total;
  return computeTaschengeldBreakdown(year, month).total; // 'garant' === 'real' (deterministisch)
}

function tgScenarioDayCount(bd) {
  return bd.counts.weekday + bd.counts.saturday + bd.counts.sunday + bd.counts.holiday;
}

// Kurze, nachvollziehbare Zeile je Szenario-Karte in der Prognose
// (z.B. "🪙 18 sichere Taschengeldtage → 126 €"). null, wenn die
// Funktion deaktiviert ist — dann bleibt die Prognose unverändert.
function tgScenarioLine(scenario, year, month) {
  if (!budgetTaschengeld.enabled) return null;
  if (scenario === 'opt') {
    const o = computeTaschengeldOptimistic(year, month);
    const days = tgScenarioDayCount(o.base);
    let label = `${days} reguläre Tag${days === 1 ? '' : 'e'}`;
    if (o.bonusWeekends > 0) label += ` + ${o.bonusWeekends} AWG-Wochenende${o.bonusWeekends === 1 ? '' : 'n'} zusätzlich`;
    return `🪙 ${label} → ${fmtEuro(o.total)}`;
  }
  const bd = computeTaschengeldBreakdown(year, month);
  const days = tgScenarioDayCount(bd);
  const label = scenario === 'garant' ? 'sichere Taschengeldtag' : 'Taschengeldtag';
  return `🪙 ${days} ${label}${days === 1 ? '' : 'e'} → ${fmtEuro(bd.total)}`;
}

// Virtueller Einnahme-Eintrag für getMonthRecurringItems() (budget.js).
// null, wenn die Funktion deaktiviert ist — dann bleibt Budget unverändert.
function getTaschengeldMonthEntry(year, month) {
  if (!budgetTaschengeld.enabled) return null;
  const mk = `${year}-${String(month).padStart(2, '0')}`;
  const frozen = budgetTaschengeldActuals[mk];
  const amount = (typeof frozen === 'number') ? frozen : computeTaschengeldBreakdown(year, month).total;
  const now = new Date();
  const day = (year === now.getFullYear() && month === now.getMonth() + 1) ? now.getDate() : 1;
  return {
    id: TASCHENGELD_ENTRY_ID, name: 'Taschengeld', type: 'income',
    amount, day, priority: 'none', isAverage: false, funding: null,
    taschengeld: true,
  };
}

// =========================
// AUFSCHLÜSSELUNGS-MODAL (read-only)
// =========================

function addTaschengeldBreakdownButton(rowEl, year, month) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tg-breakdown-btn';
  btn.title = 'Berechnung anzeigen';
  btn.textContent = 'ⓘ';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    openTaschengeldBreakdownModal(year, month);
  });
  const amountEl = rowEl.querySelector('.b-main-row-amount');
  if (amountEl) rowEl.insertBefore(btn, amountEl);
  else rowEl.appendChild(btn);
}

const taschengeldBreakdownModal = wireModal('taschengeld-breakdown-modal-overlay', {
  closeIds: ['taschengeld-breakdown-modal-close'],
});

function openTaschengeldBreakdownModal(year, month) {
  const mk = `${year}-${String(month).padStart(2, '0')}`;
  const frozen = budgetTaschengeldActuals[mk];
  const isFrozen = typeof frozen === 'number';
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  document.getElementById('tg-breakdown-title').textContent = `🪙 Taschengeld — ${monthLabel}`;
  const bodyEl    = document.getElementById('tg-breakdown-body');
  const actionsEl = document.getElementById('tg-breakdown-actions');
  actionsEl.innerHTML = '';

  if (isFrozen) {
    // Fixierter Monat: keine Tages-Aufschlüsselung zeigen, die evtl. nicht
    // mehr zu den (inzwischen geänderten) Regeln passt — nur der Betrag,
    // der damals tatsächlich festgehalten wurde.
    bodyEl.innerHTML = `
      <p class="modal-hint">🔒 Als tatsächlich erhalten markiert. Bleibt unabhängig von späteren Regeländerungen fest.</p>
      <div class="tg-bd-total-row"><span>Erhalten</span><span class="tg-bd-total-amount">${fmtEuro(frozen)}</span></div>`;
    const btn = document.createElement('button');
    btn.className = 'btn-ghost';
    btn.textContent = '↩ Wieder automatisch berechnen';
    btn.addEventListener('click', () => {
      unfreezeTaschengeldMonth(mk);
      taschengeldBreakdownModal.close();
      if (typeof renderBudget === 'function') renderBudget();
    });
    actionsEl.appendChild(btn);
    taschengeldBreakdownModal.open();
    return;
  }

  const bd = computeTaschengeldBreakdown(year, month);
  const rowDefs = [
    { label: 'Mo–Fr',     count: bd.counts.weekday,  rate: bd.rates.weekday,  amount: bd.amounts.weekday },
    { label: 'Samstag',   count: bd.counts.saturday, rate: bd.rates.saturday, amount: bd.amounts.saturday },
    { label: 'Sonntag',   count: bd.counts.sunday,   rate: bd.rates.sunday,   amount: bd.amounts.sunday },
  ].filter(r => r.count > 0);

  const rowsHtml = rowDefs.map(r => `
    <div class="tg-bd-row">
      <span class="tg-bd-row-label">${r.label}</span>
      <span class="tg-bd-row-calc">${r.count} Tag${r.count === 1 ? '' : 'e'} × ${fmtEuro(r.rate)}</span>
      <span class="tg-bd-row-amount">${fmtEuro(r.amount)}</span>
    </div>`).join('');

  const deductLines = [];
  if (bd.calendarMode) {
    deductLines.push(`<div class="tg-bd-deduct">📅 Aus deinem Kalender · ${bd.absenceDeducted} Tag${bd.absenceDeducted === 1 ? '' : 'e'} nicht da</div>`);
  } else {
    deductLines.push(`<div class="tg-bd-deduct">≈ Geschätzt — für diesen Monat sind noch keine Tage angeklickt</div>`);
    if (bd.homeTripDeducted > 0) deductLines.push(`<div class="tg-bd-deduct">Heimfahrt · ${bd.homeTripDeducted} Tag${bd.homeTripDeducted === 1 ? '' : 'e'} abgezogen</div>`);
    if (bd.absenceDeducted  > 0) deductLines.push(`<div class="tg-bd-deduct">Abwesenheit · ${bd.absenceDeducted} Tag${bd.absenceDeducted === 1 ? '' : 'e'} abgezogen</div>`);
  }

  bodyEl.innerHTML = `
    ${rowsHtml || '<p class="modal-hint">Keine Taschengeld-Tage in diesem Monat.</p>'}
    ${deductLines.join('')}
    <div class="tg-bd-divider"></div>
    <div class="tg-bd-total-row"><span>${bd.calendarMode ? 'Berechnet' : 'Geschätzt'}</span><span class="tg-bd-total-amount">${fmtEuro(bd.total)}</span></div>`;

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-ghost';
  editBtn.textContent = bd.calendarMode ? '📅 Tage ändern' : '📅 Tage anklicken';
  editBtn.addEventListener('click', () => {
    taschengeldBreakdownModal.close();
    openTaschengeldSettingsModal(year, month);
  });
  actionsEl.appendChild(editBtn);

  taschengeldBreakdownModal.open();
}

// =========================
// EINSTELLUNGEN-MODAL
// Erreichbar über das Kopfzeilen-Menü (budget.js), gleiche Stelle wie
// Finanzbaum/Archiv. Arbeitet auf einer Kopie (tgDraft) — erst beim
// Speichern wird budgetTaschengeld tatsächlich übernommen/persistiert.
// =========================

let tgDraft = null;
let tgCalMonth = null; // { year, month } — im Einstellungsfenster angezeigter Monat

function updateTgSettingsVisibility() {
  const enabled = document.getElementById('tg-enabled').checked;
  document.getElementById('tg-settings-body').classList.toggle('hidden', !enabled);
  const htEnabled = document.getElementById('tg-hometrip-enabled').checked;
  document.getElementById('tg-hometrip-fields').classList.toggle('hidden', !htEnabled);
}

function renderTgAbsenceList() {
  const list = document.getElementById('tg-absence-list');
  list.innerHTML = '';
  if (!tgDraft.absences.length) {
    list.innerHTML = '<p class="modal-hint" style="margin:0;">Noch keine Abwesenheiten hinterlegt.</p>';
    return;
  }
  tgDraft.absences.forEach((a, idx) => {
    const row = document.createElement('div');
    row.className = 'tg-absence-row';
    row.innerHTML = `
      <input type="text" class="modal-input tg-absence-name" placeholder="z.B. Irlandpraktikum" value="${(a.name || '').replace(/"/g, '&quot;')}"/>
      <input type="date" class="modal-input tg-absence-start" value="${a.start || ''}"/>
      <span class="tg-absence-sep">–</span>
      <input type="date" class="modal-input tg-absence-end" value="${a.end || ''}"/>
      <button type="button" class="task-delete tg-absence-del" title="Entfernen">✕</button>`;
    row.querySelector('.tg-absence-name').addEventListener('input',  e => { a.name  = e.target.value; });
    row.querySelector('.tg-absence-start').addEventListener('input', e => { a.start = e.target.value; });
    row.querySelector('.tg-absence-end').addEventListener('input',   e => { a.end   = e.target.value; });
    row.querySelector('.tg-absence-del').addEventListener('click', () => {
      tgDraft.absences.splice(idx, 1);
      renderTgAbsenceList();
    });
    list.appendChild(row);
  });
}

// Sätze/Heimfahrt aus den Feldern in den Entwurf übernehmen — damit die
// Live-Summe unter dem Kalender schon vor dem Speichern stimmt.
function readTgFieldsIntoDraft() {
  tgDraft.rates.weekday  = parseFloat(document.getElementById('tg-rate-weekday').value)  || 0;
  tgDraft.rates.saturday = parseFloat(document.getElementById('tg-rate-saturday').value) || 0;
  tgDraft.rates.sunday   = parseFloat(document.getElementById('tg-rate-sunday').value)   || 0;
  tgDraft.homeTrip.enabled      = document.getElementById('tg-hometrip-enabled').checked;
  tgDraft.homeTrip.anchorMonday = document.getElementById('tg-hometrip-anchor').value || null;
}

// Klick-Kalender: angeklickte Tage = da und bezahlt. Ohne angeklickte Tage
// zeigt er die Schätzung gestrichelt an (Knopf „Schätzung übernehmen“
// macht daraus angeklickte Tage, die man dann nur noch korrigiert).
function renderTgCalendar() {
  readTgFieldsIntoDraft();
  const { year, month } = tgCalMonth;
  const grid = document.getElementById('tg-cal-grid');
  grid.innerHTML = '';
  document.getElementById('tg-cal-title').textContent =
    new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach(n => {
    const h = document.createElement('div'); h.className = 'tg-cal-dow'; h.textContent = n; grid.appendChild(h);
  });
  const days = computeTaschengeldDays(year, month, tgDraft);
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) grid.appendChild(document.createElement('div'));

  const todayStr = isoDateYMD(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
  days.forEach(day => {
    const b = document.createElement('button');
    b.type = 'button';
    const estimatedPaid = !day.calendarMode && !day.isAbsence && !day.isHomeTripAffected;
    b.className = 'tg-cal-day'
      + (day.isMarked ? ' is-present' : '')
      + (estimatedPaid ? ' is-estimated' : '')
      + (day.dow === 0 || day.dow === 6 ? ' is-weekend' : '')
      + (day.date === todayStr ? ' is-today' : '');
    b.textContent = parseInt(day.date.slice(8), 10);
    b.title = `${day.date.split('-').reverse().join('.')} · ${fmtEuro(day.rate)}`;
    b.setAttribute('aria-pressed', day.isMarked ? 'true' : 'false');
    b.addEventListener('click', () => {
      if (tgDraft.presentDays[day.date]) delete tgDraft.presentDays[day.date];
      else tgDraft.presentDays[day.date] = true;
      renderTgCalendar();
    });
    grid.appendChild(b);
  });

  const bd = computeTaschengeldBreakdown(year, month, tgDraft);
  const n = bd.counts.weekday + bd.counts.saturday + bd.counts.sunday;
  document.getElementById('tg-cal-sum').innerHTML = bd.calendarMode
    ? `<b>${n}</b> Tag${n === 1 ? '' : 'e'} da · <b>${fmtEuro(bd.total)}</b>`
    : `Noch nichts angeklickt · geschätzt <b>${fmtEuro(bd.total)}</b>`;
  document.getElementById('tg-cal-adopt').classList.toggle('hidden', bd.calendarMode);
  document.getElementById('tg-cal-clear').classList.toggle('hidden', !bd.calendarMode);
}

function openTaschengeldSettingsModal(year, month) {
  tgDraft = JSON.parse(JSON.stringify(budgetTaschengeld));
  if (!tgDraft.presentDays) tgDraft.presentDays = {};
  const now = new Date();
  tgCalMonth = (year && month) ? { year, month } : { year: now.getFullYear(), month: now.getMonth() + 1 };

  document.getElementById('tg-enabled').checked = tgDraft.enabled;
  document.getElementById('tg-rate-weekday').value  = tgDraft.rates.weekday;
  document.getElementById('tg-rate-saturday').value = tgDraft.rates.saturday;
  document.getElementById('tg-rate-sunday').value   = tgDraft.rates.sunday;
  document.getElementById('tg-hometrip-enabled').checked = tgDraft.homeTrip.enabled;
  document.getElementById('tg-hometrip-anchor').value    = tgDraft.homeTrip.anchorMonday || '';

  renderTgAbsenceList();
  updateTgSettingsVisibility();
  renderTgCalendar();
  taschengeldSettingsModal.open();
}

function shiftTgCalMonth(delta) {
  const d = new Date(tgCalMonth.year, tgCalMonth.month - 1 + delta, 1);
  tgCalMonth = { year: d.getFullYear(), month: d.getMonth() + 1 };
  renderTgCalendar();
}

const taschengeldSettingsModal = wireModal('taschengeld-settings-modal-overlay', {
  closeIds: ['taschengeld-settings-modal-close', 'taschengeld-settings-cancel'],
});

document.getElementById('tg-enabled').addEventListener('change', updateTgSettingsVisibility);
document.getElementById('tg-hometrip-enabled').addEventListener('change', () => { updateTgSettingsVisibility(); renderTgCalendar(); });
['tg-rate-weekday', 'tg-rate-saturday', 'tg-rate-sunday', 'tg-hometrip-anchor'].forEach(id =>
  document.getElementById(id).addEventListener('input', () => { if (tgDraft) renderTgCalendar(); }));
document.getElementById('tg-cal-prev').addEventListener('click', () => shiftTgCalMonth(-1));
document.getElementById('tg-cal-next').addEventListener('click', () => shiftTgCalMonth(1));
// Schätzung des Monats als angeklickte Tage übernehmen (dann nur noch korrigieren)
document.getElementById('tg-cal-adopt').addEventListener('click', () => {
  computeTaschengeldDays(tgCalMonth.year, tgCalMonth.month, tgDraft).forEach(day => {
    if (!day.isAbsence && !day.isHomeTripAffected) tgDraft.presentDays[day.date] = true;
  });
  renderTgCalendar();
});
// Alle Markierungen des Monats entfernen → Monat wird wieder geschätzt
document.getElementById('tg-cal-clear').addEventListener('click', () => {
  const prefix = `${tgCalMonth.year}-${String(tgCalMonth.month).padStart(2, '0')}-`;
  Object.keys(tgDraft.presentDays).forEach(k => { if (k.startsWith(prefix)) delete tgDraft.presentDays[k]; });
  renderTgCalendar();
});
document.getElementById('tg-absence-add').addEventListener('click', () => {
  tgDraft.absences.push({ id: 'abs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: '', start: '', end: '' });
  renderTgAbsenceList();
});

document.getElementById('taschengeld-settings-save').addEventListener('click', () => {
  tgDraft.enabled = document.getElementById('tg-enabled').checked;
  readTgFieldsIntoDraft();
  // Unvollständige Abwesenheits-Zeilen (kein Start/Ende) beim Speichern verwerfen.
  tgDraft.absences = tgDraft.absences.filter(a => a.start && a.end);

  budgetTaschengeld = tgDraft;
  saveBudgetTaschengeld();
  taschengeldSettingsModal.close();
  if (typeof renderBudget === 'function') renderBudget();
});
