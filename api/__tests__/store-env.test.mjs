/* The Vercel → Upstash integration injects KV_REST_API_URL / KV_REST_API_TOKEN,
 * never the UPSTASH_REDIS_REST_* pair the code used to read. A deployment could
 * therefore have a Redis database attached, look configured in the dashboard,
 * and still run entirely on the in-memory store — losing every write between
 * serverless invocations. Same trap STOREHUB_TOKEN vs STOREHUB_KEY set earlier.
 *
 *   node api/__tests__/store-env.test.mjs
 */
let pass = 0, fail = 0;
const is = (got, want, note) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"}  ${note}: got ${got}, want ${want}`);
};

const KEYS = [
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL", "KV_REST_API_TOKEN", "KV_REST_API_READ_ONLY_TOKEN",
];
const clear = () => KEYS.forEach((k) => { delete process.env[k]; });

// each case is a fresh import so the module-level constants are re-read
let n = 0;
const load = () => import(`../_store.js?case=${++n}`);

clear();
is((await load()).usingRedis(), false, "no env at all -> memory mode");

clear();
process.env.UPSTASH_REDIS_REST_URL = "https://u.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
is((await load()).usingRedis(), true, "UPSTASH_* pair (direct signup)");

clear();
process.env.KV_REST_API_URL = "https://kv.upstash.io";
process.env.KV_REST_API_TOKEN = "tok";
is((await load()).usingRedis(), true, "KV_* pair (Vercel Marketplace) — the regression");

clear();
process.env.KV_REST_API_URL = "https://kv.upstash.io";
process.env.KV_REST_API_READ_ONLY_TOKEN = "ro";
is((await load()).usingRedis(), true, "read-only token still beats memory mode");

clear();
process.env.KV_REST_API_URL = "https://kv.upstash.io";
is((await load()).usingRedis(), false, "url without any token is not 'configured'");

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
