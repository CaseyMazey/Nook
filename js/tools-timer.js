// =========================
// TOOLS — 2) FOCUS TIMER
// Benötigt tools.js (initTools/HTML-Grundgerüst) zuvor geladen.
// =========================

// =========================================================
// 2) FOCUS TIMER
// Vollständiger Pomodoro-Zyklus (angelehnt an den Marinara-Workflow,
// nicht optisch — nur der Ablauf): Fokus- und Pausenphasen werden NIE
// automatisch fortgesetzt. Läuft eine Phase ab, erscheint ein
// Abschluss-Screen mit bewusster Bestätigung ("▶ Kurze Pause
// starten" usw.), bevor die nächste Phase beginnt. Die drei Modi
// sind jederzeit manuell wählbar. Ein Tages-Verlauf (Anzahl je
// Phasentyp, Fokuszeit, chronologische Liste) wird persistiert und
// täglich zurückgesetzt — analog zum bestehenden sessionCount-Reset.
//
// Zeitmessung über einen Endzeitpunkt (endsAt), nicht über gezählte
// Ticks: Browser drosseln Intervalle in Hintergrund-Tabs bis auf einen
// Aufruf pro Minute — die Restzeit wird deshalb bei jedem Tick aus der
// Uhr berechnet. Die laufende Phase (run) wird mitgespeichert, damit sie
// ein Neuladen übersteht. Bei Phasenende: Ton, optional Benachrichtigung,
// Restzeit steht solange im Tab-Titel.
// =========================================================

const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * 90;

let timerState = null;
let timerInterval = null;
let pomodoroLog = null;
let timerBaseTitle = null;

function timerTodayKey() { return dateKey(new Date()); }

function timerNowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function loadTimerState() {
  const saved = DB.get('toolsFocusTimer', null);
  const defaults = { workMin: 25, shortMin: 5, longMin: 15, longBreakEvery: 4, sessionCount: 0, lastDate: timerTodayKey(), sound: true, notify: false, run: null };
  const merged = Object.assign(defaults, saved || {});
  if (merged.lastDate !== timerTodayKey()) {
    merged.sessionCount = 0;
    merged.lastDate = timerTodayKey();
  }
  return merged;
}

function saveTimerState() {
  const s = timerState;
  DB.set('toolsFocusTimer', {
    workMin: s.workMin, shortMin: s.shortMin, longMin: s.longMin, longBreakEvery: s.longBreakEvery,
    sessionCount: s.sessionCount, lastDate: s.lastDate, sound: s.sound, notify: s.notify,
    // Laufende Phase — übersteht so ein Neuladen
    run: {
      mode: s.mode, running: s.running, endsAt: s.endsAt, remainingSec: s.remainingSec,
      phaseTotalSec: s.phaseTotalSec, phaseStartTime: s.phaseStartTime,
      awaitingNext: s.awaitingNext, nextMode: s.nextMode, sessionJustCompleted: s.sessionJustCompleted
    }
  });
}

function loadPomodoroLog() {
  const saved = DB.get('toolsPomodoroLog', null);
  if (saved && saved.date === timerTodayKey()) return saved;
  return { date: timerTodayKey(), entries: [] };
}

function savePomodoroLog() {
  DB.set('toolsPomodoroLog', pomodoroLog);
}

// Tagesübergreifend nur Summen je Tag (Fokusminuten, Anzahl) — für den
// Wochenverlauf; die Einzelliste bleibt beim Tages-Log. 60 Tage reichen.
let pomodoroHistory = DB.get('toolsPomodoroHistory', {});
function savePomodoroHistory() {
  const keys = Object.keys(pomodoroHistory).sort();
  keys.slice(0, Math.max(0, keys.length - 60)).forEach(k => delete pomodoroHistory[k]);
  DB.set('toolsPomodoroHistory', pomodoroHistory);
}

function timerModeDuration(mode) {
  if (mode === 'short') return timerState.shortMin * 60;
  if (mode === 'long') return timerState.longMin * 60;
  return timerState.workMin * 60;
}

function timerModeLabel(mode) {
  if (mode === 'short') return 'Kurze Pause';
  if (mode === 'long') return 'Lange Pause';
  return 'Fokus';
}

