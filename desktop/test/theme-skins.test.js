const test = require('node:test');
const assert = require('node:assert');
const S = require('../../js/theme-skins.js');

function reg() {
  const r = S.createSkinRegistry();
  // Absichtlich Einzelelement zuerst angemeldet
  r.register({ id: 'today.menu', label: 'Speiseplan', view: 'today', selector: '#mealplan-widget',
    extras: [{ key: 'deco', label: 'Deko', selector: '.x', kind: 'background' }] });
  r.register({ id: 'today.cards', label: 'Karten', view: 'today', selector: '#view-today .card', group: true });
  return r;
}
const FONT = "'Alegreya', Georgia, serif";
const fonts = new Set([FONT]);
const san = (raw, notes = new Set()) => S.sanitizeSkins(raw, notes, { registry: reg(), fonts });
const rules = css => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(m => ({ sel: m[1], body: m[2] }));
const elRule = css => rules(css).find(r => r.sel.endsWith('#mealplan-widget'));

test('registry: Reihenfolge und view-Filter', () => {
  const r = reg();
  assert.deepStrictEqual(r.list().map(d => d.id), ['today.cards', 'today.menu']);
  r.register({ id: 'g.x', label: 'X', view: '*', selector: '.x' });
  assert.deepStrictEqual(r.list('today').map(d => d.id), ['today.cards', 'today.menu', 'g.x']);
  assert.deepStrictEqual(r.list('calendar').map(d => d.id), ['g.x']);
  assert.strictEqual(r.get('nope'), null);
  assert.ok(r.ids().has('today.menu'));
  assert.ok(r.get('today.menu').heading.includes('h1'));
});

