// Tests für den Kontoauszug-Import (js/budget-import.js, reiner Teil BudgetImport).
// Ausführen: node --test tests/   (Node 18+, keine Abhängigkeiten)
// Die Beispiel-Exporte sind nachgebaut (Spalten wie bei der jeweiligen Bank), alle Namen erfunden.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/budget-import.js');

const TODAY = '2026-11-15';
const rowsOf = (text, name = 'umsaetze.csv') => {
  const p = B.parseStatement(text, name);
  return p.kind === 'csv' ? B.applyMapping(p.table, p.mapping).rows : p.rows;
};
const byName = (found, re) => found.find(f => re.test(f.name));
const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];

test('Beträge: deutsches Format, Tausenderpunkt, Soll-Kennzeichen', () => {
  assert.equal(B.parseAmount('-1.234,56'), -1234.56);
  assert.equal(B.parseAmount('12,99 €'), 12.99);
  assert.equal(B.parseAmount('-12,5'), -12.5);
  assert.equal(B.parseAmount('1.200'), 1200);
  assert.equal(B.parseAmount('1234.56'), 1234.56);
  assert.equal(B.parseAmount('12,50 S'), -12.5);
  assert.equal(B.parseAmount(''), null);
});

test('Datum: deutsch, zweistellige Jahre, ISO, Monatsnamen, 31.02. abgelehnt', () => {
  assert.equal(B.parseDate('01.10.25'), '2025-10-01');
  assert.equal(B.parseDate('3.1.2026'), '2026-01-03');
  assert.equal(B.parseDate('2026-10-01'), '2026-10-01');
  assert.equal(B.parseDate('1. Okt 2026'), '2026-10-01');
  assert.equal(B.parseDate('31.02.2026'), null);
});

test('Sparkasse (CSV-CAMT, Windows-1252): Miete, Gehalt und Strom werden gefunden', () => {
  const lines = ['"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"'];
  const strom = [61.5, 58, 72.4, 64, 66.1, 59.9];
  months.forEach((m, i) => {
    const [y, mm] = m.split('-');
    const de = d => `${d}.${mm}.${y.slice(2)}`;
    lines.push(`"DE00";"${de('01')}";"${de('01')}";"DAUERAUFTRAG";"Miete Wohnung 3 OG";"Hausverwaltung Müller";"DE11";"X";"-650,00";"EUR";"Umsatz gebucht"`);
    lines.push(`"DE00";"${de('28')}";"${de('28')}";"LOHN GEHALT";"Gehalt ${mm}/${y}";"Nordlicht Werkstatt GmbH";"DE22";"X";"1.480,00";"EUR";"Umsatz gebucht"`);
    lines.push(`"DE00";"${de('15')}";"${de('15')}";"FOLGELASTSCHRIFT";"Abschlag Strom KD 123456";"Stadtwerke Beispielstadt";"DE33";"X";"-${String(strom[i]).replace('.', ',')}";"EUR";"Umsatz gebucht"`);
    lines.push(`"DE00";"${de('0' + (2 + i))}";"${de('0' + (2 + i))}";"KARTENZAHLUNG";"Einkauf";"REWE Markt";"DE44";"X";"-${23 + i * 9},${i}0";"EUR";"Umsatz gebucht"`);
  });
  // Wie im echten Export: Windows-1252 statt UTF-8.
  const bytes = Uint8Array.from(Buffer.from(lines.join('\r\n'), 'latin1'));
  const text = B.decodeBytes(bytes);
  assert.ok(text.includes('Müller'), 'Umlaut kommt richtig an');
  const p = B.parseStatement(text, 'sparkasse.csv');
  assert.equal(p.table.header[p.mapping.date], 'Buchungstag');
  assert.equal(p.table.header[p.mapping.name], 'Beguenstigter/Zahlungspflichtiger');
  assert.equal(p.table.header[p.mapping.amount], 'Betrag');
  const found = B.findRecurring(B.applyMapping(p.table, p.mapping).rows, TODAY);

  const miete = byName(found, /Hausverwaltung Müller/);
  assert.ok(miete, 'Miete gefunden');
  assert.equal(miete.freq, 'monthly');
  assert.equal(miete.average, 650);
  assert.equal(miete.isIncome, false);

  const gehalt = byName(found, /Nordlicht/);
  assert.ok(gehalt && gehalt.isIncome, 'Gehalt als Einnahme');

  const s = byName(found, /Stadtwerke/);
  assert.ok(s && s.varies, 'Strom schwankt');
  assert.ok(!byName(found, /REWE/), 'Einkäufe an wechselnden Tagen sind kein Posten');

  const e = B.toBudgetEntry(s, { startMonth: '2026-11' });
  assert.equal(e.freq, 'monthly');
  assert.equal(e.day, 15);
  assert.equal(e.priority, 'must');
  assert.equal(e.certainty, 'variable');
  assert.equal(e.varMin, 58);
  assert.equal(e.varMax, 72.4);
  assert.equal(e.amount, 65.2);
  assert.deepEqual(e.funding, []);
  assert.equal(e.startMonth, '2026-11');
});

