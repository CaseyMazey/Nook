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
// PDF-Auslesen: pdf.js (cdnjs, feste Version) wird erst beim ersten Import
// per <script>-Tag nachgeladen — kein fetch(), funktioniert auch unter
// file://. Der Worker wird ebenfalls als normales Script geladen
// (globalThis.pdfjsWorker), pdf.js rechnet dann im Hauptthread — ein
// echter Web-Worker von fremder Herkunft wäre unter file:// und auf der
// gehosteten Seite ohnehin blockiert. Ohne Internet schlägt nur der
// Import fehl; das Modal öffnet dann leer zum Eintragen von Hand.
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
// =========================
let mealPlanWeeks = DB.get('mealPlanWeeks', {});
function saveMealPlanWeeks() { DB.set('mealPlanWeeks', mealPlanWeeks); }

const MEALPLAN_SLOTS = [
  { key: 'menu1',   label: 'Menü 1' },
  { key: 'menu2',   label: 'Menü 2' },
  { key: 'menu3',   label: 'Menü 3' },
  { key: 'dessert', label: 'Dessert' },
];
const MEALPLAN_WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/`;

function mealPlanEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

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
// PDF.JS — lazy per <script>-Tag
// =========================
let mealPlanPdfjsPromise = null;
function mealPlanLoadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Script konnte nicht geladen werden: ' + src));
    document.head.appendChild(s);
  });
}
function mealPlanLoadPdfjs() {
  if (window.pdfjsLib && window.pdfjsWorker) return Promise.resolve(window.pdfjsLib);
  if (!mealPlanPdfjsPromise) {
    mealPlanPdfjsPromise = mealPlanLoadScript(PDFJS_BASE + 'pdf.min.js')
      .then(() => mealPlanLoadScript(PDFJS_BASE + 'pdf.worker.min.js'))
      .then(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
        return window.pdfjsLib;
      })
      .catch(err => { mealPlanPdfjsPromise = null; throw err; });
  }
  return mealPlanPdfjsPromise;
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

// Allergen-/Zusatzstoff-Kürzel wie (A,D,G) oder (G,L,1) entfernen,
// Leerzeichen/Schrägstriche glätten
function mealPlanCleanText(text) {
  return text
    .replace(/\s*\(\s*(?:[A-Z]|\d{1,2})(?:\s*,\s*(?:[A-Z]|\d{1,2}))*\s*\)/g, '')
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
  const texts = variants.map(v => v.reduce((acc, line) => {
    if (!acc) return line;
    return /-$/.test(acc) ? acc + line : acc + ' ' + line;
  }, '')).map(mealPlanCleanText).filter(Boolean);
  if (texts.length < 2) return texts[0] || '';

  const plain = t => t.replace(/^VEGAN\s*/, '');
  if (texts.every(t => plain(t) === plain(texts[0]))) {
    const anyPlain = texts.some(t => !/^VEGAN\b/.test(t));
    return anyPlain ? plain(texts[0]) + ' (auch vegan)' : texts[0];
  }
  return texts.join(' · oder: ');
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

function mealPlanDishHtml(text) {
  if (!text) return '<span class="mealplan-dish-empty">—</span>';
  const vegan = /^VEGAN\b/i.test(text);
  const clean = vegan ? text.replace(/^VEGAN\s*/i, '') : text;
  return `${vegan ? '<span class="mealplan-tag">vegan</span>' : ''}${mealPlanEsc(clean)}`;
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
    ? `<ul class="mealplan-list">${MEALPLAN_SLOTS.map(s => `
        <li class="mealplan-item">
          <div class="mealplan-slot">${s.label}${week.labels && week.labels[s.key] ? `<span class="mealplan-slot-sub">${mealPlanEsc(week.labels[s.key])}</span>` : ''}</div>
          <div class="mealplan-dish">${mealPlanDishHtml(day[s.key])}</div>
        </li>`).join('')}</ul>`
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
        <span class="mealplan-day-label" id="mealplan-day-label" title="${mealPlanEsc(fmt(date, { weekday: 'long', day: 'numeric', month: 'long' }))}">${mealPlanEsc(mealPlanDayLabel(date))}</span>
        <button type="button" class="week-btn" id="mealplan-next" aria-label="Nächster Tag">&#8250;</button>
        <button type="button" class="icon-btn" data-mealplan-import title="Speiseplan-PDF importieren" aria-label="Speiseplan-PDF importieren">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        ${week ? `<button type="button" class="icon-btn" id="mealplan-edit" title="Woche bearbeiten" aria-label="Woche bearbeiten">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 2.3l2.4 2.4-8.1 8.1-3.1.7.7-3.1 8.1-8.1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/></svg>
        </button>` : ''}
      </div>
    </div>
    <div class="mealplan-body">${bodyHtml}</div>
    <input type="file" id="mealplan-file" accept="application/pdf,.pdf" hidden />`;

  widget.querySelector('#mealplan-prev').addEventListener('click', () => { mealPlanViewDate = mealPlanShiftDay(date, -1); renderMealPlan(); });
  widget.querySelector('#mealplan-next').addEventListener('click', () => { mealPlanViewDate = mealPlanShiftDay(date, 1); renderMealPlan(); });
  widget.querySelector('#mealplan-day-label').addEventListener('click', () => { mealPlanViewDate = null; renderMealPlan(); });
  const fileInput = widget.querySelector('#mealplan-file');
  widget.querySelectorAll('[data-mealplan-import]').forEach(b => b.addEventListener('click', () => fileInput.click()));
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) mealPlanImport(fileInput.files[0]); });
  widget.querySelector('#mealplan-edit')?.addEventListener('click', () => mealPlanOpenEditor(getWeekStart(date), week, '', 'Speiseplan bearbeiten'));
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
      ? 'Der PDF-Leser konnte nicht geladen werden (keine Internetverbindung?). Du kannst die Gerichte hier von Hand eintragen.'
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
          <textarea class="modal-textarea mealplan-edit-input" rows="2" data-day="${d}" data-slot="${s.key}">${mealPlanEsc(days[d][s.key] || '')}</textarea>
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

renderMealPlan();
