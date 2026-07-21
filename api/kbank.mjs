// K PAYMENT GATEWAY (Kasikornbank / KBank) adapter — SCAFFOLD, NOT YET WIRED TO REAL ENDPOINTS.
//
// IMPORTANT — read before relying on this:
// Unlike api/omise.mjs (built from Omise's public, verified API docs), KBank's real API Reference
// (base URL, auth headers, exact request/response field names for creating a PromptPay QR charge and
// checking its status) is gated behind their developer portal and only released once you register as
// a K PAYMENT GATEWAY merchant at https://apiportal.kasikornbank.com/ and get approved. I could not
// verify those exact technical details from public sources, so I did NOT fabricate them here — doing so
// would produce code that looks correct but silently fails or breaks at a bad time.
//
// This file is wired up correctly on the app side (same request/response shape as api/omise.mjs:
// POST ?action=create -> {chargeId,status,qrUrl}; GET ?action=status&id=... -> {chargeId,status}),
// so once you get real API access from KBank, only the two fetch() calls below need to be filled in
// with the real endpoint URL, auth, and field names — everything else (the POS UI, QR modal, polling,
// auto-checkout-on-success) already works and doesn't need to change.
//
// Env vars to set in Vercel once you have them from KBank:
//   KBANK_MERCHANT_ID, KBANK_API_KEY, KBANK_API_SECRET  (exact names may differ — use what KBank gives you)

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const configured = !!(process.env.KBANK_API_KEY && process.env.KBANK_MERCHANT_ID);
  const action = (req.query && req.query.action) || (req.body && req.body.action);

  if (!configured) {
    res.status(200).json({ error: "K PAY ยังไม่ได้เชื่อมต่อจริง — ต้องสมัคร K PAYMENT GATEWAY ที่ apiportal.kasikornbank.com ก่อน แล้วนำ API key/Merchant ID มาใส่ใน Vercel env vars (KBANK_API_KEY, KBANK_MERCHANT_ID, KBANK_API_SECRET) จากนั้นแจ้ง Claude เพื่อเชื่อมต่อ endpoint จริง" });
    return;
  }

  try {
    if (action === "create" && req.method === "POST") {
      const b = req.body || {};
      const amount = Math.round(+b.amount || 0);
      if (!amount || amount < 100) { res.status(400).json({ error: "amount (in satang, min 100) required" }); return; }

      // TODO: replace with the real K Payment Gateway "create QR / create charge" call once you have
      // the official API Reference from KBank. Placeholder shape shown below.
      // const r = await fetch("<REAL_KBANK_ENDPOINT>", {
      //   method: "POST",
      //   headers: { "Authorization": "<REAL_AUTH_SCHEME>", "Content-Type": "application/json" },
      //   body: JSON.stringify({ merchantId: process.env.KBANK_MERCHANT_ID, amount, currency: "THB" })
      // });
      // const d = await r.json();
      // respond with: { chargeId: d.<realIdField>, status: d.<realStatusField>, qrUrl: d.<realQrImageField> }

      res.status(200).json({ error: "K PAY endpoint ยังไม่ได้เชื่อมต่อจริง — โครงสร้างพร้อมแล้ว รอ API Reference จริงจาก KBank" });
      return;
    }

    if (action === "status" && req.method === "GET") {
      const id = req.query && req.query.id;
      if (!id) { res.status(400).json({ error: "id required" }); return; }
      // TODO: replace with the real K Payment Gateway "check transaction status" call.
      res.status(200).json({ error: "K PAY status endpoint ยังไม่ได้เชื่อมต่อจริง" });
      return;
    }

    res.status(400).json({ error: "unknown action" });
  } catch (e) {
    res.status(200).json({ error: "K PAY connection error: " + String(e && e.message) });
  }
}