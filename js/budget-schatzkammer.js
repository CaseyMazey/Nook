// =========================
// BUDGET — SCHATZKAMMER (Finanzgarten im RPG-Stil)
// Statt Pflanzen wachsen im RPG-Theme Schätze: jede Sparziel-Pflanze hat
// ein Gegenstück, das ihren Charakter behält (Farbe/Grundform), der
// Finanzbaum wird zum Schatzhort. Gleiche Stufen-Schlüssel wie
// PLANT_SVGS / FINANZBAUM_SVGS (seed … flowering), gleiches 80×80-Format.
// Gespeicherte Daten (goal.plantType) bleiben unverändert — nur Bild und
// Name hängen vom Theme ab (isTreasureStyle(): data-pages-style="rpg",
// gesetzt von js/theme-engine.js).
//
//   sunflower     → Sonnenamulett   (Gold, Strahlenkranz = Blütenblätter)
//   cactus        → Smaragd-Geode   (Kristallspitzen = Stacheln, rosa Steine = Blüten)
//   bonsai        → Schatztruhe     (Holzsockel = Bonsai-Schale)
//   potplant      → Tonkrug         (Terrakotta-Topf bleibt)
//   cherryblossom → Krone           (Rosé-Gold, rosa Juwelen = Blüten)
//   Finanzbaum    → Schatzhort      (Kupfermünze … Drachenhort)
//
// Illustrationen: Farben bewusst als feste Werte (Ausnahme der No-Hardcoded-
// Colors-Regel, wie die Pflanzen-SVGs in budget.js). Keine <defs>/IDs —
// mehrere SVGs auf einer Seite würden sich sonst Verläufe überschreiben.
// Lädt nach budget.js (nutzt dessen Stufen-Schlüssel, keine Funktionen).
// =========================

// Farbsätze: [hell, Grundton, dunkel, Kontur]
const TR_GOLD    = ['#FBE58A', '#EDBE3A', '#C28F14', '#8A6212'];
const TR_COPPER  = ['#E8A270', '#C67A45', '#9A5528', '#6E3A18'];
const TR_ROSE    = ['#F6D2BE', '#E3A487', '#B8735A', '#7E4A36'];
const TR_EMERALD = ['#9BE3B4', '#3FAE6E', '#24784A', '#164D30'];
const TR_RUBY    = ['#F7B4C6', '#E0607E', '#A83A58', '#6E2038'];
const TR_PINK    = ['#FDE0EA', '#F4A3BC', '#D86E92', '#A04868'];
const TR_SAPPH   = ['#A9C8F2', '#4F82C8', '#2D5590', '#1B3560'];
const TR_STONE   = ['#C9C2B6', '#9E978B', '#746E64', '#4E4A43'];
const TR_WOOD    = ['#C48E5A', '#9A6A3C', '#6E4524', '#4A2C14'];
const TR_IRON    = ['#8E8780', '#5E5852', '#403B36', '#2A2622'];
const TR_LEATHER = ['#B07A4C', '#8B5A33', '#643D20', '#432812'];
const TR_CLAY    = ['#E6A07C', '#C7704A', '#9A5034', '#6C3420'];

const trSvg = body => `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const trShadow = (rx = 18, cy = 67) => `<ellipse cx="40" cy="${cy}" rx="${rx}" ry="4" fill="#5A3D1C" opacity=".2"/>`;

// Funkel-Stern; anim = sanftes Blinken (CSS .tr-twinkle, respektiert reduzierte Bewegung)
function trSparkle(x, y, s = 1, anim = false) {
  const d = `M${x} ${y - 5 * s}L${x + 1.2 * s} ${y - 1.2 * s}L${x + 5 * s} ${y}L${x + 1.2 * s} ${y + 1.2 * s}`
          + `L${x} ${y + 5 * s}L${x - 1.2 * s} ${y + 1.2 * s}L${x - 5 * s} ${y}L${x - 1.2 * s} ${y - 1.2 * s}Z`;
  return `<path${anim ? ' class="tr-twinkle"' : ''} d="${d}" fill="#FFF6C8" stroke="#EDBE3A" stroke-width=".5"/>`;
}

// Liegende Münze (von schräg oben)
function trCoinFlat(x, y, rx = 6, m = TR_GOLD) {
  const ry = rx * 0.38;
  return `<ellipse cx="${x}" cy="${y + 1.5}" rx="${rx}" ry="${ry}" fill="${m[2]}"/>`
       + `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${m[1]}"/>`
       + `<ellipse cx="${x}" cy="${y}" rx="${rx * 0.6}" ry="${ry * 0.55}" stroke="${m[0]}" stroke-width=".8"/>`;
}

// Stehende Münze (Vorderseite)
function trCoinUp(x, y, r = 5, m = TR_GOLD) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${m[2]}"/>`
       + `<circle cx="${x - 0.5}" cy="${y - 0.3}" r="${r - 0.9}" fill="${m[1]}"/>`
       + `<circle cx="${x - 0.5}" cy="${y - 0.3}" r="${(r - 0.9) * 0.62}" stroke="${m[0]}" stroke-width=".8"/>`
       + `<ellipse cx="${x - r * 0.4}" cy="${y - r * 0.45}" rx="${r * 0.28}" ry="${r * 0.16}" fill="#FFFFFF" opacity=".45"/>`;
}

