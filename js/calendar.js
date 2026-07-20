// =========================
// EVENTS — Multi-day support
// =========================
//
// Data model (backward-compatible):
//   Single-day:  stored at events[dateKey] — has no endDate
//   Multi-day:   stored at events[startDateKey] — has endDate field
//   Wiederkehrend: NICHT in `events` — siehe "RECURRING EVENTS" weiter unten,
//                  gespeichert in der globalen `eventSeries`-Liste (main.js).
//
// Helper: getEventsForDay(date) — returns all events visible on a given day
// including multi-day spans that cross through it AND recurring occurrences.
//
// Jeder Termin (egal ob einmalig oder Serie) kann außerdem eine individuelle
// `color`-Eigenschaft (Hex-String) besitzen. Fehlt sie, greift die bisherige
// Standardfarbe (CSS-Variablen) — bestehende Termine bleiben unverändert.
//
// =========================

const DEFAULT_EVENT_COLOR = '#6b7f58';

function saveEvents(){ DB.set('events', events); }
let eventModalTarget = null;
let eventModalEditCtx = null; // null | { scope:'occurrence'|'following'|'series', series, occDate? }

// =========================
// RECURRING EVENTS — Series Engine
// =========================
//
// Serien-Objekt:
// {
//   id, title, notes, time, color,
//   startDate: 'YYYY-MM-DD',           // Anker-/erstes Vorkommen
//   rrule: {
//     freq: 'daily'|'weekly'|'monthly'|'yearly',
//     interval: number,                // "alle X ..."
//     byWeekday: [0..6]|null,          // nur wöchentlich, 0=Mo..6=So
//     endType: 'never'|'until'|'count',
//     until: 'YYYY-MM-DD'|null,
//     count: number|null
//   },
//   exceptions: {
//     'YYYY-MM-DD': { type:'deleted' } | { type:'modified', data:{title,notes,time,color} }
//   }
// }
//
// Vorkommen werden dynamisch berechnet (computeSeriesOccurrenceDates) und nie
// als Einzeltermine dupliziert gespeichert — bearbeitete/gelöschte Einzeltage
// landen ausschließlich als Ausnahmen in `exceptions`.
// =========================

function isoDow(date) { return (date.getDay() + 6) % 7; } // 0=Mo..6=So, kalenderfest (kein DST-Drift)

function computeSeriesOccurrenceDates(series, limitEndDate) {
  const rrule = series.rrule;
  if (!rrule) return [];
  const startDate = parseLocalDate(series.startDate); startDate.setHours(0,0,0,0);
  const interval = Math.max(1, parseInt(rrule.interval, 10) || 1);
  const untilDate = (rrule.endType === 'until' && rrule.until) ? parseLocalDate(rrule.until) : null;
  if (untilDate) untilDate.setHours(0,0,0,0);
  const maxCount = rrule.endType === 'count' ? Math.max(1, parseInt(rrule.count, 10) || 1) : Infinity;
  const hardCap = 3000; // Sicherheitsgrenze gegen Endlosschleifen
  const results = [];
  let occurrenceIndex = 0;
  let iterations = 0;

  function pastLimits(d) {
    if (untilDate && d.getTime() > untilDate.getTime()) return true;
    if (limitEndDate && d.getTime() > limitEndDate.getTime()) return true;
    return false;
  }

  if (rrule.freq === 'daily') {
    // setDate() ist kalenderbasiert (nicht ms-basiert) — Sommer-/Winterzeit-sicher.
    let d = new Date(startDate);
    while (iterations++ < hardCap) {
      if (pastLimits(d)) break;
      results.push(new Date(d));
      occurrenceIndex++;
      if (rrule.endType === 'count' && occurrenceIndex >= maxCount) break;
      d.setDate(d.getDate() + interval);
    }
  } else if (rrule.freq === 'weekly') {
    const weekdays = (rrule.byWeekday && rrule.byWeekday.length)
      ? rrule.byWeekday.slice().sort((a,b)=>a-b)
      : [isoDow(startDate)];
    const startWeekMonday = new Date(startDate);
    startWeekMonday.setDate(startWeekMonday.getDate() - isoDow(startDate));
    let weekOffset = 0;
    outerWeekly:
    while (iterations++ < hardCap) {
      const weekMonday = new Date(startWeekMonday);
      weekMonday.setDate(weekMonday.getDate() + weekOffset * 7 * interval);
      for (const wd of weekdays) {
        const d = new Date(weekMonday);
        d.setDate(d.getDate() + wd);
        if (d.getTime() < startDate.getTime()) continue;
        if (pastLimits(d)) break outerWeekly;
        results.push(d);
        occurrenceIndex++;
        if (rrule.endType === 'count' && occurrenceIndex >= maxCount) break outerWeekly;
      }
      weekOffset += 1;
      if (limitEndDate) {
        const probe = new Date(startWeekMonday);
        probe.setDate(probe.getDate() + weekOffset * 7 * interval);
        if (probe.getTime() > limitEndDate.getTime() + 7 * 86400000) break;
      }
    }
  } else if (rrule.freq === 'monthly') {
    // Tage, die im Zielmonat nicht existieren (z.B. 31. im Februar), werden
    // übersprungen statt auf einen falschen Tag geklemmt zu werden.
    const day = startDate.getDate();
    let monthCursor = startDate.getFullYear() * 12 + startDate.getMonth();
    while (iterations++ < hardCap) {
      const year = Math.floor(monthCursor / 12);
      const month = monthCursor % 12;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      if (day <= daysInMonth) {
        const d = new Date(year, month, day);
        if (pastLimits(d)) break;
        results.push(d);
        occurrenceIndex++;
        if (rrule.endType === 'count' && occurrenceIndex >= maxCount) break;
      } else if (limitEndDate) {
        const probe = new Date(year, month, 1);
        if (probe.getTime() > limitEndDate.getTime()) break;
      }
      monthCursor += interval;
    }
  } else if (rrule.freq === 'yearly') {
    // 29. Februar in Nicht-Schaltjahren wird übersprungen (kein Datumsdrift).
    const month = startDate.getMonth();
    const day = startDate.getDate();
    let year = startDate.getFullYear();
    while (iterations++ < hardCap) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      if (day <= daysInMonth) {
        const d = new Date(year, month, day);
        if (pastLimits(d)) break;
        results.push(d);
        occurrenceIndex++;
        if (rrule.endType === 'count' && occurrenceIndex >= maxCount) break;
      } else if (limitEndDate) {
        const probe = new Date(year, month, 1);
        if (probe.getTime() > limitEndDate.getTime()) break;
      }
      year += interval;
    }
  }
  return results;
}

