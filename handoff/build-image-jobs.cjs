/* Rebuild handoff/image-jobs.json from products.json.
 *
 * Run this when the catalogue changes — a new strain, a renamed one — so the
 * artwork brief and the shop's actual menu cannot drift apart:
 *
 *   node handoff/build-image-jobs.cjs
 *
 * Every prompt is the same style sentence plus one character concept, which is
 * the whole trick: the constant half is what makes forty-one separate pictures
 * read as one series. A product with no entry in CHAR still gets a usable
 * prompt, just a generic character — add it below to make it specific.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "products.json"), "utf8"));
const items = Array.isArray(raw) ? raw : (raw.products || raw);

/* the constant half — this is what makes every card look like one brand */
const FRAME =
  "Style: hyper-saturated neon comic / airbrush street-art poster. Thick glowing " +
  "magenta-purple neon border with a melted drip along the top edge, rounded corners, " +
  "black background. Volumetric neon smoke, sparkles and glow throughout. Bold " +
  "high-contrast cel shading with heavy black outlines. Vertical composition weight on " +
  "the right for the character, left side kept clearer.";
const CARDTEXT =
  'Header centred at the top in small white caps between two cannabis-leaf glyphs: ' +
  '"BOTANICAL LEGENDS". Below it the product name in a huge bold graffiti display font ' +
  'with a thick outline and drop shadow. Under the name a tagline in gold caps ' +
  'separated by dots. Bottom strip: a dark translucent bar for product details, and a ' +
  'gold circular medallion with a cannabis leaf in the bottom-right corner.';
const NOTEXT =
  "NO text, NO letters, NO logo, NO watermark anywhere in the image — artwork only. " +
  "Square 1:1 crop with the character centred.";

