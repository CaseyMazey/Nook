// =========================
// BUDGET — SPARPLÄNE
// Teil 3/3 des Budget-Moduls. Eigenständiges Datenmodell
// (budgetSavingsPlans), unabhängig von Sparprognose/Übersicht.
// Muss NACH budget.js geladen werden.
// =========================

// =========================
// SPARPLÄNE — DATENMODELL
// Komplett unabhängig von budgetGoals/budgetRecurring und von der
// Sparprognose. Beantwortet "Ich möchte X bis Y — wie muss ich
// sparen?" statt "Was schafft mein aktuelles Budget?".
// Struktur je Plan:
//   { id, name, image, targetAmount (Zahl|null — null = ergibt sich
//     aus der Summe der Raten), startDate, endDate, interval,
//     method: 'constant'|'increasing'|'decreasing'|'custom',
//     entries: [{ id, date, amount, done }], linkedToBudget (reserviert
//     für eine spätere, hier bewusst noch nicht gebaute Budget-Kopplung),
//     createdAt }
// =========================
let budgetSavingsPlans = DB.get('budgetSavingsPlans', []);
function saveBudgetSavingsPlans(){ DB.set('budgetSavingsPlans', budgetSavingsPlans); }

const SP_INTERVAL_META = {
  daily:    { label: 'Täglich' },
  weekly:   { label: 'Wöchentlich' },
  biweekly: { label: 'Zweiwöchentlich' },
  monthly:  { label: 'Monatlich' },
  custom:   { label: 'Individuell' }, // Fallback für ältere Pläne ohne echtes Intervall
};
// Beschriftung der Positionen im individuellen Sparplan (KEINE Kalender-
// daten — nur "Woche N"/"Tag N"/... je nach gewähltem Intervall).
const SP_POSITION_LABELS = { daily: 'Tag', weekly: 'Woche', biweekly: '14 Tage', monthly: 'Monat' };
const SP_METHOD_META = {
  constant:   { label: 'Konstant' },
  increasing: { label: 'Steigend' },
  decreasing: { label: 'Fallend' },
  custom:     { label: 'Individuell' },
};

// Registry der Erzeugungs-Methoden innerhalb von "Individuell". Rein
// beschreibend (Label/Icon/Text) — die eigentliche Erzeugungslogik lebt
// zentral in sparplanGenFixed()/sparplanGenRandom(), damit hier später
// leicht weitere Methoden ergänzt werden können, ohne Berechnungscode
// zu duplizieren.
const SP_CUSTOM_GENERATORS = {
  fixed:    { label: 'Fester Betrag',     icon: '💶' },
  random:   { label: 'Zufällige Beträge', icon: '🎲' },
  manual:   { label: 'Eigene Einträge',   icon: '✏️' },
  template: { label: 'Aus Vorlage',       icon: '📋' },
};

// Registry für künftige Sparvorlagen (1-Cent-Challenge, 5-Euro-Schein-
// Challenge, Münz-Challenge, Zufalls-Challenge, steigend/fallend, ...).
// Bewusst noch leer — eine Vorlage ist später nur ein weiterer Eintrag
// mit { label, icon, desc, build(count) => [Beträge] }, ohne dass
// Wizard- oder Speicherlogik angepasst werden muss.
const SP_TEMPLATE_REGISTRY = {};

function sparplanNewId() { return `sp_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`; }