// Liefert alle Serien-Vorkommen (inkl. Ausnahmen aufgelöst) im Bereich [rangeStart, rangeEnd].
function getSeriesOccurrencesInRange(rangeStart, rangeEnd) {
  const rs = new Date(rangeStart); rs.setHours(0,0,0,0);
  const re = new Date(rangeEnd);   re.setHours(0,0,0,0);
  const out = [];
  eventSeries.forEach(series => {
    const dates = computeSeriesOccurrenceDates(series, re);
    dates.forEach(d => {
      if (d.getTime() < rs.getTime() || d.getTime() > re.getTime()) return;
      const dKey = dateKey(d);
      const exception = series.exceptions && series.exceptions[dKey];
      if (exception && exception.type === 'deleted') return;
      const base = {
        id: series.id + '__' + dKey,
        seriesId: series.id,
        occurrenceKey: dKey,
        title: series.title,
        notes: series.notes || '',
        time: series.time || '',
        countdown: false, // Countdown wird für wiederkehrende Termine nicht unterstützt
        color: series.color || null,
        isRecurring: true
      };
      if (exception && exception.type === 'modified') Object.assign(base, exception.data);
      out.push({ date: new Date(d), event: base });
    });
  });
  return out;
}

// =========================
// HELPER: all events visible on a given calendar day
// =========================

function getEventsForDay(date) {
  const dKey = dateKey(date);
  const dTime = date.getTime();
  const result = [];

  Object.entries(events).forEach(([key, dayEvs]) => {
    (dayEvs || []).forEach(ev => {
      // Backward compat: if no endDate, treat as single-day stored at key
      if (!ev.endDate) {
        if (key === dKey) result.push({ ev, key, isRange: false, isStart: true, isEnd: true });
        return;
      }
      // Multi-day: check if date falls within [startDate, endDate]
      const start = parseLocalDate(ev.startDate || key); start.setHours(0,0,0,0);
      const end   = parseLocalDate(ev.endDate);           end.setHours(0,0,0,0);
      if (dTime >= start.getTime() && dTime <= end.getTime()) {
        result.push({
          ev, key,
          isRange: true,
          isStart: dTime === start.getTime(),
          isEnd:   dTime === end.getTime(),
        });
      }
    });
  });

  // Wiederkehrende Vorkommen dieses Tages
  getSeriesOccurrencesInRange(date, date).forEach(occ => {
    result.push({ ev: occ.event, key: occ.event.occurrenceKey, isRange: false, isStart: true, isEnd: true, isRecurring: true });
  });

  return result;
}

// ── Status label for running events ──────────────────────────
function getEventStatusLabel(ev, date) {
  if (!ev.endDate) return null;
  const now   = new Date(); now.setHours(0,0,0,0);
  const end   = parseLocalDate(ev.endDate); end.setHours(0,0,0,0);
  const daysLeft = Math.ceil((end - now) / 86400000);
  if (daysLeft < 0)  return null;
  if (daysLeft === 0) return 'Endet heute';
  if (daysLeft === 1) return 'Endet morgen';
  const start = parseLocalDate(ev.startDate || dateKey(date)); start.setHours(0,0,0,0);
  if (now >= start && now <= end) return `Noch ${daysLeft} Tage`;
  return null;
}

// =========================
// COUNTDOWN CLEANUP beim Laden
// =========================
(function cleanupExpiredCountdowns() {
  const now = new Date(); now.setHours(0,0,0,0);
  let changed = false;
  const validCountdownIds = new Set();

  Object.entries(events).forEach(([key, dayEvs]) => {
    dayEvs.forEach(ev => {
      if (!ev.countdown) return;
      // For multi-day: use endDate; for single: use key
      const refKey = ev.endDate || key;
      const evDate = parseLocalDate(refKey); evDate.setHours(0,0,0,0);
      const daysLeft = Math.ceil((evDate - now) / 86400000);
      if (daysLeft >= 0) { validCountdownIds.add(ev.id); }
      else { ev.countdown = false; changed = true; }
    });
  });

  Object.keys(countdownVisible).forEach(id => {
    if (id === '__exam__') { delete countdownVisible[id]; changed = true; return; }
    if (!validCountdownIds.has(id)) { delete countdownVisible[id]; changed = true; }
  });
  if (changed) { saveEvents(); DB.set('countdownVisible', countdownVisible); }
})();

