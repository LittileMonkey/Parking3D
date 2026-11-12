# Parking Database V3 — MVP đề xuất

## Kết quả

V2: **54 bảng, 107 Ref**. V3: **42 bảng, 82 Ref**, chia 5 TableGroup để dễ xem. Đây là thiết kế mới phục vụ review, KHÔNG phải migration đã chạy và KHÔNG phải bản xuất từ PostgreSQL đã kiểm chứng. Không sửa file V2 gốc. Chưa có `01_schema.sql`, `02_integrity.sql` của V2 nên không kết luận các CHECK/trigger của V2 bị thiếu.

Import `Parking_Database_V3_MVP.dbml` vào công cụ hỗ trợ DBML để xem bản đầy đủ. Bản này dành cho modular monolith, không yêu cầu microservices.

## 1. Những gì giữ nguyên

- Đa bãi, tầng/khu linh hoạt; bãi outdoor có level logic riêng.
- Loại xe tương thích và policy riêng từng bãi/loại xe.
- Guest và Customer đều được bảo vệ reservation đã xác nhận; không ưu tiên ghi đè.
- Booking khác Session. Slot operational status khác reservation theo giờ và occupancy vật lý.
- Giữ session_slot_assignments và user_vehicle_access: không tự bỏ tính năng chuyển vị trí hoặc chia sẻ quyền dùng xe khi chưa được chốt.
- Giá theo bãi, phiên bản, rule, snapshot; nearest dùng Haversine, cheapest dùng tổng dự kiến cùng khung thời gian.
- Payment attempts, callback dedupe, refund và audit không bị gộp mất lịch sử.
- Giữ billing_accounts/billing_lines để bù trừ phí trả trước và phí cuối rõ ràng.
- Giữ devices/events/observations/issues để demo camera và vận hành; giữ outbox cho phát sự kiện bền vững.

## 2. 12 bảng hoãn sang extension

| Chức năng | Bảng không có trong V3 MVP |
|---|---|
| Vé tháng | subscription_plans, monthly_passes, pass_lot_access |
| Sạc EV | chargers, charging_sessions |
| Điều hướng trong bãi | navigation_nodes, navigation_edges |
| Đánh giá | reviews |
| Xác minh quyền xe đặc biệt | vehicle_permissions |
| Chứng cứ nâng cao | issue_evidence |
| Phạt cấu hình | penalty_rules |
| Lịch sử xuất báo cáo | report_exports |

Đây là hoãn phạm vi triển khai, không tuyên bố nghiệp vụ đó không tồn tại. Giữ file V2 làm nguồn thiết kế extension. Không chạy DROP trên database đã có dữ liệu. Đã bỏ cột monthly_pass_id ở billing_accounts và monthly_quota_slots ở lot_vehicle_policies cùng các Ref liên quan.

Ảnh hưởng giao diện/API: không bán vé tháng, không tính phí sạc hay phạt tự động, không hiển thị chức năng đánh giá/đường đi nội bộ chưa hỗ trợ. Báo cáo vẫn có thể truy vấn trực tiếp. Slot có EV feature không đồng nghĩa có charging session. Accessible/priority chưa có workflow xác minh: không nhận booking tự phục vụ cho slot yêu cầu quyền này; không tự cấp quyền qua một cờ trên FE.

## 3. Cải thiện cấu trúc

### Mã khu và slot

- zones: UNIQUE(level_id, code), thay cho UNIQUE(lot_id, code).
- parking_slots: UNIQUE(zone_id, code), thay cho UNIQUE(lot_id, code).
- Cho phép B1/khu A/A01 và B2/khu A/A01 cùng tồn tại. API vẫn định danh bằng UUID; UI hiển thị đầy đủ tầng/khu/mã khi cần. Camera không được resolve bằng lot_id + slot_code đơn lẻ nữa: cần slot UUID hoặc level/zone/code.

### Bản đồ đúng tầng

Thêm parking_slots.level_id. Cột này được lặp có chủ đích và có FK `(zone_id, lot_id, level_id) -> zones(id, lot_id, level_id)`. Map object tham chiếu `(slot_id, lot_id, level_id) -> parking_slots(id, lot_id, level_id)`, tránh slot B1 được vẽ nhầm ở B2. Giữ các composite unique vì chúng là đích của FK đảm bảo cùng bãi, không xóa chỉ vì UUID đã unique.

### Lịch mở cửa

Giữ 2 cột phút, quy ước rõ là phút trong TUẦN địa phương theo timezone của bãi:

- Thứ Hai 00:00 = 0; Chủ Nhật 24:00 = 10080.
- Khoảng nửa mở [start_minute, end_minute), start < end.
- 24/7 = một dòng [0,10080). Không có dòng = chưa mở phục vụ.
- Thứ Hai 08:00–22:00 = [480,1320).
- Chủ Nhật 22:00–Thứ Hai 02:00 = [9960,10080) và [0,120).
- lot_closures là các khoảng đóng bất thường theo timestamp, được trừ khỏi lịch thường.

