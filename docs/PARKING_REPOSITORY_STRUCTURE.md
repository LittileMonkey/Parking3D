# Cấu trúc ParkingRepository

Các file dưới `src/Services/Parking/Parking.Parking.Persistence/Repositories/` là
những phần của cùng một `partial class ParkingRepository`, không phải service riêng.

## Check-in

- `CheckIn.cs`: điều phối check-in bằng QR.
- `CheckIn.WalkIn.cs`: điều phối check-in khách vãng lai.
- `CheckIn.WalkIn.Vehicle.cs`: đăng ký xe, khóa VEHICLE, kiểm tra active session.
- `CheckIn.WalkIn.Allocation.cs`: xếp hạng, khóa và kiểm tra lại ô đỗ.
- `CheckIn.WalkIn.Pricing.cs`: lấy hoặc tạo snapshot giá.
- `CheckIn.Helpers.cs`: fingerprint, payload sự kiện và lưu cảnh báo lệch biển số.

Các bước walk-in nhận command factory của hàm điều phối, dùng cùng connection,
transaction và tham số đã xác minh. Chỉ hàm điều phối commit. Thứ tự khóa vẫn là
VEHICLE → SLOT advisory → row; savepoint khi bỏ ứng viên không thay transaction chính.

## Sự cố và bàn giao

- `Incidents.cs`, `Handovers.cs`: tạo mới và quy tắc liên quan.
- `*.Queries.cs`: danh sách, chi tiết, lịch sử.
- `Incidents.Status.cs`, `Incidents.Reopen.cs`, `Incidents.Cancel.cs`: chuyển trạng thái.
- `Incidents.Decisions.cs`: quyết định xử lý xuất bãi.
- `Handovers.Confirm.cs`, `Handovers.Reassign.cs`: xác nhận và đổi người nhận.

## Helper dùng chung

- `Idempotency.cs`: khóa request, kiểm tra replay/fingerprint và lưu outcome.
- `Audit.cs`: ghi audit bằng connection/transaction do caller truyền vào.

Tên hàm private đã bỏ tiền tố Scrum99. Chuỗi scope, event type, cách serialize/hash
và cấu trúc inbox giữ nguyên để tương thích request đã ghi trước khi refactor.
Upload bằng chứng cũng gọi các helper này. Không hợp nhất cơ chế idempotency riêng
của check-in vào helper chung vì cần giữ nguyên contract và hash cũ.

Cảnh báo lệch biển số bị từ chối vẫn được ghi ngoài transaction check-in bị rollback
theo hành vi hiện có; các bước tạo session thành công vẫn commit nguyên tử.