// Lokales Datum → 'YYYY-MM-DD', ohne UTC-Verschiebung (analog budgetMonthKey)
// — wird nur noch von den Varianten "Zielbetrag"/"Sparrate" benutzt, die
// echte Kalendertermine haben. "Individuell" arbeitet rein positionsbasiert.
function sparplanDateStr(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function sparplanFormatDate(dateStr){
  if (!dateStr) return '–';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function sparplanPositionLabel(interval, position){
  return `${SP_POSITION_LABELS[interval] || 'Rate'} ${position}`;
}
// Zeigt eine Rate an — je nach Plantyp entweder als Position ("Woche 3",
// nur "Individuell") oder als echtes Kalenderdatum (alle anderen Varianten).
// Zentrale Stelle, damit Karte/Detailansicht nicht zwischen beiden Fällen
// unterscheiden müssen.
function sparplanEntryLabel(plan, entry){
  if (plan.method === 'custom') return sparplanPositionLabel(plan.interval, plan.entries.indexOf(entry) + 1);
  return sparplanFormatDate(entry.date);
}
// Liefert die offenen/erledigten Raten eines Plans in der richtigen
// Reihenfolge. Bei "Individuell" entspricht die Array-Reihenfolge bereits
// der Position (keine Kalenderdaten, daher keine Sortierung nötig); bei
// den anderen Varianten wird chronologisch nach Datum sortiert. Einzige
// Stelle im Code, an der Raten-Reihenfolge entschieden wird.
function sparplanOrderedEntries(plan, done){
  const filtered = plan.entries.filter(e => e.done === done);
  if (plan.method === 'custom') return filtered;
  return filtered.sort((a, b) => a.date.localeCompare(b.date));
}

// Nächster Termin je Intervall — 'T00:00:00' verhindert UTC-Tagesverschiebung
// (gleiches Muster wie beim "Gespart bis..."-Rechner weiter unten).
function sparplanAddInterval(date, interval){
  const d = new Date(date);
  if (interval === 'monthly') { d.setMonth(d.getMonth() + 1); return d; }
  const days = interval === 'weekly' ? 7 : interval === 'biweekly' ? 14 : 1;
  d.setDate(d.getDate() + days);
  return d;
}
function sparplanGenerateDates(startStr, endStr, interval){
  const dates = [];
  let cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  if (cur > end) return [cur];
  let guard = 0;
  while (cur <= end && guard < 2000) {
    dates.push(new Date(cur));
    cur = sparplanAddInterval(cur, interval);
    guard++;
  }
  return dates;
}

// ── Individuell-Generatoren — zentrale Erzeugungslogik für Beträge.
// Liefern reine Betrags-Listen (keine Kalenderdaten!) — die Position
// jeder Rate ergibt sich ausschließlich aus ihrem Index in der bereits
// bestehenden Liste (spwCustomEntries.length + i), berechnet an der
// einzigen Stelle im Wizard, an der Einträge angehängt werden. ──
function sparplanGenFixed({ amount, count }){
  return new Array(count).fill(round2(amount));
}
// Ganzzahliger Zufallsbetrag zwischen min und max (inklusive). Mit
// "Vielfaches von" werden ausschließlich Vielfache dieses Werts erzeugt,
// die innerhalb von [min, max] liegen — sonst ein gleichverteilter
// ganzzahliger Wert im Bereich.
function sparplanRandomAmount(min, max, multipleOf){
  if (multipleOf && multipleOf > 0) {
    const first = Math.ceil(min / multipleOf) * multipleOf;
    const last  = Math.floor(max / multipleOf) * multipleOf;
    if (last < first) return Math.round(first);
    const steps = Math.round((last - first) / multipleOf);
    return first + Math.floor(Math.random() * (steps + 1)) * multipleOf;
  }
  const lo = Math.ceil(min), hi = Math.floor(max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
function sparplanGenRandom({ min, max, count, multipleOf }){
  return Array.from({ length: count }, () => sparplanRandomAmount(min, max, multipleOf));
}

// Verteilt einen Zielbetrag auf n Termine nach Sparart. Rundungsdifferenzen
// landen bewusst auf dem letzten Termin, damit die Summe exakt stimmt.
function sparplanDistribute(n, total, method){
  if (n <= 0) return [];
  if (n === 1 || method === 'constant') {
    const each = round2(total / n);
    const arr = new Array(n).fill(each);
    arr[n - 1] = round2(total - each * (n - 1));
    return arr;
  }
  // steigend/fallend: lineare Rampe (60% → 140% des Durchschnitts), danach
  // exakt auf die Zielsumme skaliert.
  const avg = total / n;
  const lo = avg * 0.6, hi = avg * 1.4;
  let arr = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    arr.push(lo + (hi - lo) * t);
  }
  if (method === 'decreasing') arr.reverse();
  const rawSum = arr.reduce((s, v) => s + v, 0);
  arr = arr.map(v => round2(v * total / rawSum));
  const diff = round2(total - arr.reduce((s, v) => s + v, 0));
  arr[arr.length - 1] = round2(arr[arr.length - 1] + diff);
  return arr;
}
function sparplanBuildEntries(dates, amounts){
  const stamp = Date.now().toString(36);
  return dates.map((d, i) => ({ id: `spe_${stamp}_${i}`, date: sparplanDateStr(d), amount: amounts[i], done: false }));
}

// ── Abgeleitete Werte — nichts wird redundant gespeichert ──────
function sparplanTargetAmount(plan){
  return typeof plan.targetAmount === 'number' && plan.targetAmount > 0
    ? plan.targetAmount
    : round2(plan.entries.reduce((s, e) => s + e.amount, 0));
}
function sparplanCurrentAmount(plan){
  return round2(plan.entries.filter(e => e.done).reduce((s, e) => s + e.amount, 0));
}
function sparplanNextEntry(plan){
  return sparplanOrderedEntries(plan, false)[0] || null;
}
function sparplanProgressPct(plan){
  const target = sparplanTargetAmount(plan);
  if (!target) return plan.entries.length && plan.entries.every(e => e.done) ? 100 : 0;
  return Math.min(100, Math.round((sparplanCurrentAmount(plan) / target) * 100));
}
function sparplanEndDate(plan){
  if (plan.endDate) return plan.endDate;
  const last = plan.entries[plan.entries.length - 1];
  return last ? last.date : null;
}
// "Individuell" hat keine Kalenderdaten — hier zählt die Anzahl noch
// offener Raten statt der verbleibenden Zeit bis zu einem Datum.
function sparplanRemainingTimeLabel(plan){
  if (plan.method === 'custom') {
    const remaining = plan.entries.filter(e => !e.done).length;
    if (remaining === 0) return 'Abgeschlossen';
    return remaining === 1 ? 'noch 1 Rate' : `noch ${remaining} Raten`;
  }
  const endStr = sparplanEndDate(plan);
  if (!endStr) return '–';
  const months = sparplanerMonthsUntil(new Date(endStr + 'T00:00:00'));
  if (months <= 0) return 'diese Periode';
  return months === 1 ? 'noch 1 Monat' : `noch ${months} Monate`;
}
function getSparplanById(id){ return budgetSavingsPlans.find(p => p.id === id) || null; }

// =========================
// SPARPLÄNE — RENDERING
// =========================
function buildSparplanCard(plan){
  const target  = sparplanTargetAmount(plan);
  const current = sparplanCurrentAmount(plan);
  const pct     = sparplanProgressPct(plan);
  const next    = sparplanNextEntry(plan);

  const card = document.createElement('div'); card.className = 'sp-plan-card';
  card.innerHTML = `
    <div class="sp-plan-card-head">
      <span class="sp-plan-card-name">${plan.image ? plan.image + ' ' : '🐷 '}${plan.name}</span>
      <span class="budget-badge sp-plan-badge">${SP_INTERVAL_META[plan.interval]?.label || plan.interval}</span>
    </div>
    <div class="budget-goal-bar sp-plan-bar"><div class="budget-goal-fill" style="width:${pct}%"></div></div>
    <div class="sp-plan-card-row">
      <span class="sp-plan-card-amounts">${fmtEuro(current)} <span class="sp-plan-card-amounts-of">/ ${fmtEuro(target)}</span></span>
      <span class="sp-plan-card-pct">${pct}%</span>
    </div>
    <div class="sp-plan-card-meta">
      <span>${next ? `Nächste Rate: ${fmtEuro(next.amount)} · ${sparplanEntryLabel(plan, next)}` : 'Alle Raten erledigt 🎉'}</span>
      <span>${sparplanRemainingTimeLabel(plan)}</span>
    </div>
    <button class="btn-ghost sp-plan-open-btn">Öffnen</button>`;
  card.querySelector('.sp-plan-open-btn').addEventListener('click', () => openSparplanDetail(plan.id));
  return card;
}
function renderSparplaeneGrid(){
  const grid = document.getElementById('sparplaene-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (budgetSavingsPlans.length === 0) {
    grid.innerHTML = '<div class="empty-state">Noch keine Sparpläne. Starte mit „+ Sparplan".</div>';
    return;
  }
  budgetSavingsPlans.forEach(plan => grid.appendChild(buildSparplanCard(plan)));
}
function renderSparplaene(){
  if (document.getElementById('budget-panel-sparplaene')?.classList.contains('hidden')) return;
  renderSparplaeneGrid();
}

// =========================
// SPARPLÄNE — ASSISTENT (Wizard)
// 3 Hauptvarianten, wie im Konzept beschrieben:
//   'target' — Zielbetrag bekannt, Nook berechnet die Sparrate
//   'rate'   — Sparrate bekannt, Nook berechnet den Endbetrag
//   'custom' — Individuell: EINE Ratenliste, die per Werkzeugleiste
//              additiv befüllt wird (siehe unten)
//
// Die Individuell-Variante hat KEINEN eigenen Zielbetrag — die Summe
// ergibt sich ausschließlich aus den erzeugten Einträgen. Die vier
// Werkzeuge (Registry: SP_CUSTOM_GENERATORS) sind keine exklusiven
// Varianten, sondern hängen ihr Ergebnis an dieselbe Liste
// (spwCustomEntries / #spw-custom-rows) an — beliebig oft kombinierbar.
// =========================
let spwVariant = null;
let spwMethod  = 'constant';
let spwInterval = 'weekly'; // gemeinsames Intervall für den GESAMTEN individuellen Plan
let spwCustomEntries = []; // [{amount}] — DIE eine Ratenliste, additiv befüllt. Position = Index im Array, keine Kalenderdaten.
let spwGeneratorMethodsUsed = new Set(); // welche Werkzeuge für diesen Plan benutzt wurden (fürs Detail-Label)
let spwRandomPreview = [];  // Vorschau-Puffer für "Zufällige Beträge" (reine Beträge), vor "Zur Liste hinzufügen"

function showSpwStep(step) {
  ['variant', 'target', 'rate', 'custom'].forEach(s => {
    const el = document.getElementById(`sparplan-wizard-step-${s}`);
    if (el) el.classList.toggle('hidden', s !== step);
  });
  document.getElementById('sparplan-wizard-back').classList.toggle('hidden', step === 'variant');
  document.getElementById('sparplan-wizard-save').classList.toggle('hidden', step === 'variant');
}

// Schaltet innerhalb der Individuell-Variante zwischen der Hauptansicht
// (Werkzeugleiste + Liste) und den einzelnen Generator-Formularen um.
// Die sichtbare DOM-Klasse ist die einzige Zustandsquelle.
function showSpwCustomSection(section) {
  document.getElementById('spw-custom-main').classList.toggle('hidden',         section !== 'main');
  document.getElementById('spw-custom-form-fixed').classList.toggle('hidden',   section !== 'fixed');
  document.getElementById('spw-custom-form-random').classList.toggle('hidden',  section !== 'random');
  document.getElementById('spw-custom-form-template').classList.toggle('hidden',section !== 'template');
  // Speichern ist nur in der Hauptansicht sinnvoll (dort liegt die Liste)
  document.getElementById('sparplan-wizard-save').classList.toggle('hidden', section !== 'main');
}

function renderSpwCustomRows() {
  const wrap = document.getElementById('spw-custom-rows');
  if (!wrap) return;
  wrap.innerHTML = '';
  spwCustomEntries.forEach((entry, i) => {
    const row = document.createElement('div'); row.className = 'sp-wizard-custom-row';
    row.innerHTML = `
      <span class="sp-wizard-custom-position">${sparplanPositionLabel(spwInterval, i + 1)}</span>
      <input type="number" class="modal-input spw-custom-amount" placeholder="0.00 €" step="0.01" min="0" value="${entry.amount ?? ''}"/>
      <button class="task-delete spw-custom-remove" title="Entfernen">✕</button>`;
    row.querySelector('.spw-custom-amount').addEventListener('input', e => {
      entry.amount = parseFloat(e.target.value) || 0;
      updateSpwCustomSum();
    });
    row.querySelector('.spw-custom-remove').addEventListener('click', () => {
      spwCustomEntries.splice(i, 1);
      renderSpwCustomRows();
    });
    wrap.appendChild(row);
  });
  updateSpwCustomSum();
}
function updateSpwCustomSum() {
  const sumEl = document.getElementById('spw-custom-sum');
  if (!sumEl) return;
  const sum = round2(spwCustomEntries.reduce((s, e) => s + (e.amount || 0), 0));
  sumEl.textContent = spwCustomEntries.length ? `${spwCustomEntries.length} Rate(n) · Summe ${fmtEuro(sum)}` : '';
}

function updateSpwTargetPreview() {
  const previewEl = document.getElementById('spw-target-preview');
  if (!previewEl) return;
  const amount = parseFloat(document.getElementById('spw-target-amount').value);
  const start  = document.getElementById('spw-target-start').value;
  const end    = document.getElementById('spw-target-end').value;
  const interval = document.getElementById('spw-target-interval').value;
  if (!amount || amount <= 0 || !start || !end) { previewEl.textContent = ''; return; }
  const dates = sparplanGenerateDates(start, end, interval);
  if (!dates.length) { previewEl.textContent = ''; return; }
  const amounts = sparplanDistribute(dates.length, round2(amount), spwMethod);
  previewEl.innerHTML = spwMethod === 'constant'
    ? `${dates.length} Rate(n) à ${fmtEuro(amounts[0])}`
    : `${dates.length} Rate(n) von ${fmtEuro(amounts[0])} bis ${fmtEuro(amounts[amounts.length - 1])}`;
}
function updateSpwRatePreview() {
  const previewEl = document.getElementById('spw-rate-preview');
  if (!previewEl) return;
  const rate = parseFloat(document.getElementById('spw-rate-amount').value);
  const start = document.getElementById('spw-rate-start').value;
  const end   = document.getElementById('spw-rate-end').value;
  const interval = document.getElementById('spw-rate-interval').value;
  if (!rate || rate <= 0 || !start || !end) { previewEl.textContent = ''; return; }
  const dates = sparplanGenerateDates(start, end, interval);
  const total = round2(rate * dates.length);
  previewEl.innerHTML = `${dates.length} Rate(n) × ${fmtEuro(round2(rate))} = <b>${fmtEuro(total)}</b> erreichbar`;
}

// ── "Fester Betrag" — Live-Vorschau + Erzeugung ──
function readSpwFixedParams() {
  return {
    amount: parseFloat(document.getElementById('spw-fixed-amount').value),
    count:  parseInt(document.getElementById('spw-fixed-count').value, 10),
  };
}
function updateSpwFixedPreview() {
  const previewEl = document.getElementById('spw-fixed-preview');
  if (!previewEl) return;
  const { amount, count } = readSpwFixedParams();
  if (!amount || amount <= 0 || !count || count <= 0) { previewEl.textContent = ''; return; }
  const from = spwCustomEntries.length + 1, to = spwCustomEntries.length + count;
  const range = count > 1 ? `${sparplanPositionLabel(spwInterval, from)}–${to}` : sparplanPositionLabel(spwInterval, from);
  previewEl.innerHTML = `${range}: ${count} × ${fmtEuro(round2(amount))} = <b>${fmtEuro(round2(amount * count))}</b>`;
}
function applySpwFixedGenerate() {
  const { amount, count } = readSpwFixedParams();
  if (!amount || amount <= 0 || !count || count <= 0) {
    alert('Bitte Betrag und Anzahl angeben.'); return;
  }
  spwCustomEntries.push(...sparplanGenFixed({ amount, count }).map(a => ({ amount: a })));
  spwGeneratorMethodsUsed.add('fixed');
  renderSpwCustomRows();
  showSpwCustomSection('main');
}

// ── "Zufällige Beträge" — Vorschau mit Neu-generieren/Übernehmen.
// Nur ganze Euro (siehe sparplanRandomAmount). ──
function readSpwRandomParams() {
  return {
    min:   parseFloat(document.getElementById('spw-random-min').value),
    max:   parseFloat(document.getElementById('spw-random-max').value),
    count: parseInt(document.getElementById('spw-random-count').value, 10),
    multipleOf: document.getElementById('spw-random-multiple-toggle').checked
      ? parseFloat(document.getElementById('spw-random-multiple').value) || 0
      : 0,
  };
}
function renderSpwRandomPreview() {
  const listEl = document.getElementById('spw-random-preview-list');
  const sumEl  = document.getElementById('spw-random-preview-sum');
  if (!listEl || !sumEl) return;
  listEl.innerHTML = '';
  const baseIndex = spwCustomEntries.length; // Vorschau schließt an bereits vorhandene Raten an
  spwRandomPreview.forEach((amount, i) => {
    const row = document.createElement('div'); row.className = 'sp-detail-entry-row';
    row.innerHTML = `<span>${sparplanPositionLabel(spwInterval, baseIndex + i + 1)}</span><span class="sp-detail-entry-amount">${fmtEuro(amount)}</span>`;
    listEl.appendChild(row);
  });
  const sum = round2(spwRandomPreview.reduce((s, a) => s + a, 0));
  sumEl.innerHTML = `${spwRandomPreview.length} Rate(n) · Summe <b>${fmtEuro(sum)}</b>`;
  document.getElementById('spw-random-preview-wrap').classList.remove('hidden');
}
function applySpwRandomGenerate() {
  const { min, max, count, multipleOf } = readSpwRandomParams();
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= min || !count || count <= 0) {
    alert('Bitte einen gültigen Von/Bis-Betrag und eine Anzahl angeben.'); return;
  }
  spwRandomPreview = sparplanGenRandom({ min, max, count, multipleOf });
  renderSpwRandomPreview();
}

// ── "Aus Vorlage" — Platzhalter, Registry ist bewusst noch leer ──
function renderSpwTemplateList() {
  const wrap = document.getElementById('spw-template-list');
  if (!wrap) return;
  const keys = Object.keys(SP_TEMPLATE_REGISTRY);
  if (keys.length === 0) {
    wrap.innerHTML = '<div class="empty-state">Noch keine Vorlagen verfügbar — kommt in einem späteren Update (z. B. 1-Cent-Challenge, 5-Euro-Schein-Challenge, Münz-Challenge).</div>';
    return;
  }
  wrap.innerHTML = '';
  keys.forEach(key => {
    const tpl = SP_TEMPLATE_REGISTRY[key];
    const item = document.createElement('div'); item.className = 'sp-template-item';
    item.innerHTML = `<span>${tpl.icon || '📋'} ${tpl.label}</span><span class="badge-soon">Bald</span>`;
    wrap.appendChild(item);
  });
}

function openSparplanWizard() {
  spwVariant = null;
  spwMethod  = 'constant';
  spwInterval = 'weekly';
  spwCustomEntries = [];
  spwGeneratorMethodsUsed = new Set();
  spwRandomPreview = [];
  document.getElementById('sparplan-wizard-title').textContent = 'Neuer Sparplan';
  ['spw-target-name','spw-target-amount','spw-target-start','spw-target-end',
   'spw-rate-name','spw-rate-amount','spw-rate-start','spw-rate-end',
   'spw-custom-name',
   'spw-fixed-amount','spw-fixed-count',
   'spw-random-min','spw-random-max','spw-random-count','spw-random-multiple',
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('spw-target-interval').value = 'monthly';
  document.getElementById('spw-rate-interval').value   = 'monthly';
  document.getElementById('spw-target-preview').textContent = '';
  document.getElementById('spw-rate-preview').textContent   = '';
  document.getElementById('spw-fixed-preview').textContent  = '';
  document.getElementById('spw-random-multiple-toggle').checked = false;
  document.getElementById('spw-random-multiple-row').classList.add('hidden');
  document.getElementById('spw-random-preview-wrap').classList.add('hidden');
  document.querySelectorAll('#sparplan-wizard-step-target .toggle-select-btn').forEach(b => b.classList.toggle('active', b.dataset.method === 'constant'));
  document.querySelectorAll('#spw-custom-interval-picker .toggle-select-btn').forEach(b => b.classList.toggle('active', b.dataset.interval === 'weekly'));
  renderSpwCustomRows();
  showSpwCustomSection('main');
  showSpwStep('variant');
  document.getElementById('sparplan-wizard-modal-overlay').classList.remove('hidden');
}
function closeSparplanWizard() {
  document.getElementById('sparplan-wizard-modal-overlay').classList.add('hidden');
}

document.querySelectorAll('.sp-wizard-variant-btn[data-variant]').forEach(btn => {
  btn.addEventListener('click', () => {
    spwVariant = btn.dataset.variant;
    showSpwStep(spwVariant);
    if (spwVariant === 'custom') showSpwCustomSection('main');
  });
});
document.querySelectorAll('#sparplan-wizard-step-target .toggle-select-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#sparplan-wizard-step-target .toggle-select-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    spwMethod = btn.dataset.method;
    updateSpwTargetPreview();
  });
});
['spw-target-amount','spw-target-start','spw-target-end','spw-target-interval'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateSpwTargetPreview);
});
['spw-rate-amount','spw-rate-start','spw-rate-end','spw-rate-interval'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateSpwRatePreview);
});

