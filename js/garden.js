// =========================================================
// GARDEN.JS — Sticker-Architektur, siehe AI documentation/garden.md
//
// Zwei Sub-Ansichten innerhalb von #view-garden:
//   - "garden": freie Fläche zum Platzieren/Verschieben von Pflanzen
//   - "dex":    Pflanzendex (Sammel-Tagebuch, siehe garden.md)
//
// Katalog + Metadaten kommen aus js/garden-catalog.js (GARDEN_CATALOG,
// gardenPickVariant) — muss vor dieser Datei geladen sein (index.html).
//
// STICKER-MODELL: Jedes platzierbare Element im Garten (aktuell nur
// Pflanzen — Deko/Easter-Eggs folgen später mit derselben Struktur) ist EIN
// gemeinsamer "Sticker"-Datensatz in `gardenStickers`, unterschieden über
// `type`/`tags`, nicht über eigene Parallel-Systeme:
//   {
//     id, type: 'plant', plantId, tags: [...],       // was es ist
//     scene: 'nursery' | 'canvas' | 'stand',          // wo es gerade liegt
//     x, y, scale, flipX, order,                      // gemeinsame Transform-Eigenschaften
//     growthStage: 'seed'|'sprout'|'young'|'grown',   // nur bei type:'plant' relevant
//     decorationAsset, plantedAt,
//   }
// Wächst ein Samen im Anzuchtfeld, ändert sich NUR `growthStage` (und damit
// das gerenderte Asset) an genau diesem Datensatz — es wird nicht gelöscht
// und als neues Objekt in einem anderen System neu erzeugt. Umpflanzen ins
// Beet ändert nur `scene` (+ x/y). Drag&Drop, Löschen, Rendern laufen für
// ALLE Sticker (Anzuchtfeld, Garten-Fläche, Pflanzenstand) über dieselben
// Funktionen unten — siehe garden.md, Abschnitt "Sticker-Architektur".
// =========================================================

let gardenStickers     = DB.get('gardenStickers', null);
let gardenDex          = DB.get('gardenDex', {});
let gardenActiveSubtab = DB.get('gardenActiveSubtab', 'garden');
let gardenQuestState   = DB.get('gardenQuestState', null);

// Einmalige Migration der alten getrennten Arrays (gardenPlants/
// gardenNursery, vor der Sticker-Vereinheitlichung) in das neue
// gemeinsame Sticker-Array — nach CLAUDE.md-Konvention: alte Nutzerdaten
// nie verwerfen, nur einmalig ins neue Format überführen.
if (!Array.isArray(gardenStickers)) {
  const legacyPlants  = DB.get('gardenPlants', []);
  const legacyNursery = DB.get('gardenNursery', []);
  gardenStickers = [
    ...legacyNursery.map(p => ({
      id: p.id, type: 'plant', plantId: p.plantId,
      scene: 'nursery', x: p.x, y: p.y, scale: 1, flipX: false, order: p.plantedAt || Date.now(),
      growthStage: null, decorationAsset: p.file, plantedAt: p.plantedAt,
    })),
    ...legacyPlants.map(p => ({
      id: p.id, type: 'plant', plantId: p.plantId,
      scene: 'canvas', x: p.x, y: p.y, scale: 1, flipX: false, order: p.plantedAt || Date.now(),
      growthStage: 'grown', decorationAsset: p.file, plantedAt: p.plantedAt,
    })),
  ];
  DB.set('gardenStickers', gardenStickers);
  localStorage.removeItem('gardenPlants');
  localStorage.removeItem('gardenNursery');
}

function saveGardenStickers()     { DB.set('gardenStickers', gardenStickers); }
function saveGardenDex()          { DB.set('gardenDex', gardenDex); }
function saveGardenActiveSubtab() { DB.set('gardenActiveSubtab', gardenActiveSubtab); }
function saveGardenQuestState()   { DB.set('gardenQuestState', gardenQuestState); }

// Debug-Override der Wachstumszeiten (siehe "GARDEN-DEBUG: WACHSTUMSZEITEN"
// weiter unten) — null = Standardwerte (GARDEN_DEFAULT_DURATIONS_MS)
// verwenden. Rein lokales Debug-Werkzeug, kein Teil des eigentlichen
// Gartens; nur in DB, damit es einen Reload übersteht, während man testet.
let gardenDebugDurationsMs = DB.get('gardenDebugDurationsMs', null);
function saveGardenDebugDurations() { DB.set('gardenDebugDurationsMs', gardenDebugDurationsMs); }

function gardenEsc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function gardenPlantById(plantId) {
  return window.GARDEN_CATALOG.find(p => p.id === plantId);
}

// Tags einer konkreten Farbvariante inkl. Kategorie (z. B. "fruit") als Tag
// mit — die Kategorie ist fachlich nichts anderes als ein weiteres Tag
// ("eine Frucht" == category "fruit"), deshalb keine getrennte Prüfung an
// anderer Stelle im Code nötig. Variantenspezifische Tags (Farbe, "shiny" —
// siehe GARDEN_VARIANT_TAGS in garden-catalog.js) kommen zu den gemeinsamen
// Pflanzen-Tags dazu, da sich Farbvarianten derselben Pflanze farblich
// unterscheiden können. Einzige Stelle, die "Was ist dieser Sticker"
// beantwortet — Gartenrätsel (weiter unten) prüfen ausschließlich hierüber.
function gardenTagsForVariant(plant, file) {
  if (!plant) return [];
  const variant = plant.variants.find(v => v.file === file);
  return [...plant.tags, plant.category, ...(variant ? variant.tags : [])];
}

