/* One product, one photograph — wherever the menu came from.
 *
 * The menu can arrive from four different places (the POS push-feed, a
 * MENU_FEED_URL, StoreHub, or the bundled catalogue). Only one of them
 * carries pictures. StoreHub has none at all, and the POS feed only has the
 * ones the POS itself resolved a moment earlier — so which photo a customer
 * saw depended on which upstream happened to answer first. The same strain
 * could show its artwork on the till and a bare emoji on the website.
 *
 * products.json is the shop's curated catalogue and the only place a
 * deliberate photo choice is recorded, so it decides. This module matches by
 * a normalised name rather than by id, because the ids differ between systems
 * — StoreHub, the POS and the website each mint their own — while the name on
 * the label is the thing that is actually the same.
 *
 * The normalisation is a deliberate copy of webKey() in pos/app.fixed.jsx.
 * The two must agree character for character: if the till and the server
 * disagree about what "( Bar ) OG Kush 1g" reduces to, they will show
 * different pictures for one product, which is the exact bug this exists to
 * prevent. Change one, change both, and the test in
 * api/__tests__/photo-match.test.mjs will tell you when they have drifted.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* keep in step with webKey() in pos/app.fixed.jsx */
export function photoKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/^\s*\([^)]*\)\s*/, "")                                    // "( Bar ) Tequila" → "tequila"
    .replace(/\b(joint|blunt|pre-?roll|preroll|cone|stick|bud|flower)\b/g, " ")
    .replace(/\b\d+(\.\d+)?\s*(g|gram|grams|mg|ml|pc|pcs|pack|x)\b/g, " ")  // drop the size
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const usable = (s) => /^(https?:|data:image|\/)/.test(String(s || ""));

let cache = null;
export async function photoMap() {
  if (cache) return cache;
  const m = new Map();
  try {
    const raw = await readFile(join(process.cwd(), "products.json"), "utf8");
    const items = JSON.parse(raw);
    for (const p of Array.isArray(items) ? items : []) {
      const k = photoKey(p && p.name);
      /* first entry wins: the catalogue is ordered, and an accessory sharing a
         word with a strain must not overwrite the strain's artwork */
      if (k && usable(p.image) && !m.has(k)) m.set(k, p.image);
    }
  } catch (e) {
    console.error("photo map unavailable:", e.message);
  }
  cache = m;
  return m;
}

/* exported for the tests, and for a future admin action that edits the file */
export function resetPhotoCache() { cache = null; }

/* Exact key first, then the longest catalogue name contained in the till name
 * (or the reverse), so "OG Kush x Zkittlez" still finds "OG Kush".
 *
 * This second step is the half that is easy to leave out, and leaving it out
 * is what made the two disagree: the till has always done the containment
 * fallback, so it showed a picture where the server — matching on the exact
 * key alone — found nothing, and the same product appeared with artwork on the
 * counter and bare on the website. Mirror of webImgFor() in pos/app.fixed.jsx,
 * iteration order included: both build their map from products.json in file
 * order, first entry winning, so "longest match, earliest on a tie" resolves
 * to the same picture on both sides. */
export function photoFor(name, m) {
  const k = photoKey(name);
  if (!k) return "";
  if (m.has(k)) return m.get(k);
  let best = "", bestLen = 0;
  for (const [wk, img] of m) {
    if (wk.length < 4) continue;                       // too short to mean anything
    if (k === wk || k.indexOf(wk) >= 0 || wk.indexOf(k) >= 0) {
      if (wk.length > bestLen) { bestLen = wk.length; best = img; }
    }
  }
  return best;
}

/** Give every item the catalogue's picture, keeping its own where we have none. */
export async function applyPhotos(data) {
  if (!Array.isArray(data) || !data.length) return data;
  const m = await photoMap();
  if (!m.size) return data;
  return data.map((p) => {
    if (!p || typeof p !== "object") return p;
    const pick = photoFor(p.name, m);
    if (!pick || pick === p.image) return p;
    return { ...p, image: pick };
  });
}
