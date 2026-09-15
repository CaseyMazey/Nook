// =========================
// PROJEKTWALD — forest.js
// =========================

// Wald-Übersicht: Tab/Such/Prioritäts-Filter — reiner Anzeigefilter,
// beeinflusst weder Archivstatus noch Projektdaten. Bewusst nicht in DB
// persistiert (Ansichtsfilter, kein Projektzustand).
let forestFilterTab      = 'all';   // 'all' | 'active' | 'archived'
let forestSearchQuery    = '';
let forestPriorityFilter = '';      // '' | 'Niedrig' | 'Mittel' | 'Hoch'
// Aktuelle Waldseite (0-basiert) — max. FOREST_SLOTS.length Projekte pro
// Seite, ebenfalls reiner Anzeigezustand, nicht persistiert. Wird bei jeder
// Änderung der gefilterten Liste (Tab/Suche/Priorität) auf 0 zurückgesetzt.
let forestPage = 0;

// =================================================
// BAUMRENDERING -> ausgelagert in project-tree.js
// Verfuegbare Funktionen:
//   updateDetailTreeElements(project)  -> rendert den PNG-Baum + Äpfel/Blüten
//                                          in #proj-detail-tree
//   getOrAssignTreeVariant(project)    -> 1..TREE_PNG_COUNT, dieselbe Variante
//                                          wie im Projektwald (buildForestTree())
// Sowohl der kleine Waldbaum als auch der große Detailbaum sind PNGs
// (img/trees/tree_<n>.png / tree_<n>_fall.png) — keine generierte
// SVG-Baumstruktur mehr.
// =================================================


// =========================
// WALD-POSITIONEN (fest vordefinierte Tiefenebenen, nach Skizze)
// Erst Position, dann Größe: jedes Projekt wird zuerst einer festen Reihe
// (Tiefenebene) zugeordnet; Reihe -> Y-Position + horizontaler Baumabstand
// innerhalb der Reihe; daraus abgeleitet erst die Skalierung. Keine
// Zufallspositionen — die Reihen sind bewusst als feste, deterministische
// Perspektivebenen angelegt (hinten klein & eng, vorne groß & weit
// auseinander), damit die Waldansicht kontrolliert/konsistent bleibt.
// =========================
const FOREST_ROW_COUNTS = [3, 4, 3, 4]; // hinterste -> vorderste Reihe

function generateForestSlots(rowCounts) {
  // minY/maxY sind die Top-Kante des jeweils *größten* (untersten) bzw.
  // *kleinsten* (obersten) Baums. #project-forest hat overflow:hidden, daher
  // muss maxY so gewählt sein, dass Bild + Karte der untersten (größten,
  // am stärksten skalierten) Reihe noch komplett vor dem unteren Rand/der
  // Legende endet.
  const minY = 18, maxY = 66;
  const rows = rowCounts.length;

  // Je Tiefe (0 = hinterste Reihe, 1 = vorderste Reihe):
  //  - scale: kleinste -> größte Baumgröße
  //  - gap:   Abstand zwischen benachbarten Baummitten einer Reihe, in %
  //           Containerbreite. Wächst linear mit der Tiefe -> die vorderste
  //           Reihe wird NICHT gleichmäßig über die volle Breite verteilt,
  //           sondern bekommt bewusst die größten Lücken (viel sichtbare
  //           Landschaft zwischen den Vordergrundbäumen), während hintere
  //           Reihen enger zusammenrücken.
  const SCALE_MIN = 0.75, SCALE_MAX = 1.5;
  // GAP_MIN etwas größer als zuvor (an die um 10% größeren Bäume angepasst).
  // GAP_MAX ist NICHT einfach proportional mitgewachsen: bei 4 Bäumen in der
  // vordersten (größten) Reihe würde das den äußersten Baum über den Rand
  // von #project-forest hinausschieben (abgeschnitten). 27 ist der größte
  // Wert, bei dem der äußerste Vordergrundbaum bei aktueller Skalierung noch
  // vollständig im Container sichtbar bleibt.
  const GAP_MIN    = 22, GAP_MAX   = 27;
  const CENTER_X   = 50;

  const slots = [];
  rowCounts.forEach((count, rowIdx) => {
    const depth = rows === 1 ? 1 : rowIdx / (rows - 1);
    const y     = rows === 1 ? minY : minY + rowIdx * (maxY - minY) / (rows - 1);
    const scale = SCALE_MIN + depth * (SCALE_MAX - SCALE_MIN);
    const gap   = GAP_MIN   + depth * (GAP_MAX   - GAP_MIN);

    // Reihe um die Mitte zentrieren, Bäume im festen Abstand `gap` daneben
    // aufreihen -> ergibt zusammen mit dem wachsenden Abstand von selbst
    // das versetzte (Quincunx-artige) Muster der Skizze, ganz ohne Zufall.
    const rowSpan = (count - 1) * gap;
    const startX  = CENTER_X - rowSpan / 2;
    for (let col = 0; col < count; col++) {
      const x = startX + col * gap;
      slots.push({ x, y, depth, scale });
    }
  });
  return slots;
}

const FOREST_SLOTS = generateForestSlots(FOREST_ROW_COUNTS);

// =========================
// FILTER / TABS / SUCHE
// =========================
function projectMatchesForestFilter(p) {
  if (forestFilterTab === 'active'   && p.archived)  return false;
  if (forestFilterTab === 'archived' && !p.archived) return false;
  if (forestPriorityFilter && (p.priority || 'Mittel') !== forestPriorityFilter) return false;
  if (forestSearchQuery && !p.name.toLowerCase().includes(forestSearchQuery)) return false;
  return true;
}
function getFilteredForestProjects() {
  return projects.filter(projectMatchesForestFilter);
}

function updateForestTabCounts() {
  const elAll      = document.getElementById('forest-tab-count-all');
  const elActive   = document.getElementById('forest-tab-count-active');
  const elArchived = document.getElementById('forest-tab-count-archived');
  if (elAll)      elAll.textContent      = `(${projects.length})`;
  if (elActive)   elActive.textContent   = `(${projects.filter(p => !p.archived).length})`;
  if (elArchived) elArchived.textContent = `(${projects.filter(p =>  p.archived).length})`;
}

