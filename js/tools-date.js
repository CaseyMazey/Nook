// =========================
// TOOLS — 9) DATUMSRECHNER
// Zwei Modi: Zeitraum zwischen zwei Daten (Tage, Wochen, Arbeitstage)
// und Datum ± Tage/Arbeitstage. Arbeitstage = Mo–Fr ohne gesetzliche
// Feiertage des im Kalender gewählten Bundeslands — gelesen über
// getHolidaysForYear() aus calendar.js (nur lesen, keine Termine anlegen).
// Benötigt tools.js (Karten-Raster) zuvor geladen.
// =========================

let toolsDateState = Object.assign({ mode: 'between', from: '', to: '', base: '', amount: 10, unit: 'days', inclusive: false }, DB.get('toolsDateState', {}));
function saveToolsDateState() { DB.set('toolsDateState', toolsDateState); }

function toolsDateCardHtml() {
  return `
    <div class="tool-card" id="tool-date">
      <div class="tool-card-header">
        <span class="tool-card-icon">📅</span>
        <span class="tool-card-title">Datumsrechner</span>
      </div>
      <div class="tool-card-body">
        <div class="tool-mode-group" role="group" aria-label="Modus">
          <button class="tool-mode-btn" data-date-mode="between">Zeitraum</button>
          <button class="tool-mode-btn" data-date-mode="add">Datum ± Tage</button>
        </div>
        <div class="td-fields" id="td-between">
          <label class="conv-label">Von<input type="date" class="modal-date" id="td-from"></label>
          <label class="conv-label">Bis<input type="date" class="modal-date" id="td-to"></label>
          <label class="td-check"><input type="checkbox" id="td-inclusive"> Enddatum mitzählen</label>
        </div>
        <div class="td-fields hidden" id="td-add">
          <label class="conv-label">Ausgangsdatum<input type="date" class="modal-date" id="td-base"></label>
          <div class="conv-input-group">
            <input type="number" class="modal-input" id="td-amount" step="1">
            <select class="conv-unit-select" id="td-unit">
              <option value="days">Tage</option>
              <option value="workdays">Arbeitstage</option>
              <option value="weeks">Wochen</option>
              <option value="months">Monate</option>
            </select>
          </div>
          <div class="td-hint">Negative Zahl = zurückrechnen</div>
        </div>
        <div class="td-result" id="td-result"></div>
      </div>
    </div>`;
}

function tdParse(str) { return str ? parseLocalDate(str) : null; }
function tdFmt(d) { return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }); }

// Gesetzliche Feiertage (Heiligabend/Silvester sind keine) als Set von dateKeys
const tdHolidayCache = {};
function tdHolidays(year) {
  if (typeof getHolidaysForYear !== 'function') return new Set();
  const bl = (typeof calendarSettings !== 'undefined' && calendarSettings) ? calendarSettings.bundesland : null;
  const key = `${year}-${bl}`;
  if (!tdHolidayCache[key]) {
    tdHolidayCache[key] = new Set(getHolidaysForYear(year, bl)
      .filter(h => h.label !== 'Heiligabend' && h.label !== 'Silvester')
      .map(h => dateKey(h.date)));
  }
  return tdHolidayCache[key];
}
function tdIsWorkday(d) {
  const wd = d.getDay();
  return wd !== 0 && wd !== 6 && !tdHolidays(d.getFullYear()).has(dateKey(d));
}

