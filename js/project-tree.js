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
// TREE_PNG_COUNT PNG-Baumvarianten (img/tree_<n>.png / tree_<n>_fall.png)
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
// Welche Objekte dafür zur Auswahl stehen, ist zentral hier registriert —
// eine neue Sorte hinzufügen heißt: einen weiteren Eintrag ergänzen (id,
// category 'obst'|'blumen', label fürs Customizing-UI, src fürs PNG auf dem
// Baum/in der Vorschau). Kein weiterer Code nötig, siehe renderCustomizing-
// Modal()/openCustomizingModal() in forest.js für das Auswahl-UI und
// DEFAULT_CUSTOMIZING/getCustomizingPool()/ensureTaskDecor() unten für die
// Verwendung.
// =========================
const DECOR_REGISTRY = {
  apple:         { id: 'apple',         category: 'obst',   label: 'Apfel',       src: 'img/apple.png' },
  cherryblossom: { id: 'cherryblossom', category: 'blumen', label: 'Kirschblüte', src: 'img/cherryblossom.png' },
};

// Fallback für Projekte ohne eigene Customizing-Auswahl (bzw. wenn der Nutzer
// eine Kategorie komplett leer geräumt hat) — entspricht dem bisherigen,
// fest verdrahteten Verhalten: Hauptaufgaben -> Apfel, Extraaufgaben ->
// Kirschblüte.
const DEFAULT_CUSTOMIZING = {
  core:  ['apple'],
  extra: ['cherryblossom'],
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

// Würfelt (bei Bedarf) EINMALIG das Deko-Objekt einer erledigten Aufgabe und
// speichert es auf der Aufgabe selbst (task.decorId) — dadurch bleibt eine
// einmal gewachsene Frucht/Blume für immer dieselbe, unabhängig von späteren
// Reloads oder einer geänderten Customizing-Auswahl (die betrifft dann nur
// noch NEU erledigte Aufgaben). Die Wahrscheinlichkeit wird bewusst nicht
// als fester Wert gespeichert, sondern bei jedem Wurf live aus der aktuellen
// Poolgröße berechnet (1/Anzahl) — funktioniert dadurch unverändert bei 2,
// 5 oder später 20 Objekten. Gibt true zurück, wenn dabei etwas geändert
// wurde (Aufrufer sollte dann speichern), sonst false.
function ensureTaskDecor(task, project) {
  if (!task.done) return false;
  if (task.decorId && DECOR_REGISTRY[task.decorId]) return false;
  const pool = getCustomizingPool(project, task.isExtra ? 'extra' : 'core');
  task.decorId = pool[Math.floor(Math.random() * pool.length)];
  return true;
}

// =========================
// APFEL-/BLÜTEN-DEKO (Detailbaum)
// Feste Positionen (in % der Bildfläche) innerhalb der Baumkrone, an denen
// die Deko-Objekte erledigter Kern- bzw. Extraaufgaben auf dem PNG-Baum
// "sitzen". Rein dekorativ — die eigentliche Aufgabenliste (Klicken,
// Abhaken, Details) läuft weiterhin über die Äste-Kacheln
// (#proj-detail-tiles, renderDetailTiles() in forest.js). Reicht die Anzahl
// erledigter Aufgaben über die Slotzahl hinaus, wird gedeckelt (Deko, kein
// 1:1-Protokoll).
//
// Positionen werden nicht fest vorgegeben, sondern innerhalb einer Ellipse
// zufällig gestreut, die die Baumkrone aller 5 PNG-Varianten sicher trifft
// (Krone sitzt bei allen Varianten grob mittig oben, Stamm/Boden im unteren
// Drittel — die Ellipse bleibt bewusst konservativ innerhalb der
// Blattmasse). Seed = Projekt-ID + fester Salt, damit die Streuung pro
// Projekt stabil bleibt (kein Neu-Würfeln bei jedem Re-Render) und Kern-
// bzw. Extraaufgaben jeweils ihr eigenes, unabhängiges Muster bekommen. Die
// Position hängt am INDEX innerhalb der erledigten Aufgaben derselben Art
// (nicht an der Aufgaben-ID) — welches konkrete Deko-Objekt (Apfel,
// Kirschblüte, ...) dort sitzt, kommt separat aus task.decorId.
// =========================
const CANOPY_ELLIPSE = { cx: 50, cy: 34, rx: 38, ry: 28 };
const DECOR_MAX = 8;

function generateCanopySlots(project, saltOffset, count) {
  const rng = seededRand(idToSeed(project.id) + saltOffset);
  const { cx, cy, rx, ry } = CANOPY_ELLIPSE;
  const slots = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const r     = Math.sqrt(rng()) * 0.85; // gleichverteilt in der Fläche, mit Rand zur Kronenkante
    slots.push({ x: cx + Math.cos(angle) * rx * r, y: cy + Math.sin(angle) * ry * r });
  }
  return slots;
}

// =========================
// DETAILBAUM (PNG + Deko) AKTUALISIEREN
// =========================
function updateDetailTreeElements(p) {
  const treeContainer = document.getElementById('proj-detail-tree');
  if (!treeContainer) return;

  const variant     = getOrAssignTreeVariant(p);
  const season      = p.archived ? '_fall' : '';
  const primarySrc  = `img/tree_${variant}${season}.png`;
  const fallbackSrc = `img/tree_1${season}.png`;

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
    const cls = entry.category === 'blumen' ? 'pdt-tree-decor-blumen' : '';
    return `<img class="pdt-tree-decor-item ${cls}" src="${entry.src}" alt="${escapeXml(entry.label)}" draggable="false" style="left:${slot.x}%;top:${slot.y}%;" />`;
  }

  const decor = [
    ...generateCanopySlots(p, 401, coreDone.length).map((slot, i) => decorImg(coreDone[i], slot)),
    ...generateCanopySlots(p, 907, extraDone.length).map((slot, i) => decorImg(extraDone[i], slot)),
  ].join('');

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
