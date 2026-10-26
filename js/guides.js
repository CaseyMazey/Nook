// =========================
// GUIDES — Developer Wiki
// =========================

let guideCategories = DB.get('guideCategories', []);
let guideSearchQuery = '';
let activeGuideId = null; // currently open guide

function saveGuideCategories() {
  if (!DB.set('guideCategories', guideCategories)) warnGuideStorageFull();
}

// localStorage ist pro Browser begrenzt (meist ~5 MB). Schlägt das Speichern
// fehl, gingen Änderungen sonst still verloren — daher ein (gedrosselter) Hinweis.
let guideStorageWarnedAt = 0;
function warnGuideStorageFull() {
  if (Date.now() - guideStorageWarnedAt < 60000) return;
  guideStorageWarnedAt = Date.now();
  alert('Speichern fehlgeschlagen: Der Browser-Speicher ist voll.\n\nDeine letzte Änderung ist nur bis zum Neuladen erhalten. Exportiere große Bücher als Backup und entferne nicht mehr benötigte Kapitel, um Platz zu schaffen.');
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

function saveBookmarks() { if (!DB.set('guideBookmarks', guideBookmarks)) warnGuideStorageFull(); }

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
  const _taskCounter = { n: 0 }; // fortlaufende Checklisten-Nummer im Kapitel
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

  // Escapes: \* \_ \# \= \~ \[ \] \| \` \\ \- \+ \. \! \> stehen wörtlich da,
  // statt Formatierung auszulösen (nach Inline-Code, damit Code unberührt bleibt)
  html = html.replace(/\\(&gt;|[\\*_#=~\[\]|`+\-.!])/g, (_, ch) => _stash(ch));

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

  // Headings # … ###### (# → h2, weil h1 der Kapiteltitel ist)
  html = html.replace(/^(#{1,6}) (.+)$/gm, (_, hashes, t) => {
    const tag = 'h' + Math.min(hashes.length + 1, 6);
    return _block(`<${tag} class="guide-${tag}">${t}</${tag}>`);
  });

  // Zitate  > Text  (aufeinanderfolgende Zeilen bilden einen Block)
  html = html.replace(/((?:^&gt; ?.*(?:\n|$))+)/gm, match => {
    const lines = match.replace(/\n$/, '').split('\n').map(l => l.replace(/^&gt; ?/, ''));
    return _block(`<blockquote class="guide-quote">${lines.join('<br>')}</blockquote>`);
  });

  // Listen: -, *, + und 1. — verschachtelt über Einrückung, inkl. Checklisten
  html = html.replace(/((?:^[ \t]*(?:[-*+]|\d+\.)[ \t]+.*(?:\n|$))+)/gm,
    match => _block(buildGuideList(match, guideId ? _taskCounter : null)));

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
    // Zeilen mit \n getrennt, damit Fett/Kursiv nie über Zellgrenzen hinweg greift
    const body = rows.slice(1).map(r => `<tr>${toCells(r, 'td')}</tr>`).join('\n');
    return _block(`<table class="guide-table"><thead><tr>${toCells(rows[0], 'th')}</tr></thead>${body ? `<tbody>\n${body}\n</tbody>` : ''}</table>`);
  });

  // Horizontal rule  --- / *** / ___
  html = html.replace(/^(?:-{3,}|\*{3,}|_{3,})$/gm, () => _block('<hr class="guide-hr">'));

  // Links [text](url) — http(s) und mailto; eine Klammerebene in der URL ist
  // erlaubt (z.B. Wikipedia-Links wie .../Foo_(Bar)). Die URL wird
  // zwischengeparkt, damit _ oder * darin nicht als Kursiv/Fett gelten.
  html = html.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)(?:[^()\s]|\([^()\s]*\))+)\)/g,
    (_, text, url) => `<a class="guide-link" href="${_stash(url)}" target="_blank" rel="noopener">${text}</a>`);

  // Fett / Kursiv / Durchgestrichen / Markierung
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // _kursiv_ / __fett__ nur an Wortgrenzen — snake_case_namen bleiben unberührt
  html = html.replace(/(^|[^\w])__(?=\S)(.+?)__(?!\w)/gm, '$1<strong>$2</strong>');
  html = html.replace(/(^|[^\w])_(?=\S)([^_\n]+?)_(?!\w)/gm, '$1<em>$2</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/==(.+?)==/g, '<mark class="guide-mark">$1</mark>');

  // Paragraphs: double newlines → <p>
  html = html
    .split(/\n{2,}/)
    .map(block => {
      if (/^<(h[2-6]|ul|ol|hr|div|table|blockquote)/.test(block.trim())) return block;
      if (/^\u0000B\d+\u0000$/.test(block.trim())) return block.trim(); // reiner Codeblock-Platzhalter
      const wrapped = block.trim().replace(/\n/g, '<br>');
      return wrapped ? `<p class="guide-p">${wrapped}</p>` : '';
    })
    .join('\n');

  // Platzhalter wieder durch das fertige Code-HTML ersetzen
  html = html.replace(/\u0000B?(\d+)\u0000/g, (_, i) => _codeHtml[i]);

  return html;
}

// Baut aus einem Block Listenzeilen (bereits HTML-escaped) verschachtelte
// <ul>/<ol>. Einrückung (Leerzeichen/Tab) bestimmt die Ebene; "- [ ]" bzw.
// "- [x]" wird zur Checkliste. taskCounter ({n}) nummeriert die Checkboxen
// kapitelweit, damit ein Klick die richtige Zeile im Markdown umschaltet —
// ohne Zähler (Editor-Vorschau) sind die Checkboxen nur Anzeige.
function buildGuideList(block, taskCounter) {
  const items = block.replace(/\n$/, '').split('\n').map(line => {
    const m = line.match(/^([ \t]*)([-*+]|\d+\.)[ \t]+(.*)$/);
    return { indent: m[1].replace(/\t/g, '    ').length, ordered: /\d/.test(m[2]), start: parseInt(m[2], 10), text: m[3] };
  });
  let out = '';
  const stack = []; // offene Listen: { indent, tag }
  const open = it => {
    const tag = it.ordered ? 'ol' : 'ul';
    const start = it.ordered && it.start !== 1 ? ` start="${it.start}"` : '';
    out += `<${tag} class="guide-${tag}"${start}>\n`;
    stack.push({ indent: it.indent, tag });
  };
  items.forEach(it => {
    while (stack.length > 1 && it.indent < stack[stack.length - 1].indent) out += `</li>\n</${stack.pop().tag}>`;
    const top = stack[stack.length - 1];
    if (!top) open(it);
    else if (it.indent > top.indent) open(it); // Unterliste im offenen <li>
    else {
      out += '</li>\n';
      if ((it.ordered ? 'ol' : 'ul') !== top.tag) { out += `</${stack.pop().tag}>\n`; open(it); }
    }
    const task = it.text.match(/^\[( |x|X)\][ \t]+(.*)$/);
    if (task) {
      const checked = task[1] !== ' ';
      const idx = taskCounter ? taskCounter.n++ : -1;
      out += `<li class="guide-task${checked ? ' done' : ''}"><input type="checkbox" class="guide-task-box"${checked ? ' checked' : ''}${idx >= 0 ? ` data-task="${idx}"` : ' disabled'}> ${task[2]}`;
    } else {
      out += `<li>${it.text}`;
    }
  });
  while (stack.length) out += `</li>\n</${stack.pop().tag}>`;
  return out;
}

