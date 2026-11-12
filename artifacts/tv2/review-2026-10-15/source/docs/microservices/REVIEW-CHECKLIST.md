# Review bản chuyển kiến trúc

## Design

- [x] Ranh giới owner/domain/database được ghi rõ, giữ booking/session/slot trong cùng Parking.
- [x] Protobuf versioned, REST request/response/error/activity/sequence diagrams.
- [x] Ownership đầy đủ47 bảng, external references và cutover được ghi rõ.
- [ ] Mentor/BA xác nhận boundaries/policy và phân công AI.

## Implementation DoD

- [x] Build solution mới và kiểm thử core rules.
- [x] Chạy schema độc lập và integration thực tế trên PostgreSQL17.
- [x] Facility permission và service authentication được kiểm tra.
- [x] Outbox/inbox/replay/late-payment decision giữ transaction.
- [x] Không commit secrets hoặc credentials thật; .env bị ignore.
- [x] README/API docs/runbook/limitations/backlog.
- [ ] Docker build/up trên Docker Desktop thực tế (máy hiện chưa có Docker).
- [ ] Pipeline GitLab chạy thành công trên runner sau push (không thay bằng kết quả local).
- [ ] Toàn bộ parking/VNPay/AI/FE workflows hoàn thành và UAT.
- [ ] Production TLS/identity/observability/deployment hardening.

GitHub team remote chưa cấu hình trong repository này; các nhánh review gửi GitLab theo ngữ cảnh yêu cầu, không tự tạo remote. Không merge main trong tác vụ chuyển kiến trúc này.
