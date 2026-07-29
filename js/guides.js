// =========================
// GUIDES — Developer Wiki
// =========================

let guideCategories = DB.get('guideCategories', []);
let guideSearchQuery = '';
let activeGuideId = null; // currently open guide

function saveGuideCategories() {
  DB.set('guideCategories', guideCategories);
}

// ── Helpers ──────────────────────────────────────────────

function getAllGuides() {
  return guideCategories.flatMap(cat =>
    cat.guides.map(g => ({ ...g, categoryId: cat.id, categoryName: cat.name }))
  );
}

function findGuide(guideId) {
  for (const cat of guideCategories) {
    const g = cat.guides.find(g => g.id === guideId);
    if (g) return { guide: g, category: cat };
  }
  return null;
}


// ── Code Bookmarks ────────────────────────────────────────
let guideBookmarks = DB.get('guideBookmarks', {}); // { [guideId]: [blockId, ...] }
let bookmarkNavIndex = 0; // current position in bookmark navigation

function saveBookmarks() { DB.set('guideBookmarks', guideBookmarks); }

// Stable block ID: hash of content + position index
function makeBlockId(guideId, code, index) {
  let hash = 0;
  const str = guideId + index + code.slice(0, 80);
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0; }
  return 'cb-' + Math.abs(hash).toString(36);
}

function isBookmarked(guideId, blockId) {
  return (guideBookmarks[guideId] || []).includes(blockId);
}

function toggleBookmark(guideId, blockId) {
  if (!guideBookmarks[guideId]) guideBookmarks[guideId] = [];
  const idx = guideBookmarks[guideId].indexOf(blockId);
  if (idx === -1) guideBookmarks[guideId].push(blockId);
  else guideBookmarks[guideId].splice(idx, 1);
  saveBookmarks();
}

// ── Markdown + Code renderer ─────────────────────────────
// Lightweight renderer: headings, bold, italic, code blocks,
// inline code, lists, horizontal rules, links.

