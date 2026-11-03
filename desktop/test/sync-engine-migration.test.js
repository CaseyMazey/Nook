"use strict";
// Task 4: Einrichtung und fortsetzbare Migration (Spec "Einrichtung und Migration (`unconfigured`)").
const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeBackend } = require("./helpers/fake-sync-backend.js");
const crypto = require("../../js/sync-crypto.js");
const { createSyncEngine, SYNC_KEYRING_KEY: KEYRING_KEY } = require("../../js/sync-engine.js");

const A = "user-a";
const PW = "ein-langes-passwort";
const iso = (ts) => new Date(ts).toISOString();
const quiet = async (fn) => {
  const orig = console.error; console.error = () => {};
  try { return await fn(); } finally { console.error = orig; }
};

function makeKeyStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m,
    async load(u) { return m.get(u) || null; },
    async save(u, key, keyId) { m.set(u, { key, keyId }); },
    async remove(u) { m.delete(u); }
  };
}

function makeStorage({ data = {}, meta = {}, last = {}, mig = {}, broken = [] } = {}) {
  const s = {
    data, meta, last, mig, broken, conf: {}, full: false, setRawCalls: [],
    getRaw(k) { if (s.broken.includes(k)) throw new SyntaxError("kaputt"); return s.data[k]; },
    setRaw(k, v) { s.setRawCalls.push(k); if (s.full) return false; s.data[k] = v; return true; },
    getMeta() { return { ...s.meta }; },
    setMeta(m) { for (const k of Object.keys(s.meta)) delete s.meta[k]; Object.assign(s.meta, m); },
    getLastCatchUp(u) { return s.last[u] || 0; },
    setLastCatchUp(u, ts) { s.last[u] = ts; },
    getMigrationDone(u) { return !!s.mig[u]; },
    setMigrationDone(u) { s.mig[u] = true; },
    getConfirmed(u) { return { ...(s.conf[u] || {}) }; },
    setConfirmed(u, m) { s.conf[u] = { ...m }; },
    keys() { return Object.keys(s.data); }
  };
  return s;
}

// Client-Hülle: zählt jede Backend-Operation; failAt lässt genau die n-te scheitern,
// after(op) läuft nach einer gelungenen Operation (zum Beispiel, um einen alten Client zu simulieren).
function wrapClient(backend, device, ctl) {
  const inner = backend.client(device);
  return {
    from(table) {
      const b = inner.from(table);
      let op = "select";
      const w = {};
      for (const name of ["select", "eq", "in", "maybeSingle", "single", "delete"]) {
        w[name] = (...a) => { if (name === "delete") op = "delete"; b[name](...a); return w; };
      }
      for (const name of ["upsert", "insert", "update"]) {
        w[name] = (...a) => { op = name; b[name](...a); return w; };
      }
      w.then = (res, rej) => {
        ctl.count++;
        ctl.ops.push(op);
        if (ctl.failAt === ctl.count) backend.failNext(op);
        return Promise.resolve(b).then(async (r) => {
          if (!r.error && ctl.after) await ctl.after(op);
          return r;
        }).then(res, rej);
      };
      return w;
    }
  };
}

function makeEngine({ backend, storage, ks, device = "dieses", ctl }) {
  const notices = [];
  const states = [];
  const client = ctl ? wrapClient(backend, device, ctl) : backend.client(device);
  const engine = createSyncEngine({
    client, table: "kv_store", storage, keyStore: ks,
    isSyncableKey: (k) => k.startsWith("nook_"),
    onStateChange: (s) => states.push(s), onNotice: (c, i) => notices.push([c, i])
  });
  return { engine, notices, states };
}

async function putRaw(backend, key, value, ts, uid = A) {
  await backend.client("alt").from("kv_store").upsert({ user_id: uid, key, value, updated_at: iso(ts) });
}
const rowOf = (backend, key) => backend.rows().find((r) => r.key === key);
const dataRows = (backend) => backend.rows().filter((r) => r.key !== KEYRING_KEY);
const sortRows = (rows) => rows.slice().sort((a, b) => (a.key < b.key ? -1 : 1));

// Kein Zustand darf Klartext hochladen: jede Schreib-Operation dieses Geräts ist Umschlag oder Keyring.
function assertNoPlaintextFrom(backend, device) {
  for (const ev of backend.events.filter((e) => e.device === device)) {
    if (ev.row.key === KEYRING_KEY) {
      assert.deepEqual(Object.keys(ev.row.value).sort(),
        ["byPassword", "byRecovery", "kdf", "keyId", "migrationDone", "v"]);
    } else {
      assert.equal(crypto.isEncryptedEnvelope(ev.row.value), true, "Klartext hochgeladen: " + ev.row.key);
    }
  }
}

// Speicher darf nie einen Umschlag oder den Keyring enthalten.
function assertStorageClean(storage) {
  assert.equal(KEYRING_KEY in storage.data, false);
  for (const k of Object.keys(storage.data)) {
    const v = storage.data[k];
    assert.equal(!!(v && typeof v === "object" && "__nook_enc" in v), false, "verschlüsselt im Speicher: " + k);
  }
}

