// =========================
// GOOGLE-CALENDAR-AUTH.JS
// Lädt nach js/calendar.js (braucht nichts Kalender-Spezifisches, aber
// gehört logisch zur Kalender-Erweiterung) und VOR google-calendar-api.js/
// google-calendar-sync.js/google-calendar-settings.js (die alle
// ensureGoogleAccessToken()/isGoogleCalendarSupported() nutzen).
//
// Verantwortlich NUR für den OAuth-Lebenszyklus (Google Identity Services,
// kurz "GIS") — KEINE Kalender-Datenlogik, siehe dafür
// google-calendar-sync.js. Architektur bewusst mehrschichtig (auth → api →
// sync → settings-UI), damit später weitere Anbieter (z.B. Outlook/CalDAV)
// als eigene "<provider>-calendar-auth.js/-api.js"-Paare neben dieser
// Google-Implementierung ergänzt werden können, ohne dass calendar.js oder
// google-calendar-sync.js etwas von einem zweiten Anbieter wissen müssen.
//
// WICHTIG — file://-Einschränkung: Google akzeptiert für OAuth (egal ob
// klassisches gapi.auth2 oder das aktuelle Google Identity Services) nur
// "http://localhost" oder "https://" als autorisierte JavaScript-Origin,
// NIEMALS "file://". Das ist eine Google-seitige Hard-Grenze, keine
// Nook-Design-Entscheidung. isGoogleCalendarSupported() kapselt diese
// Prüfung zentral — alle anderen Module (Settings-UI, Sync) fragen NUR
// diese Funktion, statt selbst location.protocol zu prüfen.
//
// Client-ID: kommt — wie SUPABASE_URL/SUPABASE_ANON_KEY (js/sync.js) —
// aus der persönlichen, nicht versionierten js/sync-config.js (siehe
// .gitignore + sync-config.example.js für die Einrichtung), als
// GOOGLE_CLIENT_ID. Kein Eingabefeld im UI: fehlt die Konstante, gilt
// Google Calendar für diese Nook-Instanz als "nicht konfiguriert" — ein
// anderer Zustand als "nicht unterstützt" (file://), siehe
// isGoogleCalendarConfigured()/isGoogleCalendarSupported() unten sowie
// die entsprechend unterschiedlichen Hinweistexte in
// google-calendar-settings.js.
//
// Token-Modell: GIS "Token Client" (implicit-ähnlicher Flow, kein
// Client-Secret nötig — passt zu Nooks No-Backend-Architektur). Es gibt
// dabei KEIN Refresh-Token, nur kurzlebige Access-Tokens (~1h). Der Token
// wird daher BEWUSST NICHT in DB/localStorage persistiert (Google rät
// davon ab, und ohne Backend gibt es ohnehin keinen sicheren Ort dafür) —
// er lebt nur im Speicher dieses Tabs und wird bei Bedarf per
// requestAccessToken({prompt:''}) still erneuert. Das klappt zuverlässig
// nur innerhalb derselben aktiven Google-Sitzung im selben Browser; nach
// Ablauf der Stunde OHNE aktive Sitzung braucht es einen echten Klick
// (Popup-Blocker verhindern sonst ein Popup ohne User-Geste) — siehe
// ensureGoogleAccessToken() unten.
// =========================

const GOOGLE_CAL_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// Persistiert: NUR nicht-sensible Verbindungsinfos (E-Mail zur Anzeige,
// die vom Nutzer eingetragene Client-ID, Verbindungszeitpunkt). Der
// eigentliche Access-Token steht NIE hier drin (siehe Kommentar oben).
let googleCalAccount = DB.get('googleCalAccount', null); // null | { email, clientId, connectedAt }
function saveGoogleCalAccount() { DB.set('googleCalAccount', googleCalAccount); }

// ── In-Memory-Token-State (bewusst nicht persistiert) ───────────────────
let _googleCalAccessToken = null;
let _googleCalTokenExpiry = 0; // ms epoch
let _googleCalTokenClient = null;
let _googleGisLoadPromise = null;

