// =========================
// TOOLS — 4) DATENÜBERTRAGUNGSRATEN-RECHNER
// Inkl. Lernmodus und Formelsammlung.
// Benötigt tools.js (Grundgerüst + geteilte Dateneinheiten-Registry)
// zuvor geladen.
// =========================

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
// LERNMODUS — MUSTERLÖSUNG
// Baut den rechten Bereich als vollständige Musterlösung im
// Berufsschul-Stil auf: Gegeben → Gesucht → Formel → Formel
// umstellen (falls nötig) → Einheiten umrechnen (jede Zehner-/
// Zweierpotenz-Stufe einzeln ausgeschrieben) → Werte einsetzen →
// Berechnen → Ergebnis. Nutzt dieselben bereits in drCompute
// berechneten Werte — keine doppelte Berechnung. Wird nur
// aufgerufen, wenn der Lernmodus aktiv ist.
//
// DR_UNIT_CHAINS ordnet jede Einheiten-Gruppe (Bit/Byte × SI/IEC)
// absteigend von der größten bis zur Basiseinheit — daraus wird
// die vollständige Umrechnungskette Schritt für Schritt abgeleitet,
// ohne die Faktoren/Labels aus DR_UNIT_FACTORS zu duplizieren.
// =========================================================

const DR_UNIT_CHAINS = {
  'Bit (SI)':   ['tbit', 'gbit', 'mbit', 'kbit', 'bit'],
  'Bit (IEC)':  ['tibit', 'gibit', 'mibit', 'kibit', 'bit'],
  'Byte (SI)':  ['tb', 'gb', 'mb', 'kb', 'byte'],
  'Byte (IEC)': ['tib', 'gib', 'mib', 'kib', 'byte']
};

// Vorwärts: gegebene Einheit → Basiseinheit (Bit), jede Zwischenstufe
// als eigener Multiplikations-Schritt mit eigener Warum-Erklärung.
function drUnitChainSteps(unitKey, value, suffix = '') {
  const u = DR_UNIT_FACTORS[unitKey];
  if (!u) return { steps: [], baseValue: 0 };
  const chain = DR_UNIT_CHAINS[u.group];
  const startIdx = chain.indexOf(unitKey);
  const isByteGroup = u.group.startsWith('Byte');
  const isIEC = u.group.includes('IEC');
  const scale = isIEC ? 1024 : 1000;
  const scaleLabel = isIEC ? '1024' : '1.000';
  const steps = [];
  let current = value;

  for (let i = startIdx; i < chain.length - 1; i++) {
    const fromU = DR_UNIT_FACTORS[chain[i]];
    const toU = DR_UNIT_FACTORS[chain[i + 1]];
    const next = current * scale;
    steps.push({
      fromLabel: `${drFormatDecimal(current, 4)} ${fromU.label}${suffix}`,
      opLabel: `× ${scaleLabel}`,
      toLabel: `${drFormatDecimal(next, 4)} ${toU.label}${suffix}`,
      why: isIEC
        ? `${fromU.label} gehört zum IEC-System und rechnet in Zweierpotenzen. 1 ${fromU.label} = 1024 ${toU.label}.`
        : `${fromU.label} gehört zum SI-System und rechnet in Zehnerpotenzen. 1 ${fromU.label} = 1.000 ${toU.label}.`
    });
    current = next;
  }
  if (isByteGroup) {
    const next = current * 8;
    steps.push({
      fromLabel: `${drFormatDecimal(current, 4)} Byte${suffix}`,
      opLabel: '× 8',
      toLabel: `${drFormatInt(next)} Bit${suffix}`,
      why: 'Ein Byte besteht aus 8 Bit. Da Übertragungsraten und -mengen für die Formel immer in Bit angegeben werden, wird zuletzt mit 8 multipliziert.'
    });
    current = next;
  }
  return { steps, baseValue: current };
}

