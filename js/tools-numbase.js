// =========================
// TOOLS — 8) ZAHLENSYSTEME (Binär · Oktal · Dezimal · Hexadezimal)
// Eine Zahl in einem System eingeben, alle anderen sofort sehen —
// mit Rechenweg (Restwertverfahren, Stellenwerte, 4er-Gruppen).
// Rechnet mit BigInt, damit auch 64-Bit-Werte exakt bleiben.
// Benötigt tools.js (Karten-Raster) und tools-datarate.js (drSection) zuvor geladen.
// =========================

const NB_BASES = [
  { base: 2,  label: 'Binär',       prefix: '0b', digits: /^[01]+$/ },
  { base: 8,  label: 'Oktal',       prefix: '0o', digits: /^[0-7]+$/ },
  { base: 10, label: 'Dezimal',     prefix: '',   digits: /^[0-9]+$/ },
  { base: 16, label: 'Hexadezimal', prefix: '0x', digits: /^[0-9a-f]+$/i },
];

let toolsNumbaseState = Object.assign({ value: '202', base: 10, steps: true }, DB.get('toolsNumbaseState', {}));
function saveToolsNumbaseState() { DB.set('toolsNumbaseState', toolsNumbaseState); }

function toolsNumbaseCardHtml() {
  return `
    <div class="tool-card" id="tool-numbase">
      <div class="tool-card-header">
        <span class="tool-card-icon">🔢</span>
        <span class="tool-card-title">Zahlensysteme</span>
      </div>
      <div class="tool-card-body">
        <div class="tool-mode-group" role="group" aria-label="Eingabe-System">
          ${NB_BASES.map(b => `<button class="tool-mode-btn" data-nb-base="${b.base}">${b.label}</button>`).join('')}
        </div>
        <input type="text" class="modal-input nb-input" id="nb-input" autocomplete="off" spellcheck="false" aria-label="Zahl">
        <div class="sn-error hidden" id="nb-error" role="alert"></div>
        <div class="nb-out" id="nb-out"></div>
        <button class="tool-settings-toggle" id="nb-steps-toggle">Rechenweg</button>
        <div class="nb-steps" id="nb-steps"></div>
      </div>
    </div>`;
}

function nbParse(raw, base) {
  let s = String(raw).trim().toLowerCase().replace(/[\s_.]/g, '');
  const def = NB_BASES.find(b => b.base === base);
  if (def.prefix && s.startsWith(def.prefix)) s = s.slice(2);
  if (!s) return { empty: true };
  if (!def.digits.test(s)) return { error: `Ungültige Ziffer für ${def.label}.` };
  let n = 0n;
  for (const ch of s) n = n * BigInt(base) + BigInt(parseInt(ch, 16));
  return { n, s };
}

function nbGroup(str, size, sep = ' ') {
  const pad = str.padStart(Math.ceil(str.length / size) * size, '0');
  return pad.match(new RegExp(`.{${size}}`, 'g')).join(sep);
}

function nbFormat(n, base) {
  const s = n.toString(base).toUpperCase();
  if (base === 2) return nbGroup(s, 4);
  if (base === 16) return nbGroup(s, 2);
  if (base === 10) return n.toLocaleString('de-DE');
  return s;
}

