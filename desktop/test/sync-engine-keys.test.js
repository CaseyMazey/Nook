"use strict";
// Task 5: Entsperren, Passwortwechsel, Wiederherstellung, Zurücksetzen und Abmelden
// (Spec "Weiteres Gerät", "Passwort ändern", "Passwort vergessen", "Beides verloren", "Abmelden").
const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeBackend } = require("./helpers/fake-sync-backend.js");
const crypto = require("../../js/sync-crypto.js");
const { createSyncEngine, SYNC_KEYRING_KEY: KEYRING_KEY } = require("../../js/sync-engine.js");

const A = "user-a";
const B = "user-b";
const PW = "ein-langes-passwort";
const PW2 = "zweites-langes-passwort";
const PW3 = "drittes-langes-passwort";
const SHORT = "elf-zeichen"; // 11 Zeichen
const iso = (ts) => new Date(ts).toISOString();
const quiet = async (fn) => {
  const orig = console.error; console.error = () => {};
  try { return await fn(); } finally { console.error = orig; }
};
const code = (c) => (e) => e instanceof crypto.SyncCryptoError && e.code === c;

let shared; // Keyring + Schlüssel einmal erzeugen (PBKDF2 ist langsam)
async function material() {
  if (!shared) shared = await crypto.createKeyring(PW);
  return shared;
}

function makeKeyStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  const ks = {
    m, failSave: false, failRemove: false,
    async load(u) { return m.get(u) || null; },
    async save(u, key, keyId) { if (ks.failSave) throw new Error("save kaputt"); m.set(u, { key, keyId }); },
    async remove(u) { if (ks.failRemove) throw new Error("remove kaputt"); m.delete(u); }
  };
  return ks;
}

function makeStorage({ data = {}, meta = {}, last = {}, mig = {}, conf = {} } = {}) {
  const s = {
    data, meta, last, mig, conf,
    getRaw(k) { return s.data[k]; },
    setRaw(k, v) { s.data[k] = v; return true; },
    getMeta() { return { ...s.meta }; },
    setMeta(m) { for (const k of Object.keys(s.meta)) delete s.meta[k]; Object.assign(s.meta, m); },
    getLastCatchUp(u) { return s.last[u] || 0; },
    setLastCatchUp(u, ts) { s.last[u] = ts; },
    getMigrationDone(u) { return !!s.mig[u]; },
    setMigrationDone(u) { s.mig[u] = true; },
    getConfirmed(u) { return { ...(s.conf[u] || {}) }; },
    setConfirmed(u, m) { s.conf[u] = { ...m }; },
    clearAccount(u) { delete s.mig[u]; delete s.conf[u]; delete s.last[u]; },
    keys() { return Object.keys(s.data); }
  };
  return s;
}

// Cloud mit Keyring (Standard: fertig migriert, sonst setzt start() die Migration fort).
async function cloud({ migrationDone = true, opts } = {}) {
  const m = await material();
  const backend = createFakeBackend(opts);
  await backend.client("anderes").from("kv_store").insert(
    { user_id: A, key: KEYRING_KEY, value: { ...m.keyring, migrationDone }, updated_at: iso(1) });
  return { m, backend };
}

// Ein Gerät; unlocked: true legt den passenden Schlüssel in die Ablage.
function device(backend, m, { unlocked = false, storageOpts, name = "dieses", client } = {}) {
  const ks = makeKeyStore(unlocked ? { [A]: { key: m.dataKey, keyId: m.keyring.keyId } } : {});
  const storage = makeStorage(storageOpts);
  const notices = [];
  const engine = createSyncEngine({
    client: client || backend.client(name), table: "kv_store", storage, keyStore: ks,
    isSyncableKey: (k) => k.startsWith("nook_"), onNotice: (c, i) => notices.push([c, i])
  });
  return { engine, ks, storage, notices };
}

