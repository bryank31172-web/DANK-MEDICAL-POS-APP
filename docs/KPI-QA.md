# Monthly KPI change verification

Scope: monthly KPI grades and sales commissions; Top 2 bonus; payroll report
integration; customer evidence review; CRM/review proof or explicit None required
before shift closing; branch evidence collection.

- Production bundle rebuilt from JSX plus the independent calculation module.
- `npm test`: all API, POS static/calculation and device bridge tests passed.
- KPI engine: 33 behavioral checks passed, including exact grade boundaries,
  Bangkok dates, refunds, original receipt links, duplicates, attendance,
  evidence verification, required proof selection and branch package merging.
- KPI browser flow: 21 checks passed at desktop and 390 px mobile, with zero
  page errors. Exercised approval, stale approvals, CSV downloads, targets,
  evidence submission/verification/unverification, source retry, branch
  export/import/error states, mandatory shift proof/None, removal, persistence
  after refresh and manager image viewing.
- Existing shift checklist browser flow: passed with zero page errors.
- Existing tabbar browser checks passed with zero page errors.
- UX audit before/after: horizontal overflow false → false; small existing tap
  targets 35 → 35; small existing text 65 → 65. New KPI controls use at least
  44 px heights; the KPI mobile dialog also passed its own overflow check.
- `git diff --check`: passed.

## Broader checks that remain unresolved

The complete browser test command does not pass. This branch remains a draft:

1. `claim-pin.test.mjs`: six failed expectations with no page errors. Reproduced
   the same six failures against the unchanged origin/main harness.
2. `crm-stats.test.mjs`: its extracted standalone function does not supply
   `txMatchKeys`, raising a ReferenceError. The CRM helper/statistics code is
   unchanged by this feature.
3. `vital-signs.test.mjs`: saving the test patient history remains disabled and
   the test times out. No vital-signs implementation was changed. This was not
   independently reproduced on main and remains an unresolved broader check.

Live shop tablets, real StoreHub seller/refund shapes and full branch data were
not used in the synthetic tests. Set actual monthly targets and verify seller
and roster mappings before operational use. Shift/proof storage remains
browser-local; branch packages provide manual consolidation, not automatic
multi-device synchronization. Approvals record manager review and never send
money or assert server-enforced payroll authority.

## September provisional pass follow-up

Owner instruction: unavailable September KPI values pass provisionally. Implemented as a September-only, manager-toggleable policy with component assumptions on cards/CSV and in the approval fingerprint. Known attainment, late/checklist failures and explicit None retain actual scoring; missing shift records receive provisional credit without falsifying shift counts. Sales/refund/mapping issues still block payout.

Validation: 40 calculation tests; 28 browser checks covering toggle persistence, CSV assumptions, desktop/mobile, unchanged mandatory closing proof and October strict behavior; zero browser page errors. UX audit: no horizontal overflow, 35 small targets and 65 tiny-text elements (same as prior release). npm test passed; production artifact rebuilt. The previously documented broader browser-suite limitations remain.
