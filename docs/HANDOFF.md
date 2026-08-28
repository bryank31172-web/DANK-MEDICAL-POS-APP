# HANDOFF — 27 Aug 2026

State of the branch, for whoever picks this up next. `CLAUDE.md` is still the
project brain; this file is only the part that is *in flight*.

## Where the code is

| | |
|---|---|
| Branch | `claude/new-session-e3xooj` — **4 commits ahead of `origin/main`, no PR open** |
| Head | `fc5e8d4` Print the September pack the shop actually uses |
| Working tree | clean, pushed |
| Live | https://dank-medical-pos-app.vercel.app (deploys from root `index.html`) |

Nothing here is merged yet. Either open a PR from that branch or keep committing to it.

## Build and test, exactly

```bash
bash pos/build.sh                       # JSX -> pos/index.html -> ROOT index.html (the file that deploys)
(setsid python3 -m http.server 8799 &)  # from the REPO ROOT — every browser test needs this
node pos/__tests__/roster.test.cjs      # 132 assertions, pure node, no server needed
node pos/__tests__/workshifts.test.mjs  # browser, drives the tab the way a manager does
```

Both are green at `fc5e8d4`.

**`pos/__tests__/vital-signs.test.mjs` is red and it is not from this work.** It came in
with PR #69 (patient vital signs) and fails on clean `main` the same way: line 41,
`page.locator('button').filter({hasText:'💾'}).click()` times out. Left alone deliberately
— fixing somebody else's test inside a roster branch would hide it. It is worth fixing,
just not in this branch.

Editing `pos/app.fixed.jsx`: the file has ~1.5MB lines that choke the Read tool. Use
`grep -n`, `sed -n 'X,Yp'`, and exact-string find/replace with `assert count == 1`.

## The Working Shifts tab — where everything lives

All in `pos/app.fixed.jsx`. Module-level functions sit between sentinel comments so the
`.cjs` test can lift them out with `new Function(body)` — **keep the sentinels intact**.

| Line | What |
|---|---|
| 173–668 | `// ——— working shifts block` … engine: `shiftHours`, `shiftSpan`, `monthDates`, `slotRunsOn`, `rosterEligible`, `rosterPick`, `rosterPay`, `rosterVisits`, `buildRoster` (392), `rosterPayroll` (641) |
| 670–799 | `// ——— roster assistant block` … `rosterAskDate`, `rosterAsk` (695) — answers with no AI key |
| 804 | `SHIFT_LOCATIONS` — 3 shops and their slots |
| 826 / 833 | `SHIFT_INCENTIVES` / `SHIFT_COVERAGE_RULES` — printed verbatim on the validation page |
| 842 | `SHIFT_STAFF` — 15 payroll + 2 CEO, from the shop's own wage sheet |
| 2263 | `shiftPrint()` — the whole printed pack |
| 5770 | tab registration `{id:"workshifts"}` |
| 8478+ | the tab itself; 8532 print button, 8616 payroll rollup, 8784 assistant, 8813 staff editor |

Runtime state lives in localStorage: `dank_shift_staff`, `dank_shift_locs`, `dank_shift_roster`.
The seeds above only apply on first run.

## What was just finished

The printed pack is now **`locs.length + 2` pages**, matching the shop's own September sheet:

1–3. one A3-landscape timetable per shop (unchanged)
4. **DANK GROUP STAFF & PAYROLL SUMMARY** — every person across every shop:
   STAFF | TYPE | ASSIGNMENT | DUTIES | HOURS | BASE PAY | VARIABLE PAY, under one control total
5. **DANK PROJECT DUTIES & FINAL VALIDATION** — project/content duty calendar, coverage rules,
   incentive rules, six validation counters, and the uncovered-shift table

Three rules in there are load-bearing. Each one was a defect found by rendering the page and
reading it, so please do not "simplify" them away:

- **Variable pay prints as the rule, never as a figure.** 2% of eligible sales is unknowable
  until month end; a number in that column reads as money owed.