const keyringRow = (backend) => backend.rows().find((r) => r.user_id === A && r.key === KEYRING_KEY);
async function putEnc(backend, key, value, ts, k) {
  const env = await crypto.encryptValue(k, A, key, value);
  await backend.client("anderes").from("kv_store").upsert({ user_id: A, key, value: env, updated_at: iso(ts) });
}

// Frischer Client: welches Passwort entsperrt den aktuellen Keyring?
async function unlocksWith(backend, m, password) {
  const d = device(backend, m, { name: "neu" });
  assert.equal(await d.engine.start(A), "locked");
  try { await d.engine.unlock(password); return true; } catch (e) {
    if (e.code === "wrong_secret") return false;
    throw e;
  }
}

// --- Entsperren ---

test("unlock: richtiges Passwort entsperrt, Schlüssel nicht exportierbar mit keyId gespeichert", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m);
  assert.equal(await d.engine.start(A), "locked");
  assert.deepEqual(await d.engine.unlock(PW), { ok: true });
  assert.equal(d.engine.state, "unlocked");
  const stored = d.ks.m.get(A);
  assert.equal(stored.keyId, m.keyring.keyId);
  assert.equal(stored.key.extractable, false);
  const env = await crypto.encryptValue(m.dataKey, A, "nook_x", { v: 1 });
  assert.deepEqual(await crypto.decryptValue(stored.key, A, "nook_x", env), { v: 1 });
});

test("unlock: falsches Passwort bleibt locked, Fehler wrong_secret, nichts gespeichert", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m);
  await d.engine.start(A);
  await assert.rejects(d.engine.unlock("ganz-falsches-passwort"), code("wrong_secret"));
  assert.equal(d.engine.state, "locked");
  assert.equal(d.ks.m.has(A), false);
});

test("unlock: nur im Zustand locked", async () => {
  const backend = createFakeBackend();
  const d = device(backend, await material());
  await d.engine.start(A); // unconfigured
  await assert.rejects(d.engine.unlock(PW), code("bad_state"));
  assert.equal(d.engine.state, "unconfigured");
});

test("unlock: Schlüsselablage scheitert, Gerät bleibt locked", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m);
  await d.engine.start(A);
  d.ks.failSave = true;
  await quiet(() => assert.rejects(d.engine.unlock(PW)));
  assert.equal(d.engine.state, "locked");
});

test("unlock: setzt eine nicht abgeschlossene Migration fort", async () => {
  const { m, backend } = await cloud({ migrationDone: false });
  await backend.client("alt").from("kv_store").upsert({ user_id: A, key: "nook_a", value: "alt-a", updated_at: iso(3000) });
  const d = device(backend, m);
  await d.engine.start(A);
  await d.engine.unlock(PW);
  const row = backend.rows().find((r) => r.key === "nook_a");
  assert.equal(crypto.isEncryptedEnvelope(row.value), true);
  assert.equal(keyringRow(backend).value.migrationDone, true);
  assert.equal(d.storage.data.nook_a, "alt-a");
});

// --- Passwort ändern ---

test("changePassword: altes Passwort scheitert auf neuem Client, zweites entsperrtes Gerät liest weiter", async () => {
  const { m, backend } = await cloud();
  const d1 = device(backend, m, { unlocked: true, name: "eins" });
  const d2 = device(backend, m, { unlocked: true, name: "zwei" });
  assert.equal(await d1.engine.start(A), "unlocked");
  assert.equal(await d2.engine.start(A), "unlocked");
  const before = keyringRow(backend);

  assert.deepEqual(await d1.engine.changePassword(PW, PW2), { ok: true });
  const after = keyringRow(backend);
  assert.equal(after.value.keyId, before.value.keyId);
  assert.deepEqual(after.value.byRecovery, before.value.byRecovery);
  assert.equal(after.value.migrationDone, true);
  assert.ok(Date.parse(after.updated_at) > Date.parse(before.updated_at));

  assert.equal(await unlocksWith(backend, m, PW), false);
  assert.equal(await unlocksWith(backend, m, PW2), true);

  // Gerät 2 behält seinen Schlüssel und liest neue Daten von Gerät 1.
  d1.storage.data.nook_x = { neu: 1 };
  d1.engine.notifyLocalWrite("nook_x", JSON.stringify({ neu: 1 }), 5000);
  await d1.engine.flush();
  await d2.engine.catchUp();
  assert.equal(d2.engine.state, "unlocked");
  assert.deepEqual(d2.storage.data.nook_x, { neu: 1 });
  assert.equal(await d2.engine.start(A), "unlocked");
});

