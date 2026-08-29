const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app.fixed.jsx'), 'utf8');
let failures = 0;
function check(label, condition) {
  console.log((condition ? '  ✓ ' : '  ✗ ') + label);
  if (!condition) failures++;
}

const start = src.indexOf('function skuFallbackImg(');
const end = src.indexOf('// Event products', start);
const body = src.slice(start, end);
const skuFallbackImg = new Function(body + '; return skuFallbackImg;')();

console.log('StoreHub product image coverage');
const guava = skuFallbackImg({id:'sh-101', sku:'FW0090', name:'Guava Candy', cat:'Flowers'});
check('missing Guava Candy photo receives an SVG image', guava.startsWith('data:image/svg+xml'));
check('generated image contains the product name', decodeURIComponent(guava).includes('Guava Candy'));
check('same SKU generates the same image', guava === skuFallbackImg({id:'sh-101', sku:'FW0090', name:'Guava Candy', cat:'Flowers'}));
check('different SKUs generate different images', guava !== skuFallbackImg({id:'sh-102', sku:'FW0091', name:'Gelato 41', cat:'Flowers'}));
check('POS image resolver always ends with SKU fallback', /webImgFor\(p\.name,webImgs\)\|\|skuFallbackImg\(p\)/.test(src));
check('broken remote images fall back to generated SKU image', /fallback=\{skuFallbackImg\(p\)\}/.test(src));
check('image state resets when an async photo source changes', /useEffect\(function\(\)\{setOkImg\(true\);\},\[src\]\)/.test(src));

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${7 - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
