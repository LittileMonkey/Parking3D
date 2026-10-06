# Database sở hữu riêng theo microservice

Chạy mỗi `001_schema.sql` đúng một lần trên database trống của owner tương ứng. Các script độc lập, không cần database của service khác tồn tại. PostgreSQL 17, extension `btree_gist`.

| Owner | Bảng nghiệp vụ gốc | Bảng tổng sau bổ sung hạ tầng |
|---|---:|---:|
| Identity | 4 | 8 |
| Parking | 32 | 36 |
| Payment | 6 | 10 |
| AI | 5 | 10 |

47 bảng nghiệp vụ gốc được giữ đầy đủ. Audit cục bộ ở mỗi service; inbox/outbox/schema-version là technical tables thêm mới. Parking có payment receipt projection; AI có lot catalog dự kiến dùng cho event projection. `ownership.json` ghi owner từng bảng và mọi FK xuyên service đã bỏ. ID ngoại bộ không đồng nghĩa quyền truy cập; backend kiểm tra qua Identity/gRPC và quote/event contracts.

`scripts/microservices/split_database.py` tái sinh các schema từ bản monolith đã kiểm tra. Thay đổi schema phải sửa generator hoặc source, rồi kiểm tra diff, không sửa một output rồi chạy generator ghi đè.

Không drop/chuyển dữ liệu database thật tự động. Nếu đã có dữ liệu, cần migration/backfill riêng, snapshot dữ liệu đối chiếu và lịch cutover. Các file này phục vụ fresh Development deployment.
