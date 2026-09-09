// =========================================================
// GARDEN-CATALOG.JS — Pflanzen-Rohdaten für den Garten (js/garden.js)
// Rein statische Config, kein Nutzer-State (siehe CLAUDE.md: statische
// Config sind window.X setzende .js-Dateien, kein fetch()/JSON unter
// file://). Details/Hintergrund siehe AI documentation/garden.md.
//
// GARDEN_ASSET_FILES listet jede Bilddatei aus img/decor/. Neue
// Farbvariante einer bestehenden Pflanze = Datei ablegen + Dateinamen
// hier eintragen, fertig — buildGardenCatalog() gruppiert automatisch
// über den Dateinamen-Präfix vor dem ersten "_" (z. B. hortensie_pink.png
// + hortensie_white.png -> eine Pflanze "Hortensie" mit zwei Varianten).
// Neue Pflanze (neuer Präfix) braucht zusätzlich einen Eintrag unten in
// GARDEN_PLANT_META.
// =========================================================

window.GARDEN_ASSET_FILES = [
  'acorn.png', 'anemone.png', 'apple.png', 'appleblossom.png',
  'bearded iris.png', 'berry_blackberry.png', 'berry_blueberry.png',
  'berry_currant.png', 'berry_goji.png', 'berry_gooseberry.png',
  'berry_mulberry.png', 'berry_physalis.png', 'berry_raspberry.png',
  'berry_strawberry.png', 'bleeding heart.png', 'blushing bride protea.png',
  'cherry.png', 'cherryblossom.png', 'chestnut.png', 'dahlia.png',
  'daisy_bella rose.png', 'daisy_pink.png', 'daisy_shiny.png',
  'daisy_white.png', 'frangipani.png', 'fuchsia.png', 'glyzinie.png',
  'grapes_black.png', 'grapes_green.png', 'grapes_red.png',
  'grapes_shiny.png', 'hazelnut.png', 'hibiskus.png', 'hortensie_pink.png',
  'hortensie_purple.png', 'hortensie_shiny.png', 'hortensie_white.png',
  'jade vine.png', 'lavendel.png', 'lemon.png', 'lemon_shiny.png', 'lily.png',
  'lotus.png', 'magnolia.png', 'mango.png', 'orange.png', 'orchid.png',
  'passion flower.png', 'peach.png', 'pear.png', 'pearblossom.png',
  'peony_pink.png', 'peony_white.png', 'plum.png', 'plumblossom.png',
  'pomegranate.png', 'ranunculus.png', 'rose_pink.png', 'rose_red.png',
  'rose_shiny.png', 'rose_white.png', 'rose_yellow.png',
  'spiderlily_pink.png', 'spiderlily_red.png', 'spiderlily_shiny.png',
  'spiderlily_white.png', 'starfruit.png', 'sunflower.png',
  'sweet juliet rose.png', 'teddy bear sunflower.png', 'tomato.png',
  'wisteria.png',
];

// Präfixe, bei denen der Teil vor dem "_" KEINE Farbvariante, sondern nur
// eine lose Namens-Gruppierung ist (z. B. "berry_strawberry.png" und
// "berry_blueberry.png" sind zwei völlig verschiedene Pflanzen, keine
// Farbvarianten derselben Beere). Für diese Präfixe wird jede Datei zu
// einer eigenständigen Pflanze statt zu einer gemeinsamen Variantengruppe.
const GARDEN_STANDALONE_PREFIXES = new Set(['berry']);

