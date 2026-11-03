// sync-engine.js – Zustände und verschlüsselter Upload des Geräte-Syncs.
// Kein DOM, kein direkter Supabase-Import: Client, Speicher und Schlüsselablage werden
// per createSyncEngine() hineingereicht, damit Node-Tests die Engine ohne Browser fahren.
// Lädt nach sync-crypto.js (dessen Funktionen sind im Browser globale Funktionen).
// Spec: docs/superpowers/specs/2026-11-02-sync-e2ee-design.md ("Zustände eines Geräts", "Hochladen")
//
// Grundregel: Der Client lädt in KEINEM Zustand Klartext hoch. Hochgeladen wird nur
// im Zustand "unlocked", und dann ausschließlich als Chiffretext (__nook_enc).
//
// Task 4 und 5 erweitern diese Datei (Einrichtung, Entsperren, Passwortwechsel); der Bereich dafür ist unten markiert.
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
    const pending = new Map();   // key -> { json, ts, waiters }  (nur der jeweils neueste Stand; waiters melden das Ergebnis)
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
      clearPending();
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
      migrationDone(); // übernimmt ein gesetztes migrationDone in den lokalen, klebrigen Merker
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
      clearPending();
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
      const prev = pending.get(key);
      pending.set(key, { json: serializedJson, ts, waiters: prev ? prev.waiters : [] });
      pump(key);
    }

    // Reiht einen Upload ein (derselbe Weg wie notifyLocalWrite, damit die Reihenfolge pro Key gilt)
    // und liefert, ob er angekommen ist. Ein bereits wartender, neuerer Stand bleibt erhalten.
    function queueUpload(key, serializedJson, ts) {
      if (state !== "unlocked" || !dataKey) return Promise.resolve(false);
      return new Promise((resolve) => {
        const prev = pending.get(key);
        if (prev && prev.ts > ts) prev.waiters.push(resolve);
        else pending.set(key, { json: serializedJson, ts, waiters: (prev ? prev.waiters : []).concat(resolve) });
        pump(key);
      });
    }

    function settle(item, ok) {
      for (const w of item.waiters) w(ok);
    }

    function clearPending() {
      for (const item of pending.values()) settle(item, false);
      pending.clear();
    }

    function pump(key) {
      if (inflight.has(key)) return; // der laufende Lauf holt den neuesten Stand danach selbst ab
      const run = (async () => {
        try {
          while (pending.has(key)) {
            const item = pending.get(key);
            pending.delete(key);
            settle(item, await uploadOne(key, item));
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
      if (state !== "unlocked" || !k || !uid) return false;
      try {
        const envelope = await C.encryptValue(k, uid, key, JSON.parse(item.json));
        // Nach dem Verschlüsseln noch einmal prüfen: Konto/Zustand könnten gewechselt haben.
        if (gen !== generation || state !== "unlocked" || userId !== uid) return false;
        if ((dropEpoch.get(key) || 0) !== epoch) return false; // Key wurde inzwischen gelöscht
        const { error } = await client.from(table).upsert(
          { user_id: uid, key, value: envelope, updated_at: new Date(item.ts).toISOString() },
          { onConflict: "user_id,key" });
        if (error) { console.error("Sync: Upload fehlgeschlagen (" + key + ")", error); return false; }
        return true;
      } catch (e) {
        console.error("Sync: Upload fehlgeschlagen (" + key + ")", e);
        return false;
      }
    }

    // Verwirft wartende Uploads (zum Beispiel für gelöschte Keys), damit sie nichts wiederbeleben.
    function dropPending(keys) {
      for (const k of keys) {
        const item = pending.get(k);
        if (item) settle(item, false);
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

    // --- Abgleich: Herunterladen, Nachholen, Erstabgleich, Realtime ---
    // Cloud-Werte gelangen nie verschlüsselt in den Speicher, der Keyring nie überhaupt.
    // Hinweise und Logs tragen nur den Key, nie einen Wert.

    // Klebriger Merker: ein einmal gesehenes migrationDone: true gilt auf diesem Gerät für immer,
    // auch wenn der Server den Keyring später zurücksetzt (sonst könnte er Klartext einschleusen).
    function migrationDone() {
      if (keyring && keyring.migrationDone === true) {
        if (typeof storage.setMigrationDone === "function") {
          try { storage.setMigrationDone(userId); } catch (e) { console.error("Sync: Migrationsmerker nicht speicherbar", e); }
        }
        return true;
      }
      if (typeof storage.getMigrationDone !== "function") return false;
      try { return storage.getMigrationDone(userId) === true; } catch (e) { return false; }
    }

    function parseTs(row) {
      const t = typeof row.updated_at === "string" ? Date.parse(row.updated_at) : NaN;
      return Number.isFinite(t) ? t : null;
    }

    // Lokaler Wert (geparst). Fehlt er oder ist der Eintrag nicht lesbar, gilt er als nicht vorhanden.
    function readLocal(key) {
      try {
        const v = storage.getRaw(key);
        return v === undefined || v === null ? { has: false } : { has: true, value: v };
      } catch (e) {
        return { has: false };
      }
    }

    function localTs(key) {
      const t = storage.getMeta()[key];
      return typeof t === "number" ? t : 0;
    }

    function setLocalTs(key, ts) {
      const meta = storage.getMeta();
      meta[key] = ts;
      storage.setMeta(meta);
    }

    // Ergebnis: { kind: "value", value } | { kind: "bad" } | { kind: "skip" } | { kind: "plaintext_blocked" }
    async function decodeRow(row, k, uid) {
      const v = row.value;
      if (C.isEncryptedEnvelope(v)) {
        if (state !== "unlocked" || !k) return { kind: "skip" }; // ohne Schlüssel unlesbar, aber nicht "kaputt"
        try {
          return { kind: "value", value: await C.decryptValue(k, uid, row.key, v) };
        } catch (e) {
          return { kind: "bad" };
        }
      }
      if (state === "unlocked" && migrationDone()) return { kind: "plaintext_blocked" };
      return { kind: "value", value: v };
    }

    // Klartext-Zeile eines alten Clients nach der Migration: mit lokalem Wert verschlüsselt ersetzen
    // (neuer Zeitstempel), sonst liegen lassen und melden. Liefert ein Promise<boolean> oder null.
    function handlePlaintextRow(key) {
      const local = readLocal(key);
      if (!local.has) { notice("plaintext_row", key); return null; }
      const ts = Date.now();
      setLocalTs(key, ts);
      return queueUpload(key, JSON.stringify(local.value), ts);
    }

    function isStale(gen, st) {
      return gen !== generation || state !== st;
    }

    async function readAllRows(uid) {
      try {
        const res = await client.from(table).select("*").eq("user_id", uid);
        if (res.error) return null;
        return res.data || [];
      } catch (e) {
        return null;
      }
    }

    async function catchUp() {
      const st = state;
      if (st !== "unlocked" && st !== "unconfigured") return { changed: false };
      const gen = generation, uid = userId, k = dataKey;
      const started = Date.now();
      const rows = await readAllRows(uid);
      if (rows === null || isStale(gen, st)) return { changed: false };

      if (st === "unlocked") {
        const kr = rows.find((r) => r.key === KEYRING_KEY);
        if (!kr || !kr.value || !keyring || kr.value.keyId !== keyring.keyId) {
          await start(uid); // gleiche Zustandsbestimmung wie beim Start; entfernt den Schlüssel, wenn er überholt ist
          return { changed: false };
        }
        keyring = kr.value;
      }

      let changed = false;
      let complete = true;
      const uploads = [];
      const byKey = new Map();

      for (const row of rows) {
        if (row.key === KEYRING_KEY || !isSyncableKey(row.key)) continue;
        byKey.set(row.key, row);
        const remoteTs = parseTs(row);
        if (remoteTs === null) { notice("decrypt_failed", row.key); continue; }

        if (st === "unlocked" && !C.isEncryptedEnvelope(row.value) && migrationDone()) {
          const p = handlePlaintextRow(row.key);
          if (p) uploads.push(p);
          continue;
        }
        if (remoteTs <= localTs(row.key)) continue;

        const dec = await decodeRow(row, k, uid);
        if (isStale(gen, st)) return { changed };
        if (dec.kind === "bad") { notice("decrypt_failed", row.key); continue; }
        if (dec.kind !== "value") continue;
        // Entschlüsseln ist asynchron: ein inzwischen neuerer lokaler Schreibvorgang gewinnt.
        if (remoteTs <= localTs(row.key)) continue;
        if (storage.setRaw(row.key, dec.value) === true) {
          setLocalTs(row.key, remoteTs);
          changed = true;
        } else {
          complete = false; // Speicher voll: Zeitstempel bleibt stehen, der nächste Lauf versucht es erneut
        }
      }

      if (st === "unlocked") {
        for (const key of storage.keys()) {
          if (key === KEYRING_KEY || !isSyncableKey(key)) continue;
          const lts = localTs(key);
          const remote = byKey.get(key);
          if (remote) {
            const rts = parseTs(remote);
            if (rts === null) continue; // unlesbare Zeile nie überschreiben
            if (!C.isEncryptedEnvelope(remote.value) && migrationDone()) continue; // oben behandelt
            if (!(lts > rts)) continue;
          } else if (!(lts > storage.getLastCatchUp(uid))) {
            continue;
          }
          const local = readLocal(key);
          if (!local.has) continue;
          uploads.push(queueUpload(key, JSON.stringify(local.value), lts));
        }
        const results = await Promise.all(uploads);
        if (results.some((ok) => !ok)) complete = false;
        if (isStale(gen, st)) return { changed };
        if (complete) storage.setLastCatchUp(uid, started);
      }
      return { changed };
    }

    async function initialMerge() {
      if (state !== "unlocked" || !dataKey) return { ok: false };
      const gen = generation, uid = userId, k = dataKey;
      const started = Date.now();
      const rows = await readAllRows(uid);
      if (rows === null || isStale(gen, "unlocked")) return { ok: false };

      // Erst alles lesen, dann schreiben: scheitert eine Zeile, bleibt der Speicher unberührt.
      const decoded = [];
      const plain = [];
      let bad = false;
      for (const row of rows) {
        if (row.key === KEYRING_KEY || !isSyncableKey(row.key)) continue;
        const ts = parseTs(row);
        if (ts === null) { notice("decrypt_failed", row.key); bad = true; continue; }
        const dec = await decodeRow(row, k, uid);
        if (isStale(gen, "unlocked")) return { ok: false };
        if (dec.kind === "bad") { notice("decrypt_failed", row.key); bad = true; }
        else if (dec.kind === "plaintext_blocked") plain.push(row.key);
        else if (dec.kind === "value") decoded.push({ key: row.key, ts, value: dec.value });
      }
      if (bad) return { ok: false };

      let ok = true;
      const handled = new Set([...decoded.map((d) => d.key), ...plain]);
      const uploads = [];
      for (const d of decoded) {
        if (storage.setRaw(d.key, d.value) === true) setLocalTs(d.key, d.ts);
        else ok = false;
      }
      for (const key of plain) {
        const p = handlePlaintextRow(key);
        if (p) uploads.push(p);
      }
      for (const key of storage.keys()) {
        if (handled.has(key) || key === KEYRING_KEY || !isSyncableKey(key)) continue;
        if (!readLocal(key).has) continue;
        const ts = Date.now();
        setLocalTs(key, ts);
        uploads.push(queueUpload(key, JSON.stringify(readLocal(key).value), ts));
      }
      const results = await Promise.all(uploads);
      if (results.some((r) => !r)) ok = false;
      if (isStale(gen, "unlocked")) return { ok: false };
      if (ok) storage.setLastCatchUp(uid, started);
      return { ok };
    }

    // Realtime: liefert true, wenn die Zeile in den Speicher übernommen wurde.
    async function applyRemoteRow(row) {
      const st = state;
      if (st !== "unlocked" && st !== "unconfigured") return false;
      if (!row || typeof row.key !== "string" || row.key === KEYRING_KEY || !isSyncableKey(row.key)) return false;
      const gen = generation, uid = userId, k = dataKey;
      const remoteTs = parseTs(row);
      if (remoteTs === null) { notice("decrypt_failed", row.key); return false; }
      if (st === "unlocked" && !C.isEncryptedEnvelope(row.value) && migrationDone()) {
        const p = handlePlaintextRow(row.key);
        if (p) await p;
        return false;
      }
      if (remoteTs <= localTs(row.key)) return false;
      const dec = await decodeRow(row, k, uid);
      if (isStale(gen, st)) return false;
      if (dec.kind === "bad") { notice("decrypt_failed", row.key); return false; }
      if (dec.kind !== "value") return false;
      if (remoteTs <= localTs(row.key)) return false;
      if (storage.setRaw(row.key, dec.value) !== true) return false;
      setLocalTs(row.key, remoteTs);
      return true;
    }

    // --- Erweiterungen folgen in Task 4 und 5 (Einrichtung, Entsperren, Passwortwechsel) ---

    return {
      get state() { return state; },
      get userId() { return userId; },
      start, stop, notifyLocalWrite, flush, dropPending, catchUp, initialMerge, applyRemoteRow
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createSyncEngine, SYNC_KEYRING_KEY: KEYRING_KEY };
  } else {
    Object.assign(globalThis, { createSyncEngine, SYNC_KEYRING_KEY: KEYRING_KEY });
  }
})();
