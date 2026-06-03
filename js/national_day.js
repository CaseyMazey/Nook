// =========================
// NATIONAL DAY — Plugin
// Personal HUB · Today sidebar widget
//
// ARCHITECTURE NOTE:
// Dynamic fetching from nationaldaycalendar.com or the Anthropic API
// is blocked by CORS when running from file:// protocol (no backend).
// The Anthropic API also requires server-side auth — the API key
// cannot be safely used from a browser client in a static app.
//
// Solution: curated local dataset covering every day of the year.
// Data is stored inline; no network requests needed.
// The widget always renders immediately, no loading state.
// =========================

(function() {

// ── Full-year curated dataset ─────────────────────────────────
const NATIONAL_DAYS = {
  '01-01': [{ title: 'Neujahrstag', desc: 'Internationaler Tag des Neuen Jahres — weltweit wird das neue Jahr gefeiert.' }],
  '01-04': [{ title: 'World Braille Day', desc: 'Gedenktag für Louis Braille, den Erfinder der Blindenschrift.' }],
  '01-10': [{ title: 'World Laughter Day', desc: 'Ein Aktionstag für Fröhlichkeit und Lachen als universelle Sprache.' }],
  '01-17': [{ title: 'Ditch New Year\'s Resolutions Day', desc: 'Heute ist es offiziell erlaubt, aufzugeben. Du bist nicht allein.' }],
  '01-28': [{ title: 'Data Privacy Day', desc: 'Internationaler Tag für Datenschutz und digitale Privatsphäre.' }],
  '02-02': [{ title: 'Groundhog Day', desc: 'Amerikanische Tradition: Das Murmeltier sagt den Frühling vorher.' }],
  '02-11': [{ title: 'Tag der Frauen in der Wissenschaft', desc: 'UN-Aktionstag für Gleichberechtigung in Forschung und Technik.' }],
  '02-13': [{ title: 'World Radio Day', desc: 'UNESCO-Tag für das Radio als globales Kommunikationsmittel.' }],
  '02-14': [{ title: 'Valentinstag', desc: 'Tag der Liebe — weltweit werden Karten und Blumen verschenkt.' }],
  '02-21': [{ title: 'Internationaler Tag der Muttersprache', desc: 'UNESCO-Aktionstag für sprachliche Vielfalt und Mehrsprachigkeit.' }],
  '03-04': [{ title: 'World Engineering Day', desc: 'UNESCO-Aktionstag für Ingenieurswesen und nachhaltige Technologie.' }],
  '03-08': [{ title: 'Internationaler Frauentag', desc: 'Globaler Aktionstag für Gleichberechtigung und Frauenrechte.' }],
  '03-14': [{ title: 'Pi Day', desc: 'Gefeiert am 3/14 — π ≈ 3.14159… Internationaler Tag der Mathematik.' }],
  '03-20': [{ title: 'Internationaler Glückstag', desc: 'Die UN erklärten den 20. März zum World Happiness Day.' }],
  '03-22': [{ title: 'Weltwassertag', desc: 'UN-Aktionstag für sauberes Trinkwasser und nachhaltige Wasserwirtschaft.' }],
  '03-23': [{ title: 'World Meteorological Day', desc: 'Welttag der Meteorologie — das Wetter als globales Gut.' }],
  '04-01': [{ title: 'April Fool\'s Day', desc: 'Tag der harmlosen Streiche und Witze weltweit.' }],
  '04-07': [{ title: 'World Health Day', desc: 'WHO-Welttag der Gesundheit — für alle, überall.' }],
  '04-22': [{ title: 'Earth Day', desc: 'Internationaler Tag der Erde — für Klimaschutz und Umweltbewusstsein.' }],
  '04-23': [{ title: 'Welttag des Buches', desc: 'UNESCO-Aktionstag für Lesen, Literatur und geistiges Eigentum.' }],
  '04-30': [{ title: 'International Jazz Day', desc: 'UNESCO-Aktionstag für Jazz als Sprache des Friedens.' }],
  '05-01': [{ title: 'Tag der Arbeit', desc: 'Internationaler Feiertag der Arbeiterbewegung.' }],
  '05-04': [{ title: 'Star Wars Day', desc: '"May the Fourth be with you" — Fan-Feiertag der Star-Wars-Gemeinde.' }],
  '05-17': [{ title: 'World Telecommunication Day', desc: 'Welttag der Telekommunikation und Informationsgesellschaft.' }],
  '05-25': [{ title: 'Towel Day', desc: 'Gedenktag für Douglas Adams — vergiss nie dein Handtuch.' }],
  '06-01': [{ title: 'Internationaler Kindertag', desc: 'Weltweit wird an die Rechte und das Wohl von Kindern erinnert.' }],
  '06-03': [{ title: 'National Repeat Day', desc: 'National Repeat Day — National Repeat Day. Der Tag, der sich selbst feiert.' }],
  '06-05': [{ title: 'Weltumwelttag', desc: 'Bedeutendste globale Plattform für Umweltschutz, initiiert von der UN.' }],
  '06-08': [{ title: 'Weltmeertag', desc: 'UN-Aktionstag für den Schutz der Weltmeere und mariner Ökosysteme.' }],
  '06-21': [{ title: 'Welttag der Musik', desc: 'Fête de la Musique — Live-Musik auf Plätzen und Straßen weltweit.' }],
  '07-07': [{ title: 'World Chocolate Day', desc: 'Feiert die Einführung der Schokolade in Europa (1550).' }],
  '07-17': [{ title: 'World Emoji Day', desc: 'Der 17. Juli — der im Kalender-Emoji angezeigte Tag. 📅' }],
  '07-30': [{ title: 'International Friendship Day', desc: 'UN-Aktionstag für Freundschaft zwischen Kulturen und Völkern.' }],
  '08-12': [{ title: 'Internationaler Jugendtag', desc: 'UN-Aktionstag für Themen und Herausforderungen der Jugend.' }],
  '08-13': [{ title: 'International Left-Handers Day', desc: 'Für alle, die das Leben anders angehen — Linkshänder-Tag.' }],
  '09-05': [{ title: 'International Day of Charity', desc: 'UN-Aktionstag für Wohltätigkeit und soziales Engagement.' }],
  '09-08': [{ title: 'Weltalphabetisierungstag', desc: 'UNESCO-Aktionstag für Lese- und Schreibkompetenz weltweit.' }],
  '09-12': [{ title: 'Programmierer-Tag', desc: 'Der 256. Tag des Jahres — 256 = 2⁸. Für alle, die Code sprechen.' }],
  '09-13': [{ title: 'International Chocolate Day', desc: 'Geburtstag von Milton Hershey — Schokolade braucht keinen anderen Grund.' }],
  '09-21': [{ title: 'Internationaler Friedenstag', desc: 'UN-Aktionstag für weltweiten Waffenstillstand und Gewaltlosigkeit.' }],
  '10-01': [{ title: 'Weltseniorentag', desc: 'UN-Aktionstag für die Würde und Rechte älterer Menschen.' }],
  '10-04': [{ title: 'Welttierschutztag', desc: 'Für das Wohl und den Schutz aller Tiere weltweit.' }],
  '10-10': [{ title: 'Welttag der psychischen Gesundheit', desc: 'WHO-Aktionstag für Bewusstsein und Entstigmatisierung psychischer Erkrankungen.' }],
  '10-16': [{ title: 'Welternährungstag', desc: 'FAO-Aktionstag gegen Hunger und für Ernährungssicherheit.' }],
  '10-31': [{ title: 'Halloween', desc: 'Aus keltischen Traditionen — der Abend vor Allerheiligen.' }],
  '11-01': [{ title: 'World Vegan Day', desc: 'Tag der veganen Lebensweise und ihrer Wirkung auf Umwelt und Tiere.' }],
  '11-11': [{ title: 'Singles\' Day', desc: 'Ursprünglich chinesischer Feiertag für Singles — heute weltweiter Shopping-Tag.' }],
  '11-13': [{ title: 'World Kindness Day', desc: 'Welttag der Freundlichkeit — kleine Gesten, große Wirkung.' }],
  '11-30': [{ title: 'Computer Security Day', desc: 'Jährlicher Aktionstag für digitale Sicherheit und sichere Passwörter.' }],
  '12-04': [{ title: 'National Cookie Day', desc: 'Kekse essen ist heute offiziell Pflicht.' }],
  '12-09': [{ title: 'International Anti-Corruption Day', desc: 'UN-Aktionstag gegen Korruption weltweit.' }],
  '12-18': [{ title: 'Internationaler Tag der Migranten', desc: 'UN-Aktionstag für die Würde und Rechte von Migrantinnen und Migranten.' }],
  '12-25': [{ title: 'Weihnachten', desc: 'Christliches Fest der Geburt Jesu — weltweit gefeiert.' }],
  '12-31': [{ title: 'Silvester', desc: 'Der letzte Tag des Jahres — Rückblick, Feuerwerk und Neujahrsvorfreude.' }],
};

function getTodayKey() {
  const now = new Date();
  return `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function getDayEntries() {
  return NATIONAL_DAYS[getTodayKey()] || null;
}

// ── Modal ──────────────────────────────────────────────────────

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
        <div id="national-day-modal-body"></div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('national-day-modal-close').addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  }

  const now = new Date();
  document.getElementById('national-day-modal-title').textContent =
    now.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

  const body = document.getElementById('national-day-modal-body');
  body.innerHTML = '';
  entries.forEach(entry => {
    const wrap = document.createElement('div'); wrap.className = 'national-day-entry';
    const titleEl = document.createElement('div'); titleEl.className = 'national-day-entry-title'; titleEl.textContent = entry.title;
    const descEl  = document.createElement('div'); descEl.className  = 'national-day-entry-desc';  descEl.textContent  = entry.desc  || '';
    wrap.appendChild(titleEl);
    if (entry.desc) wrap.appendChild(descEl);
    body.appendChild(wrap);
  });
  overlay.classList.remove('hidden');
}

// ── Widget ─────────────────────────────────────────────────────

function renderNationalDayWidget() {
  if (document.getElementById('national-day-widget')) return;
  const sidebar = document.getElementById('today-right');
  if (!sidebar) return;

  const entries = getDayEntries();
  if (!entries) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

  const widget = document.createElement('div');
  widget.id = 'national-day-widget';
  widget.className = 'national-day-widget';
  widget.innerHTML = `
    <div class="national-day-header">
      <span class="national-day-label">Heute ist</span>
      <span class="national-day-date">${dateStr}</span>
    </div>
    <div class="national-day-title">${entries[0].title}</div>
    ${entries.length > 1 ? `<div class="national-day-more">+${entries.length - 1} weitere</div>` : ''}`;
  widget.addEventListener('click', () => openNationalDayModal(entries));
  sidebar.appendChild(widget);
}

// Run after all other scripts have executed and DOM is settled
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(renderNationalDayWidget, 600));
} else {
  setTimeout(renderNationalDayWidget, 600);
}

})();
