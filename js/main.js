// =========================
// STATE & STORAGE
// =========================

const DB = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  // Gibt zurück, ob gespeichert werden konnte (false z.B. bei vollem
  // localStorage) — Aufrufer dürfen das ignorieren oder den Nutzer warnen.
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
  }
};

const DEFAULT_BLOCKS = [
  { id: 1, label: 'Block 1', start: '07:30', end: '09:00' },
  { id: 2, label: 'Block 2', start: '09:15', end: '11:30' },
  { id: 3, label: 'Block 3', start: '12:15', end: '14:00' },
  { id: 4, label: 'Block 4', start: '14:30', end: '16:10', free: true },
];


const state = {
  currentDate: new Date(),
  currentWeekId: null,
  editingTask: null,
  selectedPriority: 2,
  selectedStatus: 'open',
  editingEvent: null,
  activeSubjectId: null,
  activeGuideCategoryId: null,
  editingCard: null,
  learnQueue: [], learnIndex: 0, learnFlipped: false,
  learnSubjId: null, learnGroupId: null,
};

// =========================
// TASK STATUS — zentrale 3-Stufen-Statuslogik (offen / in Bearbeitung / abgeschlossen)
// Zentral in main.js definiert (statt dupliziert in today.js/calendar.js), weil main.js
// als erstes Skript lädt und bereits den `tasks`-State sowie dessen Query-Helper besitzt.
// Andere Module (z.B. Projects) verwenden aktuell noch ein einfaches done-Bool auf einem
// anderen Datenmodell (project.tasks) — falls sie später denselben 3-Stufen-Status
// brauchen, ist diese Registry der Ort dafür.
// =========================

const TASK_STATUS_ORDER = ['open', 'in_progress', 'completed'];
const TASK_STATUS = {
  open:        { label: 'Offen',          icon: '○', dotVar: '--text-3' },
  in_progress: { label: 'In Bearbeitung', icon: '◐', dotVar: '--amber'  },
  completed:   { label: 'Abgeschlossen',  icon: '✓', dotVar: '--sage'   },
};

// Liest den Status eines Tasks — fällt für Alt-Daten ohne `status`-Feld auf das
// bisherige `done`-Bool zurück, damit nichts migriert werden muss, bevor es gelesen wird.
function taskStatusOf(t) {
  return (t && TASK_STATUS[t.status]) ? t.status : (t && t.done ? 'completed' : 'open');
}
function isTaskCompleted(t) { return taskStatusOf(t) === 'completed'; }

// Setzt den Status und hält das abgeleitete `done`-Bool synchron, damit Module,
// die weiterhin `task.done` lesen (z.B. calendar.js), korrekt bleiben:
// "in_progress" gilt dort — wie überall sonst — ausdrücklich NICHT als erledigt.
function setTaskStatus(t, status) {
  if (!TASK_STATUS[status]) return;
  t.status = status;
  t.done = status === 'completed';
  t.completedAt = status === 'completed' ? Date.now() : null;
}

// =========================
// TASKS — Migration altes → neues Format
// Altes Format: tasks = { "2025-W23": [{...}] }
// Neues Format: tasks = [ {id,title,done,status,createdAt,completedAt,...} ]
// =========================

(function migrateTasksIfNeeded() {
  const raw = DB.get('tasks', null);
  if (!raw) { DB.set('tasks', []); return; }
  if (Array.isArray(raw)) return;

  const migrated = [];
  Object.entries(raw).forEach(([weekId, weekTasks]) => {
    if (!Array.isArray(weekTasks)) return;
    let weekStart = Date.now();
    try {
      const [year, wPart] = weekId.split('-W');
      const w = parseInt(wPart, 10);
      const jan4 = new Date(parseInt(year, 10), 0, 4);
      const day1 = new Date(jan4);
      day1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
      weekStart = day1.getTime();
    } catch { /* fallback to now */ }
    weekTasks.forEach(t => {
      const status = TASK_STATUS[t.status] ? t.status : (t.done ? 'completed' : 'open');
      migrated.push({
        id:          t.id || crypto.randomUUID(),
        title:       t.title || '',
        notes:       t.notes || '',
        priority:    t.priority || 2,
        block:       t.block || 1,
        done:        status === 'completed',
        status,
        createdAt:   t.createdAt || weekStart,
        completedAt: t.completedAt || (status === 'completed' ? weekStart : null),
      });
    });
  });
  DB.set('tasks', migrated);
  console.log(`[Migration] ${migrated.length} Tasks migriert.`);
})();

let tasks            = DB.get('tasks', []);

