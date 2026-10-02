# 02 - QUY TẮC NGHIỆP VỤ (BUSINESS RULES — BASELINE V4)

## 1. Vòng đời Trạng thái Booking (Booking Lifecycle)

```text
       [ Khách tạo Đơn ]
              │
              ▼
      ┌────────────────┐
      │ PENDING_PAYMENT│ (Giữ chỗ tạm trong thời gian Hold)
      └───────┬────────┘
              │
      ┌───────┴────────────────────────┐
      │ [Thanh toán / Xác nhận]        │ [Hết hạn Hold / Không xác nhận]
      ▼                                ▼
┌───────────┐                       EXPIRED
│ CONFIRMED │                          │
└─────┬─────┘                          ▼
      │                          [Tài nguyên trả về
      │                           trạng thái trống]
      ├───────────────────────┬────────────────────────┐
      │ [Hủy trước giờ]       │ [Xe vào bãi Check-in]  │ [Quá giờ mà không đến]
      ▼                       ▼                        ▼
  CANCELLED               CHECKED_IN                NO_SHOW
      │                       │                        │
      ▼                       ▼                        ▼
[Hoàn tiền theo          [Khởi tạo               [Xử lý vi phạm
 chính sách bãi]      ParkingSession]             theo quy định]
                              │
                              ▼
                          COMPLETED
                              │
                              ▼
                     [Xe thực tế rời bãi
                      -> Slot giải phóng]
```

### Ý nghĩa Chuẩn của các Trạng thái:
- **`PendingPayment` (0):** Tài nguyên đang được tạm giữ trong thời gian hold chờ thanh toán phí đặt trước (nếu bãi có thu phí).
- **`Confirmed` (1):** Đặt chỗ hợp lệ đã được xác nhận và cam kết tài nguyên.
- **`CheckedIn` (2):** Xe đã tới cổng bãi xe, quét mã QR/biển số thành công và mở barrier vào bãi.
- **`Completed` (3):** Phiên gửi xe kết thúc và nghĩa vụ thanh toán đã hoàn tất.
- **`Cancelled` (4):** Người dùng hoặc hệ thống chủ động hủy trước khung giờ quy định.
- **`Expired` (5):** Đơn vị giữ chỗ (`PendingPayment`) bị hết hạn do khách không hoàn thành xác nhận/thanh toán trong thời gian hold.
- **`NoShow` (6):** Đơn đã `Confirmed` nhưng khách hàng không xuất hiện trong khoảng thời gian cho phép (Arrival Window).

---

## 2. Bảng Quy tắc Nghiệp vụ Tổng thể (Master Business Rules — BR-01 đến BR-25)

