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

  document.addEventListener('keydown', calcHandleKey);

  const exprInput = document.getElementById('calc-expr-input');
  exprInput.addEventListener('input', renderCalcExprResult);
  exprInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const r = calcEvalExpression(exprInput.value);
    if (r.error || r.value === undefined) return;
    // Ergebnis in Anzeige + Verlauf übernehmen, mit Tasten weiterrechnen
    calcState = { display: calcNumberToDisplay(r.value), prevValue: null, operator: null, waitingForOperand: true, expression: `${exprInput.value.trim()} =`, justEquals: true };
    renderCalcDisplay();
    renderCalcExpression();
    calcPushHistory(`${exprInput.value.trim()} =`, calcState.display);
  });
}

// =========================================================
// AUSDRUCKSZEILE — kleiner Rechenparser (kein eval)
// Klammern, + − × ÷ ^ mod, % (Prozent), ! (Fakultät), √/sqrt, log2,
// log/lg (Basis 10), ln, sin/cos/tan (Grad), pi/π, e; Zahlen dezimal
// (Komma oder Punkt), 0x… (hex), 0b… (binär). Integer-Ergebnisse
// zusätzlich in Hex/Binär — für Subnetze, Datenraten & Co.
// =========================================================

const CALC_FUNCS = {
  sqrt: Math.sqrt, log2: Math.log2, log: Math.log10, lg: Math.log10, ln: Math.log,
  sin: x => Math.sin(x * Math.PI / 180), cos: x => Math.cos(x * Math.PI / 180), tan: x => Math.tan(x * Math.PI / 180),
  abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
};

function calcTokenize(src) {
  const s = src.replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/[÷:]/g, '/').toLowerCase();
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    let m;
    if (/^\s/.test(rest)) { i++; continue; }
    if ((m = rest.match(/^0x[0-9a-f]+/)))      tokens.push({ t: 'num', v: parseInt(m[0].slice(2), 16) });
    else if ((m = rest.match(/^0b[01]+/)))     tokens.push({ t: 'num', v: parseInt(m[0].slice(2), 2) });
    else if ((m = rest.match(/^\d+(?:[.,]\d+)?(?:e[+-]?\d+)?/))) tokens.push({ t: 'num', v: parseFloat(m[0].replace(',', '.')) });
    else if (rest[0] === '√' || rest[0] === 'π') { tokens.push({ t: 'id', v: rest[0] === '√' ? 'sqrt' : 'pi' }); i++; continue; }
    else if ((m = rest.match(/^[a-z][a-z0-9]*/))) {
      tokens.push(m[0] === 'mod' ? { t: 'op', v: 'mod' } : { t: 'id', v: m[0] });
    }
    else if ('+-*/^()%!'.includes(rest[0])) { tokens.push({ t: 'op', v: rest[0] }); i++; continue; }
    else throw new Error(`Unbekanntes Zeichen „${rest[0]}“`);
    i += m[0].length;
  }
  return tokens;
}