test("changePassword: falsches aktuelles Passwort ändert die Keyring-Zeile nicht", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m, { unlocked: true });
  await d.engine.start(A);
  const before = keyringRow(backend);
  await assert.rejects(d.engine.changePassword("ganz-falsches-passwort", PW2), code("wrong_secret"));
  assert.deepEqual(keyringRow(backend), before);
  assert.equal(d.engine.state, "unlocked");
});

test("changePassword: anderer Keyring in der Cloud ergibt key_mismatch, Zeile bleibt", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m, { unlocked: true });
  await d.engine.start(A);
  const other = await crypto.createKeyring(PW); // gleiches Passwort, anderer Schlüssel
  await backend.client("anderes").from("kv_store").update({ value: { ...other.keyring, migrationDone: true }, updated_at: iso(2) })
    .eq("user_id", A).eq("key", KEYRING_KEY);
  const before = keyringRow(backend);
  await assert.rejects(d.engine.changePassword(PW, PW2), code("key_mismatch"));
  assert.deepEqual(keyringRow(backend), before);
  // Zustand neu bestimmt: der Schlüssel passt zu keinem Keyring mehr, also locked und verworfen.
  assert.equal(d.engine.state, "locked");
  assert.equal(d.ks.m.has(A), false);
});

test("changePassword: nur im Zustand unlocked", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m);
  await d.engine.start(A); // locked
  await assert.rejects(d.engine.changePassword(PW, PW2), code("bad_state"));
});

test("changePassword: Wechsel auf einem anderen Gerät zwischen Lesen und Schreiben ergibt keyring_changed", async () => {
  const { m, backend } = await cloud();
  const d1 = device(backend, m, { unlocked: true, name: "eins" });
  const d2 = device(backend, m, { unlocked: true, name: "zwei" });
  await d1.engine.start(A);
  await d2.engine.start(A);

  const hold = backend.holdNext("update");
  const late = d2.engine.changePassword(PW, PW3);
  await hold.started; // Gerät 2 hat gelesen und neu gewickelt, sein Schreiben wartet
  assert.deepEqual(await d1.engine.changePassword(PW, PW2), { ok: true });
  const afterFirst = keyringRow(backend);
  hold.release();
  await assert.rejects(late, code("keyring_changed"));

  assert.deepEqual(keyringRow(backend), afterFirst); // der erste Wechsel bleibt erhalten
  assert.equal(await unlocksWith(backend, m, PW2), true);
  assert.equal(await unlocksWith(backend, m, PW3), false);
});

test("Migration: Keyring-Änderung vor dem done_flag ergibt Schritt done_flag und bleibt erhalten", async () => {
  const { m, backend } = await cloud({ migrationDone: false });
  await backend.client("alt").from("kv_store").upsert({ user_id: A, key: "nook_a", value: "alt-a", updated_at: iso(3000) });
  const d = device(backend, m, { unlocked: true });

  const hold = backend.holdNext("update"); // das done_flag-Update der Migration
  const starting = d.engine.start(A);
  await hold.started;
  const run = d.engine.resumeMigration(); // dasselbe Ergebnis wie der laufende Lauf
  // Anderes Gerät ändert inzwischen das Passwort.
  const kr = keyringRow(backend);
  const ext = await crypto.unlockWithPassword(kr.value, PW, true);
  const changed = await crypto.rewrapKeyring(kr.value, ext, PW2);
  await backend.client("anderes").from("kv_store").update({ value: changed, updated_at: iso(9000) })
    .eq("user_id", A).eq("key", KEYRING_KEY);
  hold.release();
  await quiet(async () => {
    await starting;
    assert.deepEqual(await run, { ok: false, step: "done_flag" });
  });
  assert.deepEqual(keyringRow(backend).value, changed);
  assert.equal(!!d.storage.mig[A], false);

  // Der nächste Lauf liest neu und setzt den Merker auf dem geänderten Keyring.
  assert.deepEqual(await d.engine.resumeMigration(), { ok: true });
  assert.equal(keyringRow(backend).value.migrationDone, true);
  assert.deepEqual(keyringRow(backend).value.byPassword, changed.byPassword);
});

