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
  // daily=sunrise,sunset + forecast_days=2: liefert fürs Start-Banner
  // (isStartHeaderDaytime() unten) auch den morgigen Sonnenaufgang mit,
  // ohne zweiten Request. timezone=auto → Zeiten in lokaler Wanduhrzeit
  // des Standorts.
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability&daily=sunrise,sunset&forecast_days=2&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();
  const wc = data.current_weather;
  const code = wc.weathercode;
  const svgCode = weatherCodeToSvg(code);
  const temp = Math.round(wc.temperature) + '°C';
  const desc = weatherCodeToDesc(code);
  const sunrise = data.daily?.sunrise?.[0] || null;
  const sunset = data.daily?.sunset?.[0] || null;
  const sunriseTomorrow = data.daily?.sunrise?.[1] || null;
  const utcOffsetSeconds = typeof data.utc_offset_seconds === 'number' ? data.utc_offset_seconds : null;
  return { svgCode, temp, desc, sunrise, sunset, sunriseTomorrow, utcOffsetSeconds };
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

// =========================
// START-BANNER — Tag/Nacht (aus Core)
// Nutzt nur die Sonnenauf-/-untergangszeiten aus fetchWeatherByCoords()
// oben, kein zweiter Dienst. Welches Banner-Set gezeigt wird, entscheidet
// js/theme-engine.js ([data-start-header-theme]); hier wird nur
// [data-start-header-daynight] gesetzt, das css/today.css damit kombiniert.
// =========================

// Open-Meteo liefert bei timezone=auto Wanduhrzeit ohne Offset (z.B.
// "2026-09-21T06:42") — new Date(str) würde das als Browser-Zeitzone lesen,
// was bei manuell gewählter Stadt in anderer Zeitzone falsch wäre. Deshalb
// als Pseudo-UTC-Epoche vergleichen.
function parseOpenMeteoLocalTime(str) {
  const [datePart, timePart] = str.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi);
}

// true/false = Tag/Nacht, null = unbekannt (CSS fällt dann auf Tag zurück).
function isStartHeaderDaytime(w) {
  if (!w || !w.sunrise || !w.sunset || typeof w.utcOffsetSeconds !== 'number') return null;
  const nowAtLocation = Date.now() + w.utcOffsetSeconds * 1000;
  return nowAtLocation >= parseOpenMeteoLocalTime(w.sunrise) && nowAtLocation < parseOpenMeteoLocalTime(w.sunset);
}

function applyStartHeaderDaynight() {
  const isDay = isStartHeaderDaytime(DB.get('weatherData', null));
  // Ohne gültige Daten Attribut entfernen statt einen alten Wert stehen zu lassen.
  if (isDay === null) { document.documentElement.removeAttribute('data-start-header-daynight'); return; }
  document.documentElement.setAttribute('data-start-header-daynight', isDay ? 'day' : 'night');
}

// Plant den nächsten Wechsel exakt zum Sonnenauf-/-untergang statt zu
// pollen; nach Sonnenuntergang den morgigen Sonnenaufgang.
let _startHeaderDaynightTimer = null;
function scheduleStartHeaderDaynightCheck(w) {
  if (_startHeaderDaynightTimer) { clearTimeout(_startHeaderDaynightTimer); _startHeaderDaynightTimer = null; }
  if (!w || !w.sunrise || !w.sunset || typeof w.utcOffsetSeconds !== 'number') return;
  const sunrise = parseOpenMeteoLocalTime(w.sunrise);
  const sunset = parseOpenMeteoLocalTime(w.sunset);
  const sunriseTomorrow = w.sunriseTomorrow ? parseOpenMeteoLocalTime(w.sunriseTomorrow) : null;
  const nowAtLocation = Date.now() + w.utcOffsetSeconds * 1000;
  let nextChangeAt = null;
  if (nowAtLocation < sunrise) nextChangeAt = sunrise;
  else if (nowAtLocation < sunset) nextChangeAt = sunset;
  else if (sunriseTomorrow && nowAtLocation < sunriseTomorrow) nextChangeAt = sunriseTomorrow;
  if (nextChangeAt === null) return;
  _startHeaderDaynightTimer = setTimeout(() => {
    applyStartHeaderDaynight();
    scheduleStartHeaderDaynightCheck(DB.get('weatherData', null));
  }, Math.max(nextChangeAt - nowAtLocation, 0) + 250);
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
    applyStartHeaderDaynight();
    scheduleStartHeaderDaynightCheck(saved);
    return { ok: true };
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
    const weatherData = { ...data, ts: Date.now(), locKey };
    DB.set('weatherData', weatherData);
    if (iconEl) iconEl.innerHTML = data.svgCode;
    tempEl.textContent = data.temp;
    descEl.textContent = data.desc;
    applyStartHeaderDaynight();
    scheduleStartHeaderDaynightCheck(weatherData);
    if (typeof onThemeAutoWeatherUpdate === 'function') onThemeAutoWeatherUpdate();
    return { ok: true };
  } catch (e) {
    if (iconEl) iconEl.innerHTML = WEATHER_SVGS.unknown;
    tempEl.textContent = '—';
    descEl.textContent = 'Keine Daten';
    // Ergebnis für die Einstellungen (settings.js: Hinweis unter "Standort"):
    // GeolocationPositionError.code 1 = Zugriff verweigert, 2/3 = nicht
    // ermittelbar/Zeitüberschreitung, sonst Netzwerk-/Stadtfehler.
    let reason = 'network';
    if (e && typeof e.code === 'number' && e.code >= 1 && e.code <= 3) reason = e.code === 1 ? 'denied' : 'unavailable';
    else if (weatherSettings.mode === 'gps' && !navigator.geolocation) reason = 'unavailable';
    else if (e && e.message === 'City not found') reason = 'notfound';
    return { ok: false, reason };
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
  // Zurück-zur-aktuellen-Woche-Knopf nur zeigen, wenn eine andere Woche gewählt ist.
  document.getElementById('week-today-btn')?.classList.toggle('hidden', getWeekId(state.currentDate) === getWeekId(new Date()));
  renderTodayHeader();
}

