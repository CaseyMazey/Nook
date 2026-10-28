// =========================
// TOOLS — 7) SUBNETZ-RECHNER (IPv4 + IPv6)
// IP mit Präfix (CIDR) oder Netzmaske → Netz, Broadcast, Host-Bereich,
// Anzahl Hosts, Binärdarstellung; optional Lernmodus (Rechenweg im
// Berufsschul-Stil) und Aufteilen in gleich große Subnetze.
// IPv4 rechnet mit 32-Bit-Zahlen (>>> 0), IPv6 mit BigInt.
// Benötigt tools.js (Karten-Raster) zuvor geladen.
// =========================

let toolsSubnetState = Object.assign({ input: '192.168.10.37/26', split: '', learn: true }, DB.get('toolsSubnetState', {}));
function saveToolsSubnetState() { DB.set('toolsSubnetState', toolsSubnetState); }

function toolsSubnetCardHtml() {
  return `
    <div class="tool-card tool-card--wide" id="tool-subnet">
      <div class="tool-card-header">
        <span class="tool-card-icon">🌐</span>
        <span class="tool-card-title">Subnetz-Rechner</span>
        <label class="dr-learn-switch" for="sn-learn-toggle" title="Lernmodus: Rechenweg Schritt für Schritt erklären">
          <span class="dr-learn-switch-label">🎓 Lernmodus</span>
          <span class="toggle"><input type="checkbox" id="sn-learn-toggle"><span class="toggle-slider"></span></span>
        </label>
      </div>
      <div class="tool-card-body">
        <div class="sn-inputs">
          <label class="conv-label" for="sn-input">IP-Adresse mit Präfix oder Maske</label>
          <input type="text" class="modal-input sn-input" id="sn-input" placeholder="z.B. 192.168.10.37/26 · 10.0.0.5 255.255.255.0 · 2001:db8::1/64" autocomplete="off" spellcheck="false">
          <div class="sn-split-row">
            <label for="sn-split">In Subnetze aufteilen</label>
            <input type="number" class="modal-input" id="sn-split" min="2" max="1024" placeholder="Anzahl">
          </div>
        </div>
        <div class="sn-error hidden" id="sn-error" role="alert"></div>
        <div class="sn-result" id="sn-result"></div>
        <div class="sn-learn" id="sn-learn"></div>
        <div class="sn-subnets" id="sn-subnets"></div>
      </div>
    </div>`;
}

