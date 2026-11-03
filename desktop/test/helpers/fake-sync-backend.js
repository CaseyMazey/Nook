// Fake-Backend für Sync-Tests: bildet den kleinen Teil der Supabase-API nach,
// den die Sync-Engine nutzt (from().select/eq/in/gt/order/range/limit/upsert/insert/update/delete),
// im Rückgabeformat { data, error }. Greift nie auf ein echtes Supabase zu.
// opts.maxRows bildet die Zeilengrenze pro Anfrage nach (Supabase: "max-rows", Standard 1000).
// .select() nach einem Schreibvorgang liefert wie PostgREST die betroffenen Zeilen.
"use strict";

function createFakeBackend(opts = {}) {
  const maxRows = opts.maxRows || Infinity;
  const store = new Map(); // "userId|key" -> Zeile
  const events = [];       // Realtime-Ereignisse: { type, row, device }
  const failures = [];     // einmalige Fehler pro Operation
  const skips = [];        // einmalige Operationen ohne Wirkung und ohne Fehler (zum Beispiel RLS)
  const holds = [];        // einmalige Gates: Operation bleibt offen, bis release() gerufen wird
  const open = { current: {}, max: {} }; // gleichzeitig offene Operationen pro Typ
  const id = (r) => r.user_id + "|" + r.key;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // Die nächste Operation dieses Typs trifft keine Zeile und meldet keinen Fehler.
  function skipNext(op) { skips.push(op); }

  function failNext(op, error) {
    failures.push({ op, error: error || { message: "fake " + op + " failure", code: "fake" } });
  }

  // Hält die nächste Operation dieses Typs offen. started löst auf, sobald sie im Backend ankommt.
  function holdNext(op) {
    let release, started;
    const gate = new Promise((r) => { release = r; });
    const startedP = new Promise((r) => { started = r; });
    holds.push({ op, gate, started });
    return { release, started: startedP };
  }

  async function execute(q, device) {
    const i = holds.findIndex((h) => h.op === q.op);
    const hold = i >= 0 ? holds.splice(i, 1)[0] : null;
    open.current[q.op] = (open.current[q.op] || 0) + 1;
    open.max[q.op] = Math.max(open.max[q.op] || 0, open.current[q.op]);
    try {
      if (hold) { hold.started(); await hold.gate; }
      return run(q, device);
    } finally {
      open.current[q.op]--;
    }
  }

  function takeFailure(op) {
    const i = failures.findIndex((f) => f.op === op);
    return i >= 0 ? failures.splice(i, 1)[0].error : null;
  }

  function run(q, device) {
    const fail = takeFailure(q.op);
    if (fail) return { data: null, error: fail };
    const skip = skips.indexOf(q.op);
    if (skip >= 0) { skips.splice(skip, 1); return { data: q.returning ? [] : null, error: null }; }
    // Zeitstempel vergleicht Postgres als Zeitpunkt, nicht als Text.
    const same = (col, a, b) => (col === "updated_at" ? Date.parse(a) === Date.parse(b) : a === b);
    const test1 = (f, r) => (f.type === "eq" ? same(f.col, r[f.col], f.val) : f.type === "gt" ? r[f.col] > f.val : f.val.includes(r[f.col]));
    const match = (r) => q.filters.every((f) => test1(f, r));
    const out = (rows) => ({ data: q.returning ? rows.map(clone) : null, error: null });
    const hit = () => Array.from(store.values()).filter(match);
    if (q.op === "select") {
      let rows = hit().map(clone);
      if (q.order) rows.sort((a, b) => (a[q.order] < b[q.order] ? -1 : a[q.order] > b[q.order] ? 1 : 0));
      if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
      if (q.limit !== null) rows = rows.slice(0, q.limit);
      rows = rows.slice(0, maxRows);
      if (q.mode === "maybeSingle") {
        if (rows.length > 1) return { data: null, error: { message: "mehrere Zeilen", code: "PGRST116" } };
        return { data: rows[0] || null, error: null };
      }
      if (q.mode === "single") {
        if (rows.length !== 1) return { data: null, error: { message: "keine einzelne Zeile", code: "PGRST116" } };
        return { data: rows[0], error: null };
      }
      return { data: rows, error: null };
    }
    if (q.op === "upsert") {
      const done = [];
      for (const r of [].concat(q.payload)) {
        const row = clone(r);
        store.set(id(row), row);
        done.push(row);
        events.push({ type: "upsert", row: clone(row), device });
      }
      return out(done);
    }
    if (q.op === "insert") {
      const list = [].concat(q.payload);
      if (list.some((r) => store.has(id(r)))) return { data: null, error: { message: "duplicate key", code: "23505" } };
      const done = [];
      for (const r of list) {
        const row = clone(r);
        store.set(id(row), row);
        done.push(row);
        events.push({ type: "insert", row: clone(row), device });
      }
      return out(done);
    }
    if (q.op === "update") {
      const done = hit();
      for (const r of done) {
        Object.assign(r, clone(q.payload));
        events.push({ type: "update", row: clone(r), device });
      }
      return out(done);
    }
    if (q.op === "delete") {
      const done = hit();
      for (const r of done) {
        store.delete(id(r));
        events.push({ type: "delete", row: clone(r), device });
      }
      return out(done);
    }
    return { data: null, error: { message: "unbekannte Operation " + q.op } };
  }

  function client(deviceName) {
    return {
      from(table) {
        const q = { table, op: "select", filters: [], mode: null, payload: null, order: null, range: null, limit: null, returning: false };
        const b = {
          select() { if (q.op !== "select") q.returning = true; return b; },
          order(col) { q.order = col; return b; },
          range(from, to) { q.range = [from, to]; return b; },
          limit(n) { q.limit = n; return b; },
          gt(col, val) { q.filters.push({ type: "gt", col, val }); return b; },
          eq(col, val) { q.filters.push({ type: "eq", col, val }); return b; },
          in(col, val) { q.filters.push({ type: "in", col, val }); return b; },
          maybeSingle() { q.mode = "maybeSingle"; return b; },
          single() { q.mode = "single"; return b; },
          upsert(payload) { q.op = "upsert"; q.payload = payload; return b; },
          insert(payload) { q.op = "insert"; q.payload = payload; return b; },
          update(payload) { q.op = "update"; q.payload = payload; return b; },
          delete() { q.op = "delete"; return b; },
          then(res, rej) { return execute(q, deviceName).then(res, rej); }
        };
        return b;
      }
    };
  }

  return { client, failNext, skipNext, holdNext, maxOpen: (op) => open.max[op] || 0, rows: () => Array.from(store.values()).map(clone), events };
}

module.exports = { createFakeBackend };