Đây là quy ước V3 được chọn để loại bỏ mơ hồ. Khi chuyển dữ liệu V2 phải xác minh đơn vị cũ; KHÔNG diễn giải số phút V2 thành phút/tuần tự động. Chuyển local time sang instant phải theo timezone, không giả định UTC offset cố định cho mọi bãi.

### Guest và xe

Giữ vehicle_id bắt buộc của V2. Guest được tìm/tạo identity xe theo (plate_country, plate_normalized), không cần tạo app_user; vehicle record không chứng minh quyền sở hữu xe. Customer cần user_vehicle_access hợp lệ; guest cần contact đã xác minh theo policy. Snapshot biển số giữ lịch sử. Không cho guest tự cấp quyền truy cập tài khoản xe chỉ vì biết biển số.

### Billing rõ chủ thể

Một billing account cho một lượt gửi:

1. Booking-only trong lúc chưa vào bãi.
2. Session-only cho walk-in.
3. Booking + Session khi đã check-in, nhưng session phải liên kết đúng booking đó, cùng lot và vehicle.

Không cho cả booking_id và session_id null. Không áp XOR hai trường vì trường hợp 3 hợp lệ. Attach session vào account cũ thay vì tạo account thứ hai cho cùng lượt. Các UNIQUE hiện tại hỗ trợ một account/booking và một account/session; việc đối chiếu cặp cần SQL/service transaction.

billing_lines là phí/điều chỉnh; payments là tiền đã thu; refunds là tiền hoàn. Thanh toán trước KHÔNG được ghi thêm một dòng phí trùng phí đỗ. Công thức đối soát: dư nợ = tổng charge/credit hợp lệ - tổng tiền thu thành công + tổng hoàn thành công. Không dùng amount của payment gốc cộng lần nữa khi status PARTIALLY_REFUNDED; tính tiền thu và hoàn theo các giao dịch thực tế. Billing lines sửa sai bằng dòng điều chỉnh, không xóa lịch sử. Chốt line_kind, dấu amount và quy tắc hoàn phí/hủy trước khi triển khai.

### Enum quan trọng

Thêm enum cho Booking status/mode, Session status, Reservation status, Slot operational status, Payment status/method, Map version status. MVP dùng EXACT_SLOT/AUTO_SLOT; LOT_ONLY vẫn là extension cần capacity reservation riêng. Các cột status khác giữ text nhưng phải có CHECK/danh mục hợp lệ trong SQL; không coi text là cho phép mọi giá trị.

## 4. Ràng buộc bắt buộc trước khi dùng database thật

DBML thể hiện cấu trúc và FK, không thay cho các ràng buộc dưới đây. Checklist này là yêu cầu triển khai, chưa phải SQL đã thực thi.

| Phạm vi | Ràng buộc cần thực hiện |
|---|---|
| Booking | starts_at < ends_at; duration mặc định 30–1440 phút; pending hold mặc định 15 phút; policy được snapshot. Arrival window lấy cấu hình, không tự thêm hằng số mới. |
| Slot reservation | Không chồng [start,end) trên cùng slot khi HELD/CONFIRMED bằng constraint chống overlap; chỉ một reservation hiệu lực mỗi booking EXACT/AUTO. Lưu lịch sử RELEASED khi đổi slot. |
| Vehicle booking | Không chồng thời gian PENDING_PAYMENT/CONFIRMED trên cùng vehicle qua các bãi; chuẩn hóa identity guest. |
| Expiry | Giao dịch đặt/confirm phải xử lý hold quá hạn và re-check. Scheduler hỗ trợ cleanup; không giả định thời gian trôi tự đổi status trong DB. EXPIRED khác NO_SHOW. |
| Concurrency | Khóa/check trong transaction tại create/confirm/check-in/exit. Không dùng kết quả availability từ FE làm chứng cứ độc quyền. |
| Session | Tối đa một ACTIVE/EXIT_PENDING mỗi vehicle; mỗi session hoạt động có đúng một assignment chưa vacated. |
| Assignment | Tối đa một assignment mở mỗi slot và session; không chồng các khoảng chiếm chỗ trong lịch sử. Đổi slot nguyên tử, giữ audit và kiểm tra reservation. |
| Physical exit | Payment success không giải phóng slot. Chỉ exit hợp lệ đặt exit_at, đóng assignment và hoàn tất session; tính lại phí nếu xe ở lại. |
| Operational state | Slot maintenance/disabled không nhận mới; confirmed booking bị ảnh hưởng phải có reallocation/issue, không hủy im lặng. UNKNOWN occupancy phải xác minh trước admission. |
| Opening hours | 0 <= start < end <= 10080; không chồng khoảng cùng bãi; xét closures, timezone và toàn khung đặt. |
| Policies | hold/min/max dương; min <= max; early/late/cutoff >= 0; reserved_capacity >= 0; 0 <= warning <= admission <= 100; multiplier cap không vượt giới hạn nghiệp vụ 1.5. |
| Maps | Một PUBLISHED map mỗi bãi; slot object có slot_id và đúng type, đúng level; size hợp lệ. Object gate/slot nullability theo loại. |
| Pricing | Không chồng plan hiệu lực cùng lot/type theo chính sách ưu tiên; snapshot bất biến; params theo rule_type có schema. Validate mức phí, billing unit, multiplier. |
| Money | Currency nhất quán account/payment; tiền nguyên VND, không float; payments/refunds amount > 0; billing lines theo dấu được định nghĩa. |
| Billing | Account có booking hoặc session; nếu có cả hai phải là cùng lượt. Guest/walk-in vẫn có canonical vehicle. |
| Payments | idempotency key và provider references unique; callback chỉ xử lý sau xác thực; khóa chống retry thu vượt nghĩa vụ. CASH phải có collected_by và assignment hợp lệ. |
| Refund | Tổng các khoản hoàn đã thành công và đang giữ quyền hoàn không vượt số thu; xử lý đồng thời bằng khóa. Hủy trước start >60 phút eligible hoàn đủ theo snapshot; <=60 phút không hoàn theo baseline. Request chưa đồng nghĩa SUCCESS. |
| Webhook | Liên kết attempt/refund phải nhất quán provider/payment. Không thay đổi trạng thái đã final bằng callback cũ; lưu callback không khớp để đối soát. |
| QR | Nonce/hash, expiry, revoke và one-time use; kiểm tra đúng bãi/xe/booking, không chỉ parse được QR là cho vào. |
| RBAC | STAFF/MANAGER từ assignment theo bãi còn hiệu lực; ADMIN từ platform role. Không tin role hoặc lot_id do FE gửi. |
| Observations | Dedupe device event, confidence 0..1; bỏ sự kiện cũ; sự kiện slot không tự thay cho entry. Conflict tạo issue, không tự phạt hay phá booking. |
| Outbox/audit | Ghi outbox cùng transaction nghiệp vụ khi cần phát sự kiện; consumer dedupe/retry. Audit tài chính, giá, quyền và thao tác thủ công. |

