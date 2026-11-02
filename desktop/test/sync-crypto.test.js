const test = require('node:test');
const assert = require('node:assert');
const C = require('../../js/sync-crypto.js');

const subtle = globalThis.crypto.subtle;
const PW = 'correct horse battery';

// Fixture einmal erzeugen (PBKDF2 mit 600000 Iterationen ist langsam)
let fixture;
async function fx() {
  if (!fixture) fixture = await C.createKeyring(PW);
  return fixture;
}

test('syncCryptoAvailable meldet true, wenn crypto.subtle da ist', () => {
  assert.strictEqual(C.syncCryptoAvailable(), true);
});

test('isEncryptedEnvelope erkennt nur gültige Hüllen', () => {
  assert.strictEqual(C.isEncryptedEnvelope({ __nook_enc: 1, iv: 'a', ct: 'b' }), true);
  assert.strictEqual(C.isEncryptedEnvelope({ iv: 'a', ct: 'b' }), false);
  assert.strictEqual(C.isEncryptedEnvelope({ __nook_enc: 1, iv: 'a' }), false);
  assert.strictEqual(C.isEncryptedEnvelope(null), false);
  assert.strictEqual(C.isEncryptedEnvelope('x'), false);
  assert.strictEqual(C.isEncryptedEnvelope([]), false);
});

test('Parameter und Aufbau des Keyrings', async () => {
  const { keyring, recoveryKey } = await fx();
  assert.strictEqual(keyring.v, 1);
  assert.strictEqual(keyring.kdf.name, 'PBKDF2');
  assert.strictEqual(keyring.kdf.hash, 'SHA-256');
  assert.strictEqual(keyring.kdf.iterations, 600000);
  assert.strictEqual(Buffer.from(keyring.kdf.salt, 'base64').length, 16);
  assert.strictEqual(Buffer.from(keyring.keyId, 'base64').length, 16);
  assert.strictEqual(keyring.migrationDone, false);
  assert.ok(keyring.byPassword.iv && keyring.byPassword.ct);
  assert.ok(keyring.byRecovery.iv && keyring.byRecovery.ct);
  assert.match(recoveryKey, /^([A-Z2-7]{4}-){12}[A-Z2-7]{4}$/);
});

test('round trip, Hülle verrät weder Key noch Wert', async () => {
  const { dataKey } = await fx();
  const env = await C.encryptValue(dataKey, 'u', 'tasks', { a: 1, t: 'geheimwert äöü' });
  assert.strictEqual(env.__nook_enc, 1);
  assert.strictEqual(C.isEncryptedEnvelope(env), true);
  const json = JSON.stringify(env);
  assert.ok(!json.includes('tasks'));
  assert.ok(!json.includes('geheimwert'));
  assert.deepStrictEqual(await C.decryptValue(dataKey, 'u', 'tasks', env), { a: 1, t: 'geheimwert äöü' });
});

test('große Werte und Nicht-ASCII laufen hin und zurück', async () => {
  const { dataKey } = await fx();
  const big = { s: 'ü€😀'.repeat(200000) };
  const env = await C.encryptValue(dataKey, 'u', 'k', big);
  assert.deepStrictEqual(await C.decryptValue(dataKey, 'u', 'k', env), big);
});

test('gleicher Wert ergibt neuen IV und anderen Chiffretext', async () => {
  const { dataKey } = await fx();
  const a = await C.encryptValue(dataKey, 'u', 'k', 1);
  const b = await C.encryptValue(dataKey, 'u', 'k', 1);
  assert.notStrictEqual(a.iv, b.iv);
  assert.notStrictEqual(a.ct, b.ct);
});

test('vertauschte Zeile scheitert mit decrypt_failed', async () => {
  const { dataKey } = await fx();
  const env = await C.encryptValue(dataKey, 'u', 'tasks', 1);
  for (const [u, k] of [['u', 'events'], ['other', 'tasks']]) {
    await assert.rejects(C.decryptValue(dataKey, u, k, env), (e) => e instanceof C.SyncCryptoError && e.code === 'decrypt_failed');
  }
});