// Tageswechsel bei offenem Nook: Zähler und Verlauf beginnen neu
function timerCheckRollover() {
  if (timerState.lastDate === timerTodayKey()) return;
  timerState.sessionCount = 0;
  timerState.lastDate = timerTodayKey();
  saveTimerState();
}

function timerRemainingNow() {
  if (!timerState.running || !timerState.endsAt) return timerState.remainingSec;
  return Math.max(0, Math.ceil((timerState.endsAt - Date.now()) / 1000));
}

function initFocusTimer() {
  timerBaseTitle = document.title;
  timerState = loadTimerState();
  const run = timerState.run || {};
  delete timerState.run;
  const mode = ['focus', 'short', 'long'].includes(run.mode) ? run.mode : 'focus';
  Object.assign(timerState, {
    mode,
    running: !!run.running && !!run.endsAt,
    endsAt: run.endsAt || null,
    phaseTotalSec: run.phaseTotalSec || timerModeDuration(mode),
    remainingSec: typeof run.remainingSec === 'number' ? run.remainingSec : timerModeDuration(mode),
    phaseStartTime: run.phaseStartTime || null,
    awaitingNext: !!run.awaitingNext,
    nextMode: run.nextMode || null,
    sessionJustCompleted: !!run.sessionJustCompleted
  });
  pomodoroLog = loadPomodoroLog();

  document.getElementById('timer-set-work').value = timerState.workMin;
  document.getElementById('timer-set-short').value = timerState.shortMin;
  document.getElementById('timer-set-long').value = timerState.longMin;
  document.getElementById('timer-set-long-every').value = timerState.longBreakEvery;
  document.getElementById('timer-set-sound').checked = timerState.sound;
  document.getElementById('timer-set-notify').checked = timerState.notify && timerNotifyAllowed();

  // Lief beim Neuladen noch eine Phase? Fortsetzen oder (abgelaufen) still abschließen.
  if (timerState.running) {
    if (timerRemainingNow() <= 0) timerFinishPhase(false);
    else timerStartInterval();
  }

  renderTimer();
  renderTimerHistory();

  document.getElementById('timer-toggle-btn').addEventListener('click', timerToggle);
  document.getElementById('timer-reset-btn').addEventListener('click', timerReset);
  document.getElementById('timer-complete-btn').addEventListener('click', timerConfirmNext);

  document.querySelectorAll('.tool-mode-group [data-timer-mode]').forEach(btn => {
    btn.addEventListener('click', () => timerSelectMode(btn.dataset.timerMode));
  });

  document.getElementById('timer-settings-toggle').addEventListener('click', () => {
    document.getElementById('timer-history').classList.add('hidden');
    document.getElementById('timer-settings').classList.toggle('hidden');
  });
  document.getElementById('timer-history-toggle').addEventListener('click', () => {
    document.getElementById('timer-settings').classList.add('hidden');
    document.getElementById('timer-history').classList.toggle('hidden');
  });

  ['timer-set-work', 'timer-set-short', 'timer-set-long', 'timer-set-long-every'].forEach(id => {
    document.getElementById(id).addEventListener('change', timerApplySettings);
  });
  document.getElementById('timer-note').addEventListener('input', e => {
    const last = pomodoroLog.entries[pomodoroLog.entries.length - 1];
    if (!last || last.type !== 'focus') return;
    last.note = e.target.value.trim();
    savePomodoroLog();
  });
  document.getElementById('timer-note').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); timerConfirmNext(); }
  });
  document.getElementById('timer-set-sound').addEventListener('change', e => {
    timerState.sound = e.target.checked;
    saveTimerState();
  });
  document.getElementById('timer-set-notify').addEventListener('change', async e => {
    if (e.target.checked && !(await timerRequestNotify())) {
      e.target.checked = false;
      hubAlert('Benachrichtigungen blockiert', 'Der Browser erlaubt Nook keine Benachrichtigungen. Du kannst sie in den Website-Einstellungen des Browsers freigeben.');
    }
    timerState.notify = e.target.checked;
    saveTimerState();
  });

  // Nach dem Zurückkehren in den Tab sofort nachrechnen statt auf den
  // nächsten (evtl. gedrosselten) Tick zu warten.
  document.addEventListener('visibilitychange', () => { if (timerState.running) timerTick(); });
}

