// =========================
// SETTINGS
// =========================

function renderSettings(){
  document.getElementById('setting-username').value = userName || '';
  renderThemeSettings();
  renderBlockSettings();
  renderWeatherSettings();
  renderColorSettings();
  renderTabVisibilitySettings();
  if (typeof renderPositivitySettings === 'function') renderPositivitySettings();
  if (typeof renderGoogleCalendarSettings === 'function') renderGoogleCalendarSettings();
}

// =========================
// SICHTBARE TABS + REIHENFOLGE
// Rein UI-seitig — der eigentliche Zustand (hiddenTabs, tabOrder) und die
// Liste toggelbarer Tabs (TAB_VISIBILITY_CONFIG) leben in main.js, weil sie
// auch von applyTabVisibility()/applyTabOrder() (Sidebar/Bottom-Nav/"Mehr")
// gebraucht werden. Die Zeilen hier werden in tabOrder-Reihenfolge
// gerendert, mit Auf/Ab-Pfeilen statt Drag&Drop — robuster auf Touch und
// ohne zusätzliche Library.
//
// Das Panel selbst ist ein Akkordion (Standard: zugeklappt) — die Liste
// nimmt sonst dauerhaft viel Platz in den Einstellungen weg, obwohl sie
// nur selten angefasst wird. Offen/zu-Zustand bleibt über DB erhalten,
// gleiches Muster wie notenOpenYears in tools-notenmanager.js.
// =========================
let tabVisibilityOpen = DB.get('tabVisibilityOpen', false);
function saveTabVisibilityOpen(){ DB.set('tabVisibilityOpen', tabVisibilityOpen); }

function applyTabVisibilityAccordion(){
  document.getElementById('tab-visibility-body')?.classList.toggle('collapsed', !tabVisibilityOpen);
  const chevron = document.getElementById('tab-visibility-chevron');
  if (chevron) chevron.textContent = tabVisibilityOpen ? '▼' : '▶';
}
document.getElementById('tab-visibility-header')?.addEventListener('click', () => {
  tabVisibilityOpen = !tabVisibilityOpen;
  saveTabVisibilityOpen();
  applyTabVisibilityAccordion();
});

function renderTabVisibilitySettings(){
  applyTabVisibilityAccordion();
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
      <label class="toggle">
        <input type="checkbox" class="tab-visibility-cb" data-tab="${tab.id}" ${hiddenTabs.includes(tab.id) ? '' : 'checked'}/>
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
}

// ── Theme-Auswahl (Phase 2 Theme-Engine) ─────────────────────────────────
function renderThemeSettings(){
  const picker = document.getElementById('theme-picker');
  if (!picker) return;
  picker.querySelectorAll('.theme-picker-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeValue === theme);
  });
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

// Benutzername
document.getElementById('setting-username').addEventListener('input', e => {
  userName = e.target.value.trim();
  DB.set('userName', userName);
  if (typeof renderTodayHeader === 'function') renderTodayHeader();
});

document.getElementById('theme-picker')?.addEventListener('click', e => {
  const btn = e.target.closest('.theme-picker-btn');
  if (!btn) return;
  setTheme(btn.dataset.themeValue);
  renderThemeSettings();
});

function renderBlockSettings(){
  const list = document.getElementById('blocks-settings-list'); list.innerHTML = '';
  blocks.forEach((block, idx) => {
    const row = document.createElement('div'); row.className = 'block-settings-row';
    row.innerHTML = `
      <input class="bs-label" type="text" value="${escHtml(block.label)}" placeholder="Name"/>
      <input class="bs-time" type="time" value="${block.start}"/>
      <span class="bs-dash">–</span>
      <input class="bs-time" type="time" value="${block.end}"/>
      <label class="toggle bs-free-toggle" title="Freistunde">
        <input type="checkbox" ${block.free ? 'checked' : ''}/>
        <span class="toggle-slider"></span>
      </label>
      <button class="bs-del icon-btn">✕</button>`;
    row.querySelector('.bs-label').addEventListener('input', e => { blocks[idx].label = e.target.value; saveBlocks(); if(currentView==='today') renderBlocks(); });
    const times = row.querySelectorAll('.bs-time');
    times[0].addEventListener('change', e => { blocks[idx].start = e.target.value; saveBlocks(); if(currentView==='today') renderBlocks(); });
    times[1].addEventListener('change', e => { blocks[idx].end   = e.target.value; saveBlocks(); if(currentView==='today') renderBlocks(); });
    row.querySelector('.bs-free-toggle input').addEventListener('change', e => { blocks[idx].free = e.target.checked; saveBlocks(); if(currentView==='today') renderBlocks(); });
    row.querySelector('.bs-del').addEventListener('click', () => { blocks.splice(idx, 1); saveBlocks(); renderBlockSettings(); if(currentView==='today') renderBlocks(); });
    list.appendChild(row);
  });
}
document.getElementById('add-block-btn').addEventListener('click', () => {
  blocks.push({ id: Date.now(), label: `Block ${blocks.length+1}`, start: '08:00', end: '09:30', free: false });
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
  if (typeof renderWeather === 'function') renderWeather();
});

