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
let bookmarkNavIndex = 0;      // current position in bookmark navigation
let bookmarkNavGuideId = null; // Kapitel, zu dem bookmarkNavIndex gehört

function saveBookmarks() { DB.set('guideBookmarks', guideBookmarks); }

// Fenced code block  ```lang\n...\n```  — Sprachname darf auch c++, c#,
// objective-c, .net enthalten; Leerzeichen nach dem Sprachnamen sind erlaubt.
const GUIDE_FENCE_SRC = '```([\\w+#.-]*)[ \\t]*\\n([\\s\\S]*?)```';

// Windows-Zeilenenden (CRLF, z.B. aus importierten Dateien) vereinheitlichen —
// alle Markdown-Regeln rechnen mit \n.
function normalizeGuideNewlines(text) {
  return String(text || '').replace(/\r\n?/g, '\n');
}

// Stabile Block-ID: Hash aus Kapitel + Codeanfang + "wievielter Block mit
// genau diesem Anfang". Bewusst NICHT die Position im Kapitel — sonst ändern
// sich alle IDs (und Bookmarks/Featured Snippet gehen verloren), sobald
// weiter oben ein Codeblock eingefügt oder gelöscht wird.
function makeBlockId(guideId, code, occurrence) {
  let hash = 0;
  const str = guideId + '|' + code.slice(0, 80) + '|' + occurrence;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0; }
  return 'cb-' + Math.abs(hash).toString(36);
}

// Alle Codeblöcke eines Kapitels mit ihren IDs (code = Rohinhalt, ungetrimmt).
// Einzige Stelle, die IDs vergibt — Renderer, Seitenleiste und Bookmarks
// rechnen alle hierüber, damit die IDs garantiert übereinstimmen.
function listGuideCodeBlocks(content, guideId) {
  const text = normalizeGuideNewlines(content);
  const blocks = [];
  const seen = {};
  const re = new RegExp(GUIDE_FENCE_SRC, 'g');
  let m;
  while ((m = re.exec(text))) {
    const key = m[2].slice(0, 80);
    seen[key] = (seen[key] || 0) + 1;
    blocks.push({ lang: m[1], code: m[2], id: makeBlockId(guideId, m[2], seen[key] - 1) });
  }
  return blocks;
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

// Nach dem Bearbeiten eines Kapitels: Bookmarks + Featured Snippet auf die
// neuen Block-IDs übertragen. Unveränderte Blöcke behalten ihre ID ohnehin;
// hat sich nur der Codeanfang geändert, die Blockanzahl ist aber gleich
// geblieben, wird über die Position zugeordnet. Nicht mehr vorhandene Blöcke
// werden entfernt, statt als toter Eintrag liegen zu bleiben.
function remapGuideBlockRefs(cat, guide, oldContent) {
  const oldBlocks = listGuideCodeBlocks(oldContent, guide.id);
  const newBlocks = listGuideCodeBlocks(guide.content, guide.id);
  const newIds = new Set(newBlocks.map(b => b.id));
  const mapId = id => {
    if (newIds.has(id)) return id;
    const i = oldBlocks.findIndex(b => b.id === id);
    return (i !== -1 && oldBlocks.length === newBlocks.length) ? newBlocks[i].id : null;
  };
  if (guideBookmarks[guide.id]) {
    const mapped = [...new Set(guideBookmarks[guide.id].map(mapId).filter(Boolean))];
    if (mapped.length) guideBookmarks[guide.id] = mapped;
    else delete guideBookmarks[guide.id];
    saveBookmarks();
  }
  if (cat.featuredSnippet && cat.featuredSnippet.guideId === guide.id) {
    const id = mapId(cat.featuredSnippet.blockId);
    cat.featuredSnippet = id ? { guideId: guide.id, blockId: id } : null;
  }
}

// Bookmarks gelöschter Kapitel mit aufräumen
function forgetGuideBookmarks(guideIds) {
  let changed = false;
  guideIds.forEach(id => { if (guideBookmarks[id]) { delete guideBookmarks[id]; changed = true; } });
  if (changed) saveBookmarks();
}

// Einmalige Migration: alte Block-IDs (Hash inkl. Position) → neue
// positionsunabhängige IDs, CRLF-Inhalte → LF, verwaiste Bookmarks entfernen.
(function migrateGuideBlockIdsIfNeeded() {
  if (DB.get('guideBlockIdsV2', false)) return;
  const legacyId = (guideId, code, index) => {
    let hash = 0;
    const str = guideId + index + code.slice(0, 80);
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0; }
    return 'cb-' + Math.abs(hash).toString(36);
  };
  const liveGuideIds = new Set();
  guideCategories.forEach(cat => (cat.guides || []).forEach(g => liveGuideIds.add(g.id)));

  guideCategories.forEach(cat => {
    (cat.guides || []).forEach(guide => {
      const oldContent = guide.content || '';
      // Altes Schema: Regex nur mit \w* und direkt folgendem \n, ID mit Position
      const oldBlocks = [];
      const re = /```(\w*)\n([\s\S]*?)```/g;
      let m, idx = 0;
      while ((m = re.exec(oldContent))) oldBlocks.push({ id: legacyId(guide.id, m[2], idx++), code: normalizeGuideNewlines(m[2]) });

      guide.content = normalizeGuideNewlines(oldContent);
      const newBlocks = listGuideCodeBlocks(guide.content, guide.id);
      const mapId = (oldId, used) => {
        const ob = oldBlocks.find(b => b.id === oldId);
        const nb = ob && newBlocks.find(b => b.code === ob.code && !used.has(b.id));
        if (!nb) return null;
        used.add(nb.id);
        return nb.id;
      };
      if (guideBookmarks[guide.id]) {
        const used = new Set();
        const mapped = guideBookmarks[guide.id].map(id => mapId(id, used)).filter(Boolean);
        if (mapped.length) guideBookmarks[guide.id] = mapped;
        else delete guideBookmarks[guide.id];
      }
      if (cat.featuredSnippet && cat.featuredSnippet.guideId === guide.id) {
        const id = mapId(cat.featuredSnippet.blockId, new Set());
        cat.featuredSnippet = id ? { guideId: guide.id, blockId: id } : null;
      }
    });
    if (cat.featuredSnippet && !liveGuideIds.has(cat.featuredSnippet.guideId)) cat.featuredSnippet = null;
  });
  Object.keys(guideBookmarks).forEach(id => { if (!liveGuideIds.has(id)) delete guideBookmarks[id]; });
  saveGuideCategories();
  saveBookmarks();
  DB.set('guideBlockIdsV2', true);
})();

