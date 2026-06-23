// =========================
// COZY HOME - PHASE 4
// Mehr Haustiere, Persönlichkeiten,
// Inventar & Shop
// =========================

(function () {

    const SAVE_KEY        = "cozyHomeData";
    const TICK_INTERVAL_MS = 60000;
    const SLEEP_THRESHOLD  = 20;


    // ====================================
    // INVENTAR-ANZEIGECONFIG
    // ====================================

    const INVENTORY_DISPLAY = [
        { key: "kibble",  name: "Trockenfutter", emoji: "🥣" },
        { key: "meat",    name: "Fleisch",        emoji: "🍖" },
        { key: "fish",    name: "Fisch",          emoji: "🐟" },
        { key: "cheese",  name: "Käse",           emoji: "🧀" },
        { key: "snack",   name: "Leckerli",       emoji: "🍪" },
        { key: "toyBall", name: "Ball",           emoji: "⚽" }
    ];

    // ====================================
    // SHOP-KONFIGURATION
    // ====================================

    const SHOP_ITEMS = [
        { key: "kibble",  name: "Trockenfutter", emoji: "🥣", price: 1 },
        { key: "meat",    name: "Fleisch",  emoji: "🍖", price: 5 },
        { key: "fish",    name: "Fisch",    emoji: "🐟", price: 5 },
        { key: "cheese",  name: "Käse",     emoji: "🧀", price: 5 },
        { key: "snack",   name: "Leckerli", emoji: "🍪", price: 10 },
        { key: "toyBall", name: "Ball",     emoji: "⚽", price: 50 }
    ];

    // ====================================
    // TAGESAUFGABEN-DEFINITIONEN
    // ====================================

    const TASK_DEFINITIONS = [
        { id: "pet",  text: "❤️ Streichle dein Haustier",  reward: 10 },
        { id: "feed", text: "🍖 Füttere dein Haustier",     reward: 20 },
        { id: "play", text: "🎮 Spiele mit deinem Haustier", reward: 25 }
    ];

    // ====================================
    // DEFAULT SAVE (Phase 4 – vollständig)
    // ====================================

    const DEFAULT_SAVE = {
        activePet:   "cat",
        lastUpdate:  Date.now(),
        coins:       0,

        inventory: {
            kibble:  10,
        },

        dailyTasks: {
            lastReset: null,
            tasks:     []
        },

        pets: {
            cat:   { unlocked: true,  hunger: 100, energy: 100, happiness: 100 },
            dog:   { unlocked: true,  hunger: 100, energy: 100, happiness: 100 },
            mouse: { unlocked: true,  hunger: 100, energy: 100, happiness: 100 }
        }
    };

    // ====================================
    // MODULE STATE
    // ====================================

    let root           = null;
    let save           = null;
    let tickIntervalId = null;

    // Wird nach Lieblingsessen auf true gesetzt
    // und nach dem nächsten render() automatisch zurückgesetzt.
    let showFavoriteThought = false;

    // ====================================
    // SAVE – LADEN & SPEICHERN
    // ====================================

    function loadSave() {

        const raw = localStorage.getItem(SAVE_KEY);

        if (!raw) {
            const fresh = structuredClone(DEFAULT_SAVE);
            localStorage.setItem(SAVE_KEY, JSON.stringify(fresh));
            return fresh;
        }

        try {
            const parsed = JSON.parse(raw);
            const merged = {
                ...structuredClone(DEFAULT_SAVE),
                ...parsed
            };
            return migrateSave(merged);
        } catch {
            const fresh = structuredClone(DEFAULT_SAVE);
            localStorage.setItem(SAVE_KEY, JSON.stringify(fresh));
            return fresh;
        }

    }

    function saveData() {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    }

    // ====================================
    // MIGRATION
    // Alte Saves ohne Phase-3/4-Felder
    // werden sicher ergänzt.
    // ====================================

    function migrateSave(s) {

        // coins
        if (typeof s.coins !== "number") s.coins = 0;

        // inventory – Basis
        if (!s.inventory || typeof s.inventory !== "object") {
            s.inventory = structuredClone(DEFAULT_SAVE.inventory);
        } else {
            // Phase 3-Felder
            if (typeof s.inventory.kibble  !== "number") s.inventory.kibble  = 10;
            if (typeof s.inventory.snack   !== "number") s.inventory.snack   =  5;
            if (typeof s.inventory.toyBall !== "number") s.inventory.toyBall =  1;
            // Phase 4-Felder
            if (typeof s.inventory.meat   !== "number") s.inventory.meat   = 5;
            if (typeof s.inventory.fish   !== "number") s.inventory.fish   = 5;
            if (typeof s.inventory.cheese !== "number") s.inventory.cheese = 5;
        }

        // dailyTasks
        if (!s.dailyTasks || !Array.isArray(s.dailyTasks.tasks)) {
            s.dailyTasks = { lastReset: null, tasks: [] };
        }

        // pets – alle Standard-Haustiere anlegen falls fehlend
        if (!s.pets || typeof s.pets !== "object") {
            s.pets = structuredClone(DEFAULT_SAVE.pets);
        } else {
            Object.keys(PET_DEFINITIONS).forEach(id => {
                if (!s.pets[id]) {
                    s.pets[id] = {
                        unlocked:  id === "cat" || id === "dog" || id === "mouse",
                        hunger:    100,
                        energy:    100,
                        happiness: 100
                    };
                }
            });
        }

        return s;

    }

    // ====================================
    // PET STATE
    // ====================================

    function getPetState(id) {
        if (!save.pets[id]) {
            save.pets[id] = { unlocked: true, hunger: 100, energy: 100, happiness: 100 };
            saveData();
        }
        return save.pets[id];
    }

    function getUnlockedPets() {
        return Object.values(PET_DEFINITIONS).filter(
            def => save.pets[def.id]?.unlocked
        );
    }

    // ====================================
    // HILFSFUNKTIONEN
    // ====================================

    function clamp(v) { return Math.max(0, Math.min(100, v)); }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function isSleepy(pet) { return pet.energy < SLEEP_THRESHOLD; }

    function getMood(pet) {
        if (isSleepy(pet))          return "😴 Müde";
        if (pet.happiness >= 80)    return "😊 Glücklich";
        if (pet.happiness >= 50)    return "🙂 Zufrieden";
        if (pet.happiness >= 20)    return "🥺 Einsam";
        return "😿 Traurig";
    }

    function getWarnings(pet) {
        const w = [];
        if (pet.hunger    < 25) w.push("😿 Hat Hunger");
        if (pet.energy    < 25) w.push("💤 Ist müde");
        if (pet.happiness < 25) w.push("🥺 Fühlt sich einsam");
        return w;
    }

    // ====================================
    // GEDANKENBLASEN (Phase 4 – per Pet)
    // ====================================

    function getPetThought(def, petState, favoriteFood) {

        if (favoriteFood) return "💭 Das esse ich besonders gerne!";

        if (petState.hunger    < 25) return pick(def.thoughts.hungry);
        if (petState.energy    < 25) return pick(def.thoughts.tired);
        if (petState.happiness < 25) return pick(def.thoughts.lonely);
        return pick(def.thoughts.happy);

    }

    // ====================================
    // FÜTTERN – Futter-Auswahl
    // Gibt zurück, was beim Füttern
    // verbraucht wird. null = kein Futter.
    // ====================================

    function getFeedInfo() {

        const def    = PET_DEFINITIONS[save.activePet];
        const favKey = def.favoriteFood;

        if (save.inventory[favKey] > 0) {
            return {
                key:        favKey,
                emoji:      def.favoriteFoodEmoji,
                name:       def.favoriteFoodName,
                hungerGain: 30,
                isFavorite: true,
                count:      save.inventory[favKey]
            };
        }

        if (save.inventory.kibble > 0) {
            return {
                key:        "kibble",
                emoji:      "🥣",
                name:       "Trockenfutter",
                hungerGain: 20,
                isFavorite: false,
                count:      save.inventory.kibble
            };
        }

        return null; // Kein Futter vorhanden

    }

    // ====================================
    // OFFLINE-FORTSCHRITT
    // ====================================

    function applyOfflineProgress() {

        const now          = Date.now();
        const elapsedHours = (now - save.lastUpdate) / 3600000;

        if (elapsedHours <= 0) return;

        Object.entries(save.pets).forEach(([id, pet]) => {
            const def   = PET_DEFINITIONS[id];
            const hMult = def ? def.hungerDecayMultiplier : 1;

            pet.hunger    = clamp(pet.hunger    - elapsedHours * 2 * hMult);
            pet.energy    = clamp(pet.energy    - elapsedHours * 1);
            pet.happiness = clamp(pet.happiness - elapsedHours * 1);
        });

        save.lastUpdate = now;
        saveData();

    }

    // ====================================
    // TAGESAUFGABEN
    // ====================================

    function generateDailyTasks() {
        save.dailyTasks.lastReset = Date.now();
        save.dailyTasks.tasks = TASK_DEFINITIONS.map(d => ({
            id:        d.id,
            text:      d.text,
            reward:    d.reward,
            completed: false
        }));
    }

    function checkDailyReset() {
        const today     = new Date().toDateString();
        const lastReset = save.dailyTasks.lastReset
            ? new Date(save.dailyTasks.lastReset).toDateString()
            : null;
        if (lastReset !== today) {
            generateDailyTasks();
            saveData();
        }
    }

    function completeTask(id) {
        const task = save.dailyTasks.tasks.find(t => t.id === id);
        if (!task || task.completed) return;
        task.completed = true;
        save.coins += task.reward;
        saveData();
    }

    // ====================================
    // INTERAKTIONEN
    // ====================================

    function petPet() {
        const pet = getPetState(save.activePet);
        pet.happiness = clamp(pet.happiness + 5);
        completeTask("pet");
        saveData();
        render();
    }

    function feedPet() {
        const feedInfo = getFeedInfo();
        if (!feedInfo) return;

        const pet = getPetState(save.activePet);
        pet.hunger = clamp(pet.hunger + feedInfo.hungerGain);
        pet.energy = clamp(pet.energy + 5);
        save.inventory[feedInfo.key] -= 1;

        if (feedInfo.isFavorite) {
            showFavoriteThought = true;
        }

        completeTask("feed");
        saveData();
        render();
    }

    function playPet() {
        const pet = getPetState(save.activePet);
        if (isSleepy(pet)) return;

        const def     = PET_DEFINITIONS[save.activePet];
        const hasBall = save.inventory.toyBall > 0;
        const bonus   = hasBall ? def.playHappinessBall : def.playHappinessBase;

        pet.happiness = clamp(pet.happiness + bonus);
        pet.energy    = clamp(pet.energy    - 10);

        completeTask("play");
        saveData();
        render();
    }

    function sleepPet() {
        const pet = getPetState(save.activePet);
        pet.energy = clamp(pet.energy + 25);
        saveData();
        render();
    }

    function selectPet(id) {
        save.activePet = id;
        saveData();
        render();
    }

    function buyItem(key) {
        const item = SHOP_ITEMS.find(i => i.key === key);
        if (!item) return;
        if (save.coins < item.price) return;
        save.coins -= item.price;
        save.inventory[key] = (save.inventory[key] || 0) + 1;
        saveData();
        render();
    }

    // ====================================
    // ECHTZEIT-SYSTEM
    // ====================================

    function tick() {
        Object.entries(save.pets).forEach(([id, pet]) => {
            const def   = PET_DEFINITIONS[id];
            const hMult = def ? def.hungerDecayMultiplier : 1;
            pet.hunger    = clamp(pet.hunger    - 1 * hMult);
            pet.energy    = clamp(pet.energy    - 0.5);
            pet.happiness = clamp(pet.happiness - 0.5);
        });
        save.lastUpdate = Date.now();
        saveData();
        render();
    }

    function startTickTimer() {
        stopTickTimer();
        tickIntervalId = setInterval(tick, TICK_INTERVAL_MS);
    }

    function stopTickTimer() {
        if (tickIntervalId !== null) {
            clearInterval(tickIntervalId);
            tickIntervalId = null;
        }
    }

    // ====================================
    // RENDER
    // ====================================

    function render() {

        const def      = PET_DEFINITIONS[save.activePet];
        const pet      = getPetState(save.activePet);
        const warnings = getWarnings(pet);
        const sleepy   = isSleepy(pet);
        const feedInfo = getFeedInfo();
        const noFood   = !feedInfo;
        const tasks    = save.dailyTasks.tasks;
        const hasBall  = save.inventory.toyBall > 0;

        // Lieblingsessen-Gedanke: einmal lesen, dann zurücksetzen
        const useFavoriteThought = showFavoriteThought;
        showFavoriteThought = false;

        const thought = getPetThought(def, pet, useFavoriteThought);

        const playBonus    = hasBall ? def.playHappinessBall : def.playHappinessBase;
        const unlockedPets = getUnlockedPets();

        // Accordion-Zustand aus DOM erhalten (damit er durch render() nicht verloren geht)
        const openPanel = root.querySelector('.ch-acc-body:not(.hidden)')?.dataset.panel || null;

        root.innerHTML = `
<div class="ch-root">
  <div class="ch-grid">

    <!-- ── SP1: HAUSTIERE ── -->
    <div class="ch-col-pets">
      <div class="ch-pets-label">Haustiere</div>
      <div class="ch-pets-list">
        ${unlockedPets.map(p => `
        <button class="ch-pet-btn ${save.activePet === p.id ? 'active' : ''}" data-id="${p.id}">
          <img src="${p.image}" class="ch-pet-btn-img" alt="${p.name}">
          <div class="ch-pet-btn-info">
            <div class="ch-pet-btn-name">${p.name}</div>
            <div class="ch-pet-btn-mood">${getMood(save.pets[p.id])}</div>
          </div>
        </button>`).join('')}
        ${Array.from({length: 4}).map(() => `
        <div class="ch-pet-btn locked">
          <div class="ch-pet-btn-lock">🔒</div>
          <div class="ch-pet-btn-info">
            <div class="ch-pet-btn-name">???</div>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <!-- ── SP2: ZIMMER + INFO ── -->
    <div class="ch-col-main">

      <div class="ch-room">
        <img class="ch-room-bg" src="games/cozy-home/assets/room.png" alt="Zimmer">
        <div class="ch-bubble">${thought}</div>
        <img class="ch-room-pet" src="${def.image}" alt="${def.name}">
      </div>

      <div class="ch-profile">
        <div class="ch-profile-title">Steckbrief</div>
        <div class="ch-profile-body">
          <div class="ch-profile-data">
            <div class="ch-profile-row"><span class="ch-pl">🐾 Art</span><span class="ch-pv">${def.species}</span></div>
            <div class="ch-profile-row"><span class="ch-pl">🍽️ Lieblingsessen</span><span class="ch-pv">${def.favoriteFoodEmoji} ${def.favoriteFoodName}</span></div>
            <div class="ch-profile-row"><span class="ch-pl">🎯 Lieblingsaktivität</span><span class="ch-pv">${def.favoriteActivity}</span></div>
            <div class="ch-profile-row"><span class="ch-pl">⭐ Eigenschaft</span><span class="ch-pv">${def.traits}</span></div>
          </div>
          <div class="ch-profile-desc">${def.description}</div>
        </div>
      </div>

    </div>

    <!-- ── SP3: STATUS + AKTIONEN + AUFGABEN ── -->
    <div class="ch-col-status">

      <div class="ch-card">
        <div class="ch-card-header">
          <span class="ch-card-title">Zustand</span>
          <span class="ch-coins">🪙 ${save.coins}</span>
        </div>
        <div class="ch-stat">
          <div class="ch-stat-row"><span>🍖 Hunger</span><span>${Math.round(pet.hunger)} / 100</span></div>
          <div class="ch-bar"><div class="ch-bar-fill hunger" style="width:${pet.hunger}%"></div></div>
        </div>
        <div class="ch-stat">
          <div class="ch-stat-row"><span>⚡ Energie</span><span>${Math.round(pet.energy)} / 100</span></div>
          <div class="ch-bar"><div class="ch-bar-fill energy" style="width:${pet.energy}%"></div></div>
        </div>
        <div class="ch-stat">
          <div class="ch-stat-row"><span>❤️ Happiness</span><span>${Math.round(pet.happiness)} / 100</span></div>
          <div class="ch-bar"><div class="ch-bar-fill happiness" style="width:${pet.happiness}%"></div></div>
        </div>
        ${warnings.length > 0 ? `<div class="ch-warnings">${warnings.map(w => `<div class="ch-warning">${w}</div>`).join('')}</div>` : ''}
      </div>

      <div class="ch-card">
        <div class="ch-card-title">Aktionen</div>
        <div class="ch-actions">
          <button id="cozy-pet-btn" class="ch-action ${'' }">
            <div class="ch-action-icon">❤️</div>
            <div class="ch-action-label">Streicheln</div>
            <div class="ch-action-sub">+5 Happiness</div>
          </button>
          <button id="cozy-feed-btn" class="ch-action ${noFood ? 'disabled' : ''}">
            <div class="ch-action-icon">${noFood ? '🍽️' : feedInfo.emoji}</div>
            <div class="ch-action-label">Füttern</div>
            <div class="ch-action-sub">${noFood ? 'Kein Futter' : `+${feedInfo.hungerGain} (${feedInfo.count})`}</div>
          </button>
          <button id="cozy-play-btn" class="ch-action ${sleepy ? 'disabled' : ''}">
            <div class="ch-action-icon">🎮</div>
            <div class="ch-action-label">Spielen</div>
            <div class="ch-action-sub">${sleepy ? 'Zu müde' : `+${playBonus}`}</div>
          </button>
          <button id="cozy-sleep-btn" class="ch-action">
            <div class="ch-action-icon">💤</div>
            <div class="ch-action-label">Schlafen</div>
            <div class="ch-action-sub">+25 Energie</div>
          </button>
        </div>
      </div>

      <div class="ch-card">
        <div class="ch-card-title">Tagesaufgaben</div>
        <div class="ch-tasks">
          ${tasks.map(t => `
          <div class="ch-task ${t.completed ? 'done' : ''}">
            <span class="ch-task-check">${t.completed ? '✓' : '□'}</span>
            <span class="ch-task-text">${t.text}</span>
            <span class="ch-task-reward">+${t.reward} 🪙</span>
          </div>`).join('')}
        </div>
      </div>

    </div>

    <!-- ── SP4: INVENTAR + SHOP ── -->
    <div class="ch-col-inv">

      <div class="ch-accordion">
        <button class="ch-acc-row ${openPanel === 'inv' ? 'open' : ''}" data-target="inv">
          <span>📦 Inventar</span>
          <span class="ch-chevron">${openPanel === 'inv' ? '▲' : '▼'}</span>
        </button>
        <div class="ch-acc-body ${openPanel === 'inv' ? '' : 'hidden'}" data-panel="inv">
          ${INVENTORY_DISPLAY.map(item => {
            const count = save.inventory[item.key] || 0;
            return `<div class="ch-inv-row ${count === 0 ? 'empty' : ''}">
              <span>${item.emoji} ${item.name}</span>
              <span class="ch-inv-count">x${count}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="ch-accordion">
        <button class="ch-acc-row ${openPanel === 'shop' ? 'open' : ''}" data-target="shop">
          <span>🛒 Shop <span class="ch-coins-inline">🪙 ${save.coins}</span></span>
          <span class="ch-chevron">${openPanel === 'shop' ? '▲' : '▼'}</span>
        </button>
        <div class="ch-acc-body ${openPanel === 'shop' ? '' : 'hidden'}" data-panel="shop">
          ${SHOP_ITEMS.map(item => {
            const canBuy = save.coins >= item.price;
            return `<div class="ch-shop-row">
              <span>${item.emoji} ${item.name}</span>
              <span class="ch-shop-price">🪙${item.price}</span>
              <button class="ch-buy-btn ${canBuy ? '' : 'disabled'}" data-buy="${item.key}">${canBuy ? 'Kaufen' : '—'}</button>
            </div>`;
          }).join('')}
        </div>
      </div>

    </div>

  </div>
</div>
`;


        // ====================================
        // EVENT LISTENER
        // ====================================

        root.querySelector("#cozy-pet-btn").onclick   = petPet;
        root.querySelector("#cozy-feed-btn").onclick  = noFood  ? null : feedPet;
        root.querySelector("#cozy-sleep-btn").onclick = sleepPet;
        root.querySelector("#cozy-play-btn").onclick  = sleepy  ? null : playPet;

        root.querySelectorAll(".ch-pet-btn[data-id]").forEach(btn => {
            btn.onclick = () => selectPet(btn.dataset.id);
        });

        root.querySelectorAll(".ch-buy-btn[data-buy]").forEach(btn => {
            const key  = btn.dataset.buy;
            const item = SHOP_ITEMS.find(i => i.key === key);
            if (!item) return;
            btn.onclick = save.coins >= item.price ? () => buyItem(key) : null;
        });

        // Accordion
        root.querySelectorAll(".ch-acc-row[data-target]").forEach(btn => {
            btn.onclick = () => {
                const target = btn.dataset.target;
                const body   = root.querySelector(`.ch-acc-body[data-panel="${target}"]`);
                const isOpen = !body.classList.contains('hidden');

                root.querySelectorAll('.ch-acc-body').forEach(b => b.classList.add('hidden'));
                root.querySelectorAll('.ch-acc-row').forEach(b => {
                    b.classList.remove('open');
                    b.querySelector('.ch-chevron').textContent = '▼';
                });

                if (!isOpen) {
                    body.classList.remove('hidden');
                    btn.classList.add('open');
                    btn.querySelector('.ch-chevron').textContent = '▲';
                }
            };
        });

    }


    // ====================================
    // LIFECYCLE
    // ====================================

    function mount(container) {
        save = loadSave();
        applyOfflineProgress();
        checkDailyReset();
        root = container;
        render();
        startTickTimer();
    }

    function destroy() {
        stopTickTimer();
        if (root) {
            root.innerHTML = "";
            root = null;
        }
    }

    // ====================================

    window.registerGame({
        id: "cozy-home",
        modalSize: "very-big",
        mount,
        destroy
    });

})();
