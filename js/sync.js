// =========================
// SYNC — Geräte-übergreifender Datenabgleich über Supabase
// Lädt direkt nach hub-utils.js (braucht wireModal()/hubConfirm()), vor
// allen Tab-Dateien, und nach sync-crypto.js + sync-engine.js (stellen
// createSyncEngine() und die Krypto-Funktionen als Globals bereit). Kennt
// keine einzelne Tab-Bedeutung — arbeitet ausschließlich über den zentralen
// DB-Wrapper (main.js), der die EINZIGE Persistenz-Schnittstelle im
// gesamten Projekt ist (einzige, begründete Ausnahme: die IndexedDB-
// Schlüsselablage weiter unten).
//
// Architektur ("local-first", Ende-zu-Ende-verschlüsselt):
//   - DB.get() bleibt unverändert synchron, liest weiterhin sofort aus
//     localStorage — keine Wartezeit auf Netzwerk beim Rendern, App bleibt
//     offline voll nutzbar. Alle ~180 bestehenden Aufrufstellen bleiben
//     unangetastet.
//   - DB.set() wird HIER additiv erweitert: schreibt weiterhin sofort
//     synchron nach localStorage (unverändertes Verhalten), setzt den
//     lokalen Zeitstempel und meldet den Wert danach an die Sync-Engine
//     (js/sync-engine.js). Die Engine verschlüsselt und lädt im Hintergrund
//     hoch — aber NUR im Zustand "unlocked" und nur als Chiffretext. In
//     keinem Zustand verlässt Klartext das Gerät.
//   - Jeder DB-Key bekommt einen lokalen Zeitstempel (SYNC_META_KEY), der
//     bei Konflikten entscheidet: "last write wins" pro Key, kein Merge
//     auf Feldebene.
//   - Ohne Anmeldung verhält sich Nook exakt wie bisher — Sync ist rein
//     additiv/optional, kein Login-Zwang.
//   - Zustände, Abgleich, Erstabgleich, Migration und Schlüsselverwaltung
//     liegen in der Engine; diese Datei liefert ihr nur Speicher, Client und
//     Schlüsselablage und verdrahtet Anmeldung, Realtime und Statuszeile.
//     Spec: docs/superpowers/specs/2026-11-02-sync-e2ee-design.md
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
// Speichert die user_id, für die der Erstabgleich (initialMerge) auf
// diesem Gerät bereits gelaufen ist — verhindert, dass die bei jedem
// Seitenaufruf wiederkehrende "SIGNED_IN"-Session-Wiederherstellung den
// Merge (und den abschließenden Reload) erneut auslöst.
const INITIAL_MERGE_DONE_KEY = "__nook_sync_initial_merge_done__";
// Merker der Engine, je als Map { userId: Wert }: letzter vollständiger
// Abgleich (Zeitpunkt), Bestätigungsstand pro Key, klebriger Migrationsmerker.
const SYNC_LAST_CATCHUP_KEY = "__nook_sync_last_catchup__";
const SYNC_CONFIRMED_KEY = "__nook_sync_confirmed__";
const SYNC_MIGRATION_DONE_KEY = "__nook_sync_migration_done__";

// Fehlt sync-config.js (z.B. frischer Fork ohne eigenes Supabase-Projekt),
// ist SUPABASE_URL schlicht nicht definiert — Nook läuft dann bewusst
// fehlerfrei rein lokal weiter, statt mit einer kaputten Konfiguration
// zu crashen.
const sbClient = (typeof window.supabase !== "undefined" && typeof SUPABASE_URL !== "undefined")
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ── Original-DB.set() vor der Erweiterung sichern ──────────────────────
// _dbSetRaw schreibt NUR lokal, ohne erneut zu melden — für Sync-interne
// Schreibvorgänge (eingehende Remote-Werte), die sonst eine Endlosschleife
// aus Upload→Echo→Upload auslösen würden.
const _dbSetRaw = DB.set;

function getSyncMeta() {
  try { return JSON.parse(localStorage.getItem(SYNC_META_KEY)) || {}; }
  catch { return {}; }
}
function setSyncMeta(meta) {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

// Interne Keys, die weder synchronisiert noch ins Backup gehören: unsere
// eigene Buchhaltung (alles mit "__nook_sync_": Zeitstempel, Erstabgleich-
// Merker, Keyring "__nook_sync_keyring__", letzter Abgleich, Bestätigungs-
// stand, Migrationsmerker) sowie Supabase's eigener Session-Speicher (sb-...,
// enthält Access-/Refresh-Token — gehört niemals in eine Datei oder auf
// ein anderes Gerät). Wird auch vom Backup in settings.js benutzt.
function isSyncInternalKey(key) {
  return key.startsWith("__nook_sync_") || key.startsWith("sb-");
}

// Reine Geräte-Zustände bzw. Caches, die lokal bleiben: der Wetter-Cache
// (enthält bei GPS den Standort), Akkordeon-/Layout-Zustände dieses Geräts.
// Würden sonst bei jedem Seitenaufruf bzw. Klick einen Upload auslösen.
// lastOpenProjectDetailId: welche Projektansicht DIESES Gerät zuletzt offen
// hatte — synchronisiert öffnete sonst z.B. der PC die Detailseite, die am
// Handy offen geblieben war, obwohl am PC zuletzt die Übersicht offen war.
const SYNC_LOCAL_ONLY_KEYS = [
  "weatherData", "currentDate", "tabVisibilityOpen", "googleCalSettingsOpen",
  "sidebarCollapsed", "settingsCollapsedGroups", "lastOpenProjectDetailId",
];

// Keys, die nie über die generische DB-Sync-Logik laufen dürfen.
function isSyncableKey(key) {
  return !isSyncInternalKey(key) && !SYNC_LOCAL_ONLY_KEYS.includes(key);
}

// ── Speicher-Adapter für die Engine (localStorage + _dbSetRaw) ──────────
// Map { userId: Wert } aus einem internen Key; unlesbar zählt als leer.
function readSyncAccountMap(storageKey) {
  const map = DB.get(storageKey, {});
  return map && typeof map === "object" && !Array.isArray(map) ? map : {};
}
// Wirft, wenn nicht gespeichert werden konnte — die Engine wertet das aus
// (z.B. "Merker des Kontos nicht gelöscht").
function writeSyncAccountMap(storageKey, map) {
  if (_dbSetRaw(storageKey, map) !== true) throw new Error(`Sync: ${storageKey} nicht speicherbar`);
}
function setSyncAccountValue(storageKey, userId, value) {
  const map = readSyncAccountMap(storageKey);
  map[userId] = value;
  writeSyncAccountMap(storageKey, map);
}

const syncStorage = {
  // null = nicht vorhanden; nicht lesbares JSON wirft (die Engine behandelt
  // das als "nicht vorhanden" und überschreibt den Eintrag nie blind).
  getRaw(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  },
  setRaw(key, val) { return _dbSetRaw(key, val); },
  getMeta: getSyncMeta,
  setMeta: setSyncMeta,
  keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) out.push(k);
    }
    return out;
  },
  getLastCatchUp(userId) {
    const ts = readSyncAccountMap(SYNC_LAST_CATCHUP_KEY)[userId];
    return typeof ts === "number" ? ts : 0;
  },
  setLastCatchUp(userId, ts) { setSyncAccountValue(SYNC_LAST_CATCHUP_KEY, userId, ts); },
  getConfirmed(userId) {
    const m = readSyncAccountMap(SYNC_CONFIRMED_KEY)[userId];
    return m && typeof m === "object" ? m : {};
  },
  setConfirmed(userId, map) { setSyncAccountValue(SYNC_CONFIRMED_KEY, userId, map); },
  getMigrationDone(userId) { return readSyncAccountMap(SYNC_MIGRATION_DONE_KEY)[userId] === true; },
  setMigrationDone(userId) { setSyncAccountValue(SYNC_MIGRATION_DONE_KEY, userId, true); },
  // Migrationsmerker, Bestätigungsstand und letzten Abgleich eines Kontos löschen.
  clearAccount(userId) {
    [SYNC_LAST_CATCHUP_KEY, SYNC_CONFIRMED_KEY, SYNC_MIGRATION_DONE_KEY].forEach((storageKey) => {
      const map = readSyncAccountMap(storageKey);
      if (!(userId in map)) return;
      delete map[userId];
      writeSyncAccountMap(storageKey, map);
    });
  },
};

