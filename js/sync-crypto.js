// sync-crypto.js – Kryptografie-Bausteine für die Ende-zu-Ende-Verschlüsselung des Geräte-Syncs.
// Reine Krypto: kein DOM, kein Supabase, kein DB-Zugriff. Wird per <script> geladen
// und in Node-Tests per require(). Spec: docs/superpowers/specs/2026-11-02-sync-e2ee-design.md
// Mindestlänge des Passworts prüft die Sync-Engine, nicht diese Datei.
(function () {
  "use strict";

  const KDF_ITERATIONS = 600000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const KEY_ID_BYTES = 16;
  const RECOVERY_BYTES = 32;
  const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  class SyncCryptoError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = "SyncCryptoError";
      this.code = code;
    }
  }

  function subtle() { return globalThis.crypto.subtle; }
  function randomBytes(n) { return globalThis.crypto.getRandomValues(new Uint8Array(n)); }

  // --- Base64 (blockweise, damit große Eingaben keinen Stack sprengen) ---
  function toB64(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let bin = "";
    for (let i = 0; i < u8.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function fromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // --- Base32 für den Wiederherstellungsschlüssel ---
  function toBase32(bytes) {
    let bits = 0, acc = 0, out = "";
    for (const b of bytes) {
      acc = (acc << 8) | b;
      bits += 8;
      while (bits >= 5) {
        out += BASE32[(acc >>> (bits - 5)) & 31];
        bits -= 5;
      }
      acc &= (1 << bits) - 1;
    }
    if (bits > 0) out += BASE32[(acc << (5 - bits)) & 31];
    return out;
  }
  function fromBase32(str) {
    let bits = 0, acc = 0;
    const out = [];
    for (const ch of str) {
      const v = BASE32.indexOf(ch);
      if (v < 0) return null;
      acc = (acc << 5) | v;
      bits += 5;
      if (bits >= 8) {
        out.push((acc >>> (bits - 8)) & 255);
        bits -= 8;
      }
      acc &= (1 << bits) - 1;
    }
    return new Uint8Array(out);
  }
  function formatRecoveryKey(bytes) {
    return toBase32(bytes).match(/.{1,4}/g).join("-");
  }
  function parseRecoveryKey(text) {
    const clean = String(text || "").replace(/[\s-]+/g, "").toUpperCase();
    const bytes = fromBase32(clean);
    return bytes && bytes.length === RECOVERY_BYTES ? bytes : null;
  }

  // --- AES-GCM-Helfer ---
  const enc = (s) => new TextEncoder().encode(s);

  async function aesEncrypt(key, plain, aad) {
    const iv = randomBytes(IV_BYTES);
    const ct = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: enc(aad) }, key, plain);
    return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
  }
  function aesDecrypt(key, box, aad) {
    return subtle().decrypt(
      { name: "AES-GCM", iv: fromB64(box.iv), additionalData: enc(aad) }, key, fromB64(box.ct));
  }
  function importAes(raw, extractable, usages) {
    return subtle().importKey("raw", raw, "AES-GCM", extractable, usages);
  }

  async function deriveKek(password, saltB64, iterations) {
    const base = await subtle().importKey("raw", enc(password), "PBKDF2", false, ["deriveKey"]);
    return subtle().deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  function isBox(b) { return !!b && typeof b.iv === "string" && typeof b.ct === "string"; }

  // Der Keyring kommt aus der Cloud und ist unauthentifiziert: Parameter prüfen, bevor sie benutzt werden.
  function assertKeyring(keyring) {
    const bad = () => new SyncCryptoError("bad_keyring", "Keyring ist ungültig");
    try {
      const k = keyring, kdf = k && k.kdf;
      if (!k || k.v !== 1 || typeof k.keyId !== "string" || !kdf) throw bad();
      if (kdf.name !== "PBKDF2" || kdf.hash !== "SHA-256" || kdf.iterations !== KDF_ITERATIONS) throw bad();
      if (typeof kdf.salt !== "string" || fromB64(kdf.salt).length !== SALT_BYTES) throw bad();
      if (!isBox(k.byPassword) || !isBox(k.byRecovery)) throw bad();
      fromB64(k.keyId);
      fromB64(k.byPassword.iv); fromB64(k.byPassword.ct);
      fromB64(k.byRecovery.iv); fromB64(k.byRecovery.ct);
    } catch (e) {
      throw e instanceof SyncCryptoError ? e : bad();
    }
  }

  const keyringAad = (keyId) => "nook-keyring:v1:" + keyId;

  async function unwrap(kek, box, keyId, extractable) {
    let raw;
    try {
      raw = await aesDecrypt(kek, box, keyringAad(keyId));
    } catch (e) {
      throw new SyncCryptoError("wrong_secret", "Falsches Passwort oder falscher Wiederherstellungsschlüssel");
    }
    try {
      return await importAes(raw, !!extractable, ["encrypt", "decrypt"]);
    } catch (e) {
      throw new SyncCryptoError("bad_keyring", "Gewickelter Schlüssel ist ungültig");
    }
  }

  // --- Öffentliche Funktionen ---
  function syncCryptoAvailable() {
    return !!(globalThis.crypto && globalThis.crypto.subtle && typeof globalThis.crypto.getRandomValues === "function");
  }

  function isEncryptedEnvelope(value) {
    return !!value && typeof value === "object" && !Array.isArray(value) &&
      value.__nook_enc === 1 && typeof value.iv === "string" && typeof value.ct === "string";
  }

  async function createKeyring(password) {
    const rawKey = randomBytes(32);
    const recoveryBytes = randomBytes(RECOVERY_BYTES);
    const keyId = toB64(randomBytes(KEY_ID_BYTES));
    const salt = toB64(randomBytes(SALT_BYTES));
    const kek = await deriveKek(password, salt, KDF_ITERATIONS);
    const recoveryKek = await importAes(recoveryBytes, false, ["encrypt", "decrypt"]);
    const aad = keyringAad(keyId);
    const keyring = {
      v: 1,
      keyId,
      kdf: { name: "PBKDF2", hash: "SHA-256", iterations: KDF_ITERATIONS, salt },
      byPassword: await aesEncrypt(kek, rawKey, aad),
      byRecovery: await aesEncrypt(recoveryKek, rawKey, aad),
      migrationDone: false
    };
    const dataKey = await importAes(rawKey, false, ["encrypt", "decrypt"]);
    return { keyring, dataKey, recoveryKey: formatRecoveryKey(recoveryBytes) };
  }

  async function unlockWithPassword(keyring, password, extractable = false) {
    assertKeyring(keyring);
    const kek = await deriveKek(password, keyring.kdf.salt, keyring.kdf.iterations);
    return unwrap(kek, keyring.byPassword, keyring.keyId, extractable);
  }

  async function unlockWithRecoveryKey(keyring, recoveryKey, extractable = false) {
    assertKeyring(keyring);
    const bytes = parseRecoveryKey(recoveryKey);
    if (!bytes) throw new SyncCryptoError("wrong_secret", "Ungültiger Wiederherstellungsschlüssel");
    const kek = await importAes(bytes, false, ["decrypt"]);
    return unwrap(kek, keyring.byRecovery, keyring.keyId, extractable);
  }

  // Wickelt den Datenschlüssel unter einem neuen Passwort neu (neues Salt); byRecovery und keyId bleiben.
  async function rewrapKeyring(keyring, extractableDataKey, newPassword) {
    assertKeyring(keyring);
    const rawKey = new Uint8Array(await subtle().exportKey("raw", extractableDataKey));
    const salt = toB64(randomBytes(SALT_BYTES));
    const kek = await deriveKek(newPassword, salt, KDF_ITERATIONS);
    return Object.assign({}, keyring, {
      kdf: { name: "PBKDF2", hash: "SHA-256", iterations: KDF_ITERATIONS, salt },
      byPassword: await aesEncrypt(kek, rawKey, keyringAad(keyring.keyId))
    });
  }

  const kvAad = (userId, key) => "nook-kv:v1:" + userId + ":" + key;

  async function encryptValue(dataKey, userId, key, value) {
    const box = await aesEncrypt(dataKey, enc(JSON.stringify(value)), kvAad(userId, key));
    return { __nook_enc: 1, iv: box.iv, ct: box.ct };
  }

  async function decryptValue(dataKey, userId, key, envelope) {
    try {
      const plain = await aesDecrypt(dataKey, envelope, kvAad(userId, key));
      return JSON.parse(new TextDecoder().decode(plain));
    } catch (e) {
      throw new SyncCryptoError("decrypt_failed", "Wert konnte nicht entschlüsselt werden");
    }
  }

  const api = {
    SyncCryptoError, syncCryptoAvailable, isEncryptedEnvelope, createKeyring,
    unlockWithPassword, unlockWithRecoveryKey, rewrapKeyring, encryptValue, decryptValue
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(globalThis, api);
})();