function gardenStickerTags(sticker) {
  if (sticker.type === 'plant') return gardenTagsForVariant(gardenPlantById(sticker.plantId), sticker.decorationAsset);
  return sticker.tags || [];
}

// =========================
// PFLANZEN-VISUAL — Körper (img/decor/stem_small.png usw., siehe
// GARDEN_FORM_DEFS in js/garden-catalog.js) + Blüte/Frucht zusammensetzen.
// Die meisten Dateien in img/decor/ sind nur Blüte/Frucht, kein
// vollständiger Pflanzenkörper (siehe garden.md, Abschnitt "Wachstums-
// system") — deshalb wird hier immer aus generischem Körper + Katalogbild
// zusammengesetzt statt ein einzelnes Bild direkt anzuzeigen. baseAsset
// (Körper) wird IMMER live aus Pflanzenform abgeleitet, nie auf dem
// Sticker gespeichert — einzige Quelle bleibt GARDEN_FORM_DEFS, damit sich
// eine spätere Anpassung der Körper-Zuordnung sofort überall auswirkt.
// Die Streuung der Blüten/Früchte auf dem Körper ist "leicht zufällig",
// aber deterministisch aus der Instanz-ID abgeleitet (kein Math.random()
// bei jedem Render) — dieselbe Pflanze sieht nach jedem Reload exakt
// gleich aus, ohne dass die Streuung extra gespeichert werden muss.
// =========================
function gardenSeededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

function gardenBloomJitter(instId, anchorIndex) {
  const r = suffix => gardenSeededRandom(`${instId}:${anchorIndex}:${suffix}`);
  return {
    dx: (r('x') - 0.5) * 11,      // ± 5.5% der Körperbreite
    dy: (r('y') - 0.5) * 11,
    rot: (r('r') - 0.5) * 40,     // ± 20°
    scale: 0.74 + r('s') * 0.5,   // 0.74–1.24×
  };
}

// flowerFile: null -> nur der nackte Körper (Wachstumsstufe "junge
// Pflanze"), sonst wird die Blüte/Frucht an jedem Anker der Wuchsform
// platziert (mehrfach bei Busch/Beerenstrauch/Ranke/Hängepflanze/
// Bodendecker, einmal bei Blume/Baum). stickerScale/flipX sind die
// gemeinsamen Sticker-Transform-Eigenschaften (siehe Dateikopf) — wirken
// auf die GESAMTE zusammengesetzte Pflanze, nicht auf einzelne Blüten.
function gardenComposeVisualHTML({ form, bodyFile, flowerFile, instId, widthPx, stickerScale, flipX }) {
  const def = window.GARDEN_FORM_DEFS[form] || window.GARDEN_FORM_DEFS.flower;
  const blooms = flowerFile ? def.anchors.map((a, i) => {
    const j = gardenBloomJitter(instId, i);
    const bloomWidth = widthPx * def.flowerScale * j.scale;
    return `<img class="garden-plant-bloom" src="img/decor/${flowerFile}" alt="" draggable="false" style="left:${a.x + j.dx}%; top:${a.y + j.dy}%; width:${bloomWidth}px; transform: translate(-50%, -50%) rotate(${j.rot}deg);"/>`;
  }).join('') : '';
  const transform = `scale(${stickerScale || 1}) scaleX(${flipX ? -1 : 1})`;
  return `
    <div class="garden-plant-visual" style="width:${widthPx}px; transform:${transform};">
      <img class="garden-plant-body" src="img/decor/${bodyFile}" alt="" draggable="false"/>
      ${blooms}
    </div>
  `;
}

// =========================
// EINTRITTSPUNKT (main.js renderView('garden'))
// =========================
function renderGarden() {
  initGardenSubtabs();
  if (gardenActiveSubtab === 'dex') renderGardenDex();
  else renderGardenCanvas();
}

// =========================
// SUB-TAB-UMSCHALTER — gleiches Muster wie initBudgetSubtabs() in budget.js
// =========================
const GARDEN_SUBTABS = [
  { tab: 'garden', panelId: 'garden-panel-garden', btnId: 'garden-subtab-btn-garden' },
  { tab: 'dex',    panelId: 'garden-panel-dex',    btnId: 'garden-subtab-btn-dex' },
];

function applyGardenSubtabVisibility(tab) {
  GARDEN_SUBTABS.forEach(({ tab: t, panelId, btnId }) => {
    document.getElementById(panelId)?.classList.toggle('hidden', t !== tab);
    document.getElementById(btnId)?.classList.toggle('active', t === tab);
  });
}

function setGardenSubtab(tab) {
  gardenActiveSubtab = tab;
  saveGardenActiveSubtab();
  applyGardenSubtabVisibility(tab);
  if (tab === 'dex') renderGardenDex();
  else renderGardenCanvas();
}

function initGardenSubtabs() {
  GARDEN_SUBTABS.forEach(({ tab, btnId }) => {
    const btn = document.getElementById(btnId);
    if (btn && !btn._subtabBound) {
      btn._subtabBound = true;
      btn.addEventListener('click', () => setGardenSubtab(tab));
    }
  });
  applyGardenSubtabVisibility(gardenActiveSubtab);
}

// =========================
// GARTEN-FLÄCHE
// =========================
function renderGardenCanvas() {
  renderGardenTray();
  renderGardenCanvasPlants();
  renderGardenNursery();
  renderGardenStand();
  startGardenGrowthTicker();
  initGardenDebugPanel();
  requestAnimationFrame(gardenFitLayout);
  initGardenFitLayoutResize();
}

