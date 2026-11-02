// =========================
// SYNC — Geräte-übergreifender Datenabgleich über Supabase
// Lädt direkt nach hub-utils.js (braucht wireModal()/hubConfirm()), vor
// allen Tab-Dateien. Kennt keine einzelne Tab-Bedeutung — arbeitet
// ausschließlich über den zentralen DB-Wrapper (main.js), der die EINZIGE
// Persistenz-Schnittstelle im gesamten Projekt ist.
//
// Architektur ("local-first"):
//   - DB.get() bleibt unverändert synchron, liest weiterhin sofort aus
//     localStorage — keine Wartezeit auf Netzwerk beim Rendern, App bleibt
//     offline voll nutzbar. Alle ~180 bestehenden Aufrufstellen bleiben
//     unangetastet.
//   - DB.set() wird HIER additiv erweitert: schreibt weiterhin sofort
//     synchron nach localStorage (unverändertes Verhalten), stößt danach
//     zusätzlich einen asynchronen Hintergrund-Push zu Supabase an
//     (fire-and-forget) — nur falls angemeldet.
//   - Jeder DB-Key bekommt einen lokalen Zeitstempel (SYNC_META_KEY), der
//     bei Konflikten entscheidet: "last write wins" pro Key, kein Merge
//     auf Feldebene. Für eine Einzelperson/Haushalt ohne echte simultane
//     Bearbeitung ausreichend.
//   - Ohne Anmeldung verhält sich Nook exakt wie bisher — Sync ist rein
//     additiv/optional, kein Login-Zwang.
//
// Ohne geladenes Supabase-SDK (z.B. file://, geblockter CDN-Zugriff)
// bleibt Nook ohne Fehler rein lokal nutzbar — siehe initSync().
//
// SUPABASE_URL/SUPABASE_ANON_KEY kommen NICHT aus dieser Datei, sondern
// aus js/sync-config.js (lädt direkt davor, siehe index.html) — eine
// bewusst nicht versionierte, persönliche Konfigurationsdatei. Nook
// bleibt dadurch offener Code: jeder kann sein eigenes Supabase-Projekt
// eintragen, ohne js/sync.js anzufassen. Siehe sync-config.example.js.
// =========================

const SYNC_META_KEY = "__nook_sync_meta__";
const SYNC_TABLE = "kv_store";
// Speichert die user_id, für die der Erstabgleich (runInitialMerge) auf
// diesem Gerät bereits gelaufen ist — verhindert, dass die bei jedem
// Seitenaufruf wiederkehrende "SIGNED_IN"-Session-Wiederherstellung den
// Merge (und den abschließenden Reload) erneut auslöst.
const INITIAL_MERGE_DONE_KEY = "__nook_sync_initial_merge_done__";

// Fehlt sync-config.js (z.B. frischer Fork ohne eigenes Supabase-Projekt),
// ist SUPABASE_URL schlicht nicht definiert — Nook läuft dann bewusst
// fehlerfrei rein lokal weiter, statt mit einer kaputten Konfiguration
// zu crashen.
const sbClient = (typeof window.supabase !== "undefined" && typeof SUPABASE_URL !== "undefined")
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ── Original-DB.set() vor der Erweiterung sichern ──────────────────────
// _dbSetRaw schreibt NUR lokal, ohne erneut zu pushen — für Sync-interne
// Schreibvorgänge (eingehende Remote-Werte), die sonst eine Endlosschleife
// aus Push→Echo→Push auslösen würden.
const _dbSetRaw = DB.set;

