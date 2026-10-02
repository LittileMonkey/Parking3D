# 01 - YÊU CẦU HỆ THỐNG (SYSTEM REQUIREMENTS — BASELINE V4)

## 1. Yêu cầu Chức năng (Functional Requirements - FR)

### 1.1. Quản lý Đa Bãi Đỗ Xe & Cấu trúc Linh hoạt (Multi-Parking Lot Management)
- **FR-01 (Quản lý Bãi xe - ParkingLot):** Hệ thống phải quản lý được nhiều bãi đỗ xe độc lập. Mỗi bãi chứa: Mã bãi (`Code`), Tên, Địa chỉ, Tọa độ GPS (`Latitude`, `Longitude`), Bán kính tìm kiếm (`SearchRadiusMeters`), Giờ mở/đóng cửa (`OperatingHours`), Trạng thái hoạt động (`Active`, `TemporarilyClosed`, `Inactive`).
- **FR-02 (Cấu trúc Mặt bằng Linh hoạt - ParkingLevel):** Hỗ trợ cấu trúc tầng không giới hạn:
  - `Basement` (Tầng hầm), `Ground` (Mặt đất), `Floor` (Tầng nổi), `Outdoor` (Bãi ngoài trời), `Rooftop` (Sân thượng).
  - Không bắt buộc mọi bãi đều phải có 3 tầng; bãi ngoài trời chỉ có một tầng logic `Outdoor`.
- **FR-03 (Phân vùng & Vị trí - Zone & ParkingSlot):**
  - Quản lý phân khu (`Zone`) theo loại phương tiện được hỗ trợ (`Motorbike`, `Car`).
  - Quản lý vị trí đỗ (`ParkingSlot`): Mã vị trí (`SlotCode`), Trạng thái vận hành (`Active`, `Maintenance`, `Disabled`).
  - Gắn thuộc tính đặc biệt (`SlotFeature`): `EV_CHARGING`, `ACCESSIBLE`, `PRIORITY`, `COVERED`, `NEAR_ELEVATOR`.

### 1.2. Tìm kiếm Bãi đỗ Thông minh (Smart Parking Search & Recommendation)
- **FR-04 (Thuật toán NEAREST - Bãi gần nhất):**
  - Nhận tọa độ GPS người dùng và bán kính tìm kiếm (`radiusKm`).
  - Áp dụng công thức **Haversine** tính toán khoảng cách đường chim bay từ vị trí người dùng đến các bãi đang `Active`.
  - Trả về danh sách bãi xe sắp xếp tăng dần theo khoảng cách.
- **FR-05 (Thuật toán CHEAPEST - Bãi rẻ nhất):**
  - Nhận thời điểm bắt đầu (`startTime`), thời lượng dự kiến (`expectedDuration`) và loại phương tiện.
  - Chạy động cơ `EstimatedPriceService` tính toàn bộ chi phí dự kiến cho từng bãi (dựa trên biểu giá riêng của bãi, block 15 phút, daily cap, phụ phí).
  - Sắp xếp tăng dần theo tổng chi phí dự kiến kèm giải trình chi tiết.
- **FR-06 (Bộ lọc nâng cao):** Cho phép lọc bãi xe theo loại phương tiện hỗ trợ, trạm sạc xe điện, chỗ đỗ có mái che, hoặc chỗ đỗ cho người khuyết tật.

### 1.3. Đặt chỗ trước (Booking & Time-Window Reservation)
- **FR-07 (Chế độ đặt chỗ):**
  - **`ExactSlot`:** Khách hàng trực tiếp bấm chọn vị trí cụ thể trên sơ đồ 2D/3D.
  - **`AutoSlot`:** Hệ thống tự động chấm điểm và cấp phát vị trí tối ưu dựa trên tính tương thích, khu vực ưu tiên và khoảng cách lối thoát.
- **FR-08 (Quy tắc Chống chồng lấn thời gian - Time-Window Overlap):**
  - Hệ thống cho phép một phương tiện tạo nhiều booking khác nhau miễn là các khung giờ đặt (`[StartAt, EndAt)`) không bị giao thoa (overlap).
  - Một slot đỗ có thể nhận nhiều booking tại các khung giờ không trùng nhau trong cùng một ngày.
