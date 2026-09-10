// =========================
// USERNAME (global, für Begrüßung + spätere Nutzung)
// =========================
let userName = DB.get('userName', '');

// =========================
// GREETING + HEADER
// =========================

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 11) return 'Guten Morgen';
  if (h >= 11 && h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function renderTodayHeader() {
  const greetEl = document.getElementById('today-greeting');
  const subEl   = document.getElementById('today-subtitle');
  if (!greetEl || !subEl) return;

  const name = userName ? `, ${userName}.` : '.';
  greetEl.textContent = getGreeting() + name;

  const now = new Date();
  const weekday  = now.toLocaleDateString('de-DE', { weekday: 'long' });
  const dateStr  = now.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  const kw       = getISOWeek(now);
  subEl.textContent = `${weekday}, ${dateStr} · KW ${kw}`;
}

// =========================
// WEATHER SVG ICONS — minimal line-art style
// =========================

const WEATHER_SVGS = {
  sun: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="5" stroke="var(--sage)" stroke-width="1.8"/>
    <line x1="14" y1="2" x2="14" y2="5" stroke="var(--sage)" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="14" y1="23" x2="14" y2="26" stroke="var(--sage)" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="2" y1="14" x2="5" y2="14" stroke="var(--sage)" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="23" y1="14" x2="26" y2="14" stroke="var(--sage)" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="5.5" y1="5.5" x2="7.6" y2="7.6" stroke="var(--sage)" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="20.4" y1="20.4" x2="22.5" y2="22.5" stroke="var(--sage)" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="22.5" y1="5.5" x2="20.4" y2="7.6" stroke="var(--sage)" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="7.6" y1="20.4" x2="5.5" y2="22.5" stroke="var(--sage)" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,
  cloud: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 19a4 4 0 01-.5-7.95A6 6 0 0120 13.5a3.5 3.5 0 010 7H8z" stroke="var(--text-2)" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>`,
  partlyCloudy: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="4" stroke="var(--sage)" stroke-width="1.6"/>
    <line x1="10" y1="3" x2="10" y2="5" stroke="var(--sage)" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="3" y1="10" x2="5" y2="10" stroke="var(--sage)" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" stroke="var(--sage)" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="15.1" y1="4.9" x2="13.7" y2="6.3" stroke="var(--sage)" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M11 21a4 4 0 01-.5-7.95A5.5 5.5 0 0122 15.5a3 3 0 010 6H11z" stroke="var(--text-2)" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>`,
  rain: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 16a4 4 0 01-.5-7.95A5.5 5.5 0 0118 11a3 3 0 010 6H7z" stroke="var(--text-2)" stroke-width="1.8" stroke-linejoin="round"/>
    <line x1="9" y1="21" x2="8" y2="24" stroke="var(--text-2)" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="13" y1="21" x2="12" y2="24" stroke="var(--text-2)" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="17" y1="21" x2="16" y2="24" stroke="var(--text-2)" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  drizzle: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 16a4 4 0 01-.5-7.95A5.5 5.5 0 0118 11a3 3 0 010 6H7z" stroke="var(--text-2)" stroke-width="1.8" stroke-linejoin="round"/>
    <line x1="10" y1="20" x2="9.5" y2="22.5" stroke="var(--text-3)" stroke-width="1.4" stroke-linecap="round"/>
    <line x1="14" y1="20" x2="13.5" y2="22.5" stroke="var(--text-3)" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`,
  storm: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 15a4 4 0 01-.5-7.95A5.5 5.5 0 0118 10a3 3 0 010 6H7z" stroke="var(--text-2)" stroke-width="1.8" stroke-linejoin="round"/>
    <polyline points="13,18 11,22 14,22 12,26" stroke="var(--prio-1)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  snow: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 16a4 4 0 01-.5-7.95A5.5 5.5 0 0118 11a3 3 0 010 6H7z" stroke="var(--text-2)" stroke-width="1.8" stroke-linejoin="round"/>
    <line x1="9" y1="21" x2="9" y2="24" stroke="var(--text-3)" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="13" y1="21" x2="13" y2="24" stroke="var(--text-3)" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="17" y1="21" x2="17" y2="24" stroke="var(--text-3)" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="7.5" y1="22.5" x2="10.5" y2="22.5" stroke="var(--text-3)" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="11.5" y1="22.5" x2="14.5" y2="22.5" stroke="var(--text-3)" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  fog: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="5" y1="10" x2="23" y2="10" stroke="var(--text-3)" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="7" y1="14" x2="21" y2="14" stroke="var(--text-3)" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="5" y1="18" x2="23" y2="18" stroke="var(--text-3)" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,
  unknown: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="10" stroke="var(--text-3)" stroke-width="1.8"/>
    <line x1="14" y1="8" x2="14" y2="16" stroke="var(--text-3)" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="14" cy="19" r="1.2" fill="var(--text-3)"/>
  </svg>`,
};

function weatherCodeToSvg(code) {
  if (code === 0) return WEATHER_SVGS.sun;
  if (code <= 2) return WEATHER_SVGS.partlyCloudy;
  if (code <= 3) return WEATHER_SVGS.cloud;
  if (code <= 48) return WEATHER_SVGS.fog;
  if (code <= 57) return WEATHER_SVGS.drizzle;
  if (code <= 67) return WEATHER_SVGS.rain;
  if (code <= 77) return WEATHER_SVGS.snow;
  if (code <= 82) return WEATHER_SVGS.rain;
  if (code <= 86) return WEATHER_SVGS.snow;
  if (code <= 99) return WEATHER_SVGS.storm;
  return WEATHER_SVGS.unknown;
}

// =========================
// WEATHER — Open-Meteo API (kein API-Key nötig)
// Settings: GPS oder manuelle Stadt
// =========================

let weatherSettings = DB.get('weatherSettings', { mode: 'manual', city: 'Cologne' });

async function fetchWeatherByCoords(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();
  const wc = data.current_weather;
  const code = wc.weathercode;
  const svgCode = weatherCodeToSvg(code);
  const temp = Math.round(wc.temperature) + '°C';
  const desc = weatherCodeToDesc(code);
  return { svgCode, temp, desc };
}

async function fetchWeatherByCity(city) {
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de&format=json`;
  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) throw new Error('Geocode failed');
  const geoData = await geoRes.json();
  if (!geoData.results?.length) throw new Error('City not found');
  const { latitude, longitude } = geoData.results[0];
  return fetchWeatherByCoords(latitude, longitude);
}

