// =============================================================
// THEME-ENGINE.JS — Eigene Themes, Hintergrundbilder, Grafik-Themes
// Übernommen aus Core (Fork von Nook, js/theme-engine.js) und an Nook
// angepasst; ersetzt den früheren, einfacheren js/theme-builder.js.
//
// Lädt nach main.js/hub-utils.js/settings.js (siehe index.html) — nutzt
// DB/theme/THEME_FAMILY/setTheme/hexToRgba (main.js), mixHex/hubConfirm
// (hub-utils.js) und escHtml (settings.js). main.js ruft nach jedem
// Theme-Wechsel applyThemeEngine(theme) auf (typeof-Guard), die 6
// eingebauten Themes funktionieren dadurch auch ohne diese Datei.
//
// Zuständigkeiten:
//  - Eigene Themes: Seitenhintergrund, Karten, Navigation, Modals, Text,
//    Rahmen, Akzent, Schriftart, Schriftgröße, Kartendurchlässigkeit —
//    die restlichen CSS-Variablen werden abgeleitet (deriveThemeVars()).
//    Prioritäts-, Budget- und Code-Panel-Farben bleiben bewusst
//    themeübergreifend gleich (siehe "Markenidentität" in main.css).
//  - Hintergrundbild pro Theme: eigene Themes tragen es selbst (ct.bg),
//    Cozy Tag/Nacht (light/dark) über themeBackgrounds[id]. Eigene Bilder
//    werden verkleinert als data-URL gespeichert (wie bisher in Nook) —
//    bewusst NICHT in IndexedDB wie in Core, damit sie weiterhin im
//    Backup/Export (settings.js) enthalten sind.
//  - Grafik-Themes (GRAPHICS_THEMES): Icon, Hintergrund, saisonale
//    Kalenderbilder und Start-Banner (Tag/Nacht) als fertige Sets. Die
//    CORE-Logos aus Core sind bewusst NICHT übernommen (fremdes Branding),
//    die Sidebar zeigt weiterhin "nook.".
// =============================================================

// ── Eingebaute Themes: Anzeige-Metadaten für die "Vorlage"-Leiste im
//    Editor, NICHT die CSS-Kaskade selbst (die bleibt in main.css) —
//    bewusst eine Kopie der literalen Werte statt getComputedStyle, weil
//    ein gerade aktives eigenes Theme die ausgelesenen Werte verfälschen
//    würde. Bei Änderungen an den Grundfarben in main.css hier mitziehen.
const THEME_REGISTRY = [
  { id: 'light', label: 'Cozy',         core: { bg: '#efebe3', surface: '#fdfaf5', nav: '#fdfaf5', modal: '#fdfaf5', text: '#24211c', border: '#786541', accent: '#6b7f58', quicknote: '#f9f5dc', highlight: '#ebe4d4' } },
  { id: 'dark',  label: 'Cozy (Nacht)', core: { bg: '#181817', surface: '#20201e', nav: '#20201e', modal: '#20201e', text: '#e6e3df', border: '#cbc8c2', accent: '#728460', quicknote: '#272510', highlight: '#383733' } },
];

// Alle CSS-Variablen, die ein eigenes Theme inline auf <html> setzt — zum
// Aufräumen beim Wechsel weg von einem eigenen Theme.
const CUSTOM_THEME_VARS = [
  '--bg', '--bg-2', '--surface', '--surface-2', '--surface-3', '--surface-solid', '--dash-bg',
  '--border', '--border-strong',
  '--text', '--text-2', '--text-3', '--accent-soft',
  '--sage', '--sage-dark', '--sage-light', '--sage-bg', '--sage-border',
  '--event-color', '--event-color-bg',
  '--quicknote-bg', '--quicknote-line', '--quicknote-text', '--highlight-bg', '--user-color-neutral',
  '--core-nav-bg', '--core-modal-bg', '--core-card-opacity',
  '--font', '--font-heading', '--nav-font-scale', '--theme-font-scale', '--mono',
];

// =========================================================================
// SCHRIFTART
// --font ist die zentrale Font-Variable aus main.css. Eigene Themes
// überschreiben zusätzlich --mono (Zahlen/Zeiten), damit die gewählte
// Schrift überall greift — echte Code-Darstellung hängt stattdessen an
// --core-code-font (main.css), die nie überschrieben wird.
// Die Google Fonts ("Modern"/"Exotisch") und die eigenen Font-Dateien
// werden erst geladen, wenn sie gebraucht werden (Editor geöffnet oder
// ein eigenes Theme nutzt sie) — nicht bei jedem Seitenaufruf.
// =========================================================================
const FONT_CATEGORIES = [
  { label: 'Standard', fonts: [
    { label: 'Nook Standard (DM Sans)', stack: "'DM Sans', system-ui, sans-serif" },
  ]},
  { label: 'Klassisch', fonts: [
    { label: 'Arial',            stack: "Arial, Helvetica, sans-serif" },
    { label: 'Georgia',          stack: "Georgia, 'Times New Roman', serif" },
    { label: 'Verdana',          stack: "Verdana, Geneva, sans-serif" },
    { label: 'Trebuchet MS',     stack: "'Trebuchet MS', sans-serif" },
    { label: 'Times New Roman',  stack: "'Times New Roman', Times, serif" },
    { label: 'Courier New',      stack: "'Courier New', Courier, monospace" },
  ]},
  { label: 'Modern', fonts: [
    { label: 'Inter',      stack: "'Inter', sans-serif" },
    { label: 'Montserrat', stack: "'Montserrat', sans-serif" },
    { label: 'Poppins',    stack: "'Poppins', sans-serif" },
    { label: 'Roboto',     stack: "'Roboto', sans-serif" },
  ]},
  { label: 'Exotisch', fonts: [
    { label: 'Orbitron (Sci-Fi)',              stack: "'Orbitron', sans-serif" },
    { label: 'Cinzel (Mystic)',                stack: "'Cinzel', serif" },
    { label: 'UnifrakturCook (Gothic)',        stack: "'UnifrakturCook', cursive" },
    { label: 'Press Start 2P (Pixel)',         stack: "'Press Start 2P', monospace" },
    { label: 'Bangers (Comic)',                stack: "'Bangers', cursive" },
    { label: 'Permanent Marker (Handschrift)', stack: "'Permanent Marker', cursive" },
  ]},
  { label: 'Fantasy', fonts: [
    { label: 'Alegreya (Buch, gut lesbar)', stack: "'Alegreya', Georgia, serif" },
    { label: 'Almendra (Mittelalter)',      stack: "'Almendra', Georgia, serif" },
    { label: 'Rubik Dirt (Endzeit)',        stack: "'Rubik Dirt', system-ui, sans-serif" },
  ]},
];
const DEFAULT_FONT_STACK = FONT_CATEGORIES[0].fonts[0].stack;

// Gleicher CDN wie DM Sans/DM Mono in index.html, alle SIL Open Font License.
const THEME_WEB_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Orbitron:wght@400;700&family=Cinzel:wght@400;600&family=UnifrakturCook:wght@700&family=Press+Start+2P&family=Bangers&family=Permanent+Marker&family=Alegreya:ital,wght@0,400;0,500;0,700;1,400&family=Almendra:wght@400;700&family=Rubik+Dirt&display=swap';

// Eigene Font-Dateien aus assets/fonts/ — nur frei lizenzierte Schriften,
// siehe assets/fonts/README.md. Keine automatische Erkennung (unter
// file:// gibt es kein Verzeichnis-Listing), jede Datei einmal eintragen.
const CUSTOM_FONT_FILES = [
  { family: 'Blackwood Castle', source: 'assets/fonts/Blackwood-Castle.ttf', weight: '400', style: 'normal' },
  { family: "Coraline's Cat", source: 'assets/fonts/Coralines-Cat.ttf', weight: '400', style: 'normal' },
  { family: 'Cubic',          source: 'assets/fonts/cubic.ttf',         weight: '400', style: 'normal' },
  { family: 'Dune Rise',      source: 'assets/fonts/Dune_Rise.ttf',     weight: '400', style: 'normal' },
  { family: 'Help Me',        source: 'assets/fonts/HelpMe.ttf',        weight: '400', style: 'normal' },
  { family: 'Klaxon Crunchy', source: 'assets/fonts/Klaxon-Crunchy.otf', weight: '400', style: 'normal' },
  { family: 'Searle',         source: 'assets/fonts/Searle.ttf',        weight: '400', style: 'normal' },
];

function fontFormatFromPath(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }[ext] || 'truetype';
}

// Hängt den Google-Fonts-Link und die @font-face-Regeln der eigenen
// Dateien einmalig an <head> an — idempotent, beliebig oft aufrufbar.
function ensureThemeFontsLoaded() {
  if (!document.getElementById('theme-web-fonts')) {
    const link = document.createElement('link');
    link.id = 'theme-web-fonts';
    link.rel = 'stylesheet';
    link.href = THEME_WEB_FONTS_URL;
    document.head.appendChild(link);
  }
  if (!document.getElementById('theme-custom-fonts') && CUSTOM_FONT_FILES.length) {
    const styleEl = document.createElement('style');
    styleEl.id = 'theme-custom-fonts';
    styleEl.textContent = CUSTOM_FONT_FILES.map(f => `
@font-face {
  font-family: "${f.family}";
  src: url("${f.source}") format("${fontFormatFromPath(f.source)}");
  font-weight: ${f.weight || '400'};
  font-style: ${f.style || 'normal'};
  font-display: swap;
}`).join('\n');
    document.head.appendChild(styleEl);
  }
}