// =========================
// DESKTOP-VIEWPORT-FIT — Szene + Anzuchtfeld + Pflanzenstand sollen auf
// normalen Desktop-Bildschirmen möglichst gleichzeitig ohne vertikales
// Scrollen sichtbar sein (siehe garden.md). Statt mit overflow:hidden
// abzuschneiden, wird die GESAMTE Komposition (Canvas + Anzuchtfeld-Zeile)
// bei Bedarf gleichmäßig verkleinert — reine Breiten-Skalierung, die
// Höhe folgt automatisch über die bestehenden CSS-aspect-ratio-Regeln,
// damit kein Bild zugeschnitten oder verzerrt wird. Auf schmalen
// Bildschirmen (<900px) bleibt die Ansicht unverändert scrollbar, dort
// macht ein Herunterskalieren keinen Sinn.
function gardenFitLayout() {
  if (gardenActiveSubtab !== 'garden') return;
  const panel  = document.getElementById('garden-panel-garden');
  const canvas = document.getElementById('garden-canvas');
  const row    = document.querySelector('.garden-nursery-row');
  if (!panel || !canvas || !row) return;

  // Erst auf natürliche Größe zurücksetzen, bevor neu gemessen wird — sonst
  // würde eine bereits verkleinerte Breite die nächste Messung verfälschen.
  canvas.style.width = row.style.width = '';
  canvas.style.marginLeft = canvas.style.marginRight = '';
  row.style.marginLeft = row.style.marginRight = '';

  if (window.innerWidth < 900) return;

  const gapPx = 14; // .garden-nursery-row margin-top — fest, skaliert nicht mit der Breite
  const availableHeight = window.innerHeight - panel.getBoundingClientRect().top - 16;
  const canvasNaturalWidth = canvas.getBoundingClientRect().width;
  const canvasNaturalHeight = canvas.getBoundingClientRect().height;
  const rowNaturalHeight = row.getBoundingClientRect().height;
  const naturalHeight = canvasNaturalHeight + gapPx + rowNaturalHeight;
  if (availableHeight < 200 || naturalHeight <= availableHeight) return;

  const scale = Math.max(0.45, (availableHeight - gapPx) / (canvasNaturalHeight + rowNaturalHeight));
  // Basis ist die natürliche Canvas-Breite selbst (nicht panel.clientWidth, das
  // zusätzlich das Panel-Padding einrechnet und die Skalierung verfälschen würde).
  const scaledWidth = Math.floor(canvasNaturalWidth * scale) + 'px';
  canvas.style.width = scaledWidth;
  row.style.width = scaledWidth;
  canvas.style.marginLeft = canvas.style.marginRight = 'auto';
  row.style.marginLeft = row.style.marginRight = 'auto';
}

let _gardenFitResizeBound = false;
function initGardenFitLayoutResize() {
  if (_gardenFitResizeBound) return;
  _gardenFitResizeBound = true;
  let timer = null;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(gardenFitLayout, 120);
  });
}

