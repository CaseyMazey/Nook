// Tests für die Stundenplan-Berechnung (js/schedule.js).
// Ausführen: node --test tests/   (Node 18+, keine Abhängigkeiten)
// Die Web-App lädt js/schedule.js per <script>; hier wird sie mit einem
// Speicher-Ersatz geladen, damit nur die reinen Funktionen geprüft werden.
const test = require('node:test');
const assert = require('node:assert/strict');

const store = {};
globalThis.DB = { get: (k, f) => (k in store ? JSON.parse(store[k]) : f), set: (k, v) => { store[k] = JSON.stringify(v); } };
globalThis.blocks = [
  { id: 1, label: 'Block 1', start: '07:30', end: '09:00' },
  { id: 2, label: 'Block 2', start: '09:15', end: '11:30' },
  { id: 3, label: 'Block 3', start: '12:15', end: '14:00' },
  { id: 4, label: 'Block 4', start: '14:30', end: '16:10', free: true },
];
const S = require('../js/schedule.js');

const names = {
  project: id => ({ atlas: 'Projekt ATLAS', nora: 'Projekt NORA' }[id] || ''),
  subject: id => ({ ae: 'Anwendungsentwicklung', nt: 'Netzwerktechnik', ws: 'Wirtschaft und Soziales' }[id] || ''),
  teacher: id => ({ a: 'Lehrkraft A', b: 'Lehrkraft B', c: 'Lehrkraft C' }[id] || ''),
};
const tpl = id => JSON.parse(JSON.stringify(S.scheduleDefaultTemplates().find(t => t.id === id).day));
const brief = segs => segs.map(s => `${s.start}-${s.end} ${s.type}:${s.label}`);

test('Arbeitstag Mo–Mi: Pausen unterbrechen, Blöcke zeigen ihre Projekte', () => {
  const day = tpl('tpl-work');
  day.blocks[0].kind = 'project'; day.blocks[0].projectId = 'atlas'; day.blocks[0].label = '';
  day.blocks[1].kind = 'project'; day.blocks[1].projectId = 'nora'; day.blocks[1].label = '';
  day.blocks[2].label = 'Nook';
  day.blocks[3].kind = 'learn'; day.blocks[3].label = '';
  const { segments, off } = S.scheduleComputeSegments(day, [], names);
  assert.equal(off, false);
  assert.deepEqual(brief(segments), [
    '07:30-09:00 block:Projekt ATLAS',
    '09:00-09:20 break:Pause',
    '09:20-11:30 block:Projekt NORA',
    '11:30-12:15 break:Mittagspause',
    '12:15-14:00 block:Nook',
    '14:00-14:20 break:Pause',
    '14:20-16:10 block:Lernen',
  ]);
});

test('Donnerstag: Unterricht am Morgen, ab 13:20 Arbeitsblöcke', () => {
  const day = tpl('tpl-school-work');
  const lessons = [
    { id: 'l1', weekday: 4, start: '07:30', end: '09:00', subjectId: 'ae', teacherId: 'a' },
    { id: 'l2', weekday: 4, start: '09:20', end: '10:50', subjectId: 'nt', teacherId: 'b' },
    { id: 'l3', weekday: 4, start: '11:05', end: '12:35', subjectId: 'ws', teacherId: 'c' },
  ];
  const { segments } = S.scheduleComputeSegments(day, lessons, names);
  assert.deepEqual(brief(segments), [
    '07:30-09:00 lesson:Anwendungsentwicklung',
    '09:00-09:20 break:Pause',
    '09:20-10:50 lesson:Netzwerktechnik',
    '10:50-11:05 break:Pause',
    '11:05-12:35 lesson:Wirtschaft und Soziales',
    '12:35-13:20 break:Mittagspause',
    '13:20-14:45 block:Block 1',
    '14:45-16:10 block:Block 2',
  ]);
  assert.equal(segments[0].teacher, 'Lehrkraft A');
  assert.equal(segments.find(s => s.type === 'block').start, '13:20');
});

test('Freitag: Unterricht, Mittagspause, danach keine Arbeitsblöcke', () => {
  const { segments, end } = S.scheduleComputeSegments(tpl('tpl-school'), [], names);
  assert.equal(end, '13:20');
  assert.ok(!segments.some(s => s.type === 'block' || s.type === 'unassigned'));
  assert.deepEqual(segments.map(s => s.type), ['school', 'break', 'school', 'break', 'school', 'break']);
});

