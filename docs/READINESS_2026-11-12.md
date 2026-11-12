# Business readiness checkpoint — 2026-11-12

> Cập nhật mới nhất cùng ngày: năm phần OTP/MFA, refund, grace, notification và production đã được bổ sung ở mức mã nguồn. Xem [COMPLETION_API_2026-11-12.md](COMPLETION_API_2026-11-12.md) và [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md). Các mục tồn đọng/lần kiểm thử bên dưới là lịch sử; không chứng minh thay đổi mới đã được chạy. Chưa build/test/migrate/deploy trong đợt này.

Status: NOT approved for production deployment. Container health and passing tests do not establish full product acceptance.

## Superseding static changes (same date)

A later source-only SRS/Baseline review changed pricing, search, operational slots, staff shifts, scoped roster, reporting and Manager/Staff UI. See [BUSINESS_ALIGNMENT_2026-11-12.md](BUSINESS_ALIGNMENT_2026-11-12.md). No build, tests, migration or runtime checks were run for those later edits, as explicitly requested by the user. The evidence below applies ONLY to the earlier checkpoint. Historical blockers 1 and 2 below have been partially addressed in source; use the new alignment document for current limitations.

## Fixes in the earlier checkpoint

- Identity now recognizes Parking's INCIDENT_READ, INCIDENT_WRITE, HANDOVER and MANAGER capabilities. Active account, assigned lot, role, validity period and revocation checks remain enforced. MANAGER requires a manager assignment.
- Booking quote authorization no longer swallows Identity transport failures; authorization unavailability remains unavailable rather than becoming permission denial or success.
- Staff incident list/create/update use server data and assigned lots. Removed invented empty-list incidents, local incident persistence, hard-coded reporter names and fabricated IDs. Updates send the version displayed to the operator.
- Staff facility selector uses assigned lots and actual availability, not fabricated capacity or unrestricted fallback catalogs.
- Cash confirmation and handover submission no longer return local success after API rejection. Handover itself still needs a real shift/receiver UI (see below).
- Architecture test allows the existing shared pure pricing domain library, while checking its transitive references. Checkout boundary test now aligns the fixture to an exact pricing block rather than checking in two minutes early.

## Evidence

- Frontend production build passed; existing bundle-size warnings remain.
- 13 existing frontend tests passed; 4 new adapter tests passed, covering API failure propagation, incident version/lot handling and rejection of unrestricted catalog fallback.
- Docker Identity and Parking rebuilt successfully; all application containers healthy.
- `node scripts/microservices/test-incident-workflow.cjs` passed against local Docker: create, idempotent replay, update, stale-version 409, resolve, persisted reread, Customer 403 and unassigned-lot 403. Synthetic incident 4dc1bb55-72f5-490d-8beb-ff32e572387b was resolved.
- Final .NET run: 190 passed, 0 failed, 2 skipped (HTTP host tests require freshly built host DLL paths); build had 0 warnings and 0 errors. PostgreSQL integration tests ran against a separate disposable container, not demo databases. See artifacts/business-20261112.log and tests/Parking.Microservices.Tests/TestResults/business-20261112.trx. Test container was stopped and removed.
- Full authenticated browser acceptance was NOT performed in this checkpoint.

## Remaining release blockers

1. Manager pricing save/export still lack complete APIs. Manager KPI, audit, reconciliation and exceptions include synthetic data/actions in managerApi.ts. Implement server queries/commands, scoped authorization, transaction/audit persistence and UI error states before treating these screens as operational.
2. Staff dashboard, slot overrides and shifts still include local data. Replace them with persisted server contracts. Handover currently generates shift IDs and hard-codes a receiver; replace with real shifts and assigned receivers, with receiver confirmation. Removing false-success fallback alone does not complete this feature.
3. Run authenticated browser scenarios across Customer, Staff and Manager: booking/payment/QR/entry/exit, receipt, refresh persistence, concurrent booking, wrong plate/lot, expired hold, stale data, denied roles and physical occupancy until exit. Existing API/DB checks do not substitute for these.
4. Verify VNPay callback signatures, retries, reconciliation/refunds, partial failure and recovery with sandbox credentials; verify configured mail/OTP delivery and AI behavior with real images.
5. Prepare a separate production deployment configuration: actual domain/TLS, frontend same-origin proxy, production secrets, restricted service exposure, migration/backup/restore procedures and rollout/rollback test. Current compose is explicitly Development.

No secrets are included in this document. No remote push or production deployment was performed.
