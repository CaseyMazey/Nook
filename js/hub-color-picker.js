// =========================
// NOOK-FARBWÄHLER
// Ersetzt den Farbdialog des Browsers für JEDES <input type="color"> in
// Nook (Theme-Editor, Kalender, Pinnwand, Anleitungen, …). Der Browser-
// Dialog sieht je nach Browser völlig anders aus (Firefox unter Windows:
// das alte Windows-Fenster) — dieser hier ist überall gleich und passt
// zum aktiven Theme.
//
// Funktionsweise: Klicks auf ein Farbfeld werden abgefangen (Capture-Phase,
// gilt also auch für später per JS erzeugte Felder), der Browser-Dialog
// bleibt zu. Der Wähler schreibt in input.value und löst dieselben
// Ereignisse aus wie der Browser ('input' live beim Ziehen, 'change' beim
// Übernehmen) — bestehender Code muss nichts davon wissen.
// Abmeldung für ein einzelnes Feld: data-native-picker.
//
// Lädt nach hub-utils.js (HUB_PALETTE_HEX, hubUserColors, saveHubUserColors).
// Farbfläche und Farbton-Leiste malen das Farbmodell selbst (Weiß/Schwarz-
// Verläufe, Regenbogen) — das sind Farbdaten, keine Theme-Farben der
// Oberfläche; alles Übrige nutzt Theme-Variablen (css/hub-color-picker.css).
// =========================