Các index phục vụ tìm kiếm (lot/status/time, booking/customer/time, session/lot/status, audit/lot/time, tọa độ...) cần thiết kế theo truy vấn thật; số Ref giảm không phải bằng chứng hiệu năng tăng. Cần test execution plan khi có dữ liệu.

## 5. Chuyển từ V2

1. Chỉ dùng V3 cho database mới hoặc migration được review. Backup dữ liệu V2 nếu đã có DB.
2. Kiểm kê dữ liệu 12 bảng hoãn; lưu trữ và chặn workflow liên quan, không DROP dữ liệu tự động.
3. Backfill parking_slots.level_id từ zone; kiểm tra orphan/mismatch trước khi thêm NOT NULL và composite FK mới.
4. Kiểm tra map object level so với slot/zone; sửa mapping theo thực tế trước khi áp FK.
5. Thay unique code; cập nhật API lookup, import camera, UI label sang UUID hoặc đường dẫn đầy đủ.
6. Xác minh ý nghĩa phút của V2 rồi chuyển opening intervals. Không sửa hàng loạt theo phỏng đoán.
7. Kiểm kê giá trị text trước khi convert enum. LOT_ONLY hiện có phải xử lý riêng, không đổi mode im lặng.
8. Đối soát billing account booking/session, tiền thu/hoàn. Không xóa billing_lines để rút bảng.
9. Áp và test đầy đủ constraint SQL, authorization service, concurrency; DBML không đủ để triển khai production.

## 6. Bộ ca nghiệm thu tối thiểu

- Hai bãi, nhiều tầng có cùng zone A và slot A01 hợp lệ; trùng code trong cùng zone bị từ chối.
- Map slot ở sai tầng hoặc sai bãi bị FK từ chối.
- Chủ Nhật qua Thứ Hai, mở 24/7 và khoảng đóng đột xuất cho kết quả availability đúng.
- Hai transaction cùng đặt một slot: chỉ một thành công; hai khoảng tiếp giáp không overlap.
- Cùng xe đặt trùng qua hai bãi bị chặn; guest không có account vẫn đặt được theo policy.
- Hold hết hạn không confirm được; không nhầm thành NO_SHOW.
- Walk-in tạo session và billing account không booking; booking check-in attach vào account cũ.
- Callback lặp, callback muộn sau expiry, payment retry và refund đồng thời không thu/hoàn trùng.
- Trả tiền nhưng xe chưa ra: slot vẫn occupied. Exit xác nhận mới giải phóng.
- Nhân viên bãi A không thao tác bãi B; sửa giá không thay snapshot phiên cũ.
- Sự kiện camera cũ/không khớp tạo đối soát, không tự mở barrier hoặc phạt.

## 7. Lộ trình làm nhóm

Thiết kế 42 bảng không có nghĩa phải viết 42 màn CRUD. Domain chính: Identity (8), Facilities/Map (13), Booking/Operation (5), Pricing/Payment (9), Monitoring (7). Dùng TableGroup để đọc từng cụm; nhóm Monitoring có thể triển khai sau happy path nhưng phải có trước nghiệm thu simulator/audit. Bài API GetById hiện tại vẫn dùng mock; schema này là bước chuẩn bị BE, không yêu cầu nối toàn bộ cùng lúc.