// Baut die Schriftart-Auswahl im Editor als eigenes Dropdown auf (bewusst
// kein natives <select> — Browser stellen font-family auf <option> nicht
// zuverlässig dar). #theme-builder-font (hidden) hält den gewählten Stack.
// key: 'font' (Fließtext) oder 'heading-font' (Überschriften; zusätzlich
// mit der Option „Wie Fließtext“ = leerer Wert).
function renderFontSelect(currentStack, key = 'font') {
  const hiddenInput = document.getElementById('theme-builder-' + key);
  const panel = document.getElementById('theme-builder-' + key + '-panel');
  if (!hiddenInput || !panel) return;
  const isHeading = key === 'heading-font';
  if (isHeading) currentStack = currentStack || '';
  else if (!currentStack) currentStack = hiddenInput.value || DEFAULT_FONT_STACK;
  panel.innerHTML = '';

  const addGroup = (label, fonts) => {
    const groupLabel = document.createElement('div');
    groupLabel.className = 'tb-font-group-label';
    groupLabel.textContent = label;
    panel.appendChild(groupLabel);
    fonts.forEach(f => {
      const opt = document.createElement('div');
      opt.className = 'tb-font-option' + (f.stack === currentStack ? ' active' : '');
      opt.textContent = f.label;
      opt.style.fontFamily = f.stack;
      opt.dataset.stack = f.stack;
      opt.addEventListener('click', () => selectThemeFont(f.stack, key));
      panel.appendChild(opt);
    });
  };

  if (isHeading) addGroup('Überschriften', [{ label: 'Wie Fließtext', stack: '' }]);
  FONT_CATEGORIES.forEach(cat => addGroup(cat.label, cat.fonts));
  const seen = new Set();
  const customFonts = [];
  CUSTOM_FONT_FILES.forEach(f => {
    if (seen.has(f.family)) return;
    seen.add(f.family);
    customFonts.push({ label: f.family, stack: `"${f.family}"` });
  });
  if (customFonts.length) addGroup('Eigene Fonts', customFonts);

  hiddenInput.value = currentStack;
  syncThemeFontTrigger(key);
}

function selectThemeFont(stack, key = 'font') {
  document.getElementById('theme-builder-' + key).value = stack;
  const panel = document.getElementById('theme-builder-' + key + '-panel');
  panel.querySelectorAll('.tb-font-option').forEach(el => {
    el.classList.toggle('active', el.dataset.stack === stack);
  });
  panel.classList.add('hidden');
  syncThemeFontTrigger(key);
  previewThemeBuilderLive();
}

function syncThemeFontTrigger(key = 'font') {
  const hiddenInput = document.getElementById('theme-builder-' + key);
  const triggerLabel = document.getElementById('theme-builder-' + key + '-trigger-label');
  const trigger = document.getElementById('theme-builder-' + key + '-trigger');
  if (!hiddenInput || !triggerLabel || !trigger) return;
  const stack = key === 'heading-font' ? hiddenInput.value : (hiddenInput.value || DEFAULT_FONT_STACK);
  const activeOpt = document.querySelector(`#theme-builder-${key}-panel .tb-font-option[data-stack="${CSS.escape(stack)}"]`);
  triggerLabel.textContent = activeOpt ? activeOpt.textContent : stack;
  trigger.style.fontFamily = stack;
}

// =========================================================================
// DATEN
// =========================================================================

// customThemes: [{ id, name, family, coreColors, cardOpacity, fontSize,
//   bg, calendar: {imageTheme}, startHeader: {banner}, branding: {theme},
//   questboard: {style}, pinboard: {style}, guides: {style}, forest: {style}, graphics: {mode, theme} }]
// themeBackgrounds: { [eingebautesThemeId]: {source, data, name, size, dim} }
let customThemes     = DB.get('customThemes', []);
let themeBackgrounds = DB.get('themeBackgrounds', {});
function saveCustomThemes()     { DB.set('customThemes', customThemes); }
function saveThemeBackgrounds() { DB.set('themeBackgrounds', themeBackgrounds); }

const DEFAULT_BUILDER_CORE = {
  bg: '#1a1815', surface: '#252119', nav: '#252119', modal: '#252119',
  text: '#ede6d8', border: '#f0dcb4', accent: '#728460', font: DEFAULT_FONT_STACK,
};

// Migration: Themes aus dem früheren Nook-Theme-Builder ({id, name,
// family, vars} mit 4 Basisfarben) → neues Format mit coreColors. Die 4
// Farben stecken unverändert in vars; Navigation/Modal = Fläche und
// Rahmen aus der Textfarbe entsprechen genau der alten Ableitung. Ein
// bisher separat in themeBackgrounds[ct.id] gespeichertes Hintergrundbild
// wandert ans Theme (ct.bg). Läuft bei jedem Laden (auch nach einem
// Backup-Restore mit altem Format), ändert aber nur Themes ohne coreColors.
(function migrateCustomThemesIfNeeded() {
  let changed = false;
  customThemes.forEach(ct => {
    if (ct.coreColors || !ct.vars) return;
    const v = ct.vars;
    ct.coreColors = {
      bg: v['--bg'], surface: v['--surface'], nav: v['--surface'], modal: v['--surface'],
      text: v['--text'], border: v['--text'], accent: v['--sage'], font: DEFAULT_FONT_STACK,
    };
    ct.cardOpacity = 100;
    ct.fontSize = 100;
    const oldBg = themeBackgrounds[ct.id];
    ct.bg = oldBg && oldBg.data ? Object.assign({ source: 'custom' }, oldBg) : { source: 'none', size: 'cover', dim: 40 };
    delete themeBackgrounds[ct.id];
    ct.calendar = { imageTheme: 'cozy' };
    ct.startHeader = { banner: 'none' };
    ct.branding = { theme: 'none' };
    ct.graphics = { mode: 'custom' };
    delete ct.vars;
    changed = true;
  });
  if (changed) { saveCustomThemes(); saveThemeBackgrounds(); }
})();

