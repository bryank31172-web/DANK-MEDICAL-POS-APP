/* The website and the till must show the same picture for the same product.
   node api/__tests__/photo-match.test.mjs */
import { readFileSync } from "node:fs";
import { photoKey, photoMap, photoFor, applyPhotos, generatedPhotoFor, resetPhotoCache } from "../_photos.js";

const catalogue = JSON.parse(readFileSync(new URL("../../products.json", import.meta.url), "utf8"));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? "  ✓ " : "  ✗ ") + name + (cond || extra === undefined ? "" : "  → " + extra));
  cond ? pass++ : fail++;
};

console.log("normalisation");
ok('drops a leading "( Bar )" prefix', photoKey("( Bar ) OG Kush") === "og kush", photoKey("( Bar ) OG Kush"));
ok("drops the weight", photoKey("OG Kush 1g") === "og kush", photoKey("OG Kush 1g"));
ok("drops joint/pre-roll wording", photoKey("OG Kush Pre-Roll") === "og kush", photoKey("OG Kush Pre-Roll"));
ok("case and punctuation do not matter", photoKey("OG-KUSH!") === photoKey("og kush"));
ok("a 1g joint and a 3.5g bag land on one key",
  photoKey("Gelato X 1g joint") === photoKey("Gelato X 3.5g"), photoKey("Gelato X 1g joint"));
ok("different strains stay apart", photoKey("Gelato X") !== photoKey("Gelato 41"));
ok("empty input is safe", photoKey(undefined) === "" && photoKey(null) === "");

/* The server copy of this rule and the POS's webKey() must agree exactly.
   If they drift, one product gets two different pictures — the bug this
   whole module exists to stop — and nothing else would catch it. */
console.log("\nthe POS and the server agree");
const jsx = readFileSync(new URL("../../pos/app.fixed.jsx", import.meta.url), "utf8");
const m = jsx.match(/function webKey\(name\)\{([\s\S]*?)\n\}/);
ok("webKey() still exists in the POS source", !!m);
if (m) {
  const posBody = m[1];
  const rules = [
    String.raw`\^\\s\*\\\(\[\^\)\]\*\\\)\\s\*`,
    String.raw`joint\|blunt\|pre-\?roll`,
    String.raw`g\|gram\|grams\|mg\|ml\|pc\|pcs\|pack\|x`,
    String.raw`\[\^a-z0-9\]\+`,
  ];
  const srv = readFileSync(new URL("../_photos.js", import.meta.url), "utf8");
  for (const r of rules) {
    const re = new RegExp(r);
    ok("same rule on both sides: /" + r.slice(0, 34) + "/", re.test(posBody) && re.test(srv));
  }
  /* strongest check available without running the JSX: same input, same output */
  const fn = new Function("name", posBody);   // the body already returns
  const samples = ["( Bar ) OG Kush 1g", "Gelato X 3.5g", "Sour Belts 3000mg", "Zooties Premium Joint",
    "Crispy Boy lager Can", "Muhameds Live Resin Disposable 2g", "  ", "Thai Orange Tea"];
  let same = true, culprit = "";
  for (const s of samples) {
    let posOut;
    try { posOut = fn(s); } catch (e) { same = false; culprit = "webKey threw: " + e.message; break; }
    if (posOut !== photoKey(s)) { same = false; culprit = `${JSON.stringify(s)}: POS ${JSON.stringify(posOut)} vs server ${JSON.stringify(photoKey(s))}`; break; }
  }
  ok("identical output on real product names", same, culprit);
}

/* The whole point is that the counter and the website show one picture, so the
   check that matters is not "does each side look sensible" but "do they return
   the identical URL for the same product name". Run both, compare. */
