# งานถัดไป / Next up — a work queue for Codex

repo: `bryank31172-web/dank-medical-pos-app` (public) · branch `main` → deploys to
https://dank-medical-pos-app.vercel.app

**อ่าน `AGENTS.md` ก่อนแตะโค้ด** — สามกับดักที่ทำพังแน่นอนถ้าไม่รู้อยู่ในนั้น
*Read `AGENTS.md` first; the three traps that break this repo on day one are in it.*

---

## กติกาของคิวนี้ / How to work this queue

1. **หนึ่งงาน = หนึ่ง branch = หนึ่ง PR.** แอปเป็นไฟล์เดียว ~1.9MB — PR ที่รวมหลายงาน
   รีวิวไม่ไหวและ revert ไม่ได้ *One task per branch and PR; a combined PR in a
   single-file app cannot be reviewed or reverted.*
2. **ห้าม push เข้า `main` ตรง ๆ** — `main` deploy ขึ้นร้านจริงทันที
3. หลังแก้ JSX เสมอ: `npm run pos:build` แล้ว **commit `index.html` ด้วย** ไม่งั้นของจริงไม่เปลี่ยน
4. ก่อนเปิด PR: `npm test` ต้องผ่าน และงานที่แตะ UI ต้องรัน `npm run ux:audit` แล้วแนบตัวเลขก่อน/หลัง
5. **เกณฑ์ผ่านต้องวัดได้** ทุกงานข้างล่างมีตัวเลขกำกับ — "รู้สึกว่าดีขึ้น" ไม่นับ

### สถานะตอนนี้ / Where things stand

| | |
|---|---|
| Tests | 13 ไฟล์ · `npm test` = ~170 assertions ผ่านหมด |
| Browser tests | 3 ไฟล์ ต้องเสิร์ฟผ่าน HTTP ก่อน (`npm run serve`) |
| UX baseline | `horizontalScroll: true` · เป้ากดเล็กกว่า 44px: **47** · ตัวหนังสือ < 12px: **151** |
| Deploy | `vercel.json` ปัก `buildCommand: ""` — **อย่าเพิ่ม npm script ชื่อ `build`** deploy จะตายทันที |

---

## 🔴 P1 — UI ที่พนักงานเจอทุกวัน

งานพวกนี้มีรายละเอียดเต็มใน **`docs/UX-UI-Apple-Brief.md`** (มี PDF ด้วย) อ่านข้อนั้นก่อนลงมือ

### 1. แท็บ 21 อัน → 5 + More
ตอนนี้แถบแท็บกว้าง **686px บนจอ 390px** พนักงานต้องเลื่อนแถบแท็บเพื่อหาแท็บ
ป้ายชื่อแท็บเป็นตัวอักษร **8px**

- แก้ที่ `TABS` และ `MORE_IDS` ใน `pos/app.fixed.jsx` (มีแนวคิด "แท็บรอง" อยู่แล้ว ยังไม่ได้ใช้)
- เดสก์ท็อปคงเดิมได้ — แยกด้วยตัวแปร `mob` ที่มีอยู่
- **ผ่านเมื่อ:** `npm run ux:audit` รายงาน `horizontalScroll: false` และ `docWidth === 390`

### 2. เป้ากดขั้นต่ำ 44×44
47 ปุ่มเล็กเกินนิ้ว รวมปุ่มเลือกสาขาที่สูง **19px** — ร้านใช้แท็บเล็ต มือเปียก

- ใส่ `minHeight:44, minWidth:44` ที่ token `gs.btn` / `gs.btnLg` / `gs.chip` แล้วไล่เก็บที่เหลือ
- ปุ่มไอคอนล้วนต้องมี `aria-label` — ตอนนี้ยังไม่มี
- **ผ่านเมื่อ:** `smallTargets` ใน `docs/ux-shots/audit.json` = 0

### 3. หน้าขายมีแถบเลื่อนแนวนอน 4 ชั้นก่อนถึงสินค้า
เหลือแถวเดียว (หมวดสินค้า) · สาขา+โต๊ะ ย้ายขึ้นแถบบน · ปุ่มลัด 6 อันเข้า sheet

- **ผ่านเมื่อ:** การ์ดสินค้าใบแรกอยู่สูงกว่าเดิม ≥250px ที่จอ 390px (วัดด้วย `getBoundingClientRect().top`)

---

## 🟡 P2 — ของที่ค้างครึ่งทาง

### 4. รูปสินค้า — ท่อประปาเสร็จแล้ว รูปยังไม่มา
`products.json` มีรูปแค่ 53 จาก ~395 SKU ที่ขายจริง

- prompt พร้อมใช้: `handoff/image-jobs.json` (ใช้ field **`promptB_artOnly`** เท่านั้น)
- วางไฟล์ใน `assets/products/` ตั้งชื่อ = `id` แล้วรัน `node handoff/apply-images.mjs --dry`
- คู่มือเต็ม: `handoff/README-CHATGPT.md`
- **ผ่านเมื่อ:** dry-run รายงานจำนวน repoint ตรงกับจำนวนไฟล์ที่ใส่ และ `npm test` ยังเขียว