// --- Passwort vergessen ---

test("recover: aus locked mit Wiederherstellungsschlüssel, neues Passwort, Daten bleiben lesbar", async () => {
  const { m, backend } = await cloud();
  await putEnc(backend, "nook_a", { wert: 42 }, 3000, m.dataKey);
  const d = device(backend, m);
  assert.equal(await d.engine.start(A), "locked");
  const before = keyringRow(backend);

  assert.deepEqual(await d.engine.recover(m.recoveryKey, PW2), { ok: true });
  assert.equal(d.engine.state, "unlocked");
  const stored = d.ks.m.get(A);
  assert.equal(stored.keyId, m.keyring.keyId);
  assert.equal(stored.key.extractable, false);
  const after = keyringRow(backend);
  assert.equal(after.value.keyId, before.value.keyId);
  assert.deepEqual(after.value.byRecovery, before.value.byRecovery);

  await d.engine.catchUp();
  assert.deepEqual(d.storage.data.nook_a, { wert: 42 });
  assert.equal(await unlocksWith(backend, m, PW), false);
  assert.equal(await unlocksWith(backend, m, PW2), true);
  // Der Wiederherstellungsschlüssel gilt weiter.
  await crypto.unlockWithRecoveryKey(after.value, m.recoveryKey);
});

test("recover: auch aus unlocked", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m, { unlocked: true });
  await d.engine.start(A);
  assert.deepEqual(await d.engine.recover(m.recoveryKey, PW2), { ok: true });
  assert.equal(d.engine.state, "unlocked");
  assert.equal(await unlocksWith(backend, m, PW2), true);
});

test("recover: falscher Wiederherstellungsschlüssel ändert nichts", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m);
  await d.engine.start(A);
  const before = keyringRow(backend);
  const wrong = (await crypto.createKeyring(PW)).recoveryKey;
  await assert.rejects(d.engine.recover(wrong, PW2), code("wrong_secret"));
  assert.deepEqual(keyringRow(backend), before);
  assert.equal(d.engine.state, "locked");
  assert.equal(d.ks.m.has(A), false);
});

// --- Passwortlänge ---

test("Passwortlänge: unter 12 Zeichen liefern beginSetup, recover und changePassword password_too_short", async () => {
  const empty = device(createFakeBackend(), await material());
  await empty.engine.start(A); // unconfigured
  await assert.rejects(empty.engine.beginSetup(SHORT), code("password_too_short"));

  const { m, backend } = await cloud();
  const before = keyringRow(backend);
  const locked = device(backend, m, { name: "gesperrt" });
  await locked.engine.start(A);
  // Länge wird vor jeder Krypto geprüft: auch mit falschem Geheimnis kommt password_too_short.
  await assert.rejects(locked.engine.recover("FALSCH", SHORT), code("password_too_short"));
  const open = device(backend, m, { unlocked: true, name: "offen" });
  await open.engine.start(A);
  await assert.rejects(open.engine.changePassword("ganz-falsches-passwort", SHORT), code("password_too_short"));
  await assert.rejects(open.engine.changePassword(PW, SHORT), code("password_too_short"));
  await assert.rejects(open.engine.recover(m.recoveryKey, SHORT), code("password_too_short"));
  assert.deepEqual(keyringRow(backend), before);
});

// --- Beides verloren: Cloud zurücksetzen ---

