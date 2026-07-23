// =========================
// TOOLS
// Kleiner Werkzeugkasten direkt in Nook — bewusst klein gehalten.
// Drei unabhängige Komponenten (Taschenrechner, Focus Timer, Converter),
// jede in ihrem eigenen Abschnitt. Gerendert einmalig in #view-tools,
// analog zum Games-Hub (initTools wird von main.js/renderView aufgerufen).
// =========================

let toolsInitialized = false;

function initTools() {
  if (toolsInitialized) return;
  toolsInitialized = true;

  const view = document.getElementById('view-tools');
  if (!view) return;

  view.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Tools</h1>
        <p class="tools-subtitle">Schnellwerkzeuge für deinen Alltag.</p>
      </div>
    </div>
    <div class="dash-content">
      <div class="tools-grid">

        <div class="tool-card" id="tool-calculator">
          <div class="tool-card-header">
            <span class="tool-card-icon">🧮</span>
            <span class="tool-card-title">Taschenrechner</span>
          </div>
          <div class="tool-card-body">
            <div class="calc-expression" id="calc-expression">&nbsp;</div>
            <div class="calc-display" id="calc-display">0</div>
            <div class="calc-keys">
              <button class="calc-key calc-key--fn" data-calc-action="clear">AC</button>
              <button class="calc-key calc-key--fn" data-calc-action="sign">+/-</button>
              <button class="calc-key calc-key--fn" data-calc-action="percent">%</button>
              <button class="calc-key calc-key--op" data-calc-op="÷">÷</button>

              <button class="calc-key" data-calc-digit="7">7</button>
              <button class="calc-key" data-calc-digit="8">8</button>
              <button class="calc-key" data-calc-digit="9">9</button>
              <button class="calc-key calc-key--op" data-calc-op="×">×</button>

              <button class="calc-key" data-calc-digit="4">4</button>
              <button class="calc-key" data-calc-digit="5">5</button>
              <button class="calc-key" data-calc-digit="6">6</button>
              <button class="calc-key calc-key--op" data-calc-op="−">−</button>

              <button class="calc-key" data-calc-digit="1">1</button>
              <button class="calc-key" data-calc-digit="2">2</button>
              <button class="calc-key" data-calc-digit="3">3</button>
              <button class="calc-key calc-key--op" data-calc-op="+">+</button>

              <button class="calc-key calc-key--zero" data-calc-digit="0">0</button>
              <button class="calc-key" data-calc-action="decimal">,</button>
              <button class="calc-key calc-key--eq" data-calc-action="equals">=</button>
            </div>

            <button class="tool-settings-toggle" id="calc-history-toggle">Verlauf</button>
            <div class="calc-history hidden" id="calc-history">
              <div class="calc-history-list" id="calc-history-list"></div>
              <button class="calc-history-clear" id="calc-history-clear">Verlauf löschen</button>
            </div>
          </div>
        </div>

        <div class="tool-card" id="tool-timer">
          <div class="tool-card-header">
            <span class="tool-card-icon">🍅</span>
            <span class="tool-card-title">Focus Timer</span>
          </div>
          <div class="tool-card-body">
            <div class="tool-mode-group" role="group" aria-label="Timer-Modus">
              <button class="tool-mode-btn" data-timer-mode="focus">🍅 Fokus</button>
              <button class="tool-mode-btn" data-timer-mode="short">☕ Kurze Pause</button>
              <button class="tool-mode-btn" data-timer-mode="long">🌙 Lange Pause</button>
            </div>

            <div class="timer-ring-wrap" id="timer-ring-wrap">
              <svg class="timer-ring" viewBox="0 0 200 200">
                <circle class="timer-ring-bg" cx="100" cy="100" r="90"></circle>
                <circle class="timer-ring-fg" id="timer-ring-fg" cx="100" cy="100" r="90"></circle>
              </svg>
              <div class="timer-ring-content">
                <div class="timer-time" id="timer-time">25:00</div>
                <div class="timer-mode-pill" id="timer-mode-pill">Fokus</div>
              </div>
            </div>

            <div class="timer-complete-panel hidden" id="timer-complete-panel">
              <div class="timer-complete-icon" id="timer-complete-icon">🎉</div>
              <div class="timer-complete-title" id="timer-complete-title">Fokus abgeschlossen!</div>
              <div class="timer-complete-sub" id="timer-complete-sub">Zeit für eine kurze Pause.</div>
              <button class="btn-primary timer-complete-btn" id="timer-complete-btn">▶ Kurze Pause starten</button>
            </div>

            <div class="timer-sessions" id="timer-sessions">🍅 0 / 4</div>
            <div class="timer-controls" id="timer-controls">
              <button class="btn-primary timer-start-btn" id="timer-toggle-btn">Start</button>
              <button class="icon-btn" id="timer-reset-btn" title="Zurücksetzen">↻</button>
            </div>

            <div class="tool-toggle-row">
              <button class="tool-settings-toggle" id="timer-settings-toggle">Einstellungen</button>
              <button class="tool-settings-toggle" id="timer-history-toggle">Verlauf</button>
            </div>

            <div class="timer-settings hidden" id="timer-settings">
              <label>Fokus (Min)<input type="number" min="1" max="180" id="timer-set-work"></label>
              <label>Kurze Pause (Min)<input type="number" min="1" max="60" id="timer-set-short"></label>
              <label>Lange Pause (Min)<input type="number" min="1" max="90" id="timer-set-long"></label>
              <label>Lange Pause nach<input type="number" min="1" max="12" id="timer-set-long-every"></label>
            </div>

            <div class="timer-history hidden" id="timer-history">
              <div class="timer-history-summary" id="timer-history-summary"></div>
              <div class="timer-history-list" id="timer-history-list"></div>
            </div>
          </div>
        </div>

        <div class="tool-card" id="tool-converter">
          <div class="tool-card-header">
            <span class="tool-card-icon">🔄</span>
            <span class="tool-card-title">Converter</span>
          </div>
          <div class="tool-card-body">
            <select class="conv-category-select" id="conv-category"></select>

            <div class="conv-row">
              <label class="conv-label" for="conv-from-value">Von</label>
              <div class="conv-input-group">
                <input type="number" class="modal-input" id="conv-from-value" value="1">
                <select class="conv-unit-select" id="conv-from-unit"></select>
              </div>
            </div>

            <button class="conv-swap-btn" id="conv-swap-btn" title="Tauschen">⇅</button>

            <div class="conv-row">
              <label class="conv-label" for="conv-to-value">Zu</label>
              <div class="conv-input-group">
                <input type="number" class="modal-input" id="conv-to-value" readonly>
                <select class="conv-unit-select" id="conv-to-unit"></select>
              </div>
            </div>

            <div class="conv-example" id="conv-example"></div>
          </div>
        </div>

        <div class="tool-card tool-card--wide" id="tool-datarate">
          <div class="tool-card-header">
            <span class="tool-card-icon">📡</span>
            <span class="tool-card-title">Datenübertragungsraten-Rechner</span>
          </div>
          <div class="tool-card-body">
            <div class="tool-mode-group" role="group" aria-label="Berechnungsmodus">
              <button class="tool-mode-btn" data-dr-mode="time">Übertragungszeit</button>
              <button class="tool-mode-btn" data-dr-mode="speed">Geschwindigkeit</button>
              <button class="tool-mode-btn" data-dr-mode="amount">Datenmenge</button>
            </div>

            <div class="dr-fields">
              <div class="conv-row" id="dr-row-amount">
                <label class="conv-label" for="dr-amount-value">Datenmenge</label>
                <div class="conv-input-group">
                  <input type="number" class="modal-input" id="dr-amount-value" step="any" min="0">
                  <select class="conv-unit-select dr-unit-select" id="dr-amount-unit"></select>
                </div>
              </div>

              <div class="conv-row" id="dr-row-speed">
                <label class="conv-label" for="dr-speed-value">Übertragungsgeschwindigkeit</label>
                <div class="conv-input-group">
                  <input type="number" class="modal-input" id="dr-speed-value" step="any" min="0">
                  <select class="conv-unit-select dr-unit-select" id="dr-speed-unit"></select>
                </div>
              </div>

              <div class="conv-row" id="dr-row-time">
                <label class="conv-label" for="dr-time-value">Zeit</label>
                <div class="conv-input-group">
                  <input type="number" class="modal-input" id="dr-time-value" step="any" min="0">
                  <select class="conv-unit-select dr-unit-select" id="dr-time-unit"></select>
                </div>
              </div>
            </div>

            <div class="dr-result" id="dr-result">
              <div class="dr-result-top">
                <span class="dr-result-label" id="dr-result-label">Übertragungszeit</span>
                <button class="icon-btn dr-copy-btn" id="dr-copy-btn" title="Ergebnis kopieren">📋</button>
              </div>
              <div class="dr-result-value" id="dr-result-value">–</div>
              <div class="dr-result-sub" id="dr-result-sub"></div>
              <select class="conv-unit-select dr-unit-select dr-result-unit hidden" id="dr-result-unit"></select>
            </div>

            <div class="dr-steps" id="dr-steps"></div>

            <div class="dr-hints">
              <span class="dr-hints-title">Hinweise</span>
              <span>1 Byte = 8 Bit</span>
              <span>SI verwendet 1000er-Schritte (KB, MB, GB, ...)</span>
              <span>IEC verwendet 1024er-Schritte (KiB, MiB, GiB, ...)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  initCalculator();
  initFocusTimer();
  initConverter();
  initDataRateCalculator();
}
window.initTools = initTools;

