// =========================
// FLASHCARDS — Markdown-Import
// Legt ganze Kartensätze aus einer .md-Datei (oder eingefügtem Text) an,
// statt jede Karte einzeln über das Karten-Modal zu erstellen.
//
// Lade-Reihenfolge: main.js (subjects, state, DB) -> hub-utils.js
// (wireModal, hubAlert) -> flashcards.js (saveSubjects, renderSubjectList,
// renderSubjectDetail) -> flashcards-import.js -> flashcards-exams.js
// (renderExamList wird erst beim Import aufgerufen, nicht beim Laden)
//
// Format (Vertrag: AI documentation/flashcards-import-format.md):
//   # Fach              -> subjects[] (optional darunter "Lehrer: …" und
//                          "Prüfung: …" = alle ## dieses Fachs in der Datei
//                          bilden zusammen eine Prüfung, js/flashcards-exams.js)
//   ## Themengruppe     -> subject.groups[]
//   ### Vorderseite     -> group.cards[].front
//   Text bis zur nächsten #/##/###-Überschrift -> card.back (Markdown roh
//   gespeichert, Code-Blöcke ``` dürfen #-Zeilen enthalten)
// Doppelte Karten = gleiche Vorderseite in derselben Themengruppe
// (Groß-/Kleinschreibung und Leerraum egal) werden übersprungen.
// =========================

const FC_IMPORT_TEMPLATE = `Erstelle mir zu diesem Lernzettel eine Markdown-Datei mit Karteikarten für meine App Nook. Halte dich genau an dieses Format:

# Fachname
Lehrer: Name (optional, diese Zeile kann fehlen)
Prüfung: Name der Prüfung (optional, siehe Regeln)

## Themengruppe

### Frage oder Begriff (Vorderseite, genau eine Zeile)
Antwort (Rückseite). Darf mehrere Zeilen, Listen und Code enthalten
und geht bis zur nächsten Überschrift.

### Nächste Frage
- Listenpunkt
- Listenpunkt

Regeln:
- "#" = Fach, "##" = Themengruppe, "###" = eine Karte. Jede Karte steht unter einem "##".
- "Prüfung:" direkt unter "#": Alle "##"-Themengruppen dieses Fachs in der Datei gehören zusammen zu dieser Prüfung und werden gemischt gelernt. Teile den Lernzettel deshalb in sinnvolle Unterthemen ("##") auf. Immer denselben Prüfungsnamen verwenden, wenn mehrere Dateien zur selben Prüfung gehören (z. B. „Klassenarbeit 1“).
- Die Vorderseite ist die "###"-Zeile, die Rückseite ist alles darunter bis zur nächsten "#", "##" oder "###"-Überschrift.
- In Antworten keine Überschriften mit 1–3 "#" verwenden (für Zwischentitel "####" oder **fett**).
- Code in Antworten als Code-Block mit \`\`\` – darin dürfen auch #-Zeilen stehen.
- Jede Vorderseite pro Themengruppe nur einmal, kurz und eindeutig formulieren.
- Antworten knapp halten: das Wichtigste zuerst, lieber mehrere kleine Karten als eine riesige.
- Nur die Markdown-Datei ausgeben, keine Einleitung, keine Erklärung davor oder danach.

Beispiel:

# LF 3 Netzwerke
Lehrer: Herr Müller
Prüfung: Klassenarbeit Netzwerke

## Subnetting

### Wie viele nutzbare Hosts hat ein /26-Netz?
62 Hosts: 2^6 = 64 Adressen, minus Netz- und Broadcastadresse.

### Wofür steht CIDR?
Classless Inter-Domain Routing
`;

let fcImportParsed = null;   // letztes Parse-Ergebnis { subjects, warnings }
let fcImportTargets = {};    // normierter Fachname aus Datei -> 'new' | subject.id (Nutzerwahl)