let sharedSetup; // ein Setup für viele Läufe (PBKDF2 ist langsam)
async function getSetup() {
  if (!sharedSetup) {
    const b = createFakeBackend();
    const { engine } = makeEngine({ backend: b, storage: makeStorage(), ks: makeKeyStore() });
    await engine.start(A);
    sharedSetup = await engine.beginSetup(PW);
  }
  return sharedSetup;
}

// Engine in "unlocked" mit Keyring (migrationDone false) und gespeichertem Schlüssel.
async function unlockedCtx({ storageOpts, ctl } = {}) {
  const setup = await getSetup();
  const backend = createFakeBackend();
  await backend.client("anderes").from("kv_store").insert(
    { user_id: A, key: KEYRING_KEY, value: setup.keyring, updated_at: iso(1) });
  const ks = makeKeyStore({ [A]: { key: setup.dataKey, keyId: setup.keyring.keyId } });
  const storage = makeStorage(storageOpts);
  return { backend, ks, storage, setup, ...makeEngine({ backend, storage, ks, ctl }) };
}
async function encFor(setup, key, value) { return crypto.encryptValue(setup.dataKey, A, key, value); }

// --- beginSetup ---

test("beginSetup: unter 12 Zeichen abgelehnt, nur in unconfigured, speichert nichts", async () => {
  const backend = createFakeBackend();
  const ks = makeKeyStore();
  const { engine } = makeEngine({ backend, storage: makeStorage(), ks });
  assert.equal(await engine.start(A), "unconfigured");
  await assert.rejects(engine.beginSetup("elf-zeichen"), (e) => e instanceof crypto.SyncCryptoError && e.code === "password_too_short");
  await assert.rejects(engine.beginSetup(null), (e) => e.code === "password_too_short");
  const s = await engine.beginSetup("zwoelf-zeich");
  assert.equal(typeof s.recoveryKey, "string");
  assert.equal(s.keyring.migrationDone, false);
  assert.ok(s.dataKey);
  assert.equal(backend.rows().length, 0);
  assert.equal(ks.m.size, 0);
  assert.equal(engine.state, "unconfigured");

  const other = await unlockedCtx();
  await other.engine.start(A); // nicht unconfigured (unlocked, migriert sich selbst)
  await assert.rejects(other.engine.beginSetup(PW), (e) => e.code === "bad_state");
});

test("createSyncEngine: Speicher ohne Pflichtmethode wirft", () => {
  const required = ["getRaw", "setRaw", "getMeta", "setMeta", "getLastCatchUp", "setLastCatchUp",
    "getConfirmed", "setConfirmed", "getMigrationDone", "setMigrationDone", "keys"];
  const backend = createFakeBackend();
  for (const name of required) {
    const storage = makeStorage();
    delete storage[name];
    assert.throws(() => createSyncEngine({
      client: backend.client("x"), table: "kv_store", storage, keyStore: makeKeyStore(), isSyncableKey: () => true
    }), new RegExp(name));
  }
  assert.throws(() => createSyncEngine({ client: backend.client("x"), table: "kv_store", keyStore: null, isSyncableKey: () => true }));
});

// --- Ende zu Ende ---

test("Ende zu Ende: 226 Klartext-Zeilen werden verschlüsselt, Zeitstempel bleiben, zweiter Client entschlüsselt", async () => {
  const backend = createFakeBackend();
  const original = {};
  for (let i = 0; i < 226; i++) {
    const key = "nook_k" + i;
    original[key] = { i, text: "wert-" + i, list: [i, i * 2] };
    await putRaw(backend, key, original[key], 1000 + i);
  }
  await putRaw(backend, "fremd_alt", { alt: 1 }, 777); // nicht synchronisierbar: wird trotzdem verschlüsselt
  const before = sortRows(backend.rows());
  const storage = makeStorage();
  const ks = makeKeyStore();
  const { engine, notices } = makeEngine({ backend, storage, ks });
  assert.equal(await engine.start(A), "unconfigured");
  const setup = await engine.beginSetup(PW);
  let backupSawData = false;
  const res = await engine.finishSetup(setup, {
    backup: async () => { backupSawData = Object.keys(storage.data).length === 226 && !rowOf(backend, KEYRING_KEY); }
  });
  assert.deepEqual(res, { ok: true });
  assert.equal(backupSawData, true, "Backup läuft nach dem Abgleich und vor dem Keyring");
  assert.equal(engine.state, "unlocked");
  assert.equal(ks.m.get(A).keyId, setup.keyring.keyId);
  assert.deepEqual(notices, []);

  const rows = dataRows(backend);
  assert.equal(rows.length, 227);
  for (const r of rows) assert.equal(crypto.isEncryptedEnvelope(r.value), true);
  for (const b of before) assert.equal(rowOf(backend, b.key).updated_at, b.updated_at, "Zeitstempel geändert: " + b.key);
  const kr = rowOf(backend, KEYRING_KEY);
  assert.equal(kr.value.migrationDone, true);
  assert.equal(kr.value.keyId, setup.keyring.keyId);
  assert.equal(storage.mig[A], true);
  assert.ok(storage.last[A] > 0);
  assert.equal(storage.conf[A].nook_k5, 1005);
  assertNoPlaintextFrom(backend, "dieses");
  assertStorageClean(storage);
  assert.equal("fremd_alt" in storage.data, false);

  // zweiter Client: anderer Speicher, gleiches Passwort
  const key2 = await crypto.unlockWithPassword(kr.value, PW);
  for (const key of Object.keys(original)) {
    assert.deepEqual(await crypto.decryptValue(key2, A, key, rowOf(backend, key).value), original[key]);
  }
  assert.deepEqual(await crypto.decryptValue(key2, A, "fremd_alt", rowOf(backend, "fremd_alt").value), { alt: 1 });
  const s2 = makeStorage();
  const ks2 = makeKeyStore({ [A]: { key: key2, keyId: kr.value.keyId } });
  const c2 = makeEngine({ backend, storage: s2, ks: ks2, device: "zweites" });
  assert.equal(await c2.engine.start(A), "unlocked");
  assert.deepEqual(await c2.engine.initialMerge(), { ok: true });
  for (const key of Object.keys(original)) assert.deepEqual(s2.data[key], original[key]);
  assertStorageClean(s2);
});

