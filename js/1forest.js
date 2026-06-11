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

    // Klick öffnet Projekt-Detailansicht
    wrap.addEventListener('click', () => openDetailFromForest(project.id));

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

// =========================
// DETAILBAUM — interaktives SVG
// =========================

function drawDetailTree(project, W, H) {
  const seed = idToSeed(project.id);
  const rng  = seededRand(seed);

  const subprojects  = project.subprojects || [];
  const isArchived   = project.archived;
  const allTasks     = subprojects.flatMap(sp => sp.tasks || []);
  const totalCore    = allTasks.filter(t => !t.isExtra).length;
  const doneCore     = allTasks.filter(t => t.done && !t.isExtra).length;
  const progress     = totalCore === 0 ? 0 : doneCore / totalCore;
  const isComplete   = progress >= 1 && totalCore > 0;

  let leafColors, trunkColor;
  if (isArchived) {
    leafColors = ['#d97706','#b45309','#dc2626','#c2410c','#f59e0b','#ea580c'];
    trunkColor = '#92400e';
  } else if (isComplete) {
    leafColors = ['#15803d','#16a34a','#166534','#4ade80','#22c55e'];
    trunkColor = '#7c5232';
  } else {
    const greenSets = [
      ['#4a7c59','#5a9467','#3d6b4a','#6aab78','#527d60'],
      ['#3f7d5a','#4e9168','#345f47','#60a270','#477258'],
      ['#527060','#628070','#425060','#72907e','#5a7d6c'],
      ['#4d6e52','#5d7e62','#3d5e42','#6d8e72','#557860'],
    ];
    leafColors = greenSets[Math.floor(rng() * greenSets.length)];
    trunkColor = '#7c5232';
  }

  const treeVar = rng();
  const cx      = W / 2;
  const baseY   = H * 0.9;

  const trunkW  = W * (0.04 + progress * 0.035 + treeVar * 0.01);
  const trunkH  = H * (0.28 + progress * 0.14 + treeVar * 0.04);
  const crownR  = W * (0.16 + progress * 0.14 + treeVar * 0.05);
  const trunkTop = baseY - trunkH;
  const crownY  = trunkTop - crownR * 0.3;

  // Sichtbare Äste (max 7 je Layer)
  const visibleSubs = subprojects.slice(0, 7);
  const branchCount = Math.max(2, visibleSubs.length);

  // Speichert Ast-Endpunkte für Blatt/Apfel-Positionierung
  const branchTips = [];

  let parts = [];

  // Schatten
  parts.push(`<ellipse cx="${cx}" cy="${baseY+4}" rx="${trunkW*3}" ry="${trunkW*0.8}" fill="rgba(0,0,0,0.07)"/>`);

  // Stamm
  parts.push(`<path d="M${cx-trunkW} ${baseY} C${cx-trunkW} ${baseY-trunkH*0.4} ${cx-trunkW*0.5} ${trunkTop+trunkH*0.1} ${cx} ${trunkTop} C${cx+trunkW*0.5} ${trunkTop+trunkH*0.1} ${cx+trunkW} ${baseY-trunkH*0.4} ${cx+trunkW} ${baseY} Z" fill="${trunkColor}" opacity="0.92"/>`);

  // Stamm-Textur
  parts.push(`<path d="M${cx-trunkW*0.2} ${baseY} Q${cx} ${baseY-trunkH*0.5} ${cx+trunkW*0.1} ${trunkTop+trunkH*0.2}" stroke="${trunkColor}" stroke-width="${trunkW*0.3}" fill="none" opacity="0.18" stroke-linecap="round"/>`);

  // Äste
  for (let i = 0; i < branchCount; i++) {
    const spread = 140;
    const angle  = -90 - spread/2 + (spread / (branchCount - 1 || 1)) * i + (rng()-0.5)*15;
    const sp     = visibleSubs[i];
    const spPct  = sp ? getSubprojectStats(sp).pct / 100 : 0;
    const bLen   = crownR * (0.7 + spPct * 0.35 + rng()*0.1);
    const bw     = trunkW * (0.55 - i*0.03);
    const rad    = angle * Math.PI / 180;
    const bx     = cx + Math.cos(rad) * bLen;
    const by     = trunkTop + trunkH*0.18 + Math.sin(rad) * bLen;
    branchTips.push({ x: bx, y: by, sp, i });

    // Ast
    parts.push(`<path d="M${cx} ${trunkTop+trunkH*0.2} Q${cx+Math.cos(rad)*bLen*0.5} ${trunkTop+trunkH*0.1+Math.sin(rad)*bLen*0.5} ${bx} ${by}" stroke="${trunkColor}" stroke-width="${Math.max(2, bw)}" fill="none" stroke-linecap="round" opacity="0.88"/>`);

    // Ast-Label (Unterprojekt-Name)
    if (sp) {
      const labelX = bx + Math.cos(rad)*18;
      const labelY = by + Math.sin(rad)*14;
      const anchor = bx < cx ? 'end' : 'start';
      parts.push(`<text x="${labelX}" y="${labelY}" text-anchor="${anchor}" font-size="${W*0.028}" font-family="DM Sans, sans-serif" fill="${trunkColor}" opacity="0.75" font-weight="500">${escapeXml(sp.title)}</text>`);
    }
  }

  // Blattwolken
  const cloudCount = 8 + Math.floor(progress * 8) + Math.floor(treeVar*4);
  for (let i = 0; i < cloudCount; i++) {
    const angle = rng()*Math.PI*2;
    const dist  = rng()*crownR*0.8;
    const lx    = cx + Math.cos(angle)*dist;
    const ly    = crownY + Math.sin(angle)*dist*0.65;
    const lr    = crownR*(0.28+rng()*0.32);
    const col   = leafColors[Math.floor(rng()*leafColors.length)];
    parts.push(`<circle cx="${lx}" cy="${ly}" r="${lr}" fill="${col}" opacity="${(0.65+rng()*0.3).toFixed(2)}"/>`);
  }

  // Interaktive Elemente pro Ast/Unterprojekt
  const detailElements = [];

  branchTips.forEach(({ x: bx, y: by, sp, i }) => {
    if (!sp) return;
    const coreTasks  = sp.tasks.filter(t => !t.isExtra);
    const extraTasks = sp.tasks.filter(t =>  t.isExtra);
    const branchRng  = seededRand(seed + i*1000 + 1);

    // Blätter um Ast-Endpunkt verteilen
    coreTasks.forEach((task, ti) => {
      const angle = branchRng()*Math.PI*2;
      const dist  = crownR*(0.08 + branchRng()*0.28);
      const lx    = bx + Math.cos(angle)*dist;
      const ly    = by + Math.sin(angle)*dist*0.7;
      const lr    = W*0.022;
      const rot   = branchRng()*360;

      if (task.done) {
        // Grünes Blatt
        const col = leafColors[Math.floor(branchRng()*leafColors.length)];
        parts.push(`<g class="detail-leaf detail-leaf--done" data-task-id="${task.id}" data-sp-id="${sp.id}" style="cursor:pointer;">
          <ellipse cx="${lx}" cy="${ly}" rx="${lr}" ry="${lr*0.6}" fill="${col}" opacity="0.95" transform="rotate(${rot} ${lx} ${ly})"/>
          <title>${escapeXml(task.text)}</title>
        </g>`);
      } else {
        // Knospe
        parts.push(`<g class="detail-leaf detail-leaf--bud" data-task-id="${task.id}" data-sp-id="${sp.id}" style="cursor:pointer;">
          <circle cx="${lx}" cy="${ly}" r="${lr*0.55}" fill="${leafColors[0]}" opacity="0.5"/>
          <circle cx="${lx}" cy="${ly}" r="${lr*0.28}" fill="${leafColors[1]}" opacity="0.7"/>
          <title>${escapeXml(task.text)}</title>
        </g>`);
      }
      detailElements.push({ id: `leaf-${task.id}`, task, sp, lx, ly });
    });

    // Äpfel für erledigte Extras
    extraTasks.filter(t => t.done).forEach((task, ti) => {
      const angle = branchRng()*Math.PI*2;
      const dist  = crownR*(0.1 + branchRng()*0.22);
      const ax    = bx + Math.cos(angle)*dist;
      const ay    = by + Math.sin(angle)*dist*0.7;
      const ar    = W*0.032;
      parts.push(`<g class="detail-apple" data-task-id="${task.id}" data-sp-id="${sp.id}" style="cursor:pointer;">
        <circle cx="${ax}" cy="${ay}" r="${ar}" fill="#dc2626" opacity="0.92"/>
        <circle cx="${ax-ar*0.28}" cy="${ay-ar*0.32}" r="${ar*0.28}" fill="#f87171" opacity="0.55"/>
        <line x1="${ax}" y1="${ay-ar}" x2="${ax+ar*0.35}" y2="${ay-ar*1.5}" stroke="${trunkColor}" stroke-width="${W*0.008}" stroke-linecap="round"/>
        <title>${escapeXml(task.text)}</title>
      </g>`);
      detailElements.push({ id: `apple-${task.id}`, task, sp, ax, ay });
    });

    // Offene Extras — kleine gelbe Knospen
    extraTasks.filter(t => !t.done).forEach((task, ti) => {
      const angle = branchRng()*Math.PI*2;
      const dist  = crownR*(0.06 + branchRng()*0.18);
      const ax    = bx + Math.cos(angle)*dist;
      const ay    = by + Math.sin(angle)*dist*0.7;
      const ar    = W*0.02;
      parts.push(`<g class="detail-apple detail-apple--bud" data-task-id="${task.id}" data-sp-id="${sp.id}" style="cursor:pointer;">
        <circle cx="${ax}" cy="${ay}" r="${ar}" fill="#f59e0b" opacity="0.45"/>
        <title>${escapeXml(task.text)}</title>
      </g>`);
    });
  });

  // Blüten bei 100%
  if (isComplete) {
    const bRng = seededRand(seed+5555);
    for (let i = 0; i < 8; i++) {
      const angle = bRng()*Math.PI*2;
      const dist  = crownR*(0.2+bRng()*0.75);
      const bx2   = cx + Math.cos(angle)*dist;
      const by2   = crownY + Math.sin(angle)*dist*0.7;
      const br    = W*0.03;
      parts.push(`<circle cx="${bx2}" cy="${by2}" r="${br}" fill="#fbcfe8" opacity="0.8"/>
        <circle cx="${bx2}" cy="${by2}" r="${br*0.45}" fill="#f9a8d4" opacity="0.9"/>`);
    }
  }

  return { svg: `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">${parts.join('')}</svg>`, detailElements };
}

