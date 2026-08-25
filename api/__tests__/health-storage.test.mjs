/* /api/health now reports whether the shared store is real Redis or the
 * per-instance memory fallback, so attaching a database can be confirmed
 * without guessing. Names only — never the URL or the token. */
let pass=0,fail=0;
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
const is=(g,w,n)=>{const ok=g===w;ok?pass++:fail++;console.log(`${ok?'✓':'✗'}  ${n}: got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`);};
const KEYS=["UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN","KV_REST_API_URL","KV_REST_API_TOKEN"];
const clear=()=>KEYS.forEach(k=>{delete process.env[k];});
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
let n=0; const load=()=>import(pathToFileURL(path.join(repo,'api','_store.js')).href+`?h=${++n}`);

clear();
is((await load()).usingRedis(), false, 'nothing attached -> memory fallback');

clear();
process.env.UPSTASH_REDIS_REST_URL="https://u.upstash.io"; process.env.UPSTASH_REDIS_REST_TOKEN="t";
is((await load()).usingRedis(), true, 'UPSTASH_* names report redis');

clear();
process.env.KV_REST_API_URL="https://kv.upstash.io"; process.env.KV_REST_API_TOKEN="t";
is((await load()).usingRedis(), true, "Vercel's KV_* names report redis too");

// the health payload must never carry the secret itself
const src=fs.readFileSync(path.join(repo,'api','health.js'),'utf8');
const block=src.slice(src.indexOf('storage: {'), src.indexOf('updated:', src.indexOf('storage: {')));
is(/process\.env\.\w*TOKEN\b(?!\s*\?)/.test(block.replace(/\?\s*"[^"]*"/g,'')), false, 'no token value is placed in the response');
is(block.includes('usingRedis()'), true, 'it reports the real store state, not a guess');
is(/UPSTASH_REDIS_REST_URL \? "UPSTASH_REDIS_REST_\*"/.test(block), true, 'it names which env pair was found');

console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
