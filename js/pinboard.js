// =========================
// PINBOARD — Tab: Pinnwand
// Eigenständige Hauptseite für das Kartensystem (früher Teil von Today).
// 3 unabhängige Spalten (Masonry-Prinzip). Jede Karte kennt Spalte, Stil,
// Farbe und optionale feste Höhe (Resize-Handle, persistiert). Ersetzt die
// früheren Einzelsysteme (notes/customTiles/generalTodos/shoppingList/
// berichtsheft), die nur noch als einmalige Migrationsquelle dienen.
// Design-Vertrag: AI documentation/pinboard.md
// =========================

// deskCards, notes, generalTodos, berichtsheft, shoppingList und customTiles
// sind globaler State aus main.js — hier nur mitbenutzt, nicht neu deklariert.

const DESK_STYLE_DESC = {
  standard:  'Freies Textfeld, wie die Schnellnotiz.',
  pinned:    'Bleibt immer ganz oben in der Spalte.',
  code:     'Für Code und Terminalbefehle.',
  checklist: 'Kästchen zum Abhaken, mit Fortschritt.',
  quote:     'Ein einzelner, groß gesetzter Satz.',
  berichtsheft: 'Zwei feste Felder: Betrieb und Schule.',
};

const DESK_SCROLLERS = '.desk-card-body, .checklist, textarea';
const DESK_LEGACY_KEYS = ['notes', 'generalTodos', 'berichtsheft', 'shoppingList', 'customTiles', 'tileDesigns'];

// ---- Speichern ----
// Karten liegen gemeinsam unter einem Key. Sync (js/sync.js) schreibt neuere
// Stände anderer Geräte direkt in den Speicher, deskCards bleibt dabei alt.
// Deshalb führt jedes Speichern fremde Änderungen pro Karte zusammen, statt
// sie mit dem alten Array zu überschreiben. Grundlage ist deskCardsBase, der
// Stand beim letzten Laden/Speichern. Ändern beide dieselbe Karte, gewinnt
// die lokale Fassung; eine fremd geänderte Karte wird nie lokal gelöscht.

// Vergleich unabhängig von der Reihenfolge der Felder (jsonb in Supabase
// sortiert sie um, ohne dass sich inhaltlich etwas geändert hätte).
function deskCardFingerprint(value) {
  return JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.keys(v).sort().reduce((o, k) => { o[k] = v[k]; return o; }, {})
    : v);
}
function deskCardsSnapshot(cards) {
  return new Map((cards || []).map(c => [c.id, deskCardFingerprint(c)]));
}
let deskCardsBase = deskCardsSnapshot(deskCards);

function mergeExternalDeskCards() {
  const stored = DB.get('deskCards', null);
  if (!Array.isArray(stored)) return false;
  let changed = false;
  const storedIds = new Set();
  stored.forEach(theirs => {
    storedIds.add(theirs.id);
    const base = deskCardsBase.get(theirs.id);
    if (deskCardFingerprint(theirs) === base) return; // extern unverändert
    const mine = deskCards.find(c => c.id === theirs.id);
    if (!mine) { deskCards.push(theirs); changed = true; return; }
    if (deskCardFingerprint(mine) !== base) return;   // beide geändert: lokal gewinnt
    // Im selben Objekt ersetzen — Listener gerenderter Karten halten es fest
    Object.keys(mine).forEach(k => delete mine[k]);
    Object.assign(mine, theirs);
    changed = true;
  });
  deskCardsBase.forEach((base, id) => {
    if (storedIds.has(id)) return;
    const mine = deskCards.find(c => c.id === id);
    if (mine && deskCardFingerprint(mine) === base) {
      deskCards = deskCards.filter(c => c !== mine);
      changed = true;
    }
  });
  return changed;
}

let deskSaveTimer = null;
function saveDeskCards() {
  clearTimeout(deskSaveTimer);
  deskSaveTimer = null;
  const merged = mergeExternalDeskCards();
  DB.set('deskCards', deskCards);
  deskCardsBase = deskCardsSnapshot(deskCards);
  if (merged) renderDesk();
}
// Für Texteingaben: nicht jeder Tastendruck schreibt und lädt alle Karten hoch
function saveDeskCardsSoon() {
  clearTimeout(deskSaveTimer);
  deskSaveTimer = setTimeout(saveDeskCards, 400);
}
function flushDeskCards() {
  if (deskSaveTimer !== null) saveDeskCards();
}
window.addEventListener('pagehide', flushDeskCards);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushDeskCards(); });

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

  // Alt-Keys sind ab hier nur noch Migrationsquelle — nichts im Code liest
  // oder schreibt sie danach noch. Nach erfolgreicher Migration aufräumen,
  // statt sie als Datenmüll in localStorage liegen zu lassen.
  syncRemoveKeys(DESK_LEGACY_KEYS);
}
migrateDeskCardsIfNeeded();

// Alt-Keys in der Cloud: Die Migration lief oft vor der Anmeldung, die Keys
// kamen beim Erstabgleich sonst immer wieder zurück. Einmal pro Gerät nach
// der Anmeldung entfernen (setTimeout: sync.js setzt currentUserId im selben
// Ereignis, und Supabase erlaubt in diesem Callback keine eigene Abfrage).
function cleanupDeskLegacyCloudKeys() {
  if (typeof sbClient === 'undefined' || !sbClient) return;
  sbClient.auth.onAuthStateChange((event, session) => {
    if (!session || DB.get('deskLegacyCleaned', false)) return;
    setTimeout(async () => {
      if (!currentUserId) return;
      await syncRemoveKeys(DESK_LEGACY_KEYS);
      DB.set('deskLegacyCleaned', true);
    }, 0);
  });
}
cleanupDeskLegacyCloudKeys();