function escapeXml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =========================
// PROJEKT DETAILANSICHT
// =========================

let currentDetailProject = null;
let detailSubLayer = 0; // 0 = erste 7 Äste, 1 = nächste 7

function openProjectDetail(projectId) {
  currentDetailProject = projects.find(p => p.id === projectId);
  if (!currentDetailProject) return;
  detailSubLayer = 0;
  renderProjectDetail();
  document.getElementById('proj-detail-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeProjectDetail() {
  document.getElementById('proj-detail-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  currentDetailProject = null;
}

function renderProjectDetail() {
  const p = currentDetailProject;
  if (!p) return;

  // Header-Infos
  document.getElementById('proj-detail-name').textContent = p.name;
  document.getElementById('proj-detail-desc').textContent = p.description || '';
  document.getElementById('proj-detail-status').textContent = p.archived ? 'Archiviert' : 'Aktives Projekt';
  document.getElementById('proj-detail-status').className = 'proj-detail-status-badge' + (p.archived ? ' archived' : '');

  const allTasks  = (p.subprojects||[]).flatMap(sp => sp.tasks||[]);
  const total     = allTasks.length;
  const done      = allTasks.filter(t => t.done).length;
  const pct       = total === 0 ? 0 : Math.round(done/total*100);

  document.getElementById('proj-detail-pct').textContent = pct + '%';
  document.getElementById('proj-detail-bar-fill').style.cssText = `width:${pct}%;background:${p.color||'#4a7c59'};`;
  document.getElementById('proj-detail-task-count').textContent = `${done} / ${total} Aufgaben`;
  document.getElementById('proj-detail-sub-count').textContent  = `${p.subprojects.length} Unterprojekte`;
  document.getElementById('proj-detail-startdate').textContent  = formatStartDate(p) || '—';
  document.getElementById('proj-detail-color-dot').style.background = p.color || '#4a7c59';

  // Baum zeichnen
  const treeContainer = document.getElementById('proj-detail-tree');
  const W = treeContainer.clientWidth  || 500;
  const H = treeContainer.clientHeight || 420;

  // Layer: welche Unterprojekte anzeigen?
  const layerStart = detailSubLayer * 7;
  const layeredProject = { ...p, subprojects: p.subprojects.slice(layerStart, layerStart + 7) };

  const { svg } = drawDetailTree(layeredProject, W, H);
  treeContainer.innerHTML = svg;

  // Layer-Toggle-Button
  const moreBtn = document.getElementById('proj-detail-more-branches');
  if (p.subprojects.length > 7) {
    moreBtn.style.display = '';
    const nextLayer = detailSubLayer === 0 ? 1 : 0;
    const nextStart = nextLayer * 7;
    const nextSubs  = p.subprojects.slice(nextStart, nextStart + 7);
    moreBtn.textContent = detailSubLayer === 0 ? `▸ Weitere Äste (${p.subprojects.length - 7})` : '◂ Erste Äste anzeigen';
  } else {
    moreBtn.style.display = 'none';
  }

  // Klick auf Blätter / Äpfel
  treeContainer.querySelectorAll('.detail-leaf, .detail-apple').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = el.dataset.taskId;
      const spId   = el.dataset.spId;
      const sp     = p.subprojects.find(s => s.id === spId);
      if (!sp) return;
      const task   = sp.tasks.find(t => t.id === taskId);
      if (!task) return;
      openTaskDetail(task, sp, p);
    });
  });

  // Kacheln rendern
  renderDetailTiles();
}

