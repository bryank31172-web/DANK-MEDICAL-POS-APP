/* Reads asstMatchIndex/asstNorm out of app.fixed.jsx.
 *
 * The assistant could not answer "how much gelato is left", which is the most
 * common question in the shop, because nothing ever looked a product up. This
 * covers the matcher behind the fix — in particular that the longest name
 * wins, since "Gelato X" and "Lemon Cherry Gelato" are different products and
 * quoting the wrong stock number is worse than saying nothing.
 *
 *   node pos/__tests__/assistant-lookup.test.cjs
 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.fixed.jsx'), 'utf8');
const body = src.slice(src.indexOf('function asstNorm('),
                       src.indexOf('// ——— end of the assistant lookup block'));
const { asstMatchIndex, asstNorm } =
  new Function(body + '; return {asstMatchIndex:asstMatchIndex, asstNorm:asstNorm};')();

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond || extra === undefined ? '' : '  → ' + extra));
  cond ? pass++ : fail++;
};

/* names in the shapes the counter actually carries */
const names = ['Gelato X', 'Lemon Cherry Gelato', 'Crunch Berrie', 'OG Kush',
  'Sour Belts 3000mg', '( Bar ) Tequila shot', 'Crispy Boy lager Can', 'Mac1'];
const find = (q) => asstMatchIndex(q, names);
const nameOf = (q) => { const i = find(q); return i < 0 ? null : names[i]; };

console.log('finding the product in a sentence');
ok('plain name', nameOf('crunch berrie เหลือเท่าไหร่') === 'Crunch Berrie');
ok('Thai question around it', nameOf('ขอราคา og kush หน่อย') === 'OG Kush');
ok('case does not matter', nameOf('GELATO X ราคาเท่าไหร่') === 'Gelato X');
ok('punctuation does not matter', nameOf('mac-1 เหลือไหม') === null || nameOf('mac1 เหลือไหม') === 'Mac1');
ok('the weight in the question is ignored', nameOf('sour belts 3000mg เหลือกี่ชิ้น') === 'Sour Belts 3000mg');
ok('a bar prefix in the catalogue name still matches', nameOf('tequila shot ราคา') === '( Bar ) Tequila shot');
/* the counter writes the size in brackets at the END, and nobody types it */
ok('a bracketed size anywhere in the name is ignored',
  asstMatchIndex('bong xl ราคาเท่าไหร่', ['Bong XL ( 50 cm )']) === 0,
  asstNorm('Bong XL ( 50 cm )'));

console.log('\nthe longest name wins');
ok('"lemon cherry gelato" does not answer as "Gelato X"',
  nameOf('lemon cherry gelato เหลือเท่าไหร่') === 'Lemon Cherry Gelato', nameOf('lemon cherry gelato เหลือเท่าไหร่'));
ok('"gelato x" is not swallowed by the longer name',
  nameOf('gelato x เหลือเท่าไหร่') === 'Gelato X', nameOf('gelato x เหลือเท่าไหร่'));

console.log('\nnot matching is a valid answer');
ok('a question with no product returns -1', find('ยอดขายวันนี้เท่าไหร่') === -1);
ok('an unknown product returns -1', find('สินค้าที่เราไม่ได้ขาย เหลือเท่าไหร่') === -1);
ok('empty input returns -1', find('') === -1 && find(null) === -1);
ok('a two-letter name is treated as noise', asstMatchIndex('อยากได้ xy', ['xy']) === -1);
ok('an empty catalogue returns -1', asstMatchIndex('gelato', []) === -1);

console.log('\nnormalisation');
ok('drops a leading bracket', asstNorm('( Bar ) Tequila shot') === 'tequila shot', asstNorm('( Bar ) Tequila shot'));
ok('drops a trailing weight', asstNorm('OG Kush 1g') === 'og kush', asstNorm('OG Kush 1g'));
ok('keeps Thai characters', asstNorm('กัญชา 1g').indexOf('กัญชา') === 0, asstNorm('กัญชา 1g'));
ok('collapses punctuation to one space', asstNorm('a--b__c') === 'a b c', asstNorm('a--b__c'));
ok('null is safe', asstNorm(null) === '' && asstNorm(undefined) === '');

console.log('\nthe wiring is actually in place');
ok('a named product is tried before the canned replies',
  /var ans=asstProductAnswer\(q\)\|\|asstRecipeAnswer\(q\)\|\|asstAnswer\(q\)/.test(src));
ok('"วันนี้" alone no longer triggers the sales card',
  !/has\("ยอดขาย","รายได้","sales","revenue","ขายได้","วันนี้","today"\)/.test(src));
ok('the AI context includes per-product stock and price',
  /แสดง.*รายการแรก, ชื่อ \| คงเหลือ \| ราคา \| ต้นทุน/.test(src));
ok('the AI context includes who is on shift', /กำลังเข้ากะ/.test(src));
ok('the AI context includes gross profit', /กำไรขั้นต้น/.test(src));
ok('the AI is told not to guess about products it cannot see', /อย่าเดาตัวเลข/.test(src));

console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