// --- neuester Stand gewinnt ---

test("neuester Stand gewinnt (Einrichtung): lokal neuer, Cloud neuer, Gleichstand an die Cloud, einseitige Keys", async () => {
  const backend = createFakeBackend();
  await putRaw(backend, "nook_lokal_neu", "C-alt", 3000);
  await putRaw(backend, "nook_cloud_neu", "C-neu", 5000);
  await putRaw(backend, "nook_gleich", "C-gleich", 4000);
  await putRaw(backend, "nook_nur_cloud", "C-only", 6000);
  const storage = makeStorage({
    data: { nook_lokal_neu: "L-neu", nook_cloud_neu: "L-alt", nook_gleich: "L-gleich", nook_nur_lokal: "L-only", anderes: "x" },
    meta: { nook_lokal_neu: 5000, nook_cloud_neu: 3000, nook_gleich: 4000, nook_nur_lokal: 7000, anderes: 1 }
  });
  const ks = makeKeyStore();
  const { engine } = makeEngine({ backend, storage, ks });
  await engine.start(A);
  const setup = await getSetup();
  assert.deepEqual(await engine.finishSetup(setup, { backup: async () => {} }), { ok: true });
  const dec = async (key) => crypto.decryptValue(setup.dataKey, A, key, rowOf(backend, key).value);
  const ts = (key) => Date.parse(rowOf(backend, key).updated_at);
  assert.equal(await dec("nook_lokal_neu"), "L-neu"); assert.equal(ts("nook_lokal_neu"), 5000);
  assert.equal(await dec("nook_cloud_neu"), "C-neu"); assert.equal(ts("nook_cloud_neu"), 5000);
  assert.equal(await dec("nook_gleich"), "C-gleich"); assert.equal(ts("nook_gleich"), 4000);
  assert.equal(await dec("nook_nur_cloud"), "C-only"); assert.equal(ts("nook_nur_cloud"), 6000);
  assert.equal(await dec("nook_nur_lokal"), "L-only"); assert.equal(ts("nook_nur_lokal"), 7000);
  assert.equal(rowOf(backend, "anderes"), undefined);
  assert.equal(storage.data.nook_cloud_neu, "C-neu");
  assert.equal(storage.data.nook_gleich, "C-gleich");
  assert.equal(storage.data.nook_nur_cloud, "C-only");
  assert.equal(storage.data.nook_lokal_neu, "L-neu");
  assert.equal(storage.meta.nook_cloud_neu, 5000);
  assert.equal(storage.meta.nook_gleich, 4000);
});

