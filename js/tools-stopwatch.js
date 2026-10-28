// =========================
// TOOLS — 10) STOPPUHR & COUNTDOWN
// Für alles, was kein Pomodoro ist (Tee, Vortrag üben, Prüfungszeit).
// Wie der Focus Timer über Zeitstempel statt gezählter Ticks — läuft
// also auch im Hintergrund-Tab richtig und übersteht ein Neuladen.
// Ton am Countdown-Ende über toolsPlayChime() (tools.js).
// Benötigt tools.js (Karten-Raster, Ton-Helfer) zuvor geladen.
// =========================

let toolsStopwatch = Object.assign({
  mode: 'stopwatch',
  sw: { running: false, startedAt: null, elapsed: 0, laps: [] },
  cd: { running: false, endsAt: null, remaining: 300000, total: 300000, done: false },
}, DB.get('toolsStopwatch', {}));
function saveToolsStopwatch() { DB.set('toolsStopwatch', toolsStopwatch); }
let toolsStopwatchTick = null;

function toolsStopwatchCardHtml() {
  return `
    <div class="tool-card" id="tool-stopwatch">
      <div class="tool-card-header">
        <span class="tool-card-icon">⏱️</span>
        <span class="tool-card-title">Stoppuhr & Countdown</span>
      </div>
      <div class="tool-card-body">
        <div class="tool-mode-group" role="group" aria-label="Modus">
          <button class="tool-mode-btn" data-sw-mode="stopwatch">⏱️ Stoppuhr</button>
          <button class="tool-mode-btn" data-sw-mode="countdown">⏳ Countdown</button>
        </div>
        <div class="sw-display sn-mono" id="sw-display" aria-live="off">00:00,0</div>
        <div class="sw-cd-setup" id="sw-cd-setup">
          <div class="sw-cd-inputs">
            <label>Min<input type="number" class="modal-input" id="sw-cd-min" min="0" max="999"></label>
            <label>Sek<input type="number" class="modal-input" id="sw-cd-sec" min="0" max="59"></label>
          </div>
          <div class="sw-presets">${[1, 3, 5, 10, 15, 30].map(m => `<button type="button" class="sw-preset" data-sw-preset="${m}">${m} min</button>`).join('')}</div>
        </div>
        <div class="timer-controls">
          <button class="btn-primary timer-start-btn" id="sw-toggle">Start</button>
          <button class="btn-ghost hidden" id="sw-lap">Runde</button>
          <button class="icon-btn" id="sw-reset" title="Zurücksetzen">↻</button>
        </div>
        <ol class="sw-laps" id="sw-laps"></ol>
      </div>
    </div>`;
}

