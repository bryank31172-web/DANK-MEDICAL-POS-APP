/* ClinicWorks POS — what is still open, every connection, and how to do it.
 * Thai first, English under it, because the owner reads Thai and the staff read both.
 *
 *   npm i                       # pptxgenjs is a devDependency, docs-only
 *   npm run docs:whatsleft      # -> docs/ClinicWorks-What-Is-Left.pptx
 *
 * The screenshots come from docs/deck-shots/ and are real captures of the app
 * running against the offline harness — regenerate them with
 * `npm run docs:whatsleft:shots` (needs pos/build.sh and `npm run serve` first).
 * If you re-crop a shot, check its aspect ratio against the w/h passed to
 * addImage here; pptxgenjs stretches rather than fits.
 */
const pptxgen = require('pptxgenjs');
const path = require('path');
const IMG = path.join(__dirname, 'deck-shots');   // regenerate with deck-shots/capture.mjs
const OUT = path.join(__dirname, 'ClinicWorks-What-Is-Left.pptx');

const INK = '0E1A12';       // the app's near-black green
const INK2 = '16281C';
const FOREST = '2C5F2D';
const MOSS = '97BC62';
const CREAM = 'F5F7F2';
const PAPER = 'FFFFFF';
const BODY = '2A3A2E';
const MUTE = '6B7C6F';
const RED = 'C0392B';
const GOLD = 'C8901B';
const F = 'Tahoma';

const p = new pptxgen();
p.layout = 'LAYOUT_WIDE';           // 13.333 x 7.5
p.author = 'ClinicWorks POS';
p.title = 'ClinicWorks POS — What Is Left';

const W = 13.333, H = 7.5;

/* ── helpers ─────────────────────────────────────────────────────────────── */
const light = () => { const s = p.addSlide(); s.background = { color: CREAM }; return s; };
const dark = () => { const s = p.addSlide(); s.background = { color: INK }; return s; };

/* a numbered circle — the motif repeated on every step slide */
const badge = (s, n, x, y, d, fill, ink) => {
  s.addShape(p.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill } });
  s.addText(String(n), { x, y, w: d, h: d, align: 'center', valign: 'middle',
    fontFace: F, fontSize: d > 0.5 ? 18 : 12, bold: true, color: ink, margin: 0 });
};

const heading = (s, thai, eng, onDark) => {
  s.addText(thai, { x: 0.62, y: 0.42, w: 12.1, h: 0.62, fontFace: F, fontSize: 30, bold: true,
    color: onDark ? PAPER : INK, margin: 0, valign: 'middle' });
  s.addText(eng, { x: 0.62, y: 1.06, w: 12.1, h: 0.4, fontFace: F, fontSize: 14,
    color: onDark ? MOSS : MUTE, margin: 0, valign: 'middle' });
};

/* a rounded content card */
const card = (s, o) => {
  s.addShape(p.ShapeType.roundRect, Object.assign({ rectRadius: 0.1, fill: { color: PAPER },
    line: { color: 'E2E8E1', width: 1 } }, o));
};

/* numbered how-to steps inside a card */
const steps = (s, list, x, y, w, gap, onDark) => {
  list.forEach((t, i) => {
    const yy = y + i * gap;
    badge(s, i + 1, x, yy + 0.04, 0.3, i === 0 ? FOREST : (onDark ? INK2 : 'E4EDE2'), i === 0 ? PAPER : (onDark ? MOSS : FOREST));
    s.addText(t, { x: x + 0.42, y: yy - 0.02, w: w - 0.42, h: gap, fontFace: F, fontSize: 12.5,
      color: onDark ? 'D6E2D6' : BODY, margin: 0, valign: 'top', lineSpacing: 17 });
  });
};

/* ── 1. title ────────────────────────────────────────────────────────────── */
{
  const s = dark();
  s.addShape(p.ShapeType.ellipse, { x: -2.2, y: -2.6, w: 7.2, h: 7.2, fill: { color: FOREST, transparency: 78 } });
  s.addText('ClinicWorks POS', { x: 0.85, y: 1.55, w: 8.2, h: 0.95, fontFace: F, fontSize: 44, bold: true, color: PAPER, margin: 0 });
  s.addText('สิ่งที่ยังไม่เสร็จ · ทุกการเชื่อมต่อ · ทำยังไง', { x: 0.85, y: 2.55, w: 8.2, h: 0.55, fontFace: F, fontSize: 21, color: MOSS, margin: 0 });
  s.addText("What's still open, every connection, and how to do it", { x: 0.85, y: 3.08, w: 8.2, h: 0.4, fontFace: F, fontSize: 14, color: '8C9C90', margin: 0 });
  s.addShape(p.ShapeType.roundRect, { x: 0.85, y: 3.95, w: 4.15, h: 0.95, rectRadius: 0.1, fill: { color: INK2 } });
  s.addText([{ text: 'โค้ดเสร็จแล้วทั้งหมด\n', options: { bold: true, color: PAPER, fontSize: 14 } },
             { text: 'ที่เหลือคือการตั้งค่าและข้อมูล — ไม่ใช่การเขียนโปรแกรม', options: { color: MOSS, fontSize: 10.5 } }],
    { x: 1.05, y: 3.95, w: 3.8, h: 0.95, fontFace: F, margin: 0, valign: 'middle', lineSpacing: 15 });
  s.addText('dank-medical-pos-app.vercel.app  ·  24 สิงหาคม 2026', { x: 0.85, y: 5.35, w: 8, h: 0.35, fontFace: F, fontSize: 11, color: MUTE, margin: 0 });
  s.addImage({ path: path.join(IMG, '01-login.png'), x: 9.9, y: 0.55, w: 2.85, h: 6.17 });
  s.addNotes('The code side is finished. Everything on this list is a Vercel setting, a data-entry job, or a decision only the owner can make.');
}

