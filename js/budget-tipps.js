// =========================
// BUDGET — TIPPS (Rücklage für Jahreskosten, Sparvorschlag am Monatsende,
// „Bis zum nächsten Geld“, Vorlagen zum Start)
// Lädt nach budget-abos.js. Nutzt aus budget.js: budgetRecurring, budgetGoals,
// budgetOnetime, kontostand, recurringActiveInMonth, recurringOccurrencesInMonth,
// recurringMonthlyEquivalent, isRecurringPaid, calcMonthProjection, round2,
// fmtEuro, escHtml, openGoalTx, renderBudget; aus budget-financing.js:
// budgetIncomeSources, incomeIcon; aus budget-taschengeld.js:
// getTaschengeldMonthEntry. today-budget.js liest nextMoneyWindow/nextMoneyEvents.
//
// Alles sind ruhige Vorschläge (AI documentation/budget.md): nichts passiert
// ohne Klick, jeder Vorschlag lässt sich wegklicken.
// Der reine Teil (BudgetTipps) hat kein DOM: tests/budget-tipps.test.js.
// =========================

const BudgetTipps = (() => {
  const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
  const pad = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const dayNum = d => Date.parse(`${d}T00:00:00Z`) / 864e5;
  const PRIO = { must: 0, need: 1, want: 2 };

  // ---------- Rücklage für Jahreskosten ----------

  // Nächster Termin eines jährlichen Postens ab heute (inklusive).
  function nextYearlyDate(e, today) {
    const [ty] = today.split('-').map(Number);
    for (const y of [ty, ty + 1]) {
      const dim = new Date(Date.UTC(y, e.dateMonth, 0)).getUTCDate();
      const d = iso(y, e.dateMonth || 1, Math.min(e.dateDay || 1, dim));
      if (d >= today) return d;
    }
    return null;
  }

  // entries: im laufenden Monat geltende Posten. goals: budgetGoals.
  // → null ohne jährliche Ausgaben, sonst { total, monthly, items, next, goal, targetOff, missing }.
  //   monthly: auf volle Euro aufgerundet, damit es sicher reicht.
  //   missing: was in der Rücklage für die nächste Jahreszahlung noch fehlt (0 = gedeckt).
  function yearlyReserve(entries, goals, today) {
    const items = entries
      .filter(e => e.type === 'expense' && e.freq === 'yearly' && (Number(e.amount) || 0) > 0)
      .map(e => ({ id: e.id, name: e.name, amount: r2(Number(e.amount)), date: nextYearlyDate(e, today) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!items.length) return null;
    const total = r2(items.reduce((s, i) => s + i.amount, 0));
    const goal = (goals || []).find(g => g.yearlyReserve && !g.archived) || null;
    const next = items[0];
    return {
      total, monthly: Math.ceil(total / 12), items, next,
      daysToNext: Math.round(dayNum(next.date) - dayNum(today)),
      goal,
      targetOff: !!goal && Math.abs((Number(goal.target) || 0) - total) >= 1,
      missing: goal ? r2(Math.max(0, next.amount - (Number(goal.current) || 0))) : next.amount,
    };
  }

  // Das Sparziel, das „Rücklage anlegen“ erzeugt (Felder wie im Sparziel-Dialog).
  // source: Einnahme, aus der monatlich zurückgelegt wird (größte Einnahme), oder null.
  function reserveGoal(res, source, today, id) {
    const names = res.items.map(i => i.name);
    const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} …` : names.join(', ');
    const g = {
      id, name: 'Rücklage für Jahreskosten', target: res.total, items: [], itemsTrackFull: true,
      current: 0, plantType: 'cactus', eta: null, priority: 'must', category: 'Rücklage',
      description: `Für jährliche Posten: ${list}. Ist eine fällig, nimm sie hier heraus (Abheben).`,
      startDate: today, reserveActive: false, funding: [], yearlyReserve: true,
    };
    if (source) {
      g.reserveActive = true;
      g.funding = [{ id: `${id}-f`, sourceId: source.id, amount: res.monthly }];
    }
    return g;
  }

  // ---------- Sparvorschlag am Monatsende ----------

  // proj: calcMonthProjection() (gap = was nach dem Monat und den Ausgaben vor dem nächsten Geld übrig bleibt).
  // In den letzten 7 Tagen eines Monats, ab 10 € Überschuss. Vorgeschlagen werden 80 % davon,
  // auf 5 € abgerundet — ein Puffer bleibt. goals: offene Sparziele (nicht voll, nicht archiviert),
  // wichtigste zuerst. → null oder { amount, goals }.
  function monthEndSuggestion(proj, goals, today, dismissedMonth) {
    if (!proj || typeof proj.gap !== 'number') return null;
    const [y, m, d] = today.split('-').map(Number);
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d < dim - 6) return null;
    if (dismissedMonth === `${y}-${pad(m)}`) return null;
    const open = (goals || [])
      .filter(g => !g.archived && (Number(g.target) || 0) - (Number(g.current) || 0) > 0.5)
      .map((g, i) => ({ g, i }))
      .sort((a, b) => (PRIO[a.g.priority] ?? 1) - (PRIO[b.g.priority] ?? 1) || a.i - b.i)
      .map(x => x.g);
    if (!open.length) return null;
    const amount = Math.floor(proj.gap * 0.8 / 5) * 5;
    if (amount < 10) return null;
    return { amount, goals: open };
  }
  const suggestFor = (s, goal) => Math.min(s.amount, Math.ceil((Number(goal.target) || 0) - (Number(goal.current) || 0)));

  // ---------- Bis zum nächsten Geld ----------

  // events: offene Ein-/Ausgänge { date, amount, income, name } (Überfälliges mit Datum vor heute
  // zählt als jetzt fällig). → null, wenn kein Geld in den nächsten 45 Tagen kommt, sonst
  // { date, name, days, available, perDay }: Was vom Kontostand bis zum Tag vor dem nächsten
  // Geld frei bleibt, geteilt durch die Tage bis dahin.
  function nextMoneyWindow({ today, balance, events }) {
    if (balance === null || balance === undefined) return null;
    const next = events.filter(e => e.income && e.date > today).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!next) return null;
    const days = Math.round(dayNum(next.date) - dayNum(today));
    if (days > 45) return null;
    const inNow = events.filter(e => e.income && e.date <= today).reduce((s, e) => s + e.amount, 0);
    const out = events.filter(e => !e.income && e.date < next.date).reduce((s, e) => s + e.amount, 0);
    const available = r2(balance + inNow - out);
    return { date: next.date, name: next.name, days, available, perDay: r2(available / Math.max(1, days)) };
  }

  // ---------- Vorlagen zum Start ----------
  // Beispielbeträge (Stand 2026), im Dialog änderbar. Rundfunkbeitrag als Monatsanteil
  // (wird meist vierteljährlich abgebucht, den Rhythmus kennt Nook nicht).
  const T = (name, amount, extra = {}) => ({ name, amount, type: 'expense', freq: 'monthly', day: 1, priority: 'need', ...extra });
  const TEMPLATES = {
    azubi: { label: 'Ausbildung', icon: '🧰', items: [
      T('Ausbildungsvergütung', 1000, { type: 'income', day: 30, priority: 'none' }),
      T('Miete', 450, { priority: 'must' }),
      T('Strom', 35, { day: 15, priority: 'must' }),
      T('Handy', 15, { day: 5 }),
      T('Deutschlandticket', 63, { day: 1 }),
      T('Lebensmittel', 200, { day: 1 }),
      T('Rundfunkbeitrag', 18.36, { day: 15, priority: 'must' }),
      T('Haftpflichtversicherung', 60, { freq: 'yearly', dateDay: 15, dateMonth: 1, priority: 'must' }),
      T('Freizeit', 60, { priority: 'want' }),
    ] },
    studium: { label: 'Studium', icon: '🎓', items: [
      T('BAföG / Unterhalt', 850, { type: 'income', day: 1, priority: 'none' }),
      T('Miete', 420, { priority: 'must' }),
      T('Krankenversicherung', 140, { priority: 'must' }),
      T('Handy', 12, { day: 5 }),
      T('Lebensmittel', 200),
      T('Rundfunkbeitrag', 18.36, { day: 15, priority: 'must' }),
      T('Lernmaterial', 20),
      T('Semesterbeitrag Sommer', 300, { freq: 'yearly', dateDay: 15, dateMonth: 2, priority: 'must' }),
      T('Semesterbeitrag Winter', 300, { freq: 'yearly', dateDay: 15, dateMonth: 8, priority: 'must' }),
      T('Freizeit', 60, { priority: 'want' }),
    ] },
    wg: { label: 'WG', icon: '🏠', items: [
      T('Mietanteil', 400, { priority: 'must' }),
      T('Nebenkosten und Strom (Anteil)', 40, { priority: 'must' }),
      T('Internet (Anteil)', 10, { day: 3 }),
      T('WG-Kasse', 15, { day: 1 }),
      T('Lebensmittel', 180),
      T('Rundfunkbeitrag (Anteil)', 6.12, { day: 15, priority: 'must' }),
    ] },
    schule: { label: 'Schule', icon: '🎒', items: [
      T('Taschengeld von den Eltern', 40, { type: 'income', day: 1, priority: 'none' }),
      T('Handy', 10, { day: 5 }),
      T('Streaming', 5, { day: 10, priority: 'want' }),
      T('Snacks und Freizeit', 15, { priority: 'want' }),
    ] },
  };

  // Vorlagen-Posten als budgetRecurring-Einträge (Felder wie im Posten-Dialog).
  function templateEntry(item, { id, startMonth, icon } = {}) {
    const e = {
      id, name: item.name, amount: r2(Number(item.amount) || 0), type: item.type, freq: item.freq,
      priority: item.type === 'expense' ? item.priority : 'none',
      certainty: 'fixed', includeInSparplan: true,
    };
    if (item.freq === 'yearly') { e.dateDay = item.dateDay; e.dateMonth = item.dateMonth; }
    else e.day = item.day;
    if (e.type === 'expense') e.funding = [];
    else e.icon = icon || '💶';
    if (startMonth) e.startMonth = startMonth;
    return e;
  }

  return { nextYearlyDate, yearlyReserve, reserveGoal, monthEndSuggestion, suggestFor, nextMoneyWindow, TEMPLATES, templateEntry };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BudgetTipps;

// =========================
// ANZEIGE (nur im Browser)
// =========================
if (typeof document !== 'undefined') (function initBudgetTipps() {
  const $ = id => document.getElementById(id);
  const fmtDay = d => d.slice(8, 10) + '.' + d.slice(5, 7) + '.';
  const newId = () => crypto.randomUUID();
  const nowIso = () => todayIso();
  let dismissed = DB.get('budgetTippsAus', {}); // { reserve: <total als Text>, sparvorschlag: 'YYYY-MM', vorlagen: true }
  const saveDismissed = () => DB.set('budgetTippsAus', dismissed);

  // Offene Ein-/Ausgänge ab dem laufenden Monat für „Bis zum nächsten Geld“ (today-budget.js).
  // Je Monat: wiederkehrende Termine (nicht als erledigt markiert), Taschengeld, Einmalbuchungen.
  window.nextMoneyEvents = function (monthsAhead = 2) {
    const now = new Date();
    const out = [];
    for (let k = 0; k <= monthsAhead; k++) {
      const dt = new Date(now.getFullYear(), now.getMonth() + k, 1);
      const y = dt.getFullYear(), m = dt.getMonth() + 1, mk = budgetMonthKey(dt);
      budgetRecurring.forEach(r => {
        if (isRecurringPaid(r.id, mk)) return;
        recurringOccurrencesInMonth(r, y, m).forEach(o =>
          out.push({ date: o.date, amount: o.amount, income: r.type === 'income', name: r.name }));
      });
      const tg = typeof getTaschengeldMonthEntry === 'function' ? getTaschengeldMonthEntry(y, m) : null;
      if (tg && !isRecurringPaid(tg.id, mk)) out.push({ date: isoDateYMD(y, m, tg.day), amount: tg.amount, income: true, name: tg.name });
      budgetOnetime.forEach(e => {
        if (e.monthKey !== mk || e.paid) return;
        out.push({ date: isoDateYMD(y, m, e.day || 1), amount: e.amount, income: e.type === 'income', name: e.name });
      });
    }
    return out;
  };

  function activeEntriesNow() {
    const now = new Date();
    return budgetRecurring.filter(r => recurringActiveInMonth(r, now.getFullYear(), now.getMonth() + 1));
  }

  function biggestIncome() {
    const src = typeof budgetIncomeSources === 'function' ? budgetIncomeSources() : budgetRecurring.filter(r => r.type === 'income');
    return src.slice().sort((a, b) => recurringMonthlyEquivalent(b) - recurringMonthlyEquivalent(a))[0] || null;
  }

  const tip = (key, icon, bodyHtml, actionsHtml) => `
    <div class="b-tip" data-tip="${key}">
      <span class="b-tip-icon">${icon}</span>
      <div class="b-tip-body">${bodyHtml}${actionsHtml ? `<div class="b-tip-actions">${actionsHtml}</div>` : ''}</div>
      <button type="button" class="b-tip-x" data-dismiss="${key}" title="Ausblenden" aria-label="Ausblenden">✕</button>
    </div>`;

  // Von renderBudget (budget.js) aufgerufen.
  window.renderBudgetTips = function () {
    const box = $('budget-tips');
    if (!box) return;
    const today = nowIso();
    const parts = [];

    // 5) Vorlagen: solange es noch gar keine wiederkehrenden Posten gibt.
    if (!budgetRecurring.length && !dismissed.vorlagen) {
      const btns = Object.entries(BudgetTipps.TEMPLATES)
        .map(([id, t]) => `<button type="button" class="b-tip-btn" data-template="${id}">${t.icon} ${escHtml(t.label)}</button>`).join('');
      parts.push(tip('vorlagen', '📋', '<b>Schnell starten:</b> Wähle eine Vorlage mit typischen Posten. Die Beträge passt du vorher an.', btns));
    }

    // 1) Rücklage für Jahreskosten
    const res = BudgetTipps.yearlyReserve(activeEntriesNow(), budgetGoals, today);
    if (res && !res.goal && dismissed.reserve !== String(res.total)) {
      parts.push(tip('reserve', '🗓️',
        `Deine jährlichen Kosten: <b>${fmtEuro(res.total)}</b> im Jahr. Mit <b>${fmtEuro(res.monthly)} im Monat</b> zurückgelegt, sind sie immer gedeckt. Als Nächstes fällig: ${escHtml(res.next.name)} am ${fmtDay(res.next.date)}`,
        `<button type="button" class="b-tip-btn primary" data-act="reserve-create">Rücklage anlegen</button>`));
    } else if (res && res.goal) {
      if (res.targetOff && dismissed.reserve !== String(res.total)) {
        parts.push(tip('reserve', '🗓️',
          `Deine jährlichen Kosten sind jetzt <b>${fmtEuro(res.total)}</b>, die Rücklage zielt auf ${fmtEuro(res.goal.target)}.`,
          `<button type="button" class="b-tip-btn primary" data-act="reserve-sync">Auf ${fmtEuro(res.total)} anpassen</button>`));
      } else if (res.daysToNext <= 45) {
        const body = res.missing > 0
          ? `${escHtml(res.next.name)} (${fmtEuro(res.next.amount)}) ist am ${fmtDay(res.next.date)} fällig. In der Rücklage fehlen dafür noch ${fmtEuro(res.missing)}.`
          : `${escHtml(res.next.name)} (${fmtEuro(res.next.amount)}) ist am ${fmtDay(res.next.date)} fällig und in der Rücklage gedeckt. Nimm den Betrag dann dort heraus.`;
        parts.push(tip(`reserve-next-${res.next.date}`, '🗓️', body, ''));
      }
    }

    // 3) Sparvorschlag am Monatsende
    const proj = typeof calcMonthProjection === 'function' ? calcMonthProjection() : null;
    const sug = BudgetTipps.monthEndSuggestion(proj, budgetGoals, today, dismissed.sparvorschlag);
    if (sug) {
      const first = sug.goals[0];
      const select = sug.goals.length > 1
        ? `<select class="b-tip-select" data-act="spar-goal">${sug.goals.map(g => `<option value="${escHtml(g.id)}">${escHtml(g.name)}</option>`).join('')}</select>`
        : `„${escHtml(first.name)}“`;
      parts.push(tip('sparvorschlag', '🌱',
        `Diesen Monat bleiben voraussichtlich etwa <b>${fmtEuro(Math.floor(proj.gap))}</b> übrig. Magst du davon <b data-spar-amount>${fmtEuro(BudgetTipps.suggestFor(sug, first))}</b> in ${select} stecken?`,
        `<button type="button" class="b-tip-btn primary" data-act="spar-go">Einzahlen</button>`));
    }

    // Ausgeblendete Hinweise zur nächsten Jahreszahlung bleiben weg.
    const html = parts.filter(p => !(dismissed.hidden || []).includes((p.match(/data-tip="([^"]+)"/) || [])[1])).join('');
    box.innerHTML = html;
    box.classList.toggle('hidden', !html);
    wire(box, sug, res);
  };

  function wire(box, sug, res) {
    box.querySelectorAll('[data-dismiss]').forEach(btn => btn.addEventListener('click', () => {
      const key = btn.dataset.dismiss;
      if (key === 'vorlagen') dismissed.vorlagen = true;
      else if (key === 'reserve') dismissed.reserve = String(res?.total);
      else if (key === 'sparvorschlag') dismissed.sparvorschlag = budgetMonthKey(new Date());
      else dismissed.hidden = (dismissed.hidden || []).filter(k => !k.startsWith('reserve-next-')).concat(key);
      saveDismissed();
      window.renderBudgetTips();
    }));
    box.querySelectorAll('[data-template]').forEach(btn => btn.addEventListener('click', () => openTemplate(btn.dataset.template)));
    box.querySelector('[data-act="reserve-create"]')?.addEventListener('click', () => {
      const goal = BudgetTipps.reserveGoal(res, biggestIncome(), nowIso(), newId());
      if (goal.funding[0]) goal.funding[0].id = newId();
      budgetGoals.push(goal);
      saveBudgetGoals();
      renderBudget();
      if (typeof renderSparziele === 'function') renderSparziele();
      if (typeof hubUndo === 'function') hubUndo('Rücklage für Jahreskosten angelegt', () => {
        budgetGoals = budgetGoals.filter(g => g.id !== goal.id);
        saveBudgetGoals(); renderBudget();
        if (typeof renderSparziele === 'function') renderSparziele();
      });
    });
    box.querySelector('[data-act="reserve-sync"]')?.addEventListener('click', () => {
      const g = budgetGoals.find(x => x.id === res.goal.id);
      if (!g) return;
      const before = { target: g.target, funding: JSON.parse(JSON.stringify(g.funding || [])) };
      g.target = res.total;
      // Die monatliche Rücklage aus EINER Quelle mitziehen; mehrere Quellen bleiben, wie sie sind.
      if (Array.isArray(g.funding) && g.funding.length === 1) g.funding[0].amount = res.monthly;
      saveBudgetGoals(); renderBudget();
      if (typeof hubUndo === 'function') hubUndo('Rücklage angepasst', () => {
        g.target = before.target; g.funding = before.funding; saveBudgetGoals(); renderBudget();
      });
    });
    const sel = box.querySelector('[data-act="spar-goal"]');
    const currentGoal = () => sug && (sug.goals.find(g => g.id === sel?.value) || sug.goals[0]);
    sel?.addEventListener('change', () => {
      const el = box.querySelector('[data-spar-amount]');
      if (el) el.textContent = fmtEuro(BudgetTipps.suggestFor(sug, currentGoal()));
    });
    box.querySelector('[data-act="spar-go"]')?.addEventListener('click', () => {
      const g = currentGoal();
      if (!g || typeof openGoalTx !== 'function') return;
      openGoalTx(g, 'deposit');
      const inp = $('goal-tx-amount');
      if (inp) inp.value = String(BudgetTipps.suggestFor(sug, g));
    });
  }

  // ---------- Vorlagen-Dialog ----------
  const tplModal = typeof wireModal === 'function'
    ? wireModal('budget-template-modal-overlay', { closeIds: ['budget-template-close', 'budget-template-cancel'] })
    : { open() {}, close() {} };
  let tplState = null;

  function openTemplate(id) {
    const t = BudgetTipps.TEMPLATES[id];
    if (!t) return;
    tplState = { id, items: t.items.map(it => ({ ...it, on: true })) };
    renderTemplate();
    tplModal.open();
  }
  window.openBudgetTemplate = id => openTemplate(id || 'azubi');

  const RHYTHM = it => it.freq === 'yearly' ? `jährlich · ${it.dateDay}.${String(it.dateMonth).padStart(2, '0')}.` : `monatlich · am ${it.day}.`;
  function renderTemplate() {
    const list = $('budget-template-list');
    const names = new Set(budgetRecurring.map(r => (r.name || '').toLowerCase()));
    const group = (title, rows) => !rows.length ? '' : `<div class="b-imp-group">${title}</div>` + rows.map(({ it, i }) => {
      const dup = names.has(it.name.toLowerCase());
      return `
      <label class="b-imp-row${it.on ? '' : ' off'}">
        <input type="checkbox" data-i="${i}"${it.on ? ' checked' : ''}/>
        <span class="b-imp-main">
          <input type="text" class="b-imp-name" data-i="${i}" data-f="name" value="${escHtml(it.name)}" aria-label="Name"/>
          <span class="b-imp-meta">${RHYTHM(it)}${it.type === 'expense' ? ` · ${priorityLabel(it.priority)}` : ''}${dup ? '<span class="b-imp-note">gibt es schon</span>' : ''}</span>
        </span>
        <span class="b-tpl-amount ${it.type === 'income' ? 'income' : 'expense'}">${it.type === 'income' ? '+' : '−'}<input type="number" step="0.01" min="0" class="modal-input" data-i="${i}" data-f="amount" value="${it.amount}" aria-label="Betrag"/> €</span>
      </label>`;
    }).join('');
    const chips = $('budget-template-chips');
    if (chips) {
      chips.innerHTML = Object.entries(BudgetTipps.TEMPLATES).map(([id, t]) =>
        `<button type="button" class="b-tip-btn${id === tplState.id ? ' primary' : ''}" data-tpl="${id}">${t.icon} ${escHtml(t.label)}</button>`).join('');
      chips.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => openTemplate(b.dataset.tpl)));
    }
    const indexed = tplState.items.map((it, i) => ({ it, i }));
    list.innerHTML = group('Einnahmen', indexed.filter(x => x.it.type === 'income')) + group('Ausgaben', indexed.filter(x => x.it.type === 'expense'));
    list.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => {
      tplState.items[cb.dataset.i].on = cb.checked;
      cb.closest('.b-imp-row').classList.toggle('off', !cb.checked);
      updateTplSave();
    }));
    list.querySelectorAll('input[data-f]').forEach(inp => inp.addEventListener('input', () => {
      const it = tplState.items[inp.dataset.i];
      if (inp.dataset.f === 'amount') it.amount = parseFloat(inp.value) || 0; else it.name = inp.value;
    }));
    updateTplSave();
  }
  function updateTplSave() {
    const n = tplState.items.filter(it => it.on).length;
    const btn = $('budget-template-save');
    btn.textContent = `${n} Posten übernehmen`;
    btn.disabled = n === 0;
  }
  $('budget-template-save')?.addEventListener('click', () => {
    if (!tplState) return;
    const startMonth = budgetMonthKey(new Date());
    const add = tplState.items.filter(it => it.on && it.name.trim()).map(it => BudgetTipps.templateEntry(
      { ...it, name: it.name.trim() },
      { id: newId(), startMonth, icon: it.type === 'income' && typeof incomeIcon === 'function' ? incomeIcon(it.name) : undefined }));
    if (!add.length) return;
    budgetRecurring.push(...add);
    saveBudgetRecurring();
    tplModal.close();
    renderBudget();
    if (typeof hubUndo === 'function') {
      const ids = new Set(add.map(e => e.id));
      hubUndo(`${add.length} Posten aus der Vorlage übernommen`, () => {
        budgetRecurring = budgetRecurring.filter(r => !ids.has(r.id));
        saveBudgetRecurring(); renderBudget();
      });
    }
  });
})();