// ---- Stilwechsel: Inhalt umwandeln statt unsichtbar liegen zu lassen ----
const DESK_LINE_OPEN = '☐ ', DESK_LINE_DONE = '☑ ';

function deskItemsToText(items) {
  return (items || []).map(i => (i.done ? DESK_LINE_DONE : DESK_LINE_OPEN) + i.text).join('\n');
}
function deskTextToItems(text) {
  return String(text || '').split('\n').map(line => {
    const trimmed = line.trim();
    const done = trimmed.startsWith(DESK_LINE_DONE.trim());
    const clean = trimmed.replace(/^[☐☑]\s*/, '').replace(/^(?:[-*•]|\d+[.)])\s+/, '').trim();
    return clean ? { id: crypto.randomUUID(), text: clean, done } : null;
  }).filter(Boolean);
}
function deskFoldItemsIntoContent(card) {
  const lines = deskItemsToText(card.items);
  card.content = [card.content, lines].filter(Boolean).join('\n');
  card.items = [];
}
function deskFoldContentIntoItems(card) {
  card.items = [...(card.items || []), ...deskTextToItems(card.content)];
  card.content = '';
}

// Einmalig: Karten, in denen durch frühere Stilwechsel unsichtbarer Inhalt liegt
(function migrateDeskHiddenContent() {
  let changed = false;
  deskCards.forEach(card => {
    if (card.style === 'berichtsheft') return;
    if (card.style === 'checklist' && card.content) { deskFoldContentIntoItems(card); changed = true; }
    else if (card.style !== 'checklist' && card.items && card.items.length) { deskFoldItemsIntoContent(card); changed = true; }
  });
  if (changed) saveDeskCards();
})();

// ---- „Wichtig“ ist eine Markierung (card.important), kein eigener Stil ----
// So lässt es sich mit jedem Stil kombinieren (z.B. wichtige Checkliste).
// Früher war es der Stil 'important' — der zählt weiterhin als wichtig
// (falls ein anderes Gerät noch alte Karten liefert) und wird umgestellt.
function deskCardIsImportant(card) {
  return !!card.important || card.style === 'important';
}
(function migrateDeskImportantStyle() {
  let changed = false;
  deskCards.forEach(card => {
    if (card.style !== 'important') return;
    card.style = 'standard';
    card.important = true;
    changed = true;
  });
  if (changed) saveDeskCards();
})();

// ---- Sortierung in Ebenen: Wichtig ganz oben, dann Angepinnt, dann der
// Rest — innerhalb jeder Ebene die gespeicherte Reihenfolge. Verschieben
// (Griff, Pfeiltasten, ▲▼ im Dialog) bleibt immer in der eigenen Ebene.
// 0 = wichtig + angepinnt, 1 = wichtig, 2 = angepinnt, 3 = übrige
function deskCardTier(card) {
  return (deskCardIsImportant(card) ? 0 : 2) + (card.style === 'pinned' ? 0 : 1);
}
function sortedDeskCards(col) {
  return deskCards
    .filter(c => c.column === col)
    .sort((a, b) => (deskCardTier(a) - deskCardTier(b)) || ((a.order || 0) - (b.order || 0)));
}

// Handy: Spalten stehen untereinander — wichtige Karten aller Spalten
// sammeln sich dann ganz oben über den Spalten (#pinboard-important).
const deskPhoneQuery = window.matchMedia('(max-width: 640px)');
deskPhoneQuery.addEventListener('change', () => renderDesk());

// Baut alle Karten neu auf, behält aber Scrollstände, Fokus und Cursor
function renderDesk() {
  const view = document.getElementById('view-pinboard');
  if (!view || !view.classList.contains('active')) return;

  const scrolls = new Map();
  view.querySelectorAll('.desk-card').forEach(el => {
    scrolls.set(el.dataset.id, [...el.querySelectorAll(DESK_SCROLLERS)].map(s => s.scrollTop));
  });
  const active = document.activeElement;
  const focusCard = active && active.closest ? active.closest('.desk-card') : null;
  const focus = focusCard && active.dataset.deskFocus ? {
    cardId: focusCard.dataset.id, key: active.dataset.deskFocus,
    start: active.selectionStart, end: active.selectionEnd,
  } : null;

  const topEl = document.getElementById('pinboard-important');
  const gatherImportant = deskPhoneQuery.matches && !!topEl;
  if (topEl) topEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const colEl = document.getElementById('desk-col-' + i);
    if (!colEl) continue;
    colEl.innerHTML = '';
    sortedDeskCards(i).forEach(card => {
      const target = gatherImportant && deskCardIsImportant(card) ? topEl : colEl;
      target.appendChild(buildDeskCardEl(card));
    });
  }
  if (topEl) topEl.classList.toggle('hidden', !topEl.children.length);
  document.getElementById('pinboard-empty').classList.toggle('hidden', deskCards.length > 0);

  view.querySelectorAll('.desk-card--auto textarea').forEach(deskAutosize);
  view.querySelectorAll('.desk-card').forEach(el => {
    const tops = scrolls.get(el.dataset.id);
    if (tops) el.querySelectorAll(DESK_SCROLLERS).forEach((s, i) => { if (tops[i]) s.scrollTop = tops[i]; });
  });
  if (focus) {
    const cardEl = view.querySelector(`.desk-card[data-id="${CSS.escape(focus.cardId)}"]`);
    const target = cardEl && cardEl.querySelector(`[data-desk-focus="${CSS.escape(focus.key)}"]`);
    if (target) {
      target.focus({ preventScroll: true });
      if (typeof focus.start === 'number' && target.setSelectionRange) target.setSelectionRange(focus.start, focus.end);
    }
  }
}
// Textfelder von Karten ohne feste Höhe wachsen mit dem Inhalt
function deskAutosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}
let deskResizeFrame = null;
window.addEventListener('resize', () => {
  cancelAnimationFrame(deskResizeFrame);
  deskResizeFrame = requestAnimationFrame(() => {
    document.querySelectorAll('#view-pinboard.active .desk-card--auto textarea').forEach(deskAutosize);
  });
});

