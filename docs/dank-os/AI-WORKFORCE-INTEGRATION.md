# DANK OS — AI Workforce integration (foundation v0.1)

Status: design + integration contracts only; no production automations enabled.

## Existing POS integration
- Preserve existing StoreHub connector and POS sales flows.
- Add a read-only adapter that normalizes StoreHub/GreenPOS imports to canonical events.
- Never assume upstream API supports writes. Prefer authorized CSV import if API unavailable.
- Keep medical/PT.33 records segregated from CRM/marketing datasets.

## Canonical event envelope
```json
{
  "event_id":"uuid",
  "event_type":"shift.closed",
  "schema_version":1,
  "organization_id":"uuid",
  "branch_id":"uuid",
  "occurred_at":"ISO-8601",
  "source":"pos",
  "source_record_id":"external-id",
  "idempotency_key":"source:event:external-id",
  "payload":{}
}
```

## Initial workflows
1. shift.closed -> validate completeness -> compare POS totals and counted cash -> open incident or mark checked -> manager review.
2. stock.updated -> compute days of cover -> create purchase_request draft -> manager approval -> supplier handoff only after compliance verification.
3. attendance.finalized -> calculate payroll draft with immutable formula_version -> finance review -> independent human approval.

## Security contract
- All agents are service identities with least privilege and no final approval privileges.
- Enforce organization/branch isolation in PostgreSQL RLS.
- Persist append-only audit events for all sensitive actions.
- Approval gates for payments, payroll, inventory adjustment, purchasing, price changes, HR decisions, medical documents and production deployment.
- Retry with backoff; dead-letter queue; idempotency keys; emergency automation kill switch.
- Do not expose secrets or customer/patient personal data in agent prompts/logs.

## Proposed schema (migration pending review)
organizations, branches, agent_definitions, agent_runs, workflow_definitions,
workflow_executions, tasks, approvals, audit_logs, integration_connections,
shift_reports, incidents, inventory_items, stock_movements, purchase_requests,
attendance_records, kpi_formula_versions, kpi_scores, payroll_drafts,
customer_tickets, notifications.

Common transaction fields: id, organization_id, branch_id (nullable when global),
created_at, updated_at, created_by, status.

## Implementation order
1. Audit existing POS endpoints, deployment and data sources.
2. Add migrations + RLS tests + service-account access.
3. Build event ingestion with schema validation, deduplication and dead-letter handling.
4. Implement read-only shift-closing reconciliation and incident queue.
5. Add CEO review dashboard and approval workflow.
6. Pilot at Phatthanakarn, verify against real POS reports, then expand.

## Acceptance criteria before enabling production
- No change to checkout or current StoreHub sync behavior.
- Every incident has source evidence, timestamp, branch, owner and state.
- Duplicate event delivery cannot duplicate a financial or inventory action.
- Cross-branch access tests fail for unauthorized roles.
- Agents cannot self-approve.
- All discrepancies require human review until reconciliation is validated.
