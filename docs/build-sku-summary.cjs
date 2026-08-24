/* Rebuild docs/sku-summary.pdf and .csv from products.json.
 *
 *   node docs/build-sku-summary.cjs        (or: npm run docs:sku)
 *
 * Prices come from the catalogue; cost and average sold price do not exist
 * outside StoreHub, so the sheet leaves them as columns to fill in rather than
 * inventing them. The in-app export (Stats -> SKU margin CSV) is the one that
 * carries the real numbers for all ~395 counter SKUs.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const ROOT = path.resolve(__dirname, "..");
const SP = fs.mkdtempSync(path.join(os.tmpdir(), "sku-"));
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const baht = (n) => "฿" + Math.round(+n || 0).toLocaleString();

const items = JSON.parse(fs.readFileSync(`${ROOT}/products.json`, "utf8"));

/* the shop sells flower by tier, everything else at one price — the "unit
   price" that a cost sits against is the 1g tier for flower, the flat price
   otherwise, so that is what the margin columns will be filled in against */
const ORDER = ["Exotics", "Topshelf", "Midgrade", "Premium", "Joints", "Vapes", "Edibles", "Beer", "Accessories", "Merch"];
function unitRow(p) {
  const tiers = Array.isArray(p.priceTiers) ? p.priceTiers : [];
  if (tiers.length) {
    const one = tiers.find((t) => /^1\s*g$/i.test(String(t.label).trim())) || tiers[tiers.length - 1];
    return { price: +one.price || 0, member: +one.member || 0, basis: String(one.label).trim() };
  }
  return { price: +p.price || 0, member: +p.member || 0, basis: p.unit || "pc" };
}

const rows = items.map((p) => {
  const u = unitRow(p);
  const disc = u.price > 0 && u.member > 0 ? Math.round((1 - u.member / u.price) * 1000) / 10 : null;
  return {
    name: p.name, cat: p.category || "Other", unit: p.unit || "pc",
    basis: u.basis, price: u.price, member: u.member, disc,
    stock: +p.stock || 0, code: p.code || "",
    tiers: (Array.isArray(p.priceTiers) ? p.priceTiers : []).map((t) => `${t.label} ${baht(t.price)}`).join(" · "),
  };
});

const byCat = {};
rows.forEach((r) => { (byCat[r.cat] = byCat[r.cat] || []).push(r); });
const cats = ORDER.filter((c) => byCat[c]).concat(Object.keys(byCat).filter((c) => !ORDER.includes(c)));
cats.forEach((c) => byCat[c].sort((a, b) => b.price - a.price));

const withPrice = rows.filter((r) => r.price > 0);
const noPrice = rows.filter((r) => !(r.price > 0));
const avgPrice = withPrice.length ? Math.round(withPrice.reduce((s, r) => s + r.price, 0) / withPrice.length) : 0;
const stockValue = rows.reduce((s, r) => s + r.stock * r.price, 0);

const row = (r, i) => `<tr>
  <td class="n">${i}</td>
  <td><b>${esc(r.name)}</b>${r.tiers ? `<div class="t">${esc(r.tiers)}</div>` : ""}</td>
  <td class="c">${esc(r.basis)}</td>
  <td class="r">${r.price ? baht(r.price) : '<span class="warn">ยังไม่ตั้งราคา</span>'}</td>
  <td class="r">${r.member ? baht(r.member) : "—"}</td>
  <td class="r">${r.disc === null ? "—" : r.disc + "%"}</td>
  <td class="fill"></td><td class="fill"></td><td class="fill"></td><td class="fill"></td>
</tr>`;

