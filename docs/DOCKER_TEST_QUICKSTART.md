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

### Chế độ chạy Docker (Docker Profiles):
1. **Chế độ Mặc định (Lightweight / Dev Mode - Tiết kiệm tài nguyên):**
   ```powershell
   docker compose -f compose.microservices.yml up -d
   ```
   - Chỉ khởi chạy 4 DB + Redis + 5 Backend .NET + Gateway + Frontend.
   - Dung lượng: chỉ tốn ~1.5 GB ổ đĩa, ~1.5 GB RAM.
   - Phân hệ AI tự động kết nối ra Ollama (`qwen2.5:3b`) và Python Vision chạy trực tiếp trên máy host qua `host.docker.internal` (tận dụng card GPU rời).

2. **Chế độ Đầy đủ (Full All-in-Docker Mode):**
   ```powershell
   docker compose -f compose.microservices.yml --profile full up -d
   ```
   - Tự động dựng thêm cả 2 container `ollama` (tự pull `qwen2.5:3b`) và `ai-vision` (FastAPI + PaddleOCR + YOLO) bên trong Docker dành cho các thành viên chưa cài Ollama/Python ngoài máy.

Lần đầu chạy profile full tải model/dependencies vision có thể lâu. Nếu thất bại:

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
