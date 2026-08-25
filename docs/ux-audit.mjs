/* Measure the running app instead of eyeballing it.
 *
 *   bash pos/build.sh
 *   python3 -m http.server 8799 &        # must serve the repo root
 *   node docs/ux-audit.mjs
 *
 * Writes screenshots plus audit.json to docs/ux-shots/: tap targets under
 * 44px, text under 12px, whether the page scrolls sideways at 390px, and the
 * spread of radius/shadow/font values. Those counts are what docs/
 * UX-UI-Apple-Brief.md cites, so re-run it after a UI change and the brief can
 * be rebuilt against real numbers rather than remembered ones.
 */
import { chromium } from '../pos/__tests__/_playwright.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ux-shots');
fs.mkdirSync(OUT, { recursive: true });

const errs = [];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
p.on('pageerror', e => errs.push(e.message.slice(0, 140)));
await p.goto('http://127.0.0.1:8799/pos/testrun/test2.html');
await p.waitForTimeout(2200);
await p.screenshot({ path: `${OUT}/00-login.png` });

for (const d of '110114') await p.click(`button:has-text("${d}")`).catch(() => {});
await p.waitForTimeout(1800);
await p.screenshot({ path: `${OUT}/pos.png` });

/* what tabs actually exist */
const tabs = await p.evaluate(() =>
  [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim().replace(/\s+/g, ' '))
    .filter(t => t && t.length < 24));
fs.writeFileSync(`${OUT}/tabs.txt`, tabs.join('\n'));

const want = ['ขาย', 'สต็อก', 'CRM', 'Finance', 'การเงิน', 'Dashboard', 'แดชบอร์ด', 'บาร์', 'Bar', 'Settings', 'ตั้งค่า'];
for (const t of want) {
  const el = await p.$(`button:has-text("${t}")`);
  if (!el) continue;
  await el.click().catch(() => {});
  await p.waitForTimeout(1100);
  await p.screenshot({ path: `${OUT}/tab-${t.replace(/[^\w฀-๿]/g, '')}.png` });
  /* the two the brief embeds keep stable names so the PDF build never guesses */
  if (t === 'Finance') await p.screenshot({ path: `${OUT}/finance.png` });
}

/* measured facts, not impressions */
const audit = await p.evaluate(() => {
  const px = v => parseFloat(v) || 0;
  const small = [], tiny = [], radii = {}, shadows = {}, fonts = {}, colors = {};
  for (const el of document.querySelectorAll('button, [role=button], a, input, select')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 44 || r.width < 44) small.push({
      t: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 26),
      w: Math.round(r.width), h: Math.round(r.height),
    });
  }
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const s = getComputedStyle(el);
    const fs_ = px(s.fontSize);
    if (fs_ && el.children.length === 0 && (el.innerText || '').trim()) {
      fonts[fs_] = (fonts[fs_] || 0) + 1;
      if (fs_ < 12) tiny.push({ t: el.innerText.trim().slice(0, 26), px: fs_ });
    }
    const rad = s.borderRadius;
    if (rad && rad !== '0px') radii[rad] = (radii[rad] || 0) + 1;
    const sh = s.boxShadow;
    if (sh && sh !== 'none') shadows[sh.slice(0, 60)] = (shadows[sh.slice(0, 60)] || 0) + 1;
    const bg = s.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)') colors[bg] = (colors[bg] || 0) + 1;
  }
  const top = (o, n = 14) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    docWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    smallTargets: small.length, smallSample: small.slice(0, 22),
    tinyText: tiny.length, tinySample: tiny.slice(0, 18),
    fontSizes: top(fonts), radii: top(radii), shadows: top(shadows, 8), bgColors: top(colors, 12),
    transitions: [...document.querySelectorAll('*')].filter(e => {
      const t = getComputedStyle(e).transitionDuration; return t && t !== '0s';
    }).length,
    fontFamily: getComputedStyle(document.body).fontFamily,
  };
});
fs.writeFileSync(`${OUT}/audit.json`, JSON.stringify(audit, null, 1));
console.log(JSON.stringify({ errs, tabsFound: tabs.length, ...audit, smallSample: undefined, tinySample: undefined }, null, 1));
await b.close();