/* character concept per strain — the creative core of each card */
const CHAR = {
  "Crunch Berrie":"a cereal-mascot character made of berries, in a varsity jacket and cap, holding a bowl of glowing berry cereal, purple and hot-pink palette",
  "Alien Mint":"a friendly green alien in a chrome bomber jacket and round shades, sipping a mint milkshake, mint-green and silver palette",
  "Cookie Monster":"an original shaggy blue-green monster character (NOT any existing TV character) with big googly eyes, clutching a stack of cookies, teal and brown palette",
  "D-Lish":"a candy-shop character in a striped apron holding a swirl of fruit candy, pink, lime and orange palette",
  "Black Cherry":"a goth cherry-headed character in a black leather jacket and dark shades, holding a cherry cocktail, deep crimson and near-black palette",
  "Orange Z":"a citrus-headed character in an orange tracksuit and gold chain, holding a fresh orange juice, vivid orange and lime palette",
  "Giraffe Puzzy":"a stylish cartoon giraffe in a patterned bucket hat and shades, tall neck curving through the neon smoke, amber and lime palette",
  "Blue Nerdz":"a candy-punk character covered in tiny blue and pink candy pebbles, oversized glasses, blue-violet and magenta palette",
  "Thai Orange Tea":"a Thai woman in traditional gold-embroidered dress and headdress wearing round shades, sipping Thai iced tea, orange and gold palette, Thai temple silhouette behind",
  "Red Hot":"a fire-elemental character with flame hair in a red bomber jacket, holding a chilli, scarlet and orange palette",
  "Coco Chanel":"an elegant high-fashion character in a black and gold quilted coat with pearls and dark shades (original design, no real brand marks), black and gold palette",
  "Pink Zugar":"a sugar-spun character with candyfloss hair in a pastel tracksuit, holding a sugar cone, pink and lavender palette",
  "LCG RX11":"a cyber-medic character in a neon lab coat with a glowing prescription vial, teal and forest-green palette",
  "Toad Venom":"a big cartoon toad in a gold chain and shades, neon slime dripping, emerald and acid-green palette",
  "Lemon Cherry Gelato":"a gelato-vendor character holding a two-scoop cone of lemon and cherry gelato, yellow and deep-red palette",
  "Gelato X":"a street-style character in a purple hoodie and cap holding a swirled gelato cone, purple and mint palette",
  "OG Kush × Zkittlez":"a classic old-school character in a tracksuit surrounded by rainbow candy rain, green and rainbow palette",
  "Ztupid":"a goofy cartoon character with a lopsided grin and oversized shades, bright multi-colour palette",
  "Sherb Tank":"a scuba-diver character in a sherbet-coloured wetsuit beside a glowing fish tank, pastel orange and teal palette",
  "King Cherry":"a crowned cherry king on a throne in a velvet robe, deep red and gold palette",
  "Baby Cake":"a chubby cartoon baker character holding a layered cake, cream and pastel-pink palette",
  "Zkittles":"a rainbow-candy character in a colour-blocked jacket, taste-the-rainbow energy, full rainbow palette",
  "Mac1":"a mechanic character in overalls with a chrome wrench, silver and pale-green palette",
  "Superboof":"a superhero character in a cape mid-flight, bold orange and green palette",
  "Thailand Durian":"a durian-headed character in a Thai fisherman's shirt, spiky shell, gold and jungle-green palette",
  "Snow Brands Pineapple Express":"a snowboarder character with a pineapple strapped to the board, snow-white and pineapple-yellow palette",
  "KAWS Moon Rocks":"an original astronaut character (no real artist's characters) holding a glittering moon rock, deep space-navy and gold palette",
  "Zooties Premium Joint":"a zoot-suited character lighting an oversized pre-roll, purple and gold palette",
  "Backwoods (Single)":"a lumberjack character in a plaid shirt in a misty forest, dark brown and forest-green palette",
  "Sour Belts 3000mg":"a candy-punk character wrapped in giant sour belts, rainbow and neon-yellow palette",
  "Gummies 500mg":"a gummy-bear character made of translucent jelly, glowing from inside, red and orange palette",
  "Wacky Worms Gummies":"a cartoon worm character in shades popping out of a candy jar, lime and magenta palette",
  "Dank Cookie 50mg":"a cookie-headed character in a chef's hat holding a warm cookie, golden-brown palette",
  "Cannabis Brownies 50mg":"a baker character holding a tray of fudge brownies, chocolate-brown and gold palette",
  "Muhameds Edible":"a market-trader character offering a tray of glossy sweets, warm amber palette",
  "Hidden Hills Resin Jelly 1000mg":"a mountain-hermit character holding a glowing jelly cube, misty blue-green palette",
  "Muhameds Live Resin Disposable 2g":"a neon-lit tech character holding a glowing vape pen, electric blue and violet palette",
  "TRE Live Rosin Disposable 3.5g":"a chrome-armoured character with a glowing rosin pen, silver and amber palette",
  "Live Resin / Rosin 1g":"an alchemist character pouring golden resin from a jar, amber and gold palette",
  "Diamond Wax 98%":"a jeweller character holding glittering crystal shards with tweezers, ice-white and diamond-blue palette",
  "Crispy Boy Lager Can":"a cool cartoon character in a bucket hat cracking open a frosty lager can, ice-blue and gold palette",
};

const FLOWER = ["Exotics","Topshelf","Midgrade","Premium"];
const SKIP = ["Accessories","Merch"];   // a rolling paper does not need a legend card

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
function taste(p){ return (p.flavors||[]).join(" · ") || "Smooth · balanced"; }
function feeling(p){
  const e = (p.effects||[]).map(String);
  if (!e.length) return "Balanced and easy";
  return titleCase(e.join(", ").toLowerCase());
}
function bestFor(p){
  const e = (p.effects||[]).map((x)=>String(x).toLowerCase());
  if (e.includes("sleepy")) return "Movie nights & deep sleep";
  if (e.includes("energetic")||e.includes("focused")||e.includes("uplifted")) return "Daytime activities & creative flow";
  if (e.includes("euphoric")) return "Anytime enjoyment & social moments";
  return "Winding down & good company";
}
function typeOf(p){
  if (FLOWER.includes(p.category)) return p.type || "Hybrid";
  return p.category;
}
function tagline(p){
  const f=(p.flavors||[]).slice(0,3).map((x)=>String(x).toUpperCase());
  while(f.length<3) f.push(["EXOTIC","SMOOTH","PREMIUM"][f.length]);
  return f.join(" · ");
}
function charFor(p){
  const c = CHAR[p.name] || `an original character themed to "${p.name}", streetwear, shades and a gold cannabis-leaf chain`;
  return c.charAt(0).toUpperCase() + c.slice(1);   // it starts a sentence in the prompt
}

