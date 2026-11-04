// Baut den Paketinhalt der Desktop-App: kopiert die build-freie Web-App
// (Repo-Wurzel) nach desktop/.stage/ und prüft, dass nichts Privates drin ist.
// Ausschlussregeln kommen aus .assetsignore (gleiche Semantik wie
// Test-Ignored in scripts/deploy.ps1); die Prüfung findForbidden ist
// bewusst hartcodiert und unabhängig davon (zweite Sicherung).
const fs = require('node:fs');
const path = require('node:path');

// Immer ausgeschlossen, egal was in .assetsignore steht.
const ALWAYS_EXCLUDED = ['.git', 'Backups', 'js/sync-config.js'];

// Hartcodierte Verbotsliste für die Paketprüfung.
const FORBIDDEN_DIRS = ['backups', 'ai documentation', '.git'];
const FORBIDDEN_FILE_RE = /\.(xcf|docx|xlsx|keystore|jks)$/i;
const FORBIDDEN_PATHS = ['js/sync-config.js'];

function parseIgnore(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/\/+$/, ''));
}

// PowerShell -like: * ? [..], Groß-/Kleinschreibung egal, * matcht auch "/".
function likeToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const end = pattern.indexOf(']', i + 1);
      if (end > i + 1) {
        re += '[' + pattern.slice(i + 1, end).replace(/\\/g, '\\\\') + ']';
        i = end;
      } else re += '\[';
    } else re += c.replace(/[.+^${}()|\\\]]/g, '\\$&');
  }
  return new RegExp('^' + re + '$', 'is');
}

// isDir: Verzeichnisse nur per Präfix prüfen (wie deploy.ps1, das nur Dateien testet).
function isIgnored(relPath, patterns, isDir = false) {
  const rel = relPath.replace(/\\/g, '/');
  const name = rel.slice(rel.lastIndexOf('/') + 1);
  for (const p of patterns) {
    const pl = p.toLowerCase();
    const rl = rel.toLowerCase();
    if (rl === pl || rl.startsWith(pl + '/')) return true;
    if (isDir) continue;
    const re = likeToRegExp(p);
    if (re.test(name) || re.test(rel)) return true;
  }
  return false;
}

function stageApp(rootDir, destDir) {
  const ignoreFile = path.join(rootDir, '.assetsignore');
  const text = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile, 'utf8').replace(/^\uFEFF/, '') : '';
  const patterns = parseIgnore(text).concat(ALWAYS_EXCLUDED);

  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  const walk = (rel) => {
    const abs = rel ? path.join(rootDir, rel) : rootDir;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel ? rel + '/' + entry.name : entry.name;
      if (isIgnored(childRel, patterns, entry.isDirectory())) continue;
      if (entry.isDirectory()) walk(childRel);
      else if (entry.isFile()) {
        const target = path.join(destDir, childRel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(rootDir, childRel), target);
      }
    }
  };
  walk('');
}

function findForbidden(dir) {
  const hits = [];
  const walk = (rel) => {
    const abs = rel ? path.join(dir, rel) : dir;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel ? rel + '/' + entry.name : entry.name;
      const lower = childRel.toLowerCase();
      if (entry.isDirectory()) {
        if (FORBIDDEN_DIRS.includes(entry.name.toLowerCase())) hits.push(childRel + '/');
        else walk(childRel);
      } else if (FORBIDDEN_FILE_RE.test(entry.name) || FORBIDDEN_PATHS.includes(lower)) {
        hits.push(childRel);
      }
    }
  };
  walk('');
  return hits;
}

// Erzeugt js/sync-config.js im Paket aus SUPABASE_URL/SUPABASE_ANON_KEY
// (im Release-Build aus den GitHub-Variablen). Die Datei aus dem Arbeitsordner
// kommt nie ins Paket (ALWAYS_EXCLUDED); ohne beide Werte bleibt der Sync in
// der App aus, wie in Forks ohne eigenes Supabase. Läuft nach findForbidden.
// Gibt true zurück, wenn eine Konfiguration geschrieben wurde.
function writeSyncConfig(destDir, env) {
  const url = (env.SUPABASE_URL || '').trim();
  const key = (env.SUPABASE_ANON_KEY || '').trim();
  if (!url && !key) return false;
  if (!url || !key) throw new Error('SUPABASE_URL und SUPABASE_ANON_KEY müssen beide gesetzt sein');
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(url)) throw new Error('SUPABASE_URL muss eine https-Adresse ohne Pfad sein');
  if (!/^[A-Za-z0-9._-]+$/.test(key)) throw new Error('SUPABASE_ANON_KEY enthält unerwartete Zeichen');
  const content = [
    '// Beim Paketbau erzeugt (desktop/scripts/stage.js) — nicht von Hand ändern.',
    `const SUPABASE_URL = ${JSON.stringify(url)};`,
    `const SUPABASE_ANON_KEY = ${JSON.stringify(key)};`,
    'const GOOGLE_CLIENT_ID = "";',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(destDir, 'js', 'sync-config.js'), content);
  return true;
}

module.exports = { parseIgnore, isIgnored, stageApp, findForbidden, writeSyncConfig };

if (require.main === module) {
  const root = path.resolve(__dirname, '..', '..');
  const dest = path.resolve(__dirname, '..', '.stage');
  stageApp(root, dest);
  const hits = findForbidden(dest);
  if (hits.length) {
    console.error('Verbotene Dateien im Paket:\n  ' + hits.join('\n  '));
    process.exit(1);
  }
  console.log('Paketinhalt nach ' + dest + ' geschrieben, keine verbotenen Dateien.');
  console.log(writeSyncConfig(dest, process.env)
    ? 'Sync-Konfiguration aus SUPABASE_URL/SUPABASE_ANON_KEY erzeugt.'
    : 'Keine Sync-Konfiguration gesetzt, Sync bleibt in der App aus.');
}