function renderMarkdown(raw, guideId = null, categoryId = null, featuredBlockId = null) {
  if (!raw) return '';

  // Pre-compute stable block IDs from the RAW (unescaped) content so they always
  // match the IDs produced by getCodeBlocksWithIds(). Computing them after escHtml()
  // would alter the hash for any code containing <, >, & or " (e.g. comparisons,
  // logical operators, string literals) causing a mismatch with stored IDs.
  const _rawBlockIds = [];
  if (guideId) {
    let _ri = 0;
    const _re = /```(\w*)\n([\s\S]*?)```/g;
    let _m;
    while ((_m = _re.exec(raw))) { _rawBlockIds.push(makeBlockId(guideId, _m[2], _ri++)); }
  }

  let html = escHtml(raw);

  // Fenced code blocks  ```lang\n...\n```
  let _blockIndex = 0;
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const blockId  = guideId ? _rawBlockIds[_blockIndex++] : null;
    const bookmarked = guideId ? isBookmarked(guideId, blockId) : false;
    const bmIcon = bookmarked
      ? `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h5A1.5 1.5 0 0 1 12 2.5V14l-4-2.4L4 14V2.5Z"/></svg>`
      : `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h5A1.5 1.5 0 0 1 12 2.5V14l-4-2.4L4 14V2.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    const bmBtn    = guideId
      ? `<button class="guide-bookmark-btn ${bookmarked ? 'active' : ''}" onclick="handleBookmarkClick(this,'${guideId}','${blockId}')" title="${bookmarked ? 'Bookmark entfernen' : 'Code-Block merken'}">${bmIcon}</button>`
      : '';
    const featured = (guideId && categoryId && blockId && featuredBlockId === blockId);
    const featBtn  = (guideId && categoryId)
      ? `<button class="guide-feature-btn ${featured ? 'active' : ''}" onclick="handleFeatureClick(this,'${categoryId}','${guideId}','${blockId}')" title="${featured ? 'Als Bibliothek-Snippet entfernen' : 'Als Bibliothek-Snippet verwenden'}">${featured ? '★' : '☆'}</button>`
      : '';
    // Codeblock-HTML kommt aus hub-utils.js (renderCodeBlock) — hub-weit geteilt,
    // damit z.B. der Schreibtisch-Kartenstil "Code" später dieselbe Darstellung nutzt.
    return renderCodeBlock(code, lang, { blockId, bookmarked, bookmarkBtnHtml: bmBtn, featureBtnHtml: featBtn });
  });

  // Inline code `...`
  html = html.replace(/`([^`]+)`/g, '<code class="guide-inline-code">$1</code>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h4 class="guide-h4">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="guide-h3">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 class="guide-h2">$1</h2>');

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Tables — detect block of lines starting with |
  html = html.replace(/((?:^\|.+\|\n?)+)/gm, match => {
    const lines = match.trim().split('\n').filter(l => l.trim());
    // filter out the separator row (|---|---|)
    const rows = lines.filter(l => !/^\|[\s\-|:]+\|$/.test(l.trim()));
    if (rows.length < 2) return match; // not enough rows, leave as-is
    const toCell = (line, tag) =>
      line.trim().replace(/^\||\|$/g, '').split('|')
        .map(cell => `<${tag} class="guide-td">${cell.trim()}</${tag}>`).join('');
    const head = `<thead><tr>${toCell(rows[0], 'th')}</tr></thead>`;
    const body = rows.slice(1).map(r => `<tr>${toCell(r, 'td')}</tr>`).join('');
    return `<table class="guide-table"><thead><tr>${toCell(rows[0], 'th')}</tr></thead><tbody>${body}</tbody></table>`;
  });

  // Unordered list lines  - item
  html = html.replace(/((?:^- .+$\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
    return `<ul class="guide-ul">${items}</ul>`;
  });

  // Ordered list lines  1. item
  html = html.replace(/((?:^\d+\. .+$\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol class="guide-ol">${items}</ol>`;
  });

  // Text marker ==text==
  html = html.replace(/==(.+?)==/g, '<mark class="guide-mark">$1</mark>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="guide-hr">');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a class="guide-link" href="$2" target="_blank" rel="noopener">$1</a>');

  // Paragraphs: double newlines → <p>
  html = html
    .split(/\n{2,}/)
    .map(block => {
      if (/^<(h[234]|ul|ol|hr|div|table)/.test(block.trim())) return block;
      const wrapped = block.trim().replace(/\n/g, '<br>');
      return wrapped ? `<p class="guide-p">${wrapped}</p>` : '';
    })
    .join('\n');

  return html;
}

// Bookmark click handler (global so onclick works)
window.handleBookmarkClick = function(btn, guideId, blockId) {
  toggleBookmark(guideId, blockId);
  const active = isBookmarked(guideId, blockId);
  btn.classList.toggle('active', active);
  btn.title = active ? 'Bookmark entfernen' : 'Code-Block merken';
  btn.innerHTML = active
    ? `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h5A1.5 1.5 0 0 1 12 2.5V14l-4-2.4L4 14V2.5Z"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h5A1.5 1.5 0 0 1 12 2.5V14l-4-2.4L4 14V2.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  const block = btn.closest('.guide-code-block');
  if (block) block.classList.toggle('bookmarked', active);
  renderSidebarBookmarks(guideId);
};

// Featured snippet click handler (global so onclick works)
window.handleFeatureClick = function(btn, categoryId, guideId, blockId) {
  const cat = guideCategories.find(c => c.id === categoryId);
  if (!cat) return;
  const cur = cat.featuredSnippet;
  if (cur && cur.guideId === guideId && cur.blockId === blockId) {
    cat.featuredSnippet = null; // toggle off
  } else {
    cat.featuredSnippet = { guideId, blockId };
  }
  saveGuideCategories();
  // Re-render so all star buttons + sidebar reflect the new state
  renderGuideContent();
};

// Returns all fenced code blocks of a guide together with their stable IDs
function getCodeBlocksWithIds(content, guideId) {
  if (!content) return [];
  const blocks = [];
  let idx = 0;
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content))) {
    blocks.push({ lang: m[1] || 'code', code: m[2].trimEnd(), id: makeBlockId(guideId, m[2], idx++) });
  }
  return blocks;
}

function exportGuideAsMd(guideId) {
  const result = findGuide(guideId);
  if (!result) return;
  const { guide, category } = result;
  const lines = [];
  lines.push('---');
  lines.push('title: ' + guide.title);
  lines.push('category: ' + category.name);
  if (guide.description) lines.push('description: ' + guide.description);
  if (guide.tags?.length)  lines.push('tags: ' + guide.tags.join(', '));
  lines.push('---');
  lines.push('');
  lines.push(guide.content || '');
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = guide.title.replace(/[^a-z0-9äöüÄÖÜß ]/gi, '_') + '.md';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importGuideFromMd(categoryId) {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.md,.markdown,text/markdown';
  input.multiple = true;
  input.addEventListener('change', () => {
    const cat = guideCategories.find(c => c.id === categoryId);
    if (!cat) return;
    let imported = 0;
    const files = [...input.files];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target.result;
        // Parse optional front matter
        let title = file.name.replace(/\.md$/, '').replace(/_/g, ' ');
        let description = '';
        let tags = [];
        let content = text;
        const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (fmMatch) {
          const fm = fmMatch[1];
          content  = fmMatch[2].trimStart();
          const t  = fm.match(/^title:\s*(.+)$/m);
          const d  = fm.match(/^description:\s*(.+)$/m);
          const tg = fm.match(/^tags:\s*(.+)$/m);
          if (t)  title       = t[1].trim();
          if (d)  description = d[1].trim();
          if (tg) tags        = tg[1].split(',').map(s => s.trim()).filter(Boolean);
        }
        cat.guides.push({
          id: crypto.randomUUID(), title, description, content, tags,
          favorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        imported++;
        if (imported === files.length) {
          saveGuideCategories();
          renderGuideContent();
        }
      };
      reader.readAsText(file);
    });
  });
  input.click();
}

// ── Library helpers ───────────────────────────────────────

const GUIDE_BOOK_COLORS = 6; // legacy pastel count (css: .guide-book-0 .. .guide-book-5)
// Farbpalette + Nutzerbibliothek + hexToGradient() kommen jetzt hub-weit aus
// hub-utils.js (HUB_PALETTE_HEX, hubUserColors), damit Kalender & künftige
// Tabs dieselbe Farbverwaltung nutzen können.

// Applies the correct color class or inline style to a book element.
function applyBookColor(el, cat, idx) {
  for (let i = 0; i < GUIDE_BOOK_COLORS; i++) el.classList.remove('guide-book-' + i);
  if (typeof cat.coverColor === 'string' && /^#/.test(cat.coverColor)) {
    el.style.background = hexToGradient(cat.coverColor);
  } else {
    const legacyIdx = (typeof cat.coverColor === 'number') ? cat.coverColor : idx;
    el.classList.add('guide-book-' + (legacyIdx % GUIDE_BOOK_COLORS));
    el.style.background = '';
  }
}

function fmtDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtOpened(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Heute';
  return fmtDate(iso);
}

function fmtOpenedFull(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return 'Heute, ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  return fmtDate(iso);
}

function categoryGuideCount(cat) { return cat.guides.length; }

function totalGuideCount() {
  return guideCategories.reduce((sum, c) => sum + c.guides.length, 0);
}

// Aggregate stats for a whole book (category)
function getCategoryStats(cat) {
  const guides = cat.guides;
  let created = null, updated = null, opened = null, mostRead = null, maxOpen = 0, favCount = 0;
  guides.forEach(g => {
    if (g.favorite) favCount++;
    if (g.createdAt && (!created || new Date(g.createdAt) < new Date(created))) created = g.createdAt;
    if (g.updatedAt && (!updated || new Date(g.updatedAt) > new Date(updated))) updated = g.updatedAt;
    if (g.lastOpened && (!opened || new Date(g.lastOpened) > new Date(opened))) opened = g.lastOpened;
    if ((g.openCount || 0) > maxOpen) { maxOpen = g.openCount; mostRead = g; }
  });
  return { created, updated, opened, favCount, count: guides.length, mostRead };
}

// ── Library header (book + chapter counts) ────────────────

function renderLibraryHeader() {
  const sub = document.getElementById('lib-subtitle');
  if (!sub) return;
  const books = guideCategories.length;
  const chapters = totalGuideCount();
  sub.textContent = `${books} ${books === 1 ? 'Buch' : 'Bücher'} · ${chapters} Kapitel`;
}

// ── Bookshelf ──────────────────────────────────────────────

function renderGuideShelf() {
  const shelf = document.getElementById('guide-shelf');
  const empty = document.getElementById('guide-category-empty');
  if (!shelf) return;
  shelf.innerHTML = '';
  renderLibraryHeader();

  if (guideCategories.length === 0) {
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
  }

  guideCategories.forEach((cat, idx) => {
    const stats = getCategoryStats(cat);
    const activeOrOpenChapter = !guideSearchQuery && state.activeGuideCategoryId === cat.id;

    const book = document.createElement('div');
    book.className = 'guide-book' + (activeOrOpenChapter ? ' active' : '');
    book.title = cat.name;
    applyBookColor(book, cat, idx);

    const del = document.createElement('button');
    del.className = 'guide-book-del';
    del.title = 'Buch löschen';
    del.textContent = '✕';
    del.addEventListener('click', e => {
      e.stopPropagation();
      const count = cat.guides.length;
      if (!confirm(`Buch „${cat.name}" und alle ${count} Kapitel löschen?`)) return;
      guideCategories = guideCategories.filter(c => c.id !== cat.id);
      if (state.activeGuideCategoryId === cat.id) {
        state.activeGuideCategoryId = null;
        activeGuideId = null;
      }
      saveGuideCategories();
      renderGuideContent();
    });

    book.innerHTML = `
      <div class="guide-book-title">${escHtml(cat.name)}</div>
      <div class="guide-book-meta">${categoryGuideCount(cat)} Kapitel</div>
      <div class="guide-book-spacer"></div>
      <div class="guide-book-footer">
        <span class="guide-book-opened-label">zuletzt geöffnet:</span>
        <span class="guide-book-opened-val">${fmtOpened(stats.opened)}</span>
      </div>
    `;
    book.appendChild(del);

    book.addEventListener('click', () => {
      guideSearchQuery = '';
      const input = document.getElementById('guide-search-input');
      if (input) input.value = '';
      state.activeGuideCategoryId = cat.id;
      activeGuideId = null;
      renderGuideContent();
    });

    shelf.appendChild(book);
  });

  // "Add new book" tile
  const addTile = document.createElement('div');
  addTile.className = 'guide-book-add';
  addTile.innerHTML = `
    <div class="guide-book-add-icon">+</div>
    <div class="guide-book-add-label">Neues Buch<br>erstellen</div>
  `;
  addTile.addEventListener('click', openGuideCatModal);
  shelf.appendChild(addTile);
}

// ── Main content dispatcher ───────────────────────────────

function renderGuideContent() {
  renderGuideShelf();

  const placeholder = document.getElementById('guide-placeholder');
  const grid        = document.getElementById('guide-detail-grid');

  // Search mode
  if (guideSearchQuery.trim().length >= 2) {
    placeholder.classList.add('hidden');
    grid.classList.remove('hidden');
    renderGuideSearchResults();
    renderSearchSidebar();
    hideSidebarBookmarks();
    return;
  }

  // Single guide open
  if (activeGuideId) {
    const result = findGuide(activeGuideId);
    if (!result) { activeGuideId = null; renderGuideContent(); return; }
    placeholder.classList.add('hidden');
    grid.classList.remove('hidden');
    renderSingleGuide(activeGuideId);
    return;
  }

  // Book (category) selected → chapter list
  if (state.activeGuideCategoryId) {
    const cat = guideCategories.find(c => c.id === state.activeGuideCategoryId);
    if (!cat) { state.activeGuideCategoryId = null; renderGuideContent(); return; }
    placeholder.classList.add('hidden');
    grid.classList.remove('hidden');
    renderGuideChapterList(cat);
    renderSidebarForCategory(cat, null);
    hideSidebarBookmarks();
    return;
  }

  // Nothing selected
  placeholder.classList.remove('hidden');
  grid.classList.add('hidden');
}

// ── Chapter list (book detail) ────────────────────────────

function renderGuideChapterList(cat) {
  const main = document.getElementById('guide-main');
  main.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'guide-book-header';
  const catIdx = guideCategories.indexOf(cat);
  header.innerHTML = `
    <div class="guide-book-header-left">
      <span class="guide-book-header-swatch" id="guide-book-header-swatch-tmp"></span>
      <div>
        <h2 class="guide-book-detail-title">${escHtml(cat.name)}</h2>
        <div class="guide-book-detail-sub">${cat.guides.length} Kapitel</div>
      </div>
    </div>
    <div class="guide-book-header-actions"></div>
  `;
  // Apply book color to the swatch (inline style for custom hex, class for legacy)
  const swatch = header.querySelector('#guide-book-header-swatch-tmp');
  if (swatch) {
    swatch.removeAttribute('id');
    applyBookColor(swatch, cat, catIdx);
  }

  const actions = header.querySelector('.guide-book-header-actions');

  const importBtn = document.createElement('button');
  importBtn.className = 'btn-ghost';
  importBtn.title = '.md Datei(en) importieren';
  importBtn.textContent = '⬆ Import';
  importBtn.addEventListener('click', () => importGuideFromMd(cat.id));
  actions.appendChild(importBtn);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.textContent = '+ Kapitel';
  addBtn.addEventListener('click', () => openGuideModal(cat.id));
  actions.appendChild(addBtn);

  main.appendChild(header);

  const list = document.createElement('div');
  list.className = 'guide-chapter-list';

  if (cat.guides.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.style.padding = '30px 0';
    empty.textContent = 'Noch keine Kapitel in diesem Buch.';
    list.appendChild(empty);
  } else {
    cat.guides.forEach((guide, idx) => {
      list.appendChild(buildChapterRow(guide, cat, idx + 1));
    });
  }

  main.appendChild(list);

  const footer = document.createElement('div');
  footer.className = 'guide-chapter-list-footer';
  const addBtn2 = document.createElement('button');
  addBtn2.className = 'btn-ghost';
  addBtn2.textContent = '+ Kapitel hinzufügen';
  addBtn2.addEventListener('click', () => openGuideModal(cat.id));
  footer.appendChild(addBtn2);
  main.appendChild(footer);
}

function buildChapterRow(guide, cat, number) {
  const row = document.createElement('div');
  row.className = 'guide-chapter-row';

  row.innerHTML = `
    <span class="guide-chapter-num">${number}</span>
    <span class="guide-chapter-title">${escHtml(guide.title)}</span>
    <div class="guide-chapter-actions">
      <button class="guide-chapter-btn guide-chapter-fav" title="${guide.favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}">${guide.favorite ? '★' : '☆'}</button>
      <button class="guide-chapter-open" title="Öffnen">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `;

  const openChapter = () => {
    guide.lastOpened = new Date().toISOString();
    guide.openCount  = (guide.openCount || 0) + 1;
    saveGuideCategories();
    activeGuideId = guide.id;
    renderGuideContent();
  };

  row.addEventListener('click', e => {
    if (e.target.closest('.guide-chapter-actions')) return;
    openChapter();
  });

  row.querySelector('.guide-chapter-open').addEventListener('click', e => { e.stopPropagation(); openChapter(); });

  row.querySelector('.guide-chapter-fav').addEventListener('click', e => {
    e.stopPropagation();
    guide.favorite = !guide.favorite;
    saveGuideCategories();
    renderGuideContent();
  });

  return row;
}

// ── Single guide detail (chapter view) ────────────────────

function renderSingleGuide(guideId) {
  const result = findGuide(guideId);
  if (!result) { activeGuideId = null; renderGuideContent(); return; }
  const { guide, category } = result;

  const main = document.getElementById('guide-main');
  main.innerHTML = '';

  // Back button
  const back = document.createElement('button');
  back.className = 'btn-ghost guide-back-btn';
  back.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="guide-back-btn-label">${escHtml(category.name)}</span>
  `;
  back.addEventListener('click', () => { hideGuideScrollBtn(); activeGuideId = null; renderGuideContent(); });

  // Header
  const header = document.createElement('div');
  header.className = 'guide-detail-header';

  // Fixed toolbar row: back button (left) + action buttons (right)
  const toolbar = document.createElement('div');
  toolbar.className = 'guide-detail-toolbar';

  const titleArea = document.createElement('div');
  titleArea.className = 'guide-detail-title-area';
  titleArea.innerHTML = `
    <div class="guide-detail-title-row">
      ${guide.favorite ? '<span class="guide-fav-star guide-fav-star-lg">★</span>' : ''}
      <h2 class="guide-detail-title">${escHtml(guide.title)}</h2>
    </div>
    ${guide.description ? `<p class="guide-detail-desc">${escHtml(guide.description)}</p>` : ''}
    <div class="guide-detail-info-row">
      ${(guide.tags || []).map(t => `<span class="guide-tag">${escHtml(t)}</span>`).join('')}
      ${guide.createdAt ? `<span class="guide-detail-date">Erstellt: ${fmtDate(guide.createdAt)}</span>` : ''}
      ${guide.updatedAt ? `<span class="guide-detail-date">Bearbeitet: ${fmtDate(guide.updatedAt)}</span>` : ''}
    </div>
  `;

  const actions = document.createElement('div');
  actions.className = 'guide-detail-actions';

  const favBtn = document.createElement('button');
  favBtn.className = 'guide-detail-fav-btn';
  favBtn.title = guide.favorite ? 'Favorit entfernen' : 'Als Favorit markieren';
  favBtn.textContent = guide.favorite ? '★' : '☆';
  favBtn.addEventListener('click', () => {
    guide.favorite = !guide.favorite;
    saveGuideCategories();
    renderGuideContent();
  });

  const menuWrap = document.createElement('div');
  menuWrap.className = 'guide-detail-menu-wrap';
  const menuBtn = document.createElement('button');
  menuBtn.className = 'guide-detail-menu-btn';
  menuBtn.title = 'Weitere Optionen';
  menuBtn.innerHTML = '⋮';
  const dropdown = document.createElement('div');
  dropdown.className = 'guide-detail-menu-dropdown';

  const editItem = document.createElement('button');
  editItem.className = 'guide-detail-menu-item';
  editItem.textContent = '✏️ Bearbeiten';
  editItem.addEventListener('click', () => {
    dropdown.classList.remove('open');
    openGuideModal(category.id, guide.id);
  });

  const exportItem = document.createElement('button');
  exportItem.className = 'guide-detail-menu-item';
  exportItem.textContent = '⬇ Exportieren';
  exportItem.addEventListener('click', () => {
    dropdown.classList.remove('open');
    exportGuideAsMd(guide.id);
  });

  const deleteItem = document.createElement('button');
  deleteItem.className = 'guide-detail-menu-item danger';
  deleteItem.textContent = '🗑 Löschen';
  deleteItem.addEventListener('click', () => {
    dropdown.classList.remove('open');
    if (!confirm(`Kapitel „${guide.title}" löschen?`)) return;
    category.guides = category.guides.filter(g => g.id !== guide.id);
    activeGuideId = null;
    saveGuideCategories();
    renderGuideContent();
  });

  dropdown.append(editItem, exportItem, deleteItem);

  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    const willOpen = !dropdown.classList.contains('open');
    document.querySelectorAll('.guide-detail-menu-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.guide-detail-menu-btn.active').forEach(b => b.classList.remove('active'));
    if (willOpen) { dropdown.classList.add('open'); menuBtn.classList.add('active'); }
  });

  menuWrap.append(menuBtn, dropdown);
  actions.append(favBtn, menuWrap);
  toolbar.append(back, actions);
  header.append(toolbar, titleArea);

  // Content
  const content = document.createElement('div');
  content.className = 'guide-detail-content';
  const featuredBlockId = (category.featuredSnippet && category.featuredSnippet.guideId === guide.id)
    ? category.featuredSnippet.blockId
    : null;
  content.innerHTML = renderMarkdown(guide.content || '', guide.id, category.id, featuredBlockId);

  main.append(header, content);
  showGuideScrollBtn();

  renderSidebarForCategory(category, guide);
  renderSidebarBookmarks(guide.id);
}

