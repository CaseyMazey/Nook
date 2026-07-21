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
  grid.classList.remove('cal-fade');
  void grid.offsetWidth; // Reflow erzwingen, damit die Animation bei jedem Aufruf neu startet
  grid.classList.add('cal-fade');
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
      const holiday = (typeof holidayForDate === 'function') ? holidayForDate(date) : null;
      el.className = 'cal-day'
        + (otherMonth  ? ' other-month' : '')
        + (isToday(date) ? ' is-today'   : '')
        + (holiday       ? ' is-holiday' : '')
        + (date.getDay() === 0 || date.getDay() === 6 ? ' weekend' : '');
      el.style.cursor = 'pointer';

      const num = document.createElement('span');
      num.className = 'cal-day-num';
      num.textContent = date.getDate();
      el.appendChild(num);

      const items = document.createElement('div'); items.className = 'cal-items';
      let shown = 0;

      if (holiday) {
        const hPill = document.createElement('div');
        hPill.className = 'cal-holiday-pill';
        hPill.textContent = holiday.label;
        hPill.title = holiday.label;
        items.appendChild(hPill);
      }


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

  // ── Phase 1: Monatsplaner-Sidebar + Header aktualisieren ────
  if (typeof renderCalendarSidebar === 'function') renderCalendarSidebar();
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

// =============================================================
// =============================================================
// MONATSPLANER — PHASE 1: GRUNDGERÜST
// Saisonaler Header, Banner, Info-Karte (Wetter/Mond/Saison),
// responsive Sidebar mit Countdown- und Statistik-Karte.
// Geburtstage/Feiertage/Monatsziele: Struktur vorbereitet,
// bleiben bis Phase 2–4 ausgeblendet (keine Daten vorhanden).
// =============================================================
// =============================================================

// ── Saison-Definitionen (astronomisch angenähert) ───────────
const SEASON_DEFS = [
  { from:[12,21], to:[3,19], sub:{ label:'Winter', icon:'❄️', css:'winter', sentences:[
    'Schnee liegt über dem Land, drinnen ist es gemütlich warm.',
    'Kalte Tage, klare Nächte — Zeit für heißen Tee.',
    'Die Welt ruht unter einer weißen Decke.'
  ]}},
  { from:[3,20], to:[4,19], sub:{ label:'Frühlingsanfang', icon:'🌱', css:'spring-early', sentences:[
    'Die ersten Blumen blühen und die Tage werden länger.',
    'Zartes Grün erobert langsam die Wiesen zurück.',
    'Die Natur erwacht aus dem Winterschlaf.'
  ]}},
  { from:[4,20], to:[6,20], sub:{ label:'Später Frühling', icon:'🌸', css:'spring-late', sentences:[
    'Blühende Wiesen und laue Abende kündigen den Sommer an.',
    'Alles blüht in vollen Farben.',
    'Lange Tage, warme Luft — der Sommer ist nah.'
  ]}},
  { from:[6,21], to:[8,22], sub:{ label:'Hochsommer', icon:'☀️', css:'summer-high', sentences:[
    'Lange Tage, warme Abende und neue Möglichkeiten.',
    'Warmes Sonnenlicht lädt zum Draußensein ein.',
    'Zeit für Badeseen und laue Sommernächte.'
  ]}},
  { from:[8,23], to:[9,22], sub:{ label:'Spätsommer', icon:'🌻', css:'summer-late', sentences:[
    'Die Sonne steht schon etwas tiefer, die Ernte beginnt.',
    'Noch warm, aber der Herbst kündigt sich leise an.',
    'Goldenes Licht über reifen Feldern.'
  ]}},
  { from:[9,23], to:[10,31], sub:{ label:'Herbstanfang', icon:'🍂', css:'autumn-early', sentences:[
    'Die Blätter verfärben sich langsam.',
    'Kühle Morgen, bunte Wälder.',
    'Die Luft riecht nach Herbst.'
  ]}},
  { from:[11,1], to:[12,20], sub:{ label:'Spätherbst', icon:'🌫️', css:'autumn-late', sentences:[
    'Nebel liegt über den Feldern, die Bäume werden kahl.',
    'Die letzten Blätter fallen.',
    'Kurze Tage, frühe Dämmerung.'
  ]}},
];

