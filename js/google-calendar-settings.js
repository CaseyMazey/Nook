// =========================
// GOOGLE-CALENDAR-SETTINGS.JS
// Lädt nach google-calendar-sync.js (braucht syncAllSelectedGoogleCalendars()
// etc.), vor js/settings.js (dessen renderSettings() ruft
// renderGoogleCalendarSettings() optional auf, siehe dortigen
// `typeof`-Check — gleiches Muster wie renderPositivitySettings()).
//
// Verantwortlich NUR für das "Google Calendar"-Panel in den Einstellungen
// (Verbinden/Trennen, Kalenderauswahl, Sync-Einstellungen). Kennt keine
// Kalender-Renderlogik (siehe calendar.js) und keine API-/Sync-Details
// (siehe google-calendar-api.js/-sync.js) — reine UI-Schicht obendrauf,
// exakt wie renderWeatherSettings() etc. in settings.js selbst.
// =========================

let googleCalSettingsOpen = DB.get('googleCalSettingsOpen', false);
function saveGoogleCalSettingsOpen() { DB.set('googleCalSettingsOpen', googleCalSettingsOpen); }

function applyGoogleCalAccordion() {
  document.getElementById('gcal-settings-body')?.classList.toggle('collapsed', !googleCalSettingsOpen);
  const chevron = document.getElementById('gcal-settings-chevron');
  if (chevron) chevron.textContent = googleCalSettingsOpen ? '▼' : '▶';
}
document.getElementById('gcal-settings-header')?.addEventListener('click', () => {
  googleCalSettingsOpen = !googleCalSettingsOpen;
  saveGoogleCalSettingsOpen();
  applyGoogleCalAccordion();
});

function renderGoogleCalendarSettings() {
  applyGoogleCalAccordion();

  const unsupportedHint   = document.getElementById('gcal-unsupported-hint');
  const notConfiguredHint = document.getElementById('gcal-not-configured-hint');
  const connectBlock      = document.getElementById('gcal-connect-block');
  const connectedBlock    = document.getElementById('gcal-connected-block');
  if (!unsupportedHint || !notConfiguredHint || !connectBlock || !connectedBlock) return;

  // Drei sich gegenseitig ausschließende Zustände vor "verbunden/nicht
  // verbunden": file:// (unsupportedHint), fehlende GOOGLE_CLIENT_ID
  // (notConfiguredHint, siehe js/sync-config.example.js), oder beides in
  // Ordnung. "file://" hat Vorrang in der Anzeige, wenn beides zugleich
  // zutrifft — eine hinterlegte Client-ID würde dort ohnehin nicht helfen.
  if (!isGoogleCalendarProtocolAllowed()) {
    unsupportedHint.classList.remove('hidden');
    notConfiguredHint.classList.add('hidden');
    connectBlock.classList.add('hidden');
    connectedBlock.classList.add('hidden');
    return;
  }
  unsupportedHint.classList.add('hidden');

  if (!isGoogleCalendarConfigured()) {
    notConfiguredHint.classList.remove('hidden');
    connectBlock.classList.add('hidden');
    connectedBlock.classList.add('hidden');
    return;
  }
  notConfiguredHint.classList.add('hidden');

  if (!isGoogleCalendarConnected()) {
    connectBlock.classList.remove('hidden');
    connectedBlock.classList.add('hidden');
    return;
  }

  connectBlock.classList.add('hidden');
  connectedBlock.classList.remove('hidden');
  document.getElementById('gcal-account-email').textContent = `Verbunden als ${googleCalAccount.email}`;

  renderGoogleCalendarList();

  const autoSyncSelect = document.getElementById('gcal-autosync-select');
  if (autoSyncSelect) autoSyncSelect.value = String(googleCalSettings.autoSyncMinutes);

  const exportToggle = document.getElementById('gcal-export-toggle');
  if (exportToggle) exportToggle.checked = googleCalSettings.exportEnabled;
  const exportRow = document.getElementById('gcal-export-calendar-row');
  if (exportRow) exportRow.classList.toggle('hidden', !googleCalSettings.exportEnabled);
  renderGoogleExportCalendarOptions();

  const syncNowBtn = document.getElementById('gcal-sync-now-btn');
  if (syncNowBtn) {
    syncNowBtn.disabled = googleCalSyncing;
    syncNowBtn.textContent = googleCalSyncing ? 'Synchronisiere…' : 'Jetzt synchronisieren';
  }
  const lastSyncSub = document.getElementById('gcal-last-sync-sub');
  if (lastSyncSub) {
    const times = googleCalSettings.selectedCalendarIds
      .map(id => googleCalCache[id]?.lastSyncedAt)
      .filter(Boolean);
    lastSyncSub.textContent = times.length
      ? `Zuletzt synchronisiert: ${new Date(Math.max(...times)).toLocaleString('de-DE')}`
      : 'Noch nicht synchronisiert';
  }
  const errorEl = document.getElementById('gcal-sync-error');
  if (errorEl) {
    errorEl.textContent = googleCalLastError || '';
    errorEl.style.display = googleCalLastError ? 'block' : 'none';
  }
}