function setForestTab(tab) {
  forestFilterTab = tab;
  forestPage = 0;
  ['all', 'active', 'archived'].forEach(t => {
    const btn = document.getElementById(`forest-tab-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  renderForest();
}

document.getElementById('forest-tab-all')?.addEventListener('click', () => setForestTab('all'));
document.getElementById('forest-tab-active')?.addEventListener('click', () => setForestTab('active'));
document.getElementById('forest-tab-archived')?.addEventListener('click', () => setForestTab('archived'));

document.getElementById('forest-search-input')?.addEventListener('input', e => {
  forestSearchQuery = e.target.value.trim().toLowerCase();
  forestPage = 0;
  renderForest();
});

document.getElementById('forest-filter-btn')?.addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('forest-filter-panel')?.classList.toggle('hidden');
});
document.addEventListener('click', e => {
  const panel = document.getElementById('forest-filter-panel');
  const btn   = document.getElementById('forest-filter-btn');
  if (panel && !panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== btn) {
    panel.classList.add('hidden');
  }
});
document.querySelectorAll('#forest-filter-panel [data-prio]').forEach(btn => {
  btn.addEventListener('click', () => {
    forestPriorityFilter = btn.dataset.prio;
    forestPage = 0;
    document.querySelectorAll('#forest-filter-panel [data-prio]').forEach(b => b.classList.toggle('active', b === btn));
    renderForest();
  });
});

// =========================
// MOBILE-RASTERANSICHT — eigenes Layout statt Desktop-Lichtungen
// Unter MOBILE_FOREST_BREAKPOINT (muss mit dem @media-Wert für
// .forest-grid-mobile in projects.css übereinstimmen) lässt sich die feste
// Baum/Lichtung-Zuordnung der Desktop-Ansicht (FOREST_SLOTS) nicht mehr
// gleichzeitig mit einer bedienbaren Toolbar UND zuverlässig anklickbaren
// Bäumen halten (mehrfach ausprobiert — Bäume verkleinern lässt sie zu
// klein zum Antippen werden, Bäume verschieben zerstört die Lichtungen-
// Zuordnung, Toolbar überlappt sonst die vorderen Baumreihen). Ab dieser
// Breite bekommt der Wald deshalb bewusst ein eigenes, einfaches
// 2-Spalten-Raster (siehe .forest-grid-mobile), das vertikal scrollt statt
// alle 14 Bäume ins Fenster zu quetschen. Desktop/Tablet bleiben
// unverändert bei der Lichtungen-Positionierung.
// =========================
const MOBILE_FOREST_BREAKPOINT = 480;
function isMobileForestLayout() {
  return window.matchMedia(`(max-width: ${MOBILE_FOREST_BREAKPOINT}px)`).matches;
}

// =========================
// ARCHIV-/NEUES-PROJEKT-BUTTONS — MOBIL NEBEN DEN PRIORITÄTSFILTER
// #project-archive-btn/#add-project-btn leben nur einmal im DOM (gleiches
// Umhäng-Muster wie placePdtInfoCard() unten bzw. placeSidebarWidgets() in
// main.js) und wandern unter MOBILE_FOREST_BREAKPOINT aus der Titelzeile
// (.forest-overlay-header-row) in die Toolbar neben den Prioritäts-
// Filter-Button (.forest-filter-wrap) — dort werden sie zu reinen
// Icon-Buttons (.forest-action-icon-btn, Text durch Icon/„+" ersetzt).
// Grund: In der Titelzeile mussten sie bei schmalen Breiten neben den
// langen Titel umbrechen (flex-wrap) — in genau diesem umgebrochenen
// Zustand rendert Chrome die Buttons nicht (Layout/Klickbarkeit korrekt,
// aber unsichtbar). Als kompakte Icons neben dem Filter-Button passen sie
// dagegen immer in eine Zeile, der Umbruch (und damit der Render-Bug)
// entfällt komplett. Farben bleiben unverändert (.btn-ghost/.btn-primary),
// nur Größe/Inhalt ändern sich. Auf Desktop bleiben Ort + Text exakt wie
// im ursprünglichen Markup (index.html).
// =========================
const FOREST_ARCHIVE_ICON_HTML = '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 2.2a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v2.3H1V2.2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="1.5" y="4.5" width="12" height="8.5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><path d="M5.8 7.9h3.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const FOREST_ARCHIVE_DESKTOP_HTML = '⊘ Archiv';
const FOREST_ADD_ICON_HTML = '+';
const FOREST_ADD_DESKTOP_HTML = '+ Neues Projekt';

const forestActionsMobileQuery = window.matchMedia(`(max-width: ${MOBILE_FOREST_BREAKPOINT}px)`);
function placeForestActionButtons(isMobile) {
  const archiveBtn  = document.getElementById('project-archive-btn');
  const addBtn      = document.getElementById('add-project-btn');
  const actionsSlot = document.getElementById('forest-overlay-actions-slot');
  const toolbarRight = document.querySelector('.forest-toolbar-right');
  const filterWrap   = document.querySelector('.forest-filter-wrap');
  if (!archiveBtn || !addBtn || !actionsSlot || !toolbarRight || !filterWrap) return;

  if (isMobile) {
    archiveBtn.innerHTML = FOREST_ARCHIVE_ICON_HTML;
    archiveBtn.title = 'Archiv';
    addBtn.innerHTML = FOREST_ADD_ICON_HTML;
    addBtn.title = 'Neues Projekt';
    archiveBtn.classList.add('forest-action-icon-btn');
    addBtn.classList.add('forest-action-icon-btn');
    toolbarRight.insertBefore(archiveBtn, filterWrap);
    toolbarRight.insertBefore(addBtn, filterWrap);
  } else {
    archiveBtn.innerHTML = FOREST_ARCHIVE_DESKTOP_HTML;
    archiveBtn.removeAttribute('title');
    addBtn.innerHTML = FOREST_ADD_DESKTOP_HTML;
    addBtn.removeAttribute('title');
    archiveBtn.classList.remove('forest-action-icon-btn');
    addBtn.classList.remove('forest-action-icon-btn');
    // Ursprüngliche Reihenfolge aus index.html: Archiv vor "Neues Projekt".
    actionsSlot.appendChild(archiveBtn);
    actionsSlot.appendChild(addBtn);
  }
}
placeForestActionButtons(forestActionsMobileQuery.matches);
forestActionsMobileQuery.addEventListener('change', e => placeForestActionButtons(e.matches));

// =========================
// WALDBAUM-KARTE (PNG-Baum + Projektkarte)
// slot === null -> Mobile-Raster: Position/Größe kommt vollständig aus CSS
// (.forest-grid-mobile), keine Lichtungen-Zuordnung auf diesen Breiten.
// =========================
function buildForestTree(project, slot, containerWidth) {
  const stats      = getProjectStats(project);
  const totalTasks = stats.coreTasks.length + stats.subTotal;
  const doneTasks  = stats.coreDone + stats.subDone;
  const pct        = totalTasks === 0 ? 0 : Math.round(doneTasks / totalTasks * 100);
  const isDone     = !!project.archived;
  const variant    = getOrAssignTreeVariant(project);
  const season     = isDone ? '_fall' : '';
  const primarySrc  = `img/trees/tree_${variant}${season}.png`;
  const fallbackSrc = `img/trees/tree_1${season}.png`;

  const wrap = document.createElement('div');
  wrap.className = 'forest-tree-wrap' + (isDone ? ' archived' : '');
  if (slot) {
    // Baumgröße relativ zur tatsächlichen Container-Breite (nicht fix in px) —
    // #project-forest kann je nach Viewport-Höhe schrumpfen (siehe projects.css),
    // die Bäume sollen dabei proportional mitschrumpfen statt zu überlappen.
    const widthPx = Math.round(containerWidth * 0.1132 * slot.scale);
    wrap.style.cssText = `left:${slot.x}%;top:${slot.y}%;width:${widthPx}px;z-index:${10 + Math.round(slot.depth * 40)};`;
  }

  const img = document.createElement('img');
  img.className = 'forest-tree-img';
  img.src = primarySrc;
  img.alt = project.name;
  img.draggable = false;
  img.addEventListener('error', () => {
    if (!img.src.endsWith(fallbackSrc)) img.src = fallbackSrc;
  }, { once: true });

  const dot = document.createElement('span');
  dot.className = 'forest-tree-dot';
  dot.style.background = isDone ? '#d97706' : '#16a34a';

  const nameEl = document.createElement('span');
  nameEl.className = 'forest-tree-name';
  nameEl.textContent = project.name;

  const topRow = document.createElement('div');
  topRow.className = 'forest-tree-card-top';
  topRow.append(dot, nameEl);

  const bar = document.createElement('div');
  bar.className = 'forest-tree-bar';
  const fill = document.createElement('div');
  fill.className = 'forest-tree-bar-fill';
  fill.style.width = pct + '%';
  if (isDone) fill.style.background = '#d97706';
  bar.appendChild(fill);

  const pctLabel = document.createElement('span');
  pctLabel.className = 'forest-tree-pct';
  pctLabel.textContent = `${pct}%`;

  const progressRow = document.createElement('div');
  progressRow.className = 'forest-tree-progress';
  progressRow.append(bar, pctLabel);

  const card = document.createElement('div');
  card.className = 'forest-tree-card';
  card.append(topRow, progressRow);

  const subCount = (project.subprojects || []).length;
  const hoverInfo = document.createElement('div');
  hoverInfo.className = 'forest-tree-hover-info';
  hoverInfo.innerHTML = `
    <strong>${escapeXml(project.name)}</strong>
    <span>${doneTasks} / ${totalTasks} Aufgaben · ${pct}%</span>
    <span>${subCount} Unterprojekt${subCount === 1 ? '' : 'e'}</span>
  `;

  wrap.append(img, card, hoverInfo);
  wrap.addEventListener('click', () => openProjectDetail(project.id));

  return wrap;
}

// =========================
// WALD RENDERN
// Rendert NUR in #forest-trees-layer — Hintergrundbild, Overlay-Header
// (Titel/Tabs/Suche/Filter) und Legende sind statisches HTML und bleiben
// beim Neurendern unangetastet stehen.
//
// WICHTIG: Die Slot-Positionen (FOREST_SLOTS) sind fest auf die
// Lichtungen im Hintergrundbild (img/forest/forest.png) abgestimmt — die
// Baum-Ebene der DESKTOP/TABLET-Ansicht darf deshalb nie verschoben/
// skaliert werden. Unter MOBILE_FOREST_BREAKPOINT wird stattdessen
// komplett auf das Lichtungen-Layout verzichtet und ein eigenes,
// scrollbares 2-Spalten-Raster gerendert (siehe isMobileForestLayout()
// oben + .forest-grid-mobile in projects.css).
// =========================
function renderForest() {
  const container = document.getElementById('project-forest');
  const layer     = document.getElementById('forest-trees-layer');
  if (!container || !layer) return;
  layer.innerHTML = '';

  const mobileGrid = isMobileForestLayout();
  layer.classList.toggle('forest-grid-mobile', mobileGrid);

  // #project-forest-wrap ist auf Mobile (≤480px) der Scroll-Viewport
  // (overflow-y:auto, siehe projects.css) — dessen Kopfzeile (Titel +
  // Archiv/Neues-Projekt-Buttons, .forest-overlay-top) steht als erstes
  // Element normal im Fluss und müsste bei scrollTop 0 daher immer
  // vollständig sichtbar sein. Reale Mobilbrowser können die Scroll-
  // Position aber unabhängig davon verschieben (z.B. beim Ein-/Ausblenden
  // der Adressleiste, direkt nach dem Öffnen der View, oder wenn während
  // des Renderns noch Bildhöhen nachträglich einlaufen, NACHDEM diese
  // Funktion schon fertig ist) — die Buttons rutschen dadurch unter den
  // oberen Rand. scrollTop hier sowohl sofort als auch nach dem nächsten
  // Layout/Paint (doppeltes rAF) explizit auf 0 zu erzwingen behebt das
  // unabhängig von der genauen Ursache; auf Desktop ist #project-forest-wrap
  // gar nicht scrollbar, die Zeilen sind dort ein No-Op.
  const forestWrap = document.getElementById('project-forest-wrap');
  if (forestWrap) {
    forestWrap.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => { forestWrap.scrollTop = 0; }));
  }

  updateForestTabCounts();

  if (projects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'forest-empty';
    empty.innerHTML = 'Dein Wald ist noch leer.<br><button type="button" class="forest-empty-add-btn" id="forest-empty-add-btn">+ Neues Projekt</button>';
    layer.appendChild(empty);
    document.getElementById('forest-empty-add-btn')?.addEventListener('click', () => openProjectModal());
    renderForestPager(0);
    return;
  }

  const filtered = getFilteredForestProjects();
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'forest-empty';
    empty.textContent = 'Keine Projekte gefunden.';
    layer.appendChild(empty);
    renderForestPager(0);
    return;
  }

  // Max. FOREST_SLOTS.length (14) Bäume gleichzeitig sichtbar — sowohl in
  // der Desktop-Lichtungen-Anordnung als auch im Mobile-Raster (7 Reihen
  // x 2 Spalten dort). Überzählige Projekte landen auf weiteren
  // Waldseiten/-stücken statt optisch überlappend gequetscht zu werden.
  const pageSize = FOREST_SLOTS.length;
  const containerWidth = container.clientWidth || 1200;

  if (mobileGrid) {
    // Mobile-Raster: reine scrollende Liste, keine feste Lichtung pro
    // Projekt nötig — Filter dürfen die Liste hier ganz normal neu anordnen
    // (kein "Platz"-Konzept wie in der Desktop-Waldansicht unten).
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (forestPage >= totalPages) forestPage = totalPages - 1;
    if (forestPage < 0) forestPage = 0;
    const pageItems = filtered.slice(forestPage * pageSize, forestPage * pageSize + pageSize);
    pageItems.forEach(project => layer.appendChild(buildForestTree(project, null, containerWidth)));
    renderForestPager(totalPages);
  } else {
    // Desktop/Tablet-Lichtungen: jedes Projekt bekommt seinen Slot nach der
    // festen Position im UNGEFILTERTEN `projects`-Array, nicht nach Position
    // in der gefilterten Liste — sonst rutschen beim Wechseln von Tab/Suche/
    // Priorität alle sichtbaren Bäume in neue Plätze, weil sich ihr Index in
    // der gefilterten Liste ändert. Mit fester Zuordnung bleibt jedes
    // Projekt an "seinem" Platz; ausgefilterte Projekte lassen ihren Platz
    // einfach leer statt dass Nachbarn nachrücken. Seitenzahl richtet sich
    // deshalb ebenfalls nach der GESAMTEN Projektliste, nicht nach der
    // gefilterten — ein Filter zeigt dadurch ggf. eine dünner besetzte Seite,
    // statt Projekte auf eine andere Seite zu verschieben.
    const totalPages = Math.max(1, Math.ceil(projects.length / pageSize));
    if (forestPage >= totalPages) forestPage = totalPages - 1;
    if (forestPage < 0) forestPage = 0;
    const startGlobal = forestPage * pageSize;
    projects.slice(startGlobal, startGlobal + pageSize).forEach((project, slotIdx) => {
      if (!projectMatchesForestFilter(project)) return; // Platz bleibt leer, Nachbarn bleiben stehen
      layer.appendChild(buildForestTree(project, FOREST_SLOTS[slotIdx], containerWidth));
    });
    renderForestPager(totalPages);
  }
}

// =========================
// WALD-SEITEN-NAVIGATION (max. 14 Bäume/Seite)
// Dezente Pfeile an den Rändern (nur sichtbar, wenn es eine weitere/vorige
// Seite gibt) + Punkt-Indikatoren, damit man auch bei mehr als 14 Projekten
// weiß, wie viele Waldstücke es gibt und auf welchem man gerade steht —
// ohne dass daraus eine klassische Seitenzahl-/Tabellen-Paginierung wird.
// =========================
function renderForestPager(totalPages) {
  const prevBtn = document.getElementById('forest-page-prev');
  const nextBtn = document.getElementById('forest-page-next');
  const dotsEl  = document.getElementById('forest-page-dots');
  if (!prevBtn || !nextBtn || !dotsEl) return;

  prevBtn.style.display = (totalPages > 1 && forestPage > 0) ? '' : 'none';
  nextBtn.style.display = (totalPages > 1 && forestPage < totalPages - 1) ? '' : 'none';

  dotsEl.innerHTML = '';
  if (totalPages > 1) {
    for (let i = 0; i < totalPages; i++) {
      const dot = document.createElement('span');
      dot.className = 'forest-page-dot' + (i === forestPage ? ' active' : '');
      dotsEl.appendChild(dot);
    }
  }
}

function goForestPage(dir) {
  forestPage += dir;
  const layer = document.getElementById('forest-trees-layer');
  const bg    = document.querySelector('.forest-bg-img');
  if (layer) {
    layer.classList.add('forest-page-transition');
    // Kleiner Landschafts-Schwenk (dasselbe Bild, nur minimal verschoben) —
    // soll das Gefühl "weiter nach links/rechts schauen" erzeugen, ohne ein
    // eigenes zweites Hintergrundbild pro Waldseite zu brauchen.
    if (bg) bg.style.transform = `translateX(${dir > 0 ? '-1.5%' : '1.5%'})`;
    setTimeout(() => {
      renderForest();
      layer.classList.remove('forest-page-transition');
      if (bg) bg.style.transform = '';
    }, 180);
  } else {
    renderForest();
  }
}

document.getElementById('forest-page-prev')?.addEventListener('click', () => goForestPage(-1));
document.getElementById('forest-page-next')?.addEventListener('click', () => goForestPage(1));

// =========================
// TOGGLE LOGIK
// Projektwald ist die einzige Übersichtsansicht — diese Funktion aktiviert
// sie (nach dem Schließen der Detailseite, oder einmalig beim Laden).
// =========================
function switchToForestView() {
  document.getElementById('project-forest-wrap').style.display = '';
  document.getElementById('view-project-detail').style.display = 'none';
  document.getElementById('forest-toolbar').style.display      = '';
  document.getElementById('project-dash-content').classList.add('forest-active');
  renderForest();
}

// =========================
// DETAILANSICHT
// =========================
let currentDetailProject = null;
let detailSubLayer = 0;
// Akkordeon-Zustand der Unterprojekt-Kacheln (Aufgabenliste ein-/
// ausgeklappt) — reiner UI-Zustand, nicht in DB persistiert. Set aus
// Unterprojekt-IDs, die gerade EINGEKLAPPT sind (leer = alle offen).
let collapsedSubprojects = new Set();
// Gleiches Akkordeon-Verhalten für die Hauptaufgaben-Kachel (einzelne
// Kachel, daher reicht ein Boolean statt eines Sets).
let mainTasksCollapsed = false;

// Welches Projekt zuletzt in der Detailansicht offen war (#8) — bewusst
// getrennt vom URL-Hash-Tab-Routing in main.js (das bleibt unangetastet,
// nur "#projects" o.ä.), rein Projekte-intern. Ein manueller Browser-
// Reload landete vorher immer auf der Wald-Übersicht, selbst wenn man
// gerade eine Detailseite offen hatte — siehe Start-Aufruf am Ende dieses
// Abschnitts.
let lastOpenProjectDetailId = DB.get('lastOpenProjectDetailId', null);
function saveLastOpenProjectDetailId(id) {
  lastOpenProjectDetailId = id;
  DB.set('lastOpenProjectDetailId', id);
}

function openProjectDetail(projectId) {
  currentDetailProject = projects.find(p => p.id === projectId);
  if (!currentDetailProject) return;
  saveLastOpenProjectDetailId(projectId);
  detailSubLayer = 0;
  collapsedSubprojects = new Set();
  mainTasksCollapsed = false;

  const dc = document.querySelector('#view-projects .dash-content');
  // forest-active bringt eine feste height:calc(100vh-44px)+overflow:hidden
  // mit (siehe .dash-content.forest-active in projects.css) — die darf beim
  // Wechsel in die Detailansicht nicht mehr aktiv sein, sonst wird
  // #view-project-detail auf diese Höhe geklemmt (leerer Streifen unten,
  // wenn der Inhalt kürzer ist, oder Abschneiden, wenn er länger ist).
  if (dc) { dc.classList.remove('forest-active'); dc.classList.add('pdt-active'); }
  document.getElementById('forest-toolbar').style.display = 'none';

  document.getElementById('project-forest-wrap').style.display = 'none';
  document.getElementById('view-project-detail').style.display = '';

  renderProjectDetail();
}

function closeProjectDetail() {
  const dc = document.querySelector('#view-projects .dash-content');
  if (dc) dc.classList.remove('pdt-active');

  document.getElementById('view-project-detail').style.display = 'none';
  currentDetailProject = null;
  saveLastOpenProjectDetailId(null);
  switchToForestView();
}

// Start: entweder die zuletzt offene Detailseite wiederherstellen (#8) oder,
// falls keine gespeichert ist bzw. das Projekt inzwischen gelöscht wurde,
// die gewohnte Wald-Übersicht zeigen.
if (lastOpenProjectDetailId && projects.some(p => p.id === lastOpenProjectDetailId)) {
  openProjectDetail(lastOpenProjectDetailId);
} else {
  switchToForestView();
}

function renderProjectDetail() {
  const p = currentDetailProject;
  if (!p) return;

  document.getElementById('proj-detail-name').textContent   = p.name;
  document.getElementById('proj-detail-desc').textContent   = p.description || '';
  document.getElementById('proj-detail-status').textContent = p.archived ? 'Archiviert' : 'Aktives Projekt';
  document.getElementById('proj-detail-status').className   = 'pdt-status-badge' + (p.archived ? ' archived' : '');

  // Einzige Fortschritts-Quelle für die Detailseite: getProjectStats() (projects.js)
  // rechnet Haupt- UND Unterprojekt-Aufgaben korrekt zusammen. updateDetailTreeElements()
  // schreibt diese Werte NICHT mehr selbst (siehe project-tree.js) — sonst zwei
  // unabhängige, potenziell widersprüchliche Berechnungen für dieselben DOM-Elemente.
  const stats = getProjectStats(p);
  const total = stats.coreTasks.length + stats.subTotal;
  const done  = stats.coreDone + stats.subDone;
  const pct   = stats.coreProgress;

  document.getElementById('proj-detail-pct').textContent       = pct + '%';
  document.getElementById('proj-detail-bar-fill').style.width  = pct + '%';
  document.getElementById('proj-detail-task-count').textContent = `${done} / ${total} Aufgaben`;
  document.getElementById('proj-detail-sub-count').textContent  = `${p.subprojects.length} Unterprojekte`;
  document.getElementById('proj-detail-startdate').textContent  = formatStartDate(p) || '—';

  // Fälligkeitsdatum — Infokarten-Zeile bleibt versteckt, solange keins gesetzt ist
  const dueRow = document.getElementById('proj-detail-due-row');
  const dueVal = document.getElementById('proj-detail-due-val');
  const due    = formatDueDate(p);
  if (dueRow && dueVal) {
    if (due) {
      dueRow.style.display = '';
      dueVal.textContent   = due.text;
      dueVal.style.color   = due.overdue ? 'var(--prio-1)' : '';
    } else {
      dueRow.style.display = 'none';
    }
  }

  // Neue Felder
  const statusValEl = document.getElementById('proj-detail-status-val');
  if (statusValEl) { statusValEl.textContent = p.archived ? 'Archiviert' : 'Aktiv'; statusValEl.style.color = p.archived ? '#d97706' : '#16a34a'; }
  const subValEl = document.getElementById('proj-detail-sub-val');
  if (subValEl) subValEl.textContent = p.subprojects.length;

  // Baum (PNG, dieselbe Variante wie im Projektwald) + Äpfel/Blüten-Deko
  updateDetailTreeElements(p);

  // Mehr-Äste-Button
  const moreBtn = document.getElementById('proj-detail-more-branches');
  if (p.subprojects.length > 7) {
    moreBtn.style.display = '';
    moreBtn.textContent   = detailSubLayer === 0 ? `▸ Weitere Äste (${p.subprojects.length - 7})` : '◂ Erste Äste';
  } else {
    moreBtn.style.display = 'none';
  }

  renderDetailTiles();
}

// Eine Aufgabenzeile (Checkbox, Label mit Detail-Link, Umbenennen/Verschieben/
// Löschen) — von der Haupt-Aufgaben-Kachel UND jeder Unterprojekt-Kachel
// gemeinsam genutzt, damit beide Orte exakt dieselben Fähigkeiten haben.
function buildDetailTaskRow(task, project, subproject) {
  const row = document.createElement('div');
  row.className = 'detail-tile-task-row' + (task.done ? ' done' : '') + (task.isExtra ? ' extra' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = task.done;
  cb.className = 'project-task-cb';
  cb.addEventListener('change', () => {
    task.done = cb.checked;
    task.completedAt = cb.checked ? Date.now() : null;
    saveProjects();
    // Erledigt-Status ändert die Fortschrittszahlen im Hero — komplett neu
    // rendern (deckt Baumdeko + Kacheln + Prozent/Zähler in einem Aufwasch ab).
    renderProjectDetail();
    renderForest();
  });

  const label = document.createElement('span');
  label.className = 'detail-tile-task-label';
  label.textContent = task.text;
  if (task.description || (task.checklist && task.checklist.length)) {
    const dot = document.createElement('span');
    dot.className = 'detail-task-has-detail';
    dot.textContent = '·';
    label.appendChild(dot);
  }
  label.addEventListener('click', () => openTaskDetail(task, subproject, project));
  label.style.cursor = 'pointer';

  const actions = document.createElement('div');
  actions.className = 'detail-tile-task-actions';

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.className = 'detail-task-icon-btn';
  renameBtn.title = 'Bearbeiten';
  renameBtn.textContent = '✎';
  // Öffnet das vollständige Aufgaben-Detail (Titel, Beschreibung sichtbar +
  // editierbar, Checkliste) statt nur den Titel inline zu bearbeiten — die
  // Beschreibung war über dieses Icon vorher gar nicht erreichbar.
  renameBtn.addEventListener('click', e => {
    e.stopPropagation();
    openTaskDetail(task, subproject, project);
  });

  const moveBtn = document.createElement('button');
  moveBtn.type = 'button';
  moveBtn.className = 'detail-task-icon-btn';
  moveBtn.title = 'Verschieben';
  moveBtn.textContent = '⇄';
  moveBtn.addEventListener('click', e => {
    e.stopPropagation();
    openMoveTaskModal(task, project, subproject);
  });

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'detail-task-icon-btn';
  delBtn.title = 'Löschen';
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (subproject) {
      subproject.tasks = subproject.tasks.filter(t => t.id !== task.id);
    } else {
      project.tasks = project.tasks.filter(t => t.id !== task.id);
    }
    saveProjects();
    renderProjectDetail();
    renderForest();
  });

  actions.append(renameBtn, moveBtn, delBtn);

  const rowChildren = [cb, label];

  // Kategorie-Badge (optional, siehe populateTaskCategorySelect() in
  // projects.js) — nur wenn das Projekt Kategorien hat, sie aktiviert sind
  // UND die zugewiesene Kategorie noch existiert (kann durch Löschen der
  // Kategorie verwaist sein, dann steht categoryId bereits wieder auf null,
  // dieser Check ist zusätzliche Absicherung).
  if (task.categoryId && project.categoriesEnabled !== false) {
    const cat = (project.taskCategories || []).find(c => c.id === task.categoryId);
    if (cat) {
      const catBadge = document.createElement('span');
      catBadge.className = 'detail-tile-category-badge';
      catBadge.textContent = cat.name;
      rowChildren.push(catBadge);
    }
  }

  if (task.isExtra) {
    // Eigene Klasse statt .detail-tile-extra-badge (die auch für das
    // Kern/Extra-Label im Aufgaben-Detail-Modal genutzt wird, siehe
    // index.html #task-detail-type — eine sage-Einfärbung dort würde auch
    // "◉ Kern" mitfärben, was nicht gewünscht ist).
    const badge = document.createElement('span');
    badge.className = 'detail-tile-extra-row-badge';
    badge.textContent = '✦ Extra';
    rowChildren.push(badge);
  }
  rowChildren.push(actions);
  row.append(...rowChildren);
  return row;
}

// Immer sichtbare, nicht paginierte Kachel für Aufgaben direkt am Projekt
// (ohne Unterprojekt) — vorher in der Detailansicht komplett unsichtbar.
function buildMainTasksTile(p) {
  const stats = getProjectStats(p);
  const mainTotal = stats.coreTasks.length + stats.extraTasks.length;
  const mainDone  = stats.coreDone + stats.extraDone;
  const mainPct   = mainTotal === 0 ? 0 : Math.round(mainDone / mainTotal * 100);

  const tile = document.createElement('div');
  tile.className = 'detail-tile detail-tile-main' + (mainTasksCollapsed ? ' collapsed' : '');

  const head = document.createElement('div');
  head.className = 'detail-tile-head detail-tile-head--toggle';
  head.setAttribute('role', 'button');
  head.setAttribute('tabindex', '0');
  head.setAttribute('aria-expanded', String(!mainTasksCollapsed));

  const titleWrap = document.createElement('div');
  titleWrap.className = 'detail-tile-title-wrap';
  const chevron = document.createElement('span');
  chevron.className = 'detail-tile-chevron';
  chevron.textContent = mainTasksCollapsed ? '▸' : '▾';
  const title = document.createElement('div');
  title.className = 'detail-tile-title';
  title.textContent = p.mainTasksLabel || 'Hauptaufgaben';
  titleWrap.append(chevron, title);

  // Umbenennen (#2) — gleiches Icon/Muster wie bei Ästen (subActions oben).
  // Kein Löschen-Icon: anders als ein Ast ist diese Kachel der feste
  // Container für project.tasks, kein eigenständiges, entfernbares Objekt.
  const mainActions = document.createElement('div');
  mainActions.className = 'detail-tile-sub-actions';
  const mainRenameBtn = document.createElement('button');
  mainRenameBtn.type = 'button';
  mainRenameBtn.className = 'detail-task-icon-btn';
  mainRenameBtn.title = 'Umbenennen';
  mainRenameBtn.textContent = '✎';
  mainRenameBtn.addEventListener('click', e => {
    e.stopPropagation();
    startInlineEdit(title, p, p, () => renderDetailTiles(), 'mainTasksLabel');
  });
  mainActions.append(mainRenameBtn);

  const meta = document.createElement('div');
  meta.className = 'detail-tile-meta';
  meta.textContent = `${mainDone}/${mainTotal}`;
  head.append(titleWrap, mainActions, meta);

  const toggleMainCollapse = () => {
    mainTasksCollapsed = tile.classList.toggle('collapsed');
    chevron.textContent = mainTasksCollapsed ? '▸' : '▾';
    head.setAttribute('aria-expanded', String(!mainTasksCollapsed));
  };
  head.addEventListener('click', toggleMainCollapse);
  head.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMainCollapse(); }
  });

  const barWrap = document.createElement('div');
  barWrap.className = 'detail-tile-bar-wrap';
  const barFill = document.createElement('div');
  barFill.className = 'detail-tile-bar-fill';
  barFill.style.width = mainPct + '%';
  if (mainPct === 100 && mainTotal > 0) barFill.style.background = '#16a34a';
  barWrap.appendChild(barFill);

  const taskList = document.createElement('div');
  taskList.className = 'detail-tile-tasks';

  if (mainTotal === 0) {
    const hint = document.createElement('div');
    hint.className = 'detail-tile-empty';
    hint.textContent = 'Noch keine Aufgaben direkt am Projekt.';
    taskList.appendChild(hint);
  } else {
    stats.coreTasks.forEach(task => taskList.appendChild(buildDetailTaskRow(task, p, null)));
    if (stats.extraTasks.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'detail-tile-divider';
      divider.textContent = '✦ Extras';
      taskList.appendChild(divider);
      stats.extraTasks.forEach(task => taskList.appendChild(buildDetailTaskRow(task, p, null)));
    }
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'detail-tile-add-btn';
  addBtn.textContent = '+ Aufgabe hinzufügen';
  addBtn.addEventListener('click', () => openAddTaskModalFromDetail(p.id, null));
  taskList.appendChild(addBtn);

  tile.append(head, barWrap, taskList);
  return tile;
}

function renderDetailTiles() {
  const p    = currentDetailProject;
  const grid = document.getElementById('proj-detail-tiles');
  grid.innerHTML = '';

  // Haupt-Aufgaben-Kachel — immer an erster Stelle, nie paginiert.
  grid.appendChild(buildMainTasksTile(p));

  const layerStart  = detailSubLayer * 7;
  const visibleSubs = p.subprojects.slice(layerStart, layerStart + 7);

  if (visibleSubs.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'detail-tile-empty';
    hint.style.padding = '20px 4px';
    hint.textContent = 'Noch keine Unterprojekte. Füge über „+ Ast hinzufügen" einen hinzu.';
    grid.appendChild(hint);
    return;
  }

  visibleSubs.forEach(sp => {
    const stats     = getSubprojectStats(sp);
    const collapsed = collapsedSubprojects.has(sp.id);
    const tile  = document.createElement('div');
    tile.className = 'detail-tile' + (collapsed ? ' collapsed' : '');

    // Akkordeon: Kopfbereich bleibt immer sichtbar, Klick klappt nur die
    // Aufgabenliste (taskList weiter unten) auf/zu — Fortschrittsbalken +
    // Kopf bleiben auch eingeklappt sichtbar. Reiner Anzeigezustand (kein
    // DB-Feld), geht also nie mit echten Aufgaben-/Projektdaten verloren;
    // collapsedSubprojects wird nur beim Öffnen eines (ggf. anderen)
    // Projekts zurückgesetzt (siehe openProjectDetail()).
    const head = document.createElement('div');
    head.className = 'detail-tile-head detail-tile-head--toggle';
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-expanded', String(!collapsed));

    const titleWrap = document.createElement('div');
    titleWrap.className = 'detail-tile-title-wrap';
    const chevron = document.createElement('span');
    chevron.className = 'detail-tile-chevron';
    chevron.textContent = collapsed ? '▸' : '▾';
    const title = document.createElement('div');
    title.className = 'detail-tile-title';
    title.textContent = sp.title;
    titleWrap.append(chevron, title);

    // Umbenennen/Löschen für den Ast selbst (#2) — analog zu den Aufgaben-
    // Icons in buildDetailTaskRow(). stopPropagation() nötig, damit ein
    // Klick nicht zusätzlich den Akkordeon-Toggle des Kopfbereichs auslöst.
    const subActions = document.createElement('div');
    subActions.className = 'detail-tile-sub-actions';
    const subRenameBtn = document.createElement('button');
    subRenameBtn.type = 'button';
    subRenameBtn.className = 'detail-task-icon-btn';
    subRenameBtn.title = 'Ast umbenennen';
    subRenameBtn.textContent = '✎';
    subRenameBtn.addEventListener('click', e => {
      e.stopPropagation();
      startInlineEdit(title, sp, p, () => renderDetailTiles(), 'title');
    });
    const subDeleteBtn = document.createElement('button');
    subDeleteBtn.type = 'button';
    subDeleteBtn.className = 'detail-task-icon-btn';
    subDeleteBtn.title = 'Ast löschen';
    subDeleteBtn.textContent = '✕';
    subDeleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      openConfirmModal(
        'Ast löschen?',
        `„${sp.title}" wird mitsamt allen ${sp.tasks.length} Aufgabe${sp.tasks.length === 1 ? '' : 'n'} dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
        'Löschen',
        'danger',
        () => {
          p.subprojects = p.subprojects.filter(s => s.id !== sp.id);
          collapsedSubprojects.delete(sp.id);
          saveProjects();
          renderProjectDetail();
          renderForest();
        }
      );
    });
    subActions.append(subRenameBtn, subDeleteBtn);

    const meta = document.createElement('div');
    meta.className = 'detail-tile-meta';
    meta.textContent = `${stats.done}/${stats.total}`;
    head.append(titleWrap, subActions, meta);

    const toggleCollapse = () => {
      const nowCollapsed = tile.classList.toggle('collapsed');
      if (nowCollapsed) collapsedSubprojects.add(sp.id); else collapsedSubprojects.delete(sp.id);
      chevron.textContent = nowCollapsed ? '▸' : '▾';
      head.setAttribute('aria-expanded', String(!nowCollapsed));
    };
    head.addEventListener('click', toggleCollapse);
    head.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse(); }
    });

    const barWrap = document.createElement('div');
    barWrap.className = 'detail-tile-bar-wrap';
    const barFill = document.createElement('div');
    barFill.className = 'detail-tile-bar-fill';
    barFill.style.width = stats.pct + '%';
    if (stats.pct === 100) barFill.style.background = '#16a34a';
    barWrap.appendChild(barFill);

    const taskList = document.createElement('div');
    taskList.className = 'detail-tile-tasks';

    if (sp.tasks.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'detail-tile-empty';
      hint.textContent = 'Noch keine Aufgaben.';
      taskList.appendChild(hint);
    } else {
      sp.tasks.forEach(task => taskList.appendChild(buildDetailTaskRow(task, p, sp)));
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'detail-tile-add-btn';
    addBtn.textContent = '+ Aufgabe hinzufügen';
    addBtn.addEventListener('click', () => openAddTaskModalFromDetail(p.id, sp.id));
    taskList.appendChild(addBtn);

    tile.append(head, barWrap, taskList);
    grid.appendChild(tile);
  });
}


