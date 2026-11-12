# 03 - THIẾT KẾ KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE — BASELINE V4)

## 1. Sơ đồ Kiến trúc Tổng thể Đa Điểm (Multi-Parking Platform Architecture)

```text
                           +----------------------------------------------------+
                           |             CLIENT APPLICATIONS                    |
                           |  - React + TypeScript Web App                      |
                           |  - Three.js / R3F (Data-driven 3D Digital Twin)    |
                           |  - Staff/Manager Facility Portal & Admin Dashboard |
                           +-------------------------+--------------------------+
                                                     |
                                                     | HTTPS (REST) + WSS (SignalR)
                                                     v
+---------------------------------------------------------------------------------------------------+
|                                     ASP.NET CORE 9 WEB API                                        |
|                                    (MODULAR MONOLITH PATTERN)                                     |
|                                                                                                   |
|  +--------------------+  +----------------------+  +-------------------------------------------+  |
|  |   Rate Limiter     |  |   Global Exception   |  |        Facility-Scoped RBAC               |  |
|  |  (20 req/min/IP)   |  |   (ProblemDetails)   |  | (Staff & Manager scoped by ParkingLotId)  |  |
|  +---------+----------+  +----------+-----------+  +---------------------+---------------------+  |
|            |                        |                                    |                        |
|            +------------------------+------------------------------------+                        |
|                                     v                                                             |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                      CONTROLLERS                                            |  |
|  |  - ParkingLotSearchController (/api/v1/parking-lots/search)                                 |  |
|  |  - ParkingLotsController (/api/v1/parking-lots, levels, zones, slots)                       |  |
|  |  - BookingsController (/api/v1/bookings, exact & auto slot, hold, cancel)                   |  |
|  |  - GateController (/api/v1/check-in, /api/v1/check-out)                                    |  |
|  |  - PricingController (/api/v1/pricing-plans, /estimate)                                     |  |
|  |  - PaymentsController (/api/v1/payments, /vnpay/callback)                                   |  |
|  |  - MapVersionsController (/api/v1/map-versions, /objects)                                   |  |
|  |  - OperationsController (/api/v1/issues, /camera-events, /audit-logs)                       |  |
|  +----------------------------------------------+----------------------------------------------+  |
|                                                 |                                                 |
|                                                 v                                                 |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                  APPLICATION SERVICES                                       |  |
|  |  - ParkingSearchEngine:                                                                     |  |
|  |      * NearestService: Thuật toán Haversine tính khoảng cách GPS đường chim bay             |  |
|  |      * EstimatedPriceService: Tính toán chi phí dự kiến theo duration & block 15m           |  |
|  |  - BookingService: Điều phối transaction, giữ chỗ (Hold), kiểm tra time-window overlap       |  |
|  |  - SlotAllocationService: Lọc hard constraints & chấm điểm phân bổ vị trí tự động (AutoSlot) |  |
|  |  - PricingCalculationEngine: Tính cước theo biểu giá từng bãi, phụ phí, phạt, trần ngày      |  |
|  |  - BookingSweeperWorker: BackgroundService quét hủy booking quá hạn hold mỗi 10 giây          |  |
|  |  - RealtimeBroadcaster: SignalR Hub phát sự kiện thay đổi trạng thái slot và booking          |  |
|  +----------------------------------------------+----------------------------------------------+  |
|                                                 |                                                 |
|                                                 v                                                 |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                PERSISTENCE & DATA ACCESS                                    |  |
|  |  - ParkingDbContext (EF Core 9, Npgsql Provider)                                            |  |
|  |  - PostgreSQL Advisory Lock Coordinator (pg_advisory_xact_lock)                              |  |
|  |  - Native PostGIS & Geometric Functions (nếu mở rộng tính khoảng cách CSDL)                 |  |
|  +----------------------------------------------+----------------------------------------------+  |
+-------------------------------------------------|-------------------------------------------------+
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                      POSTGRESQL 17 ENGINE                                         |
|                                  (SINGLE SOURCE OF TRUTH)                                         |
|                                                                                                   |
|  - Aggregates: ParkingLots, Levels, Zones, Slots, Vehicles, Bookings, Sessions, PricingPlans      |
|  - Concurrency Guards: EXCLUDE USING gist (SlotTime overlap & VehicleTime overlap)                |
|  - Security Triggers: TR_AuditLogs_AppendOnly (Ngăn chặn sửa/xóa nhật ký kiểm toán)               |
|  - Data-Driven 3D Layout: MapVersions, MapObjects (Lưu trữ tọa độ không gian 3D từng bãi)        |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Mô hình Kiến trúc Phân lớp (Clean Architecture / Layered Monolith)

1. **Domain Layer (Lõi Nghiệp vụ Độc lập):**
   - Không chứa bất kỳ dependency công nghệ hay framework cụ thể nào.
   - Chứa các Aggregate Root và Entities:
     - `ParkingLot`: Đơn vị bãi đỗ xe tổng thể.
     - `ParkingLevel`, `Zone`, `ParkingSlot`, `SlotFeature`: Cấu trúc không gian mặt bằng.
     - `FacilityStaffAssignment`: Ràng buộc phân quyền nhân sự theo bãi.
     - `Vehicle`, `Booking`, `ParkingSession`: Quản lý phương tiện và vòng đời gửi xe.
     - `PricingPlan`, `PricingRule`, `PricingSnapshot`: Biểu giá và lưu vết giá đã chốt.
     - `Payment`, `PaymentTransaction`: Giao dịch tài chính.
     - `ParkingIssue`, `PenaltyRule`: Quản lý sự cố và vi phạm.
     - `MapVersion`, `MapObject`: Tọa độ trực quan hóa 3D.
     - `AuditLog`: Dữ liệu kiểm toán bất biến.

2. **Application Layer (Use Cases & Điều phối):**
   - Đảm nhiệm việc thực thi các Use Cases của hệ thống.
   - Tách biệt DTOs (Request/Response) khỏi Domain Entities.
   - Triển khai các thuật toán nghiệp vụ:
     - `Haversine`: Đo đạc khoảng cách GPS phục vụ `NEAREST`.
     - `EstimatedPriceCalculator`: Mô phỏng tính tiền phục vụ `CHEAPEST`.
     - `SlotRanker`: Xếp hạng vị trí đỗ phục vụ `AutoSlot`.

3. **Persistence / Infrastructure Layer (Hạ tầng):**
   - Triển khai cấu hình EF Core Fluent API.
   - Cấu hình Exclusion Constraints GiST cho dải thời gian `tstzrange`.
   - Triển khai Advisory Locks theo transaction:
     ```csharp
     await dbContext.Database.ExecuteSqlRawAsync(
         "SELECT pg_advisory_xact_lock(hashtext({0}))", $"SLOT_{slotId}", cancellationToken);
     ```

4. **Presentation Layer (Web API & Realtime):**
   - ASP.NET Core Controllers hỗ trợ API Versioning (`/api/v1/...`).
   - Tích hợp middleware xử lý lỗi `ProblemDetails` (RFC 7807) và Rate Limiting.
   - `ParkingRealtimeHub` (SignalR) broadcast cập nhật trạng thái slot đến các client đang theo dõi bãi tương ứng.

---

## 3. Kiến trúc Bản đồ 3D Hướng Dữ liệu (Data-Driven 3D Architecture)

### 3.1. Nguyên tắc Bất biến
- **CSDL là Nguồn Chân lý Duy nhất (Database as Source of Truth):** Frontend Three.js không bao giờ tự ý quyết định trạng thái khả dụng của slot.
- **Không Hard-code Bản đồ:** Mỗi bãi xe (`ParkingLot`) có thể có nhiều phiên bản bản đồ (`MapVersion`). Mỗi tầng/khu vực có danh sách các đối tượng 3D (`MapObject`):
  - `PARKING_SLOT`: Liên kết 1-1 với `ParkingSlotId`.
  - `ROAD`, `WALL`, `ENTRANCE`, `EXIT`, `RAMP`, `ELEVATOR`, `STAIR`, `CHARGER`, `LABEL`.
- **Tối ưu hóa Hiệu năng Render (Performance):**
  - Chỉ tải dữ liệu và render bãi xe mà người dùng đang chọn xem.
  - Sử dụng kỹ thuật `InstancedMesh` để render hàng ngàn slot ô tô/xe máy với một lần gọi vẽ (draw call) duy nhất, đảm bảo mượt mà 60 FPS.
  - Khi có sự kiện Real-time (SignalR) về việc 1 slot thay đổi trạng thái, frontend chỉ cập nhật màu sắc của instance đó (dùng `setColorAt`), không reload lại toàn bộ mô hình 3D.

---

## 4. Phân Quyền Theo Phạm Vi Cơ Sở (Facility-Scoped Authorization)

```text
               [ ADMIN ] (Toàn quyền toàn hệ thống)
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
   [ Lot A Manager ]   [ Lot B Manager ]
         │                   │
         ▼                   ▼
   [ Lot A Staff ]     [ Lot B Staff ]
```

- Hệ thống kiểm tra quyền thông qua Claim và Middleware/Policy:
  - Nếu user là `Admin`: Có quyền xem và chỉnh sửa tất cả các bãi.
  - Nếu user là `ParkingManager` hoặc `ParkingStaff`: Kiểm tra bảng `FacilityStaffAssignment` xem `UserId` có được phân công cho `ParkingLotId` trong request hay không.
  - Ngăn chặn triệt để tình trạng nhân viên bãi này can thiệp vào doanh thu, biểu giá hoặc duyệt check-in của bãi khác.
