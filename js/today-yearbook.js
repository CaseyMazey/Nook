// =========================
// TODAY — Nook-Jahresbuch (nur lesend)
// Vom 15. Dezember bis Ende Januar liegt auf der Heute-Seite ein kleines Buch
// „Dein Jahr …“: Seite für Seite, was geschafft, gelernt, gespart und
// gewachsen ist. Nur positive Aussagen, keine Ranglisten, kein Teilen.
// Außerhalb dieser Zeit: Einstellungen › Über Nook › „Jahresbuch“.
// Quellen (nur lesen): tasks (completedAt), Projektschritte (completedAt),
// fc_history (flashcards.js), todayFocusLog (today-focus.js), Sparziel-
// Buchungen (budgetOnetime) und budgetGoals, gardenDex (firstSeen),
// dayLines (today-dayline.js).
// Lädt nach today-dayline.js und den Budget-/Garten-Dateien.
// Keys: yearbookSeen (Jahr, dessen Karte geschlossen wurde),
//       yearbooks { [Jahr]: Kennzahlen } — vergangene Jahre werden beim ersten
//       Öffnen eingefroren, damit das Buch gleich bleibt.
// Reiner Teil (NookYearbook): tests/today-yearbook.test.js.
// =========================

const NookYearbook = (() => {
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayOf = v => (v == null || v === '' ? null : iso(new Date(v)));

  // Welches Jahr zeigt die Heute-Seite? 15.–31.12.: das laufende, Januar: das vergangene.
  function seasonYear(today) {
    const [y, m, d] = today.split('-').map(Number);
    if (m === 12 && d >= 15) return y;
    if (m === 1) return y - 1;
    return null;
  }

  function stats({ year, tasks = [], projects = [], fcHistory = {}, focusLog = {}, savings = [], goals = [], gardenDex = {}, dayLines = {} }) {
    const inYear = day => !!day && day.slice(0, 4) === String(year);

    const byMonth = Array(12).fill(0);
    let tasksDone = 0;
    tasks.forEach(t => {
      const d = dayOf(t.completedAt);
      if ((t.status ? t.status === 'completed' : t.done) && inYear(d)) { tasksDone++; byMonth[Number(d.slice(5, 7)) - 1]++; }
    });
    const max = Math.max(...byMonth);
    const busiestMonth = max > 0 ? byMonth.indexOf(max) : null;

    const steps = projects.flatMap(p => [...(p.tasks || []), ...(p.subprojects || []).flatMap(s => s.tasks || [])]);
    const projectSteps = steps.filter(s => s.done && inYear(dayOf(s.completedAt))).length;

    const cardDays = Object.keys(fcHistory).filter(inYear).sort();
    const cardsLearned = cardDays.reduce((s, d) => s + (Number(fcHistory[d].learned) || 0), 0);
    const cardsSince = cardDays.length && cardDays[0] > `${year}-01-31` ? cardDays[0] : null;

    let focusMinutes = 0, focusBest = null;
    Object.entries(focusLog).forEach(([d, m]) => {
      if (!inYear(d)) return;
      const min = Number(m) || 0;
      focusMinutes += min;
      if (!focusBest || min > focusBest.minutes) focusBest = { date: d, minutes: min };
    });

    const saved = Math.round(savings.filter(x => inYear(x.date)).reduce((s, x) => s + x.amount, 0) * 100) / 100;
    const goalsFull = goals.filter(g => Number(g.target) > 0 && Number(g.current) >= Number(g.target)).length;

    const gardenNew = Object.values(gardenDex).filter(e => e && inYear(dayOf(e.firstSeen))).length;

    const lines = Object.keys(dayLines).filter(inYear).sort().map(date => ({ date, ...dayLines[date] }));
    const moods = {};
    lines.forEach(l => { if (l.mood) { const m = Number(l.date.slice(5, 7)) - 1; (moods[m] = moods[m] || []).push(l.mood); } });
    let sunniestMonth = null, bestAvg = 0;
    Object.entries(moods).forEach(([m, list]) => {
      if (list.length < 3) return;
      const avg = list.reduce((a, b) => a + b, 0) / list.length;
      if (avg > bestAvg) { bestAvg = avg; sunniestMonth = Number(m); }
    });
    const withText = lines.filter(l => l.text);
    const picks = pickSpread(withText, 5).map(l => ({ date: l.date, text: l.text, mood: l.mood || null }));

    return {
      year, tasksDone, busiestMonth, projectSteps,
      cardsLearned, cardDays: cardDays.length, cardsSince,
      focusMinutes, focusBest,
      saved, goalsFull, gardenNew,
      lineCount: lines.length, sunniestMonth, picks,
    };
  }

  // n Einträge gleichmäßig über die Liste verteilt
  function pickSpread(list, n) {
    if (list.length <= n) return list.slice();
    const out = [];
    for (let i = 0; i < n; i++) out.push(list[Math.round(i * (list.length - 1) / (n - 1))]);
    return out;
  }

  // Seiten nur mit Inhalt → [{ kind, … }]
  function pages(s) {
    const out = [{ kind: 'title' }];
    if (s.tasksDone || s.projectSteps) out.push({ kind: 'tasks' });
    if (s.cardsLearned) out.push({ kind: 'cards' });
    if (s.focusMinutes >= 1) out.push({ kind: 'focus' });
    if (s.saved > 0 || s.goalsFull) out.push({ kind: 'saved' });
    if (s.gardenNew) out.push({ kind: 'garden' });
    if (s.lineCount) out.push({ kind: 'lines' });
    if (out.length === 1) out.push({ kind: 'quiet' });
    out.push({ kind: 'end' });
    return out;
  }

  const hours = min => {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h ? `${h} Std.${m ? ` ${m} Min.` : ''}` : `${m} Min.`;
  };

  return { seasonYear, stats, pages, pickSpread, hours };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NookYearbook;

// =========================
// ANZEIGE (nur im Browser)
// =========================
if (typeof document !== 'undefined') (function initYearbook() {
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const longDate = d => fmt(parseLocalDate(d), { day: 'numeric', month: 'long' });
  const euro = v => (typeof fmtEuro === 'function' ? fmtEuro(v) : `${v} €`);

  // Sparziel-Einzahlungen (wie im Wochenrückblick): „Sparziel — …“ minus „Aus Sparziel — …“
  function savings() {
    if (typeof budgetOnetime === 'undefined') return [];
    return budgetOnetime.filter(e => e.paid && /^(Aus )?Sparziel — /.test(e.name || '')).map(e => ({
      date: `${e.monthKey}-${String(e.day || 1).padStart(2, '0')}`,
      amount: /^Aus /.test(e.name) ? -e.amount : e.amount,
    }));
  }

  function liveStats(year) {
    return NookYearbook.stats({
      year,
      tasks: Array.isArray(tasks) ? tasks : [],
      projects: typeof projects !== 'undefined' && Array.isArray(projects) ? projects : [],
      fcHistory: DB.get('fc_history', {}),
      focusLog: DB.get('todayFocusLog', {}),
      savings: savings(),
      goals: typeof budgetGoals !== 'undefined' ? budgetGoals : [],
      gardenDex: typeof gardenDex !== 'undefined' ? gardenDex : {},
      dayLines: typeof window.getDayLines === 'function' ? window.getDayLines() : DB.get('dayLines', {}),
    });
  }

  // Vergangene Jahre einfrieren (ab dem ersten Öffnen bleibt das Buch gleich)
  function statsFor(year) {
    const now = new Date().getFullYear();
    if (year >= now) return { ...liveStats(year), live: true };
    const store = DB.get('yearbooks', {});
    if (!store[year]) { store[year] = liveStats(year); DB.set('yearbooks', store); }
    return store[year];
  }

  // Jahre mit Daten (fürs Auswählen unter Einstellungen), plus das laufende
  function availableYears() {
    const years = new Set([new Date().getFullYear()]);
    const add = d => { if (d) years.add(Number(String(d).slice(0, 4))); };
    Object.keys(DB.get('fc_history', {})).forEach(add);
    Object.keys(DB.get('todayFocusLog', {})).forEach(add);
    Object.keys(DB.get('dayLines', {})).forEach(add);
    Object.keys(DB.get('yearbooks', {})).forEach(add);
    (Array.isArray(tasks) ? tasks : []).forEach(t => { if (t.completedAt) add(dateKey(new Date(t.completedAt))); });
    return [...years].filter(y => y > 2000).sort((a, b) => b - a);
  }

  function pageHtml(p, s) {
    const name = typeof userName !== 'undefined' && userName ? userName : '';
    switch (p.kind) {
      case 'title': return `
        <div class="yb-kicker">Nook · Jahresbuch</div>
        <div class="yb-title">Dein Jahr ${s.year}</div>
        <div class="yb-sub">${name ? `für ${escHtml(name)} · ` : ''}${s.live ? 'bis heute' : 'ein kleiner Rückblick'}</div>
        <div class="yb-ornament" aria-hidden="true">❦</div>`;
      case 'tasks': return `
        <div class="yb-kicker">Geschafft</div>
        <div class="yb-big">${s.tasksDone}</div>
        <div class="yb-label">${s.tasksDone === 1 ? 'Aufgabe erledigt' : 'Aufgaben erledigt'}</div>
        ${s.busiestMonth != null ? `<p>Am meisten hast du im <b>${MONTHS[s.busiestMonth]}</b> geschafft.</p>` : ''}
        ${s.projectSteps ? `<p>Dazu ${s.projectSteps === 1 ? 'ein Schritt' : `${s.projectSteps} Schritte`} in deinen Projekten.</p>` : ''}`;
      case 'cards': return `
        <div class="yb-kicker">Gelernt</div>
        <div class="yb-big">${s.cardsLearned}</div>
        <div class="yb-label">Karteikarten gelernt</div>
        <p>an ${s.cardDays === 1 ? 'einem Tag' : `${s.cardDays} Tagen`}.</p>
        ${s.cardsSince ? `<p class="yb-note">Gezählt seit ${longDate(s.cardsSince)}.</p>` : ''}`;
      case 'focus': return `
        <div class="yb-kicker">Fokus</div>
        <div class="yb-big">${NookYearbook.hours(s.focusMinutes)}</div>
        <div class="yb-label">Fokuszeit</div>
        ${s.focusBest ? `<p>Dein längster Fokustag: <b>${longDate(s.focusBest.date)}</b> (${NookYearbook.hours(s.focusBest.minutes)})</p>` : ''}`;
      case 'saved': return `
        <div class="yb-kicker">Gespart</div>
        ${s.saved > 0 ? `<div class="yb-big">${euro(s.saved)}</div><div class="yb-label">in deine Sparziele gelegt</div>` : ''}
        ${s.goalsFull ? `<p>${s.goalsFull === 1 ? 'Ein Sparziel ist' : `${s.goalsFull} Sparziele sind`} voll. 🌱</p>` : ''}`;
      case 'garden': return `
        <div class="yb-kicker">Gewachsen</div>
        <div class="yb-big">${s.gardenNew}</div>
        <div class="yb-label">${s.gardenNew === 1 ? 'neue Pflanze' : 'neue Pflanzen'} im Garten entdeckt</div>`;
      case 'lines': return `
        <div class="yb-kicker">Deine Zeilen</div>
        <div class="yb-big">${s.lineCount}</div>
        <div class="yb-label">${s.lineCount === 1 ? 'Zeile' : 'Zeilen'} geschrieben</div>
        ${s.sunniestMonth != null ? `<p>Dein sonnigster Monat: <b>${MONTHS[s.sunniestMonth]}</b> ☀️</p>` : ''}
        ${s.picks.length ? `<ul class="yb-quotes">${s.picks.map(q => `<li><span>${escHtml(longDate(q.date))}</span> ${escHtml(q.text)}</li>`).join('')}</ul>` : ''}`;
      case 'quiet': return `
        <div class="yb-kicker">${s.year}</div>
        <div class="yb-title yb-title-sm">Ein ruhiges Jahr.</div>
        <p>Auch das zählt.</p>`;
      case 'end': return `
        <div class="yb-ornament" aria-hidden="true">🌿</div>
        <div class="yb-title yb-title-sm">Schön, dass du dir Zeit für dich genommen hast.</div>
        <p class="yb-note">Bis zum nächsten Jahr.</p>`;
    }
    return '';
  }

  // =========================
  // DAS BUCH (Overlay, Seite für Seite)
  // =========================
  let overlay = null, onKey = null;

  function closeBook() {
    overlay?.remove(); overlay = null;
    if (onKey) document.removeEventListener('keydown', onKey);
    onKey = null;
  }

  window.openYearbook = function (year) {
    closeBook();
    const s = statsFor(year);
    const list = NookYearbook.pages(s);
    let i = 0;
    overlay = document.createElement('div');
    overlay.className = 'yearbook-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Jahresbuch ${year}`);
    overlay.innerHTML = `
      <div class="yearbook-book">
        <button type="button" class="yearbook-close" aria-label="Jahresbuch schließen">✕</button>
        <div class="yearbook-page" aria-live="polite"></div>
        <div class="yearbook-nav">
          <button type="button" class="yearbook-arrow" data-dir="-1" aria-label="Vorherige Seite">‹</button>
          <div class="yearbook-dots"></div>
          <button type="button" class="yearbook-arrow" data-dir="1" aria-label="Nächste Seite">›</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const page = overlay.querySelector('.yearbook-page');
    const dots = overlay.querySelector('.yearbook-dots');

    const show = n => {
      i = Math.max(0, Math.min(list.length - 1, n));
      page.innerHTML = `<div class="yearbook-page-inner yb-${list[i].kind}">${pageHtml(list[i], s)}</div>`;
      dots.innerHTML = list.map((_, k) => `<button type="button" class="yearbook-dot${k === i ? ' active' : ''}" data-page="${k}" aria-label="Seite ${k + 1}"></button>`).join('');
      dots.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => show(Number(b.dataset.page))));
      overlay.querySelector('[data-dir="-1"]').disabled = i === 0;
      overlay.querySelector('[data-dir="1"]').disabled = i === list.length - 1;
    };
    overlay.querySelectorAll('.yearbook-arrow').forEach(b => b.addEventListener('click', () => show(i + Number(b.dataset.dir))));
    overlay.querySelector('.yearbook-close').addEventListener('click', closeBook);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeBook(); });
    onKey = e => {
      if (e.key === 'Escape') closeBook();
      else if (e.key === 'ArrowRight') show(i + 1);
      else if (e.key === 'ArrowLeft') show(i - 1);
    };
    document.addEventListener('keydown', onKey);
    // Wischen
    let startX = null;
    page.addEventListener('pointerdown', e => { startX = e.clientX; });
    page.addEventListener('pointerup', e => {
      if (startX == null) return;
      const dx = e.clientX - startX; startX = null;
      if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
    });
    show(0);
    overlay.querySelector('[data-dir="1"]').focus();
  };

  // =========================
  // KARTE AUF DER HEUTE-SEITE (15.12. – 31.1.)
  // =========================
  window.renderTodayYearbook = function () {
    const year = NookYearbook.seasonYear(dateKey(new Date()));
    let el = document.getElementById('today-yearbook');
    if (year == null || DB.get('yearbookSeen', null) === year) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'today-yearbook';
      el.className = 'panel today-yearbook';
      const anchor = document.getElementById('today-review') || document.getElementById('today-welcome');
      if (anchor) anchor.after(el);
      else document.getElementById('today-main-header')?.after(el);
    }
    el.innerHTML = `
      <button type="button" class="today-yearbook-open" id="today-yearbook-open">
        <span class="today-yearbook-cover" aria-hidden="true">📖</span>
        <span><b>Dein Jahr ${year}</b><span class="today-yearbook-sub">Dein Jahresbuch liegt bereit – aufschlagen</span></span>
      </button>
      <button type="button" class="today-yearbook-x" title="Ausblenden (bleibt unter Einstellungen › Über Nook)" aria-label="Jahresbuch-Karte ausblenden">✕</button>`;
    el.querySelector('#today-yearbook-open').addEventListener('click', () => window.openYearbook(year));
    el.querySelector('.today-yearbook-x').addEventListener('click', () => { DB.set('yearbookSeen', year); el.remove(); });
  };

  // Einstellungen › Über Nook
  window.renderYearbookSettings = function () {
    const sel = document.getElementById('about-yearbook-year');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = availableYears().map(y => `<option value="${y}">${y}${y === new Date().getFullYear() ? ' (bis heute)' : ''}</option>`).join('');
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
  };
  document.getElementById('about-yearbook-open')?.addEventListener('click', () => {
    const sel = document.getElementById('about-yearbook-year');
    if (sel && sel.value) window.openYearbook(Number(sel.value));
  });

  window.renderTodayYearbook();
})();