// updateDetailTreeElements -> project-tree.js


// =========================
// AUFGABE DETAIL MODAL
// =========================
let currentTaskDetail = null;

function openTaskDetail(task, sp, project) {
  currentTaskDetail = { task, sp, project };
  document.getElementById('task-detail-title').textContent = task.text;
  document.getElementById('task-detail-sp').textContent    = sp ? sp.title : 'Hauptaufgabe';
  document.getElementById('task-detail-type').textContent  = task.isExtra ? '✦ Extra' : '◉ Kern';
  document.getElementById('task-detail-desc').value        = task.description || '';
  document.getElementById('task-detail-done-cb').checked   = task.done;
  populateTaskCategorySelect(document.getElementById('task-detail-category-select'), document.getElementById('task-detail-category-row'), project, task.categoryId);
  renderTaskDetailChecklist();
  document.getElementById('task-detail-overlay').classList.remove('hidden');
}

function closeTaskDetail() {
  document.getElementById('task-detail-overlay').classList.add('hidden');
  currentTaskDetail = null;
}

function renderTaskDetailChecklist() {
  const { task } = currentTaskDetail;
  const list = document.getElementById('task-detail-checklist');
  list.innerHTML = '';
  (task.checklist || []).forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'task-cl-row' + (item.done ? ' done' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = item.done; cb.className = 'project-task-cb';
    cb.addEventListener('change', () => { item.done = cb.checked; saveProjects(); renderTaskDetailChecklist(); });
    const lbl = document.createElement('span');
    lbl.className = 'task-cl-label'; lbl.textContent = item.text;
    const del = document.createElement('button');
    del.className = 'task-delete'; del.textContent = '✕';
    del.addEventListener('click', () => { task.checklist.splice(i, 1); saveProjects(); renderTaskDetailChecklist(); });
    row.append(cb, lbl, del);
    list.appendChild(row);
  });
}

