// =========================
// THEME-BUILDER — eigene Farbschemata (Einstellungen > Darstellung)
// Erweitert die bestehende Theme-Engine (main.js: THEME_FAMILY/setTheme/
// theme) um nutzerdefinierte Themes, statt eine eigene parallele
// Theme-Engine mitzubringen. Ein eigenes Theme ist dafür einfach ein
// weiterer gültiger `theme`-Wert (seine ID), dessen Familie (hell/dunkel)
// zusätzlich in customThemes steht, weil sie nicht in THEME_FAMILY passt.
//
// Nur Hintergrund/Fläche/Text/Akzent sind wählbar — Prioritäts-, Budget-
// und Code-Panel-Farben bleiben bewusst wie bei den 6 eingebauten Themes
// themeübergreifend gleich (siehe Kommentar "Markenidentität" in
// main.css) und werden hier nicht überschrieben; sie kommen weiterhin aus
// [data-theme-family] bzw. :root.
//
// Lädt nach main.js/settings.js (siehe index.html) — nutzt deren
// DB/theme/THEME_FAMILY/setTheme sowie escHtml() und hubConfirm().
// =========================

let customThemes = DB.get('customThemes', []); // [{id, name, family, vars}]

// ── Basisfarben der 6 eingebauten Themes für die "Vorlage"-Auswahl im
//    Builder — bewusst eine kleine, eigenständige Kopie (nur die 4 Werte,
//    die der Builder anbietet) statt sie live per getComputedStyle
//    auszulesen: ist gerade selbst ein eigenes Theme aktiv, würden dessen
//    Inline-Variablen die ausgelesenen Werte verfälschen. Bei Änderungen
//    an den Grundfarben in main.css bitte hier mitziehen. ──
const THEME_BASE_COLORS = {
  light:    { bg: '#efebe3', surface: '#fdfaf5', text: '#24211c', sage: '#6b7f58' },
  dark:     { bg: '#181817', surface: '#20201e', text: '#e6e3df', sage: '#728460' },
  midnight: { bg: '#121419', surface: '#141925', text: '#dde0e8', sage: '#728460' },
  forest:   { bg: '#131915', surface: '#16251b', text: '#dee7e1', sage: '#728460' },
  espresso: { bg: '#1a1815', surface: '#252019', text: '#ede3d8', sage: '#728460' },
  oled:     { bg: '#070707', surface: '#090909', text: '#e3e3e2', sage: '#728460' },
};

function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Alle CSS-Variablen, die ein eigenes Theme setzt — zum Aufräumen beim
// Wechsel weg von einem eigenen Theme (siehe applyCustomThemeVars()).
const CUSTOM_THEME_VAR_NAMES = [
  '--bg', '--bg-2', '--surface', '--surface-2', '--surface-3', '--dash-bg',
  '--text', '--text-2', '--text-3', '--border', '--border-strong', '--accent-soft',
  '--sage', '--sage-dark', '--sage-light', '--sage-bg', '--sage-border',
  '--event-color', '--event-color-bg',
];

// Aus den 4 gewählten Basisfarben werden die übrigen Variablen abgeleitet
// (color-mix() statt eigener Hex-Mischrechnung — dasselbe Muster wie
// bereits an anderer Stelle im Hub, z.B. .pdt-status-badge in
// projects.css). Deckt genau das ab, was auch die 6 eingebauten Themes
// pro Theme überschreiben (siehe main.css), plus den Akzent (Sage), der
// bei eigenen Themes bewusst mit anpassbar ist.
function deriveCustomThemeVars(picked) {
  const { bg, surface, text, sage } = picked;
  const mixDir = luminance(bg) < 128 ? 'white' : 'black'; // Richtung, in die -2/-3-Flächen vertieft werden
  return {
    '--bg': bg,
    '--bg-2': `color-mix(in srgb, ${bg} 95%, ${mixDir})`,
    '--surface': surface,
    '--surface-2': `color-mix(in srgb, ${surface} 95%, ${mixDir})`,
    '--surface-3': `color-mix(in srgb, ${surface} 88%, ${mixDir})`,
    '--dash-bg': `color-mix(in srgb, ${bg} 55%, ${surface})`,
    '--text': text,
    '--text-2': `color-mix(in srgb, ${text} 62%, ${bg})`,
    '--text-3': `color-mix(in srgb, ${text} 38%, ${bg})`,
    '--border': `color-mix(in srgb, ${text} 14%, transparent)`,
    '--border-strong': `color-mix(in srgb, ${text} 24%, transparent)`,
    '--accent-soft': `color-mix(in srgb, ${sage} 14%, ${surface})`,
    '--sage': sage,
    '--sage-dark': `color-mix(in srgb, ${sage} 78%, black)`,
    '--sage-light': `color-mix(in srgb, ${sage} 68%, white)`,
    '--sage-bg': `color-mix(in srgb, ${sage} 13%, transparent)`,
    '--sage-border': `color-mix(in srgb, ${sage} 30%, transparent)`,
    '--event-color': sage,
    '--event-color-bg': `color-mix(in srgb, ${sage} 13%, transparent)`,
  };
}

