# Models — ParkingSystem

Các entity C# cho MVP đa bãi, theo Baseline V4, Diagrams V1 và quyết định của nhóm. Mỗi class/enum nằm trong một file. Namespace chung: `ParkingSystem.Models`. Folder dùng để phân nhóm nghiệp vụ.

## Cấu trúc

- Common: Entity (Guid, CreatedAt, UpdatedAt).
- Enums: vai trò và trạng thái; số enum được gán tường minh, không đổi số khi đổi tên.
- Identity: User, Vehicle, FacilityStaffAssignment, OtpChallenge.
- Parking: ParkingLot, ParkingLevel, Zone, ParkingSlot, SlotFeature, ParkingSlotFeature, EntranceExit, OperatingHours, ParkingPolicy.
- Maps: MapVersion, MapObject.
- Bookings: Booking, SlotReservation, ParkingSession, QRToken.
- Pricing: PricingPlan, PricingRule, PricingSnapshot.
- Payments: Payment, PaymentTransaction.
- Operations: AuditLog, Notification, CameraEvent, ParkingIssue.

## Phân quyền rõ hai cấp

| Quyền | Nơi lưu | Phạm vi |
|---|---|---|
| Customer | User.PlatformRole = Customer | Xe và booking của chính người dùng |
| Admin | User.PlatformRole = Admin | Quản trị toàn nền tảng |
| Staff | FacilityStaffAssignment.Role = Staff | Vận hành bãi được phân công |
| Manager | FacilityStaffAssignment.Role = Manager | Quản lý bãi được phân công |
| Guest | Không có User/role riêng | Truy cập booking bằng cơ chế xác thực guest, không dựa vào ID đoán được |

Một User có thể có nhiều assignment ở các bãi khác nhau. User của nhân viên vẫn có PlatformRole Customer; quyền làm việc được bổ sung qua assignment. Không dùng role Manager toàn cục để cấp quyền mọi bãi.

Assignment hợp lệ khi user Active, ActiveFrom <= now, ActiveTo null hoặc now < ActiveTo, và RevokedAt null. Khoảng thời gian dùng [from, to). Manager chỉ quản lý phân công nếu được ủy quyền qua CanManageStaffAssignments. Flag này không cấp quyền cho Staff. Không được tự cấp Admin qua thao tác phân công bãi. Cần chốt phạm vi ủy quyền gán Manager khi triển khai service.

Các enum/entity CHỈ biểu diễn dữ liệu, chưa thực thi authorization. API phải dùng policy/authorization handler, kiểm tra chủ sở hữu và assignment theo ParkingLotId ở backend. Không nhận entity User/Assignment trực tiếp làm request: DTO phải loại bỏ role, hash và quyền mà người gọi không được sửa.

## Quyết định nghiệp vụ đã chốt

- Guest xác minh điện thoại + biển số bằng OTP trước khi tạo booking.
- OTP mô phỏng chỉ trong Development. MaxAttempts = 5 là mặc định kỹ thuật đề xuất, có thể cấu hình; không phải yêu cầu nghiệp vụ đã chốt.
- CodeHash phải là keyed hash/HMAC; khóa lưu ngoài DB. Chặn resend abuse và atomically kiểm tra/increment attempts, consume challenge khi tạo booking. Mỗi challenge chỉ cấp quyền cho một booking, đúng phone/plate/purpose; mã mới phải vô hiệu mã cũ theo policy.
- Guest và Customer trả trước toàn bộ giá dự kiến. Booking PendingPayment chỉ Confirmed sau xác minh đủ tiền và re-check tài nguyên; phí 0 cần luồng riêng nếu được cho phép.
- ExactSlot/AutoSlot đều có reservation trước khi xác nhận. Không có LotOnly trong MVP.
- SlotReservation lưu khoảng thời gian và lịch sử đổi slot, không gộp vào trạng thái vật lý ParkingSlot.
- Về sớm không hoàn phần chưa dùng; quá giờ tính thêm theo snapshot đã cam kết, thanh toán trước khi ra.
- Session ExitPending vẫn chiếm slot. Chỉ đặt ExitedAt/Completed sau xác nhận xe rời.
- QuotedTotal là tổng phí dự kiến; FinalFee là tổng phí cuối, không phải số còn thiếu. Service phải bù trừ payment thành công/hoàn tiền để không thu hai lần.
- Gói tháng, sạc, review, navigation và penalty nâng cao ở giai đoạn sau; chưa tạo entity cho các phần này.
- Policy chưa chốt (hủy/hoàn tiền, arrival window, QR expiry, exit grace) để nullable. Null nghĩa là chưa cấu hình, không phải 0/miễn phí/vô hạn. Service phải yêu cầu cấu hình trước khi bật luồng phụ thuộc.
- RequireFullPrepayment, RefundUnusedTimeOnEarlyExit, ChargeOvertime biểu diễn chính sách đã chốt; API MVP không cho đổi tùy ý.

