// =========================
// TOOLS — KERN
// Enthält das HTML-Grundgerüst (initTools) sowie die geteilte
// Dateneinheiten-Registry (für Converter + Datenübertragungsraten-
// Rechner). Die eigentliche Modul-Logik liegt in:
// tools-calculator.js, tools-timer.js, tools-converter.js,
// tools-datarate.js, tools-notenmanager.js, tools-decision.js
// Lade-Reihenfolge: tools.js zuerst, Module danach (beliebige Reihenfolge
// untereinander, außer converter/datarate nach tools.js wegen Registry).
// =========================

// =========================
// TOOLS
// Kleiner Werkzeugkasten direkt in Nook — bewusst klein gehalten.
// Sechs unabhängige Werkzeuge (Taschenrechner, Focus Timer, Converter,
// Datenrate, Notenmanager, Entscheidungshilfe), jedes in eigener Datei
// (Design-Vertrag: AI documentation/tools.md). Gerendert einmalig in #view-tools,
// analog zum Games-Hub (initTools wird von main.js/renderView aufgerufen).
// =========================

let toolsInitialized = false;

// Werkzeug-Leiste oben (wie die Sprungleiste der Einstellungen): „Alle“
// zeigt das Raster, ein Werkzeug blendet die übrigen Karten aus. Die Wahl
// wird gemerkt. id = Karten-ID ohne "tool-"-Präfix. Reihenfolge und
// ausgeblendete Werkzeuge stellt der Nutzer über ⚙ ein (toolsNavConfig).
const TOOLS_LIST = [
  { id: 'calculator',   icon: '🧮', label: 'Rechner' },
  { id: 'timer',        icon: '🍅', label: 'Focus Timer' },
  { id: 'stopwatch',    icon: '⏱️', label: 'Stoppuhr' },
  { id: 'converter',    icon: '🔄', label: 'Converter' },
  { id: 'numbase',      icon: '🔢', label: 'Zahlensysteme' },
  { id: 'date',         icon: '📅', label: 'Datum' },
  { id: 'datarate',     icon: '📡', label: 'Datenrate' },
  { id: 'subnet',       icon: '🌐', label: 'Subnetz' },
  { id: 'notenmanager', icon: '🎓', label: 'Noten' },
  { id: 'decision',     icon: '⚖️', label: 'Entscheidungen' },
  { id: 'text',         icon: '📝', label: 'Text' },
];
let toolsActiveTool = DB.get('toolsActiveTool', 'all');
function saveToolsActiveTool() { DB.set('toolsActiveTool', toolsActiveTool); }
let toolsNavConfig = Object.assign({ order: [], hidden: [] }, DB.get('toolsNavConfig', {}));
function saveToolsNavConfig() { DB.set('toolsNavConfig', toolsNavConfig); }

// TOOLS_LIST in der Nutzer-Reihenfolge; neue Werkzeuge hängen hinten an
function toolsOrderedList() {
  const byId = Object.fromEntries(TOOLS_LIST.map(t => [t.id, t]));
  const ordered = toolsNavConfig.order.filter(id => byId[id]).map(id => byId[id]);
  return [...ordered, ...TOOLS_LIST.filter(t => !ordered.includes(t))];
}
function toolsIsHidden(id) { return toolsNavConfig.hidden.includes(id); }

function renderToolsNav() {
  const nav = document.getElementById('tools-nav');
  if (!nav) return;
  nav.innerHTML = `<button type="button" class="tools-nav-btn" data-tool="all" aria-pressed="false">Alle</button>`
    + toolsOrderedList().filter(t => !toolsIsHidden(t.id)).map(t =>
      `<button type="button" class="tools-nav-btn" data-tool="${t.id}" aria-pressed="false"><span aria-hidden="true">${t.icon}</span> ${t.label}</button>`).join('')
    + `<button type="button" class="tools-nav-btn tools-nav-btn--config" id="tools-nav-config" title="Leiste anpassen: Reihenfolge und sichtbare Werkzeuge" aria-label="Leiste anpassen">⚙</button>`;
  // Karten im Raster in derselben Reihenfolge
  toolsOrderedList().forEach((t, i) => {
    const card = document.getElementById(`tool-${t.id}`);
    if (card) card.style.order = i;
  });
}

