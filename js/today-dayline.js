// =========================
// TODAY — Eine Zeile pro Tag (winziges Tagebuch)
// Ein Satz und optional ein Wetter-Symbol für die Stimmung. Ab 17 Uhr steht
// das Feld offen, vorher nur als kleine Zeile, damit der Morgen ruhig bleibt.
// Gibt es einen Eintrag von heute vor einem Jahr, steht er klein darüber.
// Keine Serie, keine Erinnerung, keine Auswertung — die Symbole fließen nur
// ins Jahresbuch ein (js/today-yearbook.js).
// Lädt nach today.js (Platz in der rechten Spalte, TODAY_RIGHT_STACKS).
// Keys: dayLines { 'YYYY-MM-DD': { text, mood } } (mood 1–5 oder null),
//       dayLineOn (an/aus). Reiner Teil (NookDayline): tests/today-dayline.test.js.
// =========================

const NookDayline = (() => {
  const MAX_LEN = 200;
  const OPEN_FROM_HOUR = 17;
  // Wetter statt Gesichter: 1 = trüb … 5 = sonnig
  const MOODS = [
    { v: 1, icon: '🌧', label: 'Regnerisch' },
    { v: 2, icon: '☁️', label: 'Bewölkt' },
    { v: 3, icon: '⛅', label: 'Gemischt' },
    { v: 4, icon: '🌤', label: 'Freundlich' },
    { v: 5, icon: '☀️', label: 'Sonnig' },
  ];
  const pad = n => String(n).padStart(2, '0');

  // Heute vor einem Jahr; der 29. Februar wird zum 28.
  function yearAgo(today) {
    const [y, m, d] = today.split('-').map(Number);
    const last = new Date(y - 1, m, 0).getDate();
    return `${y - 1}-${pad(m)}-${pad(Math.min(d, last))}`;
  }

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  }

  // Eintrag setzen/ändern → neues Objekt; ohne Text und Symbol fällt er weg
  function setEntry(lines, date, patch) {
    const out = { ...(lines || {}) };
    const cur = out[date] || { text: '', mood: null };
    const next = { ...cur, ...patch };
    next.text = clean(next.text);
    next.mood = MOODS.some(m => m.v === next.mood) ? next.mood : null;
    if (!next.text && !next.mood) delete out[date];
    else out[date] = next;
    return out;
  }

  // Nach Monaten gruppiert, neueste zuerst: [{ month: 'YYYY-MM', entries: [{ date, text, mood }] }]
  function byMonth(lines) {
    const groups = new Map();
    Object.keys(lines || {}).sort().reverse().forEach(date => {
      const month = date.slice(0, 7);
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month).push({ date, ...lines[date] });
    });
    return [...groups].map(([month, entries]) => ({ month, entries }));
  }

  const moodIcon = v => (MOODS.find(m => m.v === v) || {}).icon || '';

  return { MAX_LEN, OPEN_FROM_HOUR, MOODS, yearAgo, clean, setEntry, byMonth, moodIcon };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NookDayline;