document.getElementById('task-detail-desc').addEventListener('input', () => {
  if (!currentTaskDetail) return;
  currentTaskDetail.task.description = document.getElementById('task-detail-desc').value;
  saveProjects();
});

document.getElementById('task-detail-category-select')?.addEventListener('change', () => {
  if (!currentTaskDetail) return;
  currentTaskDetail.task.categoryId = document.getElementById('task-detail-category-select').value || null;
  saveProjects();
  renderDetailTiles();
});

document.getElementById('task-detail-done-cb').addEventListener('change', () => {
  if (!currentTaskDetail) return;
  currentTaskDetail.task.done = document.getElementById('task-detail-done-cb').checked;
  currentTaskDetail.task.completedAt = currentTaskDetail.task.done ? Date.now() : null;
  saveProjects();
  if (currentDetailProject) renderProjectDetail();
  renderForest();
});

document.getElementById('task-detail-add-cl').addEventListener('click', () => {
  const input = document.getElementById('task-detail-cl-input');
  const text  = input.value.trim();
  if (!text || !currentTaskDetail) return;
  if (!currentTaskDetail.task.checklist) currentTaskDetail.task.checklist = [];
  currentTaskDetail.task.checklist.push({ id: crypto.randomUUID(), text, done: false });
  input.value = '';
  saveProjects(); renderTaskDetailChecklist();
});
document.getElementById('task-detail-cl-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('task-detail-add-cl').click();
});
document.getElementById('task-detail-close').addEventListener('click', closeTaskDetail);
document.getElementById('task-detail-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('task-detail-overlay')) closeTaskDetail();
});