(function () {
  const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

  function normHex(v) {
    const m = HEX_RE.exec((v || '').trim());
    if (!m) return null;
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return '#' + h;
  }
  function hexToRgb(hex) {
    const h = normHex(hex) || '#000000';
    return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h, s: max ? d / max : 0, v: max };
  }
  function hsvToRgb(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  let el = null;          // Popover
  let input = null;       // aktuelles Farbfeld
  let original = null;    // Wert beim Öffnen (für Abbrechen)
  let hsv = { h: 0, s: 0, v: 0 };
  let swallowClick = false;

  function build() {
    el = document.createElement('div');
    el.id = 'hub-cp';
    el.className = 'hub-cp hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Farbe wählen');
    el.innerHTML = `
      <div class="hub-cp-sv" tabindex="0" aria-label="Sättigung und Helligkeit">
        <div class="hub-cp-sv-knob"></div>
      </div>
      <div class="hub-cp-hue" tabindex="0" aria-label="Farbton">
        <div class="hub-cp-hue-knob"></div>
      </div>
      <div class="hub-cp-row">
        <div class="hub-cp-preview" title="Vorher · Nachher">
          <span class="hub-cp-old"></span><span class="hub-cp-new"></span>
        </div>
        <input class="hub-cp-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Farbcode (HEX)" />
        <button type="button" class="hub-cp-eyedrop hidden" title="Farbe vom Bildschirm aufnehmen" aria-label="Pipette">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>
        </button>
      </div>
      <div class="hub-cp-swatch-head">
        <span class="hub-cp-swatch-label">Meine Farben</span>
        <button type="button" class="hub-cp-save-color" title="Diese Farbe bei „Meine Farben“ speichern">+ Merken</button>
      </div>
      <div class="hub-cp-swatches hub-cp-mine"></div>
      <div class="hub-cp-swatch-label">Palette</div>
      <div class="hub-cp-swatches hub-cp-palette"></div>
      <div class="hub-cp-actions">
        <button type="button" class="hub-cp-cancel btn-ghost">Abbrechen</button>
        <button type="button" class="hub-cp-ok btn-primary">Übernehmen</button>
      </div>`;
    document.body.appendChild(el);

    const sv = el.querySelector('.hub-cp-sv');
    const hue = el.querySelector('.hub-cp-hue');
    // Farbmodell: Regenbogen für den Farbton, Weiß→transparent und
    // transparent→Schwarz über der Farbtonfläche (siehe Dateikopf).
    hue.style.background = 'linear-gradient(to right,' +
      [0, 60, 120, 180, 240, 300, 360].map(h => `hsl(${h} 100% 50%)`).join(',') + ')';

    const drag = (area, onMove) => {
      area.addEventListener('pointerdown', e => {
        e.preventDefault();
        area.setPointerCapture(e.pointerId);
        area.focus({ preventScroll: true });
        const move = ev => {
          const r = area.getBoundingClientRect();
          onMove(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)),
                 Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
        };
        move(e);
        const up = () => { area.removeEventListener('pointermove', move); area.removeEventListener('pointerup', up); area.removeEventListener('pointercancel', up); };
        area.addEventListener('pointermove', move);
        area.addEventListener('pointerup', up);
        area.addEventListener('pointercancel', up);
      });
    };
    drag(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; update(true); });
    drag(hue, x => { hsv.h = Math.min(359.9, x * 360); update(true); });

    // Pfeiltasten für Tastaturbedienung
    sv.addEventListener('keydown', e => {
      const step = e.shiftKey ? 0.1 : 0.02;
      const map = { ArrowLeft: ['s', -step], ArrowRight: ['s', step], ArrowUp: ['v', step], ArrowDown: ['v', -step] };
      if (!map[e.key]) return;
      e.preventDefault();
      const [k, d] = map[e.key];
      hsv[k] = Math.max(0, Math.min(1, hsv[k] + d));
      update(true);
    });
    hue.addEventListener('keydown', e => {
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1 }[e.key];
      if (!d) return;
      e.preventDefault();
      hsv.h = (hsv.h + d * (e.shiftKey ? 15 : 3) + 360) % 360;
      update(true);
    });

    const hexInput = el.querySelector('.hub-cp-hex');
    hexInput.addEventListener('input', () => {
      const hex = normHex(hexInput.value);
      if (!hex) return;
      setFromHex(hex, false);
      emit('input');
    });
    hexInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    hexInput.addEventListener('blur', () => { hexInput.value = currentHex(); });

    if ('EyeDropper' in window) {
      const eye = el.querySelector('.hub-cp-eyedrop');
      eye.classList.remove('hidden');
      eye.addEventListener('click', async () => {
        try {
          const res = await new window.EyeDropper().open();
          const hex = normHex(res.sRGBHex);
          if (hex) { setFromHex(hex); emit('input'); }
        } catch { /* abgebrochen */ }
      });
    }

    el.querySelector('.hub-cp-ok').addEventListener('click', commit);
    el.querySelector('.hub-cp-cancel').addEventListener('click', cancel);
    el.querySelector('.hub-cp-old').addEventListener('click', () => { setFromHex(original); emit('input'); });
    el.querySelector('.hub-cp-save-color').addEventListener('click', () => {
      if (typeof hubUserColors === 'undefined') return;
      const hex = currentHex();
      if (hubUserColors.some(c => c.hex === hex)) return;
      const baseTheme = typeof isDarkThemeActive === 'function' && isDarkThemeActive() ? 'dark' : 'light';
      hubUserColors.push({ hex, baseTheme });
      if (typeof saveHubUserColors === 'function') saveHubUserColors();
      renderSwatches();
    });
  }

  function currentHex() { return rgbToHex(...hsvToRgb(hsv.h, hsv.s, hsv.v)); }

  function setFromHex(hex, syncField = true) {
    const keepHue = hsv.h;
    hsv = rgbToHsv(...hexToRgb(hex));
    // Bei Grautönen ist der Farbton unbestimmt — den bisherigen behalten,
    // damit die Fläche nicht auf Rot springt.
    if (hsv.s === 0) hsv.h = keepHue;
    paint(syncField);
  }

  function paint(syncField = true) {
    const sv = el.querySelector('.hub-cp-sv');
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h} 100% 50%)`;
    const knob = el.querySelector('.hub-cp-sv-knob');
    knob.style.left = (hsv.s * 100) + '%';
    knob.style.top = ((1 - hsv.v) * 100) + '%';
    const hex = currentHex();
    knob.style.background = hex;
    el.querySelector('.hub-cp-hue-knob').style.left = (hsv.h / 360 * 100) + '%';
    el.querySelector('.hub-cp-new').style.background = hex;
    if (syncField) el.querySelector('.hub-cp-hex').value = hex;
    el.querySelectorAll('.hub-cp-swatch').forEach(b => b.classList.toggle('active', b.dataset.hex === hex));
  }

  function update(live) {
    paint();
    if (live) emit('input');
  }

  function emit(type) {
    if (!input) return;
    const hex = currentHex();
    if (type === 'input' && input.value === hex) return;
    input.value = hex;
    input.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function renderSwatches() {
    const make = (container, hexes) => {
      container.innerHTML = '';
      hexes.forEach(hex => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hub-cp-swatch';
        b.dataset.hex = hex;
        b.title = hex;
        b.style.background = hex;
        b.addEventListener('click', () => { setFromHex(hex); emit('input'); });
        container.appendChild(b);
      });
    };
    const mine = typeof hubUserColors !== 'undefined' ? [...new Set(hubUserColors.map(c => normHex(c.hex)).filter(Boolean))] : [];
    make(el.querySelector('.hub-cp-mine'), mine);
    el.querySelector('.hub-cp-mine').classList.toggle('hidden', !mine.length);
    const palette = typeof HUB_PALETTE_HEX !== 'undefined' ? HUB_PALETTE_HEX.map(normHex).filter(Boolean) : [];
    make(el.querySelector('.hub-cp-palette'), palette);
  }

  function position(anchor) {
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    el.style.visibility = 'hidden';
    el.classList.remove('hidden');
    const w = el.offsetWidth, h = el.offsetHeight;
    const narrow = vw < 520;
    el.classList.toggle('hub-cp-sheet', narrow);
    if (narrow) { el.style.left = ''; el.style.top = ''; el.style.visibility = ''; return; }
    let left = r.left;
    let top = r.bottom + 8;
    if (top + h > vh - 8) top = Math.max(8, r.top - h - 8);
    left = Math.max(8, Math.min(left, vw - w - 8));
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.visibility = '';
  }

  function open(target) {
    if (!el) build();
    if (input && input !== target) commit();
    input = target;
    original = normHex(target.value) || '#000000';
    hsv = { h: 0, s: 0, v: 0 };
    setFromHex(original);
    el.querySelector('.hub-cp-old').style.background = original;
    renderSwatches();
    paint();
    position(target);
    el.querySelector('.hub-cp-sv').focus({ preventScroll: true });
  }

  function close() {
    if (!el) return;
    el.classList.add('hidden');
    const was = input;
    input = null;
    if (was && document.contains(was)) was.focus({ preventScroll: true });
  }
  function commit() {
    if (!input) return;
    emit('input');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  }
  function cancel() {
    if (!input) return;
    if (input.value !== original) {
      input.value = original;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close();
  }
  const isOpen = () => !!(el && input && !el.classList.contains('hidden'));
  const isColorInput = t => t instanceof HTMLInputElement && t.type === 'color' && !t.disabled && !t.hasAttribute('data-native-picker');

  // Browser-Dialog abfangen — Capture-Phase, damit es auch für Felder in
  // Labels und für später erzeugte Felder gilt.
  document.addEventListener('click', e => {
    if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); return; }
    if (!isColorInput(e.target)) return;
    e.preventDefault();
    open(e.target);
  }, true);
  document.addEventListener('keydown', e => {
    if (isOpen() && e.key === 'Escape') {
      // Vor dem Escape-Handler des umgebenden Modals (sonst schließt der mit)
      e.preventDefault(); e.stopImmediatePropagation();
      cancel();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && isColorInput(e.target)) {
      e.preventDefault();
      open(e.target);
    }
  }, true);
  // Klick daneben übernimmt die Farbe. Der anschließende click wird
  // verschluckt, damit er z. B. nicht zugleich das Modal dahinter schließt.
  document.addEventListener('pointerdown', e => {
    if (!isOpen() || el.contains(e.target)) return;
    if (isColorInput(e.target)) return; // anderes Farbfeld: open() übernimmt
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 400);
    commit();
  }, true);
  window.addEventListener('resize', () => { if (isOpen()) position(input); });
  document.addEventListener('scroll', e => {
    if (isOpen() && !el.contains(e.target)) position(input);
  }, true);

  window.hubColorPicker = { open, close: cancel };
})();
