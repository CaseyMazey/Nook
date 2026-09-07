// =========================
// BUDGET — GELDFLUSS (ersetzt die bisherige, textlastige Finanzanalyse)
// Reines Planungsboard, KEINE Monatsansicht mit echten Kalenderdaten:
// "Woche 1–4" sind generische Platzhalter, kein bestimmter Monat. Man
// plant hier einmalig, wovon eine Ausgabe/ein Sparziel/eine Schuld
// bezahlt wird — das Ergebnis gilt dauerhaft, bis es geändert wird
// (kein "für jeden Monat neu aufsetzen"). Gespeichert wird deshalb auch
// NUR "Taschengeld finanziert ChatGPT", niemals "Woche 2 von Taschengeld
// finanziert ChatGPT" — die Verteilung auf die 4 Wochen-Karten ist rein
// visuell (sequenzielle Auffüllung), kein eigenes Datenfeld.
//
// Architektur — keine doppelte Logik:
//   - Monats-Äquivalent: recurringMonthlyEquivalent() (budget.js)
//   - Sparziel-Bedarf:   goalMonthlyReserveEquivalent() (budget-sparziele.js)
//   - Schulden-Rest:     debtRemaining()                (budget-debts.js)
//   - Freier Betrag:     financingFreeForIncome()        (budget-financing.js)
// Drag & Drop schreibt ausschließlich in das bestehende Finanzierungs-
// Format (`funding: [{sourceId, amount}]`) — denselben Feldern, die auch
// der Checkbox-Editor in den Modals nutzt (beides bleibt nutzbar). Nur
// hier in der Geldfluss-Ansicht kommt zusätzlich ein optionales `cardUid`
// dazu, das einen Eintrag auf die konkret gezogene Wochen-/Balken-Karte
// pinnt (siehe distributeGeldfluss/geldflussAssign) — der Checkbox-Editor
// ignoriert dieses Feld einfach, es ist rein additiv.
// Muss NACH budget.js, budget-sparziele.js, budget-financing.js,
// budget-debts.js geladen werden.
// =========================

// ── Datenaufbau ──────────────────────────────────────────────────────
// Generische 4-Wochen-Vorlage pro wiederkehrender Einnahme — KEINE
// echten Kalenderdaten. Wöchentlich → eine Karte je Woche (4). 2-wöchent-
// lich → Woche 1 & 3. Täglich → 7 Karten je Woche (28). Monatlich/
// jährlich bekommen gar keine Wochen-Karte, sondern einen Balken (siehe
// renderGeldflussIncomeArea) — sie sollen ja "für den ganzen Zeitraum"
// reichen, nicht an eine Woche gebunden sein.
function geldflussWeeklyOccurrences(entry){
  const amount = entry.amount || 0;
  if (entry.freq === 'daily')    return [0, 1, 2, 3].flatMap(w => Array.from({ length: 7 }, () => ({ week: w, amount })));
  if (entry.freq === 'weekly')   return [0, 1, 2, 3].map(w => ({ week: w, amount }));
  if (entry.freq === 'biweekly') return [0, 2].map(w => ({ week: w, amount }));
  return [];
}

// ── Farbgebung je Einnahmequelle — angelehnt ans Mockup: jede Einnahme
// bekommt eine eigene, stabile Farbfamilie (wiederverwendet bestehende
// Budget-Farbtöne + die zwei neuen aus budget.css), damit man auf einen
// Blick sieht, welche Stapel-Karte zu welcher Einnahme gehört.
const GF_INCOME_PALETTE = ['gf-income-c1', 'gf-income-c2', 'gf-income-c3', 'gf-income-c4'];
function incomeColorClass(recurringId){
  const incomes = budgetIncomeSources().filter(r => r.freq !== 'yearly');
  const idx = Math.max(0, incomes.findIndex(r => r.id === recurringId));
  return GF_INCOME_PALETTE[idx % GF_INCOME_PALETTE.length];
}

function buildGeldflussIncomeCards(){
  const cards = [];
  // Jährliche Einnahmen bewusst NICHT einbezogen — der Geldfluss ist
  // eine reine Monatsansicht, einmal im Jahr auftretende Zahlungen sind
  // Sonderfälle, die hier nicht sinnvoll dargestellt werden können.
  // budgetIncomeSources() blendet zusätzlich Taschengeld (budget-
  // taschengeld.js) ein, wenn aktiviert — als freq:'monthly'-Eintrag läuft
  // es hier automatisch in den Balken-Zweig unten (isBar), genau wie jede
  // andere monatliche Einnahme.
  budgetIncomeSources().filter(r => r.freq !== 'yearly').forEach(r => {
    const isBar = r.freq === 'monthly';
    if (isBar) {
      cards.push({ uid: `${r.id}@bar`, recurringId: r.id, name: r.name, amount: r.amount, stack: [], remaining: r.amount, isBar: true, week: null });
    } else {
      geldflussWeeklyOccurrences(r).forEach((occ, i) => {
        cards.push({ uid: `${r.id}@${occ.week}-${i}`, recurringId: r.id, name: r.name, amount: occ.amount, stack: [], remaining: occ.amount, isBar: false, week: occ.week });
      });
    }
  });
  cards.sort((a, b) => (a.week ?? -1) - (b.week ?? -1));
  return cards;
}