function timerApplySettings() {
  const work = Math.max(1, parseInt(document.getElementById('timer-set-work').value, 10) || 25);
  const short = Math.max(1, parseInt(document.getElementById('timer-set-short').value, 10) || 5);
  const long = Math.max(1, parseInt(document.getElementById('timer-set-long').value, 10) || 15);
  const longEvery = Math.max(1, parseInt(document.getElementById('timer-set-long-every').value, 10) || 4);

  timerState.workMin = work;
  timerState.shortMin = short;
  timerState.longMin = long;
  timerState.longBreakEvery = longEvery;

  // Läuft der Timer gerade nicht, direkt an neue Dauer anpassen. Eine
  // laufende Phase behält ihre Dauer (Ring und Verlauf bleiben stimmig).
  if (!timerState.running && !timerState.awaitingNext) {
    timerState.phaseTotalSec = timerModeDuration(timerState.mode);
    timerState.remainingSec = timerState.phaseTotalSec;
    renderTimer();
  }
  saveTimerState();
  renderTimerHistory();
}

function timerStartInterval() {
  clearInterval(timerInterval);
  timerInterval = setInterval(timerTick, 1000);
}

function timerStart() {
  toolsUnlockAudio();
  timerState.running = true;
  timerState.endsAt = Date.now() + timerState.remainingSec * 1000;
  if (!timerState.phaseStartTime) timerState.phaseStartTime = timerNowHHMM();
  timerStartInterval();
}

function timerToggle() {
  if (timerState.awaitingNext) return;
  if (timerState.running) {
    timerState.remainingSec = timerRemainingNow();
    timerState.running = false;
    timerState.endsAt = null;
    clearInterval(timerInterval);
  } else {
    timerStart();
  }
  saveTimerState();
  renderTimer();
}

function timerStop(mode) {
  clearInterval(timerInterval);
  timerState.running = false;
  timerState.endsAt = null;
  timerState.awaitingNext = false;
  timerState.nextMode = null;
  timerState.mode = mode;
  timerState.phaseStartTime = null;
  timerState.phaseTotalSec = timerModeDuration(mode);
  timerState.remainingSec = timerState.phaseTotalSec;
  saveTimerState();
  renderTimer();
}

function timerReset() { timerStop(timerState.mode); }
function timerSelectMode(mode) { timerStop(mode); }

function timerTick() {
  timerState.remainingSec = timerRemainingNow();
  if (timerState.remainingSec <= 0) {
    timerFinishPhase(true);
    return;
  }
  renderTimer();
}

function timerFinishPhase(alert) {
  clearInterval(timerInterval);
  timerState.running = false;
  timerState.endsAt = null;
  timerState.remainingSec = 0;
  timerCheckRollover();
  timerLogCompletion();
  timerDetermineNext();
  saveTimerState();
  renderTimer();
  if (alert) timerAlert();
}

function timerLogCompletion() {
  if (pomodoroLog.date !== timerTodayKey()) pomodoroLog = { date: timerTodayKey(), entries: [] };

  pomodoroLog.entries.push({
    type: timerState.mode,
    time: timerState.phaseStartTime || timerNowHHMM(),
    minutes: Math.round(timerState.phaseTotalSec / 60)
  });
  if (pomodoroLog.entries.length > 50) pomodoroLog.entries = pomodoroLog.entries.slice(-50);
  savePomodoroLog();

  if (timerState.mode === 'focus') {
    timerState.sessionCount++;
    const day = pomodoroHistory[timerTodayKey()] || { min: 0, count: 0 };
    day.min += Math.round(timerState.phaseTotalSec / 60);
    day.count++;
    pomodoroHistory[timerTodayKey()] = day;
    savePomodoroHistory();
  }
}

function timerDetermineNext() {
  timerState.phaseStartTime = null;
  timerState.awaitingNext = true;

  if (timerState.mode === 'focus') {
    timerState.sessionJustCompleted = false;
    timerState.nextMode = (timerState.sessionCount % timerState.longBreakEvery === 0) ? 'long' : 'short';
  } else if (timerState.mode === 'short') {
    timerState.sessionJustCompleted = false;
    timerState.nextMode = 'focus';
  } else {
    timerState.sessionJustCompleted = true;
    timerState.nextMode = 'focus';
  }
}