function renderDetailTiles() {
  const p = currentDetailProject;
  const grid = document.getElementById('proj-detail-tiles');
  grid.innerHTML = '';

  const layerStart = detailSubLayer * 7;
  const visibleSubs = p.subprojects.slice(layerStart, layerStart + 7);

  if (visibleSubs.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:20px;">Noch keine Unterprojekte. Füge über „+ Ast hinzufügen" einen hinzu.</div>';
    return;
  }

  visibleSubs.forEach(sp => {
    const stats = getSubprojectStats(sp);
    const tile  = document.createElement('div');
    tile.className = 'detail-tile';

    const tileHead = document.createElement('div');
    tileHead.className = 'detail-tile-head';

    const tileTitle = document.createElement('div');
    tileTitle.className = 'detail-tile-title';
    tileTitle.textContent = sp.title;

    const tileMeta = document.createElement('div');
    tileMeta.className = 'detail-tile-meta';
    tileMeta.textContent = `${stats.done}/${stats.total}`;

    const tileBarWrap = document.createElement('div');
    tileBarWrap.className = 'detail-tile-bar-wrap';
    const tileBar = document.createElement('div');
    tileBar.className = 'detail-tile-bar-fill';
    tileBar.style.cssText = `width:${stats.pct}%;background:${stats.pct===100?'#16a34a':(p.color||'#4a7c59')};`;
    tileBarWrap.appendChild(tileBar);

    tileHead.append(tileTitle, tileMeta);
    tile.append(tileHead, tileBarWrap);

    // Aufgaben
    const taskList = document.createElement('div');
    taskList.className = 'detail-tile-tasks';

    if (sp.tasks.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'detail-tile-empty';
      hint.textContent = 'Noch keine Aufgaben.';
      taskList.appendChild(hint);
    }

    sp.tasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'detail-tile-task-row' + (task.done ? ' done' : '') + (task.isExtra ? ' extra' : '');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = task.done;
      cb.className = 'project-task-cb';
      cb.style.accentColor = p.color || '#4a7c59';
      cb.addEventListener('change', () => {
        task.done = cb.checked;
        task.completedAt = cb.checked ? Date.now() : null;
        saveProjects();
        renderProjectDetail();
        if (forestView) renderForest();
      });

      const label = document.createElement('span');
      label.className = 'detail-tile-task-label';
      label.textContent = task.text;

      // Beschreibung/Checkliste Indikator
      const hasDetails = task.description || (task.checklist && task.checklist.length > 0);
      if (hasDetails) {
        const dot = document.createElement('span');
        dot.className = 'detail-task-has-detail';
        dot.title = 'Hat Details';
        dot.textContent = '·';
        label.appendChild(dot);
      }

      label.addEventListener('click', () => openTaskDetail(task, sp, p));
      label.style.cursor = 'pointer';

      const extraBadge = task.isExtra ? (() => {
        const b = document.createElement('span');
        b.className = 'detail-tile-extra-badge';
        b.textContent = '✦';
        return b;
      })() : null;

      row.append(cb, label);
      if (extraBadge) row.appendChild(extraBadge);
      taskList.appendChild(row);
    });

    // + Aufgabe Button
    const addBtn = document.createElement('button');
    addBtn.className = 'detail-tile-add-btn';
    addBtn.textContent = '+ Aufgabe hinzufügen';
    addBtn.addEventListener('click', () => {
      openAddTaskModalFromDetail(p.id, sp.id);
    });
    taskList.appendChild(addBtn);

    tile.appendChild(taskList);
    grid.appendChild(tile);
  });
}