// Alle "Belastungen" (Ausgaben/Sparziele/Schulden) mit ihrem tatsächlich
// benötigten Betrag (nutzt vorhandene Berechnungen, siehe Header) und
// ihrer bestehenden Finanzierung. Genau EINE Karte pro Objekt — auch bei
// wiederkehrenden Ausgaben mit einem Intervall, da es hier nicht um
// Kalendertermine geht, sondern nur um "wovon wird das bezahlt".
// Onetime-Ausgaben zählen, solange sie noch nicht bezahlt sind (nicht an
// einen bestimmten Monat gebunden, siehe Dateikopf). Jährliche Ausgaben
// bewusst NICHT einbezogen — reine Monatsansicht, siehe oben.
function buildGeldflussConsumers(){
  const list = [];
  budgetRecurring.filter(r => r.type === 'expense' && r.freq !== 'yearly').forEach(r => {
    list.push({ kind: 'expense', id: r.id, uid: r.id, name: r.name, amount: recurringMonthlyEquivalent(r),
      funding: r.funding || [], obj: r });
  });
  // Alte/abgelaufene einmalige Ausgaben (monthKey liegt vor dem aktuellen
  // Monat) sollen hier nicht mehr auftauchen — nur der aktuelle Monat und
  // Zukünftiges ist für die Planung noch relevant. Bereits vollständig
  // bezahlte (e.paid) waren schon vorher ausgeschlossen.
  const curGfMonthKey = budgetMonthKey(new Date());
  budgetOnetime.filter(e => e.type === 'expense' && !e.paid && e.monthKey >= curGfMonthKey).forEach(e => {
    list.push({ kind: 'expense', id: e.id, uid: e.id, name: e.name, amount: e.amount,
      funding: e.funding || [], obj: e, isOnetime: true });
  });
  // Archivierte Sparziele/Schulden (siehe archiveGoal()/archiveDebt() in
  // budget-sparziele.js/budget-debts.js) sind erledigt — sie sollen hier
  // keine Einnahmen-Kapazität mehr belegen, damit archivierte Posten die
  // Rest-Anzeige der Wochen-/Balken-Karten nicht dauerhaft blockieren.
  budgetGoals.filter(g => !g.archived).forEach(g => {
    const need = goalMonthlyReserveEquivalent(g);
    const remaining = round2(Math.max(0, g.target - g.current));
    const amount = need > 0.005 ? need : remaining;
    if (amount <= 0.005) return;
    list.push({ kind: 'goal', id: g.id, uid: g.id, name: g.name, amount,
      funding: g.funding || [], obj: g, isMonthly: need > 0.005 });
  });
  budgetDebts.filter(d => !d.archived).forEach(d => {
    const remaining = debtRemaining(d);
    if (remaining <= 0.005) return;
    list.push({ kind: 'debt', id: d.id, uid: d.id, name: d.name, amount: remaining,
      funding: d.funding || [], obj: d });
  });
  return list;
}

