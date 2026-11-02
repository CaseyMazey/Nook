// Merkt sich Fenstergröße und -position in einer Datei im Benutzerdaten-Ordner.
// Kein electron-Import, damit das Modul unter reinem Node testbar bleibt.
const fs = require('node:fs');

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 820;

function isValidState(s) {
  if (s === null || typeof s !== 'object') return false;
  if (!Number.isFinite(s.width) || !Number.isFinite(s.height)) return false;
  if (s.width <= 0 || s.height <= 0) return false;
  return Number.isFinite(s.x) && Number.isFinite(s.y);
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// Liefert die gespeicherte Lage oder die Standardgröße ohne x/y, wenn die Datei
// fehlt, kaputt ist oder das Fenster auf keinem Display mehr sichtbar wäre.
function loadWindowState(file, displays) {
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (isValidState(state) && displays.some((d) => overlaps(state, d))) return state;
  } catch {
    // Fehlende oder kaputte Datei: Standardgröße ist genau das richtige Ergebnis.
  }
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
}

// Erst in eine Hilfsdatei schreiben, dann umbenennen: Ein Absturz mittendrin
// hinterlässt so keine halb geschriebene Datei.
function saveWindowState(file, bounds) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(bounds));
  fs.renameSync(tmp, file);
}

module.exports = { loadWindowState, saveWindowState };
