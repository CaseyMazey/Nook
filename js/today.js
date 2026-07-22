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
// WEATHER — OpenWeatherMap API
// Settings: GPS oder manuelle Stadt
// =========================

let weatherSettings = DB.get('weatherSettings', { mode: 'manual', city: 'Cologne' });

const OWM_ICON_MAP = {
  '01': '☀️', '02': '⛅', '03': '🌥️', '04': '☁️',
  '09': '🌧️', '10': '🌦️', '11': '⛈️', '13': '❄️', '50': '🌫️'
};

function owmIcon(iconCode) {
  return OWM_ICON_MAP[iconCode?.slice(0,2)] || '🌡️';
}

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

  // Cache: 30 Minuten — only use if svgCode present (invalidates old emoji cache)
  const saved = DB.get('weatherData', null);
  if (saved && saved.svgCode && Date.now() - saved.ts < 30*60*1000) {
    if (iconEl) iconEl.innerHTML = saved.svgCode;
    tempEl.textContent = saved.temp;
    descEl.textContent = saved.desc;
    return;
  }

  weatherSettings = DB.get('weatherSettings', { mode: 'manual', city: 'Cologne' });

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
    DB.set('weatherData', { ...data, ts: Date.now() });
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
      const days = Math.ceil((evDate - now) / 86400000);
      if (days >= 0) candidates.push({ id: ev.id, title: ev.title, daysLeft: days });
    });
  });
  const visible = candidates
    .filter(c => countdownVisible[c.id] === true)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Show/hide countdowns section
  const section = document.getElementById('sidebar-countdowns');
  if (section) section.style.display = visible.length > 0 ? 'block' : 'none';

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
// CLOCK WIDGET (Header — bleibt für settings.js Kompatibilität)
// =========================

let clockInterval = null;

function startClock() {
  stopClock();
  renderClock();
  clockInterval = setInterval(renderClock, 1000);
}

function stopClock() {
  if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
  const w = document.getElementById('clock-widget');
  if (w) { w.innerHTML = ''; w.style.display = 'none'; }
}

function renderClock() {
  const w = document.getElementById('clock-widget');
  if (!w) return;
  w.style.display = 'block';
  const now = new Date();
  if (clockType === 'digital') {
    w.innerHTML = '';
    w.className = 'clock-digital';
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    w.textContent = `${h}:${m}:${s}`;
  } else {
    w.className = 'clock-analog';
    w.innerHTML = buildAnalogSVG(now, 90);
  }
}

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
    <div class="clock-analog">${buildAnalogSVG(now, 72)}</div>
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

function stopSidebarClock() {
  if (sidebarClockInterval) { clearInterval(sidebarClockInterval); sidebarClockInterval = null; }
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

  if (typeof events !== 'undefined') {
    Object.entries(events).forEach(([key, dayEvs]) => {
      (dayEvs || []).forEach(ev => {
        if (!ev.endDate) {
          // Single-day
          const d = parseLocalDate(key);
          if (d.getFullYear() === year && d.getMonth() === month) eventDays.add(d.getDate());
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
    getSeriesOccurrencesInRange(gridStart, gridEnd).forEach(({ date: d }) => {
      if (d.getFullYear() === year && d.getMonth() === month) eventDays.add(d.getDate());
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

    cells += `<div class="${cls}" data-date="${key}" data-day="${d}"><span>${d}</span><span class="mini-cal-dot"></span></div>`;
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
      if (!ev.endDate) {
        upcoming.push({ title: ev.title, date: d, dateStr: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }), type: ev.countdown ? 'prio-1' : 'prio-ev', isRange: false });
      } else {
        const end = parseLocalDate(ev.endDate);
        const startStr = parseLocalDate(ev.startDate || key).toLocaleDateString('de-DE',{day:'numeric',month:'short'});
        const endStr   = end.toLocaleDateString('de-DE', {day:'numeric', month:'short'});
        upcoming.push({ title: ev.title, date: d, dateStr: `${startStr} – ${endStr}`, type: ev.countdown ? 'prio-1' : 'range-ev', isRange: true });
      }
    });
    // Wiederkehrende Vorkommen an diesem Tag
    if (typeof getSeriesOccurrencesInRange === 'function') {
      getSeriesOccurrencesInRange(d, d).forEach(({ event: ev }) => {
        if (seenIds.has(ev.id)) return;
        seenIds.add(ev.id);
        upcoming.push({ title: '↻ ' + ev.title, date: d, dateStr: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }), type: 'prio-ev', isRange: false });
      });
    }
  }

  if (upcoming.length > 0) {
    upcomingHtml = `<div id="mini-cal-events">${
      upcoming.slice(0,5).map(e =>
        `<div class="mini-cal-event-row" data-date="${dateKey(e.date)}" style="cursor:pointer;">
          <span class="mini-cal-event-dot ${e.type}"></span>
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
    blockIds.forEach(bid => {
      const ul = document.getElementById(`block-${bid}`); if (!ul) return;
      const li = document.createElement('li');
      li.className = task.done ? 'block-task-done' : '';
      li.textContent = task.title;
      ul.appendChild(li);
    });
  });

  renderBlocksProgress();
}

