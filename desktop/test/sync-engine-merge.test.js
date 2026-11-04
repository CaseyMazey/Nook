"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeBackend } = require("./helpers/fake-sync-backend.js");
const crypto = require("../../js/sync-crypto.js");
const { createSyncEngine, SYNC_KEYRING_KEY: KEYRING_KEY } = require("../../js/sync-engine.js");

const A = "user-a";
const B = "user-b";
const quiet = async (fn) => {
  const orig = console.error; console.error = () => {};
  try { return await fn(); } finally { console.error = orig; }
};
let shared; // Keyring + Schlüssel einmal erzeugen (PBKDF2 ist langsam)
async function material() {
  if (!shared) shared = await crypto.createKeyring("passwort-1234");
  return shared;
}

function makeKeyStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  const removed = [];
  return {
    removed,
    async load(u) { return m.get(u) || null; },
    async save(u, key, keyId) { m.set(u, { key, keyId }); },
    async remove(u) { removed.push(u); m.delete(u); }
  };
}

// In-Memory-Speicher mit der Schnittstelle, die die Engine erwartet. getRaw liefert den geparsten Wert
// (undefined = nicht vorhanden); Keys in `broken` simulieren einen nicht lesbaren Eintrag (wirft).
function makeStorage({ data = {}, meta = {}, last = {}, mig = {}, broken = [] } = {}) {
  const s = {
    data, meta, last, mig, broken, full: false, setRawCalls: [],
    getRaw(k) { if (s.broken.includes(k)) throw new SyntaxError("kaputt"); return s.data[k]; },
    setRaw(k, v) { s.setRawCalls.push(k); if (s.full) return false; s.data[k] = v; return true; },
    getMeta() { return { ...s.meta }; },
    setMeta(m) { for (const k of Object.keys(s.meta)) delete s.meta[k]; Object.assign(s.meta, m); },
    getLastCatchUp(u) { return s.last[u] || 0; },
    setLastCatchUp(u, ts) { s.last[u] = ts; },
    getMigrationDone(u) { return !!s.mig[u]; },
    setMigrationDone(u) { s.migCalls++; s.mig[u] = true; },
    conf: {}, migCalls: 0,
    getConfirmed(u) { return { ...(s.conf[u] || {}) }; },
    setConfirmed(u, m) { s.conf[u] = { ...m }; },
    clearAccount(u) { delete s.mig[u]; delete s.conf[u]; delete s.last[u]; },
    keys() { return Object.keys(s.data); }
  };
  return s;
}

// migrationDone ist hier standardmäßig wahr: sonst setzt start() die Migration fort (Task 4).
// Tests für den Zustand "Migration noch nicht abgeschlossen" nutzen pendingMigration().
async function setup({ userId = A, migrationDone = true, withKeyring = true, storageOpts, state = "unlocked" } = {}) {
  const m = await material();
  const backend = createFakeBackend();
  if (withKeyring) {
    await backend.client("anderes").from("kv_store").insert(
      { user_id: userId, key: KEYRING_KEY, value: { ...m.keyring, migrationDone }, updated_at: new Date(1).toISOString() });
  }
  const ks = makeKeyStore(state === "unlocked" && withKeyring ? { [userId]: { key: m.dataKey, keyId: m.keyring.keyId } } : {});
  const storage = makeStorage(storageOpts);
  const notices = [];
  const engine = createSyncEngine({
    client: backend.client("dieses"), table: "kv_store", storage, keyStore: ks,
    isSyncableKey: (k) => k.startsWith("nook_"),
    onStateChange() {}, onNotice: (code, info) => notices.push([code, info])
  });
  return { engine, backend, storage, ks, notices, m, userId };
}

// Lässt die automatische Fortsetzung beim nächsten start() am letzten Schritt scheitern,
// damit das Gerät unlocked bleibt, während migrationDone noch falsch ist.
function pendingMigration(ctx) {
  ctx.backend.failNext("update");
}

async function putEnc(ctx, key, value, ts) {
  const env = await crypto.encryptValue(ctx.m.dataKey, ctx.userId, key, value);
  await ctx.backend.client("anderes").from("kv_store").upsert(
    { user_id: ctx.userId, key, value: env, updated_at: new Date(ts).toISOString() });
}
async function putRaw(ctx, key, value, ts) {
  await ctx.backend.client("anderes").from("kv_store").upsert(
    { user_id: ctx.userId, key, value, updated_at: new Date(ts).toISOString() });
}
const row = (ctx, key) => ctx.backend.rows().find((r) => r.key === key);
async function decryptRow(ctx, key) {
  return crypto.decryptValue(ctx.m.dataKey, ctx.userId, key, row(ctx, key).value);
}

