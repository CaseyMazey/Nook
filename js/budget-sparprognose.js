// =========================
// BUDGET — SPARPROGNOSE
// Teil 2/3 des Budget-Moduls. Szenarien/Zeitstrahl/Was-wäre-wenn,
// abgeleitet aus budgetRecurring/budgetGoals (siehe budget.js).
// Muss NACH budget.js geladen werden.
// =========================

let sparplanerScenario   = DB.get('sparplanerScenario', 'real');         // 'garant' | 'real' | 'opt'
let sparplanerSimRate    = null;                                         // Was-wäre-wenn-Override, nur zur Laufzeit (nicht persistiert)
function saveSparplanerScenario(){ DB.set('sparplanerScenario', sparplanerScenario); }

// =========================
// SPARPLANER — BERECHNUNGEN
// Arbeitet ausschließlich mit budgetRecurring / budgetGoals.
// Keine Werte sind hardcodiert — alles wird aus den echten
// Budget-Daten abgeleitet und aktualisiert sich automatisch,
// sobald sich diese Daten ändern (renderSparplaner() wird nach
// jeder Änderung erneut aufgerufen, wie überall sonst in Nook).
// =========================

// round2() lebt jetzt in budget.js (lädt zuerst) — siehe dortiger
// Kommentar für den genauen Grund (Ladereihenfolge-Bug).

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
  // "monthly-ish" = alles außer jährlich (täglich/wöchentlich/2-wöchentlich/
  // monatlich) — wird für die Sparrate einheitlich auf den Monatsbetrag
  // umgerechnet (recurringMonthlyEquivalent(), budget.js). Für reine
  // Monatsposten ist der Faktor 1, verhält sich also exakt wie bisher.
  const monthlyish = active.filter(r => r.freq !== 'yearly');
  const yearly     = active.filter(r => r.freq === 'yearly');
  return {
    fixedIncome:  monthlyish.filter(r => r.type === 'income'  && r.certainty !== 'variable'),
    fixedExpense: monthlyish.filter(r => r.type === 'expense' && r.certainty !== 'variable'),
    varIncome:    monthlyish.filter(r => r.type === 'income'  && r.certainty === 'variable'),
    varExpense:   monthlyish.filter(r => r.type === 'expense' && r.certainty === 'variable'),
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
// Für Sparpläne reservierte Beträge (Finanzierungsquellen mit "reservieren")
// zählen nicht mehr als freies Sparpotenzial. sparplanTotalReserved() lebt
// in budget-sparplaene.js (lädt NACH dieser Datei) — daher defensiv per
// typeof geprüft; zur Laufzeit (nach vollständigem Laden) ist sie vorhanden.
function sparplanerReservedTotal() {
  return typeof sparplanTotalReserved === 'function' ? sparplanTotalReserved() : 0;
}

function sparplanerScenarioRate(scenario) {
  const b = sparplanerBuckets();
  const sum = arr => arr.reduce((s, r) => s + recurringMonthlyEquivalent(r), 0);
  const fixedNet = round2(sum(b.fixedIncome) - sum(b.fixedExpense));
  const reserved = sparplanerReservedTotal();

  if (scenario === 'garant') return round2(fixedNet - reserved);

  if (scenario === 'real') {
    const varIncomeAvg  = round2(b.varIncome.reduce((s, r) => s + sparplanerRange(r).avg, 0));
    const varExpenseAvg = round2(b.varExpense.reduce((s, r) => s + sparplanerRange(r).avg, 0));
    return round2(fixedNet + varIncomeAvg - varExpenseAvg - reserved);
  }

  // Optimistisch: maximale variable Einnahmen, minimale variable Ausgaben
  const varIncomeMax = round2(b.varIncome.reduce((s, r) => s + sparplanerRange(r).max, 0));
  const varExpenseMin = round2(b.varExpense.reduce((s, r) => s + sparplanerRange(r).min, 0));
  return round2(fixedNet + varIncomeMax - varExpenseMin - reserved);
}

// Liefert die einzelnen Bestandteile einer Szenario-Berechnung —
// für die sichtbare "Rechenweg"-Anzeige, damit jeder Wert
// nachvollziehbar bleibt.
function sparplanerScenarioBreakdown(scenario) {
  const b = sparplanerBuckets();
  const sum = arr => arr.reduce((s, r) => s + recurringMonthlyEquivalent(r), 0);
  const fixedNet = round2(sum(b.fixedIncome) - sum(b.fixedExpense));
  const reserved = sparplanerReservedTotal();
  if (scenario === 'garant') return { fixedNet, varNet: 0, reserved, total: round2(fixedNet - reserved) };

  const key = scenario === 'real' ? 'avg' : 'max';
  const expKey = scenario === 'real' ? 'avg' : 'min';
  const varIncome = round2(b.varIncome.reduce((s, r) => s + sparplanerRange(r)[key], 0));
  const varExpense = round2(b.varExpense.reduce((s, r) => s + sparplanerRange(r)[expKey], 0));
  const varNet = round2(varIncome - varExpense);
  return { fixedNet, varNet, reserved, total: round2(fixedNet + varNet - reserved) };
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
// Prioritäts-Reihenfolge wie bei Ausgaben: Muss vor Brauche vor Möchte.
// Innerhalb derselben Priorität bleibt die bestehende manuelle ▲▼-
// Reihenfolge (Array-Index) als Tie-Breaker erhalten — die Sortierung
// per Priorität ergänzt die manuelle Sortierung also, statt sie zu
// ersetzen.
const GOAL_PRIO_ORDER = { must: 0, need: 1, want: 2 };
function sparplanerAllocationOrder() {
  return budgetGoals.map((_, i) => i).sort((a, b) => {
    const pa = GOAL_PRIO_ORDER[budgetGoals[a].priority] ?? 1;
    const pb = GOAL_PRIO_ORDER[budgetGoals[b].priority] ?? 1;
    return pa !== pb ? pa - pb : a - b;
  });
}

function sparplanerETAs(monthlyRate) {
  const order = sparplanerAllocationOrder();
  const n = order.length;
  const remaining = order.map(idx => round2(Math.max(0, budgetGoals[idx].target - budgetGoals[idx].current)));
  const results = new Array(n).fill(null);
  const now = new Date(); now.setDate(1); now.setHours(0, 0, 0, 0);

  // Bereits erreichte Ziele sofort markieren (kein Sparen nötig)
  remaining.forEach((r, i) => { if (r <= 0.005) results[i] = { months: 0, date: new Date(now) }; });

  const rate = round2(monthlyRate || 0);

  function toGoalIndexArray() {
    // Ergebnisse (in Zuteilungs-Reihenfolge) zurück in die ursprüngliche
    // budgetGoals-Reihenfolge einsortieren — alle bestehenden Aufrufer
    // (renderSparplanGoals, Zeitstrahl, Simulator, ...) greifen weiterhin
    // per goals-Index zu und müssen von der internen Priorisierung nichts wissen.
    const byGoalIndex = new Array(n);
    order.forEach((goalIdx, i) => {
      byGoalIndex[goalIdx] = results[i]
        ? { goal: budgetGoals[goalIdx], reached: results[i].months === 0, months: results[i].months, date: results[i].date }
        : { goal: budgetGoals[goalIdx], reached: false, months: Infinity, date: null };
    });
    return byGoalIndex;
  }

  if (rate <= 0) return toGoalIndexArray();

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

  return toGoalIndexArray(); // Sparrate reicht ggf. nicht innerhalb 100 Jahren -> reached:false
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

// fmtEuro() lebt jetzt in budget.js (lädt zuerst) — siehe dortiger
// Kommentar für den genauen Grund (Ladereihenfolge-Bug).

function renderSparplanScenarios(rates) {
  const el = document.getElementById('sparplan-scenarios');
  if (!el) return;
  el.innerHTML = `
    <div class="sp-scenarios-grid">
      ${['garant','real','opt'].map(key => {
        const m = SCENARIO_META[key];
        const bd = sparplanerScenarioBreakdown(key);
        let rechenweg = key === 'garant'
          ? `${fmtEuro(bd.fixedNet)} fest`
          : `${fmtEuro(bd.fixedNet)} fest ${bd.varNet >= 0 ? '+' : '−'} ${fmtEuro(Math.abs(bd.varNet))} ${key === 'real' ? 'Ø variabel' : 'Bestfall variabel'}`;
        if (bd.reserved > 0) rechenweg += ` − ${fmtEuro(bd.reserved)} reserviert`;
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
  const sum = arr => arr.reduce((s, r) => s + recurringMonthlyEquivalent(r), 0);

  const intervalSuffix = { daily: '/Tag', weekly: '/Woche', biweekly: '/2 Wochen', yearly: '/Jahr' };
  function rowHtml(r) {
    const range = r.certainty === 'variable' ? sparplanerRange(r) : null;
    const suffix = intervalSuffix[r.freq] || '';
    const right = range
      ? `<span class="sp-row-range">${range.min.toLocaleString('de-DE',{minimumFractionDigits:0,maximumFractionDigits:2})}–${range.max.toLocaleString('de-DE',{minimumFractionDigits:0,maximumFractionDigits:2})} €</span><span class="sp-row-amt ${r.type}">Ø ${fmtEuro(range.avg)}</span>`
      : `<span></span><span class="sp-row-amt ${r.type}">${r.type === 'income' ? '+' : '−'}${fmtEuro(Math.abs(r.amount))}${suffix}</span>`;
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
  // Sonderfälle sind jährliche Beträge — hier bewusst der volle
  // Jahresbetrag (r.amount direkt), NICHT der Monats-Äquivalent-Betrag,
  // da "Saldo / Jahr" genau das ausweisen soll.
  const sonderNet  = b.sonderIncome.reduce((s, r) => s + r.amount, 0) - b.sonderExpense.reduce((s, r) => s + r.amount, 0);

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

    // Falls dieses Sparziel einen Sparplan besitzt: zusätzlich zeigen, welche
    // Rate im Intervall des Plans nötig ist, um dessen ETA sicher zu halten.
    // sparplanForGoal()/sparplanRequiredRateLabel() leben in
    // budget-sparplaene.js — defensiv per typeof geprüft.
    let linkedPlanHint = '';
    if (typeof sparplanForGoal === 'function') {
      const linkedPlan = sparplanForGoal(g.id);
      if (linkedPlan && typeof sparplanRequiredRateLabel === 'function') {
        const label = sparplanRequiredRateLabel(linkedPlan);
        if (label) linkedPlanHint = `<div class="sp-source-note" style="margin:2px 0 0;">🔗 Um „${linkedPlan.name}" wie geplant zu erreichen: ${label}</div>`;
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
          <div class="sp-goal-name-top">${emoji} ${g.name} ${priorityBadge(g.priority || 'need')} <span class="sp-goal-target">${fmtEuro(g.target)}</span></div>
          <div class="sp-goal-bar"><div class="sp-goal-fill" style="width:${pct}%"></div></div>
          <div class="sp-goal-progress-txt">${fmtEuro(g.current)} / ${fmtEuro(g.target)}</div>
          ${linkedPlanHint}
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
  const reservedTotal = sparplanerReservedTotal();
  if (reservedTotal > 0) {
    bullets.push(`Davon sind ${fmtEuro(reservedTotal)} / Monat bereits für deine Sparpläne reserviert und in diesen Beträgen herausgerechnet.`);
  }

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
  const { months, rate, saved } = sparplanerSavedBy(targetDate, savedByScenario); // Berechnungslogik unverändert

  const includeKontostand = kontostand !== null && document.getElementById('sparplan-savedby-include-kontostand').checked;
  const total = includeKontostand ? round2(kontostand + saved) : saved;
  const dateLabel = targetDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (months <= 0) {
    resultEl.innerHTML = `<div class="sp-savedby-hint">Das gewählte Datum liegt im aktuellen Monat oder in der Vergangenheit — in diesem Zeitraum kommt noch nichts Neues hinzu.</div>`;
    return;
  }

  // ── Ergebnisdarstellung — bewusst modular in kleine Bausteine
  // (Zusammenfassung / Ergebnis-Karte / Kennzahlen / Berechnung), damit
  // sich später leicht weitere Abschnitte ergänzen lassen (z.B.
  // Inflationsbereinigung, Szenario-Vergleich, Diagramm, erreichbare
  // Sparziele bis zum Datum, Hinweise aus dem Geldfluss) — ohne den
  // bestehenden Aufbau anzufassen. Reine Darstellung, sparplanerSavedBy()
  // selbst liefert exakt dieselben Werte wie vorher.
  const buildRow = (label, value) => `<div class="sp-savedby-row"><span>${label}</span><span>${value}</span></div>`;

  const summarySentence = `Wenn du bis zum ${dateLabel} durchschnittlich ${fmtEuro(rate)} pro Monat sparen kannst, besitzt du voraussichtlich etwa ${fmtEuro(total)}.`;

  const heroHtml = `
    <div class="sp-savedby-hero">
      <div class="sp-savedby-hero-label">⭐ Ergebnis</div>
      <div class="sp-savedby-hero-sub">Bis zum <strong>${dateLabel}</strong> kannst du ungefähr</div>
      <div class="sp-savedby-hero-amount">${fmtEuro(total)}</div>
      <div class="sp-savedby-hero-sub">angespart haben.</div>
    </div>`;

  const factsHtml = `
    <div class="sp-savedby-section">
      ${buildRow('📈 Szenario', SCENARIO_META[savedByScenario].label)}
      ${buildRow('📅 Zeitraum', `${months} Monat${months === 1 ? '' : 'e'}`)}
      ${buildRow('💰 Monatlicher Sparbetrag', fmtEuro(rate))}
      ${buildRow('Kontostand berücksichtigt', includeKontostand ? 'Ja' : 'Nein')}
    </div>`;

  const formula = (a, op, b, result) => `
    <div class="sp-savedby-formula">
      <span class="sp-savedby-formula-part">${a}</span>
      <span class="sp-savedby-formula-op">${op}</span>
      <span class="sp-savedby-formula-part">${b}</span>
      <span class="sp-savedby-formula-op">=</span>
      <span class="sp-savedby-formula-result">${result}</span>
    </div>`;
  const calcHtml = `
    <div class="sp-savedby-section">
      <div class="sp-savedby-section-title">🧮 Berechnung</div>
      ${formula(`${months} Monate`, '×', fmtEuro(rate), fmtEuro(saved))}
      ${includeKontostand ? formula(fmtEuro(kontostand), '+', fmtEuro(saved), fmtEuro(total)) : ''}
    </div>`;

  resultEl.innerHTML = `
    <div class="sp-savedby-result">
      <div class="sp-savedby-summary">${summarySentence}</div>
      ${heroHtml}
      ${factsHtml}
      ${calcHtml}
    </div>`;
});
