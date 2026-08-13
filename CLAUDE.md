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
1. **Set `MASTER_PIN` in Vercel (new number — 110114 is public and burned), then Redeploy.**
   Still the one blocker: nobody can log in without it, and until it is set the claim-PIN
   break-glass stays open by design. `XAI_API_KEY` in the same visit makes the 🤖 free-text
   answers work (the built-in manual already works without it). `STAFF_PINS` optional.
2. **Connect the Upstash Redis to `dank-medical-pos-app` too.** It is attached to
   `dankbkk-site` only. `/api/staff-auth`, `/api/grok` and `/api/storehub/*` all rate-limit
   through it; without it the counters live in per-instance memory, so PIN guessing can be
   spread across instances. The code accepts either `UPSTASH_REDIS_REST_*` or Vercel's
   `KV_REST_API_*`.
3. **`dankbkk-site` needs the two `UPSTASH_REDIS_REST_*` names added by hand** (copy the
   values from its `KV_REST_API_*`). That repo is private and separate, so the name fix in
   `api/_store.js` here does not reach it.
4. **Generate the 52 product photos** — `docs/product-image-prompts.pdf` / `.txt`. The till
   already pulls photos from `products.json` by name, so adding them there lights up both
   the POS and the website at once.
5. Petchaboon/Phuket fixed-cost budgets are 0 — owner sets them in-app (Finance → 💸 → ✏ แก้งบ).
6. Delete the duplicate Vercel project `dankbkk-site-4jrn` once the live domain is confirmed
   to point at `dankbkk-site` — otherwise every env var has to be set twice, forever.
7. Root HTML pages that belong to the customer site — `staff.html`, `build-your-joint.html`,
   `labels.html`, `status.html`, `SUMMARY.html`, plus the `i18n.js` all four load. Awaiting
   the owner's word on which are still in daily use before removing.
8. Decide the customer site's menu source: the curated 53-item `products.json` (clean names +
   photos) vs the raw 395-item POS feed it serves today (`( Bar ) Tequila shot`).

## Done and verified — do not re-litigate
- **StoreHub is connected** (396 products, Pattanakarn 373 / Sathorn 373 / Bars 23).
- Claim-PIN hole closed: a claim now needs a manager or owner PIN checked by `/api/staff-auth`,
  fails closed offline, and the break-glass shuts itself the moment `MASTER_PIN` exists.
- Menu feed was quoting every price 7% under the counter — StoreHub stores `unitPrice`
  ex-VAT; `withVat()` adds it back and rounds, matching what the POS has always done.
- `_store.js` accepts Vercel's `KV_*` env names, so an attached Redis is actually used.
- Bill list: real customer name resolved across every id shape (StoreHub id, refId, `sh-`
  prefix, phone, email); no customer now reads `none`. A comped bill totals 0, not −748.
- CRM spend/visits counted from synced sales (points/balance deliberately left alone —
  StoreHub does not expose loyalty balances, so they are entered once via Edit).
- Shift open/close each start on a 7-step checklist with how-to text; every item must be
  ticked and completion writes `SHIFT_TASKS_IN`/`_OUT` to the audit log.
- Bar tab: 14 recipes as pour-along checklists, per-drink cost, bottle ฿/ml. The paper sheet
  totals Manhattan at 178; its ingredients are 163 (two Matcha Forest rows bled in) — the app
  uses 163 and says so.
- Till shows the website's product photos, matched by a normalised name; a failed photo falls
  back to the item's category emoji.
- Over-count is a mismatch, not OK. Scale prints exactly (0.039 stays 0.039).
- `inkOn()` in the token layer keeps light text off light fills — found two real contrast bugs
  by measuring every tab, including product names at 1.05:1.
- 38 duplicated serverless handlers deleted from the repo root; only `api/**` deploys.
- `landing/index.html` at `/landing`; CDS at `?cds=1`; SOP deck at `docs/`.

## Conventions
- Reply to owner in Thai (he writes Thai/English mix), keep technical terms in English.
- Ship = rebuild (`bash pos/build.sh`) + Playwright zero-error sweep on pos/testrun/test2.html + commit `index.html`.
- Built artifacts `pos/app.compiled.js` and `pos/testrun/test2.html` are generated — don't commit them.
- Never commit secrets. StoreHub token, STAFF_KEY, XAI_API_KEY and all staff PINs live only in Vercel
  env vars — see `.env.example` for the full list. API tests live in `api/__tests__/*.test.mjs`
  (`node api/__tests__/<name>.test.mjs`); they mock upstream so they cost nothing to run.
