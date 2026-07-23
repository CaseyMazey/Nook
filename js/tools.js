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
          </div>
        </div>

        <div class="tool-card" id="tool-timer">
          <div class="tool-card-header">
            <span class="tool-card-icon">🍅</span>
            <span class="tool-card-title">Focus Timer</span>
          </div>
          <div class="tool-card-body">
            <div class="timer-ring-wrap">
              <svg class="timer-ring" viewBox="0 0 200 200">
                <circle class="timer-ring-bg" cx="100" cy="100" r="90"></circle>
                <circle class="timer-ring-fg" id="timer-ring-fg" cx="100" cy="100" r="90"></circle>
              </svg>
              <div class="timer-ring-content">
                <div class="timer-time" id="timer-time">25:00</div>
                <div class="timer-mode-pill" id="timer-mode-pill">Fokus</div>
              </div>
            </div>
            <div class="timer-sessions" id="timer-sessions">🍅 0 / 4</div>
            <div class="timer-controls">
              <button class="btn-primary timer-start-btn" id="timer-toggle-btn">Start</button>
              <button class="icon-btn" id="timer-reset-btn" title="Zurücksetzen">↻</button>
            </div>
            <button class="tool-settings-toggle" id="timer-settings-toggle">Einstellungen</button>
            <div class="timer-settings hidden" id="timer-settings">
              <label>Fokus (Min)<input type="number" min="1" max="180" id="timer-set-work"></label>
              <label>Kurze Pause (Min)<input type="number" min="1" max="60" id="timer-set-short"></label>
              <label>Lange Pause (Min)<input type="number" min="1" max="90" id="timer-set-long"></label>
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

      </div>
    </div>
  `;

  initCalculator();
  initFocusTimer();
  initConverter();
}
window.initTools = initTools;

// =========================================================
// 1) TASCHENRECHNER
// Klassische Rechner-Zustandsmaschine (wie iOS-Taschenrechner):
// aktueller Anzeigewert, gemerkter vorheriger Wert, gemerkter Operator.
// =========================================================

let calcState = { display: '0', prevValue: null, operator: null, waitingForOperand: false };

function initCalculator() {
  calcState = { display: '0', prevValue: null, operator: null, waitingForOperand: false };
  renderCalcDisplay();

  const card = document.getElementById('tool-calculator');
  if (!card) return;

  card.addEventListener('click', e => {
    const digitBtn = e.target.closest('[data-calc-digit]');
    if (digitBtn) { calcInputDigit(digitBtn.dataset.calcDigit); return; }

    const opBtn = e.target.closest('[data-calc-op]');
    if (opBtn) { calcSetOperator(opBtn.dataset.calcOp); return; }

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

function calcInputDigit(digit) {
  if (calcState.waitingForOperand) {
    calcState.display = digit;
    calcState.waitingForOperand = false;
  } else {
    calcState.display = calcState.display === '0' ? digit : calcState.display + digit;
  }
  renderCalcDisplay();
}

function calcInputDecimal() {
  if (calcState.waitingForOperand) {
    calcState.display = '0,';
    calcState.waitingForOperand = false;
  } else if (!calcState.display.includes(',')) {
    calcState.display += ',';
  }
  renderCalcDisplay();
}

function calcClear() {
  calcState = { display: '0', prevValue: null, operator: null, waitingForOperand: false };
  renderCalcDisplay();
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
  const inputValue = calcDisplayToNumber();

  if (calcState.operator && calcState.waitingForOperand) {
    calcState.operator = nextOperator;
    return;
  }

  if (calcState.prevValue === null) {
    calcState.prevValue = inputValue;
  } else if (calcState.operator) {
    const result = calcApplyOperator(calcState.prevValue, inputValue, calcState.operator);
    calcState.display = calcNumberToDisplay(result);
    calcState.prevValue = result;
    renderCalcDisplay();
  }

  calcState.waitingForOperand = true;
  calcState.operator = nextOperator;
}

function calcEquals() {
  if (calcState.operator === null || calcState.prevValue === null) return;
  const inputValue = calcDisplayToNumber();
  const result = calcApplyOperator(calcState.prevValue, inputValue, calcState.operator);
  calcState.display = calcNumberToDisplay(result);
  calcState.prevValue = null;
  calcState.operator = null;
  calcState.waitingForOperand = true;
  renderCalcDisplay();
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

// =========================================================
// 2) FOCUS TIMER
// Klassisches Pomodoro-Schema: Fokus → kurze Pause, nach jeder 4.
// Fokus-Session eine lange Pause. Zustand wird persistiert (Dauer-
// Einstellungen + heutiger Session-Zähler); der Timer selbst läuft
// nur innerhalb der offenen Session weiter (kein Hintergrund-Tick
// über Page-Reloads hinweg — bewusst einfach gehalten).
// =========================================================

const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * 90;

let timerState = null;
let timerInterval = null;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadTimerState() {
  const saved = DB.get('toolsFocusTimer', null);
  const defaults = { workMin: 25, shortMin: 5, longMin: 15, sessionCount: 0, lastDate: todayKey() };
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
    sessionCount: timerState.sessionCount,
    lastDate: timerState.lastDate
  });
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
    running: false
  });
  timerState.remainingSec = timerModeDuration('focus');

  document.getElementById('timer-set-work').value = timerState.workMin;
  document.getElementById('timer-set-short').value = timerState.shortMin;
  document.getElementById('timer-set-long').value = timerState.longMin;

  renderTimer();

  document.getElementById('timer-toggle-btn').addEventListener('click', timerToggle);
  document.getElementById('timer-reset-btn').addEventListener('click', timerReset);

  document.getElementById('timer-settings-toggle').addEventListener('click', () => {
    document.getElementById('timer-settings').classList.toggle('hidden');
  });

  ['timer-set-work', 'timer-set-short', 'timer-set-long'].forEach(id => {
    document.getElementById(id).addEventListener('change', timerApplySettings);
  });
}

function timerApplySettings() {
  const work = Math.max(1, parseInt(document.getElementById('timer-set-work').value, 10) || 25);
  const short = Math.max(1, parseInt(document.getElementById('timer-set-short').value, 10) || 5);
  const long = Math.max(1, parseInt(document.getElementById('timer-set-long').value, 10) || 15);

  timerState.workMin = work;
  timerState.shortMin = short;
  timerState.longMin = long;
  saveTimerState();

  // Läuft der Timer gerade nicht, direkt an neue Dauer anpassen.
  if (!timerState.running) {
    timerState.remainingSec = timerModeDuration(timerState.mode);
    renderTimer();
  }
}

function timerToggle() {
  timerState.running = !timerState.running;

  if (timerState.running) {
    timerInterval = setInterval(timerTick, 1000);
  } else {
    clearInterval(timerInterval);
  }
  renderTimer();
}

function timerReset() {
  clearInterval(timerInterval);
  timerState.running = false;
  timerState.mode = 'focus';
  timerState.remainingSec = timerModeDuration('focus');
  renderTimer();
}

function timerTick() {
  timerState.remainingSec--;

  if (timerState.remainingSec <= 0) {
    timerAdvanceMode();
  }
  renderTimer();
}

function timerAdvanceMode() {
  if (timerState.mode === 'focus') {
    timerState.sessionCount++;
    timerState.lastDate = todayKey();
    saveTimerState();
    timerState.mode = (timerState.sessionCount % 4 === 0) ? 'long' : 'short';
  } else {
    timerState.mode = 'focus';
  }
  timerState.remainingSec = timerModeDuration(timerState.mode);
}

function renderTimer() {
  const total = timerModeDuration(timerState.mode);
  const fractionRemaining = Math.max(0, Math.min(1, timerState.remainingSec / total));

  const mins = Math.floor(timerState.remainingSec / 60);
  const secs = timerState.remainingSec % 60;
  document.getElementById('timer-time').textContent =
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  document.getElementById('timer-mode-pill').textContent = timerModeLabel(timerState.mode);

  const cyclePos = (timerState.sessionCount % 4 === 0 && timerState.sessionCount > 0) ? 4 : timerState.sessionCount % 4;
  document.getElementById('timer-sessions').textContent = `🍅 ${cyclePos} / 4`;

  const ring = document.getElementById('timer-ring-fg');
  const offset = TIMER_RING_CIRCUMFERENCE * (1 - fractionRemaining);
  ring.style.strokeDasharray = String(TIMER_RING_CIRCUMFERENCE);
  ring.style.strokeDashoffset = String(offset);

  document.getElementById('timer-toggle-btn').textContent = timerState.running ? 'Pause' : 'Start';
}

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
    label: 'Datenmenge',
    defaultFrom: 'mb', defaultTo: 'gb',
    units: {
      bit:  { label: 'Bit',  factor: 0.125 },
      byte: { label: 'Byte', factor: 1 },
      kb:   { label: 'KB',   factor: 1024 },
      mb:   { label: 'MB',   factor: 1024 ** 2 },
      gb:   { label: 'GB',   factor: 1024 ** 3 },
      tb:   { label: 'TB',   factor: 1024 ** 4 }
    }
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