// Mapping Unter-Saison → grobe Saison-Gruppe (für Banner-Klasse + data-season,
// da spätere Illustrationen vermutlich pro Jahreszeit geladen werden, nicht
// pro Unter-Saison — Unter-Saisons bleiben nur für Label/Satz-Rotation relevant).
const SEASON_GROUP_MAP = {
  'winter': 'winter',
  'spring-early': 'spring', 'spring-late': 'spring',
  'summer-high': 'summer',  'summer-late': 'summer',
  'autumn-early': 'autumn', 'autumn-late': 'autumn',
};

function seasonMatch(date, def) {
  const [fm, fd] = def.from, [tm, td] = def.to;
  const y = date.getFullYear();
  let start, end;
  if (fm > tm) { // Winter: wraps Jahreswechsel
    if (date.getMonth()+1 >= fm) { start = new Date(y, fm-1, fd); end = new Date(y+1, tm-1, td, 23,59,59); }
    else                          { start = new Date(y-1, fm-1, fd); end = new Date(y, tm-1, td, 23,59,59); }
  } else {
    start = new Date(y, fm-1, fd); end = new Date(y, tm-1, td, 23,59,59);
  }
  return date >= start && date <= end;
}

function getSeasonInfo(date) {
  const idx = SEASON_DEFS.findIndex(d => seasonMatch(date, d));
  const def = SEASON_DEFS[idx >= 0 ? idx : 0];
  const sub = def.sub;
  const sentence = sub.sentences[date.getDate() % sub.sentences.length];

  const nextDef = SEASON_DEFS[(Math.max(idx,0)+1) % SEASON_DEFS.length];
  const y = date.getFullYear();
  let nextStart = new Date(y, nextDef.from[0]-1, nextDef.from[1]);
  if (nextStart <= date) nextStart = new Date(y+1, nextDef.from[0]-1, nextDef.from[1]);
  const daysUntil = Math.ceil((nextStart - date) / 86400000);

  return {
    label: sub.label, icon: sub.icon, css: sub.css, sentence,
    nextLabel: nextDef.sub.label, nextIcon: nextDef.sub.icon, daysUntil
  };
}

// ── Mondphase (astronomische Näherungsformel, offline) ──────
const MOON_REF_MS   = Date.UTC(2000,0,6,18,14,0);
const SYNODIC_MONTH = 29.530588853;
const MOON_PHASES = [
  { max:0.033, label:'Neumond',            icon:'🌑' },
  { max:0.25,  label:'Zunehmende Sichel',  icon:'🌒' },
  { max:0.283, label:'Erstes Viertel',     icon:'🌓' },
  { max:0.467, label:'Zunehmender Mond',   icon:'🌔' },
  { max:0.533, label:'Vollmond',           icon:'🌕' },
  { max:0.717, label:'Abnehmender Mond',   icon:'🌖' },
  { max:0.75,  label:'Letztes Viertel',    icon:'🌗' },
  { max:0.967, label:'Abnehmende Sichel',  icon:'🌘' },
  { max:1.001, label:'Neumond',            icon:'🌑' },
];

function getMoonPhase(date) {
  const days = (date.getTime() - MOON_REF_MS) / 86400000;
  let phase = (days % SYNODIC_MONTH) / SYNODIC_MONTH;
  if (phase < 0) phase += 1;
  const illum = Math.round((1 - Math.cos(2*Math.PI*phase)) / 2 * 100);
  const p = MOON_PHASES.find(p => phase <= p.max) || MOON_PHASES[0];
  return { label: p.label, icon: p.icon, illum };
}

// ── Header: Saison-Tag, Titel-Zeile, Satz, Banner ────────────
function renderCalSeasonHeader() {
  const midMonth = new Date(calDate.getFullYear(), calDate.getMonth(), 15);
  const info = getSeasonInfo(midMonth);

  const iconEl = document.getElementById('cal-season-icon');
  const labelEl = document.getElementById('cal-season-label');
  const sentEl = document.getElementById('cal-season-sentence');
  const heroEl = document.getElementById('cal-hero');
  if (!iconEl) return; // Sidebar-Markup noch nicht vorhanden

  iconEl.textContent = info.icon;
  labelEl.textContent = info.label;
  sentEl.textContent = info.sentence;
  const seasonGroup = SEASON_GROUP_MAP[info.css] || 'summer';
  if (heroEl) {
    heroEl.className = 'cal-hero cal-hero-' + seasonGroup;
    heroEl.dataset.season = seasonGroup;
  }
}

