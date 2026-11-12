# Kế hoạch hoàn thiện sản phẩm theo Docker — 10/11/2026

## Mốc mã nguồn và giới hạn đánh giá

- Đã fetch duy nhất GitHub và fast-forward dev từ ed563d11 lên **8b2dae34**; HEAD trùng github/dev tại thời điểm kiểm tra.
- Ba commit mới: snapshot tên bãi/biển số cho receipt, hỗ trợ receipt tham chiếu session, chống tạo payment trùng và tái sử dụng pending QR; merge PR #66.
- Phần tích hợp local trước đây vẫn ở stash `WIP native-stack and API integration before GitHub dev sync 2026-11-10`. Nó chứa cả code dở và thử nghiệm; không coi là chức năng đã merge hoặc tự pop toàn bộ lên dev.
- Docker là đường chạy/deploy chính của nhóm. Native script chỉ là công cụ dự phòng; không dùng kết quả native để tuyên bố Compose đã chạy được.
- Phạm vi đích: đồ án có luồng thật qua FE/Gateway/services/PostgreSQL, VNPay sandbox hoặc cash, camera simulator/Staff xác nhận xe ra, phân quyền theo bãi và bộ bằng chứng nghiệm thu. Production thương mại/hardware thật cần đánh giá riêng.

## Kết quả kiểm tra mới

| Kiểm tra | Kết quả |
|---|---|
| GitHub sync | HEAD = github/dev = 8b2dae34 |
| Backend test, output riêng artifacts/review-20261110 | 173 tổng: 127 pass, 46 skip, 0 fail |
| Frontend build | Pass; còn cảnh báo chunk >500 kB và annotation SignalR |
| Frontend parking/realtime/hold tests | 13 pass, 0 fail |
| PostgreSQL business integration | 46 test bị skip trong lượt mới; chưa có bằng chứng pass mới |
| Hai cột receipt snapshot trong schema versioned | Không có lot_name / plate_number trong database/services/payment |
| Hai cột trên DB native parking_payment | Truy vấn chỉ đọc xác nhận đều chưa có |
| Docker runtime/deployment | Chưa chạy xác nhận trong lượt này; không có docker CLI trong PATH môi trường kiểm tra |

DB native đã được seed trước đây không phải Docker volumes. Đánh giá schema trước pull không còn đủ: code mới có thêm yêu cầu dữ liệu nhưng chưa kèm migration tương ứng.

## Những việc không cần viết lại

- Giữ backend hiện có: auth, facility assignments, availability/layout, hold worker, QR/check-in/check-out, pricing engines, cash/VNPay adapters, outbox/inbox, incidents/handovers và AI adapters.
- Giữ frontend/3D hiện có và cập nhật UI mới của nhóm. Dev proxy đã dùng Gateway 8080.
- Tiếp tục harden Payment mới, không mở task viết VNPay/receipt/anti-double-payment từ đầu.
- Có class hoặc test hash không đồng nghĩa đã nghiệm thu API/DB/callback. Receipt walk-in vẫn phải test qua service đang chạy.

## Thứ tự triển khai và các mốc giao

### M0 — Sửa tương thích Payment sau pull (P0, owner BE Payment + DB + QA)

- [ ] Thêm migration Payment có version cho billing_accounts.lot_name và plate_number; cập nhật đường tạo DB mới và nâng DB có dữ liệu.
- [ ] Quy định snapshot bất biến: tên bãi/biển số tại thời điểm giao dịch, không lấy biển hiện tại của xe để thay lịch sử; dữ liệu cũ không có bằng chứng thì hiển thị thiếu dữ liệu, không bịa biển số.
- [ ] Bổ sung snapshot cho luồng CheckoutPaymentService tạo billing_accounts theo session; luồng này hiện chưa ghi hai trường mới.
- [ ] Cập nhật DTO FE: bookingId nullable và sessionId nullable cho receipt; kiểm tra đọc/hiển thị/in receipt của cả booking và walk-in.
- [ ] Test nhánh pending reuse trên PostgreSQL: code hiện CommitAsync khi rPending còn sống trong cùng connection; xác minh và sửa nếu phát sinh NpgsqlOperationInProgressException.
- [ ] Test paid replay với idempotency key cũ và key mới: GetQuote được gọi trước guard SUCCESS trong code hiện tại; phải chứng minh booking đã Confirmed không làm replay bị chặn sai.
- [ ] Test pending QR còn/hết hạn, không gia hạn vô hạn hold, CASH/VNPAY đồng thời, callback replay/đồng thời, chỉ một settlement/outbox business effect.
- [ ] Sửa IPN booking dùng responded_at không có trong schema (schema dùng completed_at), atomic transition và kiểm tra signature/amount/status đầy đủ.
- [ ] Loại bỏ authorization fail-open khi Identity timeout/offline; trả 503, không cho qua chỉ vì user UUID khác rỗng.

