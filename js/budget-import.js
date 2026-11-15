// =========================
// BUDGET — KONTOAUSZUG-IMPORT (wiederkehrende Posten finden)
// Lädt nach budget-sparplaene.js (braucht budgetRecurring, saveBudgetRecurring,
// renderBudget, round2, fmtEuro aus budget.js; incomeIcon aus budget-financing.js).
//
// Ein CSV/OFX/QIF-Auszug aus dem Online-Banking wird im Browser gelesen, daraus
// werden Zahlungen mit festem Rhythmus erkannt (Miete, Gehalt, Abos …) und als
// wiederkehrende Posten VORGESCHLAGEN. Übernommen wird nur, was angehakt ist.
// Die einzelnen Buchungen werden NICHT gespeichert — Budget bleibt ein Planer,
// keine Buchhaltung (AI documentation/budget.md). Kein neuer localStorage-Key.
//
// Die Erkennung (Datum/Betrag lesen, Spalten raten, Rhythmus finden) folgt
// broke (github.com/nextwork-projects/broke, src/lib/statement.ts und
// recurring-find.ts), MIT-Lizenz, Copyright (c) 2026 NextWork. Angepasst für
// deutsche Bank-Exporte (Sparkasse, ING, DKB, Volksbank, N26, comdirect …):
// deutsche Spaltennamen, Vorspann-Zeilen, Dezimalkomma, Umlaute, PayPal & Co.
//
// Der reine Teil (BudgetImport) hat kein DOM und wird von
// tests/budget-import.test.js mit node geprüft.
// =========================