// Münzstapel, von unten nach oben gezeichnet
function trStack(x, baseY, n, rx = 7, m = TR_GOLD) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const y = baseY - i * 2.8;
    const ry = rx * 0.36;
    s += `<ellipse cx="${x}" cy="${y + 1.6}" rx="${rx}" ry="${ry}" fill="${m[3]}"/>`
       + `<rect x="${x - rx}" y="${y}" width="${rx * 2}" height="1.6" fill="${m[2]}"/>`
       + `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${m[1]}"/>`;
  }
  const top = baseY - (n - 1) * 2.8;
  return s + `<ellipse cx="${x}" cy="${top}" rx="${rx * 0.6}" ry="${rx * 0.2}" stroke="${m[0]}" stroke-width=".8"/>`;
}

// Geschliffener Edelstein (Brillant von der Seite)
function trGem(x, y, s = 1, c = TR_RUBY) {
  return `<path d="M${x - 3 * s} ${y}L${x - 1.6 * s} ${y - 2 * s}L${x + 1.6 * s} ${y - 2 * s}L${x + 3 * s} ${y}L${x} ${y + 3.6 * s}Z" fill="${c[1]}" stroke="${c[3]}" stroke-width=".5"/>`
       + `<path d="M${x - 3 * s} ${y}L${x + 3 * s} ${y}L${x} ${y + 3.6 * s}Z" fill="${c[2]}" opacity=".55"/>`
       + `<path d="M${x - 1.6 * s} ${y - 2 * s}L${x} ${y}L${x - 3 * s} ${y}Z" fill="${c[0]}" opacity=".8"/>`;
}

// Perle
const trPearl = (x, y, r = 1.8) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#F3ECE0" stroke="#C9B9A2" stroke-width=".4"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#FFFFFF"/>`;

// Goldhaufen (Hügel) mit verstreuten Münzen
function trPile(cx, baseY, w, h, coins = [], m = TR_GOLD) {
  const l = cx - w / 2, r = cx + w / 2;
  let s = `<path d="M${l} ${baseY}Q${cx - w * 0.3} ${baseY - h * 1.05} ${cx} ${baseY - h}Q${cx + w * 0.3} ${baseY - h * 1.05} ${r} ${baseY}Z" fill="${m[1]}" stroke="${m[3]}" stroke-width=".6"/>`
        + `<path d="M${l + w * 0.12} ${baseY - 1}Q${cx - w * 0.28} ${baseY - h * 0.92} ${cx - w * 0.04} ${baseY - h * 0.9}Q${cx - w * 0.18} ${baseY - h * 0.5} ${l + w * 0.22} ${baseY - 1}Z" fill="${m[0]}" opacity=".55"/>`;
  coins.forEach(([dx, dy, rx]) => { s += trCoinFlat(cx + dx, baseY - dy, rx || 4.5, m); });
  return s;
}

// Pokal
function trGoblet(x, y, m = TR_GOLD) {
  return `<ellipse cx="${x}" cy="${y + 15}" rx="5.5" ry="1.8" fill="${m[2]}"/>`
       + `<rect x="${x - 1.1}" y="${y + 8}" width="2.2" height="7" fill="${m[2]}"/>`
       + `<path d="M${x - 6} ${y}L${x + 6} ${y}Q${x + 5.5} ${y + 8} ${x} ${y + 9}Q${x - 5.5} ${y + 8} ${x - 6} ${y}Z" fill="${m[1]}" stroke="${m[3]}" stroke-width=".6"/>`
       + `<ellipse cx="${x}" cy="${y}" rx="6" ry="1.8" fill="${m[2]}"/>`
       + `<path d="M${x - 4} ${y + 2}Q${x - 3.5} ${y + 6} ${x - 1} ${y + 7}" stroke="${m[0]}" stroke-width="1" stroke-linecap="round"/>`
       + trGem(x + 1, y + 4, 0.55, TR_RUBY);
}

// Krone: gewölbtes Band + Zacken (wirkt dadurch rund statt flach);
// tips = Anzahl Zacken; deco(x, y, i) zeichnet Schmuck auf die Spitzen
function trCrown(cx, baseY, w, h, tips, m, deco) {
  const l = cx - w / 2, r = cx + w / 2, bandTop = baseY - 5, sag = w * 0.09;
  const step = w / (tips - 1);
  // Zacken: Spitzen auf gleicher Höhe, Täler tief (≈ 55 % der Höhe)
  let d = `M${l} ${bandTop + sag * 0.3}`;
  for (let i = 0; i < tips; i++) {
    const tx = l + step * i;
    if (i > 0) d += `L${tx - step / 2} ${bandTop - h * 0.45 + sag}`;
    d += `L${tx} ${bandTop - h}`;
  }
  d += `L${r} ${bandTop + sag * 0.3}Q${cx} ${bandTop + sag * 1.6} ${l} ${bandTop + sag * 0.3}Z`;
  let s = `<path d="${d}" fill="${m[1]}" stroke="${m[3]}" stroke-width=".7" stroke-linejoin="round"/>`
        // Innenschatten rechts → Rundung
        + `<path d="M${cx + w * 0.18} ${bandTop + sag}L${cx + w * 0.18} ${bandTop - h * 0.4}L${r} ${bandTop - h}L${r} ${bandTop + sag * 0.3}Z" fill="${m[2]}" opacity=".35"/>`
        // gewölbtes Band
        + `<path d="M${l - 1} ${bandTop}Q${cx} ${bandTop + sag * 2} ${r + 1} ${bandTop}L${r + 1} ${baseY}Q${cx} ${baseY + sag * 2} ${l - 1} ${baseY}Z" fill="${m[2]}" stroke="${m[3]}" stroke-width=".6"/>`
        + `<path d="M${l} ${bandTop + 1.2}Q${cx} ${bandTop + sag * 2 + 1.2} ${r} ${bandTop + 1.2}" stroke="${m[0]}" stroke-width="1" opacity=".7"/>`;
  for (let i = 0; i < tips; i++) {
    const tx = l + step * i;
    s += deco ? deco(tx, bandTop - h, i) : `<circle cx="${tx}" cy="${bandTop - h}" r="1.6" fill="${m[0]}" stroke="${m[3]}" stroke-width=".4"/>`;
  }
  return s;
}
// y-Versatz auf dem gewölbten Band (für Steine/Perlen auf dem Band)
const trBandY = (cx, w, x, y) => y + (w * 0.09 * 2) * (1 - Math.pow((x - cx) / (w / 2), 2)) * 0.5;