function getSyncMeta() {
  try { return JSON.parse(localStorage.getItem(SYNC_META_KEY)) || {}; }
  catch { return {}; }
}
function setSyncMeta(meta) {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

// Interne Keys, die weder synchronisiert noch ins Backup gehören: unsere
// eigene Buchhaltung sowie Supabase's eigener Session-Speicher (sb-...,
// enthält Access-/Refresh-Token — gehört niemals in eine Datei oder auf
// ein anderes Gerät). Wird auch vom Backup in settings.js benutzt.
function isSyncInternalKey(key) {
  return key === SYNC_META_KEY || key === INITIAL_MERGE_DONE_KEY || key.startsWith("sb-");
}

// Reine Geräte-Zustände bzw. Caches, die lokal bleiben: der Wetter-Cache
// (enthält bei GPS den Standort), Akkordeon-/Layout-Zustände dieses Geräts.
// Würden sonst bei jedem Seitenaufruf bzw. Klick einen Upload auslösen.
const SYNC_LOCAL_ONLY_KEYS = [
  "weatherData", "currentDate", "tabVisibilityOpen", "googleCalSettingsOpen",
  "sidebarCollapsed", "settingsCollapsedGroups",
];

// Keys, die nie über die generische DB-Sync-Logik laufen dürfen.
function isSyncableKey(key) {
  return !isSyncInternalKey(key) && !SYNC_LOCAL_ONLY_KEYS.includes(key);
}

// Laufende Uploads — damit z.B. der Backup-Import vor seinem Reload warten
// kann, bis alles in der Cloud angekommen ist (ein Reload bricht offene
// Requests sonst ab).
const syncPendingPushes = new Set();
function syncFlushPending() {
  return Promise.allSettled([...syncPendingPushes]);
}

function pushToSupabase(userId, key, val, ts) {
  if (!sbClient || !userId) return Promise.resolve();
  const p = (async () => {
    const { error } = await sbClient.from(SYNC_TABLE).upsert(
      { user_id: userId, key, value: val, updated_at: new Date(ts).toISOString() },
      { onConflict: "user_id,key" }
    );
    if (error) console.error("Sync: Push fehlgeschlagen für", key, error);
  })();
  syncPendingPushes.add(p);
  p.finally(() => syncPendingPushes.delete(p));
  return p;
}

// Entfernt Keys lokal UND in der Cloud (z.B. "Daten eines Tabs
// zurücksetzen" in settings.js) — ohne den Remote-Löschschritt kämen die
// Daten beim nächsten Erstabgleich eines Geräts wieder zurück.
async function syncRemoveKeys(keys) {
  const meta = getSyncMeta();
  keys.forEach((k) => { localStorage.removeItem(k); delete meta[k]; });
  setSyncMeta(meta);
  if (!sbClient || !currentUserId || !keys.length) return;
  const { error } = await sbClient.from(SYNC_TABLE).delete().eq("user_id", currentUserId).in("key", keys);
  if (error) console.error("Sync: Löschen fehlgeschlagen", error);
}

// ── DB.set() additiv erweitern ──────────────────────────────────────────
DB.set = function (key, val) {
  const ok = _dbSetRaw(key, val); // Erfolg/Fehlschlag des lokalen Speicherns durchreichen
  if (!isSyncableKey(key)) return ok;
  const now = Date.now();
  const meta = getSyncMeta();
  meta[key] = now;
  setSyncMeta(meta);
  if (currentUserId) pushToSupabase(currentUserId, key, val, now);
  return ok;
};

// ── Auth-Status & UI ─────────────────────────────────────────────────
let currentUserId = null;
let realtimeChannel = null;

function updateSyncStatusUI(session) {
  const sub = document.getElementById("sync-status-sub");
  const btn = document.getElementById("sync-status-btn");
  if (!sub || !btn) return;
  if (session) {
    sub.textContent = `Angemeldet als ${session.user.email}`;
    btn.textContent = "Abmelden";
  } else {
    sub.textContent = "Nicht angemeldet — Daten bleiben nur auf diesem Gerät";
    btn.textContent = "Anmelden";
  }
  document.getElementById("sync-password-row")?.classList.toggle("hidden", !session);
}

function showUpdateBanner() {
  document.getElementById("sync-update-banner")?.classList.remove("hidden");
}

// ── Katalog-Abgleich beim App-Start (bereits angemeldet) ────────────────
// Nicht-blockierend: die App ist längst mit dem aktuellen (evtl. leicht
// veralteten) lokalen Stand gerendert, bevor diese Funktion überhaupt
// fertig ist. Nur strikt neuere Remote-Werte werden übernommen, dann wird
// NICHT automatisch neu geladen (könnte mitten in einer Eingabe stören) —
// stattdessen der Hinweis-Banner mit Klick-zum-Neuladen.
async function catchUpSync(userId) {
  const { data: rows, error } = await sbClient
    .from(SYNC_TABLE)
    .select("key, value, updated_at")
    .eq("user_id", userId);
  if (error) { console.error("Sync: Abgleich fehlgeschlagen", error); return; }

  const meta = getSyncMeta();
  let changed = false;
  (rows || []).forEach((row) => {
    if (!isSyncableKey(row.key)) return;
    const remoteTs = new Date(row.updated_at).getTime();
    const localTs = meta[row.key] || 0;
    if (remoteTs > localTs) {
      _dbSetRaw(row.key, row.value);
      meta[row.key] = remoteTs;
      changed = true;
    }
  });
  if (changed) { setSyncMeta(meta); showUpdateBanner(); }
}

// ── Realtime: Änderungen von anderen Geräten, während diese Seite offen
// ist. Der eigene Push kommt hier per Postgres-Broadcast auch wieder rein
// ("Echo") — der Zeitstempel-Vergleich filtert ihn zuverlässig heraus,
// da beim eigenen Push exakt derselbe Zeitstempel lokal wie remote steht.
function subscribeRealtime(userId) {
  if (!sbClient || realtimeChannel) return;
  realtimeChannel = sbClient
    .channel(`kv_store_${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: SYNC_TABLE, filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new;
        if (!row || !row.key || !isSyncableKey(row.key)) return;
        const remoteTs = new Date(row.updated_at).getTime();
        const meta = getSyncMeta();
        const localTs = meta[row.key] || 0;
        if (remoteTs <= localTs) return;
        _dbSetRaw(row.key, row.value);
        meta[row.key] = remoteTs;
        setSyncMeta(meta);
        showUpdateBanner();
      }
    )
    .subscribe();
}
function unsubscribeRealtime() {
  if (realtimeChannel) { sbClient.removeChannel(realtimeChannel); realtimeChannel = null; }
}

// ── Erstabgleich direkt nach dem Anmelden (einmaliges Ereignis) ─────────
// Zwei Datensätze können hier aufeinandertreffen (dieses Gerät + bereits
// in der Cloud vorhandene Daten eines anderen Geräts) — anders als beim
// laufenden Betrieb gibt es hier noch KEINE verlässlichen Zeitstempel für
// die lokalen Altdaten. Deshalb bewusst simple, deterministische Regel:
// existiert ein Key bereits remote, gewinnt remote (das Gerät, das zuerst
// synchronisiert hat, setzt den Ausgangsstand); existiert er nur lokal,
// wird er hochgeladen. Ab hier läuft alles Weitere über echte Zeitstempel.
// Schließt mit einem vollständigen Reload ab — die vielen tab-eigenen
// `let`-Zustände (z.B. `tasks` in main.js) werden nur beim Skript-Load aus
// DB.get() befüllt, ein Reload ist hier der einfachste sichere Weg, jeden
// betroffenen Tab korrekt neu zu befüllen (gleiches Muster wie beim
// bestehenden Backup-Import in settings.js).
async function runInitialMerge(userId) {
  const { data: rows, error } = await sbClient
    .from(SYNC_TABLE)
    .select("key, value, updated_at")
    .eq("user_id", userId);
  if (error) { console.error("Sync: Erstabgleich fehlgeschlagen", error); return; }

  const remoteByKey = Object.fromEntries((rows || []).map((r) => [r.key, r]));
  const meta = getSyncMeta();
  const toPush = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!isSyncableKey(key)) continue;
    const remote = remoteByKey[key];
    if (remote) {
      _dbSetRaw(key, remote.value);
      meta[key] = new Date(remote.updated_at).getTime();
    } else {
      let value;
      try { value = JSON.parse(localStorage.getItem(key)); } catch { continue; }
      const now = Date.now();
      meta[key] = now;
      toPush.push({ user_id: userId, key, value, updated_at: new Date(now).toISOString() });
    }
  }
  // Keys, die es nur in der Cloud gibt (z.B. Tab auf diesem Gerät nie
  // geöffnet), ebenfalls übernehmen — die Schleife oben sieht nur lokale.
  (rows || []).forEach((row) => {
    if (!isSyncableKey(row.key) || localStorage.getItem(row.key) !== null) return;
    _dbSetRaw(row.key, row.value);
    meta[row.key] = new Date(row.updated_at).getTime();
  });
  setSyncMeta(meta);

  if (toPush.length) {
    const { error: pushError } = await sbClient.from(SYNC_TABLE).upsert(toPush, { onConflict: "user_id,key" });
    if (pushError) console.error("Sync: Erst-Upload fehlgeschlagen", pushError);
  }
  location.reload();
}

// ── Login-Modal ──────────────────────────────────────────────────────
// Fehler aus dem Anmelde-Rücksprung (abgelaufener Link, abgebrochener
// Google-Login) stehen nur kurz in der URL: showView() in main.js ersetzt den
// Hash beim Start durch die aktuelle View. Deshalb direkt beim Laden dieser
// Datei auslesen — ohne das bekäme der Nutzer gar keine Rückmeldung.
const syncAuthCallbackError = (() => {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(location.search);
  const error = params.get("error") || query.get("error");
  if (!error) return null;
  const code = params.get("error_code") || query.get("error_code");
  if (query.has("error")) {
    ["error", "error_code", "error_description"].forEach((k) => query.delete(k));
    const search = query.toString();
    history.replaceState(null, "", location.pathname + (search ? `?${search}` : "") + location.hash);
  }
  return { error, code };
})();

// Der Google-Button erscheint nur, wenn der Provider in Supabase aktiv ist —
// sonst landete der Klick auf einer rohen JSON-Fehlerseite von Supabase.
// file:// kann nach dem Login nicht zurückgeleitet werden (siehe CLAUDE.md).
let syncGoogleAvailable = false;

async function detectSyncGoogleLogin() {
  if (!location.protocol.startsWith("http")) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    if (!res.ok) return;
    const settings = await res.json();
    syncGoogleAvailable = settings.external?.google === true;
    document.getElementById("sync-login-google")?.classList.toggle("hidden", !syncGoogleAvailable);
  } catch (err) {
    console.warn("Sync: Anmeldearten konnten nicht geprüft werden", err);
  }
}

function syncLoginFallbackHint() {
  return syncGoogleAvailable
    ? "Melde dich mit Google an oder versuche es später noch einmal."
    : "Bitte versuche es später noch einmal.";
}

const SYNC_PASSWORD_MIN_LENGTH = 8;

// Übersetzt Supabase-Fehler in Texte, die Nutzern sagen, was sie tun können.
// Codes laut https://supabase.com/docs/guides/auth/debugging/error-codes
function syncLoginErrorText(error) {
  const waitSeconds = /after (\d+) seconds?/i.exec(error.message || "")?.[1];
  if (waitSeconds) return `Du hast gerade schon einen Link angefordert. Warte bitte noch ${waitSeconds} Sekunden und schau solange in dein Postfach.`;
  switch (error.code) {
    case "invalid_credentials":
      return "E-Mail oder Passwort stimmen nicht. Noch kein Konto? Dann klicke auf „Konto erstellen“.";
    case "user_already_exists":
    case "email_exists":
      return "Zu dieser E-Mail-Adresse gibt es schon ein Konto. Klicke auf „Anmelden“.";
    case "email_not_confirmed":
      return "Dieses Konto ist noch nicht per E-Mail bestätigt.";
    case "weak_password":
      return `Dieses Passwort ist zu unsicher. Bitte nimm mindestens ${SYNC_PASSWORD_MIN_LENGTH} Zeichen und vermeide leicht zu erratende Wörter.`;
    case "same_password":
      return "Das ist schon dein aktuelles Passwort. Bitte wähle ein anderes.";
    case "reauthentication_needed":
      return "Melde dich bitte einmal ab und neu an, bevor du das Passwort änderst.";
    case "over_email_send_rate_limit":
      return `Gerade können keine Anmelde-Mails verschickt werden, weil das Limit erreicht ist. ${syncLoginFallbackHint()}`;
    case "over_request_rate_limit":
      return "Von diesem Gerät kamen gerade zu viele Anmeldeversuche. Warte bitte ein paar Minuten.";
    case "email_address_not_authorized":
      return `An diese Adresse können gerade keine Anmelde-Mails verschickt werden. ${syncLoginFallbackHint()}`;
    case "email_address_invalid":
    case "validation_failed":
      return "Diese E-Mail-Adresse sieht nicht gültig aus. Bitte prüfe sie noch einmal.";
    case "signup_disabled":
    case "otp_disabled":
    case "email_provider_disabled":
      return `Die Anmeldung per E-Mail ist gerade nicht möglich. ${syncLoginFallbackHint()}`;
  }
  if (error.status === 429) return `Gerade gibt es zu viele Anmeldeversuche. ${syncLoginFallbackHint()}`;
  if (!navigator.onLine || !error.status) return "Keine Verbindung zum Sync-Dienst. Prüfe deine Internetverbindung und versuche es noch einmal.";
  return `Das hat gerade nicht geklappt. ${syncLoginFallbackHint()}`;
}

function syncAuthCallbackErrorText({ error, code }) {
  if (code === "otp_expired") return "Dieser Anmelde-Link ist abgelaufen oder wurde schon benutzt. Fordere bitte einen neuen an.";
  if (error === "access_denied") return "Die Anmeldung wurde abgebrochen. Du kannst es jederzeit noch einmal versuchen.";
  return `Die Anmeldung hat nicht geklappt. ${syncLoginFallbackHint()}`;
}

function showSyncLoginError(text) {
  const errorEl = document.getElementById("sync-login-error");
  if (errorEl) { errorEl.textContent = text; errorEl.style.display = "block"; }
}

function hideSyncLoginError() {
  const errorEl = document.getElementById("sync-login-error");
  if (errorEl) errorEl.style.display = "none";
}

function resetSyncLoginSteps() {
  document.getElementById("sync-login-step-email")?.classList.remove("hidden");
  document.getElementById("sync-login-step-sent")?.classList.add("hidden");
  const passwordInput = document.getElementById("sync-login-password");
  if (passwordInput) passwordInput.value = "";
  hideSyncLoginError();
}

const syncLoginModal = wireModal("sync-login-overlay", {
  closeIds: ["sync-login-close", "sync-login-skip", "sync-login-sent-close"],
  onClose: resetSyncLoginSteps,
});

function syncLoginRedirectUrl() {
  return window.location.origin + window.location.pathname;
}

document.getElementById("sync-login-google-btn")?.addEventListener("click", async () => {
  if (!sbClient) return;
  hideSyncLoginError();
  // Bei Erfolg leitet das SDK die Seite zu Google um; zurück in Nook meldet
  // onAuthStateChange in initSync() "SIGNED_IN", wie beim Magic Link.
  const { error } = await sbClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: syncLoginRedirectUrl() },
  });
  if (error) {
    console.error("Sync: Google-Anmeldung fehlgeschlagen", error);
    showSyncLoginError(syncLoginErrorText(error));
  }
});

// E-Mail und Passwort aus dem Formular; zeigt bei fehlenden Angaben einen Hinweis.
function readSyncLoginCredentials() {
  const emailInput = document.getElementById("sync-login-email");
  const passwordInput = document.getElementById("sync-login-password");
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  hideSyncLoginError();
  if (!email) {
    showSyncLoginError("Bitte gib zuerst deine E-Mail-Adresse ein.");
    emailInput.focus();
    return null;
  }
  if (!password) {
    showSyncLoginError("Bitte gib dein Passwort ein.");
    passwordInput.focus();
    return null;
  }
  return { email, password };
}

function setSyncLoginBusy(busy) {
  ["sync-login-submit", "sync-login-signup", "sync-login-send"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = busy;
  });
}

// Bei Erfolg meldet onAuthStateChange in initSync() "SIGNED_IN" und startet
// den Erstabgleich, wie beim Magic Link.
async function submitSyncPasswordLogin() {
  if (!sbClient) return;
  const credentials = readSyncLoginCredentials();
  if (!credentials) return;
  setSyncLoginBusy(true);
  const { error } = await sbClient.auth.signInWithPassword(credentials);
  setSyncLoginBusy(false);
  if (error) {
    console.error("Sync: Anmeldung fehlgeschlagen", error);
    showSyncLoginError(syncLoginErrorText(error));
    return;
  }
  syncLoginModal.close();
}

document.getElementById("sync-login-submit")?.addEventListener("click", submitSyncPasswordLogin);

["sync-login-email", "sync-login-password"].forEach(id => {
  document.getElementById(id)?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitSyncPasswordLogin();
  });
});

document.getElementById("sync-login-signup")?.addEventListener("click", async () => {
  if (!sbClient) return;
  const credentials = readSyncLoginCredentials();
  if (!credentials) return;
  if (credentials.password.length < SYNC_PASSWORD_MIN_LENGTH) {
    showSyncLoginError(`Bitte nimm ein Passwort mit mindestens ${SYNC_PASSWORD_MIN_LENGTH} Zeichen.`);
    return;
  }
  setSyncLoginBusy(true);
  const { data, error } = await sbClient.auth.signUp(credentials);
  setSyncLoginBusy(false);
  if (error) {
    console.error("Sync: Registrierung fehlgeschlagen", error);
    showSyncLoginError(syncLoginErrorText(error));
    return;
  }
  // Ohne Session verlangt Supabase eine Bestätigung per Mail. Eine leere
  // identities-Liste heißt dabei: Die Adresse hat schon ein Konto.
  if (!data.session) {
    showSyncLoginError(data.user?.identities?.length === 0
      ? "Zu dieser E-Mail-Adresse gibt es schon ein Konto. Klicke auf „Anmelden“."
      : "Dein Konto ist angelegt, muss aber erst per E-Mail bestätigt werden. Schau bitte in dein Postfach.");
    return;
  }
  syncLoginModal.close();
});

document.getElementById("sync-login-send")?.addEventListener("click", async (e) => {
  if (!sbClient) return;
  const emailInput = document.getElementById("sync-login-email");
  const email = emailInput.value.trim();
  hideSyncLoginError();
  if (!email) {
    showSyncLoginError("Bitte gib zuerst deine E-Mail-Adresse ein.");
    emailInput.focus();
    return;
  }

  const btn = e.currentTarget;
  btn.disabled = true;
  const idleLabel = btn.textContent;
  btn.textContent = "Wird gesendet …";
  const { error } = await sbClient.auth.signInWithOtp({ email, options: { emailRedirectTo: syncLoginRedirectUrl() } });
  btn.disabled = false;
  btn.textContent = idleLabel;
  if (error) {
    console.error("Sync: Anmelde-Link fehlgeschlagen", error);
    showSyncLoginError(syncLoginErrorText(error));
    return;
  }
  document.getElementById("sync-login-sent-email").textContent = email;
  document.getElementById("sync-login-step-email").classList.add("hidden");
  document.getElementById("sync-login-step-sent").classList.remove("hidden");
});

document.getElementById("sync-status-btn")?.addEventListener("click", async () => {
  if (!sbClient) return;
  if (currentUserId) {
    const confirmed = await hubConfirm({
      title: "Abmelden",
      message: "Wirklich abmelden? Deine Daten bleiben in der Cloud gespeichert — dieses Gerät synchronisiert danach nicht mehr automatisch.",
      confirmText: "Abmelden",
      danger: true,
    });
    if (!confirmed) return;
    await sbClient.auth.signOut();
  } else {
    resetSyncLoginSteps();
    syncLoginModal.open();
  }
});

// ── Passwort festlegen oder ändern (angemeldet) ──────────────────────
function showSyncPasswordError(text) {
  const errorEl = document.getElementById("sync-password-error");
  if (errorEl) { errorEl.textContent = text; errorEl.style.display = text ? "block" : "none"; }
}

function resetSyncPasswordForm() {
  document.getElementById("sync-password-new").value = "";
  document.getElementById("sync-password-repeat").value = "";
  showSyncPasswordError("");
}

const syncPasswordModal = wireModal("sync-password-overlay", {
  closeIds: ["sync-password-close", "sync-password-cancel"],
  onClose: resetSyncPasswordForm,
});

document.getElementById("sync-password-btn")?.addEventListener("click", () => {
  resetSyncPasswordForm();
  syncPasswordModal.open();
});

document.getElementById("sync-password-save")?.addEventListener("click", async (e) => {
  if (!sbClient) return;
  const password = document.getElementById("sync-password-new").value;
  showSyncPasswordError("");
  if (password.length < SYNC_PASSWORD_MIN_LENGTH) {
    showSyncPasswordError(`Bitte nimm ein Passwort mit mindestens ${SYNC_PASSWORD_MIN_LENGTH} Zeichen.`);
    return;
  }
  if (password !== document.getElementById("sync-password-repeat").value) {
    showSyncPasswordError("Die beiden Eingaben stimmen nicht überein.");
    return;
  }
  const btn = e.currentTarget;
  btn.disabled = true;
  const { error } = await sbClient.auth.updateUser({ password });
  btn.disabled = false;
  if (error) {
    console.error("Sync: Passwort konnte nicht gespeichert werden", error);
    showSyncPasswordError(syncLoginErrorText(error));
    return;
  }
  syncPasswordModal.close();
  document.getElementById("sync-status-sub").textContent += " · Passwort gespeichert";
});

document.getElementById("sync-update-reload-btn")?.addEventListener("click", () => location.reload());

// ── Start ────────────────────────────────────────────────────────────
async function initSync() {
  if (!sbClient) {
    console.warn("Sync: Supabase-SDK nicht geladen (offline/blockiert?) — Nook läuft rein lokal weiter.");
    const sub = document.getElementById("sync-status-sub");
    if (sub) sub.textContent = "Geräte-Sync ist gerade nicht erreichbar — Daten bleiben nur auf diesem Gerät";
    document.getElementById("sync-status-btn")?.classList.add("hidden");
    return;
  }

  const googleCheck = detectSyncGoogleLogin();
  const { data: { session } } = await sbClient.auth.getSession();
  currentUserId = session?.user?.id || null;
  updateSyncStatusUI(session);
  if (session) {
    catchUpSync(session.user.id);
    subscribeRealtime(session.user.id);
  } else if (syncAuthCallbackError) {
    await googleCheck; // Der Text verweist nur auf Google, wenn es verfügbar ist.
    resetSyncLoginSteps();
    showSyncLoginError(syncAuthCallbackErrorText(syncAuthCallbackError));
    syncLoginModal.open();
  }

  sbClient.auth.onAuthStateChange(async (event, newSession) => {
    updateSyncStatusUI(newSession);
    currentUserId = newSession?.user?.id || null;
    if (event === "SIGNED_IN" && newSession) {
      subscribeRealtime(newSession.user.id);
      // WICHTIG: onAuthStateChange feuert "SIGNED_IN" nicht nur bei einer
      // frischen Anmeldung, sondern auch, wenn beim normalen Seitenaufruf
      // eine bereits bestehende Session wiederhergestellt wird. Ohne diese
      // Sperre würde runInitialMerge() (endet mit location.reload()) bei
      // JEDEM Laden erneut laufen — Endlosschleife. Der Flag wird VOR dem
      // Merge gesetzt, damit er auch bei rasch aufeinanderfolgenden Events
      // sicher nur einmal pro Gerät/Anmeldung greift; signOut() setzt ihn
      // zurück, damit eine erneute Anmeldung wieder frisch abgleicht.
      if (localStorage.getItem(INITIAL_MERGE_DONE_KEY) !== newSession.user.id) {
        localStorage.setItem(INITIAL_MERGE_DONE_KEY, newSession.user.id);
        await runInitialMerge(newSession.user.id);
      }
    } else if (event === "SIGNED_OUT") {
      localStorage.removeItem(INITIAL_MERGE_DONE_KEY);
      unsubscribeRealtime();
    }
  });
}

initSync();