function toolsShowTool(id) {
  if (id !== 'all' && (!TOOLS_LIST.some(t => t.id === id) || toolsIsHidden(id))) id = 'all';
  toolsActiveTool = id;
  saveToolsActiveTool();
  document.querySelectorAll('#tools-nav .tools-nav-btn').forEach(b => {
    const on = b.dataset.tool === id;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  // Am Handy ist die Leiste wischbar — gewählten Knopf in Sicht holen
  const nav = document.getElementById('tools-nav');
  const activeBtn = nav?.querySelector('.tools-nav-btn.active');
  if (nav && activeBtn && nav.scrollWidth > nav.clientWidth) {
    const delta = activeBtn.getBoundingClientRect().left - nav.getBoundingClientRect().left;
    nav.scrollLeft += delta - (nav.clientWidth - activeBtn.offsetWidth) / 2;
  }
  const grid = document.getElementById('tools-grid');
  if (!grid) return;
  grid.classList.toggle('tools-grid--single', id !== 'all');
  grid.querySelectorAll(':scope > .tool-card').forEach(card => {
    const cid = card.id.replace(/^tool-/, '');
    card.classList.toggle('hidden', id === 'all' ? toolsIsHidden(cid) : cid !== id);
  });
}

// ── Leiste anpassen (⚙): Reihenfolge per ▲▼, Sichtbarkeit per Haken ──
let toolsNavModal = null;
function renderToolsNavConfig() {
  const list = document.getElementById('tools-nav-config-list');
  const items = toolsOrderedList();
  list.innerHTML = items.map((t, i) => `
    <li class="tools-cfg-row" data-id="${t.id}">
      <label class="tools-cfg-check"><input type="checkbox" ${toolsIsHidden(t.id) ? '' : 'checked'}> <span aria-hidden="true">${t.icon}</span> ${t.label}</label>
      <button type="button" class="icon-btn" data-move="-1" ${i === 0 ? 'disabled' : ''} title="Nach oben" aria-label="${t.label} nach oben">▲</button>
      <button type="button" class="icon-btn" data-move="1" ${i === items.length - 1 ? 'disabled' : ''} title="Nach unten" aria-label="${t.label} nach unten">▼</button>
    </li>`).join('');
}
function toolsNavConfigChanged() {
  saveToolsNavConfig();
  renderToolsNavConfig();
  renderToolsNav();
  toolsShowTool(toolsActiveTool);
}

// ── Ton-Helfer (Focus Timer, Countdown) ──
// Browser erlauben Audio erst nach einer Nutzeraktion — Start-Klicks rufen
// toolsUnlockAudio() auf, das Phasenende spielt dann toolsPlayChime().
let toolsAudioCtx = null;
function toolsUnlockAudio() {
  try {
    if (!toolsAudioCtx) toolsAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (toolsAudioCtx.state === 'suspended') toolsAudioCtx.resume();
  } catch (e) { toolsAudioCtx = null; }
}
function toolsPlayChime() {
  if (!toolsAudioCtx) return;
  const t0 = toolsAudioCtx.currentTime;
  [0, 0.28, 0.56].forEach((offset, i) => {
    const osc = toolsAudioCtx.createOscillator();
    const gain = toolsAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 2 ? 1046.5 : 784;
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.25);
    osc.connect(gain).connect(toolsAudioCtx.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.26);
  });
}

// Druck-Helfer (Zeugnis drucken): Inhalt in einen eigenen Container, nur
// der wird gedruckt (css/tools.css: body.tools-printing).
function toolsPrint(html) {
  let box = document.getElementById('tools-print');
  if (!box) { box = document.createElement('div'); box.id = 'tools-print'; document.body.appendChild(box); }
  box.innerHTML = html;
  document.body.classList.add('tools-printing');
  const done = () => { document.body.classList.remove('tools-printing'); box.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(() => { if (document.body.classList.contains('tools-printing') && !window.matchMedia('print').matches) done(); }, 1000);
}

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
      <nav class="tools-nav" id="tools-nav" aria-label="Werkzeuge"></nav>
      <div class="tools-grid" id="tools-grid">

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

            <div class="calc-expr">
              <label class="conv-label" for="calc-expr-input">Ausdruck (Klammern, ^, √, log2, 0x…, 0b…)</label>
              <input type="text" class="modal-input calc-expr-input" id="calc-expr-input" placeholder="z.B. (2^10 − 1) × 3 oder log2(4096)" autocomplete="off" spellcheck="false">
              <div class="calc-expr-result" id="calc-expr-result" aria-live="polite"></div>
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
              <input type="text" class="modal-input timer-note hidden" id="timer-note" placeholder="Woran hast du gearbeitet? (optional)" autocomplete="off" aria-label="Notiz zur Fokusphase">
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
              <label class="timer-set-check"><input type="checkbox" id="timer-set-sound"> Ton bei Phasenende</label>
              <label class="timer-set-check"><input type="checkbox" id="timer-set-notify"> Benachrichtigung, wenn Nook im Hintergrund ist</label>
            </div>

            <div class="timer-history hidden" id="timer-history">
              <div class="timer-history-summary" id="timer-history-summary"></div>
              <div class="timer-week" id="timer-week"></div>
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
            <button class="btn-ghost" id="dr-practice-btn" title="Übungsaufgaben: selbst rechnen, dann Musterlösung ansehen">🎯 <span class="dr-formula-global-btn-label">Üben</span></button>
            <button class="btn-ghost" id="dr-formula-global-btn" title="Formelsammlung öffnen">📚 <span class="dr-formula-global-btn-label">Formelsammlung</span></button>
          </div>
          <div class="tool-card-body">
            <div class="dr-practice hidden" id="dr-practice">
              <div class="dr-practice-head">
                <span class="dr-practice-title">🎯 Übungsaufgabe</span>
                <span class="dr-practice-score" id="dr-practice-score"></span>
              </div>
              <div class="dr-practice-task" id="dr-practice-task"></div>
              <div class="dr-practice-answer">
                <input type="text" inputmode="decimal" class="modal-input" id="dr-practice-input" placeholder="Deine Lösung" autocomplete="off">
                <span class="dr-practice-unit" id="dr-practice-unit"></span>
                <button class="btn-primary" id="dr-practice-check">Prüfen</button>
              </div>
              <div class="dr-practice-feedback" id="dr-practice-feedback" aria-live="polite"></div>
              <div class="dr-practice-actions">
                <button class="btn-ghost" id="dr-practice-solution-btn">Musterlösung</button>
                <button class="btn-ghost" id="dr-practice-next">Neue Aufgabe →</button>
              </div>
              <div class="dr-learn-solution dr-practice-solution hidden" id="dr-practice-solution"></div>
            </div>
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

                <div class="dr-formula-inline hidden" id="dr-formula-inline">
                  <button class="btn-ghost dr-formula-inline-btn" id="dr-formula-inline-btn">📚 Formelsammlung</button>
                  <div class="dr-formula-inline-panel hidden" id="dr-formula-inline-panel"></div>
                </div>
              </div>

              <div class="dr-learn-col" id="dr-learn-col">
                <div class="dr-learn-solution" id="dr-learn-solution"></div>
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
            <button class="btn-ghost noten-header-btn" id="noten-ihk-btn" title="IHK-Punkte in Noten umrechnen">IHK-Punkte</button>
            <button class="icon-btn" id="noten-settings-btn" title="Einstellungen">⚙</button>
            <button class="btn-ghost" id="noten-add-year-btn">+ Ausbildungsjahr</button>
          </div>
          <div class="tool-card-body">
            <div class="noten-ihk hidden" id="noten-ihk">
              <div class="noten-ihk-row">
                <label>Punkte (0–100)<input type="text" inputmode="decimal" class="modal-input" id="noten-ihk-input" autocomplete="off"></label>
                <span class="noten-ihk-result" id="noten-ihk-result" aria-live="polite"></span>
              </div>
              <table class="dr-formula-table noten-ihk-table"><thead><tr><th>Punkte</th><th>Note</th><th></th></tr></thead><tbody id="noten-ihk-table"></tbody></table>
              <p class="modal-hint">Tipp: Bei einer Leistung kannst du direkt „87P“ eintragen — die Note wird nach diesem Schlüssel gesetzt.</p>
            </div>
            <div class="noten-years-list" id="noten-years-list"></div>
            <div class="noten-empty hidden" id="noten-empty">Noch keine Ausbildungsjahre angelegt. Lege dein erstes mit „+ Ausbildungsjahr" an.</div>
          </div>
        </div>

        <div class="tool-card" id="tool-decision">
          <div class="tool-card-header">
            <span class="tool-card-icon">⚖️</span>
            <span class="tool-card-title">Entscheidungshilfe</span>
            <button class="btn-ghost" id="decision-add-btn">+ Entscheidung</button>
          </div>
          <div class="tool-card-body">
            <div class="decision-list" id="decision-list"></div>
            <div class="noten-empty hidden" id="decision-empty">Hängst du an einer Entscheidung? Leg mit „+ Entscheidung“ ein Blatt an und geh sie Schritt für Schritt durch.</div>
            <button type="button" class="tool-settings-toggle hidden" id="decision-archive-toggle"></button>
          </div>
        </div>

        ${toolsStopwatchCardHtml()}
        ${toolsNumbaseCardHtml()}
        ${toolsDateCardHtml()}
        ${toolsSubnetCardHtml()}
        ${toolsTextCardHtml()}
      </div>

      <!-- Leiste anpassen -->
      <div id="tools-nav-config-overlay" class="modal-backdrop hidden">
        <div class="modal-box" style="width:380px;max-height:82vh;">
          <div class="modal-head"><span>Werkzeug-Leiste anpassen</span><button class="modal-x" id="tools-nav-config-close">&#10005;</button></div>
          <p class="modal-hint">Haken = in Leiste und Raster sichtbar. Mit ▲▼ die Reihenfolge ändern.</p>
          <ol class="tools-cfg-list" id="tools-nav-config-list"></ol>
          <div class="modal-actions"><button id="tools-nav-config-reset" class="btn-ghost">Standard</button><button id="tools-nav-config-done" class="btn-primary">Fertig</button></div>
        </div>
      </div>

      <!-- Formelsammlung (global, modul-übergreifend) -->
      <div id="dr-formula-modal-overlay" class="modal-backdrop hidden">
        <div class="modal-box dr-formula-modal-box" style="width:720px;max-height:82vh;">
          <div class="modal-head"><span>📚 Formelsammlung</span><button class="modal-x" id="dr-formula-modal-close">&#10005;</button></div>
          <div class="dr-formula-modal-body">
            <div class="dr-formula-nav" id="dr-formula-nav"></div>
            <div class="dr-formula-content" id="dr-formula-content"></div>
          </div>
        </div>
      </div>

      <!-- Entscheidungshilfe: Entscheidungsblatt (js/tools-decision.js) -->
      <div id="decision-modal-overlay" class="modal-backdrop hidden">
        <div class="modal-box decision-sheet" style="width:720px;max-height:88vh;">
          <div class="modal-head"><span>⚖️ Eine Entscheidung treffen</span><button class="modal-x" id="decision-modal-close">&#10005;</button></div>

          <div class="decision-top">
            <label class="decision-line decision-line--wide"><span>Dilemma</span><input type="text" class="modal-input" id="decision-dilemma" placeholder="Worum geht es?" autocomplete="off"></label>
            <div class="decision-line"><span>Angelegt</span><span class="decision-created" id="decision-created"></span></div>
            <label class="decision-line"><span>Entscheiden bis</span><input type="date" class="modal-date" id="decision-due"></label>
          </div>
          <div class="decision-scale-row"><span class="decision-scale-label">Wie wichtig?</span><div class="decision-scale" id="decision-importance" role="radiogroup" aria-label="Wichtigkeit"></div></div>
          <div class="decision-scale-row"><span class="decision-scale-label">Wie unentschlossen?</span><div class="decision-scale" id="decision-indecision" role="radiogroup" aria-label="Unentschlossenheit"></div></div>

          <div class="decision-box">
            <div class="decision-box-head">Bester Fall</div>
            <textarea class="modal-textarea decision-ta" data-decision-field="best" placeholder="Was passiert im besten Fall?"></textarea>
            <label class="decision-check"><input type="checkbox" id="decision-best-pipe"> Luftschloss</label>
          </div>
          <div class="decision-box">
            <div class="decision-box-head">Schlimmster Fall</div>
            <textarea class="modal-textarea decision-ta" data-decision-field="worst" placeholder="Was passiert im schlimmsten Fall?"></textarea>
            <label class="decision-check"><input type="checkbox" id="decision-worst-apoc"> Weltuntergang</label>
          </div>

          <div class="decision-split">
            <div class="decision-box">
              <div class="decision-box-head">Bauchgefühl</div>
              <textarea class="modal-textarea decision-ta decision-ta--tall" data-decision-field="gut" placeholder="Was sagt dein Bauch?"></textarea>
              <label class="decision-sub">Intuitives Fazit<input type="text" class="modal-input" data-decision-field="gutConclusion" autocomplete="off"></label>
            </div>
            <div class="decision-box">
              <div class="decision-box-head">Plus (+) und Minus (−) <span class="decision-pros-tally" id="decision-pros-tally"></span></div>
              <div class="decision-pros" id="decision-pros"></div>
              <div class="decision-pros-add">
                <button type="button" class="btn-ghost" data-decision-add-pro="+">+ Plus</button>
                <button type="button" class="btn-ghost" data-decision-add-pro="-">− Minus</button>
              </div>
              <label class="decision-sub">Rationales Fazit<input type="text" class="modal-input" data-decision-field="rationalConclusion" autocomplete="off"></label>
            </div>
          </div>

          <div class="decision-box">
            <div class="decision-box-head">Optionen vergleichen <span class="decision-pros-tally">Kriterien gewichten (1–5), Optionen bewerten (1–5)</span></div>
            <div class="decision-matrix" id="decision-matrix"></div>
            <div class="decision-pros-add">
              <button type="button" class="btn-ghost" id="decision-matrix-add-option">+ Option</button>
              <button type="button" class="btn-ghost" id="decision-matrix-add-criterion">+ Kriterium</button>
            </div>
          </div>

          <div class="decision-box decision-box--final">
            <label class="decision-sub decision-sub--big">Entscheidung<input type="text" class="modal-input" data-decision-field="decision" placeholder="Wofür entscheidest du dich?" autocomplete="off"></label>
            <label class="decision-check"><input type="checkbox" id="decision-for-now"> Vorerst</label>
            <label class="decision-sub">Nächste Schritte<textarea class="modal-textarea decision-ta" data-decision-field="nextSteps" placeholder="Ein Schritt pro Zeile"></textarea></label>
            <div class="decision-steps-row">
              <span class="decision-steps-hint" id="decision-steps-hint" aria-live="polite"></span>
              <button type="button" class="btn-ghost" id="decision-steps-to-tasks" title="Jede Zeile als Wochenaufgabe in „Heute“ anlegen">✅ Als Wochenaufgaben</button>
            </div>
          </div>

          <div class="decision-box decision-box--final hidden" id="decision-review-box">
            <div class="decision-review-row">
              <label class="decision-sub">Rückblick
                <select class="modal-select" id="decision-review-in">
                  <option value="">kein Rückblick</option>
                  <option value="14">in 2 Wochen</option>
                  <option value="30">in 1 Monat</option>
                  <option value="90">in 3 Monaten</option>
                  <option value="0">jetzt</option>
                </select>
              </label>
              <span class="decision-steps-hint" id="decision-review-when"></span>
            </div>
            <div class="decision-review-rate hidden" id="decision-review-rate">
              <span class="decision-sub decision-sub--big">War die Entscheidung gut?</span>
              <div class="decision-scale" id="decision-review-rating" role="radiogroup" aria-label="Bewertung"></div>
              <textarea class="modal-textarea decision-ta" data-decision-field="reviewNote" placeholder="Was hast du daraus gelernt?"></textarea>
            </div>
            <label class="decision-check"><input type="checkbox" id="decision-archived"> Archivieren</label>
          </div>

          <div class="decision-coin">
            <span class="decision-coin-quote">„Oder du wirfst einfach eine Münze.“</span>
            <button type="button" class="btn-ghost" id="decision-coin-btn">🪙 Münze werfen</button>
            <button type="button" class="btn-ghost" id="decision-wheel-btn" title="Zufällig eine der Optionen aus „Optionen vergleichen“ wählen">🎡 Zufallsrad</button>
            <span class="decision-coin-result" id="decision-coin-result" aria-live="polite"></span>
          </div>

          <div class="modal-actions"><button id="decision-delete-btn" class="btn-ghost decision-delete-btn">🗑 Löschen</button><button id="decision-done-btn" class="btn-primary">Fertig</button></div>
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
          <div class="modal-row"><label>Note (leer = ausstehend)</label><input type="text" inputmode="decimal" class="modal-input" id="noten-entry-grade" placeholder="z.B. 2,3 · 2- · 1-2 · 87P"/></div>
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
          <div class="noten-trend" id="noten-trend"></div>
          <div class="noten-target">
            <span class="noten-target-title">🎯 Was brauche ich?</span>
            <label>Ziel-Ø<input type="text" inputmode="decimal" class="modal-input" id="noten-target-avg" placeholder="z.B. 2,0" autocomplete="off"/></label>
            <label>Gewichtung der nächsten Leistung<input type="text" inputmode="decimal" class="modal-input" id="noten-target-weight" autocomplete="off"/></label>
            <div class="noten-target-result" id="noten-target-result" aria-live="polite"></div>
          </div>
          <div class="modal-actions" style="justify-content:flex-start;">
            <button class="btn-primary" id="noten-detail-add-entry-btn">+ Leistung hinzufügen</button>
          </div>
        </div>
      </div>
    </div>
  `;

  initCalculator();
  initFocusTimer();
  initConverter();
  initDataRateCalculator();
  initNotenmanager();
  initDecisionTool();
  initStopwatch();
  initNumbaseConverter();
  initDateCalculator();
  initSubnetCalculator();
  initTextTool();
  document.addEventListener('keydown', toolsHandleEscape, true);

  toolsNavModal = wireModal('tools-nav-config-overlay', { closeIds: ['tools-nav-config-close', 'tools-nav-config-done'] });
  document.getElementById('tools-nav').addEventListener('click', e => {
    if (e.target.closest('#tools-nav-config')) { renderToolsNavConfig(); toolsNavModal.open(); return; }
    const btn = e.target.closest('.tools-nav-btn');
    if (btn) toolsShowTool(btn.dataset.tool);
  });
  const cfgList = document.getElementById('tools-nav-config-list');
  cfgList.addEventListener('change', e => {
    const id = e.target.closest('.tools-cfg-row')?.dataset.id;
    if (!id) return;
    toolsNavConfig.hidden = e.target.checked ? toolsNavConfig.hidden.filter(x => x !== id) : [...new Set([...toolsNavConfig.hidden, id])];
    toolsNavConfigChanged();
  });
  cfgList.addEventListener('click', e => {
    const btn = e.target.closest('[data-move]');
    if (!btn) return;
    const ids = toolsOrderedList().map(t => t.id);
    const i = ids.indexOf(btn.closest('.tools-cfg-row').dataset.id), j = i + Number(btn.dataset.move);
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    toolsNavConfig.order = ids;
    toolsNavConfigChanged();
    cfgList.querySelector(`[data-id="${ids[j]}"] [data-move="${btn.dataset.move}"]`)?.focus();
  });
  document.getElementById('tools-nav-config-reset').addEventListener('click', () => {
    toolsNavConfig = { order: [], hidden: [] };
    toolsNavConfigChanged();
  });
  renderToolsNav();
  toolsShowTool(toolsActiveTool);   // Capture: vor dem Taschenrechner, solange hubConfirm noch sichtbar ist
}

// Escape schließt das oberste offene Tools-Fenster — über dessen ✕, damit
// dieselbe Schließ-Logik (onClose, Rückkehr ins vorige Fenster) greift.
// Ein offener hubConfirm-Dialog behandelt Escape selbst.
function toolsHandleEscape(e) {
  if (e.key !== 'Escape') return;
  const open = [...document.querySelectorAll('#view-tools .modal-backdrop:not(.hidden)')];
  if (!open.length || document.querySelector('.modal-backdrop:not(.hidden):not(#view-tools *)')) return;
  const top = open.reduce((a, b) => (Number(getComputedStyle(b).zIndex) || 0) >= (Number(getComputedStyle(a).zIndex) || 0) ? b : a);
  const x = top.querySelector('.modal-x');
  if (!x) return;
  e.preventDefault();
  x.click();
}
window.initTools = initTools;


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
