// =========================
// COZY HOME - PHASE 1.5
// Haustierliste + Pet-Wechsel
// =========================

(function () {

    const SAVE_KEY = "cozyHomeData";

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

    function getMood(pet) {

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

        saveData();

        render();

    }

    function playPet() {

        const pet = getPetState(save.activePet);

        pet.happiness = clamp(
            pet.happiness + 10
        );

        pet.energy = clamp(
            pet.energy - 5
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
    // RENDER
    // ====================================

    function render() {

        const petInfo = getAvailablePets().find(
            p => p.id === save.activePet
        );

        console.log(petInfo);
        const pet = getPetState(
            save.activePet
        );

        const warnings = getWarnings(pet);
        root.innerHTML = `

<div class="cozy-home">

    <div class="cozy-header">
        <h2>🏡 Cozy Home</h2>
        <p>Ein gemütliches Zuhause für deine Begleiter.</p>
    </div>

    <div class="cozy-current-pet">

        <div class="cozy-pet-frame">

            <img
                class="cozy-pet-img"
                src="${petInfo.image}"
                alt="${petInfo.name}">

        </div>

        <div class="cozy-pet-name">
            ${petInfo.name}
        </div>

        <div class="cozy-pet-mood">
            ${getMood(pet)}
        </div>

        ${
        warnings.length
        ?
        `
        <div class="cozy-warnings">

        ${warnings.map(
        warning => `
        <div class="cozy-warning">
        ${warning}
        </div>
        `
        ).join("")}

        </div>
        `
        :
        ""
        }

    </div>

    <div class="cozy-bars">

        <div>
            Hunger
            <progress value="${pet.hunger}" max="100"></progress>
        </div>

        <div>
            Energie
            <progress value="${pet.energy}" max="100"></progress>
        </div>

        <div>
            Glück
            <progress value="${pet.happiness}" max="100"></progress>
        </div>

    </div>

    <div class="cozy-actions">

        <button id="cozy-pet-btn">
            ❤️ Streicheln
        </button>

        <button id="cozy-feed-btn">
            🍖 Füttern
        </button>

        <button id="cozy-play-btn">
            🎮 Spielen
        </button>

        <button id="cozy-sleep-btn">
            💤 Schlafen
        </button>

    </div>

    <hr>

    <h3>Deine Haustiere</h3>

        <div class="cozy-pets">

        ${getAvailablePets().map(pet => `

        <button
        class="cozy-pet-slot ${save.activePet === pet.id ? "active" : ""}"
        data-id="${pet.id}">

        <img
        src="${pet.image}"
        class="cozy-pet-slot-img">

        <div>
        ${pet.name}
        </div>

        </button>

        `).join("")}

        </div>

</div>
`;

        root
            .querySelector("#cozy-pet-btn")
            .onclick = petPet;

        root
            .querySelector("#cozy-feed-btn")
            .onclick = feedPet;

        root
            .querySelector("#cozy-play-btn")
            .onclick = playPet;

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

    }

    function destroy() {

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