| Mã Rule | Tên Quy tắc | Nội dung Chi tiết |
| :--- | :--- | :--- |
| **BR-01** | **Facility-Scoped RBAC** | `Staff` và `Manager` chỉ có quyền thao tác dữ liệu trên các bãi đỗ (`ParkingLot`) được gán trong `FacilityStaffAssignment`. Quản lý bãi A không có quyền can thiệp bãi B. |
| **BR-02** | **Lot Operational State** | Bãi xe phải có trạng thái `ACTIVE` mới được phép tiếp nhận đơn đặt chỗ (`Booking`) mới hoặc cho xe vãng lai vào bãi. |
| **BR-03** | **Vehicle Compatibility** | Booking chỉ được tạo khi loại phương tiện của xe (`Motorbike`, `Car`) tương thích với loại phương tiện bãi xe/khu vực hỗ trợ. |
| **BR-04** | **Slot Feature Matching** | Khi chọn chế độ `ExactSlot`, các yêu cầu đặc biệt của xe (sạc điện EV, kích thước, khuyết tật) phải khớp với các `SlotFeature` của vị trí đó. |
| **BR-05** | **Slot Time-Window Overlap** | Nghiêm cấm 2 booking có khoảng thời gian giữ chỗ `[StartAt, EndAt)` chồng lấn nhau trên cùng một `ParkingSlot`. |
| **BR-06** | **Vehicle Overlap Guard** | Một phương tiện (`Vehicle` / `NormalizedPlate`) không được có các booking `CONFIRMED` hoặc `PENDING_PAYMENT` có khung thời gian chồng lấn nhau (vẫn cho phép đặt nhiều booking trong ngày nếu các khung giờ tách biệt). |
| **BR-07** | **Atomic Availability Re-check** | Trước khi chuyển trạng thái booking sang `CONFIRMED`, hệ thống bắt buộc phải kiểm tra lại tính khả dụng của slot trong cùng một Database Transaction có khóa Advisory Lock. |
| **BR-08** | **Hold Window Policy** | Thời gian giữ chỗ chờ thanh toán (`PendingPayment`) mặc định là **15 phút** theo chuẩn SRS Mentor (có thể cấu hình theo `ParkingPolicy`). |
| **BR-09** | **Booking Duration Bounds** | Thời lượng đặt chỗ hợp lệ: Tối thiểu **30 phút**, tối đa **24 giờ** cho mỗi lượt đặt đơn lẻ (có thể cấu hình). |
| **BR-10** | **Confirmed Resource Invariant** | Một booking đã ở trạng thái `CONFIRMED` là cam kết tài nguyên bất biến, không một người dùng nào khác (kể cả Customer hay Guest) được phép ghi đè. |
| **BR-11** | **Check-in Validation** | Check-in chỉ thành công khi xe đến đúng bãi xe, đúng phương tiện và trong khung giờ cho phép (ví dụ: đến sớm tối đa 15 phút, trễ tối đa 30 phút). Nếu có sai khác, phải có Staff xác minh và ghi vết Audit. |
| **BR-12** | **Single Active Session** | Một phương tiện chỉ được phép có duy nhất **01 phiên đỗ xe thực tế (`ParkingSession`) ở trạng thái `ACTIVE`** tại cùng một thời điểm trên toàn hệ thống. |
| **BR-13** | **Occupancy by Physical Event** | Một slot chỉ được tính là `OCCUPIED` khi có phiên đỗ vật lý thực tế (`ParkingSession` đang `ACTIVE`) hoặc sự kiện cảm biến/camera được hệ thống xác nhận. |
| **BR-14** | **Payment Idempotency** | Toàn bộ giao dịch thanh toán và webhook callback từ cổng thanh toán (VNPay) phải có cơ chế chống trùng lặp (`IdempotencyKey`), bảo đảm không trừ tiền hoặc cập nhật trạng thái trùng 2 lần. |
| **BR-15** | **Barrier Exit Policy** | Barrier cổng ra chỉ được mở khi toàn bộ nghĩa vụ tài chính đã hoàn tất (thanh toán đủ hoặc có thẻ thành viên hợp lệ) và xe đã sẵn sàng tại vị trí xuất bãi. |
| **BR-16** | **Lot-Specific Pricing Resolution**| Cước phí gửi xe bắt buộc phải tính theo biểu giá (`PricingPlan`) của chính bãi xe đó tại thời điểm xe gửi. Không sử dụng một công thức cố định toàn hệ thống. |
| **BR-17** | **Estimated Duration Pricing** | Giá hiển thị trong bộ lọc tìm kiếm "Rẻ nhất" (`CHEAPEST`) phải là giá ước tính cho toàn bộ thời lượng dự kiến gửi xe (`expectedDuration`), tính đến block thời gian (default 15 phút), phụ phí và trần giá ngày; không được chỉ so sánh đơn giá 1 giờ đầu. |
| **BR-18** | **Haversine Distance Baseline** | Khoảng cách trong bộ lọc tìm kiếm "Gần nhất" (`NEAREST`) tính theo công thức **Haversine** (đường chim bay theo tọa độ GPS); không được tự ý gọi đây là quãng đường lái xe thực tế nếu chưa tích hợp Map Routing API. |
| **BR-19** | **Database as Source of Truth** | Giao diện 3D chỉ là tầng hiển thị (`Presentation Layer`). Màu sắc và trạng thái mesh 3D không bao giờ được tự ý quyết định trạng thái nghiệp vụ; mọi trạng thái phải đồng bộ từ CSDL PostgreSQL. |
| **BR-20** | **No AI/Simulator Financial Penalty**| Camera thông minh và Simulator chỉ gửi sự kiện nghi vấn (`Operational Alert / Issue Reported`). Hệ thống nghiêm cấm AI hoặc thiết bị tự động phạt tiền khách hàng nếu chưa qua sự phê duyệt của Staff/Manager. |
| **BR-21** | **Audit Manual Overrides** | Mọi thao tác thủ công của con người (thay đổi giá vé, đổi trạng thái bảo trì slot, mở barrier khẩn cấp, xác nhận thu tiền mặt) bắt buộc phải ghi nhật ký `AuditLog` kèm lý do giải trình. |
| **BR-22** | **Maintenance Slots Exclusion** | Các slot có trạng thái vận hành là `MAINTENANCE` hoặc `DISABLED` không được tính vào số chỗ trống khả dụng và bị loại khỏi danh sách cấp phát tự động. |
| **BR-23** | **Slot Failure Reallocation** | Nếu slot đã được confirm gặp sự cố hỏng hóc hoặc xe khác đỗ nhầm, hệ thống tự động tìm slot thay thế tương đương trong cùng bãi hoặc thông báo Staff xử lý thủ công; tuyệt đối không âm thầm hủy đơn của khách. |
| **BR-24** | **Cash Payment Verification** | Mọi khoản thanh toán bằng tiền mặt (`Cash`) phải có định danh nhân viên (`StaffId`) chịu trách nhiệm thu tiền và xác nhận trên hệ thống. |
| **BR-25** | **Guest Resource Equality** | Booking hợp lệ của khách vãng lai (`Guest`) được bảo vệ quyền giữ chỗ công bằng như khách có tài khoản (`Customer`), không bị ưu tiên cướp slot. |

---

## 3. Các Quy tắc Đã Hiệu chỉnh So với Bản Cũ (Adjustments from V2/V3)

1. **Bãi bỏ giả định "Chỉ có 1 bãi 3 tầng":** Đổi sang nền tảng Multi-Parking Lot; các tầng F01, F02, F03 chỉ là dữ liệu mẫu của bãi demo.
2. **Bãi bỏ quy tắc khóa cứng "Dung lượng >90% thì khóa":** Đổi thành chính sách cấu hình theo từng bãi và từng loại phương tiện:
   - `warningOccupancyPercent` (ví dụ: cảnh báo khi đạt 90%).
   - `admissionStopPercent` (ngừng nhận xe khi đạt 100% hoặc mức cấu hình).
   - `reservedCapacity` (số lượng chỗ đệm dự phòng cho xe khẩn cấp/walk-in).
3. **Hiệu chỉnh thời điểm giải phóng Slot:** Slot **không** được giải phóng ngay khi khách bấm thanh toán thành công nếu xe vật lý vẫn đang đỗ trong slot. Slot chỉ được chuyển về `Available` khi xe vật lý thực sự rời bãi (xác nhận bởi cảm biến/barrier hoặc Staff).
4. **Bãi bỏ mức phạt vi phạm cố định 100.000đ:** Chuyển sang bảng quy tắc phạt linh hoạt (`PenaltyRule`) theo bãi, theo loại phương tiện và loại vi phạm (đỗ sai ô, đỗ sai khu vực, mất vé, quá giờ).