/* ── 2. scoreboard ───────────────────────────────────────────────────────── */
{
  const s = light();
  heading(s, 'ภาพรวม — เหลืออะไรบ้าง', 'At a glance: what is actually left');
  const cards = [
    { n: '1', th: 'ตัวบล็อกเดียว', en: 'MASTER_PIN — nobody can log in until this is set', c: RED },
    { n: '5', th: 'ค่าที่ต้องตั้งใน Vercel', en: 'env vars across two projects, then Redeploy', c: GOLD },
    { n: '2', th: 'งานป้อนข้อมูล', en: 'real costs in StoreHub · branch budgets in-app', c: FOREST },
    { n: '3', th: 'เรื่องที่รอเจ้าของตัดสินใจ', en: 'nobody else can answer these', c: '4A6E8A' },
  ];
  cards.forEach((c, i) => {
    const x = 0.62 + i * 3.12;
    card(s, { x, y: 1.75, w: 2.9, h: 2.35 });
    s.addText(c.n, { x: x + 0.22, y: 1.9, w: 1.2, h: 0.95, fontFace: F, fontSize: 54, bold: true, color: c.c, margin: 0, valign: 'middle' });
    s.addText(c.th, { x: x + 0.22, y: 2.88, w: 2.46, h: 0.45, fontFace: F, fontSize: 14, bold: true, color: INK, margin: 0, valign: 'top' });
    s.addText(c.en, { x: x + 0.22, y: 3.3, w: 2.46, h: 0.7, fontFace: F, fontSize: 10, color: MUTE, margin: 0, valign: 'top', lineSpacing: 13 });
  });
  card(s, { x: 0.62, y: 4.45, w: 12.1, h: 2.02 });
  s.addText('ทำไมถึงเหลือแค่นี้', { x: 0.95, y: 4.68, w: 5.5, h: 0.36, fontFace: F, fontSize: 15, bold: true, color: INK, margin: 0 });
  s.addText([
    { text: 'ตัวแอปเชื่อม StoreHub ครบแล้ว (396 สินค้า) · ออเดอร์จากเว็บตัดสต็อกได้แล้วในโค้ด · รูปสินค้าตรงกันทั้ง POS และเว็บ · ลูกหนี้ กำไรต่อ SKU งบสาขา ทำเสร็จหมด\n', options: { color: BODY, fontSize: 12 } },
    { text: 'The app talks to StoreHub, cuts stock from website orders, matches photos across POS and site, and has the debtor ledger, per-SKU margin and branch budgets. None of that is waiting on more code.\n\n', options: { color: MUTE, fontSize: 10.5 } },
    { text: 'ที่เหลือคือของที่ผมแตะไม่ได้ — คีย์และค่าตั้งอยู่ในหน้า Vercel, ต้นทุนจริงอยู่ใน StoreHub, และคำตอบบางข้อรู้อยู่คนเดียวคือเจ้าของ', options: { color: BODY, fontSize: 12, bold: true } },
  ], { x: 0.95, y: 5.08, w: 11.45, h: 1.45, fontFace: F, margin: 0, valign: 'top', lineSpacing: 16 });
  s.addNotes('Four buckets: one blocker, five Vercel settings, two data-entry jobs, three decisions.');
}

/* ── 3. the connection map ───────────────────────────────────────────────── */
{
  const s = dark();
  heading(s, 'ทุกอย่างต่อกันยังไง', 'How every piece connects — and which links are not live yet', true);

  const box = (x, y, w, h, title, sub, fill, edge) => {
    s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: edge, width: 1.25 } });
    s.addText(title, { x: x + 0.14, y: y + 0.12, w: w - 0.28, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: PAPER, margin: 0 });
    s.addText(sub, { x: x + 0.14, y: y + 0.42, w: w - 0.28, h: h - 0.55, fontFace: F, fontSize: 9, color: '9FB2A3', margin: 0, valign: 'top', lineSpacing: 12 });
  };
  const link = (x1, y1, x2, y2, colour) => {
    s.addShape(p.ShapeType.line, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: colour, width: 2, endArrowType: 'triangle' } });
  };
  const tag = (x, y, t, colour) => {
    s.addShape(p.ShapeType.roundRect, { x, y, w: 1.5, h: 0.28, rectRadius: 0.08, fill: { color: colour } });
    s.addText(t, { x, y, w: 1.5, h: 0.28, align: 'center', valign: 'middle', fontFace: F, fontSize: 8.5, bold: true, color: INK, margin: 0 });
  };

  box(0.62, 1.85, 2.6, 1.25, 'StoreHub', 'สินค้า · บิล · ลูกค้า\nproducts, sales, customers', INK2, FOREST);
  box(0.62, 3.55, 2.6, 1.25, 'www.dankbangkok.com', 'เว็บลูกค้า (คนละ repo)\ncustomer site', INK2, FOREST);
  box(0.62, 5.25, 2.6, 1.15, 'xAI (Grok)', 'ปุ่ม AI ทุกปุ่ม\nevery AI button', INK2, FOREST);

  box(4.75, 2.6, 3.6, 2.3, 'BRYAN POS', '/api/storehub/*  ดึงสินค้า/บิล\n/api/order  รับออเดอร์จากเว็บ\n/api/grok  ผู้ช่วย AI\n/api/staff-auth  ตรวจ PIN\nสถานะอื่นเก็บใน localStorage', '1D3325', MOSS);

  box(9.9, 1.85, 2.85, 1.25, 'Upstash Redis', 'กันเดา PIN / จำกัดจำนวนครั้ง\nrate limit', INK2, FOREST);
  box(9.9, 3.55, 2.85, 1.25, 'LINE + Email', 'แจ้งเตือนออเดอร์\norder alerts', INK2, FOREST);
  box(9.9, 5.25, 2.85, 1.15, 'พนักงาน / Staff', 'แท็บเล็ตหน้าร้าน\nshop tablets', INK2, FOREST);

  link(3.22, 2.45, 4.75, 3.1, MOSS);
  link(3.22, 4.15, 4.75, 3.75, GOLD);
  link(3.22, 5.8, 4.75, 4.4, GOLD);
  link(8.35, 3.1, 9.9, 2.45, GOLD);
  link(8.35, 3.9, 9.9, 4.15, MOSS);
  link(8.35, 4.5, 9.9, 5.8, RED);

  tag(3.35, 2.14, '✅ ต่อแล้ว', MOSS);
  tag(3.35, 4.28, '⚠ ต้องตั้ง env', GOLD);
  tag(3.35, 5.02, '⚠ ต้องใส่คีย์', GOLD);
  tag(8.45, 2.42, '⚠ ยังไม่ผูก', GOLD);
  tag(8.45, 3.72, '✅ ต่อแล้ว', MOSS);
  tag(8.45, 4.86, '🔴 ล็อกอินไม่ได้', 'E8938A');

  s.addText('เส้นสีเขียว = ใช้งานได้จริงแล้ว · เส้นเหลือง/แดง = โค้ดพร้อม แต่ยังขาดค่าตั้งค่า   |   Green links work today; amber and red are code-complete but waiting on a setting.',
    { x: 0.62, y: 6.72, w: 12.1, h: 0.4, fontFace: F, fontSize: 10, color: '8C9C90', margin: 0 });
  s.addNotes('Every amber or red link is a missing environment variable, not missing code.');
}