function nbSteps(n, fromBase, s) {
  const out = [];
  if (fromBase !== 10) {
    // Stellenwert-Verfahren: Ziffer × Basis^Stelle
    if (s.length <= 16) {
      const terms = s.split('').map((ch, i) => {
        const pow = s.length - 1 - i;
        const d = parseInt(ch, 16);
        return { ch: ch.toUpperCase(), d, pow, val: BigInt(d) * BigInt(fromBase) ** BigInt(pow) };
      });
      out.push(drSection('➡️', `${NB_BASES.find(b => b.base === fromBase).label} → Dezimal (Stellenwerte)`, `
        ${terms.map(t => `<div class="dr-learn-math-line sn-mono">${t.ch}${fromBase === 16 && t.d > 9 ? ` (${t.d})` : ''} × ${fromBase}<sup>${t.pow}</sup> = ${t.val.toLocaleString('de-DE')}</div>`).join('')}
        <div class="dr-learn-arrow">↓ Summe</div>
        <div class="dr-learn-math-line dr-learn-math-line--result">${n.toLocaleString('de-DE')}</div>`));
    }
  }
  if (n <= 0xFFFFFFFFn) {
    // Restwertverfahren: fortlaufend durch 2 teilen
    const rows = [];
    let x = n;
    if (x === 0n) rows.push('0 ÷ 2 = 0 Rest 0');
    while (x > 0n) { rows.push(`${x.toLocaleString('de-DE')} ÷ 2 = ${(x / 2n).toLocaleString('de-DE')} Rest <strong>${x % 2n}</strong>`); x /= 2n; }
    out.push(drSection('⬇️', 'Dezimal → Binär (Restwertverfahren)', `
      ${rows.map(r => `<div class="dr-learn-math-line sn-mono">${r}</div>`).join('')}
      <div class="dr-learn-why"><span class="dr-learn-why-icon">💡</span><span>Die Reste <strong>von unten nach oben</strong> gelesen ergeben die Binärzahl: <span class="sn-mono">${n.toString(2)}</span></span></div>`));
  }
  // Binär ↔ Hex über 4er-Gruppen
  const bin = n.toString(2);
  const nibbles = nbGroup(bin, 4).split(' ');
  if (nibbles.length <= 16) {
    out.push(drSection('🧩', 'Binär ↔ Hexadezimal (4er-Gruppen)', `
      <div class="nb-nibbles">${nibbles.map(nb => `<span class="nb-nibble"><span class="sn-mono">${nb}</span><b>${parseInt(nb, 2).toString(16).toUpperCase()}</b></span>`).join('')}</div>
      <div class="dr-learn-why"><span class="dr-learn-why-icon">💡</span><span>Je 4 Bit ergeben genau eine Hex-Ziffer (0–F), deshalb lässt sich zwischen Binär und Hex ohne Umweg über Dezimal umrechnen.</span></div>`));
  }
  return out.join('');
}

function renderNumbase() {
  const out = document.getElementById('nb-out');
  if (!out) return;
  document.querySelectorAll('#tool-numbase [data-nb-base]').forEach(b => b.classList.toggle('active', Number(b.dataset.nbBase) === toolsNumbaseState.base));
  const p = nbParse(toolsNumbaseState.value, toolsNumbaseState.base);
  const err = document.getElementById('nb-error');
  err.classList.toggle('hidden', !p.error);
  err.textContent = p.error || '';
  const stepsEl = document.getElementById('nb-steps');
  document.getElementById('nb-steps-toggle').classList.toggle('active', toolsNumbaseState.steps);
  if (p.error || p.empty) { out.innerHTML = ''; stepsEl.innerHTML = ''; return; }
  const bits = p.n === 0n ? 1 : p.n.toString(2).length;
  out.innerHTML = NB_BASES.map(b => `
    <button type="button" class="nb-row${b.base === toolsNumbaseState.base ? ' nb-row--src' : ''}" data-nb-copy="${p.n.toString(b.base).toUpperCase()}" title="Kopieren">
      <span class="nb-row-label">${b.label}</span>
      <span class="nb-row-value sn-mono">${nbFormat(p.n, b.base)}</span>
    </button>`).join('') + `<div class="sn-note">${bits} Bit · ${Math.ceil(bits / 8)} Byte${Math.ceil(bits / 8) === 1 ? '' : 's'} nötig</div>`;
  stepsEl.innerHTML = toolsNumbaseState.steps ? nbSteps(p.n, toolsNumbaseState.base, p.s) : '';
}

function initNumbaseConverter() {
  const input = document.getElementById('nb-input');
  input.value = toolsNumbaseState.value;
  input.addEventListener('input', () => { toolsNumbaseState.value = input.value; saveToolsNumbaseState(); renderNumbase(); });
  document.querySelectorAll('#tool-numbase [data-nb-base]').forEach(btn => btn.addEventListener('click', () => {
    // Beim Systemwechsel den aktuellen Wert mit umrechnen, damit die Zahl gleich bleibt
    const p = nbParse(toolsNumbaseState.value, toolsNumbaseState.base);
    toolsNumbaseState.base = Number(btn.dataset.nbBase);
    if (p.n !== undefined) input.value = toolsNumbaseState.value = p.n.toString(toolsNumbaseState.base).toUpperCase();
    saveToolsNumbaseState();
    renderNumbase();
    input.focus();
  }));
  document.getElementById('nb-steps-toggle').addEventListener('click', () => {
    toolsNumbaseState.steps = !toolsNumbaseState.steps;
    saveToolsNumbaseState();
    renderNumbase();
  });
  document.getElementById('nb-out').addEventListener('click', e => {
    const row = e.target.closest('[data-nb-copy]');
    if (!row || !navigator.clipboard) return;
    navigator.clipboard.writeText(row.dataset.nbCopy).then(() => {
      row.classList.add('nb-row--copied');
      setTimeout(() => row.classList.remove('nb-row--copied'), 900);
    }).catch(() => {});
  });
  renderNumbase();
}