// ── IPv4 ───────────────────────────────────────────────
function snParseV4(str) {
  const parts = String(str).trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n >>> 0;
}
function snV4ToStr(n) { return [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.'); }
function snV4Mask(prefix) { return prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0; }
function snV4Bin(n, prefix) {
  const bits = (n >>> 0).toString(2).padStart(32, '0');
  const octets = [0, 8, 16, 24].map(i => bits.slice(i, i + 8));
  if (prefix === undefined) return octets.join('.');
  // Netzanteil / Hostanteil farblich trennen
  let pos = 0;
  return octets.map(o => o.split('').map(b => `<span class="${pos++ < prefix ? 'sn-bit-net' : 'sn-bit-host'}">${b}</span>`).join('')).join('.');
}
function snMaskToPrefix(mask) {
  const bin = (mask >>> 0).toString(2).padStart(32, '0');
  return /^1*0*$/.test(bin) ? bin.indexOf('0') === -1 ? 32 : bin.indexOf('0') : null;
}
function snV4Info(ip) {
  const a = ip >>> 24, b = (ip >>> 16) & 255;
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'privat (RFC 1918)';
  if (a === 127) return 'Loopback';
  if (a === 169 && b === 254) return 'Link-Local (APIPA)';
  if (a === 100 && b >= 64 && b <= 127) return 'Carrier-Grade NAT';
  if (a >= 224 && a <= 239) return 'Multicast';
  if (a >= 240) return 'reserviert';
  return 'öffentlich';
}
function snV4Class(ip) {
  const a = ip >>> 24;
  if (a < 128) return 'A'; if (a < 192) return 'B'; if (a < 224) return 'C'; if (a < 240) return 'D'; return 'E';
}

function snCalcV4(ip, prefix) {
  const mask = snV4Mask(prefix);
  const net = (ip & mask) >>> 0;
  const bc = (net | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  const hosts = prefix === 32 ? 1 : prefix === 31 ? 2 : total - 2;
  const first = prefix >= 31 ? net : net + 1;
  const last = prefix >= 31 ? bc : bc - 1;
  return { ip, prefix, mask, net, bc, total, hosts, first, last, wildcard: (~mask) >>> 0 };
}

// ── IPv6 ───────────────────────────────────────────────
function snParseV6(str) {
  let s = String(str).trim().toLowerCase();
  if (!/^[0-9a-f:]+$/.test(s) || (s.match(/::/g) || []).length > 1) return null;
  let groups;
  if (s.includes('::')) {
    const [l, r] = s.split('::');
    const left = l ? l.split(':') : [], right = r ? r.split(':') : [];
    const fill = 8 - left.length - right.length;
    if (fill < 1) return null;
    groups = [...left, ...Array(fill).fill('0'), ...right];
  } else groups = s.split(':');
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g, 16)), 0n);
}
function snV6Groups(n) {
  const out = [];
  for (let i = 7; i >= 0; i--) out.push(((n >> BigInt(i * 16)) & 0xFFFFn).toString(16));
  return out;
}
function snV6Full(n) { return snV6Groups(n).map(g => g.padStart(4, '0')).join(':'); }
function snV6Short(n) {
  const g = snV6Groups(n);
  let bestStart = -1, bestLen = 0;
  for (let i = 0; i < 8;) {
    if (g[i] !== '0') { i++; continue; }
    let j = i; while (j < 8 && g[j] === '0') j++;
    if (j - i > bestLen && j - i >= 2) { bestStart = i; bestLen = j - i; }
    i = j;
  }
  if (bestStart < 0) return g.join(':');
  return `${g.slice(0, bestStart).join(':')}::${g.slice(bestStart + bestLen).join(':')}`;
}
function snV6Info(n) {
  const top = Number(n >> 112n);
  if (n === 1n) return 'Loopback (::1)';
  if (n === 0n) return 'unspezifiziert (::)';
  if ((top & 0xFFC0) === 0xFE80) return 'Link-Local (fe80::/10)';
  if ((top & 0xFE00) === 0xFC00) return 'Unique Local (fc00::/7, privat)';
  if ((top & 0xFF00) === 0xFF00) return 'Multicast (ff00::/8)';
  if ((top & 0xE000) === 0x2000) return 'Global Unicast (2000::/3)';
  return 'reserviert / sonstiges';
}
function snFmtBig(b) { return b.toLocaleString('de-DE'); }

// ── Eingabe lesen: "ip/prefix", "ip maske", "ip/maske" ──
function snParseInput(raw) {
  const s = String(raw).trim();
  if (!s) return { error: '' };
  const m = s.match(/^([^\s/]+)\s*(?:\/\s*|\s+)?([^\s]*)$/);
  if (!m) return { error: 'Eingabe nicht erkannt — Beispiel: 192.168.10.37/26' };
  const [, ipStr, suffix] = m;
  if (ipStr.includes(':')) {
    const ip = snParseV6(ipStr);
    if (ip === null) return { error: 'Keine gültige IPv6-Adresse.' };
    const prefix = suffix === '' ? 64 : Number(suffix);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return { error: 'IPv6-Präfix muss zwischen 0 und 128 liegen.' };
    return { v: 6, ip, prefix, assumed: suffix === '' };
  }
  const ip = snParseV4(ipStr);
  if (ip === null) return { error: 'Keine gültige IPv4-Adresse (vier Zahlen 0–255, mit Punkten getrennt).' };
  let prefix;
  if (suffix === '') prefix = { A: 8, B: 16, C: 24 }[snV4Class(ip)] ?? 24;
  else if (/^\d{1,2}$/.test(suffix)) prefix = Number(suffix);
  else {
    const mask = snParseV4(suffix);
    prefix = mask === null ? null : snMaskToPrefix(mask);
    if (prefix === null) return { error: 'Ungültige Netzmaske — die Einsen müssen am Stück links stehen (z.B. 255.255.255.192).' };
  }
  if (prefix < 0 || prefix > 32) return { error: 'IPv4-Präfix muss zwischen 0 und 32 liegen.' };
  return { v: 4, ip, prefix, assumed: suffix === '' };
}

