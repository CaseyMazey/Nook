// =========================
// COZY HOME - PHASE 2
// Lebendigkeit + Warnsystem
// =========================

(function () {

    const SAVE_KEY = "cozyHomeData";

    const TICK_INTERVAL_MS = 60000; // 60 Sekunden

    const SLEEP_THRESHOLD = 20;

    const DEFAULT_SAVE = {
        activePet: "cat",

        lastUpdate: Date.now(),

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

    // Phase 2: Timer-Handle, damit niemals mehrere Intervalle gleichzeitig laufen
    let tickIntervalId = null;

    // ====================================
    // SAVE
    // ====================================

    function loadSave() {

        const raw = localStorage.getItem(SAVE_KEY);

        if (!raw) {

            localStorage.setItem(
                SAVE_KEY,
                JSON.stringify(DEFAULT_SAVE)
            );

            return structuredClone(DEFAULT_SAVE);

        }

        try {

            return {
                ...structuredClone(DEFAULT_SAVE),
                ...JSON.parse(raw)
            };

        } catch {

            localStorage.setItem(
                SAVE_KEY,
                JSON.stringify(DEFAULT_SAVE)
            );

            return structuredClone(DEFAULT_SAVE);

        }

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

        // Schlafmodus hat Vorrang vor der normalen Stimmung
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
    // INTERAKTIONEN
    // ====================================

    function petPet() {

        const pet = getPetState(save.activePet);

        pet.happiness = clamp(
            pet.happiness + 5
        );

        saveData();

        render();

    }

    function feedPet() {

        const pet = getPetState(save.activePet);

        pet.hunger = clamp(
            pet.hunger + 20
        );
        pet.energy = clamp(
            pet.energy + 5
        );

        saveData();

        render();

    }

    function playPet() {

        const pet = getPetState(save.activePet);

        // Im Schlafmodus ist Spielen gesperrt
        if (isSleepy(pet)) return;

        pet.happiness = clamp(
            pet.happiness + 10
        );

        pet.energy = clamp(
            pet.energy - 10
        );

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

        // Sicherheitsnetz: niemals mehrere Timer gleichzeitig
        stopTickTimer();

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

        const pet = getPetState(
            save.activePet
        );

        const warnings = getWarnings(pet);

        const sleepy = isSleepy(pet);

        const thought = getPetThought(pet);

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

        <div class="cozy-status-card">

            <h3>Zustand</h3>

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


        <div class="cozy-actions">

            <button id="cozy-pet-btn" class="cozy-action-btn">
                <div class="cozy-action-icon">❤️</div>
                <div class="cozy-action-title">Streicheln</div>
                <div class="cozy-action-desc">+5 Happiness</div>
            </button>

            <button id="cozy-feed-btn" class="cozy-action-btn">
                <div class="cozy-action-icon">🍖</div>
                <div class="cozy-action-title">Füttern</div>
                <div class="cozy-action-desc">+20 Hunger</div>
            </button>

            <button id="cozy-play-btn" class="cozy-action-btn ${sleepy ? "disabled" : ""}">
                <div class="cozy-action-icon">🎮</div>
                <div class="cozy-action-title">Spielen</div>
                <div class="cozy-action-desc">${sleepy ? "Zu müde zum Spielen" : "+10 Happiness<br>-10 Energie"}</div>
            </button>

            <button id="cozy-sleep-btn" class="cozy-action-btn">
                <div class="cozy-action-icon">💤</div>
                <div class="cozy-action-title">Schlafen</div>
                <div class="cozy-action-desc">+25 Energie</div>
            </button>

        </div>

    </div>

</div>

    <h3>Deine Haustiere</h3>

        <div class="cozy-pets">

        ${getAvailablePets().map(p => `

        <button
        class="cozy-pet-slot ${save.activePet === p.id ? "active" : ""}"
        data-id="${p.id}">

        <img
        src="${p.image}"
        class="cozy-pet-slot-img">

        <div>
        ${p.name}
        </div>

        </button>

        `).join("")}

        </div>

</div>
`;

        // ====================================
        // EVENT LISTENER NEU VERBINDEN
        // (nach jedem render() neu, da innerHTML
        //  alte Elemente inkl. Listener ersetzt)
        // ====================================

        root
            .querySelector("#cozy-pet-btn")
            .onclick = petPet;

        root
            .querySelector("#cozy-feed-btn")
            .onclick = feedPet;

        const playBtn = root.querySelector("#cozy-play-btn");

        playBtn.onclick = sleepy
            ? null
            : playPet;

        root
            .querySelector("#cozy-sleep-btn")
            .onclick = sleepPet;

        root
            .querySelectorAll(".cozy-pet-slot[data-id]")
            .forEach(button => {

                button.onclick = () => {

                    selectPet(
                        button.dataset.id
                    );

                };

            });

    }

    // ====================================
    // LIFECYCLE
    // ====================================

    function mount(container) {

        save = loadSave();

        applyOfflineProgress();

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