document.getElementById('task-detail-rename').addEventListener('click', () => {
  if (!currentTaskDetail) return;
  const { task, project } = currentTaskDetail;
  const titleEl = document.getElementById('task-detail-title');
  startInlineEdit(titleEl, task, project, () => {
    titleEl.textContent = task.text;
    renderDetailTiles();
    renderForest();
  });
});

document.getElementById('task-detail-delete').addEventListener('click', () => {
  if (!currentTaskDetail) return;
  const { task, sp, project } = currentTaskDetail;
  if (sp) {
    sp.tasks = sp.tasks.filter(t => t.id !== task.id);
  } else {
    project.tasks = project.tasks.filter(t => t.id !== task.id);
  }
  saveProjects();
  closeTaskDetail();
  if (currentDetailProject) renderProjectDetail();
  renderForest();
});

// =========================
// AUFGABE AUS DETAIL HINZUFÜGEN
// =========================
function openAddTaskModalFromDetail(projectId, subprojectId) {
  closeTaskDetail();
  addTaskTargetProjectId    = projectId;
  addTaskIsExtra            = false;
  addTaskTargetSubprojectId = subprojectId;
  const proj = projects.find(p => p.id === projectId);
  const sp   = subprojectId ? (proj.subprojects||[]).find(s => s.id === subprojectId) : null;
  document.getElementById('project-task-modal-title').textContent = sp ? `Aufgabe zu „${sp.title}"` : 'Neue Hauptaufgabe';
  document.getElementById('project-task-input').value = '';
  document.getElementById('project-task-desc-input').value = '';
  document.getElementById('task-type-core').classList.add('active');
  document.getElementById('task-type-extra').classList.remove('active');
  addTaskIsExtra = false;
  populateTaskCategorySelect(document.getElementById('project-task-category-select'), document.getElementById('project-task-category-row'), proj, null);
  document.getElementById('project-task-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('project-task-input').focus(), 50);
}

document.getElementById('task-type-core').addEventListener('click', () => {
  addTaskIsExtra = false;
  document.getElementById('task-type-core').classList.add('active');
  document.getElementById('task-type-extra').classList.remove('active');
});
document.getElementById('task-type-extra').addEventListener('click', () => {
  addTaskIsExtra = true;
  document.getElementById('task-type-extra').classList.add('active');
  document.getElementById('task-type-core').classList.remove('active');
});

// =========================
// PROJEKTINFOS — MOBIL ALS MODAL
// .pdt-left/.pdt-info-card leben nur einmal im DOM (in der Detail-Hero,
// index.html) und werden je nach Breite zwischen Hero (Desktop-Grid) und
// Projektinfos-Modal (#pdt-info-modal-slot) umgehängt statt dupliziert —
// gleiches Muster wie placeSidebarWidgets() in main.js für die Positivity-/
// Countdown-Widgets. Der Breakpoint (1024px) MUSS mit dem Mobile-Override
// in css/projects.css (".pdt-left, .pdt-info-card") übereinstimmen.
// =========================
const pdtInfoMobileQuery = window.matchMedia('(max-width: 1024px)');
function placePdtInfoCard(isMobile) {
  const left     = document.querySelector('.pdt-left');
  const infoCard = document.querySelector('.pdt-info-card');
  const slot     = document.getElementById('pdt-info-modal-slot');
  const hero     = document.querySelector('.pdt-hero');
  const treeCol  = document.querySelector('.pdt-tree-col');
  if (!left || !infoCard || !slot || !hero || !treeCol) return;
  if (isMobile) {
    slot.appendChild(left);
    slot.appendChild(infoCard);
  } else {
    // Zurück an ihren ursprünglichen Platz in der Hero (vor der Baumspalte,
    // Info-Karte danach) — exakt die Reihenfolge aus dem statischen Markup.
    hero.insertBefore(left, treeCol);
    hero.appendChild(infoCard);
  }
}
placePdtInfoCard(pdtInfoMobileQuery.matches);
pdtInfoMobileQuery.addEventListener('change', e => placePdtInfoCard(e.matches));

function openPdtInfoModal() {
  document.getElementById('proj-detail-info-modal-overlay').classList.remove('hidden');
}
function closePdtInfoModal() {
  document.getElementById('proj-detail-info-modal-overlay').classList.add('hidden');
}
document.getElementById('proj-detail-info-btn').addEventListener('click', openPdtInfoModal);
document.getElementById('proj-detail-info-modal-close').addEventListener('click', closePdtInfoModal);
document.getElementById('proj-detail-info-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('proj-detail-info-modal-overlay')) closePdtInfoModal();
});

