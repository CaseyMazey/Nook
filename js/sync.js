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

// Keys, die nie über die generische DB-Sync-Logik laufen dürfen: unsere
// eigene Buchhaltung sowie Supabase's eigener Session-Speicher (sb-...).
function isSyncableKey(key) {
  return key !== SYNC_META_KEY && key !== INITIAL_MERGE_DONE_KEY && !key.startsWith("sb-");
}

async function pushToSupabase(userId, key, val, ts) {
  if (!sbClient || !userId) return;
  const { error } = await sbClient.from(SYNC_TABLE).upsert(
    { user_id: userId, key, value: val, updated_at: new Date(ts).toISOString() },
    { onConflict: "user_id,key" }
  );
  if (error) console.error("Sync: Push fehlgeschlagen für", key, error);
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
        if (!row) return;
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
  setSyncMeta(meta);

  if (toPush.length) {
    const { error: pushError } = await sbClient.from(SYNC_TABLE).upsert(toPush, { onConflict: "user_id,key" });
    if (pushError) console.error("Sync: Erst-Upload fehlgeschlagen", pushError);
  }
  location.reload();
}

// ── Login-Modal ──────────────────────────────────────────────────────
function resetSyncLoginSteps() {
  document.getElementById("sync-login-step-email")?.classList.remove("hidden");
  document.getElementById("sync-login-step-sent")?.classList.add("hidden");
  const err = document.getElementById("sync-login-error");
  if (err) err.style.display = "none";
}

const syncLoginModal = wireModal("sync-login-overlay", {
  closeIds: ["sync-login-close", "sync-login-skip", "sync-login-sent-close"],
  onClose: resetSyncLoginSteps,
});

document.getElementById("sync-login-send")?.addEventListener("click", async () => {
  if (!sbClient) return;
  const emailInput = document.getElementById("sync-login-email");
  const email = emailInput.value.trim();
  const errorEl = document.getElementById("sync-login-error");
  if (!email) return;

  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await sbClient.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) {
    if (errorEl) { errorEl.textContent = "Senden fehlgeschlagen: " + error.message; errorEl.style.display = "block"; }
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

document.getElementById("sync-update-reload-btn")?.addEventListener("click", () => location.reload());

// ── Start ────────────────────────────────────────────────────────────
async function initSync() {
  if (!sbClient) {
    console.warn("Sync: Supabase-SDK nicht geladen (offline/blockiert?) — Nook läuft rein lokal weiter.");
    return;
  }

  const { data: { session } } = await sbClient.auth.getSession();
  currentUserId = session?.user?.id || null;
  updateSyncStatusUI(session);
  if (session) {
    catchUpSync(session.user.id);
    subscribeRealtime(session.user.id);
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
