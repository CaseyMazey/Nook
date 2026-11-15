// =========================
// PROJEKTE — Verknüpfungen zu Anleitungen und Pinnwand-Zetteln
// Ein Projekt kann Anleitungen und Pinnwand-Zettel anhängen („Verknüpft“ in
// den Projektinfos); die Anleitung zeigt dann unten „Verwendet in: …“.
// Gespeichert wird nur EINE Richtung, beim Projekt:
//   project.links = [{ provider: 'guides' | 'pinboard', id }]
// Die Rückrichtung wird beim Anzeigen aus den Projekten berechnet. Die
// Auswahl nutzt die Suchquellen der Tabs (hub-search.js: searchPickItems /
// searchFindItem), so kennt kein Tab den anderen. Gelöschte Ziele werden
// nicht still entfernt, sondern als „nicht mehr vorhanden“ gezeigt.
// Lädt nach projects.js, forest.js, guides.js, pinboard.js.
// =========================

const PROJECT_LINK_PROVIDERS = ['guides', 'pinboard'];
const PROJECT_LINK_LABEL = { guides: 'Anleitung', pinboard: 'Pinnwand' };
const PROJECT_LINK_ICON = { guides: '📖', pinboard: '📌' };

function projectLinks(p) {
  return Array.isArray(p && p.links) ? p.links.filter(l => l && PROJECT_LINK_PROVIDERS.includes(l.provider) && l.id) : [];
}

// Bereich „Verknüpft“ in den Projektinfos
function renderProjectLinks(p) {
  const box = document.getElementById('proj-detail-links');
  if (!box) return;
  const links = projectLinks(p);
  box.innerHTML = `
    <div class="pdt-links-head">
      <span class="pdt-info-key">Verknüpft</span>
      <button type="button" class="pdt-links-add" id="proj-links-add" title="Anleitung oder Pinnwand-Zettel verknüpfen">+ Verknüpfen</button>
    </div>
    ${links.length ? `<ul class="pdt-links-list">${links.map((l, i) => {
      const it = searchFindItem(l.provider, l.id);
      return `<li class="pdt-link${it ? '' : ' is-missing'}">
        <button type="button" class="pdt-link-open" data-link-i="${i}" ${it ? '' : 'disabled'} title="${it ? 'Öffnen' : 'Nicht mehr vorhanden'}">
          <span aria-hidden="true">${PROJECT_LINK_ICON[l.provider]}</span>
          <span class="pdt-link-title">${it ? escHtml(it.title) : 'nicht mehr vorhanden'}</span>
          <span class="pdt-link-kind">${PROJECT_LINK_LABEL[l.provider]}</span>
        </button>
        <button type="button" class="pdt-link-remove" data-link-remove="${i}" title="Verknüpfung entfernen" aria-label="Verknüpfung entfernen">✕</button>
      </li>`;
    }).join('')}</ul>` : '<div class="pdt-links-empty">Noch nichts verknüpft.</div>'}`;

  box.querySelector('#proj-links-add').addEventListener('click', () => openProjectLinkPicker(p));
  box.querySelectorAll('[data-link-i]').forEach(b => b.addEventListener('click', () => {
    const l = links[Number(b.dataset.linkI)];
    const it = l && searchFindItem(l.provider, l.id);
    if (it && typeof it.open === 'function') it.open();
  }));
  box.querySelectorAll('[data-link-remove]').forEach(b => b.addEventListener('click', () => {
    const before = (p.links || []).slice();
    const l = links[Number(b.dataset.linkRemove)];
    p.links = (p.links || []).filter(x => !(x.provider === l.provider && x.id === l.id));
    saveProjects();
    renderProjectLinks(p);
    hubUndo('Verknüpfung entfernt', () => { p.links = before; saveProjects(); renderProjectLinks(p); });
  }));
}

// Auswahl-Dialog: Anleitungen und Pinnwand-Zettel durchsuchen
const projectLinkModal = wireModal('project-link-overlay', { closeIds: ['project-link-close', 'project-link-cancel'] });
let projectLinkTarget = null;

function renderProjectLinkResults() {
  const list = document.getElementById('project-link-results');
  const q = document.getElementById('project-link-input').value;
  if (!list || !projectLinkTarget) return;
  const have = new Set(projectLinks(projectLinkTarget).map(l => `${l.provider}|${l.id}`));
  const items = searchPickItems(PROJECT_LINK_PROVIDERS, q, 30);
  list.innerHTML = items.length ? items.map((e, i) => {
    const linked = have.has(`${e.provider.id}|${e.id}`);
    return `<li><button type="button" class="project-link-item${linked ? ' is-linked' : ''}" data-pick="${i}" ${linked ? 'disabled' : ''}>
      <span aria-hidden="true">${PROJECT_LINK_ICON[e.provider.id]}</span>
      <span class="project-link-item-title">${escHtml(e.title)}</span>
      <span class="project-link-item-kind">${linked ? 'schon verknüpft' : escHtml(e.sub || PROJECT_LINK_LABEL[e.provider.id])}</span>
    </button></li>`;
  }).join('') : `<li class="project-link-empty">${q.trim() ? 'Nichts gefunden.' : 'Noch keine Anleitungen oder Pinnwand-Zettel.'}</li>`;
  list.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    const e = items[Number(b.dataset.pick)];
    if (!Array.isArray(projectLinkTarget.links)) projectLinkTarget.links = [];
    projectLinkTarget.links.push({ provider: e.provider.id, id: e.id });
    saveProjects();
    renderProjectLinks(projectLinkTarget);
    projectLinkModal.close();
  }));
}

function openProjectLinkPicker(p) {
  projectLinkTarget = p;
  const input = document.getElementById('project-link-input');
  input.value = '';
  renderProjectLinkResults();
  projectLinkModal.open();
  setTimeout(() => input.focus(), 30);
}
document.getElementById('project-link-input')?.addEventListener('input', renderProjectLinkResults);

// „Verwendet in: …“ — Projekte, die diesen Eintrag verknüpft haben (nur lesen)
function renderLinkedFrom(provider, id) {
  if (typeof projects === 'undefined') return null;
  const users = projects.filter(p => projectLinks(p).some(l => l.provider === provider && l.id === id));
  if (!users.length) return null;
  const el = document.createElement('div');
  el.className = 'linked-from';
  el.innerHTML = `<span class="linked-from-label">Verwendet in:</span> ${users.map(p => `<button type="button" class="linked-from-item" data-project="${escHtml(p.id)}">📁 ${escHtml(p.name || 'Projekt')}</button>`).join(' ')}`;
  el.querySelectorAll('[data-project]').forEach(b => b.addEventListener('click', () => {
    showView('projects');
    openProjectDetail(b.dataset.project);
  }));
  return el;
}