**Gate M0:** DB fresh và upgraded cùng chạy được cash/VNPay/receipt; các ca paid replay, pending reuse và callback concurrency có test DB pass. Không gắn Done chỉ bằng unit test tính hash.

### M1 — Chạy trọn stack Docker trên máy mới (P0, owner hạ tầng + BE Identity/Parking + FE)

- [ ] Chuẩn hóa Identity bind/cổng theo env: Compose dùng service:8080/8081 nhưng Identity hiện hardcode loopback 5041/5042, HTTPS 7023. Container không phụ thuộc certificate Development của host.
- [ ] Override rõ Ports__Http/Grpc cho từng service; appsettings Payment hiện là 8084/8085 trong khi Compose/Gateway/health dùng 8080/8081.
- [ ] Truyền Services__PaymentGrpc=http://payment:8081 cho Parking; không fallback localhost:8085 trong container Development.
- [ ] Thống nhất bootstrap: Compose gửi Bootstrap nhưng initializer hiện đọc SeedAdmin/SeedStaff; seed demo có chủ đích, không đổi quyền/mật khẩu tài khoản đang tồn tại.
- [ ] Cấu hình ổn định JWT/gRPC/QR signing key, provider credentials qua .env/secret store; không bake secrets từ appsettings vào images. Khóa đã nằm trong Git và còn sử dụng cần thay ở môi trường tương ứng.
- [ ] Thêm frontend multi-stage Dockerfile và Nginx: SPA fallback, /api, /health, /hubs WebSocket, cùng origin. Vite proxy không tồn tại trong thư mục dist production.
- [ ] Chạy migration jobs trước khi services ready; mount 001 chỉ giải quyết volume mới, không nâng volume đang có.
- [ ] Bổ sung seed repeatable cho ít nhất 3 bãi khác cấu trúc, policy/giá, gates, slot/map, tài khoản và assignment demo. Không nhúng dữ liệu người dùng thật vào image.
- [ ] Giữ DB/gRPC/vision trong network nội bộ; hiện vision đang publish 8000 ra host cần rà lại. Điều chỉnh rate limit Gateway (mặc định 20/phút/IP) và tách healthcheck khỏi quota người dùng.
- [ ] Viết một lệnh start, một lệnh stop và smoke check; xác minh restart giữ dữ liệu. Không dùng down -v để nâng schema.

**Gate M1:** fresh clone + .env riêng → compose up --build → tất cả service healthy, FE mở được, login qua Gateway được, SPA deep link và SignalR hoạt động. Sau M0/M1 có thể đưa lên staging nội bộ, chưa vận hành thật.

### M2 — Luồng Customer/Staff chạy xuyên suốt (P0/P1, owner BE Parking/Identity/Payment + FE Customer/Staff)

