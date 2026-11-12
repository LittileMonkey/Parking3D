# Đối chiếu nghiệp vụ SRS / Baseline — 12-11-2026

> Cập nhật mới nhất cùng ngày: năm phần OTP/MFA, refund, grace, notification và production đã được bổ sung ở mức mã nguồn. Xem [COMPLETION_API_2026-11-12.md](COMPLETION_API_2026-11-12.md) và [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md). Các mục tồn đọng/lần kiểm thử bên dưới là lịch sử; không chứng minh thay đổi mới đã được chạy. Chưa build/test/migrate/deploy trong đợt này.

## Phạm vi và nguồn

Đây là kết quả đọc đặc tả và sửa mã nguồn, **không phải biên bản nghiệm thu**. Theo yêu cầu người dùng, lượt sửa này không chạy build, test, Docker hoặc migration. Kết quả kiểm thử cũ trong READINESS_2026-11-12.md không xác nhận các thay đổi mới.

Nguồn:
- `D:/OJT26_PARK_AUUA/SRS-Parking-System.md` (SRS mentor).
- `D:/OJT26_PARK_AUUA/context.md` (ngữ cảnh mentor).
- `docs/Parking_OJT_FA26_Baseline_V4_Multi_Parking.md`, `01-REQUIREMENTS.md`, `02-BUSINESS-RULES.md`, `05-API.md`.

Ưu tiên baseline OJT và cập nhật cụ thể khi khác SRS tổng thể: hold 5 phút theo SCRUM-100 thay cho 15 phút. Không tự mở rộng đồ án thành toàn bộ roadmap AI, K8s, thiết bị IoT thật hoặc mọi cổng thanh toán trong SRS. SRS tự mâu thuẫn về ưu tiên sensor/manual giữa §3.2.2 và §5.2; thay đổi này không cho thao tác tay xóa occupancy vật lý.

## Những phần đã sửa trong mã nguồn

| Nghiệp vụ / nguồn | Thay đổi | Giới hạn còn lại |
|---|---|---|
| Phạm vi bãi — baseline §3.2 | API mới kiểm quyền theo lot; roster không trả email/điện thoại; handover không suy ra quyền quản lý bãi từ role toàn cục | Cần nghiệm thu các tài khoản nhiều vai trò khi cho phép chạy lại |
| Tìm kiếm — baseline §7, SRS §3.3 | Dùng đúng khoảng thời gian yêu cầu, giờ mở cửa/đóng bãi; lọc bán kính Haversine; không hiện giá miễn phí giả khi thiếu biểu giá | Chưa kết luận bộ lọc tiện ích/feature và recommendation hoàn chỉnh |
| Biểu giá — SRS §3.5, baseline pricing | API xuất bản phiên bản mới, expectedVersion chống ghi đè, audit; giữ snapshot cũ; FE lưu thật và xem lịch sử | Mới hỗ trợ FLAT_BLOCK; không phải toàn bộ gói vé/tháng/chính sách trong SRS |
| Cách tính tiền | Search, booking dùng BlockPrice; checkout snapshot FLAT_BLOCK dùng cùng cách tính, trần theo ngày, cao điểm tối đa 1.5 | Không đồng nghĩa đã có grace miễn phí mỗi người/ngày hoặc mọi nhánh GoldStar |
| Ô đỗ — baseline §4/BR-23 | FE đọc slot thật; chỉ đổi ACTIVE/MAINTENANCE/DISABLED, bắt buộc lý do, khóa và audit/outbox; từ chối khi có xe/đặt chỗ | Chặn bảo trì ô đã đặt; chưa có tự chuyển ô và bồi hoàn khi hết chỗ |
| Báo cáo — SRS §3.8 | Dashboard, thu tiền mặt/điện tử/hoàn tiền/thu ròng, lượt vào/ra, thời lượng từ DB; CSV thật | Không phải đối soát quỹ ca, hóa đơn thuế, PDF/Excel chuyên dụng hoặc user analytics đầy đủ |
| Audit | API nhật ký Parking theo bãi và khoảng thời gian | Tối đa 1000 dòng; chưa hợp nhất audit Identity/Payment |
| Ca và bàn giao | Lưu ca thật, chọn người đang có ca tại bãi, xác nhận đúng người nhận, khóa/kiểm phiên bản; đóng ca giao khi xác nhận | Cần bổ sung vòng đời ca không có người nhận/đối soát tiền nếu mentor yêu cầu |
| Sự cố/phê duyệt | Manager xem sự cố thật, gửi quyết định với phiên bản/lý do/bằng chứng | Phê duyệt sự cố không tự hoàn tiền, miễn phí hoặc mở barrier |
| Giao diện | Bỏ dữ liệu giả ở adapter Manager/Staff và các màn hình đã viết lại; lỗi API không trả thành công giả | Không khẳng định mọi trang còn lại đã đạt SRS |