// Backfill für bereits im neuen Array-Format gespeicherte Tasks ohne `status`-Feld
// (z.B. aus einer Version vor Einführung des 3-Stufen-Status). Läuft bei jedem Start,
// ist aber ein no-op sobald alle Tasks ein gültiges `status`-Feld besitzen — daher
// bewusst nicht auf eine einmalige Migration beschränkt, sondern als transparenter
// Konsistenz-Check, der auch `done` stets synchron zu `status` hält.
(function migrateTaskStatusIfNeeded() {
  let changed = false;
  tasks.forEach(t => {
    if (!TASK_STATUS[t.status]) {
      t.status = t.done ? 'completed' : 'open';
      changed = true;
    }
    const shouldBeDone = t.status === 'completed';
    if (t.done !== shouldBeDone) { t.done = shouldBeDone; changed = true; }
  });
  if (changed) DB.set('tasks', tasks);
})();

let notes            = DB.get('notes', { 'exam-notes': [], 'class-questions': [], 'terms': [] });
let events           = DB.get('events', {});
// Terminserien (wiederkehrende Termine) — getrennt von den Einzelterminen in `events`,
// damit Wiederholungen nicht als tausende Einzeleinträge dupliziert werden müssen.
// Struktur pro Serie siehe calendar.js (Abschnitt "RECURRING EVENTS — Series Engine").
let eventSeries       = DB.get('eventSeries', []);
function saveEventSeries(){ DB.set('eventSeries', eventSeries); }
let quicknote        = DB.get('quicknote', '');
let berichtsheft     = DB.get('berichtsheft', { betrieb: '', schule: '' });
let blocks           = DB.get('blocks', DEFAULT_BLOCKS);
let countdownVisible = DB.get('countdownVisible', {});
// ── Theme-Engine (Phase 2) ───────────────────────────────────────────────
// THEME_FAMILY ordnet jedem fest in main.css definierten Theme seine
// Farbfamilie zu: 'light' (Cozy, Tag) und 'dark' (Cozy, Nacht — früher
// "Classic Dark") — die IDs bleiben aus Kompatibilität mit gespeicherten
// Daten unverändert. Alle weiteren Themes (feste Presets und eigene) kommen
// aus js/theme-engine.js.
const THEME_FAMILY = {
  light: 'light',
  dark:  'dark',
};
// Entfernte eingebaute Dark-Varianten (Oktober 2026, durch die Theme-Engine
// ersetzt) — wer eine davon gewählt hatte, landet bei Cozy (Nacht).
const REMOVED_BUILTIN_THEMES = ['midnight', 'forest', 'espresso', 'oled'];
// Migration: altes darkMode-Boolean → theme-String (einmalig, dann bleibt
// nur noch der 'theme'-Key maßgeblich).
let theme = DB.get('theme', null);
if (theme === null) {
  theme = DB.get('darkMode', false) ? 'dark' : 'light';
  DB.set('theme', theme);
}
if (REMOVED_BUILTIN_THEMES.includes(theme)) {
  theme = 'dark';
  DB.set('theme', theme);
  DB.set('themeFamily', 'dark');
}
// Eigene Themes (js/theme-engine.js) stehen nicht in
// THEME_FAMILY — deren Familie wird beim Erstellen/Anwenden zusätzlich
// unter 'themeFamily' gespeichert, damit dieses frühe Initial-Setup sie
// korrekt setzen kann, ohne dass main.js die customThemes-Liste selbst
// kennen müsste (die lädt erst später).
let themeFamily = THEME_FAMILY[theme] || DB.get('themeFamily', 'light');
// darkMode bleibt als abgeleiteter Boolean bestehen — für bestehende
// Stellen, die nur zwischen hell/dunkel unterscheiden (Sonne/Mond-Icon
// in today.js, Sidebar-Schnellumschalter).
let darkMode = themeFamily === 'dark';
let customTiles      = DB.get('customTiles', []);
let deskCards        = DB.get('deskCards', null);
let generalTodos     = DB.get('generalTodos', []);
let shoppingList     = DB.get('shoppingList', []);
let subjects         = DB.get('subjects', []);
let collapsedGroups  = new Set(DB.get('collapsedGroups', []));
// Vom Nutzer ausgeblendete Tabs (Einstellungen -> "Sichtbare Tabs", siehe
// TAB_VISIBILITY_CONFIG/applyTabVisibility() unten) — Liste von View-Namen
// (wie data-view), nicht die eigentlichen Daten des Tabs, die bleiben
// unangetastet erhalten.
let hiddenTabs        = DB.get('hiddenTabs', []);
function saveHiddenTabs(){ DB.set('hiddenTabs', hiddenTabs); }