/* ── 4. #1 MASTER_PIN ────────────────────────────────────────────────────── */
{
  const s = light();
  heading(s, '🔴 ข้อ 1 — ตั้ง MASTER_PIN (ตัวบล็อกเดียวที่เหลือ)', 'Nobody can log in until this exists. Do this one first.');
  card(s, { x: 0.62, y: 1.72, w: 8.3, h: 4.98 });
  s.addText([
    { text: 'PIN 110114 ถูกเผาไปแล้ว ', options: { bold: true, color: RED, fontSize: 12.5 } },
    { text: '— มันอยู่ในไฟล์ทดสอบใน repo ที่เป็น public ใครก็อ่านได้ ต้องตั้งเลขใหม่', options: { color: BODY, fontSize: 12.5 } },
  ], { x: 0.95, y: 1.95, w: 7.65, h: 0.4, fontFace: F, margin: 0, valign: 'middle' });
  steps(s, [
    'เปิด vercel.com → เลือกโปรเจกต์ dank-medical-pos-app',
    'Settings → Environment Variables → Add New',
    'Key = MASTER_PIN  ·  Value = เลข 6 หลักใหม่ (ห้ามใช้ 110114 และห้ามส่งให้ใครทางแชท)',
    'เพิ่ม MASTER_NAME = Bryan (CEO)  ให้ระบบรู้ว่าเป็นใครตอนลง Audit',
    'ติ๊กครบทั้ง Production / Preview / Development แล้วกด Save',
    'ไปแท็บ Deployments → กด ⋯ ที่ตัวบนสุด → Redeploy  (ไม่กด = ค่ายังไม่มีผล)',
    'ทดสอบ: เปิดแอป ใส่ PIN ใหม่ ต้องเข้าได้ และ 110114 ต้องเข้าไม่ได้แล้ว',
  ], 0.95, 2.55, 7.65, 0.575);
  card(s, { x: 9.28, y: 1.72, w: 3.44, h: 4.98 });
  s.addText('หน้าที่จะเปลี่ยน', { x: 9.55, y: 1.9, w: 2.9, h: 0.32, fontFace: F, fontSize: 12, bold: true, color: INK, margin: 0 });
  s.addImage({ path: path.join(IMG, '01-login.png'), x: 10.15, y: 2.3, w: 1.72, h: 3.72 });
  s.addText('ตราบใดที่ยังไม่ตั้ง ประตูหลัง "claim PIN" จะยังเปิดอยู่โดยตั้งใจ — ตั้งเสร็จเมื่อไหร่ มันปิดตัวเองทันที',
    { x: 9.55, y: 6.08, w: 2.9, h: 0.55, fontFace: F, fontSize: 9.5, color: MUTE, margin: 0, valign: 'top', lineSpacing: 12 });
  s.addNotes('The break-glass claim-PIN path stays open by design while MASTER_PIN is unset, and closes itself the moment it exists.');
}

/* ── 5. #2 XAI_API_KEY ───────────────────────────────────────────────────── */
{
  const s = light();
  heading(s, 'ข้อ 2 — ใส่ XAI_API_KEY ให้ผู้ช่วย AI ตอบได้ทุกคำถาม', 'The assistant already answers products and recipes without a key — this unlocks free-text questions');
  s.addImage({ path: path.join(IMG, '08-assistant.png'), x: 0.62, y: 1.75, w: 3.55, h: 4.69 });
  s.addText('ภาพจริงจากแอป — ถามชื่อสินค้าได้อยู่แล้ววันนี้ ไม่ต้องมีคีย์',
    { x: 0.62, y: 6.5, w: 3.55, h: 0.4, fontFace: F, fontSize: 9.5, color: MUTE, margin: 0, align: 'center' });
  card(s, { x: 4.52, y: 1.75, w: 8.2, h: 2.0 });
  s.addText('ทำงานอยู่แล้ว โดยไม่ต้องมีคีย์', { x: 4.82, y: 1.95, w: 7.6, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: FOREST, margin: 0 });
  s.addText('ถามชื่อสินค้า (คงเหลือ ราคา ต้นทุน กำไร) · สูตรค็อกเทลทั้ง 14 สูตร · วิธีปิดกะ วิธีรับของ วิธีชั่งของ · ยอดขายวันนี้ · สต๊อกใกล้หมด · สินค้าขายดี — ทั้งหมดอ่านจากข้อมูลในแอปโดยตรง จึงไม่มีทางเดาตัวเลขผิด\nProduct lookups, all 14 bar recipes, the how-to answers and today\'s numbers are read straight out of app state.',
    { x: 4.82, y: 2.32, w: 7.6, h: 1.5, fontFace: F, fontSize: 11, color: BODY, margin: 0, valign: 'top', lineSpacing: 15 });
  card(s, { x: 4.52, y: 3.95, w: 8.2, h: 2.7 });
  s.addText('ใส่คีย์แล้วได้เพิ่ม', { x: 4.82, y: 4.15, w: 7.6, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: GOLD, margin: 0 });
  steps(s, [
    'Vercel → dank-medical-pos-app → Settings → Environment Variables',
    'XAI_API_KEY = คีย์จากบัญชี xAI เดียวกับที่เว็บร้านใช้',
    'GROK_MODEL = grok-4  (ใส่ไว้ให้ชัด ไม่ต้องเดา)',
    'Save แล้ว Redeploy — ถามอิสระได้ทันที เช่น "เดือนนี้ควรลดราคาตัวไหน"',
  ], 4.82, 4.55, 7.6, 0.52);
  s.addNotes('Worth saying plainly: the manual and the product lookups already work. The key only adds free-text reasoning.');
}