test('ING: Vorspann-Zeilen werden übersprungen, Saldo ist nicht der Betrag', () => {
  const lines = [
    'Umsatzanzeige;Datei erstellt am: 15.11.2026 10:00',
    ';Letztes Update: aktuell',
    '',
    'IBAN;DE00 0000 0000 0000 0000 00',
    'Kontoname;Girokonto',
    'Bank;ING',
    'Zeitraum;01.06.2026 - 15.11.2026',
    'Saldo;1.234,56;EUR',
    '',
    'Buchung;Valuta;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung',
  ];
  months.forEach(m => {
    const [y, mm] = m.split('-');
    lines.push(`03.${mm}.${y};03.${mm}.${y};SPOTIFY AB;Lastschrift;P1234567 Spotify;2.000,00;EUR;-10,99;EUR`);
  });
  const p = B.parseStatement(lines.join('\n'), 'ing.csv');
  assert.equal(p.table.header[p.mapping.amount], 'Betrag');
  const found = B.findRecurring(B.applyMapping(p.table, p.mapping).rows, TODAY);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Spotify AB');
  assert.equal(found[0].average, 10.99);
  assert.equal(B.guessPriority(found[0].name), 'want');
});

test('DKB: getrennte Spalten für Zahlungspflichtige und Empfänger', () => {
  const lines = [
    '"Girokonto";"DE00"', '""', '"Kontostand vom 15.11.2026:";"1.000,00 €"', '""',
    '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"',
  ];
  months.forEach(m => {
    const [y, mm] = m.split('-');
    lines.push(`"10.${mm}.${y.slice(2)}";"10.${mm}.${y.slice(2)}";"Gebucht";"Kim Beispiel";"Fitnessstudio Kraftwerk";"Beitrag";"Ausgang";"DE1";"-29,90 €";"";"";""`);
    lines.push(`"25.${mm}.${y.slice(2)}";"25.${mm}.${y.slice(2)}";"Gebucht";"Familienkasse";"Kim Beispiel";"Kindergeld";"Eingang";"DE2";"255,00 €";"";"";""`);
  });
  const found = B.findRecurring(rowsOf(lines.join('\n'), 'dkb.csv'), TODAY);
  assert.ok(byName(found, /Fitnessstudio/) && !byName(found, /Fitnessstudio/).isIncome);
  const kg = byName(found, /Familienkasse/);
  assert.ok(kg && kg.isIncome, 'bei Eingängen zählt die zahlende Seite');
});

test('comdirect: Name steckt im Buchungstext', () => {
  const lines = ['"Buchungstag";"Wertstellung (Valuta)";"Vorgang";"Buchungstext";"Umsatz in EUR";'];
  months.forEach(m => {
    const [y, mm] = m.split('-');
    lines.push(`"05.${mm}.${y}";"05.${mm}.${y}";"Lastschrift / Belastung";"Auftraggeber: Mobilfunk Blau GmbH Buchungstext: Rechnung ${mm}${y} Ref. ABC${mm}";"-17,99";`);
  });
  const found = B.findRecurring(rowsOf(lines.join('\n')), TODAY);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Mobilfunk Blau GmbH');
});

test('PayPal: Händler aus dem Verwendungszweck, verschiedene Händler bleiben getrennt', () => {
  const lines = ['Buchungstag;Auftraggeber/Empfänger;Verwendungszweck;Betrag'];
  months.forEach((m, i) => {
    const [y, mm] = m.split('-');
    lines.push(`07.${mm}.${y};PayPal Europe S.a.r.l. et Cie S.C.A;100${i}234567 PP.${i}111.PP . Netflix International B.V., Ihr Einkauf bei Netflix International B.V.;-13,99`);
    lines.push(`${10 + i}.${mm}.${y};PayPal Europe S.a.r.l. et Cie S.C.A;200${i}234567 PP.${i}222.PP . Shop ${i}, Ihr Einkauf bei Laden Nummer ${i};-${20 + i * 7},00`);
  });
  const found = B.findRecurring(rowsOf(lines.join('\n')), TODAY);
  assert.equal(found.length, 1);
  assert.match(found[0].name, /Netflix International/);
});

