// =========================
// PINBOARD — Tab: Pinnwand
// Eigenständige Hauptseite für das Kartensystem (früher Teil von Today).
// 3 unabhängige Spalten (Masonry-Prinzip). Jede Karte kennt Spalte, Stil,
// Farbe und optionale feste Höhe (Resize-Handle, persistiert). Ersetzt die
// früheren Einzelsysteme (notes/customTiles/generalTodos/shoppingList/
// berichtsheft), die nur noch als einmalige Migrationsquelle dienen.
// =========================

// deskCards war in today.js zuvor ohne eigene Deklaration im globalen Scope
// unterwegs — hier bekommt es einen sauberen, eigenen Besitzer.
let deskCards = DB.get('deskCards', null);

const DESK_STYLE_DESC = {
  standard:  'Freies Textfeld, wie die Schnellnotiz.',
  pinned:    'Bleibt immer ganz oben in der Spalte.',
  important: 'Auffälliger, mit größerem Titel.',
  code:      'Für Code und Terminalbefehle.',
  checklist: 'Kästchen zum Abhaken, mit Fortschritt.',
  quote:     'Ein einzelner, groß gesetzter Satz.',
};

function saveDeskCards() { DB.set('deskCards', deskCards); }

// ---- Einmalige Migration der alten Einzelsysteme in deskCards ----
function migrateDeskCardsIfNeeded() {
  if (deskCards) return;
  const cards = [];
  let col = 0;
  const orderInCol = [0, 0, 0];
  const push = (partial) => {
    cards.push(Object.assign({
      id: crypto.randomUUID(), title: '', style: 'standard', color: HUB_PALETTE_HEX[0],
      column: col, order: orderInCol[col], height: null,
      content: '', items: [], hideCompleted: false, betrieb: '', schule: '',
    }, partial));
    orderInCol[col]++;
    col = (col + 1) % 3;
  };

  const toItems = arr => (arr || []).map(x => typeof x === 'string' ? { id: crypto.randomUUID(), text: x, done: false } : x);
  const oldDesigns = DB.get('tileDesigns', {});
  const oldColor = (id, fallback) => (oldDesigns[id] && oldDesigns[id].color) || fallback;

  push({ id: 'builtin-wichtiges',    title: 'Wichtiges',                 style: 'checklist',    items: toItems(notes['exam-notes']),      color: oldColor('builtin-wichtiges', '#A3B18A') });
  push({ id: 'builtin-todo',         title: 'To Do',                     style: 'checklist',    items: toItems(generalTodos),              color: oldColor('builtin-todo', '#EBE4D4') });
  push({ id: 'builtin-berichtsheft', title: 'Berichtsheft',              style: 'berichtsheft', betrieb: berichtsheft.betrieb || '', schule: berichtsheft.schule || '', color: oldColor('builtin-berichtsheft', '#C0AC99') });
  push({ id: 'builtin-fragen',       title: 'Fragen für den Unterricht', style: 'checklist',    items: toItems(notes['class-questions']), color: oldColor('builtin-fragen', '#A3B18A') });
  push({ id: 'builtin-shopping',     title: 'Einkaufsliste',             style: 'checklist',    items: toItems(shoppingList),              color: oldColor('builtin-shopping', '#EBE4D4') });
  push({ id: 'builtin-begriffe',     title: 'Begriffe & Definitionen',   style: 'checklist',    items: toItems(notes['terms']),            color: oldColor('builtin-begriffe', '#C0AC99') });

  (customTiles || []).forEach(tile => {
    push({
      id: tile.id, title: tile.title,
      style: tile.type === 'list' ? 'checklist' : 'standard',
      content: tile.content || '', items: toItems(tile.items),
      color: tile.color || oldColor(tile.id, HUB_PALETTE_HEX[0]),
    });
  });

  deskCards = cards;
  saveDeskCards();
}
migrateDeskCardsIfNeeded();