// Verteilt die bereits zugeordneten Finanzierungsbeträge (funding) jedes
// Verbrauchers auf die generischen Wochen-Karten seiner Einnahmequelle —
// der Reihe nach, erste Karte zuerst. Rein visuelle Aufteilung, siehe
// Kommentar am Dateianfang — es wird NICHT gespeichert, welche Karte
// konkret gewählt wurde.
function distributeGeldfluss(incomeCards, consumers){
  const byRecurringId = {};
  incomeCards.forEach(c => { (byRecurringId[c.recurringId] ||= []).push(c); });
  // Karten sind über ihre uid eindeutig ansprechbar — Grundlage für die
  // Pin-Zuordnung unten (siehe geldflussAssign()/cardUid).
  const cardByUid = {};
  incomeCards.forEach(c => { cardByUid[c.uid] = c; });

  Object.keys(byRecurringId).forEach(recId => {
    const cards = byRecurringId[recId];
    let cardIdx = 0;
    consumers.forEach(cons => {
      // Jeder Finanzierungseintrag wird jetzt EINZELN behandelt (nicht
      // mehr zu einem Gesamtbetrag je Einnahme zusammengefasst) — seit
      // dem Architektur-Fix ist jeder Eintrag ohnehin schon beim
      // Zuordnen auf die Kapazität EINER Karte gedeckelt, landet also
      // im Normalfall komplett in genau einer Karte.
      cons.funding.filter(f => f.sourceId === recId).forEach(f => {
        if (f.amount <= 0.005) return;

        // KORREKTUR (gemeldeter Zuordnungs-Bug): Einträge mit cardUid sind
        // an eine KONKRETE Karte gepinnt — die Karte, auf die beim Drag &
        // Drop tatsächlich gezogen wurde (siehe onGfPointerUp/
        // geldflussAssign). Sie landen unabhängig von der sequenziellen
        // Auffüllung unten direkt auf genau dieser Karte. Vorher wurde
        // JEDE Zuordnung ausschließlich sequenziell in die erste Karte mit
        // Platz gepackt — unabhängig davon, welche Karte man tatsächlich
        // gezogen hatte, wodurch Ausgaben beim nächsten Rendern in der
        // falschen Woche landeten. Nur Einträge OHNE Pin (Daten von vor
        // diesem Fix, oder deren Karte existiert nicht mehr, z. B. weil
        // sich die Frequenz der Einnahme seither geändert hat) laufen
        // weiterhin über die alte, sequenzielle Auffüllung als Fallback.
        const pinnedCard = f.cardUid ? cardByUid[f.cardUid] : null;
        if (pinnedCard && pinnedCard.recurringId === recId) {
          const fits = f.amount <= pinnedCard.remaining + 0.005;
          pinnedCard.stack.push({ kind: cons.kind, id: cons.id, uid: cons.uid, name: cons.name, amount: f.amount, fundingEntryId: f.id, over: !fits });
          pinnedCard.remaining = round2(pinnedCard.remaining - f.amount);
          return;
        }

        let left = f.amount;
        while (left > 0.005 && cardIdx < cards.length) {
          const card = cards[cardIdx];
          const take = round2(Math.min(left, card.remaining));
          if (take > 0.005) {
            card.stack.push({ kind: cons.kind, id: cons.id, uid: cons.uid, name: cons.name, amount: take, fundingEntryId: f.id });
            card.remaining = round2(card.remaining - take);
            left = round2(left - take);
          }
          if (card.remaining <= 0.005) cardIdx++; else break;
        }
        if (left > 0.005 && cards.length) {
          const overCard = cards[cards.length - 1];
          overCard.stack.push({ kind: cons.kind, id: cons.id, uid: cons.uid, name: cons.name, amount: left, fundingEntryId: f.id, over: true });
          overCard.remaining = round2(overCard.remaining - left);
        }
      });
    });
  });
}

function consumerAssigned(cons){ return round2(cons.funding.reduce((s, f) => s + f.amount, 0)); }
function consumerRemainder(cons){ return round2(Math.max(0, cons.amount - consumerAssigned(cons))); }

function saveConsumerObject(kind, obj){
  if (kind === 'expense') { obj.freq !== undefined ? saveBudgetRecurring() : saveBudgetOnetime(); }
  else if (kind === 'goal') saveBudgetGoals();
  else if (kind === 'debt') saveBudgetDebts();
}
function findConsumerObject(kind, id){
  if (kind === 'expense') return budgetRecurring.find(r => r.id === id) || budgetOnetime.find(e => e.id === id);
  if (kind === 'goal') return budgetGoals.find(g => g.id === id);
  if (kind === 'debt') return budgetDebts.find(d => d.id === id);
  return null;
}

