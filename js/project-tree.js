// =========================
// PROJECT-TREE.JS  (v2 — Baukasten-System)
// Verantwortlich NUR für:
//   - Baumstruktur (Stamm-Varianten, Ast-Varianten, Blatt-/Apfel-Slots)
//   - Kleinen Waldbaum rendern  → drawTree(project, size)
//   - Großen Detailbaum rendern → drawDetailTree(project, W, H, layerStart)
//   - Baum-Elemente aktualisieren → updateDetailTreeElements(project)
//
// Schnittstelle nach außen:
//   drawTree(project, size)                         → SVG-String
//   drawDetailTree(project, W, H, layerStart)       → SVG-String
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
// STAMM-VARIANTEN
// Koordinaten im normalisierten Raum: cx=0, baseY=0, Stamm geht nach oben (negative Y)
// Wird skaliert auf tatsächliche Größe per transform.
// Jeder Stamm liefert:
//   path       – SVG-Pfad-String (d-Attribut), relative Koordinaten um cx=0, base=0
//   textureLines – zusätzliche Pfade für Rindentextur
//   height     – normalisierte Stammhöhe (für Ast-Ankerpunkt)
//   trunkTopY  – Y-Position der Stammspitze (negativ)
//   branchSlots – 7 feste Ast-Anschlusspunkte [{x, y, defaultAngle}]
//                 x/y normalisiert relativ zur Stammbasis
// =========================
const TRUNK_VARIANTS = [
  // Variante A – gerader, kräftiger Stamm (Eiche-Stil)
  {
    id: 'A',
    draw: function(cx, baseY, scale) {
      const tw = 18 * scale, th = 140 * scale;
      const top = baseY - th;
      const parts = [];
      // Hauptstamm mit leichter Verjüngung
      parts.push(`<path d="M${cx-tw} ${baseY} C${cx-tw} ${baseY-th*0.3} ${cx-tw*0.55} ${top+th*0.1} ${cx-tw*0.3} ${top} L${cx+tw*0.3} ${top} C${cx+tw*0.55} ${top+th*0.1} ${cx+tw} ${baseY-th*0.3} ${cx+tw} ${baseY} Z"/>`);
      // Wurzelansätze
      parts.push(`<path d="M${cx-tw*0.7} ${baseY} Q${cx-tw*2.2} ${baseY+th*0.04} ${cx-tw*3} ${baseY+th*0.02} Q${cx-tw*1.8} ${baseY-th*0.06} ${cx-tw} ${baseY-th*0.05} Z"/>`);
      parts.push(`<path d="M${cx+tw*0.7} ${baseY} Q${cx+tw*2.2} ${baseY+th*0.04} ${cx+tw*3} ${baseY+th*0.02} Q${cx+tw*1.8} ${baseY-th*0.06} ${cx+tw} ${baseY-th*0.05} Z"/>`);
      // Rindentextur
      parts.push(`<path d="M${cx-tw*0.1} ${baseY-th*0.08} Q${cx+tw*0.2} ${baseY-th*0.35} ${cx-tw*0.05} ${top+th*0.18}" stroke="rgba(0,0,0,0.12)" stroke-width="${scale*2.5}" fill="none" stroke-linecap="round"/>`);
      parts.push(`<path d="M${cx+tw*0.15} ${baseY-th*0.14} Q${cx-tw*0.15} ${baseY-th*0.5} ${cx+tw*0.1} ${top+th*0.3}" stroke="rgba(0,0,0,0.08)" stroke-width="${scale*1.8}" fill="none" stroke-linecap="round"/>`);
      parts.push(`<path d="M${cx-tw*0.35} ${baseY-th*0.22} Q${cx-tw*0.1} ${baseY-th*0.6} ${cx-tw*0.2} ${top+th*0.4}" stroke="rgba(0,0,0,0.07)" stroke-width="${scale*1.5}" fill="none" stroke-linecap="round"/>`);
      return parts.join('');
    },
    trunkHeightFactor: 0.55, // relativ zur Gesamthöhe H
    branchSlots: [
      // [normX relativ zu cx, normY relativ zur Stammbasis nach oben]
      { nx: -0.5, ny: 0.38, baseAngle: -145 }, // links unten
      { nx:  0.5, ny: 0.42, baseAngle:  -35 }, // rechts unten
      { nx: -0.6, ny: 0.56, baseAngle: -155 }, // links mitte
      { nx:  0.6, ny: 0.60, baseAngle:  -25 }, // rechts mitte
      { nx: -0.5, ny: 0.72, baseAngle: -160 }, // links oben
      { nx:  0.5, ny: 0.75, baseAngle:  -20 }, // rechts oben
      { nx:  0.0, ny: 0.88, baseAngle:  -90 }, // oben mitte
    ]
  },
  // Variante B – leicht geschwungener Stamm
  {
    id: 'B',
    draw: function(cx, baseY, scale) {
      const tw = 16 * scale, th = 135 * scale;
      const top = baseY - th;
      const lean = scale * 8; // leichte Neigung nach rechts
      const parts = [];
      parts.push(`<path d="M${cx-tw} ${baseY} C${cx-tw+lean*0.3} ${baseY-th*0.3} ${cx+lean*0.7-tw*0.5} ${top+th*0.1} ${cx+lean-tw*0.25} ${top} L${cx+lean+tw*0.25} ${top} C${cx+lean+tw*0.5} ${top+th*0.1} ${cx+lean*0.7+tw*0.5} ${baseY-th*0.3} ${cx+tw} ${baseY} Z"/>`);
      // Wurzeln
      parts.push(`<path d="M${cx-tw*0.6} ${baseY} Q${cx-tw*2.5} ${baseY+th*0.05} ${cx-tw*3.2} ${baseY+th*0.01} Q${cx-tw*1.6} ${baseY-th*0.07} ${cx-tw} ${baseY-th*0.05} Z"/>`);
      parts.push(`<path d="M${cx+tw*0.6} ${baseY} Q${cx+tw*2.0} ${baseY+th*0.04} ${cx+tw*2.8} ${baseY+th*0.01} Q${cx+tw*1.5} ${baseY-th*0.06} ${cx+tw} ${baseY-th*0.04} Z"/>`);
      // Textur
      parts.push(`<path d="M${cx} ${baseY-th*0.1} Q${cx+lean*0.5+tw*0.1} ${baseY-th*0.45} ${cx+lean-tw*0.05} ${top+th*0.2}" stroke="rgba(0,0,0,0.11)" stroke-width="${scale*2.2}" fill="none" stroke-linecap="round"/>`);
      parts.push(`<path d="M${cx+tw*0.2} ${baseY-th*0.18} Q${cx+lean*0.3-tw*0.1} ${baseY-th*0.55} ${cx+lean+tw*0.15} ${top+th*0.35}" stroke="rgba(0,0,0,0.07)" stroke-width="${scale*1.5}" fill="none" stroke-linecap="round"/>`);
      return parts.join('');
    },
    trunkHeightFactor: 0.52,
    branchSlots: [
      { nx: -0.55, ny: 0.36, baseAngle: -148 },
      { nx:  0.55, ny: 0.40, baseAngle:  -32 },
      { nx: -0.62, ny: 0.54, baseAngle: -158 },
      { nx:  0.58, ny: 0.58, baseAngle:  -22 },
      { nx: -0.48, ny: 0.70, baseAngle: -162 },
      { nx:  0.48, ny: 0.73, baseAngle:  -18 },
      { nx:  0.05, ny: 0.86, baseAngle:  -88 },
    ]
  },
  // Variante C – breit und knorriger Stamm
  {
    id: 'C',
    draw: function(cx, baseY, scale) {
      const tw = 22 * scale, th = 120 * scale;
      const top = baseY - th;
      const parts = [];
      // Knorriger Stamm mit Einbuchtung
      parts.push(`<path d="M${cx-tw} ${baseY} C${cx-tw*1.1} ${baseY-th*0.25} ${cx-tw*0.7} ${baseY-th*0.5} ${cx-tw*0.8} ${baseY-th*0.65} C${cx-tw*0.65} ${baseY-th*0.75} ${cx-tw*0.4} ${top+th*0.18} ${cx-tw*0.35} ${top} L${cx+tw*0.35} ${top} C${cx+tw*0.4} ${top+th*0.18} ${cx+tw*0.65} ${baseY-th*0.75} ${cx+tw*0.8} ${baseY-th*0.65} C${cx+tw*0.7} ${baseY-th*0.5} ${cx+tw*1.1} ${baseY-th*0.25} ${cx+tw} ${baseY} Z"/>`);
      // Breite Wurzeln
      parts.push(`<path d="M${cx-tw*0.8} ${baseY} Q${cx-tw*2.8} ${baseY+th*0.06} ${cx-tw*3.8} ${baseY+th*0.02} Q${cx-tw*2.2} ${baseY-th*0.07} ${cx-tw} ${baseY-th*0.06} Z"/>`);
      parts.push(`<path d="M${cx+tw*0.8} ${baseY} Q${cx+tw*2.8} ${baseY+th*0.06} ${cx+tw*3.8} ${baseY+th*0.02} Q${cx+tw*2.2} ${baseY-th*0.07} ${cx+tw} ${baseY-th*0.06} Z"/>`);
      parts.push(`<path d="M${cx-tw*0.2} ${baseY} Q${cx-tw*0.8} ${baseY+th*0.04} ${cx-tw*1.0} ${baseY+th*0.08} Q${cx-tw*0.4} ${baseY-th*0.04} ${cx} ${baseY-th*0.02} Z"/>`);
      // Textur
      parts.push(`<path d="M${cx-tw*0.25} ${baseY-th*0.07} Q${cx+tw*0.05} ${baseY-th*0.4} ${cx-tw*0.3} ${top+th*0.22}" stroke="rgba(0,0,0,0.13)" stroke-width="${scale*3}" fill="none" stroke-linecap="round"/>`);
      parts.push(`<path d="M${cx+tw*0.18} ${baseY-th*0.12} Q${cx-tw*0.08} ${baseY-th*0.5} ${cx+tw*0.1} ${top+th*0.35}" stroke="rgba(0,0,0,0.09)" stroke-width="${scale*2}" fill="none" stroke-linecap="round"/>`);
      parts.push(`<path d="M${cx-tw*0.5} ${baseY-th*0.3} Q${cx-tw*0.25} ${baseY-th*0.65} ${cx-tw*0.15} ${top+th*0.45}" stroke="rgba(0,0,0,0.06)" stroke-width="${scale*1.5}" fill="none" stroke-linecap="round"/>`);
      return parts.join('');
    },
    trunkHeightFactor: 0.48,
    branchSlots: [
      { nx: -0.65, ny: 0.32, baseAngle: -142 },
      { nx:  0.65, ny: 0.35, baseAngle:  -38 },
      { nx: -0.70, ny: 0.50, baseAngle: -153 },
      { nx:  0.68, ny: 0.54, baseAngle:  -27 },
      { nx: -0.55, ny: 0.68, baseAngle: -162 },
      { nx:  0.55, ny: 0.70, baseAngle:  -18 },
      { nx:  0.0,  ny: 0.84, baseAngle:  -90 },
    ]
  },
  // Variante D – schlanker, hoher Stamm
  {
    id: 'D',
    draw: function(cx, baseY, scale) {
      const tw = 13 * scale, th = 155 * scale;
      const top = baseY - th;
      const parts = [];
      parts.push(`<path d="M${cx-tw} ${baseY} C${cx-tw*1.05} ${baseY-th*0.28} ${cx-tw*0.45} ${top+th*0.12} ${cx-tw*0.22} ${top} L${cx+tw*0.22} ${top} C${cx+tw*0.45} ${top+th*0.12} ${cx+tw*1.05} ${baseY-th*0.28} ${cx+tw} ${baseY} Z"/>`);
      // Schmalere Wurzeln
      parts.push(`<path d="M${cx-tw*0.7} ${baseY} Q${cx-tw*2.0} ${baseY+th*0.04} ${cx-tw*2.5} ${baseY+th*0.01} Q${cx-tw*1.5} ${baseY-th*0.05} ${cx-tw} ${baseY-th*0.04} Z"/>`);
      parts.push(`<path d="M${cx+tw*0.7} ${baseY} Q${cx+tw*2.0} ${baseY+th*0.04} ${cx+tw*2.5} ${baseY+th*0.01} Q${cx+tw*1.5} ${baseY-th*0.05} ${cx+tw} ${baseY-th*0.04} Z"/>`);
      // Textur
      parts.push(`<path d="M${cx-tw*0.05} ${baseY-th*0.09} Q${cx+tw*0.15} ${baseY-th*0.38} ${cx-tw*0.02} ${top+th*0.16}" stroke="rgba(0,0,0,0.1)" stroke-width="${scale*2}" fill="none" stroke-linecap="round"/>`);
      parts.push(`<path d="M${cx+tw*0.12} ${baseY-th*0.16} Q${cx-tw*0.1} ${baseY-th*0.52} ${cx+tw*0.08} ${top+th*0.3}" stroke="rgba(0,0,0,0.07)" stroke-width="${scale*1.4}" fill="none" stroke-linecap="round"/>`);
      return parts.join('');
    },
    trunkHeightFactor: 0.60,
    branchSlots: [
      { nx: -0.45, ny: 0.40, baseAngle: -140 },
      { nx:  0.45, ny: 0.44, baseAngle:  -40 },
      { nx: -0.55, ny: 0.58, baseAngle: -152 },
      { nx:  0.52, ny: 0.62, baseAngle:  -28 },
      { nx: -0.42, ny: 0.74, baseAngle: -158 },
      { nx:  0.42, ny: 0.78, baseAngle:  -22 },
      { nx:  0.0,  ny: 0.90, baseAngle:  -90 },
    ]
  },
];