function updateCountdown() {
  const container = document.getElementById('countdown-display');
  if (!container) return;
  container.innerHTML = '';
  // Einzeltermine + Serien (nächstes Vorkommen) — zentrale Liste aus calendar.js
  const visible = getCountdownItems().filter(c => countdownVisible[c.id] === true);

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
    const label = document.createElement('span'); label.className = 'countdown-label'; label.textContent = (item.recurring ? '↻ ' : '') + item.title;
    const sub   = document.createElement('span'); sub.className = 'countdown-sub';
    sub.textContent = item.daysLeft === 0 ? 'Heute!' : item.daysLeft === 1 ? 'in 1 Tag' : `in ${item.daysLeft} Tagen`;
    info.append(label, sub); left.append(icon, info);
    const days  = document.createElement('span'); days.className = 'countdown-days'; days.textContent = item.daysLeft;
    entry.append(left, days);
    // Klick auf einen Countdown öffnet direkt den Termin (statt der Liste)
    entry.title = 'Termin öffnen';
    entry.addEventListener('click', e => { e.stopPropagation(); openCountdownEvent(item); });
    container.appendChild(entry);
  });
}

// Open countdown modal when section is clicked
document.getElementById('sidebar-countdowns')?.addEventListener('click', openCountdownModal);

document.getElementById('week-today-btn')?.addEventListener('click', () => {
  state.currentDate = new Date(); updateHeader(); renderView(currentView);
});
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
  // Der Intervall läuft sekündlich (damit der Minutenwechsel pünktlich
  // kommt), neu gezeichnet wird aber nur, wenn sich Minute oder Stil ändert.
  const rpg = document.documentElement.dataset.todayStyle === 'rpg' && typeof renderRpgClock === 'function';
  const key = `${rpg ? 'rpg' : 'std'}|${now.getHours()}:${now.getMinutes()}`;
  if (panel._clockKey === key) return;
  panel._clockKey = key;
  panel.classList.toggle('rpg-clock-panel', rpg);
  if (rpg) { renderRpgClock(panel, now); return; }

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

// Weist Ereignissen einer Kalenderzeile (Mo–So) "Lanes" (Zeilen-Slots) zu, damit
// mehrtägige Balken über die Woche hinweg auf gleicher Höhe bleiben und sich
// mehrere gleichzeitige Termine untereinander statt überlappend stapeln.
// week: Array mit 7 Slots ({day:Number|null}); dayEntries: Map<Tag, Eintrag[]>
function assignWeekLanes(week, dayEntries) {
  const eventsInWeek = new Map(); // id -> {startIdx, endIdx, color, isRange}
  week.forEach((slot, idx) => {
    if (slot.day == null) return;
    (dayEntries.get(slot.day) || []).forEach(entry => {
      const info = eventsInWeek.get(entry.id);
      if (info) info.endIdx = idx;
      else eventsInWeek.set(entry.id, { startIdx: idx, endIdx: idx, color: entry.color, isRange: entry.isRange });
    });
  });

  // Frühester Start zuerst; bei Gleichstand mehrtägige Termine vor Einzelterminen (stabilere Balken)
  const ids = [...eventsInWeek.keys()].sort((a, b) => {
    const ea = eventsInWeek.get(a), eb = eventsInWeek.get(b);
    if (ea.startIdx !== eb.startIdx) return ea.startIdx - eb.startIdx;
    return (eb.isRange ? 1 : 0) - (ea.isRange ? 1 : 0);
  });

  // Greedy Lane-Zuweisung (Interval-Graph-Coloring): erste freie Lane ohne Überlappung
  const laneEnds = [];
  const laneOf   = new Map();
  ids.forEach(id => {
    const { startIdx, endIdx } = eventsInWeek.get(id);
    let lane = laneEnds.findIndex(end => end < startIdx);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(endIdx); }
    else laneEnds[lane] = endIdx;
    laneOf.set(id, lane);
  });

  const laneCount = laneEnds.length;
  const matrix = Array.from({ length: 7 }, () => new Array(laneCount).fill(null));
  ids.forEach(id => {
    const { startIdx, endIdx } = eventsInWeek.get(id);
    const lane = laneOf.get(id);
    for (let i = startIdx; i <= endIdx; i++) matrix[i][lane] = id;
  });

  return { eventsInWeek, matrix, laneCount };
}