// =========================
// EVENT MODAL — Recurrence + Color UI Helpers
// =========================

function updateRecurCustomVisibility() {
  const val = document.getElementById('event-modal-recur-select').value;
  const customPanel = document.getElementById('event-modal-custom-recur');
  if (val === 'custom') {
    customPanel.classList.remove('hidden');
    const unit = document.getElementById('recur-unit-select').value;
    document.getElementById('recur-weekday-row').classList.toggle('hidden', unit !== 'weekly');
  } else {
    customPanel.classList.add('hidden');
  }
}

function resetRecurCustomUi() {
  document.getElementById('recur-interval-input').value = 1;
  document.getElementById('recur-unit-select').value = 'weekly';
  document.querySelectorAll('.recur-wd-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('recur-weekday-row').classList.add('hidden');
  document.querySelectorAll('input[name="recur-end"]').forEach(r => r.checked = r.value === 'never');
  document.getElementById('recur-end-until').value = '';
  document.getElementById('recur-end-count').value = 10;
}

function setRecurUiFromRule(rrule) {
  const recurSelect = document.getElementById('event-modal-recur-select');
  const isSimple = rrule.interval === 1 && rrule.endType === 'never' &&
    !(rrule.freq === 'weekly' && rrule.byWeekday && rrule.byWeekday.length > 1);
  if (isSimple) {
    recurSelect.value = rrule.freq;
    document.getElementById('event-modal-custom-recur').classList.add('hidden');
  } else {
    recurSelect.value = 'custom';
    document.getElementById('event-modal-custom-recur').classList.remove('hidden');
  }
  document.getElementById('recur-interval-input').value = rrule.interval || 1;
  document.getElementById('recur-unit-select').value = rrule.freq;
  document.querySelectorAll('.recur-wd-btn').forEach(btn => {
    const wd = parseInt(btn.dataset.wd, 10);
    btn.classList.toggle('active', (rrule.byWeekday || []).includes(wd));
  });
  document.getElementById('recur-weekday-row').classList.toggle('hidden', rrule.freq !== 'weekly');
  document.querySelectorAll('input[name="recur-end"]').forEach(r => { r.checked = (r.value === rrule.endType); });
  document.getElementById('recur-end-until').value = rrule.until || '';
  document.getElementById('recur-end-count').value = rrule.count || 10;
}

function buildRruleFromUi() {
  const select = document.getElementById('event-modal-recur-select').value;
  if (select === 'none') return null;
  if (select === 'daily' || select === 'weekly' || select === 'monthly' || select === 'yearly') {
    return { freq: select, interval: 1, byWeekday: null, endType: 'never', until: null, count: null };
  }
  // custom
  const interval = Math.max(1, parseInt(document.getElementById('recur-interval-input').value, 10) || 1);
  const unit = document.getElementById('recur-unit-select').value;
  let byWeekday = null;
  if (unit === 'weekly') {
    byWeekday = [...document.querySelectorAll('.recur-wd-btn.active')].map(b => parseInt(b.dataset.wd, 10));
    if (byWeekday.length === 0) byWeekday = null;
  }
  const endType = document.querySelector('input[name="recur-end"]:checked')?.value || 'never';
  const until = endType === 'until' ? document.getElementById('recur-end-until').value : null;
  const count = endType === 'count' ? Math.max(1, parseInt(document.getElementById('recur-end-count').value, 10) || 1) : null;
  return { freq: unit, interval, byWeekday, endType, until, count };
}

document.getElementById('event-modal-recur-select').addEventListener('change', updateRecurCustomVisibility);
document.getElementById('recur-unit-select').addEventListener('change', updateRecurCustomVisibility);
document.querySelectorAll('.recur-wd-btn').forEach(btn => {
  btn.addEventListener('click', () => btn.classList.toggle('active'));
});
document.getElementById('event-modal-color-reset').addEventListener('click', () => {
  document.getElementById('event-modal-color').value = DEFAULT_EVENT_COLOR;
});

// =========================
// EVENT MODAL
// =========================
//
// editCtx (optional):
//   { scope:'occurrence', series, occDate }  → nur dieses Vorkommen (Ausnahme)
//   { scope:'following',  series, occDate }  → dieses + alle künftigen (Serie splitten)
//   { scope:'series',     series }           → gesamte Serie bearbeiten
// =========================

function openEventModal(key, day, existingEvent = null, editCtx = null) {
  state.editingEvent = existingEvent ? { key, event: existingEvent } : null;
  eventModalTarget   = { key, day };
  eventModalEditCtx  = editCtx;

  const headerTitle = editCtx?.scope === 'occurrence' ? 'Diesen Termin bearbeiten'
                     : editCtx?.scope === 'following'  ? 'Termin und Folgetermine bearbeiten'
                     : editCtx?.scope === 'series'      ? 'Terminserie bearbeiten'
                     : existingEvent ? 'Termin bearbeiten' : 'Neuer Termin';
  document.getElementById('event-modal-title').textContent = headerTitle;

  let dataSrc;
  if (editCtx?.scope === 'series') {
    dataSrc = { title: editCtx.series.title, notes: editCtx.series.notes, time: editCtx.series.time, color: editCtx.series.color };
  } else if (editCtx?.scope === 'following' || editCtx?.scope === 'occurrence') {
    dataSrc = existingEvent || {};
  } else {
    dataSrc = existingEvent || {};
  }

  const dateForField = editCtx?.scope === 'series' ? editCtx.series.startDate
                      : editCtx?.scope === 'following' ? dateKey(editCtx.occDate)
                      : editCtx?.scope === 'occurrence' ? dateKey(editCtx.occDate)
                      : (existingEvent?.startDate || existingEvent?.date || key || '');

  const dateInput = document.getElementById('event-modal-date-input');
  dateInput.value = dateForField;
  dateInput.disabled = (editCtx?.scope === 'occurrence' || editCtx?.scope === 'following');

  document.getElementById('event-modal-enddate-input').value = existingEvent?.endDate || '';
  document.getElementById('event-modal-input').value         = dataSrc.title || '';
  document.getElementById('event-modal-notes').value         = dataSrc.notes || '';
  document.getElementById('event-modal-time').value          = dataSrc.time || '';
  document.getElementById('event-modal-countdown').checked   = existingEvent?.countdown || false;
  document.getElementById('event-modal-color').value         = dataSrc.color || DEFAULT_EVENT_COLOR;

  // ── Recurrence UI je nach Bearbeitungsmodus ──
  const recurSelect     = document.getElementById('event-modal-recur-select');
  const customPanel     = document.getElementById('event-modal-custom-recur');
  const countdownRow    = document.getElementById('event-modal-countdown').closest('.modal-row-inline');
  const endDateRow      = document.getElementById('event-modal-enddate-input').closest('.modal-row');
  const lockedHint      = document.getElementById('event-modal-recur-locked-hint');

  if (editCtx?.scope === 'occurrence') {
    recurSelect.value = 'none';
    recurSelect.disabled = true;
    customPanel.classList.add('hidden');
    countdownRow.style.display = 'none';
    endDateRow.style.display = 'none';
    lockedHint.style.display = '';
  } else if (editCtx?.scope === 'following' || editCtx?.scope === 'series') {
    recurSelect.disabled = false;
    countdownRow.style.display = 'none';
    endDateRow.style.display = 'none';
    lockedHint.style.display = 'none';
    setRecurUiFromRule(editCtx.series.rrule);
  } else {
    recurSelect.disabled = false;
    countdownRow.style.display = '';
    endDateRow.style.display = '';
    lockedHint.style.display = 'none';
    recurSelect.value = 'none';
    customPanel.classList.add('hidden');
    resetRecurCustomUi();
  }
  updateRecurCustomVisibility();

  // Hide time row for multi-day events (bestehende Logik)
  const endDateEl  = document.getElementById('event-modal-enddate-input');
  const timeRow    = document.getElementById('event-modal-time-row');
  endDateEl.addEventListener('change', () => {
    timeRow.style.display = endDateEl.value ? 'none' : '';
  }, { once: false });
  timeRow.style.display = (existingEvent?.endDate) ? 'none' : '';

  document.getElementById('event-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('event-modal-input').focus(), 50);
}

function closeEventModal() {
  document.getElementById('event-modal-overlay').classList.add('hidden');
  state.editingEvent = null;
  eventModalTarget   = null;
  eventModalEditCtx  = null;
  document.getElementById('event-modal-recur-select').disabled = false;
  document.getElementById('event-modal-date-input').disabled = false;
  document.getElementById('event-modal-countdown').closest('.modal-row-inline').style.display = '';
  document.getElementById('event-modal-enddate-input').closest('.modal-row').style.display = '';
  document.getElementById('event-modal-recur-locked-hint').style.display = 'none';
}

document.getElementById('event-modal-close').addEventListener('click', closeEventModal);
document.getElementById('event-modal-cancel').addEventListener('click', closeEventModal);
document.getElementById('event-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('event-modal-overlay')) closeEventModal();
});
document.getElementById('event-modal-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  document.getElementById('event-modal-save').click();
  if (e.key === 'Escape') closeEventModal();
});