const DESK_STYLE_ICON = { pinned: '📌 ' };

function buildDeskCardEl(card) {
  const el = document.createElement('div');
  const important = deskCardIsImportant(card);
  el.className = `panel desk-card desk-card--${card.style}` + (important ? ' desk-card--important' : '') + (card.height ? '' : ' desk-card--auto');
  el.dataset.id = card.id;
  el.dataset.tier = deskCardTier(card);
  if (card.color) {
    applyUserColorVars(el, card.color);
    el.style.background = 'var(--user-color-bg)';
    el.style.setProperty('--card-fg', 'var(--user-color-text)');
    el.style.setProperty('--card-border', 'var(--user-color-border)');
    // Pinnwand-Stil „rpg“ (css/pinboard-rpg.css): Karte wird Pergament,
    // die Kartenfarbe wandert auf den Pin.
    el.style.setProperty('--card-pin', card.color);
  }
  if (card.height) el.style.height = card.height + 'px';

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header desk-card-header';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'desk-card-title-wrap';
  titleWrap.appendChild(buildDeskCardGrip(card, el));
  const title = document.createElement('span');
  title.className = 'desk-card-title';
  title.textContent = (DESK_STYLE_ICON[card.style] || '') + (important ? '⭐ ' : '') + card.title;
  title.title = card.title;
  titleWrap.appendChild(title);
  const actions = document.createElement('div');
  actions.className = 'desk-card-actions';

  if (card.style === 'checklist') {
    const items = card.items || [];
    const doneCount = items.filter(i => i.done).length;
    if (items.length) {
      const progress = document.createElement('span');
      progress.className = 'desk-card-progress';
      progress.textContent = `${doneCount}/${items.length}`;
      progress.title = `${doneCount} von ${items.length} erledigt`;
      actions.appendChild(progress);
    }
    if (doneCount) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'icon-btn'; clearBtn.textContent = '🧹'; clearBtn.title = 'Erledigte löschen';
      clearBtn.setAttribute('aria-label', 'Erledigte löschen');
      clearBtn.dataset.deskFocus = 'clear';
      clearBtn.addEventListener('click', () => {
        const before = card.items;
        card.items = before.filter(i => !i.done);
        saveDeskCards(); renderDesk();
        showDeskUndo(`${doneCount === 1 ? 'Ein Eintrag' : doneCount + ' Einträge'} gelöscht`, () => { card.items = before; });
      });
      actions.appendChild(clearBtn);
    }
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'icon-btn';
    eyeBtn.title = card.hideCompleted ? 'Erledigte einblenden' : 'Erledigte ausblenden';
    eyeBtn.setAttribute('aria-label', eyeBtn.title);
    eyeBtn.textContent = card.hideCompleted ? '🙈' : '👁';
    eyeBtn.dataset.deskFocus = 'eye';
    eyeBtn.addEventListener('click', () => { card.hideCompleted = !card.hideCompleted; saveDeskCards(); renderDesk(); });
    actions.appendChild(eyeBtn);
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'desk-edit-btn'; editBtn.title = 'Karte bearbeiten'; editBtn.innerHTML = '✎';
  editBtn.setAttribute('aria-label', `Karte „${card.title}“ bearbeiten`);
  editBtn.dataset.deskFocus = 'edit';
  editBtn.addEventListener('click', () => openDeskCardModal(card.id));
  actions.appendChild(editBtn);

  header.append(titleWrap, actions);
  el.appendChild(header);

  // Body (stilabhängig)
  const body = document.createElement('div');
  body.className = 'desk-card-body';
  buildDeskCardBody(body, card);
  el.appendChild(body);

  // Resize-Handle — Kartenhöhe frei ziehbar, wird persistiert
  const handle = document.createElement('div');
  handle.className = 'desk-resize-handle';
  handle.title = 'Höhe ziehen (am Handy erst kurz gedrückt halten), Doppelklick stellt sie wieder automatisch ein';
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'horizontal');
  handle.setAttribute('aria-label', 'Kartenhöhe: Pfeiltasten ändern, Entf stellt automatisch ein');
  handle.dataset.deskFocus = 'resize';
  wireDeskResize(handle, card, el);
  el.appendChild(handle);

  return el;
}

function deskTextField(card, field, className, placeholder, onInput) {
  const ta = document.createElement('textarea');
  if (className) ta.className = className;
  ta.value = card[field] || ''; ta.placeholder = placeholder;
  ta.dataset.deskFocus = field;
  ta.addEventListener('input', () => {
    card[field] = ta.value;
    if (!card.height) deskAutosize(ta);
    saveDeskCardsSoon();
    if (onInput) onInput();
  });
  ta.addEventListener('blur', flushDeskCards);
  return ta;
}

