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

// ── Markdown + Code renderer ─────────────────────────────
// Lightweight renderer: headings, bold, italic, code blocks,
// inline code, lists, horizontal rules, links.

function renderMarkdown(raw) {
  if (!raw) return '';
  let html = escHtml(raw);

  // Fenced code blocks  ```lang\n...\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = `<span class="guide-code-lang">${lang || 'code'}</span>`;
    return `<div class="guide-code-block"><div class="guide-code-header">${langLabel}<button class="guide-copy-btn" onclick="copyCode(this)"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 11V3a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Copy</button></div><pre class="guide-code-pre"><code>${code.trimEnd()}</code></pre></div>`;
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

// Copy code button handler (global so onclick works)
window.copyCode = function(btn) {
  const code = btn.closest('.guide-code-block').querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Kopiert!`;
    btn.style.color = 'var(--budget-income)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 1800);
  });
};


// ── Export / Import ───────────────────────────────────────

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
          renderGuideCategoryList();
          renderGuideCategoryContent();
        }
      };
      reader.readAsText(file);
    });
  });
  input.click();
}

// ── Category sidebar ──────────────────────────────────────

function renderGuideCategoryList() {
  const list  = document.getElementById('guide-category-list');
  const empty = document.getElementById('guide-category-empty');
  list.innerHTML = '';

  const filtered = guideSearchQuery
    ? null // in search mode, don't highlight a category
    : guideCategories;

  if (!guideSearchQuery && guideCategories.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  guideCategories.forEach(cat => {
    const count = cat.guides.length;
    const active = !guideSearchQuery && state.activeGuideCategoryId === cat.id;

    const btn = document.createElement('button');
    btn.className = 'guide-category-item' + (active ? ' active' : '');
    btn.innerHTML = `
      <span class="guide-category-icon">${cat.icon || '📁'}</span>
      <span class="guide-category-name">${escHtml(cat.name)}</span>
      <span class="guide-category-count">${count}</span>
    `;
    btn.addEventListener('click', () => {
      state.activeGuideCategoryId = cat.id;
      guideSearchQuery = '';
      document.getElementById('guide-search-input').value = '';
      activeGuideId = null;
      renderGuideCategoryList();
      renderGuideContent();
    });

    // Delete button
    const del = document.createElement('button');
    del.className = 'task-delete guide-cat-del';
    del.textContent = '✕';
    del.title = 'Kategorie löschen';    del.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Kategorie „${cat.name}" und alle ${count} Anleitungen löschen?`)) return;
      guideCategories = guideCategories.filter(c => c.id !== cat.id);
      if (state.activeGuideCategoryId === cat.id) {
        state.activeGuideCategoryId = null;
        activeGuideId = null;
      }
      saveGuideCategories();
      renderGuideCategoryList();
      renderGuideContent();
    });
    btn.appendChild(del);
    list.appendChild(btn);
  });
}

// ── Main content area ─────────────────────────────────────

function renderGuideContent() {
  const placeholder = document.getElementById('guide-placeholder');
  const catView     = document.getElementById('guide-category-view');
  const detailView  = document.getElementById('guide-detail-view');

  // Search mode
  if (guideSearchQuery.trim().length >= 2) {
    placeholder.classList.add('hidden');
    detailView.classList.add('hidden');
    catView.classList.remove('hidden');
    renderGuideSearchResults();
    return;
  }

  // Detail view (single guide open)
  if (activeGuideId) {
    placeholder.classList.add('hidden');
    catView.classList.add('hidden');
    detailView.classList.remove('hidden');
    renderSingleGuide(activeGuideId);
    return;
  }

  // Category list view
  if (state.activeGuideCategoryId) {
    placeholder.classList.add('hidden');
    detailView.classList.add('hidden');
    catView.classList.remove('hidden');
    renderGuideCategoryContent();
    return;
  }

  // Nothing selected → placeholder
  placeholder.classList.remove('hidden');
  catView.classList.add('hidden');
  detailView.classList.add('hidden');
}

// ── Category content (list of guide cards) ───────────────

function renderGuideCategoryContent() {
  const cat = guideCategories.find(c => c.id === state.activeGuideCategoryId);
  if (!cat) return;

  const header = document.getElementById('guide-cat-header');
  const list   = document.getElementById('guide-cat-list');
  header.innerHTML = '';
  list.innerHTML   = '';

  // Header row
  const titleBlock = document.createElement('div');
  titleBlock.className = 'guide-cat-title-block';
  titleBlock.innerHTML = `
    <span class="guide-cat-big-icon">${cat.icon || '📁'}</span>
    <div>
      <h2 class="guide-cat-title">${escHtml(cat.name)}</h2>
      <div class="guide-cat-subtitle">${cat.guides.length} Anleitung${cat.guides.length !== 1 ? 'en' : ''}</div>
    </div>
  `;
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.textContent = '+ Anleitung';
  addBtn.addEventListener('click', () => openGuideModal(cat.id));
  const importBtn = document.createElement('button');
  importBtn.className = 'btn-ghost';
  importBtn.textContent = '⬆ Import';
  importBtn.title = '.md Datei(en) importieren';
  importBtn.addEventListener('click', () => importGuideFromMd(cat.id));
  header.appendChild(titleBlock);
  const headerBtns = document.createElement('div');
  headerBtns.style.cssText = 'display:flex;gap:8px;';
  headerBtns.append(importBtn, addBtn);
  header.appendChild(headerBtns);

  if (cat.guides.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.style.padding = '30px 0';
    empty.textContent = 'Noch keine Anleitungen in dieser Kategorie.';
    list.appendChild(empty);
    return;
  }

  // Sort: favorites first, then by updatedAt desc
  const sorted = [...cat.guides].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  sorted.forEach(guide => {
    list.appendChild(buildGuideCard(guide, cat.id));
  });
}

