// sync-engine.js – Zustände und verschlüsselter Upload des Geräte-Syncs.
// Kein DOM, kein direkter Supabase-Import: Client, Speicher und Schlüsselablage werden
// per createSyncEngine() hineingereicht, damit Node-Tests die Engine ohne Browser fahren.
// Lädt nach sync-crypto.js (dessen Funktionen sind im Browser globale Funktionen).
// Spec: docs/superpowers/specs/2026-11-02-sync-e2ee-design.md ("Zustände eines Geräts", "Hochladen",
// "Einrichtung und Migration", "Weiteres Gerät", "Passwort ändern", "Passwort vergessen",
// "Beides verloren", "Abmelden")
//
// Grundregel: Der Client lädt in KEINEM Zustand Klartext hoch. Hochgeladen wird nur
// im Zustand "unlocked", und dann ausschließlich als Chiffretext (__nook_enc).
(function () {
  "use strict";

  const KEYRING_KEY = "__nook_sync_keyring__";
  const MIN_PASSWORD_LENGTH = 12;
  const PAGE_SIZE = 500; // unter der Zeilengrenze pro Anfrage von Supabase (max-rows, Standard 1000)
  // Ohne eine dieser Methoden wären Löschschutz (confirmed) oder Migrationsmerker still abgeschaltet.
  // clearAccount(userId) löscht Migrationsmerker, Bestätigungsstand und Abgleich-Merker eines Kontos.
  const STORAGE_METHODS = ["getRaw", "setRaw", "getMeta", "setMeta", "getLastCatchUp", "setLastCatchUp",
    "getConfirmed", "setConfirmed", "getMigrationDone", "setMigrationDone", "keys", "clearAccount"];

  // Nur Objekte, die beginSetup() erzeugt hat, nimmt finishSetup() an (eingefroren, also unverändert).
  // Modulweit, weil ein Setup an kein Konto gebunden ist.
  const issuedSetups = new WeakSet();

  // Im Browser sind die Krypto-Funktionen Globals, in Node kommen sie per require.
  const C = (typeof module !== "undefined" && module.exports && typeof require === "function")
    ? require("./sync-crypto.js") : globalThis;

  function createSyncEngine(opts) {
    const { client, table, storage, keyStore, isSyncableKey, onStateChange, onNotice } = opts;
    if (!storage) throw new Error("createSyncEngine: storage fehlt");
    const missing = STORAGE_METHODS.filter((m) => typeof storage[m] !== "function");
    if (missing.length) throw new Error("createSyncEngine: storage ohne " + missing.join(", "));

    let state = "signedOut";
    let userId = null;
    let dataKey = null;
    let keyring = null;   // zuletzt gelesener Keyring
    let generation = 0;   // wird bei start()/stop() erhöht; alte Läufe erkennen daran, dass sie veraltet sind
    let migrationRun = null; // { gen, promise } der laufenden Migration (höchstens eine pro Engine)

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
        // Abgebrochene Migration (Spec: setzt bei Schritt 5 fort, solange migrationDone falsch ist)
        if (!migrationDone()) await resumeMigration();
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
        confirm(uid, { [key]: item.ts });
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
      let local = false;
      try { local = storage.getMigrationDone(userId) === true; } catch (e) { local = false; }
      if (local) return true;
      if (keyring && keyring.migrationDone === true) {
        try { storage.setMigrationDone(userId); } catch (e) { console.error("Sync: Migrationsmerker nicht speicherbar", e); }
        return true;
      }
      return false;
    }

    // Pro Konto und Key der letzte Zeitstempel, der auf dem Server bestätigt ist (Upload gelang,
    // Zeile gesehen oder übernommen). Verhindert, dass ein anderswo gelöschter Key wieder hochgeladen wird.
    function readConfirmed(uid) {
      try { return storage.getConfirmed(uid) || {}; } catch (e) { return {}; }
    }
    function confirm(uid, entries) {
      try {
        const map = readConfirmed(uid);
        let dirty = false;
        for (const key of Object.keys(entries)) {
          if (!(entries[key] <= (map[key] || 0))) { map[key] = entries[key]; dirty = true; }
        }
        if (dirty) storage.setConfirmed(uid, map);
      } catch (e) { console.error("Sync: Bestätigungsstand nicht speicherbar", e); }
    }

    // "envelope" | "malformed" (hat __nook_enc, ist aber kein gültiger v1-Umschlag) | "plain"
    function rowKind(v) {
      if (C.isEncryptedEnvelope(v)) return "envelope";
      if (v && typeof v === "object" && Object.prototype.hasOwnProperty.call(v, "__nook_enc")) return "malformed";
      return "plain";
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
      const kind = rowKind(v);
      if (kind === "malformed") return state === "unlocked" ? { kind: "bad" } : { kind: "skip" };
      if (kind === "envelope") {
        if (state !== "unlocked" || !k) return { kind: "skip" }; // ohne Schlüssel unlesbar, aber nicht "kaputt"
        try {
          return { kind: "value", value: await C.decryptValue(k, uid, row.key, v) };
        } catch (e) {
          return { kind: "bad" };
        }
      }
      if (migrationDone()) return { kind: "plaintext_blocked" };
      return { kind: "value", value: v };
    }

    // Klartext-Zeile eines alten Clients nach der Migration: mit lokalem Wert verschlüsselt ersetzen
    // (neuer Zeitstempel), sonst liegen lassen und melden. Liefert ein Promise<boolean> oder null.
    function handlePlaintextRow(key) {
      if (state !== "unlocked") { notice("plaintext_row", key); return null; } // ohne Schlüssel nichts zu ersetzen
      const local = readLocal(key);
      if (!local.has) { notice("plaintext_row", key); return null; }
      const ts = Date.now();
      setLocalTs(key, ts);
      return queueUpload(key, JSON.stringify(local.value), ts);
    }

    function isStale(gen, st) {
      return gen !== generation || state !== st;
    }

    // Liest in Seiten (nach Key sortiert), bis eine Seite kurz bleibt: die Zeilengrenze pro Anfrage
    // schneidet sonst still ab. null bei einem Lesefehler.
    async function readAllRows(uid) {
      const all = [];
      try {
        for (let from = 0; ; from += PAGE_SIZE) {
          const res = await client.from(table).select("*").eq("user_id", uid)
            .order("key", { ascending: true }).range(from, from + PAGE_SIZE - 1);
          if (res.error) return null;
          const page = res.data || [];
          for (const row of page) all.push(row);
          if (page.length < PAGE_SIZE) return all;
        }
      } catch (e) {
        return null;
      }
    }

    function catchUp() { return runCatchUp(true); }

    // report (optional): report.read wird true, wenn die Zeilen gelesen und verarbeitet werden konnten.
    async function runCatchUp(canRetry, report) {
      const st = state;
      if (st !== "unlocked" && st !== "unconfigured") return { changed: false };
      const gen = generation, uid = userId, k = dataKey;
      const started = Date.now();
      const rows = await readAllRows(uid);
      if (rows === null || isStale(gen, st)) return { changed: false };

      const kr = rows.find((r) => r.key === KEYRING_KEY);
      if (st === "unconfigured" ? !!kr : (!kr || !kr.value || !keyring || kr.value.keyId !== keyring.keyId)) {
        await start(uid); // gleiche Zustandsbestimmung wie beim Start; entfernt den Schlüssel, wenn er überholt ist
        if (canRetry && (state === "unlocked" || state === "unconfigured")) return runCatchUp(false, report);
        return { changed: false };
      }
      if (st === "unlocked") keyring = kr.value;
      if (report) report.read = true;

      let changed = false;
      let complete = true;
      const uploads = [];
      const byKey = new Map();
      const seen = {};

      for (const row of rows) {
        if (row.key === KEYRING_KEY || !isSyncableKey(row.key)) continue;
        byKey.set(row.key, row);
        const remoteTs = parseTs(row);
        if (remoteTs === null) { notice("decrypt_failed", row.key); continue; }
        seen[row.key] = remoteTs;

        if (rowKind(row.value) === "plain" && migrationDone()) {
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
          confirm(uid, { [row.key]: remoteTs });
          changed = true;
        } else {
          complete = false; // Speicher voll: Zeitstempel bleibt stehen, der nächste Lauf versucht es erneut
        }
      }

      confirm(uid, seen);

      if (st === "unlocked") {
        const confirmed = readConfirmed(uid);
        for (const key of storage.keys()) {
          if (key === KEYRING_KEY || !isSyncableKey(key)) continue;
          const lts = localTs(key);
          const remote = byKey.get(key);
          if (remote) {
            const rts = parseTs(remote);
            if (rts === null) continue; // unlesbare Zeile nie überschreiben
            if (rowKind(remote.value) === "plain" && migrationDone()) continue; // oben behandelt
            if (!(lts > rts)) continue;
          } else if (!(lts > Math.max(storage.getLastCatchUp(uid), confirmed[key] || 0))) {
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
        if (storage.setRaw(d.key, d.value) === true) { setLocalTs(d.key, d.ts); confirm(uid, { [d.key]: d.ts }); }
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
      if (rowKind(row.value) === "plain" && migrationDone()) {
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
      confirm(uid, { [row.key]: remoteTs });
      return true;
    }

    // --- Einrichtung und Migration (Spec "Einrichtung und Migration (`unconfigured`)") ---
    // Schritte 1 und 2 (Passwort, Wiederherstellungsschlüssel anzeigen) gehören der Oberfläche.
    // Grundregel auch hier: nie Klartext in die Cloud; die Keyring-Zeile enthält nur gewickelte Schlüssel.

    // Gleiche Prüfung für Einrichtung, Passwortwechsel und Wiederherstellung. Zählt Zeichen, nicht UTF-16-Einheiten.
    function assertPasswordLength(password) {
      if (typeof password !== "string" || Array.from(password).length < MIN_PASSWORD_LENGTH) {
        throw new C.SyncCryptoError("password_too_short", "Das Passwort braucht mindestens " + MIN_PASSWORD_LENGTH + " Zeichen");
      }
    }

    // Erzeugt nur Keyring, Datenschlüssel und Wiederherstellungsschlüssel; speichert nichts.
    async function beginSetup(password) {
      assertPasswordLength(password);
      if (state !== "unconfigured") throw new C.SyncCryptoError("bad_state", "Einrichtung ist nur ohne Keyring möglich");
      const r = await C.createKeyring(password);
      const kr = r.keyring;
      const frozenKeyring = Object.freeze({
        v: kr.v, keyId: kr.keyId, kdf: Object.freeze({ ...kr.kdf }),
        byPassword: Object.freeze({ ...kr.byPassword }), byRecovery: Object.freeze({ ...kr.byRecovery }),
        migrationDone: kr.migrationDone
      });
      const setup = Object.freeze({ recoveryKey: r.recoveryKey, keyring: frozenKeyring, dataKey: r.dataKey });
      issuedSetups.add(setup);
      return setup;
    }

    const stepFail = (step) => ({ ok: false, step });

    // Spec-Schritte 3 bis 9. Bis einschließlich zum Keyring-Schritt ändert ein Abbruch in der Cloud nichts.
    async function finishSetup(setup, opts) {
      const backup = opts && opts.backup;
      if (!issuedSetups.has(setup)) throw new C.SyncCryptoError("bad_setup", "Unbekanntes Setup-Objekt");
      if (state !== "unconfigured") return stepFail(state === "locked" || state === "unlocked" ? "keyring_exists" : "keyring");
      if (!setup || !setup.dataKey || !setup.keyring || typeof setup.keyring.keyId !== "string") return stepFail("keyring");
      if (typeof backup !== "function") return stepFail("backup");
      const uid = userId;

      // (3a) Abgleich: der lokale Speicher bekommt die neuesten Klartext-Stände, bevor das Backup entsteht.
      const report = { read: false };
      await runCatchUp(true, report);
      if (state === "locked" || state === "unlocked") return stepFail("keyring_exists"); // Keyring tauchte auf
      if (state !== "unconfigured" || userId !== uid || !report.read) return stepFail("read");
      const gen = generation;
      const current = () => gen === generation && state === "unconfigured" && userId === uid;

      // (3b) Backup-Datei. Scheitert sie, bleibt alles, wie es war.
      try {
        await backup();
      } catch (e) {
        console.error("Sync: Backup vor der Einrichtung fehlgeschlagen", e);
        return stepFail("backup");
      }
      if (!current()) return stepFail("backup");

      // (4) Keyring per insert, nie upsert: bei zwei gleichzeitigen Einrichtungen gewinnt nur eine.
      // Nur die bekannten Felder (gewickelte Schlüssel und Parameter), nie etwas anderes aus dem Setup-Objekt.
      const sk = setup.keyring;
      const kr = { v: sk.v, keyId: sk.keyId, kdf: sk.kdf, byPassword: sk.byPassword, byRecovery: sk.byRecovery, migrationDone: false };
      let res;
      try {
        res = await client.from(table).insert(
          { user_id: uid, key: KEYRING_KEY, value: kr, updated_at: new Date().toISOString() });
      } catch (e) {
        res = { error: e || new Error("Keyring nicht angelegt") };
      }
      if (res.error) {
        if (gen === generation) await start(uid); // neu bestimmen: vorhandener Keyring ergibt locked
        return stepFail(res.error.code === "23505" ? "keyring_exists" : "keyring");
      }
      if (!current()) return stepFail("keyring");
      try {
        await keyStore.save(uid, setup.dataKey, kr.keyId);
      } catch (e) {
        console.error("Sync: Schlüssel konnte nicht gespeichert werden", e);
        if (gen === generation) await start(uid); // Keyring liegt in der Cloud: Gerät ist dann locked
        return stepFail("keyring");
      }
      if (!current()) return stepFail("keyring");
      dataKey = setup.dataKey;
      keyring = kr;
      setState("unlocked");

      // (5) bis (9)
      return resumeMigration();
    }

    // Läuft automatisch nach Start/Entsperren, solange migrationDone falsch ist. Höchstens ein Lauf
    // pro Engine; ein zweiter Aufruf während des Laufs bekommt dessen Ergebnis.
    function resumeMigration() {
      if (state !== "unlocked" || !dataKey || !keyring || !userId) return Promise.resolve(stepFail("keyring"));
      if (migrationRun && migrationRun.gen === generation) return migrationRun.promise;
      if (migrationDone()) return Promise.resolve({ ok: true });
      const prev = migrationRun ? migrationRun.promise : null;
      const gen = generation, uid = userId, k = dataKey;
      const entry = { gen, promise: null };
      entry.promise = (async () => {
        if (prev) await prev; // veralteter Lauf (vor start/stop) erkennt das selbst und endet bald
        if (gen !== generation || state !== "unlocked") return stepFail("read");
        return runMigration(gen, uid, k);
      })().finally(() => { if (migrationRun === entry) migrationRun = null; });
      migrationRun = entry;
      return entry.promise;
    }

    async function runMigration(gen, uid, k) {
      let step = "read";
      const stale = () => gen !== generation || state !== "unlocked" || userId !== uid || dataKey !== k;
      try {
        const started = Date.now();

        // (5) Alles lesen; unlesbare Umschläge brechen ab, bevor irgendetwas geändert wird.
        const rows = await readAllRows(uid);
        if (rows === null || stale()) return stepFail("read");
        const kr = rows.find((r) => r.key === KEYRING_KEY);
        if (!kr || !kr.value || !keyring || kr.value.keyId !== keyring.keyId) return stepFail("read");
        keyring = kr.value;
        if (migrationDone()) return { ok: true }; // ein anderes Gerät war schneller

        const cloud = new Map(); // key -> { ts, value, envelope }
        let bad = false;
        for (const row of rows) {
          if (row.key === KEYRING_KEY) continue;
          const ts = parseTs(row);
          const kind = rowKind(row.value);
          if (ts === null || kind === "malformed") { notice("decrypt_failed", row.key); bad = true; continue; }
          if (kind === "envelope") {
            let value;
            try {
              value = await C.decryptValue(k, uid, row.key, row.value);
            } catch (e) {
              notice("decrypt_failed", row.key); bad = true; continue;
            }
            if (stale()) return stepFail("read");
            cloud.set(row.key, { ts, value, envelope: true });
          } else {
            cloud.set(row.key, { ts, value: row.value, envelope: false }); // Klartext: die alten Daten
          }
        }
        if (bad) return stepFail("read");

        // Neuester Stand pro Key (strikt >, Gleichstand an die Cloud); einseitige Keys zählen mit.
        // Nicht synchronisierbare Cloud-Zeilen werden unverändert verschlüsselt, nie in den Speicher übernommen.
        // Dieser Block ist synchron: zwischen Entscheidung und Übernahme schreibt niemand dazwischen.
        const items = [];   // zu verschlüsseln: { key, value, ts }
        const applied = []; // Cloud-Gewinner für den Speicher: { key, value, ts, local }
        const keys = new Set(cloud.keys());
        for (const key of storage.keys()) if (key !== KEYRING_KEY && isSyncableKey(key)) keys.add(key);
        for (const key of keys) {
          const c = cloud.get(key);
          const syncable = isSyncableKey(key);
          const local = syncable ? readLocal(key) : { has: false };
          const lts = syncable ? localTs(key) : 0;
          if (!c) {
            if (!local.has) continue;
            let ts = lts;
            if (!ts) { ts = started; setLocalTs(key, ts); } // ohne Zeitstempel: jetzt, wie im Erstabgleich
            items.push({ key, value: local.value, ts });
          } else if (local.has && lts > c.ts) {
            items.push({ key, value: local.value, ts: lts });
          } else {
            if (syncable && c.ts >= lts) applied.push({ key, value: c.value, ts: c.ts, local });
            if (!c.envelope) items.push({ key, value: c.value, ts: c.ts });
          }
        }
        for (const a of applied) {
          const same = a.local.has && JSON.stringify(a.local.value) === JSON.stringify(a.value);
          if (!same && storage.setRaw(a.key, a.value) !== true) return stepFail("read"); // Speicher voll: nichts hochladen
          if (localTs(a.key) !== a.ts) setLocalTs(a.key, a.ts);
          confirm(uid, { [a.key]: a.ts });
        }
        // Lokaler Stand zum Entscheidungszeitpunkt: wird er bis zum Upload neuer, gewinnt der neuere Schreibvorgang.
        for (const it of items) it.lts = isSyncableKey(it.key) ? localTs(it.key) : 0;

        // (6) Verschlüsseln und probeweise entschlüsseln; jede Abweichung bricht vor dem Upload ab.
        step = "probe";
        const payload = [];
        for (const it of items) {
          const env = await C.encryptValue(k, uid, it.key, it.value);
          const back = await C.decryptValue(k, uid, it.key, env);
          if (JSON.stringify(back) !== JSON.stringify(it.value)) return stepFail("probe");
          if (stale()) return stepFail("probe");
          payload.push({ key: it.key, ts: it.ts, lts: it.lts, env });
        }

        // (7) Ein upsert, Zeitstempel bleiben erhalten. Was inzwischen lokal neuer ist, lädt die Warteschlange.
        step = "upload";
        const rowsOut = payload
          .filter((p) => !(isSyncableKey(p.key) && localTs(p.key) > p.lts))
          .map((p) => ({ user_id: uid, key: p.key, value: p.env, updated_at: new Date(p.ts).toISOString() }));
        if (rowsOut.length) {
          const { error } = await client.from(table).upsert(rowsOut, { onConflict: "user_id,key" });
          if (error) { console.error("Sync: Migration, Upload fehlgeschlagen", error); return stepFail("upload"); }
          const done = {};
          for (const r of rowsOut) done[r.key] = Date.parse(r.updated_at);
          confirm(uid, done);
        }
        if (stale()) return stepFail("upload");

        // (8) Neu lesen: jede Zeile außer dem Keyring muss ein gültiger, entschlüsselbarer Umschlag sein.
        step = "verify";
        await flush();
        const after = await readAllRows(uid);
        if (after === null || stale()) return stepFail("verify");
        const kr2 = after.find((r) => r.key === KEYRING_KEY);
        if (!kr2 || !kr2.value || kr2.value.keyId !== keyring.keyId) return stepFail("verify");
        const seen = {};
        for (const row of after) {
          if (row.key === KEYRING_KEY) continue;
          if (!C.isEncryptedEnvelope(row.value)) return stepFail("verify");
          await C.decryptValue(k, uid, row.key, row.value); // wirft bei Fehler: Schritt verify
          if (stale()) return stepFail("verify");
          const ts = parseTs(row);
          if (ts !== null) seen[row.key] = ts;
        }

        // (9) migrationDone setzen, auf dem frisch gelesenen Keyring (ein Passwortwechsel bleibt so erhalten).
        step = "done_flag";
        // Compare-and-swap auf das eben gelesene updated_at: ein Passwortwechsel dazwischen bleibt erhalten.
        const nextKr = keyringFields(Object.assign({}, kr2.value, { migrationDone: true }));
        const cas = await writeKeyring(uid, kr2.updated_at, nextKr);
        if (cas !== "ok") { console.error("Sync: Migration, Merker nicht gesetzt (" + cas + ")"); return stepFail("done_flag"); }
        try { storage.setMigrationDone(uid); } catch (e) { console.error("Sync: Migrationsmerker nicht speicherbar", e); }
        confirm(uid, seen);
        if (stale()) return stepFail("done_flag");
        keyring = nextKr;
        storage.setLastCatchUp(uid, started);
        return { ok: true };
      } catch (e) {
        console.error("Sync: Migration abgebrochen (" + step + ")", e);
        return stepFail(step);
      }
    }

    // --- Schlüssel: Entsperren, Passwort ändern, Wiederherstellen, Zurücksetzen, Abmelden ---
    // Fehler kommen als SyncCryptoError mit code: bad_state, wrong_secret, bad_keyring, password_too_short,
    // key_mismatch, keyring_changed, read_failed, write_failed, key_store.
    // Jede Änderung der Keyring-Zeile ist ein Compare-and-swap auf updated_at (writeKeyring).

    const fail = (c, msg) => new C.SyncCryptoError(c, msg);
    const badState = (msg) => fail("bad_state", msg || "Im aktuellen Zustand nicht möglich");

    // Keyring-Zeile frisch lesen: Zeile, null (sicher keine) oder Fehler read_failed.
    async function readKeyringRow(uid) {
      let res;
      try {
        res = await client.from(table).select("*").eq("user_id", uid).eq("key", KEYRING_KEY).maybeSingle();
      } catch (e) {
        res = { data: null, error: e || new Error("Lesefehler") };
      }
      if (res.error) throw fail("read_failed", "Keyring konnte nicht gelesen werden");
      return res.data || null;
    }

    // Nur die bekannten Felder schreiben (gewickelte Schlüssel und Parameter), nie etwas anderes.
    function keyringFields(k) {
      return { v: k.v, keyId: k.keyId, kdf: k.kdf, byPassword: k.byPassword, byRecovery: k.byRecovery, migrationDone: k.migrationDone === true };
    }

    // Trifft nur, wenn updated_at noch dem gelesenen Stand entspricht, und muss genau eine Zeile
    // zurückliefern. Ergebnis: "ok" | "changed" (inzwischen geändert oder weg) | "error" (Schreibfehler).
    async function writeKeyring(uid, prevUpdatedAt, value) {
      const prev = typeof prevUpdatedAt === "string" ? Date.parse(prevUpdatedAt) : NaN;
      if (!Number.isFinite(prev)) return "changed";
      const next = new Date(Math.max(Date.now(), prev + 1)).toISOString(); // immer neuer als der gelesene Stand
      let res;
      try {
        res = await client.from(table).update({ value, updated_at: next })
          .eq("user_id", uid).eq("key", KEYRING_KEY).eq("updated_at", prevUpdatedAt).select();
      } catch (e) {
        res = { data: null, error: e || new Error("Schreibfehler") };
      }
      if (res.error) { console.error("Sync: Keyring nicht geschrieben", res.error); return "error"; }
      return Array.isArray(res.data) && res.data.length === 1 ? "ok" : "changed";
    }

    function writeError(cas) {
      return cas === "changed"
        ? fail("keyring_changed", "Der Keyring wurde inzwischen auf einem anderen Gerät geändert")
        : fail("write_failed", "Keyring konnte nicht gespeichert werden");
    }

    // Keyring verschwunden: Zustand neu bestimmen (ergibt unconfigured) und melden.
    async function keyringGone(gen, uid) {
      if (gen === generation && userId === uid) await start(uid);
      return fail("keyring_changed", "In der Cloud liegt kein Keyring mehr");
    }

    async function saveKey(uid, key, keyId) {
      try {
        await keyStore.save(uid, key, keyId);
      } catch (e) {
        console.error("Sync: Schlüssel konnte nicht gespeichert werden", e);
        throw fail("key_store", "Schlüssel konnte auf dem Gerät nicht gespeichert werden");
      }
    }

    // Nach dem Speichern veraltet (zum Beispiel abgemeldet): der Schlüssel darf nicht liegen bleiben.
    async function discardIfSignedOut(uid) {
      if (state === "signedOut") await removeStoredKey(uid);
    }

    // Wie start(): nach dem Entsperren eine abgebrochene Migration fortsetzen.
    async function becomeUnlocked(key, kr) {
      dataKey = key;
      keyring = kr;
      setState("unlocked");
      if (!migrationDone()) await resumeMigration();
    }

    // Spec "Weiteres Gerät": das Passwort entpackt den Schlüssel nicht exportierbar, er kommt in die Ablage.
    async function unlock(password) {
      if (state !== "locked" || !userId) throw badState("Entsperren ist nur im Zustand locked möglich");
      const gen = generation, uid = userId;
      const current = () => gen === generation && state === "locked" && userId === uid;
      // Frisch lesen, damit ein Passwortwechsel anderswo sofort gilt; offline reicht der Keyring vom Start.
      let kr = keyring;
      let row;
      try { row = await readKeyringRow(uid); } catch (e) { row = undefined; }
      if (!current()) throw badState();
      if (row === null) throw await keyringGone(gen, uid);
      if (row && row.value) kr = row.value;

      const key = await C.unlockWithPassword(kr, password, false); // wrong_secret / bad_keyring
      if (!current()) throw badState();
      await saveKey(uid, key, kr.keyId);
      if (!current()) { await discardIfSignedOut(uid); throw badState(); }
      await becomeUnlocked(key, kr);
      return { ok: true };
    }

    // Spec "Passwort ändern": nur entsperrt, mit dem aktuellen Passwort (der Geräteschlüssel ist nicht exportierbar).
    async function changePassword(current, next) {
      assertPasswordLength(next);
      if (state !== "unlocked" || !userId) throw badState("Passwort ändern ist nur entsperrt möglich");
      const gen = generation, uid = userId;
      const live = () => gen === generation && state === "unlocked" && userId === uid;
      let stored;
      try { stored = await keyStore.load(uid); } catch (e) { throw fail("key_store", "Schlüsselablage nicht lesbar"); }
      const row = await readKeyringRow(uid);
      if (!live()) throw badState();
      if (!row || !row.value || !stored || row.value.keyId !== stored.keyId) {
        throw fail("key_mismatch", "Der Keyring in der Cloud passt nicht zum Schlüssel dieses Geräts");
      }
      const ext = await C.unlockWithPassword(row.value, current, true); // wrong_secret: nichts geändert
      const nextKr = keyringFields(await C.rewrapKeyring(row.value, ext, next));
      if (!live()) throw badState();
      const cas = await writeKeyring(uid, row.updated_at, nextKr);
      if (cas !== "ok") throw writeError(cas);
      if (live()) keyring = nextKr;
      return { ok: true };
    }

    // Spec "Passwort vergessen": der Wiederherstellungsschlüssel entpackt den Datenschlüssel, neues Passwort.
    async function recover(recoveryKey, newPassword) {
      assertPasswordLength(newPassword);
      if ((state !== "locked" && state !== "unlocked") || !userId) throw badState("Wiederherstellung braucht einen Keyring");
      const gen = generation, uid = userId, st = state;
      const live = () => gen === generation && state === st && userId === uid;
      const row = await readKeyringRow(uid);
      if (!live()) throw badState();
      if (!row || !row.value) throw await keyringGone(gen, uid);
      const ext = await C.unlockWithRecoveryKey(row.value, recoveryKey, true); // nur zum Neuwickeln
      const key = await C.unlockWithRecoveryKey(row.value, recoveryKey, false); // diese Kopie kommt in die Ablage
      const nextKr = keyringFields(await C.rewrapKeyring(row.value, ext, newPassword));
      if (!live()) throw badState();
      const cas = await writeKeyring(uid, row.updated_at, nextKr);
      if (cas !== "ok") throw writeError(cas);
      if (!live()) return { ok: true }; // Passwort ist geändert; den Zustand bestimmt der neue Lauf
      await saveKey(uid, key, nextKr.keyId);
      if (!live()) { await discardIfSignedOut(uid); return { ok: true }; }
      await becomeUnlocked(key, nextKr);
      return { ok: true };
    }

    // Spec "Beides verloren": löscht alle Zeilen des Kontos einschließlich Keyring. Lokale Daten bleiben.
    async function resetCloud() {
      if ((state !== "locked" && state !== "unlocked") || !userId) throw badState("Zurücksetzen braucht einen Keyring");
      const uid = userId;
      // Erst alles anhalten: kein wartender oder laufender Upload und keine Migration darf nach dem Löschen landen.
      const gen = ++generation;
      clearPending();
      dataKey = null;
      keyring = null;
      setState("unknown");
      await Promise.all(Array.from(inflight.values()));
      if (migrationRun) await migrationRun.promise.catch(() => {});

      let res;
      try {
        res = await client.from(table).delete().eq("user_id", uid);
      } catch (e) {
        res = { error: e || new Error("Löschfehler") };
      }
      if (res.error) {
        console.error("Sync: Cloud-Daten nicht gelöscht", res.error);
        if (gen === generation && userId === uid) await start(uid); // Schlüssel liegt noch, Zustand neu bestimmen
        throw fail("write_failed", "Cloud-Daten konnten nicht gelöscht werden");
      }
      await removeStoredKey(uid);
      try { storage.clearAccount(uid); } catch (e) { console.error("Sync: Merker des Kontos nicht gelöscht", e); }
      if (gen === generation && userId === uid) setState("unconfigured");
      return { ok: true };
    }

    // Spec "Abmelden": Schlüssel des Kontos löschen; lokale Daten, Migrationsmerker und Bestätigungsstand bleiben.
    async function signOut() {
      const uid = userId;
      stop();
      if (!uid || !keyStore) return { ok: true };
      try {
        await keyStore.remove(uid);
      } catch (e) {
        console.error("Sync: Schlüssel konnte nicht entfernt werden", e);
        throw fail("key_store", "Schlüssel konnte nicht vom Gerät entfernt werden");
      }
      return { ok: true };
    }

    return {
      get state() { return state; },
      get userId() { return userId; },
      start, stop, notifyLocalWrite, flush, dropPending, catchUp, initialMerge, applyRemoteRow,
      beginSetup, finishSetup, resumeMigration,
      unlock, changePassword, recover, resetCloud, signOut
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createSyncEngine, SYNC_KEYRING_KEY: KEYRING_KEY };
  } else {
    Object.assign(globalThis, { createSyncEngine, SYNC_KEYRING_KEY: KEYRING_KEY });
  }
})();
