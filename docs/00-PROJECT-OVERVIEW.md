# 00 - TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW — BASELINE V4)

## 1. Giới thiệu Dự án
- **Tên dự án:** Nền tảng Quản lý Bãi đỗ xe Thông minh Đa Điểm 3D (Smart Multi-Parking Management Platform — Baseline V4)
- **Chương trình / Kỳ thực tập:** FSOFT OJT FA26 (.NET Track) / SWP391
- **Văn bản pháp lý nền tảng:** Hợp nhất từ `context.md` (Mentor), `SRS-Parking-System.md` (Mentor), mã nguồn nghiệp vụ đã kiểm chứng từ hệ thống cũ và tài liệu mở rộng 3D/IoT V2.
- **Tầm nhìn cốt lõi:** Một nền tảng tập trung quản lý **nhiều bãi đỗ xe tại nhiều địa điểm khác nhau** (Multi-Parking Lot), cho phép người dùng tìm kiếm bãi xe gần nhất theo GPS hoặc rẻ nhất theo chi phí dự kiến, xem mô hình 3D bản đồ số từng bãi, đặt chỗ trước không xung đột và thanh toán điện tử VNPay/tiền mặt.

---

## 2. Bốn Điểm Nhấn Bắt Buộc của Đồ án (Core Highlights)

### A. Nền tảng Đa Bãi Đỗ Xe (Multi-Parking-Lot Architecture)
- Không bị giới hạn trong một tòa nhà hay ba tầng cứng nhắc.
- Cấu trúc linh hoạt theo từng cơ sở:
  - **Bãi đỗ A (Trung tâm thương mại):** Gồm Tầng hầm B2, B1, Tầng trệt Ground.
  - **Bãi đỗ B (Bãi ngoài trời):** Cấu trúc 1 mặt bằng Outdoor Ground.
  - **Bãi đỗ C (Tòa nhà phức hợp):** Gồm Floor 1, Floor 2, Khu sạc xe điện EV, Khu vực ưu tiên VIP.
- Mỗi bãi xe tự quản lý: Tọa độ địa lý (GPS), Bán kính phục vụ (Search Radius), Giờ hoạt động, Phân cấp tầng/khu vực và Biểu giá riêng biệt.

### B. Tìm kiếm Bãi Đỗ Thông Minh (Smart Parking Search)
- **`NEAREST` (Bãi gần nhất):** Áp dụng thuật toán **Haversine** tính toán khoảng cách đường chim bay từ vị trí GPS của người dùng đến tất cả các bãi đang hoạt động trong bán kính tìm kiếm.
- **`CHEAPEST` (Bãi rẻ nhất):** Không chỉ so sánh đơn giá theo giờ đơn thuần! Hệ thống chạy động cơ `EstimatedPriceService` để tính toán toàn bộ chi phí dự kiến dựa trên khung giờ (`expectedDuration`), block thời gian (billing unit 15 phút), phụ phí ngày/đêm, trần giá tối đa theo ngày (daily cap) của từng bãi.

### C. Bản đồ 3D Data-Driven theo từng Bãi (3D Digital Twin)
- Mô hình 3D không hard-code; dữ liệu vị trí, kích thước, góc xoay và loại đối tượng (slot, đường đi, tường, lối vào/ra, thang máy, trạm sạc) được tải động từ CSDL (`MapVersion` -> `MapObject`).
- CSDL PostgreSQL là nguồn chân lý duy nhất (Single Source of Truth); Three.js chỉ đóng vai trò Presentation Layer.

### D. Cập nhật Trạng thái Thời gian thực (Real-time Integration)
- Đồng bộ hóa trạng thái vị trí đỗ (Available, Reserved, Occupied, Maintenance) thông qua WebSocket/SignalR mà không cần người dùng tải lại trang.

---

## 3. Phạm vi Hệ thống (System Scope)

### 3.1. In Scope — Core Baseline (Bắt buộc demo hoàn chỉnh)
1. Xác thực & Phân quyền RBAC theo phạm vi cơ sở (Facility-Scoped RBAC).
2. Quản lý thông tin Khách hàng (`Customer`) và Phương tiện (`Vehicle`).
3. Quản lý danh mục nhiều Bãi xe (`ParkingLot`).
4. Quản lý cấu trúc Tầng/Khu vực/Vị trí: `ParkingLevel` -> `Zone` -> `ParkingSlot`.
5. Tìm kiếm bãi xe theo GPS / Tọa độ / Địa chỉ thủ công.
6. Thuật toán tìm bãi gần nhất (`NEAREST` — Haversine).
7. Thuật toán tìm bãi rẻ nhất (`CHEAPEST` — Estimated Duration Price).
8. Hiển thị tình trạng chỗ trống theo thời gian thực và giá dự kiến.
9. Bản đồ bãi xe 2D/3D trực quan theo dữ liệu từng bãi.
10. Đặt chỗ trước (`Booking`) theo khoảng thời gian (`StartAt` -> `EndAt`).
11. Hỗ trợ 2 chế độ đặt chỗ: Chọn ô cụ thể (`ExactSlot`) hoặc Tự động phân bổ (`AutoSlot`).
12. Check-in bằng mã QR động và Check-in có sự hỗ trợ của nhân viên (`Staff-assisted`).
13. Quản lý phiên đỗ xe thực tế (`ParkingSession`).
14. Cơ chế tính phí (`PricingPlan` & `PricingRule`) riêng biệt theo từng bãi đỗ.
15. Thanh toán trực tuyến VNPay Sandbox và tiền mặt (`Cash`) có xác nhận của Staff.
16. Báo cáo & Dashboard vận hành theo từng bãi cho Manager và toàn hệ thống cho Admin.
17. Ghi nhận nhật ký kiểm toán không thể xóa (`AuditLog` Append-Only).
18. Mô phỏng sự kiện Camera / Barrier IoT (`Camera/IoT Simulator`).

### 3.2. Extended Scope (Giai đoạn mở rộng)
- Quản lý dịch vụ sạc xe điện (`EV Charging Session`).
- Vị trí đỗ ưu tiên (`Accessible`, `Priority/Emergency`).
- Gói thuê bao định kỳ (`Monthly / 30-Day Pass`).
- Quản lý sự cố & vi phạm (`ParkingIssue` & `PenaltyRule`).
- Đánh giá & nhận xét bãi xe (`Review`).
- Tìm đường nội bộ trong bãi xe bằng thuật toán Dijkstra / A*.

---

## 4. Công nghệ & Nền tảng Kỹ thuật
- **Backend:**
  - C# 13, .NET 9 (ASP.NET Core Web API — Kiến trúc Clean Architecture / Modular Monolith).
  - Entity Framework Core 9 (Npgsql Provider).
  - PostgreSQL 17 (Exclusion Constraints GiST, Advisory Locks, PostGIS).
  - SignalR Hub cho WebSocket real-time.
- **Frontend:**
  - React 18 / 19 + TypeScript + Vite.
  - Three.js / `@react-three/fiber` + `@react-three/drei` (InstancedMesh cho hiệu năng cao).
  - Microsoft SignalR Client.
- **External Integration:**
  - Cổng thanh toán VNPay Sandbox.
  - Map Service (OpenStreetMap / Leaflet hoặc giả lập GPS).
  - Camera & Barrier Simulator gửi event mô phỏng.
