// theme-lab-panel.js — Panel rechts im Musterfenster ("Theme live bearbeiten")
// Die sieben Abschnitte pro Element (Bild, Farben, Schrift, Form, Befestigung,
// Extras, Zurücksetzen) plus Bildverarbeitung (verkleinern, PNG/WebP/JPEG).
// Lädt direkt VOR js/theme-lab.js und stellt nur window.NookThemeLabPanel.create(api)
// bereit; tut von sich aus nichts (und außerhalb des Labs gar nichts).
// Braucht: SKIN_TEMPLATES/SKIN_FASTENERS/SEAL_FILTERS/resolveSkinSrc (theme-skins.js),
// FONT_CATEGORIES/CUSTOM_FONT_FILES (theme-engine.js).
//
// Arbeitsweise: das Panel hält einen Entwurf (draft) des offenen Elements. Jede
// Änderung → draftToEntry() → api.commit(id, entry, key) (prüft, merkt Rückgängig,
// malt neu). Der Entwurf darf Halbfertiges halten (z.B. Modus „Rahmen“ ohne Bild),
// gespeichert wird nur, was die Prüfung besteht.
(function () {
  'use strict';
  if (!window.NOOK_THEME_LAB) return;

  // Grenzen aus der Spec bzw. theme-skins.js (MAX_IMAGE / MAX_SMALL)
  const FRAME_EDGE = 1200, SMALL_EDGE = 256;
  const FRAME_BYTES = 4 * 1024 * 1024, SMALL_BYTES = 1024 * 1024;
  const PREVIEW_W = 316, PREVIEW_H = 170;

  const COLOR_FIELDS = [['surface', 'Fläche'], ['text', 'Text'], ['heading', 'Überschrift'], ['accent', 'Akzent'], ['border', 'Rahmenlinie']];
  const IMAGE_MODES = [['', 'Keins'], ['fill', 'Fläche'], ['tile', 'Kacheln'], ['frame', 'Rahmen']];
  const SHADOWS = [['', 'vom Theme'], ['none', 'Keiner'], ['soft', 'Weich'], ['strong', 'Stark']];
  const FASTENER_LABELS = { pin: 'Pin', tack: 'Reißzwecke', copper: 'Kupfernägel', nail: 'Schmiedenagel', seal: 'Wachssiegel' };
  const SEAL_LABELS = { red: 'Rot', green: 'Grün', black: 'Schwarz', blue: 'Blau', gold: 'Gold' };
  const POSITIONS = [['left', 'Links'], ['center', 'Mitte'], ['right', 'Rechts']];
  const EDGES = ['oben', 'rechts', 'unten', 'links'];
  // Form-Regler: [Schlüssel, Beschriftung, min, max, Schritt, Einheit]
  const SHAPE_FIELDS = [
    ['radius', 'Ecken', 0, 40, 1, ' px'],
    ['tilt', 'Schräglage', -3, 3, 0.5, '°'],
    ['padding', 'Innenabstand', 0, 60, 1, ' px'],
    ['opacity', 'Deckkraft', 30, 100, 5, ' %']
  ];

  // Schloss-Symbol (currentColor, keine feste Farbe)
  const lockIcon = closed =>
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>' +
    (closed ? '<path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" stroke-width="1.5"/>'
      : '<path d="M5.5 7V5a2.5 2.5 0 014.9-.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>') +
    '</svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const fmtNum = n => String(n).replace('.', ',');

  // =========================================================================
  // BILDVERARBEITUNG
  // =========================================================================
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
      img.src = src;
    });
  }

  // Zeichnet auf höchstens edge px Kante; mit Transparenz PNG, sonst WebP (JPEG als Rückfall)
  function encodeImage(img, edge) {
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error('Das Bild hat keine lesbare Größe.');
    const scale = Math.min(1, edge / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    let alpha = false;
    try {
      const data = ctx.getImageData(0, 0, w, h).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { alpha = true; break; }
    } catch (e) { alpha = true; } // nicht lesbar: sicherheitshalber PNG
    let src;
    if (alpha) src = canvas.toDataURL('image/png');
    else {
      src = canvas.toDataURL('image/webp', 0.85);
      if (!src.startsWith('data:image/webp')) src = canvas.toDataURL('image/jpeg', 0.85);
    }
    return { src, w, h };
  }

  async function processImageFile(file, maxEdge, maxBytes) {
    if (!file || !/^image\//.test(file.type)) throw new Error('Bitte eine Bilddatei wählen.');
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      let edge = Math.min(maxEdge, Math.max(img.naturalWidth, img.naturalHeight));
      for (let i = 0; i < 4; i++) {
        const out = encodeImage(img, edge);
        if (out.src.length <= maxBytes) return out;
        edge = Math.round(edge * 0.75); // zu groß für den Speicher: weiter verkleinern
      }
      throw new Error('Das Bild ist auch verkleinert noch zu groß.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const sizeCache = new Map();
  function imageSize(src) {
    const url = resolveSkinSrc(src);
    if (!url) return Promise.resolve(null);
    if (!sizeCache.has(url)) {
      sizeCache.set(url, loadImage(url).then(i => ({ w: i.naturalWidth, h: i.naturalHeight })).catch(() => null));
    }
    return sizeCache.get(url);
  }

  // =========================================================================
  // FARB-HILFEN (Startwert eines Farbfelds = aktuelle Farbe am Element)
  // =========================================================================
  function toHex(str) {
    if (typeof str !== 'string') return null;
    const s = str.trim();
    const two = n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
    const alphaOf = a => (a == null ? 1 : a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a));
    let m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(s);
    if (m) return alphaOf(m[4]) === 0 ? null : '#' + two(+m[1]) + two(+m[2]) + two(+m[3]);
    m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i.exec(s);
    if (m) return alphaOf(m[4]) === 0 ? null : '#' + two(m[1] * 255) + two(m[2] * 255) + two(m[3] * 255);
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s.slice(1).split('').map(c => c + c).join('').toLowerCase();
    return null;
  }
  // Löst einen CSS-Farbwert (auch var()/color-mix) über ein Hilfselement auf
  function probeColor(value) {
    const p = document.createElement('span');
    p.style.color = value;
    p.style.display = 'none';
    document.body.appendChild(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return toHex(c);
  }

  // =========================================================================
  // PANEL
  // =========================================================================
  function create(api) {
    let currentId = null;
    let draft = null;
    let locks = { slice: true, width: true };
    const closedSecs = new Set();
    let msgTimer = null;

    const root = document.createElement('aside');
    root.className = 'theme-lab-ui theme-lab-panel';
    root.id = 'theme-lab-panel';
    root.hidden = true;
    root.setAttribute('aria-label', 'Element gestalten');
    root.innerHTML =
      '<div class="tl-panel-head">' +
        '<div><div class="tl-panel-kicker"></div><div class="tl-panel-title"></div></div>' +
        '<button type="button" class="tl-icon-btn" data-act="close" title="Panel schließen" aria-label="Panel schließen">✕</button>' +
      '</div>' +
      '<div class="tl-panel-msg" role="status" aria-live="polite" hidden></div>' +
      '<div class="tl-panel-body"></div>' +
      '<input type="file" accept="image/*" class="tl-file" hidden>';
    document.body.appendChild(root);
    const body = root.querySelector('.tl-panel-body');
    const msgEl = root.querySelector('.tl-panel-msg');
    const fileInput = root.querySelector('.tl-file');

    const def = () => (currentId ? api.def(currentId) : null);
    function targets() {
      const d = def();
      if (!d) return [];
      try { return Array.from(document.querySelectorAll(d.selector)).filter(n => !n.closest('.theme-lab-ui')); } catch (e) { return []; }
    }

    // ---------- Meldungen ----------
    function showMessage(text, kind) {
      clearTimeout(msgTimer);
      msgEl.textContent = text || '';
      msgEl.className = 'tl-panel-msg' + (kind ? ' is-' + kind : '');
      msgEl.hidden = !text;
      if (text && kind !== 'error' && kind !== 'warn') msgTimer = setTimeout(() => { msgEl.hidden = true; }, 5000);
    }
    function showNotes(notes) {
      if (notes && notes.size) showMessage(Array.from(notes).join(' · '), 'warn');
    }

    // ---------- Entwurf → Eintrag ----------
    function draftToEntry(d) {
      const e = clone(d || {});
      if (e.image) {
        if (!e.image.mode || !e.image.src) delete e.image;
        else if (e.image.mode !== 'frame') { delete e.image.slice; delete e.image.width; }
      }
      if (e.fastener) {
        const f = e.fastener;
        if (!f.kind || (f.kind === 'custom' && !f.src)) delete e.fastener;
        else {
          if (f.kind !== 'custom') delete f.src;
          if (f.kind !== 'seal') delete f.color;
          if (f.kind === 'none') delete f.position;
        }
      }
      return Object.keys(e).length ? e : null;
    }

    function commit(key, rerender) {
      const notes = api.commit(currentId, draftToEntry(draft), key);
      if (notes && notes.size) showNotes(notes);
      else if (msgEl.classList.contains('is-warn')) showMessage('');
      if (rerender) render();
    }

    // ---------- Startwerte aus dem Element ----------
    function currentColor(key) {
      const n = targets()[0];
      let v = null;
      if (n) {
        const cs = getComputedStyle(n);
        if (key === 'surface') v = toHex(cs.backgroundColor);
        else if (key === 'text') v = toHex(cs.color);
        else if (key === 'border') v = toHex(cs.borderTopColor);
        else if (key === 'accent') v = probeColor(cs.getPropertyValue('--sage').trim() || 'var(--sage)');
        else if (key === 'heading') {
          const h = n.querySelector(def().heading);
          v = toHex(getComputedStyle(h || n).color);
        }
      }
      if (v) return v;
      return probeColor(key === 'surface' ? 'var(--surface-solid)' : key === 'accent' ? 'var(--sage)' : 'var(--text)')
        || toHex(getComputedStyle(document.body).color);
    }
    function currentShape(key) {
      const n = targets()[0];
      const cs = n ? getComputedStyle(n) : null;
      if (key === 'radius') return Math.min(40, Math.round(parseFloat(cs && cs.borderTopLeftRadius) || 12));
      if (key === 'padding') return Math.min(60, Math.round(parseFloat(cs && cs.paddingTop) || 16));
      if (key === 'opacity') return 100;
      return 0;
    }

    // ---------- Abschnitte ----------
    const sec = (key, title, html) =>
      '<details class="tl-sec" data-sec="' + key + '"' + (closedSecs.has(key) ? '' : ' open') + '>' +
      '<summary>' + esc(title) + '</summary><div class="tl-sec-body">' + html + '</div></details>';
    const seg = (act, items, current) =>
      '<div class="tl-seg">' + items.map(([v, l]) =>
        '<button type="button" data-act="' + act + '" data-val="' + esc(v) + '"' +
        ((current || '') === v ? ' class="is-on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + esc(l) + '</button>').join('') + '</div>';
    const themeCheck = (field, key, checked) =>
      '<label class="tl-check"><input type="checkbox" data-field="' + field + '" data-key="' + key + '"' +
      (checked ? ' checked' : '') + '> vom Theme</label>';

    function secImage() {
      const im = draft.image || {};
      const mode = im.mode || '';
      let h = seg('mode', IMAGE_MODES, mode);
      h += '<div class="tl-tiles">' + SKIN_TEMPLATES.map(t =>
        '<button type="button" class="tl-tile' + (im.src === 'tpl:' + t.id ? ' is-on' : '') + '" data-act="tpl" data-val="' + esc(t.id) + '" title="' + esc(t.label) + '">' +
        '<img src="' + esc(t.src) + '" alt="" loading="lazy"><span>' + esc(t.label) + '</span></button>').join('') +
        '<button type="button" class="tl-tile' + (im.src && im.src.startsWith('data:') ? ' is-on' : '') + '" data-act="upload-image" title="Eigenes Bild hochladen">' +
        (im.src && im.src.startsWith('data:') ? '<img src="' + esc(im.src) + '" alt="">' : '<span class="tl-tile-plus" aria-hidden="true">＋</span>') +
        '<span>Eigenes Bild</span></button></div>';
      if (mode && !im.src) h += '<p class="tl-hint">Wähle eine Vorlage oder ein eigenes Bild.</p>';
      if (mode === 'frame' && im.src) {
        const edgeRow = (field, label, max, vals) =>
          '<div class="tl-edges"><div class="tl-edges-head"><span>' + label + '</span>' +
          '<button type="button" class="tl-lock' + (locks[field] ? ' is-on' : '') + '" data-act="lock" data-val="' + field + '" title="' +
          (locks[field] ? 'Gekoppelt: ein Wert gilt für alle vier Seiten' : 'Getrennt: jede Seite einzeln') + '" aria-pressed="' + !!locks[field] + '">' + lockIcon(locks[field]) + '</button></div>' +
          '<div class="tl-edges-grid">' + EDGES.map((e, i) =>
            '<label><span>' + e + '</span><input type="number" class="tl-num" min="0" max="' + max + '" step="1" data-field="' + field + '" data-i="' + i + '" value="' + (vals ? vals[i] : 0) + '"></label>').join('') +
          '</div></div>';
        h += edgeRow('slice', 'Ecke im Bild (px)', 1000, im.slice);
        h += edgeRow('width', 'Randbreite am Element (px)', 120, im.width);
        h += '<div class="tl-slice-preview" aria-label="Vorschau der Teilung"><div class="tl-slice-stage"></div><div class="tl-hint tl-slice-info"></div></div>';
      } else if (im.src && mode) {
        h += '<div class="tl-slice-preview"><div class="tl-slice-stage"></div><div class="tl-hint tl-slice-info"></div></div>';
      }
      h += '<p class="tl-hint">Ein Bild am Element schaltet das Bild des Seitenstils an dieser Stelle ab.</p>';
      return sec('image', 'Bild', h);
    }

    function secColors() {
      const c = draft.colors || {};
      return sec('colors', 'Farben', COLOR_FIELDS.map(([k, l]) => {
        const fromTheme = !c[k];
        return '<div class="tl-row"><span class="tl-row-label">' + l + '</span>' +
          '<input type="color" class="tl-color" data-field="color" data-key="' + k + '" value="' + esc(c[k] || currentColor(k)) + '"' + (fromTheme ? ' disabled' : '') + '>' +
          themeCheck('color-theme', k, fromTheme) + '</div>';
      }).join(''));
    }

    function fontOptions(current) {
      let o = '<option value="">vom Theme</option>';
      for (const cat of FONT_CATEGORIES) {
        o += '<optgroup label="' + esc(cat.label) + '">' + cat.fonts.map(f =>
          '<option value="' + esc(f.stack) + '"' + (f.stack === current ? ' selected' : '') + ' style="font-family:' + esc(f.stack) + '">' + esc(f.label) + '</option>').join('') + '</optgroup>';
      }
      if (typeof CUSTOM_FONT_FILES !== 'undefined' && CUSTOM_FONT_FILES.length) {
        o += '<optgroup label="Eigene Schriften">' + CUSTOM_FONT_FILES.map(f => {
          const stack = '"' + f.family + '"';
          return '<option value="' + esc(stack) + '"' + (stack === current ? ' selected' : '') + ' style="font-family:' + esc(stack) + '">' + esc(f.family) + '</option>';
        }).join('') + '</optgroup>';
      }
      return o;
    }

    function secFont() {
      const f = draft.font || {};
      const size = f.size || 100;
      return sec('font', 'Schrift',
        '<label class="tl-field"><span>Überschrift</span><select class="tl-select" data-field="font" data-key="heading">' + fontOptions(f.heading) + '</select></label>' +
        '<label class="tl-field"><span>Text</span><select class="tl-select" data-field="font" data-key="text">' + fontOptions(f.text) + '</select></label>' +
        '<label class="tl-field"><span>Größe <output class="tl-out">' + size + ' %</output></span>' +
        '<input type="range" class="tl-range" min="80" max="140" step="5" value="' + size + '" data-field="size"></label>');
    }

    function secShape() {
      const s = draft.shape || {};
      let h = SHAPE_FIELDS.map(([k, l, min, max, step, unit]) => {
        const fromTheme = s[k] == null;
        const v = fromTheme ? currentShape(k) : s[k];
        return '<div class="tl-field"><span class="tl-field-head">' + l + ' <output class="tl-out">' + (fromTheme ? 'vom Theme' : fmtNum(v) + unit) + '</output>' +
          themeCheck('shape-theme', k, fromTheme) + '</span>' +
          '<input type="range" class="tl-range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '" data-field="shape" data-key="' + k + '" data-unit="' + esc(unit) + '"' + (fromTheme ? ' disabled' : '') + '></div>';
      }).join('');
      h += '<label class="tl-field"><span>Schatten</span><select class="tl-select" data-field="shadow">' +
        SHADOWS.map(([v, l]) => '<option value="' + v + '"' + ((s.shadow || '') === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>';
      return sec('shape', 'Form', h);
    }

    function secFastener() {
      const f = draft.fastener || {};
      const kind = f.kind || '';
      const btn = (val, label, inner) =>
        '<button type="button" class="tl-tile tl-tile-sm' + (kind === val ? ' is-on' : '') + '" data-act="fastener" data-val="' + val + '" title="' + esc(label) + '">' + inner + '<span>' + esc(label) + '</span></button>';
      let h = '<div class="tl-tiles tl-tiles-sm">' +
        btn('', 'Wie Seitenstil', '<span class="tl-tile-plus" aria-hidden="true">≈</span>') +
        btn('none', 'Keine', '<span class="tl-tile-plus" aria-hidden="true">∅</span>') +
        Object.keys(SKIN_FASTENERS).map(k => btn(k, FASTENER_LABELS[k] || k, '<img src="' + esc(SKIN_FASTENERS[k].src) + '" alt="">')).join('') +
        '<button type="button" class="tl-tile tl-tile-sm' + (kind === 'custom' ? ' is-on' : '') + '" data-act="fastener-upload" title="Eigenes Bild hochladen">' +
        (kind === 'custom' && f.src ? '<img src="' + esc(f.src) + '" alt="">' : '<span class="tl-tile-plus" aria-hidden="true">＋</span>') + '<span>Eigenes Bild</span></button>' +
        '</div>';
      if (kind && kind !== 'none') {
        h += '<div class="tl-field"><span>Position</span>' + seg('pos', POSITIONS, f.position || 'center') + '</div>';
      }
      if (kind === 'seal') {
        const cur = f.color || 'red';
        h += '<div class="tl-field"><span>Siegelfarbe</span><div class="tl-tiles tl-tiles-sm">' + Object.keys(SEAL_FILTERS).map(k =>
          '<button type="button" class="tl-tile tl-tile-sm' + (cur === k ? ' is-on' : '') + '" data-act="seal" data-val="' + k + '" title="' + esc(SEAL_LABELS[k] || k) + '">' +
          '<img src="' + esc(SKIN_FASTENERS.seal.src) + '" alt="" style="filter:' + esc(SEAL_FILTERS[k]) + '"><span>' + esc(SEAL_LABELS[k] || k) + '</span></button>').join('') + '</div></div>';
      }
      return sec('fastener', 'Befestigung', h);
    }

    function secExtras() {
      const d = def();
      if (!d.extras || !d.extras.length) return '';
      const ex = draft.extras || {};
      return sec('extras', 'Extra-Bilder', d.extras.map(x => {
        const v = ex[x.key] || '';
        const url = v ? resolveSkinSrc(v) : null;
        return '<div class="tl-extra"><div class="tl-extra-head">' + esc(x.label) + '</div><div class="tl-extra-row">' +
          '<span class="tl-thumb">' + (url ? '<img src="' + esc(url) + '" alt="">' : '–') + '</span>' +
          '<select class="tl-select" data-field="extra-tpl" data-key="' + esc(x.key) + '"><option value="">vom Seitenstil</option>' +
          (v.startsWith('data:') ? '<option value="__own" selected disabled>Eigenes Bild</option>' : '') +
          SKIN_TEMPLATES.map(t => '<option value="' + esc(t.id) + '"' + (v === 'tpl:' + t.id ? ' selected' : '') + '>Vorlage: ' + esc(t.label) + '</option>').join('') +
          '</select>' +
          '<button type="button" class="tl-btn tl-btn-sm" data-act="extra-upload" data-key="' + esc(x.key) + '">Eigenes…</button>' +
          (v ? '<button type="button" class="tl-icon-btn" data-act="extra-clear" data-key="' + esc(x.key) + '" title="Entfernen" aria-label="Entfernen">✕</button>' : '') +
          '</div></div>';
      }).join(''));
    }

    function secReset() {
      return sec('reset', 'Zurücksetzen',
        '<p class="tl-hint">Entfernt das ganze Design dieses Elements; es sieht dann wieder aus wie im Seitenstil.</p>' +
        '<button type="button" class="tl-btn tl-btn-danger" data-act="reset"' + (draftToEntry(draft) ? '' : ' disabled') + '>Design entfernen</button>');
    }

    function render() {
      const d = def();
      if (!d) return;
      const scroll = body.scrollTop;
      root.querySelector('.tl-panel-kicker').textContent = d.group ? 'Sammelelement' : (d.view === '*' ? 'Auf allen Seiten' : 'Element');
      root.querySelector('.tl-panel-title').textContent = d.label;
      body.innerHTML =
        (d.group ? '<p class="tl-hint tl-hint-box">Gilt für alle Karten dieser Seite. Einstellungen an einer einzelnen Karte gehen vor.</p>' : '') +
        secImage() + secColors() + secFont() + secShape() + secFastener() + secExtras() + secReset();
      body.scrollTop = scroll;
      fillPreview();
    }

    // 9-Teilung: Bild verkleinert in die Box, vier Hilfslinien an den Ecken-Werten
    async function fillPreview() {
      const stage = body.querySelector('.tl-slice-stage');
      const im = draft.image;
      if (!stage || !im || !im.src) return;
      const src = im.src;
      const size = await imageSize(src);
      if (!stage.isConnected || !draft.image || draft.image.src !== src) return;
      const info = body.querySelector('.tl-slice-info');
      if (!size) { info.textContent = 'Bild konnte nicht geladen werden.'; return; }
      const sc = Math.min(1, PREVIEW_W / size.w, PREVIEW_H / size.h);
      const w = Math.round(size.w * sc), h = Math.round(size.h * sc);
      let html = '<img src="' + esc(resolveSkinSrc(src)) + '" alt="" style="width:' + w + 'px;height:' + h + 'px">';
      if (draft.image.mode === 'frame' && Array.isArray(draft.image.slice)) {
        const [t, r, b, l] = draft.image.slice.map(n => Math.max(0, n));
        const line = (cls, prop, px) => '<i class="tl-slice-line ' + cls + '" style="' + prop + ':' + Math.round(Math.min(px, cls === 'is-h' ? h : w)) + 'px"></i>';
        html += line('is-h', 'top', t * sc) + line('is-h', 'top', (size.h - b) * sc) +
          line('is-v', 'left', l * sc) + line('is-v', 'left', (size.w - r) * sc);
      }
      stage.style.width = w + 'px';
      stage.style.height = h + 'px';
      stage.innerHTML = html;
      info.textContent = 'Bild ' + size.w + ' × ' + size.h + ' px';
    }

    // ---------- Datei wählen ----------
    function pickFile(maxEdge, maxBytes) {
      return new Promise(resolve => {
        fileInput.value = '';
        fileInput.onchange = async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) { resolve(null); return; }
          showMessage('Bild wird verarbeitet…', 'info');
          try {
            const out = await processImageFile(file, maxEdge, maxBytes);
            showMessage('');
            resolve(out);
          } catch (err) {
            showMessage(err.message || 'Das Bild konnte nicht verarbeitet werden.', 'error');
            resolve(null);
          }
        };
        fileInput.click();
      });
    }

    // ---------- Aktionen ----------
    const ensure = k => (draft[k] && typeof draft[k] === 'object' ? draft[k] : (draft[k] = {}));
    const defaultSlice = sz => {
      const s = sz ? Math.max(1, Math.min(1000, Math.round(Math.min(sz.w, sz.h) / 4))) : 30;
      return [s, s, s, s];
    };
    const allSame = a => Array.isArray(a) && a.every(n => n === a[0]);

    async function setMode(mode) {
      const im = ensure('image');
      im.mode = mode || null;
      if (mode === 'frame' && im.src && !Array.isArray(im.slice)) {
        const tpl = SKIN_TEMPLATES.find(t => 'tpl:' + t.id === im.src);
        if (tpl && tpl.slice) { im.slice = tpl.slice.slice(); im.width = tpl.width.slice(); }
        else { im.slice = defaultSlice(await imageSize(im.src)); im.width = [16, 16, 16, 16]; }
      }
      if (mode === 'frame' && !Array.isArray(im.width)) im.width = [16, 16, 16, 16];
      locks = { slice: allSame(im.slice), width: allSame(im.width) };
      commit('image.mode', true);
    }

    function setTemplate(id) {
      const t = SKIN_TEMPLATES.find(x => x.id === id);
      if (!t) return;
      const im = ensure('image');
      im.src = 'tpl:' + t.id;
      if (t.slice) {
        if (!im.mode) im.mode = 'frame';
        im.slice = t.slice.slice();
        im.width = t.width.slice();
      } else {
        if (!im.mode || im.mode === 'frame') im.mode = 'fill';
        delete im.slice; delete im.width;
      }
      locks = { slice: allSame(im.slice), width: allSame(im.width) };
      commit('image.src', true);
    }

    async function uploadImage() {
      const out = await pickFile(FRAME_EDGE, FRAME_BYTES);
      if (!out || !currentId) return;
      const im = ensure('image');
      im.src = out.src;
      if (!im.mode) im.mode = 'fill';
      sizeCache.set(out.src, Promise.resolve({ w: out.w, h: out.h }));
      im.slice = defaultSlice({ w: out.w, h: out.h });
      im.width = [16, 16, 16, 16];
      locks = { slice: true, width: true };
      commit('image.src', true);
    }

    async function uploadFastener() {
      const out = await pickFile(SMALL_EDGE, SMALL_BYTES);
      if (!out || !currentId) return;
      const f = ensure('fastener');
      f.kind = 'custom';
      f.src = out.src;
      if (!f.position) f.position = 'center';
      commit('fastener', true);
    }

    async function uploadExtra(key) {
      const out = await pickFile(SMALL_EDGE, SMALL_BYTES);
      if (!out || !currentId) return;
      ensure('extras')[key] = out.src;
      commit('extras.' + key, true);
    }

    body.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || !draft) return;
      const v = b.dataset.val;
      switch (b.dataset.act) {
        case 'mode': setMode(v); break;
        case 'tpl': setTemplate(v); break;
        case 'upload-image': uploadImage(); break;
        case 'lock': {
          locks[v] = !locks[v];
          const im = ensure('image');
          if (locks[v] && Array.isArray(im[v])) { im[v] = im[v].map(() => im[v][0]); commit('image.' + v, true); }
          else render();
          break;
        }
        case 'fastener': {
          const f = ensure('fastener');
          f.kind = v || null;
          if (v && v !== 'none' && !f.position) f.position = 'center';
          commit('fastener', true);
          break;
        }
        case 'fastener-upload': uploadFastener(); break;
        case 'pos': ensure('fastener').position = v; commit('fastener.pos', true); break;
        case 'seal': ensure('fastener').color = v; commit('fastener.color', true); break;
        case 'extra-upload': uploadExtra(b.dataset.key); break;
        case 'extra-clear': delete ensure('extras')[b.dataset.key]; commit('extras.' + b.dataset.key, true); break;
        case 'reset': draft = {}; locks = { slice: true, width: true }; commit('reset', true); break;
      }
    });

    function onField(e) {
      const t = e.target;
      const field = t.dataset && t.dataset.field;
      if (!field || !draft) return;
      const key = t.dataset.key;
      const live = e.type === 'input';
      switch (field) {
        case 'slice': case 'width': {
          if (live && t.value === '') return;
          const max = field === 'slice' ? 1000 : 120;
          const n = Math.max(0, Math.min(max, Math.round(Number(t.value) || 0)));
          const im = ensure('image');
          const arr = Array.isArray(im[field]) ? im[field].slice() : [0, 0, 0, 0];
          if (locks[field]) arr.fill(n); else arr[+t.dataset.i] = n;
          im[field] = arr;
          if (locks[field]) body.querySelectorAll('[data-field="' + field + '"]').forEach(x => { if (x !== t) x.value = n; });
          commit('image.' + field, false);
          fillPreview();
          break;
        }
        case 'color':
          ensure('colors')[key] = t.value.toLowerCase();
          commit('colors.' + key, false);
          break;
        case 'color-theme': {
          const input = body.querySelector('[data-field="color"][data-key="' + key + '"]');
          if (t.checked) { ensure('colors')[key] = null; input.disabled = true; }
          else { input.disabled = false; ensure('colors')[key] = input.value.toLowerCase(); }
          commit('colors.' + key + '.theme', false);
          break;
        }
        case 'font':
          if (live) return;
          ensure('font')[key] = t.value || null;
          commit('font.' + key, false);
          break;
        case 'size': {
          const n = Number(t.value);
          ensure('font').size = n === 100 ? null : n;
          t.closest('.tl-field').querySelector('.tl-out').textContent = n + ' %';
          commit('font.size', false);
          break;
        }
        case 'shape': {
          const n = Number(t.value);
          ensure('shape')[key] = n;
          t.closest('.tl-field').querySelector('.tl-out').textContent = fmtNum(n) + (t.dataset.unit || '');
          commit('shape.' + key, false);
          break;
        }
        case 'shape-theme': {
          const wrap = t.closest('.tl-field');
          const range = wrap.querySelector('.tl-range');
          const out = wrap.querySelector('.tl-out');
          if (t.checked) { ensure('shape')[key] = null; range.disabled = true; out.textContent = 'vom Theme'; }
          else { range.disabled = false; ensure('shape')[key] = Number(range.value); out.textContent = fmtNum(range.value) + (range.dataset.unit || ''); }
          commit('shape.' + key + '.theme', false);
          break;
        }
        case 'shadow':
          if (live) return;
          ensure('shape').shadow = t.value || null;
          commit('shape.shadow', false);
          break;
        case 'extra-tpl':
          if (live) return;
          if (t.value) ensure('extras')[key] = 'tpl:' + t.value; else delete ensure('extras')[key];
          commit('extras.' + key, true);
          break;
      }
      // Zurücksetzen-Knopf an den Entwurf anpassen, ohne alles neu zu bauen
      const resetBtn = body.querySelector('[data-act="reset"]');
      if (resetBtn) resetBtn.disabled = !draftToEntry(draft);
    }
    body.addEventListener('input', onField);
    body.addEventListener('change', onField);
    body.addEventListener('toggle', e => {
      const d = e.target.closest && e.target.closest('details[data-sec]');
      if (!d) return;
      if (d.open) closedSecs.delete(d.dataset.sec); else closedSecs.add(d.dataset.sec);
    }, true);

    root.querySelector('[data-act="close"]').addEventListener('click', () => close());

    // ---------- Öffnen / Schließen ----------
    // Entwurf aus dem gespeicherten Stand; Rahmen ohne Teilung bekommt die Werte der Vorlage
    function loadDraft() {
      draft = api.getEntry(currentId) || {};
      const im = draft.image;
      if (im && im.mode === 'frame') {
        const tpl = SKIN_TEMPLATES.find(t => 'tpl:' + t.id === im.src);
        if (!Array.isArray(im.slice) && tpl && tpl.slice) im.slice = tpl.slice.slice();
        if (!Array.isArray(im.width)) im.width = tpl && tpl.width ? tpl.width.slice() : [16, 16, 16, 16];
      }
      const i2 = draft.image || {};
      locks = { slice: !i2.slice || allSame(i2.slice), width: !i2.width || allSame(i2.width) };
    }
    function open(id) {
      if (!api.def(id)) return;
      currentId = id;
      loadDraft();
      showMessage('');
      root.hidden = false;
      body.scrollTop = 0;
      render();
      api.onToggle();
    }
    function close() {
      if (!currentId) return;
      currentId = null;
      draft = null;
      root.hidden = true;
      api.onToggle();
    }
    // Nach Rückgängig: Entwurf aus dem aktuellen Stand neu laden
    function reload() {
      if (!currentId) return;
      loadDraft();
      render();
    }

    return {
      open, close, reload, showMessage,
      isOpen: () => !!currentId,
      selectedId: () => currentId
    };
  }

  window.NookThemeLabPanel = { create, processImageFile };
})();
