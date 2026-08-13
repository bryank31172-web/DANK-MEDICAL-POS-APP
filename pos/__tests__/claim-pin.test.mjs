import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const fails=[],errs=[];
const ok=(n,c)=>{console.log((c?'✓ ':'✗ ')+n); if(!c)fails.push(n);};
const b=await chromium.launch();

// route /api/staff-auth so we can test each server state
const run=async(handler)=>{
  const ctx=await b.newContext({viewport:{width:520,height:900}});
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(e.message.slice(0,120)));
  await p.route('**/api/staff-auth',handler);
  await p.goto('http://127.0.0.1:8799/pos/testrun/test2.html');
  await p.waitForTimeout(2200);
  return {p,ctx};
};
const openClaim=async(p)=>{
  // the login screen's register link, then the "already on the roster" tab
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/สมัคร|Register|ขอเข้าใช้/.test(x.textContent||'')&&x.textContent.length<40);b&&b.click();});
  await p.waitForTimeout(600);
  await p.click('button:has-text("มีชื่อแล้ว")').catch(()=>{});
  await p.waitForTimeout(700);
  return /PIN ผู้จัดการ|Manager PIN/.test(await p.evaluate(()=>document.body.innerText));
};
const fill=async(p,authPin)=>{
  await p.selectOption('select', {index:1}).catch(()=>{});
  const ins=await p.$$('input[type=password]');
  if(ins.length>=3){ await ins[0].fill('223344'); await ins[1].fill('223344'); await ins[2].fill(authPin); }
  await p.click('button:has-text("ตั้ง PIN + เข้าใช้งาน")').catch(()=>{});
  await p.waitForTimeout(900);
  return await p.evaluate(()=>document.body.innerText);
};

// 1 — server configured, wrong manager PIN -> refused
{ const {p}=await run(r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false})}));
  ok('claim form now asks for a manager PIN', await openClaim(p));
  const t=await fill(p,'999999');
  ok('wrong manager PIN is refused', /ไม่ถูกต้อง/.test(t));
  ok('  and the claim did NOT go through', !/ตั้ง PIN สำเร็จ/.test(t)); }

// 2 — server configured, a budtender's PIN -> refused (must be manager/owner)
{ const {p}=await run(r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,name:'Nok',role:'budtender',id:9})}));
  await openClaim(p);
  const t=await fill(p,'111111');
  ok('a budtender cannot authorise a claim', /ต้องให้ผู้จัดการหรือ CEO เป็นคนอนุมัติ/.test(t)&&!/ตั้ง PIN สำเร็จ/.test(t)); }

// 3 — server configured, real manager PIN -> allowed
{ const {p}=await run(r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,name:'Bank',role:'manager',id:2})}));
  await openClaim(p);
  const t=await fill(p,'570461');
  ok('a manager PIN lets the claim through', /ตั้ง PIN สำเร็จ/.test(t)); }

// 4 — server has no PINs at all -> break-glass stays open, but says so
{ const {p}=await run(r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,error:'not configured'})}));
  await openClaim(p);
  const t=await fill(p,'');
  ok('break-glass still works when MASTER_PIN is unset', /ตั้ง PIN แล้ว/.test(t));
  ok('  and it warns loudly on screen', /ยังไม่ได้ตั้ง MASTER_PIN/.test(t)); }

// 5 — the network is down: must refuse, not fall open
{ const {p}=await run(r=>r.abort());
  await openClaim(p);
  const t=await fill(p,'570461');
  ok('a failed auth check refuses (fail-closed)', /ตรวจสอบสิทธิ์ไม่ได้/.test(t)&&!/ตั้ง PIN สำเร็จ/.test(t)); }

console.log('ERRORS:',errs.length?errs:'none');
console.log(fails.length?('FAIL: '+fails.join(' | ')):'ALL PASS');
await b.close(); process.exit((errs.length||fails.length)?1:0);
