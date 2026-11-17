// =========================
// TODAY — Bereiche ein-/ausblenden (Einstellungen › Heute-Seite)
// Ein Schalter pro fester Heute-Karte (Wetter, Zeitblöcke, Aufgaben,
// Speiseplan …). Ausgeblendet wird nur per Klasse .today-widget-off —
// die Daten und Funktionen der Karten bleiben unberührt (z.B. lädt das
// Wetter weiter, weil auch das Wetter-Theme es braucht).
// Karten mit eigenem Schalter (Termine, Budget, Lernplan, Rückblick,
// Willkommen, Eine Zeile, Fortschritt) stehen hier bewusst nicht drin.
// Manche Karten entstehen erst später (Speiseplan, Pflichten, „Heute ist“)
// — ein MutationObserver blendet sie beim Erscheinen sofort aus.
// Lädt nach today.js (TODAY_RIGHT_STACKS) und den Today-Teildateien.
// Key: todayHiddenWidgets (Array der Bereichs-IDs unten).
// =========================

const TODAY_VISIBILITY_AREAS = [
  { id: 'weather',   label: 'Wetter',            sub: 'Temperatur und Wetter oben im Banner', selectors: ['#today-weather'] },
  { id: 'blocks',    label: 'Zeitblöcke',        sub: 'Stundenplan des Tages mit Fortschritt und Fokus-Knopf', selectors: ['#today-blocks-section'] },
  { id: 'tasks',     label: 'Aufgaben der Woche', sub: 'Wochenaufgaben (auf dem Handy als Kachel)', selectors: ['#panel-tasks', '#today-tasks-tile'] },
  { id: 'duties',    label: 'Gruppenpflichten',  sub: 'Pflichten der aktuellen Kalenderwoche', selectors: ['#gd-widget'] },
  { id: 'clock',     label: 'Uhr',               sub: 'Uhr in der rechten Spalte', selectors: ['#clock-sidebar-panel'] },
  { id: 'quicknote', label: 'Schnellnotiz',      sub: 'Notizfeld mit Brain Dump und „Ablegen“', selectors: ['#panel-quicknote'] },
  { id: 'minical',   label: 'Mini-Kalender',     sub: 'Monatsübersicht mit Terminen', selectors: ['#today-mini-cal'] },
  { id: 'mealplan',  label: 'Speiseplan',        sub: 'Essen des Tages aus dem importierten PDF', selectors: ['#mealplan-widget'] },
  { id: 'dayinfo',   label: '„Heute ist“',       sub: 'Kuriose Aktionstage zum heutigen Datum', selectors: ['#national-day-widget'] },
];

let todayHiddenWidgets = DB.get('todayHiddenWidgets', []);
if (!Array.isArray(todayHiddenWidgets)) todayHiddenWidgets = [];
function saveTodayHiddenWidgets() { DB.set('todayHiddenWidgets', todayHiddenWidgets); }

function isTodayAreaHidden(id) { return todayHiddenWidgets.includes(id); }

function applyTodayVisibility() {
  TODAY_VISIBILITY_AREAS.forEach(area => {
    const off = isTodayAreaHidden(area.id);
    area.selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el && el.classList.contains('today-widget-off') !== off) el.classList.toggle('today-widget-off', off);
    });
  });

  // Rechte Spalte: leere Stapel/leere Spalte nicht als Lücke stehen lassen.
  // data-visible-stacks steuert das Layout in css/today.css.
  const layout = document.getElementById('today-layout');
  const right = document.getElementById('today-right');
  if (!layout || !right) return;
  const stacks = [...right.querySelectorAll(':scope > .today-right-stack')];
  let visible = 0;
  stacks.forEach(stack => {
    const has = [...stack.children].some(c => !c.classList.contains('today-widget-off'));
    if (stack.classList.contains('today-stack-empty') === has) stack.classList.toggle('today-stack-empty', !has);
    if (has) visible++;
  });
  const val = String(visible);
  if (layout.dataset.visibleStacks !== val) layout.dataset.visibleStacks = val;
}

function setTodayAreaHidden(id, hidden) {
  todayHiddenWidgets = todayHiddenWidgets.filter(x => x !== id);
  if (hidden) todayHiddenWidgets.push(id);
  saveTodayHiddenWidgets();
  applyTodayVisibility();
}

function renderTodayVisibilitySettings() {
  const box = document.getElementById('today-visibility-list');
  if (!box) return;
  box.innerHTML = TODAY_VISIBILITY_AREAS.map(area => `
    <div class="settings-row">
      <div><div class="settings-row-title">${escHtml(area.label)}</div><div class="settings-row-sub">${escHtml(area.sub)}</div></div>
      <label class="toggle"><input type="checkbox" data-today-area="${area.id}" aria-label="${escHtml(area.label)} anzeigen"${isTodayAreaHidden(area.id) ? '' : ' checked'}/><span class="toggle-slider"></span></label>
    </div>`).join('');
}

document.getElementById('today-visibility-list')?.addEventListener('change', e => {
  const id = e.target?.dataset?.todayArea;
  if (id) setTodayAreaHidden(id, !e.target.checked);
});

(function initTodayVisibility() {
  const view = document.getElementById('view-today');
  if (!view) return;
  applyTodayVisibility();
  // Später erzeugte Karten (Speiseplan, Pflichten, „Heute ist“ …)
  new MutationObserver(applyTodayVisibility).observe(view, { childList: true, subtree: true });
})();
