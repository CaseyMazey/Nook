// =========================
// TODAY — Fortschritts-Tracker (z.B. „Ausbildung: 64 / 156 Wochen“)
// Kleine Zeile im Begrüßungsbereich der Heute-Seite: wie weit ein selbst
// benannter Zeitraum (Start- bis Enddatum) schon vorangeschritten ist.
// Ein-/ausschalten und Einrichten unter Einstellungen > Heute-Seite.
// Lädt nach today.js (nutzt dessen Kopfbereich #today-greeting-block).
// Eigener Key: todayTracker (settings.js: NOOK_DATA_GROUPS „Heute“).
// =========================

let todayTracker = DB.get('todayTracker', { enabled: false, label: 'Ausbildung', start: '', end: '' });
function saveTodayTracker() { DB.set('todayTracker', todayTracker); }

const TRACKER_DAY_MS = 86400000;

// Fortschritt in ganzen Tagen; ab 8 Wochen Gesamtdauer in Wochen angezeigt
// (Monate wären ungleich lang und damit ungenau).
function computeTodayTracker(t) {
  if (!t.start || !t.end) return null;
  const start = parseLocalDate(t.start);
  const end   = parseLocalDate(t.end);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const totalDays = Math.round((end - start) / TRACKER_DAY_MS);
  if (totalDays <= 0) return null;
  const doneDays = Math.max(0, Math.min(totalDays, Math.round((today - start) / TRACKER_DAY_MS)));
  const pct = Math.round(doneDays / totalDays * 100);
  const inWeeks = totalDays >= 56;
  const done  = inWeeks ? Math.floor(doneDays / 7) : doneDays;
  const total = inWeeks ? Math.round(totalDays / 7) : totalDays;
  return {
    pct, done, total,
    unit: inWeeks ? 'Wochen' : 'Tage',
    notStarted: today < start,
    finished: today >= end,
  };
}

function renderTodayTracker() {
  const block = document.getElementById('today-greeting-block');
  if (!block) return;
  let el = document.getElementById('today-tracker');
  const data = todayTracker.enabled ? computeTodayTracker(todayTracker) : null;
  if (!data) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'today-tracker';
    el.className = 'today-tracker';
    // direkt unter dem Datum, vor der Wochen-Navigation
    const sub = document.getElementById('today-subtitle');
    sub ? sub.after(el) : block.appendChild(el);
  }
  const label = todayTracker.label || 'Fortschritt';
  const count = data.finished ? 'abgeschlossen 🎉'
    : data.notStarted ? `startet am ${parseLocalDate(todayTracker.start).toLocaleDateString('de-DE')}`
    : `${data.done} / ${data.total} ${data.unit}`;
  el.innerHTML = `
    <div class="today-tracker-text">
      <span class="today-tracker-label"></span>
      <span class="today-tracker-count"></span>
    </div>
    <div class="today-tracker-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${data.pct}">
      <span style="width:${data.pct}%"></span>
    </div>
    <span class="today-tracker-pct">${data.pct}%</span>`;
  el.querySelector('.today-tracker-label').textContent = label;
  el.querySelector('.today-tracker-count').textContent = count;
  el.title = `${label}: ${parseLocalDate(todayTracker.start).toLocaleDateString('de-DE')} – ${parseLocalDate(todayTracker.end).toLocaleDateString('de-DE')}`;
}

// ── Einstellungen (Heute-Seite) ──────────────────────────────────────────
function renderTodayTrackerSettings() {
  const toggle = document.getElementById('setting-tracker-enabled');
  if (!toggle) return;
  toggle.checked = !!todayTracker.enabled;
  document.getElementById('setting-tracker-label').value = todayTracker.label || '';
  document.getElementById('setting-tracker-start').value = todayTracker.start || '';
  document.getElementById('setting-tracker-end').value   = todayTracker.end || '';
  document.getElementById('tracker-settings-fields').classList.toggle('hidden', !todayTracker.enabled);
  const hint = document.getElementById('tracker-settings-hint');
  const invalid = todayTracker.enabled && todayTracker.start && todayTracker.end && !computeTodayTracker(todayTracker);
  hint.classList.toggle('hidden', !invalid);
}

function updateTodayTrackerFromSettings() {
  todayTracker = {
    enabled: document.getElementById('setting-tracker-enabled').checked,
    label: document.getElementById('setting-tracker-label').value.trim(),
    start: document.getElementById('setting-tracker-start').value,
    end:   document.getElementById('setting-tracker-end').value,
  };
  saveTodayTracker();
  renderTodayTrackerSettings();
  renderTodayTracker();
}

['setting-tracker-enabled', 'setting-tracker-start', 'setting-tracker-end'].forEach(id =>
  document.getElementById(id)?.addEventListener('change', updateTodayTrackerFromSettings));
document.getElementById('setting-tracker-label')?.addEventListener('input', updateTodayTrackerFromSettings);

renderTodayTracker();
