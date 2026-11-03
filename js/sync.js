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
const SYNC_LOCAL_ONLY_KEYS = [
  "weatherData", "currentDate", "tabVisibilityOpen", "googleCalSettingsOpen",
  "sidebarCollapsed", "settingsCollapsedGroups",
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

// ── Status-Texte (Task 7 baut die eigentliche Oberfläche) ───────────────
const SYNC_STATE_TEXTS = {
  unconfigured: "Sync pausiert: Verschlüsselung einrichten",
  locked: "Sync pausiert: Passwort eingeben",
  unlocked: "Ende-zu-Ende-verschlüsselt",
  unknown: "Verschlüsselung gerade nicht prüfbar. Sync pausiert.",
  unavailable: "In dieser Umgebung nicht verfügbar. Sync pausiert.",
};

// ── Sync-Engine ─────────────────────────────────────────────────────────
// Nur mit Supabase-Client; ohne bleibt alles exakt wie bisher (rein lokal).
const syncEngine = (sbClient && typeof createSyncEngine === "function")
  ? createSyncEngine({
      client: sbClient,
      table: SYNC_TABLE,
      storage: syncStorage,
      keyStore: syncKeyStore,
      isSyncableKey,
      onStateChange: () => renderSyncStatusSub(),
      // Nur Code und Key, nie ein Wert.
      onNotice: (code, info) => console.warn("Sync: Hinweis", code, typeof info === "string" ? info : ""),
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

// Statuszeile: "Angemeldet als x" plus Zustand der Verschlüsselung.
function renderSyncStatusSub() {
  const sub = document.getElementById("sync-status-sub");
  if (!sub || !syncSessionEmail) return;
  const stateText = syncEngine ? SYNC_STATE_TEXTS[syncEngine.state] : null;
  sub.textContent = `Angemeldet als ${syncSessionEmail}` + (stateText ? ` · ${stateText}` : "");
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
  }
  document.getElementById("sync-password-row")?.classList.toggle("hidden", !session);
}

function showUpdateBanner() {
  document.getElementById("sync-update-banner")?.classList.remove("hidden");
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
  await syncEngine.start(userId);
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
        syncEngine.applyRemoteRow(row)
          .then((changed) => { if (changed) showUpdateBanner(); })
          .catch((e) => console.error("Sync: Realtime-Zeile nicht übernommen", row.key, e));
      }
    )
    .subscribe();
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
