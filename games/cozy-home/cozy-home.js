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
            meat:     5,
            fish:     5,
            cheese:   5,
            snack:    5,
            toyBall:  1
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
        const openPanel = root.querySelector('.cozy-accordion-panel:not(.hidden)')?.dataset.panel || null;

        root.innerHTML = `
<div class="cozy-home">

  <!-- ===== 3-SPALTEN HAUPTLAYOUT ===== -->
  <div class="cozy-layout">

    <!-- SPALTE 1: HAUSTIERLISTE -->
    <div class="cozy-pet-list">
      <div class="cozy-pet-list-title">Haustiere</div>
      ${unlockedPets.map(p => `
      <button class="cozy-pet-slot ${save.activePet === p.id ? 'active' : ''}" data-id="${p.id}">
        <img src="${p.image}" class="cozy-pet-slot-img" alt="${p.name}">
        <div class="cozy-pet-slot-name">${p.name}</div>
      </button>`).join('')}
    </div>

    <!-- SPALTE 2: ZIMMER -->
    <div class="cozy-room-col">
      <div class="cozy-room">
        <img class="cozy-room-bg" src="games/cozy-home/assets/room.png" alt="Zimmer">
        <div class="cozy-thought-bubble">${thought}</div>
        <img class="cozy-room-pet" src="${def.image}" alt="${def.name}">
      </div>
      <div class="cozy-pet-name">${def.name}</div>
      <div class="cozy-pet-mood">${getMood(pet)}</div>

      <!-- STECKBRIEF -->
      <div class="cozy-profile-card">
        <div class="cozy-profile-row">
          <span class="cozy-profile-label">Art</span>
          <span class="cozy-profile-value">${def.species}</span>
        </div>
        <div class="cozy-profile-row">
          <span class="cozy-profile-label">Lieblingsessen</span>
          <span class="cozy-profile-value">${def.favoriteFoodEmoji} ${def.favoriteFoodName}</span>
        </div>
        <div class="cozy-profile-row">
          <span class="cozy-profile-label">Lieblingsaktivität</span>
          <span class="cozy-profile-value">${def.favoriteActivity}</span>
        </div>
        <div class="cozy-profile-row">
          <span class="cozy-profile-label">Eigenschaft</span>
          <span class="cozy-profile-value">${def.traits}</span>
        </div>
        <div class="cozy-profile-desc">${def.description}</div>
      </div>
    </div>

    <!-- SPALTE 3: STATUS + AKTIONEN + AUFGABEN + ACCORDION -->
    <div class="cozy-right">

      <!-- STATUS + COINS -->
      <div class="cozy-status-card">
        <div class="cozy-status-header">
          <h3>Zustand</h3>
          <div class="cozy-coin-display">🪙 ${save.coins}</div>
        </div>

        <div class="cozy-stat">
          <div class="cozy-stat-label">
            <span>🍖 Hunger</span>
            <span>${Math.round(pet.hunger)} / 100</span>
          </div>
          <div class="cozy-bar"><div class="cozy-bar-fill hunger" style="width:${pet.hunger}%"></div></div>
        </div>

        <div class="cozy-stat">
          <div class="cozy-stat-label">
            <span>⚡ Energie</span>
            <span>${Math.round(pet.energy)} / 100</span>
          </div>
          <div class="cozy-bar"><div class="cozy-bar-fill energy" style="width:${pet.energy}%"></div></div>
        </div>

        <div class="cozy-stat">
          <div class="cozy-stat-label">
            <span>❤️ Happiness</span>
            <span>${Math.round(pet.happiness)} / 100</span>
          </div>
          <div class="cozy-bar"><div class="cozy-bar-fill happiness" style="width:${pet.happiness}%"></div></div>
        </div>

        ${warnings.length > 0 ? `
        <div class="cozy-warnings">
          ${warnings.map(w => `<div class="cozy-warning">${w}</div>`).join('')}
        </div>` : ''}
      </div>

      <!-- AKTIONEN -->
      <div class="cozy-actions">
        <button id="cozy-pet-btn" class="cozy-action-btn">
          <div class="cozy-action-icon">❤️</div>
          <div class="cozy-action-title">Streicheln</div>
          <div class="cozy-action-desc">+5 Happiness</div>
        </button>
        <button id="cozy-feed-btn" class="cozy-action-btn ${noFood ? 'disabled' : ''}">
          <div class="cozy-action-icon">${noFood ? '🍽️' : feedInfo.emoji}</div>
          <div class="cozy-action-title">Füttern</div>
          <div class="cozy-action-desc">${noFood ? 'Kein Futter' : `+${feedInfo.hungerGain} · ${feedInfo.count} übrig`}</div>
        </button>
        <button id="cozy-play-btn" class="cozy-action-btn ${sleepy ? 'disabled' : ''}">
          <div class="cozy-action-icon">🎮</div>
          <div class="cozy-action-title">Spielen</div>
          <div class="cozy-action-desc">${sleepy ? 'Zu müde' : `+${playBonus} Happiness`}</div>
        </button>
        <button id="cozy-sleep-btn" class="cozy-action-btn">
          <div class="cozy-action-icon">💤</div>
          <div class="cozy-action-title">Schlafen</div>
          <div class="cozy-action-desc">+25 Energie</div>
        </button>
      </div>

      <!-- TAGESAUFGABEN -->
      <div class="cozy-tasks-card">
        <div class="cozy-tasks-header">
          <span class="cozy-tasks-title">Tagesaufgaben</span>
        </div>
        <div class="cozy-tasks-list">
          ${tasks.map(task => `
          <div class="cozy-task-item ${task.completed ? 'done' : ''}">
            <span class="cozy-task-check">${task.completed ? '✓' : '□'}</span>
            <span class="cozy-task-text">${task.text}</span>
            <span class="cozy-task-reward">+${task.reward} 🪙</span>
          </div>`).join('')}
        </div>
      </div>

      <!-- ACCORDION BUTTONS -->
      <div class="cozy-accordion-btns">
        <button class="cozy-accordion-toggle ${openPanel === 'inv' ? 'active' : ''}" data-target="inv">🎒 Inventar</button>
        <button class="cozy-accordion-toggle ${openPanel === 'shop' ? 'active' : ''}" data-target="shop">🛒 Shop</button>
      </div>

      <!-- INVENTAR PANEL -->
      <div class="cozy-accordion-panel ${openPanel === 'inv' ? '' : 'hidden'}" data-panel="inv">
        <div class="cozy-inv-grid">
          ${INVENTORY_DISPLAY.map(item => {
            const count = save.inventory[item.key] || 0;
            return `
          <div class="cozy-inv-item ${count === 0 ? 'empty' : ''}">
            <span class="cozy-inv-emoji">${item.emoji}</span>
            <span class="cozy-inv-name">${item.name}</span>
            <span class="cozy-inv-count">x${count}</span>
          </div>`;
          }).join('')}
        </div>
      </div>

      <!-- SHOP PANEL -->
      <div class="cozy-accordion-panel ${openPanel === 'shop' ? '' : 'hidden'}" data-panel="shop">
        <div class="cozy-shop-coins-row">🪙 ${save.coins} Coins</div>
        <div class="cozy-shop-grid">
          ${SHOP_ITEMS.map(item => {
            const canBuy = save.coins >= item.price;
            return `
          <div class="cozy-shop-item">
            <span class="cozy-shop-emoji">${item.emoji}</span>
            <span class="cozy-shop-name">${item.name}</span>
            <span class="cozy-shop-price">🪙 ${item.price}</span>
            <button class="cozy-buy-btn ${canBuy ? '' : 'disabled'}" data-buy="${item.key}">
              ${canBuy ? 'Kaufen' : 'Zu wenig'}
            </button>
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

        const playBtn = root.querySelector("#cozy-play-btn");
        playBtn.onclick = sleepy ? null : playPet;

        root.querySelectorAll(".cozy-pet-slot[data-id]").forEach(btn => {
            btn.onclick = () => selectPet(btn.dataset.id);
        });

        root.querySelectorAll(".cozy-buy-btn[data-buy]").forEach(btn => {
            const key  = btn.dataset.buy;
            const item = SHOP_ITEMS.find(i => i.key === key);
            if (!item) return;
            btn.onclick = save.coins >= item.price ? () => buyItem(key) : null;
        });

        // Accordion-Toggles
        root.querySelectorAll(".cozy-accordion-toggle[data-target]").forEach(btn => {
            btn.onclick = () => {
                const target  = btn.dataset.target;
                const panel   = root.querySelector(`.cozy-accordion-panel[data-panel="${target}"]`);
                const isOpen  = !panel.classList.contains('hidden');

                // Alle schließen
                root.querySelectorAll('.cozy-accordion-panel').forEach(p => p.classList.add('hidden'));
                root.querySelectorAll('.cozy-accordion-toggle').forEach(b => b.classList.remove('active'));

                // Dieses öffnen (wenn es vorher zu war)
                if (!isOpen) {
                    panel.classList.remove('hidden');
                    btn.classList.add('active');
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