// =========================
// TASKS
// =========================

function saveTasks() { DB.set('tasks', tasks); }

function renderTasks() {
  const list  = document.getElementById('task-list');
  const empty = document.getElementById('task-empty');
  const count = document.getElementById('task-count');
  list.innerHTML = '';

  const tileTasks  = getTasksForTile();
  const openTasks  = tileTasks.filter(t => !t.done).sort((a,b) => a.priority - b.priority || a.title.localeCompare(b.title));
  const doneTasks  = tileTasks.filter(t =>  t.done).sort((a,b) => (b.completedAt||0) - (a.completedAt||0));

  count.textContent = openTasks.length || '';
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

function buildTaskItem(task) {
  const li = document.createElement('li'); li.className = 'task-item' + (task.done ? ' done' : '');
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = task.done;
  cb.addEventListener('change', () => {
    task.done = cb.checked; task.completedAt = cb.checked ? Date.now() : null;
    saveTasks(); renderTasks(); renderBlocks();
  });
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
  li.append(cb, dot, info, badge, del);
  return li;
}

// =========================
// TASK MODAL
// =========================

const taskOverlay = document.getElementById('modal-overlay');

function openTaskModal(existingTask = null) {
  state.editingTask = existingTask;
  state.selectedPriority = existingTask ? existingTask.priority : 2;
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
  taskOverlay.classList.remove('hidden');
  setTimeout(() => document.getElementById('modal-task-input').focus(), 50);
}
function closeTaskModal() { taskOverlay.classList.add('hidden'); state.editingTask = null; }

document.getElementById('add-task-btn').addEventListener('click', () => openTaskModal());
document.getElementById('modal-close').addEventListener('click', closeTaskModal);
document.getElementById('modal-cancel').addEventListener('click', closeTaskModal);
taskOverlay.addEventListener('click', e => { if (e.target === taskOverlay) closeTaskModal(); });

document.querySelectorAll('.prio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.selectedPriority = Number(btn.dataset.prio);
    document.querySelectorAll('.prio-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});
document.getElementById('modal-task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('modal-save').click();
  if (e.key === 'Escape') closeTaskModal();
});
document.getElementById('modal-save').addEventListener('click', () => {
  const title = document.getElementById('modal-task-input').value.trim(); if (!title) return;
  // Collect selected block IDs from chips
  const selectedBlocks = [...document.querySelectorAll('#modal-block-chips .task-chip.active')]
    .map(c => Number(c.dataset.blockId));
  const notesTxt = document.getElementById('modal-task-notes').value.trim();
  if (state.editingTask) {
    Object.assign(state.editingTask, { title, blocks: selectedBlocks, priority: state.selectedPriority, notes: notesTxt });
    // Remove legacy field to keep data clean
    delete state.editingTask.block;
  } else {
    tasks.push({ id: crypto.randomUUID(), title, notes: notesTxt, priority: state.selectedPriority, blocks: selectedBlocks, done: false, createdAt: Date.now(), completedAt: null });
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
// SCHREIBTISCH — einheitliches Karten-System
// 3 unabhängige Spalten (Masonry-Prinzip). Jede Karte kennt Spalte, Stil,
// Farbe und optionale feste Höhe (Resize-Handle, persistiert). Ersetzt die
// früheren Einzelsysteme (notes/customTiles/generalTodos/shoppingList/
// berichtsheft), die nur noch als einmalige Migrationsquelle dienen.
// =========================

const DESK_STYLE_DESC = {
  standard:  'Freies Textfeld, wie die Schnellnotiz.',
  pinned:    'Bleibt immer ganz oben in der Spalte.',
  important: 'Auffälliger, mit größerem Titel.',
  code:      'Für Code und Terminalbefehle.',
  checklist: 'Kästchen zum Abhaken, mit Fortschritt.',
  quote:     'Ein einzelner, groß gesetzter Satz.',
};

function saveDeskCards() { DB.set('deskCards', deskCards); }

// ---- Einmalige Migration der alten Einzelsysteme in deskCards ----
function migrateDeskCardsIfNeeded() {
  if (deskCards) return;
  const cards = [];
  let col = 0;
  const orderInCol = [0, 0, 0];
  const push = (partial) => {
    cards.push(Object.assign({
      id: crypto.randomUUID(), title: '', style: 'standard', color: HUB_PALETTE_HEX[0],
      column: col, order: orderInCol[col], height: null,
      content: '', items: [], hideCompleted: false, betrieb: '', schule: '',
    }, partial));
    orderInCol[col]++;
    col = (col + 1) % 3;
  };

  const toItems = arr => (arr || []).map(x => typeof x === 'string' ? { id: crypto.randomUUID(), text: x, done: false } : x);
  const oldDesigns = DB.get('tileDesigns', {});
  const oldColor = (id, fallback) => (oldDesigns[id] && oldDesigns[id].color) || fallback;

  push({ id: 'builtin-wichtiges',    title: 'Wichtiges',                 style: 'checklist',    items: toItems(notes['exam-notes']),      color: oldColor('builtin-wichtiges', '#A3B18A') });
  push({ id: 'builtin-todo',         title: 'To Do',                     style: 'checklist',    items: toItems(generalTodos),              color: oldColor('builtin-todo', '#EBE4D4') });
  push({ id: 'builtin-berichtsheft', title: 'Berichtsheft',              style: 'berichtsheft', betrieb: berichtsheft.betrieb || '', schule: berichtsheft.schule || '', color: oldColor('builtin-berichtsheft', '#C0AC99') });
  push({ id: 'builtin-fragen',       title: 'Fragen für den Unterricht', style: 'checklist',    items: toItems(notes['class-questions']), color: oldColor('builtin-fragen', '#A3B18A') });
  push({ id: 'builtin-shopping',     title: 'Einkaufsliste',             style: 'checklist',    items: toItems(shoppingList),              color: oldColor('builtin-shopping', '#EBE4D4') });
  push({ id: 'builtin-begriffe',     title: 'Begriffe & Definitionen',   style: 'checklist',    items: toItems(notes['terms']),            color: oldColor('builtin-begriffe', '#C0AC99') });

  (customTiles || []).forEach(tile => {
    push({
      id: tile.id, title: tile.title,
      style: tile.type === 'list' ? 'checklist' : 'standard',
      content: tile.content || '', items: toItems(tile.items),
      color: tile.color || oldColor(tile.id, HUB_PALETTE_HEX[0]),
    });
  });

  deskCards = cards;
  saveDeskCards();
}
migrateDeskCardsIfNeeded();

// ---- Kontrastfarbe für Titel/Text auf beliebiger Kartenfarbe ----
function deskTextColor(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return null;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#3D3626' : '#F5F1E6';
}

// ---- Sortierung: Angepinnt zuerst, sonst nach gespeicherter Reihenfolge ----
function sortedDeskCards(col) {
  return deskCards
    .filter(c => c.column === col)
    .sort((a, b) => {
      const pa = a.style === 'pinned' ? 0 : 1, pb = b.style === 'pinned' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (a.order || 0) - (b.order || 0);
    });
}

function renderDesk() {
  for (let i = 0; i < 3; i++) {
    const colEl = document.getElementById('desk-col-' + i);
    if (!colEl) continue;
    colEl.innerHTML = '';
    sortedDeskCards(i).forEach(card => colEl.appendChild(buildDeskCardEl(card)));
  }
}

const DESK_STYLE_ICON = { pinned: '📌 ', important: '⭐ ' };

function buildDeskCardEl(card) {
  const el = document.createElement('div');
  el.className = `panel today-tile desk-card desk-card--${card.style}`;
  el.dataset.id = card.id;
  el.style.background = card.color || '';
  const fg = deskTextColor(card.color);
  if (fg) el.style.setProperty('--card-fg', fg);
  if (card.height) el.style.height = card.height + 'px';

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header desk-card-header';
  const title = document.createElement('span');
  title.className = 'desk-card-title';
  title.textContent = (DESK_STYLE_ICON[card.style] || '') + card.title;
  title.title = card.title;
  const actions = document.createElement('div');
  actions.className = 'desk-card-actions';

  if (card.style === 'checklist') {
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'icon-btn';
    eyeBtn.title = card.hideCompleted ? 'Erledigte einblenden' : 'Erledigte ausblenden';
    eyeBtn.textContent = card.hideCompleted ? '🙈' : '👁';
    eyeBtn.addEventListener('click', () => { card.hideCompleted = !card.hideCompleted; saveDeskCards(); renderDesk(); });
    actions.appendChild(eyeBtn);

    const addBtn = document.createElement('button');
    addBtn.className = 'icon-btn'; addBtn.textContent = '+'; addBtn.title = 'Eintrag hinzufügen';
    addBtn.addEventListener('click', () => openAddItemModal(card.id));
    actions.appendChild(addBtn);
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'desk-edit-btn'; editBtn.title = 'Karte bearbeiten'; editBtn.innerHTML = '✎';
  editBtn.addEventListener('click', () => openDeskCardModal(card.id));
  actions.appendChild(editBtn);

  header.append(title, actions);
  el.appendChild(header);

  // Body (stilabhängig)
  const body = document.createElement('div');
  body.className = 'desk-card-body';
  buildDeskCardBody(body, card);
  el.appendChild(body);

  // Resize-Handle — Kartenhöhe frei ziehbar, wird persistiert
  const handle = document.createElement('div');
  handle.className = 'desk-resize-handle';
  handle.title = 'Höhe ziehen';
  wireDeskResize(handle, card, el);
  el.appendChild(handle);

  return el;
}

function buildDeskCardBody(body, card) {
  switch (card.style) {
    case 'checklist': {
      const ul = document.createElement('ul'); ul.className = 'checklist';
      const items = card.items || [];
      const visible = items.filter(it => !(card.hideCompleted && it.done));
      visible.forEach(item => {
        const li = document.createElement('li'); li.className = 'checklist-item' + (item.done ? ' done' : '');
        const cbWrap = makePaperCbElement(item.done, card.color, () => {
          item.done = !item.done; saveDeskCards(); renderDesk();
        });
        const span = document.createElement('span'); span.textContent = item.text;
        const del = document.createElement('button'); del.className = 'note-del'; del.textContent = '✕';
        del.addEventListener('click', () => { card.items = card.items.filter(i => i !== item); saveDeskCards(); renderDesk(); });
        li.append(cbWrap, span, del); ul.appendChild(li);
      });
      if (visible.length === 0) {
        const empty = document.createElement('div'); empty.className = 'empty-state';
        empty.textContent = items.length ? 'Alle Punkte erledigt.' : 'Noch keine Einträge.';
        ul.appendChild(empty);
      }
      body.appendChild(ul);
      break;
    }
    case 'code': {
      const ta = document.createElement('textarea');
      ta.className = 'desk-textarea'; ta.value = card.content || ''; ta.placeholder = 'Code eingeben...'; ta.spellcheck = false;
      ta.addEventListener('input', () => { card.content = ta.value; saveDeskCards(); });
      const copyBtn = document.createElement('button');
      copyBtn.className = 'desk-code-copy'; copyBtn.type = 'button'; copyBtn.title = 'Kopieren';
      const iconCopy = '<svg viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 11V3a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      const iconDone = '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      copyBtn.innerHTML = iconCopy;
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(ta.value).then(() => {
          copyBtn.innerHTML = iconDone;
          setTimeout(() => { copyBtn.innerHTML = iconCopy; }, 1500);
        });
      });
      body.append(ta, copyBtn);
      break;
    }
    case 'berichtsheft': {
      const wrap = document.createElement('div'); wrap.className = 'desk-berichtsheft-grid';
      const mk = (label, field, placeholder) => {
        const colEl = document.createElement('div'); colEl.className = 'desk-bericht-col';
        const lab = document.createElement('div'); lab.className = 'desk-bericht-col-label'; lab.textContent = label;
        const ta = document.createElement('textarea'); ta.value = card[field] || ''; ta.placeholder = placeholder;
        let timer;
        ta.addEventListener('input', () => {
          card[field] = ta.value;
          clearTimeout(timer);
          timer = setTimeout(saveDeskCards, 400);
        });
        colEl.append(lab, ta);
        return colEl;
      };
      wrap.append(
        mk('Betrieb', 'betrieb', 'Was habe ich heute im Betrieb gemacht?'),
        mk('Schule', 'schule', 'Was haben wir heute in der Schule behandelt?')
      );
      body.appendChild(wrap);
      break;
    }
    default: { // standard, pinned, important, quote — alle ein freies Textfeld
      const ta = document.createElement('textarea');
      ta.className = 'desk-textarea'; ta.value = card.content || ''; ta.placeholder = 'Notizen...';
      ta.addEventListener('input', () => { card.content = ta.value; saveDeskCards(); });
      body.appendChild(ta);
    }
  }
}

// ---- Kartenhöhe per Resize-Handle ziehen — wird in deskCards.height persistiert ----
function wireDeskResize(handle, card, cardEl) {
  let startY = 0, startH = 0;
  function move(e) {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    cardEl.style.height = Math.max(90, startH + (y - startY)) + 'px';
  }
  function up() {
    handle.classList.remove('resizing');
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', up);
    const h = parseInt(cardEl.style.height, 10);
    if (h && h !== card.height) { card.height = h; saveDeskCards(); }
  }
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    handle.classList.add('resizing');
    startY = e.clientY; startH = cardEl.getBoundingClientRect().height;
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
  handle.addEventListener('touchstart', e => {
    handle.classList.add('resizing');
    startY = e.touches[0].clientY; startH = cardEl.getBoundingClientRect().height;
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  }, { passive: true });
}

// ---- Eintrag zu einer Checklisten-Karte hinzufügen (nutzt das bestehende Notiz-Modal) ----
let deskAddItemCardId = null;
function openAddItemModal(cardId) {
  deskAddItemCardId = cardId;
  const card = deskCards.find(c => c.id === cardId); if (!card) return;
  document.getElementById('note-modal-title').textContent = `${card.title} — Eintrag hinzufügen`;
  document.getElementById('note-modal-input').value = '';
  document.getElementById('note-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('note-modal-input').focus(), 50);
}
function closeAddItemModal() { document.getElementById('note-modal-overlay').classList.add('hidden'); deskAddItemCardId = null; }

document.getElementById('note-modal-close').addEventListener('click', closeAddItemModal);
document.getElementById('note-modal-cancel').addEventListener('click', closeAddItemModal);
document.getElementById('note-modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('note-modal-overlay')) closeAddItemModal(); });
document.getElementById('note-modal-save').addEventListener('click', () => {
  const text = document.getElementById('note-modal-input').value.trim();
  if (!text || !deskAddItemCardId) return;
  const card = deskCards.find(c => c.id === deskAddItemCardId); if (!card) return;
  if (!card.items) card.items = [];
  card.items.push({ id: crypto.randomUUID(), text, done: false });
  saveDeskCards(); renderDesk(); closeAddItemModal();
});

// ---- Karte erstellen / bearbeiten ----
let editingDeskCardId = null;
let selectedDeskStyle = 'standard';
let selectedDeskColumn = 0;
const deskColorWidget = initColorPickerWidget(
  { pickerId: 'tile-modal-color', previewId: 'tile-modal-color-preview', addBtnId: 'tile-modal-color-add-btn', libraryId: 'tile-modal-color-library' },
  { initial: HUB_PALETTE_HEX[0] }
);

function openDeskCardModal(cardId) {
  editingDeskCardId = cardId || null;
  const card = editingDeskCardId ? deskCards.find(c => c.id === editingDeskCardId) : null;

  document.getElementById('tile-modal-head-title').textContent = card ? 'Karte bearbeiten' : 'Neue Karte';
  document.getElementById('tile-modal-title').value = card ? card.title : '';
  document.getElementById('tile-modal-save').textContent = card ? 'Speichern' : 'Erstellen';
  document.getElementById('tile-modal-delete-btn').style.display = card ? 'inline-flex' : 'none';

  selectedDeskStyle = card ? card.style : 'standard';
  selectedDeskColumn = card ? card.column : 0;

  // Berichtsheft hat einen festen Aufbau — kein Stil-Wechsel möglich
  const isBericht = !!card && card.style === 'berichtsheft';
  const picker = document.getElementById('tile-type-picker');
  const desc = document.getElementById('tile-type-desc');
  picker.style.display = isBericht ? 'none' : 'grid';
  desc.style.display = isBericht ? 'none' : 'block';
  if (!isBericht) {
    document.querySelectorAll('.tile-type-btn').forEach(b => b.classList.toggle('active', b.dataset.style === selectedDeskStyle));
    desc.textContent = DESK_STYLE_DESC[selectedDeskStyle] || '';
  }

  document.querySelectorAll('#tile-modal-column-picker .toggle-select-btn')
    .forEach(b => b.classList.toggle('active', Number(b.dataset.col) === selectedDeskColumn));

  deskColorWidget.setValue(card ? (card.color || HUB_PALETTE_HEX[0]) : HUB_PALETTE_HEX[0]);

  document.getElementById('tile-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('tile-modal-title').focus(), 50);
}
function closeDeskCardModal() { document.getElementById('tile-modal-overlay').classList.add('hidden'); editingDeskCardId = null; }

document.getElementById('add-tile-btn').addEventListener('click', () => openDeskCardModal(null));
document.getElementById('tile-modal-close').addEventListener('click', closeDeskCardModal);
document.getElementById('tile-modal-cancel').addEventListener('click', closeDeskCardModal);
document.getElementById('tile-modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('tile-modal-overlay')) closeDeskCardModal(); });

document.querySelectorAll('.tile-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedDeskStyle = btn.dataset.style;
    document.querySelectorAll('.tile-type-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('tile-type-desc').textContent = DESK_STYLE_DESC[selectedDeskStyle] || '';
  });
});
document.querySelectorAll('#tile-modal-column-picker .toggle-select-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedDeskColumn = Number(btn.dataset.col);
    document.querySelectorAll('#tile-modal-column-picker .toggle-select-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});

function nextDeskOrder(col) {
  const inCol = deskCards.filter(c => c.column === col);
  return inCol.length ? Math.max(...inCol.map(c => c.order || 0)) + 1 : 0;
}

document.getElementById('tile-modal-save').addEventListener('click', () => {
  const title = document.getElementById('tile-modal-title').value.trim();
  if (!title) return;
  const color = deskColorWidget.getValue();

  if (editingDeskCardId) {
    const card = deskCards.find(c => c.id === editingDeskCardId); if (!card) return;
    card.title = title;
    card.color = color;
    if (card.style !== 'berichtsheft') card.style = selectedDeskStyle;
    card.column = selectedDeskColumn;
  } else {
    deskCards.push({
      id: crypto.randomUUID(), title, style: selectedDeskStyle, color,
      column: selectedDeskColumn, order: nextDeskOrder(selectedDeskColumn), height: null,
      content: '', items: [], hideCompleted: false, betrieb: '', schule: '',
    });
  }
  saveDeskCards();
  closeDeskCardModal();
  renderDesk();
});

document.getElementById('tile-modal-delete-btn').addEventListener('click', () => {
  if (!editingDeskCardId) return;
  if (!confirm('Diese Karte wirklich löschen?')) return;
  deskCards = deskCards.filter(c => c.id !== editingDeskCardId);
  saveDeskCards();
  closeDeskCardModal();
  renderDesk();
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
// PAPER CHECKBOX — Bullet-Journal-Stil
// Ersetzt native <input type="checkbox"> durch kreisförmige Papier-Marker
// =========================

// Berechnet Kreis-Akzentfarbe passend zur Kachelfarbe
function paperCbColor(bg) {
  if (!bg || bg === '#EBE4D4') return { ring: 'rgba(120,100,60,0.30)', check: 'rgba(80,65,35,0.70)', fill: 'rgba(120,100,60,0.12)' };
  if (bg === '#A3B18A')        return { ring: 'rgba(50,75,35,0.32)',  check: 'rgba(45,68,28,0.75)', fill: 'rgba(50,75,35,0.14)' };
  if (bg === '#C0AC99')        return { ring: 'rgba(90,65,40,0.30)',  check: 'rgba(75,50,30,0.72)', fill: 'rgba(90,65,40,0.12)' };
  // Fallback für andere Farben: nimm text-3-ähnliche Töne
  return { ring: 'rgba(100,85,65,0.30)', check: 'rgba(70,55,40,0.72)', fill: 'rgba(100,85,65,0.12)' };
}

function buildPaperCb(done, bg) {
  const c = paperCbColor(bg);
  if (done) {
    // Gefüllter Kreis mit Haken
    return `<span class="paper-cb paper-cb--done" aria-label="erledigt">
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8.5" cy="8.5" r="7.5" fill="${c.fill}" stroke="${c.ring}" stroke-width="1.2"/>
        <polyline points="4.5,8.5 7.5,11.5 12.5,6" stroke="${c.check}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
  } else {
    // Leerer Kreis
    return `<span class="paper-cb" aria-label="offen">
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8.5" cy="8.5" r="7.5" fill="none" stroke="${c.ring}" stroke-width="1.2"/>
      </svg>
    </span>`;
  }
}

function makePaperCbElement(done, bg, onToggle) {
  const wrap = document.createElement('span');
  wrap.className = 'paper-cb-wrap';
  wrap.innerHTML = buildPaperCb(done, bg);
  wrap.addEventListener('click', (e) => { e.stopPropagation(); onToggle(); });
  return wrap;
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
  darkMode = !darkMode;
  DB.set('darkMode', darkMode);
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  updateThemeIcon();
});

// =========================
// INIT SIDEBAR + GREETING
// =========================
renderTodayHeader();
renderWeather();
startSidebarClock();
renderMiniCal();
updateThemeIcon();
renderDesk();