// ── Sidebar: statistics + code snippet ────────────────────

function renderSidebarBookmarks(guideId) {
  const card = document.getElementById('guide-bookmarks-card');
  const body = document.getElementById('guide-bookmarks-body');
  if (!card || !body) return;
  card.classList.remove('hidden');

  const ids = guideBookmarks[guideId] || [];
  const blocks = ids.map(id => document.getElementById(id)).filter(Boolean);
  const count = blocks.length;
  bookmarkNavIndex = Math.min(bookmarkNavIndex, Math.max(0, count - 1));

  body.innerHTML = '';

  if (count === 0) {
    body.innerHTML = '<div class="guide-bm-empty">Keine Code-Bookmarks — 🔖 an einem Codeblock klicken</div>';
    return;
  }

  const nav = document.createElement('div');
  nav.className = 'guide-bm-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'guide-bm-btn';
  prevBtn.innerHTML = '↑';
  prevBtn.title = 'Vorheriger Bookmark';
  prevBtn.addEventListener('click', () => { bookmarkNavIndex = (bookmarkNavIndex - 1 + count) % count; jumpToBookmark(blocks[bookmarkNavIndex]); renderSidebarBookmarks(guideId); });

  const label = document.createElement('span');
  label.className = 'guide-bm-label';
  label.textContent = `Bookmark ${bookmarkNavIndex + 1} / ${count}`;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'guide-bm-btn';
  nextBtn.innerHTML = '↓';
  nextBtn.title = 'Nächster Bookmark';
  nextBtn.addEventListener('click', () => { bookmarkNavIndex = (bookmarkNavIndex + 1) % count; jumpToBookmark(blocks[bookmarkNavIndex]); renderSidebarBookmarks(guideId); });

  nav.append(prevBtn, label, nextBtn);
  body.appendChild(nav);

  const list = document.createElement('div');
  list.className = 'guide-bm-list';
  blocks.forEach((block, i) => {
    const lang = block.querySelector('.guide-code-lang');
    const item = document.createElement('button');
    item.className = 'guide-bm-item';
    item.innerHTML = `<span class="guide-bm-item-lang">${lang ? escHtml(lang.textContent) : 'code'}</span><span>Codeblock ${i + 1}</span>`;
    item.addEventListener('click', () => { bookmarkNavIndex = i; jumpToBookmark(block); renderSidebarBookmarks(guideId); });
    list.appendChild(item);
  });
  body.appendChild(list);
}