function buildDeskCardBody(body, card) {
  switch (card.style) {
    case 'checklist':
      buildDeskChecklist(body, card);
      break;
    case 'code': {
      const ta = deskTextField(card, 'content', 'desk-textarea', 'Code eingeben...');
      ta.spellcheck = false;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'desk-code-copy'; copyBtn.type = 'button'; copyBtn.title = 'Kopieren';
      copyBtn.setAttribute('aria-label', 'Code kopieren');
      const iconCopy = '<svg viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 11V3a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      const iconDone = '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      copyBtn.innerHTML = iconCopy;
      copyBtn.addEventListener('click', () => {
        const write = navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject();
        write.then(() => {
          copyBtn.innerHTML = iconDone;
          copyBtn.title = 'Kopieren';
          setTimeout(() => { copyBtn.innerHTML = iconCopy; }, 1500);
        }).catch(() => {
          // Ohne Zwischenablage-Zugriff: Text markieren, Strg + C geht dann von Hand
          ta.focus(); ta.select();
          copyBtn.title = 'Kopieren nicht möglich, der Text ist jetzt markiert';
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
        colEl.append(lab, deskTextField(card, field, '', placeholder));
        return colEl;
      };
      wrap.append(
        mk('Betrieb', 'betrieb', 'Was habe ich heute im Betrieb gemacht?'),
        mk('Schule', 'schule', 'Was haben wir heute in der Schule behandelt?')
      );
      body.appendChild(wrap);
      break;
    }
    default: // standard, pinned, quote (und alter Stil important) — alle ein freies Textfeld
      body.appendChild(deskTextField(card, 'content', 'desk-textarea', 'Notizen...'));
  }
}

// ---- Checkliste: Einträge abhaken, bearbeiten, sortieren, direkt ergänzen ----
const deskAddDrafts = new Map(); // angefangene Eingaben überleben das Neu-Rendern

function buildDeskChecklist(body, card) {
  const ul = document.createElement('ul'); ul.className = 'checklist';
  const items = card.items || [];
  const visible = items.filter(it => !(card.hideCompleted && it.done));
  visible.forEach(item => {
    const li = document.createElement('li'); li.className = 'checklist-item' + (item.done ? ' done' : '');
    li.dataset.itemId = item.id;
    const grip = document.createElement('button');
    grip.type = 'button'; grip.className = 'desk-grip desk-item-grip'; grip.textContent = '⠿';
    grip.title = 'Eintrag ziehen oder mit den Pfeiltasten verschieben';
    grip.setAttribute('aria-label', `Eintrag „${item.text}“ verschieben`);
    grip.dataset.deskFocus = 'grip:' + item.id;
    wireDeskItemDrag(grip, card, item, li, ul);

    const cb = makePaperCbElement(item, () => {
      item.done = !item.done; saveDeskCards(); renderDesk();
    });
    const span = document.createElement('span'); span.className = 'checklist-text'; span.textContent = item.text;
    span.tabIndex = 0;
    span.title = 'Doppelklick oder Enter zum Bearbeiten';
    span.dataset.deskFocus = 'text:' + item.id;
    span.addEventListener('dblclick', () => startDeskItemEdit(span, card, item));
    span.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startDeskItemEdit(span, card, item); }
    });
    const edit = document.createElement('button'); edit.className = 'desk-item-edit-btn'; edit.textContent = '✎';
    edit.title = 'Eintrag bearbeiten';
    edit.setAttribute('aria-label', `Eintrag „${item.text}“ bearbeiten`);
    edit.dataset.deskFocus = 'edit:' + item.id;
    edit.addEventListener('click', () => startDeskItemEdit(span, card, item));
    const del = document.createElement('button'); del.className = 'note-del'; del.textContent = '✕';
    del.title = 'Eintrag löschen';
    del.setAttribute('aria-label', `Eintrag „${item.text}“ löschen`);
    del.dataset.deskFocus = 'del:' + item.id;
    del.addEventListener('click', () => {
      const index = card.items.indexOf(item);
      card.items = card.items.filter(i => i !== item);
      saveDeskCards(); renderDesk();
      showDeskUndo('Eintrag gelöscht', () => { card.items.splice(index, 0, item); });
    });
    li.append(grip, cb, span, edit, del); ul.appendChild(li);
  });
  if (visible.length === 0) {
    const empty = document.createElement('li'); empty.className = 'empty-state';
    empty.textContent = items.length ? 'Alle Punkte erledigt.' : 'Noch keine Einträge.';
    ul.appendChild(empty);
  }
  body.appendChild(ul);

  const input = document.createElement('input');
  input.type = 'text'; input.className = 'desk-add-item'; input.placeholder = '+ Eintrag hinzufügen';
  input.setAttribute('aria-label', `Eintrag zu „${card.title}“ hinzufügen`);
  input.dataset.deskFocus = 'add';
  input.value = deskAddDrafts.get(card.id) || '';
  const addLines = text => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    if (!card.items) card.items = [];
    lines.forEach(line => card.items.push({ id: crypto.randomUUID(), text: line, done: false }));
    input.value = '';
    deskAddDrafts.delete(card.id);
    saveDeskCards(); renderDesk();
  };
  input.addEventListener('input', () => deskAddDrafts.set(card.id, input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addLines(input.value); } });
  // Eingefügte Listen: jede Zeile wird ein eigener Eintrag
  input.addEventListener('paste', e => {
    const text = e.clipboardData && e.clipboardData.getData('text');
    if (text && text.includes('\n')) { e.preventDefault(); addLines(input.value + text); }
  });
  body.appendChild(input);
}