// Kleine Blüte aus rosa Edelstein-Blättern
function trBlossom(x, y, r = 2.6) {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
    s += `<circle cx="${(x + Math.cos(a) * r).toFixed(2)}" cy="${(y + Math.sin(a) * r).toFixed(2)}" r="${r * 0.75}" fill="${TR_PINK[1]}" stroke="${TR_PINK[2]}" stroke-width=".4"/>`;
  }
  return s + `<circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="${TR_GOLD[1]}"/>`;
}

// Kristallsäule (sechseckiges Prisma von der Seite), optional geneigt
function trCrystal(x, baseY, w, h, tilt = 0, c = TR_EMERALD) {
  const tip = baseY - h, sh = baseY - h + w * 1.2;
  return `<g transform="rotate(${tilt} ${x} ${baseY})">`
       + `<path d="M${x - w} ${baseY}L${x - w} ${sh}L${x} ${tip}L${x + w} ${sh}L${x + w} ${baseY}Z" fill="${c[1]}" stroke="${c[3]}" stroke-width=".6" stroke-linejoin="round"/>`
       + `<path d="M${x - w} ${baseY}L${x - w} ${sh}L${x} ${tip}L${x - w * 0.15} ${baseY}Z" fill="${c[0]}" opacity=".7"/>`
       + `<path d="M${x + w * 0.35} ${baseY}L${x + w * 0.35} ${sh + 1}L${x + w} ${sh}L${x + w} ${baseY}Z" fill="${c[2]}" opacity=".5"/>`
       + `</g>`;
}

// Gestein (Geoden-Sockel): geschlossen, oder offen als Rückseite +
// Vorderkante (Kristalle werden dazwischen gezeichnet und wachsen so
// sichtbar AUS dem Stein heraus)
const trRock = () =>
  `<path d="M20 66Q17 55 26 49Q34 43 45 45Q58 46 61 57Q62 65 57 66Z" fill="${TR_STONE[1]}" stroke="${TR_STONE[3]}" stroke-width=".7"/>`
  + `<path d="M26 50Q33 45 41 46Q32 49 27 56Z" fill="${TR_STONE[0]}" opacity=".7"/>`
  + `<path d="M48 60Q53 58 56 61" stroke="${TR_STONE[2]}" stroke-width="1" stroke-linecap="round"/>`;
const trRockBack = () =>
  `<path d="M16 66Q14 56 22 51L30 55L36 50L44 54L51 49L58 54Q65 58 63 66Z" fill="${TR_STONE[1]}" stroke="${TR_STONE[3]}" stroke-width=".7" stroke-linejoin="round"/>`
  + `<path d="M22 51L30 55L36 50L44 54L51 49L58 54Q56 60 40 60Q24 60 22 51Z" fill="${TR_STONE[3]}" opacity=".75"/>`;
const trRockFront = () =>
  `<path d="M16 66Q14.5 60.5 19 58Q29 62 40 62Q51 62 61 58Q65 61 63 66Z" fill="${TR_STONE[1]}" stroke="${TR_STONE[3]}" stroke-width=".7" stroke-linejoin="round"/>`
  + `<path d="M20 62Q26 63.5 32 63.6" stroke="${TR_STONE[0]}" stroke-width="1.2" stroke-linecap="round"/>`
  + `<path d="M48 64Q53 63 56 64.5" stroke="${TR_STONE[2]}" stroke-width="1" stroke-linecap="round"/>`;
// Spitze einer (geneigten) Kristallsäule — für Edelsteine obendrauf
function trTip(x, baseY, h, tilt) {
  const a = tilt * Math.PI / 180;
  return [+(x + Math.sin(a) * h).toFixed(2), +(baseY - Math.cos(a) * h).toFixed(2)];
}
// Geode: Kristalle [x, baseY, w, h, tilt]; tipGems = Indizes mit rosa Stein
function trGeode(crystals, tipGems = []) {
  let s = trRockBack();
  crystals.forEach(([x, b, w, h, t]) => { s += trCrystal(x, b, w, h, t); });
  s += trRockFront();
  tipGems.forEach(([i, sc]) => {
    const [x, b, , h, t] = crystals[i];
    const [tx, ty] = trTip(x, b, h, t);
    s += trGem(tx, ty - 1, sc, TR_PINK);
  });
  return s;
}

