// =========================
// TOOLS — 5) NOTENMANAGER
// Benötigt tools.js (initTools/HTML-Grundgerüst) zuvor geladen.
// =========================

// =========================================================
// 5) NOTENMANAGER
// Verwaltungssystem für Schul-/Ausbildungsnoten, unterhalb des
// Datenübertragungsraten-Rechners. Struktur: Ausbildungsjahre
// (Accordion, offener Zustand persistent) → Fächer (Karten) →
// Leistungen (Datum, Kategorie, Note, Gewichtung), plus Zeugnisse
// (Name, Note je Fach, optionaler Kommentar). Kategorien sind
// GLOBAL (Einstellungen → Notenmanager) — eine Kategorie samt
// Standardgewichtung gilt über alle Ausbildungsjahre hinweg; die
// Gewichtung wird beim Anlegen einer Leistung übernommen, bleibt
// pro Leistung aber frei überschreibbar. Alles wird flach in
// localStorage gehalten (DB), analog zu Budget/Projekte: separate
// Sammlungen statt eines verschachtelten Objekts.
// =========================================================

let notenYears       = DB.get('notenYears', []);        // [{id,name}]
let notenSubjects    = DB.get('notenSubjects', []);      // [{id,yearId,name}]
let notenCategories  = DB.get('notenCategories', []);    // [{id,name,weight}] — global
let notenEntries     = DB.get('notenEntries', []);       // [{id,subjectId,date,categoryId,grade,weight}]
let notenOpenYears   = DB.get('notenOpenYears', {});     // {yearId: bool}
let notenReportCards = DB.get('notenReportCards', []);   // [{id,yearId,name,comment,grades:{subjectId:grade}}]

const NOTEN_DEFAULT_CATEGORIES = [
  { name: 'Test',          weight: 1 },
  { name: 'Klassenarbeit', weight: 2 },
  { name: 'Mündlich',      weight: 1 },
  { name: 'Prüfung',       weight: 3 },
  { name: 'Projekt',       weight: 1 },
];

// Kontext-Variablen für die aktuell geöffneten Modals
let notenYearEditId      = null;
let notenSubjectYearId   = null;
let notenSubjectEditId   = null;
let notenEntrySubjectId  = null;
let notenEntryEditId     = null;
let notenDetailSubjectId = null;
let notenModals = {};      // wireModal-Handles, gesetzt in wireNotenEvents()
let notenReportYearId    = null;
let notenReportEditId    = null;
let notenCompareYearId   = null;
let notenYearModalReturnId = null; // gesetzt, wenn "+ Fach" aus dem Ausbildungsjahr-Modal heraus geöffnet wurde

function saveNotenYears()       { DB.set('notenYears', notenYears); }
function saveNotenSubjects()    { DB.set('notenSubjects', notenSubjects); }
function saveNotenCategories()  { DB.set('notenCategories', notenCategories); }
function saveNotenEntries()     { DB.set('notenEntries', notenEntries); }
function saveNotenOpenYears()   { DB.set('notenOpenYears', notenOpenYears); }
function saveNotenReportCards() { DB.set('notenReportCards', notenReportCards); }

// Einmalige Migration: bisherige Kategorien waren pro Ausbildungsjahr
// dupliziert (yearId-Feld). Gleichnamige werden zu einer globalen
// Kategorie zusammengeführt (erster Treffer gewinnt Gewichtung/ID),
// bestehende Leistungen zeigen danach auf die zusammengeführte ID.
// Läuft nur einmal; danach greift die reine Global-Struktur.
(function notenMigrateCategoriesToGlobal() {
  if (!DB.get('notenCategoriesGlobalMigrated', false)) {
    if (notenCategories.some(c => c.yearId)) {
      const seen = new Map();
      const idMap = {};
      const merged = [];
      notenCategories.forEach(c => {
        const key = (c.name || '').trim().toLowerCase();
        if (seen.has(key)) {
          idMap[c.id] = seen.get(key);
        } else {
          seen.set(key, c.id);
          merged.push({ id: c.id, name: c.name, weight: c.weight });
        }
      });
      notenCategories = merged;
      notenEntries.forEach(e => { if (idMap[e.categoryId]) e.categoryId = idMap[e.categoryId]; });
      saveNotenCategories();
      saveNotenEntries();
    }
    DB.set('notenCategoriesGlobalMigrated', true);
  }
  if (!notenCategories.length) {
    NOTEN_DEFAULT_CATEGORIES.forEach(c => notenCategories.push({ id: notenUid(), name: c.name, weight: c.weight }));
    saveNotenCategories();
  }
})();

function notenUid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

function notenFormatGrade(n) {
  return n.toFixed(2).replace('.', ',');
}

// Note auf den gültigen Bereich 1–6 begrenzen (deutsche Notenskala).
function notenClampGrade(n) {
  return Math.min(6, Math.max(1, n));
}