// Gemeinsames Intervall für den GESAMTEN individuellen Plan. Wirkt sich
// nur auf die Positions-Beschriftung aus ("Woche N" → "Tag N" etc.) —
// bereits vorhandene Raten werden dabei automatisch mit-relabelt, da die
// Beschriftung nie gespeichert, sondern immer aus spwInterval berechnet
// wird (renderSpwCustomRows()).
document.querySelectorAll('#spw-custom-interval-picker .toggle-select-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#spw-custom-interval-picker .toggle-select-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    spwInterval = btn.dataset.interval;
    renderSpwCustomRows();
    updateSpwFixedPreview();
  });
});

// Werkzeugleiste innerhalb "Individuell" — jedes Werkzeug hängt seine
// Einträge an die bestehende Liste an, statt sie zu ersetzen. Beliebig
// oft und in beliebiger Reihenfolge kombinierbar. Positionen ergeben
// sich zentral aus der Listenlänge zum Zeitpunkt des Anhängens.
document.querySelectorAll('#spw-custom-main .sp-wizard-toolbar [data-generator]').forEach(btn => {
  btn.addEventListener('click', () => {
    const gen = btn.dataset.generator;
    if (gen === 'manual') {
      spwCustomEntries.push({ amount: null });
      spwGeneratorMethodsUsed.add('manual');
      renderSpwCustomRows();
    } else if (gen === 'fixed') {
      updateSpwFixedPreview();
      showSpwCustomSection('fixed');
    } else if (gen === 'random') {
      document.getElementById('spw-random-preview-wrap').classList.add('hidden');
      showSpwCustomSection('random');
    } else if (gen === 'template') {
      renderSpwTemplateList();
      showSpwCustomSection('template');
    }
  });
});
document.getElementById('spw-fixed-back').addEventListener('click', () => showSpwCustomSection('main'));
document.getElementById('spw-random-back').addEventListener('click', () => showSpwCustomSection('main'));
document.getElementById('spw-template-back').addEventListener('click', () => showSpwCustomSection('main'));