// Rückwärts: Basiswert (Bit) → gewünschte Zieleinheit, exakt aus dem
// Basiswert berechnet (kein Rundungsfehler durch Rück-Multiplikation).
function drUnitChainStepsFromBase(unitKey, baseValue, suffix = '') {
  const u = DR_UNIT_FACTORS[unitKey];
  if (!u) return { steps: [], targetValue: 0 };
  const chain = DR_UNIT_CHAINS[u.group];
  const targetIdx = chain.indexOf(unitKey);
  const isByteGroup = u.group.startsWith('Byte');
  const isIEC = u.group.includes('IEC');
  const scale = isIEC ? 1024 : 1000;
  const scaleLabel = isIEC ? '1024' : '1.000';
  const steps = [];
  let current = baseValue;

  if (isByteGroup) {
    const next = current / 8;
    steps.push({
      fromLabel: `${drFormatInt(current)} Bit${suffix}`,
      opLabel: '÷ 8',
      toLabel: `${drFormatDecimal(next, 4)} Byte${suffix}`,
      why: 'Ein Byte besteht aus 8 Bit, deshalb wird zur Rückumrechnung in Byte durch 8 geteilt.'
    });
    current = next;
  }
  for (let i = chain.length - 1; i > targetIdx; i--) {
    const fromU = DR_UNIT_FACTORS[chain[i]];
    const toU = DR_UNIT_FACTORS[chain[i - 1]];
    const next = current / scale;
    steps.push({
      fromLabel: `${drFormatDecimal(current, 4)} ${fromU.label}${suffix}`,
      opLabel: `÷ ${scaleLabel}`,
      toLabel: `${drFormatDecimal(next, 4)} ${toU.label}${suffix}`,
      why: isIEC
        ? `1 ${toU.label} = 1024 ${fromU.label}, deshalb wird durch 1024 geteilt, um von ${fromU.label} zu ${toU.label} zu kommen.`
        : `1 ${toU.label} = 1.000 ${fromU.label}, deshalb wird durch 1.000 geteilt, um von ${fromU.label} zu ${toU.label} zu kommen.`
    });
    current = next;
  }
  return { steps, targetValue: current };
}

function drRenderChain(chainResult, baseUnitLabel) {
  if (!chainResult.steps.length) {
    return `<div class="dr-learn-math-line">Bereits in ${baseUnitLabel} angegeben — keine Umrechnung nötig.</div>`;
  }
  return chainResult.steps.map(s => `
    <div class="dr-learn-chain-step">
      <div class="dr-learn-chain-eq"><span>${s.fromLabel}</span><span class="dr-learn-chain-op">${s.opLabel}</span><span class="dr-learn-chain-result">${s.toLabel}</span></div>
      <div class="dr-learn-why"><span class="dr-learn-why-icon">💡</span><span><strong>Warum ${s.opLabel}?</strong> ${s.why}</span></div>
    </div>
  `).join('');
}

function drRenderTimeChain(unitKey, value) {
  const u = DR_TIME_UNITS[unitKey];
  if (!u) return '';
  if (u.factor === 1) {
    return `<div class="dr-learn-math-line">Bereits in Sekunden angegeben — keine Umrechnung nötig.</div>`;
  }
  const seconds = value * u.factor;
  const factorLabel = drFormatDecimal(u.factor, 3);
  return `
    <div class="dr-learn-chain-step">
      <div class="dr-learn-chain-eq"><span>${drFormatDecimal(value, 4)} ${u.label}</span><span class="dr-learn-chain-op">× ${factorLabel}</span><span class="dr-learn-chain-result">${drFormatDecimal(seconds, 2)} Sekunden</span></div>
      <div class="dr-learn-why"><span class="dr-learn-why-icon">💡</span><span><strong>Warum × ${factorLabel}?</strong> 1 ${u.label} entspricht ${factorLabel} Sekunden, der gemeinsamen Basiseinheit für Zeit. Deshalb wird mit diesem Faktor multipliziert.</span></div>
    </div>
  `;
}

function drSection(icon, title, innerHtml, extraClass = '') {
  return `
    <div class="dr-learn-section ${extraClass}">
      <div class="dr-learn-section-head"><span class="dr-learn-section-icon">${icon}</span><span class="dr-learn-section-title">${title}</span></div>
      <div class="dr-learn-section-body">${innerHtml}</div>
    </div>
  `;
}

