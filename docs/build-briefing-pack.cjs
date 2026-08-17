/* Rebuild docs/ClinicWorks-POS-Briefing-Pack.pdf — one file that carries
 * everything an agent needs to pick this repo up, for tools that cannot be
 * pointed at GitHub directly.
 *
 *   npm i marked && node docs/build-briefing-pack.cjs
 *
 * It renders AGENTS.md, CLAUDE.md and the artwork brief straight from the
 * files themselves rather than from a copy, so the pack cannot quietly fall
 * out of date with the repo it describes. Re-run it after editing any of them.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { marked } = require("marked");

const ROOT = path.resolve(__dirname, "..");
const SP = fs.mkdtempSync(path.join(os.tmpdir(), "briefing-"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SECTIONS = [
  { n: 1, file: "AGENTS.md", title: "AGENTS.md",
    sub: "กฎที่ agent ต้องรู้ก่อนแตะโค้ด · the rules an agent must know before touching code" },
  { n: 2, file: "CLAUDE.md", title: "CLAUDE.md",
    sub: "สมองของโปรเจกต์ — สถาปัตยกรรม, งานที่เหลือ · the project brain: architecture and what is still open" },
  { n: 3, file: "handoff/README-CHATGPT.md", title: "Artwork brief",
    sub: "งานทำรูปสินค้า 41 รายการ · the 41-item product artwork job" },
];

/* the artwork jobs, as a table a human can scan; the prompts themselves are in
   the separate Botanical Legends PDF, which is far too long to inline here */
const jobs = JSON.parse(fs.readFileSync(path.join(ROOT, "handoff/image-jobs.json"), "utf8")).jobs;
const jobRows = jobs.map((j) => `<tr><td>${j.id ? "" : "⚠"} ${esc(j.name)}</td><td class="m">${esc(j.file || "—")}</td>` +
  `<td>${esc(j.category)}</td><td>${esc(j.cardText.taste)}</td>` +
  `<td class="c">${j.alreadyOwnArtwork ? "มีแล้ว" : "ยังไม่มี"}</td></tr>`).join("");