// ── Info-Karte: Wetter (Cache aus today.js), Mond, Saison-Countdown ──
function renderCalWeatherRow() {
  const iconEl = document.getElementById('cal-weather-icon');
  const tempEl = document.getElementById('cal-weather-temp');
  const descEl = document.getElementById('cal-weather-desc');
  if (!tempEl) return;

  const saved = (typeof DB !== 'undefined') ? DB.get('weatherData', null) : null;
  if (saved && saved.svgCode) {
    iconEl.innerHTML = saved.svgCode;
    tempEl.textContent = saved.temp;
    descEl.textContent = saved.desc;
  } else {
    iconEl.innerHTML = (typeof WEATHER_SVGS !== 'undefined') ? WEATHER_SVGS.unknown : '';
    tempEl.textContent = '—';
    descEl.textContent = 'Wetter momentan nicht verfügbar.';
  }
}

function renderCalMoonRow(date) {
  const iconEl = document.getElementById('cal-moon-icon');
  const phaseEl = document.getElementById('cal-moon-phase');
  const illumEl = document.getElementById('cal-moon-illum');
  if (!phaseEl) return;
  const m = getMoonPhase(date);
  iconEl.textContent = m.icon;
  phaseEl.textContent = m.label;
  illumEl.textContent = m.illum + ' % beleuchtet';
}

function renderCalSeasonInfoRow(date) {
  const iconEl = document.getElementById('cal-season-info-icon');
  const mainEl = document.getElementById('cal-season-info-main');
  const subEl  = document.getElementById('cal-season-info-sub');
  if (!mainEl) return;
  const info = getSeasonInfo(date);
  iconEl.textContent = info.nextIcon;
  mainEl.textContent = info.nextLabel;
  subEl.textContent  = info.daysUntil <= 0 ? 'heute' : `in ${info.daysUntil} Tagen`;
}

function renderCalInfoCard() {
  const now = new Date();
  renderCalWeatherRow();
  renderCalMoonRow(now);
  renderCalSeasonInfoRow(now);
}

// ── Sidebar: Countdown-Karte (nutzt bestehende countdownVisible-Daten) ──
function renderCalCountdownCard() {
  const card = document.getElementById('cal-card-countdowns');
  const list = document.getElementById('cal-countdown-list');
  if (!card || !list) return;
  list.innerHTML = '';

  const now = new Date(); now.setHours(0,0,0,0);
  const items = [];
  Object.entries(events).forEach(([key, dayEvs]) => {
    (dayEvs || []).forEach(ev => {
      if (!ev.countdown || countdownVisible[ev.id] !== true) return;
      const refKey = ev.endDate || key;
      const evDate = parseLocalDate(refKey); evDate.setHours(0,0,0,0);
      const days = Math.ceil((evDate - now) / 86400000);
      if (days >= 0) items.push({ title: ev.title, days });
    });
  });

  if (items.length === 0) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  items.sort((a,b) => a.days - b.days).forEach(it => {
    const row = document.createElement('div'); row.className = 'cal-side-row';
    const name = document.createElement('span'); name.className = 'cal-side-row-title'; name.textContent = it.title;
    const badge = document.createElement('span'); badge.className = 'cal-side-row-badge';
    badge.textContent = it.days === 0 ? 'Heute' : it.days === 1 ? 'Morgen' : `${it.days} Tage`;
    row.append(name, badge); list.appendChild(row);
  });
}

