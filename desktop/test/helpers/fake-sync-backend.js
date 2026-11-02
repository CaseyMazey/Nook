// Fake-Backend für Sync-Tests: bildet den kleinen Teil der Supabase-API nach,
// den die Sync-Engine nutzt (from().select/eq/in/upsert/insert/update/delete),
// im Rückgabeformat { data, error }. Greift nie auf ein echtes Supabase zu.
"use strict";

function createFakeBackend() {
  const store = new Map(); // "userId|key" -> Zeile
  const events = [];       // Realtime-Ereignisse: { type, row, device }
  const failures = [];     // einmalige Fehler pro Operation
  const holds = [];        // einmalige Gates: Operation bleibt offen, bis release() gerufen wird
  const open = { current: {}, max: {} }; // gleichzeitig offene Operationen pro Typ
  const id = (r) => r.user_id + "|" + r.key;
  const clone = (x) => JSON.parse(JSON.stringify(x));

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
    const match = (r) => q.filters.every((f) => (f.type === "eq" ? r[f.col] === f.val : f.val.includes(r[f.col])));
    const hit = () => Array.from(store.values()).filter(match);
    if (q.op === "select") {
      const rows = hit().map(clone);
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
      for (const r of [].concat(q.payload)) {
        const row = clone(r);
        store.set(id(row), row);
        events.push({ type: "upsert", row: clone(row), device });
      }
      return { data: null, error: null };
    }
    if (q.op === "insert") {
      const list = [].concat(q.payload);
      if (list.some((r) => store.has(id(r)))) return { data: null, error: { message: "duplicate key", code: "23505" } };
      for (const r of list) {
        const row = clone(r);
        store.set(id(row), row);
        events.push({ type: "insert", row: clone(row), device });
      }
      return { data: null, error: null };
    }
    if (q.op === "update") {
      for (const r of hit()) {
        Object.assign(r, clone(q.payload));
        events.push({ type: "update", row: clone(r), device });
      }
      return { data: null, error: null };
    }
    if (q.op === "delete") {
      for (const r of hit()) {
        store.delete(id(r));
        events.push({ type: "delete", row: clone(r), device });
      }
      return { data: null, error: null };
    }
    return { data: null, error: { message: "unbekannte Operation " + q.op } };
  }

  function client(deviceName) {
    return {
      from(table) {
        const q = { table, op: "select", filters: [], mode: null, payload: null };
        const b = {
          select() { return b; },
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

  return { client, failNext, holdNext, maxOpen: (op) => open.max[op] || 0, rows: () => Array.from(store.values()).map(clone), events };
}

module.exports = { createFakeBackend };
