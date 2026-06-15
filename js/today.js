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

  // Build set of days that have any event (single or range)
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

  // Upcoming events list (next 14 days) — includes multi-day starts
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
// QUICKNOTE + BERICHTSHEFT
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

const berichtBetrieb = document.getElementById('bericht-betrieb');
const berichtSchule  = document.getElementById('bericht-schule');
berichtBetrieb.value = berichtsheft.betrieb;
berichtSchule.value  = berichtsheft.schule;
let berichtTimer;
function saveBericht() {
  berichtsheft = { betrieb: berichtBetrieb.value, schule: berichtSchule.value };
  DB.set('berichtsheft', berichtsheft);
  clearTimeout(berichtTimer);
  const hint = document.getElementById('bericht-saved'); hint.classList.remove('show');
  berichtTimer = setTimeout(() => hint.classList.add('show'), 800);
}
berichtBetrieb.addEventListener('input', saveBericht);
berichtSchule.addEventListener('input', saveBericht);

// =========================
// NOTES
// =========================

function saveNotes() { DB.set('notes', notes); }
function renderNotes() {
  [['exam-notes','note-list-exam'],['class-questions','note-list-questions'],['terms','note-list-terms']].forEach(([key,listId]) => {
    const ul = document.getElementById(listId); if (!ul) return;
    ul.innerHTML = '';
    (notes[key] || []).forEach((text, idx) => {
      const li = document.createElement('li'); li.className = 'note-item';
      const span = document.createElement('span'); span.textContent = text;
      const del  = document.createElement('button'); del.className = 'note-del'; del.textContent = '✕';
      del.addEventListener('click', () => { notes[key].splice(idx,1); saveNotes(); renderNotes(); });
      li.append(span, del); ul.appendChild(li);
    });
  });
}

let noteModalKey = null;
const NOTE_LABELS = { 'exam-notes': 'Wichtiges', 'class-questions': 'Fragen für den Unterricht', 'terms': 'Begriffe & Definitionen' };