function calcEvalExpression(src) {
  if (!String(src).trim()) return {};
  let tokens, pos = 0;
  try { tokens = calcTokenize(src); } catch (e) { return { error: e.message }; }
  const peek = () => tokens[pos];
  const isOp = v => peek() && peek().t === 'op' && peek().v === v;
  const expect = v => { if (!isOp(v)) throw new Error(`„${v}“ fehlt`); pos++; };

  function expr() {
    let v = term();
    while (isOp('+') || isOp('-')) { const op = tokens[pos++].v; const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  function term() {
    let v = unary();
    while (isOp('*') || isOp('/') || isOp('mod')) {
      const op = tokens[pos++].v; const r = unary();
      if (op === '*') v *= r;
      else if (op === '/') { if (r === 0) throw new Error('Division durch 0'); v /= r; }
      else v = ((v % r) + r) % r;
    }
    return v;
  }
  function unary() {
    if (isOp('-')) { pos++; return -unary(); }
    if (isOp('+')) { pos++; return unary(); }
    return power();
  }
  function power() {
    const base = postfix();
    if (isOp('^')) { pos++; return Math.pow(base, unary()); }
    return base;
  }
  function postfix() {
    let v = primary();
    while (isOp('%') || isOp('!')) {
      const op = tokens[pos++].v;
      if (op === '%') v /= 100;
      else {
        if (!Number.isInteger(v) || v < 0 || v > 170) throw new Error('Fakultät nur für ganze Zahlen 0–170');
        let f = 1; for (let k = 2; k <= v; k++) f *= k; v = f;
      }
    }
    return v;
  }
  function primary() {
    const tok = peek();
    if (!tok) throw new Error('Ausdruck unvollständig');
    if (tok.t === 'num') { pos++; return tok.v; }
    if (isOp('(')) { pos++; const v = expr(); expect(')'); return v; }
    if (tok.t === 'id') {
      pos++;
      if (tok.v === 'pi') return Math.PI;
      if (tok.v === 'e') return Math.E;
      const fn = CALC_FUNCS[tok.v];
      if (!fn) throw new Error(`Unbekannte Funktion „${tok.v}“`);
      return fn(isOp('(') ? (pos++, (() => { const v = expr(); expect(')'); return v; })()) : postfix());
    }
    throw new Error(`Unerwartetes „${tok.v}“`);
  }

  try {
    const value = expr();
    if (pos < tokens.length) throw new Error(`Unerwartetes „${tokens[pos].v}“`);
    if (!isFinite(value)) throw new Error('Ergebnis ist nicht definiert');
    return { value };
  } catch (e) { return { error: e.message }; }
}

function renderCalcExprResult() {
  const out = document.getElementById('calc-expr-result');
  const r = calcEvalExpression(document.getElementById('calc-expr-input').value);
  if (r.error) { out.innerHTML = `<span class="calc-expr-error">${escHtml(r.error)}</span>`; return; }
  if (r.value === undefined) { out.innerHTML = ''; return; }
  const v = Math.round(r.value * 1e10) / 1e10;
  let html = `<span class="calc-expr-main">= ${v.toLocaleString('de-DE', { maximumFractionDigits: 10 })}</span>`;
  if (Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER) {
    const abs = Math.abs(v), sign = v < 0 ? '−' : '';
    html += `<span class="calc-expr-alt">hex ${sign}0x${abs.toString(16).toUpperCase()}</span><span class="calc-expr-alt">bin ${sign}${abs.toString(2)}</span>`;
  }
  out.innerHTML = html + '<span class="calc-expr-hint">Enter übernimmt</span>';
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
  if (calcState.display === 'Fehler') calcClear();
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
  if (calcState.display === 'Fehler') calcClear();
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
  if (calcState.display === 'Fehler' || calcState.display === '0') return;
  // Als Text umdrehen, damit ein gerade getipptes Komma ("5,") erhalten bleibt
  calcState.display = calcState.display.startsWith('-') ? calcState.display.slice(1) : '-' + calcState.display;
  renderCalcDisplay();
}

function calcPercent() {
  if (calcState.display === 'Fehler') return;
  const val = calcDisplayToNumber();
  // Wie beim Handrechner: 200 + 10 % = 220 (Prozent vom ersten Wert),
  // bei × und ÷ bzw. ohne Operator einfach ÷ 100.
  const ofPrev = calcState.prevValue !== null && (calcState.operator === '+' || calcState.operator === '−');
  calcState.display = calcNumberToDisplay(ofPrev ? calcState.prevValue * val / 100 : val / 100);
  calcState.waitingForOperand = false;
  renderCalcDisplay();
}

function calcBackspace() {
  if (calcState.display === 'Fehler') { calcClear(); return; }
  if (calcState.waitingForOperand) return;   // Ergebnisse nicht zerstückeln
  const next = calcState.display.slice(0, -1);
  calcState.display = (next === '' || next === '-') ? '0' : next;
  renderCalcDisplay();
}

// Tastatur: nur wenn Tools offen ist, kein Dialog offen ist und der Fokus
// nicht in einem Eingabefeld steht (sonst würde jede Zahl doppelt landen).
const CALC_KEY_OPS = { '+': '+', '-': '−', '*': '×', 'x': '×', '/': '÷', ':': '÷' };
function calcHandleKey(e) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!document.getElementById('view-tools')?.classList.contains('active')) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (document.querySelector('.modal-backdrop:not(.hidden)')) return;
  const k = e.key;
  if (/^[0-9]$/.test(k))             calcInputDigit(k);
  else if (k === ',' || k === '.')   calcInputDecimal();
  else if (CALC_KEY_OPS[k])          calcSetOperator(CALC_KEY_OPS[k]);
  else if (k === 'Enter' || k === '=') calcEquals();
  else if (k === 'Backspace')        calcBackspace();
  else if (k === 'Escape' || k === 'Delete') calcClear();
  else if (k === '%')                calcPercent();
  else return;
  e.preventDefault();
}

function calcSetOperator(nextOperator) {
  if (calcState.display === 'Fehler') return;
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
  if (op === '÷') return b === 0 ? NaN : a / b;
  return b;
}

function calcDisplayToNumber() {
  return parseGermanNumber(calcState.display) || 0;
}

function calcNumberToDisplay(num) {
  // Division durch 0 (oder andere ungültige Operationen) liefert NaN —
  // wie bei einem echten Taschenrechner als "Fehler" anzeigen statt 0.
  if (isNaN(num)) return 'Fehler';
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
  // Wie nach "=": eine neue Ziffer beginnt eine neue Zahl, ein Operator rechnet weiter
  calcState.waitingForOperand = true;
  calcState.justEquals = false;
  renderCalcDisplay();
  renderCalcExpression();
  document.getElementById('calc-history').classList.add('hidden');
}