test('manipulierter Chiffretext scheitert mit decrypt_failed', async () => {
  const { dataKey } = await fx();
  const env = await C.encryptValue(dataKey, 'u', 'k', 'x');
  const raw = Buffer.from(env.ct, 'base64');
  raw[0] ^= 1;
  const bad = { ...env, ct: raw.toString('base64') };
  await assert.rejects(C.decryptValue(dataKey, 'u', 'k', bad), (e) => e.code === 'decrypt_failed');
  await assert.rejects(C.decryptValue(dataKey, 'u', 'k', { __nook_enc: 1, iv: '!!', ct: '??' }), (e) => e.code === 'decrypt_failed');
});

test('falsches Passwort wirft wrong_secret', async () => {
  const { keyring } = await fx();
  await assert.rejects(C.unlockWithPassword(keyring, 'falsch'), (e) => e instanceof C.SyncCryptoError && e.code === 'wrong_secret');
});

test('Passwort entsperrt denselben Schlüssel', async () => {
  const { keyring, dataKey } = await fx();
  const k = await C.unlockWithPassword(keyring, PW);
  const env = await C.encryptValue(dataKey, 'u', 'k', { z: 1 });
  assert.deepStrictEqual(await C.decryptValue(k, 'u', 'k', env), { z: 1 });
});

test('Wiederherstellungsschlüssel entsperrt denselben Schlüssel, tolerant beim Einlesen', async () => {
  const { keyring, dataKey, recoveryKey } = await fx();
  const env = await C.encryptValue(dataKey, 'u', 'k', 'v');
  const messy = recoveryKey.toLowerCase().replace(/-/g, '  ');
  for (const input of [recoveryKey, messy]) {
    const k = await C.unlockWithRecoveryKey(keyring, input);
    assert.strictEqual(await C.decryptValue(k, 'u', 'k', env), 'v');
  }
  await assert.rejects(C.unlockWithRecoveryKey(keyring, 'AAAA-BBBB'), (e) => e.code === 'wrong_secret');
  await assert.rejects(C.unlockWithRecoveryKey(keyring, '1!?'), (e) => e.code === 'wrong_secret');
});

test('Passwortwechsel: altes scheitert, neues geht, byRecovery und keyId gleich, neues Salt', async () => {
  const { keyring, recoveryKey, dataKey } = await fx();
  const ext = await C.unlockWithPassword(keyring, PW, true);
  const next = await C.rewrapKeyring(keyring, ext, 'neues passwort');
  assert.deepStrictEqual(next.byRecovery, keyring.byRecovery);
  assert.strictEqual(next.keyId, keyring.keyId);
  assert.strictEqual(next.migrationDone, keyring.migrationDone);
  assert.notStrictEqual(next.kdf.salt, keyring.kdf.salt);
  await assert.rejects(C.unlockWithPassword(next, PW), (e) => e.code === 'wrong_secret');
  const k = await C.unlockWithPassword(next, 'neues passwort');
  const env = await C.encryptValue(dataKey, 'u', 'k', 5);
  assert.strictEqual(await C.decryptValue(k, 'u', 'k', env), 5);
  await C.unlockWithRecoveryKey(next, recoveryKey);
});

test('Extrahierbarkeit: Standard nicht, auf Wunsch ja', async () => {
  const { keyring, dataKey } = await fx();
  await assert.rejects(subtle.exportKey('raw', dataKey));
  const k = await C.unlockWithPassword(keyring, PW);
  await assert.rejects(subtle.exportKey('raw', k));
  const e = await C.unlockWithPassword(keyring, PW, true);
  assert.strictEqual((await subtle.exportKey('raw', e)).byteLength, 32);
});