// ── Querverweise zwischen Kapiteln ───────────────────────
// [[Kapiteltitel]] sucht zuerst im aktuellen Buch, dann in allen Büchern;
// [[Buch/Kapitel]] legt das Buch explizit fest. Vergleich ohne Groß-/Kleinschreibung.
// Verweise hängen am Titel — nach dem Umbenennen eines Kapitels zeigt der
// alte Verweis als "nicht gefunden" an, statt still auf etwas anderes zu zeigen.
function unescGuideHtml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

function resolveGuideXref(name, preferCategoryId = null) {
  const norm = s => String(s || '').trim().toLowerCase();
  let bookName = null, title = name;
  const slash = name.indexOf('/');
  if (slash > 0) {
    const maybeBook = name.slice(0, slash);
    if (guideCategories.some(c => norm(c.name) === norm(maybeBook))) {
      bookName = maybeBook;
      title = name.slice(slash + 1);
    }
  }
  const cats = bookName
    ? guideCategories.filter(c => norm(c.name) === norm(bookName))
    : [...guideCategories].sort((a, b) => (b.id === preferCategoryId) - (a.id === preferCategoryId));
  for (const category of cats) {
    const guide = category.guides.find(g => norm(g.title) === norm(title));
    if (guide) return { guide, category };
  }
  return null;
}

// ── Markdown + Code renderer ─────────────────────────────
// Lightweight renderer: headings, bold, italic, code blocks,
// inline code, lists, tables, horizontal rules, links, Querverweise.

function renderMarkdown(raw, guideId = null, categoryId = null, featuredBlockId = null) {
  if (!raw) return '';
  raw = normalizeGuideNewlines(raw);

  // Block-IDs aus dem ROHEN (unescapten) Inhalt, damit sie exakt den IDs aus
  // listGuideCodeBlocks() entsprechen — nach escHtml() wäre der Hash für Code
  // mit <, >, & oder " ein anderer.
  const _rawBlockIds = guideId ? listGuideCodeBlocks(raw, guideId).map(b => b.id) : [];

  let html = escHtml(raw);

  // Code (Blöcke + Inline) wird als Platzhalter aus dem Text genommen und erst
  // ganz am Ende wieder eingesetzt — sonst greifen Überschriften, Listen,
  // Fett/Kursiv, Markierungen und der Absatz-Split auch INNERHALB von Code
  // (z.B. "# Kommentar" → Überschrift, Leerzeile → Block zerrissen).
  const _codeHtml = [];
  // Block-Platzhalter (Codeblöcke) tragen ein B, damit der Absatz-Split sie
  // von Inline-Platzhaltern (Inline-Code, Querverweise) unterscheiden kann —
  // ein Absatz nur aus Inline-Code braucht trotzdem sein <p>.
  const _stash = (h, block = false) => `\u0000${block ? 'B' : ''}${_codeHtml.push(h) - 1}\u0000`;

  // Fenced code blocks
  // Eigener Absatz (Leerzeilen drumherum), damit er nie in ein <p> gerät.
  let _blockIndex = 0;
  html = html.replace(new RegExp(GUIDE_FENCE_SRC, 'g'), (_, lang, code) => {
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
    return '\n\n' + _stash(renderCodeBlock(code, lang, { blockId, bookmarked, bookmarkBtnHtml: bmBtn, featureBtnHtml: featBtn }), true) + '\n\n';
  });

  // Inline code `...`
  html = html.replace(/`([^`]+)`/g, (_, code) => _stash(`<code class="guide-inline-code">${code}</code>`));

  // Querverweise [[Kapitel]], [[Buch/Kapitel]], [[Kapitel|Anzeigetext]]
  html = html.replace(/\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]+?))?\]\]/g, (_, target, label) => {
    const name = unescGuideHtml(target).trim();
    const ref  = resolveGuideXref(name, categoryId);
    const text = (label || target).trim(); // bereits escaped
    return _stash(ref
      ? `<a class="guide-link guide-xref" href="#" data-guide-xref="${ref.guide.id}" title="${escHtml(ref.category.name + ' · ' + ref.guide.title)}">${text}</a>`
      : `<span class="guide-xref-missing" title="${escHtml(`Kein Kapitel „${name}" gefunden`)}">${text}</span>`);
  });

  // Block-Elemente werden mit Leerzeilen umgeben, damit der Absatz-Split sie
  // immer als eigenen Block sieht — auch wenn sie direkt an Text anschließen
  // (sonst landet z.B. eine Liste ohne Leerzeile davor in einem <p>).
  const _block = h => `\n\n${h}\n\n`;

  // Headings
  html = html.replace(/^### (.+)$/gm, (_, t) => _block(`<h4 class="guide-h4">${t}</h4>`));
  html = html.replace(/^## (.+)$/gm,  (_, t) => _block(`<h3 class="guide-h3">${t}</h3>`));
  html = html.replace(/^# (.+)$/gm,   (_, t) => _block(`<h2 class="guide-h2">${t}</h2>`));

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Tables — detect block of lines starting with |
  html = html.replace(/((?:^\|.+\|[ \t]*(?:\n|$))+)/gm, match => {
    const lines = match.trim().split('\n').filter(l => l.trim());
    const isSep = l => /^\|[\s\-|:]+\|$/.test(l.trim()) && l.includes('-');
    const splitCells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    // Trennzeile (|---|:---:|---:|) liefert die Spaltenausrichtung
    const sepLine = lines.find(isSep);
    const aligns = sepLine ? splitCells(sepLine).map(c =>
      /^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : /^:-+$/.test(c) ? 'left' : ''
    ) : [];
    const rows = lines.filter(l => !isSep(l));
    // Ohne Trennzeile braucht es (wie bisher) mindestens Kopf + eine Zeile
    if (rows.length < (sepLine ? 1 : 2)) return match;
    const toCells = (line, tag) => splitCells(line)
      .map((cell, i) => `<${tag} class="guide-td"${aligns[i] ? ` style="text-align:${aligns[i]}"` : ''}>${cell}</${tag}>`).join('');
    const body = rows.slice(1).map(r => `<tr>${toCells(r, 'td')}</tr>`).join('');
    return _block(`<table class="guide-table"><thead><tr>${toCells(rows[0], 'th')}</tr></thead>${body ? `<tbody>${body}</tbody>` : ''}</table>`);
  });

  // Unordered list lines  - item
  html = html.replace(/((?:^- .+$\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
    return _block(`<ul class="guide-ul">${items}</ul>`);
  });

  // Ordered list lines  1. item
  html = html.replace(/((?:^\d+\. .+$\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return _block(`<ol class="guide-ol">${items}</ol>`);
  });

  // Text marker ==text==
  html = html.replace(/==(.+?)==/g, '<mark class="guide-mark">$1</mark>');

  // Horizontal rule
  html = html.replace(/^---$/gm, () => _block('<hr class="guide-hr">'));

  // Links [text](url) — http(s) und mailto; eine Klammerebene in der URL ist
  // erlaubt (z.B. Wikipedia-Links wie .../Foo_(Bar)).
  html = html.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)(?:[^()\s]|\([^()\s]*\))+)\)/g,
    '<a class="guide-link" href="$2" target="_blank" rel="noopener">$1</a>');

  // Paragraphs: double newlines → <p>
  html = html
    .split(/\n{2,}/)
    .map(block => {
      if (/^<(h[234]|ul|ol|hr|div|table)/.test(block.trim())) return block;
      if (/^\u0000B\d+\u0000$/.test(block.trim())) return block.trim(); // reiner Codeblock-Platzhalter
      const wrapped = block.trim().replace(/\n/g, '<br>');
      return wrapped ? `<p class="guide-p">${wrapped}</p>` : '';
    })
    .join('\n');

  // Platzhalter wieder durch das fertige Code-HTML ersetzen
  html = html.replace(/\u0000B?(\d+)\u0000/g, (_, i) => _codeHtml[i]);

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
  const nowFeatured = !(cur && cur.guideId === guideId && cur.blockId === blockId);
  cat.featuredSnippet = nowFeatured ? { guideId, blockId } : null;
  saveGuideCategories();
  // Nur Sterne + Seitenleiste aktualisieren statt alles neu zu rendern —
  // sonst springt die Leseposition im Kapitel.
  document.querySelectorAll('#guide-main .guide-feature-btn').forEach(b => {
    const active = nowFeatured && b === btn;
    b.classList.toggle('active', active);
    b.textContent = active ? '★' : '☆';
    b.title = active ? 'Als Bibliothek-Snippet entfernen' : 'Als Bibliothek-Snippet verwenden';
  });
  const found = findGuide(guideId);
  renderSidebarForCategory(cat, found ? found.guide : null);
};

