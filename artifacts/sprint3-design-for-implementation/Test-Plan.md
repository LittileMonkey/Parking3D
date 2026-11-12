# SCRUM-77 — Test plan

Owner gói QA: Quang (TV2). Ngày: 29/10/2026.

## Mục tiêu

Kiểm chứng xe vào → booking/QR hợp lệ → check-in → slot Occupied → checkout/quyết toán → đủ tiền → xác nhận xe thực sự ra → session Completed, slot được giải phóng. Luồng phải đi qua FE/Gateway; kiểm tra trực tiếp service chỉ là bằng chứng từng phần.

## Policy và dữ liệu

- Hold mặc định **5 phút**, cấu hình theo bãi, theo SCRUM-100 và AGENTS.md mới nhất. Không nhầm với block tính phí 15 phút.
- Khoảng đặt chỗ `[start,end)`; timezone và pricing snapshot có version rõ.
- Customer owner/khác owner; Staff bãi A/B và expired/revoked assignment dùng JWT cũ; Admin chỉ theo quyền được duyệt.
- Xe synthetic có verified access; slot A/B, cổng ENTRY/EXIT, bãi đóng cửa/bảo trì.
- Payment có Pending/Success, version, reason, key retry. Chỉ CASH synthetic ở test DB; VNPay sandbox có gate riêng.
- Mỗi run tạo database mới trên loopback. Không reset database nhóm. Không tự xác minh sở hữu xe trong API sản phẩm; fixture xác minh chỉ dành test.

## Gate chạy

1. Ghi commit, môi trường, schema/fixture/policy revision và UTC timestamp.
2. Restore/build toàn solution và frontend; không bỏ compiler warning để ép xanh.
3. Readiness và contract auth/Gateway/current assignment đạt; xác định provider thật hay test double.
4. Chạy negative cases trước các bước consume QR/confirm payment không thể lặp tùy ý.
5. Chạy concurrency bằng harness đồng thời; Postman Runner tuần tự không chứng minh race safety.
6. Sau thao tác, đối chiếu DB effect và audit/outbox/inbox; không chỉ kiểm tra HTTP200.

## Acceptance và evidence

Mỗi case lưu precondition, steps, expected/actual, result, evidence path, owner và fix/retest commit. NOT_RUN/Blocked không được chuyển PASS từ unit test. UI-only video không thay video E2E. Payment Success không đồng nghĩa xe đã ra.

- QR: unpaid/expired/revoked/reused/wrong lot/plate/gate bị từ chối; lỗi không consume QR.
- Check-in: một active session/xe; retry không thêm session/assignment/audit effect; lỗi giữa transaction rollback.
- CASH: actor server-side, Staff đúng bãi; version/replay/timeout không double effect; current authorization fail-closed khi Identity lỗi.
- Exit: phí theo snapshot, trừ tiền đã trả; paid-but-still-present vẫn Occupied; chỉ xác nhận physical exit mới vacate.
- Realtime: event chỉ sau commit; đúng bãi; reconnect refetch snapshot; không tự ghi trạng thái kinh doanh từ mesh.
- API: envelope `result/isSuccess/statusCode/message`, status400/401/403/404/409/503 đúng; không lộ PII/stacktrace.

## Trạng thái bàn giao

Test design có thể gửi review độc lập. SCRUM-77 chỉ đề nghị Done khi toàn bộ acceptance bắt buộc đã chạy, không còn blocker, có video/log E2E và được review. Bug đã sửa trong source nhưng chưa retest được ghi RETEST_PENDING, không tự đóng hoặc tiếp tục báo như chưa sửa.