// ── Sidebar: Monatsstatistik-Karte (vollständig automatisch berechnet) ──
function renderCalStatsCard() {
  const card = document.getElementById('cal-card-stats');
  const list = document.getElementById('cal-stats-list');
  if (!card || !list) return;
  list.innerHTML = '';

  const year = calDate.getFullYear(), month = calDate.getMonth();
  const daysInMonth = new Date(year, month+1, 0).getDate();

  const eventIds = new Set();
  const taskIds = new Set();
  const doneTaskIds = new Set();
  let activeDays = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayEvs = getEventsForDay(date);
    const dayTasks = (typeof getTasksForCalendarDay === 'function') ? getTasksForCalendarDay(date) : [];
    if (dayEvs.length || dayTasks.length) activeDays++;
    dayEvs.forEach(({ ev }) => eventIds.add(ev.id));
    dayTasks.forEach(t => { taskIds.add(t.id); if (t.done) doneTaskIds.add(t.id); });
  }

  if (eventIds.size === 0 && taskIds.size === 0) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  const avgPerWeek = (eventIds.size / (daysInMonth / 7)).toFixed(1);
  const rows = [
    ['📅 Termine', eventIds.size],
    ['✓ Erledigte Aufgaben', `${doneTaskIds.size} / ${taskIds.size}`],
    ['🔥 Aktive Tage', activeDays],
    ['Ø Termine / Woche', avgPerWeek],
  ];
  rows.forEach(([label, val]) => {
    const row = document.createElement('div'); row.className = 'cal-side-row';
    const l = document.createElement('span'); l.className = 'cal-side-row-title'; l.textContent = label;
    const v = document.createElement('span'); v.className = 'cal-side-row-badge'; v.textContent = val;
    row.append(l, v); list.appendChild(row);
  });
}

// ── Sidebar: Master-Funktion — wird am Ende von renderCalendar() aufgerufen ──
function renderCalendarSidebar() {
  renderCalSeasonHeader();
  renderCalInfoCard();
  renderCalCountdownCard();
  renderCalBirthdaysCard();
  renderCalHolidaysCard();
  renderCalGoalsCard();
  renderCalStatsCard();
}

// =============================================================
// =============================================================
// MONATSPLANER — PHASE 4: MONATSZIELE
// Kleine Checkliste pro Kalendermonat. Manuell gepflegt (kann
// später automatisch aus Projekten befüllt werden). Wird im
// Gegensatz zu den anderen Karten immer angezeigt, da sie die
// einzige Stelle ist, an der Ziele überhaupt angelegt werden.
// =============================================================
// =============================================================

let monthlyGoals = DB.get('monthlyGoals', {});
function saveMonthlyGoals(){ DB.set('monthlyGoals', monthlyGoals); }

function monthKeyFor(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}
function getGoalsForMonth(key) {
  if (!monthlyGoals[key]) monthlyGoals[key] = [];
  return monthlyGoals[key];
}

function renderCalGoalsCard() {
  const card     = document.getElementById('cal-card-goals');
  const list     = document.getElementById('cal-goals-list');
  const progress = document.getElementById('cal-goals-progress');
  if (!card || !list) return;
  list.innerHTML = '';
  card.classList.remove('hidden');

  const key   = monthKeyFor(calDate);
  const goals = getGoalsForMonth(key);

  goals.forEach(g => {
    const row = document.createElement('div'); row.className = 'cal-goal-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.className = 'cal-goal-checkbox'; cb.checked = g.done;
    cb.addEventListener('change', () => { g.done = cb.checked; saveMonthlyGoals(); renderCalGoalsCard(); });

    const label = document.createElement('span');
    label.className = 'cal-goal-text' + (g.done ? ' cal-goal-text--done' : '');
    label.textContent = g.text;

    const del = document.createElement('button'); del.className = 'task-delete'; del.textContent = '✕';
    del.title = 'Ziel löschen';
    del.addEventListener('click', () => {
      monthlyGoals[key] = goals.filter(x => x.id !== g.id);
      saveMonthlyGoals();
      renderCalGoalsCard();
    });

    row.append(cb, label, del);
    list.appendChild(row);
  });

  // ── Zeile zum Hinzufügen eines neuen Ziels ──
  const addRow = document.createElement('div'); addRow.className = 'cal-goal-add-row';
  const input  = document.createElement('input');
  input.type = 'text'; input.className = 'cal-goal-add-input'; input.placeholder = 'Neues Ziel …';
  const addBtn = document.createElement('button'); addBtn.className = 'cal-goal-add-btn'; addBtn.textContent = '+';

  function addGoal() {
    const text = input.value.trim();
    if (!text) return;
    goals.push({ id: crypto.randomUUID(), text, done: false });
    saveMonthlyGoals();
    renderCalGoalsCard();
  }
  addBtn.addEventListener('click', addGoal);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') addGoal(); });

  addRow.append(input, addBtn);
  list.appendChild(addRow);

  const doneCount = goals.filter(g => g.done).length;
  progress.textContent = goals.length ? `${doneCount} / ${goals.length} erledigt` : '';
}

