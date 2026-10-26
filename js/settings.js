// =========================
// SETTINGS
// Gliederung der Seite (index.html #view-settings): Allgemein, Darstellung,
// Navigation, Heute-Seite, Integrationen, Daten, Gefahrenzone, Über Nook —
// jeweils eine .settings-group, erreichbar über die Sprungleiste oben.
// =========================

function renderSettings(){
  document.getElementById('setting-username').value = userName || '';
  renderStartViewSettings();
  renderThemeSettings();
  renderDisplaySettings();
  renderBlockSettings();
  renderWeatherSettings();
  renderColorSettings();
  renderTabVisibilitySettings();
  renderBottomNavSettings();
  renderBackupSettings();
  renderStorageSettings();
  renderAboutSettings();
  if (typeof renderPositivitySettings === 'function') renderPositivitySettings();
  if (typeof renderTodayTrackerSettings === 'function') renderTodayTrackerSettings();
  if (typeof renderTodayBudgetDueSettings === 'function') renderTodayBudgetDueSettings();
  if (typeof renderGoogleCalendarSettings === 'function') renderGoogleCalendarSettings();
}

// Anzeigenamen aller Views — für Startbildschirm- und Bottom-Nav-Auswahl.
function settingsViewLabel(id) {
  if (id === 'today') return 'Heute';
  if (id === 'settings') return 'Einstellungen';
  const tab = TAB_VISIBILITY_CONFIG.find(t => t.id === id);
  return tab ? tab.label : id;
}

// ── Bereiche ein-/ausklappen ─────────────────────────────────────────────
// Titel jeder .settings-group ist ein Button; zugeklappte Bereiche merkt
// sich jedes Gerät selbst (sync.js: lokaler Key, wie sidebarCollapsed).
let settingsCollapsedGroups = DB.get('settingsCollapsedGroups', []);
function saveSettingsCollapsedGroups(){ DB.set('settingsCollapsedGroups', settingsCollapsedGroups); }

function applySettingsGroupCollapse() {
  document.querySelectorAll('#view-settings .settings-group').forEach(group => {
    const collapsed = settingsCollapsedGroups.includes(group.id);
    group.classList.toggle('collapsed', collapsed);
    group.querySelector('.settings-group-toggle')?.setAttribute('aria-expanded', String(!collapsed));
  });
}
function setSettingsGroupCollapsed(id, collapsed) {
  settingsCollapsedGroups = settingsCollapsedGroups.filter(g => g !== id);
  if (collapsed) settingsCollapsedGroups.push(id);
  saveSettingsCollapsedGroups();
  applySettingsGroupCollapse();
}
applySettingsGroupCollapse();

// ── Sprungleiste + Klapp-Titel ───────────────────────────────────────────
// Chips oben klappen den Bereich bei Bedarf auf und scrollen hin; der Chip
// des gerade sichtbaren Bereichs wird per IntersectionObserver hervorgehoben.
document.getElementById('view-settings')?.addEventListener('click', e => {
  const toggle = e.target.closest('.settings-group-toggle');
  if (toggle) {
    const group = toggle.closest('.settings-group');
    setSettingsGroupCollapsed(group.id, !group.classList.contains('collapsed'));
    return;
  }
  const btn = e.target.closest('.settings-jump-btn');
  if (!btn) return;
  if (settingsCollapsedGroups.includes(btn.dataset.target)) setSettingsGroupCollapsed(btn.dataset.target, false);
  document.getElementById(btn.dataset.target)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
});

// ── Nach-oben-Button (unten rechts, wie in den Anleitungen) ──────────────
// Liegt in #view-settings, ist also nur auf dieser Seite überhaupt da;
// eingeblendet, sobald die Seite ein Stück gescrollt ist.
function updateSettingsScrollTop() {
  document.getElementById('settings-scroll-top')?.classList.toggle('visible', window.scrollY > 300);
}
window.addEventListener('scroll', updateSettingsScrollTop, { passive: true });
document.getElementById('settings-scroll-top')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
});
if ('IntersectionObserver' in window) {
  const settingsJumpObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      document.querySelectorAll('.settings-jump-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.target === entry.target.id);
      });
    });
  }, { rootMargin: '-15% 0px -70% 0px' });
  document.querySelectorAll('.settings-group').forEach(g => settingsJumpObserver.observe(g));
}

// Aufklappbare Panel-Köpfe (z.B. Google Calendar) sind <div role="button">
// — Enter/Leertaste lösen wie bei einem echten Button den Klick aus.
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const header = e.target.closest?.('.panel-header-toggle[role="button"]');
  if (!header || e.target !== header) return;
  e.preventDefault();
  header.click();
});

// ── Allgemein: Startbildschirm ───────────────────────────────────────────
function renderStartViewSettings() {
  const sel = document.getElementById('setting-start-view');
  if (!sel) return;
  const ids = ['today', ...tabOrder, 'settings'];
  sel.innerHTML = `<option value="last">Zuletzt geöffneter Tab</option>` + ids.map(id =>
    `<option value="${id}">${escHtml(settingsViewLabel(id))}${hiddenTabs.includes(id) ? ' (ausgeblendet)' : ''}</option>`
  ).join('');
  sel.value = ids.includes(startView) ? startView : 'last';
}
document.getElementById('setting-start-view')?.addEventListener('change', e => {
  startView = e.target.value;
  saveStartView();
});

// =========================
// SICHTBARE TABS + REIHENFOLGE
// Rein UI-seitig — der eigentliche Zustand (hiddenTabs, tabOrder) und die
// Liste toggelbarer Tabs (TAB_VISIBILITY_CONFIG) leben in main.js, weil sie
// auch von applyTabVisibility()/applyTabOrder() (Sidebar/Bottom-Nav/"Mehr")
// gebraucht werden. Die Zeilen hier werden in tabOrder-Reihenfolge
// gerendert, mit Auf/Ab-Pfeilen statt Drag&Drop — robuster auf Touch und
// ohne zusätzliche Library.
// =========================

function renderTabVisibilitySettings(){
  const list = document.getElementById('tab-visibility-list');
  if (!list) return;
  const tabsById = {};
  TAB_VISIBILITY_CONFIG.forEach(t => { tabsById[t.id] = t; });
  list.innerHTML = tabOrder.map((id, i) => {
    const tab = tabsById[id];
    if (!tab) return '';
    return `
    <div class="settings-row tab-order-row">
      <div class="tab-order-controls">
        <button type="button" class="icon-btn tab-order-up" data-tab="${tab.id}" ${i === 0 ? 'disabled' : ''} aria-label="${escHtml(tab.label)} nach oben">▲</button>
        <button type="button" class="icon-btn tab-order-down" data-tab="${tab.id}" ${i === tabOrder.length - 1 ? 'disabled' : ''} aria-label="${escHtml(tab.label)} nach unten">▼</button>
      </div>
      <div class="settings-row-title">${escHtml(tab.label)}</div>
      <label class="toggle" title="${escHtml(tab.label)} anzeigen">
        <input type="checkbox" class="tab-visibility-cb" data-tab="${tab.id}" aria-label="${escHtml(tab.label)} anzeigen" ${hiddenTabs.includes(tab.id) ? '' : 'checked'}/>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
  }).join('');
  list.querySelectorAll('.tab-visibility-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.tab;
      if (cb.checked) hiddenTabs = hiddenTabs.filter(t => t !== id);
      else if (!hiddenTabs.includes(id)) hiddenTabs.push(id);
      saveHiddenTabs();
      applyTabVisibility();
      renderStartViewSettings();
      renderBottomNavSettings();
    });
  });
  list.querySelectorAll('.tab-order-up').forEach(btn => {
    btn.addEventListener('click', () => moveTabOrder(btn.dataset.tab, -1));
  });
  list.querySelectorAll('.tab-order-down').forEach(btn => {
    btn.addEventListener('click', () => moveTabOrder(btn.dataset.tab, 1));
  });
}

function moveTabOrder(id, dir){
  const i = tabOrder.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= tabOrder.length) return;
  [tabOrder[i], tabOrder[j]] = [tabOrder[j], tabOrder[i]];
  saveTabOrder();
  applyTabOrder();
  renderTabVisibilitySettings();
  renderStartViewSettings();
  renderBottomNavSettings();
  // Fokus nach dem Neurendern auf demselben Pfeil halten (Tastaturbedienung).
  const cls = dir < 0 ? '.tab-order-up' : '.tab-order-down';
  const again = document.querySelector(`#tab-visibility-list ${cls}[data-tab="${id}"]`);
  (again && !again.disabled ? again : document.querySelector(`#tab-visibility-list .tab-visibility-cb[data-tab="${id}"]`))?.focus();
}

// ── Navigation: Leiste unten (Handy) ─────────────────────────────────────
// Vier Plätze, je ein Auswahlfeld. Wählt man einen Tab, der schon auf einem
// anderen Platz steht, tauschen die beiden Plätze (keine Doppelten).
function renderBottomNavSettings() {
  const list = document.getElementById('bottom-nav-settings-list');
  if (!list) return;
  const ids = ['today', ...tabOrder];
  const slots = [];
  for (let i = 0; i < BOTTOM_NAV_SLOTS; i++) slots.push(bottomNavTabs[i] || BOTTOM_NAV_DEFAULT[i]);
  list.innerHTML = slots.map((current, i) => {
    const replaced = current !== 'today' && hiddenTabs.includes(current);
    return `
    <div class="settings-row">
      <div><div class="settings-row-title">Platz ${i + 1}</div>${replaced ? `<div class="settings-row-sub">ausgeblendet — wird automatisch durch einen anderen Tab ersetzt</div>` : ''}</div>
      <select class="modal-select settings-select bottom-nav-slot" data-slot="${i}" aria-label="Platz ${i + 1} der unteren Leiste">
        ${ids.map(id => `<option value="${id}" ${id === current ? 'selected' : ''}>${escHtml(settingsViewLabel(id))}${hiddenTabs.includes(id) ? ' (ausgeblendet)' : ''}</option>`).join('')}
      </select>
    </div>`;
  }).join('');
  list.querySelectorAll('.bottom-nav-slot').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = Number(sel.dataset.slot);
      const next = slots.slice();
      const j = next.indexOf(sel.value);
      if (j !== -1 && j !== i) next[j] = next[i];
      next[i] = sel.value;
      bottomNavTabs = next;
      saveBottomNavTabs();
      applyBottomNav();
      renderBottomNavSettings();
    });
  });
}
document.getElementById('bottom-nav-reset-btn')?.addEventListener('click', () => {
  bottomNavTabs = BOTTOM_NAV_DEFAULT.slice();
  saveBottomNavTabs();
  applyBottomNav();
  renderBottomNavSettings();
});