function snRow(label, value, mono = true) {
  return `<div class="sn-row"><span class="sn-row-label">${label}</span><span class="sn-row-value${mono ? ' sn-mono' : ''}">${value}</span></div>`;
}

function renderSubnet() {
  const errEl = document.getElementById('sn-error');
  const resEl = document.getElementById('sn-result');
  const learnEl = document.getElementById('sn-learn');
  const subEl = document.getElementById('sn-subnets');
  if (!resEl) return;
  const p = snParseInput(toolsSubnetState.input);
  errEl.classList.toggle('hidden', !p.error);
  errEl.textContent = p.error || '';
  if (p.error !== undefined) { resEl.innerHTML = learnEl.innerHTML = subEl.innerHTML = ''; return; }

  const note = p.assumed ? `<div class="sn-note">Kein Präfix angegeben — angenommen: /${p.prefix}${p.v === 4 ? ` (Standard für Klasse ${snV4Class(p.ip)})` : ' (übliche Subnetzgröße)'}.</div>` : '';

  if (p.v === 4) {
    const r = snCalcV4(p.ip, p.prefix);
    resEl.innerHTML = note + `<div class="sn-grid">
      ${snRow('Netzadresse', `${snV4ToStr(r.net)}/${r.prefix}`)}
      ${snRow('Broadcast', snV4ToStr(r.bc))}
      ${snRow('Netzmaske', `${snV4ToStr(r.mask)} (/${r.prefix})`)}
      ${snRow('Wildcard', snV4ToStr(r.wildcard))}
      ${snRow('Erster Host', snV4ToStr(r.first))}
      ${snRow('Letzter Host', snV4ToStr(r.last))}
      ${snRow('Nutzbare Hosts', r.hosts.toLocaleString('de-DE'), false)}
      ${snRow('Adressen gesamt', r.total.toLocaleString('de-DE'), false)}
      ${snRow('Art', `${snV4Info(r.ip)} · Klasse ${snV4Class(r.ip)}`, false)}
    </div>
    <div class="sn-bin">
      ${snRow('IP binär', snV4Bin(r.ip, r.prefix))}
      ${snRow('Maske binär', snV4Bin(r.mask, r.prefix))}
      <div class="sn-legend"><span class="sn-bit-net">■</span> Netzanteil (${r.prefix} Bit) <span class="sn-bit-host">■</span> Hostanteil (${32 - r.prefix} Bit)</div>
    </div>`;
    learnEl.innerHTML = toolsSubnetState.learn ? snLearnV4(r) : '';
    subEl.innerHTML = snRenderSplitV4(r);
  } else {
    const hostBits = 128 - p.prefix;
    const mask = hostBits === 128 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(hostBits)) - 1n);
    const net = p.ip & mask;
    const last = net | ((1n << BigInt(hostBits)) - 1n);
    resEl.innerHTML = note + `<div class="sn-grid">
      ${snRow('Netz (Präfix)', `${snV6Short(net)}/${p.prefix}`)}
      ${snRow('Adresse gekürzt', snV6Short(p.ip))}
      ${snRow('Adresse ausgeschrieben', snV6Full(p.ip))}
      ${snRow('Erste Adresse', snV6Short(net))}
      ${snRow('Letzte Adresse', snV6Short(last))}
      ${snRow('Adressen im Netz', `2<sup>${hostBits}</sup> = ${snFmtBig(1n << BigInt(hostBits))}`, false)}
      ${snRow('Art', snV6Info(p.ip), false)}
    </div>`;
    learnEl.innerHTML = toolsSubnetState.learn ? snLearnV6(p, net, hostBits) : '';
    subEl.innerHTML = snRenderSplitV6(net, p.prefix);
  }
}