test("neuester Stand gewinnt (Fortsetzung): Umschläge bleiben, wenn neuer, und werden entschlüsselt übernommen", async () => {
  const ctx = await unlockedCtx({
    storageOpts: {
      data: { nook_env_neu: "L1", nook_env_alt: "L2", nook_plain_neu: "L3", nook_plain_alt: "L4", nook_lokal: "L5" },
      meta: { nook_env_neu: 1000, nook_env_alt: 9000, nook_plain_neu: 1000, nook_plain_alt: 9000, nook_lokal: 8000 }
    }
  });
  const envNeu = await encFor(ctx.setup, "nook_env_neu", "C1");
  await putRaw(ctx.backend, "nook_env_neu", envNeu, 5000);
  await putRaw(ctx.backend, "nook_env_alt", await encFor(ctx.setup, "nook_env_alt", "C2"), 5000);
  await putRaw(ctx.backend, "nook_plain_neu", "C3", 5000);
  await putRaw(ctx.backend, "nook_plain_alt", "C4", 5000);
  await putRaw(ctx.backend, "nook_cloud", await encFor(ctx.setup, "nook_cloud", "C6"), 5000);
  const st = await ctx.engine.start(A); // setzt die Migration automatisch fort
  assert.equal(st, "unlocked");
  const dec = async (key) => crypto.decryptValue(ctx.setup.dataKey, A, key, rowOf(ctx.backend, key).value);
  assert.deepEqual(rowOf(ctx.backend, "nook_env_neu").value, envNeu, "gültiger, neuerer Umschlag bleibt unverändert");
  assert.equal(ctx.storage.data.nook_env_neu, "C1");
  assert.equal(ctx.storage.meta.nook_env_neu, 5000);
  assert.equal(await dec("nook_env_alt"), "L2");
  assert.equal(Date.parse(rowOf(ctx.backend, "nook_env_alt").updated_at), 9000);
  assert.equal(await dec("nook_plain_neu"), "C3");
  assert.equal(ctx.storage.data.nook_plain_neu, "C3");
  assert.equal(await dec("nook_plain_alt"), "L4");
  assert.equal(await dec("nook_lokal"), "L5");
  assert.equal(ctx.storage.data.nook_cloud, "C6");
  assert.equal(rowOf(ctx.backend, KEYRING_KEY).value.migrationDone, true);
  assertStorageClean(ctx.storage);
  assertNoPlaintextFrom(ctx.backend, "dieses");
});

// --- Backup zuerst ---

test("Backup zuerst: scheitert backup, gibt es weder Keyring noch geänderte Zeilen", async () => {
  const backend = createFakeBackend();
  await putRaw(backend, "nook_a", "cloud-neu", 5000);
  await putRaw(backend, "nook_b", "cloud", 1000);
  const storage = makeStorage({ data: { nook_a: "alt", nook_c: "lokal" }, meta: { nook_a: 1000, nook_c: 2000 } });
  const ks = makeKeyStore();
  const { engine } = makeEngine({ backend, storage, ks });
  await engine.start(A);
  const before = sortRows(backend.rows());
  const setup = await getSetup();
  let sawLatest = null;
  const res = await engine.finishSetup(setup, {
    backup: async () => { sawLatest = storage.data.nook_a; throw new Error("Download abgebrochen"); }
  });
  assert.deepEqual(res, { ok: false, step: "backup" });
  assert.equal(sawLatest, "cloud-neu", "Abgleich vor dem Backup");
  assert.deepEqual(sortRows(backend.rows()), before);
  assert.equal(rowOf(backend, KEYRING_KEY), undefined);
  assert.equal(engine.state, "unconfigured");
  assert.equal(ks.m.size, 0);
  assert.equal(backend.events.filter((e) => e.device === "dieses").length, 0);
});

test("finishSetup: Lesefehler im Abgleich vor dem Backup bricht ab, ohne Backup und ohne Keyring", async () => {
  const backend = createFakeBackend();
  await putRaw(backend, "nook_a", "cloud", 5000);
  const { engine } = makeEngine({ backend, storage: makeStorage(), ks: makeKeyStore() });
  await engine.start(A);
  backend.failNext("select");
  let called = false;
  const res = await engine.finishSetup(await getSetup(), { backup: async () => { called = true; } });
  assert.deepEqual(res, { ok: false, step: "read" });
  assert.equal(called, false);
  assert.equal(rowOf(backend, KEYRING_KEY), undefined);
});

// --- Abbruch an jedem Schritt ---

