// BRYAN POS cloud sync — mirrors dank_* localStorage keys per branch into Supabase.
// Auth: X-Sync-Key header must equal env SYNC_KEY. Data access uses the
// service-role key server-side only; the table has RLS on with no policies,
// so browser keys have zero direct access.
//
// GET  /api/sync?branch=Pattanakarn          -> { ok, rows:[{key,value,updated_at}] }
// POST /api/sync {branch, device, sets:[{key,value,updatedAt}]} -> { ok, applied, skipped }

const SB_URL = process.env.SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || "";

function sb(path, opts) {
  return fetch(SB_URL + path, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      Authorization: "Bearer " + SB_KEY,
      "Content-Type": "application/json",
      ...(opts && opts.headers),
    },
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const want = process.env.SYNC_KEY;
  if (!want) { res.status(500).json({ error: "SYNC_KEY not configured in Vercel env" }); return; }
  if ((req.headers["x-sync-key"] || "") !== want) { res.status(401).json({ error: "bad sync key" }); return; }
  if (!SB_URL || !SB_KEY) { res.status(500).json({ error: "SUPABASE_URL / SUPABASE_SERVICE_KEY not configured" }); return; }

  try {
    if (req.method === "GET") {
      const u = new URL(req.url, "https://x");
      const branch = (u.searchParams.get("branch") || "").slice(0, 60);
      if (!branch) { res.status(400).json({ error: "branch required" }); return; }
      const r = await sb("/rest/v1/kv_state?branch=eq." + encodeURIComponent(branch) + "&select=key,value,updated_at");
      if (!r.ok) throw new Error("supabase " + r.status);
      res.status(200).json({ ok: true, rows: await r.json() });
      return;
    }
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
      if (!body || !body.branch || !Array.isArray(body.sets)) { res.status(400).json({ error: "branch + sets[] required" }); return; }
      const sets = body.sets.slice(0, 200).map((s) => ({
        key: String(s.key || "").slice(0, 80),
        value: s.value === undefined ? null : s.value,
        updatedAt: s.updatedAt || new Date().toISOString(),
      })).filter((s) => s.key.startsWith("dank_"));
      const r = await sb("/rest/v1/rpc/kv_upsert_if_newer", {
        method: "POST",
        body: JSON.stringify({ _branch: String(body.branch).slice(0, 60), _rows: sets, _device: String(body.device || "").slice(0, 60) }),
      });
      if (!r.ok) throw new Error("supabase " + r.status + " " + (await r.text()).slice(0, 200));
      const out = await r.json();
      res.status(200).json({ ok: true, ...out });
      return;
    }
    res.status(405).json({ error: "GET/POST only" });
  } catch (e) {
    res.status(502).json({ error: "sync: " + String((e && e.message) || e) });
  }
}
