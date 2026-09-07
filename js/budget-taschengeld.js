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
};

function loadBudgetTaschengeld() {
  const saved = DB.get('budgetTaschengeld', {});
  return {
    enabled: saved.enabled ?? TASCHENGELD_DEFAULTS.enabled,
    rates: Object.assign({}, TASCHENGELD_DEFAULTS.rates, saved.rates || {}),
    homeTrip: Object.assign({}, TASCHENGELD_DEFAULTS.homeTrip, saved.homeTrip || {}),
    absences: Array.isArray(saved.absences) ? saved.absences : [],
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
function tgIsHomeTripWeek(date) {
  const cfg = budgetTaschengeld.homeTrip;
  if (!cfg.enabled || !cfg.anchorMonday) return false;
  const monday = tgMondayOf(date);
  const anchor = tgMondayOf(new Date(cfg.anchorMonday + 'T00:00:00'));
  const diffDays = Math.round((monday - anchor) / 86400000);
  return ((diffDays % 14) + 14) % 14 === 0;
}

function tgFindAbsence(dateStr) {
  return budgetTaschengeld.absences.find(a => a.start && a.end && dateStr >= a.start && dateStr <= a.end) || null;
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
// Heimfahrt-Regel: ab Freitag der betreffenden Woche gibt es kein
// Taschengeld mehr — Freitag, Samstag UND Sonntag zählen als "zu Hause",
// nicht nur der Sonntag (Korrektur ggü. einer früheren, engeren Lesart).
// =========================
function computeTaschengeldDays(year, month) {
  const rates = budgetTaschengeld.rates;
  const daysInMonth = new Date(year, month, 0).getDate();

  const bl = (typeof calendarSettings !== 'undefined' && calendarSettings.bundesland) ? calendarSettings.bundesland : null;
  const holidays = (typeof getHolidaysForYear === 'function') ? getHolidaysForYear(year, bl) : [];
  const holidaySet = new Set(holidays.map(h => isoDateYMD(h.date.getFullYear(), h.date.getMonth() + 1, h.date.getDate())));

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dateStr = isoDateYMD(year, month, d);
    const dow = date.getDay(); // 0 = Sonntag ... 6 = Samstag
    const category = holidaySet.has(dateStr) ? 'holiday' : (dow === 6 ? 'saturday' : dow === 0 ? 'sunday' : 'weekday');
    const homeTripWeek = tgIsHomeTripWeek(date);
    days.push({
      date: dateStr, dow, category, rate: rates[category] ?? 0,
      isAbsence: !!tgFindAbsence(dateStr),
      isHomeTripWeek: homeTripWeek,
      // Fr/Sa/So einer Heimfahrt-Woche — die eigentlich "verlorenen" Tage.
      isHomeTripAffected: homeTripWeek && (dow === 5 || dow === 6 || dow === 0),
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
// Priorität je Tag: Abwesenheit > Heimfahrt (Fr/Sa/So) > Feiertag > Sa/So > Mo-Fr.
function computeTaschengeldBreakdown(year, month) {
  const days = computeTaschengeldDays(year, month);
  const counts = { weekday: 0, saturday: 0, sunday: 0, holiday: 0 };
  let homeTripDeducted = 0, absenceDeducted = 0;

  days.forEach(day => {
    if (day.isAbsence) { absenceDeducted++; return; }
    if (day.isHomeTripAffected) { homeTripDeducted++; return; }
    counts[day.category]++;
  });

  const rates = budgetTaschengeld.rates;
  const amounts = {
    weekday:  round2(counts.weekday  * rates.weekday),
    saturday: round2(counts.saturday * rates.saturday),
    sunday:   round2(counts.sunday   * rates.sunday),
    holiday:  round2(counts.holiday  * rates.holiday),
  };
  const total = round2(amounts.weekday + amounts.saturday + amounts.sunday + amounts.holiday);

  return { counts, rates, amounts, total, homeTripDeducted, absenceDeducted };
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
    { label: 'Feiertage', count: bd.counts.holiday,  rate: bd.rates.holiday,  amount: bd.amounts.holiday },
  ].filter(r => r.count > 0);

  const rowsHtml = rowDefs.map(r => `
    <div class="tg-bd-row">
      <span class="tg-bd-row-label">${r.label}</span>
      <span class="tg-bd-row-calc">${r.count} Tag${r.count === 1 ? '' : 'e'} × ${fmtEuro(r.rate)}</span>
      <span class="tg-bd-row-amount">${fmtEuro(r.amount)}</span>
    </div>`).join('');

  const deductLines = [];
  if (bd.homeTripDeducted > 0) deductLines.push(`<div class="tg-bd-deduct">Heimfahrt · ${bd.homeTripDeducted} Tag${bd.homeTripDeducted === 1 ? '' : 'e'} abgezogen</div>`);
  if (bd.absenceDeducted  > 0) deductLines.push(`<div class="tg-bd-deduct">Abwesenheit · ${bd.absenceDeducted} Tag${bd.absenceDeducted === 1 ? '' : 'e'} abgezogen</div>`);

  bodyEl.innerHTML = `
    ${rowsHtml || '<p class="modal-hint">Keine Taschengeld-Tage in diesem Monat.</p>'}
    ${deductLines.join('')}
    <div class="tg-bd-divider"></div>
    <div class="tg-bd-total-row"><span>Berechnet</span><span class="tg-bd-total-amount">${fmtEuro(bd.total)}</span></div>`;

  taschengeldBreakdownModal.open();
}

// =========================
// EINSTELLUNGEN-MODAL
// Erreichbar über das Kopfzeilen-Menü (budget.js), gleiche Stelle wie
// Finanzbaum/Archiv. Arbeitet auf einer Kopie (tgDraft) — erst beim
// Speichern wird budgetTaschengeld tatsächlich übernommen/persistiert.
// =========================

let tgDraft = null;

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

function openTaschengeldSettingsModal() {
  tgDraft = JSON.parse(JSON.stringify(budgetTaschengeld));

  document.getElementById('tg-enabled').checked = tgDraft.enabled;
  document.getElementById('tg-rate-weekday').value  = tgDraft.rates.weekday;
  document.getElementById('tg-rate-saturday').value = tgDraft.rates.saturday;
  document.getElementById('tg-rate-sunday').value   = tgDraft.rates.sunday;
  document.getElementById('tg-rate-holiday').value  = tgDraft.rates.holiday;
  document.getElementById('tg-hometrip-enabled').checked = tgDraft.homeTrip.enabled;
  document.getElementById('tg-hometrip-anchor').value    = tgDraft.homeTrip.anchorMonday || '';

  const bl = (typeof calendarSettings !== 'undefined' && calendarSettings.bundesland) ? calendarSettings.bundesland : null;
  document.getElementById('tg-bundesland-hint').textContent = bl
    ? `Feiertage werden für das in den Kalender-Einstellungen gewählte Bundesland (${bl}) berechnet.`
    : 'Kein Bundesland in den Kalender-Einstellungen gesetzt — es werden nur bundesweite Feiertage berücksichtigt.';

  renderTgAbsenceList();
  updateTgSettingsVisibility();
  taschengeldSettingsModal.open();
}

const taschengeldSettingsModal = wireModal('taschengeld-settings-modal-overlay', {
  closeIds: ['taschengeld-settings-modal-close', 'taschengeld-settings-cancel'],
});

document.getElementById('tg-enabled').addEventListener('change', updateTgSettingsVisibility);
document.getElementById('tg-hometrip-enabled').addEventListener('change', updateTgSettingsVisibility);
document.getElementById('tg-absence-add').addEventListener('click', () => {
  tgDraft.absences.push({ id: 'abs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: '', start: '', end: '' });
  renderTgAbsenceList();
});

document.getElementById('taschengeld-settings-save').addEventListener('click', () => {
  tgDraft.enabled = document.getElementById('tg-enabled').checked;
  tgDraft.rates.weekday  = parseFloat(document.getElementById('tg-rate-weekday').value)  || 0;
  tgDraft.rates.saturday = parseFloat(document.getElementById('tg-rate-saturday').value) || 0;
  tgDraft.rates.sunday   = parseFloat(document.getElementById('tg-rate-sunday').value)   || 0;
  tgDraft.rates.holiday  = parseFloat(document.getElementById('tg-rate-holiday').value)  || 0;
  tgDraft.homeTrip.enabled      = document.getElementById('tg-hometrip-enabled').checked;
  tgDraft.homeTrip.anchorMonday = document.getElementById('tg-hometrip-anchor').value || null;
  // Unvollständige Abwesenheits-Zeilen (kein Start/Ende) beim Speichern verwerfen.
  tgDraft.absences = tgDraft.absences.filter(a => a.start && a.end);

  budgetTaschengeld = tgDraft;
  saveBudgetTaschengeld();
  taschengeldSettingsModal.close();
  if (typeof renderBudget === 'function') renderBudget();
});
