# Trạng thái trung thực của bản chuyển kiến trúc

## Có implementation

- 4 host Identity/Parking/Payment/AI + Gateway, solution riêng và 4 layer bên trong mỗi owner.
- 4 schema PostgreSQL riêng; ownership đủ47 bảng gốc, FK xuyên service có inventory; guards Parking giữ nguyên; audit/outbox/inbox cục bộ.
- 6 hợp đồng gRPC v1, service-key interceptor, deadline/cancellation, pooled channels qua DI.
- Register/login hashed password + JWT; bootstrap Development không tự nâng quyền customer cũ; current user/assignment authorization và Admin assignment có kiểm tra lot gRPC.
- Public lots, EXACT_SLOT booking có verified vehicle access, operating hours/closures, snapshot giá/policy, hold15 theo cấu hình, idempotency, advisory locks/GiST. Runtime mới hỗ trợ một FLAT_BLOCK rule; chưa engine multi-rule đầy đủ.
- CASH payment server quote qua gRPC, Staff confirmation, atomic audit/outbox; retry worker → Parking inbox/receipt/confirmation hoặc reconciliation, không double effect.
- OCR HTTP adapter configurable → AI gRPC → private record, idempotency/review/version/audit; chưa cấu hình thì503, không fake.
- Aggregate snapshot worker, baseline forecast advisory NOT_EVALUATED; approved PUBLIC FAQ retrieval không LLM; Admin document draft/publish có confirmation.
- Compose, secret generation, GitLab CI build/unit/schema checks, API diagrams và runbook.

## Còn thiếu để nghiệm thu toàn bộ sản phẩm

| Việc | Owner đề xuất | Điều kiện hoàn thành |
|---|---|---|
| Refresh/recovery/OTP và quản lý/revoke assignment đầy đủ | TV5 | security tests, scope hiện tại, policy delegation được duyệt |
| CRUD lots/levels/zones/slots/vehicles và xác minh quyền xe thật | TV5/TV6 | thay seed-only setup bằng DTO/APIs được test |
| AUTO_SLOT, search NEAREST/CHEAPEST và multi-rule pricing | TV6/TV7 | Haversine + total-price oracle; guards/timezone/boundaries |
| QR issuance/consume, check-in/session/check-out/physical exit/overtime | TV6/TV7 | đồng bộbooking/session/assignment trong transaction; đủ tiền; Staff/camera chứng cứ exit |
| Signed VNPay sandbox, payment attempts/webhooks/refunds | TV7 | signature/amount/currency verification, callback replay, reconciliation, outbox/inbox |
| Model OCR thật + private storage/cleanup | TV8 + người làm AI | cấu hình provider, dataset/accuracy/no-plate/fallback evidence |
| Forecast model/evaluation và LLM adapter nếu nhóm chọn | Nhóm AI/TV2 | temporal holdout, MAE/baseline; public cited sources + injection/fallback tests |
| Map3D APIs, SignalR, notifications/reports | TV8/TV4/TV7 | source dữ liệu canonical và scope/PII đúng |
| React source và tích hợp Gateway | TV3/TV4 | đưa source vào repo; UI dùng REST envelope/JWT/409/503 |
| TLS/mTLS, caller credentials, deployment/monitoring/data cutover | TV8 | không deploy config Development lên Internet |

Các mục này không được gắn Done/Pass chỉ vì schema hoặc solution đã build. Bản chuyển kiến trúc tạo nền tảng thực thi và một số luồng có evidence; không tuyên bố toàn bộ OJT/3 AI/64 test case đã hoàn thành.

Tham chiếu: API-CONTRACTS, RUNBOOK, VALIDATION và ownership.json. Team TV2 test workbook cũ vẫn Not run cho các use case chưa có runtime; không overwrite kết quả bằng số test foundation.