['spw-fixed-amount','spw-fixed-count'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateSpwFixedPreview);
});
document.getElementById('spw-fixed-generate').addEventListener('click', applySpwFixedGenerate);

document.getElementById('spw-random-multiple-toggle').addEventListener('change', e => {
  document.getElementById('spw-random-multiple-row').classList.toggle('hidden', !e.target.checked);
});
document.getElementById('spw-random-generate').addEventListener('click', applySpwRandomGenerate);
document.getElementById('spw-random-regenerate').addEventListener('click', applySpwRandomGenerate);
document.getElementById('spw-random-apply').addEventListener('click', () => {
  if (!spwRandomPreview.length) return;
  spwCustomEntries.push(...spwRandomPreview.map(amount => ({ amount })));
  spwGeneratorMethodsUsed.add('random');
  renderSpwCustomRows();
  showSpwCustomSection('main');
});

document.getElementById('sparplan-wizard-back').addEventListener('click', () => { spwVariant = null; showSpwStep('variant'); });
document.getElementById('sparplan-wizard-close').addEventListener('click', closeSparplanWizard);
document.getElementById('sparplan-wizard-cancel').addEventListener('click', closeSparplanWizard);
document.getElementById('sparplan-wizard-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('sparplan-wizard-modal-overlay')) closeSparplanWizard();
});

