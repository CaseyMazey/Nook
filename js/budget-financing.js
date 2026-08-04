// =========================
// BUDGET — FINANCING ENGINE ("Jedem Euro einen Job")
// Ein einziges Finanzierungs-Datenformat für alle Verbraucher:
//   funding: [ { sourceId: <budgetRecurring.id>, amount: <Zahl> } ]
// Genutzt (bzw. vorbereitet für) von:
//   - budgetGoals            (budget.js / budget-sparziele.js) — AKTIV
//   - budgetRecurring-Ausgaben (budget.js)                      — vorbereitet, UI folgt
//   - budgetOnetime-Einträge   (budget.js)                      — vorbereitet, UI folgt
// "Keine Zuordnung" (funding fehlt/leer) bleibt für alle drei der
// unveränderte Normalfall — ganz normal aus dem allgemeinen Topf bezahlt,
// keine Warnung. Warnungen erscheinen ausschließlich, wenn aktiv etwas
// zugeordnet wurde und die Summe nicht mehr zum Betrag passt.
//
// Muss NACH budget.js und budget-sparziele.js geladen werden (nutzt
// goalMonthlyReserveEquivalent() für die einmalige Migration alter
// Sparziel-Finanzierung) und VOR budget-sparprognose.js (nutzt
// sparplanTotalReserved()/sparplanReservedForIncome()).
// =========================

// ── Migration: goal.fundingSources (Liste von IDs) → goal.funding
// (Liste von {sourceId, amount}). Der bisherige Monatsbetrag
// (goalMonthlyReserveEquivalent) wird dabei gleichmäßig auf die
// vorhandenen Quellen verteilt, damit sich am Rechenergebnis beim
// Umstieg nichts ändert — nur die Grundlage wird präziser (und ab jetzt
// vom Nutzer frei editierbar statt nur gleichverteilt).
(function migrateGoalFunding() {
  let changed = false;
  budgetGoals.forEach(g => {
    if (Array.isArray(g.funding)) return; // bereits im neuen Format
    if (Array.isArray(g.fundingSources) && g.fundingSources.length) {
      const totalGuess = typeof goalMonthlyReserveEquivalent === 'function' ? goalMonthlyReserveEquivalent(g) : 0;
      const n = g.fundingSources.length;
      const each = round2(totalGuess / n);
      g.funding = g.fundingSources.map((id, i) => ({
        sourceId: id,
        amount: i === n - 1 ? round2(totalGuess - each * (n - 1)) : each,
      }));
    } else {
      g.funding = [];
    }
    delete g.fundingSources;
    changed = true;
  });
  if (changed) saveBudgetGoals();
})();