// ── Zuordnen / Entfernen — schreibt ausschließlich ins bestehende
// funding-Array, keine neue Datenstruktur bei den Verbrauchern selbst.
// KORREKTUR (gemeldeter Architekturfehler): Zuordnung wird jetzt IMMER
// auf die Kapazität der KONKRET GEZOGENEN KARTE gedeckelt (cardCapacity),
// NICHT mehr auf den monatlichen Gesamt-Freibetrag der Einnahme. Reicht
// die Karte nicht, wird NUR der passende Teil zugeordnet — der Rest wird
// NIE automatisch anderswo platziert, sondern bleibt als (kleinerer)
// Rest bei der Ausgabe selbst sichtbar, bis der Nutzer ihn selbst zieht.
// Jeder Zuordnungs-Eintrag bekommt eine eigene ID (kein Zusammenführen
// mit vorhandenen Einträgen derselben Quelle mehr) — dadurch lässt sich
// jede einzelne Zuordnung unabhängig verschieben/entfernen, ohne
// versehentlich andere Zuordnungen derselben Einnahme mit zu beeinflussen.
// cardUid pinnt den Eintrag zusätzlich auf die KONKRETE Karte, die
// tatsächlich gezogen wurde (siehe distributeGeldfluss()) — ohne das
// würde die Zuordnung beim nächsten Rendern wieder rein sequenziell neu
// verteilt, unabhängig davon, wohin sie gezogen wurde.
function geldflussAssign(cons, recurringId, amount, cardCapacity, cardUid){
  const cap = cardCapacity == null ? amount : Math.max(0, cardCapacity);
  const take = round2(Math.min(amount, cap));
  if (take <= 0.005) return false;
  const obj = cons.obj;
  if (!Array.isArray(obj.funding)) obj.funding = [];
  obj.funding.push({ id: crypto.randomUUID(), sourceId: recurringId, amount: take, cardUid: cardUid || null });
  saveConsumerObject(cons.kind, obj);
  return true;
}
// Entfernt GENAU EINEN Zuordnungs-Eintrag (per eigener ID) — nicht mehr
// "alle Einträge dieser Einnahme". Das war die eigentliche Ursache des
// gemeldeten Dopplungs-Bugs: Verschieben einer einzelnen Karte hat
// vorher versehentlich auch andere, unabhängige Zuordnungen zur selben
// Einnahme mit entfernt.
function geldflussUnassign(kind, id, fundingEntryId){
  const obj = findConsumerObject(kind, id);
  if (!obj || !Array.isArray(obj.funding)) return;
  obj.funding = obj.funding.filter(f => f.id !== fundingEntryId);
  saveConsumerObject(kind, obj);
}

// ── Rendering: obere Zeile — Einnahmen-Töpfe ────────────────────────
const GELDFLUSS_ICON = { expense: '🔁', goal: '🎯', debt: '💳' };

function renderGeldflussStack(stackEl, stack, recurringId, cardUid){
  stack.forEach((item, i) => {
    const mini = document.createElement('div');
    mini.className = 'gf-stack-item' + (item.over ? ' gf-stack-item--over' : '');
    mini.style.setProperty('--gf-i', i);
    mini.innerHTML = `<span class="gf-drag-handle" aria-hidden="true">⠿</span><span>${GELDFLUSS_ICON[item.kind] || ''} ${item.name}</span><span>${fmtEuro(item.amount)}</span>`;
    mini.title = 'Klicken zum Entfernen — oder auf eine andere Einnahme ziehen';
    // Klicken UND Ziehen laufen jetzt über denselben Mechanismus
    // (makeGeldflussDraggable erkennt anhand der Bewegung, was gemeint
    // ist) — kein separater 'click'-Listener mehr, der mit dem Drag-
    // System kollidieren könnte. cardUid identifiziert die KONKRETE
    // Karte, aus der diese Zuordnung stammt (siehe geldflussAssign).
    // .gf-drag-handle: auf Touch nur darüber ziehbar (siehe
    // makeGeldflussDraggable) — auf Desktop unsichtbar, Maus zieht wie
    // gehabt von der ganzen Karte aus.
    makeGeldflussDraggable(mini, { kind: item.kind, id: item.id, name: item.name }, item.amount, recurringId, item.fundingEntryId, cardUid, mini.querySelector('.gf-drag-handle'));
    stackEl.appendChild(mini);
  });
}

function renderGeldflussIncomeCard(card){
  const el = document.createElement('div');
  el.className = 'gf-income-card ' + incomeColorClass(card.recurringId);
  el.dataset.recurringId = card.recurringId;
  el.dataset.uid = card.uid; // eindeutige Karten-ID — Grundlage für die Drop-Zuordnung (siehe onGfPointerUp)
  el.dataset.remaining = card.remaining; // eigene Kapazität DIESER Karte — nicht der Monats-Aggregat-Freibetrag
  const pct = card.amount > 0 ? Math.max(0, Math.min(100, Math.round((card.remaining / card.amount) * 100))) : 0;
  const restClass = pct > 25 ? 'gf-rest-ok' : (card.remaining >= -0.005 ? 'gf-rest-low' : 'gf-rest-over');

  // Rest ist jetzt die groß hervorgehobene Hauptinformation, der
  // ursprüngliche Betrag rutscht zur kleinen Nebeninfo (gleiches
  // Kartendesign, nur andere Gewichtung — auf Wunsch umgestellt).
  el.innerHTML = `
    <div class="gf-income-head">
      <span class="gf-income-name">${resolveIncomeIcon(card.recurringId, card.name)} ${card.name}</span>
    </div>
    <div class="gf-rest gf-rest-hero ${restClass}">Rest ${fmtEuro(card.remaining)}</div>
    <div class="gf-stack"></div>
    <div class="gf-income-amount-sub">${fmtEuro(card.amount)}</div>`;
  renderGeldflussStack(el.querySelector('.gf-stack'), card.stack, card.recurringId, card.uid);
  return el;
}