document.getElementById('sparplan-wizard-save').addEventListener('click', () => {
  let plan = null;

  if (spwVariant === 'target') {
    const name   = document.getElementById('spw-target-name').value.trim();
    const amount = parseFloat(document.getElementById('spw-target-amount').value);
    const start  = document.getElementById('spw-target-start').value;
    const end    = document.getElementById('spw-target-end').value;
    const interval = document.getElementById('spw-target-interval').value;
    if (!name || !amount || amount <= 0 || !start || !end || start > end) {
      alert('Bitte Name, Zielbetrag sowie ein gültiges Start- und Zieldatum angeben.'); return;
    }
    const dates   = sparplanGenerateDates(start, end, interval);
    const amounts = sparplanDistribute(dates.length, round2(amount), spwMethod);
    plan = { id: sparplanNewId(), name, image: null, targetAmount: round2(amount),
      startDate: start, endDate: end, interval, method: spwMethod,
      entries: sparplanBuildEntries(dates, amounts), linkedToBudget: false, createdAt: Date.now() };

  } else if (spwVariant === 'rate') {
    const name  = document.getElementById('spw-rate-name').value.trim();
    const rate  = parseFloat(document.getElementById('spw-rate-amount').value);
    const start = document.getElementById('spw-rate-start').value;
    const end   = document.getElementById('spw-rate-end').value;
    const interval = document.getElementById('spw-rate-interval').value;
    if (!name || !rate || rate <= 0 || !start || !end || start > end) {
      alert('Bitte Name, Sparrate sowie ein gültiges Start- und Enddatum angeben.'); return;
    }
    const dates   = sparplanGenerateDates(start, end, interval);
    const amounts = new Array(dates.length).fill(round2(rate));
    plan = { id: sparplanNewId(), name, image: null, targetAmount: null,
      startDate: start, endDate: end, interval, method: 'constant',
      entries: sparplanBuildEntries(dates, amounts), linkedToBudget: false, createdAt: Date.now() };

  } else if (spwVariant === 'custom') {
    const name  = document.getElementById('spw-custom-name').value.trim();
    // KEINE Sortierung — die Array-Reihenfolge IST die Position (Woche 1,
    // Woche 2, ...), es gibt keine Kalenderdaten zum Sortieren.
    const valid = spwCustomEntries.filter(e => e.amount > 0);
    if (!name || valid.length === 0) {
      alert('Bitte einen Namen und mindestens eine gültige Rate angeben.'); return;
    }
    const stamp = Date.now().toString(36);
    // Kein Zielbetrag: die Summe ergibt sich ausschließlich aus den
    // erzeugten/eingetragenen Raten (sparplanTargetAmount() leitet sie
    // bei targetAmount:null automatisch aus entries[] ab). Kein Start-/
    // Enddatum: plan.interval ist das gemeinsame Intervall, anhand dessen
    // sparplanEntryLabel() die Positionen ("Woche N") beschriftet.
    plan = { id: sparplanNewId(), name, image: null, targetAmount: null,
      startDate: null, endDate: null, interval: spwInterval, method: 'custom',
      generatorMethods: [...spwGeneratorMethodsUsed],
      entries: valid.map((e, i) => ({ id: `spe_${stamp}_${i}`, amount: round2(e.amount), done: false })),
      linkedToBudget: false, createdAt: Date.now() };
  }

  if (!plan) return;
  budgetSavingsPlans.push(plan);
  saveBudgetSavingsPlans();
  closeSparplanWizard();
  renderSparplaeneGrid();
});

