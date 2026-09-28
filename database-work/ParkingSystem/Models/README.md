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

## DbContext và migration đã triển khai

Xem [Data/README.md](../Data/README.md) để biết mapping, ràng buộc PostgreSQL, kết quả kiểm tra và các quy tắc còn phải thực thi ở service. Sáu model Zone, ParkingSlot, SlotReservation, MapObject, PricingRule, PricingSnapshot đã thêm ParkingLotId cho khóa ngoại ghép bảo vệ scope bãi.

## Những quyết định còn cần hỏi

- Chính sách hủy/hoàn tiền trước khi đến và xử lý callback thanh toán đến muộn.
- Cửa sổ đến sớm/muộn, no-show và thời gian hiệu lực QR.
- Walk-in thanh toán trước hay khi ra; chưa áp đặt trả trước booking cho walk-in.
- Quá giờ xung đột booking kế tiếp: nhân viên xử lý/chuyển slot và audit.
- Một người có nhiều role tại cùng bãi hay một role hiệu lực (đề xuất Manager bao hàm thao tác Staff; tránh assignment chồng nhau).
