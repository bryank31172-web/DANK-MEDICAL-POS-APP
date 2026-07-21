// Omise (Opn Payments) PromptPay QR adapter
// Env vars required (set in Vercel Project Settings → Environment Variables):
//   OMISE_SECRET_KEY  — starts with "skey_" (Omise dashboard → API Keys)
//   OMISE_PUBLIC_KEY  — starts with "pkey_" (used server-side here to create the Source; Omise's public key is safe
//                        to use for Source creation per their docs, but we keep it server-side anyway for simplicity)
// Docs referenced: https://docs.omise.co/promptpay , https://docs.omise.co/sources-api , https://docs.omise.co/charges-api

function authHeader(key) {
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const SKEY = process.env.OMISE_SECRET_KEY;
  const PKEY = process.env.OMISE_PUBLIC_KEY;
  const action = (req.query && req.query.action) || (req.body && req.body.action);

  if (!SKEY || !PKEY) {
    res.status(200).json({ error: "Omise not configured — set OMISE_SECRET_KEY and OMISE_PUBLIC_KEY in Vercel env vars first." });
    return;
  }

  try {
    if (action === "create" && req.method === "POST") {
      const b = req.body || {};
      const amount = Math.round(+b.amount || 0); // subunits (satang) — caller must send THB*100
      if (!amount || amount < 100) { res.status(400).json({ error: "amount (in satang, min 100) required" }); return; }

      // Step 1: create a PromptPay source (public key)
      const srcRes = await fetch("https://api.omise.co/sources", {
        method: "POST",
        headers: { Authorization: authHeader(PKEY), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ amount: String(amount), currency: "THB", type: "promptpay" })
      });
      const src = await srcRes.json().catch(() => ({}));
      if (!srcRes.ok || !src.id) {
        res.status(200).json({ error: "Omise source error: " + (src.message || srcRes.status) });
        return;
      }

      // Step 2: create a charge from that source (secret key)
      const chRes = await fetch("https://api.omise.co/charges", {
        method: "POST",
        headers: { Authorization: authHeader(SKEY), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ amount: String(amount), currency: "THB", source: src.id })
      });
      const ch = await chRes.json().catch(() => ({}));
      if (!chRes.ok || !ch.id) {
        res.status(200).json({ error: "Omise charge error: " + (ch.message || chRes.status) });
        return;
      }

      const qrUrl = ch.source && ch.source.scannable_code && ch.source.scannable_code.image && ch.source.scannable_code.image.download_uri;
      res.status(200).json({ chargeId: ch.id, status: ch.status, qrUrl: qrUrl || null, amount: ch.amount, expiresAt: ch.expires_at || null });
      return;
    }

    if (action === "status" && req.method === "GET") {
      const id = req.query && req.query.id;
      if (!id) { res.status(400).json({ error: "id required" }); return; }
      const r = await fetch("https://api.omise.co/charges/" + encodeURIComponent(id), {
        headers: { Authorization: authHeader(SKEY) }
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { res.status(200).json({ error: "Omise status error: " + (d.message || r.status) }); return; }
      res.status(200).json({ chargeId: d.id, status: d.status, paid: d.paid === true, failureCode: d.failure_code || null });
      return;
    }

    res.status(400).json({ error: "unknown action" });
  } catch (e) {
    res.status(200).json({ error: "Omise connection error: " + String(e && e.message) });
  }
}
