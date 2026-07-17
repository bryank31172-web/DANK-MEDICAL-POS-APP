// StoreHub API proxy — keeps credentials server-side, solves browser CORS.
// Set env vars in Vercel: Project → Settings → Environment Variables
//   STOREHUB_USER = your StoreHub API username
//   STOREHUB_KEY  = your StoreHub API key
// The POS calls /api/storehub/products (etc.); this forwards to api.storehubhq.com.

const ALLOWED = ["products", "transactions", "customers", "inventory", "employees", "stores"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }
  const user = process.env.STOREHUB_USER;
  const key = process.env.STOREHUB_KEY;
  if (!user || !key) {
    res.status(500).json({ error: "StoreHub credentials not configured. Add STOREHUB_USER and STOREHUB_KEY in Vercel project settings, then redeploy." });
    return;
  }
  const segs = Array.isArray(req.query.path) ? req.query.path : [req.query.path || ""];
  const clean = segs.join("/").replace(/[^a-zA-Z0-9/_-]/g, "");
  if (!ALLOWED.includes(clean.split("/")[0])) {
    res.status(400).json({ error: "Path not allowed: " + clean });
    return;
  }
  const qs = Object.entries(req.query)
    .filter(([k]) => k !== "path")
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(String(v)))
    .join("&");
  const url = "https://api.storehubhq.com/" + clean + (qs ? "?" + qs : "");
  try {
    const auth = "Basic " + Buffer.from(user + ":" + key).toString("base64");
    const r = await fetch(url, { headers: { Authorization: auth, Accept: "application/json" } });
    const text = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "StoreHub upstream error: " + String(e && e.message) });
  }
}
