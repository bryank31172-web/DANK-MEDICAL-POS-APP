/* End-to-end Vital Signs workflow in the offline harness.
 *
 *   npm run pos:build
 *   npm run serve
 *   node pos/__tests__/vital-signs.test.mjs
 */
import { chromium } from './_playwright.mjs';

const errors=[],fails=[];
const ok=(name,condition,detail)=>{console.log((condition?'✓ ':'✗ ')+name+(condition||detail===undefined?'':' → '+detail));if(!condition)fails.push(name);};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:390,height:844}});
page.on('pageerror',e=>errors.push(e.message.slice(0,160)));
await page.addInitScript(()=>{
  localStorage.setItem('dank_customers',JSON.stringify([{id:'P-001',name:'Test Patient',phone:'0812345678',points:0,totalSpent:0,visits:0,isMedical:true}]));
  localStorage.removeItem('dank_vital_signs');
});
await page.goto('http://127.0.0.1:8799/pos/testrun/test2.html');
await page.waitForTimeout(1800);
for(const digit of '110114')await page.click(`button:has-text("${digit}")`);
await page.waitForTimeout(1500);

await page.click('button:has-text("CRM")');
await page.waitForTimeout(400);
const medButton=page.locator('button').filter({hasText:'Medical'}).first();
await medButton.click();
await page.waitForTimeout(500);
ok('Vital Signs card is visible',await page.getByText('Vital Signs',{exact:false}).first().isVisible());
ok('Device Bridge controls are visible',await page.getByText('Clinic Device Bridge',{exact:false}).isVisible());

const scan=page.locator('input[placeholder*="Member QR"]');
await scan.fill('P-001');
await scan.press('Enter');
await page.waitForTimeout(250);
ok('member scan selects the patient',await page.getByText('Test Patient',{exact:false}).first().isVisible());

await page.locator('input[placeholder="36.5"]').fill('36.7');
await page.locator('input[placeholder="65.00"]').fill('68.25');
await page.locator('input[placeholder="170.0"]').fill('172.4');
ok('BMI is calculated',await page.getByText('23',{exact:true}).isVisible());
await page.locator('button').filter({hasText:'💾'}).click();
await page.waitForTimeout(300);

const saved=await page.evaluate(()=>({vitals:JSON.parse(localStorage.getItem('dank_vital_signs')||'[]'),audit:JSON.parse(localStorage.getItem('dank_audit')||'[]'),width:document.documentElement.scrollWidth,vw:innerWidth}));
ok('reading is saved for the selected patient',saved.vitals.length===1&&saved.vitals[0].patientId==='P-001',JSON.stringify(saved.vitals[0]));
ok('saved units remain clinical units',saved.vitals[0]?.temperatureC===36.7&&saved.vitals[0]?.weightKg===68.25&&saved.vitals[0]?.heightCm===172.4);
ok('save writes the audit log',saved.audit.some(x=>x.action==='VITAL_SIGNS_RECORDED'));
ok('phone layout does not scroll sideways',saved.width===saved.vw,`${saved.width} vs ${saved.vw}`);
ok('no page errors',errors.length===0,errors.join(' | '));

console.log(`\n${fails.length||errors.length?'FAIL':'PASS'} — ${fails.length} failed`);
await browser.close();
process.exit(fails.length||errors.length?1:0);