// =========================
// DETAIL VIEW EVENTS
// =========================
document.getElementById('proj-detail-back').addEventListener('click', closeProjectDetail);
document.getElementById('proj-detail-more-branches').addEventListener('click', () => {
  detailSubLayer = detailSubLayer === 0 ? 1 : 0;
  renderProjectDetail();
});
document.getElementById('proj-detail-add-branch').addEventListener('click', () => {
  if (currentDetailProject) openAddSubprojectModal(currentDetailProject.id);
});
// Neuer sichtbarer "Ast hinzufügen" Button
const _addBranchVisible = document.getElementById('proj-detail-add-branch-visible');
if (_addBranchVisible) _addBranchVisible.addEventListener('click', () => {
  if (currentDetailProject) openAddSubprojectModal(currentDetailProject.id);
});
// =========================
// DETAIL-MENÜ (⋮) — Bearbeiten + Projekt beenden/reaktivieren (Herbstmodus)
// Gleiches Dropdown-Muster wie budget.js (.b-header-dropdown): an <body>
// angehängt (fixed), damit es nicht von umgebenden Containern abgeschnitten wird.
// =========================
let pdtMenuEl = null;
function getPdtMenuEl() {
  if (!pdtMenuEl) {
    pdtMenuEl = document.createElement('div');
    pdtMenuEl.className = 'b-header-dropdown';
    document.body.appendChild(pdtMenuEl);
  }
  return pdtMenuEl;
}
function closePdtMenu() {
  if (pdtMenuEl) pdtMenuEl.classList.remove('open');
}
document.addEventListener('click', closePdtMenu);
document.addEventListener('scroll', closePdtMenu, true);
window.addEventListener('resize', closePdtMenu);