// =========================================================
// 1) TASCHENRECHNER
// Klassische Rechner-Zustandsmaschine (wie iOS-Taschenrechner):
// aktueller Anzeigewert, gemerkter vorheriger Wert, gemerkter Operator.
// =========================================================

let calcState = { display: '0', prevValue: null, operator: null, waitingForOperand: false, expression: '', justEquals: false };

function initCalculator() {
  calcState = { display: '0', prevValue: null, operator: null, waitingForOperand: false, expression: '', justEquals: false };
  renderCalcDisplay();
  renderCalcExpression();
  renderCalcHistory();

  const card = document.getElementById('tool-calculator');
  if (!card) return;

  card.addEventListener('click', e => {
    const digitBtn = e.target.closest('[data-calc-digit]');
    if (digitBtn) { calcInputDigit(digitBtn.dataset.calcDigit); return; }

    const opBtn = e.target.closest('[data-calc-op]');
    if (opBtn) { calcSetOperator(opBtn.dataset.calcOp); return; }

    if (e.target.closest('#calc-history-toggle')) {
      document.getElementById('calc-history').classList.toggle('hidden');
      return;
    }
    if (e.target.closest('#calc-history-clear')) {
      DB.set('toolsCalcHistory', []);
      renderCalcHistory();
      return;
    }
    const historyItem = e.target.closest('[data-calc-history-result]');
    if (historyItem) { calcLoadHistoryResult(historyItem.dataset.calcHistoryResult); return; }

    const actionBtn = e.target.closest('[data-calc-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.calcAction;
    if (action === 'clear')   calcClear();
    if (action === 'sign')    calcToggleSign();
    if (action === 'percent') calcPercent();
    if (action === 'decimal') calcInputDecimal();
    if (action === 'equals')  calcEquals();
  });
}

function calcResetExpressionIfNeeded() {
  // Nach einem "=" beginnt eine neue Zahl eine neue Rechnung — die
  // abgeschlossene Ausdruckszeile wird dann geleert statt weitergeführt.
  if (calcState.justEquals) {
    calcState.expression = '';
    calcState.justEquals = false;
  }
}

function calcInputDigit(digit) {
  calcResetExpressionIfNeeded();
  if (calcState.waitingForOperand) {
    calcState.display = digit;
    calcState.waitingForOperand = false;
  } else {
    calcState.display = calcState.display === '0' ? digit : calcState.display + digit;
  }
  renderCalcDisplay();
  renderCalcExpression();
}

function calcInputDecimal() {
  calcResetExpressionIfNeeded();
  if (calcState.waitingForOperand) {
    calcState.display = '0,';
    calcState.waitingForOperand = false;
  } else if (!calcState.display.includes(',')) {
    calcState.display += ',';
  }
  renderCalcDisplay();
  renderCalcExpression();
}

function calcClear() {
  calcState = { display: '0', prevValue: null, operator: null, waitingForOperand: false, expression: '', justEquals: false };
  renderCalcDisplay();
  renderCalcExpression();
}

function calcToggleSign() {
  const val = calcDisplayToNumber();
  calcState.display = calcNumberToDisplay(val * -1);
  renderCalcDisplay();
}

function calcPercent() {
  const val = calcDisplayToNumber();
  calcState.display = calcNumberToDisplay(val / 100);
  renderCalcDisplay();
}

function calcSetOperator(nextOperator) {
  calcResetExpressionIfNeeded();
  const inputValue = calcDisplayToNumber();

  if (calcState.operator && calcState.waitingForOperand) {
    // Nur der zuletzt gewählte Operator wird ausgetauscht.
    calcState.expression = calcState.expression.replace(/[+\u2212×÷]\s*$/, `${nextOperator} `);
    calcState.operator = nextOperator;
    renderCalcExpression();
    return;
  }

  if (calcState.prevValue === null) {
    calcState.expression = `${calcState.display} ${nextOperator} `;
    calcState.prevValue = inputValue;
  } else if (calcState.operator) {
    const result = calcApplyOperator(calcState.prevValue, inputValue, calcState.operator);
    calcState.expression += `${calcState.display} ${nextOperator} `;
    calcState.display = calcNumberToDisplay(result);
    calcState.prevValue = result;
    renderCalcDisplay();
  }

  calcState.waitingForOperand = true;
  calcState.operator = nextOperator;
  renderCalcExpression();
}

function calcEquals() {
  if (calcState.operator === null || calcState.prevValue === null) return;
  const inputValue = calcDisplayToNumber();
  const result = calcApplyOperator(calcState.prevValue, inputValue, calcState.operator);
  const fullExpression = `${calcState.expression}${calcState.display} =`;

  calcState.display = calcNumberToDisplay(result);
  calcState.prevValue = null;
  calcState.operator = null;
  calcState.waitingForOperand = true;
  calcState.expression = fullExpression;
  calcState.justEquals = true;

  renderCalcDisplay();
  renderCalcExpression();
  calcPushHistory(fullExpression, calcState.display);
}

function calcApplyOperator(a, b, op) {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? 0 : a / b;
  return b;
}

function calcDisplayToNumber() {
  return parseFloat(calcState.display.replace(',', '.')) || 0;
}

function calcNumberToDisplay(num) {
  // Rundung gegen Float-Ungenauigkeiten, danach Punkt → Komma für die Anzeige.
  const rounded = Math.round(num * 1e10) / 1e10;
  return String(rounded).replace('.', ',');
}

function renderCalcDisplay() {
  const el = document.getElementById('calc-display');
  if (el) el.textContent = calcState.display;
}

function renderCalcExpression() {
  const el = document.getElementById('calc-expression');
  if (el) el.textContent = calcState.expression || '\u00A0';
}

function calcPushHistory(expression, result) {
  const history = DB.get('toolsCalcHistory', []);
  history.push({ expression, result });
  DB.set('toolsCalcHistory', history.slice(-10));
  renderCalcHistory();
}

function renderCalcHistory() {
  const listEl = document.getElementById('calc-history-list');
  if (!listEl) return;
  const history = DB.get('toolsCalcHistory', []);
  if (history.length === 0) {
    listEl.innerHTML = '<div class="calc-history-empty">Noch keine Berechnungen.</div>';
    return;
  }
  listEl.innerHTML = history.slice().reverse().map(h =>
    `<button class="calc-history-item" data-calc-history-result="${h.result}">${h.expression} ${h.result}</button>`
  ).join('');
}

function calcLoadHistoryResult(result) {
  calcState.display = result;
  calcState.prevValue = null;
  calcState.operator = null;
  calcState.expression = '';
  calcState.waitingForOperand = false;
  calcState.justEquals = false;
  renderCalcDisplay();
  renderCalcExpression();
  document.getElementById('calc-history').classList.add('hidden');
}

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

// =========================================================
// GETEILTE REGISTRY: DATENEINHEITEN (Bit-basiert)
// Wird sowohl vom Converter (Kategorie "Datenmenge") als auch vom
// Datenübertragungsraten-Rechner (Section 4) genutzt — eine einzige
// Quelle für alle Bit/Byte-Einheiten, keine Duplikate. Basiseinheit
// ist Bit; SI (1000er) und IEC (1024er) sind sauber getrennt.
// =========================================================

const DR_UNIT_FACTORS = {
  bit:   { label: 'Bit',   group: 'Bit (SI)',    factor: 1 },
  kbit:  { label: 'kbit',  group: 'Bit (SI)',    factor: 1e3 },
  mbit:  { label: 'Mbit',  group: 'Bit (SI)',    factor: 1e6 },
  gbit:  { label: 'Gbit',  group: 'Bit (SI)',    factor: 1e9 },
  tbit:  { label: 'Tbit',  group: 'Bit (SI)',    factor: 1e12 },

  kibit: { label: 'Kibit', group: 'Bit (IEC)',   factor: 1024 },
  mibit: { label: 'Mibit', group: 'Bit (IEC)',   factor: 1024 ** 2 },
  gibit: { label: 'Gibit', group: 'Bit (IEC)',   factor: 1024 ** 3 },
  tibit: { label: 'Tibit', group: 'Bit (IEC)',   factor: 1024 ** 4 },

  byte:  { label: 'Byte',  group: 'Byte (SI)',   factor: 8 },
  kb:    { label: 'KB',    group: 'Byte (SI)',   factor: 8e3 },
  mb:    { label: 'MB',    group: 'Byte (SI)',   factor: 8e6 },
  gb:    { label: 'GB',    group: 'Byte (SI)',   factor: 8e9 },
  tb:    { label: 'TB',    group: 'Byte (SI)',   factor: 8e12 },

  kib:   { label: 'KiB',   group: 'Byte (IEC)',  factor: 8 * 1024 },
  mib:   { label: 'MiB',   group: 'Byte (IEC)',  factor: 8 * 1024 ** 2 },
  gib:   { label: 'GiB',   group: 'Byte (IEC)',  factor: 8 * 1024 ** 3 },
  tib:   { label: 'TiB',   group: 'Byte (IEC)',  factor: 8 * 1024 ** 4 }
};

// =========================================================
// 3) CONVERTER
// Datengetrieben: eine Kategorie-Registry mit Umrechnungsfaktoren
// zur jeweiligen Basiseinheit. Temperatur ist die einzige Ausnahme
// (braucht Formeln statt reiner Faktoren) und darum als "special"
// markiert. Neue Kategorien/Einheiten = neuer Registry-Eintrag,
// keine Logikänderung nötig.
// =========================================================

const TOOLS_CONVERTER_CATEGORIES = {
  length: {
    label: 'Länge',
    defaultFrom: 'cm', defaultTo: 'inch',
    units: {
      mm:   { label: 'mm',    factor: 0.001 },
      cm:   { label: 'cm',    factor: 0.01 },
      m:    { label: 'm',     factor: 1 },
      km:   { label: 'km',    factor: 1000 },
      inch: { label: 'inch',  factor: 0.0254 },
      ft:   { label: 'ft',    factor: 0.3048 },
      yard: { label: 'yard',  factor: 0.9144 },
      mile: { label: 'mile',  factor: 1609.344 }
    }
  },
  weight: {
    label: 'Gewicht',
    defaultFrom: 'kg', defaultTo: 'lb',
    units: {
      mg: { label: 'mg', factor: 0.000001 },
      g:  { label: 'g',  factor: 0.001 },
      kg: { label: 'kg', factor: 1 },
      t:  { label: 't',  factor: 1000 },
      lb: { label: 'lb', factor: 0.45359237 },
      oz: { label: 'oz', factor: 0.028349523125 }
    }
  },
  temperature: {
    label: 'Temperatur',
    defaultFrom: 'c', defaultTo: 'f',
    special: true,
    units: {
      c: { label: '°C' },
      f: { label: '°F' },
      k: { label: 'K' }
    }
  },
  data: {
    label: '💾 Datenmenge',
    defaultFrom: 'mib', defaultTo: 'gib',
    // Nutzt direkt die geteilte DR_UNIT_FACTORS-Registry (Basis Bit) —
    // dieselben Einheiten wie im Datenübertragungsraten-Rechner, keine
    // eigene/duplizierte Umrechnungstabelle.
    units: Object.fromEntries(
      Object.entries(DR_UNIT_FACTORS).map(([key, u]) => [key, { label: u.label, factor: u.factor }])
    )
  },
  time: {
    label: 'Zeit',
    defaultFrom: 'min', defaultTo: 'sec',
    units: {
      sec:   { label: 'Sek.',   factor: 1 },
      min:   { label: 'Min.',   factor: 60 },
      hour:  { label: 'Std.',   factor: 3600 },
      day:   { label: 'Tag',    factor: 86400 },
      week:  { label: 'Woche',  factor: 604800 },
      month: { label: 'Monat',  factor: 2592000 },
      year:  { label: 'Jahr',   factor: 31536000 }
    }
  }
};

function toolsConvertTemperature(from, to, value) {
  let celsius;
  if (from === 'c') celsius = value;
  else if (from === 'f') celsius = (value - 32) * 5 / 9;
  else celsius = value - 273.15;

  if (to === 'c') return celsius;
  if (to === 'f') return celsius * 9 / 5 + 32;
  return celsius + 273.15;
}

function toolsConvertValue(categoryKey, fromKey, toKey, value) {
  const cat = TOOLS_CONVERTER_CATEGORIES[categoryKey];
  if (!cat) return 0;
  if (cat.special) return toolsConvertTemperature(fromKey, toKey, value);

  const fromUnit = cat.units[fromKey];
  const toUnit = cat.units[toKey];
  if (!fromUnit || !toUnit) return 0;

  const base = value * fromUnit.factor;
  return base / toUnit.factor;
}

function toolsFormatConvResult(num) {
  if (!isFinite(num)) return '0';
  const rounded = Math.round(num * 10000) / 10000;
  return String(rounded);
}

let convState = { category: 'length', from: 'cm', to: 'inch' };

function initConverter() {
  const saved = DB.get('toolsConverterState', null);
  if (saved && TOOLS_CONVERTER_CATEGORIES[saved.category]) {
    convState = saved;
  }

  const categorySelect = document.getElementById('conv-category');
  categorySelect.innerHTML = Object.entries(TOOLS_CONVERTER_CATEGORIES)
    .map(([key, cat]) => `<option value="${key}">${cat.label}</option>`).join('');
  categorySelect.value = convState.category;

  populateConverterUnitSelects();

  categorySelect.addEventListener('change', () => {
    convState.category = categorySelect.value;
    const cat = TOOLS_CONVERTER_CATEGORIES[convState.category];
    convState.from = cat.defaultFrom;
    convState.to = cat.defaultTo;
    populateConverterUnitSelects();
    saveConverterState();
    renderConverter();
  });

  document.getElementById('conv-from-unit').addEventListener('change', e => {
    convState.from = e.target.value;
    saveConverterState();
    renderConverter();
  });
  document.getElementById('conv-to-unit').addEventListener('change', e => {
    convState.to = e.target.value;
    saveConverterState();
    renderConverter();
  });
  document.getElementById('conv-from-value').addEventListener('input', renderConverter);

  document.getElementById('conv-swap-btn').addEventListener('click', () => {
    const tmp = convState.from;
    convState.from = convState.to;
    convState.to = tmp;
    populateConverterUnitSelects();
    saveConverterState();
    renderConverter();
  });

  renderConverter();
}

function populateConverterUnitSelects() {
  const cat = TOOLS_CONVERTER_CATEGORIES[convState.category];
  const fromSelect = document.getElementById('conv-from-unit');
  const toSelect = document.getElementById('conv-to-unit');

  const optionsHtml = Object.entries(cat.units)
    .map(([key, u]) => `<option value="${key}">${u.label}</option>`).join('');

  fromSelect.innerHTML = optionsHtml;
  toSelect.innerHTML = optionsHtml;
  fromSelect.value = convState.from;
  toSelect.value = convState.to;
}

function saveConverterState() {
  DB.set('toolsConverterState', convState);
}

function renderConverter() {
  const cat = TOOLS_CONVERTER_CATEGORIES[convState.category];
  const fromValue = parseFloat(document.getElementById('conv-from-value').value) || 0;

  const result = toolsConvertValue(convState.category, convState.from, convState.to, fromValue);
  document.getElementById('conv-to-value').value = toolsFormatConvResult(result);

  const exampleResult = toolsConvertValue(convState.category, convState.from, convState.to, 1);
  const fromLabel = cat.units[convState.from].label;
  const toLabel = cat.units[convState.to].label;
  document.getElementById('conv-example').textContent =
    `1 ${fromLabel} = ${toolsFormatConvResult(exampleResult)} ${toLabel}`;
}

// =========================================================
// 4) DATENÜBERTRAGUNGSRATEN-RECHNER
// Datengetrieben wie der Converter: eine Einheiten-Registry mit
// Faktoren zur Basiseinheit Bit. Dieselbe Registry bedient sowohl
// die Datenmenge- als auch die Geschwindigkeits-Dropdowns (Faktoren
// sind identisch, bei Geschwindigkeit kommt nur "/s" als Suffix
// dazu) — keine Duplikate.
//
// Alle drei Größen (Datenmenge, Geschwindigkeit, Zeit) bleiben immer
// im State, unabhängig vom aktiven Modus. Nur die Sichtbarkeit der
// Eingabezeilen und die große Ergebniskarte wechseln — so bleiben
// bereits eingegebene Werte beim Moduswechsel erhalten und es gibt
// keine unnötigen Re-Renders der restlichen UI.
// =========================================================

// DR_UNIT_FACTORS ist jetzt in der geteilten Registry vor Section 3
// definiert (wird auch vom Converter für die Kategorie "Datenmenge"
// verwendet) — keine Duplikate.

const DR_TIME_UNITS = {
  ms:   { label: 'ms',    factor: 0.001 },
  sec:  { label: 'Sek.',  factor: 1 },
  min:  { label: 'Min.',  factor: 60 },
  hour: { label: 'Std.',  factor: 3600 },
  day:  { label: 'Tage',  factor: 86400 }
};

let drState = {
  mode: 'time',
  amountValue: 100, amountUnit: 'mib',
  speedValue: 100,  speedUnit: 'mbit',
  timeValue: 1,     timeUnit: 'sec',
  resultSpeedUnit: 'mbit',
  resultAmountUnit: 'mb'
};

function drToBits(value, unitKey) {
  const u = DR_UNIT_FACTORS[unitKey];
  return u ? value * u.factor : 0;
}

function drBitsToUnit(bits, unitKey) {
  const u = DR_UNIT_FACTORS[unitKey];
  return u ? bits / u.factor : 0;
}

function drTimeToSeconds(value, unitKey) {
  const u = DR_TIME_UNITS[unitKey];
  return u ? value * u.factor : 0;
}

function drUnitLabel(unitKey) {
  const u = DR_UNIT_FACTORS[unitKey];
  return u ? u.label : '';
}

function drTimeLabel(unitKey) {
  const u = DR_TIME_UNITS[unitKey];
  return u ? u.label : '';
}

function drBuildUnitOptions(suffix = '') {
  const groups = {};
  Object.entries(DR_UNIT_FACTORS).forEach(([key, u]) => {
    if (!groups[u.group]) groups[u.group] = [];
    groups[u.group].push(`<option value="${key}">${u.label}${suffix}</option>`);
  });
  return Object.entries(groups)
    .map(([group, opts]) => `<optgroup label="${group}${suffix ? ' / s' : ''}">${opts.join('')}</optgroup>`)
    .join('');
}

function drBuildTimeOptions() {
  return Object.entries(DR_TIME_UNITS)
    .map(([key, u]) => `<option value="${key}">${u.label}</option>`).join('');
}

function drFormatDecimal(num, maxDecimals = 2) {
  if (!isFinite(num)) return '0';
  return num.toLocaleString('de-DE', { maximumFractionDigits: maxDecimals });
}

function drFormatInt(num) {
  if (!isFinite(num)) return '0';
  return Math.round(num).toLocaleString('de-DE');
}

function drFormatDuration(totalSec) {
  let rem = Math.floor(totalSec);
  const days = Math.floor(rem / 86400); rem %= 86400;
  const hours = Math.floor(rem / 3600); rem %= 3600;
  const minutes = Math.floor(rem / 60); rem %= 60;
  const seconds = rem;

  const parts = [];
  let started = false;
  if (days > 0) { parts.push(`${days} ${days === 1 ? 'Tag' : 'Tage'}`); started = true; }
  if (started || hours > 0) { parts.push(`${hours} Std.`); started = true; }
  if (started || minutes > 0) { parts.push(`${minutes} Min.`); started = true; }
  parts.push(`${seconds} Sek.`);
  return parts.join(', ');
}

function drBuildSteps(...lines) {
  return lines.map(l => `<div class="dr-step-line">${l}</div>`).join('');
}

function drSaveState() {
  DB.set('toolsDataRateState', drState);
}

function initDataRateCalculator() {
  const saved = DB.get('toolsDataRateState', null);
  if (saved && DR_UNIT_FACTORS[saved.amountUnit] && DR_UNIT_FACTORS[saved.speedUnit] &&
      DR_TIME_UNITS[saved.timeUnit] && ['time', 'speed', 'amount'].includes(saved.mode)) {
    drState = Object.assign({}, drState, saved);
  }

  document.getElementById('dr-amount-unit').innerHTML = drBuildUnitOptions();
  document.getElementById('dr-speed-unit').innerHTML = drBuildUnitOptions('/s');
  document.getElementById('dr-time-unit').innerHTML = drBuildTimeOptions();

  document.getElementById('dr-amount-value').value = drState.amountValue;
  document.getElementById('dr-amount-unit').value = drState.amountUnit;
  document.getElementById('dr-speed-value').value = drState.speedValue;
  document.getElementById('dr-speed-unit').value = drState.speedUnit;
  document.getElementById('dr-time-value').value = drState.timeValue;
  document.getElementById('dr-time-unit').value = drState.timeUnit;

  document.querySelectorAll('.tool-mode-group [data-dr-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.drMode === drState.mode) return;
      drState.mode = btn.dataset.drMode;
      drSaveState();
      drApplyMode();
      drCompute();
    });
  });

  ['dr-amount-value', 'dr-amount-unit', 'dr-speed-value', 'dr-speed-unit', 'dr-time-value', 'dr-time-unit']
    .forEach(id => document.getElementById(id).addEventListener('input', drHandleInputChange));

  document.getElementById('dr-result-unit').addEventListener('change', e => {
    if (drState.mode === 'speed') drState.resultSpeedUnit = e.target.value;
    if (drState.mode === 'amount') drState.resultAmountUnit = e.target.value;
    drSaveState();
    drCompute();
  });

  document.getElementById('dr-copy-btn').addEventListener('click', drCopyResult);

  drApplyMode();
  drCompute();
}