// ── Darstellung: Lesbarkeit + Seitenleiste ───────────────────────────────
function renderDisplaySettings() {
  const range = document.getElementById('setting-font-scale');
  if (range) {
    range.value = uiFontScale;
    document.getElementById('setting-font-scale-label').textContent = `${uiFontScale} %`;
  }
  const motion = document.getElementById('setting-reduce-motion');
  if (motion) motion.checked = !!reduceMotion;
  const collapsed = document.getElementById('setting-sidebar-collapsed');
  if (collapsed) collapsed.checked = !!sidebarCollapsed;
}
function setUiFontScale(pct, persist) {
  uiFontScale = Math.min(Math.max(Number(pct) || 100, UI_FONT_SCALE_MIN), UI_FONT_SCALE_MAX);
  applyUiPrefs();
  const label = document.getElementById('setting-font-scale-label');
  if (label) label.textContent = `${uiFontScale} %`;
  if (persist) saveUiFontScale();
}
document.getElementById('setting-font-scale')?.addEventListener('input', e => setUiFontScale(e.target.value, false));
document.getElementById('setting-font-scale')?.addEventListener('change', e => setUiFontScale(e.target.value, true));
document.getElementById('setting-font-scale-reset')?.addEventListener('click', () => {
  setUiFontScale(100, true);
  renderDisplaySettings();
});
document.getElementById('setting-reduce-motion')?.addEventListener('change', e => {
  reduceMotion = e.target.checked;
  saveReduceMotion();
  applyUiPrefs();
});
document.getElementById('setting-sidebar-collapsed')?.addEventListener('change', e => {
  sidebarCollapsed = e.target.checked;
  saveSidebarCollapsed();
  applyUiPrefs();
  updateSidebarCollapseBtn();
});
// Pfeil in der Sidebar ändert denselben Zustand — Schalter hier nachziehen.
document.getElementById('sidebar-collapse-btn')?.addEventListener('click', () => {
  const collapsed = document.getElementById('setting-sidebar-collapsed');
  if (collapsed) collapsed.checked = !!sidebarCollapsed;
});

// ── Theme-Auswahl (Phase 2 Theme-Engine) ─────────────────────────────────
function renderThemeSettings(){
  const picker = document.getElementById('theme-picker');
  if (!picker) return;
  picker.querySelectorAll('.theme-picker-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeValue === themePickerId(theme));
  });
  // Tag/Nacht-Schalter nur bei Themes mit Tag- und Nachtversion (main.js).
  const dnRow = document.getElementById('daynight-toggle-row');
  if (dnRow) {
    dnRow.classList.toggle('hidden', !dayNightBase(theme));
    document.getElementById('setting-daynight-toggle').checked = isDayNightToggleOn();
  }
  // Automatischer Tag/Nacht-Wechsel (main.js: themeAutoMode) — ebenfalls
  // nur bei Themes mit Tag- und Nachtversion sinnvoll.
  const autoRow = document.getElementById('daynight-auto-row');
  if (autoRow) {
    autoRow.classList.toggle('hidden', !dayNightBase(theme));
    document.getElementById('setting-daynight-auto').value = themeAutoMode;
    const sub = document.getElementById('daynight-auto-sub');
    if (sub) sub.textContent = themeAutoMode === 'sun'
      ? 'Nach Sonnenauf- und -untergang am Wetter-Standort (ohne Wetterdaten 7–19 Uhr)'
      : themeAutoMode === 'system'
        ? 'Folgt dem hellen/dunklen Modus deines Geräts'
        : 'Wechselt selbst zwischen Tag- und Nachtversion';
  }
  // Eigene Themes + Hintergrundbild (Theme-Builder) — eigenständiges Modul,
  // gleiches Muster wie renderColorLibrary() unten für die persönlichen Farben.
  if (typeof renderCustomThemeButtons === 'function') renderCustomThemeButtons();
  if (typeof renderBgImageSettings === 'function') renderBgImageSettings();
}

// =========================
// PERSÖNLICHE FARBEN VERWALTEN
// Nutzt die geteilte renderColorLibrary() aus hub-utils.js — hier mit
// deletable:true, im Gegensatz zu allen Farbwählern in Modalen (Karten,
// Guides, Kalender), die weiterhin nur zum Auswählen/Speichern dienen.
// =========================

function renderColorSettings(){
  const lib   = document.getElementById('settings-color-library');
  const empty = document.getElementById('settings-color-empty');
  if (!lib) return;
  empty.style.display = hubUserColors.length ? 'none' : 'block';
  renderColorLibrary('settings-color-library', {
    deletable: true,
    onSelect: () => {}, // Auswahl hat in der Verwaltung keine Wirkung, nur Löschen
    onDelete: () => { empty.style.display = hubUserColors.length ? 'none' : 'block'; }
  });

  const lToD = document.getElementById('color-autoadjust-light-to-dark');
  const dToL = document.getElementById('color-autoadjust-dark-to-light');
  if (lToD) lToD.checked = colorAutoAdjustSettings.lightToDark;
  if (dToL) dToL.checked = colorAutoAdjustSettings.darkToLight;
}

// ── Theme-Anpassung für neu erstellte Nutzerfarben (Standardverhalten) ──
// Wirkt nur auf Farben, die ab jetzt zur Bibliothek hinzugefügt werden —
// siehe initColorPickerWidget() in hub-utils.js.
document.getElementById('color-autoadjust-light-to-dark')?.addEventListener('change', e => {
  colorAutoAdjustSettings.lightToDark = e.target.checked;
  saveColorAutoAdjustSettings();
});
document.getElementById('color-autoadjust-dark-to-light')?.addEventListener('change', e => {
  colorAutoAdjustSettings.darkToLight = e.target.checked;
  saveColorAutoAdjustSettings();
});

function renderWeatherSettings() {
  const ws = DB.get('weatherSettings', { mode: 'manual', city: 'Cologne' });
  const gpsBtn  = document.getElementById('weather-mode-gps');
  const manBtn  = document.getElementById('weather-mode-manual');
  const cityRow = document.getElementById('weather-city-row');
  const cityIn  = document.getElementById('weather-city-input');
  if (!gpsBtn) return;
  gpsBtn.classList.toggle('active', ws.mode === 'gps');
  manBtn.classList.toggle('active', ws.mode !== 'gps');
  cityRow.style.display = ws.mode === 'gps' ? 'none' : 'flex';
  cityIn.value = ws.city || '';
}

