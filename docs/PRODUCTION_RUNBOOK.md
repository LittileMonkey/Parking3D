# Chạy các phần mới và chuẩn bị production

## Trạng thái

Đây là cấu hình và hướng dẫn mới, chưa được thực thi trong đợt sửa source 12/11/2026. Không có giao dịch hoàn tiền, gửi OTP, migration hay deploy thật nào được thực hiện bởi đợt sửa này. Source review không thay thế nghiệm thu SRS.

## Chạy local để dùng giao diện

Mở Docker Desktop, rồi chạy PowerShell tại repository:

~~~powershell
cd D:\OJT26_PARK_AUUA\PROJECT_OJT\parking-system-group2
.\scripts\microservices\Start-DockerTest.ps1
~~~

Launcher bổ sung khóa dev còn thiếu, khởi động DB, áp dụng migration và build/start stack. Không xóa volume. Giao diện Docker: http://localhost:3000. Chỉ chạy Seed-DockerDemo.ps1 nếu cần bổ sung fixture Development; không chạy seed demo cho production.

Trước khi thử OTP, điền vào .env tại gốc repo: SMTP_HOST, SMTP_PORT (587 STARTTLS), SMTP_SENDER và SMTP_PASSWORD. Không gửi mật khẩu/token qua chat, không commit file môi trường. Chạy lại launcher sau khi đổi cấu hình để container nhận giá trị mới.

Các màn hình đã nối:

1. /guest-login: gửi mã email, xác minh để đăng nhập CUSTOMER, sau đó thêm xe và đặt chỗ theo luồng hiện tại.
2. /security: nhập mật khẩu, quét TOTP, xác nhận bật; đăng nhập lại cần mã ứng dụng. Tài khoản chưa có mật khẩu dùng quên mật khẩu trước. Lưu thiết bị TOTP cẩn thận: chưa có recovery codes.
3. Chi tiết booking đã hủy/hết hạn: xem điều kiện/số dư và yêu cầu hoàn toàn bộ hoặc một phần. Chờ trạng thái thực tế từ backend.
4. Manager / incidents-approvals: danh sách hoàn tiền đúng bãi; xác nhận CASH bằng chứng từ thực trả hoặc đối soát phản hồi VNPay đã ký.
5. Chuông thông báo: trạng thái booking, đổi slot, nhắc giờ, hoàn tiền; đọc một/tất cả được lưu DB.
6. Grace: booking đầu tiên đủ điều kiện trong ngày giảm tối đa 15 phút tính phí; lần sau cùng người/ngày không được nhận lại. Walk-in không xác định owner duy nhất sẽ không có grace.

## Kích hoạt VNPay

Cấu hình merchant sandbox trước: VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_API_URL và VNPAY_REFUND_IP (IP được merchant chấp nhận), rồi VNPAY_REFUNDS_ENABLED=true khi đã có quyền refund. Production có thêm VNPAY_BASE_URL và VNPAY_RETURN_URL. Checkout URL và refund API URL phải cùng môi trường/merchant; file tạo mới mặc định sandbox. Khi chuyển tiền thật, lấy endpoint/permission/IP allowlist từ VNPay.

Đăng ký IPN public HTTPS theo endpoint /api/v1/payments/vnpay/ipn nếu hợp đồng VNPay yêu cầu; Return URL là /api/v1/payments/vnpay/return. Return endpoint hiện trả JSON, chưa phải trang kết quả thanh toán có giao diện riêng; quay lại chi tiết booking để xem trạng thái đã được backend xác nhận.

PENDING_PROVIDER là chờ xử lý, không phải hoàn tất. Khi timeout/mất kết nối sau gửi, không sửa status DB để gửi lại: nhà cung cấp có thể đã hoàn tiền. Dùng phản hồi refund gốc có chữ ký để reconcile, hoặc đối soát merchant với nhà cung cấp. Hiện chưa tự động querydr/retry. Giao dịch cũ thiếu metadata gốc không được tạo ngày giao dịch giả để hoàn tiền.

## Tạo môi trường production riêng

Chuẩn bị máy chủ có Docker Compose, dung lượng đủ cho PostgreSQL/AI images, hostname trỏ DNS về máy, TCP 80/443 đến máy chủ. Repo có cấu hình production riêng, chỉ edge Caddy mở port public; DB/API không publish ra host. Project/volume production tách khỏi dev.

