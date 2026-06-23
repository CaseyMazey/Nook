// ====================================
    // PET_DEFINITIONS – zentrale Registry
    // Neue Haustiere hier eintragen,
    // kein weiterer Code nötig.
    // ====================================

    const PET_DEFINITIONS = {

        cat: {
            id:                    "cat",
            name:                  "Katze",
            species:               "Katze",
            image:                 "games/cozy-home/assets/cat.png",
            description:           "Eine neugierige und gemütliche Katze, die gerne beobachtet und sich über Aufmerksamkeit freut.",
            favoriteFood:          "fish",
            favoriteFoodName:      "Fisch",
            favoriteFoodEmoji:     "🐟",
            favoriteActivity:      "Streicheln",
            traits:                "Ausgeglichen",
            playHappinessBase:     10,  // ohne Ball
            playHappinessBall:     15,  // mit Ball
            hungerDecayMultiplier: 1,
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
            image:                 "games/cozy-home/assets/dog.png",
            description:           "Ein treuer Begleiter voller Energie. Er liebt Spiele und freut sich über jede Aufmerksamkeit.",
            favoriteFood:          "meat",
            favoriteFoodName:      "Fleisch",
            favoriteFoodEmoji:     "🍖",
            favoriteActivity:      "Spielen",
            traits:                "Verspielt",
            playHappinessBase:     10,  // ohne Ball
            playHappinessBall:     20,  // mit Ball → +20 statt +15
            hungerDecayMultiplier: 1,
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
            image:                 "games/cozy-home/assets/mouse.png",
            description:           "Eine kleine, ruhige Maus. Sie braucht wenig und liebt gemütliche Ecken.",
            favoriteFood:          "cheese",
            favoriteFoodName:      "Käse",
            favoriteFoodEmoji:     "🧀",
            favoriteActivity:      "Entspannen",
            traits:                "Anspruchslos",
            playHappinessBase:     10,
            playHappinessBall:     15,
            hungerDecayMultiplier: 0.5,   // Hunger sinkt langsamer
            thoughts: {
                hungry: ["💭 Hast du etwas Käse?", "💭 Ich habe ein wenig Hunger."],
                tired:  ["💭 Ich ruhe mich kurz aus.", "💭 Ich bin etwas müde."],
                lonely: ["💭 Ist hier jemand?", "💭 Ein bisschen Gesellschaft wäre schön."],
                happy:  ["💭 Hier ist es schön ruhig.", "💭 Hast du etwas Käse?", "💭 Es ist so gemütlich hier!"]
            }
        }

        // Zukünftige Cross-Game-Haustiere hier ergänzen:
        // snake:   { id:"snake",  name:"Schlängle", ... }
        // dragon:  { id:"dragon", name:"Drache",    ... }
        // monster: { id:"monster",name:"Monster",   ... }
        // puzzli:  { id:"puzzli", name:"Puzzli",    ... }

    };