// Hält die nächste Entschlüsselung offen, bis release() gerufen wird.
function gateDecrypt() {
  const orig = crypto.decryptValue;
  let release; let started;
  const gate = new Promise((r) => { release = r; });
  const startedP = new Promise((r) => { started = r; });
  let used = false;
  crypto.decryptValue = async (...args) => {
    if (!used) { used = true; started(); await gate; }
    return orig(...args);
  };
  return { release, started: startedP, restore() { crypto.decryptValue = orig; } };
}

test("neuer Cloud-Wert wird entschlüsselt übernommen", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_a", { x: 2 }, 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, true);
  assert.deepEqual(ctx.storage.data.nook_a, { x: 2 });
  assert.equal(ctx.storage.meta.nook_a, 2000);
});

test("Echo: gleicher Zeitstempel wird ignoriert", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 2000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_a", 99, 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.equal(ctx.storage.data.nook_a, 1);
  assert.deepEqual(ctx.storage.setRawCalls, []);
});

test("lokal neuer: wird verschlüsselt hochgeladen, nie als Klartext", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: { v: 7 } }, meta: { nook_a: 3000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_a", { v: 1 }, 2000);
  await ctx.engine.catchUp();
  const r = row(ctx, "nook_a");
  assert.equal(crypto.isEncryptedEnvelope(r.value), true);
  assert.deepEqual(await decryptRow(ctx, "nook_a"), { v: 7 });
  assert.equal(new Date(r.updated_at).getTime(), 3000);
  assert.ok(ctx.backend.rows().filter((x) => x.key !== KEYRING_KEY).every((x) => crypto.isEncryptedEnvelope(x.value)));
});

test("Key fehlt in der Cloud: Upload nur, wenn lokaler Zeitstempel neuer als der Merker ist", async () => {
  const ctx = await setup({
    storageOpts: { data: { nook_neu: 1, nook_alt: 2 }, meta: { nook_neu: 5000, nook_alt: 1500 }, last: { [A]: 2000 } }
  });
  await ctx.engine.start(A);
  await ctx.engine.catchUp();
  assert.ok(row(ctx, "nook_neu"));
  assert.equal(row(ctx, "nook_alt"), undefined);
});

test("Merker gilt pro Konto", async () => {
  const opts = { data: { nook_k: 1 }, meta: { nook_k: 1500 }, last: { [A]: 2000 } };
  const a = await setup({ userId: A, storageOpts: opts });
  await a.engine.start(A);
  await a.engine.catchUp();
  assert.equal(row(a, "nook_k"), undefined);
  const b = await setup({ userId: B, storageOpts: { data: { nook_k: 1 }, meta: { nook_k: 1500 }, last: { [A]: 2000 } } });
  await b.engine.start(B);
  await b.engine.catchUp();
  assert.ok(row(b, "nook_k"));
});

test("Speicher voll: Zeitstempel rückt nicht vor, nächster catchUp versucht es erneut", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_a", 2, 2000);
  ctx.storage.full = true;
  const r1 = await ctx.engine.catchUp();
  assert.equal(r1.changed, false);
  assert.equal(ctx.storage.meta.nook_a, 1000);
  assert.equal(ctx.storage.last[A], undefined);
  ctx.storage.full = false;
  const r2 = await ctx.engine.catchUp();
  assert.equal(r2.changed, true);
  assert.equal(ctx.storage.data.nook_a, 2);
  assert.equal(ctx.storage.meta.nook_a, 2000);
});

test("kaputte Zeile: übersprungen, lokaler Wert bleibt, Hinweis ohne Wert, andere Zeilen laufen weiter", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: "lokal" }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_a", "geheim-cloud", 2000);
  const r = row(ctx, "nook_a");
  r.value.ct = r.value.ct.slice(0, -4) + "AAAA";
  await ctx.backend.client("x").from("kv_store").upsert(r);
  await putEnc(ctx, "nook_b", "ok", 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, true);
  assert.equal(ctx.storage.data.nook_a, "lokal");
  assert.equal(ctx.storage.data.nook_b, "ok");
  assert.deepEqual(ctx.notices, [["decrypt_failed", "nook_a"]]);
  assert.equal(JSON.stringify(ctx.notices).includes("geheim"), false);
});

