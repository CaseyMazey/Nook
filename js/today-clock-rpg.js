// =========================
// TODAY — Astronomische Taschenuhr (nur RPG-Heute-Stil)
// Ersetzt im Stil data-today-style="rpg" das schlichte Zifferblatt des
// Uhr-Widgets (#clock-sidebar-panel) durch eine gezeichnete Taschenuhr
// (assets/today/rpg-clock.webp, generiert, Ziffern im Bild). Darüber als
// SVG: Stunden-/Minutenzeiger, die ECHTE Mondphase (getMoonPhase, calendar.js) des Tages und ein
// Sternenfeld, das sich wie der Nachthimmel einmal pro Sterntag dreht.
// renderSidebarClock() (today.js) ruft renderRpgClock() einmal pro Minute
// auf; das Markup wird nur beim ersten Mal gebaut, danach werden nur
// Winkel/Mond aktualisiert (damit die Drehung des Himmels flüssig bleibt).
// Lädt nach calendar.js und today.js. Farben der Zeiger/des Mondes sind Teil der
// Illustration (CLAUDE.md-Ausnahme) und stehen in css/today-rpg.css.
// =========================

// Geometrie des Bildes (Pixel in rpg-clock.webp, 580×785): Mittelpunkt
// des Zifferblatts, Radius des Sternenfelds, Innenkante des Ziffernrings.
const RPG_CLOCK = { w: 580, h: 785, cx: 290, cy: 482, sky: 158, ring: 166 };

// Mondphase: getMoonPhase() aus calendar.js (lädt vorher) — dieselbe
// Näherungsformel wie die Mondzeile im Kalender.

// Beleuchteter Teil als Pfad (Nordhalbkugel: zunehmend rechts hell).
// Außenbogen über die helle Seite, zurück über die Terminator-Ellipse.
function rpgMoonPath(p, cx, cy, r) {
  const waxing = p < 0.5;
  const rx = Math.abs(Math.cos(2 * Math.PI * p)) * r;
  const outerSweep = waxing ? 1 : 0;
  const termSweep = waxing ? (p < 0.25 ? 0 : 1) : (p < 0.75 ? 0 : 1);
  const f = v => v.toFixed(2);
  return `M ${f(cx)} ${f(cy - r)} A ${f(r)} ${f(r)} 0 0 ${outerSweep} ${f(cx)} ${f(cy + r)}`
       + ` A ${f(rx)} ${f(r)} 0 0 ${termSweep} ${f(cx)} ${f(cy - r)} Z`;
}

