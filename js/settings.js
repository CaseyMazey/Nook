// =========================
// SETTINGS
// =========================

function renderSettings(){
  document.getElementById('setting-username').value = userName || '';
  document.getElementById('setting-darkmode').checked = darkMode;
  renderBlockSettings();
  renderWeatherSettings();
  if (typeof renderPositivitySettings === 'function') renderPositivitySettings();
}

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

document.getElementById('setting-darkmode').addEventListener('change', e => {
  darkMode = e.target.checked; DB.set('darkMode', darkMode);
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
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

const BACKUP_KEYS = [
  'tasks','notes','events','quicknote','berichtsheft','examDate','blocks',
  'countdownVisible','darkMode','customTiles','subjects',
  'budgetRecurring','budgetOnetime','budgetGoals','kontostand',
  'clockEnabled','clockType','collapsedGroups','currentDate','gameHighscores',
  'userName'
];

document.getElementById('backup-export-btn').addEventListener('click', () => {
  const data = {};
  BACKUP_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) data[k] = JSON.parse(v); });
  data.__version = 2;
  data.__exported = new Date().toISOString();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `schul-hub-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
});

document.getElementById('backup-import-btn').addEventListener('click', () => {
  document.getElementById('backup-file-input').click();
});

document.getElementById('backup-file-input').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!confirm('Alle aktuellen Daten werden mit dem Backup überschrieben. Fortfahren?')) return;
      BACKUP_KEYS.forEach(k => { if (data[k] !== undefined) localStorage.setItem(k, JSON.stringify(data[k])); });
      alert('Backup erfolgreich wiederhergestellt. Die Seite wird neu geladen.');
      location.reload();
    } catch { alert('Ungültige Backup-Datei.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('reset-highscores-btn').addEventListener('click', () => {
  if (!confirm('Alle Highscores zurücksetzen?')) return;
  gameHighscores = { ttt: {}, memory: {}, snake: 0 };
  saveHighscores();
  alert('Highscores wurden zurückgesetzt.');
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
showView('today');
initGames();
