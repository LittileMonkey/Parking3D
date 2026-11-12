# 08 - CÁC QUYẾT ĐỊNH THIẾT KẾ KIẾN TRÚC (ARCHITECTURAL DECISION RECORDS — BASELINE V4)

## ADR-01: Chuyển dịch từ Mô hình Đơn bãi sang Nền tảng Đa Bãi Đỗ Xe (Multi-Parking Lot)
- **Bối cảnh:** Các phiên bản ban đầu (V2/V3) giả định cứng hệ thống chỉ có một tòa nhà duy nhất gồm 3 tầng F01, F02, F03. Điều này mâu thuẫn trực tiếp với yêu cầu cốt lõi của Mentor (`context.md` và `SRS-Parking-System.md`) về khả năng mở rộng chuỗi bãi đỗ tại nhiều địa điểm.
- **Quyết định:** Tái cấu trúc toàn bộ mô hình dữ liệu thành nền tảng **Multi-Parking Lot**. Thêm thực thể `ParkingLot` làm gốc (Aggregate Boundary). Các tầng (`ParkingLevel`), khu vực (`Zone`), vị trí đỗ (`ParkingSlot`), biểu giá (`PricingPlan`) và phân quyền nhân viên (`FacilityStaffAssignment`) đều gắn trực tiếp với `ParkingLotId`.
- **Hệ quả:** Hệ thống hỗ trợ linh hoạt mọi loại bãi (bãi ngầm nhiều tầng, bãi ngoài trời 1 tầng, bãi phức hợp có trạm sạc EV) mà không cần thay đổi cấu trúc mã nguồn.

---

## ADR-02: Lựa chọn Thuật toán Tìm Bãi Gần nhất (`NEAREST`) & Rẻ nhất (`CHEAPEST`)
- **Bối cảnh:** Người dùng cần công cụ hỗ trợ ra quyết định chọn bãi đỗ tối ưu dựa trên vị trí địa lý và chi phí gửi.
- **Quyết định:**
  1. **`NEAREST`:** Sử dụng công thức toán học **Haversine** đo khoảng cách đường chim bay dựa trên tọa độ GPS (kinh độ, vĩ độ). Đây là giải pháp độc lập, tốc độ tính toán nhanh $O(N)$, không phụ thuộc API trả phí của bên thứ ba trong giai đoạn thử nghiệm.
  2. **`CHEAPEST`:** Không so sánh đơn giá theo giờ đơn giản! Xây dựng `EstimatedPriceService` để mô phỏng toàn bộ cước phí cho thời lượng dự kiến gửi xe (`expectedDuration`), tính đến block thời gian (billing unit 15 phút), phụ phí và mức trần theo ngày (daily cap) của từng bãi.
- **Hệ quả:** Cung cấp thông tin minh bạch, chính xác cho khách hàng trước khi bấm đặt chỗ.

---

## ADR-03: Bản đồ 3D Hướng Dữ liệu (Data-Driven 3D Layout)
- **Bối cảnh:** Nếu mỗi bãi xe phải dựng một file mô hình 3D riêng biệt (GLTF/OBJ) thì chi phí duy trì rất cao và khó cập nhật khi bãi xe thay đổi quy hoạch vị trí đỗ.
- **Quyết định:** Triển khai bản đồ 3D hướng dữ liệu (`MapVersion` -> `MapObject`). Tọa độ $X, Y, Z$, góc xoay, kích thước và loại đối tượng (slot, đường đi, tường, trạm sạc) được lưu trữ trong CSDL PostgreSQL. Client Three.js đọc dữ liệu qua API và render động bằng `InstancedMesh`.
- **Hệ quả:** **CSDL là Nguồn chân lý duy nhất (Source of Truth)**. Trạng thái và tọa độ không gian luôn đồng bộ hoàn hảo giữa Web 3D và logic nghiệp vụ backend.

---

## ADR-04: Kiểm tra Trùng lặp theo Dải Thời gian (Time-Window Overlap Guard)
- **Bối cảnh:** Quy tắc cũ cấm 1 xe không được có nhiều hơn 1 booking toàn thời gian, hoặc chuyển slot sang `RESERVED` khóa cứng cả ngày, dẫn đến lãng phí công suất bãi đỗ.
- **Quyết định:** Áp dụng ràng buộc dải thời gian `tstzrange` kết hợp **PostgreSQL Exclusion Constraints GiST**:
  - Một xe được phép đặt nhiều booking trong tương lai miễn là các khung giờ `[StartAt, EndAt)` không giao thoa nhau.
  - Một vị trí đỗ có thể đón nhiều xe khác nhau vào các khung giờ tách biệt trong ngày.
- **Hệ quả:** Tối đa hóa tỷ lệ lấp đầy của bãi xe mà vẫn đảm bảo tính toàn vẹn tuyệt đối (Zero Double-Booking).

---

## ADR-05: Phân quyền Phạm vi Cơ sở (Facility-Scoped Authorization)
- **Bối cảnh:** Trong hệ thống chuỗi nhiều bãi đỗ xe, nhân viên hoặc quản lý bãi A không được phép can thiệp vào doanh thu, kiểm soát cổng hay sửa giá của bãi B.
- **Quyết định:** Tạo bảng `FacilityStaffAssignment` liên kết `UserId`, `ParkingLotId` và `Role`. Middleware phân quyền tự động kiểm tra quyền hạn của nhân sự trên bãi xe được yêu cầu trong mọi thao tác nhạy cảm.
- **Hệ quả:** Đảm bảo an toàn dữ liệu và phân tách trách nhiệm vận hành độc lập giữa các chi nhánh.

---

## ADR-06: Ranh giới Rõ ràng giữa AI/Camera Simulator và Quyết định Tài chính
- **Bối cảnh:** Nhận diện camera (ANPR) hoặc cảm biến IoT trong thực tế có thể xảy ra sai số (mờ biển, góc khuất, phản xạ ánh sáng).
- **Quyết định:** Camera và Simulator chỉ có quyền phát tín hiệu sự kiện nghi vấn (`CameraEvent` / `ParkingIssue Reported`). Nghiêm cấm hệ thống tự động ra phán quyết xử phạt tài chính hoặc tự động hủy đơn đặt chỗ của khách hàng nếu chưa qua sự phê duyệt và ghi nhận vết `AuditLog` của nhân viên vận hành (`Staff`).
- **Hệ quả:** Giảm thiểu rủi ro khiếu nại và tranh chấp pháp lý trong quá trình vận hành bãi đỗ xe.