function drResultSection(valueText, subText) {
  return drSection('✅', 'Ergebnis', `
    <div class="dr-learn-result-value">${valueText}</div>
    ${subText ? `<div class="dr-learn-result-sub">${subText}</div>` : ''}
  `, 'dr-learn-section--result');
}

function drGivenLine(varName, value, unitLabel) {
  return `<div class="dr-learn-given-row"><span class="dr-learn-given-var">${varName}</span><span class="dr-learn-given-eq">=</span><span class="dr-learn-given-val">${value} ${unitLabel}</span></div>`;
}

function drSearchLine(varName) {
  return `<div class="dr-learn-search-line"><span class="dr-learn-search-var">${varName}</span><span class="dr-learn-search-eq">= ?</span></div>`;
}

function drFormulaLine(text) {
  return `<div class="dr-learn-formula">${text}</div>`;
}

function drFractionHtml(num, den) {
  return `<span class="dr-learn-fraction"><span class="dr-learn-fraction-num">${num}</span><span class="dr-learn-fraction-line"></span><span class="dr-learn-fraction-den">${den}</span></span>`;
}

function drBuildSolutionTime(ctx) {
  const amountChain = drUnitChainSteps(ctx.amountUnit, ctx.amountValue);
  const speedChain = drUnitChainSteps(ctx.speedUnit, ctx.speedValue, '/s');

  let html = '';
  html += drSection('📌', 'Gegeben', `
    ${drGivenLine('D', drFormatDecimal(ctx.amountValue, 4), drUnitLabel(ctx.amountUnit))}
    ${drGivenLine('c', drFormatDecimal(ctx.speedValue, 4), drUnitLabel(ctx.speedUnit) + '/s')}
  `, 'dr-learn-section--given');
  html += drSection('🎯', 'Gesucht', drSearchLine('t'), 'dr-learn-section--search');
  html += drSection('📐', 'Formel', drFormulaLine('c = D / t'));
  html += drSection('🔄', 'Formel umstellen', `
    <div class="dr-learn-rearrange-why">Nach <strong>t</strong> umgestellt: Beide Seiten der Gleichung werden mit <strong>t</strong> multipliziert und anschließend durch <strong>c</strong> geteilt.</div>
    ${drFormulaLine('t = D / c')}
  `);
  html += drSection('📦', 'Einheiten umrechnen', `
    <div class="dr-learn-chain-block"><div class="dr-learn-chain-label">Datenmenge D</div>${drRenderChain(amountChain, 'Bit')}</div>
    <div class="dr-learn-chain-block"><div class="dr-learn-chain-label">Geschwindigkeit c</div>${drRenderChain(speedChain, 'Bit/s')}</div>
  `);
  html += drSection('🧩', 'Werte einsetzen', `
    ${drFormulaLine('t = D / c')}
    <div class="dr-learn-arrow">↓</div>
    <div class="dr-learn-substitute-row"><span class="dr-learn-substitute-var">t =</span>${drFractionHtml(`${drFormatInt(ctx.amountBits)} Bit`, `${drFormatInt(ctx.speedBps)} Bit/s`)}</div>
  `);
  html += drSection('🧮', 'Berechnen', `
    <div class="dr-learn-math-line">${drFormatInt(ctx.amountBits)} Bit ÷ ${drFormatInt(ctx.speedBps)} Bit/s</div>
    <div class="dr-learn-arrow">↓</div>
    <div class="dr-learn-math-line dr-learn-math-line--result">t ≈ ${drFormatDecimal(ctx.result, 2)} Sekunden</div>
    <div class="dr-learn-why"><span class="dr-learn-why-icon">💡</span><span><strong>Warum wird dividiert?</strong> Die Formel lautet t = D / c. Die Datenmenge wird durch die Geschwindigkeit geteilt. Die Einheit Bit kürzt sich dabei weg, übrig bleibt die Einheit Sekunden.</span></div>
  `);
  html += drResultSection(`${drFormatDecimal(ctx.result, 2)} Sekunden`, ctx.result >= 60 ? `≈ ${drFormatDuration(ctx.result)}` : '');
  return html;
}