// Truhe: state = 'closed' | 'ajar' | 'open'; contents = SVG für den Inhalt (nur offen)
function trChest(cx, baseY, w, h, state, contents = '') {
  const x = cx - w / 2, y = baseY - h;
  const W = TR_WOOD, I = TR_IRON, G = TR_GOLD;
  let s = '';
  if (state === 'open') {
    // aufgeklappter Deckel hinten (Innenseite), Inhalt davor
    s += `<path d="M${x} ${y}L${x + 3} ${y - h * 0.85}L${x + w - 3} ${y - h * 0.85}L${x + w} ${y}Z" fill="${W[2]}" stroke="${W[3]}" stroke-width=".7"/>`
       + `<path d="M${x + 4} ${y - 1}L${x + 6} ${y - h * 0.75}L${x + w - 6} ${y - h * 0.75}L${x + w - 4} ${y - 1}Z" fill="${W[3]}" opacity=".55"/>`
       + `<rect x="${x + 5}" y="${y - h * 0.85}" width="2.6" height="${h * 0.85}" fill="${I[1]}"/>`
       + `<rect x="${x + w - 7.6}" y="${y - h * 0.85}" width="2.6" height="${h * 0.85}" fill="${I[1]}"/>`
       + contents;
  }
  // Korpus
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${W[1]}" stroke="${W[3]}" stroke-width=".7"/>`
     + `<line x1="${x}" y1="${y + h * 0.5}" x2="${x + w}" y2="${y + h * 0.5}" stroke="${W[2]}" stroke-width=".8"/>`
     + `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="2" fill="${W[0]}" opacity=".45"/>`
     + `<rect x="${x + 5}" y="${y}" width="2.6" height="${h}" fill="${I[1]}"/>`
     + `<rect x="${x + w - 7.6}" y="${y}" width="2.6" height="${h}" fill="${I[1]}"/>`;
  if (state !== 'open') {
    const lift = state === 'ajar' ? 3 : 0;
    if (lift) s += `<rect x="${x + 2}" y="${y - lift}" width="${w - 4}" height="${lift + 0.5}" fill="${G[0]}" opacity=".95"/>`
                 + `<rect x="${x + 2}" y="${y - lift}" width="${w - 4}" height="${lift + 0.5}" fill="#FFF6C8" opacity=".6"/>`;
    const ly = y - lift;
    s += `<path d="M${x} ${ly}L${x} ${ly - h * 0.28}Q${cx} ${ly - h * 0.78} ${x + w} ${ly - h * 0.28}L${x + w} ${ly}Z" fill="${W[1]}" stroke="${W[3]}" stroke-width=".7"/>`
       + `<path d="M${x + 2} ${ly - h * 0.3}Q${cx} ${ly - h * 0.7} ${x + w - 2} ${ly - h * 0.3}" stroke="${W[0]}" stroke-width="1.2" opacity=".5"/>`
       + `<path d="M${x + 5} ${ly}L${x + 5} ${ly - h * 0.38}" stroke="${I[1]}" stroke-width="2.6"/>`
       + `<path d="M${x + w - 6.3} ${ly}L${x + w - 6.3} ${ly - h * 0.38}" stroke="${I[1]}" stroke-width="2.6"/>`;
  }
  // Schloss
  s += `<rect x="${cx - 3}" y="${y - 1}" width="6" height="6.5" rx="1" fill="${G[1]}" stroke="${G[3]}" stroke-width=".6"/>`
     + `<circle cx="${cx}" cy="${y + 2}" r=".9" fill="${G[3]}"/><rect x="${cx - .4}" y="${y + 2}" width=".8" height="2" fill="${G[3]}"/>`;
  return s;
}

// Tonkrug (Amphore ohne Henkel); mouthFill = Inhalt in der Öffnung
function trJar(mouthFill = null) {
  const C = TR_CLAY;
  return `<path d="M33 37L47 37L46.5 41Q58 46 56.5 57Q55 66 40 66Q25 66 23.5 57Q22 46 33.5 41Z" fill="${C[1]}" stroke="${C[3]}" stroke-width=".7" stroke-linejoin="round"/>`
       + `<path d="M28 47Q25 55 28 61" stroke="${C[0]}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`
       + `<path d="M24.5 52Q40 57 55.5 52" stroke="${C[2]}" stroke-width="1.6"/>`
       + `<path d="M25 55.5Q40 60 55 55.5" stroke="${C[2]}" stroke-width=".8" stroke-dasharray="1.6 1.4"/>`
       + `<ellipse cx="40" cy="37" rx="8.5" ry="2.6" fill="${C[0]}" stroke="${C[3]}" stroke-width=".6"/>`
       + `<ellipse cx="40" cy="37" rx="6.2" ry="1.7" fill="${mouthFill || '#3A2416'}"/>`;
}