// ── Anwenden ──────────────────────────────────────────────────────────
// Von setTheme() (main.js) nach jedem Theme-Wechsel aufgerufen: räumt
// zunächst evtl. gesetzte Inline-Variablen eines vorherigen eigenen
// Themes weg, und legt — falls das jetzt aktive Theme ein eigenes ist —
// dessen Variablen neu an. Für die 6 eingebauten Themes bleibt es beim
// Aufräumen (ihre Farben kommen komplett aus main.css).
function applyCustomThemeVars() {
  const root = document.documentElement;
  CUSTOM_THEME_VAR_NAMES.forEach(v => root.style.removeProperty(v));
  const ct = customThemes.find(t => t.id === theme);
  if (ct) Object.entries(ct.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

// ── Live-Vorschau im Builder ──────────────────────────────────────────
// Wendet die aktuell im Formular stehenden Farben direkt auf den ganzen
// Hub an (nicht nur eine kleine Vorschau-Karte) — der Dialog selbst nutzt
// dieselben Variablen, ist also Teil der eigenen Vorschau. closeThemeBuilder()
// stellt danach das vorher aktive Theme wieder her.
function readPickedThemeColors() {
  return {
    bg:      document.getElementById('tb-bg').value,
    surface: document.getElementById('tb-surface').value,
    text:    document.getElementById('tb-text').value,
    sage:    document.getElementById('tb-sage').value,
  };
}
function livePreviewCustomTheme() {
  const picked = readPickedThemeColors();
  const vars = deriveCustomThemeVars(picked);
  document.documentElement.setAttribute('data-theme-family', luminance(picked.bg) < 128 ? 'dark' : 'light');
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
}

function setBuilderFieldsFromBase(base) {
  const c = THEME_BASE_COLORS[base] || THEME_BASE_COLORS.light;
  ['bg', 'surface', 'text', 'sage'].forEach(k => {
    document.getElementById('tb-' + k).value = c[k];
    document.getElementById('tb-' + k + '-hex').textContent = c[k];
  });
  livePreviewCustomTheme();
}

function openThemeBuilder() {
  const overlay = document.getElementById('theme-builder-overlay');
  if (!overlay) return;
  document.getElementById('tb-name').value = '';
  const base = THEME_BASE_COLORS[theme] ? theme : 'light';
  overlay.querySelectorAll('.tb-base-btn').forEach(b => b.classList.toggle('active', b.dataset.base === base));
  setBuilderFieldsFromBase(base);
  overlay.classList.remove('hidden');
  document.getElementById('tb-name').focus();
}

function closeThemeBuilder() {
  document.getElementById('theme-builder-overlay')?.classList.add('hidden');
  // Vorschau zurücknehmen — das tatsächlich aktive Theme wiederherstellen.
  document.documentElement.setAttribute('data-theme-family', themeFamily);
  applyCustomThemeVars();
}

function saveCustomTheme() {
  const nameInput = document.getElementById('tb-name');
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }

  const picked = readPickedThemeColors();
  const ct = {
    id: 'custom_' + Date.now(),
    name,
    family: luminance(picked.bg) < 128 ? 'dark' : 'light',
    vars: deriveCustomThemeVars(picked),
  };
  customThemes.push(ct);
  DB.set('customThemes', customThemes);

  document.getElementById('theme-builder-overlay').classList.add('hidden');
  setTheme(ct.id);
  if (typeof renderThemeSettings === 'function') renderThemeSettings();
}

async function deleteCustomTheme(id) {
  const ct = customThemes.find(t => t.id === id);
  if (!ct) return;
  const ok = await hubConfirm({
    title: 'Theme löschen?',
    message: `„${ct.name}" wird endgültig gelöscht.`,
    confirmText: 'Löschen',
    danger: true,
  });
  if (!ok) return;
  customThemes = customThemes.filter(t => t.id !== id);
  DB.set('customThemes', customThemes);
  setThemeBackground(id, null); // verwaistes Hintergrundbild (falls gesetzt) mit aufräumen
  if (theme === id) setTheme('light');
  // Der Sonne/Mond-Schnellumschalter (main.js: setDarkMode()) merkt sich
  // das zuletzt aktive Dark-Theme in lastDarkTheme, auch wenn es ein
  // eigenes war — ohne diesen Reset würde er nach dem Löschen versuchen,
  // zu einer nicht mehr existierenden Theme-ID zurückzukehren (fängt
  // setTheme() zwar ab und fällt auf Light zurück, wäre beim nächsten
  // Umschalten auf "dunkel" aber trotzdem die falsche Erwartung).
  if (typeof lastDarkTheme !== 'undefined' && lastDarkTheme === id) lastDarkTheme = 'dark';
  if (typeof renderThemeSettings === 'function') renderThemeSettings();
}

// ── Buttons im Theme-Picker (Einstellungen) ──────────────────────────
// Von renderThemeSettings() (settings.js) aufgerufen — gleiches Muster
// wie renderColorLibrary() dort für die persönlichen Farben. Eigene
// Theme-Buttons werden vor dem statischen "+ Eigenes Theme"-Button
// eingefügt, nutzen aber dieselbe .clock-type-btn-Optik wie die 6
// eingebauten Buttons.
function renderCustomThemeButtons() {
  const picker = document.getElementById('theme-picker');
  const addBtn = document.getElementById('theme-builder-open-btn');
  if (!picker || !addBtn) return;
  picker.querySelectorAll('.theme-picker-btn-custom').forEach(el => el.remove());

  customThemes.forEach(ct => {
    const btn = document.createElement('button');
    btn.className = 'clock-type-btn theme-picker-btn theme-picker-btn-custom' + (theme === ct.id ? ' active' : '');
    btn.dataset.themeValue = ct.id;
    btn.innerHTML = `${escHtml(ct.name)} <span class="bs-del theme-picker-del" data-id="${ct.id}" title="Löschen">✕</span>`;
    btn.addEventListener('click', e => {
      if (e.target.classList.contains('theme-picker-del')) {
        // stopPropagation: settings.js hat einen eigenen, delegierten
        // Klick-Listener auf #theme-picker, der jeden Klick innerhalb
        // eines .theme-picker-btn (auch hier drin verschachtelte Kind-
        // elemente wie dieses ×) als Theme-Auswahl behandelt. Ohne Stop
        // würde ein Löschen-Klick zusätzlich das Theme auswählen, bevor
        // der Bestätigungsdialog überhaupt aufgeht.
        e.stopPropagation();
        deleteCustomTheme(ct.id);
        return;
      }
      setTheme(ct.id);
      renderThemeSettings();
    });
    picker.insertBefore(btn, addBtn);
  });
}

// ── Hintergrundbild pro Theme (optional) ───────────────────────────────
// Ein Foto/Bild lässt sich für das jeweils AKTIVE Theme hinterlegen —
// eingebaut oder eigenes, beide nutzen denselben Mechanismus. Eigener
// DB-Key statt Teil von customThemes[].vars, damit auch die 6
// eingebauten Themes eins bekommen können (data URL statt Datei-Pfad,
// da Nook rein clientseitig ohne Server läuft, siehe CLAUDE.md).
let themeBackgrounds = DB.get('themeBackgrounds', {}); // { [themeKey]: {data,name,size,dim} }

// Vor dem Speichern in localStorage per <canvas> verkleinert/neu kodiert
// (JPEG) — ein Foto direkt aus der Handykamera kann sonst locker 5-15MB
// als data-URL sein und das localStorage-Limit sprengen (sowie den Rest
// des Backups/Exports unnötig aufblähen, siehe settings.js BACKUP_*).
const BG_IMAGE_MAX_DIMENSION = 1920;
const BG_IMAGE_JPEG_QUALITY = 0.82;
function downscaleImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, BG_IMAGE_MAX_DIMENSION / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', BG_IMAGE_JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function getThemeBackground(key) { return themeBackgrounds[key] || null; }
function setThemeBackground(key, bg) {
  if (bg) themeBackgrounds[key] = bg; else delete themeBackgrounds[key];
  DB.set('themeBackgrounds', themeBackgrounds);
}

// Von setTheme() (main.js) nach jedem Theme-Wechsel aufgerufen, plus
// einmal beim Laden (siehe Init unten) — zeigt/versteckt das Bild des
// gerade aktiven Themes und setzt/entfernt die .has-bg-image-Klasse
// (siehe main.css für die dadurch aktivierte Frosted-Glass-Optik).
function applyThemeBackground() {
  let overlay = document.getElementById('bg-image-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bg-image-overlay';
    document.body.prepend(overlay);
  }
  const bg = getThemeBackground(theme);
  if (!bg || !bg.data) {
    document.body.classList.remove('has-bg-image');
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundRepeat = '';
    document.body.style.backgroundAttachment = '';
    overlay.style.opacity = '0';
    return;
  }
  document.body.classList.add('has-bg-image');
  document.body.style.backgroundImage = `url(${bg.data})`;
  document.body.style.backgroundRepeat = 'no-repeat';
  document.body.style.backgroundAttachment = 'fixed';
  if (bg.size === 'contain') {
    document.body.style.backgroundSize = 'contain';
    document.body.style.backgroundPosition = 'center';
  } else if (bg.size === 'center') {
    document.body.style.backgroundSize = 'auto';
    document.body.style.backgroundPosition = 'center center';
  } else {
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
  }
  overlay.style.opacity = ((bg.dim ?? 40) / 100).toFixed(2);
}

// Von renderThemeSettings() (settings.js) aufgerufen, gleiches Muster wie
// renderCustomThemeButtons() — zeigt den Zustand für das AKTUELLE Theme.
function renderBgImageSettings() {
  const toggle = document.getElementById('setting-bg-image');
  if (!toggle) return;
  const bg = getThemeBackground(theme) || {};
  const hasData = !!bg.data;
  toggle.checked = hasData;
  document.getElementById('bg-image-options-row').classList.toggle('hidden', !hasData);
  document.getElementById('bg-image-dim-row').classList.toggle('hidden', !hasData);
  document.getElementById('bg-image-filename').textContent = bg.name || 'Kein Bild gewählt';
  document.getElementById('bg-image-size').value = bg.size || 'cover';
  document.getElementById('bg-dim-slider').value = bg.dim ?? 40;
  document.getElementById('bg-dim-label').textContent = (bg.dim ?? 40) + '%';
}

document.getElementById('setting-bg-image')?.addEventListener('change', e => {
  if (e.target.checked) { document.getElementById('bg-image-file-input').click(); return; }
  setThemeBackground(theme, null);
  applyThemeBackground();
  renderBgImageSettings();
});
document.getElementById('bg-image-pick-btn')?.addEventListener('click', () => {
  document.getElementById('bg-image-file-input').click();
});
document.getElementById('bg-image-clear-btn')?.addEventListener('click', () => {
  setThemeBackground(theme, null);
  applyThemeBackground();
  renderBgImageSettings();
});
document.getElementById('bg-image-file-input')?.addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let dataUrl;
  try { dataUrl = await downscaleImageFile(file); }
  catch { alert('Dieses Bild konnte nicht geladen werden.'); return; }
  const existing = getThemeBackground(theme) || {};
  setThemeBackground(theme, { data: dataUrl, name: file.name, size: existing.size || 'cover', dim: existing.dim ?? 40 });
  applyThemeBackground();
  renderBgImageSettings();
});
document.getElementById('bg-image-size')?.addEventListener('change', e => {
  const bg = getThemeBackground(theme);
  if (!bg) return;
  bg.size = e.target.value;
  setThemeBackground(theme, bg);
  applyThemeBackground();
});
document.getElementById('bg-dim-slider')?.addEventListener('input', e => {
  const bg = getThemeBackground(theme);
  if (!bg) return;
  bg.dim = parseInt(e.target.value, 10);
  document.getElementById('bg-dim-label').textContent = bg.dim + '%';
  setThemeBackground(theme, bg);
  applyThemeBackground();
});