/* ── 6. #3 + #4 Upstash ──────────────────────────────────────────────────── */
{
  const s = light();
  heading(s, 'ข้อ 3–4 — ต่อ Upstash Redis ให้ครบทั้งสองโปรเจกต์', 'Without it the PIN-guess limit is per-instance, so guessing can be spread across servers');
  card(s, { x: 0.62, y: 1.78, w: 5.95, h: 4.9 });
  badge(s, 3, 0.95, 2.0, 0.42, RED, PAPER);
  s.addText('dank-medical-pos-app (POS)', { x: 1.5, y: 1.98, w: 4.8, h: 0.36, fontFace: F, fontSize: 14, bold: true, color: INK, margin: 0, valign: 'middle' });
  s.addText('ตอนนี้ Redis ผูกกับ dankbkk-site อย่างเดียว โปรเจกต์ POS ยังไม่ได้ผูก — /api/staff-auth, /api/grok และ /api/storehub/* จำกัดจำนวนครั้งผ่านมันทั้งหมด',
    { x: 0.95, y: 2.48, w: 5.35, h: 0.85, fontFace: F, fontSize: 11, color: BODY, margin: 0, valign: 'top', lineSpacing: 14 });
  steps(s, [
    'Vercel → Storage → เลือก Redis ตัวที่มีอยู่แล้ว',
    'Connect Project → เลือก dank-medical-pos-app',
    'Redeploy โปรเจกต์ POS',
    'โค้ดรับได้ทั้งชื่อ UPSTASH_REDIS_REST_* และ KV_REST_API_* จึงไม่ต้องเปลี่ยนอะไรเพิ่ม',
  ], 0.95, 3.45, 5.35, 0.62);
  card(s, { x: 6.77, y: 1.78, w: 5.95, h: 4.9 });
  badge(s, 4, 7.1, 2.0, 0.42, GOLD, INK);
  s.addText('dankbkk-site (เว็บลูกค้า)', { x: 7.65, y: 1.98, w: 4.8, h: 0.36, fontFace: F, fontSize: 14, bold: true, color: INK, margin: 0, valign: 'middle' });
  s.addText('repo นั้นเป็น private และแยกจากตัวนี้ การแก้ชื่อตัวแปรใน api/_store.js ที่ทำใน POS จึงไปไม่ถึง ต้องเพิ่มชื่อสองตัวด้วยมือ',
    { x: 7.1, y: 2.48, w: 5.35, h: 0.85, fontFace: F, fontSize: 11, color: BODY, margin: 0, valign: 'top', lineSpacing: 14 });
  steps(s, [
    'เปิดโปรเจกต์ dankbkk-site → Settings → Environment Variables',
    'ก๊อปค่าจาก KV_REST_API_URL   ไปสร้าง UPSTASH_REDIS_REST_URL',
    'ก๊อปค่าจาก KV_REST_API_TOKEN ไปสร้าง UPSTASH_REDIS_REST_TOKEN',
    'Save แล้ว Redeploy',
  ], 7.1, 3.45, 5.35, 0.62);
  s.addNotes('Same Redis instance, two projects. The POS one is a Connect Project click; the site one needs two names copied by hand.');
}

/* ── 7. #5 STOREHUB_PUSH_ORDERS ──────────────────────────────────────────── */
{
  const s = light();
  heading(s, 'ข้อ 5 — เปิด STOREHUB_PUSH_ORDERS=1', 'On dankbkk-site. Until this is 1, every website order records stock: skipped — and the shop keeps selling what the site already sold');
  const chain = [
    { t: 'ลูกค้าสั่งบนเว็บ', e: 'order on site', c: FOREST },
    { t: '/api/order เก็บออเดอร์', e: 'order stored', c: FOREST },
    { t: 'จองสต็อกใน StoreHub', e: 'stock cut', c: RED },
    { t: 'แจ้ง LINE + อีเมล', e: 'LINE + email', c: FOREST },
  ];
  chain.forEach((c, i) => {
    const x = 0.62 + i * 3.16;
    s.addShape(p.ShapeType.roundRect, { x, y: 1.85, w: 2.76, h: 1.15, rectRadius: 0.1, fill: { color: PAPER }, line: { color: c.c, width: 1.75 } });
    s.addText(c.t, { x: x + 0.14, y: 2.0, w: 2.48, h: 0.42, fontFace: F, fontSize: 12, bold: true, color: INK, margin: 0, valign: 'middle' });
    s.addText(c.e, { x: x + 0.14, y: 2.42, w: 2.48, h: 0.32, fontFace: F, fontSize: 9.5, color: MUTE, margin: 0, valign: 'middle' });
    if (i < 3) s.addShape(p.ShapeType.line, { x: x + 2.8, y: 2.43, w: 0.32, h: 0, line: { color: MOSS, width: 2.25, endArrowType: 'triangle' } });
  });
  s.addText('ขั้นที่ 3 คือขั้นเดียวที่ตัดสต็อกจริง และมันจะไม่ทำงานเลยถ้าไม่ตั้งค่านี้',
    { x: 6.94, y: 3.1, w: 5.78, h: 0.35, fontFace: F, fontSize: 10.5, bold: true, color: RED, margin: 0 });
  card(s, { x: 0.62, y: 3.62, w: 6.05, h: 3.06 });
  s.addText('ทำยังไง', { x: 0.95, y: 3.82, w: 5.4, h: 0.32, fontFace: F, fontSize: 13, bold: true, color: INK, margin: 0 });
  steps(s, [
    'Vercel → dankbkk-site → Settings → Environment Variables',
    'STOREHUB_PUSH_ORDERS = 1  (เลขหนึ่ง ไม่ใช่ true)',
    'Save แล้ว Redeploy',
    'สั่งซื้อทดสอบ 1 ชิ้น แล้วดูว่า StoreHub สต็อกลดจริง',
  ], 0.95, 4.22, 5.4, 0.58);
  card(s, { x: 6.94, y: 3.62, w: 5.78, h: 3.06 });
  s.addText('เช็คได้ยังไงว่าตัดหรือไม่ตัด', { x: 7.25, y: 3.82, w: 5.16, h: 0.32, fontFace: F, fontSize: 13, bold: true, color: INK, margin: 0 });
  s.addText([
    { text: 'ทุกออเดอร์เก็บสถานะไว้ในตัวมันเอง และข้อความ LINE บอกด้วย:\n\n', options: { color: BODY, fontSize: 11 } },
    { text: 'cut', options: { bold: true, color: FOREST, fontSize: 11.5 } },
    { text: ' = ตัดสต็อกเรียบร้อย\n', options: { color: BODY, fontSize: 11 } },
    { text: 'skipped', options: { bold: true, color: GOLD, fontSize: 11.5 } },
    { text: ' = ยังไม่ได้ตั้ง env (สถานะตอนนี้)\n', options: { color: BODY, fontSize: 11 } },
    { text: 'failed', options: { bold: true, color: RED, fontSize: 11.5 } },
    { text: ' = ตัดไม่สำเร็จ ต้องนับมือ\n\n', options: { color: BODY, fontSize: 11 } },
    { text: 'รายการที่ไม่มี shId จะถูกใส่ใน needsManualCount ให้พนักงานหักเอง — เมื่อก่อนการข้ามนี้เงียบสนิท ร้านเลยขายของที่เว็บขายไปแล้ว',
      options: { color: MUTE, fontSize: 10 } },
  ], { x: 7.25, y: 4.18, w: 5.16, h: 2.3, fontFace: F, margin: 0, valign: 'top', lineSpacing: 14 });
  s.addNotes('The skip used to be silent. It now reports itself in the order record and in the LINE alert.');
}

