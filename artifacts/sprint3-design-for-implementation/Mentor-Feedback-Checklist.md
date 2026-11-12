# Traceability feedback mentor — Sprint 3

Chỉ là phạm vi QA; các trạng thái dưới đây không thay trạng thái Jira live. Quang test Staff/API và tổng hợp; Phát phối hợp Customer/AI; owner dev xử lý code.

| ID | Góp ý/requirement | Owner triển khai | Cách nghiệm thu | Evidence hiện có / còn cần |
|---|---|---|---|---|
| MF01 | Một luồng tìm bãi/3D/chọn slot | A.Đức | Giữ xe/bãi/time; booking thật; back/forward không mất dữ liệu | 577064b: /search redirect /booking, rendering PASS; full UI còn NOT_RUN |
| MF02 | Font, nhãn/menu/nút không rớt chữ ngoài ý muốn | A.Đức/Tiến | Desktop/mobile/keyboard; đoạn văn được wrap tự nhiên | Có screenshot rendering; chưa audit toàn bộ trang |
| MF03 | Màu chữ dưới filter, tương phản và focus | A.Đức/Tiến | Kiểm tra trực tiếp các trạng thái enabled/disabled/error | NOT_RUN ở mức acceptance |
| MF04 | Thông báo sản phẩm học tập trên layout công khai | A.Đức | Nội dung dễ thấy, nhất quán các trang | Cần retest layout mới be3b5f6 |
| MF05 | Camera/reset, state label và fallback danh sách 3D | A.Đức | Nhiều bãi/tầng, selected khác occupied, WebGL lỗi vẫn chọn được | FE realtime parser4PASS; không thay integration3D |
| MF06 | Sơ đồ Staff đúng bãi và offline/reconnect rõ | Tiến/Hàn/Nhật | Không chuyển sang mock khi API lỗi; snapshot đúng sau reconnect | Source mới có API; còn fallback, cần runtime retest |
| MF07 | Sự cố/bàn giao có người báo/giao/nhận, xác nhận và audit | Hàn/Tiến/N.Đức | Sai người/bãi bị từ chối; lịch sử DB còn sau reload | NOT_RUN |
| MF08 | Mã1201 và thông báo rõ, ổn định | N.Đức | Mapping errorCode/message/status; FE không so message | 1201 trước đây là PhoneAlreadyExists; kiểm enum/endpoint của commit chạy |
| MF09 | Response login tối thiểu, token/expiry nhất quán | N.Đức/A.Đức | Contract test và login FE; không dư PII | API login thật PASS577064b; cần retest FE trên base mới |
| MF10 | NewPassword null/rỗng/whitespace không500 | N.Đức | Test biên/ownership,400 đúng contract; build0warning | Chưa có acceptance ChangePassword trong gói |
| MF11 | Dependency không dùng được xác minh trước xóa | Owner service/Nhật | Usage inventory, restore/build/test sau thay đổi | Build577064b0warning; không chứng minh đã dọn hết dependency |
| MF12 | Không thành công giả khi CASH/check-in lỗi | Tiến/Sơn | API/network lỗi/timeout/retry và DB assertions | Source be3b5f6 còn operational fallback; retest chưa chạy |
| MF13 | Giá đúng bãi/xe/time; thiếu giá không0 | Sơn/A.Đức | Oracle block/cap/peak/timezone; đổi tiêu chí invalidates quote | Search API thật PASS577064b; chưa full pricing acceptance |
| MF14 | Hold5 theo cập nhật SCRUM-100 | Hàn/A.Đức/Nhật | DB deadline, boundary và không release physical occupancy | FE countdown5PASS; DB test trong suite577064b |

ArgumentNullException có sẵn trong .NET; không tạo task cài thư viện để xử lý null. Bằng chứng root-cause và before/after test mới là tiêu chí sửa warning.
