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
// 0) ZEIT-KONSTANTEN
// =========================

// Millisekunden pro Tag — zentrale Konstante statt verstreuter 86400000-Literale
const MS_PER_DAY = 86400000;

// =========================
// 1) FARBSYSTEM
// =========================

// Basis-Palette für Farbvorschläge (bisher: GUIDE_PALETTE_HEX)
const HUB_PALETTE_HEX = ['#C9D6BC', '#ECDFCB', '#DAD3EA', '#F2E6AE', '#E2DED4', '#E4CBE6'];

// Persistente, hub-weite Nutzerfarben-Bibliothek.
// Migration: übernimmt alte Guides-only-Bibliothek beim ersten Laden, falls vorhanden.
let hubUserColors = DB.get('hubUserColors', DB.get('guideUserColors', []));
function saveHubUserColors() { DB.set('hubUserColors', hubUserColors); }

// Migration: alte Einträge waren reine Hex-Strings ohne Theme-Herkunft.
// Werden zu Objekten mit baseTheme überführt — 'light' entspricht dem
// bisherigen (einzigen) Verhalten, damit sich für bestehende Farben
// optisch nichts ändert, solange der Light→Dark-Toggle aktiv ist.
if (hubUserColors.some(c => typeof c === 'string')) {
  hubUserColors = hubUserColors.map(c => typeof c === 'string'
    ? { hex: c, baseTheme: 'light' }
    : c);
  saveHubUserColors();
}

// Standardverhalten für die Auto-Anpassung neu erstellter Farben (Einstellungen
// → Persönliche Farben verwalten → Theme-Anpassung). Wirkt nur auf Farben, die
// AB JETZT gespeichert werden — bestehende Farben behalten ihre eigenen Werte.
let colorAutoAdjustSettings = DB.get('colorAutoAdjust', { lightToDark: true, darkToLight: false });
function saveColorAutoAdjustSettings() { DB.set('colorAutoAdjust', colorAutoAdjustSettings); }

/**
 * Liefert das baseTheme einer Farbe aus der Bibliothek, oder 'light' als
 * Default für Farben, die nicht in der Bibliothek gespeichert sind (z.B.
 * direkt über den nativen Picker gewählt, nie hinzugefügt). baseTheme ist
 * die feste Herkunft einer Farbe und ändert sich nie nachträglich — ob
 * automatisch angepasst wird, entscheidet live der globale Toggle in den
 * Einstellungen (colorAutoAdjustSettings), nicht ein eingefrorener Wert.
 * @param {string} hex
 * @returns {'light'|'dark'}
 */
function findColorBaseTheme(hex) {
  const entry = hubUserColors.find(c => c.hex === hex);
  return (entry && entry.baseTheme) || 'light';
}

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
  hubUserColors.forEach(entry => {
    const hex = entry.hex;
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
        hubUserColors = hubUserColors.filter(c => c.hex !== hex);
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
      if (!current || hubUserColors.some(c => c.hex === current)) return;
      // Theme, in dem die Farbe entstanden ist, wird automatisch erkannt —
      // der Nutzer muss es nicht selbst auswählen. Ob automatisch angepasst
      // wird, ist kein Snapshot mehr, sondern wird bei jeder Anzeige live
      // aus dem Settings-Toggle gelesen (computeUserColorVars).
      const baseTheme = isDarkThemeActive() ? 'dark' : 'light';
      hubUserColors.push({ hex: current, baseTheme });
      saveHubUserColors();
      renderColorLibrary(ids.libraryId, { selected: current, gradient: useGradient, onSelect: setValue });
    });
  }

  setValue(current);
  return { getValue: () => current, setValue };
}

// =========================
// 1b) THEME-AWARE NUTZERFARBEN — --user-color-*
// Zentrale Berechnung abgeleiteter Darstellungsfarben aus einer einzigen
// vom Nutzer gewählten Basisfarbe (Pinnwand, Kalender, Guides, künftige Tabs).
// Die Basisfarbe bleibt immer die Ausgangsfarbe — das aktive Theme leitet
// daraus nur Hintergrund/Rand/Hover/Fokus/Text/Schatten ab. Komponenten
// setzen diese Werte per applyUserColorVars() als CSS-Variablen auf ein
// Element und müssen selbst nie wissen, ob Light- oder Dark-Theme aktiv ist.
// =========================

function isDarkThemeActive() {
  return document.documentElement.getAttribute('data-theme-family') === 'dark';
}