// ── Feste Preset-Themes ──────────────────────────────────────────────────
// Fertige Themes, die neben Cozy in der Auswahl stehen, aber
// wie eigene Themes aus Kernfarben abgeleitet werden (gleiches Format wie
// customThemes, ID-Präfix "preset_"). Sie sind fest im Code, auf jedem Gerät
// gleich und nicht löschbar; ✎ öffnet den Editor mit ihren Werten, Speichern
// legt dann ein neues eigenes Theme an — das Preset selbst bleibt unverändert.
// Neues Preset = ein weiterer Eintrag hier, sonst keine Code-Änderung.
const PRESET_THEMES = [
  // Kuros dunkles "Cozy" aus Core (Backup 2026-10-14) — ihre Schrift Darling
  // Letter ist nicht frei lizenziert, daher Nook-Standardschrift und 100 %
  // statt 125 %. Hintergrund = Cozy-Set-Bild (bei Kuro als eigenes Bild
  // hochgeladen, identisches Motiv).
  { id: 'preset_cozydark', name: 'Cozy Dark', family: 'dark',
    coreColors: { bg: '#1d1a15', surface: '#30291f', nav: '#272219', modal: '#342c21', text: '#f0e5d2', border: '#a58a64', accent: '#78835c', font: DEFAULT_FONT_STACK },
    cardOpacity: 90, fontSize: 100, bg: { source: 'cozy', size: 'cover', dim: 30 },
    calendar: { imageTheme: 'cozy' }, startHeader: { banner: 'cozy' }, branding: { theme: 'cozy' }, graphics: { mode: 'theme', theme: 'cozy' } },
  // Cotton Candy: Rosa + Babyblau (Navigation). Überarbeitet, weil der
  // ursprüngliche Akzent #f3e2ee auf hellem Grund kaum sichtbar war
  // (Kontrast 1,1) — jetzt Beerenrosa mit 4,8 gegenüber Text darauf.
  { id: 'preset_cottoncandy', name: 'Cotton Candy', family: 'light',
    coreColors: { bg: '#f8eef6', surface: '#fffbfd', nav: '#eef3fc', modal: '#fffbfd', text: '#4b2e55', border: '#c9a3c4', accent: '#a94a82', font: DEFAULT_FONT_STACK },
    cardOpacity: 100, fontSize: 100, bg: { source: 'none', size: 'cover', dim: 40 },
    calendar: { imageTheme: 'cozy' }, startHeader: { banner: 'none' }, branding: { theme: 'none' }, graphics: { mode: 'custom' } },
  // Grafik-Sets aus Core — Werte aus Kuros Themes (Core-Backup 2026-10-14).
  // Abweichung: Cyberpunk und Lab nutzen in Core Shizuoka Cyberpunk bzw.
  // Technical Stencil VP — beide nur für privaten Gebrauch lizenziert und
  // daher nicht in Nook (assets/fonts/README.md). Dort Nook-Standardschrift
  // und 100 % statt Kuros 135 % (auf die Zierschrift abgestimmt).
  // Bild, Kalender, Banner, Icon = Set.
  { id: 'preset_scifi', name: 'Sci-Fi', family: 'dark',
    coreColors: { bg: '#07101b', surface: '#0c1928', nav: '#091522', modal: '#101e2e', text: '#dce9f3', border: '#547896', accent: '#397fb5', font: "'Orbitron', sans-serif" },
    cardOpacity: 90, fontSize: 100, bg: { source: 'scifi', size: 'cover', dim: 30 },
    calendar: { imageTheme: 'scifi' }, startHeader: { banner: 'scifi' }, branding: { theme: 'scifi' }, graphics: { mode: 'theme', theme: 'scifi' } },
  { id: 'preset_forest', name: 'Forest', family: 'dark',
    coreColors: { bg: '#101511', surface: '#1b231b', nav: '#161d17', modal: '#202920', text: '#ddd9c7', border: '#66745d', accent: '#71845a', font: "'Cinzel', serif" },
    cardOpacity: 85, fontSize: 100, bg: { source: 'forest', size: 'cover', dim: 40 },
    calendar: { imageTheme: 'forest' }, startHeader: { banner: 'forest' }, branding: { theme: 'forest' }, graphics: { mode: 'theme', theme: 'forest' } },
  { id: 'preset_royal', name: 'Royal', family: 'dark',
    coreColors: { bg: '#180d0b', surface: '#291512', nav: '#21100e', modal: '#301815', text: '#e9dcc5', border: '#947354', accent: '#9a7650', font: '"Blackwood Castle"' },
    cardOpacity: 85, fontSize: 130, bg: { source: 'royal', size: 'cover', dim: 40 },
    calendar: { imageTheme: 'royal' }, startHeader: { banner: 'royal' }, branding: { theme: 'royal' }, graphics: { mode: 'theme', theme: 'royal' } },
  { id: 'preset_cyberpunk', name: 'Cyberpunk', family: 'dark',
    coreColors: { bg: '#080a13', surface: '#111323', nav: '#0c0e19', modal: '#15172a', text: '#e5e2f2', border: '#55456e', accent: '#b92daf', font: DEFAULT_FONT_STACK },
    cardOpacity: 85, fontSize: 100, bg: { source: 'cyberpunk', size: 'cover', dim: 40 },
    calendar: { imageTheme: 'cyberpunk' }, startHeader: { banner: 'cyberpunk' }, branding: { theme: 'cyberpunk' }, graphics: { mode: 'theme', theme: 'cyberpunk' } },
  // RPG: gemütliche Abenteurer-Taverne — Pergament bei Tag, Kerzenlicht
  // bei Nacht. Text in Alegreya, Überschriften und Tab-Namen in Blackwood
  // Castle (dieselbe Schrift wie auf den Questboard-Zetteln). Grafik-Set (Hintergrund, Kalender, Banner, Icon) und der
  // Tavernen-Stil des Questboards (css/questboard-rpg.css) sind per
  // scripts/gen-image.py generiert.
  { id: 'preset_rpg', name: 'RPG', family: 'light',
    coreColors: { bg: '#ebe0c9', surface: '#faf3e3', nav: '#e4d6ba', modal: '#faf3e3', text: '#3b2b1c', border: '#a88a60', accent: '#8b5e34', font: "'Alegreya', Georgia, serif", headingFont: '"Blackwood Castle"', navScale: 1.18 },
    cardOpacity: 92, fontSize: 108, bg: { source: 'rpg', size: 'cover', dim: 72 },
    night: { family: 'dark',
      coreColors: { bg: '#1a130d', surface: '#2a1f15', nav: '#21180f', modal: '#2f2318', text: '#efe2c8', border: '#8a6a45', accent: '#b07a3e', font: "'Alegreya', Georgia, serif", headingFont: '"Blackwood Castle"', navScale: 1.18 },
      cardOpacity: 88, fontSize: 108, bg: { source: 'rpg', size: 'cover', dim: 45 } },
    calendar: { imageTheme: 'rpg' }, startHeader: { banner: 'rpg' }, branding: { theme: 'rpg' }, questboard: { style: 'rpg' }, pinboard: { style: 'rpg' }, guides: { style: 'rpg' },
    forest: { style: 'map' },
    graphics: { mode: 'theme', theme: 'rpg' } },
  // Zombie: aus Kuros Core (Download 2026-10-21) — Farben und Grafik-Set
  // unverändert. Core nutzt die Schrift „Capture it“, die laut Font-
  // Metadaten „All Rights Reserved“ ist und daher nicht öffentlich
  // ausgeliefert werden darf (assets/fonts/README.md) → stattdessen
  // Rubik Dirt (SIL OFL) für Überschriften/Tabs, Fließtext Nook-Standard.
  { id: 'preset_zombie', name: 'Zombie', family: 'dark',
    coreColors: { bg: '#141310', surface: '#211f1a', nav: '#191814', modal: '#27241e', text: '#ddd8cb', border: '#665e50', accent: '#756f4d', font: DEFAULT_FONT_STACK, headingFont: "'Rubik Dirt', system-ui, sans-serif" },
    cardOpacity: 85, fontSize: 100, bg: { source: 'zombie', size: 'cover', dim: 30 },
    calendar: { imageTheme: 'zombie' }, startHeader: { banner: 'zombie' }, branding: { theme: 'zombie' }, graphics: { mode: 'theme', theme: 'zombie' } },
  { id: 'preset_lab', name: 'Lab', family: 'dark',
    coreColors: { bg: '#0e1211', surface: '#181d1b', nav: '#121715', modal: '#1c2220', text: '#d8dbd5', border: '#53635c', accent: '#477867', font: DEFAULT_FONT_STACK },
    cardOpacity: 85, fontSize: 100, bg: { source: 'lab', size: 'cover', dim: 40 },
    calendar: { imageTheme: 'lab' }, startHeader: { banner: 'lab' }, branding: { theme: 'lab' }, graphics: { mode: 'theme', theme: 'lab' } },
];

// Eigene Themes, die einem Preset exakt entsprechen (gleicher Name, gleiche
// Kernfarben — z.B. Cotton Candy, das vor seiner Aufnahme als Preset selbst
// angelegt war), werden einmalig durch das Preset ersetzt, statt doppelt in
// der Auswahl zu stehen. War die Kopie aktiv, ist danach das Preset aktiv.
(function replaceCustomThemesMatchingPresets() {
  const sameCore = (a, b) => ['bg', 'surface', 'nav', 'modal', 'text', 'border', 'accent']
    .every(k => (a[k] || '').toLowerCase() === (b[k] || '').toLowerCase());
  const replaced = {};
  customThemes = customThemes.filter(ct => {
    const preset = PRESET_THEMES.find(p => p.name === ct.name && ct.coreColors && sameCore(p.coreColors, ct.coreColors));
    if (preset) replaced[ct.id] = preset.id;
    return !preset;
  });
  if (!Object.keys(replaced).length) return;
  saveCustomThemes();
  if (replaced[theme]) { theme = replaced[theme]; DB.set('theme', theme); }
})();

// Hintergrundbilder der entfernten Dark-Varianten (REMOVED_BUILTIN_THEMES,
// main.js): das erste gefundene wandert zu Cozy (Nacht), falls das noch
// keins hat — dorthin wurden Nutzer dieser Themes auch umgestellt.
(function migrateRemovedThemeBackgrounds() {
  if (typeof REMOVED_BUILTIN_THEMES === 'undefined') return;
  let changed = false;
  REMOVED_BUILTIN_THEMES.forEach(id => {
    if (!themeBackgrounds[id]) return;
    if (!themeBackgrounds.dark) themeBackgrounds.dark = themeBackgrounds[id];
    delete themeBackgrounds[id];
    changed = true;
  });
  if (changed) saveThemeBackgrounds();
})();

function getPresetTheme(id)  { return PRESET_THEMES.find(t => t.id === id) || null; }
// Liefert Presets UND eigene Themes — alles, was über Kernfarben läuft.
// Liefert auch die Nachtversion eines Themes ("<id>:night", siehe
// nightThemeId() in main.js): ein zusammengesetztes Objekt aus dem Basis-
// Theme (Name, Grafik-Set …) und dessen ct.night (Farben, Schrift, Größe,
// Durchlässigkeit, Hintergrund).
function getCustomTheme(id) {
  if (typeof id === 'string' && id.endsWith(NIGHT_SUFFIX)) {
    const base = getCustomTheme(id.slice(0, -NIGHT_SUFFIX.length));
    if (!base || !base.night) return null;
    const n = base.night;
    return Object.assign({}, base, {
      id, family: n.family || 'dark', coreColors: n.coreColors,
      cardOpacity: n.cardOpacity ?? base.cardOpacity, fontSize: n.fontSize ?? base.fontSize, bg: n.bg || null,
      forest: n.forest || base.forest,
    });
  }
  return customThemes.find(t => t.id === id) || getPresetTheme(id);
}
function isCustomThemeId(id) { return !!getCustomTheme(id); }

function getThemeCore(ct) { return Object.assign({}, DEFAULT_BUILDER_CORE, ct && ct.coreColors); }

// =========================================================================
// GRAFIK-THEMES — Icon, Hintergrund, Kalenderbilder, Start-Banner
// Einzige Stelle, die für ein weiteres Set erweitert werden muss (plus
// die Bildpfade in css/calendar.css und css/today.css, die per
// Attributselektor gewählt werden). Bilder liegen als WebP unter
// assets/themes/<id>/ (aus Cores PNGs konvertiert). "Cozy" entspricht
// den bisherigen Nook-Kalenderbildern und dem Nook-Icon.
// =========================================================================
const NOOK_ICON = { src: 'assets/nook_icon.svg', type: 'image/svg+xml' };