// Schaltet die n-te Checkbox ("- [ ]" / "- [x]") im Markdown um. Codeblöcke
// werden übersprungen, damit die Zählung exakt der gerenderten entspricht.
function toggleGuideTaskInContent(content, n) {
  const fence = new RegExp(GUIDE_FENCE_SRC, 'g');
  let out = '', last = 0, count = 0, m;
  const toggleIn = text => text.replace(/^([ \t]*(?:[-*+]|\d+\.)[ \t]+)\[( |x|X)\](?=[ \t])/gm, (all, pre, mark) =>
    (count++ === n) ? `${pre}[${mark === ' ' ? 'x' : ' '}]` : all);
  const src = normalizeGuideNewlines(content);
  while ((m = fence.exec(src))) {
    out += toggleIn(src.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + toggleIn(src.slice(last));
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
  downloadGuideFile(guideSafeFileName(guide.title) + '.md', lines.join('\n'), 'text/markdown');
}

function guideSafeFileName(name) {
  return String(name || 'Unbenannt').replace(/[^a-z0-9äöüÄÖÜß ]/gi, '_');
}

function downloadGuideFile(fileName, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = fileName;
  // Erst im DOM klicken und die URL verzögert freigeben — sofortiges
  // revokeObjectURL bricht den Download in manchen Browsern ab.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Ganze Bücher exportieren / importieren ────────────────
// Ein Buch wird als eine JSON-Datei gesichert: Name, Einband, alle Kapitel
// samt Metadaten/Statistik, Featured Snippet und Code-Bookmarks. Beim Import
// entsteht immer ein NEUES Buch mit neuen IDs — ein vorhandenes wird nie
// überschrieben, auch wenn es denselben Namen trägt.
const GUIDE_BOOK_FORMAT = 'nook-guides-book';

function exportGuideBook(categoryId) {
  const cat = guideCategories.find(c => c.id === categoryId);
  if (!cat) return;
  const bookmarks = {};
  cat.guides.forEach(g => { if (guideBookmarks[g.id]?.length) bookmarks[g.id] = guideBookmarks[g.id]; });
  const data = {
    format: GUIDE_BOOK_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    book: {
      name: cat.name,
      coverColor: cat.coverColor,
      featuredSnippet: cat.featuredSnippet || null,
      guides: cat.guides,
    },
    bookmarks,
  };
  downloadGuideFile(guideSafeFileName(cat.name) + '.nook-buch.json', JSON.stringify(data, null, 2), 'application/json');
}

// Baut aus einer Backup-Datei ein neues Buch. Wirft bei ungültigem Inhalt.
function guideBookFromBackup(data) {
  if (!data || data.format !== GUIDE_BOOK_FORMAT || !data.book || !Array.isArray(data.book.guides)) {
    throw new Error('Keine Nook-Buchdatei');
  }
  const src = data.book;
  const now = new Date().toISOString();
  const idMap = {};      // alte Kapitel-ID → neue
  const blockMap = {};   // alte Block-ID → neue (Block-IDs hängen an der Kapitel-ID)
  const guides = src.guides.filter(g => g && typeof g.title === 'string').map(g => {
    const id = crypto.randomUUID();
    const content = normalizeGuideNewlines(g.content);
    idMap[g.id] = id;
    const oldBlocks = listGuideCodeBlocks(content, g.id);
    const newBlocks = listGuideCodeBlocks(content, id);
    oldBlocks.forEach((b, i) => { blockMap[b.id] = newBlocks[i].id; });
    return {
      id,
      title: g.title,
      description: typeof g.description === 'string' ? g.description : '',
      content,
      tags: Array.isArray(g.tags) ? g.tags.filter(t => typeof t === 'string') : [],
      favorite: !!g.favorite,
      createdAt: g.createdAt || now,
      updatedAt: g.updatedAt || now,
      ...(g.lastOpened ? { lastOpened: g.lastOpened } : {}),
      ...(g.openCount ? { openCount: g.openCount } : {}),
    };
  });

  // Gleichnamiges Buch vorhanden → Namen eindeutig machen statt zu verwechseln
  let name = String(src.name || 'Importiertes Buch').trim() || 'Importiertes Buch';
  const taken = n => guideCategories.some(c => c.name.toLowerCase() === n.toLowerCase());
  if (taken(name)) {
    let i = 2;
    while (taken(`${name} (${i})`)) i++;
    name = `${name} (${i})`;
  }

  const fs = src.featuredSnippet;
  const cat = {
    id: crypto.randomUUID(),
    name,
    coverColor: src.coverColor ?? HUB_PALETTE_HEX[0],
    guides,
    featuredSnippet: (fs && idMap[fs.guideId] && blockMap[fs.blockId])
      ? { guideId: idMap[fs.guideId], blockId: blockMap[fs.blockId] } : null,
  };
  const bookmarks = {};
  Object.entries(data.bookmarks || {}).forEach(([oldGuideId, ids]) => {
    if (!idMap[oldGuideId] || !Array.isArray(ids)) return;
    const mapped = ids.map(id => blockMap[id]).filter(Boolean);
    if (mapped.length) bookmarks[idMap[oldGuideId]] = mapped;
  });
  return { cat, bookmarks };
}

function importGuideBooks() {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.json,application/json';
  input.multiple = true;
  input.addEventListener('change', async () => {
    const files = [...input.files];
    const results = await Promise.allSettled(files.map(readGuideFileAsText));
    const failed = [];
    const added = [];
    results.forEach((res, i) => {
      try {
        if (res.status !== 'fulfilled') throw res.reason;
        const { cat, bookmarks } = guideBookFromBackup(JSON.parse(res.value));
        guideCategories.push(cat);
        Object.assign(guideBookmarks, bookmarks);
        added.push(cat);
      } catch {
        failed.push(files[i].name);
      }
    });
    if (added.length) {
      saveGuideCategories();
      saveBookmarks();
      // Das (erste) importierte Buch direkt aufschlagen
      guideSearchQuery = '';
      const search = document.getElementById('guide-search-input');
      if (search) search.value = '';
      state.activeGuideCategoryId = added[0].id;
      activeGuideId = null;
      renderGuideContent();
    }
    if (failed.length) alert(`Folgende Dateien sind keine gültigen Nook-Bücher:\n${failed.join('\n')}`);
  });
  input.click();
}

// Buch löschen — zweistufig: erst Backup anbieten (bei "Ja" wird sofort
// exportiert), dann die eigentliche Sicherheitsabfrage.
async function deleteGuideBook(categoryId) {
  const cat = guideCategories.find(c => c.id === categoryId);
  if (!cat) return false;
  const wantsBackup = await hubConfirm({
    title: 'Backup erstellen?',
    message: `Möchtest du „${cat.name}" zur Sicherheit als Backup exportieren, bevor es gelöscht wird?`,
    confirmText: 'Ja, exportieren',
    cancelText: 'Nein',
  });
  if (wantsBackup) exportGuideBook(cat.id);
  const n = cat.guides.length;
  const sure = await hubConfirm({
    title: 'Buch löschen?',
    message: `Bist du sicher, dass du „${cat.name}" mit ${n === 1 ? '1 Kapitel' : `allen ${n} Kapiteln`} endgültig löschen möchtest?`,
    confirmText: 'Endgültig löschen',
    danger: true,
  });
  if (!sure) return false;
  guideCategories = guideCategories.filter(c => c.id !== cat.id);
  forgetGuideBookmarks(cat.guides.map(g => g.id));
  if (state.activeGuideCategoryId === cat.id) {
    state.activeGuideCategoryId = null;
    activeGuideId = null;
  }
  saveGuideCategories();
  renderGuideContent();
  return true;
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
      const text = normalizeGuideNewlines(res.value).replace(/^\uFEFF/, '');
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
    // Rohfarbe für den Zauberbuch-Stil (css/guides-rpg.css): das Leder
    // wird damit eingefärbt — die themeabhängige Fläche oben wäre im
    // Dunkeln zu grau.
    el.style.setProperty('--book-color', cat.coverColor);
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

    book.innerHTML = `
      <div class="guide-book-title">${escHtml(cat.name)}</div>
      <div class="guide-book-meta">${categoryGuideCount(cat)} Kapitel</div>
      <div class="guide-book-spacer"></div>
      <div class="guide-book-footer">
        <span class="guide-book-opened-label">zuletzt geöffnet:</span>
        <span class="guide-book-opened-val">${fmtOpened(stats.opened)}</span>
      </div>
    `;

    // Buchrücken sind per Tastatur erreichbar (Tab) und mit Enter/Leertaste zu öffnen
    book.tabIndex = 0;
    book.setAttribute('role', 'button');
    book.setAttribute('aria-label', `Buch „${cat.name}" öffnen, ${categoryGuideCount(cat)} Kapitel`);
    if (activeOrOpenChapter) book.setAttribute('aria-current', 'true');
    book.addEventListener('click', () => {
      guideSearchQuery = '';
      guidePreSearchView = null;
      const input = document.getElementById('guide-search-input');
      if (input) input.value = '';
      state.activeGuideCategoryId = cat.id;
      activeGuideId = null;
      renderGuideContent();
    });
    book.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      book.click();
      // Das Regal wurde neu gerendert — Fokus auf dem gewählten Buch halten
      document.querySelector('#guide-shelf .guide-book[aria-current]')?.focus();
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
  addTile.tabIndex = 0;
  addTile.setAttribute('role', 'button');
  addTile.setAttribute('aria-label', 'Neues Buch erstellen');
  addTile.addEventListener('click', () => openGuideCatModal());
  addTile.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGuideCatModal(); }
  });
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
  document.getElementById('guide-home')?.classList.add('hidden');

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
    saveGuideLastView();
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
    saveGuideLastView();
    return;
  }

  // Nothing selected → Startseite (Favoriten / zuletzt geöffnet) oder Hinweis
  grid.classList.add('hidden');
  saveGuideLastView();
  const hasGuides = guideCategories.some(c => c.guides.length);
  placeholder.classList.toggle('hidden', hasGuides);
  if (hasGuides) renderGuideHome();
}