// Waldansicht bei Größenänderung neu rendern (Rotation, Fold/Unfold,
// DevTools-Responsive-Modus) — sowohl Baumgrößen (containerWidth in
// buildForestTree()) als auch der Toolbar-Versatz (updateForestTreesLayerOffset())
// hängen von der tatsächlichen Fensterbreite/-höhe ab und würden sonst bis
// zum nächsten Tab/Such/Filter-Wechsel veraltet bleiben. Debounced, da
// resize sehr häufig feuern kann; nur aktiv, wenn die Waldansicht sichtbar ist.
let forestResizeTimer = null;
window.addEventListener('resize', () => {
  const wrap = document.getElementById('project-forest-wrap');
  if (!wrap || wrap.style.display === 'none') return;
  // Sofort (nicht erst nach dem 150ms-Debounce unten) auf 0 zurücksetzen —
  // reale Mobilbrowser feuern kurz nach dem Laden/Scrollen ein resize
  // (Adressleiste ein-/ausblenden), das die Scroll-Position von
  // #project-forest-wrap verschieben kann; ohne diese sofortige Korrektur
  // wären Titel/Archiv/Neues-Projekt-Buttons (.forest-overlay-top) bis zum
  // fertigen Re-Render kurz abgeschnitten (siehe renderForest() oben).
  wrap.scrollTop = 0;
  clearTimeout(forestResizeTimer);
  forestResizeTimer = setTimeout(renderForest, 150);
});

// Detailseite bei Größenänderung neu rendern — der Baum-Breitendeckel in
// updateDetailTreeElements() (project-tree.js) misst die Hero-Breite live
// und muss beim Wechsel zwischen Desktop-3-Spalten- und gestapelter
// Mobile/Tablet-Ansicht (1024px-Grenze) neu berechnet werden.
let pdtResizeTimer = null;
window.addEventListener('resize', () => {
  const detailEl = document.getElementById('view-project-detail');
  if (!detailEl || detailEl.style.display === 'none' || !currentDetailProject) return;
  clearTimeout(pdtResizeTimer);
  pdtResizeTimer = setTimeout(() => updateDetailTreeElements(currentDetailProject), 150);
});