function hideSidebarBookmarks() {
  const card = document.getElementById('guide-bookmarks-card');
  if (card) card.classList.add('hidden');
}

function jumpToBookmark(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('guide-bm-flash');
  void el.offsetWidth;
  el.classList.add('guide-bm-flash');
  setTimeout(() => el.classList.remove('guide-bm-flash'), 900);
}

function showGuideScrollBtn() {
  let btn = document.getElementById('guide-scroll-top');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'guide-scroll-top';
    btn.title = 'Nach oben';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 12V4M4 7l4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);
  }
  btn.classList.add('visible');
}

function hideGuideScrollBtn() {
  const btn = document.getElementById('guide-scroll-top');
  if (btn) btn.classList.remove('visible');
}

function renderSidebarForCategory(cat, guide) {
  const statsBody   = document.getElementById('guide-stats-body');
  const snippetBody = document.getElementById('guide-snippet-body');
  const snippetLabel = document.getElementById('guide-snippet-label');
  if (!statsBody || !snippetBody) return;

  const stats = getCategoryStats(cat);

  const created  = guide ? guide.createdAt : stats.created;
  const updated  = guide ? guide.updatedAt : stats.updated;
  const opened   = guide ? guide.lastOpened : stats.opened;
  const mostReadGuide = stats.mostRead;

  statsBody.innerHTML = `
    <div class="b-free-row"><span class="b-free-label">Erstellt am</span><span class="b-free-val">${fmtDate(created)}</span></div>
    <div class="b-free-row"><span class="b-free-label">Zuletzt bearbeitet</span><span class="b-free-val">${fmtDate(updated)}</span></div>
    <div class="b-free-row"><span class="b-free-label">Zuletzt geöffnet</span><span class="b-free-val">${fmtOpenedFull(opened)}</span></div>
    <div class="b-free-divider"></div>
    <div class="b-free-row"><span class="b-free-label">Anzahl Kapitel</span><span class="b-free-val">${stats.count}</span></div>
    <div class="b-free-row"><span class="b-free-label">Favoriten (Kapitel)</span><span class="b-free-val">${stats.favCount}</span></div>
    <div class="b-free-row"><span class="b-free-label">Meist gelesenes Kapitel</span><span class="b-free-val guide-stat-truncate" title="${mostReadGuide ? escHtml(mostReadGuide.title) : ''}">${mostReadGuide ? escHtml(mostReadGuide.title) : '–'}</span></div>
  `;

  // Code snippet: only the book's explicitly chosen "featured" snippet.
  let snippetGuide = null;
  let block = null;

  if (cat.featuredSnippet) {
    const fg = cat.guides.find(g => g.id === cat.featuredSnippet.guideId);
    if (fg) {
      const fb = getCodeBlocksWithIds(fg.content, fg.id).find(b => b.id === cat.featuredSnippet.blockId);
      if (fb) { snippetGuide = fg; block = fb; }
    }
  }

  snippetLabel.textContent = 'Featured Snippet';

  if (!block) {
    snippetBody.innerHTML = `<p class="guide-snippet-empty">Kein Featured Snippet ausgewählt — ⭐ an einem Codeblock klicken.</p>`;
    return;
  }

  const idx = cat.guides.indexOf(snippetGuide) + 1;
  snippetBody.innerHTML = `
    <div class="guide-snippet-block">
      <div class="guide-snippet-header">
        <span class="guide-code-lang">${escHtml(block.lang)}</span>
        <button class="guide-copy-btn" onclick="copyCode(this)"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 11V3a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Kopieren</button>
      </div>
      <pre class="guide-code-pre guide-snippet-pre"><code>${escHtml(block.code)}</code></pre>
    </div>
    <div class="guide-snippet-ref">Kapitel: ${idx}. ${escHtml(snippetGuide.title)}</div>
  `;
}

