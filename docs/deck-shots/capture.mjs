/* Re-take every screenshot docs/build-what-is-left.cjs embeds.
 *
 *   bash pos/build.sh
 *   npm run serve                       # python3 -m http.server 8799 from the REPO ROOT
 *   node docs/deck-shots/capture.mjs
 *
 * Two things in the deck cannot be photographed and are written out as text
 * instead: anything on the Vercel settings page (this container has no network)
 * and the ✏ แก้งบ button's own gate — it only renders for a Master/CEO login,
 * which is why the harness seeds one.
 *
 * Everything here talks to the DOM through getBoundingClientRect(), never
 * offsetParent: the AI button and the assistant panel are position:fixed, and
 * a fixed element reports offsetParent === null, so an offsetParent filter
 * silently skips exactly the two things this script needs to click.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const URL = 'http://127.0.0.1:8799/pos/testrun/test2.html';
const PIN = '110114';                       // harness only — never in the shipped bundle
fs.mkdirSync(OUT, { recursive: true });

const errs = [];
const b = await chromium.launch();

const login = async (page) => {
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  await page.goto(URL);
  await page.waitForTimeout(2400);
  for (const d of PIN) await page.click(`button:has-text("${d}")`).catch(() => {});
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const later = [...document.querySelectorAll('button')].find((x) => /ไว้ก่อน|Later/.test(x.innerText));
    if (later) later.click();
  });
  await page.waitForTimeout(600);
};

const vis = () => [...document.querySelectorAll('button')]
  .filter((y) => { const r = y.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

const clicker = (page) => (t) => page.evaluate((s) => {
  const x = [...document.querySelectorAll('button')]
    .filter((y) => { const r = y.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .find((y) => y.innerText.replace(/\s+/g, ' ').indexOf(s) >= 0);
  if (!x) return null;
  x.click();
  return x.innerText.replace(/\s+/g, ' ').trim().slice(0, 40);
}, t);

const shoot = async (page, name, clip) => {
  if (clip && (clip.width < 200 || clip.height < 120)) {
    console.log('  !! ' + name + ' — rect too small, not written: ' + JSON.stringify(clip));
    return false;
  }
  await page.screenshot(clip ? { path: path.join(OUT, name), clip } : { path: path.join(OUT, name) });
  console.log('  ✓ ' + name);
  return true;
};

/* ── phone: the login screen and the five-slot tab bar ────────────────────── */
{
  const ph = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ph.goto(URL);
  await ph.waitForTimeout(2400);
  await shoot(ph, '01-login.png');
  await login(ph);
  /* clip past the sync toast, which sits over the header for a few seconds */
  await shoot(ph, '02-tabbar.png', { x: 0, y: 84, width: 390, height: 196 });
}

/* ── desktop: the data screens ────────────────────────────────────────────── */
const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
await login(p);
const click = clicker(p);

/* the modal card inside a fixed overlay */
const overlayRect = (t) => p.evaluate((s) => {
  const o = [...document.querySelectorAll('div')]
    .filter((d) => getComputedStyle(d).position === 'fixed')
    .filter((d) => { const r = d.getBoundingClientRect(); return r.width > 260 && r.height > 180 && d.innerText.indexOf(s) >= 0; })
    .sort((a, c) => c.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  if (!o) return null;
  const kids = [...o.children].filter((c) => c.getBoundingClientRect().height > 150);
  const card = kids.length === 1 && o.getBoundingClientRect().width > 700 ? kids[0] : o;
  const r = card.getBoundingClientRect();
  return { x: Math.max(0, r.x - 5), y: Math.max(0, r.y - 5),
           width: Math.min(innerWidth - Math.max(0, r.x - 5), r.width + 10),
           height: Math.min(innerHeight - Math.max(0, r.y - 5), r.height + 10) };
}, t);

/* an in-page block, by id */
const blockRect = (id) => p.evaluate((i) => {
  const el = document.getElementById(i);
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8),
           width: Math.min(innerWidth - Math.max(0, r.x - 8), r.width + 16),
           height: Math.min(innerHeight - Math.max(0, r.y - 8), r.height + 16) };
}, id);

/* the innermost element still tall enough to be the whole block */
const cardRect = (t, minH) => p.evaluate((a) => {
  const [s, mh] = a;
  const hits = [...document.querySelectorAll('div')]
    .filter((d) => d.innerText && d.innerText.indexOf(s) >= 0 && d.getBoundingClientRect().height >= mh);
  if (!hits.length) return null;
  const el = hits[hits.length - 1];
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8),
           width: Math.min(innerWidth - Math.max(0, r.x - 8), r.width + 16),
           height: Math.min(innerHeight - Math.max(0, r.y - 8), r.height + 16) };
}, [t, minH]);

const closeModal = async () => {
  await p.evaluate(() => {
    const x = [...document.querySelectorAll('button')].find((y) => y.innerText.trim() === '✕');
    if (x) x.click();
  });
  await p.waitForTimeout(800);
};

