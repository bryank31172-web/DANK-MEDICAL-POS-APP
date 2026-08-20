/* A website order has to reach the shop's stock, and when it cannot, somebody
   has to be told. Both halves used to be silent: an item with no StoreHub id
   was dropped and pushTransaction returned a bare {skipped:true} that nobody
   recorded, so the website kept selling stock the shop no longer had.

   node api/__tests__/order-stock.test.mjs */
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? "  ✓ " : "  ✗ ") + name + (cond || extra === undefined ? "" : "  → " + extra));
  cond ? pass++ : fail++;
};
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

/* ── the id has to survive the feed, or there is nothing to book against ── */
console.log("the StoreHub id reaches the storefront");
{
  const feed = read("pos-feed.js"), menu = read("_menu.js");
  ok("the POS push-feed carries shId", /shId:\s*shId/.test(feed));
  ok("it falls back through sku and id", /p\.shId\s*\?\?\s*p\.sku\s*\?\?\s*p\.id/.test(feed));
  ok("the generic feed normaliser carries shId", /shId:\s*String\(x\.shId/.test(menu));
}

/* ── every exit from the push says what it was ── */
console.log("\nevery outcome names itself");
{
  const sh = read("_storehub.js");
  const block = sh.slice(sh.indexOf("export async function pushTransaction"));
  const bare = block.match(/return \{ skipped: true \}/g);
  ok("no bare {skipped:true} left", !bare, bare && bare.length + " remain");
  for (const r of ["StoreHub not configured", "STOREHUB_PUSH_ORDERS is not 1",
    "no store id", "no StoreHub id on any line"]) {
    ok(`names "${r}"`, block.includes(r));
  }
  ok("a partial push reports the lines it missed", /unmatched\s*=\s*all\.filter/.test(block));
}

/* ── run it: mock fetch, drive pushTransaction for real ── */
console.log("\npushTransaction, actually executed");
{
  const realFetch = globalThis.fetch;
  const env = { ...process.env };
  let sent = null;
  globalThis.fetch = async (url, opt) => {
    if (String(url).endsWith("/transactions")) { sent = JSON.parse(opt.body); return { ok: true, status: 200 }; }
    return { ok: true, status: 200, json: async () => [{ id: "store-1" }] };
  };
  process.env.STOREHUB_USER = "u"; process.env.STOREHUB_KEY = "k";
  process.env.STOREHUB_STORE_ID = "store-1";

  const { pushTransaction } = await import("../_storehub.js?fresh=" + Math.random());

  process.env.STOREHUB_PUSH_ORDERS = "";
  let r = await pushTransaction({ items: [{ shId: "p1", qty: 1, price: 100, lineTotal: 100 }] }, "DK1");
  ok("switched off, it says so", r.skipped && /STOREHUB_PUSH_ORDERS/.test(r.reason), r.reason);

  process.env.STOREHUB_PUSH_ORDERS = "1";
  r = await pushTransaction({ items: [{ name: "Mystery Item", qty: 1, price: 100, lineTotal: 100 }] }, "DK2");
  ok("no id on any line: skipped with a reason", r.skipped && /no StoreHub id/.test(r.reason), r.reason);
  ok("and it names the line staff must count by hand",
    Array.isArray(r.unmatched) && r.unmatched[0] === "Mystery Item", JSON.stringify(r.unmatched));

  r = await pushTransaction({
    total: 800, subtotal: 800, payment: "Cash", fulfilment: "pickup",
    customer: { name: "A", phone: "0800000000" },
    items: [
      { shId: "p1", name: "Gelato X", qty: 2, price: 400, lineTotal: 800 },
      { name: "Untracked Extra", qty: 1, price: 0, lineTotal: 0 },
    ],
  }, "DK3");
  ok("a matched line is pushed", r.ok === true && r.lines === 1, JSON.stringify({ ok: r.ok, lines: r.lines }));
  ok("the transaction books the right product and quantity",
    sent?.items?.[0]?.productId === "p1" && sent.items[0].quantity === 2, JSON.stringify(sent?.items));
  ok("it is tagged with the order id", sent?.refId === "DK3", sent?.refId);
  ok("the unmatched line is still reported, not swallowed",
    r.unmatched.length === 1 && r.unmatched[0] === "Untracked Extra", JSON.stringify(r.unmatched));

  globalThis.fetch = async () => ({ ok: false, status: 422 });
  r = await pushTransaction({ items: [{ shId: "p1", qty: 1, price: 1, lineTotal: 1 }] }, "DK4");
  ok("a rejection is reported, not treated as success", r.ok === false && /rejected/.test(r.reason), r.reason);

  globalThis.fetch = realFetch;
  for (const k of ["STOREHUB_USER", "STOREHUB_KEY", "STOREHUB_STORE_ID", "STOREHUB_PUSH_ORDERS"]) {
    if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k];
  }
}

/* ── the order records it, and staff are told in the same message ── */
console.log("\nthe order and the alert carry the answer");
{
  const o = read("order.js");
  ok("the push runs before the alert is sent",
    o.indexOf("0a-STOCK") < o.indexOf("0b-LINE"), "push is still after the alert");
  ok("the outcome is stored on the order", /o\.stock = stock/.test(o));
  ok("the stored record is rewritten with it",
    /order stock-state save failed/.test(o));
  ok("a cut is distinguished from a skip and a failure",
    /status: "cut"/.test(o) && /status: "skipped"/.test(o) && /status: "failed"/.test(o));
  ok("the alert carries a stock line", /\$\{stockLine\}/.test(o));
  ok("the warning names the reason", /STOCK NOT CUT/.test(o) && /stock\.reason/.test(o));
  ok("unmatched lines are listed for manual counting", /needsManualCount/.test(o));
  ok("the push is not left in two places", (o.match(/pushTransaction\(o, orderId\)/g) || []).length === 1);
}

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
