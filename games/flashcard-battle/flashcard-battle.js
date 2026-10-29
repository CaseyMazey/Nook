// =========================
// SPIEL-UI: FLASHCARD BATTLE
// Wird erst beim ersten Klick auf "Spielen" geladen.
// Ergänzt die über manifest.js registrierte Karte um mount/destroy.
// Regeln/Zahlen: fb-core.js (window.FBCore), Monster: window.FB_MONSTERS.
// Karteikarten werden nur gelesen (DB 'subjects'), nie verändert.
// =========================

(function () {

  const FEEDBACK_MS = 800;
  const BOSS_BANNER_MS = 1400;
  const MODES = [
    { id: 'fixed',   label: 'Feste Räume',       hint: '5 Gegner, der letzte ist ein Boss. Zwischen den Kämpfen heilst du dich ein wenig.' },
    { id: 'endless', label: 'Endlos',            hint: 'Immer stärkere Gegner, alle 5 Räume ein Boss. Wie weit kommst du?' },
    { id: 'cards',   label: 'Nach Kartenanzahl', hint: 'Jede Karte kommt genau einmal dran. Bei den letzten 5 Karten wartet der Boss.' }
  ];
  const TIER_LABELS = { normal: 'Normal', rare: 'Selten', boss: 'Boss' };

  const state = {
    root: null, screen: 'setup',
    setKey: null, mode: 'fixed',
    run: null, locked: false, timer: null,
    runStart: null    // { xp, level } beim Start des Runs, für das Ergebnis
  };

  const esc = s => (typeof escHtml === 'function' ? escHtml(s) : String(s));
  const toText = s => (typeof fcPlainPreview === 'function' ? fcPlainPreview(s) : String(s || ''));

  // ---- Daten (nur lesen aus dem Karteikarten-Tab) ----

  function listSets() {
    const archived = subj => (typeof isSubjectArchived === 'function' ? isSubjectArchived(subj) : false);
    const sets = [];
    DB.get('subjects', []).filter(subj => !archived(subj)).forEach(subj => {
      const groups = subj.groups || [];
      sets.push({ key: 's:' + subj.id, label: subj.name, sub: false,
        deck: FBCore.buildDeck(groups.flatMap(g => g.cards || []), toText) });
      groups.forEach(g => sets.push({ key: 'g:' + g.id, label: g.name, sub: true,
        deck: FBCore.buildDeck(g.cards || [], toText) }));
    });
    return sets;
  }

  function readProgress() {
    return DB.get('gameHighscores', {})['flashcard-battle'] || FBCore.emptyProgress();
  }
  function saveProgress(p) {
    const all = DB.get('gameHighscores', {});
    all['flashcard-battle'] = p;
    DB.set('gameHighscores', all);
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function monsterById(id) { return window.FB_MONSTERS.find(m => m.id === id) || { id, name: id, emoji: '❔', tier: 'normal' }; }

  // Grafik, falls vorhanden – sonst (oder wenn das Bild fehlt) das Emoji
  function monsterArt(m, cls) {
    const emoji = `<span class="fb-emoji">${m.emoji}</span>`;
    if (!m.sprite) return `<div class="${cls}">${emoji}</div>`;
    return `<div class="${cls}"><img src="${esc(m.sprite)}" alt="${esc(m.name)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fb-emoji',textContent:'${m.emoji}'}))"></div>`;
  }

  function levelBar(xp) {
    const l = FBCore.levelFromXp(xp);
    const pct = Math.round(l.intoLevel / l.needed * 100);
    return `
      <div class="fb-level">
        <span class="fb-level-num">Level ${l.level}</span>
        <div class="fb-bar fb-bar-xp"><div class="fb-bar-fill" style="width:${pct}%"></div></div>
        <span class="fb-level-xp">${l.intoLevel}/${l.needed} XP</span>
      </div>`;
  }

  function clearTimer() { clearTimeout(state.timer); state.timer = null; }

  // ---- Setup ----

  function renderSetup() {
    state.screen = 'setup';
    clearTimer();
    const sets = listSets();
    const selected = sets.find(s => s.key === state.setKey && s.deck.length >= FBCore.CONFIG.minCards);
    if (!selected) state.setKey = null;

    const setList = sets.length
      ? sets.map(s => {
          const ok = s.deck.length >= FBCore.CONFIG.minCards;
          return `<button class="fb-set${s.sub ? ' fb-set-sub' : ''}${s.key === state.setKey ? ' active' : ''}"
                    data-key="${esc(s.key)}" ${ok ? '' : 'disabled'}>
                    <span class="fb-set-name">${esc(s.label)}</span>
                    <span class="fb-set-count">${ok ? s.deck.length + ' Karten' : 'Mindestens 2 Karten nötig'}</span>
                  </button>`;
        }).join('')
      : `<p class="fb-empty">Lege zuerst im Karteikarten-Tab Karten an.</p>`;

    state.root.innerHTML = `
      <div class="fb-setup">
        ${levelBar(readProgress().xp)}
        <div class="game-setting-group">
          <span class="game-setting-label">Kartenset</span>
          <div class="fb-set-list">${setList}</div>
        </div>
        <div class="game-setting-group">
          <span class="game-setting-label">Spielmodus</span>
          <div class="fb-modes">
            ${MODES.map(m => `
              <button class="fb-mode${m.id === state.mode ? ' active' : ''}" data-mode="${m.id}">
                <span class="fb-mode-name">${m.label}</span>
                <span class="fb-mode-hint">${m.hint}</span>
              </button>`).join('')}
          </div>
        </div>
        <button class="game-action-btn" id="fb-start" ${state.setKey ? '' : 'disabled'}>Kampf starten</button>
        <div class="fb-setup-links">
          <button class="game-toggle-btn" id="fb-open-compendium">Kompendium</button>
          <button class="game-toggle-btn" id="fb-open-stats">Statistik</button>
        </div>
      </div>`;

    state.root.querySelectorAll('.fb-set:not([disabled])').forEach(b =>
      b.addEventListener('click', () => { state.setKey = b.dataset.key; renderSetup(); }));
    state.root.querySelectorAll('.fb-mode').forEach(b =>
      b.addEventListener('click', () => { state.mode = b.dataset.mode; renderSetup(); }));
    state.root.querySelector('#fb-start').addEventListener('click', startBattle);
    state.root.querySelector('#fb-open-compendium').addEventListener('click', renderCompendium);
    state.root.querySelector('#fb-open-stats').addEventListener('click', renderStats);
  }

  // ---- Kompendium & Statistik ----

  function subScreen(title, body) {
    state.root.innerHTML = `
      <div class="fb-sub">
        <div class="fb-sub-top">
          <span class="fb-sub-title">${title}</span>
          <button class="game-toggle-btn" id="fb-sub-back">Zurück</button>
        </div>
        ${body}
      </div>`;
    state.root.querySelector('#fb-sub-back').addEventListener('click', renderSetup);
  }

  function renderCompendium() {
    state.screen = 'compendium';
    const p = FBCore.applyEvents(readProgress(), []);
    const cards = window.FB_MONSTERS.map(m => {
      if (!p.seen[m.id]) {
        return `<div class="fb-mon unknown"><div class="fb-mon-art"><span class="fb-emoji">❔</span></div>
                  <span class="fb-mon-name">???</span><span class="fb-mon-tier">${TIER_LABELS[m.tier]}</span></div>`;
      }
      const wins = p.counters['defeat:' + m.id] || 0;
      const need = window.FB_PET_WINS[m.tier];
      return `<div class="fb-mon fb-tier-${m.tier}">
                ${monsterArt(m, 'fb-mon-art')}
                <span class="fb-mon-name">${esc(m.name)}</span>
                <span class="fb-mon-tier">${TIER_LABELS[m.tier]}</span>
                <span class="fb-mon-wins">Besiegt: ${wins}×</span>
                ${m.pet ? `<span class="fb-mon-pet">Haustier: ${Math.min(wins, need)}/${need}</span>` : ''}
              </div>`;
    }).join('');
    const seenCount = window.FB_MONSTERS.filter(m => p.seen[m.id]).length;
    subScreen(`Kompendium <span class="fb-sub-count">${seenCount}/${window.FB_MONSTERS.length}</span>`,
      `<div class="fb-mon-grid">${cards}</div>`);
  }

  function renderStats() {
    state.screen = 'stats';
    const p = FBCore.applyEvents(readProgress(), []);
    const c = p.counters;
    const rows = [
      ['Gewonnene Kämpfe', p.runsWon],
      ['Besiegte Monster', c.monstersDefeated],
      ['Richtige Antworten', c.correct],
      ['Falsche Antworten', c.wrong],
      ['Höchste Combo', c.maxCombo],
      ['Kritische Treffer', c.crits],
      ['Gesammelte XP', p.xp],
      ['Level', FBCore.levelFromXp(p.xp).level],
      ['Endlos-Rekord', p.bestEndless + ' Räume'],
      ['Lern-Streak', p.streak.days + (p.streak.days === 1 ? ' Tag' : ' Tage')]
    ];
    subScreen('Statistik', `
      <div class="fb-stat-grid">
        ${rows.map(([l, v]) => `<div class="fb-stat"><span class="fb-stat-label">${l}</span><span class="fb-stat-value">${v}</span></div>`).join('')}
      </div>`);
  }

  // ---- Kampf ----

  function startBattle() {
    const set = listSets().find(s => s.key === state.setKey);
    if (!set || set.deck.length < FBCore.CONFIG.minCards) return renderSetup();

    let p = FBCore.startRun(readProgress(), today());
    state.runStart = { xp: p.xp, level: FBCore.levelFromXp(p.xp).level };
    state.run = FBCore.createRun({ mode: state.mode, deck: set.deck, monsters: window.FB_MONSTERS, now: () => performance.now() });
    saveProgress(FBCore.applyEvents(p, state.run.events));
    state.locked = false;
    renderBattle();
  }

  function roomLabel(run) {
    if (run.mode === 'fixed') return `Raum ${run.room}/${FBCore.CONFIG.fixedRooms}`;
    if (run.mode === 'endless') return `Raum ${run.room}`;
    return `noch ${run.unanswered} Karten`;
  }

  function hpBar(cur, max, cls) {
    return `<div class="fb-bar ${cls}"><div class="fb-bar-fill" style="width:${Math.round(cur / max * 100)}%"></div></div>`;
  }

  function renderBattle() {
    state.screen = 'battle';
    const run = state.run;
    const e = run.enemy;
    const m = monsterById(e.monsterId);
    const q = run.question;
    const mult = FBCore.comboMultiplier(run.streak);

    state.root.innerHTML = `
      <div class="fb-battle">
        <div class="fb-top">
          <span class="fb-room">${roomLabel(run)}</span>
          <span class="fb-combo${run.streak >= 2 ? ' on' : ''}">Combo x${mult}</span>
          <button class="game-toggle-btn" id="fb-abort">Aufgeben</button>
        </div>
        <div class="fb-arena">
          <div class="fb-fighter fb-enemy fb-tier-${e.tier}">
            ${monsterArt(m, 'fb-enemy-art')}
            <div class="fb-fighter-info">
              <span class="fb-fighter-name">${esc(m.name)}${e.tier !== 'normal' ? ` <span class="fb-tier">${TIER_LABELS[e.tier]}</span>` : ''}</span>
              ${hpBar(e.hp, e.maxHp, 'fb-bar-enemy')}
              <span class="fb-hp-text" id="fb-enemy-hp">${e.hp}/${e.maxHp}</span>
            </div>
            <span class="fb-float" id="fb-float-enemy"></span>
          </div>
          <div class="fb-fighter fb-player">
            <div class="fb-fighter-info">
              <span class="fb-fighter-name">Du</span>
              ${hpBar(run.hp, run.maxHp, 'fb-bar-player')}
              <span class="fb-hp-text" id="fb-player-hp">${run.hp}/${run.maxHp}</span>
            </div>
            <span class="fb-float" id="fb-float-player"></span>
          </div>
        </div>
        <div class="fb-crit"><div class="fb-crit-fill"></div></div>
        <div class="fb-question">${esc(q.prompt)}</div>
        <div class="fb-options">
          ${q.options.map((o, i) => `
            <button class="fb-option" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(o)}</span></button>`).join('')}
        </div>
        <div class="fb-banner hidden" id="fb-banner">Ein Boss erscheint!</div>
      </div>`;

    state.root.querySelector('#fb-abort').addEventListener('click', () => { state.run = null; renderSetup(); });
    state.root.querySelectorAll('.fb-option').forEach(b =>
      b.addEventListener('click', () => onAnswer(Number(b.dataset.i))));
  }

  function onAnswer(i) {
    // Gesperrt, solange das Feedback der letzten Antwort läuft (kein doppelter Treffer)
    if (state.screen !== 'battle' || state.locked || !state.run || state.run.over) return;
    const run = state.run;
    const q = run.question;
    if (!q || i >= q.options.length) return;
    state.locked = true;

    const enemyMax = run.enemy.maxHp;
    const events = FBCore.answer(run, i);
    saveProgress(FBCore.applyEvents(readProgress(), events));

    // Feedback auf dem noch sichtbaren Kampfbild
    const btns = state.root.querySelectorAll('.fb-option');
    btns.forEach(b => { b.disabled = true; });
    btns[q.correctIndex].classList.add('correct');
    if (i !== q.correctIndex) btns[i].classList.add('wrong');
    state.root.querySelector('.fb-crit').classList.add('stopped');

    const hit = events.find(e => e.type === 'hit');
    const hurt = events.find(e => e.type === 'hurt');
    if (hit) {
      const defeated = events.some(e => e.type === 'defeat');
      const left = defeated ? 0 : run.enemy.hp;
      setBar('.fb-bar-enemy', left / enemyMax);
      state.root.querySelector('#fb-enemy-hp').textContent = `${left}/${enemyMax}`;
      floatText('#fb-float-enemy', (hit.crit ? 'Kritisch! ' : '') + '−' + hit.amount, hit.crit ? 'crit' : 'hit');
      if (defeated) state.root.querySelector('.fb-enemy').classList.add('defeated');
    }
    const heal = events.find(e => e.type === 'heal');
    if (hurt || heal) {
      setBar('.fb-bar-player', run.hp / run.maxHp);
      state.root.querySelector('#fb-player-hp').textContent = `${run.hp}/${run.maxHp}`;
      if (hurt) floatText('#fb-float-player', '−' + hurt.amount, 'hurt');
      else floatText('#fb-float-player', '+' + heal.amount, 'heal');
    }

    const bossComing = events.some(e => e.type === 'spawn' && e.tier === 'boss');
    if (bossComing) state.root.querySelector('#fb-banner').classList.remove('hidden');

    state.timer = setTimeout(() => {
      state.locked = false;
      if (run.over) renderResult(events.find(e => e.type === 'end'));
      else renderBattle();
    }, bossComing ? BOSS_BANNER_MS : FEEDBACK_MS);
  }

  function setBar(sel, ratio) {
    const fill = state.root.querySelector(sel + ' .fb-bar-fill');
    if (fill) fill.style.width = Math.round(Math.max(0, ratio) * 100) + '%';
  }

  function floatText(sel, text, cls) {
    const el = state.root.querySelector(sel);
    if (!el) return;
    el.textContent = text;
    el.className = 'fb-float show ' + cls;
  }

  // ---- Ergebnis ----

  function renderResult(end) {
    state.screen = 'result';
    const run = state.run;
    const p = readProgress();
    const gainedXp = p.xp - state.runStart.xp;
    const newLevel = FBCore.levelFromXp(p.xp).level;
    const defeated = run.events.filter(e => e.type === 'defeat').length;

    let title = end.won ? 'Gewonnen!' : 'Besiegt';
    if (run.mode === 'endless') title = `Raum ${run.room} erreicht`;

    state.root.innerHTML = `
      <div class="fb-result">
        <div class="fb-result-title">${title}</div>
        <div class="fb-result-stats">
          <div><span>${gainedXp}</span>XP</div>
          <div><span>${defeated}</span>besiegte Monster</div>
          <div><span>${run.maxStreak}</span>höchste Combo</div>
        </div>
        ${newLevel > state.runStart.level ? `<div class="fb-levelup">Level ${newLevel} erreicht!</div>` : ''}
        ${levelBar(p.xp)}
        <div class="fb-result-btns">
          <button class="game-action-btn" id="fb-again">Nochmal</button>
          <button class="game-toggle-btn" id="fb-back">Zurück</button>
        </div>
      </div>`;

    state.root.querySelector('#fb-again').addEventListener('click', startBattle);
    state.root.querySelector('#fb-back').addEventListener('click', () => { state.run = null; renderSetup(); });
  }

  // ---- Tastatur: 1–3 wählt eine Antwort ----

  function onKey(e) {
    if (state.screen !== 'battle' || e.repeat) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 3) { e.preventDefault(); onAnswer(n - 1); }
  }

  // ---- Lifecycle (wird vom Hub aufgerufen) ----

  function mount(container) {
    state.root = container;
    state.root.classList.add('fb-root');
    document.addEventListener('keydown', onKey);
    renderSetup();
  }

  function destroy() {
    // Feedback-Timer stoppen, sonst rendert er nach dem Schließen ins leere Modal.
    clearTimer();
    document.removeEventListener('keydown', onKey);
    if (state.root) state.root.classList.remove('fb-root');
    state.root = null;
    state.run = null;
    state.locked = false;
    state.screen = 'setup';
  }

  window.registerGame({
    id: 'flashcard-battle',
    mount,
    destroy
  });

})();