/* a lager is not a strain — say what the thing actually is */
function subject(p){
  if (FLOWER.includes(p.category)) return {card:"cannabis strain card", art:"the cannabis strain"};
  if (p.category === "Beer") return {card:"product card", art:"the drink"};
  return {card:"cannabis product card", art:"the cannabis product"};
}

const list = items.filter((p)=>!SKIP.includes(p.category));
const rows = list.map((p,i)=>({
  n:i+1, name:p.name, cat:p.category,
  type:typeOf(p), taste:taste(p), feeling:feeling(p), best:bestFor(p), tag:tagline(p),
  full:`A "Botanical Legends" ${subject(p).card} for "${p.name}". ${charFor(p)}. ${FRAME} ${CARDTEXT} `+
       `Tagline: "${tagline(p)}". Landscape 3:2.`,
  art:`Character artwork for ${subject(p).art} "${p.name}". ${charFor(p)}. ${FRAME} ${NOTEXT}`,
}));

const byName = {};
items.forEach((p) => { byName[p.name] = p; });

/* lift the style sentence out of a finished prompt so a hand-written copy in
   the brief cannot fall out of step with the prompts themselves */
const firstArt = rows[0].art;
const styleBlock = firstArt.slice(firstArt.indexOf("Style:"), firstArt.indexOf("NO text,")).trim();

const jobs = rows.map((r) => {
  const p = byName[r.name] || {};
  return {
    id: p.id || null, name: r.name, category: r.cat,
    file: p.id ? p.id + ".jpg" : null,
    saveTo: p.id ? "assets/products/" + p.id + ".jpg" : null,
    currentImage: p.image || null,
    alreadyOwnArtwork: /vercel\.app\/assets\/products\//.test(String(p.image || "")),
    cardText: { type: r.type, taste: r.taste, feeling: r.feeling, bestFor: r.best, tagline: r.tag },
    promptB_artOnly: r.art,
    promptA_fullCard: r.full,
  };
});

fs.writeFileSync(path.join(__dirname, "image-jobs.json"), JSON.stringify({
  what: "Product artwork jobs for Dank Cannabis Clinic, in the shop BOTANICAL LEGENDS card style.",
  howToUse: [
    "Use promptB_artOnly for the app and the website. It is 1:1 with no lettering, because the POS draws the name and price over the tile itself.",
    "promptA_fullCard is 3:2 with the text baked in - for Instagram, menu boards and posters only.",
    "Save each result under the exact `file` name. The apply script matches on the filename, not on the picture.",
    "Copy styleBlock verbatim when writing a prompt for a product that is not in this list.",
  ],
  styleBlock,
  noTextBlock: "NO text, NO letters, NO logo, NO watermark anywhere in the image - artwork only. Square 1:1 crop with the character centred.",
  output: { aspect: "1:1", minSize: "1024x1024", format: "jpg", folder: "assets/products/" },
  doNot: [
    "Do not draw real trademarked characters or logos. Cookie Monster, Coco Chanel and KAWS are written as originally-designed characters on purpose.",
    "Do not put any lettering in the variant B artwork, not even the strain name.",
    "Do not improve or reword the style block for individual items - that is what keeps the set looking like one series.",
  ],
  count: jobs.length,
  jobs,
}, null, 1) + "\n");

const missing = jobs.filter((j) => !j.id);
console.log(`${jobs.length} jobs written (skipped ${items.length - rows.length} accessories/merch)`);
if (missing.length) console.log(`no id in products.json, so no filename: ${missing.map((m) => m.name).join(", ")}`);
