# Parking OJT FA26 — C# ASP.NET Core

Đây là **bước nền tảng**, chưa phải toàn bộ sản phẩm Baseline V2. Dùng ASP.NET Core 9, EF Core và PostgreSQL theo lựa chọn C# của bạn.

## 1. Bạn đang có gì?

- `Domain`: các lớp dữ liệu Slot, Vehicle, Booking và trạng thái riêng biệt.
- `Data`: ánh xạ các lớp thành bảng PostgreSQL, khóa ngoại, unique index và bộ tạo 2.000 slot demo.
- `Contracts`: dữ liệu nhận/trả của API; không nhận trực tiếp entity từ người dùng.
- `Services`: kiểm tra nghiệp vụ, transaction, tự giải phóng booking hết hạn mỗi 10 giây.
- `Controllers`: nhận HTTP request, gọi service và trả HTTP response.
- `Database/001_initial.sql`: schema tạo từ mô hình EF Core; chỉ chạy một lần trên database mới.

Luồng hiện có: Guest chọn slot ô tô hoặc Auto Select → CONFIRMED/RESERVED → hủy hoặc hết 5 phút → AVAILABLE. Token riêng cần thiết để đọc/hủy booking; token này **chưa phải QR check-in**. Không trả số điện thoại/biển số ở API công khai.

## 2. Tạo database bằng pgAdmin

1. Mở pgAdmin 4 → Servers → PostgreSQL 17. Nhập mật khẩu PostgreSQL bạn đã đặt khi cài đặt (không phải mật khẩu Windows).
2. Chuột phải **Databases → Create → Database**.
3. Database: `parking_ojt`; Owner: tài khoản bạn đang sử dụng, thường là `postgres`; Save.
4. Chọn đúng database `parking_ojt` → Tools → Query Tool.
5. Mở file `ParkingProject/Database/001_initial.sql` trong Query Tool → Execute (F5). Không chạy vào database dự án khác. Script không xóa bảng và sẽ báo lỗi nếu bảng đã tồn tại.

Tài khoản `postgres` phù hợp để bạn thử trên máy cá nhân; trước khi triển khai cần tạo tài khoản ứng dụng với quyền giới hạn.

## 3. Cấu hình kết nối trong Visual Studio

Mở `ParkingProject.slnx`. Chuột phải **project ParkingProject** (không phải solution) → **Manage User Secrets**. Điền:

```json
{
  "ConnectionStrings": {
    "Parking": "Host=localhost;Port=5432;Database=parking_ojt;Username=postgres;Password=THAY_BANG_MAT_KHAU_CUA_BAN"
  },
  "Features": {
    "GuestBookings": true
  }
}
```

Thay username, port nếu bạn cài khác mặc định. Không gửi mật khẩu lên chat hoặc commit vào Git. User Secrets được tải khi chạy môi trường Development. Không có cấu hình, API vẫn chạy nhưng `/health/ready` trả 503.

## 4. Tạo slot demo và chạy API

Mở Terminal trong Visual Studio, chạy PowerShell:

```powershell
cd 'D:\OJT_FA26\3D Parking\ParkingProject\ParkingProject'
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --no-launch-profile -- --seed-demo
dotnet run --launch-profile http
```

Seed chỉ chạy trên schema đã tạo và từ chối ghi đè khi có slot. Nó tạo F01: 1.000 xe máy, F02/F03: mỗi tầng 500 ô tô. Tất cả là NORMAL, Zone A; thứ tự gần EXIT chỉ là dữ liệu demo. Chưa tự đặt số lượng EV/PRIORITY/ACCESSIBLE vì tài liệu chưa chốt vị trí/số lượng.

Bạn cũng có thể chạy F5 với profile `http` sau bước seed. Nếu F5 đang chạy thì dừng trước khi build lại.

- `http://localhost:5237/health/live`: API hoạt động.
- `http://localhost:5237/health/ready`: truy vấn được bảng Slots.
- `http://localhost:5237/openapi/v1.json`: đặc tả OpenAPI (JSON, chưa có Swagger UI).
- `http://localhost:5237/api/slots?floor=F02&pageSize=20`: xem slot.

## 5. Thử đặt chỗ

Mở `ParkingProject/ParkingProject.http` trong Visual Studio và chọn Send Request. Tạo booking sẽ trả `booking.id` cùng `accessToken`. Sao chép hai giá trị vào biến tương ứng đầu file để xem/hủy. Giữ token như thông tin bí mật.

Hoặc chạy script kiểm tra trên **database demo** sau khi bật API:

```powershell
cd 'D:\OJT_FA26\3D Parking\ParkingProject'
.\scripts\Test-Api.ps1
.\scripts\Test-Api.ps1 -WithDatabase
```

Bản có `-WithDatabase` tạo booking thử rồi hủy; bản ghi lịch sử và vehicle thử vẫn được giữ để truy vết. Không dùng script này với dữ liệu thật.

## 6. Quy tắc đã triển khai và giới hạn

- PostgreSQL unique index theo trạng thái active bảo vệ một xe/một slot khỏi nhiều booking đồng thời.
- Transaction + PostgreSQL advisory lock tuần tự hóa ghi booking xuyên nhiều API instance; phù hợp bản nền tảng, cần đo tải để tối ưu về sau. Các module ghi mới phải tuân thủ cùng cơ chế khóa.
- Hold miễn phí 5 phút, worker quét 10 giây; có thể chậm tối đa một chu kỳ khi API đang chạy bình thường. Khi API tắt, xử lý tiếp lúc chạy lại hoặc khi có booking mới.
- Xe máy không chọn slot; ô tô chọn NORMAL hoặc tự cấp theo ExitOrder rồi mã slot.
- Capacity hiện tính OCCUPIED / tổng slot theo loại xe và khóa khi **>90%**, đúng cách đọc trực tiếp tài liệu. Cần chốt có tính RESERVED và loại MAINTENANCE/DISABLED khỏi mẫu số hay không.
- Chưa có ưu tiên Customer > Guest, special permission, gia hạn hold, authentication/roles, QR check-in, ParkingSession, check-out, pricing, payment, WebSocket, 3D UI hoặc các module Phase 2/3.
- GuestBookings tắt mặc định; chỉ bật để học/demo. Rate limit 20 request/phút/IP là giới hạn kỹ thuật ban đầu. Trước khi công khai cần bổ sung xác minh người đặt, chống lạm dụng và cấu hình proxy/rate limiting phù hợp.
- Chưa chốt thời điểm cấp slot xe máy: mục 2/9 mô tả cấp khi đặt, mục 37 cấp lúc đến. Bản nền tảng cấp lúc đặt để giữ ràng buộc booking → slot; cần thống nhất trước khi làm check-in.
- Chưa có migration nâng cấp schema: script 001 chỉ dùng database mới. Các thay đổi tiếp theo cần EF migration/versioned SQL, không xóa database để cập nhật.

## 7. Các bước học và triển khai tiếp

Sau khi kết nối PostgreSQL thành công: kiểm tra vòng đời booking và race condition trên DB thật; tiếp đó đăng ký/đăng nhập + phân quyền và quyền sở hữu xe; rồi QR/check-in/session, pricing/check-out/payment sandbox. Sau cùng kết nối React/3D và realtime. Giá gửi xe, làm tròn thời gian và ranh giới EXPIRED/NO_SHOW cần thống nhất trước khi code phần tính phí.

Tài liệu kỹ thuật provider: https://www.npgsql.org/efcore/