~~~powershell
.\scripts\microservices\New-ProductionEnv.ps1 -Domain parking.example.com -AdminEmail admin@example.com
~~~

Thay các giá trị ví dụ bằng domain/email của bạn. Script tạo .env.production (gitignored), không ghi đè khóa cũ. Điền SMTP, merchant và endpoint trong file này tại máy. SMTP bắt buộc để tránh triển khai luồng OTP không gửi được. Giữ MFA_ENCRYPTION_KEY cùng bản backup: mất/đổi khóa sẽ làm mất khả năng giải mã TOTP hiện có. Không dùng khóa dev cho production.

~~~powershell
.\scripts\microservices\Start-Production.ps1
~~~

Script kiểm tra Compose, mở DB, áp dụng migration, build/start dịch vụ. Caddy cấp chứng chỉ cho SITE_DOMAIN; cần DNS/port đúng. Không seed nhân viên demo. Bootstrap admin sử dụng BOOTSTRAP_EMAIL/PASSWORD từ file riêng; tạo phân quyền/bãi/biểu giá thật sau khi đăng nhập.

Docker network cố định 172.29.80.0/24 để giới hạn proxy đáng tin cậy. Nếu subnet xung đột hạ tầng, đổi cả networks.default.ipam và mọi ForwardedHeaders__KnownNetwork cùng nhau. Chỉ Caddy được nhận request public; không mở port nội bộ để né TLS/proxy.

Không coi --wait healthy là nghiệm thu nghiệp vụ. Trước mở traffic, thực hiện đăng nhập/OTP/MFA, đặt chỗ-thanh toán-QR-vào/ra, hủy-hoàn tiền, đồng thời tranh slot, sai vai trò/bãi, thông báo, restart và đối soát sandbox. Chưa có bằng chứng chạy các tình huống mới trong đợt này.

## Backup, nâng cấp và rollback

~~~powershell
.\scripts\microservices\Backup-Production.ps1
~~~

Script pg_dump dạng custom cho bốn DB, copy nhị phân bằng docker compose cp vào backups/<timestamp>. Backup riêng từng DB không tạo snapshot phân tán đồng thời: khi cần restore nhất quán, dừng traffic và worker ghi trước backup, giữ toàn bộ outbox liên quan. Sao lưu file môi trường/khóa mã hóa và bản dump mã hóa ra máy khác.

Trước nâng cấp: lưu Git commit và image IDs hiện tại; thông báo bảo trì, đóng traffic, dừng frontend/gateway/application workers (giữ DB chạy), backup bốn DB, rồi chạy Start-Production.ps1 với phiên bản đã duyệt. Migration là additive nhưng vẫn cần backup; không chạy đồng thời hai launcher migration.

Restore: dùng một project/volume phục hồi riêng; docker compose cp bản dump vào container DB, rồi pg_restore --exit-on-error --no-owner -U <db-user> -d <empty-database> <dump-path>. Khôi phục cả bốn DB từ cùng cửa sổ backup và khóa môi trường tương ứng. Kiểm tra outbox, tổng tiền và provider trước mở traffic. Không dùng restore DB để đảo ngược giao dịch VNPay đã xảy ra ngoài hệ thống.

Rollback ứng dụng: dùng đúng image/commit trước nâng cấp nếu tương thích schema mới, giữ khóa và volume. Nếu cần restore dữ liệu, thực hiện quy trình phục hồi riêng ở trên; không docker compose down -v và không xóa volume production. Chưa diễn tập restore/rollback trong đợt sửa này.

## Giới hạn còn phải nghiệm thu

- Merchant refund/SMTP/domain là thông tin vận hành cần cấu hình thật; chưa xác nhận kết nối.
- Chưa có MFA recovery codes, SMS/push hoặc email cho mọi loại notification.
- Đối soát refund không rõ kết quả cần thao tác operator với bằng chứng nhà cung cấp; không có nút giả SUCCESS.
- Chưa chạy build/test/migration/browser cho thay đổi mới theo yêu cầu chỉ sửa source; không tuyên bố hoàn tất toàn bộ SRS.

Chi tiết contract, sơ đồ và migration: [COMPLETION_API_2026-11-12.md](COMPLETION_API_2026-11-12.md).