function drBuildSolutionSpeed(ctx) {
  const amountChain = drUnitChainSteps(ctx.amountUnit, ctx.amountValue);
  const timeChainHtml = drRenderTimeChain(ctx.timeUnit, ctx.timeValue);
  const needsBackConversion = DR_UNIT_FACTORS[ctx.resultUnit] && DR_UNIT_FACTORS[ctx.resultUnit].factor !== 1;

  let html = '';
  html += drSection('📌', 'Gegeben', `
    ${drGivenLine('D', drFormatDecimal(ctx.amountValue, 4), drUnitLabel(ctx.amountUnit))}
    ${drGivenLine('t', drFormatDecimal(ctx.timeValue, 4), drTimeLabel(ctx.timeUnit))}
  `, 'dr-learn-section--given');
  html += drSection('🎯', 'Gesucht', drSearchLine('c'), 'dr-learn-section--search');
  html += drSection('📐', 'Formel', drFormulaLine('c = D / t'));
  html += drSection('📦', 'Einheiten umrechnen', `
    <div class="dr-learn-chain-block"><div class="dr-learn-chain-label">Datenmenge D</div>${drRenderChain(amountChain, 'Bit')}</div>
    <div class="dr-learn-chain-block"><div class="dr-learn-chain-label">Zeit t</div>${timeChainHtml}</div>
  `);
  html += drSection('🧩', 'Werte einsetzen', `
    ${drFormulaLine('c = D / t')}
    <div class="dr-learn-arrow">↓</div>
    <div class="dr-learn-substitute-row"><span class="dr-learn-substitute-var">c =</span>${drFractionHtml(`${drFormatInt(ctx.amountBits)} Bit`, `${drFormatDecimal(ctx.timeSec, 2)} Sekunden`)}</div>
  `);
  html += drSection('🧮', 'Berechnen', `
    <div class="dr-learn-math-line">${drFormatInt(ctx.amountBits)} Bit ÷ ${drFormatDecimal(ctx.timeSec, 2)} Sekunden</div>
    <div class="dr-learn-arrow">↓</div>
    <div class="dr-learn-math-line dr-learn-math-line--result">c ≈ ${drFormatInt(ctx.speedResultBps)} Bit/s</div>
    <div class="dr-learn-why"><span class="dr-learn-why-icon">💡</span><span><strong>Warum wird dividiert?</strong> Die Formel lautet c = D / t. Die Datenmenge wird durch die Zeit geteilt — das Ergebnis ist per Definition eine Geschwindigkeit in Bit pro Sekunde.</span></div>
  `);
  if (needsBackConversion) {
    const back = drUnitChainStepsFromBase(ctx.resultUnit, ctx.speedResultBps, '/s');
    html += drSection('📦', 'Ergebnis in gewünschte Einheit umrechnen', drRenderChain(back, `${drUnitLabel(ctx.resultUnit)}/s`));
  }
  html += drResultSection(`${drFormatDecimal(ctx.displayValue, 4)} ${drUnitLabel(ctx.resultUnit)}/s`, `entspricht ${drFormatInt(ctx.speedResultBps)} Bit/s`);
  return html;
}

