# 09 - KẾ HOẠCH PHÁT TRIỂN & DANH SÁCH CÔNG VIỆC (ROADMAP & TODO — BASELINE V4)

## 1. Giai đoạn 0: Tái cấu trúc Nền tảng Đa Bãi Đỗ (Phase 0 — Refactor Foundation)
- [x] Hợp nhất toàn bộ yêu cầu từ Mentor thành tài liệu chuẩn **Baseline V4**.
- [x] Tạo thực thể `ParkingLot` và `FacilityStaffAssignment` làm Aggregate Boundary.
- [x] Cập nhật quan hệ `ParkingLevel` -> `Zone` -> `ParkingSlot` liên kết với `ParkingLotId`.
- [x] Cấu hình lại các bảng biểu giá `PricingPlan`, `PricingRule` theo phạm vi từng bãi đỗ xe.
- [x] Tạo kịch bản Seed dữ liệu mẫu với tối thiểu **03 bãi xe có cấu trúc khác nhau** (Bãi ngầm Quận 1, Bãi ngoài trời Bình Thạnh, Bãi phức hợp Quận 7).

---

## 2. Giai đoạn 1: Lõi Nghiệp vụ Bắt buộc của Mentor (Phase 1 — Mentor Core Baseline)
> **Mục tiêu:** Hoàn thiện và demo được luồng hoạt động End-to-End từ tìm kiếm đến thanh toán.

- [ ] **Multi-Lot Management & Search Engine:**
  - [ ] API CRUD quản lý danh mục bãi đỗ xe, cấu trúc tầng và khu vực.
  - [ ] Triển khai thuật toán **Haversine** tìm bãi đỗ gần nhất (`NEAREST`) theo tọa độ GPS.
  - [ ] Triển khai động cơ `EstimatedPriceService` tính chi phí dự kiến cho toàn bộ thời lượng (`CHEAPEST`).
  - [ ] Bộ lọc nâng cao theo loại xe, trạm sạc EV, chỗ đỗ có mái che.
- [ ] **Booking & Time-Window Concurrency:**
  - [ ] Xây dựng API Đặt chỗ (`/api/v1/bookings`) hỗ trợ cả `ExactSlot` và `AutoSlot`.
  - [ ] Ràng buộc chống chồng lấn thời gian (`time window overlap`) trên cùng slot và cùng xe.
  - [ ] Khóa giao dịch bằng **PostgreSQL Advisory Lock** (`pg_advisory_xact_lock`).
  - [ ] Cơ chế giữ chỗ tạm thời (`PendingPayment` hold 15 phút) và Background Sweeper Worker quét giải phóng mỗi 10 giây.
- [ ] **Check-In, Check-Out & Payment:**
  - [ ] Sinh mã QR có chữ ký HMAC/Nonce bảo mật, chống chia sẻ ảnh chụp màn hình.
  - [ ] API Check-in tạo `ParkingSession` và mở barrier cổng vào.
  - [ ] API Check-out tính cước phí thực tế theo `PricingSnapshot` đã chốt.
  - [ ] Tích hợp cổng thanh toán trực tuyến VNPay Sandbox (Idempotent Webhook callback) và tiền mặt có Staff xác nhận.
- [ ] **Phân quyền Cơ sở (Facility-Scoped RBAC):**
  - [ ] Phân quyền bảo mật: Staff/Manager bãi nào chỉ được xem và thao tác dữ liệu bãi đó.
- [ ] **Giao diện Bản đồ 3D Data-Driven:**
  - [ ] Tải dữ liệu không gian từ API (`MapVersion` -> `MapObject`) và render Three.js linh hoạt theo từng bãi.

---

## 3. Giai đoạn 2: Vận hành Thời gian thực & Mô phỏng IoT (Phase 2 — Real-Time Operation)
- [ ] **Đồng bộ Trạng thái Thời gian thực (SignalR Hub):**
  - [ ] Broadcast sự kiện thay đổi trạng thái slot và booking tới Web Client không cần reload.
  - [ ] Cập nhật màu sắc instance 3D tức thời (Xanh = Available, Vàng = Reserved, Đỏ = Occupied).
- [ ] **Cổng Thông tin Vận hành & Báo cáo:**
  - [ ] Dashboard theo dõi công suất, doanh thu và cảnh báo sự cố cho Parking Manager theo từng bãi.
  - [ ] Báo cáo tổng hợp xuyên cơ sở (Cross-lot) cho Platform Admin.
- [ ] **Bộ Giả lập Thiết bị IoT (Simulator Engine):**
  - [ ] Simulator gửi sự kiện camera: `ENTRY_DETECTED`, `EXIT_DETECTED`, `SLOT_OCCUPANCY_DETECTED`.
  - [ ] Simulator điều khiển đóng/mở barrier điện tử.
- [ ] **Bảo toàn Dấu vết Kiểm toán (Audit Completeness):**
  - [ ] Ghi nhận toàn bộ thao tác thủ công của Staff, đổi giá, override barrier vào bảng `AuditLogs` Append-Only.

---

## 4. Giai đoạn 3: Tính năng Mở rộng (Phase 3 — Extended Scope)
- [ ] Dịch vụ sạc xe điện thông minh (`ChargingSession`).
- [ ] Quản lý vị trí đỗ xe khuyết tật (`Accessible`) và ưu tiên (`Priority`).
- [ ] Gói gửi xe định kỳ hàng tháng (`Monthly / 30-Day Pass`).
- [ ] Quản lý vi phạm và quy tắc phạt tiền linh hoạt (`ParkingIssue` & `PenaltyRule`).
- [ ] Thuật toán dẫn đường nội bộ trong bãi xe bằng Dijkstra / A* (`NavigationGraph`).
- [ ] Đánh giá và nhận xét bãi xe sau khi kết thúc lượt đỗ (`Review`).
- [ ] Kiểm thử tải cao (Stress Testing) kịch bản 500 concurrent users với k6.
