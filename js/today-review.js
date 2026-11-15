// =========================
// TODAY — Wochenrückblick (nur lesend)
// Samstag bis Montag eine ruhige Karte unter der Begrüßung: was in der Woche
// geschafft wurde (Aufgaben, Karteikarten, Fokuszeit, Gespartes) und was die
// nächste Woche bringt (Termine, Prüfungen, Budget-Posten). Samstag/Sonntag
// zeigen die laufende Woche, Montag die vergangene. Liest nur aus den anderen
// Bereichen (today.md: keine fremden Funktionen übernehmen), ✕ blendet die
// Karte für diese Woche aus (todayReviewSeen).
// Lädt nach today.js, calendar.js, flashcards*.js, budget*.js, today-focus.js.
// Keys: todayReview (an/aus), todayReviewSeen (Wochenstart der ausgeblendeten Woche).
// Reiner Teil (NookReview) ohne DOM: tests/today-review.test.js.
// =========================

const NookReview = (() => {
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };

  // Welche Woche zeigen? Sa/So: die laufende, Mo: die vergangene, sonst keine.
  // → { start, end, nextStart, nextEnd } (ISO-Daten, Montag bis Sonntag) oder null.
  function reviewWeek(today) {
    const d = parse(today);
    const dow = (d.getDay() + 6) % 7; // 0 = Montag
    let start;
    if (dow >= 5) start = addDays(today, -dow);
    else if (dow === 0) start = addDays(today, -7);
    else return null;
    const end = addDays(start, 6);
    return { start, end, nextStart: addDays(end, 1), nextEnd: addDays(end, 7) };
  }

  const inRange = (day, w) => day >= w.start && day <= w.end;
  const dayOfStamp = v => (v == null || v === '' ? null : iso(new Date(v)));

  // Kennzahlen der Woche. Eingaben sind schlichte Listen, damit das ohne DOM testbar bleibt.
  function stats({ week, tasks = [], cards = [], focusLog = {}, savings = [] }) {
    const tasksDone = tasks.filter(t => { const d = dayOfStamp(t.completedAt); return d && inRange(d, week); }).length;
    const cardsLearned = cards.filter(c => { const d = dayOfStamp(c.lastSeen); return d && inRange(d, week); }).length;
    const focusMinutes = Object.entries(focusLog).filter(([d]) => inRange(d, week)).reduce((s, [, m]) => s + (Number(m) || 0), 0);
    const saved = Math.round(savings.filter(x => inRange(x.date, week)).reduce((s, x) => s + x.amount, 0) * 100) / 100;
    return { tasksDone, cardsLearned, focusMinutes, saved };
  }

  const hours = min => {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h ? `${h} Std.${m ? ` ${m} Min.` : ''}` : `${m} Min.`;
  };

  // Satzbausteine für „Diese Woche“: nur, was nicht null ist.
  function doneParts(s, euro) {
    const p = [];
    if (s.tasksDone) p.push(`✓ ${s.tasksDone} ${s.tasksDone === 1 ? 'Aufgabe' : 'Aufgaben'} erledigt`);
    if (s.cardsLearned) p.push(`📚 ${s.cardsLearned} ${s.cardsLearned === 1 ? 'Karte' : 'Karten'} gelernt`);
    if (s.focusMinutes >= 1) p.push(`🎯 ${hours(s.focusMinutes)} Fokus`);
    if (s.saved > 0) p.push(`🌱 ${euro(s.saved)} gespart`);
    return p;
  }

  return { reviewWeek, stats, doneParts, hours, addDays };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NookReview;

// =========================
// ANZEIGE (nur im Browser)
// =========================
if (typeof document !== 'undefined') (function initReview() {
  let todayReview = DB.get('todayReview', true);
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const short = s => { const [y, m, d] = s.split('-').map(Number); return `${WD[new Date(y, m - 1, d).getDay()]} ${d}.${m}.`; };

  // Sparziel-Einzahlungen der Woche: erledigte Einmalbuchungen „Sparziel — …“ minus „Aus Sparziel — …“
  // (budget.js: bookKontostandMovement legt sie beim Einzahlen/Abheben mit „Kontostand anpassen“ an).
  function savings() {
    if (typeof budgetOnetime === 'undefined') return [];
    return budgetOnetime.filter(e => e.paid && /^(Aus )?Sparziel — /.test(e.name || '')).map(e => ({
      date: `${e.monthKey}-${String(e.day || 1).padStart(2, '0')}`,
      amount: /^Aus /.test(e.name) ? -e.amount : e.amount,
    }));
  }

  function allCardsSafe() {
    if (typeof subjects === 'undefined') return [];
    return subjects.flatMap(s => (s.groups || []).flatMap(g => g.cards || []));
  }

  // Nächste Woche: Termine (ohne Prüfungs-Countdowns, die stehen eigens), Prüfungen, Budget-Ausgaben.
  function upcoming(w) {
    const out = { events: [], exams: [], budget: [] };
    const days = [];
    for (let i = 0; i < 7; i++) days.push(NookReview.addDays(w.nextStart, i));
    const examIds = new Set();
    if (typeof subjects !== 'undefined' && typeof fcLinkedCountdown === 'function') {
      subjects.forEach(s => [...(s.exams || []), ...(s.groups || [])].forEach(o => {
        const c = fcLinkedCountdown(o);
        if (c && c.key >= w.nextStart && c.key <= w.nextEnd) { out.exams.push({ name: o.name, date: c.key }); examIds.add(c.id); }
      }));
    }
    if (typeof getEventsForDay === 'function') {
      const seen = new Set();
      days.forEach(d => getEventsForDay(parseLocalDate(d)).forEach(({ ev }) => {
        const id = ev.seriesId ? `${ev.seriesId}|${d}` : (ev.id || ev.title);
        if (seen.has(id) || examIds.has(ev.id)) return;
        seen.add(id);
        out.events.push({ title: ev.title || 'Termin', date: d });
      }));
    }
    if (typeof budgetRecurring !== 'undefined') {
      const months = [...new Set(days.map(d => d.slice(0, 7)))];
      months.forEach(mk => {
        const [y, m] = mk.split('-').map(Number);
        budgetRecurring.forEach(r => {
          if (r.type !== 'expense' || r.freq === 'daily' || isRecurringPaid(r.id, mk)) return;
          recurringOccurrencesInMonth(r, y, m).forEach(o => { if (days.includes(o.date)) out.budget.push({ name: r.name, amount: o.amount, date: o.date }); });
        });
        budgetOnetime.forEach(e => {
          const d = `${mk}-${String(e.day || 1).padStart(2, '0')}`;
          if (e.monthKey === mk && e.type === 'expense' && !e.paid && days.includes(d)) out.budget.push({ name: e.name, amount: e.amount, date: d });
        });
      });
      out.budget.sort((a, b) => b.amount - a.amount);
    }
    return out;
  }

  window.renderTodayReview = function () {
    const block = document.getElementById('today-greeting-block');
    if (!block) return;
    let el = document.getElementById('today-review');
    const w = todayReview ? NookReview.reviewWeek(dateKey(new Date())) : null;
    if (!w || DB.get('todayReviewSeen', null) === w.start) { el?.remove(); return; }
    const s = NookReview.stats({ week: w, tasks: Array.isArray(tasks) ? tasks : [], cards: allCardsSafe(), focusLog: DB.get('todayFocusLog', {}), savings: savings() });
    const done = NookReview.doneParts(s, typeof fmtEuro === 'function' ? fmtEuro : v => `${v} €`);
    const up = upcoming(w);
    const next = [];
    if (up.events.length) next.push(`📅 ${up.events.length} ${up.events.length === 1 ? 'Termin' : 'Termine'}: ${up.events.slice(0, 3).map(e => `${escHtml(e.title)} (${short(e.date)})`).join(', ')}${up.events.length > 3 ? ' …' : ''}`);
    up.exams.forEach(x => next.push(`📚 Prüfung ${escHtml(x.name)} am ${short(x.date)}`));
    if (up.budget.length) {
      const sum = up.budget.reduce((t, b) => t + b.amount, 0);
      next.push(`💶 ${fmtEuro(sum)} an Ausgaben, u.a. ${up.budget.slice(0, 2).map(b => `${escHtml(b.name)} (${short(b.date)})`).join(', ')}`);
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'today-review';
      el.className = 'today-review';
      // volle Breite unter Begrüßung + Wetter, über dem Stundenplan
      const header = document.getElementById('today-main-header');
      header ? header.after(el) : block.appendChild(el);
    }
    const kw = typeof getISOWeek === 'function' ? getISOWeek(parseLocalDate(w.start)) : '';
    el.innerHTML = `
      <div class="today-review-head">
        <span class="today-review-title">🌿 Deine Woche${kw ? ` · KW ${kw}` : ''}</span>
        <button type="button" class="today-review-x" title="Für diese Woche ausblenden" aria-label="Wochenrückblick ausblenden">✕</button>
      </div>
      <div class="today-review-done">${done.length ? done.map(p => `<span>${p}</span>`).join('') : '<span>Eine ruhige Woche. Auch das zählt.</span>'}</div>
      ${next.length ? `<div class="today-review-next"><div class="today-review-label">Nächste Woche</div>${next.map(n => `<div>${n}</div>`).join('')}</div>` : ''}`;
    el.querySelector('.today-review-x').addEventListener('click', () => { DB.set('todayReviewSeen', w.start); el.remove(); });
  };

  window.renderTodayReviewSettings = function () {
    const t = document.getElementById('setting-today-review');
    if (t) t.checked = !!todayReview;
  };
  document.getElementById('setting-today-review')?.addEventListener('change', e => {
    todayReview = e.target.checked;
    DB.set('todayReview', todayReview);
    window.renderTodayReview();
  });

  window.renderTodayReview();
})();
