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
            <label class="dr-learn-switch" for="dr-learn-toggle" title="Lernmodus: Rechenweg Schritt für Schritt erklären">
              <span class="dr-learn-switch-label">🎓 Lernmodus</span>
              <span class="toggle"><input type="checkbox" id="dr-learn-toggle"><span class="toggle-slider"></span></span>
            </label>
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

            <div class="dr-layout" id="dr-layout">
              <div class="dr-result-col">
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
              </div>

              <div class="dr-learn-col" id="dr-learn-col">
                <div class="dr-learn-cards" id="dr-learn-cards"></div>
                <div class="dr-learn-info">
                  <span class="dr-learn-info-icon">💡</span>
                  <span>Bit/s (Bit pro Sekunde) gibt an, wie viele Bits in einer Sekunde übertragen werden — die Basisgröße jeder Übertragungsgeschwindigkeit.</span>
                </div>
              </div>
            </div>

            <div class="dr-hints">
              <span class="dr-hints-title">Hinweise</span>
              <span>1 Byte = 8 Bit</span>
              <span>SI verwendet 1000er-Schritte (KB, MB, GB, ...)</span>
              <span>IEC verwendet 1024er-Schritte (KiB, MiB, GiB, ...)</span>
            </div>
          </div>
        </div>

        <div class="tool-card tool-card--wide" id="tool-notenmanager">
          <div class="tool-card-header">
            <span class="tool-card-icon">🎓</span>
            <span class="tool-card-title">Notenmanager</span>
            <button class="icon-btn noten-header-btn" id="noten-settings-btn" title="Einstellungen">⚙</button>
            <button class="btn-ghost" id="noten-add-year-btn">+ Ausbildungsjahr</button>
          </div>
          <div class="tool-card-body">
            <div class="noten-years-list" id="noten-years-list"></div>
            <div class="noten-empty hidden" id="noten-empty">Noch keine Ausbildungsjahre angelegt. Lege dein erstes mit „+ Ausbildungsjahr" an.</div>
          </div>
        </div>

      </div>

      <!-- Notenmanager: Ausbildungsjahr anlegen/bearbeiten -->
      <div id="noten-year-modal-overlay" class="modal-backdrop hidden">
        <div class="modal-box" style="width:400px;">
          <div class="modal-head"><span id="noten-year-modal-title">Neues Ausbildungsjahr</span><button class="modal-x" id="noten-year-modal-close">&#10005;</button></div>
          <div class="modal-row"><label>Bezeichnung</label><input type="text" class="modal-input" id="noten-year-name" placeholder="z.B. 1. Ausbildungsjahr" autocomplete="off"/></div>
          <div class="modal-actions hidden" id="noten-year-subject-row" style="justify-content:flex-start;">
            <button class="btn-ghost" id="noten-year-add-subject-btn">+ Fach</button>
          </div>
          <div class="modal-actions"><button id="noten-year-cancel" class="btn-ghost">Abbrechen</button><button id="noten-year-save" class="btn-primary">Speichern</button></div>
        </div>
      </div>

      <!-- Notenmanager: Einstellungen (globale Kategorien) -->
      <div id="noten-settings-modal-overlay" class="modal-backdrop hidden">
        <div class="modal-box" style="width:420px;max-height:82vh;">
          <div class="modal-head"><span>Notenmanager-Einstellungen</span><button class="modal-x" id="noten-settings-modal-close">&#10005;</button></div>
          <div class="modal-row modal-row-inline"><label>Kategorien</label><button class="icon-btn" id="noten-settings-add-cat-btn" title="Kategorie hinzufügen">+</button></div>
          <p class="modal-hint">Kategorien gelten für alle Ausbildungsjahre. Die Standardgewichtung wird beim Anlegen einer Leistung übernommen, bleibt aber pro Leistung änderbar.</p>
          <div class="noten-category-rows" id="noten-settings-category-rows"></div>
          <div class="modal-actions"><button id="noten-settings-close-btn" class="btn-primary">Schließen</button></div>
        </div>
      </div>

      <!-- Notenmanager: Fach anlegen/umbenennen -->
      <div id="noten-subject-modal-overlay" class="modal-backdrop hidden">
        <div class="modal-box" style="width:400px;">
          <div class="modal-head"><span id="noten-subject-modal-title">Neues Fach</span><button class="modal-x" id="noten-subject-modal-close">&#10005;</button></div>
          <div class="modal-row"><label>Fachname</label><input type="text" class="modal-input" id="noten-subject-name" placeholder="z.B. LF1" autocomplete="off"/></div>
          <div class="modal-actions"><button id="noten-subject-cancel" class="btn-ghost">Abbrechen</button><button id="noten-subject-save" class="btn-primary">Speichern</button></div>
        </div>
      </div>

      <!-- Notenmanager: Zeugnis anlegen/bearbeiten -->
      <div id="noten-report-modal-overlay" class="modal-backdrop hidden" style="z-index:300;">
        <div class="modal-box" style="width:440px;max-height:82vh;">
          <div class="modal-head"><span id="noten-report-modal-title">Neues Zeugnis</span><button class="modal-x" id="noten-report-modal-close">&#10005;</button></div>
          <div class="modal-row"><label>Name</label><input type="text" class="modal-input" id="noten-report-name" placeholder="z.B. Halbjahreszeugnis" autocomplete="off"/></div>
          <div class="noten-report-grades" id="noten-report-grades"></div>
          <div class="modal-row"><label>Kommentar (optional)</label><textarea class="modal-textarea" id="noten-report-comment" placeholder="Notizen zum Zeugnis..."></textarea></div>
          <div class="modal-actions"><button id="noten-report-cancel" class="btn-ghost">Abbrechen</button><button id="noten-report-save" class="btn-primary">Speichern</button></div>
        </div>
      </div>

      <!-- Notenmanager: Zeugnisse vergleichen -->
      <div id="noten-compare-modal-overlay" class="modal-backdrop hidden" style="z-index:300;">
        <div class="modal-box" style="width:480px;max-height:82vh;">
          <div class="modal-head"><span>Zeugnisse vergleichen</span><button class="modal-x" id="noten-compare-modal-close">&#10005;</button></div>
          <div class="noten-compare-selects">
            <select class="modal-select" id="noten-compare-select-a"></select>
            <span class="noten-compare-arrow">→</span>
            <select class="modal-select" id="noten-compare-select-b"></select>
          </div>
          <div class="noten-compare-table" id="noten-compare-table"></div>
          <div class="modal-actions"><button id="noten-compare-close-btn" class="btn-primary">Schließen</button></div>
        </div>
      </div>

      <!-- Notenmanager: Leistung anlegen/bearbeiten -->
      <div id="noten-entry-modal-overlay" class="modal-backdrop hidden" style="z-index:300;">
        <div class="modal-box" style="width:400px;">
          <div class="modal-head"><span id="noten-entry-modal-title">Neue Leistung</span><button class="modal-x" id="noten-entry-modal-close">&#10005;</button></div>
          <div class="modal-row"><label>Datum</label><input type="date" class="modal-date" id="noten-entry-date"/></div>
          <div class="modal-row"><label>Kategorie</label><select class="modal-select" id="noten-entry-category"></select></div>
          <div class="modal-row"><label>Note (leer = ausstehend)</label><input type="text" inputmode="decimal" class="modal-input" id="noten-entry-grade" placeholder="z.B. 2,3"/></div>
          <div class="modal-row"><label>Gewichtung</label><input type="number" class="modal-input" id="noten-entry-weight" step="0.5" min="0.5"/></div>
          <div class="modal-actions"><button id="noten-entry-cancel" class="btn-ghost">Abbrechen</button><button id="noten-entry-save" class="btn-primary">Speichern</button></div>
        </div>
      </div>

      <!-- Notenmanager: Fach-Detailansicht -->
      <div id="noten-subject-detail-overlay" class="modal-backdrop hidden">
        <div class="modal-box" style="width:520px;max-height:82vh;">
          <div class="modal-head">
            <span id="noten-detail-title">Fach</span>
            <button class="modal-x" id="noten-detail-close">&#10005;</button>
          </div>
          <div class="noten-detail-header">
            <span class="noten-detail-avg" id="noten-detail-avg">–</span>
            <div class="noten-detail-actions">
              <button class="btn-ghost" id="noten-detail-rename-btn">✎ Umbenennen</button>
              <button class="btn-ghost" id="noten-detail-delete-btn">🗑 Löschen</button>
            </div>
          </div>
          <div class="noten-entry-list" id="noten-detail-entries"></div>
          <div class="modal-actions" style="justify-content:flex-start;">
            <button class="btn-primary" id="noten-detail-add-entry-btn">+ Leistung hinzufügen</button>
          </div>
        </div>
      </div>

      <!-- Notenmanager: Löschbestätigung -->
      <div id="noten-confirm-overlay" class="modal-backdrop hidden" style="z-index:300;">
        <div class="modal-box" style="width:380px;">
          <div class="modal-head"><span id="noten-confirm-title">Löschen</span><button class="modal-x" id="noten-confirm-close">&#10005;</button></div>
          <p class="modal-hint" id="noten-confirm-message"></p>
          <div class="modal-actions"><button id="noten-confirm-cancel" class="btn-ghost">Abbrechen</button><button id="noten-confirm-ok" class="btn-primary">Löschen</button></div>
        </div>
      </div>
    </div>
  `;

  initCalculator();
  initFocusTimer();
  initConverter();
  initDataRateCalculator();
  initNotenmanager();
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
  resultAmountUnit: 'mb',
  learnMode: true
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

// =========================================================
// LERNMODUS
// Baut zusätzlich zu den kompakten dr-steps (linke Seite) einen
// ausführlichen, didaktisch aufbereiteten Rechenweg als Lernkarten
// (rechte Seite). Nutzt dieselben bereits berechneten Werte aus
// drCompute — keine doppelte Berechnung. Wird nur aufgerufen, wenn
// der Lernmodus aktiv ist, um unnötige DOM-Arbeit zu vermeiden.
// =========================================================

function drWhyUnitToBit(unitKey) {
  const u = DR_UNIT_FACTORS[unitKey];
  if (!u) return '';
  if (u.factor === 1) return 'Bit ist bereits die Basiseinheit — hier ist keine Umrechnung nötig.';
  const parts = [];
  if (u.group.startsWith('Byte')) parts.push('1 Byte = 8 Bit, deshalb wird zusätzlich mit 8 multipliziert.');
  parts.push(u.group.includes('IEC')
    ? 'Die Einheit gehört zum IEC-System (Ki/Mi/Gi/Ti) und rechnet in 1024er-Schritten, weil sie auf Zweierpotenzen basiert.'
    : 'Die Einheit gehört zum SI-System (k/M/G/T) und rechnet in 1000er-Schritten, wie bei den meisten Maßeinheiten.');
  return parts.join(' ');
}

function drWhyTimeToSeconds(unitKey) {
  const u = DR_TIME_UNITS[unitKey];
  if (!u) return '';
  if (u.factor === 1) return 'Sekunden sind bereits die Basiseinheit für Zeit — hier ist keine Umrechnung nötig.';
  return `Für die Rechnung wird Zeit immer in Sekunden umgerechnet, der gemeinsamen Basiseinheit. 1 ${u.label} entspricht ${drFormatDecimal(u.factor, 3)} Sekunden.`;
}

function drLearnCard(icon, title, mathLines, why) {
  const mathHtml = mathLines
    .map(l => `<div class="dr-learn-math-line">${l}</div>`)
    .join('<div class="dr-learn-math-arrow">↓</div>');
  return `
    <div class="dr-learn-card">
      <div class="dr-learn-card-head"><span class="dr-learn-card-icon">${icon}</span><span class="dr-learn-card-title">${title}</span></div>
      <div class="dr-learn-math">${mathHtml}</div>
      ${why ? `<div class="dr-learn-why"><span class="dr-learn-why-icon">💡</span><span><strong>Warum?</strong> ${why}</span></div>` : ''}
    </div>
  `;
}

function drLearnResultCard(valueText, subText) {
  return `
    <div class="dr-learn-card dr-learn-card--result">
      <div class="dr-learn-card-head"><span class="dr-learn-card-icon">✅</span><span class="dr-learn-card-title">Ergebnis</span></div>
      <div class="dr-learn-result-value">${valueText}</div>
      ${subText ? `<div class="dr-learn-result-sub">${subText}</div>` : ''}
    </div>
  `;
}

function drBuildLearnCards(mode, ctx) {
  const cardsEl = document.getElementById('dr-learn-cards');
  if (!cardsEl) return;

  let html = '';
  if (mode === 'time') {
    html += drLearnCard('📦', 'Schritt 1 · Datenmenge umrechnen',
      [`${drFormatDecimal(ctx.amountValue, 4)} ${drUnitLabel(ctx.amountUnit)}`, `${drFormatInt(ctx.amountBits)} Bit`],
      drWhyUnitToBit(ctx.amountUnit));
    html += drLearnCard('📦', 'Schritt 2 · Geschwindigkeit umrechnen',
      [`${drFormatDecimal(ctx.speedValue, 4)} ${drUnitLabel(ctx.speedUnit)}/s`, `${drFormatInt(ctx.speedBps)} Bit/s`],
      `${drWhyUnitToBit(ctx.speedUnit)} Eine Übertragungsgeschwindigkeit wird immer in Bit pro Sekunde angegeben, deshalb wird auch sie in Bit umgerechnet.`);
    html += drLearnCard('📦', 'Schritt 3 · Zeit berechnen',
      [`${drFormatInt(ctx.amountBits)} Bit ÷ ${drFormatInt(ctx.speedBps)} Bit/s`, `${drFormatDecimal(ctx.result, 2)} Sekunden`],
      'Datenmenge (Bit) geteilt durch Geschwindigkeit (Bit/s) ergibt eine Zeit. Die Einheit Bit kürzt sich dabei weg, übrig bleiben Sekunden.');
    html += drLearnResultCard(`${drFormatDecimal(ctx.result, 2)} Sekunden`, ctx.result >= 60 ? drFormatDuration(ctx.result) : '');

  } else if (mode === 'speed') {
    html += drLearnCard('📦', 'Schritt 1 · Datenmenge umrechnen',
      [`${drFormatDecimal(ctx.amountValue, 4)} ${drUnitLabel(ctx.amountUnit)}`, `${drFormatInt(ctx.amountBits)} Bit`],
      drWhyUnitToBit(ctx.amountUnit));
    html += drLearnCard('📦', 'Schritt 2 · Zeit umrechnen',
      [`${drFormatDecimal(ctx.timeValue, 4)} ${drTimeLabel(ctx.timeUnit)}`, `${drFormatDecimal(ctx.timeSec, 2)} Sekunden`],
      drWhyTimeToSeconds(ctx.timeUnit));
    html += drLearnCard('📦', 'Schritt 3 · Geschwindigkeit berechnen',
      [`${drFormatInt(ctx.amountBits)} Bit ÷ ${drFormatDecimal(ctx.timeSec, 2)} Sekunden`, `${drFormatInt(ctx.speedResultBps)} Bit/s`],
      'Datenmenge (Bit) geteilt durch Zeit (Sekunden) ergibt per Definition eine Geschwindigkeit in Bit pro Sekunde.');
    html += drLearnResultCard(`${drFormatDecimal(ctx.displayValue, 4)} ${drUnitLabel(ctx.resultUnit)}/s`, `entspricht ${drFormatInt(ctx.speedResultBps)} Bit/s`);

  } else {
    html += drLearnCard('📦', 'Schritt 1 · Geschwindigkeit umrechnen',
      [`${drFormatDecimal(ctx.speedValue, 4)} ${drUnitLabel(ctx.speedUnit)}/s`, `${drFormatInt(ctx.speedBps)} Bit/s`],
      drWhyUnitToBit(ctx.speedUnit));
    html += drLearnCard('📦', 'Schritt 2 · Zeit umrechnen',
      [`${drFormatDecimal(ctx.timeValue, 4)} ${drTimeLabel(ctx.timeUnit)}`, `${drFormatDecimal(ctx.timeSec, 2)} Sekunden`],
      drWhyTimeToSeconds(ctx.timeUnit));
    html += drLearnCard('📦', 'Schritt 3 · Datenmenge berechnen',
      [`${drFormatInt(ctx.speedBps)} Bit/s × ${drFormatDecimal(ctx.timeSec, 2)} Sekunden`, `${drFormatInt(ctx.amountResultBits)} Bit`],
      'Geschwindigkeit (Bit/s) mal Zeit (Sekunden) ergibt eine Datenmenge. Die Einheit Sekunden kürzt sich dabei weg, übrig bleibt Bit.');
    html += drLearnResultCard(`${drFormatDecimal(ctx.displayValue, 4)} ${drUnitLabel(ctx.resultUnit)}`, `entspricht ${drFormatInt(ctx.amountResultBits)} Bit`);
  }

  cardsEl.innerHTML = html;
}

function drClearLearnCards() {
  const cardsEl = document.getElementById('dr-learn-cards');
  if (cardsEl) cardsEl.innerHTML = '';
}

function drApplyLearnMode() {
  const layoutEl = document.getElementById('dr-layout');
  const toggleEl = document.getElementById('dr-learn-toggle');
  if (toggleEl) toggleEl.checked = drState.learnMode;
  if (layoutEl) layoutEl.classList.toggle('dr-layout--learn-off', !drState.learnMode);
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

  document.getElementById('dr-learn-toggle').addEventListener('change', e => {
    drState.learnMode = e.target.checked;
    drSaveState();
    drApplyLearnMode();
    drCompute();
  });

  drApplyMode();
  drApplyLearnMode();
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
      if (drState.learnMode) drClearLearnCards();
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
    if (drState.learnMode) {
      drBuildLearnCards('time', {
        amountValue: drState.amountValue, amountUnit: drState.amountUnit, amountBits,
        speedValue: drState.speedValue, speedUnit: drState.speedUnit, speedBps,
        result: totalSec
      });
    }

  } else if (drState.mode === 'speed') {
    labelEl.textContent = 'Übertragungsgeschwindigkeit';
    if (timeSec <= 0) {
      valueEl.textContent = '–';
      subEl.textContent = 'Zeit muss größer als 0 sein.';
      stepsEl.innerHTML = '';
      if (drState.learnMode) drClearLearnCards();
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
    if (drState.learnMode) {
      drBuildLearnCards('speed', {
        amountValue: drState.amountValue, amountUnit: drState.amountUnit, amountBits,
        timeValue: drState.timeValue, timeUnit: drState.timeUnit, timeSec,
        speedResultBps, displayValue, resultUnit: drState.resultSpeedUnit
      });
    }

  } else {
    labelEl.textContent = 'Datenmenge';
    if (timeSec <= 0) {
      valueEl.textContent = '–';
      subEl.textContent = 'Zeit muss größer als 0 sein.';
      stepsEl.innerHTML = '';
      if (drState.learnMode) drClearLearnCards();
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
    if (drState.learnMode) {
      drBuildLearnCards('amount', {
        speedValue: drState.speedValue, speedUnit: drState.speedUnit, speedBps,
        timeValue: drState.timeValue, timeUnit: drState.timeUnit, timeSec,
        amountResultBits, displayValue, resultUnit: drState.resultAmountUnit
      });
    }
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

// =========================================================
// 5) NOTENMANAGER
// Verwaltungssystem für Schul-/Ausbildungsnoten, unterhalb des
// Datenübertragungsraten-Rechners. Struktur: Ausbildungsjahre
// (Accordion, offener Zustand persistent) → Fächer (Karten) →
// Leistungen (Datum, Kategorie, Note, Gewichtung), plus Zeugnisse
// (Name, Note je Fach, optionaler Kommentar). Kategorien sind
// GLOBAL (Einstellungen → Notenmanager) — eine Kategorie samt
// Standardgewichtung gilt über alle Ausbildungsjahre hinweg; die
// Gewichtung wird beim Anlegen einer Leistung übernommen, bleibt
// pro Leistung aber frei überschreibbar. Alles wird flach in
// localStorage gehalten (DB), analog zu Budget/Projekte: separate
// Sammlungen statt eines verschachtelten Objekts.
// =========================================================

let notenYears       = DB.get('notenYears', []);        // [{id,name}]
let notenSubjects    = DB.get('notenSubjects', []);      // [{id,yearId,name}]
let notenCategories  = DB.get('notenCategories', []);    // [{id,name,weight}] — global
let notenEntries     = DB.get('notenEntries', []);       // [{id,subjectId,date,categoryId,grade,weight}]
let notenOpenYears   = DB.get('notenOpenYears', {});     // {yearId: bool}
let notenReportCards = DB.get('notenReportCards', []);   // [{id,yearId,name,comment,grades:{subjectId:grade}}]

const NOTEN_DEFAULT_CATEGORIES = [
  { name: 'Test',          weight: 1 },
  { name: 'Klassenarbeit', weight: 2 },
  { name: 'Mündlich',      weight: 1 },
  { name: 'Prüfung',       weight: 3 },
  { name: 'Projekt',       weight: 1 },
];

// Kontext-Variablen für die aktuell geöffneten Modals
let notenYearEditId      = null;
let notenSubjectYearId   = null;
let notenSubjectEditId   = null;
let notenEntrySubjectId  = null;
let notenEntryEditId     = null;
let notenDetailSubjectId = null;
let notenConfirmAction   = null;
let notenReportYearId    = null;
let notenReportEditId    = null;
let notenCompareYearId   = null;
let notenYearModalReturnId = null; // gesetzt, wenn "+ Fach" aus dem Ausbildungsjahr-Modal heraus geöffnet wurde

function saveNotenYears()       { DB.set('notenYears', notenYears); }
function saveNotenSubjects()    { DB.set('notenSubjects', notenSubjects); }
function saveNotenCategories()  { DB.set('notenCategories', notenCategories); }
function saveNotenEntries()     { DB.set('notenEntries', notenEntries); }
function saveNotenOpenYears()   { DB.set('notenOpenYears', notenOpenYears); }
function saveNotenReportCards() { DB.set('notenReportCards', notenReportCards); }

// Einmalige Migration: bisherige Kategorien waren pro Ausbildungsjahr
// dupliziert (yearId-Feld). Gleichnamige werden zu einer globalen
// Kategorie zusammengeführt (erster Treffer gewinnt Gewichtung/ID),
// bestehende Leistungen zeigen danach auf die zusammengeführte ID.
// Läuft nur einmal; danach greift die reine Global-Struktur.
(function notenMigrateCategoriesToGlobal() {
  if (!DB.get('notenCategoriesGlobalMigrated', false)) {
    if (notenCategories.some(c => c.yearId)) {
      const seen = new Map();
      const idMap = {};
      const merged = [];
      notenCategories.forEach(c => {
        const key = (c.name || '').trim().toLowerCase();
        if (seen.has(key)) {
          idMap[c.id] = seen.get(key);
        } else {
          seen.set(key, c.id);
          merged.push({ id: c.id, name: c.name, weight: c.weight });
        }
      });
      notenCategories = merged;
      notenEntries.forEach(e => { if (idMap[e.categoryId]) e.categoryId = idMap[e.categoryId]; });
      saveNotenCategories();
      saveNotenEntries();
    }
    DB.set('notenCategoriesGlobalMigrated', true);
  }
  if (!notenCategories.length) {
    NOTEN_DEFAULT_CATEGORIES.forEach(c => notenCategories.push({ id: notenUid(), name: c.name, weight: c.weight }));
    saveNotenCategories();
  }
})();

function notenUid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

function notenEsc(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function notenFormatGrade(n) {
  return n.toFixed(2).replace('.', ',');
}

// Kompakte Notation für Fachnoten in den Zeugnis-Karten — ganze Noten
// ohne Nachkommastellen (z.B. "2" statt "2,00"), Kommazahlen gekürzt.
function notenFormatGradeShort(n) {
  return (Math.round(n * 100) / 100).toString().replace('.', ',');
}

// =========================
// HELPERS — Datenzugriff
// =========================

function notenYearSubjects(yearId)     { return notenSubjects.filter(s => s.yearId === yearId); }
function notenCategoryById(catId)      { return notenCategories.find(c => c.id === catId); }
function notenSubjectEntries(subjectId) {
  return notenEntries.filter(e => e.subjectId === subjectId)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

// Fachschnitt: gewichteter Durchschnitt aller Leistungen mit Note.
// Ausstehende Leistungen (grade === null) fließen nicht ein.
function notenSubjectAverage(subjectId) {
  const graded = notenSubjectEntries(subjectId).filter(e => e.grade !== null && e.grade !== undefined);
  if (!graded.length) return null;
  let sumWeighted = 0, sumWeight = 0;
  graded.forEach(e => {
    const w = (typeof e.weight === 'number' && e.weight > 0) ? e.weight : 1;
    sumWeighted += e.grade * w;
    sumWeight   += w;
  });
  return sumWeight > 0 ? sumWeighted / sumWeight : null;
}

// Gesamtschnitt: einfacher Durchschnitt der Fachschnitte (nur Fächer mit mind. einer Note).
function notenYearAverage(yearId) {
  const avgs = notenYearSubjects(yearId).map(s => notenSubjectAverage(s.id)).filter(a => a !== null);
  if (!avgs.length) return null;
  return avgs.reduce((a, b) => a + b, 0) / avgs.length;
}

// =========================
// INIT
// =========================

function initNotenmanager() {
  renderNotenYears();
  wireNotenEvents();
}

function wireNotenEvents() {
  document.getElementById('noten-add-year-btn').addEventListener('click', () => openNotenYearModal(null));

  // ── Notenmanager-Einstellungen (Zahnrad) ──
  document.getElementById('noten-settings-btn').addEventListener('click', openNotenSettingsModal);
  document.getElementById('noten-settings-modal-close').addEventListener('click', closeNotenSettingsModal);
  document.getElementById('noten-settings-close-btn').addEventListener('click', closeNotenSettingsModal);
  document.getElementById('noten-settings-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('noten-settings-modal-overlay')) closeNotenSettingsModal();
  });
  document.getElementById('noten-settings-add-cat-btn').addEventListener('click', () => {
    notenCategories.push({ id: notenUid(), name: 'Neue Kategorie', weight: 1 });
    saveNotenCategories();
    renderNotenCategorySettings();
  });
  document.getElementById('noten-settings-category-rows').addEventListener('input', e => {
    const catId = e.target.dataset.catId;
    if (!catId) return;
    const cat = notenCategoryById(catId);
    if (!cat) return;
    if (e.target.classList.contains('noten-cat-name'))   cat.name = e.target.value;
    if (e.target.classList.contains('noten-cat-weight')) cat.weight = Math.max(0.5, parseFloat(e.target.value) || 1);
    saveNotenCategories();
  });
  document.getElementById('noten-settings-category-rows').addEventListener('click', e => {
    const delBtn = e.target.closest('.noten-cat-delete');
    if (!delBtn) return;
    const cat = notenCategoryById(delBtn.dataset.catId);
    if (!cat) return;
    if (!confirm(`Kategorie „${cat.name}" wirklich löschen? Bereits erfasste Leistungen behalten ihre Gewichtung.`)) return;
    notenCategories = notenCategories.filter(c => c.id !== cat.id);
    saveNotenCategories();
    renderNotenCategorySettings();
  });

  // ── Ausbildungsjahr-Modal: +Fach ──
  document.getElementById('noten-year-add-subject-btn').addEventListener('click', () => {
    if (!notenYearEditId) return;
    notenYearModalReturnId = notenYearEditId;
    closeNotenYearModal();
    openNotenSubjectModal(notenYearEditId, null);
  });

  // ── Jahres-Liste (Delegation: Toggle, Umbenennen, Löschen, + Fach, Kategorien, Fach öffnen) ──
  document.getElementById('noten-years-list').addEventListener('click', e => {
    const editBtn = e.target.closest('[data-noten-edit-year]');
    if (editBtn) { openNotenYearModal(editBtn.dataset.notenEditYear); return; }

    const delBtn = e.target.closest('[data-noten-delete-year]');
    if (delBtn) { confirmDeleteNotenYear(delBtn.dataset.notenDeleteYear); return; }

    const subjectCard = e.target.closest('[data-noten-open-subject]');
    if (subjectCard) { openNotenSubjectDetail(subjectCard.dataset.notenOpenSubject); return; }

    const addReportBtn = e.target.closest('[data-noten-add-report]');
    if (addReportBtn) { openNotenReportModal(addReportBtn.dataset.notenAddReport, null); return; }

    const editReportBtn = e.target.closest('[data-noten-edit-report]');
    if (editReportBtn) {
      const report = notenReportCards.find(r => r.id === editReportBtn.dataset.notenEditReport);
      if (report) openNotenReportModal(report.yearId, report.id);
      return;
    }

    const delReportBtn = e.target.closest('[data-noten-delete-report]');
    if (delReportBtn) { confirmDeleteNotenReport(delReportBtn.dataset.notenDeleteReport); return; }

    const compareBtn = e.target.closest('[data-noten-compare-reports]');
    if (compareBtn) { openNotenCompareModal(compareBtn.dataset.notenCompareReports); return; }

    const header = e.target.closest('[data-noten-toggle-year]');
    if (header) { toggleNotenYear(header.dataset.notenToggleYear); return; }
  });

  // ── Ausbildungsjahr-Modal ──
  document.getElementById('noten-year-modal-close').addEventListener('click', closeNotenYearModal);
  document.getElementById('noten-year-cancel').addEventListener('click', closeNotenYearModal);
  document.getElementById('noten-year-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('noten-year-modal-overlay')) closeNotenYearModal();
  });
  document.getElementById('noten-year-save').addEventListener('click', saveNotenYear);
  document.getElementById('noten-year-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveNotenYear(); }
  });

  // ── Fach-Modal ──
  document.getElementById('noten-subject-modal-close').addEventListener('click', closeNotenSubjectModal);
  document.getElementById('noten-subject-cancel').addEventListener('click', closeNotenSubjectModal);
  document.getElementById('noten-subject-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('noten-subject-modal-overlay')) closeNotenSubjectModal();
  });
  document.getElementById('noten-subject-save').addEventListener('click', saveNotenSubject);
  document.getElementById('noten-subject-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveNotenSubject(); }
  });

  // ── Zeugnis-Modal ──
  document.getElementById('noten-report-modal-close').addEventListener('click', closeNotenReportModal);
  document.getElementById('noten-report-cancel').addEventListener('click', closeNotenReportModal);
  document.getElementById('noten-report-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('noten-report-modal-overlay')) closeNotenReportModal();
  });
  document.getElementById('noten-report-save').addEventListener('click', saveNotenReport);
  document.getElementById('noten-report-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveNotenReport(); }
  });

  // ── Zeugnisse-vergleichen-Modal ──
  document.getElementById('noten-compare-modal-close').addEventListener('click', closeNotenCompareModal);
  document.getElementById('noten-compare-close-btn').addEventListener('click', closeNotenCompareModal);
  document.getElementById('noten-compare-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('noten-compare-modal-overlay')) closeNotenCompareModal();
  });
  document.getElementById('noten-compare-select-a').addEventListener('change', renderNotenCompareTable);
  document.getElementById('noten-compare-select-b').addEventListener('change', renderNotenCompareTable);

  // ── Leistung-Modal ──
  document.getElementById('noten-entry-modal-close').addEventListener('click', closeNotenEntryModal);
  document.getElementById('noten-entry-cancel').addEventListener('click', closeNotenEntryModal);
  document.getElementById('noten-entry-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('noten-entry-modal-overlay')) closeNotenEntryModal();
  });
  document.getElementById('noten-entry-category').addEventListener('change', e => {
    const cat = notenCategoryById(e.target.value);
    if (cat) document.getElementById('noten-entry-weight').value = cat.weight;
  });
  document.getElementById('noten-entry-save').addEventListener('click', saveNotenEntry);

  // ── Fach-Detailansicht ──
  document.getElementById('noten-detail-close').addEventListener('click', closeNotenSubjectDetail);
  document.getElementById('noten-subject-detail-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('noten-subject-detail-overlay')) closeNotenSubjectDetail();
  });
  document.getElementById('noten-detail-rename-btn').addEventListener('click', () => {
    const subject = notenSubjects.find(s => s.id === notenDetailSubjectId);
    if (!subject) return;
    document.getElementById('noten-subject-detail-overlay').classList.add('hidden');
    openNotenSubjectModal(subject.yearId, subject.id);
  });
  document.getElementById('noten-detail-delete-btn').addEventListener('click', () => {
    const subject = notenSubjects.find(s => s.id === notenDetailSubjectId);
    if (!subject) return;
    openNotenConfirm('Fach löschen', `„${subject.name}" inkl. aller erfassten Leistungen wirklich löschen?`, () => {
      notenSubjects = notenSubjects.filter(s => s.id !== subject.id);
      notenEntries  = notenEntries.filter(e => e.subjectId !== subject.id);
      notenReportCards.forEach(r => { if (r.grades) delete r.grades[subject.id]; });
      saveNotenSubjects(); saveNotenEntries(); saveNotenReportCards();
      closeNotenSubjectDetail();
      renderNotenYears();
    });
  });
  document.getElementById('noten-detail-add-entry-btn').addEventListener('click', () => {
    openNotenEntryModal(notenDetailSubjectId, null);
  });
  document.getElementById('noten-detail-entries').addEventListener('click', e => {
    const editBtn = e.target.closest('.noten-entry-edit');
    if (editBtn) { openNotenEntryModal(notenDetailSubjectId, editBtn.dataset.entryId); return; }
    const delBtn = e.target.closest('.noten-entry-delete');
    if (delBtn) {
      const entry = notenEntries.find(en => en.id === delBtn.dataset.entryId);
      if (!entry) return;
      openNotenConfirm('Leistung löschen', 'Diese Leistung wirklich löschen?', () => {
        notenEntries = notenEntries.filter(en => en.id !== entry.id);
        saveNotenEntries();
        renderNotenSubjectDetail();
        renderNotenYears();
      });
    }
  });

  // ── Generische Löschbestätigung ──
  document.getElementById('noten-confirm-close').addEventListener('click', closeNotenConfirm);
  document.getElementById('noten-confirm-cancel').addEventListener('click', closeNotenConfirm);
  document.getElementById('noten-confirm-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('noten-confirm-overlay')) closeNotenConfirm();
  });
  document.getElementById('noten-confirm-ok').addEventListener('click', () => {
    const action = notenConfirmAction;
    closeNotenConfirm();
    if (action) action();
  });
}

