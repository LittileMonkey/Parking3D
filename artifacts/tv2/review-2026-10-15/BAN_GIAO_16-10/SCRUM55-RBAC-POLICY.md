> Lưu ý 15/10: Đây là bản policy draft ngày 13/10, chưa có approval. Các nhận xét code/trạng thái cũ được cập nhật trong BAO_CAO_16-10.md: route auth và log hash đã sửa qua source review; build hiện tại chưa xác minh. Không dùng finding lịch sử như kết quả runtime mới.

# SCRUM-55 — TV2 Quang: RBAC và policy vận hành/tài chính

Ngày rà soát: 13/10/2026. Owner: vonhatquang817. Jira trực tiếp xác nhận ticket này đang Đang Xem, High, hạn 20/10/2026. Bản phân công local ngày 07/10 đã đảo mapping SCRUM-52/55; dùng Jira hiện tại.

Nguồn: AGENTS.md, docs/02-BUSINESS-RULES.md, docs/APIDesignTemplate.md, docs/GitlabGuide.md, docs/microservices/API-CONTRACTS.md và code GitHub dev c28baab. Tài liệu này là acceptance/test design, không bổ sung endpoint hoặc phê duyệt policy thay mentor.

## Matrix quyền cần nghiệm thu

| Hành động | Guest | Customer owner | Customer khác | Staff A hiện hành | Staff B | Manager A không có Staff | Admin |
|---|---|---|---|---|---|---|---|
| Đọc danh sách bãi công khai | Cho phép DTO không PII | Cho phép | Cho phép | Cho phép | Cho phép | Cho phép | Cho phép |
| Đọc booking bãi A | 401 | Cho phép | Từ chối không lộ dữ liệu | Cho phép theo capability | Từ chối | Theo capability đã duyệt | Theo capability đã duyệt |
| Tạo CASH cho booking A | 401 | Quote từ server | Từ chối | Theo contract scoped Staff | Từ chối | Chưa có delegation thì từ chối | Không suy diễn quyền tài chính |
| Confirm CASH bãi A | 401 | 403 | 403 | Cho phép, reason/version và audit | 403 | 403 nếu không có assignment Staff | Không mặc định bypass Staff |
| QR/check-in bãi A | 401 | Không tự check-in | Từ chối | Theo contract TV6 | Từ chối | Chờ contract | Chờ contract |
| Gán Staff | 401 | 403 | 403 | 403 | 403 | Chờ delegation | Theo current Admin + lot tồn tại |

Mọi permission vận hành phải kiểm tra tài khoản và assignment hiện tại, không chỉ role trong JWT. Assignment hết hạn/thu hồi hoặc chưa đến activeFrom phải bị từ chối với JWT đã phát. Bãi suy ra từ tài nguyên phải khớp path; không tin actorId/amount/role do client gửi. Với tài nguyên không thuộc owner, 403 hoặc 404 chống enumeration cần owner chốt; không đổi oracle tùy response để cho PASS.

## Decision log