document.documentElement.setAttribute('data-theme', theme);
document.documentElement.setAttribute('data-theme-family', themeFamily);

// ── Anzeige-Einstellungen (Einstellungen > Darstellung / Navigation) ─────
// Schriftgröße wirkt über --user-font-scale, das in main.css mit der
// Schriftgröße eigener Themes (--theme-font-scale) zu --core-font-scale
// multipliziert wird. "Animationen reduzieren" und die eingeklappte
// Sidebar sind reine Attribute auf <html>, die CSS auswertet.
const UI_FONT_SCALE_MIN = 85, UI_FONT_SCALE_MAX = 130;
let uiFontScale      = DB.get('uiFontScale', 100);           // Prozent
function saveUiFontScale(){ DB.set('uiFontScale', uiFontScale); }
let reduceMotion     = DB.get('reduceMotion', false);
function saveReduceMotion(){ DB.set('reduceMotion', reduceMotion); }
let sidebarCollapsed = DB.get('sidebarCollapsed', false);    // nur dieses Gerät (sync.js)
function saveSidebarCollapsed(){ DB.set('sidebarCollapsed', sidebarCollapsed); }
function applyUiPrefs() {
  const root = document.documentElement;
  const pct = Math.min(Math.max(Number(uiFontScale) || 100, UI_FONT_SCALE_MIN), UI_FONT_SCALE_MAX);
  root.style.setProperty('--user-font-scale', (pct / 100).toFixed(2));
  root.toggleAttribute('data-reduce-motion', !!reduceMotion);
  root.toggleAttribute('data-sidebar-collapsed', !!sidebarCollapsed);
}
applyUiPrefs();

// Startbildschirm: 'last' = zuletzt geöffneter Tab (URL-Hash), sonst eine
// feste View-ID. Ausgeblendete Tabs fallen auf "today" zurück.
let startView = DB.get('startView', 'last');
function saveStartView(){ DB.set('startView', startView); }

// ── Zentraler Theme-Switch ──────────────────────────────────────────────
// Einziger Ort, der theme setzt/speichert und alle Folgen auslöst:
// data-theme-/data-theme-family-Attribute, Sidebar-Icon, und Neu-Rendern
// der Ansichten mit nutzerdefinierten Farben (--user-color-*, siehe
// hub-utils.js), damit diese sofort statt erst beim nächsten Tab-Wechsel
// aktualisiert werden.
// Wird von der Theme-Auswahl in den Einstellungen (settings.js) aufgerufen.
// Akzeptiert neben 'light'/'dark' auch die ID eines festen Presets oder
// eigenen Themes (js/theme-engine.js) — dessen Familie steht nicht in
// THEME_FAMILY, sondern wird über getCustomTheme() nachgeschlagen, falls
// die Theme-Engine bereits geladen ist (siehe Skript-Ladereihenfolge).
function setTheme(name) {
  let family = THEME_FAMILY[name];
  if (!family && typeof getCustomTheme === 'function') {
    const ct = getCustomTheme(name);
    if (ct) family = ct.family;
  }
  if (!family) { name = 'light'; family = 'light'; }
  theme = name;
  themeFamily = family;
  darkMode = themeFamily === 'dark';
  DB.set('theme', theme);
  DB.set('themeFamily', themeFamily);
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-theme-family', themeFamily);
  if (typeof updateThemeIcon === 'function') updateThemeIcon();
  if (typeof renderDesk === 'function') renderDesk();
  if (typeof renderCalendar === 'function') renderCalendar();
  if (typeof renderGuideShelf === 'function') renderGuideShelf();
  // Eigene Farbwerte (inline CSS-Variablen), Hintergrundbild, Kalender-
  // bilder, Start-Banner und Icon des neuen Themes — siehe
  // js/theme-engine.js. Für Cozy Tag/Nacht (light/dark) kommen die Farben
  // weiterhin allein über das data-theme-Attribut aus main.css.
  if (typeof applyThemeEngine === 'function') applyThemeEngine(theme);
}

