#!/usr/bin/env node
/* Compare the bundled products.json against what StoreHub is actually serving.
 *
 * The menu falls back through MENU_FEED_URL → POS feed → StoreHub →
 * products.json, so whichever one wins is what customers see. When StoreHub is
 * live, editing products.json changes nothing for them. This says where the two
 * disagree so you know which side to fix.
 *
 *   # simplest — go through the deployed proxy, no StoreHub creds needed locally
 *   STAFF_KEY=xxx node tools/compare-storehub.mjs
 *
 *   # or straight to StoreHub
 *   STOREHUB_USER=dankclub STOREHUB_KEY=xxx node tools/compare-storehub.mjs --direct
 *
 *   --json     machine-readable
 *   --proxy=<url>   override the deployment (default: the live POS)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const direct = args.includes("--direct");
const proxyBase =
  (args.find((a) => a.startsWith("--proxy=")) || "").split("=")[1] ||
  "https://dank-medical-pos-app.vercel.app";

const local = JSON.parse(readFileSync(join(here, "..", "products.json"), "utf8"));

/* ---- get the StoreHub side, normalised exactly the way the site does it ---- */
async function fromStoreHub() {
  const { fetchStoreHubProducts, shConfigured } = await import("../api/_storehub.js");
  if (!shConfigured()) {
    throw new Error("STOREHUB_USER and STOREHUB_KEY (or STOREHUB_TOKEN) must be set for --direct");
  }
  return fetchStoreHubProducts();
}

async function fromProxy() {
  const key = process.env.STAFF_KEY;
  const url = `${proxyBase}/api/storehub/products${key ? `?key=${encodeURIComponent(key)}` : ""}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await r.text();
  if (!r.ok) {
    let hint = "";
    if (r.status === 403) hint = "  (the proxy wants same-origin or STAFF_KEY — set STAFF_KEY=…)";
    if (r.status === 500) hint = "  (STOREHUB_USER / STOREHUB_KEY not set on that deployment)";
    throw new Error(`proxy ${r.status}${hint}\n${body.slice(0, 300)}`);
  }
  const raw = JSON.parse(body);
  const { normalize, groupTiers } = await import("../api/_storehub.js");
  const list = (Array.isArray(raw) ? raw : raw?.data || [])
    .filter((p) => !p.isParentProduct)
    .map((p) => normalize(p, {}))
    .filter(Boolean);
  return groupTiers(list);
}

/* ---- matching ---- */
const key = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const priceOf = (p) => {
  if (Array.isArray(p.priceTiers) && p.priceTiers.length) {
    const t = p.priceTiers.find((x) => /^1g$/i.test(x.label)) || p.priceTiers[0];
    return { label: t.label, price: +t.price || 0 };
  }
  return { label: "", price: +p.price || 0 };
};

let remote;
try {
  remote = await (direct ? fromStoreHub() : fromProxy());
} catch (e) {
  console.error(`\ncould not read StoreHub: ${e.message}\n`);
  console.error("Nothing was compared — this is not a verdict on either side.\n");
  process.exit(2);
}

const byKey = new Map();
for (const r of remote) {
  byKey.set(key(r.name), r);
  if (r.id) byKey.set(key(r.id), r);
}

const matched = [];
const onlyLocal = [];
for (const l of local) {
  const hit = byKey.get(key(l.name)) || byKey.get(key(l.id));
  if (hit) matched.push([l, hit]);
  else onlyLocal.push(l);
}
const matchedRemote = new Set(matched.map(([, r]) => r));
const onlyRemote = remote.filter((r) => !matchedRemote.has(r));

// StoreHub normally carries no photos at all; flagging "only products.json has
// an image" on all 53 rows would bury the differences that matter.
const remoteHasAnyImage = remote.some((r) => r.image);
const diffs = [];
for (const [l, r] of matched) {
  const lp = priceOf(l), rp = priceOf(r);
  const d = [];
  if (lp.price !== rp.price) d.push(`price ฿${lp.price} → ฿${rp.price}${rp.label ? ` (${rp.label})` : ""}`);
  if (key(l.name) !== key(r.name)) d.push(`name "${l.name}" → "${r.name}"`);
  if (l.category !== r.category) d.push(`category ${l.category} → ${r.category}`);
  if (!r.image && l.image && remoteHasAnyImage) d.push("image: missing on StoreHub");
  if (r.image && !l.image) d.push("image: only StoreHub has one");
  if (d.length) diffs.push({ name: l.name, d });
}

if (asJson) {
  console.log(JSON.stringify({
    counts: { local: local.length, storehub: remote.length, matched: matched.length },
    onlyLocal: onlyLocal.map((p) => p.name),
    onlyRemote: onlyRemote.map((p) => p.name),
    diffs,
  }, null, 2));
} else {
  const L = console.log;
  L(`\nproducts.json ${local.length}   StoreHub ${remote.length}   matched ${matched.length}\n`);

  L(`only in products.json  ${onlyLocal.length}`);
  onlyLocal.forEach((p) => L(`   · ${p.name}  [${p.category}]`));

  L(`\nonly in StoreHub       ${onlyRemote.length}`);
  onlyRemote.forEach((p) => L(`   · ${p.name}  [${p.category}]  ฿${priceOf(p).price}`));

  L(`\ndiffer                 ${diffs.length}`);
  diffs.forEach((x) => L(`   · ${x.name}\n       ${x.d.join("\n       ")}`));

  if (!remoteHasAnyImage) {
    L(`\nStoreHub returned no photos at all, which is normal — the storefront falls`);
    L(`back to products.json for images, so that is not counted as a difference.\n`);
  } else L("");
}
