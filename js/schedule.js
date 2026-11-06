// =========================
// STUNDENPLAN — Datenschicht (Wochenstruktur pro Wochentag)
// Erweitert die früheren, für alle Tage gleichen Zeitblöcke (`blocks`,
// main.js) um eine eigene Struktur je Wochentag: Tagesrahmen, Schulzeit,
// Pausen, Projekt-/Arbeitsblöcke — plus Unterricht mit Fächern/Lehrkräften
// und Tagesvorlagen. Heute (today.js) zeigt daraus die Zeitleiste des
// angezeigten Tages; bearbeitet wird in js/schedule-editor.js.
//
// Lädt nach main.js (braucht DB, blocks) und vor today.js (renderBlocks
// nutzt die Funktionen hier). Projekte (projects.js) werden erst zur
// Laufzeit gelesen, daher per typeof geprüft.
//
// Datenmodell (alle Zeiten "HH:MM", 24h):
//   scheduleWeek      = { days: { '0'..'6': Day } }   Schlüssel = Date.getDay() (0 = Sonntag)
//   Day               = { enabled, start, end, school: null | { start, end },
//                         breaks: [{ id, label, start, end }],
//                         blocks: [{ id, label, start, end, kind, projectId }] }
//   scheduleLessons   = [{ id, weekday, start, end, subjectId, teacherId, room, notes }]
//   scheduleSubjects  = [{ id, name }]
//   scheduleTeachers  = [{ id, name, subjectIds: [] }]
//   scheduleTemplates = [{ id, name, day: Day }]       Ausgangspunkt, keine Verknüpfung
//
// Block-IDs sind Zahlen und nur innerhalb eines Tages eindeutig: Kopien
// eines Tages behalten die IDs, damit Aufgaben (task.blocks) an allen
// Tagen mit diesem Block erscheinen. Jeder Tag ist trotzdem ein eigenes
// Objekt — Änderungen an einem Tag verändern nie einen anderen.
// =========================

const SCHEDULE_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // Anzeige-Reihenfolge Mo … So
const SCHEDULE_DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const SCHEDULE_DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Blockarten — Anzeige und Farbe kommen aus dieser Liste, nicht aus Code-Verzweigungen.
const SCHEDULE_BLOCK_KINDS = {
  project: { label: 'Projekt',      icon: '🌳' },
  learn:   { label: 'Lernen',       icon: '📚' },
  org:     { label: 'Organisation', icon: '🗂️' },
  other:   { label: 'Sonstiges',    icon: '✳️' },
  free:    { label: 'Freie Zeit',   icon: '☁️' },
};

