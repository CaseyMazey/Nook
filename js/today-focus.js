// =========================
// TODAY — Fokusmodus
// Ein ruhiger Vollbild-Modus von der Heute-Seite aus („🎯 Fokus“ am Stundenplan):
// nur der laufende Abschnitt aus dem Stundenplan (js/schedule.js), seine offenen
// Aufgaben (abhakbar) und ein Timer (25 / 50 Min. oder bis Blockende).
// Alles andere tritt zurück. Kein eigener Planer: Aufgaben und Stundenplan bleiben,
// wo sie sind (today.md) — der Modus zeigt nur einen Ausschnitt.
// Fokuszeit wird je Tag gezählt (Key todayFocusLog: { 'YYYY-MM-DD': Minuten },
// die letzten 60 Tage), der Wochenrückblick (today-review.js) liest sie.
// Lädt nach today.js (tasks, saveTasks, setTaskStatus, taskBlockIds,
// isTaskCompleted, getTasksForBlockView, renderTasks, renderBlocks) und schedule.js.
// =========================

const NookFocus = (() => {
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };

  // Laufender Abschnitt (oder der nächste, wenn gerade keiner läuft) aus scheduleSegmentsForDate().
  // → { seg, now: bool, minutesLeft, next } oder null (freier Tag / nach Feierabend).
  function current(plan, nowMin) {
    if (!plan || plan.off || !plan.segments?.length) return null;
    const segs = plan.segments;
    const i = segs.findIndex(s => nowMin >= toMin(s.start) && nowMin < toMin(s.end));
    if (i >= 0) return { seg: segs[i], now: true, minutesLeft: toMin(segs[i].end) - nowMin, next: segs[i + 1] || null };
    const upcoming = segs.find(s => toMin(s.start) > nowMin);
    return upcoming ? { seg: upcoming, now: false, minutesLeft: toMin(upcoming.start) - nowMin, next: null } : null;
  }

  const clock = sec => {
    const s = Math.max(0, Math.round(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  // Fokus-Minuten eines Tages addieren; ältere Tage als keep fallen weg.
  function addMinutes(log, day, minutes, keep = 60) {
    const out = { ...(log || {}) };
    if (minutes >= 1) out[day] = (out[day] || 0) + Math.round(minutes);
    const cut = new Date(Date.parse(day + 'T00:00:00Z') - keep * 864e5).toISOString().slice(0, 10);
    Object.keys(out).forEach(k => { if (k < cut) delete out[k]; });
    return out;
  }

  return { current, clock, addMinutes, toMin };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NookFocus;

if (typeof document !== 'undefined') (function initFocus() {
  let overlay = null, tickTimer = null;
  const timer = { total: 0, endsAt: 0, left: 0, running: false, startedAt: 0, counted: 0 };

  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const todayPlan = () => (typeof scheduleSegmentsForDate === 'function' ? scheduleSegmentsForDate(new Date()) : null);

  function logFocus() {
    // gezählt wird die tatsächlich gelaufene Zeit, auch bei vorzeitigem Ende
    if (!timer.startedAt) return;
    const ran = (timer.running ? Date.now() - timer.startedAt : 0) / 60000 + timer.counted;
    timer.counted = 0; timer.startedAt = 0;
    if (ran >= 1) DB.set('todayFocusLog', NookFocus.addMinutes(DB.get('todayFocusLog', {}), todayIsoLocal(), ran));
  }
  const todayIsoLocal = () => (typeof dateKey === 'function' ? dateKey(new Date()) : new Date().toISOString().slice(0, 10));

  function open() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'focus-overlay';
    overlay.className = 'focus-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Fokusmodus');
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    render();
    tickTimer = setInterval(tick, 1000);
  }

  function close() {
    if (!overlay) return;
    if (timer.running) pause();
    logFocus();
    Object.assign(timer, { total: 0, endsAt: 0, left: 0, running: false });
    clearInterval(tickTimer);
    document.removeEventListener('keydown', onKey);
    overlay.remove(); overlay = null;
    if (typeof renderBlocks === 'function') renderBlocks();
    if (typeof renderTasks === 'function') renderTasks();
  }
  const onKey = e => { if (e.key === 'Escape') close(); };

  function start(minutes) {
    logFocus();
    Object.assign(timer, { total: minutes * 60, left: minutes * 60, endsAt: Date.now() + minutes * 60000, running: true, startedAt: Date.now(), counted: 0 });
    render();
  }
  function pause() {
    timer.left = Math.max(0, (timer.endsAt - Date.now()) / 1000);
    timer.counted += (Date.now() - timer.startedAt) / 60000;
    timer.startedAt = Date.now(); // bleibt „gestartet“, zählt aber nicht weiter
    timer.running = false;
  }
  function resume() {
    timer.endsAt = Date.now() + timer.left * 1000;
    timer.startedAt = Date.now();
    timer.running = true;
  }

  let lastMinute = -1;
  function tick() {
    if (!overlay) return;
    if (timer.running) {
      timer.left = Math.max(0, (timer.endsAt - Date.now()) / 1000);
      if (timer.left <= 0) {
        logFocus(); // solange running noch true ist, damit die letzte Strecke mitzählt
        Object.assign(timer, { running: false, total: 0, left: 0 });
        timer.done = true;
        render();
        return;
      }
      const t = overlay.querySelector('.focus-clock');
      if (t) t.textContent = NookFocus.clock(timer.left);
    }
    if (nowMin() !== lastMinute) { lastMinute = nowMin(); renderNow(); }
  }

  function blockTasks(seg) {
    if (typeof getTasksForBlockView !== 'function') return [];
    const all = getTasksForBlockView().filter(t => !isTaskCompleted(t));
    if (seg && seg.type === 'block') return all.filter(t => taskBlockIds(t).map(String).includes(String(seg.id)));
    return all.filter(t => !taskBlockIds(t).length).slice(0, 6);
  }

  function renderNow() {
    const box = overlay?.querySelector('.focus-now');
    if (!box) return;
    const c = NookFocus.current(todayPlan(), nowMin());
    const until = s => s.end;
    if (!c) box.innerHTML = `<div class="focus-label">Gerade kein Block im Stundenplan</div><div class="focus-sub">Du kannst trotzdem einen Timer starten.</div>`;
    else if (c.now && c.seg.type === 'break') box.innerHTML = `<div class="focus-label">☕ ${escHtml(c.seg.label)}</div><div class="focus-sub">bis ${until(c.seg)} · noch ${c.minutesLeft} Min.${c.next ? ` · danach: ${escHtml(c.next.label)}` : ''}</div>`;
    else if (c.now) box.innerHTML = `<div class="focus-label">${escHtml(c.seg.label)}</div><div class="focus-sub">bis ${until(c.seg)} · noch ${c.minutesLeft} Min.</div>`;
    else box.innerHTML = `<div class="focus-label">Als Nächstes: ${escHtml(c.seg.label)}</div><div class="focus-sub">um ${c.seg.start} · in ${c.minutesLeft} Min.</div>`;
    const endBtn = overlay.querySelector('[data-min="end"]');
    if (endBtn) {
      const ok = c && c.now && c.seg.type !== 'break' && c.minutesLeft >= 2;
      endBtn.hidden = !ok;
      if (ok) endBtn.textContent = `bis ${c.seg.end} (${c.minutesLeft} Min.)`;
    }
  }

  function render() {
    if (!overlay) return;
    const c = NookFocus.current(todayPlan(), nowMin());
    const seg = c && c.now && c.seg.type !== 'break' ? c.seg : null;
    const tasks = blockTasks(seg);
    const tasksTitle = seg && seg.type === 'block' ? 'Aufgaben in diesem Block' : 'Offene Aufgaben ohne Block';
    const timerHtml = timer.total
      ? `<div class="focus-clock">${NookFocus.clock(timer.left)}</div>
         <div class="focus-timer-actions">
           <button type="button" class="focus-btn" data-act="toggle">${timer.running ? 'Pause' : 'Weiter'}</button>
           <button type="button" class="focus-btn ghost" data-act="stop">Beenden</button>
         </div>`
      : `${timer.done ? '<div class="focus-done">✓ Geschafft. Gönn dir eine kurze Pause.</div>' : ''}
         <div class="focus-timer-actions">
           <button type="button" class="focus-btn" data-min="25">25 Min.</button>
           <button type="button" class="focus-btn" data-min="50">50 Min.</button>
           <button type="button" class="focus-btn" data-min="end" hidden></button>
         </div>`;
    overlay.innerHTML = `
      <div class="focus-panel">
        <div class="focus-head">
          <span class="focus-title">🎯 Fokus</span>
          <button type="button" class="focus-x" data-act="close" title="Fokus beenden (Esc)" aria-label="Fokus beenden">✕</button>
        </div>
        <div class="focus-now"></div>
        <div class="focus-timer">${timerHtml}</div>
        <div class="focus-tasks">
          <div class="focus-tasks-title">${tasksTitle}</div>
          ${tasks.length ? tasks.map(t => `
            <label class="focus-task"><input type="checkbox" data-task="${escHtml(String(t.id))}"/><span>${escHtml(t.title)}</span></label>`).join('')
            : '<div class="focus-sub">Keine offenen Aufgaben. 🌿</div>'}
        </div>
      </div>`;
    renderNow();
    overlay.querySelector('[data-act="close"]').addEventListener('click', close);
    overlay.querySelectorAll('[data-min]').forEach(b => b.addEventListener('click', () => {
      timer.done = false;
      const m = b.dataset.min === 'end' ? (NookFocus.current(todayPlan(), nowMin())?.minutesLeft || 25) : +b.dataset.min;
      start(m);
    }));
    overlay.querySelector('[data-act="toggle"]')?.addEventListener('click', () => { timer.running ? pause() : resume(); render(); });
    overlay.querySelector('[data-act="stop"]')?.addEventListener('click', () => {
      if (timer.running) pause();
      logFocus();
      Object.assign(timer, { total: 0, left: 0, running: false, done: false });
      render();
    });
    overlay.querySelectorAll('[data-task]').forEach(cb => cb.addEventListener('change', () => {
      const t = tasks.find(x => String(x.id) === cb.dataset.task);
      if (!t) return;
      setTaskStatus(t, 'completed');
      saveTasks();
      cb.closest('.focus-task').classList.add('done');
      setTimeout(render, 600);
    }));
  }

  document.getElementById('today-focus-btn')?.addEventListener('click', open);
  window.openFocusMode = open;
})();
