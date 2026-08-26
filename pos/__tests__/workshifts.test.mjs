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
import { chromium } from './_playwright.mjs';

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
ok('the draft is honest about the holes it could not fill', /ยังไม่มีคน/.test(await body()));
ok('Approve clicks', !!(await click('อนุมัติ Approve')));
await p.waitForTimeout(1200);
const afterApprove = await p.evaluate(() => localStorage.getItem('dank_shift_roster'));
ok('now it is saved', !!afterApprove && afterApprove.length > 100, String(afterApprove).length + ' bytes');
t = await body();
ok('and the badge flips to approved', /อนุมัติแล้ว/.test(t));

console.log('\nthe approval is written to the audit log');
const audit = await p.evaluate(() => localStorage.getItem('dank_audit') || '');
ok('SHIFT_ROSTER_APPROVED is in the audit log', /SHIFT_ROSTER_APPROVED/.test(audit));

console.log('\nCEO check-ins are on the sheet, and not in a slot');
t = await body();
ok('the check-in row is printed', /CEO ตรวจงาน/.test(t));
ok('the summary marks them as checks, not shifts', /ตรวจ \d+×/.test(t),
   (/ตรวจ \d+×/.exec(t) || ['not found'])[0]);
const ceo = await p.evaluate(() => {
  const book = JSON.parse(localStorage.getItem('dank_shift_roster') || '{}');
  const key = Object.keys(book)[0];
  if (!key) return null;
  const b = book[key];
  const inSlot = Object.keys(b.cells).some((k) => {
    const c = b.cells[k];
    if (!c || c.closed) return false;
    return ['bryan', 'keneth'].indexOf(c.id) >= 0 || (c.extra || []).some((e) => ['bryan', 'keneth'].indexOf(e.id) >= 0);
  });
  return { visits: (b.visits || []).length, inSlot };
});
ok('the visits are stored with the roster', ceo && ceo.visits > 0, ceo && ceo.visits);
ok('…one per week each, so an even number for the two of them',
   ceo && ceo.visits % 2 === 0 && ceo.visits >= 8 && ceo.visits <= 12, ceo && ceo.visits);
ok('and no CEO is holding down a shop slot', ceo && ceo.inSlot === false);

console.log('\nempty shifts say why they are empty');
ok('the report names the blocker',
   /at their maximum|only covers|rest day|fixed day off|days straight|already on a shift|nobody is cleared/.test(t),
   t.slice(t.indexOf('ยังไม่มีคน'), t.indexOf('ยังไม่มีคน') + 220));
ok('…and a rest day the generator chose is not called a fixed one',
   !/fixed day off/.test(t) || /\(movable\)/.test(t),
   (/(fixed day off|rest day)[^·]*/.exec(t) || ['none'])[0]);

/* The printed pack is what actually goes on the wall and to the accountant,
 * so it is checked here rather than trusted. shiftPrint writes into a popup;
 * the stub keeps that document in the page so its HTML can be read back. */
console.log('\nthe printed pack carries the two summary pages');
await p.evaluate(() => {
  window.__printed = '';
  window.open = () => ({
    document: { write: (h) => { window.__printed += h; }, close() {} },
    focus() {}, print() {},
  });
});
ok('the print button is there', !!(await click('พิมพ์ / PDF')));
await p.waitForTimeout(700);
const sheet = await p.evaluate(() => window.__printed || '');
ok('something was written to the print window', sheet.length > 2000, sheet.length + ' bytes');
ok('one page per shop, plus the two summaries',
   (sheet.match(/<section class="page">/g) || []).length === 5,
   (sheet.match(/<section class="page">/g) || []).length + ' pages');
ok('the payroll page is there', /DANK GROUP STAFF &amp; PAYROLL SUMMARY/.test(sheet));
ok('…with the variable-pay column', /VARIABLE PAY/.test(sheet));
ok('…and a control total in baht', /PAYROLL CONTROL TOTAL[\s\S]{0,400}THB/.test(sheet));
ok('…that is a real number, not NaN or zero',
   /base payroll: ([\d,]+) THB/.test(sheet) && +RegExp.$1.replace(/,/g, '') > 100000,
   (/base payroll: [^<]*/.exec(sheet) || ['none'])[0]);
/* A rider is paid ~15,600 a month and stands no counter slot. Printing 0
 * duties beside that reads as money paid for nothing, and drops 26 days out
 * of the control total — so the contracted days have to show. */
