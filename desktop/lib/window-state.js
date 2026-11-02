// Merkt sich Fenstergröße und -position in einer Datei im Benutzerdaten-Ordner.
// Kein electron-Import, damit das Modul unter reinem Node testbar bleibt.
const fs = require('node:fs');

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 820;
const MIN_SIZE = 200;
const MAX_SIZE = 20000;
// Die Titelleiste muss greifbar bleiben: volle Höhe, mindestens so breit sichtbar.
const TITLE_STRIP_HEIGHT = 40;
const TITLE_STRIP_MIN_VISIBLE_WIDTH = 100;

function isValidState(s) {
  if (s === null || typeof s !== 'object') return false;
  if (![s.x, s.y, s.width, s.height].every(Number.isInteger)) return false;
  return [s.width, s.height].every((size) => size >= MIN_SIZE && size <= MAX_SIZE);
}

function titleStripVisibleOn(state, display) {
  const visibleWidth = Math.min(state.x + state.width, display.x + display.width) - Math.max(state.x, display.x);
  const insideVertically = state.y >= display.y && state.y + TITLE_STRIP_HEIGHT <= display.y + display.height;
  return insideVertically && visibleWidth >= TITLE_STRIP_MIN_VISIBLE_WIDTH;
}

// Liefert die gespeicherte Lage oder die Standardgröße ohne x/y, wenn die Datei
// fehlt, kaputt ist oder die Titelleiste auf keinem Display erreichbar wäre.
function loadWindowState(file, displays) {
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (isValidState(state) && displays.some((d) => titleStripVisibleOn(state, d))) return state;
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
