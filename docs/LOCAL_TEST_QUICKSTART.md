# Chạy web và xem tài khoản mới ngay trong PostgreSQL local

Luồng này chạy bốn backend và Gateway trực tiếp trên Windows, dùng PostgreSQL trên máy. Sau khi đăng ký trên web, tài khoản nằm trong `parking_identity.public.app_users`, xem được ngay bằng pgAdmin. Không cần chạy các container của dự án.

## 1. Chuẩn bị

- PostgreSQL 17 hoặc mới hơn đang chạy trên máy, có `psql`, `pg_dump`, `pg_restore` từ bản cài PostgreSQL tương thích với server.
- Tài khoản PostgreSQL có quyền tạo database, extension `btree_gist` và cập nhật schema. Mặc định: `localhost:5432`, user `postgres`.
- .NET SDK 9 trở lên và Node.js 20 trở lên, cài dependencies frontend bằng `npm ci`.
- Pull code mới trước khi chạy. Dừng backend local đang chạy; nếu đang dùng Docker, dừng stack bằng `docker compose -f compose.microservices.yml down` để giải phóng cổng 8080. Không thêm `-v`.

## 2. Một lệnh đồng bộ DB và chạy backend

Từ thư mục gốc repository:

```powershell
.\scripts\microservices\Sync-LocalDatabases.ps1 -StartBackend
```

Nhập mật khẩu PostgreSQL của **máy bạn** khi được hỏi. Nếu đã có `LOCAL_POSTGRES_PASSWORD` trong `.env` thì script dùng giá trị đó; script không tự ghi mật khẩu PostgreSQL vào file. `.env` chưa có sẽ được tạo với secrets Development ngẫu nhiên, không sao chép secrets từ máy khác.

Nếu không tìm được công cụ PostgreSQL hoặc bạn dùng cổng/user khác:

```powershell
.\scripts\microservices\Sync-LocalDatabases.ps1 `
  -PgBin 'C:\Program Files\PostgreSQL\17\bin' `
  -Port 5432 -Username postgres -StartBackend
```

Đổi đường dẫn theo vị trí cài trên máy bạn. Có thể bỏ `-StartBackend` nếu chỉ muốn cập nhật database. Khởi động backend về sau bằng:

```powershell
.\scripts\microservices\Run-GitHubDev.ps1
```

Chỉ tiếp tục khi launcher báo `BE READY`. Kiểm tra Gateway tại <http://localhost:8080/health/ready>.

## 3. Chạy frontend và kiểm tra đăng ký

Mở terminal khác tại repository:

```powershell
cd frontend_parking_system
npm ci
npm run dev
```

Mở <http://localhost:5173>, đăng ký bằng email và số điện thoại chưa sử dụng. Trong pgAdmin, kết nối PostgreSQL **local cùng cổng đã chọn**, mở `parking_identity` → Query Tool, chạy:

```sql
SELECT id, full_name, email_normalized, created_at
FROM public.app_users
ORDER BY created_at DESC
LIMIT 10;
```

Chạy lại truy vấn/refresh để thấy tài khoản mới. Lưu dữ liệu không cần mở pgAdmin; pgAdmin là công cụ xem PostgreSQL đang chạy.

## 4. Script thay đổi những gì?

| Service | Database mặc định |
|---|---|
| Identity | `parking_identity` |
| Parking | `parking_parking` |
| Payment | `parking_payment` |
| AI | `parking_ai` |

- Kiểm tra cả bốn database trước khi ghi. Database trống/chưa có được tạo schema từ `database/services/<service>/001_schema.sql`. Database đã có dữ liệu phải có schema service được nhận diện; script không tự chuyển database monolith sang microservices.
- Sao lưu toàn bộ database đã tồn tại bằng `pg_dump -Fc`, kiểm tra archive đọc được, rồi mới chạy migration. Backup và thống kê số dòng nằm trong `database-backups/local-sync-<timestamp>-<id>/`, được Git bỏ qua. Không đưa thư mục này lên GitHub.
- Nâng cấp bằng các migration hiện có; bao gồm Identity `004_password_reset_attempt_count.sql`, Parking 002–012, Payment 002–003 và AI catalog/FAQ. Migration 012 công bố phiên bản giá có phí tối thiểu 10.000đ/lượt, giữ booking/snapshot đã chốt. Xem [MINIMUM_PARKING_CHARGE.md](MINIMUM_PARKING_CHARGE.md). Các script không tạo tài khoản/booking mẫu cho người dùng.
- Kiểm tra bảng/cột cần thiết, năm exclusion constraints chống trùng lịch Parking và số dòng của các bảng cũ. Không xóa/recreate database, không reset mật khẩu hoặc cấp quyền cho tài khoản đã có. Có thể chạy lại sau khi pull code.
- Nếu chỉ có database service cũ tên `Parking_3D`, script giữ nguyên tên và ghi `LOCAL_PARKING_DATABASE=Parking_3D` để backend dùng đúng dữ liệu cũ. Nếu cả hai tên tồn tại, mặc định chọn `parking_parking`; script không hợp nhất hai database. Đặt `LOCAL_PARKING_DATABASE` trong `.env` nếu muốn chọn rõ.
- Ghi cổng/user/database local vào các khóa `LOCAL_*` trong `.env`. Nếu phát hiện admin/staff đã có với số điện thoại mà initializer sử dụng, script chọn lại email của tài khoản có đúng quyền để tránh seed trùng. Mật khẩu của tài khoản cũ vẫn giữ nguyên; dùng mật khẩu đã có, không mặc định coi mật khẩu bootstrap trong `.env` là mật khẩu tài khoản cũ. Không đổi các khóa `BOOTSTRAP_*` dành cho Docker.

Nếu có lỗi, script dừng và báo vị trí backup. Mỗi migration có transaction riêng; những migration trước đó đã thành công vẫn được giữ. Không tự restore hoặc xóa database để che lỗi. Sửa nguyên nhân rồi chạy lại; cần khôi phục thì dùng archive tương ứng, kiểm tra trên database phục hồi riêng trước.

## 5. Dừng và phân biệt Docker

```powershell
.\scripts\microservices\Run-GitHubDev.ps1 -Stop
```

Dừng Vite bằng Ctrl+C. PostgreSQL local vẫn giữ dữ liệu. Chạy Docker dùng database trong Docker volumes riêng, không tự đồng bộ dữ liệu sang PostgreSQL local. Hướng dẫn Docker nằm trong [DOCKER_TEST_QUICKSTART.md](DOCKER_TEST_QUICKSTART.md).

## 6. Kiểm thử script (dành cho người phát triển)

```powershell
$dbPassword = Read-Host 'Local PostgreSQL password' -AsSecureString
.\scripts\microservices\Test-LocalDatabaseSync.ps1 `
  -PgBin 'C:\Program Files\PostgreSQL\17\bin' -DatabasePassword $dbPassword
.\scripts\microservices\Test-PowerShellScripts.ps1
```

Integration test tạo bốn database tên ngẫu nhiên `parking_sync_it_<id>_*`, kiểm tra cài mới, nâng cấp từ schema cũ, chạy lặp lại và từ chối database không tương thích trước khi ghi. Test tự dọn đúng các database tạm của lần chạy; không sửa `.env` hoặc database Development. Test cần quyền tạo/xóa database local và dùng cổng 5432, user `postgres`.
