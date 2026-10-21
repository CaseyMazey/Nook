// =========================
// QUESTBOARD — Tab: Questboard
// Gamifiziertes Planungsbrett im Stil eines Tavernen-Aushangs (Idee:
// physisches „Quest Board“ mit wiederverwendbaren, angepinnten Karten).
// Bewusst ein eigener Tab: Heute ist laut today.md ausdrücklich OHNE
// Gamification, Kalender/Projekte verwalten ihre Termine/Aufgaben selbst.
//
// Module auf dem Brett:
//   1. Aushang     — aktueller + nächster Monat, nur LESEND aus dem Kalender
//                    (getEventsForRange()/getBirthdaysForDate(), calendar.js)
//   2. Daily       — tägliche Checklisten, setzen sich jeden Tag zurück
//   3. Weekly      — Wochen-/Projekt-Checklisten, optional montags zurück
//   4. Time Quests — Aufgabe + Uhrzeit/Dauer, chronologisch, verschiebbar
//   5. Side Quests — nummerierte Kleinigkeiten, der Würfel entscheidet
//   6. Schatztruhe — optionales Münz-/Belohnungssystem
//
// Lädt nach calendar.js (liest dessen Termine) — sonst keine Abhängigkeit.
// Eigene Keys, alle mit Präfix "quest" (settings.js: NOOK_DATA_GROUPS).
// =========================

const QUEST_TYPES = {
  daily:  { label: 'Daily Quest',  plural: 'Daily Quests',  hint: 'Jeden Tag frisch — kleine Gewohnheiten.', coins: 2 },
  weekly: { label: 'Check Quest',  plural: 'Weekly & Check Quests', hint: 'Wochenliste oder ein Projekt in Schritten.', coins: 10 },
  timed:  { label: 'Time Quest',   plural: 'Time Quests',   hint: 'Aufgabe mit Uhrzeit oder Zeitblock.', coins: 5 },
  side:   { label: 'Side Quest',   plural: 'Side Quests',   hint: 'Kleinkram — der Würfel sagt, was dran ist.', coins: 2 },
};

let questCards    = DB.get('questCards', []);
let questRewards  = DB.get('questRewards', null);
let questWallet   = DB.get('questWallet', { coins: 0, earned: 0, redeemed: [] });
let questSettings = DB.get('questSettings', { coinsEnabled: true, lastDailyReset: null, lastWeeklyReset: null });

function saveQuestCards()    { DB.set('questCards', questCards); }
function saveQuestRewards()  { DB.set('questRewards', questRewards); }
function saveQuestWallet()   { DB.set('questWallet', questWallet); }
function saveQuestSettings() { DB.set('questSettings', questSettings); }

// Beim allerersten Öffnen ein paar Beispiel-Belohnungen, damit die Truhe
// nicht leer ist (null = noch nie angelegt, [] = bewusst alle gelöscht).
if (!Array.isArray(questRewards)) {
  questRewards = [
    { id: crypto.randomUUID(), title: 'Kaffee unterwegs', icon: '☕', cost: 30 },
    { id: crypto.randomUUID(), title: 'Eine Stunde zocken', icon: '🎮', cost: 50 },
    { id: crypto.randomUUID(), title: 'Etwas von der Wunschliste', icon: '🎁', cost: 300 },
  ];
  saveQuestRewards();
}

// Generierte Grafiken (scripts/gen-image.py) — Illustrationen, daher mit
// eigenen Farben (Ausnahme der Farbregel, siehe CLAUDE.md).
const QUEST_COIN_IMG = '<img class="quest-coin" src="assets/questboard/coin.webp" alt="" aria-hidden="true">';
const QUEST_CHEST_IMG = '<img class="quest-chest-img" src="assets/questboard/chest.webp" alt="" aria-hidden="true">';

let questPickedId = null;   // vom Würfel gezogene Side Quest (nur Anzeige)
let questRolling = false;

