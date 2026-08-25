/* The Working Shifts tab, driven the way a manager drives it.
 *
 * The engine is unit-tested in roster.test.cjs; this checks the part that can
 * only break in a browser — that the tab renders the month, that a draft is
 * NOT saved until it is approved (the owner asked for that explicitly), that
 * the split cover prints both names, and that the assistant answers.
 *
 *   bash pos/build.sh
 *   python3 -m http.server 8799 &      # from the REPO ROOT
 *   node pos/__tests__/workshifts.test.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const errs = [], fails = [];
const ok = (n, c, x) => {
  console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || x === undefined ? '' : '  → ' + String(x).slice(0, 160)));
  if (!c) fails.push(n);
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
await p.goto('http://127.0.0.1:8799/pos/testrun/test2.html');
await p.waitForTimeout(2400);
for (const d of '110114') await p.click(`button:has-text("${d}")`).catch(() => {});
await p.waitForTimeout(2000);
await p.evaluate(() => { const l = [...document.querySelectorAll('button')].find((x) => /ไว้ก่อน|Later/.test(x.innerText)); l && l.click(); });
await p.waitForTimeout(700);

const click = (t) => p.evaluate((s) => {
  const x = [...document.querySelectorAll('button')]
    .filter((y) => { const r = y.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .find((y) => y.innerText.replace(/\s+/g, ' ').indexOf(s) >= 0);
  if (!x) return null; x.click(); return x.innerText.replace(/\s+/g, ' ').trim().slice(0, 40);
}, t);
const body = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

console.log('the tab opens');
ok('the Shifts tab is in the bar', !!(await click('กะทำงาน Shifts')), 'clicked');
await p.waitForTimeout(1200);
let t = await body();
ok('it shows the empty state before anything is generated', /ยังไม่มีตารางของ/.test(t));
ok('and explains that nothing is saved until approval', /จะยังไม่ถูกบันทึกจนกว่าจะกดอนุมัติ/.test(t));

console.log('\ngenerating a draft');
/* park on a month the seed roster was written for */
await p.evaluate(() => {
  const inp = [...document.querySelectorAll('button')];
  return inp.length;
});
ok('Generate is there', !!(await click('สร้างร่าง')), 'clicked');
await p.waitForTimeout(1600);
t = await body();
ok('the validation report appears', /รายงานตรวจสอบ/.test(t));
ok('it is marked as a draft', /ร่าง · ยังไม่อนุมัติ/.test(t));
ok('Approve only appears once there is a draft', /อนุมัติ Approve/.test(t));
ok('the monthly summary is rendered', /สรุปพนักงานรายเดือน/.test(t));
ok('the pay columns are there', /OT ฿/.test(t) && /รวมจ่าย/.test(t));
ok('the labour bill is totalled', /เงินเดือนรวม/.test(t) && /×1\.5/.test(t));

const counts = await p.evaluate(() => {
  const txt = document.body.innerText;
  const g = (re) => { const m = re.exec(txt); return m ? +m[1] : null; };
  return {
    empty: g(/(\d+)\s*กะที่ยังว่าง/) ?? g(/กะที่ยังว่าง[\s\S]{0,40}?(\d+)/),
    raw: txt.slice(txt.indexOf('รายงานตรวจสอบ'), txt.indexOf('รายงานตรวจสอบ') + 320).replace(/\s+/g, ' '),
  };
});
ok('the report is legible', !!counts.raw, counts.raw);

console.log('\nnothing is saved until it is approved');
const beforeApprove = await p.evaluate(() => localStorage.getItem('dank_shift_roster'));
ok('localStorage has no roster yet', !beforeApprove || beforeApprove === '{}', String(beforeApprove).slice(0, 60));
ok('Approve clicks', !!(await click('อนุมัติ Approve')));
await p.waitForTimeout(1200);
const afterApprove = await p.evaluate(() => localStorage.getItem('dank_shift_roster'));
ok('now it is saved', !!afterApprove && afterApprove.length > 100, String(afterApprove).length + ' bytes');
t = await body();
ok('and the badge flips to approved', /อนุมัติแล้ว/.test(t));

console.log('\nthe approval is written to the audit log');
const audit = await p.evaluate(() => localStorage.getItem('dank_audit') || '');
ok('SHIFT_ROSTER_APPROVED is in the audit log', /SHIFT_ROSTER_APPROVED/.test(audit));

console.log('\nthe split cover prints both names');
const split = await p.evaluate(() => {
  const book = JSON.parse(localStorage.getItem('dank_shift_roster') || '{}');
  const key = Object.keys(book)[0];
  if (!key) return null;
  const cells = book[key].cells;
  const shared = Object.keys(cells).filter((k) => cells[k] && cells[k].extra && cells[k].extra.length);
  return shared.length ? { n: shared.length, one: cells[shared[0]] } : { n: 0 };
});
ok('at least one night is shared by two windows', split && split.n > 0, split && split.n);
ok('…the first window starts the shift and the second finishes it',
   split && split.one && split.one.window === '17:00-21:00' && split.one.extra[0].window === '21:00-02:00',
   split && split.one && JSON.stringify(split.one));

console.log('\nthe assistant answers off the grid');
ok('the AI button is there', !!(await click('ถาม AI')));
await p.waitForTimeout(900);
ok('a preset question answers', !!(await click('ค่าแรงเดือนนี้เท่าไหร่')));
await p.waitForTimeout(900);
t = await body();
ok('the labour bill comes back with a baht figure', /ค่าแรงเดือนนี้[\s\S]{0,200}฿/.test(t));
ok('…and separates OT at 1.5x', /1\.5 เท่า/.test(t));
ok('a person can be asked about by name', await p.evaluate(() => {
  const el = [...document.querySelectorAll('input')].filter((i) => /ใครทำงาน 14\/9/.test(i.placeholder || ''))[0];
  if (!el) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(el, 'amoe'); el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}));
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].filter((y) => y.getBoundingClientRect().width > 0).find((y) => y.innerText.trim() === '➤'); x && x.click(); });
await p.waitForTimeout(800);
t = await body();
ok('…and the answer carries their real shift count', /Amoe[\s\S]{0,120}กะ/.test(t));

console.log('\nthe staff editor opens and holds the pay field');
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.innerText.trim() === '✕'); x && x.click(); });
await p.waitForTimeout(600);
ok('the staff button opens the editor', !!(await click('ตั้งค่าคน + เงินเดือน')));
await p.waitForTimeout(900);
t = await body();
ok('salary is editable', /เงินเดือน ฿/.test(t));
ok('so are the authorised shops and shifts', /กะที่ทำได้/.test(t) && /สาขา/.test(t));
ok('and the target/max caps', /เป้ากะ/.test(t) && /สูงสุด/.test(t));

console.log('\nPAGE ERRORS: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${fails.length || errs.length ? 'FAIL' : 'PASS'} — ${fails.length} failed, ${errs.length} page errors`);
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
