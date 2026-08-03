// =========================
// TOOLS — KERN
// Enthält das HTML-Grundgerüst (initTools) sowie die geteilte
// Dateneinheiten-Registry (für Converter + Datenübertragungsraten-
// Rechner). Die eigentliche Modul-Logik liegt in:
// tools-calculator.js, tools-timer.js, tools-converter.js,
// tools-datarate.js, tools-notenmanager.js
// Lade-Reihenfolge: tools.js zuerst, Module danach (beliebige Reihenfolge
// untereinander, außer converter/datarate nach tools.js wegen Registry).
// =========================

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
            <button class="btn-ghost" id="dr-formula-global-btn" title="Formelsammlung öffnen">📚 <span class="dr-formula-global-btn-label">Formelsammlung</span></button>
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
            <button class="icon-btn noten-header-btn" id="noten-settings-btn" title="Einstellungen">⚙</button>
            <button class="btn-ghost" id="noten-add-year-btn">+ Ausbildungsjahr</button>
          </div>
          <div class="tool-card-body">
            <div class="noten-years-list" id="noten-years-list"></div>
            <div class="noten-empty hidden" id="noten-empty">Noch keine Ausbildungsjahre angelegt. Lege dein erstes mit „+ Ausbildungsjahr" an.</div>
          </div>
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