// ---- Kontrastfarbe für Titel/Text auf beliebiger Kartenfarbe ----
function deskTextColor(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return null;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#3D3626' : '#F5F1E6';
}

// ---- Sortierung: Angepinnt zuerst, sonst nach gespeicherter Reihenfolge ----
function sortedDeskCards(col) {
  return deskCards
    .filter(c => c.column === col)
    .sort((a, b) => {
      const pa = a.style === 'pinned' ? 0 : 1, pb = b.style === 'pinned' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (a.order || 0) - (b.order || 0);
    });
}

function renderDesk() {
  for (let i = 0; i < 3; i++) {
    const colEl = document.getElementById('desk-col-' + i);
    if (!colEl) continue;
    colEl.innerHTML = '';
    sortedDeskCards(i).forEach(card => colEl.appendChild(buildDeskCardEl(card)));
  }
}

const DESK_STYLE_ICON = { pinned: '📌 ', important: '⭐ ' };

function buildDeskCardEl(card) {
  const el = document.createElement('div');
  el.className = `panel today-tile desk-card desk-card--${card.style}`;
  el.dataset.id = card.id;
  el.style.background = card.color || '';
  const fg = deskTextColor(card.color);
  if (fg) el.style.setProperty('--card-fg', fg);
  if (card.height) el.style.height = card.height + 'px';

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header desk-card-header';
  const title = document.createElement('span');
  title.className = 'desk-card-title';
  title.textContent = (DESK_STYLE_ICON[card.style] || '') + card.title;
  title.title = card.title;
  const actions = document.createElement('div');
  actions.className = 'desk-card-actions';

  if (card.style === 'checklist') {
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'icon-btn';
    eyeBtn.title = card.hideCompleted ? 'Erledigte einblenden' : 'Erledigte ausblenden';
    eyeBtn.textContent = card.hideCompleted ? '🙈' : '👁';
    eyeBtn.addEventListener('click', () => { card.hideCompleted = !card.hideCompleted; saveDeskCards(); renderDesk(); });
    actions.appendChild(eyeBtn);

    const addBtn = document.createElement('button');
    addBtn.className = 'icon-btn'; addBtn.textContent = '+'; addBtn.title = 'Eintrag hinzufügen';
    addBtn.addEventListener('click', () => openAddItemModal(card.id));
    actions.appendChild(addBtn);
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'desk-edit-btn'; editBtn.title = 'Karte bearbeiten'; editBtn.innerHTML = '✎';
  editBtn.addEventListener('click', () => openDeskCardModal(card.id));
  actions.appendChild(editBtn);

  header.append(title, actions);
  el.appendChild(header);

  // Body (stilabhängig)
  const body = document.createElement('div');
  body.className = 'desk-card-body';
  buildDeskCardBody(body, card);
  el.appendChild(body);

  // Resize-Handle — Kartenhöhe frei ziehbar, wird persistiert
  const handle = document.createElement('div');
  handle.className = 'desk-resize-handle';
  handle.title = 'Höhe ziehen';
  wireDeskResize(handle, card, el);
  el.appendChild(handle);

  return el;
}

function buildDeskCardBody(body, card) {
  switch (card.style) {
    case 'checklist': {
      const ul = document.createElement('ul'); ul.className = 'checklist';
      const items = card.items || [];
      const visible = items.filter(it => !(card.hideCompleted && it.done));
      visible.forEach(item => {
        const li = document.createElement('li'); li.className = 'checklist-item' + (item.done ? ' done' : '');
        const cbWrap = makePaperCbElement(item.done, card.color, () => {
          item.done = !item.done; saveDeskCards(); renderDesk();
        });
        const span = document.createElement('span'); span.textContent = item.text;
        const del = document.createElement('button'); del.className = 'note-del'; del.textContent = '✕';
        del.addEventListener('click', () => { card.items = card.items.filter(i => i !== item); saveDeskCards(); renderDesk(); });
        li.append(cbWrap, span, del); ul.appendChild(li);
      });
      if (visible.length === 0) {
        const empty = document.createElement('div'); empty.className = 'empty-state';
        empty.textContent = items.length ? 'Alle Punkte erledigt.' : 'Noch keine Einträge.';
        ul.appendChild(empty);
      }
      body.appendChild(ul);
      break;
    }
    case 'code': {
      const ta = document.createElement('textarea');
      ta.className = 'desk-textarea'; ta.value = card.content || ''; ta.placeholder = 'Code eingeben...'; ta.spellcheck = false;
      ta.addEventListener('input', () => { card.content = ta.value; saveDeskCards(); });
      const copyBtn = document.createElement('button');
      copyBtn.className = 'desk-code-copy'; copyBtn.type = 'button'; copyBtn.title = 'Kopieren';
      const iconCopy = '<svg viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 11V3a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      const iconDone = '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      copyBtn.innerHTML = iconCopy;
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(ta.value).then(() => {
          copyBtn.innerHTML = iconDone;
          setTimeout(() => { copyBtn.innerHTML = iconCopy; }, 1500);
        });
      });
      body.append(ta, copyBtn);
      break;
    }
    case 'berichtsheft': {
      const wrap = document.createElement('div'); wrap.className = 'desk-berichtsheft-grid';
      const mk = (label, field, placeholder) => {
        const colEl = document.createElement('div'); colEl.className = 'desk-bericht-col';
        const lab = document.createElement('div'); lab.className = 'desk-bericht-col-label'; lab.textContent = label;
        const ta = document.createElement('textarea'); ta.value = card[field] || ''; ta.placeholder = placeholder;
        let timer;
        ta.addEventListener('input', () => {
          card[field] = ta.value;
          clearTimeout(timer);
          timer = setTimeout(saveDeskCards, 400);
        });
        colEl.append(lab, ta);
        return colEl;
      };
      wrap.append(
        mk('Betrieb', 'betrieb', 'Was habe ich heute im Betrieb gemacht?'),
        mk('Schule', 'schule', 'Was haben wir heute in der Schule behandelt?')
      );
      body.appendChild(wrap);
      break;
    }
    default: { // standard, pinned, important, quote — alle ein freies Textfeld
      const ta = document.createElement('textarea');
      ta.className = 'desk-textarea'; ta.value = card.content || ''; ta.placeholder = 'Notizen...';
      ta.addEventListener('input', () => { card.content = ta.value; saveDeskCards(); });
      body.appendChild(ta);
    }
  }
}