/* ── 8. the Vercel walk-through ──────────────────────────────────────────── */
{
  const s = dark();
  heading(s, 'ขั้นตอนใน Vercel — ใช้กับข้อ 1–5 ทุกข้อ', 'One click path, and the mistake that wastes the whole trip', true);
  card(s, { x: 0.62, y: 1.75, w: 7.5, h: 4.95, fill: { color: INK2 }, line: { color: '24382A', width: 1 } });
  steps(s, [
    'เข้า vercel.com แล้วล็อกอินด้วยบัญชี GitHub เดิม',
    'หน้า Dashboard จะเห็นรายชื่อโปรเจกต์ — เลือกให้ถูกตัว\ndank-medical-pos-app = แอป POS  |  dankbkk-site = เว็บลูกค้า',
    'แถบบนของโปรเจกต์ → Settings',
    'เมนูซ้าย → Environment Variables',
    'ช่อง Key ใส่ชื่อตัวแปร · ช่อง Value ใส่ค่า · ติ๊ก Production, Preview, Development ให้ครบ → Save',
    'กลับไปแท็บ Deployments → กด ⋯ ที่บรรทัดบนสุด → Redeploy',
  ], 0.95, 2.2, 6.9, 0.75, true);
  s.addShape(p.ShapeType.roundRect, { x: 8.42, y: 1.75, w: 4.3, h: 2.4, rectRadius: 0.1, fill: { color: '3A1F1C' }, line: { color: RED, width: 1.5 } });
  s.addText('⚠ ข้อผิดพลาดที่เจอบ่อยที่สุด', { x: 8.72, y: 1.95, w: 3.7, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: 'F0A79C', margin: 0 });
  s.addText('ตั้งค่าแล้วไม่กด Redeploy\n\nค่าใหม่จะมีผลกับ deployment ที่สร้างหลังจากนั้นเท่านั้น ของเดิมที่รันอยู่ยังใช้ค่าเก่า — ดูเหมือนตั้งแล้วไม่ทำงาน ทั้งที่แค่ยังไม่ได้ deploy ใหม่',
    { x: 8.72, y: 2.35, w: 3.7, h: 1.65, fontFace: F, fontSize: 11, color: 'E4D2CF', margin: 0, valign: 'top', lineSpacing: 14 });
  s.addShape(p.ShapeType.roundRect, { x: 8.42, y: 4.32, w: 4.3, h: 2.38, rectRadius: 0.1, fill: { color: '1D3325' }, line: { color: FOREST, width: 1.5 } });
  s.addText('🔒 กฎเรื่องคีย์', { x: 8.72, y: 4.52, w: 3.7, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: MOSS, margin: 0 });
  s.addText('repo นี้เป็น public — ห้ามพิมพ์คีย์ PIN หรือ token ลงในโค้ด ใน commit หรือส่งมาในแชท ที่เดียวที่เก็บได้คือหน้า Environment Variables ของ Vercel\n\nถ้าเผลอส่งไปแล้ว ให้ถือว่าคีย์นั้นตายแล้ว — ไปเพิกถอนแล้วออกใหม่',
    { x: 8.72, y: 4.92, w: 3.7, h: 1.6, fontFace: F, fontSize: 10.5, color: 'CBDACD', margin: 0, valign: 'top', lineSpacing: 13.5 });
  s.addNotes('Setting the variable without redeploying is the single most common reason "it did not work".');
}