Báo cáo tiền dùng thời điểm thành công của từng giao dịch trong `[from, until)`: tiền thu trong kỳ trừ tiền hoàn thành công trong kỳ. Một kỳ có thể âm khi hoàn tiền giao dịch kỳ trước. Occupancy là hiện tại, không phải tỷ lệ lấp đầy trung bình lịch sử. FE hiện dùng múi giờ trình duyệt cho ranh giới báo cáo.

## Khoảng trống chưa được đánh dấu hoàn thành

1. Chốt và hoàn thiện booking AUTO_SLOT/LOT_ONLY trên toàn luồng khách; hủy booking, mức phí hủy/no-show và hoàn tiền tương ứng. AUTO_SLOT cho walk-in đã có nhưng không chứng minh booking AUTO_SLOT hoàn chỉnh.
2. Grace 15 phút theo người/ngày, điều kiện đỗ qua đêm, ưu đãi: cần nối policy, danh tính và fee engine thống nhất; không suy ra hoàn thành từ một hàm tính tiền.
3. Khi bảo trì ảnh hưởng đặt chỗ: lựa chọn ô tương đương, cập nhật reservation nguyên tử hoặc hủy/hoàn tiền có lý do. Hiện trả 409 để giữ an toàn dữ liệu.
4. OTP thất bại 3 lần/khóa 15 phút, guest OTP, giới hạn xe, MFA tùy chọn và bảo vệ dữ liệu định danh: chưa có đối chiếu hoàn tất từng yêu cầu SRS §3.1/§4.3.
5. Thông báo bền vững và retry; đối soát VNPay/refund; xử lý sự kiện trùng, đến muộn và lỗi giữa dịch vụ. Chưa thể gọi là luồng thanh toán hoàn chỉnh theo SRS.
6. CRUD quản trị cấu trúc/đóng bãi, hiệu lực layout, đồng bộ realtime và phân quyền toàn bộ màn hình cần đối chiếu tiếp theo từng use case.
7. Production: domain/TLS, cấu hình secrets, backup/restore, migration/rollback, giới hạn truy cập DB/cổng nội bộ và monitoring. Compose Development hiện tại không phải cấu hình production.

Các mục trên là tồn đọng hoặc chưa đủ bằng chứng mã nguồn để kết luận, không phải tính năng đã được chứng nhận thiếu hoàn toàn. Không xác nhận “đúng hết SRS” chỉ bằng việc API có endpoint.

## Áp dụng thay đổi sau này

Migration mới: `database/services/parking/migrations/004_staff_shifts.sql`; schema cài mới cũng có bảng này. `scripts/microservices/Start-DockerTest.ps1` đã đưa migration vào danh sách. Chưa chạy migration trong lượt này. Không xóa volume/DB để cập nhật.

Mã nguồn FE/BE mới cần build/restart trước khi có hiệu lực. Tài khoản ca cũ không tự được tạo ca; nhân viên dùng nút bắt đầu ca. Biên bản lịch sử dùng ID ca giả không được coi là ca đang hoạt động.

Xem `OPERATIONS_API_2026-11-12.md` cho API, request/response và luồng xử lý.
## Lượt sửa tiếp theo theo quyền hoàn thiện toàn dự án

Các thay đổi dưới đây bổ sung cho bảng trước; vẫn là source-only, không chạy test/build/migration/container.