// ── Tag/Nacht-Themes ────────────────────────────────────────────────────
// Ein Theme kann eine Tag- und eine Nachtversion haben, die in der Theme-
// Auswahl als EIN Theme erscheinen (Button-Wert = Tag-ID): Cozy ('light' Tag
// / 'dark' Nacht) sowie eigene Themes mit Nachtversion aus dem Theme-Editor.
const DAYNIGHT_THEMES = { light: 'dark' };   // Tag-ID → Nacht-ID (fest in main.css)
// Eigene Themes können im Theme-Editor ebenfalls eine Nachtversion bekommen
// (ct.night, js/theme-engine.js) — deren ID ist dann "<id>:night".
const NIGHT_SUFFIX = ':night';
function nightThemeId(base) {
  if (DAYNIGHT_THEMES[base]) return DAYNIGHT_THEMES[base];
  if (!base || base.endsWith(NIGHT_SUFFIX) || typeof getCustomTheme !== 'function') return null;
  const ct = getCustomTheme(base);
  return ct && ct.night ? base + NIGHT_SUFFIX : null;
}
function dayNightBase(id) {
  if (!id) return null;
  if (DAYNIGHT_THEMES[id]) return id;
  const builtin = Object.keys(DAYNIGHT_THEMES).find(day => DAYNIGHT_THEMES[day] === id);
  if (builtin) return builtin;
  const base = id.endsWith(NIGHT_SUFFIX) ? id.slice(0, -NIGHT_SUFFIX.length) : id;
  return nightThemeId(base) ? base : null;
}
// Theme-ID, unter der ein Theme in der Auswahl steht (Tag-ID bzw. eigene ID).
function themePickerId(id) { return dayNightBase(id) || id; }

// Sonne/Mond-Knopf in der Sidebar pro Tag/Nacht-Theme ein-/ausblendbar
// (Einstellungen > Darstellung). Ohne Eintrag = eingeschaltet.
let dayNightToggle = DB.get('dayNightToggle', {});   // { [Tag-ID]: false }
function saveDayNightToggle() { DB.set('dayNightToggle', dayNightToggle); }
function isDayNightToggleOn(id = theme) {
  const base = dayNightBase(id);
  return !!base && dayNightToggle[base] !== false;
}

// Sonne/Mond-Knopf: wechselt innerhalb des aktiven Tag/Nacht-Themes.
function setDarkMode(dark) {
  const base = dayNightBase(theme);
  if (!base) return;
  setTheme(dark ? nightThemeId(base) : base);
}

// Prioritätsfarben wurden hier früher (applyColors) für alle Themes fest
// inline gesetzt — sie sind jetzt Theme-Variablen in css/main.css.
function hexToRgba(hex, alpha) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// =========================
// DATE HELPERS
// =========================

function getISOWeek(date) {
  const d=new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate()+3-((d.getDay()+6)%7));
  const w1=new Date(d.getFullYear(),0,4);
  return 1+Math.round(((d-w1)/MS_PER_DAY-3+((w1.getDay()+6)%7))/7);
}
function getWeekStart(date) {
  const d=new Date(date); d.setHours(0,0,0,0);
  const day=d.getDay()||7; d.setDate(d.getDate()-day+1); return d;
}
function getWeekId(date) {
  const d=new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate()+3-((d.getDay()+6)%7));
  return `${d.getFullYear()}-W${String(getISOWeek(date)).padStart(2,'0')}`;
}
function fmt(date,opts) { return date.toLocaleDateString('de-DE',opts); }
function isToday(date) {
  const t=new Date();
  return date.getFullYear()===t.getFullYear()&&date.getMonth()===t.getMonth()&&date.getDate()===t.getDate();
}
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function parseLocalDate(str) { const [y,m,d]=str.split('-').map(Number); return new Date(y,m-1,d); }
function getCurrentBlock() {
  const now=new Date();
  const hhmm=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  return blocks.find(b=>hhmm>=b.start&&hhmm<=b.end);
}

// =========================
// TASK QUERY HELPERS
// =========================

function dayStart(date) {
  const d = new Date(date); d.setHours(0,0,0,0); return d.getTime();
}
function dayEnd(date) {
  const d = new Date(date); d.setHours(23,59,59,999); return d.getTime();
}

/**
 * Tasks für einen Kalendertag — korrekte Logik:
 *
 * NICHT ABGESCHLOSSENE TASKS (offen ODER in Bearbeitung — "in_progress" zählt
 * hier ausdrücklich NICHT als erledigt):
 *   createdAt <= Ende des Tages
 *   UND Kalender-Tag <= heute
 *   → NICHT auf zukünftige Tage projizieren
 *
 * ERLEDIGTE TASKS:
 *   createdAt <= Ende des Tages  (Task existierte schon)
 *   UND completedAt >= Beginn des Tages  (war an diesem Tag noch offen oder wurde erledigt)
 *   UND Kalender-Tag <= completedAt  (nicht nach dem Erledigen weiterführen)
 */