test("fehlerhafter Zeitstempel: Zeile gilt als unlesbar, nicht als neueste", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: "lokal" }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  const env = await crypto.encryptValue(ctx.m.dataKey, A, "nook_a", "cloud");
  await ctx.backend.client("x").from("kv_store").upsert({ user_id: A, key: "nook_a", value: env, updated_at: "kein-datum" });
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.equal(ctx.storage.data.nook_a, "lokal");
  assert.deepEqual(ctx.notices, [["decrypt_failed", "nook_a"]]);
  assert.equal(row(ctx, "nook_a").updated_at, "kein-datum"); // und wird nicht überschrieben
});

test("nicht lesbarer lokaler Eintrag wird übersprungen, ohne Absturz", async () => {
  const ctx = await setup({
    storageOpts: { data: { nook_kaputt: 1, nook_gut: 2 }, meta: { nook_kaputt: 9000, nook_gut: 9000 }, broken: ["nook_kaputt"] }
  });
  await ctx.engine.start(A);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.equal(row(ctx, "nook_kaputt"), undefined);
  assert.ok(row(ctx, "nook_gut"));
  const im = await ctx.engine.initialMerge();
  assert.equal(im.ok, true);
});

test("Keyring-Zeile erreicht nie den Speicher", async () => {
  const ctx = await setup();
  await ctx.engine.start(A);
  await ctx.engine.catchUp();
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.equal(await ctx.engine.applyRemoteRow(row(ctx, KEYRING_KEY)), false);
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.equal(KEYRING_KEY in ctx.storage.data, false);
});

test("catchUp: Upload-Fehler verhindert den Merker, der nächste Lauf holt nach", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 5000 } } });
  await ctx.engine.start(A);
  ctx.backend.failNext("upsert");
  const origErr = console.error; console.error = () => {};
  try { await ctx.engine.catchUp(); } finally { console.error = origErr; }
  assert.equal(ctx.storage.last[A], undefined);
  assert.equal(row(ctx, "nook_a"), undefined);
  await ctx.engine.catchUp();
  assert.ok(row(ctx, "nook_a"));
  assert.ok(ctx.storage.last[A] > 0);
});

test("catchUp wartet auf seine Uploads, bevor der Merker gesetzt wird", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 5000 } } });
  await ctx.engine.start(A);
  const hold = ctx.backend.holdNext("upsert");
  const before = Date.now();
  let done = false;
  const p = ctx.engine.catchUp().then(() => { done = true; });
  await hold.started;
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(done, false);
  assert.equal(ctx.storage.last[A], undefined);
  hold.release();
  await p;
  assert.ok(ctx.storage.last[A] >= before);
  assert.ok(ctx.storage.last[A] <= Date.now());
});

test("catchUp: Zeitstempel veraltet während Entschlüsseln, lokaler Schreibvorgang gewinnt", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: "alt" }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_a", "cloud", 2000);
  const g = gateDecrypt();
  try {
    const p = ctx.engine.catchUp();
    await g.started;
    ctx.storage.data.nook_a = "lokal-neu";
    ctx.storage.meta.nook_a = 3000;
    g.release();
    const res = await p;
    assert.equal(res.changed, false);
    assert.equal(ctx.storage.data.nook_a, "lokal-neu");
    assert.equal(ctx.storage.meta.nook_a, 3000);
  } finally { g.restore(); }
});

test("catchUp: Abmelden während des Entschlüsselns schreibt nichts mehr", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: "alt" }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_a", "cloud", 2000);
  const g = gateDecrypt();
  try {
    const p = ctx.engine.catchUp();
    await g.started;
    ctx.engine.stop();
    g.release();
    const res = await p;
    assert.equal(res.changed, false);
    assert.deepEqual(ctx.storage.setRawCalls, []);
    assert.equal(ctx.storage.last[A], undefined);
  } finally { g.restore(); }
});

test("Keyring weg: catchUp verarbeitet nichts, Schlüssel wird entfernt (unconfigured)", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 5000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_b", "x", 9000);
  await ctx.backend.client("x").from("kv_store").delete().eq("user_id", A).eq("key", KEYRING_KEY);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.equal(ctx.engine.state, "unconfigured");
  assert.deepEqual(ctx.ks.removed, [A]);
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.equal(row(ctx, "nook_a"), undefined);
  assert.equal(ctx.storage.last[A], undefined);
});