function renderGoogleCalendarList() {
  const list = document.getElementById('gcal-calendar-list');
  if (!list) return;
  if (!googleCalCalendarList.length) {
    list.innerHTML = '<div class="settings-row-sub">Kalenderliste wird geladen…</div>';
    return;
  }
  list.innerHTML = googleCalCalendarList.map(c => `
    <label class="gcal-calendar-row">
      <input type="checkbox" class="gcal-calendar-cb" data-cal-id="${escHtml(c.id)}" ${googleCalSettings.selectedCalendarIds.includes(c.id) ? 'checked' : ''}/>
      <span class="gcal-calendar-dot" style="background:${escHtml(c.color)};"></span>
      <span class="gcal-calendar-name">${escHtml(c.summary)}${c.primary ? ' (Haupt)' : ''}</span>
    </label>
  `).join('');
  list.querySelectorAll('.gcal-calendar-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.calId;
      if (cb.checked) {
        googleCalSettings.selectedCalendarIds.push(id);
        saveGoogleCalSettings();
        syncGoogleCalendar(id).then(() => {
          if (currentView === 'calendar' && typeof renderCalendar === 'function') renderCalendar();
          renderGoogleCalendarSettings();
        });
      } else {
        googleCalSettings.selectedCalendarIds = googleCalSettings.selectedCalendarIds.filter(x => x !== id);
        delete googleCalCache[id];
        saveGoogleCalSettings();
        saveGoogleCalCache();
        if (currentView === 'calendar' && typeof renderCalendar === 'function') renderCalendar();
      }
      renderGoogleExportCalendarOptions();
    });
  });
}

// Nur Kalender mit Schreibrechten (owner/writer) sind als Push-Ziel
// sinnvoll — ein reiner Lesezugriff (reader/freeBusyReader) würde beim
// Push ohnehin mit einem Berechtigungsfehler von Google scheitern.
function renderGoogleExportCalendarOptions() {
  const select = document.getElementById('gcal-export-calendar-select');
  if (!select) return;
  const writable = googleCalCalendarList.filter(c => c.accessRole === 'owner' || c.accessRole === 'writer');
  select.innerHTML = writable.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.summary)}</option>`).join('');
  if (googleCalSettings.exportCalendarId && writable.some(c => c.id === googleCalSettings.exportCalendarId)) {
    select.value = googleCalSettings.exportCalendarId;
  } else if (writable.length) {
    googleCalSettings.exportCalendarId = writable[0].id;
    saveGoogleCalSettings();
    select.value = writable[0].id;
  }
}

async function refreshGoogleCalendarList() {
  try {
    googleCalCalendarList = await gcalListCalendars();
    renderGoogleCalendarList();
    renderGoogleExportCalendarOptions();
  } catch (err) {
    googleCalLastError = err.message;
    renderGoogleCalendarSettings();
  }
}

// =========================
// EVENT-WIRING
// =========================

document.getElementById('gcal-connect-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('gcal-connect-btn');
  const errorEl = document.getElementById('gcal-connect-error');
  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Verbinde…';
  try {
    await connectGoogleCalendar();
    await refreshGoogleCalendarList();
    startGoogleCalAutoSync();
    renderGoogleCalendarSettings();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verbinden';
  }
});

document.getElementById('gcal-disconnect-btn')?.addEventListener('click', async () => {
  const confirmed = await hubConfirm({
    title: 'Google Calendar trennen',
    message: 'Die Verbindung wird getrennt und der lokale Spiegel der Google-Termine gelöscht. Deine Nook-Termine bleiben unverändert erhalten — auch bereits zu Google übertragene.',
    confirmText: 'Trennen',
    danger: true,
  });
  if (!confirmed) return;
  await disconnectGoogleCalendar();
  googleCalCalendarList = [];
  renderGoogleCalendarSettings();
});

document.getElementById('gcal-refresh-calendars-btn')?.addEventListener('click', refreshGoogleCalendarList);

document.getElementById('gcal-sync-now-btn')?.addEventListener('click', () => syncAllSelectedGoogleCalendars());

document.getElementById('gcal-autosync-select')?.addEventListener('change', e => {
  googleCalSettings.autoSyncMinutes = parseInt(e.target.value, 10) || 0;
  saveGoogleCalSettings();
  startGoogleCalAutoSync();
});

document.getElementById('gcal-export-toggle')?.addEventListener('change', e => {
  googleCalSettings.exportEnabled = e.target.checked;
  saveGoogleCalSettings();
  renderGoogleCalendarSettings();
});

document.getElementById('gcal-export-calendar-select')?.addEventListener('change', e => {
  googleCalSettings.exportCalendarId = e.target.value || null;
  saveGoogleCalSettings();
});

// Beim Start bereits verbunden -> Kalenderliste einmal nachladen, damit die
// Auswahl-Checkboxen in den Einstellungen sofort Namen/Farben zeigen,
// statt erst nach dem ersten Öffnen des Panels.
if (isGoogleCalendarConnected()) refreshGoogleCalendarList();
