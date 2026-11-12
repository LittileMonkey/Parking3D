# Kế hoạch 2 tuần — nhóm 8 người

Thời gian đề xuất: **07–20/10/2026**, 10 ngày làm việc, giả định nghỉ thứ Bảy/Chủ Nhật. Nếu nhóm bắt đầu ngày khác, giữ thứ tự D1–D10 và dời lịch tương ứng. Kế hoạch chưa phải deadline đã được các thành viên cam kết.

Căn cứ: `PHAN_CONG_TASK_NHOM_8_NGUOI.md` do người dùng cung cấp, Baseline V4/V4.1, model README và trạng thái GitLab đã kiểm tra trong phiên này. Giữ nguyên vai trò TV1–TV8, không cắt database. TV1–TV8 là ký hiệu, chưa gán tên thật; không mặc định người ở nhánh `duc` là TV3.

## 1. Mục tiêu và giới hạn sprint

**Bắt buộc cuối sprint:** một bản tích hợp chạy trên PostgreSQL với 3 bãi khác cấu trúc; đăng ký/đăng nhập thật; phân quyền theo bãi; tìm gần nhất/rẻ nhất; Customer chọn xe và thời gian, đặt ExactSlot có PendingPayment/hold; cạnh tranh cùng slot chỉ một request giữ chỗ thành công. Giao diện hiển thị lỗi xung đột và giá dự kiến từ backend.

**Mục tiêu nối tiếp, chỉ nhận khi core đạt gate D5:** thanh toán trả trước qua sandbox xác thực được → Confirmed → QR → Staff check-in → session vật lý; map 3D cơ bản và SignalR cùng bãi. Nếu sandbox chưa đủ điều kiện, demo riêng trạng thái PendingPayment; có thể dùng payment simulator đã định nghĩa, gắn nhãn Development và kiểm thử luồng xác minh backend, không tuyên bố VNPay thật đã tích hợp.

Chưa cam kết toàn bộ check-out, overtime, walk-in, refund, AutoSlot, guest OTP và reporting hoàn thành trong 10 ngày. Vẫn giữ các chức năng và bảng này trong phạm vi dự án; sprint sau triển khai tiếp. Không bỏ qua trả trước để tạo Confirmed/QR trong demo booking.

**AI trong sprint:** chốt contract, bộ dữ liệu và nguồn hướng dẫn; chuẩn bị thu snapshot từ dữ liệu hợp lệ. Chưa yêu cầu cả 3 AI runtime hoàn thành. Không dồn map, CI, tích hợp và 3 AI vào TV8 trong cùng sprint.

## 2. Điều kiện phải chốt trong D1–D2

TV8 chủ trì, TV1/TV2 ghi quyết định, TV5–TV7 và FE cùng rà soát:

1. Một solution/backend chính thức và schema đích. DBML V4 snake_case và model EF hiện tại không được xem là tự động tương thích. Giữ phạm vi dữ liệu V4; lập mapping tên/entity/FK, ghi rõ bảng nào đã map, chưa map, migration nào đã chạy. Không chạy SQL V4 trực tiếp vào prototype/PascalCase, không DROP bảng để đồng nhất tên.
2. Nhánh tích hợp chính: GitLab hiện có `dev`, tài liệu quy định `develop`; nhóm ghi quyết định dùng nhánh nào trước MR. Mỗi story có `features/Design_<Story>` và `features/Implementation_<Story>`; tài liệu/API design đi trước implementation. Leader chốt remote GitHub team nếu chưa cấu hình; theo workflow nhóm GitHub trước rồi đồng bộ nhánh tích hợp GitLab và test trước push chính thức.
3. DTO/auth/envelope chuẩn `{result,isSuccess,statusCode,message}`, route `/api/v1`, health, mã lỗi và quyền. BE owner chốt contract, BA/FE review; mock FE phải bám đúng contract.
4. Arrival window, QR expiry, chính sách callback muộn/hủy và dữ liệu policy cần cho luồng demo. Policy nullable chưa chốt không được hiểu là 0 hay vô hạn. Hold mặc định baseline 15 phút nếu đã được xác nhận trong policy seed.
5. Giá demo: block tính phí, daily cap, peak multiplier, snapshot, đơn vị tiền và quy tắc làm tròn. Booking trả trước toàn bộ phí dự kiến; tiền đã trả phải được bù trừ vào phí cuối. Không tạo luồng khác với quyết định model chỉ để demo nhanh.
6. TV7 kiểm tra sớm tài khoản/secret/callback URL VNPay sandbox; secrets ở backend. Chuẩn bị đường thay thế Development được ghi rõ nếu hạ tầng chưa sẵn sàng.