function scheduleToMin(t) {
  if (typeof t !== 'string' || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
function scheduleFromMin(v) {
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
}
let scheduleIdSeq = 0;
function scheduleNewId() {
  scheduleIdSeq = (scheduleIdSeq + 1) % 1000;
  return Date.now() * 1000 + scheduleIdSeq;
}
function scheduleClone(v) { return JSON.parse(JSON.stringify(v)); }
function scheduleEmptyDay(enabled = false) {
  return { enabled, start: '08:00', end: '16:00', school: null, breaks: [], blocks: [] };
}

// Repariert fehlende Felder eines Tages (Sync aus älteren Ständen, Import)
function scheduleNormalizeDay(day) {
  const d = Object.assign(scheduleEmptyDay(false), day || {});
  d.enabled = !!d.enabled;
  if (!d.school || scheduleToMin(d.school.start) === null || scheduleToMin(d.school.end) === null) d.school = null;
  d.breaks = Array.isArray(d.breaks) ? d.breaks.filter(b => b && b.id != null) : [];
  d.blocks = Array.isArray(d.blocks) ? d.blocks.filter(b => b && b.id != null) : [];
  d.blocks.forEach(b => {
    if (!SCHEDULE_BLOCK_KINDS[b.kind]) b.kind = 'other';
    if (b.kind !== 'project') b.projectId = null;
  });
  return d;
}

// =========================
// REINE BERECHNUNG (ohne DOM/Speicher — tests/schedule.test.js prüft sie)
// =========================

// Setzt die Zeitleiste eines Tages zusammen. Vorrang je Minute:
// Pause > Unterricht > Schulzeit ohne Stunde > Block > nicht zugewiesen.
// Blöcke, die in Pausen oder Unterricht ragen, werden dort nur nicht
// angezeigt — gespeichert bleibt der Block unverändert (die Validierung
// weist auf die Überschneidung hin, statt still etwas zu überschreiben).
// names: { project(id), subject(id), teacher(id) } für die Beschriftung.
function scheduleComputeSegments(day, lessons, names = {}) {
  if (!day || !day.enabled) return { off: true, start: null, end: null, segments: [] };
  const S = scheduleToMin(day.start), E = scheduleToMin(day.end);
  if (S === null || E === null || E <= S) return { off: true, start: null, end: null, segments: [] };

  const span = (o) => {
    const a = scheduleToMin(o.start), b = scheduleToMin(o.end);
    if (a === null || b === null || b <= a) return null;
    const lo = Math.max(a, S), hi = Math.min(b, E);
    return hi > lo ? [lo, hi] : null;
  };
  const breaks = (day.breaks || []).map(b => ({ b, r: span(b) })).filter(x => x.r);
  const school = day.school ? span(day.school) : null;
  const lessonList = school ? (lessons || []).map(l => ({ l, r: span(l) })).filter(x => x.r) : [];
  const blockList = (day.blocks || []).map(b => ({ b, r: span(b) })).filter(x => x.r);

  const points = new Set([S, E]);
  [...breaks, ...lessonList, ...blockList].forEach(x => { points.add(x.r[0]); points.add(x.r[1]); });
  if (school) { points.add(school[0]); points.add(school[1]); }
  const sorted = [...points].filter(p => p >= S && p <= E).sort((a, b) => a - b);
  const inside = (r, a, b) => r[0] <= a && r[1] >= b;

  const pieces = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    let piece;
    const br = breaks.find(x => inside(x.r, a, b));
    if (br) piece = { type: 'break', key: 'break:' + br.b.id, ref: br.b };
    else if (school && inside(school, a, b)) {
      const ls = lessonList.find(x => inside(x.r, a, b));
      piece = ls ? { type: 'lesson', key: 'lesson:' + ls.l.id, ref: ls.l } : { type: 'school', key: 'school' };
    } else {
      const bl = blockList.find(x => inside(x.r, a, b));
      piece = bl ? { type: 'block', key: 'block:' + bl.b.id, ref: bl.b } : { type: 'unassigned', key: 'unassigned' };
    }
    piece.a = a; piece.b = b;
    const last = pieces[pieces.length - 1];
    if (last && last.key === piece.key && last.b === a) last.b = b; else pieces.push(piece);
  }

  const segments = pieces.map(p => {
    const seg = { type: p.type, start: scheduleFromMin(p.a), end: scheduleFromMin(p.b) };
    if (p.type === 'break') { seg.id = p.ref.id; seg.label = p.ref.label || 'Pause'; }
    if (p.type === 'school') seg.label = 'Unterricht';
    if (p.type === 'unassigned') seg.label = 'Nicht zugewiesen';
    if (p.type === 'lesson') {
      const l = p.ref;
      seg.id = l.id;
      seg.label = (names.subject && names.subject(l.subjectId)) || 'Unterricht';
      seg.teacher = (names.teacher && names.teacher(l.teacherId)) || '';
      seg.room = l.room || '';
      seg.notes = l.notes || '';
    }
    if (p.type === 'block') {
      const b = p.ref;
      seg.id = b.id; seg.kind = b.kind || 'other'; seg.projectId = b.projectId || null;
      const projectName = seg.kind === 'project' && names.project ? names.project(b.projectId) : '';
      seg.label = (b.label || '').trim() || projectName || (SCHEDULE_BLOCK_KINDS[seg.kind] || SCHEDULE_BLOCK_KINDS.other).label;
      seg.project = projectName || '';
    }
    return seg;
  });
  return { off: false, start: day.start, end: day.end, segments };
}

// Prüft einen Tag und liefert Hinweise [{ ref, msg }] — ref ist 'day',
// 'school', 'break:<id>', 'block:<id>' oder 'lesson:<id>'. Speichern wird
// dadurch nie blockiert (man tippt oft erst Beginn, dann Ende).
function scheduleValidateDay(day, lessons) {
  const out = [];
  if (!day || !day.enabled) return out;
  const S = scheduleToMin(day.start), E = scheduleToMin(day.end);
  if (S === null || E === null) { out.push({ ref: 'day', msg: 'Beginn und Ende brauchen eine gültige Uhrzeit' }); return out; }
  if (E <= S) { out.push({ ref: 'day', msg: 'Das Tagesende liegt nicht nach dem Beginn' }); return out; }

  const rng = o => { const a = scheduleToMin(o.start), b = scheduleToMin(o.end); return (a === null || b === null) ? null : [a, b]; };
  const overlaps = (x, y) => x[0] < y[1] && y[0] < x[1];
  const checkSelf = (ref, name, r) => {
    if (!r) { out.push({ ref, msg: `${name}: ungültige Uhrzeit` }); return false; }
    if (r[1] <= r[0]) { out.push({ ref, msg: `${name}: Ende liegt nicht nach dem Beginn` }); return false; }
    if (r[0] < S || r[1] > E) out.push({ ref, msg: `${name}: liegt außerhalb des Tages (${day.start}–${day.end})` });
    return true;
  };

  const school = day.school ? rng(day.school) : null;
  if (day.school) checkSelf('school', 'Schulzeit', school);
  const okSchool = school && school[1] > school[0] ? school : null;

  const brs = (day.breaks || []).map(b => ({ b, r: rng(b) }));
  brs.forEach(x => { if (!checkSelf('break:' + x.b.id, x.b.label || 'Pause', x.r)) x.r = null; });
  brs.forEach((x, i) => brs.slice(i + 1).forEach(y => {
    if (x.r && y.r && overlaps(x.r, y.r)) out.push({ ref: 'break:' + y.b.id, msg: `${y.b.label || 'Pause'}: überschneidet sich mit „${x.b.label || 'Pause'}“` });
  }));

  const bls = (day.blocks || []).map(b => ({ b, r: rng(b), name: (b.label || '').trim() || 'Block' }));
  bls.forEach(x => {
    if (!checkSelf('block:' + x.b.id, x.name, x.r)) { x.r = null; return; }
    brs.forEach(y => { if (y.r && overlaps(x.r, y.r)) out.push({ ref: 'block:' + x.b.id, msg: `${x.name}: kollidiert mit der Pause ${y.b.start}–${y.b.end}` }); });
    if (okSchool && overlaps(x.r, okSchool)) out.push({ ref: 'block:' + x.b.id, msg: `${x.name}: kollidiert mit der Schulzeit (${day.school.start}–${day.school.end})` });
  });
  bls.forEach((x, i) => bls.slice(i + 1).forEach(y => {
    if (x.r && y.r && overlaps(x.r, y.r)) out.push({ ref: 'block:' + y.b.id, msg: `${y.name}: überschneidet sich mit „${x.name}“` });
  }));

  const ls = (lessons || []).map(l => ({ l, r: rng(l) }));
  ls.forEach(x => {
    const name = 'Unterrichtsstunde ' + (x.l.start || '');
    if (!checkSelf('lesson:' + x.l.id, name, x.r)) { x.r = null; return; }
    if (!okSchool) out.push({ ref: 'lesson:' + x.l.id, msg: `${name}: an diesem Tag ist keine Schulzeit eingestellt` });
    else if (x.r[0] < okSchool[0] || x.r[1] > okSchool[1]) out.push({ ref: 'lesson:' + x.l.id, msg: `${name}: liegt außerhalb der Schulzeit` });
  });
  ls.forEach((x, i) => ls.slice(i + 1).forEach(y => {
    if (x.r && y.r && overlaps(x.r, y.r)) out.push({ ref: 'lesson:' + y.l.id, msg: `Unterrichtsstunde ${y.l.start}: überschneidet sich mit ${x.l.start}` });
  }));
  return out;
}

// Erste freie Lücke (≥ 15 min) der verfügbaren Arbeitszeit — Startwert
// für einen neuen Block, damit er nicht gleich mit etwas kollidiert.
function scheduleSuggestBlockSlot(day, length = 90) {
  const seg = scheduleComputeSegments(Object.assign({}, day, { enabled: true }), [], {}).segments
    .find(s => s.type === 'unassigned' && scheduleToMin(s.end) - scheduleToMin(s.start) >= 15);
  if (seg) {
    const a = scheduleToMin(seg.start);
    return { start: seg.start, end: scheduleFromMin(Math.min(scheduleToMin(seg.end), a + length)) };
  }
  const end = scheduleToMin(day.end) ?? 16 * 60;
  return { start: scheduleFromMin(Math.max(0, end - 60)), end: scheduleFromMin(end) };
}

// Wandelt die früheren globalen Blöcke in einen Tag um: Rahmen = erster
// Beginn bis letztes Ende, Lücken dazwischen werden Pausen, IDs bleiben.
function scheduleDayFromLegacyBlocks(legacy, enabled) {
  const valid = (Array.isArray(legacy) ? legacy : [])
    .filter(b => b && scheduleToMin(b.start) !== null && scheduleToMin(b.end) !== null && scheduleToMin(b.end) > scheduleToMin(b.start))
    .slice().sort((a, b) => scheduleToMin(a.start) - scheduleToMin(b.start));
  if (!valid.length) return scheduleEmptyDay(enabled);
  const day = scheduleEmptyDay(enabled);
  day.start = valid[0].start;
  day.end = valid.reduce((m, b) => (scheduleToMin(b.end) > scheduleToMin(m) ? b.end : m), valid[0].end);
  for (let i = 1; i < valid.length; i++) {
    const gapA = scheduleToMin(valid[i - 1].end), gapB = scheduleToMin(valid[i].start);
    if (gapB > gapA) day.breaks.push({ id: i, label: 'Pause', start: valid[i - 1].end, end: valid[i].start });
  }
  day.blocks = valid.map(b => ({ id: b.id, label: b.label || '', start: b.start, end: b.end, kind: b.free ? 'free' : 'other', projectId: null }));
  return day;
}

// Mitgelieferte Vorlagen — nur Startwerte, frei änderbar und löschbar.
function scheduleDefaultTemplates() {
  const brk = (label, start, end) => ({ id: scheduleNewId(), label, start, end });
  const blk = (label, start, end) => ({ id: scheduleNewId(), label, start, end, kind: 'other', projectId: null });
  return [
    { id: 'tpl-work', name: 'Normaler Arbeitstag', day: { enabled: true, start: '07:30', end: '16:10', school: null,
      breaks: [brk('Pause', '09:00', '09:20'), brk('Mittagspause', '11:30', '12:15'), brk('Pause', '14:00', '14:20')],
      blocks: [blk('Block 1', '07:30', '09:00'), blk('Block 2', '09:20', '11:30'), blk('Block 3', '12:15', '14:00'), blk('Block 4', '14:20', '16:10')] } },
    { id: 'tpl-school-work', name: 'Schultag mit anschließendem Arbeitstag', day: { enabled: true, start: '07:30', end: '16:10',
      school: { start: '07:30', end: '12:35' },
      breaks: [brk('Pause', '09:00', '09:20'), brk('Pause', '10:50', '11:05'), brk('Mittagspause', '12:35', '13:20')],
      blocks: [blk('Block 1', '13:20', '14:45'), blk('Block 2', '14:45', '16:10')] } },
    { id: 'tpl-school', name: 'Schultag ohne anschließende Arbeit', day: { enabled: true, start: '07:30', end: '13:20',
      school: { start: '07:30', end: '12:35' },
      breaks: [brk('Pause', '09:00', '09:20'), brk('Pause', '10:50', '11:05'), brk('Mittagspause', '12:35', '13:20')],
      blocks: [] } },
    { id: 'tpl-custom', name: 'Individueller Sondertag', day: { enabled: true, start: '09:00', end: '15:00', school: null, breaks: [], blocks: [] } },
  ];
}

// =========================
// SPEICHER (DB-Wrapper, je Bereich ein Key)
// =========================

let scheduleWeek      = DB.get('scheduleWeek', null);
let scheduleLessons   = DB.get('scheduleLessons', []);
let scheduleSubjects  = DB.get('scheduleSubjects', []);
let scheduleTeachers  = DB.get('scheduleTeachers', []);
let scheduleTemplates = DB.get('scheduleTemplates', null);
function saveScheduleWeek()      { DB.set('scheduleWeek', scheduleWeek); }
function saveScheduleLessons()   { DB.set('scheduleLessons', scheduleLessons); }
function saveScheduleSubjects()  { DB.set('scheduleSubjects', scheduleSubjects); }
function saveScheduleTeachers()  { DB.set('scheduleTeachers', scheduleTeachers); }
function saveScheduleTemplates() { DB.set('scheduleTemplates', scheduleTemplates); }

// Einmalig: Die bisherigen, für alle Tage gleichen Blöcke werden Mo–Fr
// übernommen (gleiche IDs → Aufgaben-Zuordnungen bleiben), Sa/So sind frei.
// Der alte Key `blocks` bleibt unangetastet liegen (kein Datenverlust).
(function migrateScheduleWeek() {
  if (!scheduleWeek || typeof scheduleWeek !== 'object' || !scheduleWeek.days) {
    const days = {};
    for (let wd = 0; wd < 7; wd++) days[wd] = scheduleDayFromLegacyBlocks(blocks, wd >= 1 && wd <= 5);
    scheduleWeek = { days };
    saveScheduleWeek();
  }
  for (let wd = 0; wd < 7; wd++) scheduleWeek.days[wd] = scheduleNormalizeDay(scheduleWeek.days[wd]);
  if (!Array.isArray(scheduleLessons)) scheduleLessons = [];
  if (!Array.isArray(scheduleSubjects)) scheduleSubjects = [];
  if (!Array.isArray(scheduleTeachers)) scheduleTeachers = [];
  scheduleTeachers.forEach(t => { if (!Array.isArray(t.subjectIds)) t.subjectIds = []; });
  if (!Array.isArray(scheduleTemplates)) { scheduleTemplates = scheduleDefaultTemplates(); saveScheduleTemplates(); }
})();

// =========================
// ZUGRIFF FÜR ANDERE DATEIEN (today.js, Editor)
// =========================

function scheduleDay(weekday) { return scheduleWeek.days[weekday]; }
function scheduleDayForDate(date) { return scheduleDay(date.getDay()); }
function scheduleLessonsForWeekday(weekday) {
  return scheduleLessons.filter(l => l.weekday === weekday)
    .sort((a, b) => (scheduleToMin(a.start) ?? 0) - (scheduleToMin(b.start) ?? 0));
}
const scheduleNames = {
  project: id => {
    if (typeof projects === 'undefined' || id == null) return '';
    const p = projects.find(x => x.id === id);
    return p ? p.name : '';
  },
  subject: id => (scheduleSubjects.find(s => s.id === id) || {}).name || '',
  teacher: id => (scheduleTeachers.find(t => t.id === id) || {}).name || '',
};
function scheduleSegmentsForDate(date) {
  return scheduleComputeSegments(scheduleDayForDate(date), scheduleLessonsForWeekday(date.getDay()), scheduleNames);
}
// Blöcke des Tages (für die Aufgaben-Zuordnung)
function scheduleBlocksForDate(date) {
  const day = scheduleDayForDate(date);
  return day && day.enabled ? day.blocks : [];
}
// Block per ID — zuerst am angegebenen Tag, sonst an irgendeinem Tag
function scheduleFindBlock(id, date) {
  const own = date ? scheduleBlocksForDate(date).find(b => b.id === id) : null;
  if (own) return own;
  for (const wd of SCHEDULE_WEEKDAYS) {
    const b = scheduleWeek.days[wd].blocks.find(x => x.id === id);
    if (b) return b;
  }
  return null;
}
function scheduleBlockDisplayName(block) {
  if (!block) return '';
  return (block.label || '').trim()
    || (block.kind === 'project' ? scheduleNames.project(block.projectId) : '')
    || (SCHEDULE_BLOCK_KINDS[block.kind] || SCHEDULE_BLOCK_KINDS.other).label;
}
// Wochentage, an denen ein Block mit dieser ID vorkommt (z.B. "Mo, Di, Mi")
function scheduleBlockWeekdays(id) {
  return SCHEDULE_WEEKDAYS.filter(wd => scheduleWeek.days[wd].enabled && scheduleWeek.days[wd].blocks.some(b => b.id === id))
    .map(wd => SCHEDULE_DAY_SHORT[wd]);
}
// Kurzbeschreibung eines Tages für die Wochenübersicht
function scheduleDaySummary(weekday) {
  const day = scheduleDay(weekday);
  if (!day.enabled) return 'frei';
  const parts = [`${day.start}–${day.end}`];
  if (day.school) parts.push(`Schule bis ${day.school.end}`);
  if (day.blocks.length) parts.push(`${day.blocks.length} ${day.blocks.length === 1 ? 'Block' : 'Blöcke'}`);
  return parts.join(' · ');
}

// Node-Tests (tests/schedule.test.js) laden diese Datei ohne Browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scheduleComputeSegments, scheduleValidateDay, scheduleDayFromLegacyBlocks, scheduleSuggestBlockSlot,
    scheduleDefaultTemplates, scheduleNormalizeDay, scheduleToMin, scheduleFromMin };
}