console.log("\nthe till and the server pick the same picture");
{
  const mm = jsx.match(/function webImgFor\(name, map\)\{([\s\S]*?)\n\}/);
  ok("webImgFor() still exists in the POS source", !!mm);
  if (mm) {
    const keyFn = jsx.match(/function webKey\(name\)\{([\s\S]*?)\n\}/)[1];
    const tillPick = new Function("name", "map",
      "function webKey(name){" + keyFn + "}\n" + mm[1]);

    const m = await photoMap();
    const plain = Object.fromEntries(m);        // the till holds a plain object
    /* names in the shapes the live feed actually produces, not tidy ones */
    const names = [];
    for (const p of catalogue) {
      names.push(p.name, `( Bar ) ${p.name}`, `${p.name} 1g`, `${p.name} 3.5g`,
        p.name.toUpperCase(), `  ${p.name}  `,
        /* suffixed and prefixed shapes the counter names carry, which only the
           containment fallback can resolve */
        `${p.name} Indoor`, `Premium ${p.name}`);
    }
    names.push("OG Kush x Zkittlez", "Something Nobody Sells", "", "   ",
      "( Equipment ) Bong XL ( 50 cm )", "Gelato X 1g joint");

    let mismatches = [];
    for (const n of names) {
      const a = tillPick(n, plain), b = photoFor(n, m);
      if (a !== b) mismatches.push(`${JSON.stringify(n)}: till ${JSON.stringify(a)} vs server ${JSON.stringify(b)}`);
    }
    ok(`identical picture for all ${names.length} name shapes`, mismatches.length === 0,
      mismatches.slice(0, 3).join(" | "));

    /* the containment fallback is the half that was missing server-side */
    const fuzzy = names.filter((n) => photoKey(n) && !m.has(photoKey(n)) && photoFor(n, m));
    ok("the containment fallback actually fires (so it is really being tested)", fuzzy.length > 0, fuzzy.length);
    ok("a product nobody sells still gets no picture", photoFor("Something Nobody Sells", m) === "");
  }
}

console.log("\ncatalogue map");
const map = await photoMap();
ok("the catalogue produced a map", map.size > 0, map.size);
ok("a known strain resolves", !!map.get(photoKey("Crunch Berrie")));
ok("photos are usable URLs", [...map.values()].every((v) => /^(https?:|data:image|\/)/.test(v)));

const withImage = catalogue.filter((p) => p.image);
ok("every catalogue product with a photo is reachable by name",
  withImage.every((p) => map.has(photoKey(p.name))),
  withImage.filter((p) => !map.has(photoKey(p.name))).map((p) => p.name).join(", "));

console.log("\napplyPhotos");
const fromStoreHub = [
  { id: "sh-1", name: "( Bar ) Crunch Berrie 1g", image: "" },      // no photo, odd name
  { id: "sh-2", name: "Crunch Berrie", image: "https://old.example/x.jpg" }, // stale photo
  { id: "sh-3", name: "Nothing We Sell", image: "https://keep.example/y.jpg" },
  { id: "sh-4", name: "Also Unknown", image: "" },
];
const out = await applyPhotos(fromStoreHub);
const want = (await photoMap()).get(photoKey("Crunch Berrie"));
ok("fills a product that arrived with no photo", out[0].image === want, out[0].image);
ok("the same product in two name shapes gets one photo", out[0].image === out[1].image);
ok("the catalogue overrides a stale upstream photo", out[1].image === want, out[1].image);
ok("an unknown product keeps the photo it came with", out[2].image === "https://keep.example/y.jpg");
ok("an unknown product with no photo receives a generated product photo", out[3].image === generatedPhotoFor(fromStoreHub[3]));
ok("the input array is not mutated", fromStoreHub[1].image === "https://old.example/x.jpg");

/* Even if products.json cannot be read (or is temporarily empty), a newly
   imported StoreHub SKU must still receive a generated image. */
resetPhotoCache();
const cwd = process.cwd();
process.chdir(new URL(".", import.meta.url).pathname);
const withoutCatalogue = await applyPhotos([{ id: "sh-new", name: "Brand New StoreHub Flower", category: "Flowers", image: "" }]);
process.chdir(cwd);
ok("new StoreHub SKU gets a generated photo without the curated catalogue", withoutCatalogue[0].image === "/assets/products/generated-fallbacks/flower.webp");
resetPhotoCache();

ok("empty input is handled", (await applyPhotos([])).length === 0);
ok("a non-array is handled", (await applyPhotos(null)) === null);
ok("junk entries do not throw", (await applyPhotos([null, 7, { name: "Crunch Berrie" }]))[2].image === want);

resetPhotoCache();
ok("the cache can be reset", (await photoMap()).size === map.size);

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