## 3. Phân công theo đúng 8 vai trò

### TV1 — BA + Tester: Guest/Customer

**Tuần 1:**

- D1–D2: viết acceptance criteria cho register/login, xe Customer, search NEAREST/CHEAPEST và ExactSlot PendingPayment; phối hợp TV2/TV8 khóa các policy phụ thuộc.
- D2–D3: bộ test dữ liệu tọa độ, giá, thời gian không overlap/overlap, closed lot, slot maintenance và hết chỗ; review DTO/wireframe TV3.
- D4–D5: Postman collection + test case auth/search/booking; kiểm thử API sớm, ghi bug có bước tái hiện và expected/actual.

**Tuần 2:**

- Kiểm thử UI tích hợp, owner xe/booking, loading/error/empty và hold countdown.
- Phối hợp TV6 test concurrent booking và hold expiry; nếu payment/QR đạt gate thì test callback → QR và QR dùng lại cùng TV2.
- Soạn bộ câu hỏi người mới cho assistant: cổng vào, QR, tìm vị trí, thanh toán, ra bãi; ghi đáp án theo tài liệu, câu chưa có nguồn phải hỏi Staff.

**Đầu ra:** đặc tả Customer, collection có assertions, test report, bug/retest, traceability yêu cầu → API → test → kết quả. Không đánh dấu PASS nếu API chưa chạy hoặc chỉ là mock.

### TV2 — BA + Tester: Staff/Manager/Admin và tài chính

**Tuần 1:**

- D1–D2: ma trận quyền theo bãi, policy còn thiếu và luồng trả trước; review TV4/TV5.
- D3–D5: test assignment hiệu lực/hết hạn/thu hồi, bãi A/B, quan hệ level-zone-slot sai bãi; tập test tính phí theo bảng dữ liệu đã duyệt với TV7.
- Định nghĩa callback đúng/sai chữ ký, sai amount, duplicate, muộn sau hold; phối hợp TV6/TV7 chốt expected behavior.

**Tuần 2:**

- Test backend trả 403 khi sai bãi, không chỉ kiểm tra menu FE.
- Nếu gate đạt: test Staff check-in đúng bãi/booking/xe/thời gian, replay QR, một xe không có hai active sessions, manual override có audit.
- Tổng hợp regression và kịch bản demo; lập checklist OCR: ảnh rõ/mờ/nghiêng/không có biển, private upload, Staff review và không tự mở barrier.

**Đầu ra:** ma trận RBAC, test pricing/payment/gate, regression report, bộ ảnh OCR có quyền sử dụng/nhãn chuẩn và policy decision log cùng TV1/TV8.

### TV3 — FE1: Guest/Customer

**Tuần 1:**

- Review/tái sử dụng Homepage/Login/Register của nhánh `duc`; không xây lại nếu đáp ứng contract. Đây là phần được giao, không khẳng định tác giả nhánh thuộc vai trò TV3.
- Nối login/register thật, xử lý 401/token hết hạn và logout; auth state không dựa riêng vào user JSON lưu tại client.
- Xây trang danh sách bãi, bộ lọc loại xe/thời gian, chi tiết bãi, NEAREST/CHEAPEST với dữ liệu mock theo contract khi BE chưa xong.
- Sửa API client khỏi route slot prototype nếu contract mới đã chốt; DTO FE không sao chép entity/hash/secrets.

**Tuần 2:**

