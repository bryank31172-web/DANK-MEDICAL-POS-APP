const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app.fixed.jsx'), 'utf8');
let failures = 0;
function check(label, condition) {
  console.log((condition ? '  ✓ ' : '  ✗ ') + label);
  if (!condition) failures++;
}

const start = src.indexOf('function birthdaySkuImg(');
const end = src.indexOf('// ── BAR', start);
const body = src.slice(start, end);
const birthdaySkuImg = new Function(body + '; return birthdaySkuImg;')();

const cases = [
  ['(Birthday) Red Wine', '/assets/products/birthday-event/wine.jpeg'],
  ['Birthday Singha Beer', '/assets/products/birthday-event/singha.jpeg'],
  ["Birthday Hendrick's Gin", '/assets/products/birthday-event/hendricks.jpeg'],
  ['Birthday Espresso Martini', '/assets/products/birthday-event/espresso-martini.png'],
  ['Birthday Pink Gin', '/assets/products/birthday-event/pink-gin.jpeg'],
  ['Birthday Regency', '/assets/products/birthday-event/regency.png'],
  ['Birthday Suntory Whisky', '/assets/products/birthday-event/suntory.jpeg'],
  ['Birthday Soft Drink', '/assets/products/birthday-event/soft-drinks.webp'],
];

console.log('birthday SKU photos');
cases.forEach(([name, expected]) => check(name, birthdaySkuImg(name) === expected));
check('normal bar SKU is not overridden', birthdaySkuImg('Singha Beer') === '');

console.log('\nservice charge');
check('rate is exactly 10%', /const SERVICE_CHARGE_RATE=0\.10;/.test(src));
check('discounted/points net is the charge base', /const serviceBase=Math\.max\(0,afterDisc-ptDisc\);/.test(src));
check('service charge is included in final total', /const finalTotal=serviceBase\+serviceCharge;/.test(src));
check('receipt stores the service charge', /serviceCharge,serviceChargeRate:SERVICE_CHARGE_RATE/.test(src));
check('printed receipt labels the charge', /Service 10%/.test(src));

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${cases.length + 6 - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
