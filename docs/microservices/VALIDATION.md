# Kết quả xác minh — 06/10/2026

- Build solution 21 projects: 0 lỗi, 0 cảnh báo.
- 15 unit tests đạt: giá block/cap/ngày địa phương, quyết định thanh toán, PBKDF2, giới hạn ảnh, provider OCR chưa cấu hình và Haversine.
- Bốn schema áp dụng thành công; số bảng gồm bảng kỹ thuật/projection: Identity 8, Parking 36, Payment 10, AI 10.
- Năm host .NET với bốn database PostgreSQL 17.6 thật: 8 nhóm tích hợp đạt.

## Tích hợp đã kiểm tra

1. Gateway/readiness năm host và bốn database.
2. Đăng ký, đăng nhập, hash mật khẩu và JWT.
3. gRPC thiếu service key bị từ chối; Staff được thao tác bãi A, bị từ chối ở bãi B.
4. OCR REST → Parking → Identity/AI gRPC → AI database; replay idempotent và Staff duyệt.
5. Snapshot giá, retry cùng key và từ chối overlap.
6. Staff xác nhận tiền mặt → payment/outbox nguyên tử → gRPC → inbox/receipt → booking CONFIRMED; retry không thu hai lần.
7. Tám người/xe đồng thời tranh một slot: đúng một booking thành công, bảy yêu cầu bị từ chối.
8. Thu hồi assignment có hiệu lực với JWT cũ; VNPay chưa triển khai trả lỗi rõ ràng.

## Giới hạn bằng chứng

Máy có SDK/runtime .NET 10, build target .NET 9 và chạy RollForward=Major. Docker/CI target .NET 9, chưa thực thi Docker hoặc pipeline GitLab. OCR dùng test double với model TEST_DOUBLE; đây không phải đánh giá mô hình thật. Dự báo thống kê chưa được đánh giá trên bộ dữ liệu; FAQ truy xuất nội dung đã duyệt. Chưa nghiệm thu toàn bộ Baseline V4.

Tái chạy theo [RUNBOOK](RUNBOOK.md); kịch bản tại scripts/microservices/integration_smoke.cjs. Credentials và dữ liệu kiểm thử được sinh tạm.