test('resolveSkinSrc', () => {
  assert.strictEqual(S.resolveSkinSrc('tpl:chalkboard'), 'assets/today/chalkboard.webp');
  assert.strictEqual(S.resolveSkinSrc('tpl:nope'), null);
  assert.strictEqual(S.resolveSkinSrc('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  assert.strictEqual(S.resolveSkinSrc('data:text/html;base64,AAAA'), null);
  assert.strictEqual(S.resolveSkinSrc('javascript:x'), null);
  assert.strictEqual(S.SKIN_TEMPLATES.length, 8);
});

test('buildSkinCss: leer', () => {
  assert.strictEqual(S.buildSkinCss({}, reg()), '');
  assert.strictEqual(S.buildSkinCss({ 'today.menu': { colors: { text: null }, image: null, shape: {} } }, reg()), '');
});

test('buildSkinCss: Praefix und !important', () => {
  const css = S.buildSkinCss({ 'today.menu': {
    colors: { text: '#112233', surface: '#000000' }, shape: { radius: 4, shadow: 'soft' },
    image: { mode: 'frame', src: 'tpl:chalkboard', slice: [48, 48, 78, 48], width: [16, 16, 26, 16] },
    fastener: { kind: 'seal', position: 'right', color: 'green' } } }, reg());
  const rs = rules(css);
  assert.ok(rs.length >= 3);
  for (const r of rs) {
    assert.ok(r.sel.trim().startsWith(':root[data-theme-skins] '), r.sel);
    for (const d of r.body.split(';').filter(Boolean)) assert.ok(d.endsWith('!important'), d);
  }
});

test('buildSkinCss: Text-Farbe', () => {
  const css = S.buildSkinCss({ 'today.menu': { colors: { text: '#112233' } } }, reg());
  assert.ok(css.includes('#mealplan-widget{'));
  assert.ok(css.includes('color:#112233 !important'));
});

test('buildSkinCss: Rahmenbild', () => {
  const css = S.buildSkinCss({ 'today.menu': { image: { mode: 'frame', src: 'tpl:chalkboard', slice: [48, 48, 78, 48], width: [16, 16, 26, 16] } } }, reg());
  assert.ok(css.includes('#mealplan-widget::before{'));
  assert.ok(css.includes('border-image:url("assets/today/chalkboard.webp") 48 48 78 48 fill / 16px 16px 26px 16px / 0 stretch !important'));
  assert.ok(css.includes("content:'' !important"));
  assert.ok(css.includes('z-index:-1 !important'));
  const el = elRule(css);
  assert.ok(el.body.includes('isolation:isolate !important'));
  assert.ok(el.body.includes('background:transparent !important'));
});

test('buildSkinCss: Kacheln', () => {
  const css = S.buildSkinCss({ 'today.menu': { image: { mode: 'tile', src: 'tpl:desk' } } }, reg());
  assert.ok(css.includes('background:url("assets/today/desk.webp") top left / auto repeat !important'));
  assert.ok(css.includes('border-image:none !important'));
});

test('buildSkinCss: Schraeglage', () => {
  const withImg = S.buildSkinCss({ 'today.menu': { shape: { tilt: 2 }, image: { mode: 'fill', src: 'tpl:desk' } } }, reg());
  const rs = rules(withImg);
  assert.ok(rs.find(r => r.sel.includes('::before')).body.includes('rotate(2deg)'));
  assert.ok(!elRule(withImg).body.includes('rotate'));
  const noImg = S.buildSkinCss({ 'today.menu': { shape: { tilt: 2 } } }, reg());
  assert.ok(elRule(noImg).body.includes('rotate(2deg)'));
});

test('buildSkinCss: Befestigung', () => {
  const css = S.buildSkinCss({ 'today.menu': { fastener: { kind: 'seal', position: 'right', color: 'green' } } }, reg());
  const a = rules(css).find(r => r.sel.includes('::after'));
  assert.ok(a.body.includes('left:86%'));
  assert.ok(a.body.includes('url("assets/questboard/seal.webp")'));
  assert.ok(a.body.includes('filter:hue-rotate(115deg)'));
  const none = S.buildSkinCss({ 'today.menu': { fastener: { kind: 'none' } } }, reg());
  assert.ok(none.includes('::after{display:none !important}'));
});

test('buildSkinCss: Sammelregel vor Einzelregel', () => {
  const css = S.buildSkinCss({ 'today.menu': { colors: { text: '#111111' } }, 'today.cards': { colors: { text: '#222222' } } }, reg());
  assert.ok(css.indexOf('#view-today .card{') >= 0);
  assert.ok(css.indexOf('#view-today .card{') < css.indexOf('#mealplan-widget{'));
});

test('buildSkinCss: Ueberschriften und Komma-Gruppen', () => {
  const r = S.createSkinRegistry();
  r.register({ id: 'a', label: 'A', view: '*', selector: '.a, .b', group: true });
  const css = S.buildSkinCss({ a: { colors: { heading: '#abcdef' } } }, r);
  assert.ok(css.includes(':root[data-theme-skins] :is(.a, .b) :is(h1,h2,h3,h4,.panel-title,.panel-header,.panel-label){color:#abcdef !important}'));
});

test('buildSkinCss: Extras', () => {
  const css = S.buildSkinCss({ 'today.menu': { extras: { deco: 'tpl:note' } } }, reg());
  assert.ok(css.includes('#mealplan-widget .x{background-image:url("assets/questboard/note.webp") !important'));
  assert.strictEqual(S.buildSkinCss({ 'today.menu': { extras: { deco: 'javascript:x' } } }, reg()), '');
});

test('sanitizeSkins: gueltig bleibt gleich', () => {
  const good = { 'today.menu': {
    image: { mode: 'frame', src: 'tpl:chalkboard', slice: [48, 48, 78, 48], width: [16, 16, 26, 16] },
    colors: { surface: '#1f2a24', text: '#F2EFE6' },
    font: { heading: FONT, size: 110 },
    shape: { radius: 6, shadow: 'soft', tilt: 1.5, padding: 10, opacity: 90 },
    fastener: { kind: 'seal', position: 'center', color: 'gold' },
    extras: { deco: 'tpl:note' } } };
  assert.deepStrictEqual(san(structuredClone(good)), good);
});

test('sanitizeSkins: unbekannte ID', () => {
  const notes = new Set();
  const out = san({ 'zzz': { colors: { text: '#111111' } }, 'today.menu': { colors: { text: '#111111' } } }, notes);
  assert.deepStrictEqual(Object.keys(out), ['today.menu']);
  assert.strictEqual(notes.size, 1);
});

test('sanitizeSkins: ungueltige Werte', () => {
  const m = raw => { const o = san({ 'today.menu': raw }); return o && o['today.menu']; };
  assert.strictEqual(m({ colors: { text: 'red' } }), null);
  assert.strictEqual(m({ font: { text: 'Comic' } }), null);
  assert.strictEqual(m({ colors: { text: 'red' }, shape: { radius: 1 } }).colors, undefined);
  assert.strictEqual(m({ shape: { tilt: 9 } }).shape.tilt, 3);
  assert.strictEqual(m({ shape: { radius: -5 } }).shape.radius, 0);
  assert.strictEqual(m({ font: { size: 300 } }).font.size, 140);
  assert.strictEqual(m({ fastener: { kind: 'rocket' } }), null);
  assert.strictEqual(m({ shape: { shadow: 'huge' } }), null);
});

test('sanitizeSkins: Bildquellen', () => {
  const notes = new Set();
  const o = S.sanitizeSkins({ 'today.menu': { image: { mode: 'fill', src: 'data:text/html;base64,AAAA' }, colors: { text: '#111111' } } }, notes, { registry: reg(), fonts });
  assert.strictEqual(o['today.menu'].image, undefined);
  assert.ok(notes.size >= 1);
  assert.strictEqual(san({ 'today.menu': { image: { mode: 'fill', src: 'javascript:x' } } }), null);
  assert.strictEqual(san({ 'today.menu': { image: { mode: 'fill', src: 'tpl:unbekannt' } } }), null);
  const big = 'data:image/png;base64,' + 'A'.repeat(4 * 1024 * 1024 + 10);
  assert.strictEqual(san({ 'today.menu': { image: { mode: 'fill', src: big } } }), null);
  const ok = 'data:image/webp;base64,AAAA';
  assert.strictEqual(san({ 'today.menu': { image: { mode: 'fill', src: ok } } })['today.menu'].image.src, ok);
  const bigFast = 'data:image/png;base64,' + 'A'.repeat(1024 * 1024 + 10);
  assert.strictEqual(san({ 'today.menu': { fastener: { kind: 'custom', src: bigFast } } }), null);
});

test('sanitizeSkins: Extras nur angemeldete Keys, leer -> null', () => {
  assert.strictEqual(san({ 'today.menu': { extras: { evil: 'tpl:note' } } }), null);
  assert.strictEqual(san(null), null);
  assert.strictEqual(san({}), null);
  assert.strictEqual(san({ 'today.menu': {} }), null);
});