- Nối search/availability/price quote thật; chọn xe, ExactSlot và khoảng thời gian.
- Hiển thị PendingPayment, hold expiry, conflict 409, loading/error/empty; giá do backend tính.
- Nếu payment/QR đạt gate: nối chuyển hướng sandbox/kết quả và QR; không xác nhận paid từ query callback của trình duyệt.
- Tích hợp map của TV8 nếu đã sẵn; nếu chưa, dùng danh sách slot thật để không chặn booking UI.

**Đầu ra:** luồng Customer từ auth tới booking thật, build thành công, API client/types thống nhất, lỗi TV1 được retest.

### TV4 — FE2: vận hành/quản trị

**Tuần 1:**

- Admin/Staff layout và bộ chọn bãi theo danh sách được backend cho phép.
- Trang đọc cấu trúc lot → level → zone → slot; form CRUD tối thiểu lot/slot theo API TV5, validation và lỗi scope.
- Dựng màn hình Staff tra cứu booking, nhập QR/check-in theo DTO TV6; có thể dùng mock đã thống nhất.

**Tuần 2:**

- Nối API cấu trúc bãi và tra cứu booking; không hiển thị chức năng chưa có API như đã hoạt động.
- Nếu QR/check-in đạt gate: nối check-in, session/status và lỗi wrong lot/replay/not paid; cập nhật UI từ kết quả backend.
- Tích hợp SignalR hoặc refetch sau thao tác; dựng wireframe upload OCR và phần review biển số, chưa nhận là OCR runtime.

**Đầu ra:** portal chọn đúng bãi và xem/quản lý cấu trúc thật; màn Staff cơ bản; kiểm thử cùng TV2. Full dashboard/reporting và check-out hoàn chỉnh để sprint sau.

### TV5 — BE1: Identity/cấu trúc bãi

**Tuần 1:**

- D1–D2: mapping Identity/Parking, auth/vehicle/lot DTO, ma trận authorization handlers; phối hợp TV8 chạy migration core test.
- Register/login với password hash và token validation; không cho request tự cấp Admin/Manager.
- Seed 3 bãi khác cấu trúc, Customer/Staff/Manager/Admin demo và assignment bãi A/B; không commit mật khẩu thật.
- API đọc danh sách/chi tiết bãi, levels/zones/slots và xe Customer; CRUD tối thiểu lot/slot theo contract. Kiểm tra owner và FK cùng bãi.

**Tuần 2:**

- Hoàn thiện facility scope tại các API owner cần dùng; integration test 403/cross-lot/owner.
- Nối TV3/TV4 và sửa lỗi; công bố seed/reset database test an toàn.
- Viết contract guest OTP và expiry/attempt/consume; implementation OTP chỉ nhận thêm khi mục tiêu bắt buộc đã PASS.

**Đầu ra:** API auth/Identity/Parking đủ phục vụ sprint, migration module được TV8 điều phối, 3-lot seed và tests quyền/ownership.

### TV6 — BE2: Availability/Booking/Session

**Tuần 1:**

- D1–D2: state machine/transaction boundary với TV7; contract availability/ExactSlot/hold/QR/check-in.
- Mapping Bookings/Reservations/Sessions và guards PostgreSQL trên schema đã chọn, không sửa enum/value tùy ý.
- Availability theo time window, vehicle compatibility, operating hours và maintenance; ExactSlot tạo PendingPayment + reservation trong transaction có advisory lock.
- Chạy test đồng thời cùng slot, overlap biển số/xe và hai khoảng không overlap. Không thay time-window guard bằng unique active booking toàn thời gian.

**Tuần 2:**

- Hold expiry worker và xử lý release reservation đúng trạng thái; owner check/lookup booking.
- Nối payment confirmation TV7: xác minh đủ tiền rồi re-check tài nguyên trong transaction, có xử lý callback lặp và muộn.
- Nếu gate đạt: QR expiry/one-time use và Staff check-in tạo đúng một session; phát event sau commit, ghi audit với TV8.
- Chốt contract snapshot công suất với TV7/TV8: occupied vật lý khác reservation; chưa tạo dữ liệu ACTUAL từ mock.

