const test = require('node:test');
const assert = require('node:assert');
const { isNewer } = require('../lib/updates.js');

test('neuere Versionen werden erkannt', () => {
  assert.strictEqual(isNewer('v2026.11.2', '2026.11.1'), true);
  assert.strictEqual(isNewer('v2026.12.1', '2026.11.9'), true);
  assert.strictEqual(isNewer('v2027.1.1', '2026.12.9'), true);
});

test('Vergleich ist numerisch', () => {
  assert.strictEqual(isNewer('v2026.11.10', '2026.11.9'), true);
  assert.strictEqual(isNewer('v2026.11.9', '2026.11.10'), false);
});

test('gleiche oder ältere Version ist nicht neuer', () => {
  assert.strictEqual(isNewer('v2026.11.1', '2026.11.1'), false);
  assert.strictEqual(isNewer('2026.11.1', '2026.11.1'), false);
  assert.strictEqual(isNewer('v2026.10.9', '2026.11.1'), false);
});

test('ungültiger Tag ist nicht neuer', () => {
  assert.strictEqual(isNewer('latest', '2026.11.1'), false);
  assert.strictEqual(isNewer('', '2026.11.1'), false);
  assert.strictEqual(isNewer('v2026.11', '2026.11.1'), false);
  assert.strictEqual(isNewer('v2026.11.x', '2026.11.1'), false);
  assert.strictEqual(isNewer(undefined, '2026.11.1'), false);
  assert.strictEqual(isNewer('v2026.11.2', 'kaputt'), false);
});