// =========================
// AUFGABE DETAIL MODAL
// =========================

let currentTaskDetail = null;

function openTaskDetail(task, sp, project) {
  currentTaskDetail = { task, sp, project };
  document.getElementById('task-detail-title').textContent  = task.text;
  document.getElementById('task-detail-sp').textContent     = sp.title;
  document.getElementById('task-detail-type').textContent   = task.isExtra ? '✦ Extra' : '◉ Kernaufgabe';
  document.getElementById('task-detail-desc').value         = task.description || '';
  document.getElementById('task-detail-done-cb').checked    = task.done;

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
    cb.type = 'checkbox';
    cb.checked = item.done;
    cb.className = 'project-task-cb';
    cb.addEventListener('change', () => {
      item.done = cb.checked;
      saveProjects();
      renderTaskDetailChecklist();
    });
    const lbl = document.createElement('span');
    lbl.className = 'task-cl-label';
    lbl.textContent = item.text;
    const del = document.createElement('button');
    del.className = 'task-delete';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      task.checklist.splice(i, 1);
      saveProjects();
      renderTaskDetailChecklist();
    });
    row.append(cb, lbl, del);
    list.appendChild(row);
  });
}

document.getElementById('task-detail-desc').addEventListener('input', () => {
  if (!currentTaskDetail) return;
  currentTaskDetail.task.description = document.getElementById('task-detail-desc').value;
  saveProjects();
});