test("Abbruch an jedem Schritt: alle Werte bleiben erhalten, Fortsetzung beendet die Migration", async () => {
  const setup = await getSetup();
  async function scenario(ctl) {
    const backend = createFakeBackend();
    const cloud = { nook_c1: { c: 1 }, nook_both: "C-alt", nook_cneu: "C-neu" };
    await putRaw(backend, "nook_c1", cloud.nook_c1, 3000);
    await putRaw(backend, "nook_both", cloud.nook_both, 1000);
    await putRaw(backend, "nook_cneu", cloud.nook_cneu, 6000);
    const storage = makeStorage({
      data: { nook_l1: [1, 2], nook_both: "L-neu", nook_cneu: "L-alt" },
      meta: { nook_l1: 2000, nook_both: 4000, nook_cneu: 1000 }
    });
    const ks = makeKeyStore();
    const e = makeEngine({ backend, storage, ks, ctl });
    await e.engine.start(A);
    // erwartete Endwerte (neuester Stand)
    const expected = { nook_c1: { c: 1 }, nook_both: "L-neu", nook_cneu: "C-neu", nook_l1: [1, 2] };
    return { backend, storage, ks, expected, ...e };
  }

  // Erst ohne Fehler laufen, um alle Backend-Operationen von finishSetup zu zählen.
  const probeCtl = { count: 0, ops: [], failAt: 0 };
  const dry = await scenario(probeCtl);
  probeCtl.count = 0; probeCtl.ops = [];
  assert.deepEqual(await dry.engine.finishSetup(setup, { backup: async () => {} }), { ok: true });
  const ops = probeCtl.ops.slice();
  assert.ok(ops.length >= 6, "erwartet mindestens Abgleich, Keyring, Lesen, Upload, Prüfen, Merker: " + ops.join(","));
  assert.ok(ops.includes("insert") && ops.includes("upsert") && ops.includes("update"));

  const steps = [];
  for (let n = 1; n <= ops.length; n++) {
    const ctl = { count: 0, ops: [], failAt: 0 };
    const ctx = await scenario(ctl);
    ctl.count = 0; ctl.failAt = n;
    const res = await quiet(() => ctx.engine.finishSetup(setup, { backup: async () => {} }));
    assert.equal(res.ok, false, "Operation " + n + " (" + ops[n - 1] + ") hätte scheitern müssen");
    steps.push(res.step);

    // Alle Werte sind weiter in der Cloud vorhanden: Klartext (alt) oder entschlüsselbar.
    const cloudOriginal = { nook_c1: [{ c: 1 }], nook_both: ["C-alt", "L-neu"], nook_cneu: ["C-neu"] };
    for (const key of Object.keys(cloudOriginal)) {
      const r = rowOf(ctx.backend, key);
      assert.ok(r, "Zeile fehlt nach Abbruch bei " + n + ": " + key);
      const v = crypto.isEncryptedEnvelope(r.value) ? await crypto.decryptValue(setup.dataKey, A, key, r.value) : r.value;
      assert.ok(cloudOriginal[key].some((x) => JSON.stringify(x) === JSON.stringify(v)), "Wert verloren bei " + n + ": " + key);
    }
    assert.notEqual(rowOf(ctx.backend, KEYRING_KEY) && rowOf(ctx.backend, KEYRING_KEY).value.migrationDone, true);
    assert.equal(ctx.storage.mig[A], undefined);
    assertNoPlaintextFrom(ctx.backend, "dieses");
    assertStorageClean(ctx.storage);
    // lokale Werte sind nie verloren
    assert.deepEqual(ctx.storage.data.nook_l1, [1, 2]);
    assert.equal(ctx.storage.data.nook_both, "L-neu");

    // Fortsetzen: mit Keyring per resumeMigration, ohne Keyring durch erneutes finishSetup.
    ctl.failAt = 0;
    let done;
    if (ctx.engine.state === "unlocked") done = await ctx.engine.resumeMigration();
    else {
      assert.equal(ctx.engine.state, "unconfigured", "Zustand nach Abbruch bei " + n);
      done = await ctx.engine.finishSetup(setup, { backup: async () => {} });
    }
    assert.deepEqual(done, { ok: true }, "Fortsetzung nach Abbruch bei " + n);
    for (const r of dataRows(ctx.backend)) assert.equal(crypto.isEncryptedEnvelope(r.value), true);
    for (const key of Object.keys(ctx.expected)) {
      assert.deepEqual(await crypto.decryptValue(setup.dataKey, A, key, rowOf(ctx.backend, key).value), ctx.expected[key]);
      assert.deepEqual(ctx.storage.data[key], ctx.expected[key]);
    }
    assert.equal(rowOf(ctx.backend, KEYRING_KEY).value.migrationDone, true);
    assert.equal(ctx.storage.mig[A], true);
  }
  assert.deepEqual(steps, ["read", "keyring", "read", "upload", "verify", "done_flag"]);
});

test("Abbruch nach dem Keyring: neue Engine auf gleichem Speicher setzt beim Start fort", async () => {
  const setup = await getSetup();
  const backend = createFakeBackend();
  await putRaw(backend, "nook_a", "cloud-a", 3000);
  const storage = makeStorage({ data: { nook_b: "lokal-b" }, meta: { nook_b: 2000 } });
  const ks = makeKeyStore();
  const ctl = { count: 0, ops: [], failAt: 0 };
  const e1 = makeEngine({ backend, storage, ks, ctl });
  await e1.engine.start(A);
  ctl.after = (op) => { if (op === "insert") ctl.failAt = ctl.count + 1; }; // die Operation nach dem Keyring scheitert
  const res = await quiet(() => e1.engine.finishSetup(setup, { backup: async () => {} }));
  assert.deepEqual(res, { ok: false, step: "read" });
  assert.equal(rowOf(backend, "nook_a").value, "cloud-a");
  assert.equal(ks.m.get(A).keyId, setup.keyring.keyId);
  e1.engine.stop();

  const e2 = makeEngine({ backend, storage, ks });
  assert.equal(await e2.engine.start(A), "unlocked");
  assert.equal(rowOf(backend, KEYRING_KEY).value.migrationDone, true);
  for (const r of dataRows(backend)) assert.equal(crypto.isEncryptedEnvelope(r.value), true);
  assert.equal(await crypto.decryptValue(setup.dataKey, A, "nook_a", rowOf(backend, "nook_a").value), "cloud-a");
  assert.equal(await crypto.decryptValue(setup.dataKey, A, "nook_b", rowOf(backend, "nook_b").value), "lokal-b");
  assert.equal(storage.mig[A], true);
});

