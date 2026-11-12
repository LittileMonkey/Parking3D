# Database V4 — AI extension design

Bổ sung theo yêu cầu nhóm ngày 2026-10-03: OCR từ ảnh upload, dự báo công suất bãi, trợ lý hướng dẫn người mới. Xem [đặc tả AI](../docs/11-AI-EXTENSION.md).

- `Parking_Database_V4_AI.dbml`: ERD đầy đủ gồm 42 bảng core V3 + 5 bảng AI, dùng import vào công cụ DBML.
- `ai-extension.dbml`: phần AI riêng để đọc diff; cần core V3 khi parse, không phải ERD standalone.
- `001_ai_extension.sql`: DDL bổ sung có CHECK, FK, indexes, transaction và kiểm tra prerequisite. Chỉ dùng với core V3 snake_case trong `public`; **không phải full schema tạo mới**, không chạy sau SQL prototype `ParkingProject/Database/001_initial.sql` hoặc schema PascalCase của `database-work`.

Không sửa bản V3 đầu vào. Không có database thật nào được migrate trong lần cập nhật thiết kế này. Ứng dụng hiện tại chưa có entity/mapping/API AI; các endpoint trong tài liệu là contract dự kiến, chưa hoạt động.

## Quy trình triển khai sau design

1. Chọn core schema triển khai của nhóm, map đúng tên bảng/khóa và đối chiếu DBML V3 với schema thật.
2. Tạo nhánh Implementation riêng, thêm entity/configuration và migration của schema đã chọn. Không dùng đồng thời EF auto-create và SQL độc lập trên hai mô hình khác nhau.
3. Chạy DDL/migration trong PostgreSQL test, kiểm chứng FK/CHECK/dedupe, không thay đổi GiST/locks của nghiệp vụ core.
4. Nối adapters OCR/storage, snapshot/forecast worker và assistant retrieval; API key chỉ qua cấu hình backend.
5. Duyệt hướng dẫn từng bãi, thu dữ liệu công suất, kiểm chứng OCR/forecast/chatbot theo tiêu chí trong đặc tả.

## Kiểm tra thiết kế

Chạy `node database-v4/validate-design.cjs` để kiểm tra bảng/Ref/TableGroup, core V3 được giữ nguyên và 5 bảng AI có cùng cột/FK trong DBML/DDL. Đây là kiểm tra tĩnh, không thay thế DBML parser hoặc chạy PostgreSQL.
