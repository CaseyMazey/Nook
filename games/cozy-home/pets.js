// ====================================
// pets.js – zentrale Haustier-Registry
// ====================================
//
// ORDNERSTRUKTUR der Assets:
//
//   games/cozy-home/assets/
//   ├── backgrounds/
//   │   └── room.png
//   └── pets/
//       ├── cat/
//       │   ├── icon.png       ← Shop-Icon (quadratisch, freigestellt)
//       │   ├── default.png    ← Pflicht-Fallback
//       │   ├── sleep.png
//       │   └── hungry.png   ← später einfach hinzufügen
//       ├── dog/
//       │   ├── icon.png
//       │   ├── default.png
//       │   └── sleep.png
//       └── mouse/
//           ├── icon.png
//           ├── default.png
//           └── sleep.png
//
// Cross-Game-Haustiere liegen beim jeweiligen Spiel:
//
//   games/snake/assets/pets/snake/
//   ├── icon.png
//   ├── default.png
//   └── sleep.png
//
// Das Haustier registriert seinen eigenen basePath im Manifest.
// Cozy Home kennt keine Pfade, nur das Haustier-Objekt.
//
// ────────────────────────────────────
// NEUES COZY-HOME-HAUSTIER HINZUFÜGEN:
//   1. Eintrag in PET_DEFINITIONS anlegen
//   2. basePath auf den eigenen Assets-Ordner zeigen lassen
//   3. default.png und icon.png dort ablegen (Pflicht)
//   4. Weitere Zustände als <state>.png ergänzen (optional)
//   → Kein weiterer Code nötig
//
// NEUES CROSS-GAME-HAUSTIER HINZUFÜGEN:
//   1. pets-Array im Manifest des Spiels befüllen (vollständige Definition)
//   2. Assets unter games/<spiel>/assets/pets/<id>/ ablegen
//   3. collectCrossGamePets() wird beim Start automatisch aufgerufen
//   → Kein Code in Cozy Home nötig
// ====================================


// ────────────────────────────────────
// BEKANNTE ZUSTANDSNAMEN (Priorität absteigend)
// ────────────────────────────────────

// Alle bekannten Emotionszustände (Priorität absteigend).
// Neue Zustände hier ergänzen wenn Bilder vorhanden sind.
const PET_STATES = [
    "sleep",
    "tired",
    "sad",
    "hungry",
    "lonely",
    "bored",
    "happy",
    "excited",
    "sick",
    "default"
];


// ────────────────────────────────────
// BILDZUSTAND BESTIMMEN
// ────────────────────────────────────

// ────────────────────────────────────
// EMOTIONSZUSTAND BESTIMMEN
//
// Priorität (höher = überschreibt niedrigere):
//   sleep > tired > sad > hungry > lonely > bored > happy > default
//
// Vollständig generisch – keine Tiernamen, kein Hardcode.
// Neue Tiere funktionieren automatisch.
// ────────────────────────────────────

function getPetImageState(petState) {

    const { energy, hunger, happiness } = petState;

    // Schwellenwerte sind identisch mit getWarnings() in cozy-home.js
    // damit UI-Status und Emotionsbild immer übereinstimmen.

    // 1. Absolut erschöpft → schläft
    if (energy < 10)  return "sleep";

    // 2. Alles gleichzeitig kritisch → traurig
    // MUSS vor "tired" stehen, damit sad erreichbar ist wenn energy < 25
    if (happiness < 25 && hunger < 25 && energy < 25) return "sad";

    // 3. Sehr müde → tired
    if (energy < 25)  return "tired";

    // 4. Hunger dominant
    if (hunger < 25)  return "hungry";

    // 5. Einsamkeit / unglücklich
    if (happiness < 25) return "lonely";

    // 6. Energie hoch, aber unglücklich → gelangweilt
    if (energy > 80 && happiness < 50) return "bored";

    // 7. Sehr glücklich
    if (happiness > 80) return "happy";

    // 8. Normalzustand
    return "default";

}


// ────────────────────────────────────
// BILDPFADE BAUEN
// Liest basePath aus der Pet-Definition.
// Cozy Home kennt keine Pfade.
// ────────────────────────────────────

function getPetImageSrc(petId, state) {
    const def = PET_DEFINITIONS[petId];
    if (!def) return "";
    const base = def.assets.basePath;
    if (!state || state === "default") return base + "default.png";
    return base + state + ".png";
}