function tdDaysBetween(a, b) {
  // über UTC rechnen, damit die Zeitumstellung keinen Tag verschluckt
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

function tdRenderBetween() {
  const a = tdParse(toolsDateState.from), b = tdParse(toolsDateState.to);
  if (!a || !b) return '<div class="sn-note">Zwei Daten wählen.</div>';
  const sign = tdDaysBetween(a, b) < 0 ? -1 : 1;
  const [start, end] = sign < 0 ? [b, a] : [a, b];
  let days = tdDaysBetween(start, end) + (toolsDateState.inclusive ? 1 : 0);
  let workdays = 0, holidays = 0;
  const cur = new Date(start);
  const stop = new Date(end); if (toolsDateState.inclusive) stop.setDate(stop.getDate() + 1);
  let guard = 0;
  while (cur < stop && guard++ < 40000) {
    const wd = cur.getDay();
    if (wd !== 0 && wd !== 6) { if (tdHolidays(cur.getFullYear()).has(dateKey(cur))) holidays++; else workdays++; }
    cur.setDate(cur.getDate() + 1);
  }
  const weeks = Math.floor(days / 7), rest = days % 7;
  const todayNote = dateKey(a) === dateKey(new Date()) && sign > 0 ? `<div class="sn-note">Noch ${days} ${days === 1 ? 'Tag' : 'Tage'} bis ${tdFmt(b)}.</div>` : '';
  return `
    <div class="td-big">${(sign * days).toLocaleString('de-DE')} ${Math.abs(days) === 1 ? 'Tag' : 'Tage'}</div>
    <div class="sn-grid">
      ${snRow('Wochen', `${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}${rest ? ` + ${rest} ${rest === 1 ? 'Tag' : 'Tage'}` : ''}`, false)}
      ${snRow('Arbeitstage', `${workdays.toLocaleString('de-DE')} (Mo–Fr${holidays ? `, ${holidays} Feiertag${holidays === 1 ? '' : 'e'} abgezogen` : ''})`, false)}
      ${snRow('Monate (ca.)', (days / 30.4375).toLocaleString('de-DE', { maximumFractionDigits: 1 }), false)}
    </div>
    ${todayNote}
    ${typeof getHolidaysForYear === 'function' ? '' : '<div class="sn-note">Feiertage nicht verfügbar.</div>'}`;
}

function tdRenderAdd() {
  const base = tdParse(toolsDateState.base);
  const n = parseInt(toolsDateState.amount, 10);
  if (!base || isNaN(n)) return '<div class="sn-note">Datum und Anzahl eingeben.</div>';
  const d = new Date(base);
  if (toolsDateState.unit === 'days') d.setDate(d.getDate() + n);
  else if (toolsDateState.unit === 'weeks') d.setDate(d.getDate() + n * 7);
  else if (toolsDateState.unit === 'months') {
    const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    // Monatsende: 31.01. + 1 Monat = 28./29.02., nicht 03.03.
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else {
    const step = n < 0 ? -1 : 1;
    let left = Math.abs(n), guard = 0;
    while (left > 0 && guard++ < 40000) { d.setDate(d.getDate() + step); if (tdIsWorkday(d)) left--; }
  }
  return `<div class="td-big">${tdFmt(d)}</div>
    <div class="sn-note">KW ${tdIsoWeek(d)} · ${tdDaysBetween(new Date(), d) === 0 ? 'heute' : tdDaysBetween(new Date(), d) > 0 ? `in ${tdDaysBetween(new Date(), d)} Tagen` : `vor ${-tdDaysBetween(new Date(), d)} Tagen`}${tdIsWorkday(d) ? '' : ' · kein Arbeitstag'}</div>`;
}

function tdIsoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

function renderDateCalc() {
  const res = document.getElementById('td-result');
  if (!res) return;
  const between = toolsDateState.mode === 'between';
  document.querySelectorAll('#tool-date [data-date-mode]').forEach(b => b.classList.toggle('active', b.dataset.dateMode === toolsDateState.mode));
  document.getElementById('td-between').classList.toggle('hidden', !between);
  document.getElementById('td-add').classList.toggle('hidden', between);
  res.innerHTML = between ? tdRenderBetween() : tdRenderAdd();
}

function initDateCalculator() {
  const today = dateKey(new Date());
  if (!toolsDateState.from) toolsDateState.from = today;
  if (!toolsDateState.base) toolsDateState.base = today;
  const bind = (id, key, ev = 'input', get = el => el.value) => {
    const el = document.getElementById(id);
    if (el.type === 'checkbox') el.checked = !!toolsDateState[key]; else el.value = toolsDateState[key];
    el.addEventListener(ev, () => { toolsDateState[key] = get(el); saveToolsDateState(); renderDateCalc(); });
  };
  bind('td-from', 'from');
  bind('td-to', 'to');
  bind('td-inclusive', 'inclusive', 'change', el => el.checked);
  bind('td-base', 'base');
  bind('td-amount', 'amount');
  bind('td-unit', 'unit', 'change');
  document.querySelectorAll('#tool-date [data-date-mode]').forEach(b => b.addEventListener('click', () => {
    toolsDateState.mode = b.dataset.dateMode;
    saveToolsDateState();
    renderDateCalc();
  }));
  renderDateCalc();
}