function weatherCodeToDesc(code) {
  if (code === 0) return 'Klar';
  if (code <= 2) return 'Leicht bewölkt';
  if (code <= 3) return 'Bewölkt';
  if (code <= 48) return 'Nebelig';
  if (code <= 57) return 'Nieselregen';
  if (code <= 67) return 'Regen';
  if (code <= 77) return 'Schnee';
  if (code <= 82) return 'Regenschauer';
  if (code <= 86) return 'Schneeschauer';
  if (code <= 99) return 'Gewitter';
  return 'Unbekannt';
}

async function renderWeather() {
  const tempEl = document.getElementById('weather-temp');
  const descEl = document.getElementById('weather-desc');
  const iconEl = document.querySelector('.weather-icon');
  if (!tempEl) return;

  // Show loading state
  if (iconEl) iconEl.innerHTML = WEATHER_SVGS.unknown;

  weatherSettings = DB.get('weatherSettings', { mode: 'manual', city: 'Cologne' });
  const locKey = weatherSettings.mode === 'gps' ? 'gps' : `city:${(weatherSettings.city || 'Cologne').toLowerCase()}`;

  // Cache: 30 Minuten — nur nutzen, wenn svgCode vorhanden ist (invalidiert alten
  // Emoji-Cache) UND der Cache vom selben Standort stammt. Ohne locKey-Check
  // würde ein Standortwechsel bis zu 30 Min. lang noch die Werte des alten
  // Orts anzeigen.
  const saved = DB.get('weatherData', null);
  if (saved && saved.svgCode && saved.locKey === locKey && Date.now() - saved.ts < 30*60*1000) {
    if (iconEl) iconEl.innerHTML = saved.svgCode;
    tempEl.textContent = saved.temp;
    descEl.textContent = saved.desc;
    return;
  }

  try {
    let data;
    if (weatherSettings.mode === 'gps') {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
      );
      data = await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
    } else {
      const city = weatherSettings.city || 'Cologne';
      data = await fetchWeatherByCity(city);
    }
    DB.set('weatherData', { ...data, ts: Date.now(), locKey });
    if (iconEl) iconEl.innerHTML = data.svgCode;
    tempEl.textContent = data.temp;
    descEl.textContent = data.desc;
  } catch (e) {
    if (iconEl) iconEl.innerHTML = WEATHER_SVGS.unknown;
    tempEl.textContent = '—';
    descEl.textContent = 'Keine Daten';
  }
}

// =========================
// HEADER & COUNTDOWN (unverändert)
// =========================

function updateHeader() {
  state.currentWeekId = getWeekId(state.currentDate);
  document.getElementById('week-label').textContent = `KW ${getISOWeek(state.currentDate)}`;
  // today-title bleibt für Kompatibilität, wird aber nicht mehr angezeigt
  const titleEl = document.getElementById('today-title');
  if (titleEl) titleEl.textContent = fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  updateCountdown();
  DB.set('currentDate', state.currentDate.toISOString());
  renderTodayHeader();
}

function updateCountdown() {
  const now = new Date(); now.setHours(0,0,0,0);
  const container = document.getElementById('countdown-display');
  if (!container) return;
  container.innerHTML = '';
  const candidates = [];
  Object.entries(events).forEach(([key, dayEvs]) => {
    dayEvs.forEach(ev => {
      if (!ev.countdown) return;
      const evDate = parseLocalDate(key); evDate.setHours(0,0,0,0);
      const days = Math.ceil((evDate - now) / MS_PER_DAY);
      if (days >= 0) candidates.push({ id: ev.id, title: ev.title, daysLeft: days });
    });
  });
  const visible = candidates
    .filter(c => countdownVisible[c.id] === true)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Show/hide countdowns section — auf Mobile steckt section in
  // #mehr-countdown-slot (siehe js/main.js: placeSidebarWidgets()),
  // der sonst als leere, gepaddete Box sichtbar bliebe.
  const section = document.getElementById('sidebar-countdowns');
  if (section) {
    const hasCountdowns = visible.length > 0;
    section.style.display = hasCountdowns ? 'block' : 'none';
    document.getElementById('mehr-countdown-slot')?.classList.toggle('hidden', !hasCountdowns);
  }

  visible.forEach(item => {
    const entry = document.createElement('div'); entry.className = 'countdown-entry';
    const left  = document.createElement('div'); left.className = 'countdown-entry-left';
    const icon  = document.createElement('span'); icon.className = 'countdown-entry-icon'; icon.textContent = '📅';
    const info  = document.createElement('div'); info.className = 'countdown-entry-info';
    const label = document.createElement('span'); label.className = 'countdown-label'; label.textContent = item.title;
    const sub   = document.createElement('span'); sub.className = 'countdown-sub';
    sub.textContent = item.daysLeft === 0 ? 'Heute!' : item.daysLeft === 1 ? 'in 1 Tag' : `in ${item.daysLeft} Tagen`;
    info.append(label, sub); left.append(icon, info);
    const days  = document.createElement('span'); days.className = 'countdown-days'; days.textContent = item.daysLeft;
    entry.append(left, days); container.appendChild(entry);
  });
}

