// =========================
// STATE & STORAGE
// =========================

const DB = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
};

const DEFAULT_BLOCKS = [
  { id: 1, label: 'Block 1', start: '07:30', end: '09:00' },
  { id: 2, label: 'Block 2', start: '09:15', end: '11:30' },
  { id: 3, label: 'Block 3', start: '12:15', end: '14:00' },
  { id: 4, label: 'Block 4', start: '14:30', end: '16:10', free: true },
];

const DEFAULT_COLORS = { event: '#2563eb', prio1: '#dc2626', prio2: '#2563eb', prio3: '#6b7280' };

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
// THEME_FAMILY ordnet jedem Theme-Namen seine Farbfamilie zu. Neue Themes
// (Midnight, Forest, Espresso, OLED) nutzen in Phase 2 bewusst dieselbe
// "dark"-Familie wie der bisherige Dark Mode — sie bekommen erst in Phase 3
// eigene Farbwerte. Neue Themes werden hier einfach ergänzt.
const THEME_FAMILY = {
  light:    'light',
  dark:     'dark',
  midnight: 'dark',
  forest:   'dark',
  espresso: 'dark',
  oled:     'dark',
};
// Migration: altes darkMode-Boolean → theme-String (einmalig, dann bleibt
// nur noch der 'theme'-Key maßgeblich).
let theme = DB.get('theme', null);
if (theme === null) {
  theme = DB.get('darkMode', false) ? 'dark' : 'light';
  DB.set('theme', theme);
}
// Eigene Themes (Theme-Builder, js/theme-builder.js) stehen nicht in
// THEME_FAMILY — deren Familie wird beim Erstellen/Anwenden zusätzlich
// unter 'themeFamily' gespeichert, damit dieses frühe Initial-Setup sie
// korrekt setzen kann, ohne dass main.js die customThemes-Liste selbst
// kennen müsste (die lädt erst später).
let themeFamily = THEME_FAMILY[theme] || DB.get('themeFamily', 'light');
// darkMode bleibt als abgeleiteter Boolean bestehen — für bestehende
// Stellen, die nur zwischen hell/dunkel unterscheiden (Sonne/Mond-Icon
// in today.js, Sidebar-Schnellumschalter).
let darkMode = themeFamily === 'dark';
let colors           = DB.get('colors', DEFAULT_COLORS);
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

// ── Zentraler Theme-Switch ──────────────────────────────────────────────
// Einziger Ort, der theme setzt/speichert und alle Folgen auslöst:
// data-theme-/data-theme-family-Attribute, Sidebar-Icon, und Neu-Rendern
// der Ansichten mit nutzerdefinierten Farben (--user-color-*, siehe
// hub-utils.js), damit diese sofort statt erst beim nächsten Tab-Wechsel
// aktualisiert werden.
// Wird von der Theme-Auswahl in den Einstellungen (settings.js) aufgerufen.
// Akzeptiert neben den 6 eingebauten Namen auch die ID eines eigenen
// Themes (Theme-Builder, js/theme-builder.js) — dessen Familie steht
// nicht in THEME_FAMILY, sondern wird aus customThemes nachgeschlagen,
// falls dieses bereits geladen ist (siehe Skript-Ladereihenfolge unten).
function setTheme(name) {
  let family = THEME_FAMILY[name];
  if (!family && typeof customThemes !== 'undefined') {
    const ct = customThemes.find(t => t.id === name);
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
  // Eigene Farbwerte (inline CSS-Variablen) anwenden/entfernen — siehe
  // js/theme-builder.js. Für die 6 eingebauten Themes reicht das
  // data-theme-Attribut allein (Farben kommen aus main.css), die Funktion
  // entfernt dort nur evtl. noch gesetzte Inline-Variablen eines zuvor
  // aktiven eigenen Themes.
  if (typeof applyCustomThemeVars === 'function') applyCustomThemeVars();
  // Hintergrundbild ist pro Theme hinterlegt (js/theme-builder.js) — beim
  // Wechsel neu anwenden, damit ein evtl. für das NEUE Theme gespeichertes
  // Bild erscheint bzw. keins mehr, wenn das neue Theme keins hat.
  if (typeof applyThemeBackground === 'function') applyThemeBackground();
}

// Schnellumschalter (Sidebar Sonne/Mond) — schaltet nur zwischen Light und
// dem zuletzt aktiven Dark-Theme hin und her, ohne die übrigen Dark-Varianten
// aus der Einstellungsseite zu berühren.
let lastDarkTheme = themeFamily === 'dark' ? theme : 'dark';
function setDarkMode(dark) {
  if (dark) { lastDarkTheme = themeFamily === 'dark' ? theme : lastDarkTheme; setTheme(lastDarkTheme); }
  else      { setTheme('light'); }
}

function applyColors() {
  const r = document.documentElement.style;
  r.setProperty('--event-color',    colors.event);
  r.setProperty('--event-color-bg', hexToRgba(colors.event, 0.1));
  r.setProperty('--prio-1',         colors.prio1);
  r.setProperty('--prio-1-bg',      hexToRgba(colors.prio1, 0.08));
  r.setProperty('--prio-2',         colors.prio2);
  r.setProperty('--prio-2-bg',      hexToRgba(colors.prio2, 0.08));
  r.setProperty('--prio-3',         colors.prio3);
  r.setProperty('--prio-3-bg',      hexToRgba(colors.prio3, 0.08));
}
function hexToRgba(hex, alpha) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
applyColors();

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
// den Aktiv-Zustand.
const BOTTOM_NAV_VIEWS = ['today', 'calendar', 'budget', 'games'];

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
  // Ist die gerade aktive View jetzt ausgeblendet (z.B. während man selbst
  // in den Einstellungen den eigenen aktuellen Tab abwählt), auf Today
  // zurückfallen statt eine unsichtbare View aktiv zu lassen.
  if (hiddenTabs.includes(currentView)) showView('today');
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
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const view=viewMap[name]; if(view) view.classList.add('active');
  // querySelectorAll statt querySelector: derselbe data-view-Button existiert
  // doppelt (Sidebar + Bottom-Nav), beide sollen aktiv markiert werden.
  document.querySelectorAll(`.nav-btn[data-view="${name}"]`).forEach(b=>b.classList.add('active'));
  document.getElementById('bottom-nav-more-btn')?.classList.toggle('active', !BOTTOM_NAV_VIEWS.includes(name));
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
applyTabOrder();
applyTabVisibility();

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
    document.getElementById('sidebar-footer')?.before(positivity, countdowns);
  }
}
placeSidebarWidgets(mehrPhoneQuery.matches);
mehrPhoneQuery.addEventListener('change', e => placeSidebarWidgets(e.matches));

function renderView(name) {
  if(name==='today')     { renderBlocks(); renderTasks(); refreshTodayTextareas(); renderGruppendienste(); }
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
}