// ── Geteilter Finanzierungs-Editor ──────────────────────────────────
// EIN Rendering für alle Formulare, die Finanzierung anbieten (aktuell:
// Sparziel-Modal, Sparplan-Wizard "Neues Sparziel"; künftig: Ausgaben-
// Formulare). classPrefix erzeugt eindeutige CSS-Klassen je Aufrufer.
// totalAmount = der Betrag, der idealerweise vollständig zugeordnet
// werden soll (z.B. Ausgabenbetrag) — bei null gibt es keine Referenz-
// größe, nur eine reine "zugeordnet: X €"-Anzeige (z.B. bei Sparzielen
// ohne festen Monatsbetrag). Zuordnung blockiert nie das Speichern —
// die Anzeige ist eine Hilfe, keine Validierungssperre.
function renderFundingEditor(container, funding, totalAmount, classPrefix){
  if (!container) return;
  const incomes = budgetRecurring.filter(r => r.type === 'income');
  if (!incomes.length) {
    container.innerHTML = '<div class="empty-state" style="font-size:12px;">Noch keine Einnahmen im Budget-Tab angelegt.</div>';
    return;
  }
  const byId = {};
  (funding || []).forEach(f => { byId[f.sourceId] = f.amount; });
  container.innerHTML = incomes.map(r => {
    const checked = byId[r.id] !== undefined;
    return `
    <div class="fin-row" data-recid="${r.id}">
      <label class="fin-row-check">
        <input type="checkbox" class="${classPrefix}-toggle" data-recid="${r.id}" ${checked ? 'checked' : ''}/>
        ${r.name} <span class="fin-row-max">(max. ${r.amount.toFixed(2)} €)</span>
      </label>
      <input type="number" class="modal-input fin-row-amount ${classPrefix}-amount${checked ? '' : ' hidden'}"
             data-recid="${r.id}" step="0.01" min="0" placeholder="0.00" value="${checked ? byId[r.id] : ''}"/>
    </div>`;
  }).join('') + `<div class="${classPrefix}-diff fin-diff"></div>`;

  container.querySelectorAll(`.${classPrefix}-toggle`).forEach(cb => {
    cb.addEventListener('change', () => {
      const amountInput = container.querySelector(`.${classPrefix}-amount[data-recid="${cb.dataset.recid}"]`);
      if (amountInput) {
        amountInput.classList.toggle('hidden', !cb.checked);
        if (!cb.checked) amountInput.value = '';
        else if (!amountInput.value) amountInput.value = '';
      }
      updateFundingDiff(container, totalAmount, classPrefix);
    });
  });
  container.querySelectorAll(`.${classPrefix}-amount`).forEach(inp => {
    inp.addEventListener('input', () => updateFundingDiff(container, totalAmount, classPrefix));
  });
  updateFundingDiff(container, totalAmount, classPrefix);
}

function updateFundingDiff(container, totalAmount, classPrefix){
  const diffEl = container.querySelector(`.${classPrefix}-diff`);
  if (!diffEl) return;
  const assigned = round2(readFundingEditor(container, classPrefix).reduce((s, f) => s + f.amount, 0));
  if (totalAmount == null) {
    diffEl.textContent = assigned > 0 ? `Zugeordnet: ${fmtEuro(assigned)} / Monat` : '';
    diffEl.style.color = 'var(--text-3)';
    return;
  }
  const diff = round2(totalAmount - assigned);
  if (Math.abs(diff) < 0.005) {
    diffEl.textContent = `✓ Vollständig zugeordnet (${fmtEuro(totalAmount)})`;
    diffEl.style.color = 'var(--b-green)';
  } else if (diff > 0) {
    diffEl.textContent = `Noch ${fmtEuro(diff)} unzugeordnet`;
    diffEl.style.color = 'var(--text-3)';
  } else {
    diffEl.textContent = `${fmtEuro(Math.abs(diff))} zu viel zugeordnet`;
    diffEl.style.color = 'var(--b-red)';
  }
}

function readFundingEditor(container, classPrefix){
  if (!container) return [];
  return Array.from(container.querySelectorAll(`.${classPrefix}-toggle:checked`)).map(cb => {
    const amountInput = container.querySelector(`.${classPrefix}-amount[data-recid="${cb.dataset.recid}"]`);
    return { sourceId: cb.dataset.recid, amount: round2(parseFloat(amountInput?.value) || 0) };
  });
}

// Kurzform für die Anzeige (Karten, Detailansichten): "Testgehalt (58,00 €), ..."
function fundingBreakdownLabel(funding){
  if (!Array.isArray(funding) || !funding.length) return '';
  return funding.map(f => {
    const rec = budgetRecurring.find(r => r.id === f.sourceId);
    return `${rec ? rec.name : '?'} (${fmtEuro(f.amount)})`;
  }).join(', ');
}