function questEsc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ISO-Kalenderwoche als Schlüssel "2026-W43" — für den Wochen-Reset.
function questWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── Tages-/Wochen-Reset ─────────────────────────────────────────────────
// Wiederverwendbare Karten wie im Original: abends abwischen, morgens neu.
// Läuft bei jedem Rendern, wirkt aber nur beim ersten Mal pro Tag/Woche.
function questRunResets() {
  const now = new Date();
  const today = dateKey(now);
  const week = questWeekKey(now);
  let changed = false;
  if (questSettings.lastDailyReset !== today) {
    questCards.forEach(c => {
      if (c.type === 'daily') { c.items.forEach(i => { i.done = false; }); c.awarded = false; }
      if (c.type === 'timed') { c.done = false; c.awarded = false; }
    });
    questSettings.lastDailyReset = today;
    questPickedId = null;
    changed = true;
  }
  if (questSettings.lastWeeklyReset !== week) {
    questCards.forEach(c => {
      if (c.type === 'weekly' && c.resetWeekly) { c.items.forEach(i => { i.done = false; }); c.awarded = false; }
    });
    questSettings.lastWeeklyReset = week;
    changed = true;
  }
  if (changed) { saveQuestCards(); saveQuestSettings(); }
}

// ── Münzen ──────────────────────────────────────────────────────────────
function questAward(card, sign) {
  const amount = Math.max(0, Number(card.coins) || 0) * sign;
  card.awarded = sign > 0;
  if (!questSettings.coinsEnabled || !amount) return;
  questWallet.coins = Math.max(0, questWallet.coins + amount);
  if (sign > 0) questWallet.earned += amount;
  saveQuestWallet();
  if (sign > 0) questToast(`+${amount} 🪙 für „${card.title}“`);
}

// Checklisten-Karte: Münzen erst, wenn ALLE Punkte erledigt sind — und
// zurück, wenn danach wieder ein Haken entfernt wird.
function questSyncChecklistAward(card) {
  const complete = card.items.length > 0 && card.items.every(i => i.done);
  if (complete && !card.awarded) questAward(card, 1);
  else if (!complete && card.awarded) questAward(card, -1);
}