// Zuletzt geöffnetes Buch/Kapitel merken, damit ein Neuladen dort weitermacht
function saveGuideLastView() {
  if (guideSearchQuery.trim().length >= 2) return;
  DB.set('guideLastView', { categoryId: state.activeGuideCategoryId || null, guideId: activeGuideId || null });
}

function restoreGuideLastView() {
  const v = DB.get('guideLastView', null);
  if (!v) return;
  const found = v.guideId && findGuide(v.guideId);
  if (found) { activeGuideId = found.guide.id; state.activeGuideCategoryId = found.category.id; }
  else if (v.categoryId && guideCategories.some(c => c.id === v.categoryId)) state.activeGuideCategoryId = v.categoryId;
}

// ── Startseite der Bibliothek ─────────────────────────────
// Ohne gewähltes Buch: schneller Zugriff auf Favoriten und die zuletzt
// geöffneten Kapitel über alle Bücher hinweg.
const GUIDE_HOME_LIMIT = 6;

function renderGuideHome() {
  const home = document.getElementById('guide-home');
  if (!home) return;
  const all = getAllGuides();
  const favs = all.filter(g => g.favorite)
    .sort((a, b) => String(b.lastOpened || '').localeCompare(String(a.lastOpened || '')))
    .slice(0, GUIDE_HOME_LIMIT);
  const recent = all.filter(g => g.lastOpened)
    .sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
    .slice(0, GUIDE_HOME_LIMIT);
  const list = (items, empty) => items.length
    ? items.map(g => `
        <button type="button" class="guide-home-item" data-guide-open="${g.id}">
          <span class="guide-home-item-title">${g.favorite ? '<span class="guide-fav-star">★</span> ' : ''}${escHtml(g.title)}</span>
          <span class="guide-home-item-meta">${escHtml(g.categoryName)}${g.lastOpened ? ' · ' + fmtOpened(g.lastOpened) : ''}</span>
        </button>`).join('')
    : `<p class="guide-snippet-empty">${empty}</p>`;
  home.innerHTML = `
    <div class="panel guide-home-card">
      <div class="panel-header"><span class="panel-label">Favoriten</span></div>
      <div class="guide-home-list">${list(favs, 'Noch keine Favoriten — ☆ an einem Kapitel klicken.')}</div>
    </div>
    <div class="panel guide-home-card">
      <div class="panel-header"><span class="panel-label">Zuletzt geöffnet</span></div>
      <div class="guide-home-list">${list(recent, 'Noch nichts geöffnet — wähle ein Buch aus dem Regal.')}</div>
    </div>`;
  home.querySelectorAll('[data-guide-open]').forEach(btn =>
    btn.addEventListener('click', () => openGuideChapter(btn.dataset.guideOpen)));
  home.classList.remove('hidden');
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

  const exportBookBtn = document.createElement('button');
  exportBookBtn.className = 'btn-ghost';
  exportBookBtn.title = 'Ganzes Buch als Backup-Datei (.json) speichern';
  exportBookBtn.textContent = '⬇ Buch exportieren';
  exportBookBtn.addEventListener('click', () => exportGuideBook(cat.id));
  actions.appendChild(exportBookBtn);

  const importBtn = document.createElement('button');
  importBtn.className = 'btn-ghost';
  importBtn.title = 'Einzelne Kapitel aus .md-Dateien in dieses Buch importieren';
  importBtn.textContent = '⬆ Kapitel importieren';
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
    // Mit nur einem Kapitel gibt es nichts umzusortieren — Griff ausblenden
    if (cat.guides.length > 1) enableGuideChapterReorder(list, cat);
    else list.classList.add('single');
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
  guidePreSearchView = null; // bewusst woanders hin navigiert
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

// Kopie eines Kapitels direkt hinter dem Original (z.B. als Vorlage).
// Statistik startet neu; Bookmarks werden auf die neuen Block-IDs übertragen.
function duplicateGuideChapter(category, guide) {
  const now = new Date().toISOString();
  const copy = {
    id: crypto.randomUUID(),
    title: guide.title + ' (Kopie)',
    description: guide.description || '',
    content: guide.content || '',
    tags: [...(guide.tags || [])],
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
  const oldBlocks = listGuideCodeBlocks(guide.content, guide.id);
  const newBlocks = listGuideCodeBlocks(copy.content, copy.id);
  const bm = (guideBookmarks[guide.id] || [])
    .map(id => { const i = oldBlocks.findIndex(b => b.id === id); return i !== -1 ? newBlocks[i].id : null; })
    .filter(Boolean);
  if (bm.length) { guideBookmarks[copy.id] = bm; saveBookmarks(); }
  category.guides.splice(category.guides.indexOf(guide) + 1, 0, copy);
  saveGuideCategories();
  openGuideChapter(copy.id);
}

// ── Kapitel in ein anderes Buch verschieben ───────────────
let guideMoveModal = { open(){}, close(){} };
let guideMoveGuideId = null;

function openGuideMoveModal(guideId) {
  const found = findGuide(guideId);
  if (!found) return;
  guideMoveGuideId = guideId;
  const select = document.getElementById('guide-move-target');
  select.innerHTML = guideCategories
    .filter(c => c.id !== found.category.id)
    .map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
  document.getElementById('guide-move-chapter-name').textContent = found.guide.title;
  guideMoveModal.open();
  setTimeout(() => select.focus(), 50);
}

function moveGuideChapter(guideId, targetCategoryId) {
  const found = findGuide(guideId);
  const target = guideCategories.find(c => c.id === targetCategoryId);
  if (!found || !target || target === found.category) return;
  const { guide, category } = found;
  category.guides = category.guides.filter(g => g.id !== guide.id);
  // Featured Snippet gehört zum alten Buch — es zeigt sonst ins Leere
  if (category.featuredSnippet && category.featuredSnippet.guideId === guide.id) category.featuredSnippet = null;
  target.guides.push(guide);
  saveGuideCategories(); // Bookmarks hängen an der Kapitel-ID und wandern automatisch mit
  openGuideChapter(guide.id);
}

// ── Tags ──────────────────────────────────────────────────
// Tags sind überall anklickbar und starten eine Suche nach genau diesem Tag
// (Suchfeld zeigt "#tag", siehe getGuideSearchResults).
function guideTagButtons(tags, extraClass = '') {
  return (tags || []).map(t =>
    `<button type="button" class="guide-tag guide-tag-link ${extraClass}" data-guide-tag="${escHtml(t)}" title="Alle Kapitel mit #${escHtml(t)}">${escHtml(t)}</button>`
  ).join('');
}

function searchGuideTag(tag) {
  const input = document.getElementById('guide-search-input');
  rememberGuidePreSearchView();
  guideSearchQuery = '#' + tag;
  if (input) input.value = guideSearchQuery;
  state.activeGuideCategoryId = null;
  activeGuideId = null;
  renderGuideContent();
  document.getElementById('view-guides')?.scrollIntoView({ block: 'start' });
}

// Grober Klartext eines Kapitels (für Lesezeit und Such-Auszüge)
function guidePlainText(content) {
  return normalizeGuideNewlines(content)
    .replace(/```[^\n]*\n/g, '').replace(/```/g, '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]*(?:#{1,6}|>|[-*+]|\d+\.)[ \t]+(?:\[[ xX]\][ \t]+)?/gm, '')
    .replace(/==|~~|\*\*|__|[*`|]/g, '');
}

function guideReadingMinutes(content) {
  const words = guidePlainText(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// Neu rendern, ohne dass die Leseposition nach oben springt
function keepGuideScroll(fn) {
  const scroller = document.getElementById('main');
  const top = scroller ? scroller.scrollTop : 0;
  const winTop = window.scrollY;
  fn();
  if (scroller) scroller.scrollTop = top;
  window.scrollTo(0, winTop);
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
    <div class="guide-chapter-title-wrap">
      <span class="guide-chapter-title">${escHtml(guide.title)}</span>
      ${guide.tags?.length ? `<div class="guide-chapter-tags">${guideTagButtons(guide.tags, 'guide-tag-sm')}</div>` : ''}
    </div>
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
    if (e.target.closest('.guide-chapter-actions, .guide-chapter-drag, [data-guide-tag]')) return;
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
    keepGuideScroll(renderGuideContent);
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
      row.classList.add('dragging');
      list.classList.add('reordering');

      // Bewusst am window statt per setPointerCapture am Griff: das Umhängen
      // der Zeile im DOM (insertBefore) hebt eine Pointer-Capture auf — danach
      // kämen keine move/up-Events mehr an und das Ziehen bliebe hängen.
      const onMove = ev => {
        if (ev.pointerId !== e.pointerId) return;
        const target = [...list.querySelectorAll('.guide-chapter-row')].find(r => {
          if (r === row) return false;
          const b = r.getBoundingClientRect();
          return ev.clientY >= b.top && ev.clientY <= b.bottom;
        });
        if (!target) return;
        const b = target.getBoundingClientRect();
        list.insertBefore(row, ev.clientY > b.top + b.height / 2 ? target.nextSibling : target);
      };
      const onEnd = ev => {
        if (ev.pointerId !== e.pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
        row.classList.remove('dragging');
        list.classList.remove('reordering');
        if (commitOrder()) renderGuideContent();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
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
      ${guideTagButtons(guide.tags)}
      ${guide.createdAt ? `<span class="guide-detail-date">Erstellt: ${fmtDate(guide.createdAt)}</span>` : ''}
      ${guide.updatedAt ? `<span class="guide-detail-date">Bearbeitet: ${fmtDate(guide.updatedAt)}</span>` : ''}
      <span class="guide-detail-date">~${guideReadingMinutes(guide.content)} Min. Lesezeit</span>
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
    keepGuideScroll(renderGuideContent);
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

  const duplicateItem = document.createElement('button');
  duplicateItem.className = 'guide-detail-menu-item';
  duplicateItem.textContent = '⧉ Duplizieren';
  duplicateItem.addEventListener('click', () => {
    dropdown.classList.remove('open');
    duplicateGuideChapter(category, guide);
  });

  const moveItem = document.createElement('button');
  moveItem.className = 'guide-detail-menu-item';
  moveItem.textContent = '📚 In anderes Buch verschieben';
  moveItem.disabled = guideCategories.length < 2;
  if (moveItem.disabled) moveItem.title = 'Dafür braucht es mindestens ein zweites Buch';
  moveItem.addEventListener('click', () => {
    dropdown.classList.remove('open');
    openGuideMoveModal(guide.id);
  });

  dropdown.append(editItem, duplicateItem, moveItem, exportItem, printItem, deleteItem);

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

  // Checklisten direkt beim Lesen abhaken — schreibt "- [x]" ins Markdown
  content.addEventListener('change', e => {
    const box = e.target.closest('.guide-task-box[data-task]');
    if (!box) return;
    guide.content = toggleGuideTaskInContent(guide.content || '', Number(box.dataset.task));
    box.closest('.guide-task')?.classList.toggle('done', box.checked);
    saveGuideCategories();
  });

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

  // In Dokument-Reihenfolge (nicht in der Reihenfolge des Merkens), damit
  // ↑/↓ wie beim Lesen durch das Kapitel springt
  const ids = new Set(guideBookmarks[guideId] || []);
  const blocks = [...document.querySelectorAll('#guide-main .guide-code-block')].filter(b => ids.has(b.id));
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
    const firstLine = (block.querySelector('code')?.textContent || '').split('\n').find(l => l.trim()) || '';
    const heading = guideHeadingBefore(block);
    const item = document.createElement('button');
    item.className = 'guide-bm-item' + (i === bookmarkNavIndex ? ' current' : '');
    item.innerHTML = `
      <span class="guide-bm-item-top"><span class="guide-bm-item-lang">${lang ? escHtml(lang.textContent) : 'code'}</span><span class="guide-bm-item-heading">${heading ? escHtml(heading) : `Codeblock ${i + 1}`}</span></span>
      <code class="guide-bm-item-preview">${escHtml(firstLine.trim())}</code>`;
    item.addEventListener('click', () => { bookmarkNavIndex = i; jumpToBookmark(block); renderSidebarBookmarks(guideId); });
    list.appendChild(item);
  });
  body.appendChild(list);
}

// Nächste Überschrift oberhalb eines Elements im Kapitelinhalt
function guideHeadingBefore(el) {
  let node = el.previousElementSibling;
  while (node) {
    if (/^H[2-6]$/.test(node.tagName)) return node.textContent;
    node = node.previousElementSibling;
  }
  return null;
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
  const mostReadGuide = stats.mostRead;
  const row = (label, val, title = '') =>
    `<div class="b-free-row"><span class="b-free-label">${label}</span><span class="b-free-val${title ? ' guide-stat-truncate' : ''}"${title ? ` title="${title}"` : ''}>${val}</span></div>`;

  // Bei offenem Kapitel zwei klar beschriftete Abschnitte statt einer
  // Mischung aus Kapitel- und Buchwerten
  const chapterPart = guide ? `
    <div class="guide-stats-section">Dieses Kapitel</div>
    ${row('Erstellt am', fmtDate(guide.createdAt))}
    ${row('Zuletzt bearbeitet', fmtDate(guide.updatedAt))}
    ${row('Zuletzt geöffnet', fmtOpenedFull(guide.lastOpened))}
    ${row('Aufrufe', guide.openCount || 0)}
    <div class="b-free-divider"></div>
    <div class="guide-stats-section">Buch „${escHtml(cat.name)}"</div>` : `
    ${row('Erstellt am', fmtDate(stats.created))}
    ${row('Zuletzt bearbeitet', fmtDate(stats.updated))}
    ${row('Zuletzt geöffnet', fmtOpenedFull(stats.opened))}
    <div class="b-free-divider"></div>`;

  // Alle Tags des Buches mit Häufigkeit — anklickbar als Filter
  const tagCounts = {};
  cat.guides.forEach(g => (g.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const tagCloud = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .map(([t, n]) => `<button type="button" class="guide-tag guide-tag-link" data-guide-tag="${escHtml(t)}" title="Alle Kapitel mit #${escHtml(t)}">${escHtml(t)} <span class="guide-tag-count">${n}</span></button>`)
    .join('');

  statsBody.innerHTML = `
    ${chapterPart}
    ${row('Anzahl Kapitel', stats.count)}
    ${row('Favoriten', stats.favCount)}
    ${row('Meist gelesen', mostReadGuide ? escHtml(mostReadGuide.title) : '–', mostReadGuide ? escHtml(mostReadGuide.title) : '')}
    ${tagCloud ? `<div class="b-free-divider"></div><div class="guide-stats-section">Tags</div><div class="guide-tag-cloud">${tagCloud}</div>` : ''}
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

// "#tag" filtert exakt nach einem Tag (so starten auch Klicks auf Tags),
// alles andere ist Volltextsuche mit Relevanz: Titel > Tag > Beschreibung >
// Inhalt; bei Gleichstand Favoriten und zuletzt Geöffnetes zuerst.
function parseGuideSearch() {
  const raw = guideSearchQuery.trim();
  if (/^#\S/.test(raw)) return { tag: raw.slice(1).toLowerCase(), text: '' };
  return { tag: null, text: raw.toLowerCase() };
}

function getGuideSearchResults() {
  const { tag, text } = parseGuideSearch();
  const scored = getAllGuides().map(g => {
    const tags = (g.tags || []).map(t => t.toLowerCase());
    let score = 0;
    if (tag) {
      score = tags.includes(tag) ? 1 : 0;
    } else {
      const title = g.title.toLowerCase();
      if (title === text) score += 12;
      else if (title.startsWith(text)) score += 9;
      else if (title.includes(text)) score += 7;
      if (tags.some(t => t === text)) score += 5;
      else if (tags.some(t => t.includes(text))) score += 3;
      if ((g.description || '').toLowerCase().includes(text)) score += 2;
      if ((g.content || '').toLowerCase().includes(text)) score += 1;
    }
    return { g, score };
  }).filter(r => r.score > 0);
  scored.sort((a, b) =>
    b.score - a.score ||
    (b.g.favorite ? 1 : 0) - (a.g.favorite ? 1 : 0) ||
    String(b.g.lastOpened || '').localeCompare(String(a.g.lastOpened || '')));
  return scored.map(r => r.g);
}

// Kurzer Textauszug rund um den ersten Treffer im Inhalt, Treffer markiert
const GUIDE_EXCERPT_RADIUS = 60;
function guideSearchExcerpt(guide, text) {
  if (!text) return '';
  const plain = guidePlainText(guide.content).replace(/\s+/g, ' ').trim();
  const idx = plain.toLowerCase().indexOf(text);
  if (idx === -1) return '';
  const from = Math.max(0, idx - GUIDE_EXCERPT_RADIUS);
  const to   = Math.min(plain.length, idx + text.length + GUIDE_EXCERPT_RADIUS);
  return (from > 0 ? '… ' : '') + guideHighlight(plain.slice(from, to), text) + (to < plain.length ? ' …' : '');
}

// Escaped den Text und markiert alle Vorkommen des Suchbegriffs
function guideHighlight(str, text) {
  if (!text) return escHtml(str);
  const lower = str.toLowerCase();
  let out = '', last = 0, i;
  while ((i = lower.indexOf(text, last)) !== -1) {
    out += escHtml(str.slice(last, i)) + `<mark class="guide-search-hit">${escHtml(str.slice(i, i + text.length))}</mark>`;
    last = i + text.length;
  }
  return out + escHtml(str.slice(last));
}

function clearGuideSearch() {
  const input = document.getElementById('guide-search-input');
  if (input) input.value = '';
  guideSearchQuery = '';
  restoreGuidePreSearchView();
  renderGuideContent();
}

// Vor dem Suchen geöffnetes Buch/Kapitel merken, damit "Suche leeren" dorthin
// zurückführt statt auf die leere Startansicht
let guidePreSearchView = null;
function rememberGuidePreSearchView() {
  if (guideSearchQuery.trim().length >= 2) return; // Suche läuft schon
  guidePreSearchView = { categoryId: state.activeGuideCategoryId, guideId: activeGuideId };
}
function restoreGuidePreSearchView() {
  const v = guidePreSearchView;
  guidePreSearchView = null;
  if (!v) return;
  if (v.guideId && findGuide(v.guideId)) { activeGuideId = v.guideId; state.activeGuideCategoryId = findGuide(v.guideId).category.id; }
  else if (v.categoryId && guideCategories.some(c => c.id === v.categoryId)) state.activeGuideCategoryId = v.categoryId;
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
  const { tag } = parseGuideSearch();
  const results = getGuideSearchResults();

  const perBook = {};
  results.forEach(g => { perBook[g.categoryName] = (perBook[g.categoryName] || 0) + 1; });
  const bookRows = Object.entries(perBook)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `<div class="b-free-row"><span class="b-free-label guide-stat-truncate" title="${escHtml(name)}">${escHtml(name)}</span><span class="b-free-val">${n}</span></div>`)
    .join('');

  statsBody.innerHTML = `
    <div class="b-free-row"><span class="b-free-label">${tag ? 'Tag' : 'Suchbegriff'}</span><span class="b-free-val guide-stat-truncate">${tag ? escHtml(q) : `„${escHtml(q)}"`}</span></div>
    <div class="b-free-row"><span class="b-free-label">Treffer</span><span class="b-free-val">${results.length}</span></div>
    ${bookRows ? `<div class="b-free-divider"></div>${bookRows}` : ''}
  `;

  snippetLabel.textContent = 'Code-Treffer';
  if (tag) {
    snippetBody.innerHTML = `<p class="guide-snippet-empty">Tag-Filter aktiv — Code-Treffer gibt es bei der Textsuche.</p>`;
    return;
  }
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
  const { tag } = parseGuideSearch();
  main.innerHTML = tag
    ? `<div class="guide-search-header">Kapitel mit dem Tag <strong>#${escHtml(guideSearchQuery.trim().slice(1))}</strong>
         <button type="button" class="btn-ghost guide-search-clear">✕ Filter aufheben</button></div>`
    : `<div class="guide-search-header">Suchergebnisse für „<strong>${escHtml(guideSearchQuery.trim())}</strong>"
         <button type="button" class="btn-ghost guide-search-clear">✕ Suche leeren</button></div>`;
  main.querySelector('.guide-search-clear').addEventListener('click', clearGuideSearch);

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
  const { text } = parseGuideSearch();
  const excerpt = guideSearchExcerpt(guide, text);
  const row = document.createElement('div');
  row.className = 'guide-chapter-row';
  row.innerHTML = `
    <span class="guide-chapter-num">${number}</span>
    <div class="guide-chapter-title-wrap">
      <span class="guide-tag guide-tag-cat">${escHtml(cat.name)}</span>
      <span class="guide-chapter-title">${guideHighlight(guide.title, text)}</span>
      ${excerpt ? `<span class="guide-search-excerpt">${excerpt}</span>` : ''}
      ${guide.tags?.length ? `<div class="guide-chapter-tags">${guideTagButtons(guide.tags, 'guide-tag-sm')}</div>` : ''}
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
    if (e.target.closest('.guide-chapter-actions, [data-guide-tag]')) return;
    open();
  });
  row.querySelector('.guide-chapter-open').addEventListener('click', e => { e.stopPropagation(); open(); });
  row.querySelector('.guide-chapter-fav').addEventListener('click', e => {
    e.stopPropagation();
    guide.favorite = !guide.favorite;
    saveGuideCategories();
    keepGuideScroll(renderGuideContent);
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

  title.textContent = guideId ? 'Kapitel bearbeiten' : 'Neues Kapitel';
  titleIn.classList.remove('guide-input-invalid');
  titleIn.placeholder = 'Titel des Kapitels';

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
  offerGuideDraftRestore(categoryId, guideId);
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

// ── Editor-Werkzeuge ──────────────────────────────────────

// Zuletzt verwendete Code-Sprache — wird beim nächsten Codeblock vorgeschlagen
// (und markiert, damit man sie direkt überschreiben kann)
let guideLastCodeLang = DB.get('guideLastCodeLang', null) || 'javascript';

function insertGuideSnippet(textarea, snippet) {
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  let after    = textarea.value.substring(end);
  const sel    = textarea.value.substring(start, end);
  // Zeilenumbruch voranstellen, falls die Einfügestelle mitten in einer Zeile liegt
  const nl      = (before && !before.endsWith('\n')) ? '\n' : '';
  // ...und dahinter, falls danach noch Text in derselben Zeile folgt
  const nlAfter = (after && !after.startsWith('\n')) ? '\n' : '';
  const lineSnippets = ['code', 'h2', 'h3', 'list', 'olist', 'task', 'quote', 'table', 'hr'];
  // Bei Zeilenelementen kein führendes Leerzeichen in die neue Folgezeile mitnehmen
  if (lineSnippets.includes(snippet) && nlAfter) after = after.replace(/^[ \t]+/, '');
  const eachLine = (text, fn) => text.split('\n').map((l, i) => fn(l.replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?|^&gt;\s?|^>\s?/, ''), i)).join('\n');

  // prefix + [text = wird danach markiert] + suffix
  let prefix = '', text = '', suffix = '';
  switch (snippet) {
    case 'code':
      // Mit Markierung: Code einrahmen und die Sprache markieren; ohne: Sprache
      // markieren, Cursor danach per Enter in die leere Zeile
      prefix = nl + '```'; text = guideLastCodeLang; suffix = '\n' + sel + '\n```' + nlAfter;
      break;
    case 'h2':     prefix = nl + '## ';  text = sel || 'Überschrift';      suffix = nlAfter; break;
    case 'h3':     prefix = nl + '### '; text = sel || 'Unterüberschrift'; suffix = nlAfter; break;
    case 'bold':   prefix = '**'; text = sel || 'fett';            suffix = '**'; break;
    case 'italic': prefix = '*';  text = sel || 'kursiv';          suffix = '*';  break;
    case 'strike': prefix = '~~'; text = sel || 'durchgestrichen'; suffix = '~~'; break;
    case 'mark':   prefix = '=='; text = sel || 'markierter Text'; suffix = '=='; break;
    case 'inline': prefix = '`';  text = sel || 'code';            suffix = '`';  break;
    case 'xref':   prefix = '[['; text = sel || 'Kapitelname';     suffix = ']]'; break;
    case 'link':
      if (/^(https?:\/\/|mailto:)\S+$/.test(sel)) { prefix = '['; text = 'Linktext'; suffix = '](' + sel + ')'; }
      else { prefix = '[' + (sel || 'Linktext') + ']('; text = 'https://'; suffix = ')'; }
      break;
    case 'list':
    case 'olist':
    case 'task': {
      const marker = i => snippet === 'olist' ? `${i + 1}. ` : snippet === 'task' ? '- [ ] ' : '- ';
      if (sel) { prefix = nl; text = eachLine(sel, (l, i) => marker(i) + l); suffix = nlAfter; }
      else {
        prefix = nl + marker(0); text = 'Punkt 1';
        suffix = '\n' + marker(1) + 'Punkt 2\n' + marker(2) + 'Punkt 3' + nlAfter;
      }
      break;
    }
    case 'quote':
      if (sel) { prefix = nl; text = eachLine(sel, l => '> ' + l); suffix = nlAfter; }
      else { prefix = nl + '> '; text = 'Zitat'; suffix = nlAfter; }
      break;
    case 'table':
      prefix = nl + '| '; text = 'Spalte 1';
      suffix = ' | Spalte 2 |\n| --- | --- |\n| Wert | Wert |' + nlAfter;
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
  // Wie eine echte Eingabe behandeln: Live-Vorschau + Entwurf aktualisieren
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// Tab / Shift+Tab: ohne Markierung zwei Leerzeichen einfügen bzw. entfernen,
// mit Markierung über mehrere Zeilen alle Zeilen ein-/ausrücken
const GUIDE_INDENT = '  ';
function indentGuideEditor(textarea, outdent) {
  const { value, selectionStart: s, selectionEnd: e } = textarea;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  if (s === e && !outdent) {
    textarea.value = value.slice(0, s) + GUIDE_INDENT + value.slice(e);
    textarea.selectionStart = textarea.selectionEnd = s + GUIDE_INDENT.length;
  } else {
    const blockEnd = value.indexOf('\n', e - (e > s && value[e - 1] === '\n' ? 1 : 0));
    const stop = blockEnd === -1 ? value.length : blockEnd;
    const lines = value.slice(lineStart, stop).split('\n');
    let firstDelta = 0, total = 0;
    const changed = lines.map((l, i) => {
      if (outdent) {
        const cut = l.startsWith(GUIDE_INDENT) ? GUIDE_INDENT.length : (l.startsWith(' ') || l.startsWith('\t') ? 1 : 0);
        if (i === 0) firstDelta = -cut;
        total -= cut;
        return l.slice(cut);
      }
      if (i === 0) firstDelta = GUIDE_INDENT.length;
      total += GUIDE_INDENT.length;
      return GUIDE_INDENT + l;
    }).join('\n');
    textarea.value = value.slice(0, lineStart) + changed + value.slice(stop);
    textarea.selectionStart = Math.max(lineStart, s + firstDelta);
    textarea.selectionEnd   = Math.max(textarea.selectionStart, e + total);
  }
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// ── Entwurf (Absturz-/Versehen-Schutz) ────────────────────
// Solange das Kapitel-Modal offen ist und sich etwas geändert hat, wird der
// Stand regelmäßig gesichert. Normales Speichern oder Schließen löscht ihn;
// übrig bleibt er nur, wenn der Tab z.B. abstürzt oder geschlossen wird —
// dann wird beim nächsten Öffnen desselben Kapitels die Wiederherstellung angeboten.
let guideDraftTimer = null;
const GUIDE_DRAFT_KEY = 'guideDraft';

function getGuideModalFields() {
  return {
    title:   document.getElementById('guide-modal-title-input').value,
    desc:    document.getElementById('guide-modal-desc-input').value,
    tags:    document.getElementById('guide-modal-tags-input').value,
    content: document.getElementById('guide-modal-content-input').value,
    fav:     document.getElementById('guide-modal-fav').checked,
  };
}

function setGuideModalFields(f) {
  document.getElementById('guide-modal-title-input').value   = f.title || '';
  document.getElementById('guide-modal-desc-input').value    = f.desc || '';
  document.getElementById('guide-modal-tags-input').value    = f.tags || '';
  document.getElementById('guide-modal-content-input').value = f.content || '';
  document.getElementById('guide-modal-fav').checked         = !!f.fav;
}

function scheduleGuideDraftSave() {
  if (!guideModalCategoryId) return;
  clearTimeout(guideDraftTimer);
  guideDraftTimer = setTimeout(() => {
    if (!guideModalCategoryId) return;
    if (getGuideModalSnapshot() === guideModalSnapshot) { clearGuideDraftFor(guideModalCategoryId, guideModalGuideId); return; }
    DB.set(GUIDE_DRAFT_KEY, {
      categoryId: guideModalCategoryId,
      guideId: guideModalGuideId || null,
      savedAt: new Date().toISOString(),
      ...getGuideModalFields(),
    });
  }, 800);
}

function clearGuideDraftFor(categoryId, guideId) {
  const d = DB.get(GUIDE_DRAFT_KEY, null);
  if (d && d.categoryId === categoryId && (d.guideId || null) === (guideId || null)) DB.set(GUIDE_DRAFT_KEY, null);
}

async function offerGuideDraftRestore(categoryId, guideId) {
  const d = DB.get(GUIDE_DRAFT_KEY, null);
  if (!d || d.categoryId !== categoryId || (d.guideId || null) !== (guideId || null)) return;
  const current = getGuideModalFields();
  if (['title', 'desc', 'tags', 'content', 'fav'].every(k => d[k] === current[k])) { DB.set(GUIDE_DRAFT_KEY, null); return; }
  const when = new Date(d.savedAt);
  const restore = await hubConfirm({
    title: 'Entwurf wiederherstellen?',
    message: `Für dieses Kapitel gibt es einen nicht gespeicherten Entwurf vom ${fmtDate(d.savedAt)}, ${when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr.`,
    confirmText: 'Wiederherstellen',
    cancelText: 'Nicht wiederherstellen',
  });
  // Modal inzwischen geschlossen oder auf ein anderes Kapitel gewechselt?
  if (guideModalCategoryId !== categoryId || (guideModalGuideId || null) !== (guideId || null)) return;
  // Ohne Wiederherstellen bleibt der Entwurf liegen, bis das Modal regulär
  // geschlossen wird — ein versehentliches Escape vernichtet ihn also nicht sofort.
  if (restore) {
    setGuideModalFields(d);
    if (guideEditorMode !== 'editor') renderGuideModalPreview();
  }
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
  // Löschen gibt es nur beim Bearbeiten — bewusst nicht mehr direkt im Regal
  document.getElementById('guide-cat-modal-delete').classList.toggle('hidden', !cat);
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

  // Category modal: löschen (zweistufige Abfrage, siehe deleteGuideBook)
  document.getElementById('guide-cat-modal-delete').addEventListener('click', async () => {
    if (!guideCatModalEditId) return;
    if (await deleteGuideBook(guideCatModalEditId)) closeGuideCatModal();
  });

  // Ganze Bücher aus Backup-Dateien importieren
  document.getElementById('guide-book-import-btn').addEventListener('click', importGuideBooks);

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
    const wasActive = guideSearchQuery.trim().length >= 2;
    if (!wasActive) rememberGuidePreSearchView();
    guideSearchQuery = searchInput.value;
    const isActive = guideSearchQuery.trim().length >= 2;
    if (isActive) {
      state.activeGuideCategoryId = null;
      activeGuideId = null;
    } else if (wasActive) {
      restoreGuidePreSearchView();
    }
    renderGuideContent();
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape' && searchInput.value) { e.preventDefault(); clearGuideSearch(); }
  });

  // Tags sind überall im Tab anklickbar (Kapitel, Übersicht, Suche, Seitenleiste)
  document.getElementById('view-guides').addEventListener('click', e => {
    const tagBtn = e.target.closest('[data-guide-tag]');
    if (!tagBtn) return;
    e.preventDefault();
    e.stopPropagation();
    searchGuideTag(tagBtn.dataset.guideTag);
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
    onClose: () => {
      // Normales Schließen (Speichern oder bewusstes Verwerfen) braucht keinen Entwurf mehr
      clearTimeout(guideDraftTimer);
      if (guideModalCategoryId) clearGuideDraftFor(guideModalCategoryId, guideModalGuideId);
      guideModalCategoryId = null; guideModalGuideId = null; guideModalSnapshot = null;
    },
    // X/Abbrechen/Backdrop/Escape: bei Änderungen erst nachfragen, damit ein
    // versehentlicher Klick daneben keinen langen Markdown-Text verwirft.
    beforeClose: () => getGuideModalSnapshot() === guideModalSnapshot || hubConfirm({
      title: 'Änderungen verwerfen?',
      message: 'Das Kapitel hat ungespeicherte Änderungen. Beim Schließen gehen sie verloren.',
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
    if (!guideModalCategoryId) return;
    if (!title) {
      // Pflichtfeld sichtbar machen statt still nichts zu tun
      const titleIn = document.getElementById('guide-modal-title-input');
      titleIn.classList.add('guide-input-invalid');
      titleIn.placeholder = 'Bitte einen Titel eingeben';
      titleIn.focus();
      titleIn.addEventListener('input', () => titleIn.classList.remove('guide-input-invalid'), { once: true });
      return;
    }
    // Sprache des letzten Codeblocks als Vorschlag für den nächsten merken
    const langs = listGuideCodeBlocks(content, 'x').map(b => b.lang).filter(Boolean);
    if (langs.length) { guideLastCodeLang = langs[langs.length - 1]; DB.set('guideLastCodeLang', guideLastCodeLang); }

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

  // Schnellbausteine + Tastenkürzel im Editor
  // Markierter Text wird eingerahmt statt überschrieben; ohne Markierung wird
  // ein Platzhalter eingefügt und direkt markiert, damit man ihn überschreiben
  // kann. Zeilenbasierte Elemente (Überschrift, Listen, Codeblock, Zitat,
  // Tabelle, Trennlinie) beginnen immer am Zeilenanfang, sonst rendert der
  // Markdown-Renderer sie nicht.
  const editor = document.getElementById('guide-modal-content-input');
  document.querySelectorAll('.guide-snippet-btn').forEach(btn => {
    btn.addEventListener('click', () => insertGuideSnippet(editor, btn.dataset.snippet));
  });

  editor.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey) {
      const key = e.key.toLowerCase();
      const map = { b: 'bold', i: 'italic', k: 'link' };
      if (map[key]) { e.preventDefault(); insertGuideSnippet(editor, map[key]); return; }
      if (key === 's') { e.preventDefault(); document.getElementById('guide-modal-save').click(); return; }
    }
    // Tab rückt ein (Shift+Tab aus) statt den Fokus zu verlassen — wichtig für
    // Code und verschachtelte Listen. Escape gibt den Fokus frei, damit man
    // per Tastatur trotzdem aus dem Feld kommt.
    if (e.key === 'Tab' && !mod && !e.altKey && !editor.dataset.tabReleased) {
      e.preventDefault();
      indentGuideEditor(editor, e.shiftKey);
    }
    if (e.key === 'Escape') editor.dataset.tabReleased = '1';
  });
  editor.addEventListener('blur', () => { delete editor.dataset.tabReleased; });

  // Ctrl+S auch aus Titel/Beschreibung/Tags
  ['guide-modal-title-input', 'guide-modal-desc-input', 'guide-modal-tags-input'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        document.getElementById('guide-modal-save').click();
      }
    });
  });

  // Entwurf automatisch sichern, solange das Modal offen ist
  ['guide-modal-title-input', 'guide-modal-desc-input', 'guide-modal-tags-input', 'guide-modal-content-input', 'guide-modal-fav']
    .forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', scheduleGuideDraftSave);
    });

  // Kapitel verschieben (Modal)
  guideMoveModal = wireModal('guide-move-modal-overlay', {
    closeIds: ['guide-move-modal-close', 'guide-move-cancel'],
    onClose: () => { guideMoveGuideId = null; },
  });
  document.getElementById('guide-move-save').addEventListener('click', () => {
    const id = guideMoveGuideId;
    const target = document.getElementById('guide-move-target').value;
    guideMoveModal.close();
    moveGuideChapter(id, target);
  });

  // Grid/List view toggle for the bookshelf — gewählte Ansicht wird gemerkt
  const gridBtn = document.getElementById('lib-view-grid');
  const listBtn = document.getElementById('lib-view-list');
  const shelf   = document.getElementById('guide-shelf');
  const setShelfMode = mode => {
    shelf.classList.toggle('list-mode', mode === 'list');
    gridBtn.classList.toggle('active', mode !== 'list');
    listBtn.classList.toggle('active', mode === 'list');
    DB.set('guideShelfMode', mode);
  };
  gridBtn.addEventListener('click', () => setShelfMode('grid'));
  listBtn.addEventListener('click', () => setShelfMode('list'));
  setShelfMode(DB.get('guideShelfMode', 'grid'));

  // Close chapter-detail meatball menu on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.guide-detail-menu-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.guide-detail-menu-btn.active').forEach(b => b.classList.remove('active'));
  });

  // Initial render — dort weitermachen, wo zuletzt gelesen wurde
  restoreGuideLastView();
  renderGuideContent();
}


// =========================
// SUCHQUELLE (js/hub-search.js, AI documentation/search.md) — nur lesen;
// open() springt zum Eintrag über die Funktionen dieses Tabs.
// =========================
registerSearchProvider({
  id: 'guides', label: 'Anleitungen', icon: '📖', view: 'guides',
  items: () => guideCategories.flatMap(cat => (cat.guides || []).map(g => ({
    id: g.id, title: g.title || 'Ohne Titel', sub: cat.name,
    text: [g.description, g.content].filter(v => typeof v === 'string' && v).join('\n'),
    keywords: Array.isArray(g.tags) ? g.tags : [],
    open: () => { showView('guides'); openGuideChapter(g.id); },
  }))),
});
