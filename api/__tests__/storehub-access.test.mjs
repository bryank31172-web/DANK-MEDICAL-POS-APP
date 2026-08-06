function mkRes(){const r={code:200,body:null,headers:{}};
  r.setHeader=(k,v)=>{r.headers[k]=v;};r.status=c=>{r.code=c;return r;};
  r.json=b=>{r.body=b;return r;};r.end=()=>r;return r;}
const {default:sh}=await import('../storehub/[...path].mjs');
let pass=0,fail=0;
const ok=(n,c,e='')=>{c?(pass++,console.log('  ✓',n)):(fail++,console.log('  ✗',n,e));};
process.env.STOREHUB_USER='u';process.env.STOREHUB_KEY='k';
globalThis.fetch=async()=>({ok:true,status:200,json:async()=>([{id:1,name:'secret product'}]),text:async()=>JSON.stringify([{id:1,name:'secret product'}])});

console.log('\nstorehub proxy access control');
// 1. bare URL in a browser address bar: no Origin, no Referer
let res=mkRes();
await sh({method:'GET',url:'/api/storehub/customers',headers:{host:'pos.test'},query:{}},res);
ok('bare URL (no origin/referer) is refused', res.code===403, res.code+' '+JSON.stringify(res.body).slice(0,90));

// 2. another site calling it
res=mkRes();
await sh({method:'GET',url:'/api/storehub/customers',headers:{host:'pos.test',origin:'https://evil.example'},query:{}},res);
ok('cross-origin is refused', res.code===403, res.code);

// 3. the POS itself
res=mkRes();
await sh({method:'GET',url:'/api/storehub/products',headers:{host:'pos.test',origin:'https://pos.test'},query:{}},res);
ok('POS same-origin passes the guard (reaches upstream)', res.code!==403, 'got 403');

// 4. script with STAFF_KEY
process.env.STAFF_KEY='s3cret';
res=mkRes();
await sh({method:'GET',url:'/api/storehub/products',headers:{host:'pos.test'},query:{key:'s3cret'}},res);
ok('STAFF_KEY escape hatch passes the guard', res.code!==403, 'got 403');

// 5. wrong key
res=mkRes();
await sh({method:'GET',url:'/api/storehub/products',headers:{host:'pos.test'},query:{key:'wrong'}},res);
ok('wrong STAFF_KEY refused', res.code===403, res.code);

console.log(`\n${fail?'FAIL':'PASS'} — ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