// Mehrzeiliges Feld statt einzeiligem <input>: lange Einträge bleiben beim
// Bearbeiten ganz sichtbar und umbrechen wie im angezeigten Text.
// Enter speichert weiterhin, Zeilenumbrüche werden zu Leerzeichen.
function startDeskItemEdit(span, card, item) {
  const input = document.createElement('textarea');
  input.className = 'desk-item-edit'; input.value = item.text; input.rows = 1;
  input.setAttribute('aria-label', 'Eintrag bearbeiten');
  input.addEventListener('input', () => deskAutosize(input));
  let finished = false;
  const finish = save => {
    if (finished) return;
    finished = true;
    const text = input.value.replace(/\s*\n\s*/g, ' ').trim();
    if (save && text && text !== item.text) { item.text = text; saveDeskCards(); }
    renderDesk();
    const cardEl = document.querySelector(`.desk-card[data-id="${CSS.escape(card.id)}"]`);
    cardEl?.querySelector(`[data-desk-focus="${CSS.escape('text:' + item.id)}"]`)?.focus({ preventScroll: true });
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  span.replaceWith(input);
  deskAutosize(input);
  input.focus(); input.select();
}

// ---- Einträge innerhalb einer Liste verschieben ----
function deskMoveItem(card, item, targetIndex) {
  const items = card.items.filter(i => i !== item);
  items.splice(Math.max(0, Math.min(targetIndex, items.length)), 0, item);
  card.items = items;
  saveDeskCards(); renderDesk();
}

function wireDeskItemDrag(grip, card, item, li, ul) {
  grip.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    // Ausgeblendete Erledigte überspringen: Nachbar in der sichtbaren Liste suchen
    const visible = card.items.filter(i => !(card.hideCompleted && i.done));
    const neighbour = visible[visible.indexOf(item) + (e.key === 'ArrowUp' ? -1 : 1)];
    if (!neighbour) return;
    const index = card.items.indexOf(neighbour);
    deskMoveItem(card, item, index);
  });
  grip.addEventListener('pointerdown', e => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    li.classList.add('desk-dragging');
    const marker = document.createElement('li');
    marker.className = 'desk-drop-marker';
    let before = null, moved = false;
    const onMove = ev => {
      moved = true;
      deskAutoScroll(ul, ev.clientY);
      before = [...ul.querySelectorAll('.checklist-item')].find(row => {
        if (row === li) return false;
        const r = row.getBoundingClientRect();
        return ev.clientY < r.top + r.height / 2;
      }) || null;
      ul.insertBefore(marker, before);
    };
    const onEnd = ev => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onEnd);
      grip.removeEventListener('pointercancel', onEnd);
      li.classList.remove('desk-dragging');
      marker.remove();
      if (!moved || ev.type === 'pointercancel') return;
      const beforeItem = before && card.items.find(i => i.id === before.dataset.itemId);
      const rest = card.items.filter(i => i !== item);
      deskMoveItem(card, item, beforeItem ? rest.indexOf(beforeItem) : rest.length);
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onEnd);
    grip.addEventListener('pointercancel', onEnd);
  });
}

// ---- Karten verschieben: Griff ziehen oder Pfeiltasten ----
// index zählt innerhalb der sortierten Spalte; die Karte bleibt in ihrer
// Ebene (wichtig / angepinnt / übrige, siehe deskCardTier).
function deskPlaceCard(card, col, index) {
  const rest = sortedDeskCards(col).filter(c => c !== card);
  const tier = deskCardTier(card);
  const min = rest.filter(c => deskCardTier(c) < tier).length;
  const max = rest.filter(c => deskCardTier(c) <= tier).length;
  rest.splice(Math.max(min, Math.min(index, max)), 0, card);
  card.column = col;
  rest.forEach((c, i) => { c.order = i; });
  saveDeskCards();
  renderDesk();
}

function moveDeskCardByKey(card, key) {
  const sorted = sortedDeskCards(card.column);
  const index = sorted.indexOf(card);
  if (key === 'ArrowUp') deskPlaceCard(card, card.column, index - 1);
  if (key === 'ArrowDown') deskPlaceCard(card, card.column, index + 1);
  const col = card.column + (key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0);
  if (col !== card.column && col >= 0 && col <= 2) deskPlaceCard(card, col, Infinity);
}

// Scrollt den nächsten scrollbaren Vorfahren, wenn der Zeiger am Rand steht
function deskAutoScroll(el, y) {
  let box = el;
  while (box && box !== document.body) {
    const overflow = getComputedStyle(box).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && box.scrollHeight > box.clientHeight) break;
    box = box.parentElement;
  }
  if (!box || box === document.body) return;
  const r = box.getBoundingClientRect();
  if (y < r.top + 50) box.scrollTop -= 12;
  else if (y > r.bottom - 50) box.scrollTop += 12;
}