test("anderer keyId: catchUp verarbeitet nichts, Zustand wird locked", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 5000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_b", "x", 9000);
  await ctx.backend.client("x").from("kv_store").update({ value: { ...ctx.m.keyring, keyId: "bmV1ZXI=" } })
    .eq("user_id", A).eq("key", KEYRING_KEY);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.equal(ctx.engine.state, "locked");
  assert.deepEqual(ctx.ks.removed, [A]);
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.equal(row(ctx, "nook_a"), undefined);
});

test("unconfigured: nur Klartext wird übernommen, nichts hochgeladen, Umschläge übersprungen", async () => {
  const ctx = await setup({
    withKeyring: false, state: "none",
    storageOpts: { data: { nook_lokal: 1 }, meta: { nook_lokal: 9000 } }
  });
  assert.equal(await ctx.engine.start(A), "unconfigured");
  await putRaw(ctx, "nook_klar", { p: 1 }, 2000);
  const env = await crypto.encryptValue(ctx.m.dataKey, A, "nook_env", "x");
  await putRaw(ctx, "nook_env", env, 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, true);
  assert.deepEqual(ctx.storage.data.nook_klar, { p: 1 });
  assert.equal("nook_env" in ctx.storage.data, false);
  assert.equal(row(ctx, "nook_lokal"), undefined);
  assert.equal(ctx.backend.rows().length, 2);
  assert.deepEqual(ctx.notices, []);
  assert.equal(ctx.storage.last[A], undefined);
});

test("andere Zustände: catchUp liest nicht und liefert changed false, initialMerge ok false", async () => {
  const locked = await setup({ state: "none" });
  assert.equal(await locked.engine.start(A), "locked");
  locked.backend.failNext("select");
  assert.deepEqual(await locked.engine.catchUp(), { changed: false });
  // der eingeplante Lesefehler wurde nicht verbraucht
  const r = await locked.backend.client("x").from("kv_store").select("*").eq("user_id", A);
  assert.ok(r.error);
  assert.deepEqual(await locked.engine.initialMerge(), { ok: false });

  const unconf = await setup({ withKeyring: false, state: "none" });
  await unconf.engine.start(A);
  assert.deepEqual(await unconf.engine.initialMerge(), { ok: false });
});

test("initialMerge: Cloud gewinnt, rein lokale hoch (verschlüsselt), rein entfernte übernommen", async () => {
  const ctx = await setup({
    storageOpts: { data: { nook_both: "lokal", nook_only_local: "L" }, meta: {} }
  });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_both", "cloud", 4000);
  await putEnc(ctx, "nook_only_remote", "R", 5000);
  const res = await ctx.engine.initialMerge();
  assert.deepEqual(res, { ok: true });
  assert.equal(ctx.storage.data.nook_both, "cloud");
  assert.equal(ctx.storage.meta.nook_both, 4000);
  assert.equal(ctx.storage.data.nook_only_remote, "R");
  assert.equal(ctx.storage.meta.nook_only_remote, 5000);
  assert.equal(crypto.isEncryptedEnvelope(row(ctx, "nook_only_local").value), true);
  assert.equal(await decryptRow(ctx, "nook_only_local"), "L");
  assert.ok(ctx.storage.meta.nook_only_local > 0);
  assert.ok(ctx.storage.last[A] > 0);
});

test("initialMerge alles oder nichts: eine kaputte Zeile, nichts wird geschrieben", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_lokal: "L" }, meta: {} } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_gut", "ok", 2000);
  await putEnc(ctx, "nook_schlecht", "x", 2000);
  const r = row(ctx, "nook_schlecht");
  r.value.ct = r.value.ct.slice(0, -4) + "AAAA";
  await ctx.backend.client("x").from("kv_store").upsert(r);
  const res = await ctx.engine.initialMerge();
  assert.deepEqual(res, { ok: false });
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.deepEqual(ctx.storage.meta, {});
  assert.equal(row(ctx, "nook_lokal"), undefined);
  assert.equal(ctx.storage.last[A], undefined);
  assert.deepEqual(ctx.notices, [["decrypt_failed", "nook_schlecht"]]);
});