// ── Schlüsselablage in IndexedDB ────────────────────────────────────────
// BEWUSSTE AUSNAHME vom DB-Wrapper (siehe Spec "Gerätespeicher"): Der
// Datenschlüssel liegt als nicht exportierbarer CryptoKey vor. Den kann
// man weder als JSON serialisieren noch in localStorage ablegen — er lässt
// sich nur per Structured Clone in IndexedDB speichern, ohne dass das Skript
// je an die Schlüssel-Bytes kommt. Datenbank "nook-sync-keys", Store
// "keys", Schlüssel = userId, Wert { key: CryptoKey, keyId }.
// Fehlt IndexedDB oder lässt es sich nicht öffnen (z.B. privater Modus),
// endet die Engine im Zustand "unavailable".
const SYNC_KEY_DB_NAME = "nook-sync-keys";
const SYNC_KEY_STORE_NAME = "keys";
let syncKeyDbPromise = null;

function openSyncKeyDb() {
  if (!syncKeyDbPromise) {
    syncKeyDbPromise = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(SYNC_KEY_DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SYNC_KEY_STORE_NAME)) db.createObjectStore(SYNC_KEY_STORE_NAME);
      };
      req.onsuccess = () => {
        const db = req.result;
        // Andere Tabs dürfen die Datenbank aktualisieren/löschen; danach neu öffnen.
        db.onversionchange = () => { db.close(); syncKeyDbPromise = null; };
        db.onclose = () => { syncKeyDbPromise = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error("IndexedDB nicht zu öffnen"));
    });
    // Fehlgeschlagenes Öffnen nicht festhalten — der nächste Start versucht es erneut.
    syncKeyDbPromise.catch(() => { syncKeyDbPromise = null; });
  }
  return syncKeyDbPromise;
}

function syncKeyStoreRequest(mode, makeRequest) {
  return openSyncKeyDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_KEY_STORE_NAME, mode);
    const req = makeRequest(tx.objectStore(SYNC_KEY_STORE_NAME));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error || req.error || new Error("IndexedDB-Fehler"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB-Transaktion abgebrochen"));
  }));
}

const syncKeyStore = (typeof indexedDB !== "undefined" && indexedDB) ? {
  async load(userId) {
    const v = await syncKeyStoreRequest("readonly", (s) => s.get(userId));
    return v || null;
  },
  save(userId, key, keyId) {
    return syncKeyStoreRequest("readwrite", (s) => s.put({ key, keyId }, userId)).then(() => undefined);
  },
  remove(userId) {
    return syncKeyStoreRequest("readwrite", (s) => s.delete(userId)).then(() => undefined);
  },
} : null; // ohne IndexedDB: Engine meldet "unavailable"

// ── Status-Texte der Verschlüsselung (Statuszeile und Zeile "Verschlüsselung") ──
const SYNC_STATE_TEXTS = {
  unconfigured: "Sync pausiert: Verschlüsselung einrichten",
  locked: "Sync pausiert: Passwort eingeben",
  unlocked: "Ende-zu-Ende-verschlüsselt",
  unknown: "Verschlüsselung gerade nicht prüfbar. Sync pausiert.",
  unavailable: "In dieser Umgebung nicht verfügbar. Sync pausiert.",
};
const SYNC_CHECKING_TEXT = "Verschlüsselung wird geprüft …";
// true, solange syncEngine.start() läuft: "unknown" heißt dann noch "wird geprüft".
let syncCryptoChecking = false;
// Kurzer Zusatz nach einer Aktion (z.B. "Passwort geändert"), bis sich der Zustand ändert.
let syncCryptoSubExtra = "";
// true, solange im Verschlüsselungs-Modal eine Aktion läuft (Modal nicht schließbar).
let syncCryptoBusy = false;
// Hinweise der Engine, nur als Anzahl betroffener Keys angezeigt (die Key-Namen
// bleiben im Speicher dieser Seite, nie ein Wert). Bis zum Ausblenden/Abmelden.
const syncCryptoNotices = { decrypt_failed: new Set(), plaintext_row: new Set() };

// ── Sync-Engine ─────────────────────────────────────────────────────────
// Nur mit Supabase-Client; ohne bleibt alles exakt wie bisher (rein lokal).
const syncEngine = (sbClient && typeof createSyncEngine === "function")
  ? createSyncEngine({
      client: sbClient,
      table: SYNC_TABLE,
      storage: syncStorage,
      keyStore: syncKeyStore,
      isSyncableKey,
      onStateChange: (next) => { syncCryptoSubExtra = ""; renderSyncStatusSub(); syncLockedHintOnState(next); },
      // Nur Code und Key, nie ein Wert.
      onNotice: (code, info) => {
        console.warn("Sync: Hinweis", code, typeof info === "string" ? info : "");
        addSyncCryptoNotice(code, info);
      },
    })
  : null;

// Aktueller Verschlüsselungs-Zustand für die Oberfläche (Task 7). null: kein
// Sync in dieser Version (kein Supabase-Client).
function syncCryptoState() {
  return syncEngine ? syncEngine.state : null;
}

// Laufende Uploads abwarten — damit z.B. der Backup-Import vor seinem
// Reload warten kann, bis alles in der Cloud angekommen ist (ein Reload
// bricht offene Requests sonst ab). Wartet auch auf Verschlüsselung und
// die Warteschlange der Engine.
function syncFlushPending() {
  return syncEngine ? syncEngine.flush() : Promise.resolve();
}

// Entfernt Keys lokal UND in der Cloud (z.B. "Daten eines Tabs
// zurücksetzen" in settings.js) — ohne den Remote-Löschschritt kämen die
// Daten beim nächsten Erstabgleich eines Geräts wieder zurück.
async function syncRemoveKeys(keys) {
  const meta = getSyncMeta();
  keys.forEach((k) => { localStorage.removeItem(k); delete meta[k]; });
  setSyncMeta(meta);
  const userId = currentUserId;
  const removeRemote = async () => {
    if (syncEngine) {
      // Wartende Uploads verwerfen und laufende abwarten: ein Upload, der schon
      // unterwegs ist, darf den Key nach dem Löschen nicht wiederbeleben.
      syncEngine.dropPending(keys);
      await syncEngine.flush();
    }
    if (!sbClient || !userId || !keys.length) return;
    const { error } = await sbClient.from(SYNC_TABLE).delete().eq("user_id", userId).in("key", keys);
    if (error) console.error("Sync: Löschen fehlgeschlagen", error);
  };
  if (!syncEngine) return removeRemote();
  // Sofort verwerfen (kein wartender Upload startet mehr), das Löschen selbst
  // aber in die Kette einreihen: eine gerade laufende Migration bzw. ein
  // Erstabgleich hat die Keys evtl. schon eingesammelt und lädt sie sonst
  // NACH dem Löschen wieder hoch.
  syncEngine.dropPending(keys);
  return syncSerial(removeRemote).catch(() => {});
}

// ── DB.set() additiv erweitern ──────────────────────────────────────────
DB.set = function (key, val) {
  const ok = _dbSetRaw(key, val); // Erfolg/Fehlschlag des lokalen Speicherns durchreichen
  if (!isSyncableKey(key)) return ok;
  const now = Date.now();
  const meta = getSyncMeta();
  meta[key] = now;
  setSyncMeta(meta);
  if (syncEngine && currentUserId) {
    // Synchron serialisieren: Aufrufer dürfen das Objekt danach weiter ändern.
    let json;
    try { json = JSON.stringify(val); } catch { json = undefined; }
    if (typeof json === "string") syncEngine.notifyLocalWrite(key, json, now);
  }
  return ok;
};

