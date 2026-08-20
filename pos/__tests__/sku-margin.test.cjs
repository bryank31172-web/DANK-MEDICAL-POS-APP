/* Reads skuMarginRows out of app.fixed.jsx.
 *
 * The old sales export built its rows from the transaction list, so a product
 * that sold nothing simply was not in the file — and it read cost straight off
 * p.cost, so every StoreHub product with no cost recorded exported as a 100%
 * margin. Both are checked here, because both looked fine on screen.
 *
 *   node pos/__tests__/sku-margin.test.cjs
 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.fixed.jsx'), 'utf8');
const body = src.slice(src.indexOf('function skuMarginRows('),
                       src.indexOf('// ——— end of the SKU margin block'));
const { skuMarginRows } = new Function(body + '; return {skuMarginRows:skuMarginRows};')();

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond || extra === undefined ? '' : '  → ' + extra));
  cond ? pass++ : fail++;
};

const products = [
  { id: 'a', name: 'Gelato X', cat: 'Exotics', unit: 'g', price: 800, cost: 400 },
  { id: 'b', name: 'Crunch Berrie', cat: 'Exotics', unit: 'g', price: 800, cost: 0 },   // no cost in StoreHub
  { id: 'c', name: 'Dusty Shelf', cat: 'Merch', unit: 'pc', price: 500, cost: 250 },     // never sells
  { id: 'd', name: 'Bar Shot', cat: 'Beer', unit: 'pc', price: 200, cost: 190 },         // thin
  { id: 'e', name: 'Bad Cost', cat: 'Beer', unit: 'pc', price: 100, cost: 150 },         // cost above price
  { id: 'f', name: 'No Price', cat: 'Merch', unit: 'pc', price: 0, cost: 0 },
  { id: 'g', name: 'Sold Too Cheap', cat: 'Beer', unit: 'pc', price: 300, cost: 250 },    // real cost, sold under it
];
const txs = [
  { transactionTime: '2026-08-01T10:00', items: [
    { productId: 'a', quantity: 2, total: 1600 },
    { productId: 'b', quantity: 1, total: 800 },
    { productId: 'd', quantity: 1, total: 200 },
    { productId: 'e', quantity: 1, total: 100 },
    { productId: 'g', quantity: 1, total: 200 },   // 200 against a 250 cost
  ] },
  { transactionTime: '2026-08-02T10:00', items: [
    { productId: 'a', quantity: 1, total: 400 },   // half price, well under the 10% rule
  ] },
  { transactionTime: '2026-08-03T10:00', status: 'Voided', items: [
    { productId: 'a', quantity: 9, total: 7200 },  // must not count
  ] },
];
/* the estimate-aware lookup the app hands over: 50% of price when cost is missing */
const costOf = (p) => (+p.cost > 0 && +p.cost <= +p.price ? +p.cost : Math.round((+p.price || 0) * 0.5));

const { rows, totals } = skuMarginRows(products, txs, costOf);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

console.log('every SKU is present');
ok('a product that never sold is still a row', !!byId.c);
ok('all seven products are in the table', rows.length === 7, rows.length);
ok('rows are ordered by revenue', rows[0].id === 'a', rows.map((r) => r.id).join(','));

console.log('\nthe numbers');
ok('avg selling price is revenue over units', byId.a.avgPrice === Math.round(2000 / 3), byId.a.avgPrice);
ok('a voided sale is excluded', byId.a.units === 3, byId.a.units);
ok('margin in baht is avg price minus cost', byId.a.marginBaht === Math.round(2000 / 3) - 400, byId.a.marginBaht);
ok('margin % is against the selling price', byId.a.marginPct === 40, byId.a.marginPct);
ok('profit is revenue minus cogs', byId.a.profit === 2000 - 1200, byId.a.profit);
ok('an unsold product is judged on its list price', byId.c.marginBaht === 250, byId.c.marginBaht);
ok('percentages of sales sum to about 100', Math.abs(rows.reduce((s, r) => s + r.pctOfSales, 0) - 100) < 0.5);

console.log('\nthe missing-cost trap');
ok('a product with no cost does NOT report 100% margin', byId.b.marginPct !== 100, byId.b.marginPct);
ok('it uses the estimate it was given', byId.b.cost === 400, byId.b.cost);
ok('and it says the cost is estimated', byId.b.costEstimated === true);
ok('a real cost is not marked estimated', byId.a.costEstimated === false);
ok('a cost above the price counts as unusable', byId.e.costEstimated === true, byId.e.cost);

console.log('\nwhat needs attention');
const has = (id, flag) => byId[id].issues.indexOf(flag) >= 0;
ok('the unsold product is flagged never-sold', has('c', 'never-sold'));
ok('the 5% item is flagged thin', has('d', 'thin'), byId.d.marginPct);
ok('an item sold below a real cost is flagged loss', has('g', 'loss'), byId.g.marginBaht);
ok('a loss is not also called thin', !has('g', 'thin'));
ok('an impossible cost is replaced, not reported as a loss', !has('e', 'loss') && byId.e.cost === 50, byId.e.cost);
ok('the discounted item is flagged', has('a', 'discounted'), byId.a.avgPrice);
ok('a priceless item is flagged no-price', has('f', 'no-price'));
ok('a healthy sale carries no loss/thin flag', !has('a', 'loss') && !has('a', 'thin'));

console.log('\nthe summary');
ok('counts the catalogue, not just what sold', totals.products === 7, totals.products);
ok('counts what sold', totals.sold === 5, totals.sold);
ok('counts what did not', totals.neverSold === 2, totals.neverSold);
ok('totals the revenue', totals.revenue === 3300, totals.revenue);
ok('reports a blended margin', totals.marginPct > 0 && totals.marginPct < 100, totals.marginPct);
ok('reports how much of it rests on real costs', totals.trust > 0 && totals.trust < 100, totals.trust + '%');
ok('counts the rows needing a real cost', totals.estimatedCost === 3, totals.estimatedCost);

console.log('\nedge cases');
const empty = skuMarginRows([], [], costOf);
ok('no products is not a crash', empty.rows.length === 0 && empty.totals.revenue === 0);
ok('no sales is not a crash', skuMarginRows(products, [], costOf).totals.sold === 0);
ok('junk entries are skipped', skuMarginRows([null, products[0]], [null, {}], costOf).rows.length === 1);
ok('a sale of an unknown product does not invent a row',
  skuMarginRows([products[0]], [{ transactionTime: '2026-08-01', items: [{ productId: 'zz', quantity: 1, total: 9 }] }], costOf).rows.length === 1);
const scoped = skuMarginRows(products, txs, costOf, { inPeriod: (d) => d === '2026-08-02' });
ok('the period filter is honoured', scoped.rows.find((r) => r.id === 'a').units === 1, scoped.totals.revenue);

console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