function snLearnV4(r) {
  const hostBits = 32 - r.prefix;
  return `
    ${drSection('📌', 'Gegeben', `${drGivenLine('IP', snV4ToStr(r.ip), '')}${drGivenLine('Präfix', '/' + r.prefix, '')}`, 'dr-learn-section--given')}
    ${drSection('🎯', 'Worum geht es?', `<div class="dr-learn-math-line">Eine IP-Adresse besteht aus zwei Teilen: dem <strong>Netz</strong> (wie die Straße) und dem <strong>Host</strong> (wie die Hausnummer). Die Maske sagt, wo die Straße aufhört. Gesucht ist die Adresse, mit der die Straße beginnt — die <strong>Netzadresse</strong>.</div>`)}
    ${drSection('1️⃣', 'Maske aus dem Präfix', `<div class="dr-learn-math-line">/${r.prefix} heißt: die ersten <strong>${r.prefix}</strong> Bit sind 1, die restlichen <strong>${hostBits}</strong> Bit sind 0.</div>
      <div class="dr-learn-math-line sn-mono">${snV4Bin(r.mask, r.prefix)}</div>
      <div class="dr-learn-math-line">= <strong class="sn-mono">${snV4ToStr(r.mask)}</strong></div>`)}
    ${drSection('2️⃣', 'Netzadresse: IP UND Maske', `<div class="dr-learn-math-line sn-mono">${snV4Bin(r.ip, r.prefix)}  (IP)</div>
      <div class="dr-learn-math-line sn-mono">${snV4Bin(r.mask, r.prefix)}  (Maske)</div>
      <div class="dr-learn-arrow">↓ Stelle für Stelle vergleichen (bitweises UND)</div>
      <div class="dr-learn-math-line sn-mono">${snV4Bin(r.net, r.prefix)} = <strong>${snV4ToStr(r.net)}</strong></div>
      <div class="dr-learn-why"><span class="dr-learn-why-icon">💡</span><span><strong>Was passiert hier?</strong> Man legt die Maske wie eine Schablone über die IP und geht Ziffer für Ziffer durch: Steht in der Maske eine <strong>1</strong>, schreibt man die Ziffer der IP einfach ab. Steht in der Maske eine <strong>0</strong>, schreibt man <strong>0</strong> hin. Die kräftigen Ziffern vorne (die Straße) bleiben also gleich, die blassen hinten (die Hausnummer) werden alle zu 0. Heraus kommt die Netzadresse — die Straße ohne Hausnummer.</span></div>`)}
    ${drSection('3️⃣', 'Broadcast: alle Hostbits auf 1', `<div class="dr-learn-math-line sn-mono">${snV4Bin(r.bc, r.prefix)} = <strong>${snV4ToStr(r.bc)}</strong></div>`)}
    ${drSection('4️⃣', 'Anzahl Hosts', `<div class="dr-learn-math-line">2<sup>${hostBits}</sup> = ${r.total.toLocaleString('de-DE')} Adressen${r.prefix < 31 ? ` − 2 (Netz + Broadcast) = <strong>${r.hosts.toLocaleString('de-DE')}</strong> Hosts` : ''}</div>
      ${r.prefix >= 31 ? '<div class="dr-learn-why"><span class="dr-learn-why-icon">💡</span><span>Bei /31 (Punkt-zu-Punkt, RFC 3021) und /32 (einzelner Host) wird nichts abgezogen.</span></div>' : ''}`)}
    ${drResultSection(`${snV4ToStr(r.first)} – ${snV4ToStr(r.last)}`, `Netz ${snV4ToStr(r.net)}/${r.prefix} · Broadcast ${snV4ToStr(r.bc)}`)}`;
}

function snLearnV6(p, net, hostBits) {
  return `
    ${drSection('1️⃣', 'Adresse ausschreiben', `<div class="dr-learn-math-line">„::“ steht für einen Block aus Nullgruppen, führende Nullen je Gruppe dürfen fehlen.</div>
      <div class="dr-learn-math-line sn-mono">${snV6Full(p.ip)}</div>`)}
    ${drSection('2️⃣', 'Präfix abschneiden', `<div class="dr-learn-math-line">/${p.prefix}: die ersten ${p.prefix} Bit (= ${p.prefix / 4} Hex-Stellen) sind das Netz, die restlichen ${hostBits} Bit werden 0.</div>
      <div class="dr-learn-math-line sn-mono">${snV6Full(net)}</div>`)}
    ${drSection('3️⃣', 'Wieder kürzen', `<div class="dr-learn-math-line">Führende Nullen weg, die längste Nullfolge wird zu „::“.</div>
      <div class="dr-learn-math-line sn-mono"><strong>${snV6Short(net)}/${p.prefix}</strong></div>`)}
    ${drResultSection(`${snV6Short(net)}/${p.prefix}`, `2^${hostBits} Adressen`)}`;
}