function getPetImageFallback(petId) {
    const def = PET_DEFINITIONS[petId];
    if (!def) return "";
    return def.assets.basePath + "default.png";
}


// ────────────────────────────────────
// HTML-HELPER
// Erzeugt <img> mit automatischem onerror-Fallback.
// ────────────────────────────────────

function petImgTag(petId, state, cssClass, altText) {
    const src      = getPetImageSrc(petId, state);
    const fallback = getPetImageFallback(petId);
    const alt      = altText  || petId;
    const cls      = cssClass || "";
    return `<img src="${src}" alt="${alt}" class="${cls}" `
         + `onerror="this.onerror=null;this.src='${fallback}'">`;
}


// ────────────────────────────────────
// ICON-HELPER
// Lädt icon.png aus dem Asset-Ordner des Haustieres.
// Existiert kein icon.png, fällt automatisch auf default.png zurück.
// Verwendung: Haustierliste (links) und Haustiershop – NICHT das große Zimmer-Bild.
// ────────────────────────────────────

function getPetIconSrc(petId) {
    const def = PET_DEFINITIONS[petId];
    if (!def) return "";
    return def.assets.basePath + "icon.png";
}

function petIconTag(petId, cssClass, altText) {
    const src      = getPetIconSrc(petId);
    const fallback = getPetImageFallback(petId);
    const alt      = altText  || petId;
    const cls      = cssClass || "";
    return `<img src="${src}" alt="${alt}" class="${cls}" `
         + `onerror="this.onerror=null;this.src='${fallback}'">`;
}


// ────────────────────────────────────
// UNLOCK-PRÜFUNG
//
// Generisch – kein Spiel hardcodiert.
// Jede unlock-Definition bringt type, target und value mit.
// Neue Typen hier ergänzen; bestehende Logik bleibt unverändert.
//
// Rückgabe: true  → Bedingung erfüllt, Haustier kaufbar
//           false → noch gesperrt
// ────────────────────────────────────

function checkUnlock(unlock) {
    if (!unlock) return true; // kein unlock → immer frei

    const scores = DB.get('gameHighscores', {});

    switch (unlock.type) {

        case "highscore": {
            // Unterstützt altes Format (Zahl) und neues (Objekt mit .best)
            const raw = scores[unlock.target];
            const best = typeof raw === 'number' ? raw : (raw?.best ?? 0);
            return best >= unlock.value;
        }

        case "gamesPlayed": {
            const raw = scores[unlock.target];
            const total = typeof raw === 'object' ? (raw?.totalGames ?? 0) : 0;
            return total >= unlock.value;
        }

        // Weitere Typen hier ergänzen:
        // case "achievement":  return DB.get('achievements', {})[unlock.target] === true;
        // case "questCompleted": ...

        default:
            console.warn(`checkUnlock: unbekannter Typ "${unlock.type}"`);
            return false;
    }
}


// ────────────────────────────────────
// CROSS-GAME-HAUSTIERE EINSAMMELN
//
// Liest window.GameHub.registry nach dem Start aller Manifeste durch.
// Jedes Spiel, das ein `pets`-Array besitzt, wird berücksichtigt.
// Die Einträge werden in PET_DEFINITIONS gemergt.
//
// Aufruf: einmalig in cozy-home.js mount() nach initGames().
// ────────────────────────────────────

function collectCrossGamePets() {
    const registry = window.GameHub?.registry;
    if (!registry) return;

    Object.values(registry).forEach(game => {
        if (!Array.isArray(game.pets)) return;

        game.pets.forEach(petDef => {
            if (!petDef.id) return;
            // Nur einmalig mergen – bereits vorhandene Einträge nicht überschreiben
            if (PET_DEFINITIONS[petDef.id]) return;
            PET_DEFINITIONS[petDef.id] = petDef;
        });
    });
}


// ────────────────────────────────────
// PET_DEFINITIONS
//
// assets.basePath  → Pfad zum Pet-Asset-Ordner (mit /am Ende)
//                    Cozy-Home-Pets: games/cozy-home/assets/pets/<id>/
//                    Cross-Game:     games/<spiel>/assets/pets/
//
// Kein images-Objekt. Neue Bilder einfach als Datei ablegen.
// ────────────────────────────────────

