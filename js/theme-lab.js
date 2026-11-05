// theme-lab.js — Editor im Musterfenster ("Theme live bearbeiten")
// MUSS das LETZTE <script> in index.html sein. Tut nur etwas, wenn
// js/theme-lab-boot.js das Musterfenster eingerichtet hat (NOOK_THEME_LAB) oder
// dabei gescheitert ist (NOOK_THEME_LAB_FAILED → nur Hinweis + „Schließen“).
// Das echte Nook öffnet index.html?themeLab=1&theme=<id> als Vollbild-iframe;
// gespeichert wird per postMessage an window.parent (Hauptfenster prüft und speichert).
//
// Aufbau dieser Datei: Zustand & Änderungen → Leiste oben → Stifte → Nachrichten → Start.
// Das Panel rechts (sieben Abschnitte pro Element, Bildverarbeitung) liegt in
// js/theme-lab-panel.js (lädt direkt davor und stellt window.NookThemeLabPanel bereit).
// Braucht: nookSkinRegistry/applyThemeSkins/sanitizeSkins/skinSanitizeContext
// (theme-skins.js), getCustomTheme/customThemes (theme-engine.js), showView/currentView
// (main.js), hubConfirm (hub-utils.js).
(function () {
  'use strict';
  if (!window.NOOK_THEME_LAB && !window.NOOK_THEME_LAB_FAILED) return;

  const TOOLBAR_H = 48;        // muss zu --tl-bar-h in css/theme-lab.css passen
  const PANEL_W = 360;         // muss zu --tl-panel-w passen
  const PENCIL = 28;           // Stift-Kantenlänge in px
  const HISTORY_MAX = 50;
  const COALESCE_MS = 1500;    // Ziehen am Regler/Farbwähler = ein Rückgängig-Schritt
  const SAVE_TIMEOUT_MS = 15000;
  const NARROW_MQ = '(max-width: 899.98px)';
  const SKIP_VIEWS = new Set(['project-detail', 'mehr']); // brauchen Kontext bzw. nur mobil

  const themeId = String(window.NOOK_THEME_LAB_THEME_ID || '');
  const embedded = window.parent && window.parent !== window;
  const targetOrigin = location.protocol === 'file:' ? '*' : location.origin;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  document.documentElement.classList.add('theme-lab');

  function post(msg) {
    try { window.parent.postMessage(msg, targetOrigin); } catch (e) { /* nichts zu tun */ }
  }

  // ── Notfall: Datentrennung hat nicht gegriffen → nur Hinweis + Schließen ──
  if (window.NOOK_THEME_LAB_FAILED) {
    const bar = document.createElement('div');
    bar.className = 'theme-lab-ui theme-lab-bar is-failed';
    bar.innerHTML =
      '<div class="tl-bar-note is-error">Das Musterfenster konnte nicht sicher von deinen Daten getrennt werden. ' +
      'Damit nichts verändert wird, ist Bearbeiten hier abgeschaltet. Bitte schließe das Fenster.</div>' +
      '<span class="tl-bar-spacer"></span>' +
      '<button type="button" class="tl-btn tl-btn-primary" id="tl-close-failed">Schließen</button>';
    document.body.appendChild(bar);
    bar.querySelector('#tl-close-failed').addEventListener('click', () => {
      post({ type: 'nook-theme-lab:close' });
      if (!embedded) bar.querySelector('.tl-bar-note').textContent = 'Schließen klappt nur im echten Nook (dieses Fenster ist nicht eingebettet).';
    });
    return;
  }

  // =========================================================================
  // ZUSTAND & ÄNDERUNGEN
  // labSkins = Arbeitskopie von ct.skins, labHistory = frühere Stände (JSON),
  // labDirty = weicht vom zuletzt gespeicherten Stand ab.
  // =========================================================================
  const skinCtx = () => skinSanitizeContext();

  function readThemeSkins() {
    const ct = typeof getCustomTheme === 'function' ? getCustomTheme(themeId) : null;
    if (!ct || !ct.skins) return {};
    const clean = sanitizeSkins(JSON.parse(JSON.stringify(ct.skins)), new Set(), skinCtx());
    return clean || {};
  }

  let labSkins = readThemeSkins();
  let labHistory = [];
  let labBaseline = JSON.stringify(labSkins);
  let labDirty = false;
  let labSaving = false;
  let lastKey = null, lastTime = 0;
  let saveTimer = null;

  // Vorschau anwenden. ct.skins im Lab-Speicher (nur Arbeitsspeicher) mitziehen,
  // damit ein späteres applyThemeEngine (z.B. Tag/Nacht) nicht den alten Stand malt.
  function labApply() {
    try {
      const ct = getCustomTheme(themeId);
      if (ct && typeof customThemes !== 'undefined' && customThemes.includes(ct)) {
        ct.skins = JSON.parse(JSON.stringify(labSkins));
      }
    } catch (e) { /* Vorschau geht trotzdem */ }
    applyThemeSkins(themeId, labSkins);
  }

  function labEntry(id) {
    return labSkins[id] ? JSON.parse(JSON.stringify(labSkins[id])) : null;
  }

  // Setzt das Design eines Elements (entry null = entfernen). Prüft nur diesen
  // Eintrag mit sanitizeSkins, legt den alten Stand auf labHistory und malt neu.
  // key: gleiche Schlüssel kurz hintereinander zählen als ein Rückgängig-Schritt.
  function labCommit(id, entry, key) {
    const notes = new Set();
    let clean = null;
    if (entry && typeof entry === 'object') {
      const r = sanitizeSkins({ [id]: entry }, notes, skinCtx());
      clean = (r && r[id]) || null;
    }
    const before = JSON.stringify(labSkins);
    const next = Object.assign({}, labSkins);
    if (clean) next[id] = clean; else delete next[id];
    const after = JSON.stringify(next);
    if (after === before) return notes;
    const now = Date.now();
    if (!(key && key === lastKey && now - lastTime < COALESCE_MS)) {
      labHistory.push(before);
      if (labHistory.length > HISTORY_MAX) labHistory.shift();
    }
    lastKey = key || null; lastTime = now;
    labSkins = next;
    labApply();
    labUpdateToolbar();
    return notes;
  }

  function labUndo() {
    if (!labHistory.length || labSaving) return;
    labSkins = JSON.parse(labHistory.pop());
    lastKey = null;
    labApply();
    panel.reload();
    labUpdateToolbar();
  }

  function formatSize(n) {
    const de = (v, d) => v.toLocaleString('de-DE', { maximumFractionDigits: d });
    if (n < 1024 * 1024) return de(n / 1024, n < 10240 ? 1 : 0) + ' KB';
    return de(n / (1024 * 1024), 1) + ' MB';
  }

  const isNarrow = () => window.matchMedia(NARROW_MQ).matches;
  const labCurrentView = () => (typeof currentView !== 'undefined' && currentView) || 'today';

  // =========================================================================
  // PANEL (js/theme-lab-panel.js)
  // =========================================================================
  const panel = window.NookThemeLabPanel.create({
    def: id => nookSkinRegistry.get(id),
    getEntry: labEntry,
    commit: labCommit,
    onToggle: () => {
      document.documentElement.classList.toggle('tl-panel-open', panel.isOpen());
      window.dispatchEvent(new Event('resize')); // Zeitleiste & Co. messen neu
      labMarkSelected(); labUpdatePencils();
    }
  });

  // =========================================================================
  // LEISTE OBEN
  // =========================================================================
  const bar = document.createElement('div');
  bar.className = 'theme-lab-ui theme-lab-bar';
  bar.id = 'theme-lab-bar';
  const ct0 = typeof getCustomTheme === 'function' ? getCustomTheme(themeId) : null;
  bar.innerHTML =
    '<div class="tl-bar-title"><span class="tl-bar-logo" aria-hidden="true">✎</span> Theme live bearbeiten' +
      '<span class="tl-bar-theme">' + esc(ct0 ? ct0.name || themeId : 'Theme nicht gefunden') + '</span></div>' +
    '<label class="tl-bar-field">Seite <select id="tl-page" class="tl-select"></select></label>' +
    '<div id="tl-groups" class="tl-bar-groups"></div>' +
    '<div id="tl-narrow" class="tl-bar-note" hidden>Zum Bearbeiten einen größeren Bildschirm nutzen</div>' +
    '<span class="tl-bar-spacer"></span>' +
    '<span id="tl-status" class="tl-bar-status" role="status" aria-live="polite"></span>' +
    '<button type="button" id="tl-undo" class="tl-btn" title="Letzten Schritt zurücknehmen (Strg+Z)">↶ Rückgängig</button>' +
    '<span id="tl-size" class="tl-bar-size" title="Speicherbedarf der Element-Designs dieses Themes"></span>' +
    '<button type="button" id="tl-cancel" class="tl-btn">Abbrechen</button>' +
    '<button type="button" id="tl-save" class="tl-btn tl-btn-primary">Speichern</button>';
  document.body.appendChild(bar);

  const $ = sel => bar.querySelector(sel);
  const pageSel = $('#tl-page');

  function labPages() {
    const seen = new Set();
    const out = [];
    document.querySelectorAll('.view[id^="view-"]').forEach(v => {
      const name = v.id.slice(5);
      if (SKIP_VIEWS.has(name) || seen.has(name)) return;
      seen.add(name);
      const btn = document.querySelector('#nav-list .nav-btn[data-view="' + name + '"]');
      const label = (btn && btn.textContent.trim()) || name.charAt(0).toUpperCase() + name.slice(1);
      out.push({ name, label });
    });
    return out;
  }
  pageSel.innerHTML = labPages().map(p => '<option value="' + esc(p.name) + '">' + esc(p.label) + '</option>').join('');
  pageSel.addEventListener('change', () => {
    panel.close();
    if (typeof showView === 'function') showView(pageSel.value);
    labSyncView(true);
  });

  let groupsView = null;
  function labRenderGroups() {
    const view = labCurrentView();
    groupsView = view;
    const groups = nookSkinRegistry.list(view).filter(d => d.group);
    $('#tl-groups').innerHTML = groups.map(d =>
      '<button type="button" class="tl-btn tl-btn-group" data-id="' + esc(d.id) + '" title="Gilt für alle Karten dieser Seite">✎ ' +
      esc(d.label) + '</button>').join('');
  }
  $('#tl-groups').addEventListener('click', e => {
    const b = e.target.closest('[data-id]');
    if (b) panel.open(b.dataset.id);
  });

  let statusTimer = null;
  function labStatus(text, kind) {
    const s = $('#tl-status');
    s.textContent = text || '';
    s.className = 'tl-bar-status' + (kind ? ' is-' + kind : '');
    clearTimeout(statusTimer);
    if (text && kind !== 'error') statusTimer = setTimeout(() => { s.textContent = ''; }, 6000);
  }
  // Meldung im Panel, falls offen, sonst in der Leiste
  function labMessage(text, kind) {
    if (panel.isOpen()) panel.showMessage(text, kind);
    labStatus(text, kind);
  }

  function labUpdateToolbar() {
    labDirty = JSON.stringify(labSkins) !== labBaseline;
    const narrow = isNarrow();
    $('#tl-undo').disabled = !labHistory.length || labSaving;
    $('#tl-size').textContent = formatSize(JSON.stringify(labSkins).length);
    const save = $('#tl-save');
    save.disabled = labSaving;
    save.textContent = labSaving ? 'Speichert…' : 'Speichern';
    save.classList.toggle('is-dirty', labDirty);
    $('#tl-cancel').disabled = labSaving;
    $('#tl-narrow').hidden = !narrow;
    $('#tl-groups').hidden = narrow;
    if (groupsView !== labCurrentView()) labRenderGroups();
  }

  $('#tl-undo').addEventListener('click', labUndo);
  $('#tl-save').addEventListener('click', labSave);
  $('#tl-cancel').addEventListener('click', labClose);

  // =========================================================================
  // STIFTE — ein ✎ pro Element der aktuellen Seite (Sammelelemente in der Leiste)
  // Einfacher Abgleich alle 500 ms + bei Scroll/Resize statt MutationObserver.
  // =========================================================================
  const pencilLayer = document.createElement('div');
  pencilLayer.className = 'theme-lab-ui theme-lab-pencils';
  document.body.appendChild(pencilLayer);
  const pencils = new Map(); // id → <button>

  function labMatches(selector) {
    try {
      return Array.from(document.querySelectorAll(selector)).filter(n => !n.closest('.theme-lab-ui'));
    } catch (e) { return []; }
  }
  // Sichtbarer Teil eines Elements: Rechteck geschnitten mit allen Vorfahren, die
  // abschneiden (z.B. die seitlich scrollende Zeitleiste). null = nicht zu sehen.
  function labVisibleRect(n) {
    const b = n.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) return null;
    let l = b.left, t = b.top, r = b.right, btm = b.bottom;
    for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (cs.overflowX !== 'visible') { l = Math.max(l, pr.left); r = Math.min(r, pr.right); }
      if (cs.overflowY !== 'visible') { t = Math.max(t, pr.top); btm = Math.min(btm, pr.bottom); }
      if (r - l < 8 || btm - t < 8) return null;
    }
    return { left: l, top: t, right: r, bottom: btm };
  }
  // Erster sichtbarer Treffer. Treffer, die zugleich zu einem anderen Element
  // gehören (aktiver Menü-Knopf ist auch ein Menü-Knopf), nur als Rückfall.
  function labFirstVisible(def, others) {
    let fallback = null;
    for (const n of labMatches(def.selector)) {
      const r = labVisibleRect(n);
      if (!r) continue;
      const shared = others.some(o => { try { return n.matches(o.selector); } catch (e) { return false; } });
      if (!shared) return r;
      if (!fallback) fallback = r;
    }
    return fallback;
  }

  function labUpdatePencils() {
    const narrow = isNarrow();
    const modalOpen = !!document.querySelector('.modal-backdrop:not(.hidden), #hub-search-overlay:not(.hidden)');
    const defs = narrow ? [] : nookSkinRegistry.list(labCurrentView()).filter(d => !d.group);
    const want = new Set(defs.map(d => d.id));
    for (const [id, b] of pencils) if (!want.has(id)) { b.remove(); pencils.delete(id); }

    const maxX = window.innerWidth - (panel.isOpen() ? PANEL_W : 0) - 4;
    const placed = [];
    for (const d of defs) {
      let b = pencils.get(d.id);
      if (!b) {
        b = document.createElement('button');
        b.type = 'button';
        b.className = 'tl-pencil';
        b.textContent = '✎';
        b.title = d.label;
        b.setAttribute('aria-label', d.label + ' bearbeiten');
        b.addEventListener('click', e => { e.stopPropagation(); panel.open(d.id); });
        pencilLayer.appendChild(b);
        pencils.set(d.id, b);
      }
      const r = modalOpen ? null : labFirstVisible(d, defs.filter(o => o !== d));
      if (!r || r.bottom < TOOLBAR_H + 10 || r.top > window.innerHeight - 10 || r.left > maxX - PENCIL) {
        b.hidden = true;
        continue;
      }
      let x = Math.max(2, Math.min(r.right - PENCIL - 4, maxX - PENCIL));
      const y = Math.max(r.top + 4, TOOLBAR_H + 4);
      // Stifte, die übereinander lägen (z.B. Menü-Knopf + aktiver Menü-Knopf), nach links schieben
      for (let guard = 0; guard < 12 && placed.some(p => Math.abs(p.x - x) < PENCIL && Math.abs(p.y - y) < PENCIL); guard++) {
        x -= PENCIL + 4;
      }
      placed.push({ x, y });
      b.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
      b.hidden = false;
      b.classList.toggle('is-active', panel.selectedId() === d.id);
    }
  }

  // Ausgewähltes Element umranden (alle Treffer: zeigt, was die Einstellung betrifft)
  let marked = [];
  function labMarkSelected() {
    const id = panel.selectedId();
    const def = id && nookSkinRegistry.get(id);
    const now = def ? labMatches(def.selector) : [];
    marked.forEach(n => { if (!now.includes(n)) n.classList.remove('theme-lab-selected'); });
    now.forEach(n => n.classList.add('theme-lab-selected'));
    marked = now;
  }

  let rafPending = false;
  function labSchedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; labUpdatePencils(); });
  }

  // Seitenwechsel (auch über die Seitenleiste der App) erkennen
  let lastView = null;
  function labSyncView(force) {
    const v = labCurrentView();
    if (v === lastView && !force) return;
    lastView = v;
    if (pageSel.value !== v && pageSel.querySelector('option[value="' + v + '"]')) pageSel.value = v;
    const sel = panel.selectedId();
    const def = sel && nookSkinRegistry.get(sel);
    if (def && def.view !== '*' && def.view !== v) panel.close();
    labRenderGroups();
  }

  window.addEventListener('scroll', labSchedule, true);
  window.addEventListener('resize', labSchedule);
  window.matchMedia(NARROW_MQ).addEventListener('change', () => {
    if (isNarrow()) panel.close();
    labUpdateToolbar();
    labSchedule();
  });
  setInterval(() => { labSyncView(false); labUpdatePencils(); labMarkSelected(); }, 500);

  // Tastatur: Strg+Z = Rückgängig (nicht in Eingabefeldern), Esc = Panel zu
  document.addEventListener('keydown', e => {
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      labUndo();
    } else if (e.key === 'Escape' && panel.isOpen() && !document.querySelector('.modal-backdrop:not(.hidden)')) {
      panel.close();
    }
  });

  // =========================================================================
  // NACHRICHTEN ans Hauptfenster (Task 6 baut die Gegenseite)
  // =========================================================================
  function labFinishSave() {
    labSaving = false;
    clearTimeout(saveTimer);
    saveTimer = null;
    labUpdateToolbar();
  }

  function labSave() {
    if (labSaving) return;
    labSaving = true;
    labUpdateToolbar();
    post({ type: 'nook-theme-lab:save', themeId, skins: JSON.parse(JSON.stringify(labSkins)) });
    if (!embedded) {
      labFinishSave();
      labMessage('Speichern klappt nur im echten Nook – dieses Musterfenster ist nicht eingebettet.', 'error');
      return;
    }
    saveTimer = setTimeout(() => {
      labFinishSave();
      labMessage('Keine Antwort vom Hauptfenster. Bitte noch einmal speichern.', 'error');
    }, SAVE_TIMEOUT_MS);
  }

  async function labClose() {
    if (labSaving) return;
    if (labDirty) {
      const ok = await hubConfirm({
        title: 'Änderungen verwerfen?',
        message: 'Du hast Änderungen, die noch nicht gespeichert sind. Beim Schließen gehen sie verloren.',
        confirmText: 'Verwerfen',
        danger: true
      });
      if (!ok) return;
    }
    post({ type: 'nook-theme-lab:close' });
    if (!embedded) labMessage('Schließen klappt nur im echten Nook – dieses Musterfenster ist nicht eingebettet.', 'error');
  }

  window.addEventListener('message', e => {
    if (!embedded || e.source !== window.parent) return;
    if (location.protocol !== 'file:' && e.origin !== location.origin) return;
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'nook-theme-lab:saved') {
      if (!labSaving) return;
      labBaseline = JSON.stringify(labSkins);
      labFinishSave();
      labMessage('Gespeichert.', 'ok');
    } else if (d.type === 'nook-theme-lab:save-failed') {
      if (!labSaving) return;
      labFinishSave();
      const why = typeof d.message === 'string' && d.message ? d.message.slice(0, 300) : 'Unbekannter Fehler.';
      labMessage('Speichern fehlgeschlagen: ' + why + ' Deine Änderungen sind noch da.', 'error');
    }
  });

  // =========================================================================
  // START
  // =========================================================================
  if (typeof ensureThemeFontsLoaded === 'function') ensureThemeFontsLoaded();
  labApply();
  labSyncView(true);
  labUpdateToolbar();
  labUpdatePencils();
})();
