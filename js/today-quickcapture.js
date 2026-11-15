// =========================
// TODAY — Schnellnotiz per Tastenkürzel (nur Desktop-App)
// Strg/Cmd + Alt + N holt Nook nach vorn (auch aus dem Hintergrund) und
// setzt den Cursor in eine neue Zeile der Schnellnotiz. Der Hauptprozess
// (desktop/lib/quick-capture.js) meldet das Kürzel nur an, wenn die Web-App
// es hier einschaltet; die Wahl liegt im Key desktopQuickCapture (Standard: an).
// Im Browser gibt es window.nookDesktop nicht — dort passiert nichts und die
// Einstellung bleibt versteckt.
// Lädt nach today.js (Schnellnotiz #quicknote).
// =========================

(function initQuickCapture() {
  const bridge = window.nookDesktop && window.nookDesktop.quickCapture;
  if (!bridge) return;
  let on = DB.get('desktopQuickCapture', true);
  let status = null; // Antwort des Hauptprozesses { enabled, accelerator, error? }

  const keyLabel = () => (/Mac/i.test(navigator.platform) ? '⌘ + ⌥ + N' : 'Strg + Alt + N');

  function apply() {
    bridge.setEnabled(on).then(res => { status = res; renderRow(); }).catch(() => { status = { enabled: false, error: 'failed' }; renderRow(); });
  }

  function renderRow() {
    const row = document.getElementById('setting-quickcapture-row');
    if (!row) return;
    row.classList.remove('hidden');
    const t = document.getElementById('setting-quickcapture');
    if (t) t.checked = !!on;
    const sub = document.getElementById('setting-quickcapture-sub');
    if (!sub) return;
    if (on && status && status.error === 'taken') sub.textContent = `${keyLabel()} ist schon von einem anderen Programm belegt – dort freigeben, dann hier aus- und wieder einschalten.`;
    else if (on && status && status.error) sub.textContent = 'Das Kürzel ließ sich gerade nicht einrichten.';
    else sub.textContent = `${keyLabel()} holt Nook nach vorn und öffnet die Schnellnotiz – auch wenn Nook im Hintergrund liegt.`;
  }

  bridge.onOpen(() => {
    if (typeof showView === 'function') showView('today');
    const qnEl = document.getElementById('quicknote');
    if (!qnEl) return;
    // Neue Zeile ans Ende, ohne Bestehendes anzufassen
    if (qnEl.value && !qnEl.value.endsWith('\n')) {
      qnEl.value += '\n';
      qnEl.dispatchEvent(new Event('input'));
    }
    qnEl.focus();
    qnEl.setSelectionRange(qnEl.value.length, qnEl.value.length);
    qnEl.scrollIntoView({ block: 'center' });
  });

  document.getElementById('setting-quickcapture')?.addEventListener('change', e => {
    on = e.target.checked;
    DB.set('desktopQuickCapture', on);
    apply();
  });
  window.renderQuickCaptureSettings = renderRow;

  apply();
})();