test("initialMerge: Abmelden während des Entschlüsselns schreibt nichts", async () => {
  const ctx = await setup({ storageOpts: { data: {}, meta: {} } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_a", "cloud", 2000);
  const g = gateDecrypt();
  try {
    const p = ctx.engine.initialMerge();
    await g.started;
    ctx.engine.stop();
    g.release();
    assert.deepEqual(await p, { ok: false });
    assert.deepEqual(ctx.storage.setRawCalls, []);
  } finally { g.restore(); }
});

test("Klartext nach Migration: nicht übernommen, mit lokalem Wert verschlüsselt ersetzt, sonst Hinweis", async () => {
  const ctx = await setup({
    migrationDone: true,
    storageOpts: { data: { nook_mit: "lokal" }, meta: { nook_mit: 1000 } }
  });
  await ctx.engine.start(A);
  await putRaw(ctx, "nook_mit", "klartext-alt-client", 2000);
  await putRaw(ctx, "nook_ohne", "klartext-2", 2000);
  const before = Date.now();
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.equal(ctx.storage.data.nook_mit, "lokal");
  assert.equal(crypto.isEncryptedEnvelope(row(ctx, "nook_mit").value), true);
  assert.equal(await decryptRow(ctx, "nook_mit"), "lokal");
  const ts = new Date(row(ctx, "nook_mit").updated_at).getTime();
  assert.ok(ts >= before);
  assert.equal(ctx.storage.meta.nook_mit, ts);
  assert.equal(row(ctx, "nook_ohne").value, "klartext-2");
  assert.deepEqual(ctx.notices, [["plaintext_row", "nook_ohne"]]);
});

test("Klartext nach Migration über Realtime: nicht übernommen", async () => {
  const ctx = await setup({ migrationDone: true, storageOpts: { data: { nook_a: "lokal" }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  const applied = await ctx.engine.applyRemoteRow(
    { user_id: A, key: "nook_a", value: "klartext", updated_at: new Date(2000).toISOString() });
  await ctx.engine.flush();
  assert.equal(applied, false);
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.equal(await decryptRow(ctx, "nook_a"), "lokal");
});

test("initialMerge: Klartext nach Migration wird nicht übernommen", async () => {
  const ctx = await setup({ migrationDone: true, storageOpts: { data: { nook_a: "lokal" }, meta: {} } });
  await ctx.engine.start(A);
  await putRaw(ctx, "nook_a", "klartext", 2000);
  await putRaw(ctx, "nook_b", "klartext", 2000);
  const res = await ctx.engine.initialMerge();
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.equal(await decryptRow(ctx, "nook_a"), "lokal");
  assert.deepEqual(ctx.notices, [["plaintext_row", "nook_b"]]);
});

test("Klartext vor Abschluss der Migration wird angenommen", async () => {
  const ctx = await setup({ migrationDone: false, storageOpts: { data: {}, meta: {} } });
  pendingMigration(ctx);
  await quiet(() => ctx.engine.start(A)); // die gewollt scheiternde Fortsetzung loggt
  await putRaw(ctx, "nook_a", { alt: true }, 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, true);
  assert.deepEqual(ctx.storage.data.nook_a, { alt: true });
});

test("Merker für Migration ist klebrig: ein zurückgesetzter Keyring öffnet den Klartext nicht wieder", async () => {
  const ctx = await setup({ migrationDone: true, storageOpts: { data: {}, meta: {} } });
  await ctx.engine.start(A);
  await ctx.engine.catchUp();
  assert.equal(ctx.storage.mig[A], true);
  await ctx.backend.client("x").from("kv_store").update({ value: { ...ctx.m.keyring, migrationDone: false } })
    .eq("user_id", A).eq("key", KEYRING_KEY);
  await putRaw(ctx, "nook_a", "klartext", 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.deepEqual(ctx.notices, [["plaintext_row", "nook_a"]]);
});

test("lokaler Merker allein genügt (Neustart mit Keyring ohne migrationDone)", async () => {
  const ctx = await setup({ migrationDone: false, storageOpts: { data: {}, meta: {}, mig: { [A]: true } } });
  await ctx.engine.start(A);
  await putRaw(ctx, "nook_a", "klartext", 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.deepEqual(ctx.storage.setRawCalls, []);
});

test("applyRemoteRow: übernimmt Neueres, ignoriert Echo und Fremd-Keys", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  const env = await crypto.encryptValue(ctx.m.dataKey, A, "nook_a", { z: 1 });
  const mk = (key, value, ts) => ({ user_id: A, key, value, updated_at: new Date(ts).toISOString() });
  assert.equal(await ctx.engine.applyRemoteRow(mk("nook_a", env, 1000)), false);
  assert.equal(await ctx.engine.applyRemoteRow(mk("fremd", env, 5000)), false);
  assert.equal(await ctx.engine.applyRemoteRow(mk("nook_a", env, 2000)), true);
  assert.deepEqual(ctx.storage.data.nook_a, { z: 1 });
  assert.equal(ctx.storage.meta.nook_a, 2000);
});

test("applyRemoteRow: kaputter Umschlag meldet Hinweis, lokaler Wert bleibt", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  const env = await crypto.encryptValue(ctx.m.dataKey, A, "nook_andere", 5); // falscher Key im AAD
  const ok = await ctx.engine.applyRemoteRow({ user_id: A, key: "nook_a", value: env, updated_at: new Date(2000).toISOString() });
  assert.equal(ok, false);
  assert.equal(ctx.storage.data.nook_a, 1);
  assert.deepEqual(ctx.notices, [["decrypt_failed", "nook_a"]]);
});

test("applyRemoteRow: lokaler Schreibvorgang während des Entschlüsselns gewinnt", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: "alt" }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  const env = await crypto.encryptValue(ctx.m.dataKey, A, "nook_a", "cloud");
  const g = gateDecrypt();
  try {
    const p = ctx.engine.applyRemoteRow({ user_id: A, key: "nook_a", value: env, updated_at: new Date(2000).toISOString() });
    await g.started;
    ctx.storage.data.nook_a = "lokal-neu";
    ctx.storage.meta.nook_a = 3000;
    g.release();
    assert.equal(await p, false);
    assert.equal(ctx.storage.data.nook_a, "lokal-neu");
    assert.equal(ctx.storage.meta.nook_a, 3000);
  } finally { g.restore(); }
});

test("applyRemoteRow: Abmelden während des Entschlüsselns schreibt nichts", async () => {
  const ctx = await setup({ storageOpts: { data: {}, meta: {} } });
  await ctx.engine.start(A);
  const env = await crypto.encryptValue(ctx.m.dataKey, A, "nook_a", "cloud");
  const g = gateDecrypt();
  try {
    const p = ctx.engine.applyRemoteRow({ user_id: A, key: "nook_a", value: env, updated_at: new Date(2000).toISOString() });
    await g.started;
    ctx.engine.stop();
    g.release();
    assert.equal(await p, false);
    assert.deepEqual(ctx.storage.setRawCalls, []);
  } finally { g.restore(); }
});

// --- Fix-Runde 1 ---

test("Live-Upload, anderswo gelöscht: catchUp lädt den Key nicht wieder hoch, auch nicht nach Neustart", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 5000 } } });
  await ctx.engine.start(A);
  ctx.engine.notifyLocalWrite("nook_a", "1", 5000);
  await ctx.engine.flush();
  assert.ok(row(ctx, "nook_a"));
  await ctx.backend.client("x").from("kv_store").delete().eq("user_id", A).eq("key", "nook_a");
  await ctx.engine.catchUp();
  assert.equal(row(ctx, "nook_a"), undefined);

  // Neustart: neue Engine, gleicher Speicher; der Merker hilft hier nicht
  ctx.storage.last = {};
  const engine2 = createSyncEngine({
    client: ctx.backend.client("dieses"), table: "kv_store", storage: ctx.storage, keyStore: ctx.ks,
    isSyncableKey: (k) => k.startsWith("nook_"), onStateChange() {}, onNotice() {}
  });
  await engine2.start(A);
  await engine2.catchUp();
  assert.equal(row(ctx, "nook_a"), undefined);

  // Nach dem Löschen lokal neu geschrieben: wird wieder hochgeladen
  ctx.storage.meta.nook_a = 9000;
  ctx.storage.data.nook_a = 2;
  ctx.storage.last = {};
  await engine2.catchUp();
  assert.ok(row(ctx, "nook_a"));
  assert.equal(await decryptRow(ctx, "nook_a"), 2);
});