// Hide time field when end date is set
document.getElementById('event-modal-enddate-input').addEventListener('change', e => {
  document.getElementById('event-modal-time-row').style.display = e.target.value ? 'none' : '';
});

function finishEventModalSave() {
  closeEventModal();
  if (currentView === 'calendar') renderCalendar();
  if (typeof renderMiniCal === 'function') renderMiniCal();
  updateCountdown();
  document.getElementById('cal-day-modal-overlay').classList.add('hidden');
}

document.getElementById('event-modal-save').addEventListener('click', () => {
  const title = document.getElementById('event-modal-input').value.trim();
  if (!title) return;

  const startVal  = document.getElementById('event-modal-date-input').value;
  const endVal    = document.getElementById('event-modal-enddate-input').value;
  const key       = startVal || (eventModalTarget ? eventModalTarget.key : dateKey(new Date()));
  const time      = endVal ? '' : document.getElementById('event-modal-time').value;
  const notesTxt  = document.getElementById('event-modal-notes').value.trim();
  const countdown = document.getElementById('event-modal-countdown').checked;
  const color     = document.getElementById('event-modal-color').value || null;
  const rrule     = buildRruleFromUi();

  // Validate: endDate must be >= startDate
  if (endVal && endVal < key) {
    document.getElementById('event-modal-enddate-input').setCustomValidity('Enddatum muss nach Startdatum liegen');
    document.getElementById('event-modal-enddate-input').reportValidity();
    return;
  }

  // ── SCOPE: nur dieses eine Vorkommen (wird als Ausnahme gespeichert) ──
  if (eventModalEditCtx?.scope === 'occurrence') {
    const series = eventModalEditCtx.series;
    const occKey = dateKey(eventModalEditCtx.occDate);
    if (!series.exceptions) series.exceptions = {};
    series.exceptions[occKey] = { type: 'modified', data: { title, notes: notesTxt, time, color } };
    saveEventSeries();
    finishEventModalSave();
    return;
  }

  // ── SCOPE: dieses und alle zukünftigen Vorkommen (Serie wird gesplittet) ──
  if (eventModalEditCtx?.scope === 'following') {
    const series  = eventModalEditCtx.series;
    const occDate = eventModalEditCtx.occDate;
    const dayBefore = new Date(occDate); dayBefore.setDate(dayBefore.getDate() - 1);

    series.rrule.endType = 'until';
    series.rrule.until = dateKey(dayBefore);
    if (series.exceptions) {
      Object.keys(series.exceptions).forEach(k => { if (k >= dateKey(occDate)) delete series.exceptions[k]; });
    }
    saveEventSeries();

    if (rrule) {
      const newSeries = {
        id: crypto.randomUUID(),
        title, notes: notesTxt, time, color,
        startDate: dateKey(occDate),
        rrule,
        exceptions: {}
      };
      eventSeries.push(newSeries);
      saveEventSeries();
    } else {
      // Keine Wiederholung mehr gewünscht → normaler Einzeltermin ab diesem Tag
      const k = dateKey(occDate);
      if (!events[k]) events[k] = [];
      events[k].push({ id: crypto.randomUUID(), title, notes: notesTxt, time, countdown: false, color });
      saveEvents();
    }
    finishEventModalSave();
    return;
  }

  // ── SCOPE: gesamte Terminserie ──
  if (eventModalEditCtx?.scope === 'series') {
    const series = eventModalEditCtx.series;
    series.title = title; series.notes = notesTxt; series.time = time; series.color = color;
    series.startDate = key; // Verschieben des Serienankers erlaubt
    if (rrule) series.rrule = rrule;
    saveEventSeries();
    finishEventModalSave();
    return;
  }

  // ── Neuer/umgewandelter Serientermin (Wiederholung wurde ausgewählt) ──
  if (rrule) {
    // Falls ein bisher einmaliger Termin bearbeitet wurde: alten Eintrag entfernen
    if (state.editingEvent) {
      const oldKey = state.editingEvent.key;
      const oldEv  = state.editingEvent.event;
      events[oldKey] = (events[oldKey] || []).filter(e => e.id !== oldEv.id);
      if (countdownVisible[oldEv.id]) delete countdownVisible[oldEv.id];
      saveEvents(); DB.set('countdownVisible', countdownVisible);
    }
    const newSeries = {
      id: crypto.randomUUID(),
      title, notes: notesTxt, time, color,
      startDate: key,
      rrule,
      exceptions: {}
    };
    eventSeries.push(newSeries);
    saveEventSeries();
    finishEventModalSave();
    return;
  }

  // ── Einmaliger Einzel-/Mehrtagestermin (bestehendes Verhalten + Farbe) ──
  const isRange = Boolean(endVal && endVal !== key);

  if (state.editingEvent) {
    // Remove old event from old key
    const oldKey = state.editingEvent.key;
    const ev     = state.editingEvent.event;
    events[oldKey] = (events[oldKey] || []).filter(e => e.id !== ev.id);

    if (!events[key]) events[key] = [];
    const updated = { ...ev, title, time, notes: notesTxt, countdown, color };
    if (isRange) {
      updated.startDate = key;
      updated.endDate   = endVal;
      delete updated.date;
    } else {
      delete updated.startDate;
      delete updated.endDate;
    }
    events[key].push(updated);

    if (countdown) countdownVisible[ev.id] = true;
    else           delete countdownVisible[ev.id];

  } else {
    const id = crypto.randomUUID();
    if (!events[key]) events[key] = [];
    const newEv = { id, title, notes: notesTxt, countdown, color };
    if (isRange) {
      newEv.startDate = key;
      newEv.endDate   = endVal;
    } else {
      newEv.time = time;
    }
    events[key].push(newEv);
    if (countdown) countdownVisible[id] = true;
  }

  saveEvents();
  DB.set('countdownVisible', countdownVisible);
  finishEventModalSave();
});

