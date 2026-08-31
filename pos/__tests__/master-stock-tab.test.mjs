/* The Master Stock Report tab, driven the way Amoe drives it.
 *
 * The engine is unit-tested in master-stock.test.cjs; this checks the part that
 * can only break in a browser — that the tab renders the rollup, that a shift
 * which never counted is named on screen rather than quietly averaged away,
 * that submitting writes a record and an audit line, and that the printed
 * sheet carries the same numbers.
 *
 *   bash pos/build.sh
 *   python3 -m http.server 8799 &      # from the REPO ROOT
 *   node pos/__tests__/master-stock-tab.test.mjs
 */
import { chromium } from './_playwright.mjs';

const errs = [], fails = [];
const ok = (n, c, x) => {
  console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || x === undefined ? '' : '  → ' + String(x).slice(0, 200)));
  if (!c) fails.push(n);
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
p.on('pageerror', (e) => errs.push(e.message.slice(0, 180)));
await p.goto('http://127.0.0.1:8799/pos/testrun/test2.html');
await p.waitForTimeout(2400);

/* Three shifts on one day: two counted, one closed without counting. The date
 * is fixed so the assertions are about the rollup, not about today. */
const DAY = '2026-08-20';
await p.evaluate((day) => {
  const at = (h) => new Date(Date.UTC(2026, 7, 20, h - 7)).toISOString();   /* h = Bangkok hour */
  const row = (name, exp, meas, extra) => Object.assign(
    { id: 'sku-' + name, name, cat: 'Flowers', unit: 'g', expected: exp, measured: meas,
      cost: 100, price: 300, reason: '', note: '' }, extra || {});
  localStorage.setItem('dank_shifts', JSON.stringify([
    { id: 9001, staffId: 'amoe', staffName: 'Amoe', branch: 'Pattanakarn', slot: 'Shift 1 · Day',
      inAt: at(9), outAt: at(17), sales0: 0, salesDelta: 12000, openCheck: [],
      closeCheck: [row('OG Kush', 100, 96), row('Gelato', 50, 50)],
      report: { missG: 4, missCost: 400, missRetail: 1200, issues: '', cash: '' } },
    { id: 9002, staffId: 'dylan', staffName: 'Dylan', branch: 'Pattanakarn', slot: 'Shift 2 · Evening',
      inAt: at(17), outAt: at(22), sales0: 0, salesDelta: 8000, openCheck: [],
      closeCheck: [row('OG Kush', 96, 93, { reason: 'ตัวอย่างให้ลูกค้า' }), row('Gelato', 50, 48)],
      report: { missG: 5, missCost: 500, missRetail: 1500, issues: '', cash: '' } },
    { id: 9003, staffId: 'pond', staffName: 'Pond', branch: 'Pattanakarn', slot: 'Shift 3 · Night',
      inAt: at(22), outAt: new Date(Date.UTC(2026, 7, 21, 3)).toISOString(), sales0: 0, salesDelta: 3000,
      openCheck: [], closeCheck: [row('OG Kush', 93, ''), row('Gelato', 48, '')],
      report: { missG: 0, missCost: 0, missRetail: 0, issues: '', cash: '' } },
  ]));
}, DAY);
await p.reload();
await p.waitForTimeout(2400);

for (const d of '110114') await p.click(`button:has-text("${d}")`).catch(() => {});
await p.waitForTimeout(2000);
await p.evaluate(() => { const l = [...document.querySelectorAll('button')].find((x) => /ไว้ก่อน|Later/.test(x.innerText)); l && l.click(); });
await p.waitForTimeout(800);