// Amulett-Scheibe
function trDisc(cx, cy, r, engraved = false) {
  const G = TR_GOLD;
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${G[2]}" stroke="${G[3]}" stroke-width=".7"/>`
        + `<circle cx="${cx - .4}" cy="${cy - .4}" r="${r - 1.6}" fill="${G[1]}"/>`
        + `<ellipse cx="${cx - r * .4}" cy="${cy - r * .45}" rx="${r * .3}" ry="${r * .17}" fill="#FFFFFF" opacity=".4" transform="rotate(-30 ${cx - r * .4} ${cy - r * .45})"/>`;
  if (engraved) {
    s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.3}" stroke="${G[3]}" stroke-width=".9"/>`;
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 4 * i;
      const x1 = cx + Math.cos(a) * r * 0.42, y1 = cy + Math.sin(a) * r * 0.42;
      const x2 = cx + Math.cos(a) * r * 0.68, y2 = cy + Math.sin(a) * r * 0.68;
      s += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${G[3]}" stroke-width=".9" stroke-linecap="round"/>`;
    }
  }
  return s;
}
// Kette über der Scheibe
const trChain = (cx, top, bottom, spread) =>
  `<path d="M${cx - spread} ${bottom}Q${cx} ${top} ${cx + spread} ${bottom}" stroke="${TR_GOLD[2]}" stroke-width="1.7" stroke-dasharray="2.2 1.3" stroke-linecap="round"/>`;