- **`payrollOnly` staff print their contracted days in amber, not 0.** The riders (Zaw, Got)
  stand no counter slot, so the grid has 0 shifts for them — but they cost ~15,600/month each.
  `0 duties` beside that money reads as pay for nothing, and it dropped 52 days out of the
  control total. `contracted` in `payRows` is what does this.
- **Every empty shift is named.** A red "21 empty shifts" with nothing beside it is a number
  nobody can act on. The pack groups holes by slot with their dates and the first blocker
  (`Honey: rest day SAT (movable)`, `Pond: already on a shift today`).

The browser test **stubs `window.open` and reads the printed HTML back**, so the pack is
checked rather than trusted — page count, control total is real money and not NaN, the rider
is not 0 duties, every hole is named. If you change `shiftPrint`, those assertions are the
contract.

## Open question the owner has not answered

The September PDF he uploaded (`13768710-DANKAllShopsTimetableSeptember2026withWages.pdf`)
lists **Rena, Palm, Bank, and Alex-at-the-bar** — people he had previously confirmed, name by
name, had left. I read "template" as meaning the *page format*, not the staff list, and kept
the confirmed roster. **He has not confirmed that reading.** If September genuinely reinstates
those four, `SHIFT_STAFF` at line 842 needs them back and the coverage numbers below change.

## Scheduling state, so you don't re-derive it

Demand is **343 shifts a month**; thirteen counter staff at 26 each supply ~327.

The owner's flexibility answers (anyone will move their day off and their hours; part-timers
move between Phatthanakarn and Sathorn; Honey works all three businesses) took uncovered
shifts from **74 to 16**, spread evenly across `ptk/B2`, `ptk/C1`, `bar/FSDAY`, `bar/FSNIGHT`.

That last 16 is a **headcount gap, not a scheduling bug** — measured: clearing everyone for
everything only gets it to 63 from 74; removing every day off still leaves 20.

**Mel is the nearest lever** — Sathorn-only relief at 18 shifts with ~8 spare; clearing her for
Phatthanakarn absorbs about half. **Do not widen her without asking.** She is full-time relief,
not one of the part-timers the owner explicitly cleared to move between shops.

## Owner's to-do list — none of it is code

Full text in `CLAUDE.md` under "Pending"; the owner-facing deck with screenshots of every
in-app step is `docs/ClinicWorks-What-Is-Left.pptx` / `.pdf`, generated by
`docs/build-what-is-left.cjs` (screenshots by `docs/deck-shots/capture.mjs`).

1. **`MASTER_PIN` in Vercel** — the one blocker. 110114 is public and burned. Until it is set
   the claim-PIN break-glass stays open by design.
2. `XAI_API_KEY` + `GROK_MODEL=grok-4` — adds free-text answers only; lookups already work.
3. Attach the Upstash Redis to `dank-medical-pos-app` (it is on `dankbkk-site` only).
4. Add the two `UPSTASH_REDIS_REST_*` names by hand on `dankbkk-site`.
5. `STOREHUB_PUSH_ORDERS=1` on `dankbkk-site` — without it every web order silently skips the
   stock cut.
6. **Real costs in StoreHub**, best sellers first — highest-value item on the list, and it is
   data entry. Worksheet: `docs/sku-summary.pdf`.
7. Petchaboon/Phuket fixed-cost budgets (Finance → 💸 → ✏ แก้งบ).
8. Product images — `docs/botanical-legends-prompts.pdf`, **variant B** (1:1, no lettering).
9. Delete duplicate Vercel project `dankbkk-site-4jrn` — safety check done, only the click left.
10. Decide the fate of the root customer-site HTML pages.
11. Decide the customer site's menu source (53-item curated vs 395-item POS feed).
12. The 16 uncovered shifts / the Mel decision above.

## Never

The repo is **public**. StoreHub credentials, `STAFF_KEY`, `XAI_API_KEY`, `MASTER_PIN` and all
staff PINs live only in Vercel env vars — see `.env.example`. The `110114` in
`pos/testrun/head17.txt` is seeded for the offline harness and is not in the shipped bundle.

`pos/app.compiled.js` and `pos/testrun/test2.html` are build output — do not commit them.
Root `index.html` **is** committed; that is what Vercel deploys.
