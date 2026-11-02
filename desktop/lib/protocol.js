// Löst app://nook/... sicher auf eine Datei unterhalb des App-Ordners auf.
// Kein electron-Import, damit das Modul unter reinem Node testbar bleibt.
const path = require('node:path');

const APP_HOST = 'nook';

// Gibt den absoluten Dateipfad zurück oder null (fremder Host, Pfadausbruch,
// ungültige URL/Kodierung). Query und Hash werden ignoriert.
function resolveAppPath(rootDir, requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'app:' || url.hostname !== APP_HOST) return null;

  // new URL normalisiert '..' (auch %2e%2e) still weg und würde den Ausbruch
  // verschleiern; deshalb den Rohpfad aus dem Original-String prüfen.
  const m = /^app:\/\/[^/?#]*([^?#]*)/i.exec(requestUrl);
  const rawPath = m ? m[1] : url.pathname;
  let rel;
  try {
    rel = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  // Nach dem Dekodieren prüfen: %5C und %00 dürfen nichts durchschmuggeln.
  if (rel.includes('\0')) return null;
  rel = rel.replace(/\\/g, '/');
  if (rel.split('/').includes('..')) return null;
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';

  const root = path.resolve(rootDir);
  const full = path.resolve(root, '.' + (rel.startsWith('/') ? rel : '/' + rel));
  if (!full.startsWith(root + path.sep)) return null;
  return full;
}

module.exports = { resolveAppPath };