// ── Auth-Status & UI ─────────────────────────────────────────────────
let currentUserId = null;
let realtimeChannel = null;
let realtimeUserId = null;
let syncSessionEmail = null;
// user_id, für die die Engine gestartet wurde (bzw. gerade startet) —
// verhindert doppelte Starts durch getSession() + wiederholte SIGNED_IN.
let syncStartedFor = null;

// Text zum aktuellen Zustand der Verschlüsselung; null ohne Engine.
function syncCryptoStateText() {
  if (!syncEngine) return null;
  const state = syncEngine.state;
  if (state === "signedOut" || (state === "unknown" && syncCryptoChecking)) return SYNC_CHECKING_TEXT;
  return SYNC_STATE_TEXTS[state] || null;
}

// Statuszeile: "Angemeldet als x" plus Zustand der Verschlüsselung. Hält auch
// die Zeile "Verschlüsselung" aktuell (läuft bei jeder Zustandsänderung).
function renderSyncStatusSub() {
  renderSyncCryptoRow();
  const sub = document.getElementById("sync-status-sub");
  if (!sub || !syncSessionEmail) return;
  const stateText = syncCryptoStateText();
  sub.textContent = `Angemeldet als ${syncSessionEmail}` + (stateText ? ` · ${stateText}` : "");
}

// ── Zeile "Verschlüsselung" in den Einstellungen ────────────────────
const SYNC_CRYPTO_BUTTON_LABELS = { unconfigured: "Einrichten", locked: "Entsperren", unlocked: "Passwort ändern" };

function renderSyncCryptoRow() {
  const row = document.getElementById("sync-crypto-row");
  if (!row) return;
  const visible = !!(syncEngine && syncSessionEmail);
  row.classList.toggle("hidden", !visible);
  if (!visible) return;
  const state = syncEngine.state;
  const stateText = syncCryptoStateText();
  const sub = document.getElementById("sync-crypto-sub");
  if (sub) sub.textContent = (stateText || "") + (syncCryptoSubExtra ? ` · ${syncCryptoSubExtra}` : "");
  const btn = document.getElementById("sync-crypto-btn");
  if (btn) {
    const label = SYNC_CRYPTO_BUTTON_LABELS[state];
    btn.classList.toggle("hidden", !label);
    if (label) btn.textContent = label;
  }
  renderSyncCryptoNotice();
}

function addSyncCryptoNotice(code, info) {
  const set = syncCryptoNotices[code];
  if (!set) return;
  set.add(typeof info === "string" ? info : `#${set.size}`);
  renderSyncCryptoNotice();
}

function clearSyncCryptoNotices() {
  Object.values(syncCryptoNotices).forEach((set) => set.clear());
  renderSyncCryptoNotice();
}

// Nur Anzahlen, keine Key-Namen oder Werte.
function syncCryptoNoticeText() {
  const parts = [];
  const bad = syncCryptoNotices.decrypt_failed.size;
  if (bad) {
    parts.push((bad === 1 ? "1 Eintrag aus der Cloud ließ" : `${bad} Einträge aus der Cloud ließen`)
      + " sich nicht entschlüsseln. Auf diesem Gerät bleibt der bisherige Stand erhalten.");
  }
  const plain = syncCryptoNotices.plaintext_row.size;
  if (plain) {
    parts.push((plain === 1 ? "1 unverschlüsselter Eintrag" : `${plain} unverschlüsselte Einträge`)
      + " von einer älteren Nook-Version wurde" + (plain === 1 ? "" : "n")
      + " nicht übernommen. Bring bitte alle Geräte auf die neueste Version.");
  }
  return parts.join(" ");
}

function renderSyncCryptoNotice() {
  const box = document.getElementById("sync-crypto-notice");
  if (!box) return;
  const text = syncCryptoNoticeText();
  document.getElementById("sync-crypto-notice-text").textContent = text;
  box.classList.toggle("hidden", !text || !syncSessionEmail);
}

function updateSyncStatusUI(session) {
  const sub = document.getElementById("sync-status-sub");
  const btn = document.getElementById("sync-status-btn");
  if (!sub || !btn) return;
  if (session) {
    syncSessionEmail = session.user.email;
    renderSyncStatusSub();
    btn.textContent = "Abmelden";
  } else {
    syncSessionEmail = null;
    sub.textContent = "Nicht angemeldet — Daten bleiben nur auf diesem Gerät";
    btn.textContent = "Anmelden";
    syncCryptoSubExtra = "";
    clearSyncCryptoNotices();
    // Abgemeldet: das Verschlüsselungs-Modal passt nicht mehr (läuft gerade
    // eine Aktion, meldet sie selbst den Fehler).
    if (!syncCryptoBusy) syncCryptoModal.close();
  }
  document.getElementById("sync-password-row")?.classList.toggle("hidden", !session);
  renderSyncCryptoRow();
}

function showUpdateBanner() {
  document.getElementById("sync-update-banner")?.classList.remove("hidden");
}

// ── Einmaliger Hinweis auf einem gesperrten Gerät ───────────────────────
// Spec "Weiteres Gerät", Schritt 1: wird das Gerät nach dem Start gesperrt
// (Keyring in der Cloud, kein Schlüssel hier), erscheint einmal pro
// Browser-Sitzung ein schwebender Hinweis mit "Entsperren". Verlässt das
// Gerät den Zustand, verschwindet er wieder.
const SYNC_LOCKED_HINT_KEY = "__nook_sync_locked_hint_shown__"; // sessionStorage
function syncLockedHintShown() {
  try { return sessionStorage.getItem(SYNC_LOCKED_HINT_KEY) === "1"; } catch { return false; }
}
function markSyncLockedHintShown() {
  try { sessionStorage.setItem(SYNC_LOCKED_HINT_KEY, "1"); } catch { /* ohne Speicher: nur für diese Seite */ }
}
function hideSyncLockedHint() {
  document.getElementById("sync-locked-banner")?.classList.add("hidden");
}
function syncLockedHintOnState(state) {
  if (state !== "locked") { hideSyncLockedHint(); return; }
  if (syncLockedHintShown()) return;
  const banner = document.getElementById("sync-locked-banner");
  if (!banner) return;
  markSyncLockedHintShown();
  banner.classList.remove("hidden");
}

// ── Ablauf nach Start/Entsperren ────────────────────────────────────────
// Alle Starts, Erstabgleiche und Abgleiche laufen nacheinander über eine
// einzige Promise-Kette: initialMerge läuft so nie, während start() (das
// eine abgebrochene Migration fortsetzt und abwartet) noch läuft. Die
// Oberfläche (Task 7) führt finishSetup, unlock, recover, resetCloud und
// changePassword ebenfalls über syncSerial(...) aus — sonst könnte z.B. das
// Realtime-Echo der eigenen Keyring-Zeile mitten in finishSetup() ein start()
// auslösen. syncAfterUnlock() (reiht selbst eine Aufgabe ein) wird NACH einer
// solchen syncSerial-Aufgabe aufgerufen, nie innerhalb einer awaited —
// die innere Aufgabe wartete sonst auf das Ende der äußeren: Deadlock.
// Ebenso nie syncRemoveKeys() innerhalb einer Aufgabe awaiten.
// Liefert das Ergebnis der Aufgabe; Fehler werden geloggt, die Kette läuft weiter.
let syncChain = Promise.resolve();
function syncSerial(task) {
  const run = syncChain.then(() => task());
  syncChain = run.catch((e) => console.error("Sync: Abgleich fehlgeschlagen", e));
  return run;
}