// Returns all fenced code blocks of a guide together with their stable IDs
function getCodeBlocksWithIds(content, guideId) {
  return listGuideCodeBlocks(content, guideId)
    .map(b => ({ lang: b.lang || 'code', code: b.code.trimEnd(), id: b.id }));
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
  if (guide.favorite)      lines.push('favorite: true');
  if (guide.createdAt)     lines.push('created: ' + guide.createdAt);
  if (guide.updatedAt)     lines.push('updated: ' + guide.updatedAt);
  lines.push('---');
  lines.push('');
  lines.push(guide.content || '');
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = guide.title.replace(/[^a-z0-9äöüÄÖÜß ]/gi, '_') + '.md';
  // Erst im DOM klicken und die URL verzögert freigeben — sofortiges
  // revokeObjectURL bricht den Download in manchen Browsern ab.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Liest eine Datei als Text; Promise statt onload-Zähler, damit eine
// fehlerhafte Datei die übrigen nicht blockiert.
function readGuideFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function importGuideFromMd(categoryId) {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.md,.markdown,text/markdown';
  input.multiple = true;
  input.addEventListener('change', async () => {
    const cat = guideCategories.find(c => c.id === categoryId);
    if (!cat) return;
    const files = [...input.files];
    const results = await Promise.allSettled(files.map(readGuideFileAsText));
    const failed = [];
    results.forEach((res, i) => {
      const file = files[i];
      if (res.status !== 'fulfilled') { failed.push(file.name); return; }
      // BOM entfernen + CRLF vereinheitlichen (Dateien aus Windows-Editoren)
      const text = normalizeGuideNewlines(res.value).replace(/^﻿/, '');
      // Parse optional front matter
      let title = file.name.replace(/\.(md|markdown)$/i, '').replace(/_/g, ' ');
      let description = '';
      let tags = [];
      let favorite = false;
      const now = new Date().toISOString();
      let createdAt = now, updatedAt = now;
      let content = text;
      const fmMatch = text.match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/);
      if (fmMatch) {
        const fm = fmMatch[1];
        content  = (fmMatch[2] || '').trimStart();
        const t  = fm.match(/^title:\s*(.+)$/m);
        const d  = fm.match(/^description:\s*(.+)$/m);
        const tg = fm.match(/^tags:\s*(.+)$/m);
        const fv = fm.match(/^favorite:\s*(.+)$/m);
        if (t)  title       = t[1].trim();
        if (d)  description = d[1].trim();
        if (tg) tags        = tg[1].split(',').map(s => s.trim()).filter(Boolean);
        if (fv) favorite    = fv[1].trim().toLowerCase() === 'true';
        // Datumsangaben aus einem früheren Export übernehmen (nur gültige Werte)
        const isoOf = key => {
          const mm = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
          const d  = mm && new Date(mm[1].trim());
          return d && !isNaN(d) ? d.toISOString() : null;
        };
        createdAt = isoOf('created') || createdAt;
        updatedAt = isoOf('updated') || updatedAt;
      }
      cat.guides.push({
        id: crypto.randomUUID(), title, description, content, tags,
        favorite, createdAt, updatedAt,
      });
    });
    if (failed.length < files.length) {
      saveGuideCategories();
      renderGuideContent();
    }
    if (failed.length) alert(`Folgende Dateien konnten nicht gelesen werden:\n${failed.join('\n')}`);
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
  el.classList.remove('guide-book-custom');
  if (typeof cat.coverColor === 'string' && /^#/.test(cat.coverColor)) {
    // Nutzerdefinierte Farbe — zentral berechnete, themeabhängige Fläche
    // statt fest hardcodierter Buch-Optik.
    const v = applyUserColorVars(el, cat.coverColor);
    el.classList.add('guide-book-custom');
    el.style.background = `linear-gradient(160deg, ${v.bg} 0%, ${hexDarken(v.bg, 0.12)} 100%)`;
    el.style.color = v.text;
  } else {
    const legacyIdx = (typeof cat.coverColor === 'number') ? cat.coverColor : idx;
    el.classList.add('guide-book-' + (legacyIdx % GUIDE_BOOK_COLORS));
    el.style.background = '';
    el.style.color = '';
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
      forgetGuideBookmarks(cat.guides.map(g => g.id));
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

  // Nach-oben-Button gehört nur zur Kapitelansicht — renderSingleGuide()
  // blendet ihn wieder ein, alle anderen Ansichten lassen ihn versteckt.
  hideGuideScrollBtn();
  // Ebenso das Inhaltsverzeichnis (kann auf schmalen Screens in #guide-main
  // hängen, das die Teil-Render gleich leeren)
  hideGuideToc();

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

  const editBookBtn = document.createElement('button');
  editBookBtn.className = 'btn-ghost';
  editBookBtn.title = 'Name und Farbe des Buches ändern';
  editBookBtn.textContent = '✏️ Buch bearbeiten';
  editBookBtn.addEventListener('click', () => openGuideCatModal(cat.id));
  actions.appendChild(editBookBtn);

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
    if (cat.guides.length > 1) enableGuideChapterReorder(list, cat);
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

// ── Gemeinsame Kapitel-Aktionen ───────────────────────────
// Werden von Kapitelübersicht, Suche, Detailansicht und Querverweisen
// gleichermaßen genutzt, damit Statistik/Aufräumen überall identisch laufen.

function openGuideChapter(guideId) {
  const found = findGuide(guideId);
  if (!found) return;
  const { guide, category } = found;
  guideSearchQuery = '';
  const input = document.getElementById('guide-search-input');
  if (input) input.value = '';
  guide.lastOpened = new Date().toISOString();
  guide.openCount  = (guide.openCount || 0) + 1;
  saveGuideCategories();
  state.activeGuideCategoryId = category.id;
  activeGuideId = guide.id;
  renderGuideContent();
}

async function deleteGuideChapter(category, guide) {
  const ok = await hubConfirm({
    title: 'Kapitel löschen?',
    message: `„${guide.title}" wird endgültig gelöscht.`,
    confirmText: 'Löschen',
    danger: true,
  });
  if (!ok) return;
  category.guides = category.guides.filter(g => g.id !== guide.id);
  forgetGuideBookmarks([guide.id]);
  if (category.featuredSnippet && category.featuredSnippet.guideId === guide.id) category.featuredSnippet = null;
  if (activeGuideId === guide.id) activeGuideId = null;
  saveGuideCategories();
  renderGuideContent();
}

function buildChapterRow(guide, cat, number) {
  const row = document.createElement('div');
  row.className = 'guide-chapter-row';
  row.dataset.guideId = guide.id;

  row.innerHTML = `
    <button class="guide-chapter-drag" title="Ziehen zum Umsortieren (oder Pfeiltasten)" aria-label="Kapitel verschieben">
      <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><circle cx="3.5" cy="3" r="1.3"/><circle cx="8.5" cy="3" r="1.3"/><circle cx="3.5" cy="7" r="1.3"/><circle cx="8.5" cy="7" r="1.3"/><circle cx="3.5" cy="11" r="1.3"/><circle cx="8.5" cy="11" r="1.3"/></svg>
    </button>
    <span class="guide-chapter-num">${number}</span>
    <span class="guide-chapter-title">${escHtml(guide.title)}</span>
    <div class="guide-chapter-actions">
      <button class="guide-chapter-btn guide-chapter-edit" title="Bearbeiten">✏️</button>
      <button class="guide-chapter-btn guide-chapter-export" title="Als Markdown exportieren">⬇</button>
      <button class="guide-chapter-btn guide-chapter-delete" title="Löschen">🗑</button>
      <button class="guide-chapter-btn guide-chapter-fav" title="${guide.favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}">${guide.favorite ? '★' : '☆'}</button>
      <button class="guide-chapter-open" title="Öffnen">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `;

  row.addEventListener('click', e => {
    if (e.target.closest('.guide-chapter-actions, .guide-chapter-drag')) return;
    openGuideChapter(guide.id);
  });

  const on = (sel, fn) => row.querySelector(sel).addEventListener('click', e => { e.stopPropagation(); fn(); });
  on('.guide-chapter-open',   () => openGuideChapter(guide.id));
  on('.guide-chapter-edit',   () => openGuideModal(cat.id, guide.id));
  on('.guide-chapter-export', () => exportGuideAsMd(guide.id));
  on('.guide-chapter-delete', () => deleteGuideChapter(cat, guide));
  on('.guide-chapter-fav',    () => {
    guide.favorite = !guide.favorite;
    saveGuideCategories();
    renderGuideContent();
  });

  return row;
}

// Kapitel umsortieren: Pointer-Events statt HTML5-Drag&Drop, damit es mit
// Maus UND Touch funktioniert. Gezogen wird nur am Griff (⋮⋮), damit ein
// normaler Klick/Scroll auf der Zeile unverändert bleibt. Pfeiltasten auf dem
// Griff verschieben ebenfalls (Tastaturbedienung).
function enableGuideChapterReorder(list, cat) {
  const commitOrder = () => {
    const order = [...list.querySelectorAll('.guide-chapter-row')].map(r => r.dataset.guideId);
    const changed = order.some((id, i) => cat.guides[i] && cat.guides[i].id !== id);
    if (changed) {
      cat.guides.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      saveGuideCategories();
    }
    return changed;
  };

  list.querySelectorAll('.guide-chapter-drag').forEach(handle => {
    const row = handle.closest('.guide-chapter-row');

    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      row.classList.add('dragging');
      list.classList.add('reordering');

      const onMove = ev => {
        const target = [...list.querySelectorAll('.guide-chapter-row')].find(r => {
          if (r === row) return false;
          const b = r.getBoundingClientRect();
          return ev.clientY >= b.top && ev.clientY <= b.bottom;
        });
        if (!target) return;
        const b = target.getBoundingClientRect();
        list.insertBefore(row, ev.clientY > b.top + b.height / 2 ? target.nextSibling : target);
      };
      const onEnd = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
        row.classList.remove('dragging');
        list.classList.remove('reordering');
        if (commitOrder()) renderGuideContent();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    });

    handle.addEventListener('click', e => e.stopPropagation());

    handle.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const sibling = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling || !sibling.classList.contains('guide-chapter-row')) return;
      list.insertBefore(row, e.key === 'ArrowUp' ? sibling : sibling.nextSibling);
      if (commitOrder()) {
        renderGuideContent();
        // Fokus nach dem Neurendern auf dem Griff desselben Kapitels halten
        document.querySelector(`#guide-main .guide-chapter-row[data-guide-id="${row.dataset.guideId}"] .guide-chapter-drag`)?.focus();
      }
    });
  });
}

