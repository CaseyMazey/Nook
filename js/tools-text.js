// =========================
// TOOLS — 11) TEXTWERKZEUGE
// Zähler (Zeichen, Wörter, Sätze, Lesezeit) mit optionalem Zeichen-
// Limit — z.B. für Berichtsheft-Einträge — und schnelle Umformungen
// (Groß/klein, Leerzeichen, Zeilen sortieren/entdoppeln).
// Benötigt tools.js (Karten-Raster) zuvor geladen.
// =========================

let toolsTextState = Object.assign({ text: '', limit: '' }, DB.get('toolsTextState', {}));
function saveToolsTextState() { DB.set('toolsTextState', toolsTextState); }

const TT_ACTIONS = [
  { id: 'upper',    label: 'GROSS',               fn: t => t.toLocaleUpperCase('de-DE') },
  { id: 'lower',    label: 'klein',               fn: t => t.toLocaleLowerCase('de-DE') },
  { id: 'sentence', label: 'Satzanfang groß',     fn: t => t.toLocaleLowerCase('de-DE').replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('de-DE')) },
  { id: 'title',    label: 'Jedes Wort Groß',     fn: t => t.replace(/\p{L}+/gu, w => w[0].toLocaleUpperCase('de-DE') + w.slice(1).toLocaleLowerCase('de-DE')) },
  { id: 'spaces',   label: 'Doppelte Leerzeichen weg', fn: t => t.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '') },
  { id: 'empty',    label: 'Leere Zeilen weg',    fn: t => t.split('\n').filter(l => l.trim()).join('\n') },
  { id: 'oneline',  label: 'Zu einer Zeile',      fn: t => t.replace(/\s*\n\s*/g, ' ').trim() },
  { id: 'sort',     label: 'Zeilen A–Z',          fn: t => t.split('\n').sort((a, b) => a.localeCompare(b, 'de')).join('\n') },
  { id: 'dedupe',   label: 'Doppelte Zeilen weg', fn: t => [...new Set(t.split('\n'))].join('\n') },
];

function toolsTextCardHtml() {
  return `
    <div class="tool-card tool-card--wide" id="tool-text">
      <div class="tool-card-header">
        <span class="tool-card-icon">📝</span>
        <span class="tool-card-title">Textwerkzeuge</span>
        <label class="tt-limit">Zeichen-Limit<input type="number" class="modal-input" id="tt-limit" min="1" placeholder="—"></label>
      </div>
      <div class="tool-card-body">
        <textarea class="modal-textarea tt-text" id="tt-text" placeholder="Text einfügen oder schreiben …" spellcheck="true"></textarea>
        <div class="tt-limit-bar hidden" id="tt-limit-bar"><span id="tt-limit-fill"></span></div>
        <div class="tt-stats" id="tt-stats"></div>
        <div class="tt-actions">
          ${TT_ACTIONS.map(a => `<button type="button" class="btn-ghost tt-action" data-tt-action="${a.id}">${a.label}</button>`).join('')}
          <button type="button" class="btn-ghost tt-action" id="tt-undo" disabled title="Letzte Umformung rückgängig">↶ Rückgängig</button>
          <button type="button" class="btn-ghost tt-action" id="tt-copy">📋 Kopieren</button>
          <button type="button" class="btn-ghost tt-action" id="tt-clear">Leeren</button>
        </div>
      </div>
    </div>`;
}

let ttUndo = null;

function ttStats(t) {
  const words = (t.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) || []).length;
  return {
    chars: [...t].length,
    charsNoSpace: [...t.replace(/\s/g, '')].length,
    words,
    sentences: (t.match(/[^.!?\n]+[.!?]+/g) || []).length || (t.trim() ? 1 : 0),
    paragraphs: t.split(/\n\s*\n/).filter(p => p.trim()).length,
    lines: t ? t.split('\n').length : 0,
    readMin: words / 200,
  };
}

function renderTextTool() {
  const el = document.getElementById('tt-stats');
  if (!el) return;
  const s = ttStats(toolsTextState.text);
  const limit = parseInt(toolsTextState.limit, 10);
  const stat = (v, l) => `<span class="tt-stat"><b>${v.toLocaleString('de-DE')}</b> ${l}</span>`;
  el.innerHTML = stat(s.chars, 'Zeichen') + stat(s.charsNoSpace, 'ohne Leerzeichen') + stat(s.words, s.words === 1 ? 'Wort' : 'Wörter')
    + stat(s.sentences, s.sentences === 1 ? 'Satz' : 'Sätze') + stat(s.paragraphs, 'Absätze') + stat(s.lines, 'Zeilen')
    + `<span class="tt-stat"><b>${s.readMin < 1 ? '< 1' : Math.round(s.readMin)}</b> Min. Lesezeit</span>`
    + (limit ? `<span class="tt-stat${s.chars > limit ? ' tt-stat--over' : ''}"><b>${(limit - s.chars).toLocaleString('de-DE')}</b> ${s.chars > limit ? 'zu viel' : 'übrig'}</span>` : '');
  const bar = document.getElementById('tt-limit-bar');
  bar.classList.toggle('hidden', !limit);
  if (limit) {
    const fill = document.getElementById('tt-limit-fill');
    fill.style.width = Math.min(100, s.chars / limit * 100) + '%';
    bar.classList.toggle('tt-limit-bar--over', s.chars > limit);
  }
  document.getElementById('tt-undo').disabled = ttUndo === null;
}

function ttSetText(text, undoable = true) {
  const ta = document.getElementById('tt-text');
  if (undoable) ttUndo = toolsTextState.text;
  toolsTextState.text = ta.value = text;
  saveToolsTextState();
  renderTextTool();
}

function initTextTool() {
  const ta = document.getElementById('tt-text');
  const limit = document.getElementById('tt-limit');
  ta.value = toolsTextState.text;
  limit.value = toolsTextState.limit;
  ta.addEventListener('input', () => { toolsTextState.text = ta.value; ttUndo = null; saveToolsTextState(); renderTextTool(); });
  limit.addEventListener('input', () => { toolsTextState.limit = limit.value; saveToolsTextState(); renderTextTool(); });
  document.querySelectorAll('#tool-text [data-tt-action]').forEach(b => b.addEventListener('click', () => {
    const a = TT_ACTIONS.find(x => x.id === b.dataset.ttAction);
    if (a && toolsTextState.text) ttSetText(a.fn(toolsTextState.text));
  }));
  document.getElementById('tt-undo').addEventListener('click', () => {
    if (ttUndo === null) return;
    const prev = ttUndo; ttUndo = null;
    ttSetText(prev, false);
  });
  document.getElementById('tt-copy').addEventListener('click', e => {
    if (!navigator.clipboard || !toolsTextState.text) return;
    navigator.clipboard.writeText(toolsTextState.text).then(() => {
      e.target.textContent = '✓ Kopiert';
      setTimeout(() => { e.target.textContent = '📋 Kopieren'; }, 1200);
    }).catch(() => {});
  });
  document.getElementById('tt-clear').addEventListener('click', () => { if (toolsTextState.text) ttSetText(''); });
  renderTextTool();
}
