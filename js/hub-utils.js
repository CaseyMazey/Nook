// =========================
// HUB-UTILS
// Geteilte Funktionen für den gesamten Personal Hub — tab-unabhängig.
// Wird direkt nach main.js geladen (braucht DB), vor allen Tab-Skripten.
//
// Enthält:
//   1) Farbsystem  — Palette, speicherbare Nutzerfarben, Picker-Widget
//   2) Codeblock-Renderer — wiederverwendbare ```code```-Darstellung
// =========================

// =========================
// 1) FARBSYSTEM
// =========================

// Basis-Palette für Farbvorschläge (bisher: GUIDE_PALETTE_HEX)
const HUB_PALETTE_HEX = ['#C9D6BC', '#ECDFCB', '#DAD3EA', '#F2E6AE', '#E2DED4', '#E4CBE6'];

// Persistente, hub-weite Nutzerfarben-Bibliothek.
// Migration: übernimmt alte Guides-only-Bibliothek beim ersten Laden, falls vorhanden.
let hubUserColors = DB.get('hubUserColors', DB.get('guideUserColors', []));
function saveHubUserColors() { DB.set('hubUserColors', hubUserColors); }

// Farbe abdunkeln (0..1 Faktor) — für Verlauf-Endpunkte
function hexDarken(hex, factor) {
  let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  r = Math.round(r * (1 - factor)); g = Math.round(g * (1 - factor)); b = Math.round(b * (1 - factor));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
// Sanfter Verlauf aus einer Hex-Farbe (bisher: hexToBookGradient)
function hexToGradient(hex) {
  return 'linear-gradient(160deg, ' + hex + ' 0%, ' + hexDarken(hex, 0.12) + ' 100%)';
}

/**
 * Rendert die Swatch-Reihe der gespeicherten Nutzerfarben in einen Container.
 * @param {string} containerId  ID des Ziel-Elements
 * @param {object} opts
 *   selected {string}   aktuell gewählte Hex-Farbe (für aktive Markierung)
 *   onSelect {function} wird mit (hex) aufgerufen, wenn eine Swatch geklickt wird
 *   gradient {boolean}  Verlauf statt flacher Farbe (default: true)
 *   deletable {boolean} zeigt das "✕"-Entfernen-Icon auf jeder Swatch (default: false).
 *                       Nur die zentrale Farbverwaltung in den Einstellungen setzt dies auf true —
 *                       normale Picker (Karten, Guides, Kalender) dienen nur zum Auswählen/Speichern.
 */
function renderColorLibrary(containerId, opts = {}) {
  const lib = document.getElementById(containerId);
  if (!lib) return;
  const useGradient = opts.gradient !== false;
  const deletable = opts.deletable === true;
  lib.innerHTML = '';
  hubUserColors.forEach(hex => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hub-color-swatch' + (hex === opts.selected ? ' active' : '');
    btn.style.background = useGradient ? hexToGradient(hex) : hex;
    btn.title = hex;
    btn.addEventListener('click', () => opts.onSelect && opts.onSelect(hex));

    if (deletable) {
      const del = document.createElement('span');
      del.className = 'hub-color-del';
      del.textContent = '✕';
      del.title = 'Entfernen';
      del.addEventListener('click', e => {
        e.stopPropagation();
        hubUserColors = hubUserColors.filter(c => c !== hex);
        saveHubUserColors();
        renderColorLibrary(containerId, opts);
        if (opts.onDelete) opts.onDelete();
      });
      btn.appendChild(del);
    }
    lib.appendChild(btn);
  });
}

/**
 * Verkabelt einen kompletten Farb-Picker-Block (natives <input type="color">
 * + Vorschau + "Zur Bibliothek hinzufügen"-Button + gespeicherte Farben).
 * Gleiche Bausteine wie bisher im Guides-Kategorie-Modal, jetzt tab-unabhängig.
 *
 * @param {object} ids  { pickerId, previewId, addBtnId, libraryId }
 * @param {object} opts { initial, gradient, onChange }
 * @returns {object} { getValue, setValue }
 */
function initColorPickerWidget(ids, opts = {}) {
  let current = opts.initial || HUB_PALETTE_HEX[0];
  const useGradient = opts.gradient !== false;

  function applyPreview(hex) {
    const picker = document.getElementById(ids.pickerId);
    if (picker) picker.value = hex;
    const preview = document.getElementById(ids.previewId);
    if (preview) preview.style.background = useGradient ? hexToGradient(hex) : hex;
  }

  function setValue(hex) {
    current = hex;
    applyPreview(hex);
    renderColorLibrary(ids.libraryId, { selected: current, gradient: useGradient, onSelect: setValue });
    if (opts.onChange) opts.onChange(hex);
  }

  const picker = document.getElementById(ids.pickerId);
  if (picker) {
    picker.addEventListener('input', () => setValue(picker.value));
    picker.addEventListener('change', () => setValue(picker.value));
  }

  const addBtn = document.getElementById(ids.addBtnId);
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (!current || hubUserColors.includes(current)) return;
      hubUserColors.push(current);
      saveHubUserColors();
      renderColorLibrary(ids.libraryId, { selected: current, gradient: useGradient, onSelect: setValue });
    });
  }

  setValue(current);
  return { getValue: () => current, setValue };
}

// =========================
// 2) CODEBLOCK-RENDERER
// =========================
// Baut das HTML für einen ```code```-Block. Bookmark-/Feature-Buttons sind
// optional (nur Guides nutzt sie) — Aufrufer ohne diese Optionen bekommen
// einen schlanken Block mit nur Sprache + Copy-Button (z.B. künftig der
// Schreibtisch-Kartenstil "Code").
//
// @param {string} code
// @param {string} lang
// @param {object} opts { blockId, bookmarked, bookmarkBtnHtml, featureBtnHtml }
function renderCodeBlock(code, lang, opts = {}) {
  const idAttr = opts.blockId ? `id="${opts.blockId}"` : '';
  const bmBtn = opts.bookmarkBtnHtml || '';
  const featBtn = opts.featureBtnHtml || '';
  const langLabel = `<span class="guide-code-lang">${lang || 'code'}</span>`;
  const blockClass = 'guide-code-block' + (opts.bookmarked ? ' bookmarked' : '');
  return `<div class="${blockClass}" ${idAttr}><div class="guide-code-header">${langLabel}<div class="guide-code-header-right">${featBtn}${bmBtn}<button class="guide-copy-btn" onclick="copyCode(this)"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 11V3a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Copy</button></div></div><pre class="guide-code-pre"><code>${code.trimEnd()}</code></pre></div>`;
}

// Copy-Button-Handler (global, da onclick-Attribute ihn direkt aufrufen)
window.copyCode = function(btn) {
  const code = btn.closest('.guide-code-block').querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Kopiert!`;
    btn.style.color = 'var(--budget-income)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 1800);
  });
};