function snRenderSplitV4(r) {
  const n = parseInt(toolsSubnetState.split, 10);
  if (!n || n < 2) return '';
  const extra = Math.ceil(Math.log2(n));
  const newPrefix = r.prefix + extra;
  if (newPrefix > 32) return `<div class="sn-note">Zu viele Subnetze: /${r.prefix} lässt sich höchstens in ${2 ** (32 - r.prefix)} Teile teilen.</div>`;
  const count = 2 ** extra, size = 2 ** (32 - newPrefix);
  const shown = Math.min(count, 256);
  const rows = [];
  for (let i = 0; i < shown; i++) {
    const s = snCalcV4((r.net + i * size) >>> 0, newPrefix);
    rows.push(`<tr><td>${i + 1}</td><td class="sn-mono">${snV4ToStr(s.net)}/${newPrefix}</td><td class="sn-mono">${snV4ToStr(s.first)} – ${snV4ToStr(s.last)}</td><td class="sn-mono">${snV4ToStr(s.bc)}</td><td>${s.hosts.toLocaleString('de-DE')}</td></tr>`);
  }
  return `<div class="sn-split-head">${n} Subnetze gewünscht → ${extra} Bit leihen → <strong>${count} Subnetze /${newPrefix}</strong> mit je ${snCalcV4(r.net, newPrefix).hosts.toLocaleString('de-DE')} Hosts (neue Maske ${snV4ToStr(snV4Mask(newPrefix))})</div>
    <div class="sn-table-wrap"><table class="dr-formula-table sn-table"><thead><tr><th>#</th><th>Netz</th><th>Host-Bereich</th><th>Broadcast</th><th>Hosts</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
    ${count > shown ? `<div class="sn-note">Erste ${shown} von ${count} Subnetzen.</div>` : ''}`;
}

function snRenderSplitV6(net, prefix) {
  const n = parseInt(toolsSubnetState.split, 10);
  if (!n || n < 2) return '';
  const extra = Math.ceil(Math.log2(n));
  const newPrefix = prefix + extra;
  if (newPrefix > 128) return '<div class="sn-note">Zu viele Subnetze für dieses Präfix.</div>';
  const count = 2 ** extra, shown = Math.min(count, 256);
  const step = 1n << BigInt(128 - newPrefix);
  const rows = [];
  for (let i = 0; i < shown; i++) rows.push(`<tr><td>${i + 1}</td><td class="sn-mono">${snV6Short(net + BigInt(i) * step)}/${newPrefix}</td></tr>`);
  return `<div class="sn-split-head">${n} Subnetze gewünscht → ${extra} Bit → <strong>${count} Subnetze /${newPrefix}</strong></div>
    <div class="sn-table-wrap"><table class="dr-formula-table sn-table"><thead><tr><th>#</th><th>Netz</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
    ${count > shown ? `<div class="sn-note">Erste ${shown} von ${count} Subnetzen.</div>` : ''}`;
}

function initSubnetCalculator() {
  const input = document.getElementById('sn-input');
  const split = document.getElementById('sn-split');
  const learn = document.getElementById('sn-learn-toggle');
  input.value = toolsSubnetState.input;
  split.value = toolsSubnetState.split;
  learn.checked = toolsSubnetState.learn;
  input.addEventListener('input', () => { toolsSubnetState.input = input.value; saveToolsSubnetState(); renderSubnet(); });
  split.addEventListener('input', () => { toolsSubnetState.split = split.value; saveToolsSubnetState(); renderSubnet(); });
  learn.addEventListener('change', () => { toolsSubnetState.learn = learn.checked; saveToolsSubnetState(); renderSubnet(); });
  renderSubnet();
}