function getTasksForCalendarDay(date) {
  const dStart   = dayStart(date);
  const dEnd     = dayEnd(date);
  const todayEnd = dayEnd(new Date()); // Ende des heutigen Tages

  return tasks.filter(t => {
    const created = t.createdAt || 0;

    // Task muss vor oder an diesem Tag erstellt worden sein
    if (created > dEnd) return false;

    if (!isTaskCompleted(t)) {
      // OFFEN oder IN BEARBEITUNG:
      // Nur anzeigen wenn der Kalender-Tag nicht in der Zukunft liegt.
      // dStart > todayEnd bedeutet: dieser Kalendertag ist noch nicht angebrochen.
      return dStart <= todayEnd;
    } else {
      // ERLEDIGTER TASK:
      // Sichtbar wenn der Task an diesem Tag noch offen war
      // (d.h. er wurde an/nach diesem Tag erledigt).
      // Und nicht über den Erledigungstag hinaus fortführen.
      const completed = t.completedAt || 0;
      return completed >= dStart;
    }
  });
}

/**
 * Tasks für die Aufgaben-Kachel (Heute-Ansicht, aktuelle Woche).
 * Erledigte Tasks verschwinden nach 7 Tagen.
 */
function getTasksForTile() {
  const now = Date.now();
  const sevenDaysAgo  = now - 7 * MS_PER_DAY;
  const weekMon       = getWeekStart(state.currentDate).getTime();
  const weekMonNext   = weekMon + 7 * MS_PER_DAY;

  return tasks.filter(t => {
    const created = t.createdAt || 0;
    if (created >= weekMonNext) return false;
    if (!isTaskCompleted(t)) return true;
    const completed = t.completedAt || 0;
    return completed >= sevenDaysAgo;
  });
}

/**
 * Tasks für die Block-Ansicht — gleiche Logik wie Kalendertag,
 * angewendet auf state.currentDate.
 */
function getTasksForBlockView() {
  return getTasksForCalendarDay(state.currentDate);
}

// =========================
// VIEW SWITCHING
// =========================

const viewMap={};
document.querySelectorAll('.view').forEach(v=>{ viewMap[v.id.replace('view-','')]=v; });
let currentView='today';

// Tabs, die in der Mobile-Bottom-Nav einen eigenen Button haben (siehe
// index.html #mobile-bottom-nav) — alle anderen Views gelten dort als
// "im Mehr-Menü", der Mehr-Button bekommt dann statt eines der 4 Buttons
// den Aktiv-Zustand. Vom Nutzer wählbar (Einstellungen > Navigation),
// tatsächlich angezeigt wird bottomNavActive (siehe applyBottomNav()).
const BOTTOM_NAV_SLOTS = 4;
const BOTTOM_NAV_DEFAULT = ['today', 'calendar', 'budget', 'games'];
let bottomNavTabs = DB.get('bottomNavTabs', BOTTOM_NAV_DEFAULT.slice());
function saveBottomNavTabs(){ DB.set('bottomNavTabs', bottomNavTabs); }
let bottomNavActive = BOTTOM_NAV_DEFAULT.slice();

// =========================
// TAB-SICHTBARKEIT (Einstellungen -> "Sichtbare Tabs")
// Einzige Quelle für: welche Tabs überhaupt ausgeblendet werden dürfen
// (TAB_VISIBILITY_CONFIG, von settings.js zum Rendern der Toggle-Liste
// wiederverwendet) + das tatsächliche Ein-/Ausblenden in allen drei
// Nav-Stellen (Sidebar, Mobile-Bottom-Nav, "Mehr"-Seite — alle drei nutzen
// dieselbe .nav-btn[data-view]-Struktur, siehe showView() oben).
// "today" und "settings" sind bewusst NICHT toggelbar: ohne Settings käme
// man nicht mehr an diese Einstellung heran, "today" ist der feste
// Reload-/Fallback-Zielpunkt (siehe initialView-Logik in settings.js).
// =========================
const TAB_VISIBILITY_CONFIG = [
  { id: 'pinboard',   label: 'Pinnwand' },
  { id: 'calendar',   label: 'Kalender' },
  { id: 'projects',   label: 'Projekte' },
  { id: 'questboard', label: 'Questboard' },
  { id: 'garden',     label: 'Garten' },
  { id: 'flashcards', label: 'Karteikarten' },
  { id: 'guides',     label: 'Anleitungen' },
  { id: 'budget',     label: 'Budget' },
  { id: 'games',      label: 'Spiele' },
  { id: 'tools',      label: 'Tools' },
];