function drBuildSolutionAmount(ctx) {
  const speedChain = drUnitChainSteps(ctx.speedUnit, ctx.speedValue, '/s');
  const timeChainHtml = drRenderTimeChain(ctx.timeUnit, ctx.timeValue);
  const needsBackConversion = DR_UNIT_FACTORS[ctx.resultUnit] && DR_UNIT_FACTORS[ctx.resultUnit].factor !== 1;

  let html = '';
  html += drSection('📌', 'Gegeben', `
    ${drGivenLine('c', drFormatDecimal(ctx.speedValue, 4), drUnitLabel(ctx.speedUnit) + '/s')}
    ${drGivenLine('t', drFormatDecimal(ctx.timeValue, 4), drTimeLabel(ctx.timeUnit))}
  `, 'dr-learn-section--given');
  html += drSection('🎯', 'Gesucht', drSearchLine('D'), 'dr-learn-section--search');
  html += drSection('📐', 'Formel', drFormulaLine('c = D / t'));
  html += drSection('🔄', 'Formel umstellen', `
    <div class="dr-learn-rearrange-why">Nach <strong>D</strong> umgestellt: Beide Seiten der Gleichung werden mit <strong>t</strong> multipliziert.</div>
    ${drFormulaLine('D = c × t')}
  `);
  html += drSection('📦', 'Einheiten umrechnen', `
    <div class="dr-learn-chain-block"><div class="dr-learn-chain-label">Geschwindigkeit c</div>${drRenderChain(speedChain, 'Bit/s')}</div>
    <div class="dr-learn-chain-block"><div class="dr-learn-chain-label">Zeit t</div>${timeChainHtml}</div>
  `);
  html += drSection('🧩', 'Werte einsetzen', `
    ${drFormulaLine('D = c × t')}
    <div class="dr-learn-arrow">↓</div>
    <div class="dr-learn-math-line">D = ${drFormatInt(ctx.speedBps)} Bit/s × ${drFormatDecimal(ctx.timeSec, 2)} Sekunden</div>
  `);
  html += drSection('🧮', 'Berechnen', `
    <div class="dr-learn-math-line">${drFormatInt(ctx.speedBps)} × ${drFormatDecimal(ctx.timeSec, 2)}</div>
    <div class="dr-learn-arrow">↓</div>
    <div class="dr-learn-math-line dr-learn-math-line--result">D ≈ ${drFormatInt(ctx.amountResultBits)} Bit</div>
    <div class="dr-learn-why"><span class="dr-learn-why-icon">💡</span><span><strong>Warum wird multipliziert?</strong> Die Formel lautet D = c × t. Geschwindigkeit mal Zeit ergibt eine Datenmenge — die Einheit Sekunden kürzt sich dabei weg, übrig bleibt Bit.</span></div>
  `);
  if (needsBackConversion) {
    const back = drUnitChainStepsFromBase(ctx.resultUnit, ctx.amountResultBits, '');
    html += drSection('📦', 'Ergebnis in gewünschte Einheit umrechnen', drRenderChain(back, drUnitLabel(ctx.resultUnit)));
  }
  html += drResultSection(`${drFormatDecimal(ctx.displayValue, 4)} ${drUnitLabel(ctx.resultUnit)}`, `entspricht ${drFormatInt(ctx.amountResultBits)} Bit`);
  return html;
}

function drBuildLearnCards(mode, ctx) {
  const container = document.getElementById('dr-learn-solution');
  if (!container) return;
  if (mode === 'time') container.innerHTML = drBuildSolutionTime(ctx);
  else if (mode === 'speed') container.innerHTML = drBuildSolutionSpeed(ctx);
  else container.innerHTML = drBuildSolutionAmount(ctx);
}

function drClearLearnCards() {
  const container = document.getElementById('dr-learn-solution');
  if (container) container.innerHTML = '';
}

// =========================================================
// FORMELSAMMLUNG
// Modulare, rein HTML-basierte Nachschlagewerke (keine Bilder).
// NOOK_FORMULA_LIBRARY ist die zentrale Registry: jedes Modul
// besitzt Icon, Label und entweder eine render()-Funktion (Inhalt
// fertig, z. B. Datenübertragung) oder eine preview-Liste (Modul
// noch nicht umgesetzt → Platzhalter). Künftige Module (Signal-
// laufzeiten, Netzwerktechnik, ...) ergänzen hier einfach einen
// weiteren Eintrag — Nav und Modal-Logik bleiben unverändert.
//
// Die Präfix-Tabellen werden aus DR_UNIT_FACTORS abgeleitet statt
// die Faktoren erneut hart zu codieren — eine einzige Quelle für
// alle Bit/Byte-Umrechnungswerte im gesamten Rechner.
// =========================================================