// Hinweis unter dem Wetter-Panel, wenn das Laden scheitert (today.js:
// renderWeather() liefert { ok, reason }).
const WEATHER_STATUS_TEXT = {
  denied:      'Standortzugriff verweigert — erlaube ihn in den Browser-Einstellungen oder nutze „Manuell“.',
  unavailable: 'Standort konnte nicht ermittelt werden — versuche es später erneut oder nutze „Manuell“.',
  notfound:    'Stadt nicht gefunden — bitte die Schreibweise prüfen (z.B. „Cologne“ oder „Köln“).',
  network:     'Wetterdaten konnten nicht geladen werden — bist du offline?',
};
async function refreshWeatherWithStatus() {
  const status = document.getElementById('weather-status');
  if (typeof renderWeather !== 'function') return;
  if (status) { status.textContent = 'Wetter wird geladen …'; status.classList.remove('hidden', 'settings-status-error'); }
  const result = await renderWeather();
  if (!status) return;
  if (!result || result.ok) { status.classList.add('hidden'); return; }
  status.textContent = WEATHER_STATUS_TEXT[result.reason] || WEATHER_STATUS_TEXT.network;
  status.classList.add('settings-status-error');
}

// Benutzername
document.getElementById('setting-username').addEventListener('input', e => {
  userName = e.target.value.trim();
  DB.set('userName', userName);
  if (typeof renderTodayHeader === 'function') renderTodayHeader();
});

document.getElementById('theme-picker')?.addEventListener('click', e => {
  const btn = e.target.closest('.theme-picker-btn');
  if (!btn) return;
  // Klick auf das bereits aktive Tag/Nacht-Theme behält die aktuelle Version.
  if (btn.dataset.themeValue !== themePickerId(theme)) {
    // War das bisherige Theme dunkel und hat das neue eine Nachtversion,
    // direkt in die Nacht wechseln statt grell in den Tag (Augen schonen).
    const wasDark = document.documentElement.getAttribute('data-theme-family') === 'dark';
    const night = nightThemeId(btn.dataset.themeValue);
    setTheme(wasDark && night ? night : btn.dataset.themeValue);
    applyThemeAuto(true); // bei aktiver Automatik gleich die passende Version
  }
  renderThemeSettings();
});

document.getElementById('setting-daynight-auto')?.addEventListener('change', e => {
  themeAutoMode = e.target.value;
  saveThemeAutoMode();
  applyThemeAuto(true);
  renderThemeSettings();
});

document.getElementById('setting-daynight-toggle')?.addEventListener('change', e => {
  const base = dayNightBase(theme);
  if (!base) return;
  if (e.target.checked) delete dayNightToggle[base]; else dayNightToggle[base] = false;
  saveDayNightToggle();
  if (typeof updateThemeIcon === 'function') updateThemeIcon();
});

// ── Eigenes HH:MM-24h-Feld für Unterrichtsblock-Zeiten ──────────────────
// Ersetzt das native <input type="time">: dessen sichtbare 12h/24h-
// Darstellung wird vom Browser anhand der System-/Browser-Locale
// bestimmt (nicht zuverlässig per lang-Attribut erzwingbar — genau das
// wurde geprüft und bestätigt) und lässt sich vom Seiteninhalt aus nicht
// robust auf 24h festlegen. Deshalb hier ein simples, selbst gerendertes
// Textfeld: garantiert immer HH:MM, unabhängig von Locale/Browser/OS.
// Speicherformat bleibt unverändert HH:MM (24h) — dieselbe String-Form,
// die blocks[idx].start/.end schon vorher hatten.

// Baut aus rohen Ziffern (bis zu 4) live "HH:MM" auf, während getippt
// wird — z.B. "1430" → "14:30". Kein Validieren/Klemmen hier, das passiert
// erst bei normalizeBlockTime() beim Verlassen des Feldes, damit man
// während der Eingabe nicht ständig korrigiert wird.
function formatBlockTimeLive(el) {
  const digits = el.value.replace(/\D/g, '').slice(0, 4);
  el.value = digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
}

