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
const TODAY_LERNPLAN_MAX = 1; // nur die nächste Prüfung — der Kopf soll ruhig bleiben

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

// Ein kleiner Chip in der gemeinsamen Info-Zeile (today-budget.js: todayInfoRow).
function renderTodayLernplan() {
  let el = document.getElementById('today-lernplan');
  const hidden = typeof hiddenTabs !== 'undefined' && hiddenTabs.includes('flashcards');
  const all = todayLernplan && !hidden ? todayLernplanItems() : [];
  const x = all[0];
  const tidy = () => { if (typeof todayInfoRowTidy === 'function') todayInfoRowTidy(); };
  if (!x || typeof todayInfoRow !== 'function') { el?.remove(); tidy(); return; }
  const row = todayInfoRow();
  if (!row) return;
  if (!el) {
    el = document.createElement('button');
    el.type = 'button';
    el.id = 'today-lernplan';
    el.className = 'today-chip';
    row.prepend(el);
  }
  const days = n => (typeof fcDaysText === 'function' ? fcDaysText(n) : `noch ${n} Tage`);
  const done = Math.min(x.plan.done, x.plan.target);
  const more = all.length > 1 ? ` (+${all.length - 1} weitere Prüfung${all.length > 2 ? 'en' : ''} mit Termin)` : '';
  el.title = (x.plan.ids.length
    ? `Lernplan: ${x.obj.name}, ${days(x.item.daysLeft)}. Heute ${done} von ${x.plan.target} Karten. Klick startet das Tagesziel.`
    : `Lernplan: ${x.obj.name}, ${days(x.item.daysLeft)}. Tagesziel geschafft.`) + more;
  el.innerHTML = x.plan.ids.length
    ? `📚 ${escHtml(x.obj.name)} · <b>${done}/${x.plan.target}</b> heute`
    : `📚 ${escHtml(x.obj.name)} · <b>✓</b>`;
  el.onclick = () => {
    showView('flashcards');
    if (x.plan.ids.length && typeof startGroupsLearnSession === 'function') {
      startGroupsLearnSession(x.subj.id, x.groupIds, x.info, { mode: 'plan', cardIds: x.plan.ids });
    }
  };
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
