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

## SCRUM-100 — cập nhật Parking database đã tồn tại

Schema mới khai báo `lot_vehicle_policies.hold_minutes DEFAULT 5`. Với Parking database đã có service schema version 1, áp dụng script riêng:

```powershell
psql -X -v ON_ERROR_STOP=1 -d <parking_database> -f database/services/parking/migrations/002_hold_default_5_minutes.sql
```

Script chạy trong transaction, có thể chạy lại và ghi schema version 2. Chỉ hai policy demo còn giá trị cũ 15 phút được backfill thành 5 ở lần áp dụng đầu; policy bãi khác hoặc giá trị tùy chỉnh được giữ nguyên và cần rà riêng. Không sửa `bookings.hold_expires_at`, reservation hoặc assignment đang có xe. Không chạy lại `001_schema.sql` trên database đã có dữ liệu.

Kiểm tra sau migration:

```sql
SELECT lot_id, vehicle_type, hold_minutes FROM lot_vehicle_policies ORDER BY lot_id, vehicle_type;
SELECT column_default FROM information_schema.columns
WHERE table_schema='public' AND table_name='lot_vehicle_policies' AND column_name='hold_minutes';
SELECT version FROM service_schema_versions ORDER BY version;
```

## SCRUM-114 — ràng buộc bàn giao trên database đã tồn tại

Sau khi đã có các bảng từ migration 003, áp dụng migration nâng cấp.

```powershell
psql -X -v ON_ERROR_STOP=1 -d <parking_database> -f database/services/parking/migrations/009_handover_integrity.sql
```

Migration bổ sung unique `(id, lot_id)`, composite foreign key `(handover_id, lot_id)` và điều kiện người giao khác người nhận. Script có thể chạy lại và ghi schema version 9. PostgreSQL kiểm tra dữ liệu hiện có trong cùng transaction. Nếu dữ liệu vi phạm constraint, transaction thất bại và cần xử lý bản ghi vi phạm trước khi áp dụng lại.

## Ảnh chứng cứ Parking

Migration `010_incident_evidence.sql` tạo bảng ảnh riêng theo bãi. Ảnh PNG/JPEG tối đa 4 MiB được lưu trong `bytea` cùng SHA-256, actor và thời điểm tải lên. API đọc ảnh kiểm tra quyền hiện tại theo bãi và trả envelope JSON. Contract nằm trong [EVIDENCE-API.md](../../docs/microservices/EVIDENCE-API.md).

```powershell
psql -X -v ON_ERROR_STOP=1 -d <parking_database> -f database/services/parking/migrations/010_incident_evidence.sql
```

`Seed-DockerDemo.ps1` áp dụng cả migration 009 và 010 trước khi seed. Fixture demo bổ sung bản đồ PUBLISHED, giữ dữ liệu sẵn có và có thể chạy lại. Script tạo assignment Manager theo bãi cho tài khoản bootstrap Admin, bắt đầu ca của tài khoản này và demo Staff để kiểm tra bàn giao hai phía.
