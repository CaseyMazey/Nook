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
  currentDate: new Date(DB.get('currentDate') || new Date().toISOString()),
  currentWeekId: null,
  editingTask: null,
  selectedPriority: 2,
  editingEvent: null,
  activeSubjectId: null,
  editingCard: null,
  learnQueue: [], learnIndex: 0, learnFlipped: false,
  learnSubjId: null, learnGroupId: null,
};

let tasks            = DB.get('tasks', {});
let notes            = DB.get('notes', { 'exam-notes': [], 'class-questions': [], 'terms': [] });
let events           = DB.get('events', {});
let quicknote        = DB.get('quicknote', '');
let berichtsheft     = DB.get('berichtsheft', { betrieb: '', schule: '' });
let examDate         = new Date(DB.get('examDate') || '2026-06-15');
let blocks           = DB.get('blocks', DEFAULT_BLOCKS);
let countdownVisible = DB.get('countdownVisible', {});
let darkMode         = DB.get('darkMode', false);
let colors           = DB.get('colors', DEFAULT_COLORS);
let customTiles      = DB.get('customTiles', []);
let generalTodos     = DB.get('generalTodos', []);
let subjects         = DB.get('subjects', []);

let clockEnabled     = DB.get('clockEnabled', false);
let clockType        = DB.get('clockType', 'digital'); // 'digital' | 'analog'

// collapsed groups: Set of group IDs
let collapsedGroups  = new Set(DB.get('collapsedGroups', []));

if (darkMode) document.documentElement.setAttribute('data-theme', 'dark');

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
  return 1+Math.round(((d-w1)/86400000-3+((w1.getDay()+6)%7))/7);
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
// VIEW SWITCHING
// =========================

const viewMap={};
document.querySelectorAll('.view').forEach(v=>{ viewMap[v.id.replace('view-','')]=v; });
let currentView='today';

function showView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const view=viewMap[name]; if(view) view.classList.add('active');
  const btn=document.querySelector(`.nav-btn[data-view="${name}"]`); if(btn) btn.classList.add('active');
  currentView=name; renderView(name);
}
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click',()=>showView(btn.dataset.view));
});

function renderView(name) {
  if(name==='today')     { renderBlocks(); renderTasks(); renderNotes(); renderCustomTiles(); refreshTodayTextareas(); }
  if(name==='flashcards'){ renderSubjectList(); }
  if(name==='calendar')  { renderCalendar(); }
  if(name==='budget')    { renderBudget(); }
  if(name==='games')     { initGames(); }
  if(name==='settings')  { renderSettings(); }
}