function renderGardenTray() {
  const tray = document.getElementById('garden-tray');
  if (!tray) return;
  const groups = { flower: [], fruit: [], nut: [] };
  window.GARDEN_CATALOG.forEach(p => (groups[p.category] || groups.flower).push(p));

  const section = (title, plants) => plants.length ? `
    <div class="garden-tray-group">
      <div class="garden-tray-group-label">${title}</div>
      <div class="garden-tray-grid">
        ${plants.map(p => `
          <button type="button" class="garden-tray-item" data-plant="${p.id}" title="${gardenEsc(p.label)} · Klick: pflanzen · Ziehen: zum Pflanzenstand">
            <img src="img/decor/${p.variants[0].file}" alt="" draggable="false"/>
            <span>${gardenEsc(p.label)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  ` : '';

  tray.innerHTML = section('🌸 Blumen', groups.flower) + section('🍎 Obst', groups.fruit) + section('🌰 Nüsse', groups.nut);
  tray.querySelectorAll('.garden-tray-item').forEach(btn => bindGardenTrayItem(btn));
}

// Ein Klick pflanzt wie gewohnt einen Samen ins Anzuchtfeld. Ein echtes
// Ziehen (Bewegung über der Schwelle) hebt stattdessen einen schwebenden
// Ghost an — lässt man über dem Pflanzenstand los, wird versucht, damit
// eine offene Rätsel-Anforderung zu erfüllen (siehe tryFulfillGardenQuest-
// Slot()). Dieselbe Klick-vs-Ziehen-Unterscheidung wie bindGardenPlantDrag()
// unten, nur mit einem sichtbaren Ghost statt einer Live-Positionierung,
// weil das Ziel (Pflanzenstand) ein anderer Container ist als die Quelle
// (Palette-Button).
function bindGardenTrayItem(btn) {
  const plantId = btn.dataset.plant;
  let pressed = false, dragging = false, startX = 0, startY = 0, ghost = null;

  btn.addEventListener('pointerdown', e => {
    pressed = true;
    dragging = false;
    startX = e.clientX;
    startY = e.clientY;
    btn.setPointerCapture(e.pointerId);
  });

  btn.addEventListener('pointermove', e => {
    if (!pressed) return;
    if (!dragging && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) {
      dragging = true;
      const plant = gardenPlantById(plantId);
      ghost = document.createElement('img');
      ghost.src = `img/decor/${plant.variants[0].file}`;
      ghost.className = 'garden-tray-drag-ghost';
      document.body.appendChild(ghost);
    }
    if (dragging && ghost) {
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';
    }
  });

  btn.addEventListener('pointerup', e => {
    if (!pressed) return;
    pressed = false;
    if (ghost) { ghost.remove(); ghost = null; }
    if (dragging) {
      const standEl = document.getElementById('garden-stand-slots');
      if (standEl) {
        const r = standEl.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          tryFulfillGardenQuestSlot(plantId);
        }
      }
    } else {
      addGardenPlant(plantId);
    }
  });
}

const GARDEN_MAIN_BODY_PX = 84;

function renderGardenCanvasPlants() {
  const layer = document.getElementById('garden-canvas-plants');
  if (!layer) return;
  const stickers = gardenStickers.filter(s => s.scene === 'canvas');
  layer.innerHTML = stickers.map(sticker => {
    const plant = gardenPlantById(sticker.plantId);
    const form = plant ? plant.form : 'flower';
    const def = window.GARDEN_FORM_DEFS[form] || window.GARDEN_FORM_DEFS.flower;
    const visual = gardenComposeVisualHTML({
      form, bodyFile: def.grownBody, flowerFile: sticker.decorationAsset, instId: sticker.id,
      widthPx: GARDEN_MAIN_BODY_PX, stickerScale: sticker.scale, flipX: sticker.flipX,
    });
    return `
      <div class="garden-plant" data-id="${sticker.id}" style="left:${sticker.x}%; top:${sticker.y}%; z-index:${sticker.order || 0};">
        ${visual}
        <button type="button" class="garden-plant-remove" data-id="${sticker.id}" aria-label="Entfernen">✕</button>
      </div>
    `;
  }).join('');
  layer.querySelectorAll('.garden-plant').forEach(el => bindGardenPlantDrag(el));
  layer.querySelectorAll('.garden-plant-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeGardenSticker(btn.dataset.id);
    });
  });
}

// Ein Klick in der Palette pflanzt einen Samen ins Anzuchtfeld (nicht mehr
// direkt eine ausgewachsene Pflanze in den Garten, siehe garden.md
// Abschnitt B) — Farbvariante wird sofort fix gewählt und gespeichert. Der
// Sticker-Datensatz entsteht HIER schon vollständig (type/plantId/tags) —
// nur growthStage und das gerenderte Asset ändern sich später beim
// Wachsen, siehe garden.md, Abschnitt "Sticker-Architektur".
function addGardenPlant(plantId) {
  const plant = gardenPlantById(plantId);
  if (!plant) return;
  const variant = gardenPickVariant(plant);
  const sticker = {
    id: crypto.randomUUID(),
    type: 'plant',
    plantId,
    scene: 'nursery',
    x: 12 + Math.random() * 72,
    y: 38 + Math.random() * 32,
    scale: 1,
    flipX: false,
    order: Date.now(),
    growthStage: 'seed',
    decorationAsset: variant.file,
    plantedAt: Date.now(),
  };
  gardenStickers.push(sticker);
  saveGardenStickers();
  registerGardenDiscovery(plant, variant);
  renderGardenNursery();
  startGardenGrowthTicker();
}

function removeGardenSticker(id) {
  gardenStickers = gardenStickers.filter(s => s.id !== id);
  saveGardenStickers();
  renderGardenCanvasPlants();
}

// Aktualisiert das Pflanzendex beim ersten Pflanzen einer Pflanze bzw.
// einer bisher unbekannten Farbvariante — keine Extra-Interaktion nötig.
function registerGardenDiscovery(plant, variant) {
  let entry = gardenDex[plant.id];
  const isNewPlant = !entry;
  if (!entry) entry = gardenDex[plant.id] = { firstSeen: Date.now(), variants: {} };
  const isNewVariant = !entry.variants[variant.variantName];
  if (isNewVariant) entry.variants[variant.variantName] = Date.now();
  if (isNewPlant || isNewVariant) {
    saveGardenDex();
    const suffix = ' — wächst jetzt im Anzuchtfeld';
    showGardenDiscoveryNote((isNewPlant ? `✨ Neu entdeckt: ${plant.label}` : `✨ Neue Farbvariante: ${plant.label}`) + suffix);
  }
}

function showGardenDiscoveryNote(text) {
  const note = document.getElementById('garden-discovery-note');
  if (!note) return;
  note.textContent = text;
  note.classList.remove('hidden');
  note.classList.add('garden-discovery-note-visible');
  clearTimeout(showGardenDiscoveryNote._t);
  showGardenDiscoveryNote._t = setTimeout(() => {
    note.classList.remove('garden-discovery-note-visible');
    setTimeout(() => note.classList.add('hidden'), 400);
  }, 2600);
}

// =========================
// DRAG-TO-MOVE — Pointer Events, prozentuale Position relativ zur Fläche.
// Ein kurzer Klick (kaum Bewegung) zählt nicht als Verschieben, damit das
// spätere Antippen (z. B. für Details) nicht versehentlich verschiebt.
// Gilt für jeden Sticker in #garden-canvas, unabhängig von seinem `type`.
// =========================
function bindGardenPlantDrag(el) {
  const id = el.dataset.id;
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0;

  el.addEventListener('pointerdown', e => {
    if (e.target.closest('.garden-plant-remove')) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add('garden-plant-dragging');
    // Beim Anfassen nach vorn holen (einfacher Layer/Z-Index-Ersatz, siehe
    // Sticker-Eigenschaft `order`) — wirkt sofort optisch, auch wenn nur
    // ein kurzer Klick folgt.
    el.style.zIndex = String(Date.now());
  });

  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) moved = true;
    if (!moved) return;
    const canvas = document.getElementById('garden-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(97, Math.max(3, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(gardenCanvasMaxYPercent(rect), Math.max(5, ((e.clientY - rect.top) / rect.height) * 100));
    el.style.left = x + '%';
    el.style.top = y + '%';
  });

  el.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('garden-plant-dragging');
    const sticker = gardenStickers.find(s => s.id === id);
    if (sticker) {
      sticker.order = Date.now();
      if (moved) {
        sticker.x = parseFloat(el.style.left);
        sticker.y = parseFloat(el.style.top);
      }
      saveGardenStickers();
    }
  });
}

// Oberes/unteres Polster beim Ziehen innerhalb der Garten-Fläche, damit
// eine Pflanze nicht exakt am Bildrand landet. Das Anzuchtfeld ist ein
// eigener Container unterhalb von #garden-canvas (siehe css/garden.css),
// überlappt die Wiese also nicht mehr — kein dynamischer Ausschluss nötig.
function gardenCanvasMaxYPercent() {
  return 95;
}

// =========================
// ANZUCHTFELD & WACHSTUM (garden.md Abschnitt B)
// Neu gepflanzte Samen wachsen sichtbar in Stufen statt fließend zu
// animieren (Designprinzip "Show the moments, not the movement"). Das
// Wachstum läuft über echte verstrichene Zeit seit plantedAt — unabhängig
// davon, ob der Garten gerade geöffnet ist. Dauer ist ein bewusst gewählter
// Startwert, über gardenStageDurations() leicht anpassbar. Samen/Keimling
// zeigen für alle Pflanzen dasselbe img/decor/seed.png bzw. seedling.png,
// "junge Pflanze"/"ausgewachsen" nutzen den pflanzentyp-spezifischen
// Körper aus GARDEN_FORM_DEFS — siehe gardenComposeVisualHTML() oben und
// garden.md, Abschnitt "Pflanzen-Visual: Körper + Blüte/Frucht". Es ist
// NICHT die Wachstumsstufe selbst, die gespeichert wird und dann ein neues
// Objekt erzeugt — derselbe Sticker-Datensatz ändert nur sein
// `growthStage`-Feld (siehe gardenGrowthStage() unten, die diesen Wert
// live aus plantedAt berechnet, statt ihn zu cachen).
// =========================
// durationMs = wie lange DIESE Stufe selbst dauert, bevor zur nächsten
// gewechselt wird (nicht die Gesamtzeit seit dem Pflanzen) — Samen bleibt
// 5 Min. lang Samen, danach 10 Min. lang Keimling, danach 15 Min. lang
// junge Pflanze, macht 30 Min. bis "ausgewachsen" insgesamt. Diese
// Standardwerte gelten nur, solange kein Debug-Override (siehe
// "GARDEN-DEBUG: WACHSTUMSZEITEN" weiter unten) gesetzt ist —
// gardenStageDurations() ist die EINZIGE Stelle, die tatsächlich verwendete
// Dauer liefert, nirgendwo sonst im Code stehen eigene Zeitwerte.
const GARDEN_DEFAULT_DURATIONS_MS = { seed: 5 * 60 * 1000, sprout: 10 * 60 * 1000, young: 15 * 60 * 1000 };

function gardenStageDurations() {
  const d = (typeof gardenDebugDurationsMs !== 'undefined' && gardenDebugDurationsMs) || GARDEN_DEFAULT_DURATIONS_MS;
  return [
    { key: 'seed',   label: 'Samen',         durationMs: d.seed },
    { key: 'sprout', label: 'Keimling',      durationMs: d.sprout },
    { key: 'young',  label: 'Junge Pflanze', durationMs: d.young },
    { key: 'grown',  label: 'Ausgewachsen',  durationMs: Infinity },
  ];
}

// afterMs = Zeitpunkt seit dem Pflanzen, ab dem diese Stufe beginnt — aus
// gardenStageDurations() aufsummiert. Wird bei jedem Aufruf neu berechnet
// (nicht einmalig gecacht), damit ein geänderter Debug-Wert sofort auch für
// bereits laufende Pflanzen greift, nicht nur für neu gepflanzte.
function gardenGrowthStageList() {
  let cumulative = 0;
  return gardenStageDurations().map(s => {
    const stage = { key: s.key, label: s.label, afterMs: cumulative };
    cumulative += s.durationMs;
    return stage;
  });
}

function gardenGrowthStage(plantedAt) {
  const elapsed = Date.now() - plantedAt;
  const stages = gardenGrowthStageList();
  let stage = stages[0];
  for (const s of stages) {
    if (elapsed >= s.afterMs) stage = s;
  }
  return stage;
}

// Verbleibende Zeit bis zur nächsten Wachstumsstufe (0, wenn bereits
// ausgewachsen) — Grundlage für den Countdown über jeder Anzuchtfeld-Pflanze.
function gardenNextStageRemainingMs(plantedAt) {
  const elapsed = Date.now() - plantedAt;
  const next = gardenGrowthStageList().find(s => s.afterMs > elapsed);
  return next ? next.afterMs - elapsed : 0;
}

function gardenFormatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const GARDEN_NURSERY_BODY_PX = 132;
const GARDEN_SEED_PX = 66;
const GARDEN_SEEDLING_PX = 106;

function renderGardenNursery() {
  const layer = document.getElementById('garden-nursery-items');
  if (!layer) return;
  const stickers = gardenStickers.filter(s => s.scene === 'nursery');
  layer.innerHTML = stickers.map(sticker => {
    const stage = gardenGrowthStage(sticker.plantedAt);
    sticker.growthStage = stage.key; // Sticker-Feld folgt live der berechneten Stufe (siehe Dateikopf-Kommentar)
    const plant = gardenPlantById(sticker.plantId);
    const label = plant ? plant.label : '';
    const form = plant ? plant.form : 'flower';
    const def = window.GARDEN_FORM_DEFS[form] || window.GARDEN_FORM_DEFS.flower;
    const hint = stage.key === 'grown' ? ' · zum Einpflanzen nach oben ziehen' : '';
    let content;
    if (stage.key === 'seed') {
      content = `<img class="garden-nursery-seedling" src="img/decor/seed.png" alt="" draggable="false" style="width:${GARDEN_SEED_PX}px;"/>`;
    } else if (stage.key === 'sprout') {
      content = `<img class="garden-nursery-seedling" src="img/decor/seedling.png" alt="" draggable="false" style="width:${GARDEN_SEEDLING_PX}px;"/>`;
    } else if (stage.key === 'young') {
      content = gardenComposeVisualHTML({ form, bodyFile: def.youngBody, flowerFile: null, instId: sticker.id, widthPx: GARDEN_NURSERY_BODY_PX });
    } else {
      content = gardenComposeVisualHTML({ form, bodyFile: def.grownBody, flowerFile: sticker.decorationAsset, instId: sticker.id, widthPx: GARDEN_NURSERY_BODY_PX });
    }
    const remainingMs = gardenNextStageRemainingMs(sticker.plantedAt);
    const countdown = remainingMs > 0
      ? `<div class="garden-nursery-countdown">${gardenFormatCountdown(remainingMs)}</div>`
      : '';
    return `
      <div class="garden-nursery-item garden-nursery-stage-${stage.key}" data-id="${sticker.id}" style="left:${sticker.x}%; top:${sticker.y}%;" title="${gardenEsc(label)} · ${stage.label}${hint}">
        ${countdown}
        ${content}
      </div>
    `;
  }).join('');
  layer.querySelectorAll('.garden-nursery-stage-grown').forEach(el => bindGardenNurseryDrag(el));
}

// Nur ausgewachsene Anzuchtfeld-Einträge sind ziehbar. Loslassen innerhalb
// der Garten-Fläche pflanzt die Pflanze an dieser Stelle um — dabei wird
// NICHT der Sticker-Datensatz gelöscht und neu erzeugt, sondern nur sein
// `scene`-Feld von "nursery" auf "canvas" umgestellt (siehe
// transplantGardenNurseryItem() unten und garden.md, "Sticker-
// Architektur"). Loslassen im Anzuchtfeld selbst tut nichts.
function bindGardenNurseryDrag(el) {
  const id = el.dataset.id;
  let dragging = false;
  let startX = 0, startY = 0;

  el.addEventListener('pointerdown', e => {
    dragging = true;
    // Verhindert, dass der 1s-Wachstums-Tick das Anzuchtfeld währenddessen
    // neu rendert und damit das gerade gezogene Element unter der Hand
    // wegzieht (siehe startGardenGrowthTicker()).
    _gardenNurseryDragActive = true;
    startX = e.clientX;
    startY = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add('garden-nursery-dragging');
  });

  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });

  el.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    _gardenNurseryDragActive = false;
    el.classList.remove('garden-nursery-dragging');
    el.style.transform = 'translate(-50%, -50%)';

    // Anzuchtfeld und Garten-Fläche sind seit garden1.png/"cultivation
    // plot.png" (siehe garden.md) zwei getrennte Container mit Abstand
    // dazwischen — "innerhalb der Wiese" reicht als einziger Test, ein
    // Überlappungsfall mit dem Anzuchtfeld kann nicht mehr vorkommen.
    const canvas = document.getElementById('garden-canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const insideCanvas = e.clientX >= canvasRect.left && e.clientX <= canvasRect.right &&
                          e.clientY >= canvasRect.top && e.clientY <= canvasRect.bottom;

    if (insideCanvas) transplantGardenNurseryItem(id, canvasRect, e.clientX, e.clientY);
    else renderGardenNursery();
  });
}

function transplantGardenNurseryItem(id, canvasRect, clientX, clientY) {
  const sticker = gardenStickers.find(s => s.id === id);
  if (!sticker) return;
  sticker.scene = 'canvas';
  sticker.x = Math.min(97, Math.max(3, ((clientX - canvasRect.left) / canvasRect.width) * 100));
  sticker.y = Math.min(gardenCanvasMaxYPercent(canvasRect), Math.max(5, ((clientY - canvasRect.top) / canvasRect.height) * 100));
  sticker.order = Date.now();
  saveGardenStickers();
  renderGardenCanvasPlants();
  renderGardenNursery();
}

// Aktualisiert das Anzuchtfeld einmal pro Sekunde, solange etwas noch
// wächst und die Garten-Unteransicht aktiv ist — nötig für den laufenden
// Countdown über jeder Anzuchtfeld-Pflanze. Läuft automatisch aus, sobald
// alles ausgewachsen ist oder die Ansicht verlassen wird.
let _gardenGrowthTicker = null;
let _gardenNurseryDragActive = false;
function startGardenGrowthTicker() {
  clearInterval(_gardenGrowthTicker);
  const nurserySticker = () => gardenStickers.filter(s => s.scene === 'nursery');
  if (!nurserySticker().some(p => gardenGrowthStage(p.plantedAt).key !== 'grown')) return;
  _gardenGrowthTicker = setInterval(() => {
    if (typeof currentView !== 'undefined' && (currentView !== 'garden' || gardenActiveSubtab !== 'garden')) {
      clearInterval(_gardenGrowthTicker);
      return;
    }
    if (!nurserySticker().some(p => gardenGrowthStage(p.plantedAt).key !== 'grown')) {
      clearInterval(_gardenGrowthTicker);
    }
    // Nicht neu rendern, während der Nutzer gerade eine ausgewachsene
    // Pflanze aus dem Anzuchtfeld zieht — sonst würde das Innerhtml-Update
    // das gezogene Element mitten in der Geste ersetzen (siehe
    // bindGardenNurseryDrag()).
    if (!_gardenNurseryDragActive) renderGardenNursery();
  }, 1000);
}

// =========================
// PFLANZENSTAND — Drop-Zone für optionale Gartenrätsel (garden.md,
// Abschnitt "Pflanzenstand"). KEIN zweites Lager, sondern reine
// Quest-Anzeige+Drop-Ziel: Sticker werden per Ziehen aus der Palette
// (bindGardenTrayItem() oben) direkt hier erzeugt, nicht aus dem
// Anzuchtfeld verschoben. Prüfung läuft ausschließlich über
// gardenStickerTags() — der Pflanzenstand kennt keine Pflanzen-Sonderfälle,
// nur Tags. Dieselbe Prüfung funktioniert für jeden künftigen Sticker-Typ
// (Deko, Bären-Plüschtier, ...), sobald es dafür Katalog-Einträge gibt.
// =========================
function gardenActiveQuest() {
  return window.GARDEN_QUESTS.find(q => q.id === gardenQuestState?.activeQuestId) || window.GARDEN_QUESTS[0];
}

function startNewGardenQuest() {
  const pool = window.GARDEN_QUESTS.filter(q => q.id !== gardenQuestState?.activeQuestId);
  const list = pool.length ? pool : window.GARDEN_QUESTS;
  const next = list[Math.floor(Math.random() * list.length)];
  gardenQuestState = { activeQuestId: next.id, filled: new Array(next.slots.length).fill(null) };
  saveGardenQuestState();
}

function renderGardenStand() {
  const el = document.getElementById('garden-stand');
  if (!el) return;
  if (!gardenQuestState || !window.GARDEN_QUESTS.find(q => q.id === gardenQuestState.activeQuestId)) {
    startNewGardenQuest();
  }
  const quest = gardenActiveQuest();
  const slotsHTML = quest.slots.map((slot, i) => {
    const stickerId = gardenQuestState.filled[i];
    const sticker = stickerId ? gardenStickers.find(s => s.id === stickerId) : null;
    if (sticker) {
      const plant = gardenPlantById(sticker.plantId);
      return `<div class="garden-stand-slot garden-stand-slot-filled" title="${gardenEsc(plant ? plant.label : '')}"><img src="img/decor/${sticker.decorationAsset}" alt=""/></div>`;
    }
    return `<div class="garden-stand-slot" title="${gardenEsc(slot.hint)}"><span>?</span></div>`;
  }).join('');
  el.innerHTML = `
    <div class="garden-stand-content">
      <div class="garden-stand-head">🌻 Pflanzenstand</div>
      <div class="garden-stand-quest">${gardenEsc(quest.hint)}</div>
      <div class="garden-stand-slots" id="garden-stand-slots">${slotsHTML}</div>
    </div>
  `;
}

// Sucht den ersten noch offenen Rätsel-Slot, dessen Tag zu den Tags dieser
// Pflanze passt (siehe gardenTagsForVariant()) — findet sich keiner, wird
// nichts erzeugt und der Nutzer bekommt eine kurze Rückmeldung. Die
// Farbvariante wird VOR der Tag-Prüfung gewürfelt (nicht danach), da
// variantenspezifische Tags (Farbe, "shiny") sonst nie geprüft werden
// könnten. Passt es, entsteht hier ein neuer Sticker direkt mit
// scene:"stand" (siehe Dateikopf: Ziehen aus der Palette erzeugt den
// Sticker am Zielort, nicht im Anzuchtfeld — der Pflanzenstand ist kein
// Wachstumsort).
function tryFulfillGardenQuestSlot(plantId) {
  const plant = gardenPlantById(plantId);
  if (!plant || !gardenQuestState) return;
  const quest = gardenActiveQuest();
  const variant = gardenPickVariant(plant);
  const tags = gardenTagsForVariant(plant, variant.file);
  const openIdx = quest.slots.findIndex((slot, i) => !gardenQuestState.filled[i] && tags.includes(slot.tag));
  if (openIdx === -1) {
    showGardenDiscoveryNote('✋ Passt gerade nicht zum Pflanzenstand');
    return;
  }
  const sticker = {
    id: crypto.randomUUID(),
    type: 'plant',
    plantId,
    scene: 'stand',
    x: 0, y: 0, scale: 1, flipX: false, order: Date.now(),
    growthStage: 'grown',
    decorationAsset: variant.file,
    plantedAt: Date.now(),
  };
  gardenStickers.push(sticker);
  gardenQuestState.filled[openIdx] = sticker.id;
  saveGardenStickers();
  saveGardenQuestState();
  registerGardenDiscovery(plant, variant);
  showGardenDiscoveryNote(`✅ ${plant.label} passt in den Pflanzenstand!`);
  renderGardenStand();
  if (gardenQuestState.filled.every(Boolean)) setTimeout(completeGardenQuest, 1400);
}

function completeGardenQuest() {
  const doneIds = gardenQuestState.filled.filter(Boolean);
  gardenStickers = gardenStickers.filter(s => !doneIds.includes(s.id));
  saveGardenStickers();
  showGardenDiscoveryNote('🌟 Gartenrätsel gelöst!');
  startNewGardenQuest();
  renderGardenStand();
}

// =========================
// GARTEN-DEBUG: WACHSTUMSZEITEN (vorübergehendes Debug-Werkzeug)
// Reines Test-/QA-Werkzeug, kein Teil des eigentlichen Gartens (siehe
// garden-debug-* Markup in index.html, klar als "Debug" gekennzeichnet,
// per Default eingeklappt). Schreibt ausschließlich gardenDebugDurationsMs
// (oben), von dem gardenStageDurations() als EINZIGER Quelle liest — keine
// Wachstumszeit ist irgendwo sonst im Code hart codiert. Weil die
// Wachstumsstufe bei jedem Render live aus plantedAt + aktueller Dauer
// berechnet wird (siehe gardenGrowthStage()), wirkt eine Änderung hier
// automatisch sofort auch auf bereits laufende Pflanzen — ein separater
// "auf laufende Pflanzen anwenden"-Knopf wäre reine Attrappe und ist
// deshalb bewusst weggelassen.
// =========================
function gardenMsToUnit(ms) {
  if (ms % 60000 === 0) return { value: ms / 60000, unit: 'm' };
  return { value: Math.max(1, Math.round(ms / 1000)), unit: 's' };
}
function gardenUnitToMs(value, unit) {
  const n = Math.max(1, Math.round(Number(value) || 1));
  return unit === 'm' ? n * 60 * 1000 : n * 1000;
}

function renderGardenDebugPanel() {
  const d = gardenDebugDurationsMs || GARDEN_DEFAULT_DURATIONS_MS;
  ['seed', 'sprout', 'young'].forEach(key => {
    const { value, unit } = gardenMsToUnit(d[key]);
    const valueInput  = document.getElementById(`garden-debug-${key}-value`);
    const unitSelect  = document.getElementById(`garden-debug-${key}-unit`);
    if (valueInput) valueInput.value = value;
    if (unitSelect) unitSelect.value = unit;
  });
}

function applyGardenDebugDurations() {
  gardenDebugDurationsMs = {
    seed:   gardenUnitToMs(document.getElementById('garden-debug-seed-value').value,   document.getElementById('garden-debug-seed-unit').value),
    sprout: gardenUnitToMs(document.getElementById('garden-debug-sprout-value').value, document.getElementById('garden-debug-sprout-unit').value),
    young:  gardenUnitToMs(document.getElementById('garden-debug-young-value').value,  document.getElementById('garden-debug-young-unit').value),
  };
  saveGardenDebugDurations();
  renderGardenNursery();
  startGardenGrowthTicker();
}

function resetGardenDebugDurations() {
  gardenDebugDurationsMs = null;
  saveGardenDebugDurations();
  renderGardenDebugPanel();
  renderGardenNursery();
  startGardenGrowthTicker();
}

function initGardenDebugPanel() {
  const toggle = document.getElementById('garden-debug-toggle');
  const panel  = document.getElementById('garden-debug-panel');
  if (toggle && !toggle._gardenDebugBound) {
    toggle._gardenDebugBound = true;
    toggle.addEventListener('click', () => {
      const opening = panel.classList.contains('hidden');
      panel.classList.toggle('hidden');
      if (opening) renderGardenDebugPanel();
    });
  }
  const applyBtn = document.getElementById('garden-debug-apply');
  if (applyBtn && !applyBtn._gardenDebugBound) {
    applyBtn._gardenDebugBound = true;
    applyBtn.addEventListener('click', applyGardenDebugDurations);
  }
  const resetBtn = document.getElementById('garden-debug-reset');
  if (resetBtn && !resetBtn._gardenDebugBound) {
    resetBtn._gardenDebugBound = true;
    resetBtn.addEventListener('click', resetGardenDebugDurations);
  }
}

// =========================
// PFLANZENDEX
// =========================
function renderGardenDex() {
  const grid = document.getElementById('garden-dex-grid');
  if (!grid) return;
  grid.innerHTML = window.GARDEN_CATALOG.map(plant => {
    const entry = gardenDex[plant.id];
    if (!entry) {
      return `
        <div class="garden-dex-tile garden-dex-tile-unknown">
          <div class="garden-dex-thumb">???</div>
          <div class="garden-dex-label">???</div>
        </div>
      `;
    }
    const seenCount = Object.keys(entry.variants).length;
    const totalCount = plant.variants.length;
    const thumbFile = plant.variants.find(v => entry.variants[v.variantName])?.file || plant.variants[0].file;
    const firstSeenDate = fmt(new Date(entry.firstSeen), { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `
      <div class="garden-dex-tile">
        <div class="garden-dex-thumb"><img src="img/decor/${thumbFile}" alt=""/></div>
        <div class="garden-dex-label">${gardenEsc(plant.label)}</div>
        <div class="garden-dex-meta">
          ${totalCount > 1 ? `<span>${seenCount}/${totalCount} Varianten</span>` : ''}
          <span>seit ${firstSeenDate}</span>
        </div>
      </div>
    `;
  }).join('');
}
