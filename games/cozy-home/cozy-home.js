// =========================
// COZY HOME - PHASE 6
// Individuelle Haustier-Instanzen
// Persönlichkeiten, Pet-Shop, Onboarding
// Save-Migration von Phase 5
// =========================

(function () {

    // ====================================
    // KONSTANTEN
    // ====================================

    const SAVE_KEY         = "cozyHomeData";
    const TICK_INTERVAL_MS = 60000;
    const SLEEP_THRESHOLD  = 20;
    const PLAY_ENERGY_COST = 10;
    const STARTER_PET_COST = 0;    // erstes Tier kostenlos
    const EXTRA_PET_COST   = 100;  // weitere Tiere im Shop

    // ====================================
    // ENVIRONMENT – Jahreszeit, Tageszeit, Wetter
    // ====================================
    //
    // Zentrale Datenquelle für alle Umgebungsinformationen.
    // Neue Jahreszeiten, Tageszeiten oder Wetterarten hier ergänzen.
    // Kein weiterer Code muss angepasst werden.
    //
    // ORDNERSTRUKTUR:
    //   games/cozy-home/assets/backgrounds/
    //   ├── room.png              ← Zimmer (transparentes Fenster)
    //   ├── spring.png            ← hinter dem Fenster sichtbar
    //   ├── summer.png
    //   ├── fall.png
    //   └── winter.png
    //   weather/                  ← Overlay-PNGs, noch nicht vorhanden
    //   ├── rain.png              ← später: halbtransparentes Overlay
    //   ├── snow.png
    //   └── ...
    // ====================================

    const ENV_BACKGROUNDS_PATH = "games/cozy-home/assets/backgrounds/";
    const ENV_WEATHER_PATH     = "games/cozy-home/assets/weather/";

    // Jahreszeiten-Definition
    // month: 0-basiert (0 = Januar)
    const ENV_SEASONS = [
        { id: "spring", name: "Frühling", months: [2, 3, 4],  file: "spring.png" },
        { id: "summer", name: "Sommer",   months: [5, 6, 7],  file: "summer.png" },
        { id: "fall",   name: "Herbst",   months: [8, 9, 10], file: "fall.png"   },
        { id: "winter", name: "Winter",   months: [11, 0, 1], file: "winter.png" }
    ];

    // Tageszeit-Definition
    // cssClass: wird auf .ch-room gesetzt (CSS-Filter-Klassen unten)
    const ENV_TIMES_OF_DAY = [
        { id: "morning", name: "Morgen", startH:  6, endH: 11, cssClass: "env-morning" },
        { id: "midday",  name: "Mittag", startH: 11, endH: 18, cssClass: "env-midday"  },
        { id: "evening", name: "Abend",  startH: 18, endH: 22, cssClass: "env-evening" },
        { id: "night",   name: "Nacht",  startH: 22, endH:  6, cssClass: "env-night"   }
    ];

    // Wetter-Definition
    // overlayFile: null = kein Overlay; später z.B. "rain.png"
    const ENV_WEATHERS = {
        clear:  { id: "clear",  name: "Klar",    overlayFile: null },
        rain:   { id: "rain",   name: "Regen",   overlayFile: "rain.png"   },
        snow:   { id: "snow",   name: "Schnee",  overlayFile: "snow.png"   },
        fog:    { id: "fog",    name: "Nebel",   overlayFile: "fog.png"    },
        storm:  { id: "storm",  name: "Gewitter",overlayFile: "storm.png"  }
    };

    // ── Berechnungsfunktionen ──

    function getEnvSeason() {
        const month = new Date().getMonth(); // 0-basiert
        return ENV_SEASONS.find(s => s.months.includes(month)) || ENV_SEASONS[0];
    }

    function getEnvTimeOfDay() {
        const hour = new Date().getHours();
        return ENV_TIMES_OF_DAY.find(t => {
            if (t.startH < t.endH) return hour >= t.startH && hour < t.endH;
            return hour >= t.startH || hour < t.endH; // Mitternachts-Überlauf (Nacht)
        }) || ENV_TIMES_OF_DAY[1];
    }

    function getEnvWeather() {
        // Aktuell: immer "clear".
        // Später: hier Wetter-API, Benutzerwahl oder
        // zufällige Wetterlogik einhängen.
        return ENV_WEATHERS.clear;
    }

    // Zentraler Snapshot – einmal pro render() berechnet
    function getEnvironment() {
        const season    = getEnvSeason();
        const timeOfDay = getEnvTimeOfDay();
        const weather   = getEnvWeather();
        return {
            season,
            timeOfDay,
            weather,
            seasonBgSrc:     ENV_BACKGROUNDS_PATH + season.file,
            weatherOverlaySrc: weather.overlayFile
                ? ENV_WEATHER_PATH + weather.overlayFile
                : null
        };
    }


    // ====================================
    // PERSÖNLICHKEITEN
    // Vollständig datengetrieben.
    // Neue Persönlichkeiten hier ergänzen.
    // ====================================

    const PERSONALITIES = {
        playful: {
            id:          "playful",
            name:        "Verspielt",
            emoji:       "🎾",
            description: "+5 Happiness beim Spielen",
            applyPlay:       (bonus) => bonus + 5,
            applyPet:        (bonus) => bonus,
            applyHungerDecay:(m)     => m,
            applyHappDecay:  (v)     => v,
            playCostExtra:   0
        },
        lazy: {
            id:          "lazy",
            name:        "Faul",
            emoji:       "💤",
            description: "+5 Happiness beim Schlafen, Spielen kostet mehr Energie",
            applyPlay:       (bonus) => bonus,
            applyPet:        (bonus) => bonus,
            applyHungerDecay:(m)     => m,
            applyHappDecay:  (v)     => v,
            playCostExtra:   5
        },
        balanced: {
            id:          "balanced",
            name:        "Ausgeglichen",
            emoji:       "⚖️",
            description: "Keine besonderen Boni",
            applyPlay:       (bonus) => bonus,
            applyPet:        (bonus) => bonus,
            applyHungerDecay:(m)     => m,
            applyHappDecay:  (v)     => v,
            playCostExtra:   0
        },
        affectionate: {
            id:          "affectionate",
            name:        "Anhänglich",
            emoji:       "❤️",
            description: "+5 Happiness beim Streicheln",
            applyPlay:       (bonus) => bonus,
            applyPet:        (bonus) => bonus + 5,
            applyHungerDecay:(m)     => m,
            applyHappDecay:  (v)     => v,
            playCostExtra:   0
        },
        frugal: {
            id:          "frugal",
            name:        "Genügsam",
            emoji:       "🌱",
            description: "Hunger und Happiness sinken langsamer",
            applyPlay:       (bonus) => bonus,
            applyPet:        (bonus) => bonus,
            applyHungerDecay:(m)     => m * 0.6,
            applyHappDecay:  (v)     => v * 0.6,
            playCostExtra:   0
        },
        glutton: {
            id:          "glutton",
            name:        "Vielfraß",
            emoji:       "🍖",
            description: "+5 Hunger beim Füttern, Hunger sinkt schneller",
            applyPlay:       (bonus) => bonus,
            applyPet:        (bonus) => bonus,
            applyHungerDecay:(m)     => m * 1.5,
            applyHappDecay:  (v)     => v,
            playCostExtra:   0
        }
    };

    const PERSONALITY_KEYS = Object.keys(PERSONALITIES);

    // ====================================
    // ZUFALLSNAMEN PRO TIERART
    // Nur für den Namensgenerator.
    // Kein Hardcode in der Spiellogik.
    // ====================================

    const PET_NAME_POOLS = {
        cat:   ["Momo", "Luna", "Nala", "Mochi", "Socks", "Bella", "Cleo", "Kiki"],
        dog:   ["Rex", "Buddy", "Bruno", "Rocky", "Max", "Bello", "Luca", "Finn"],
        mouse: ["Pip", "Peanut", "Nibbles", "Squeak", "Cheddar", "Whisker"],
        _default: ["Flöckchen", "Schnuffi", "Kuschel", "Biscuit", "Nugget"]
    };

    // ====================================
    // FOOD_REGISTRY
    //
    // Zentrale Futterquelle. Kein Futter-Hardcode sonst im Code.
    // Neues Futter: Eintrag hier ergänzen + Startwert in DEFAULT_SAVE.inventory.
    //
    // hungerRestore  → Hunger-Gewinn (Basis, vor Vorlieben-Modifier)
    // energyRestore  → Energie-Gewinn beim Fressen
    // ====================================

    const FOOD_REGISTRY = {
        kibble:  { key: "kibble",  name: "Trockenfutter", emoji: "🥣", price: 1,  hungerRestore: 20, energyRestore: 2 },
        meat:    { key: "meat",    name: "Fleisch",        emoji: "🍖", price: 5,  hungerRestore: 28, energyRestore: 5 },
        fish:    { key: "fish",    name: "Fisch",          emoji: "🐟", price: 5,  hungerRestore: 25, energyRestore: 4 },
        cheese:  { key: "cheese",  name: "Käse",           emoji: "🧀", price: 5,  hungerRestore: 22, energyRestore: 3 },
        snack:   { key: "snack",   name: "Leckerli",       emoji: "🍪", price: 10, hungerRestore: 15, energyRestore: 1 },
        carrot:  { key: "carrot",  name: "Karotte",        emoji: "🥕", price: 2,  hungerRestore: 18, energyRestore: 2 },
        egg:     { key: "egg",     name: "Ei",             emoji: "🥚", price: 3,  hungerRestore: 20, energyRestore: 3 }
    };

    // ====================================
    // TOY_REGISTRY
    //
    // Zentrale Spielzeugquelle. Gleiche Architektur wie FOOD_REGISTRY.
    // Neues Spielzeug: Eintrag hier + Startwert in DEFAULT_SAVE.inventory.
    //
    // happinessBonus → Happiness-Gewinn (Basis, vor Vorlieben-Modifier)
    // energyCost     → Energie-Verbrauch beim Spielen (zusätzlich zu PLAY_ENERGY_COST)
    // ====================================

    const TOY_REGISTRY = {
        toyBall:     { key: "toyBall",     name: "Ball",         emoji: "⚽", price: 50, happinessBonus: 5, energyCost: 0 },
        toyFeather:  { key: "toyFeather",  name: "Federstab",    emoji: "🪶", price: 40, happinessBonus: 4, energyCost: 0 },
        toyLaser:    { key: "toyLaser",    name: "Laserpointer", emoji: "🔴", price: 35, happinessBonus: 6, energyCost: 2 }
    };

    // Abgeleitete Shop-Liste: alle Futter + alle Spielzeuge
    const SHOP_ITEMS = [
        ...Object.values(FOOD_REGISTRY),
        ...Object.values(TOY_REGISTRY)
    ];

    // ====================================
    // TAGESAUFGABEN
    // ====================================

    const TASK_DEFINITIONS = [
        { id: "pet",  text: "❤️ Streichle dein Haustier",   reward: 10 },
        { id: "feed", text: "🍖 Füttere dein Haustier",      reward: 20 },
        { id: "play", text: "🎮 Spiele mit deinem Haustier", reward: 25 }
    ];

    // ====================================
    // DEFAULT SAVE (Phase 6)
    // ====================================

    const DEFAULT_SAVE = {
        version:       7,
        activePetUid:  null,         // uid der aktiven Instanz
        lastUpdate:    Date.now(),
        coins:         0,
        ownedPets:     [],           // Array von Pet-Instanzen
        // Inventar: alle Food- und Toy-Keys mit Startwerten
        inventory: {
            kibble:     10,
            meat:       5,
            fish:       5,
            cheese:     5,
            snack:      5,
            carrot:     3,
            egg:        3,
            toyBall:    1,
            toyFeather: 0,
            toyLaser:   0
        },
        dailyTasks: {
            lastReset: null,
            tasks:     []
        }
    };

    // ====================================
    // MODULE STATE
    // ====================================

    let root              = null;
    let save              = null;
    let tickIntervalId    = null;
    let showReactionThought = null;   // "love" | "like" | "dislike" | null

    // Onboarding / Pet-Kauf UI-State
    let uiState = "game";     // "game" | "onboarding" | "buy-pet" | "name-pet"
    let pendingSpecies = null; // Tierart die gerade benannt wird

    // ====================================
    // HILFSFUNKTIONEN
    // ====================================

    function clamp(v) { return Math.max(0, Math.min(100, v)); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function uid()  { return "pet_" + Date.now() + "_" + Math.floor(Math.random() * 10000); }

    function isSleepy(pet) { return pet.energy < SLEEP_THRESHOLD; }

    function getMood(pet) {
        if (!pet) return "";
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

    function randomPersonality() {
        return pick(PERSONALITY_KEYS);
    }

    function getPersonality(pet) {
        return PERSONALITIES[pet.personality] || PERSONALITIES.balanced;
    }

    function getRandomName(species) {
        const pool = PET_NAME_POOLS[species] || PET_NAME_POOLS._default;
        return pick(pool);
    }

    // ====================================
    // AKTIVE PET-INSTANZ & DEFINITION
    // ====================================

    function getActivePet() {
        return save.ownedPets.find(p => p.uid === save.activePetUid) || null;
    }

    function getActiveDef() {
        const pet = getActivePet();
        if (!pet) return null;
        return PET_DEFINITIONS[pet.species] || null;
    }

    // ====================================
    // PET-INSTANZ ERSTELLEN
    // ====================================

    // ====================================
    // VORLIEBEN-SYSTEM
    //
    // Beim Kauf erhält jede Instanz zufällige Vorlieben für Futter + Spielzeug.
    // "discovered" speichert, welche Items das Tier bereits bekommen hat.
    // Nur entdeckte Vorlieben werden im Steckbrief angezeigt.
    //
    // preference-Level:
    //   "love"    → Liebling   (+Hunger+Bonus-Happiness)
    //   "like"    → Mag es     (+Hunger+kleiner Bonus)
    //   "neutral" → Neutral    (+Hunger, kein Bonus)
    //   "dislike" → Mag nicht  (+Hunger, -Happiness)
    // ====================================

    function buildRandomPreferences(registry) {
        const keys = Object.keys(registry);
        // Mischen (Fisher-Yates)
        const shuffled = [...keys];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        // Zuweisung: 1 love, 2 like, Rest aufgeteilt neutral/dislike
        const result = {};
        shuffled.forEach((key, idx) => {
            if (idx === 0)                       result[key] = "love";
            else if (idx <= 2)                   result[key] = "like";
            else if (idx <= Math.floor(keys.length * 0.6)) result[key] = "neutral";
            else                                 result[key] = "dislike";
        });
        return result;
    }

    function createPetInstance(species, name, personalityId) {
        return {
            uid:         uid(),
            species:     species,
            name:        name || getRandomName(species),
            personality: personalityId || randomPersonality(),
            hunger:      100,
            energy:      100,
            happiness:   100,
            // Zufällige Vorlieben – beim Kauf einmalig festgelegt
            foodPrefs: buildRandomPreferences(FOOD_REGISTRY),
            toyPrefs:  buildRandomPreferences(TOY_REGISTRY),
            // Entdeckte Items: { foodKey: true, ... }
            // Nur entdeckte Items werden im Steckbrief angezeigt
            discovered: { food: {}, toy: {} }
        };
    }

    function addPet(species, name, personalityId) {
        const instance = createPetInstance(species, name, personalityId);
        save.ownedPets.push(instance);
        save.activePetUid = instance.uid;
        saveData();
        return instance;
    }

    function selectPet(uid) {
        save.activePetUid = uid;
        saveData();
        render();
    }

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
            return migrateSave(parsed);
        } catch {
            const fresh = structuredClone(DEFAULT_SAVE);
            localStorage.setItem(SAVE_KEY, JSON.stringify(fresh));
            return fresh;
        }
    }

    function saveData() {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        // Externe Listener benachrichtigen (z.B. Game-Hub Pet-Karte)
        if (typeof window.cozyHome?._onUpdate === 'function') {
            window.cozyHome._onUpdate();
        }
    }

    // ====================================
    // MIGRATION
    // Phase ≤5 → Phase 6 → Phase 7
    // ====================================

    function migrateSave(s) {

        // ── Phase 6: ownedPets noch nicht vorhanden ──
        // Altes Format: s.pets = { cat: {unlocked, hunger, ...}, ... }
        if (!Array.isArray(s.ownedPets)) {
            s.ownedPets = [];

            if (s.pets && typeof s.pets === "object") {
                Object.entries(s.pets).forEach(([species, petState]) => {
                    if (!petState.unlocked && species !== (s.activePet)) return;
                    const instance = createPetInstance(species, getRandomName(species), "balanced");
                    instance.hunger    = petState.hunger    ?? 100;
                    instance.energy    = petState.energy    ?? 100;
                    instance.happiness = petState.happiness ?? 100;
                    if (species === s.activePet) s.ownedPets.unshift(instance);
                    else                         s.ownedPets.push(instance);
                });
            }

            s.activePetUid = s.ownedPets[0]?.uid || null;
            delete s.activePet;
            delete s.pets;
        }

        // ── Phase 7: Vorlieben-System ──
        // Bestehende Pet-Instanzen ohne foodPrefs/toyPrefs/discovered nachrüsten
        if (Array.isArray(s.ownedPets)) {
            s.ownedPets.forEach(pet => {
                if (!pet.foodPrefs)  pet.foodPrefs  = buildRandomPreferences(FOOD_REGISTRY);
                if (!pet.toyPrefs)   pet.toyPrefs   = buildRandomPreferences(TOY_REGISTRY);
                if (!pet.discovered) pet.discovered = { food: {}, toy: {} };
                // Unterfelder nachrüsten falls teilweise vorhanden
                if (!pet.discovered.food) pet.discovered.food = {};
                if (!pet.discovered.toy)  pet.discovered.toy  = {};
            });
        }

        // ── Version-Feld ──
        s.version = 7;

        // ── Pflichtfelder ──
        if (typeof s.coins !== "number") s.coins = 0;
        if (!s.inventory || typeof s.inventory !== "object") {
            s.inventory = structuredClone(DEFAULT_SAVE.inventory);
        } else {
            const inv = DEFAULT_SAVE.inventory;
            // Neue Keys mit Startwert ergänzen, vorhandene nicht überschreiben
            Object.keys(inv).forEach(k => {
                if (typeof s.inventory[k] !== "number") s.inventory[k] = inv[k];
            });
        }
        if (!s.dailyTasks || !Array.isArray(s.dailyTasks.tasks)) {
            s.dailyTasks = { lastReset: null, tasks: [] };
        }
        if (!s.lastUpdate) s.lastUpdate = Date.now();

        return s;
    }

    // ====================================
    // GEDANKENBLASEN
    // ====================================

    function getPetThought(def, pet, reactionKey) {
        // reactionKey: "love" | "like" | "neutral" | "dislike" | null
        if (reactionKey === "love")    return "💭 Das esse ich besonders gerne!";
        if (reactionKey === "like")    return "💭 Lecker!";
        if (reactionKey === "dislike") return "💭 Das mag ich eigentlich nicht...";
        if (pet.hunger    < 25) return pick(def.thoughts.hungry);
        if (pet.energy    < 25) return pick(def.thoughts.tired);
        if (pet.happiness < 25) return pick(def.thoughts.lonely);
        return pick(def.thoughts.happy);
    }

    // ====================================
    // VORLIEBEN-HELPER
    // ====================================

    // Gibt den Preference-Level für ein Item zurück.
    // Unbekannte Items → "neutral" (kein Crash, keine Spoiler).
    function getPreferenceLevel(prefMap, key) {
        return (prefMap && prefMap[key]) || "neutral";
    }

    // ====================================
    // PREFERENCE_LEVELS
    //
    // Zentrale Balance-Registry für alle Vorlieben-Reaktionen.
    // Neuen Level ergänzen = ein Eintrag hier, kein weiterer Code nötig.
    //
    // hungerDelta      → Bonus/Malus auf hungerRestore des Futters
    // happinessDelta   → Direkte Happiness-Änderung
    // ====================================

    const PREFERENCE_LEVELS = {
        love:    { hungerDelta:  +10, happinessDelta: +12 },
        like:    { hungerDelta:    0, happinessDelta:  +5 },
        neutral: { hungerDelta:    0, happinessDelta:   0 },
        dislike: { hungerDelta:   -5, happinessDelta:  -8 }
    };

    // Liest einen Eintrag aus PREFERENCE_LEVELS.
    // Unbekannte Level fallen auf "neutral" zurück.
    function getPrefLevel(level) {
        return PREFERENCE_LEVELS[level] || PREFERENCE_LEVELS.neutral;
    }

    // Markiert ein Item als entdeckt (food oder toy).
    function markDiscovered(pet, category, key) {
        if (!pet.discovered)           pet.discovered = { food: {}, toy: {} };
        if (!pet.discovered[category]) pet.discovered[category] = {};
        pet.discovered[category][key] = true;
    }

    // Gibt verfügbare Futter aus dem Inventar zurück (count > 0).
    function getAvailableFood() {
        return Object.values(FOOD_REGISTRY).filter(f => (save.inventory[f.key] || 0) > 0);
    }

    // Gibt verfügbare Spielzeuge aus dem Inventar zurück (count > 0).
    function getAvailableToys() {
        return Object.values(TOY_REGISTRY).filter(t => (save.inventory[t.key] || 0) > 0);
    }

    // ====================================
    // OFFLINE-FORTSCHRITT
    // ====================================

    function applyOfflineProgress() {
        const now          = Date.now();
        const elapsedHours = (now - save.lastUpdate) / 3600000;
        if (elapsedHours <= 0) return;

        save.ownedPets.forEach(pet => {
            const def  = PET_DEFINITIONS[pet.species];
            const pers = getPersonality(pet);
            const hMult = def ? pers.applyHungerDecay(def.hungerDecayMultiplier) : 1;

            pet.hunger    = clamp(pet.hunger    - elapsedHours * 2 * hMult);
            pet.energy    = clamp(pet.energy    - elapsedHours * 1);
            pet.happiness = clamp(pers.applyHappDecay(pet.happiness - elapsedHours * 1));
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
            id: d.id, text: d.text, reward: d.reward, completed: false
        }));
    }

    function checkDailyReset() {
        const today     = new Date().toDateString();
        const lastReset = save.dailyTasks.lastReset
            ? new Date(save.dailyTasks.lastReset).toDateString() : null;
        if (lastReset !== today) { generateDailyTasks(); saveData(); }
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
        const pet  = getActivePet();
        const pers = getPersonality(pet);
        pet.happiness = clamp(pet.happiness + pers.applyPet(5));
        completeTask("pet");
        saveData(); render();
    }

    function feedPet(foodKey) {
        if (!foodKey) return;
        const food = FOOD_REGISTRY[foodKey];
        if (!food || (save.inventory[food.key] || 0) <= 0) return;

        const pet   = getActivePet();
        const pers  = getPersonality(pet);
        const level = getPreferenceLevel(pet.foodPrefs, foodKey);
        const pref       = getPrefLevel(level);
        const hungerGain = Math.max(0, food.hungerRestore + pref.hungerDelta) + (pers.id === "glutton" ? 5 : 0);
        pet.hunger    = clamp(pet.hunger    + hungerGain);
        pet.energy    = clamp(pet.energy    + food.energyRestore);
        pet.happiness = clamp(pet.happiness + pref.happinessDelta);

        // Vorliebe entdecken
        markDiscovered(pet, "food", foodKey);
        // Gedankenblase
        showReactionThought = level !== "neutral" ? level : null;

        save.inventory[food.key] -= 1;
        completeTask("feed");
        saveData(); render();
    }

    function playPet(toyKey) {
        const pet  = getActivePet();
        const def  = getActiveDef();
        const pers = getPersonality(pet);
        const cost = PLAY_ENERGY_COST + pers.playCostExtra;
        if (pet.energy < cost) return;

        // Spielzeug: wenn kein toyKey → kein Spielzeug → Basis-Bonus
        const toy      = toyKey ? TOY_REGISTRY[toyKey] : null;
        const toyInInv = toy && (save.inventory[toy.key] || 0) > 0;
        const level    = toyInInv ? getPreferenceLevel(pet.toyPrefs, toyKey) : "neutral";
        const toyBase  = toyInInv ? (def.playHappinessBase + toy.happinessBonus) : def.playHappinessBase;
        const pref     = getPrefLevel(level);
        const happGain = pers.applyPlay(toyBase) + pref.happinessDelta;

        pet.happiness = clamp(pet.happiness + happGain);
        pet.energy    = clamp(pet.energy - cost - (toy?.energyCost || 0));

        // Vorliebe entdecken
        if (toyInInv) {
            markDiscovered(pet, "toy", toyKey);
            showReactionThought = level !== "neutral" ? level : null;
        }
        completeTask("play");
        saveData(); render();
    }

    function sleepPet() {
        const pet  = getActivePet();
        const pers = getPersonality(pet);
        const gain = pers.id === "lazy" ? 30 : 25;
        pet.energy = clamp(pet.energy + gain);
        saveData(); render();
    }

    function buyItem(key) {
        const item = SHOP_ITEMS.find(i => i.key === key);
        if (!item || save.coins < item.price) return;
        save.coins -= item.price;
        save.inventory[key] = (save.inventory[key] || 0) + 1;
        saveData(); render();
    }

    function buyPet(species, name) {
        const isFirst = save.ownedPets.length === 0;
        const def     = PET_DEFINITIONS[species];
        // Cross-Game-Tiere haben einen eigenen shopPrice; Standard: EXTRA_PET_COST
        const cost    = isFirst ? STARTER_PET_COST : (def?.shopPrice ?? EXTRA_PET_COST);
        if (save.coins < cost) return;
        save.coins -= cost;
        addPet(species, name);
        uiState = "game";
        pendingSpecies = null;
        saveData(); render();
    }

    // ====================================
    // TICK
    // ====================================

    function tick() {
        save.ownedPets.forEach(pet => {
            const def  = PET_DEFINITIONS[pet.species];
            const pers = getPersonality(pet);
            const hMult = def ? pers.applyHungerDecay(def.hungerDecayMultiplier) : 1;
            pet.hunger    = clamp(pet.hunger    - 1 * hMult);
            pet.energy    = clamp(pet.energy    - 0.5);
            pet.happiness = clamp(pers.applyHappDecay(pet.happiness - 0.5));
        });
        save.lastUpdate = Date.now();
        saveData(); render();
    }

    function startTickTimer() {
        stopTickTimer();
        tickIntervalId = setInterval(tick, TICK_INTERVAL_MS);
    }

    function stopTickTimer() {
        if (tickIntervalId !== null) { clearInterval(tickIntervalId); tickIntervalId = null; }
    }

    // ====================================
    // RENDER: ONBOARDING
    // ====================================

    function renderOnboarding() {
        root.innerHTML = `
<div class="ch-root ch-onboarding">
  <div class="ch-ob-box">
    <div class="ch-ob-title">🏠 Willkommen in Cozy Home!</div>
    <div class="ch-ob-sub">Wähle dein erstes Haustier – es ist kostenlos.</div>
    <div class="ch-ob-species-grid">
      ${Object.values(PET_DEFINITIONS).map(d => `
      <button class="ch-ob-species-btn" data-species="${d.id}">
        ${petIconTag(d.id, "ch-ob-species-img", d.name)}
        <div class="ch-ob-species-name">${d.name}</div>
        <div class="ch-ob-species-desc">${d.description}</div>
      </button>`).join('')}
    </div>
  </div>
</div>`;

        root.querySelectorAll(".ch-ob-species-btn[data-species]").forEach(btn => {
            btn.onclick = () => {
                pendingSpecies = btn.dataset.species;
                uiState = "name-pet";
                renderNamePet();
            };
        });
    }

    // ====================================
    // RENDER: NAME-PET SCREEN
    // ====================================

    function renderNamePet() {
        const def  = PET_DEFINITIONS[pendingSpecies];
        const isFirst = save.ownedPets.length === 0;
        const cost    = isFirst ? STARTER_PET_COST : (def?.shopPrice ?? EXTRA_PET_COST);

        root.innerHTML = `
<div class="ch-root ch-onboarding">
  <div class="ch-ob-box">
    <div class="ch-ob-title">${def.name} benennen</div>
    <div class="ch-ob-pet-preview">
      ${petImgTag(pendingSpecies, "default", "ch-ob-preview-img", def.name)}
    </div>
    <div class="ch-ob-sub">Wie soll dein ${def.name} heißen?</div>
    <div class="ch-ob-name-row">
      <input class="ch-ob-name-input" id="ch-name-input" type="text"
             placeholder="${getRandomName(pendingSpecies)}" maxlength="20">
      <button class="ch-ob-random-btn" id="ch-random-name">🎲</button>
    </div>
    <div class="ch-ob-actions">
      <button class="ch-ob-back-btn" id="ch-name-back">← Zurück</button>
      <button class="ch-ob-confirm-btn" id="ch-name-confirm">
        ${cost > 0 ? `🪙 ${cost} · ` : ''}Bestätigen ✓
      </button>
    </div>
    ${cost > 0 && save.coins < cost
      ? `<div class="ch-ob-warn">Nicht genug Münzen (🪙 ${save.coins} / ${cost})</div>`
      : ''}
  </div>
</div>`;

        const input   = root.querySelector("#ch-name-input");
        const confirm = root.querySelector("#ch-name-confirm");
        const back    = root.querySelector("#ch-name-back");
        const random  = root.querySelector("#ch-random-name");

        random.onclick = () => { input.value = getRandomName(pendingSpecies); };

        back.onclick = () => {
            if (save.ownedPets.length === 0) {
                uiState = "onboarding";
                renderOnboarding();
            } else {
                uiState = "buy-pet";
                renderBuyPet();
            }
        };

        confirm.onclick = () => {
            const name = input.value.trim() || getRandomName(pendingSpecies);
            const isFirst2 = save.ownedPets.length === 0;
            const def2     = PET_DEFINITIONS[pendingSpecies];
            const cost2    = isFirst2 ? STARTER_PET_COST : (def2?.shopPrice ?? EXTRA_PET_COST);
            if (save.coins < cost2) return;
            buyPet(pendingSpecies, name);
        };
    }

    // ====================================
    // RENDER: BUY-PET SCREEN (Pet-Shop)
    // Zeigt nur Standard-Haustiere (ohne sourceGame).
    // Cross-Game-Haustiere erscheinen ausschließlich im Accordion-Shop.
    // ====================================

    function renderBuyPet() {
        const standardPets = Object.values(PET_DEFINITIONS).filter(d => !d.sourceGame);
        root.innerHTML = `
<div class="ch-root ch-onboarding">
  <div class="ch-ob-box">
    <div class="ch-ob-title">🐾 Haustiershop</div>
    <div class="ch-ob-sub">Wähle ein neues Haustier – 🪙 ${EXTRA_PET_COST} Münzen</div>
    <div class="ch-ob-sub ch-ob-coins">Dein Guthaben: 🪙 ${save.coins}</div>
    <div class="ch-ob-species-grid">
      ${standardPets.map(d => `
      <button class="ch-ob-species-btn ${save.coins < EXTRA_PET_COST ? 'disabled' : ''}"
              data-species="${d.id}">
        ${petIconTag(d.id, "ch-ob-species-img", d.name)}
        <div class="ch-ob-species-name">${d.name}</div>
        <div class="ch-ob-species-desc">${d.description}</div>
      </button>`).join('')}
    </div>
    <div class="ch-ob-actions">
      <button class="ch-ob-back-btn" id="ch-shop-back">← Zurück</button>
    </div>
  </div>
</div>`;

        root.querySelectorAll(".ch-ob-species-btn[data-species]:not(.disabled)").forEach(btn => {
            btn.onclick = () => {
                pendingSpecies = btn.dataset.species;
                uiState = "name-pet";
                renderNamePet();
            };
        });

        root.querySelector("#ch-shop-back").onclick = () => {
            uiState = "game";
            render();
        };
    }

    // ====================================
    // RENDER: HAUPTSPIEL
    // ====================================

    function render() {

        // Kein Haustier → Onboarding
        if (save.ownedPets.length === 0) {
            uiState = "onboarding";
            renderOnboarding();
            return;
        }

        // Sonderfälle UI-State
        if (uiState === "onboarding")  { renderOnboarding(); return; }
        if (uiState === "buy-pet")     { renderBuyPet();     return; }
        if (uiState === "name-pet")    { renderNamePet();    return; }

        const pet  = getActivePet();
        const def  = getActiveDef();
        if (!pet || !def) { renderOnboarding(); return; }

        const env = getEnvironment();

        const pers     = getPersonality(pet);
        const warnings = getWarnings(pet);
        const cost     = PLAY_ENERGY_COST + pers.playCostExtra;
        const canPlay    = pet.energy >= cost;
        const availFood  = getAvailableFood();
        const availToys  = getAvailableToys();
        const noFood     = availFood.length === 0;
        const noToy      = availToys.length === 0;
        const tasks      = save.dailyTasks.tasks;
        // Basis-Spielbonus ohne Spielzeug (Vergleichswert für UI)
        const playBonus  = pers.applyPlay(def.playHappinessBase);

        const petImgState = getPetImageState(pet);

        // Debug-Logging (auf false setzen um zu deaktivieren)
        if (false) {
            console.log(
                "[CozyHome] Emotion:", petImgState,
                "| Hunger:", Math.round(pet.hunger),
                "| Energy:", Math.round(pet.energy),
                "| Happiness:", Math.round(pet.happiness)
            );
            const _def2 = PET_DEFINITIONS[pet.species];
            if (_def2) {
                const _src = getPetImageSrc(pet.species, petImgState);
                const _fb  = getPetImageFallback(pet.species);
                console.log("[CozyHome] Asset gesucht:", _src);
                console.log("[CozyHome] Fallback wäre:", _fb);
            }
        }

        const useReactionThought = showReactionThought;
        showReactionThought = null;
        const thought = getPetThought(def, pet, useReactionThought);

        const openPanel = root.querySelector?.('.ch-acc-body:not(.hidden)')?.dataset.panel || null;

        root.innerHTML = `
<div class="ch-root">
  <div class="ch-grid">

    <!-- ── SP1: HAUSTIERE ── -->
    <div class="ch-col-pets">
      <div class="ch-pets-label">Haustiere</div>
      <div class="ch-pets-list">
        ${save.ownedPets.map(p => {
            const pDef = PET_DEFINITIONS[p.species];
            return `
        <button class="ch-pet-btn ${p.uid === save.activePetUid ? 'active' : ''}" data-uid="${p.uid}">
          ${petIconTag(p.species, "ch-pet-btn-img", p.name)}
          <div class="ch-pet-btn-info">
            <div class="ch-pet-btn-name">${p.name}</div>
            <div class="ch-pet-btn-mood">${getMood(p)}</div>
          </div>
        </button>`;
        }).join('')}
        <button class="ch-pet-btn ch-pet-add" id="ch-add-pet-btn">
          <div class="ch-pet-btn-lock">➕</div>
          <div class="ch-pet-btn-info">
            <div class="ch-pet-btn-name">Neues Tier</div>
          </div>
        </button>
        ${Array.from({length: Math.max(0, 3 - save.ownedPets.length)}).map(() => `
        <div class="ch-pet-btn locked">
          <div class="ch-pet-btn-lock">🔒</div>
          <div class="ch-pet-btn-info">
            <div class="ch-pet-btn-name">???</div>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <!-- ── SP2: ZIMMER + STECKBRIEF ── -->
    <div class="ch-col-main">
      <div class="ch-room ${env.timeOfDay.cssClass}">
        <!-- Ebene 1: Jahreszeit hinter dem Fenster -->
        <img class="ch-room-season" src="${env.seasonBgSrc}" alt="${env.season.name}">
        <!-- Ebene 2: Zimmer mit transparentem Fenster -->
        <img class="ch-room-bg" src="games/cozy-home/assets/backgrounds/room.png" alt="Zimmer">
        <!-- Ebene 3: Wetter-Overlay (null = unsichtbar) -->
        ${env.weatherOverlaySrc
          ? `<img class="ch-room-weather" src="${env.weatherOverlaySrc}" alt="${env.weather.name}">`
          : '<div class="ch-room-weather" aria-hidden="true"></div>'}
        <!-- Ebene 4: Gedankenblase -->
        <div class="ch-bubble">${thought}</div>
        <!-- Ebene 5: Haustier -->
        ${petImgTag(pet.species, petImgState, "ch-room-pet", pet.name)}
      </div>

      <div class="ch-profile">
        <div class="ch-profile-title">Steckbrief · ${pet.name}</div>
        <div class="ch-profile-body">
          <div class="ch-profile-data">
            <div class="ch-profile-row"><span class="ch-pl">🐾 Art</span><span class="ch-pv">${def.species}</span></div>
            <div class="ch-profile-row"><span class="ch-pl">✨ Persönlichkeit</span><span class="ch-pv">${pers.emoji} ${pers.name}</span></div>
            ${(() => {
              // Vorlieben-Steckbrief generisch aus FOOD_REGISTRY und TOY_REGISTRY
              // Jede Kategorie: love, like, dislike (neutral weggelassen = Rauschen)
              function prefRows(registry, prefMap, discoveredMap, label, emoji) {
                const loved    = Object.keys(registry).filter(k => discoveredMap?.[k] && prefMap?.[k] === 'love');
                const liked    = Object.keys(registry).filter(k => discoveredMap?.[k] && prefMap?.[k] === 'like');
                const disliked = Object.keys(registry).filter(k => discoveredMap?.[k] && prefMap?.[k] === 'dislike');
                const anyKnown = loved.length || liked.length || disliked.length;
                const fmt      = (keys) => keys.map(k => registry[k].emoji + ' ' + registry[k].name).join(', ');
                return `
                  <div class="ch-profile-row"><span class="ch-pl">${emoji} ${label} ❤️</span>
                    <span class="ch-pv ch-pv-love">${loved.length    ? fmt(loved)    : '???'}</span></div>
                  <div class="ch-profile-row"><span class="ch-pl">${emoji} ${label} 🙂</span>
                    <span class="ch-pv">${liked.length    ? fmt(liked)    : '???'}</span></div>
                  <div class="ch-profile-row"><span class="ch-pl">${emoji} ${label} 🙁</span>
                    <span class="ch-pv ch-pv-dislike">${disliked.length ? fmt(disliked) : '???'}</span></div>`;
              }
              return prefRows(FOOD_REGISTRY, pet.foodPrefs, pet.discovered?.food, 'Essen', '🍽️')
                   + prefRows(TOY_REGISTRY,  pet.toyPrefs,  pet.discovered?.toy,  'Spielzeug', '🎮');
            })()}
            <div class="ch-profile-row"><span class="ch-pl">🎯 Lieblingsaktivität</span><span class="ch-pv">${def.favoriteActivity}</span></div>
          </div>
          <div class="ch-profile-desc">
            <div>${def.description}</div>
            <div class="ch-profile-pers-hint">${pers.emoji} <em>${pers.description}</em></div>
          </div>
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
        ${warnings.length > 0
          ? `<div class="ch-warnings">${warnings.map(w => `<div class="ch-warning">${w}</div>`).join('')}</div>`
          : ''}
      </div>

      <div class="ch-card">
        <div class="ch-card-title">Aktionen</div>
        <div class="ch-actions">
          <button id="cozy-pet-btn" class="ch-action">
            <div class="ch-action-icon">❤️</div>
            <div class="ch-action-label">Streicheln</div>
            <div class="ch-action-sub">+${pers.applyPet(5)} Happiness</div>
          </button>
          <!-- Füttern-Dropdown -->
          <div class="ch-action-wrap ${noFood ? 'disabled' : ''}" id="ch-feed-wrap">
            <button class="ch-action ch-action-main ${noFood ? 'disabled' : ''}" id="cozy-feed-btn" ${noFood ? 'disabled' : ''}>
              <div class="ch-action-icon">🍽️</div>
              <div class="ch-action-label">Füttern ${noFood ? '' : '▾'}</div>
              <div class="ch-action-sub">${noFood ? 'Kein Futter' : `${availFood.length} verfügbar`}</div>
            </button>
            ${!noFood ? `<div class="ch-action-dropdown" id="ch-feed-dropdown">
              ${availFood.map(f => {
                const level     = getPreferenceLevel(pet.foodPrefs, f.key);
                const known     = pet.discovered?.food?.[f.key];
                const pref      = getPrefLevel(level);
                const effHunger = Math.max(0, f.hungerRestore + pref.hungerDelta);
                const levelEmoji = known
                  ? (level === 'love' ? '❤️' : level === 'like' ? '🙂' : level === 'dislike' ? '🙁' : '😐')
                  : '';
                const subLabel  = known
                  ? `+${effHunger}🍖 ${pref.happinessDelta > 0 ? '+'+pref.happinessDelta+'❤️' : pref.happinessDelta < 0 ? pref.happinessDelta+'❤️' : ''}`
                  : '?';
                return '<button class="ch-dropdown-item" data-feed="' + f.key + '">'
                     + '<span class="ch-dd-emoji">' + f.emoji + '</span>'
                     + '<span class="ch-dd-name">' + f.name + ' <span class="ch-dd-pref">' + levelEmoji + '</span></span>'
                     + '<span class="ch-dd-count">x' + save.inventory[f.key] + '</span>'
                     + '<span class="ch-dd-sub">' + subLabel + '</span>'
                     + '</button>';
              }).join('')}
            </div>` : ''}
          </div>
          <!-- Spielen-Dropdown -->
          <div class="ch-action-wrap ${!canPlay ? 'disabled' : ''}" id="ch-play-wrap">
            <button class="ch-action ch-action-main ${!canPlay ? 'disabled' : ''}" id="cozy-play-btn" ${!canPlay ? 'disabled' : ''}>
              <div class="ch-action-icon">🎮</div>
              <div class="ch-action-label">Spielen ${canPlay && !noToy ? '▾' : ''}</div>
              <div class="ch-action-sub">${!canPlay ? 'Zu wenig Energie' : `+${playBonus} Happiness`}</div>
            </button>
            ${canPlay && !noToy ? `<div class="ch-action-dropdown" id="ch-play-dropdown">
              ${availToys.map(t => {
                const level      = getPreferenceLevel(pet.toyPrefs, t.key);
                const known      = pet.discovered?.toy?.[t.key];
                const levelEmoji = known
                  ? (level === 'love' ? '❤️' : level === 'like' ? '🙂' : level === 'dislike' ? '🙁' : '😐')
                  : '';
                const toyHappBonus = pers.applyPlay(def.playHappinessBase + t.happinessBonus) + getPrefLevel(level).happinessDelta;
                const subLabel   = known ? '+' + toyHappBonus + '❤️' : '?';
                return '<button class="ch-dropdown-item" data-play="' + t.key + '">'
                     + '<span class="ch-dd-emoji">' + t.emoji + '</span>'
                     + '<span class="ch-dd-name">' + t.name + ' <span class="ch-dd-pref">' + levelEmoji + '</span></span>'
                     + '<span class="ch-dd-count">x' + save.inventory[t.key] + '</span>'
                     + '<span class="ch-dd-sub">' + subLabel + '</span>'
                     + '</button>';
              }).join('')}
              <button class="ch-dropdown-item" data-play="__bare__">
                <span class="ch-dd-emoji">🤸</span>
                <span class="ch-dd-name">Ohne Spielzeug</span>
                <span class="ch-dd-count"></span>
                <span class="ch-dd-sub">+${playBonus}❤️</span>
              </button>
            </div>` : ''}
          </div>
          <button id="cozy-sleep-btn" class="ch-action">
            <div class="ch-action-icon">💤</div>
            <div class="ch-action-label">Schlafen</div>
            <div class="ch-action-sub">+${pers.id === 'lazy' ? 30 : 25} Energie</div>
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

    <!-- ── SP4: INVENTAR + SHOP + PET-SHOP ── -->
    <div class="ch-col-inv">

      <div class="ch-accordion">
        <button class="ch-acc-row ${openPanel === 'inv' ? 'open' : ''}" data-target="inv">
          <span>📦 Inventar</span>
          <span class="ch-chevron">${openPanel === 'inv' ? '▲' : '▼'}</span>
        </button>
        <div class="ch-acc-body ${openPanel === 'inv' ? '' : 'hidden'}" data-panel="inv">
          ${[...Object.values(FOOD_REGISTRY), ...Object.values(TOY_REGISTRY)].map(item => {
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
              <button class="ch-buy-btn ${canBuy ? '' : 'disabled'}" data-buy="${item.key}">
                ${canBuy ? 'Kaufen' : '—'}
              </button>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="ch-accordion">
        <button class="ch-acc-row ${openPanel === 'petshop' ? 'open' : ''}" data-target="petshop">
          <span>🐾 Haustiershop</span>
          <span class="ch-chevron">${openPanel === 'petshop' ? '▲' : '▼'}</span>
        </button>
        <div class="ch-acc-body ${openPanel === 'petshop' ? '' : 'hidden'}" data-panel="petshop">
          <div class="ch-inv-row" style="font-size:.75rem;color:var(--text-3);padding-bottom:4px;">
            Guthaben: 🪙 ${save.coins}
          </div>
          ${(() => {
            const allPets      = Object.values(PET_DEFINITIONS);
            const standardPets = allPets.filter(d => !d.sourceGame);
            const crossPets    = allPets.filter(d =>  d.sourceGame);

            const renderStandard = standardPets.map(d => {
              const price  = d.shopPrice ?? EXTRA_PET_COST;
              const canBuy = save.coins >= price;
              return `<div class="ch-shop-row">
                ${petIconTag(d.id, "ch-petshop-img", d.name)}
                <span class="ch-shop-item-name">${d.name}</span>
                <span class="ch-shop-price">🪙${price}</span>
                <button class="ch-buy-btn ${canBuy ? '' : 'disabled'}" data-buypet="${d.id}">
                  ${canBuy ? 'Kaufen' : '—'}
                </button>
              </div>`;
            }).join('');

            const renderCross = crossPets.map(d => {
              const unlocked = checkUnlock(d.unlock);
              const price    = d.shopPrice ?? EXTRA_PET_COST;
              const canBuy   = unlocked && save.coins >= price;
              const srcGame  = window.GameHub?.registry?.[d.sourceGame]?.title ?? d.sourceGame;
              return `<div class="ch-shop-row ch-shop-row-cross ${unlocked ? '' : 'locked'}">
                ${petIconTag(d.id, "ch-petshop-img", unlocked ? d.name : '???')}
                <span class="ch-shop-item-info">
                  <span class="ch-shop-item-name">${unlocked ? d.name : '???'}</span>
                  <span class="ch-shop-item-source">Exklusiv aus ${srcGame}</span>
                  ${!unlocked
                    ? `<span class="ch-shop-item-unlock">${d.unlock?.description ?? ''}</span>`
                    : ''
                  }
                </span>
                ${unlocked ? `<span class="ch-shop-price">🪙${price}</span>` : ''}
                <button class="ch-buy-btn ${canBuy ? '' : 'disabled'}" ${canBuy ? `data-buypet="${d.id}"` : ''}>
                  ${canBuy ? 'Kaufen' : '—'}
                </button>
              </div>`;
            }).join('');

            const crossSection = crossPets.length > 0
              ? `<div class="ch-shop-section-label">Exklusive Haustiere</div>${renderCross}`
              : '';

            return renderStandard + crossSection;
          })()}
        </div>
      </div>

    </div>

  </div>
</div>
`;

        // ── EVENT LISTENER ──

        root.querySelector("#cozy-pet-btn").onclick   = petPet;
        root.querySelector("#cozy-sleep-btn").onclick = sleepPet;

        // ── Dropdown-Logik: Füttern ──
        const feedBtn  = root.querySelector("#cozy-feed-btn");
        const feedDrop = root.querySelector("#ch-feed-dropdown");
        if (feedBtn && feedDrop) {
            feedBtn.onclick = (e) => {
                e.stopPropagation();
                feedDrop.classList.toggle("open");
                root.querySelector("#ch-play-dropdown")?.classList.remove("open");
            };
            feedDrop.querySelectorAll(".ch-dropdown-item[data-feed]").forEach(item => {
                item.onclick = (e) => {
                    e.stopPropagation();
                    feedDrop.classList.remove("open");
                    feedPet(item.dataset.feed);
                };
            });
        }

        // ── Dropdown-Logik: Spielen ──
        const playBtn  = root.querySelector("#cozy-play-btn");
        const playDrop = root.querySelector("#ch-play-dropdown");
        if (playBtn && playDrop) {
            playBtn.onclick = (e) => {
                e.stopPropagation();
                playDrop.classList.toggle("open");
                feedDrop?.classList.remove("open");
            };
            playDrop.querySelectorAll(".ch-dropdown-item[data-play]").forEach(item => {
                item.onclick = (e) => {
                    e.stopPropagation();
                    playDrop.classList.remove("open");
                    const key = item.dataset.play;
                    playPet(key === "__bare__" ? null : key);
                };
            });
        } else if (playBtn && canPlay) {
            // Kein Spielzeug → direkt ohne Spielzeug spielen
            playBtn.onclick = () => playPet(null);
        }

        // Dropdown schließen bei Klick außerhalb
        document.addEventListener("click", function closeDropdowns() {
            root.querySelector("#ch-feed-dropdown")?.classList.remove("open");
            root.querySelector("#ch-play-dropdown")?.classList.remove("open");
            document.removeEventListener("click", closeDropdowns);
        }, { once: false });

        root.querySelector("#ch-add-pet-btn").onclick = () => {
            uiState = "buy-pet";
            renderBuyPet();
        };

        root.querySelectorAll(".ch-pet-btn[data-uid]").forEach(btn => {
            btn.onclick = () => selectPet(btn.dataset.uid);
        });

        root.querySelectorAll(".ch-buy-btn[data-buy]").forEach(btn => {
            const key  = btn.dataset.buy;
            const item = SHOP_ITEMS.find(i => i.key === key);
            if (!item) return;
            btn.onclick = save.coins >= item.price ? () => buyItem(key) : null;
        });

        root.querySelectorAll(".ch-buy-btn[data-buypet]").forEach(btn => {
            const species = btn.dataset.buypet;
            const def     = PET_DEFINITIONS[species];
            const price   = def?.shopPrice ?? EXTRA_PET_COST;
            btn.onclick = (save.coins >= price && checkUnlock(def?.unlock)) ? () => {
                pendingSpecies = species;
                uiState = "name-pet";
                renderNamePet();
            } : null;
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
        collectCrossGamePets();   // Cross-Game-Haustiere aus allen Manifesten einsammeln
        save = loadSave();
        applyOfflineProgress();
        checkDailyReset();
        root = container;
        uiState = save.ownedPets.length === 0 ? "onboarding" : "game";
        render();
        startTickTimer();
    }

    function destroy() {
        stopTickTimer();
        if (root) { root.innerHTML = ""; root = null; }
    }

    // ====================================
    // ÖFFENTLICHE API – window.cozyHome
    //
    // Erlaubt anderen Modulen (z.B. Games Hub), Daten zu lesen und
    // Aktionen auszuführen, ohne eigene Logik zu implementieren.
    //
    // Nutzung:
    //   window.cozyHome.petPet()
    //   window.cozyHome.feedPet("kibble")
    //   window.cozyHome.playPet(null)
    //   window.cozyHome.sleepPet()
    //   window.cozyHome.getSnapshot()  → { pet, def, mood, env, wellbeing, inventory }
    //   window.cozyHome.onUpdate(fn)   → fn wird nach jeder Zustandsänderung aufgerufen
    // ====================================

    window.cozyHome = {
        // Aktionen – exakt dieselben Funktionen wie in Cozy Home selbst
        petPet,
        feedPet,
        playPet,
        sleepPet,

        // Snapshot aller für die Pet-Karte relevanten Daten
        getSnapshot() {
            const pet  = getActivePet();
            const def  = pet ? getActiveDef() : null;
            const pers = pet ? getPersonality(pet) : null;
            if (!pet || !def) return null;
            const wellbeing = Math.round((pet.hunger + pet.energy + pet.happiness) / 3);
            return {
                pet,
                def,
                pers,
                mood:      getMood(pet),
                env:       getEnvironment(),
                imgState:  getPetImageState(pet),
                wellbeing,
                inventory: save?.inventory || {}
            };
        },

        // Listener registrieren – wird nach jeder Zustandsänderung aufgerufen
        onUpdate(fn) {
            this._onUpdate = fn;
        },

        _onUpdate: null
    };

    window.registerGame({
        id: "cozy-home",
        modalSize: "very-big",
        mount,
        destroy
    });

})();
