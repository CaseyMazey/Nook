// =========================
// SPEISEPLAN — Today-Sidebar-Widget (Kantinen-Speiseplan der Woche)
//
// Der Wochen-Speiseplan kommt als PDF (Browser-Export einer Intrexx-Seite
// aus Dock B, mit echter Textebene — kein Scan). Der Nutzer gibt Nook das
// PDF einmal pro Woche (Button oder Drag & Drop aufs Widget), Nook liest
// daraus Menü 1–3 + Dessert je Wochentag aus, zeigt das Ergebnis zur
// Kontrolle/Korrektur im Modal und das Widget danach jeden Tag die
// Gerichte von heute.
//
// PDF-Auslesen: pdf.js (js/vendor, feste Version) wird erst beim ersten Import
// per <script>-Tag nachgeladen — kein fetch(), funktioniert auch unter
// file://. Der Worker wird ebenfalls als normales Script geladen
// (globalThis.pdfjsWorker), pdf.js rechnet dann im Hauptthread — ein
// echter Web-Worker von fremder Herkunft wäre unter file:// und auf der
// gehosteten Seite ohnehin blockiert. pdf.js liegt lokal (js/vendor) und
// funktioniert damit auch offline; schlägt das Laden trotzdem fehl, öffnet
// das Modal leer zum Eintragen von Hand.
//
// Tabellen-Erkennung über die Textpositionen (siehe mealPlanParsePage):
//   - Spalten: Überschriften MONTAG … FREITAG, Grenze jeweils mittig
//     zwischen zwei Überschriften.
//   - Zeilen: Beschriftungen in der linken Spalte (MENÜ 1 … DESSERT);
//     Grenze zwischen zwei Beschriftungen = größte senkrechte Lücke im
//     Inhalt dazwischen (Beschriftungen sitzen vertikal mittig, Zellen
//     sind unterschiedlich hoch — eine reine Mitte-Grenze würde lange
//     Zellen wie Freitag/Menü 3 abschneiden).
//
// Lädt nach main.js (DB, dateKey, parseLocalDate, getWeekStart,
// getISOWeek, fmt) und hub-utils.js (wireModal).
// =========================

// =========================
// DATENMODELL
// { [montagDateKey]: { kw, importedAt, labels:{menu1,menu2,menu3,dessert},
//                      days:[{menu1,menu2,menu3,dessert} × 5 (Mo–Fr)] } }
// Es wird immer nur EINE Woche gehalten — Speichern ersetzt die vorige.
// Gerichte sind reiner Text; beginnt er mit "VEGAN", zeigt das Widget
// eine Markierung (so bleibt das Bearbeiten ein einfaches Textfeld).
// Allergen-Kürzel aus dem PDF stehen gesammelt am Ende, z.B. "… (A, G)";
// das Widget blendet sie aus und nutzt sie für die Allergiehinweise.
// =========================
let mealPlanWeeks = DB.get('mealPlanWeeks', {});
function saveMealPlanWeeks() { DB.set('mealPlanWeeks', mealPlanWeeks); }

// Lieblingsgerichte: Stichwörter (Treffer-Logik in js/mealplan-fav.js),
// mealPlanFavHintHidden = Montag (dateKey) der Woche, deren Hinweis per ✕
// ausgeblendet wurde.
let mealPlanFavorites = DB.get('mealPlanFavorites', []);
if (!Array.isArray(mealPlanFavorites)) mealPlanFavorites = [];
function saveMealPlanFavorites() { DB.set('mealPlanFavorites', mealPlanFavorites); }
let mealPlanFavHintHidden = DB.get('mealPlanFavHintHidden', null);

const MEALPLAN_SLOTS = [
  { key: 'menu1',   label: 'Menü 1' },
  { key: 'menu2',   label: 'Menü 2' },
  { key: 'menu3',   label: 'Menü 3' },
  { key: 'dessert', label: 'Dessert' },
];
const MEALPLAN_WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

const PDFJS_BASE = "js/vendor/pdfjs/"; // pdf.js 3.11.174, lokal ausgeliefert

function mealPlanEmptyDays() {
  return MEALPLAN_WEEKDAYS.map(() => ({ menu1: '', menu2: '', menu3: '', dessert: '' }));
}

// Wochentag (Mo–Fr) → { week, dayIndex } aus den gespeicherten Daten
function mealPlanLookup(date) {
  const monday = getWeekStart(date);
  const week = mealPlanWeeks[dateKey(monday)];
  const dayIndex = (date.getDay() + 6) % 7;
  if (!week || dayIndex > 4) return { week: null, dayIndex };
  return { week, dayIndex };
}

// =========================
// ALLERGIEHINWEISE
// [{ id, name, reminder, codes:['G'], keywords:['sahne', …], except:['kokosmilch', …] }]
// Ein Gericht löst einen Hinweis aus, wenn es eines der Kürzel trägt (aus dem
// PDF) ODER eines der Stichwörter enthält. Stichwörter sind Teilwörter, damit
// deutsche Komposita greifen ("sahne" → "Kräutersahnesoße"); Ausnahmen werden
// vorher aus dem Text gestrichen ("kokosmilch" zählt nicht als "milch").
// =========================
let mealPlanAlerts = DB.get('mealPlanAlerts', []);
function saveMealPlanAlerts() { DB.set('mealPlanAlerts', mealPlanAlerts); }

// Allergen-Kennzeichnung nach LMIV, wie sie deutsche Kantinen meist nutzen
const MEALPLAN_ALLERGENS = [
  { code: 'A', label: 'Gluten' },
  { code: 'B', label: 'Krebstiere' },
  { code: 'C', label: 'Eier' },
  { code: 'D', label: 'Fisch' },
  { code: 'E', label: 'Erdnüsse' },
  { code: 'F', label: 'Soja' },
  { code: 'G', label: 'Milch / Laktose' },
  { code: 'H', label: 'Schalenfrüchte (Nüsse)' },
  { code: 'L', label: 'Sellerie' },
  { code: 'M', label: 'Senf' },
  { code: 'N', label: 'Sesam' },
  { code: 'O', label: 'Sulfite' },
  { code: 'P', label: 'Lupinen' },
  { code: 'R', label: 'Weichtiere' },
];