// Anzeigename + Kategorie + Tags + Wuchsform pro Pflanzen-ID. Tags sind für
// spätere Gartenrätsel gedacht (siehe garden.md, Abschnitt "Zukunft") —
// noch nicht in Phase 1 verwendet, aber jetzt schon mitgepflegt, damit
// später keine Pflanze nachträglich getaggt werden muss. Pflanzen-ID =
// Dateiname-Präfix vor dem ersten "_", bzw. kompletter (slugifizierter)
// Dateiname ohne Endung, wenn kein "_" vorkommt.
//
// `form` verweist auf einen Eintrag in GARDEN_FORM_DEFS (unten) — legt
// fest, mit welchem generischen Pflanzenkörper (img/decor/stem_small.png
// usw.) diese Pflanze im Anzuchtfeld/Garten zusammengesetzt wird. Das
// eigentliche Blüten-/Frucht-Bild (aus GARDEN_ASSET_FILES) ist bei den
// meisten Pflanzen nur ein Ausschnitt (Blüte/Frucht), kein vollständiger
// Pflanzenkörper — siehe garden.md, Abschnitt "Wachstumssystem".
window.GARDEN_PLANT_META = {
  acorn:               { label: 'Eichel',              category: 'nut',    tags: ['tree', 'autumn', 'forest', 'edible', 'botanical_nut'], form: 'tree' },
  anemone:             { label: 'Anemone',             category: 'flower', tags: ['colorful', 'spring', 'flowering'], form: 'flower' },
  apple:               { label: 'Apfel',                category: 'fruit',  tags: ['red', 'tree', 'autumn', 'edible', 'botanical_fruit'], form: 'tree' },
  appleblossom:        { label: 'Apfelblüte',           category: 'flower', tags: ['pink', 'tree', 'spring', 'flowering'], form: 'tree' },
  beardediris:         { label: 'Bartiris',             category: 'flower', tags: ['purple', 'spring', 'flowering'], form: 'flower' },
  berryblackberry:     { label: 'Brombeere',            category: 'fruit',  tags: ['purple', 'black', 'bush', 'summer', 'edible', 'botanical_berry'], form: 'berry' },
  berryblueberry:      { label: 'Blaubeere',            category: 'fruit',  tags: ['blue', 'bush', 'summer', 'edible', 'botanical_berry'], form: 'berry' },
  berrycurrant:        { label: 'Johannisbeere',        category: 'fruit',  tags: ['red', 'bush', 'summer', 'edible', 'botanical_berry'], form: 'berry' },
  berrygoji:           { label: 'Goji-Beere',           category: 'fruit',  tags: ['red', 'bush', 'exotic', 'edible'], form: 'berry' },
  berrygooseberry:     { label: 'Stachelbeere',         category: 'fruit',  tags: ['green', 'bush', 'summer', 'edible', 'botanical_berry'], form: 'berry' },
  berrymulberry:       { label: 'Maulbeere',            category: 'fruit',  tags: ['purple', 'tree', 'summer', 'edible', 'botanical_berry'], form: 'berry' },
  berryphysalis:       { label: 'Physalis',             category: 'fruit',  tags: ['orange', 'exotic', 'edible'], form: 'berry' },
  berryraspberry:      { label: 'Himbeere',             category: 'fruit',  tags: ['red', 'bush', 'summer', 'edible', 'botanical_berry'], form: 'berry' },
  berrystrawberry:     { label: 'Erdbeere',             category: 'fruit',  tags: ['red', 'groundcover', 'summer', 'edible', 'botanical_not_true_berry'], form: 'berry' },
  bleedingheart:       { label: 'Tränendes Herz',       category: 'flower', tags: ['pink', 'hanging', 'spring', 'flowering'], form: 'hanging' },
  blushingbrideprotea: { label: 'Protea',               category: 'flower', tags: ['pink', 'exotic', 'flowering'], form: 'bush' },
  cherry:              { label: 'Kirsche',              category: 'fruit',  tags: ['red', 'tree', 'summer', 'edible', 'botanical_fruit'], form: 'tree' },
  cherryblossom:       { label: 'Kirschblüte',          category: 'flower', tags: ['pink', 'tree', 'spring', 'flowering'], form: 'tree' },
  chestnut:            { label: 'Kastanie',             category: 'nut',    tags: ['tree', 'autumn', 'forest', 'edible', 'botanical_nut'], form: 'tree' },
  dahlia:              { label: 'Dahlie',               category: 'flower', tags: ['colorful', 'summer', 'flowering'], form: 'flower' },
  daisy:               { label: 'Gänseblümchen',        category: 'flower', tags: ['meadow', 'flowering'], form: 'groundcover' },
  frangipani:          { label: 'Frangipani',           category: 'flower', tags: ['exotic', 'tropical', 'flowering'], form: 'tree' },
  fuchsia:             { label: 'Fuchsie',              category: 'flower', tags: ['pink', 'hanging', 'flowering'], form: 'hanging' },
  glyzinie:            { label: 'Glyzinie',             category: 'flower', tags: ['purple', 'vine', 'spring', 'flowering'], form: 'vine' },
  grapes:              { label: 'Weintrauben',          category: 'fruit',  tags: ['vine', 'autumn', 'edible', 'botanical_berry'], form: 'vine' },
  hazelnut:            { label: 'Haselnuss',            category: 'nut',    tags: ['bush', 'autumn', 'forest', 'edible', 'botanical_nut'], form: 'bush' },
  hibiskus:            { label: 'Hibiskus',             category: 'flower', tags: ['red', 'exotic', 'tropical', 'flowering'], form: 'bush' },
  hortensie:           { label: 'Hortensie',            category: 'flower', tags: ['bush', 'summer', 'flowering'], form: 'bush' },
  jadevine:            { label: 'Jade Vine',            category: 'flower', tags: ['turquoise', 'vine', 'hanging', 'exotic', 'flowering'], form: 'vine' },
  lavendel:            { label: 'Lavendel',             category: 'flower', tags: ['purple', 'perennial', 'summer', 'flowering'], form: 'bush' },
  lemon:               { label: 'Zitrone',              category: 'fruit',  tags: ['yellow', 'tree', 'edible', 'botanical_fruit'], form: 'tree' },
  lily:                { label: 'Lilie',                category: 'flower', tags: ['white', 'summer', 'flowering'], form: 'flower' },
  lotus:               { label: 'Lotus',                category: 'flower', tags: ['pink', 'aquatic_plant', 'summer', 'flowering'], form: 'groundcover' },
  magnolia:            { label: 'Magnolie',             category: 'flower', tags: ['pink', 'tree', 'spring', 'flowering'], form: 'tree' },
  mango:               { label: 'Mango',                category: 'fruit',  tags: ['orange', 'tree', 'tropical', 'edible', 'botanical_fruit'], form: 'tree' },
  orange:              { label: 'Orange',               category: 'fruit',  tags: ['orange', 'tree', 'edible', 'botanical_fruit'], form: 'tree' },
  orchid:              { label: 'Orchidee',             category: 'flower', tags: ['purple', 'exotic', 'flowering'], form: 'flower' },
  passionflower:       { label: 'Passionsblume',        category: 'flower', tags: ['colorful', 'vine', 'exotic', 'flowering'], form: 'vine' },
  peach:               { label: 'Pfirsich',             category: 'fruit',  tags: ['pink', 'tree', 'summer', 'edible', 'botanical_fruit'], form: 'tree' },
  pear:                { label: 'Birne',                category: 'fruit',  tags: ['green', 'tree', 'autumn', 'edible', 'botanical_fruit'], form: 'tree' },
  pearblossom:         { label: 'Birnenblüte',          category: 'flower', tags: ['white', 'tree', 'spring', 'flowering'], form: 'tree' },
  peony:               { label: 'Pfingstrose',          category: 'flower', tags: ['perennial', 'spring', 'flowering'], form: 'flower' },
  plum:                { label: 'Pflaume',              category: 'fruit',  tags: ['purple', 'tree', 'summer', 'edible', 'botanical_fruit'], form: 'tree' },
  plumblossom:         { label: 'Pflaumenblüte',        category: 'flower', tags: ['pink', 'tree', 'spring', 'flowering'], form: 'tree' },
  pomegranate:         { label: 'Granatapfel',          category: 'fruit',  tags: ['red', 'tree', 'autumn', 'edible', 'botanical_fruit'], form: 'tree' },
  ranunculus:          { label: 'Ranunkel',             category: 'flower', tags: ['colorful', 'spring', 'flowering'], form: 'flower' },
  rose:                { label: 'Rose',                 category: 'flower', tags: ['bush', 'flowering'], form: 'flower' },
  spiderlily:          { label: 'Spinnenlilie',         category: 'flower', tags: ['autumn', 'flowering'], form: 'flower' },
  starfruit:           { label: 'Sternfrucht',          category: 'fruit',  tags: ['exotic', 'tropical', 'edible', 'botanical_fruit'], form: 'tree' },
  sunflower:           { label: 'Sonnenblume',          category: 'flower', tags: ['yellow', 'summer', 'flowering'], form: 'flower' },
  sweetjulietrose:     { label: 'Sweet Juliet Rose',    category: 'flower', tags: ['bush', 'special', 'flowering'], form: 'flower' },
  teddybearsunflower:  { label: 'Teddybär-Sonnenblume', category: 'flower', tags: ['yellow', 'summer', 'special', 'flowering'], form: 'flower' },
  tomato:              { label: 'Tomate',               category: 'fruit',  tags: ['red', 'bush', 'edible', 'botanical_fruit', 'botanical_berry'], form: 'bush' },
  wisteria:            { label: 'Wisteria',             category: 'flower', tags: ['purple', 'vine', 'spring', 'flowering'], form: 'vine' },
};