// ── Events ────────────────────────────────────────────────────────────
document.getElementById('theme-builder-open-btn')?.addEventListener('click', openThemeBuilder);
document.getElementById('theme-builder-close')?.addEventListener('click', closeThemeBuilder);
document.getElementById('theme-builder-cancel')?.addEventListener('click', closeThemeBuilder);
document.getElementById('theme-builder-save')?.addEventListener('click', saveCustomTheme);
document.getElementById('theme-builder-overlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('theme-builder-overlay')) closeThemeBuilder();
});
document.addEventListener('keydown', e => {
  const overlay = document.getElementById('theme-builder-overlay');
  if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) closeThemeBuilder();
});
document.querySelectorAll('#tb-base-btns .tb-base-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tb-base-btns .tb-base-btn').forEach(b => b.classList.toggle('active', b === btn));
    setBuilderFieldsFromBase(btn.dataset.base);
  });
});
['bg', 'surface', 'text', 'sage'].forEach(k => {
  const inp = document.getElementById('tb-' + k);
  inp?.addEventListener('input', () => {
    document.getElementById('tb-' + k + '-hex').textContent = inp.value;
    livePreviewCustomTheme();
  });
});

// ── Init ──────────────────────────────────────────────────────────────
// Falls beim Laden bereits ein eigenes Theme aktiv ist (main.js hat zu
// diesem Zeitpunkt schon data-theme/-family über den themeFamily-Fallback
// korrekt gesetzt, siehe dort) — jetzt zusätzlich dessen tatsächliche
// Farbwerte anwenden.
applyCustomThemeVars();
applyThemeBackground();