// =============================================================
// =============================================================
// MONATSPLANER — PHASE 3: FEIERTAGE NACH BUNDESLAND
// Vollständig offline berechnet (Gauß'sche Osterformel + feste
// Bundesland-Zuordnung) — keine externe API, keine hartcodierten
// Jahreslisten. Einstellung wird dauerhaft gespeichert, damit
// Personal Hub von mehreren Personen in unterschiedlichen
// Bundesländern genutzt werden kann.
// =============================================================
// =============================================================

const BUNDESLAENDER = {
  BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg',
  HB: 'Bremen', HH: 'Hamburg', HE: 'Hessen', MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz',
  SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein',
  TH: 'Thüringen'
};

let calendarSettings = DB.get('calendarSettings', { bundesland: null });
function saveCalendarSettings(){ DB.set('calendarSettings', calendarSettings); }

// ── Gauß'sche Osterformel (Ostersonntag, offline berechnet) ──
function getEasterSunday(year) {
  const k  = Math.floor(year / 100);
  const m  = 15 + Math.floor((3*k + 3) / 4) - Math.floor((8*k + 13) / 25);
  const s  = 2 - Math.floor((3*k + 3) / 4);
  const a  = year % 19;
  const d  = (19*a + m) % 30;
  const r  = Math.floor((d + Math.floor(a/11)) / 29); // Epakten-Korrekturfaktor r ∈ {0,1}
  const og = 21 + d - r;
  const sz = 7 - (year + Math.floor(year/4) + s) % 7;
  const oe = 7 - (og - sz) % 7;
  const os = og + oe;
  return os <= 31 ? new Date(year, 2, os) : new Date(year, 3, os - 31);
}

function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }

// Buß- und Bettag: Mittwoch vor dem 23. November
function busUndBettag(year) {
  let d = new Date(year, 10, 22);
  while (d.getDay() !== 3) d.setDate(d.getDate() - 1);
  return d;
}

// ── Feiertagsliste für ein Jahr + Bundesland ─────────────────
// bl = Kürzel aus BUNDESLAENDER oder null (dann nur bundesweite Feiertage)
function getHolidaysForYear(year, bl) {
  const easter = getEasterSunday(year);
  const list = [];
  const add = (date, label) => list.push({ date, label });

  // Bundesweit
  add(new Date(year,0,1),    'Neujahr');
  add(addDays(easter,-2),    'Karfreitag');
  add(addDays(easter,1),     'Ostermontag');
  add(new Date(year,4,1),    'Tag der Arbeit');
  add(addDays(easter,39),    'Christi Himmelfahrt');
  add(addDays(easter,50),    'Pfingstmontag');
  add(new Date(year,9,3),    'Tag der Deutschen Einheit');
  add(new Date(year,11,25),  '1. Weihnachtstag');
  add(new Date(year,11,26),  '2. Weihnachtstag');

  // Bundesland-abhängig
  if (['BW','BY','ST'].includes(bl))                                 add(new Date(year,0,6),  'Heilige Drei Könige');
  if (['BE','MV'].includes(bl))                                      add(new Date(year,2,8),  'Internationaler Frauentag');
  if (['BW','BY','HE','NW','RP','SL'].includes(bl))                  add(addDays(easter,60),  'Fronleichnam');
  if (['BY','SL'].includes(bl))                                      add(new Date(year,7,15), 'Mariä Himmelfahrt');
  if (bl === 'TH')                                                   add(new Date(year,8,20), 'Weltkindertag');
  if (['BB','MV','SN','ST','TH','HB','HH','NI','SH'].includes(bl))   add(new Date(year,9,31), 'Reformationstag');
  if (['BW','BY','NW','RP','SL'].includes(bl))                       add(new Date(year,10,1), 'Allerheiligen');
  if (bl === 'SN')                                                   add(busUndBettag(year),  'Buß- und Bettag');

  // Besondere Tage (kein gesetzlicher Feiertag, aber verbreitet notiert)
  add(new Date(year,11,24), 'Heiligabend');
  add(new Date(year,11,31), 'Silvester');

  return list;
}