const GRAPHICS_THEMES = [
  { id: 'cozy',      label: 'Cozy',      icon: NOOK_ICON },
  { id: 'scifi',     label: 'Sci-Fi',    icon: { src: 'assets/themes/scifi/icon.png',     type: 'image/png' } },
  { id: 'forest',    label: 'Forest',    icon: { src: 'assets/themes/forest/icon.png',    type: 'image/png' } },
  { id: 'royal',     label: 'Royal',     icon: { src: 'assets/themes/royal/icon.png',     type: 'image/png' } },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: { src: 'assets/themes/cyberpunk/icon.png', type: 'image/png' } },
  { id: 'lab',       label: 'Lab',       icon: { src: 'assets/themes/lab/icon.png',       type: 'image/png' } },
  { id: 'zombie',    label: 'Zombie',    icon: { src: 'assets/themes/zombie/icon.png',    type: 'image/png' } },
  { id: 'rpg',       label: 'RPG',       icon: { src: 'assets/themes/rpg/icon.png',       type: 'image/png' }, questboard: 'rpg', pinboard: 'rpg', guides: 'rpg' },
];
const DEFAULT_GRAPHICS_THEME = 'cozy';

function findGraphicsTheme(id) { return GRAPHICS_THEMES.find(g => g.id === id) || null; }
function graphicsBackgroundUrl(id) { return findGraphicsTheme(id) ? `assets/themes/${id}/background.webp` : null; }

// Füllt ein <select> mit den Grafik-Themes, optional mit einem
// vorangestellten "Kein …"-Eintrag (value "none").
function renderGraphicsOptions(selectId, noneLabel) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const opts = noneLabel ? [`<option value="none">${noneLabel}</option>`] : [];
  sel.innerHTML = opts.concat(GRAPHICS_THEMES.map(g => `<option value="${g.id}">${g.label}</option>`)).join('');
}

// Kalender-Hero: welches saisonale Bilder-Set (css/calendar.css,
// [data-cal-image-theme]). Eingebaute Themes → 'cozy' (bisheriges Verhalten).
// override: noch ungespeicherter Editor-Wert für die Live-Vorschau.
function applyCalendarImageTheme(id, override) {
  const ct = getCustomTheme(id);
  const v = override !== undefined ? override : ((ct && ct.calendar && ct.calendar.imageTheme) || 'cozy');
  document.documentElement.setAttribute('data-cal-image-theme', v);
}

// Start-Banner auf der Heute-Seite (css/today.css, [data-start-header-
// theme]). Eingebaute Themes → 'none' (bisheriges Nook-Layout ohne Banner).
// Tag/Nacht wählt today.js separat über [data-start-header-daynight].
function applyStartHeaderTheme(id, override) {
  const ct = getCustomTheme(id);
  const v = override !== undefined ? override : ((ct && ct.startHeader && ct.startHeader.banner) || 'none');
  document.documentElement.setAttribute('data-start-header-theme', v);
}

// Questboard-Stil (css/questboard-rpg.css, [data-questboard-style]).
// Eingebaute Themes und Themes ohne Angabe → 'cozy' (schlichtes Brett).
// Ein Grafik-Set kann einen Stil mitbringen (GRAPHICS_THEMES.questboard).
const QUESTBOARD_STYLES = [
  { id: 'cozy', label: 'Cozy (schlicht)' },
  { id: 'rpg',  label: 'Taverne (RPG)' },
];
function applyQuestboardStyle(id, override) {
  const ct = getCustomTheme(id);
  const v = override !== undefined ? override : ((ct && ct.questboard && ct.questboard.style) || 'cozy');
  document.documentElement.setAttribute('data-questboard-style', v);
}

// Pinnwand-Stil (css/pinboard-rpg.css, [data-pinboard-style]): 'cozy' =
// farbige Karten wie bisher, 'rpg' = Pergament-Blätter, Kartenfarbe als Pin.
const PINBOARD_STYLES = [
  { id: 'cozy', label: 'Cozy (farbige Karten)' },
  { id: 'rpg',  label: 'Pergament (RPG)' },
];
function applyPinboardStyle(id, override) {
  const ct = getCustomTheme(id);
  const v = override !== undefined ? override : ((ct && ct.pinboard && ct.pinboard.style) || 'cozy');
  document.documentElement.setAttribute('data-pinboard-style', v);
}

// Anleitungen-Stil (css/guides-rpg.css, [data-guides-style]): 'cozy' =
// farbige Buchrücken wie bisher, 'rpg' = Zauberbücher (Tomes) im Regal,
// Kapitel als altes Buch, Seitenkarten als Zettel.
const GUIDES_STYLES = [
  { id: 'cozy', label: 'Cozy (Buchrücken)' },
  { id: 'rpg',  label: 'Zauberbücher (RPG)' },
];
function applyGuidesStyle(id, override) {
  const ct = getCustomTheme(id);
  const v = override !== undefined ? override : ((ct && ct.guides && ct.guides.style) || 'cozy');
  document.documentElement.setAttribute('data-guides-style', v);
}

// Projektwald-Stil (css/projects.css, [data-forest-style]): 'default' =
// Tagbild (in dunklen Themes gedimmt + getönt), 'map' = Übersicht als
// Karte auf Pergament (RPG-Nacht). Kann je Tag-/Nachtversion abweichen.
function applyForestStyle(id) {
  const ct = getCustomTheme(id);
  document.documentElement.setAttribute('data-forest-style', (ct && ct.forest && ct.forest.style) || 'default');
}

// Sidebar-Icon + Favicon. 'none' bzw. eingebaute Themes → Nook-Icon.
function applyBranding(id, override) {
  const ct = getCustomTheme(id);
  const brandingId = override !== undefined ? override : ((ct && ct.branding && ct.branding.theme) || 'none');
  const gt = findGraphicsTheme(brandingId);
  const icon = gt ? gt.icon : NOOK_ICON;
  const brandIconEl = document.getElementById('brand-icon');
  const faviconEl = document.querySelector('link[rel="icon"]');
  if (faviconEl) { faviconEl.href = icon.src; faviconEl.type = icon.type; }
  if (brandIconEl) brandIconEl.src = icon.src;
}

// =========================================================================
// FARBEN
// =========================================================================