function openNoteModal(key, label) {
  noteModalKey = key;
  document.getElementById('note-modal-title').textContent = `${label || key} — Notiz hinzufügen`;
  document.getElementById('note-modal-input').value = '';
  document.getElementById('note-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('note-modal-input').focus(), 50);
}
function closeNoteModal() { document.getElementById('note-modal-overlay').classList.add('hidden'); noteModalKey = null; }

document.getElementById('note-modal-close').addEventListener('click', closeNoteModal);
document.getElementById('note-modal-cancel').addEventListener('click', closeNoteModal);
document.getElementById('note-modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('note-modal-overlay')) closeNoteModal(); });

document.getElementById('note-modal-save').addEventListener('click', () => {
  const text = document.getElementById('note-modal-input').value.trim();
  if (!text || !noteModalKey) return;
  if (noteModalKey.startsWith('__custom__')) {
    const tileId = noteModalKey.replace('__custom__', '');
    const tile = customTiles.find(t => t.id === tileId); if (!tile) return;
    if (!tile.items) tile.items = [];
    tile.items.push({ id: crypto.randomUUID(), text, done: false });
    saveCustomTiles(); renderCustomTiles(); closeNoteModal();
  } else if (noteModalKey === '__todo__') {
    if (!generalTodos) generalTodos = [];
    generalTodos.push({ id: crypto.randomUUID(), text, done: false });
    saveTodos(); renderTodos(); closeNoteModal();
  } else if (noteModalKey === '__shopping__') {
    if (!shoppingList) shoppingList = [];
    shoppingList.push({ id: crypto.randomUUID(), text, done: false });
    saveShoppingList(); renderShoppingList(); closeNoteModal();
  } else {
    if (!notes[noteModalKey]) notes[noteModalKey] = [];
    notes[noteModalKey].push(text); saveNotes(); renderNotes(); closeNoteModal();
  }
});

document.querySelectorAll('.add-note-btn').forEach(btn => {
  btn.addEventListener('click', () => openNoteModal(btn.dataset.key, NOTE_LABELS[btn.dataset.key]));
});

// =========================
// KACHEL-DESIGNER
// Farbe + Dekoration per Kachel, persistiert in tileDesigns{}
// =========================

const TILE_DESIGN_COLORS = ['#A3B18A', '#EBE4D4', '#C0AC99'];
const TILE_DESIGN_DECOS  = ['none', 'tape', 'clip', 'corner'];

let tileDesigns = DB.get('tileDesigns', {});

function saveTileDesigns() { DB.set('tileDesigns', tileDesigns); }

function getTileDesign(id) {
  return tileDesigns[id] || { color: null, deco: 'none' };
}

/* SVG-Dekorationen — hochwertig, farbadaptiv, ragen über Kartenrand */
function buildTapeSVG(bg) {
  // Großes Washi-Tape: ragt nach oben, leicht gedreht, halbtransparent, Papierstruktur
  return `<svg class="tile-deco-svg deco-tape" width="80" height="36" viewBox="0 0 80 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(-3deg)">
    <defs>
      <filter id="tape-shadow" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.18)"/>
      </filter>
    </defs>
    <!-- Tape-Körper: leicht unregelmäßige Kanten via Pfad -->
    <path d="M2 8 Q0 8 0 10 L0 28 Q0 30 2 30 L78 30 Q80 30 80 28 L80 10 Q80 8 78 8 Z"
      fill="${bg}" fill-opacity="0.52" filter="url(#tape-shadow)"/>
    <!-- Weißer Glanzstreifen oben -->
    <rect x="0" y="8" width="80" height="5" rx="1" fill="white" fill-opacity="0.20"/>
    <!-- Papierstruktur-Linien -->
    <line x1="0" y1="14" x2="80" y2="14" stroke="white" stroke-opacity="0.14" stroke-width="1"/>
    <line x1="0" y1="20" x2="80" y2="20" stroke="white" stroke-opacity="0.10" stroke-width="0.7"/>
    <line x1="0" y1="26" x2="80" y2="26" stroke="white" stroke-opacity="0.08" stroke-width="0.7"/>
    <!-- Rand unten dezent dunkler -->
    <path d="M2 28 Q0 30 2 30 L78 30 Q80 30 80 28" stroke="rgba(0,0,0,0.08)" stroke-width="0.5" fill="none"/>
  </svg>`;
}

function buildClipSVG(bg) {
  // Einfache Büroklammer — eine einzelne Linie mit leichtem Bogen, ragt über Kartenrand
  const c = bg === '#A3B18A' ? 'rgba(50,70,35,0.48)'
           : bg === '#C0AC99' ? 'rgba(75,50,30,0.43)'
           : 'rgba(65,55,40,0.40)';
  return `<svg class="tile-deco-svg deco-clip" width="14" height="32" viewBox="0 0 14 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 0 C7 0 13 4 13 10 C13 16 13 22 13 28" stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function buildCornerOverlay(bg) {
  // Farbadaptiver Gradient — passender dunklerer Ton zur Kachelfarbe, nur oben rechts, halb so groß
  let color;
  if (bg === '#A3B18A')      color = '50,70,35';   // grün
  else if (bg === '#C0AC99') color = '75,50,30';   // braun
  else                       color = '65,55,40';   // beige/default
  return `<div class="tile-deco-corner-gradient" style="background: radial-gradient(circle at top right, rgba(${color},0.28) 0%, rgba(${color},0.12) 40%, rgba(${color},0.03) 70%, transparent 85%);" aria-hidden="true"></div>`;
}

function applyTileDecoration(el, design) {
  el.querySelectorAll('.tile-deco-svg, .tile-deco-corner-gradient').forEach(d => d.remove());
  const bg = design.color || el.style.background || '#EBE4D4';
  switch (design.deco) {
    case 'tape':   el.insertAdjacentHTML('beforeend', buildTapeSVG(bg));       break;
    case 'clip':   el.insertAdjacentHTML('beforeend', buildClipSVG(bg));       break;
    case 'corner': el.insertAdjacentHTML('beforeend', buildCornerOverlay(bg));   break;
  }
}

// Globales Floating-Popup (einmalig erstellt, wird repositioniert)
let _designerPopup = null;
let _designerCloseHandler = null;

function getOrCreateDesignerPopup() {
  if (_designerPopup) return _designerPopup;
  _designerPopup = document.createElement('div');
  _designerPopup.className = 'tile-designer-popup';
  document.body.appendChild(_designerPopup);
  return _designerPopup;
}

function openTileDesigner(el, id, currentDesign) {
  // Alle anderen schließen
  const popup = getOrCreateDesignerPopup();
  popup.classList.remove('open');

  // Inhalt aufbauen
  popup.innerHTML = `
    <div class="tile-designer-section-label">Farbe</div>
    <div class="tile-color-row">
      ${TILE_DESIGN_COLORS.map(c =>
        `<button class="tile-color-swatch${currentDesign.color === c ? ' active' : ''}" data-color="${c}" style="background:${c}" title="${c}"></button>`
      ).join('')}
    </div>
    <div class="tile-designer-section-label">Dekoration</div>
    <div class="tile-deco-row">
      ${[['none','Kein Extra'],['tape','Washi-Tape'],['clip','Büroklammer'],['corner','Abgeknickte Ecke']].map(([val,label]) =>
        `<label class="tile-deco-option${(currentDesign.deco||'none') === val ? ' selected' : ''}">
          <input type="radio" name="deco-${id}" value="${val}"${(currentDesign.deco||'none') === val ? ' checked' : ''}> ${label}
        </label>`
      ).join('')}
    </div>`;

  // Farbe wählen
  popup.querySelectorAll('.tile-color-swatch').forEach(sw => {
    sw.addEventListener('click', e => {
      e.stopPropagation();
      const color = sw.dataset.color;
      tileDesigns[id] = { ...getTileDesign(id), color };
      saveTileDesigns();
      applyDesignToTile(el, id);
      popup.querySelectorAll('.tile-color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
    });
  });

  popup.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', e => {
      e.stopPropagation();
      tileDesigns[id] = { ...getTileDesign(id), deco: radio.value };
      saveTileDesigns();
      applyDesignToTile(el, id);
      popup.querySelectorAll('.tile-deco-option').forEach(o => o.classList.toggle('selected', o.querySelector('input').value === radio.value));
    });
  });

  popup.addEventListener('click', e => e.stopPropagation());

  // Popup öffnen und positionieren (fixed, relativ zu Pinsel-Button)
  popup.classList.add('open');

  const btn = el.querySelector('.tile-design-btn');
  if (btn) {
    const btnRect = btn.getBoundingClientRect();
    const popupW  = 220;
    const popupH  = 200; // Schätzwert

    let left = btnRect.right - popupW;
    let top  = btnRect.top - popupH - 8;

    // Fallback: nach unten öffnen wenn nicht genug Platz nach oben
    if (top < 8) top = btnRect.bottom + 8;
    // Kein Abschneiden am rechten Rand
    if (left < 8) left = 8;
    // Kein Abschneiden am rechten Bildschirmrand
    if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;

    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
  }

  // Schließen bei Klick außerhalb
  if (_designerCloseHandler) document.removeEventListener('click', _designerCloseHandler);
  _designerCloseHandler = (ev) => {
    if (!popup.contains(ev.target)) {
      popup.classList.remove('open');
      document.removeEventListener('click', _designerCloseHandler);
      _designerCloseHandler = null;
    }
  };
  setTimeout(() => document.addEventListener('click', _designerCloseHandler), 10);
}

function applyDesignToTile(el, id) {
  const design = getTileDesign(id);
  if (design.color) {
    el.style.background = design.color;
    const textCol = tileTextColor(design.color);
    el.querySelectorAll('.panel-label, .note-item, .checklist-item span, .bericht-col-label').forEach(t => t.style.color = textCol);
  }
  applyTileDecoration(el, design);
}

function addDesignBtnToTile(el, id) {
  if (el.querySelector('.tile-design-btn')) return;
  // overflow:visible damit SVGs über den Rand ragen können
  el.style.overflow = 'visible';
  const btn = document.createElement('button');
  btn.className = 'tile-design-btn';
  btn.title = 'Design anpassen';
  btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.5 2.5l2 2L6 12H4v-2L11.5 2.5z"/>
    <path d="M2 14h12" stroke-opacity="0.4"/>
  </svg>`;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    openTileDesigner(el, id, getTileDesign(id));
  });
  el.appendChild(btn);
  applyDesignToTile(el, id);
}