test("Start ohne lesbaren Keyring (offline) setzt nicht fort", async () => {
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 5 } } });
  ctx.backend.failNext("select");
  assert.equal(await ctx.engine.start(A), "unlocked");
  assert.equal(dataRows(ctx.backend).length, 0);
  assert.equal(rowOf(ctx.backend, KEYRING_KEY).value.migrationDone, false);
});

// --- Probe, Prüfung, unlesbare Zeilen, Speicher voll ---

test("Probe scheitert: bei einer Abweichung wird nichts hochgeladen", async () => {
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "A", nook_b: "B" }, meta: { nook_a: 10, nook_b: 10 } } });
  await putRaw(ctx.backend, "nook_c", "C", 10);
  ctx.storage.mig[A] = true; // Autostart aus, Merker gleich wieder entfernen
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  const before = sortRows(ctx.backend.rows());
  const orig = crypto.decryptValue;
  crypto.decryptValue = async (...args) => {
    const v = await orig(...args);
    return args[2] === "nook_b" ? "verfälscht" : v;
  };
  let res;
  try { res = await ctx.engine.resumeMigration(); } finally { crypto.decryptValue = orig; }
  assert.deepEqual(res, { ok: false, step: "probe" });
  assert.deepEqual(sortRows(ctx.backend.rows()), before);
  assert.equal(ctx.backend.events.filter((e) => e.device === "dieses").length, 0);
  assert.equal(ctx.storage.mig[A], undefined);
  assert.deepEqual(await ctx.engine.resumeMigration(), { ok: true });
});

test("Prüfung scheitert: liegt nach dem Upload noch Klartext vor, bleibt migrationDone falsch", async () => {
  const ctl = { count: 0, ops: [], failAt: 0 };
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "A" }, meta: { nook_a: 10 } }, ctl });
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  let injected = false;
  ctl.after = async (op) => {
    if (op === "upsert" && !injected) { injected = true; await putRaw(ctx.backend, "nook_spaet", "alt-client", 20); }
  };
  const res = await ctx.engine.resumeMigration();
  assert.deepEqual(res, { ok: false, step: "verify" });
  assert.equal(rowOf(ctx.backend, KEYRING_KEY).value.migrationDone, false);
  assert.equal(ctx.storage.mig[A], undefined);
  assert.equal(ctl.ops.includes("update"), false);
  // Fortsetzung verschlüsselt auch die spät gekommene Zeile
  assert.deepEqual(await ctx.engine.resumeMigration(), { ok: true });
  assert.equal(await crypto.decryptValue(ctx.setup.dataKey, A, "nook_spaet", rowOf(ctx.backend, "nook_spaet").value), "alt-client");
});

test("Prüfung: ein nicht entschlüsselbarer Umschlag nach dem Upload zählt als Fehler", async () => {
  const ctl = { count: 0, ops: [], failAt: 0 };
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "A" }, meta: { nook_a: 10 } }, ctl });
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  ctl.after = async (op) => {
    if (op !== "upsert") return;
    ctl.after = null;
    const r = rowOf(ctx.backend, "nook_a");
    r.value.ct = r.value.ct.slice(0, -4) + "AAAA";
    await ctx.backend.client("x").from("kv_store").upsert(r);
  };
  assert.deepEqual(await ctx.engine.resumeMigration(), { ok: false, step: "verify" });
  assert.equal(rowOf(ctx.backend, KEYRING_KEY).value.migrationDone, false);
});

test("unlesbarer Umschlag beim Lesen: Abbruch, nichts geändert, Hinweis", async () => {
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "A" }, meta: { nook_a: 10 } } });
  const env = await encFor(ctx.setup, "nook_x", "falscher-key"); // AAD passt nicht zu nook_b
  await putRaw(ctx.backend, "nook_b", env, 50);
  await putRaw(ctx.backend, "nook_c", "klar", 50);
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  const before = sortRows(ctx.backend.rows());
  const res = await ctx.engine.resumeMigration();
  assert.deepEqual(res, { ok: false, step: "read" });
  assert.deepEqual(sortRows(ctx.backend.rows()), before);
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.deepEqual(ctx.notices, [["decrypt_failed", "nook_b"]]);
});

test("Speicher voll: Cloud-Gewinner nicht übernommen, Abbruch vor dem Upload", async () => {
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "alt" }, meta: { nook_a: 10 } } });
  await putRaw(ctx.backend, "nook_a", "neu", 50);
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  ctx.storage.full = true;
  const res = await ctx.engine.resumeMigration();
  assert.deepEqual(res, { ok: false, step: "read" });
  assert.equal(rowOf(ctx.backend, "nook_a").value, "neu");
  assert.equal(ctx.backend.events.filter((e) => e.device === "dieses").length, 0);
  assert.equal(ctx.storage.meta.nook_a, 10);
  ctx.storage.full = false;
  assert.deepEqual(await ctx.engine.resumeMigration(), { ok: true });
  assert.equal(ctx.storage.data.nook_a, "neu");
});

