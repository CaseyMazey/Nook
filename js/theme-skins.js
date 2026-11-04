// theme-skins.js — Rechenkern fuer "Theme live bearbeiten"
// Pro Element ein Design (Bild inkl. 9-Teilung, Farben, Schrift, Form, Befestigung),
// gespeichert als ct.skins und als Stylesheet-Schicht ueber den Seitenstilen gerendert.
// Nur reine Logik: kein document/window beim Laden (laeuft auch in Node-Tests).
(function () {
  "use strict";

  const PREFIX = ":root[data-theme-skins] ";
  const DEFAULT_HEADING = "h1,h2,h3,h4,.panel-title,.panel-header,.panel-label";

  // Vorlagen: die vorhandenen RPG-Bilder (Werte aus den RPG-Stylesheets)
  const SKIN_TEMPLATES = [
    { id: "chalkboard", label: "Tafel", src: "assets/today/chalkboard.webp", slice: [48, 48, 78, 48], width: [16, 16, 26, 16] },
    { id: "plaque", label: "Holzschild", src: "assets/today/plaque.webp", slice: [95, 95, 95, 95], width: [22, 22, 22, 22] },
    { id: "note", label: "Pergament", src: "assets/questboard/note.webp", slice: [44, 44, 44, 44], width: [22, 22, 22, 22] },
    { id: "note-rag", label: "Büttenpapier", src: "assets/questboard/note-rag.webp", slice: [40, 40, 40, 40], width: [22, 22, 22, 22] },
    { id: "letter", label: "Brief", src: "assets/today/letter.webp", slice: [110, 110, 110, 110], width: [30, 30, 30, 30] },
    { id: "notepad", label: "Notizblock", src: "assets/today/notepad.webp", slice: [85, 40, 45, 85], width: [30, 16, 18, 30] },
    { id: "strap", label: "Lederriemen", src: "assets/today/wallcal-strap.webp", slice: [72, 70, 70, 70], width: [34, 33, 33, 33] },
    { id: "desk", label: "Holztisch (Fläche)", src: "assets/today/desk.webp", slice: null, width: null }
  ];

  const SKIN_FASTENERS = {
    pin: { src: "assets/questboard/pin.webp", w: 19, h: 25 },
    tack: { src: "assets/questboard/tack-iron.webp", w: 28, h: 28 },
    copper: { src: "assets/questboard/nail-copper.webp", w: 24, h: 24 },
    nail: { src: "assets/questboard/pin-nail.webp", w: 22, h: 29 },
    seal: { src: "assets/questboard/seal.webp", w: 38, h: 38 }
  };

  const SEAL_FILTERS = {
    red: "none",
    green: "hue-rotate(115deg) saturate(.75) brightness(.95)",
    black: "grayscale(1) brightness(.5) contrast(1.2)",
    blue: "hue-rotate(200deg) saturate(.8)",
    gold: "sepia(1) saturate(2.2) brightness(1.15)"
  };

  const SHADOWS = {
    none: "none",
    soft: "0 4px 14px color-mix(in srgb, var(--shadow-tint) 35%, transparent)",
    strong: "0 10px 28px color-mix(in srgb, var(--shadow-tint) 55%, transparent)"
  };
  const POS_LEFT = { left: "14%", center: "50%", right: "86%" };
  const IMAGE_MODES = ["fill", "tile", "frame"];
  const FASTENER_KINDS = ["none", "custom"].concat(Object.keys(SKIN_FASTENERS));

  const DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
  const COLOR_RE = /^#[0-9a-f]{6}$/i;
  const MAX_IMAGE = 4 * 1024 * 1024;
  const MAX_SMALL = 1024 * 1024;

  // ---------- Registry ----------

  function createSkinRegistry() {
    const defs = [];
    return {
      register(def) {
        const d = Object.assign({}, def, { heading: def.heading || DEFAULT_HEADING });
        const i = defs.findIndex(x => x.id === d.id);
        if (i >= 0) defs[i] = d; else defs.push(d);
        return d;
      },
      // Sammelelemente zuerst, sonst Anmeldereihenfolge; view '*' gilt ueberall
      list(view) {
        const sel = defs.filter(d => !view || d.view === "*" || d.view === view);
        return sel.filter(d => d.group).concat(sel.filter(d => !d.group));
      },
      get(id) { return defs.find(d => d.id === id) || null; },
      ids() { return new Set(defs.map(d => d.id)); }
    };
  }

  // ---------- Bildquellen ----------

  function resolveSkinSrc(src) {
    if (typeof src !== "string") return null;
    if (src.startsWith("tpl:")) {
      const t = SKIN_TEMPLATES.find(x => x.id === src.slice(4));
      return t ? t.src : null;
    }
    return DATA_URL_RE.test(src) ? src : null;
  }

  // ---------- CSS-Builder ----------

  // Kommas auf oberster Ebene -> :is(...), damit das Praefix fuer jeden Teil gilt
  function hasTopLevelComma(sel) {
    let depth = 0;
    for (const ch of sel) {
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      else if (ch === "," && depth === 0) return true;
    }
    return false;
  }
  const wrap = sel => (hasTopLevelComma(sel) ? ":is(" + sel + ")" : sel);

  const imp = (prop, val) => prop + ":" + val + " !important";
  const rule = (sel, decls) => (decls.length ? PREFIX + sel + "{" + decls.join(";") + "}" : "");
  const px4 = a => a.map(n => n + "px").join(" ");
  const has = v => v !== null && v !== undefined;

  function buildTarget(def, skin) {
    const sel = wrap(def.selector);
    const colors = skin.colors || {};
    const font = skin.font || {};
    const shape = skin.shape || {};
    const fast = skin.fastener || null;
    const out = [];

    // Bild aufloesen
    let img = null;
    const im = skin.image;
    if (im && typeof im === "object") {
      const url = resolveSkinSrc(im.src);
      if (url) {
        const tpl = SKIN_TEMPLATES.find(t => "tpl:" + t.id === im.src) || null;
        let mode = im.mode;
        const slice = im.slice || (tpl && tpl.slice) || null;
        if (mode === "frame" && !slice) mode = "fill";
        if (!IMAGE_MODES.includes(mode)) mode = "fill";
        const width = im.width || (tpl && tpl.width) || (slice ? slice.map(() => 16) : null);
        img = { url, mode, slice, width };
      }
    }

    // Befestigung aufloesen
    let fastenerCss = null;
    if (fast && fast.kind === "none") fastenerCss = ["display:none"];
    else if (fast && fast.kind) {
      let spec = null;
      if (fast.kind === "custom") {
        const u = resolveSkinSrc(fast.src);
        if (u && !u.startsWith("assets/")) spec = { src: u, w: 28, h: 28 };
      } else spec = SKIN_FASTENERS[fast.kind] || null;
      if (spec) {
        const left = POS_LEFT[fast.position] || POS_LEFT.center;
        const filter = fast.kind === "seal" ? (SEAL_FILTERS[fast.color || "red"] || "none") : "none";
        fastenerCss = [
          "content:''", "display:block", "position:absolute", "top:-10px", "left:" + left, "right:auto",
          "width:" + spec.w + "px", "height:" + spec.h + "px", "margin-left:" + (-spec.w / 2) + "px",
          'background:url("' + spec.src + '") center / contain no-repeat',
          "filter:" + filter, "z-index:3", "pointer-events:none"
        ];
      }
    }

    // Element-Regel
    const el = [];
    if (has(colors.text)) el.push(imp("color", colors.text));
    if (img) el.push(imp("background", "transparent"));
    else if (has(colors.surface)) {
      const op = has(shape.opacity) && shape.opacity < 100 ? shape.opacity : null;
      el.push(imp("background", op === null ? colors.surface
        : "color-mix(in srgb, " + colors.surface + " " + op + "%, transparent)"));
    }
    if (has(colors.accent)) el.push(imp("--sage", colors.accent));
    if (img) el.push(imp("border-color", "transparent"));
    else if (has(colors.border)) el.push(imp("border-color", colors.border));
    if (has(font.text)) el.push(imp("font-family", font.text));
    if (has(font.size) && font.size !== 100) el.push(imp("zoom", font.size + "%"));
    if (has(shape.radius)) el.push(imp("border-radius", shape.radius + "px"));
    if (has(shape.shadow) && SHADOWS[shape.shadow]) el.push(imp("box-shadow", SHADOWS[shape.shadow]));
    if (has(shape.padding)) el.push(imp("padding", shape.padding + "px"));
    if (!img && has(shape.tilt) && shape.tilt !== 0) el.push(imp("transform", "rotate(" + shape.tilt + "deg)"));
    if (img) { el.push(imp("position", "relative")); el.push(imp("isolation", "isolate")); }
    else if (fastenerCss && fast.kind !== "none") el.push(imp("position", "relative"));
    out.push(rule(sel, el));

    // Ueberschriften
    const hd = [];
    if (has(colors.heading)) hd.push(imp("color", colors.heading));
    if (has(font.heading)) hd.push(imp("font-family", font.heading));
    out.push(rule(sel + " " + wrap(def.heading || DEFAULT_HEADING), hd));

    // ::before (Bild)
    if (img) {
      const tilt = has(shape.tilt) && shape.tilt !== 0 ? "rotate(" + shape.tilt + "deg)" : "none";
      const op = has(shape.opacity) ? shape.opacity / 100 : 1;
      const b = [
        imp("content", "''"), imp("display", "block"), imp("position", "absolute"), imp("inset", "0"),
        imp("z-index", "-1"), imp("pointer-events", "none"), imp("border-radius", "inherit"),
        imp("filter", "none"), imp("transform", tilt), imp("opacity", String(op))
      ];
      if (img.mode === "frame") {
        const w = px4(img.width);
        b.push(imp("border-style", "solid"), imp("border-color", "transparent"), imp("border-width", w),
          imp("border-image", 'url("' + img.url + '") ' + img.slice.join(" ") + " fill / " + w + " / 0 stretch"),
          imp("background", "none"));
      } else {
        b.push(imp("border", "0"), imp("border-image", "none"),
          imp("background", 'url("' + img.url + '") ' + (img.mode === "tile" ? "top left / auto repeat" : "center / cover no-repeat")));
      }
      out.push(rule(sel + "::before", b));
    }

    // ::after (Befestigung)
    if (fastenerCss) out.push(rule(sel + "::after", fastenerCss.map(d => {
      const i = d.indexOf(":");
      return imp(d.slice(0, i), d.slice(i + 1));
    })));

    // Extras
    if (skin.extras && def.extras) {
      for (const ex of def.extras) {
        const url = resolveSkinSrc(skin.extras[ex.key]);
        if (!url) continue;
        const exSel = sel + (ex.selector.startsWith("::") ? "" : " ") + wrap(ex.selector);
        const d = ex.kind === "content"
          ? [imp("content", 'url("' + url + '")')]
          : [imp("background-image", 'url("' + url + '")'), imp("background-size", "contain"),
            imp("background-repeat", "no-repeat"), imp("background-position", "center")];
        out.push(rule(exSel, d));
      }
    }
    return out.join("");
  }

  function buildSkinCss(skins, registry) {
    if (!skins || typeof skins !== "object") return "";
    let css = "";
    // Reihenfolge der Registry: Sammelregeln vor Einzelregeln
    for (const def of registry.list()) {
      const skin = skins[def.id];
      if (skin && typeof skin === "object") css += buildTarget(def, skin);
    }
    return css;
  }

  // ---------- Pruefung ----------

  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const clampInt = (v, lo, hi) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);

  function sanitizeSrc(src, max) {
    if (typeof src !== "string" || src.length > max + 64) return null; // grobe Vorpruefung vor dem Regex
    if (src.startsWith("tpl:")) return resolveSkinSrc(src) ? src : null;
    if (!DATA_URL_RE.test(src)) return null;
    return src.length <= max ? src : null;
  }

  function sanitizeEdges(arr, max) {
    if (!Array.isArray(arr) || arr.length !== 4) return null;
    const r = arr.map(n => clampInt(n, 0, max));
    return r.includes(null) ? null : r;
  }

  function sanitizeOne(raw, def, ctx, notes, label) {
    const out = {};
    const fonts = ctx.fonts || new Set();

    if (isObj(raw.image)) {
      const im = raw.image;
      const src = sanitizeSrc(im.src, MAX_IMAGE);
      if (!src || !IMAGE_MODES.includes(im.mode)) notes.add(label + ": Bild entfernt (ungültige Quelle oder Art)");
      else {
        const o = { mode: im.mode, src };
        if (has(im.slice) || has(im.width)) {
          const slice = sanitizeEdges(im.slice, 1000), width = sanitizeEdges(im.width, 120);
          if (slice) o.slice = slice;
          if (width) o.width = width;
        }
        out.image = o;
      }
    }

    if (isObj(raw.colors)) {
      const c = {};
      for (const k of ["surface", "text", "heading", "accent", "border"]) {
        const v = raw.colors[k];
        if (!has(v)) continue;
        if (typeof v === "string" && COLOR_RE.test(v)) c[k] = v;
        else notes.add(label + ": Farbe '" + k + "' entfernt");
      }
      if (Object.keys(c).length) out.colors = c;
    }

    if (isObj(raw.font)) {
      const f = {};
      for (const k of ["heading", "text"]) {
        const v = raw.font[k];
        if (!has(v)) continue;
        if (typeof v === "string" && fonts.has(v)) f[k] = v;
        else notes.add(label + ": Schrift '" + k + "' entfernt");
      }
      const size = clampInt(raw.font.size, 80, 140);
      if (size !== null) f.size = size;
      if (Object.keys(f).length) out.font = f;
    }

    if (isObj(raw.shape)) {
      const s = raw.shape, o = {};
      const radius = clampInt(s.radius, 0, 40);
      if (radius !== null) o.radius = radius;
      if (typeof s.shadow === "string" && SHADOWS[s.shadow]) o.shadow = s.shadow;
      else if (has(s.shadow)) notes.add(label + ": Schatten entfernt");
      if (typeof s.tilt === "number" && isFinite(s.tilt)) o.tilt = Math.min(3, Math.max(-3, s.tilt));
      const padding = clampInt(s.padding, 0, 60);
      if (padding !== null) o.padding = padding;
      const opacity = clampInt(s.opacity, 30, 100);
      if (opacity !== null) o.opacity = opacity;
      if (Object.keys(o).length) out.shape = o;
    }

    if (isObj(raw.fastener)) {
      const f = raw.fastener;
      if (!FASTENER_KINDS.includes(f.kind)) { if (has(f.kind)) notes.add(label + ": Befestigung entfernt"); }
      else {
        const o = { kind: f.kind };
        let ok = true;
        if (has(f.position)) { if (POS_LEFT[f.position]) o.position = f.position; }
        if (f.kind === "seal" && has(f.color)) { if (SEAL_FILTERS[f.color]) o.color = f.color; }
        if (f.kind === "custom") {
          const src = sanitizeSrc(f.src, MAX_SMALL);
          if (src && !src.startsWith("tpl:")) o.src = src;
          else { ok = false; notes.add(label + ": eigene Befestigung entfernt (Bild ungültig oder zu groß)"); }
        }
        if (ok) out.fastener = o;
      }
    }

    if (isObj(raw.extras)) {
      const keys = new Set((def.extras || []).map(e => e.key));
      const e = {};
      for (const k of Object.keys(raw.extras)) {
        if (!keys.has(k)) { notes.add(label + ": unbekanntes Extra '" + k + "' entfernt"); continue; }
        const v = raw.extras[k];
        if (!has(v)) continue;
        const src = sanitizeSrc(v, MAX_SMALL);
        if (src) e[k] = src; else notes.add(label + ": Extra '" + k + "' entfernt (Bild ungültig oder zu groß)");
      }
      if (Object.keys(e).length) out.extras = e;
    }

    return Object.keys(out).length ? out : null;
  }

  function sanitizeSkins(raw, notes, ctx) {
    notes = notes || new Set();
    ctx = ctx || {};
    if (!isObj(raw) || !ctx.registry) return null;
    const result = {};
    for (const id of Object.keys(raw)) {
      const def = ctx.registry.get(id);
      if (!def) { notes.add("Unbekanntes Element '" + id + "' entfernt"); continue; }
      if (!isObj(raw[id])) continue;
      const one = sanitizeOne(raw[id], def, ctx, notes, def.label || id);
      if (one) result[id] = one;
    }
    return Object.keys(result).length ? result : null;
  }

  const api = {
    createSkinRegistry, SKIN_TEMPLATES, SKIN_FASTENERS, SEAL_FILTERS,
    resolveSkinSrc, buildSkinCss, sanitizeSkins
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(globalThis, api);
})();