function initBuiltinTileDesigners() {
  const builtinIds = [
    { el: () => document.querySelector('#today-tiles-grid > .panel.today-tile:nth-child(1)'), id: 'builtin-wichtiges' },
    { el: () => document.querySelector('#today-tiles-grid > .panel.today-tile:nth-child(2)'), id: 'builtin-fragen' },
    { el: () => document.getElementById('panel-berichtsheft'),                                id: 'builtin-berichtsheft' },
    { el: () => document.getElementById('panel-todo'),                                        id: 'builtin-todo' },
    { el: () => document.getElementById('panel-shopping'),                                    id: 'builtin-shopping' },
    { el: () => document.querySelector('#today-tiles-grid > .panel.today-tile:nth-child(6)'), id: 'builtin-begriffe' },
  ];
  builtinIds.forEach(({ el, id }) => {
    const node = el();
    if (node) addDesignBtnToTile(node, id);
  });
}

// =========================

// Tile-Farbpalette (3 Töne, zufällig bei Erstellung zugewiesen)
const TILE_COLORS = ['#A3B18A', '#EBE4D4', '#C0AC99'];

// Ensure every existing tile has a saved color (one-time migration)
(function ensureTileColors() {
  let changed = false;
  customTiles.forEach(tile => {
    if (!tile.color) {
      tile.color = TILE_COLORS[Math.floor(Math.random() * TILE_COLORS.length)];
      changed = true;
    }
  });
  if (changed) DB.set('customTiles', customTiles);
})();

