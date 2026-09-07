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

// ── Migration: jeder Finanzierungseintrag bekommt eine eigene ID ──
// Vorher wurden Einträge nur über sourceId identifiziert — das führte
// dazu, dass "eine Zuordnung entfernen/verschieben" ALLE Einträge
// derselben Einnahme traf, nicht nur den einen, der gerade gezogen
// wurde (Ursache des in der Geldfluss-Ansicht gemeldeten Dopplungs-
// Bugs). Mit einer eigenen ID pro Eintrag lässt sich jede einzelne
// Zuordnung eindeutig ansprechen. Additiv, bestehende Beträge bleiben
// unverändert — nur das Identifizieren wird präziser.
(function migrateFundingEntryIds() {
  let changed = false;
  const ensureIds = (arr) => {
    (arr || []).forEach(f => { if (!f.id) { f.id = crypto.randomUUID(); changed = true; } });
  };
  budgetGoals.forEach(g => ensureIds(g.funding));
  budgetRecurring.forEach(r => ensureIds(r.funding));
  budgetOnetime.forEach(e => ensureIds(e.funding));
  if (typeof budgetDebts !== 'undefined') budgetDebts.forEach(d => ensureIds(d.funding));
  if (changed) {
    saveBudgetGoals(); saveBudgetRecurring(); saveBudgetOnetime();
    if (typeof saveBudgetDebts === 'function') saveBudgetDebts();
  }
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
// totalAmount darf eine feste Zahl ODER eine Funktion sein, die den
// aktuellen Referenzbetrag liefert — wichtig für Formulare, in denen sich
// der Betrag NACH dem Rendern noch ändert (z.B. das Betragsfeld einer
// Ausgabe), damit die Live-Diff-Anzeige nicht auf einem beim Rendern
// eingefrorenen Wert hängen bleibt.
function resolveFundingTotal(totalAmount){
  return typeof totalAmount === 'function' ? totalAmount() : totalAmount;
}

function renderFundingEditor(container, funding, totalAmount, classPrefix){
  if (!container) return;
  const incomes = budgetIncomeSources();
  if (!incomes.length) {
    container.innerHTML = '<div class="empty-state" style="font-size:12px;">Noch keine Einnahmen im Budget-Tab angelegt.</div>';
    return;
  }
  const byId = {};
  (funding || []).forEach(f => { byId[f.sourceId] = f.amount; });
  container.innerHTML = incomes.map(r => {
    const checked = byId[r.id] !== undefined;
    // "max." bezieht sich immer auf den Monatsbetrag der Einnahme (auch
    // bei täglich/wöchentlich/2-wöchentlich) — Finanzierungsbeträge sind
    // grundsätzlich als Monatsbeträge definiert, unabhängig vom
    // Intervall der Quelle. recurringMonthlyEquivalent() lebt in budget.js.
    const monthlyMax = typeof recurringMonthlyEquivalent === 'function' ? recurringMonthlyEquivalent(r) : r.amount;
    return `
    <div class="fin-row" data-recid="${r.id}">
      <label class="fin-row-check">
        <input type="checkbox" class="${classPrefix}-toggle" data-recid="${r.id}" ${checked ? 'checked' : ''}/>
        ${r.name} <span class="fin-row-max">(max. ${monthlyMax.toFixed(2)} €/Monat)</span>
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
  const total = resolveFundingTotal(totalAmount);
  const assigned = round2(readFundingEditor(container, classPrefix).reduce((s, f) => s + f.amount, 0));
  if (total == null) {
    diffEl.textContent = assigned > 0 ? `Zugeordnet: ${fmtEuro(assigned)} / Monat` : '';
    diffEl.style.color = 'var(--text-3)';
    return;
  }
  const diff = round2(total - assigned);
  if (Math.abs(diff) < 0.005) {
    diffEl.textContent = `✓ Vollständig zugeordnet (${fmtEuro(total)})`;
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
    const rec = budgetIncomeSourceById(f.sourceId);
    return `${rec ? rec.name : '?'} (${fmtEuro(f.amount)})`;
  }).join(', ');
}

// Kleine, rein kosmetische Icon-Heuristik für Einnahmequellen — kein
// neues Datenfeld, nur ein paar Stichwörter im Namen. Falsch geraten
// schadet nichts (fällt auf ein neutrales 💶 zurück), macht "Bezahlt
// durch"-Listen aber auf einen Blick lesbarer.
function incomeIcon(name){
  const n = (name || '').toLowerCase();
  if (n.includes('gehalt') || n.includes('lohn')) return '💼';
  if (n.includes('fahrt') || n.includes('ticket')) return '🚆';
  if (n.includes('taschengeld')) return '👛';
  if (n.includes('miete')) return '🏠';
  if (n.includes('geschenk')) return '🎁';
  if (n.includes('stipendium') || n.includes('bafög') || n.includes('bafoeg')) return '🎓';
  return '💶';
}

// Bevorzugt das im recurring-Modal explizit gewählte Icon (r.icon, nur
// bei Einnahmen gesetzt) — fällt nur auf die Namens-Heuristik oben
// zurück, wenn (noch) keins gewählt wurde (Einnahmen von vor diesem
// Feature). So bleiben bestehende Daten nutzbar, ohne Migration.
function resolveIncomeIcon(recurringId, name){
  const entry = budgetIncomeSourceById(recurringId);
  if (entry && entry.icon) return entry.icon;
  return incomeIcon(name);
}

// ── Sparplan-Startdatum: reservierte Sparziel-Beträge zählen erst ab dem
// Startdatum des verknüpften Sparplans ────────────────────────────────
// Ein Sparziel kann reserveActive sein, obwohl der verknüpfte Sparplan
// (falls vorhanden — sparplanForGoal() lebt in budget-sparplaene.js, das
// NACH dieser Datei lädt, daher defensiv per typeof geprüft) erst in der
// Zukunft beginnt. Vor diesem Startdatum darf die Reservierung nirgends
// wirken (weder Finanzierung/Geldfluss-Planer noch Sparplan-Prognose) —
// erst AB dem Startdatum (inklusive) zählt sie wie gewohnt. Nur target-/
// rate-Sparpläne haben ein echtes Kalender-Startdatum; "Individuell"-
// Pläne (method:'custom', startDate:null) und Sparziele ganz ohne
// verknüpften Plan sind davon unberührt und reservieren wie bisher sofort.
// EINZIGE Stelle, die diese Regel kennt — alle Funktionen unten prüfen
// ausschließlich hierüber, nie g.reserveActive direkt (Schulden/Debts
// kennen kein Sparplan-Konzept und bleiben unverändert bei d.reserveActive).
function goalReservationIsActive(goal){
  if (!goal.reserveActive) return false;
  const linkedPlan = typeof sparplanForGoal === 'function' ? sparplanForGoal(goal.id) : null;
  if (!linkedPlan || !linkedPlan.startDate) return true;
  const now = new Date();
  const todayStr = isoDateYMD(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return linkedPlan.startDate <= todayStr;
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
    if (!goalReservationIsActive(g)) return;
    (g.funding || []).forEach(f => { if (f.sourceId === recurringId) total += f.amount; });
  });
  budgetDebts.forEach(d => {
    if (!d.reserveActive) return;
    (d.funding || []).forEach(f => { if (f.sourceId === recurringId) total += f.amount; });
  });
  return round2(total);
}
function financingFreeForIncome(recurringId, monthKey){
  const rec = budgetIncomeSourceById(recurringId);
  if (!rec) return 0;
  // Nutzt den Monats-Äquivalent-Betrag der Einnahme (recurringMonthlyEquivalent(),
  // budget.js), nicht rec.amount direkt — sonst wäre "35 €/Woche frei"
  // fälschlich nur 35 € statt ~152 € pro Monat.
  return round2(recurringMonthlyEquivalent(rec) - financingAllocatedForIncome(recurringId, monthKey));
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
    if (!goalReservationIsActive(g)) return;
    (g.funding || []).forEach(f => { if (f.sourceId === recurringId && f.amount > 0) items.push({ name: g.name, amount: f.amount, kind: 'Sparziel' }); });
  });
  budgetDebts.forEach(d => {
    if (!d.reserveActive) return;
    (d.funding || []).forEach(f => { if (f.sourceId === recurringId && f.amount > 0) items.push({ name: d.name, amount: f.amount, kind: 'Schuld' }); });
  });
  return items;
}
// Warnt, wenn eine aktiv zugeordnete Finanzierung nicht mehr zum Betrag
// passt oder eine Quelle gelöscht wurde. Gibt null zurück, solange nichts
// zugeordnet ist ODER alles noch aufgeht — keine Warnung ohne Grund.
function financingWarningsForConsumer(funding, totalAmount){
  if (!Array.isArray(funding) || !funding.length) return null;
  const missingSource = funding.find(f => !budgetIncomeSourceById(f.sourceId));
  if (missingSource) return 'Eine Finanzierungsquelle wurde gelöscht.';
  if (totalAmount == null) return null;
  const assigned = round2(funding.reduce((s, f) => s + f.amount, 0));
  const diff = round2(totalAmount - assigned);
  if (Math.abs(diff) < 0.005) return null;
  return diff > 0 ? `Es fehlen ${fmtEuro(diff)}.` : `${fmtEuro(Math.abs(diff))} zu viel zugeordnet.`;
}

// ── Reservierung (Sparziele + Schulden) — jetzt exakt statt geschätzt ──
// Da goal.funding/debt.funding jetzt echte, vom Nutzer eingegebene
// Beträge enthalten, ist keine Gleichverteilungs-Näherung mehr nötig —
// die Reservierung ist einfach die Summe der zugeordneten Beträge
// aktiver Sparziele UND Schulden (beide "verplanen" Geld dauerhaft).
// Namen bewusst unverändert (sparplanTotalReserved/sparplanReservedForIncome),
// da budget-sparprognose.js diese Funktionen bereits unter diesem Namen
// aufruft (sparplanerReservedTotal() in budget-sparprognose.js).
// Archivierte Sparziele/Schulden (siehe archiveGoal()/archiveDebt()) sind
// erledigt — ihre alten Finanzierungsbeträge dürfen die "frei verfügbare"
// Sparrate in der Sparprognose nicht mehr dauerhaft schmälern.
//
// Eigener monatlich reservierter Betrag EINES Sparziels — dieselbe Summe,
// die auch in sparplanTotalReserved() (unten) einfließt. Wird zusätzlich
// von sparplanerETAs() (budget-sparprognose.js) gebraucht: der reservierte
// Betrag wird zwar korrekt vom allgemeinen freien Sparbetrag abgezogen,
// muss aber GLEICHZEITIG als monatlicher Sparbeitrag für GENAU dieses Ziel
// gezählt werden — sonst ist er faktisch doppelt weg (einmal abgezogen,
// einmal bei der Zielprognose ignoriert), was die ETA fälschlich nach
// hinten verschiebt (gemeldeter Berechnungsfehler).
function goalOwnMonthlyReserved(goal){
  if (!goalReservationIsActive(goal)) return 0;
  return round2((goal.funding || []).reduce((s, f) => s + f.amount, 0));
}
function sparplanTotalReserved(){
  const goalsTotal = budgetGoals
    .filter(g => goalReservationIsActive(g) && !g.archived)
    .reduce((s, g) => s + (g.funding || []).reduce((s2, f) => s2 + f.amount, 0), 0);
  const debtsTotal = budgetDebts
    .filter(d => d.reserveActive && !d.archived)
    .reduce((s, d) => s + (d.funding || []).reduce((s2, f) => s2 + f.amount, 0), 0);
  return round2(goalsTotal + debtsTotal);
}
function sparplanReservedForIncome(recurringId){
  let total = 0;
  budgetGoals.forEach(g => {
    if (!goalReservationIsActive(g) || g.archived) return;
    (g.funding || []).forEach(f => { if (f.sourceId === recurringId) total += f.amount; });
  });
  budgetDebts.forEach(d => {
    if (!d.reserveActive || d.archived) return;
    (d.funding || []).forEach(f => { if (f.sourceId === recurringId) total += f.amount; });
  });
  return round2(total);
}