// Zusatz-Tags pro Farbvariante (Dateiname) — nur bei Pflanzen mit mehreren
// Farbvarianten nötig (rose, daisy, hortensie, peony, grapes, spiderlily,
// lemon). Bei Einzel-Varianten-Pflanzen steckt die Farbe direkt oben in
// GARDEN_PLANT_META.tags. "shiny" ist immer ein Zusatz-Tag hier, nie in
// GARDEN_PLANT_META (siehe GARDEN_SHINY_WEIGHT — shiny ist selbst schon
// eine Variante, keine Grundeigenschaft der Pflanze).
window.GARDEN_VARIANT_TAGS = {
  'rose_red.png': ['red'], 'rose_pink.png': ['pink'], 'rose_white.png': ['white'],
  'rose_yellow.png': ['yellow'], 'rose_shiny.png': ['red', 'shiny'],
  'daisy_pink.png': ['pink'], 'daisy_white.png': ['white'],
  'daisy_bella rose.png': ['pink'], 'daisy_shiny.png': ['white', 'yellow', 'shiny'],
  'hortensie_pink.png': ['pink'], 'hortensie_purple.png': ['purple'],
  'hortensie_white.png': ['white'], 'hortensie_shiny.png': ['purple', 'blue', 'shiny'],
  'peony_pink.png': ['pink'], 'peony_white.png': ['white'],
  'grapes_black.png': ['purple', 'black'], 'grapes_green.png': ['green'],
  'grapes_red.png': ['red', 'purple'], 'grapes_shiny.png': ['yellow', 'gold', 'shiny'],
  'spiderlily_pink.png': ['pink'], 'spiderlily_red.png': ['red'],
  'spiderlily_white.png': ['white'], 'spiderlily_shiny.png': ['gold', 'yellow', 'shiny'],
  'lemon_shiny.png': ['shiny'], // Farbe (yellow) bleibt gemeinsames Tag oben
};

