"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeBackend } = require("./helpers/fake-sync-backend.js");
const crypto = require("../../js/sync-crypto.js");
const { createSyncEngine, SYNC_KEYRING_KEY: KEYRING_KEY } = require("../../js/sync-engine.js");

const A = "user-a";
const B = "user-b";
let shared; // Keyring + Schlüssel einmal erzeugen (PBKDF2 ist langsam)
async function material() {
  if (!shared) shared = await crypto.createKeyring("passwort-1234");
  return shared;
}

function makeKeyStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  const loaded = [];
  const removed = [];
  return {
    loaded, removed,
    async load(u) { loaded.push(u); return m.get(u) || null; },
    async save(u, key, keyId) { m.set(u, { key, keyId }); },
    async remove(u) { removed.push(u); m.delete(u); }
  };
}

function makeStorage() {
  return {
    getRaw: () => null, setRaw: () => true, getMeta: () => ({}), setMeta() {},
    getLastCatchUp: () => 0, setLastCatchUp() {}, keys: () => [],
    getConfirmed: () => ({}), setConfirmed() {}, getMigrationDone: () => false, setMigrationDone() {}, clearAccount() {}
  };
}

// Diese Tests prüfen Zustände und Upload, nicht die Migration: der Keyring gilt als fertig migriert,
// sonst setzt start() die Migration fort (Task 4).
const migratedKeyring = (m) => ({ ...m.keyring, migrationDone: true });

// stored: "match" = Schlüssel mit passendem keyId, "other" = anderer keyId, "none" = kein Schlüssel
async function setup({ withKeyring = true, userId = A, stored = "match", keyStore } = {}) {
  const m = await material();
  const backend = createFakeBackend();
  if (withKeyring) {
    // direkt in den Fake schreiben, wie ein anderes Gerät
    await backend.client("anderes").from("kv_store").insert(
      { user_id: userId, key: KEYRING_KEY, value: migratedKeyring(m), updated_at: new Date(1).toISOString() });
  }
  const ks = keyStore || makeKeyStore(
    stored === "match" ? { [userId]: { key: m.dataKey, keyId: m.keyring.keyId } }
      : stored === "other" ? { [userId]: { key: m.dataKey, keyId: "anderer-key" } } : {});
  const states = [];
  const engine = createSyncEngine({
    client: backend.client("dieses"), table: "kv_store", storage: makeStorage(), keyStore: ks,
    isSyncableKey: (k) => k.startsWith("nook_"),
    onStateChange: (s) => states.push(s), onNotice() {}
  });
  return { engine, backend, ks, states, m };
}

const dataRows = (backend) => backend.rows().filter((r) => r.key !== KEYRING_KEY);

test("kein Keyring: unconfigured", async () => {
  const { engine } = await setup({ withKeyring: false, stored: "none" });
  assert.equal(await engine.start(A), "unconfigured");
  assert.equal(engine.state, "unconfigured");
});

test("Lesefehler ist nie unconfigured", async () => {
  const { engine, backend } = await setup({ withKeyring: false, stored: "none" });
  backend.failNext("select");
  assert.equal(await engine.start(A), "unknown");
});

test("Eintrag ohne Schlüssel gilt als kein Schlüssel", async () => {
  const m = await material();
  const { engine } = await setup({ keyStore: makeKeyStore({ [A]: { key: null, keyId: m.keyring.keyId } }) });
  assert.equal(await engine.start(A), "locked");
});

test("Keyring ohne Schlüssel: locked", async () => {
  const { engine } = await setup({ stored: "none" });
  assert.equal(await engine.start(A), "locked");
});

test("gespeicherter Schlüssel mit gleichem keyId: unlocked", async () => {
  const { engine } = await setup();
  assert.equal(await engine.start(A), "unlocked");
});

test("gespeicherter Schlüssel bleibt bei Lesefehler nutzbar (offline)", async () => {
  const { engine, backend, ks } = await setup();
  backend.failNext("select");
  assert.equal(await engine.start(A), "unlocked");
  assert.deepEqual(ks.removed, []);
});

test("Keyring weg: Schlüssel entfernt, unconfigured, nichts hochgeladen", async () => {
  const { engine, backend, ks } = await setup({ withKeyring: false });
  assert.equal(await engine.start(A), "unconfigured");
  assert.deepEqual(ks.removed, [A]);
  engine.notifyLocalWrite("nook_x", '{"a":1}', 5);
  await engine.flush();
  assert.equal(backend.rows().length, 0);
});

