// =========================
// BUDGET — GELDFLUSS
// Reines Planungsboard für den aktuellen Monats-Geldfluss.
//
// Bugfixes & UX-Anpassungen:
// 1. Nur relevante Einträge des AKTUELLEN Monats werden angezeigt
//    (keine vergangenen/erledigten Einmalausgaben, abgelaufene Sparziele etc.).
// 2. Drag & Drop targetet die KONKRETE Einnahme-Instanz (Slot/Woche/Bar).
//    Jede Einnahmekarte hat eine eigene UID (z.B. "rec_id@week-0").
//    Die Zuordnung speichert nun slotId zusätzlich zur sourceId.
// 3. "Nicht zugeordnet"-Spalte ist komplett entfernt.
// =========================

// ── Hilfsfunktionen & Datenaufbau ────────────────────────────────────

function geldflussWeeklyOccurrences(entry) {
  const amount = entry.amount || 0;
  if (entry.freq === 'daily')    return [0, 1, 2, 3].flatMap(w => Array.from({ length: 7 }, () => ({ week: w, amount })));
  if (entry.freq === 'weekly')   return [0, 1, 2, 3].map(w => ({ week: w, amount }));
  if (entry.freq === 'biweekly') return [0, 2].map(w => ({ week: w, amount }));
  return [];
}

const GF_INCOME_PALETTE = ['gf-income-c1', 'gf-income-c2', 'gf-income-c3', 'gf-income-c4'];
function incomeColorClass(recurringId) {
  const incomes = budgetRecurring.filter(r => r.type === 'income' && r.freq !== 'yearly');
  const idx = Math.max(0, incomes.findIndex(r => r.id === recurringId));
  return GF_INCOME_PALETTE[idx % GF_INCOME_PALETTE.length];
}

// Baut alle konkreten Einnahmekarten/Slots für den Monats-Geldfluss auf
function buildGeldflussIncomeCards() {
  const cards = [];
  budgetRecurring.filter(r => r.type === 'income' && r.freq !== 'yearly').forEach(r => {
    const isBar = r.freq === 'monthly';
    if (isBar) {
      cards.push({ uid: `${r.id}@bar`, recurringId: r.id, name: r.name, amount: r.amount, stack: [], remaining: r.amount, isBar: true, week: null });
    } else {
      geldflussWeeklyOccurrences(r).forEach((occ, i) => {
        cards.push({ uid: `${r.id}@${occ.week}-${i}`, recurringId: r.id, name: r.name, amount: occ.amount, stack: [], remaining: occ.amount, isBar: false, week: occ.week });
      });
    }
  });
  cards.sort((a, b) => (a.week ?? -1) - (b.week ?? -1));
  return cards;
}

// Filtert Verbraucher strictly für den AKTUELLEN Monat
function buildGeldflussConsumers() {
  const list = [];
  const curMk = budgetMonthKey(budgetMonth || new Date());

  // 1. Wiederkehrende Ausgaben
  budgetRecurring.filter(r => r.type === 'expense' && r.freq !== 'yearly').forEach(r => {
    list.push({ kind: 'expense', id: r.id, uid: r.id, name: r.name, amount: recurringMonthlyEquivalent(r),
      funding: r.funding || [], obj: r });
  });

  // 2. Einmalige Ausgaben: NUR aus dem aktuell ausgewählten Monat AND NICHT als erledigt markiert
  budgetOnetime.filter(e => e.type === 'expense' && e.monthKey === curMk && !e.paid).forEach(e => {
    list.push({ kind: 'expense', id: e.id, uid: e.id, name: e.name, amount: e.amount,
      funding: e.funding || [], obj: e, isOnetime: true });
  });

  // 3. Aktive Sparziele
  budgetGoals.forEach(g => {
    const need = goalMonthlyReserveEquivalent(g);
    const remaining = round2(Math.max(0, g.target - g.current));
    const amount = need > 0.005 ? need : remaining;
    if (amount <= 0.005) return;
    list.push({ kind: 'goal', id: g.id, uid: g.id, name: g.name, amount,
      funding: g.funding || [], obj: g, isMonthly: need > 0.005 });
  });

  // 4. Aktive Schulden
  budgetDebts.forEach(d => {
    const remaining = debtRemaining(d);
    if (remaining <= 0.005) return;
    list.push({ kind: 'debt', id: d.id, uid: d.id, name: d.name, amount: remaining,
      funding: d.funding || [], obj: d });
  });

  return list;
}