// ── Single guide detail (chapter view) ────────────────────

function renderSingleGuide(guideId) {
  const result = findGuide(guideId);
  if (!result) { activeGuideId = null; renderGuideContent(); return; }
  const { guide, category } = result;

  hideGuideToc(); // Karte aus #guide-main retten, bevor es geleert wird
  const main = document.getElementById('guide-main');
  main.innerHTML = '';

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
    deleteGuideChapter(category, guide);
  });

  const printItem = document.createElement('button');
  printItem.className = 'guide-detail-menu-item';
  printItem.textContent = '🖨 Drucken / PDF';
  printItem.addEventListener('click', () => {
    dropdown.classList.remove('open');
    printGuideChapter();
  });

  dropdown.append(editItem, exportItem, printItem, deleteItem);

  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    const willOpen = !dropdown.classList.contains('open');
    document.querySelectorAll('.guide-detail-menu-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.guide-detail-menu-btn.active').forEach(b => b.classList.remove('active'));
    if (willOpen) { dropdown.classList.add('open'); menuBtn.classList.add('active'); }
  });

  menuWrap.append(menuBtn, dropdown);
  actions.append(favBtn, menuWrap);
  header.append(titleArea, actions);

  // Content
  const content = document.createElement('div');
  content.className = 'guide-detail-content';
  const featuredBlockId = (category.featuredSnippet && category.featuredSnippet.guideId === guide.id)
    ? category.featuredSnippet.blockId
    : null;
  content.innerHTML = renderMarkdown(guide.content || '', guide.id, category.id, featuredBlockId);

  main.append(back, header, content);
  showGuideScrollBtn();

  renderGuideToc(content);
  renderSidebarForCategory(category, guide);
  renderSidebarBookmarks(guide.id);
}