// Wandelt eine Rohsingabe in ein gültiges "HH:MM" um oder gibt null
// zurück, wenn sich daraus keine Uhrzeit ableiten lässt (zu kurz, keine
// Ziffern). Kurzschreibweisen wie "830" werden als "08:30" interpretiert
// (padStart füllt von links auf 4 Ziffern auf). Stunden/Minuten außerhalb
// des gültigen Bereichs werden auf 00–23 bzw. 00–59 geklemmt, damit immer
// eine echte Uhrzeit herauskommt statt eines ungültigen Wertes.
function normalizeBlockTime(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length < 3) return null;
  const padded = digits.padStart(4, '0').slice(-4);
  let hh = parseInt(padded.slice(0, 2), 10);
  let mm = parseInt(padded.slice(2, 4), 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  hh = Math.min(Math.max(hh, 0), 23);
  mm = Math.min(Math.max(mm, 0), 59);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// ── 24h-Zwei-Wheel-Zeitpicker (zusätzlich zur freien HH:MM-Eingabe oben) ──
// Der native <input type="time"> wurde geprüft und verworfen: selbst mit
// Browser-Kontext-Locale "de-DE" (stärker als das lang-Attribut) rendert
// Chromium ihn weiterhin mit AM/PM ("02:30 PM") — das Format wird intern
// von Blink anhand der UI-Sprache des Browsers entschieden, nicht anhand
// von Seiteninhalt. Deshalb: eigener Zwei-Wheel-Picker (Stunde 00–23 /
// Minute 00–59), volle Kontrolle über das Format. Ein einziges,
// wiederverwendetes Panel statt eines pro Zeile (umgeht außerdem das
// overflow:hidden von .panel, siehe CSS-Kommentar).
//
// Jedes Wheel ist ein normal scrollbarer Container mit CSS scroll-snap;
// die Zeile in der Mitte ist die Auswahl. Geometrie: Item-Höhe 30px,
// Wheel-Höhe 150px (= 5 Items), Padding oben/unten je 60px (= 2 Items) —
// damit lässt sich Index i exakt über scrollTop = i * 30 zentrieren
// (siehe Kommentar an WHEEL_ITEM_H unten für die Herleitung).
const WHEEL_ITEM_H = 30;

let _bsTimePickerTarget = null; // { input, block, key } — aktuell geöffnetes Ziel, oder null

function buildBsWheel(id, count, label) {
  const pad = `<div class="bs-wheel-pad" aria-hidden="true"></div>`;
  const items = Array.from({ length: count }, (_, i) =>
    `<button type="button" class="bs-wheel-item" data-idx="${i}">${String(i).padStart(2, '0')}</button>`
  ).join('');
  return `<div class="bs-wheel" id="${id}" tabindex="0" role="listbox" aria-label="${label}">${pad}${items}${pad}</div>`;
}

function ensureBlockTimePickerPanel() {
  let panel = document.getElementById('bs-time-picker-panel');
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = 'bs-time-picker-panel';
  panel.className = 'bs-time-panel hidden';
  panel.innerHTML = `
    <div class="bs-wheel-row">
      <div class="bs-wheel-band"></div>
      ${buildBsWheel('bs-wheel-hour', 24, 'Stunde')}
      <div class="bs-wheel-colon">:</div>
      ${buildBsWheel('bs-wheel-minute', 60, 'Minute')}
    </div>
    <div class="bs-picker-actions">
      <button type="button" class="bs-picker-btn bs-picker-cancel">Abbrechen</button>
      <button type="button" class="bs-picker-btn bs-picker-ok">Übernehmen</button>
    </div>`;
  document.body.appendChild(panel);

  const hourWheel = panel.querySelector('#bs-wheel-hour');
  const minuteWheel = panel.querySelector('#bs-wheel-minute');
  [hourWheel, minuteWheel].forEach(wheel => initBsWheelScroll(wheel));

  // Klick auf ein Item scrollt es zentriert (schneller Weg statt Scrollen).
  panel.addEventListener('click', e => {
    const item = e.target.closest('.bs-wheel-item');
    if (item) {
      const wheel = item.closest('.bs-wheel');
      snapBsWheelTo(wheel, parseInt(item.dataset.idx, 10), true);
    }
  });

  panel.querySelector('.bs-picker-ok').addEventListener('click', () => {
    if (!_bsTimePickerTarget) return;
    const { input, block, key } = _bsTimePickerTarget;
    const hh = readBsWheelIndex(hourWheel);
    const mm = readBsWheelIndex(minuteWheel);
    const value = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    input.value = value;
    block[key] = value;
    saveBlocks();
    validateBlockSettings();
    if (currentView === 'today') renderBlocks();
    closeBlockTimePicker();
  });
  panel.querySelector('.bs-picker-cancel').addEventListener('click', () => closeBlockTimePicker());

  return panel;
}

// Liest, welches Item aktuell mittig steht (nächster gerasteter Index zur
// aktuellen scrollTop-Position) — unabhängig davon, ob der Snap bereits
// fertig eingerastet ist (z.B. wenn "Übernehmen" mitten im Scrollen
// geklickt wird, soll trotzdem der zum aktuellen Stand nächste Wert gelten).
function readBsWheelIndex(wheel) {
  const max = wheel.querySelectorAll('.bs-wheel-item').length - 1;
  const idx = Math.round(wheel.scrollTop / WHEEL_ITEM_H);
  return Math.min(Math.max(idx, 0), max);
}

function snapBsWheelTo(wheel, idx, smooth) {
  const max = wheel.querySelectorAll('.bs-wheel-item').length - 1;
  idx = Math.min(Math.max(idx, 0), max);
  wheel.scrollTo({ top: idx * WHEEL_ITEM_H, behavior: smooth ? 'smooth' : 'instant' });
  markBsWheelActive(wheel, idx);
}

function markBsWheelActive(wheel, idx) {
  wheel.querySelectorAll('.bs-wheel-item.active').forEach(el => el.classList.remove('active'));
  const el = wheel.querySelector(`.bs-wheel-item[data-idx="${idx}"]`);
  if (el) el.classList.add('active');
}

// Rastet nach Scrollende (Maus/Trackpad/Touch/Swipe) sauber auf den
// nächstgelegenen Wert ein. "Scrollende" wird per Debounce erkannt (kein
// verlässliches natives "scrollend" in allen Zielumgebungen) — 120ms ohne
// weiteres Scroll-Event gilt als Ende der Geste.
function initBsWheelScroll(wheel) {
  let debounce = null;
  wheel.addEventListener('scroll', () => {
    markBsWheelActive(wheel, readBsWheelIndex(wheel));
    clearTimeout(debounce);
    debounce = setTimeout(() => snapBsWheelTo(wheel, readBsWheelIndex(wheel), true), 120);
  });
}

function closeBlockTimePicker() {
  const panel = document.getElementById('bs-time-picker-panel');
  if (panel) panel.classList.add('hidden');
  _bsTimePickerTarget = null;
}

function openBlockTimePicker(trigger, input, block, key) {
  const panel = ensureBlockTimePickerPanel();
  const alreadyOpenForThis = !panel.classList.contains('hidden') && _bsTimePickerTarget && _bsTimePickerTarget.input === input;
  if (alreadyOpenForThis) { closeBlockTimePicker(); return; }
  _bsTimePickerTarget = { input, block, key, trigger };
  panel.classList.remove('hidden');
  positionBlockTimePicker();

  const current = normalizeBlockTime(input.value) || block[key] || '00:00';
  const [hh, mm] = current.split(':').map(n => parseInt(n, 10));
  const hourWheel = panel.querySelector('#bs-wheel-hour');
  const minuteWheel = panel.querySelector('#bs-wheel-minute');
  // Ohne rAF greift scrollTo auf einem Element mit display:none (vom
  // vorherigen "hidden") teils noch nicht zuverlässig — erst nach dem
  // Entfernen der Klasse einen Frame abwarten.
  requestAnimationFrame(() => {
    snapBsWheelTo(hourWheel, hh, false);
    snapBsWheelTo(minuteWheel, mm, false);
  });
}

// Grob zentriert unter dem schmalen Trigger, aber immer im sichtbaren
// Bereich: rechts/links begrenzt, unten kein Platz → oberhalb öffnen.
function positionBlockTimePicker() {
  const panel = document.getElementById('bs-time-picker-panel');
  if (!panel || !_bsTimePickerTarget) return;
  const rect = _bsTimePickerTarget.trigger.getBoundingClientRect();
  // Trigger aus dem Bild gescrollt → Picker schließen statt schweben lassen.
  if (rect.bottom < 0 || rect.top > window.innerHeight) { closeBlockTimePicker(); return; }
  const pw = panel.offsetWidth, ph = panel.offsetHeight;
  const left = Math.min(Math.max(4, rect.left - 70), window.innerWidth - pw - 4);
  let top = rect.bottom + 4;
  if (top + ph > window.innerHeight - 4) top = Math.max(4, rect.top - ph - 4);
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
}
// Fixed positioniert → beim Scrollen der Seite (nicht der Wheels im Picker
// selbst) und bei Größenänderung neu ausrichten.
document.addEventListener('scroll', e => {
  const panel = document.getElementById('bs-time-picker-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  if (e.target instanceof Node && panel.contains(e.target)) return;
  positionBlockTimePicker();
}, true);
window.addEventListener('resize', () => positionBlockTimePicker());

document.addEventListener('click', e => {
  const panel = document.getElementById('bs-time-picker-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  if (panel.contains(e.target) || e.target.closest('.bs-time-trigger')) return;
  closeBlockTimePicker();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBlockTimePicker(); });

// ── Drag & Drop zum Sortieren der Unterrichtsblöcke ──────────────────────
// Pointer Events statt der nativen HTML5-Drag&Drop-API, weil diese auf
// Touch nicht funktioniert (dasselbe Grundprinzip wie beim bestehenden
// Finanzgarten-Drag in js/budget-analysis.js: Ziehen startet ausschließlich
// über einen kleinen Handle, mit Schwellwert, damit ein normaler Klick
// nicht versehentlich als Drag gewertet wird).
//
// WICHTIG — vorherige Fassung war komplett funktionsunfähig: pointermove/
// pointerup waren auf dem HANDLE registriert, kombiniert mit
// handle.setPointerCapture(). Sobald der erste Reorder-Schritt per
// list.insertBefore(row, ...) die gezogene Zeile (und damit den Handle als
// ihr Kind) im DOM verschob, feuerte Chromium sofort "lostpointercapture"
// und lieferte dem Handle danach keinerlei weitere pointermove/pointerup-
// Events mehr aus — bestätigt per echtem Playwright/Chromium-Trace: nach
// exakt einem insertBefore kam "lostpointercapture" und der Drag "hing"
// unwiderruflich fest (genau das vom Nutzer beschriebene "funktioniert
// überhaupt nicht"). Der Finanzgarten-Drag hat dieses Problem nie, weil er
// pointermove/pointerup von Anfang an auf document registriert (siehe
// makeGeldflussDraggable) und gar kein setPointerCapture verwendet — exakt
// dieses Muster wird hier übernommen: document-Listener statt Handle-
// Listener, kein setPointerCapture. Reihenfolge wird weiterhin direkt aus
// der DOM-Reihenfolge nach dem Loslassen ins bestehende blocks-Array
// übernommen — keine separate blockOrder-Struktur nötig, da blocks bereits
// als geordnete Liste gespeichert wird.
function initBlockDragHandle(handle, row, block) {
  const DRAG_THRESHOLD = 4;

  handle.addEventListener('pointerdown', e => {
    if (e.button > 0) return; // nur primäre Taste/Touch/Pen
    e.preventDefault();
    const list = document.getElementById('blocks-settings-list');
    const startY = e.clientY;
    let dragging = false;

    function onMove(ev) {
      if (!dragging) {
        if (Math.abs(ev.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        row.classList.add('bs-dragging');
      }
      // Verhindert auf Touch, dass die Settings-Seite während des Ziehens
      // gleichzeitig nativ mitscrollt (Maus/Pen scrollen dadurch ohnehin
      // nicht — e.cancelable schützt gegen evtl. passive Listener).
      if (ev.cancelable) ev.preventDefault();
      const y = ev.clientY;
      for (const r of list.children) {
        if (r === row) continue;
        const rect = r.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) {
          const before = y < rect.top + rect.height / 2;
          list.insertBefore(row, before ? r : r.nextSibling);
          break;
        }
      }
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      if (!dragging) return;
      row.classList.remove('bs-dragging');
      // Neue Reihenfolge aus der tatsächlichen DOM-Reihenfolge lesen (per
      // stabiler block-id, nicht per Index) und ins Datenmodell übernehmen.
      const newOrder = Array.from(list.children)
        .map(r => blocks.find(b => String(b.id) === r.dataset.blockId))
        .filter(Boolean);
      blocks.splice(0, blocks.length, ...newOrder);
      saveBlocks();
      renderBlockSettings();
      if (currentView === 'today') renderBlocks();
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });

  // Optionale Tastaturbedienung: fokussierter Handle + Pfeiltasten
  // vertauscht mit dem Nachbarblock. Sekundär zum Drag & Drop, aber ohne
  // nennenswerten Zusatzaufwand über dieselbe Speicherlogik umsetzbar.
  handle.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const idx = blocks.indexOf(block);
    const swapWith = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
    if (idx === -1 || swapWith < 0 || swapWith >= blocks.length) return;
    [blocks[idx], blocks[swapWith]] = [blocks[swapWith], blocks[idx]];
    saveBlocks();
    renderBlockSettings();
    if (currentView === 'today') renderBlocks();
    requestAnimationFrame(() => {
      const newHandle = document.querySelector(`.block-settings-row[data-block-id="${block.id}"] .bs-drag-handle`);
      if (newHandle) newHandle.focus();
    });
  });
}

function renderBlockSettings(){
  const list = document.getElementById('blocks-settings-list'); list.innerHTML = '';
  blocks.forEach(block => {
    const row = document.createElement('div'); row.className = 'block-settings-row';
    row.dataset.blockId = String(block.id);
    row.innerHTML = `
      <span class="bs-drag-handle" tabindex="0" role="button" aria-label="Unterrichtsblock verschieben">⠿</span>
      <input class="bs-label" type="text" value="${escHtml(block.label)}" placeholder="Name"/>
      <div class="bs-time-wrap">
        <input class="bs-time" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" value="${block.start}"/>
        <button type="button" class="bs-time-trigger" aria-label="Startzeit auswählen">▾</button>
      </div>
      <span class="bs-dash">–</span>
      <div class="bs-time-wrap">
        <input class="bs-time" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" value="${block.end}"/>
        <button type="button" class="bs-time-trigger" aria-label="Endzeit auswählen">▾</button>
      </div>
      <label class="toggle bs-free-toggle" title="Unterricht (aus = frei)">
        <input type="checkbox" aria-label="Unterricht findet statt" ${block.free ? '' : 'checked'}/>
        <span class="toggle-slider"></span>
      </label>
      <button class="bs-del icon-btn" aria-label="Unterrichtsblock löschen" title="Löschen">✕</button>`;
    row.querySelector('.bs-label').addEventListener('input', e => { block.label = e.target.value; saveBlocks(); if(currentView==='today') renderBlocks(); });

    const timeWraps = row.querySelectorAll('.bs-time-wrap');
    const timeKeys = ['start', 'end'];
    timeWraps.forEach((wrap, i) => {
      const key = timeKeys[i];
      const input = wrap.querySelector('.bs-time');
      const trigger = wrap.querySelector('.bs-time-trigger');
      input.addEventListener('input', () => formatBlockTimeLive(input));
      input.addEventListener('change', () => {
        const normalized = normalizeBlockTime(input.value);
        input.value = normalized || block[key]; // ungültig/zu kurz → vorherigen gespeicherten Wert wiederherstellen
        if (normalized) { block[key] = normalized; saveBlocks(); validateBlockSettings(); if(currentView==='today') renderBlocks(); }
      });
      trigger.addEventListener('click', e => { e.stopPropagation(); openBlockTimePicker(trigger, input, block, key); });
    });

    // Toggle AN = Unterricht findet statt, AUS = frei — bewusst umgekehrt
    // zur gespeicherten Property block.free (true = frei), die an allen
    // anderen Stellen (js/today.js) unverändert weiterverwendet wird.
    // Invertierung ausschließlich hier an der UI-Grenze, keine doppelte
    // Verneinung: checked bedeutet einfach "nicht frei".
    row.querySelector('.bs-free-toggle input').addEventListener('change', e => { block.free = !e.target.checked; saveBlocks(); if(currentView==='today') renderBlocks(); });
    row.querySelector('.bs-del').addEventListener('click', () => deleteBlockWithConfirm(block));

    initBlockDragHandle(row.querySelector('.bs-drag-handle'), row, block);

    list.appendChild(row);
  });
  const hint = document.createElement('p');
  hint.id = 'blocks-settings-hint';
  hint.className = 'settings-status settings-status-error hidden';
  hint.setAttribute('role', 'status');
  list.appendChild(hint);
  validateBlockSettings();
}

// Markiert Blöcke, deren Ende nicht nach dem Beginn liegt, und Blöcke, die
// sich zeitlich überschneiden. Speichern wird nicht blockiert (man tippt
// oft erst Beginn, dann Ende) — nur deutlich angezeigt.
function validateBlockSettings() {
  const list = document.getElementById('blocks-settings-list');
  if (!list) return;
  const problems = new Map(); // id -> Text
  blocks.forEach(b => { if (b.start && b.end && b.end <= b.start) problems.set(b.id, 'Ende liegt nicht nach dem Beginn'); });
  const sorted = blocks.filter(b => b.start && b.end && b.end > b.start).slice().sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      if (!problems.has(sorted[i].id)) problems.set(sorted[i].id, `Überschneidet sich mit „${sorted[i - 1].label}“`);
      if (!problems.has(sorted[i - 1].id)) problems.set(sorted[i - 1].id, `Überschneidet sich mit „${sorted[i].label}“`);
    }
  }
  list.querySelectorAll('.block-settings-row').forEach(row => {
    const msg = problems.get(blocks.find(b => String(b.id) === row.dataset.blockId)?.id);
    row.classList.toggle('bs-invalid', !!msg);
    if (msg) row.title = msg; else row.removeAttribute('title');
  });
  const hint = document.getElementById('blocks-settings-hint');
  if (hint) {
    const msgs = [...problems.entries()].map(([id, msg]) => `${blocks.find(b => b.id === id)?.label || 'Block'}: ${msg}`);
    hint.textContent = msgs.join(' · ');
    hint.classList.toggle('hidden', !msgs.length);
  }
}

// Löschen mit Rückfrage; Aufgaben, die dem Block zugeordnet waren, verlieren
// nur diese Zuordnung (task.blocks bzw. Alt-Feld task.block, siehe today.js).
async function deleteBlockWithConfirm(block) {
  const usedBy = tasks.filter(t => (Array.isArray(t.blocks) ? t.blocks : (t.block != null ? [t.block] : [])).includes(block.id));
  const ok = await hubConfirm({
    title: 'Unterrichtsblock löschen',
    message: `„${block.label || 'Block'}“ wirklich löschen?` + (usedBy.length
      ? ` ${usedBy.length} ${usedBy.length === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} diesem Block zugeordnet und ${usedBy.length === 1 ? 'verliert' : 'verlieren'} diese Zuordnung.`
      : ''),
    confirmText: 'Löschen',
    danger: true,
  });
  if (!ok) return;
  if (usedBy.length) {
    usedBy.forEach(t => {
      if (Array.isArray(t.blocks)) t.blocks = t.blocks.filter(id => id !== block.id);
      if (t.block === block.id) delete t.block;
    });
    saveTasks();
  }
  const idx = blocks.indexOf(block);
  if (idx !== -1) blocks.splice(idx, 1);
  saveBlocks();
  renderBlockSettings();
  if (currentView === 'today') { renderBlocks(); renderTasks(); }
}

document.getElementById('add-block-btn').addEventListener('click', () => {
  // Neuer Block direkt hinter dem letzten (nach Endzeit), 90 Minuten lang.
  const lastEnd = blocks.map(b => b.end).filter(Boolean).sort().pop() || '07:45';
  const [h, m] = lastEnd.split(':').map(Number);
  const startMin = Math.min(h * 60 + m + 15, 22 * 60);
  const fmtMin = v => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
  blocks.push({ id: Date.now(), label: `Block ${blocks.length+1}`, start: fmtMin(startMin), end: fmtMin(Math.min(startMin + 90, 23 * 60 + 59)), free: false });
  saveBlocks(); renderBlockSettings(); if(currentView==='today') renderBlocks();
});

// =========================
// WEATHER SETTINGS
// =========================

document.getElementById('weather-mode-gps')?.addEventListener('click', () => {
  const ws = DB.get('weatherSettings', { mode: 'manual', city: 'Cologne' });
  ws.mode = 'gps';
  DB.set('weatherSettings', ws);
  DB.set('weatherData', null);
  renderWeatherSettings();
  refreshWeatherWithStatus();
});

document.getElementById('weather-mode-manual')?.addEventListener('click', () => {
  const ws = DB.get('weatherSettings', { mode: 'manual', city: 'Cologne' });
  ws.mode = 'manual';
  DB.set('weatherSettings', ws);
  renderWeatherSettings();
  // Sonst bliebe bis zum nächsten Rendern das GPS-Wetter stehen.
  refreshWeatherWithStatus();
});

document.getElementById('weather-city-input')?.addEventListener('change', e => {
  const ws = DB.get('weatherSettings', { mode: 'manual', city: 'Cologne' });
  ws.city = e.target.value.trim() || 'Cologne';
  DB.set('weatherSettings', ws);
  DB.set('weatherData', null);
  refreshWeatherWithStatus();
});

// =========================
// DATEN: BEREICHE, BACKUP, SPEICHER
// Backups sichern automatisch ALLE localStorage-Keys statt einer manuell
// gepflegten Liste — neue Features/Module (auch aus games/<id>/) landen
// dadurch ohne zusätzlichen Eintrag automatisch mit im Backup.
// Ausgenommen sind nur:
//   - interne Sync-/Anmeldedaten (sync.js: isSyncInternalKey — u.a. der
//     Supabase-Session-Speicher sb-… mit Access-/Refresh-Token; gehört nie
//     in eine Datei und wird beim Import ebenfalls ignoriert),
//   - reine Caches, die sich beim nächsten Laden ohnehin neu aufbauen.
//
// NOOK_DATA_GROUPS ordnet Keys einem Bereich zu — nur für die Speicher-
// anzeige, den Export/Reset je Bereich und die Import-Vorschau. Unbekannte
// Keys (z.B. Spielstände aus games/<id>/) landen in "Spiele & Sonstiges".
// Neuer Tab mit eigenen Keys → hier eintragen, sonst taucht er nur unter
// "Sonstiges" auf (Backup selbst funktioniert trotzdem).
// =========================
const BACKUP_FORMAT_VERSION = 4;
const BACKUP_CACHE_KEYS = ['weatherData', 'currentDate'];

const NOOK_DATA_GROUPS = [
  { id: 'today',      label: 'Heute',        resettable: true,
    keys: ['tasks', 'blocks', 'notes', 'quicknote', 'berichtsheft', 'mealPlanWeeks', 'todayTracker', 'todayBudgetDue', 'qnSendLastTarget', 'qnSendLastProject',
           'gdDuties', 'gdGroups', 'gdPeople', 'gdSchedule', 'gdScheduleAlgoV2'] },
  { id: 'positivity', label: 'Positivity',   resettable: true, prefixes: ['positivity'] },
  { id: 'pinboard',   label: 'Pinnwand',     resettable: true,
    keys: ['deskCards', 'tileDesigns', 'customTiles', 'generalTodos', 'shoppingList'] },
  { id: 'calendar',   label: 'Kalender',     resettable: true,
    keys: ['events', 'eventSeries', 'birthdays', 'calendarSettings', 'countdownVisible', 'monthlyGoals'],
    prefixes: ['googleCal'] },
  { id: 'projects',   label: 'Projekte',     resettable: true, keys: ['projects', 'lastOpenProjectDetailId'] },
  { id: 'budget',     label: 'Budget',       resettable: true,
    keys: ['kontostand', 'finanzbaumLevels', 'sparplanerScenario', 'gardenActiveGoalId'], prefixes: ['budget'] },
  { id: 'garden',     label: 'Garten',       resettable: true, prefixes: ['garden'] },
  { id: 'questboard', label: 'Questboard',   resettable: true, prefixes: ['quest'] },
  { id: 'flashcards', label: 'Karteikarten', resettable: true, keys: ['subjects', 'collapsedGroups'], prefixes: ['fc_'] },
  { id: 'guides',     label: 'Anleitungen',  resettable: true, prefixes: ['guide'] },
  { id: 'tools',      label: 'Tools',        resettable: true, prefixes: ['tools', 'noten'] },
  { id: 'look',       label: 'Darstellung & Einstellungen', resettable: false,
    keys: ['theme', 'themeFamily', 'darkMode', 'customThemes', 'themeBackgrounds', 'dayNightToggle',
           'themeAutoMode', 'uiFontScale', 'reduceMotion', 'sidebarCollapsed', 'hiddenTabs', 'tabOrder',
           'tabVisibilityOpen', 'settingsCollapsedGroups', 'bottomNavTabs', 'startView', 'hubUserColors', 'colorAutoAdjust', 'userName',
           'weatherSettings', 'backupLastExport', 'backupReminderDays', 'backupReminderSince',
           'backupReminderSnoozeUntil'] },
  { id: 'other',      label: 'Spiele & Sonstiges', resettable: false },
];

function isBackupExcludedKey(key) {
  if (typeof isSyncInternalKey === 'function' && isSyncInternalKey(key)) return true;
  // Fallback, falls sync.js fehlt — dieselben Muster wie dort.
  if (key.startsWith('sb-') || key.startsWith('__nook_sync')) return true;
  return BACKUP_CACHE_KEYS.includes(key);
}

function dataGroupOfKey(key) {
  const exact = NOOK_DATA_GROUPS.find(g => g.keys && g.keys.includes(key));
  if (exact) return exact.id;
  const byPrefix = NOOK_DATA_GROUPS.find(g => g.prefixes && g.prefixes.some(p => key.startsWith(p)));
  return byPrefix ? byPrefix.id : 'other';
}

// Alle sicherbaren Keys samt Rohwert (String) und Bereich.
function collectBackupEntries(groupId) {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null || isBackupExcludedKey(key)) continue;
    const group = dataGroupOfKey(key);
    if (groupId && group !== groupId) continue;
    out.push({ key, raw: localStorage.getItem(key) || '', group });
  }
  return out;
}

