// DuckyPay non-custodial crypto payment gateway adapter (USDT/USDC wallet payments)
// Env vars required (set in Vercel Project Settings → Environment Variables):
//   DUCKYPAY_API_KEY   — from your DuckyPay merchant dashboard (duckypay.co)
//   DUCKYPAY_CHAIN_ID  — optional, defaults to 137 (Polygon) per DuckyPay's own docs example
// Docs referenced: https://docs.duckypay.co/api/charges

const BASE = "https://api.duckypay.co";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const APIKEY = process.env.DUCKYPAY_API_KEY;
  const CHAIN_ID = process.env.DUCKYPAY_CHAIN_ID || "137";
  const action = (req.query && req.query.action) || (req.body && req.body.action);

  if (!APIKEY) {
    res.status(200).json({ error: "DuckyPay ยังไม่ได้เชื่อมต่อ — ตั้งค่า DUCKYPAY_API_KEY ใน Vercel env vars ก่อน (สมัครที่ duckypay.co)" });
    return;
  }

  try {
    if (action === "create" && req.method === "POST") {
      const b = req.body || {};
      const amount = String(b.amount || "0");
      if (!(+amount > 0)) { res.status(400).json({ error: "amount (THB) required" }); return; }
      const reference = b.reference || ("DCK-" + Math.random().toString(36).slice(2));

      const r = await fetch(BASE + "/v1/invoices", {
        method: "POST",
        headers: {
          "x-api-key": APIKEY,
          "content-type": "application/json",
          "Idempotency-Key": reference
        },
        body: JSON.stringify({
          chainId: +CHAIN_ID,
          fiat: { currency: "THB", amount: amount },
          paymentMode: "both",
          reference: reference
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.invoiceId) {
        res.status(200).json({ error: "DuckyPay invoice error: " + (d.message || d.error || r.status) });
        return;
      }

      res.status(200).json({
        chargeId: d.invoiceId,
        status: d.status || "pending",
        checkoutUrl: d.checkoutUrl || null,
        depositAddress: d.depositAddress || null,
        fiat: d.fiat || null
      });
      return;
    }

    if (action === "status" && req.method === "GET") {
      const id = req.query && req.query.id;
      if (!id) { res.status(400).json({ error: "id required" }); return; }
      const r = await fetch(BASE + "/v1/charges/" + encodeURIComponent(id) + "/status", {
        headers: { "x-api-key": APIKEY }
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { res.status(200).json({ error: "DuckyPay status error: " + (d.message || d.error || r.status) }); return; }
      res.status(200).json({ chargeId: d.invoiceId || id, status: d.status });
      return;
    }

    res.status(400).json({ error: "unknown action" });
  } catch (e) {
    res.status(200).json({ error: "DuckyPay connection error: " + String(e && e.message) });
  }
}