document.getElementById('cal-add-event-btn').addEventListener('click', () => {
  const today = new Date();
  openEventModal(dateKey(today), today);
});

// =========================
// SCOPE-CHOICE MODAL — "Nur diesen"/"diesen und folgende"/"gesamte Serie"
// Wird für Bearbeiten UND Löschen von Serienterminen verwendet.
// =========================

let scopeModalCtx = null; // { ev, occDate, action: 'edit'|'delete' }

function openEditScopeModal(ev, occDate, action) {
  scopeModalCtx = { ev, occDate, action };
  document.getElementById('recur-scope-modal-title').textContent =
    action === 'delete' ? 'Wiederholenden Termin löschen' : 'Wiederholenden Termin bearbeiten';
  document.getElementById('recur-scope-modal-overlay').classList.remove('hidden');
}
function closeEditScopeModal() {
  document.getElementById('recur-scope-modal-overlay').classList.add('hidden');
  scopeModalCtx = null;
}
document.getElementById('recur-scope-modal-close').addEventListener('click', closeEditScopeModal);
document.getElementById('recur-scope-cancel').addEventListener('click', closeEditScopeModal);
document.getElementById('recur-scope-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('recur-scope-modal-overlay')) closeEditScopeModal();
});

document.getElementById('recur-scope-this').addEventListener('click', () => {
  const { ev, occDate, action } = scopeModalCtx;
  const series = eventSeries.find(s => s.id === ev.seriesId);
  closeEditScopeModal();
  if (!series) return;
  if (action === 'delete') {
    if (!series.exceptions) series.exceptions = {};
    series.exceptions[dateKey(occDate)] = { type: 'deleted' };
    saveEventSeries();
    renderCalendar();
    if (typeof renderMiniCal === 'function') renderMiniCal();
    document.getElementById('cal-day-modal-overlay').classList.add('hidden');
  } else {
    openEventModal(dateKey(occDate), occDate, ev, { scope: 'occurrence', series, occDate });
  }
});