const click = (t) => p.evaluate((s) => {
  const x = [...document.querySelectorAll('button')]
    .filter((y) => { const r = y.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .find((y) => y.innerText.replace(/\s+/g, ' ').indexOf(s) >= 0);
  if (!x) return null; x.click(); return x.innerText.replace(/\s+/g, ' ').trim().slice(0, 40);
}, t);
const body = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const setDate = (v) => p.evaluate((val) => {
  const el = [...document.querySelectorAll('input[type=date]')].filter((i) => i.getBoundingClientRect().width > 0)[0];
  if (!el) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, v);

console.log('the tab is reachable');
ok('Reports opens', !!(await click('📑 รายงาน')));
await p.waitForTimeout(1100);
ok('Master Stock is in the Reports sub-nav', !!(await click('📦 Master Stock')));
await p.waitForTimeout(1200);
let t = await body();
ok('the screen renders', /รายงานสต๊อกรวม/.test(t));
ok('it names who owes the report', /ผู้รับผิดชอบ[\s\S]{0,20}Amoe/.test(t), (/ผู้รับผิดชอบ.{0,30}/.exec(t) || [''])[0]);
ok('the three periods are offered', /รายวัน/.test(t) && /รายสัปดาห์/.test(t) && /รายเดือน/.test(t));

console.log('\nthe daily rollup, across all three shifts');
ok('the date can be set', await setDate(DAY));
await p.waitForTimeout(1000);
t = await body();
ok('all three closed shifts are in the period', /กะที่ปิด · shifts 3|3 กะที่ปิด/.test(t) || /กะที่ปิด[\s\S]{0,20}3/.test(t),
   (/กะที่ปิด.{0,24}/.exec(t) || [''])[0]);
ok('only two of them reported a count', /2 \/ 3/.test(t), (/\d \/ \d[^·]{0,20}/.exec(t) || [''])[0]);
ok('coverage is stated as a percentage, not implied', /66\.7%|67%/.test(t), (/\(\d+[.\d]*%\)/.exec(t) || [''])[0]);

console.log('\nthe shift that never counted is named, not averaged away');
ok('the missing block appears', /ยังไม่ส่งผลนับ/.test(t));
ok('…naming the person', /Pond/.test(t));
ok('…and their slot', /Shift 3/.test(t));
ok('…and it warns the totals are partial', /ตัวเลขข้างบนคิดจาก/.test(t));

/* Amoe: OG Kush −4 (no reason). Dylan: OG Kush −3 (reason), Gelato −2 (no
 * reason). So 9g short in total, of which 6g was closed with no reason. Each
 * assertion is anchored to its own label — a bare /9g/ passes on any number
 * ending in 9 somewhere else on the screen. */
console.log('\nshort and over are kept apart, and money is attached');
ok('OG Kush is one row across both shifts', (t.match(/OG Kush/g) || []).length >= 1);
ok('the total short is 9g across the three rows, not netted',
   /ของขาด · short 9g/.test(t), (/ของขาด · short \S+/.exec(t) || [''])[0]);
ok('nothing was over, so over reads 0', /ของเกิน · over 0g/.test(t), (/ของเกิน · over \S+/.exec(t) || [''])[0]);
ok('the short is valued at cost', /มูลค่าที่ขาด \(ทุน\) ฿900/.test(t), (/มูลค่าที่ขาด[^฿]*฿\S+/.exec(t) || [''])[0]);
ok('…and at retail, which is the bigger number', /ถ้าขายได้ \(ราคาขาย\) ฿2,700/.test(t),
   (/ถ้าขายได้[^฿]*฿\S+/.exec(t) || [''])[0]);
ok('unexplained is separated from explained', /ขาดโดยไม่มีเหตุผล/.test(t));
ok('…and it is 6g, not all 9g — Dylan wrote a reason on one of his',
   /ขาดโดยไม่มีเหตุผล \S*6g/.test(t), (/ขาดโดยไม่มีเหตุผล \S+/.exec(t) || [''])[0]);
ok('the reason given is shown against the SKU', /ตัวอย่างให้ลูกค้า/.test(t));
ok('the per-staff table attributes it', /รายคน · by staff/.test(t) && /Dylan/.test(t) && /Amoe/.test(t));
ok('the per-shift table lets a number be traced back', /รายกะ · by shift/.test(t));

console.log('\nweekly and monthly roll the same data up');
ok('weekly switches', !!(await click('รายสัปดาห์')));
await p.waitForTimeout(1000);
t = await body();
ok('…and shows a date range, not one date', /2026-08-\d\d → 2026-08-\d\d/.test(t), (/2026-08-\d\d → 2026-08-\d\d/.exec(t) || [''])[0]);
ok('…still finding the three shifts', /2 \/ 3/.test(t));
ok('monthly switches', !!(await click('รายเดือน')));
await p.waitForTimeout(1000);
t = await body();
ok('…and labels the month', /2026-08/.test(t));
ok('back to daily', !!(await click('รายวัน')));
await p.waitForTimeout(900);

console.log('\nsubmitting is a signature, and it is recorded');
const before = await p.evaluate(() => localStorage.getItem('dank_stock_reports'));
ok('nothing is submitted yet', !before || before === '[]', String(before).slice(0, 40));
t = await body();
ok('the submit button warns that counts are missing', /ส่งได้ แต่รายงานจะถูกบันทึกว่าครบแค่/.test(t));
ok('submit clicks', !!(await click('📤 ส่งรายงาน · Submit')));
await p.waitForTimeout(1100);
const after = await p.evaluate(() => JSON.parse(localStorage.getItem('dank_stock_reports') || '[]'));
ok('a submission is stored', after.length === 1, after.length);
ok('…carrying the numbers as they stood at submission',
   after[0] && after[0].snapshot && after[0].snapshot.short === 9 && after[0].snapshot.shortCost === 900
   && after[0].snapshot.unexplained === 6,
   JSON.stringify(after[0] && after[0].snapshot));
ok('…and the coverage it was signed at, so a partial report cannot pass as complete',
   after[0] && after[0].snapshot.coverage < 100 && after[0].snapshot.missing === 1,
   after[0] && after[0].snapshot.coverage);
ok('…and the missing shifts travel with it',
   after[0] && (after[0].missing || []).some((m) => m.staff === 'Pond'));
const audit = await p.evaluate(() => localStorage.getItem('dank_audit') || '');
ok('the submission is in the audit log', /STOCK_REPORT_SUBMIT/.test(audit));
t = await body();
ok('the screen flips to submitted', /ส่งรายงานแล้ว/.test(t));
ok('…and says who signed it', /โดย/.test(t));
ok('it appears in the history list', /ที่ส่งไปแล้ว/.test(t));
ok('a submission can be withdrawn to fix and resend', !!(await click('↩ ยกเลิกการส่ง')));
await p.waitForTimeout(900);
ok('…and the store is emptied again',
   (await p.evaluate(() => JSON.parse(localStorage.getItem('dank_stock_reports') || '[]'))).length === 0);

console.log('\nthe printed sheet carries the same report');
await p.evaluate(() => {
  window.__printed = '';
  window.open = () => ({ document: { write: (h) => { window.__printed += h; }, close() {} }, focus() {}, print() {} });
});
ok('print clicks', !!(await click('🖨 พิมพ์ / PDF')));
await p.waitForTimeout(800);
const sheet = await p.evaluate(() => window.__printed || '');
ok('something was written', sheet.length > 1500, sheet.length + ' bytes');
ok('it is titled as the master stock report', /MASTER STOCK REPORT/.test(sheet));
ok('the shifts that did not report come BEFORE the totals — a signature has to be informed',
   sheet.indexOf('DID NOT REPORT') > 0 && sheet.indexOf('DID NOT REPORT') < sheet.indexOf('>TOTALS<'),
   sheet.indexOf('DID NOT REPORT') + ' vs ' + sheet.indexOf('>TOTALS<'));
ok('…naming Pond', /Pond/.test(sheet));
ok('coverage is printed', /COVERAGE/.test(sheet));
ok('short and over are separate columns', /<th>SHORT<\/th>/.test(sheet) && /<th>OVER<\/th>/.test(sheet));
ok('the money is on the page', sheet.indexOf('SHORT AT COST</span><b>THB 900</b>') >= 0,
   (/SHORT AT COST<\/span><b>[^<]*/.exec(sheet) || [''])[0]);
ok('there is a signature block', /PREPARED BY/.test(sheet) && /CHECKED BY/.test(sheet));
ok('nothing prints as NaN or undefined', !/NaN|undefined/.test(sheet),
   (/.{40}(NaN|undefined).{40}/.exec(sheet) || ['clean'])[0]);

console.log('\nan empty period is an empty period, not a crash');
await setDate('2026-01-05');
await p.waitForTimeout(1000);
t = await body();
ok('the tab still renders with no shifts', /รายงานสต๊อกรวม/.test(t));
ok('…and refuses to submit nothing', !!(await click('📤 ส่งรายงาน · Submit')));
await p.waitForTimeout(700);
ok('…leaving nothing stored',
   (await p.evaluate(() => JSON.parse(localStorage.getItem('dank_stock_reports') || '[]'))).length === 0);

console.log('\nPAGE ERRORS: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${fails.length || errs.length ? 'FAIL' : 'PASS'} — ${fails.length} failed, ${errs.length} page errors`);
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
