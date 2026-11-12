# Thứ tự triển khai

1. Chốt ownership/contract và tạo solution nhiều host, giữ Clean Architecture bên trong từng service.
2. Tách DDL theo owner, giữ guards tại Parking; bổ sung inbox/outbox cục bộ và foreign-reference inventory.
3. Gateway, envelope/middleware, health/readiness, configuration/secrets và docker compose/CI.
4. Identity login/register + facility authorization gRPC, không dùng role Staff global thay assignment.
5. Parking → AI OCR gRPC với provider configurable, lỗi thật khi chưa cấu hình; test auth, wrong scope, deadlines/provider failures.
6. Payment outbox → Parking inbox gRPC, replay/idempotency, late payment reconciliation; không giả VNPay verified success.
7. Các use case parking/search/QR/session/exit và FE/realtime được làm theo story, với checks và policy được chốt. Provider forecasting/assistant cần evidence/evaluation trước nghiệm thu.

TV2 kiểm tra contracts/permissions/late payment/physical exit và phối hợp test integration. TV1 giữ requirement traceability. TV3/TV4 dùng Gateway REST, không gọi gRPC nội bộ từ browser. TV8 giữ compose, CI và checklist tích hợp.

Branch design và implementation tách riêng. Nhánh dev và main đã được đối chiếu/tích hợp; conflict template cũ đã xử lý theo backend mới. Repository hiện chỉ có remote GitLab, chưa cấu hình GitHub team remote; không tự tạo hoặc đoán URL. Không tự merge main/release.