**Đầu ra:** booking an toàn chạy PostgreSQL, test concurrency/hold, API tích hợp FE. AutoSlot/check-out/no-show/walk-in nâng cao theo backlog sprint sau.

### TV7 — BE3: Search/Pricing/Payment/Reporting

**Tuần 1:**

- D1 kiểm tra VNPay sandbox/callback cấu hình; D1–D2 chốt PriceQuote/snapshot/payment contract cùng TV6.
- Mapping Pricing/Finance, seed giá riêng 3 bãi; service estimate toàn duration theo block/daily cap/peak đang hỗ trợ.
- Haversine NEAREST, CHEAPEST theo estimate và availability TV6; test oracle giá/khoảng cách cùng BA.
- Chốt cách bù trừ trả trước/phí cuối; không coi FinalFee là số tiền còn thiếu.

**Tuần 2:**

- Nối search/price quote thật vào FE; lỗi invalid duration/type/closed lot được xử lý đúng.
- Nếu gate đạt: tạo payment sandbox; callback kiểm chữ ký, amount, transaction identity và idempotency; nối confirmation TV6. Kiểm tra riêng luồng callback thất bại/đến muộn, không chỉ happy path.
- Chốt schema/semantics occupancy snapshots, dữ liệu cần cho forecast; chuẩn bị baseline dự báo và kế hoạch holdout, chưa tuyên bố có AI dự báo hoạt động.

**Đầu ra:** API search/pricing đã test; payment sandbox có điều kiện hạ tầng; đặc tả dữ liệu forecast. Reporting nâng cao chưa nằm trong mục tiêu bắt buộc sprint.

### TV8 — Full-stack Leader

**Tuần 1:**

- D1–D2 chốt solution/schema/mapping matrix và nhánh tích hợp; chia ownership migration, contracts, shared files. Chỉ TV8 điều phối di chuyển layer, tránh nhiều BE cùng refactor cấu trúc.
- CI build/test, môi trường PostgreSQL test, CORS/OpenAPI/envelope/health và audit infrastructure tối thiểu.
- Review/tích hợp nhánh `duc` theo scope hợp lệ; không merge main trực tiếp, không bỏ test vì nhánh mang tên design.
- Chuẩn bị map contract/seed layout theo slot UUID; bắt đầu viewer 3D tối giản sau khi foundation ổn.

**Tuần 2:**

- D6–D8: viewer chọn bãi/level, click slot, màu trạng thái từ backend; SignalR group theo bãi và reconnect/refetch khi có budget. Không dùng FE làm nguồn sự thật.
- Review PR/integration hằng ngày; giúp giải lỗi liên module và release demo D10.
- Chốt owner AI: TV6 + TV4 + TV2 cho OCR/gate; TV7 + TV4 + TV2 cho dữ liệu forecast; TV8 điều phối adapter assistant, TV1 soạn nguồn và TV3 tích hợp UI ở sprint tiếp theo. Không bắt các owner hoàn thành AI runtime sprint này.

**Đầu ra:** solution/schema quyết định rõ, CI và bản tích hợp chạy được, migration phối hợp, 3D đơn giản nếu gate đạt, demo script/release notes và backlog sprint sau.

## 4. Lịch tích hợp và gate