function swFmt(ms, tenths = true) {
  const neg = ms < 0; ms = Math.abs(ms);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, t = Math.floor(ms / 100) % 10;
  const core = `${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return (neg ? '−' : '') + core + (tenths ? `,${t}` : '');
}
function swElapsed() { const sw = toolsStopwatch.sw; return sw.elapsed + (sw.running ? Date.now() - sw.startedAt : 0); }
function cdRemaining() { const cd = toolsStopwatch.cd; return cd.running ? Math.max(0, cd.endsAt - Date.now()) : cd.remaining; }

function swEnsureTick() {
  const running = toolsStopwatch.sw.running || toolsStopwatch.cd.running;
  if (running && !toolsStopwatchTick) toolsStopwatchTick = setInterval(swTick, 100);
  if (!running && toolsStopwatchTick) { clearInterval(toolsStopwatchTick); toolsStopwatchTick = null; }
}

function swTick() {
  const cd = toolsStopwatch.cd;
  if (cd.running && cdRemaining() <= 0) {
    cd.running = false; cd.endsAt = null; cd.remaining = 0; cd.done = true;
    saveToolsStopwatch();
    toolsPlayChime();
    swEnsureTick();
  }
  renderStopwatch();
}

function renderStopwatch() {
  const disp = document.getElementById('sw-display');
  if (!disp) return;
  const isSw = toolsStopwatch.mode === 'stopwatch';
  const sw = toolsStopwatch.sw, cd = toolsStopwatch.cd;
  document.querySelectorAll('#tool-stopwatch [data-sw-mode]').forEach(b => b.classList.toggle('active', b.dataset.swMode === toolsStopwatch.mode));
  document.getElementById('sw-cd-setup').classList.toggle('hidden', isSw || cd.running || cd.remaining !== cd.total);
  document.getElementById('sw-lap').classList.toggle('hidden', !isSw || (!sw.running && !sw.elapsed));
  const running = isSw ? sw.running : cd.running;
  document.getElementById('sw-toggle').textContent = running ? 'Pause' : (isSw ? (sw.elapsed ? 'Weiter' : 'Start') : (cd.done ? 'Nochmal' : cd.remaining !== cd.total ? 'Weiter' : 'Start'));
  disp.textContent = isSw ? swFmt(swElapsed()) : swFmt(cdRemaining(), cdRemaining() < 60000);
  disp.classList.toggle('sw-display--done', !isSw && cd.done);
  const laps = document.getElementById('sw-laps');
  laps.innerHTML = isSw ? sw.laps.map((t, i) => `<li><span>Runde ${i + 1}</span><span class="sn-mono">${swFmt(t - (sw.laps[i - 1] || 0))}</span><span class="sn-mono sw-lap-total">${swFmt(t)}</span></li>`).reverse().join('') : '';
}

function swToggle() {
  toolsUnlockAudio();
  const now = Date.now();
  if (toolsStopwatch.mode === 'stopwatch') {
    const sw = toolsStopwatch.sw;
    if (sw.running) { sw.elapsed += now - sw.startedAt; sw.running = false; sw.startedAt = null; }
    else { sw.running = true; sw.startedAt = now; }
  } else {
    const cd = toolsStopwatch.cd;
    if (cd.running) { cd.remaining = Math.max(0, cd.endsAt - now); cd.running = false; cd.endsAt = null; }
    else {
      if (cd.done || cd.remaining <= 0) { cd.remaining = cd.total; cd.done = false; }
      if (cd.remaining <= 0) return;
      cd.running = true; cd.endsAt = now + cd.remaining;
    }
  }
  saveToolsStopwatch(); swEnsureTick(); renderStopwatch();
}

function swReset() {
  if (toolsStopwatch.mode === 'stopwatch') toolsStopwatch.sw = { running: false, startedAt: null, elapsed: 0, laps: [] };
  else Object.assign(toolsStopwatch.cd, { running: false, endsAt: null, remaining: toolsStopwatch.cd.total, done: false });
  saveToolsStopwatch(); swEnsureTick(); renderStopwatch();
}

function cdSetTotal(ms) {
  ms = Math.max(1000, Math.min(ms, 999 * 60000));
  Object.assign(toolsStopwatch.cd, { total: ms, remaining: ms, running: false, endsAt: null, done: false });
  document.getElementById('sw-cd-min').value = Math.floor(ms / 60000);
  document.getElementById('sw-cd-sec').value = Math.floor(ms / 1000) % 60;
  saveToolsStopwatch(); renderStopwatch();
}

function initStopwatch() {
  const cd = toolsStopwatch.cd;
  // Während des Neuladens abgelaufen? Still auf 0 stellen.
  if (cd.running && cd.endsAt <= Date.now()) Object.assign(cd, { running: false, endsAt: null, remaining: 0, done: true });
  document.getElementById('sw-cd-min').value = Math.floor(cd.total / 60000);
  document.getElementById('sw-cd-sec').value = Math.floor(cd.total / 1000) % 60;
  document.querySelectorAll('#tool-stopwatch [data-sw-mode]').forEach(b => b.addEventListener('click', () => {
    toolsStopwatch.mode = b.dataset.swMode; saveToolsStopwatch(); renderStopwatch();
  }));
  document.getElementById('sw-toggle').addEventListener('click', swToggle);
  document.getElementById('sw-reset').addEventListener('click', swReset);
  document.getElementById('sw-lap').addEventListener('click', () => {
    if (!toolsStopwatch.sw.running) return;
    toolsStopwatch.sw.laps.push(swElapsed());
    if (toolsStopwatch.sw.laps.length > 99) toolsStopwatch.sw.laps.shift();
    saveToolsStopwatch(); renderStopwatch();
  });
  ['sw-cd-min', 'sw-cd-sec'].forEach(id => document.getElementById(id).addEventListener('change', () => {
    const m = parseInt(document.getElementById('sw-cd-min').value, 10) || 0;
    const s = parseInt(document.getElementById('sw-cd-sec').value, 10) || 0;
    cdSetTotal((m * 60 + s) * 1000);
  }));
  document.querySelectorAll('#tool-stopwatch [data-sw-preset]').forEach(b => b.addEventListener('click', () => cdSetTotal(Number(b.dataset.swPreset) * 60000)));
  document.addEventListener('visibilitychange', () => { if (toolsStopwatchTick) swTick(); });
  swEnsureTick();
  renderStopwatch();
}