function saveCustomTiles() { DB.set('customTiles', customTiles); }

// Pick text color based on tile background
function tileTextColor(hex) {
  if (hex === '#A3B18A') return '#2A3020';
  if (hex === '#C0AC99') return '#2E2217';
  return '#3D3626'; // #EBE4D4
}

function renderCustomTiles() {
  const container = document.getElementById('custom-tiles');
  container.innerHTML = '';
  customTiles.forEach(tile => {
    const panel  = document.createElement('div'); panel.className = 'panel today-tile';
    const bg = tile.color || TILE_COLORS[0];
    panel.style.background = bg;
    panel.style.borderColor = 'rgba(0,0,0,0.10)';
    const textCol = tileTextColor(bg);

    const header = document.createElement('div'); header.className = 'panel-header';
    header.style.borderBottomColor = 'rgba(0,0,0,0.09)';
    const label  = document.createElement('span'); label.className = 'panel-label';
    label.textContent = tile.title; label.style.color = textCol;
    const right  = document.createElement('div'); right.style.cssText = 'display:flex;gap:6px;align-items:center;';
    if (tile.type === 'list') {
      const addBtn = document.createElement('button'); addBtn.className = 'icon-btn'; addBtn.textContent = '+';
      addBtn.addEventListener('click', () => {
        noteModalKey = '__custom__' + tile.id;
        document.getElementById('note-modal-title').textContent = `${tile.title} — Eintrag hinzufügen`;
        document.getElementById('note-modal-input').value = '';
        document.getElementById('note-modal-overlay').classList.remove('hidden');
        setTimeout(() => document.getElementById('note-modal-input').focus(), 50);
      });
      right.appendChild(addBtn);
    }
    const delBtn = document.createElement('button'); delBtn.className = 'icon-btn'; delBtn.textContent = '✕';
    delBtn.style.opacity = '0';
    panel.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
    panel.addEventListener('mouseleave', () => delBtn.style.opacity = '0');
    delBtn.addEventListener('click', () => { customTiles = customTiles.filter(t => t.id !== tile.id); saveCustomTiles(); renderCustomTiles(); });
    right.appendChild(delBtn);
    header.append(label, right); panel.appendChild(header);
    if (tile.type === 'note') {
      const ta = document.createElement('textarea');
      ta.className = 'custom-tile-textarea'; ta.value = tile.content || ''; ta.placeholder = 'Notizen...';
      ta.style.color = textCol;
      ta.addEventListener('input', () => { tile.content = ta.value; saveCustomTiles(); });
      panel.appendChild(ta);
    } else {
      if (tile.items && tile.items.length > 0 && typeof tile.items[0] === 'string') {
        tile.items = tile.items.map(s => ({ id: crypto.randomUUID(), text: s, done: false }));
        saveCustomTiles();
      }
      const tileBg = tile.color || TILE_COLORS[0];
      const ul = document.createElement('ul'); ul.className = 'checklist';
      (tile.items || []).forEach((item, idx) => {
        const li = document.createElement('li'); li.className = 'checklist-item' + (item.done ? ' done' : '');
        li.style.color = textCol;
        const cbWrap = makePaperCbElement(item.done, tileBg, () => {
          item.done = !item.done; saveCustomTiles(); renderCustomTiles();
        });
        const span = document.createElement('span'); span.textContent = item.text || item;
        const del  = document.createElement('button'); del.className = 'note-del'; del.textContent = '✕';
        del.addEventListener('click', () => { tile.items.splice(idx, 1); saveCustomTiles(); renderCustomTiles(); });
        li.append(cbWrap, span, del); ul.appendChild(li);
      });
      if ((tile.items || []).length === 0) {
        const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'Noch keine Einträge.';
        ul.appendChild(empty);
      }
      panel.appendChild(ul);
    }
    container.appendChild(panel);
    // Designer-Button für Custom-Kachel
    addDesignBtnToTile(panel, tile.id);
  });
}