| Ngày | Mốc | Điều kiện/đầu ra |
|---|---|---|
| D1 — 07/10 | Kickoff, xác minh code đã có | TV8 lập bảng thực trạng; BA ghi policy; BE kiểm tra schema/VNPay, không coi TODO tick là đã chạy. |
| D2 — 08/10 | Khóa foundation/contract | Chọn schema/solution/nhánh; mapping core, DTO/envelope, price/payment transaction boundary và seed policy được ghi rõ. |
| D3 — 09/10 | Build/migration/seed | CI xanh, database test tạo được; auth/lot/quote API đầu tiên sẵn cho FE. |
| D4 — 12/10 | Tích hợp đầu tiên | FE auth/list lot nối thật; pricing oracle và booking concurrency chạy trên PostgreSQL. |
| D5 — 13/10 | Gate tuần 1 | 3-lot seed, auth, scope 403, price quote và ExactSlot PendingPayment giữ chỗ an toàn. Nếu thiếu, D6–D8 ưu tiên sửa core; không nhận thêm AI/payment/map nâng cao. |
| D6 — 14/10 | Search + booking UI | Customer chọn xe/time/slot, nearest/cheapest; hold state và error 409 đúng. |
| D7 — 15/10 | Payment/QR có điều kiện | Backend xác minh payment trước Confirmed/QR; nếu hạ tầng chưa đủ, báo blocked và chỉ demo phần thật đã đạt. |
| D8 — 16/10 | Staff/map có điều kiện | QR check-in đúng bãi; viewer/SignalR theo khả năng; đóng scope tính năng sprint. |
| D9 — 19/10 | Regression + sửa bug | TV1/TV2 chạy suite; dev tập trung bug chặn demo, không thêm feature. |
| D10 — 20/10 | Retest/demo/handoff | Demo clean database, báo rõ phần thật/mock/chưa đạt, ghi backlog/estimate sprint tiếp theo. |

TV8 là owner mỗi gate; TV1 xác nhận luồng Customer, TV2 xác nhận scope/tài chính/vận hành. Một gate chưa đạt thì ghi vấn đề/owner/ETA, không đánh dấu hoàn thành theo ngày.

## 5. Dependency và cách tránh chờ nhau

- TV5/TV8 giao auth/lot/vehicle contract D2; FE dùng mock đúng DTO rồi đổi sang API thật D3–D5.
- TV7 giao price quote/snapshot contract D2; TV6 dùng interface, không tự viết công thức giá khác.
- TV6 giao availability/booking contract D2; TV7 ghép search và FE dựng form. BE vẫn phải tích hợp trước kết thúc sprint, mock không tính là nghiệm thu backend.
- TV6/TV7 cùng sở hữu transaction nối payment → confirmation; TV8 review. Callback chỉ phát event sau commit, không cập nhật Confirmed từ frontend.
- Map/SignalR không được chặn luồng booking: danh sách slot vẫn dùng cùng API thật; map bổ sung sau khi seed/UUID khớp.
- Mỗi module một owner migration; TV8 kiểm tra thứ tự và chạy lại database mới trước merge, không để mỗi người tự regenerate toàn schema.

## 6. DoD và demo cuối sprint

Task hoàn thành khi có code/design đúng scope, contract cập nhật, quyền backend, tests nghiệp vụ phù hợp PASS, PR review, BA retest và tích hợp chạy được. Một MR không tự đồng nghĩa một story đã nghiệm thu. BA bổ sung API request/response + activity/sequence theo APIDesignTemplate với BE owner; không giao BA sở hữu code BE.

**Demo bắt buộc:** khởi tạo database test → đăng nhập Customer → chọn bãi trong 3 bãi → chọn xe/time → so giá/khoảng cách → ExactSlot PendingPayment; hai request tranh cùng slot chỉ một giữ thành công → Staff bãi A bị từ chối khi thao tác bãi B → hold hết hạn giải phóng reservation, không giả tạo physical exit.

**Demo nối tiếp nếu đã đạt:** payment sandbox được backend xác minh → Confirmed → QR → Staff đúng bãi check-in một lần → session/slot occupied → map cập nhật. Không demo payment giả như VNPay đã thành công, không tạo QR hợp lệ cho booking chưa đủ điều kiện.

**Báo cáo AI:** bộ ảnh OCR có nhãn, nguồn FAQ đúng bãi, mapping 5 bảng AI và snapshot contract; ghi rõ chưa có model/runtime nếu chưa triển khai. Forecast dùng dữ liệu mô phỏng phải gắn SIMULATED, không gọi ACTUAL.

**Bàn giao sprint sau:** check-out/phí quá giờ/bù trừ/physical exit; AutoSlot; guest OTP; dữ liệu công suất; OCR runtime; assistant và forecast có kiểm chứng. Giữ nguyên phạm vi V4, không cần tạo thêm bảng/chức năng chỉ để đủ việc mỗi TV.
