// =========================
// COZY HOME - PHASE 3
// Tagesaufgaben, Coins, Inventar
// =========================

(function () {

    const SAVE_KEY = "cozyHomeData";

    const TICK_INTERVAL_MS = 60000; // 60 Sekunden

    const SLEEP_THRESHOLD = 20;

    // ====================================
    // AUFGABEN-DEFINITIONEN
    // (zentrale Quelle der Wahrheit)
    // ====================================

    const TASK_DEFINITIONS = [
        {
            id: "pet",
            text: "❤️ Streichle dein Haustier",
            reward: 10
        },
        {
            id: "feed",
            text: "🍖 Füttere dein Haustier",
            reward: 20
        },
        {
            id: "play",
            text: "🎮 Spiele mit deinem Haustier",
            reward: 25
        }
    ];

    // ====================================
    // DEFAULT SAVE (Phase 3 – vollständig)
    // ====================================

    const DEFAULT_SAVE = {
        activePet: "cat",

        lastUpdate: Date.now(),

        // Phase 3
        coins: 0,

        inventory: {
            kibble: 10,
            snack: 5,
            toyBall: 1
        },

        dailyTasks: {
            lastReset: null,
            tasks: []
        },

        pets: {
            cat: {
                unlocked: true,
                hunger: 100,
                energy: 100,
                happiness: 100
            }
        }
    };

    let root = null;
    let save = null;

    // Phase 2: Timer-Handle – niemals mehrere Intervalle gleichzeitig
    let tickIntervalId = null;

    // ====================================
    // SAVE
    // ====================================

    function loadSave() {

        const raw = localStorage.getItem(SAVE_KEY);

        if (!raw) {

            const fresh = structuredClone(DEFAULT_SAVE);

            localStorage.setItem(
                SAVE_KEY,
                JSON.stringify(fresh)
            );

            return fresh;

        }

        try {

            const parsed = JSON.parse(raw);

            // Shallow-Merge: DEFAULT_SAVE stellt fehlende Top-Level-Keys bereit,
            // bestehende Werte aus dem alten Save bleiben erhalten.
            const merged = {
                ...structuredClone(DEFAULT_SAVE),
                ...parsed
            };

            // Phase 3: Save-Migration für alte Stände
            return migrateSave(merged);

        } catch {

            const fresh = structuredClone(DEFAULT_SAVE);

            localStorage.setItem(
                SAVE_KEY,
                JSON.stringify(fresh)
            );

            return fresh;

        }

    }

    // ====================================
    // MIGRATION (Phase 3)
    // Alte Saves ohne coins / inventory /
    // dailyTasks werden sicher ergänzt.
    // ====================================

    function migrateSave(s) {

        // coins
        if (typeof s.coins !== "number") {
            s.coins = 0;
        }

        // inventory
        if (!s.inventory || typeof s.inventory !== "object") {
            s.inventory = structuredClone(
                DEFAULT_SAVE.inventory
            );
        } else {
            if (typeof s.inventory.kibble !== "number")
                s.inventory.kibble = 10;
            if (typeof s.inventory.snack !== "number")
                s.inventory.snack = 5;
            if (typeof s.inventory.toyBall !== "number")
                s.inventory.toyBall = 1;
        }

        // dailyTasks
        if (
            !s.dailyTasks ||
            typeof s.dailyTasks !== "object" ||
            !Array.isArray(s.dailyTasks.tasks)
        ) {
            s.dailyTasks = {
                lastReset: null,
                tasks: []
            };
        }

        return s;

    }

    function saveData() {

        localStorage.setItem(
            SAVE_KEY,
            JSON.stringify(save)
        );

    }

    // ====================================
    // PETS
    // ====================================

    function getAvailablePets() {

        return [
            {
                id: "cat",
                name: "Katze",
                image: "games/cozy-home/assets/cat.png"
            }
        ];

    }

    function createPetState() {

        return {
            unlocked: true,
            hunger: 100,
            energy: 100,
            happiness: 100
        };

    }

    function getPetState(id) {

        if (!save.pets[id]) {

            save.pets[id] = createPetState();

            saveData();

        }

        return save.pets[id];

    }

    // ====================================
    // HILFSFUNKTIONEN
    // ====================================

    function clamp(value) {

        return Math.max(
            0,
            Math.min(100, value)
        );

    }

    function applyOfflineProgress() {

        const now = Date.now();

        const elapsedHours =
            (now - save.lastUpdate) / 3600000;

        if (elapsedHours <= 0) return;

        Object.values(save.pets).forEach(pet => {

            pet.hunger = clamp(
                pet.hunger - elapsedHours * 2
            );

            pet.energy = clamp(
                pet.energy - elapsedHours * 1
            );

            pet.happiness = clamp(
                pet.happiness - elapsedHours * 1
            );

        });

        save.lastUpdate = now;

        saveData();

    }

    function isSleepy(pet) {

        return pet.energy < SLEEP_THRESHOLD;

    }

    function getMood(pet) {

        if (isSleepy(pet))
            return "😴 Müde";

        if (pet.happiness >= 80)
            return "😊 Glücklich";

        if (pet.happiness >= 50)
            return "🙂 Zufrieden";

        if (pet.happiness >= 20)
            return "🥺 Einsam";

        return "😿 Traurig";

    }

    function getWarnings(pet) {

        const warnings = [];

        if (pet.hunger < 25)
            warnings.push("😿 Hat Hunger");

        if (pet.energy < 25)
            warnings.push("💤 Ist müde");

        if (pet.happiness < 25)
            warnings.push("🥺 Fühlt sich einsam");

        return warnings;

    }

    // ====================================
    // GEDANKENBLASEN (Phase 2)
    // ====================================

    function getPetThought(pet) {

        if (pet.hunger < 25)
            return "💭 Ich habe Hunger!";

        if (pet.energy < 25)
            return "💭 Ich bin müde...";

        if (pet.happiness < 25)
            return "💭 Spielst du mit mir?";

        return "💭 Heute ist ein schöner Tag!";

    }

    // ====================================
    // TAGESAUFGABEN (Phase 3)
    // ====================================

    function generateDailyTasks() {

        save.dailyTasks.lastReset = Date.now();

        save.dailyTasks.tasks = TASK_DEFINITIONS.map(def => ({
            id:        def.id,
            text:      def.text,
            reward:    def.reward,
            completed: false
        }));

    }

    function checkDailyReset() {

        const today = new Date().toDateString();

        const lastReset = save.dailyTasks.lastReset
            ? new Date(save.dailyTasks.lastReset).toDateString()
            : null;

        // Neuer Tag ODER noch nie initialisiert
        if (lastReset !== today) {
            generateDailyTasks();
            saveData();
        }

    }

    // Schließt eine Aufgabe ab und gibt einmalig Coins.
    // Wird direkt nach der jeweiligen Aktion aufgerufen.
    function completeTask(id) {

        const task = save.dailyTasks.tasks.find(
            t => t.id === id
        );

        // Bereits erledigt oder nicht vorhanden → kein Effekt
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

        pet.happiness = clamp(
            pet.happiness + 5
        );

        completeTask("pet"); // Phase 3

        saveData();

        render();

    }

    function feedPet() {

        // Phase 3: Kein Futter → Aktion blockieren
        if (save.inventory.kibble <= 0) return;

        const pet = getPetState(save.activePet);

        pet.hunger = clamp(
            pet.hunger + 20
        );
        pet.energy = clamp(
            pet.energy + 5
        );

        // Phase 3: Futter verbrauchen
        save.inventory.kibble -= 1;

        completeTask("feed"); // Phase 3

        saveData();

        render();

    }

    function playPet() {

        const pet = getPetState(save.activePet);

        // Im Schlafmodus gesperrt
        if (isSleepy(pet)) return;

        // Phase 3: Spielzeug-Bonus (Ball wird NICHT verbraucht)
        const happinessBonus =
            save.inventory.toyBall > 0 ? 15 : 10;

        pet.happiness = clamp(
            pet.happiness + happinessBonus
        );

        pet.energy = clamp(
            pet.energy - 10
        );

        completeTask("play"); // Phase 3

        saveData();

        render();

    }

    function sleepPet() {

        const pet = getPetState(save.activePet);

        pet.energy = clamp(
            pet.energy + 25
        );

        saveData();

        render();

    }

    // ====================================
    // PET AUSWÄHLEN
    // ====================================

    function selectPet(id) {

        save.activePet = id;

        saveData();

        render();

    }

    // ====================================
    // ECHTZEIT-SYSTEM (Phase 2)
    // ====================================

    function tick() {

        Object.values(save.pets).forEach(pet => {

            pet.hunger = clamp(
                pet.hunger - 1
            );

            pet.energy = clamp(
                pet.energy - 0.5
            );

            pet.happiness = clamp(
                pet.happiness - 0.5
            );

        });

        save.lastUpdate = Date.now();

        saveData();

        render();

    }

    function startTickTimer() {

        stopTickTimer(); // Sicherheitsnetz: niemals doppelte Timer

        tickIntervalId = setInterval(
            tick,
            TICK_INTERVAL_MS
        );

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

        const petInfo = getAvailablePets().find(
            p => p.id === save.activePet
        );

        const pet = getPetState(save.activePet);

        const warnings  = getWarnings(pet);
        const sleepy    = isSleepy(pet);
        const thought   = getPetThought(pet);
        const noFood    = save.inventory.kibble <= 0;
        const tasks     = save.dailyTasks.tasks;

        root.innerHTML = `

<div class="cozy-home">

<div class="cozy-main-card">

    <!-- LINKS -->
    <div class="cozy-left">

        <div class="cozy-room">

            <img
                class="cozy-room-bg"
                src="games/cozy-home/assets/room.png"
                alt="Zimmer">

            <div class="cozy-thought-bubble">
                ${thought}
            </div>

            <img
                class="cozy-room-pet"
                src="${petInfo.image}"
                alt="${petInfo.name}">

        </div>

        <div class="cozy-pet-name">
            ${petInfo.name}
        </div>

        <div class="cozy-pet-mood">
            ${getMood(pet)}
        </div>

    </div>


    <!-- RECHTS -->
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
                <div class="cozy-bar">
                    <div class="cozy-bar-fill hunger"
                         style="width:${pet.hunger}%"></div>
                </div>
            </div>

            <div class="cozy-stat">
                <div class="cozy-stat-label">
                    <span>⚡ Energie</span>
                    <span>${Math.round(pet.energy)} / 100</span>
                </div>
                <div class="cozy-bar">
                    <div class="cozy-bar-fill energy"
                         style="width:${pet.energy}%"></div>
                </div>
            </div>

            <div class="cozy-stat">
                <div class="cozy-stat-label">
                    <span>❤️ Happiness</span>
                    <span>${Math.round(pet.happiness)} / 100</span>
                </div>
                <div class="cozy-bar">
                    <div class="cozy-bar-fill happiness"
                         style="width:${pet.happiness}%"></div>
                </div>
            </div>

            ${warnings.length > 0 ? `
            <div class="cozy-warnings">
                ${warnings.map(w => `
                <div class="cozy-warning">${w}</div>
                `).join("")}
            </div>
            ` : ""}

        </div>


        <!-- AKTIONEN -->
        <div class="cozy-actions">

            <button id="cozy-pet-btn" class="cozy-action-btn">
                <div class="cozy-action-icon">❤️</div>
                <div class="cozy-action-title">Streicheln</div>
                <div class="cozy-action-desc">+5 Happiness</div>
            </button>

            <button id="cozy-feed-btn"
                    class="cozy-action-btn ${noFood ? "disabled" : ""}">
                <div class="cozy-action-icon">🍖</div>
                <div class="cozy-action-title">Füttern</div>
                <div class="cozy-action-desc">
                    ${noFood
                        ? "Kein Futter"
                        : `+20 Hunger · ${save.inventory.kibble} übrig`}
                </div>
            </button>

            <button id="cozy-play-btn"
                    class="cozy-action-btn ${sleepy ? "disabled" : ""}">
                <div class="cozy-action-icon">🎮</div>
                <div class="cozy-action-title">Spielen</div>
                <div class="cozy-action-desc">
                    ${sleepy
                        ? "Zu müde zum Spielen"
                        : `+${save.inventory.toyBall > 0 ? 15 : 10} Happiness`}
                </div>
            </button>

            <button id="cozy-sleep-btn" class="cozy-action-btn">
                <div class="cozy-action-icon">💤</div>
                <div class="cozy-action-title">Schlafen</div>
                <div class="cozy-action-desc">+25 Energie</div>
            </button>

        </div>


        <!-- TAGESAUFGABEN (Phase 3) -->
        <div class="cozy-tasks-card">

            <div class="cozy-tasks-header">
                <span class="cozy-tasks-title">Tagesaufgaben</span>
            </div>

            <div class="cozy-tasks-list">

                ${tasks.map(task => `
                <div class="cozy-task-item ${task.completed ? "done" : ""}">
                    <span class="cozy-task-check">
                        ${task.completed ? "✓" : "□"}
                    </span>
                    <span class="cozy-task-text">${task.text}</span>
                    <span class="cozy-task-reward">+${task.reward} 🪙</span>
                </div>
                `).join("")}

            </div>

        </div>

    </div>

</div>


<!-- HAUSTIERLISTE -->
<h3>Deine Haustiere</h3>

<div class="cozy-pets">

    ${getAvailablePets().map(p => `

    <button
        class="cozy-pet-slot ${save.activePet === p.id ? "active" : ""}"
        data-id="${p.id}">

        <img src="${p.image}" class="cozy-pet-slot-img">

        <div>${p.name}</div>

    </button>

    `).join("")}

</div>

</div>
`;

        // ====================================
        // EVENT LISTENER NEU VERBINDEN
        // (innerHTML löscht alle alten Listener)
        // ====================================

        root
            .querySelector("#cozy-pet-btn")
            .onclick = petPet;

        root
            .querySelector("#cozy-feed-btn")
            .onclick = noFood ? null : feedPet;

        const playBtn = root.querySelector("#cozy-play-btn");
        playBtn.onclick = sleepy ? null : playPet;

        root
            .querySelector("#cozy-sleep-btn")
            .onclick = sleepPet;

        root
            .querySelectorAll(".cozy-pet-slot[data-id]")
            .forEach(btn => {
                btn.onclick = () => selectPet(btn.dataset.id);
            });

    }

    // ====================================
    // LIFECYCLE
    // ====================================

    function mount(container) {

        save = loadSave();

        applyOfflineProgress();

        checkDailyReset(); // Phase 3: Tagesreset prüfen

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
        mount,
        destroy
    });

})();