// ── Inhaltsverzeichnis ────────────────────────────────────
// Wird aus den gerenderten Überschriften des Kapitels gebaut (erst ab zwei
// Überschriften, sonst lohnt es nicht). Desktop: Karte in der Seitenleiste;
// schmal (Seitenleiste rutscht unter den Inhalt): dieselbe Karte wird über
// den Kapitelinhalt umgehängt, damit sie vor dem Lesen erreichbar bleibt.
const guideTocMobileQuery = window.matchMedia('(max-width: 980px)');

function placeGuideToc() {
  const card = document.getElementById('guide-toc-card');
  const sidebar = document.getElementById('guide-sidebar');
  if (!card || !sidebar) return;
  const content = document.querySelector('#guide-main .guide-detail-content');
  if (guideTocMobileQuery.matches && content) {
    content.parentNode.insertBefore(card, content);
    card.classList.add('guide-toc-inline');
  } else if (card.parentNode !== sidebar) {
    sidebar.insertBefore(card, sidebar.firstChild);
    card.classList.remove('guide-toc-inline');
  }
}
guideTocMobileQuery.addEventListener('change', placeGuideToc);

function renderGuideToc(contentEl) {
  const card = document.getElementById('guide-toc-card');
  const body = document.getElementById('guide-toc-body');
  if (!card || !body) return;
  // Karte vor jedem Neurendern zurück in die Seitenleiste holen, weil
  // #guide-main gleich per innerHTML geleert wird.
  const sidebar = document.getElementById('guide-sidebar');
  const headings = contentEl ? [...contentEl.querySelectorAll('.guide-h2, .guide-h3, .guide-h4')] : [];
  if (headings.length < 2) {
    card.classList.add('hidden');
    if (sidebar && card.parentNode !== sidebar) sidebar.insertBefore(card, sidebar.firstChild);
    return;
  }
  body.innerHTML = '';
  headings.forEach((h, i) => {
    h.id = 'guide-heading-' + i;
    const level = h.classList.contains('guide-h2') ? 1 : h.classList.contains('guide-h3') ? 2 : 3;
    const item = document.createElement('button');
    item.className = 'guide-toc-item guide-toc-l' + level;
    item.textContent = h.textContent;
    item.addEventListener('click', () => h.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    body.appendChild(item);
  });
  card.classList.remove('hidden');
  placeGuideToc();
}

function hideGuideToc() {
  const card = document.getElementById('guide-toc-card');
  const sidebar = document.getElementById('guide-sidebar');
  if (!card) return;
  card.classList.add('hidden');
  if (sidebar && card.parentNode !== sidebar) sidebar.insertBefore(card, sidebar.firstChild);
}

// ── Druckansicht ──────────────────────────────────────────
// Druckt nur das offene Kapitel (über den Browser-Dialog auch als PDF
// speicherbar). Die Klasse am <body> schaltet die @media-print-Regeln in
// guides.css scharf, damit Drucken auf anderen Tabs unverändert bleibt.
function printGuideChapter() {
  document.body.classList.add('guide-printing');
  const cleanup = () => {
    document.body.classList.remove('guide-printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

// ── Sidebar: statistics + code snippet ────────────────────

function renderSidebarBookmarks(guideId) {
  const card = document.getElementById('guide-bookmarks-card');
  const body = document.getElementById('guide-bookmarks-body');
  if (!card || !body) return;
  card.classList.remove('hidden');

  // Navigationsposition gehört zum Kapitel — beim Kapitelwechsel neu starten
  if (bookmarkNavGuideId !== guideId) { bookmarkNavGuideId = guideId; bookmarkNavIndex = 0; }

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
      // Gescrollt wird #main (overflow-y:auto), nicht das Fenster —
      // scrollIntoView trifft den richtigen Scroll-Container automatisch.
      document.getElementById('view-guides')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      <pre class="guide-code-pre guide-snippet-pre"><code>${highlightCode(escHtml(block.code), block.lang)}</code></pre>
    </div>
    <div class="guide-snippet-ref">Kapitel: ${idx}. ${escHtml(snippetGuide.title)}</div>
  `;
}

function getGuideSearchResults() {
  const q = guideSearchQuery.toLowerCase().trim();
  return getAllGuides().filter(g =>
    g.title.toLowerCase().includes(q) ||
    (g.description || '').toLowerCase().includes(q) ||
    (g.content || '').toLowerCase().includes(q) ||
    (g.tags || []).some(t => t.toLowerCase().includes(q))
  );
}

// Seitenleiste im Suchmodus: Treffer je Buch + Codeblöcke, die den Begriff
// enthalten — so lässt sich ein gesuchtes Snippet direkt kopieren, ohne das
// Kapitel erst zu öffnen.
const GUIDE_SEARCH_CODE_HITS = 3;

function renderSearchSidebar() {
  const statsBody   = document.getElementById('guide-stats-body');
  const snippetBody = document.getElementById('guide-snippet-body');
  const snippetLabel = document.getElementById('guide-snippet-label');
  if (!statsBody || !snippetBody) return;
  const q = guideSearchQuery.trim();
  const results = getGuideSearchResults();

  const perBook = {};
  results.forEach(g => { perBook[g.categoryName] = (perBook[g.categoryName] || 0) + 1; });
  const bookRows = Object.entries(perBook)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `<div class="b-free-row"><span class="b-free-label guide-stat-truncate" title="${escHtml(name)}">${escHtml(name)}</span><span class="b-free-val">${n}</span></div>`)
    .join('');

  statsBody.innerHTML = `
    <div class="b-free-row"><span class="b-free-label">Suchbegriff</span><span class="b-free-val guide-stat-truncate">„${escHtml(q)}"</span></div>
    <div class="b-free-row"><span class="b-free-label">Treffer</span><span class="b-free-val">${results.length}</span></div>
    ${bookRows ? `<div class="b-free-divider"></div>${bookRows}` : ''}
  `;

  snippetLabel.textContent = 'Code-Treffer';
  const ql = q.toLowerCase();
  const hits = [];
  for (const g of results) {
    for (const b of getCodeBlocksWithIds(g.content, g.id)) {
      if (b.code.toLowerCase().includes(ql)) hits.push({ guide: g, block: b });
      if (hits.length >= GUIDE_SEARCH_CODE_HITS) break;
    }
    if (hits.length >= GUIDE_SEARCH_CODE_HITS) break;
  }
  if (!hits.length) {
    snippetBody.innerHTML = `<p class="guide-snippet-empty">Kein Codeblock enthält „${escHtml(q)}".</p>`;
    return;
  }
  snippetBody.innerHTML = hits.map(({ guide, block }) => `
    <div class="guide-snippet-hit">
      <div class="guide-snippet-block">
        <div class="guide-snippet-header">
          <span class="guide-code-lang">${escHtml(block.lang)}</span>
          <button class="guide-copy-btn" onclick="copyCode(this)"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 11V3a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Kopieren</button>
        </div>
        <pre class="guide-code-pre guide-snippet-pre"><code>${highlightCode(escHtml(block.code), block.lang)}</code></pre>
      </div>
      <button class="guide-snippet-ref guide-snippet-ref-link" data-guide-open="${guide.id}">${escHtml(guide.categoryName)} · ${escHtml(guide.title)}</button>
    </div>
  `).join('');
  snippetBody.querySelectorAll('[data-guide-open]').forEach(btn =>
    btn.addEventListener('click', () => openGuideChapter(btn.dataset.guideOpen)));
}

// ── Search ────────────────────────────────────────────────

function renderGuideSearchResults() {
  const main = document.getElementById('guide-main');
  main.innerHTML = `<div class="guide-search-header">Suchergebnisse für „<strong>${escHtml(guideSearchQuery.trim())}</strong>"</div>`;

  const results = getGuideSearchResults();

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

function buildSearchChapterRow(result, cat, number) {
  // getAllGuides() liefert Kopien — Favorit/Statistik müssen am Original
  // im guideCategories-Baum geändert werden, sonst speichert save nichts.
  const guide = findGuide(result.id)?.guide || result;
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

  const open = () => openGuideChapter(guide.id);

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
let guideModalSnapshot   = null; // Feldstand beim Öffnen, für die Rückfrage bei ungespeicherten Änderungen

function getGuideModalSnapshot() {
  return JSON.stringify(['title-input', 'desc-input', 'tags-input', 'content-input']
    .map(id => document.getElementById('guide-modal-' + id).value)
    .concat(document.getElementById('guide-modal-fav').checked));
}

function openGuideModal(categoryId, guideId = null) {
  guideModalCategoryId = categoryId;
  guideModalGuideId    = guideId;

  const title   = document.getElementById('guide-modal-title');
  const titleIn = document.getElementById('guide-modal-title-input');
  const descIn  = document.getElementById('guide-modal-desc-input');
  const contIn  = document.getElementById('guide-modal-content-input');
  const tagsIn  = document.getElementById('guide-modal-tags-input');
  const favIn   = document.getElementById('guide-modal-fav');

  title.textContent = guideId ? 'Anleitung bearbeiten' : 'Neue Anleitung';

  if (guideId) {
    const { guide } = findGuide(guideId);
    titleIn.value = guide.title || '';
    descIn.value  = guide.description || '';
    contIn.value  = guide.content || '';
    tagsIn.value  = (guide.tags || []).join(', ');
    favIn.checked = !!guide.favorite;
  } else {
    titleIn.value = '';
    descIn.value  = '';
    contIn.value  = '';
    tagsIn.value  = '';
    favIn.checked = false;
  }
  guideModalSnapshot = getGuideModalSnapshot();

  // Zuletzt genutzte Editor-Ansicht wiederherstellen
  setGuideModalTab(guideEditorMode);
  guideModal.open();
  setTimeout(() => titleIn.focus(), 50);
}

function closeGuideModal() {
  guideModal.close();
}

// Editor-Modus: 'editor' | 'split' (Editor + Live-Vorschau nebeneinander) |
// 'preview'. Die zuletzt gewählte Ansicht wird gemerkt.
let guideEditorMode = DB.get('guideEditorMode', 'editor');
let guidePreviewTimer = null;

function renderGuideModalPreview() {
  const raw = document.getElementById('guide-modal-content-input').value;
  // categoryId ohne guideId: Querverweise lösen gegen das aktuelle Buch auf,
  // Bookmark-/Snippet-Buttons gibt es in der Vorschau aber nicht.
  document.getElementById('guide-modal-preview-content').innerHTML = renderMarkdown(raw, null, guideModalCategoryId);
}

function setGuideModalTab(tab) {
  if (!['editor', 'split', 'preview'].includes(tab)) tab = 'editor';
  guideEditorMode = tab;
  DB.set('guideEditorMode', tab);

  const editorPane  = document.getElementById('guide-modal-editor-pane');
  const previewPane = document.getElementById('guide-modal-preview-pane');
  const box         = document.querySelector('#guide-modal-overlay .guide-modal-box');

  editorPane.classList.toggle('hidden', tab === 'preview');
  previewPane.classList.toggle('hidden', tab === 'editor');
  box.classList.toggle('split', tab === 'split');
  document.getElementById('guide-tab-edit').classList.toggle('active', tab === 'editor');
  document.getElementById('guide-tab-split').classList.toggle('active', tab === 'split');
  document.getElementById('guide-tab-preview').classList.toggle('active', tab === 'preview');

  if (tab !== 'editor') renderGuideModalPreview();
}

// ── Modal event wiring (runs after DOM ready) ─────────────

// ── Category Modal ────────────────────────────────────────

// Widget-Instanz wird beim ersten initGuides() erzeugt (siehe unten),
// selectedCatColor bleibt als schlanker Zugriffspunkt für den Save-Handler.
let guideColorWidget = null;
let selectedCatColor = HUB_PALETTE_HEX[0]; // hex string
let guideCatModalEditId = null;     // null = neues Buch, sonst ID des bearbeiteten Buches
let guideCatColorTouched = false;   // Farbe im Modal aktiv geändert?

// Ohne Argument: neues Buch anlegen. Mit Buch-ID: Name + Farbe bearbeiten.
function openGuideCatModal(editId = null) {
  const cat = typeof editId === 'string' ? guideCategories.find(c => c.id === editId) : null;
  guideCatModalEditId = cat ? cat.id : null;
  document.getElementById('guide-cat-modal-title').textContent = cat ? 'Buch bearbeiten' : 'Neues Buch';
  document.getElementById('guide-cat-modal-save').textContent = cat ? 'Speichern' : 'Erstellen';
  document.getElementById('guide-cat-name-input').value = cat ? cat.name : '';
  // Alte Bücher mit Pastell-Index (Zahl statt Hex) zeigen den Paletten-
  // Standard; ihre Farbe wird nur überschrieben, wenn wirklich eine neue
  // gewählt wird (guideCatColorTouched).
  const hex = cat && typeof cat.coverColor === 'string' && cat.coverColor.startsWith('#') ? cat.coverColor : HUB_PALETTE_HEX[0];
  if (guideColorWidget) guideColorWidget.setValue(hex);
  selectedCatColor = hex;
  guideCatColorTouched = false;
  guideCatModal.open();
  setTimeout(() => document.getElementById('guide-cat-name-input').focus(), 50);
}

function closeGuideCatModal() {
  guideCatModal.close();
}

// Modal-Handles werden einmalig beim ersten initGuides() erzeugt (siehe
// dort) — bis dahin no-op-Platzhalter, falls open/closeGuideModal vor der
// Initialisierung aufgerufen werden sollten.
let guideModal = { open(){}, close(){} };
let guideCatModal = { open(){}, close(){} };

let _guidesInitialized = false;

function initGuides() {
  if (_guidesInitialized) {
    renderGuideContent();
    return;
  }
  _guidesInitialized = true;

  // Category modal: geteiltes Farb-Picker-Widget aus hub-utils.js
  guideColorWidget = initColorPickerWidget(
    { pickerId: 'guide-color-picker', previewId: 'guide-color-preview', addBtnId: 'guide-color-add-btn', libraryId: 'guide-color-library' },
    { initial: HUB_PALETTE_HEX[0], onChange: hex => { selectedCatColor = hex; guideCatColorTouched = true; } }
  );

  guideCatModal = wireModal('guide-cat-modal-overlay', {
    closeIds: ['guide-cat-modal-close', 'guide-cat-modal-cancel'],
    inputId: 'guide-cat-name-input',
    saveId: 'guide-cat-modal-save',
  });

  // Category modal: save
  document.getElementById('guide-cat-modal-save').addEventListener('click', () => {
    const name = document.getElementById('guide-cat-name-input').value.trim();
    if (!name) { document.getElementById('guide-cat-name-input').focus(); return; }
    const editCat = guideCatModalEditId && guideCategories.find(c => c.id === guideCatModalEditId);
    if (editCat) {
      editCat.name = name;
      if (guideCatColorTouched || typeof editCat.coverColor === 'string') editCat.coverColor = selectedCatColor;
    } else {
      guideCategories.push({
        id:     crypto.randomUUID(),
        name,
        coverColor: selectedCatColor, // hex string
        guides: []
      });
    }
    saveGuideCategories();
    closeGuideCatModal();
    renderGuideContent();
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
  document.getElementById('guide-tab-split').addEventListener('click', () => setGuideModalTab('split'));
  document.getElementById('guide-tab-preview').addEventListener('click', () => setGuideModalTab('preview'));

  // Live-Vorschau im geteilten Modus — leicht entprellt, damit lange
  // Kapitel beim Tippen nicht bei jedem Tastendruck neu gerendert werden.
  document.getElementById('guide-modal-content-input').addEventListener('input', () => {
    if (guideEditorMode !== 'split') return;
    clearTimeout(guidePreviewTimer);
    guidePreviewTimer = setTimeout(renderGuideModalPreview, 150);
  });

  // Querverweise [[Kapitel]] im gelesenen Kapitel öffnen (nicht in der
  // Editor-Vorschau — dort würde der Klick das ungespeicherte Modal verlassen)
  document.getElementById('guide-main').addEventListener('click', e => {
    const link = e.target.closest('[data-guide-xref]');
    if (!link) return;
    e.preventDefault();
    openGuideChapter(link.dataset.guideXref);
    document.getElementById('view-guides')?.scrollIntoView({ block: 'start' });
  });
  document.getElementById('guide-modal-preview-content').addEventListener('click', e => {
    if (e.target.closest('[data-guide-xref]')) e.preventDefault();
  });

  // Kein saveId: Titel ist nur eines von mehreren Feldern (inkl. Markdown-
  // Textarea) — Enter soll hier nichts auslösen, nur Escape schließt.
  guideModal = wireModal('guide-modal-overlay', {
    closeIds: ['guide-modal-close', 'guide-modal-cancel'],
    inputId: 'guide-modal-title-input',
    onClose: () => { guideModalCategoryId = null; guideModalGuideId = null; guideModalSnapshot = null; },
    // X/Abbrechen/Backdrop/Escape: bei Änderungen erst nachfragen, damit ein
    // versehentlicher Klick daneben keinen langen Markdown-Text verwirft.
    beforeClose: () => getGuideModalSnapshot() === guideModalSnapshot || hubConfirm({
      title: 'Änderungen verwerfen?',
      message: 'Die Anleitung hat ungespeicherte Änderungen. Beim Schließen gehen sie verloren.',
      confirmText: 'Verwerfen',
      cancelText: 'Weiter bearbeiten',
      danger: true,
    }),
  });

  // Modal save
  document.getElementById('guide-modal-save').addEventListener('click', () => {
    const title   = document.getElementById('guide-modal-title-input').value.trim();
    const desc    = document.getElementById('guide-modal-desc-input').value.trim();
    const content = document.getElementById('guide-modal-content-input').value.trim();
    const tagsRaw = document.getElementById('guide-modal-tags-input').value.trim();
    const favorite = document.getElementById('guide-modal-fav').checked;
    if (!title || !guideModalCategoryId) return;

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const cat  = guideCategories.find(c => c.id === guideModalCategoryId);
    if (!cat) return;

    if (guideModalGuideId) {
      const guide = cat.guides.find(g => g.id === guideModalGuideId);
      if (guide) {
        const oldContent  = guide.content || '';
        guide.title       = title;
        guide.description = desc;
        guide.content     = content;
        guide.tags        = tags;
        guide.favorite    = favorite;
        guide.updatedAt   = new Date().toISOString();
        remapGuideBlockRefs(cat, guide, oldContent);
      }
    } else {
      cat.guides.push({
        id:          crypto.randomUUID(),
        title,
        description: desc,
        content,
        tags,
        favorite,
        createdAt:   new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
      });
    }

    saveGuideCategories();
    // close() setzt guideModalGuideId zurück (onClose) — vorher sichern
    const savedGuideId = guideModalGuideId;
    closeGuideModal();

    if (savedGuideId && activeGuideId === savedGuideId) {
      renderSingleGuide(activeGuideId);
      renderGuideShelf();
    } else {
      activeGuideId = activeGuideId || null;
      if (!savedGuideId) state.activeGuideCategoryId = cat.id;
      renderGuideContent();
    }
  });

  // Insert snippet buttons in modal
  // Markierter Text wird eingerahmt statt überschrieben; ohne Markierung wird
  // ein Platzhalter eingefügt und direkt markiert, damit man ihn überschreiben
  // kann. Zeilenbasierte Elemente (Überschrift, Liste, Codeblock, Trennlinie)
  // beginnen immer am Zeilenanfang, sonst rendert der Markdown-Renderer sie nicht.
  document.querySelectorAll('.guide-snippet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const textarea = document.getElementById('guide-modal-content-input');
      const snippet  = btn.dataset.snippet;
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const before = textarea.value.substring(0, start);
      let after    = textarea.value.substring(end);
      const sel   = textarea.value.substring(start, end);
      // Zeilenumbruch voranstellen, falls die Einfügestelle mitten in einer Zeile liegt
      const nl     = (before && !before.endsWith('\n')) ? '\n' : '';
      // ...und dahinter, falls danach noch Text in derselben Zeile folgt
      const nlAfter = (after && !after.startsWith('\n')) ? '\n' : '';
      // Bei Zeilenelementen kein führendes Leerzeichen in die neue Folgezeile mitnehmen
      const isLineSnippet = ['code', 'h2', 'h3', 'list', 'hr'].includes(snippet);
      if (isLineSnippet && nlAfter) after = after.replace(/^[ \t]+/, '');

      let prefix = '', text = '', suffix = '';
      switch (snippet) {
        case 'code':
          prefix = nl + '```javascript\n'; text = sel; suffix = '\n```' + nlAfter;
          break;
        case 'h2':
          prefix = nl + '## '; text = sel || 'Überschrift'; suffix = nlAfter;
          break;
        case 'h3':
          prefix = nl + '### '; text = sel || 'Unterüberschrift'; suffix = nlAfter;
          break;
        case 'bold':
          prefix = '**'; text = sel || 'fett'; suffix = '**';
          break;
        case 'mark':
          prefix = '=='; text = sel || 'markierter Text'; suffix = '==';
          break;
        case 'xref':
          prefix = '[['; text = sel || 'Kapitelname'; suffix = ']]';
          break;
        case 'list':
          if (sel) {
            prefix = nl; suffix = nlAfter;
            text = sel.split('\n').map(l => l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')).map(l => '- ' + l).join('\n');
          } else {
            prefix = nl + '- '; text = 'Punkt 1'; suffix = '\n- Punkt 2\n- Punkt 3' + nlAfter;
          }
          break;
        case 'hr':
          prefix = nl + '\n---\n' + (nlAfter ? '\n' : ''); text = ''; suffix = '';
          break;
        default:
          return;
      }
      textarea.value = before + prefix + text + suffix + after;
      textarea.focus();
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd   = start + prefix.length + text.length;
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