function teLuminance(hex) {
  const h = (hex || '#808080').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Leitet aus den gewählten Kernfarben die restlichen Tokens ab — nach dem
// Muster der eingebauten Themes in main.css. --surface/-2/-3, Navigation
// und Modal werden über color-mix() mit der Kartendurchlässigkeit
// verrechnet (dasselbe Prinzip wie --core-card-opacity in main.css).
// Schnellnotiz + Hervorhebung (aktiver Unterrichtsblock): ohne eigene Wahl
// im Editor ein Hauch Akzentfarbe auf der Kartenfarbe — dadurch passt z.B.
// die Notiz bei Cotton Candy zu Rosa statt fest Gelb zu sein.
function derivedNoteColors(core) {
  const isDark = teLuminance(core.bg) < 128;
  return {
    quicknote: mixHex(core.surface, core.accent, isDark ? 0.12 : 0.14),
    highlight: mixHex(core.surface, core.accent, isDark ? 0.18 : 0.20),
  };
}

function deriveThemeVars(core, cardOpacityPct, fontSizePct) {
  const isDark = teLuminance(core.bg) < 128;
  const notes = derivedNoteColors(core);
  const tint = isDark ? '#ffffff' : '#000000';
  const borderAlphaLow  = isDark ? 0.09 : 0.16;
  const borderAlphaHigh = isDark ? 0.18 : 0.28;
  const opacity = cardOpacityPct + '%';
  const mix = hex => `color-mix(in srgb, ${hex} ${opacity}, transparent)`;
  const font = core.font || DEFAULT_FONT_STACK;
  // Optionale eigene Überschriften-Schrift (Seitentitel, Begrüßung,
  // Fenstertitel) — ohne Angabe dieselbe wie der Fließtext.
  const headingFont = core.headingFont || font;
  return {
    '--bg':            core.bg,
    '--bg-2':          mixHex(core.bg, tint, 0.05),
    '--surface-solid': core.surface,
    '--surface':       mix(core.surface),
    '--surface-2':     mix(mixHex(core.surface, tint, 0.06)),
    '--surface-3':     mix(mixHex(core.surface, tint, 0.12)),
    '--dash-bg':       mixHex(core.bg, core.surface, 0.45),
    '--border':        hexToRgba(core.border, borderAlphaLow),
    '--border-strong': hexToRgba(core.border, borderAlphaHigh),
    '--text':          core.text,
    '--text-2':        mixHex(core.text, core.bg, 0.35),
    '--text-3':        mixHex(core.text, core.bg, 0.6),
    '--accent-soft':   mixHex(core.surface, tint, 0.08),
    '--sage':          core.accent,
    '--sage-dark':     mixHex(core.accent, '#000000', 0.25),
    '--sage-light':    mixHex(core.accent, '#ffffff', 0.25),
    '--sage-bg':       hexToRgba(core.accent, 0.13),
    '--sage-border':   hexToRgba(core.accent, 0.32),
    '--event-color':    core.accent,
    '--event-color-bg': hexToRgba(core.accent, 0.13),
    '--quicknote-bg':   core.quicknote || notes.quicknote,
    '--quicknote-line': core.accent,
    '--quicknote-text': mixHex(core.text, core.accent, 0.45),
    '--highlight-bg':   core.highlight || notes.highlight,
    '--user-color-neutral': mixHex(core.surface, tint, 0.12),
    '--core-nav-bg':   mix(core.nav),
    '--core-modal-bg': mix(core.modal),
    '--font':          font,
    '--font-heading':  headingFont,
    // Zierschriften laufen oft kleiner — Tab-Namen (in Überschriften-
    // Schrift) dann etwas größer setzen (Preset-Eigenschaft navScale).
    '--nav-font-scale': String(core.headingFont ? (core.navScale || 1) : 1),
    '--mono':          font,
    '--core-card-opacity': opacity,
    '--theme-font-scale': ((fontSizePct || 100) / 100).toFixed(2),
  };
}

function themeFontNeedsLoading(stack) {
  return !!stack && !FONT_CATEGORIES.slice(0, 2).some(c => c.fonts.some(f => f.stack === stack));
}

// Variablen aus Rohdaten (coreColors/cardOpacity/fontSize) bei jedem
// Anwenden neu ableiten statt einer gespeicherten Momentaufnahme — so
// bekommen auch ältere Themes jede spätere Erweiterung von deriveThemeVars().
function applyVarsToRoot(vars, family) {
  const root = document.documentElement;
  if (family) root.setAttribute('data-theme-family', family);
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}
function clearCustomThemeVars() {
  CUSTOM_THEME_VARS.forEach(v => document.documentElement.style.removeProperty(v));
}
function applyCustomThemeVars(id) {
  clearCustomThemeVars();
  const ct = getCustomTheme(id);
  if (!ct) return false;
  const core = getThemeCore(ct);
  if (themeFontNeedsLoading(core.font) || themeFontNeedsLoading(core.headingFont)) ensureThemeFontsLoaded();
  applyVarsToRoot(deriveThemeVars(core, ct.cardOpacity ?? 100, ct.fontSize ?? 100), ct.family);
  return true;
}

// =========================================================================
// HINTERGRUNDBILDER
// meta: { source: 'none' | 'custom' | <Grafik-Theme-ID>, data?, name?,
//         size: 'cover'|'contain'|'center', dim: 0–100 }
// =========================================================================

// Altes Nook-Format ({data,name,size,dim} ohne source) → source:'custom'.
// Rein lesend, nichts wird zurückgeschrieben.
function normalizeBgMeta(meta) {
  if (!meta) return null;
  if (meta.source) return meta;
  return Object.assign({}, meta, { source: meta.data ? 'custom' : 'none' });
}

function getThemeBgMeta(id) {
  const ct = getCustomTheme(id);
  return normalizeBgMeta(ct ? ct.bg : themeBackgrounds[id]);
}
function setThemeBgMeta(id, meta) {
  const ct = getCustomTheme(id);
  if (ct) { ct.bg = meta; saveCustomThemes(); return; }
  if (meta) themeBackgrounds[id] = meta; else delete themeBackgrounds[id];
  saveThemeBackgrounds();
}

function resolveBgUrl(meta) {
  if (!meta || !meta.source || meta.source === 'none') return null;
  if (meta.source === 'custom') return meta.data || null;
  return graphicsBackgroundUrl(meta.source);
}

// Vor dem Speichern per <canvas> verkleinert/neu kodiert (JPEG) — ein Foto
// direkt aus der Handykamera würde sonst das localStorage-Limit sprengen
// und Backup/Export (settings.js) unnötig aufblähen.
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

function parseColorToRgb(str) {
  if (!str) return null;
  str = str.trim();
  let m = str.match(/^#([0-9a-f]{3})$/i);
  if (m) { const h = m[1]; return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) }; }
  m = str.match(/^#([0-9a-f]{6})$/i);
  if (m) { const h = m[1]; return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; }
  m = str.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]) };
  return null;
}

// Zweilagiger background-image-Stack: Tönung in der Theme-Hintergrund-
// farbe (statt neutralem Schwarz — das Bild scheint durch die Theme-Farbe
// hindurch) + Bild. Gemeinsam genutzt von der echten Seite und der kleinen
// Vorschau im Editor.
function buildBgLayers(url, meta, rgb) {
  if (!url) return null;
  const dim = (((meta && meta.dim) ?? 40) / 100).toFixed(2);
  const { r, g, b } = rgb;
  const size = (meta && meta.size) || 'cover';
  const imgSize = size === 'contain' ? 'contain' : (size === 'center' ? 'auto' : 'cover');
  return {
    backgroundImage: `linear-gradient(rgba(${r},${g},${b},${dim}), rgba(${r},${g},${b},${dim})), url("${url}")`,
    backgroundSize: `auto, ${imgSize}`,
    backgroundPosition: 'center, center',
    backgroundRepeat: 'no-repeat',
  };
}

// Eingebaute Themes mit Hintergrundbild bekommen die bisherige Nook-
// Glasoptik (82% deckend + Blur, .bg-frosted in main.css). Eigene Themes
// steuern die Durchlässigkeit selbst über den Regler im Editor.
const BUILTIN_BG_OPACITY_VARS = ['--core-card-opacity', '--core-nav-opacity', '--core-modal-opacity'];
const BUILTIN_BG_OPACITY = '82%';

// body-Hintergrund wird auf das Canvas propagiert und malt damit
// garantiert hinter #app — kein eigenes Overlay-Element nötig.
function applyBgToDom(url, meta, isCustom) {
  const body = document.body;
  const root = document.documentElement;
  // --core-card-opacity gehört bei eigenen Themes dem Theme selbst
  // (deriveThemeVars()) und wird dort nicht angefasst.
  BUILTIN_BG_OPACITY_VARS.forEach(v => { if (!isCustom || v !== '--core-card-opacity') root.style.removeProperty(v); });
  const rgb = parseColorToRgb(getComputedStyle(root).getPropertyValue('--bg')) || { r: 0, g: 0, b: 0 };
  const layers = buildBgLayers(url, meta, rgb);
  body.classList.toggle('has-bg-image', !!layers);
  body.classList.toggle('bg-frosted', !!layers && !isCustom);
  if (!layers) {
    ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment']
      .forEach(p => { body.style[p] = ''; });
    return;
  }
  if (!isCustom) BUILTIN_BG_OPACITY_VARS.forEach(v => root.style.setProperty(v, BUILTIN_BG_OPACITY));
  Object.assign(body.style, layers);
  body.style.backgroundAttachment = 'fixed';
}

function applyThemeBackground(id) {
  const meta = getThemeBgMeta(id);
  applyBgToDom(resolveBgUrl(meta), meta, isCustomThemeId(id));
}

// ── Zentrale Anwendung — von setTheme() (main.js) nach jedem Wechsel und
//    einmal beim Laden aufgerufen. ──────────────────────────────────────
function applyThemeEngine(id) {
  applyCustomThemeVars(id);
  applyThemeBackground(id);
  applyCalendarImageTheme(id);
  applyStartHeaderTheme(id);
  applyBranding(id);
  applyQuestboardStyle(id);
  applyPinboardStyle(id);
  applyGuidesStyle(id);
  applyForestStyle(id);
  // Browser-/PWA-Leiste in der Hintergrundfarbe des aktiven Themes
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
}

// =========================================================================
// EIGENE THEMES — Löschen + Editor-Modal
// =========================================================================

function deleteCustomTheme(id) {
  if (!customThemes.some(t => t.id === id)) return;
  customThemes = customThemes.filter(t => t.id !== id);
  saveCustomThemes();
  if (theme === id || theme === id + NIGHT_SUFFIX) setTheme('light');
  if (typeof renderThemeSettings === 'function') renderThemeSettings();
}

let _teBuilderEditId = null;
// Tag/Nacht im Editor: Zustand beider Versionen (Farben, Schrift, Größe,
// Durchlässigkeit, Hintergrund) — das Formular zeigt immer nur die gerade
// gewählte, die andere liegt hier zwischengespeichert.
let _teBuilderVariants = { day: null, night: null };
let _teBuilderVariant = 'day';   // 'day' | 'night'
let _teBuilderGraphicsMode = 'theme';  // 'theme' | 'custom'
// Hintergrund im Editor: bereits verkleinertes eigenes Bild (data-URL),
// erst beim Speichern ins Theme übernommen.
let _teBuilderBgData = null;
let _teBuilderBgName = null;

function tbEl(id) { return document.getElementById('theme-builder-' + id); }

// ── "Grafische Elemente": ein Set für alles oder einzeln ─────────────────
// Bestehende Themes ohne gespeicherten Modus: stimmen Kalender, Start-
// Banner und Icon überein, war es faktisch "ein Set für alles".
function detectGraphicsMode(explicitGraphics, calendarTheme, startHeaderTheme, brandingTheme) {
  if (explicitGraphics && explicitGraphics.mode) return explicitGraphics;
  const values = [calendarTheme, startHeaderTheme, brandingTheme];
  const allSame = values.every(v => v && v === values[0]) && !!findGraphicsTheme(values[0]);
  return allSame ? { mode: 'theme', theme: values[0] } : { mode: 'custom' };
}

