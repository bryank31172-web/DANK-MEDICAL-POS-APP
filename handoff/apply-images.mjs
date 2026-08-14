#!/usr/bin/env node
/* Point products.json at whatever artwork actually sits in assets/products/.
 *
 * Drop the generated files in as <product id>.jpg (crunch-berrie.jpg, mac1.png,
 * …) and run this. It only touches entries whose file it can see on disk, so a
 * half-finished batch is safe: the strains you have not drawn yet keep their
 * current photo instead of turning into a broken image.
 *
 *   node handoff/apply-images.mjs --dry    # show what would change
 *   node handoff/apply-images.mjs          # write products.json
 *
 * The URLs stay absolute on purpose. The customer website reads this same file
 * from its own domain, so a relative /assets/... would look for the picture on
 * dankbkk-site, which does not have it. Pass --base to point somewhere else.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ART = path.join(ROOT, "assets", "products");
const CATALOG = path.join(ROOT, "products.json");
const DRY = process.argv.includes("--dry");
const EXT = [".jpg", ".jpeg", ".png", ".webp"];
const BASE = (process.argv.find((a) => a.startsWith("--base="))?.slice(7)
  || "https://dank-medical-pos-app.vercel.app").replace(/\/+$/, "");

if (!fs.existsSync(ART)) {
  console.error(`no artwork folder at ${path.relative(ROOT, ART)} — create it and put the files there`);
  process.exit(1);
}

/* id -> file, first extension wins so a leftover .png cannot shadow a new .jpg */
const onDisk = new Map();
for (const f of fs.readdirSync(ART)) {
  const ext = path.extname(f).toLowerCase();
  if (!EXT.includes(ext)) continue;
  const id = path.basename(f, ext);
  if (!onDisk.has(id)) onDisk.set(id, f);
}

const items = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
if (!Array.isArray(items)) {
  console.error("products.json is not an array — this script expects the catalogue array");
  process.exit(1);
}

const changed = [];
const already = [];
for (const p of items) {
  const f = onDisk.get(p.id);
  if (!f) continue;
  const url = `${BASE}/assets/products/${f}`;
  if (p.image === url) { already.push(p.id); continue; }
  changed.push({ id: p.id, name: p.name, from: p.image || "(none)", to: url });
  p.image = url;
}

const unmatched = [...onDisk.keys()].filter((id) => !items.some((p) => p.id === id));
const noArt = items.filter((p) => !onDisk.has(p.id)).map((p) => p.id);

for (const c of changed) console.log(`  ${c.id.padEnd(28)} ${c.from.slice(0, 46)} → ${c.to}`);
console.log(`\n${changed.length} repointed · ${already.length} already correct · ${noArt.length} still without local art`);
if (unmatched.length) {
  console.log(`\n⚠ ${unmatched.length} file(s) in assets/products/ match no product id — check the spelling:`);
  unmatched.forEach((id) => console.log(`   ${id}`));
}
if (noArt.length) console.log(`\nstill on their old image: ${noArt.join(", ")}`);

if (DRY) { console.log("\n--dry: products.json not written"); process.exit(0); }
if (!changed.length) { console.log("\nnothing to write"); process.exit(0); }

fs.writeFileSync(CATALOG, JSON.stringify(items, null, 1) + "\n");
console.log("\nproducts.json written");