// ── Engine: Zuordnung je Einnahme, über ALLE Verbraucher hinweg ────
// monthKey ist optional und wird ausschließlich für einmalige Ausgaben
// ausgewertet (die gelten nur in ihrem eigenen Monat) — wiederkehrende
// Ausgaben und Sparziel-Reservierungen gelten monatsunabhängig.
function financingAllocatedForIncome(recurringId, monthKey){
  let total = 0;
  budgetRecurring.filter(r => r.type === 'expense').forEach(e => {
    (e.funding || []).forEach(f => { if (f.sourceId === recurringId) total += f.amount; });
  });
  budgetOnetime.forEach(e => {
    if (monthKey && e.monthKey !== monthKey) return;
    (e.funding || []).forEach(f => { if (f.sourceId === recurringId) total += f.amount; });
  });
  budgetGoals.forEach(g => {
    if (!g.reserveActive) return;
    (g.funding || []).forEach(f => { if (f.sourceId === recurringId) total += f.amount; });
  });
  return round2(total);
}
function financingFreeForIncome(recurringId, monthKey){
  const rec = budgetRecurring.find(r => r.id === recurringId);
  if (!rec) return 0;
  return round2(rec.amount - financingAllocatedForIncome(recurringId, monthKey));
}
function financingBreakdownForIncome(recurringId, monthKey){
  const items = [];
  budgetRecurring.filter(r => r.type === 'expense').forEach(e => {
    (e.funding || []).forEach(f => { if (f.sourceId === recurringId && f.amount > 0) items.push({ name: e.name, amount: f.amount, kind: 'Ausgabe' }); });
  });
  budgetOnetime.forEach(e => {
    if (monthKey && e.monthKey !== monthKey) return;
    (e.funding || []).forEach(f => { if (f.sourceId === recurringId && f.amount > 0) items.push({ name: e.name, amount: f.amount, kind: 'Einmalig' }); });
  });
  budgetGoals.forEach(g => {
    if (!g.reserveActive) return;
    (g.funding || []).forEach(f => { if (f.sourceId === recurringId && f.amount > 0) items.push({ name: g.name, amount: f.amount, kind: 'Sparziel' }); });
  });
  return items;
}
// Warnt, wenn eine aktiv zugeordnete Finanzierung nicht mehr zum Betrag
// passt oder eine Quelle gelöscht wurde. Gibt null zurück, solange nichts
// zugeordnet ist ODER alles noch aufgeht — keine Warnung ohne Grund.
function financingWarningsForConsumer(funding, totalAmount){
  if (!Array.isArray(funding) || !funding.length) return null;
  const missingSource = funding.find(f => !budgetRecurring.find(r => r.id === f.sourceId));
  if (missingSource) return 'Eine Finanzierungsquelle wurde gelöscht.';
  if (totalAmount == null) return null;
  const assigned = round2(funding.reduce((s, f) => s + f.amount, 0));
  const diff = round2(totalAmount - assigned);
  if (Math.abs(diff) < 0.005) return null;
  return diff > 0 ? `Es fehlen ${fmtEuro(diff)}.` : `${fmtEuro(Math.abs(diff))} zu viel zugeordnet.`;
}

// ── Reservierung (Sparziele) — jetzt exakt statt geschätzt ─────────
// Da goal.funding jetzt echte, vom Nutzer eingegebene Beträge enthält,
// ist keine Gleichverteilungs-Näherung mehr nötig — die Reservierung
// ist einfach die Summe der zugeordneten Beträge aktiver Sparziele.
// Namen bewusst unverändert (sparplanTotalReserved/sparplanReservedForIncome),
// da budget-sparprognose.js diese Funktionen bereits unter diesem Namen
// aufruft (sparplanerReservedTotal() in budget-sparprognose.js).
function sparplanTotalReserved(){
  return round2(budgetGoals
    .filter(g => g.reserveActive)
    .reduce((s, g) => s + (g.funding || []).reduce((s2, f) => s2 + f.amount, 0), 0));
}
function sparplanReservedForIncome(recurringId){
  let total = 0;
  budgetGoals.forEach(g => {
    if (!g.reserveActive) return;
    (g.funding || []).forEach(f => { if (f.sourceId === recurringId) total += f.amount; });
  });
  return round2(total);
}