document.getElementById('recur-scope-following').addEventListener('click', () => {
  const { ev, occDate, action } = scopeModalCtx;
  const series = eventSeries.find(s => s.id === ev.seriesId);
  closeEditScopeModal();
  if (!series) return;
  if (action === 'delete') {
    const dayBefore = new Date(occDate); dayBefore.setDate(dayBefore.getDate() - 1);
    series.rrule.endType = 'until';
    series.rrule.until = dateKey(dayBefore);
    if (series.exceptions) {
      Object.keys(series.exceptions).forEach(k => { if (k >= dateKey(occDate)) delete series.exceptions[k]; });
    }
    saveEventSeries();
    renderCalendar();
    if (typeof renderMiniCal === 'function') renderMiniCal();
    document.getElementById('cal-day-modal-overlay').classList.add('hidden');
  } else {
    openEventModal(dateKey(occDate), occDate, ev, { scope: 'following', series, occDate });
  }
});

document.getElementById('recur-scope-all').addEventListener('click', () => {
  const { ev, action } = scopeModalCtx;
  const series = eventSeries.find(s => s.id === ev.seriesId);
  closeEditScopeModal();
  if (!series) return;
  if (action === 'delete') {
    eventSeries = eventSeries.filter(s => s.id !== series.id);
    saveEventSeries();
    renderCalendar();
    if (typeof renderMiniCal === 'function') renderMiniCal();
    document.getElementById('cal-day-modal-overlay').classList.add('hidden');
  } else {
    openEventModal(series.startDate, parseLocalDate(series.startDate), null, { scope: 'series', series });
  }
});

// =========================
// CALENDAR RENDER
// Multi-day ranges rendered as continuous colored bars
// =========================

let calDate = new Date();

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';
  const year  = calDate.getFullYear();
  const month = calDate.getMonth();
  document.getElementById('cal-title').textContent =
    calDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  // ── Header row ─────────────────────────────────────────────
  const kwHead = document.createElement('div');
  kwHead.className = 'cal-day-name cal-kw-head';
  kwHead.textContent = 'KW';
  grid.appendChild(kwHead);
  ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(d => {
    const el = document.createElement('div'); el.className = 'cal-day-name'; el.textContent = d; grid.appendChild(el);
  });

  // ── Build day array ─────────────────────────────────────────
  const firstDay    = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const allDays = [];
  for (let i = startOffset-1; i >= 0; i--)
    allDays.push({ date: new Date(year, month-1, daysInPrev-i), otherMonth: true });
  for (let d = 1; d <= daysInMonth; d++)
    allDays.push({ date: new Date(year, month, d), otherMonth: false });
  const remainder = (7 - (allDays.length % 7)) % 7;
  for (let d = 1; d <= remainder; d++)
    allDays.push({ date: new Date(year, month+1, d), otherMonth: true });

  // ── Render weeks ───────────────────────────────────────────
  for (let i = 0; i < allDays.length; i += 7) {
    const week = allDays.slice(i, i+7);
    const kwEl = document.createElement('div'); kwEl.className = 'cal-kw-cell';
    kwEl.textContent = getISOWeek(week[0].date);
    grid.appendChild(kwEl);

    week.forEach(({ date, otherMonth }) => {
      const key      = dateKey(date);
      const dateTime = new Date(date); dateTime.setHours(0,0,0,0);

      // All events visible on this day (single + multi-day + recurring)
      const dayEventEntries = getEventsForDay(dateTime);
      const dayTasks        = getTasksForCalendarDay(date);

      const el = document.createElement('div');
      el.className = 'cal-day'
        + (otherMonth  ? ' other-month' : '')
        + (isToday(date) ? ' is-today'   : '')
        + (date.getDay() === 0 || date.getDay() === 6 ? ' weekend' : '');
      el.style.cursor = 'pointer';

      const num = document.createElement('span');
      num.className = 'cal-day-num';
      num.textContent = date.getDate();
      el.appendChild(num);

      const items = document.createElement('div'); items.className = 'cal-items';
      let shown = 0;

      // Single-day events first, then multi-day ranges
      const singleEvs = dayEventEntries.filter(e => !e.isRange);
      const rangeEvs  = dayEventEntries.filter(e => e.isRange);

      singleEvs.forEach(({ ev, isRecurring }) => {
        if (shown >= 3) return; shown++;
        const pill = document.createElement('div');
        pill.className = 'cal-event-pill' + (ev.countdown ? ' countdown-pill' : '');
        if (ev.color) {
          pill.style.background = hexToRgba(ev.color, 0.16);
          pill.style.color = ev.color;
          pill.style.borderLeftColor = ev.color;
        }
        pill.textContent = (isRecurring ? '↻ ' : '') + (ev.time ? ev.time + ' ' : '') + ev.title;
        pill.title = ev.notes || '';
        items.appendChild(pill);
      });

      rangeEvs.forEach(({ ev, isStart, isEnd }) => {
        if (shown >= 3) return; shown++;
        const pill = document.createElement('div');
        const spanClass = isStart && isEnd ? 'cal-span-single'
                        : isStart          ? 'cal-span-start'
                        : isEnd            ? 'cal-span-end'
                        :                    'cal-span-mid';
        pill.className = `cal-event-pill cal-span ${spanClass}` + (ev.countdown ? ' countdown-pill' : '');
        if (ev.color) {
          pill.style.background = hexToRgba(ev.color, 0.22);
          pill.style.color = ev.color;
          if (isStart) pill.style.borderLeftColor = ev.color;
        }
        pill.textContent = isStart ? ev.title : (isEnd ? '↳ Ende' : '');
        pill.title = ev.title + (ev.notes ? ' — ' + ev.notes : '');
        items.appendChild(pill);
      });

      dayTasks.forEach(t => {
        if (shown >= 3) return; shown++;
        const pill = document.createElement('div');
        pill.className = `cal-task-pill prio-${t.priority}` + (t.done ? ' cal-task-pill--done' : '');
        pill.textContent = t.title;
        if (t.done) pill.title = 'Erledigt';
        items.appendChild(pill);
      });

      const totalAll = dayEventEntries.length + dayTasks.length;
      if (totalAll > shown) {
        const more = document.createElement('div'); more.className = 'cal-more';
        more.textContent = `+${totalAll - shown} weitere`;
        items.appendChild(more);
      }

      el.appendChild(items);
      if (!otherMonth) el.addEventListener('click', () => openCalDayModal(key, date));
      grid.appendChild(el);
    });
  }
}