const body = SECTIONS.map((s) => {
  /* the divider already prints the title, so drop the file's own top heading */
  const md = fs.readFileSync(path.join(ROOT, s.file), "utf8").replace(/^#\s+.*\n+/, "");
  return `<div class="sec"><div class="secnum">${s.n}</div><h1 class="sech">${esc(s.title)}</h1>
    <div class="secsub">${esc(s.sub)}</div><div class="from">ในรีโป: <code>${esc(s.file)}</code></div></div>
    <div class="md">${marked.parse(md)}</div>`;
}).join("");

const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>ClinicWorks POS — Briefing Pack</title><style>
@page { size:A4; margin:15mm 14mm 14mm; }
*{box-sizing:border-box}
body{font-family:"Loma",Arial,sans-serif;color:#16211b;font-size:9.6pt;line-height:1.55;margin:0}
code,pre,.m{font-family:"DejaVu Sans Mono","Courier New",monospace}

/* cover */
.cover{height:252mm;display:flex;flex-direction:column;justify-content:center;page-break-after:always}
.cover .kick{color:#2f6b45;font-size:10pt;font-weight:bold;letter-spacing:1.6pt;margin-bottom:3mm}
.cover h1{font-size:31pt;line-height:1.1;margin:0 0 3mm;color:#0f2a1b;letter-spacing:-.6pt}
.cover .tag{font-size:12pt;color:#4a5a51;margin-bottom:9mm;max-width:135mm}
.cover .rule{height:2.5pt;width:38mm;background:#2f6b45;margin-bottom:9mm}
.toc{border:1px solid #d8e6dd;border-radius:3mm;padding:5mm 6mm;background:#f6faf7;max-width:140mm}
.toc h3{margin:0 0 3mm;font-size:9.6pt;color:#2f6b45;letter-spacing:.6pt}
.toc ol{margin:0;padding-left:6mm} .toc li{margin-bottom:1.6mm}
.toc b{color:#0f2a1b}
.toc .t{color:#5b6b61;font-size:8.8pt}
.cover .foot{margin-top:9mm;font-size:8.8pt;color:#5b6b61;max-width:140mm}
.cover .foot code{background:#eef4f0;padding:.4mm 1.2mm;border-radius:1mm}

/* section divider */
.sec{page-break-before:always;border-bottom:2.5pt solid #2f6b45;padding-bottom:3mm;margin-bottom:5mm}
.secnum{display:inline-block;background:#2f6b45;color:#fff;font-weight:bold;font-size:9pt;
  width:7mm;height:7mm;line-height:7mm;text-align:center;border-radius:50%;margin-bottom:2mm}
.sech{font-size:19pt;margin:0;color:#0f2a1b;letter-spacing:-.3pt}
.secsub{color:#4a5a51;font-size:9.4pt;margin-top:1mm}
.from{color:#7b8a81;font-size:8.4pt;margin-top:1.6mm}
.from code{background:#f0f4f1;padding:.3mm 1.2mm;border-radius:1mm}

/* rendered markdown */
.md h1{font-size:13pt;margin:6mm 0 2mm;color:#0f2a1b;page-break-after:avoid}
.md h2{font-size:11.4pt;margin:5.5mm 0 2mm;padding-bottom:1mm;border-bottom:1px solid #d8e6dd;
  color:#2f6b45;page-break-after:avoid}
.md h3{font-size:10.2pt;margin:4mm 0 1.5mm;color:#0f2a1b;page-break-after:avoid}
.md p{margin:0 0 2.4mm}
.md ul,.md ol{margin:0 0 2.8mm;padding-left:6mm}
.md li{margin-bottom:1.2mm}
.md hr{border:0;border-top:1px solid #e2eae5;margin:5mm 0}
.md blockquote{margin:2.5mm 0;padding:2mm 4mm;border-left:2.5pt solid #c9dcd1;color:#4a5a51;
  background:#f8fbf9;border-radius:0 1.5mm 1.5mm 0}
.md code{background:#eef3f0;padding:.4mm 1.2mm;border-radius:1mm;font-size:8.4pt;color:#1d3b2a}
.md pre{background:#0f2a1b;color:#dff0e5;padding:3mm 3.6mm;border-radius:2mm;overflow-x:auto;
  font-size:8pt;line-height:1.45;margin:0 0 3mm;page-break-inside:avoid}
.md pre code{background:none;color:inherit;padding:0;font-size:8pt}
.md table{width:100%;border-collapse:collapse;margin:0 0 3.5mm;font-size:8.6pt;page-break-inside:avoid}
.md th{background:#eef4f0;text-align:left;padding:1.4mm 2mm;border:1px solid #d8e6dd;color:#2f6b45}
.md td{padding:1.4mm 2mm;border:1px solid #e2eae5;vertical-align:top}
.md strong{color:#0f2a1b}
.md a{color:#2f6b45;word-break:break-all}

/* appendix table */
h2.app{page-break-before:always;font-size:15pt;color:#0f2a1b;border-bottom:2.5pt solid #2f6b45;
  padding-bottom:2mm;margin:0 0 2mm}
.appnote{color:#5b6b61;font-size:8.8pt;margin-bottom:4mm}
table.jobs{width:100%;border-collapse:collapse;font-size:7.8pt}
table.jobs th{background:#2f6b45;color:#fff;text-align:left;padding:1.4mm 1.8mm;font-size:7.6pt}
table.jobs td{padding:1.1mm 1.8mm;border-bottom:1px solid #e6ede9;vertical-align:top}
table.jobs tr:nth-child(even) td{background:#f8fbf9}
table.jobs td.m{font-size:7.2pt;color:#2f6b45}
table.jobs td.c{white-space:nowrap}
</style></head><body>

<div class="cover">
  <div class="kick">DANK CANNABIS CLINIC · BANGKOK</div>
  <h1>ClinicWorks POS<br>Briefing Pack</h1>
  <div class="rule"></div>
  <div class="tag">ทุกอย่างที่ต้องรู้ก่อนพัฒนาต่อ รวมไว้ในไฟล์เดียว<br>
    Everything needed to pick this codebase up, in one file.</div>
  <div class="toc">
    <h3>เนื้อหา / CONTENTS</h3>
    <ol>
      ${SECTIONS.map((s) => `<li><b>${esc(s.title)}</b><br><span class="t">${esc(s.sub)}</span></li>`).join("")}
      <li><b>Appendix — artwork jobs</b><br><span class="t">${jobs.length} รายการ พร้อมชื่อไฟล์ที่ต้องใช้ · the ${jobs.length} items and their required filenames</span></li>
    </ol>
  </div>
  <div class="foot">
    <b>Repo:</b> <code>github.com/bryank31172-web/dank-medical-pos-app</code> (public) ·
    <b>Live:</b> <code>dank-medical-pos-app.vercel.app</code><br>
    ถ้าเครื่องมือต่อ GitHub ได้ ให้ต่อ repo ตรงดีกว่าอ่าน PDF — โค้ดจริงและ prompt ทั้งหมดอยู่ในนั้น
    ไฟล์นี้ไว้อ่านตอนต่อ repo ไม่ได้
  </div>
</div>

${body}

<h2 class="app">Appendix · Artwork jobs</h2>
<div class="appnote">
  ${jobs.length} รายการ · ชื่อไฟล์ต้องตรงเป๊ะ สคริปต์ <code>handoff/apply-images.mjs</code> จับคู่ด้วยชื่อไฟล์ ไม่ได้ดูเนื้อรูป ·
  prompt เต็มของแต่ละตัวอยู่ใน <code>handoff/image-jobs.json</code> และ <code>docs/botanical-legends-prompts.pdf</code>
</div>
<table class="jobs"><tr><th>สินค้า / Product</th><th>ชื่อไฟล์ / Filename</th><th>หมวด</th><th>รสชาติ / Taste</th><th>รูป</th></tr>
${jobRows}</table>

</body></html>`;

fs.writeFileSync(`${SP}/pack.html`, html);

(async () => {
  const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + SP + "/pack.html");
  await p.waitForTimeout(900);
  await p.pdf({
    path: `${ROOT}/docs/ClinicWorks-POS-Briefing-Pack.pdf`, format: "A4", printBackground: true,
    displayHeaderFooter: true, headerTemplate: "<div></div>",
    footerTemplate: '<div style="width:100%;font-size:7pt;color:#8a978f;font-family:Arial;' +
      'padding:0 14mm;display:flex;justify-content:space-between">' +
      '<span>ClinicWorks POS — Briefing Pack</span>' +
      '<span class="pageNumber"></span></div>',
    margin: { top: "15mm", bottom: "14mm", left: "14mm", right: "14mm" },
  });
  await b.close();
  console.log("wrote docs/ClinicWorks-POS-Briefing-Pack.pdf");
})();