// =========================
// AST-VARIANTEN
// Jeder Ast hat:
//   - Eine Zeichenfunktion: draw(ox, oy, angle, scale, trunkColor)
//     ox/oy = Anschlusspunkt am Stamm (absolut)
//     angle = Winkel in Grad (Basis), aus branchSlot.baseAngle + kleiner Variation
//     scale = Skalierungsfaktor
//   - 10 fest definierte Blatt-Slots (normalisiert, relativ zum Astanfang in Richtung angle)
//   - 5 fest definierte Apfel-Slots
// =========================
const BRANCH_VARIANTS = [
  // Ast 0 – langer, leicht nach oben gebogener Hauptast
  {
    id: 0,
    draw: function(ox, oy, angleDeg, scale, trunkColor) {
      const rad = angleDeg * Math.PI / 180;
      const len = 90 * scale;
      const bw  = 7 * scale;
      const ex = ox + Math.cos(rad) * len;
      const ey = oy + Math.sin(rad) * len;
      // Biegung nach oben (leicht)
      const cpx = ox + Math.cos(rad) * len * 0.5 + Math.sin(rad) * (-15 * scale);
      const cpy = oy + Math.sin(rad) * len * 0.5 + Math.cos(rad) * (-8 * scale);
      const parts = [];
      // Hauptast (als Pfad mit Breite)
      const perp = rad + Math.PI/2;
      const p1x = ox + Math.cos(perp)*bw, p1y = oy + Math.sin(perp)*bw;
      const p2x = ox - Math.cos(perp)*bw, p2y = oy - Math.sin(perp)*bw;
      const p3x = ex + Math.cos(perp)*bw*0.35, p3y = ey + Math.sin(perp)*bw*0.35;
      const p4x = ex - Math.cos(perp)*bw*0.35, p4y = ey - Math.sin(perp)*bw*0.35;
      parts.push(`<path d="M${p1x} ${p1y} Q${cpx+Math.cos(perp)*bw*0.7} ${cpy+Math.sin(perp)*bw*0.7} ${p3x} ${p3y} L${p4x} ${p4y} Q${cpx-Math.cos(perp)*bw*0.7} ${cpy-Math.sin(perp)*bw*0.7} ${p2x} ${p2y} Z" fill="${trunkColor}" opacity="0.9"/>`);
      // Nebenast 1 (bei 60% Länge)
      const sub1x = ox + Math.cos(rad)*len*0.58 + Math.cos(rad+0.4)*(-12*scale);
      const sub1y = oy + Math.sin(rad)*len*0.58 + Math.sin(rad+0.4)*(-12*scale);
      const sub1ex = sub1x + Math.cos(rad+0.55)*45*scale;
      const sub1ey = sub1y + Math.sin(rad+0.55)*45*scale;
      parts.push(`<path d="M${sub1x} ${sub1y} Q${(sub1x+sub1ex)/2+Math.sin(rad+0.55)*(-6*scale)} ${(sub1y+sub1ey)/2+Math.cos(rad+0.55)*(-4*scale)} ${sub1ex} ${sub1ey}" stroke="${trunkColor}" stroke-width="${bw*0.55}" fill="none" stroke-linecap="round" opacity="0.88"/>`);
      // Nebenast 2 (bei 75% Länge, andere Seite)
      const sub2x = ox + Math.cos(rad)*len*0.72;
      const sub2y = oy + Math.sin(rad)*len*0.72;
      const sub2ex = sub2x + Math.cos(rad-0.6)*38*scale;
      const sub2ey = sub2y + Math.sin(rad-0.6)*38*scale;
      parts.push(`<path d="M${sub2x} ${sub2y} Q${(sub2x+sub2ex)/2+Math.sin(rad-0.6)*(-5*scale)} ${(sub2y+sub2ey)/2+Math.cos(rad-0.6)*(-3*scale)} ${sub2ex} ${sub2ey}" stroke="${trunkColor}" stroke-width="${bw*0.4}" fill="none" stroke-linecap="round" opacity="0.82"/>`);
      return { svgParts: parts, tipX: ex, tipY: ey, midX: cpx, midY: cpy, sub1ex, sub1ey, sub2ex, sub2ey, len, rad };
    },
    // Blatt-Slots: normalisiert [t=Position entlang Ast 0..1, side=-1/+1, dist=Abstand]
    leafSlotDefs: [
      {t:0.30,side: 1,dist:0.22},{t:0.38,side:-1,dist:0.28},{t:0.48,side: 1,dist:0.25},
      {t:0.55,side:-1,dist:0.20},{t:0.62,side: 1,dist:0.30},{t:0.70,side:-1,dist:0.26},
      {t:0.78,side: 1,dist:0.22},{t:0.82,side:-1,dist:0.18},{t:0.90,side: 1,dist:0.15},
      {t:0.95,side:-1,dist:0.12}
    ],
    appleSlotDefs: [
      {t:0.50,side: 1,dist:0.18},{t:0.65,side:-1,dist:0.22},{t:0.72,side: 1,dist:0.25},
      {t:0.85,side:-1,dist:0.16},{t:0.92,side: 1,dist:0.13}
    ]
  },
  // Ast 1 – kürzer, steiler nach oben
  {
    id: 1,
    draw: function(ox, oy, angleDeg, scale, trunkColor) {
      const rad = angleDeg * Math.PI / 180;
      const len = 75 * scale;
      const bw  = 6.5 * scale;
      const ex = ox + Math.cos(rad) * len;
      const ey = oy + Math.sin(rad) * len;
      const perp = rad + Math.PI/2;
      const cpx = ox + Math.cos(rad)*len*0.45 + Math.sin(rad)*(-20*scale);
      const cpy = oy + Math.sin(rad)*len*0.45 + Math.cos(rad)*(-12*scale);
      const p1x = ox + Math.cos(perp)*bw, p1y = oy + Math.sin(perp)*bw;
      const p2x = ox - Math.cos(perp)*bw, p2y = oy - Math.sin(perp)*bw;
      const p3x = ex + Math.cos(perp)*bw*0.3, p3y = ey + Math.sin(perp)*bw*0.3;
      const p4x = ex - Math.cos(perp)*bw*0.3, p4y = ey - Math.sin(perp)*bw*0.3;
      const parts = [];
      parts.push(`<path d="M${p1x} ${p1y} Q${cpx+Math.cos(perp)*bw*0.6} ${cpy+Math.sin(perp)*bw*0.6} ${p3x} ${p3y} L${p4x} ${p4y} Q${cpx-Math.cos(perp)*bw*0.6} ${cpy-Math.sin(perp)*bw*0.6} ${p2x} ${p2y} Z" fill="${trunkColor}" opacity="0.88"/>`);
      // Drei kleine Nebenäste
      for (let i = 0; i < 3; i++) {
        const t = 0.5 + i * 0.15;
        const sx = ox + Math.cos(rad)*len*t, sy = oy + Math.sin(rad)*len*t;
        const srad = rad + (i%2===0 ? 0.5 : -0.5);
        const slen = (40 - i*6)*scale;
        const sex = sx + Math.cos(srad)*slen, sey = sy + Math.sin(srad)*slen;
        parts.push(`<path d="M${sx} ${sy} Q${(sx+sex)/2+Math.sin(srad)*(-5*scale)} ${(sy+sey)/2+Math.cos(srad)*(-4*scale)} ${sex} ${sey}" stroke="${trunkColor}" stroke-width="${bw*(0.45-i*0.05)}" fill="none" stroke-linecap="round" opacity="${0.85-i*0.05}"/>`);
      }
      return { svgParts: parts, tipX: ex, tipY: ey, midX: cpx, midY: cpy, len, rad };
    },
    leafSlotDefs: [
      {t:0.28,side:-1,dist:0.20},{t:0.36,side: 1,dist:0.26},{t:0.45,side:-1,dist:0.22},
      {t:0.52,side: 1,dist:0.28},{t:0.60,side:-1,dist:0.24},{t:0.68,side: 1,dist:0.20},
      {t:0.75,side:-1,dist:0.26},{t:0.80,side: 1,dist:0.18},{t:0.88,side:-1,dist:0.15},
      {t:0.94,side: 1,dist:0.12}
    ],
    appleSlotDefs: [
      {t:0.45,side:-1,dist:0.18},{t:0.58,side: 1,dist:0.20},{t:0.70,side:-1,dist:0.22},
      {t:0.80,side: 1,dist:0.15},{t:0.90,side:-1,dist:0.12}
    ]
  },
  // Ast 2 – breiter, eher waagerecht
  {
    id: 2,
    draw: function(ox, oy, angleDeg, scale, trunkColor) {
      const rad = angleDeg * Math.PI / 180;
      const len = 95 * scale;
      const bw  = 7.5 * scale;
      const ex = ox + Math.cos(rad) * len;
      const ey = oy + Math.sin(rad) * len;
      const perp = rad + Math.PI/2;
      // Fast gerade, leicht nach oben am Ende
      const cpx = ox + Math.cos(rad)*len*0.5;
      const cpy = oy + Math.sin(rad)*len*0.5 - 5*scale;
      const p1x = ox + Math.cos(perp)*bw, p1y = oy + Math.sin(perp)*bw;
      const p2x = ox - Math.cos(perp)*bw, p2y = oy - Math.sin(perp)*bw;
      const p3x = ex + Math.cos(perp)*bw*0.38, p3y = ey + Math.sin(perp)*bw*0.38;
      const p4x = ex - Math.cos(perp)*bw*0.38, p4y = ey - Math.sin(perp)*bw*0.38;
      const parts = [];
      parts.push(`<path d="M${p1x} ${p1y} Q${cpx+Math.cos(perp)*bw*0.75} ${cpy+Math.sin(perp)*bw*0.75} ${p3x} ${p3y} L${p4x} ${p4y} Q${cpx-Math.cos(perp)*bw*0.75} ${cpy-Math.sin(perp)*bw*0.75} ${p2x} ${p2y} Z" fill="${trunkColor}" opacity="0.92"/>`);
      // Nebenast oben bei 45%
      const n1x = ox + Math.cos(rad)*len*0.42, n1y = oy + Math.sin(rad)*len*0.42;
      const n1r = rad - 0.65;
      const n1ex = n1x + Math.cos(n1r)*50*scale, n1ey = n1y + Math.sin(n1r)*50*scale;
      parts.push(`<path d="M${n1x} ${n1y} Q${n1x+Math.cos(n1r)*25*scale+Math.sin(n1r)*(-8*scale)} ${n1y+Math.sin(n1r)*25*scale+Math.cos(n1r)*(-5*scale)} ${n1ex} ${n1ey}" stroke="${trunkColor}" stroke-width="${bw*0.6}" fill="none" stroke-linecap="round" opacity="0.87"/>`);
      // Nebenast unten bei 68%
      const n2x = ox + Math.cos(rad)*len*0.65, n2y = oy + Math.sin(rad)*len*0.65;
      const n2r = rad + 0.45;
      const n2ex = n2x + Math.cos(n2r)*40*scale, n2ey = n2y + Math.sin(n2r)*40*scale;
      parts.push(`<path d="M${n2x} ${n2y} Q${n2x+Math.cos(n2r)*20*scale} ${n2y+Math.sin(n2r)*20*scale} ${n2ex} ${n2ey}" stroke="${trunkColor}" stroke-width="${bw*0.42}" fill="none" stroke-linecap="round" opacity="0.82"/>`);
      return { svgParts: parts, tipX: ex, tipY: ey, midX: cpx, midY: cpy, len, rad };
    },
    leafSlotDefs: [
      {t:0.25,side: 1,dist:0.24},{t:0.35,side:-1,dist:0.30},{t:0.44,side: 1,dist:0.26},
      {t:0.53,side:-1,dist:0.22},{t:0.60,side: 1,dist:0.28},{t:0.67,side:-1,dist:0.24},
      {t:0.74,side: 1,dist:0.20},{t:0.80,side:-1,dist:0.22},{t:0.87,side: 1,dist:0.18},
      {t:0.93,side:-1,dist:0.14}
    ],
    appleSlotDefs: [
      {t:0.40,side: 1,dist:0.20},{t:0.55,side:-1,dist:0.24},{t:0.68,side: 1,dist:0.20},
      {t:0.78,side:-1,dist:0.18},{t:0.88,side: 1,dist:0.15}
    ]
  },
  // Ast 3 – mittlere Länge, Gabel am Ende
  {
    id: 3,
    draw: function(ox, oy, angleDeg, scale, trunkColor) {
      const rad = angleDeg * Math.PI / 180;
      const len = 82 * scale;
      const bw  = 6.8 * scale;
      const ex = ox + Math.cos(rad) * len;
      const ey = oy + Math.sin(rad) * len;
      const perp = rad + Math.PI/2;
      const cpx = ox + Math.cos(rad)*len*0.5 + Math.sin(rad)*(-10*scale);
      const cpy = oy + Math.sin(rad)*len*0.5 + Math.cos(rad)*(-6*scale);
      const p1x = ox + Math.cos(perp)*bw, p1y = oy + Math.sin(perp)*bw;
      const p2x = ox - Math.cos(perp)*bw, p2y = oy - Math.sin(perp)*bw;
      const p3x = ex + Math.cos(perp)*bw*0.32, p3y = ey + Math.sin(perp)*bw*0.32;
      const p4x = ex - Math.cos(perp)*bw*0.32, p4y = ey - Math.sin(perp)*bw*0.32;
      const parts = [];
      parts.push(`<path d="M${p1x} ${p1y} Q${cpx+Math.cos(perp)*bw*0.65} ${cpy+Math.sin(perp)*bw*0.65} ${p3x} ${p3y} L${p4x} ${p4y} Q${cpx-Math.cos(perp)*bw*0.65} ${cpy-Math.sin(perp)*bw*0.65} ${p2x} ${p2y} Z" fill="${trunkColor}" opacity="0.91"/>`);
      // Gabel: zwei Äste am Ende
      const fork1r = rad - 0.38, fork2r = rad + 0.38;
      const flen = 42 * scale;
      const f1ex = ex + Math.cos(fork1r)*flen, f1ey = ey + Math.sin(fork1r)*flen;
      const f2ex = ex + Math.cos(fork2r)*flen, f2ey = ey + Math.sin(fork2r)*flen;
      parts.push(`<path d="M${ex} ${ey} Q${ex+Math.cos(fork1r)*flen*0.5+Math.sin(fork1r)*(-5*scale)} ${ey+Math.sin(fork1r)*flen*0.5+Math.cos(fork1r)*(-3*scale)} ${f1ex} ${f1ey}" stroke="${trunkColor}" stroke-width="${bw*0.55}" fill="none" stroke-linecap="round" opacity="0.88"/>`);
      parts.push(`<path d="M${ex} ${ey} Q${ex+Math.cos(fork2r)*flen*0.5+Math.sin(fork2r)*(-5*scale)} ${ey+Math.sin(fork2r)*flen*0.5+Math.cos(fork2r)*(-3*scale)} ${f2ex} ${f2ey}" stroke="${trunkColor}" stroke-width="${bw*0.55}" fill="none" stroke-linecap="round" opacity="0.88"/>`);
      return { svgParts: parts, tipX: ex, tipY: ey, midX: cpx, midY: cpy, len, rad };
    },
    leafSlotDefs: [
      {t:0.32,side: 1,dist:0.22},{t:0.40,side:-1,dist:0.26},{t:0.50,side: 1,dist:0.24},
      {t:0.58,side:-1,dist:0.20},{t:0.65,side: 1,dist:0.28},{t:0.72,side:-1,dist:0.22},
      {t:0.80,side: 1,dist:0.24},{t:0.85,side:-1,dist:0.18},{t:0.91,side: 1,dist:0.15},
      {t:0.96,side:-1,dist:0.12}
    ],
    appleSlotDefs: [
      {t:0.48,side:-1,dist:0.18},{t:0.60,side: 1,dist:0.22},{t:0.72,side:-1,dist:0.20},
      {t:0.82,side: 1,dist:0.17},{t:0.91,side:-1,dist:0.13}
    ]
  },
  // Ast 4 – kurzer, dichter Ast
  {
    id: 4,
    draw: function(ox, oy, angleDeg, scale, trunkColor) {
      const rad = angleDeg * Math.PI / 180;
      const len = 65 * scale;
      const bw  = 6 * scale;
      const ex = ox + Math.cos(rad) * len;
      const ey = oy + Math.sin(rad) * len;
      const perp = rad + Math.PI/2;
      const cpx = ox + Math.cos(rad)*len*0.5 + Math.sin(rad)*(-18*scale);
      const cpy = oy + Math.sin(rad)*len*0.5 + Math.cos(rad)*(-10*scale);
      const p1x = ox + Math.cos(perp)*bw, p1y = oy + Math.sin(perp)*bw;
      const p2x = ox - Math.cos(perp)*bw, p2y = oy - Math.sin(perp)*bw;
      const p3x = ex + Math.cos(perp)*bw*0.28, p3y = ey + Math.sin(perp)*bw*0.28;
      const p4x = ex - Math.cos(perp)*bw*0.28, p4y = ey - Math.sin(perp)*bw*0.28;
      const parts = [];
      parts.push(`<path d="M${p1x} ${p1y} Q${cpx+Math.cos(perp)*bw*0.6} ${cpy+Math.sin(perp)*bw*0.6} ${p3x} ${p3y} L${p4x} ${p4y} Q${cpx-Math.cos(perp)*bw*0.6} ${cpy-Math.sin(perp)*bw*0.6} ${p2x} ${p2y} Z" fill="${trunkColor}" opacity="0.89"/>`);
      // Viele kleine Nebenäste
      for (let i = 0; i < 4; i++) {
        const t = 0.4 + i * 0.14;
        const sx = ox + Math.cos(rad)*len*t, sy = oy + Math.sin(rad)*len*t;
        const srad = rad + (i%2===0 ? 0.42 : -0.42) + (i > 1 ? 0.15 : 0);
        const slen = (32 - i*4)*scale;
        const sex = sx + Math.cos(srad)*slen, sey = sy + Math.sin(srad)*slen;
        parts.push(`<line x1="${sx}" y1="${sy}" x2="${sex}" y2="${sey}" stroke="${trunkColor}" stroke-width="${bw*(0.42-i*0.04)}" fill="none" stroke-linecap="round" opacity="${0.83-i*0.04}"/>`);
      }
      return { svgParts: parts, tipX: ex, tipY: ey, midX: cpx, midY: cpy, len, rad };
    },
    leafSlotDefs: [
      {t:0.26,side:-1,dist:0.18},{t:0.34,side: 1,dist:0.22},{t:0.42,side:-1,dist:0.20},
      {t:0.50,side: 1,dist:0.26},{t:0.58,side:-1,dist:0.22},{t:0.66,side: 1,dist:0.18},
      {t:0.74,side:-1,dist:0.24},{t:0.80,side: 1,dist:0.16},{t:0.87,side:-1,dist:0.14},
      {t:0.93,side: 1,dist:0.11}
    ],
    appleSlotDefs: [
      {t:0.42,side: 1,dist:0.16},{t:0.56,side:-1,dist:0.18},{t:0.66,side: 1,dist:0.16},
      {t:0.76,side:-1,dist:0.14},{t:0.88,side: 1,dist:0.11}
    ]
  },
  // Ast 5 – gebogener Ast mit markanter Kurve
  {
    id: 5,
    draw: function(ox, oy, angleDeg, scale, trunkColor) {
      const rad = angleDeg * Math.PI / 180;
      const len = 88 * scale;
      const bw  = 7 * scale;
      const ex = ox + Math.cos(rad) * len;
      const ey = oy + Math.sin(rad) * len;
      const perp = rad + Math.PI/2;
      // Stärkere Biegung nach oben
      const cpx = ox + Math.cos(rad)*len*0.5 + Math.sin(rad)*(-28*scale);
      const cpy = oy + Math.sin(rad)*len*0.5 + Math.cos(rad)*(-16*scale);
      const p1x = ox + Math.cos(perp)*bw, p1y = oy + Math.sin(perp)*bw;
      const p2x = ox - Math.cos(perp)*bw, p2y = oy - Math.sin(perp)*bw;
      const p3x = ex + Math.cos(perp)*bw*0.33, p3y = ey + Math.sin(perp)*bw*0.33;
      const p4x = ex - Math.cos(perp)*bw*0.33, p4y = ey - Math.sin(perp)*bw*0.33;
      const parts = [];
      parts.push(`<path d="M${p1x} ${p1y} Q${cpx+Math.cos(perp)*bw*0.65} ${cpy+Math.sin(perp)*bw*0.65} ${p3x} ${p3y} L${p4x} ${p4y} Q${cpx-Math.cos(perp)*bw*0.65} ${cpy-Math.sin(perp)*bw*0.65} ${p2x} ${p2y} Z" fill="${trunkColor}" opacity="0.9"/>`);
      // Zwei Nebenäste
      const n1x = ox + Math.cos(rad)*len*0.55, n1y = oy + Math.sin(rad)*len*0.55;
      const n1r = rad - 0.5;
      const n1ex = n1x + Math.cos(n1r)*48*scale, n1ey = n1y + Math.sin(n1r)*48*scale;
      parts.push(`<path d="M${n1x} ${n1y} Q${(n1x+n1ex)/2+Math.sin(n1r)*(-7*scale)} ${(n1y+n1ey)/2+Math.cos(n1r)*(-5*scale)} ${n1ex} ${n1ey}" stroke="${trunkColor}" stroke-width="${bw*0.55}" fill="none" stroke-linecap="round" opacity="0.86"/>`);
      const n2x = ox + Math.cos(rad)*len*0.78, n2y = oy + Math.sin(rad)*len*0.78;
      const n2r = rad + 0.35;
      const n2ex = n2x + Math.cos(n2r)*36*scale, n2ey = n2y + Math.sin(n2r)*36*scale;
      parts.push(`<path d="M${n2x} ${n2y} Q${(n2x+n2ex)/2} ${(n2y+n2ey)/2} ${n2ex} ${n2ey}" stroke="${trunkColor}" stroke-width="${bw*0.38}" fill="none" stroke-linecap="round" opacity="0.80"/>`);
      return { svgParts: parts, tipX: ex, tipY: ey, midX: cpx, midY: cpy, len, rad };
    },
    leafSlotDefs: [
      {t:0.30,side: 1,dist:0.26},{t:0.38,side:-1,dist:0.22},{t:0.46,side: 1,dist:0.28},
      {t:0.54,side:-1,dist:0.24},{t:0.62,side: 1,dist:0.22},{t:0.70,side:-1,dist:0.28},
      {t:0.77,side: 1,dist:0.20},{t:0.83,side:-1,dist:0.24},{t:0.89,side: 1,dist:0.16},
      {t:0.95,side:-1,dist:0.12}
    ],
    appleSlotDefs: [
      {t:0.46,side: 1,dist:0.20},{t:0.60,side:-1,dist:0.22},{t:0.72,side: 1,dist:0.18},
      {t:0.82,side:-1,dist:0.20},{t:0.92,side: 1,dist:0.14}
    ]
  },
  // Ast 6 – Ast für oben (fast senkrecht nach oben)
  {
    id: 6,
    draw: function(ox, oy, angleDeg, scale, trunkColor) {
      const rad = angleDeg * Math.PI / 180; // ~-90°
      const len = 80 * scale;
      const bw  = 6.5 * scale;
      const ex = ox + Math.cos(rad) * len;
      const ey = oy + Math.sin(rad) * len;
      const perp = rad + Math.PI/2;
      const cpx = ox + Math.cos(rad)*len*0.5 + Math.sin(rad)*(-5*scale);
      const cpy = oy + Math.sin(rad)*len*0.5 + Math.cos(rad)*(-3*scale);
      const p1x = ox + Math.cos(perp)*bw, p1y = oy + Math.sin(perp)*bw;
      const p2x = ox - Math.cos(perp)*bw, p2y = oy - Math.sin(perp)*bw;
      const p3x = ex + Math.cos(perp)*bw*0.3, p3y = ey + Math.sin(perp)*bw*0.3;
      const p4x = ex - Math.cos(perp)*bw*0.3, p4y = ey - Math.sin(perp)*bw*0.3;
      const parts = [];
      parts.push(`<path d="M${p1x} ${p1y} Q${cpx+Math.cos(perp)*bw*0.62} ${cpy+Math.sin(perp)*bw*0.62} ${p3x} ${p3y} L${p4x} ${p4y} Q${cpx-Math.cos(perp)*bw*0.62} ${cpy-Math.sin(perp)*bw*0.62} ${p2x} ${p2y} Z" fill="${trunkColor}" opacity="0.9"/>`);
      // Symmetrische Nebenäste links/rechts
      const nAngles = [rad-0.5, rad+0.5];
      nAngles.forEach((nr, idx) => {
        const t = 0.52 + idx * 0.18;
        const sx = ox + Math.cos(rad)*len*t, sy = oy + Math.sin(rad)*len*t;
        const nex = sx + Math.cos(nr)*44*scale, ney = sy + Math.sin(nr)*44*scale;
        parts.push(`<path d="M${sx} ${sy} Q${(sx+nex)/2+Math.sin(nr)*(-6*scale)} ${(sy+ney)/2+Math.cos(nr)*(-4*scale)} ${nex} ${ney}" stroke="${trunkColor}" stroke-width="${bw*0.5}" fill="none" stroke-linecap="round" opacity="0.86"/>`);
      });
      return { svgParts: parts, tipX: ex, tipY: ey, midX: cpx, midY: cpy, len, rad };
    },
    leafSlotDefs: [
      {t:0.28,side: 1,dist:0.25},{t:0.36,side:-1,dist:0.22},{t:0.45,side: 1,dist:0.28},
      {t:0.53,side:-1,dist:0.24},{t:0.61,side: 1,dist:0.22},{t:0.68,side:-1,dist:0.26},
      {t:0.76,side: 1,dist:0.20},{t:0.82,side:-1,dist:0.22},{t:0.88,side: 1,dist:0.16},
      {t:0.94,side:-1,dist:0.13}
    ],
    appleSlotDefs: [
      {t:0.44,side: 1,dist:0.18},{t:0.58,side:-1,dist:0.20},{t:0.70,side: 1,dist:0.22},
      {t:0.80,side:-1,dist:0.16},{t:0.90,side: 1,dist:0.13}
    ]
  },
];

