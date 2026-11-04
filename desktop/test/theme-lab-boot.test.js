const test = require('node:test');
const assert = require('node:assert');
const B = require('../../js/theme-lab-boot.js');

function realStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k), clear: () => m.clear() };
}
// Wie im Browser: localStorage ist ein Getter auf dem Prototyp
function fakeWin(real) {
  const proto = {}; Object.defineProperty(proto, 'localStorage', { configurable: true, get: () => real });
  const w = Object.create(proto);
  w.listeners = [];
  w.addEventListener = (t, fn, cap) => w.listeners.push({ t, fn, cap });
  return w;
}

test('Schreiben landet nur im Speicher, nicht im echten', () => {
  const real = realStorage(); const w = fakeWin(real);
  assert.strictEqual(B.installThemeLab(w, { sample: {}, copyKeys: [], themeId: 'x' }), true);
  w.localStorage.setItem('tasks', '[1]');
  assert.strictEqual(w.localStorage.getItem('tasks'), '[1]');
  assert.strictEqual(real.m.has('tasks'), false);
});

test('customThemes lesbar, Schreiben aendert echten Speicher nicht', () => {
  const real = realStorage({ customThemes: '[{"id":"a"}]' }); const w = fakeWin(real);
  B.installThemeLab(w, { sample: {}, copyKeys: B.COPY_KEYS, themeId: 'a' });
  assert.strictEqual(w.localStorage.getItem('customThemes'), '[{"id":"a"}]');
  w.localStorage.setItem('customThemes', '[]');
  assert.strictEqual(real.m.get('customThemes'), '[{"id":"a"}]');
});

test('Musterdaten da, kopierte Schluessel gewinnen, theme aus Parameter', () => {
  const real = realStorage({ userName: '"Echt"', hubUserColors: '"echt"', theme: '"alt"' }); const w = fakeWin(real);
  B.installThemeLab(w, { sample: { blocks: '[1]', userName: '"Muster"', hubUserColors: '"muster"' }, copyKeys: B.COPY_KEYS, themeId: 'neu' });
  assert.strictEqual(w.localStorage.getItem('blocks'), '[1]');
  assert.strictEqual(w.localStorage.getItem('hubUserColors'), '"echt"');
  assert.strictEqual(w.localStorage.getItem('userName'), '"Muster"'); // Name wird nie aus dem echten Speicher kopiert
  assert.ok(!B.COPY_KEYS.includes('userName'));
  assert.strictEqual(w.localStorage.getItem('theme'), '"neu"');
  assert.strictEqual(real.m.get('theme'), '"alt"');
});

test('storage-Events werden verschluckt', () => {
  const w = fakeWin(realStorage());
  B.installThemeLab(w, { sample: {}, copyKeys: [], themeId: 'x' });
  assert.ok(w.listeners.some(l => l.t === 'storage' && l.cap === true));
});

test('nicht konfigurierbar -> false, nichts geschrieben', () => {
  const real = realStorage({ theme: '"alt"' });
  const w = {}; Object.defineProperty(w, 'localStorage', { configurable: false, get: () => real });
  w.addEventListener = () => {};
  assert.strictEqual(B.installThemeLab(w, { sample: { a: '1' }, copyKeys: B.COPY_KEYS, themeId: 'x' }), false);
  assert.deepStrictEqual([...real.m.entries()], [['theme', '"alt"']]);
});

test('Ersatz greift nicht (Getter ignoriert) -> false', () => {
  const real = realStorage(); const w = fakeWin(real);
  const orig = Object.defineProperty;
  const w2 = new Proxy(w, { defineProperty: () => true });
  assert.strictEqual(B.installThemeLab(w2, { sample: {}, copyKeys: [], themeId: 'x' }), false);
  assert.strictEqual(real.m.size, 0);
});

test('createMemoryStorage', () => {
  const s = B.createMemoryStorage();
  s.setItem('a', 5);
  assert.strictEqual(s.getItem('a'), '5');
  assert.strictEqual(s.getItem('nix'), null);
  assert.strictEqual(s.length, 1);
  assert.strictEqual(s.key(0), 'a');
  s.removeItem('a'); assert.strictEqual(s.length, 0);
  s.setItem('b', 1); s.clear(); assert.strictEqual(s.length, 0);
});