function applyGraphicsThemeToControls(themeId) {
  tbEl('calendar-image').value = themeId;
  tbEl('start-header').value = themeId;
  tbEl('branding-theme').value = themeId;
  const gt = findGraphicsTheme(themeId);
  tbEl('questboard-style').value = (gt && gt.questboard) || 'cozy';
  tbEl('pinboard-style').value = (gt && gt.pinboard) || 'cozy';
  tbEl('guides-style').value = (gt && gt.guides) || 'cozy';
  previewThemeBuilderLive();
}

function setGraphicsModeUI(mode) {
  _teBuilderGraphicsMode = mode;
  tbEl('graphics-mode-theme').classList.toggle('active', mode === 'theme');
  tbEl('graphics-mode-custom').classList.toggle('active', mode === 'custom');
  tbEl('graphics-theme-row').classList.toggle('hidden', mode !== 'theme');
  tbEl('graphics-detail').classList.toggle('hidden', mode !== 'custom');
}

function readThemeBuilderCore() {
  return {
    bg:      tbEl('bg').value,
    surface: tbEl('surface').value,
    nav:     tbEl('nav').value,
    modal:   tbEl('modal').value,
    text:    tbEl('text').value,
    border:  tbEl('border').value,
    accent:  tbEl('accent').value,
    font:    tbEl('font').value || DEFAULT_FONT_STACK,
    headingFont: tbEl('heading-font').value || undefined,
    // Nur gespeichert, wenn selbst gewählt — sonst folgen sie der Ableitung
    // (derivedNoteColors) und passen sich an, wenn sich Akzent/Karte ändern.
    quicknote: tbEl('quicknote').dataset.auto === '1' ? undefined : tbEl('quicknote').value,
    highlight: tbEl('highlight').dataset.auto === '1' ? undefined : tbEl('highlight').value,
  };
}

// Notiz-/Hervorhebungsfeld: zeigt im Auto-Modus die abgeleitete Farbe und
// zieht bei Änderungen an Akzent/Karte mit; eine eigene Wahl beendet das.
function syncThemeBuilderNoteFields() {
  const derived = derivedNoteColors(readThemeBuilderCore());
  ['quicknote', 'highlight'].forEach(k => { if (tbEl(k).dataset.auto === '1') tbEl(k).value = derived[k]; });
}

function readThemeBuilderBgMeta() {
  return {
    source: tbEl('bg-source').value,
    data: _teBuilderBgData,
    name: _teBuilderBgName,
    size: tbEl('bg-size').value,
    dim: parseInt(tbEl('bg-dim').value, 10),
  };
}

// Zustand der gerade im Formular stehenden Version (Tag oder Nacht).
function readThemeBuilderVariant() {
  return {
    coreColors: readThemeBuilderCore(),
    cardOpacity: parseInt(tbEl('opacity').value, 10),
    fontSize: parseInt(tbEl('fontsize').value, 10),
    bg: readThemeBuilderBgMeta(),
  };
}

// Füllt nur die Felder, die pro Version gelten (Farben, Schrift, Größe,
// Durchlässigkeit, Hintergrund).
function fillThemeBuilderVariant(t) {
  const core = getThemeCore(t);
  ['bg', 'surface', 'nav', 'modal', 'text', 'border', 'accent'].forEach(k => { tbEl(k).value = core[k]; });
  ['quicknote', 'highlight'].forEach(k => {
    const own = t.coreColors && t.coreColors[k];
    tbEl(k).dataset.auto = own ? '0' : '1';
    if (own) tbEl(k).value = own;
  });
  syncThemeBuilderNoteFields();
  tbEl('opacity').value = t.cardOpacity ?? 100;
  tbEl('fontsize').value = t.fontSize ?? 100;
  renderFontSelect(core.font);
  renderFontSelect(core.headingFont || '', 'heading-font');

  const bg = normalizeBgMeta(t.bg) || { source: 'none' };
  _teBuilderBgData = bg.data || null;
  _teBuilderBgName = bg.name || null;
  tbEl('bg-source').value = bg.source || 'none';
  tbEl('bg-size').value = bg.size || 'cover';
  tbEl('bg-dim').value = bg.dim ?? 40;
  syncThemeBuilderBgUI();
}

// Füllt alle Editor-Felder aus einem Theme-ähnlichen Objekt — gemeinsam
// genutzt von openThemeBuilder() (bestehendes/neues Theme) und der
// "Vorlage"-Leiste. Die Versions-Felder landen in der gerade gewählten
// Version (Tag oder Nacht).
function fillThemeBuilderForm(t) {
  fillThemeBuilderVariant(t);

  const calendar = (t.calendar && t.calendar.imageTheme) || 'cozy';
  const startHeader = (t.startHeader && t.startHeader.banner) || 'none';
  const branding = (t.branding && t.branding.theme) || 'none';
  tbEl('calendar-image').value = calendar;
  tbEl('start-header').value = startHeader;
  tbEl('branding-theme').value = branding;
  tbEl('questboard-style').value = (t.questboard && t.questboard.style) || 'cozy';
  tbEl('pinboard-style').value = (t.pinboard && t.pinboard.style) || 'cozy';
  tbEl('guides-style').value = (t.guides && t.guides.style) || 'cozy';
  const graphics = detectGraphicsMode(t.graphics || null, calendar, startHeader, branding);
  tbEl('graphics-theme').value = graphics.theme || DEFAULT_GRAPHICS_THEME;
  setGraphicsModeUI(graphics.mode);
  if (graphics.mode === 'theme') applyGraphicsThemeToControls(graphics.theme || DEFAULT_GRAPHICS_THEME);

  syncThemeBuilderBgUI();
  previewThemeBuilderLive();
}

function openThemeBuilder(editId) {
  ensureThemeFontsLoaded();
  const existing = editId ? getCustomTheme(editId) : null;
  const isPreset = !!(existing && getPresetTheme(editId));
  _teBuilderEditId = isPreset ? null : (editId || null);

  renderGraphicsOptions('theme-builder-bg-source', 'Kein Bild');
  tbEl('bg-source').insertAdjacentHTML('beforeend', '<option value="custom">Eigenes Bild</option>');
  renderGraphicsOptions('theme-builder-calendar-image', 'Kein Bild');
  renderGraphicsOptions('theme-builder-start-header', 'Kein Banner');
  renderGraphicsOptions('theme-builder-branding-theme', 'Nook (Standard)');
  renderGraphicsOptions('theme-builder-graphics-theme', null);
  tbEl('questboard-style').innerHTML = QUESTBOARD_STYLES.map(q => `<option value="${q.id}">${q.label}</option>`).join('');
  tbEl('pinboard-style').innerHTML = PINBOARD_STYLES.map(q => `<option value="${q.id}">${q.label}</option>`).join('');
  tbEl('guides-style').innerHTML = GUIDES_STYLES.map(q => `<option value="${q.id}">${q.label}</option>`).join('');
  renderThemeTemplateStrip();

  tbEl('title').textContent = isPreset ? 'Theme erstellen' : (existing ? 'Theme bearbeiten' : 'Theme erstellen');
  tbEl('name').value = isPreset ? existing.name + ' (eigen)' : (existing ? existing.name : '');
  tbEl('delete').style.display = existing && !isPreset ? '' : 'none';

  _teBuilderVariants = { day: null, night: existing && existing.night ? JSON.parse(JSON.stringify(existing.night)) : null };
  setThemeBuilderVariantUI('day');
  tbEl('daynight').checked = !!(existing && existing.night);
  tbEl('variant-row').classList.toggle('hidden', !tbEl('daynight').checked);

  if (existing) {
    fillThemeBuilderForm(existing);
    // Ist gerade die Nachtversion dieses Themes aktiv, gleich dort starten.
    if (existing.night && theme === editId + NIGHT_SUFFIX) switchThemeBuilderVariant('night');
  } else {
    // Neues Theme startet mit den Farben des aktuell aktiven Themes und
    // im einfacheren "Ein Set für alles"-Modus.
    const cur = getCustomTheme(theme);
    const reg = THEME_REGISTRY.find(r => r.id === theme);
    fillThemeBuilderForm({
      coreColors: cur ? getThemeCore(cur) : (reg ? reg.core : THEME_REGISTRY[0].core),
      cardOpacity: 100, fontSize: 100, bg: null,
      graphics: { mode: 'theme', theme: DEFAULT_GRAPHICS_THEME },
    });
  }

  document.getElementById('theme-builder-overlay').classList.remove('hidden');
  tbEl('name').focus();
}

// Schließen ohne Speichern: Live-Vorschau zurücknehmen — das tatsächlich
// aktive Theme vollständig neu anwenden.
function closeThemeBuilder() {
  document.getElementById('theme-builder-overlay').classList.add('hidden');
  tbEl('font-panel').classList.add('hidden');
  tbEl('heading-font-panel').classList.add('hidden');
  _teBuilderEditId = null;
  _teBuilderBgData = null;
  _teBuilderBgName = null;
  _teBuilderVariants = { day: null, night: null };
  _teBuilderVariant = 'day';
  document.documentElement.setAttribute('data-theme-family', themeFamily);
  applyThemeEngine(theme);
}