const MEALPLAN_ALERT_PRESETS = [
  { name: 'Laktose', reminder: 'Lactostop mitnehmen', codes: ['G'],
    keywords: ['sahne', 'rahm', 'milch', 'käse', 'butter', 'quark', 'joghurt', 'schmand', 'mascarpone', 'mozzarella', 'parmesan', 'feta', 'béchamel', 'bechamel', 'gratin', 'überbacken', 'carbonara', 'pudding'],
    except: ['kokosmilch', 'hafermilch', 'sojamilch', 'mandelmilch', 'reismilch', 'erdnussbutter', 'kakaobutter', 'kokosjoghurt', 'sojajoghurt', 'veganer käse', 'veganem käse'] },
  { name: 'Gluten', reminder: '', codes: ['A'],
    keywords: ['nudel', 'pasta', 'spaghetti', 'penne', 'lasagne', 'spätzle', 'brot', 'brötchen', 'paniert', 'panade', 'schnitzel', 'pizza', 'knödel', 'couscous', 'bulgur', 'seitan', 'kuchen', 'teig'],
    except: [] },
  { name: 'Nüsse', reminder: '', codes: ['E', 'H'],
    keywords: ['nuss', 'nüsse', 'mandel', 'cashew', 'pistazie', 'pesto', 'krokant', 'marzipan'],
    except: ['muskatnuss'] },
  { name: 'Eier', reminder: '', codes: ['C'],
    keywords: ['rührei', 'spiegelei', 'omelett', 'mayonnaise', 'mayo', 'eiernudel', 'frittata', 'quiche', 'eiersalat'],
    except: [] },
  { name: 'Fisch & Meeresfrüchte', reminder: '', codes: ['B', 'D', 'R'],
    keywords: ['fisch', 'lachs', 'thunfisch', 'kabeljau', 'forelle', 'hering', 'scholle', 'garnele', 'shrimp', 'scampi', 'muschel', 'calamari', 'tintenfisch'],
    except: [] },
];

// Welche Hinweise löst ein Gericht aus? → [{ alert, reasons:['Kennzeichnung G', 'Sahne'] }]
function mealPlanAlertHits(dishText) {
  if (!dishText || !mealPlanAlerts.length) return [];
  const { text, codes } = mealPlanSplitDish(dishText);
  const lower = text.toLowerCase();
  return mealPlanAlerts.map(alert => {
    const reasons = [];
    (alert.codes || []).filter(c => codes.includes(c)).forEach(c => reasons.push('Kennzeichnung ' + c));
    let scan = lower;
    // gleich lang ersetzen, damit Positionen in scan und text übereinstimmen
    (alert.except || []).forEach(ex => { if (ex) scan = scan.split(ex.toLowerCase()).join(' '.repeat(ex.length)); });
    (alert.keywords || []).forEach(kw => {
      const k = kw.toLowerCase();
      if (!k) return;
      const idx = scan.indexOf(k);
      if (idx < 0) return;
      // ganzes Wort aus dem Gericht als Grund anzeigen ("Kräutersahnesoße")
      const word = text.slice(0, idx).match(/[\wäöüßÄÖÜéè-]*$/)[0] + text.slice(idx).match(/^[\wäöüßÄÖÜéè-]*/)[0];
      if (!reasons.includes(word || kw)) reasons.push(word || kw);
    });
    return reasons.length ? { alert, reasons } : null;
  }).filter(Boolean);
}

// =========================
// PDF.JS — lazy per <script>-Tag
// =========================
// loadScriptOnce (hub-utils.js) lädt jede Datei nur einmal
function mealPlanLoadPdfjs() {
  return loadScriptOnce(PDFJS_BASE + 'pdf.min.js')
    .then(() => loadScriptOnce(PDFJS_BASE + 'pdf.worker.min.js'))
    .then(() => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
      return window.pdfjsLib;
    });
}

// =========================
// PARSER
// =========================
const MEALPLAN_DAY_RE = /^(MONTAG|DIENSTAG|MITTWOCH|DONNERSTAG|FREITAG)$/;
const MEALPLAN_MONTHS = ['januar','februar','märz','april','mai','juni','juli','august','september','oktober','november','dezember'];

// Zeilenbeschriftung → Slot-Key (Suppen/Gemüse werden erkannt, damit sie
// als Zeilengrenze dienen, aber nicht übernommen)
function mealPlanRowKey(text) {
  const t = text.toUpperCase().replace(/\s+/g, '').replace('MENUE', 'MENÜ').replace('MENU', 'MENÜ');
  const m = t.match(/^MENÜ([123])$/);
  if (m) return 'menu' + m[1];
  if (t === 'DESSERT' || t === 'NACHTISCH') return 'dessert';
  if (/^SUPPE\d?$/.test(t)) return 'soup';
  if (t === 'GEMÜSE' || t === 'BEILAGE' || t === 'SALAT') return 'side';
  return null;
}

// Allergen-/Zusatzstoff-Kürzel wie (A,D,G) oder (G,L,1). Buchstaben =
// Allergene nach LMIV, Zahlen = Zusatzstoffe (für die Hinweise egal).
const MEALPLAN_CODE_RE = /\s*\(\s*(?:[A-Z]|\d{1,2})(?:\s*,\s*(?:[A-Z]|\d{1,2}))*\s*\)/g;

// Alle Allergen-Buchstaben aus einem Text, sortiert und ohne Doppelte
function mealPlanExtractCodes(text) {
  const codes = new Set();
  (text.match(MEALPLAN_CODE_RE) || []).forEach(group => {
    (group.match(/[A-Z]/g) || []).forEach(c => codes.add(c));
  });
  return [...codes].sort();
}

// Gericht → { text (ohne Kürzel), codes }. Die Kürzel stehen im gespeicherten
// Text am Ende (so bleibt das Bearbeiten ein einfaches Textfeld) und werden
// im Widget ausgeblendet.
function mealPlanSplitDish(text) {
  return {
    text: text.replace(MEALPLAN_CODE_RE, '').replace(/\s+/g, ' ').trim(),
    codes: mealPlanExtractCodes(text),
  };
}

