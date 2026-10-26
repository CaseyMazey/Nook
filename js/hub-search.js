// =========================
// GLOBALE SUCHE (Strg/⌘ + K) — Design-Vertrag: AI documentation/search.md
// Findet und öffnet Inhalte aus allen Tabs, legt aber nichts an, ändert
// nichts und speichert keine Inhalte (einzige eigene Daten: die zuletzt
// geöffneten Treffer, Key searchRecent).
//
// Der Kern kennt KEINEN Tab. Jeder Tab meldet in seiner eigenen Datei eine
// Suchquelle an (gleiches Prinzip wie registerGame bei den Spielen):
//   registerSearchProvider({
//     id: 'guides', label: 'Anleitungen', icon: '📖', view: 'guides',
//     items: () => [{ id, title, sub, text, keywords, open() }, …],
//   });
//   id       eindeutig innerhalb der Quelle (für „Zuletzt geöffnet“)
//   title    Haupttext des Treffers        sub   Fundort, z. B. „Netzwerk“
//   text     längerer Inhalt (Suche + Auszug)   keywords  Tags o. Ä.
//   open()   springt zum Eintrag (Tab wechseln, Fenster öffnen …)
// items() wird bei jedem Öffnen frisch aus den Daten im Speicher gebaut —
// kein zweiter Datenbestand, nichts kann veralten. Quellen ausgeblendeter
// Tabs (hiddenTabs) werden übersprungen.
// Lädt direkt nach hub-utils.js (vor allen Tab-Dateien).
// =========================

const searchProviders = [];
function registerSearchProvider(provider) {
  if (!provider || !provider.id || searchProviders.some(p => p.id === provider.id)) return;
  searchProviders.push(provider);
}

let searchRecent = DB.get('searchRecent', []);
function saveSearchRecent() { DB.set('searchRecent', searchRecent); }
const SEARCH_RECENT_MAX = 8;
const SEARCH_PER_GROUP = 5;

// Vergleichsform: klein, ohne Akzente/Umlaut-Punkte, ß → ss
function searchNorm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
}
// Wie searchNorm, aber mit Zuordnung Index (normalisiert) → Index (Original),
// damit sich der Treffer im ORIGINALTEXT markieren lässt
function searchNormMap(s) {
  let norm = ''; const map = [];
  for (let i = 0; i < s.length; i++) {
    const n = searchNorm(s[i]);
    for (let k = 0; k < n.length; k++) { norm += n[k]; map.push(i); }
  }
  map.push(s.length);
  return { norm, map };
}
function searchEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Text mit markierten Suchwörtern (alles escaped)
function searchHighlight(text, words) {
  const { norm, map } = searchNormMap(text);
  const ranges = [];
  words.forEach(w => {
    let from = 0, i;
    while (w && (i = norm.indexOf(w, from)) !== -1) { ranges.push([map[i], map[i + w.length]]); from = i + w.length; }
  });
  if (!ranges.length) return searchEsc(text);
  ranges.sort((a, b) => a[0] - b[0]);
  let out = '', pos = 0;
  ranges.forEach(([a, b]) => {
    if (a < pos) a = pos;
    if (b <= a) return;
    out += searchEsc(text.slice(pos, a)) + '<mark>' + searchEsc(text.slice(a, b)) + '</mark>';
    pos = b;
  });
  return out + searchEsc(text.slice(pos));
}
// Kurzer Auszug um den ersten Treffer im Inhalt
function searchExcerpt(text, words) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const { norm, map } = searchNormMap(flat);
  let hit = -1;
  words.forEach(w => { const i = norm.indexOf(w); if (i !== -1 && (hit === -1 || i < hit)) hit = i; });
  if (hit === -1) return '';
  const start = Math.max(0, map[hit] - 40);
  const end = Math.min(flat.length, map[hit] + 90);
  return (start > 0 ? '…' : '') + searchHighlight(flat.slice(start, end), words) + (end < flat.length ? '…' : '');
}

function searchActiveProviders() {
  const hidden = typeof hiddenTabs !== 'undefined' ? hiddenTabs : [];
  return searchProviders.filter(p => !p.view || !hidden.includes(p.view));
}

