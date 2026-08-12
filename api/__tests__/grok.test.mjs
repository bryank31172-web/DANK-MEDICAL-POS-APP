
function mkRes(){const r={code:200,body:null,headers:{}};
  r.setHeader=(k,v)=>{r.headers[k]=v;};
  r.status=c=>{r.code=c;return r;};
  r.json=b=>{r.body=b;return r;};
  r.end=()=>r; return r;}
function mkReq(o={}){return {method:o.method||'POST',url:o.url||'/api/grok?action=chat',
  headers:Object.assign({host:'pos.test',origin:'https://pos.test'},o.headers||{}),
  body:o.body,query:o.query||{}};}
let pass=0,fail=0;
const ok=(n,c,extra='')=>{c?(pass++,console.log('  ✓',n)):(fail++,console.log('  ✗',n,extra));};

// ── mock xAI ──
let lastCall=null;
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,opt)=>{
  lastCall={url:String(url),body:JSON.parse(opt.body||'{}'),headers:opt.headers};
  if(String(url).includes('x.ai')) return {ok:true,status:200,
    text:async()=>JSON.stringify({choices:[{message:{content:'MOCK REPLY'}}]})};
  return {ok:false,status:404,text:async()=>'{}',json:async()=>({})};
};

const {default:grok}=await import('../grok.mjs');

console.log('\n[1] no API key configured');
delete process.env.XAI_API_KEY;
let res=mkRes(); await grok(mkReq({body:{messages:[{role:'user',content:'hi'}]}}),res);
ok('returns content[0].text shape (POS can read it)', res.body?.content?.[0]?.text?.includes('not configured'), JSON.stringify(res.body));

process.env.XAI_API_KEY='test-key';
console.log('\n[2] chat: Anthropic in -> xAI out -> Anthropic back');
res=mkRes();
await grok(mkReq({body:{model:'claude-sonnet-4-6',max_tokens:300,system:'SYS',messages:[{role:'user',content:'ยอดขายวันนี้?'}]}}),res);
ok('reply arrives as content[0].text', res.body?.content?.[0]?.text==='MOCK REPLY', JSON.stringify(res.body));
ok('stale claude model id ignored, GROK_MODEL used', lastCall.body.model==='grok-4', lastCall.body.model);
ok('system became a system message', lastCall.body.messages[0].role==='system'&&lastCall.body.messages[0].content==='SYS');
ok('user turn forwarded', lastCall.body.messages[1].content==='ยอดขายวันนี้?');
ok('max_tokens honoured', lastCall.body.max_tokens===300, lastCall.body.max_tokens);

console.log('\n[3] cross-origin caller is refused');
res=mkRes(); await grok(mkReq({headers:{origin:'https://evil.example'},body:{messages:[{role:'user',content:'x'}]}}),res);
ok('403 forbidden', res.code===403, res.code+' '+JSON.stringify(res.body));

console.log('\n[4] vision');
res=mkRes();
await grok(mkReq({url:'/api/grok?action=vision',body:{image:'data:image/jpeg;base64,AAAA',system:'S',prompt:'read it'}}),res);
ok('returns text', res.body?.content?.[0]?.text==='MOCK REPLY');
const parts=lastCall.body.messages[1].content;
ok('image sent as image_url part', Array.isArray(parts)&&parts.some(p=>p.type==='image_url'), JSON.stringify(parts).slice(0,80));
res=mkRes(); await grok(mkReq({url:'/api/grok?action=vision',body:{image:'notanimage'}}),res);
ok('rejects non-data-URI', /Unsupported/.test(res.body?.content?.[0]?.text||''), JSON.stringify(res.body));

console.log('\n[5] video/job with no XAI_VIDEO_URL');
res=mkRes(); await grok(mkReq({url:'/api/grok?action=video',body:{prompt:'p'}}),res);
ok('video reports it is off (POS shows the reason)', /off/i.test(res.body?.error||''), JSON.stringify(res.body));
res=mkRes(); await grok(mkReq({url:'/api/grok?action=job&id=abc',method:'GET'}),res);
ok('job returns failed not a hang', res.body?.status==='failed', JSON.stringify(res.body));

console.log('\n[6] xAI upstream error surfaces the real reason');
globalThis.fetch=async()=>({ok:false,status:401,text:async()=>JSON.stringify({error:{message:'Invalid API key'}})});
res=mkRes(); await grok(mkReq({body:{messages:[{role:'user',content:'x'}]}}),res);
ok('shows "Invalid API key" to staff', /Invalid API key/.test(res.body?.content?.[0]?.text||''), JSON.stringify(res.body));

console.log(`\n${fail?'FAIL':'PASS'} — ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
