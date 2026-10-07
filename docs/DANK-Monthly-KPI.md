# DANK Monthly KPI & Commission

Open **พนักงาน / Staff → KPI**. Select a Bangkok calendar month.

| KPI | Points | Calculation |
|---|---:|---|
| Individual sales | 30 | Net attributed sales / monthly sales target, capped at 30 |
| Upselling | 15 | Completed bills with remaining value ≥ ฿1,000 / monthly bill target |
| CRM + Google Maps Reviews | 10 | Verified new CRM records (5) + verified reviews (5), each against its target |
| Customer compliments | 10 | Verified customer recommendations / monthly target |
| Correct open & close | 10 | Complete documented shifts / elapsed approved roster shifts |
| Punctuality | 25 | On-time arrivals and full scheduled duration / elapsed approved roster shifts |

A ≥ 90 → 3%; B ≥ 80 → 2%; C ≥ 70 → 1%; D < 70 → 0% and a warning flag.
Grades use the unrounded score. Commission uses net individual sales, never the
staff lifetime sales counter. Top two positive net sellers across all shops get
฿1,500 each regardless of KPI grade. Exact ties use ascending staff ID, giving
exactly two awards. Variable pay = commission + Top 2 bonus; base wages, OT and
explicit bar service-charge shares remain separate.

## ก่อนปิดกะ / Before closing a shift

For **CRM** and **Google Maps Reviews**, staff must independently:

- Upload JPG/PNG/WebP screenshots (up to four per category, max 10 MB input each), or
- Click **ไม่มี / None**.

An empty choice blocks closing. Removing the last proof makes the choice required
again. None is recorded with the shift and earns no evidence credit. Uploaded
proof is attached to that employee and the shift's Bangkok start month, remains
pending, and counts only after manager verification in Staff → KPI. One verified
image counts as one record; duplicate identical images count once per type. This
is evidence review, not OCR, automatic CRM validation or Google verification.
Upload a separate identifiable record for each claim. Managers should check the
CRM customer, review URL or receipt and attribution against the uploaded image.

## ตั้งค่า / Setup and monthly review

1. Map POS staff to StoreHub employee IDs and approved roster staff IDs.
2. Set each eligible employee's monthly sales, qualifying-bill, CRM, review and
   compliment targets. No target is silently invented.
3. Refresh sales. The request loads the selected month plus two prior months,
   covering receipts needed to link refunds. Voids/cancellations are excluded;
   refund totals are deducted. Refunds without a valid original receipt link
   leave the affected employee Pending; fill in the original receipt ID.
4. Use an approved roster, not a draft. Overnight shifts belong to their start
   date. Arriving over 15 minutes late or leaving before the scheduled end fails
   that shift's punctuality. Arrival is captured before the opening checklist;
   old shifts fall back to their recorded clock-in time.
5. For open/close credit, both completion flags, exact opening/closing stock
   counts, cash entry, outgoing signature and stock proof are required. Legacy
   shifts without recorded completion flags do not receive automatic credit.
6. Verify CRM/review/compliment evidence. Compliments need a receipt/customer
   reference and the customer's comment. Submissions are pending until checked.
7. On each branch tablet, **Export branch** for the month. On the review tablet,
   **Import branch** for each package, verify the imported proof, then confirm
   complete data. IDs are merged to prevent repeated imports duplicating records;
   Check all seller/roster mappings. Missing targets, schedules or mappings hold
   approval rather than generating a misleading D grade.
8. After the month has ended, enter a review note and approve the report.
   Export CSV for payroll. Approvals include who, when, note and calculation
   snapshot. Any relevant source change invalidates the approval. Roster payout
   reports use only a valid approved KPI snapshot, including the Top 2 bonus.

## Operational limits

This change follows the POS's existing device-local storage for staff, roster,
shift records and evidence. StoreHub sales are fetched across shops. The existing
cloud mirror is best effort and has no sync-down path; it is not a shared payroll
ledger. Use Export branch / Import branch to collect the complete branch records before confirming coverage.
Do not assume an upload on one tablet automatically appears on another tablet.
Keep backups; a full browser storage quota blocks proof-backed closing rather
than claiming the proof saved. Commission approval is a local manager payroll
review, not a bank transfer or a server-enforced payroll authorization.

Targets, employee mappings and verification are management setup. Live shop
hardware, actual StoreHub employee/refund shapes and multiple branch devices
still need operational acceptance before using this for real payouts.

## Validation

`npm run pos:build`, `npm test`, and `npm run test:browser`.
The offline harness uses synthetic data only. `monthly-kpi.test.cjs` tests
calculation boundaries, net refunds, deduplication, attendance, readiness,
evidence and proof selection; `monthly-kpi.test.mjs` exercises the dashboard,
manager approval, invalidation, exports, upload/None and close-shift persistence.
