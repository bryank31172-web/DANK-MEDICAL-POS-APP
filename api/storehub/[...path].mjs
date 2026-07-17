// StoreHub API proxy v2 — reads path from req.url directly, adds ?debug=1 mode.
const ALLOWED = ["products", "transactions", "customers", "inventory", "employees", "stores", "timesheets"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  const user = process.env.STOREHUB_USER;
  const key = process.env.STOREHUB_KEY;
  const u = new URL(req.url, "https://local.host");
  const debug = u.searchParams.get("debug") === "1";
  u.searchParams.delete("debug");
  const clean = decodeURIComponent(u.pathname)
    .replace(/^\/api\/storehub\/?/, "")
    .replace(/\/+$/, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "");
  if (!user || !key) {
    res.status(debug ? 200 : 500).json({ error: "StoreHub credentials not configured. Add STOREHUB_USER and STOREHUB_KEY in Vercel settings, then redeploy." });
    return;
  }
  if (!clean || !ALLOWED.includes(clean.split("/")[0])) {
    res.status(debug ? 200 : 400).json({ error: "Path not allowed: /" + clean, requestUrl: req.url });
    return;
  }
  const qs = u.searchParams.toString();
  const target = "https://api.storehubhq.com/" + clean + (qs ? "?" + qs : "");
  try {
    const auth = "Basic " + Buffer.from(user + ":" + key).toString("base64");
    const r = await fetch(target, { headers: { Authorization: auth, Accept: "application/json" } });
    const text = await r.text();
    if (debug) {
      res.status(200).json({ target, upstreamStatus: r.status, contentType: r.headers.get("content-type"), bodyPreview: text.slice(0, 600) });
      return;
    }
    res.status(r.status);
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (e) {
    res.status(debug ? 200 : 502).json({ error: "StoreHub upstream error: " + String(e && e.message), target });
  }
}