// Kürzel entfernen, Leerzeichen/Schrägstriche glätten
function mealPlanCleanText(text) {
  return text
    .replace(MEALPLAN_CODE_RE, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/^\s*\/\s*|\s*\/\s*$/g, '')
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    .replace(/"\s*([^"]*?)\s*"/g, '"$1"')
    .replace(/\)(?=["\w])/g, ') ').replace(/(["\w])\(/g, '$1 (')
    .trim();
}

// Zeilen einer Zelle (je { y, text }) → Text; Silbentrennung am Zeilenende
// ("Gemüse-" + "Kartoffelpfanne") ohne Leerzeichen zusammenfügen.
// Eine Zeile "VEGAN" mitten in der Zelle beginnt eine zweite Variante
// (z.B. Freitag: dasselbe Gericht einmal vegetarisch, einmal vegan).
function mealPlanCellText(lines) {
  const variants = [[]];
  lines.forEach((l, i) => {
    if (i > 0 && /^VEGAN\b/.test(l.text)) variants.push([]);
    variants[variants.length - 1].push(l.text);
  });
  const raw = variants.map(v => v.reduce((acc, line) => {
    if (!acc) return line;
    return /-$/.test(acc) ? acc + line : acc + ' ' + line;
  }, ''));
  // Allergen-Kürzel aller Varianten gesammelt ans Ende (für die Allergiehinweise)
  const codes = mealPlanExtractCodes(raw.join(' '));
  const suffix = codes.length ? ` (${codes.join(', ')})` : '';
  const texts = raw.map(mealPlanCleanText).filter(Boolean);
  if (!texts.length) return '';
  if (texts.length < 2) return texts[0] + suffix;

  const plain = t => t.replace(/^VEGAN\s*/, '');
  if (texts.every(t => plain(t) === plain(texts[0]))) {
    const anyPlain = texts.some(t => !/^VEGAN\b/.test(t));
    return (anyPlain ? plain(texts[0]) + ' (auch vegan)' : texts[0]) + suffix;
  }
  return texts.join(' · oder: ') + suffix;
}

// Textstücke einer Seite → { found, days, labels }
function mealPlanParsePage(items) {
  const heads = items.filter(i => MEALPLAN_DAY_RE.test(i.str.trim().toUpperCase()))
    .map(i => ({ day: MEALPLAN_DAY_RE.exec(i.str.trim().toUpperCase())[1], cx: i.x + i.w / 2, y: i.y }))
    .sort((a, b) => a.cx - b.cx);
  if (heads.length < 3) return { found: false };

  const step = (heads[heads.length - 1].cx - heads[0].cx) / (heads.length - 1);
  const colLeft = heads[0].cx - step / 2;
  const headerY = Math.max(...heads.map(h => h.y));
  const colOf = cx => {
    if (cx < colLeft) return -1;
    for (let c = 0; c < heads.length - 1; c++) {
      if (cx < (heads[c].cx + heads[c + 1].cx) / 2) return c;
    }
    return cx < heads[heads.length - 1].cx + step / 2 ? heads.length - 1 : -2;
  };

  const below = items.filter(i => i.y > headerY + 2);
  const labelItems = below.filter(i => colOf(i.x + i.w / 2) === -1);
  const content = below.filter(i => colOf(i.x + i.w / 2) >= 0);

  // Hauptbeschriftungen (MENÜ 1 …) in der linken Spalte, von oben nach unten
  const rows = labelItems
    .map(i => ({ key: mealPlanRowKey(i.str), y: i.y }))
    .filter(r => r.key)
    .sort((a, b) => a.y - b.y);
  if (!rows.some(r => r.key === 'menu1')) return { found: false };

  // Zeilengrenzen: größte Inhaltslücke zwischen zwei Beschriftungen
  const ys = [...new Set(content.map(i => i.y))].sort((a, b) => a - b);
  const bounds = [headerY + 2];
  for (let r = 0; r < rows.length - 1; r++) {
    const a = rows[r].y, b = rows[r + 1].y;
    const pts = [a, ...ys.filter(y => y > a && y < b), b];
    let best = 0, cut = (a + b) / 2;
    for (let p = 0; p < pts.length - 1; p++) {
      const gap = pts[p + 1] - pts[p];
      if (gap > best) { best = gap; cut = (pts[p] + pts[p + 1]) / 2; }
    }
    bounds.push(cut);
  }
  // letzte Zeile: bis zur ersten großen Lücke nach ihrer Beschriftung
  const last = rows[rows.length - 1].y;
  let end = last;
  ys.filter(y => y >= last).forEach(y => { if (y - end < 20) end = y; });
  bounds.push(end + 1);

  const rowIndexOf = y => {
    for (let r = 0; r < rows.length; r++) if (y >= bounds[r] && y < bounds[r + 1]) return r;
    return -1;
  };

  const days = mealPlanEmptyDays();
  const labels = { menu1: '', menu2: '', menu3: '', dessert: '' };
  rows.forEach((row, r) => {
    if (!(row.key in labels)) return;
    // Untertitel wie "Pasta Station" / "Vegetarisch / Vegan"
    labels[row.key] = labelItems
      .filter(i => rowIndexOf(i.y) === r && !mealPlanRowKey(i.str))
      .sort((a, b) => a.y - b.y).map(i => i.str.trim()).join(' ').replace(/\s*\/\s*/g, ' / ').trim();

    heads.forEach((h, c) => {
      const dayIdx = MEALPLAN_WEEKDAYS.findIndex(d => d.toUpperCase() === h.day);
      if (dayIdx < 0) return;
      const cell = content.filter(i => colOf(i.x + i.w / 2) === c && rowIndexOf(i.y) === r);
      const lineMap = new Map();
      cell.sort((a, b) => a.y - b.y || a.x - b.x).forEach(i => {
        const k = [...lineMap.keys()].find(y => Math.abs(y - i.y) <= 2);
        const key = k == null ? i.y : k;
        lineMap.set(key, ((lineMap.get(key) || '') + ' ' + i.str).trim());
      });
      const lines = [...lineMap.entries()].sort((a, b) => a[0] - b[0]).map(([y, text]) => ({ y, text }));
      days[dayIdx][row.key] = mealPlanCellText(lines);
    });
  });

  return { found: true, days, labels, headerText: items.filter(i => i.y <= headerY + 40 && colOf(i.x + i.w / 2) === -1).map(i => i.str).join(' ') };
}