// Verteilt Zuordnungen exakt auf die jeweiligen Instanzen (slotId)
function distributeGeldfluss(incomeCards, consumers) {
  const cardMap = {};
  incomeCards.forEach(c => { cardMap[c.uid] = c; });

  const byRecurringId = {};
  incomeCards.forEach(c => { (byRecurringId[c.recurringId] ||= []).push(c); });

  consumers.forEach(cons => {
    if (!Array.isArray(cons.funding)) return;
    cons.funding.forEach(f => {
      if (!f || f.amount <= 0.005) return;
      let left = f.amount;

      // Wenn eine konkrete slotId angegeben ist, bevorzugt dort ablegen
      if (f.slotId && cardMap[f.slotId]) {
        const targetCard = cardMap[f.slotId];
        const take = round2(Math.min(left, targetCard.remaining));
        if (take > 0.005) {
          targetCard.stack.push({ kind: cons.kind, id: cons.id, uid: cons.uid, name: cons.name, amount: take, slotId: f.slotId });
          targetCard.remaining = round2(targetCard.remaining - take);
          left = round2(left - take);
        }
      }

      // Falls noch Restbetrag offen ist oder keine slotId existierte (Fallback/Kompaktsicht)
      if (left > 0.005) {
        const cards = byRecurringId[f.sourceId] || [];
        for (let card of cards) {
          if (left <= 0.005) break;
          if (card.remaining > 0.005) {
            const take = round2(Math.min(left, card.remaining));
            card.stack.push({ kind: cons.kind, id: cons.id, uid: cons.uid, name: cons.name, amount: take, slotId: card.uid });
            card.remaining = round2(card.remaining - take);
            left = round2(left - take);
          }
        }
        // Überhang auf die letzte Karte
        if (left > 0.005 && cards.length) {
          const overCard = cards[cards.length - 1];
          overCard.stack.push({ kind: cons.kind, id: cons.id, uid: cons.uid, name: cons.name, amount: left, over: true, slotId: overCard.uid });
          overCard.remaining = round2(overCard.remaining - left);
        }
      }
    });
  });
}

function consumerAssigned(cons) { return round2(cons.funding.reduce((s, f) => s + f.amount, 0)); }
function consumerRemainder(cons) { return round2(Math.max(0, cons.amount - consumerAssigned(cons))); }

function saveConsumerObject(kind, obj) {
  if (kind === 'expense') { obj.freq !== undefined ? saveBudgetRecurring() : saveBudgetOnetime(); }
  else if (kind === 'goal') saveBudgetGoals();
  else if (kind === 'debt') saveBudgetDebts();
}

function findConsumerObject(kind, id) {
  if (kind === 'expense') return budgetRecurring.find(r => r.id === id) || budgetOnetime.find(e => e.id === id);
  if (kind === 'goal') return budgetGoals.find(g => g.id === id);
  if (kind === 'debt') return budgetDebts.find(d => d.id === id);
  return null;
}