function buildBackupData(groupId) {
  const data = {};
  collectBackupEntries(groupId).forEach(({ key, raw }) => {
    try { data[key] = JSON.parse(raw); } catch { /* kein valides JSON — überspringen */ }
  });
  data.__app = 'nook';
  data.__version = BACKUP_FORMAT_VERSION;
  data.__exported = new Date().toISOString();
  if (groupId) data.__scope = groupId;
  return data;
}

function downloadBackupFile(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Erst verzögert freigeben — Firefox/Safari brechen den Download sonst
  // teils ab, wenn die URL direkt nach click() widerrufen wird.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportFullBackup() {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBackupFile(buildBackupData(null), `nook-backup-${stamp}.json`);
  DB.set('backupLastExport', Date.now());
  hideBackupReminder();
  renderBackupSettings();
}

function exportGroupBackup(groupId) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBackupFile(buildBackupData(groupId), `nook-${groupId}-${stamp}.json`);
}

function formatStorageSize(chars) {
  // localStorage-Grenzen zählen Zeichen (UTF-16), ~5 Mio. pro Website.
  if (chars < 1024) return `${chars} Zeichen`;
  if (chars < 1024 * 1024) return `${(chars / 1024).toFixed(chars < 10 * 1024 ? 1 : 0).replace('.', ',')} KB`;
  return `${(chars / 1024 / 1024).toFixed(2).replace('.', ',')} MB`;
}