function fcImportNorm(str){
  return String(str || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Entfernt nur führende/abschließende Leerzeilen — Einrückung (Code) bleibt
function fcImportTrimLines(lines){
  let a = 0, b = lines.length;
  while(a < b && !lines[a].trim()) a++;
  while(b > a && !lines[b-1].trim()) b--;
  return lines.slice(a, b).map(l => l.replace(/\s+$/, '')).join('\n');
}

function fcImportParse(text){
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const result = { subjects: [], warnings: [] };
  let subj = null, group = null, card = null;
  let fence = null;            // aktives Code-Fence-Zeichen (``` oder ~~~)
  let strayLine = null;        // erste Zeile eines Textblocks ohne Karte

  const flushStray = () => {
    if(strayLine) result.warnings.push(`Zeile ${strayLine}: Text außerhalb einer Karte ignoriert.`);
    strayLine = null;
  };
  const finishCard = () => {
    if(!card) return;
    const back = fcImportTrimLines(card.backLines);
    if(card.orphan) result.warnings.push(`Zeile ${card.line}: Karte „${card.front}“ steht unter keiner Themengruppe (##) – übersprungen.`);
    else if(!back) result.warnings.push(`Zeile ${card.line}: Karte „${card.front}“ hat keine Rückseite – übersprungen.`);
    else group.cards.push({ front: card.front, back, line: card.line });
    card = null;
  };
  const ensureSubject = (name, ln) => {
    const found = result.subjects.find(s => fcImportNorm(s.name) === fcImportNorm(name));
    if(found) return found;
    const s = { name, teacher: '', exam: '', groups: [], line: ln };
    result.subjects.push(s);
    return s;
  };

  lines.forEach((raw, i) => {
    const ln = i + 1;
    const fenceMatch = raw.match(/^\s*(```|~~~)/);
    const heading = !fence && !fenceMatch ? raw.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/) : null;

    if(heading){
      flushStray();
      finishCard();
      const level = heading[1].length, title = heading[2].trim();
      if(level === 1){
        subj = ensureSubject(title, ln);
        group = null;
      } else if(level === 2){
        if(!subj){
          subj = ensureSubject('Import', ln);
          result.warnings.push(`Zeile ${ln}: Themengruppe ohne Fach (#) – Fach „Import“ angenommen.`);
        }
        group = subj.groups.find(g => fcImportNorm(g.name) === fcImportNorm(title));
        if(!group){ group = { name: title, cards: [] }; subj.groups.push(group); }
      } else {
        card = { front: title, backLines: [], line: ln, orphan: !group };
      }
      return;
    }

    if(fenceMatch){
      if(!fence) fence = fenceMatch[1];
      else if(raw.trim().startsWith(fence)) fence = null;
    }

    if(card){ card.backLines.push(raw); return; }
    if(!raw.trim() || /^\s*<!--.*-->\s*$/.test(raw)) return;
    const teacher = subj && !group ? raw.match(/^\s*Lehrer(?:in)?\s*:\s*(.+)$/i) : null;
    if(teacher){ subj.teacher = teacher[1].trim(); return; }
    const exam = subj && !group ? raw.match(/^\s*Pr(?:ü|ue)fung\s*:\s*(.+)$/i) : null;
    if(exam){ subj.exam = exam[1].trim(); return; }
    if(!strayLine) strayLine = ln;
  });
  flushStray();
  finishCard();
  if(fence) result.warnings.push('Ein Code-Block (```) wurde nicht geschlossen – der Rest der Datei zählt zur letzten Karte.');
  return result;
}

function fcImportDefaultTarget(parsedSubj){
  const match = subjects.find(s => fcImportNorm(s.name) === fcImportNorm(parsedSubj.name));
  return match ? match.id : 'new';
}

function fcImportTargetFor(parsedSubj){
  const key = fcImportNorm(parsedSubj.name);
  const chosen = fcImportTargets[key];
  if(chosen && (chosen === 'new' || subjects.some(s => s.id === chosen))) return chosen;
  return fcImportDefaultTarget(parsedSubj);
}

// Gemeinsame Berechnung für Vorschau und Speichern: was wird neu, was ist doppelt
function fcImportPlan(parsed){
  return parsed.subjects.map(ps => {
    const targetId = fcImportTargetFor(ps);
    const target = targetId === 'new' ? null : subjects.find(s => s.id === targetId);
    const groups = ps.groups.map(pg => {
      const existingGroup = target?.groups.find(g => fcImportNorm(g.name) === fcImportNorm(pg.name)) || null;
      const seen = new Set((existingGroup?.cards || []).map(c => fcImportNorm(c.front)));
      const fresh = [], dup = [];
      pg.cards.forEach(c => {
        const key = fcImportNorm(c.front);
        if(seen.has(key)) dup.push(c);
        else { seen.add(key); fresh.push(c); }
      });
      return { name: pg.name, existingGroup, fresh, dup };
    });
    return { parsed: ps, targetId, target, groups };
  });
}

function renderFcImportPreview(){
  const wrap = document.getElementById('fc-import-preview');
  const saveBtn = document.getElementById('fc-import-save');
  const text = document.getElementById('fc-import-text').value;
  if(!text.trim()){
    fcImportParsed = null;
    wrap.innerHTML = '<div class="fc-import-empty">Noch kein Inhalt – Datei wählen oder Text einfügen.</div>';
    saveBtn.disabled = true; saveBtn.textContent = 'Importieren';
    return;
  }
  fcImportParsed = fcImportParse(text);
  const plan = fcImportPlan(fcImportParsed);
  const totalFresh = plan.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.fresh.length, 0), 0);
  const totalDup = plan.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.dup.length, 0), 0);

  const subjOptions = (sel) => `<option value="new"${sel==='new'?' selected':''}>Neues Fach anlegen</option>` +
    subjects.map(s => `<option value="${s.id}"${sel===s.id?' selected':''}>In „${escHtml(s.name)}“ einfügen</option>`).join('');

  const subjHtml = plan.map((p, i) => `
    <div class="fc-import-subj">
      <div class="fc-import-subj-head">
        <span class="fc-import-subj-name">📚 ${escHtml(p.parsed.name)}</span>
        <select class="modal-select fc-import-target" data-idx="${i}">${subjOptions(p.targetId)}</select>
      </div>
      ${p.parsed.exam ? `<div class="fc-import-exam">🎯 Prüfung „${escHtml(p.parsed.exam)}“ – ${p.groups.length} ${p.groups.length!==1?'Themen':'Thema'} gemischt lernen${(p.target?.exams || []).some(x => fcImportNorm(x.name) === fcImportNorm(p.parsed.exam)) ? ' (bestehende Prüfung, Themen werden ergänzt)' : ''}</div>` : ''}
      ${p.groups.length ? p.groups.map(g => `
        <div class="fc-import-group">
          <span class="fc-import-group-name">${escHtml(g.name)}</span>
          <span class="fc-import-group-tag">${g.existingGroup ? 'bestehende Gruppe' : 'neue Gruppe'}</span>
          <span class="fc-import-group-count">${g.fresh.length} neu${g.dup.length ? ` · ${g.dup.length} doppelt` : ''}</span>
        </div>`).join('') : '<div class="fc-import-empty">Keine Themengruppen (##) gefunden.</div>'}
    </div>`).join('');

  const warnHtml = fcImportParsed.warnings.length ? `
    <div class="fc-import-warnings">
      <div class="fc-import-warn-title">⚠️ ${fcImportParsed.warnings.length} Hinweis${fcImportParsed.warnings.length!==1?'e':''}</div>
      <ul>${fcImportParsed.warnings.map(w => `<li>${escHtml(w)}</li>`).join('')}</ul>
    </div>` : '';

  wrap.innerHTML = `
    <div class="fc-import-summary">${totalFresh} neue Karte${totalFresh!==1?'n':''}${totalDup ? ` · ${totalDup} doppelte ${totalDup!==1?'werden':'wird'} übersprungen` : ''}</div>
    ${subjHtml || '<div class="fc-import-empty">Kein Fach (#) gefunden.</div>'}
    ${warnHtml}`;

  wrap.querySelectorAll('.fc-import-target').forEach(sel => sel.addEventListener('change', () => {
    fcImportTargets[fcImportNorm(plan[+sel.dataset.idx].parsed.name)] = sel.value;
    renderFcImportPreview();
  }));
  const examOnly = !totalFresh && plan.some(p => p.parsed.exam && p.target);
  saveBtn.disabled = totalFresh === 0 && !examOnly;
  saveBtn.textContent = totalFresh ? `${totalFresh} Karte${totalFresh!==1?'n':''} importieren` : (examOnly ? 'Prüfung zuordnen' : 'Importieren');
}