// Analog zum typeof-Check für SUPABASE_URL in js/sync.js: GOOGLE_CLIENT_ID
// kommt aus js/sync-config.js und existiert schlicht nicht, wenn diese
// Datei fehlt (z.B. frischer Fork ohne eigene Google-Client-ID) — kein
// Fehlerzustand, nur "nicht konfiguriert".
function isGoogleCalendarConfigured() {
  return typeof GOOGLE_CLIENT_ID !== 'undefined' && !!GOOGLE_CLIENT_ID;
}

// Getrennt von isGoogleCalendarConfigured() gehalten, damit die
// Einstellungen-UI (google-calendar-settings.js) "file://" und "keine
// Client-ID hinterlegt" als die zwei unterschiedlichen Zustände erkennen
// und je eigenen Hinweistext zeigen kann, statt beides hinter einem
// einzigen Boolean zu verstecken.
function isGoogleCalendarProtocolAllowed() {
  return location.protocol === 'https:' || location.hostname === 'localhost';
}

function isGoogleCalendarSupported() {
  return isGoogleCalendarProtocolAllowed() && isGoogleCalendarConfigured();
}

function isGoogleCalendarConnected() {
  return isGoogleCalendarSupported() && !!googleCalAccount;
}

// ── GIS-Script dynamisch nachladen (Muster wie loadScript() in games.js:
// dynamisch injiziertes <script>, nicht fetch() — funktioniert auch unter
// file://, schlägt dort aber beim eigentlichen OAuth-Aufruf fehl, siehe
// isGoogleCalendarSupported()). Wird nur bei tatsächlichem Bedarf
// aufgerufen (Verbinden-Klick oder aktive Verbindung beim Start), nicht
// unconditional für jeden Nutzer. ─────────────────────────────────────
function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (_googleGisLoadPromise) return _googleGisLoadPromise;
  _googleGisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => { _googleGisLoadPromise = null; reject(new Error('Google Identity Services konnte nicht geladen werden (offline oder blockiert?).')); };
    document.head.appendChild(script);
  });
  return _googleGisLoadPromise;
}

function ensureGoogleTokenClient(clientId) {
  if (_googleCalTokenClient && _googleCalTokenClient.__clientId === clientId) return _googleCalTokenClient;
  _googleCalTokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_CAL_SCOPES,
    callback: () => {}, // wird pro Aufruf in requestGoogleToken() überschrieben
  });
  _googleCalTokenClient.__clientId = clientId;
  return _googleCalTokenClient;
}

