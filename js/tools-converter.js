// =========================
// TOOLS — 3) CONVERTER
// Benötigt tools.js (Grundgerüst + geteilte Dateneinheiten-Registry)
// zuvor geladen.
// =========================

// =========================================================
// 3) CONVERTER
// Datengetrieben: eine Kategorie-Registry mit Umrechnungsfaktoren
// zur jeweiligen Basiseinheit. Temperatur ist die einzige Ausnahme
// (braucht Formeln statt reiner Faktoren) und darum als "special"
// markiert. Neue Kategorien/Einheiten = neuer Registry-Eintrag,
// keine Logikänderung nötig.
// =========================================================

const TOOLS_CONVERTER_CATEGORIES = {
  length: {
    label: 'Länge',
    defaultFrom: 'cm', defaultTo: 'inch',
    units: {
      mm:   { label: 'mm',    factor: 0.001 },
      cm:   { label: 'cm',    factor: 0.01 },
      m:    { label: 'm',     factor: 1 },
      km:   { label: 'km',    factor: 1000 },
      inch: { label: 'inch',  factor: 0.0254 },
      ft:   { label: 'ft',    factor: 0.3048 },
      yard: { label: 'yard',  factor: 0.9144 },
      mile: { label: 'mile',  factor: 1609.344 }
    }
  },
  weight: {
    label: 'Gewicht',
    defaultFrom: 'kg', defaultTo: 'lb',
    units: {
      mg: { label: 'mg', factor: 0.000001 },
      g:  { label: 'g',  factor: 0.001 },
      kg: { label: 'kg', factor: 1 },
      t:  { label: 't',  factor: 1000 },
      lb: { label: 'lb', factor: 0.45359237 },
      oz: { label: 'oz', factor: 0.028349523125 }
    }
  },
  temperature: {
    label: 'Temperatur',
    defaultFrom: 'c', defaultTo: 'f',
    special: true,
    units: {
      c: { label: '°C' },
      f: { label: '°F' },
      k: { label: 'K' }
    }
  },
  data: {
    label: '💾 Datenmenge',
    defaultFrom: 'mib', defaultTo: 'gib',
    // Nutzt direkt die geteilte DR_UNIT_FACTORS-Registry (Basis Bit) —
    // dieselben Einheiten wie im Datenübertragungsraten-Rechner, keine
    // eigene/duplizierte Umrechnungstabelle.
    units: Object.fromEntries(
      Object.entries(DR_UNIT_FACTORS).map(([key, u]) => [key, { label: u.label, factor: u.factor }])
    )
  },
  time: {
    label: 'Zeit',
    defaultFrom: 'min', defaultTo: 'sec',
    units: {
      sec:   { label: 'Sek.',   factor: 1 },
      min:   { label: 'Min.',   factor: 60 },
      hour:  { label: 'Std.',   factor: 3600 },
      day:   { label: 'Tag',    factor: 86400 },
      week:  { label: 'Woche',  factor: 604800 },
      month: { label: 'Monat',  factor: 2592000 },
      year:  { label: 'Jahr',   factor: 31536000 }
    }
  }
};

function toolsConvertTemperature(from, to, value) {
  let celsius;
  if (from === 'c') celsius = value;
  else if (from === 'f') celsius = (value - 32) * 5 / 9;
  else celsius = value - 273.15;

  if (to === 'c') return celsius;
  if (to === 'f') return celsius * 9 / 5 + 32;
  return celsius + 273.15;
}

function toolsConvertValue(categoryKey, fromKey, toKey, value) {
  const cat = TOOLS_CONVERTER_CATEGORIES[categoryKey];
  if (!cat) return 0;
  if (cat.special) return toolsConvertTemperature(fromKey, toKey, value);

  const fromUnit = cat.units[fromKey];
  const toUnit = cat.units[toKey];
  if (!fromUnit || !toUnit) return 0;

  const base = value * fromUnit.factor;
  return base / toUnit.factor;
}

function toolsFormatConvResult(num) {
  if (!isFinite(num)) return '0';
  const rounded = Math.round(num * 10000) / 10000;
  return String(rounded);
}

let convState = { category: 'length', from: 'cm', to: 'inch' };

function initConverter() {
  const saved = DB.get('toolsConverterState', null);
  if (saved && TOOLS_CONVERTER_CATEGORIES[saved.category]) {
    convState = saved;
  }

  const categorySelect = document.getElementById('conv-category');
  categorySelect.innerHTML = Object.entries(TOOLS_CONVERTER_CATEGORIES)
    .map(([key, cat]) => `<option value="${key}">${cat.label}</option>`).join('');
  categorySelect.value = convState.category;

  populateConverterUnitSelects();

  categorySelect.addEventListener('change', () => {
    convState.category = categorySelect.value;
    const cat = TOOLS_CONVERTER_CATEGORIES[convState.category];
    convState.from = cat.defaultFrom;
    convState.to = cat.defaultTo;
    populateConverterUnitSelects();
    saveConverterState();
    renderConverter();
  });

  document.getElementById('conv-from-unit').addEventListener('change', e => {
    convState.from = e.target.value;
    saveConverterState();
    renderConverter();
  });
  document.getElementById('conv-to-unit').addEventListener('change', e => {
    convState.to = e.target.value;
    saveConverterState();
    renderConverter();
  });
  document.getElementById('conv-from-value').addEventListener('input', renderConverter);

  document.getElementById('conv-swap-btn').addEventListener('click', () => {
    const tmp = convState.from;
    convState.from = convState.to;
    convState.to = tmp;
    populateConverterUnitSelects();
    saveConverterState();
    renderConverter();
  });

  renderConverter();
}

function populateConverterUnitSelects() {
  const cat = TOOLS_CONVERTER_CATEGORIES[convState.category];
  const fromSelect = document.getElementById('conv-from-unit');
  const toSelect = document.getElementById('conv-to-unit');

  const optionsHtml = Object.entries(cat.units)
    .map(([key, u]) => `<option value="${key}">${u.label}</option>`).join('');

  fromSelect.innerHTML = optionsHtml;
  toSelect.innerHTML = optionsHtml;
  fromSelect.value = convState.from;
  toSelect.value = convState.to;
}

function saveConverterState() {
  DB.set('toolsConverterState', convState);
}

function renderConverter() {
  const cat = TOOLS_CONVERTER_CATEGORIES[convState.category];
  const fromValue = parseFloat(document.getElementById('conv-from-value').value) || 0;

  const result = toolsConvertValue(convState.category, convState.from, convState.to, fromValue);
  document.getElementById('conv-to-value').value = toolsFormatConvResult(result);

  const exampleResult = toolsConvertValue(convState.category, convState.from, convState.to, 1);
  const fromLabel = cat.units[convState.from].label;
  const toLabel = cat.units[convState.to].label;
  document.getElementById('conv-example').textContent =
    `1 ${fromLabel} = ${toolsFormatConvResult(exampleResult)} ${toLabel}`;
}
