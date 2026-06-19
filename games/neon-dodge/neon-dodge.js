
(function () {

  /* =========================================================
     PLUGIN-ZUSTAND
     Diese Referenzen werden erst in mount() befüllt — vorher
     existiert weder Canvas noch Container.
     ========================================================= */
  let canvas, ctx, hud, settingsBtnEl, permaPanelEl, runPanelEl;
  let rafId = null;
  let running = false;

  // Benannte Handler-Referenzen — nötig, damit destroy() exakt
  // diese Listener wieder entfernen kann (besonders wichtig für
  // window-Listener, die nicht automatisch verschwinden, wenn
  // der Container aus dem DOM entfernt wird).
  let onCanvasMouseMove, onCanvasClick, onSettingsClick, onKeyDown, onKeyUp;

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
  let UI;
  let playerName;
  let menuButtons;
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

  /* =========================================================
    ZUKÜNFTIGER UI-STATE (Vorbereitung)
    Noch nix ersetzt — nur vorbereitet
  ========================================================= */

  // Hilfsfunktion — lesen statt denken
  function setUI(state){
    UI.state = state;
  }

  function isMenuOpen(){
    if (UI.state !== null) return true;
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


  function uiMenuActive(){
    return UI.state !== null;
  }


  function isClickableMenuOpen(){
    return (
      confirmResetHighscores ||
      confirmNewGame ||
      showMainMenu ||
      showSettings ||
      choosingBonus ||
      showShop ||
      showGameOverMenu
      // PAUSE absichtlich NICHT dabei
    );
  }

  function uiClickable(){
    return uiMenuActive();
  }

  /* =========================================================
     STATISTIKEN / PERMA — LocalStorage-Keys
     Reine Konstanten, kein Per-Instanz-Zustand.
     ========================================================= */

  const statsKey     = "neon_dodge_stats";
  const highscoreKey = "neon_dodge_highscores";
  const permaKey     = "neon_dodge_perma";

  // Stats speichern
  const saveStats = () =>
    localStorage.setItem(statsKey, JSON.stringify(stats));

  function saveHighscore(name, score, coins){
    highscores.push({ name, score, coins });

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
     INIT-STATE
     Befüllt den kompletten Spielzustand frisch aus localStorage.
     Wird von mount() aufgerufen, NACHDEM canvas existiert (W/H
     hängen von canvas.width/height ab).
     ========================================================= */
  function initState(){
    W = canvas.width;
    H = canvas.height;

    keys  = new Set();
    mouse = { x: -1, y: -1 };

    // UI-Zustände
    showMainMenu = false;
    showGameOverMenu = false;
    showShop         = false;
    showStats        = false;
    pendingGameOver  = false;
    showHighscore    = false;
    showSettings     = false;
    confirmResetHighscores = false;
    confirmNewGame   = false;

    UI = { state: null };
    setUI("main");

    playerName = localStorage.getItem("neon_dodge_player") || "Player";

    menuButtons = [
      {
        label: "Neues Spiel",
        y: 240,
        action: () => {
          if (t > 0 || stats.coins > 0 || perma.speed > 0 || perma.hitbox > 0 || perma.boost > 0){
            confirmNewGame = true;
            showMainMenu = false;
          } else {
            startNewGame();
          }
        }
      },

      {
        label: `Spiel fortsetzen (${playerName})`,
        y: 290,
        action: () => resumeGame()
      },

      { label: "Highscore",        y: 340, action: () => {
          showHighscore = true;
          setUI(null);

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
  }

  /* =========================================================
     RESET-FUNKTION
     Setzt einen kompletten Run zurück
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
  }

  /* =========================================================
     SPAWNER: GEFÄHRLICHE ORBS
     ========================================================= */
  function spawnHazard() {

    // Spawn-Seite bestimmen
    const isHunter = Math.random() < 0.22; // 22% Chance Hunter

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
     INPUT: KEYDOWN
     Benannte Funktion statt Inline-Listener, damit destroy()
     genau diesen Handler wieder von window entfernen kann.
     Die eigentliche Registrierung (addEventListener) passiert
     in mount().
     ========================================================= */

  onKeyDown = (e) => {
    const key = e.key.toLowerCase();

    if (e.key === "Escape" && confirmResetHighscores){
      confirmResetHighscores = false;
      return;
    }
    // ESC → Menü schließen
    if (e.key === "Escape"){
      if (showHighscore){
        showHighscore = false;
        showMainMenu = true;
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
        return;
      }
    }



    if (showSettings && key === "1") {
      highscores = [];
      localStorage.removeItem(highscoreKey);
      best = 0;
      localStorage.setItem("neon_dodge_best", "0");
      showSettings = false;
      paused = false;
      return;
    }

    // Scroll / Default verhindern
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) {
      e.preventDefault();
    }


    /* -------------------------
      MAIN MENU
      ------------------------- */
    if (UI.state === "main") {

      if (key === "1") {
        playerName =
          prompt("Name eingeben (max. 20 Zeichen):", "") || "Player";
        playerName = playerName.slice(0, 20);

        stats.coins = 0;     // ← Coins reset
        saveStats();         // ← persistieren
        resetPerma();
        reset();
        showMainMenu = false;
      }

      if (key === "2") {
        showMainMenu = false;
      }
      if (key === "3") {
        showHighscore = true;
        showMainMenu = false;
      }
      return;
    }

    keys.add(key);

    /* -------------------------
       GAME OVER MENÜ
       ------------------------- */
    if (showGameOverMenu) {

      if (key === "1") {
        showGameOverMenu = false;
        reset();
      }

      if (key === "2") {
        showGameOverMenu = false;
        showShop = true;
        generateShop();
      }

      if (key === "3") {
        showGameOverMenu = false;
        showMainMenu = true;
        paused = true;
      }

      return;
    }


    /* -------------------------
       SHOP
       ------------------------- */
    if (showShop) {

      if (["1","2","3"].includes(e.key)) {
        const opt = shopOptions[Number(e.key) - 1];

        if (opt && stats.coins >= opt.cost) {
        stats.coins -= opt.cost;
        opt.buy();
        saveStats();
        savePerma();
        generateShop();

      } else {
        shopShake.index = Number(e.key) - 1;
        shopShake.t = shopShake.dur;
      }


      }

      return;
    }

    /* -------------------------
       MEILENSTEIN-BONI
       ------------------------- */
    if (choosingBonus) {

      if (key === "1") bonuses.speedMult  += 0.05;
      if (key === "2") bonuses.hitboxMult *= 0.92;
      if (key === "3") bonuses.boostBonus += 0.5;

      if (["1","2","3"].includes(key)) {
        choosingBonus = false;
        countdownActive = true;
        countdownTime = 2; // Sekunden
        paused = true;
        nextMilestone += 500;

      }

      return;
    }

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
      const up    = keys.has("w") || keys.has("arrowup");
      const down  = keys.has("s") || keys.has("arrowdown");
      const left  = keys.has("a") || keys.has("arrowleft");
      const right = keys.has("d") || keys.has("arrowright");

      let ax = (right ? 1 : 0) - (left ? 1 : 0);
      let ay = (down  ? 1 : 0) - (up   ? 1 : 0);

      const len = Math.hypot(ax, ay) || 1;
      ax /= len; ay /= len;

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
            saveHighscore(playerName, Math.floor(score), runCoins);
            localStorage.setItem("neon_dodge_best", String(best));

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
     RENDER – HAUPTFUNKTION
     ========================================================= */
  function render(){

    // Canvas leeren
    ctx.clearRect(0, 0, W, H);

    if (isMenuOpen()){
      if (confirmNewGame) return renderConfirmNewGame();
      if (confirmResetHighscores){
        return renderConfirmResetMenu();
      }

      if (UI.state === "main") return renderMainMenu();

      if (showHighscore)   return renderHighscore();
      if (showSettings)    return renderSettingsMenu();
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
       HUD (Text oben)
       ------------------------- */
      hud.textContent =
        `${playerName} · Score: ${Math.floor(score)} · Best: ${best} · Coins: ${stats.coins}`;


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


    if (showMainMenu)         renderMainMenu();
    else if (showHighscore)  renderHighscore();
    else if (showSettings)   renderSettings();
    else {

      if (showStats)        renderStats();
      if (showGameOverMenu) renderGameOverMenu();
      if (choosingBonus)    renderBonusChoice();
      if (showShop)         renderShop();
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
     START
     Der eigentliche Start (initState + reset + Loop) passiert
     jetzt in mount() — nicht mehr automatisch beim Laden des
     Skripts, da das Skript nur einmal geladen, mount() aber bei
     jedem Öffnen erneut aufgerufen wird.
     ========================================================= */
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

    const buttons = [
      { label: "Speed +5 %",      y: 230, action: () => bonuses.speedMult += 0.05 },
      { label: "Kleinere Hitbox", y: 290, action: () => bonuses.hitboxMult *= 0.92 },
      { label: "Längerer Boost",  y: 350, action: () => bonuses.boostBonus += 0.5 }
    ];

    buttons.forEach(btn => {
      const hovered =
        mouse.x > W/2 - 160 &&
        mouse.x < W/2 + 160 &&
        mouse.y > btn.y - 24 &&
        mouse.y < btn.y + 24;

      drawButton(btn.label, W/2, btn.y, 320, 48, hovered);
    });

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

    shopOptions.forEach((o, i) => {
      const y = 220 + i * 80;

      const hovered =
        mouse.x > W/2 - 180 &&
        mouse.x < W/2 + 180 &&
        mouse.y > y - 26 &&
        mouse.y < y + 26;

      const affordable = stats.coins >= o.cost;

      ctx.globalAlpha = affordable ? 1 : 0.35;

      drawButton(
        `${o.label} (${o.cost})`,
        W/2,
        y,
        360,
        52,
        hovered && affordable
      );

      ctx.globalAlpha = 1;
    });

    const backHover =
      mouse.x > W/2 - 160 &&
      mouse.x < W/2 + 160 &&
      mouse.y > 400 - 24 &&
      mouse.y < 400 + 24;

    drawButton("Zurück", W/2, 460, 320, 48, backHover);

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

    const buttons = [
      { text: "Neustart",        y: 240, action: () => { showGameOverMenu = false; reset(); } },
      { text: "Upgrade-Shop",    y: 310, action: () => { showGameOverMenu = false; showShop = true; generateShop(); } },
      { text: "Hauptmenü",       y: 380, action: () => { showGameOverMenu = false; showMainMenu = true; paused = true; } }
    ];

    buttons.forEach(b => {
      const hovered =
        mouse.x > W/2 - 160 &&
        mouse.x < W/2 + 160 &&
        mouse.y > b.y - 24 &&
        mouse.y < b.y + 24;

      drawButton(b.text, W/2, b.y, 320, 48, hovered);
    });

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

    menuButtons.forEach(btn => {
      const hovered =
        mouse.x > W/2 - 140 &&
        mouse.x < W/2 + 140 &&
        mouse.y > btn.y - 22 &&
        mouse.y < btn.y + 22;

      drawButton(btn.label, W/2, btn.y, 280, 44, hovered);
    });

    ctx.font = "500 14px system-ui";
    ctx.globalAlpha = 0.7;
    ctx.fillText("Steuerung: 1 / 2 / 3 oder Maus", W/2, 400);

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
        `${i+1}. ${h.name} — ${h.score} Punkte · ${h.coins} Coins`,
        W/2,
        200 + i * 32
      );
    });

    ctx.globalAlpha = 0.8;

    const hoveredBack =
      mouse.x > W/2 - 160 &&
      mouse.x < W/2 + 160 &&
      mouse.y > 360 - 24 &&
      mouse.y < 360 + 24;

    drawButton(
      "Zurück",
      W/2, 360, 320, 48,
      hoveredBack
    );

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

  const hoveredReset =
    mouse.x > W/2 - 160 &&
    mouse.x < W/2 + 160 &&
    mouse.y > 230 - 24 &&
    mouse.y < 230 + 24;

  drawButton(
    "Highscores zurücksetzen",
    W/2, 230, 320, 48,
    hoveredReset
  );

  const hoveredBack =
    mouse.x > W/2 - 160 &&
    mouse.x < W/2 + 160 &&
    mouse.y > 310 - 24 &&
    mouse.y < 310 + 24;

  drawButton(
    "Zurück",
    W/2, 310, 320, 48,
    hoveredBack
  );

  ctx.restore();
}

function renderConfirmNewGame(){
  ctx.save();

  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0,0,W,H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e6e6e6";
  ctx.font = "700 32px system-ui";
  ctx.fillText("Neues Spiel starten?", W/2, 150);

  ctx.font = "500 16px system-ui";
  ctx.globalAlpha = 0.8;
  ctx.fillText("Dein aktueller Fortschritt geht verloren.", W/2, 190);
  ctx.globalAlpha = 1;

  const yesHover =
    mouse.x > W/2 - 160 &&
    mouse.x < W/2 + 160 &&
    mouse.y > 260 - 24 &&
    mouse.y < 260 + 24;

  drawButton("Ja, neues Spiel", W/2, 260, 320, 48, yesHover);

  const noHover =
    mouse.x > W/2 - 160 &&
    mouse.x < W/2 + 160 &&
    mouse.y > 330 - 24 &&
    mouse.y < 330 + 24;

  drawButton("Abbrechen", W/2, 330, 320, 48, noHover);

  ctx.restore();
}




function handleCanvasClick(x, y){
  if (showHighscore){
    // Zurück
    if (
      x > W/2 - 160 &&
      x < W/2 + 160 &&
      y > 360 - 24 &&
      y < 360 + 24
    ){
      showHighscore = false;
      showMainMenu = true;
      return;
    }
  }

  if (confirmResetHighscores){
    // JA
    if (
      x > W/2 - 160 &&
      x < W/2 + 160 &&
      y > 260 - 24 &&
      y < 260 + 24
    ){
      highscores = [];
      localStorage.removeItem(highscoreKey);
      best = 0;
      localStorage.setItem("neon_dodge_best", "0");

      confirmResetHighscores = false;
      showSettings = false;
      showMainMenu = true;
      paused = true;

      return;
      
    }

    // NEIN
    if (
      x > W/2 - 160 &&
      x < W/2 + 160 &&
      y > 330 - 24 &&
      y < 330 + 24
    ){
      confirmResetHighscores = false;
      return;
    }
  }

  if (confirmNewGame){

    // JA
    if (
      x > W/2 - 160 &&
      x < W/2 + 160 &&
      y > 260 - 24 &&
      y < 260 + 24
    ){
      confirmNewGame = false;
      startNewGame();
      return;
    }

    // NEIN
    if (
      x > W/2 - 160 &&
      x < W/2 + 160 &&
      y > 330 - 24 &&
      y < 330 + 24
    ){
      confirmNewGame = false;
      showMainMenu = true;
      return;
    }
  }

  if (UI.state === "main"){

    for (const btn of menuButtons){
      if (
        x > W/2 - 140 &&
        x < W/2 + 140 &&
        y > btn.y - 22 &&
        y < btn.y + 22
      ){
        btn.action();
        return;
      }
    }
  }


  // Main Menu
  if (showMainMenu){
    if (y > 220 && y < 260) { // Neues Spiel
      showMainMenu = false;
      reset();
    }
    if (y > 260 && y < 300) { // Fortsetzen
      showMainMenu = false;
    }
    if (y > 300 && y < 340) { // Highscore
      showHighscore = true;
      showMainMenu = false;
    }
  }

  if (choosingBonus){
    const options = [
      () => bonuses.speedMult += 0.05,
      () => bonuses.hitboxMult *= 0.92,
      () => bonuses.boostBonus += 0.5
    ];

    for (let i = 0; i < options.length; i++){
      const by = 230 + i * 60;
      if (
        x > W/2 - 160 &&
        x < W/2 + 160 &&
        y > by - 24 &&
        y < by + 24
      ){
        options[i]();
        choosingBonus = false;
        paused = false;
        nextMilestone += 500;
        return;
      }
    }
  }

 if (showSettings){
    // Reset Highscores → Nachfrage
    if (
      x > W/2 - 160 &&
      x < W/2 + 160 &&
      y > 230 - 24 &&
      y < 230 + 24
    ){
      confirmResetHighscores = true;
      return;
    }


    // Zurück
    if (
      x > W/2 - 160 &&
      x < W/2 + 160 &&
      y > 310 - 24 &&
      y < 310 + 24
    ){
      showSettings = false;
      paused = false;
      return;
    }
  }
  if (showGameOverMenu){
    const buttons = [
      { y: 240, action: () => { showGameOverMenu = false; reset(); } },
      { y: 310, action: () => { showGameOverMenu = false; showShop = true; generateShop(); } },
      { y: 380, action: () => { showGameOverMenu = false; showMainMenu = true; paused = true; } }
    ];

    for (const b of buttons){
      if (
        x > W/2 - 160 &&
        x < W/2 + 160 &&
        y > b.y - 24 &&
        y < b.y + 24
      ){
        b.action();
        return;
      }
    }

    return;
  }

  if (showShop){
  shopOptions.forEach((o, i) => {
    const y = 220 + i * 70;
    if (
      x > W/2 - 180 &&
      x < W/2 + 180 &&
      y > y - 26 &&
      y < y + 26
    ){
      if (stats.coins >= o.cost){
        stats.coins -= o.cost;
        o.buy();
        saveStats();
        savePerma();
        generateShop();
      }
    }
  });

  // Zurück
  if (
    x > W/2 - 160 &&
    x < W/2 + 160 &&
    y > 400 - 24 &&
    y < 400 + 24
  ){
    showShop = false;
    showGameOverMenu = true;
  }

  return;
}
}



function isClickableAt(x, y){

  // MAIN MENU
  if (showMainMenu){
    if (y > 220 && y < 260) return true; // Neues Spiel
    if (y > 260 && y < 300) return true; // Fortsetzen
    if (y > 300 && y < 340) return true; // Highscore
  }

  // GAME OVER MENU
  if (showGameOverMenu){
    const buttons = [
      { y: 240, action: () => { showGameOverMenu = false; reset(); } },
      { y: 310, action: () => { showGameOverMenu = false; showShop = true; generateShop(); } },
      { y: 380, action: () => { showGameOverMenu = false; showMainMenu = true; paused = true; } }
    ];

    for (const b of buttons){
      if (
        x > W/2 - 160 &&
        x < W/2 + 160 &&
        y > b.y - 24 &&
        y < b.y + 24
      ){
        b.action();
        return;
      }
    }
  }


  return false;
}

function startNewGame(){
  playerName =
    prompt("Name eingeben (max. 20 Zeichen):", "") || "Player";
  playerName = playerName.slice(0, 20);
  localStorage.setItem("neon_dodge_player", playerName);


  stats.coins = 0;
  saveStats();
  resetPerma();
  reset();
  showMainMenu = false;
}

function resumeGame(){
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
      <div class="nd-top">
        <div id="neon-dodge-hud" class="nd-hud">Score: 0 · Best: 0</div>
        <button id="neon-dodge-settings-btn" class="nd-settings-btn" title="Einstellungen" aria-label="Einstellungen">⚙️</button>
      </div>
      <canvas id="neon-dodge-canvas" class="nd-canvas" width="960" height="540"></canvas>
      <div class="nd-panels">
        <div class="nd-panel" id="neon-dodge-perma-panel"></div>
        <div class="nd-panel" id="neon-dodge-run-panel"></div>
      </div>
      <div class="nd-hint">
        <div>
          Steuerung:
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> /
          Pfeile · Pause: <kbd>Leertaste</kbd> · Neustart: <kbd>R</kbd> · Statistik <kbd>T</kbd>
        </div>
        <div>Ziel: Sammle die gelben Coins ein, weiche allem anderen aus.</div>
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
  // weiter oben — wichtig u.a. nach einem Reset über die Einstellungen).
  initState();

  onCanvasMouseMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;

    if (!isClickableMenuOpen()){
      canvas.style.cursor = "default";
      return;
    }

    canvas.style.cursor =
      showMainMenu &&
      menuButtons.some(btn =>
        mouse.x > W/2 - 140 &&
        mouse.x < W/2 + 140 &&
        mouse.y > btn.y - 22 &&
        mouse.y < btn.y + 22
      )
      ? "pointer"
      : "default";
  };

  onCanvasClick = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    handleCanvasClick(x, y);
  };

  onSettingsClick = () => {
    showSettings = true;
    showMainMenu = false;
    paused = true;
  };

  canvas.addEventListener("mousemove", onCanvasMouseMove);
  canvas.addEventListener("click", onCanvasClick);
  settingsBtnEl.addEventListener("click", onSettingsClick);

  // Window-Listener: bewusst auf window (nicht Canvas), damit WASD/Pfeile
  // auch ohne Fokus auf dem Canvas funktionieren — destroy() entfernt sie
  // wieder, sonst würden sie nach dem Schließen des Modals weiterlaufen.
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);

  running = true;
  last = performance.now();
  reset();
  rafId = requestAnimationFrame(loop);
}

function destroy(){
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
  }
  if (settingsBtnEl) {
    settingsBtnEl.removeEventListener("click", onSettingsClick);
  }
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);

  canvas = ctx = hud = settingsBtnEl = permaPanelEl = runPanelEl = null;
}

window.registerGame({
  id: 'neon-dodge',
  mount,
  destroy
});

})();