// =============================================================
// SPARZIEL-SCHÄTZE — 5 Typen × 6 Stufen
// =============================================================
const TREASURE_SVGS = {

  // ☀️ SONNENAMULETT (Sonnenblume)
  sunflower: {
    seed: trSvg(trShadow(12)
      + `<path d="M33 64L34 58L38 55L44 56L47 60L46 64Z" fill="${TR_GOLD[2]}" stroke="${TR_GOLD[3]}" stroke-width=".6" stroke-linejoin="round"/>`
      + `<path d="M35 58L38 55.6L42 56.5L37 60Z" fill="${TR_GOLD[0]}"/>`
      + `<path d="M38 60L44 58L45.5 62L40 63Z" fill="${TR_GOLD[1]}"/>`),
    sprout: trSvg(trShadow(13)
      + `<ellipse cx="40" cy="63.5" rx="9" ry="2.5" fill="${TR_GOLD[3]}" opacity=".35"/>`
      + trDisc(40, 54, 9)),
    small_plant: trSvg(trShadow(14)
      + trDisc(40, 50, 12)
      + `<circle cx="40" cy="50" r="2.4" fill="${TR_GOLD[3]}" opacity=".6"/>`
      + `<rect x="38.8" y="36" width="2.4" height="3" rx=".8" fill="${TR_GOLD[2]}"/>`),
    medium_plant: trSvg(trShadow(15)
      + trDisc(40, 48, 14, true)
      + `<rect x="38.6" y="32" width="2.8" height="3.5" rx=".9" fill="${TR_GOLD[2]}"/>`),
    large_plant: trSvg(trShadow(15)
      + trChain(40, 6, 32, 11)
      + `<rect x="38.6" y="30" width="2.8" height="3.5" rx=".9" fill="${TR_GOLD[2]}"/>`
      + trDisc(40, 47, 14, true)
      + trGem(40, 46, .8, ['#FFE7A0', '#F2A93B', '#C0701A', '#7A4210'])
      + trSparkle(58, 38, .8)),
    flowering: trSvg(trShadow(17)
      + `<circle cx="40" cy="47" r="23" fill="#FFE9A0" opacity=".28"/>`
      + trChain(40, 4, 26, 10)
      + (() => { // Strahlenkranz = Sonnenblumen-Blätter
          let s = '';
          for (let i = 0; i < 16; i++) {
            const a = Math.PI * 2 / 16 * i;
            const bx = 40 + Math.cos(a) * 14, by = 47 + Math.sin(a) * 14;
            const tx = 40 + Math.cos(a) * 21, ty = 47 + Math.sin(a) * 21;
            const px = Math.cos(a + Math.PI / 2) * 2.6, py = Math.sin(a + Math.PI / 2) * 2.6;
            s += `<path d="M${(bx + px).toFixed(2)} ${(by + py).toFixed(2)}L${tx.toFixed(2)} ${ty.toFixed(2)}L${(bx - px).toFixed(2)} ${(by - py).toFixed(2)}Z" fill="${i % 2 ? TR_GOLD[0] : TR_GOLD[1]}" stroke="${TR_GOLD[3]}" stroke-width=".4"/>`;
          }
          return s;
        })()
      + `<rect x="38.6" y="24.5" width="2.8" height="3.5" rx=".9" fill="${TR_GOLD[2]}"/>`
      + trDisc(40, 47, 14, true)
      + trGem(40, 45.5, 1.05, ['#FFE7A0', '#F2A93B', '#C0701A', '#7A4210'])
      + trSparkle(62, 30, 1, true) + trSparkle(17, 58, .8, true) + trSparkle(63, 62, .6)),
  },

  // 💎 SMARAGD-GEODE (Kaktus)
  cactus: {
    seed: trSvg(trShadow(17) + trRock()),
    sprout: trSvg(trShadow(17) + trRock()
      + `<path d="M34 48L37 53L35 57L39 61" stroke="${TR_STONE[3]}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<path d="M36 52L38 54.5L36.5 57" stroke="${TR_EMERALD[1]}" stroke-width="1.6" stroke-linecap="round"/>`
      + trSparkle(43, 50, .5)),
    small_plant: trSvg(trShadow(19) + trGeode([[34, 61, 2.6, 13, -14], [40, 61, 3, 16, 0], [46, 61, 2.6, 12, 14]])),
    medium_plant: trSvg(trShadow(19) + trGeode([[27, 62, 2.6, 13, -24], [33, 61, 3.2, 20, -10], [40, 61, 3.6, 25, 0],
      [47, 61, 3, 18, 12], [53, 62, 2.6, 12, 26]])),
    large_plant: trSvg(trShadow(20) + trGeode([[25, 62, 2.6, 15, -30], [31, 61, 3.2, 24, -16], [37, 61, 3.8, 34, -5],
      [43, 61, 4, 40, 3], [49, 61, 3.4, 28, 14], [55, 62, 2.8, 17, 28]])
      + trSparkle(60, 22, .7)),
    flowering: trSvg(trShadow(20) + `<circle cx="40" cy="40" r="22" fill="#B8F0CC" opacity=".25"/>`
      + trGeode([[25, 62, 2.6, 15, -30], [31, 61, 3.2, 24, -16], [37, 61, 3.8, 34, -5],
        [43, 61, 4, 40, 3], [49, 61, 3.4, 28, 14], [55, 62, 2.8, 17, 28]],
        [[3, .95], [1, .75], [4, .75], [0, .6], [5, .6]])
      + trSparkle(62, 18, .9, true) + trSparkle(16, 34, .7, true)),
  },

  // 🧰 SCHATZTRUHE (Bonsai)
  bonsai: {
    seed: trSvg(trShadow(16)
      + `<path d="M26 52L54 52L52 64L28 64Z" fill="${TR_WOOD[1]}" stroke="${TR_WOOD[3]}" stroke-width=".7" stroke-linejoin="round"/>`
      + `<path d="M28 52L52 52L51 55L29 55Z" fill="${TR_WOOD[3]}" opacity=".6"/>`
      + `<line x1="27" y1="58.5" x2="53" y2="58.5" stroke="${TR_WOOD[2]}" stroke-width=".8"/>`
      + `<line x1="36" y1="55" x2="35.5" y2="64" stroke="${TR_WOOD[2]}" stroke-width=".6"/>`
      + `<line x1="45" y1="55" x2="45.5" y2="64" stroke="${TR_WOOD[2]}" stroke-width=".6"/>`),
    sprout: trSvg(trShadow(15) + trChest(40, 65, 26, 14, 'closed')),
    small_plant: trSvg(trShadow(17) + trChest(40, 65, 32, 16, 'ajar') + trSparkle(52, 40, .5)),
    medium_plant: trSvg(trShadow(18) + trChest(40, 65, 34, 17, 'open',
        trPile(40, 49, 26, 5, [[-6, 3, 3.5], [5, 4, 3.5]]))),
    large_plant: trSvg(trShadow(19) + trChest(40, 66, 36, 18, 'open',
        trPile(40, 49, 30, 11, [[-8, 4, 3.5], [3, 9, 3.6], [9, 4, 3.5]]) + trGem(-1 + 40, 41, .7, TR_EMERALD))
      + trSparkle(57, 32, .7)),
    flowering: trSvg(trShadow(23) + `<circle cx="40" cy="42" r="24" fill="#FFE9A0" opacity=".25"/>`
      + trChest(40, 65, 36, 18, 'open',
        trPile(40, 48, 34, 21, [[-10, 5, 3.6], [-1, 16, 3.8], [8, 7, 3.6], [-5, 10, 3.4], [11, 2, 3.2]])
        + trGem(34, 37, .9, TR_RUBY) + trGem(47, 40, .8, TR_SAPPH) + trGem(40, 44, .7, TR_EMERALD)
        + `<g transform="rotate(14 47 30)">${trCrown(47, 32, 10, 5, 3, TR_GOLD)}</g>`)
      // Kette über die Vorderkante gehängt
      + `<path d="M25 47.5Q27 56 33 55Q37 54 38 47.5" stroke="${TR_GOLD[2]}" stroke-width="1.6" stroke-dasharray="1.8 1" stroke-linecap="round"/>`
      + trGem(29.5, 55, .5, TR_RUBY)
      + trCoinFlat(19, 66, 4) + trCoinFlat(61, 67, 4.5) + trCoinFlat(66, 64, 3.5) + trCoinUp(16, 61, 3)
      + trSparkle(63, 24, 1, true) + trSparkle(17, 36, .7, true)),
  },

  // 🏺 TONKRUG (Zimmerpflanze)
  potplant: {
    seed: trSvg(trShadow(17) + trJar()),
    sprout: trSvg(trShadow(17) + trJar() + trCoinUp(41, 34, 3.6)),
    small_plant: trSvg(trShadow(17) + trJar(TR_GOLD[1])
      + trCoinFlat(37, 36.5, 3) + trCoinFlat(43, 37, 3)),
    medium_plant: trSvg(trShadow(17) + trJar(TR_GOLD[1])
      + trPile(40, 37.5, 15, 7, [[-3, 3, 2.8], [3, 4, 2.8]]) + trCoinUp(46, 31, 3)),
    large_plant: trSvg(trShadow(18) + trJar(TR_GOLD[1])
      + trPile(40, 37.5, 17, 12, [[-4, 4, 3], [2, 8, 3], [5, 3, 3]])
      + trPearl(33, 33) + trPearl(47, 32) + trPearl(41, 25.5, 1.6)
      + trSparkle(55, 26, .6)),
    flowering: trSvg(trShadow(22) + `<circle cx="40" cy="38" r="22" fill="#FFE9A0" opacity=".25"/>`
      + trJar(TR_GOLD[1])
      + trPile(40, 37.5, 19, 15, [[-5, 4, 3], [1, 10, 3.2], [6, 4, 3], [-1, 6, 2.6]])
      // Halskette vorne über den Krug gehängt, Rubin-Anhänger
      + `<path d="M32.5 38Q29 51 40 52Q51 51 47.5 38" stroke="${TR_GOLD[2]}" stroke-width="1.7" stroke-dasharray="1.9 1.1" stroke-linecap="round"/>`
      + trGem(40, 53, .75, TR_RUBY)
      + trPearl(31, 33) + trPearl(49, 32) + trPearl(44, 22.5, 1.6) + trGem(37, 23, .7, TR_EMERALD)
      + trCoinFlat(20, 65.5, 4) + trCoinFlat(59, 66, 4) + trCoinUp(64, 61, 3.4)
      + trSparkle(58, 22, 1, true) + trSparkle(19, 44, .7, true)),
  },

  // 👑 KRONE (Kirschblüte)
  cherryblossom: {
    seed: trSvg(trShadow(12)
      + `<ellipse cx="40" cy="61" rx="10" ry="3.8" stroke="${TR_ROSE[3]}" stroke-width="3.6"/>`
      + `<ellipse cx="40" cy="61" rx="10" ry="3.8" stroke="${TR_ROSE[1]}" stroke-width="2.4"/>`
      + `<path d="M31 60Q34 57.6 38 57.4" stroke="${TR_ROSE[0]}" stroke-width="1" stroke-linecap="round"/>`),
    sprout: trSvg(trShadow(12)
      + `<circle cx="40" cy="54" r="9" stroke="${TR_ROSE[3]}" stroke-width="3.8"/>`
      + `<circle cx="40" cy="54" r="9" stroke="${TR_ROSE[1]}" stroke-width="2.6"/>`
      + `<path d="M33 49Q35 46 39 45.2" stroke="${TR_ROSE[0]}" stroke-width="1" stroke-linecap="round"/>`
      + `<rect x="36.5" y="42" width="7" height="3.6" rx="1" fill="${TR_ROSE[2]}"/>`
      + trGem(40, 41.5, .9, TR_PINK)),
    small_plant: trSvg(trShadow(16)
      + `<path d="M22 60Q40 48 58 60" stroke="${TR_ROSE[3]}" stroke-width="4.6" stroke-linecap="round"/>`
      + `<path d="M22 60Q40 48 58 60" stroke="${TR_ROSE[1]}" stroke-width="3.2" stroke-linecap="round"/>`
      + `<path d="M35 53.6L40 38L45 53.6Z" fill="${TR_ROSE[1]}" stroke="${TR_ROSE[3]}" stroke-width=".7" stroke-linejoin="round"/>`
      + trGem(40, 48, 1, TR_PINK) + trPearl(40, 37.5, 1.5)),
    medium_plant: trSvg(trShadow(16) + trCrown(40, 62, 28, 16, 3, TR_ROSE)
      + trGem(40, trBandY(40, 28, 40, 58.5), .85, TR_PINK)),
    large_plant: trSvg(trShadow(18) + trCrown(40, 63, 34, 21, 5, TR_ROSE, (x, y) => trGem(x, y - 1.5, .55, TR_RUBY))
      + trGem(31, trBandY(40, 34, 31, 59.5), .7, TR_RUBY) + trGem(40, trBandY(40, 34, 40, 59.5), .95, TR_PINK) + trGem(49, trBandY(40, 34, 49, 59.5), .7, TR_RUBY)
      + trSparkle(60, 32, .6)),
    flowering: trSvg(trShadow(20) + `<circle cx="40" cy="44" r="23" fill="#FFD3E2" opacity=".3"/>`
      + trCrown(40, 63, 36, 24, 5, TR_ROSE, (x, y, i) => i % 2 === 0 ? trBlossom(x, y - 1.5, 2.6) : trPearl(x, y - .5, 1.6))
      + [26, 35.5, 44.5, 54].map(x => trPearl(x, trBandY(40, 36, x, 61), 1.1)).join('')
      + trGem(31, trBandY(40, 36, 31, 59), .75, TR_RUBY) + trGem(40, trBandY(40, 36, 40, 59), 1.05, TR_PINK) + trGem(49, trBandY(40, 36, 49, 59), .75, TR_RUBY)
      + trBlossom(18, 65, 1.8) + trBlossom(62, 66, 1.6)
      + trSparkle(63, 28, 1, true) + trSparkle(16, 40, .7, true)),
  },
};