// =========================
// ANZEIGE (nur im Browser)
// =========================
if (typeof document !== 'undefined') (function initDayline() {
  let dayLineOn = DB.get('dayLineOn', true);
  let dayLines = DB.get('dayLines', {});
  if (!dayLines || typeof dayLines !== 'object' || Array.isArray(dayLines)) dayLines = {};
  const saveDayLines = () => DB.set('dayLines', dayLines);
  let expandedDay = null; // vor 17 Uhr per Klick geöffnet (nur für diesen Tag)
  let saveTimer = null;

  const longDate = iso => fmt(parseLocalDate(iso), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  function moodButtons(cur, attr) {
    return NookDayline.MOODS.map(m => `<button type="button" class="dayline-mood${cur === m.v ? ' active' : ''}" ${attr}="${m.v}" title="${m.label}" aria-label="${m.label}" aria-pressed="${cur === m.v}">${m.icon}</button>`).join('');
  }

  window.renderTodayDayline = function () {
    const sidebar = document.getElementById('today-right');
    if (!sidebar) return;
    let el = document.getElementById('today-dayline');
    if (!dayLineOn) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'today-dayline';
      el.className = 'panel today-dayline';
      sidebar.appendChild(el);
    }
    const today = dateKey(new Date());
    const entry = dayLines[today] || null;
    const ago = dayLines[NookDayline.yearAgo(today)];
    const open = !!entry || expandedDay === today || new Date().getHours() >= NookDayline.OPEN_FROM_HOUR;
    // Beim Tippen nicht neu zeichnen (Fokus und Cursor bleiben)
    if (el.contains(document.activeElement) && document.activeElement.id === 'dayline-input') return;

    el.innerHTML = `
      <div class="panel-header">
        <span class="panel-label">Eine Zeile</span>
        <button type="button" class="icon-btn dayline-all-btn" id="dayline-all" title="Alle Zeilen" aria-label="Alle Zeilen anzeigen">📖</button>
      </div>
      <div class="dayline-body">
        ${ago ? `<div class="dayline-ago"><span>Heute vor einem Jahr${ago.mood ? ' ' + NookDayline.moodIcon(ago.mood) : ''}:</span> ${escHtml(ago.text || '')}</div>` : ''}
        ${open ? `
          <textarea id="dayline-input" class="dayline-input" rows="2" maxlength="${NookDayline.MAX_LEN}" placeholder="Wie war dein Tag? (ein Satz)" aria-label="Eine Zeile über heute">${escHtml(entry ? entry.text : '')}</textarea>
          <div class="dayline-moods" role="group" aria-label="Wie war der Tag?">${moodButtons(entry ? entry.mood : null, 'data-mood')}</div>`
        : `<button type="button" class="dayline-open" id="dayline-open">✎ Eine Zeile für heute</button>`}
      </div>`;

    el.querySelector('#dayline-all').addEventListener('click', () => openDaylineList());
    el.querySelector('#dayline-open')?.addEventListener('click', () => {
      expandedDay = today;
      window.renderTodayDayline();
      document.getElementById('dayline-input')?.focus();
    });
    const input = el.querySelector('#dayline-input');
    input?.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { dayLines = NookDayline.setEntry(dayLines, today, { text: input.value }); saveDayLines(); }, 400);
    });
    input?.addEventListener('blur', () => {
      clearTimeout(saveTimer);
      dayLines = NookDayline.setEntry(dayLines, today, { text: input.value });
      saveDayLines();
    });
    el.querySelectorAll('[data-mood]').forEach(b => b.addEventListener('click', () => {
      const v = Number(b.dataset.mood);
      const cur = dayLines[today] ? dayLines[today].mood : null;
      dayLines = NookDayline.setEntry(dayLines, today, { text: input ? input.value : '', mood: cur === v ? null : v });
      saveDayLines();
      window.renderTodayDayline();
    }));
  };

  // =========================
  // ALLE ZEILEN — schlichte Liste nach Monaten, zum Lesen und Bearbeiten
  // =========================
  const listModal = wireModal('dayline-modal-overlay', { closeIds: ['dayline-modal-close', 'dayline-modal-done'] });

  function renderDaylineList(focusDate) {
    const box = document.getElementById('dayline-modal-list');
    if (!box) return;
    const groups = NookDayline.byMonth(dayLines);
    box.innerHTML = groups.length ? groups.map(g => `
      <div class="dayline-month">
        <div class="dayline-month-name">${escHtml(fmt(parseLocalDate(g.month + '-01'), { month: 'long', year: 'numeric' }))}</div>
        ${g.entries.map(e => `
          <div class="dayline-entry" data-date="${e.date}">
            <div class="dayline-entry-head">
              <span class="dayline-entry-date">${escHtml(longDate(e.date))}</span>
              <span class="dayline-entry-moods">${moodButtons(e.mood, 'data-entry-mood')}</span>
            </div>
            <textarea class="modal-textarea dayline-entry-input" rows="1" maxlength="${NookDayline.MAX_LEN}" aria-label="Zeile vom ${escHtml(longDate(e.date))}">${escHtml(e.text || '')}</textarea>
          </div>`).join('')}
      </div>`).join('')
      : '<div class="dayline-list-empty">Noch keine Zeilen. Die erste schreibst du auf der Heute-Seite.</div>';

    box.querySelectorAll('.dayline-entry').forEach(row => {
      const date = row.dataset.date;
      const ta = row.querySelector('textarea');
      ta.addEventListener('change', () => {
        dayLines = NookDayline.setEntry(dayLines, date, { text: ta.value });
        saveDayLines();
        if (!dayLines[date]) renderDaylineList();
        window.renderTodayDayline();
      });
      row.querySelectorAll('[data-entry-mood]').forEach(b => b.addEventListener('click', () => {
        const v = Number(b.dataset.entryMood);
        const cur = dayLines[date] ? dayLines[date].mood : null;
        dayLines = NookDayline.setEntry(dayLines, date, { text: ta.value, mood: cur === v ? null : v });
        saveDayLines();
        renderDaylineList(date);
        window.renderTodayDayline();
      }));
    });
    if (focusDate) box.querySelector(`.dayline-entry[data-date="${focusDate}"]`)?.scrollIntoView({ block: 'center' });
  }

  function openDaylineList(focusDate) {
    renderDaylineList(focusDate);
    listModal.open();
  }
  window.openDaylineList = openDaylineList;

  window.renderTodayDaylineSettings = function () {
    const t = document.getElementById('setting-today-dayline');
    if (t) t.checked = !!dayLineOn;
  };
  document.getElementById('setting-today-dayline')?.addEventListener('change', e => {
    dayLineOn = e.target.checked;
    DB.set('dayLineOn', dayLineOn);
    window.renderTodayDayline();
  });

  // Fürs Jahresbuch (nur lesen)
  window.getDayLines = () => dayLines;

  // Suchquelle (js/hub-search.js) — nur lesen
  registerSearchProvider({
    id: 'daylines', label: 'Tageszeilen', icon: '📝', view: 'today',
    items: () => Object.entries(dayLines).map(([date, e]) => ({
      id: date, icon: NookDayline.moodIcon(e.mood) || '📝', title: e.text || longDate(date),
      sub: longDate(date), text: '',
      open: () => { showView('today'); openDaylineList(date); },
    })),
  });

  (window.__pendingSkinTargets = window.__pendingSkinTargets || []).push(
    { id: 'today.dayline', label: 'Eine Zeile', view: 'today', selector: '#today-dayline' },
    { id: 'today.welcome', label: 'Willkommen zurück', view: 'today', selector: '#today-welcome' },
  );

  window.renderTodayDayline();
})();