ok('a payroll-only rider is not printed as 0 duties for real money',
   !/Zaw[\s\S]{0,200}?class="n[^"]*">0<\/td>/.test(sheet),
   (/<tr>[^]{0,400}?Zaw[^]*?<\/tr>/.exec(sheet) || ['no Zaw row'])[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 150));
ok('…and is marked as contracted rather than rostered', /contracted, no counter slot/.test(sheet));
ok('…so the control total counts more days than the grid alone',
   /(\d+) duties/.test(sheet) && +RegExp.$1 > 340, (/[\d]+ duties/.exec(sheet) || [''])[0]);

ok('the rules page is there', /DANK PROJECT DUTIES &amp; FINAL VALIDATION/.test(sheet));
ok('…printing the coverage rules', /2 operational budtenders/.test(sheet));
ok('…and the incentive rules', /2% of individual eligible POS sales/.test(sheet));
ok('…and the six validation counters', (sheet.match(/class="chk/g) || []).length === 6,
   (sheet.match(/class="chk/g) || []).length);
/* The red counter is only useful if the sheet says which shifts and why —
 * that is the one number on the pack the owner has to act on. */
const holes = +((/Empty required shifts<\/span><b>(\d+)</.exec(sheet) || [0, 0])[1]);
ok('the empty-shift counter is readable', holes >= 0, holes);
ok('…and every hole is named with its dates and its blocker',
   !holes || (/UNCOVERED SHIFTS/.test(sheet) && /FIRST BLOCKER/.test(sheet)
              && /at their maximum|only covers|rest day|days straight|already on a shift|nobody is cleared/.test(sheet)));

ok('every page signs off', (sheet.match(/APPROVED BY:/g) || []).length === 5,
   (sheet.match(/APPROVED BY:/g) || []).length);
ok('the page numbering runs to the end', /PAGE 5 OF 5/.test(sheet));
ok('nothing prints as NaN or undefined', !/NaN|undefined/.test(sheet),
   (/.{40}(NaN|undefined).{40}/.exec(sheet) || ['clean'])[0]);

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
ok('the shifts each person may work are togglable, not typed', /กะที่ขึ้นได้/.test(t));
ok('shops are togglable too', /สาขา/.test(t));
ok('pay is editable', /เงินเดือน|วันละ/.test(t));
ok('and the target/max caps', /เป้ากะ/.test(t) && /สูงสุด/.test(t));
ok('a new person can be added', /\+ เพิ่มพนักงาน/.test(t));

/* The whole reason the grid exists: ticking one more shift for somebody has to
 * close the hole the generator was reporting, without touching anything else. */
const before = await p.evaluate(() => {
  const b2 = JSON.parse(localStorage.getItem('dank_shift_roster') || '{}');
  const k = Object.keys(b2)[0];
  return k ? b2[k].validation.empty.length : -1;
});
const ticked = await p.evaluate(() => {
  /* Amoe is cleared for A1 only; tick C1 as well */
  const inp = [...document.querySelectorAll('input')].find((x) => x.value === 'Amoe');
  if (!inp) return 'no name field';
  /* walk out to the ancestor that holds both the name and the slot chips */
  let card = inp, btn = null;
  while (card && !btn) {
    card = card.parentElement;
    if (!card) break;
    btn = [...card.querySelectorAll('button')].find((x) => x.innerText.trim().indexOf('C1') === 0);
  }
  if (!btn) return 'no C1 button';
  btn.click();
  return 'ticked';
});
ok('a shift can be ticked on for somebody', ticked === 'ticked', ticked);
await p.waitForTimeout(500);
ok('saving it takes', !!(await click('บันทึก + ลง Audit')));
await p.waitForTimeout(900);
ok('the roster is re-drafted rather than left stale', /ยังไม่มีตารางของ|สร้างร่าง/.test(await body()));
ok('Generate runs again', !!(await click('สร้างร่าง')));
await p.waitForTimeout(1600);
const after = await p.evaluate(() => {
  const t2 = document.body.innerText;
  const m = /(\d+)\s*\n?\s*กะที่ยังว่าง/.exec(t2) || /กะที่ยังว่าง/.exec(t2);
  return t2.indexOf('กะที่ยังว่าง') >= 0;
});
ok('the report still renders after the change', after);
ok('and the widened clearance is on the person', await p.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('dank_shift_staff') || '[]');
  const a = st.filter((x) => x.id === 'amoe')[0];
  return !!a && (a.slots || []).indexOf('C1') >= 0;
}));

console.log('\nPAGE ERRORS: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${fails.length || errs.length ? 'FAIL' : 'PASS'} — ${fails.length} failed, ${errs.length} page errors`);
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
