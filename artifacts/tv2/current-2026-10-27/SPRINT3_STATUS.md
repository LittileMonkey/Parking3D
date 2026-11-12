# TV2 Quang — Sprint 3 status, 27/10/2026

GitHub dev updated to d4b1dda. Five existing FE edits preserved; backup: artifacts/local-backup-before-sync-2026-10-27. No product source edited by this review. No Jira/remote writes.

## Ticket scope and completion

SCRUM-77 (from docs/12-JIRA-TASK-DESCRIPTIONS.md): E2E entry/check-in/3D/checkout/payment/physical exit. Not ready for Done: no checkout endpoint found in current Parking API; Gateway configuration lacks /api/v1/check-in; Staff CASH catch still fabricates COMPLETED. These are source findings, not new runtime reproductions. Runtime and video evidence are still required.

SCRUM-78: repository documentation conflicts with prior Jira screenshot about owner (Phat vs Nhat/Quang). Verify live assignment; do not silently reassign. Can prepare evaluation protocol, label validation and report template. No verified held-out 100-image dataset/provider benchmark in this review; do not claim accuracy/latency PASS.

Mentor regression task: exact newly created Jira key unknown. Can finish test design, traceability and source-review bug register now, execute available layers and retest when owners deliver. Cannot close full acceptance while CASH fallback and FE build failure persist.

## Current source-review findings

- Gateway: missing check-in route; source src/Gateway/Parking.Gateway/appsettings.json.
- No checkout endpoint found in Parking API controllers/Program; confirm against owner branches before declaring missing from all development.
- Staff UI: frontend_parking_system/src/services/staff/staffApi.ts catch in confirmCashPayment returns fabricated COMPLETED/payment ID/actor.
- Payment controller: no Authorize attribute, actor fallback staff_01 remains. Runtime authorization requires retest; historical HTTP results from 20/10 are not current results.
- Identity now recognizes LOOKUP/CHECK_IN: historical 20/10 capability failure must be retested, not reported unchanged.

## Verification

- npm run build: FAIL, six TS6133 unused-symbol diagnostics in ManagerLayout.tsx and ManagerDashboard.tsx introduced by incoming Manager files. Log: artifacts/tv2-2026-10-27-frontend.log. Workspace includes existing local 3D edits.
- node --test frontend_parking_system/tests/parking-scene.test.mjs: 3 PASS, 0 FAIL. Tests belong to existing local preview edits, not E2E or canonical GitHub-only verification. Log: artifacts/tv2-2026-10-27-scene.log.
- Backend test result: consult artifacts/tv2-2026-10-27-test.log and current TRX when available; no historical 50 PASS reused for the new commit.

## Work Quang can complete now

1. Traceability: SCRUM-77 steps and each mentor feedback -> case -> owner -> evidence -> status.
2. E2E scenarios: happy path, wrong lot/vehicle, unpaid/expired/reused QR, concurrency, cash retry/timeout, checkout while unpaid, paid but not physically exited.
3. Postman/environment templates without exported tokens or secrets; no guessed checkout endpoint.
4. Source-review defects with commit, path, expected/actual, owner and retest criteria.
5. Current regression report and Jira draft; keep Not run/Blocked separate from Fail and Pass.
6. Dataset evaluation preparation if assigned SCRUM-78; benchmark only on approved data with fixed held-out split.

Suggested status: In progress for deliverables; blocked dependencies called out individually. No automated Jira state change.

### Current backend run completed
- Current test assembly build completed with no diagnostics printed in the successful serial build; this is not a full-solution build.
- dotnet test --no-build --no-restore (outside sandbox; roll-forward Major): 52 PASS, 0 FAIL, 14 SKIP, total 66. TRX: results/tv2-2026-10-27.trx.
- The first sandbox runner attempts were interrupted after stalling; they are not counted as failures or successful runs.
- The 14 skipped tests require integration fixtures/host configuration. These results do not certify E2E, checkout, Staff UI, provider or PostgreSQL17 acceptance.

### Isolated PostgreSQL retest completed
- PostgreSQL18.4 isolated cluster: 65 PASS, 0 FAIL, 1 SKIP, total66. Do not add the earlier52 to65; same suite rerun with DB fixtures.
- StaffScopeCustomerDeniedAndRevokedAssignmentAreCheckedAgainstIdentityDatabase now PASS. This closes the old repository-layer failure for this commit; live JWT/gRPC/HTTP acceptance remains unverified.
- RealHttpJwtGrpcScopePaymentAndSingleUseQrWorkflow SKIP because host DLL configuration absent. PostgreSQL17 baseline not verified.
- Cluster stopped successfully; no team DB used.
- Twelve SCRUM-77 scenario drafts prepared in SPRINT3_E2E_CASES.csv; all NOT_RUN at acceptance level. Lower-level support evidence is recorded separately.