function formatBackupDate(ts) {
  return new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysSince(ts) {
  return Math.floor((Date.now() - ts) / MS_PER_DAY);
}

// ── Backup-Panel ─────────────────────────────────────────────────────────
function renderBackupSettings() {
  const sub = document.getElementById('backup-last-export-sub');
  if (sub) {
    const last = DB.get('backupLastExport', null);
    if (!last) sub.textContent = 'Alle Daten als JSON-Datei herunterladen — noch kein Backup auf diesem Stand';
    else {
      const d = daysSince(last);
      sub.textContent = `Letztes Backup: ${formatBackupDate(last)}${d === 0 ? ' (heute)' : d === 1 ? ' (gestern)' : ` (vor ${d} Tagen)`}`;
    }
  }
  const sel = document.getElementById('setting-backup-reminder');
  if (sel) sel.value = String(DB.get('backupReminderDays', 30));
}

document.getElementById('backup-export-btn').addEventListener('click', exportFullBackup);
document.getElementById('setting-backup-reminder')?.addEventListener('change', e => {
  DB.set('backupReminderDays', Number(e.target.value) || 0);
  checkBackupReminder();
});

// ── Backup-Erinnerung (schwebender Hinweis, index.html #backup-reminder-banner)
function hideBackupReminder() {
  document.getElementById('backup-reminder-banner')?.classList.add('hidden');
}
function checkBackupReminder() {
  const days = DB.get('backupReminderDays', 30);
  if (!days) { hideBackupReminder(); return; }
  let since = DB.get('backupReminderSince', null);
  if (!since) { since = Date.now(); DB.set('backupReminderSince', since); }
  const last = DB.get('backupLastExport', null);
  const snooze = DB.get('backupReminderSnoozeUntil', 0);
  const ref = last || since;
  if (Date.now() < snooze || daysSince(ref) < days) { hideBackupReminder(); return; }
  const text = document.getElementById('backup-reminder-text');
  if (text) text.textContent = last ? `Letztes Backup vor ${daysSince(last)} Tagen` : 'Noch kein Backup erstellt';
  document.getElementById('backup-reminder-banner')?.classList.remove('hidden');
}
document.getElementById('backup-reminder-export-btn')?.addEventListener('click', exportFullBackup);
document.getElementById('backup-reminder-later-btn')?.addEventListener('click', () => {
  DB.set('backupReminderSnoozeUntil', Date.now() + MS_PER_DAY);
  hideBackupReminder();
});

// ── Speicher-Panel: Belegung gesamt + je Bereich, Export/Reset je Bereich ─
const STORAGE_LIMIT_CHARS = 5 * 1024 * 1024;

function renderStorageSettings() {
  const list = document.getElementById('storage-group-list');
  if (!list) return;
  let total = 0;
  const sizes = {};
  const counts = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null) continue;
    const size = key.length + (localStorage.getItem(key) || '').length;
    total += size;
    if (isBackupExcludedKey(key)) continue;
    const g = dataGroupOfKey(key);
    sizes[g] = (sizes[g] || 0) + size;
    counts[g] = (counts[g] || 0) + 1;
  }
  const pct = Math.min(100, (total / STORAGE_LIMIT_CHARS) * 100);
  document.getElementById('storage-total-label').textContent = `${formatStorageSize(total)} von ca. 5 MB`;
  const bar = document.getElementById('storage-total-bar');
  bar.style.width = `${Math.max(pct, 1).toFixed(1)}%`;
  bar.classList.toggle('storage-bar-warn', pct >= 80);

  const groups = NOOK_DATA_GROUPS.filter(g => counts[g.id]).sort((a, b) => sizes[b.id] - sizes[a.id]);
  list.innerHTML = groups.map(g => `
    <div class="settings-row storage-group-row">
      <div class="storage-group-info">
        <div class="settings-row-title">${escHtml(g.label)}</div>
        <div class="settings-row-sub">${formatStorageSize(sizes[g.id])} · ${counts[g.id]} ${counts[g.id] === 1 ? 'Eintrag' : 'Einträge'}</div>
        <div class="storage-bar storage-bar-small" aria-hidden="true"><div class="storage-bar-fill" style="width:${Math.max((sizes[g.id] / Math.max(total, 1)) * 100, 1).toFixed(1)}%"></div></div>
      </div>
      <div class="storage-group-actions">
        <button type="button" class="btn-ghost settings-small-btn storage-export-btn" data-group="${g.id}" aria-label="${escHtml(g.label)} exportieren">Export</button>
        ${g.resettable ? `<button type="button" class="btn-ghost settings-small-btn settings-danger-btn storage-reset-btn" data-group="${g.id}" aria-label="${escHtml(g.label)} zurücksetzen">Zurücksetzen</button>` : ''}
      </div>
    </div>`).join('') || '<div class="empty-state" style="padding:12px 18px;">Noch keine Daten gespeichert.</div>';

  list.querySelectorAll('.storage-export-btn').forEach(btn => {
    btn.addEventListener('click', () => exportGroupBackup(btn.dataset.group));
  });
  list.querySelectorAll('.storage-reset-btn').forEach(btn => {
    btn.addEventListener('click', () => resetDataGroup(btn.dataset.group));
  });
}
document.getElementById('storage-refresh-btn')?.addEventListener('click', renderStorageSettings);