function applyTabVisibility() {
  TAB_VISIBILITY_CONFIG.forEach(tab => {
    const hidden = hiddenTabs.includes(tab.id);
    document.querySelectorAll(`.nav-btn[data-view="${tab.id}"]`).forEach(btn => {
      // Sidebar-Buttons stecken in <li>, Bottom-Nav/"Mehr"-Buttons sind
      // direkte Kinder ihres Containers -> jeweils die richtige Hülle
      // ausblenden, nicht nur den Button selbst.
      (btn.closest('li') || btn).classList.toggle('nav-item-hidden', hidden);
    });
  });
  applyBottomNav();
  // Ist die gerade aktive View jetzt ausgeblendet (z.B. während man selbst
  // in den Einstellungen den eigenen aktuellen Tab abwählt), auf Today
  // zurückfallen statt eine unsichtbare View aktiv zu lassen.
  if (hiddenTabs.includes(currentView)) showView('today');
}

// Bottom-Nav (Handy): gewählte Tabs in gewählter Reihenfolge; ausgeblendete
// Tabs hinterlassen keine Lücke, sondern werden mit den nächsten sichtbaren
// Tabs (Heute, dann tabOrder) aufgefüllt. Was unten steht, verschwindet von
// der "Mehr"-Seite, alles andere steht dort.
function computeBottomNavActive() {
  const visible = id => id === 'today' || (TAB_VISIBILITY_CONFIG.some(t => t.id === id) && !hiddenTabs.includes(id));
  const list = [];
  (Array.isArray(bottomNavTabs) ? bottomNavTabs : []).forEach(id => {
    if (visible(id) && !list.includes(id) && list.length < BOTTOM_NAV_SLOTS) list.push(id);
  });
  ['today', ...tabOrder].forEach(id => {
    if (list.length < BOTTOM_NAV_SLOTS && visible(id) && !list.includes(id)) list.push(id);
  });
  return list;
}

function applyBottomNav() {
  bottomNavActive = computeBottomNavActive();
  document.querySelectorAll('#mobile-bottom-nav .nav-btn').forEach(btn => {
    const idx = bottomNavActive.indexOf(btn.dataset.view);
    btn.classList.toggle('bottom-nav-off', idx === -1);
    btn.style.order = idx === -1 ? '' : String(idx);
  });
  document.querySelectorAll('#view-mehr .mehr-section').forEach(section => {
    const btns = [...section.querySelectorAll('.nav-btn')];
    if (!btns.length) return;
    btns.forEach(b => b.classList.toggle('nav-in-bottombar', bottomNavActive.includes(b.dataset.view)));
    const shown = btns.filter(b => !b.classList.contains('nav-in-bottombar') && !b.classList.contains('nav-item-hidden'));
    btns.forEach(b => b.classList.toggle('mehr-first', b === shown[0]));
    section.classList.toggle('hidden', shown.length === 0);
  });
  if (typeof currentView === 'string') {
    document.getElementById('bottom-nav-more-btn')?.classList.toggle('active', !bottomNavActive.includes(currentView));
  }
}

// Vom Nutzer wählbare Reihenfolge der togglebaren Tabs (Einstellungen ->
// "Sichtbare Tabs", Auf/Ab-Pfeile) — Liste von View-Namen aus
// TAB_VISIBILITY_CONFIG. "today" und "settings" sind fest an erster/letzter
// Stelle (siehe applyTabVisibility()-Kommentar oben) und daher nicht Teil
// dieser Liste. Neu hinzugekommene Tabs (Config wächst über Zeit) werden
// beim Laden ans Ende gehängt, entfernte Tabs rausgefiltert — sonst bliebe
// eine alte gespeicherte Reihenfolge irgendwann inkonsistent zur Config.
let tabOrder = DB.get('tabOrder', null);
{
  const validIds = TAB_VISIBILITY_CONFIG.map(t => t.id);
  if (!Array.isArray(tabOrder)) tabOrder = validIds.slice();
  else {
    tabOrder = tabOrder.filter(id => validIds.includes(id));
    validIds.forEach(id => { if (!tabOrder.includes(id)) tabOrder.push(id); });
  }
}
function saveTabOrder(){ DB.set('tabOrder', tabOrder); }