- [ ] Hoàn thiện vòng đời xe: Identity.user_vehicles và Parking.vehicles/user_vehicle_access phải có ownership/mapping/xác minh rõ; user mới thêm xe rồi booking được theo policy, không sửa SQL thủ công.
- [ ] Chuẩn hóa request/response auth, register, assignment; sửa assignmentId không được gán trong constructor DTO hiện tại để revoke hoạt động.
- [ ] Nối check-in, checkout quote, authorize-exit và physical-exit confirmation ở UI; không dùng localStorage làm nguồn xác nhận Paid/Completed/barrier.
- [ ] Tách rõ cash trả trước booking và cash settlement khi checkout session; receipt dùng đúng paymentId/reference.
- [ ] Lấy bãi/cổng/slot từ API thực và assignment, không dùng UUID demo hardcode làm fallback vận hành.
- [ ] Sửa lỗi check-in mismatch từng tái hiện trên PostgreSQL: chạy lệnh ghi trong khi reader validate còn mở. Chạy lại regression trên commit mới; code liên quan không nằm trong đợt Payment vừa pull.
- [ ] Walk-in chốt snapshot từ plan Published đúng hiệu lực, không lấy snapshot mới nhất tùy ý hoặc phụ thuộc đã có booking trước đó.
- [ ] Chốt booking AUTO_SLOT, guest OTP, cancel/refund/no-show theo yêu cầu với mentor; AUTO_SLOT cho walk-in không tự chứng minh AUTO_SLOT booking đã hoàn thiện.
- [ ] API 401/403/409/503 phải hiện lỗi đúng; demo mode chỉ bật tường minh, không trả mock success khi backend từ chối.

**Gate M2:** tài khoản mới → thêm/xác minh xe → search → chọn slot → hold 5 phút → cash/VNPay → QR → check-in → quote → settle → Staff/camera xác nhận physical exit; đọc lại từ browser thứ hai khớp DB. Xe walk-in chạy được không cần booking giả.

### M3 — Giá, tìm kiếm và quản trị thật (P1, owner BE Parking/Payment + FE Manager/3D)

- [ ] Áp dụng radiusKm vào search trước giới hạn kết quả; kiểm tra availability theo dải thời gian mong muốn.
- [ ] Không xếp bãi chưa có giá thành CHEAPEST = 0; thống nhất estimate/booking/checkout và pricing oracle.
- [ ] Cache giá xét version/effective time và có invalidation; key hiện chỉ lot/type nên có rủi ro dùng giá sai ngày.
- [ ] Xây API tạo/sửa/publish/version pricing; snapshot phiên cũ giữ nguyên; UI chỉ cho cấu hình rule engine thực sự hỗ trợ. Không giả publish peak/grace/refund chưa triển khai.
- [ ] Xây CRUD lot/level/zone/slot/map và thay trạng thái operational có transaction/advisory lock/version/audit; bảo vệ slot đang occupied/reserved.
- [ ] Nối manager layout/pricing/staff/incident approvals, loại save giả. Phân quyền bắt buộc ở backend và test cross-lot/revoked/expired assignment.
- [ ] Tạo reports/KPI từ đúng owner: revenue/settled refunds ở Payment; traffic/occupancy ở Parking. Không query chéo DB từ service khác hoặc lấy doanh thu từ booking chưa trả tiền.
- [ ] Thực hiện audit private theo scope, CSV export thực; chốt format PDF/Excel nào bắt buộc thay vì tạo link giả.
- [ ] Kiểm tra 3D theo cấu trúc từng bãi, map coordinates, click-to-reserve, state realtime, chuyển bãi/tầng và cleanup tài nguyên.

**Gate M3:** publish giá/reload vẫn giữ dữ liệu; session cũ không đổi tiền; dashboard đối chiếu được với query tổng hợp có khoảng thời gian/múi giờ rõ; thay trạng thái slot đúng quyền và không phá occupancy.

### M4 — AI và chất lượng vận hành (P0 với dữ liệu giả, P1 với đánh giá model; owner AI + QA)

- [ ] Bỏ biển số cố định confidence 90% khi OCR thất bại (Python hiện có nhánh này); bỏ fallback biển số ngẫu nhiên ở adapter/FE live mode.
- [ ] Trả no-plate/low-confidence/unavailable và đưa Staff xác minh, không tự mở cổng.
- [ ] Đóng gói model/weights/dependencies để container khởi động ổn định; timeout, retry có giới hạn; health phân biệt process sống, DB ready và model/provider khả dụng.
- [ ] Đánh giá dataset OCR có ảnh không biển/mờ/nghiêng/xe máy/ô tô, báo accuracy/latency thật; không gọi mock là model đã đạt chuẩn.
- [ ] Forecast có baseline và đánh giá theo thời gian; assistant có nguồn, scope phiên, TTL, fallback đúng và injection tests nếu dùng LLM.

