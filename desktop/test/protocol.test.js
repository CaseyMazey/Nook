const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { resolveAppPath } = require('../lib/protocol');

const R = path.resolve('/tmp/nook-root');

test('Wurzel liefert index.html', () => {
  assert.strictEqual(resolveAppPath(R, 'app://nook/'), path.join(R, 'index.html'));
});

test('Query-String wird ignoriert', () => {
  assert.strictEqual(resolveAppPath(R, 'app://nook/js/main.js?x=1'), path.join(R, 'js', 'main.js'));
});

test('Prozent-Kodierung wird dekodiert', () => {
  assert.strictEqual(
    resolveAppPath(R, 'app://nook/games/%C3%A4%20b/x.js'),
    path.join(R, 'games', 'ä b', 'x.js')
  );
});

test('Pfadausbruch wird abgelehnt', () => {
  assert.strictEqual(resolveAppPath(R, 'app://nook/../../secret'), null);
  assert.strictEqual(resolveAppPath(R, 'app://nook/%2e%2e/secret'), null);
  assert.strictEqual(resolveAppPath(R, 'app://nook/..%5Csecret'), null);
  assert.strictEqual(resolveAppPath(R, 'app://nook/%2e%2e%2f%2e%2e%2fsecret'), null);
});

test('fremder Host wird abgelehnt', () => {
  assert.strictEqual(resolveAppPath(R, 'app://evil/index.html'), null);
});

test('ungültige Kodierung wird abgelehnt', () => {
  assert.strictEqual(resolveAppPath(R, 'app://nook/%E0%A4%A'), null);
});