const pdtMenuBtn = document.getElementById('proj-detail-menu-btn');
if (pdtMenuBtn) {
  pdtMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = getPdtMenuEl();
    const wasOpen = menu.classList.contains('open');
    closePdtMenu();
    if (wasOpen || !currentDetailProject) return;

    const p = currentDetailProject;
    const finishLabel = p.archived ? '↩ Projekt reaktivieren' : '🍂 Projekt beenden (Herbstmodus)';
    menu.innerHTML = `
      <button type="button" class="b-header-dropdown-item" id="pdt-menu-edit">✏️ Bearbeiten</button>
      <button type="button" class="b-header-dropdown-item" id="pdt-menu-customizing">🎨 Customizing</button>
      <button type="button" class="b-header-dropdown-item" id="pdt-menu-categories">🏷 Kategorien</button>
      <button type="button" class="b-header-dropdown-item" id="pdt-menu-finish">${finishLabel}</button>
      <button type="button" class="b-header-dropdown-item" id="pdt-menu-delete">🗑 Projekt löschen</button>
    `;
    const rect = pdtMenuBtn.getBoundingClientRect();
    menu.style.top   = (rect.bottom + 6) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.classList.add('open');

    document.getElementById('pdt-menu-edit').addEventListener('click', () => {
      closePdtMenu();
      if (currentDetailProject) openProjectModal(currentDetailProject);
    });
    document.getElementById('pdt-menu-customizing').addEventListener('click', () => {
      closePdtMenu();
      if (currentDetailProject) openCustomizingModal(currentDetailProject);
    });
    document.getElementById('pdt-menu-categories').addEventListener('click', () => {
      closePdtMenu();
      if (currentDetailProject) openCategoriesModal(currentDetailProject);
    });
    document.getElementById('pdt-menu-finish').addEventListener('click', () => {
      closePdtMenu();
      if (!currentDetailProject) return;
      const project = currentDetailProject;

      if (project.archived) {
        const idx = projects.findIndex(pr => pr.id === project.id);
        if (idx !== -1) projects[idx].archived = false;
        saveProjects();
        renderProjectDetail();
        return;
      }

      openConfirmModal(
        'Projekt beenden?',
        `„${project.name}" wird in den Herbstmodus versetzt (abgeschlossen). Es bleibt vollständig erhalten und kann jederzeit reaktiviert werden.`,
        'Beenden',
        'neutral',
        () => {
          const idx = projects.findIndex(pr => pr.id === project.id);
          if (idx !== -1) projects[idx].archived = true;
          saveProjects();
          renderProjectDetail();
        }
      );
    });
    document.getElementById('pdt-menu-delete').addEventListener('click', () => {
      closePdtMenu();
      if (!currentDetailProject) return;
      const project = currentDetailProject;
      openConfirmModal(
        'Projekt löschen?',
        `„${project.name}" wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
        'Löschen',
        'danger',
        () => {
          projects = projects.filter(pr => pr.id !== project.id);
          saveProjects();
          closeProjectDetail();
        }
      );
    });
  });
}

// =========================
// CUSTOMIZING-MODAL — welche Obst-/Blumensorten Haupt- bzw. Extraaufgaben
// beim Erledigen auf dem Baum erzeugen (project.customizing, siehe
// DECOR_REGISTRY/getCustomizingPool()/ensureTaskDecor() in project-tree.js).
// Zwei Ebenen Akkordeon (Aufgabenart -> Obst/Blumen), darin je ein Grid mit
// einer Checkbox-Kachel pro DECOR_REGISTRY-Eintrag — komplett datengetrieben,
// eine neue Sorte in DECOR_REGISTRY taucht hier automatisch mit auf.
//
// Auswahl wird NICHT mehr pro Checkbox-Klick sofort gespeichert, sondern
// erst in einen lokalen Entwurf (customizingDraft) übernommen — sichtbar
// gespeichert wird erst per "Speichern"-Button (siehe saveCustomizingDraft()
// unten), der erscheint, sobald sich der Entwurf vom zuletzt gespeicherten
// Stand unterscheidet (customizingDirty).
// =========================
const CUSTOMIZING_TASK_CATEGORIES  = [
  { key: 'core',  label: 'Hauptaufgaben' },
  { key: 'extra', label: 'Extraaufgaben' },
];
const CUSTOMIZING_DECOR_CATEGORIES = [
  { key: 'obst',   label: 'Obst' },
  { key: 'blumen', label: 'Blumen' },
];

let customizingProject = null;
let customizingDraft   = null; // { core: string[], extra: string[] } — Arbeitskopie, siehe oben
let customizingDirty   = false;

// Spaltenzahl fürs Auswahl-Grid einer Unterkategorie, abhängig von ihrer
// Item-Anzahl (nicht von der Dialogbreite — die sorgt separat per CSS-
// Media-Query dafür, dass auf schmalen Bildschirmen automatisch weniger
// Spalten verwendet werden, siehe .cust-subgroup-body in projects.css).
function customizingGridCols(itemCount) {
  if (itemCount <= 4) return 1;
  if (itemCount <= 10) return 2;
  return 3;
}

// Baum-Auswahl (#3) — bewusst NICHT Teil des Entwurf/Speichern-Zyklus der
// Deko-Auswahl unten (customizingDraft/customizingDirty): ein Baum ist ein
// einzelner, sofort verständlicher Klick, kein Mehrfach-Auswahl-Formular —
// wirkt daher sofort (saveProjects() + Detailbaum-Refresh direkt im Klick-
// Handler), ohne eigenen Speichern-Button.
function renderTreePicker(project) {
  const picker = document.getElementById('customizing-tree-picker');
  if (!picker) return;
  const currentVariant = getOrAssignTreeVariant(project);
  picker.innerHTML = Array.from({ length: TREE_PNG_COUNT }, (_, i) => i + 1).map(n => `
    <button type="button" class="cust-tree-option${n === currentVariant ? ' active' : ''}" data-tree-variant="${n}">
      <img src="img/trees/tree_${n}.png" alt="Baum ${n}" draggable="false"/>
    </button>
  `).join('');
  picker.querySelectorAll('.cust-tree-option').forEach(btn => {
    btn.addEventListener('click', () => {
      project.treeVariant = parseInt(btn.dataset.treeVariant, 10);
      saveProjects();
      picker.querySelectorAll('.cust-tree-option').forEach(b => b.classList.toggle('active', b === btn));
      if (currentDetailProject && currentDetailProject.id === project.id) updateDetailTreeElements(project);
      renderForest();
    });
  });
}

function renderCustomizingModal(project) {
  customizingProject = project;
  renderTreePicker(project);
  const registryByCategory = {};
  Object.values(DECOR_REGISTRY).forEach(entry => {
    (registryByCategory[entry.category] || (registryByCategory[entry.category] = [])).push(entry);
  });

  // Entwurf aus der tatsächlich gespeicherten Auswahl (bzw. Default-
  // Fallback, wenn das Projekt noch keine eigene hat) initialisieren —
  // eigene Arrays, damit Häkchen im Entwurf project.customizing nicht
  // versehentlich mit-mutieren, bevor "Speichern" geklickt wird.
  const stored = project.customizing || {};
  customizingDraft = {
    core:  [...(Array.isArray(stored.core)  ? stored.core  : DEFAULT_CUSTOMIZING.core)],
    extra: [...(Array.isArray(stored.extra) ? stored.extra : DEFAULT_CUSTOMIZING.extra)],
  };
  customizingDirty = false;
  updateCustomizingSaveBar();

  const container = document.getElementById('customizing-sections');
  container.innerHTML = CUSTOMIZING_TASK_CATEGORIES.map(taskCat => {
    const selection = customizingDraft[taskCat.key];

    const groups = CUSTOMIZING_DECOR_CATEGORIES.map(decorCat => {
      const items = registryByCategory[decorCat.key] || [];
      if (!items.length) return '';
      const cols = customizingGridCols(items.length);
      const rows = items.map(item => `
        <label class="cust-row">
          <span class="cust-row-preview"><img src="${item.variants[0]}" alt="" draggable="false"/></span>
          <span class="cust-row-name">${escapeXml(item.label)}</span>
          <input type="checkbox" class="project-task-cb" data-task-cat="${taskCat.key}" data-decor-id="${item.id}" ${selection.includes(item.id) ? 'checked' : ''}/>
        </label>
      `).join('');
      return `
        <div class="cust-subgroup">
          <div class="cust-subgroup-head" data-cust-toggle="subgroup">
            <span class="cust-chevron">▸</span><span>${decorCat.label}</span>
          </div>
          <div class="cust-subgroup-body" style="--cust-cols:${cols};">${rows}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="cust-section">
        <div class="cust-section-head" data-cust-toggle="section">
          <span>${taskCat.label}</span>
          <span class="cust-chevron">▸</span>
        </div>
        <div class="cust-section-body">${groups}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-cust-toggle="section"]').forEach(head => {
    head.addEventListener('click', () => head.closest('.cust-section').classList.toggle('open'));
  });
  container.querySelectorAll('[data-cust-toggle="subgroup"]').forEach(head => {
    head.addEventListener('click', () => head.closest('.cust-subgroup').classList.toggle('open'));
  });
  container.querySelectorAll('.cust-row input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const taskCat = cb.dataset.taskCat;
      const decorId = cb.dataset.decorId;
      const arr = customizingDraft[taskCat];
      const idx = arr.indexOf(decorId);
      if (cb.checked && idx === -1) arr.push(decorId);
      if (!cb.checked && idx !== -1) arr.splice(idx, 1);
      customizingDirty = true;
      updateCustomizingSaveBar();
    });
  });
}

function updateCustomizingSaveBar() {
  const bar = document.getElementById('customizing-save-bar');
  if (bar) bar.classList.toggle('hidden', !customizingDirty);
}

// Übernimmt den Entwurf in project.customizing, speichert, schließt das
// Modal und aktualisiert die Detailseite sofort (renderProjectDetail() ->
// updateDetailTreeElements() würfelt dabei automatisch alle Aufgaben neu,
// deren bisherige Dekoration im neuen Pool nicht mehr enthalten ist, siehe
// ensureTaskDecor() in project-tree.js) — kein Zurück zur Übersicht, kein
// manuelles Neuladen nötig. Funktioniert auch ohne Änderungen sicher (der
// Button erscheint zwar nur bei customizingDirty, ein Klick — z.B. per
// erneutem Aufruf — speichert aber trotzdem einfach den aktuellen Entwurf).
function saveCustomizingDraft() {
  if (!customizingProject || !customizingDraft) return;
  const btn = document.getElementById('customizing-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Speichert …'; }
  customizingProject.customizing = {
    core:  [...customizingDraft.core],
    extra: [...customizingDraft.extra],
  };
  saveProjects();
  // Kurzer sichtbarer Speicher-Zustand, damit der Klick sich nicht "totstellt"
  // (siehe Anforderung: mehrfaches Klicken soll unnötig sein) — die
  // eigentliche Speicherung oben ist synchron und längst fertig.
  const savedProjectId = customizingProject.id;
  setTimeout(() => {
    if (btn) { btn.disabled = false; btn.textContent = 'Speichern'; }
    customizingDirty = false;
    closeCustomizingModal();
    if (currentDetailProject && currentDetailProject.id === savedProjectId) renderProjectDetail();
  }, 220);
}

function openCustomizingModal(project) {
  renderCustomizingModal(project);
  document.getElementById('project-customizing-modal-overlay').classList.remove('hidden');
}
function closeCustomizingModal() {
  document.getElementById('project-customizing-modal-overlay').classList.add('hidden');
  customizingProject = null;
  customizingDraft = null;
  customizingDirty = false;
}
document.getElementById('customizing-modal-close').addEventListener('click', closeCustomizingModal);
document.getElementById('project-customizing-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('project-customizing-modal-overlay')) closeCustomizingModal();
});
document.getElementById('customizing-save-btn').addEventListener('click', saveCustomizingDraft);