const PET_DEFINITIONS = {

    cat: {
        id:                    "cat",
        name:                  "Katze",
        species:               "Katze",
        description:           "Eine neugierige und gemütliche Katze, die gerne beobachtet und sich über Aufmerksamkeit freut.",
        favoriteFood:          "fish",
        favoriteFoodName:      "Fisch",
        favoriteFoodEmoji:     "🐟",
        favoriteActivity:      "Streicheln",
        traits:                "Ausgeglichen",
        playHappinessBase:     10,
        playHappinessBall:     15,
        hungerDecayMultiplier: 1,
        assets: {
            basePath: "games/cozy-home/assets/pets/cat/"
        },
        thoughts: {
            hungry: ["💭 Ich habe Hunger!", "💭 Wann gibt es Fisch?"],
            tired:  ["💭 Ich bin müde...", "💭 Ein Nickerchen wäre schön."],
            lonely: ["💭 Spielst du mit mir?", "💭 Ich fühle mich einsam."],
            happy:  ["💭 Lass uns kuscheln.", "💭 Ich beobachte die Vögel draußen.", "💭 Heute ist ein schöner Tag!"]
        }
    },

    dog: {
        id:                    "dog",
        name:                  "Hund",
        species:               "Hund",
        description:           "Ein treuer Begleiter voller Energie. Er liebt Spiele und freut sich über jede Aufmerksamkeit.",
        favoriteFood:          "meat",
        favoriteFoodName:      "Fleisch",
        favoriteFoodEmoji:     "🍖",
        favoriteActivity:      "Spielen",
        traits:                "Verspielt",
        playHappinessBase:     10,
        playHappinessBall:     20,
        hungerDecayMultiplier: 1,
        assets: {
            basePath: "games/cozy-home/assets/pets/dog/"
        },
        thoughts: {
            hungry: ["💭 Ich habe Hunger!", "💭 Hast du Fleisch für mich?"],
            tired:  ["💭 Ich bin müde...", "💭 Kurz schlafen, dann spielen!"],
            lonely: ["💭 Spielen wir?", "💭 Komm, lass uns toben!"],
            happy:  ["💭 Spielen wir Ball?", "💭 Ich habe so viel Energie!", "💭 Heute ist ein toller Tag!"]
        }
    },

    mouse: {
        id:                    "mouse",
        name:                  "Maus",
        species:               "Maus",
        description:           "Eine kleine, ruhige Maus. Sie braucht wenig und liebt gemütliche Ecken.",
        favoriteFood:          "cheese",
        favoriteFoodName:      "Käse",
        favoriteFoodEmoji:     "🧀",
        favoriteActivity:      "Entspannen",
        traits:                "Anspruchslos",
        playHappinessBase:     10,
        playHappinessBall:     15,
        hungerDecayMultiplier: 0.5,
        assets: {
            basePath: "games/cozy-home/assets/pets/mouse/"
        },
        thoughts: {
            hungry: ["💭 Hast du etwas Käse?", "💭 Ich habe ein wenig Hunger."],
            tired:  ["💭 Ich ruhe mich kurz aus.", "💭 Ich bin etwas müde."],
            lonely: ["💭 Ist hier jemand?", "💭 Ein bisschen Gesellschaft wäre schön."],
            happy:  ["💭 Hier ist es schön ruhig.", "💭 Hast du etwas Käse?", "💭 Es ist so gemütlich hier!"]
        }
    }

    // ── Cross-Game-Haustiere ─────────────────────────────────────
    // Jedes fremde Spiel registriert sein Haustier hier.
    // Die Assets bleiben beim jeweiligen Spiel.
    //
    // schlaengle: {
    //     id: "schlaengle", name: "Schlängle", species: "Schlange",
    //     description: "...",
    //     favoriteFood: "...", favoriteFoodName: "...", favoriteFoodEmoji: "...",
    //     favoriteActivity: "...", traits: "...",
    //     playHappinessBase: 10, playHappinessBall: 15,
    //     hungerDecayMultiplier: 1,
    //     assets: {
    //         basePath: "games/snake/assets/pets/"
    //         // → sucht: games/snake/assets/pets/default.png
    //         //           games/snake/assets/pets/sleep.png  usw.
    //     },
    //     thoughts: { hungry: [...], tired: [...], lonely: [...], happy: [...] }
    // },
    // ─────────────────────────────────────────────────────────────

};
