// =========================
// POSITIVITY — Tägliche positive Erinnerungen
// =========================

const POSITIVITY_DEFAULTS = [
  {
    id: 'cat-remember', name: 'Things To Remember', color: '#7A9B6A', builtIn: true,
    texts: [
      'Small steps are progress too.',
      'Asking for help is strength.',
      'Tomorrow is a new day.',
      "You don't have to be perfect.",
      'Your boundaries are important.',
      "It's okay to start over.",
      'Mistakes are part of learning.',
      'Progress is still progress.',
      'Rest is productive too.',
      'You are more than your achievements.',
    ]
  },
  {
    id: 'cat-selfcare', name: 'Self Care', color: '#7A94B8', builtIn: true,
    texts: [
      'Drink a glass of water.',
      'Relax your shoulders.',
      'Take three deep breaths.',
      'Stretch for one minute.',
      'Step away from the screen briefly.',
      "Check if you've eaten today.",
      'Rest your eyes for a moment.',
      'Sit comfortably.',
      'Take a short walk.',
      'Be gentle with yourself today.',
    ]
  },
  {
    id: 'cat-motivation', name: 'Motivation', color: '#C9975B', builtIn: true,
    texts: [
      'Start with five minutes.',
      'Done is better than perfect.',
      'One task at a time.',
      'Future you will thank you.',
      "Begin before you're ready.",
      'Progress beats waiting.',
      'Focus on the next step.',
      "You don't need perfect conditions.",
      'Consistency matters more than intensity.',
      'Keep going.',
    ]
  },
  { id: 'cat-personal', name: 'Persönliches', color: '#9A7FB8', builtIn: true, texts: [] },
];

function buildDefaultPositivityCategories() {
  return POSITIVITY_DEFAULTS.map(def => ({
    id: def.id,
    name: def.name,
    color: def.color,
    builtIn: def.builtIn,
    cards: def.texts.map(text => ({ id: crypto.randomUUID(), categoryId: def.id, text, favorite: false }))
  }));
}

let positivityCategories = DB.get('positivityCategories', null);
if (!positivityCategories) {
  positivityCategories = buildDefaultPositivityCategories();
  DB.set('positivityCategories', positivityCategories);
}

let positivityDaily = DB.get('positivityDaily', { date: null, cardId: null, pinned: false });
let positivityQueue = DB.get('positivityQueue', []);

function savePositivityCategories() { DB.set('positivityCategories', positivityCategories); }
function savePositivityDaily()      { DB.set('positivityDaily', positivityDaily); }
function savePositivityQueue()      { DB.set('positivityQueue', positivityQueue); }

// =========================
// ICONS (dezente Linien-Icons statt bunter Emojis)
// =========================