// =========================================================
// WUCHSFORMEN — ordnet jeder Wuchsform (siehe `form` oben) generische
// Pflanzenkörper (img/decor/) + Ansatzpunkte für die Blüte/Frucht zu.
// `youngBody`/`grownBody` sind bei Formen mit zwei Größenstufen
// unterschiedlich (Baum: kleiner Setzling -> hoher Stamm; Busch: klein ->
// groß) — das liefert nebenbei einen sichtbaren Größensprung beim
// Wachstum. Formen ohne zwei Assets (Beere/Ranke/Hängepflanze/
// Bodendecker) nutzen denselben Körper für beide Stufen; hier zeigt sich
// das Wachstum ausschließlich am Erscheinen der Blüte/Frucht.
// Anker-Koordinaten sind Prozentwerte innerhalb des Körperbildes. Formen
// mit mehreren Ankern zeigen dieselbe Blüte/Frucht mehrfach verteilt
// (Busch/Beerenstrauch/Ranke/Hängepflanze/Bodendecker), Formen mit einem
// Anker (Blume/Baum) genau einmal an der Stängel-/Kronenspitze.
// =========================================================
window.GARDEN_FORM_DEFS = {
  flower: {
    youngBody: 'stem_small.png', grownBody: 'stem_small.png',
    flowerScale: 0.62,
    anchors: [{ x: 53, y: 23 }],
  },
  tree: {
    youngBody: 'stem_small.png', grownBody: 'stem_tall.png',
    flowerScale: 0.58,
    anchors: [{ x: 53, y: 20 }],
  },
  bush: {
    youngBody: 'bush_small.png', grownBody: 'bush_large.png',
    flowerScale: 0.28,
    anchors: [{ x: 33, y: 44 }, { x: 52, y: 32 }, { x: 68, y: 46 }, { x: 47, y: 58 }],
  },
  berry: {
    youngBody: 'berry_bush.png', grownBody: 'berry_bush.png',
    flowerScale: 0.16,
    anchors: [{ x: 26, y: 46 }, { x: 40, y: 32 }, { x: 55, y: 48 }, { x: 68, y: 34 }, { x: 48, y: 60 }, { x: 33, y: 64 }],
  },
  vine: {
    youngBody: 'vine.png', grownBody: 'vine.png',
    flowerScale: 0.26,
    anchors: [{ x: 50, y: 8 }, { x: 64, y: 34 }, { x: 34, y: 56 }],
  },
  hanging: {
    youngBody: 'hanging_plant.png', grownBody: 'hanging_plant.png',
    flowerScale: 0.26,
    anchors: [{ x: 50, y: 18 }, { x: 32, y: 44 }, { x: 66, y: 48 }, { x: 50, y: 70 }],
  },
  groundcover: {
    youngBody: 'groundcover.png', grownBody: 'groundcover.png',
    flowerScale: 0.2,
    anchors: [{ x: 18, y: 44 }, { x: 36, y: 34 }, { x: 54, y: 46 }, { x: 72, y: 36 }, { x: 86, y: 48 }],
  },
};