// Nicht-blockierend: die App ist längst mit dem lokalen Stand gerendert.
// Erstabgleich nur entsperrt und nur einmal pro Gerät/Anmeldung; danach
// vollständiger Reload — die vielen tab-eigenen `let`-Zustände (z.B. `tasks`
// in main.js) werden nur beim Skript-Load aus DB.get() befüllt (gleiches
// Muster wie beim Backup-Import in settings.js). Der Merker wird erst nach
// einem erfolgreichen Erstabgleich gesetzt, sonst ginge er verloren.
// Scheitert der Erstabgleich, kann er trotzdem schon Cloud-Werte nach
// localStorage geschrieben haben — die Tabs hielten dann veraltete Stände im
// Speicher und überschrieben die Cloud-Werte beim nächsten Speichern mit
// neuerem Zeitstempel. Deshalb auch dann einmal neu laden; ein Merker in
// sessionStorage (pro Konto) verhindert eine Reload-Schleife: ist er gesetzt,
// läuft in dieser Sitzung statt des Erstabgleichs der normale Abgleich, damit
// ein Gerät, dessen Erstabgleich immer wieder scheitert (z.B. an einer nicht
// entschlüsselbaren Zeile), trotzdem Änderungen herunterlädt.
// Sonst laufender Abgleich: neuere Cloud-Werte übernehmen, NICHT automatisch
// neu laden (könnte mitten in einer Eingabe stören), sondern den Hinweis-
// Banner mit Klick-zum-Neuladen zeigen.
const SYNC_MERGE_RELOADED_KEY = "__nook_sync_merge_reloaded__"; // sessionStorage, Map { userId: true }

function syncMergeReloaded(userId) {
  try { return (JSON.parse(sessionStorage.getItem(SYNC_MERGE_RELOADED_KEY)) || {})[userId] === true; }
  catch { return false; }
}
// true, wenn der Merker sicher gespeichert ist (sonst kein Reload: Schleifengefahr).
function setSyncMergeReloaded(userId, on) {
  try {
    const map = JSON.parse(sessionStorage.getItem(SYNC_MERGE_RELOADED_KEY)) || {};
    if (on) map[userId] = true; else delete map[userId];
    sessionStorage.setItem(SYNC_MERGE_RELOADED_KEY, JSON.stringify(map));
    return true;
  } catch { return false; }
}

async function syncAfterStart(userId) {
  if (!syncEngine || syncEngine.userId !== userId || currentUserId !== userId) return;
  const state = syncEngine.state;
  if (state === "unlocked" && localStorage.getItem(INITIAL_MERGE_DONE_KEY) !== userId && !syncMergeReloaded(userId)) {
    const res = await syncEngine.initialMerge();
    if (syncEngine.userId !== userId || currentUserId !== userId) return;
    if (res && res.ok) {
      localStorage.setItem(INITIAL_MERGE_DONE_KEY, userId);
      setSyncMergeReloaded(userId, false);
      location.reload();
      return;
    }
    console.error("Sync: Erstabgleich fehlgeschlagen");
    if (setSyncMergeReloaded(userId, true)) { location.reload(); return; }
    // Merker nicht speicherbar: nicht neu laden, sondern normal abgleichen und
    // den Banner zeigen (evtl. schon geschriebene Cloud-Werte).
    showUpdateBanner();
  }
  if (syncEngine.state === "unlocked" || syncEngine.state === "unconfigured") {
    const { changed } = await syncEngine.catchUp();
    if (changed) showUpdateBanner();
  }
}

async function syncStartAndCatchUp(userId) {
  if (!syncEngine || currentUserId !== userId) return; // inzwischen abgemeldet
  syncCryptoChecking = true;
  try {
    await syncEngine.start(userId);
  } finally {
    syncCryptoChecking = false;
    renderSyncStatusSub();
  }
  await syncAfterStart(userId);
}

// Für die Oberfläche (Task 7): nach Entsperren/Einrichten denselben Ablauf
// (Erstabgleich bzw. Abgleich) anstoßen, eingereiht in die Kette.
function syncAfterUnlock() {
  const userId = currentUserId;
  if (!syncEngine || !userId) return Promise.resolve();
  return syncSerial(() => syncAfterStart(userId)).catch(() => {});
}

function syncHandleSession(session) {
  const userId = session.user.id;
  subscribeRealtime(userId);
  if (!syncEngine || syncStartedFor === userId) return;
  if (syncStartedFor) syncSignOutAccount(syncStartedFor); // Kontowechsel ohne SIGNED_OUT
  syncStartedFor = userId;
  syncSerial(() => syncStartAndCatchUp(userId)).catch(() => {});
}

// Verschlüsselung für ein Konto abmelden: Engine anhalten (sofort, alle
// laufenden Aufgaben veralten) und den Schlüssel des Kontos aus IndexedDB
// löschen. Lokale Daten bleiben liegen.
function syncSignOutAccount(oldUserId) {
  localStorage.removeItem(INITIAL_MERGE_DONE_KEY);
  setSyncMergeReloaded(oldUserId, false);
  const engineUserId = syncEngine.userId;
  syncEngine.signOut().catch((e) => console.error("Sync: Abmelden der Verschlüsselung fehlgeschlagen", e && e.code));
  // Lief start() für dieses Konto noch gar nicht, kennt die Engine es nicht.
  if (engineUserId !== oldUserId && syncKeyStore) {
    syncKeyStore.remove(oldUserId).catch((e) => console.error("Sync: Schlüssel konnte nicht entfernt werden", e && e.name));
  }
}

// Keyring-Zeile geändert oder gelöscht: Zustand neu bestimmen, danach wie
// beim Start abgleichen. Ausnahme: entsperrt und die Zeile trägt weiter die
// keyId des Geräteschlüssels (Passwortwechsel anderswo, migrationDone,
// Echo der eigenen Änderung) — dann ändert sich am Zustand nichts.
function syncKeyringChanged(userId, row) {
  syncSerial(async () => {
    if (!syncEngine || currentUserId !== userId) return;
    const keyId = row && row.value && typeof row.value === "object" ? row.value.keyId : null;
    if (keyId && syncKeyStore && syncEngine.state === "unlocked" && syncEngine.userId === userId) {
      let stored = null;
      try { stored = await syncKeyStore.load(userId); } catch { stored = null; }
      if (stored && stored.keyId === keyId) {
        // Kein Neustart nötig; der Abgleich frischt Keyring und
        // Migrationsmerker der Engine im Speicher auf.
        const { changed } = await syncEngine.catchUp();
        if (changed) showUpdateBanner();
        return;
      }
    }
    await syncStartAndCatchUp(userId);
  }).catch(() => {});
}

// Fehlende Realtime-Ereignisse nachholen (DELETE-Ereignisse kommen mit Filter
// u.U. gar nicht an; offline verpasste Änderungen sowieso nicht): beim
// Zurückkehren in den Tab und beim Wiederverbinden abgleichen, höchstens
// alle 30 Sekunden. "unknown" (Keyring beim Start nicht lesbar, z.B. offline)
// bestimmt den Zustand neu; catchUp erkennt einen verschwundenen oder
// ausgetauschten Keyring selbst und startet dann neu.
const SYNC_RESUME_THROTTLE_MS = 30000;
let syncLastResumeCatchUp = 0;
function syncResumeCatchUp() {
  const userId = currentUserId;
  if (!syncEngine || !userId || syncStartedFor !== userId) return;
  const now = Date.now();
  if (now - syncLastResumeCatchUp < SYNC_RESUME_THROTTLE_MS) return;
  syncLastResumeCatchUp = now;
  syncSerial(async () => {
    if (currentUserId !== userId || syncEngine.userId !== userId) return;
    if (syncEngine.state === "unknown") { await syncStartAndCatchUp(userId); return; }
    if (syncEngine.state !== "unlocked" && syncEngine.state !== "unconfigured") return;
    const { changed } = await syncEngine.catchUp();
    if (changed) showUpdateBanner();
  }).catch(() => {});
}
if (syncEngine) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncResumeCatchUp();
  });
  window.addEventListener("online", syncResumeCatchUp);
}