// Note aus Texteingabe: "2,3" / "2.3", Tendenzen "2-" (2,25) und "2+" (1,75),
// Zwischennoten "1-2" (1,5). Leer → null, Unlesbares → NaN.
function notenParseGrade(raw) {
  const t = String(raw).trim().replace(/\s+/g, '');
  if (t === '') return null;
  let m = t.match(/^([1-6])([+-])$/);
  if (m) return notenClampGrade(Number(m[1]) + (m[2] === '-' ? 0.25 : -0.25));
  m = t.match(/^([1-6])[-/]([1-6])$/);
  if (m && Math.abs(m[1] - m[2]) === 1) return (Number(m[1]) + Number(m[2])) / 2;
  const n = parseGermanNumber(t);
  return isNaN(n) ? NaN : notenClampGrade(n);
}

// Kompakte Notation für Fachnoten in den Zeugnis-Karten — ganze Noten
// ohne Nachkommastellen (z.B. "2" statt "2,00"), Kommazahlen gekürzt.
function notenFormatGradeShort(n) {
  return (Math.round(n * 100) / 100).toString().replace('.', ',');
}

// =========================
// HELPERS — Datenzugriff
// =========================

function notenYearSubjects(yearId)     { return notenSubjects.filter(s => s.yearId === yearId); }
function notenCategoryById(catId)      { return notenCategories.find(c => c.id === catId); }
function notenSubjectEntries(subjectId) {
  return notenEntries.filter(e => e.subjectId === subjectId)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

// Fachschnitt: gewichteter Durchschnitt aller Leistungen mit Note.
// Ausstehende Leistungen (grade === null) fließen nicht ein.
function notenSubjectAverage(subjectId) {
  const graded = notenEntries.filter(e => e.subjectId === subjectId && e.grade !== null && e.grade !== undefined);
  if (!graded.length) return null;
  let sumWeighted = 0, sumWeight = 0;
  graded.forEach(e => {
    const w = (typeof e.weight === 'number' && e.weight > 0) ? e.weight : 1;
    sumWeighted += e.grade * w;
    sumWeight   += w;
  });
  return sumWeight > 0 ? sumWeighted / sumWeight : null;
}

// Gesamtschnitt: einfacher Durchschnitt der Fachschnitte (nur Fächer mit mind. einer Note).
function notenYearAverage(yearId) {
  const avgs = notenYearSubjects(yearId).map(s => notenSubjectAverage(s.id)).filter(a => a !== null);
  if (!avgs.length) return null;
  return avgs.reduce((a, b) => a + b, 0) / avgs.length;
}

// =========================
// INIT
// =========================

function initNotenmanager() {
  renderNotenYears();
  wireNotenEvents();
}

function wireNotenEvents() {
  // Modals: X / Abbrechen / Backdrop über wireModal (hub-utils.js)
  notenModals = {
    year:     wireModal('noten-year-modal-overlay',     { closeIds: ['noten-year-modal-close', 'noten-year-cancel'] }),
    settings: wireModal('noten-settings-modal-overlay', { closeIds: ['noten-settings-modal-close', 'noten-settings-close-btn'] }),
    subject:  wireModal('noten-subject-modal-overlay',  { closeIds: ['noten-subject-modal-close', 'noten-subject-cancel'], onClose: notenAfterSubjectModal }),
    report:   wireModal('noten-report-modal-overlay',   { closeIds: ['noten-report-modal-close', 'noten-report-cancel'] }),
    compare:  wireModal('noten-compare-modal-overlay',  { closeIds: ['noten-compare-modal-close', 'noten-compare-close-btn'] }),
    entry:    wireModal('noten-entry-modal-overlay',    { closeIds: ['noten-entry-modal-close', 'noten-entry-cancel'] }),
    detail:   wireModal('noten-subject-detail-overlay', { closeIds: ['noten-detail-close'], onClose: () => { notenDetailSubjectId = null; } }),
  };

  document.getElementById('noten-add-year-btn').addEventListener('click', () => openNotenYearModal(null));

  // ── Notenmanager-Einstellungen (Zahnrad) ──
  document.getElementById('noten-settings-btn').addEventListener('click', openNotenSettingsModal);
  document.getElementById('noten-settings-add-cat-btn').addEventListener('click', () => {
    notenCategories.push({ id: notenUid(), name: 'Neue Kategorie', weight: 1 });
    saveNotenCategories();
    renderNotenCategorySettings();
  });
  document.getElementById('noten-settings-category-rows').addEventListener('input', e => {
    const catId = e.target.dataset.catId;
    if (!catId) return;
    const cat = notenCategoryById(catId);
    if (!cat) return;
    if (e.target.classList.contains('noten-cat-name'))   cat.name = e.target.value;
    if (e.target.classList.contains('noten-cat-weight')) cat.weight = Math.max(0.5, parseFloat(e.target.value) || 1);
    saveNotenCategories();
  });
  document.getElementById('noten-settings-category-rows').addEventListener('click', async e => {
    const delBtn = e.target.closest('.noten-cat-delete');
    if (!delBtn) return;
    const cat = notenCategoryById(delBtn.dataset.catId);
    if (!cat) return;
    if (!(await hubConfirm({ title: 'Kategorie löschen?', message: `„${cat.name}“ wird entfernt. Bereits erfasste Leistungen behalten ihre Gewichtung.`, confirmText: 'Löschen', danger: true }))) return;
    notenCategories = notenCategories.filter(c => c.id !== cat.id);
    saveNotenCategories();
    renderNotenCategorySettings();
  });

  // ── Ausbildungsjahr-Modal: +Fach ──
  document.getElementById('noten-year-add-subject-btn').addEventListener('click', () => {
    if (!notenYearEditId) return;
    notenYearModalReturnId = notenYearEditId;
    closeNotenYearModal();
    openNotenSubjectModal(notenYearEditId, null);
  });

  // ── Jahres-Liste (Delegation: Toggle, Umbenennen, Löschen, + Fach, Kategorien, Fach öffnen) ──
  document.getElementById('noten-years-list').addEventListener('click', e => {
    const editBtn = e.target.closest('[data-noten-edit-year]');
    if (editBtn) { openNotenYearModal(editBtn.dataset.notenEditYear); return; }

    const delBtn = e.target.closest('[data-noten-delete-year]');
    if (delBtn) { confirmDeleteNotenYear(delBtn.dataset.notenDeleteYear); return; }

    const subjectCard = e.target.closest('[data-noten-open-subject]');
    if (subjectCard) { openNotenSubjectDetail(subjectCard.dataset.notenOpenSubject); return; }

    const addReportBtn = e.target.closest('[data-noten-add-report]');
    if (addReportBtn) { openNotenReportModal(addReportBtn.dataset.notenAddReport, null); return; }

    const editReportBtn = e.target.closest('[data-noten-edit-report]');
    if (editReportBtn) {
      const report = notenReportCards.find(r => r.id === editReportBtn.dataset.notenEditReport);
      if (report) openNotenReportModal(report.yearId, report.id);
      return;
    }

    const delReportBtn = e.target.closest('[data-noten-delete-report]');
    if (delReportBtn) { confirmDeleteNotenReport(delReportBtn.dataset.notenDeleteReport); return; }

    const compareBtn = e.target.closest('[data-noten-compare-reports]');
    if (compareBtn) { openNotenCompareModal(compareBtn.dataset.notenCompareReports); return; }

    const header = e.target.closest('[data-noten-toggle-year]');
    if (header) { toggleNotenYear(header.dataset.notenToggleYear); return; }
  });

  // ── Ausbildungsjahr-Modal ──
  document.getElementById('noten-year-save').addEventListener('click', saveNotenYear);
  document.getElementById('noten-year-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveNotenYear(); }
  });

  // ── Fach-Modal ──
  document.getElementById('noten-subject-save').addEventListener('click', saveNotenSubject);
  document.getElementById('noten-subject-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveNotenSubject(); }
  });

  // ── Zeugnis-Modal ──
  document.getElementById('noten-report-save').addEventListener('click', saveNotenReport);
  document.getElementById('noten-report-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveNotenReport(); }
  });

  // ── Zeugnisse-vergleichen-Modal ──
  document.getElementById('noten-compare-select-a').addEventListener('change', renderNotenCompareTable);
  document.getElementById('noten-compare-select-b').addEventListener('change', renderNotenCompareTable);

  // ── Leistung-Modal ──
  document.getElementById('noten-entry-category').addEventListener('change', e => {
    const cat = notenCategoryById(e.target.value);
    if (cat) document.getElementById('noten-entry-weight').value = cat.weight;
  });
  document.getElementById('noten-entry-save').addEventListener('click', saveNotenEntry);
  document.getElementById('noten-entry-grade').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveNotenEntry(); }
  });

  // ── Fach-Detailansicht ──
  ['noten-target-avg', 'noten-target-weight'].forEach(id =>
    document.getElementById(id).addEventListener('input', renderNotenTarget));
  document.getElementById('noten-detail-rename-btn').addEventListener('click', () => {
    const subject = notenSubjects.find(s => s.id === notenDetailSubjectId);
    if (!subject) return;
    document.getElementById('noten-subject-detail-overlay').classList.add('hidden');
    openNotenSubjectModal(subject.yearId, subject.id);
  });
  document.getElementById('noten-detail-delete-btn').addEventListener('click', async () => {
    const subject = notenSubjects.find(s => s.id === notenDetailSubjectId);
    if (!subject) return;
    if (!(await hubConfirm({ title: 'Fach löschen?', message: `„${subject.name}“ inkl. aller erfassten Leistungen wird gelöscht.`, confirmText: 'Löschen', danger: true }))) return;
    notenSubjects = notenSubjects.filter(s => s.id !== subject.id);
    notenEntries  = notenEntries.filter(e => e.subjectId !== subject.id);
    notenReportCards.forEach(r => { if (r.grades) delete r.grades[subject.id]; });
    saveNotenSubjects(); saveNotenEntries(); saveNotenReportCards();
    closeNotenSubjectDetail();
    renderNotenYears();
  });
  document.getElementById('noten-detail-add-entry-btn').addEventListener('click', () => {
    openNotenEntryModal(notenDetailSubjectId, null);
  });
  document.getElementById('noten-detail-entries').addEventListener('click', async e => {
    const editBtn = e.target.closest('.noten-entry-edit');
    if (editBtn) { openNotenEntryModal(notenDetailSubjectId, editBtn.dataset.entryId); return; }
    const delBtn = e.target.closest('.noten-entry-delete');
    if (!delBtn) return;
    const entry = notenEntries.find(en => en.id === delBtn.dataset.entryId);
    if (!entry) return;
    if (!(await hubConfirm({ title: 'Leistung löschen?', message: 'Diese Leistung wird entfernt.', confirmText: 'Löschen', danger: true }))) return;
    notenEntries = notenEntries.filter(en => en.id !== entry.id);
    saveNotenEntries();
    renderNotenSubjectDetail();
    renderNotenYears();
  });
}

