# Kết quả kiểm tra design V4 AI — 2026-10-03

Lệnh: `node database-v4/validate-design.cjs`.

- PASS: 47 bảng (42 core V3 + 5 bảng AI), 90 Ref, 6 TableGroup; mỗi bảng thuộc đúng một group.
- PASS: endpoints Ref tồn tại, số cột và kiểu dữ liệu hai đầu khớp.
- PASS: nội dung 42 bảng core V3 không đổi.
- PASS: cột/kiểu và FK của 5 bảng AI giữa DBML và SQL khớp; uniqueness của revision tài liệu chung dùng `NULLS NOT DISTINCT` trong SQL.
- PASS: đủ 3 Activity Diagrams + 3 Sequence Diagrams cho 3 API trong đặc tả AI.
- PASS: `git diff --check` không báo lỗi whitespace trong các tài liệu được sửa.

Đây là kiểm tra tĩnh bằng script, **chưa xác nhận bằng parser DBML chính thức, chưa chạy SQL trên PostgreSQL**, chưa kiểm chứng EF migration/AI providers hay nghiệp vụ runtime. Không có database thật nào bị thay đổi. PostgreSQL execution/FK/CHECK tests và tích hợp ORM vẫn là công việc Implementation, vì core V3 hiện là design và chưa thống nhất với schema backend đang có.