// Bereich zurücksetzen: lädt vorher automatisch ein Backup dieses Bereichs
// herunter, dann zweite Sicherheitsabfrage (Muster wie "Buch löschen" in
// den Anleitungen). Löscht lokal UND in der Cloud (sync.js: syncRemoveKeys),
// danach Neuladen, damit alle Tab-Zustände frisch aus DB.get() kommen.
async function resetDataGroup(groupId) {
  const group = NOOK_DATA_GROUPS.find(g => g.id === groupId);
  if (!group || !group.resettable) return;
  const keys = collectBackupEntries(groupId).map(e => e.key);
  if (!keys.length) return;

  const step1 = await hubConfirm({
    title: `${group.label} zurücksetzen`,
    message: `Alle Daten aus „${group.label}“ werden gelöscht (${keys.length} ${keys.length === 1 ? 'Eintrag' : 'Einträge'}). Vorher lädt Nook automatisch ein Backup dieses Bereichs herunter.`,
    confirmText: 'Backup laden & weiter',
    danger: true,
  });
  if (!step1) return;
  exportGroupBackup(groupId);

  const step2 = await hubConfirm({
    title: 'Wirklich löschen?',
    message: `Die Daten aus „${group.label}“ werden auf diesem Gerät und — falls Geräte-Sync aktiv ist — in der Cloud gelöscht. Prüfe kurz, ob das Backup heruntergeladen wurde.`,
    confirmText: 'Endgültig zurücksetzen',
    danger: true,
  });
  if (!step2) return;

  if (typeof syncRemoveKeys === 'function') await syncRemoveKeys(keys);
  else keys.forEach(k => localStorage.removeItem(k));
  await hubAlert('Zurückgesetzt', `„${group.label}“ wurde zurückgesetzt. Die Seite wird neu geladen.`);
  location.reload();
}

// ── Backup importieren: Datei lesen → Vorschau-Modal → anwenden ──────────

// Grundtyp-Prüfung für Keys, deren App-Code eine feste Struktur voraussetzt
// (z.B. main.js: tasks.filter(...)). Ein syntaktisch gültiges, aber
// strukturell falsches Backup (z.B. tasks als String) würde diese sonst
// ungeprüft überschreiben und die App beim nächsten Laden zum Absturz
// bringen — betroffene Keys werden stattdessen übersprungen.
const BACKUP_SHAPE_CHECKS = {
  tasks:           Array.isArray,
  events:          v => v !== null && typeof v === 'object' && !Array.isArray(v),
  eventSeries:     Array.isArray,
  subjects:        Array.isArray,
  projects:        Array.isArray,
  budgetRecurring: Array.isArray,
  budgetOnetime:   Array.isArray,
  budgetGoals:     Array.isArray,
  budgetDebts:     Array.isArray,
  deskCards:       Array.isArray,
  customThemes:    Array.isArray,
  blocks:          Array.isArray,
  hiddenTabs:      Array.isArray,
  tabOrder:        Array.isArray,
  bottomNavTabs:   Array.isArray,
  themeBackgrounds: v => v !== null && typeof v === 'object' && !Array.isArray(v),
  googleCalSettings: v => v !== null && typeof v === 'object' && !Array.isArray(v),
  googleCalCache:    v => v !== null && typeof v === 'object' && !Array.isArray(v),
};
const BACKUP_META_KEYS = ['__app', '__version', '__exported', '__scope'];

let pendingBackupImport = null; // { entries: {key: value}, skipped: [], scope }

const backupImportModal = wireModal('backup-import-overlay', {
  closeIds: ['backup-import-close', 'backup-import-cancel'],
  onClose: () => { pendingBackupImport = null; },
});

document.getElementById('backup-import-btn').addEventListener('click', () => {
  document.getElementById('backup-file-input').click();
});

document.getElementById('backup-file-input').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = ev => {
    let data;
    try { data = JSON.parse(String(ev.target.result).replace(/^﻿/, '')); }
    catch { hubAlert('Ungültige Datei', 'Die Datei ist keine gültige JSON-Datei.'); return; }
    openBackupImportPreview(data);
  };
  reader.onerror = () => hubAlert('Fehler', 'Die Datei konnte nicht gelesen werden.');
  reader.readAsText(file);
});

