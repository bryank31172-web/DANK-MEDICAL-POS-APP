/* The tab bar had sixteen tabs in it, 686px wide on a 390px phone, so staff
 * scrolled the strip sideways to find a tab and read the labels at 8px. This
 * locks the fix in place: five slots, no sideways scroll, readable labels.
 *
 *   bash pos/build.sh
 *   python3 -m http.server 8799 &      # from the REPO ROOT
 *   node pos/__tests__/tabbar.test.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const errs = [], fails = [];
const ok = (n, c, x) => {
  console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || x === undefined ? '' : '  → ' + String(x).slice(0, 120)));
  if (!c) fails.push(n);
};

const b = await chromium.launch();
const phone = await b.newPage({ viewport: { width: 390, height: 844 } });
phone.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
await phone.goto('http://127.0.0.1:8799/pos/testrun/test2.html');
await phone.waitForTimeout(2200);
for (const d of '110114') await phone.click(`button:has-text("${d}")`).catch(() => {});
await phone.waitForTimeout(1800);

/* the tab strip is the row holding the POS button */
const bar = () => phone.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => /^\s*🛒/.test(x.innerText));
  const row = btn && btn.parentElement;
  if (!row) return null;
  const kids = [...row.children];
  return {
    slots: kids.length,
    labels: kids.map((k) => (k.innerText || '').trim().split('\n').pop()),
    minLabelPx: Math.min(...kids.map((k) => {
      const sp = k.querySelector('span:last-of-type');
      return sp ? parseFloat(getComputedStyle(sp).fontSize) : 99;
    })),
    minHeight: Math.min(...kids.map((k) => Math.round(k.getBoundingClientRect().height))),
    rowScrolls: row.scrollWidth > row.clientWidth + 1,
  };
});

console.log('the phone tab bar');
const t = await bar();
ok('the tab strip was found', !!t);
ok('five slots, no more', t && t.slots === 5, t && t.slots + ': ' + (t && t.labels.join(' · ')));
ok('the last slot is More', t && /More/i.test(t.labels[4]), t && t.labels[4]);
ok('the strip itself does not scroll sideways', t && !t.rowScrolls);
ok('labels are at least 11px', t && t.minLabelPx >= 11, t && t.minLabelPx);
ok('each slot is at least 44px tall', t && t.minHeight >= 44, t && t.minHeight);

console.log('\nthe page, at 390px');
const doc = await phone.evaluate(() => ({ w: document.documentElement.scrollWidth, vw: innerWidth }));
ok('the document is no wider than the screen', doc.w === doc.vw, doc.w + ' vs ' + doc.vw);

console.log('\nnothing became unreachable');
await phone.evaluate(() => { const m = [...document.querySelectorAll('button')].find((x) => x.innerText.indexOf('⋯') >= 0); m && m.click(); });
await phone.waitForTimeout(700);
const menu = await phone.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter((x) => x.getBoundingClientRect().width > 0);
  const names = btns.map((x) => (x.innerText || '').trim().split('\n').pop());
  return { hasStats: names.some((n) => /Stats/i.test(n)), hasFinance: names.some((n) => /Finance/i.test(n)),
           hasBar: names.some((n) => /^Bar$/i.test(n)), count: names.length };
});
ok('Stats is in the More menu', menu.hasStats);
ok('Finance is in the More menu', menu.hasFinance);
ok('Bar is in the More menu', menu.hasBar);
/* and it actually switches */
await phone.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find((x) => /Finance/i.test(x.innerText) && x.innerText.indexOf('💰') >= 0); b2 && b2.click(); });
await phone.waitForTimeout(900);
ok('picking one from More opens that tab', await phone.evaluate(() => /Finance & P&L|ลูกหนี้/.test(document.body.innerText)));

console.log('\nthe desktop bar is untouched');
const desk = await b.newPage({ viewport: { width: 1280, height: 900 } });
desk.on('pageerror', (e) => errs.push('desktop: ' + e.message.slice(0, 120)));
await desk.goto('http://127.0.0.1:8799/pos/testrun/test2.html');
await desk.waitForTimeout(2200);
for (const d of '110114') await desk.click(`button:has-text("${d}")`).catch(() => {});
await desk.waitForTimeout(1600);
const dslots = await desk.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => /^\s*🛒/.test(x.innerText));
  return btn && btn.parentElement ? btn.parentElement.children.length : 0;
});
ok('desktop still shows the full set', dslots > 10, dslots);

console.log('\nPAGE ERRORS: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(`${fails.length || errs.length ? 'FAIL' : 'PASS'} — ${fails.length} failed`);
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
