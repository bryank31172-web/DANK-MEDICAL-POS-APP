const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

const html = (body: string) => new Response(body, {
  headers: { ...cors, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const legacySecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
let modernSecret = "";
try {
  modernSecret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || "";
} catch (_) {}
const secretKey = modernSecret || legacySecret;

async function admin(path: string, init: RequestInit = {}) {
  return fetch(supabaseUrl + path, {
    ...init,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

let accessHashCache = "";
let accessHashAt = 0;
async function expectedAccessHash() {
  if (accessHashCache && Date.now() - accessHashAt < 60_000) return accessHashCache;
  const r = await admin("/rest/v1/stock_report_settings?key=eq.amoe_access_hash&select=value&limit=1");
  if (!r.ok) throw new Error("access configuration unavailable");
  const rows = await r.json();
  accessHashCache = String(rows?.[0]?.value || "");
  accessHashAt = Date.now();
  return accessHashCache;
}

async function authenticate(code: unknown) {
  const supplied = String(code || "").trim();
  if (supplied.length < 16) return false;
  const expected = await expectedAccessHash();
  return Boolean(expected) && (await sha256(supplied)) === expected;
}

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : 0;
};

const text = (value: unknown, max = 250) => String(value ?? "").trim().slice(0, max);

function decodePhoto(dataUrl: string) {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error("invalid photo");
  const raw = atob(m[2]);
  if (raw.length > 650_000) throw new Error("photo too large");
  return { mime: m[1], bytes: Uint8Array.from(raw, (c) => c.charCodeAt(0)) };
}

function reportNumber() {
  const d = new Date();
  const stamp = d.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `AMOE-${stamp}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

async function uploadProof(reportId: string, index: number, dataUrl: string) {
  const photo = decodePhoto(dataUrl);
  const ext = photo.mime === "image/png" ? "png" : photo.mime === "image/webp" ? "webp" : "jpg";
  const path = `${reportId}/${String(index + 1).padStart(2, "0")}.${ext}`;
  const r = await fetch(`${supabaseUrl}/storage/v1/object/stock-report-proofs/${path}`, {
    method: "POST",
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": photo.mime, "x-upsert": "false" },
    body: photo.bytes,
  });
  if (!r.ok) throw new Error(`proof upload failed (${r.status})`);
  return path;
}

async function saveReport(body: any) {
  const branches = new Set(["Phatthanakarn", "Sathorn Rama 3", "224 Bar"]);
  const type = body.reportType === "inactive" ? "inactive" : "active";
  const branch = text(body.branch, 50);
  const shiftNo = Number(body.shiftNo);
  const reportDate = text(body.reportDate, 10);
  const rows = Array.isArray(body.lines) ? body.lines.slice(0, 150) : [];
  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 4) : [];
  if (!branches.has(branch)) throw new Error("choose a valid branch");
  if (![1, 2, 3].includes(shiftNo)) throw new Error("choose a valid shift");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) throw new Error("choose the report date");
  if (!rows.length) throw new Error("add at least one product");
  if (!photos.length) throw new Error("add at least one proof photo");

  const lines = rows.map((line: any, i: number) => {
    const opening = num(line.opening);
    const received = num(line.received);
    const transferIn = num(line.transferIn);
    const transferOut = num(line.transferOut);
    const posSales = type === "active" ? num(line.posSales) : 0;
    const waste = type === "active" ? num(line.waste) : 0;
    const expected = type === "active"
      ? opening + received + transferIn - transferOut - posSales - waste
      : opening + received - transferIn - transferOut;
    const actual = num(line.actual);
    const productName = text(line.productName, 150);
    if (!productName) throw new Error(`product ${i + 1} needs a name`);
    if (expected < 0) throw new Error(`${productName}: expected closing cannot be negative`);
    const reason = text(line.inactiveReason, 100);
    if (type === "inactive" && !reason) throw new Error(`${productName}: choose an inactive reason`);
    const variance = Math.round((actual - expected) * 1000) / 1000;
    return {
      line_no: i + 1,
      sku: text(line.sku, 100), product_name: productName, unit: text(line.unit, 20) || "g",
      opening_qty: opening, received_qty: received, transfer_in_qty: transferIn,
      transfer_out_qty: transferOut, pos_sales_qty: posSales, waste_qty: waste,
      expected_closing_qty: Math.round(expected * 1000) / 1000,
      actual_closing_qty: actual, variance_qty: variance,
      inactive_reason: reason, remark: text(line.remark, 500),
    };
  });

  const number = reportNumber();
  const reportRes = await admin("/rest/v1/stock_reports", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      report_number: number, staff_name: "Amoe", branch, shift_no: shiftNo,
      report_type: type, report_date: reportDate, notes: text(body.notes, 1000),
    }),
  });
  if (!reportRes.ok) throw new Error("could not create report");
  const report = (await reportRes.json())[0];
  try {
    const paths = [];
    for (let i = 0; i < photos.length; i++) paths.push(await uploadProof(report.id, i, String(photos[i])));
    const lineRes = await admin("/rest/v1/stock_report_lines", {
      method: "POST", body: JSON.stringify(lines.map((line: any) => ({ ...line, report_id: report.id }))),
    });
    if (!lineRes.ok) throw new Error("could not save report lines");
    const patchRes = await admin(`/rest/v1/stock_reports?id=eq.${report.id}`, {
      method: "PATCH", body: JSON.stringify({ proof_paths: paths }),
    });
    if (!patchRes.ok) throw new Error("could not attach proof references");
    return { ok: true, id: report.id, reportNumber: number, varianceCount: lines.filter((x: any) => x.variance_qty !== 0).length };
  } catch (error) {
    await admin(`/rest/v1/stock_reports?id=eq.${report.id}`, { method: "DELETE" });
    throw error;
  }
}

async function history() {
  const r = await admin("/rest/v1/stock_reports?staff_name=eq.Amoe&select=report_number,branch,shift_no,report_type,report_date,status,submitted_at&order=submitted_at.desc&limit=30");
  if (!r.ok) throw new Error("could not load history");
  return { ok: true, reports: await r.json() };
}

async function health() {
  const response = await admin("/rest/v1/stock_reports?select=id&limit=1");
  if (!response.ok) throw new Error("report storage unavailable");
  return { ok: true, storage: "supabase", photos: "private" };
}

const page = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Amoe Stock Report · DANK</title><style>
:root{--bg:#0b1711;--panel:#13271d;--line:#315440;--gold:#ddb95f;--green:#61bd85;--text:#f5f1e6;--muted:#aab9af;--yellow:#fff2cc;--danger:#ff7272}*{box-sizing:border-box}body{margin:0;background:linear-gradient(145deg,#09150f,#173122);color:var(--text);font:15px/1.45 system-ui,-apple-system,"Noto Sans Thai",sans-serif}.wrap{max-width:760px;margin:auto;padding:18px 14px 80px}header{text-align:center;padding:18px 8px}h1{margin:0;color:var(--gold);font-size:25px}.sub{color:var(--muted);font-size:13px}.card{background:rgba(19,39,29,.96);border:1px solid var(--line);border-radius:17px;padding:15px;margin:12px 0;box-shadow:0 15px 45px #0004}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.full{grid-column:1/-1}label{display:block;color:var(--muted);font-size:12px;font-weight:700;margin-bottom:5px}input,select,textarea,button{font:inherit}input,select,textarea{width:100%;background:#0d1d15;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:11px;min-height:44px}input:focus,select:focus,textarea:focus{outline:2px solid var(--green);border-color:transparent}.tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tab{background:#10241a;color:var(--muted);border:1px solid var(--line);border-radius:12px;padding:12px;font-weight:800}.tab.on{background:var(--green);color:#07150d}.line{border:1px solid var(--line);border-radius:14px;padding:12px;margin:10px 0;background:#0c1d15}.line-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.n{color:var(--gold);font-weight:900}.remove{background:#472020;color:#ffdede;border:1px solid #7e3737;border-radius:9px;padding:7px 10px}.math{background:#172d21;border-radius:10px;padding:9px;margin-top:10px;display:flex;justify-content:space-between}.bad{color:var(--danger);font-weight:900}.ok{color:var(--green);font-weight:900}.btn{width:100%;border:0;border-radius:12px;padding:13px;background:var(--green);color:#07150d;font-weight:900;min-height:48px}.ghost{background:transparent;color:var(--gold);border:1px solid var(--gold)}.photos{display:flex;gap:8px;flex-wrap:wrap}.photos img{width:74px;height:74px;object-fit:cover;border-radius:10px;border:1px solid var(--line)}.notice{display:none;padding:13px;border-radius:12px;margin:12px 0}.notice.show{display:block}.success{background:#153b25;color:#b9ffd1}.error{background:#4a1e1e;color:#ffd0d0}.history-row{border-bottom:1px solid var(--line);padding:10px 0}.small{font-size:12px;color:var(--muted)}@media(max-width:520px){.grid{grid-template-columns:1fr}.full{grid-column:auto}h1{font-size:22px}}
</style></head><body><div class="wrap"><header><h1>DANK · AMOE STOCK REPORT</h1><div class="sub">รายงานสต็อกรายกะ · Active & Inactive Stock</div></header>
<div class="card"><div class="grid"><div class="full"><label>Access code / รหัสเข้าใช้งาน</label><input id="key" type="password" autocomplete="current-password" placeholder="Enter Amoe report code"></div><div><label>Date / วันที่</label><input id="date" type="date"></div><div><label>Branch / สาขา</label><select id="branch"><option>Phatthanakarn</option><option>Sathorn Rama 3</option><option>224 Bar</option></select></div><div><label>Shift / กะ</label><select id="shift"><option value="1">Shift 1</option><option value="2">Shift 2</option><option value="3">Shift 3</option></select></div><div><label>Staff / พนักงาน</label><input value="Amoe" readonly></div></div></div>
<div class="card"><label>Report type / ประเภทรายงาน</label><div class="tabs"><button class="tab on" id="activeTab" type="button">Active Stock</button><button class="tab" id="inactiveTab" type="button">Inactive Stock</button></div></div>
<div id="lines"></div><button class="btn ghost" type="button" id="add">＋ Add product / เพิ่มสินค้า</button>
<div class="card"><label>Proof photos / รูปหลักฐาน *</label><input id="photoInput" type="file" accept="image/*" capture="environment" multiple><div class="small">Required. Maximum 4 compressed photos.</div><div class="photos" id="photos"></div><label style="margin-top:12px">Notes / หมายเหตุ</label><textarea id="notes" rows="3"></textarea><label style="margin-top:12px"><input id="confirm" type="checkbox" style="width:auto;min-height:auto;margin-right:8px">I confirm the physical count is correct / ยืนยันยอดนับจริงถูกต้อง</label></div>
<div id="notice" class="notice"></div><button id="submit" class="btn">Submit report / ส่งรายงาน</button><button id="historyBtn" class="btn ghost" style="margin-top:10px">Recent reports / รายงานล่าสุด</button><div id="history" class="card" style="display:none"></div>
</div><datalist id="products"></datalist><script>
const API='https://xqxdnarcrdocssjfvuvw.supabase.co/functions/v1/amoe-stock-report';const $=s=>document.querySelector(s), lines=$('#lines');let type='active',photos=[],products=[];$('#date').value=new Date().toLocaleDateString('en-CA');
try{$('#key').value=sessionStorage.getItem('amoeReportKey')||''}catch(e){}
fetch('https://dank-medical-pos-app.vercel.app/api/products').then(r=>r.json()).then(x=>{products=Array.isArray(x)?x:[];$('#products').innerHTML=products.map(p=>'<option value="'+esc(p.name)+'">').join('')}).catch(()=>{});
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function row(){const d=document.createElement('div');d.className='card line';d.innerHTML='<div class="line-head"><span class="n">Product '+(lines.children.length+1)+'</span><button type="button" class="remove">Remove</button></div><div class="grid"><div class="full"><label>Product / สินค้า *</label><input data-f="productName" list="products" placeholder="Search or type product"></div><div><label>SKU</label><input data-f="sku"></div><div><label>Unit / หน่วย</label><select data-f="unit"><option>g</option><option>pcs</option><option>bottle</option><option>pack</option><option>box</option><option>ml</option></select></div><div><label>Opening / ยอดเปิด</label><input data-f="opening" inputmode="decimal" type="number" step="0.001" min="0" value="0"></div><div><label data-l="received">Received / รับเข้า</label><input data-f="received" inputmode="decimal" type="number" step="0.001" min="0" value="0"></div><div><label data-l="transferIn">Transfer in / โอนเข้า</label><input data-f="transferIn" inputmode="decimal" type="number" step="0.001" min="0" value="0"></div><div><label data-l="transferOut">Transfer out / โอนออก</label><input data-f="transferOut" inputmode="decimal" type="number" step="0.001" min="0" value="0"></div><div data-active><label>POS sales / ขาย POS</label><input data-f="posSales" inputmode="decimal" type="number" step="0.001" min="0" value="0"></div><div data-active><label>Waste / เสีย-แจก-ใช้</label><input data-f="waste" inputmode="decimal" type="number" step="0.001" min="0" value="0"></div><div><label>Actual closing / ยอดนับจริง *</label><input data-f="actual" inputmode="decimal" type="number" step="0.001" min="0" value="0"></div><div class="full" data-inactive style="display:none"><label>Inactive reason / เหตุผล *</label><select data-f="inactiveReason"><option value="">Choose…</option><option>Expired / หมดอายุ</option><option>Damaged / เสียหาย</option><option>Quality Hold / กักตรวจ</option><option>Discontinued / เลิกขาย</option><option>Supplier Return / คืน Supplier</option><option>Legal-Regulatory Hold / ห้ามขาย</option><option>Other / อื่นๆ</option></select></div><div class="full"><label>Remark / หมายเหตุ</label><input data-f="remark"></div></div><div class="math"><span>Expected: <b data-expected>0</b></span><span>Variance: <b class="ok" data-variance>0</b></span></div>';lines.appendChild(d);d.querySelector('.remove').onclick=()=>{d.remove();renumber()};d.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',()=>{if(x.dataset.f==='productName')fillProduct(d,x.value);calc(d)}));modeRow(d);calc(d)}
function fillProduct(d,name){const p=products.find(x=>String(x.name).toLowerCase()===String(name).toLowerCase());if(!p)return;d.querySelector('[data-f=sku]').value=p.sku||p.code||p.id||'';d.querySelector('[data-f=unit]').value=p.unit||'g';d.querySelector('[data-f=opening]').value=Number(p.stock||0)}
function val(d,n){return Math.max(0,Number(d.querySelector('[data-f='+n+']')?.value)||0)}function calc(d){const exp=type==='active'?val(d,'opening')+val(d,'received')+val(d,'transferIn')-val(d,'transferOut')-val(d,'posSales')-val(d,'waste'):val(d,'opening')+val(d,'received')-val(d,'transferIn')-val(d,'transferOut');const variance=val(d,'actual')-exp;d.querySelector('[data-expected]').textContent=fmt(exp);const v=d.querySelector('[data-variance]');v.textContent=(variance>0?'+':'')+fmt(variance);v.className=variance===0?'ok':'bad'}function fmt(n){return Math.round(n*1000)/1000}
function modeRow(d){d.querySelectorAll('[data-active]').forEach(x=>x.style.display=type==='active'?'':'none');d.querySelectorAll('[data-inactive]').forEach(x=>x.style.display=type==='inactive'?'':'none');d.querySelector('[data-l=received]').textContent=type==='active'?'Received / รับเข้า':'Moved inactive / ย้ายเข้า Inactive';d.querySelector('[data-l=transferIn]').textContent=type==='active'?'Transfer in / โอนเข้า':'Returned active / คืน Active';d.querySelector('[data-l=transferOut]').textContent=type==='active'?'Transfer out / โอนออก':'Disposed-returned / ทำลาย-คืน';calc(d)}function setType(t){type=t;$('#activeTab').classList.toggle('on',t==='active');$('#inactiveTab').classList.toggle('on',t==='inactive');document.querySelectorAll('.line').forEach(modeRow)}
function renumber(){document.querySelectorAll('.line .n').forEach((x,i)=>x.textContent='Product '+(i+1))}$('#activeTab').onclick=()=>setType('active');$('#inactiveTab').onclick=()=>setType('inactive');$('#add').onclick=row;
async function compress(file){const img=await createImageBitmap(file);const scale=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.72)}
$('#photoInput').onchange=async e=>{for(const f of [...e.target.files].slice(0,4-photos.length)){try{photos.push(await compress(f))}catch(_){}}e.target.value='';$('#photos').innerHTML=photos.map((p,i)=>'<div><img src="'+p+'"><button type="button" class="remove" data-i="'+i+'">×</button></div>').join('');$('#photos').querySelectorAll('button').forEach(b=>b.onclick=()=>{photos.splice(Number(b.dataset.i),1);$('#photoInput').dispatchEvent(new Event('change'))})};
function lineData(d){const o={};d.querySelectorAll('[data-f]').forEach(x=>o[x.dataset.f]=x.value);return o}function show(msg,ok){const n=$('#notice');n.textContent=msg;n.className='notice show '+(ok?'success':'error');n.scrollIntoView({behavior:'smooth',block:'center'})}
async function post(payload){const code=$('#key').value.trim();if(!code)throw new Error('Enter access code');sessionStorage.setItem('amoeReportKey',code);const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,accessCode:code})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Request failed');return j}
$('#submit').onclick=async()=>{if(!$('#confirm').checked)return show('Please confirm the physical count / กรุณายืนยันยอดนับ',false);const button=$('#submit');button.disabled=true;button.textContent='Saving…';try{const j=await post({action:'submit',reportType:type,reportDate:$('#date').value,branch:$('#branch').value,shiftNo:$('#shift').value,notes:$('#notes').value,lines:[...document.querySelectorAll('.line')].map(lineData),photos});show('✅ Saved '+j.reportNumber+' · Variances: '+j.varianceCount,true);photos=[];$('#photos').innerHTML='';$('#confirm').checked=false;lines.innerHTML='';row()}catch(e){show('⚠️ '+e.message,false)}finally{button.disabled=false;button.textContent='Submit report / ส่งรายงาน'}};
$('#historyBtn').onclick=async()=>{try{const j=await post({action:'history'}),h=$('#history');h.style.display='block';h.innerHTML='<b>Recent Amoe reports</b>'+j.reports.map(x=>'<div class="history-row"><b>'+esc(x.report_number)+'</b><div class="small">'+esc(x.report_date)+' · '+esc(x.branch)+' · Shift '+esc(x.shift_no)+' · '+esc(x.report_type)+' · '+new Date(x.submitted_at).toLocaleString()+'</div></div>').join('')}catch(e){show('⚠️ '+e.message,false)}};row();
</script></body></html>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return html(page);
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!secretKey) return json({ error: "storage is not configured" }, 503);
  try {
    const body = await req.json();
    if (!(await authenticate(body.accessCode))) return json({ error: "invalid access code" }, 401);
    if (body.action === "health") return json(await health());
    if (body.action === "history") return json(await history());
    if (body.action !== "submit") return json({ error: "invalid action" }, 400);
    return json(await saveReport(body));
  } catch (error) {
    return json({ error: String(error?.message || error) }, 400);
  }
});