// Montag der Woche aus "12. - 16. Oktober 2026" / "28. September - 2. Oktober 2026"
// bzw. ersatzweise aus der KW-Nummer
function mealPlanDetectMonday(text) {
  const t = text.replace(/\s+/g, ' ');
  const m = t.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)?\s*[-–]\s*(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s*(\d{4})/);
  if (m) {
    const endMonth = MEALPLAN_MONTHS.indexOf(m[4].toLowerCase());
    const startMonth = m[2] ? MEALPLAN_MONTHS.indexOf(m[2].toLowerCase()) : endMonth;
    if (endMonth >= 0 && startMonth >= 0) {
      let year = Number(m[5]);
      if (startMonth > endMonth) year -= 1;
      return getWeekStart(new Date(year, startMonth, Number(m[1])));
    }
  }
  const kw = t.match(/(\d{1,2})\s*KW|KW\s*(\d{1,2})/i);
  if (kw) {
    const n = Number(kw[1] || kw[2]);
    // KW im Umfeld von heute suchen (±30 Wochen)
    const base = getWeekStart(new Date());
    for (let off = 0; off <= 30; off++) {
      for (const sign of [1, -1]) {
        const d = new Date(base); d.setDate(d.getDate() + sign * off * 7);
        if (getISOWeek(d) === n) return d;
      }
    }
  }
  return null;
}

async function mealPlanParsePdf(file) {
  const pdfjsLib = await mealPlanLoadPdfjs();
  const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({
      str: i.str, x: i.transform[4], y: vp.height - i.transform[5], w: i.width,
    }));
    const res = mealPlanParsePage(items);
    if (res.found) {
      res.monday = mealPlanDetectMonday(res.headerText);
      return res;
    }
  }
  throw new Error('Im PDF wurde keine Speiseplan-Tabelle (MONTAG … FREITAG, MENÜ 1 …) gefunden.');
}

// =========================
// WIDGET (rechte Today-Sidebar, unter der Schnellnotiz)
// =========================
let mealPlanViewDate = null; // angezeigter Tag, null = automatisch

function mealPlanDefaultDate() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  // Wochenende → nächster Montag
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

function mealPlanShiftDay(date, dir) {
  const d = new Date(date);
  do { d.setDate(d.getDate() + dir); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

function mealPlanDayLabel(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date - today) / MS_PER_DAY);
  const short = fmt(date, { weekday: 'short', day: '2-digit', month: '2-digit' });
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return short;
}

function mealPlanDishHtml(text, hits = []) {
  if (!text) return '<span class="mealplan-dish-empty">—</span>';
  const shown = mealPlanSplitDish(text).text;
  const vegan = /^VEGAN\b/i.test(shown);
  const clean = vegan ? shown.replace(/^VEGAN\s*/i, '') : shown;
  const alertTags = hits.map(h => `<span class="mealplan-alert-tag" title="${escHtml('Enthält: ' + h.reasons.join(', '))}">${escHtml(h.alert.name)}</span>`).join('');
  return `${vegan ? '<span class="mealplan-tag">vegan</span>' : ''}${escHtml(clean)}${alertTags ? `<div class="mealplan-alert-tags">${alertTags}</div>` : ''}`;
}

// Hinweis-Kasten über den Gerichten: je ausgelöstem Hinweis eine Zeile
// ("Lactostop mitnehmen — Laktose in Menü 1 und Dessert")
function mealPlanAlertBannerHtml(day) {
  const byAlert = new Map();
  MEALPLAN_SLOTS.forEach(s => {
    mealPlanAlertHits(day[s.key]).forEach(h => {
      if (!byAlert.has(h.alert.id)) byAlert.set(h.alert.id, { alert: h.alert, slots: [] });
      byAlert.get(h.alert.id).slots.push(s.label);
    });
  });
  if (!byAlert.size) return '';
  const joinDe = arr => arr.length < 2 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' und ' + arr[arr.length - 1];
  const rows = [...byAlert.values()].map(({ alert, slots }) => {
    const where = `${escHtml(alert.name)} in ${escHtml(joinDe(slots))}`;
    return `<div class="mealplan-alert-row">${alert.reminder
      ? `<strong>${escHtml(alert.reminder)}</strong><span class="mealplan-alert-where">${where}</span>`
      : `<strong>Achtung:</strong><span class="mealplan-alert-where">${where}</span>`}</div>`;
  }).join('');
  return `<div class="mealplan-alert" role="note">
    <svg class="mealplan-alert-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.8l6.4 11.4H1.6L8 1.8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.3v3.2M8 11.4v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    <div class="mealplan-alert-rows">${rows}</div>
  </div>`;
}

const MEALPLAN_DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

// Ein Gericht als Listeneintrag; Lieblingsgerichte tragen einen Stern.
// Der Stern-Knopf merkt ein neues Stichwort (☆) bzw. öffnet die Liste (★).
function mealPlanItemHtml(slot, text, weekLabels) {
  const hits = text ? NookMealFav.hitsFor(text, mealPlanFavorites) : [];
  const fav = hits.length > 0;
  const favTitle = fav
    ? `Lieblingsgericht (${hits.map(NookMealFav.label).join(', ')})`
    : 'Als Lieblingsgericht merken';
  return `
    <li class="mealplan-item${fav ? ' is-fav' : ''}">
      <div class="mealplan-slot">${slot.label}${weekLabels && weekLabels[slot.key] ? `<span class="mealplan-slot-sub">${escHtml(weekLabels[slot.key])}</span>` : ''}</div>
      <div class="mealplan-dish-row">
        <div class="mealplan-dish">${mealPlanDishHtml(text, mealPlanAlertHits(text))}</div>
        ${text ? `<button type="button" class="mealplan-fav-btn${fav ? ' is-on' : ''}" data-fav-slot="${slot.key}" title="${escHtml(favTitle)}" aria-label="${escHtml(favTitle)}">${fav ? '★' : '☆'}</button>` : ''}
      </div>
    </li>`;
}

