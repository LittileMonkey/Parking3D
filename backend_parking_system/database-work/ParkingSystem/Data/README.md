# PostgreSQL và EF Core — hướng dẫn dự án

## Kết quả

- PostgreSQL: database `parking_system`, `localhost:5432` tại thời điểm triển khai.
- 28 bảng nghiệp vụ và `__EFMigrationsHistory`.
- EF Core runtime/Design/Tools: 10.0.12; Npgsql EF provider: 10.0.0; Npgsql driver: 10.0.3.
- Không tạo dữ liệu mẫu, tài khoản hoặc mật khẩu mặc định.
- Chưa triển khai API nghiệp vụ/authorization/OTP/payment gateway; schema là nền tảng lưu trữ.

## Thiết kế bảng

| Nhóm | Bảng |
|---|---|
| Người dùng/quyền | Users, Vehicles, StaffAssignments, OtpChallenges |
| Cấu trúc bãi | ParkingLots, ParkingLevels, Zones, ParkingSlots, SlotFeatures, ParkingSlotFeatures, EntranceExits, OperatingHours, ParkingPolicies |
| Bản đồ | MapVersions, MapObjects |
| Booking và vào/ra | Bookings, SlotReservations, ParkingSessions, QRTokens |
| Giá | PricingPlans, PricingRules, PricingSnapshots |
| Thanh toán | Payments, PaymentTransactions |
| Vận hành | AuditLogs, Notifications, CameraEvents, ParkingIssues |

Mỗi bảng dùng Guid Id. UTC timestamp lưu `timestamp with time zone`; `TimeOnly` là giờ địa phương theo múi giờ bãi. Tiền dùng numeric(18,2); enum lưu integer với CHECK các giá trị hợp lệ, tra tên trong Models/Enums. SupportedVehicleTypes dùng integer[] với ràng buộc không rỗng và chỉ nhận loại xe hợp lệ. JSON dùng jsonb.

ParkingLotId được thêm vào Zone, ParkingSlot, SlotReservation, MapObject, PricingRule, PricingSnapshot để làm FK ghép. Các quan hệ cấu trúc, reservation, session, map, giá và issue liên quan được kiểm tra cùng bãi tại DB. Đây không phải các giá trị có thể gán độc lập tùy ý.

## Vai trò

- `Users.PlatformRole`: 0 Customer, 1 Admin.
- `StaffAssignments.Role`: 0 Staff, 1 Manager, gắn UserId + ParkingLotId và thời gian hiệu lực.
- CanManageStaffAssignments chỉ hợp lệ với Manager; quyền cụ thể gán Manager vẫn cần chốt ở service.
- Guest không có user role; booking lưu phone, plate, OTP challenge.
- Schema không tự thực thi quyền truy cập: API vẫn phải kiểm tra user active, assignment còn hiệu lực, quyền sở hữu xe/booking và scope bãi.

## Migrations

1. `InitialParkingSchema`: bảng, khóa ngoại, index, CHECK, extension btree_gist.
2. `AddReservationGuards`: PostgreSQL exclusion constraints cho reservation/booking/biểu giá, email unique không phân biệt hoa thường, chuẩn hóa biển số, audit append-only.

`initial-schema.sql` là bản SQL xuất từ hai migration để đọc/review hoặc cài database mới. KHÔNG chạy lại SQL này trên database đã được migration. Dùng `dotnet ef database update`; EF theo dõi những migration đã chạy.

Mở PowerShell tại project:

```powershell
cd 'D:\OJT_FA26\ParkingSystem\ParkingSystem\ParkingSystem'
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet tool restore
dotnet restore
dotnet ef migrations list
dotnet ef database update
dotnet run --launch-profile https
```

Manifest `.config/dotnet-tools.json` dùng EF CLI 10.0.12 riêng cho project, không cần thay tool 9 toàn máy. Kết nối đọc từ ConnectionStrings:Parking trong User Secrets (Development) hoặc biến môi trường. Không lưu mật khẩu vào mã nguồn. Factory design-time mặc định Development nếu chưa đặt môi trường; đặt ASPNETCORE_ENVIRONMENT rõ ràng khi deploy.

Kiểm tra API: `https://localhost:7287/health/ready` truy vấn được bảng ParkingLots sẽ trả status ready, kể cả bảng chưa có dữ liệu. Endpoint test kết nối cũ vẫn giữ nguyên. Hai endpoint chỉ có trong Development. Ứng dụng không tự chạy migration khi khởi động.

Trong pgAdmin: chọn parking_system → Schemas → public → Tables → Refresh.

```sql
SELECT "MigrationId", "ProductVersion" FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;
```

## Khi thay đổi model sau này