test("anderer keyId: Schlüssel entfernt, locked, nichts hochgeladen", async () => {
  const { engine, backend, ks } = await setup({ stored: "other" });
  assert.equal(await engine.start(A), "locked");
  assert.deepEqual(ks.removed, [A]);
  engine.notifyLocalWrite("nook_x", '{"a":1}', 5);
  await engine.flush();
  assert.equal(dataRows(backend).length, 0);
});

test("kein Klartext: in unconfigured, locked, unknown und unavailable wird nichts hochgeladen", async () => {
  for (const [opts, expected] of [
    [{ withKeyring: false, stored: "none" }, "unconfigured"],
    [{ stored: "none" }, "locked"]
  ]) {
    const { engine, backend } = await setup(opts);
    assert.equal(await engine.start(A), expected);
    engine.notifyLocalWrite("nook_x", '{"a":1}', 5);
    await engine.flush();
    assert.equal(dataRows(backend).length, 0);
  }
  const u = await setup({ withKeyring: false, stored: "none" });
  u.backend.failNext("select");
  assert.equal(await u.engine.start(A), "unknown");
  u.engine.notifyLocalWrite("nook_x", '{"a":1}', 5);
  await u.engine.flush();
  assert.equal(u.backend.rows().length, 0);
  // unavailable: keine Schlüsselablage (IndexedDB fehlt)
  const un = await setup({ stored: "none" });
  const eng = createSyncEngine({
    client: un.backend.client("x"), table: "kv_store", storage: makeStorage(), keyStore: null, isSyncableKey: () => true
  });
  assert.equal(await eng.start(A), "unavailable");
  eng.notifyLocalWrite("nook_x", "1", 5);
  await eng.flush();
  assert.equal(dataRows(un.backend).length, 0);
});

test("unlocked: Zeile ist verschlüsselt, Zeitstempel und Wert stimmen", async () => {
  const { engine, backend, m } = await setup();
  await engine.start(A);
  engine.notifyLocalWrite("nook_x", '{"a":1}', 1700000000000);
  await engine.flush();
  const rows = dataRows(backend);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value.__nook_enc, 1);
  assert.equal(rows[0].updated_at, new Date(1700000000000).toISOString());
  assert.equal(rows[0].user_id, A);
  assert.deepEqual(await crypto.decryptValue(m.dataKey, A, "nook_x", rows[0].value), { a: 1 });
  assert.ok(!JSON.stringify(rows[0]).includes('"a":1'));
});

test("nicht synchronisierbare Keys und der Keyring-Key werden nie hochgeladen", async () => {
  const { engine, backend } = await setup();
  await engine.start(A);
  engine.notifyLocalWrite("fremd", "1", 5);
  engine.notifyLocalWrite(KEYRING_KEY, "{}", 5);
  await engine.flush();
  assert.equal(dataRows(backend).length, 0);
});

test("Warteschlange: letzter Wert gewinnt, ältere überschreiben nie neuere", async () => {
  const { engine, backend, m } = await setup();
  await engine.start(A);
  engine.notifyLocalWrite("nook_x", "1", 1);
  engine.notifyLocalWrite("nook_x", "2", 2);
  engine.notifyLocalWrite("nook_x", "3", 3);
  await engine.flush();
  const rows = dataRows(backend);
  assert.equal(rows.length, 1);
  assert.equal(await crypto.decryptValue(m.dataKey, A, "nook_x", rows[0].value), 3);
  const ups = backend.events.filter((e) => e.row.key === "nook_x").map((e) => e.row.updated_at);
  assert.deepEqual(ups, [...ups].sort());
});

test("Schreiben während laufendem Upload: neuerer Wert wird danach hochgeladen", async () => {
  const { engine, backend, m } = await setup();
  await engine.start(A);
  engine.notifyLocalWrite("nook_x", "1", 1);
  await new Promise((r) => setImmediate(r)); // erster Upload läuft vermutlich schon
  engine.notifyLocalWrite("nook_x", "2", 2);
  await engine.flush();
  assert.equal(await crypto.decryptValue(m.dataKey, A, "nook_x", dataRows(backend)[0].value), 2);
});