function hexToRgbArr(hex) {
  if (!hex || hex[0] !== '#') return [0, 0, 0];
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

function relativeLuminance(rgb) {
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
}

// Mischt zwei Hex-Farben (t = Anteil hexB, 0..1)
function mixHex(hexA, hexB, t) {
  const a = hexToRgbArr(hexA), b = hexToRgbArr(hexB);
  const mix = a.map((c, i) => Math.round(c * (1 - t) + b[i] * t));
  return '#' + mix.map(v => v.toString(16).padStart(2, '0')).join('');
}

// Neutraler Dunkel-Ton, an --surface-3 (Dark) angelehnt — Ziel für die
// Light→Dark-Mischung, damit Nutzerfarben sich wie Teil der Dark-UI anfühlen.
const USER_COLOR_DARK_NEUTRAL = '#26221B';
// Pendant für die umgekehrte Richtung: an --surface-3 (Light) angelehnt —
// Ziel für die Dark→Light-Mischung.
const USER_COLOR_LIGHT_NEUTRAL = '#EAE5DA';

/**
 * Berechnet die vollständige --user-color-* Variablen-Menge aus einer
 * Basisfarbe. Berücksichtigt, in welchem Theme die Farbe ursprünglich
 * erstellt wurde (baseTheme, fest pro Farbe) und ob automatisch fürs
 * jeweils andere Theme angepasst werden soll — das entscheidet LIVE der
 * globale Toggle in den Einstellungen (colorAutoAdjustSettings), damit ein
 * Umschalten sofort auf alle betroffenen Farben wirkt, nicht nur auf neue.
 * Eine Farbe wird NUR verändert, wenn sie im jeweils anderen Theme als dem
 * aktuellen angezeigt wird UND der zugehörige Toggle aktiv ist. Andernfalls
 * bleibt sie in ihrer "nativen" Darstellung (so, wie für ihr eigenes
 * baseTheme gedacht) — auch wenn das aktuelle Theme ein anderes ist.
 * @param {string} hex        Nutzer-Basisfarbe, z.B. "#C9D6BC"
 * @param {boolean} [forceDark]  optional erzwingen statt automatisch erkennen
 * @returns {{bg:string, border:string, hover:string, focus:string, text:string, shadow:string}}
 */
function computeUserColorVars(hex, forceDark) {
  if (!hex || hex[0] !== '#') hex = HUB_PALETTE_HEX[0];
  const currentIsDark = typeof forceDark === 'boolean' ? forceDark : isDarkThemeActive();
  const baseIsDark = findColorBaseTheme(hex) === 'dark';
  const globalAutoAdjust = baseIsDark ? colorAutoAdjustSettings.darkToLight : colorAutoAdjustSettings.lightToDark;
  const adjust = globalAutoAdjust && baseIsDark !== currentIsDark;

  // Fall 1: Light-nativ — im Light Mode erstellt, wird auch so gezeigt
  // (entweder weil aktuell Light aktiv ist, oder weil im Dark Mode keine
  // Auto-Anpassung gewünscht ist). Originalfarbe bleibt Fläche.
  if (!baseIsDark && !adjust) {
    const bg = hex;
    return {
      bg,
      border: hexDarken(bg, 0.16),
      hover:  hexDarken(bg, 0.06),
      focus:  hexDarken(bg, 0.30),
      text:   relativeLuminance(hexToRgbArr(bg)) > 0.6 ? '#3D3626' : '#F5F1E6',
      shadow: hexToRgba(hex, 0.25),
    };
  }

  // Fall 2: Light → Dark automatisch angepasst (bisherige Formel, unverändert).
  // Basisfarbe wird Richtung neutrales Dark-UI-Grau gemischt → dunklere,
  // entsättigte Fläche. Rand/Hover/Fokus bleiben näher an der Originalfarbe
  // und wirken dadurch heller als die Fläche.
  if (!baseIsDark && adjust) {
    const bg     = mixHex(hex, USER_COLOR_DARK_NEUTRAL, 0.62);
    const border = mixHex(hex, USER_COLOR_DARK_NEUTRAL, 0.28);
    const hover  = mixHex(hex, USER_COLOR_DARK_NEUTRAL, 0.42);
    const focus  = mixHex(hex, USER_COLOR_DARK_NEUTRAL, 0.18);
    return {
      bg, border, hover, focus,
      text:   relativeLuminance(hexToRgbArr(bg)) > 0.5 ? '#221E18' : '#F0EAD8',
      shadow: 'rgba(0,0,0,0.35)',
    };
  }

  // Fall 3: Dark-nativ — im Dark Mode erstellt, wird auch so gezeigt. Bleibt
  // nah am Original (der Nutzer hat die Farbe bereits für eine dunkle Fläche
  // gewählt) statt sie wie Fall 2 zusätzlich abzudunkeln.
  if (baseIsDark && !adjust) {
    const bg = hex;
    return {
      bg,
      border: mixHex(hex, '#FFFFFF', 0.22),
      hover:  mixHex(hex, '#FFFFFF', 0.10),
      focus:  mixHex(hex, '#FFFFFF', 0.34),
      text:   relativeLuminance(hexToRgbArr(bg)) > 0.5 ? '#221E18' : '#F0EAD8',
      shadow: 'rgba(0,0,0,0.35)',
    };
  }

  // Fall 4: Dark → Light automatisch angepasst. Basisfarbe wird Richtung
  // neutralen Light-UI-Ton gemischt → aufgehellte, für helle Flächen
  // passende Fläche, analog zu Fall 2 in umgekehrter Richtung.
  const bg     = mixHex(hex, USER_COLOR_LIGHT_NEUTRAL, 0.55);
  const border = mixHex(hex, USER_COLOR_LIGHT_NEUTRAL, 0.20);
  const hover  = mixHex(hex, USER_COLOR_LIGHT_NEUTRAL, 0.35);
  const focus  = mixHex(hex, USER_COLOR_LIGHT_NEUTRAL, 0.10);
  return {
    bg, border, hover, focus,
    text:   relativeLuminance(hexToRgbArr(bg)) > 0.6 ? '#3D3626' : '#F5F1E6',
    shadow: hexToRgba(hex, 0.25),
  };
}

/**
 * Berechnet computeUserColorVars() und setzt das Ergebnis als
 * --user-color-bg/-border/-hover/-focus/-text/-shadow direkt auf das Element.
 * @param {HTMLElement} el
 * @param {string} hex
 * @returns {object|null} die berechneten Werte, oder null wenn kein Element
 */
function applyUserColorVars(el, hex) {
  if (!el) return null;
  const v = computeUserColorVars(hex);
  el.style.setProperty('--user-color-bg', v.bg);
  el.style.setProperty('--user-color-border', v.border);
  el.style.setProperty('--user-color-hover', v.hover);
  el.style.setProperty('--user-color-focus', v.focus);
  el.style.setProperty('--user-color-text', v.text);
  el.style.setProperty('--user-color-shadow', v.shadow);
  return v;
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