function drHandleInputChange() {
  drState.amountValue = parseFloat(document.getElementById('dr-amount-value').value) || 0;
  drState.amountUnit = document.getElementById('dr-amount-unit').value;
  drState.speedValue = parseFloat(document.getElementById('dr-speed-value').value) || 0;
  drState.speedUnit = document.getElementById('dr-speed-unit').value;
  drState.timeValue = parseFloat(document.getElementById('dr-time-value').value) || 0;
  drState.timeUnit = document.getElementById('dr-time-unit').value;
  drSaveState();
  drCompute();
}

function drApplyMode() {
  document.querySelectorAll('.tool-mode-group [data-dr-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.drMode === drState.mode);
  });

  document.getElementById('dr-row-amount').classList.toggle('hidden', drState.mode === 'amount');
  document.getElementById('dr-row-speed').classList.toggle('hidden', drState.mode === 'speed');
  document.getElementById('dr-row-time').classList.toggle('hidden', drState.mode === 'time');

  const resultUnitEl = document.getElementById('dr-result-unit');
  if (drState.mode === 'speed') {
    resultUnitEl.innerHTML = drBuildUnitOptions('/s');
    resultUnitEl.value = drState.resultSpeedUnit;
    resultUnitEl.classList.remove('hidden');
  } else if (drState.mode === 'amount') {
    resultUnitEl.innerHTML = drBuildUnitOptions();
    resultUnitEl.value = drState.resultAmountUnit;
    resultUnitEl.classList.remove('hidden');
  } else {
    resultUnitEl.classList.add('hidden');
  }
}