document.getElementById('cal-prev').addEventListener('click', () => { calDate.setMonth(calDate.getMonth()-1); renderCalendar(); });
document.getElementById('cal-next').addEventListener('click', () => { calDate.setMonth(calDate.getMonth()+1); renderCalendar(); });

// =========================
// CALENDAR DAY MODAL
// =========================

let calDayTarget = null;

function openCalDayModal(key, date) {
  calDayTarget = { key, date };
  document.getElementById('cal-day-modal-title').textContent =
    date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const content = document.getElementById('cal-day-modal-content');
  content.innerHTML = '';

  const dateTime = new Date(date); dateTime.setHours(0,0,0,0);
  const dayEventEntries = getEventsForDay(dateTime);
  const dayTasks  = getTasksForCalendarDay(date);
  const openTasks = dayTasks.filter(t => !t.done);
  const doneTasks = dayTasks.filter(t =>  t.done);

  if (dayEventEntries.length === 0 && dayTasks.length === 0) {
    const p = document.createElement('p'); p.className = 'modal-hint';
    p.textContent = 'Keine Einträge für diesen Tag.';
    content.appendChild(p);
  }

  // ── Termine ───────────────────────────────────────────────
  if (dayEventEntries.length > 0) {
    const head = document.createElement('div'); head.className = 'cal-day-section-head'; head.textContent = 'Termine';
    content.appendChild(head);
    dayEventEntries.forEach(({ ev, key: evKey, isRange, isRecurring }) => {
      const row  = document.createElement('div'); row.className = 'cal-day-ev-row';
      const left = document.createElement('div'); left.className = 'cal-day-ev-left';

      if (ev.color) {
        const dot = document.createElement('span'); dot.className = 'cal-day-ev-color-dot'; dot.style.background = ev.color;
        left.appendChild(dot);
      }

      if (ev.time && !isRange) {
        const t = document.createElement('span'); t.className = 'cal-day-ev-time'; t.textContent = ev.time; left.appendChild(t);
      }
      if (isRange) {
        const rangeLabel = document.createElement('span'); rangeLabel.className = 'cal-day-ev-range';
        const start = parseLocalDate(ev.startDate || evKey);
        const end   = parseLocalDate(ev.endDate);
        rangeLabel.textContent = start.toLocaleDateString('de-DE',{day:'numeric',month:'short'})
          + ' – ' + end.toLocaleDateString('de-DE',{day:'numeric',month:'short'});
        left.appendChild(rangeLabel);

        // Status badge
        const status = getEventStatusLabel(ev, date);
        if (status) {
          const badge = document.createElement('span'); badge.className = 'cal-day-ev-status'; badge.textContent = status;
          left.appendChild(badge);
        }
      }

      const tit = document.createElement('span'); tit.className = 'cal-day-ev-title';
      tit.textContent = (isRecurring ? '↻ ' : '') + ev.title;
      left.appendChild(tit);
      if (ev.notes) { const n = document.createElement('span'); n.className = 'cal-day-ev-notes'; n.textContent = ev.notes; left.appendChild(n); }

      const actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';
      const edit = document.createElement('button'); edit.className = 'task-delete'; edit.textContent = '✎';
      edit.addEventListener('click', () => {
        closeCalDayModal();
        if (isRecurring) openEditScopeModal(ev, date, 'edit');
        else openEventModal(evKey, date, ev);
      });
      const del = document.createElement('button'); del.className = 'task-delete'; del.textContent = '✕';
      del.addEventListener('click', () => {
        if (isRecurring) { openEditScopeModal(ev, date, 'delete'); return; }
        events[evKey] = (events[evKey] || []).filter(e => e.id !== ev.id);
        if (countdownVisible[ev.id]) delete countdownVisible[ev.id];
        saveEvents(); DB.set('countdownVisible', countdownVisible);
        updateCountdown(); renderCalendar(); openCalDayModal(key, date);
      });
      actions.append(edit, del); row.append(left, actions); content.appendChild(row);
    });
  }

  // ── Offene Aufgaben ───────────────────────────────────────
  if (openTasks.length > 0) {
    const head = document.createElement('div'); head.className = 'cal-day-section-head'; head.textContent = 'Offene Aufgaben'; content.appendChild(head);
    openTasks.forEach(t => {
      const row  = document.createElement('div'); row.className = 'cal-day-ev-row';
      const left = document.createElement('div'); left.className = 'cal-day-ev-left';
      const dot  = document.createElement('span'); dot.className = 'cal-task-dot'; dot.dataset.prio = t.priority; left.appendChild(dot);
      const tit  = document.createElement('span'); tit.className = 'cal-day-ev-title'; tit.textContent = t.title; left.appendChild(tit);
      if (t.notes) { const n = document.createElement('span'); n.className = 'cal-day-ev-notes'; n.textContent = t.notes; left.appendChild(n); }
      row.appendChild(left); content.appendChild(row);
    });
  }

  // ── Erledigte Aufgaben ────────────────────────────────────
  if (doneTasks.length > 0) {
    const head = document.createElement('div'); head.className = 'cal-day-section-head cal-day-section-head--done'; head.textContent = 'Erledigt'; content.appendChild(head);
    doneTasks.forEach(t => {
      const row  = document.createElement('div'); row.className = 'cal-day-ev-row cal-day-ev-row--done';
      const left = document.createElement('div'); left.className = 'cal-day-ev-left';
      const dot  = document.createElement('span'); dot.className = 'cal-task-dot'; dot.dataset.prio = t.priority; left.appendChild(dot);
      const tit  = document.createElement('span'); tit.className = 'cal-day-ev-title'; tit.textContent = t.title; left.appendChild(tit);
      if (t.notes) { const n = document.createElement('span'); n.className = 'cal-day-ev-notes'; n.textContent = t.notes; left.appendChild(n); }
      row.appendChild(left); content.appendChild(row);
    });
  }

  document.getElementById('cal-day-modal-overlay').classList.remove('hidden');
}

