// =========================
// BUDGET — ABO-HINWEISE
// Lädt nach budget-import.js (nutzt BudgetImport.cleanName) und budget.js
// (budgetRecurring, recurringActiveInMonth, fmtEuro, escHtml, DB).
//
// Ruhige Hinweise statt Warnungen (AI documentation/budget.md):
// - Doppelte Abos: zwei Dienste derselben Art (zwei Musik-Abos) oder derselbe
//   Posten zweimal — als Hinweis über den wiederkehrenden Posten, mit „Passt so“.
// - Kündigen-Link im Posten-Dialog, wenn der Dienst bekannt ist.
// - Preiserhöhungen erkennt der Kontoauszug-Import (budget-import.js) aus den
//   Abbuchungen; dort lässt sich der Betrag des vorhandenen Postens anpassen.
//
// Idee und Teile der Dienste-Tabelle nach broke (github.com/nextwork-projects/broke,
// src/lib/subscriptions.ts), MIT-Lizenz, Copyright (c) 2026 NextWork. Für Deutschland
// angepasst. Kündigen-Links nur, wenn geprüft (am 15.11.2026 erreichbar) — nie raten:
// cancel: null heißt „keine sichere Seite bekannt“.
// =========================

const BudgetAbos = (() => {
  const clean = typeof BudgetImport !== 'undefined' ? BudgetImport.cleanName
    : (typeof require === 'function' ? require('./budget-import.js').cleanName : s => String(s).toLowerCase());

  const APPLE = 'https://apps.apple.com/account/subscriptions';
  const GOOGLE_PLAY = 'https://play.google.com/store/account/subscriptions';
  const MICROSOFT = 'https://account.microsoft.com/services';
  // Reihenfolge zählt: das erste Muster gewinnt (Apple Music vor Apple, YouTube Music vor YouTube).
  const SERVICES = [
    { name: 'Spotify',         match: /spotify/,                          group: 'music', cancel: 'https://www.spotify.com/de/account/subscription/' },
    { name: 'Apple Music',     match: /apple music/,                      group: 'music', cancel: APPLE },
    { name: 'YouTube Music',   match: /youtube music/,                    group: 'music', cancel: 'https://www.youtube.com/paid_memberships' },
    { name: 'Amazon Music',    match: /amazon music|music unlimited/,     group: 'music', cancel: null },
    { name: 'Deezer',          match: /deezer/,                           group: 'music', cancel: 'https://www.deezer.com/account/subscription' },
    { name: 'Tidal',           match: /tidal/,                            group: 'music', cancel: null },
    { name: 'Netflix',         match: /netflix/,                          group: 'video', cancel: 'https://www.netflix.com/cancelplan' },
    { name: 'Disney+',         match: /disney/,                           group: 'video', cancel: 'https://www.disneyplus.com/account/subscription' },
    { name: 'Amazon Prime',    match: /prime video|amazon prime|^prime\b/, group: 'video', cancel: 'https://www.amazon.de/mc' },
    { name: 'Apple TV+',       match: /apple tv/,                         group: 'video', cancel: APPLE },
    { name: 'DAZN',            match: /dazn/,                             group: 'video', cancel: 'https://www.dazn.com/de-DE/myaccount' },
    { name: 'Sky / WOW',       match: /\bsky\b|wow tv|\bwow\b/,           group: 'video', cancel: null },
    { name: 'RTL+',            match: /rtl ?\+|rtl plus|tvnow/,           group: 'video', cancel: null },
    { name: 'Joyn',            match: /joyn/,                             group: 'video', cancel: null },
    { name: 'Paramount+',      match: /paramount/,                        group: 'video', cancel: null },
    { name: 'Crunchyroll',     match: /crunchyroll/,                      group: 'video', cancel: 'https://www.crunchyroll.com/account/membership' },
    { name: 'MagentaTV',       match: /magenta ?tv/,                      group: 'video', cancel: null },
    { name: 'iCloud',          match: /icloud/,                           group: 'cloud', cancel: APPLE },
    { name: 'Google One',      match: /google one|google storage/,        group: 'cloud', cancel: GOOGLE_PLAY },
    { name: 'Dropbox',         match: /dropbox/,                          group: 'cloud', cancel: 'https://www.dropbox.com/account/plan' },
    { name: 'Microsoft 365',   match: /microsoft 365|office 365|onedrive/, group: 'cloud', cancel: MICROSOFT },
    { name: 'Audible',         match: /audible/,                          group: 'books', cancel: null },
    { name: 'Kindle Unlimited', match: /kindle unlimited/,                group: 'books', cancel: null },
    { name: 'BookBeat',        match: /bookbeat/,                         group: 'books', cancel: null },
    { name: 'Xbox Game Pass',  match: /game ?pass|xbox/,                  group: 'games', cancel: MICROSOFT },
    { name: 'PlayStation Plus', match: /playstation|ps plus|psn/,         group: 'games', cancel: null },
    { name: 'Nintendo Switch Online', match: /nintendo/,                  group: 'games', cancel: null },
    { name: 'YouTube Premium', match: /youtube premium|youtube/,                          cancel: 'https://www.youtube.com/paid_memberships' },
    { name: 'Adobe',           match: /adobe/,                                            cancel: 'https://account.adobe.com/plans' },
  ];
  const GROUP_LABEL = { music: 'Musik-Abos', video: 'Streaming-Abos', cloud: 'Cloud-Speicher', books: 'Hörbuch- und Lese-Abos', games: 'Gaming-Abos' };
  const NUM = ['', 'Ein', 'Zwei', 'Drei', 'Vier', 'Fünf'];

  const service = name => {
    const n = clean(name);
    return n ? SERVICES.find(s => s.match.test(n)) || null : null;
  };
  const cancelUrl = name => service(name)?.cancel ?? null;

  // Monatlicher Gegenwert eines Postens (jährlich /12, wöchentlich ×52/12 …).
  const PER_MONTH = { daily: 365 / 12, weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, yearly: 1 / 12 };
  // Im Browser dieselbe Umrechnung wie Übersicht und Prognose (budget.js), damit die Summen gleich sind.
  const perMonth = e => (typeof recurringMonthlyEquivalent === 'function')
    ? recurringMonthlyEquivalent(e)
    : (Number(e.amount) || 0) * (PER_MONTH[e.freq] ?? 1);

  // Doppelte Abos unter den Ausgaben: gleiche Art (zwei Musik-Abos) oder gleicher Name zweimal.
  // → [{ id, kind:'group'|'same', label, entries, monthly }]. id ändert sich, sobald sich die Posten ändern —
  // ein mit „Passt so“ ausgeblendeter Hinweis kommt so zurück, wenn ein weiteres Abo dazukommt.
  function duplicates(entries) {
    const groups = new Map();
    for (const e of entries) {
      if (e.type !== 'expense') continue;
      const s = service(e.name);
      const n = clean(e.name);
      if (!n) continue;
      const key = s?.group ? `group:${s.group}` : `same:${n}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const out = [];
    for (const [key, list] of groups) {
      if (list.length < 2) continue;
      const kind = key.startsWith('group:') ? 'group' : 'same';
      const label = kind === 'group' ? GROUP_LABEL[key.slice(6)] : list[0].name;
      out.push({
        id: `${key}|${list.map(e => e.id).sort().join(',')}`,
        kind, label, entries: list,
        monthly: Math.round(list.reduce((t, e) => t + perMonth(e), 0) * 100) / 100,
      });
    }
    return out;
  }

  // Hinweis-Text, ohne HTML: „Zwei Musik-Abos: Spotify und Apple Music, zusammen 21,98 € im Monat.“
  function hintText(d, euro) {
    const names = d.entries.map(e => e.name);
    const list = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
    const n = NUM[d.entries.length] || String(d.entries.length);
    return d.kind === 'group'
      ? `${n} ${d.label}: ${list}, zusammen ${euro(d.monthly)} im Monat.`
      : `„${d.label}“ steht ${d.entries.length === 2 ? 'zweimal' : `${d.entries.length}-mal`} in deinen Posten, zusammen ${euro(d.monthly)} im Monat.`;
  }

  return { SERVICES, service, cancelUrl, perMonth, duplicates, hintText };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BudgetAbos;

// =========================
// ANZEIGE (nur im Browser)
// =========================
if (typeof document !== 'undefined') {
  let budgetAboHintsOff = DB.get('budgetAboHintsOff', []);
  const saveAboHintsOff = () => DB.set('budgetAboHintsOff', budgetAboHintsOff);

  // Von renderBudget (budget.js) aufgerufen, nachdem die Liste der wiederkehrenden Posten steht.
  // activeEntries: die im angezeigten Monat geltenden Posten.
  window.renderAboHints = function (listEl, activeEntries) {
    if (!listEl) return;
    const dups = BudgetAbos.duplicates(activeEntries).filter(d => !budgetAboHintsOff.includes(d.id));
    if (!dups.length) return;
    const box = document.createElement('div');
    box.className = 'b-abo-hints';
    box.innerHTML = dups.map(d => {
      const links = d.entries
        .map(e => ({ e, url: BudgetAbos.cancelUrl(e.name) }))
        .filter((x, i, a) => x.url && a.findIndex(y => y.url === x.url) === i)
        .map(x => `<a href="${escHtml(x.url)}" target="_blank" rel="noopener">${escHtml(x.e.name)} kündigen ↗</a>`)
        .join('');
      return `
        <div class="b-abo-hint" data-id="${escHtml(d.id)}">
          <span class="b-abo-hint-icon">💡</span>
          <div class="b-abo-hint-body">
            <div>${escHtml(BudgetAbos.hintText(d, fmtEuro))}</div>
            ${links ? `<div class="b-abo-hint-links">${links}</div>` : ''}
          </div>
          <button type="button" class="b-abo-hint-ok" title="Diesen Hinweis ausblenden">Passt so</button>
        </div>`;
    }).join('');
    box.querySelectorAll('.b-abo-hint-ok').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.closest('.b-abo-hint').dataset.id;
      // Alte Einträge derselben Gruppe ersetzen, damit die Liste nicht wächst.
      const prefix = id.split('|')[0] + '|';
      budgetAboHintsOff = budgetAboHintsOff.filter(x => !x.startsWith(prefix)).concat(id);
      saveAboHintsOff();
      btn.closest('.b-abo-hint').remove();
      if (!box.querySelector('.b-abo-hint')) box.remove();
    }));
    listEl.prepend(box);
  };

  // Kündigen-Link im Posten-Dialog (budget.js: openRecurringModal ruft das beim Öffnen auf).
  window.updateAboCancelLink = function () {
    const nameEl = document.getElementById('recurring-name');
    if (!nameEl) return;
    let link = document.getElementById('recurring-cancel-link');
    if (!link) {
      link = document.createElement('a');
      link.id = 'recurring-cancel-link';
      link.className = 'b-abo-cancel-link';
      link.target = '_blank';
      link.rel = 'noopener';
      nameEl.insertAdjacentElement('afterend', link);
      nameEl.addEventListener('input', window.updateAboCancelLink);
    }
    const isExpense = typeof recurringType === 'undefined' || recurringType === 'expense';
    const s = BudgetAbos.service(nameEl.value);
    if (isExpense && s && s.cancel) {
      link.href = s.cancel;
      link.textContent = `Bei ${s.name} kündigen ↗`;
      link.hidden = false;
    } else {
      link.hidden = true;
      link.removeAttribute('href');
    }
  };
}
