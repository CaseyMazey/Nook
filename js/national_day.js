// =========================
// NATIONAL DAY — Dynamic Plugin
// Personal HUB · Today sidebar widget
// Uses Claude API + web_search to fetch the real national day
// =========================

(function() {

const ND_CACHE_KEY = 'nationalDayCache';
const ND_CACHE_TTL = 20 * 60 * 60 * 1000; // 20 hours

function getTodayDateStr() {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); // e.g. "June 3"
}

function getTodayCacheKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

// ── Fetch via Claude API + web_search ─────────────────────────

async function fetchNationalDay() {
  const dateStr = getTodayDateStr();
  const prompt = `What are the national days, international days, or fun observances for ${dateStr}? 
Search nationaldaycalendar.com for today's national days.
Return a JSON array (no markdown, no preamble) like:
[{"title":"National Example Day","desc":"Short description 1-2 sentences.","url":"https://nationaldaycalendar.com/..."}]
Return only the JSON array. No extra text.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error('API error ' + response.status);
  const data = await response.json();

  // Extract text from content blocks
  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Parse JSON — strip any accidental markdown fences
  const clean = text.replace(/```json|```/g, '').trim();
  const entries = JSON.parse(clean);
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('No entries');
  return entries;
}

// ── Cache ─────────────────────────────────────────────────────

function loadCache() {
  try {
    const raw = localStorage.getItem(ND_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.dateKey !== getTodayCacheKey()) return null; // different day
    if (Date.now() - cached.ts > ND_CACHE_TTL) return null; // expired
    return cached.entries;
  } catch { return null; }
}

function saveCache(entries) {
  try {
    localStorage.setItem(ND_CACHE_KEY, JSON.stringify({
      dateKey: getTodayCacheKey(),
      ts: Date.now(),
      entries
    }));
  } catch {}
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
        <div id="national-day-modal-body"></div>
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
    const titleEl = document.createElement('div');
    titleEl.className = 'national-day-entry-title';
    titleEl.textContent = entry.title;
    const descEl = document.createElement('div');
    descEl.className = 'national-day-entry-desc';
    descEl.textContent = entry.desc || '';
    wrap.appendChild(titleEl);
    if (entry.desc) wrap.appendChild(descEl);
    if (entry.url) {
      const link = document.createElement('a');
      link.className = 'national-day-entry-link';
      link.href = entry.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Mehr erfahren →';
      wrap.appendChild(link);
    }
    body.appendChild(wrap);
  });
  overlay.classList.remove('hidden');
}

// ── Widget ────────────────────────────────────────────────────

function buildWidget(entries) {
  const sidebar = document.getElementById('today-right');
  if (!sidebar) return;
  if (document.getElementById('national-day-widget')) return;

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

function buildLoadingWidget() {
  const sidebar = document.getElementById('today-right');
  if (!sidebar || document.getElementById('national-day-widget')) return;
  const widget = document.createElement('div');
  widget.id = 'national-day-widget';
  widget.className = 'national-day-widget national-day-loading';
  widget.innerHTML = `
    <div class="national-day-header">
      <span class="national-day-label">Heute ist</span>
    </div>
    <div class="national-day-title">Wird geladen…</div>`;
  sidebar.appendChild(widget);
  return widget;
}

function updateWidget(entries) {
  const existing = document.getElementById('national-day-widget');
  if (existing) existing.remove();
  buildWidget(entries);
}

// ── Init ──────────────────────────────────────────────────────

async function initNationalDay() {
  const cached = loadCache();
  if (cached) {
    buildWidget(cached);
    return;
  }

  const loadingEl = buildLoadingWidget();

  try {
    const entries = await fetchNationalDay();
    saveCache(entries);
    updateWidget(entries);
  } catch (e) {
    // Fetch failed — remove loading widget silently
    if (loadingEl && loadingEl.parentNode) loadingEl.remove();
    const w = document.getElementById('national-day-widget');
    if (w) w.remove();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initNationalDay, 500));
} else {
  setTimeout(initNationalDay, 500);
}

})();