test("resetCloud: löscht alle Zeilen des Kontos, unconfigured, lokale Daten bleiben; zweites Gerät wird unconfigured", async () => {
  const { m, backend } = await cloud();
  await putEnc(backend, "nook_a", "a", 3000, m.dataKey);
  await putEnc(backend, "nook_b", "b", 3000, m.dataKey);
  await backend.client("b").from("kv_store").upsert({ user_id: B, key: "nook_a", value: "fremd", updated_at: iso(1) });
  const d1 = device(backend, m, {
    unlocked: true, name: "eins",
    storageOpts: { data: { nook_a: "lokal-a", nook_c: "lokal-c" }, meta: { nook_a: 4000, nook_c: 4000 } }
  });
  const d2 = device(backend, m, { unlocked: true, name: "zwei", storageOpts: { data: { nook_z: "z" }, meta: { nook_z: 10 } } });
  await d1.engine.start(A);
  await d2.engine.start(A);
  await d1.engine.catchUp();
  assert.equal(d1.storage.mig[A], true);
  assert.ok(d1.storage.last[A] > 0);
  assert.ok(Object.keys(d1.storage.conf[A] || {}).length > 0);
  const local1 = JSON.parse(JSON.stringify(d1.storage.data));

  assert.deepEqual(await d1.engine.resetCloud(), { ok: true });
  assert.equal(d1.engine.state, "unconfigured");
  assert.deepEqual(backend.rows().filter((r) => r.user_id === A), []);
  assert.deepEqual(backend.rows().filter((r) => r.user_id === B).map((r) => r.value), ["fremd"]);
  assert.equal(d1.ks.m.has(A), false);
  assert.deepEqual(d1.storage.data, local1);
  assert.equal(d1.storage.mig[A], undefined);
  assert.equal(d1.storage.conf[A], undefined);
  assert.equal(d1.storage.last[A], undefined);

  assert.equal(await d2.engine.start(A), "unconfigured");
  assert.equal(d2.ks.m.has(A), false);
  assert.deepEqual(d2.storage.data, { nook_z: "z" });
});

test("resetCloud: danach gelingen Einrichtung und Migration auf demselben Gerät mit den lokalen Daten", async () => {
  const { m, backend } = await cloud();
  await putEnc(backend, "nook_a", "cloud-a", 3000, m.dataKey);
  const d = device(backend, m, {
    unlocked: true, storageOpts: { data: { nook_a: "lokal-a", nook_b: { liste: [1, 2] } }, meta: { nook_a: 5000, nook_b: 5000 } }
  });
  await d.engine.start(A);
  await d.engine.catchUp();
  await d.engine.resetCloud();

  const setup = await d.engine.beginSetup(PW2);
  assert.deepEqual(await d.engine.finishSetup(setup, { backup: async () => {} }), { ok: true });
  assert.equal(d.engine.state, "unlocked");
  const kr = keyringRow(backend);
  assert.equal(kr.value.keyId, setup.keyring.keyId);
  assert.equal(kr.value.migrationDone, true);
  for (const [key, value] of [["nook_a", "lokal-a"], ["nook_b", { liste: [1, 2] }]]) {
    const row = backend.rows().find((r) => r.user_id === A && r.key === key);
    assert.ok(row, "fehlt: " + key);
    assert.deepEqual(await crypto.decryptValue(setup.dataKey, A, key, row.value), value);
  }
  assert.equal(d.ks.m.get(A).keyId, setup.keyring.keyId);
});

test("resetCloud: wartende und laufende Uploads landen nicht nach dem Löschen", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m, { unlocked: true });
  await d.engine.start(A);
  const hold = backend.holdNext("upsert");
  d.storage.data.nook_a = "x";
  d.engine.notifyLocalWrite("nook_a", JSON.stringify("x"), 5000);
  await hold.started; // Upload ist unterwegs
  d.engine.notifyLocalWrite("nook_a", JSON.stringify("y"), 6000); // wartet hinter dem laufenden
  const reset = d.engine.resetCloud();
  await new Promise((r) => setImmediate(r));
  hold.release();
  assert.deepEqual(await reset, { ok: true });
  await d.engine.flush();
  assert.deepEqual(backend.rows().filter((r) => r.user_id === A), []);
});