const spAddPlanBtn = document.getElementById('sparplan-add-plan-btn');
if (spAddPlanBtn) spAddPlanBtn.addEventListener('click', openSparplanWizard);

// =========================
// SPARPLÄNE — DETAILANSICHT
// Stammdaten, Fortschritt, Historie, zukünftige Raten, Bearbeiten,
// Löschen. Jede Rate ist einzeln als erledigt markierbar.
// =========================
let spDetailPlanId  = null;
let spDetailEditing = false;

function openSparplanDetail(id) {
  spDetailPlanId  = id;
  spDetailEditing = false;
  renderSparplanDetailBody();
  document.getElementById('sparplan-detail-modal-overlay').classList.remove('hidden');
}
function closeSparplanDetail() {
  document.getElementById('sparplan-detail-modal-overlay').classList.add('hidden');
  spDetailPlanId = null;
}

function renderSparplanDetailBody() {
  const plan = getSparplanById(spDetailPlanId);
  const body = document.getElementById('sparplan-detail-body');
  if (!plan) { closeSparplanDetail(); return; }

  document.getElementById('sparplan-detail-title').textContent = plan.name;
  const target  = sparplanTargetAmount(plan);
  const current = sparplanCurrentAmount(plan);
  const pct     = sparplanProgressPct(plan);
  const done     = sparplanOrderedEntries(plan, true);
  const upcoming = sparplanOrderedEntries(plan, false);

  // Individuell kann aus mehreren Werkzeugen zusammengesetzt sein
  // (z. B. Fester Betrag + Zufällig) — alle benutzten Werkzeuge werden
  // angezeigt. plan.generatorMethod (Einzahl) bleibt als Fallback für
  // Pläne, die vor dieser Umstellung erzeugt wurden.
  let methodLabel = SP_METHOD_META[plan.method]?.label || plan.method;
  if (plan.method === 'custom') {
    if (Array.isArray(plan.generatorMethods) && plan.generatorMethods.length) {
      methodLabel = plan.generatorMethods.map(m => SP_CUSTOM_GENERATORS[m]?.label || m).join(' + ');
    } else if (plan.generatorMethod && SP_CUSTOM_GENERATORS[plan.generatorMethod]) {
      methodLabel = SP_CUSTOM_GENERATORS[plan.generatorMethod].label;
    }
  }
  const nameField = spDetailEditing
    ? `<input type="text" class="modal-input" id="sp-detail-edit-name" value="${plan.name}" style="max-width:220px;"/>`
    : `<span>${plan.name}</span>`;
  const targetField = (spDetailEditing && typeof plan.targetAmount === 'number')
    ? `<input type="number" class="modal-input" id="sp-detail-edit-target" value="${plan.targetAmount}" step="0.01" min="0" style="max-width:140px;"/>`
    : `<span>${fmtEuro(target)}</span>`;

  // "Individuell" hat keinen Zeitraum (keine Kalenderdaten) — stattdessen
  // die Anzahl der Raten anzeigen.
  const zeitraumRow = plan.method === 'custom'
    ? `<div class="sp-detail-row"><span>Anzahl Raten</span><span>${plan.entries.length}</span></div>`
    : `<div class="sp-detail-row"><span>Zeitraum</span><span>${sparplanFormatDate(plan.startDate)} – ${sparplanFormatDate(plan.endDate)}</span></div>`;

  body.innerHTML = `
    <div class="sp-detail-stammdaten">
      <div class="sp-detail-row"><span>Name</span>${nameField}</div>
      <div class="sp-detail-row"><span>Zielbetrag</span>${targetField}</div>
      ${zeitraumRow}
      <div class="sp-detail-row"><span>Intervall</span><span>${SP_INTERVAL_META[plan.interval]?.label || plan.interval}</span></div>
      <div class="sp-detail-row"><span>Sparart</span><span>${methodLabel}</span></div>
    </div>
    ${spDetailEditing ? `<div class="modal-row" style="flex-direction:row;gap:8px;margin-top:8px;">
        <button class="btn-ghost" id="sp-detail-edit-cancel">Abbrechen</button>
        <button class="btn-primary" id="sp-detail-edit-save">Speichern</button>
      </div>` : ''}

    <div class="budget-goal-bar sp-plan-bar" style="margin-top:14px;"><div class="budget-goal-fill" style="width:${pct}%"></div></div>
    <div class="sp-plan-card-row"><span>${fmtEuro(current)} / ${fmtEuro(target)}</span><span>${pct}%</span></div>

    <div class="sp-detail-section-title">Zukünftige Raten</div>
    <div class="sp-detail-entry-list" id="sp-detail-upcoming">${upcoming.length ? '' : '<div class="empty-state">Keine offenen Raten mehr.</div>'}</div>

    <div class="sp-detail-section-title">Historie</div>
    <div class="sp-detail-entry-list" id="sp-detail-history">${done.length ? '' : '<div class="empty-state">Noch nichts erledigt.</div>'}</div>`;

  if (spDetailEditing) {
    document.getElementById('sp-detail-edit-cancel').addEventListener('click', () => { spDetailEditing = false; renderSparplanDetailBody(); });
    document.getElementById('sp-detail-edit-save').addEventListener('click', () => {
      const newName = document.getElementById('sp-detail-edit-name').value.trim();
      if (newName) plan.name = newName;
      const targetInput = document.getElementById('sp-detail-edit-target');
      if (targetInput) {
        const v = parseFloat(targetInput.value);
        if (v > 0) plan.targetAmount = round2(v);
      }
      saveBudgetSavingsPlans();
      spDetailEditing = false;
      renderSparplanDetailBody();
      renderSparplaeneGrid();
    });
  }

  const upcomingEl = document.getElementById('sp-detail-upcoming');
  upcoming.forEach(e => {
    const row = document.createElement('div'); row.className = 'sp-detail-entry-row';
    row.innerHTML = `<span>${sparplanEntryLabel(plan, e)}</span><span class="sp-detail-entry-amount">${fmtEuro(e.amount)}</span>`;
    const btn = document.createElement('button'); btn.className = 'btn-ghost sp-detail-entry-btn'; btn.textContent = 'Erledigt';
    btn.addEventListener('click', () => { e.done = true; saveBudgetSavingsPlans(); renderSparplanDetailBody(); renderSparplaeneGrid(); });
    row.appendChild(btn);
    upcomingEl.appendChild(row);
  });
  const historyEl = document.getElementById('sp-detail-history');
  done.forEach(e => {
    const row = document.createElement('div'); row.className = 'sp-detail-entry-row sp-detail-entry-row--done';
    row.innerHTML = `<span>${sparplanEntryLabel(plan, e)}</span><span class="sp-detail-entry-amount">${fmtEuro(e.amount)}</span>`;
    const btn = document.createElement('button'); btn.className = 'btn-ghost sp-detail-entry-btn'; btn.textContent = 'Rückgängig';
    btn.addEventListener('click', () => { e.done = false; saveBudgetSavingsPlans(); renderSparplanDetailBody(); renderSparplaeneGrid(); });
    row.appendChild(btn);
    historyEl.appendChild(row);
  });
}

document.getElementById('sparplan-detail-edit-btn').addEventListener('click', () => { spDetailEditing = true; renderSparplanDetailBody(); });
document.getElementById('sparplan-detail-close').addEventListener('click', closeSparplanDetail);
document.getElementById('sparplan-detail-done-btn').addEventListener('click', closeSparplanDetail);
document.getElementById('sparplan-detail-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('sparplan-detail-modal-overlay')) closeSparplanDetail();
});
document.getElementById('sparplan-detail-delete').addEventListener('click', () => {
  if (!spDetailPlanId) return;
  if (!confirm('Diesen Sparplan wirklich löschen?')) return;
  budgetSavingsPlans = budgetSavingsPlans.filter(p => p.id !== spDetailPlanId);
  saveBudgetSavingsPlans();
  closeSparplanDetail();
  renderSparplaeneGrid();
});