// =============================================================
// SCHATZHORT (Finanzbaum) — 6 Stufen
// =============================================================
const HOARD_SVGS = {
  seed: trSvg(trShadow(10) + trCoinFlat(40, 62, 6.5, TR_COPPER)),
  sprout: trSvg(trShadow(14)
    + trStack(37, 63, 4, 7) + trCoinFlat(48, 64, 4.5, TR_COPPER)),
  small_plant: trSvg(trShadow(16)
    + `<path d="M27 65Q23 52 33 45L47 45Q57 52 53 65Z" fill="${TR_LEATHER[1]}" stroke="${TR_LEATHER[3]}" stroke-width=".7" stroke-linejoin="round"/>`
    + `<path d="M29 60Q27 52 33 47" stroke="${TR_LEATHER[0]}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`
    + `<path d="M33 45Q31 39 35 37Q40 40 45 37Q49 39 47 45Z" fill="${TR_LEATHER[2]}" stroke="${TR_LEATHER[3]}" stroke-width=".6"/>`
    + trCoinUp(37, 38, 3.4) + trCoinUp(43, 37, 3.6)
    + `<path d="M32 45.5Q40 48 48 45.5" stroke="${TR_GOLD[2]}" stroke-width="1.8" stroke-linecap="round"/>`
    + `<circle cx="47.5" cy="47" r="1.6" fill="${TR_GOLD[1]}"/>`
    + trCoinFlat(57, 65, 4) + trCoinFlat(22, 66, 3.5, TR_COPPER)),
  medium_plant: trSvg(trShadow(21)
    + trPile(40, 65, 40, 16, [[-11, 4, 4], [-2, 11, 4.4], [8, 6, 4.2], [13, 2, 3.6]])
    + trCoinUp(30, 55, 3.6) + trCoinFlat(60, 66, 3.5)),
  large_plant: trSvg(trShadow(24)
    + trPile(38, 66, 50, 22, [[-15, 4, 4.2], [-5, 14, 4.6], [6, 18, 4.4], [12, 7, 4.4], [-10, 9, 3.6]])
    + trGoblet(58, 44)
    + trStack(20, 64, 3, 5.5)
    + trGem(30, 53, .8, TR_EMERALD)
    + trSparkle(46, 34, .8)),
  flowering: trSvg(trShadow(27) + `<circle cx="40" cy="44" r="27" fill="#FFE9A0" opacity=".28"/>`
    + trPile(40, 67, 58, 28, [[-18, 4, 4.4], [-8, 16, 4.6], [5, 22, 4.6], [14, 10, 4.4], [-14, 10, 3.8], [20, 3, 3.8]])
    + trCrown(40, 41, 16, 9, 3, TR_GOLD, (x, y) => trGem(x, y - 1, .45, TR_RUBY))
    + trGoblet(62, 44)
    + trStack(17, 65, 4, 5.5)
    + trGem(28, 52, .9, TR_EMERALD) + trGem(51, 55, .85, TR_SAPPH) + trGem(37, 58, .8, TR_RUBY)
    + `<path d="M24 58Q30 62 36 61" stroke="${TR_GOLD[2]}" stroke-width="1.5" stroke-dasharray="1.7 1" stroke-linecap="round"/>`
    + trSparkle(55, 26, 1.1, true) + trSparkle(22, 34, .8, true) + trSparkle(66, 58, .6)),
};

