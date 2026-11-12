# Chạy và làm việc với backend mới

## 1. Vị trí code

Mở `Parking.Microservices.slnx`. Mỗi service có Domain/Application/Infrastructure/Api riêng. Gateway chỉ route REST. `src/Contracts/.../Protos/v1` chứa hợp đồng gRPC version1. Không mở solution MyStore trong legacy để chạy Parking.

Hiện GitLab main/dev không có source React (chỉ README frontend); FE cần đưa source vào repo trên story riêng. Khi nối FE, base URL là `http://localhost:8080`, không gọi các port gRPC. CORS mặc định localhost5173.

## 2. Chạy Docker Development

Cần Docker Desktop có Compose và Linux containers. Trong repo:

```powershell
pwsh -File scripts/microservices/New-DevelopmentEnv.ps1
docker compose -f compose.microservices.yml config --quiet
docker compose -f compose.microservices.yml up -d --build
Invoke-RestMethod http://localhost:8080/health/ready
```

Lệnh tạo .env chỉ tạo một lần, không overwrite secrets đang có. .env bị gitignore. Mật khẩu bootstrap admin nằm trong .env trên máy, không hiển thị trong log và không commit. Đăng nhập admin qua `/api/v1/auth/login`. Đăng ký customer/Staff bằng `/auth/register`; đăng ký luôn là CUSTOMER, Staff có quyền vận hành sau khi ADMIN gán assignment theo bãi.

Compose tạo **4 container PostgreSQL17**, 4 service và Gateway. Chỉ Gateway bind host loopback8080; database/gRPC không mở ra host. Script schema chỉ chạy khi volume mới. Không dùng `down -v` để cập nhật schema vì xóa dữ liệu; dùng migration riêng khi cần. `docker compose ... down` dừng mà giữ volume.

`/health/ready` kiểm tra schema/database; không cam kết OCR provider hay nghiệp vụ chưa triển khai đã sẵn sàng.

## 3. Seed dữ liệu demo có chủ đích

Đăng ký customer, lấy userId response. Lấy admin userId từ token `sub` hoặc kiểm tra bằng Identity owner tooling; không truy vấn Identity DB từ Parking API. Dùng SQL demo đã ghi rõ Development:

```powershell
# Với psql trên môi trường Development được chỉ định:
psql -X -v ON_ERROR_STOP=1 -d parking_parking -v customer_id="UUID_CUSTOMER" -v admin_id="UUID_ADMIN" -f database/services/parking/002_demo_fixture.sql
```

Nếu dùng compose, pipe file vào psql trong container Parking DB; không cần mở cổng database ra máy:

```powershell
Get-Content -Raw database/services/parking/002_demo_fixture.sql | docker compose -f compose.microservices.yml exec -T parking-db psql -X -v ON_ERROR_STOP=1 -U parking -d parking_parking -v customer_id="UUID_CUSTOMER" -v admin_id="UUID_ADMIN"
```

Fixture tạo 2 bãi, tầng/khu/slot, policy và biểu giá mẫu, xe demo với verified access cho customer chỉ định. Đây không phải xác minh sở hữu xe trong sản phẩm thật. Giá/policy chỉ cho demo, phải được BA/mentor chốt trước sử dụng nghiệp vụ.

## 4. Thử luồng có sẵn

1. ADMIN gán Staff cho bãi A qua `/api/v1/staff-assignments`.
2. Customer tạo booking EXACT_SLOT với slot/vehicle trong fixture, giờ tương lai và `Idempotency-Key`.
3. Customer tạo payment CASH cho booking. Backend lấy quote qua gRPC, không nhận amount từ client.
4. Staff bãi A xác nhận Cash. Payment ghi SUCCESS + outbox cùng transaction.
5. Worker gửi gRPC event; Parking ghi inbox/receipt, recheck hold/reservation và Confirmed hoặc ghi reconciliation. Không tự giải phóng slot.

Samples, errors và diagrams: `API-CONTRACTS.md`. Các API chưa triển khai trả404; không coi404 đó là bug nghiệp vụ.

## 5. OCR và hai AI khác

OCR không cấu hình =>503. Điền trusted `OCR_ENDPOINT`/`OCR_API_KEY` vào .env rồi restart AI. Provider nhận `{imageBase64,contentType}` và trả `{plate,confidence,modelVersion}`; không tìm biển số dựa vào tên file. Response bounded16KiB, timeout10s; ảnh <=4MiB PNG/JPEG. Không lưu ảnh raw hoặc chat trong database. Nếu cần lưu private object storage, triển khai adapter + retention trước khi thay đổi policy.

Forecast dùng rolling mean baseline từ ít nhất2 snapshot thật còn mới; trả `NOT_EVALUATED`. Assistant là tìm FAQ đã duyệt, `RETRIEVAL_NO_LLM`; chưa gắn LLM. Không gọi các demo này là mô hình AI đã nghiệm thu.

## 6. Build và test

```powershell
dotnet restore Parking.Microservices.slnx
dotnet build Parking.Microservices.slnx
dotnet test tests/Parking.Microservices.Tests/Parking.Microservices.Tests.csproj
```

Target .NET9/C#13 theo baseline. Máy hiện có SDK/runtime10; đã build net9 binaries và chạy kiểm thử với roll-forward Major. CI và Docker dùng SDK/runtime9. Không thay bản target âm thầm.

Integration harness có thể dùng package test `@electric-sql/pglite`0.5.8 và `@electric-sql/pglite-socket`0.2.11; **khuyến nghị native PostgreSQL17 portable** để kiểm tra Npgsql và concurrency. Windows:

```powershell
$env:PARKING_PG_BIN="C:/path/to/pgsql/bin"
node scripts/microservices/integration_smoke.cjs "C:/path/to/pglite/package" "C:/path/to/pglite-socket/package"
```

Harness tạo cluster/database hoàn toàn mới trong thư mục tạm, bind loopback50471 và các host50500–50590, không kết nối database nhóm. Tự dừng process test. Không chạy đồng thời hai harness cùng port. OCR provider trong harness là test double; kết quả không chứng minh accuracy của model thật. Output redacted ở artifacts/microservices/integration/results.json.

## 7. Trước triển khai production

Đây là cấu hình local Development. Cần TLS/mTLS cho gRPC, credentials theo caller, issuer asymmetric/JWKS hoặc identity provider đã duyệt, secret rotation, account recovery/refresh/OTP, monitoring, deploy pipeline, dữ liệu migration/backfill và kiểm thử các use case còn thiếu. Không mở các internal port/shared service key ra Internet.
