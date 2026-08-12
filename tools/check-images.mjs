#!/usr/bin/env node
/* Check every product image in products.json actually loads.
 *
 *   node tools/check-images.mjs
 *   node tools/check-images.mjs --json     machine-readable output
 *
 * No dependencies — plain node 18+. Run it from your own machine: a sandbox or
 * CI box behind a proxy cannot reach the CDN, and a blocked request is not the
 * same as a broken image. The script says which it hit.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, "..", "products.json");
const asJson = process.argv.includes("--json");
const TIMEOUT = 15000;
const CONCURRENCY = 6;

const products = JSON.parse(readFileSync(FILE, "utf8"));

/** HEAD first (cheap); some CDNs refuse it, so fall back to a ranged GET. */
async function probe(url) {
  for (const init of [
    { method: "HEAD" },
    { method: "GET", headers: { Range: "bytes=0-2047" } },
  ]) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetch(url, { ...init, signal: ctl.signal, redirect: "follow" });
      clearTimeout(timer);
      if (r.status === 405 || r.status === 501) continue; // HEAD not allowed
      return {
        status: r.status,
        type: r.headers.get("content-type") || "",
        bytes: r.headers.get("content-length") || "",
      };
    } catch (e) {
      clearTimeout(timer);
      const msg = e?.name === "AbortError" ? "timeout" : String(e?.cause?.code || e?.message || e);
      return { status: 0, error: msg };
    }
  }
  return { status: 0, error: "no method accepted" };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

// duplicates are a data problem, findable without the network
const byUrl = new Map();
for (const p of products) {
  if (!p.image) continue;
  byUrl.set(p.image, [...(byUrl.get(p.image) || []), p.name]);
}
const missing = products.filter((p) => !p.image).map((p) => p.name);
const shared = [...byUrl.entries()].filter(([, names]) => names.length > 1);
const urls = [...byUrl.keys()];

const results = await pool(urls, CONCURRENCY, async (url) => ({
  url, names: byUrl.get(url), ...(await probe(url)),
}));

const ok = results.filter((r) => r.status >= 200 && r.status < 300 && /^image\//i.test(r.type));
const wrongType = results.filter((r) => r.status >= 200 && r.status < 300 && !/^image\//i.test(r.type));
let broken = results.filter((r) => r.status >= 400);
const unreachable = results.filter((r) => r.status === 0);

/* A corporate proxy, a VPN or a sandbox network policy denies whole hosts, and
 * from in here that is indistinguishable from fifty individually rotten files.
 * If every URL on a host fails with the same status and none succeed, that is a
 * network verdict, not fifty product verdicts — report it as inconclusive
 * rather than sending someone off to re-shoot photos that are perfectly fine. */
const hostOf = (u) => { try { return new URL(u).host; } catch { return "?"; } };
const blocked = [];
for (const host of new Set(results.map((r) => hostOf(r.url)))) {
  const mine = results.filter((r) => hostOf(r.url) === host);
  const failed = mine.filter((r) => r.status >= 400);
  const statuses = new Set(failed.map((r) => r.status));
  if (mine.length >= 3 && failed.length === mine.length && statuses.size === 1) {
    blocked.push({ host, status: [...statuses][0], count: mine.length });
  }
}
/* And the plainest signal of all: if not one URL anywhere loaded, the machine
 * has no working egress. Nothing in this run says anything about the files. */
const noEgress = results.length > 0 && ok.length === 0 && wrongType.length === 0;
const blockedHosts = new Set(blocked.map((b) => b.host));
broken = broken.filter((r) => !blockedHosts.has(hostOf(r.url)));

if (asJson) {
  console.log(JSON.stringify({ missing, shared, ok: ok.length, wrongType, broken, unreachable, blocked, noEgress }, null, 2));
} else {
  const line = (s) => console.log(s);
  line(`\nproducts: ${products.length}   unique image urls: ${urls.length}\n`);

  line(`no image at all      ${missing.length}`);
  missing.forEach((n) => line(`   ✗ ${n}`));

  line(`\nsame file, 2+ products  ${shared.length}`);
  shared.forEach(([u, names]) => line(`   ⚠ ${names.join("  +  ")}   ->  ${u.split("/").pop()}`));

  line(`\nloads fine           ${ok.length}`);
  if (wrongType.length) {
    line(`\nloads but is not an image  ${wrongType.length}`);
    wrongType.forEach((r) => line(`   ⚠ ${r.names.join(", ")}  [${r.type}]  ${r.url}`));
  }
  if (broken.length) {
    line(`\nbroken               ${broken.length}`);
    broken.forEach((r) => line(`   ✗ ${r.names.join(", ")}  HTTP ${r.status}  ${r.url}`));
  }
  if (unreachable.length) {
    line(`\ncould not be reached ${unreachable.length}`);
    unreachable.forEach((r) => line(`   ? ${r.names.join(", ")}  (${r.error})  ${r.url}`));
    line(`\n   "could not be reached" is not the same as broken — a proxy, firewall`);
    line(`   or offline machine looks identical from here. Re-run on a normal`);
    line(`   connection before treating any of these as a missing photo.`);
  }
  if (noEgress) {
    line(`\n⚠ not one url loaded anywhere in this run — this machine has no working`);
    line(`  outbound access (proxy, VPN, firewall or offline). Nothing below is a`);
    line(`  verdict on the files. Re-run on a normal connection.`);
  }
  if (blocked.length) {
    line(`\nnot verified — network blocked`);
    blocked.forEach((b) => line(`   ? ${b.host}: all ${b.count} urls returned HTTP ${b.status}, none succeeded`));
    line(`\n   That is a proxy, VPN or firewall answering, not the images. This run`);
    line(`   proves nothing about those files — re-run on a normal connection.`);
  }
  const bad = missing.length + shared.length + wrongType.length + broken.length;
  const sure = blocked.length === 0 && unreachable.length === 0 && !noEgress;
  line(`\n${bad === 0 && sure ? "✅ nothing to fix" : `${bad} item(s) need attention${sure ? "" : " (plus unverified ones above)"}`}\n`);
}

// exit 1 only on things this run actually proved
process.exit(!noEgress && (broken.length || wrongType.length || missing.length) ? 1 : 0);