// Zuordnen mit konkreter Instanz (slotId)
function geldflussAssign(kindOrCons, idOrRecurringId, slotIdOrAmount, amountOrRecurringId, maybeAmount) {
  let cons, recurringId, slotId, amount;

  if (typeof kindOrCons === 'object') {
    cons = kindOrCons;
    slotId = idOrRecurringId;
    recurringId = slotId.split('@')[0];
    amount = slotIdOrAmount;
  } else {
    const obj = findConsumerObject(kindOrCons, idOrRecurringId);
    if (!obj) return false;
    cons = { kind: kindOrCons, obj };
    slotId = slotIdOrAmount;
    recurringId = amountOrRecurringId;
    amount = maybeAmount;
  }

  const free = round2(Math.max(0, financingFreeForIncome(recurringId)));
  const take = round2(Math.min(amount, free));
  if (take <= 0.005) return false;

  const obj = cons.obj;
  if (!Array.isArray(obj.funding)) obj.funding = [];

  const existing = obj.funding.find(f => f.sourceId === recurringId && f.slotId === slotId);
  if (existing) {
    existing.amount = round2(existing.amount + take);
  } else {
    obj.funding.push({ sourceId: recurringId, slotId: slotId, amount: take });
  }

  saveConsumerObject(cons.kind, obj);
  return true;
}

function geldflussUnassign(kind, id, slotId) {
  const obj = findConsumerObject(kind, id);
  if (!obj || !Array.isArray(obj.funding)) return;
  const recurringId = slotId ? slotId.split('@')[0] : null;

  obj.funding = obj.funding.filter(f => {
    if (slotId && f.slotId) return f.slotId !== slotId;
    if (recurringId) return f.sourceId !== recurringId;
    return false;
  });

  saveConsumerObject(kind, obj);
}

// ── Rendering Töpfe & Stapel ─────────────────────────────────────────

const GELDFLUSS_ICON = { expense: '🔁', goal: '🎯', debt: '💳' };

function renderGeldflussStack(stackEl, stack, slotId) {
  stack.forEach((item, i) => {
    const mini = document.createElement('div');
    mini.className = 'gf-stack-item' + (item.over ? ' gf-stack-item--over' : '');
    mini.style.setProperty('--gf-i', i);
    mini.innerHTML = `<span>${GELDFLUSS_ICON[item.kind] || ''} ${item.name}</span><span>${fmtEuro(item.amount)}</span>`;
    mini.title = 'Klicken zum Entfernen — oder herausziehen';
    mini.addEventListener('click', () => {
      geldflussUnassign(item.kind, item.id, slotId);
      renderFinanzanalyse();
    });
    makeGeldflussDraggable(mini, { kind: item.kind, id: item.id, name: item.name }, item.amount, slotId);
    stackEl.appendChild(mini);
  });
}

function renderGeldflussIncomeCard(card) {
  const el = document.createElement('div');
  el.className = 'gf-income-card ' + incomeColorClass(card.recurringId);
  el.dataset.recurringId = card.recurringId;
  el.dataset.slotId = card.uid;
  const pct = card.amount > 0 ? Math.max(0, Math.min(100, Math.round((card.remaining / card.amount) * 100))) : 0;
  const restClass = pct > 25 ? 'gf-rest-ok' : (card.remaining >= -0.005 ? 'gf-rest-low' : 'gf-rest-over');

  el.innerHTML = `
    <div class="gf-income-head">
      <span class="gf-income-name">${incomeIcon(card.name)} ${card.name}</span>
    </div>
    <div class="gf-income-amount">${fmtEuro(card.amount)}</div>
    <div class="gf-stack"></div>
    <div class="gf-rest ${restClass}">Rest ${fmtEuro(card.remaining)}</div>`;
  renderGeldflussStack(el.querySelector('.gf-stack'), card.stack, card.uid);
  return el;
}

function renderGeldflussIncomeBar(card) {
  const el = document.createElement('div');
  el.className = 'gf-income-bar ' + incomeColorClass(card.recurringId);
  el.dataset.recurringId = card.recurringId;
  el.dataset.slotId = card.uid;
  const pct = card.amount > 0 ? Math.max(0, Math.min(100, Math.round((card.remaining / card.amount) * 100))) : 0;
  const restClass = pct > 25 ? 'gf-rest-ok' : (card.remaining >= -0.005 ? 'gf-rest-low' : 'gf-rest-over');

  el.innerHTML = `
    <div class="gf-bar-main">
      <span class="gf-bar-name">${incomeIcon(card.name)} ${card.name}</span>
      <span class="gf-bar-amount">${fmtEuro(card.amount)}</span>
      <span class="gf-bar-rest ${restClass}">Rest ${fmtEuro(card.remaining)}</span>
    </div>
    <div class="gf-stack gf-stack--bar"></div>`;
  renderGeldflussStack(el.querySelector('.gf-stack'), card.stack, card.uid);
  return el;
}

