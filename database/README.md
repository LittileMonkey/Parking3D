# Parking Database V4 + AI

Bản schema đầy đủ của thiết kế V4 hiện có: **47 bảng = 42 bảng core + 5 bảng AI**, 8 enum, 90 quan hệ khai báo trong DBML. PostgreSQL là hệ quản trị đích; file thiết kế có đuôi **`.dbml`**, không phải file SQLite `.db`. Không tạo file `.db` giả bằng cách đổi tên.

## Các file

| File | Mục đích |
|---|---|
| `Parking_Database_V4.dbml` | ERD đầy đủ, import vào công cụ hỗ trợ DBML |
| `Parking_Database_V4.sql` | SQL tạo mới toàn bộ schema core + AI trong một transaction |
| `core_integrity.sql` | CHECK, GiST exclusion, partial indexes và triggers core; đã được nhúng vào SQL đầy đủ |
| `001_ai_extension.sql` | Chỉ bổ sung 5 bảng AI vào core V3 snake_case đã tồn tại; không chạy lại sau SQL đầy đủ |
| `build_schema.py` | Tái sinh SQL từ DBML + integrity + AI, kiểm tra bảng/cột/khóa ngoại |
| `validate_schema.cjs` | Kiểm tra SQL và ràng buộc trên PostgreSQL WASM trong bộ nhớ |
| `VALIDATION.md` | Bằng chứng kiểm tra và giới hạn |

## Tạo database Development mới

Chạy bằng `psql` với kết nối đến một **database trống dành riêng cho thử nghiệm**:

```powershell
psql -X -v ON_ERROR_STOP=1 -d parking_development -f database/Parking_Database_V4.sql
```

Host/user/password lấy từ cấu hình kết nối của người chạy, không lưu mật khẩu trong Git. Cần quyền tạo extension `btree_gist` và schema objects. SQL không xóa dữ liệu, không có `DROP TABLE`, không phải script chạy lặp. Lỗi bất kỳ trong transaction làm rollback toàn bộ.

**Không chạy thêm `core_integrity.sql` hoặc `001_ai_extension.sql` sau SQL đầy đủ.** Không chạy vào schema EF PascalCase hay database có bảng trùng tên. Đây là schema snake_case độc lập; BE phải thống nhất mapping/migration trước khi kết nối Clean Architecture mới. Không gọi `EnsureCreated` để tạo một mô hình khác cùng database.

## Ba AI được hỗ trợ về dữ liệu

- Nhận diện biển số từ ảnh: `ai_plate_recognitions`, ảnh private object key/hash, kết quả và confidence, Staff review, expiry, idempotency.
- Dự báo mức đầy: `occupancy_snapshots`, `occupancy_forecasts`; tách dữ liệu thật/giả lập, cutoff, horizon 30/60/120 phút và khoảng dự báo.
- Trợ lý hướng dẫn: `assistant_documents`, `assistant_document_chunks`; tài liệu công khai được duyệt, revision, hiệu lực và scope bãi.

Schema không tự triển khai OCR, mô hình dự báo hoặc chatbot. AI không tự mở cổng, thu tiền hoặc kết luận vi phạm.

## Những việc backend vẫn phải thực hiện

1. Mọi thay đổi admission/reservation/physical slot nằm trong transaction. Gọi `lock_parking_resource('VEHICLE', vehicle_id)` trước, rồi khóa các `SLOT` theo UUID tăng dần trước khi đọc lại trạng thái và ghi. GiST không thay thế workflow locks hay kiểm tra occupancy vật lý.
2. Hold quá hạn phải được chuyển trạng thái/release trong transaction; thời gian trôi không tự đổi status. Slot chỉ giải phóng sau xác nhận xe rời vật lý. Không dùng payment success thay chứng cứ exit.
3. Xác thực scope Staff/Manager và thời hạn assignment; kiểm tra policy/giờ mở/closures, quyền xe, QR signature/expiry/replay và full prepayment. FK không cấp quyền.
4. Tính giá theo snapshot/policy đã chốt; kiểm chứng chữ ký VNPay trước áp dụng callback, chống double effect, đối soát thu/hoàn và audit nguyên tử. Ledger dùng dòng điều chỉnh thay sửa lịch sử. Các danh mục text/policy còn mở cần được chốt trước khi thêm CHECK đặc thù.
5. Không trả PII qua API công khai; giữ ảnh private, retention/cleanup và duyệt tài liệu assistant. Các CHECK AI bảo vệ hình dạng dữ liệu, không thay RBAC hay quy trình duyệt.

**Phạm vi:** bản này giữ nguyên core 42 bảng của V3 và thêm AI, không tuyên bố khôi phục bản V2 54 bảng. Vé tháng, phiên sạc EV, điều hướng nội bộ và các extension đã hoãn không có trong schema này. Metadata slot/EV và quyền dùng chung xe vẫn được giữ theo thiết kế core. Không có dữ liệu seed thực tế, mật khẩu hoặc khóa API trong bộ.

## Tái sinh và kiểm tra

```powershell
python database/build_schema.py
node database/validate_schema.cjs <thu-muc-package-pglite>
```

Validator dùng `@electric-sql/pglite` 0.5.8 và extension `btree_gist`. Package thử nghiệm không được commit. Xem `VALIDATION.md` để biết kết quả thực tế; vẫn cần integration/concurrency tests trên PostgreSQL 17 của nhóm trước nghiệm thu.
