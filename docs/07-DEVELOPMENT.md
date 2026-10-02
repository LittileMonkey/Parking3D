# 07 - HƯỚNG DẪN THIẾT LẬP MÔI TRƯỜNG PHÁT TRIỂN (DEVELOPMENT GUIDE — BASELINE V4)

## 1. Yêu cầu Hệ thống (Prerequisites)
- **Hệ điều hành:** Windows 10/11, macOS, hoặc Linux.
- **.NET SDK:** .NET 9.0 SDK trở lên (`dotnet --version` >= 9.0.100).
- **Hệ Quản trị CSDL:** PostgreSQL 17 (Cài cục bộ hoặc chạy Docker container).
- **Công cụ Quản trị CSDL:** pgAdmin 4 hoặc DBeaver.
- **Node.js:** Node.js v20+ LTS (dành cho `frontend_parking_system`).
- **IDE đề xuất:** Visual Studio 2022 (v17.12+), Rider, hoặc Visual Studio Code.

---

## 2. Thiết lập Cơ sở Dữ liệu PostgreSQL

### 2.1. Tạo Database trên pgAdmin 4
1. Mở **pgAdmin 4** và kết nối vào PostgreSQL 17 Server (mặc định cổng `5432`).
2. Chuột phải vào **Databases** -> Chọn **Create** -> **Database...**
3. Đặt tên Database: `parking_ojt`.
4. Chọn Owner: `postgres` -> Bấm **Save**.

### 2.2. Chạy Scripts Khởi tạo & Ràng buộc Bảo vệ
1. Chọn database `parking_ojt` -> Mở menu **Tools** -> Chọn **Query Tool**.
2. Mở file tạo bảng ban đầu:
   `backend_parking_system/ParkingProject/Database/001_initial.sql` -> Nhấn **F5** để thực thi.
3. Mở tiếp file thiết lập ràng buộc GiST và Trigger:
   `backend_parking_system/database-work/guards-up.sql` -> Nhấn **F5** để thực thi.

---

## 3. Cấu hình Kết nối với .NET User Secrets
Không bao giờ lưu mật khẩu CSDL vào `appsettings.json`. Sử dụng công cụ Secret Manager của .NET:

1. Mở Terminal PowerShell tại thư mục:
   ```powershell
   cd d:\FSOFT_FALL26_NET\Project.CleanArchitecture\Project.CleanArchitecture\backend_parking_system\ParkingProject\ParkingProject
   ```
2. Khởi tạo và thiết lập các biến cấu hình cục bộ:
   ```powershell
   dotnet user-secrets init
   dotnet user-secrets set "ConnectionStrings:Parking" "Host=localhost;Port=5432;Database=parking_ojt;Username=postgres;Password=MAT_KHAU_POSTGRES_CUA_BAN"
   dotnet user-secrets set "Features:GuestBookings" "true"
   dotnet user-secrets set "Features:MultiLotSearch" "true"
   dotnet user-secrets set "VNPay:TmnCode" "SANDBOX_CODE"
   dotnet user-secrets set "VNPay:HashSecret" "SANDBOX_SECRET"
   ```

---

## 4. Khởi tạo Dữ liệu Mẫu (Seed Multi-Lot Demo Data)

Theo yêu cầu của **Baseline V4**, hệ thống cần có tối thiểu 3 bãi xe với cấu trúc khác nhau để kiểm thử tính năng Multi-Parking và thuật toán Nearest/Cheapest:
- **Bãi 1 (LOT-Q1-01):** Trung tâm Quận 1 (3 tầng hầm B2, B1, G, hỗ trợ cả Ô tô và Xe máy, có trạm sạc EV).
- **Bãi 2 (LOT-BT-02):** Bãi ngoài trời Bình Thạnh (1 tầng mặt đất Outdoor Ground, giá rẻ hơn, nhiều chỗ trống).
- **Bãi 3 (LOT-Q7-03):** Tòa nhà phức hợp Quận 7 (2 tầng nổi Floor 1, Floor 2, có khu vực VIP).

Chạy lệnh Seed dữ liệu:
```powershell
cd d:\FSOFT_FALL26_NET\Project.CleanArchitecture\Project.CleanArchitecture\backend_parking_system\ParkingProject\ParkingProject
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --no-launch-profile -- --seed-demo
```

---

## 5. Khởi chạy Web API Backend
```powershell
dotnet run --launch-profile http
```
Các đường dẫn kiểm tra nhanh:
- `http://localhost:5237/health/live`: Kiểm tra API process đang hoạt động.
- `http://localhost:5237/health/ready`: Kiểm tra kết nối tới CSDL PostgreSQL.
- `http://localhost:5237/openapi/v1.json`: Đặc tả OpenAPI Specification.
- `http://localhost:5237/api/v1/parking-lots/search?latitude=10.776&longitude=106.700&radiusKm=5&sortBy=NEAREST`: Thử nghiệm thuật toán Haversine Nearest.

---

## 6. Chạy Script Kiểm thử Tự động
```powershell
cd d:\FSOFT_FALL26_NET\Project.CleanArchitecture\Project.CleanArchitecture\backend_parking_system
.\scripts\Test-Api.ps1 -WithDatabase
```
Script kiểm tra toàn bộ luồng: Tìm kiếm bãi -> Tạo booking -> Khóa Advisory Lock -> Kiểm tra time-window overlap -> Check-in -> Check-out.