function applyFcImport(){
  if(!fcImportParsed) return;
  const plan = fcImportPlan(fcImportParsed);
  let added = 0, skipped = 0, firstSubjId = null;
  let examsTouched = 0;
  plan.forEach(p => {
    const freshCount = p.groups.reduce((n, g) => n + g.fresh.length, 0);
    skipped += p.groups.reduce((n, g) => n + g.dup.length, 0);
    // Nur Duplikate, aber Prüfung angegeben: bestehende Gruppen trotzdem zuordnen
    if(!freshCount && !(p.parsed.exam && p.target)) return;
    let subj = p.target;
    if(!subj){
      subj = { id: crypto.randomUUID(), name: p.parsed.name, teacher: p.parsed.teacher || '', groups: [] };
      subjects.push(subj);
    }
    if(!firstSubjId) firstSubjId = subj.id;
    p.groups.forEach(g => {
      if(!g.fresh.length) return;
      let group = subj.groups.find(x => fcImportNorm(x.name) === fcImportNorm(g.name));
      if(!group){ group = { id: crypto.randomUUID(), name: g.name, cards: [] }; subj.groups.push(group); }
      g.fresh.forEach(c => {
        group.cards.push({ id: crypto.randomUUID(), front: c.front, back: c.back, box: 1, lastSeen: null, totalAnswers: 0, correctAnswers: 0, hard: false });
        added++;
      });
    });
    if(p.parsed.exam){
      const groupIds = p.groups.map(g => subj.groups.find(x => fcImportNorm(x.name) === fcImportNorm(g.name))?.id).filter(Boolean);
      if(!subj.exams) subj.exams = [];
      let exam = subj.exams.find(x => fcImportNorm(x.name) === fcImportNorm(p.parsed.exam));
      if(!exam){ exam = { id: crypto.randomUUID(), name: p.parsed.exam, groupIds: [] }; subj.exams.push(exam); }
      groupIds.forEach(id => { if(!exam.groupIds.includes(id)) exam.groupIds.push(id); });
      if(groupIds.length) examsTouched++;
    }
  });
  if(!added && !examsTouched) return;
  saveSubjects();
  fcImportModal.close();
  state.activeSubjectId = firstSubjId;
  renderSubjectList();
  renderSubjectDetail();
  hubAlert('Import abgeschlossen', `${added} Karte${added!==1?'n':''} importiert.` + (skipped ? ` ${skipped} doppelte Karte${skipped!==1?'n':''} übersprungen.` : '') + (examsTouched ? ' Prüfung angelegt bzw. ergänzt.' : ''));
}