// Alle Einträge aller Quellen (pro Öffnen einmal gebaut)
function searchBuildIndex() {
  const index = [];
  searchActiveProviders().forEach(p => {
    let items = [];
    try { items = p.items() || []; } catch (e) { console.warn('[Suche] Quelle fehlgeschlagen:', p.id, e); }
    items.forEach(it => {
      if (!it || !it.title) return;
      index.push({
        ...it, provider: p,
        nTitle: searchNorm(it.title),
        nKeys: searchNorm([it.sub, ...(it.keywords || [])].filter(Boolean).join(' ')),
        nText: searchNorm(it.text || ''),
      });
    });
  });
  return index;
}

// Alle Wörter müssen irgendwo vorkommen; Titel zählt mehr als Inhalt
function searchScore(entry, words) {
  let score = 0;
  for (const w of words) {
    if (entry.nTitle.startsWith(w)) score += 100;
    else if (entry.nTitle.includes(w)) score += 60;
    else if (entry.nKeys.includes(w)) score += 30;
    else if (entry.nText.includes(w)) score += 10;
    else return 0;
  }
  return score - entry.nTitle.length * 0.05; // kürzere Titel minimal vorn
}

// ── UI ───────────────────────────────────────────────────────────────
let searchIndex = [];
let searchResults = [];   // flache Liste in Anzeige-Reihenfolge (für ↑↓)
let searchActive = 0;
let searchExpanded = new Set();
let searchReturnFocus = null;