// Ordnet die Elemente einer Nav-Gruppe (Sidebar-<li>s oder die Buttons
// einer "Mehr"-Gruppe) gemäß tabOrder neu an. Elemente, deren data-view
// nicht in tabOrder steckt (today/settings/andere "Mehr"-Gruppen), werden
// nicht angefasst — nur die Teilmenge, die tatsächlich in tabOrder steht,
// wird an der Stelle des ersten betroffenen Elements neu eingefügt.
function reorderNavGroup(container, itemSelector, getViewId) {
  if (!container) return;
  const map = {};
  container.querySelectorAll(itemSelector).forEach(el => {
    const id = getViewId(el);
    if (id) map[id] = el;
  });
  const relevant = tabOrder.filter(id => map[id]);
  if (relevant.length < 2) return;
  const anchor = document.createComment('tab-order-anchor');
  map[relevant[0]].parentNode.insertBefore(anchor, map[relevant[0]]);
  relevant.forEach(id => container.insertBefore(map[id], anchor));
  anchor.remove();
}

function applyTabOrder() {
  reorderNavGroup(document.getElementById('nav-list'), 'li', li => li.querySelector('.nav-btn')?.dataset.view);
  // Erste ".mehr-group" in der "Mehr"-Seite ist die "Organisieren"-Gruppe
  // (Pinnwand/Projekte/Garten/Karteikarten/Anleitungen) — Tools und
  // Einstellungen stecken in eigenen Einzel-Gruppen und bleiben unberührt.
  reorderNavGroup(document.querySelector('#view-mehr .mehr-group'), '.nav-btn', btn => btn.dataset.view);
  applyBottomNav();
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>{ b.classList.remove('active'); b.removeAttribute('aria-current'); });
  const view=viewMap[name]; if(view) view.classList.add('active');
  // querySelectorAll statt querySelector: derselbe data-view-Button existiert
  // doppelt (Sidebar + Bottom-Nav), beide sollen aktiv markiert werden.
  document.querySelectorAll(`.nav-btn[data-view="${name}"]`).forEach(b=>{ b.classList.add('active'); b.setAttribute('aria-current', 'page'); });
  document.getElementById('bottom-nav-more-btn')?.classList.toggle('active', !bottomNavActive.includes(name));
  currentView=name; renderView(name);
  // URL-Hash spiegelt die aktuelle View, damit ein Reload wieder hier landet
  // (siehe hashchange-Listener unten). "mehr" ist nur eine mobile Overlay-
  // Ansicht über der eigentlichen View und wird daher nicht in der URL abgebildet.
  // replaceState statt location.hash=…, damit kein zusätzlicher History-Eintrag
  // entsteht und kein hashchange-Event (→ keine Rekursion) ausgelöst wird.
  if (name !== 'mehr' && location.hash !== '#'+name) {
    history.replaceState(null, '', '#'+name);
  }
}
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click',()=>showView(btn.dataset.view));
});
// Tooltips für die eingeklappte Sidebar (dort sind nur die Icons sichtbar).
document.querySelectorAll('#nav-list .nav-btn').forEach(btn => {
  if (!btn.title) btn.title = btn.textContent.trim();
});
applyTabOrder();
applyTabVisibility();