// „★ Diese Woche: Bolognese heute, Do“ — nur Tage ab heute, ✕ blendet ihn für die Woche aus
function mealPlanFavHintHtml() {
  if (!mealPlanFavorites.length) return '';
  const today = mealPlanDefaultDate();
  const { week, dayIndex } = mealPlanLookup(today);
  const mondayKey = dateKey(getWeekStart(today));
  if (!week || mealPlanFavHintHidden === mondayKey) return '';
  const isToday = dateKey(today) === dateKey(new Date());
  const hits = NookMealFav.weekHits(week, mealPlanFavorites, MEALPLAN_SLOTS.map(s => s.key), dayIndex)
    .filter(h => h.dishes.length);
  if (!hits.length) return '';
  const parts = hits.map(h => {
    const days = [...new Set(h.dishes.map(d => d.dayIndex))];
    const dayBtns = days.map(d => `<button type="button" class="mealplan-fav-day" data-fav-goto="${d}" title="${escHtml(MEALPLAN_WEEKDAYS[d])} anzeigen">${d === dayIndex && isToday ? 'heute' : MEALPLAN_DAY_SHORT[d]}</button>`).join(', ');
    return `<span class="mealplan-fav-hint-part"><b>${escHtml(NookMealFav.label(h.fav))}</b> ${dayBtns}</span>`;
  });
  return `
    <div class="mealplan-fav-hint" role="note">
      <span class="mealplan-fav-hint-star" aria-hidden="true">★</span>
      <span class="mealplan-fav-hint-text">Diese Woche: ${parts.join('<span class="mealplan-fav-hint-sep"> · </span>')}</span>
      <button type="button" class="mealplan-fav-hint-x" id="mealplan-fav-hint-x" title="Für diese Woche ausblenden" aria-label="Hinweis für diese Woche ausblenden">&#10005;</button>
    </div>`;
}

function renderMealPlan() {
  const sidebar = document.getElementById('today-right');
  if (!sidebar) return;
  let widget = document.getElementById('mealplan-widget');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'mealplan-widget';
    widget.className = 'panel mealplan-widget';
    const note = document.getElementById('panel-quicknote');
    if (note && note.parentNode === sidebar) note.insertAdjacentElement('afterend', widget);
    else sidebar.appendChild(widget);
    mealPlanWireDrop(widget);
  }

  const date = mealPlanViewDate || mealPlanDefaultDate();
  const { week, dayIndex } = mealPlanLookup(date);
  const day = week ? week.days[dayIndex] : null;
  const hasDay = day && MEALPLAN_SLOTS.some(s => day[s.key]);

  const bodyHtml = hasDay
    ? `${mealPlanAlertBannerHtml(day)}<ul class="mealplan-list">${MEALPLAN_SLOTS.map(s => mealPlanItemHtml(s, day[s.key], week.labels)).join('')}</ul>`
    : `<div class="mealplan-empty">
        <div>${week ? 'Für diesen Tag ist nichts eingetragen.' : `Noch kein Speiseplan für KW ${getISOWeek(date)}.`}</div>
        <button type="button" class="btn-ghost mealplan-import-btn" data-mealplan-import>PDF importieren</button>
        <div class="mealplan-hint">oder das PDF hierher ziehen</div>
      </div>`;

  widget.innerHTML = `
    <div class="panel-header">
      <span class="panel-label">Speiseplan</span>
      <div class="mealplan-head-actions">
        <button type="button" class="week-btn" id="mealplan-prev" aria-label="Vorheriger Tag">&#8249;</button>
        <span class="mealplan-day-label" id="mealplan-day-label" title="${escHtml(fmt(date, { weekday: 'long', day: 'numeric', month: 'long' }))}">${escHtml(mealPlanDayLabel(date))}</span>
        <button type="button" class="week-btn" id="mealplan-next" aria-label="Nächster Tag">&#8250;</button>
        <button type="button" class="icon-btn mealplan-fav-open" id="mealplan-fav-open" title="Lieblingsgerichte" aria-label="Lieblingsgerichte">★</button>
        <button type="button" class="icon-btn" data-mealplan-import title="Speiseplan-PDF importieren" aria-label="Speiseplan-PDF importieren">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="icon-btn${mealPlanAlerts.length ? ' mealplan-alerts-on' : ''}" id="mealplan-alerts-btn" title="Allergiehinweise" aria-label="Allergiehinweise">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1.8l6.4 11.4H1.6L8 1.8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 6.3v3.2M8 11.4v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>
        ${week ? `<button type="button" class="icon-btn" id="mealplan-edit" title="Woche bearbeiten" aria-label="Woche bearbeiten">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2.3l2.4 2.4-8.1 8.1-3.1.7.7-3.1 8.1-8.1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/></svg>
        </button>` : ''}
      </div>
    </div>
    ${mealPlanFavHintHtml()}
    <div class="mealplan-body">${bodyHtml}</div>
    <input type="file" id="mealplan-file" accept="application/pdf,.pdf" hidden />`;

  widget.querySelector('#mealplan-fav-open').addEventListener('click', () => mealPlanOpenFavorites());
  widget.querySelectorAll('[data-fav-slot]').forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('is-on')) mealPlanOpenFavorites();
    else mealPlanOpenFavorites(NookMealFav.suggest(day && mealPlanSplitDish(day[b.dataset.favSlot] || '').text));
  }));
  widget.querySelectorAll('[data-fav-goto]').forEach(b => b.addEventListener('click', () => {
    const d = new Date(getWeekStart(mealPlanDefaultDate()));
    d.setDate(d.getDate() + Number(b.dataset.favGoto));
    mealPlanViewDate = d;
    renderMealPlan();
  }));
  widget.querySelector('#mealplan-fav-hint-x')?.addEventListener('click', () => {
    mealPlanFavHintHidden = dateKey(getWeekStart(mealPlanDefaultDate()));
    DB.set('mealPlanFavHintHidden', mealPlanFavHintHidden);
    renderMealPlan();
  });

  widget.querySelector('#mealplan-prev').addEventListener('click', () => { mealPlanViewDate = mealPlanShiftDay(date, -1); renderMealPlan(); });
  widget.querySelector('#mealplan-next').addEventListener('click', () => { mealPlanViewDate = mealPlanShiftDay(date, 1); renderMealPlan(); });
  widget.querySelector('#mealplan-day-label').addEventListener('click', () => { mealPlanViewDate = null; renderMealPlan(); });
  const fileInput = widget.querySelector('#mealplan-file');
  widget.querySelectorAll('[data-mealplan-import]').forEach(b => b.addEventListener('click', () => fileInput.click()));
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) mealPlanImport(fileInput.files[0]); });
  widget.querySelector('#mealplan-edit')?.addEventListener('click', () => mealPlanOpenEditor(getWeekStart(date), week, '', 'Speiseplan bearbeiten'));
  widget.querySelector('#mealplan-alerts-btn').addEventListener('click', mealPlanOpenAlerts);
}

