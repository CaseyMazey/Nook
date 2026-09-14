
(function () {

  /* =========================================================
     KONFIGURATION
     Zentrale Stellschrauben, damit sie leicht angepasst werden können.
     ========================================================= */

  // Feste Logik-/Koordinatenraum-Größe für das gesamte Spiel (Spawns,
  // Spielerposition, UI-Layout-Koordinaten wie Button-Y-Positionen, ...).
  // UNABHÄNGIG von der tatsächlichen Canvas-Backing-Store-Auflösung —
  // siehe fitCanvasToContainer() für die HiDPI-Skalierung.
  const LOGICAL_W = 960;
  const LOGICAL_H = 540;

  // Ab dieser Spielzeit (Sekunden, siehe `t` — läuft unabhängig vom Score
  // mit) dürfen Hunter (die verfolgenden Gegner) erstmals spawnen — siehe
  // spawnHazard(). Vorher soll sich der Spieler erst an Steuerung und
  // normale Gegner gewöhnen können. Bewusst zeit- statt punktebasiert,
  // damit die Freischaltung nicht davon abhängt, wie gut/schlecht gerade
  // gepunktet wird.
  const HUNTER_UNLOCK_TIME = 45;

  /* =========================================================
     PLUGIN-ZUSTAND
     Diese Referenzen werden erst in mount() befüllt — vorher
     existiert weder Canvas noch Container.
     ========================================================= */
  let canvas, ctx, hud, settingsBtnEl, permaPanelEl, runPanelEl;
  let rafId = null;
  let running = false;
  let canvasResizeObserver = null;

  // Benannte Handler-Referenzen — nötig, damit destroy() exakt
  // diese Listener wieder entfernen kann (besonders wichtig für
  // window-Listener, die nicht automatisch verschwinden, wenn
  // der Container aus dem DOM entfernt wird).
  let onCanvasMouseMove, onCanvasClick, onSettingsClick, onKeyDown, onKeyUp;
  let onCanvasTouchStart, onCanvasTouchMove, onCanvasTouchEnd;

  // Virtueller Joystick fürs Touch-Steuern (siehe onCanvasTouchStart/-Move):
  // touchOrigin ist der Startpunkt des Drags, touchVec die daraus abgeleitete
  // Richtung+Stärke (Länge 0..1), analog zu den digitalen WASD-Richtungen,
  // aber mit analoger Abstufung nahe der Totzone.
  let touchActive = false;
  let touchOrigin = { x: 0, y: 0 };
  let touchCurrent = { x: 0, y: 0 };
  let touchVec = { x: 0, y: 0 };
  const TOUCH_DEADZONE = 6;
  const TOUCH_MAX_RADIUS = 60;

  /* =========================================================
     HELPER-FUNKTIONEN
     Kleine Utilities für Mathe & Zufall
     ========================================================= */

  // Begrenzt einen Wert zwischen min und max
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Zufallswert zwischen a und b
  const rand = (a, b) => a + Math.random() * (b - a);

  // Quadratische Distanz (schneller als sqrt)
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx*dx + dy*dy;
  };

  /* =========================================================
     BASIS-STATE
     Deklarationen ohne Wert — die eigentliche Befüllung passiert
     in initState(), die mount() bei jedem Öffnen neu aufruft.
     Das sorgt auch dafür, dass z.B. ein über die Einstellungen
     ausgelöster Highscore-Reset beim nächsten Öffnen sofort
     berücksichtigt wird.
     ========================================================= */

  let W, H;
  let keys, mouse;
  let showMainMenu, showGameOverMenu, showShop, showStats, pendingGameOver;
  let showHighscore, showSettings, confirmResetHighscores, confirmNewGame;
  let menuButtons;
  // Tastatur-Fokus für das aktuell offene Menü — siehe getActiveMenuButtons()
  // und drawMenuButtons(). Wird bei jedem Menü-Wechsel auf einen sinnvollen
  // Startindex zurückgesetzt.
  let menuNav;
  let paused, gameOver, birdyVisible;
  let best;
  let highscores;
  let stats;
  let perma;
  let shopOptions, shopShake;
  let deathFX, timeScale;
  let t, score, runCoins;
  let nextMilestone, choosingBonus, countdownActive, countdownTime;
  let bonuses;
  let player;
  let hazards, coins, particles;
  // Ob gerade ein aktiver (nicht toter) Run existiert — steuert, ob
  // "Spiel fortsetzen" anklickbar ist und ob destroy() den Run speichert.
  let runActive;

  function isMenuOpen(){
    return (
      confirmResetHighscores ||
      confirmNewGame ||
      showMainMenu ||
      showHighscore ||
      showSettings ||
      choosingBonus ||
      showShop ||
      showGameOverMenu ||
      showStats
    );
  }

  function isClickableMenuOpen(){
    return (
      confirmResetHighscores ||
      confirmNewGame ||
      showMainMenu ||
      showHighscore ||
      showSettings ||
      choosingBonus ||
      showShop ||
      showGameOverMenu
      // PAUSE und STATS absichtlich NICHT dabei (keine Buttons dort)
    );
  }

  /* =========================================================
     STATISTIKEN / PERMA / AKTIVER RUN — LocalStorage-Keys
     Reine Konstanten, kein Per-Instanz-Zustand.
     ========================================================= */

  const statsKey     = "neon_dodge_stats";
  const highscoreKey = "neon_dodge_highscores";
  const permaKey     = "neon_dodge_perma";
  const activeRunKey = "neon_dodge_active_run";

  // Stats speichern
  const saveStats = () =>
    localStorage.setItem(statsKey, JSON.stringify(stats));

  function saveHighscore(score, coins){
    highscores.push({ score, coins });

    highscores.sort((a, b) => b.score - a.score);
    highscores = highscores.slice(0, 5);

    localStorage.setItem(
      highscoreKey,
      JSON.stringify(highscores)
    );
  }

  // Permanente Upgrades speichern
  function savePerma(){
    localStorage.setItem(permaKey, JSON.stringify(perma));
  }

  function resetPerma(){
    perma.speed  = 0;
    perma.hitbox = 0;
    perma.boost  = 0;
    savePerma();
  }

  /* =========================================================
     AKTIVER RUN — Speichern/Laden/Löschen
     Neon Dodge ist auf lange Runs ausgelegt: der komplette Spielzustand
     (nicht nur Score/Coins) wird beim Schließen des Modals gesichert und
     beim nächsten Öffnen wiederhergestellt — siehe initState() (Laden)
     und destroy() (Speichern). Absichtlich NICHT gespeichert: particles
     (rein kosmetische Kurzzeit-Effekte, wären beim nächsten Öffnen
     ohnehin längst abgelaufen).
     ========================================================= */

  function saveActiveRun(){
    const snapshot = {
      t, score, runCoins,
      player: {
        x: player.x,
        y: player.y,
        speedBoostUntil: player.speedBoostUntil
      },
      bonuses: { ...bonuses },
      nextMilestone,
      choosingBonus,
      hazards: hazards.map(h => ({ ...h })),
      coins:   coins.map(c => ({ ...c }))
    };
    localStorage.setItem(activeRunKey, JSON.stringify(snapshot));
  }

  function loadActiveRun(){
    const raw = localStorage.getItem(activeRunKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearActiveRun(){
    localStorage.removeItem(activeRunKey);
  }

  /* =========================================================
     INIT-STATE
     Befüllt den kompletten Spielzustand frisch aus localStorage.
     Wird von mount() aufgerufen, NACHDEM canvas existiert.
     ========================================================= */
  function initState(){
    // Fester Logik-Koordinatenraum — siehe KONFIGURATION oben. Bewusst
    // NICHT von canvas.width/height abgeleitet, da diese jetzt die
    // (HiDPI-skalierte) Backing-Store-Auflösung tragen, siehe
    // fitCanvasToContainer().
    W = LOGICAL_W;
    H = LOGICAL_H;

    keys  = new Set();
    mouse = { x: -1, y: -1 };
    menuNav = { index: 0 };

    // UI-Zustände
    showMainMenu = true;
    showGameOverMenu = false;
    showShop         = false;
    showStats        = false;
    pendingGameOver  = false;
    showHighscore    = false;
    showSettings     = false;
    confirmResetHighscores = false;
    confirmNewGame   = false;

    menuButtons = [
      {
        label: "Neues Spiel",
        y: 240, w: 280, h: 44,
        action: () => {
          if (runActive){
            confirmNewGame = true;
            showMainMenu = false;
            menuNav.index = 1; // Fokus auf "Abbrechen" — sichere Default-Wahl
          } else {
            startNewGame();
          }
        }
      },

      {
        label: "Spiel fortsetzen",
        y: 290, w: 280, h: 44,
        disabled: () => !runActive,
        action: () => { if (runActive) resumeGame(); }
      },

      {
        label: "Highscore",
        y: 340, w: 280, h: 44,
        action: () => {
          showHighscore = true;
          showMainMenu = false;
          menuNav.index = 0;
        }
      }
    ];

    // Laufzeit-Zustände
    paused  = false;
    gameOver = false;
    birdyVisible = true;

    // Highscore
    best = Number(
      localStorage.getItem("neon_dodge_best") || 0
    );

    highscores = JSON.parse(
      localStorage.getItem(highscoreKey) || "[]"
    );

    stats = JSON.parse(
      localStorage.getItem(statsKey) || "{}"
    );
    stats.deaths      ??= 0;
    stats.coins       ??= 0;
    stats.longestRun  ??= 0;

    perma = JSON.parse(
      localStorage.getItem(permaKey) || "{}"
    );
    perma.speed  ??= 0;   // +Speed %
    perma.hitbox ??= 0;   // kleinere Hitbox
    perma.boost  ??= 0;   // längerer Boost

    // Shop / Menü-State
    shopOptions = [];
    shopShake = { index: -1, t: 0, dur: 0.35 };

    // Death-FX
    deathFX = { t: 0, shake: 0 };
    timeScale = 1;

    // Zeit & Score
    t = 0;
    score = 0;
    runCoins = 0;

    // Meilenstein-Boni
    nextMilestone = 500;
    choosingBonus = false;
    countdownActive = false;
    countdownTime = 0;

    bonuses = {
      speedMult:  1,
      hitboxMult: 1,
      boostBonus: 0
    };

    // Player
    player = {
      x: W * 0.2,
      y: H * 0.5,
      r: 12,
      baseSpeed: 260,
      speedBoostUntil: 0
    };

    // Spiel-Objekte
    hazards   = []; // rote Gegner
    coins     = []; // gelbe Coins
    particles = []; // Effekte

    /* -------------------------
      GESPEICHERTEN RUN LADEN
      Falls beim letzten Schließen ein aktiver (nicht toter) Run
      gespeichert wurde, wird er hier vollständig wiederhergestellt.
      "Spiel fortsetzen" muss dadurch nur noch showMainMenu verlassen —
      der Zustand liegt schon bereit, exakt wie beim Schließen.
      ------------------------- */
    runActive = false;

    const savedRun = loadActiveRun();
    if (savedRun) {
      t        = savedRun.t ?? 0;
      score    = savedRun.score ?? 0;
      runCoins = savedRun.runCoins ?? 0;

      if (savedRun.player) {
        player.x = savedRun.player.x ?? player.x;
        player.y = savedRun.player.y ?? player.y;
        player.speedBoostUntil = savedRun.player.speedBoostUntil ?? 0;
      }

      if (savedRun.bonuses) {
        bonuses.speedMult  = savedRun.bonuses.speedMult  ?? 1;
        bonuses.hitboxMult = savedRun.bonuses.hitboxMult ?? 1;
        bonuses.boostBonus = savedRun.bonuses.boostBonus ?? 0;
      }

      nextMilestone = savedRun.nextMilestone ?? 500;
      choosingBonus = !!savedRun.choosingBonus;
      hazards = Array.isArray(savedRun.hazards) ? savedRun.hazards : [];
      coins   = Array.isArray(savedRun.coins)   ? savedRun.coins   : [];

      // Falls mitten in einer Meilenstein-Bonus-Wahl gespeichert wurde,
      // soll genau dieser Auswahlbildschirm beim Fortsetzen wieder
      // erscheinen (siehe getActiveMenuButtons()).
      paused = choosingBonus;

      runActive = true;
    }
  }

  /* =========================================================
     RESET-FUNKTION
     Setzt einen kompletten Run zurück und markiert ihn als aktiv
     (wird von startNewGame(), "Neustart" und der "R"-Taste genutzt —
     alle drei bedeuten "ab jetzt läuft ein neuer, speicherbarer Run").
     ========================================================= */
  function reset() {
    birdyVisible = true;

    // UI / Menü-Zustände
    showGameOverMenu = false;
    showShop         = false;
    showStats        = false;

    // Spielstatus
    paused   = false;
    gameOver = false;

    // Zeit & Score
    t     = 0;
    score = 0;
    runCoins = 0;


    // Spielobjekte leeren
    hazards.length   = 0;
    coins.length     = 0;
    particles.length = 0;

    // Spieler zurücksetzen
    player.x = W * 0.2;
    player.y = H * 0.5;
    player.speedBoostUntil = 0;

    // Run-Boni zurücksetzen
    bonuses.speedMult  = 1;
    bonuses.hitboxMult = 1;
    bonuses.boostBonus = 0;

    // Meilensteine
    nextMilestone = 500;
    choosingBonus = false;

    // Death-FX reset
    deathFX.t     = 0;
    deathFX.shake = 0;

    runActive = true;
  }

  /* =========================================================
     SPAWNER: GEFÄHRLICHE ORBS
     ========================================================= */
  function spawnHazard() {

    // Hunter erst ab HUNTER_UNLOCK_TIME Sekunden Spielzeit — vorher soll
    // sich der Spieler erst an Steuerung und normale Gegner gewöhnen können.
    const isHunter = t >= HUNTER_UNLOCK_TIME && Math.random() < 0.22;

    const side = Math.random() < 0.5 ? "right" : "top";


    let x, y, vx, vy;

    if (side === "right") {
      x  = W + 40;
      y  = rand(40, H - 40);
      vx = -rand(140, 260) * (1 + t / 90);
      vy = rand(-60, 60);
    } else {
      x  = rand(W * 0.45, W);
      y  = -40;
      vx = -rand(60, 160) * (1 + t / 120);
      vy = rand(160, 280) * (1 + t / 110);
    }

    hazards.push(
      isHunter
        ? {
            type: "hunter",
            x, y,
            r: rand(12, 18),
            speed: rand(110, 160),
            a: 0,
            life: 12   // 12s Lebenszeit
          }
        : {
            type: "normal",
            x, y, vx, vy,
            r: rand(10, 18),
            spin: rand(-3, 3),
            a: rand(0, Math.PI * 2)
          }
    );

  }

  /* =========================================================
     SPAWNER: COINS
     ========================================================= */
  function spawnCoin() {
    coins.push({
      x: W + 30,
      y: rand(40, H - 40),
      vx: -rand(160, 220),
      r: 10
    });
  }

  /* =========================================================
     PARTIKEL-EFFEKT (Explosion / Coin)
     ========================================================= */
  function puff(x, y, count, speed, life, kind) {

    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: Math.cos(rand(0, Math.PI * 2)) * rand(speed * 0.2, speed),
        vy: Math.sin(rand(0, Math.PI * 2)) * rand(speed * 0.2, speed),
        r: rand(1.5, 3.5),
        life,
        maxLife: life,
        kind
      });
    }
  }

  /* =========================================================
     MEILENSTEIN-BONUS WÄHLEN
     Gemeinsame Logik für Maus, Zahlen-Taste und Pfeil+Enter (siehe
     getActiveMenuButtons()).
     ========================================================= */
  function chooseBonus(i){
    const effects = [
      () => { bonuses.speedMult  += 0.05; },
      () => { bonuses.hitboxMult *= 0.92; },
      () => { bonuses.boostBonus += 0.5;  }
    ];
    if (effects[i]) effects[i]();

    choosingBonus = false;
    countdownActive = true;
    countdownTime = 2; // Sekunden
    paused = true;
    nextMilestone += 500;
  }

  /* =========================================================
     GENERISCHES MENÜ-SYSTEM
     Eine einzige Quelle für Buttons je offenem Menü — wird von Render
     (drawMenuButtons), Maus-Klick (handleCanvasClick) UND Tastatur
     (onKeyDown) gleichermaßen genutzt. Neue Menüs müssen hier nur einen
     weiteren Fall ergänzen und sind dadurch automatisch komplett per
     Maus UND Tastatur bedienbar.
     ========================================================= */
  function getActiveMenuButtons(){
    if (confirmNewGame) return [
      {
        label: "Ja, neues Spiel", y: 260, w: 320, h: 48,
        action: () => { confirmNewGame = false; startNewGame(); }
      },
      {
        label: "Abbrechen", y: 330, w: 320, h: 48,
        action: () => { confirmNewGame = false; showMainMenu = true; menuNav.index = 0; }
      }
    ];

    if (confirmResetHighscores) return [
      {
        label: "Ja, zurücksetzen", y: 260, w: 320, h: 48,
        action: () => {
          highscores = [];
          localStorage.removeItem(highscoreKey);
          best = 0;
          localStorage.setItem("neon_dodge_best", "0");

          confirmResetHighscores = false;
          showSettings = false;
          showMainMenu = true;
          paused = true;
          menuNav.index = 0;
        }
      },
      {
        label: "Abbrechen", y: 330, w: 320, h: 48,
        action: () => { confirmResetHighscores = false; }
      }
    ];

    if (showMainMenu) return menuButtons;

    if (showHighscore) return [
      {
        label: "Zurück", y: 360, w: 320, h: 48,
        action: () => { showHighscore = false; showMainMenu = true; menuNav.index = 0; }
      }
    ];

    if (showSettings) return [
      {
        label: "Highscores zurücksetzen", y: 230, w: 320, h: 48,
        action: () => { confirmResetHighscores = true; menuNav.index = 1; }
      },
      {
        label: "Zurück", y: 310, w: 320, h: 48,
        action: () => { showSettings = false; paused = false; }
      }
    ];

    if (choosingBonus) return [
      { label: "Speed +5 %",      y: 230, w: 320, h: 48, action: () => chooseBonus(0) },
      { label: "Kleinere Hitbox", y: 290, w: 320, h: 48, action: () => chooseBonus(1) },
      { label: "Längerer Boost",  y: 350, w: 320, h: 48, action: () => chooseBonus(2) }
    ];

    if (showShop) return [
      ...shopOptions.map((o, i) => ({
        label: `${o.label} (${o.cost})`,
        y: 220 + i * 80, w: 360, h: 52,
        dimmed: () => stats.coins < o.cost,
        action: () => {
          if (stats.coins < o.cost){
            shopShake.index = i;
            shopShake.t = shopShake.dur;
            return;
          }
          stats.coins -= o.cost;
          o.buy();
          saveStats();
          savePerma();
          generateShop();
          menuNav.index = 0;
        }
      })),
      {
        label: "Zurück", y: 460, w: 320, h: 48,
        action: () => { showShop = false; showGameOverMenu = true; menuNav.index = 0; }
      }
    ];

    if (showGameOverMenu) return [
      {
        label: "Neustart", y: 240, w: 320, h: 48,
        action: () => { showGameOverMenu = false; reset(); }
      },
      {
        label: "Upgrade-Shop", y: 310, w: 320, h: 48,
        action: () => { showGameOverMenu = false; showShop = true; generateShop(); menuNav.index = 0; }
      },
      {
        label: "Hauptmenü", y: 380, w: 320, h: 48,
        action: () => { showGameOverMenu = false; showMainMenu = true; paused = true; menuNav.index = 0; }
      }
    ];

    return [];
  }

  /* =========================================================
     INPUT: KEYDOWN
     Benannte Funktion statt Inline-Listener, damit destroy()
     genau diesen Handler wieder von window entfernen kann.
     Die eigentliche Registrierung (addEventListener) passiert
     in mount().
     ========================================================= */

  onKeyDown = (e) => {
    const key = e.key.toLowerCase();

    // ESC — Menüs schließen/zurück, wo sinnvoll (mandatorische Auswahl-
    // bzw. Terminal-Screens wie Meilenstein-Bonus oder Game-Over haben
    // bewusst KEIN Esc-Escape).
    if (e.key === "Escape" && confirmResetHighscores){
      confirmResetHighscores = false;
      return;
    }
    if (e.key === "Escape"){
      if (confirmNewGame){
        confirmNewGame = false;
        showMainMenu = true;
        menuNav.index = 0;
        return;
      }
      if (showHighscore){
        showHighscore = false;
        showMainMenu = true;
        menuNav.index = 0;
        return;
      }

      if (showSettings){
        showSettings = false;
        paused = false;
        return;
      }

      if (showStats){
        showStats = false;
        paused = false;
        return;
      }

      if (showShop){
        showShop = false;
        showGameOverMenu = true;
        menuNav.index = 0;
        return;
      }
    }

    // Scroll / Default verhindern
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) {
      e.preventDefault();
    }

    /* -------------------------
       GENERISCHE MENÜ-NAVIGATION
       Gilt für JEDES offene Menü (Hauptmenü, Meilenstein-Boni, Shop,
       Game-Over, Bestätigungsdialoge, Highscore, Einstellungen, ...) —
       siehe getActiveMenuButtons(). W/S bzw. Pfeile bewegen den Fokus,
       Enter/Space bestätigt, Zahlen wählen direkt aus (und bestätigen
       sofort). Jede Menüaktion ist dadurch komplett ohne Maus erreichbar.
       ------------------------- */
    if (isMenuOpen()){
      const menuBtns = getActiveMenuButtons();

      if (menuBtns.length){
        const isDisabled = (i) =>
          typeof menuBtns[i].disabled === "function" && menuBtns[i].disabled();

        if (["w","arrowup","s","arrowdown"].includes(key)){
          const dir = (key === "w" || key === "arrowup") ? -1 : 1;
          let next = menuNav.index;
          for (let i = 0; i < menuBtns.length; i++){
            next = (next + dir + menuBtns.length) % menuBtns.length;
            if (!isDisabled(next)) break;
          }
          menuNav.index = next;
          return;
        }

        if (key === "enter" || key === " "){
          menuNav.index = clamp(menuNav.index, 0, menuBtns.length - 1);
          if (!isDisabled(menuNav.index)) menuBtns[menuNav.index].action();
          return;
        }

        const num = Number(key);
        if (Number.isInteger(num) && num >= 1 && num <= menuBtns.length){
          const i = num - 1;
          if (!isDisabled(i)){
            menuNav.index = i;
            menuBtns[i].action();
          }
          return;
        }
      }

      return; // Menü offen → keine normale Spielsteuerung (WASD-Bewegung etc.)
    }

    keys.add(key);

    /* -------------------------
       NORMALE STEUERUNG
       ------------------------- */
    if (key === " ") paused = !paused;
    if (key === "r" && gameOver) reset();

    if (key === "t") {
      showStats = !showStats;
      paused = showStats ? true : paused;
    }

    if (paused && key === "m") {
      paused = true;
      showMainMenu = true;
      showStats = false;
      showShop = false;
      showGameOverMenu = false;
      menuNav.index = 0;
      return;
    }


  };

  /* =========================================================
     INPUT: KEYUP
     ========================================================= */
  onKeyUp = (e) => {
    keys.delete(e.key.toLowerCase());
  };
  /* =========================================================
     MAIN GAME LOOP
     ========================================================= */

  let last;

  function loop(now) {

    if (!running) return;

    // Delta-Time begrenzen (Frame-Spikes abfangen)
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    // Shop-Shake läuft unabhängig vom Game-Update (sonst im Shop eingefroren)
    if (shopShake.t > 0) {
      shopShake.t -= dt;
      if (shopShake.t <= 0) {
        shopShake.t = 0;
        shopShake.index = -1;
      }
    }

    if (countdownActive){
      countdownTime -= dt;
      if (countdownTime <= 0){
        countdownActive = false;
        paused = false;
      }
    }


    // Update läuft auch während Death-FX
    if ((!paused && !isMenuOpen()) || deathFX.t > 0){
      update(dt * timeScale);
    }





    // Render ist immer aktiv
    render();

    // Side-Panels aktualisieren
    if (running) {
      updatePermaPanel();
      updateRunPanel();

    }

    rafId = requestAnimationFrame(loop);


  }

    /* =========================================================
      UPDATE-LOGIK
      ========================================================= */
    function update(dt){

      /* -------------------------
        DEATH-FX (Shake + Pause)
        ------------------------- */
      if (deathFX.t > 0) {
        deathFX.t -= dt / timeScale;


        // leicht zurück in Richtung Normaltempo
        timeScale += (1 - timeScale) * 0.04;

        if (deathFX.t <= 0) {
          deathFX.t = 0;
          timeScale = 1;
          paused = true;

          if (pendingGameOver){
            pendingGameOver = false;
            showGameOverMenu = true;
            menuNav.index = 0;
          }
        }

        deathFX.shake *= 0.85;
      }



      /* -------------------------
        ZEIT
        ------------------------- */
      t += dt;

      /* -------------------------
        SPAWN-RATEN
        ------------------------- */
      const hazardRate = 0.65 + t * 0.01;
      const coinRate   = 0.22 + t * 0.002;

      if (Math.random() < hazardRate * dt) spawnHazard();
      if (Math.random() < coinRate   * dt) spawnCoin();

      /* -------------------------
        SPIELER-BEWEGUNG
        ------------------------- */
      let ax, ay;

      if (touchActive && (touchVec.x !== 0 || touchVec.y !== 0)) {
        // Touch-Joystick liefert bereits eine normierte Richtung mit
        // analoger Stärke (0..1 je nach Auslenkung) — nicht erneut auf
        // Länge 1 normalisieren, sonst geht die Analog-Abstufung verloren.
        ax = touchVec.x; ay = touchVec.y;
      } else {
        const up    = keys.has("w") || keys.has("arrowup");
        const down  = keys.has("s") || keys.has("arrowdown");
        const left  = keys.has("a") || keys.has("arrowleft");
        const right = keys.has("d") || keys.has("arrowright");

        ax = (right ? 1 : 0) - (left ? 1 : 0);
        ay = (down  ? 1 : 0) - (up   ? 1 : 0);

        const len = Math.hypot(ax, ay) || 1;
        ax /= len; ay /= len;
      }

      const speed =
        player.baseSpeed *
        (1 + perma.speed * 0.05) *
        bonuses.speedMult *
        (nowBoosted() ? 1.35 : 1.0);

      player.x = clamp(player.x + ax * speed * dt, player.r + 10, W - player.r - 10);
      player.y = clamp(player.y + ay * speed * dt, player.r + 10, H - player.r - 10);

      /* -------------------------
        HAZARDS
        ------------------------- */
      for (let i = hazards.length - 1; i >= 0; i--) {
        const h = hazards[i];

        // =========================
        // HUNTER BEWEGUNG
        // =========================
        if (h.type === "hunter") {
          h.life -= dt;
          if (h.life <= 0){
            hazards.splice(i,1);
            continue;
          }

          const dx = player.x - h.x;
          const dy = player.y - h.y;
          const len = Math.hypot(dx, dy) || 1;

          h.x += (dx / len) * h.speed * dt * (1 + t / 160);
          h.y += (dy / len) * h.speed * dt * (1 + t / 160);

          h.a += dt * 2;

          if (h.x < -80 || h.x > W + 80 || h.y < -80 || h.y > H + 80){
            hazards.splice(i,1);
          }

          continue;
        }


        // =========================
        // NORMALER ORB
        // =========================
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.a += h.spin * dt;

        if (h.y < 20 || h.y > H - 20) h.vy *= -1;
        if (h.x < -80 || h.y > H + 80) hazards.splice(i, 1);
      }


      /* -------------------------
        COINS
        ------------------------- */
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.x += c.vx * dt;
        if (c.x < -50) coins.splice(i, 1);
      }

      /* -------------------------
        PARTIKEL
        ------------------------- */
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      /* -------------------------
        KOLLISIONEN
      ------------------------- */

      // Wenn bereits Tod läuft → KEINE neue Kollision zulassen
      if (!pendingGameOver && !gameOver && deathFX.t <= 0){
        for (const h of hazards) {

          const pr = player.r * (1 - perma.hitbox * 0.06) * bonuses.hitboxMult;

          if (dist2(player.x, player.y, h.x, h.y) < (pr + h.r) ** 2) {

            gameOver = true;
            birdyVisible = false;

            pendingGameOver = true;
            showGameOverMenu = false;

            deathFX.t = 0.8;
            deathFX.shake = 12;
            timeScale = 0.2;
            paused = false;

            stats.deaths++;
            stats.longestRun = Math.max(stats.longestRun, t);
            saveStats();

            puff(player.x, player.y, 70, 260, 0.7, "boom");

            best = Math.max(best, Math.floor(score));
            saveHighscore(Math.floor(score), runCoins);
            localStorage.setItem("neon_dodge_best", String(best));

            // Der Run ist vorbei — nichts mehr zum Fortsetzen.
            clearActiveRun();
            runActive = false;

            break;
          }
        }
      }

      /* -------------------------
        COIN PICKUP
        ------------------------- */
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        if (dist2(player.x, player.y, c.x, c.y) < (player.r + c.r) ** 2) {
          coins.splice(i, 1);
          score += 12;
          runCoins++;
          stats.coins++;
          saveStats();


          player.speedBoostUntil =
            t + 2.2 + bonuses.boostBonus + perma.boost * 0.4;

          puff(c.x, c.y, 28, 180, 0.5, "coin");
        }
      }

      score += dt * (10 + t * 0.25);

      if (!choosingBonus && score >= nextMilestone) {
        choosingBonus = true;
        paused = true;
        menuNav.index = 0;
      }
    }


  /* =========================================================
     BOOST-STATUS
     ========================================================= */
  function nowBoosted(){
    return t < player.speedBoostUntil;
  }
  /* =========================================================
     RENDER – HILFSFUNKTIONEN
     ========================================================= */

  // Allgemeiner Glow-Effekt (wird selten direkt genutzt)
  function glow(x, y, r, color, blur){
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = blur;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle   = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Standard-Glow für Kreise (Coins, Player, Hazards)
  function glowCircle(x, y, r, color, blur){
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = blur;
    ctx.fillStyle   = color;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function drawButton(text, x, y, w, h, hovered){
  ctx.save();

  ctx.fillStyle = hovered ? "#1d2433" : "#0f1116";
  ctx.strokeStyle = hovered ? "#8aa7ff" : "#2c364b";
  ctx.lineWidth = 2;

  ctx.beginPath();

  if (ctx.roundRect) {
    ctx.roundRect(x - w/2, y - h/2, w, h, 10);
  } else {
    ctx.rect(x - w/2, y - h/2, w, h);
  }

  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e6e6e6";
  ctx.font = "500 18px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);

  ctx.restore();
}

  /* =========================================================
     GENERISCHES ZEICHNEN/HIT-TESTING FÜR MENÜ-BUTTONS
     Eine Instanz für alle Menüs (siehe getActiveMenuButtons()) — Maus-
     Hover UND Tastatur-Fokus (menuNav.index) bekommen dieselbe optische
     Hervorhebung, damit sich beide Eingabewege konsistent anfühlen.
     ========================================================= */
  function drawMenuButtons(buttons, focusIndex){
    buttons.forEach((btn, i) => {
      const w = btn.w || 320;
      const h = btn.h || 48;
      const isDisabled = typeof btn.disabled === "function" && btn.disabled();
      const isDimmed   = isDisabled || (typeof btn.dimmed === "function" && btn.dimmed());

      const hoveredByMouse =
        !isDisabled &&
        mouse.x > W/2 - w/2 && mouse.x < W/2 + w/2 &&
        mouse.y > btn.y - h/2 && mouse.y < btn.y + h/2;

      const focused = !isDisabled && i === focusIndex;

      ctx.globalAlpha = isDimmed ? 0.4 : 1;
      drawButton(btn.label, W/2, btn.y, w, h, hoveredByMouse || focused);
      ctx.globalAlpha = 1;
    });
  }

  function hitTestMenuButtons(buttons, x, y){
    for (let i = 0; i < buttons.length; i++){
      const btn = buttons[i];
      const w = btn.w || 320;
      const h = btn.h || 48;
      if (
        x > W/2 - w/2 && x < W/2 + w/2 &&
        y > btn.y - h/2 && y < btn.y + h/2
      ) return i;
    }
    return -1;
  }



  /* =========================================================
     RENDER – HAUPTFUNKTION
     ========================================================= */
  function render(){

    // Canvas leeren
    ctx.clearRect(0, 0, W, H);

    if (isMenuOpen()){
      if (confirmNewGame) return renderConfirmNewGame();
      if (confirmResetHighscores) return renderConfirmResetMenu();

      if (showMainMenu)     return renderMainMenu();

      if (showHighscore)   return renderHighscore();
      if (showSettings)    return renderSettings();
      if (choosingBonus)   return renderBonusMenu();
      if (showShop)        return renderShop();
      if (showGameOverMenu)return renderGameOverMenu();
      if (showStats)       return renderStats();
    }

    ctx.save();

    /* -------------------------
       DEATH-FX (Shake + Zoom)
       ------------------------- */
    if (deathFX.t > 0) {

      const s  = 1 + 0.03 * (deathFX.t / 0.35);
      const dx = (Math.random() - 0.5) * deathFX.shake;
      const dy = (Math.random() - 0.5) * deathFX.shake;

      ctx.translate(W / 2 + dx, H / 2 + dy);
      ctx.scale(s, s);
      ctx.translate(-W / 2, -H / 2);
    }

    /* -------------------------
       HINTERGRUND-GRID
       ------------------------- */
    ctx.globalAlpha = 0.22;
    ctx.lineWidth   = 1;
    ctx.strokeStyle = "#2b3345";

    for (let x = 0; x <= W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    for (let y = 0; y <= H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    /* -------------------------
       COINS
       ------------------------- */
    for (const c of coins) {

      glowCircle(c.x, c.y, c.r, "#f7d45a", 18);

      ctx.fillStyle = "#ffe8a0";
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = "#fff2c9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r - 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* -------------------------
       HAZARDS (rote Orbs)
       ------------------------- */
    for (const h of hazards) {

      if (h.type === "hunter")
        glowCircle(h.x, h.y, h.r, "#ff9b3e", 26);
      else
        glowCircle(h.x, h.y, h.r, "#ff5b6e", 22);


      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.a);

      ctx.fillStyle = h.type === "hunter" ? "#ffb347" : "#ff3e57";

      ctx.beginPath();

      // Spiky-Form
      const spikes = 10;
      for (let i = 0; i < spikes; i++) {
        const a  = (i / spikes) * Math.PI * 2;
        const rr = (i % 2 === 0) ? h.r : h.r * 0.65;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }

      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    /* -------------------------
      PLAYER
    ------------------------- */
    if (birdyVisible){
      const boosted = nowBoosted();

      glowCircle(
        player.x,
        player.y,
        player.r,
        boosted ? "#7cf0ff" : "#8aa7ff",
        boosted ? 30 : 22
      );

      ctx.fillStyle = boosted ? "#bff8ff" : "#c9d6ff";
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#0b0d12";
      ctx.beginPath();
      ctx.arc(player.x + 5, player.y - 3, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }


    /* -------------------------
       PARTIKEL
       ------------------------- */
    for (const p of particles) {

      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle =
        (p.kind === "coin") ? "#ffe8a0" : "#ff7b8b";

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* -------------------------
       TOUCH-JOYSTICK (nur sichtbar während eines aktiven Drags)
       ------------------------- */
    if (touchActive) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#8aa7ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(touchOrigin.x, touchOrigin.y, TOUCH_MAX_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#8aa7ff";
      ctx.beginPath();
      ctx.arc(
        touchOrigin.x + touchVec.x * TOUCH_MAX_RADIUS,
        touchOrigin.y + touchVec.y * TOUCH_MAX_RADIUS,
        16, 0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    /* -------------------------
       HUD (Text oben)
       ------------------------- */
      hud.textContent =
        `Score: ${Math.floor(score)} · Best: ${best} · Coins: ${stats.coins}`;


    /* -------------------------
       ROTER FLASH BEI TOD
       ------------------------- */
    if (deathFX.t > 0) {
      ctx.fillStyle =
        `rgba(255,60,80,${0.25 * (deathFX.t / 0.35)})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();

    if (countdownActive){
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0,0,W,H);

      ctx.textAlign = "center";
      ctx.fillStyle = "#e6e6e6";
      ctx.font = "700 72px system-ui";
      ctx.fillText(
        Math.ceil(countdownTime),
        W/2,
        H/2
      );

      ctx.restore();
      return;
    }
    /* -------------------------
       OVERLAYS (ohne Shake)
       ------------------------- */
    if (paused && !gameOver) {
      overlay(
        "PAUSE",
        "Space — Weiter · M — Hauptmenü"
      );
    }
  }

  /* =========================================================
     OVERLAY-HILFSFUNKTION
     ========================================================= */
  function overlay(title, subtitle){

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#e6e6e6";
    ctx.font = "700 44px system-ui,Segoe UI,Roboto,Arial";
    ctx.fillText(title, W / 2, H / 2 - 10);

    ctx.globalAlpha = 0.85;
    ctx.font = "500 18px system-ui,Segoe UI,Roboto,Arial";
    ctx.fillText(subtitle, W / 2, H / 2 + 26);
    ctx.restore();
  }

  /* =========================================================
     STATISTIK-OVERLAY
     ========================================================= */
  function renderStats(){
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0,0,W,H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#e6e6e6";
    ctx.font = "700 36px system-ui";
    ctx.fillText("STATISTIK", W/2, 120);

    ctx.font = "500 18px system-ui";
    ctx.fillText(`Längster Run: ${stats.longestRun.toFixed(1)} s`, W/2, 200);
    ctx.fillText(`Tode: ${stats.deaths}`, W/2, 230);
    ctx.fillText(`Coins gesammelt: ${stats.coins}`, W/2, 260);

    ctx.globalAlpha = 0.8;
    ctx.fillText("T zum Schließen", W/2, 320);
    ctx.restore();
  }

  /* =========================================================
     MEILENSTEIN-AUSWAHL (Run-Boni)
     ========================================================= */
  function renderBonusMenu(){
    ctx.save();

    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0,0,W,H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#e6e6e6";
    ctx.font = "700 36px system-ui";
    ctx.fillText("MEILENSTEIN", W/2, 140);

    drawMenuButtons(getActiveMenuButtons(), menuNav.index);

    ctx.restore();
  }


  /* =========================================================
     SHOP: Optionen generieren
     ========================================================= */
  function generateShop(){
    const pool = [
      {
        label: "Speed +5 %",
        cost: 20,
        buy: () => perma.speed++
      },
      {
        label: "Kleinere Hitbox",
        cost: 25,
        buy: () => perma.hitbox++
      },
      {
        label: "Längerer Boost",
        cost: 18,
        buy: () => perma.boost++
      }
    ];

    // 3 zufällige Optionen
    shopOptions = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  }

  /* =========================================================
     SHOP: Render
     ========================================================= */
  function renderShop(){
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0,0,W,H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#e6e6e6";
    ctx.font = "700 34px system-ui";
    ctx.fillText("UPGRADE-SHOP", W/2, 110);

    ctx.font = "500 18px system-ui";
    ctx.fillText(`Coins: ${stats.coins}`, W/2, 150);

    drawMenuButtons(getActiveMenuButtons(), menuNav.index);

    ctx.restore();
  }

  /* =========================================================
     SIDEBAR: Permanente Boni
     ========================================================= */
  function updatePermaPanel(){
    const el = permaPanelEl;
    if (!el) return;

    el.innerHTML = `
      <h3>Permanente Boni</h3>
      <ul>
        <li>Speed: +${perma.speed * 5}%</li>
        <li>Hitbox: −${perma.hitbox * 6}%</li>
        <li>Boost: +${(perma.boost * 0.4).toFixed(1)}s</li>
      </ul>
    `;
  }

  /* =========================================================
     SIDEBAR: Run-Boni
     ========================================================= */
  function updateRunPanel(){
    const el = runPanelEl;
    if (!el) return;

    el.innerHTML = `
      <h3>Run-Boni</h3>
      <ul>
        <li>Speed: ×${bonuses.speedMult.toFixed(2)}</li>
        <li>Hitbox: ×${bonuses.hitboxMult.toFixed(2)}</li>
        <li>Boost: +${bonuses.boostBonus.toFixed(1)}s</li>
      </ul>
    `;
  }

  /* =========================================================
     GAME OVER MENÜ
     ========================================================= */
  function renderGameOverMenu(){
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0,0,W,H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#e6e6e6";
    ctx.font = "700 42px system-ui";
    ctx.fillText("GAME OVER", W/2, 140);

    drawMenuButtons(getActiveMenuButtons(), menuNav.index);

    ctx.restore();
  }


  function renderMainMenu(){
    ctx.save();

    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0,0,W,H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#e6e6e6";
    ctx.font = "700 46px system-ui";
    ctx.fillText("NEON DODGE", W/2, 150);

    drawMenuButtons(menuButtons, menuNav.index);

    ctx.restore();
  }


  function renderHighscore(){
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0,0,W,H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#e6e6e6";
    ctx.font = "700 36px system-ui";
    ctx.fillText("HIGHSCORES", W/2, 140);

    ctx.font = "500 18px system-ui";

    if (highscores.length === 0) {
      ctx.fillText("Noch keine Einträge", W/2, 220);
    }

    highscores.forEach((h, i) => {
      ctx.fillText(
        `${i+1}. ${h.score} Punkte · ${h.coins} Coins`,
        W/2,
        200 + i * 32
      );
    });

    ctx.globalAlpha = 0.8;
    drawMenuButtons(getActiveMenuButtons(), menuNav.index);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

function renderSettings(){
  ctx.save();

  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0,0,W,H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e6e6e6";
  ctx.font = "700 36px system-ui";
  ctx.fillText("EINSTELLUNGEN", W/2, 140);

  drawMenuButtons(getActiveMenuButtons(), menuNav.index);

  ctx.restore();
}

function renderConfirmNewGame(){
  ctx.save();

  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0,0,W,H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e6e6e6";
  ctx.font = "700 32px system-ui";
  ctx.fillText("Neues Spiel starten?", W/2, 140);

  ctx.font = "500 16px system-ui";
  ctx.globalAlpha = 0.8;
  ctx.fillText("Es gibt bereits einen laufenden Spielstand.", W/2, 182);
  ctx.fillText("Er wird beim Start eines neuen Spiels gelöscht.", W/2, 206);
  ctx.globalAlpha = 1;

  drawMenuButtons(getActiveMenuButtons(), menuNav.index);

  ctx.restore();
}

function renderConfirmResetMenu(){
  ctx.save();

  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0,0,W,H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e6e6e6";
  ctx.font = "700 32px system-ui";
  ctx.fillText("Highscores zurücksetzen?", W/2, 150);

  ctx.font = "500 16px system-ui";
  ctx.globalAlpha = 0.8;
  ctx.fillText("Diese Aktion kann nicht rückgängig gemacht werden.", W/2, 190);
  ctx.globalAlpha = 1;

  drawMenuButtons(getActiveMenuButtons(), menuNav.index);

  ctx.restore();
}


/* =========================================================
   MAUS-KLICK
   Ein einziger, generischer Handler für alle Menüs — nutzt dieselbe
   Button-Liste (getActiveMenuButtons()) wie Rendering und Tastatur.
   ========================================================= */
function handleCanvasClick(x, y){
  if (!isMenuOpen()) return;

  const btns = getActiveMenuButtons();
  const i = hitTestMenuButtons(btns, x, y);
  if (i === -1) return;

  const btn = btns[i];
  const isDisabled = typeof btn.disabled === "function" && btn.disabled();
  if (isDisabled) return;

  menuNav.index = i;
  btn.action();
}

function startNewGame(){
  stats.coins = 0;
  saveStats();
  resetPerma();
  clearActiveRun();
  reset();
  showMainMenu = false;
}

function resumeGame(){
  if (!runActive) return;
  showMainMenu = false;
}

/* =========================================================
   MOUNT / DESTROY
   Die einzige Schnittstelle, die der Hub kennt. Alles andere
   oben ist reines Spiel-internes Detail.
   ========================================================= */

function mount(container){
  container.innerHTML = `
    <div class="neon-dodge-root">
      <div class="nd-stage">
        <div class="nd-top">
          <div id="neon-dodge-hud" class="nd-hud">Score: 0 · Best: 0</div>
          <button id="neon-dodge-settings-btn" class="nd-settings-btn" title="Einstellungen" aria-label="Einstellungen">⚙️</button>
        </div>
        <div class="nd-layout">
          <div class="nd-side nd-side-left">
            <div class="nd-panel" id="neon-dodge-perma-panel"></div>
            <div class="nd-hint">
              <div class="nd-touch-hint">Auf dem Spielfeld ziehen, um zu steuern &middot; Menüs per Antippen bedienen.</div>
              <div class="nd-kbd-hint">
                Steuerung:
                <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> /
                Pfeile · Pause: <kbd>Leertaste</kbd> · Neustart: <kbd>R</kbd> · Statistik <kbd>T</kbd>
              </div>
              <div class="nd-kbd-hint">
                Menüs: <kbd>↑</kbd><kbd>↓</kbd> wählen · <kbd>Enter</kbd> bestätigen · <kbd>Esc</kbd> zurück
              </div>
              <div>Ziel: Sammle die gelben Coins ein, weiche allem anderen aus.</div>
            </div>
          </div>
          <div class="nd-canvas-wrap">
            <canvas id="neon-dodge-canvas" class="nd-canvas" width="960" height="540"></canvas>
          </div>
          <div class="nd-side nd-side-right">
            <div class="nd-panel" id="neon-dodge-run-panel"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  canvas        = container.querySelector('#neon-dodge-canvas');
  ctx           = canvas.getContext('2d');
  hud           = container.querySelector('#neon-dodge-hud');
  settingsBtnEl = container.querySelector('#neon-dodge-settings-btn');
  permaPanelEl  = container.querySelector('#neon-dodge-perma-panel');
  runPanelEl    = container.querySelector('#neon-dodge-run-panel');

  // Frischen Zustand aus localStorage aufbauen (siehe initState()-Kommentar
  // weiter oben — inkl. eines evtl. gespeicherten aktiven Runs).
  initState();

  // Canvas füllt den verfügbaren Platz zwischen den Seitenbereichen maximal
  // aus, ohne sein 16:9-Seitenverhältnis zu verlieren. Setzt zusätzlich die
  // Backing-Store-Auflösung auf CSS-Größe × devicePixelRatio, damit Text
  // gestochen scharf bleibt (siehe fitCanvasToContainer()). Läuft bei jeder
  // Größenänderung des Wraps neu (Fenster-Resize, Modal-Öffnen).
  fitCanvasToContainer();
  canvasResizeObserver = new ResizeObserver(() => fitCanvasToContainer());
  canvasResizeObserver.observe(canvas.parentElement);

  // Rechnet Client-Koordinaten (z.B. e.clientX/Y oder Touch.clientX/Y) in
  // den festen Logik-Koordinatenraum LOGICAL_W/H um — siehe Kommentar in
  // onCanvasMouseMove weiter unten. Gemeinsam genutzt von Maus UND Touch.
  function toLogicalCoords(clientX, clientY){
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (LOGICAL_W / r.width),
      y: (clientY - r.top)  * (LOGICAL_H / r.height)
    };
  }

  onCanvasMouseMove = (e) => {
    const r = canvas.getBoundingClientRect();
    // Canvas wird per CSS auf Modal-Größe skaliert, die interne Zeichnung
    // nutzt aber immer den festen Logik-Koordinatenraum LOGICAL_W/H (siehe
    // KONFIGURATION) — daher hier auf diesen zurückrechnen, unabhängig von
    // der tatsächlichen Backing-Store-Auflösung (die für HiDPI-Schärfe
    // separat skaliert wird, siehe fitCanvasToContainer()).
    mouse.x = (e.clientX - r.left) * (LOGICAL_W / r.width);
    mouse.y = (e.clientY - r.top)  * (LOGICAL_H / r.height);

    if (!isClickableMenuOpen()){
      canvas.style.cursor = "default";
      return;
    }

    const btns = getActiveMenuButtons();
    const hoverIndex = hitTestMenuButtons(btns, mouse.x, mouse.y);
    const hoveredDisabled =
      hoverIndex !== -1 &&
      typeof btns[hoverIndex].disabled === "function" &&
      btns[hoverIndex].disabled();

    canvas.style.cursor = (hoverIndex !== -1 && !hoveredDisabled) ? "pointer" : "default";

    // Maus-Hover synchronisiert den Tastatur-Fokus, damit sich Maus- und
    // Tastatursteuerung konsistent anfühlen (siehe drawMenuButtons()).
    if (hoverIndex !== -1 && !hoveredDisabled) {
      menuNav.index = hoverIndex;
    }
  };

  onCanvasClick = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (LOGICAL_W / r.width);
    const y = (e.clientY - r.top)  * (LOGICAL_H / r.height);

    handleCanvasClick(x, y);
  };

  // Touch-Steuerung: Bei offenem Menü übernimmt der normale Click-Handler
  // (Tap löst synthetisch "click" aus) — hier NICHT preventDefault(en), sonst
  // würde dieses Click-Event unterdrückt. Läuft das Spiel, spannt der Drag
  // stattdessen einen virtuellen Joystick auf (siehe touchOrigin/touchVec).
  onCanvasTouchStart = (e) => {
    if (isMenuOpen()) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    const p = toLogicalCoords(t.clientX, t.clientY);
    touchActive = true;
    touchOrigin = p;
    touchCurrent = p;
    touchVec = { x: 0, y: 0 };
  };

  onCanvasTouchMove = (e) => {
    if (!touchActive) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    touchCurrent = toLogicalCoords(t.clientX, t.clientY);

    const dx = touchCurrent.x - touchOrigin.x;
    const dy = touchCurrent.y - touchOrigin.y;
    const d = Math.hypot(dx, dy);

    if (d < TOUCH_DEADZONE) {
      touchVec = { x: 0, y: 0 };
    } else {
      const clamped = Math.min(d, TOUCH_MAX_RADIUS);
      const mag = clamped / TOUCH_MAX_RADIUS;
      touchVec = { x: (dx / d) * mag, y: (dy / d) * mag };
    }
  };

  onCanvasTouchEnd = (e) => {
    touchActive = false;
    touchVec = { x: 0, y: 0 };
  };

  onSettingsClick = () => {
    showSettings = true;
    showMainMenu = false;
    paused = true;
    menuNav.index = 0;
  };

  canvas.addEventListener("mousemove", onCanvasMouseMove);
  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener("touchstart", onCanvasTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onCanvasTouchMove, { passive: false });
  canvas.addEventListener("touchend", onCanvasTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onCanvasTouchEnd, { passive: false });
  settingsBtnEl.addEventListener("click", onSettingsClick);

  // "pointer: coarse" (siehe neon-dodge.css) erkennt Touch nicht auf jedem
  // Gerät zuverlässig — zusätzlich per JS prüfen, damit der Touch-Hinweis
  // im Steuerungstext auch dort erscheint.
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    container.querySelector('.neon-dodge-root').classList.add('has-touch');
  }

  // Window-Listener: bewusst auf window (nicht Canvas), damit WASD/Pfeile
  // auch ohne Fokus auf dem Canvas funktionieren — destroy() entfernt sie
  // wieder, sonst würden sie nach dem Schließen des Modals weiterlaufen.
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);

  running = true;
  last = performance.now();
  rafId = requestAnimationFrame(loop);
}

function destroy(){
  // Aktiven (nicht toten) Run sichern, BEVOR irgendwas abgebaut wird —
  // Neon Dodge ist auf lange Runs ausgelegt, der Fortschritt darf beim
  // Schließen nicht verloren gehen (siehe initState() fürs Laden).
  if (runActive) {
    saveActiveRun();
  }

  // running=false lässt loop() beim nächsten Aufruf sofort zurückkehren,
  // OHNE ein weiteres requestAnimationFrame zu planen (siehe `if (!running) return;`
  // ganz am Anfang von loop()). cancelAnimationFrame() ist zusätzliche
  // Absicherung für das bereits geplante, aber noch nicht ausgeführte Frame.
  running = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (canvas) {
    canvas.removeEventListener("mousemove", onCanvasMouseMove);
    canvas.removeEventListener("click", onCanvasClick);
    canvas.removeEventListener("touchstart", onCanvasTouchStart);
    canvas.removeEventListener("touchmove", onCanvasTouchMove);
    canvas.removeEventListener("touchend", onCanvasTouchEnd);
    canvas.removeEventListener("touchcancel", onCanvasTouchEnd);
  }
  if (settingsBtnEl) {
    settingsBtnEl.removeEventListener("click", onSettingsClick);
  }
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);

  if (canvasResizeObserver) {
    canvasResizeObserver.disconnect();
    canvasResizeObserver = null;
  }

  canvas = ctx = hud = settingsBtnEl = permaPanelEl = runPanelEl = null;

  // Verhindert, dass ein beim Schließen unterbrochener Drag (kein touchend
  // mehr feuert nach dem Entfernen aus dem DOM) beim nächsten Öffnen als
  // "noch aktiver Joystick" hängen bleibt.
  touchActive = false;
  touchVec = { x: 0, y: 0 };
}

/* =========================================================
   CANVAS-FIT
   Berechnet die größte 16:9-Box, die in den verfügbaren Platz von
   .nd-canvas-wrap passt, und setzt sie als CSS-Darstellungsgröße.
   Setzt zusätzlich die Backing-Store-Auflösung auf CSS-Größe ×
   devicePixelRatio (statt fix 960×540), damit Text und Kanten auf
   hochauflösenden/skalierten Displays scharf bleiben — ohne dass sich
   dadurch die sichtbare Spielfeldgröße ändert. Der komplette Zeichen-
   code arbeitet weiterhin im festen 960×540-Logik-Koordinatenraum
   (LOGICAL_W/LOGICAL_H); ctx.setTransform() skaliert das transparent
   auf die tatsächliche Backing-Store-Auflösung.
   ========================================================= */
function fitCanvasToContainer(){
  if (!canvas || !ctx) return;
  const wrap = canvas.parentElement;
  if (!wrap) return;

  const availW = wrap.clientWidth;
  const availH = wrap.clientHeight;
  if (availW <= 0 || availH <= 0) return;

  // Schmale Hochkant-Screens bekommen den Landscape-Lock (siehe
  // .games-play-modal-box[data-game="neon-dodge"] in games.css) — das
  // Modal (und damit .nd-canvas-wrap) ist dort bereits als Querformat-Box
  // aufgespannt, wodurch die normale 16:9-Passung unten auch dort die
  // größtmögliche, unverzerrte Fläche ergibt. Kein Sonderfall mehr nötig.
  const ratio = LOGICAL_W / LOGICAL_H;
  let w = availW;
  let h = w / ratio;

  if (h > availH) {
    h = availH;
    w = h * ratio;
  }

  canvas.style.width  = `${w}px`;
  canvas.style.height = `${h}px`;

  const dpr = window.devicePixelRatio || 1;
  const backingW = Math.max(1, Math.round(w * dpr));
  const backingH = Math.max(1, Math.round(h * dpr));

  // Ändert man canvas.width/height, wird der Inhalt geleert UND der
  // Kontext-Transform vom Browser auf Identität zurückgesetzt — daher
  // ctx.setTransform() danach IMMER neu setzen (auch wenn sich die
  // Backing-Store-Größe gerade nicht geändert hat, schadet es nicht).
  if (canvas.width !== backingW || canvas.height !== backingH) {
    canvas.width  = backingW;
    canvas.height = backingH;
  }

  ctx.setTransform(backingW / LOGICAL_W, 0, 0, backingH / LOGICAL_H, 0, 0);
}

window.registerGame({
  id: 'neon-dodge',
  mount,
  destroy
});

})();