function openBackupImportPreview(data) {
  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  const keys = isObject ? Object.keys(data).filter(k => !BACKUP_META_KEYS.includes(k)) : [];
  const looksLikeNook = isObject && (data.__app === 'nook' || data.__version !== undefined
    || keys.some(k => dataGroupOfKey(k) !== 'other'));
  if (!looksLikeNook || !keys.length) {
    hubAlert('Kein Nook-Backup', 'Diese Datei sieht nicht wie ein Nook-Backup aus — es wurde nichts verändert.');
    return;
  }

  const entries = {};
  const skipped = [];
  let ignoredInternal = 0;
  keys.forEach(k => {
    if (isBackupExcludedKey(k)) { ignoredInternal++; return; }
    const check = BACKUP_SHAPE_CHECKS[k];
    if (check && !check(data[k])) { skipped.push(k); return; }
    entries[k] = data[k];
  });
  if (!Object.keys(entries).length) {
    hubAlert('Nichts zu importieren', 'Das Backup enthält keine wiederherstellbaren Daten.');
    return;
  }
  pendingBackupImport = { entries, skipped, scope: data.__scope || null };

  // Zusammenfassung + Bereiche
  const size = Object.entries(entries).reduce((n, [k, v]) => n + k.length + JSON.stringify(v).length, 0);
  const scopeGroup = NOOK_DATA_GROUPS.find(g => g.id === data.__scope);
  const parts = [];
  parts.push(data.__exported ? `Backup vom ${formatBackupDate(data.__exported)}` : 'Backup ohne Datum');
  if (scopeGroup) parts.push(`nur Bereich „${scopeGroup.label}“`);
  const n = Object.keys(entries).length;
  parts.push(`${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`, formatStorageSize(size));
  document.getElementById('backup-import-summary').textContent = parts.join(' · ');

  const perGroup = {};
  Object.keys(entries).forEach(k => { const g = dataGroupOfKey(k); perGroup[g] = (perGroup[g] || 0) + 1; });
  document.getElementById('backup-import-groups').innerHTML = NOOK_DATA_GROUPS
    .filter(g => perGroup[g.id])
    .map(g => `<span class="backup-import-chip">${escHtml(g.label)} <b>${perGroup[g.id]}</b></span>`).join('');

  const warn = [];
  if (skipped.length) warn.push(`Wegen unerwarteter Struktur übersprungen: ${skipped.join(', ')}.`);
  if (ignoredInternal) warn.push('Enthaltene Anmelde-/Sync-Daten werden aus Sicherheitsgründen nicht übernommen.');
  const warnEl = document.getElementById('backup-import-warning');
  warnEl.textContent = warn.join(' ');
  warnEl.classList.toggle('hidden', !warn.length);

  // Teil-Backups (ein Bereich) sinnvollerweise nur zusammenführen.
  const replaceRadio = document.querySelector('input[name="backup-import-mode"][value="replace"]');
  const mergeRadio = document.querySelector('input[name="backup-import-mode"][value="merge"]');
  mergeRadio.checked = true;
  replaceRadio.disabled = !!data.__scope;
  replaceRadio.closest('label').classList.toggle('backup-import-mode-disabled', !!data.__scope);

  backupImportModal.open();
}

document.getElementById('backup-import-confirm')?.addEventListener('click', async () => {
  if (!pendingBackupImport) return;
  const { entries, skipped } = pendingBackupImport;
  const mode = document.querySelector('input[name="backup-import-mode"]:checked')?.value || 'merge';

  if (mode === 'replace') {
    const ok = await hubConfirm({
      title: 'Alle Daten ersetzen?',
      message: 'Alles, was nicht im Backup steht, wird gelöscht — auch in der Cloud, falls Geräte-Sync aktiv ist. Tipp: vorher ein aktuelles Backup exportieren.',
      confirmText: 'Ersetzen',
      danger: true,
    });
    if (!ok) return;
  }
  backupImportModal.close();

  const toWrite = Object.keys(entries);
  const toRemove = mode === 'replace'
    ? collectBackupEntries(null).map(e => e.key).filter(k => !(k in entries))
    : [];

  // Phase 1: lokal schreiben — alles oder nichts. Läuft der Speicher voll,
  // wird der vorherige Stand wiederhergestellt statt ein halbes Backup
  // stehen zu lassen.
  const snapshot = {};
  [...toWrite, ...toRemove].forEach(k => { snapshot[k] = localStorage.getItem(k); });
  try {
    toRemove.forEach(k => localStorage.removeItem(k));
    toWrite.forEach(k => localStorage.setItem(k, JSON.stringify(entries[k])));
  } catch {
    Object.entries(snapshot).forEach(([k, v]) => {
      try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* bestmöglich */ }
    });
    hubAlert('Nicht genug Speicher', 'Das Backup passt nicht in den Speicher dieses Browsers. Es wurde nichts verändert.');
    return;
  }

  // Phase 2: über DB.set bzw. syncRemoveKeys erneut melden, damit Geräte-
  // Sync die neuen Werte mit aktuellem Zeitstempel hochlädt (direkt in
  // localStorage geschriebene Werte würden sonst beim nächsten Abgleich
  // von älteren Cloud-Ständen überschrieben). Gleicher Wert → passt sicher.
  toWrite.forEach(k => DB.set(k, entries[k]));
  if (toRemove.length && typeof syncRemoveKeys === 'function') await syncRemoveKeys(toRemove);
  if (typeof syncFlushPending === 'function') await syncFlushPending();

  pendingBackupImport = null;
  await hubAlert('Backup wiederhergestellt',
    (skipped.length ? `Übersprungen (unerwartete Struktur): ${skipped.join(', ')}. ` : '') + 'Die Seite wird neu geladen.');
  location.reload();
});

// Umfassender Reset über ALLE Spiele hinweg (inkl. Cozy Home, siehe
// resetStats() in games/cozy-home/manifest.js) — deshalb zwei
// Sicherheitsabfragen statt nur einer, im Gegensatz zum Zurücksetzen
// eines einzelnen Spiels (games.js: games-stats-modal-reset), das ohne
// zweite Nachfrage auskommt, weil dort klar ist, welches eine Spiel
// betroffen ist.
document.getElementById('reset-highscores-btn').addEventListener('click', async () => {
  const step1 = await hubConfirm({
    title: 'Alle Spieldaten zurücksetzen',
    message: 'Möchtest du wirklich alle Spieldaten zurücksetzen?',
    confirmText: 'Weiter',
    danger: true,
  });
  if (!step1) return;

  const step2 = await hubConfirm({
    title: 'Wirklich alles löschen?',
    message: 'Das löscht ausnahmslos ALLE Spielstatistiken UND alle Cozy-Home-Daten (Haustiere, Münzen, Inventar). Dieser Vorgang kann NICHT rückgängig gemacht werden.',
    confirmText: 'Endgültig zurücksetzen',
    danger: true,
  });
  if (!step2) return;

  // settings.js kennt keine einzelnen Spiele — der Hub fragt alle
  // registrierten Spiele durch und ruft deren resetStats() auf, falls vorhanden.
  if (window.GameHub && typeof window.GameHub.resetAllStats === 'function') {
    await window.GameHub.resetAllStats();
  }
  hubAlert('Erledigt', 'Alle Spieldaten wurden zurückgesetzt.');
  renderStorageSettings();
});

// =========================
// ÜBER NOOK (js/nook-version.js)
// =========================
function renderAboutSettings() {
  const ver = document.getElementById('about-version');
  if (ver) ver.textContent = window.NOOK_VERSION || '—';
  const log = document.getElementById('about-changelog');
  if (!log) return;
  const entries = (window.NOOK_CHANGELOG || []).slice(0, 3);
  log.innerHTML = entries.map(e => `
    <div class="about-changelog-entry">
      <div class="about-changelog-head"><span class="about-changelog-version">${escHtml(e.version)}</span><span class="settings-row-sub">${e.date ? formatBackupDate(e.date) : ''}</span></div>
      <ul>${(e.items || []).map(i => `<li>${escHtml(i)}</li>`).join('')}</ul>
    </div>`).join('') || '<div class="settings-row-sub">Keine Einträge.</div>';
}


// =========================
// UTIL
// =========================

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =========================
// INIT
// =========================

updateHeader();
// Startbildschirm: fester Tab aus den Einstellungen oder (Standard) die
// zuletzt geöffnete View laut URL-Hash — siehe resolveInitialView() in
// main.js. "mehr" ist nur ein mobiles Overlay und nie Startziel.
showView(resolveInitialView());
initGames();
checkBackupReminder();