function renderGeldflussIncomeArea(container, incomeCards) {
  const weekGrid = document.createElement('div');
  weekGrid.className = 'gf-week-grid';
  weekGrid.style.setProperty('--gf-week-count', 4);
  for (let i = 0; i < 4; i++) {
    const col = document.createElement('div');
    col.className = 'gf-week-col';
    col.innerHTML = `<div class="gf-week-head"><div class="gf-week-title">Woche ${i + 1}</div></div>`;
    incomeCards.filter(c => !c.isBar && c.week === i).forEach(c => col.appendChild(renderGeldflussIncomeCard(c)));
    weekGrid.appendChild(col);
  }
  container.appendChild(weekGrid);

  const bars = incomeCards.filter(c => c.isBar);
  if (bars.length) {
    const barWrap = document.createElement('div');
    barWrap.className = 'gf-bar-wrap';
    bars.forEach(c => barWrap.appendChild(renderGeldflussIncomeBar(c)));
    container.appendChild(barWrap);
  }
}

// ── Rendering Verbraucher-Karten ─────────────────────────────────────

function renderGeldflussConsumerCard(cons, colorClass) {
  const remainder = consumerRemainder(cons);
  const el = document.createElement('div');
  el.className = 'gf-consumer-card' + (colorClass ? ' ' + colorClass : '');
  el.innerHTML = `
    <span class="gf-consumer-name">${GELDFLUSS_ICON[cons.kind] || ''} ${cons.name}</span>
    <span class="gf-consumer-amount">${fmtEuro(remainder)}${cons.kind === 'goal' && cons.isMonthly ? '/Monat' : ''}</span>`;
  makeGeldflussDraggable(el, cons, remainder, null);
  return el;
}

function renderGeldflussGroup(container, title, dotColorVar, cardColorClass, consumers, addBtnLabel, addBtnTargetId, addBtnExpenseType) {
  const wrap = document.createElement('div');
  wrap.className = 'gf-group';
  const openConsumers = consumers.filter(c => consumerRemainder(c) > 0.005);
  const head = document.createElement('div');
  head.className = 'gf-group-title';
  head.innerHTML = `<span class="gf-group-dot" style="background:${dotColorVar};"></span>${title} <span class="gf-group-count">${openConsumers.length}</span>`;
  wrap.appendChild(head);
  const list = document.createElement('div');
  list.className = 'gf-group-list';
  if (!openConsumers.length) {
    list.innerHTML = '<div class="empty-state" style="font-size:12px;padding:6px 0;">Alles zugeordnet ✓</div>';
  } else {
    openConsumers.forEach(c => list.appendChild(renderGeldflussConsumerCard(c, cardColorClass)));
  }
  wrap.appendChild(list);
  if (addBtnTargetId) {
    const addBtn = document.createElement('button');
    addBtn.className = 'gf-add-btn';
    addBtn.textContent = `+ ${addBtnLabel}`;
    addBtn.addEventListener('click', () => {
      document.getElementById(addBtnTargetId)?.click();
      if (addBtnExpenseType) document.getElementById('recurring-type-expense')?.click();
    });
    wrap.appendChild(addBtn);
  }
  container.appendChild(wrap);
}

// ── Drag & Drop Logic ────────────────────────────────────────────────

let gfDrag = null;

