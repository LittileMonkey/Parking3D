# Kiểm tra database — 06/10/2026

## Đã chạy

- Export/validation tĩnh: 47 bảng, 8 enum, 90 Ref; cột đích tồn tại và khóa đích FK là candidate key.
- SQL đầy đủ đã thực thi thành công trong PostgreSQL 18.3 WASM, PGlite 0.5.8, database bộ nhớ mới; extension btree_gist tải thành công.
- **15 kiểm tra đạt**: đủ 47 bảng; đủ 5 exclusion constraints; chặn booking xe trùng giờ; cho phép hai dải giờ liền kề; chặn reservation trùng; tạo session + assignment cùng transaction; chặn complete khi chưa đóng assignment; cho phép physical exit nguyên tử; chặn DELETE/TRUNCATE audit; chặn sửa pricing snapshot; chặn occupancy vượt capacity; chặn publish assistant chưa duyệt; chặn global document revision trùng với lot NULL; thực thi advisory lock helper.
- Không chạy lên database thật; không sửa dữ liệu của nhóm.

## Chưa kiểm chứng

- Chạy native PostgreSQL 17 trên máy triển khai, permission/extension/configuration thực tế.
- Concurrency nhiều connection, deadlock/retry, tải lớn và transaction backend.
- Entity/mapping/migration Clean Architecture, policy/RBAC, callback VNPay, OCR/forecast/assistant runtime.
- Mọi kết hợp giá/refund/rule/status nghiệp vụ. DBML chưa chốt toàn bộ danh mục text; service vẫn phải validate.

Đây là bằng chứng kiểm tra schema và một số bất biến, không phải nghiệm thu API hay xác nhận toàn bộ hệ thống hoàn thành.
