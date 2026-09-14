// =========================
// GOOGLE-CALENDAR-API.JS
// Lädt nach google-calendar-auth.js (braucht ensureGoogleAccessToken()),
// vor google-calendar-sync.js (nutzt alle Funktionen hier).
//
// Verantwortlich NUR für den direkten REST-Zugriff auf die Google Calendar
// API v3 — keine Sync-/Cache-Logik (siehe google-calendar-sync.js), kein
// UI. Reines fetch() gegen https://www.googleapis.com — das funktioniert
// (anders als der OAuth-Login selbst) auch unter file://, da es sich um
// normale Cross-Origin-Requests an einen externen Dienst handelt, nicht um
// lokale Daten (siehe CLAUDE.md: fetch() ist nur für LOKALE Daten
// tabu — externe Dienste wie hier oder Supabase in js/sync.js nutzen
// fetch()/den Supabase-Client ganz regulär).
// =========================

const GOOGLE_CAL_API_BASE = 'https://www.googleapis.com/calendar/v3';

class GoogleAuthRequiredError extends Error {
  constructor() { super('Google-Verbindung abgelaufen — bitte in den Einstellungen erneut verbinden.'); this.name = 'GoogleAuthRequiredError'; }
}
class GoogleSyncTokenExpiredError extends Error {
  constructor() { super('Google-Sync-Token abgelaufen, vollständiger Abgleich nötig.'); this.name = 'GoogleSyncTokenExpiredError'; }
}

async function gcalFetch(path, { method = 'GET', params = null, body = null } = {}) {
  const token = await ensureGoogleAccessToken({ interactive: false });
  if (!token) throw new GoogleAuthRequiredError();

  let url = GOOGLE_CAL_API_BASE + path;
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    if ([...qs].length) url += '?' + qs.toString();
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) throw new GoogleAuthRequiredError();
  if (res.status === 410) throw new GoogleSyncTokenExpiredError();
  if (res.status === 204 || res.status === 404) return null; // z.B. DELETE ohne Body / bereits gelöscht
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
    throw new Error(`Google Calendar API (${res.status}): ${detail || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Liefert alle Kalender des Nutzers (eigene + geteilte, die im Google-Konto
// eingeblendet sind), paginiert über nextPageToken.
async function gcalListCalendars() {
  const out = [];
  let pageToken;
  do {
    const data = await gcalFetch('/users/me/calendarList', { params: { pageToken, maxResults: 250 } });
    (data.items || []).forEach(c => out.push({
      id: c.id,
      summary: c.summaryOverride || c.summary,
      color: c.backgroundColor || '#4285F4',
      primary: !!c.primary,
      accessRole: c.accessRole, // 'owner'|'writer'|'reader'|'freeBusyReader' — steuert, ob Push (v1: nur owner/writer sinnvoll) angeboten wird
    }));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

// Termine EINES Kalenders abrufen. Mit syncToken = inkrementeller Abgleich
// (liefert nur Änderungen seit dem letzten Abruf, gelöschte Termine als
// status:'cancelled'); ohne syncToken = vollständiger Abruf, begrenzt auf
// [timeMin, timeMax] (siehe google-calendar-sync.js für die Fenstergröße).
// singleEvents:true lässt Google wiederkehrende Termine bereits serverseitig
// in Einzeltermine auflösen — dadurch braucht Nook keinen eigenen
// RRULE-Interpreter für IMPORTIERTE Google-Serien.
async function gcalListEvents(calendarId, { syncToken, timeMin, timeMax } = {}) {
  const events = [];
  let pageToken;
  let nextSyncToken = null;
  do {
    const data = await gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
      params: {
        singleEvents: true,
        showDeleted: true,
        maxResults: 250,
        pageToken,
        ...(syncToken ? { syncToken } : { timeMin, timeMax, orderBy: 'startTime' }),
      },
    });
    events.push(...(data.items || []));
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);
  return { events, nextSyncToken };
}

async function gcalInsertEvent(calendarId, eventBody) {
  return gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: eventBody });
}

async function gcalPatchEvent(calendarId, eventId, patchBody) {
  return gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: patchBody });
}

async function gcalDeleteEvent(calendarId, eventId) {
  try {
    await gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
  } catch (err) {
    // Bereits in Google gelöscht/nicht mehr vorhanden -> für uns kein Fehlerfall
    if (!(err instanceof GoogleSyncTokenExpiredError) && !/404|410/.test(err.message)) throw err;
  }
}
