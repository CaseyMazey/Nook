// =========================
// GOOGLE-CALENDAR-SYNC.JS
// Lädt nach google-calendar-api.js, vor google-calendar-settings.js
// (nutzt syncAllSelectedGoogleCalendars()/gcalListCalendars() darüber) UND
// vor js/settings.js (dessen renderSettings() optional
// renderGoogleCalendarSettings() aufruft). calendar.js selbst braucht
// NICHTS von hier fest — es ruft getGoogleEventsForRange() nur über einen
// `typeof`-Check auf (siehe calendar.js: getEventsForRange()), Ladereihenfolge
// relativ zu calendar.js ist daher unkritisch, solange diese Datei vor dem
// ERSTEN Render der Kalenderansicht ausgeführt ist (immer der Fall, alle
// Skripte laden vor jeder Nutzer-Interaktion).
//
// Verantwortlich für:
//   - Google-Termine als READ-ONLY Spiegel in einem EIGENEN State
//     (googleCalCache) zu halten — bewusst GETRENNT von Nooks eigenem
//     `events`/`eventSeries` (main.js/calendar.js), damit unmöglich ist,
//     dass ein Google-Sync bestehende Nook-Termine überschreibt/löscht.
//     Exakt dasselbe Muster wie `eventSeries` (main.js/calendar.js): eine
//     eigene, separat gespeicherte Liste, die calendar.js zur Laufzeit nur
//     LIEST und in getEventsForRange()/getEventsForDay() reinmischt — KEINE
//     vierte parallele Terminform, kein Schreibzugriff auf `events`.
//   - Inkrementellen Abgleich (Google syncToken) inkl. Löschungen
//     (status:'cancelled').
//   - getGoogleEventsForRange(start, end)/-ForDay(date) — Google-Pendant zu
//     calendar.js' getEventsForRange()/getEventsForDay(), liefert dasselbe
//     Eintrags-Format { ev, key, isRange, isStart, isEnd, isGoogle:true }
//     (isGoogle spielt dieselbe Rolle wie isRecurring bei Terminserien —
//     ein reiner Anzeige-Flag, kein Strukturunterschied), damit
//     Monatsansicht/Tagesmodal sie mit minimalem Zusatzcode neben
//     Nook-Terminen rendern können.
//   - Optionalen PUSH einzelner/mehrtägiger Nook-Termine zu Google (siehe
//     Datei-Kopf-Entscheidung: KEINE Serien in v1 — Nooks Serien-Engine
//     (RRULE-ähnlich + Ausnahmen, siehe calendar.js) müsste dafür in
//     Googles RRULE-Format inkl. Ausnahme-Instanzen übersetzt werden, ein
//     eigenständiges Folge-Feature). Die Verknüpfung Nook-Termin↔Google-
//     Event läuft über `ev.googleSync.googleEventId` auf dem Nook-Event
//     selbst (main.js/calendar.js `events`) — siehe
//     buildGooglePushedEventIdSet() weiter unten, das daraus die
//     ID-Mapping-Tabelle für die Dedup-Prüfung beim Pull ableitet, statt
//     eine zweite, potenziell aus dem Tritt geratende Kopie der Zuordnung
//     zu pflegen.
// =========================

// ── Einstellungen (persistiert, geräteübergreifend synchronisiert über
// Nooks bestehenden Supabase-Sync in js/sync.js — DB.set() läuft dort für
// JEDEN Key automatisch mit, keine Sonderbehandlung hier nötig) ─────────
let googleCalSettings = DB.get('googleCalSettings', {
  selectedCalendarIds: [],   // welche Google-Kalender in Nook angezeigt werden
  autoSyncMinutes: 15,       // 0 = nur manueller Sync-Button
  exportEnabled: false,      // Nook -> Google Push für einzelne/mehrtägige Termine anbieten
  exportCalendarId: null,    // Ziel-Kalender für den Push
});
function saveGoogleCalSettings() { DB.set('googleCalSettings', googleCalSettings); }

// { [calendarId]: { syncToken, lastSyncedAt, color, summary, events: [NormalizedGoogleEvent] } }
let googleCalCache = DB.get('googleCalCache', {});
function saveGoogleCalCache() { DB.set('googleCalCache', googleCalCache); }
function clearGoogleCalCache() { googleCalCache = {}; saveGoogleCalCache(); }