function drCompute() {
  const amountBits = drToBits(drState.amountValue, drState.amountUnit);
  const speedBps = drToBits(drState.speedValue, drState.speedUnit);
  const timeSec = drTimeToSeconds(drState.timeValue, drState.timeUnit);

  const labelEl = document.getElementById('dr-result-label');
  const valueEl = document.getElementById('dr-result-value');
  const subEl = document.getElementById('dr-result-sub');
  const stepsEl = document.getElementById('dr-steps');

  if (drState.mode === 'time') {
    labelEl.textContent = 'Übertragungszeit';
    if (speedBps <= 0) {
      valueEl.textContent = '–';
      subEl.textContent = 'Geschwindigkeit muss größer als 0 sein.';
      stepsEl.innerHTML = '';
      return;
    }
    const totalSec = amountBits / speedBps;
    valueEl.textContent = `${drFormatDecimal(totalSec, 2)} Sekunden`;
    subEl.textContent = totalSec >= 60 ? drFormatDuration(totalSec) : '';
    stepsEl.innerHTML = drBuildSteps(
      `${drFormatDecimal(drState.amountValue, 4)} ${drUnitLabel(drState.amountUnit)} = ${drFormatInt(amountBits)} Bit`,
      `${drFormatDecimal(drState.speedValue, 4)} ${drUnitLabel(drState.speedUnit)}/s = ${drFormatInt(speedBps)} Bit/s`,
      `${drFormatInt(amountBits)} Bit ÷ ${drFormatInt(speedBps)} Bit/s = ${drFormatDecimal(totalSec, 2)} Sekunden`
    );

  } else if (drState.mode === 'speed') {
    labelEl.textContent = 'Übertragungsgeschwindigkeit';
    if (timeSec <= 0) {
      valueEl.textContent = '–';
      subEl.textContent = 'Zeit muss größer als 0 sein.';
      stepsEl.innerHTML = '';
      return;
    }
    const speedResultBps = amountBits / timeSec;
    const displayValue = drBitsToUnit(speedResultBps, drState.resultSpeedUnit);
    valueEl.textContent = `${drFormatDecimal(displayValue, 4)} ${drUnitLabel(drState.resultSpeedUnit)}/s`;
    subEl.textContent = '';
    stepsEl.innerHTML = drBuildSteps(
      `${drFormatDecimal(drState.amountValue, 4)} ${drUnitLabel(drState.amountUnit)} = ${drFormatInt(amountBits)} Bit`,
      `${drFormatDecimal(drState.timeValue, 4)} ${drTimeLabel(drState.timeUnit)} = ${drFormatDecimal(timeSec, 2)} Sekunden`,
      `${drFormatInt(amountBits)} Bit ÷ ${drFormatDecimal(timeSec, 2)} Sekunden = ${drFormatInt(speedResultBps)} Bit/s`
    );

  } else {
    labelEl.textContent = 'Datenmenge';
    if (timeSec <= 0) {
      valueEl.textContent = '–';
      subEl.textContent = 'Zeit muss größer als 0 sein.';
      stepsEl.innerHTML = '';
      return;
    }
    const amountResultBits = speedBps * timeSec;
    const displayValue = drBitsToUnit(amountResultBits, drState.resultAmountUnit);
    valueEl.textContent = `${drFormatDecimal(displayValue, 4)} ${drUnitLabel(drState.resultAmountUnit)}`;
    subEl.textContent = '';
    stepsEl.innerHTML = drBuildSteps(
      `${drFormatDecimal(drState.speedValue, 4)} ${drUnitLabel(drState.speedUnit)}/s = ${drFormatInt(speedBps)} Bit/s`,
      `${drFormatDecimal(drState.timeValue, 4)} ${drTimeLabel(drState.timeUnit)} = ${drFormatDecimal(timeSec, 2)} Sekunden`,
      `${drFormatInt(speedBps)} Bit/s × ${drFormatDecimal(timeSec, 2)} Sekunden = ${drFormatInt(amountResultBits)} Bit`
    );
  }
}

function drCopyResult() {
  const text = document.getElementById('dr-result-value').textContent;
  const btn = document.getElementById('dr-copy-btn');
  if (!navigator.clipboard) return;
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = original; }, 1200);
  }).catch(() => {});
}
