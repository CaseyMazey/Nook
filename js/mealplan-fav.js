// =========================
// SPEISEPLAN — Lieblingsgerichte, reiner Teil (ohne DOM, ohne DB)
// Ein Liebling ist ein Stichwort, kein einzelnes Gericht: „Bolognese“
// markiert „Nudeln Bolognese“ genauso wie „Spaghetti mit Erbsen-Bolognese“
// oder „Gemüsebolognese“. Treffer zählen deshalb auch mitten im Wort
// (deutsche zusammengesetzte Wörter). Steht das Stichwort in
// Anführungszeichen ("Reis"), zählt nur das ganze Wort — sonst träfe
// „Reis“ auch „Preiselbeeren“.
// Lädt vor today-mealplan.js (window.NookMealFav). Tests: tests/mealplan-fav.test.js.
// =========================

const NookMealFav = (() => {
  const MAX_LEN = 40;
  const QUOTED = /^["„“”‚‘’'»«›‹](.+?)["„“”‚‘’'»«›‹]$/;

  // Kleinbuchstaben, Umlaute ausgeschrieben, alles außer Buchstaben/Ziffern
  // wird zu einem Leerzeichen („Erbsen-Bolognese“ → „erbsen bolognese“).
  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // Gespeichertes Stichwort → { word (normalisiert), whole }
  function parse(fav) {
    const raw = String(fav || '').trim();
    const m = raw.match(QUOTED);
    const word = normalize(m ? m[1] : raw);
    return { word, whole: !!m };
  }

  function matches(text, fav) {
    const { word, whole } = parse(fav);
    if (!word) return false;
    const t = normalize(text);
    if (!t) return false;
    return whole ? ` ${t} `.includes(` ${word} `) : t.includes(word);
  }

  // Alle Stichwörter, die auf ein Gericht passen (in Listen-Reihenfolge)
  function hitsFor(text, favorites) {
    return (favorites || []).filter(f => matches(text, f));
  }

  // Bereinigt die Eingabe; null, wenn leer oder schon vorhanden.
  function clean(raw) {
    const s = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    return parse(s).word ? s : null;
  }
  const sameKey = f => { const p = parse(f); return (p.whole ? '"' : '') + p.word; };

  // Fügt ein Stichwort hinzu (ohne Doppelte) → neue Liste
  function add(favorites, raw) {
    const list = Array.isArray(favorites) ? favorites.slice() : [];
    const s = clean(raw);
    if (!s || list.some(f => sameKey(f) === sameKey(s))) return list;
    list.push(s);
    return list;
  }

  // Ersetzt das Stichwort an Position i; leer = entfernen, Doppelte fallen weg
  function rename(favorites, i, raw) {
    const list = Array.isArray(favorites) ? favorites.slice() : [];
    if (i < 0 || i >= list.length) return list;
    const s = clean(raw);
    if (!s || list.some((f, j) => j !== i && sameKey(f) === sameKey(s))) list.splice(i, 1);
    else list[i] = s;
    return list;
  }

  // Vorschlag aus einem Gericht: ohne „VEGAN“-Präfix, sonst unverändert
  // (die Nutzerin/der Nutzer kürzt selbst auf das gewünschte Wort).
  function suggest(dish) {
    return String(dish || '').replace(/^VEGAN\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  }

  // Treffer einer Woche, je Stichwort: [{ fav, dishes: [{ dayIndex, slot, text }] }]
  // week = { days: [{ menu1, menu2, menu3, dessert } × 5] }, slots = ['menu1', …]
  function weekHits(week, favorites, slots, fromDay = 0) {
    const out = (favorites || []).map(fav => ({ fav, dishes: [] }));
    if (!week || !Array.isArray(week.days)) return out;
    week.days.forEach((day, dayIndex) => {
      if (dayIndex < fromDay || !day) return;
      slots.forEach(slot => {
        const text = day[slot];
        if (!text) return;
        out.forEach(o => { if (matches(text, o.fav)) o.dishes.push({ dayIndex, slot, text }); });
      });
    });
    return out;
  }

  // Anzeigename ohne Anführungszeichen
  function label(fav) {
    const raw = String(fav || '').trim();
    const m = raw.match(QUOTED);
    return m ? m[1] : raw;
  }

  return { normalize, parse, matches, hitsFor, add, rename, suggest, weekHits, label, MAX_LEN };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NookMealFav;
