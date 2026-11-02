// sync-engine.js – Zustände und verschlüsselter Upload des Geräte-Syncs.
// Kein DOM, kein direkter Supabase-Import: Client, Speicher und Schlüsselablage werden
// per createSyncEngine() hineingereicht, damit Node-Tests die Engine ohne Browser fahren.
// Lädt nach sync-crypto.js (dessen Funktionen sind im Browser globale Funktionen).
// Spec: docs/superpowers/specs/2026-11-02-sync-e2ee-design.md ("Zustände eines Geräts", "Hochladen")
//
// Grundregel: Der Client lädt in KEINEM Zustand Klartext hoch. Hochgeladen wird nur
// im Zustand "unlocked", und dann ausschließlich als Chiffretext (__nook_enc).
//
// Tasks 3 bis 5 erweitern diese Datei (catchUp, Erstabgleich, applyRemoteRow, Einrichtung,
// Entsperren, Passwortwechsel); die Bereiche dafür sind unten markiert.
(function () {
  "use strict";

  const KEYRING_KEY = "__nook_sync_keyring__";

  // Im Browser sind die Krypto-Funktionen Globals, in Node kommen sie per require.
  const C = (typeof module !== "undefined" && module.exports && typeof require === "function")
    ? require("./sync-crypto.js") : globalThis;

  function createSyncEngine(opts) {
    const { client, table, storage, keyStore, isSyncableKey, onStateChange, onNotice } = opts;

    let state = "signedOut";
    let userId = null;
    let dataKey = null;
    let keyring = null;   // zuletzt gelesener Keyring (für Entsperren/Passwortwechsel in späteren Tasks)
    let generation = 0;   // wird bei start()/stop() erhöht; alte Läufe erkennen daran, dass sie veraltet sind

    // --- Warteschlange: pro Key höchstens ein wartender Stand und ein laufender Upload ---
    const pending = new Map();   // key -> { json, ts }  (nur der jeweils neueste Stand)
    const inflight = new Map();  // key -> Promise des laufenden Upload-Laufs
    const dropEpoch = new Map(); // key -> Zähler; dropPending() erhöht ihn, damit auch schon begonnene Uploads verfallen

    function setState(next) {
      if (state === next) return;
      const prev = state;
      state = next;
      if (typeof onStateChange === "function") {
        try { onStateChange(next, prev); } catch (e) { console.error("Sync: onStateChange fehlgeschlagen", e); }
      }
    }

    function notice(code, info) {
      if (typeof onNotice === "function") {
        try { onNotice(code, info); } catch (e) { console.error("Sync: onNotice fehlgeschlagen", e); }
      }
    }

    // --- Start: Zustand des Geräts bestimmen ---
    async function start(uid) {
      const gen = ++generation;
      pending.clear();
      userId = uid;
      dataKey = null;
      keyring = null;
      setState("unknown");

      if (!C.syncCryptoAvailable() || !keyStore) { setState("unavailable"); return state; }

      let stored = null;
      try {
        stored = await keyStore.load(uid);
      } catch (e) {
        console.error("Sync: Schlüsselablage nicht lesbar", e);
        if (gen === generation) setState("unavailable");
        return state;
      }
      if (gen !== generation) return state;
      if (stored && !stored.key) stored = null; // Eintrag ohne Schlüssel gilt als kein Schlüssel

      // maybeSingle-Semantik: keine Zeile ist data=null ohne Fehler, ein Fehler ist ein Lesefehler.
      let res;
      try {
        res = await client.from(table).select("*").eq("user_id", uid).eq("key", KEYRING_KEY).maybeSingle();
      } catch (e) {
        res = { data: null, error: e || new Error("Lesefehler") };
      }
      if (gen !== generation) return state;

      if (res.error) {
        // Lesefehler ist nie "unconfigured": mit Schlüssel offline weiterarbeiten, sonst unbekannt.
        if (stored) { dataKey = stored.key; setState("unlocked"); } else { setState("unknown"); }
        return state;
      }

      if (!res.data) {
        // Sicher kein Keyring in der Cloud: ein gespeicherter Schlüssel ist überholt.
        if (stored) await removeStoredKey(uid);
        if (gen === generation) setState("unconfigured");
        return state;
      }

      keyring = res.data.value;
      if (stored && keyring && stored.keyId === keyring.keyId) {
        dataKey = stored.key;
        setState("unlocked");
      } else {
        if (stored) await removeStoredKey(uid); // anderer Keyring (zum Beispiel neu eingerichtet)
        if (gen === generation) setState("locked");
      }
      return state;
    }

    async function removeStoredKey(uid) {
      try { await keyStore.remove(uid); } catch (e) { console.error("Sync: Schlüssel konnte nicht entfernt werden", e); }
    }

    function stop() {
      generation++;
      pending.clear();
      userId = null;
      dataKey = null;
      keyring = null;
      setState("signedOut");
    }

    // --- Hochladen (nur unlocked, nur Chiffretext) ---
    // Lokale Schreibvorgänge in anderen Zuständen werden nicht eingereiht: der Zeitstempel steht
    // schon im Speicher, catchUp (Task 3) holt sie nach dem Entsperren nach.
    function notifyLocalWrite(key, serializedJson, ts) {
      if (state !== "unlocked" || !dataKey) return;
      if (key === KEYRING_KEY || !isSyncableKey(key)) return;
      pending.set(key, { json: serializedJson, ts });
      pump(key);
    }

    function pump(key) {
      if (inflight.has(key)) return; // der laufende Lauf holt den neuesten Stand danach selbst ab
      const run = (async () => {
        try {
          while (pending.has(key)) {
            const item = pending.get(key);
            pending.delete(key);
            await uploadOne(key, item);
          }
        } finally {
          inflight.delete(key);
        }
      })();
      inflight.set(key, run);
    }

    async function uploadOne(key, item) {
      const gen = generation;
      const uid = userId;
      const k = dataKey;
      const epoch = dropEpoch.get(key) || 0;
      if (state !== "unlocked" || !k || !uid) return;
      try {
        const envelope = await C.encryptValue(k, uid, key, JSON.parse(item.json));
        // Nach dem Verschlüsseln noch einmal prüfen: Konto/Zustand könnten gewechselt haben.
        if (gen !== generation || state !== "unlocked" || userId !== uid) return;
        if ((dropEpoch.get(key) || 0) !== epoch) return; // Key wurde inzwischen gelöscht
        const { error } = await client.from(table).upsert(
          { user_id: uid, key, value: envelope, updated_at: new Date(item.ts).toISOString() },
          { onConflict: "user_id,key" });
        if (error) console.error("Sync: Upload fehlgeschlagen (" + key + ")", error);
      } catch (e) {
        console.error("Sync: Upload fehlgeschlagen (" + key + ")", e);
      }
    }

    // Verwirft wartende Uploads (zum Beispiel für gelöschte Keys), damit sie nichts wiederbeleben.
    function dropPending(keys) {
      for (const k of keys) {
        pending.delete(k);
        dropEpoch.set(k, (dropEpoch.get(k) || 0) + 1);
      }
    }

    async function flush() {
      while (pending.size || inflight.size) {
        for (const k of pending.keys()) pump(k);
        await Promise.all(Array.from(inflight.values()));
      }
    }

    // --- Erweiterungen folgen in Task 3 bis 5 (catchUp, initialMerge, applyRemoteRow, Einrichtung, Entsperren) ---

    return {
      get state() { return state; },
      get userId() { return userId; },
      start, stop, notifyLocalWrite, flush, dropPending
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createSyncEngine, SYNC_KEYRING_KEY: KEYRING_KEY };
  } else {
    Object.assign(globalThis, { createSyncEngine, SYNC_KEYRING_KEY: KEYRING_KEY });
  }
})();