// Nicht persistiert — reiner Laufzeit-/UI-Status.
let googleCalCalendarList = []; // letzter gcalListCalendars()-Abruf, für die Auswahl-Checkboxen in den Einstellungen
let googleCalSyncing = false;
let googleCalLastError = null;
let _googleCalAutoSyncTimer = null;

// Erstabruf-Fenster für einen Kalender ohne syncToken (z.B. beim ersten
// Verbinden oder nach abgelaufenem Token, siehe SyncTokenExpiredError
// unten) — bewusst begrenzt, damit nicht Jahrzehnte an Terminen aus einem
// alten Google-Konto importiert werden. Nach dem Erstabruf läuft alles
// Weitere inkrementell über syncToken, unabhängig vom Zeitfenster.
const GOOGLE_CAL_INITIAL_WINDOW_MONTHS_PAST = 3;
const GOOGLE_CAL_INITIAL_WINDOW_MONTHS_FUTURE = 12;

// =========================
// NORMALISIERUNG Google-Event -> Nook-kompatible Form
// =========================

function addDaysToKey(key, days) {
  const d = parseLocalDate(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

// Google-Events kommen in zwei Formen: ganztägig ({date:'YYYY-MM-DD'}, Ende
// EXKLUSIV) oder mit Uhrzeit ({dateTime: ISO-String mit Offset}). Nooks
// eigenes Modell kennt nur inklusive End-Daten (siehe calendar.js-Kopf) —
// die Differenz wird hier einmalig aufgelöst, der Rest des Codes muss sie
// nirgendwo sonst kennen.
function normalizeGoogleEvent(g, calendarId, calendarColor) {
  let startDate, endDate, time = '';
  if (g.start?.date) {
    startDate = g.start.date;
    const exclusiveEnd = g.end?.date || addDaysToKey(startDate, 1);
    endDate = addDaysToKey(exclusiveEnd, -1);
  } else if (g.start?.dateTime) {
    const startD = new Date(g.start.dateTime);
    const endD   = new Date(g.end?.dateTime || g.start.dateTime);
    startDate = dateKey(startD);
    endDate   = dateKey(endD);
    time = `${String(startD.getHours()).padStart(2,'0')}:${String(startD.getMinutes()).padStart(2,'0')}`;
  } else {
    return null; // Weder Datum noch Uhrzeit -> kaputtes/uninterpretierbares Google-Event, überspringen
  }
  const isRange = endDate !== startDate;
  return {
    id: `google:${calendarId}:${g.id}`,
    googleEventId: g.id,
    calendarId,
    title: g.summary || '(Ohne Titel)',
    notes: g.description || '',
    time: isRange ? '' : time,
    startDate,
    endDate: isRange ? endDate : undefined,
    color: calendarColor,
    htmlLink: g.htmlLink || null,
    updated: g.updated || null,
    etag: g.etag || null, // für spätere Konfliktauflösung vorgehalten, aktuell ungenutzt (v1 ist reiner Nur-Lese-Spiegel)
    source: 'google',
  };
}

// =========================
// ID-MAPPING — Duplikate zwischen gepushten und gespiegelten Terminen
// vermeiden
// =========================
//
// Ein per pushNookEventToGoogle() zu Google übertragener Nook-Termin taucht
// beim nächsten Pull ganz normal in Googles events.list()-Antwort auf —
// ohne Gegenmaßnahme würde er dadurch ZUSÄTZLICH als eigener
// "Google"-Termin im Spiegel (googleCalCache) landen: derselbe Termin wäre
// im Kalender doppelt sichtbar (einmal nativ als Nook-Termin, einmal als
// isGoogle-Eintrag). Die Verknüpfung Nook↔Google ist bereits vollständig
// auf dem Nook-Event selbst gespeichert (ev.googleSync.googleEventId,
// siehe pushNookEventToGoogle() unten) — das HIER ist bewusst keine
// zusätzliche, separat persistierte Zuordnungstabelle (zwei Kopien
// derselben Information könnten sonst auseinanderlaufen), sondern eine
// leichte, immer aktuelle Ableitung daraus: ein Set aller googleEventIds,
// die bereits als natives Nook-Event angezeigt werden. syncGoogleCalendar()
// filtert damit vor dem Cachen jeden Treffer heraus.
function buildGooglePushedEventIdSet() {
  const ids = new Set();
  Object.values(events).forEach(dayEvs => {
    (dayEvs || []).forEach(ev => { if (ev.googleSync?.googleEventId) ids.add(ev.googleSync.googleEventId); });
  });
  return ids;
}

// =========================
// SYNC — ein Kalender
// =========================

async function syncGoogleCalendar(calendarId, { fullResync = false } = {}) {
  const meta = googleCalCache[calendarId] || { syncToken: null, lastSyncedAt: null, events: [] };
  const useToken = !fullResync && meta.syncToken;

  const calInfo = googleCalCalendarList.find(c => c.id === calendarId);
  const calendarColor = calInfo?.color || meta.color || '#4285F4';

  let result;
  try {
    if (useToken) {
      result = await gcalListEvents(calendarId, { syncToken: meta.syncToken });
    } else {
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth() - GOOGLE_CAL_INITIAL_WINDOW_MONTHS_PAST, 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + GOOGLE_CAL_INITIAL_WINDOW_MONTHS_FUTURE, 1).toISOString();
      result = await gcalListEvents(calendarId, { timeMin, timeMax });
    }
  } catch (err) {
    if (err instanceof GoogleSyncTokenExpiredError) {
      // Google verlangt bei abgelaufenem syncToken einen kompletten Neuabruf
      // (siehe API-Doku, HTTP 410) — Cache für diesen Kalender verwerfen und
      // einmal sauber neu aufbauen, statt einen Fehler hochzureichen.
      googleCalCache[calendarId] = { syncToken: null, lastSyncedAt: null, color: calendarColor, events: [] };
      return syncGoogleCalendar(calendarId, { fullResync: true });
    }
    throw err;
  }

  // Merge: bestehende Events als Map (googleEventId -> event), neue/
  // geänderte überschreiben, status:'cancelled' entfernt. Bei vollem
  // Neuabruf ersetzt die Antwort den kompletten Bestand dieses Kalenders.
  const byId = new Map((fullResync || !useToken) ? [] : meta.events.map(e => [e.googleEventId, e]));
  const pushedIds = buildGooglePushedEventIdSet();
  result.events.forEach(g => {
    // Von Nook selbst zu Google gepushter Termin, der hier als eigenes
    // Google-Event zurückkommt -> NICHT zusätzlich cachen, siehe
    // buildGooglePushedEventIdSet()-Kommentar oben (sonst doppelte Anzeige).
    if (g.status === 'cancelled' || pushedIds.has(g.id)) { byId.delete(g.id); return; }
    const norm = normalizeGoogleEvent(g, calendarId, calendarColor);
    if (norm) byId.set(g.id, norm);
  });

  googleCalCache[calendarId] = {
    syncToken: result.nextSyncToken || meta.syncToken || null,
    lastSyncedAt: Date.now(),
    color: calendarColor,
    summary: calInfo?.summary || meta.summary || '',
    events: [...byId.values()],
  };
  saveGoogleCalCache();
}

// =========================
// SYNC — alle ausgewählten Kalender (Einstiegspunkt für Timer + manuellen
// "Jetzt synchronisieren"-Button)
// =========================

async function syncAllSelectedGoogleCalendars() {
  if (!isGoogleCalendarConnected() || googleCalSyncing) return;
  if (!googleCalSettings.selectedCalendarIds.length) return;

  googleCalSyncing = true;
  googleCalLastError = null;
  if (typeof renderGoogleCalendarSettings === 'function') renderGoogleCalendarSettings();

  // Sequenziell statt parallel, um Googles Rate-Limits pro Nutzer nicht
  // mit gleichzeitigen Requests über mehrere Kalender zu strapazieren —
  // bei üblicherweise wenigen ausgewählten Kalendern kein spürbarer
  // Geschwindigkeitsnachteil.
  for (const calendarId of googleCalSettings.selectedCalendarIds) {
    try {
      await syncGoogleCalendar(calendarId);
    } catch (err) {
      googleCalLastError = err instanceof GoogleAuthRequiredError
        ? 'Google-Verbindung abgelaufen — bitte erneut verbinden.'
        : `Sync fehlgeschlagen (${calInfoLabel(calendarId)}): ${err.message}`;
      console.error('Google Calendar Sync:', err);
      // Ein fehlgeschlagener Kalender bricht nicht den ganzen Durchlauf ab —
      // die übrigen ausgewählten Kalender werden trotzdem weiter abgeglichen.
    }
  }

  googleCalSyncing = false;
  if (currentView === 'calendar' && typeof renderCalendar === 'function') renderCalendar();
  if (typeof renderMiniCal === 'function') renderMiniCal();
  if (typeof renderGoogleCalendarSettings === 'function') renderGoogleCalendarSettings();
}

function calInfoLabel(calendarId) {
  return googleCalCache[calendarId]?.summary || googleCalCalendarList.find(c => c.id === calendarId)?.summary || calendarId;
}

// ── Auto-Sync-Timer ──────────────────────────────────────────────────
function startGoogleCalAutoSync() {
  stopGoogleCalAutoSync();
  if (!isGoogleCalendarConnected() || !googleCalSettings.autoSyncMinutes) return;
  _googleCalAutoSyncTimer = setInterval(syncAllSelectedGoogleCalendars, googleCalSettings.autoSyncMinutes * 60000);
}
function stopGoogleCalAutoSync() {
  if (_googleCalAutoSyncTimer) { clearInterval(_googleCalAutoSyncTimer); _googleCalAutoSyncTimer = null; }
}

// =========================
// getGoogleEventsForRange(start, end) — Google-Pendant zu calendar.js'
// getEventsForRange(). Liefert bewusst dasselbe Eintrags-Format/dieselbe
// Map<dateKey, entries[]>-Form, damit calendar.js' bestehende
// Render-Schleifen (Monatsansicht, Tagesmodal, Statistik) sie mit minimalem
// `isGoogle`-Zusatzcode neben Nook-Terminen anzeigen können, statt eine
// zweite parallele Rendering-Logik zu brauchen. Jeder Google-Kalender wird
// dabei — wie bei getEventsForRange()s Einzel-/Mehrtagesterminen — nur
// EINMAL für den ganzen Bereich durchlaufen, nicht pro Tag.
// =========================

function getGoogleEventsForRange(startDate, endDate) {
  const map = new Map();
  if (!isGoogleCalendarConnected() || !googleCalSettings.selectedCalendarIds.length) return map;
  const rs = new Date(startDate); rs.setHours(0,0,0,0);
  const re = new Date(endDate);   re.setHours(0,0,0,0);

  googleCalSettings.selectedCalendarIds.forEach(calId => {
    const cache = googleCalCache[calId];
    if (!cache) return;
    cache.events.forEach(ev => {
      const start = parseLocalDate(ev.startDate); start.setHours(0,0,0,0);
      const end   = parseLocalDate(ev.endDate || ev.startDate); end.setHours(0,0,0,0);
      const from  = start.getTime() > rs.getTime() ? start : rs;
      const to    = end.getTime()   < re.getTime() ? end   : re;
      if (from.getTime() > to.getTime()) return;
      for (let d = new Date(from); d.getTime() <= to.getTime(); d.setDate(d.getDate() + 1)) {
        const k = dateKey(d);
        let arr = map.get(k);
        if (!arr) { arr = []; map.set(k, arr); }
        arr.push({
          ev, key: ev.startDate,
          isRange: !!ev.endDate,
          isStart: d.getTime() === start.getTime(),
          isEnd:   d.getTime() === end.getTime(),
          isGoogle: true,
        });
      }
    });
  });
  return map;
}

// Dünner Einzeltag-Wrapper, analog zu calendar.js' getEventsForDay() über
// getEventsForRange() — für Aufrufer, die nur einen Tag brauchen.
function getGoogleEventsForDay(date) {
  return getGoogleEventsForRange(date, date).get(dateKey(date)) || [];
}

// =========================
// PUSH — Nook-Termin (einmalig/mehrtägig, siehe Datei-Kopf) -> Google
// =========================

// Nook speichert bei Terminen mit Uhrzeit keine explizite Dauer (nur den
// Start) — beim Export nach Google (das zwingend Start UND Ende braucht)
// wird deshalb pauschal 1h angenommen. Für Termine ohne Uhrzeit/mehrtägige
// Termine wird ganztägig exportiert.
const GOOGLE_PUSH_DEFAULT_DURATION_MIN = 60;

function nookEventToGoogleBody(title, notes, startKey, endKey, time) {
  if (endKey && endKey !== startKey) {
    return {
      summary: title,
      description: notes || undefined,
      start: { date: startKey },
      end: { date: addDaysToKey(endKey, 1) }, // Google-Ende exklusiv
    };
  }
  if (!time) {
    return {
      summary: title,
      description: notes || undefined,
      start: { date: startKey },
      end: { date: addDaysToKey(startKey, 1) },
    };
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [h, m] = time.split(':').map(Number);
  const startD = parseLocalDate(startKey); startD.setHours(h, m, 0, 0);
  const endD = new Date(startD.getTime() + GOOGLE_PUSH_DEFAULT_DURATION_MIN * 60000);
  const iso = d => `${dateKey(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00`;
  return {
    summary: title,
    description: notes || undefined,
    start: { dateTime: iso(startD), timeZone: tz },
    end:   { dateTime: iso(endD),   timeZone: tz },
  };
}

// Wird NACH dem lokalen saveEvents() in calendar.js aufgerufen (siehe
// dortigen Save-Handler) — bewusst fire-and-forget/async statt den
// Speicher-Vorgang zu blockieren, damit das Modal wie bisher sofort
// schließt. Schreibt `ev.googleSync` direkt auf das übergebene Event-Objekt
// (dieselbe Referenz, die in `events` steht) und persistiert danach erneut
// über saveEvents() — bei einem Fehler bleibt der Termin ein ganz normaler,
// rein lokaler Nook-Termin (kein Datenverlust, nur kein Google-Abgleich).
async function pushNookEventToGoogle(ev, startKey, endKey) {
  if (!googleCalSettings.exportEnabled || !googleCalSettings.exportCalendarId) return;
  const calendarId = googleCalSettings.exportCalendarId;
  const body = nookEventToGoogleBody(ev.title, ev.notes, startKey, endKey, ev.time);
  try {
    let result;
    if (ev.googleSync?.googleEventId) {
      result = await gcalPatchEvent(calendarId, ev.googleSync.googleEventId, body);
    } else {
      result = await gcalInsertEvent(calendarId, body);
    }
    ev.googleSync = { calendarId, googleEventId: result.id, lastPushedAt: Date.now() };
  } catch (err) {
    console.error('Google Calendar Push fehlgeschlagen:', err);
    ev.googleSync = { ...(ev.googleSync || {}), lastPushError: err.message };
  }
  saveEvents();
}

// Wird vor dem lokalen Entfernen eines Nook-Termins aufgerufen (siehe
// calendar.js Lösch-Handler). Fire-and-forget — ein Fehlschlag beim
// Google-Löschen verhindert NICHT das lokale Löschen in Nook (Nook bleibt
// die primäre Quelle, siehe calendar.md "Der Kalender bleibt die einzige
// Quelle für Terminverwaltung").
function deleteGoogleEventIfSynced(ev) {
  if (!ev.googleSync?.googleEventId) return;
  gcalDeleteEvent(ev.googleSync.calendarId, ev.googleSync.googleEventId)
    .catch(err => console.warn('Google Calendar: Löschen fehlgeschlagen (lokal trotzdem entfernt):', err.message));
}

// ── Start: läuft der Nutzer bereits verbunden in die App, einmal
// synchronisieren (holt z.B. Löschungen/Änderungen aus Google nach, die seit
// dem letzten Besuch passiert sind) und danach den Auto-Sync-Timer scharf
// schalten. syncAllSelectedGoogleCalendars() versucht dafür intern einen
// STILLEN Token — ohne aktive Google-Sitzung bleibt das folgenlos (siehe
// ensureGoogleAccessToken() in google-calendar-auth.js), kein Popup beim
// bloßen Öffnen von Nook. ───────────────────────────────────────────────
if (isGoogleCalendarConnected()) {
  syncAllSelectedGoogleCalendars();
  startGoogleCalAutoSync();
}