function searchEnsureDom() {
  let overlay = document.getElementById('hub-search-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'hub-search-overlay';
  overlay.className = 'hub-search-backdrop hidden';
  overlay.innerHTML = `
    <div class="hub-search-box" role="dialog" aria-modal="true" aria-label="Suche">
      <div class="hub-search-field">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input id="hub-search-input" type="search" placeholder="In Nook suchen …" autocomplete="off" spellcheck="false"
               role="combobox" aria-expanded="true" aria-controls="hub-search-results" aria-autocomplete="list"/>
        <kbd class="hub-search-kbd">Esc</kbd>
      </div>
      <div id="hub-search-results" class="hub-search-results" role="listbox"></div>
      <div class="hub-search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> wählen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Strg</kbd>+<kbd>K</kbd> Suche</span></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) closeHubSearch(); });
  const input = overlay.querySelector('#hub-search-input');
  input.addEventListener('input', () => { searchExpanded.clear(); searchActive = 0; renderHubSearch(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); searchMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); searchMove(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = searchResults[searchActive]; if (r) searchOpen(r); }
    else if (e.key === 'Escape') { e.preventDefault(); closeHubSearch(); }
  });
  return overlay;
}

function openHubSearch() {
  const overlay = searchEnsureDom();
  searchReturnFocus = document.activeElement;
  searchIndex = searchBuildIndex();
  searchExpanded.clear();
  searchActive = 0;
  const input = overlay.querySelector('#hub-search-input');
  input.value = '';
  overlay.classList.remove('hidden');
  renderHubSearch();
  setTimeout(() => input.focus(), 0);
}
function closeHubSearch() {
  const overlay = document.getElementById('hub-search-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  overlay.classList.add('hidden');
  searchIndex = [];
  if (searchReturnFocus && document.contains(searchReturnFocus)) searchReturnFocus.focus?.();
}
function isHubSearchOpen() {
  const o = document.getElementById('hub-search-overlay');
  return !!o && !o.classList.contains('hidden');
}

function searchMove(delta) {
  if (!searchResults.length) return;
  searchActive = (searchActive + delta + searchResults.length) % searchResults.length;
  const box = document.getElementById('hub-search-results');
  box.querySelectorAll('.hub-search-item').forEach((el, i) => {
    el.classList.toggle('active', i === searchActive);
    el.setAttribute('aria-selected', i === searchActive ? 'true' : 'false');
  });
  box.querySelector('.hub-search-item.active')?.scrollIntoView({ block: 'nearest' });
}

function searchOpen(entry) {
  searchRecent = [{ p: entry.provider.id, id: entry.id }, ...searchRecent.filter(r => !(r.p === entry.provider.id && r.id === entry.id))].slice(0, SEARCH_RECENT_MAX);
  saveSearchRecent();
  closeHubSearch();
  try { entry.open(); } catch (e) { console.warn('[Suche] Öffnen fehlgeschlagen:', e); }
}

function searchItemHtml(entry, words, idx) {
  const excerpt = words.length && !entry.nTitle.includes(words[0]) ? searchExcerpt(entry.text, words) : '';
  return `
    <button type="button" class="hub-search-item${idx === searchActive ? ' active' : ''}" role="option"
            aria-selected="${idx === searchActive}" data-idx="${idx}">
      <span class="hub-search-item-icon" aria-hidden="true">${searchEsc(entry.icon || entry.provider.icon || '•')}</span>
      <span class="hub-search-item-main">
        <span class="hub-search-item-title">${words.length ? searchHighlight(entry.title, words) : searchEsc(entry.title)}</span>
        <span class="hub-search-item-sub">${searchEsc(entry.provider.label)}${entry.sub ? ' › ' + searchEsc(entry.sub) : ''}</span>
        ${excerpt ? `<span class="hub-search-item-excerpt">${excerpt}</span>` : ''}
      </span>
    </button>`;
}

function renderHubSearch() {
  const box = document.getElementById('hub-search-results');
  const q = document.getElementById('hub-search-input').value;
  const words = searchNorm(q).split(/\s+/).filter(Boolean);
  searchResults = [];
  let html = '';

  if (!words.length) {
    // Zuletzt geöffnet (nur noch vorhandene Einträge)
    const recent = searchRecent
      .map(r => searchIndex.find(e => e.provider.id === r.p && e.id === r.id))
      .filter(Boolean);
    if (recent.length) {
      html += `<div class="hub-search-group-label">Zuletzt geöffnet</div>`;
      recent.forEach(e => { html += searchItemHtml(e, [], searchResults.length); searchResults.push(e); });
    } else {
      html = `<div class="hub-search-empty">Suche in Anleitungen, Karteikarten, Projekten, Pinnwand, Kalender, Budget, Quests und Aufgaben.</div>`;
    }
  } else {
    const groups = new Map();
    searchIndex.forEach(e => {
      const s = searchScore(e, words);
      if (s <= 0) return;
      if (!groups.has(e.provider)) groups.set(e.provider, []);
      groups.get(e.provider).push({ e, s });
    });
    // Gruppen nach ihrem besten Treffer sortieren
    const ordered = [...groups.entries()]
      .map(([p, list]) => [p, list.sort((a, b) => b.s - a.s)])
      .sort((a, b) => b[1][0].s - a[1][0].s);
    ordered.forEach(([p, list]) => {
      const expanded = searchExpanded.has(p.id);
      const shown = expanded ? list : list.slice(0, SEARCH_PER_GROUP);
      html += `<div class="hub-search-group-label">${searchEsc(p.icon)} ${searchEsc(p.label)}</div>`;
      shown.forEach(({ e }) => { html += searchItemHtml(e, words, searchResults.length); searchResults.push(e); });
      if (!expanded && list.length > SEARCH_PER_GROUP) {
        html += `<button type="button" class="hub-search-more" data-provider="${searchEsc(p.id)}">+ ${list.length - SEARCH_PER_GROUP} weitere</button>`;
      }
    });
    if (!searchResults.length) html = `<div class="hub-search-empty">Nichts gefunden für „${searchEsc(q.trim())}“.</div>`;
  }
  if (searchActive >= searchResults.length) searchActive = 0;
  box.innerHTML = html;
  box.querySelectorAll('.hub-search-item').forEach(btn => {
    btn.addEventListener('click', () => searchOpen(searchResults[+btn.dataset.idx]));
    btn.addEventListener('pointermove', () => {
      const i = +btn.dataset.idx;
      if (i !== searchActive) { searchActive = i; searchMove(0); }
    });
  });
  box.querySelectorAll('.hub-search-more').forEach(btn => btn.addEventListener('click', () => {
    searchExpanded.add(btn.dataset.provider);
    renderHubSearch();
    document.getElementById('hub-search-input').focus();
  }));
}

// Strg/⌘ + K öffnet bzw. schließt — auch aus Eingabefeldern heraus
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    isHubSearchOpen() ? closeHubSearch() : openHubSearch();
  }
});

// ── Hilfen für die Öffnen-Sprünge der Quellen ────────────────────────
// Element nach dem Tab-Wechsel suchen, hinscrollen und kurz hervorheben
function searchFlashElement(selector, root = document) {
  setTimeout(() => {
    const el = typeof selector === 'string' ? root.querySelector(selector) : selector;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('hub-search-flash');
    void el.offsetWidth;
    el.classList.add('hub-search-flash');
    setTimeout(() => el.classList.remove('hub-search-flash'), 2200);
  }, 80);
}
