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

## Pending
1. ~~Upload `api/storehub/[...path].mjs` /sold endpoint~~ — DONE, committed.
2. Confirm fixed index.html (NaN fix) is live on dankbkk-site (manual check per above).
3. Optional env: POS_FEED_PATHS on dankbkk-site (above).
4. Petchaboon/Phuket fixed-cost budgets = 0; owner can set in-app (Finance → 💸 → ✏ แก้งบ).
5. ~~Master PIN hard-coded in the client bundle~~ — DONE. The roster ships with no PINs; logins fall
   back to `/api/staff-auth` (env `MASTER_PIN` / `STAFF_PINS`, fails closed). Owner must set those
   env vars and pick new PINs — the old ones were public and must be treated as burned.

## Conventions
- Reply to owner in Thai (he writes Thai/English mix), keep technical terms in English.
- Ship = rebuild (`bash pos/build.sh`) + Playwright zero-error sweep on pos/testrun/test2.html + commit `index.html`.
- Built artifacts `pos/app.compiled.js` and `pos/testrun/test2.html` are generated — don't commit them.
- Never commit secrets. StoreHub token, STAFF_KEY, XAI_API_KEY and all staff PINs live only in Vercel
  env vars — see `.env.example` for the full list. API tests live in `api/__tests__/*.test.mjs`
  (`node api/__tests__/<name>.test.mjs`); they mock upstream so they cost nothing to run.