function buildRpgClockMarkup() {
  const { w, h, cx, cy } = RPG_CLOCK;
  const pct = v => (v * 100).toFixed(3) + '%';
  // Sternenfeld: Ausschnitt desselben Bildes, kreisförmig beschnitten und
  // um den Zifferblatt-Mittelpunkt drehbar
  const skyD = RPG_CLOCK.sky * 2;
  const skyStyle = `left:${pct((cx - RPG_CLOCK.sky) / w)};top:${pct((cy - RPG_CLOCK.sky) / h)};`
    + `width:${pct(skyD / w)};height:${pct(skyD / h)};`
    + `background-size:${pct(w / skyD)} ${pct(h / skyD)};`
    + `background-position:${pct((cx - RPG_CLOCK.sky) / (w - skyD))} ${pct((cy - RPG_CLOCK.sky) / (h - skyD))};`;
  const moonY = cy + 82, moonR = 27;
  return `
    <div class="rpg-clock-art">
      <img class="rpg-clock-img" src="assets/today/rpg-clock.webp" alt="" draggable="false"/>
      <div class="rpg-clock-sky" style="${skyStyle}"></div>
      <svg class="rpg-clock-svg" viewBox="0 0 ${w} ${h}" aria-hidden="true">
        <g class="rpg-clock-moon">
          <circle class="rpg-moon-dark" cx="${cx}" cy="${moonY}" r="${moonR}"/>
          <path class="rpg-moon-lit" d=""/>
          <circle class="rpg-moon-rim" cx="${cx}" cy="${moonY}" r="${moonR}"/>
        </g>
        <g class="rpg-hand rpg-hand-hour" transform="rotate(0 ${cx} ${cy})">
          <path class="rpg-hand-metal" d="M ${cx - 6} ${cy + 18} L ${cx - 4} ${cy - 55} L ${cx} ${cy - 104} L ${cx + 4} ${cy - 55} L ${cx + 6} ${cy + 18} Z"/>
          <path class="rpg-hand-gold" d="M ${cx} ${cy - 92} L ${cx - 7} ${cy - 76} L ${cx} ${cy - 62} L ${cx + 7} ${cy - 76} Z"/>
        </g>
        <g class="rpg-hand rpg-hand-minute" transform="rotate(0 ${cx} ${cy})">
          <path class="rpg-hand-metal" d="M ${cx - 4} ${cy + 24} L ${cx - 2.5} ${cy - 110} L ${cx} ${cy - 150} L ${cx + 2.5} ${cy - 110} L ${cx + 4} ${cy + 24} Z"/>
          <path class="rpg-hand-gold" d="M ${cx} ${cy - 158} L ${cx - 6} ${cy - 140} L ${cx} ${cy - 128} L ${cx + 6} ${cy - 140} Z"/>
        </g>
        <circle class="rpg-hand-cap" cx="${cx}" cy="${cy}" r="10"/>
        <circle class="rpg-hand-cap-dot" cx="${cx}" cy="${cy}" r="3.5"/>
      </svg>
    </div>
    <div class="rpg-clock-label">
      <div class="rpg-clock-weekday"></div>
      <div class="rpg-clock-date"></div>
      <div class="rpg-clock-moon-name"></div>
    </div>`;
}

function renderRpgClock(panel, now) {
  let root = panel.querySelector('.rpg-clock');
  const first = !root;
  if (first) {
    panel.innerHTML = `<div class="rpg-clock">${buildRpgClockMarkup()}</div>`;
    root = panel.querySelector('.rpg-clock');
  }
  const { cx, cy } = RPG_CLOCK;
  const h = now.getHours(), mi = now.getMinutes();
  root.querySelector('.rpg-hand-hour').setAttribute('transform', `rotate(${(h % 12) * 30 + mi * 0.5} ${cx} ${cy})`);
  root.querySelector('.rpg-hand-minute').setAttribute('transform', `rotate(${mi * 6} ${cx} ${cy})`);

  // Himmel: eine Umdrehung pro Sterntag (23 h 56 min), über die Minute per
  // CSS-Übergang weich weitergedreht — beim ersten Aufbau ohne Übergang.
  const sky = root.querySelector('.rpg-clock-sky');
  const minOfDay = h * 60 + mi + now.getSeconds() / 60;
  sky.style.transition = first ? 'none' : '';
  sky.style.transform = `rotate(${(minOfDay / 1436.07 * 360).toFixed(3)}deg)`;

  const moon = getMoonPhase(now);
  root.querySelector('.rpg-moon-lit').setAttribute('d', rpgMoonPath(moon.phase, cx, cy + 82, 27));
  const moonName = moon.label;

  const hh = String(h).padStart(2, '0'), mm = String(mi).padStart(2, '0');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', `${hh}:${mm} Uhr, ${moonName}`);
  root.title = `${hh}:${mm} · ${moonName}`;
  root.querySelector('.rpg-clock-weekday').textContent = now.toLocaleDateString('de-DE', { weekday: 'long' });
  root.querySelector('.rpg-clock-date').textContent = now.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  root.querySelector('.rpg-clock-moon-name').textContent = '☾ ' + moonName;

  // Volle Stunde: kurzes goldenes Aufleuchten
  if (mi === 0 && !first) {
    root.classList.remove('rpg-clock-chime');
    void root.offsetWidth;
    root.classList.add('rpg-clock-chime');
  }
}