// =========================
// RENDERING — Ausbildungsjahre + Fächer
// =========================

function renderNotenYears() {
  const container = document.getElementById('noten-years-list');
  const emptyEl   = document.getElementById('noten-empty');
  if (!container) return;

  if (!notenYears.length) {
    container.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  container.innerHTML = notenYears.map(year => {
    const isOpen   = !!notenOpenYears[year.id];
    const subjects = notenYearSubjects(year.id);
    const yearAvg  = notenYearAverage(year.id);

    return `
      <div class="noten-year-item">
        <div class="noten-year-header" data-noten-toggle-year="${year.id}">
          <span class="noten-year-chevron">${isOpen ? '▼' : '▶'}</span>
          <span class="noten-year-name">${escHtml(year.name)}</span>
          <span class="noten-year-meta">${subjects.length} ${subjects.length === 1 ? 'Fach' : 'Fächer'}</span>
          <span class="noten-year-avg">${yearAvg !== null ? 'Ø ' + notenFormatGrade(yearAvg) : '–'}</span>
          <div class="noten-year-actions">
            <button class="icon-btn" data-noten-edit-year="${year.id}" title="Bearbeiten">✎</button>
            <button class="icon-btn" data-noten-delete-year="${year.id}" title="Löschen">🗑</button>
          </div>
        </div>
        <div class="noten-year-body ${isOpen ? '' : 'collapsed'}">
          <div class="noten-subject-grid" id="noten-subject-grid-${year.id}">${notenRenderSubjectGrid(year.id)}</div>
          ${notenRenderReportsSection(year.id)}
        </div>
      </div>
    `;
  }).join('');
}

function notenRenderSubjectGrid(yearId) {
  const subjects = notenYearSubjects(yearId);
  if (!subjects.length) return `<div class="noten-subject-empty">Noch keine Fächer.</div>`;
  return subjects.map(s => {
    const avg = notenSubjectAverage(s.id);
    const pendingCount = notenSubjectEntries(s.id).filter(e => e.grade === null || e.grade === undefined).length;
    return `
      <button class="noten-subject-card" data-noten-open-subject="${s.id}">
        <span class="noten-subject-name">${escHtml(s.name)}</span>
        <span class="noten-subject-avg">${avg !== null ? 'Ø ' + notenFormatGrade(avg) : '–'}</span>
        ${pendingCount ? `<span class="noten-subject-pending">${pendingCount} ausstehend</span>` : ''}
      </button>
    `;
  }).join('');
}

function toggleNotenYear(yearId) {
  notenOpenYears[yearId] = !notenOpenYears[yearId];
  saveNotenOpenYears();
  renderNotenYears();
}

// =========================
// AUSBILDUNGSJAHR — CRUD
// =========================

function openNotenYearModal(yearId) {
  notenYearEditId = yearId || null;
  const year = yearId ? notenYears.find(y => y.id === yearId) : null;
  document.getElementById('noten-year-modal-title').textContent = year ? 'Ausbildungsjahr bearbeiten' : 'Neues Ausbildungsjahr';
  document.getElementById('noten-year-name').value = year ? year.name : '';
  document.getElementById('noten-year-subject-row').classList.toggle('hidden', !year);
  notenModals.year.open();
  setTimeout(() => document.getElementById('noten-year-name').focus(), 50);
}
function closeNotenYearModal() { notenModals.year.close(); }
function saveNotenYear() {
  const name = document.getElementById('noten-year-name').value.trim();
  if (!name) return;

  if (notenYearEditId) {
    const year = notenYears.find(y => y.id === notenYearEditId);
    if (year) year.name = name;
  } else {
    const id = notenUid();
    notenYears.push({ id, name });
    notenOpenYears[id] = true;
    saveNotenOpenYears();
  }
  saveNotenYears();
  closeNotenYearModal();
  renderNotenYears();
}
async function confirmDeleteNotenYear(yearId) {
  const year = notenYears.find(y => y.id === yearId);
  if (!year) return;
  if (!(await hubConfirm({ title: 'Ausbildungsjahr löschen?', message: `„${year.name}“ inkl. aller Fächer, Zeugnisse und Noten wird gelöscht. Globale Kategorien bleiben erhalten.`, confirmText: 'Löschen', danger: true }))) return;
  const subjectIds = notenYearSubjects(yearId).map(s => s.id);
  notenYears       = notenYears.filter(y => y.id !== yearId);
  notenSubjects    = notenSubjects.filter(s => s.yearId !== yearId);
  notenEntries     = notenEntries.filter(e => !subjectIds.includes(e.subjectId));
  notenReportCards = notenReportCards.filter(r => r.yearId !== yearId);
  delete notenOpenYears[yearId];
  saveNotenYears(); saveNotenSubjects(); saveNotenEntries(); saveNotenReportCards(); saveNotenOpenYears();
  renderNotenYears();
}

// =========================
// FACH — CRUD
// =========================

function openNotenSubjectModal(yearId, subjectId) {
  notenSubjectYearId  = yearId;
  notenSubjectEditId  = subjectId || null;
  const subject = subjectId ? notenSubjects.find(s => s.id === subjectId) : null;
  document.getElementById('noten-subject-modal-title').textContent = subject ? 'Fach umbenennen' : 'Neues Fach';
  document.getElementById('noten-subject-name').value = subject ? subject.name : '';
  notenModals.subject.open();
  setTimeout(() => document.getElementById('noten-subject-name').focus(), 50);
}
function closeNotenSubjectModal() { notenModals.subject.close(); }

// Nach dem Fach-Modal (Speichern ODER Abbrechen) dorthin zurück, woher man
// kam: ins Ausbildungsjahr-Modal oder in die Fach-Detailansicht (Umbenennen).
function notenAfterSubjectModal() {
  if (notenYearModalReturnId) {
    const returnId = notenYearModalReturnId;
    notenYearModalReturnId = null;
    openNotenYearModal(returnId);
  } else if (notenDetailSubjectId && notenSubjects.some(s => s.id === notenDetailSubjectId)) {
    renderNotenSubjectDetail();
    notenModals.detail.open();
  }
}
function saveNotenSubject() {
  const name = document.getElementById('noten-subject-name').value.trim();
  if (!name) return;

  let subjectId = notenSubjectEditId;
  if (subjectId) {
    const subject = notenSubjects.find(s => s.id === subjectId);
    if (subject) subject.name = name;
  } else {
    subjectId = notenUid();
    notenSubjects.push({ id: subjectId, yearId: notenSubjectYearId, name });
  }
  saveNotenSubjects();
  renderNotenYears();
  closeNotenSubjectModal();   // führt ggf. zurück in die Detailansicht
}

// =========================
// KATEGORIEN — Global (Einstellungen → Notenmanager)
// Analog zu renderPositivitySettings() in positivity.js: das Modul,
// das die Daten besitzt, rendert seine eigene Einstellungssektion.
// renderSettings() (settings.js) ruft dies bei Bedarf per typeof-
// Check auf. Nutzt dieselbe Markup-/CSS-Struktur (.noten-category-row)
// wie zuvor das Kategorien-Modal — keine Duplikate.
// =========================

function renderNotenCategorySettings() {
  const rows = document.getElementById('noten-settings-category-rows');
  if (!rows) return;
  rows.innerHTML = notenCategories.length ? notenCategories.map(c => `
    <div class="noten-category-row">
      <input type="text" class="modal-input noten-cat-name" value="${escHtml(c.name)}" data-cat-id="${c.id}"/>
      <input type="number" class="modal-input noten-cat-weight" value="${c.weight}" min="0.5" step="0.5" data-cat-id="${c.id}"/>
      <button class="icon-btn noten-cat-delete" data-cat-id="${c.id}" title="Löschen">🗑</button>
    </div>
  `).join('') : `<div class="noten-empty-hint">Noch keine Kategorien.</div>`;
}

function openNotenSettingsModal() {
  renderNotenCategorySettings();
  notenModals.settings.open();
}

// =========================
// LEISTUNGEN (Einträge) — CRUD
// =========================

function openNotenEntryModal(subjectId, entryId) {
  notenEntrySubjectId = subjectId;
  notenEntryEditId    = entryId || null;
  const subject = notenSubjects.find(s => s.id === subjectId);
  if (!subject) return;
  const entry = entryId ? notenEntries.find(e => e.id === entryId) : null;
  const cats  = notenCategories;

  document.getElementById('noten-entry-modal-title').textContent = entry ? 'Leistung bearbeiten' : 'Neue Leistung';

  const catSelect = document.getElementById('noten-entry-category');
  catSelect.innerHTML = cats.length
    ? cats.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')
    : `<option value="">Keine Kategorien</option>`;

  document.getElementById('noten-entry-date').value = entry ? entry.date : dateKey(new Date());

  const initialCatId = entry ? entry.categoryId : (cats[0] ? cats[0].id : '');
  catSelect.value = initialCatId;
  const initialCat = notenCategoryById(initialCatId);

  document.getElementById('noten-entry-grade').value  = (entry && entry.grade !== null && entry.grade !== undefined) ? entry.grade : '';
  document.getElementById('noten-entry-weight').value = entry ? entry.weight : (initialCat ? initialCat.weight : 1);

  notenModals.entry.open();
  setTimeout(() => document.getElementById('noten-entry-grade').focus(), 50);
}
function closeNotenEntryModal() { notenModals.entry.close(); }
function saveNotenEntry() {
  const date       = document.getElementById('noten-entry-date').value;
  const categoryId = document.getElementById('noten-entry-category').value;
  const grade       = notenParseGrade(document.getElementById('noten-entry-grade').value);
  if (Number.isNaN(grade)) {
    hubAlert('Note nicht erkannt', 'Bitte eine Note von 1 bis 6 eingeben, z. B. 2,3 · 2- · 1-2 — oder leer lassen für „ausstehend“.');
    return;
  }
  const weight     = Math.max(0.5, parseFloat(document.getElementById('noten-entry-weight').value) || 1);

  if (notenEntryEditId) {
    const entry = notenEntries.find(e => e.id === notenEntryEditId);
    if (entry) Object.assign(entry, { date, categoryId, grade, weight });
  } else {
    notenEntries.push({ id: notenUid(), subjectId: notenEntrySubjectId, date, categoryId, grade, weight });
  }
  saveNotenEntries();
  closeNotenEntryModal();
  renderNotenSubjectDetail();
  renderNotenYears();
}

// =========================
// FACH-DETAILANSICHT
// =========================

function openNotenSubjectDetail(subjectId) {
  if (!notenSubjects.some(s => s.id === subjectId)) return;
  notenDetailSubjectId = subjectId;
  const first = notenCategories[0];
  document.getElementById('noten-target-avg').value = '';
  document.getElementById('noten-target-weight').value = first ? first.weight : 1;
  renderNotenSubjectDetail();
  notenModals.detail.open();
}
function closeNotenSubjectDetail() { notenModals.detail.close(); }

// „Was brauche ich?“ — welche Note die nächste Leistung (Gewichtung w)
// höchstens haben darf, damit der Fachschnitt das Ziel erreicht:
// (S + g·w) / (W + w) = Ziel  →  g = (Ziel·(W + w) − S) / w
function renderNotenTarget() {
  const out = document.getElementById('noten-target-result');
  const target = parseGermanNumber(document.getElementById('noten-target-avg').value);
  const w = parseGermanNumber(document.getElementById('noten-target-weight').value) || 1;
  if (!notenDetailSubjectId || isNaN(target) || target < 1 || target > 6 || w <= 0) { out.textContent = ''; return; }
  const graded = notenEntries.filter(e => e.subjectId === notenDetailSubjectId && e.grade !== null && e.grade !== undefined);
  let S = 0, W = 0;
  graded.forEach(e => { const ew = e.weight > 0 ? e.weight : 1; S += e.grade * ew; W += ew; });
  const need = (target * (W + w) - S) / w;
  const best = (S + 1 * w) / (W + w);
  if (need < 1) out.textContent = `Nicht erreichbar — selbst mit einer 1 käme der Schnitt nur auf Ø ${notenFormatGrade(best)}.`;
  else if (need >= 6) out.textContent = 'Sicher — selbst mit einer 6 bleibt der Schnitt im Ziel.';
  else out.textContent = `Du brauchst eine ${notenFormatGrade(Math.floor(need * 100) / 100)} oder besser.`;
}
function renderNotenSubjectDetail() {
  const subject = notenSubjects.find(s => s.id === notenDetailSubjectId);
  if (!subject) { closeNotenSubjectDetail(); return; }

  const avg = notenSubjectAverage(subject.id);
  document.getElementById('noten-detail-title').textContent = subject.name;
  document.getElementById('noten-detail-avg').textContent = avg !== null ? 'Ø ' + notenFormatGrade(avg) : 'Noch keine Note';

  const entries = notenSubjectEntries(subject.id);
  const list = document.getElementById('noten-detail-entries');
  list.innerHTML = entries.length ? entries.map(e => {
    const cat = notenCategoryById(e.categoryId);
    const dateLabel = e.date ? new Date(e.date + 'T00:00:00').toLocaleDateString('de-DE') : '–';
    const gradeLabel = (e.grade === null || e.grade === undefined)
      ? `<span class="noten-badge-pending">Ausstehend</span>`
      : notenFormatGrade(e.grade);
    return `
      <div class="noten-entry-row">
        <span class="noten-entry-date">${dateLabel}</span>
        <span class="noten-entry-cat">${cat ? escHtml(cat.name) : '—'}</span>
        <span class="noten-entry-grade">${gradeLabel}</span>
        <span class="noten-entry-weight">×${e.weight ?? 1}</span>
        <div class="noten-entry-actions">
          <button class="icon-btn noten-entry-edit" data-entry-id="${e.id}" title="Bearbeiten">✎</button>
          <button class="icon-btn noten-entry-delete" data-entry-id="${e.id}" title="Löschen">🗑</button>
        </div>
      </div>
    `;
  }).join('') : `<div class="noten-empty-hint">Noch keine Leistungen erfasst.</div>`;
  renderNotenTarget();
}

// =========================
// ZEUGNISSE — pro Ausbildungsjahr
// Einfaches Archiv: Name, Note je Fach (nur erfasste Fächer zählen),
// ein optionaler Gesamtkommentar. Gesamtschnitt = einfacher
// Durchschnitt der eingetragenen Fachnoten (keine Gewichtung —
// bewusst simpler als der Leistungsschnitt, das Zeugnis bildet nur
// das Endergebnis ab).
// =========================

function notenYearReports(yearId) { return notenReportCards.filter(r => r.yearId === yearId); }

function notenReportAverage(report) {
  const grades = Object.values(report.grades || {}).filter(g => typeof g === 'number');
  if (!grades.length) return null;
  return grades.reduce((a, b) => a + b, 0) / grades.length;
}

function notenRenderReportsSection(yearId) {
  const reports  = notenYearReports(yearId);
  const subjects = notenYearSubjects(yearId);
  const compareBtn = reports.length >= 2
    ? `<button class="btn-ghost" data-noten-compare-reports="${yearId}">Zeugnisse vergleichen</button>` : '';

  const list = reports.length ? reports.map(r => {
    const avg = notenReportAverage(r);
    const gradeChips = subjects
      .filter(s => r.grades && r.grades[s.id] !== undefined)
      .map(s => `<span class="noten-report-grade-chip"><span class="noten-report-grade-subject">${escHtml(s.name)}</span><span class="noten-report-grade-value">${notenFormatGradeShort(r.grades[s.id])}</span></span>`);
    const gradesHtml = gradeChips.length
      ? gradeChips.join('<span class="noten-report-grade-sep">•</span>')
      : `<span class="noten-empty-hint" style="padding:0;">Noch keine Noten eingetragen.</span>`;

    return `
      <div class="noten-report-card">
        <div class="noten-report-card-head">
          <span class="noten-report-card-icon">📄</span>
          <span class="noten-report-card-name">${escHtml(r.name)}</span>
          <span class="noten-report-card-avg">${avg !== null ? 'Ø ' + notenFormatGrade(avg) : '–'}</span>
          <div class="noten-report-card-actions">
            <button class="icon-btn" data-noten-edit-report="${r.id}" title="Bearbeiten">✎</button>
            <button class="icon-btn" data-noten-delete-report="${r.id}" title="Löschen">🗑</button>
          </div>
        </div>
        <div class="noten-report-card-grades">${gradesHtml}</div>
      </div>
    `;
  }).join('') : `<div class="noten-empty-hint">Noch keine Zeugnisse.</div>`;

  return `
    <div class="noten-reports-section">
      <div class="noten-reports-header">
        <span class="noten-reports-title">Zeugnisse</span>
        <div class="noten-reports-header-actions">
          ${compareBtn}
          <button class="btn-ghost" data-noten-add-report="${yearId}">+ Zeugnis</button>
        </div>
      </div>
      <div class="noten-reports-list">${list}</div>
    </div>
  `;
}

function openNotenReportModal(yearId, reportId) {
  notenReportYearId = yearId;
  notenReportEditId = reportId || null;
  const report = reportId ? notenReportCards.find(r => r.id === reportId) : null;

  document.getElementById('noten-report-modal-title').textContent = report ? 'Zeugnis bearbeiten' : 'Neues Zeugnis';
  document.getElementById('noten-report-name').value = report ? report.name : '';
  document.getElementById('noten-report-comment').value = report ? (report.comment || '') : '';

  const subjects = notenYearSubjects(yearId);
  const gradesEl = document.getElementById('noten-report-grades');
  gradesEl.innerHTML = subjects.length ? subjects.map(s => {
    const val = (report && report.grades && report.grades[s.id] !== undefined) ? report.grades[s.id] : '';
    return `
      <div class="noten-report-grade-row">
        <span class="noten-report-subject-name">${escHtml(s.name)}</span>
        <input type="text" inputmode="decimal" class="modal-input noten-report-grade-input" data-subject-id="${s.id}" value="${val}" placeholder="–"/>
      </div>
    `;
  }).join('') : `<div class="noten-empty-hint">Erst Fächer anlegen, um Noten einzutragen.</div>`;

  notenModals.report.open();
  setTimeout(() => document.getElementById('noten-report-name').focus(), 50);
}
function closeNotenReportModal() { notenModals.report.close(); }
function saveNotenReport() {
  const name = document.getElementById('noten-report-name').value.trim();
  if (!name) return;
  const comment = document.getElementById('noten-report-comment').value.trim();

  const grades = {};
  document.querySelectorAll('.noten-report-grade-input').forEach(input => {
    const parsed = notenParseGrade(input.value);
    if (parsed !== null && !Number.isNaN(parsed)) grades[input.dataset.subjectId] = parsed;
  });

  if (notenReportEditId) {
    const report = notenReportCards.find(r => r.id === notenReportEditId);
    if (report) Object.assign(report, { name, comment, grades });
  } else {
    notenReportCards.push({ id: notenUid(), yearId: notenReportYearId, name, comment, grades });
  }
  saveNotenReportCards();
  closeNotenReportModal();
  renderNotenYears();
}
async function confirmDeleteNotenReport(reportId) {
  const report = notenReportCards.find(r => r.id === reportId);
  if (!report) return;
  if (!(await hubConfirm({ title: 'Zeugnis löschen?', message: `„${report.name}“ wird gelöscht.`, confirmText: 'Löschen', danger: true }))) return;
  notenReportCards = notenReportCards.filter(r => r.id !== reportId);
  saveNotenReportCards();
  renderNotenYears();
}

// =========================
// ZEUGNISSE VERGLEICHEN
// Einfache Fach-für-Fach-Gegenüberstellung zweier Zeugnisse desselben
// Ausbildungsjahres, plus Gesamtschnitt-Vergleich. Keine Diagramme —
// bewusst auf eine schlichte Liste beschränkt.
// =========================

function openNotenCompareModal(yearId) {
  notenCompareYearId = yearId;
  const reports = notenYearReports(yearId);
  const options = reports.map(r => `<option value="${r.id}">${escHtml(r.name)}</option>`).join('');
  const selA = document.getElementById('noten-compare-select-a');
  const selB = document.getElementById('noten-compare-select-b');
  selA.innerHTML = options;
  selB.innerHTML = options;
  if (reports.length >= 2) {
    selA.value = reports[reports.length - 2].id;
    selB.value = reports[reports.length - 1].id;
  }
  renderNotenCompareTable();
  notenModals.compare.open();
}
function renderNotenCompareTable() {
  const tableEl = document.getElementById('noten-compare-table');
  const idA = document.getElementById('noten-compare-select-a').value;
  const idB = document.getElementById('noten-compare-select-b').value;
  const reportA = notenReportCards.find(r => r.id === idA);
  const reportB = notenReportCards.find(r => r.id === idB);
  if (!reportA || !reportB) { tableEl.innerHTML = ''; return; }

  const subjects = notenYearSubjects(notenCompareYearId);
  const rows = subjects.map(s => {
    const gA = reportA.grades ? reportA.grades[s.id] : undefined;
    const gB = reportB.grades ? reportB.grades[s.id] : undefined;
    const labelA = gA !== undefined ? notenFormatGrade(gA) : '–';
    const labelB = gB !== undefined ? notenFormatGrade(gB) : '–';
    return `
      <div class="noten-compare-row">
        <span class="noten-compare-subject">${escHtml(s.name)}</span>
        <span class="noten-compare-values">${labelA} → ${labelB}</span>
      </div>
    `;
  }).join('');

  const avgA = notenReportAverage(reportA);
  const avgB = notenReportAverage(reportB);
  const avgRow = `
    <div class="noten-compare-row noten-compare-row--total">
      <span class="noten-compare-subject">Gesamtschnitt</span>
      <span class="noten-compare-values">${avgA !== null ? notenFormatGrade(avgA) : '–'} → ${avgB !== null ? notenFormatGrade(avgB) : '–'}</span>
    </div>
  `;

  tableEl.innerHTML = rows + avgRow;
}

// =========================
// SUCHQUELLE (js/hub-search.js, AI documentation/search.md) — nur lesen;
// open() klappt das Ausbildungsjahr auf und öffnet Fach bzw. Zeugnis.
// =========================
function notenOpenFromSearch(yearId, open) {
  showView('tools');
  toolsShowTool('notenmanager');
  if (!notenOpenYears[yearId]) { notenOpenYears[yearId] = true; saveNotenOpenYears(); renderNotenYears(); }
  document.getElementById('tool-notenmanager')?.scrollIntoView({ block: 'start' });
  open();
}

registerSearchProvider({
  id: 'noten', label: 'Notenmanager', icon: '🎓', view: 'tools',
  items: () => {
    const yearName = id => notenYears.find(y => y.id === id)?.name || 'Ausbildungsjahr';
    const subjects = notenSubjects.map(s => {
      const avg = notenSubjectAverage(s.id);
      return {
        id: s.id, icon: '📘', title: s.name,
        sub: `${yearName(s.yearId)}${avg !== null ? ' · Ø ' + notenFormatGrade(avg) : ''}`, text: '',
        open: () => notenOpenFromSearch(s.yearId, () => openNotenSubjectDetail(s.id)),
      };
    });
    const reports = notenReportCards.map(r => ({
      id: r.id, icon: '📄', title: r.name, sub: `Zeugnis · ${yearName(r.yearId)}`, text: r.comment || '',
      open: () => notenOpenFromSearch(r.yearId, () => openNotenReportModal(r.yearId, r.id)),
    }));
    return [...subjects, ...reports];
  },
});