function buildMiniCal(refDate) {
  const year  = refDate.getFullYear();
  const month = refDate.getMonth();
  const today = new Date(); today.setHours(0,0,0,0);

  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const dayNames   = ['Mo','Di','Mi','Do','Fr','Sa','So'];

  // Ereignis-Vorkommen dieses Monats pro Tag sammeln (Tag → Liste von Einträgen)
  const dayEntries = new Map();
  const addEntry = (day, entry) => {
    if (!dayEntries.has(day)) dayEntries.set(day, []);
    dayEntries.get(day).push(entry);
  };

  if (typeof events !== 'undefined') {
    Object.entries(events).forEach(([key, dayEvs]) => {
      (dayEvs || []).forEach(ev => {
        const color = ev.color || DEFAULT_EVENT_COLOR;
        if (!ev.endDate) {
          // Einzeltag
          const d = parseLocalDate(key);
          if (d.getFullYear() === year && d.getMonth() === month) {
            addEntry(d.getDate(), { id: ev.id, color, isRange: false });
          }
          return;
        }
        // Mehrtägig: jeden Tag im Zeitraum als eigenen Eintrag der gleichen Ereignis-ID erfassen
        const start = parseLocalDate(ev.startDate || key); start.setHours(0,0,0,0);
        const end   = parseLocalDate(ev.endDate);           end.setHours(0,0,0,0);
        const cur   = new Date(start);
        while (cur <= end) {
          if (cur.getFullYear() === year && cur.getMonth() === month) {
            addEntry(cur.getDate(), { id: ev.id, color, isRange: true });
          }
          cur.setDate(cur.getDate() + 1);
        }
      });
    });
  }

  // Wiederkehrende Vorkommen dieses Monats als Einzeltag-Einträge erfassen
  if (typeof getSeriesOccurrencesInRange === 'function') {
    const gridStart = new Date(year, month, 1);
    const gridEnd   = new Date(year, month + 1, 0);
    getSeriesOccurrencesInRange(gridStart, gridEnd).forEach(({ date: d, event: ev }) => {
      if (d.getFullYear() === year && d.getMonth() === month) {
        addEntry(d.getDate(), { id: ev.id + '_' + dateKey(d), color: ev.color || DEFAULT_EVENT_COLOR, isRange: false });
      }
    });
  }

  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const daysInMonth = new Date(year, month+1, 0).getDate();
  const prevDays    = new Date(year, month, 0).getDate();
  const total       = startDow + daysInMonth;
  const remainder   = total % 7 === 0 ? 0 : 7 - (total % 7);

  // Zellenfolge (ohne Kopfzeile) in Kalenderzeilen à 7 Tage aufteilen, damit
  // Ereignis-Balken pro Zeile (Mo–So) unabhängig ausgerichtet werden können
  const sequence = [];
  for (let i = startDow - 1; i >= 0; i--) sequence.push({ day: null, label: prevDays - i });
  for (let d = 1; d <= daysInMonth; d++) sequence.push({ day: d, label: d });
  for (let d = 1; d <= remainder; d++) sequence.push({ day: null, label: d });

  let cells = dayNames.map(d => `<div class="mini-cal-day-name">${d}</div>`).join('');

  for (let w = 0; w < sequence.length; w += 7) {
    const week = sequence.slice(w, w + 7);
    const { eventsInWeek, matrix, laneCount } = assignWeekLanes(week, dayEntries);

    week.forEach((slot, idx) => {
      if (slot.day == null) {
        cells += `<div class="mini-cal-cell other-month"><span class="mini-cal-daynum">${slot.label}</span></div>`;
        return;
      }
      const d = slot.day;
      const cellDate = new Date(year, month, d); cellDate.setHours(0,0,0,0);
      const isT = cellDate.getTime() === today.getTime();
      const key = dateKey(cellDate);

      let barsHtml = '';
      if (laneCount > 0) {
        const laneBars = matrix[idx].map(id => {
          if (!id) return `<span class="mini-cal-bar bar-empty"></span>`;
          const info       = eventsInWeek.get(id);
          const isRowStart = idx === info.startIdx;
          const isRowEnd   = idx === info.endIdx;
          const posCls = (!info.isRange || (isRowStart && isRowEnd)) ? 'bar-single'
                       : isRowStart ? 'bar-start'
                       : isRowEnd   ? 'bar-end'
                       : 'bar-mid';
          return `<span class="mini-cal-bar ${posCls}" style="background:${scheduleEsc(info.color)}"></span>`;
        }).join('');
        barsHtml = `<div class="mini-cal-bars">${laneBars}</div>`;
      }

      cells += `<div class="mini-cal-cell${isT ? ' is-today' : ''}" data-date="${key}" data-day="${d}"><span class="mini-cal-daynum">${d}</span>${barsHtml}</div>`;
    });
  }

  // Terminliste des angezeigten Monats — immer der gesamte Monat (1. bis
  // letzter Tag), unabhängig davon ob aktueller, vergangener oder künftiger
  // Monat. Ein einmaliger Scan über alle Termine statt Tag-für-Tag-Lookup,
  // da mehrtägige Termine nur unter ihrem Start-Datum-Schlüssel liegen und
  // sonst verpasst würden, sobald das Fenster nicht exakt am Starttag beginnt.
  let upcomingHtml = '';
  const upcoming = [];
  const listFrom  = new Date(year, month, 1);
  const listTo    = new Date(year, month, daysInMonth);

  if (typeof events !== 'undefined') {
    Object.entries(events).forEach(([key, dayEvs]) => {
      (dayEvs || []).forEach(ev => {
        if (ev.showInAgenda === false) return; // per Toggle aus der Liste ausgeblendet
        const evColor = ev.color || DEFAULT_EVENT_COLOR;
        if (!ev.endDate) {
          const d = parseLocalDate(key);
          if (d < listFrom || d > listTo) return;
          upcoming.push({ title: ev.title, date: d, dateStr: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }), color: evColor, isRange: false });
          return;
        }
        const start = parseLocalDate(ev.startDate || key); start.setHours(0,0,0,0);
        const end   = parseLocalDate(ev.endDate);           end.setHours(0,0,0,0);
        if (end < listFrom || start > listTo) return; // kein Überschneiden mit dem angezeigten Monat
        const startStr = start.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
        const endStr   = end.toLocaleDateString('de-DE',   { day: 'numeric', month: 'short' });
        // Sortierdatum: Beginn des Termins, geclamped auf den Monatsanfang, falls er vorher startete
        const sortDate = start < listFrom ? listFrom : start;
        upcoming.push({ title: ev.title, date: sortDate, dateStr: `${startStr} – ${endStr}`, color: evColor, isRange: true });
      });
    });
  }

  // Wiederkehrende Vorkommen im gesamten angezeigten Monat (Funktion unterstützt bereits Zeiträume)
  if (typeof getSeriesOccurrencesInRange === 'function') {
    getSeriesOccurrencesInRange(listFrom, listTo).forEach(({ date: d, event: ev }) => {
      if (ev.showInAgenda === false) return;
      upcoming.push({ title: '↻ ' + ev.title, date: d, dateStr: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }), color: ev.color || DEFAULT_EVENT_COLOR, isRange: false });
    });
  }

  upcoming.sort((a, b) => a.date - b.date);

  if (upcoming.length > 0) {
    upcomingHtml = `<div id="mini-cal-events">${
      upcoming.slice(0,5).map(e =>
        `<div class="mini-cal-event-row" data-date="${dateKey(e.date)}" style="cursor:pointer;">
          <span class="mini-cal-event-dot${e.isRange ? ' range-ev' : ''}" style="background:${scheduleEsc(e.color)}"></span>
          <span class="mini-cal-event-title">${scheduleEsc(e.title)}</span>
          <span class="mini-cal-event-date">${scheduleEsc(e.dateStr)}</span>
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

// Tagesrahmen aus dem Stundenplan des angezeigten Tages (js/schedule.js);
// an anderen Tagen als heute bzw. an freien Tagen bleibt der Balken leer.
function renderBlocksProgress() {
  const bar   = document.getElementById('blocks-progress-bar');
  const label = document.getElementById('blocks-progress-label');
  if (!bar) return;
  const plan = scheduleSegmentsForDate(state.currentDate);
  const wrap = document.getElementById('blocks-progress-wrap');
  if (wrap) wrap.classList.toggle('hidden', plan.off || !isToday(state.currentDate));
  if (plan.off || !isToday(state.currentDate)) return;

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const dayStart = plan.start;
  const dayEnd   = plan.end;

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
    label.textContent = 'Feierabend';
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

// Zeitleiste des angezeigten Tages aus dem Stundenplan (js/schedule.js):
// Unterricht, Pausen, Blöcke und nicht zugewiesene Arbeitszeit. Aufgaben
// hängen wie bisher per task.blocks an den Block-IDs.
// Die Zeitleiste ist eine seitlich scrollende Zeile (css/schedule.css).
// Sie springt nur dann zum laufenden Abschnitt, wenn sich Tag oder
// laufender Abschnitt geändert haben — sonst bleibt die Scrollposition
// des Nutzers erhalten (z.B. nach dem Bearbeiten einer Aufgabe).
let blocksFocusKey = null;
function currentBlocksFocusKey() {
  const plan = scheduleSegmentsForDate(state.currentDate);
  if (!isToday(state.currentDate) || plan.off) return dateKey(state.currentDate);
  const n = new Date(), nowM = n.getHours() * 60 + n.getMinutes();
  const seg = plan.segments.find(s => nowM >= scheduleToMin(s.start) && nowM < scheduleToMin(s.end));
  return dateKey(state.currentDate) + '|' + (seg ? seg.start : (nowM >= scheduleToMin(plan.end) ? 'end' : 'before'));
}
function renderBlocks() {
  const row = document.getElementById('blocks-row');
  const keepLeft = row.scrollLeft;
  row.innerHTML = '';
  const plan = scheduleSegmentsForDate(state.currentDate);
  const nowM = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
  const viewingToday = isToday(state.currentDate);
  const isNow = seg => viewingToday && nowM >= scheduleToMin(seg.start) && nowM < scheduleToMin(seg.end);
  const isPast = seg => viewingToday && nowM >= scheduleToMin(seg.end);

  if (plan.off) {
    const slot = document.createElement('div');
    slot.className = 'block-slot seg-off';
    slot.innerHTML = `<div class="block-time">${scheduleEsc(SCHEDULE_DAY_NAMES[state.currentDate.getDay()])}</div><div class="block-label"><span>Freier Tag</span></div>`;
    row.appendChild(slot);
  }

  plan.segments.forEach(seg => {
    const active = isNow(seg);
    // Pausen: schmale Markierung statt voller Karte
    if (seg.type === 'break') {
      const br = document.createElement('div');
      br.className = 'block-break' + (active ? ' active-break' : '') + (isPast(seg) ? ' seg-past' : '');
      br.title = `${seg.label} ${seg.start}–${seg.end}`;
      br.innerHTML = `<span class="block-break-icon" aria-hidden="true">☕</span><span class="block-break-label">${scheduleEsc(seg.label)}</span><span class="block-break-time">${seg.start}–${seg.end}</span>`;
      row.appendChild(br);
      return;
    }
    const slot = document.createElement('div');
    const kindCls = seg.type === 'block' ? ' seg-kind-' + seg.kind : '';
    slot.className = `block-slot seg-${seg.type}${kindCls}` + (seg.type === 'unassigned' || seg.kind === 'free' ? ' free' : '') + (active ? ' active-block' : '') + (isPast(seg) ? ' seg-past' : '');
    const time  = document.createElement('div'); time.className = 'block-time'; time.textContent = `${seg.start} – ${seg.end}`;
    const label = document.createElement('div'); label.className = 'block-label';
    if (active) {
      const t = document.createElement('span'); t.className = 'active-tag'; t.textContent = 'JETZT';
      label.appendChild(t);
    }
    const nameSpan = document.createElement('span'); nameSpan.textContent = seg.label;
    label.appendChild(nameSpan);
    slot.append(time, label);

    const sub = [];
    if (seg.type === 'lesson') { if (seg.teacher) sub.push(seg.teacher); if (seg.room) sub.push('Raum ' + seg.room); }
    if (seg.type === 'block' && seg.project && seg.project !== seg.label) sub.push('🌳 ' + seg.project);
    if (seg.type === 'block' && seg.kind !== 'project' && seg.kind !== 'other' && seg.label !== SCHEDULE_BLOCK_KINDS[seg.kind].label) sub.push(SCHEDULE_BLOCK_KINDS[seg.kind].label);
    if (sub.length) { const s = document.createElement('div'); s.className = 'block-sub'; s.textContent = sub.join(' · '); slot.appendChild(s); }
    if (seg.type === 'lesson' && seg.notes) { const n = document.createElement('div'); n.className = 'block-sub block-notes'; n.textContent = seg.notes; slot.appendChild(n); }

    if (seg.type === 'block') {
      const ul = document.createElement('ul'); ul.className = 'block-tasks'; ul.dataset.blockId = String(seg.id);
      slot.appendChild(ul);
    }
    row.appendChild(slot);
  });

  if (!plan.off) {
    const end = document.createElement('div');
    end.className = 'block-break block-end' + (viewingToday && nowM >= scheduleToMin(plan.end) ? ' active-break' : '');
    end.innerHTML = `<span class="block-break-icon" aria-hidden="true">🌙</span><span class="block-break-label">Feierabend</span><span class="block-break-time">ab ${plan.end}</span>`;
    row.appendChild(end);
  }

  const dayTasks = getTasksForBlockView();
  dayTasks.forEach(task => {
    // Support both legacy single block (task.block) and new multi-block (task.blocks)
    const blockIds = Array.isArray(task.blocks) ? task.blocks
                   : (task.block != null ? [task.block] : []);
    const status = taskStatusOf(task);
    blockIds.forEach(bid => {
      // Ein Block kann durch Pausen in mehrere Teile zerfallen — Aufgaben nur im ersten zeigen
      const ul = row.querySelector(`.block-tasks[data-block-id="${CSS.escape(String(bid))}"]`); if (!ul) return;
      const li = document.createElement('li');
      li.className = 'block-task-status-' + status + (status === 'completed' ? ' block-task-done' : '');
      li.textContent = `${TASK_STATUS[status].icon} ${task.title}`;
      ul.appendChild(li);
    });
  });

  // Laufenden Abschnitt mittig zeigen (nur die Zeile scrollen, nicht die
  // Seite); an anderen Tagen am Anfang beginnen. Ist Heute gerade nicht
  // sichtbar, hat die Zeile keine Maße — dann beim nächsten Mal nachholen.
  // Einrasten (scroll-snap, am Handy „mandatory“) kurz aussetzen: sonst
  // setzt der Browser nach dem Neuaufbau die alte Einrastposition zurück.
  const focusKey = currentBlocksFocusKey();
  row.style.scrollSnapType = 'none';
  if (row.clientWidth && focusKey !== blocksFocusKey) {
    blocksFocusKey = focusKey;
    const target = row.querySelector('.block-slot.active-block, .block-break.active-break');
    if (target) {
      const r = row.getBoundingClientRect(), t = target.getBoundingClientRect();
      // relativ zur aktuellen Position (der Browser behält sie teils über den Neuaufbau)
      row.scrollLeft += t.left - r.left - (row.clientWidth - t.width) / 2;
    } else row.scrollLeft = 0;
  } else row.scrollLeft = keepLeft;
  requestAnimationFrame(() => { row.style.scrollSnapType = ''; });

  renderBlocksProgress();
}

// Minuten-Takt der Heute-Seite:
// - Tageswechsel: Bleibt Nook über Mitternacht offen (Desktop-App, PWA),
//   springt die Seite auf den neuen Tag — sofern sie vorher „heute“ zeigte
//   (eine bewusst gewählte andere Woche bleibt stehen). „Heute ist“, Speise-
//   plan, „Heute fällig“ usw. bauen sich über renderView('today') neu.
// - Neuer Abschnitt: „JETZT“ wandert weiter, die Zeile folgt ihm.
// - Sonst nur Fortschrittsbalken/Restzeit und Begrüßung (Morgen → Tag) auffrischen.
let todayLastDayKey = dateKey(new Date());
function todayMinuteTick() {
  const nowKey = dateKey(new Date());
  if (nowKey !== todayLastDayKey) {
    const wasToday = dateKey(state.currentDate) === todayLastDayKey;
    const prevMonth = todayLastDayKey.slice(0, 7);
    todayLastDayKey = nowKey;
    if (wasToday) state.currentDate = new Date();
    if (miniCalDate.getFullYear() + '-' + String(miniCalDate.getMonth() + 1).padStart(2, '0') === prevMonth) miniCalDate = new Date();
    if (typeof renderNationalDay === 'function') renderNationalDay();
    updateHeader();
    if (typeof currentView !== 'undefined' && currentView === 'today') renderView('today');
    return;
  }
  renderTodayHeader();
  if (typeof currentView === 'undefined' || currentView !== 'today') return;
  if (currentBlocksFocusKey() !== blocksFocusKey) renderBlocks();
  else renderBlocksProgress();
}
setInterval(todayMinuteTick, 60 * 1000);
// Nach Ruhezustand/Tab im Hintergrund laufen Intervalle verspätet — beim
// Zurückkehren sofort prüfen.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') todayMinuteTick(); });

// Mausrad ohne Seitwärts-Geste scrollt die Zeile seitlich; am Anfang bzw.
// Ende der Zeile scrollt wieder die Seite, damit man nicht festhängt.
document.getElementById('blocks-row').addEventListener('wheel', e => {
  const row = e.currentTarget;
  if (e.deltaX || e.shiftKey || e.ctrlKey || row.scrollWidth <= row.clientWidth + 1) return;
  const atStart = row.scrollLeft <= 0, atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
  if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
  e.preventDefault();
  row.scrollLeft += e.deltaY;
}, { passive: false });

// =========================
// TASKS
// =========================

function saveTasks() { DB.set('tasks', tasks); }

// Wochenaufgaben von außen anlegen (Schnellnotiz „Ablegen“, Brain Dump,
// Entscheidungshilfe in Tools) — eine Aufgabe pro Zeile, Aufzählungs-
// zeichen und leere Zeilen fallen weg. Gibt die Anzahl zurück.
function addWeekTasksFromLines(lines, priority = 2) {
  const titles = lines.map(l => String(l).replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);
  titles.forEach(title => {
    const t = { id: crypto.randomUUID(), title, notes: '', priority, blocks: [], createdAt: Date.now() };
    setTaskStatus(t, 'open');
    tasks.push(t);
  });
  if (!titles.length) return 0;
  saveTasks();
  renderTasks();
  renderBlocks();
  return titles.length;
}

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
  badge.textContent = _blockIds.length ? taskBlockBadgeText(_blockIds) : '–';
  if (_blockIds.length) badge.title = taskBlockBadgeTitle(_blockIds);
  const del   = document.createElement('button'); del.className = 'task-delete'; del.textContent = '✕';
  del.title = 'Aufgabe löschen'; del.setAttribute('aria-label', 'Aufgabe löschen');
  del.addEventListener('click', () => deleteTaskWithUndo(task));
  li.append(statusCtrl, dot, info, badge, del);
  return li;
}

// Löschen ohne Rückfrage, dafür 8 s „Rückgängig“ (hubUndo) — die Aufgabe
// kommt an ihre alte Position zurück.
function deleteTaskWithUndo(task) {
  const idx = tasks.findIndex(t => t.id === task.id);
  if (idx < 0) return;
  tasks.splice(idx, 1);
  saveTasks(); renderTasks(); renderBlocks();
  hubUndo(`„${task.title}“ gelöscht`, () => {
    if (tasks.some(t => t.id === task.id)) return;
    tasks.splice(Math.min(idx, tasks.length), 0, task);
    saveTasks(); renderTasks(); renderBlocks();
  });
}

// Block-Abzeichen einer Aufgabe: Name des Blocks (Stundenplan), gekürzt.
// IDs von Blöcken, die es an keinem Tag mehr gibt, werden ausgelassen
// (die Zuordnung bleibt gespeichert, falls der Block zurückkommt).
function taskBlockBadgeText(ids) {
  const names = ids.map(id => scheduleFindBlock(id, state.currentDate)).filter(Boolean).map(b => {
    const name = scheduleBlockDisplayName(b);
    return name.length > 14 ? name.slice(0, 13) + '…' : name;
  });
  return names.length ? names.join(' · ') : '–';
}
function taskBlockBadgeTitle(ids) {
  return ids.map(id => {
    const b = scheduleFindBlock(id, state.currentDate);
    if (!b) return 'Block ' + id;
    const days = scheduleBlockWeekdays(id);
    return scheduleBlockDisplayName(b) + (days.length ? ` (${days.join(', ')})` : '');
  }).join('\n');
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
    badge.textContent = taskBlockBadgeText(_blockIds);
    info.appendChild(badge);
  }
  info.addEventListener('click', () => openTaskModal(task));

  const del = document.createElement('button');
  del.type = 'button'; del.className = 'tasks-mobile-item-delete'; del.setAttribute('aria-label', 'Aufgabe löschen'); del.textContent = '✕';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTaskWithUndo(task);
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
  // Blöcke des angezeigten Tages (Stundenplan, js/schedule.js). Neue Aufgabe:
  // der gerade laufende Block ist vorausgewählt.
  const dayBlocks = scheduleBlocksForDate(state.currentDate);
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const runningBlock = isToday(state.currentDate)
    ? dayBlocks.find(b => nowM >= scheduleToMin(b.start) && nowM < scheduleToMin(b.end)) : null;
  const _preSelected = existingTask
    ? (Array.isArray(existingTask.blocks) ? existingTask.blocks
       : existingTask.block != null ? [existingTask.block] : [])
    : (runningBlock ? [runningBlock.id] : []);

  const chipsWrap = document.getElementById('modal-block-chips');
  chipsWrap.innerHTML = '';
  const addChip = (id, text, title) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'task-chip' + (_preSelected.includes(id) ? ' active' : '');
    chip.dataset.blockId = id;
    chip.textContent = text;
    chip.title = title;
    chip.addEventListener('click', () => chip.classList.toggle('active'));
    chipsWrap.appendChild(chip);
  };
  dayBlocks.slice().sort((a, b) => (scheduleToMin(a.start) ?? 0) - (scheduleToMin(b.start) ?? 0))
    .forEach(b => addChip(b.id, scheduleBlockDisplayName(b), `${b.start}–${b.end}`));
  // Zuordnungen zu Blöcken anderer Tage bleiben erhalten und abwählbar
  _preSelected.filter(id => !dayBlocks.some(b => b.id === id)).forEach(id => {
    const b = scheduleFindBlock(id);
    const days = scheduleBlockWeekdays(id);
    addChip(id, (b ? scheduleBlockDisplayName(b) : 'Block ' + id) + (days.length ? ` (${days.join(', ')})` : ''), 'Block an einem anderen Tag');
  });
  if (!chipsWrap.children.length) {
    const hint = document.createElement('span'); hint.className = 'task-chip-empty';
    hint.textContent = 'An diesem Tag gibt es keine Blöcke.';
    chipsWrap.appendChild(hint);
  }
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
  // Nur sichtbar, wenn das aktive Theme eine Tag/Nacht-Version hat und der
  // Umschalter dafür in den Einstellungen an ist (main.js: isDayNightToggleOn).
  document.getElementById('theme-toggle-btn')?.classList.toggle('hidden', !isDayNightToggleOn());
  sunIcon.style.display  = darkMode ? 'none'  : 'block';
  moonIcon.style.display = darkMode ? 'block' : 'none';
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    const label = darkMode ? 'Zur Tagversion wechseln' : 'Zur Nachtversion wechseln';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
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