function renderSearchSidebar() {
  const statsBody   = document.getElementById('guide-stats-body');
  const snippetBody = document.getElementById('guide-snippet-body');
  const snippetLabel = document.getElementById('guide-snippet-label');
  if (!statsBody || !snippetBody) return;
  const q = guideSearchQuery.trim();
  const results = getAllGuides().filter(g =>
    g.title.toLowerCase().includes(q.toLowerCase()) ||
    (g.description || '').toLowerCase().includes(q.toLowerCase()) ||
    (g.content || '').toLowerCase().includes(q.toLowerCase()) ||
    (g.tags || []).some(t => t.toLowerCase().includes(q.toLowerCase()))
  );
  statsBody.innerHTML = `
    <div class="b-free-row"><span class="b-free-label">Suchbegriff</span><span class="b-free-val">„${escHtml(q)}"</span></div>
    <div class="b-free-row"><span class="b-free-label">Treffer</span><span class="b-free-val">${results.length}</span></div>
  `;
  snippetLabel.textContent = 'Code-Snippet aus diesem Guide';
  snippetBody.innerHTML = `<p class="guide-snippet-empty">Wähle ein Ergebnis, um Details zu sehen.</p>`;
}

// ── Search ────────────────────────────────────────────────

function renderGuideSearchResults() {
  const main = document.getElementById('guide-main');
  const q = guideSearchQuery.toLowerCase().trim();
  main.innerHTML = `<div class="guide-search-header">Suchergebnisse für „<strong>${escHtml(guideSearchQuery.trim())}</strong>"</div>`;

  const results = getAllGuides().filter(g =>
    g.title.toLowerCase().includes(q) ||
    (g.description || '').toLowerCase().includes(q) ||
    (g.content || '').toLowerCase().includes(q) ||
    (g.tags || []).some(t => t.toLowerCase().includes(q))
  );

  const list = document.createElement('div');
  list.className = 'guide-chapter-list';

  if (results.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.style.padding = '30px 0';
    p.textContent = 'Keine Kapitel gefunden.';
    list.appendChild(p);
    main.appendChild(list);
    return;
  }

  results.forEach((g, i) => {
    const cat = guideCategories.find(c => c.id === g.categoryId);
    list.appendChild(buildSearchChapterRow(g, cat, i + 1));
  });

  main.appendChild(list);
}