function buildDeskCardGrip(card, cardEl) {
  const grip = document.createElement('button');
  grip.type = 'button'; grip.className = 'desk-grip'; grip.textContent = '⠿';
  grip.title = 'Karte ziehen oder mit den Pfeiltasten verschieben';
  grip.setAttribute('aria-label', `Karte „${card.title}“ verschieben`);
  grip.dataset.deskFocus = 'grip';
  grip.addEventListener('keydown', e => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    moveDeskCardByKey(card, e.key);
  });
  grip.addEventListener('pointerdown', e => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const desk = document.getElementById('pinboard-desk');
    const marker = document.createElement('div');
    marker.className = 'desk-drop-marker';
    desk.classList.add('desk-is-dragging');
    cardEl.classList.add('desk-dragging');
    let targetCol = null, beforeId = null;

    const onMove = ev => {
      deskAutoScroll(desk, ev.clientY);
      // Nächste Spalte: funktioniert auch, wenn sie auf dem Handy untereinander stehen
      let best = Infinity;
      desk.querySelectorAll('.desk-col').forEach((colEl, i) => {
        const r = colEl.getBoundingClientRect();
        const dx = Math.max(r.left - ev.clientX, 0, ev.clientX - r.right);
        const dy = Math.max(r.top - ev.clientY, 0, ev.clientY - r.bottom);
        if (dx + dy < best) { best = dx + dy; targetCol = i; }
      });
      const colEl = document.getElementById('desk-col-' + targetCol);
      const others = [...colEl.querySelectorAll('.desk-card')].filter(c => c !== cardEl);
      const tier = deskCardTier(card);
      const min = others.filter(c => Number(c.dataset.tier) < tier).length;
      const max = others.filter(c => Number(c.dataset.tier) <= tier).length;
      let index = others.findIndex(c => {
        const r = c.getBoundingClientRect();
        return ev.clientY < r.top + r.height / 2;
      });
      if (index < 0) index = others.length;
      index = Math.max(min, Math.min(index, max));
      beforeId = others[index] ? others[index].dataset.id : null;
      colEl.insertBefore(marker, others[index] || null);
    };
    const onEnd = ev => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onEnd);
      grip.removeEventListener('pointercancel', onEnd);
      desk.classList.remove('desk-is-dragging');
      cardEl.classList.remove('desk-dragging');
      marker.remove();
      if (targetCol === null || ev.type === 'pointercancel') return;
      // Position in der ganzen Spalte (am Handy stehen wichtige Karten nicht darin)
      const rest = sortedDeskCards(targetCol).filter(c => c !== card);
      const at = beforeId ? rest.findIndex(c => c.id === beforeId) : -1;
      deskPlaceCard(card, targetCol, at < 0 ? rest.length : at);
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onEnd);
    grip.addEventListener('pointercancel', onEnd);
  });
  return grip;
}

// ---- Kartenhöhe per Resize-Handle ziehen — wird in deskCards.height persistiert ----
const DESK_RESIZE_HOLD_MS = 350;
function wireDeskResize(handle, card, cardEl) {
  let startY = 0, startH = 0, moved = false;
  function move(e) {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    if (!moved) {
      // Erst beim echten Ziehen fest werden: ein Klick oder Doppelklick
      // lässt die Karte automatisch hoch.
      moved = true;
      cardEl.classList.remove('desk-card--auto');
      cardEl.querySelectorAll('textarea').forEach(ta => { ta.style.height = ''; });
    }
    cardEl.style.height = Math.max(90, startH + (y - startY)) + 'px';
  }
  function up() {
    clearTimeout(holdTimer);
    handle.classList.remove('resizing');
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchmove', touchMove);
    document.removeEventListener('touchend', up);
    document.removeEventListener('touchcancel', up);
    const h = parseInt(cardEl.style.height, 10);
    if (moved && h && h !== card.height) { card.height = h; saveDeskCards(); renderDesk(); }
  }
  function beginDrag(y) {
    handle.classList.add('resizing');
    moved = false;
    startY = y; startH = cardEl.getBoundingClientRect().height;
  }
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    beginDrag(e.clientY);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
  // Touch: Der Griff liegt genau dort, wo man beim Scrollen über die
  // Pinnwand wischt. Deshalb zieht er erst nach kurzem Gedrückthalten
  // (DESK_RESIZE_HOLD_MS) — bewegt sich der Finger vorher, ist es Scrollen
  // und die Höhe bleibt unverändert.
  let holdTimer = null, armed = false, touchStartY = 0;
  function touchMove(e) {
    const y = e.touches[0].clientY;
    if (!armed) {
      if (Math.abs(y - touchStartY) > 8) up(); // Scrollen, kein Ziehen
      return;
    }
    e.preventDefault(); // gehalten: Seite bleibt stehen, Karte wird gezogen
    move(e);
  }
  handle.addEventListener('touchstart', e => {
    if (e.touches.length > 1) return;
    touchStartY = e.touches[0].clientY;
    armed = false;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      armed = true;
      beginDrag(touchStartY);
      if (navigator.vibrate) navigator.vibrate(12);
    }, DESK_RESIZE_HOLD_MS);
    document.addEventListener('touchmove', touchMove, { passive: false });
    document.addEventListener('touchend', up);
    // Ohne touchcancel bliebe die Karte im "resizing"-Zustand hängen, falls
    // die Geste unterbrochen wird (System-Geste, eingehender Anruf, o.ä.).
    document.addEventListener('touchcancel', up);
  }, { passive: true });

  const resetHeight = () => { card.height = null; saveDeskCards(); renderDesk(); };
  handle.addEventListener('dblclick', resetHeight);
  handle.addEventListener('keydown', e => {
    if (e.key === 'Delete' || e.key === 'Home') { e.preventDefault(); resetHeight(); return; }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const current = card.height || cardEl.getBoundingClientRect().height;
    card.height = Math.max(90, Math.round(current) + (e.key === 'ArrowUp' ? -20 : 20));
    saveDeskCards(); renderDesk();
  });
}

// ---- Rückgängig nach dem Löschen ----
let deskUndoTimer = null;
function showDeskUndo(message, restore) {
  let bar = document.getElementById('desk-undo');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'desk-undo';
    bar.setAttribute('role', 'status');
    document.body.appendChild(bar);
  }
  bar.innerHTML = '';
  const label = document.createElement('span');
  label.textContent = message;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.textContent = 'Rückgängig';
  const hide = () => { clearTimeout(deskUndoTimer); bar.classList.add('hidden'); };
  btn.addEventListener('click', () => { restore(); saveDeskCards(); renderDesk(); hide(); });
  bar.append(label, btn);
  bar.classList.remove('hidden');
  clearTimeout(deskUndoTimer);
  deskUndoTimer = setTimeout(hide, 8000);
}