test("resumeMigration: zwei gleichzeitige Aufrufe ergeben einen Lauf", async () => {
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "A" }, meta: { nook_a: 10 } } });
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  const hold = ctx.backend.holdNext("upsert");
  const p1 = ctx.engine.resumeMigration();
  await hold.started;
  const p2 = ctx.engine.resumeMigration();
  await new Promise((r) => setTimeout(r, 30)); // ohne Schutz käme p2 hier bis zu einem eigenen Upload
  hold.release();
  assert.deepEqual(await p1, { ok: true });
  assert.deepEqual(await p2, { ok: true });
  assert.equal(ctx.backend.events.filter((e) => e.device === "dieses" && e.type === "upsert").length, 1);
  assert.equal(ctx.backend.events.filter((e) => e.device === "dieses" && e.type === "update").length, 1);
});

test("resumeMigration: Abmelden während des Laufs schreibt nichts mehr", async () => {
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "A" }, meta: { nook_a: 10 } } });
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  const hold = ctx.backend.holdNext("select");
  const p = ctx.engine.resumeMigration();
  await hold.started;
  ctx.engine.stop();
  hold.release();
  const res = await p;
  assert.equal(res.ok, false);
  assert.equal(ctx.backend.events.filter((e) => e.device === "dieses").length, 0);
});

test("resumeMigration: Kontowechsel während des Lesens übernimmt nichts aus dem alten Konto", async () => {
  const B = "user-b";
  const ctx = await unlockedCtx({ storageOpts: { data: {}, meta: {} } });
  await putRaw(ctx.backend, "nook_c", "A-cloud", 50);
  // B nutzt (im Test) denselben Schlüssel, ist aber schon migriert
  await ctx.backend.client("anderes").from("kv_store").insert(
    { user_id: B, key: KEYRING_KEY, value: { ...ctx.setup.keyring, migrationDone: true }, updated_at: iso(1) });
  await ctx.ks.save(B, ctx.setup.dataKey, ctx.setup.keyring.keyId);
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  const hold = ctx.backend.holdNext("select");
  const p = ctx.engine.resumeMigration();
  await hold.started;
  ctx.engine.stop();
  assert.equal(await ctx.engine.start(B), "unlocked");
  hold.release();
  const res = await p;
  assert.equal(res.ok, false);
  assert.equal("nook_c" in ctx.storage.data, false);
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.equal(ctx.backend.events.filter((e) => e.device === "dieses").length, 0);
  assert.equal(rowOf(ctx.backend, KEYRING_KEY).value.migrationDone, false);
});

test("resumeMigration: nur in unlocked", async () => {
  const backend = createFakeBackend();
  const { engine } = makeEngine({ backend, storage: makeStorage(), ks: makeKeyStore() });
  await engine.start(A);
  assert.equal((await engine.resumeMigration()).ok, false);
  assert.equal(backend.events.length, 0);

  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "A" }, meta: { nook_a: 10 } } });
  ctx.ks.m.clear(); // kein Schlüssel auf dem Gerät: locked
  assert.equal(await ctx.engine.start(A), "locked");
  assert.equal((await ctx.engine.resumeMigration()).ok, false);
  assert.equal(ctx.backend.events.filter((e) => e.device === "dieses").length, 0);
});

// --- zwei Tabs ---

test("zwei Tabs: genau einer gewinnt, der andere endet in locked und ändert keine Zeile", async () => {
  const backend = createFakeBackend();
  await putRaw(backend, "nook_a", "cloud", 1000);
  const t1 = makeEngine({ backend, storage: makeStorage({ data: { nook_x: "eins" }, meta: { nook_x: 5000 } }), ks: makeKeyStore(), device: "tab1" });
  const t2 = makeEngine({ backend, storage: makeStorage({ data: { nook_y: "zwei" }, meta: { nook_y: 5000 } }), ks: makeKeyStore(), device: "tab2" });
  await t1.engine.start(A);
  await t2.engine.start(A);
  const s1 = await getSetup();
  const s2 = await t2.engine.beginSetup("anderes-passwort-12");
  const h1 = backend.holdNext("insert");
  const h2 = backend.holdNext("insert");
  const p1 = t1.engine.finishSetup(s1, { backup: async () => {} });
  const p2 = t2.engine.finishSetup(s2, { backup: async () => {} });
  await h1.started; await h2.started;
  assert.equal(backend.maxOpen("insert"), 2, "beide Inserts laufen gleichzeitig");
  h1.release(); h2.release();
  const [r1, r2] = await Promise.all([p1, p2]);
  const results = [r1, r2];
  assert.equal(results.filter((r) => r.ok).length, 1);
  const loserIdx = r1.ok ? 1 : 0;
  const loser = [t1, t2][loserIdx];
  const loserDevice = ["tab1", "tab2"][loserIdx];
  const winnerSetup = [s1, s2][1 - loserIdx];
  assert.deepEqual(results[loserIdx], { ok: false, step: "keyring_exists" });
  assert.equal(loser.engine.state, "locked");
  assert.equal(backend.events.filter((e) => e.device === loserDevice).length, 0);
  assert.equal(rowOf(backend, KEYRING_KEY).value.keyId, winnerSetup.keyring.keyId);
  for (const r of dataRows(backend)) await crypto.decryptValue(winnerSetup.dataKey, A, r.key, r.value);
});

