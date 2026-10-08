# DANK BKK — BRYAN POS (project brain)

Owner: Bryan · Dank Cannabis Clinic Bangkok (Pattanakarn, Sathorn, Petchaboon, Phuket, Bars)

## The two products (NEVER mix them up)
1. **BRYAN POS** — THIS repo (github.com/bryank31172-web/dank-medical-pos-app, public).
   Live: https://dank-medical-pos-app.vercel.app · deploy = commit `index.html` to repo root, Vercel auto-deploys.
2. **Customer website** — dankbkk-site repo (PRIVATE, separate; owner uploads via GitHub web UI).
   Live: **www.dankbangkok.com** (Vercel project `dankbkk-site`, also at dankbkk-site.vercel.app)
   · static html + /api serverless functions.

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
- Medical → Vital Signs stores confirmed temperature/weight/height/BMI per
  selected CRM patient in `dank_vital_signs` and audits every save. The patient
  scale has its own Web Serial connection (never reuse the per-gram inventory
  scale). BLE/vendor-SDK readings enter through the local Node gateway in
  `clinic-device-bridge/`, default `http://127.0.0.1:17891`; manual entry remains
  the fallback.

## Customer website notes (dankbkk-site — NOT this repo)
- Fixed index.html (cart NaN + Add-button crash for 6 tier-only/no-tier products; hardening in
  addToCart/quickAdd/addFromPD/repriceCart) may not be live yet — verify by: open site → Edibles →
  "Sour Belts 3000mg" → Add+ → cart must show ฿300, not ฿NaN.
- Menu source chain (api/_menu.js): MENU_FEED_URL → BRYAN POS feed → StoreHub → bundled products.json.
  Known pending: add Vercel env `POS_FEED_PATHS=/__no_pos_feed__` on dankbkk-site to prefer StoreHub
  (health endpoint currently reports source:"pos").

## Website order → stock (dankbangkok.com → POS)
- `/api/order` stores the order, books it in StoreHub (**that is what cuts stock**), alerts
  LINE, forwards to `ORDER_FORWARD_URL`, emails. The order record now carries
  `stock:{status:"cut"|"skipped"|"failed", reason, needsManualCount[]}` and the LINE alert
  says which — a skip used to be silent, so the site kept selling stock the shop had sold.
- **The cut needs `STOREHUB_PUSH_ORDERS=1` in Vercel.** Without it every order is
  `skipped: "STOREHUB_PUSH_ORDERS is not 1"` and no stock moves. This is an env setting,
  not code.
- Stock is booked per line against `item.shId`. The feed normalisers in `pos-feed.js` and
  `_menu.js` were dropping it, so every online order arrived with nothing to book against.
  A line with no `shId` still lands in `needsManualCount` for staff to deduct by hand.

## Pending — in the order they should be done
> The owner-facing version of this list, with real screenshots of every in-app step, is
> `docs/ClinicWorks-What-Is-Left.pptx` (and `.pdf`) — Thai first, English under it. It is
> generated by `docs/build-what-is-left.cjs`; the numbering below matches its slides.
> Two steps cannot be photographed and are written out instead: everything on the Vercel
> settings page (no network from the build container) and the `✏ แก้งบ` editor's own
> gate, which only renders for a Master/CEO login.

1. **Set `MASTER_PIN` in Vercel (new number — 110114 is public and burned), then Redeploy.**
   Still the one blocker: nobody can log in without it, and until it is set the claim-PIN
   break-glass stays open by design. `STAFF_PINS` optional.
2. **`XAI_API_KEY` (+ `GROK_MODEL=grok-4`)** — same visit as ①. It only adds free-text
   answers; product lookups, the 14 bar recipes and the built-in manual already work
   without any key.
3. **Connect the Upstash Redis to `dank-medical-pos-app` too.** It is attached to
   `dankbkk-site` only. `/api/staff-auth`, `/api/grok` and `/api/storehub/*` all rate-limit
   through it; without it the counters live in per-instance memory, so PIN guessing can be
   spread across instances. The code accepts either `UPSTASH_REDIS_REST_*` or Vercel's
   `KV_REST_API_*`.
4. **`dankbkk-site` needs the two `UPSTASH_REDIS_REST_*` names added by hand** (copy the
   values from its `KV_REST_API_*`). That repo is private and separate, so the name fix in
   `api/_store.js` here does not reach it.
5. **Set `STOREHUB_PUSH_ORDERS=1` on `dankbkk-site`.** The order code is done and tested;
   without the variable every website order records `stock:{status:"skipped"}` and the shop
   keeps selling what the site already sold. One setting, not a code change.
6. **Enter the real costs in StoreHub, best sellers first.** The app now reports what share
   of revenue rests on real costs rather than estimates — every margin, the net profit and
   any pricing decision is only as good as that number. `docs/sku-summary.pdf` is the
   worksheet; the in-app export's `no-cost` flag names the rows still missing one. This is
   the highest-value item on the list and it is data entry, not development.
