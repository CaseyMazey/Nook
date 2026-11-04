// theme-lab-boot.js — abgeschottetes Musterfenster fuer "Theme live bearbeiten"
// MUSS das ERSTE <script> in index.html sein (vor main.js, das DB ueber localStorage legt).
// Im Lab (index.html?themeLab=1) laeuft Nook in einem iframe mit Musterdaten. Der iframe
// teilt sich localStorage mit der echten App; deshalb wird window.localStorage hier durch
// einen reinen Arbeitsspeicher ersetzt. Echte Nutzerdaten werden nie geschrieben.
// Reine Logik exportiert fuer Node-Tests; im Browser laeuft nur der Lab-Modus.
(function () {
  "use strict";

  // Nur diese Schluessel werden (lesend) aus dem echten Speicher uebernommen
  const COPY_KEYS = ["customThemes", "theme", "themeFamily", "themeBackgrounds", "themeAutoMode",
    "dayNightToggle", "uiFontScale", "hubUserColors", "tabOrder", "hiddenTabs", "userName"];

  function createMemoryStorage(initial) {
    const m = new Map();
    if (initial) for (const k of Object.keys(initial)) m.set(k, String(initial[k]));
    return {
      getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
      setItem: (k, v) => { m.set(String(k), String(v)); },
      removeItem: k => { m.delete(String(k)); },
      clear: () => { m.clear(); },
      key: i => (i >= 0 && i < m.size ? Array.from(m.keys())[i] : null),
      get length() { return m.size; }
    };
  }

  // Liefert true, wenn win.localStorage jetzt der Arbeitsspeicher ist; sonst false,
  // ohne irgendetwas in den echten Speicher zu schreiben.
  function installThemeLab(win, opts) {
    const o = opts || {};
    const sample = o.sample || {};
    const copyKeys = o.copyKeys || COPY_KEYS;
    // 1) Lesen (nur getItem) VOR dem Ersetzen
    const copied = {};
    try {
      const real = win.localStorage;
      for (const k of copyKeys) {
        const v = real.getItem(k);
        if (v !== null && v !== undefined) copied[k] = v;
      }
    } catch (e) { /* kein Zugriff: ohne Kopien weiter */ }
    // 2) Ersetzen und pruefen
    const mem = createMemoryStorage();
    try {
      Object.defineProperty(win, "localStorage", { configurable: true, get: () => mem });
      if (win.localStorage !== mem) return false;
    } catch (e) { return false; }
    // 3) Fuellen: Muster, dann Kopien (gewinnen), dann theme
    for (const k of Object.keys(sample)) mem.setItem(k, sample[k]);
    for (const k of Object.keys(copied)) mem.setItem(k, copied[k]);
    if (o.themeId) mem.setItem("theme", JSON.stringify(o.themeId)); // DB.get parst JSON
    // 4) storage-Events der echten App nicht in die Vorschau durchlassen
    try { win.addEventListener("storage", e => e.stopImmediatePropagation(), true); } catch (e) { /* egal */ }
    return true;
  }

  const api = { COPY_KEYS, createMemoryStorage, installThemeLab };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  // ---- Browser ----
  let lab = false;
  try { lab = new URLSearchParams(location.search).get("themeLab") === "1"; } catch (e) { /* ignore */ }
  if (!lab) return;
  const themeId = new URLSearchParams(location.search).get("theme") || "";
  window.NOOK_THEME_LAB_THEME_ID = themeId;
  const ok = installThemeLab(window, { sample: window.THEME_LAB_SAMPLE || {}, copyKeys: COPY_KEYS, themeId });
  if (ok) {
    window.NOOK_THEME_LAB = true;
  } else {
    // Ersatz greift nicht: App wuerde auf dem ECHTEN Speicher laufen. Notbremse:
    // alle Schreibzugriffe dieses Fensters (eigenes Storage.prototype) zu No-Ops machen.
    window.NOOK_THEME_LAB_FAILED = true;
    try {
      const P = window.Storage && window.Storage.prototype;
      if (P) { P.setItem = function () {}; P.removeItem = function () {}; P.clear = function () {}; }
    } catch (e) { /* letzte Verteidigung sind die Gates (Sync/SW/Backup) */ }
  }
})();
