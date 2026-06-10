// =========================
// PROJEKTWALD
// =========================

let forestView = DB.get('projectForestView', false);

// =========================
// SEEDED RANDOM
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
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// =========================
// BAUM ZEICHNEN
// =========================

function drawTree(project, size) {
  const seed = idToSeed(project.id);
  const rng  = seededRand(seed);

  // Alle Aufgaben aus Unterprojekten sammeln
  const subprojects = project.subprojects || [];
  const allTasks    = subprojects.flatMap(sp => sp.tasks || []);
  const totalTasks  = allTasks.length;
  const doneTasks   = allTasks.filter(t => t.done && !t.isExtra).length;
  const extraDone   = allTasks.filter(t => t.done && t.isExtra).length;
  const progress    = totalTasks === 0 ? 0 : doneTasks / totalTasks;

  // Status bestimmen
  const isArchived  = project.archived;
  const isComplete  = progress >= 1 && totalTasks > 0;

  // Farbpalette je nach Status
  let leafColors, trunkColor, groundColor;
  if (isArchived) {
    // Herbst
    leafColors  = ['#d97706','#b45309','#dc2626','#c2410c','#f59e0b','#ea580c'];
    trunkColor  = '#92400e';
    groundColor = '#a16207';
  } else if (isComplete) {
    // Vollständig — besonders satte Farben + Blüten
    leafColors  = ['#15803d','#16a34a','#166534','#4ade80','#22c55e'];
    trunkColor  = '#7c5232';
    groundColor = '#166534';
  } else {
    // Aktiv — grün, variiert per Seed
    const greenSets = [
      ['#4a7c59','#5a9467','#3d6b4a','#6aab78','#527d60'],
      ['#3f7d5a','#4e9168','#345f47','#60a270','#477258'],
      ['#527060','#628070','#425060','#72907e','#5a7d6c'],
      ['#4d6e52','#5d7e62','#3d5e42','#6d8e72','#557860'],
    ];
    const setIdx   = Math.floor(rng() * greenSets.length);
    leafColors     = greenSets[setIdx];
    trunkColor     = '#7c5232';
    groundColor    = '#4a7c59';
  }

  // Baumparameter aus Fortschritt + Seed
  const treeVar  = rng(); // 0..1 individuelle Baumform
  const W        = size;
  const H        = size;
  const cx       = W / 2;
  const baseY    = H * 0.88;

  // Stammgröße wächst mit Fortschritt
  const minTrunk = size * 0.06;
  const maxTrunk = size * 0.14;
  const trunkW   = minTrunk + progress * (maxTrunk - minTrunk);
  const trunkH   = size * (0.22 + progress * 0.18 + treeVar * 0.06);

  // Krone
  const crownR   = size * (0.18 + progress * 0.22 + treeVar * 0.08);
  const crownY   = baseY - trunkH - crownR * 0.5;

  // Astanzahl = Anzahl Unterprojekte (min 2, max 6 für Wald)
  const branchCount = Math.max(2, Math.min(subprojects.length, size > 80 ? 6 : 4));

  let svgParts = [];

  // --- Hintergrund-Schatten ---
  svgParts.push(`<ellipse cx="${cx}" cy="${baseY + 2}" rx="${trunkW * 2.5}" ry="${trunkW * 0.6}" fill="rgba(0,0,0,0.08)"/>`);

  // --- Stamm ---
  const trunkTop = baseY - trunkH;
  svgParts.push(`
    <path d="M${cx - trunkW/2} ${baseY} 
             C${cx - trunkW/2} ${baseY - trunkH*0.3} ${cx - trunkW*0.3} ${trunkTop + trunkH*0.1} ${cx} ${trunkTop}
             C${cx + trunkW*0.3} ${trunkTop + trunkH*0.1} ${cx + trunkW/2} ${baseY - trunkH*0.3} ${cx + trunkW/2} ${baseY} Z"
          fill="${trunkColor}" opacity="0.9"/>
  `);

  // --- Äste (je Unterprojekt) ---
  const angles = [];
  for (let i = 0; i < branchCount; i++) {
    const baseAngle = -90;
    const spread    = 130;
    const angle     = baseAngle - spread/2 + (spread / (branchCount - 1 || 1)) * i + (rng() - 0.5) * 18;
    angles.push(angle);

    const spIdx    = i % subprojects.length;
    const sp       = subprojects[spIdx];
    const spStats  = sp ? getSubprojectStats(sp) : { pct: 0 };
    const branchLen = crownR * (0.55 + spStats.pct / 100 * 0.3 + rng() * 0.15);
    const bw        = trunkW * (0.35 - i * 0.02);

    const rad   = angle * Math.PI / 180;
    const bx    = cx + Math.cos(rad) * branchLen;
    const by    = trunkTop + trunkH * 0.15 + Math.sin(rad) * branchLen;

    svgParts.push(`
      <line x1="${cx}" y1="${trunkTop + trunkH * 0.2}" 
            x2="${bx}" y2="${by}"
            stroke="${trunkColor}" stroke-width="${Math.max(1.5, bw)}" 
            stroke-linecap="round" opacity="0.85"/>
    `);
  }

  // --- Blattwolken ---
  // Mehrere überlappende Kreise ergeben eine organische Krone
  const cloudCount = 5 + Math.floor(progress * 6) + Math.floor(treeVar * 4);
  for (let i = 0; i < cloudCount; i++) {
    const angle  = rng() * Math.PI * 2;
    const dist   = rng() * crownR * 0.75;
    const lx     = cx + Math.cos(angle) * dist;
    const ly     = crownY + Math.sin(angle) * dist * 0.7;
    const lr     = crownR * (0.3 + rng() * 0.35);
    const col    = leafColors[Math.floor(rng() * leafColors.length)];
    const alpha  = 0.7 + rng() * 0.3;
    svgParts.push(`<circle cx="${lx}" cy="${ly}" r="${lr}" fill="${col}" opacity="${alpha.toFixed(2)}"/>`);
  }

  // --- Einzelne Blätter für erledigte Kernaufgaben (nur bei größeren Bäumen) ---
  if (size > 80 && doneTasks > 0) {
    const leafRng = seededRand(seed + 999);
    const maxLeaves = Math.min(doneTasks, 18);
    for (let i = 0; i < maxLeaves; i++) {
      const angle = leafRng() * Math.PI * 2;
      const dist  = crownR * (0.2 + leafRng() * 0.85);
      const lx    = cx + Math.cos(angle) * dist;
      const ly    = crownY + Math.sin(angle) * dist * 0.75;
      const col   = leafColors[Math.floor(leafRng() * leafColors.length)];
      // Kleines Blatt-Shape
      svgParts.push(`
        <ellipse cx="${lx}" cy="${ly}" rx="${size*0.028}" ry="${size*0.018}" 
                 fill="${col}" opacity="0.9"
                 transform="rotate(${leafRng()*360} ${lx} ${ly})"/>
      `);
    }
  }

  // --- Äpfel für erledigte Extra-Aufgaben ---
  if (extraDone > 0) {
    const appleRng = seededRand(seed + 7777);
    const maxApples = Math.min(extraDone, 8);
    for (let i = 0; i < maxApples; i++) {
      const angle = appleRng() * Math.PI * 2;
      const dist  = crownR * (0.3 + appleRng() * 0.65);
      const ax    = cx + Math.cos(angle) * dist;
      const ay    = crownY + Math.sin(angle) * dist * 0.7;
      const ar    = size * 0.045;
      svgParts.push(`
        <circle cx="${ax}" cy="${ay}" r="${ar}" fill="#dc2626" opacity="0.9"/>
        <circle cx="${ax - ar*0.25}" cy="${ay - ar*0.3}" r="${ar*0.25}" fill="#f87171" opacity="0.6"/>
        <line x1="${ax}" y1="${ay - ar}" x2="${ax + ar*0.3}" y2="${ay - ar*1.4}" 
              stroke="#7c5232" stroke-width="${Math.max(1,size*0.012)}" stroke-linecap="round"/>
      `);
    }
  }

  // --- Blüten wenn 100% ---
  if (isComplete && size > 80) {
    const bloomRng = seededRand(seed + 5555);
    for (let i = 0; i < 7; i++) {
      const angle = bloomRng() * Math.PI * 2;
      const dist  = crownR * (0.2 + bloomRng() * 0.8);
      const bx    = cx + Math.cos(angle) * dist;
      const by    = crownY + Math.sin(angle) * dist * 0.75;
      const br    = size * 0.038;
      svgParts.push(`
        <circle cx="${bx}" cy="${by}" r="${br}" fill="#fbcfe8" opacity="0.85"/>
        <circle cx="${bx}" cy="${by}" r="${br*0.45}" fill="#f9a8d4" opacity="0.9"/>
      `);
    }
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">${svgParts.join('')}</svg>`;
}

// =========================
// WALD HINTERGRUND
// =========================

function getForestBackground() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8ede4" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#d4dbc8" stop-opacity="0.3"/>
    </linearGradient>
    <linearGradient id="hillGrad1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#b8c9a3" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#a0b88a" stop-opacity="0.2"/>
    </linearGradient>
    <linearGradient id="hillGrad2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c8d6b0" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#b0c49a" stop-opacity="0.15"/>
    </linearGradient>
    <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c4d4a8" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#b0c090" stop-opacity="0.25"/>
    </linearGradient>
  </defs>

  <!-- Himmel -->
  <rect width="1200" height="700" fill="url(#skyGrad)"/>

  <!-- Hügel hinten -->
  <ellipse cx="250" cy="520" rx="380" ry="180" fill="url(#hillGrad1)"/>
  <ellipse cx="750" cy="540" rx="420" ry="160" fill="url(#hillGrad2)"/>
  <ellipse cx="1100" cy="530" rx="300" ry="150" fill="url(#hillGrad1)"/>

  <!-- Berge / Hügel ganz hinten -->
  <path d="M0 480 Q150 360 300 420 Q450 360 600 400 Q750 340 900 390 Q1050 340 1200 380 L1200 700 L0 700Z" fill="#c8d4b4" opacity="0.18"/>

  <!-- Hauptboden -->
  <path d="M0 600 Q300 580 600 590 Q900 600 1200 585 L1200 700 L0 700Z" fill="url(#groundGrad)"/>

  <!-- Weg -->
  <path d="M480 700 Q520 640 540 590 Q560 540 580 500" stroke="#c8bb96" stroke-width="28" fill="none" opacity="0.22" stroke-linecap="round"/>
  <path d="M480 700 Q520 640 540 590 Q560 540 580 500" stroke="#d4c8a0" stroke-width="14" fill="none" opacity="0.18" stroke-linecap="round"/>

  <!-- Gras-Texttur vorne -->
  <path d="M0 630 Q100 618 200 625 Q350 615 500 622 Q650 612 800 620 Q950 610 1100 618 Q1150 614 1200 616 L1200 700 L0 700Z" fill="#b8cc98" opacity="0.22"/>

  <!-- Büsche links -->
  <ellipse cx="80" cy="615" rx="45" ry="25" fill="#8aab72" opacity="0.22"/>
  <ellipse cx="110" cy="608" rx="35" ry="20" fill="#9abb82" opacity="0.2"/>
  <ellipse cx="55" cy="618" rx="30" ry="18" fill="#7a9b62" opacity="0.18"/>

  <!-- Büsche rechts -->
  <ellipse cx="1100" cy="618" rx="50" ry="26" fill="#8aab72" opacity="0.2"/>
  <ellipse cx="1140" cy="612" rx="38" ry="20" fill="#9abb82" opacity="0.18"/>
  <ellipse cx="1070" cy="620" rx="32" ry="18" fill="#7a9b62" opacity="0.16"/>

  <!-- Büsche mitte -->
  <ellipse cx="380" cy="625" rx="30" ry="16" fill="#8aab72" opacity="0.17"/>
  <ellipse cx="820" cy="622" rx="28" ry="15" fill="#9abb82" opacity="0.16"/>

  <!-- Kleine Steine -->
  <ellipse cx="200" cy="638" rx="12" ry="6" fill="#b0b09a" opacity="0.2"/>
  <ellipse cx="900" cy="642" rx="9" ry="5" fill="#b0b09a" opacity="0.18"/>
  <ellipse cx="650" cy="650" rx="7" ry="4" fill="#a8a890" opacity="0.16"/>

  <!-- Blumen -->
  <circle cx="160" cy="630" r="4" fill="#f0d080" opacity="0.3"/>
  <circle cx="168" cy="628" r="3" fill="#f0e080" opacity="0.28"/>
  <circle cx="960" cy="632" r="4" fill="#f0d080" opacity="0.28"/>
  <circle cx="970" cy="629" r="3" fill="#e8c878" opacity="0.25"/>
  <circle cx="430" cy="638" r="3" fill="#f0d080" opacity="0.25"/>
  <circle cx="720" cy="635" r="4" fill="#f0e080" opacity="0.25"/>

  <!-- Baumstumpf -->
  <rect x="280" y="618" width="22" height="14" rx="3" fill="#8a6a42" opacity="0.18"/>
  <ellipse cx="291" cy="618" rx="11" ry="5" fill="#a07a52" opacity="0.18"/>

  <!-- Kleiner Bach -->
  <path d="M0 660 Q200 650 400 658 Q500 662 600 660" stroke="#a8c4d8" stroke-width="6" fill="none" opacity="0.15" stroke-linecap="round"/>
</svg>`;
}

// =========================
// WALD RENDERN
// =========================

function renderForest() {
  const container = document.getElementById('project-forest');
  if (!container) return;
  container.innerHTML = '';

  // Hintergrund
  const bgWrap = document.createElement('div');
  bgWrap.className = 'forest-bg';
  bgWrap.innerHTML = getForestBackground();
  container.appendChild(bgWrap);

  const allProjects = projects; // aktive + archivierte
  if (allProjects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'forest-empty';
    empty.textContent = 'Dein Wald ist noch leer. Erstelle dein erstes Projekt.';
    container.appendChild(empty);
    return;
  }

  // Bäume positionieren — grid-ähnlich aber leicht versetzt
  const cols   = Math.min(allProjects.length, 4);
  const rows   = Math.ceil(allProjects.length / cols);
  const treeSize = Math.min(180, Math.max(120, Math.floor(container.clientWidth / (cols + 0.5))));

  allProjects.forEach((project, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rng = seededRand(idToSeed(project.id) + 42);

    // Leichte organische Verschiebung
    const jitterX = (rng() - 0.5) * 40;
    const jitterY = (rng() - 0.5) * 20;

    // X: gleichmäßig verteilt
    const colW  = 100 / (cols);
    const xPct  = colW * col + colW / 2 + jitterX / 12;
    // Y: Reihen mit leichter Staffelung — weiter hinten = höher im Bild
    const yBase = 25 + row * (55 / Math.max(rows, 1));
    const yPct  = Math.min(78, yBase + jitterY / 8);

    const wrap = document.createElement('div');
    wrap.className = 'forest-tree-wrap' + (project.archived ? ' archived' : '');
    wrap.style.cssText = `left:${xPct}%;top:${yPct}%;width:${treeSize}px;`;

    // SVG Baum
    const svgWrap = document.createElement('div');
    svgWrap.className = 'forest-tree-svg';
    svgWrap.innerHTML = drawTree(project, treeSize);
    svgWrap.title = project.name;

    // Label
    const label = document.createElement('div');
    label.className = 'forest-tree-label';

    const allTasks = (project.subprojects || []).flatMap(sp => sp.tasks || []);
    const total    = allTasks.length;
    const done     = allTasks.filter(t => t.done).length;
    const pct      = total === 0 ? 0 : Math.round(done / total * 100);

    const statusDot = document.createElement('span');
    statusDot.className = 'forest-tree-dot';
    statusDot.style.background = project.archived ? '#d97706' : (pct === 100 ? '#16a34a' : (project.color || '#4a7c59'));

    label.innerHTML = `<span class="forest-tree-name">${project.name}</span>`;

    const progressRow = document.createElement('div');
    progressRow.className = 'forest-tree-progress';
    const bar = document.createElement('div');
    bar.className = 'forest-tree-bar';
    const fill = document.createElement('div');
    fill.className = 'forest-tree-bar-fill';
    fill.style.cssText = `width:${pct}%;background:${project.archived ? '#d97706' : (project.color || '#4a7c59')};`;
    bar.appendChild(fill);
    const pctLabel = document.createElement('span');
    pctLabel.className = 'forest-tree-pct';
    pctLabel.textContent = `${pct}%`;
    progressRow.append(bar, pctLabel);

    const labelTop = document.createElement('div');
    labelTop.style.cssText = 'display:flex;align-items:center;gap:4px;';
    labelTop.append(statusDot, label.querySelector('.forest-tree-name'));

    const labelBox = document.createElement('div');
    labelBox.className = 'forest-tree-label';
    labelBox.append(labelTop, progressRow);

    wrap.append(svgWrap, labelBox);

    // Klick öffnet Projekt (Karten-Ansicht wechseln + Projekt aufklappen)
    wrap.addEventListener('click', () => {
      switchToCardView();
      setTimeout(() => {
        projectCollapsed[project.id] = false;
        saveCollapseState();
        renderProjects();
        const card = document.getElementById(`proj-card-${project.id}`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    });

    container.appendChild(wrap);
  });
}

// =========================
// TOGGLE LOGIK
// =========================

function switchToCardView() {
  forestView = false;
  DB.set('projectForestView', false);
  document.getElementById('project-grid').style.display   = '';
  document.getElementById('project-forest').style.display = 'none';
  document.getElementById('proj-view-cards').classList.add('active');
  document.getElementById('proj-view-forest').classList.remove('active');
}

function switchToForestView() {
  forestView = true;
  DB.set('projectForestView', true);
  document.getElementById('project-grid').style.display   = 'none';
  document.getElementById('project-forest').style.display = '';
  document.getElementById('proj-view-cards').classList.remove('active');
  document.getElementById('proj-view-forest').classList.add('active');
  renderForest();
}

document.getElementById('proj-view-cards').addEventListener('click', switchToCardView);
document.getElementById('proj-view-forest').addEventListener('click', switchToForestView);

// Beim Init den gespeicherten View-State anwenden
if (forestView) {
  switchToForestView();
}
