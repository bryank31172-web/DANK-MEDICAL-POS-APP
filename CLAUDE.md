# DANK BKK — BRYAN POS (project brain)

Owner: Bryan · Dank Cannabis Clinic Bangkok (Pattanakarn, Sathorn, Petchaboon, Phuket, Bars)

## The two products (NEVER mix them up)
1. **BRYAN POS** — THIS repo (github.com/bryank31172-web/dank-medical-pos-app, public).
   Live: https://dank-medical-pos-app.vercel.app · deploy = commit `index.html` to repo root, Vercel auto-deploys.
2. **Customer website** — dankbkk-site repo (PRIVATE, separate; owner uploads via GitHub web UI).
   Live: https://dankbkk-site.vercel.app · static html + /api serverless functions.

## POS build pipeline (pos/)
- **Source of truth: `pos/app.fixed.jsx`** (~1.4MB, ES5-style React, one component `GreenPOS`).
  The deployed `index.html` at repo root is COMPILED — always edit the JSX, then rebuild:
  `bash pos/build.sh` (needs esbuild; `npm i -g esbuild` or `npx esbuild`).
- ⚠ app.fixed.jsx has extremely long lines — the Read tool chokes on it. Use `grep -n`, `sed -n 'X,Yp'`,
  and python find-replace for edits (exact-string replace with assert count==1, like a surgeon).
- Offline test harness: after build, `pos/testrun/test2.html` runs the app with stubbed StoreHub APIs
  (stub.js provides 4 fake products + transactions). Login PIN **110114** — seeded by `testrun/head17.txt` for the harness only; it is NOT in the
  shipped bundle. Test with Playwright/chromium, crawl all tabs and assert zero pageerror.

## POS architecture notes
- Data: products/transactions pulled live from StoreHub via `/api/storehub/*` proxy (`api/storehub/[...path].mjs`;
  env vars STOREHUB_USER + STOREHUB_KEY set in Vercel). All other state in localStorage
  (keys prefixed `dank_`: staff, backstock=inactive stock, expenses, expense_targets, audit, customers extras...).
- `/api/storehub/*` requires same-origin or STAFF_KEY + rate limit. `/sold` = per-SKU sales counter:
  ?q=name&from=&to=, default 90d, voids excluded.
- `/api/grok` = AI for every 🤖 button: takes the Anthropic Messages shape the POS speaks, calls xAI
  underneath (`XAI_API_KEY`, `GROK_MODEL`). Actions: chat, vision; video is env-gated on XAI_VIDEO_URL.
- `/api/staff-auth` = server-side PIN check, used when a device has no local match.
- Dashboard KPIs are period-scoped via `_inDashPeriod` (day/month/quarter/year/all/custom). Net Profit
  = ①gross (rev − COGS via `_cogsMap`, estimates for missing costs) ②after fixed cost (`expenseTargets`,
  editable in-app by master, ÷30/day, day-count clamped to elapsed days) ③by branch ④daily table.
- Legacy pre-StoreHub sales (FoodStory 1–11 Jul 2026) in LEGACY_SALES const, margin-estimated.
- Stock: `p.stock`=Active (sellable), `backstock` localStorage=Inactive; receive→Inactive first;
  "▶ ย้ายเข้าขาย" button moves to Active. Member cards: memberCodeOf(c)="DK-"+hash6; QR deep-link
  `?member=<id>` auto-selects customer after login; manual entry box in POS cart panel.
- Every mutation calls addAudit(action, detail, user) → Audit Log (🪪 button).
- `clinicworks/` = separate ClinicWorks Cannabis landing page served at /clinicworks.

## Customer website notes (dankbkk-site — NOT this repo)
- Fixed index.html (cart NaN + Add-button crash for 6 tier-only/no-tier products; hardening in
  addToCart/quickAdd/addFromPD/repriceCart) may not be live yet — verify by: open site → Edibles →
  "Sour Belts 3000mg" → Add+ → cart must show ฿300, not ฿NaN.