function buildSearchChapterRow(guide, cat, number) {
  const row = document.createElement('div');
  row.className = 'guide-chapter-row';
  row.innerHTML = `
    <span class="guide-chapter-num">${number}</span>
    <div class="guide-chapter-title-wrap">
      <span class="guide-tag guide-tag-cat">${escHtml(cat.name)}</span>
      <span class="guide-chapter-title">${escHtml(guide.title)}</span>
    </div>
    <div class="guide-chapter-actions">
      <button class="guide-chapter-btn guide-chapter-fav" title="${guide.favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}">${guide.favorite ? '★' : '☆'}</button>
      <button class="guide-chapter-open" title="Öffnen">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `;

  const open = () => {
    guideSearchQuery = '';
    const input = document.getElementById('guide-search-input');
    if (input) input.value = '';
    state.activeGuideCategoryId = guide.categoryId;
    guide.lastOpened = new Date().toISOString();
    guide.openCount  = (guide.openCount || 0) + 1;
    saveGuideCategories();
    activeGuideId = guide.id;
    renderGuideContent();
  };

  row.addEventListener('click', e => {
    if (e.target.closest('.guide-chapter-actions')) return;
    open();
  });
  row.querySelector('.guide-chapter-open').addEventListener('click', e => { e.stopPropagation(); open(); });
  row.querySelector('.guide-chapter-fav').addEventListener('click', e => {
    e.stopPropagation();
    guide.favorite = !guide.favorite;
    saveGuideCategories();
    renderGuideContent();
  });

  return row;
}
// ── Modal ─────────────────────────────────────────────────