7. Petchaboon/Phuket fixed-cost budgets are 0 — owner sets them in-app (Finance → 💸 → ✏ แก้งบ).
8. **Generate the product images** — `docs/botanical-legends-prompts.pdf` / `.txt` (41 items,
   the shop's own BOTANICAL LEGENDS card style; the older photographic set is still in
   `docs/product-image-prompts.*`). Use **variant B** (1:1, no lettering) for the app and the
   website — the POS draws the name and price over the tile, so a card with baked-in text
   double-prints. Variant A (3:2, with text) is for IG and menu boards. The till pulls photos
   from `products.json` by name, so adding them there lights up POS and website at once.
9. **Delete the duplicate Vercel project `dankbkk-site-4jrn` — the safety check is done, only
   the click is left.** Read off the Vercel API on 25 Aug 2026, team `bryank31172-7357s-projects`:
   `dankbkk-site` (`prj_VK2M4ZRH…`) holds **dankbangkok.com and www.dankbangkok.com** — that is
   the live one, keep it. `dankbkk-site-4jrn` (`prj_0nGkDgXV…`) holds **no custom domain at all**,
   only its own auto-generated `*.vercel.app` preview URLs, and nothing in either repo references
   it. Both are wired to the same GitHub repo `bryank31172-web/dankbkk-site`, so every push builds
   twice (their last two production deploys started 28 ms apart) and every env var has to be set
   twice, forever. Vercel → `dankbkk-site-4jrn` → Settings → scroll to the bottom → Delete Project.
   *The Vercel connector available here can list and read projects but has no delete; pausing it
   as a stopgap returned 400. This is a click the owner has to make.*
10. Root HTML pages that belong to the customer site — `staff.html`, `build-your-joint.html`,
   `labels.html`, `status.html`, `SUMMARY.html`, plus the `i18n.js` all four load. Awaiting
   the owner's word on which are still in daily use before removing.
11. Decide the customer site's menu source: the curated 53-item `products.json` (clean names +
   photos) vs the raw 395-item POS feed it serves today (`( Bar ) Tequila shot`).

## Done and verified — do not re-litigate
- **Customers who owe the shop is a finished feature, not a missing one**: on-account sales
  with a per-customer credit limit that blocks the sale, balance netted against recorded
  payments, days outstanding, over-limit badge and LINE alert. It lives in the Finance tab
  and a Dashboard card now points at it — it was asked for twice because nobody could find it.
- SKU margin: `skuMarginRows()` feeds both the on-screen table and the CSV, covers every SKU
  rather than only what sold, and never reports 100% margin for a product with no cost.
- Dashboard periods step backwards with ◀ ▶; the KPI subtitles print the date being viewed.
- The assistant answers a named product or cocktail from app state without needing an AI key.
- Work board has a manager view: who is overloaded, who delivers on time (`teamWorkload()`).
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
  back to the item's category emoji. `api/_photos.js` applies the same map to every menu read
  in `_menu.js`, so the picture no longer depends on which upstream answered — its
  normalisation is a deliberate copy of `webKey()`/`webImgFor()` in the JSX — exact key
  first, then the longest catalogue name contained in the till name. Leaving that second
  step off the server was itself the mismatch. `photo-match.test.mjs` runs both
  implementations over 430 real name shapes and fails if they ever disagree.
- Over-count is a mismatch, not OK. Scale prints exactly (0.039 stays 0.039).
- `inkOn()` in the token layer keeps light text off light fills — found two real contrast bugs
  by measuring every tab, including product names at 1.05:1.
- 38 duplicated serverless handlers deleted from the repo root; only `api/**` deploys.
- `landing/index.html` at `/landing`; CDS at `?cds=1`; SOP deck at `docs/`.

## Working Shifts tab (กะทำงาน · `workshifts`)
- Replaces the hand-built spreadsheet roster. `buildRoster(locations, staff, year, month)`
  fills the month and returns the grid, per-person totals **and** the validation report —
  the report is not a separate step you can forget to run.
- Shops/slots/staff seed from the September 2026 sheet (`SHIFT_LOCATIONS` / `SHIFT_STAFF`),
  then live in localStorage (`dank_shift_staff`, `dank_shift_locs`, `dank_shift_roster`).
- **A draft is never saved.** ⚙ สร้างร่าง shows totals + conflicts; only ✅ อนุมัติ writes it
  and logs `SHIFT_ROSTER_APPROVED` to the audit log. The owner asked for that explicitly.