// Monatliche/jährliche Einnahmen: durchgehender Balken statt kleiner
// Karte, damit sofort sichtbar ist: "das soll für den ganzen Zeitraum
// reichen", nicht "das ist ein einzelner Zahltag". Name + Rest rücken
// eng zusammen in die Mitte, der volle Betrag bleibt als kleine
// Nebeninfo daneben — nicht mehr über die ganze Breite verteilt.
function renderGeldflussIncomeBar(card){
  const el = document.createElement('div');
  el.className = 'gf-income-bar ' + incomeColorClass(card.recurringId);
  el.dataset.recurringId = card.recurringId;
  el.dataset.uid = card.uid;
  el.dataset.remaining = card.remaining;
  const pct = card.amount > 0 ? Math.max(0, Math.min(100, Math.round((card.remaining / card.amount) * 100))) : 0;
  const restClass = pct > 25 ? 'gf-rest-ok' : (card.remaining >= -0.005 ? 'gf-rest-low' : 'gf-rest-over');

  el.innerHTML = `
    <div class="gf-bar-main">
      <span class="gf-bar-name">${resolveIncomeIcon(card.recurringId, card.name)} ${card.name}</span>
      <span class="gf-bar-rest ${restClass}">Rest ${fmtEuro(card.remaining)}</span>
      <span class="gf-bar-amount-sub">von ${fmtEuro(card.amount)}</span>
    </div>
    <div class="gf-stack gf-stack--bar"></div>`;
  renderGeldflussStack(el.querySelector('.gf-stack'), card.stack, card.recurringId, card.uid);
  return el;
}

// Baut den oberen Bereich als generisches 4-Wochen-Planungsboard —
// KEINE echten Kalenderdaten (siehe Dateikopf). Zeigt zusätzlich den
// Monatsrest (Pille, wie die Kontostand-Pille) und pro Woche die
// zusammengefasste Restsumme direkt im Spaltenkopf.
function renderGeldflussIncomeArea(container, incomeCards){
  const monatsrest = round2(incomeCards.reduce((s, c) => s + c.remaining, 0));
  const monatsrestClass = monatsrest > 0.005 ? 'gf-rest-ok' : (monatsrest >= -0.005 ? 'gf-rest-low' : 'gf-rest-over');
  const monatsrestPill = document.createElement('div');
  monatsrestPill.className = 'gf-monatsrest-pill';
  monatsrestPill.innerHTML = `<span class="gf-monatsrest-label">Monatsrest</span><span class="gf-monatsrest-value ${monatsrestClass}">${fmtEuro(monatsrest)}</span>`;
  container.appendChild(monatsrestPill);

  const weekGrid = document.createElement('div');
  weekGrid.className = 'gf-week-grid';
  weekGrid.style.setProperty('--gf-week-count', 4);
  for (let i = 0; i < 4; i++) {
    const weekCards = incomeCards.filter(c => !c.isBar && c.week === i);
    const weekTotal = round2(weekCards.reduce((s, c) => s + c.remaining, 0));
    const weekTotalClass = weekTotal > 0.005 ? 'gf-rest-ok' : (weekTotal >= -0.005 ? 'gf-rest-low' : 'gf-rest-over');
    const col = document.createElement('div');
    col.className = 'gf-week-col';
    col.innerHTML = weekCards.length
      ? `<div class="gf-week-head"><div class="gf-week-title">Woche ${i + 1}</div><div class="gf-week-total ${weekTotalClass}">${fmtEuro(weekTotal)}</div></div>`
      : `<div class="gf-week-head"><div class="gf-week-title">Woche ${i + 1}</div></div>`;
    weekCards.forEach(c => col.appendChild(renderGeldflussIncomeCard(c)));
    weekGrid.appendChild(col);
  }
  container.appendChild(weekGrid);

  const bars = incomeCards.filter(c => c.isBar);
  if (bars.length) {
    const barWrap = document.createElement('div');
    barWrap.className = 'gf-bar-wrap';
    bars.forEach(c => barWrap.appendChild(renderGeldflussIncomeBar(c)));
    container.appendChild(barWrap);
  }
}