// Open countdown modal when section is clicked
document.getElementById('sidebar-countdowns')?.addEventListener('click', openCountdownModal);

document.getElementById('prev-week').addEventListener('click', () => {
  state.currentDate.setDate(state.currentDate.getDate() - 7); updateHeader(); renderView(currentView);
});
document.getElementById('next-week').addEventListener('click', () => {
  state.currentDate.setDate(state.currentDate.getDate() + 7); updateHeader(); renderView(currentView);
});
document.getElementById('exam-pill').addEventListener('click', openCountdownModal);

// =========================
// SIDEBAR CLOCK PANEL
// =========================

let sidebarClockInterval = null;

function buildAnalogSVG(now, size) {
  const cx = size/2, cy = size/2, r = size/2 - 3;
  const h = now.getHours()%12, mi = now.getMinutes();
  const hAngle = (h*30 + mi*0.5)*Math.PI/180 - Math.PI/2;
  const mAngle = mi*6*Math.PI/180 - Math.PI/2;
  const hand = (angle, len, stroke, sw) => {
    const x = cx + Math.cos(angle)*len, y = cy + Math.sin(angle)*len;
    const bx = cx - Math.cos(angle)*(len*0.15), by = cy - Math.sin(angle)*(len*0.15);
    return `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
  };
  let markers = '';
  for (let i = 0; i < 60; i++) {
    const a = i*6*Math.PI/180 - Math.PI/2;
    const isHour = i % 5 === 0;
    const isQuarter = i % 15 === 0;
    const innerR = isQuarter ? r - 7 : isHour ? r - 5 : r - 2.5;
    const sw = isQuarter ? 2 : isHour ? 1.5 : 0.8;
    const col = isHour ? 'var(--text-2)' : 'var(--border-strong)';
    const x1 = cx+Math.cos(a)*innerR, y1 = cy+Math.sin(a)*innerR;
    const x2 = cx+Math.cos(a)*r,      y2 = cy+Math.sin(a)*r;
    markers += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="${sw}"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;flex-shrink:0;">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${r-0.5}" fill="none" stroke="var(--border-strong)" stroke-width="0.5" opacity="0.5"/>
    ${markers}
    ${hand(hAngle, r*0.52, 'var(--text)', size > 70 ? 2.5 : 2)}
    ${hand(mAngle, r*0.72, 'var(--text-2)', size > 70 ? 1.8 : 1.4)}
    <circle cx="${cx}" cy="${cy}" r="${size > 70 ? 3 : 2}" fill="var(--sage)"/>
    <circle cx="${cx}" cy="${cy}" r="${size > 70 ? 1.2 : 0.8}" fill="var(--surface)"/>
  </svg>`;
}

function renderSidebarClock() {
  const panel = document.getElementById('clock-sidebar-panel');
  if (!panel) return;
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2,'0');
  const mm  = String(now.getMinutes()).padStart(2,'0');
  const weekday = now.toLocaleDateString('de-DE', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  panel.innerHTML = `
    <div class="clock-analog">${buildAnalogSVG(now, 96)}</div>
    <div class="clock-sidebar-right">
      <div class="clock-sidebar-time">${hh}:${mm}</div>
      <div class="clock-sidebar-weekday">${weekday}</div>
      <div class="clock-sidebar-date">${dateStr}</div>
    </div>`;
}

function startSidebarClock() {
  if (sidebarClockInterval) clearInterval(sidebarClockInterval);
  renderSidebarClock();
  sidebarClockInterval = setInterval(renderSidebarClock, 1000);
}

// =========================
// MINI KALENDER
// =========================

let miniCalDate = new Date();

function buildMiniCal(refDate) {
  const year  = refDate.getFullYear();
  const month = refDate.getMonth();
  const today = new Date(); today.setHours(0,0,0,0);

  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const dayNames   = ['Mo','Di','Mi','Do','Fr','Sa','So'];

  // Build set of days that have any event (single or range or recurring)
  const eventDays    = new Set(); // days with single events
  const rangeDays    = new Set(); // days inside a multi-day range
  const rangeStart   = new Set();
  const rangeEnd     = new Set();
  const dayColors    = new Map(); // day -> tatsächliche Termin-Farbe (erster gefundener Termin gewinnt)

  if (typeof events !== 'undefined') {
    Object.entries(events).forEach(([key, dayEvs]) => {
      (dayEvs || []).forEach(ev => {
        if (!ev.endDate) {
          // Single-day
          const d = parseLocalDate(key);
          if (d.getFullYear() === year && d.getMonth() === month) {
            eventDays.add(d.getDate());
            if (!dayColors.has(d.getDate())) dayColors.set(d.getDate(), ev.color || DEFAULT_EVENT_COLOR);
          }
          return;
        }
        // Multi-day: mark all days in range
        const start = parseLocalDate(ev.startDate || key); start.setHours(0,0,0,0);
        const end   = parseLocalDate(ev.endDate);           end.setHours(0,0,0,0);
        const cur   = new Date(start);
        while (cur <= end) {
          if (cur.getFullYear() === year && cur.getMonth() === month) {
            const d = cur.getDate();
            rangeDays.add(d);
            if (!dayColors.has(d)) dayColors.set(d, ev.color || DEFAULT_EVENT_COLOR);
            if (cur.getTime() === start.getTime()) rangeStart.add(d);
            if (cur.getTime() === end.getTime())   rangeEnd.add(d);
          }
          cur.setDate(cur.getDate() + 1);
        }
      });
    });
  }

  // Wiederkehrende Vorkommen dieses Monats ebenfalls als Punkt markieren
  if (typeof getSeriesOccurrencesInRange === 'function') {
    const gridStart = new Date(year, month, 1);
    const gridEnd   = new Date(year, month + 1, 0);
    getSeriesOccurrencesInRange(gridStart, gridEnd).forEach(({ date: d, event: ev }) => {
      if (d.getFullYear() === year && d.getMonth() === month) {
        eventDays.add(d.getDate());
        if (!dayColors.has(d.getDate())) dayColors.set(d.getDate(), ev.color || DEFAULT_EVENT_COLOR);
      }
    });
  }

  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const daysInMonth = new Date(year, month+1, 0).getDate();
  const prevDays    = new Date(year, month, 0).getDate();

  let cells = dayNames.map(d => `<div class="mini-cal-day-name">${d}</div>`).join('');

  for (let i = startDow - 1; i >= 0; i--) {
    cells += `<div class="mini-cal-cell other-month"><span>${prevDays - i}</span></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d); cellDate.setHours(0,0,0,0);
    const isT  = cellDate.getTime() === today.getTime();
    const hasE = eventDays.has(d);
    const isR  = rangeDays.has(d);
    const isRS = rangeStart.has(d);
    const isRE = rangeEnd.has(d);
    const key  = dateKey(cellDate);

    const cls = ['mini-cal-cell',
      isT  ? 'is-today'    : '',
      hasE ? 'has-events'  : '',
      isR  ? 'in-range'    : '',
      isRS ? 'range-start' : '',
      isRE ? 'range-end'   : '',
    ].filter(Boolean).join(' ');

    // Farbiger Punkt/Hintergrund zeigt die tatsächliche Terminfarbe; bei "heute" bleibt die kontrastreiche Standardfarbe erhalten
    const dotColor   = (hasE && !isT) ? dayColors.get(d) : null;
    const rangeColor = (isR  && !isT) ? dayColors.get(d) : null;
    const dotStyle   = dotColor   ? ` style="background:${dotColor}"` : '';
    const cellStyle  = rangeColor ? ` style="background:${hexToRgba(rangeColor, (isRS || isRE) ? 0.22 : 0.14)}"` : '';
    const numStyle   = rangeColor ? ` style="color:${rangeColor}"` : '';

    cells += `<div class="${cls}" data-date="${key}" data-day="${d}"${cellStyle}><span class="mini-cal-daynum"${numStyle}>${d}</span><span class="mini-cal-dot"${dotStyle}></span></div>`;
  }

  const total     = startDow + daysInMonth;
  const remainder = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remainder; d++) {
    cells += `<div class="mini-cal-cell other-month"><span>${d}</span></div>`;
  }

  // Upcoming events list (next 14 days) — includes multi-day starts + recurring
  let upcomingHtml = '';
  const upcoming = [];
  const seenIds  = new Set();
  for (let i = 0; i <= 14; i++) {
    const d   = new Date(today); d.setDate(today.getDate() + i);
    const key = dateKey(d);
    // Single-day events on this day
    (events[key] || []).forEach(ev => {
      if (seenIds.has(ev.id)) return;
      seenIds.add(ev.id);
      const evColor = ev.color || DEFAULT_EVENT_COLOR;
      if (!ev.endDate) {
        upcoming.push({ title: ev.title, date: d, dateStr: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }), color: evColor, isRange: false });
      } else {
        const end = parseLocalDate(ev.endDate);
        const startStr = parseLocalDate(ev.startDate || key).toLocaleDateString('de-DE',{day:'numeric',month:'short'});
        const endStr   = end.toLocaleDateString('de-DE', {day:'numeric', month:'short'});
        upcoming.push({ title: ev.title, date: d, dateStr: `${startStr} – ${endStr}`, color: evColor, isRange: true });
      }
    });
    // Wiederkehrende Vorkommen an diesem Tag
    if (typeof getSeriesOccurrencesInRange === 'function') {
      getSeriesOccurrencesInRange(d, d).forEach(({ event: ev }) => {
        if (seenIds.has(ev.id)) return;
        seenIds.add(ev.id);
        upcoming.push({ title: '↻ ' + ev.title, date: d, dateStr: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }), color: ev.color || DEFAULT_EVENT_COLOR, isRange: false });
      });
    }
  }

  if (upcoming.length > 0) {
    upcomingHtml = `<div id="mini-cal-events">${
      upcoming.slice(0,5).map(e =>
        `<div class="mini-cal-event-row" data-date="${dateKey(e.date)}" style="cursor:pointer;">
          <span class="mini-cal-event-dot${e.isRange ? ' range-ev' : ''}" style="background:${e.color}"></span>
          <span class="mini-cal-event-title">${e.title}</span>
          <span class="mini-cal-event-date">${e.dateStr}</span>
        </div>`
      ).join('')
    }</div>`;
  }

  return `
    <div class="mini-cal-header">
      <span class="mini-cal-title">${monthNames[month]} ${year}</span>
      <div class="mini-cal-nav">
        <button class="mini-cal-nav-btn" id="mini-cal-prev">&#8249;</button>
        <button class="mini-cal-nav-btn" id="mini-cal-next">&#8250;</button>
        <button class="mini-cal-nav-btn" id="mini-cal-add" title="Termin hinzufügen">+</button>
      </div>
    </div>
    <div class="mini-cal-grid">${cells}</div>
    ${upcomingHtml}`;
}

function renderMiniCal() {
  const el = document.getElementById('today-mini-cal');
  if (!el) return;
  el.innerHTML = buildMiniCal(miniCalDate);
  document.getElementById('mini-cal-prev')?.addEventListener('click', () => {
    miniCalDate = new Date(miniCalDate.getFullYear(), miniCalDate.getMonth()-1, 1);
    renderMiniCal();
  });
  document.getElementById('mini-cal-next')?.addEventListener('click', () => {
    miniCalDate = new Date(miniCalDate.getFullYear(), miniCalDate.getMonth()+1, 1);
    renderMiniCal();
  });
  // + button: create new event for today
  document.getElementById('mini-cal-add')?.addEventListener('click', () => {
    const today = new Date();
    openEventModal(dateKey(today), today);
  });
  // Clickable day cells
  el.querySelectorAll('.mini-cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      const key = cell.dataset.date;
      const date = parseLocalDate(key);
      openCalDayModal(key, date);
    });
  });
  // Clickable upcoming event rows
  el.querySelectorAll('.mini-cal-event-row[data-date]').forEach(row => {
    row.addEventListener('click', () => {
      const key = row.dataset.date;
      const date = parseLocalDate(key);
      openCalDayModal(key, date);
    });
  });
}

// =========================
// PROGRESS BAR (Tagesfortschritt durch Blöcke)
// =========================

function renderBlocksProgress() {
  const bar   = document.getElementById('blocks-progress-bar');
  const label = document.getElementById('blocks-progress-label');
  if (!bar || !blocks.length) return;

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const dayStart = blocks[0]?.start || '07:00';
  const dayEnd   = blocks[blocks.length-1]?.end || '17:00';

  const toMins = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  const startM = toMins(dayStart);
  const endM   = toMins(dayEnd);
  const nowM   = toMins(hhmm);

  if (nowM <= startM) {
    bar.style.setProperty('--progress', '0%');
    label.textContent = '';
    return;
  }
  if (nowM >= endM) {
    bar.style.setProperty('--progress', '100%');
    label.textContent = 'Schultag beendet';
    return;
  }

  const pct = Math.round((nowM - startM) / (endM - startM) * 100);
  bar.style.setProperty('--progress', pct + '%');

  const remaining = endM - nowM;
  const rh = Math.floor(remaining / 60);
  const rm = remaining % 60;
  label.textContent = rh > 0
    ? `noch ${rh}h ${rm}min`
    : `noch ${rm}min`;
}

// =========================
// BLOCKS
// =========================

function saveBlocks() { DB.set('blocks', blocks); }

let blocksActiveScrolledOnce = false;
function renderBlocks() {
  const row = document.getElementById('blocks-row');
  row.innerHTML = '';
  const activeBlock = getCurrentBlock();
  blocks.forEach(block => {
    const isActive = activeBlock && activeBlock.id === block.id && isToday(state.currentDate);
    const slot = document.createElement('div');
    slot.className = 'block-slot' + (block.free ? ' free' : '') + (isActive ? ' active-block' : '');
    const time  = document.createElement('div'); time.className = 'block-time'; time.textContent = `${block.start} – ${block.end}`;
    const label = document.createElement('div'); label.className = 'block-label';

    if (isActive) {
      const t = document.createElement('span'); t.className = 'active-tag'; t.textContent = 'JETZT';
      label.appendChild(t);
    }
    const nameSpan = document.createElement('span'); nameSpan.textContent = block.label;
    label.appendChild(nameSpan);

    if (block.free) { const t = document.createElement('span'); t.className = 'free-tag'; t.textContent = 'frei'; label.appendChild(t); }

    const ul = document.createElement('ul'); ul.className = 'block-tasks'; ul.id = `block-${block.id}`;
    slot.append(time, label, ul);
    row.appendChild(slot);
  });

  const dayTasks = getTasksForBlockView();
  dayTasks.forEach(task => {
    // Support both legacy single block (task.block) and new multi-block (task.blocks)
    const blockIds = Array.isArray(task.blocks) ? task.blocks
                   : (task.block != null ? [task.block] : []);
    const status = taskStatusOf(task);
    blockIds.forEach(bid => {
      const ul = document.getElementById(`block-${bid}`); if (!ul) return;
      const li = document.createElement('li');
      li.className = 'block-task-status-' + status + (status === 'completed' ? ' block-task-done' : '');
      li.textContent = `${TASK_STATUS[status].icon} ${task.title}`;
      ul.appendChild(li);
    });
  });

  // Mobile: aktueller Block ist horizontal scrollbar (scroll-snap, siehe
  // today.css) — beim allerersten Rendern automatisch zum aktiven Block
  // scrollen, statt ihn hinter vorherigen Karten zu verstecken. Nur einmal
  // pro Seitenaufruf, damit spätere renderBlocks()-Aufrufe (z.B. nach dem
  // Bearbeiten einer Aufgabe) die Scrollposition des Nutzers nicht kappen.
  if (!blocksActiveScrolledOnce && mehrPhoneQuery.matches) {
    blocksActiveScrolledOnce = true;
    row.querySelector('.block-slot.active-block')?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
  }

  renderBlocksProgress();
}

// =========================
// TASKS
// =========================

function saveTasks() { DB.set('tasks', tasks); }

// =========================
// STATUS-DROPDOWN — schwebendes Menü, an <body> angehängt statt am Task-Item.
// #panel-tasks (.panel) hat overflow:hidden für die abgerundeten Ecken; ein
// Dropdown als Kind des Task-Items würde dort am unteren Panelrand abgeschnitten.
// Ein einzelnes, wiederverwendetes Element wird deshalb per getBoundingClientRect
// frei über dem jeweiligen Status-Button positioniert (fixed).
// =========================
let taskStatusDropdownEl = null;
function getTaskStatusDropdownEl() {
  if (!taskStatusDropdownEl) {
    taskStatusDropdownEl = document.createElement('div');
    taskStatusDropdownEl.className = 'task-status-dropdown';
    document.body.appendChild(taskStatusDropdownEl);
  }
  return taskStatusDropdownEl;
}
function closeTaskStatusDropdowns() {
  if (taskStatusDropdownEl) taskStatusDropdownEl.classList.remove('open');
}
document.addEventListener('click', closeTaskStatusDropdowns);
document.addEventListener('scroll', closeTaskStatusDropdowns, true);
window.addEventListener('resize', closeTaskStatusDropdowns);

function openTaskStatusDropdown(btn, task) {
  const dropdown = getTaskStatusDropdownEl();
  dropdown.innerHTML = '';
  const currentStatus = taskStatusOf(task);
  TASK_STATUS_ORDER.forEach(s => {
    const sMeta = TASK_STATUS[s];
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'task-status-option' + (s === currentStatus ? ' active' : '');
    opt.innerHTML = `<span class="task-status-option-icon" style="color:var(${sMeta.dotVar})">${sMeta.icon}</span>${sMeta.label}`;
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      setTaskStatus(task, s);
      closeTaskStatusDropdowns();
      saveTasks(); renderTasks(); renderBlocks();
    });
    dropdown.appendChild(opt);
  });
  const rect = btn.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + 6) + 'px';
  dropdown.style.left = rect.left + 'px';
  dropdown.dataset.forTask = task.id;
  dropdown.classList.add('open');
}

function renderTasks() {
  const list  = document.getElementById('task-list');
  const empty = document.getElementById('task-empty');
  const count = document.getElementById('task-count');
  const stats = document.getElementById('task-stats');
  list.innerHTML = '';

  const tileTasks  = getTasksForTile();
  // "Offen" umfasst hier weiterhin offen + in Bearbeitung — bestehende Sortierung/
  // Aufteilung (offen oben, Erledigt-Trenner unten) bleibt unverändert, nur die
  // Statusanzeige je Aufgabe kommt neu dazu (siehe buildTaskItem).
  const openTasks  = tileTasks.filter(t => !isTaskCompleted(t)).sort((a,b) => a.priority - b.priority || a.title.localeCompare(b.title));
  const doneTasks  = tileTasks.filter(t =>  isTaskCompleted(t)).sort((a,b) => (b.completedAt||0) - (a.completedAt||0));

  count.textContent = openTasks.length || '';

  const completedCount = tileTasks.filter(t => taskStatusOf(t) === 'completed').length;
  const progressCount  = tileTasks.filter(t => taskStatusOf(t) === 'in_progress').length;
  const openCount       = tileTasks.length - completedCount - progressCount;

  if (stats) {
    if (tileTasks.length === 0) {
      stats.classList.add('hidden'); stats.innerHTML = '';
    } else {
      const completedPct   = Math.round((completedCount / tileTasks.length) * 100);
      const progressPct    = Math.round((progressCount  / tileTasks.length) * 100);
      stats.classList.remove('hidden');
      stats.innerHTML = `
        <span class="task-stat"><span class="task-stat-dot" style="background:var(${TASK_STATUS.completed.dotVar})"></span>${completedCount} abgeschlossen</span>
        <span class="task-stat"><span class="task-stat-dot" style="background:var(${TASK_STATUS.in_progress.dotVar})"></span>${progressCount} in Bearbeitung</span>
        <span class="task-stat"><span class="task-stat-dot" style="background:var(${TASK_STATUS.open.dotVar})"></span>${openCount} offen</span>
        <span class="task-stat-pct">${completedPct}% abgeschlossen · ${progressPct}% aktiv</span>
      `;
    }
  }

  renderTasksMobileTile({ progress: progressCount, planned: openCount, completed: completedCount }, tileTasks.length);
  renderTasksMobileModal(tileTasks);

  if (tileTasks.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  openTasks.forEach(task => list.appendChild(buildTaskItem(task)));

  if (doneTasks.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'task-done-divider';
    divider.textContent = 'Erledigt';
    list.appendChild(divider);
    doneTasks.forEach(task => list.appendChild(buildTaskItem(task)));
  }
}

// =========================
// AUFGABEN — kompakte Kachel (nur Mobile)
// Ersetzt die volle Aufgabenliste in der mobilen Ansicht durch eine reine
// Zähler-Übersicht; Klick auf die Kachel öffnet das eigenständige
// Mobile-Aufgaben-Modal (siehe renderTasksMobileModal() unten).
// =========================
function renderTasksMobileTile(counts, total) {
  const totalEl = document.getElementById('today-tasks-tile-total');
  const statsEl = document.getElementById('today-tasks-tile-stats');
  if (!statsEl) return;
  if (totalEl) totalEl.textContent = total || '';
  statsEl.innerHTML = `
    <div class="ttt-stat"><span class="ttt-num" style="color:var(${TASK_STATUS.in_progress.dotVar})">${counts.progress}</span><span class="ttt-label">in Bearbeitung</span></div>
    <div class="ttt-stat"><span class="ttt-num" style="color:var(--text-2)">${counts.planned}</span><span class="ttt-label">geplant</span></div>
    <div class="ttt-stat"><span class="ttt-num" style="color:var(${TASK_STATUS.completed.dotVar})">${counts.completed}</span><span class="ttt-label">abgeschlossen</span></div>
  `;
}

const tasksModal = wireModal('tasks-modal-overlay', { closeIds: ['tasks-modal-close-btn'] });
document.getElementById('today-tasks-tile')?.addEventListener('click', () => tasksModal.open());
document.getElementById('today-tasks-tile')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tasksModal.open(); }
});

// Statuskontrolle je Aufgabe: Klick öffnet ein kleines Dropdown mit allen drei
// Stufen (offen/in Bearbeitung/abgeschlossen), sodass der Status in eine beliebige
// Richtung geändert werden kann — auch rückwärts, für Korrekturen.
function buildTaskStatusControl(task) {
  const status = taskStatusOf(task);
  const meta   = TASK_STATUS[status];

  const wrap = document.createElement('div'); wrap.className = 'task-status-wrap';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'task-status-btn';
  btn.title = `${meta.label} — Status ändern`;
  btn.textContent = meta.icon;
  btn.style.color = `var(${meta.dotVar})`;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpenForThis = taskStatusDropdownEl
      && taskStatusDropdownEl.classList.contains('open')
      && taskStatusDropdownEl.dataset.forTask === task.id;
    closeTaskStatusDropdowns();
    if (!isOpenForThis) openTaskStatusDropdown(btn, task);
  });

  wrap.appendChild(btn);
  return wrap;
}

function buildTaskItem(task) {
  const status = taskStatusOf(task);
  const li = document.createElement('li');
  li.className = 'task-item task-status-' + status + (status === 'completed' ? ' done' : '');
  const statusCtrl = buildTaskStatusControl(task);
  const dot   = document.createElement('div'); dot.className = 'prio-dot'; dot.dataset.prio = task.priority;
  const info  = document.createElement('div'); info.className = 'task-info';
  const title = document.createElement('span'); title.className = 'task-title'; title.textContent = task.title;
  title.addEventListener('click', () => openTaskModal(task)); info.appendChild(title);
  if (task.notes) { const sub = document.createElement('span'); sub.className = 'task-sub'; sub.textContent = task.notes; info.appendChild(sub); }
  // Build badge for all assigned blocks (legacy: task.block, new: task.blocks)
  const _blockIds = Array.isArray(task.blocks) ? task.blocks
                  : (task.block != null ? [task.block] : []);
  const badge = document.createElement('span'); badge.className = 'task-block-badge';
  badge.textContent = _blockIds.length ? _blockIds.map(b => `B${b}`).join(' ') : '–';
  const del   = document.createElement('button'); del.className = 'task-delete'; del.textContent = '✕';
  del.addEventListener('click', () => { tasks = tasks.filter(t => t.id !== task.id); saveTasks(); renderTasks(); renderBlocks(); });
  li.append(statusCtrl, dot, info, badge, del);
  return li;
}

// =========================
// AUFGABEN-MODAL (Mobile) — eigenständige kompakte Ansicht statt einer
// verkleinerten Desktop-Karte: einfacher Header + nach Status gruppierte
// Liste, damit "in Bearbeitung" auf einen Blick auffindbar ist, statt in
// derselben Statistikzeile wie am Desktop unterzugehen.
// =========================
const TASKS_MOBILE_GROUPS = [
  { status: 'in_progress', label: 'In Bearbeitung' },
  { status: 'open',        label: 'Geplant / Offen' },
  { status: 'completed',   label: 'Abgeschlossen' },
];

function buildMobileTaskItem(task) {
  const status = taskStatusOf(task);
  const li = document.createElement('li');
  li.className = 'tasks-mobile-item task-status-' + status;

  const statusCtrl = buildTaskStatusControl(task);

  const info  = document.createElement('div'); info.className = 'tasks-mobile-item-info';
  const title = document.createElement('span'); title.className = 'tasks-mobile-item-title'; title.textContent = task.title;
  info.appendChild(title);

  const _blockIds = Array.isArray(task.blocks) ? task.blocks : (task.block != null ? [task.block] : []);
  if (_blockIds.length) {
    const badge = document.createElement('span'); badge.className = 'tasks-mobile-item-badge';
    badge.textContent = _blockIds.map(b => `B${b}`).join(' ');
    info.appendChild(badge);
  }
  info.addEventListener('click', () => openTaskModal(task));

  const del = document.createElement('button');
  del.type = 'button'; del.className = 'tasks-mobile-item-delete'; del.setAttribute('aria-label', 'Aufgabe löschen'); del.textContent = '✕';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    tasks = tasks.filter(t => t.id !== task.id);
    saveTasks(); renderTasks(); renderBlocks();
  });

  li.append(statusCtrl, info, del);
  return li;
}

function renderTasksMobileModal(tileTasks) {
  const list  = document.getElementById('tasks-mobile-list');
  const empty = document.getElementById('tasks-mobile-empty');
  if (!list) return;
  list.innerHTML = '';

  if (tileTasks.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  TASKS_MOBILE_GROUPS.forEach(group => {
    const groupTasks = tileTasks
      .filter(t => taskStatusOf(t) === group.status)
      .sort((a, b) => group.status === 'completed'
        ? (b.completedAt || 0) - (a.completedAt || 0)
        : a.priority - b.priority || a.title.localeCompare(b.title));
    if (!groupTasks.length) return;

    const header = document.createElement('div');
    header.className = 'tasks-mobile-group-label';
    header.textContent = `${group.label} · ${groupTasks.length}`;
    list.appendChild(header);
    groupTasks.forEach(task => list.appendChild(buildMobileTaskItem(task)));
  });
}

document.getElementById('mobile-add-task-btn')?.addEventListener('click', () => openTaskModal());

// =========================
// TASK MODAL
// =========================

const taskModal = wireModal('modal-overlay', {
  closeIds: ['modal-close', 'modal-cancel'],
  inputId: 'modal-task-input',
  saveId: 'modal-save',
  onClose: () => { state.editingTask = null; },
});

function openTaskModal(existingTask = null) {
  state.editingTask = existingTask;
  state.selectedPriority = existingTask ? existingTask.priority : 2;
  state.selectedStatus = existingTask ? taskStatusOf(existingTask) : 'open';
  document.getElementById('modal-title').textContent = existingTask ? 'Aufgabe bearbeiten' : 'Neue Aufgabe';
  document.getElementById('modal-task-input').value = existingTask ? existingTask.title : '';
  document.getElementById('modal-task-notes').value = existingTask?.notes || '';
  // Determine pre-selected block IDs: migrate legacy task.block → task.blocks
  const _preSelected = existingTask
    ? (Array.isArray(existingTask.blocks) ? existingTask.blocks
       : existingTask.block != null ? [existingTask.block] : [])
    : [2]; // default: Block 2

  const chipsWrap = document.getElementById('modal-block-chips');
  chipsWrap.innerHTML = '';
  blocks.forEach(b => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'task-chip' + (_preSelected.includes(b.id) ? ' active' : '');
    chip.dataset.blockId = b.id;
    chip.textContent = `Block ${b.id}`;
    chip.title = `${b.label} (${b.start}–${b.end})`;
    chip.addEventListener('click', () => chip.classList.toggle('active'));
    chipsWrap.appendChild(chip);
  });
  document.querySelectorAll('.prio-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.prio) === state.selectedPriority));
  document.querySelectorAll('#status-picker .status-btn').forEach(b => b.classList.toggle('active', b.dataset.status === state.selectedStatus));
  taskModal.open();
  setTimeout(() => document.getElementById('modal-task-input').focus(), 50);
}
function closeTaskModal() { taskModal.close(); }

document.getElementById('add-task-btn').addEventListener('click', () => openTaskModal());

document.querySelectorAll('.prio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.selectedPriority = Number(btn.dataset.prio);
    document.querySelectorAll('.prio-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});
document.querySelectorAll('#status-picker .status-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.selectedStatus = btn.dataset.status;
    document.querySelectorAll('#status-picker .status-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});
document.getElementById('modal-save').addEventListener('click', () => {
  const title = document.getElementById('modal-task-input').value.trim(); if (!title) return;
  // Collect selected block IDs from chips
  const selectedBlocks = [...document.querySelectorAll('#modal-block-chips .task-chip.active')]
    .map(c => Number(c.dataset.blockId));
  const notesTxt = document.getElementById('modal-task-notes').value.trim();
  if (state.editingTask) {
    Object.assign(state.editingTask, { title, blocks: selectedBlocks, priority: state.selectedPriority, notes: notesTxt });
    setTaskStatus(state.editingTask, state.selectedStatus);
    // Remove legacy field to keep data clean
    delete state.editingTask.block;
  } else {
    const newTask = { id: crypto.randomUUID(), title, notes: notesTxt, priority: state.selectedPriority, blocks: selectedBlocks, createdAt: Date.now() };
    setTaskStatus(newTask, state.selectedStatus);
    tasks.push(newTask);
  }
  saveTasks(); closeTaskModal(); renderTasks(); renderBlocks();
});

// =========================
// QUICKNOTE
// =========================

const qn = document.getElementById('quicknote');
qn.value = quicknote;
let noteTimer;
qn.addEventListener('input', () => {
  quicknote = qn.value; DB.set('quicknote', quicknote);
  clearTimeout(noteTimer);
  const hint = document.getElementById('note-saved'); hint.classList.remove('show');
  noteTimer = setTimeout(() => hint.classList.add('show'), 800);
});

// =========================
// REFRESH (wird bei View-Wechsel aufgerufen)
// =========================

function refreshTodayTextareas() {
  quicknote = DB.get('quicknote', '');
  document.getElementById('quicknote').value = quicknote;
  renderMiniCal();
  renderTodayHeader();
  renderBlocksProgress();
}


// =========================
// THEME TOGGLE
// =========================

function updateThemeIcon() {
  const sunIcon  = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');
  if (!sunIcon || !moonIcon) return;
  sunIcon.style.display  = darkMode ? 'none'  : 'block';
  moonIcon.style.display = darkMode ? 'block' : 'none';
}

document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
  setDarkMode(!darkMode);
});

// =========================
// INIT SIDEBAR + GREETING
// =========================
renderTodayHeader();
renderWeather();
startSidebarClock();
renderMiniCal();
updateThemeIcon();
