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
//       │   ├── default.png
//       │   ├── sleep.png
//       │   └── hungry.png   ← später einfach hinzufügen
//       ├── dog/
//       │   ├── default.png
//       │   └── sleep.png
//       └── mouse/
//           ├── default.png
//           └── sleep.png
//
// Cross-Game-Haustiere liegen beim jeweiligen Spiel:
//
//   games/snake/assets/pets/
//   ├── default.png
//   └── sleep.png
//
// Das Haustier registriert seinen eigenen basePath.
// Cozy Home kennt keine Pfade, nur das Haustier-Objekt.
//
// ────────────────────────────────────
// NEUES HAUSTIER HINZUFÜGEN:
//   1. Eintrag in PET_DEFINITIONS anlegen
//   2. basePath auf den eigenen Assets-Ordner zeigen lassen
//   3. default.png dort ablegen (Pflicht)
//   4. Weitere Zustände als <state>.png ergänzen (optional)
//   → Kein weiterer Code nötig
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