test("finishSetup: Keyring existiert schon (23505), Zustand locked, keine Zeile geändert", async () => {
  const backend = createFakeBackend();
  await putRaw(backend, "nook_a", "cloud", 1000);
  const ks = makeKeyStore();
  const { engine } = makeEngine({ backend, storage: makeStorage(), ks });
  await engine.start(A);
  const other = await crypto.createKeyring("fremdes-passwort-123");
  let backups = 0;
  const res = await engine.finishSetup(await getSetup(), {
    backup: async () => {
      backups++;
      await backend.client("anderes").from("kv_store").insert({ user_id: A, key: KEYRING_KEY, value: other.keyring, updated_at: iso(2) });
    }
  });
  assert.deepEqual(res, { ok: false, step: "keyring_exists" });
  assert.equal(backups, 1);
  assert.equal(engine.state, "locked");
  assert.equal(ks.m.size, 0);
  assert.equal(rowOf(backend, "nook_a").value, "cloud");
  assert.equal(rowOf(backend, KEYRING_KEY).value.keyId, other.keyring.keyId);
});

// --- zusätzliche Schutzmaßnahmen ---

test("Keyring während der Migration ersetzt: Abbruch beim Lesen, nichts hochgeladen", async () => {
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "A" }, meta: { nook_a: 10 } } });
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  const other = await crypto.createKeyring("fremdes-passwort-123");
  await ctx.backend.client("x").from("kv_store").update({ value: other.keyring }).eq("user_id", A).eq("key", KEYRING_KEY);
  assert.deepEqual(await ctx.engine.resumeMigration(), { ok: false, step: "read" });
  assert.equal(ctx.backend.events.filter((e) => e.device === "dieses").length, 0);
});

test("Keyring nach dem Upload ersetzt: Prüfung scheitert, fremder Keyring bekommt kein migrationDone", async () => {
  const ctl = { count: 0, ops: [], failAt: 0 };
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "A" }, meta: { nook_a: 10 } }, ctl });
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  const other = await crypto.createKeyring("fremdes-passwort-123");
  ctl.after = async (op) => {
    if (op !== "upsert") return;
    ctl.after = null;
    await ctx.backend.client("x").from("kv_store").update({ value: other.keyring }).eq("user_id", A).eq("key", KEYRING_KEY);
  };
  assert.deepEqual(await ctx.engine.resumeMigration(), { ok: false, step: "verify" });
  assert.equal(rowOf(ctx.backend, KEYRING_KEY).value.migrationDone, false);
  assert.equal(ctx.storage.mig[A], undefined);
});

test("lokaler Schreibvorgang während der Migration wird nicht vom älteren Stand überschrieben", async () => {
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_a: "alt", nook_b: "B" }, meta: { nook_a: 10, nook_b: 10 } } });
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  const orig = crypto.encryptValue;
  let hooked = false;
  crypto.encryptValue = async (...args) => {
    if (!hooked) {
      hooked = true; // erster Aufruf ist die Migration: jetzt schreibt die Nutzerin lokal
      ctx.storage.data.nook_a = "neu";
      ctx.storage.meta.nook_a = 99999;
      ctx.engine.notifyLocalWrite("nook_a", JSON.stringify("neu"), 99999);
    }
    return orig(...args);
  };
  let res;
  try { res = await ctx.engine.resumeMigration(); } finally { crypto.encryptValue = orig; }
  assert.deepEqual(res, { ok: true });
  const r = rowOf(ctx.backend, "nook_a");
  assert.equal(await crypto.decryptValue(ctx.setup.dataKey, A, "nook_a", r.value), "neu");
  assert.equal(Date.parse(r.updated_at), 99999);
  assert.equal(await crypto.decryptValue(ctx.setup.dataKey, A, "nook_b", rowOf(ctx.backend, "nook_b").value), "B");
});

test("unlesbarer, neuerer lokaler Eintrag wird nicht vom Cloud-Wert überschrieben", async () => {
  const ctx = await unlockedCtx({ storageOpts: { data: { nook_k: "?" }, meta: { nook_k: 9000 }, broken: ["nook_k"] } });
  await putRaw(ctx.backend, "nook_k", "cloud", 5000);
  ctx.storage.mig[A] = true;
  await ctx.engine.start(A);
  delete ctx.storage.mig[A];
  assert.deepEqual(await ctx.engine.resumeMigration(), { ok: true });
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.equal(ctx.storage.meta.nook_k, 9000);
  const r = rowOf(ctx.backend, "nook_k");
  assert.equal(await crypto.decryptValue(ctx.setup.dataKey, A, "nook_k", r.value), "cloud");
  assert.equal(Date.parse(r.updated_at), 5000);
});