// Namen/Symbole im RPG-Theme (ersetzen PLANT_NAMES/PLANT_EMOJIS)
const TREASURE_NAMES = {
  sunflower:     'Sonnenamulett',
  cactus:        'Smaragd-Geode',
  bonsai:        'Schatztruhe',
  potplant:      'Tonkrug',
  cherryblossom: 'Krone',
};
const TREASURE_EMOJIS = {
  sunflower:     '☀️',
  cactus:        '💎',
  bonsai:        '🧰',
  potplant:      '🏺',
  cherryblossom: '👑',
};

function isTreasureStyle() {
  return document.documentElement.getAttribute('data-pages-style') === 'rpg';
}

// Stufen-Namen des Schatzhorts. Hat der Nutzer im Finanzbaum-Fenster eigene
// Namen vergeben, bleiben diese stehen — nur die unveränderten Standard-
// Namen (FINANZBAUM_DEFAULT_LEVELS in budget.js) werden übersetzt.
const HOARD_STAGE_LABELS = {
  seed:         'Kupfermünze',
  sprout:       'Münzstapel',
  small_plant:  'Geldbeutel',
  medium_plant: 'Goldhaufen',
  large_plant:  'Schatzhaufen',
  flowering:    'Drachenhort',
};
function hoardStageLabel(level) {
  const def = FINANZBAUM_DEFAULT_LEVELS.find(l => l.stage === level.stage);
  return def && def.label === level.label ? (HOARD_STAGE_LABELS[level.stage] || level.label) : level.label;
}

// Pflanzenauswahl im Sparziel-Fenster (index.html: .goal-plant-option)
// passend zum Theme beschriften; die Werte (value) bleiben die Pflanzen-
// Schlüssel. Wird bei jedem Rendern des Finanzgartens aufgerufen.
function applyTreasurePickerLabels() {
  const treasure = isTreasureStyle();
  document.querySelectorAll('.goal-plant-option').forEach(opt => {
    const type = opt.querySelector('input')?.value;
    if (!type) return;
    const icon = opt.querySelector('.goal-plant-icon');
    const name = opt.querySelector('.goal-plant-name');
    if (icon) icon.textContent = treasure ? TREASURE_EMOJIS[type] : PLANT_EMOJIS[type];
    if (name) name.textContent = treasure ? TREASURE_NAMES[type] : PLANT_NAMES[type];
  });
}

// Theme-Wechsel bei offenem Budget: Garten/Schatzkammer sofort neu zeichnen
new MutationObserver(records => {
  const now = document.documentElement.getAttribute('data-pages-style');
  if (!records.some(r => r.oldValue !== now)) return; // gleicher Stil erneut gesetzt
  applyTreasurePickerLabels();
  if (document.getElementById('view-budget')?.classList.contains('active') && typeof renderBudget === 'function') renderBudget();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-pages-style'], attributeOldValue: true });
