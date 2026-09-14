// =========================
// PROJECT-TREE.JS  (v3 — PNG-Baum)
// Verantwortlich NUR für:
//   - PNG-Baumvariante je Projekt zuweisen → getOrAssignTreeVariant(project)
//   - Großen Detailbaum rendern → updateDetailTreeElements(project)
//     (PNG-Baum in #proj-detail-tree, dieselbe Variante wie im Projektwald,
//     plus Äpfel/Blüten-Deko für erledigte Kern-/Extraaufgaben)
//
// Schnittstelle nach außen:
//   getOrAssignTreeVariant(project)    → 1..TREE_PNG_COUNT
//   updateDetailTreeElements(project)
// =========================

// =========================
// HILFSFUNKTIONEN
// =========================
function seededRand(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function idToSeed(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function escapeXml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =========================
// BAUM-VARIANTE (PNG)
// Jedes Projekt bekommt bei der ersten Anzeige dauerhaft eine von
// TREE_PNG_COUNT PNG-Baumvarianten (img/trees/tree_<n>.png / tree_<n>_fall.png)
// zugewiesen und in project.treeVariant gespeichert — einmalig ausgewürfelt,
// nie neu. Dieselbe Variante wird sowohl im Projektwald (buildForestTree() in
// forest.js) als auch in der Detailansicht (updateDetailTreeElements() unten)
// verwendet, damit ein Projekt überall denselben Baum zeigt. Fehlt eine
// PNG-Datei, fällt der <img>-onerror-Handler automatisch auf Variante 1
// zurück — neue Varianten lassen sich also einfach durch Ablegen weiterer
// PNGs ergänzen, ohne Code zu ändern.
// =========================
const TREE_PNG_COUNT = 5;

function getOrAssignTreeVariant(project) {
  if (project.treeVariant >= 1 && project.treeVariant <= TREE_PNG_COUNT) return project.treeVariant;
  const rng = seededRand(idToSeed(project.id) + 911);
  project.treeVariant = Math.floor(rng() * TREE_PNG_COUNT) + 1;
  if (typeof saveProjects === 'function') saveProjects();
  return project.treeVariant;
}

// =========================
// AUFGABEN-DEKO — REGISTRY (Customizing)
// Jede erledigte Aufgabe erzeugt ein Deko-Objekt (Obst/Blume) auf dem Baum.
// Welche Objekte dafür zur Auswahl stehen, ist zentral hier registriert.
//
// Farbvarianten: Liegen mehrere Bilddateien nach dem Muster
// "{name}_{farbe}.png" vor (z.B. hortensie_white.png/hortensie_pink.png),
// werden sie automatisch zu EINER Dekoration "{name}" mit mehreren
// Varianten gruppiert (buildDecorRegistry() unten, per Regex aus dem
// Dateinamen) — im Customizing erscheint dafür nur eine einzige Auswahl.
// Eine neue Farbe hinzufügen heißt daher: Datei nach diesem Muster in
// img/decor/ ablegen + eine Zeile in DECOR_FILES ergänzen, fertig — an
// Pool-/Wahrscheinlichkeits-Logik (getCustomizingPool()/ensureTaskDecor())
// ändert sich dadurch nichts. Dateien OHNE "_farbe"-Suffix (z.B.
// apple.png) bilden weiterhin ganz normal eine eigene Ein-Varianten-
// Dekoration. category ('obst'|'blumen') und label (Customizing-UI) werden
// einmal pro Dekoration in DECOR_META gepflegt, nicht pro Datei/Variante.
// =========================
const DECOR_META = {
  apple:                       { category: 'obst',   label: 'Apfel' },
  appleblossom:                { category: 'blumen', label: 'Apfelblüte' },
  cherry:                      { category: 'obst',   label: 'Kirsche' },
  cherryblossom:                { category: 'blumen', label: 'Kirschblüte' },
  glyzinie:                    { category: 'blumen', label: 'Glyzinie' },
  grapes:                      { category: 'obst',   label: 'Weintrauben' },
  hortensie:                   { category: 'blumen', label: 'Hortensie' },
  magnolia:                    { category: 'blumen', label: 'Magnolie' },
  mango:                       { category: 'obst',   label: 'Mango' },
  orange:                      { category: 'obst',   label: 'Orange' },
  peach:                       { category: 'obst',   label: 'Pfirsich' },
  pear:                        { category: 'obst',   label: 'Birne' },
  pearblossom:                 { category: 'blumen', label: 'Birnenblüte' },
  plum:                        { category: 'obst',   label: 'Pflaume' },
  plumblossom:                 { category: 'blumen', label: 'Pflaumenblüte' },
  pomegranate:                 { category: 'obst',   label: 'Granatapfel' },
  starfruit:                   { category: 'obst',   label: 'Sternfrucht' },
  sunflower:                   { category: 'blumen', label: 'Sonnenblume' },
  tomato:                      { category: 'obst',   label: 'Tomate' },
  // Ergänzt aus img/decor/ (siehe garden-catalog.js — gleiche Pflanzen,
  // gleiche deutsche Namen, hier aber nur die zwei Customizing-Kategorien
  // 'obst'/'blumen' statt Gartens drei Kategorien; Nüsse laufen hier unter
  // 'obst' mit, weil das Customizing bewusst keine dritte Kategorie bekommt.
  acorn:                       { category: 'obst',   label: 'Eichel' },
  anemone:                     { category: 'blumen', label: 'Anemone' },
  'bearded iris':              { category: 'blumen', label: 'Bartiris' },
  berry_blackberry:            { category: 'obst',   label: 'Brombeere' },
  berry_blueberry:             { category: 'obst',   label: 'Blaubeere' },
  berry_currant:               { category: 'obst',   label: 'Johannisbeere' },
  berry_goji:                  { category: 'obst',   label: 'Goji-Beere' },
  berry_gooseberry:            { category: 'obst',   label: 'Stachelbeere' },
  berry_mulberry:              { category: 'obst',   label: 'Maulbeere' },
  berry_physalis:              { category: 'obst',   label: 'Physalis' },
  berry_raspberry:             { category: 'obst',   label: 'Himbeere' },
  berry_strawberry:            { category: 'obst',   label: 'Erdbeere' },
  'bleeding heart':            { category: 'blumen', label: 'Tränendes Herz' },
  'blushing bride protea':     { category: 'blumen', label: 'Protea' },
  chestnut:                    { category: 'obst',   label: 'Kastanie' },
  dahlia:                      { category: 'blumen', label: 'Dahlie' },
  daisy:                       { category: 'blumen', label: 'Gänseblümchen' },
  frangipani:                  { category: 'blumen', label: 'Frangipani' },
  fuchsia:                     { category: 'blumen', label: 'Fuchsie' },
  hazelnut:                    { category: 'obst',   label: 'Haselnuss' },
  hibiskus:                    { category: 'blumen', label: 'Hibiskus' },
  'jade vine':                 { category: 'blumen', label: 'Jade Vine' },
  lavendel:                    { category: 'blumen', label: 'Lavendel' },
  lemon:                       { category: 'obst',   label: 'Zitrone' },
  lily:                        { category: 'blumen', label: 'Lilie' },
  lotus:                       { category: 'blumen', label: 'Lotus' },
  orchid:                      { category: 'blumen', label: 'Orchidee' },
  'passion flower':            { category: 'blumen', label: 'Passionsblume' },
  peony:                       { category: 'blumen', label: 'Pfingstrose' },
  ranunculus:                  { category: 'blumen', label: 'Ranunkel' },
  rose:                        { category: 'blumen', label: 'Rose' },
  spiderlily:                  { category: 'blumen', label: 'Spinnenlilie' },
  'sweet juliet rose':         { category: 'blumen', label: 'Sweet Juliet Rose' },
  'teddy bear sunflower':      { category: 'blumen', label: 'Teddybär-Sonnenblume' },
  wisteria:                    { category: 'blumen', label: 'Wisteria' },
};

const DECOR_FILES = [
  'apple.png',
  'appleblossom.png',
  'cherry.png',
  'cherryblossom.png',
  'glyzinie.png',
  'grapes_black.png',
  'grapes_green.png',
  'grapes_red.png',
  'grapes_shiny.png',
  'hortensie_white.png',
  'hortensie_pink.png',
  'hortensie_purple.png',
  'hortensie_shiny.png',
  'magnolia.png',
  'mango.png',
  'orange.png',
  'peach.png',
  'pear.png',
  'pearblossom.png',
  'plum.png',
  'plumblossom.png',
  'pomegranate.png',
  'starfruit.png',
  'sunflower.png',
  'tomato.png',
  // Ergänzt (siehe DECOR_META-Kommentar oben)
  'acorn.png',
  'anemone.png',
  'bearded iris.png',
  'berry_blackberry.png',
  'berry_blueberry.png',
  'berry_currant.png',
  'berry_goji.png',
  'berry_gooseberry.png',
  'berry_mulberry.png',
  'berry_physalis.png',
  'berry_raspberry.png',
  'berry_strawberry.png',
  'bleeding heart.png',
  'blushing bride protea.png',
  'chestnut.png',
  'dahlia.png',
  'daisy_bella rose.png',
  'daisy_pink.png',
  'daisy_shiny.png',
  'daisy_white.png',
  'frangipani.png',
  'fuchsia.png',
  'hazelnut.png',
  'hibiskus.png',
  'jade vine.png',
  'lavendel.png',
  'lemon.png',
  'lemon_shiny.png',
  'lily.png',
  'lotus.png',
  'orchid.png',
  'passion flower.png',
  'peony_pink.png',
  'peony_white.png',
  'ranunculus.png',
  'rose_pink.png',
  'rose_red.png',
  'rose_shiny.png',
  'rose_white.png',
  'rose_yellow.png',
  'spiderlily_pink.png',
  'spiderlily_red.png',
  'spiderlily_shiny.png',
  'spiderlily_white.png',
  'sweet juliet rose.png',
  'teddy bear sunflower.png',
  'wisteria.png',
];

// Präfixe, bei denen der Teil vor dem "_" KEINE Farbvariante ist, sondern
// nur eine lose Namens-Gruppierung (z.B. "berry_strawberry.png" und
// "berry_blueberry.png" sind zwei komplett verschiedene Pflanzen, keine
// Farben derselben Beere) — gleiche Logik/gleiche Ausnahme wie
// GARDEN_STANDALONE_PREFIXES in js/garden-catalog.js. Für diese Präfixe
// wird jede Datei zu einer eigenständigen Dekoration statt zu einer
// gemeinsamen Variantengruppe.
const DECOR_STANDALONE_PREFIXES = new Set(['berry']);

// Erkennt "{name}_{farbe}.png" -> Basisname ohne Farbsuffix (Gruppierung
// per erstem Unterstrich, nicht per Regex-Rateversuch — funktioniert daher
// auch bei Farbnamen mit Leerzeichen wie "daisy_bella rose.png"). Dateien
// ohne Unterstrich (z.B. "apple.png", aber auch mehrteilige Namen wie
// "bearded iris.png") liefern ihren eigenen Namen als Basis (= keine
// Farbvariante, eigene Dekoration). Siehe DECOR_STANDALONE_PREFIXES oben
// für die Ausnahme bei loser statt echter Farbvarianten-Gruppierung.
function decorBaseId(file) {
  const base = file.replace(/\.png$/i, '');
  const idx = base.indexOf('_');
  if (idx === -1) return base;
  const prefix = base.slice(0, idx).toLowerCase();
  if (DECOR_STANDALONE_PREFIXES.has(prefix)) return base;
  return base.slice(0, idx);
}

function buildDecorRegistry() {
  const registry = {};
  DECOR_FILES.forEach(file => {
    const baseId = decorBaseId(file);
    const meta = DECOR_META[baseId];
    if (!meta) {
      console.warn(`DECOR_FILES: "${file}" hat keinen DECOR_META-Eintrag ("${baseId}") und wird ignoriert.`);
      return;
    }
    const entry = registry[baseId] || (registry[baseId] = {
      id: baseId, category: meta.category, label: meta.label, variants: [],
    });
    entry.variants.push(`img/decor/${file}`);
  });
  return registry;
}

const DECOR_REGISTRY = buildDecorRegistry();

// Fallback für Projekte ohne eigene Customizing-Auswahl (bzw. wenn der Nutzer
// eine Kategorie komplett leer geräumt hat) — entspricht dem bisherigen,
// fest verdrahteten Verhalten: Hauptaufgaben -> Apfel, Extraaufgaben ->
// Apfelblüte.
const DEFAULT_CUSTOMIZING = {
  core:  ['apple'],
  extra: ['appleblossom'],
};

// Effektiver Auswahl-Pool einer Aufgabenart ('core'|'extra') für ein Projekt.
// Liefert IMMER mindestens ein Element (nie einen leeren Pool), damit beim
// Würfeln in ensureTaskDecor() nie "kein Deko-Objekt verfügbar" passieren
// kann.
function getCustomizingPool(project, taskCategory) {
  const stored = project.customizing && project.customizing[taskCategory];
  const valid  = Array.isArray(stored) ? stored.filter(id => DECOR_REGISTRY[id]) : [];
  return valid.length ? valid : DEFAULT_CUSTOMIZING[taskCategory];
}

// Würfelt (bei Bedarf) das Deko-Objekt einer erledigten Aufgabe und
// speichert es auf der Aufgabe selbst (task.decorId) — eine einmal
// gewachsene Frucht/Blume bleibt dadurch dieselbe, unabhängig von späteren
// Reloads. EINE Ausnahme: Ist die gespeicherte Dekoration im aktuellen
// Customizing-Pool nicht mehr enthalten (Nutzer hat sie abgewählt), gilt sie
// als ungültig und wird neu aus dem AKTUELLEN Pool gewürfelt — nur so
// verschwinden abgewählte Sorten auch von bereits gewachsenen Deko-Objekten
// wieder, statt für immer als "Karteileiche" stehen zu bleiben. Bleibt eine
// Dekoration hingegen weiterhin ausgewählt, ändert sich nichts, auch wenn
// sich die Auswahl ansonsten (weitere Sorten dazu/weg) ändert. Die
// Wahrscheinlichkeit wird bewusst nicht als fester Wert gespeichert, sondern
// bei jedem Wurf live aus der aktuellen Poolgröße berechnet (1/Anzahl) —
// funktioniert dadurch unverändert bei 2, 5 oder später 20 Objekten.
//
// Hat die gewürfelte (oder schon vorhandene, noch gültige) Dekoration
// mehrere Farbvarianten (DECOR_REGISTRY[id].variants), wird zusätzlich eine
// davon gewürfelt und als task.decorVariant (voller Bildpfad) gespeichert —
// ebenso dauerhaft fix, solange die Dekoration selbst gültig bleibt (wird
// die Dekoration neu gewürfelt, wird zwangsläufig auch die Farbvariante neu
// gewürfelt, siehe unten). Bei nur einer Variante ist das Ergebnis
// deterministisch (immer diese eine Datei), Aufgaben ohne Farbvarianten sind
// also von dieser Erweiterung unberührt. Gibt true zurück, wenn dabei etwas
// geändert wurde (Aufrufer sollte dann speichern), sonst false.
function ensureTaskDecor(task, project) {
  if (!task.done) return false;
  let changed = false;
  const pool = getCustomizingPool(project, task.isExtra ? 'extra' : 'core');
  if (!task.decorId || !DECOR_REGISTRY[task.decorId] || !pool.includes(task.decorId)) {
    task.decorId = pool[Math.floor(Math.random() * pool.length)];
    task.decorVariant = null; // neue Dekoration -> alte Farbvariante ist ungültig, unten neu würfeln
    changed = true;
  }
  const entry = DECOR_REGISTRY[task.decorId];
  if (!task.decorVariant || !entry.variants.includes(task.decorVariant)) {
    task.decorVariant = entry.variants[Math.floor(Math.random() * entry.variants.length)];
    changed = true;
  }
  return changed;
}

// =========================
// APFEL-/BLÜTEN-DEKO (Detailbaum)
// Positionen (in % der Bildfläche) innerhalb der Baumkrone, an denen die
// Deko-Objekte erledigter Kern- bzw. Extraaufgaben auf dem PNG-Baum
// "sitzen". Rein dekorativ — die eigentliche Aufgabenliste (Klicken,
// Abhaken, Details) läuft weiterhin über die Äste-Kacheln
// (#proj-detail-tiles, renderDetailTiles() in forest.js). Reicht die Anzahl
// erledigter Aufgaben über die Slotzahl hinaus, wird gedeckelt (Deko, kein
// 1:1-Protokoll).
//
// Positionen werden nicht fest vorgegeben, sondern innerhalb einer Ellipse
// gestreut, die die Baumkrone aller 5 PNG-Varianten sicher trifft (Krone
// sitzt bei allen Varianten grob mittig oben, Stamm/Boden im unteren Drittel
// — die Ellipse bleibt bewusst konservativ innerhalb der Blattmasse). Der
// Seed hängt an der AUFGABEN-ID (nicht an ihrem Index in einer gefilterten
// "erledigt"-Liste!) — eine einmal vergebene Position bleibt dadurch stabil,
// auch wenn andere Aufgaben später (ab)gehakt werden. Würde eine Position
// ein bereits platziertes Deko-Objekt überlappen (siehe DECOR_MIN_DIST),
// sucht pickCanopySlot() innerhalb desselben, weiterhin pro Aufgabe
// deterministischen Zufallsstroms nach einer freien Alternative — Kern- UND
// Extraaufgaben werden dafür in EINEM gemeinsamen Durchlauf platziert
// (siehe updateDetailTreeElements() unten), damit sich Deko-Objekte auch
// über beide Aufgabenarten hinweg nie überlappen. Welches konkrete
// Deko-Objekt (Apfel, Apfelblüte, ...) an einer Position sitzt, kommt
// separat aus task.decorId/decorVariant.
// =========================
const CANOPY_ELLIPSE = { cx: 50, cy: 34, rx: 38, ry: 28 };
const DECOR_MAX = 8;
const DECOR_MIN_DIST = 13; // Mindestabstand zwischen zwei Deko-Objekten, selbe Einheit wie x/y (%) — an die Bildgröße (project-tree.css, .pdt-tree-decor-item) gekoppelt, bei Größenänderung dort proportional mitziehen.

function pickCanopySlot(task, placed) {
  const rng = seededRand(idToSeed(task.id) + 5501);
  const { cx, cy, rx, ry } = CANOPY_ELLIPSE;
  let best = null, bestDist = -1;
  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = rng() * Math.PI * 2;
    const r     = Math.sqrt(rng()) * 0.85; // gleichverteilt in der Fläche, mit Rand zur Kronenkante
    const x = cx + Math.cos(angle) * rx * r;
    const y = cy + Math.sin(angle) * ry * r;
    const minDist = placed.reduce((min, s) => Math.min(min, Math.hypot(s.x - x, s.y - y)), Infinity);
    if (minDist >= DECOR_MIN_DIST) return { x, y };
    // Keine ganz freie Position gefunden -> die am wenigsten überlappende
    // als Fallback merken, falls auch nach allen Versuchen keine Position
    // den Mindestabstand einhält (z.B. sehr viele Deko-Objekte gleichzeitig).
    if (minDist > bestDist) { bestDist = minDist; best = { x, y }; }
  }
  return best;
}

// =========================
// DETAILBAUM (PNG + Deko) AKTUALISIEREN
// =========================
function updateDetailTreeElements(p) {
  const treeContainer = document.getElementById('proj-detail-tree');
  if (!treeContainer) return;

  const variant     = getOrAssignTreeVariant(p);
  const season      = p.archived ? '_fall' : '';
  const primarySrc  = `img/trees/tree_${variant}${season}.png`;
  const fallbackSrc = `img/trees/tree_1${season}.png`;

  const allTasks     = [...(p.tasks || []), ...(p.subprojects || []).flatMap(sp => sp.tasks || [])];
  const coreDoneAll  = allTasks.filter(t => t.done && !t.isExtra);
  const extraDoneAll = allTasks.filter(t => t.done &&  t.isExtra);

  // Rückwärtskompatibilität: Aufgaben, die schon vor dem Customizing-Feature
  // erledigt wurden (oder auf anderem Weg ohne ensureTaskDecor() done=true
  // bekamen), haben noch kein task.decorId -> hier einmalig nachwürfeln und
  // dauerhaft speichern, statt bei jedem Render neu.
  let decorAssigned = false;
  [...coreDoneAll, ...extraDoneAll].forEach(t => { if (ensureTaskDecor(t, p)) decorAssigned = true; });
  if (decorAssigned && typeof saveProjects === 'function') saveProjects();

  const coreDone  = coreDoneAll.slice(0, DECOR_MAX);
  const extraDone = extraDoneAll.slice(0, DECOR_MAX);

  function decorImg(task, slot) {
    const entry = DECOR_REGISTRY[task.decorId] || DECOR_REGISTRY[DEFAULT_CUSTOMIZING[task.isExtra ? 'extra' : 'core'][0]];
    // Bereits gewürfelte Farbvariante (ensureTaskDecor() oben) verwenden;
    // variants[0] nur als Absicherung, falls task.decorVariant fehlt/
    // ungültig ist (sollte durch ensureTaskDecor() eigentlich nie vorkommen).
    const src = entry.variants.includes(task.decorVariant) ? task.decorVariant : entry.variants[0];
    const cls = entry.category === 'blumen' ? 'pdt-tree-decor-blumen' : '';
    return `<img class="pdt-tree-decor-item ${cls}" src="${src}" alt="${escapeXml(entry.label)}" draggable="false" style="left:${slot.x}%;top:${slot.y}%;" />`;
  }

  // Ein gemeinsamer Platzierungsdurchlauf über Kern- UND Extraaufgaben
  // (siehe pickCanopySlot()), damit sich Deko-Objekte auch über beide
  // Aufgabenarten hinweg nie überlappen. Reihenfolge = ursprüngliche
  // Aufgaben-Reihenfolge, nicht Fertig-Zeitpunkt — bleibt dadurch stabil,
  // unabhängig davon, welche anderen Aufgaben gerade (ab)gehakt sind.
  const placed = [];
  const decor = [...coreDone, ...extraDone].map(task => {
    const slot = pickCanopySlot(task, placed);
    placed.push(slot);
    return decorImg(task, slot);
  }).join('');

  // Keine Breitenbremse mehr nötig: der Baum ist die Hintergrundebene der
  // GESAMTEN Hero (project-tree.css), Titel/Projektinfos liegen als EINE
  // Glaskarte über seinem unteren Bereich statt daneben in einer eigenen
  // Textspalte — es gibt also nichts mehr, mit dem er horizontal
  // kollidieren könnte (siehe projects.css, .pdt-info-card).
  treeContainer.innerHTML = `
    <div class="pdt-tree-wrap">
      <img class="pdt-tree-img" src="${primarySrc}" alt="${escapeXml(p.name)}" draggable="false"
           onerror="if(!this.src.endsWith('${fallbackSrc}')) this.src='${fallbackSrc}';" />
      <div class="pdt-tree-decor">${decor}</div>
    </div>
  `;
  // Fortschritt (Prozent/Balken/Zähler) wird NICHT hier geschrieben — alleinige
  // Quelle ist renderProjectDetail() in forest.js via getProjectStats(), damit es
  // nur einen Berechnungsweg gibt und Zahlen nie auseinanderlaufen können.
}