// ── Rendering: untere Karten — Ausgaben/Sparziele/Schulden, ziehbar ─
function renderGeldflussConsumerCard(cons, colorClass){
  const remainder = consumerRemainder(cons);
  const el = document.createElement('div');
  el.className = 'gf-consumer-card' + (colorClass ? ' ' + colorClass : '');
  el.innerHTML = `
    <span class="gf-consumer-left">
      <span class="gf-drag-handle" aria-hidden="true">⠿</span>
      <span class="gf-consumer-name">${GELDFLUSS_ICON[cons.kind] || ''} ${cons.name}</span>
    </span>
    <span class="gf-consumer-amount">${fmtEuro(remainder)}${cons.kind === 'goal' && cons.isMonthly ? '/Monat' : ''}</span>`;
  makeGeldflussDraggable(el, cons, remainder, null, undefined, undefined, el.querySelector('.gf-drag-handle'));
  return el;
}

// EIN Wrapper pro Gruppe (Titel + Liste zusammen) — muss als einziges
// Grid-Element in .gf-consumer-grid landen. dotColor/cardColorClass sind
// ans Mockup angelehnt: jede Gruppe hat eine eigene Farbfamilie (Ausgaben
// rot, Sparziele blau, Schulden violett).
// addBtnLabel/addBtnTargetId hängen den "+ hinzufügen"-Button an, der zum
// bestehenden Anlegen-Button der jeweiligen Kategorie weiterleitet (kein
// neues Anlege-Formular, nur ein bequemer Zugang von hier aus).
function renderGeldflussGroup(container, title, dotColorVar, cardColorClass, consumers, addBtnLabel, addBtnTargetId, addBtnExpenseType){
  const wrap = document.createElement('div');
  wrap.className = 'gf-group';
  const openConsumers = consumers.filter(c => consumerRemainder(c) > 0.005);
  const head = document.createElement('div');
  head.className = 'gf-group-title';
  head.innerHTML = `<span class="gf-group-dot" style="background:${dotColorVar};"></span>${title} <span class="gf-group-count">${openConsumers.length}</span>`;
  wrap.appendChild(head);
  const list = document.createElement('div');
  list.className = 'gf-group-list';
  if (!openConsumers.length) {
    list.innerHTML = '<div class="empty-state" style="font-size:12px;padding:6px 0;">Alles zugeordnet ✓</div>';
  } else {
    openConsumers.forEach(c => list.appendChild(renderGeldflussConsumerCard(c, cardColorClass)));
  }
  wrap.appendChild(list);
  if (addBtnTargetId) {
    const addBtn = document.createElement('button');
    addBtn.className = 'gf-add-btn';
    addBtn.textContent = `+ ${addBtnLabel}`;
    addBtn.addEventListener('click', () => {
      document.getElementById(addBtnTargetId)?.click();
      if (addBtnExpenseType) document.getElementById('recurring-type-expense')?.click();
    });
    wrap.appendChild(addBtn);
  }
  container.appendChild(wrap);
}

// ── Drag & Drop — Pointer Events (funktioniert auf Touch UND Maus) ──
// sourceRecurringId: null = Karte kommt aus dem unteren Bereich (neue
// Zuordnung); gesetzt = Karte ist bereits zugeordnet und wird verschoben
// bzw. entfernt. sourceFundingEntryId identifiziert dabei GENAU DIESE
// eine Zuordnung (nicht "alle Zuordnungen zu dieser Einnahme").
//
// WICHTIGER FIX: Klicken und Ziehen liefen vorher über zwei GETRENNTE
// Mechanismen (ein eigener 'click'-Listener UND dieses Pointer-System)
// — beide konnten auf denselben Vorgang reagieren und sich gegenseitig
// ins Gehege kommen (Ursache der gemeldeten Bugs: Karte verschwindet
// beim Klick und taucht erst nach Neuladen wieder auf; Verschieben auf
// eine andere Einnahme griff nicht zuverlässig). Jetzt läuft ALLES über
// dieses eine System: Bewegung unterhalb der Schwelle GF_DRAG_THRESHOLD
// zählt als Klick, alles darüber als echtes Ziehen — und JEDER Pfad
// endet garantiert mit einem renderFinanzanalyse()-Aufruf, sobald sich
// die Daten geändert haben.
let gfDrag = null;
const GF_DRAG_THRESHOLD = 4; // Pixel Bewegung, ab der "ziehen" statt "klicken" gilt

