function mkRes(){const r={code:200,body:null,headers:{}};r.setHeader=(k,v)=>{r.headers[k]=v;};
 r.status=c=>{r.code=c;return r;};r.json=b=>{r.body=b;return r;};r.end=()=>r;return r;}
const req=(body,hdr)=>({method:'POST',url:'/api/staff-auth',
 headers:Object.assign({host:'pos.test',origin:'https://pos.test'},hdr||{}),body,query:{}});
const {default:h}=await import('../staff-auth.mjs');
let pass=0,fail=0; const ok=(n,c,e='')=>{c?(pass++,console.log('  ✓',n)):(fail++,console.log('  ✗',n,e));};

console.log('\nstaff-auth');
delete process.env.MASTER_PIN; delete process.env.STAFF_PINS;
let r=mkRes(); await h(req({pin:'110114'}),r);
ok('unconfigured deployment refuses everyone', r.body?.ok===false&&/not configured/.test(r.body?.error||''), JSON.stringify(r.body));

process.env.MASTER_PIN='482913';
r=mkRes(); await h(req({pin:'482913'}),r);
ok('correct master PIN authenticates as owner', r.body?.ok===true&&r.body?.role==='owner', JSON.stringify(r.body));
r=mkRes(); await h(req({pin:'110114'}),r);
ok('the old published PIN is now just wrong', r.body?.ok===false, JSON.stringify(r.body));
r=mkRes(); await h(req({pin:'48291'}),r);
ok('near-miss rejected', r.body?.ok===false);
r=mkRes(); await h(req({pin:'1'}),r);
ok('too-short input rejected without a lookup', r.body?.ok===false);

process.env.STAFF_PINS=JSON.stringify({"570461":{name:"Bank",role:"manager",id:2}});
r=mkRes(); await h(req({pin:'570461'}),r);
ok('roster map resolves name and role', r.body?.ok===true&&r.body?.name==='Bank'&&r.body?.role==='manager', JSON.stringify(r.body));

r=mkRes(); await h(req({pin:'482913'},{origin:'https://evil.example'}),r);
ok('cross-origin refused', r.code===403, r.code);

r=mkRes(); await h({method:'GET',url:'/api/staff-auth',headers:{host:'pos.test',origin:'https://pos.test'},query:{}},r);
ok('GET refused (no PINs in a URL)', r.code===405);

process.env.STAFF_PINS='{not json';
r=mkRes(); await h(req({pin:'570461'}),r);
ok('broken STAFF_PINS fails closed, not open', r.body?.ok===false, JSON.stringify(r.body));

console.log(`\n${fail?'FAIL':'PASS'} — ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
