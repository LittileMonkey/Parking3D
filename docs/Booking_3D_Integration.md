# Luồng tìm bãi và chọn chỗ 3D

## Luồng khách hàng

1. `/booking` hiển thị tiêu chí tìm bãi và kết quả từ API.
2. Chọn **Chọn bãi và xem sơ đồ 3D** để mở `/booking/lot/:lotId`; các tiêu chí thời gian, loại xe, thứ tự tìm và tọa độ (nếu có) được giữ trong URL.
3. Màn hình riêng tải availability và layout của bãi đã chọn. Khách chọn tầng, rồi chọn slot trên mô hình 3D hoặc danh sách hỗ trợ.
4. Availability được làm mới định kỳ và qua SignalR khi có kết nối. API vẫn kiểm tra lại slot và khoảng thời gian trước khi tạo booking.

Trang dùng `ParkingViewer` và dữ liệu layout/availability của bãi đang chọn; không gán slot theo thứ tự trả về và không dùng màu mesh làm nguồn chân lý. Các slot không khả dụng không thể chọn. Nếu WebGL không hoạt động, danh sách slot vẫn có thể truy cập; thao tác đặt chỗ vẫn tuân theo availability từ API.

Khách cần đăng nhập và có phương tiện phù hợp để tạo booking. Chế độ chọn chính xác gửi slot ID từ API; chế độ tự động để backend phân bổ. Sau khi tạo booking, khách được chuyển đến trang trạng thái booking. Giao diện không tự giả lập thanh toán, không tự mở barrier và không tuyên bố slot còn trống nếu API chưa xác nhận.

## Responsive và giao diện

Font chữ toàn ứng dụng dùng Be Vietnam Pro, lấy từ trang chủ; màu thương hiệu dùng teal `#087f8c`, navy `#0e2634`, nền `#f5f8fa` và viền `#dce6e8`. Màn hình tìm kiếm và chọn chỗ được bố trí thích ứng từ màn hình hẹp đến desktop; layout 3D chuyển sang một cột khi không đủ chiều rộng.

## Kiểm chứng

- `npm run build`
- `npm run test:parking`
- Kiểm tra trình duyệt ở các chiều rộng 320, 375, 768, 1024 và 1440 px; kiểm tra đổi từ kết quả sang `/booking/lot/:lotId` và khả năng quay lại.
