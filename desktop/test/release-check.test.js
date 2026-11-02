const test = require('node:test');
const assert = require('node:assert');
const { missingAssets, findReleases } = require('../scripts/release-check.js');

const FULL = [
  'Nook Setup 2026.11.1.exe', 'Nook-2026.11.1.AppImage',
  'Nook-2026.11.1.dmg', 'Nook-2026.11.1-arm64.dmg',
  'latest.yml', 'latest-linux.yml', 'latest-mac.yml',
];

test('vollständige Liste meldet nichts', () => {
  assert.deepStrictEqual(missingAssets(FULL), []);
});

for (const [label, pred] of [
  ['exe', n => n.endsWith('.exe')],
  ['AppImage', n => n.endsWith('.AppImage')],
  ['latest.yml', n => n === 'latest.yml'],
  ['latest-linux.yml', n => n === 'latest-linux.yml'],
  ['latest-mac.yml', n => n === 'latest-mac.yml'],
  ['dmg (arm64)', n => n.includes('arm64.dmg')],
  ['dmg (x64)', n => n.endsWith('.dmg') && !n.includes('arm64')],
]) {
  test('fehlendes ' + label + ' wird gemeldet', () => {
    const res = missingAssets(FULL.filter(n => !pred(n)));
    assert.strictEqual(res.length, 1);
    assert.ok(res[0].includes(label.split(' ')[0]));
  });
}

test('zwei dmg ohne arm64 melden arm64', () => {
  const res = missingAssets(['a.exe', 'a.AppImage', 'a.dmg', 'b.dmg', 'latest.yml', 'latest-linux.yml', 'latest-mac.yml']);
  assert.deepStrictEqual(res, ['dmg (arm64)']);
});

test('leere Liste meldet alles', () => {
  assert.strictEqual(missingAssets([]).length, 7);
});

test('findReleases trennt Entwürfe und veröffentlichte', () => {
  const r = findReleases([[{ id: 1, tag_name: 'v1', draft: true }, { id: 2, tag_name: 'v1', draft: false }, { id: 3, tag_name: 'v2', draft: true }]], 'v1');
  assert.deepStrictEqual(r.drafts.map(x => x.id), [1]);
  assert.deepStrictEqual(r.published.map(x => x.id), [2]);
});