// Touch: ein Drag darf NIE direkt aus einem Antippen oder vertikalen Wischen
// auf der Karte selbst entstehen (sonst reißt jeder Scroll-Versuch einen
// Drag los). Start deshalb nur über den kleinen Ziehpunkt (.gf-drag-handle,
// nur auf Touch-Geräten sichtbar, siehe CSS @media(pointer:coarse)) — der
// Rest der Karte bleibt zu 100% natives Scrollen, ohne jede JS-Einmischung.
//
// FRÜHERER ANSATZ (Long-Press auf der ganzen Karte) scheiterte in der
// Praxis: touch-action:pan-y + kein preventDefault während der Wartezeit
// erlaubten dem Browser, die Geste schon als natives Scrollen zu
// übernehmen, sobald sich der Finger bewegte — auch NACH Ablauf des
// Timers ließ sich das per preventDefault() im pointermove nicht mehr
// zurückholen (Browser committen früh, nicht rückgängig machbar). Der
// Browser schickte statt eines pointerup ein pointercancel, das nicht
// behandelt wurde — Ghost-Element und Drag-Status blieben dauerhaft
// hängen (auch tab-übergreifend, da an <body> angehängt). Ein dedizierter
// Ziehpunkt mit eigenem touch-action:none umgeht das Problem komplett:
// der Browser sieht dort von Anfang an keine Scroll-Geste. Maus/Pen sind
// unverändert — dort startet der Drag weiterhin sofort von der ganzen
// Karte aus, wie schon immer (Desktop bleibt gleich).
function beginGfDrag(el, cons, remainder, sourceRecurringId, sourceFundingEntryId, sourceCardUid, e){
  const rect = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.className = el.className + ' gf-drag-ghost';
  ghost.style.width = rect.width + 'px';
  document.body.appendChild(ghost);
  gfDrag = {
    cons, remainder, sourceRecurringId, sourceFundingEntryId, sourceCardUid, ghost,
    offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
    startX: e.clientX, startY: e.clientY, moved: false,
  };
  el.classList.add('gf-drag-source');
  moveGfGhost(e.clientX, e.clientY);
  document.addEventListener('pointermove', onGfPointerMove);
  document.addEventListener('pointerup', onGfPointerUp);
  // pointercancel: springt ein, wenn der Browser den Pointer aus welchem
  // Grund auch immer abbricht (z. B. System-Geste, Mehrfach-Touch) — ohne
  // diesen Handler bliebe der Ghost dauerhaft hängen (siehe Kommentar oben).
  document.addEventListener('pointercancel', onGfPointerUp);
}

function makeGeldflussDraggable(el, cons, remainder, sourceRecurringId, sourceFundingEntryId, sourceCardUid, dragHandle){
  el.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;

    if (e.pointerType === 'touch') {
      if (!dragHandle || (e.target !== dragHandle && !dragHandle.contains(e.target))) return;
      e.preventDefault();
      beginGfDrag(el, cons, remainder, sourceRecurringId, sourceFundingEntryId, sourceCardUid, e);
      return;
    }

    e.preventDefault();
    beginGfDrag(el, cons, remainder, sourceRecurringId, sourceFundingEntryId, sourceCardUid, e);
  });
}
function moveGfGhost(x, y){
  if (!gfDrag) return;
  if (!gfDrag.moved && Math.hypot(x - gfDrag.startX, y - gfDrag.startY) > GF_DRAG_THRESHOLD) gfDrag.moved = true;
  gfDrag.ghost.style.left = (x - gfDrag.offsetX) + 'px';
  gfDrag.ghost.style.top  = (y - gfDrag.offsetY) + 'px';
}
function onGfPointerMove(e){
  // Während eines aktiven Drags soll die Seite nicht gleichzeitig nativ
  // mitscrollen (nur relevant für Touch — Maus/Pen scrollen dadurch ohnehin
  // nicht). e.cancelable schützt gegen evtl. passive Listener-Situationen.
  if (e.cancelable) e.preventDefault();
  moveGfGhost(e.clientX, e.clientY);
  document.querySelectorAll('.gf-drop-hover').forEach(el => el.classList.remove('gf-drop-hover'));
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.gf-income-card, .gf-income-bar');
  if (under) under.classList.add('gf-drop-hover');
}
function onGfPointerUp(e){
  document.removeEventListener('pointermove', onGfPointerMove);
  document.removeEventListener('pointerup', onGfPointerUp);
  document.removeEventListener('pointercancel', onGfPointerUp);
  if (!gfDrag) return;
  const { cons, remainder, sourceRecurringId, sourceFundingEntryId, sourceCardUid, ghost, moved } = gfDrag;
  document.querySelectorAll('.gf-drop-hover').forEach(el => el.classList.remove('gf-drop-hover'));
  document.querySelectorAll('.gf-drag-source').forEach(el => el.classList.remove('gf-drag-source'));
  ghost.remove();
  const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.gf-income-card, .gf-income-bar');
  gfDrag = null;

  // Keine nennenswerte Bewegung -> als Klick werten. Bei einer bereits
  // zugeordneten Karte heißt das: Zuordnung entfernen (und danach
  // GARANTIERT neu rendern — kein Pfad, der Daten ändert, ohne zu
  // rendern). Bei einer noch unzugeordneten Karte unten passiert bei
  // einem bloßen Klick nichts.
  if (!moved) {
    if (sourceFundingEntryId) {
      geldflussUnassign(cons.kind, cons.id, sourceFundingEntryId);
      renderFinanzanalyse();
    }
    return;
  }

  // Kapazität IMMER von der konkret gezogenen Karte lesen — nicht vom
  // Monats-Aggregat der Einnahme. Reicht sie nicht, wird nur der
  // passende Teil verschoben; der Rest bleibt bewusst unzugeordnet
  // (kein automatisches Weiterverteilen). targetUid identifiziert dabei
  // die tatsächlich gezogene Karte eindeutig (dataset.uid) — die reine
  // recurringId reicht NICHT, da eine wiederkehrende Einnahme mehrere
  // Wochen-Karten mit derselben recurringId haben kann (siehe
  // buildGeldflussIncomeCards/distributeGeldfluss).
  const cardCapacity = dropTarget ? parseFloat(dropTarget.dataset.remaining) || 0 : 0;
  const targetUid = dropTarget?.dataset.uid || null;

  if (sourceRecurringId) {
    const targetRecurringId = dropTarget?.dataset.recurringId || null;
    // Nur bei EXAKT derselben Karte (gleiche uid) ist wirklich nichts zu
    // tun — dieselbe recurringId allein reicht nicht mehr als Kriterium,
    // sonst ließe sich eine Ausgabe nie zwischen zwei Wochen derselben
    // Einnahme verschieben (das war Teil des gemeldeten Bugs).
    if (targetUid && targetUid === sourceCardUid) { renderFinanzanalyse(); return; }
    geldflussUnassign(cons.kind, cons.id, sourceFundingEntryId); // entfernt GENAU diese eine Zuordnung
    if (targetRecurringId) {
      const obj = findConsumerObject(cons.kind, cons.id);
      if (obj) geldflussAssign({ kind: cons.kind, obj }, targetRecurringId, remainder, cardCapacity, targetUid);
    }
    renderFinanzanalyse();
    return;
  }

  if (!dropTarget) return;
  const recurringId = dropTarget.dataset.recurringId;
  if (!recurringId) return;
  const assigned = geldflussAssign(cons, recurringId, remainder, cardCapacity, targetUid);
  if (assigned) renderFinanzanalyse();
}