// Falls der Sonnenauf-/-untergangs-Timer durch Rechner-/Tab-Schlaf
// verpasst wurde: beim Zurückkehren in den Tab über renderWeather() neu
// bestimmen (nutzt den 30-Minuten-Cache, also kein zusätzlicher Request).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') renderWeather();
});


// =========================
// RECHTE SPALTE IN ZWEI STAPEL
// Die Widgets der rechten Spalte (Uhr, Schnellnotiz, Speiseplan,
// Mini-Kalender, „Heute ist“) landen in zwei Container. Standard-CSS
// macht die Container unsichtbar (display: contents + feste order) — das
// Layout aller Themes bleibt wie bisher. Erst css/today-rpg.css stellt
// sie auf breiten Bildschirmen nebeneinander, damit Heute ohne Scrollen
// auf eine Seite passt (today.md: „ohne Scrollen sichtbar“).
// Speiseplan und „Heute ist“ werden später von ihren eigenen Dateien
// angehängt — ein MutationObserver sortiert jedes neue Widget ein.
// =========================
const TODAY_RIGHT_STACKS = {
  'clock-sidebar-panel': 0, 'panel-quicknote': 0, 'today-mini-cal': 0,
  'mealplan-widget': 1, 'national-day-widget': 1,
};
(function initTodayRightStacks() {
  const right = document.getElementById('today-right');
  if (!right) return;
  const stacks = [0, 1].map(i => {
    const el = document.createElement('div');
    el.className = 'today-right-stack';
    el.dataset.stack = i;
    right.appendChild(el);
    return el;
  });
  const sort = () => {
    [...right.children].forEach(child => {
      if (child.classList.contains('today-right-stack')) return;
      const i = TODAY_RIGHT_STACKS[child.id] ?? 1;
      stacks[i].appendChild(child);
    });
  };
  sort();
  new MutationObserver(sort).observe(right, { childList: true });
})();