test("resetCloud: Löschfehler lässt Schlüssel und Merker, Zustand wird neu bestimmt", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m, { unlocked: true, storageOpts: { mig: { [A]: true } } });
  await d.engine.start(A);
  backend.failNext("delete");
  await quiet(() => assert.rejects(d.engine.resetCloud(), code("write_failed")));
  assert.equal(d.engine.state, "unlocked");
  assert.equal(d.ks.m.has(A), true);
  assert.equal(d.storage.mig[A], true);
  assert.ok(keyringRow(backend));
});

test("resetCloud: nicht ohne Konto oder ohne Keyring-Zustand", async () => {
  const d = device(createFakeBackend(), await material());
  await assert.rejects(d.engine.resetCloud(), code("bad_state")); // signedOut
  await d.engine.start(A); // unconfigured
  await assert.rejects(d.engine.resetCloud(), code("bad_state"));
});

// --- Abmelden ---

test("signOut: entfernt den Schlüssel, lokale Daten, Migrationsmerker und Bestätigungsstand bleiben", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m, {
    unlocked: true, storageOpts: { data: { nook_a: "lokal" }, meta: { nook_a: 10 }, mig: { [A]: true }, conf: { [A]: { nook_a: 10 } } }
  });
  await d.engine.start(A);
  await d.engine.signOut();
  assert.equal(d.engine.state, "signedOut");
  assert.equal(d.engine.userId, null);
  assert.equal(d.ks.m.has(A), false);
  assert.deepEqual(d.storage.data, { nook_a: "lokal" });
  assert.equal(d.storage.mig[A], true);
  assert.deepEqual(d.storage.conf[A], { nook_a: 10 });
  // Danach lädt das Gerät nichts mehr hoch.
  d.engine.notifyLocalWrite("nook_a", JSON.stringify("neu"), 20);
  await d.engine.flush();
  assert.equal(backend.rows().some((r) => r.key === "nook_a"), false);
});

// --- Einrichtung: nur echte Setup-Objekte ---

test("finishSetup: nur das Objekt aus beginSetup, sonst bad_setup", async () => {
  const backend = createFakeBackend();
  const d = device(backend, await material());
  await d.engine.start(A);
  const setup = await d.engine.beginSetup(PW);
  await assert.rejects(d.engine.finishSetup({ ...setup }, { backup: async () => {} }), code("bad_setup"));
  const other = await crypto.createKeyring(PW);
  await assert.rejects(d.engine.finishSetup(other, { backup: async () => {} }), code("bad_setup"));
  assert.deepEqual(backend.rows(), []);
  // Das echte Objekt lässt sich nicht nachträglich verändern.
  assert.throws(() => { setup.dataKey = other.dataKey; }, TypeError);
  assert.throws(() => { setup.keyring.keyId = "anders"; }, TypeError);
  assert.throws(() => { setup.keyring.byPassword.ct = "anders"; }, TypeError);
  assert.equal(d.engine.state, "unconfigured");
});

// --- Lesen in Seiten ---

test("readAllRows: liest in Seiten, mehr als 1000 Zeilen gehen nicht verloren", async () => {
  const backend = createFakeBackend({ maxRows: 1000 });
  const rows = [];
  for (let i = 0; i < 1200; i++) rows.push({ user_id: A, key: "nook_k" + i, value: i, updated_at: iso(1000 + i) });
  await backend.client("alt").from("kv_store").upsert(rows);
  const capped = await backend.client("x").from("kv_store").select("*").eq("user_id", A);
  assert.equal(capped.data.length, 1000); // die Grenze des Fakes greift

  const d = device(backend, await material());
  assert.equal(await d.engine.start(A), "unconfigured");
  await d.engine.catchUp();
  assert.equal(Object.keys(d.storage.data).length, 1200);
  assert.equal(d.storage.data.nook_k1199, 1199);
});

