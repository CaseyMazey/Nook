// Hilfsskript für .github/workflows/release.yml.
// CLI: gh api ... --paginate --slurp | TAG=v1 node scripts/release-check.js <create|publish>
//   create : bricht ab, wenn der Tag schon veröffentlicht ist; gibt die ID eines vorhandenen Entwurfs aus (sonst nichts)
//   publish: verlangt genau einen Entwurf mit vollständigen Assets; gibt dessen ID aus
'use strict';

function missingAssets(names) {
  const has = (re) => names.some((n) => re.test(n));
  const checks = [
    ['exe', /\.exe$/],
    ['AppImage', /\.AppImage$/],
    ['latest.yml', /^latest\.yml$/],
    ['latest-linux.yml', /^latest-linux\.yml$/],
    ['latest-mac.yml', /^latest-mac\.yml$/],
    ['dmg (x64)', /^(?!.*arm64).*\.dmg$/],
    ['dmg (arm64)', /arm64.*\.dmg$/],
  ];
  return checks.filter(([, re]) => !has(re)).map(([label]) => label);
}

// pages: Ergebnis von `gh api --paginate --slurp` (Array von Seiten) oder flache Liste
function findReleases(pages, tag) {
  const all = pages.flat();
  const mine = all.filter((r) => r.tag_name === tag);
  return { drafts: mine.filter((r) => r.draft), published: mine.filter((r) => !r.draft) };
}

function main(mode) {
  const tag = process.env.TAG;
  if (!tag) throw new Error('TAG fehlt');
  const input = require('fs').readFileSync(0, 'utf8');
  const { drafts, published } = findReleases(JSON.parse(input), tag);
  if (published.length) throw new Error(`Für ${tag} existiert bereits ein veröffentlichtes Release`);
  if (mode === 'create') {
    if (drafts.length > 1) throw new Error(`Mehrere Entwürfe für ${tag}`);
    if (drafts.length) process.stdout.write(String(drafts[0].id));
  } else if (mode === 'publish') {
    if (drafts.length !== 1) throw new Error(`Erwartet genau einen Entwurf für ${tag}, gefunden: ${drafts.length}`);
    const names = (drafts[0].assets || []).map((a) => a.name);
    console.error('Assets: ' + names.join(', '));
    const missing = missingAssets(names);
    if (missing.length) throw new Error('Fehlende Assets: ' + missing.join(', '));
    process.stdout.write(String(drafts[0].id));
  } else {
    throw new Error('Modus create|publish erwartet');
  }
}

module.exports = { missingAssets, findReleases };

if (require.main === module) {
  try { main(process.argv[2]); } catch (e) { console.error('::error::' + e.message); process.exit(1); }
}
