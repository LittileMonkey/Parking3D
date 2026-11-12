# Checklist thực thi tiếp theo — Quang TV2

Mỗi run phải có commit, UTC time, môi trường, policy/fixture revision, expected/actual, sanitized evidence, result và owner. Không lưu token/password/hash/QR nonce hoặc PII thật. Chỉ chạy trên test DB riêng. Không reset DB nhóm.

| Thứ tự | Kiểm tra | Expected và evidence | Hiện tại |
|---|---|---|---|
| 1 | Chốt commit tích hợp, build/test/ready Gateway và bốn service | Exit codes/log/TRX; ready HTTP; ba bãi khác cấu trúc | Chờ môi trường; chưa PASS |
| 2 | Chốt policy hold/arrival/QR TTL, fixture Staff A/B/Customer, expired/revoked assignment | Owner approval + fixture revision, JWT cũ dùng để retest revoke | Chờ review |
| 3 | Guest và Customer gọi CASH controller mới | Guest 401, Customer 403, không effect DB | NOT_RUN |
| 4 | Staff B gọi CASH bãi A; Staff A bị revoke/expired dùng JWT cũ | 403; không payment/receipt/outbox/audit confirm mới | NOT_RUN |
| 5 | CASH đúng bãi, reason/version hợp lệ | Actor từ server; payment/receipt/outbox/audit bền vững; trạng thái đọc lại đúng | NOT_RUN |
| 6 | Sai reason/version, retry và late payment | Validation/conflict theo contract; retry một effect; late không cướp slot | NOT_RUN |
| 7 | Chờ delivery outbox/inbox | Booking Confirmed chỉ khi hợp lệ; retry không thêm effect | NOT_RUN |
| 8 | QR chưa paid/sai bãi/xe/expired/reused | Bị từ chối; không tạo session | Chờ API/fixture |
| 9 | Hai check-in đồng thời | Harness barrier start; đúng một active session và physical assignment | Chờ API/harness |
| 10 | Staff UI và outage | DB effect thật; lỗi rõ khi API lỗi, fallback không được tính PASS | NOT_RUN |
| 11 | Bug/retest + regression report | Fix commit, retest evidence, open blockers và owner rõ; phối hợp Phát | Chờ kết quả run |

Không dùng Postman Runner tuần tự chứng minh concurrency. Không ghi NOT_RUN thành PASS vì JSON/collection hợp lệ. Các test QR chưa có contract không tự đoán endpoint để gắn bug 404.

Tài liệu Jira có thể đính kèm: BAO_CAO_16-10.md, EVIDENCE.txt và bộ test hiện có. Chưa có nội dung nào được gửi lên Jira/GitHub/GitLab trong lần chuẩn bị báo cáo này.