| ID | Quyết định/oracle | Nguồn/trạng thái | Owner xử lý |
|---|---|---|---|
| POL-01 | Hold mặc định 15 phút; policy riêng có thể cấu hình | AGENTS/BR-08. dev c28baab đổi tài liệu và fixture thành 5; chưa thấy approval mentor trong nguồn đã đọc. Cần xác nhận default và revision | Nhật/Hàn/mentor |
| POL-02 | Giá CASH lấy quote server, theo bãi và toàn duration | BR-16/17; runtime Payment có gRPC quote. Search đang mock 50.000 cho mọi bãi | Sơn |
| POL-03 | Confirm CASH cần Staff hiện hành đúng bãi; Customer/Manager không Staff bị từ chối | API-10. Identity mới không expose FacilityAuthorization, chưa chạy end-to-end | N.Đức/Sơn |
| POL-04 | Body confirm runtime là version >=1, reason nonblank <=500 | PaymentService.cs. Bộ TV2 cũ dùng expectedVersion và <=1000 là draft, không dùng làm oracle runtime | Sơn/Quang |
| POL-05 | CASH SUCCESS không đồng nghĩa booking CONFIRMED ngay; chờ outbox/inbox | PaymentService/OutboxWorker; late/full/partial/overpayment cần reconcile, không cướp slot | Sơn/Hàn |
| POL-06 | Retry SUCCESS trả kết quả cũ; không thêm receipt/event/audit confirm | Runtime Payment; phải assert DB trước/sau, không chỉ HTTP 200 | Sơn/Quang |
| POL-07 | Arrival sớm/trễ, QR TTL/consume/replay và wrong vehicle | BR-11; không tự lấy ví dụ 15/30 làm policy mọi bãi. Chờ contract và fixture QR/check-in | Hàn |
| POL-08 | Một active session mỗi xe; hai check-in đồng thời chỉ một effect | BR-12; cần harness barrier start và DB assertion | Hàn |
| POL-09 | Thanh toán không giải phóng xe vật lý | BR-13/15; checkout/overtime/physical exit ngoài cam kết Sprint 2 theo replan | Hàn/Sơn |
| POL-10 | OCR chỉ candidate/review; dữ liệu có quyền dùng; không tự barrier/phạt | BR-AI-01/04; provider thật là P1 | N.Đức/Nhật |
| POL-11 | Audit phải có actor, lot, action, entity, reason; không log JWT/hash/QR token | BR-21/24; PasswordHasherService hiện log hash, cần sửa trước acceptance | N.Đức |
| POL-12 | Matrix/report/audit/delegation chưa có contract thì Blocked, không tự cấp quyền | AGENTS/DTO separation | Nhật và owner API |

## Oracle tài chính để review với Sơn

Fixture giả định riêng: FLAT_BLOCK 15 phút, 7.500 VND/block, daily cap 120.000, multiplier 1, timezone Asia/Ho_Chi_Minh. 30 phút = 15.000; 31 phút = 22.500; 120 phút = 60.000; 300 phút = 120.000. Qua 00:00 địa phương phải chia ngày trước áp cap. Không dùng số này cho bãi không có đúng fixture. Thay đổi giá sau booking không sửa pricing snapshot. Peak/multi-rule không hỗ trợ phải báo lỗi rõ, không thay bằng mock.

## Acceptance cho SCRUM-55

- Có review matrix/policy với TV5 quyền, TV6 QR/session, TV7 tiền, TV4 UI và TV8 tích hợp; decision chưa được duyệt vẫn OPEN.
- Chạy test Staff đúng/sai bãi, assignment expired/revoked JWT cũ, Customer confirm, reason/version/retry/late payment và audit với dữ liệu riêng.
- Chạy QR wrong-lot/vehicle/expired/reused/unpaid và hai check-in đồng thời khi API thật được bàn giao.
- Mỗi PASS phải có commit, environment, fixture/policy revision, request/response đã che dữ liệu và DB assertions; mock/unit không thay thế acceptance.
- Chưa Done khi còn build blocker, current authorization thiếu hoặc QR/session chưa có evidence.

## Lịch còn lại

Fetch GitLab ngày 13/10 xác nhận origin/dev c7d1f52 còn Identity gRPC/health/auth chuẩn, khác GitHub dev c28baab. Matrix là acceptance chung; nhận xét thiếu Identity contract chỉ áp dụng GitHub đã rà soát. Nhật cần chốt bản tích hợp để TV2 test, không tự hợp nhất hai implementation Identity.

13/10: review matrix/oracle và gate auth/data/booking/CASH; ghi blocker. 14–15/10: chạy/retest CASH và quyền sau fix Identity; chuẩn bị fixture QR. 16/10: test QR/check-in và freeze scope P0. 19/10: SCRUM-52 regression cùng Phát. 20/10: retest, report, demo và review/retro. P1 chỉ chạy nếu đủ provider/data/capacity.