const DR_SI_PREFIXES = [
  { key: 'kbit', symbol: 'k', name: 'Kilo' },
  { key: 'mbit', symbol: 'M', name: 'Mega' },
  { key: 'gbit', symbol: 'G', name: 'Giga' },
  { key: 'tbit', symbol: 'T', name: 'Tera' }
];

const DR_IEC_PREFIXES = [
  { key: 'kibit', symbol: 'Ki', name: 'Kibi' },
  { key: 'mibit', symbol: 'Mi', name: 'Mebi' },
  { key: 'gibit', symbol: 'Gi', name: 'Gibi' },
  { key: 'tibit', symbol: 'Ti', name: 'Tebi' }
];

const DR_SUPERSCRIPT_DIGITS = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
function drSuperscript(n) {
  return String(n).split('').map(ch => DR_SUPERSCRIPT_DIGITS[ch] || ch).join('');
}

function drFormulaSection(icon, title, innerHtml) {
  return drSection(icon, title, innerHtml, 'dr-formula-sheet-section');
}

function drRenderPrefixTable(prefixList, base) {
  const rows = prefixList.map(p => {
    const factor = DR_UNIT_FACTORS[p.key].factor;
    const n = Math.round(Math.log(factor) / Math.log(base));
    const expText = base === 1000 ? `10${drSuperscript(3 * n)}` : `2${drSuperscript(10 * n)}`;
    return `<tr><td>${p.name}-</td><td>${p.symbol}</td><td>${expText}</td><td>${drFormatInt(factor)}</td></tr>`;
  });
  return `
    <table class="dr-formula-table">
      <thead><tr><th>Präfix</th><th>Symbol</th><th>${base === 1000 ? 'Zehnerpotenz' : 'Zweierpotenz'}</th><th>Faktor</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
}

function drFormulaPrefixSections() {
  return `
    ${drFormulaSection('📏', 'SI-Präfixe (1000er-Schritte)', drRenderPrefixTable(DR_SI_PREFIXES, 1000))}
    ${drFormulaSection('📏', 'IEC-Präfixe (1024er-Schritte)', drRenderPrefixTable(DR_IEC_PREFIXES, 1024))}
  `;
}

function drFormulaContentDatarate() {
  return `
    ${drFormulaPrefixSections()}
    ${drFormulaSection('🔁', 'Byte ↔ Bit', `
      <div class="dr-formula-note"><strong>1 Byte = 8 Bit</strong><br>
      Übertragungsraten werden immer in Bit pro Sekunde (Bit/s) angegeben, Datenmengen (z. B. Dateigrößen) oft in Byte. Für gemeinsame Rechnungen muss die Datenmenge deshalb zuerst in Bit umgerechnet werden.</div>
    `)}
    ${drFormulaSection('📐', 'Formeln', `
      <div class="dr-formula-formula-row"><span class="dr-formula-formula">c = D / t</span><span class="dr-formula-formula-desc">Geschwindigkeit = Datenmenge ÷ Zeit</span></div>
      <div class="dr-formula-formula-row"><span class="dr-formula-formula">t = D / c</span><span class="dr-formula-formula-desc">Zeit = Datenmenge ÷ Geschwindigkeit</span></div>
      <div class="dr-formula-formula-row"><span class="dr-formula-formula">D = c × t</span><span class="dr-formula-formula-desc">Datenmenge = Geschwindigkeit × Zeit</span></div>
    `)}
  `;
}

function drFormulaPlaceholder(preview) {
  return `
    <div class="dr-formula-placeholder">
      <div class="dr-formula-placeholder-icon">🚧</div>
      <div class="dr-formula-placeholder-title">Diese Formelsammlung ist noch in Vorbereitung.</div>
      ${preview && preview.length ? `<ul class="dr-formula-placeholder-list">${preview.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}
    </div>
  `;
}

const NOOK_FORMULA_LIBRARY = {
  datarate: { icon: '📡', label: 'Datenübertragung', available: true, render: drFormulaContentDatarate },
  prefixes: { icon: '📏', label: 'SI / IEC Präfixe', available: true, render: drFormulaPrefixSections },
  signal: {
    icon: '⚡', label: 'Signallaufzeiten', available: false,
    preview: ['Lichtgeschwindigkeit im Vakuum', 'NVP (Nominal Velocity of Propagation)', 'Brechungsindex', 'Zusammenhang zwischen beiden']
  },
  network: {
    icon: '🌐', label: 'Netzwerke', available: false,
    preview: ['IPv4-Aufbau', 'CIDR-Tabelle', 'Netzmasken', 'Host-Berechnung', 'Broadcast-Regeln']
  },
  binary: {
    icon: '🔢', label: 'Binär', available: false,
    preview: ['Binär ↔ Dezimal', 'Potenztabelle', 'Umrechnungsverfahren']
  },
  hex: {
    icon: '⌨', label: 'Hexadezimal', available: false,
    preview: ['Hexadezimal ↔ Dezimal', 'Hexadezimal ↔ Binär', 'Typische Anwendungen (MAC, Farbcodes, ...)']
  }
};

let drFormulaActiveKey = 'datarate';

function drRenderFormulaNav() {
  const nav = document.getElementById('dr-formula-nav');
  if (!nav) return;
  nav.innerHTML = Object.entries(NOOK_FORMULA_LIBRARY).map(([key, mod]) => `
    <button class="dr-formula-nav-item ${key === drFormulaActiveKey ? 'active' : ''}" data-formula-key="${key}">
      <span class="dr-formula-nav-icon">${mod.icon}</span><span class="dr-formula-nav-label">${mod.label}</span>
      ${!mod.available ? '<span class="dr-formula-nav-badge">bald</span>' : ''}
    </button>
  `).join('');
  nav.querySelectorAll('[data-formula-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      drFormulaActiveKey = btn.dataset.formulaKey;
      drRenderFormulaNav();
      drRenderFormulaContent();
    });
  });
}