// =========================
// SUCHQUELLE (js/hub-search.js, AI documentation/search.md) — nur lesen;
// open() springt zum Eintrag über die Funktionen dieses Tabs.
// =========================
registerSearchProvider({
  id: 'tasks', label: 'Aufgaben (Heute)', icon: '✅', view: 'today',
  items: () => tasks.map(t => ({
    id: t.id, icon: t.status === 'completed' ? '✔️' : '▫️', title: t.title || 'Aufgabe',
    sub: 'Aufgaben dieser Woche', text: t.notes || '',
    open: () => { showView('today'); openTaskModal(t); },
  })),
});

// ── Theme-Skins: Heute-Elemente anmelden ────────────────────────────────
// theme-skins.js lädt NACH dieser Datei → Einträge in die Warteschlange
// (theme-skins.js leert sie beim Laden und nimmt danach direkt an).
(window.__pendingSkinTargets = window.__pendingSkinTargets || []).push(...[
  { id: 'today.cards', label: 'Alle Karten', view: 'today', group: true,
    selector: '#view-today :is(.block-slot, #panel-tasks, #gd-widget, #clock-sidebar-panel, #panel-quicknote, #mealplan-widget, #today-mini-cal, #national-day-widget)' },
  { id: 'today.board', label: 'Tafel', view: 'today', selector: '#today-main, #today-right' },
  { id: 'today.banner', label: 'Banner', view: 'today', selector: '#today-main-header' },
  { id: 'today.blocks', label: 'Zeitblöcke', view: 'today', selector: '#blocks-row .block-slot' },
  { id: 'today.tasks', label: 'Aufgaben', view: 'today', selector: '#panel-tasks',
    extras: [{ key: 'ribbon', label: 'Lesezeichen', selector: '> .panel-header::after', kind: 'background' }] },
  { id: 'today.duties', label: 'Pflichten', view: 'today', selector: '#gd-widget' },
  { id: 'today.clock', label: 'Uhr', view: 'today', selector: '#clock-sidebar-panel',
    extras: [
      { key: 'case', label: 'Uhr-Gehäuse', selector: '.rpg-clock-img', kind: 'content' },
      { key: 'face', label: 'Zifferblatt', selector: '.clock-analog', kind: 'background' },
    ] },
  { id: 'today.quicknote', label: 'Schnellnotiz', view: 'today', selector: '#panel-quicknote' },
  { id: 'today.minical', label: 'Mini-Kalender', view: 'today', selector: '#today-mini-cal' },
  { id: 'today.menu', label: 'Speiseplan', view: 'today', selector: '#mealplan-widget' },
  { id: 'today.dayinfo', label: 'Tag-Info', view: 'today', selector: '#national-day-widget' },
]);
