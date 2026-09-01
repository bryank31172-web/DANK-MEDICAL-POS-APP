function mkRes() {
  const r = { code: 200, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; };
  return r;
}

process.env.STOREHUB_USER = "u";
process.env.STOREHUB_KEY = "k";

const calls = [];
globalThis.fetch = async (url) => {
  const s = String(url);
  calls.push(s);
  const u = new URL(s);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  return {
    ok: true,
    status: 200,
    json: async () => [{ id: from + ":" + to, transactionTime: from + "T12:00:00Z", total: 100 }],
    text: async () => "[]",
    headers: { get: () => "application/json" },
  };
};

const { default: handler } = await import("../storehub/[...path].mjs?transactions=" + Math.random());
const res = mkRes();
await handler({
  method: "GET",
  url: "/api/storehub/transactions?from=2026-06-05&to=2026-09-02",
  headers: { host: "pos.test", origin: "https://pos.test" },
  query: {},
}, res);

let pass = 0, fail = 0;
const ok = (name, condition, detail = "") => condition
  ? (pass++, console.log("  ✓", name))
  : (fail++, console.log("  ✗", name, detail));

console.log("\nStoreHub transaction history chunking");
ok("90-day history succeeds", res.code === 200, res.code + " " + JSON.stringify(res.body));
ok("range is split into three 30-day calls", calls.length === 3, calls.join("\n"));
ok("all chunks are merged", Array.isArray(res.body) && res.body.length === 3, JSON.stringify(res.body));
ok("first chunk is inclusive and bounded", calls[0]?.includes("from=2026-06-05&to=2026-07-04"), calls[0]);
ok("next chunk starts after the prior end", calls[1]?.includes("from=2026-07-05&to=2026-08-03"), calls[1]);
ok("last chunk reaches the requested day", calls[2]?.includes("from=2026-08-04&to=2026-09-02"), calls[2]);

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
