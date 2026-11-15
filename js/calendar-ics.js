// =========================
// KALENDER — Import und Export (.ics, iCalendar RFC 5545)
// Kalender-Einstellungen → „Import und Export“. Läuft komplett im Browser
// (FileReader, Blob-Download), auch unter file:// und in der Desktop-App.
//
// Import: Einzel-, Ganztags- und Mehrtagestermine → events, Wiederholungen
// (täglich/wöchentlich mit Wochentagen/monatlich/jährlich, INTERVAL, COUNT,
// UNTIL, EXDATE) → eventSeries. Was Nook nicht abbilden kann (z.B. „jeden
// 2. Montag“), kommt als einzelner erster Termin und wird gezählt.
// Doppelte werden übersprungen: gleiche UID (ev.icsUid) oder gleicher Titel am
// gleichen Tag. Uhrzeiten in UTC werden in Ortszeit umgerechnet.
// Export: alle eigenen Termine und Serien (Google-Termine liegen getrennt in
// googleCalCache und bleiben draußen, Geburtstage auch).
// Lädt nach calendar.js (events, eventSeries, saveEvents, saveEventSeries,
// renderCalendar). Reiner Teil (NookIcs) ohne DOM: tests/calendar-ics.test.js.
// =========================

const NookIcs = (() => {
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDaysIso = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
  const WD = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']; // Nook: 0 = Montag

  // Zeilen entfalten (CRLF + Leerzeichen/Tab = Fortsetzung), dann "NAME;PARAM=..:WERT".
  function lines(text) {
    return String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n').filter(Boolean).map(l => {
      const i = l.indexOf(':');
      if (i < 0) return null;
      const [name, ...params] = l.slice(0, i).split(';');
      const p = {};
      params.forEach(x => { const [k, v] = x.split('='); if (k) p[k.toUpperCase()] = (v || '').replace(/^"|"$/g, ''); });
      return { name: name.toUpperCase(), params: p, value: l.slice(i + 1) };
    }).filter(Boolean);
  }
  const unescape = s => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  const escape = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

  // "20261201" (Datum) | "20261201T080000" (Ortszeit) | "20261201T070000Z" (UTC → Ortszeit).
  function parseStamp(value, params = {}) {
    const m = String(value).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
    if (!m) return null;
    if (!m[4] || params.VALUE === 'DATE') return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '' };
    if (m[7]) {
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
      return { date: iso(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
    }
    return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
  }

  // RRULE → Nook-rrule oder null (nicht abbildbar).
  function parseRrule(value, startDate) {
    const r = {};
    value.split(';').forEach(x => { const [k, v] = x.split('='); if (k) r[k.toUpperCase()] = v; });
    const freq = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' }[r.FREQ];
    if (!freq) return null;
    const [, sm, sd] = startDate.split('-').map(Number);
    const known = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'WKST', 'BYMONTHDAY', 'BYMONTH']);
    if (Object.keys(r).some(k => !known.has(k))) return null;
    let byWeekday = null;
    if (r.BYDAY) {
      if (freq !== 'weekly') return null; // „jeden 2. Montag“ kann Nook nicht
      const days = r.BYDAY.split(',').map(d => WD.indexOf(d.trim().toUpperCase()));
      if (days.some(d => d < 0)) return null;
      byWeekday = [...new Set(days)].sort((a, b) => a - b);
    }
    if (r.BYMONTHDAY && (freq === 'daily' || freq === 'weekly' || r.BYMONTHDAY.split(',').map(Number).some(d => d !== sd))) return null;
    if (r.BYMONTH && (freq !== 'yearly' || r.BYMONTH.split(',').map(Number).some(mm => mm !== sm))) return null;
    const out = { freq, interval: Math.max(1, parseInt(r.INTERVAL, 10) || 1), byWeekday, endType: 'never', until: null, count: null };
    if (r.COUNT) { out.endType = 'count'; out.count = Math.max(1, parseInt(r.COUNT, 10) || 1); }
    else if (r.UNTIL) { const u = parseStamp(r.UNTIL); if (u) { out.endType = 'until'; out.until = u.date; } }
    return out;
  }

  // → { items: [{ uid, title, notes, date, endDate?, time, rrule?, exdates[] }], simplified, skipped }
  function parse(text) {
    const items = [];
    let cur = null, simplified = 0, skipped = 0;
    for (const l of lines(text)) {
      if (l.name === 'BEGIN' && l.value.toUpperCase() === 'VEVENT') { cur = { exdates: [] }; continue; }
      if (l.name === 'END' && l.value.toUpperCase() === 'VEVENT') {
        if (cur && cur.start && !cur.cancelled) {
          const it = { uid: cur.uid || '', title: (cur.summary || 'Termin').trim(), notes: [cur.location ? `Ort: ${cur.location}` : '', cur.description || ''].filter(Boolean).join('\n').trim(),
            date: cur.start.date, time: cur.start.time, exdates: cur.exdates };
          if (cur.end) {
            // DTEND ist exklusiv: ganztags bis zum Vortag; mit Uhrzeit über Mitternacht hinaus = Mehrtagestermin
            const last = cur.start.time ? cur.end.date : addDaysIso(cur.end.date, -1);
            if (last > it.date) { it.endDate = last; it.time = ''; }
          }
          if (cur.rrule) {
            const r = parseRrule(cur.rrule, it.date);
            if (r && !it.endDate) it.rrule = r; else simplified++;
          }
          items.push(it);
        } else skipped++;
        cur = null; continue;
      }
      if (!cur) continue;
      if (l.name === 'SUMMARY') cur.summary = unescape(l.value);
      else if (l.name === 'DESCRIPTION') cur.description = unescape(l.value);
      else if (l.name === 'LOCATION') cur.location = unescape(l.value);
      else if (l.name === 'UID') cur.uid = l.value.trim();
      else if (l.name === 'DTSTART') cur.start = parseStamp(l.value, l.params);
      else if (l.name === 'DTEND') cur.end = parseStamp(l.value, l.params);
      else if (l.name === 'RRULE') cur.rrule = l.value;
      else if (l.name === 'EXDATE') l.value.split(',').forEach(v => { const s = parseStamp(v.trim(), l.params); if (s) cur.exdates.push(s.date); });
      else if (l.name === 'STATUS' && l.value.toUpperCase() === 'CANCELLED') cur.cancelled = true;
    }
    return { items, simplified, skipped };
  }

  // Geparste Einträge in Nook-Daten einfügen (verändert events/series). newId: () => id.
  // → { added, duplicates }
  function merge(items, events, series, newId) {
    const uids = new Set();
    Object.values(events).forEach(list => (list || []).forEach(e => e.icsUid && uids.add(e.icsUid)));
    series.forEach(s => s.icsUid && uids.add(s.icsUid));
    const sameDay = (key, title) => (events[key] || []).some(e => (e.title || '').trim().toLowerCase() === title.toLowerCase());
    const sameSeries = (start, title) => series.some(s => s.startDate === start && (s.title || '').trim().toLowerCase() === title.toLowerCase());
    let added = 0, duplicates = 0;
    for (const it of items) {
      if ((it.uid && uids.has(it.uid)) || (it.rrule ? sameSeries(it.date, it.title) : sameDay(it.date, it.title))) { duplicates++; continue; }
      const base = { title: it.title, notes: it.notes, time: it.time || '', countdown: false, color: null, showInAgenda: true };
      if (it.uid) { base.icsUid = it.uid; uids.add(it.uid); }
      if (it.rrule) {
        const exceptions = {};
        it.exdates.forEach(d => { exceptions[d] = { type: 'deleted' }; });
        series.push({ id: newId(), ...base, startDate: it.date, rrule: it.rrule, exceptions });
      } else {
        const ev = { id: newId(), ...base };
        if (it.endDate) { ev.startDate = it.date; ev.endDate = it.endDate; ev.time = ''; }
        (events[it.date] ||= []).push(ev);
      }
      added++;
    }
    return { added, duplicates };
  }

  // ---------- Export ----------
  const stampDate = s => s.replace(/-/g, '');
  const stampLocal = (date, time) => `${stampDate(date)}T${time.replace(':', '')}00`;
  function fold(line) {
    // höchstens 75 Zeichen je Zeile, Fortsetzung mit führendem Leerzeichen
    const out = [];
    let s = line;
    while (s.length > 75) { out.push(s.slice(0, 75)); s = ' ' + s.slice(75); }
    out.push(s);
    return out.join('\r\n');
  }
  function plusHour(date, time) {
    const [y, m, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
    const t = new Date(y, m - 1, d, h + 1, mi);
    return { date: iso(t), time: `${pad(t.getHours())}:${pad(t.getMinutes())}` };
  }
  function eventLines(e, date, endDate, extra = []) {
    const L = ['BEGIN:VEVENT', `UID:${e.icsUid || `${e.id}@nook`}`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`];
    if (e.time && !endDate) {
      const end = plusHour(date, e.time);
      L.push(`DTSTART:${stampLocal(date, e.time)}`, `DTEND:${stampLocal(end.date, end.time)}`);
    } else {
      L.push(`DTSTART;VALUE=DATE:${stampDate(date)}`, `DTEND;VALUE=DATE:${stampDate(addDaysIso(endDate || date, 1))}`);
    }
    L.push(`SUMMARY:${escape(e.title || 'Termin')}`);
    if (e.notes) L.push(`DESCRIPTION:${escape(e.notes)}`);
    L.push(...extra, 'END:VEVENT');
    return L;
  }
  function rruleLine(r) {
    const p = [`FREQ=${r.freq.toUpperCase()}`];
    if (r.interval > 1) p.push(`INTERVAL=${r.interval}`);
    if (r.freq === 'weekly' && r.byWeekday?.length) p.push(`BYDAY=${r.byWeekday.map(d => WD[d]).join(',')}`);
    if (r.endType === 'count' && r.count) p.push(`COUNT=${r.count}`);
    if (r.endType === 'until' && r.until) p.push(`UNTIL=${stampDate(r.until)}`);
    return `RRULE:${p.join(';')}`;
  }
  // → { text, count }
  function build(events, series) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nook//Kalender//DE', 'CALSCALE:GREGORIAN'];
    let count = 0;
    Object.entries(events).forEach(([key, list]) => (list || []).forEach(e => {
      L.push(...eventLines(e, e.startDate || key, e.endDate || null)); count++;
    }));
    series.forEach(s => {
      if (!s.rrule) return;
      const ex = Object.entries(s.exceptions || {}).filter(([, x]) => x && x.type === 'deleted').map(([d]) => d);
      const extra = [rruleLine(s.rrule), ...(ex.length ? [`EXDATE;VALUE=DATE:${ex.map(stampDate).join(',')}`] : [])];
      // Serien mit Uhrzeit: EXDATE muss dieselbe Form wie DTSTART haben
      if (s.time && ex.length) extra[1] = `EXDATE:${ex.map(d => stampLocal(d, s.time)).join(',')}`;
      L.push(...eventLines(s, s.startDate, null, extra)); count++;
    });
    L.push('END:VCALENDAR');
    return { text: L.map(fold).join('\r\n') + '\r\n', count };
  }

  return { parse, merge, build, parseStamp, parseRrule };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NookIcs;

if (typeof document !== 'undefined') (function initIcs() {
  const result = document.getElementById('cal-ics-result');
  const say = text => { if (result) { result.textContent = text; result.hidden = false; } };

  document.getElementById('cal-ics-file')?.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { items, simplified } = NookIcs.parse(String(reader.result));
      if (!items.length) { say('In der Datei wurden keine Termine gefunden.'); return; }
      const { added, duplicates } = NookIcs.merge(items, events, eventSeries, () => crypto.randomUUID());
      saveEvents(); saveEventSeries();
      if (typeof renderCalendar === 'function') renderCalendar();
      const parts = [`${added} ${added === 1 ? 'Termin' : 'Termine'} importiert.`];
      if (duplicates) parts.push(`${duplicates} gab es schon.`);
      if (simplified && added) parts.push(`${simplified} Wiederholung${simplified === 1 ? '' : 'en'} konnte Nook nicht abbilden, ${simplified === 1 ? 'sie steht' : 'sie stehen'} als einzelner erster Termin drin.`);
      say(parts.join(' '));
    };
    reader.onerror = () => say('Die Datei ließ sich nicht lesen.');
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('cal-ics-export')?.addEventListener('click', () => {
    const { text, count } = NookIcs.build(events, eventSeries);
    if (!count) { say('Es gibt noch keine Termine zum Exportieren.'); return; }
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nook-termine-${new Date().toISOString().slice(0, 10)}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say(`${count} ${count === 1 ? 'Termin' : 'Termine'} exportiert (Serien zählen einmal).`);
  });
})();