test('Wocheneinkauf mit wechselnden Beträgen ist kein Posten, gleicher Betrag schon', () => {
  const week = amount => [0, 7, 14, 21, 28, 35].map((d, i) => ({
    date: new Date(Date.UTC(2026, 9, 3 + d)).toISOString().slice(0, 10), amount: amount(i), name: 'Edeka Center', purpose: '',
  }));
  assert.equal(B.findRecurring(week(i => 40 + i * 11), TODAY).length, 0);
  const kiste = B.findRecurring(week(() => 19.99).map(r => ({ ...r, name: 'Gemüsekiste Hof Sonnig' })), TODAY);
  assert.equal(kiste.length, 1);
  assert.equal(kiste[0].freq, 'weekly');
  const e = B.toBudgetEntry(kiste[0]);
  assert.equal(e.weekday, new Date(Date.UTC(2026, 10, 7)).getUTCDay());
});

test('Umbuchungen, Bargeld und beendete Abos', () => {
  const monthly = (name, day = '05', list = months) => list.map(m => ({ date: `${m}-${day}`, amount: 100, name, purpose: '' }));
  assert.equal(B.findRecurring(monthly('Umbuchung Tagesgeld'), TODAY).length, 0);
  assert.equal(B.findRecurring(monthly('Bargeldauszahlung GA 1234'), TODAY).length, 0);
  const old = B.findRecurring(monthly('Streamingdienst Alt', '10', ['2026-01', '2026-02', '2026-03', '2026-04']), TODAY);
  assert.equal(old[0].ended, true);
});

test('Jährlich reicht zweimal; vierteljährlich wird erkannt (Nook übernimmt es nicht)', () => {
  const yearly = B.findRecurring([
    { date: '2025-03-02', amount: 89, name: 'Kfz-Versicherung Sicher AG', purpose: '' },
    { date: '2026-03-02', amount: 91, name: 'Kfz-Versicherung Sicher AG', purpose: '' },
  ], TODAY);
  assert.equal(yearly[0].freq, 'yearly');
  const e = B.toBudgetEntry(yearly[0]);
  assert.equal(e.dateDay, 2);
  assert.equal(e.dateMonth, 3);
  assert.equal(e.priority, 'must');
  const q = B.findRecurring(['2026-02-15', '2026-05-15', '2026-08-15', '2026-11-15'].map(date => ({ date, amount: 45, name: 'Rundfunkbeitrag', purpose: '' })), TODAY);
  assert.equal(q[0].freq, 'quarterly');
  assert.equal(B.toBudgetEntry(q[0]), null);
});

test('OFX und QIF', () => {
  const ofx = months.map(m => `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${m.replace('-', '')}12<TRNAMT>-9.99<FITID>${m}<NAME>Cloud Speicher</STMTTRN>`).join('\n');
  const f1 = B.findRecurring(rowsOf('OFXHEADER:100\n<OFX>' + ofx, 'a.ofx'), TODAY);
  assert.equal(f1[0].average, 9.99);
  const qif = '!Type:Bank\n' + months.map(m => `D${m.split('-').reverse().join('.')}-20\nT-4,99\nPZeitung Digital\n^`).join('\n').replace(/D(\d\d)\.(\d{4})-20/g, 'D20.$1.$2');
  const f2 = B.findRecurring(rowsOf(qif, 'a.qif'), TODAY);
  assert.equal(f2[0].average, 4.99);
});

test('Schon vorhandene Posten werden erkannt (gleiche Richtung, ähnlicher Name)', () => {
  const existing = [{ name: 'Spotify', type: 'expense' }, { name: 'Gehalt Nordlicht', type: 'income' }];
  assert.ok(B.findExisting({ name: 'SPOTIFY AB', isIncome: false }, existing));
  assert.equal(B.findExisting({ name: 'Spotify', isIncome: true }, existing), null);
  assert.ok(B.findExisting({ name: 'Nordlicht', isIncome: true }, existing));
});

test('Einnahme als Posten: keine Priorität, kein funding, Icon', () => {
  const e = B.toBudgetEntry({ name: 'Ausbildungsvergütung', freq: 'monthly', average: 980, min: 980, max: 980, varies: false, lastDate: '2026-10-30', isIncome: true }, { icon: '🎓' });
  assert.equal(e.type, 'income');
  assert.equal(e.priority, 'none');
  assert.equal(e.icon, '🎓');
  assert.equal(e.funding, undefined);
  assert.equal(e.day, 30);
});