test('Nicht verplante Arbeitszeit ist als „nicht zugewiesen“ erkennbar', () => {
  const day = tpl('tpl-work');
  day.blocks = [day.blocks[0]];
  const types = S.scheduleComputeSegments(day, [], names).segments.map(s => s.type);
  assert.deepEqual(types, ['block', 'break', 'unassigned', 'break', 'unassigned', 'break', 'unassigned']);
});

test('Blöcke, die in Pausen/Schule ragen, werden abgeschnitten, nicht verändert — und gemeldet', () => {
  const day = tpl('tpl-school-work');
  day.blocks = [{ id: 99, label: 'Zu früh', start: '12:00', end: '13:40', kind: 'other', projectId: null }];
  const before = JSON.stringify(day);
  const { segments } = S.scheduleComputeSegments(day, [], names);
  assert.equal(JSON.stringify(day), before, 'Berechnung verändert keine Daten');
  const visible = segments.filter(s => s.type === 'block' && s.id === 99);
  assert.deepEqual(visible.map(s => `${s.start}-${s.end}`), ['13:20-13:40']);
  const msgs = S.scheduleValidateDay(day, []).filter(i => i.ref === 'block:99').map(i => i.msg);
  assert.ok(msgs.some(m => m.includes('Pause')));
  assert.ok(msgs.some(m => m.includes('Schulzeit')));
});

test('Validierung: ungültige Intervalle und Überschneidungen', () => {
  const day = tpl('tpl-work');
  day.blocks[1].end = '09:10'; day.blocks[1].start = '09:30';   // Ende vor Beginn
  day.breaks.push({ id: 'x', label: 'Doppelt', start: '09:10', end: '09:30' }); // überschneidet Pause 09:00–09:20
  const issues = S.scheduleValidateDay(day, []);
  assert.ok(issues.some(i => i.ref === 'block:' + day.blocks[1].id && /Ende liegt nicht nach/.test(i.msg)));
  assert.ok(issues.some(i => i.ref === 'break:x' && /überschneidet/.test(i.msg)));
  const lessonOutside = S.scheduleValidateDay(tpl('tpl-school'), [{ id: 'l', start: '12:40', end: '13:10' }]);
  assert.ok(lessonOutside.some(i => i.ref === 'lesson:l' && /außerhalb der Schulzeit/.test(i.msg)));
});

test('Freier Tag liefert keine Zeitleiste', () => {
  const day = tpl('tpl-work'); day.enabled = false;
  assert.equal(S.scheduleComputeSegments(day, [], names).off, true);
});

test('Übernahme der alten Blöcke: gleiche IDs, Lücken werden Pausen', () => {
  const day = S.scheduleDayFromLegacyBlocks(globalThis.blocks, true);
  assert.equal(day.start, '07:30'); assert.equal(day.end, '16:10');
  assert.deepEqual(day.blocks.map(b => b.id), [1, 2, 3, 4]);
  assert.equal(day.blocks[3].kind, 'free');
  assert.deepEqual(day.breaks.map(b => `${b.start}-${b.end}`), ['09:00-09:15', '11:30-12:15', '14:00-14:30']);
});

test('Beim Laden: Mo–Fr aus den alten Blöcken, Sa/So frei, jeder Tag ein eigenes Objekt', () => {
  const week = JSON.parse(store.scheduleWeek);
  [1, 2, 3, 4, 5].forEach(wd => assert.equal(week.days[wd].enabled, true));
  [0, 6].forEach(wd => assert.equal(week.days[wd].enabled, false));
  week.days[2].blocks[1].label = 'Geändert';
  assert.equal(week.days[1].blocks[1].label, 'Block 2', 'Dienstag ändern lässt Montag unverändert');
  assert.ok(Array.isArray(JSON.parse(store.scheduleTemplates)));
});

test('Vorschlag für neuen Block nutzt die erste freie Lücke', () => {
  const day = tpl('tpl-school-work'); day.blocks = [];
  assert.deepEqual(S.scheduleSuggestBlockSlot(day), { start: '13:20', end: '14:50' });
});
