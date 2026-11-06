// =========================
// TODAY — Heutige Termine (nur lesend)
// Kleine Zeile im Begrüßungsbereich mit den Terminen von heute aus dem
// Kalender (Einzel-, Mehrtages- und Serientermine, Google-Spiegel) — wie
// „Heute fällig“ beim Budget (today-budget.js). Bewusst KEINE Kalender-
// funktion auf der Heute-Seite (today.md: „den Kalender nicht ersetzen“):
// kein Bearbeiten hier, ein Klick öffnet das Tagesfenster des Kalenders.
// Lädt nach calendar.js (getEventsForDay, openCalDayModal) und today.js.
// Eigener Key: todayEventsDue (settings.js: NOOK_DATA_GROUPS „Heute“).
// =========================

let todayEventsDue = DB.get('todayEventsDue', true);
function saveTodayEventsDue() { DB.set('todayEventsDue', todayEventsDue); }

const TODAY_EVENTS_MAX = 4;

function todayEventsItems() {
  if (typeof getEventsForDay !== 'function') return [];
  const seen = new Set();
  return getEventsForDay(new Date())
    .filter(({ ev }) => {
      const id = ev.id || ev.googleEventId || ev.title;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(({ ev, isRange, isRecurring }) => ({
      title: ev.title || 'Termin',
      time: !isRange && ev.time ? ev.time : '',
      color: ev.color || (typeof DEFAULT_EVENT_COLOR !== 'undefined' ? DEFAULT_EVENT_COLOR : ''),
      recurring: !!isRecurring,
    }))
    // mit Uhrzeit zuerst, nach Uhrzeit; ganztägige danach
    .sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || a.time.localeCompare(b.time));
}

function renderTodayEventsDue() {
  const block = document.getElementById('today-greeting-block');
  if (!block) return;
  let el = document.getElementById('today-events-due');
  const hiddenCal = typeof hiddenTabs !== 'undefined' && hiddenTabs.includes('calendar');
  const items = todayEventsDue && !hiddenCal ? todayEventsItems() : [];
  if (!items.length) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('button');
    el.type = 'button';
    el.id = 'today-events-due';
    el.className = 'today-events-due';
    el.title = 'Tag im Kalender öffnen';
    el.addEventListener('click', () => {
      const d = new Date();
      if (typeof openCalDayModal === 'function') openCalDayModal(dateKey(d), d);
    });
    // unter Datum bzw. Fortschritts-Tracker, vor „Heute fällig“
    const anchor = document.getElementById('today-tracker') || document.getElementById('today-subtitle');
    anchor ? anchor.after(el) : block.appendChild(el);
  }
  const shown = items.slice(0, TODAY_EVENTS_MAX);
  const more = items.length - shown.length;
  el.innerHTML = `<span class="today-events-due-label">📅 Heute</span>` + shown.map(i =>
    `<span class="today-events-due-item"><span class="today-events-due-dot" style="background:${escHtml(i.color)}"></span>${i.time ? `<i>${escHtml(i.time)}</i>` : ''}<span>${escHtml((i.recurring ? '↻ ' : '') + i.title)}</span></span>`).join('')
    + (more > 0 ? `<span class="today-events-due-label">+${more}</span>` : '');
}

// ── Einstellungen (Heute-Seite) ──────────────────────────────────────────
function renderTodayEventsDueSettings() {
  const toggle = document.getElementById('setting-today-events-due');
  if (toggle) toggle.checked = !!todayEventsDue;
}
document.getElementById('setting-today-events-due')?.addEventListener('change', e => {
  todayEventsDue = e.target.checked;
  saveTodayEventsDue();
  renderTodayEventsDue();
});

renderTodayEventsDue();