1. Sửa model và phần mapping tương ứng trong ParkingDbContext.*.cs.
2. Chạy `dotnet ef migrations add TenThayDoi --output-dir Data/Migrations`.
3. Đọc Up/Down và xuất SQL bằng `dotnet ef migrations script` để rà soát.
4. Chạy `dotnet ef database update` trên môi trường đích đã xác định.

Không sửa migration đã áp dụng; thêm migration mới. Không xóa database để đồng bộ model. Các exclusion constraint/trigger/index expression được viết SQL trong migration thứ hai; EF snapshot không tự mô tả chúng. Khi thay đổi cột/status liên quan phải cập nhật SQL bằng migration mới.

## Bảo vệ dữ liệu đã triển khai

- Reservation Held/Confirmed không chồng `[from,until)` trên cùng slot. Cùng biển số không có booking PendingPayment/Confirmed/CheckedIn chồng thời gian xuyên bãi. Hai khung giờ sát nhau được phép.
- Một active reservation/booking; một session Active/ExitPending trên mỗi slot và biển số; tối đa một session/booking.
- Một Published map/bãi; một object/slot/map; active pricing plans không chồng khoảng hiệu lực trong một bãi. Thiết kế dùng một biểu giá đầy đủ cho tất cả loại xe/zone, phân nhánh trong PricingRules.
- Payment thuộc đúng một Booking hoặc Session; số tiền không âm; unique idempotency/provider reference/event key/request reference. Cash Success cần người xác nhận.
- FK Restrict tránh cascade xóa lịch sử. AuditLogs bị chặn UPDATE/DELETE bằng trigger và DbContext.
- DbContext tự cập nhật UpdatedAt và tăng Version khi SaveChanges; phát hiện stale update qua concurrency token.
- Email unique không phân biệt hoa thường; phone unique khi có; xe active unique theo NormalizedPlate; mỗi user tối đa một xe primary active. Đây là mặc định kỹ thuật hiện tại cho quản lý danh tính, cần migration nếu chuyển sang chia sẻ xe nhiều chủ.

## Các kiểm tra vẫn thuộc service nghiệp vụ

Database constraints không thay thế transaction và authorization. Trước khi viết API cần:

- Chuẩn hóa phone/plate/email, xác thực contact, quyền sở hữu xe; match VehicleId với biển số snapshot và loại xe.
- Xác minh OTP/hash/expiry/attempts, consume atomically, chống resend abuse và reuse. Unique GuestOtpChallengeId ngăn dùng cùng challenge cho hai booking nhưng không thay thế kiểm tra OTP hợp lệ.
- Confirm chỉ khi đã thu đủ tiền đã xác minh và còn reservation hợp lệ; expiration worker release hold; kiểm tra lịch booking với session thực tế, giờ mở cửa, loại xe, features và policy.
- Check-in/exit khóa tài nguyên và kiểm tra cùng-bãi, không mở barrier chỉ vì payment success; xử lý overstay ảnh hưởng booking tiếp theo.
- Snapshot phải đúng booking/session (khi có cả hai, session thuộc booking đó); không sửa giá snapshot sau cam kết. Validate JSON PricingRule theo từng loại; hoàn tiền không vượt số đã thu.
- Chỉ Staff được gán bãi mới được xác nhận Cash; ID người xác nhận tồn tại chưa chứng minh người đó có quyền.
- Policy hủy/hoàn tiền, đến sớm/muộn, QR lifetime và exit grace chưa chốt vẫn null. Không diễn giải null thành miễn phí/vô hạn; yêu cầu cấu hình trước khi mở luồng tương ứng.

## Kiểm chứng

Tại thời điểm triển khai: 19 kiểm tra PostgreSQL đạt (overlap, adjacent windows, FK khác bãi, role, array type, Restrict, active session, payment, callback, audit, map publish, enum roundtrip, version/timestamp và stale write). Dữ liệu thử nằm trong transaction và rollback; 28 bảng nghiệp vụ trống sau kiểm tra. Đây chưa phải bài kiểm tra tải hoặc toàn bộ luồng nghiệp vụ.

Mã kiểm tra nằm ở `../tests/ParkingSystem.DatabaseChecks` tính từ thư mục solution (cùng cấp với project). Chỉ chạy trên database Development mới migrate và chưa có dữ liệu:

```powershell
dotnet run --project '..\tests\ParkingSystem.DatabaseChecks\ParkingSystem.DatabaseChecks.csproj' -- --verify
```

Không có `--verify` thì chỉ kiểm tra kết nối, danh sách bảng và EF metadata. Có `--verify` sẽ từ chối nếu bất kỳ bảng nghiệp vụ nào đã có dữ liệu.