// "shiny"-Dateien sind bewusst seltene Sondervarianten (wie bei mehreren
// Pflanzen mit diesem Suffix) — alle übrigen Farbvarianten einer Pflanze
// sind untereinander gleich wahrscheinlich.
const GARDEN_SHINY_WEIGHT = 0.15;

function gardenSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Gruppiert GARDEN_ASSET_FILES zu Pflanzen mit ihren Farbvarianten. Läuft
// einmal beim Skript-Laden — die Katalogstruktur ändert sich zur Laufzeit
// nicht (nur beim nächsten Deploy, wenn neue Assets dazukommen).
function buildGardenCatalog() {
  const groups = {};
  window.GARDEN_ASSET_FILES.forEach(file => {
    const base = file.replace(/\.png$/i, '');
    const underscoreIdx = base.indexOf('_');
    const prefix = underscoreIdx === -1 ? null : gardenSlug(base.slice(0, underscoreIdx));
    const isStandalone = underscoreIdx === -1 || GARDEN_STANDALONE_PREFIXES.has(prefix);
    const groupKey = isStandalone ? gardenSlug(base) : prefix;
    const variantName = isStandalone ? 'default' : base.slice(underscoreIdx + 1);
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push({
      file,
      variantName,
      weight: variantName.toLowerCase() === 'shiny' ? GARDEN_SHINY_WEIGHT : 1,
      tags: window.GARDEN_VARIANT_TAGS[file] || [],
    });
  });
  return Object.keys(groups).map(id => {
    const meta = window.GARDEN_PLANT_META[id] || { label: id, category: 'flower', tags: [], form: 'flower' };
    return { id, label: meta.label, category: meta.category, tags: meta.tags, form: meta.form || 'flower', variants: groups[id] };
  }).sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

window.GARDEN_CATALOG = buildGardenCatalog();

// Wählt gewichtet eine Farbvariante einer Pflanze aus — "shiny" erscheint
// deutlich seltener als die übrigen Varianten (siehe GARDEN_SHINY_WEIGHT).
function gardenPickVariant(plant) {
  const total = plant.variants.reduce((sum, v) => sum + v.weight, 0);
  let r = Math.random() * total;
  for (const v of plant.variants) {
    if (r < v.weight) return v;
    r -= v.weight;
  }
  return plant.variants[plant.variants.length - 1];
}

// =========================================================
// GARTENRÄTSEL — Beispiel-Inhalte für den Pflanzenstand (js/garden.js,
// renderGardenStand()/tryFulfillGardenQuestSlot()). Jedes Rätsel hat
// mehrere Slots, jeder Slot verlangt genau ein Tag (siehe
// gardenStickerTags() in garden.js — Kategorie zählt dort automatisch mit
// als Tag, "eine Frucht" == Tag "obst"). Rein tag-basiert geprüft, kennt
// keine Pflanzen-Sonderfälle — neue Rätsel hinzufügen heißt einfach: neuen
// Eintrag mit vorhandenen Tags ergänzen, kein Code ändern.
// =========================================================
window.GARDEN_QUESTS = [
  {
    id: 'red-fruit',
    hint: 'Etwas Rotes + eine Frucht',
    slots: [
      { tag: 'red', hint: 'etwas Rotes' },
      { tag: 'fruit', hint: 'eine Frucht' },
    ],
  },
  {
    id: 'hanging',
    hint: 'Etwas Hängendes',
    slots: [
      { tag: 'hanging', hint: 'etwas Hängendes' },
    ],
  },
  {
    id: 'spring-vine',
    hint: 'Eine Frühlingsblume + eine Ranke',
    slots: [
      { tag: 'spring', hint: 'eine Frühlingsblume' },
      { tag: 'vine', hint: 'eine Ranke' },
    ],
  },
  {
    id: 'yellow-summer',
    hint: 'Etwas Gelbes + etwas aus dem Sommer',
    slots: [
      { tag: 'yellow', hint: 'etwas Gelbes' },
      { tag: 'summer', hint: 'etwas aus dem Sommer' },
    ],
  },
];