function mealPlanWireDrop(widget) {
  widget.addEventListener('dragover', e => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    e.preventDefault();
    widget.classList.add('mealplan-drop');
  });
  widget.addEventListener('dragleave', e => { if (!widget.contains(e.relatedTarget)) widget.classList.remove('mealplan-drop'); });
  widget.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    widget.classList.remove('mealplan-drop');
    if (!file) return;
    e.preventDefault();
    mealPlanImport(file);
  });
}

async function mealPlanImport(file) {
  const widget = document.getElementById('mealplan-widget');
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    mealPlanOpenEditor(null, null, 'Das ist keine PDF-Datei.');
    return;
  }
  widget?.classList.add('mealplan-loading');
  try {
    const res = await mealPlanParsePdf(file);
    const filled = res.days.some(d => MEALPLAN_SLOTS.some(s => d[s.key]));
    mealPlanOpenEditor(res.monday, { days: res.days, labels: res.labels },
      filled ? '' : 'Die Tabelle wurde gefunden, aber keine Gerichte erkannt — bitte von Hand ergänzen.');
  } catch (err) {
    const offline = /Script konnte nicht geladen/.test(err.message);
    mealPlanOpenEditor(null, null, offline
      ? 'Der PDF-Leser konnte nicht geladen werden. Du kannst die Gerichte hier von Hand eintragen.'
      : err.message);
  } finally {
    widget?.classList.remove('mealplan-loading');
  }
}

// =========================
// EDITOR-MODAL — Kontrolle nach dem Import / Woche bearbeiten
// =========================
const mealPlanModal = wireModal('mealplan-modal-overlay', { closeIds: ['mealplan-modal-close', 'mealplan-modal-cancel'] });
let mealPlanEditorLabels = null;

function mealPlanOpenEditor(monday, data, message = '', title = 'Speiseplan prüfen') {
  const start = monday || getWeekStart(mealPlanViewDate || mealPlanDefaultDate());
  const days = data ? data.days : mealPlanEmptyDays();
  mealPlanEditorLabels = data && data.labels ? data.labels : { menu1: '', menu2: '', menu3: '', dessert: '' };

  document.getElementById('mealplan-modal-week').value = dateKey(start);
  mealPlanUpdateWeekHint();
  const msg = document.getElementById('mealplan-modal-message');
  msg.textContent = message;
  msg.classList.toggle('hidden', !message);
  document.getElementById('mealplan-modal-title').textContent = title;

  document.getElementById('mealplan-modal-days').innerHTML = MEALPLAN_WEEKDAYS.map((name, d) => `
    <div class="mealplan-edit-day">
      <div class="mealplan-edit-day-name">${name}</div>
      ${MEALPLAN_SLOTS.map(s => `
        <label class="mealplan-edit-row">
          <span>${s.label}</span>
          <textarea class="modal-textarea mealplan-edit-input" rows="2" data-day="${d}" data-slot="${s.key}">${escHtml(days[d][s.key] || '')}</textarea>
        </label>`).join('')}
    </div>`).join('');
  mealPlanModal.open();
}

function mealPlanUpdateWeekHint() {
  const val = document.getElementById('mealplan-modal-week').value;
  const hint = document.getElementById('mealplan-modal-week-hint');
  if (!val) { hint.textContent = ''; return; }
  const mon = getWeekStart(parseLocalDate(val));
  const fri = new Date(mon); fri.setDate(fri.getDate() + 4);
  const old = Object.keys(mealPlanWeeks).find(k => k !== dateKey(mon));
  hint.textContent = `KW ${getISOWeek(mon)} · ${fmt(mon, { day: '2-digit', month: '2-digit' })} – ${fmt(fri, { day: '2-digit', month: '2-digit', year: 'numeric' })}${old ? ` · ersetzt KW ${getISOWeek(parseLocalDate(old))}` : ''}`;
}
document.getElementById('mealplan-modal-week')?.addEventListener('change', mealPlanUpdateWeekHint);

document.getElementById('mealplan-modal-save')?.addEventListener('click', () => {
  const val = document.getElementById('mealplan-modal-week').value;
  if (!val) return;
  const monday = getWeekStart(parseLocalDate(val));
  const days = mealPlanEmptyDays();
  document.querySelectorAll('#mealplan-modal-days .mealplan-edit-input').forEach(el => {
    days[Number(el.dataset.day)][el.dataset.slot] = el.value.replace(/\s+/g, ' ').trim();
  });
  mealPlanWeeks = {};
  mealPlanWeeks[dateKey(monday)] = {
    kw: getISOWeek(monday),
    importedAt: new Date().toISOString(),
    labels: mealPlanEditorLabels || { menu1: '', menu2: '', menu3: '', dessert: '' },
    days,
  };
  saveMealPlanWeeks();
  mealPlanModal.close();
  mealPlanViewDate = null;
  renderMealPlan();
});