/* 04 — the per-SKU margin table, off the dashboard */
await click('📊 แดชบอร์ด');
await p.waitForTimeout(1600);
await click('กำไรต่อสินค้า');
await p.waitForTimeout(1400);
await shoot(p, '04-sku-table.png', await overlayRect('กำไรต่อสินค้า'));
await closeModal();

/* 09 — the ◀ ▶ period stepper. It only renders for day/month/quarter/year,
 * so the ทั้งหมด dashboard above genuinely cannot show it. */
await click('วันนี้');
await p.waitForTimeout(1200);
await click('◀');
await p.waitForTimeout(1000);
await click('◀');
await p.waitForTimeout(1000);
await shoot(p, '09-period.png', { x: 0, y: 115, width: 1180, height: 125 });
await click('ทั้งหมด');
await p.waitForTimeout(900);

/* 05 — the debtor ledger, with two debts recorded through the app's own form
 * so the picture shows real rows rather than the empty state */
await click('💰 การเงิน');
await p.waitForTimeout(1400);
const addDebt = async (custIdx, amount, note) => {
  await click('เพิ่มยอดค้าง');
  await p.waitForTimeout(1000);
  await p.evaluate((a) => {
    const [ci, amt, nt] = a;
    const setS = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    const setI = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const sel = [...document.querySelectorAll('select')]
      .filter((x) => x.getBoundingClientRect().width > 0)
      .find((x) => /Select customer/.test(x.options[0] && x.options[0].text));
    if (!sel || !sel.options[ci]) return;
    setS.call(sel, sel.options[ci].value); sel.dispatchEvent(new Event('change', { bubbles: true }));
    const num = [...document.querySelectorAll('input[type=number]')].filter((x) => x.getBoundingClientRect().width > 0)[0];
    setI.call(num, String(amt)); num.dispatchEvent(new Event('input', { bubbles: true }));
    const txt = [...document.querySelectorAll('input')].filter((x) => x.getBoundingClientRect().width > 0 && /IOU/.test(x.placeholder || ''))[0];
    if (txt) { setI.call(txt, nt); txt.dispatchEvent(new Event('input', { bubbles: true })); }
  }, [custIdx, amount, note]);
  await p.waitForTimeout(400);
  await click('💾 Save');
  await p.waitForTimeout(900);
};
await addDebt(1, 4800, 'IOU งานเลี้ยง 12 ส.ค.');
await addDebt(2, 1250, 'ค้างบิลหน้าร้าน');
await shoot(p, '05-debtors.png', await blockRect('ar-block'));

/* 06 — the fixed-cost editor. Not a modal: ✏ แก้งบ flips the block into
 * inputs in place, and the button only exists for role === "owner". */
await click('💸 ค่าใช้จ่าย');
await p.waitForTimeout(1200);
const budget = await click('แก้งบ');
if (!budget) console.log('  !! ✏ แก้งบ not found — is the seeded staff still role "owner"?');
await p.waitForTimeout(1400);
/* clip the branch list only — Petchaboon and Phuket at 0 are the point of the
 * picture, and the save button is step 6 of the written path beside it */
await shoot(p, '06-budget.png', await p.evaluate(() => {
  const rows = [...document.querySelectorAll('div')]
    .filter((d) => /^(Pattanakarn|Phuket)$/.test(d.innerText.trim()) && d.getBoundingClientRect().height < 40);
  const top = [...document.querySelectorAll('div')]
    .filter((d) => d.innerText.trim().indexOf('งบรวมทุกสาขา') === 0 && d.getBoundingClientRect().height < 40)[0];
  const last = rows[rows.length - 1];
  if (!top || !last) return null;
  top.scrollIntoView({ block: 'start' });
  const t = top.getBoundingClientRect(), l = last.getBoundingClientRect();
  return { x: 40, y: Math.max(0, t.y - 14), width: 620,
           height: Math.min(innerHeight - Math.max(0, t.y - 14), l.bottom - t.y + 20) };
}));

/* 07 — the work board's manager view */
await click('📋 งาน Work');
await p.waitForTimeout(1200);
await click('ทีม Team');
await p.waitForTimeout(1200);
await shoot(p, '07-team.png', { x: 0, y: 120, width: 1280, height: 380 });

/* 08 — the assistant answering about a real product, with no AI key set */
await click('🛒 ขาย');
await p.waitForTimeout(1000);
await click('🤖');
await p.waitForTimeout(1300);
await p.evaluate(() => {
  const el = [...document.querySelectorAll('input')]
    .filter((i) => /คำถาม/.test(i.placeholder || '') && i.getBoundingClientRect().width > 0)[0];
  if (!el) return;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(el, 'og kush เหลือเท่าไหร่ ราคาเท่าไหร่');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await p.waitForTimeout(400);
await click('➤');
await p.waitForTimeout(1800);
await shoot(p, '08-assistant.png', await overlayRect('Bryan AI'));

console.log('\nPAGE ERRORS: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log('every shot the deck embeds is now current');
await b.close();
process.exit(errs.length ? 1 : 0);