function copyFcImportTemplate(){
  const btn = document.getElementById('fc-import-copy-template');
  const done = ok => {
    const old = btn.dataset.label || btn.textContent;
    btn.dataset.label = old;
    btn.textContent = ok ? '✓ Kopiert' : 'Kopieren nicht möglich';
    setTimeout(() => { btn.textContent = old; }, 1600);
  };
  // Fallback für Browser ohne Clipboard-API (z.B. manche file://-Kontexte)
  const legacyCopy = () => {
    const ta = document.createElement('textarea');
    ta.value = FC_IMPORT_TEMPLATE; ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove(); done(ok);
  };
  if(navigator.clipboard?.writeText) navigator.clipboard.writeText(FC_IMPORT_TEMPLATE).then(() => done(true), legacyCopy);
  else legacyCopy();
}

const fcImportModal = wireModal('fc-import-modal-overlay', {
  closeIds: ['fc-import-modal-close', 'fc-import-modal-cancel'],
  onClose: () => { fcImportParsed = null; fcImportTargets = {}; },
});

function openFcImportModal(){
  document.getElementById('fc-import-text').value = '';
  document.getElementById('fc-import-file-name').textContent = '';
  fcImportTargets = {};
  renderFcImportPreview();
  fcImportModal.open();
}

document.getElementById('fc-import-btn').addEventListener('click', openFcImportModal);
document.getElementById('fc-import-save').addEventListener('click', applyFcImport);
document.getElementById('fc-import-copy-template').addEventListener('click', copyFcImportTemplate);
document.getElementById('fc-import-text').addEventListener('input', renderFcImportPreview);
document.getElementById('fc-import-pick-file').addEventListener('click', () => document.getElementById('fc-import-file').click());
document.getElementById('fc-import-file').addEventListener('change', e => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('fc-import-text').value = reader.result;
    document.getElementById('fc-import-file-name').textContent = file.name;
    renderFcImportPreview();
  };
  reader.onerror = () => hubAlert('Datei nicht lesbar', `„${file.name}“ konnte nicht gelesen werden.`);
  reader.readAsText(file);
  e.target.value = ''; // gleiche Datei erneut wählbar
});