let guideModalCategoryId = null;
let guideModalGuideId    = null;

function openGuideModal(categoryId, guideId = null) {
  guideModalCategoryId = categoryId;
  guideModalGuideId    = guideId;

  const overlay = document.getElementById('guide-modal-overlay');
  const title   = document.getElementById('guide-modal-title');
  const titleIn = document.getElementById('guide-modal-title-input');
  const descIn  = document.getElementById('guide-modal-desc-input');
  const contIn  = document.getElementById('guide-modal-content-input');
  const tagsIn  = document.getElementById('guide-modal-tags-input');

  title.textContent = guideId ? 'Anleitung bearbeiten' : 'Neue Anleitung';

  if (guideId) {
    const { guide } = findGuide(guideId);
    titleIn.value = guide.title || '';
    descIn.value  = guide.description || '';
    contIn.value  = guide.content || '';
    tagsIn.value  = (guide.tags || []).join(', ');
  } else {
    titleIn.value = '';
    descIn.value  = '';
    contIn.value  = '';
    tagsIn.value  = '';
  }

  // Reset to editor tab
  setGuideModalTab('editor');
  overlay.classList.remove('hidden');
  setTimeout(() => titleIn.focus(), 50);
}

function closeGuideModal() {
  document.getElementById('guide-modal-overlay').classList.add('hidden');
  guideModalCategoryId = null;
  guideModalGuideId    = null;
}

function setGuideModalTab(tab) {
  const editorPane  = document.getElementById('guide-modal-editor-pane');
  const previewPane = document.getElementById('guide-modal-preview-pane');
  const editorTab   = document.getElementById('guide-tab-edit');
  const previewTab  = document.getElementById('guide-tab-preview');

  if (tab === 'editor') {
    editorPane.classList.remove('hidden');
    previewPane.classList.add('hidden');
    editorTab.classList.add('active');
    previewTab.classList.remove('active');
  } else {
    const raw = document.getElementById('guide-modal-content-input').value;
    const previewEl = document.getElementById('guide-modal-preview-content');
    previewEl.innerHTML = renderMarkdown(raw);
    editorPane.classList.add('hidden');
    previewPane.classList.remove('hidden');
    editorTab.classList.remove('active');
    previewTab.classList.add('active');
  }
}

// ── Modal event wiring (runs after DOM ready) ─────────────

// ── Category Modal ────────────────────────────────────────

// Widget-Instanz wird beim ersten initGuides() erzeugt (siehe unten),
// selectedCatColor bleibt als schlanker Zugriffspunkt für den Save-Handler.
let guideColorWidget = null;
let selectedCatColor = HUB_PALETTE_HEX[0]; // hex string