function timerConfirmNext() {
  timerCheckRollover();
  if (timerState.sessionJustCompleted) timerState.sessionCount = 0;
  timerState.mode = timerState.nextMode;
  timerState.nextMode = null;
  timerState.awaitingNext = false;
  timerState.sessionJustCompleted = false;
  timerState.phaseTotalSec = timerModeDuration(timerState.mode);
  timerState.remainingSec = timerState.phaseTotalSec;
  timerState.phaseStartTime = null;
  timerStart();
  saveTimerState();
  renderTimer();
}

// ── Benachrichtigung (Ton: toolsPlayChime in tools.js) ──
function timerNotifyAllowed() {
  return 'Notification' in window && Notification.permission === 'granted';
}

async function timerRequestNotify() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch (e) { return false; }
}

function timerAlert() {
  if (timerState.sound) toolsPlayChime();
  if (timerState.notify && timerNotifyAllowed() && document.hidden) {
    const content = timerCompletionContent();
    try { new Notification(`${content.icon} ${content.title}`, { body: content.sub || content.btn.replace('▶ ', ''), tag: 'nook-focus-timer' }); } catch (e) { /* z. B. file:// ohne Freigabe */ }
  }
}

function timerUpdateTitle() {
  if (timerBaseTitle === null) return;
  if (timerState.running) {
    const mins = Math.floor(timerState.remainingSec / 60);
    const secs = timerState.remainingSec % 60;
    document.title = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} · ${timerModeLabel(timerState.mode)} – ${timerBaseTitle}`;
  } else if (timerState.awaitingNext) {
    document.title = `✔ ${timerModeLabel(timerState.mode)} fertig – ${timerBaseTitle}`;
  } else {
    document.title = timerBaseTitle;
  }
}

function timerCompletionContent() {
  const justMode = timerState.mode;
  const next = timerState.nextMode;

  if (justMode === 'focus' && next === 'short') {
    return { icon: '🎉', title: 'Fokus abgeschlossen!', sub: 'Zeit für eine kurze Pause.', btn: '▶ Kurze Pause starten' };
  }
  if (justMode === 'focus' && next === 'long') {
    return { icon: '🌙', title: 'Zeit für eine lange Pause.', sub: '', btn: '▶ Lange Pause starten' };
  }
  if (justMode === 'short') {
    return { icon: '☕', title: 'Pause beendet.', sub: 'Bereit für den nächsten Fokus?', btn: '▶ Fokus starten' };
  }
  // justMode === 'long' → komplette Session abgeschlossen
  return {
    icon: '🎉',
    title: 'Pomodoro-Session abgeschlossen.',
    sub: `${timerState.longBreakEvery} Fokusphasen erfolgreich beendet.`,
    btn: 'Neue Session starten'
  };
}

function renderTimer() {
  timerUpdateTitle();
  document.querySelectorAll('.tool-mode-group [data-timer-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.timerMode === timerState.mode);
  });

  const ringWrap = document.getElementById('timer-ring-wrap');
  const completePanel = document.getElementById('timer-complete-panel');
  const controls = document.getElementById('timer-controls');
  const sessions = document.getElementById('timer-sessions');

  if (timerState.awaitingNext) {
    ringWrap.classList.add('hidden');
    controls.classList.add('hidden');
    sessions.classList.add('hidden');
    completePanel.classList.remove('hidden');

    const content = timerCompletionContent();
    document.getElementById('timer-complete-icon').textContent = content.icon;
    document.getElementById('timer-complete-title').textContent = content.title;
    document.getElementById('timer-complete-sub').textContent = content.sub;
    document.getElementById('timer-complete-sub').classList.toggle('hidden', !content.sub);
    document.getElementById('timer-complete-btn').textContent = content.btn;
    // Nach einer Fokusphase: kurz notieren, woran gearbeitet wurde
    const note = document.getElementById('timer-note');
    const last = pomodoroLog.entries[pomodoroLog.entries.length - 1];
    const showNote = timerState.mode === 'focus' && last && last.type === 'focus';
    note.classList.toggle('hidden', !showNote);
    if (showNote && document.activeElement !== note) note.value = last.note || '';
    renderTimerHistory();
    return;
  }

  ringWrap.classList.remove('hidden');
  controls.classList.remove('hidden');
  sessions.classList.remove('hidden');
  completePanel.classList.add('hidden');

  const total = timerState.phaseTotalSec || timerModeDuration(timerState.mode);
  const fractionRemaining = Math.max(0, Math.min(1, timerState.remainingSec / total));

  const mins = Math.floor(timerState.remainingSec / 60);
  const secs = timerState.remainingSec % 60;
  document.getElementById('timer-time').textContent =
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  document.getElementById('timer-mode-pill').textContent = timerModeLabel(timerState.mode);

  const cyclePos = (timerState.sessionCount % timerState.longBreakEvery === 0 && timerState.sessionCount > 0)
    ? timerState.longBreakEvery
    : timerState.sessionCount % timerState.longBreakEvery;
  sessions.textContent = `🍅 ${cyclePos} / ${timerState.longBreakEvery}`;

  const ring = document.getElementById('timer-ring-fg');
  const offset = TIMER_RING_CIRCUMFERENCE * (1 - fractionRemaining);
  ring.style.strokeDasharray = String(TIMER_RING_CIRCUMFERENCE);
  ring.style.strokeDashoffset = String(offset);

  document.getElementById('timer-toggle-btn').textContent = timerState.running ? 'Pause' : 'Start';
}

function renderTimerHistory() {
  const summaryEl = document.getElementById('timer-history-summary');
  const listEl = document.getElementById('timer-history-list');
  if (!summaryEl || !listEl) return;

  renderTimerWeek();
  const entries = (pomodoroLog && pomodoroLog.date === timerTodayKey()) ? pomodoroLog.entries : [];
  const focusCount = entries.filter(e => e.type === 'focus').length;
  const shortCount = entries.filter(e => e.type === 'short').length;
  const longCount = entries.filter(e => e.type === 'long').length;
  const focusMinutes = entries.filter(e => e.type === 'focus').reduce((sum, e) => sum + e.minutes, 0);

  summaryEl.innerHTML = `
    <div class="timer-history-title">Heute</div>
    <div>🍅 ${focusCount} Fokusphase${focusCount === 1 ? '' : 'n'}</div>
    <div>☕ ${shortCount} kurze Pause${shortCount === 1 ? '' : 'n'}</div>
    <div>🌙 ${longCount} lange Pause${longCount === 1 ? '' : 'n'}</div>
    <div>${focusMinutes} Minuten Fokuszeit</div>
  `;

  if (entries.length === 0) {
    listEl.innerHTML = '<div class="timer-history-empty">Noch keine abgeschlossenen Phasen heute.</div>';
    return;
  }
  listEl.innerHTML = entries.map(e =>
    `<div class="timer-history-item">${e.time} ${timerModeLabel(e.type)}${e.note ? ` <span class="timer-history-note">— ${escHtml(e.note)}</span>` : ''}</div>`
  ).join('');
}

// Letzte 7 Tage als kleine Säulen (Fokusminuten)
function renderTimerWeek() {
  const el = document.getElementById('timer-week');
  if (!el) return;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = dateKey(d);
    days.push({ k, label: i === 0 ? 'Heute' : d.toLocaleDateString('de-DE', { weekday: 'short' }), min: (pomodoroHistory[k] || {}).min || 0, count: (pomodoroHistory[k] || {}).count || 0 });
  }
  const max = Math.max(...days.map(d => d.min), 1);
  const total = days.reduce((s, d) => s + d.min, 0);
  el.innerHTML = `
    <div class="timer-history-title">Letzte 7 Tage · ${Math.floor(total / 60)} Std. ${total % 60} Min.</div>
    <div class="timer-week-bars">${days.map(d => `
      <div class="timer-week-col" title="${d.label}: ${d.min} Min. (${d.count} Fokusphase${d.count === 1 ? '' : 'n'})">
        <span class="timer-week-val">${d.min || ''}</span>
        <span class="timer-week-bar" style="height:${Math.round(d.min / max * 100)}%"></span>
        <span class="timer-week-day">${d.label}</span>
      </div>`).join('')}
    </div>`;
}
