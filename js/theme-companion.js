// =========================
// THEME-BEGLEITER — kleine animierte Figur eines Grafik-Sets
// Ein Grafik-Set kann einen Begleiter mitbringen (GRAPHICS_THEMES[].companion
// in js/theme-engine.js, bisher nur Beau). Ist ein Theme mit so einem Set
// aktiv, sitzt die Figur beim ersten Öffnen des Tages unten rechts und grüßt
// mit einer Sprechblase; danach verabschiedet sie sich von selbst. Ein Klick
// auf die Figur bringt einen neuen Satz, × schickt sie sofort weg.
// Kennt kein Theme und keinen Tab: applyThemeEngine() ruft
// updateThemeCompanion(id) auf. Keys: companionGreetedDay (Tag des letzten
// Grußes), themeCompanion (false = nie zeigen).
// Lädt nach theme-engine.js (findGraphicsTheme, getCustomTheme).
// =========================

const THEME_COMPANION_STAY_MS = 16000;

const COMPANION_LINES = {
  morning: ['Guten Morgen! Schön, dass du da bist.', 'Morgen! Ich hab dir den Platz warmgehalten.', 'Guten Morgen! Heute wird ein guter Tag.'],
  day:     ['Hallo! Schön, dass du da bist.', 'Da bist du ja! Ich hab auf dich gewartet.', 'Hallo! Lass uns gemütlich loslegen.'],
  evening: ['Guten Abend! Schön, dass du da bist.', 'Abend! Zeit für Tee und kleine Schritte.', 'Guten Abend! Ich bleib noch ein bisschen.'],
  night:   ['Noch wach? Ich leiste dir Gesellschaft.', 'Psst … die Bibliothek schläft schon fast.'],
  tap:     ['Miau!', 'Prrrr …', 'Kleine Schritte sind auch Fortschritt.', 'Vergiss nicht, was zu trinken!', 'Der Schmetterling ist schneller als ich …', 'Du schaffst das.', 'Eine Pause ist auch was Gutes.'],
};

let _companionTimer = null;

function companionTodayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function companionPick(list, avoid) {
  const pool = list.filter(l => l !== avoid);
  return pool[Math.floor(Math.random() * pool.length)] || list[0];
}

function companionGreeting() {
  const h = new Date().getHours();
  const key = h < 5 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'day' : h < 23 ? 'evening' : 'night';
  return companionPick(COMPANION_LINES[key]);
}

// Begleiter des Grafik-Sets, das das Theme nutzt (Icon-Set oder Grafik-Modus)
function getThemeCompanion(id) {
  if (typeof getCustomTheme !== 'function' || typeof findGraphicsTheme !== 'function') return null;
  const ct = getCustomTheme(id);
  if (!ct) return null;
  const setId = (ct.graphics && ct.graphics.mode === 'theme' && ct.graphics.theme) || (ct.branding && ct.branding.theme);
  const gt = findGraphicsTheme(setId);
  return (gt && gt.companion) || null;
}

function hideThemeCompanion(immediate) {
  clearTimeout(_companionTimer);
  const el = document.getElementById('theme-companion');
  if (!el) return;
  if (immediate) { el.remove(); return; }
  el.classList.add('leaving');
  setTimeout(() => el.remove(), 600);
}

function showThemeCompanion(companion) {
  hideThemeCompanion(true);
  const el = document.createElement('div');
  el.id = 'theme-companion';
  el.className = 'theme-companion';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="theme-companion-bubble">
      <span class="theme-companion-text"></span>
      <button type="button" class="theme-companion-close" aria-label="${escHtml(companion.name)} verabschieden">×</button>
    </div>
    <button type="button" class="theme-companion-figure" aria-label="${escHtml(companion.name)} streicheln">
      <img src="${escHtml(companion.src)}" alt="${escHtml(companion.alt || companion.name)}" draggable="false">
    </button>`;
  const text = el.querySelector('.theme-companion-text');
  text.textContent = companionGreeting();
  el.querySelector('.theme-companion-close').addEventListener('click', () => hideThemeCompanion());
  el.querySelector('.theme-companion-figure').addEventListener('click', () => {
    text.textContent = companionPick(COMPANION_LINES.tap, text.textContent);
    el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
    clearTimeout(_companionTimer);
    _companionTimer = setTimeout(() => hideThemeCompanion(), THEME_COMPANION_STAY_MS);
  });
  document.body.appendChild(el);
  _companionTimer = setTimeout(() => hideThemeCompanion(), THEME_COMPANION_STAY_MS);
}

// Von applyThemeEngine() bei jedem Theme-Wechsel aufgerufen
function updateThemeCompanion(id) {
  const companion = getThemeCompanion(id);
  if (!companion) { hideThemeCompanion(true); return; }
  if (window.NOOK_THEME_LAB || window.NOOK_THEME_LAB_FAILED) return;
  if (DB.get('themeCompanion', true) === false) return;
  const today = companionTodayIso();
  if (DB.get('companionGreetedDay', null) === today) return;
  DB.set('companionGreetedDay', today);
  // kurz warten, bis die Seite steht — dann sitzt Beau schon da
  setTimeout(() => showThemeCompanion(companion), 900);
}

// Erster Aufruf: applyThemeEngine() lief beim Laden schon, bevor es diese
// Datei gab — also für das aktive Theme einmal nachholen.
if (typeof theme !== 'undefined') updateThemeCompanion(theme);
