// =========================
// TOOLS — 1) TASCHENRECHNER
// Benötigt tools.js (initTools/HTML-Grundgerüst) zuvor geladen.
// =========================

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