function holidayForDate(date) {
  const list = getHolidaysForYear(date.getFullYear(), calendarSettings.bundesland);
  return list.find(h =>
    h.date.getFullYear() === date.getFullYear() &&
    h.date.getMonth()    === date.getMonth() &&
    h.date.getDate()     === date.getDate()
  ) || null;
}

// ── Sidebar-Karte: Feiertage im aktuell angezeigten Monat ────
function renderCalHolidaysCard() {
  const card = document.getElementById('cal-card-holidays');
  const list = document.getElementById('cal-holidays-list');
  if (!card || !list) return;
  list.innerHTML = '';

  const year = calDate.getFullYear(), month = calDate.getMonth();
  const holidays = getHolidaysForYear(year, calendarSettings.bundesland)
    .filter(h => h.date.getMonth() === month)
    .sort((a, b) => a.date - b.date);

  if (holidays.length === 0) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  holidays.forEach(h => {
    const row = document.createElement('div'); row.className = 'cal-side-row';
    const name = document.createElement('span'); name.className = 'cal-side-row-title'; name.textContent = h.label;
    const badge = document.createElement('span'); badge.className = 'cal-side-row-badge';
    badge.textContent = h.date.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' });
    row.append(name, badge); list.appendChild(row);
  });
}

// ── Einstellungs-Modal: Bundesland auswählen ─────────────────
document.getElementById('cal-settings-btn')?.addEventListener('click', () => {
  const sel = document.getElementById('calendar-bundesland-select');
  if (sel) sel.value = calendarSettings.bundesland || '';
  document.getElementById('calendar-settings-modal-overlay')?.classList.remove('hidden');
});
function closeCalSettingsModal() {
  document.getElementById('calendar-settings-modal-overlay')?.classList.add('hidden');
}
document.getElementById('calendar-settings-modal-close')?.addEventListener('click', closeCalSettingsModal);
document.getElementById('calendar-settings-modal-done')?.addEventListener('click', closeCalSettingsModal);
document.getElementById('calendar-settings-modal-overlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('calendar-settings-modal-overlay')) closeCalSettingsModal();
});
document.getElementById('calendar-bundesland-select')?.addEventListener('change', e => {
  calendarSettings.bundesland = e.target.value || null;
  saveCalendarSettings();
  renderCalendar();
});

// =============================================================
// =============================================================
// MONATSPLANER — PHASE 2: GEBURTSTAGSVERWALTUNG
// Eigenes Datenmodell, komplett getrennt von `events`. Jeder
// Geburtstag erscheint automatisch jedes Jahr erneut — es gibt
// keine Kopien pro Jahr. Verwaltung über eigenes Modal
// (Button im Karten-Header der Geburtstage-Karte).
// =============================================================
// =============================================================

let birthdays = DB.get('birthdays', []);
function saveBirthdays(){ DB.set('birthdays', birthdays); }

const BIRTHDAY_ICONS = ['🎂', '🎈'];

// Alter, das die Person im angegebenen Jahr an ihrem Geburtstag erreicht.
// null, wenn kein Geburtsjahr hinterlegt wurde (optionales Feld).
function birthdayAgeInYear(b, year) {
  if (!b.year) return null;
  return year - b.year;
}