// ── Rendering ────────────────────────────────────────────────────────
function renderFinanzanalyse(){
  const body = document.getElementById('finanzanalyse-body');
  if (!body) return;
  body.innerHTML = '';

  const incomeCards = buildGeldflussIncomeCards();
  const consumers   = buildGeldflussConsumers();
  distributeGeldfluss(incomeCards, consumers);

  if (!incomeCards.length && !consumers.length) {
    body.innerHTML = '<div class="empty-state">Noch keine Einnahmen, Ausgaben, Sparziele oder Schulden angelegt.</div>';
    return;
  }

  if (!incomeCards.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.fontSize = '12px';
    empty.textContent = 'Noch keine Einnahmen angelegt.';
    body.appendChild(empty);
  } else {
    renderGeldflussIncomeArea(body, incomeCards);
  }

  // Drei Spalten nebeneinander: Ausgaben / Sparziele / Schulden zeigen
  // jeweils, was in diesem Typ noch (ganz oder teilweise) offen ist. Jeder
  // Verbraucher taucht in GENAU einer Spalte auf — keine separate "Nicht
  // zugeordnet"-Gruppe mehr: die gab es früher zusätzlich zu den drei
  // Typ-Spalten, wodurch ein noch nicht zugeordneter Posten gleichzeitig
  // dort UND in seiner Typ-Spalte auftauchte (gemeldeter Dopplungs-Bug).
  // Vollständig finanzierte Posten fallen schon über consumerRemainder()
  // in renderGeldflussGroup() aus der Liste (siehe dort).
  const consumerGrid = document.createElement('div');
  consumerGrid.className = 'gf-consumer-grid';
  renderGeldflussGroup(consumerGrid, 'Ausgaben', 'var(--b-red)', 'gf-consumer-red',
    consumers.filter(c => c.kind === 'expense'), 'Ausgabe hinzufügen', 'add-onetime-btn', false);
  renderGeldflussGroup(consumerGrid, 'Sparziele', 'var(--b-blue)', 'gf-consumer-blue',
    consumers.filter(c => c.kind === 'goal'), 'Sparziel hinzufügen', 'add-goal-btn', false);
  renderGeldflussGroup(consumerGrid, 'Schulden', 'var(--b-purple)', 'gf-consumer-purple',
    consumers.filter(c => c.kind === 'debt'), 'Schuld hinzufügen', 'debt-add-btn', false);
  body.appendChild(consumerGrid);
}
