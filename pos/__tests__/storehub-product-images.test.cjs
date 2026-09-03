const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app.fixed.jsx'), 'utf8');
let failures = 0;
let checks = 0;
function check(label, condition) {
  checks++;
  console.log((condition ? '  ✓ ' : '  ✗ ') + label);
  if (!condition) failures++;
}

const start = src.indexOf('function skuFallbackImg(');
const end = src.indexOf('// Event products', start);
const body = src.slice(start, end);
const skuFallbackImg = new Function(body + '; return skuFallbackImg;')();

console.log('StoreHub product image coverage');
const guava = skuFallbackImg({id:'sh-101', sku:'FW0090', name:'Guava Candy', cat:'Flowers'});
check('missing Guava Candy receives a generated flower photo', guava === '/assets/products/generated-fallbacks/flower.webp');
check('a pre-roll receives the generated pre-roll photo', skuFallbackImg({name:'Gelato 41 Joint',cat:'Pre-Roll'}).endsWith('/pre-roll.webp'));
check('a bar SKU receives the food/drink photo', skuFallbackImg({name:'Mojito',cat:'Bar'}).endsWith('/food-drink.webp'));
check('an accessory receives the retail photo', skuFallbackImg({name:'Grinder',cat:'Accessories'}).endsWith('/retail.webp'));
check('POS image resolver always ends with SKU fallback', /webImgFor\(p\.name,webImgs\)\|\|skuFallbackImg\(p\)/.test(src));
check('broken remote images fall back to generated SKU image', /fallback=\{skuFallbackImg\(p\)\}/.test(src));
check('root-relative generated photos render as image elements', /src\.charAt\(0\)===\"\/\"/.test(src));
check('image state resets when an async photo source changes', /useEffect\(function\(\)\{setOkImg\(true\);\},\[src\]\)/.test(src));

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${checks - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
