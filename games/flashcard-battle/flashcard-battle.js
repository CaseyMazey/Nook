// =========================
// SPIEL-UI: FLASHCARD BATTLE
// Wird erst beim ersten Klick auf "Spielen" geladen.
// Ergänzt die über manifest.js registrierte Karte um mount/destroy.
// Regeln/Zahlen: fb-core.js (window.FBCore), Monster: window.FB_MONSTERS.
// Karteikarten werden nur gelesen (DB 'subjects'), nie verändert.
// Debug-Werte (Testzwecke) liegen unter DB 'fb_debug' und überschreiben
// FBCore.CONFIG, siehe Debug-Menü unten.
// =========================

(function () {

  const FEEDBACK_MS = 800;
  const BOSS_BANNER_MS = 1400;
  const DEBUG_KEY = 'fb_debug';
  const MODES = [
    { id: 'fixed',   label: 'Feste Räume',       hint: '5 Räume mit je 5 Gegnern, am Ende jedes Raums ein Miniboss, zum Schluss der große Boss. Nach jedem Raum heilst du dich.' },
    { id: 'endless', label: 'Endlos',            hint: 'Immer stärkere Gegner, alle 5 Räume ein Boss. Wie weit kommst du?' },
    { id: 'cards',   label: 'Nach Kartenanzahl', hint: 'Jede Karte kommt genau einmal dran. Bei den letzten 5 Karten wartet der Boss.' }
  ];
  const TIER_LABELS = { normal: 'Normal', rare: 'Selten', miniboss: 'Miniboss', boss: 'Boss' };

  const state = {
    root: null, screen: 'setup',
    setKey: null, mode: 'fixed',
    run: null, locked: false, revealed: false, timer: null,
    runStart: null,   // { xp, level } beim Start des Runs, für das Ergebnis
    debugOpen: false
  };

  // Eigene, vollständige Escape-Funktion (nicht von anderen Tabs abhängig)
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const fmtNum = n => String(Math.round(n * 100) / 100).replace('.', ',');

  // ---- Daten (nur lesen aus dem Karteikarten-Tab) ----

  function listSets() {
    const archived = subj => (typeof isSubjectArchived === 'function' ? isSubjectArchived(subj) : false);
    const sets = [];
    DB.get('subjects', []).filter(subj => !archived(subj)).forEach(subj => {
      const groups = subj.groups || [];
      sets.push({ key: 's:' + subj.id, label: subj.name, sub: false,
        deck: FBCore.buildDeck(groups.flatMap(g => g.cards || []), FBCore.plainText) });
      groups.forEach(g => sets.push({ key: 'g:' + g.id, label: g.name, sub: true,
        deck: FBCore.buildDeck(g.cards || [], FBCore.plainText) }));
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

  function monsterById(id) { return window.FB_MONSTERS.find(m => m.id === id) || { id, name: 'Unbekanntes Monster', emoji: '❔', tier: 'normal' }; }

  // Grafik, falls vorhanden – sonst (oder wenn das Bild fehlt) das Emoji
  function monsterArt(m, cls) {
    const emoji = `<span class="fb-emoji">${esc(m.emoji)}</span>`;
    if (!m.sprite) return `<div class="${cls}">${emoji}</div>`;
    return `<div class="${cls}"><img src="${esc(m.sprite)}" alt="${esc(m.name)}" data-emoji="${esc(m.emoji)}"></div>`;
  }
  // Fehlende Monster-Grafik → Emoji (statt Inline-onerror)
  function bindArtFallback() {
    state.root.querySelectorAll('img[data-emoji]').forEach(img => img.addEventListener('error', () => {
      const span = document.createElement('span');
      span.className = 'fb-emoji';
      span.textContent = img.dataset.emoji;
      img.replaceWith(span);
    }, { once: true }));
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

  function debugActive() { return Object.keys(DB.get(DEBUG_KEY, {})).length > 0; }

  // ---- Setup ----

  function renderSetup() {
    state.screen = 'setup';
    clearTimer();
    const sets = listSets();
    const selected = sets.find(s => s.key === state.setKey && FBCore.playable(s.deck));
    if (!selected) state.setKey = null;

    const setList = sets.length
      ? sets.map(s => {
          const ok = FBCore.playable(s.deck);
          const info = ok ? s.deck.length + ' Karten'
            : s.deck.length < FBCore.CONFIG.minCards ? 'Mindestens 2 Karten nötig' : 'Mindestens 2 verschiedene Antworten nötig';
          return `<button class="fb-set${s.sub ? ' fb-set-sub' : ''}${s.key === state.setKey ? ' active' : ''}"
                    data-key="${esc(s.key)}" ${ok ? '' : 'disabled'}>
                    <span class="fb-set-name">${esc(s.label)}</span>
                    <span class="fb-set-count">${info}</span>
                  </button>`;
        }).join('')
      : `<p class="fb-empty">Lege zuerst im Karteikarten-Tab Karten an.</p>`;

    state.root.innerHTML = `
      <div class="fb-setup">
        <div class="fb-setup-head">
          ${levelBar(readProgress().xp)}
          ${debugActive() ? '<span class="fb-debug-pill">Debug-Werte aktiv</span>' : ''}
          <button class="game-toggle-btn fb-debug-btn" id="fb-open-debug" title="Debug-Menü">🐞 Debug</button>
        </div>
        <div class="fb-setup-cols">
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
    state.root.querySelector('#fb-open-debug').addEventListener('click', openDebug);
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
    bindArtFallback();
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
                ${m.pet && need ? `<span class="fb-mon-pet">Haustier: ${Math.min(wins, need)}/${need}</span>` : ''}
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
    const streak = FBCore.currentStreak(p, today());
    const rows = [
      ['Gewonnene Kämpfe', p.runsWon],
      ['Besiegte Monster', c.monstersDefeated],
      ['Richtige Antworten', c.correct],
      ['Falsche Antworten', c.wrong],
      ['Höchste Combo', c.maxCombo],
      ['Kritische Treffer', c.crits],
      ['Gesammelte XP', p.xp],
      ['Level', FBCore.levelFromXp(p.xp).level],
      ['Endlos-Rekord', roomsText(p.bestEndless)],
      ['Lern-Streak', streak + (streak === 1 ? ' Tag' : ' Tage')]
    ];
    subScreen('Statistik', `
      <div class="fb-stat-grid">
        ${rows.map(([l, v]) => `<div class="fb-stat"><span class="fb-stat-label">${l}</span><span class="fb-stat-value">${v}</span></div>`).join('')}
      </div>`);
  }

  function roomsText(n) { return n + (n === 1 ? ' Raum' : ' Räume'); }

  // ---- Kampf ----

  function startBattle() {
    const set = listSets().find(s => s.key === state.setKey);
    if (!set || !FBCore.playable(set.deck)) return renderSetup();

    const p = FBCore.startRun(readProgress(), today());
    state.runStart = { xp: p.xp, level: FBCore.levelFromXp(p.xp).level };
    state.run = FBCore.createRun({ mode: state.mode, deck: set.deck, monsters: window.FB_MONSTERS, now: () => performance.now() });
    saveProgress(FBCore.applyEvents(p, state.run.events));
    state.locked = false;
    renderBattle();
  }

  function roomLabel(run) {
    if (run.mode === 'fixed') {
      if (run.room > FBCore.CONFIG.fixedRooms) return 'Endboss';
      return `Raum ${run.room}/${FBCore.CONFIG.fixedRooms} · Gegner ${run.fight}/${FBCore.CONFIG.monstersPerRoom}`;
    }
    if (run.mode === 'endless') return `Raum ${run.room}`;
    return `noch ${run.unanswered} Karten`;
  }

  function hpBar(cur, max, cls) {
    return `<div class="fb-bar ${cls}"><div class="fb-bar-fill" style="width:${Math.round(cur / max * 100)}%"></div></div>`;
  }

  // Jede Frage startet mit der Lesephase: erst nur die Frage, die Antworten
  // erscheinen nach CONFIG.readMs oder per Klick/Leertaste. Erst dann läuft
  // das Fenster für den kritischen Treffer.
  function renderBattle() {
    state.screen = 'battle';
    state.revealed = false;
    clearTimer();
    const run = state.run;
    const e = run.enemy;
    const m = monsterById(e.monsterId);
    const q = run.question;
    const readMs = Math.max(0, FBCore.CONFIG.readMs);

    state.root.innerHTML = `
      <div class="fb-battle">
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
        <div class="fb-main">
          <div class="fb-top">
            <span class="fb-room">${roomLabel(run)}</span>
            <span class="fb-combo${run.streak >= 2 ? ' on' : ''}">Combo x${fmtNum(FBCore.comboMultiplier(run.streak))}</span>
            <button class="game-toggle-btn fb-debug-btn" id="fb-open-debug" title="Debug-Menü">🐞</button>
            <button class="game-toggle-btn" id="fb-abort">Aufgeben</button>
          </div>
          <div class="fb-timer fb-timer-read" id="fb-timer"><div class="fb-timer-fill" style="animation-duration:${readMs}ms"></div></div>
          <div class="fb-question">${esc(q.prompt)}</div>
          <button class="game-action-btn fb-reveal" id="fb-reveal">Antworten zeigen <kbd>Leertaste</kbd></button>
          <div class="fb-options hidden" id="fb-options">
            ${q.options.map((o, i) => `
              <button class="fb-option" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(o)}</span></button>`).join('')}
          </div>
        </div>
        <div class="fb-banner hidden" id="fb-banner">Ein Boss erscheint!</div>
      </div>`;

    state.root.querySelector('#fb-abort').addEventListener('click', () => { abortActiveRun(); renderSetup(); });
    state.root.querySelector('#fb-open-debug').addEventListener('click', openDebug);
    state.root.querySelector('#fb-reveal').addEventListener('click', revealAnswers);
    state.root.querySelectorAll('.fb-option').forEach(b =>
      b.addEventListener('click', () => onAnswer(Number(b.dataset.i))));
    bindArtFallback();

    if (readMs === 0) revealAnswers();
    else state.timer = setTimeout(revealAnswers, readMs);
  }

  function revealAnswers() {
    if (state.screen !== 'battle' || state.revealed || !state.run || state.run.over) return;
    clearTimer();
    state.revealed = true;
    state.root.querySelector('#fb-reveal').classList.add('hidden');
    state.root.querySelector('#fb-options').classList.remove('hidden');
    const timer = state.root.querySelector('#fb-timer');
    timer.className = 'fb-timer fb-timer-crit';
    timer.innerHTML = `<div class="fb-timer-fill" style="animation-duration:${Math.max(0, FBCore.CONFIG.critWindowMs)}ms"></div>`;
    // Das Kritisch-Fenster startet erst jetzt, wo die Antworten sichtbar sind
    FBCore.startQuestionTimer(state.run);
  }

  // Aufgeben/Schließen: kein Sieg, aber ein Endlos-Rekord bleibt erhalten
  function abortActiveRun() {
    if (state.run) saveProgress(FBCore.applyEvents(readProgress(), FBCore.abortRun(state.run)));
    state.run = null;
  }

  function onAnswer(i) {
    // Gesperrt, solange das Feedback der letzten Antwort läuft (kein doppelter Treffer)
    if (state.screen !== 'battle' || !state.revealed || state.locked || state.debugOpen || !state.run || state.run.over) return;
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
    state.root.querySelector('#fb-timer').classList.add('stopped');

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

    const bossSpawn = events.find(e => e.type === 'spawn' && (e.tier === 'boss' || e.tier === 'miniboss'));
    const bossComing = !!bossSpawn;
    if (bossComing) {
      const banner = state.root.querySelector('#fb-banner');
      banner.textContent = bossSpawn.tier === 'miniboss' ? 'Ein Miniboss erscheint!'
        : run.mode === 'fixed' ? 'Der Endboss erscheint!' : 'Ein Boss erscheint!';
      banner.classList.remove('hidden');
    }

    state.timer = setTimeout(() => {
      state.locked = false;
      if (run.over) renderResult(events.find(e => e.type === 'end'));
      else renderBattle();
    }, bossComing ? BOSS_BANNER_MS : FEEDBACK_MS);
  }

  function setBar(sel, ratio) {
    const fill = state.root.querySelector(sel + ' .fb-bar-fill');
    if (fill) fill.style.width = Math.round(Math.min(1, Math.max(0, ratio)) * 100) + '%';
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

    // Endlos zählt wie der Rekord: geschaffte Räume
    const title = run.mode === 'endless' ? roomsText(run.roomsCleared) + ' geschafft' : (end.won ? 'Gewonnen!' : 'Besiegt');

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

  // ---- Debug-Menü (Testzwecke) ----
  // Werte werden in DB 'fb_debug' gespeichert und auf FBCore.CONFIG angewendet.
  // scale: Anzeige-Einheit (ms → s, Anteil → %).

  const DEBUG_FIELDS = [
    { group: 'Zeit', fields: [
      { path: 'readMs', label: 'Lesezeit Frage (s)', scale: 1000, step: 0.5 },
      { path: 'critWindowMs', label: 'Schnellangriff-Fenster (s)', scale: 1000, step: 0.5 },
      { path: 'critBonus', label: 'Schnellangriff-Bonus (×)', step: 0.1 }
    ]},
    { group: 'Spieler', fields: [
      { path: 'playerHp', label: 'Max-HP', step: 1 },
      { path: 'baseDamage', label: 'Schaden geben (Grundschaden)', step: 1 },
      { path: 'comboStep', label: 'Combo pro Treffer (+×)', step: 0.1 },
      { path: 'comboMax', label: 'Combo maximal (×)', step: 0.5 },
      { path: 'healBetweenRooms', label: 'Heilung nach jedem Raum', step: 1 }
    ]},
    ...['normal', 'rare', 'miniboss', 'boss'].map(t => ({ group: 'Gegner: ' + TIER_LABELS[t], fields: [
      { path: `enemy.${t}.hp`, label: 'HP', step: 1 },
      { path: `enemy.${t}.atk`, label: 'Schaden bekommen (Angriff)', step: 1 },
      { path: `enemy.${t}.xp`, label: 'XP', step: 1 }
    ]})),
    { group: 'Dungeon', fields: [
      { path: 'fixedRooms', label: 'Feste Räume: Anzahl', step: 1 },
      { path: 'monstersPerRoom', label: 'Feste Räume: Gegner pro Raum (inkl. Miniboss)', step: 1 },
      { path: 'endlessBossEvery', label: 'Endlos: Boss alle … Räume', step: 1 },
      { path: 'endlessScale', label: 'Endlos: Stärker pro Raum (%)', scale: 0.01, step: 1 },
      { path: 'cardModeBossCards', label: 'Kartenmodus: Boss bei … Karten', step: 1 },
      { path: 'rareChance', label: 'Chance seltenes Monster (%)', scale: 0.01, step: 1 }
    ]}
  ];

  const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
  function setPath(obj, path, val) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] = o[k] || {}), obj);
    target[last] = val;
  }

  function openDebug() {
    // Nicht während der Treffer-Animation: deren Timer führt zur nächsten Frage
    if (state.debugOpen || state.locked) return;
    state.debugOpen = true;
    clearTimer();   // Lesezeit pausiert, solange das Menü offen ist
    const toShown = (v, f) => (f.scale ? Math.round(v / f.scale * 100) / 100 : v);
    const inBattle = state.screen === 'battle' && state.run && !state.run.over;

    const live = inBattle ? `
      <div class="fb-debug-group">
        <span class="game-setting-label">Jetzt im Kampf</span>
        <label class="fb-debug-row"><span>Meine HP jetzt</span><input type="number" step="1" min="1" id="fb-live-player" value="${state.run.hp}"></label>
        <label class="fb-debug-row"><span>Monster-HP jetzt</span><input type="number" step="1" min="1" id="fb-live-enemy" value="${state.run.enemy.hp}"></label>
        <label class="fb-debug-row"><span>Monster-Angriff jetzt</span><input type="number" step="1" min="0" id="fb-live-atk" value="${state.run.enemy.atk}"></label>
      </div>` : '';

    const panel = document.createElement('div');
    panel.className = 'fb-debug';
    panel.innerHTML = `
      <div class="fb-debug-box" role="dialog" aria-label="Debug-Menü">
        <div class="fb-debug-head">
          <span class="fb-sub-title">🐞 Debug-Menü</span>
          <span class="fb-debug-note">Nur zum Testen. Gegner-Werte gelten ab dem nächsten Gegner, Max-HP ab dem nächsten Kampf.</span>
        </div>
        <div class="fb-debug-body">
          ${live}
          ${DEBUG_FIELDS.map(g => `
            <div class="fb-debug-group">
              <span class="game-setting-label">${g.group}</span>
              ${g.fields.map(f => {
                const cur = getPath(FBCore.CONFIG, f.path);
                const def = getPath(FBCore.DEFAULTS, f.path);
                return `<label class="fb-debug-row${cur !== def ? ' changed' : ''}">
                          <span>${f.label}</span>
                          <input type="number" step="${f.step}" min="0" data-path="${f.path}" value="${toShown(cur, f)}">
                          <small>Standard ${fmtNum(toShown(def, f))}</small>
                        </label>`;
              }).join('')}
            </div>`).join('')}
        </div>
        <div class="fb-debug-btns">
          <button class="game-action-btn" id="fb-debug-apply">Übernehmen</button>
          <button class="game-toggle-btn" id="fb-debug-reset">Standardwerte</button>
          <button class="game-toggle-btn" id="fb-debug-close">Schließen</button>
        </div>
      </div>`;
    state.root.appendChild(panel);

    panel.querySelector('#fb-debug-apply').addEventListener('click', () => {
      const overrides = {};
      DEBUG_FIELDS.forEach(g => g.fields.forEach(f => {
        const input = panel.querySelector(`input[data-path="${f.path}"]`);
        const raw = parseFloat(input.value.replace(',', '.'));
        if (!isFinite(raw) || raw < 0) return;
        const val = f.scale ? raw * f.scale : raw;
        if (Math.abs(val - getPath(FBCore.DEFAULTS, f.path)) > 1e-9) setPath(overrides, f.path, val);
      }));
      DB.set(DEBUG_KEY, overrides);
      FBCore.applyConfig(overrides);
      if (inBattle) applyLiveValues(panel);
      closeDebug();
    });
    panel.querySelector('#fb-debug-reset').addEventListener('click', () => {
      DB.set(DEBUG_KEY, {});
      FBCore.resetConfig();
      closeDebug();
    });
    panel.querySelector('#fb-debug-close').addEventListener('click', closeDebug);
  }

  function applyLiveValues(panel) {
    const run = state.run;
    const read = id => parseInt(panel.querySelector(id).value, 10);
    const hp = read('#fb-live-player');
    const ehp = read('#fb-live-enemy');
    const atk = read('#fb-live-atk');
    if (hp >= 1) { run.hp = hp; run.maxHp = Math.max(run.maxHp, hp); }
    if (ehp >= 1) { run.enemy.hp = ehp; run.enemy.maxHp = Math.max(run.enemy.maxHp, ehp); }
    if (atk >= 0) run.enemy.atk = atk;
  }

  // Nach dem Schließen den aktuellen Bildschirm neu aufbauen (im Kampf
  // beginnt die Lesephase der aktuellen Frage dabei von vorn)
  function closeDebug() {
    state.debugOpen = false;
    if (state.screen === 'battle' && state.run && !state.run.over) renderBattle();
    else if (state.screen === 'setup') renderSetup();
    else state.root.querySelector('.fb-debug')?.remove();
  }

  // ---- Tastatur: Leertaste/Enter zeigt die Antworten, 1–3 wählt eine ----

  function onKey(e) {
    if (state.screen !== 'battle' || state.debugOpen || e.repeat) return;
    if (!state.revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); revealAnswers(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= 3) { e.preventDefault(); onAnswer(n - 1); }
  }

  // ---- Lifecycle (wird vom Hub aufgerufen) ----

  function mount(container) {
    state.root = container;
    if (!window.FBCore) {
      container.innerHTML = '<p class="games-play-loading">Spiel konnte nicht geladen werden.</p>';
      return;
    }
    FBCore.applyConfig(DB.get(DEBUG_KEY, {}));
    state.root.classList.add('fb-root');
    document.addEventListener('keydown', onKey);
    renderSetup();
  }

  function destroy() {
    // Timer stoppen, sonst rendert er nach dem Schließen ins leere Modal.
    clearTimer();
    document.removeEventListener('keydown', onKey);
    if (window.FBCore) abortActiveRun();
    if (state.root) state.root.classList.remove('fb-root');
    state.root = null;
    state.locked = false;
    state.revealed = false;
    state.debugOpen = false;
    state.screen = 'setup';
  }

  window.registerGame({
    id: 'flashcard-battle',
    mount,
    destroy
  });

})();