let questToastTimer = null;
function questToast(msg) {
  const el = document.getElementById('quest-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(questToastTimer);
  questToastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Rendern ─────────────────────────────────────────────────────────────
function renderQuestboard() {
  questRunResets();
  const coinsOn = !!questSettings.coinsEnabled;
  const wallet = document.getElementById('quest-wallet-pill');
  if (wallet) {
    wallet.hidden = !coinsOn;
    wallet.innerHTML = `${QUEST_COIN_IMG}<strong>${questWallet.coins}</strong>`;
  }
  renderQuestNoticeBoard();
  renderQuestChecklistColumn('daily');
  renderQuestChecklistColumn('weekly');
  renderQuestTimed();
  renderQuestSide();
  renderQuestChest();
}

function questCoinBadge(card) {
  if (!questSettings.coinsEnabled || !card.coins) return '';
  return `<span class="quest-coin-badge" title="${card.coins} Münzen">${QUEST_COIN_IMG}${card.coins}</span>`;
}

function questCardHead(card, extra = '') {
  return `<div class="quest-card-head">
      <span class="quest-card-title">${questEsc(card.title)}</span>
      ${extra}${questCoinBadge(card)}
      <button class="quest-icon-btn" data-quest-edit="${card.id}" title="Bearbeiten" aria-label="Quest bearbeiten">✎</button>
    </div>`;
}

function questByType(type) {
  return questCards.filter(c => c.type === type).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function questEmpty(type) {
  return `<button class="quest-empty" data-quest-add="${type}">+ ${QUEST_TYPES[type].label} anpinnen<span>${QUEST_TYPES[type].hint}</span></button>`;
}

function renderQuestChecklistColumn(type) {
  const host = document.getElementById(`quest-list-${type}`);
  if (!host) return;
  const cards = questByType(type);
  if (!cards.length) { host.innerHTML = questEmpty(type); return; }
  host.innerHTML = cards.map(card => {
    const done = card.items.filter(i => i.done).length;
    const total = card.items.length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const complete = total > 0 && done === total;
    const resetTag = type === 'weekly' && card.resetWeekly ? '<span class="quest-tag" title="Wird jeden Montag zurückgesetzt">↻ Woche</span>' : '';
    return `<article class="quest-card quest-card-${type}${complete ? ' is-complete' : ''}">
      ${questCardHead(card, resetTag)}
      <ul class="quest-checklist">
        ${card.items.map(i => `<li><label class="quest-check${i.done ? ' done' : ''}">
          <input type="checkbox" data-quest-item="${card.id}:${i.id}" ${i.done ? 'checked' : ''}/>
          <span>${questEsc(i.text)}</span></label></li>`).join('')}
      </ul>
      <div class="quest-progress" aria-label="${done} von ${total} erledigt"><span style="width:${pct}%"></span></div>
      <div class="quest-card-foot">${complete ? '✓ Quest abgeschlossen' : `${done}/${total}`}</div>
    </article>`;
  }).join('');
}

function questTimeLabel(card) {
  if (card.start && card.end) return `${card.start}–${card.end}`;
  if (card.start) return card.start;
  if (card.duration) return card.duration >= 60 && card.duration % 60 === 0 ? `${card.duration / 60} Std.` : `${card.duration} Min.`;
  return '';
}

function questIsNow(card) {
  if (!card.start || card.done) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const s = toMin(card.start);
  const e = card.end ? toMin(card.end) : s + (Number(card.duration) || 60);
  return cur >= s && cur < e;
}

function renderQuestTimed() {
  const host = document.getElementById('quest-list-timed');
  if (!host) return;
  const cards = questByType('timed');
  if (!cards.length) { host.innerHTML = questEmpty('timed'); return; }
  host.innerHTML = cards.map((card, idx) => `
    <article class="quest-card quest-card-timed${card.done ? ' is-complete' : ''}${questIsNow(card) ? ' is-now' : ''}">
      <div class="quest-timed-row">
        <label class="quest-check quest-timed-check${card.done ? ' done' : ''}">
          <input type="checkbox" data-quest-done="${card.id}" ${card.done ? 'checked' : ''}/>
          <span class="quest-time">${questEsc(questTimeLabel(card)) || '—'}</span>
        </label>
        <div class="quest-move">
          <button class="quest-icon-btn" data-quest-move="${card.id}:-1" ${idx === 0 ? 'disabled' : ''} title="Nach oben" aria-label="Nach oben">↑</button>
          <button class="quest-icon-btn" data-quest-move="${card.id}:1" ${idx === cards.length - 1 ? 'disabled' : ''} title="Nach unten" aria-label="Nach unten">↓</button>
        </div>
      </div>
      ${questCardHead(card, questIsNow(card) ? '<span class="quest-tag quest-tag-now">Jetzt</span>' : '')}
    </article>`).join('');
}

function questOpenSide() {
  return questByType('side').filter(c => !c.done);
}

function renderQuestSide() {
  const host = document.getElementById('quest-list-side');
  const dice = document.getElementById('quest-dice-area');
  if (!host) return;
  const all = questByType('side');
  const open = all.filter(c => !c.done);
  const done = all.filter(c => c.done);
  if (!all.length) {
    host.innerHTML = questEmpty('side');
    if (dice) dice.hidden = true;
    return;
  }
  if (dice) {
    dice.hidden = false;
    const sides = Math.max(open.length, 1);
    const btn = document.getElementById('quest-roll-btn');
    if (btn) {
      btn.disabled = open.length < 2 || questRolling;
      btn.textContent = open.length < 2 ? 'Würfeln (ab 2 offenen Quests)' : `W${sides} würfeln`;
    }
    if (!questRolling) {
      const face = document.getElementById('quest-die-face');
      const picked = open.findIndex(c => c.id === questPickedId);
      if (face) face.textContent = picked >= 0 ? picked + 1 : '?';
    }
  }
  host.innerHTML = open.map((card, idx) => `
    <article class="quest-card quest-card-side${card.id === questPickedId ? ' is-picked' : ''}">
      <span class="quest-side-num" aria-label="Nummer ${idx + 1}">${idx + 1}</span>
      <div class="quest-side-body">
        ${questCardHead(card, card.repeatable ? '<span class="quest-tag" title="Bleibt nach dem Erledigen auf dem Brett">↻</span>' : '')}
        <button class="quest-done-btn" data-quest-done-side="${card.id}">Erledigt</button>
      </div>
    </article>`).join('') +
    (open.length ? '' : '<p class="quest-muted">Alle Side Quests erledigt — gönn dir was.</p>') +
    (done.length ? `<details class="quest-done-list"><summary>${done.length} erledigt</summary>
      ${done.map(c => `<div class="quest-done-row"><span>${questEsc(c.title)}</span>
        <button class="quest-icon-btn" data-quest-reopen="${c.id}" title="Wieder anpinnen" aria-label="Wieder anpinnen">↺</button></div>`).join('')}
      <button class="btn-ghost quest-clear-done" id="quest-clear-done-btn">Erledigte entfernen</button></details>` : '');
}

// ── Aushang: aktueller + nächster Monat (nur lesend aus dem Kalender) ───
function renderQuestNoticeBoard() {
  const host = document.getElementById('quest-notice');
  if (!host) return;
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastNext = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const map = typeof getEventsForRange === 'function' ? getEventsForRange(first, lastNext) : new Map();
  const todayK = dateKey(now);

  const dayInfo = d => {
    const evs = map.get(dateKey(d)) || [];
    const bdays = typeof getBirthdaysForDate === 'function' ? getBirthdaysForDate(d) : [];
    return { evs: evs.filter(e => e.isStart), bdays };
  };

  const months = [0, 1].map(offset => {
    const m = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const lead = (m.getDay() + 6) % 7;   // Montag zuerst
    let cells = '<span class="quest-cal-blank"></span>'.repeat(lead);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(m.getFullYear(), m.getMonth(), day);
      const info = dayInfo(d);
      const has = info.evs.length + info.bdays.length;
      const k = dateKey(d);
      const title = has ? [...info.bdays.map(b => '🎂 ' + b.name), ...info.evs.map(e => (e.ev.time ? e.ev.time + ' ' : '') + e.ev.title)].join('\n') : '';
      cells += `<span class="quest-cal-day${k === todayK ? ' is-today' : ''}${k < todayK ? ' is-past' : ''}${has ? ' has-ev' : ''}"${title ? ` title="${questEsc(title)}"` : ''}>${day}</span>`;
    }
    const name = m.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    return `<div class="quest-cal-month">
      <div class="quest-cal-name">${questEsc(name)}</div>
      <div class="quest-cal-grid">${['M', 'D', 'M', 'D', 'F', 'S', 'S'].map(w => `<span class="quest-cal-wd">${w}</span>`).join('')}${cells}</div>
    </div>`;
  }).join('');

  // Nächste Termine/Fristen ab heute bis Ende nächsten Monats
  const upcoming = [];
  for (let d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d <= lastNext && upcoming.length < 6; d.setDate(d.getDate() + 1)) {
    const info = dayInfo(d);
    info.bdays.forEach(b => upcoming.push({ d: new Date(d), text: '🎂 ' + b.name }));
    info.evs.forEach(e => upcoming.push({ d: new Date(d), text: (e.ev.time ? e.ev.time + ' · ' : '') + e.ev.title }));
  }
  const list = upcoming.slice(0, 6).map(u => `<li><span class="quest-up-date">${u.d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>${questEsc(u.text)}</li>`).join('');

  host.innerHTML = `<div class="quest-cal-months">${months}</div>
    <div class="quest-upcoming">
      <div class="quest-sub-label">Nächste Termine & Fristen</div>
      ${list ? `<ul>${list}</ul>` : '<p class="quest-muted">Nichts eingetragen — freie Bahn.</p>'}
      <button class="btn-ghost quest-to-cal" data-view-jump="calendar">Zum Kalender ›</button>
    </div>`;
}

// ── Schatztruhe ─────────────────────────────────────────────────────────
function renderQuestChest() {
  const host = document.getElementById('quest-chest');
  if (!host) return;
  const on = !!questSettings.coinsEnabled;
  const toggle = `<label class="quest-toggle"><input type="checkbox" id="quest-coins-toggle" ${on ? 'checked' : ''}/> Belohnungssystem aktiv</label>`;
  if (!on) {
    host.innerHTML = `<p class="quest-muted">Ohne Münzen ist das Brett eine reine Planungshilfe. Einschalten, um für erledigte Quests Gold zu sammeln.</p>${toggle}`;
    return;
  }
  const rewards = questRewards.slice().sort((a, b) => a.cost - b.cost).map(r => {
    const can = questWallet.coins >= r.cost;
    const pct = Math.min(100, Math.round(questWallet.coins / Math.max(r.cost, 1) * 100));
    return `<div class="quest-reward${can ? ' can-buy' : ''}">
      <span class="quest-reward-icon" aria-hidden="true">${questEsc(r.icon || '🎁')}</span>
      <div class="quest-reward-body">
        <div class="quest-reward-title">${questEsc(r.title)}</div>
        <div class="quest-progress quest-progress-gold"><span style="width:${pct}%"></span></div>
      </div>
      <button class="quest-reward-buy" data-quest-redeem="${r.id}" ${can ? '' : 'disabled'} title="${can ? 'Einlösen' : `Noch ${r.cost - questWallet.coins} Münzen`}">${QUEST_COIN_IMG}${r.cost}</button>
      <button class="quest-icon-btn" data-quest-reward-edit="${r.id}" title="Bearbeiten" aria-label="Belohnung bearbeiten">✎</button>
    </div>`;
  }).join('');
  const last = questWallet.redeemed.slice(-3).reverse().map(x =>
    `<li>${questEsc(x.title)} <span class="quest-muted">· ${new Date(x.at).toLocaleDateString('de-DE')}</span></li>`).join('');
  host.innerHTML = `
    <div class="quest-chest-total">${QUEST_CHEST_IMG}<div><div class="quest-chest-sum">${QUEST_COIN_IMG}<strong>${questWallet.coins}</strong> Gold</div><span class="quest-muted">insgesamt ${questWallet.earned} verdient</span></div></div>
    <div class="quest-sub-label">Belohnungen</div>
    <div class="quest-rewards">${rewards || '<p class="quest-muted">Noch keine Belohnungen festgelegt.</p>'}</div>
    <button class="btn-ghost quest-add-reward" id="quest-add-reward-btn">+ Belohnung</button>
    ${last ? `<div class="quest-sub-label">Zuletzt eingelöst</div><ul class="quest-redeemed">${last}</ul>` : ''}
    <div class="quest-coin-guide">Faustregel: einfache Quests 1–2 Münzen, unbeliebte oder anstrengende 10–20.</div>
    ${toggle}`;
}

// ── Würfel ──────────────────────────────────────────────────────────────
function questRollDice() {
  const open = questOpenSide();
  if (open.length < 2 || questRolling) return;
  const face = document.getElementById('quest-die-face');
  const die = document.getElementById('quest-die');
  const result = Math.floor(Math.random() * open.length);
  const finish = () => {
    questRolling = false;
    questPickedId = open[result].id;
    die?.classList.remove('rolling');
    renderQuestSide();
    questToast(`🎲 ${result + 1}: ${open[result].title}`);
    document.querySelector('.quest-card-side.is-picked')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  if (reduceMotion) { finish(); return; }
  questRolling = true;
  questPickedId = null;
  renderQuestSide();
  die?.classList.add('rolling');
  let ticks = 0;
  const iv = setInterval(() => {
    if (face) face.textContent = Math.floor(Math.random() * open.length) + 1;
    if (++ticks >= 12) { clearInterval(iv); finish(); }
  }, 70);
}

// ── Modal: Quest anlegen/bearbeiten ─────────────────────────────────────
let questEditingId = null;

function questModalSetType(type) {
  document.querySelectorAll('#quest-type-picker .tile-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  document.getElementById('quest-modal-overlay').dataset.type = type;
  document.getElementById('quest-type-hint').textContent = QUEST_TYPES[type].hint;
}

function openQuestModal(type, cardId) {
  const card = cardId ? questCards.find(c => c.id === cardId) : null;
  questEditingId = card ? card.id : null;
  const t = card ? card.type : (type || 'daily');
  document.getElementById('quest-modal-head-title').textContent = card ? 'Quest bearbeiten' : 'Neue Quest';
  document.getElementById('quest-modal-title').value = card ? card.title : '';
  document.getElementById('quest-modal-coins').value = card ? (card.coins ?? 0) : QUEST_TYPES[t].coins;
  document.getElementById('quest-modal-items').value = card && card.items ? card.items.map(i => i.text).join('\n') : '';
  document.getElementById('quest-modal-start').value = card?.start || '';
  document.getElementById('quest-modal-end').value = card?.end || '';
  document.getElementById('quest-modal-duration').value = card?.duration || '';
  document.getElementById('quest-modal-reset-weekly').checked = card ? !!card.resetWeekly : true;
  document.getElementById('quest-modal-repeatable').checked = card ? !!card.repeatable : false;
  document.getElementById('quest-modal-delete').hidden = !card;
  // Typ einer bestehenden Karte bleibt fest (Daten passen sonst nicht)
  document.querySelectorAll('#quest-type-picker .tile-type-btn').forEach(b => { b.disabled = !!card && b.dataset.type !== t; });
  document.getElementById('quest-modal-coins-row').hidden = !questSettings.coinsEnabled;
  questModalSetType(t);
  document.getElementById('quest-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('quest-modal-title').focus(), 30);
}

function closeQuestModal() {
  document.getElementById('quest-modal-overlay').classList.add('hidden');
  questEditingId = null;
}

function saveQuestFromModal() {
  const overlay = document.getElementById('quest-modal-overlay');
  const type = overlay.dataset.type;
  const title = document.getElementById('quest-modal-title').value.trim();
  if (!title) { document.getElementById('quest-modal-title').focus(); return; }
  const coins = Math.max(0, Math.round(Number(document.getElementById('quest-modal-coins').value) || 0));
  let card = questEditingId ? questCards.find(c => c.id === questEditingId) : null;
  if (!card) {
    const sameType = questByType(type);
    card = { id: crypto.randomUUID(), type, items: [], done: false, awarded: false,
             order: sameType.length ? Math.max(...sameType.map(c => c.order ?? 0)) + 1 : 0 };
    questCards.push(card);
  }
  card.title = title;
  card.coins = coins;

  if (type === 'daily' || type === 'weekly') {
    // Erledigt-Status bleibt bei unverändertem Text erhalten
    const old = card.items || [];
    const lines = document.getElementById('quest-modal-items').value.split('\n').map(s => s.trim()).filter(Boolean);
    card.items = lines.map(text => {
      const prev = old.find(i => i.text === text);
      return prev ? prev : { id: crypto.randomUUID(), text, done: false };
    });
    if (!card.items.length) card.items = [{ id: crypto.randomUUID(), text: title, done: false }];
    if (type === 'weekly') card.resetWeekly = document.getElementById('quest-modal-reset-weekly').checked;
    questSyncChecklistAward(card);
  }
  if (type === 'timed') {
    const isNew = !questEditingId;
    card.start = document.getElementById('quest-modal-start').value || '';
    card.end = card.start ? (document.getElementById('quest-modal-end').value || '') : '';
    card.duration = Math.max(0, Math.round(Number(document.getElementById('quest-modal-duration').value) || 0)) || null;
    if (isNew && card.start) questSortTimed();
  }
  if (type === 'side') card.repeatable = document.getElementById('quest-modal-repeatable').checked;

  saveQuestCards();
  closeQuestModal();
  renderQuestboard();
}

function deleteQuestFromModal() {
  if (!questEditingId) return;
  if (!confirm('Diese Quest wirklich vom Brett nehmen?')) return;
  questCards = questCards.filter(c => c.id !== questEditingId);
  saveQuestCards();
  closeQuestModal();
  renderQuestboard();
}

// Uhrzeit-Karten chronologisch, Karten ohne Startzeit behalten ihre
// relative Reihenfolge und rutschen ans Ende.
function questSortTimed() {
  const timed = questByType('timed');
  const withTime = timed.filter(c => c.start).sort((a, b) => a.start.localeCompare(b.start));
  const without = timed.filter(c => !c.start);
  [...withTime, ...without].forEach((c, i) => { c.order = i; });
}

function questMoveTimed(id, dir) {
  const list = questByType('timed');
  const idx = list.findIndex(c => c.id === id);
  const other = list[idx + dir];
  if (idx < 0 || !other) return;
  list.forEach((c, i) => { c.order = i; });
  [list[idx].order, other.order] = [other.order, list[idx].order];
  saveQuestCards();
  renderQuestTimed();
}

// ── Modal: Belohnung ────────────────────────────────────────────────────
let questEditingRewardId = null;

function openQuestRewardModal(rewardId) {
  const r = rewardId ? questRewards.find(x => x.id === rewardId) : null;
  questEditingRewardId = r ? r.id : null;
  document.getElementById('quest-reward-modal-head-title').textContent = r ? 'Belohnung bearbeiten' : 'Neue Belohnung';
  document.getElementById('quest-reward-modal-title').value = r ? r.title : '';
  document.getElementById('quest-reward-modal-icon').value = r ? (r.icon || '') : '🎁';
  document.getElementById('quest-reward-modal-cost').value = r ? r.cost : 50;
  document.getElementById('quest-reward-modal-delete').hidden = !r;
  document.getElementById('quest-reward-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('quest-reward-modal-title').focus(), 30);
}

function closeQuestRewardModal() {
  document.getElementById('quest-reward-modal-overlay').classList.add('hidden');
  questEditingRewardId = null;
}

function saveQuestRewardFromModal() {
  const title = document.getElementById('quest-reward-modal-title').value.trim();
  if (!title) { document.getElementById('quest-reward-modal-title').focus(); return; }
  const icon = document.getElementById('quest-reward-modal-icon').value.trim() || '🎁';
  const cost = Math.max(1, Math.round(Number(document.getElementById('quest-reward-modal-cost').value) || 1));
  let r = questEditingRewardId ? questRewards.find(x => x.id === questEditingRewardId) : null;
  if (!r) { r = { id: crypto.randomUUID() }; questRewards.push(r); }
  Object.assign(r, { title, icon, cost });
  saveQuestRewards();
  closeQuestRewardModal();
  renderQuestChest();
}

function deleteQuestRewardFromModal() {
  if (!questEditingRewardId || !confirm('Diese Belohnung löschen?')) return;
  questRewards = questRewards.filter(x => x.id !== questEditingRewardId);
  saveQuestRewards();
  closeQuestRewardModal();
  renderQuestChest();
}

function questRedeem(rewardId) {
  const r = questRewards.find(x => x.id === rewardId);
  if (!r || questWallet.coins < r.cost) return;
  if (!confirm(`„${r.title}“ für ${r.cost} Münzen einlösen?`)) return;
  questWallet.coins -= r.cost;
  questWallet.redeemed.push({ rewardId: r.id, title: r.title, cost: r.cost, at: Date.now() });
  if (questWallet.redeemed.length > 50) questWallet.redeemed = questWallet.redeemed.slice(-50);
  saveQuestWallet();
  renderQuestboard();
  questToast(`🎉 Eingelöst: ${r.title} — viel Spaß!`);
}

// ── Events (delegiert, einmalig verkabelt) ──────────────────────────────
(function initQuestboardEvents() {
  const view = document.getElementById('view-questboard');
  if (!view) return;

  view.addEventListener('click', e => {
    const t = e.target.closest('button, [data-quest-add]');
    if (!t) return;
    if (t.id === 'quest-add-btn')          return openQuestModal('daily');
    if (t.dataset.questAdd)                return openQuestModal(t.dataset.questAdd);
    if (t.dataset.questEdit)               return openQuestModal(null, t.dataset.questEdit);
    if (t.id === 'quest-roll-btn')         return questRollDice();
    if (t.id === 'quest-add-reward-btn')   return openQuestRewardModal();
    if (t.dataset.questRewardEdit)         return openQuestRewardModal(t.dataset.questRewardEdit);
    if (t.dataset.questRedeem)             return questRedeem(t.dataset.questRedeem);
    if (t.dataset.viewJump)                return showView(t.dataset.viewJump);
    if (t.dataset.questMove) {
      const [id, dir] = t.dataset.questMove.split(':');
      return questMoveTimed(id, Number(dir));
    }
    if (t.id === 'quest-sort-timed-btn') { questSortTimed(); saveQuestCards(); return renderQuestTimed(); }
    if (t.dataset.questDoneSide) {
      const card = questCards.find(c => c.id === t.dataset.questDoneSide);
      if (!card) return;
      questAward(card, 1);
      if (!card.repeatable) card.done = true;
      card.awarded = false;   // Side Quests zählen pro Erledigung
      if (questPickedId === card.id) questPickedId = null;
      saveQuestCards();
      renderQuestboard();
      return;
    }
    if (t.dataset.questReopen) {
      const card = questCards.find(c => c.id === t.dataset.questReopen);
      if (card) { card.done = false; saveQuestCards(); renderQuestSide(); }
      return;
    }
    if (t.id === 'quest-clear-done-btn') {
      if (!confirm('Alle erledigten Side Quests vom Brett nehmen?')) return;
      questCards = questCards.filter(c => !(c.type === 'side' && c.done));
      saveQuestCards();
      renderQuestSide();
    }
  });

  view.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.questItem) {
      const [cardId, itemId] = t.dataset.questItem.split(':');
      const card = questCards.find(c => c.id === cardId);
      const item = card?.items.find(i => i.id === itemId);
      if (!item) return;
      item.done = t.checked;
      questSyncChecklistAward(card);
      saveQuestCards();
      renderQuestboard();
      return;
    }
    if (t.dataset.questDone) {
      const card = questCards.find(c => c.id === t.dataset.questDone);
      if (!card) return;
      card.done = t.checked;
      if (card.done && !card.awarded) questAward(card, 1);
      else if (!card.done && card.awarded) questAward(card, -1);
      saveQuestCards();
      renderQuestboard();
      return;
    }
    if (t.id === 'quest-coins-toggle') {
      questSettings.coinsEnabled = t.checked;
      saveQuestSettings();
      renderQuestboard();
    }
  });

  // Quest-Modal
  document.getElementById('quest-type-picker')?.addEventListener('click', e => {
    const b = e.target.closest('.tile-type-btn');
    if (!b || b.disabled) return;
    const coinsEl = document.getElementById('quest-modal-coins');
    const prev = document.getElementById('quest-modal-overlay').dataset.type;
    // Standard-Münzwert mitziehen, solange er nicht von Hand geändert wurde
    if (!questEditingId && Number(coinsEl.value) === QUEST_TYPES[prev].coins) coinsEl.value = QUEST_TYPES[b.dataset.type].coins;
    questModalSetType(b.dataset.type);
  });
  document.getElementById('quest-modal-close')?.addEventListener('click', closeQuestModal);
  document.getElementById('quest-modal-cancel')?.addEventListener('click', closeQuestModal);
  document.getElementById('quest-modal-save')?.addEventListener('click', saveQuestFromModal);
  document.getElementById('quest-modal-delete')?.addEventListener('click', deleteQuestFromModal);
  document.getElementById('quest-modal-title')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveQuestFromModal(); });
  document.getElementById('quest-modal-overlay')?.addEventListener('click', e => { if (e.target.id === 'quest-modal-overlay') closeQuestModal(); });

  // Belohnungs-Modal
  document.getElementById('quest-reward-modal-close')?.addEventListener('click', closeQuestRewardModal);
  document.getElementById('quest-reward-modal-cancel')?.addEventListener('click', closeQuestRewardModal);
  document.getElementById('quest-reward-modal-save')?.addEventListener('click', saveQuestRewardFromModal);
  document.getElementById('quest-reward-modal-delete')?.addEventListener('click', deleteQuestRewardFromModal);
  document.getElementById('quest-reward-modal-title')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveQuestRewardFromModal(); });
  document.getElementById('quest-reward-modal-overlay')?.addEventListener('click', e => { if (e.target.id === 'quest-reward-modal-overlay') closeQuestRewardModal(); });

  // "Jetzt"-Markierung der Time Quests + Tageswechsel aktuell halten —
  // läuft nur, solange der Tab offen ist (kein Unmount-Hook, siehe main.js).
  setInterval(() => {
    if (currentView !== 'questboard') return;
    const before = questSettings.lastDailyReset;
    questRunResets();
    if (before !== questSettings.lastDailyReset) renderQuestboard();
    else renderQuestTimed();
  }, 60000);
})();
