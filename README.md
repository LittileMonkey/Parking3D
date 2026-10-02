# Hệ Thống Quản Lý Bãi Đỗ Xe Thông Minh Đa Điểm 3D (Smart Multi-Parking 3D System — Baseline V4)

> Dự án FSOFT OJT FA26 (.NET Track) — Nền tảng quản lý bãi đỗ xe thông minh đa địa điểm tập trung (Multi-Parking Lot Platform), tích hợp tìm kiếm bãi đỗ theo GPS (Nearest - Haversine) và giá dự kiến (Cheapest), trực quan hóa mô hình 3D Digital Twin thời gian thực theo từng bãi đỗ, cơ chế chống xung đột bằng PostgreSQL Advisory Lock & GiST Exclusion, và thanh toán điện tử VNPay.

---

## 📌 Cấu Trúc Thư Mục Dự Án (Project Structure)

```text
PROJECT/
│
├── AGENTS.md                   # Chỉ dẫn cốt lõi cho AI Agents & Lập trình viên theo Baseline V4
├── README.md                   # Tài liệu tổng quan dự án (file này)
├── .gitignore                  # Cấu hình loại bỏ file rác, build artifacts, và templates
│
├── docs/                       # Thư viện tài liệu kỹ thuật toàn diện
│   │
│   ├── Parking_OJT_FA26_Baseline_V4_Multi_Parking.md # [GỐC] Văn kiện Baseline V4 hợp nhất từ Mentor & Đội ngũ
│   ├── APIDesignTemplate.md    # [THỰC TIỄN] Quy chuẩn thiết kế API, JSON Envelope, Sequence & Activity Diagrams
│   ├── GitlabGuide.md          # [THỰC TIỄN] Quy trình quản lý Issue Board, Chiến lược Branch & Pull Request
│   │
│   ├── 00-PROJECT-OVERVIEW.md  # Tổng quan bài toán, mục tiêu và phạm vi Multi-Parking
│   ├── 01-REQUIREMENTS.md      # Đặc tả yêu cầu chức năng (FR) và phi chức năng (NFR)
│   ├── 02-BUSINESS-RULES.md    # Quy tắc nghiệp vụ: Time-window overlap, Hold, Multi-lot Pricing
│   │
│   ├── 03-ARCHITECTURE.md      # Kiến trúc Clean Architecture, Concurrency, Advisory Lock & 3D
│   ├── 04-DATABASE.md          # Thiết kế CSDL PostgreSQL Multi-Lot, DDL, GiST Exclusion, Triggers
│   ├── 05-API.md               # Đặc tả REST API, contracts, status codes và ProblemDetails
│   │
│   ├── 06-CODING-STANDARDS.md  # Chuẩn lập trình C# 13, .NET 9, DTOs và Git Conventions
│   ├── 07-DEVELOPMENT.md       # Hướng dẫn cài đặt PostgreSQL, pgAdmin, User Secrets & Run API
│   │
│   ├── 08-DECISIONS.md         # Bản ghi các quyết định kiến trúc quan trọng (ADRs)
│   ├── 09-TODO.md              # Roadmap phát triển và backlog các giai đoạn tiếp theo
│   ├── 10-DESIGN.md            # Phân tích thiết kế giao diện & Design System
│   └── templates/              # [GIT IGNORED] Chứa toàn bộ các project template cũ
│
├── backend_parking_system/     # Backend ASP.NET Core 9 Web API & PostgreSQL
│   ├── ParkingProject/         # Solution C# chính (Controllers, Services, Data, Domain)
│   ├── database-work/          # DDL Scripts, Migration & Exclusion Guards
│   ├── model-build/            # Tooling & Entity Generators
│   └── scripts/                # PowerShell Scripts kiểm thử API tự động
│
└── frontend_parking_system/    # Frontend React + Three.js 3D Digital Twin (In Development)
```

---

## 🎯 Các Điểm Nổi Bật của Baseline V4
1. **Multi-Parking Lot Architecture:** Không giới hạn một tòa nhà 3 tầng; hỗ trợ nhiều bãi đỗ xe độc lập với số tầng (`ParkingLevel`), khu vực (`Zone`), loại chỗ đỗ và bảng giá (`PricingPlan`) riêng biệt.
2. **Smart Parking Search:**
   - **`NEAREST`:** Thuật toán Haversine tính toán khoảng cách đường chim bay từ tọa độ GPS của người dùng đến các bãi xe khả dụng trong bán kính tìm kiếm.
   - **`CHEAPEST`:** Tính toán chi phí ước tính trọn vẹn cho thời lượng gửi xe dự kiến (`expectedDuration`), áp dụng block tính phí (default 15 phút), daily cap, phụ phí của từng bãi.
3. **Data-Driven 3D Digital Twin:** Mô hình 3D được tải động từ CSDL (`MapVersion` -> `MapObject`) riêng biệt cho từng bãi đỗ xe; CSDL PostgreSQL là nguồn chân lý duy nhất.
4. **Quy Chuẩn Thiết Kế API & Phân Nhánh Kép (Design & Implementation):**
   - Áp dụng cấu trúc phản hồi chuẩn hóa `ApiResponse<T>` theo [APIDesignTemplate.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/APIDesignTemplate.md).
   - Áp dụng quy trình phân nhánh `features/Design_<Story>` và `features/Implementation_<Story>` cùng mẫu PR theo [GitlabGuide.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/GitlabGuide.md).
5. **Kiểm soát Đồng thời Tối đa:** PostgreSQL Advisory Lock và GiST Exclusion Constraint ngăn chặn triệt để đặt trùng lịch đỗ (`time window overlap`).

---

## 🚀 Khởi Động Nhanh (Quick Start)

### 1. Chuẩn bị Cơ sở Dữ liệu
- Cài đặt **PostgreSQL 17** và **pgAdmin 4**.
- Tạo database tên `parking_ojt`.
- Chạy script tạo bảng: `backend_parking_system/ParkingProject/Database/001_initial.sql`.
- Chạy script bảo vệ ràng buộc: `backend_parking_system/database-work/guards-up.sql`.

### 2. Cấu hình User Secrets cho Backend
Mở Terminal tại thư mục `backend_parking_system/ParkingProject/ParkingProject`:
```powershell
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:Parking" "Host=localhost;Port=5432;Database=parking_ojt;Username=postgres;Password=MAT_KHAU_CUA_BAN"
dotnet user-secrets set "Features:GuestBookings" "true"
```

### 3. Khởi chạy API
```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --launch-profile http
```
- API Endpoint: `http://localhost:5237`
- Kiểm tra trạng thái kết nối DB: `http://localhost:5237/health/ready`
- OpenAPI Specification: `http://localhost:5237/openapi/v1.json`

---

## 🔒 Quy Ước Bảo Mật & Git
- Thư mục template cũ đã được chuyển vào `docs/templates/` và được khai báo trong `.gitignore`. **Tuyệt đối không đẩy thư mục template lên GitHub.**
- Không commit các file chứa mật khẩu thật (`secrets.json`, connection strings với password).