### 5. ชั้น 3–4 ของระบบติดตามงาน (ถ้าเจ้าของอยากได้)
ชั้น 1 (พนักงานอัปเดตเอง) และ 2 (ผู้จัดการเห็นใครงานล้น) ทำแล้วใน Work Board
ชั้น 3 (ผลลัพธ์รายแผนก) กับ 4 (จอ CEO) **ยังไม่ได้ทำ — และอาจไม่ต้องทำ**
Dashboard กับ Finance ทำหน้าที่นั้นเกือบหมดแล้วสำหรับร้านขนาดนี้

> ⚠ อย่าเริ่มข้อนี้จนกว่าเจ้าของจะบอกว่าแบ่งเป็นแผนกอะไรบ้าง มิฉะนั้นจะได้หน้าจอซ้ำกับของเดิม

### 6. ลบไฟล์ HTML ที่เป็นของเว็บลูกค้าแต่มาอยู่ใน repo POS
`staff.html`, `build-your-joint.html`, `labels.html`, `status.html`, `SUMMARY.html`, `i18n.js`

> ⚠ **ต้องรอเจ้าของยืนยันก่อนว่าไฟล์ไหนยังใช้อยู่** ห้ามลบเอง

---

## 🟢 P3 — งานที่ทำเงียบ ๆ ได้ ไม่ต้องถาม

### 7. เพิ่ม browser test ให้แท็บที่ยังไม่มี
ตอนนี้มีเทสต์เบราว์เซอร์แค่ bar / shift / claim-pin — Stock, CRM, Finance, Work ยังไม่มี
รูปแบบให้ลอก: `pos/__tests__/shift-checklist.test.mjs`
**ผ่านเมื่อ:** เดินครบทุกแท็บแล้ว `pageerror` = 0

### 8. ตัวเลข `fontSize:` เขียนตรง ๆ 1,440 จุด
สร้าง type scale ตามที่เสนอไว้ใน UX brief แล้วไล่แทนทีละแท็บ **เริ่มที่ POS กับ Stock**
ทำทีละแท็บ แยก PR — อย่าแก้ 1,440 จุดใน PR เดียว

---

## ⛔ สิ่งที่ Codex ทำไม่ได้ — เป็นงานของเจ้าของ

ทั้งหมดนี้อยู่ในหน้าเว็บ Vercel ไม่ใช่ในโค้ด **อย่าพยายามแก้ด้วยการเขียนโค้ด**

1. ตั้ง `MASTER_PIN` (ตัวใหม่ — 110114 เผาไปแล้ว) → **Redeploy** · นี่คือตัวบล็อกเดียวที่เหลือ
2. ตั้ง `XAI_API_KEY` → 🤖 ตอบคำถามอิสระได้ (ถามชื่อสินค้า/สูตรบาร์ ทำงานอยู่แล้วโดยไม่ต้องมีคีย์)
3. ต่อ Upstash Redis เข้ากับ project `dank-medical-pos-app`
4. `STOREHUB_PUSH_ORDERS=1` — **ถ้าไม่ตั้ง ออเดอร์จากเว็บจะไม่ตัดสต็อก** (โค้ดพร้อมแล้ว)
5. ตั้งงบค่าใช้จ่าย เพชรบูรณ์/ภูเก็ต ในแอป (Finance → 💸 → ✏ แก้งบ)

---

## ห้ามแตะ / Do not touch

เหตุผลเต็มอยู่ใน `AGENTS.md` และ `CLAUDE.md` — ทุกข้อเคยเป็นบั๊กจริงมาแล้ว

- **พาเลตต์สีเขียวเข้ม** ถูกแล้ว ปัญหาคือ*ไม่มีสเกล* ไม่ใช่*สีผิด*
- **`inkOn()`** มีเพราะเคยเจอชื่อสินค้าคอนทราสต์ 1.05:1
- **`withVat()`** StoreHub เก็บราคาไม่รวม VAT — เอาออกแล้วทั้งเว็บจะขายถูกกว่าหน้าร้าน 7%
- **`api/_photos.js`** ต้องเหมือน `webKey()`/`webImgFor()` ใน JSX เป๊ะ ๆ มีเทสต์เทียบ 430 ชื่อ
- **นับสต็อกเกิน = mismatch ไม่ใช่ OK** · **ตาชั่ง 0.039 ต้องเป็น 0.039 ห้ามปัด**
- **repo เป็น public** ห้าม commit คีย์/PIN/token ทุกชนิด

---

## ประโยคที่วางให้ Codex ได้เลย

```
repo: bryank31172-web/dank-medical-pos-app · branch main

อ่าน AGENTS.md แล้วต่อด้วย docs/NEXT-FOR-CODEX.md

ทำงาน P1 ข้อ 1 อย่างเดียวก่อน (แท็บ 21 อัน -> 5 + More)
- แตก branch ใหม่ อย่า push เข้า main
- แก้ pos/app.fixed.jsx เท่านั้น แล้ว npm run pos:build และ commit index.html ด้วย
- ก่อนเปิด PR รัน npm test ให้ผ่าน
- รัน npm run ux:audit แล้วรายงานตัวเลขก่อน/หลัง
  เกณฑ์ผ่าน: horizontalScroll เปลี่ยนจาก true เป็น false

ถ้าติดอะไรที่ต้องตัดสินใจ ถามก่อน อย่าเดา
```
