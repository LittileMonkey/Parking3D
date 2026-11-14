# Test database + backend bằng Docker, frontend bằng Vite

Mở Docker Desktop, chọn Linux containers, đợi engine chạy. Mở PowerShell mới và kiểm tra `docker version` (cần cả Client và Server), `docker compose version`.

Code GitHub mới nhất ở mốc kiểm tra là `789b5079`, thêm container Ollama tự tải `qwen2.5:3b`. Script start tự tìm Docker CLI tại vị trí cài per-user thông dụng khi PATH chưa cập nhật. Nếu báo pipe `dockerDesktopLinuxEngine` không tồn tại thì Docker Desktop/engine chưa chạy, không phải lỗi project.

Trong thư mục repo:

```powershell
.\scripts\microservices\Start-DockerTest.ps1
.\scripts\microservices\Seed-DockerDemo.ps1
```

Script đầu giữ secrets đang có trong .env, thêm khóa QR/tài khoản demo còn thiếu, khởi động 4 DB PostgreSQL, chạy 2 migration Parking và migration Payment 002, rồi build/start 4 backend, Gateway, Python vision, Ollama và kiểm tra readiness. Script dừng đúng native hosts do launcher cũ quản lý để giải phóng Gateway 8080; không dừng PostgreSQL local.

Script seed thêm dữ liệu Development lặp lại được: 3 bãi, 120 slot, 6 cổng, 6 biểu giá và xe/tài khoản demo. Đọc tài khoản cục bộ trong .env, không in password. Database trong Docker volumes riêng, không tự dùng các database local đã seed trước đó.

Mở terminal FE:

```powershell
cd frontend_parking_system
npm ci
npm run dev
```

Frontend: http://localhost:5173. Gateway readiness: http://localhost:8080/health/ready. FE proxy /api,/health,/hubs về Gateway 8080.

Gateway chạy trong Docker phải gọi `identity:8080`, `parking:8080`, `payment:8080`, `ai:8080` qua DNS nội bộ. Compose đặt cả `Services__*Http` (readiness) và `ReverseProxy__Clusters__*__Destinations__main__Address` để ghi đè địa chỉ loopback trong `appsettings.Development.json` dùng cho chạy native. Nếu các service healthy nhưng Gateway báo `Upstream service unavailable`, áp dụng lại cấu hình bằng `docker compose -f compose.microservices.yml up -d --no-deps --wait gateway`, rồi kiểm tra `/health/ready`.

Đăng ký Customer cần họ tên, email, số điện thoại và mật khẩu. FE gửi `emailNormalized`, `phoneE164`, `fullName`, `password` theo contract Identity; số Việt Nam dạng `0912345678` được đổi thành `+84912345678`. Đăng ký hiện tạo tài khoản hoạt động, không có bước OTP email trong handler này. Vai trò Staff/Manager do quản trị phân quyền; đăng ký công khai không cấp các quyền đó.

Identity nhận cấu hình nhà cung cấp từ file `.env` bị Git bỏ qua: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SENDER`, `SMTP_PASSWORD`, `GOOGLE_CLIENT_ID`. Các giá trị SMTP rỗng trong Compose sẽ ghi đè cấu hình có trong appsettings, vì vậy cần điền `.env` rồi áp dụng lại bằng `docker compose -f compose.microservices.yml up -d --no-deps --wait identity`. Không đưa mật khẩu SMTP vào FE hoặc Git. `GOOGLE_CLIENT_ID` là Web Client ID công khai và phải trùng `VITE_GOOGLE_CLIENT_ID` trong `frontend_parking_system/.env.local`; khởi động lại Vite sau khi đổi file này.

Nếu Google báo `The given origin is not allowed for the given client ID`, chủ OAuth client cần vào Google Cloud → Google Auth Platform → Clients → Web client đang dùng → Authorized JavaScript origins, thêm chính xác `http://localhost:5173` rồi Save. Chỉ thêm origin, không thay Client ID, không tạo client secret mới. Khi triển khai, thêm origin HTTPS thực tế của FE. Thay đổi ở mã nguồn không tự cấp được origin trên tài khoản Google Cloud.

Lần đầu tải model/dependencies vision có thể lâu. Nếu thất bại:

```powershell
docker compose -f compose.microservices.yml ps
docker compose -f compose.microservices.yml logs --tail 80 identity parking payment ai ai-vision gateway
```

Lần đầu model Ollama có thể vẫn đang tải dù server đã healthy. Kiểm tra riêng trước khi thử chatbot:

```powershell
docker compose -f compose.microservices.yml logs --tail 30 ollama
docker compose -f compose.microservices.yml exec ollama ollama list
```

Đợi `qwen2.5:3b` xuất hiện trong danh sách; process healthy chưa chứng minh model đã tải xong. Nếu chỉ command `docker` chưa nhận trong terminal FE mới, mở terminal mới hoặc thêm thư mục `resources/bin` của Docker Desktop vào PATH của terminal.

Chạy lại script start với `-NoBuild` khi images đã build. Không gửi nội dung .env hoặc output Compose đã expand lên chat.

Dừng FE: Ctrl+C. Dừng container, giữ database:

```powershell
docker compose -f compose.microservices.yml down
```

Không dùng `down -v` khi muốn giữ dữ liệu. Các seed là tài khoản giả dùng để test, không reset password hoặc nâng quyền tài khoản đã tồn tại. Nếu credentials .env không khớp một volume cũ, khôi phục cấu hình phù hợp thay vì xóa volume tùy tiện.

VNPay thật cần cấu hình merchant/secret và callback public; OCR/LLM cần model/provider sẵn sàng. Những trang còn mock trong code nhóm không được xem là nghiệp vụ đã lưu thành công chỉ vì UI hiển thị success.

Thay đổi khởi động: Identity dùng Ports:Bind/Http/Grpc, HTTP nội bộ không cần dev certificate; Compose override cổng tất cả backend thành 8080/8081 và truyền đúng PaymentGrpc/SeedAdmin/SeedStaff/QR key. Script test Docker chưa được coi là pass toàn hệ thống cho đến khi chạy trên máy có Docker engine.
