# Regression report — Quang TV2, 29/10/2026

## Phiên bản và phạm vi

Gói QA dựa trên GitHub dev **be3b5f6**. Source sản phẩm không bị sửa trong gói này. Test C# là bộ test của nhóm được chạy lại; Quang bàn giao test design, runner/probe, report và evidence. Các kết quả lịch sử trên577064b được phân biệt bên dưới.

## Kết quả mới trên base be3b5f6

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| Full solution build | PASS, 0 warning / 0 error | SDK10.0.401, targetnet9; không phải nghiệm thu runtime |
| Frontend build | PASS | Có annotation/bundle-size warnings của bundler; không phải TypeScript compile errors |
| Suite PostgreSQL18.4 riêng | **95 PASS / 1 FAIL / 0 SKIP, tổng96** | Có repository/unit/mock-boundary tests; không phải96E2E |
| Browser smoke | Home/booking/search/Staff render, /search redirect /booking | Không nối backend trong browser run; dữ liệu Staff có thể demo/localStorage |
| API probe | PASS: login→search→booking→CASH→Confirmed→QR→Gateway check-in; DB đúng1session/assignment | Không suy từ lời gọi FE sang acceptanceUI |
| Postman collection | 13 requests đã chuẩn bị, secrets trống | Chưa chạy toàn collection |

95PASS không được cộng với lượt test cũ để thành tổng mới. PostgreSQL17 baseline chưa được xác minh trong gói này.

## Ca test còn FAIL

`RealHttpJwtGrpcScopePaymentAndSingleUseQrWorkflow`: Identity host dừng tại `DbInitializer.SeedAdminAsync` vì chưa có `SeedAdmin` config trong testhost. Test đặt `SeedAccounts__Enabled=false` nhưng startup vẫn gọi seed. Source còn khác biệt port hard-code và login request `email` so với wrapper cũ; đây là review các bước tiếp theo, không gọi chúng là assertion đã chạy.

Giữ test FAIL để owner sửa đúng cấu hình/contract; không lọc bỏ hoặc đổi expected để báo xanh. Owner phối hợp: N.Đức/Nhật, Quang retest. Test plan/report có thể review, nhưng không tuyên bố full E2E PASS.

## Delta so với577064b

- Gateway đã thêm route account, user-vehicles, membership, assignments subpath và check-in qua PR#48. Đã retest check-in qua Gateway: **200**, DB CHECKED_IN với đúng1active session/assignment; không còn blocker404 ở boundaryAPI này. Route xe/membership chỉ mới source-review, chưa tự tính PASS.
- Staff bắt đầu gọi check-in API thật nhưng vẫn còn fallback nghiệp vụ khi request thất bại. CASH success giả và checkout localStorage vẫn cần kiểm thử/sửa theo owner.
- Trên577064b: API thật login→search→booking→CASH→outbox/inbox→Confirmed→QR→check-in trực tiếp đã thành công; Gateway check-in404. Không dùng kết quả lịch sử này chứng nhận đường Gateway trênbe3b5f6.
- FE realtime parser4PASS và countdown5PASS trên577064b là evidence helper-level, không chứng nhận backendHub/realtime toàn luồng.

## Retest API hiện tại trênbe3b5f6

Runner cấu hình đúng năm host thật và bốnDBsynthetic; không inject PaymentSucceeded và không gọi provider giả. Gateway readiness, search giá, booking, CASH, Staff scoped confirmation, outbox/inbox→Confirmed, QR và Gateway check-in đều200. DB có đúng1active session và1physical assignment. Chỉ chứng minh boundaryAPI trong fixture này; không thay UI/realtime/checkout acceptance.

## Acceptance hiện tại

SCRUM-77 chưa đủ Done: cần hoàn thiện/kiểm chứng checkout, physical exit, UI/Gateway, realtime và video/log full lifecycle. Slot phải tiếp tục Occupied sau trả tiền nếu xe chưa thực sự ra.

Gói này không có benchmark provider OCR/VNPay thật, dataset100 ảnh hoặc nghiệm thu mất vé/overtime. Trạng thái Jira live chưa được đọc/thay đổi. Xem [Bug register](Bug-Register.md), [Jira status](Jira-Status.md) và [demo guide](Demo-Guide.md).

Log/TRX/video gốc giữ trong artifacts local hoặc đính kèm CI/Jira sau khi che dữ liệu; Git chỉ chứa snapshot kết quả đã kiểm tra. Chạy lại theo scripts/qa/sprint-3/README.md; mỗi run phải ghi đúng commit mới.