- Rules that are load-bearing, each one a bug that was found by measuring:
  · overnight shift = one shift on the day it **starts**
  · a duty inside a normal shift (Rena's Fri marketing) is recorded but adds **no** shift and
    **no** hours — counting it twice turns a 26-shift month into 31
  · nobody is rostered outside their authorised shop/slot even if that leaves a hole; the hole
    is reported instead
  · **required slots are filled before optional ones, across the whole month** — filling Sunday
    stock/admin in date order spent Mon's 26-shift cap and left a required night uncovered
  · **a flexible day off is still a day off, and a staggered one.** Everyone is willing to move
    their day; with only a run limit the whole shop marched six days from the 1st and hit the
    wall together on the 7th, 14th, 21st and 28th. Anyone with no `off` is dealt a weekday,
    spread across the team in list order, and capped at `maxRun` (6) consecutive days.
  · **scarcity is measured across the whole group, not per shop.** Filling shop by shop left the
    bar last, so Honey — the only person cleared for its Fri-Sun day shift — was spent on
    Phatthanakarn slots three others could stand, and 12 of 13 bar days sat empty.
  · **the scarcest slot is filled first** — one reliever can only be in one place, and filling in
    printed order gave Steve to 09:00-18:00 (which Honey also covers) every day while 17:00-02:00,
    which nobody else is cleared for, sat empty 30 days out of 30
  · **relief never outranks the slot's regular** — ranking Mel by "first authorised slot" put her
    on Raizo's early shift and left Sathorn's day shift empty
  · a split night (`cell.extra[]`) lets two part-windows tile one slot: Keneth 17:00-21:00 hands
    over to Bryan 21:00-02:00. The head of a split must be the window that starts at the slot start.
- Owner's rules, in the seed: Bank 4 at Phatthanakarn **and** 4 at Sathorn (`locMax`, two limits
  not one of eight) · **Bryan and Keneth are CEOs (`kind:"ceo"`) who check in once a week — they
  fill no slot at all.** `rosterVisits()` puts one visit per calendar week on the sheet's own
  CEO row and in `result.visits`; hours land in `visitHours`, never in shift hours or the shop
  labour total. Modelling them as cover hid the fact that the Phatthanakarn night shift was
  three shifts short of staff cleared to stand it.
- **September 2026 is fixed to the owner-approved Base Coverage V8 roster:** 342 duties across
  Phatthanakarn, Sathorn Rama 3 and 224 Bar, with every required cell filled. The six same-day
  conflicts in the photographed draft were resolved with minimum-change swaps: one person may
  hold only one shift per calendar day across the whole group. The published roster preserves
  the approved per-person duty and roster-hour totals, Ploy's integrated 10 September content
  duty, and a maximum run of six working days. September deliberately outranks an older generated
  September copy in localStorage; other months still use the normal availability generator.
- An empty required shift carries `blockers[]` — the trained staff who were rejected and why
  ("Mon: at their maximum", "Honey: already working today"). Listing everyone at the shop instead
  buried that under four lines of "not authorised on C2" for people who were never candidates.
- **Two contract types, from the shop's own wage sheet.** `payType:"monthly"` is owed the salary
  for the month; `payType:"daily"` (วันละ) is owed `dailyRate × days actually stood`. Paying a
  daily person a flat month overpays a short month and underpays a long one.
- Hourly = salary ÷ (target × **that person's** shift length) for monthly, or `dailyRate ÷ shift
  length` for daily — a 9h and an 8h shift never share a divisor. OT = hours past that normal
  month at **1.5×**, on both contract types.
- Kitchen / riders / back-office carry `payrollOnly:true`: no counter slot, but costed at their
  contracted `target` days. A day-rate rider costed at zero days takes ~฿18k/month straight out
  of the wage line with nothing on screen to show it.
- `rosterPayroll()` rolls the bill up and reconciles it against `expenseTargets.byCategory.wages`,
  and names both drifts: on payroll with no shift, and on shift with no wage on file. Those are
  different problems with different fixes, so "basePay is 0" must not be read as either.
- Who may work what is a **toggle grid** in `👤 ตั้งค่าคน + เงินเดือน`, not a comma-separated text
  field — the field existed from the start and nobody would ever have typed `A1,C1` into it.
- 🤖 ถาม AI answers from the grid with no API key (`rosterAsk`): who is on a date, who can cover,
  the labour bill, OT, who is over/under, one person by name. Returns null rather than guessing.
- 🖨 prints white A3-landscape sheets — one page per shop, signature block on every page, colours
  for management/relief/marketing. Save-as-PDF in that window is the combined PDF.
- Tests: `pos/__tests__/roster.test.cjs` (107) + `pos/__tests__/workshifts.test.mjs` (browser).

## Conventions
- Reply to owner in Thai (he writes Thai/English mix), keep technical terms in English.
- Ship = rebuild (`bash pos/build.sh`) + Playwright zero-error sweep on pos/testrun/test2.html + commit `index.html`.
- Built artifacts `pos/app.compiled.js` and `pos/testrun/test2.html` are generated — don't commit them.
- Never commit secrets. StoreHub token, STAFF_KEY, XAI_API_KEY and all staff PINs live only in Vercel
  env vars — see `.env.example` for the full list. API tests live in `api/__tests__/*.test.mjs`
  (`node api/__tests__/<name>.test.mjs`); they mock upstream so they cost nothing to run.