document.getElementById('mealplan-modal-delete')?.addEventListener('click', async () => {
  const val = document.getElementById('mealplan-modal-week').value;
  if (!val) return;
  const key = dateKey(getWeekStart(parseLocalDate(val)));
  if (!mealPlanWeeks[key]) { mealPlanModal.close(); return; }
  const ok = await hubConfirm({
    title: 'Woche entfernen?',
    message: `Der Speiseplan für KW ${getISOWeek(parseLocalDate(key))} wird gelöscht.`,
    confirmText: 'Entfernen',
    danger: true,
  });
  if (!ok) return;
  delete mealPlanWeeks[key];
  saveMealPlanWeeks();
  mealPlanModal.close();
  renderMealPlan();
});

// =========================
// LIEBLINGSGERICHTE — Dialog (Stichwörter eintragen, mit Vorschau der Woche)
// =========================
const mealPlanFavModal = wireModal('mealplan-fav-overlay', { closeIds: ['mealplan-fav-close', 'mealplan-fav-done'] });

// Woche für die Vorschau: die angezeigte, sonst die gespeicherte
function mealPlanFavPreviewWeek() {
  return mealPlanLookup(mealPlanViewDate || mealPlanDefaultDate()).week || Object.values(mealPlanWeeks)[0] || null;
}

function mealPlanFavPreviewHtml(fav) {
  if (!NookMealFav.parse(fav).word) return '';
  const week = mealPlanFavPreviewWeek();
  if (!week) return '<span class="mealplan-fav-none">Noch kein Speiseplan da – der Stern erscheint, sobald ein passendes Gericht dabei ist.</span>';
  const [hit] = NookMealFav.weekHits(week, [fav], MEALPLAN_SLOTS.map(s => s.key));
  if (!hit.dishes.length) return `<span class="mealplan-fav-none">In KW ${escHtml(String(week.kw || ''))} nicht dabei.</span>`;
  return hit.dishes.map(d => `<span class="mealplan-fav-match"><b>${MEALPLAN_DAY_SHORT[d.dayIndex]}</b> ${escHtml(NookMealFav.suggest(mealPlanSplitDish(d.text).text))}</span>`).join('');
}