const BudgetImport = (() => {
  const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTHS_DE = ['jan', 'feb', 'mär', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez'];
  const pad = n => String(n).padStart(2, '0');
  const monthIndex = s => {
    const k = s.toLowerCase().slice(0, 3).replace('mae', 'mär');
    const i = MONTHS_EN.indexOf(k);
    return i >= 0 ? i + 1 : MONTHS_DE.indexOf(k) + 1;
  };

  // "01.10.2026", "1.10.26", "2026-10-01", "01/10/2026", "1 Okt 2026", "20261001", "2026-10-01 09:30".
  // order: 'dmy' | 'mdy' | 'ymd' — nur für reine Zahlen-Daten mit Tag und Monat ≤ 12 von Belang.
  function parseDate(raw, order = 'dmy') {
    const s = String(raw ?? '').trim().replace(/'/g, '/').replace(/[T\s]\d{1,2}:\d{2}.*$/, '');
    let y, m, d, p;
    if ((p = s.match(/^(\d{4})(\d{2})(\d{2})/))) [y, m, d] = [+p[1], +p[2], +p[3]];
    else if ((p = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) [y, m, d] = [+p[1], +p[2], +p[3]];
    else if ((p = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
      [d, m] = order === 'mdy' ? [+p[2], +p[1]] : [+p[1], +p[2]];
      y = +p[3];
    } else if ((p = s.match(/^(\d{1,2})\.?[-\s/]([a-zä]{3})[a-zä]*\.?[-\s/,]+(\d{2}|\d{4})$/i))) [d, m, y] = [+p[1], monthIndex(p[2]), +p[3]];
    else if ((p = s.match(/^([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/i))) [m, d, y] = [monthIndex(p[1]), +p[2], +p[3]];
    else return null;
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    return new Date(iso + 'T00:00:00Z').getUTCDate() === d ? iso : null; // lehnt den 31.02. ab
  }

  // Tag vor Monat oder umgekehrt: Ein Wert über 12 entscheidet, sonst gilt die deutsche Reihenfolge.
  function dateOrder(values) {
    if (values.some(v => /^\s*\d{4}[-/.]?\d{2}/.test(v))) return 'ymd';
    let dmy = false, mdy = false;
    for (const v of values) {
      const p = String(v).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
      if (!p) continue;
      if (+p[1] > 12) dmy = true;
      if (+p[2] > 12) mdy = true;
    }
    return mdy && !dmy ? 'mdy' : 'dmy';
  }

  // "-1.234,56", "1.234,56 €", "-12,99", "(12.50)", "12,50 S" (Soll), "1234.56". Deutsch zuerst:
  // ein einzelnes Trennzeichen mit genau drei Ziffern dahinter ist ein Tausenderpunkt nur bei ".".
  function parseAmount(raw) {
    let s = String(raw ?? '').trim();
    if (!s || s === '-') return null;
    let neg = /^\(.*\)$/.test(s) || /-/.test(s.replace(/\d[-]\d/g, '')) || /\b(DR|S)\.?$/i.test(s);
    s = s.replace(/[^\d.,]/g, '');
    if (!/\d/.test(s)) return null;
    const last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
    const sep = s[last];
    const isDecimal = last >= 0 && (
      (s.includes('.') && s.includes(','))
      || (s.split(sep).length === 2 && (s.length - last - 1 !== 3 || sep === ','))
    );
    const n = isDecimal ? Number(s.slice(0, last).replace(/[.,]/g, '') + '.' + s.slice(last + 1)) : Number(s.replace(/[.,]/g, ''));
    if (!Number.isFinite(n)) return null;
    if (n === 0) neg = false;
    return neg ? -n : n;
  }

  // RFC-4180-artig: Felder in Anführungszeichen, "" als Escape, Zeilenumbrüche in Anführungszeichen.
  function splitRows(text, delim) {
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += c; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) rows.push([...row, cell]);
    return rows.map(r => r.map(x => x.trim())).filter(r => r.some(Boolean));
  }

  const looksDate = v => parseDate(v, 'dmy') !== null || parseDate(v, 'mdy') !== null;

  // Trennzeichen: das mit den meisten Zeilen gleicher Feldanzahl. Kopfzeile: die Zeile direkt über der
  // ersten Zeile mit einem Datum, sofern sie selbst keins enthält — überspringt Vorspann-Zeilen
  // (ING/DKB: Kontonummer, Zeitraum, Saldo …).
  function readTable(text) {
    const clean = String(text).replace(/^﻿/, '');
    let best = [], bestScore = -1;
    for (const d of [';', ',', '\t', '|']) {
      const rows = splitRows(clean, d);
      const counts = new Map();
      for (const r of rows) if (r.length > 2) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
      const score = Math.max(0, ...counts.values());
      if (score > bestScore) { bestScore = score; best = rows; }
    }
    const width = (() => {
      const counts = new Map();
      for (const r of best) if (r.length > 2) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
      return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    })();
    const first = best.findIndex(r => r.length >= width - 1 && r.length > 1 && r.some(looksDate));
    if (first < 0) return { header: [], rows: [] };
    const h = best[first - 1];
    const hasHeader = !!h && h.length >= width - 1 && !h.some(looksDate);
    const header = Array.from({ length: width }, (_, i) => (hasHeader && h[i]) || `Spalte ${i + 1}`);
    return { header, rows: best.slice(first).filter(r => r.length >= Math.min(width, 2)) };
  }

  const findCol = (header, tests, skip = /$^/) => {
    for (const t of tests) {
      const i = header.findIndex(h => t.test(h) && !skip.test(h));
      if (i >= 0) return i;
    }
    return -1;
  };

  // Spalten raten. name2: zweite Namensspalte für Geld, das REINkommt (DKB trennt
  // „Zahlungspflichtige*r“ und „Zahlungsempfänger*in“). purpose: Verwendungszweck.
  function guessMapping(t) {
    const h = t.header.map(x => x.toLowerCase().trim());
    const col = i => t.rows.slice(0, 50).map(r => r[i] ?? '');
    let date = findCol(h, [/^buchungstag$/, /^buchungsdatum$/, /^buchung$/, /^datum$/, /booking date/, /^(transaction |posted )?date$/, /buchung|datum|date/], /valuta|wertstellung|value|erstellt|created/);
    if (date < 0) date = h.findIndex((_, i) => col(i).filter(looksDate).length > col(i).length / 2);
    let name = -1, name2 = -1;
    const payee = findCol(h, [/zahlungsempf/]);
    const payer = findCol(h, [/zahlungspflichtig/]);
    if (payee >= 0 && payer >= 0) { name = payee; name2 = payer; }
    else name = findCol(h, [/beg(ü|ue)nstigter/, /auftraggeber/, /empf(ä|ae)nger/, /zahlungsbeteiligt/, /partner name/, /^name$/, /payee/, /counter ?party/, /merchant/, /^beschreibung$/, /description/, /^buchungstext$/]);
    const purpose = findCol(h, [/verwendungszweck/, /^purpose$/, /payment reference/, /^memo$/, /^reference$/]);
    if (name < 0) name = h.findIndex((_, i) => i !== date && i !== purpose && col(i).some(v => /[a-zäöü]{3}/i.test(v) && parseAmount(v) === null));
    const amount = findCol(h, [/^betrag\b/, /^umsatz/, /^amount\b/, /betrag|amount/], /saldo|balance|w(ä|ae)hrung|currency|fremd|foreign|soll|haben|credit|debit/);
    const debit = amount >= 0 ? -1 : findCol(h, [/^soll/, /ausgang/, /debit/, /withdrawal/, /money out/]);
    const credit = amount >= 0 ? -1 : findCol(h, [/^haben/, /eingang/, /credit/, /deposit/, /money in/]);
    return { date, name, name2, purpose, amount, debit, credit, order: dateOrder(date >= 0 ? col(date) : []) };
  }

  const isComplete = m => m.date >= 0 && m.name >= 0 && (m.amount >= 0 || m.debit >= 0 || m.credit >= 0);

  // Zeilen → { date, amount (> 0 = Geld raus), name, purpose }. Die meisten Banken exportieren
  // Ausgaben negativ; hier werden sie positiv (wie in broke).
  function applyMapping(t, m) {
    const rows = [];
    let skipped = 0;
    for (const r of t.rows) {
      const date = m.date >= 0 ? parseDate(r[m.date] ?? '', m.order) : null;
      let amount = null;
      if (m.amount >= 0) {
        const a = parseAmount(r[m.amount] ?? '');
        if (a !== null) amount = -a;
      } else {
        const dr = m.debit >= 0 ? parseAmount(r[m.debit] ?? '') : null;
        const cr = m.credit >= 0 ? parseAmount(r[m.credit] ?? '') : null;
        if (dr !== null || cr !== null) amount = Math.abs(dr ?? 0) - Math.abs(cr ?? 0);
      }
      const pick = i => (i >= 0 ? r[i] ?? '' : '').replace(/\s+/g, ' ').trim();
      let name = pick(m.name);
      if (m.name2 >= 0 && amount !== null && amount < 0) name = pick(m.name2) || name;
      // comdirect: alles in einer Spalte („Auftraggeber: X Buchungstext: …“).
      const inner = name.match(/(?:Auftraggeber|Empf(?:ä|ae)nger|Zahlungspflichtiger):\s*(.+?)\s+(?:Buchungstext|Kto\/IBAN|IBAN|Ref\.|Verwendungszweck)\s*:/i);
      if (inner) name = inner[1];
      if (!date || amount === null || !amount) { skipped++; continue; }
      rows.push({ date, amount: Math.round(amount * 100) / 100, name: name || 'Unbekannt', purpose: pick(m.purpose) });
    }
    return { rows, skipped };
  }

  // OFX 1.x/2.x: TRNAMT negativ = Ausgabe.
  function parseOfx(text) {
    const tag = (block, t) => block.match(new RegExp(`<${t}>([^<\\r\\n]*)`, 'i'))?.[1].trim() ?? '';
    const rows = [];
    for (const b of text.split(/<STMTTRN>/i).slice(1)) {
      const date = parseDate(tag(b, 'DTPOSTED'), 'ymd');
      const amt = parseAmount(tag(b, 'TRNAMT'));
      if (!date || !amt) continue;
      rows.push({ date, amount: -amt, name: (tag(b, 'NAME') || tag(b, 'MEMO') || 'Unbekannt').replace(/&amp;/g, '&'), purpose: tag(b, 'MEMO') });
    }
    return rows;
  }

  // QIF: ein Feld pro Zeile (D Datum, T Betrag, P Empfänger, M Notiz), "^" beendet einen Eintrag.
  function parseQif(text) {
    const recs = text.split(/^\^\s*$/m);
    const dates = [...text.matchAll(/^D(.+)$/gm)].map(x => x[1].replace(/'/g, '/'));
    const order = dateOrder(dates);
    const rows = [];
    for (const rec of recs) {
      const f = {};
      for (const line of rec.split(/\r?\n/)) if (/^[A-Z]/.test(line) && !line.startsWith('!')) f[line[0]] ??= line.slice(1).trim();
      const date = f.D ? parseDate(f.D, order) : null;
      const amt = f.T ? parseAmount(f.T) : null;
      if (date && amt) rows.push({ date, amount: -amt, name: f.P || f.M || 'Unbekannt', purpose: f.M || '' });
    }
    return rows;
  }

  // CSV: { kind:'csv', table, mapping } — die Zeilen entstehen erst mit applyMapping, damit die
  // Spalten im Dialog korrigiert werden können. OFX/QIF: { kind, rows } direkt.
  function parseStatement(text, filename = '') {
    if (/<OFX>|OFXHEADER/i.test(text) || /\.(ofx|qfx)$/i.test(filename)) return { kind: 'ofx', rows: parseOfx(text) };
    if (/^\s*!Type:/i.test(text) || /\.qif$/i.test(filename)) return { kind: 'qif', rows: parseQif(text) };
    const table = readTable(text);
    return { kind: 'csv', table, mapping: guessMapping(table) };
  }

  // Sparkasse & Co. exportieren oft in Windows-1252 statt UTF-8.
  function decodeBytes(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { return new TextDecoder('windows-1252').decode(buf); }
  }

  // ---------- Rhythmus finden ----------

  const EVERY = [
    { freq: 'weekly',    days: 7,    slack: 2 },
    { freq: 'biweekly',  days: 14,   slack: 3 },
    { freq: 'monthly',   days: 30.4, slack: 4 },
    { freq: 'quarterly', days: 91,   slack: 10 },
    { freq: 'yearly',    days: 365,  slack: 15 },
  ];
  // Zahlungsdienste, hinter denen viele verschiedene Händler stecken: dort entscheidet der
  // Verwendungszweck, sonst würden Spotify und ein Online-Einkauf ein einziger „Posten“.
  const VIA = /paypal|klarna|sofort|amazon payments|google payment|apple\.com\/bill|apple services|mollie|stripe|adyen|unzer/i;
  // Eigene Umbuchungen und Bargeld sind keine Posten.
  const SKIP = /umbuchung|übertrag|uebertrag|eigenes konto|eigene überweisung|bargeld|geldautomat|auszahlung ga\b|^ga\s|abschluss|rechnungsabschluss|tagesgeld/i;

  const mid = ns => { const s = [...ns].sort((a, b) => a - b); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
  const dayNum = d => Date.parse(`${d}T00:00:00Z`) / 864e5;

  /** "SPOTIFY AB 1234567" und "Spotify AB" werden derselbe Händler. Umlaute bleiben erhalten. */
  const cleanName = s => String(s).toLowerCase()
    .replace(/[#*]\s*\w*\d\w*/g, ' ').replace(/\b\w*\d\w*\b/g, ' ')
    .replace(/[^a-zäöüß&' ]+/g, ' ').replace(/\b(gmbh|ag|se|kg|ohg|ug|e ?v|ltd|inc|sarl|s a r l|et cie|s c a|bv|ab|co)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // Anzeigename: bei Zahlungsdiensten der Händler aus dem Verwendungszweck („Ihr Einkauf bei Spotify AB“).
  function displayName(row) {
    const via = VIA.test(row.name);
    if (via && row.purpose) {
      const m = row.purpose.match(/(?:ihr einkauf bei|einkauf bei|zahlung an|payment to)\s+([^,.;/]+)/i);
      if (m) return tidy(m[1]);
    }
    return tidy(row.name);
  }
  function tidy(s) {
    let t = String(s).replace(/\b\w*\d{4,}\w*\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (t === t.toUpperCase() && /[A-ZÄÖÜ]{3}/.test(t)) {
      t = t.toLowerCase().replace(/(^|[\s\-/&.])([a-zäöü])/g, (_, a, b) => a + b.toUpperCase())
        .replace(/\b[A-Za-zÄÖÜäöü]{1,2}\b/g, w => w.toUpperCase()); // AB, SE, DB bleiben groß
    }
    return t.slice(0, 60) || 'Unbekannt';
  }
  function groupKey(row) {
    const base = cleanName(row.name);
    if (VIA.test(row.name) && row.purpose) {
      const m = row.purpose.match(/(?:ihr einkauf bei|einkauf bei|zahlung an|payment to)\s+([^,.;/]+)/i);
      return `${base}|${cleanName(m ? m[1] : row.purpose).split(' ').slice(0, 4).join(' ')}`;
    }
    return base;
  }

  // Preiserhöhung (nach broke, subscriptions.ts): mindestens zwei Abbuchungen zum gleichen alten Preis
  // (±2 %), danach alle zum neuen, der 2 % und mindestens 0,50 € höher ist. Strom & Co., die ohnehin
  // schwanken, fallen dadurch nicht darunter. → { from, to, date } (date = erste Abbuchung zum neuen Preis)
  function priceHike(sorted) {
    const a = sorted.map(r => Math.abs(r.amount));
    if (a.length < 3) return null;
    const to = a[a.length - 1];
    let k = a.length - 1;
    while (k > 0 && Math.abs(a[k - 1] - to) <= to * 0.02) k--;
    const before = a.slice(0, k);
    if (before.length < 2) return null;
    const from = before[before.length - 1];
    if (before.slice(-3).some(x => Math.abs(x - from) > from * 0.02)) return null;
    if (!(to > from * 1.02 && to - from >= 0.5)) return null;
    return { from: Math.round(from * 100) / 100, to: Math.round(to * 100) / 100, date: sorted[k].date };
  }

  // Wiederkehrendes aus Buchungen. amount > 0 = Geld raus.
  // Eine Rechnung darf schwanken (Strom, Handy ±40 %). Wöchentliches muss fast gleich bleiben (±3 %):
  // deutsche Auszüge haben keine Kategorien, und der Wocheneinkauf beim selben Supermarkt ist kein Abo.
  function findRecurring(rows, today) {
    const groups = new Map();
    for (const r of rows) {
      if (!r.amount || SKIP.test(r.name) || SKIP.test(r.purpose || '')) continue;
      const k = groupKey(r);
      if (!k.replace(/\|/g, '').trim()) continue;
      const key = `${r.amount < 0 ? 'in' : 'out'}:${k}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const out = [];
    for (const [key, rs] of groups) {
      const sorted = [...rs].sort((a, b) => a.date.localeCompare(b.date));
      const dates = [...new Set(sorted.map(r => r.date))];
      if (dates.length < 2) continue;
      const gaps = dates.slice(1).map((d, i) => dayNum(d) - dayNum(dates[i]));
      const every = EVERY.find(e => Math.abs(mid(gaps) - e.days) <= e.slack);
      if (!every) continue;
      if (dates.length < (every.freq === 'yearly' ? 2 : 3)) continue;
      if (gaps.filter(g => Math.abs(g - every.days) <= every.slack).length < Math.ceil(gaps.length * 0.7)) continue;
      const amounts = sorted.map(r => Math.abs(r.amount));
      const typical = mid(amounts);
      const near = pct => amounts.filter(a => Math.abs(a - typical) <= typical * pct).length >= Math.ceil(amounts.length * 0.8);
      const isIncome = sorted[sorted.length - 1].amount < 0;
      const hike = isIncome ? null : priceHike(sorted);
      const strict = !isIncome && (every.freq === 'weekly' || every.freq === 'biweekly');
      if (!hike && !near(strict ? 0.03 : 0.4)) continue;
      const last = sorted[sorted.length - 1];
      const ended = dayNum(today) - dayNum(last.date) > every.days * 2 + every.slack;
      const min = Math.min(...amounts), max = Math.max(...amounts);
      out.push({
        key,
        name: displayName(last),
        freq: every.freq,
        // Nach einer Preiserhöhung zählt der neue Preis, nicht der Durchschnitt aus alt und neu.
        average: hike ? hike.to : Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length * 100) / 100,
        min, max,
        varies: !hike && max - min > Math.max(1, typical * 0.05),
        hike,
        count: dates.length,
        firstDate: dates[0],
        lastDate: last.date,
        isIncome,
        ended,
      });
    }
    return out.sort((a, b) => (a.isIncome === b.isIncome ? b.average - a.average : a.isIncome ? -1 : 1));
  }

  // ---------- Vorschlag → Nook-Posten ----------

  const MUST = /miete|wohnung|hausverwaltung|nebenkosten|strom|stadtwerke|energie|\bgas\b|wasser|versicherung|allianz|\bhuk\b|\bergo\b|\baxa\b|debeka|krankenkasse|\baok\b|\btk\b|techniker|barmer|rundfunk|ard zdf|beitragsservice|kredit|darlehen|\brate\b|finanzamt|\bkfz\b|steuer/i;
  const WANT = /netflix|spotify|disney|prime|dazn|sky|apple music|youtube|twitch|playstation|xbox|nintendo|steam|audible|kindle|deezer|crunchyroll|patreon|onlyfans|lieferando|tinder/i;
  const guessPriority = name => (MUST.test(name) ? 'must' : WANT.test(name) ? 'want' : 'need');

  // Liegt schon ein ähnlicher Posten in budgetRecurring? (gleiche Richtung, Name überschneidet sich)
  function findExisting(found, existing) {
    const n = cleanName(found.name);
    if (!n) return null;
    return (existing || []).find(r => {
      if ((r.type === 'income') !== found.isIncome) return false;
      const e = cleanName(r.name || '');
      return e && (e === n || e.includes(n) || n.includes(e));
    }) || null;
  }

  // Vorhandener fester Posten, dessen Betrag nicht mehr zur Bank passt (z.B. nach einer Preiserhöhung)?
  // → { from, to } zum Anpassen, sonst null. Variable Posten und schwankende Beträge bleiben unberührt.
  function amountChange(found, existing) {
    if (!existing || existing.certainty === 'variable' || found.varies || existing.freq !== found.freq) return null;
    const from = Number(existing.amount) || 0, to = found.average;
    return Math.abs(from - to) >= 0.5 ? { from, to } : null;
  }

  // Ein gefundener Rhythmus als budgetRecurring-Eintrag (Felder wie im Posten-Dialog in budget.js).
  // Vierteljährliches kennt Nook nicht → null.
  function toBudgetEntry(found, { name, priority, startMonth, id, icon } = {}) {
    const [y, m, d] = found.lastDate.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const type = found.isIncome ? 'income' : 'expense';
    const e = {
      id: id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
      name: (name || found.name).trim(),
      amount: Math.round(found.average * 100) / 100,
      type,
      freq: found.freq,
      priority: type === 'expense' ? (priority || guessPriority(found.name)) : 'none',
      certainty: 'fixed',
      includeInSparplan: true,
    };
    if (found.freq === 'monthly') e.day = d;
    else if (found.freq === 'weekly') e.weekday = weekday;
    else if (found.freq === 'biweekly') { e.weekday = weekday; e.anchorDate = found.lastDate; }
    else if (found.freq === 'yearly') { e.dateDay = d; e.dateMonth = m; }
    else return null;
    // Schwankende Monatsposten (Strom, Handy) als „variabel“ mit Spanne — wie im Posten-Dialog:
    // amount ist dann immer der Mittelwert aus Min/Max.
    if (found.freq === 'monthly' && found.varies) {
      e.certainty = 'variable';
      e.varMin = Math.round(found.min * 100) / 100;
      e.varMax = Math.round(found.max * 100) / 100;
      e.amount = Math.round((e.varMin + e.varMax) / 2 * 100) / 100;
    }
    if (type === 'expense') e.funding = [];
    if (type === 'income') e.icon = icon || '💶';
    if (startMonth) e.startMonth = startMonth;
    return e;
  }

  return { parseDate, dateOrder, parseAmount, readTable, guessMapping, isComplete, applyMapping, parseStatement, decodeBytes,
    cleanName, findRecurring, findExisting, amountChange, guessPriority, toBudgetEntry };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BudgetImport;

// =========================
// DIALOG (nur im Browser)
// =========================
if (typeof document !== 'undefined') (function initBudgetImport() {
  const FREQ_LABEL = { weekly: 'wöchentlich', biweekly: 'alle 2 Wochen', monthly: 'monatlich', quarterly: 'vierteljährlich', yearly: 'jährlich' };
  const state = { parsed: null, mapping: null, found: [], picks: {} };

  const modal = (typeof wireModal === 'function')
    ? wireModal('budget-import-modal-overlay', { closeIds: ['budget-import-modal-close', 'budget-import-cancel'], onClose: reset })
    : { open() {}, close() {} };
  const $ = id => document.getElementById(id);

  function reset() {
    state.parsed = null; state.mapping = null; state.found = []; state.picks = {};
    const f = $('budget-import-file'); if (f) f.value = '';
    showStep('file');
  }
  function showStep(step) {
    ['file', 'result'].forEach(s => $(`budget-import-step-${s}`)?.classList.toggle('hidden', s !== step));
    $('budget-import-save')?.classList.toggle('hidden', step !== 'result');
  }

  window.openBudgetImport = function () { reset(); modal.open(); };

  $('budget-import-file')?.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (/\.pdf$/i.test(file.name)) { showMessage('PDF-Auszüge gehen leider nicht. Lade im Online-Banking den Umsatz-Export als CSV herunter.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const text = BudgetImport.decodeBytes(new Uint8Array(reader.result));
      state.parsed = BudgetImport.parseStatement(text, file.name);
      state.mapping = state.parsed.kind === 'csv' ? { ...state.parsed.mapping } : null;
      analyse();
    };
    reader.onerror = () => showMessage('Die Datei ließ sich nicht lesen.');
    reader.readAsArrayBuffer(file);
  });

  function showMessage(text) {
    showStep('result');
    $('budget-import-mapping').innerHTML = '';
    $('budget-import-summary').textContent = text;
    $('budget-import-list').innerHTML = '';
    $('budget-import-save').classList.add('hidden');
  }

  function analyse() {
    const p = state.parsed;
    if (p.kind === 'csv' && !p.table.rows.length) { showMessage('In der Datei wurden keine Buchungen mit Datum gefunden. Ist es der Umsatz-Export als CSV?'); return; }
    const rows = p.kind === 'csv' ? BudgetImport.applyMapping(p.table, state.mapping).rows : p.rows;
    const today = todayIso();
    const all = BudgetImport.findRecurring(rows, today);
    state.found = all.filter(f => !f.ended && f.freq !== 'quarterly');
    const quarterly = all.filter(f => !f.ended && f.freq === 'quarterly').length;
    state.picks = {};
    // mode: 'add' = neuer Posten · 'update' = vorhandenen Posten auf den Bank-Betrag anpassen
    // (vorab an, wenn eine Preiserhöhung erkannt wurde) · 'same' = schon da, Betrag passt.
    state.found.forEach(f => {
      const existing = BudgetImport.findExisting(f, budgetRecurring);
      const change = BudgetImport.amountChange(f, existing);
      const mode = !existing ? 'add' : change ? 'update' : 'same';
      state.picks[f.key] = { on: mode === 'add' || (mode === 'update' && !!f.hike), name: f.name, existing, change, mode };
    });
    showStep('result');
    renderMapping(p);
    const span = rows.length ? `${fmtDe(rows.reduce((a, r) => r.date < a ? r.date : a, rows[0].date))} – ${fmtDe(rows.reduce((a, r) => r.date > a ? r.date : a, rows[0].date))}` : '';
    let summary = rows.length
      ? `${rows.length} Buchungen gelesen (${span}). ${state.found.length ? `${state.found.length} davon wiederholen sich:` : 'Darin wiederholt sich nichts regelmäßig.'}`
      : 'Es konnten keine Buchungen gelesen werden. Prüf unten, welche Spalte Datum, Name und Betrag ist.';
    if (rows.length && monthsSpan(rows) < 3) summary += ' Tipp: Ein Export über mindestens drei Monate findet mehr.';
    if (quarterly) summary += ` ${quarterly} vierteljährliche${quarterly === 1 ? 'r Posten wurde' : ' Posten wurden'} ausgelassen, diesen Rhythmus kennt Nook nicht.`;
    $('budget-import-summary').textContent = summary;
    renderList();
  }

  const fmtDe = iso => iso.split('-').reverse().join('.');
  const monthsSpan = rows => {
    const ds = rows.map(r => r.date).sort();
    return (Date.parse(ds[ds.length - 1]) - Date.parse(ds[0])) / 864e5 / 30.4;
  };

  // Spalten nur zeigen, wenn es eine CSV ist. Aufgeklappt, wenn die Vermutung unvollständig ist.
  function renderMapping(p) {
    const box = $('budget-import-mapping');
    if (p.kind !== 'csv') { box.innerHTML = ''; return; }
    const m = state.mapping;
    const opts = sel => `<option value="-1">–</option>` + p.table.header.map((h, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${escHtml(h)}</option>`).join('');
    const field = (key, label) => `<label class="b-imp-map-field"><span>${label}</span><select class="modal-input" data-key="${key}">${opts(m[key])}</select></label>`;
    box.innerHTML = `
      <details class="b-imp-map"${BudgetImport.isComplete(m) ? '' : ' open'}>
        <summary>Spalten prüfen</summary>
        <div class="b-imp-map-grid">
          ${field('date', 'Datum')}${field('name', 'Name')}${field('amount', 'Betrag')}${field('purpose', 'Verwendungszweck')}
        </div>
      </details>`;
    box.querySelectorAll('select').forEach(s => s.addEventListener('change', () => {
      m[s.dataset.key] = Number(s.value);
      if (s.dataset.key === 'amount' && m.amount >= 0) { m.debit = -1; m.credit = -1; }
      if (s.dataset.key === 'name') m.name2 = -1;
      if (s.dataset.key === 'date') m.order = BudgetImport.dateOrder(p.table.rows.slice(0, 50).map(r => r[m.date] ?? ''));
      analyse();
    }));
  }

  function renderList() {
    const list = $('budget-import-list');
    if (!state.found.length) { list.innerHTML = ''; updateSave(); return; }
    const section = (title, items) => !items.length ? '' : `
      <div class="b-imp-group">${title}</div>
      ${items.map(f => {
        const pk = state.picks[f.key];
        const amount = f.freq === 'monthly' && f.varies ? `${fmtEuro(f.min)} – ${fmtEuro(f.max)}` : fmtEuro(f.average);
        const hike = f.hike ? `<span class="b-imp-hike">teurer seit ${fmtDe(f.hike.date)}: ${fmtEuro(f.hike.from)} → ${fmtEuro(f.hike.to)}</span>` : '';
        let note = '';
        if (pk.mode === 'update') note = `<span class="b-imp-note">in Nook als „${escHtml(pk.existing.name)}“ mit ${fmtEuro(pk.change.from)}. Angehakt wird der Betrag angepasst.</span>`;
        else if (pk.mode === 'same') note = `<span class="b-imp-note">schon da als „${escHtml(pk.existing.name)}“</span>`;
        const nameField = pk.mode === 'update'
          ? `<span class="b-imp-name b-imp-name-fixed">${escHtml(pk.existing.name)}</span>`
          : `<input type="text" class="b-imp-name" data-key="${escHtml(f.key)}" value="${escHtml(pk.name)}" aria-label="Name"/>`;
        return `
        <label class="b-imp-row${pk.on ? '' : ' off'}">
          <input type="checkbox" data-key="${escHtml(f.key)}"${pk.on ? ' checked' : ''}/>
          <span class="b-imp-main">
            ${nameField}
            <span class="b-imp-meta">${FREQ_LABEL[f.freq]} · ${f.count}× seit ${fmtDe(f.firstDate)}${hike}${note}</span>
          </span>
          <span class="b-imp-amount ${f.isIncome ? 'income' : 'expense'}">${f.isIncome ? '+' : '-'}${amount}</span>
        </label>`;
      }).join('')}`;
    list.innerHTML = section('Einnahmen', state.found.filter(f => f.isIncome)) + section('Ausgaben', state.found.filter(f => !f.isIncome));
    list.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => {
      state.picks[cb.dataset.key].on = cb.checked;
      cb.closest('.b-imp-row').classList.toggle('off', !cb.checked);
      updateSave();
    }));
    list.querySelectorAll('.b-imp-name').forEach(inp => {
      inp.addEventListener('input', () => { state.picks[inp.dataset.key].name = inp.value; });
    });
    updateSave();
  }
  function updateSave() {
    const on = state.found.filter(f => state.picks[f.key]?.on);
    const u = on.filter(f => state.picks[f.key].mode === 'update').length, a = on.length - u;
    const btn = $('budget-import-save');
    btn.textContent = a && u ? `${a} hinzufügen, ${u} anpassen`
      : u ? (u === 1 ? '1 Betrag anpassen' : `${u} Beträge anpassen`)
      : `${a} Posten übernehmen`;
    btn.disabled = on.length === 0;
  }

  $('budget-import-save')?.addEventListener('click', () => {
    const startMonth = budgetMonthKey(new Date());
    const add = [], updated = [];
    state.found.forEach(f => {
      const pk = state.picks[f.key];
      if (!pk?.on) return;
      if (pk.mode === 'update') {
        const e = budgetRecurring.find(r => r.id === pk.existing.id);
        if (e) { updated.push({ id: e.id, amount: e.amount }); e.amount = round2(pk.change.to); }
        return;
      }
      if (!pk.name.trim()) return;
      const icon = f.isIncome && typeof incomeIcon === 'function' ? incomeIcon(pk.name) : undefined;
      const e = BudgetImport.toBudgetEntry(f, { name: pk.name, startMonth, icon });
      if (e) add.push(e);
    });
    if (!add.length && !updated.length) return;
    budgetRecurring.push(...add);
    saveBudgetRecurring();
    modal.close();
    renderBudget();
    if (typeof hubUndo === 'function') {
      const ids = new Set(add.map(e => e.id));
      const msg = [add.length ? `${add.length} Posten übernommen` : '', updated.length ? `${updated.length} angepasst` : ''].filter(Boolean).join(', ');
      hubUndo(msg, () => {
        budgetRecurring = budgetRecurring.filter(r => !ids.has(r.id));
        updated.forEach(u => { const e = budgetRecurring.find(r => r.id === u.id); if (e) e.amount = u.amount; });
        saveBudgetRecurring();
        renderBudget();
      });
    }
  });
})();