document.getElementById('task-detail-done-cb').addEventListener('change', () => {
  if (!currentTaskDetail) return;
  currentTaskDetail.task.done = document.getElementById('task-detail-done-cb').checked;
  currentTaskDetail.task.completedAt = currentTaskDetail.task.done ? Date.now() : null;
  saveProjects();
  renderProjectDetail();
});

document.getElementById('task-detail-add-cl').addEventListener('click', () => {
  const input = document.getElementById('task-detail-cl-input');
  const text  = input.value.trim();
  if (!text || !currentTaskDetail) return;
  if (!currentTaskDetail.task.checklist) currentTaskDetail.task.checklist = [];
  currentTaskDetail.task.checklist.push({ id: crypto.randomUUID(), text, done: false });
  input.value = '';
  saveProjects();
  renderTaskDetailChecklist();
});

document.getElementById('task-detail-cl-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('task-detail-add-cl').click();
});

document.getElementById('task-detail-close').addEventListener('click', closeTaskDetail);
document.getElementById('task-detail-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('task-detail-overlay')) closeTaskDetail();
});

// =========================
// AUFGABE AUS DETAIL HINZUFÜGEN
// =========================

function openAddTaskModalFromDetail(projectId, subprojectId) {
  // Schließt task-detail falls offen
  closeTaskDetail();
  // Setzt addTask-Vars und öffnet Modal mit Extra-Toggle
  addTaskTargetProjectId    = projectId;
  addTaskIsExtra            = false;
  addTaskTargetSubprojectId = subprojectId;

  const proj = projects.find(p => p.id === projectId);
  const sp   = (proj.subprojects||[]).find(s => s.id === subprojectId);

  document.getElementById('project-task-modal-title').textContent = `Aufgabe zu „${sp ? sp.title : ''}"`;
  document.getElementById('project-task-input').value = '';
  document.getElementById('project-task-desc-input').value = '';

  // Extra Toggle zurücksetzen
  document.getElementById('task-type-core').classList.add('active');
  document.getElementById('task-type-extra').classList.remove('active');
  addTaskIsExtra = false;

  document.getElementById('project-task-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('project-task-input').focus(), 50);
}

// Extra Toggle im Aufgaben-Modal
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

// Detail-Overlay Events
document.getElementById('proj-detail-close').addEventListener('click', closeProjectDetail);
document.getElementById('proj-detail-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('proj-detail-overlay')) closeProjectDetail();
});
document.getElementById('proj-detail-back').addEventListener('click', () => {
  closeProjectDetail();
  switchToForestView();
});
document.getElementById('proj-detail-more-branches').addEventListener('click', () => {
  detailSubLayer = detailSubLayer === 0 ? 1 : 0;
  renderProjectDetail();
});
document.getElementById('proj-detail-add-branch').addEventListener('click', () => {
  closeProjectDetail();
  openAddSubprojectModal(currentDetailProject ? currentDetailProject.id : null);
});

// Wald-Klick → Detailansicht (überschreibt alten Klick-Handler)
function openDetailFromForest(projectId) {
  openProjectDetail(projectId);
}
