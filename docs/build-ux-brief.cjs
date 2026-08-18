/* Rebuild docs/UX-UI-Apple-Brief.pdf from the markdown next to it.
 *
 *   npm i marked && node docs/build-ux-brief.cjs
 *
 * The cover carries two screenshots of the running app. They are the evidence
 * behind the brief — the numbers on the cover are meaningless without a
 * picture of what they describe — so regenerate them with the audit script in
 * docs/ux-audit.mjs before rebuilding if the UI has moved on.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { marked } = require("marked");
const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "docs", "ux-shots");
const SP = fs.mkdtempSync(path.join(os.tmpdir(), "uxbrief-"));

const md = fs.readFileSync(`${ROOT}/docs/UX-UI-Apple-Brief.md`, "utf8").replace(/^#\s+.*\n+/, "");
const b64 = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
const shotPOS = b64(`${SHOTS}/pos.png`);
const shotFIN = b64(`${SHOTS}/finance.png`);

const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>UX/UI Apple Brief</title><style>
@page{size:A4;margin:15mm 14mm 14mm}
*{box-sizing:border-box}
body{font-family:"Loma",Arial,sans-serif;color:#16211b;font-size:9.6pt;line-height:1.55;margin:0}
code,pre{font-family:"DejaVu Sans Mono","Courier New",monospace}
.cover{height:250mm;display:flex;flex-direction:column;justify-content:center;page-break-after:always}
.kick{color:#2f6b45;font-size:9.6pt;font-weight:bold;letter-spacing:1.6pt;margin-bottom:3mm}
.cover h1{font-size:30pt;line-height:1.08;margin:0 0 3mm;color:#0f2a1b;letter-spacing:-.7pt}
.rule{height:2.5pt;width:38mm;background:#2f6b45;margin:0 0 8mm}
.tag{font-size:11.5pt;color:#4a5a51;max-width:132mm;margin-bottom:9mm}
.nums{display:flex;gap:5mm;flex-wrap:wrap;margin-bottom:9mm}
.num{border:1px solid #e0d0d0;border-left:2.5pt solid #b3413f;border-radius:2.5mm;padding:3mm 4.5mm;background:#fdf6f6}
.num b{display:block;font-size:19pt;color:#b3413f;line-height:1}
.num span{font-size:8pt;color:#6b5a5a}
.shots{display:flex;gap:6mm;align-items:flex-start;max-width:150mm}
.shots figure{margin:0;flex:1}
.shots img{width:100%;border:1px solid #d8e6dd;border-radius:2.5mm}
.shots figcaption{font-size:7.6pt;color:#6b7a71;margin-top:1.6mm;line-height:1.4}
h1{font-size:15pt;margin:8mm 0 2.5mm;color:#0f2a1b;padding-bottom:1.5mm;
   border-bottom:2.5pt solid #2f6b45;page-break-after:avoid;page-break-before:always}
h1:first-of-type{page-break-before:avoid}
h2{font-size:11.6pt;margin:6mm 0 2mm;color:#2f6b45;page-break-after:avoid}
h3{font-size:10pt;margin:4mm 0 1.5mm;color:#0f2a1b;page-break-after:avoid}
p{margin:0 0 2.4mm}
ul,ol{margin:0 0 2.8mm;padding-left:6mm} li{margin-bottom:1.3mm}
hr{border:0;border-top:1px solid #e2eae5;margin:5mm 0}
blockquote{margin:2.5mm 0;padding:2mm 4mm;border-left:2.5pt solid #c9dcd1;color:#4a5a51;
  background:#f8fbf9;border-radius:0 1.5mm 1.5mm 0}
code{background:#eef3f0;padding:.4mm 1.2mm;border-radius:1mm;font-size:8.3pt;color:#1d3b2a}
pre{background:#0f2a1b;color:#dff0e5;padding:3mm 3.6mm;border-radius:2mm;font-size:7.8pt;
  line-height:1.45;margin:0 0 3mm;page-break-inside:avoid;white-space:pre-wrap}
pre code{background:none;color:inherit;padding:0;font-size:7.8pt}
table{width:100%;border-collapse:collapse;margin:0 0 3.5mm;font-size:8.6pt;page-break-inside:avoid}
th{background:#eef4f0;text-align:left;padding:1.4mm 2mm;border:1px solid #d8e6dd;color:#2f6b45}
td{padding:1.4mm 2mm;border:1px solid #e2eae5;vertical-align:top}
strong{color:#0f2a1b}
</style></head><body>

<div class="cover">
  <div class="kick">CLINICWORKS POS · DANK CANNABIS CLINIC</div>
  <h1>UX/UI Upgrade Brief<br>Apple-style pass</h1>
  <div class="rule"></div>
  <div class="tag">8 งาน เรียงตามผลกระทบ · วัดจากแอปจริงที่ 390&times;844 ไม่ใช่ความเห็น<br>
    Eight prioritised tasks, measured on the running app rather than eyeballed.</div>
  <div class="nums">
    <div class="num"><b>686px</b><span>เนื้อหากว้าง บนจอ 390px</span></div>
    <div class="num"><b>47</b><span>ปุ่มเล็กกว่า 44&times;44</span></div>
    <div class="num"><b>151</b><span>ตัวหนังสือ &lt; 12px</span></div>
    <div class="num"><b>21</b><span>แท็บ (ควร &le; 5)</span></div>
    <div class="num"><b>11</b><span>ค่ามุมโค้ง</span></div>
  </div>
  <div class="shots">
    <figure><img src="${shotPOS}">
      <figcaption>หน้าขาย — แถบเลื่อนแนวนอน 4 ชั้นก่อนถึงสินค้า, ป้ายแท็บ 8px, toast ทับหัวข้อ</figcaption></figure>
    <figure><img src="${shotFIN}">
      <figcaption>Finance — ปุ่ม 12 ปุ่ม 6 แถว คนละสีโดยไม่มีความหมาย, หัวข้อถูกบีบข้างซ้าย, popup ทับกราฟ</figcaption></figure>
  </div>
</div>

${marked.parse(md)}
</body></html>`;

fs.writeFileSync(`${SP}/ux.html`, html);
(async () => {
  const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + SP + "/ux.html");
  await p.waitForTimeout(1200);
  await p.pdf({
    path: `${ROOT}/docs/UX-UI-Apple-Brief.pdf`, format: "A4", printBackground: true,
    displayHeaderFooter: true, headerTemplate: "<div></div>",
    footerTemplate: '<div style="width:100%;font-size:7pt;color:#8a978f;font-family:Arial;' +
      'padding:0 14mm;display:flex;justify-content:space-between">' +
      '<span>ClinicWorks POS — UX/UI Apple Brief</span><span class="pageNumber"></span></div>',
    margin: { top: "15mm", bottom: "14mm", left: "14mm", right: "14mm" },
  });
  await b.close();
  console.log("wrote docs/UX-UI-Apple-Brief.pdf");
})();
