// Tests für Kalender-Import/-Export (js/calendar-ics.js, reiner Teil NookIcs).
// Ausführen: node --test tests/   (Node 18+, keine Abhängigkeiten)
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/calendar-ics.js');

process.env.TZ = process.env.TZ || 'Europe/Berlin';
const cal = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flat(), 'END:VCALENDAR'].join('\r\n');
const ev = (...lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];
let n = 0;
const newId = () => `id${++n}`;

test('Einzeltermin mit Ortszeit, Ganztag und Mehrtagestermin', () => {
  const { items } = I.parse(cal(
    ev('UID:a@x', 'SUMMARY:Zahnarzt', 'DTSTART:20261203T083000', 'DTEND:20261203T093000', 'LOCATION:Praxis Dr. Weiß'),
    ev('UID:b@x', 'SUMMARY:Tag der offenen Tür', 'DTSTART;VALUE=DATE:20261205', 'DTEND;VALUE=DATE:20261206'),
    ev('UID:c@x', 'SUMMARY:Herbstferien', 'DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261024'),
  ));
  assert.equal(items.length, 3);
  assert.deepEqual([items[0].date, items[0].time, items[0].notes], ['2026-12-03', '08:30', 'Ort: Praxis Dr. Weiß']);
  assert.deepEqual([items[1].date, items[1].time, items[1].endDate], ['2026-12-05', '', undefined]);
  assert.deepEqual([items[2].date, items[2].endDate], ['2026-10-12', '2026-10-23'], 'DTEND ist exklusiv');
});

test('Gefaltete Zeilen, Escapes und abgesagte Termine', () => {
  const text = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:f\r\nSUMMARY:Lernfeld 8\\, Datenbanken\\; Test\r\nDESCRIPTION:Erste Zeile\\nzweite\r\n  Zeile weiter\r\nDTSTART;VALUE=DATE:20261201\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Fällt aus\r\nSTATUS:CANCELLED\r\nDTSTART;VALUE=DATE:20261202\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const { items, skipped } = I.parse(text);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Lernfeld 8, Datenbanken; Test');
  assert.equal(items[0].notes, 'Erste Zeile\nzweite Zeile weiter');
  assert.equal(skipped, 1);
});

test('UTC-Zeit wird in Ortszeit umgerechnet', () => {
  const s = I.parseStamp('20261203T073000Z');
  const local = new Date(Date.UTC(2026, 11, 3, 7, 30));
  assert.equal(s.time, `${String(local.getHours()).padStart(2, '0')}:30`);
});

test('Wiederholungen: wöchentlich mit Tagen, Ende, Ausnahmen; Unbekanntes wird vereinfacht', () => {
  const { items, simplified } = I.parse(cal(
    ev('UID:s1', 'SUMMARY:Berufsschule', 'DTSTART;VALUE=DATE:20260907', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TH;UNTIL=20270630', 'EXDATE;VALUE=DATE:20261012,20261015'),
    ev('UID:s2', 'SUMMARY:Monatsmeeting', 'DTSTART:20260902T100000', 'RRULE:FREQ=MONTHLY;INTERVAL=2;COUNT=5'),
    ev('UID:s3', 'SUMMARY:Jeden 2. Montag', 'DTSTART;VALUE=DATE:20260914', 'RRULE:FREQ=MONTHLY;BYDAY=2MO'),
  ));
  assert.deepEqual(items[0].rrule, { freq: 'weekly', interval: 1, byWeekday: [0, 3], endType: 'until', until: '2027-06-30', count: null });
  assert.deepEqual(items[0].exdates, ['2026-10-12', '2026-10-15']);
  assert.deepEqual(items[1].rrule, { freq: 'monthly', interval: 2, byWeekday: null, endType: 'count', until: null, count: 5 });
  assert.equal(items[2].rrule, undefined);
  assert.equal(simplified, 1);
});

test('Einfügen: Serien, Einzel- und Mehrtagestermine; Doppelte werden übersprungen', () => {
  const events = { '2026-12-03': [{ id: 'old', title: 'Zahnarzt' }] };
  const series = [];
  const { items } = I.parse(cal(
    ev('UID:a', 'SUMMARY:Zahnarzt', 'DTSTART:20261203T083000'),
    ev('UID:c', 'SUMMARY:Ferien', 'DTSTART;VALUE=DATE:20261221', 'DTEND;VALUE=DATE:20270105'),
    ev('UID:s', 'SUMMARY:Sport', 'DTSTART:20260901T180000', 'RRULE:FREQ=WEEKLY', 'EXDATE:20261006T180000'),
  ));
  const r = I.merge(items, events, series, newId);
  assert.deepEqual(r, { added: 2, duplicates: 1 });
  const ferien = events['2026-12-21'][0];
  assert.deepEqual([ferien.startDate, ferien.endDate, ferien.time, ferien.icsUid], ['2026-12-21', '2027-01-04', '', 'c']);
  assert.equal(series[0].title, 'Sport');
  assert.equal(series[0].time, '18:00');
  assert.deepEqual(series[0].exceptions, { '2026-10-06': { type: 'deleted' } });
  assert.deepEqual(I.merge(items, events, series, newId), { added: 0, duplicates: 3 }, 'zweiter Import ändert nichts');
});

test('Export und wieder Import ergibt dieselben Termine', () => {
  const events = {
    '2026-12-03': [{ id: 'e1', title: 'Zahnarzt, kurz', time: '08:30', notes: 'Karte\nmitnehmen' }],
    '2026-12-21': [{ id: 'e2', title: 'Ferien', time: '', startDate: '2026-12-21', endDate: '2027-01-04' }],
  };
  const series = [{ id: 's1', title: 'Berufsschule', time: '', startDate: '2026-09-07',
    rrule: { freq: 'weekly', interval: 1, byWeekday: [0, 3], endType: 'count', until: null, count: 40 }, exceptions: { '2026-10-12': { type: 'deleted' } } }];
  const { text, count } = I.build(events, series);
  assert.equal(count, 3);
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n') && text.trimEnd().endsWith('END:VCALENDAR'));
  assert.ok(text.split('\r\n').every(l => l.length <= 75), 'Zeilen sind gefaltet');
  const { items } = I.parse(text);
  const byTitle = Object.fromEntries(items.map(i => [i.title, i]));
  assert.deepEqual([byTitle['Zahnarzt, kurz'].date, byTitle['Zahnarzt, kurz'].time, byTitle['Zahnarzt, kurz'].notes], ['2026-12-03', '08:30', 'Karte\nmitnehmen']);
  assert.deepEqual([byTitle.Ferien.date, byTitle.Ferien.endDate], ['2026-12-21', '2027-01-04']);
  assert.deepEqual(byTitle.Berufsschule.rrule, series[0].rrule);
  assert.deepEqual(byTitle.Berufsschule.exdates, ['2026-10-12']);
});