## Cần làm trong DbContext/migration trước khi dùng DB

Chưa có DbContext, migration hoặc thay đổi database trong lần tạo model này. DataAnnotations không thay thế cấu hình EF, CHECK constraint hay validation nghiệp vụ. Không chạy EnsureCreated để bỏ qua bước thiết kế schema.

1. Cấu hình entity độc lập (không DbSet<Entity>, không map toàn bộ thành một bảng kế thừa). Map enum nhất quán, precision cho kích thước/tiền, SupportedVehicleTypes thành primitive collection phù hợp provider PostgreSQL. Các timestamp ghi UTC (offset 0), giờ mở cửa là giờ địa phương theo TimeZoneId.
2. Cấu hình quan hệ tường minh, đặc biệt các FK cùng trỏ User (assignment.User/AssignedByUser, issue.ReportedByUser/ResolvedByUser); dùng Restrict/NoAction cho lịch sử tài chính, audit và nghiệp vụ. Không cascade xóa lịch sử khi xóa tài khoản/bãi/xe.
3. One-to-one: ParkingLot–ParkingPolicy; Booking–ParkingSession (FK ParkingSession.BookingId); Booking–PricingSnapshot (FK PricingSnapshot.BookingId); ParkingSession–PricingSnapshot (FK PricingSnapshot.ParkingSessionId). Snapshot phải gắn ít nhất một booking/session; nếu cả hai thì session thuộc booking đó. Snapshot bất biến sau cam kết.
4. Unique: lot.Code; (lot,level.Code); (level,zone.Code); (zone,slot.Code); feature.Code; (slot,feature); (lot,gate.Code); (lot,dayOfWeek); (lot,map.VersionNumber); (lot,pricing.VersionNumber); BookingCode; Payment.IdempotencyKey; QR nonce hash. Chuẩn hóa email/phone/biển số và chốt quy tắc unique user/vehicle trước migration.
5. Chỉ một map Published mỗi bãi; (mapVersion,slot) unique khi slot không null. MapObject loại ParkingSlot phải có ParkingSlotId; loại khác không có FK slot. Map, level, slot phải cùng bãi.
6. Exclusion constraint chống reservation Held/Confirmed chồng [ReservedFrom,ReservedUntil) trên cùng slot. Worker chuyển hold hết hạn sang Released trong transaction; không dùng now() trong predicate của index. Đồng thời chống booking xe/biển số chuẩn hóa chồng thời gian xuyên bãi.
7. Partial unique cho một session Active/ExitPending trên mỗi slot và biển số chuẩn hóa; BookingId unique khi khác null. Booking guest bắt buộc phone/plate và challenge verified, unexpired, chưa consume; GuestOtpChallengeId unique khi khác null.
8. Payment CHECK đúng một BookingId hoặc ParkingSessionId, amount không âm; transaction refund không vượt số đã thu. Unique (provider,providerReference) và (provider,eventKey) khi có giá trị, request reference theo provider. Chốt granularity event trước mapping nếu gateway phát nhiều sự kiện cho một transaction. Callback phải verify chữ ký/idempotency. Cash cần staff hợp lệ và audit.
9. CHECK các khoảng thời gian hợp lệ, version dương, OTP attempts hợp lệ, confidence trong [0,1], scale/kích thước hợp lệ. Validate enum, json pricing rule, currency, giờ hoạt động (closed/24h/interval loại trừ nhau), policy bounds và cùng-bãi cho mọi quan hệ liên quan.
10. ConcurrencyCheck Version là token do ứng dụng quản lý: increment mỗi lần sửa, xử lý DbUpdateConcurrencyException. UpdatedAt cũng cần service/interceptor cập nhật. Check-in/confirm/exit phải atomic và khóa/re-check tài nguyên.
11. Audit append-only ở service/quyền DB; không ghi password, OTP, token hay secret vào OldValueJson/NewValueJson. Notification/CameraEvent không tự cấp quyền hoặc thay đổi nghĩa vụ tài chính.
12. API trả DTO thay vì serialize navigation graph (có vòng tham chiếu và dữ liệu cá nhân). JsonIgnore trên hash chỉ là lớp phòng vệ phụ.

## Những quyết định còn cần hỏi

- Chính sách hủy/hoàn tiền trước khi đến và xử lý callback thanh toán đến muộn.
- Cửa sổ đến sớm/muộn, no-show và thời gian hiệu lực QR.
- Walk-in thanh toán trước hay khi ra; chưa áp đặt trả trước booking cho walk-in.
- Quá giờ xung đột booking kế tiếp: nhân viên xử lý/chuyển slot và audit.
- Một người có nhiều role tại cùng bãi hay một role hiệu lực (đề xuất Manager bao hàm thao tác Staff; tránh assignment chồng nhau).