// --- Nachbesserung Runde 1 ---

test("Einrichtung nach Reset anderswo: zweites Gerät mit klebrigem Merker migriert seine lokalen Daten", async () => {
  const { m, backend } = await cloud();
  const d1 = device(backend, m, { unlocked: true, name: "eins" });
  const d2 = device(backend, m, {
    unlocked: true, name: "zwei",
    storageOpts: { data: { nook_a: "zwei-a", nook_b: { b: 2 } }, meta: { nook_a: 5000, nook_b: 5000 } }
  });
  await d1.engine.start(A);
  await d2.engine.start(A);
  await d2.engine.catchUp(); // lädt hoch: Bestätigungsstand und letzter Abgleich decken die Keys
  assert.equal(d2.storage.mig[A], true);
  assert.ok(d2.storage.last[A] > 0);
  assert.ok(d2.storage.conf[A].nook_a);

  await d1.engine.resetCloud();
  assert.equal(await d2.engine.start(A), "unconfigured");
  assert.equal(d2.storage.mig[A], true); // klebrig: das Gerät hat den Reset nicht selbst ausgelöst

  const setup = await d2.engine.beginSetup(PW2);
  assert.deepEqual(await d2.engine.finishSetup(setup, { backup: async () => {} }), { ok: true });
  for (const [key, value] of [["nook_a", "zwei-a"], ["nook_b", { b: 2 }]]) {
    const row = backend.rows().find((r) => r.user_id === A && r.key === key);
    assert.ok(row, "fehlt in der Cloud: " + key);
    assert.equal(crypto.isEncryptedEnvelope(row.value), true);
    assert.deepEqual(await crypto.decryptValue(setup.dataKey, A, key, row.value), value);
  }
  assert.equal(keyringRow(backend).value.migrationDone, true);
});

test("finishSetup: Merker des Kontos nicht löschbar, Abbruch mit keyring und neu bestimmt", async () => {
  const backend = createFakeBackend();
  const d = device(backend, await material(), { storageOpts: { data: { nook_a: "a" }, meta: { nook_a: 10 }, mig: { [A]: true } } });
  await d.engine.start(A);
  d.storage.clearAccount = () => { throw new Error("Speicher kaputt"); };
  const setup = await d.engine.beginSetup(PW);
  const res = await quiet(() => d.engine.finishSetup(setup, { backup: async () => {} }));
  assert.deepEqual(res, { ok: false, step: "keyring" });
  assert.equal(d.engine.state, "locked"); // Keyring liegt in der Cloud, Schlüssel nicht übernommen
  assert.equal(d.ks.m.has(A), false);
  assert.equal(backend.rows().some((r) => r.key === "nook_a"), false);
});

test("finishSetup: Merker bleibt trotz clearAccount gesetzt, Abbruch mit keyring", async () => {
  const backend = createFakeBackend();
  const d = device(backend, await material(), { storageOpts: { mig: { [A]: true } } });
  await d.engine.start(A);
  d.storage.clearAccount = () => {}; // tut nichts
  const setup = await d.engine.beginSetup(PW);
  const res = await quiet(() => d.engine.finishSetup(setup, { backup: async () => {} }));
  assert.deepEqual(res, { ok: false, step: "keyring" });
  assert.equal(d.engine.state, "locked");
});

test("resetCloud: clearAccount scheitert, kein Erfolg gemeldet", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m, { unlocked: true, storageOpts: { mig: { [A]: true } } });
  await d.engine.start(A);
  d.storage.clearAccount = () => { throw new Error("Speicher kaputt"); };
  await quiet(() => assert.rejects(d.engine.resetCloud(), code("write_failed")));
  assert.equal(d.engine.state, "unconfigured"); // die Cloud ist leer
});