const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>SKU Summary</title><style>
@page{size:A4 landscape;margin:11mm 10mm 12mm}
*{box-sizing:border-box}
body{font-family:"Loma",Arial,sans-serif;color:#16211b;font-size:8.6pt;line-height:1.4;margin:0}
h1{font-size:20pt;margin:0 0 1mm;color:#0f2a1b;letter-spacing:-.4pt}
.sub{color:#5b6b61;font-size:9.2pt;margin-bottom:3.5mm}
.kpis{display:flex;gap:4mm;margin-bottom:4mm;flex-wrap:wrap}
.k{border:1px solid #d8e6dd;border-left:2.5pt solid #2f6b45;border-radius:2mm;padding:2mm 4mm;background:#f7fbf8}
.k b{display:block;font-size:14pt;color:#0f2a1b;line-height:1.15}
.k span{font-size:7.4pt;color:#5b6b61}
.note{background:#fdf6e8;border:1px solid #e9d3a2;border-radius:2mm;padding:3mm 4mm;margin-bottom:4mm;font-size:8.4pt}
.note b{color:#8a5a12}
h2{font-size:11pt;margin:5mm 0 1.5mm;color:#2f6b45;page-break-after:avoid}
h2 span{font-size:8pt;color:#7b8a81;font-weight:normal}
table{width:100%;border-collapse:collapse;page-break-inside:auto}
th{background:#2f6b45;color:#fff;text-align:left;padding:1.5mm 2mm;font-size:7.6pt;font-weight:bold}
th.fill{background:#8a5a12}
td{padding:1.3mm 2mm;border-bottom:1px solid #e6ede9;vertical-align:top;font-size:8.2pt}
tr:nth-child(even) td{background:#f8fbf9}
td.n{color:#9aa8a0;font-size:7pt;width:7mm}
td.r{text-align:right;white-space:nowrap}
td.c{white-space:nowrap;color:#5b6b61;font-size:7.6pt}
td.fill{background:#fffdf6;border-left:1px dashed #d9c48f;min-width:18mm}
tr:nth-child(even) td.fill{background:#fffaf0}
.t{font-size:6.9pt;color:#7b8a81;margin-top:.4mm}
.warn{color:#b3413f;font-weight:bold}
.foot{margin-top:5mm;font-size:7.6pt;color:#6b7a71;border-top:1px solid #d8e6dd;padding-top:2mm}
</style></head><body>

<h1>สรุปสินค้าทุกรายการ · SKU Summary</h1>
<div class="sub">DANK Cannabis Clinic Bangkok · แคตตาล็อก ${rows.length} รายการ · ราคาต่อหน่วยหลัก (ดอกไม้คิดที่ 1g)</div>

<div class="kpis">
  <div class="k"><b>${rows.length}</b><span>SKU ในแคตตาล็อก</span></div>
  <div class="k"><b>${cats.length}</b><span>หมวดสินค้า</span></div>
  <div class="k"><b>${baht(avgPrice)}</b><span>ราคาเฉลี่ยต่อหน่วย</span></div>
  <div class="k"><b>${baht(stockValue)}</b><span>มูลค่าสต็อกตามราคาขาย</span></div>
  ${noPrice.length ? `<div class="k" style="border-left-color:#b3413f;background:#fdf6f6"><b>${noPrice.length}</b><span>ยังไม่ตั้งราคา</span></div>` : ""}
</div>

<div class="note">
  <b>ช่องสีเหลืองเว้นไว้ให้กรอกด้วยมือ</b> — ต้นทุนกับราคาขายเฉลี่ยอยู่ใน StoreHub เท่านั้น
  ผมดึงจากที่นี่ไม่ได้ ตารางนี้เลยทำเป็น<b>ใบงานสำหรับไปกรอกต้นทุน</b> ซึ่งเป็นงานที่ทำให้ตัวเลขกำไรทุกตัวในแอปเป็นของจริง<br>
  <span style="font-size:7.8pt;color:#6b5a3a">อยากได้ตัวเลขครบทั้ง ~395 SKU พร้อมต้นทุนและยอดขายเฉลี่ยจริง: เปิดแอป → Stats → ⬇ ตารางกำไรทุก SKU</span>
</div>

${cats.map((c) => {
  const list = byCat[c];
  const sum = list.reduce((s, r) => s + r.price, 0);
  return `<h2>${esc(c)} <span>${list.length} รายการ · ราคาเฉลี่ย ${baht(list.length ? sum / list.length : 0)}</span></h2>
<table>
<tr><th style="width:7mm"></th><th>สินค้า / Product</th><th>คิดที่</th><th class="r">ราคาป้าย</th><th class="r">ราคาสมาชิก</th><th class="r">ส่วนลด</th>
<th class="fill">ทุน/หน่วย</th><th class="fill">ขายเฉลี่ยจริง</th><th class="fill">กำไร ฿</th><th class="fill">มาร์จิ้น %</th></tr>
${list.map((r, i) => row(r, i + 1)).join("")}
</table>`;
}).join("")}

<div class="foot">
  <b>วิธีใช้:</b> พิมพ์ออกมา เปิด StoreHub แล้วกรอกช่องเหลืองทีละตัว — เริ่มจากตัวที่ขายดีที่สุดลงมา ไม่ต้องครบทุกตัวในวันเดียว ·
  กรอกต้นทุนใน StoreHub แล้วแอปจะคำนวณ ขายเฉลี่ย / กำไร / มาร์จิ้น ให้เองทันที ไม่ต้องกรอกซ้ำในแอป<br>
  ราคาจากแคตตาล็อก <code>products.json</code> · ดอกไม้แสดงราคาที่ 1g และมีราคาทุกขนาดใต้ชื่อ · สร้างเมื่อ ${new Date().toISOString().slice(0, 10)}
</div>
</body></html>`;

fs.writeFileSync(`${SP}/sku.html`, html);

/* the same table as CSV, so it can be opened in Sheets and filled in there */
const csvEsc = (v) => { const x = String(v == null ? "" : v); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
const lines = [["Category", "Product", "Code", "Priced per", "List Price", "Member Price", "Member Discount %", "Stock", "All tiers",
  "Cost/Unit (fill in)", "Avg Sell Price (fill in)", "Margin THB (fill in)", "Margin % (fill in)"].join(",")];
cats.forEach((c) => byCat[c].forEach((r) => lines.push([r.cat, r.name, r.code, r.basis, r.price || "", r.member || "",
  r.disc === null ? "" : r.disc, r.stock, r.tiers, "", "", "", ""].map(csvEsc).join(","))));
fs.writeFileSync(`${ROOT}/docs/sku-summary.csv`, "﻿" + lines.join("\n") + "\n");

(async () => {
  const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + SP + "/sku.html");
  await p.waitForTimeout(800);
  await p.pdf({
    path: `${ROOT}/docs/sku-summary.pdf`, format: "A4", landscape: true, printBackground: true,
    displayHeaderFooter: true, headerTemplate: "<div></div>",
    footerTemplate: '<div style="width:100%;font-size:7pt;color:#8a978f;font-family:Arial;padding:0 10mm;' +
      'display:flex;justify-content:space-between"><span>DANK · SKU Summary</span><span class="pageNumber"></span></div>',
    margin: { top: "11mm", bottom: "12mm", left: "10mm", right: "10mm" },
  });
  await b.close();
  console.log(`wrote docs/sku-summary.pdf and .csv — ${rows.length} SKUs, ${cats.length} categories, ${noPrice.length} without a price`);
})();