// ---- Kartenhöhe per Resize-Handle ziehen — wird in deskCards.height persistiert ----
function wireDeskResize(handle, card, cardEl) {
  let startY = 0, startH = 0;
  function move(e) {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    cardEl.style.height = Math.max(90, startH + (y - startY)) + 'px';
  }
  function up() {
    handle.classList.remove('resizing');
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', up);
    const h = parseInt(cardEl.style.height, 10);
    if (h && h !== card.height) { card.height = h; saveDeskCards(); }
  }
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    handle.classList.add('resizing');
    startY = e.clientY; startH = cardEl.getBoundingClientRect().height;
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
  handle.addEventListener('touchstart', e => {
    handle.classList.add('resizing');
    startY = e.touches[0].clientY; startH = cardEl.getBoundingClientRect().height;
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  }, { passive: true });
}

// ---- Eintrag zu einer Checklisten-Karte hinzufügen (nutzt das bestehende Notiz-Modal) ----
let deskAddItemCardId = null;
function openAddItemModal(cardId) {
  deskAddItemCardId = cardId;
  const card = deskCards.find(c => c.id === cardId); if (!card) return;
  document.getElementById('note-modal-title').textContent = `${card.title} — Eintrag hinzufügen`;
  document.getElementById('note-modal-input').value = '';
  document.getElementById('note-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('note-modal-input').focus(), 50);
}
function closeAddItemModal() { document.getElementById('note-modal-overlay').classList.add('hidden'); deskAddItemCardId = null; }

document.getElementById('note-modal-close').addEventListener('click', closeAddItemModal);
document.getElementById('note-modal-cancel').addEventListener('click', closeAddItemModal);
document.getElementById('note-modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('note-modal-overlay')) closeAddItemModal(); });
document.getElementById('note-modal-save').addEventListener('click', () => {
  const text = document.getElementById('note-modal-input').value.trim();
  if (!text || !deskAddItemCardId) return;
  const card = deskCards.find(c => c.id === deskAddItemCardId); if (!card) return;
  if (!card.items) card.items = [];
  card.items.push({ id: crypto.randomUUID(), text, done: false });
  saveDeskCards(); renderDesk(); closeAddItemModal();
});

// ---- Karte erstellen / bearbeiten ----
let editingDeskCardId = null;
let selectedDeskStyle = 'standard';
let selectedDeskColumn = 0;
const deskColorWidget = initColorPickerWidget(
  { pickerId: 'tile-modal-color', previewId: 'tile-modal-color-preview', addBtnId: 'tile-modal-color-add-btn', libraryId: 'tile-modal-color-library' },
  { initial: HUB_PALETTE_HEX[0] }
);

function openDeskCardModal(cardId) {
  editingDeskCardId = cardId || null;
  const card = editingDeskCardId ? deskCards.find(c => c.id === editingDeskCardId) : null;

  document.getElementById('tile-modal-head-title').textContent = card ? 'Karte bearbeiten' : 'Neue Karte';
  document.getElementById('tile-modal-title').value = card ? card.title : '';
  document.getElementById('tile-modal-save').textContent = card ? 'Speichern' : 'Erstellen';
  document.getElementById('tile-modal-delete-btn').style.display = card ? 'inline-flex' : 'none';

  selectedDeskStyle = card ? card.style : 'standard';
  selectedDeskColumn = card ? card.column : 0;

  // Berichtsheft hat einen festen Aufbau — kein Stil-Wechsel möglich
  const isBericht = !!card && card.style === 'berichtsheft';
  const picker = document.getElementById('tile-type-picker');
  const desc = document.getElementById('tile-type-desc');
  picker.style.display = isBericht ? 'none' : 'grid';
  desc.style.display = isBericht ? 'none' : 'block';
  if (!isBericht) {
    document.querySelectorAll('.tile-type-btn').forEach(b => b.classList.toggle('active', b.dataset.style === selectedDeskStyle));
    desc.textContent = DESK_STYLE_DESC[selectedDeskStyle] || '';
  }

  document.querySelectorAll('#tile-modal-column-picker .toggle-select-btn')
    .forEach(b => b.classList.toggle('active', Number(b.dataset.col) === selectedDeskColumn));

  deskColorWidget.setValue(card ? (card.color || HUB_PALETTE_HEX[0]) : HUB_PALETTE_HEX[0]);

  document.getElementById('tile-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('tile-modal-title').focus(), 50);
}
function closeDeskCardModal() { document.getElementById('tile-modal-overlay').classList.add('hidden'); editingDeskCardId = null; }

document.getElementById('add-tile-btn').addEventListener('click', () => openDeskCardModal(null));
document.getElementById('tile-modal-close').addEventListener('click', closeDeskCardModal);
document.getElementById('tile-modal-cancel').addEventListener('click', closeDeskCardModal);
document.getElementById('tile-modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('tile-modal-overlay')) closeDeskCardModal(); });

document.querySelectorAll('.tile-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedDeskStyle = btn.dataset.style;
    document.querySelectorAll('.tile-type-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('tile-type-desc').textContent = DESK_STYLE_DESC[selectedDeskStyle] || '';
  });
});
document.querySelectorAll('#tile-modal-column-picker .toggle-select-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedDeskColumn = Number(btn.dataset.col);
    document.querySelectorAll('#tile-modal-column-picker .toggle-select-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});

function nextDeskOrder(col) {
  const inCol = deskCards.filter(c => c.column === col);
  return inCol.length ? Math.max(...inCol.map(c => c.order || 0)) + 1 : 0;
}

document.getElementById('tile-modal-save').addEventListener('click', () => {
  const title = document.getElementById('tile-modal-title').value.trim();
  if (!title) return;
  const color = deskColorWidget.getValue();

  if (editingDeskCardId) {
    const card = deskCards.find(c => c.id === editingDeskCardId); if (!card) return;
    card.title = title;
    card.color = color;
    if (card.style !== 'berichtsheft') card.style = selectedDeskStyle;
    card.column = selectedDeskColumn;
  } else {
    deskCards.push({
      id: crypto.randomUUID(), title, style: selectedDeskStyle, color,
      column: selectedDeskColumn, order: nextDeskOrder(selectedDeskColumn), height: null,
      content: '', items: [], hideCompleted: false, betrieb: '', schule: '',
    });
  }
  saveDeskCards();
  closeDeskCardModal();
  renderDesk();
});

document.getElementById('tile-modal-delete-btn').addEventListener('click', () => {
  if (!editingDeskCardId) return;
  if (!confirm('Diese Karte wirklich löschen?')) return;
  deskCards = deskCards.filter(c => c.id !== editingDeskCardId);
  saveDeskCards();
  closeDeskCardModal();
  renderDesk();
});

// =========================
// PAPER CHECKBOX — Bullet-Journal-Stil
// Ersetzt native <input type="checkbox"> durch kreisförmige Papier-Marker.
// Wird ausschließlich von Checklisten-Karten genutzt.
// =========================

// Berechnet Kreis-Akzentfarbe passend zur Kachelfarbe
function paperCbColor(bg) {
  if (!bg || bg === '#EBE4D4') return { ring: 'rgba(120,100,60,0.30)', check: 'rgba(80,65,35,0.70)', fill: 'rgba(120,100,60,0.12)' };
  if (bg === '#A3B18A')        return { ring: 'rgba(50,75,35,0.32)',  check: 'rgba(45,68,28,0.75)', fill: 'rgba(50,75,35,0.14)' };
  if (bg === '#C0AC99')        return { ring: 'rgba(90,65,40,0.30)',  check: 'rgba(75,50,30,0.72)', fill: 'rgba(90,65,40,0.12)' };
  // Fallback für andere Farben: nimm text-3-ähnliche Töne
  return { ring: 'rgba(100,85,65,0.30)', check: 'rgba(70,55,40,0.72)', fill: 'rgba(100,85,65,0.12)' };
}

function buildPaperCb(done, bg) {
  const c = paperCbColor(bg);
  if (done) {
    // Gefüllter Kreis mit Haken
    return `<span class="paper-cb paper-cb--done" aria-label="erledigt">
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8.5" cy="8.5" r="7.5" fill="${c.fill}" stroke="${c.ring}" stroke-width="1.2"/>
        <polyline points="4.5,8.5 7.5,11.5 12.5,6" stroke="${c.check}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
  } else {
    // Leerer Kreis
    return `<span class="paper-cb" aria-label="offen">
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8.5" cy="8.5" r="7.5" fill="none" stroke="${c.ring}" stroke-width="1.2"/>
      </svg>
    </span>`;
  }
}

function makePaperCbElement(done, bg, onToggle) {
  const wrap = document.createElement('span');
  wrap.className = 'paper-cb-wrap';
  wrap.innerHTML = buildPaperCb(done, bg);
  wrap.addEventListener('click', (e) => { e.stopPropagation(); onToggle(); });
  return wrap;
}

// =========================
// INIT
// Läuft einmalig beim Laden des Scripts (wie zuvor in today.js) —
// Karten werden unabhängig davon vorbereitet, welche View gerade aktiv ist.
// =========================
renderDesk();