function makeGeldflussDraggable(el, cons, remainder, sourceSlotId) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.className = el.className + ' gf-drag-ghost';
    ghost.style.width = rect.width + 'px';
    document.body.appendChild(ghost);
    gfDrag = { cons, remainder, sourceSlotId, ghost, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    el.classList.add('gf-drag-source');
    moveGfGhost(e.clientX, e.clientY);
    document.addEventListener('pointermove', onGfPointerMove);
    document.addEventListener('pointerup', onGfPointerUp, { once: true });
  });
}

function moveGfGhost(x, y) {
  if (!gfDrag) return;
  gfDrag.ghost.style.left = (x - gfDrag.offsetX) + 'px';
  gfDrag.ghost.style.top  = (y - gfDrag.offsetY) + 'px';
}

function onGfPointerMove(e) {
  moveGfGhost(e.clientX, e.clientY);
  document.querySelectorAll('.gf-drop-hover').forEach(el => el.classList.remove('gf-drop-hover'));
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.gf-income-card, .gf-income-bar');
  if (under) under.classList.add('gf-drop-hover');
}

function onGfPointerUp(e) {
  document.removeEventListener('pointermove', onGfPointerMove);
  if (!gfDrag) return;
  const { cons, remainder, sourceSlotId, ghost } = gfDrag;
  document.querySelectorAll('.gf-drop-hover').forEach(el => el.classList.remove('gf-drop-hover'));
  document.querySelectorAll('.gf-drag-source').forEach(el => el.classList.remove('gf-drag-source'));
  ghost.remove();

  const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.gf-income-card, .gf-income-bar');
  gfDrag = null;

  if (sourceSlotId) {
    const targetSlotId = dropTarget?.dataset.slotId || null;
    if (targetSlotId === sourceSlotId) return;
    geldflussUnassign(cons.kind, cons.id, sourceSlotId);
    if (targetSlotId) geldflussAssign(cons.kind, cons.id, targetSlotId, remainder);
    renderFinanzanalyse();
    return;
  }

  if (!dropTarget) return;
  const slotId = dropTarget.dataset.slotId;
  if (!slotId) return;

  const assigned = geldflussAssign(cons, slotId, remainder);
  if (assigned) renderFinanzanalyse();
}

// ── Haupt-Rendering ───────────────────────────────────────────────────

function renderFinanzanalyse() {
  const body = document.getElementById('finanzanalyse-body');
  if (!body) return;
  body.innerHTML = '';

  const incomeCards = buildGeldflussIncomeCards();
  const consumers   = buildGeldflussConsumers();
  distributeGeldfluss(incomeCards, consumers);

  if (!incomeCards.length && !consumers.length) {
    body.innerHTML = '<div class="empty-state">Noch keine Einnahmen, Ausgaben, Sparziele oder Schulden angelegt.</div>';
    return;
  }

  if (!incomeCards.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.fontSize = '12px';
    empty.textContent = 'Noch keine Einnahmen angelegt.';
    body.appendChild(empty);
  } else {
    renderGeldflussIncomeArea(body, incomeCards);
  }

  // 3-Spalten Layout: Ausgaben / Sparziele / Schulden ("Nicht zugeordnet" entfernt)
  const consumerGrid = document.createElement('div');
  consumerGrid.className = 'gf-consumer-grid';
  consumerGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';

  renderGeldflussGroup(consumerGrid, 'Ausgaben', 'var(--b-red)', 'gf-consumer-red',
    consumers.filter(c => c.kind === 'expense'), 'Ausgabe hinzufügen', 'add-onetime-btn', false);
  renderGeldflussGroup(consumerGrid, 'Sparziele', 'var(--b-blue)', 'gf-consumer-blue',
    consumers.filter(c => c.kind === 'goal'), 'Sparziel hinzufügen', 'add-goal-btn', false);
  renderGeldflussGroup(consumerGrid, 'Schulden', 'var(--b-purple)', 'gf-consumer-purple',
    consumers.filter(c => c.kind === 'debt'), 'Schuld hinzufügen', 'debt-add-btn', false);

  body.appendChild(consumerGrid);
}
