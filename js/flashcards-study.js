// =========================
// FLASHCARDS — Lernalltag: Tagesrunden, Lesemodus, Prüfungsplan, Zeitmodus
//
// Lade-Reihenfolge: main.js (subjects, state, DB) -> hub-utils.js (wireModal)
// -> calendar.js (getCountdownItems, nur lesend) -> flashcards.js
// (startGroupsLearnSession, fcRenderBack, uniqueCardsByFront, positionMenu)
// -> flashcards-import.js -> flashcards-exams.js -> flashcards-study.js
// Alles wird erst zur Laufzeit aufgerufen, nicht beim Laden.
//
// Daten:
// - 'fc_day' = { date, rounds: { "<Themen-IDs>": [{ correct, answered, size, wrongIds }] },
//   misses: { cardId: Anzahl } } — gilt nur für heute, am nächsten Tag leer
// - 'fc_read_pos' = { "<Themen-IDs>": cardId } — Lesestelle je Thema/Prüfung
// - 'fc_read_cover' = Antworten im Lesemodus verdecken
// - exam.countdownId / group.countdownId = verbundener Countdown (in 'subjects')
// =========================

function fcTargetKey(groupIds){ return [...groupIds].sort().join('|'); }

// ---------- Tagesrunden ----------

function getFcDay(){
  const today = getTodayStr();
  const d = DB.get('fc_day', null);
  return d && d.date === today ? d : { date: today, rounds: {}, misses: {} };
}

function fcRounds(groupIds){ return getFcDay().rounds[fcTargetKey(groupIds)] || []; }
function fcNextRound(groupIds){ return fcRounds(groupIds).length + 1; }
// Falsche Karten der letzten Runde = „die unsicheren“
function fcUnsureIds(groupIds){ return fcRounds(groupIds).at(-1)?.wrongIds || []; }

function recordFcRound(groupIds, round){
  const d = getFcDay();
  const key = fcTargetKey(groupIds);
  (d.rounds[key] ||= []).push(round);
  DB.set('fc_day', d);
}

function recordFcMiss(cardId){
  const d = getFcDay();
  d.misses[cardId] = (d.misses[cardId] || 0) + 1;
  DB.set('fc_day', d);
}

// Heute mehrfach falsch: wird markiert und im Lesemodus zuerst gezeigt
function isFcWeak(cardId, day = getFcDay()){ return (day.misses[cardId] || 0) >= 2; }

function fcRoundsHtml(groupIds){
  const rounds = fcRounds(groupIds);
  if(!rounds.length) return '';
  return `<div class="fc-rounds"><span class="fc-rounds-label">Heute:</span> ${rounds.map((r, i) =>
    `<span class="fc-round">Runde ${i + 1} <b>${r.correct}/${r.size}</b></span>`).join('<span class="fc-round-sep">·</span>')}</div>`;
}

// ---------- Prüfungsplan ----------

function fcLinkedCountdown(obj){
  if(!obj.countdownId || typeof getCountdownItems !== 'function') return null;
  return getCountdownItems().find(c => c.id === obj.countdownId) || null;
}

// Bis zum Termin alle Karten verteilen: je Tag Karten ÷ verbleibende Tage,
// zuerst niedrige Boxen und am längsten nicht gesehene. Morgen/heute = alle.
function fcPlanFor(cards, item){
  const today = getTodayStr();
  const seenToday = c => c.lastSeen && dateKey(new Date(c.lastSeen)) === today;
  const done = cards.filter(seenToday).length;
  const pool = cards.filter(c => !seenToday(c)).sort((a, b) =>
    (a.box||1) - (b.box||1) || String(a.lastSeen || '').localeCompare(String(b.lastSeen || '')));
  const target = Math.ceil(cards.length / Math.max(item.daysLeft, 1));
  const ids = pool.slice(0, Math.max(0, target - done)).map(c => c.id);
  return { target, done, ids };
}

function fcDaysText(n){ return n === 0 ? 'heute' : n === 1 ? 'morgen' : `noch ${n} Tage`; }

// Plan-Zeile für Thema oder Prüfung; verdrahtet den Knopf direkt
function buildFcPlanRow(subj, obj, groupIds, exam, cards){
  const item = fcLinkedCountdown(obj);
  if(!item) return null;
  const plan = fcPlanFor(cards, item);
  const row = document.createElement('div');
  row.className = 'fc-plan';
  const text = document.createElement('span');
  text.className = 'fc-plan-text';
  text.textContent = `📅 ${item.title} · ${fcDaysText(item.daysLeft)} · heute ${Math.min(plan.done, plan.target)} von ${plan.target}`;
  row.appendChild(text);
  if(plan.ids.length){
    const btn = document.createElement('button');
    btn.className = 'btn-primary fc-plan-btn';
    btn.textContent = `🎯 Tagesziel (${plan.ids.length})`;
    btn.addEventListener('click', () => startGroupsLearnSession(subj.id, groupIds, exam, { mode: 'plan', cardIds: plan.ids }));
    row.appendChild(btn);
  } else {
    const ok = document.createElement('span');
    ok.className = 'fc-plan-done';
    ok.textContent = '✓ Tagesziel geschafft';
    row.appendChild(ok);
  }
  return row;
}

