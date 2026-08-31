/* The master stock report, off real shift records.
 *
 *   node pos/__tests__/master-stock.test.cjs
 *
 * The engine is lifted out of app.fixed.jsx between its sentinel comments, the
 * same way roster.test.cjs does it — so this tests the shipped code, not a copy.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app.fixed.jsx'), 'utf8');
const START = '// ——— master stock report block';
const END = '// ——— end of the master stock report block';
const a = src.indexOf(START), b = src.indexOf(END);
if (a < 0 || b < 0) { console.error('sentinels missing — did someone rename the block?'); process.exit(1); }
const body = src.slice(a, b) + '\nreturn { masterStockReport, stockReportFlags, stockRowsOf, stockPeriodRange, stockWeekStart, stockDateKey, stockPeriodLabel };';
const M = new Function(body)();

let pass = 0; const fails = [];
const ok = (n, c, x) => {
  if (c) { pass++; console.log('  ✓ ' + n); }
  else { fails.push(n); console.log('  ✗ ' + n + (x === undefined ? '' : '  → ' + String(x).slice(0, 200))); }
};
const near = (a2, b2, eps) => Math.abs(a2 - b2) < (eps || 0.011);

/* ── a shift factory that looks like what clockOut actually writes ───────── */
let nextId = 1;
const row = (name, expected, measured, opt) => Object.assign(
  { id: 'sku-' + name, name: name, cat: 'Flowers', unit: 'g', expected: expected,
    measured: measured, cost: 100, price: 300, reason: '', note: '' }, opt || {});
const shift = (dateISO, staff, slot, rows, opt) => Object.assign({
  id: nextId++, staffId: staff.toLowerCase(), staffName: staff, branch: 'Pattanakarn',
  slot: slot, inAt: dateISO, outAt: new Date(new Date(dateISO).getTime() + 8 * 3600e3).toISOString(),
  sales0: 0, salesDelta: 5000,
  openCheck: [], closeCheck: rows, report: { missG: 0, missCost: 0, missRetail: 0, issues: '' },
}, opt || {});

console.log('\nthe period window');
ok('a daily period is one day', (() => { const r = M.stockPeriodRange('daily', '2026-09-14'); return r.from === '2026-09-14' && r.to === '2026-09-14'; })());
ok('a week starts on Monday, not Sunday', M.stockWeekStart('2026-09-14') === '2026-09-14', M.stockWeekStart('2026-09-14'));
ok('…so a Sunday belongs to the week that began the Monday before',
   M.stockWeekStart('2026-09-20') === '2026-09-14', M.stockWeekStart('2026-09-20'));
ok('a weekly period is Mon→Sun inclusive', (() => { const r = M.stockPeriodRange('weekly', '2026-09-17'); return r.from === '2026-09-14' && r.to === '2026-09-20'; })(),
   JSON.stringify(M.stockPeriodRange('weekly', '2026-09-17')));
ok('a monthly period runs to the real last day', (() => { const r = M.stockPeriodRange('monthly', '2026-09-17'); return r.from === '2026-09-01' && r.to === '2026-09-30'; })(),
   JSON.stringify(M.stockPeriodRange('monthly', '2026-09-17')));
ok('…and February is not given 30 days', M.stockPeriodRange('monthly', '2026-02-10').to === '2026-02-28',
   M.stockPeriodRange('monthly', '2026-02-10').to);
ok('an unknown period falls back to daily rather than throwing', M.stockPeriodRange('yearly', '2026-09-14').from === '2026-09-14');
ok('the day key is the shop day, not UTC — 23:30 Bangkok is still that day',
   M.stockDateKey('2026-09-14T16:30:00.000Z') === '2026-09-14', M.stockDateKey('2026-09-14T16:30:00.000Z'));

console.log('\nshort and over are not netted against each other');
{
  const s = shift('2026-09-14T02:00:00.000Z', 'Amoe', 'Shift 1 · Day', [
    row('OG Kush', 100, 95),      /* 5 short */
    row('Lemon Haze', 50, 55),    /* 5 over  */
  ]);
  const rep = M.masterStockReport([s], 'daily', '2026-09-14');
  ok('the short is counted', near(rep.totals.short, 5), rep.totals.short);
  ok('the over is counted', near(rep.totals.over, 5), rep.totals.over);
  ok('…and they do not cancel to zero', rep.totals.short > 0 && rep.totals.over > 0);
  ok('the short is priced at cost and at retail',
     rep.totals.shortCost === 500 && rep.totals.shortRetail === 1500,
     rep.totals.shortCost + ' / ' + rep.totals.shortRetail);
  ok('the over carries no money — it is a miscount, not stock found',
     rep.skus.filter((x) => x.name === 'Lemon Haze')[0].shortCost === 0);
}