/* ── 9. #6 real costs ────────────────────────────────────────────────────── */
{
  const s = light();
  heading(s, '🥇 ข้อ 6 — ใส่ต้นทุนจริงใน StoreHub (คุ้มที่สุดในลิสต์)', 'Every margin, the net profit and every pricing decision is only as good as this number');
  s.addImage({ path: path.join(IMG, '04-sku-table.png'), x: 0.62, y: 1.8, w: 7.15, h: 3.81 });
  s.addText('ภาพจริงจากแอป · กด 📋 กำไรต่อสินค้า ที่หน้า Dashboard — เครื่องหมาย ~ คือตัวที่ยังเดาต้นทุนให้',
    { x: 0.62, y: 5.68, w: 7.15, h: 0.4, fontFace: F, fontSize: 9.5, color: MUTE, margin: 0 });
  card(s, { x: 8.05, y: 1.8, w: 4.67, h: 4.9 });
  s.addText('ทำไมข้อนี้สำคัญที่สุด', { x: 8.35, y: 2.0, w: 4.07, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: INK, margin: 0 });
  s.addText([
    { text: 'แอปบอกอยู่แล้วว่ารายได้กี่ % ที่ยืนอยู่บนต้นทุนจริง (ตัวอย่างในภาพ 79.8%) ส่วนที่เหลือเป็นค่าประมาณตามหมวด ตัวเลขกำไรทุกตัวจึงคลาดเคลื่อนตามนั้น\n\n', options: { color: BODY, fontSize: 11 } },
    { text: 'นี่ไม่ใช่งานเขียนโปรแกรม เป็นงานคีย์ข้อมูล — และเป็นข้อที่ให้ผลตอบแทนสูงสุดในลิสต์ทั้งหมด', options: { color: BODY, fontSize: 11, bold: true } },
  ], { x: 8.35, y: 2.4, w: 4.07, h: 1.5, fontFace: F, margin: 0, valign: 'top', lineSpacing: 14.5 });
  steps(s, [
    'เปิด docs/sku-summary.pdf — เป็นใบงานที่พิมพ์ไปนั่งกรอกได้',
    'ในแอป กด ↓ ตารางกำไรทุก SKU เพื่อโหลด CSV — ช่อง no-cost คือรายการที่ยังไม่มีต้นทุน',
    'ไล่ใส่ใน StoreHub เริ่มจากตัวขายดีก่อน ไม่ต้องทำครบทีเดียว',
    'กด 🔄 ในแอปเพื่อ sync ใหม่ แล้วดูว่า % ต้นทุนจริงขยับขึ้น',
  ], 8.35, 4.0, 4.07, 0.62);
  s.addNotes('The app reports its own trust level. Filling costs raises it; nothing else does.');
}

/* ── 10. #7 branch budgets ───────────────────────────────────────────────── */
{
  const s = light();
  heading(s, 'ข้อ 7 — ใส่งบค่าใช้จ่าย เพชรบูรณ์ และ ภูเก็ต', 'Both sit at 0, so those branches show no fixed cost and their net profit reads too high');
  s.addImage({ path: path.join(IMG, '06-budget.png'), x: 0.62, y: 1.85, w: 7.6, h: 2.57 });
  s.addText('ภาพจริงจากแอป — Petchaboon และ Phuket ยังเป็น 0',
    { x: 0.62, y: 4.52, w: 7.6, h: 0.35, fontFace: F, fontSize: 9.5, color: MUTE, margin: 0 });
  card(s, { x: 0.62, y: 5.1, w: 7.6, h: 1.08 });
  s.addText('ต้องล็อกอินด้วยสิทธิ์ Master/CEO เท่านั้นถึงจะเห็นปุ่ม ✏ แก้งบ — พนักงานทั่วไปแก้ตัวเลขงบไม่ได้ และทุกครั้งที่บันทึกจะลง Audit Log ว่าใครแก้',
    { x: 0.95, y: 5.28, w: 6.95, h: 0.75, fontFace: F, fontSize: 11.5, color: BODY, margin: 0, valign: 'top', lineSpacing: 15 });
  card(s, { x: 8.6, y: 1.85, w: 4.12, h: 4.83 });
  s.addText('เส้นทางในแอป', { x: 8.9, y: 2.05, w: 3.52, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: INK, margin: 0 });
  steps(s, [
    'ล็อกอินด้วย PIN ของเจ้าของ',
    'แท็บ 💰 การเงิน',
    'ปุ่มย่อย 💸 ค่าใช้จ่าย Expenses',
    'กด ✏ แก้งบ Edit Budget',
    'ใส่ตัวเลขต่อเดือนของแต่ละสาขา',
    'กด 💾 บันทึกงบ + ลง Audit',
  ], 8.9, 2.45, 3.52, 0.58);
  s.addText('แอปหารเป็นรายวันให้เอง (÷30) และจำกัดจำนวนวันไว้เท่าที่ผ่านมาจริงในเดือนนั้น',
    { x: 8.9, y: 6.0, w: 3.52, h: 0.55, fontFace: F, fontSize: 9.5, color: MUTE, margin: 0, valign: 'top', lineSpacing: 12 });
  s.addNotes('Owner-only by design; every save is written to the audit log.');
}

/* ── 11. #8 product images ───────────────────────────────────────────────── */
{
  const s = light();
  heading(s, 'ข้อ 8 — สร้างรูปสินค้า 41 รายการ', 'The plumbing is finished; the pictures are what is missing');
  card(s, { x: 0.62, y: 1.78, w: 6.1, h: 4.9 });
  s.addText('ไฟล์ที่เตรียมไว้ให้แล้ว', { x: 0.95, y: 1.98, w: 5.5, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: INK, margin: 0 });
  s.addText([
    { text: 'docs/botanical-legends-prompts.pdf\n', options: { bold: true, color: FOREST, fontSize: 11.5 } },
    { text: 'คำสั่งเจนรูป 41 รายการ ในสไตล์การ์ด BOTANICAL LEGENDS ของร้านเอง\n\n', options: { color: BODY, fontSize: 10.5 } },
    { text: 'handoff/image-jobs.json\n', options: { bold: true, color: FOREST, fontSize: 11.5 } },
    { text: 'ไฟล์เดียวกันในรูปแบบที่ ChatGPT/Codex อ่านต่อได้ทันที\n\n', options: { color: BODY, fontSize: 10.5 } },
    { text: 'handoff/README-CHATGPT.md\n', options: { bold: true, color: FOREST, fontSize: 11.5 } },
    { text: 'คู่มือเต็ม ว่าอัปโหลดอะไร สั่งอะไร', options: { color: BODY, fontSize: 10.5 } },
  ], { x: 0.95, y: 2.38, w: 5.5, h: 2.35, fontFace: F, margin: 0, valign: 'top', lineSpacing: 14 });
  s.addShape(p.ShapeType.roundRect, { x: 0.95, y: 4.85, w: 5.5, h: 1.6, rectRadius: 0.1, fill: { color: 'FBF3DE' }, line: { color: GOLD, width: 1.25 } });
  s.addText([
    { text: 'ใช้ promptB_artOnly เท่านั้นสำหรับแอปและเว็บ\n', options: { bold: true, color: '7A5A0E', fontSize: 11 } },
    { text: 'ตัว POS วาดชื่อสินค้ากับราคาทับลงบนรูปเองอยู่แล้ว ถ้าใช้การ์ดที่มีตัวหนังสือฝังมา (promptA) จะกลายเป็นพิมพ์ซ้อนสองชั้น · promptA (3:2 มีตัวหนังสือ) เก็บไว้ใช้กับ IG และป้ายเมนู',
      options: { color: '6B5A2A', fontSize: 9.5 } },
  ], { x: 1.2, y: 5.0, w: 5.0, h: 1.3, fontFace: F, margin: 0, valign: 'top', lineSpacing: 13 });
  card(s, { x: 7.05, y: 1.78, w: 5.67, h: 4.9 });
  s.addText('ทำเสร็จแล้วเอาเข้าระบบยังไง', { x: 7.35, y: 1.98, w: 5.07, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: INK, margin: 0 });
  steps(s, [
    'อัปโหลด image-jobs.json เข้า ChatGPT แล้วสั่งให้เจนตาม promptB_artOnly',
    'เซฟไฟล์ลงโฟลเดอร์ assets/products/ ตั้งชื่อไฟล์ให้ตรงกับ id ในไฟล์งาน',
    'รัน node handoff/apply-images.mjs --dry เพื่อดูก่อนว่าจะเปลี่ยนกี่รายการ',
    'ถ้าจำนวนตรงกับไฟล์ที่ใส่ ค่อยรันจริงโดยตัด --dry ออก',
    'commit แล้ว Vercel deploy เอง',
  ], 7.35, 2.42, 5.07, 0.72);
  s.addText('ตอนนี้ products.json มีรูปแค่ 53 จาก ~395 SKU ที่ขายจริง · ตัวที่ไม่มีรูปจะแสดงอิโมจิของหมวดแทน ไม่พัง',
    { x: 7.35, y: 6.06, w: 5.07, h: 0.5, fontFace: F, fontSize: 9.5, color: MUTE, margin: 0, valign: 'top', lineSpacing: 12 });
  s.addNotes('promptB is the art-only variant. promptA has lettering baked in and is for IG and menu boards.');
}