function buildGuideCard(guide, categoryId) {
  const card = document.createElement('div');
  card.className = 'guide-card-item' + (guide.favorite ? ' guide-fav' : '');

  const tags = (guide.tags || []).map(t =>
    `<span class="guide-tag">${escHtml(t)}</span>`
  ).join('');

  const updDate = guide.updatedAt
    ? new Date(guide.updatedAt).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })
    : '';

  card.innerHTML = `
    <div class="guide-card-top">
      <div class="guide-card-meta-row">
        ${guide.favorite ? '<span class="guide-fav-star" title="Favorit">★</span>' : ''}
        <h3 class="guide-card-title">${escHtml(guide.title)}</h3>
      </div>
      ${guide.description ? `<p class="guide-card-desc">${escHtml(guide.description)}</p>` : ''}
      ${tags ? `<div class="guide-tags-row">${tags}</div>` : ''}
    </div>
    <div class="guide-card-footer">
      ${updDate ? `<span class="guide-card-date">Bearbeitet: ${updDate}</span>` : ''}
      <div class="guide-card-actions">
        <button class="btn-ghost guide-card-btn guide-fav-toggle" title="${guide.favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}">
          ${guide.favorite ? '★' : '☆'}
        </button>
        <button class="btn-ghost guide-card-btn guide-edit-btn" title="Bearbeiten">✏️</button>
        <button class="task-delete guide-card-btn guide-del-btn" style="opacity:1;" title="Löschen">✕</button>
      </div>
    </div>
  `;

  // Click on card → open detail
  card.addEventListener('click', e => {
    if (e.target.closest('.guide-card-btn')) return;
    activeGuideId = guide.id;
    renderGuideContent();
  });

  // Favorite toggle
  card.querySelector('.guide-fav-toggle').addEventListener('click', e => {
    e.stopPropagation();
    guide.favorite = !guide.favorite;
    saveGuideCategories();
    renderGuideCategoryContent();
  });

  // Edit
  card.querySelector('.guide-edit-btn').addEventListener('click', e => {
    e.stopPropagation();
    openGuideModal(categoryId, guide.id);
  });

  // Delete
  card.querySelector('.guide-del-btn').addEventListener('click', e => {
    e.stopPropagation();
    if (!confirm(`Anleitung „${guide.title}" löschen?`)) return;
    const cat = guideCategories.find(c => c.id === categoryId);
    if (cat) cat.guides = cat.guides.filter(g => g.id !== guide.id);
    if (activeGuideId === guide.id) activeGuideId = null;
    saveGuideCategories();
    renderGuideCategoryContent();
    renderGuideContent();
  });

  return card;
}

// ── Single guide detail ───────────────────────────────────

