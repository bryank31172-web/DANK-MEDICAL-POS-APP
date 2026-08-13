import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const errs=[],fails=[];
const ok=(n,c)=>{console.log((c?'✓ ':'✗ ')+n); if(!c)fails.push(n);};
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:560,height:980},deviceScaleFactor:2});
p.on('pageerror',e=>errs.push(e.message.slice(0,140)));
await p.goto('http://127.0.0.1:8799/pos/testrun/test2.html');
await p.waitForTimeout(2300);
for(const d of '110114') await p.click(`button:has-text("${d}")`).catch(()=>{});
await p.waitForTimeout(1700);

await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^🕐\s*Shift|กะ Shift/.test(x.textContent.trim()));b&&b.click();});
await p.waitForTimeout(1000);
await p.click('button:has-text("เข้ากะ In")');   // the real clock-in entry point
await p.waitForTimeout(1300);

let t=await p.evaluate(()=>document.body.innerText);
ok('checklist shows before the stock count', /ทำแล้ว 0\/|ติ๊กทั้งหมด/.test(t));
ok('  it lists the open-shift tasks', /นับเงินทอนตั้งต้น/.test(t)&&/ต่อและทดสอบเครื่องชั่ง/.test(t));
ok('  each task carries a how-to', /Cash Count on the sell screen|บันทึกที่ปุ่ม Cash Count/.test(t));
ok('  close-shift tasks are NOT shown here', !/บันทึกของเสีย/.test(t));
await p.screenshot({path:'shift-tasks.png'});

const btn=await p.$('button:has-text("ต่อไป → นับสต็อก")');
ok('continue button exists', !!btn);
ok('  and is disabled until everything is ticked', btn ? await btn.isDisabled() : false);

await p.click('button:has-text("ติ๊กทั้งหมด")');
await p.waitForTimeout(500);
t=await p.evaluate(()=>document.body.innerText);
ok('ticking all shows the done state', /ครบแล้ว \/ All done/.test(t));
const btn2=await p.$('button:has-text("ต่อไป → นับสต็อก")');
ok('  continue is now enabled', btn2 ? !(await btn2.isDisabled()) : false);
await p.screenshot({path:'shift-tasks-done.png'});

await btn2.click();
await p.waitForTimeout(1200);
t=await p.evaluate(()=>document.body.innerText);
ok('continues into the scale/stock step', /เครื่องชั่ง|Expected|Test scale/.test(t));

console.log('ERRORS:',errs.length?errs:'none');
console.log(fails.length?('FAIL: '+fails.join(' | ')):'ALL PASS');
await b.close(); process.exit((errs.length||fails.length)?1:0);