- **Booking AUTO_SLOT:** chọn ô tại server dưới khóa dùng chung với exact booking; giữ idempotency, quyền xe, khung giờ, loại xe và exclusion constraints. FE có chọn chế độ. LOT_ONLY chưa triển khai và không giả làm AUTO_SLOT.
- **Xe mới từ Identity:** thêm RPC GetRegisteredVehicle, xác minh tài khoản/xe đăng ký trước khi đồng bộ bản ghi sang Parking. Chuẩn hóa biển số; chặn trùng biển số với ID khác, khác tài khoản, thay đổi biển/loại xe có lịch sử và xe đã bị vô hiệu hóa. Đây là xác minh liên kết đăng ký trong hệ thống, không thay thế giấy tờ chứng minh sở hữu xe thật. Nhánh đổi thông tin xe đã có lịch sử cần Staff xử lý.
- **Hủy booking:** chủ booking có thể hủy PENDING_PAYMENT/CONFIRMED nếu chưa có session; khóa vehicle/slot/booking, giải phóng reservation, thu hồi QR, ghi audit và lưu điều kiện xét hoàn tiền. Snapshot mới lưu cutoff; booking cũ dùng policy hiện tại vì trước đây không snapshot cutoff. Điều kiện là strictly greater than cutoff, mặc định cấu hình hiện tại 60 phút.
- **Đối soát hủy:** khách thấy trạng thái bền vững; Manager thấy 200 đơn hủy gần nhất và khoản thu Parking đã nhận sự kiện. Không đánh dấu tiền đã hoàn; REVIEW_REQUIRED cần nghiệp vụ Payment/provider tiếp theo. Khoản thu có thể đến muộn. Chưa có chuyển tiền tự động hoặc tự hoàn tất refunds ledger.
- **No-show:** worker xử lý CONFIRMED quá arrival_deadline, khóa và kiểm tra lại, không nhả chỗ có xe vật lý; thu hồi QR, lưu NO_SHOW và audit. Không tự hoàn tiền no-show.
- **Chuyển ô (BR-23):** Staff/Manager có giao diện chọn booking và ô đích; kiểm tra cùng bãi/loại xe, đặc tính tương đương, không thêm ô đặc quyền ngoài quyền của ô nguồn, target trống toàn khoảng đặt. Giữ snapshot giá, giờ và booking; không di chuyển session. Không có ô tương đương thì 409, giữ nguyên booking để nhân viên xử lý. Khóa maintenance vẫn từ chối nếu còn booking chưa chuyển.
- **Realtime reservation:** migration tạo outbox khi thêm/sửa/nhả/chuyển reservation. Worker đọc trạng thái DB hiện tại trước khi phát để event cũ không đè trạng thái hiện tại. Physical occupancy vẫn có ưu tiên.
- **OTP reset mật khẩu:** đổi 5 lần thành 3 lần sai, khóa tài khoản 15 phút, serialize theo email trong DB, lưu lần sai trước khi trả lỗi. Resend và reset dùng chung lock. Không còn dùng memory cache làm nguồn quyết định số lần sai. Chưa coi đây là hoàn thành OTP đăng ký/login/MFA; bộ đếm hiện theo từng OTP, không tổng hợp qua nhiều lần cấp mã.
- **Giới hạn xe:** Vehicles:MaxPerUser mặc định 10, cấu hình 1..100; khóa transaction theo user khi tạo xe để hai request không vượt quota. Bỏ log ChangeTracker ra console.
- **Docker FE:** thêm Dockerfile/Nginx và service frontend cổng loopback 3000; API và SignalR cùng origin; SPA fallback; không copy .env vào build context. AI vision cổng host chỉ bind loopback. Đây là cấu hình Development, chưa phải TLS/public production.

Migration bổ sung: `005_booking_cancellations.sql`, `006_reservation_realtime.sql`, đã thêm vào schema mới và Start-DockerTest. Không chạy trên DB trong lượt sửa.

### Phần vẫn chưa được coi hoàn tất

Thanh toán hoàn tiền/provider reconciliation; LOT_ONLY; guest OTP/đăng ký OTP/MFA; grace theo người/ngày; các notification bền vững; quản trị layout/đóng bãi và các yêu cầu triển khai production vẫn cần hoàn thiện. Các thay đổi mới không phải bằng chứng toàn bộ SRS đã đạt. Chi tiết API bổ sung ở `BOOKING_LIFECYCLE_API.md`.