let fcCountdownContext = null; // { subjId, examId?, groupId? }
const fcCountdownModal = wireModal('fc-countdown-modal-overlay', {
  closeIds: ['fc-countdown-modal-close', 'fc-countdown-modal-cancel'],
  onClose: () => { fcCountdownContext = null; },
});

function fcCountdownTarget(ctx){
  const subj = subjects.find(s => s.id === ctx?.subjId);
  if(!subj) return {};
  const obj = ctx.examId ? (subj.exams || []).find(e => e.id === ctx.examId) : subj.groups.find(g => g.id === ctx.groupId);
  return { subj, obj };
}

function openFcCountdownModal(subj, { examId = null, groupId = null }){
  fcCountdownContext = { subjId: subj.id, examId, groupId };
  const { obj } = fcCountdownTarget(fcCountdownContext);
  if(!obj) return;
  const items = typeof getCountdownItems === 'function' ? getCountdownItems() : [];
  const sel = document.getElementById('fc-countdown-select');
  sel.innerHTML = '<option value="">Keine Verbindung</option>' + items.map(c =>
    `<option value="${escHtml(c.id)}">${escHtml(c.title)} (${fcDaysText(c.daysLeft)})</option>`).join('');
  sel.value = items.some(c => c.id === obj.countdownId) ? obj.countdownId : '';
  document.getElementById('fc-countdown-name').textContent = obj.name;
  document.getElementById('fc-countdown-empty').classList.toggle('hidden', items.length > 0);
  fcCountdownModal.open();
}

document.getElementById('fc-countdown-modal-save').addEventListener('click', () => {
  const { subj, obj } = fcCountdownTarget(fcCountdownContext);
  if(!obj) return;
  const id = document.getElementById('fc-countdown-select').value;
  if(id) obj.countdownId = id; else delete obj.countdownId;
  saveSubjects();
  fcCountdownModal.close();
  renderGroupList(subj); renderExamList(subj);
});

// ---------- Zeitmodus ----------

function openFcTimeMenu(subj, groupIds, exam, anchor){
  closeAllMenus();
  const menu = document.createElement('div');
  menu.className = 'fc-context-menu';
  menu.innerHTML = [2, 5, 10, 15, 20].map(m => `<button class="fc-menu-item" data-min="${m}">⏱ ${m} Minuten</button>`).join('');
  menu.querySelectorAll('[data-min]').forEach(btn => btn.addEventListener('click', () => {
    closeAllMenus();
    startGroupsLearnSession(subj.id, groupIds, exam, { mode: 'timed', minutes: +btn.dataset.min });
  }));
  positionMenu(menu, anchor);
}

// ---------- Lesemodus ----------

let fcRead = null; // { subjId, groupIds, exam, onScroll, saveTimer }