document.getElementById('weather-mode-manual')?.addEventListener('click', () => {
  const ws = DB.get('weatherSettings', { mode: 'manual', city: 'Cologne' });
  ws.mode = 'manual';
  DB.set('weatherSettings', ws);
  renderWeatherSettings();
});

document.getElementById('weather-city-input')?.addEventListener('change', e => {
  const ws = DB.get('weatherSettings', { mode: 'manual', city: 'Cologne' });
  ws.city = e.target.value.trim() || 'Cologne';
  DB.set('weatherSettings', ws);
  DB.set('weatherData', null);
  if (typeof renderWeather === 'function') renderWeather();
});

// =========================
// BACKUP / RESTORE
// =========================
// Sichert automatisch ALLE localStorage-Keys statt einer manuell gepflegten
// Liste — neue Features/Module (auch aus games/<id>/) landen dadurch ohne
// zusätzlichen Eintrag hier automatisch mit im Backup.
// Nur echte Cache-Daten, die sich beim nächsten Laden ohnehin neu aufbauen,
// werden ausgeschlossen.
const BACKUP_EXCLUDE_KEYS = ['weatherData'];

document.getElementById('backup-export-btn').addEventListener('click', () => {
  const data = {};
  Object.keys(localStorage).forEach(k => {
    if (BACKUP_EXCLUDE_KEYS.includes(k)) return;
    try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { /* kein valides JSON — überspringen */ }
  });
  data.__version = 3;
  data.__exported = new Date().toISOString();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `nook-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
});

document.getElementById('backup-import-btn').addEventListener('click', () => {
  document.getElementById('backup-file-input').click();
});

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
  themeBackgrounds: v => v !== null && typeof v === 'object' && !Array.isArray(v),
  googleCalSettings: v => v !== null && typeof v === 'object' && !Array.isArray(v),
  googleCalCache:    v => v !== null && typeof v === 'object' && !Array.isArray(v),
};

document.getElementById('backup-file-input').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!confirm('Alle aktuellen Daten werden mit dem Backup überschrieben. Fortfahren?')) return;
      const skipped = [];
      Object.keys(data).forEach(k => {
        if (k === '__version' || k === '__exported') return;
        const check = BACKUP_SHAPE_CHECKS[k];
        if (check && !check(data[k])) { skipped.push(k); return; }
        localStorage.setItem(k, JSON.stringify(data[k]));
      });
      if (skipped.length) {
        alert('Backup wiederhergestellt, aber folgende Daten hatten eine unerwartete Struktur und wurden übersprungen: ' + skipped.join(', ') + '. Die Seite wird neu geladen.');
      } else {
        alert('Backup erfolgreich wiederhergestellt. Die Seite wird neu geladen.');
      }
      location.reload();
    } catch { alert('Ungültige Backup-Datei.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
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
  alert('Alle Spieldaten wurden zurückgesetzt.');
});


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
// Reload soll auf der zuletzt geöffneten View landen statt immer auf "today"
// (siehe URL-Hash-Sync in main.js#showView) — "mehr" ist nur ein mobiles
// Overlay und daher kein gültiges Ziel für den Initial-Load.
{
  const initialView = location.hash.replace(/^#/, '');
  const canShow = initialView && initialView !== 'mehr' && viewMap[initialView] && !hiddenTabs.includes(initialView);
  showView(canShow ? initialView : 'today');
}
initGames();