// =========================
// RENDERING — Ausbildungsjahre + Fächer
// =========================

function renderNotenYears() {
  const container = document.getElementById('noten-years-list');
  const emptyEl   = document.getElementById('noten-empty');
  if (!container) return;

  if (!notenYears.length) {
    container.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  container.innerHTML = notenYears.map(year => {
    const isOpen   = !!notenOpenYears[year.id];
    const subjects = notenYearSubjects(year.id);
    const yearAvg  = notenYearAverage(year.id);

    return `
      <div class="noten-year-item">
        <div class="noten-year-header" data-noten-toggle-year="${year.id}">
          <span class="noten-year-chevron">${isOpen ? '▼' : '▶'}</span>
          <span class="noten-year-name">${notenEsc(year.name)}</span>
          <span class="noten-year-meta">${subjects.length} ${subjects.length === 1 ? 'Fach' : 'Fächer'}</span>
          <span class="noten-year-avg">${yearAvg !== null ? 'Ø ' + notenFormatGrade(yearAvg) : '–'}</span>
          <div class="noten-year-actions">
            <button class="icon-btn" data-noten-edit-year="${year.id}" title="Bearbeiten">✎</button>
            <button class="icon-btn" data-noten-delete-year="${year.id}" title="Löschen">🗑</button>
          </div>
        </div>
        <div class="noten-year-body ${isOpen ? '' : 'collapsed'}">
          <div class="noten-subject-grid" id="noten-subject-grid-${year.id}">${notenRenderSubjectGrid(year.id)}</div>
          ${notenRenderReportsSection(year.id)}
        </div>
      </div>
    `;
  }).join('');
}

function notenRenderSubjectGrid(yearId) {
  const subjects = notenYearSubjects(yearId);
  if (!subjects.length) return `<div class="noten-subject-empty">Noch keine Fächer.</div>`;
  return subjects.map(s => {
    const avg = notenSubjectAverage(s.id);
    const pendingCount = notenSubjectEntries(s.id).filter(e => e.grade === null || e.grade === undefined).length;
    return `
      <button class="noten-subject-card" data-noten-open-subject="${s.id}">
        <span class="noten-subject-name">${notenEsc(s.name)}</span>
        <span class="noten-subject-avg">${avg !== null ? 'Ø ' + notenFormatGrade(avg) : '–'}</span>
        ${pendingCount ? `<span class="noten-subject-pending">${pendingCount} ausstehend</span>` : ''}
      </button>
    `;
  }).join('');
}

function toggleNotenYear(yearId) {
  notenOpenYears[yearId] = !notenOpenYears[yearId];
  saveNotenOpenYears();
  renderNotenYears();
}

// =========================
// AUSBILDUNGSJAHR — CRUD
// =========================

function openNotenYearModal(yearId) {
  notenYearEditId = yearId || null;
  const year = yearId ? notenYears.find(y => y.id === yearId) : null;
  document.getElementById('noten-year-modal-title').textContent = year ? 'Ausbildungsjahr bearbeiten' : 'Neues Ausbildungsjahr';
  document.getElementById('noten-year-name').value = year ? year.name : '';
  document.getElementById('noten-year-subject-row').classList.toggle('hidden', !year);
  document.getElementById('noten-year-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('noten-year-name').focus(), 50);
}
function closeNotenYearModal() {
  document.getElementById('noten-year-modal-overlay').classList.add('hidden');
}
function saveNotenYear() {
  const name = document.getElementById('noten-year-name').value.trim();
  if (!name) return;

  if (notenYearEditId) {
    const year = notenYears.find(y => y.id === notenYearEditId);
    if (year) year.name = name;
  } else {
    const id = notenUid();
    notenYears.push({ id, name });
    notenOpenYears[id] = true;
    saveNotenOpenYears();
  }
  saveNotenYears();
  closeNotenYearModal();
  renderNotenYears();
}
function confirmDeleteNotenYear(yearId) {
  const year = notenYears.find(y => y.id === yearId);
  if (!year) return;
  openNotenConfirm('Ausbildungsjahr löschen', `„${year.name}" inkl. aller Fächer, Zeugnisse und Noten wirklich löschen? (Globale Kategorien bleiben erhalten.)`, () => {
    const subjectIds = notenYearSubjects(yearId).map(s => s.id);
    notenYears       = notenYears.filter(y => y.id !== yearId);
    notenSubjects    = notenSubjects.filter(s => s.yearId !== yearId);
    notenEntries     = notenEntries.filter(e => !subjectIds.includes(e.subjectId));
    notenReportCards = notenReportCards.filter(r => r.yearId !== yearId);
    delete notenOpenYears[yearId];
    saveNotenYears(); saveNotenSubjects(); saveNotenEntries(); saveNotenReportCards(); saveNotenOpenYears();
    renderNotenYears();
  });
}

// =========================
// FACH — CRUD
// =========================

function openNotenSubjectModal(yearId, subjectId) {
  notenSubjectYearId  = yearId;
  notenSubjectEditId  = subjectId || null;
  const subject = subjectId ? notenSubjects.find(s => s.id === subjectId) : null;
  document.getElementById('noten-subject-modal-title').textContent = subject ? 'Fach umbenennen' : 'Neues Fach';
  document.getElementById('noten-subject-name').value = subject ? subject.name : '';
  document.getElementById('noten-subject-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('noten-subject-name').focus(), 50);
}
function closeNotenSubjectModal() {
  document.getElementById('noten-subject-modal-overlay').classList.add('hidden');
  if (notenYearModalReturnId) {
    const returnId = notenYearModalReturnId;
    notenYearModalReturnId = null;
    openNotenYearModal(returnId);
  }
}
function saveNotenSubject() {
  const name = document.getElementById('noten-subject-name').value.trim();
  if (!name) return;

  let subjectId = notenSubjectEditId;
  if (subjectId) {
    const subject = notenSubjects.find(s => s.id === subjectId);
    if (subject) subject.name = name;
  } else {
    subjectId = notenUid();
    notenSubjects.push({ id: subjectId, yearId: notenSubjectYearId, name });
  }
  saveNotenSubjects();
  closeNotenSubjectModal();
  renderNotenYears();

  // Falls wir aus der Detailansicht kamen (Umbenennen), diese wieder anzeigen
  if (notenDetailSubjectId === subjectId) {
    renderNotenSubjectDetail();
    document.getElementById('noten-subject-detail-overlay').classList.remove('hidden');
  }
}

// =========================
// KATEGORIEN — Global (Einstellungen → Notenmanager)
// Analog zu renderPositivitySettings() in positivity.js: das Modul,
// das die Daten besitzt, rendert seine eigene Einstellungssektion.
// renderSettings() (settings.js) ruft dies bei Bedarf per typeof-
// Check auf. Nutzt dieselbe Markup-/CSS-Struktur (.noten-category-row)
// wie zuvor das Kategorien-Modal — keine Duplikate.
// =========================

function renderNotenCategorySettings() {
  const rows = document.getElementById('noten-settings-category-rows');
  if (!rows) return;
  rows.innerHTML = notenCategories.length ? notenCategories.map(c => `
    <div class="noten-category-row">
      <input type="text" class="modal-input noten-cat-name" value="${notenEsc(c.name)}" data-cat-id="${c.id}"/>
      <input type="number" class="modal-input noten-cat-weight" value="${c.weight}" min="0.5" step="0.5" data-cat-id="${c.id}"/>
      <button class="icon-btn noten-cat-delete" data-cat-id="${c.id}" title="Löschen">🗑</button>
    </div>
  `).join('') : `<div class="noten-empty-hint">Noch keine Kategorien.</div>`;
}

function openNotenSettingsModal() {
  renderNotenCategorySettings();
  document.getElementById('noten-settings-modal-overlay').classList.remove('hidden');
}
function closeNotenSettingsModal() {
  document.getElementById('noten-settings-modal-overlay').classList.add('hidden');
}

// =========================
// LEISTUNGEN (Einträge) — CRUD
// =========================

function openNotenEntryModal(subjectId, entryId) {
  notenEntrySubjectId = subjectId;
  notenEntryEditId    = entryId || null;
  const subject = notenSubjects.find(s => s.id === subjectId);
  if (!subject) return;
  const entry = entryId ? notenEntries.find(e => e.id === entryId) : null;
  const cats  = notenCategories;

  document.getElementById('noten-entry-modal-title').textContent = entry ? 'Leistung bearbeiten' : 'Neue Leistung';

  const catSelect = document.getElementById('noten-entry-category');
  catSelect.innerHTML = cats.length
    ? cats.map(c => `<option value="${c.id}">${notenEsc(c.name)}</option>`).join('')
    : `<option value="">Keine Kategorien</option>`;

  document.getElementById('noten-entry-date').value = entry ? entry.date : new Date().toISOString().slice(0, 10);

  const initialCatId = entry ? entry.categoryId : (cats[0] ? cats[0].id : '');
  catSelect.value = initialCatId;
  const initialCat = notenCategoryById(initialCatId);

  document.getElementById('noten-entry-grade').value  = (entry && entry.grade !== null && entry.grade !== undefined) ? entry.grade : '';
  document.getElementById('noten-entry-weight').value = entry ? entry.weight : (initialCat ? initialCat.weight : 1);

  document.getElementById('noten-entry-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('noten-entry-grade').focus(), 50);
}
function closeNotenEntryModal() {
  document.getElementById('noten-entry-modal-overlay').classList.add('hidden');
}
function saveNotenEntry() {
  const date       = document.getElementById('noten-entry-date').value;
  const categoryId = document.getElementById('noten-entry-category').value;
  const gradeRaw   = document.getElementById('noten-entry-grade').value.trim();
  const grade      = gradeRaw === '' ? null : Math.min(6, Math.max(1, parseFloat(gradeRaw.replace(',', '.'))));
  const weight     = Math.max(0.5, parseFloat(document.getElementById('noten-entry-weight').value) || 1);

  if (notenEntryEditId) {
    const entry = notenEntries.find(e => e.id === notenEntryEditId);
    if (entry) Object.assign(entry, { date, categoryId, grade, weight });
  } else {
    notenEntries.push({ id: notenUid(), subjectId: notenEntrySubjectId, date, categoryId, grade, weight });
  }
  saveNotenEntries();
  closeNotenEntryModal();
  renderNotenSubjectDetail();
  renderNotenYears();
}

// =========================
// FACH-DETAILANSICHT
// =========================

function openNotenSubjectDetail(subjectId) {
  notenDetailSubjectId = subjectId;
  renderNotenSubjectDetail();
  document.getElementById('noten-subject-detail-overlay').classList.remove('hidden');
}
function closeNotenSubjectDetail() {
  document.getElementById('noten-subject-detail-overlay').classList.add('hidden');
  notenDetailSubjectId = null;
}
function renderNotenSubjectDetail() {
  const subject = notenSubjects.find(s => s.id === notenDetailSubjectId);
  if (!subject) { closeNotenSubjectDetail(); return; }

  const avg = notenSubjectAverage(subject.id);
  document.getElementById('noten-detail-title').textContent = subject.name;
  document.getElementById('noten-detail-avg').textContent = avg !== null ? 'Ø ' + notenFormatGrade(avg) : 'Noch keine Note';

  const entries = notenSubjectEntries(subject.id);
  const list = document.getElementById('noten-detail-entries');
  list.innerHTML = entries.length ? entries.map(e => {
    const cat = notenCategoryById(e.categoryId);
    const dateLabel = e.date ? new Date(e.date + 'T00:00:00').toLocaleDateString('de-DE') : '–';
    const gradeLabel = (e.grade === null || e.grade === undefined)
      ? `<span class="noten-badge-pending">Ausstehend</span>`
      : notenFormatGrade(e.grade);
    return `
      <div class="noten-entry-row">
        <span class="noten-entry-date">${dateLabel}</span>
        <span class="noten-entry-cat">${cat ? notenEsc(cat.name) : '—'}</span>
        <span class="noten-entry-grade">${gradeLabel}</span>
        <span class="noten-entry-weight">×${e.weight ?? 1}</span>
        <div class="noten-entry-actions">
          <button class="icon-btn noten-entry-edit" data-entry-id="${e.id}" title="Bearbeiten">✎</button>
          <button class="icon-btn noten-entry-delete" data-entry-id="${e.id}" title="Löschen">🗑</button>
        </div>
      </div>
    `;
  }).join('') : `<div class="noten-empty-hint">Noch keine Leistungen erfasst.</div>`;
}

// =========================
// ZEUGNISSE — pro Ausbildungsjahr
// Einfaches Archiv: Name, Note je Fach (nur erfasste Fächer zählen),
// ein optionaler Gesamtkommentar. Gesamtschnitt = einfacher
// Durchschnitt der eingetragenen Fachnoten (keine Gewichtung —
// bewusst simpler als der Leistungsschnitt, das Zeugnis bildet nur
// das Endergebnis ab).
// =========================

function notenYearReports(yearId) { return notenReportCards.filter(r => r.yearId === yearId); }

function notenReportAverage(report) {
  const grades = Object.values(report.grades || {}).filter(g => typeof g === 'number');
  if (!grades.length) return null;
  return grades.reduce((a, b) => a + b, 0) / grades.length;
}

function notenRenderReportsSection(yearId) {
  const reports  = notenYearReports(yearId);
  const subjects = notenYearSubjects(yearId);
  const compareBtn = reports.length >= 2
    ? `<button class="btn-ghost" data-noten-compare-reports="${yearId}">Zeugnisse vergleichen</button>` : '';

  const list = reports.length ? reports.map(r => {
    const avg = notenReportAverage(r);
    const gradeChips = subjects
      .filter(s => r.grades && r.grades[s.id] !== undefined)
      .map(s => `<span class="noten-report-grade-chip"><span class="noten-report-grade-subject">${notenEsc(s.name)}</span><span class="noten-report-grade-value">${notenFormatGradeShort(r.grades[s.id])}</span></span>`);
    const gradesHtml = gradeChips.length
      ? gradeChips.join('<span class="noten-report-grade-sep">•</span>')
      : `<span class="noten-empty-hint" style="padding:0;">Noch keine Noten eingetragen.</span>`;

    return `
      <div class="noten-report-card">
        <div class="noten-report-card-head">
          <span class="noten-report-card-icon">📄</span>
          <span class="noten-report-card-name">${notenEsc(r.name)}</span>
          <span class="noten-report-card-avg">${avg !== null ? 'Ø ' + notenFormatGrade(avg) : '–'}</span>
          <div class="noten-report-card-actions">
            <button class="icon-btn" data-noten-edit-report="${r.id}" title="Bearbeiten">✎</button>
            <button class="icon-btn" data-noten-delete-report="${r.id}" title="Löschen">🗑</button>
          </div>
        </div>
        <div class="noten-report-card-grades">${gradesHtml}</div>
      </div>
    `;
  }).join('') : `<div class="noten-empty-hint">Noch keine Zeugnisse.</div>`;

  return `
    <div class="noten-reports-section">
      <div class="noten-reports-header">
        <span class="noten-reports-title">Zeugnisse</span>
        <div class="noten-reports-header-actions">
          ${compareBtn}
          <button class="btn-ghost" data-noten-add-report="${yearId}">+ Zeugnis</button>
        </div>
      </div>
      <div class="noten-reports-list">${list}</div>
    </div>
  `;
}

function openNotenReportModal(yearId, reportId) {
  notenReportYearId = yearId;
  notenReportEditId = reportId || null;
  const report = reportId ? notenReportCards.find(r => r.id === reportId) : null;

  document.getElementById('noten-report-modal-title').textContent = report ? 'Zeugnis bearbeiten' : 'Neues Zeugnis';
  document.getElementById('noten-report-name').value = report ? report.name : '';
  document.getElementById('noten-report-comment').value = report ? (report.comment || '') : '';

  const subjects = notenYearSubjects(yearId);
  const gradesEl = document.getElementById('noten-report-grades');
  gradesEl.innerHTML = subjects.length ? subjects.map(s => {
    const val = (report && report.grades && report.grades[s.id] !== undefined) ? report.grades[s.id] : '';
    return `
      <div class="noten-report-grade-row">
        <span class="noten-report-subject-name">${notenEsc(s.name)}</span>
        <input type="text" inputmode="decimal" class="modal-input noten-report-grade-input" data-subject-id="${s.id}" value="${val}" placeholder="–"/>
      </div>
    `;
  }).join('') : `<div class="noten-empty-hint">Erst Fächer anlegen, um Noten einzutragen.</div>`;

  document.getElementById('noten-report-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('noten-report-name').focus(), 50);
}
function closeNotenReportModal() {
  document.getElementById('noten-report-modal-overlay').classList.add('hidden');
}
function saveNotenReport() {
  const name = document.getElementById('noten-report-name').value.trim();
  if (!name) return;
  const comment = document.getElementById('noten-report-comment').value.trim();

  const grades = {};
  document.querySelectorAll('.noten-report-grade-input').forEach(input => {
    const raw = input.value.trim();
    if (raw !== '') grades[input.dataset.subjectId] = Math.min(6, Math.max(1, parseFloat(raw.replace(',', '.'))));
  });

  if (notenReportEditId) {
    const report = notenReportCards.find(r => r.id === notenReportEditId);
    if (report) Object.assign(report, { name, comment, grades });
  } else {
    notenReportCards.push({ id: notenUid(), yearId: notenReportYearId, name, comment, grades });
  }
  saveNotenReportCards();
  closeNotenReportModal();
  renderNotenYears();
}
function confirmDeleteNotenReport(reportId) {
  const report = notenReportCards.find(r => r.id === reportId);
  if (!report) return;
  openNotenConfirm('Zeugnis löschen', `„${report.name}" wirklich löschen?`, () => {
    notenReportCards = notenReportCards.filter(r => r.id !== reportId);
    saveNotenReportCards();
    renderNotenYears();
  });
}

// =========================
// ZEUGNISSE VERGLEICHEN
// Einfache Fach-für-Fach-Gegenüberstellung zweier Zeugnisse desselben
// Ausbildungsjahres, plus Gesamtschnitt-Vergleich. Keine Diagramme —
// bewusst auf eine schlichte Liste beschränkt.
// =========================

function openNotenCompareModal(yearId) {
  notenCompareYearId = yearId;
  const reports = notenYearReports(yearId);
  const options = reports.map(r => `<option value="${r.id}">${notenEsc(r.name)}</option>`).join('');
  const selA = document.getElementById('noten-compare-select-a');
  const selB = document.getElementById('noten-compare-select-b');
  selA.innerHTML = options;
  selB.innerHTML = options;
  if (reports.length >= 2) {
    selA.value = reports[reports.length - 2].id;
    selB.value = reports[reports.length - 1].id;
  }
  renderNotenCompareTable();
  document.getElementById('noten-compare-modal-overlay').classList.remove('hidden');
}
function closeNotenCompareModal() {
  document.getElementById('noten-compare-modal-overlay').classList.add('hidden');
}
function renderNotenCompareTable() {
  const tableEl = document.getElementById('noten-compare-table');
  const idA = document.getElementById('noten-compare-select-a').value;
  const idB = document.getElementById('noten-compare-select-b').value;
  const reportA = notenReportCards.find(r => r.id === idA);
  const reportB = notenReportCards.find(r => r.id === idB);
  if (!reportA || !reportB) { tableEl.innerHTML = ''; return; }

  const subjects = notenYearSubjects(notenCompareYearId);
  const rows = subjects.map(s => {
    const gA = reportA.grades ? reportA.grades[s.id] : undefined;
    const gB = reportB.grades ? reportB.grades[s.id] : undefined;
    const labelA = gA !== undefined ? notenFormatGrade(gA) : '–';
    const labelB = gB !== undefined ? notenFormatGrade(gB) : '–';
    return `
      <div class="noten-compare-row">
        <span class="noten-compare-subject">${notenEsc(s.name)}</span>
        <span class="noten-compare-values">${labelA} → ${labelB}</span>
      </div>
    `;
  }).join('');

  const avgA = notenReportAverage(reportA);
  const avgB = notenReportAverage(reportB);
  const avgRow = `
    <div class="noten-compare-row noten-compare-row--total">
      <span class="noten-compare-subject">Gesamtschnitt</span>
      <span class="noten-compare-values">${avgA !== null ? notenFormatGrade(avgA) : '–'} → ${avgB !== null ? notenFormatGrade(avgB) : '–'}</span>
    </div>
  `;

  tableEl.innerHTML = rows + avgRow;
}

// =========================
// GENERISCHE LÖSCHBESTÄTIGUNG
// =========================

function openNotenConfirm(title, message, onConfirm) {
  notenConfirmAction = onConfirm;
  document.getElementById('noten-confirm-title').textContent = title;
  document.getElementById('noten-confirm-message').textContent = message;
  document.getElementById('noten-confirm-overlay').classList.remove('hidden');
}
function closeNotenConfirm() {
  document.getElementById('noten-confirm-overlay').classList.add('hidden');
  notenConfirmAction = null;
}