**Gate M4:** ảnh không đọc được không sinh biển giả; thiếu provider không dẫn đến payment/check-in thành công giả; có evidence model và manual fallback.

### M5 — CI, staging và nghiệm thu (P0/P1, owner QA + hạ tầng + toàn nhóm)

- [ ] Thêm GitHub Actions cho FE build/test, BE build/unit, PostgreSQL integration và schema migration; checkout hiện chỉ có GitLab CI.
- [ ] Chạy lại các PostgresFact bằng DB test riêng; skip phải hiển thị thành coverage gap hoặc fail release gate cho nhóm test bắt buộc.
- [ ] Chạy Playwright E2E trên stack Docker thật cho customer, staff, manager, admin và cross-lot denied.
- [ ] Chạy concurrency/load: 100 users, không double-book/double-settle; đo p95 common <1s, search <2s, booking <2s, realtime <1s theo requirements.
- [ ] Cấu hình staging domain/TLS, callback VNPay thật, trusted proxy/CORS/rate limits, persistent volumes, log/correlation và alert outbox/provider failures.
- [ ] Diễn tập backup → restore và upgrade → rollback theo image tag/commit; không cam kết rollback code nếu schema mới chưa tương thích.
- [ ] Phát hành tag với checklist đã pass, video demo xuyên suốt, tài khoản demo, runbook một đường chạy Docker.

**Gate release:** không còn P0; E2E và DB integration bắt buộc đều pass; không lấy số test unit thay bằng chứng nghiệp vụ. Core M0/M1/M2 là mốc đầu tiên; không chờ polish UI mới dựng staging.

## Chia công việc đề xuất

Đây là ước lượng **ngày công**, không phải cam kết ngày lịch; team cần hiệu chỉnh sau M0/M1.

| Gói | Owner theo chuyên môn | Ngày công dự kiến | Phụ thuộc |
|---|---|---:|---|
| M0 Payment compatibility/hardening | Payment + DB + QA | 2–3 | Bắt đầu ngay |
| M1 Docker reproducible stack | Hạ tầng + Identity + FE | 2–4 | Có thể song song M0, gate cần migration M0 |
| M2 Customer/Staff E2E | Parking + Identity + FE + Payment | 4–6 | M0/M1 |
| M3 Manager/pricing/reports/3D | Parking/Payment + FE Manager/3D | 5–8 | Contract chốt, core M2 ổn định |
| M4 AI truthful outputs/evaluation | AI + QA | 2–4 | Bỏ fake ngay; evaluation song song M2/M3 |
| M5 CI/staging/UAT/load/restore | QA + hạ tầng + team | 3–5 | CI bắt đầu từ M1; release gate sau M2–M4 |

Ưu tiên nếu hạn gấp: migration Payment → Docker ready → một luồng customer/staff thật → RBAC/payment/occupancy guards → manager dữ liệu thật → chất lượng và polish. MoMo không phải điều kiện chặn nếu phạm vi đã chốt VNPay/cash.

## Phần local có thể tái sử dụng có chọn lọc

- Rà stash để lấy các sửa config Docker/ports, HTTP transport tests, assignment DTO fix, QR key, seed demo và regression check-in.
- Đánh giá lại các API Management/Revenue còn dở trong stash trước khi port; chưa có chứng cứ nghiệm thu hoặc review để merge nguyên khối.
- Giữ thay đổi mới nhất của nhóm về AuthContext/UI/Payment; các vùng có overlap cần resolve theo contract hiện tại và chạy tests.
- Tách PR nhỏ: docker-bootstrap, payment-schema, payment-concurrency, customer-vehicle, staff-exit, pricing-management, reports, AI-fallback, CI-release.
- Không tự push/merge hoặc sửa Jira trong yêu cầu lập kế hoạch này.