function positivityHeartIcon(active) {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="${active ? 'currentColor' : 'none'}" xmlns="http://www.w3.org/2000/svg"><path d="M8 13.4S2.6 10.2 2.6 6.3c0-1.8 1.4-3.2 3.2-3.2 1 0 1.9.5 2.2 1.3.3-.8 1.2-1.3 2.2-1.3 1.8 0 3.2 1.4 3.2 3.2 0 3.9-5.4 7.1-5.4 7.1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
}
function positivityPinIcon(active) {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="${active ? 'currentColor' : 'none'}" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5c-2.2 0-4 1.8-4 4 0 2.8 4 7 4 7s4-4.2 4-7c0-2.2-1.8-4-4-4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>${active ? '' : '<circle cx="8" cy="5.5" r="1.4" fill="currentColor"/>'}</svg>`;
}
const POSITIVITY_REFRESH_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.95" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M13.7 1.8v3.6h-3.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// =========================
// DATA HELPERS
// =========================

function allPositivityCards() {
  const out = [];
  positivityCategories.forEach(cat => cat.cards.forEach(card => out.push({ card, cat })));
  return out;
}
function findPositivityCard(cardId) {
  return allPositivityCards().find(r => r.card.id === cardId) || null;
}
function findPositivityCategory(catId) {
  return positivityCategories.find(c => c.id === catId) || null;
}

// =========================
// SHUFFLE-BAG ROTATION
// =========================

function refillPositivityQueue(excludeId) {
  const allIds = allPositivityCards().map(r => r.card.id);
  positivityQueue = positivityQueue.filter(id => allIds.includes(id));
  if (positivityQueue.length === 0 && allIds.length > 0) {
    let pool = [...allIds];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    if (excludeId && pool.length > 1 && pool[0] === excludeId) {
      const idx = pool.findIndex((id, i) => i > 0 && id !== excludeId);
      if (idx > 0) [pool[0], pool[idx]] = [pool[idx], pool[0]];
    }
    positivityQueue = pool;
  }
  savePositivityQueue();
}

function drawNextPositivityCardId(excludeId) {
  refillPositivityQueue(excludeId);
  if (positivityQueue.length === 0) return null;
  let id = positivityQueue.shift();
  if (id === excludeId && positivityQueue.length > 0) {
    positivityQueue.push(id);
    id = positivityQueue.shift();
  }
  savePositivityQueue();
  return id;
}

// =========================
// DAILY CARD LOGIC
// =========================

function ensureTodaysPositivityCard() {
  if (allPositivityCards().length === 0) return;
  const today = getTodayStr();

  // Festgepinnte Karte bleibt über Mitternacht hinweg bestehen
  if (positivityDaily.pinned && positivityDaily.cardId && findPositivityCard(positivityDaily.cardId)) {
    if (positivityDaily.date !== today) { positivityDaily.date = today; savePositivityDaily(); }
    return;
  }

  // Heutige Karte existiert bereits und ist gültig
  if (positivityDaily.date === today && positivityDaily.cardId && findPositivityCard(positivityDaily.cardId)) {
    return;
  }

  // Neue Karte ziehen (neuer Tag oder ungültige/gelöschte Karte)
  const newId = drawNextPositivityCardId(positivityDaily.cardId);
  positivityDaily = { date: today, cardId: newId, pinned: false };
  savePositivityDaily();
}

function refreshPositivityCard() {
  const excludeId = positivityDaily.cardId;
  const newId = drawNextPositivityCardId(excludeId);
  if (newId == null) return;
  positivityDaily = { date: getTodayStr(), cardId: newId, pinned: false };
  savePositivityDaily();
  renderPositivityWidget();
}

function togglePositivityPin() {
  positivityDaily.pinned = !positivityDaily.pinned;
  positivityDaily.date = getTodayStr();
  savePositivityDaily();
  renderPositivityWidget();
}

function togglePositivityFavorite(cardId) {
  const ref = findPositivityCard(cardId);
  if (!ref) return;
  ref.card.favorite = !ref.card.favorite;
  savePositivityCategories();
  renderPositivityWidget();
}

function deletePositivityCard(cardId) {
  positivityCategories.forEach(cat => { cat.cards = cat.cards.filter(c => c.id !== cardId); });
  savePositivityCategories();
  positivityQueue = positivityQueue.filter(id => id !== cardId);
  savePositivityQueue();
  if (positivityDaily.cardId === cardId) {
    const newId = drawNextPositivityCardId(cardId);
    positivityDaily = { date: getTodayStr(), cardId: newId, pinned: false };
    savePositivityDaily();
  }
  renderPositivityWidget();
}

// =========================
// SIDEBAR WIDGET
// =========================

function renderPositivityWidget() {
  ensureTodaysPositivityCard();
  const wrap = document.getElementById('sidebar-positivity');
  if (!wrap) return;

  const ref = positivityDaily.cardId ? findPositivityCard(positivityDaily.cardId) : null;
  if (!ref) { wrap.classList.add('hidden'); wrap.innerHTML = ''; return; }
  wrap.classList.remove('hidden');

  const { card, cat } = ref;
  const full = card.text || '';
  const display = full.length > 150 ? full.slice(0, 147) + '…' : full;

  wrap.innerHTML = `
    <div id="positivity-widget-card" style="--positivity-color:${cat.color}">
      <div class="positivity-widget-top">
        <span class="positivity-widget-dot"></span>
        <span class="positivity-widget-cat">${escHtml(cat.name)}</span>
      </div>
      <p class="positivity-widget-text">${escHtml(display)}</p>
      <div class="positivity-widget-actions">
        <button class="positivity-action-btn${card.favorite ? ' active' : ''}" id="positivity-fav-btn" title="${card.favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}">${positivityHeartIcon(card.favorite)}</button>
        <button class="positivity-action-btn${positivityDaily.pinned ? ' active' : ''}" id="positivity-pin-btn" title="${positivityDaily.pinned ? 'Lösen' : 'Heute festpinnen'}">${positivityPinIcon(positivityDaily.pinned)}</button>
        <button class="positivity-action-btn" id="positivity-refresh-btn" title="Neue Karte anzeigen">${POSITIVITY_REFRESH_ICON}</button>
      </div>
    </div>
  `;

  const cardEl = document.getElementById('positivity-widget-card');
  cardEl.addEventListener('click', e => {
    if (e.target.closest('.positivity-action-btn')) return;
    openPositivityCardModal(card.id);
  });
  document.getElementById('positivity-fav-btn').addEventListener('click', e => { e.stopPropagation(); togglePositivityFavorite(card.id); });
  document.getElementById('positivity-pin-btn').addEventListener('click', e => { e.stopPropagation(); togglePositivityPin(); });
  document.getElementById('positivity-refresh-btn').addEventListener('click', e => { e.stopPropagation(); refreshPositivityCard(); });
}

// =========================
// KARTEN-DETAIL MODAL
// =========================

let positivityModalCardId = null;

function openPositivityCardModal(cardId) {
  const ref = findPositivityCard(cardId);
  if (!ref) return;
  positivityModalCardId = cardId;
  renderPositivityCardModal();
  document.getElementById('positivity-card-modal-overlay').classList.remove('hidden');
}
function closePositivityCardModal() {
  document.getElementById('positivity-card-modal-overlay').classList.add('hidden');
  positivityModalCardId = null;
}
function renderPositivityCardModal() {
  const ref = findPositivityCard(positivityModalCardId);
  if (!ref) return;
  const { card, cat } = ref;
  const catEl = document.getElementById('positivity-card-modal-cat');
  catEl.textContent = cat.name;
  catEl.style.color = cat.color;
  document.getElementById('positivity-card-modal-text').textContent = card.text;

  const favBtn = document.getElementById('positivity-card-modal-fav');
  favBtn.innerHTML = positivityHeartIcon(card.favorite);
  favBtn.classList.toggle('active', card.favorite);
  favBtn.title = card.favorite ? 'Favorit entfernen' : 'Als Favorit markieren';

  const pinBtn = document.getElementById('positivity-card-modal-pin');
  const isTodaysCard = positivityDaily.cardId === card.id;
  const isPinned = isTodaysCard && positivityDaily.pinned;
  pinBtn.innerHTML = positivityPinIcon(isPinned);
  pinBtn.classList.toggle('active', isPinned);
  pinBtn.title = isPinned ? 'Lösen' : 'Heute festpinnen';
  pinBtn.style.display = isTodaysCard ? '' : 'none';
}

// =========================
// EINSTELLUNGEN — Kategorie-Übersicht
// =========================

function calcPositivityStats() {
  const perCat = positivityCategories.map(c => ({ id: c.id, name: c.name, color: c.color, count: c.cards.length }));
  const favCount = allPositivityCards().filter(r => r.card.favorite).length;
  const total = perCat.reduce((s, c) => s + c.count, 0);
  return { perCat, favCount, total };
}

function renderPositivitySettings() {
  const listEl = document.getElementById('positivity-category-list');
  if (!listEl) return;
  const totalEl = document.getElementById('positivity-total-count');
  const stats = calcPositivityStats();
  if (totalEl) totalEl.textContent = `Gesamt: ${stats.total} ${stats.total === 1 ? 'Karte' : 'Karten'}`;

  listEl.innerHTML = '';
  stats.perCat.forEach(cat => listEl.appendChild(buildPositivityCatRow(cat.id, cat.name, cat.color, cat.count, false)));
  listEl.appendChild(buildPositivityCatRow('favorites', 'Favoriten', null, stats.favCount, true));
}

function buildPositivityCatRow(catId, name, color, count, isFavorites) {
  const row = document.createElement('div');
  row.className = 'positivity-cat-row';
  row.innerHTML = `
    <span class="positivity-cat-dot${isFavorites ? ' is-fav' : ''}" style="${isFavorites ? '' : `background:${color}`}">${isFavorites ? '★' : ''}</span>
    <span class="positivity-cat-name">${escHtml(name)}</span>
    <span class="positivity-cat-count">(${count})</span>
    <button class="icon-btn positivity-cat-menu-btn" title="Menü">☰</button>
  `;
  row.addEventListener('click', e => {
    if (e.target.closest('.positivity-cat-menu-btn')) return;
    openPositivityCardListModal(catId);
  });
  row.querySelector('.positivity-cat-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    openPositivityCatMenu(catId, e.currentTarget);
  });
  return row;
}

// =========================
// KATEGORIE-MENÜ (Burger, fixed-position gegen Clipping)
// =========================

let positivityMenuCatId = null;

function openPositivityCatMenu(catId, btnEl) {
  positivityMenuCatId = catId;
  const menu = document.getElementById('positivity-cat-menu');
  const isFav = catId === 'favorites';
  menu.querySelectorAll('.positivity-cat-menu-item').forEach(item => {
    item.style.display = isFav ? (item.dataset.action === 'export' ? '' : 'none') : '';
  });
  menu.classList.remove('hidden');
  const rect = btnEl.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.left = `${Math.max(8, rect.right - menu.offsetWidth)}px`;
  requestAnimationFrame(() => {
    const w = menu.offsetWidth;
    let left = rect.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    menu.style.left = `${left}px`;
  });
}
function closePositivityCatMenu() {
  document.getElementById('positivity-cat-menu').classList.add('hidden');
  positivityMenuCatId = null;
}
document.addEventListener('click', e => {
  const menu = document.getElementById('positivity-cat-menu');
  if (menu && !menu.classList.contains('hidden')) {
    if (!menu.contains(e.target) && !e.target.closest('.positivity-cat-menu-btn')) closePositivityCatMenu();
  }
});

// =========================
// KATEGORIE BEARBEITEN
// =========================

let positivityEditCatId = null;

function openPositivityCatEditModal(catId) {
  const cat = findPositivityCategory(catId);
  if (!cat) return;
  positivityEditCatId = catId;
  document.getElementById('positivity-cat-edit-name').value = cat.name;
  document.getElementById('positivity-cat-edit-color').value = cat.color;
  document.getElementById('positivity-cat-edit-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('positivity-cat-edit-name').focus(), 50);
}
function closePositivityCatEditModal() {
  document.getElementById('positivity-cat-edit-overlay').classList.add('hidden');
  positivityEditCatId = null;
}

// =========================
// KARTEN VERWALTEN (Liste, Neu erstellen, Löschen)
// =========================

let positivityCardsModalCatId = null;

function openPositivityCardListModal(catId, focusNew) {
  positivityCardsModalCatId = catId;
  const isFav = catId === 'favorites';
  const titleEl = document.getElementById('positivity-cards-modal-title');
  const newRow  = document.getElementById('positivity-new-card-row');

  if (isFav) {
    titleEl.textContent = 'Favoriten';
    newRow.style.display = 'none';
  } else {
    const cat = findPositivityCategory(catId);
    titleEl.textContent = cat ? cat.name : '';
    newRow.style.display = '';
    document.getElementById('positivity-new-card-input').value = '';
    updatePositivityCharCount();
  }
  renderPositivityCardsList();
  document.getElementById('positivity-cards-overlay').classList.remove('hidden');
  if (focusNew && !isFav) setTimeout(() => document.getElementById('positivity-new-card-input').focus(), 50);
}
function closePositivityCardListModal() {
  document.getElementById('positivity-cards-overlay').classList.add('hidden');
  positivityCardsModalCatId = null;
  renderPositivitySettings();
}

function renderPositivityCardsList() {
  const listEl = document.getElementById('positivity-cards-list');
  listEl.innerHTML = '';
  const isFav = positivityCardsModalCatId === 'favorites';

  let rows;
  if (isFav) {
    rows = allPositivityCards().filter(r => r.card.favorite);
  } else {
    const cat = findPositivityCategory(positivityCardsModalCatId);
    rows = cat ? cat.cards.map(card => ({ card, cat })) : [];
  }

  if (rows.length === 0) {
    listEl.innerHTML = `<div class="empty-state">${isFav ? 'Noch keine Favoriten.' : 'Noch keine Karten in dieser Kategorie.'}</div>`;
    return;
  }

  rows.forEach(({ card, cat }) => {
    const row = document.createElement('div');
    row.className = 'positivity-card-row';
    row.innerHTML = `
      <span class="positivity-card-row-dot" style="background:${cat.color}"></span>
      <span class="positivity-card-row-text">${escHtml(card.text)}</span>
      <button class="positivity-action-btn small${card.favorite ? ' active' : ''}" title="${card.favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}">${positivityHeartIcon(card.favorite)}</button>
      ${isFav ? '' : '<button class="task-delete" title="Löschen">✕</button>'}
    `;
    row.querySelector('.positivity-action-btn').addEventListener('click', () => {
      togglePositivityFavorite(card.id);
      renderPositivityCardsList();
    });
    const delBtn = row.querySelector('.task-delete');
    if (delBtn) delBtn.addEventListener('click', () => {
      if (!confirm('Diese Karte löschen?')) return;
      deletePositivityCard(card.id);
      renderPositivityCardsList();
    });
    listEl.appendChild(row);
  });
}

function updatePositivityCharCount() {
  const input = document.getElementById('positivity-new-card-input');
  const counter = document.getElementById('positivity-char-count');
  if (!input || !counter) return;
  counter.textContent = `${input.value.length} / 150`;
}

function addPositivityCard() {
  if (positivityCardsModalCatId === 'favorites') return;
  const input = document.getElementById('positivity-new-card-input');
  const text = input.value.trim().slice(0, 150);
  if (!text) return;
  const cat = findPositivityCategory(positivityCardsModalCatId);
  if (!cat) return;
  const newCard = { id: crypto.randomUUID(), categoryId: cat.id, text, favorite: false };
  cat.cards.push(newCard);
  savePositivityCategories();
  positivityQueue.push(newCard.id);
  savePositivityQueue();
  input.value = '';
  updatePositivityCharCount();
  renderPositivityCardsList();
}

// =========================
// EXPORT / IMPORT
// =========================

function exportPositivityCategory(catId) {
  let name, cards;
  if (catId === 'favorites') {
    name = 'Favoriten';
    cards = allPositivityCards().filter(r => r.card.favorite).map(r => ({ text: r.card.text }));
  } else {
    const cat = findPositivityCategory(catId);
    if (!cat) return;
    name = cat.name;
    cards = cat.cards.map(c => ({ text: c.text }));
  }
  const data = { category: name, cards, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `positivity-${name.toLowerCase().replace(/\s+/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

let positivityImportTargetCatId = null;

function triggerPositivityImport(catId) {
  if (catId === 'favorites') return;
  positivityImportTargetCatId = catId;
  document.getElementById('positivity-import-input').click();
}

// =========================
// INIT — Event-Wiring (läuft einmal beim Laden des Scripts)
// =========================

function initPositivity() {
  // Karten-Detail Modal
  document.getElementById('positivity-card-modal-close').addEventListener('click', closePositivityCardModal);
  document.getElementById('positivity-card-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('positivity-card-modal-overlay')) closePositivityCardModal();
  });
  document.getElementById('positivity-card-modal-fav').addEventListener('click', () => {
    togglePositivityFavorite(positivityModalCardId);
    renderPositivityCardModal();
  });
  document.getElementById('positivity-card-modal-pin').addEventListener('click', () => {
    if (positivityDaily.cardId === positivityModalCardId) { togglePositivityPin(); renderPositivityCardModal(); }
  });

  // Kategorie-Menü
  document.querySelectorAll('#positivity-cat-menu .positivity-cat-menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const catId = positivityMenuCatId;
      closePositivityCatMenu();
      if (action === 'edit')   openPositivityCatEditModal(catId);
      if (action === 'new')    openPositivityCardListModal(catId, true);
      if (action === 'export') exportPositivityCategory(catId);
      if (action === 'import') triggerPositivityImport(catId);
    });
  });

  // Kategorie bearbeiten Modal
  document.getElementById('positivity-cat-edit-close').addEventListener('click', closePositivityCatEditModal);
  document.getElementById('positivity-cat-edit-cancel').addEventListener('click', closePositivityCatEditModal);
  document.getElementById('positivity-cat-edit-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('positivity-cat-edit-overlay')) closePositivityCatEditModal();
  });
  document.getElementById('positivity-cat-edit-save').addEventListener('click', () => {
    const cat = findPositivityCategory(positivityEditCatId);
    if (!cat) return;
    const name = document.getElementById('positivity-cat-edit-name').value.trim();
    if (!name) { document.getElementById('positivity-cat-edit-name').focus(); return; }
    cat.name  = name;
    cat.color = document.getElementById('positivity-cat-edit-color').value;
    savePositivityCategories();
    closePositivityCatEditModal();
    renderPositivitySettings();
    renderPositivityWidget();
  });

  // Karten verwalten Modal
  document.getElementById('positivity-cards-modal-close').addEventListener('click', closePositivityCardListModal);
  document.getElementById('positivity-cards-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('positivity-cards-overlay')) closePositivityCardListModal();
  });
  document.getElementById('positivity-new-card-input').addEventListener('input', updatePositivityCharCount);
  document.getElementById('positivity-new-card-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addPositivityCard(); }
  });
  document.getElementById('positivity-new-card-add').addEventListener('click', addPositivityCard);

  // Import
  document.getElementById('positivity-import-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const cat = findPositivityCategory(positivityImportTargetCatId);
        if (!cat || !Array.isArray(data.cards)) { alert('Ungültige Datei.'); return; }
        const existingTexts = new Set(cat.cards.map(c => c.text));
        let added = 0;
        data.cards.forEach(item => {
          const text = (item.text || '').toString().trim().slice(0, 150);
          if (!text || existingTexts.has(text)) return;
          const newCard = { id: crypto.randomUUID(), categoryId: cat.id, text, favorite: false };
          cat.cards.push(newCard);
          positivityQueue.push(newCard.id);
          existingTexts.add(text);
          added++;
        });
        savePositivityCategories();
        savePositivityQueue();
        renderPositivitySettings();
        renderPositivityCardsList();
        alert(`${added} ${added === 1 ? 'Karte' : 'Karten'} importiert.`);
      } catch {
        alert('Ungültige Backup-Datei.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Mitternacht-Rollover: einmal pro Minute prüfen, ob ein neuer Tag begonnen hat
  setInterval(renderPositivityWidget, 60000);
}

initPositivity();
renderPositivityWidget();