function openFcRead(subjId, groupIds, exam){
  const subj = subjects.find(s => s.id === subjId);
  if(!subj) return;
  const groups = subj.groups.filter(g => groupIds.includes(g.id));
  closeFcRead();
  const panel = document.getElementById('fc-read-panel');
  const day = getFcDay();
  const covered = DB.get('fc_read_cover', false);
  const seen = new Set();
  const cardHtml = (c, weak) => `
    <article class="fc-read-card${weak ? ' fc-read-card-weak' : ''}" data-card-id="${c.id}">
      <h4 class="fc-read-front">${escHtml(c.front)}</h4>
      <div class="fc-read-cover-hint">Antippen zum Aufdecken</div>
      <div class="fc-read-back">${fcRenderBack(c.back)}</div>
    </article>`;
  const all = uniqueCardsByFront(groups.flatMap(g => g.cards));
  const allIds = new Set(all.map(c => c.id));
  const weak = all.filter(c => isFcWeak(c.id, day));
  weak.forEach(c => seen.add(c.id));
  const weakHtml = weak.length ? `<section class="fc-read-section fc-read-section-weak"><h3>🔁 Heute noch unsicher (${weak.length})</h3>${weak.map(c => cardHtml(c, true)).join('')}</section>` : '';
  const groupHtml = groups.map(g => {
    const cards = g.cards.filter(c => allIds.has(c.id) && !seen.has(c.id));
    return cards.length ? `<section class="fc-read-section"><h3>${escHtml(g.name)}</h3>${cards.map(c => cardHtml(c, false)).join('')}</section>` : '';
  }).join('');
  const title = exam ? exam.name : (groups[0]?.name || subj.name);

  panel.className = 'panel' + (covered ? ' fc-read-covered' : '');
  panel.innerHTML = `
    <div class="fc-read-head">
      <div class="fc-read-title"><span class="fc-read-label">📖 Lesen · ${escHtml(subj.name)}</span><h2>${escHtml(title)}</h2><span class="fc-read-count">${all.length} Karten</span></div>
      <div class="fc-read-tools">
        <button class="btn-ghost fc-read-cover-btn" aria-pressed="${covered}">${covered ? '👁 Antworten zeigen' : '🙈 Antworten verdecken'}</button>
        <button class="modal-x fc-read-close" aria-label="Lesemodus schließen" title="Schließen (Esc)">✕</button>
      </div>
    </div>
    ${weakHtml}${groupHtml}
    <div class="fc-read-foot">
      <button class="btn-ghost fc-read-close">Schließen</button>
      <button class="btn-primary fc-read-test">▶ Jetzt abfragen (Runde ${fcNextRound(groupIds)})</button>
    </div>`;

  panel.querySelectorAll('.fc-read-close').forEach(b => b.addEventListener('click', closeFcRead));
  panel.querySelector('.fc-read-test').addEventListener('click', () => {
    closeFcRead();
    startGroupsLearnSession(subjId, groupIds, exam, { mode: 'round' });
  });
  panel.querySelector('.fc-read-cover-btn').addEventListener('click', e => {
    const on = panel.classList.toggle('fc-read-covered');
    DB.set('fc_read_cover', on);
    panel.querySelectorAll('.fc-read-revealed').forEach(c => c.classList.remove('fc-read-revealed'));
    e.currentTarget.setAttribute('aria-pressed', String(on));
    e.currentTarget.textContent = on ? '👁 Antworten zeigen' : '🙈 Antworten verdecken';
  });
  panel.addEventListener('click', fcReadCardClick);

  document.getElementById('flashcard-layout').classList.add('read-open');

  // Lesestelle merken (Scroll kann je nach Breite in verschiedenen Containern
  // laufen, daher capture am Dokument) und beim Öffnen wiederherstellen
  const key = fcTargetKey(groupIds);
  const pos = DB.get('fc_read_pos', {});
  const startCard = pos[key] ? panel.querySelector(`.fc-read-card[data-card-id="${pos[key]}"]`) : null;
  (startCard || panel).scrollIntoView({ block: 'start' });
  fcRead = { subjId, groupIds, exam, saveTimer: null, onScroll: () => {
    clearTimeout(fcRead?.saveTimer);
    if(fcRead) fcRead.saveTimer = setTimeout(() => {
      const first = [...panel.querySelectorAll('.fc-read-card')].find(c => c.getBoundingClientRect().bottom > 90);
      if(!first) return;
      const p = DB.get('fc_read_pos', {}); p[key] = first.dataset.cardId; DB.set('fc_read_pos', p);
    }, 400);
  } };
  document.addEventListener('scroll', fcRead.onScroll, true);
}

function fcReadCardClick(e){
  if(e.target.closest('button, a')) return;
  const panel = e.currentTarget;
  if(!panel.classList.contains('fc-read-covered')) return;
  e.target.closest('.fc-read-card')?.classList.toggle('fc-read-revealed');
}

function closeFcRead(){
  const panel = document.getElementById('fc-read-panel');
  panel?.removeEventListener('click', fcReadCardClick);
  if(fcRead){ clearTimeout(fcRead.saveTimer); document.removeEventListener('scroll', fcRead.onScroll, true); fcRead = null; }
  document.getElementById('flashcard-layout')?.classList.remove('read-open');
  panel?.classList.add('hidden');
  if(panel) panel.innerHTML = '';
}

document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && fcRead && !document.querySelector('.modal-backdrop:not(.hidden)')) closeFcRead();
});

// ---------- Gemeinsame Knöpfe für Thema und Prüfung ----------

function buildFcStudyButtons(subj, groupIds, exam, hasCards){
  const frag = document.createDocumentFragment();
  const read = document.createElement('button');
  read.className = 'btn-ghost group-btn fc-study-btn'; read.textContent = '📖 Lesen'; read.disabled = !hasCards;
  read.title = 'Karten in Ruhe durchlesen';
  read.addEventListener('click', () => openFcRead(subj.id, groupIds, exam));
  const time = document.createElement('button');
  time.className = 'btn-ghost group-btn fc-study-btn'; time.textContent = '⏱'; time.disabled = !hasCards;
  time.title = 'Zeit-Session: 2 bis 20 Minuten'; time.setAttribute('aria-label', 'Zeit-Session starten');
  time.addEventListener('click', e => { e.stopPropagation(); openFcTimeMenu(subj, groupIds, exam, time); });
  const round = document.createElement('button');
  round.className = 'btn-primary group-btn fc-round-btn'; round.disabled = !hasCards;
  round.textContent = `▶ Runde ${fcNextRound(groupIds)}`;
  round.title = 'Alle Karten abfragen';
  round.addEventListener('click', () => startGroupsLearnSession(subj.id, groupIds, exam, { mode: 'round' }));
  frag.append(read, time, round);
  return frag;
}
