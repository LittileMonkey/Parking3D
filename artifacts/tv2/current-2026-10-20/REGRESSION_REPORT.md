# SCRUM-52 — Regression TV2, 20/10/2026

Commit khảo sát: `11e5652`, nhánh `dev`, GitHub Parking3D. Source không được sửa trong lần QA này. Báo cáo thay nhận xét hiện trạng trong báo cáo TV2 ngày 13–15/10; vẫn giữ báo cáo cũ làm lịch sử.

## Kết quả thực thi

| Lượt | Kết quả | Evidence / giới hạn |
|---|---|---|
| Parking API build --no-restore | PASS, 0 warnings / 0 errors | `parking-build.log` |
| Payment API build --no-restore | PASS, 0 warnings / 0 errors | `payment-build.log` |
| Gateway build --no-restore | PASS, 0 warnings / 0 errors | `gateway-build.log` |
| Restore test dependencies | PASS sau khi cho phép NuGet | `restore.log`; không phải vulnerability audit |
| Test không cấu hình DB, filter Dependency!=IdentityIntegration | 38 PASS / 12 SKIP, 2 không được chọn | `results/tv2-current.trx` |
| Test DB riêng PostgreSQL18.4 | **50 PASS / 1 FAIL / 1 SKIP**, tổng 52 | `results/tv2-isolated-pg18.trx`, `isolated-run.log`; không cộng dồn lượt 38 vào lượt 50 |
| Anonymous HTTP probes Payment/Gateway | **1 PASS / 3 FAIL / 1 OBSERVED** về status | `HTTP-EVIDENCE.json`; hai response CASH còn thiếu envelope chuẩn |

HTTP-01 GET status và HTTP-02 POST CASH hợp lệ không token trả404 thay401; HTTP-03 body không hợp lệ không token trả400 thay401. HTTP-04 POST create-payment không token trả401 đúng. HTTP-05 Gateway check-in trả404 Endpoint not found. Chỉ có dữ liệu synthetic/booking không tồn tại: chứng minh request anonymous vào validation/DB lookup, chưa chứng minh đã đổi payment thật hoặc lộ payment tồn tại. Các host và cluster tạm đã dừng sau probe.

Lượt test DB sử dụng test assembly build từ source hiện tại sau restore. Test assembly có warning nullable từ Identity; không tuyên bố toàn solution sạch warning. 38 test nền tảng có cả test đơn giản về invariant; không suy ra coverage hoặc acceptance toàn hệ thống từ số lượng test.

12 test database PASS bao gồm: tạo một session/physical assignment/audit; retry; 10 tác vụ quét cùng lúc; cấp lại thu hồi QR cũ; sai plate/gate; pending booking không cấp QR; expiry giải phóng reservation idempotent; early/late boundary một số biến thể; slot maintenance; kiểm tra expiry DB; fault injection audit rollback; slot đã có xe không bị expiry giải phóng; GiST overlap/availability; key đổi body và EXIT gate.

Test FAIL: `StaffScopeCustomerDeniedAndRevokedAssignmentAreCheckedAgainstIdentityDatabase`, `ParkingWorkflowTests.cs:280`. Staff đúng bãi nhận false cho LOOKUP. Assertion đầu fail nên CHECK_IN/customer/cross-lot/revoke còn chưa thực thi trong test này.

Test SKIP: `RealHttpJwtGrpcScopePaymentAndSingleUseQrWorkflow`; chưa cấu hình PARKING_TEST_API_DLL và PARKING_TEST_IDENTITY_DLL. File chứa test là partial class ParkingWorkflowTests, nên filter theo ParkingHttpWorkflowTests không loại nó khỏi discovery. Report dựa trên kết quả TRX thực tế, không diễn giải skip thành pass.

## Môi trường và tái lập

- Windows, .NET SDK10.0.401/runtime10.0.12; target net9/C#13, roll-forward Major.
- PostgreSQL binary có sẵn `D:/postGREDB/bin`, phiên bản **18.4**. Đây là kiểm thử bổ sung; chưa xác minh PostgreSQL17 theo baseline.
- Runner `Run-IsolatedTests.ps1` tạo cluster mới, loopback55482; test tạo các DB ngẫu nhiên scrum49_it_*, dọn DB test rồi dừng cluster. Không đọc/ghi DB phát triển của nhóm.
- Fixture theo source `database/services/parking/001_schema.sql`, `002_demo_fixture.sql`, Identity schema; hold fixture5 phút, không coi là approval cho default15 phút.
- HTTP probe riêng, nếu thành công: loopback55580 Gateway,55581/55582 Payment, PostgreSQL55483; dữ liệu synthetic và không có payment đã seed. Chi tiết trong HTTP-EVIDENCE.json.

```powershell
# Sau khi restore và build test project đúng source cần kiểm tra:
powershell -ExecutionPolicy Bypass -File artifacts/tv2/current-2026-10-20/Run-IsolatedTests.ps1
# Kết quả exit1 là có test FAIL; không sửa test thành xanh để che lỗi capability.
```

## Delta so với báo cáo cũ

- Identity đã có AddGrpc/MapGrpcService; nhận xét cũ “chưa có gRPC host” không còn đúng với source mới. Health và capability/configuration vẫn cần fix/retest.
- Search đã dùng ParkingLotRepository/EstimatedPriceService truy vấn DB, không còn giá cứng50000. Chưa chạy acceptance search/cache/full duration; không tự đóng mọi vấn đề giá.
- CASH controller mới đã dùng SQL transaction, payment/audit/outbox thật; finding cũ “repository mock” được thay bằng review authorization/version/retry hiện tại.
- QR/check-in đã có API/repository/test; finding “chưa có API” đã lỗi thời. Vấn đề hiện tại là Gateway routing, Identity capabilities và UI tích hợp.
- HoldExpiryWorker đã dùng IServiceScopeFactory; blocker scoped service cũ không còn đúng qua source review.

## Gate nghiệm thu

SCRUM-55: matrix/policy/cases đã cập nhật, repository test đã có evidence; review policy và runtime RBAC/CASH/QR chưa hoàn tất.

SCRUM-52: regression package và bug/retest đã chuẩn bị; chưa có full E2E/Staff UI acceptance hoặc full-solution CI PASS. Hai ticket chưa đủ điều kiện Done. Trạng thái Jira thực tế chưa được đọc/cập nhật trong phiên này.

32 acceptance case: 30 NOT_RUN ở cấp acceptance (một số đã có evidence hỗ trợ tầng thấp hơn), 1 PARTIAL_FAIL (anonymous authorization), 1 REVIEW_FINDING (Staff UI). **Không có case nào được ghi acceptance PASS** chỉ từ unit/repository test.

Xem BUG_REGISTER.md và RBAC_POLICY.md. Không sử dụng test handler PaymentEvents hay thay trạng thái bằng SQL làm bằng chứng provider/thu tiền thật. Không có OCR/provider, physical barrier, checkout hoặc P1 acceptance trong phạm vi kết quả này.