// Live-Vorschau: wendet die aktuellen Formularwerte direkt auf den ganzen
// Hub an (wie der frühere Nook-Builder) — der Editor selbst nutzt dieselben
// Variablen, ist also Teil der Vorschau. Hintergrund, Kalender, Start-
// Banner und Icon werden genauso live gezeigt.
function previewThemeBuilderLive() {
  const overlay = document.getElementById('theme-builder-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  syncThemeBuilderNoteFields();
  const core = readThemeBuilderCore();
  const opacity = parseInt(tbEl('opacity').value, 10);
  const fontSize = parseInt(tbEl('fontsize').value, 10);
  tbEl('opacity-label').textContent = opacity + '%';
  tbEl('fontsize-label').textContent = fontSize + '%';
  tbEl('bg-dim-label').textContent = tbEl('bg-dim').value + '%';

  clearCustomThemeVars();
  applyVarsToRoot(deriveThemeVars(core, opacity, fontSize), teLuminance(core.bg) < 128 ? 'dark' : 'light');
  const bgMeta = readThemeBuilderBgMeta();
  applyBgToDom(resolveBgUrl(bgMeta), bgMeta, true);
  applyCalendarImageTheme(null, tbEl('calendar-image').value);
  applyStartHeaderTheme(null, tbEl('start-header').value);
  applyBranding(null, tbEl('branding-theme').value);
  applyQuestboardStyle(null, tbEl('questboard-style').value);
  applyPinboardStyle(null, tbEl('pinboard-style').value);
  applyGuidesStyle(null, tbEl('guides-style').value);
}

// ── "Vorlage"-Leiste: übernimmt die Werte eines vorhandenen Themes
//    (eingebaut oder eigen) in die offenen Felder — legt nichts an, erst
//    "Speichern" erzeugt/ändert ein Theme. ──────────────────────────────
function renderThemeTemplateStrip() {
  const row = tbEl('template-row');
  if (!row) return;
  row.innerHTML = '';
  const templates = THEME_REGISTRY
    .map(reg => ({
      regId: reg.id,
      name: reg.label, coreColors: reg.core, cardOpacity: 100, fontSize: 100,
      bg: themeBackgrounds[reg.id] || null,
      calendar: { imageTheme: 'cozy' }, startHeader: { banner: 'none' }, branding: { theme: 'none' },
    }))
    .concat(PRESET_THEMES, customThemes);
  templates.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'clock-type-btn';
    btn.textContent = t.name;
    btn.addEventListener('click', () => {
      fillThemeBuilderForm(t);
      // Tag/Nacht aktiv und Tag-Ansicht offen: hat die Vorlage selbst eine
      // Nachtversion (Cozy → Cozy Nacht, eigene Themes mit ct.night), wird
      // die gleich mit übernommen.
      if (!tbEl('daynight').checked || _teBuilderVariant !== 'day') return;
      const darkReg = t.regId && DAYNIGHT_THEMES[t.regId] && THEME_REGISTRY.find(r => r.id === DAYNIGHT_THEMES[t.regId]);
      if (darkReg) _teBuilderVariants.night = { coreColors: Object.assign({}, darkReg.core), cardOpacity: 100, fontSize: 100, bg: themeBackgrounds[darkReg.id] || null };
      else if (t.night) _teBuilderVariants.night = JSON.parse(JSON.stringify(t.night));
    });
    row.appendChild(btn);
  });
}

// Hintergrund im Editor: Datei-Zeile nur bei "Eigenes Bild", Größe/
// Tönung bei jeder Quelle außer "Kein Bild".
function syncThemeBuilderBgUI() {
  const source = tbEl('bg-source').value;
  tbEl('bg-custom-row').classList.toggle('hidden', source !== 'custom');
  tbEl('bg-options').classList.toggle('hidden', source === 'none');
  tbEl('bg-filename').textContent = _teBuilderBgData ? (_teBuilderBgName || 'Bild geladen') : 'Kein Bild ausgewählt';
}

function saveThemeBuilder() {
  const nameInput = tbEl('name');
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }

  _teBuilderVariants[_teBuilderVariant] = readThemeBuilderVariant();
  const cleanBg = bg => {
    bg = Object.assign({}, bg);
    if (bg.source !== 'custom' || !bg.data) { delete bg.data; delete bg.name; }
    if (bg.source === 'custom' && !bg.data) bg.source = 'none';
    return bg;
  };
  const day = _teBuilderVariants.day;
  const nightOn = tbEl('daynight').checked && _teBuilderVariants.night;
  const night = nightOn ? Object.assign({}, _teBuilderVariants.night, {
    family: teLuminance(getThemeCore(_teBuilderVariants.night).bg) < 128 ? 'dark' : 'light',
    bg: cleanBg(_teBuilderVariants.night.bg || { source: 'none' }),
  }) : undefined;
  const data = {
    name,
    family: teLuminance(day.coreColors.bg) < 128 ? 'dark' : 'light',
    coreColors: day.coreColors,
    cardOpacity: day.cardOpacity,
    fontSize: day.fontSize,
    bg: cleanBg(day.bg),
    night,
    calendar: { imageTheme: tbEl('calendar-image').value },
    startHeader: { banner: tbEl('start-header').value },
    branding: { theme: tbEl('branding-theme').value },
    questboard: { style: tbEl('questboard-style').value },
    pinboard: { style: tbEl('pinboard-style').value },
    guides: { style: tbEl('guides-style').value },
    graphics: { mode: _teBuilderGraphicsMode, theme: tbEl('graphics-theme').value },
  };

  let id = _teBuilderEditId;
  const ct = id ? customThemes.find(t => t.id === id) : null;
  if (ct) { Object.assign(ct, data); if (!night) delete ct.night; }
  else { id = 'custom_' + Date.now(); const neu = Object.assign({ id }, data); if (!night) delete neu.night; customThemes.push(neu); }
  // Danach die Version aktivieren, die gerade im Editor offen war.
  const showNight = !!night && _teBuilderVariant === 'night';
  try { saveCustomThemes(); }
  catch {
    alert('Das Theme konnte nicht gespeichert werden — der Speicher ist voll. Versuch es mit einem kleineren Hintergrundbild.');
    return;
  }
  closeThemeBuilder();
  setTheme(showNight ? id + NIGHT_SUFFIX : id);
  if (typeof renderThemeSettings === 'function') renderThemeSettings();
}

// ── Tag/Nacht im Editor ──────────────────────────────────────────────────
function setThemeBuilderVariantUI(v) {
  _teBuilderVariant = v;
  tbEl('variant-day').classList.toggle('active', v === 'day');
  tbEl('variant-night').classList.toggle('active', v === 'night');
}

// Formular auf die andere Version umschalten — die aktuelle wird vorher
// zwischengespeichert, die Live-Vorschau zeigt danach die neue.
function switchThemeBuilderVariant(v) {
  if (v === _teBuilderVariant) return;
  _teBuilderVariants[_teBuilderVariant] = readThemeBuilderVariant();
  if (!_teBuilderVariants[v]) _teBuilderVariants[v] = makeNightVariant(_teBuilderVariants.day);
  fillThemeBuilderVariant(_teBuilderVariants[v]);
  setThemeBuilderVariantUI(v);
  previewThemeBuilderLive();
}

// Erste Nachtversion: ist der Tag schon dunkel, eine Kopie davon; sonst die
// Grundfarben von Cozy (Nacht) mit Akzent und Schrift des Tags. Notiz und
// Hervorhebung leiten sich daraus neu ab.
function makeNightVariant(day) {
  const dayCore = getThemeCore(day);
  const copy = JSON.parse(JSON.stringify(day));
  if (teLuminance(dayCore.bg) < 128) return copy;
  const darkCore = Object.assign({}, THEME_REGISTRY.find(r => r.id === 'dark').core, { accent: dayCore.accent, font: dayCore.font });
  delete darkCore.quicknote; delete darkCore.highlight;
  return Object.assign(copy, { coreColors: darkCore });
}

// ── Preset- und eigene Theme-Buttons im #theme-picker (Einstellungen) ────
// Von renderThemeSettings() (settings.js) aufgerufen. Auswahl läuft über
// den delegierten Klick-Listener auf #theme-picker in settings.js — die
// ✎/✕-Icons stoppen die Propagation, damit sie das Theme nicht auswählen.
// Presets haben nur ✎ (öffnet eine Kopie im Editor), kein ✕.
function renderCustomThemeButtons() {
  const picker = document.getElementById('theme-picker');
  const addBtn = document.getElementById('theme-builder-open-btn');
  if (!picker || !addBtn) return;
  picker.querySelectorAll('.theme-picker-btn-custom').forEach(el => el.remove());

  PRESET_THEMES.concat(customThemes).forEach(ct => {
    const isPreset = !!getPresetTheme(ct.id);
    const core = getThemeCore(ct);
    const btn = document.createElement('button');
    btn.className = 'clock-type-btn theme-picker-btn theme-picker-btn-custom' + (themePickerId(theme) === ct.id ? ' active' : '');
    btn.dataset.themeValue = ct.id;
    btn.innerHTML = `
      <span class="theme-swatch-dot" style="background:${core.surface};border-color:${core.accent};"></span>
      <span>${escHtml(ct.name)}</span>
      <span class="theme-picker-icon theme-picker-icon-edit" title="${isPreset ? 'Als eigenes Theme anpassen' : 'Bearbeiten'}">✎</span>
      ${isPreset ? '' : '<span class="theme-picker-icon theme-picker-icon-del" title="Löschen">✕</span>'}`;
    btn.querySelector('.theme-picker-icon-edit').addEventListener('click', e => {
      e.stopPropagation();
      openThemeBuilder(ct.id);
    });
    btn.querySelector('.theme-picker-icon-del')?.addEventListener('click', async e => {
      e.stopPropagation();
      const ok = await hubConfirm({ title: 'Theme löschen?', message: `„${ct.name}" wird endgültig gelöscht.`, confirmText: 'Löschen', danger: true });
      if (ok) deleteCustomTheme(ct.id);
    });
    picker.insertBefore(btn, addBtn);
  });
}