function renderSingleGuide(guideId) {
  const result = findGuide(guideId);
  if (!result) { activeGuideId = null; renderGuideContent(); return; }
  const { guide, category } = result;

  const view = document.getElementById('guide-detail-view');
  view.innerHTML = '';

  // Back button
  const back = document.createElement('button');
  back.className = 'btn-ghost guide-back-btn';
  back.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    ${escHtml(category.name)}
  `;
  back.addEventListener('click', () => { activeGuideId = null; renderGuideContent(); });

  // Header
  const header = document.createElement('div');
  header.className = 'guide-detail-header';

  const titleArea = document.createElement('div');
  titleArea.innerHTML = `
    <div class="guide-detail-title-row">
      ${guide.favorite ? '<span class="guide-fav-star guide-fav-star-lg">★</span>' : ''}
      <h2 class="guide-detail-title">${escHtml(guide.title)}</h2>
    </div>
    ${guide.description ? `<p class="guide-detail-desc">${escHtml(guide.description)}</p>` : ''}
    <div class="guide-detail-info-row">
      ${(guide.tags || []).map(t => `<span class="guide-tag">${escHtml(t)}</span>`).join('')}
      ${guide.createdAt ? `<span class="guide-detail-date">Erstellt: ${new Date(guide.createdAt).toLocaleDateString('de-DE')}</span>` : ''}
      ${guide.updatedAt ? `<span class="guide-detail-date">Bearbeitet: ${new Date(guide.updatedAt).toLocaleDateString('de-DE')}</span>` : ''}
    </div>
  `;

  const actions = document.createElement('div');
  actions.className = 'guide-detail-actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-ghost';
  editBtn.textContent = '✏️ Bearbeiten';
  editBtn.addEventListener('click', () => openGuideModal(category.id, guide.id));
  const favBtn = document.createElement('button');
  favBtn.className = 'btn-ghost';
  favBtn.textContent = guide.favorite ? '★ Favorit' : '☆ Favorit';
  favBtn.addEventListener('click', () => {
    guide.favorite = !guide.favorite;
    saveGuideCategories();
    renderSingleGuide(guideId);
  });
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn-ghost';
  exportBtn.textContent = '⬇ Export';
  exportBtn.title = 'Als .md herunterladen';
  exportBtn.addEventListener('click', () => exportGuideAsMd(guide.id));
  actions.append(favBtn, editBtn, exportBtn);
  header.append(titleArea, actions);

  // Content
  const content = document.createElement('div');
  content.className = 'guide-detail-content';
  content.innerHTML = renderMarkdown(guide.content || '');

  view.append(back, header, content);
  // Apply syntax highlighting after DOM insertion
}

// ── Search ────────────────────────────────────────────────

function renderGuideSearchResults() {
  const header = document.getElementById('guide-cat-header');
  const list   = document.getElementById('guide-cat-list');
  const q      = guideSearchQuery.toLowerCase().trim();
  header.innerHTML = `<div class="guide-search-header">Suchergebnisse für „<strong>${escHtml(q)}</strong>"</div>`;
  list.innerHTML = '';

  const results = getAllGuides().filter(g =>
    g.title.toLowerCase().includes(q) ||
    (g.description || '').toLowerCase().includes(q) ||
    (g.content || '').toLowerCase().includes(q) ||
    (g.tags || []).some(t => t.toLowerCase().includes(q))
  );

  if (results.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.style.padding = '30px 0';
    p.textContent = 'Keine Anleitungen gefunden.';
    list.appendChild(p);
    return;
  }

  results.forEach(g => {
    const card = buildGuideCard(g, g.categoryId);
    // Add category badge
    const badge = document.createElement('span');
    badge.className = 'guide-tag guide-tag-cat';
    badge.textContent = g.categoryName;
    card.querySelector('.guide-card-top').prepend(badge);
    list.appendChild(card);
  });
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
  const previewBtn = document.getElementById('guide-modal-preview-btn');

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
  const editorTab   = document.getElementById('guide-modal-tab-editor');
  const previewTab  = document.getElementById('guide-modal-tab-preview');

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

let selectedCatEmoji = '📁';

function openGuideCatModal() {
  selectedCatEmoji = '📁';
  document.getElementById('guide-cat-name-input').value = '';
  document.getElementById('guide-cat-emoji-custom').value = '';
  // Reset emoji grid selection
  document.querySelectorAll('.guide-emoji-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.emoji === '📁');
  });
  document.getElementById('guide-cat-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('guide-cat-name-input').focus(), 50);
}

function closeGuideCatModal() {
  document.getElementById('guide-cat-modal-overlay').classList.add('hidden');
}

function initGuides() {
  // Add category → open modal
  document.getElementById('add-guide-category-btn').addEventListener('click', openGuideCatModal);

  // Category modal: emoji grid clicks
  document.getElementById('guide-emoji-grid').addEventListener('click', e => {
    const btn = e.target.closest('.guide-emoji-btn');
    if (!btn) return;
    selectedCatEmoji = btn.dataset.emoji;
    document.querySelectorAll('.guide-emoji-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('guide-cat-emoji-custom').value = '';
  });

  // Category modal: custom emoji input overrides grid
  document.getElementById('guide-cat-emoji-custom').addEventListener('input', e => {
    const val = e.target.value.trim();
    if (val) {
      selectedCatEmoji = val;
      document.querySelectorAll('.guide-emoji-btn').forEach(b => b.classList.remove('active'));
    } else {
      selectedCatEmoji = '📁';
      document.querySelector('.guide-emoji-btn[data-emoji="📁"]').classList.add('active');
    }
  });

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
      icon:   selectedCatEmoji || '📁',
      guides: []
    });
    saveGuideCategories();
    closeGuideCatModal();
    renderGuideCategoryList();
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
    renderGuideCategoryList();
    renderGuideContent();
  });

  // Modal tabs
  document.getElementById('guide-modal-tab-editor').addEventListener('click', () => setGuideModalTab('editor'));
  document.getElementById('guide-modal-tab-preview').addEventListener('click', () => setGuideModalTab('preview'));

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
    } else {
      renderGuideCategoryContent();
      renderGuideContent();
    }
    renderGuideCategoryList();
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

  // Initial render
  renderGuideCategoryList();
  renderGuideContent();
}