// Fordert per GIS-Popup einen Access-Token an. `interactive:true` zeigt bei
// Bedarf den Google-Consent-Screen (nur nach echtem Klick aufrufen, sonst
// blockt der Popup-Blocker). `interactive:false` versucht eine stille
// Erneuerung (funktioniert nur mit noch aktiver Google-Sitzung + bereits
// erteilter Zustimmung, siehe Datei-Kommentar oben).
function requestGoogleToken(clientId, interactive) {
  return new Promise((resolve, reject) => {
    const client = ensureGoogleTokenClient(clientId);
    client.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      _googleCalAccessToken = resp.access_token;
      _googleCalTokenExpiry = Date.now() + (Number(resp.expires_in) || 3500) * 1000;
      resolve(_googleCalAccessToken);
    };
    client.error_callback = (err) => reject(new Error(err?.type || 'Google-Anmeldung fehlgeschlagen'));
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

// Zentrale Stelle, die JEDE API-Anfrage (google-calendar-api.js) vor dem
// eigentlichen fetch() aufruft. Gibt null zurück statt zu werfen, wenn
// keine Verbindung besteht/unterstützt wird — Aufrufer entscheiden dann,
// ob sie eine "bitte neu verbinden"-Meldung zeigen.
async function ensureGoogleAccessToken({ interactive = false } = {}) {
  if (!isGoogleCalendarConnected()) return null;
  if (_googleCalAccessToken && Date.now() < _googleCalTokenExpiry - 30000) return _googleCalAccessToken;
  try {
    await loadGoogleIdentityScript();
    return await requestGoogleToken(googleCalAccount.clientId, interactive);
  } catch (err) {
    console.warn('Google Calendar: Token konnte nicht (still) erneuert werden —', err.message);
    return null;
  }
}

// Ruft die Google-Userinfo ab, nur um die verbundene E-Mail-Adresse für
// die Anzeige in den Einstellungen zu bekommen (kein eigenes Profilbild
// o.ä. — Nook speichert sonst nichts von Google-Kontodaten).
async function fetchGoogleAccountEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Konto-Info konnte nicht geladen werden');
  const data = await res.json();
  return data.email || '';
}

// Vollständiger Verbindungsvorgang, ausgelöst durch echten Klick in den
// Einstellungen (siehe google-calendar-settings.js) — deshalb hier
// `interactive:true` fest verdrahtet. Kein clientId-Parameter mehr: die
// Client-ID kommt aus der Konfigurationsdatei (GOOGLE_CLIENT_ID), nicht
// mehr aus einem Eingabefeld (siehe Datei-Kopf-Kommentar).
async function connectGoogleCalendar() {
  if (!isGoogleCalendarSupported()) {
    throw new Error(isGoogleCalendarConfigured()
      ? 'Google-Anmeldung funktioniert nur über https:// oder http://localhost, nicht beim direkten Öffnen von index.html.'
      : 'Diese Nook-Instanz hat noch keine Google-Client-ID hinterlegt (siehe js/sync-config.example.js).');
  }

  await loadGoogleIdentityScript();
  // Temporär setzen, DAMIT requestGoogleToken()/ensureGoogleTokenClient()
  // mit der richtigen Client-ID arbeiten — endgültig gespeichert wird erst
  // nach erfolgreichem Token-Erhalt unten (kein Teil-Zustand bei Abbruch).
  // googleCalAccount speichert die Client-ID weiterhin mit (Rückwärts-
  // kompatibilität für Bestandsnutzer, die noch mit einer früher manuell
  // eingegebenen ID verbunden sind, siehe ensureGoogleAccessToken() oben).
  const prevAccount = googleCalAccount;
  googleCalAccount = { email: '', clientId: GOOGLE_CLIENT_ID, connectedAt: Date.now() };
  try {
    const token = await requestGoogleToken(GOOGLE_CLIENT_ID, true);
    const email = await fetchGoogleAccountEmail(token);
    googleCalAccount = { email, clientId: GOOGLE_CLIENT_ID, connectedAt: Date.now() };
    saveGoogleCalAccount();
    return googleCalAccount;
  } catch (err) {
    googleCalAccount = prevAccount; // Verbindung fehlgeschlagen -> alten Stand (meist null) wiederherstellen
    throw err;
  }
}

// Trennt die Verbindung: widerruft den Token bei Google (falls vorhanden),
// löscht NUR die von dieser Integration selbst angelegten Daten
// (Konto-Info + gespiegelter Google-Event-Cache, siehe
// google-calendar-sync.js) — bestehende Nook-Termine/-Serien bleiben
// unangetastet, inkl. bereits zu Google gepushter Termine (deren
// `googleSync`-Feld bleibt stehen; ein erneutes Verbinden desselben
// Google-Kontos erkennt sie beim nächsten Push anhand der gespeicherten
// googleEventId weiterhin wieder).
async function disconnectGoogleCalendar() {
  if (_googleCalAccessToken) {
    try { window.google?.accounts?.oauth2?.revoke(_googleCalAccessToken, () => {}); } catch { /* best effort */ }
  }
  _googleCalAccessToken = null;
  _googleCalTokenExpiry = 0;
  _googleCalTokenClient = null;
  googleCalAccount = null;
  saveGoogleCalAccount();
  if (typeof stopGoogleCalAutoSync === 'function') stopGoogleCalAutoSync();
  if (typeof clearGoogleCalCache === 'function') clearGoogleCalCache();
}