function mealPlanRenderFavList() {
  const list = document.getElementById('mealplan-fav-list');
  if (!list) return;
  list.innerHTML = mealPlanFavorites.length
    ? mealPlanFavorites.map((f, i) => `
        <div class="mealplan-fav-row">
          <div class="mealplan-fav-row-head">
            <span class="mealplan-fav-row-star" aria-hidden="true">★</span>
            <input type="text" class="modal-input mealplan-fav-name" data-fav-i="${i}" value="${escHtml(f)}" maxlength="${NookMealFav.MAX_LEN}" aria-label="Stichwort bearbeiten" />
            <button type="button" class="icon-btn mealplan-fav-remove" data-fav-remove="${i}" title="Entfernen" aria-label="${escHtml(NookMealFav.label(f))} entfernen">&#10005;</button>
          </div>
          <div class="mealplan-fav-preview">${mealPlanFavPreviewHtml(f)}</div>
        </div>`).join('')
    : '<div class="mealplan-fav-empty">Noch keine Lieblingsgerichte.</div>';

  list.querySelectorAll('[data-fav-i]').forEach(el => {
    const i = Number(el.dataset.favI);
    el.addEventListener('input', () => {
      el.closest('.mealplan-fav-row').querySelector('.mealplan-fav-preview').innerHTML = mealPlanFavPreviewHtml(el.value);
    });
    el.addEventListener('change', () => {
      mealPlanFavorites = NookMealFav.rename(mealPlanFavorites, i, el.value);
      saveMealPlanFavorites();
      mealPlanRenderFavList();
      renderMealPlan();
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
  });
  list.querySelectorAll('[data-fav-remove]').forEach(b => b.addEventListener('click', () => {
    const before = mealPlanFavorites.slice();
    const removed = mealPlanFavorites[Number(b.dataset.favRemove)];
    mealPlanFavorites = mealPlanFavorites.filter((_, j) => j !== Number(b.dataset.favRemove));
    saveMealPlanFavorites();
    mealPlanRenderFavList();
    renderMealPlan();
    hubUndo(`„${NookMealFav.label(removed)}“ entfernt`, () => {
      mealPlanFavorites = before;
      saveMealPlanFavorites();
      mealPlanRenderFavList();
      renderMealPlan();
    });
  }));
}

function mealPlanUpdateFavInputPreview() {
  const input = document.getElementById('mealplan-fav-input');
  const box = document.getElementById('mealplan-fav-input-preview');
  if (!input || !box) return;
  const html = mealPlanFavPreviewHtml(input.value);
  box.innerHTML = html;
  box.classList.toggle('hidden', !html);
}

function mealPlanOpenFavorites(prefill = '') {
  const input = document.getElementById('mealplan-fav-input');
  if (!input) return;
  input.value = prefill;
  mealPlanRenderFavList();
  mealPlanUpdateFavInputPreview();
  mealPlanFavModal.open();
  input.focus();
  if (prefill) input.select();
}

function mealPlanAddFavorite() {
  const input = document.getElementById('mealplan-fav-input');
  const next = NookMealFav.add(mealPlanFavorites, input.value);
  if (next.length !== mealPlanFavorites.length) {
    mealPlanFavorites = next;
    saveMealPlanFavorites();
    renderMealPlan();
  }
  input.value = '';
  mealPlanUpdateFavInputPreview();
  mealPlanRenderFavList();
  input.focus();
}

document.getElementById('mealplan-fav-input')?.addEventListener('input', mealPlanUpdateFavInputPreview);
document.getElementById('mealplan-fav-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); mealPlanAddFavorite(); }
});
document.getElementById('mealplan-fav-add')?.addEventListener('click', mealPlanAddFavorite);

// =========================
// ALLERGIEHINWEISE-MODAL — Hinweise anlegen/bearbeiten (Entwurf, erst
// "Speichern" schreibt nach mealPlanAlerts)
// =========================
const mealPlanAlertsModal = wireModal('mealplan-alerts-overlay', { closeIds: ['mealplan-alerts-close', 'mealplan-alerts-cancel'] });
let mealPlanAlertsDraft = [];

function mealPlanNewAlertId() { return `mpa_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

function mealPlanOpenAlerts() {
  mealPlanAlertsDraft = mealPlanAlerts.map(a => ({ ...a, codes: [...(a.codes || [])], keywords: [...(a.keywords || [])], except: [...(a.except || [])] }));
  mealPlanRenderAlertsDraft();
  mealPlanAlertsModal.open();
}

// Liste "a, b ,c" → ['a','b','c'] (klein, ohne Leere/Doppelte)
function mealPlanParseWordList(value) {
  return [...new Set(value.split(/[,;\n]/).map(w => w.trim().toLowerCase()).filter(Boolean))];
}

function mealPlanRenderAlertsDraft() {
  const list = document.getElementById('mealplan-alerts-list');
  list.innerHTML = mealPlanAlertsDraft.length
    ? mealPlanAlertsDraft.map((a, i) => `
      <div class="mealplan-alert-edit" data-idx="${i}">
        <div class="mealplan-alert-edit-head">
          <input type="text" class="modal-input" data-field="name" value="${escHtml(a.name)}" placeholder="Name, z.B. Laktose" aria-label="Name" />
          <button type="button" class="icon-btn" data-alert-remove title="Hinweis löschen" aria-label="Hinweis löschen">&#10005;</button>
        </div>
        <label class="mealplan-edit-row"><span>Erinnerung</span>
          <input type="text" class="modal-input" data-field="reminder" value="${escHtml(a.reminder || '')}" placeholder="z.B. Lactostop mitnehmen (optional)" /></label>
        <div class="mealplan-edit-row"><span>Kürzel</span>
          <div class="mealplan-code-chips">${MEALPLAN_ALLERGENS.map(al => `
            <button type="button" class="mealplan-code-chip${a.codes.includes(al.code) ? ' active' : ''}" data-code="${al.code}" title="${escHtml(al.label)}" aria-pressed="${a.codes.includes(al.code)}">${al.code}</button>`).join('')}
          </div></div>
        <label class="mealplan-edit-row"><span>Stichwörter</span>
          <textarea class="modal-textarea mealplan-edit-input" rows="2" data-field="keywords" placeholder="sahne, käse, butter …">${escHtml(a.keywords.join(', '))}</textarea></label>
        <label class="mealplan-edit-row"><span>Ausnahmen</span>
          <input type="text" class="modal-input" data-field="except" value="${escHtml(a.except.join(', '))}" placeholder="kokosmilch, hafermilch … (optional)" /></label>
      </div>`).join('')
    : '<div class="mealplan-alerts-empty">Noch keine Hinweise. Nimm eine Vorlage oder leg einen eigenen an.</div>';

  // Vorlagen, die noch nicht angelegt sind
  const used = new Set(mealPlanAlertsDraft.map(a => a.name.trim().toLowerCase()));
  document.getElementById('mealplan-alerts-presets').innerHTML = MEALPLAN_ALERT_PRESETS
    .map((p, i) => used.has(p.name.toLowerCase()) ? '' : `<button type="button" class="btn-ghost mealplan-preset-btn" data-preset="${i}">+ ${escHtml(p.name)}</button>`)
    .join('') + '<button type="button" class="btn-ghost mealplan-preset-btn" data-preset="custom">+ Eigener Hinweis</button>';
}

// Eingaben der Felder in den Entwurf übernehmen (vor jedem Neuzeichnen)
function mealPlanSyncAlertsDraft() {
  document.querySelectorAll('#mealplan-alerts-list .mealplan-alert-edit').forEach(row => {
    const a = mealPlanAlertsDraft[Number(row.dataset.idx)];
    if (!a) return;
    a.name = row.querySelector('[data-field="name"]').value.trim();
    a.reminder = row.querySelector('[data-field="reminder"]').value.trim();
    a.keywords = mealPlanParseWordList(row.querySelector('[data-field="keywords"]').value);
    a.except = mealPlanParseWordList(row.querySelector('[data-field="except"]').value);
  });
}

document.getElementById('mealplan-alerts-list')?.addEventListener('click', e => {
  const row = e.target.closest('.mealplan-alert-edit');
  if (!row) return;
  const a = mealPlanAlertsDraft[Number(row.dataset.idx)];
  const chip = e.target.closest('[data-code]');
  if (chip) {
    const c = chip.dataset.code;
    a.codes = a.codes.includes(c) ? a.codes.filter(x => x !== c) : [...a.codes, c].sort();
    chip.classList.toggle('active', a.codes.includes(c));
    chip.setAttribute('aria-pressed', a.codes.includes(c));
    return;
  }
  if (e.target.closest('[data-alert-remove]')) {
    mealPlanSyncAlertsDraft();
    mealPlanAlertsDraft.splice(Number(row.dataset.idx), 1);
    mealPlanRenderAlertsDraft();
  }
});

document.getElementById('mealplan-alerts-presets')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-preset]');
  if (!btn) return;
  mealPlanSyncAlertsDraft();
  const p = btn.dataset.preset === 'custom'
    ? { name: '', reminder: '', codes: [], keywords: [], except: [] }
    : MEALPLAN_ALERT_PRESETS[Number(btn.dataset.preset)];
  mealPlanAlertsDraft.push({ id: mealPlanNewAlertId(), name: p.name, reminder: p.reminder, codes: [...p.codes], keywords: [...p.keywords], except: [...p.except] });
  mealPlanRenderAlertsDraft();
  if (btn.dataset.preset === 'custom') {
    const rows = document.querySelectorAll('#mealplan-alerts-list [data-field="name"]');
    rows[rows.length - 1]?.focus();
  }
});

document.getElementById('mealplan-alerts-save')?.addEventListener('click', () => {
  mealPlanSyncAlertsDraft();
  // Hinweise ohne Namen bekommen einen aus den Kürzeln; ganz leere fallen weg
  mealPlanAlerts = mealPlanAlertsDraft
    .filter(a => a.codes.length || a.keywords.length)
    .map(a => ({ ...a, name: a.name || (a.codes.length ? 'Allergen ' + a.codes.join(', ') : a.keywords[0]) }));
  saveMealPlanAlerts();
  mealPlanAlertsModal.close();
  renderMealPlan();
});

renderMealPlan();