// =========================
// LAYOUT ERZEUGEN / LADEN
// Einmalig je Projekt. Danach unveränderlich.
// =========================
function getOrCreateTreeLayout(project) {
  const id = project.id;
  if (treeLayouts[id] && treeLayouts[id].version === 2) return treeLayouts[id];

  const seed = idToSeed(id);
  const rng  = seededRand(seed);

  // Stamm-Variante wählen
  const trunkIdx = Math.floor(rng() * TRUNK_VARIANTS.length);

  // Pro Ast-Slot: Ast-Variante wählen (zufällig, aber deterministisch)
  const branchVariants = [];
  for (let i = 0; i < 7; i++) {
    branchVariants.push(Math.floor(rng() * BRANCH_VARIANTS.length));
  }

  // Kleine Winkelvariation pro Slot (±12°), ebenfalls deterministisch
  const branchAngleVariations = [];
  for (let i = 0; i < 7; i++) {
    branchAngleVariations.push((rng() - 0.5) * 24);
  }

  // Blattfarben-Set wählen
  const leafColorSets = [
    ['#5a8a4a','#6a9a58','#4d7a3e','#72a860','#527248'],
    ['#4e8055','#5e9065','#3e7045','#6ea07a','#567060'],
    ['#5e8c38','#6e9c48','#507830','#789055','#607840'],
    ['#527858','#628868','#426848','#72987a','#5a7a60'],
  ];
  const leafColorIdx = Math.floor(rng() * leafColorSets.length);

  const layout = {
    version: 2,
    trunkIdx,
    branchVariants,
    branchAngleVariations,
    leafColorIdx,
    leafColorSets,
  };

  treeLayouts[id] = layout;
  DB.set('treeLayouts', treeLayouts);
  return layout;
}