// ── Realtime: Änderungen von anderen Geräten, während diese Seite offen
// ist. Der eigene Upload kommt hier per Postgres-Broadcast auch wieder rein
// ("Echo") — der Zeitstempel-Vergleich in der Engine filtert ihn heraus.
// Änderungen am Keyring (auch DELETE, z.B. "Cloud-Daten zurücksetzen" auf
// einem anderen Gerät) bestimmen den Zustand neu; DELETE-Ereignisse tragen
// nur die alten Primärschlüssel-Spalten (user_id, key) in payload.old.
function subscribeRealtime(userId) {
  if (!sbClient || !syncEngine) return;
  if (realtimeChannel && realtimeUserId === userId) return;
  unsubscribeRealtime();
  realtimeUserId = userId;
  realtimeChannel = sbClient
    .channel(`kv_store_${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: SYNC_TABLE, filter: `user_id=eq.${userId}` },
      (payload) => {
        const isDelete = payload.eventType === "DELETE";
        const row = isDelete ? payload.old : payload.new;
        if (!row || typeof row.key !== "string") return;
        if (row.user_id !== undefined && row.user_id !== userId) return;
        if (row.key === SYNC_KEYRING_KEY) {
          syncKeyringChanged(userId, isDelete ? null : row);
          return;
        }
        if (isDelete) return;
        // Zu große Zeilen liefert Realtime ohne Feldwerte (payload.errors):
        // nie als Wert behandeln, sondern den Stand per Abgleich lesen.
        if (payload.errors || !Object.prototype.hasOwnProperty.call(row, "value")) {
          syncIncompleteRowCatchUp(userId);
          return;
        }
        syncEngine.applyRemoteRow(row)
          .then((changed) => { if (changed) showUpdateBanner(); })
          .catch((e) => console.error("Sync: Realtime-Zeile nicht übernommen", row.key, e));
      }
    )
    .subscribe();
}
// Realtime-Zeile ohne Wert: einen Abgleich über syncSerial einreihen. Mehrere
// solche Ereignisse kurz hintereinander teilen sich einen wartenden Abgleich.
let syncIncompleteCatchUpQueued = false;
function syncIncompleteRowCatchUp(userId) {
  if (!syncEngine || syncIncompleteCatchUpQueued) return;
  syncIncompleteCatchUpQueued = true;
  syncSerial(async () => {
    syncIncompleteCatchUpQueued = false;
    if (currentUserId !== userId || syncEngine.userId !== userId) return;
    if (syncEngine.state !== "unlocked" && syncEngine.state !== "unconfigured") return;
    const { changed } = await syncEngine.catchUp();
    if (changed) showUpdateBanner();
  }).catch(() => {});
}
function unsubscribeRealtime() {
  if (realtimeChannel) { sbClient.removeChannel(realtimeChannel); realtimeChannel = null; }
  realtimeUserId = null;
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

// Der Anmelde-Link springt nach dem Klick in der Mail zu einer Web-Adresse
// zurück. In der Desktop-App (app://nook) und unter file:// käme er nie an,
// dort bleibt nur E-Mail und Passwort.
if (!location.protocol.startsWith("http")) {
  document.getElementById("sync-login-link-hint")?.classList.add("hidden");
}

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

// ── Verschlüsselungs-Modal: Einrichten, Entsperren, Wiederherstellen,
// Passwort ändern, Cloud-Daten zurücksetzen ─────────────────────────
// Alle Engine-Aufrufe, die Zustand oder Cloud ändern, laufen über
// syncSerial(...) (siehe Kommentar dort); syncAfterUnlock() erst danach.
// Das Setup-Objekt (enthält Datenschlüssel und Wiederherstellungsschlüssel)
// lebt nur in der Closure von syncCryptoSetupFlow und wird bei jedem
// Schließen verworfen.
const SYNC_CRYPTO_MIN_LENGTH = 12; // wie MIN_PASSWORD_LENGTH in sync-engine.js
const SYNC_CRYPTO_STEPS = ["setup", "key", "progress", "unlock", "recover", "change"];
const SYNC_CRYPTO_TITLES = {
  setup: "🔒 Verschlüsselung einrichten",
  key: "🔑 Wiederherstellungsschlüssel",
  progress: "🔒 Verschlüsselung einrichten",
  unlock: "🔓 Gerät entsperren",
  recover: "🔑 Passwort vergessen",
  change: "🔑 Passwort ändern",
};
// Nach dem Schließen syncAfterUnlock() anstoßen (Einrichtung teilweise
// gescheitert, Gerät aber schon entsperrt) — nicht sofort, weil der
// Erstabgleich neu lädt und die Fehlermeldung sonst nicht lesbar wäre.
let syncCryptoAfterClose = false;

function syncCryptoEl(id) { return document.getElementById(id); }

function showSyncCryptoError(step, text) {
  const el = syncCryptoEl(`sync-crypto-${step}-error`);
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("hidden", !text);
}

function hideSyncCryptoErrors() {
  SYNC_CRYPTO_STEPS.forEach((s) => showSyncCryptoError(s, ""));
}

function syncCryptoCurrentStep() {
  return SYNC_CRYPTO_STEPS.find((s) => !syncCryptoEl(`sync-crypto-step-${s}`)?.classList.contains("hidden")) || null;
}

function showSyncCryptoStep(step) {
  SYNC_CRYPTO_STEPS.forEach((s) => syncCryptoEl(`sync-crypto-step-${s}`)?.classList.toggle("hidden", s !== step));
  const title = syncCryptoEl("sync-crypto-title");
  if (title) title.textContent = SYNC_CRYPTO_TITLES[step] || "🔒 Verschlüsselung";
  hideSyncCryptoErrors();
  focusSyncCryptoStep(step);
}

// Fokus ins Modal, nur auf ein aktives, sichtbares Element: im Schlüssel-
// Schritt "Kopieren", sonst erstes leeres Eingabefeld, erstes Feld, der
// Hauptknopf oder das erste Bedienelement. Ohne passendes Element (z.B. während
// die Einrichtung läuft) die Modal-Box selbst, damit Escape/Enter im Modal ankommen.
function syncCryptoFocusable(el) {
  return !!el && !el.disabled && el.offsetParent !== null;
}

function focusSyncCryptoStep(step) {
  const box = syncCryptoEl(`sync-crypto-step-${step}`);
  if (!box) return;
  const copyBtn = syncCryptoEl("sync-crypto-copy");
  const inputs = Array.from(box.querySelectorAll("input:not([type=checkbox])")).filter(syncCryptoFocusable);
  const controls = Array.from(box.querySelectorAll("button, input")).filter(syncCryptoFocusable);
  const primary = syncCryptoEl(box.dataset.primary || "");
  const target = (step === "key" && syncCryptoFocusable(copyBtn) ? copyBtn : null)
    || inputs.find((i) => !i.value) || inputs[0]
    || (syncCryptoFocusable(primary) ? primary : null) || controls[0]
    || syncCryptoEl("sync-crypto-overlay").querySelector(".modal-box");
  if (target) target.focus();
}

function setSyncCryptoBusy(busy) {
  syncCryptoBusy = busy;
  const overlay = syncCryptoEl("sync-crypto-overlay");
  if (!overlay) return;
  overlay.querySelectorAll("button, input").forEach((el) => { el.disabled = busy; });
  overlay.querySelector(".modal-box")?.setAttribute("aria-busy", busy ? "true" : "false");
  if (!busy) syncCryptoEl("sync-crypto-key-next").disabled = !syncCryptoEl("sync-crypto-saved").checked;
}

// Leert alle Felder und verwirft das Setup-Objekt.
function resetSyncCryptoModal() {
  syncCryptoSetupFlow.discard();
  const overlay = syncCryptoEl("sync-crypto-overlay");
  if (!overlay) return;
  overlay.querySelectorAll("input").forEach((el) => {
    if (el.type === "checkbox") el.checked = false; else el.value = "";
  });
  syncCryptoEl("sync-crypto-recovery-key").textContent = "";
  syncCryptoEl("sync-crypto-copy-status").textContent = "";
  syncCryptoEl("sync-crypto-progress-text").textContent = "";
  syncCryptoEl("sync-crypto-progress-actions").classList.add("hidden");
  syncCryptoEl("sync-crypto-progress-retry").classList.add("hidden");
  syncCryptoEl("sync-crypto-key-next").disabled = true;
  hideSyncCryptoErrors();
}

function onSyncCryptoModalClose() {
  resetSyncCryptoModal();
  if (syncCryptoAfterClose) {
    syncCryptoAfterClose = false;
    syncAfterUnlock();
  }
}

// Schließt nur über ✕ oder Abbrechen, nie per Klick daneben oder Escape:
// sonst wäre ein schon angezeigter Wiederherstellungsschlüssel aus Versehen
// verworfen. Im Schlüssel-Schritt fragt das Schließen deshalb noch einmal nach.
async function confirmSyncCryptoClose() {
  if (syncCryptoBusy) return false; // während einer Aktion nicht schließbar
  if (syncCryptoCurrentStep() !== "key") return true;
  return hubConfirm({
    title: "Einrichtung abbrechen?",
    message: "Der angezeigte Wiederherstellungsschlüssel wird dann ungültig. Beim nächsten Einrichten bekommst du einen neuen.",
    confirmText: "Abbrechen",
    danger: true,
  });
}

const syncCryptoModal = wireModal("sync-crypto-overlay", {
  closeIds: ["sync-crypto-close", "sync-crypto-setup-cancel", "sync-crypto-key-cancel", "sync-crypto-progress-close",
    "sync-crypto-unlock-cancel", "sync-crypto-recover-cancel", "sync-crypto-change-cancel"],
  onClose: onSyncCryptoModalClose,
  backdropCloses: false,
  beforeClose: confirmSyncCryptoClose,
});

function openSyncCryptoModal(step) {
  resetSyncCryptoModal();
  syncCryptoModal.open();
  showSyncCryptoStep(step);
}

// Enter löst den Hauptknopf des sichtbaren Schritts aus. Escape schließt
// bewusst nicht (siehe confirmSyncCryptoClose). Liegt hubConfirm darüber,
// gehört Enter ihm.
syncCryptoEl("sync-crypto-overlay")?.addEventListener("keydown", (e) => {
  if (!syncCryptoEl("hub-confirm-overlay")?.classList.contains("hidden")) return;
  if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
  const step = e.target.closest(".sync-crypto-step");
  const primary = step && syncCryptoEl(step.dataset.primary || "");
  if (!primary || primary.disabled) return;
  e.preventDefault();
  primary.click();
});

// Fehler als Ergebnis statt Rejection: ein falsches Passwort ist kein
// Programmfehler und soll nicht als "Abgleich fehlgeschlagen" geloggt werden.
async function syncCryptoRun(task) {
  return syncSerial(async () => {
    try { return { value: await task() }; }
    catch (error) { return { error }; }
  });
}

// SyncCryptoError-Codes → Text, der sagt, was man tun kann.
// ctx: "setup" | "unlock" | "recover" | "change" | "reset"
function syncCryptoErrorText(error, ctx) {
  const code = error && error.code;
  const state = syncEngine ? syncEngine.state : null;
  switch (code) {
    case "password_too_short":
      return `Das Passwort braucht mindestens ${SYNC_CRYPTO_MIN_LENGTH} Zeichen.`;
    case "wrong_secret":
      if (ctx === "recover") return "Dieser Wiederherstellungsschlüssel passt nicht. Prüfe ihn bitte Zeichen für Zeichen, Bindestriche und Leerzeichen sind egal.";
      if (ctx === "change") return "Das aktuelle Passwort stimmt nicht. Versuche es noch einmal oder nutze „Aktuelles Passwort vergessen?“.";
      return "Das Passwort stimmt nicht. Versuche es noch einmal oder nutze „Passwort vergessen?“.";
    case "bad_keyring":
      return "Die Schlüsseldaten in der Cloud sind beschädigt und lassen sich nicht öffnen. Bleibt das so, kannst du über „Passwort vergessen?“ die Cloud-Daten zurücksetzen und mit den Daten dieses Geräts neu einrichten.";
    case "key_mismatch":
      return "Die Verschlüsselung wurde auf einem anderen Gerät neu eingerichtet. Schließe das Fenster und entsperre dieses Gerät mit dem neuen Passwort.";
    case "keyring_changed":
      if (state === "unconfigured") return "In der Cloud ist keine Verschlüsselung mehr eingerichtet, vermutlich wurde sie auf einem anderen Gerät zurückgesetzt. Schließe das Fenster und richte sie neu ein.";
      return "Die Verschlüsselung wurde gerade auf einem anderen Gerät geändert. Schließe das Fenster und versuche es noch einmal.";
    case "bad_state":
      return "Das geht gerade nicht, weil sich der Zustand der Verschlüsselung geändert hat. Schließe das Fenster und schau in den Einstellungen nach dem aktuellen Stand.";
    case "read_failed":
      return "Die Cloud ist gerade nicht erreichbar. Prüfe deine Internetverbindung und versuche es noch einmal.";
    case "write_failed":
      if (ctx === "reset") {
        if (state === "unconfigured") return "Die Cloud-Daten sind gelöscht, aber einige Merker auf diesem Gerät ließen sich nicht entfernen, vermutlich ist der Browser-Speicher voll. Gib Speicher frei, bevor du die Verschlüsselung neu einrichtest.";
        return "Die Cloud-Daten konnten nicht gelöscht werden. Prüfe deine Internetverbindung und versuche es noch einmal.";
      }
      return "Die Änderung konnte nicht in der Cloud gespeichert werden. Prüfe deine Internetverbindung und versuche es noch einmal.";
    case "key_store":
      return "Der Schlüssel konnte auf diesem Gerät nicht gespeichert werden. Im privaten Modus oder bei vollem Speicher geht das nicht. Prüfe das und versuche es noch einmal.";
    case "bad_setup":
      return "Diese Einrichtung ist abgelaufen. Schließe das Fenster und starte sie noch einmal.";
  }
  return "Das hat gerade nicht geklappt. Versuche es bitte noch einmal.";
}

// finishSetup-Schritte → Text. Ob die Cloud unverändert ist, hängt am Zustand
// danach: "unlocked" heißt, der Keyring liegt schon in der Cloud und die
// Umstellung läuft beim nächsten Start bzw. Entsperren automatisch weiter.
const SYNC_SETUP_STEP_TEXTS = {
  backup: "Die Backup-Datei konnte nicht gespeichert werden. Erlaube den Download im Browser.",
  keyring_exists: "Auf einem anderen Gerät wurde die Verschlüsselung schon eingerichtet. Entsperre dieses Gerät mit dem Passwort von dort.",
  keyring: "Die Schlüsseldaten konnten nicht angelegt werden.",
  read: "Die Daten in der Cloud konnten nicht gelesen werden.",
  probe: "Die Probe-Entschlüsselung hat nicht gestimmt, deshalb wurde nichts hochgeladen.",
  upload: "Das Hochladen der verschlüsselten Daten hat nicht geklappt.",
  verify: "Die Kontrolle nach dem Hochladen ist noch nicht abgeschlossen.",
  done_flag: "Der Abschluss der Umstellung konnte noch nicht gespeichert werden.",
};

function syncSetupFailText(step, state) {
  const reason = SYNC_SETUP_STEP_TEXTS[step] || "Die Einrichtung hat nicht geklappt.";
  if (step === "verify" || step === "done_flag") {
    return `${reason} Deine Daten in der Cloud sind bereits verschlüsselt. Die Umstellung schließt sich beim nächsten Start von selbst ab, du musst nichts tun.`;
  }
  if (state === "unlocked") {
    return `${reason} Deine Daten in der Cloud sind unverändert. Die Verschlüsselung ist eingerichtet; die Umstellung wird beim nächsten Start automatisch fortgesetzt.`;
  }
  if (step === "keyring_exists") return `${reason} Deine Daten in der Cloud sind unverändert.`;
  if (state === "locked") {
    return `${reason} Deine Daten in der Cloud sind unverändert. Entsperre dieses Gerät mit dem eben gewählten Passwort, dann geht es weiter.`;
  }
  if (state === "unconfigured") return `${reason} Deine Cloud-Daten sind unverändert. Du kannst es noch einmal versuchen.`;
  return `${reason} Deine Cloud-Daten sind unverändert. Prüfe deine Internetverbindung und versuche es später noch einmal.`;
}

function readSyncCryptoNewPassword(step, pwId, repeatId) {
  const pw = syncCryptoEl(pwId).value;
  if (Array.from(pw).length < SYNC_CRYPTO_MIN_LENGTH) {
    showSyncCryptoError(step, `Bitte nimm ein Passwort mit mindestens ${SYNC_CRYPTO_MIN_LENGTH} Zeichen.`);
    syncCryptoEl(pwId).focus();
    return null;
  }
  if (pw !== syncCryptoEl(repeatId).value) {
    showSyncCryptoError(step, "Die beiden Eingaben stimmen nicht überein.");
    syncCryptoEl(repeatId).focus();
    return null;
  }
  return pw;
}

async function copySyncRecoveryKey() {
  const el = syncCryptoEl("sync-crypto-recovery-key");
  const status = syncCryptoEl("sync-crypto-copy-status");
  try {
    // Ein writeText, das nie fertig wird (z.B. ohne Berechtigung), gilt nach
    // 1,5 s als gescheitert, damit die Markier-Ausweichlösung greift.
    await Promise.race([
      navigator.clipboard.writeText(el.textContent),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Zwischenablage antwortet nicht")), 1500)),
    ]);
    status.textContent = "Kopiert.";
  } catch {
    // Ohne Zwischenablage-Zugriff: Text markieren, damit man selbst kopieren kann.
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    status.textContent = "Markiert. Kopiere ihn jetzt mit Strg+C (⌘+C).";
  }
}

function setSyncCryptoProgress(text) {
  syncCryptoEl("sync-crypto-progress-text").textContent = text;
}

// Backup vor der Migration über den bestehenden Export aus settings.js
// (lädt nach sync.js, deshalb erst beim Klick und mit typeof-Prüfung).
function syncCryptoDownloadBackup() {
  if (typeof buildBackupData !== "function" || typeof downloadBackupFile !== "function") {
    throw new Error("Backup-Export nicht geladen");
  }
  setSyncCryptoProgress("Backup-Datei wird gespeichert …");
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  downloadBackupFile(buildBackupData(), `nook-backup-vor-verschluesselung-${stamp}.json`);
  setSyncCryptoProgress("Deine Daten werden verschlüsselt und hochgeladen. Bitte lass Nook so lange geöffnet.");
}

// Einrichtungs-Ablauf. Das Setup-Objekt aus beginSetup() (Datenschlüssel und
// Wiederherstellungsschlüssel) ist nur in dieser Closure erreichbar und wird
// über discard() bei jedem Schließen des Modals verworfen.
const syncCryptoSetupFlow = (() => {
  let setup = null;

  // Schritt 1: Passwort prüfen, Keyring und Wiederherstellungsschlüssel erzeugen
  // (beginSetup speichert nichts und ändert keinen Zustand).
  async function submitPassword() {
    if (!syncEngine) return;
    showSyncCryptoError("setup", "");
    const pw = readSyncCryptoNewPassword("setup", "sync-crypto-setup-pw", "sync-crypto-setup-pw2");
    if (pw === null) return;
    setSyncCryptoBusy(true);
    let created = null;
    try {
      created = await syncEngine.beginSetup(pw);
    } catch (e) {
      setSyncCryptoBusy(false);
      showSyncCryptoError("setup", syncCryptoErrorText(e, "setup"));
      return;
    }
    setSyncCryptoBusy(false);
    setup = created;
    syncCryptoEl("sync-crypto-setup-pw").value = "";
    syncCryptoEl("sync-crypto-setup-pw2").value = "";
    syncCryptoEl("sync-crypto-recovery-key").textContent = created.recoveryKey;
    showSyncCryptoStep("key");
  }

  // Schritt 3: Abgleich, Backup, Keyring, Migration (finishSetup). Auch für
  // "Noch einmal versuchen" (gleiches Setup, gleicher Wiederherstellungsschlüssel).
  async function finish() {
    const current = setup;
    if (!syncEngine || !current) { showSyncCryptoStep("setup"); return; }
    showSyncCryptoStep("progress");
    syncCryptoEl("sync-crypto-progress-actions").classList.add("hidden");
    setSyncCryptoProgress("Deine Daten werden mit der Cloud abgeglichen …");
    setSyncCryptoBusy(true);
    const { value: res, error } = await syncCryptoRun(() => syncEngine.finishSetup(current, { backup: syncCryptoDownloadBackup }));
    setSyncCryptoBusy(false);
    const state = syncEngine.state;
    if (!error && res && res.ok) {
      syncCryptoModal.close();
      syncAfterUnlock();
      return;
    }
    setSyncCryptoProgress("");
    showSyncCryptoError("progress", error ? syncCryptoErrorText(error, "setup") : syncSetupFailText(res && res.step, state));
    syncCryptoEl("sync-crypto-progress-actions").classList.remove("hidden");
    // Noch nichts in der Cloud: mit demselben (gespeicherten) Wiederherstellungsschlüssel erneut versuchen.
    syncCryptoEl("sync-crypto-progress-retry").classList.toggle("hidden", !!error || state !== "unconfigured");
    if (state === "unlocked") syncCryptoAfterClose = true;
    syncCryptoEl("sync-crypto-progress-close").focus();
  }

  function discard() { setup = null; }

  return { submitPassword, finish, discard };
})();

async function submitSyncCryptoUnlock() {
  if (!syncEngine) return;
  showSyncCryptoError("unlock", "");
  const input = syncCryptoEl("sync-crypto-unlock-pw");
  const pw = input.value;
  if (!pw) { showSyncCryptoError("unlock", "Bitte gib dein Verschlüsselungs-Passwort ein."); input.focus(); return; }
  setSyncCryptoBusy(true);
  const { error } = await syncCryptoRun(() => syncEngine.unlock(pw));
  setSyncCryptoBusy(false);
  if (error) {
    showSyncCryptoError("unlock", syncCryptoErrorText(error, "unlock"));
    input.select();
    input.focus();
    return;
  }
  syncCryptoModal.close();
  syncAfterUnlock();
}

async function submitSyncCryptoRecover() {
  if (!syncEngine) return;
  showSyncCryptoError("recover", "");
  const keyInput = syncCryptoEl("sync-crypto-recover-key");
  const recoveryKey = keyInput.value.trim();
  if (!recoveryKey) { showSyncCryptoError("recover", "Bitte gib deinen Wiederherstellungsschlüssel ein."); keyInput.focus(); return; }
  const pw = readSyncCryptoNewPassword("recover", "sync-crypto-recover-pw", "sync-crypto-recover-pw2");
  if (pw === null) return;
  setSyncCryptoBusy(true);
  const { error } = await syncCryptoRun(() => syncEngine.recover(recoveryKey, pw));
  setSyncCryptoBusy(false);
  if (error) {
    showSyncCryptoError("recover", syncCryptoErrorText(error, "recover"));
    if (error.code === "wrong_secret") keyInput.focus();
    return;
  }
  syncCryptoModal.close();
  syncCryptoSubExtra = "Neues Passwort festgelegt";
  renderSyncCryptoRow();
  if (syncEngine.state === "unlocked") syncAfterUnlock();
}

async function submitSyncCryptoChange() {
  if (!syncEngine) return;
  showSyncCryptoError("change", "");
  const currentInput = syncCryptoEl("sync-crypto-change-current");
  const current = currentInput.value;
  if (!current) { showSyncCryptoError("change", "Bitte gib dein aktuelles Passwort ein."); currentInput.focus(); return; }
  const pw = readSyncCryptoNewPassword("change", "sync-crypto-change-pw", "sync-crypto-change-pw2");
  if (pw === null) return;
  if (pw === current) { showSyncCryptoError("change", "Das neue Passwort ist dasselbe wie das aktuelle. Bitte wähle ein anderes."); return; }
  setSyncCryptoBusy(true);
  const { error } = await syncCryptoRun(() => syncEngine.changePassword(current, pw));
  setSyncCryptoBusy(false);
  if (error) {
    showSyncCryptoError("change", syncCryptoErrorText(error, "change"));
    if (error.code === "wrong_secret") { currentInput.select(); currentInput.focus(); }
    return;
  }
  syncCryptoModal.close();
  syncCryptoSubExtra = "Passwort geändert";
  renderSyncCryptoRow();
}

// Spec "Beides verloren": löscht alle Zeilen des Kontos inklusive Keyring.
async function submitSyncCryptoReset() {
  if (!syncEngine) return;
  showSyncCryptoError("recover", "");
  const confirmed = await hubConfirm({
    title: "Cloud-Daten zurücksetzen",
    message: "Alle synchronisierten Daten in der Cloud werden gelöscht, auch die Schlüsseldaten. Das lässt sich nicht rückgängig machen. "
      + "Die Daten auf diesem Gerät bleiben erhalten, und du kannst die Verschlüsselung damit neu einrichten. "
      + "Deine anderen Geräte behalten ihre lokalen Daten. Schließe Nook vorher auf allen anderen Geräten.",
    confirmText: "Cloud-Daten löschen",
    danger: true,
  });
  if (!confirmed) { syncCryptoEl("sync-crypto-reset")?.focus(); return; }
  setSyncCryptoBusy(true);
  const { error } = await syncCryptoRun(() => syncEngine.resetCloud());
  setSyncCryptoBusy(false);
  if (error) {
    showSyncCryptoError("recover", syncCryptoErrorText(error, "reset"));
    return;
  }
  syncCryptoModal.close();
  syncCryptoSubExtra = "Cloud-Daten zurückgesetzt";
  renderSyncCryptoRow();
}

syncCryptoEl("sync-crypto-btn")?.addEventListener("click", () => {
  if (!syncEngine) return;
  const step = { unconfigured: "setup", locked: "unlock", unlocked: "change" }[syncEngine.state];
  if (step) openSyncCryptoModal(step);
});
syncCryptoEl("sync-crypto-setup-next")?.addEventListener("click", syncCryptoSetupFlow.submitPassword);
syncCryptoEl("sync-crypto-copy")?.addEventListener("click", copySyncRecoveryKey);
syncCryptoEl("sync-crypto-saved")?.addEventListener("change", (e) => {
  syncCryptoEl("sync-crypto-key-next").disabled = !e.currentTarget.checked;
});
syncCryptoEl("sync-crypto-key-next")?.addEventListener("click", syncCryptoSetupFlow.finish);
syncCryptoEl("sync-crypto-progress-retry")?.addEventListener("click", syncCryptoSetupFlow.finish);
syncCryptoEl("sync-crypto-unlock-submit")?.addEventListener("click", submitSyncCryptoUnlock);
syncCryptoEl("sync-crypto-unlock-forgot")?.addEventListener("click", () => {
  syncCryptoEl("sync-crypto-unlock-pw").value = "";
  showSyncCryptoStep("recover");
});
syncCryptoEl("sync-crypto-change-forgot")?.addEventListener("click", () => {
  ["sync-crypto-change-current", "sync-crypto-change-pw", "sync-crypto-change-pw2"].forEach((id) => { syncCryptoEl(id).value = ""; });
  showSyncCryptoStep("recover");
});
syncCryptoEl("sync-crypto-recover-submit")?.addEventListener("click", submitSyncCryptoRecover);
syncCryptoEl("sync-crypto-change-submit")?.addEventListener("click", submitSyncCryptoChange);
syncCryptoEl("sync-crypto-reset")?.addEventListener("click", submitSyncCryptoReset);
syncCryptoEl("sync-crypto-notice-dismiss")?.addEventListener("click", clearSyncCryptoNotices);

document.getElementById("sync-update-reload-btn")?.addEventListener("click", () => location.reload());
document.getElementById("sync-locked-unlock-btn")?.addEventListener("click", () => {
  hideSyncLockedHint();
  if (syncEngine && syncEngine.state === "locked") openSyncCryptoModal("unlock");
});
document.getElementById("sync-locked-later-btn")?.addEventListener("click", hideSyncLockedHint);

// ── Start ────────────────────────────────────────────────────────────
async function initSync() {
  if (!sbClient) {
    console.warn("Sync: Supabase-SDK nicht geladen (offline/blockiert?) — Nook läuft rein lokal weiter.");
    const statusBtn = document.getElementById("sync-status-btn");
    const statusSub = document.getElementById("sync-status-sub");
    if (statusBtn) statusBtn.disabled = true;
    if (statusSub) statusSub.textContent = "In dieser Version nicht verfügbar";
    return;
  }

  const googleCheck = detectSyncGoogleLogin();
  const { data: { session } } = await sbClient.auth.getSession();
  currentUserId = session?.user?.id || null;
  updateSyncStatusUI(session);
  if (session) {
    syncHandleSession(session);
  } else if (syncAuthCallbackError) {
    await googleCheck; // Der Text verweist nur auf Google, wenn es verfügbar ist.
    resetSyncLoginSteps();
    showSyncLoginError(syncAuthCallbackErrorText(syncAuthCallbackError));
    syncLoginModal.open();
  }

  sbClient.auth.onAuthStateChange((event, newSession) => {
    updateSyncStatusUI(newSession);
    currentUserId = newSession?.user?.id || null;
    if (event === "SIGNED_IN" && newSession) {
      // WICHTIG: onAuthStateChange feuert "SIGNED_IN" nicht nur bei einer
      // frischen Anmeldung, sondern auch, wenn beim normalen Seitenaufruf
      // eine bereits bestehende Session wiederhergestellt wird (und z.B. beim
      // Zurückkehren in den Tab). syncHandleSession() startet die Engine
      // deshalb nur einmal pro Konto (syncStartedFor), und der Erstabgleich
      // (endet mit location.reload()) läuft nur, solange INITIAL_MERGE_DONE_KEY
      // nicht dieses Konto nennt — sonst Endlosschleife. Der Merker wird erst
      // nach einem erfolgreichen Erstabgleich im Zustand "unlocked" gesetzt;
      // die Abmeldung entfernt ihn, damit eine erneute Anmeldung wieder frisch
      // abgleicht. setTimeout: Supabase erlaubt in diesem Callback keine
      // eigenen Abfragen (sie würden auf das Ende des Callbacks warten).
      setTimeout(() => {
        if (currentUserId === newSession.user.id) syncHandleSession(newSession);
      }, 0);
    } else if (event === "SIGNED_OUT") {
      const oldUserId = syncStartedFor;
      localStorage.removeItem(INITIAL_MERGE_DONE_KEY);
      syncStartedFor = null;
      unsubscribeRealtime();
      // Hält Uploads, Abgleich und Migration an und löscht den Schlüssel des
      // Kontos aus IndexedDB. Lokale Daten bleiben wie bisher liegen.
      if (syncEngine) {
        if (oldUserId) syncSignOutAccount(oldUserId);
        else syncEngine.signOut().catch((e) => console.error("Sync: Abmelden der Verschlüsselung fehlgeschlagen", e && e.code));
      }
    }
  });
}

initSync();