// ── Sidebar-Karte: Geburtstage im aktuell angezeigten Monat ──
// Wird immer angezeigt (nicht nur bei vorhandenen Einträgen), da der
// Verwalten-Button im Karten-Header sitzt — bei versteckter Karte gäbe
// es sonst keinen Weg, den allerersten Geburtstag einzutragen.
function renderCalBirthdaysCard() {
  const card = document.getElementById('cal-card-birthdays');
  const list = document.getElementById('cal-birthdays-list');
  if (!card || !list) return;
  list.innerHTML = '';
  card.classList.remove('hidden');

  const month = calDate.getMonth() + 1;
  const year  = calDate.getFullYear();
  const entries = birthdays
    .filter(b => b.month === month)
    .sort((a, b) => a.day - b.day);

  if (entries.length === 0) {
    const p = document.createElement('p'); p.className = 'cal-side-empty-hint';
    p.textContent = 'Keine Geburtstage in diesem Monat.';
    list.appendChild(p);
    return;
  }

  entries.forEach((b, i) => {
    const item = document.createElement('div'); item.className = 'cal-birthday-item';

    const dateEl = document.createElement('span'); dateEl.className = 'cal-birthday-date';
    dateEl.textContent = String(b.day).padStart(2, '0') + '.' + String(b.month).padStart(2, '0') + '.';

    const nameEl = document.createElement('span'); nameEl.className = 'cal-birthday-name';
    nameEl.textContent = b.name + ' ' + BIRTHDAY_ICONS[i % BIRTHDAY_ICONS.length];

    item.append(dateEl, nameEl);

    const age = birthdayAgeInYear(b, year);
    if (age !== null && age >= 0) {
      const ageEl = document.createElement('span'); ageEl.className = 'cal-birthday-age';
      ageEl.textContent = `wird ${age}`;
      item.appendChild(ageEl);
    }

    list.appendChild(item);
  });
}

// ── Verwaltungs-Modal: Liste + Hinzufügen/Löschen ──
function renderBirthdayManageList() {
  const list = document.getElementById('birthday-manage-list');
  if (!list) return;
  list.innerHTML = '';

  if (birthdays.length === 0) {
    const p = document.createElement('p'); p.className = 'modal-hint';
    p.textContent = 'Noch keine Geburtstage eingetragen.';
    list.appendChild(p);
    return;
  }

  const sorted = [...birthdays].sort((a, b) => (a.month - b.month) || (a.day - b.day));
  sorted.forEach(b => {
    const row = document.createElement('div'); row.className = 'cal-birthday-manage-row';

    const info = document.createElement('span'); info.className = 'cal-birthday-manage-info';
    const dateStr = String(b.day).padStart(2, '0') + '.' + String(b.month).padStart(2, '0') + '.' + (b.year ? ' ' + b.year : '');
    info.textContent = `${dateStr} — ${b.name}`;

    const del = document.createElement('button'); del.className = 'task-delete'; del.textContent = '✕';
    del.title = 'Geburtstag löschen';
    del.addEventListener('click', () => {
      birthdays = birthdays.filter(x => x.id !== b.id);
      saveBirthdays();
      renderBirthdayManageList();
      renderCalBirthdaysCard();
    });

    row.append(info, del);
    list.appendChild(row);
  });
}

function clearBirthdayForm() {
  ['birthday-name-input', 'birthday-day-input', 'birthday-month-input', 'birthday-year-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function openBirthdayModal() {
  renderBirthdayManageList();
  document.getElementById('birthday-modal-overlay')?.classList.remove('hidden');
}
function closeBirthdayModal() {
  document.getElementById('birthday-modal-overlay')?.classList.add('hidden');
  clearBirthdayForm();
}

document.getElementById('cal-birthdays-manage-btn')?.addEventListener('click', openBirthdayModal);
document.getElementById('birthday-modal-close')?.addEventListener('click', closeBirthdayModal);
document.getElementById('birthday-modal-done')?.addEventListener('click', closeBirthdayModal);
document.getElementById('birthday-modal-overlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('birthday-modal-overlay')) closeBirthdayModal();
});

document.getElementById('birthday-add-btn')?.addEventListener('click', () => {
  const nameEl  = document.getElementById('birthday-name-input');
  const dayEl   = document.getElementById('birthday-day-input');
  const monthEl = document.getElementById('birthday-month-input');
  const yearEl  = document.getElementById('birthday-year-input');

  const name  = nameEl.value.trim();
  const day   = parseInt(dayEl.value, 10);
  const month = parseInt(monthEl.value, 10);
  const yearRaw = yearEl.value.trim();
  const year  = yearRaw ? parseInt(yearRaw, 10) : null;

  if (!name || !day || !month || day < 1 || day > 31 || month < 1 || month > 12) return;
  if (year !== null && (year < 1900 || year > new Date().getFullYear())) return;

  birthdays.push({ id: crypto.randomUUID(), name, day, month, year });
  saveBirthdays();
  clearBirthdayForm();
  renderBirthdayManageList();
  renderCalBirthdaysCard();
});

document.getElementById('birthday-name-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('birthday-add-btn').click();
});