console.log('\na shift that closed without counting is named, not dropped');
{
  const good = shift('2026-09-14T02:00:00.000Z', 'Amoe', 'Shift 1 · Day', [row('OG Kush', 100, 98)]);
  const lazy = shift('2026-09-14T10:00:00.000Z', 'Dylan', 'Shift 2 · Evening', [row('OG Kush', 98, '')]);
  /* 14:00Z is 21:00 in Bangkok — still the 14th, so it belongs to this day */
  const openOne = shift('2026-09-14T14:00:00.000Z', 'Pond', 'Shift 3 · Night', [row('OG Kush', 98, '')], { outAt: null });
  const rep = M.masterStockReport([good, lazy, openOne], 'daily', '2026-09-14');
  ok('the uncounted shift is reported missing', rep.totals.missing === 2, rep.totals.missing);
  ok('…by the name of whoever stood it',
     rep.missing.some((m) => m.staff === 'Dylan') && rep.missing.some((m) => m.staff === 'Pond'),
     JSON.stringify(rep.missing.map((m) => m.staff)));
  ok('…and says which failure it was',
     /without entering counts/.test(rep.missing.filter((m) => m.staff === 'Dylan')[0].why)
     && /never clocked out/.test(rep.missing.filter((m) => m.staff === 'Pond')[0].why));
  ok('a missing count is not treated as a zero variance', rep.totals.short === 2, rep.totals.short);
  ok('coverage says what share of the period actually reported',
     rep.totals.coverage === 50, rep.totals.coverage);
  ok('the flags lead with the hole, not with the total',
     /closed without a stock count/.test(M.stockReportFlags(rep)[0].text), M.stockReportFlags(rep)[0].text);
}

console.log('\nunexplained shortage is separated from explained');
{
  const a2 = shift('2026-09-14T02:00:00.000Z', 'Amoe', 'Shift 1 · Day', [
    row('OG Kush', 100, 96, { reason: 'ตัวอย่างให้ลูกค้าดม' }),   /* 4 short, explained */
    row('Gelato', 40, 37),                                        /* 3 short, no reason */
  ]);
  const rep = M.masterStockReport([a2], 'daily', '2026-09-14');
  ok('total short counts both', near(rep.totals.short, 7), rep.totals.short);
  ok('only the one with no reason is unexplained', near(rep.totals.unexplained, 3), rep.totals.unexplained);
  ok('the reason given is kept against the SKU',
     rep.skus.filter((s) => s.name === 'OG Kush')[0].reasons['ตัวอย่างให้ลูกค้าดม'] === 4);
  ok('an explained short is not flagged as unexplained on its SKU',
     rep.skus.filter((s) => s.name === 'OG Kush')[0].unexplained === 0);
}

console.log('\nrolling up across shifts is the whole point');
{
  const all = [
    shift('2026-09-14T02:00:00.000Z', 'Amoe', 'Shift 1 · Day', [row('OG Kush', 100, 98), row('Gelato', 50, 50)]),
    shift('2026-09-14T10:00:00.000Z', 'Dylan', 'Shift 2 · Evening', [row('OG Kush', 98, 96), row('Gelato', 50, 49)]),
    shift('2026-09-15T02:00:00.000Z', 'Pond', 'Shift 1 · Day', [row('OG Kush', 96, 93), row('Gelato', 49, 49)]),
  ];
  const day = M.masterStockReport(all, 'daily', '2026-09-14');
  ok('a daily report only takes that day', day.totals.shifts === 2, day.totals.shifts);
  ok('…and sums the SKU across the shifts in it',
     near(day.skus.filter((s) => s.name === 'OG Kush')[0].short, 4),
     day.skus.filter((s) => s.name === 'OG Kush')[0].short);

  const week = M.masterStockReport(all, 'weekly', '2026-09-15');
  ok('a weekly report picks up all three shifts', week.totals.shifts === 3, week.totals.shifts);
  ok('…and OG Kush is one row, not three', week.skus.filter((s) => s.name === 'OG Kush').length === 1);
  ok('…carrying the total short across the week',
     near(week.skus.filter((s) => s.name === 'OG Kush')[0].short, 7),
     week.skus.filter((s) => s.name === 'OG Kush')[0].short);
  ok('…and the number of separate shifts it was short on',
     week.skus.filter((s) => s.name === 'OG Kush')[0].shiftsShort === 3);
  ok('the worst single occurrence names the date and the person',
     week.skus.filter((s) => s.name === 'OG Kush')[0].worst.staff === 'Pond'
     && week.skus.filter((s) => s.name === 'OG Kush')[0].worst.date === '2026-09-15',
     JSON.stringify(week.skus.filter((s) => s.name === 'OG Kush')[0].worst));
  ok('SKUs are ordered by what they cost, worst first',
     week.skus[0].name === 'OG Kush', week.skus.map((s) => s.name).join(','));
  ok('a repeat offender is flagged as a pattern',
     M.stockReportFlags(week).some((f) => /pattern/.test(f.text)));

  const month = M.masterStockReport(all, 'monthly', '2026-09-30');
  ok('a monthly report anchored on any day in the month sees them all', month.totals.shifts === 3);
}