/* ── 12. decisions ───────────────────────────────────────────────────────── */
{
  const s = light();
  heading(s, 'ข้อ 9–11 — สามเรื่องที่รอเจ้าของตัดสินใจ', 'Nobody else can answer these, and each one is blocking a cleanup');
  const q = [
    { n: 9, th: 'ลบโปรเจกต์ Vercel ที่ซ้ำ', en: 'dankbkk-site-4jrn · ตรวจแล้ว ลบได้เลย',
      body: 'เช็คกับ Vercel แล้ว: dankbkk-site ถือ dankbangkok.com และ www.dankbangkok.com — ตัวนี้คือของจริง เก็บไว้ · dankbkk-site-4jrn ไม่มีโดเมนของร้านเลย มีแต่ URL .vercel.app ของตัวเอง และไม่มีโค้ดตรงไหนเรียกใช้ · ทั้งคู่ผูก repo เดียวกัน push ทีนึงจึง build สองรอบ',
      ask: 'Vercel → dankbkk-site-4jrn → Settings → เลื่อนลงล่างสุด → Delete Project  (ผมลบให้ไม่ได้ เครื่องมือที่ต่ออยู่อ่านได้อย่างเดียว)' },
    { n: 10, th: 'ไฟล์ HTML ที่ค้างอยู่ใน repo POS', en: '5 files + i18n.js',
      body: 'staff.html · build-your-joint.html · labels.html · status.html · SUMMARY.html และ i18n.js ที่ทั้งสี่ไฟล์เรียกใช้ — เป็นของเว็บลูกค้าแต่มาอยู่ใน repo นี้',
      ask: 'ไฟล์ไหนยังใช้อยู่จริงในแต่ละวัน — ผมไม่ลบเองจนกว่าจะได้คำตอบ' },
    { n: 11, th: 'เมนูของเว็บลูกค้าจะเอาจากไหน', en: '53 curated vs 395 raw',
      body: 'products.json 53 รายการ ชื่อสวย มีรูป · หรือ feed จาก POS 395 รายการที่ใช้อยู่ตอนนี้ ซึ่งมีชื่ออย่าง "( Bar ) Tequila shot" โผล่บนเว็บ',
      ask: 'เลือกอย่างใดอย่างหนึ่ง แล้วผมตั้ง POS_FEED_PATHS ให้ตรงกัน' },
  ];
  q.forEach((c, i) => {
    const x = 0.62 + i * 4.08;
    card(s, { x, y: 1.78, w: 3.86, h: 4.9 });
    badge(s, c.n, x + 0.28, 2.0, 0.44, '4A6E8A', PAPER);
    s.addText(c.th, { x: x + 0.28, y: 2.58, w: 3.3, h: 0.6, fontFace: F, fontSize: 14, bold: true, color: INK, margin: 0, valign: 'top', lineSpacing: 18 });
    s.addText(c.en, { x: x + 0.28, y: 3.2, w: 3.3, h: 0.3, fontFace: F, fontSize: 9.5, color: MUTE, margin: 0 });
    s.addText(c.body, { x: x + 0.28, y: 3.6, w: 3.3, h: 1.6, fontFace: F, fontSize: 10.5, color: BODY, margin: 0, valign: 'top', lineSpacing: 14 });
    s.addShape(p.ShapeType.roundRect, { x: x + 0.28, y: 5.2, w: 3.3, h: 1.24, rectRadius: 0.08, fill: { color: 'EDF3EC' } });
    s.addText([{ text: 'ต้องการคำตอบ: ', options: { bold: true, color: FOREST, fontSize: 10 } },
               { text: c.ask, options: { color: BODY, fontSize: 10 } }],
      { x: x + 0.44, y: 5.32, w: 2.98, h: 1.0, fontFace: F, margin: 0, valign: 'top', lineSpacing: 13 });
  });
  s.addNotes('Three questions. Each answer unblocks a cleanup I am deliberately not doing on my own.');
}