- **FR-09 (Thời gian giữ chỗ - Reservation Hold):**
  - Khi tạo booking thành công, hệ thống giữ chỗ tạm thời với thời gian mặc định là **15 phút** (`HoldExpiresAt = UtcNow + 15m`, có thể cấu hình theo `ParkingPolicy`).
  - Background Worker quét định kỳ tự động hủy booking quá hạn và giải phóng tài nguyên.

### 1.4. Quản lý Lượt đỗ (Check-In, Parking Session & Check-Out)
- **FR-10 (Check-in linh hoạt):**
  - Quét mã QR bảo mật (QR có chữ ký HMAC/One-time nonce) tại cổng vào.
  - Nhận diện biển số thông qua sự kiện camera mô phỏng (`Camera Simulator`).
  - Hỗ trợ nhân viên trực cổng (`Staff`) xác minh thủ công trong trường hợp biển số mờ hoặc sự cố kỹ thuật.
  - Khởi tạo phiên đỗ xe thực tế (`ParkingSession`) và cập nhật slot thành `Occupied`.
- **FR-11 (Check-out & Tính phí):**
  - Truy xuất `ParkingSession` đang hoạt động, tính toán cước phí chính xác theo `PricingSnapshot` đã chốt lúc vào.
  - Thu tiền qua cổng VNPay Sandbox hoặc tiền mặt (`Cash`) có sự phê duyệt của Staff.
  - Chỉ khi xe thực tế rời cổng ra (xác nhận bởi barrier/camera hoặc Staff), session mới chuyển sang `Completed` và slot mới trở về `Available`.

### 1.5. Phân quyền theo Phạm vi Cơ sở (Facility-Scoped RBAC)
- **FR-12 (Phân cấp tài khoản):**
  - `Guest`: Tìm kiếm bãi, xem giá, tạo booking vãng lai một lần có OTP/token.
  - `Customer`: Quản lý xe, lịch sử đặt chỗ, vé điện tử QR, thanh toán.
  - `Parking Staff`: Vận hành trực tiếp tại các bãi xe được phân công qua bảng `FacilityStaffAssignment`.
  - `Parking Manager`: Quản lý biểu giá, mặt bằng slot, nhân viên và xem báo cáo trong phạm vi các bãi xe được phân công.
  - `Admin`: Quản lý toàn bộ nền tảng xuyên cơ sở (Cross-lot).

---

## 2. Yêu cầu Phi chức năng (Non-Functional Requirements - NFR)

### 2.1. Tính Toàn vẹn & Chống Race Condition
- **NFR-01 (Zero Double-Booking):** Đảm bảo 0 lỗi đặt trùng slot trong các kịch bản kiểm thử tải cao (Concurrency Test) nhờ kết hợp **PostgreSQL Advisory Lock** (`pg_advisory_xact_lock`) và **GiST Exclusion Constraint**.
- **NFR-02 (Idempotency):** Toàn bộ Webhook thanh toán (VNPay callback) và sự kiện từ camera simulator phải hỗ trợ cơ chế Idempotency Key, chống duplicate transaction.

### 2.2. Hiệu năng Chấp nhận cho Đồ án (OJT Acceptance Targets)
- **NFR-03 (Thời gian phản hồi API):**
  - Common API (CRUD, Slots, Profile): p95 < 1.0 giây.
  - Parking Search (Nearest/Cheapest): p95 < 2.0 giây.
  - Booking Transaction: < 2.0 giây dưới tải 100 concurrent demo users.
  - Lan truyền sự kiện Real-time (WebSocket / SignalR): < 1.0 giây.
- **NFR-04 (Tải bản đồ 3D):** Thời gian tải và render ban đầu của mô hình 3D cho một tầng/bãi < 3.0 giây trên máy demo.

### 2.3. Bảo mật & Tính Riêng tư (Security & Privacy)
- **NFR-05 (Bảo vệ thông tin cá nhân):** Tuân thủ Nghị định 13/2023/NĐ-CP; không để lộ số điện thoại, biển số xe đầy đủ qua API công khai.
- **NFR-06 (An toàn Mật khẩu & Token):** Băm mật khẩu bằng BCrypt/Argon2; JWT Bearer Token có thời hạn và refresh policy rõ ràng; không bao giờ ghi log mật khẩu hoặc VNPay secret key.
- **NFR-07 (Append-Only Audit Logs):** Nhật ký kiểm toán không thể bị sửa đổi hoặc xóa; lưu vết mọi hành vi thay đổi giá, phân quyền, override barrier và xác nhận thu tiền mặt.