console.log('\nper person, because a variance belongs to whoever counted it');
{
  const all = [
    shift('2026-09-14T02:00:00.000Z', 'Amoe', 'Shift 1 · Day', [row('OG Kush', 100, 100)]),
    shift('2026-09-14T10:00:00.000Z', 'Dylan', 'Shift 2 · Evening', [row('OG Kush', 100, 90)]),
  ];
  const rep = M.masterStockReport(all, 'daily', '2026-09-14');
  ok('both people appear', rep.byStaff.length === 2, rep.byStaff.map((s) => s.staff).join(','));
  ok('the one who lost stock is first', rep.byStaff[0].staff === 'Dylan');
  ok('…with the money against their name', rep.byStaff[0].shortCost === 1000, rep.byStaff[0].shortCost);
  ok('an exact count is not punished', rep.byStaff[1].short === 0);
}

console.log('\nfiltering by shop');
{
  const all = [
    shift('2026-09-14T02:00:00.000Z', 'Amoe', 'Shift 1 · Day', [row('OG Kush', 100, 95)]),
    shift('2026-09-14T02:00:00.000Z', 'Raizo', 'Shift 1 · Day', [row('OG Kush', 100, 99)], { branch: 'Sathorn' }),
  ];
  ok('all branches by default', M.masterStockReport(all, 'daily', '2026-09-14').totals.shifts === 2);
  ok('one branch when asked', M.masterStockReport(all, 'daily', '2026-09-14', 'Sathorn').totals.shifts === 1);
  ok('…and it is the right one',
     near(M.masterStockReport(all, 'daily', '2026-09-14', 'Sathorn').totals.short, 1));
  ok('"all" is not treated as a branch name', M.masterStockReport(all, 'daily', '2026-09-14', 'all').totals.shifts === 2);
}

console.log('\nit does not invent problems, and it does not throw');
{
  const clean = M.masterStockReport([
    shift('2026-09-14T02:00:00.000Z', 'Amoe', 'Shift 1 · Day', [row('OG Kush', 100, 100)]),
  ], 'daily', '2026-09-14');
  const flags = M.stockReportFlags(clean);
  ok('a clean day says so in one line', flags.length === 1 && flags[0].level === 'ok', JSON.stringify(flags));
  ok('coverage is 100 when everyone counted', clean.totals.coverage === 100);

  const empty = M.masterStockReport([], 'weekly', '2026-09-14');
  ok('an empty period returns a report rather than throwing', !!empty && empty.totals.shifts === 0);
  ok('…with no divide-by-zero in coverage', empty.totals.coverage === 0);
  ok('…and no flags invented for it', M.stockReportFlags(empty).length === 0);
  ok('null input is survivable', !!M.masterStockReport(null, 'daily', '2026-09-14'));
  ok('a shift with no closeCheck at all does not crash',
     M.masterStockReport([shift('2026-09-14T02:00:00.000Z', 'X', 'S', null)], 'daily', '2026-09-14').totals.missing === 1);
  ok('a row with a missing cost does not produce NaN money',
     !isNaN(M.masterStockReport([shift('2026-09-14T02:00:00.000Z', 'X', 'S',
       [row('Y', 10, 5, { cost: undefined, price: undefined })])], 'daily', '2026-09-14').totals.shortCost));
}

console.log(`\n${fails.length ? 'FAIL' : 'PASS'} — ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log('   ✗ ' + f)); process.exit(1); }
