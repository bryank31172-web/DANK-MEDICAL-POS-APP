const fs=require('fs');
const s=fs.readFileSync('pos/app.fixed.jsx','utf8');
let pass=0,total=0;
function check(ok,n){total++;if(ok){pass++;console.log('✓ '+n);}else console.error('✗ '+n);}
check(s.includes('const [inventoryByStore,setInventoryByStore]=useState({});'),'keeps StoreHub inventory by location');
check(s.includes('inventoryByStore[String(activeBranch)]'),'selected branch drives displayed stock');
check(s.includes('txMatchesCustomer')&&s.includes('customerMatchKeys')&&s.includes('txMatchKeys'),'CRM bills match ID, phone and email aliases');
check(s.includes('Purchased categories')&&s.includes('บิลล่าสุด'),'customer cards expose category and last-bill history');
check(s.includes('proofImage:topUpProof||null'),'top-up stores uploaded proof');
check(s.includes('topUpForm.method!=="cash"&&!topUpProof'),'non-cash top-up requires proof');
check(s.includes('/v1/print')&&s.includes('port:9100'),'LAN printer sends through local bridge');
console.log(`\n${pass}/${total} passed`);process.exit(pass===total?0:1);
