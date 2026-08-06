/* POST /api/staff-auth — verify a login PIN without shipping it to the browser.

   The POS roster used to carry every staff PIN as plaintext in this public
   repo, seeded straight into localStorage. Anyone could open the POS URL in
   their own browser, type the CEO's PIN and read sales, costs, customers and
   wages. The PINs are gone from the bundle; they live here instead, in env.

   The POS still checks its local roster first, so devices that already have
   staff saved keep working and a branch with no internet can still sell. This
   is the path for a device that has no local match — which is exactly the
   fresh-browser case that used to be wide open.

   Env (set on the Vercel project, never in the repo):
     STAFF_PINS   JSON map of pin -> staff, e.g.
                  {"482913":{"name":"Bryan (CEO)","role":"owner","id":1},
                   "570461":{"name":"Bank","role":"manager","id":2}}
     MASTER_PIN   shorthand for a single owner account when a full map is
                  overkill. MASTER_NAME optionally names it.

   With neither set the endpoint refuses everyone — it never falls back to a
   value from the repo, which is the failure this exists to end.               */

import { requireSameOrigin } from "./_auth.js";
import { requireRate } from "./_ratelimit.js";
import { timingSafeEqual } from "node:crypto";

const DENY = { ok: false, error: "invalid" };

function safeEq(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  try { return timingSafeEqual(x, y); } catch { return false; }
}

function lookup(pin) {
  const master = process.env.MASTER_PIN;
  if (master && safeEq(pin, master)) {
    return { ok: true, id: 1, name: process.env.MASTER_NAME || "Bryan (CEO)", role: "owner" };
  }
  const raw = process.env.STAFF_PINS;
  if (!raw) return null;
  let map;
  try { map = JSON.parse(raw); } catch { console.error("STAFF_PINS is not valid JSON"); return null; }
  // walk every entry rather than index by key, so lookup time does not leak
  // whether a PIN exists
  let hit = null;
  for (const [k, v] of Object.entries(map)) if (safeEq(pin, k)) hit = v;
  if (!hit) return null;
  return {
    ok: true,
    id: hit.id,
    name: hit.name || "Staff",
    role: hit.role || "budtender",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  if (!requireSameOrigin(req, res)) return;
  // a 6-digit PIN is a million guesses; this is what makes that impractical
  if (!(await requireRate(req, res, "staff_auth", 8, 300))) return;

  if (!process.env.MASTER_PIN && !process.env.STAFF_PINS) {
    return res.status(200).json({
      ok: false,
      error: "not configured",
      detail: "Set MASTER_PIN or STAFF_PINS on this deployment, then redeploy.",
    });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const pin = body && body.pin;
  if (typeof pin !== "string" || pin.length < 4 || pin.length > 32) {
    return res.status(200).json(DENY);
  }

  const who = lookup(pin);
  if (!who) return res.status(200).json(DENY);
  return res.status(200).json(who);
}
