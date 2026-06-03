// =========================
// NATIONAL DAY — Optional Plugin
// Personal HUB · Today sidebar widget
// =========================

(function() {

// ── Data ─────────────────────────────────────────────────────
// Curated list of national/international days (month-day: [{title, desc}])
const NATIONAL_DAYS = {
  '01-01': [{ title: 'Neujahrstag', desc: 'Internationaler Tag des Neuen Jahres — Weltweit wird das neue Jahr gefeiert.' }],
  '01-04': [{ title: 'World Braille Day', desc: 'Gedenktag für Louis Braille, Erfinder der Blindenschrift.' }],
  '01-17': [{ title: 'Ditch New Year\'s Resolutions Day', desc: 'Schon aufgegeben? Keine Sorge, du bist nicht allein.' }],
  '02-02': [{ title: 'Groundhog Day', desc: 'Amerikanische Tradition: Das Murmeltier sagt den Frühling vorher.' }],
  '02-14': [{ title: 'Valentinstag', desc: 'Tag der Liebe und Zuneigung — weltweit gefeiert.' }],
  '03-08': [{ title: 'Internationaler Frauentag', desc: 'Globaler Aktionstag für Gleichberechtigung und Frauenrechte.' }],
  '03-14': [{ title: 'Pi Day', desc: 'Gefeiert am 3/14 — π ≈ 3.14159... Der internationale Tag der Mathematik.' }],
  '03-20': [{ title: 'Internationaler Glückstag', desc: 'Die UN erklärten den 20. März zum World Happiness Day.' }],
  '03-22': [{ title: 'Weltwassertag', desc: 'Die UN rufen zur Aufmerksamkeit für sauberes Trinkwasser auf.' }],
  '04-01': [{ title: 'April Fool\'s Day', desc: 'Tag der harmlosen Streiche und Witze weltweit.' }],
  '04-22': [{ title: 'Earth Day', desc: 'Internationaler Tag der Erde — für Klimaschutz und Umweltbewusstsein.' }],
  '04-23': [{ title: 'Welttag des Buches', desc: 'UNESCO-Aktionstag für Lesen, Literatur und geistiges Eigentum.' }],
  '05-04': [{ title: 'Star Wars Day', desc: '"May the Fourth be with you" — Fan-Feiertag der Star-Wars-Gemeinde.' }],
  '05-17': [{ title: 'World Telecommunication Day', desc: 'Welttag der Telekommunikation und Informationsgesellschaft.' }],
  '06-01': [{ title: 'Internationaler Kindertag', desc: 'Weltweit wird an die Rechte und das Wohl von Kindern erinnert.' }],
  '06-03': [{ title: 'National Repeat Day', desc: 'National Repeat Day — National Repeat Day. Der Tag, der sich selbst feiert.' }],
  '06-05': [{ title: 'Weltumwelttag', desc: 'Die bedeutendste globale Plattform für Umweltschutz, initiiert von der UN.' }],
  '06-21': [{ title: 'Welttag der Musik', desc: 'Fête de la Musique — Live-Musik auf Plätzen und Straßen weltweit.' }],
  '07-07': [{ title: 'World Chocolate Day', desc: 'Feiert die Einführung der Schokolade in Europa (1550).' }],
  '07-30': [{ title: 'International Friendship Day', desc: 'UN-Aktionstag für Freundschaft zwischen Kulturen und Völkern.' }],
  '08-12': [{ title: 'Internationaler Jugendtag', desc: 'UN-Aktionstag, der auf Themen und Herausforderungen der Jugend aufmerksam macht.' }],
  '09-12': [{ title: 'Programmierer-Tag', desc: 'Der 256. Tag des Jahres — 256 = 2⁸, eine bedeutungsvolle Zahl in der IT.' }],
  '09-13': [{ title: 'International Chocolate Day', desc: 'Gedenkfeier zum Geburtstag von Milton Hershey — mehr Schokolade braucht kein Grund.' }],
  '09-21': [{ title: 'Internationaler Friedenstag', desc: 'UN-Aktionstag für weltweiten Waffenstillstand und Gewaltfreiheit.' }],
  '10-01': [{ title: 'Weltmusiktag', desc: 'Tag der internationalen Musik und kulturellen Vielfalt.' }],
  '10-10': [{ title: 'Welttag der psychischen Gesundheit', desc: 'Globaler Aktionstag für Bewusstsein rund um mentale Gesundheit.' }],
  '10-31': [{ title: 'Halloween', desc: 'Aus keltischen Traditionen — der Abend vor Allerheiligen.' }],
  '11-11': [{ title: 'Singles\' Day', desc: 'Ursprünglich chinesischer Feiertag für Singles — heute weltweiter Shopping-Tag.' }],
  '12-04': [{ title: 'National Cookie Day', desc: 'Kekse essen ist heute offiziell Pflicht.' }],
  '12-25': [{ title: 'Weihnachten', desc: 'Christliches Fest der Geburt Jesu — weltweit gefeiert.' }],
  '12-31': [{ title: 'Silvester', desc: 'Der letzte Tag des Jahres — Rückblick, Feuerwerk und Neujahrsvorfreude.' }],
};

function getTodayKey() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

function getDayEntries() {
  const key = getTodayKey();
  return NATIONAL_DAYS[key] || null;
}

// ── Modal ─────────────────────────────────────────────────────

function openNationalDayModal(entries) {
  let overlay = document.getElementById('national-day-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'national-day-modal-overlay';
    overlay.className = 'modal-overlay hidden';
    overlay.innerHTML = `
      <div class="modal national-day-modal" id="national-day-modal">
        <div class="modal-header">
          <span class="modal-title" id="national-day-modal-title"></span>
          <button class="icon-btn" id="national-day-modal-close">✕</button>
        </div>
        <div id="national-day-modal-body" style="padding:16px 20px 20px;"></div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('national-day-modal-close').addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

  document.getElementById('national-day-modal-title').textContent = dateStr;
  const body = document.getElementById('national-day-modal-body');
  body.innerHTML = '';
  entries.forEach(entry => {
    const wrap = document.createElement('div');
    wrap.className = 'national-day-entry';
    wrap.innerHTML = `
      <div class="national-day-entry-title">${entry.title}</div>
      <div class="national-day-entry-desc">${entry.desc}</div>`;
    body.appendChild(wrap);
  });
  overlay.classList.remove('hidden');
}

// ── Widget Render ──────────────────────────────────────────────

function renderNationalDayWidget() {
  const sidebar = document.getElementById('today-right');
  if (!sidebar) return;
  if (document.getElementById('national-day-widget')) return; // already rendered

  const entries = getDayEntries();
  if (!entries) return; // no entry for today → don't show widget

  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

  const widget = document.createElement('div');
  widget.id = 'national-day-widget';
  widget.className = 'national-day-widget';
  widget.title = 'Mehr erfahren';
  widget.innerHTML = `
    <div class="national-day-header">
      <span class="national-day-label">📅 Heute ist</span>
      <span class="national-day-date">${dateStr}</span>
    </div>
    <div class="national-day-title">${entries[0].title}</div>
    ${entries.length > 1 ? `<div class="national-day-more">+${entries.length - 1} weitere</div>` : ''}
  `;
  widget.addEventListener('click', () => openNationalDayModal(entries));
  sidebar.appendChild(widget);
}

// Wait for DOM to be ready, then render
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderNationalDayWidget);
} else {
  // DOM already ready — but today-right might not exist yet if called too early
  setTimeout(renderNationalDayWidget, 100);
}

})();