// =========================
// BLATT-SLOT POSITION berechnen
// Aus normalisierter Slot-Definition + Ast-Geometrie → absolute SVG-Koordinaten
// =========================
function resolveLeafSlotPos(slotDef, ox, oy, rad, len, scale) {
  // Position entlang des Astes
  const px = ox + Math.cos(rad) * len * slotDef.t;
  const py = oy + Math.sin(rad) * len * slotDef.t;
  // Senkrecht zum Ast
  const perp = rad + Math.PI/2;
  const dist = slotDef.dist * len;
  const lx = px + Math.cos(perp) * dist * slotDef.side;
  const ly = py + Math.sin(perp) * dist * slotDef.side;
  return { lx, ly };
}

// =========================
// BLATT ZEICHNEN (SVG-String)
// =========================
function drawLeaf(lx, ly, scale, leafColor, rotation) {
  const lw = 10 * scale, lh = 6 * scale;
  return `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="${lw.toFixed(1)}" ry="${lh.toFixed(1)}" fill="${leafColor}" opacity="0.93" transform="rotate(${rotation.toFixed(0)} ${lx.toFixed(1)} ${ly.toFixed(1)})"/>`;
}

// =========================
// KNOSPE ZEICHNEN
// =========================
function drawBud(lx, ly, scale, leafColor) {
  const r1 = 4.5 * scale, r2 = 2.5 * scale;
  return `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="${r1.toFixed(1)}" fill="${leafColor}" opacity="0.35"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="${r2.toFixed(1)}" fill="${leafColor}" opacity="0.6"/>`;
}

