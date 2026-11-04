// theme-lab-sample.js — Musterdaten für das Theme-Lab ("Theme live bearbeiten")
// REINE DATEN: kein Speicherzugriff, kein DOM. Laedt VOR js/theme-lab-boot.js, das
// window.THEME_LAB_SAMPLE in den Arbeitsspeicher-Store kopiert.
// Alle Werte sind JSON-STRINGS, genau so wie DB.set sie schreiben wuerde (createMemoryStorage
// macht String(); ein Objekt wuerde zu "[object Object]").
// Ausserhalb des Labs (index.html?themeLab=1) wird nur ein leeres Objekt definiert.
// Alles erfunden und neutral; Datumsangaben relativ zu "heute" (lokale Zeit).
(function () {
  "use strict";
  let lab = false;
  try { lab = new URLSearchParams(location.search).get("themeLab") === "1"; } catch (e) { /* ignore */ }
  if (!lab) { window.THEME_LAB_SAMPLE = {}; return; }

  // ---- Datums-Helfer (Formate wie main.js: dateKey 'YYYY-MM-DD', Montag = Wochenstart) ----
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, "0");
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const plusDays = (n, base) => { const d = new Date(base || midnight()); d.setDate(d.getDate() + n); return d; };
  const dk = n => key(plusDays(n));                       // Datumsschluessel heute + n Tage
  const mondayOf = d => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - (m.getDay() || 7) + 1); return m; };
  const isoWeek = date => {                                // wie getISOWeek in main.js
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    return Math.ceil(((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / DAY + 1) / 7);
  };
  const weekId = date => {                                 // wie getWeekId: "2026-W45"
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    return `${d.getFullYear()}-W${pad(isoWeek(date))}`;
  };
  const now = Date.now();
  const hoursAgo = h => now - h * 3600000;
  const ym = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

  const data = {};

  // ---- Heute: Zeitbloecke, Aufgaben, Schnellnotiz, Fortschritts-Tracker ----
  data.blocks = [
    { id: 1, label: "Block 1", start: "07:30", end: "09:00" },
    { id: 2, label: "Block 2", start: "09:15", end: "11:30" },
    { id: 3, label: "Block 3", start: "12:15", end: "14:00" },
    { id: 4, label: "Block 4", start: "14:30", end: "16:10", free: true },
  ];

  const task = (id, title, priority, status, blocks, extra) => Object.assign({
    id: "lab-task-" + id, title, notes: "", priority, blocks,
    status, done: status === "completed", createdAt: hoursAgo(30),
    completedAt: status === "completed" ? hoursAgo(5) : null,
  }, extra || {});
  data.tasks = [
    task(1, "Referat Biologie vorbereiten", 1, "in_progress", [1, 2], { notes: "Folien und Quellen sammeln" }),
    task(2, "Vokabeln wiederholen", 2, "open", [3]),
    task(3, "Geschichte: Kapitel 4 lesen", 2, "open", [2]),
    task(4, "Laborbericht abgeben", 1, "open", [4]),
    task(5, "Arbeitsblatt Mathe", 3, "completed", [1], { completedAt: hoursAgo(3) }),
    task(6, "Lerngruppe organisieren", 3, "completed", [], { completedAt: hoursAgo(26) }),
  ];
  data.quicknote = "Fragen an Frau Muster: Abgabetermin Referat?\nBuch in der Bibliothek abholen.";
  data.todayTracker = { enabled: true, label: "Ausbildung", start: dk(-7 * 60), end: dk(7 * 96) };
  data.countdownVisible = { "lab-ev-klausur": true, "lab-series-abgabe": true };

  // ---- Kalender: Termine, Serien, Geburtstage ----
  const ev = (id, title, time, extra) => Object.assign({ id: "lab-ev-" + id, title, notes: "", time: time || "", countdown: false, color: null, showInAgenda: true }, extra || {});
  data.events = {};
  data.events[dk(0)]  = [ev("lerngruppe", "Lerngruppe Biologie", "15:30", { color: "#C9D6BC" })];
  data.events[dk(1)]  = [ev("arzt", "Zahnarzttermin", "10:00"), ev("kino", "Kino mit Sam", "19:30", { color: "#E4CBE6" })];
  data.events[dk(3)]  = [ev("praesentation", "Präsentation Geschichte", "09:15", { color: "#F2E6AE" })];
  data.events[dk(5)]  = [ev("ausflug", "Ausflug ins Museum", "", { color: "#DAD3EA" })];
  data.events[dk(9)]  = [ev("workshop", "Workshop Lerntechniken", "13:00")];
  data.events[dk(12)] = [ev("klausur", "Klausur Biologie", "08:00", { countdown: true, color: "#ECDFCB" })];
  data.events[dk(-2)] = [ev("sport", "Sportkurs", "17:00")];
  data.events[dk(18)] = [ev("fest", "Sommerfest", "16:00", { color: "#C9D6BC" })];
  data.eventSeries = [
    { id: "lab-series-abgabe", title: "Wöchentliche Abgabe", notes: "", time: "12:00", color: "#DAD3EA", showInAgenda: true,
      countdown: true, startDate: dk(-14), rrule: { freq: "weekly", interval: 1, byWeekday: [4], endType: "never", until: null, count: null }, exceptions: {} },
    { id: "lab-series-team", title: "Teambesprechung", notes: "", time: "11:00", color: "#C9D6BC", showInAgenda: true,
      countdown: false, startDate: dk(-14), rrule: { freq: "weekly", interval: 1, byWeekday: [0, 2], endType: "never", until: null, count: null }, exceptions: {} },
  ];
  const bd = (id, name, offset, year) => { const d = plusDays(offset); return { id: "lab-bd-" + id, name, day: d.getDate(), month: d.getMonth() + 1, year }; };
  data.birthdays = [bd("alex", "Alex", 4, 2002), bd("robin", "Robin", 21, 2001), bd("kim", "Kim", 40, null)];

  // ---- Heute: Gruppenpflichten (2 Gruppen, 4 Personen, 2 Pflichten, geplante Wochen) ----
  data.gdPeople = [
    { id: "lab-p-alex", name: "Alex" }, { id: "lab-p-sam", name: "Sam" },
    { id: "lab-p-robin", name: "Robin" }, { id: "lab-p-kim", name: "Kim" },
  ];
  data.gdGroups = [
    { id: "lab-g-a", name: "Gruppe A", memberIds: ["lab-p-alex", "lab-p-sam"] },
    { id: "lab-g-b", name: "Gruppe B", memberIds: ["lab-p-robin", "lab-p-kim"] },
  ];
  const person = id => ({ type: "person", id: "lab-p-" + id });
  data.gdDuties = [
    { id: "lab-d-muell", name: "Müll", icon: "🗑️", startDate: dk(-28), endDate: dk(120),
      participants: [person("alex"), person("sam"), person("robin"), person("kim")],
      seatsRegular: 1, seatsErsatz: 1, rotationMode: "auto", fixedOrder: [],
      autoRotationOrder: ["lab-p-alex", "lab-p-sam", "lab-p-robin", "lab-p-kim"], linkedDutyIds: [] },
    { id: "lab-d-kueche", name: "Küchendienst", icon: "🍽️", startDate: dk(-28), endDate: dk(120),
      participants: [{ type: "group", id: "lab-g-a" }, { type: "group", id: "lab-g-b" }],
      seatsRegular: 1, seatsErsatz: 0, rotationMode: "fixed",
      fixedOrder: [{ type: "group", id: "lab-g-a" }, { type: "group", id: "lab-g-b" }],
      autoRotationOrder: [], linkedDutyIds: [] },
  ];
  const rot = ["alex", "sam", "robin", "kim"];
  data.gdSchedule = { "lab-d-muell": {}, "lab-d-kueche": {} };
  for (let w = -2; w <= 4; w++) {
    const id = weekId(plusDays(7 * w));
    data.gdSchedule["lab-d-muell"][id] = { regular: [person(rot[(w + 2) % 4])], ersatz: [person(rot[(w + 3) % 4])] };
    data.gdSchedule["lab-d-kueche"][id] = { regular: [{ type: "group", id: (w + 2) % 2 ? "lab-g-b" : "lab-g-a" }], ersatz: [] };
  }

  // ---- Heute: Speiseplan (aktuelle + naechste Woche, Schluessel = Montag) ----
  const meals = [
    ["Gemüse-Lasagne", "Hähnchen-Curry mit Reis", "VEGAN Linsen-Bolognese", "Obstsalat"],
    ["Spaghetti Napoli", "Rindergulasch mit Nudeln", "VEGAN Gemüsepfanne", "Vanillepudding"],
    ["Kartoffelsuppe", "Fischfilet mit Kartoffeln", "VEGAN Falafel-Bowl", "Joghurt mit Beeren"],
    ["Pizza Margherita", "Schnitzel mit Pommes", "VEGAN Kichererbsen-Curry", "Apfelkuchen"],
    ["Gemüsequiche", "Bratwurst mit Kraut", "VEGAN Tofu-Wok", "Schokoladenmousse"],
  ];
  const mealWeek = monday => ({
    kw: isoWeek(monday), importedAt: new Date().toISOString(),
    labels: { menu1: "Menü 1", menu2: "Menü 2", menu3: "Menü 3", dessert: "Dessert" },
    days: meals.map(m => ({ menu1: m[0], menu2: m[1], menu3: m[2], dessert: m[3] })),
  });
  const thisMonday = mondayOf(new Date());
  data.mealPlanWeeks = {};
  data.mealPlanWeeks[key(thisMonday)] = mealWeek(thisMonday);
  data.mealPlanWeeks[key(plusDays(7, thisMonday))] = mealWeek(plusDays(7, thisMonday));
  // Wetter bewusst NICHT vorbelegt: Standard ist manuell "Cologne" (Open-Meteo, braucht keine
  // Geolocation); das Lab hat Netz, das Banner fuellt sich selbst. Ein Fake-Cache wuerde nach 30 min ablaufen.

  // ---- Karteikarten: 2 Fächer x 2 Themen x 6 Karten ----
  const cards = (prefix, pairs) => pairs.map((p, i) => ({
    id: `lab-c-${prefix}-${i}`, front: p[0], back: p[1], box: 1 + (i % 4),
    lastSeen: i % 3 === 0 ? null : now - (i % 4) * DAY, totalAnswers: i % 3 === 0 ? 0 : 4 + i,
    correctAnswers: i % 3 === 0 ? 0 : 2 + i, hard: i === 4,
  }));
  data.subjects = [
    { id: "lab-s-bio", name: "Biologie", teacher: "Frau Muster", exams: [{ id: "lab-x-bio", name: "Klausur 1", groupIds: ["lab-g-zelle"] }],
      groups: [
        { id: "lab-g-zelle", name: "Die Zelle", cards: cards("zelle", [
          ["Was ist die Aufgabe der Mitochondrien?", "Energiegewinnung (ATP-Bildung)"],
          ["Wo liegt die Erbinformation einer Zelle?", "Im Zellkern"],
          ["Was umgibt eine pflanzliche Zelle zusätzlich?", "Eine Zellwand"],
          ["Wofür sind Ribosomen zuständig?", "Proteinsynthese"],
          ["Was sind Chloroplasten?", "Zellorganellen der Fotosynthese"],
          ["Was bewirkt die Zellmembran?", "Sie steuert den Stoffaustausch"],
        ]) },
        { id: "lab-g-genetik", name: "Genetik", cards: cards("gen", [
          ["Was ist ein Gen?", "Ein DNA-Abschnitt mit Bauplan für ein Merkmal"],
          ["Wie viele Chromosomen hat der Mensch?", "46 (23 Paare)"],
          ["Was besagt die erste Mendelsche Regel?", "Uniformitätsregel"],
          ["Was ist ein Allel?", "Eine Ausprägung eines Gens"],
          ["Wofür steht DNA?", "Desoxyribonukleinsäure"],
          ["Was ist eine Mutation?", "Eine Veränderung des Erbguts"],
        ]) },
      ] },
    { id: "lab-s-geschichte", name: "Geschichte", teacher: "Herr Beispiel", exams: [],
      groups: [
        { id: "lab-g-antike", name: "Antike", cards: cards("antike", [
          ["Wann wurde Rom der Sage nach gegründet?", "753 v. Chr."],
          ["Was bedeutet Demokratie wörtlich?", "Herrschaft des Volkes"],
          ["Wer war Julius Caesar?", "Römischer Feldherr und Staatsmann"],
          ["Was war die Agora?", "Der zentrale Marktplatz griechischer Städte"],
          ["Wann endete das Weströmische Reich?", "476 n. Chr."],
          ["Was waren die Olympischen Spiele?", "Sportliche Wettkämpfe zu Ehren des Zeus"],
        ]) },
        { id: "lab-g-mittelalter", name: "Mittelalter", cards: cards("ma", [
          ["Was war das Lehnswesen?", "Land gegen Treue und Dienst"],
          ["Wer war Karl der Große?", "Frankenkönig, 800 zum Kaiser gekrönt"],
          ["Was war die Hanse?", "Städtebund von Kaufleuten im Nord- und Ostseeraum"],
          ["Wann begann die Reformation?", "1517 mit Luthers Thesen"],
          ["Was war ein Kloster?", "Gemeinschaft von Moenchen oder Nonnen"],
          ["Was waren die Kreuzzüge?", "Religiös motivierte Kriegszüge nach Jerusalem"],
        ]) },
      ] },
  ];
  data.fc_session_stats = { date: dk(0), learned: 8, correct: 6, wrong: 2, reps: 9, cards: [] };

  // ---- Anleitungen: Bücher in guideCategories (+ Lesezeichen) ----
  const code = "```javascript\nfunction begruessung(name) {\n  return `Hallo ${name}!`;\n}\nconsole.log(begruessung('Alex'));\n```";
  const guide = (id, title, description, content, tags, favorite) => ({
    id: "lab-gd-" + id, title, description, content, tags, favorite: !!favorite,
    createdAt: new Date(now - 9 * DAY).toISOString(), updatedAt: new Date(now - 2 * DAY).toISOString(),
  });
  data.guideCategories = [
    { id: "lab-gc-web", name: "Webentwicklung", coverColor: "#C9D6BC", guides: [
      guide("funktionen", "Funktionen in JavaScript", "Grundlagen zu Funktionen",
        "# Funktionen\n\nEine **Funktion** fasst Anweisungen zusammen.\n\n" + code + "\n\n- Parameter\n- Rückgabewert\n\nSiehe auch: `console.log`.", ["javascript", "grundlagen"], true),
      guide("css", "CSS-Layout", "Flexbox und Grid im Überblick",
        "# Layout\n\n> Flexbox für eine Achse, Grid für zwei.\n\n```css\n.box { display: flex; gap: 8px; }\n```\n\n1. Container festlegen\n2. Elemente ausrichten", ["css", "layout"], false),
    ] },
    { id: "lab-gc-lernen", name: "Lernen", coverColor: "#DAD3EA", guides: [
      guide("methoden", "Lernmethoden", "Karteikarten, Pomodoro und mehr",
        "# Lernmethoden\n\n## Pomodoro\n25 Minuten Fokus, 5 Minuten Pause.\n\n## Karteikarten\nRegelmäßig und in kleinen Portionen wiederholen.\n\n| Methode | Dauer |\n|---|---|\n| Pomodoro | 25 min |\n| Wiederholung | 10 min |", ["lernen"], true),
    ] },
  ];
  data.guideBookmarks = {};
  data.guideBlockIdsV2 = true; // Block-ID-Migration ist für Musterdaten nicht noetig

  // ---- Projekte ----
  const ptask = (id, text, done, isExtra) => ({ id: "lab-pt-" + id, text, description: "", done: !!done, isExtra: !!isExtra,
    categoryId: null, completedAt: done ? hoursAgo(20) : null, checklist: [] });
  data.projects = [
    { id: "lab-pr-herbarium", name: "Herbarium anlegen", description: "Pflanzen sammeln, pressen und beschriften.", priority: "Hoch",
      dueDate: now + 21 * DAY, createdAt: now - 14 * DAY, startDate: now - 14 * DAY, updatedAt: now - DAY, archived: false,
      tasks: [ptask(1, "Pflanzen sammeln", true), ptask(2, "Pflanzen pressen", true), ptask(3, "Blätter beschriften", false), ptask(4, "Deckblatt gestalten", false, true)],
      subprojects: [{ id: "lab-sp-1", title: "Präsentation", collapsed: false, tasks: [ptask(5, "Folien erstellen", false), ptask(6, "Vortrag üben", false)] }],
      taskCategories: [], categoriesEnabled: true, mainTasksLabel: "Hauptaufgaben" },
    { id: "lab-pr-geschichte", name: "Geschichts-Podcast", description: "Eine Folge über das Mittelalter aufnehmen.", priority: "Mittel",
      dueDate: now + 45 * DAY, createdAt: now - 6 * DAY, startDate: now - 6 * DAY, updatedAt: now - 2 * DAY, archived: false,
      tasks: [ptask(7, "Thema festlegen", true), ptask(8, "Skript schreiben", false), ptask(9, "Aufnehmen", false)],
      subprojects: [], taskCategories: [], categoriesEnabled: true, mainTasksLabel: "Hauptaufgaben" },
    { id: "lab-pr-garten", name: "Balkon bepflanzen", description: "", priority: "Niedrig",
      createdAt: now - 30 * DAY, startDate: now - 30 * DAY, updatedAt: now - 10 * DAY, archived: false,
      tasks: [ptask(10, "Erde und Töpfe besorgen", true), ptask(11, "Kräuter pflanzen", true)],
      subprojects: [], taskCategories: [], categoriesEnabled: true, mainTasksLabel: "Hauptaufgaben" },
  ];

  // ---- Pinnwand (deskCards; Farben = Standardpalette, Nutzerdaten-Farben) ----
  const desk = (id, title, style, column, order, color, extra) => Object.assign({
    id: "lab-dc-" + id, title, style, color, column, order, height: null,
    content: "", items: [], hideCompleted: false, betrieb: "", schule: "",
  }, extra || {});
  const item = (id, text, done) => ({ id: "lab-di-" + id, text, done: !!done });
  data.deskCards = [
    desk("wichtig", "Wichtiges", "important", 0, 0, "#F2E6AE", { content: "Referat Biologie am Freitag!" }),
    desk("todo", "To Do", "checklist", 0, 1, "#C9D6BC", { items: [item(1, "Bibliothek-Buch zurückgeben", true), item(2, "Poster drucken"), item(3, "Mappe sortieren")] }),
    desk("einkauf", "Einkaufsliste", "checklist", 1, 0, "#ECDFCB", { items: [item(4, "Hafermilch"), item(5, "Äpfel", true), item(6, "Brot"), item(7, "Tomaten")] }),
    desk("notiz", "Ideen", "standard", 1, 1, "#DAD3EA", { content: "Ideen für das Wochenende:\n- Wanderung\n- Museum\n- Kochen mit Kim" }),
    desk("zitat", "Zitat", "quote", 2, 0, "#E4CBE6", { content: "Wer lernt, wächst." }),
    desk("code", "Terminal", "code", 2, 1, "#E2DED4", { content: "git status\ngit commit -m \"Fertig\"" }),
    desk("pin", "Angepinnt", "pinned", 2, 2, "#C9D6BC", { content: "Stundenplan hier ablegen." }),
  ];

  // ---- Questboard: je Typ Karten; Resets auf heute/diese Woche setzen, damit nichts abgewischt wird ----
  const qi = (id, text, done) => ({ id: "lab-qi-" + id, text, done: !!done });
  data.questCards = [
    { id: "lab-q-daily", type: "daily", title: "Morgenroutine", coins: 2, order: 0, done: false, awarded: false,
      items: [qi(1, "Wasser trinken", true), qi(2, "Betten machen", true), qi(3, "Zehn Minuten lesen")] },
    { id: "lab-q-weekly", type: "weekly", title: "Wochenplan", coins: 10, order: 0, done: false, awarded: false, resetWeekly: true,
      items: [qi(4, "Wohnung aufräumen", true), qi(5, "Wäsche waschen"), qi(6, "Lernplan schreiben")] },
    { id: "lab-q-timed1", type: "timed", title: "Lerngruppe", coins: 5, order: 0, done: false, awarded: false, items: [], start: "15:30", end: "16:30", duration: null },
    { id: "lab-q-timed2", type: "timed", title: "Spaziergang", coins: 5, order: 1, done: true, awarded: true, items: [], start: "18:00", end: "", duration: 30 },
    { id: "lab-q-side1", type: "side", title: "Schreibtisch entrümpeln", coins: 2, order: 0, done: false, awarded: false, items: [], repeatable: false },
    { id: "lab-q-side2", type: "side", title: "Pflanzen gießen", coins: 2, order: 1, done: false, awarded: false, items: [], repeatable: true },
    { id: "lab-q-side3", type: "side", title: "Oma anrufen", coins: 2, order: 2, done: false, awarded: false, items: [], repeatable: false },
  ];
  data.questWallet = { coins: 85, earned: 140, redeemed: [] };
  const qWeek = (() => { // wie questWeekKey in questboard.js
    const t = new Date(); const d = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const w = Math.ceil(((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / DAY + 1) / 7);
    return `${d.getUTCFullYear()}-W${pad(w)}`;
  })();
  data.questSettings = { coinsEnabled: true, lastDailyReset: dk(0), lastWeeklyReset: qWeek };

  // ---- Budget ----
  const rec = (id, name, type, amount, freq, extra) => Object.assign({
    id: "lab-br-" + id, name, amount, type, freq, priority: type === "expense" ? "need" : "none",
    certainty: "fixed", includeInSparplan: true,
  }, type === "expense" ? { funding: [] } : { icon: "💼" }, extra || {});
  data.budgetRecurring = [
    rec("gehalt", "Ausbildungsvergütung", "income", 1100, "monthly", { day: 1 }),
    rec("taschengeld", "Zuschuss Familie", "income", 150, "monthly", { day: 5, icon: "🎁" }),
    rec("miete", "Miete", "expense", 420, "monthly", { day: 3, priority: "must" }),
    rec("handy", "Handyvertrag", "expense", 15, "monthly", { day: 15 }),
    rec("streaming", "Streaming", "expense", 12.99, "monthly", { day: 20, priority: "want" }),
    rec("lebensmittel", "Lebensmittel", "expense", 55, "weekly", { weekday: 6 }),
    rec("versicherung", "Haftpflicht", "expense", 96, "yearly", { dateDay: 10, dateMonth: 3, priority: "must" }),
  ];
  const mk = ym(new Date()), todayDay = new Date().getDate();
  const one = (id, name, type, amount, day, paid, priority) => ({ id: "lab-bo-" + id, name, type, amount, monthKey: mk, day,
    priority: type === "expense" ? (priority || "need") : "none", paid: !!paid, funding: type === "expense" ? [] : undefined });
  data.budgetOnetime = [
    one("nebenjob", "Nebenjob", "income", 120, Math.max(1, todayDay - 2), true),
    one("kino", "Kinokarten", "expense", 24, Math.min(28, todayDay + 1), false, "want"),
    one("buch", "Fachbuch", "expense", 32.5, Math.max(1, todayDay - 3), true),
    one("geschenk", "Geburtstagsgeschenk", "expense", 40, Math.min(28, todayDay + 4), false, "need"),
  ].map(o => { if (o.funding === undefined) delete o.funding; return o; });
  data.kontostand = 1284.75;
  const goal = (id, name, target, current, plantType, priority, category, etaDays) => ({
    id: "lab-bg-" + id, name, target, items: [], itemsTrackFull: false, current, plantType, eta: dk(etaDays),
    priority, category, description: null, startDate: dk(-60), reserveActive: false, funding: [],
  });
  data.budgetGoals = [
    goal("laptop", "Neuer Laptop", 900, 340, "sunflower", "need", "Technik", 120),
    goal("reise", "Sommerreise", 600, 150, "cactus", "want", "Freizeit", 200),
    goal("notgroschen", "Notgroschen", 1500, 700, "bonsai", "must", "Sicherheit", 300),
  ];
  data.budgetDebts = [
    { id: "lab-bd-rad", name: "Ratenkauf Fahrrad", originalAmount: 400, paidAmount: 150, dueDate: dk(150),
      description: "Zwölf Raten", priority: "need", reserveActive: false, funding: [], createdAt: now - 60 * DAY },
  ];

  // Alles als JSON-String, wie DB.set es schreibt
  const out = {};
  Object.keys(data).forEach(k => { out[k] = JSON.stringify(data[k]); });
  window.THEME_LAB_SAMPLE = out;
})();