// ---- Karte erstellen / bearbeiten ----
let editingDeskCardId = null;
let selectedDeskStyle = 'standard';
let selectedDeskColumn = 0;
let selectedDeskImportant = false;
function setDeskImportantToggle(on) {
  selectedDeskImportant = on;
  const btn = document.getElementById('desk-modal-important');
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}
document.getElementById('desk-modal-important').addEventListener('click', () => setDeskImportantToggle(!selectedDeskImportant));
let deskColorShown = null; // Farbe beim Öffnen: Karten ohne Farbe behalten das, bis sie geändert wird
const deskColorWidget = initColorPickerWidget(
  { pickerId: 'desk-modal-color', previewId: 'desk-modal-color-preview', addBtnId: 'desk-modal-color-add-btn', libraryId: 'desk-modal-color-library' },
  { initial: HUB_PALETTE_HEX[0] }
);
const deskCardModal = wireModal('desk-modal-overlay', {
  closeIds: ['desk-modal-close', 'desk-modal-cancel'],
  inputId: 'desk-modal-title',
  saveId: 'desk-modal-save',
  onClose: () => { editingDeskCardId = null; },
});

function openDeskCardModal(cardId) {
  editingDeskCardId = cardId || null;
  const card = editingDeskCardId ? deskCards.find(c => c.id === editingDeskCardId) : null;

  document.getElementById('desk-modal-head-title').textContent = card ? 'Karte bearbeiten' : 'Neue Karte';
  document.getElementById('desk-modal-title').value = card ? card.title : '';
  document.getElementById('desk-modal-save').textContent = card ? 'Speichern' : 'Erstellen';
  document.getElementById('desk-modal-delete-btn').style.display = card ? 'inline-flex' : 'none';

  selectedDeskStyle = card && card.style !== 'important' ? card.style : 'standard';
  selectedDeskColumn = card ? card.column : 0;
  setDeskImportantToggle(card ? deskCardIsImportant(card) : false);

  // Berichtsheft hat einen festen Aufbau — kein Stil-Wechsel möglich, weder
  // weg von ihm noch zu ihm hin (nur als neue Karte wählbar).
  const isBericht = !!card && card.style === 'berichtsheft';
  document.getElementById('desk-style-row').style.display = isBericht ? 'none' : '';
  document.querySelector('.desk-type-btn[data-style="berichtsheft"]').style.display = card ? 'none' : '';
  if (!isBericht) {
    document.querySelectorAll('.desk-type-btn').forEach(b => b.classList.toggle('active', b.dataset.style === selectedDeskStyle));
    document.getElementById('desk-type-desc').textContent = DESK_STYLE_DESC[selectedDeskStyle] || '';
  }

  document.querySelectorAll('#desk-modal-column-picker .toggle-select-btn')
    .forEach(b => b.classList.toggle('active', Number(b.dataset.col) === selectedDeskColumn));
  document.getElementById('desk-modal-order-row').style.display = card ? '' : 'none';
  if (card) updateDeskMoveButtons(card);

  deskColorShown = card ? (card.color || HUB_PALETTE_HEX[0]) : HUB_PALETTE_HEX[0];
  deskColorWidget.setValue(deskColorShown);

  deskCardModal.open();
  setTimeout(() => document.getElementById('desk-modal-title').focus(), 50);
}
function closeDeskCardModal() { deskCardModal.close(); }

document.getElementById('add-desk-card-btn').addEventListener('click', () => openDeskCardModal(null));
document.getElementById('pinboard-empty-add').addEventListener('click', () => openDeskCardModal(null));

