import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const errs=[],fails=[];
const ok=(n,c)=>{console.log((c?'✓ ':'✗ ')+n); if(!c)fails.push(n);};
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:900,height:1000},deviceScaleFactor:2});
p.on('pageerror',e=>errs.push(e.message.slice(0,140)));
await p.goto('http://127.0.0.1:8799/pos/testrun/test2.html');
await p.waitForTimeout(2300);
for(const d of '110114') await p.click(`button:has-text("${d}")`).catch(()=>{});
await p.waitForTimeout(1700);

await p.click('button:has-text("More")');
await p.waitForTimeout(500);
await p.click('button:has-text("บาร์ Bar"), button:has-text("Bar")');
await p.waitForTimeout(1100);
let t=await p.evaluate(()=>document.body.innerText);
ok('bar tab opens', /Bar recipes & cost/.test(t));
ok('  lists classic cocktails', /Margarita/.test(t)&&/Negroni/.test(t)&&/Long Island/.test(t));
ok('  lists signature cocktails', /Matcha Forest/.test(t)&&/Dank Fireball/.test(t)&&/Lost Cherry/.test(t));
ok('  shows the bottle cost table', /Tanqueray Gin/.test(t)&&/\/ml/.test(t));
await p.screenshot({path:'bar-list.png'});

await p.click('button:has-text("Margarita")');
await p.waitForTimeout(800);
t=await p.evaluate(()=>document.body.innerText);
ok('recipe checklist opens', /Tequila/.test(t)&&/45 ml/.test(t));
ok('  shows method steps', /Shake all with ice/.test(t));
ok('  shows the garnish', /Salt rim/.test(t));
const serve=await p.$('button:has-text("ติ๊กให้ครบก่อน")');
ok('  serve button is disabled until ticked', serve ? await serve.isDisabled() : false);
await p.screenshot({path:'bar-recipe.png'});

// tick every step — re-query each time so a re-render can't hand us a stale row
for(let i=0;i<40;i++){
  const clicked=await p.evaluate(()=>{
    const modal=[...document.querySelectorAll('div')].find(d=>/Ready to serve|\d+\/\d+/.test(d.textContent||'')&&d.querySelector('button'));
    const rows=[...document.querySelectorAll('div')].filter(d=>{
      const s=d.getAttribute('style')||'';
      return /cursor:\s*pointer/.test(s) && /border-radius:\s*10px/.test(s) && !/rgba\(74, 222, 128, 0.08\)/.test(s);
    });
    if(!rows.length) return false;
    rows[0].click(); return true;
  });
  if(!clicked) break;
  await p.waitForTimeout(120);
}
await p.waitForTimeout(500);
t=await p.evaluate(()=>document.body.innerText);
ok('ticking everything shows ready', /พร้อมเสิร์ฟ \/ Ready to serve/.test(t));
await p.screenshot({path:'bar-done.png'});

// Manhattan carries the sheet-error note
await p.keyboard.press('Escape').catch(()=>{});
await p.evaluate(()=>{const d=document.querySelector('div[style*="position: fixed"]');d&&d.click();});
await p.waitForTimeout(600);
await p.click('button:has-text("Manhattan")').catch(()=>{});
await p.waitForTimeout(700);
t=await p.evaluate(()=>document.body.innerText);
ok('Manhattan flags the 178-vs-163 sheet error', /178/.test(t)&&/Matcha Forest/.test(t));

console.log('ERRORS:',errs.length?errs:'none');
console.log(fails.length?('FAIL: '+fails.join(' | ')):'ALL PASS');
await b.close(); process.exit((errs.length||fails.length)?1:0);