// =========================
// APFEL ZEICHNEN
// =========================
function drawApple(ax, ay, scale, stemColor) {
  const ar = 7 * scale;
  return `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="${ar.toFixed(1)}" fill="#c53030" opacity="0.93"/>
    <circle cx="${(ax-ar*0.28).toFixed(1)}" cy="${(ay-ar*0.3).toFixed(1)}" r="${(ar*0.28).toFixed(1)}" fill="#fc8181" opacity="0.55"/>
    <line x1="${ax.toFixed(1)}" y1="${(ay-ar).toFixed(1)}" x2="${(ax+ar*0.38).toFixed(1)}" y2="${(ay-ar*1.6).toFixed(1)}" stroke="${stemColor}" stroke-width="${(scale*1.5).toFixed(1)}" stroke-linecap="round"/>`;
}

// =========================
// APFELBLÜTE ZEICHNEN
// =========================
function drawBlossom(ax, ay, scale) {
  const br = 5 * scale;
  return `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="${br.toFixed(1)}" fill="#fce7f3" opacity="0.7"/>
    <circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="${(br*0.45).toFixed(1)}" fill="#f9a8d4" opacity="0.85"/>`;
}

// =========================
// WALDBAUM (klein, für Übersicht)
// =========================
function drawTree(project, size) {
  const layout = getOrCreateTreeLayout(project);
  const { trunkIdx, branchVariants, branchAngleVariations, leafColorIdx, leafColorSets } = layout;

  const trunk    = TRUNK_VARIANTS[trunkIdx % TRUNK_VARIANTS.length];
  const colors   = project.archived
    ? ['#b45309','#d97706','#92400e','#f59e0b','#a16207']
    : leafColorSets[leafColorIdx];
  const trunkColor = project.archived ? '#92400e' : '#6b4423';

  const W = size, H = size;
  const cx = W / 2;
  const baseY = H * 0.88;
  const scale = size / 200; // Normalisierungsfaktor

  const subprojects = project.subprojects || [];
  const allTasks    = subprojects.flatMap(sp => sp.tasks || []);
  const doneTasks   = allTasks.filter(t => t.done && !t.isExtra).length;
  const doneExtras  = allTasks.filter(t => t.done && t.isExtra).length;
  const pendingTasks  = allTasks.filter(t => !t.done && !t.isExtra).length;
  const pendingExtras = allTasks.filter(t => !t.done && t.isExtra).length;

  const trunkH = H * trunk.trunkHeightFactor;

  const parts = [];
  // Schatten
  parts.push(`<ellipse cx="${cx}" cy="${baseY+3}" rx="${scale*38}" ry="${scale*10}" fill="rgba(0,0,0,0.1)"/>`);

  // Stamm (einfarbig für kleine Ansicht)
  parts.push(`<g fill="${trunkColor}">${trunk.draw(cx, baseY, scale)}</g>`);

  // Äste (nur so viele wie Unterprojekte vorhanden, max 7)
  const branchCount = Math.min(subprojects.length, 7);
  const slotDefs = trunk.branchSlots;

  // Aufgaben-Zähler für Blatt/Apfel-Verteilung
  let leafBudCount   = 0, leafDoneCount = 0;
  let appleBudCount  = 0, appleDoneCount = 0;
  subprojects.forEach(sp => {
    sp.tasks.forEach(t => {
      if (t.isExtra) { t.done ? appleDoneCount++ : appleBudCount++; }
      else           { t.done ? leafDoneCount++  : leafBudCount++;  }
    });
  });

  for (let i = 0; i < branchCount; i++) {
    const slot    = slotDefs[i];
    const bVar    = BRANCH_VARIANTS[branchVariants[i] % BRANCH_VARIANTS.length];
    const angleDeg = slot.baseAngle + branchAngleVariations[i];
    const ox = cx + slot.nx * scale * 20;
    const oy = baseY - slot.ny * trunkH;

    const geo = bVar.draw(ox, oy, angleDeg, scale, trunkColor);
    parts.push(`<g fill="${trunkColor}">${geo.svgParts.join('')}</g>`);

    // Einige Blätter/Äpfel pro Ast (vereinfacht für Waldbaum)
    const sp = subprojects[i];
    if (sp) {
      const coreTasks  = sp.tasks.filter(t => !t.isExtra);
      const extraTasks = sp.tasks.filter(t =>  t.isExtra);
      const rad = angleDeg * Math.PI / 180;
      const leafSlots = bVar.leafSlotDefs;
      const appleSlots = bVar.appleSlotDefs;

      coreTasks.slice(0, 10).forEach((task, li) => {
        if (li >= leafSlots.length) return;
        const sdef = leafSlots[li];
        const { lx, ly } = resolveLeafSlotPos(sdef, ox, oy, rad, geo.len, scale);
        const leafColor = colors[li % colors.length];
        const rotation = (li * 37 + i * 19) % 360;
        if (task.done) {
          parts.push(drawLeaf(lx, ly, scale, leafColor, rotation));
        } else {
          parts.push(drawBud(lx, ly, scale, leafColor));
        }
      });

      extraTasks.slice(0, 5).forEach((task, ai) => {
        if (ai >= appleSlots.length) return;
        const sdef = appleSlots[ai];
        const { lx: ax, ly: ay } = resolveLeafSlotPos(sdef, ox, oy, rad, geo.len, scale);
        if (task.done) {
          parts.push(drawApple(ax, ay, scale, trunkColor));
        } else {
          parts.push(drawBlossom(ax, ay, scale));
        }
      });
    }
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">${parts.join('')}</svg>`;
}

// =========================
// DETAILBAUM (groß, interaktiv)
// =========================
function drawDetailTree(project, W, H, layerStart) {
  const layout = getOrCreateTreeLayout(project);
  const { trunkIdx, branchVariants, branchAngleVariations, leafColorIdx, leafColorSets } = layout;

  const trunk      = TRUNK_VARIANTS[trunkIdx % TRUNK_VARIANTS.length];
  const colors     = project.archived
    ? ['#b45309','#d97706','#92400e','#f59e0b','#a16207']
    : leafColorSets[leafColorIdx];
  const trunkColor = project.archived ? '#92400e' : '#6b4423';

  const cx    = W / 2;
  const baseY = H * 0.87;
  const scale = W / 340; // Skalierung für Detail-Baum
  const trunkH = H * trunk.trunkHeightFactor;

  const subprojects = project.subprojects || [];
  const visibleSubs = subprojects.slice(layerStart, layerStart + 7);

  const parts = [];

  // Schatten
  parts.push(`<ellipse cx="${cx}" cy="${baseY+5}" rx="${scale*55}" ry="${scale*14}" fill="rgba(0,0,0,0.08)"/>`);

  // Stamm
  parts.push(`<g fill="${trunkColor}">${trunk.draw(cx, baseY, scale)}</g>`);

  // Äste
  const branchCount = Math.min(visibleSubs.length, 7);
  const slotDefs = trunk.branchSlots;

  for (let i = 0; i < branchCount; i++) {
    const sp      = visibleSubs[i];
    if (!sp) continue;

    const slot    = slotDefs[i];
    const bVar    = BRANCH_VARIANTS[branchVariants[i] % BRANCH_VARIANTS.length];
    const angleDeg = slot.baseAngle + branchAngleVariations[i];
    const ox = cx + slot.nx * scale * 20;
    const oy = baseY - slot.ny * trunkH;

    const geo = bVar.draw(ox, oy, angleDeg, scale, trunkColor);
    parts.push(`<g fill="${trunkColor}">${geo.svgParts.join('')}</g>`);

    // Ast-Label
    const labelX = geo.tipX + Math.cos(angleDeg * Math.PI/180) * scale * 20;
    const labelY = geo.tipY + Math.sin(angleDeg * Math.PI/180) * scale * 14;
    const anchor = ox < cx ? 'end' : 'start';
    parts.push(`<text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}" font-size="${(W*0.026).toFixed(1)}" font-family="DM Sans,sans-serif" fill="${trunkColor}" opacity="0.65" font-weight="500">${escapeXml(sp.title)}</text>`);

    // Kern-Aufgaben → Blätter / Knospen
    const coreTasks  = sp.tasks.filter(t => !t.isExtra);
    const extraTasks = sp.tasks.filter(t =>  t.isExtra);
    const rad = angleDeg * Math.PI / 180;
    const leafSlots  = bVar.leafSlotDefs;
    const appleSlots = bVar.appleSlotDefs;

    coreTasks.slice(0, 10).forEach((task, li) => {
      if (li >= leafSlots.length) return;
      const sdef = leafSlots[li];
      const { lx, ly } = resolveLeafSlotPos(sdef, ox, oy, rad, geo.len, scale);
      const leafColor = colors[li % colors.length];
      const rotation = (li * 37 + i * 19) % 360;

      if (task.done) {
        parts.push(`<g class="detail-leaf detail-leaf--done" data-task-id="${task.id}" data-sp-id="${sp.id}" style="cursor:pointer;">
          ${drawLeaf(lx, ly, scale, leafColor, rotation)}
          <title>${escapeXml(task.text)}</title>
        </g>`);
      } else {
        parts.push(`<g class="detail-leaf detail-leaf--bud" data-task-id="${task.id}" data-sp-id="${sp.id}" style="cursor:pointer;">
          ${drawBud(lx, ly, scale, leafColor)}
          <title>${escapeXml(task.text)}</title>
        </g>`);
      }
    });

    // Extra-Aufgaben → Äpfel / Blüten
    extraTasks.slice(0, 5).forEach((task, ai) => {
      if (ai >= appleSlots.length) return;
      const sdef = appleSlots[ai];
      const { lx: ax, ly: ay } = resolveLeafSlotPos(sdef, ox, oy, rad, geo.len, scale);

      if (task.done) {
        parts.push(`<g class="detail-apple detail-apple--done" data-task-id="${task.id}" data-sp-id="${sp.id}" style="cursor:pointer;">
          ${drawApple(ax, ay, scale, trunkColor)}
          <title>${escapeXml(task.text)}</title>
        </g>`);
      } else {
        parts.push(`<g class="detail-apple detail-apple--bud" data-task-id="${task.id}" data-sp-id="${sp.id}" style="cursor:pointer;">
          ${drawBlossom(ax, ay, scale)}
          <title>${escapeXml(task.text)}</title>
        </g>`);
      }
    });
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">${parts.join('')}</svg>`;
}

// =========================
// BAUM-ELEMENTE AKTUALISIEREN
// =========================
function updateDetailTreeElements(p) {
  const treeContainer = document.getElementById('proj-detail-tree');
  if (!treeContainer) return;
  const W = 520, H = 420;
  treeContainer.innerHTML = drawDetailTree(p, W, H, detailSubLayer * 7);

  // Events neu binden
  treeContainer.querySelectorAll('.detail-leaf, .detail-apple').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const sp   = p.subprojects.find(s => s.id === el.dataset.spId);
      if (!sp) return;
      const task = sp.tasks.find(t => t.id === el.dataset.taskId);
      if (!task) return;
      openTaskDetail(task, sp, p);
    });
  });

  // Fortschritt updaten
  const allTasks = (p.subprojects||[]).flatMap(sp => sp.tasks||[]);
  const done = allTasks.filter(t => t.done).length;
  const pct  = allTasks.length === 0 ? 0 : Math.round(done/allTasks.length*100);
  const pctEl   = document.getElementById('proj-detail-pct');
  const barEl   = document.getElementById('proj-detail-bar-fill');
  const countEl = document.getElementById('proj-detail-task-count');
  if (pctEl)   pctEl.textContent   = pct + '%';
  if (barEl)   barEl.style.cssText = `width:${pct}%;background:${p.color||'#4a7c59'};`;
  if (countEl) countEl.textContent = `${done} / ${allTasks.length} Aufgaben`;
}