document.querySelectorAll('.desk-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedDeskStyle = btn.dataset.style;
    document.querySelectorAll('.desk-type-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('desk-type-desc').textContent = DESK_STYLE_DESC[selectedDeskStyle] || '';
  });
});
document.querySelectorAll('#desk-modal-column-picker .toggle-select-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedDeskColumn = Number(btn.dataset.col);
    document.querySelectorAll('#desk-modal-column-picker .toggle-select-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});

// ▲▼ im Dialog: verschiebt die Karte sofort eine Position in ihrer Spalte
// (innerhalb ihrer Ebene, wie Griff und Pfeiltasten auch)
function deskTierNeighbours(card) {
  const sorted = sortedDeskCards(card.column);
  const i = sorted.indexOf(card);
  const tier = deskCardTier(card);
  return { sorted, i, up: i > 0 && deskCardTier(sorted[i - 1]) === tier, down: i < sorted.length - 1 && deskCardTier(sorted[i + 1]) === tier };
}
function updateDeskMoveButtons(card) {
  const n = deskTierNeighbours(card);
  document.getElementById('desk-modal-move-up').disabled = !n.up;
  document.getElementById('desk-modal-move-down').disabled = !n.down;
}
['up', 'down'].forEach(dir => {
  document.getElementById('desk-modal-move-' + dir).addEventListener('click', () => {
    const card = deskCards.find(c => c.id === editingDeskCardId);
    if (!card) return;
    const n = deskTierNeighbours(card);
    if (!(dir === 'up' ? n.up : n.down)) return;
    deskPlaceCard(card, card.column, n.i + (dir === 'up' ? -1 : 1));
    updateDeskMoveButtons(card);
  });
});

function nextDeskOrder(col) {
  const inCol = deskCards.filter(c => c.column === col);
  return inCol.length ? Math.max(...inCol.map(c => c.order || 0)) + 1 : 0;
}

// Neue Standard-Karte von außen (Schnellnotiz „Ablegen“, today-quicknote-send.js)
// — die Pinnwand legt ihre Karte selbst an, im selben Format wie das Modal.
function addDeskCardFromText(title, content) {
  const card = {
    id: crypto.randomUUID(), title: title || 'Notiz', style: 'standard', color: null, important: false,
    column: 0, order: nextDeskOrder(0), height: null,
    content: content || '', items: [], hideCompleted: false, betrieb: '', schule: '',
  };
  deskCards.push(card);
  saveDeskCards();
  return card;
}

document.getElementById('desk-modal-save').addEventListener('click', () => {
  const titleInput = document.getElementById('desk-modal-title');
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.classList.add('desk-input-missing');
    titleInput.focus();
    setTimeout(() => titleInput.classList.remove('desk-input-missing'), 1500);
    return;
  }
  const color = deskColorWidget.getValue();

  if (editingDeskCardId) {
    const card = deskCards.find(c => c.id === editingDeskCardId); if (!card) return;
    card.title = title;
    card.important = selectedDeskImportant;
    if (card.color || color !== deskColorShown) card.color = color;
    if (card.style !== 'berichtsheft') {
      if (selectedDeskStyle === 'checklist' && card.style !== 'checklist') deskFoldContentIntoItems(card);
      if (selectedDeskStyle !== 'checklist' && card.style === 'checklist') deskFoldItemsIntoContent(card);
      card.style = selectedDeskStyle;
    }
    if (card.column !== selectedDeskColumn) {
      card.column = selectedDeskColumn;
      card.order = nextDeskOrder(selectedDeskColumn);
    }
  } else {
    deskCards.push({
      id: crypto.randomUUID(), title, style: selectedDeskStyle, color, important: selectedDeskImportant,
      column: selectedDeskColumn, order: nextDeskOrder(selectedDeskColumn), height: null,
      content: '', items: [], hideCompleted: false, betrieb: '', schule: '',
    });
  }
  saveDeskCards();
  closeDeskCardModal();
  renderDesk();
});

document.getElementById('desk-modal-delete-btn').addEventListener('click', async () => {
  if (!editingDeskCardId) return;
  const card = deskCards.find(c => c.id === editingDeskCardId); if (!card) return;
  const ok = await hubConfirm({
    title: 'Karte löschen?',
    message: `„${card.title}“ wird mit ihrem ganzen Inhalt gelöscht.`,
    confirmText: 'Löschen',
    danger: true,
  });
  if (!ok) return;
  deskCards = deskCards.filter(c => c !== card);
  saveDeskCards();
  closeDeskCardModal();
  renderDesk();
  showDeskUndo(`Karte „${card.title}“ gelöscht`, () => { deskCards.push(card); });
});

// =========================
// PAPER CHECKBOX — Bullet-Journal-Stil
// Kreisförmiger Papier-Marker als echter Button mit role="checkbox".
// Wird ausschließlich von Checklisten-Karten genutzt.
// =========================

// Kreis-Akzentfarben aus der Textfarbe der Kachel (--user-color-text, von
// applyUserColorVars() pro Karte gesetzt) — passt dadurch automatisch zu
// jeder Kachelfarbe und jedem Theme statt einer festen Liste pro Farbe.
// Als style statt SVG-Attribut, weil CSS-Variablen in Attributen nicht
// zuverlässig ausgewertet werden.
function paperCbColor() {
  const ink = pct => `color-mix(in srgb, var(--user-color-text, var(--text)) ${pct}%, transparent)`;
  return { ring: ink(30), check: ink(72), fill: ink(12) };
}

function buildPaperCb(done) {
  const c = paperCbColor();
  if (done) {
    // Gefüllter Kreis mit Haken
    return `<span class="paper-cb paper-cb--done">
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8.5" cy="8.5" r="7.5" style="fill:${c.fill};stroke:${c.ring}" stroke-width="1.2"/>
        <polyline points="4.5,8.5 7.5,11.5 12.5,6" style="stroke:${c.check}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
  } else {
    // Leerer Kreis
    return `<span class="paper-cb">
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8.5" cy="8.5" r="7.5" fill="none" style="stroke:${c.ring}" stroke-width="1.2"/>
      </svg>
    </span>`;
  }
}

function makePaperCbElement(item, onToggle) {
  const wrap = document.createElement('button');
  wrap.type = 'button';
  wrap.className = 'paper-cb-wrap';
  wrap.setAttribute('role', 'checkbox');
  wrap.setAttribute('aria-checked', item.done ? 'true' : 'false');
  wrap.setAttribute('aria-label', item.text);
  wrap.dataset.deskFocus = 'cb:' + item.id;
  wrap.innerHTML = buildPaperCb(item.done);
  wrap.addEventListener('click', (e) => { e.stopPropagation(); onToggle(); });
  return wrap;
}


// =========================
// SUCHQUELLE (js/hub-search.js, AI documentation/search.md) — nur lesen;
// open() springt zum Eintrag über die Funktionen dieses Tabs.
// =========================
registerSearchProvider({
  id: 'pinboard', label: 'Pinnwand', icon: '📌', view: 'pinboard',
  items: () => (deskCards || []).map(card => ({
    id: card.id, title: card.title || 'Karte',
    text: [card.content, ...(card.items || []).map(i => i && i.text), card.betrieb, card.schule]
      .filter(v => typeof v === 'string' && v).join('\n'),
    open: () => { showView('pinboard'); searchFlashElement(`.desk-card[data-id="${card.id}"]`); },
  })),
});