function drRenderFormulaContent() {
  const content = document.getElementById('dr-formula-content');
  if (!content) return;
  const mod = NOOK_FORMULA_LIBRARY[drFormulaActiveKey];
  content.innerHTML = `
    <div class="dr-formula-content-head"><span class="dr-formula-content-icon">${mod.icon}</span><span class="dr-formula-content-title">${mod.label}</span></div>
    <div class="dr-formula-content-body">${mod.available ? mod.render() : drFormulaPlaceholder(mod.preview)}</div>
  `;
}

function openDrFormulaModal() {
  drRenderFormulaNav();
  drRenderFormulaContent();
  document.getElementById('dr-formula-modal-overlay').classList.remove('hidden');
}
function closeDrFormulaModal() {
  document.getElementById('dr-formula-modal-overlay').classList.add('hidden');
}

function drApplyLearnMode() {
  const layoutEl = document.getElementById('dr-layout');
  const toggleEl = document.getElementById('dr-learn-toggle');
  if (toggleEl) toggleEl.checked = drState.learnMode;
  if (layoutEl) layoutEl.classList.toggle('dr-layout--learn-off', !drState.learnMode);

  const inlineEl = document.getElementById('dr-formula-inline');
  if (inlineEl) inlineEl.classList.toggle('hidden', !drState.learnMode);
  if (!drState.learnMode) {
    const panel = document.getElementById('dr-formula-inline-panel');
    const btn = document.getElementById('dr-formula-inline-btn');
    if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
    if (btn) btn.classList.remove('active');
  }
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

  document.getElementById('dr-formula-global-btn').addEventListener('click', openDrFormulaModal);
  document.getElementById('dr-formula-modal-close').addEventListener('click', closeDrFormulaModal);
  document.getElementById('dr-formula-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('dr-formula-modal-overlay')) closeDrFormulaModal();
  });

  document.getElementById('dr-formula-inline-btn').addEventListener('click', () => {
    const panel = document.getElementById('dr-formula-inline-panel');
    const btn = document.getElementById('dr-formula-inline-btn');
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
      panel.innerHTML = drFormulaContentDatarate();
      panel.classList.remove('hidden');
      btn.classList.add('active');
    } else {
      panel.classList.add('hidden');
      panel.innerHTML = '';
      btn.classList.remove('active');
    }
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