function openGuideCatModal() {
  document.getElementById('guide-cat-name-input').value = '';
  if (guideColorWidget) guideColorWidget.setValue(HUB_PALETTE_HEX[0]);
  document.getElementById('guide-cat-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('guide-cat-name-input').focus(), 50);
}

function closeGuideCatModal() {
  document.getElementById('guide-cat-modal-overlay').classList.add('hidden');
}

let _guidesInitialized = false;

function initGuides() {
  if (_guidesInitialized) {
    renderGuideContent();
    return;
  }
  _guidesInitialized = true;

  // Force repaint to fix CSS variable resolution in light mode
  const guideView = document.getElementById('view-guides');
  if (guideView) { void guideView.offsetHeight; }

  // Category modal: geteiltes Farb-Picker-Widget aus hub-utils.js
  guideColorWidget = initColorPickerWidget(
    { pickerId: 'guide-color-picker', previewId: 'guide-color-preview', addBtnId: 'guide-color-add-btn', libraryId: 'guide-color-library' },
    { initial: HUB_PALETTE_HEX[0], onChange: hex => { selectedCatColor = hex; } }
  );

  // Category modal: close
  document.getElementById('guide-cat-modal-close').addEventListener('click', closeGuideCatModal);
  document.getElementById('guide-cat-modal-cancel').addEventListener('click', closeGuideCatModal);
  document.getElementById('guide-cat-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('guide-cat-modal-overlay')) closeGuideCatModal();
  });

  // Category modal: save
  document.getElementById('guide-cat-modal-save').addEventListener('click', () => {
    const name = document.getElementById('guide-cat-name-input').value.trim();
    if (!name) { document.getElementById('guide-cat-name-input').focus(); return; }
    guideCategories.push({
      id:     crypto.randomUUID(),
      name,
      coverColor: selectedCatColor, // hex string
      guides: []
    });
    saveGuideCategories();
    closeGuideCatModal();
    renderGuideContent();
  });

  // Category modal: save on Enter in name field
  document.getElementById('guide-cat-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('guide-cat-modal-save').click();
  });

  // Search
  const searchInput = document.getElementById('guide-search-input');
  searchInput.addEventListener('input', () => {
    guideSearchQuery = searchInput.value;
    if (guideSearchQuery.trim().length >= 2) {
      state.activeGuideCategoryId = null;
      activeGuideId = null;
    }
    renderGuideContent();
  });

  // Modal tabs
  document.getElementById('guide-tab-edit').addEventListener('click', () => setGuideModalTab('editor'));
  document.getElementById('guide-tab-preview').addEventListener('click', () => setGuideModalTab('preview'));

  // Modal close
  document.getElementById('guide-modal-close').addEventListener('click', closeGuideModal);
  document.getElementById('guide-modal-cancel').addEventListener('click', closeGuideModal);
  document.getElementById('guide-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('guide-modal-overlay')) closeGuideModal();
  });

  // Modal save
  document.getElementById('guide-modal-save').addEventListener('click', () => {
    const title   = document.getElementById('guide-modal-title-input').value.trim();
    const desc    = document.getElementById('guide-modal-desc-input').value.trim();
    const content = document.getElementById('guide-modal-content-input').value.trim();
    const tagsRaw = document.getElementById('guide-modal-tags-input').value.trim();
    if (!title || !guideModalCategoryId) return;

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const cat  = guideCategories.find(c => c.id === guideModalCategoryId);
    if (!cat) return;

    if (guideModalGuideId) {
      const guide = cat.guides.find(g => g.id === guideModalGuideId);
      if (guide) {
        guide.title       = title;
        guide.description = desc;
        guide.content     = content;
        guide.tags        = tags;
        guide.updatedAt   = new Date().toISOString();
      }
    } else {
      cat.guides.push({
        id:          crypto.randomUUID(),
        title,
        description: desc,
        content,
        tags,
        favorite:    false,
        createdAt:   new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
      });
    }

    saveGuideCategories();
    closeGuideModal();

    if (guideModalGuideId && activeGuideId === guideModalGuideId) {
      renderSingleGuide(activeGuideId);
      renderGuideShelf();
    } else {
      activeGuideId = activeGuideId || null;
      if (!guideModalGuideId) state.activeGuideCategoryId = cat.id;
      renderGuideContent();
    }
  });

  // Insert snippet buttons in modal
  document.querySelectorAll('.guide-snippet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const textarea = document.getElementById('guide-modal-content-input');
      const snippet  = btn.dataset.snippet;
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const before = textarea.value.substring(0, start);
      const after  = textarea.value.substring(end);
      let insert = '';
      let cursorOffset = 0;
      switch (snippet) {
        case 'code':
          insert = '```javascript\n\n```';
          cursorOffset = 14;
          break;
        case 'h2':
          insert = '## Überschrift';
          cursorOffset = 15;
          break;
        case 'h3':
          insert = '### Unterüberschrift';
          cursorOffset = 20;
          break;
        case 'bold':
          insert = '**fett**';
          cursorOffset = 2;
          break;
        case 'list':
          insert = '- Punkt 1\n- Punkt 2\n- Punkt 3';
          cursorOffset = 2;
          break;
        case 'hr':
          insert = '\n---\n';
          cursorOffset = 5;
          break;
        case 'mark':
          insert = '==markierter Text==';
          cursorOffset = 2;
          break;
      }
      textarea.value = before + insert + after;
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + cursorOffset;
    });
  });

  // Grid/List view toggle for the bookshelf
  const gridBtn = document.getElementById('lib-view-grid');
  const listBtn = document.getElementById('lib-view-list');
  const shelf   = document.getElementById('guide-shelf');
  gridBtn.addEventListener('click', () => {
    shelf.classList.remove('list-mode');
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
  });
  listBtn.addEventListener('click', () => {
    shelf.classList.add('list-mode');
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
  });

  // Close chapter-detail meatball menu on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.guide-detail-menu-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.guide-detail-menu-btn.active').forEach(b => b.classList.remove('active'));
  });

  // Initial render
  renderGuideContent();
}