function closeCalDayModal() { document.getElementById('cal-day-modal-overlay').classList.add('hidden'); calDayTarget = null; }
document.getElementById('cal-day-modal-close').addEventListener('click', closeCalDayModal);
document.getElementById('cal-day-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('cal-day-modal-overlay')) closeCalDayModal();
});
document.getElementById('cal-day-add-event').addEventListener('click', () => {
  if (!calDayTarget) return;
  const { key, date } = calDayTarget;
  closeCalDayModal();
  openEventModal(key, date);
});

// =========================
// COUNTDOWN MODAL
// =========================

function openCountdownModal()  { renderCountdownList(); document.getElementById('countdown-modal-overlay').classList.remove('hidden'); }
function closeCountdownModal() { document.getElementById('countdown-modal-overlay').classList.add('hidden'); }

function renderCountdownList() {
  const list = document.getElementById('countdown-list'); list.innerHTML = '';
  const now = new Date(); now.setHours(0,0,0,0);
  const allC = [];

  Object.entries(events).forEach(([key, dayEvs]) => {
    dayEvs.forEach(ev => {
      if (!ev.countdown) return;
      const refKey  = ev.endDate || key;
      const evDate  = parseLocalDate(refKey); evDate.setHours(0,0,0,0);
      const daysLeft = Math.ceil((evDate - now) / 86400000);
      if (daysLeft >= 0) allC.push({ id: ev.id, title: ev.title, daysLeft });
    });
  });

  allC.sort((a, b) => a.daysLeft - b.daysLeft)
      .forEach(c => list.appendChild(makeCountdownRow(c.id, c.title, c.daysLeft)));

  if (allC.length === 0) {
    const p = document.createElement('p'); p.className = 'modal-hint';
    p.textContent = 'Noch keine Countdown-Termine. Aktiviere die Countdown-Option beim Erstellen eines Termins.';
    list.appendChild(p);
  }
}

function makeCountdownRow(id, title, days) {
  const row  = document.createElement('div'); row.className = 'countdown-row';
  const info = document.createElement('div'); info.className = 'countdown-row-info';
  const name = document.createElement('span'); name.className = 'countdown-row-title'; name.textContent = title;
  const badge = document.createElement('span'); badge.className = 'countdown-row-days'; badge.textContent = `${days} Tage`;
  info.append(name, badge);
  const lbl = document.createElement('label'); lbl.className = 'toggle';
  const cb  = document.createElement('input'); cb.type = 'checkbox'; cb.checked = countdownVisible[id] === true;
  cb.addEventListener('change', () => {
    if (cb.checked) countdownVisible[id] = true; else delete countdownVisible[id];
    DB.set('countdownVisible', countdownVisible);
    updateCountdown();
  });
  const slider = document.createElement('span'); slider.className = 'toggle-slider';
  lbl.append(cb, slider); row.append(info, lbl); return row;
}

document.getElementById('countdown-modal-close').addEventListener('click', closeCountdownModal);
document.getElementById('countdown-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('countdown-modal-overlay')) closeCountdownModal();
});