// =========================================================================
// EINSTELLUNGEN: Hintergrundbild der eingebauten Themes
// Eigene Themes bringen ihr Bild aus dem Editor mit — die Zeile wird für
// sie durch einen Hinweis ersetzt.
// =========================================================================

function renderBgImageSettings() {
  const section = document.getElementById('bg-image-section');
  if (!section) return;
  const custom = isCustomThemeId(theme);
  section.classList.toggle('hidden', custom);
  document.getElementById('bg-image-custom-note').classList.toggle('hidden', !custom);
  if (custom) return;

  const meta = getThemeBgMeta(theme) || {};
  const hasData = !!meta.data;
  document.getElementById('setting-bg-image').checked = hasData;
  document.getElementById('bg-image-options-row').classList.toggle('hidden', !hasData);
  document.getElementById('bg-image-dim-row').classList.toggle('hidden', !hasData);
  document.getElementById('bg-image-filename').textContent = meta.name || 'Kein Bild gewählt';
  document.getElementById('bg-image-size').value = meta.size || 'cover';
  document.getElementById('bg-dim-slider').value = meta.dim ?? 40;
  document.getElementById('bg-dim-label').textContent = (meta.dim ?? 40) + '%';
}

function updateBuiltinBgMeta(patch) {
  const meta = getThemeBgMeta(theme);
  if (!meta) return;
  setThemeBgMeta(theme, Object.assign({}, meta, patch));
  applyThemeBackground(theme);
}

function initBgImageSettings() {
  const fileInput = document.getElementById('bg-image-file-input');
  if (!fileInput) return;
  const clearBg = () => { setThemeBgMeta(theme, null); applyThemeBackground(theme); renderBgImageSettings(); };

  document.getElementById('setting-bg-image').addEventListener('change', e => {
    if (e.target.checked) { fileInput.click(); return; }
    clearBg();
  });
  document.getElementById('bg-image-pick-btn').addEventListener('click', () => fileInput.click());
  document.getElementById('bg-image-clear-btn').addEventListener('click', clearBg);
  fileInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) { renderBgImageSettings(); return; }
    let dataUrl;
    try { dataUrl = await downscaleImageFile(file); }
    catch { alert('Dieses Bild konnte nicht geladen werden.'); renderBgImageSettings(); return; }
    const prev = getThemeBgMeta(theme) || {};
    try { setThemeBgMeta(theme, { source: 'custom', data: dataUrl, name: file.name, size: prev.size || 'cover', dim: prev.dim ?? 40 }); }
    catch { alert('Das Bild ist zu groß für den Speicher.'); }
    applyThemeBackground(theme);
    renderBgImageSettings();
  });
  document.getElementById('bg-image-size').addEventListener('change', e => updateBuiltinBgMeta({ size: e.target.value }));
  document.getElementById('bg-dim-slider').addEventListener('input', e => {
    const dim = parseInt(e.target.value, 10);
    document.getElementById('bg-dim-label').textContent = dim + '%';
    updateBuiltinBgMeta({ dim });
  });
}

// =========================================================================
// EDITOR-EVENTS
// =========================================================================

function initThemeBuilder() {
  const overlay = document.getElementById('theme-builder-overlay');
  if (!overlay) return;

  document.getElementById('theme-builder-open-btn')?.addEventListener('click', () => openThemeBuilder(null));
  tbEl('close').addEventListener('click', closeThemeBuilder);
  tbEl('cancel').addEventListener('click', closeThemeBuilder);
  tbEl('save').addEventListener('click', saveThemeBuilder);
  tbEl('delete').addEventListener('click', async () => {
    const id = _teBuilderEditId;
    const ct = id && getCustomTheme(id);
    if (!ct) return;
    const ok = await hubConfirm({ title: 'Theme löschen?', message: `„${ct.name}" wird endgültig gelöscht.`, confirmText: 'Löschen', danger: true });
    if (!ok) return;
    closeThemeBuilder();
    deleteCustomTheme(id);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeThemeBuilder(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeThemeBuilder();
  });

  ['bg', 'surface', 'nav', 'modal', 'text', 'border', 'accent', 'opacity', 'fontsize', 'bg-dim']
    .forEach(k => tbEl(k).addEventListener('input', previewThemeBuilderLive));
  ['quicknote', 'highlight'].forEach(k => tbEl(k).addEventListener('input', () => {
    tbEl(k).dataset.auto = '0';
    previewThemeBuilderLive();
  }));
  ['bg-size', 'calendar-image', 'start-header', 'branding-theme', 'questboard-style', 'pinboard-style', 'guides-style']
    .forEach(k => tbEl(k).addEventListener('change', previewThemeBuilderLive));

  // Schriftart-Dropdowns (Fließtext + Überschriften): Trigger togglet,
  // Klick außerhalb schließt.
  ['font', 'heading-font'].forEach(key => {
    tbEl(key + '-trigger').addEventListener('click', e => {
      e.stopPropagation();
      tbEl(key + '-panel').classList.toggle('hidden');
    });
    document.addEventListener('click', e => {
      const panel = tbEl(key + '-panel');
      if (!panel.classList.contains('hidden') && !panel.contains(e.target) && !tbEl(key + '-trigger').contains(e.target)) {
        panel.classList.add('hidden');
      }
    });
  });

  // Hintergrund
  tbEl('bg-source').addEventListener('change', () => { syncThemeBuilderBgUI(); previewThemeBuilderLive(); });
  tbEl('bg-pick-btn').addEventListener('click', () => tbEl('bg-file-input').click());
  tbEl('bg-clear-btn').addEventListener('click', () => {
    _teBuilderBgData = null; _teBuilderBgName = null;
    syncThemeBuilderBgUI(); previewThemeBuilderLive();
  });
  tbEl('bg-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { _teBuilderBgData = await downscaleImageFile(file); _teBuilderBgName = file.name; }
    catch { alert('Dieses Bild konnte nicht geladen werden.'); return; }
    syncThemeBuilderBgUI(); previewThemeBuilderLive();
  });

  // Tag/Nacht: Schalter blendet Tag/Nacht-Umschalter ein; beim Einschalten
  // direkt in die (neue) Nachtversion wechseln, beim Ausschalten zurück
  // zum Tag (die Nachtversion wird erst beim Speichern verworfen).
  tbEl('daynight').addEventListener('change', e => {
    tbEl('variant-row').classList.toggle('hidden', !e.target.checked);
    switchThemeBuilderVariant(e.target.checked ? 'night' : 'day');
  });
  tbEl('variant-day').addEventListener('click', () => switchThemeBuilderVariant('day'));
  tbEl('variant-night').addEventListener('click', () => switchThemeBuilderVariant('night'));

  // Grafische Elemente
  tbEl('graphics-mode-theme').addEventListener('click', () => {
    setGraphicsModeUI('theme');
    applyGraphicsThemeToControls(tbEl('graphics-theme').value);
  });
  tbEl('graphics-mode-custom').addEventListener('click', () => setGraphicsModeUI('custom'));
  tbEl('graphics-theme').addEventListener('change', e => applyGraphicsThemeToControls(e.target.value));
}

// =========================================================================
// INIT
// main.js hat data-theme/-family beim Laden bereits gesetzt — hier
// zusätzlich Farben, Hintergrund, Kalender, Start-Banner und Icon des
// aktiven Themes anwenden.
// =========================================================================
initThemeBuilder();
initBgImageSettings();
// Gespeichertes Theme existiert nicht mehr (eigenes Theme auf einem anderen
// Gerät gelöscht und per Sync entfernt, Preset aus dem Code genommen) →
// sauber auf Cozy zurück statt halb angewendeter Farben.
if (!THEME_FAMILY[theme] && !getCustomTheme(theme)) {
  const base = theme.endsWith(NIGHT_SUFFIX) ? theme.slice(0, -NIGHT_SUFFIX.length) : null;
  setTheme(base && getCustomTheme(base) ? base : 'light');
}
else applyThemeEngine(theme);
// Sonne/Mond-Knopf (today.js) wurde beim Laden geprüft, bevor diese Datei
// da war — Presets/eigene Themes mit Nachtversion galten da noch als
// "ohne Tag/Nacht" und der Knopf blieb versteckt. Jetzt neu prüfen.
if (typeof updateThemeIcon === 'function') updateThemeIcon();
// settings.js zeigt beim Laden bereits die zuletzt offene View an — ist das
// die Einstellungsseite, wurde die Theme-Auswahl gezeichnet, BEVOR diese
// Datei geladen war (also ohne Preset-/eigene Themes). Daher hier einmal
// nachzeichnen.
if (typeof renderThemeSettings === 'function') renderThemeSettings();