// Startbildschirm für den ersten Aufruf (settings.js: INIT) — siehe startView.
function resolveInitialView() {
  const usable = v => v && v !== 'mehr' && viewMap[v] && !hiddenTabs.includes(v);
  if (startView && startView !== 'last') return usable(startView) ? startView : 'today';
  const fromHash = location.hash.replace(/^#/, '');
  return usable(fromHash) ? fromHash : 'today';
}

// ── Sidebar einklappen (nur Desktop/Tablet, auf dem Handy gibt es sie nicht)
function updateSidebarCollapseBtn() {
  const btn = document.getElementById('sidebar-collapse-btn');
  if (!btn) return;
  const label = sidebarCollapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-expanded', String(!sidebarCollapsed));
}
document.getElementById('sidebar-collapse-btn')?.addEventListener('click', () => {
  sidebarCollapsed = !sidebarCollapsed;
  saveSidebarCollapsed();
  applyUiPrefs();
  updateSidebarCollapseBtn();
});
updateSidebarCollapseBtn();

// Erlaubt Direktlinks/Browser-Navigation über den Hash (z.B. manuell
// editierte URL); löst nicht durch showView() selbst aus, da dieses
// history.replaceState() statt location.hash=… verwendet.
window.addEventListener('hashchange', () => {
  const name = location.hash.replace(/^#/, '');
  if (name && name !== currentView && name !== 'mehr' && viewMap[name] && !hiddenTabs.includes(name)) showView(name);
});

// ── Mobile "Mehr"-Seite (≤480px, siehe css/main.css) ────────────────
// Ersetzt den früheren Off-Canvas-Sidebar-Drawer durch eine eigene
// Vollbild-View (#view-mehr) — Grund: Nav-Liste + Positivity +
// Countdowns + Footer sprengten zusammen auf kleinen Screens die
// 100vh-Drawer-Höhe, overflow:hidden schnitt den Countdown-Bereich
// dabei komplett unsichtbar ab. Als normale View scrollt <main> statt
// zu clippen.
let viewBeforeMehr = 'today';
document.getElementById('bottom-nav-more-btn')?.addEventListener('click', () => {
  viewBeforeMehr = currentView;
  showView('mehr');
});
document.getElementById('mehr-close-btn')?.addEventListener('click', () => showView(viewBeforeMehr));

// #sidebar-positivity/#sidebar-countdowns leben nur einmal im DOM
// (positivity.js/today.js rendern jeweils in genau einen Container per
// ID) und werden hier je nach Breite zwischen Desktop-Sidebar und
// Mehr-Seite umgehängt statt dupliziert.
const mehrPhoneQuery = window.matchMedia('(max-width: 480px)');
function placeSidebarWidgets(isPhone) {
  const positivity = document.getElementById('sidebar-positivity');
  const countdowns = document.getElementById('sidebar-countdowns');
  if (!positivity || !countdowns) return;
  if (isPhone) {
    document.getElementById('mehr-positivity-slot')?.appendChild(positivity);
    document.getElementById('mehr-countdown-slot')?.appendChild(countdowns);
  } else {
    document.getElementById('sidebar')?.append(positivity, countdowns);
  }
}
placeSidebarWidgets(mehrPhoneQuery.matches);
mehrPhoneQuery.addEventListener('change', e => placeSidebarWidgets(e.matches));

function renderView(name) {
  if(name==='today')     { renderBlocks(); renderTasks(); refreshTodayTextareas(); renderGruppendienste(); renderMealPlan(); }
  if(name==='pinboard')  { renderDesk(); }
  if(name==='flashcards'){ renderSubjectList(); }
  if(name==='guides')    { initGuides(); }
  if(name==='calendar')  { renderCalendar(); }
  if(name==='budget')    { renderBudget(); }
  if(name==='games')     { initGames(); }
  if(name==='tools')     { initTools(); }
  if(name==='settings')  { renderSettings(); }
  if(name==='projects')  { renderProjects(); }
  if(name==='garden')    { renderGarden(); }
  if(name==='questboard'){ renderQuestboard(); }
}

// =========================
// TAG/NACHT AUTOMATISCH (Einstellungen > Darstellung)
// 'off' = nur manuell (Sonne/Mond), 'system' = folgt dem hellen/dunklen
// Modus des Geräts, 'sun' = Sonnenauf-/-untergang aus den Wetterdaten
// (today.js: isStartHeaderDaytime), ohne aktuelle Daten 7–19 Uhr.
// Gewechselt wird nur, wenn sich der berechnete Zustand ändert — ein
// manueller Klick auf Sonne/Mond gilt also bis zum nächsten Wechselpunkt.
// =========================
let themeAutoMode = DB.get('themeAutoMode', 'off');
function saveThemeAutoMode(){ DB.set('themeAutoMode', themeAutoMode); }
const themeSystemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let themeAutoLastDark = null;

function themeAutoWantsDark() {
  if (themeAutoMode === 'system') return themeSystemDarkQuery.matches;
  if (themeAutoMode === 'sun') {
    const w = DB.get('weatherData', null);
    const fresh = w && w.ts && Date.now() - w.ts < 20 * 3600 * 1000;
    const isDay = fresh && typeof isStartHeaderDaytime === 'function' ? isStartHeaderDaytime(w) : null;
    if (isDay !== null) return !isDay;
    const h = new Date().getHours();
    return h < 7 || h >= 19;
  }
  return null;
}

function applyThemeAuto(force) {
  if (!dayNightBase(theme)) return;
  const dark = themeAutoWantsDark();
  if (dark === null) { themeAutoLastDark = null; return; }
  if (!force && dark === themeAutoLastDark) return;
  themeAutoLastDark = dark;
  if (dark !== darkMode) setDarkMode(dark);
}
function onThemeAutoWeatherUpdate() { applyThemeAuto(false); }

themeSystemDarkQuery.addEventListener('change', () => applyThemeAuto(false));
setInterval(() => applyThemeAuto(false), 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) applyThemeAuto(false); });
// Erst wenn alle Skripte geladen sind — eigene Themes mit Nachtversion
// kennt erst js/theme-engine.js (getCustomTheme).
document.addEventListener('DOMContentLoaded', () => applyThemeAuto(true));