test("Klartext trotz klebrigem Merker: auch in unconfigured nicht übernommen (catchUp und Realtime)", async () => {
  const ctx = await setup({
    withKeyring: false, state: "none",
    storageOpts: { data: { nook_a: "lokal" }, meta: { nook_a: 1000 }, mig: { [A]: true } }
  });
  assert.equal(await ctx.engine.start(A), "unconfigured");
  await putRaw(ctx, "nook_a", "INJECTED", 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.equal(ctx.storage.data.nook_a, "lokal");
  assert.equal(await ctx.engine.applyRemoteRow(row(ctx, "nook_a")), false);
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.deepEqual(ctx.notices, [["plaintext_row", "nook_a"], ["plaintext_row", "nook_a"]]);
  assert.equal(row(ctx, "nook_a").value, "INJECTED"); // nichts hochgeladen
  assert.equal(ctx.storage.meta.nook_a, 1000);
});

test("unconfigured, aber Keyring im eigenen Lesen: neu bestimmen, bevor Zeilen verarbeitet werden", async () => {
  const ctx = await setup({ withKeyring: false, state: "none", storageOpts: { data: {}, meta: {} } });
  assert.equal(await ctx.engine.start(A), "unconfigured");
  await ctx.backend.client("anderes").from("kv_store").insert(
    { user_id: A, key: KEYRING_KEY, value: ctx.m.keyring, updated_at: new Date(1).toISOString() });
  await putRaw(ctx, "nook_p", "klartext", 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.equal(ctx.engine.state, "locked");
  assert.deepEqual(ctx.storage.setRawCalls, []);
});

test("Umschlag-Eigenschaft ohne gültigen v1-Umschlag gilt als unlesbar, nie als Klartext", async () => {
  const ctx = await setup({ migrationDone: false, storageOpts: { data: { nook_a: "l", nook_b: "l" }, meta: { nook_a: 1, nook_b: 1 } } });
  pendingMigration(ctx);
  await quiet(() => ctx.engine.start(A)); // die gewollt scheiternde Fortsetzung loggt
  await putRaw(ctx, "nook_a", { __nook_enc: 2, iv: "x", ct: "y" }, 2000);
  await putRaw(ctx, "nook_b", { __nook_enc: 1 }, 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(res.changed, false);
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.deepEqual(ctx.notices.map((n) => n[0]), ["decrypt_failed", "decrypt_failed"]);
  assert.equal(await ctx.engine.applyRemoteRow(row(ctx, "nook_a")), false);
  assert.deepEqual(ctx.storage.setRawCalls, []);
});

test("Re-Resolve in catchUp: nach Erfolg läuft catchUp noch einmal (einmal, ohne Schleife)", async () => {
  const ctx = await setup({ migrationDone: false, storageOpts: { data: {}, meta: {} } });
  pendingMigration(ctx);
  await quiet(() => ctx.engine.start(A)); // die gewollt scheiternde Fortsetzung loggt
  await ctx.backend.client("x").from("kv_store").delete().eq("user_id", A).eq("key", KEYRING_KEY);
  await putRaw(ctx, "nook_p", { p: 1 }, 2000);
  const res = await ctx.engine.catchUp();
  assert.equal(ctx.engine.state, "unconfigured");
  assert.equal(res.changed, true);
  assert.deepEqual(ctx.storage.data.nook_p, { p: 1 });
});

test("migrationDone schreibt den lokalen Merker nur einmal", async () => {
  const ctx = await setup({ migrationDone: true, storageOpts: { data: {}, meta: {} } });
  await ctx.engine.start(A);
  await putRaw(ctx, "nook_a", "k", 2000);
  await ctx.engine.catchUp();
  await ctx.engine.catchUp();
  await ctx.engine.applyRemoteRow(row(ctx, "nook_a"));
  assert.equal(ctx.storage.migCalls, 1);
});

test("in catchUp gesehene Zeile zählt als bestätigt: danach anderswo gelöscht, bleibt weg", async () => {
  const ctx = await setup({ storageOpts: { data: { nook_a: 1 }, meta: { nook_a: 2000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_a", 1, 2000);
  await ctx.engine.catchUp();
  await ctx.backend.client("x").from("kv_store").delete().eq("user_id", A).eq("key", "nook_a");
  ctx.storage.last = {};
  await ctx.engine.catchUp();
  assert.equal(row(ctx, "nook_a"), undefined);
});

// --- Nachbesserung nach Gesamt-Review: Realtime-Zeilen ohne Wert ---
// Realtime lässt bei zu großen Zeilen die Feldwerte weg. So eine Zeile ist nie Klartext:
// nicht übernommen, nicht neu hochgeladen, Speicher und Cloud bleiben unverändert.
function valueless(key, ts) {
  return [
    { user_id: A, key, updated_at: new Date(ts).toISOString() },                  // Feld fehlt ganz
    { user_id: A, key, value: undefined, updated_at: new Date(ts).toISOString() } // Feld da, aber ohne Wert
  ];
}
async function assertValuelessIgnored(ctx) {
  const cloudBefore = ctx.backend.rows();
  const metaBefore = { ...ctx.storage.meta };
  const dataBefore = JSON.stringify(ctx.storage.data);
  for (const r of valueless("nook_a", 5000)) {
    assert.equal(await ctx.engine.applyRemoteRow(r), false);
  }
  await ctx.engine.flush();
  assert.deepEqual(ctx.storage.setRawCalls, []);
  assert.equal(JSON.stringify(ctx.storage.data), dataBefore);
  assert.deepEqual(ctx.storage.meta, metaBefore);
  assert.deepEqual(ctx.backend.rows(), cloudBefore);
  assert.deepEqual(ctx.notices, []);
}

test("Realtime-Zeile ohne Wert nach der Migration: ignoriert, kein neuer Upload", async () => {
  const ctx = await setup({ migrationDone: true, storageOpts: { data: { nook_a: "lokal" }, meta: { nook_a: 1000 } } });
  await ctx.engine.start(A);
  await putEnc(ctx, "nook_a", "lokal", 1000);
  await assertValuelessIgnored(ctx);
});

test("Realtime-Zeile ohne Wert vor der Migration: ignoriert, nie als Klartext übernommen", async () => {
  const ctx = await setup({ migrationDone: false, storageOpts: { data: { nook_a: "lokal" }, meta: { nook_a: 1000 } } });
  pendingMigration(ctx);
  await quiet(() => ctx.engine.start(A)); // die gewollt scheiternde Fortsetzung loggt
  assert.equal(ctx.engine.state, "unlocked");
  await assertValuelessIgnored(ctx);
});

test("Realtime-Zeile ohne Wert in unconfigured: ignoriert", async () => {
  const ctx = await setup({ withKeyring: false, state: "none", storageOpts: { data: { nook_a: "lokal" }, meta: { nook_a: 1000 } } });
  assert.equal(await ctx.engine.start(A), "unconfigured");
  await assertValuelessIgnored(ctx);
});

// Liefert eine gelesene Zeile ohne Wert (wie eine gekürzte Zeile), damit auch catchUp sie sieht.
function stripValueClient(backend, key) {
  const inner = backend.client("dieses");
  return {
    from(table) {
      const b = inner.from(table);
      const w = {};
      for (const name of ["select", "eq", "in", "gt", "order", "range", "limit", "maybeSingle", "single", "upsert", "insert", "update", "delete"]) {
        w[name] = (...a) => { b[name](...a); return w; };
      }
      w.then = (res, rej) => b.then((r) => {
        if (Array.isArray(r.data)) for (const row of r.data) if (row.key === key) delete row.value;
        return r;
      }).then(res, rej);
      return w;
    }
  };
}

test("catchUp: Zeile ohne Wert gilt als unlesbar, nie als Klartext (vor und nach der Migration)", async () => {
  for (const migrationDone of [false, true]) {
    const m = await material();
    const backend = createFakeBackend();
    await backend.client("anderes").from("kv_store").insert(
      { user_id: A, key: KEYRING_KEY, value: { ...m.keyring, migrationDone }, updated_at: new Date(1).toISOString() });
    const env = await crypto.encryptValue(m.dataKey, A, "nook_a", "neu");
    await backend.client("anderes").from("kv_store").upsert(
      { user_id: A, key: "nook_a", value: env, updated_at: new Date(5000).toISOString() });
    if (!migrationDone) backend.failNext("update");
    const storage = makeStorage({ data: { nook_a: "lokal" }, meta: { nook_a: 1000 } });
    const notices = [];
    const engine = createSyncEngine({
      client: stripValueClient(backend, "nook_a"), table: "kv_store", storage,
      keyStore: makeKeyStore({ [A]: { key: m.dataKey, keyId: m.keyring.keyId } }),
      isSyncableKey: (k) => k.startsWith("nook_"), onNotice: (c, i) => notices.push([c, i])
    });
    await quiet(() => engine.start(A));
    assert.equal(engine.state, "unlocked");
    const cloudBefore = backend.rows();
    await engine.catchUp();
    await engine.flush();
    assert.deepEqual(storage.setRawCalls, [], "migrationDone=" + migrationDone);
    assert.equal(storage.data.nook_a, "lokal");
    assert.equal(storage.meta.nook_a, 1000);
    assert.deepEqual(backend.rows(), cloudBefore);
    assert.ok(!notices.some((n) => n[0] === "plaintext_row"));
  }
});