test("unlock: Keyring-Zeile mit leerem Wert ist bad_keyring, nie der Keyring vom Start", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m);
  assert.equal(await d.engine.start(A), "locked");
  await backend.client("anderes").from("kv_store").update({ value: null }).eq("user_id", A).eq("key", KEYRING_KEY);
  await assert.rejects(d.engine.unlock(PW), code("bad_keyring"));
  assert.equal(d.engine.state, "locked");
  assert.equal(d.ks.m.has(A), false);
});

test("resetCloud: Löschen ohne Wirkung (0 Zeilen, kein Fehler) ist write_failed, Schlüssel bleibt", async () => {
  const { m, backend } = await cloud();
  const d = device(backend, m, { unlocked: true, storageOpts: { mig: { [A]: true } } });
  await d.engine.start(A);
  backend.skipNext("delete");
  await quiet(() => assert.rejects(d.engine.resetCloud(), code("write_failed")));
  assert.ok(keyringRow(backend));
  assert.equal(d.ks.m.has(A), true);
  assert.equal(d.storage.mig[A], true);
  assert.equal(d.engine.state, "unlocked");
});

// Client-Hülle: ruft onSelect nach jedem gelungenen Lesen (nicht nach Schreibvorgängen).
function hookClient(backend, onSelect) {
  const inner = backend.client("dieses");
  const writes = ["upsert", "insert", "update", "delete"];
  return {
    from(table) {
      const b = inner.from(table);
      let write = false;
      const w = {};
      for (const name of ["select", "eq", "in", "gt", "order", "range", "limit", "maybeSingle", "single", ...writes]) {
        w[name] = (...a) => { if (writes.includes(name)) write = true; b[name](...a); return w; };
      }
      w.then = (res, rej) => b.then(async (r) => { if (!write && !r.error) await onSelect(r); return r; }).then(res, rej);
      return w;
    }
  };
}

test("readAllRows: gelöschte Zeile mit kleinerem Key zwischen zwei Seiten lässt keine andere aus", async () => {
  const backend = createFakeBackend({ maxRows: 1000 });
  const rows = [];
  const key = (i) => "nook_k" + String(i).padStart(4, "0");
  for (let i = 0; i < 1200; i++) rows.push({ user_id: A, key: key(i), value: i, updated_at: iso(1000 + i) });
  await backend.client("alt").from("kv_store").upsert(rows);
  let deleted = false;
  const client = hookClient(backend, async (r) => {
    if (deleted || !Array.isArray(r.data) || r.data.length !== 500) return;
    deleted = true; // nach der ersten vollen Seite löscht ein anderes Gerät den kleinsten Key
    await backend.client("anderes").from("kv_store").delete().eq("user_id", A).eq("key", key(0));
  });
  const d = device(backend, await material(), { client });
  assert.equal(await d.engine.start(A), "unconfigured");
  await d.engine.catchUp();
  assert.equal(deleted, true);
  for (let i = 1; i < 1200; i++) assert.equal(d.storage.data[key(i)], i, "ausgelassen: " + key(i));
});

test("readAllRows: Zeilengrenze des Servers unter der Seitengröße (100) schneidet nicht ab", async () => {
  const backend = createFakeBackend({ maxRows: 100 });
  const rows = [];
  const key = (i) => "nook_k" + String(i).padStart(4, "0");
  for (let i = 0; i < 1200; i++) rows.push({ user_id: A, key: key(i), value: i, updated_at: iso(1000 + i) });
  await backend.client("alt").from("kv_store").upsert(rows);
  const capped = await backend.client("x").from("kv_store").select("*").eq("user_id", A);
  assert.equal(capped.data.length, 100); // die Grenze des Fakes greift
  const d = device(backend, await material());
  assert.equal(await d.engine.start(A), "unconfigured");
  await d.engine.catchUp();
  assert.equal(Object.keys(d.storage.data).length, 1200);
  for (let i = 0; i < 1200; i++) assert.equal(d.storage.data[key(i)], i, "ausgelassen: " + key(i));
});
