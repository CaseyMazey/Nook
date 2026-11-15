// =========================
// TODAY — „Lernplan“ (nur lesend)
// Zeile im Begrüßungsbereich für Prüfungen und Themen mit verbundenem
// Countdown (Karteikarten → Prüfung → Prüfungstermin oder „Countdown verbinden“):
// das heutige Tagesziel aus dem vorhandenen Prüfungsplan (flashcards-study.js:
// fcLinkedCountdown, fcPlanFor). Ein Klick startet genau diese Tagesziel-Runde.
// Lädt nach flashcards*.js und today.js.
// Eigener Key: todayLernplan (settings.js: NOOK_DATA_GROUPS „Heute“).
// =========================

let todayLernplan = DB.get('todayLernplan', true);
function saveTodayLernplan() { DB.set('todayLernplan', todayLernplan); }

const TODAY_LERNPLAN_DAYS = 30; // Prüfungen weiter weg erscheinen noch nicht
const TODAY_LERNPLAN_MAX = 2;

// → [{ subj, obj, groupIds, info, item, plan }] nach Nähe sortiert.
function todayLernplanItems() {
  if (typeof subjects === 'undefined' || typeof fcLinkedCountdown !== 'function' || typeof fcPlanFor !== 'function') return [];
  const out = [];
  subjects.forEach(subj => {
    if (typeof isSubjectArchived === 'function' && isSubjectArchived(subj)) return;
    (subj.exams || []).forEach(exam => {
      const item = fcLinkedCountdown(exam);
      if (!item || item.daysLeft > TODAY_LERNPLAN_DAYS) return;
      const groups = subj.groups.filter(g => exam.groupIds.includes(g.id));
      const cards = (typeof uniqueCardsByFront === 'function' ? uniqueCardsByFront : x => x)(groups.flatMap(g => g.cards));
      if (!cards.length) return;
      out.push({ subj, obj: exam, groupIds: exam.groupIds, info: { id: exam.id, name: exam.name }, item, plan: fcPlanFor(cards, item) });
    });
    subj.groups.forEach(g => {
      const item = fcLinkedCountdown(g);
      if (!item || item.daysLeft > TODAY_LERNPLAN_DAYS || !g.cards.length) return;
      out.push({ subj, obj: g, groupIds: [g.id], info: null, item, plan: fcPlanFor(g.cards, item) });
    });
  });
  return out.sort((a, b) => a.item.daysLeft - b.item.daysLeft);
}

function renderTodayLernplan() {
  const block = document.getElementById('today-greeting-block');
  if (!block) return;
  let el = document.getElementById('today-lernplan');
  const hidden = typeof hiddenTabs !== 'undefined' && hiddenTabs.includes('flashcards');
  const items = todayLernplan && !hidden ? todayLernplanItems().slice(0, TODAY_LERNPLAN_MAX) : [];
  if (!items.length) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'today-lernplan';
    el.className = 'today-budget-due today-lernplan';
    const anchor = document.getElementById('today-subtitle');
    anchor ? anchor.after(el) : block.appendChild(el);
  }
  const days = n => (typeof fcDaysText === 'function' ? fcDaysText(n) : `noch ${n} Tage`);
  el.innerHTML = `<span class="today-budget-due-label">📚 Lernplan</span>` + items.map((x, i) => {
    const done = Math.min(x.plan.done, x.plan.target);
    const state = x.plan.ids.length
      ? `heute <b>${done} von ${x.plan.target}</b>`
      : `<b>✓ Tagesziel geschafft</b>`;
    return `<button type="button" class="today-lernplan-item" data-i="${i}" title="${x.plan.ids.length ? 'Tagesziel jetzt lernen' : 'In den Karteikarten öffnen'}">
      <span>${escHtml(x.obj.name)} · ${days(x.item.daysLeft)}: ${state}</span></button>`;
  }).join('');
  el.querySelectorAll('.today-lernplan-item').forEach(btn => btn.addEventListener('click', () => {
    const x = items[+btn.dataset.i];
    showView('flashcards');
    if (x.plan.ids.length && typeof startGroupsLearnSession === 'function') {
      startGroupsLearnSession(x.subj.id, x.groupIds, x.info, { mode: 'plan', cardIds: x.plan.ids });
    }
  }));
}

// ── Einstellungen (Heute-Seite) ──────────────────────────────────────────
function renderTodayLernplanSettings() {
  const t = document.getElementById('setting-today-lernplan');
  if (t) t.checked = !!todayLernplan;
}
document.getElementById('setting-today-lernplan')?.addEventListener('change', e => {
  todayLernplan = e.target.checked;
  saveTodayLernplan();
  renderTodayLernplan();
});

renderTodayLernplan();
