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
// =========================================================

const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * 90;

let timerState = null;
let timerInterval = null;
let pomodoroLog = null;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function loadTimerState() {
  const saved = DB.get('toolsFocusTimer', null);
  const defaults = { workMin: 25, shortMin: 5, longMin: 15, longBreakEvery: 4, sessionCount: 0, lastDate: todayKey() };
  const merged = Object.assign(defaults, saved || {});
  if (merged.lastDate !== todayKey()) {
    merged.sessionCount = 0;
    merged.lastDate = todayKey();
  }
  return merged;
}

function saveTimerState() {
  DB.set('toolsFocusTimer', {
    workMin: timerState.workMin,
    shortMin: timerState.shortMin,
    longMin: timerState.longMin,
    longBreakEvery: timerState.longBreakEvery,
    sessionCount: timerState.sessionCount,
    lastDate: timerState.lastDate
  });
}

function loadPomodoroLog() {
  const saved = DB.get('toolsPomodoroLog', null);
  if (saved && saved.date === todayKey()) return saved;
  return { date: todayKey(), entries: [] };
}

function savePomodoroLog() {
  DB.set('toolsPomodoroLog', pomodoroLog);
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

function initFocusTimer() {
  const persisted = loadTimerState();
  timerState = Object.assign(persisted, {
    mode: 'focus',
    running: false,
    awaitingNext: false,
    nextMode: null,
    sessionJustCompleted: false,
    phaseStartTime: null
  });
  timerState.remainingSec = timerModeDuration('focus');
  pomodoroLog = loadPomodoroLog();

  document.getElementById('timer-set-work').value = timerState.workMin;
  document.getElementById('timer-set-short').value = timerState.shortMin;
  document.getElementById('timer-set-long').value = timerState.longMin;
  document.getElementById('timer-set-long-every').value = timerState.longBreakEvery;

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
  saveTimerState();

  // Läuft der Timer gerade nicht, direkt an neue Dauer anpassen.
  if (!timerState.running && !timerState.awaitingNext) {
    timerState.remainingSec = timerModeDuration(timerState.mode);
    renderTimer();
  }
  renderTimerHistory();
}

function timerToggle() {
  if (timerState.awaitingNext) return;
  timerState.running = !timerState.running;

  if (timerState.running) {
    if (!timerState.phaseStartTime) timerState.phaseStartTime = nowHHMM();
    timerInterval = setInterval(timerTick, 1000);
  } else {
    clearInterval(timerInterval);
  }
  renderTimer();
}

function timerReset() {
  clearInterval(timerInterval);
  timerState.running = false;
  timerState.awaitingNext = false;
  timerState.nextMode = null;
  timerState.phaseStartTime = null;
  timerState.remainingSec = timerModeDuration(timerState.mode);
  renderTimer();
}

function timerSelectMode(mode) {
  clearInterval(timerInterval);
  timerState.running = false;
  timerState.awaitingNext = false;
  timerState.nextMode = null;
  timerState.mode = mode;
  timerState.phaseStartTime = null;
  timerState.remainingSec = timerModeDuration(mode);
  renderTimer();
}

function timerTick() {
  timerState.remainingSec--;

  if (timerState.remainingSec <= 0) {
    clearInterval(timerInterval);
    timerState.running = false;
    timerLogCompletion();
    timerDetermineNext();
  }
  renderTimer();
}

function timerLogCompletion() {
  if (pomodoroLog.date !== todayKey()) pomodoroLog = { date: todayKey(), entries: [] };

  pomodoroLog.entries.push({
    type: timerState.mode,
    time: timerState.phaseStartTime || nowHHMM(),
    minutes: Math.round(timerModeDuration(timerState.mode) / 60)
  });
  if (pomodoroLog.entries.length > 50) pomodoroLog.entries = pomodoroLog.entries.slice(-50);
  savePomodoroLog();

  if (timerState.mode === 'focus') {
    timerState.sessionCount++;
    timerState.lastDate = todayKey();
    saveTimerState();
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
  if (timerState.sessionJustCompleted) {
    timerState.sessionCount = 0;
    saveTimerState();
  }
  timerState.mode = timerState.nextMode;
  timerState.nextMode = null;
  timerState.awaitingNext = false;
  timerState.sessionJustCompleted = false;
  timerState.remainingSec = timerModeDuration(timerState.mode);
  timerState.phaseStartTime = nowHHMM();
  timerState.running = true;
  timerInterval = setInterval(timerTick, 1000);
  renderTimer();
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
    renderTimerHistory();
    return;
  }

  ringWrap.classList.remove('hidden');
  controls.classList.remove('hidden');
  sessions.classList.remove('hidden');
  completePanel.classList.add('hidden');

  const total = timerModeDuration(timerState.mode);
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

  const entries = (pomodoroLog && pomodoroLog.date === todayKey()) ? pomodoroLog.entries : [];
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
    `<div class="timer-history-item">${e.time} ${timerModeLabel(e.type)}</div>`
  ).join('');
}
