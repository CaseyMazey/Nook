// =========================
// TODAY — „Willkommen zurück“ nach einer Pause
// Öffnest du Nook nach mindestens WELCOME_GAP_DAYS Tagen zum ersten Mal,
// steht oben auf der Heute-Seite eine ruhige Karte statt eines Bergs alter
// Aufgaben: was aus der Zeit davor noch offen ist (durchsehen: diese Woche /
// irgendwann / erledigt / löschen) und welche Termine in der Zwischenzeit
// lagen. Kein Zähler „X Tage verpasst“, keine roten Zahlen.
// „Irgendwann“ = task.someday (main.js: getSomedayTasks, today.js: zugeklappt
// unter der Wochenliste).
// Lädt nach today.js und calendar.js. Keys: lastOpenedDay (Datum des letzten
// Öffnens), welcomeBack (an/aus), welcomeBackSeen (Tag, an dem die Karte
// geschlossen wurde). Reiner Teil (NookWelcome): tests/today-welcome.test.js.
// =========================

const NookWelcome = (() => {
  const GAP_DAYS = 4;
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };

  // Ganze Kalendertage zwischen zwei ISO-Daten (Sommerzeit-fest über Mittag)
  function daysBetween(a, b) {
    const da = parse(a); da.setHours(12);
    const db = parse(b); db.setHours(12);
    return Math.round((db - da) / 86400000);
  }

  function isBreak(lastDay, today, gap = GAP_DAYS) {
    return !!lastDay && daysBetween(lastDay, today) >= gap;
  }

  // Offene Aufgaben „von davor“: nicht erledigt, nicht schon „irgendwann“,
  // angelegt spätestens am Tag des letzten Öffnens.
  function leftovers(tasks, lastDay) {
    if (!lastDay) return [];
    return (tasks || []).filter(t => {
      const done = t.status ? t.status === 'completed' : !!t.done;
      if (done || t.someday) return false;
      return iso(new Date(t.createdAt || 0)) <= lastDay;
    });
  }

  // Tage zwischen dem letzten Öffnen und heute (beide ausgeschlossen)
  function daysInBetween(lastDay, today) {
    const out = [];
    for (let d = addDays(lastDay, 1); d < today && out.length < 400; d = addDays(d, 1)) out.push(d);
    return out;
  }

  return { GAP_DAYS, daysBetween, isBreak, leftovers, daysInBetween };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NookWelcome;

// =========================
// ANZEIGE (nur im Browser)
// =========================
if (typeof document !== 'undefined') (function initWelcome() {
  let welcomeOn = DB.get('welcomeBack', true);
  // Die Lücke einmal beim Start bestimmen, danach gilt heute als geöffnet.
  const prevDay = DB.get('lastOpenedDay', null);
  const startDay = dateKey(new Date());
  const isBreak = NookWelcome.isBreak(prevDay, startDay);
  DB.set('lastOpenedDay', startDay);
  let reviewing = false;
  const handled = new Set(); // in dieser Runde schon einsortierte Aufgaben

  function close() {
    DB.set('welcomeBackSeen', dateKey(new Date()));
    document.getElementById('today-welcome')?.remove();
  }

  // Termine aus der Pause (nur Titel, höchstens drei)
  function meanwhileEvents() {
    if (typeof getEventsForDay !== 'function') return [];
    const seen = new Set(), titles = [];
    NookWelcome.daysInBetween(prevDay, startDay).forEach(d => getEventsForDay(parseLocalDate(d)).forEach(({ ev }) => {
      const key = ev.seriesId || ev.id || ev.title;
      if (seen.has(key)) return;
      seen.add(key);
      titles.push(ev.title || 'Termin');
    }));
    return titles;
  }

  window.renderTodayWelcome = function () {
    // Bleibt Nook über Nacht offen, zählt der neue Tag als geöffnet
    DB.set('lastOpenedDay', dateKey(new Date()));
    let el = document.getElementById('today-welcome');
    if (!welcomeOn || !isBreak || dateKey(new Date()) !== startDay || DB.get('welcomeBackSeen', null) === startDay) { el?.remove(); return; }

    const open = NookWelcome.leftovers(Array.isArray(tasks) ? tasks : [], prevDay).filter(t => !handled.has(t.id));
    if (reviewing && !open.length) { close(); return; }
    const events = meanwhileEvents();

    if (!el) {
      el = document.createElement('div');
      el.id = 'today-welcome';
      el.className = 'panel today-welcome';
      const anchor = document.getElementById('today-review') || document.getElementById('today-main-header');
      if (anchor && anchor.id === 'today-review') anchor.before(el);
      else if (anchor) anchor.after(el);
      else document.getElementById('today-greeting-block')?.appendChild(el);
    }

    const n = open.length;
    const text = n
      ? `${n === 1 ? 'Eine Aufgabe ist' : `${n} Aufgaben sind`} aus der Zeit davor noch offen. Was machen wir damit?`
      : 'Es ist nichts liegen geblieben.';
    const evText = events.length
      ? `<div class="today-welcome-meanwhile">📅 In der Zwischenzeit: ${events.slice(0, 3).map(escHtml).join(', ')}${events.length > 3 ? ` +${events.length - 3}` : ''}</div>`
      : '';
    const list = reviewing ? `<ul class="today-welcome-list">${open.map(t => `
        <li class="today-welcome-item" data-id="${escHtml(t.id)}">
          <span class="today-welcome-item-title">${escHtml(t.title)}</span>
          <span class="today-welcome-item-actions">
            <button type="button" data-act="week" title="Bleibt in der Wochenliste">Diese Woche</button>
            <button type="button" data-act="someday" title="Zugeklappt unter der Wochenliste, ohne Druck">🌙 Irgendwann</button>
            <button type="button" data-act="done" title="Als erledigt abhaken">✓ Erledigt</button>
            <button type="button" data-act="delete" class="today-welcome-del" title="Löschen (rückgängig machbar)" aria-label="Löschen">✕</button>
          </span>
        </li>`).join('')}</ul>` : '';
    const actions = n && !reviewing
      ? `<div class="today-welcome-actions">
          <button type="button" class="btn-primary" data-welcome="review">Durchsehen</button>
          <button type="button" class="btn-ghost" data-welcome="keep">Alle behalten</button>
        </div>`
      : '';

    el.innerHTML = `
      <div class="today-welcome-head">
        <span class="today-welcome-title">👋 Schön, dass du wieder da bist.</span>
        <button type="button" class="today-welcome-x" title="Schließen" aria-label="Willkommen-Karte schließen">✕</button>
      </div>
      <div class="today-welcome-text">${text}</div>
      ${evText}${actions}${list}`;

    el.querySelector('.today-welcome-x').addEventListener('click', close);
    el.querySelector('[data-welcome="keep"]')?.addEventListener('click', close);
    el.querySelector('[data-welcome="review"]')?.addEventListener('click', () => { reviewing = true; window.renderTodayWelcome(); });
    el.querySelectorAll('.today-welcome-item [data-act]').forEach(b => b.addEventListener('click', () => {
      const id = b.closest('.today-welcome-item').dataset.id;
      const task = tasks.find(t => t.id === id);
      handled.add(id);
      if (task) {
        if (b.dataset.act === 'someday') task.someday = true;
        if (b.dataset.act === 'done') setTaskStatus(task, 'completed');
        if (b.dataset.act === 'delete') { deleteTaskWithUndo(task); window.renderTodayWelcome(); return; }
        saveTasks(); renderTasks(); renderBlocks();
      }
      window.renderTodayWelcome();
    }));
  };

  window.renderTodayWelcomeSettings = function () {
    const t = document.getElementById('setting-today-welcome');
    if (t) t.checked = !!welcomeOn;
  };
  document.getElementById('setting-today-welcome')?.addEventListener('change', e => {
    welcomeOn = e.target.checked;
    DB.set('welcomeBack', welcomeOn);
    window.renderTodayWelcome();
  });

  window.renderTodayWelcome();
})();