/* ── 13. done, do not re-ask ─────────────────────────────────────────────── */
{
  const s = light();
  heading(s, 'เสร็จแล้วและตรวจแล้ว — ไม่ต้องถามซ้ำ', 'Built, tested and live. Two of these were asked for twice because nobody could find them.');
  /* two rows, captions on a shared baseline so the row reads as a row —
   * the images have very different aspect ratios, so each one is centred
   * inside its cell rather than stretched to a common height */
  const CAP1 = 3.22, CAP2 = 5.86;
  const cell = (f, x, w, h, top, capY, th, en, capW) => {
    s.addImage({ path: path.join(IMG, f), x, y: top, w, h });
    s.addText(th, { x, y: capY, w: capW || w, h: 0.32, fontFace: F, fontSize: 12, bold: true, color: INK, margin: 0 });
    s.addText(en, { x, y: capY + 0.32, w: capW || w, h: 0.34, fontFace: F, fontSize: 9.5, color: MUTE, margin: 0 });
  };
  cell('05-debtors.png', 0.62, 5.9, 1.2, 1.86, CAP1, 'ลูกหนี้ค้างชำระ', 'Finance · การ์ดบนหน้า Dashboard พาไปให้แล้ว');
  cell('09-period.png', 6.82, 5.9, 0.63, 2.15, CAP1, 'ปุ่ม ◀ ▶ เลื่อนวัน/เดือน', 'Dashboard · เลื่อนย้อนหลังได้ทุกช่วง แล้วกด ✕ กลับวันนี้');
  cell('07-team.png', 0.62, 5.9, 1.75, 3.98, CAP2, 'มุมมองหัวหน้า — ใครงานล้น ใครส่งตรงเวลา', 'Work · ปุ่มย่อย ทีม Team');
  cell('02-tabbar.png', 6.82, 2.5, 1.26, 4.24, CAP2, 'มือถือเหลือ 5 แท็บ', 'Shift · POS · Stock · CRM · More', 2.5);
  s.addShape(p.ShapeType.roundRect, { x: 9.62, y: 3.98, w: 3.1, h: 2.5, rectRadius: 0.1, fill: { color: 'EDF3EC' } });
  s.addText('เสร็จแล้วด้วย', { x: 9.86, y: 4.14, w: 2.62, h: 0.3, fontFace: F, fontSize: 11.5, bold: true, color: FOREST, margin: 0 });
  s.addText('· รูปสินค้าตรงกันทั้ง POS และเว็บ (เทสต์เทียบ 430 ชื่อ)\n· ราคาเมนูรวม VAT ตรงกับหน้าร้าน\n· ผู้ช่วยตอบชื่อสินค้าและสูตรบาร์ได้เอง\n· เปิด/ปิดกะมีเช็คลิสต์ 7 ข้อ ลง Audit\n· บาร์ 14 สูตร พร้อมต้นทุนต่อแก้ว',
    { x: 9.86, y: 4.5, w: 2.62, h: 1.85, fontFace: F, fontSize: 9.5, color: BODY, margin: 0, valign: 'top', lineSpacing: 13 });
  s.addNotes('The debtor ledger and the SKU margin table were both requested twice — they existed, just buried.');
}

/* ── 14. the order of work ───────────────────────────────────────────────── */
{
  const s = dark();
  heading(s, 'ทำตามลำดับนี้', 'Do them in this order — the first three take one visit to Vercel', true);
  const rows = [
    { n: 1, th: 'ตั้ง MASTER_PIN + MASTER_NAME แล้ว Redeploy', en: 'the only thing blocking login', t: '5 นาที', c: RED },
    { n: 2, th: 'ใส่ XAI_API_KEY + GROK_MODEL ในรอบเดียวกัน', en: 'unlocks free-text AI answers', t: '2 นาที', c: GOLD },
    { n: 3, th: 'Connect Redis เข้ากับโปรเจกต์ POS', en: 'makes the PIN-guess limit real', t: '3 นาที', c: GOLD },
    { n: 4, th: 'ตั้ง STOREHUB_PUSH_ORDERS=1 + สอง UPSTASH_* บน dankbkk-site', en: 'website orders start cutting stock', t: '5 นาที', c: GOLD },
    { n: 5, th: 'ใส่ต้นทุนจริงใน StoreHub เริ่มจากตัวขายดี', en: 'highest value on the whole list', t: 'ทำเรื่อย ๆ', c: MOSS },
    { n: 6, th: 'ใส่งบเพชรบูรณ์/ภูเก็ต ในแอป', en: 'Finance → 💸 → ✏ แก้งบ', t: '2 นาที', c: MOSS },
    { n: 7, th: 'ตอบสามคำถามหน้าที่แล้ว', en: 'unblocks three cleanups', t: 'แค่ตอบ', c: '7FA8C4' },
  ];
  rows.forEach((r, i) => {
    const y = 1.72 + i * 0.735;
    s.addShape(p.ShapeType.roundRect, { x: 0.62, y, w: 12.1, h: 0.63, rectRadius: 0.08, fill: { color: INK2 } });
    badge(s, r.n, 0.82, y + 0.145, 0.34, r.c, INK);
    s.addText(r.th, { x: 1.34, y: y + 0.04, w: 8.0, h: 0.32, fontFace: F, fontSize: 12.5, bold: true, color: PAPER, margin: 0, valign: 'middle' });
    s.addText(r.en, { x: 1.34, y: y + 0.33, w: 8.0, h: 0.26, fontFace: F, fontSize: 9.5, color: '8C9C90', margin: 0, valign: 'middle' });
    s.addText(r.t, { x: 9.6, y, w: 2.9, h: 0.63, fontFace: F, fontSize: 11, bold: true, color: r.c, margin: 0, align: 'right', valign: 'middle' });
  });
  s.addText('ข้อ 1–4 คือหน้า Vercel ทั้งหมด ทำรวดเดียวได้ในครั้งเดียว · ข้อ 5–6 อยู่ในแอปและ StoreHub · ข้อ 7 แค่ตอบกลับมา',
    { x: 0.62, y: 6.92, w: 12.1, h: 0.35, fontFace: F, fontSize: 10.5, color: MOSS, margin: 0 });
  s.addNotes('Items 1 to 4 are one visit to Vercel. Item 5 is ongoing data entry and is the one that changes the numbers most.');
}

p.writeFile({ fileName: OUT }).then(() => console.log('wrote ' + OUT));