let selectedTileType = 'note';
document.getElementById('add-tile-btn').addEventListener('click', () => {
  document.getElementById('tile-modal-title').value = '';
  selectedTileType = 'note';
  document.querySelectorAll('.tile-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'note'));
  document.getElementById('tile-type-desc').textContent = 'Freies Textfeld, wie die Schnellnotiz.';
  document.getElementById('tile-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('tile-modal-title').focus(), 50);
});
document.querySelectorAll('.tile-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedTileType = btn.dataset.type;
    document.querySelectorAll('.tile-type-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('tile-type-desc').textContent =
      selectedTileType === 'note' ? 'Freies Textfeld, wie die Schnellnotiz.' : 'Checkliste mit Kästchen zum Abhaken.';
  });
});
document.getElementById('tile-modal-close').addEventListener('click', () => document.getElementById('tile-modal-overlay').classList.add('hidden'));
document.getElementById('tile-modal-cancel').addEventListener('click', () => document.getElementById('tile-modal-overlay').classList.add('hidden'));
document.getElementById('tile-modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('tile-modal-overlay')) document.getElementById('tile-modal-overlay').classList.add('hidden'); });
document.getElementById('tile-modal-save').addEventListener('click', () => {
  const title = document.getElementById('tile-modal-title').value.trim(); if (!title) return;
  const tileColor = TILE_COLORS[Math.floor(Math.random() * TILE_COLORS.length)];
  const tile = { id: crypto.randomUUID(), title, type: selectedTileType, content: '', items: [], color: tileColor };
  customTiles.push(tile); saveCustomTiles();
  document.getElementById('tile-modal-overlay').classList.add('hidden');
  renderCustomTiles();
});

// =========================
// REFRESH (wird bei View-Wechsel aufgerufen)
// =========================

function refreshTodayTextareas() {
  quicknote = DB.get('quicknote', '');
  document.getElementById('quicknote').value = quicknote;
  berichtsheft = DB.get('berichtsheft', { betrieb: '', schule: '' });
  document.getElementById('bericht-betrieb').value = berichtsheft.betrieb || '';
  document.getElementById('bericht-schule').value  = berichtsheft.schule  || '';
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

// Hilfsfunktion: Kachelfarbe für ein DOM-Element ermitteln
function getTileBgForEl(el) {
  let node = el;
  while (node && node !== document.body) {
    const bg = node.style.background || node.style.backgroundColor;
    if (bg && (bg.startsWith('#') || bg.startsWith('rgb'))) return bg;
    // Kachel-Farben aus CSS-Klassen
    const cls = node.className || '';
    if (cls.includes('today-tile') || cls.includes('panel')) {
      const computed = getComputedStyle(node).backgroundColor;
      if (computed && computed !== 'rgba(0, 0, 0, 0)') return computed;
    }
    node = node.parentElement;
  }
  return '#EBE4D4';
}

// =========================
// GENERAL TO DO TILE
// =========================

function saveTodos() { DB.set('generalTodos', generalTodos); }
function renderTodos() {
  const ul = document.getElementById('todo-list'); if (!ul) return;
  ul.innerHTML = '';
  const tileBg = (() => {
    const panel = document.getElementById('panel-todo');
    return panel ? (panel.style.background || tileDesigns['builtin-todo']?.color || '#EBE4D4') : '#EBE4D4';
  })();
  (generalTodos || []).forEach((item, idx) => {
    const li = document.createElement('li'); li.className = 'checklist-item' + (item.done ? ' done' : '');
    const cbWrap = makePaperCbElement(item.done, tileBg, () => {
      item.done = !item.done; saveTodos(); renderTodos();
    });
    const span = document.createElement('span'); span.textContent = item.text;
    const del  = document.createElement('button'); del.className = 'note-del'; del.textContent = '✕';
    del.addEventListener('click', () => { generalTodos.splice(idx, 1); saveTodos(); renderTodos(); });
    li.append(cbWrap, span, del); ul.appendChild(li);
  });
  if (!generalTodos || generalTodos.length === 0) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'Noch keine Einträge.';
    ul.appendChild(empty);
  }
}
document.getElementById('add-todo-btn').addEventListener('click', () => {
  noteModalKey = '__todo__';
  document.getElementById('note-modal-title').textContent = 'To Do — Eintrag hinzufügen';
  document.getElementById('note-modal-input').value = '';
  document.getElementById('note-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('note-modal-input').focus(), 50);
});
renderTodos();

// =========================
// EINKAUFSLISTE
// =========================

function saveShoppingList() { DB.set('shoppingList', shoppingList); }
function renderShoppingList() {
  const ul = document.getElementById('shopping-list'); if (!ul) return;
  ul.innerHTML = '';
  const tileBg = (() => {
    const panel = document.getElementById('panel-shopping');
    return panel ? (panel.style.background || tileDesigns['builtin-shopping']?.color || '#EBE4D4') : '#EBE4D4';
  })();
  (shoppingList || []).forEach((item, idx) => {
    const li = document.createElement('li'); li.className = 'checklist-item' + (item.done ? ' done' : '');
    const cbWrap = makePaperCbElement(item.done, tileBg, () => {
      item.done = !item.done; saveShoppingList(); renderShoppingList();
    });
    const span = document.createElement('span'); span.textContent = item.text;
    const del  = document.createElement('button'); del.className = 'note-del'; del.textContent = '✕';
    del.addEventListener('click', () => { shoppingList.splice(idx, 1); saveShoppingList(); renderShoppingList(); });
    li.append(cbWrap, span, del); ul.appendChild(li);
  });
  if (!shoppingList || shoppingList.length === 0) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'Noch keine Einträge.';
    ul.appendChild(empty);
  }
}
document.getElementById('add-shopping-btn').addEventListener('click', () => {
  noteModalKey = '__shopping__';
  document.getElementById('note-modal-title').textContent = 'Einkaufsliste — Eintrag hinzufügen';
  document.getElementById('note-modal-input').value = '';
  document.getElementById('note-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('note-modal-input').focus(), 50);
});
renderShoppingList();

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
initBuiltinTileDesigners();
