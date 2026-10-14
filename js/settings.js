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
  _bsTimePickerTarget = { input, block, key };
  const rect = trigger.getBoundingClientRect();
  panel.style.left = Math.max(4, rect.left - 70) + 'px'; // grob zentriert unter dem schmalen Trigger
  panel.style.top = (rect.bottom + 4) + 'px';
  panel.classList.remove('hidden');

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
      <label class="toggle bs-free-toggle" title="Unterricht">
        <input type="checkbox" ${block.free ? '' : 'checked'}/>
        <span class="toggle-slider"></span>
      </label>
      <button class="bs-del icon-btn">✕</button>`;
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
        if (normalized) { block[key] = normalized; saveBlocks(); if(currentView==='today') renderBlocks(); }
      });
      trigger.addEventListener('click', e => { e.stopPropagation(); openBlockTimePicker(trigger, input, block, key); });
    });

    // Toggle AN = Unterricht findet statt, AUS = frei — bewusst umgekehrt
    // zur gespeicherten Property block.free (true = frei), die an allen
    // anderen Stellen (js/today.js) unverändert weiterverwendet wird.
    // Invertierung ausschließlich hier an der UI-Grenze, keine doppelte
    // Verneinung: checked bedeutet einfach "nicht frei".
    row.querySelector('.bs-free-toggle input').addEventListener('change', e => { block.free = !e.target.checked; saveBlocks(); if(currentView==='today') renderBlocks(); });
    row.querySelector('.bs-del').addEventListener('click', () => { blocks.splice(blocks.indexOf(block), 1); saveBlocks(); renderBlockSettings(); if(currentView==='today') renderBlocks(); });

    initBlockDragHandle(row.querySelector('.bs-drag-handle'), row, block);

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