test("Warteschlange: pro Key nie zwei Uploads gleichzeitig, Zwischenstände werden zusammengelegt", async () => {
  const { engine, backend, m } = await setup();
  await engine.start(A);
  const gate = backend.holdNext("upsert");
  engine.notifyLocalWrite("nook_x", "1", 1);
  await gate.started; // erster Upload steckt im Backend fest
  engine.notifyLocalWrite("nook_x", "2", 2);
  engine.notifyLocalWrite("nook_x", "3", 3);
  await new Promise((r) => setImmediate(r));
  assert.equal(backend.events.filter((e) => e.row.key === "nook_x").length, 0);
  gate.release();
  await engine.flush();
  const ups = backend.events.filter((e) => e.row.key === "nook_x");
  const values = [];
  for (const e of ups) values.push(await crypto.decryptValue(m.dataKey, A, "nook_x", e.row.value));
  assert.deepEqual(values, [1, 3]);
  assert.equal(backend.maxOpen("upsert"), 1);
  assert.equal(await crypto.decryptValue(m.dataKey, A, "nook_x", dataRows(backend)[0].value), 3);
});

test("Kontowechsel während gehaltenem Upload: spätere Werte von A landen nicht unter B", async () => {
  const { engine, backend, ks, m } = await setup();
  await engine.start(A);
  await backend.client("anderes").from("kv_store").insert(
    { user_id: B, key: KEYRING_KEY, value: migratedKeyring(m), updated_at: new Date(1).toISOString() });
  await ks.save(B, m.dataKey, m.keyring.keyId);
  const gate = backend.holdNext("upsert");
  engine.notifyLocalWrite("nook_x", "1", 1);
  await gate.started;
  engine.notifyLocalWrite("nook_x", "2", 2);
  assert.equal(await engine.start(B), "unlocked");
  gate.release();
  await engine.flush();
  const ups = backend.events.filter((e) => e.row.key === "nook_x");
  assert.ok(ups.every((e) => e.row.user_id === A));
  assert.equal(ups.length, 1); // nur der schon laufende Wert 1, nie Wert 2
  assert.equal(await crypto.decryptValue(m.dataKey, A, "nook_x", ups[0].row.value), 1);
});

test("Schnappschuss: der übergebene JSON-String gilt", async () => {
  const { engine, backend, m } = await setup();
  await engine.start(A);
  const obj = { n: 1 };
  engine.notifyLocalWrite("nook_x", JSON.stringify(obj), 1);
  obj.n = 99;
  await engine.flush();
  assert.deepEqual(await crypto.decryptValue(m.dataKey, A, "nook_x", dataRows(backend)[0].value), { n: 1 });
});

test("flush in locked löst sofort auf", async () => {
  const { engine } = await setup({ stored: "none" });
  await engine.start(A);
  engine.notifyLocalWrite("nook_x", "1", 1);
  await engine.flush();
});

test("dropPending: wartender Upload wird verworfen", async () => {
  const { engine, backend } = await setup();
  await engine.start(A);
  engine.notifyLocalWrite("nook_x", "1", 1);
  engine.notifyLocalWrite("nook_y", "2", 1);
  engine.dropPending(["nook_x"]);
  await engine.flush();
  assert.deepEqual(dataRows(backend).map((r) => r.key), ["nook_y"]);
});

test("Upload-Fehler: wird geloggt, flush löst trotzdem auf", async () => {
  const { engine, backend } = await setup();
  await engine.start(A);
  backend.failNext("upsert");
  const orig = console.error;
  let logged = 0;
  console.error = () => { logged++; };
  try {
    engine.notifyLocalWrite("nook_x", "1", 1);
    await engine.flush();
  } finally { console.error = orig; }
  assert.equal(logged, 1);
  assert.equal(dataRows(backend).length, 0);
});

test("stop: wartende Uploads gehen nicht mehr raus", async () => {
  const { engine, backend } = await setup();
  await engine.start(A);
  engine.notifyLocalWrite("nook_x", "1", 1);
  engine.stop();
  await engine.flush();
  assert.equal(dataRows(backend).length, 0);
  assert.equal(engine.state, "signedOut");
});

test("zwei Konten: Schlüssel von A wird für B nicht geladen", async () => {
  const m = await material();
  const ks = makeKeyStore({ [A]: { key: m.dataKey, keyId: m.keyring.keyId } });
  const { engine, backend } = await setup({ userId: B, keyStore: ks });
  assert.equal(await engine.start(B), "locked");
  assert.deepEqual(ks.loaded, [B]);
  engine.notifyLocalWrite("nook_x", "1", 1);
  await engine.flush();
  assert.equal(dataRows(backend).length, 0);
});