- Menu source chain (api/_menu.js): MENU_FEED_URL → BRYAN POS feed → StoreHub → bundled products.json.
  Known pending: add Vercel env `POS_FEED_PATHS=/__no_pos_feed__` on dankbkk-site to prefer StoreHub
  (health endpoint currently reports source:"pos").

## Pending — in the order they should be done
1. **Set `MASTER_PIN` (new — the old 110114 is public and burned) and `XAI_API_KEY` in Vercel, then
   Redeploy.** Nothing else can be verified until login works. `STAFF_PINS` optional per-staff.
2. **Lock the claim-PIN hole — do this the moment step 1 works.** `handleClaimPin` (search
   `const handleClaimPin`) lets anyone on the public URL pick ANY staff name, including the CEO, set a
   6-digit PIN and get in with `approved:true` — no verification at all. It is currently the owner's
   only escape hatch if `MASTER_PIN` is unset, which is the only reason it still exists. Fix = require
   a server check (`/api/staff-auth`) or a manager PIN before it will write, or delete the flow.
3. **StoreHub credentials.** `/api/health` reports configured-but-not-loading. `api/_storehub.js`
   accepts `STOREHUB_TOKEN` or `STOREHUB_KEY`; confirm the value and that the account has API access.
4. Petchaboon/Phuket fixed-cost budgets are 0 — owner sets them in-app (Finance → 💸 → ✏ แก้งบ).
5. Decide the customer site's menu source: the curated 53-item `products.json` (names + photos) vs the
   raw 393-item POS feed currently served. Optional env `POS_FEED_PATHS=/__no_pos_feed__` on
   dankbkk-site prefers StoreHub.
6. Confirm the dankbkk-site cart NaN fix is live (Edibles → "Sour Belts 3000mg" → Add+ → must show
   ฿300, not ฿NaN).
7. Root HTML pages left in this repo belong to the customer site — `staff.html`,
   `build-your-joint.html`, `labels.html`, `status.html`, `SUMMARY.html`, plus the `i18n.js` all four
   load. Awaiting the owner's word on which are still in daily use before removing.

## Shipped this round (so it is not re-litigated)
- Customer price memory (`dank_cust_prices`): records what each customer paid, re-applies it only when
  it beats the current price, shows their last order with a one-tap reorder.
- Shift count: an over-count is a mismatch, not OK. `Math.abs(d)<=0.05` everywhere; over needs a reason
  at clock-out just like short.
- Scale precision: 4 decimals end to end, `fmtW()` prints exactly (0.039 stays 0.039).
- Bryan AI: `TAB_GUIDE` is an in-app manual for all 21 pages; unmatched questions go to `/api/grok`
  with that manual as the system prompt; answers carry a 📍 button that opens the page.
- Customer Display (CDS): `?cds=1` renders a read-only mirror of the till; BroadcastChannel +
  localStorage, so it needs no network. Button on Scale & Print.
- Design: forest-green tokens, pill buttons/badges. `inkOn(bg,fg)` in the token layer swaps light text
  for near-black over any light fill — two real contrast bugs were found by measuring every tab
  (product names were black-on-black at 1.05:1; white sat on mint/sky/gold at 1.7–2.3:1).
- `landing/index.html` at `/landing`: bilingual product page, dual-screen hero, product shelf.
- Root duplicates: 38 serverless handlers that also lived in `api/` were deleted (one was stale). Only
  `api/**` deploys as functions.

## Conventions
- Reply to owner in Thai (he writes Thai/English mix), keep technical terms in English.
- Ship = rebuild (`bash pos/build.sh`) + Playwright zero-error sweep on pos/testrun/test2.html + commit `index.html`.
- Built artifacts `pos/app.compiled.js` and `pos/testrun/test2.html` are generated — don't commit them.
- Never commit secrets. StoreHub token, STAFF_KEY, XAI_API_KEY and all staff PINs live only in Vercel
  env vars — see `.env.example` for the full list. API tests live in `api/__tests__/*.test.mjs`
  (`node api/__tests__/<name>.test.mjs`); they mock upstream so they cost nothing to run.
