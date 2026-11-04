// Tests für Paketinhalt und Paketprüfung (desktop/scripts/stage.js)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseIgnore, isIgnored, stageApp, findForbidden, writeSyncConfig } = require('../scripts/stage.js');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nook-stage-'));
}
function write(root, rel, content = 'x') {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

test('parseIgnore: Kommentare/Leerzeilen raus, Slash am Ende weg', () => {
  assert.deepStrictEqual(
    parseIgnore('# c\n\n  docs/ \r\n*.xcf\nMüll-Wasser.xlsx\n'),
    ['docs', '*.xcf', 'Müll-Wasser.xlsx']
  );
});

test('isIgnored: gleiche Semantik wie Test-Ignored in deploy.ps1', () => {
  assert.strictEqual(isIgnored('docs/a.md', ['docs']), true);
  assert.strictEqual(isIgnored('docs', ['docs']), true);
  assert.strictEqual(isIgnored('x/y.xcf', ['*.xcf'], ), true);
  assert.strictEqual(isIgnored('js/main.js', ['docs', '*.xcf']), false);
  assert.strictEqual(isIgnored('a\\b.xcf', ['*.xcf']), true);
  assert.strictEqual(isIgnored('Müll-Wasser.xlsx', ['Müll-Wasser.xlsx']), true);
  // Verzeichnis-Muster gilt nur an der Wurzel (wie -like/StartsWith im Skript)
  assert.strictEqual(isIgnored('js/docs/a.md', ['docs']), false);
});

test('stageApp kopiert App-Dateien, aber nie Privates', () => {
  const root = tmp(), dest = path.join(tmp(), 'stage');
  write(root, '.assetsignore', 'docs/\n*.xcf\n');
  write(root, 'index.html');
  write(root, 'games/ä b/x.js');
  write(root, 'Backups/a.json');
  write(root, 'js/sync-config.js');
  write(root, '.git/config');
  write(root, 'docs/a.md');
  write(root, 'img/p.xcf');
  write(dest, 'alt.txt'); // wird vorher entfernt
  stageApp(root, dest);
  assert.ok(fs.existsSync(path.join(dest, 'index.html')));
  assert.ok(fs.existsSync(path.join(dest, 'games/ä b/x.js')));
  assert.ok(!fs.existsSync(path.join(dest, 'Backups')));
  assert.ok(!fs.existsSync(path.join(dest, 'js/sync-config.js')));
  assert.ok(!fs.existsSync(path.join(dest, '.git')));
  assert.ok(!fs.existsSync(path.join(dest, 'docs')));
  assert.ok(!fs.existsSync(path.join(dest, 'img/p.xcf')));
  assert.ok(!fs.existsSync(path.join(dest, 'alt.txt')));
});

test('stageApp schließt Backups/ und sync-config.js auch ohne .assetsignore-Eintrag aus', () => {
  const root = tmp(), dest = path.join(tmp(), 'stage');
  write(root, '.assetsignore', '# leer\n');
  write(root, 'index.html');
  write(root, 'Backups/a.json');
  write(root, 'js/sync-config.js');
  stageApp(root, dest);
  assert.deepStrictEqual(findForbidden(dest), []);
  assert.ok(fs.existsSync(path.join(dest, 'index.html')));
});

test('findForbidden meldet verbotene Dateien', () => {
  const forbidden = [
    'Backups/a.json', 'a/b.xcf', 'c.docx', 'd.xlsx', 'e.keystore', 'f.jks',
    'js/sync-config.js', 'AI documentation/x.md', '.git/config',
  ];
  for (const rel of forbidden) {
    const d = tmp();
    write(d, rel);
    assert.ok(findForbidden(d).length >= 1, rel);
  }
});

test('findForbidden: sauberer Ordner ergibt []', () => {
  const d = tmp();
  write(d, 'index.html');
  write(d, 'js/main.js');
  write(d, 'js/sync-config.example.js');
  assert.deepStrictEqual(findForbidden(d), []);
});

test('findForbidden ist von .assetsignore unabhängig', () => {
  const root = tmp();
  write(root, '.assetsignore', '');
  write(root, 'Backups/a.json');
  assert.strictEqual(findForbidden(root).length, 1);
});

test('writeSyncConfig erzeugt die Konfiguration aus den Umgebungswerten', () => {
  const d = tmp();
  write(d, 'js/main.js');
  const env = { SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_ANON_KEY: 'eyJ.abc-_1' };
  assert.strictEqual(writeSyncConfig(d, env), true);
  const text = fs.readFileSync(path.join(d, 'js/sync-config.js'), 'utf8');
  assert.match(text, /const SUPABASE_URL = "https:\/\/abc\.supabase\.co";/);
  assert.match(text, /const SUPABASE_ANON_KEY = "eyJ\.abc-_1";/);
  assert.match(text, /const GOOGLE_CLIENT_ID = "";/);
});

test('writeSyncConfig ohne Werte schreibt nichts', () => {
  const d = tmp();
  write(d, 'js/main.js');
  assert.strictEqual(writeSyncConfig(d, {}), false);
  assert.ok(!fs.existsSync(path.join(d, 'js/sync-config.js')));
});

test('writeSyncConfig lehnt unvollständige oder unsichere Werte ab', () => {
  const d = tmp();
  write(d, 'js/main.js');
  assert.throws(() => writeSyncConfig(d, { SUPABASE_URL: 'https://abc.supabase.co' }));
  assert.throws(() => writeSyncConfig(d, { SUPABASE_URL: 'http://abc.supabase.co', SUPABASE_ANON_KEY: 'k' }));
  assert.throws(() => writeSyncConfig(d, { SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_ANON_KEY: 'k";alert(1)//' }));
  assert.ok(!fs.existsSync(path.join(d, 'js/sync-config.js')));
});

test('stageApp: verschachtelte Ordner mit Ignore-Namen bleiben, Wurzel-Ordner nicht', () => {
  const root = tmp(), dest = path.join(tmp(), 'stage');
  write(root, '.assetsignore', 'docs/\nscripts/\n');
  write(root, 'games/x/docs/a.md');
  write(root, 'js/scripts/b.js');
  write(root, 'docs/a.md');
  write(root, 'scripts/c.js');
  stageApp(root, dest);
  assert.ok(fs.existsSync(path.join(dest, 'games/x/docs/a.md')));
  assert.ok(fs.existsSync(path.join(dest, 'js/scripts/b.js')));
  assert.ok(!fs.existsSync(path.join(dest, 'docs')));
  assert.ok(!fs.existsSync(path.join(dest, 'scripts')));
});
