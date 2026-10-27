> Có lượt cleanup và kết quả kiểm thử mới hơn trong [báo cáo cleanup](Han_SCRUM48_49_Cleanup_Report_2026-10-27.md): 45/52 tests pass; 7 lỗi nạp DLL do Windows. Các kết quả khôi phục bên dưới là lịch sử trước lượt cleanup.

# Báo cáo khôi phục SCRUM-48 và SCRUM-49 — Hàn

Ngày: 27/10/2026. Repo: `D:/OJT/parking`.

## 1. Kết quả thực hiện

Đã khôi phục đầy đủ mã nguồn hai chức năng từ bản sao lưu ngày 24/10, sau khi đối chiếu tài liệu thiết kế và cấu trúc runtime hiện tại. Đây là kết quả khôi phục source, không đồng nghĩa đã nghiệm thu toàn hệ thống.

- Giữ .NET 9/C# 13, microservices và Npgsql; không chuyển sang Spring Boot hoặc EF cho Parking.
- Giữ bốn DTO availability thành bốn file riêng như Hàn đã học; không tạo định nghĩa trùng.
- Bổ sung comment tiếng Việt giải thích nhiệm vụ class, phân quyền, đồng thời, transaction và vòng đời trạng thái.
- Hoàn thiện lại DI, controller, MediatR, validator, worker, service QR và các phần của ParkingRepository.
- Khôi phục collection Postman, script kiểm thử và các tests liên quan.
- Dọn using sinh tự động trong DTO, chuẩn hóa whitespace và giữ dependency hướng vào Application/Domain.
- Thay bảy test cases chỉ mô phỏng lại điều kiện bằng bảy cases gọi Domain/Validator thật: giờ mở cửa, LevelId tùy chọn, thời gian đảo ngược và giới hạn 31 ngày.
- Chưa commit, stage hay push. Các sửa Identity/shared đã tồn tại trước lượt này vẫn chỉ ở local.

Bản sao lưu trước khi ghi đè phần đang học nằm tại:
`C:/Users/LOQ/Documents/Codex/2026-10-17/hi/outputs/parking-before-restore-2026-10-27`.
Bản gốc để phục hồi:
`C:/Users/LOQ/Documents/Codex/2026-10-17/hi/outputs/parking-rebuild-backup-2026-10-24-99f499d2`.

## 2. SCRUM-48 đã có những chức năng nào?

### Tra cứu ô đỗ

`GET /api/v1/parking-lots/{lotId}/availability`

- Public, không trả biển số hoặc danh tính khách.
- Lọc theo khoảng thời gian, loại xe và tầng.
- Mặc định bắt đầu tại hiện tại, kết thúc sau một giờ; khoảng phải dương và không quá 31 ngày.
- Kiểm tra bãi hoạt động, múi giờ, lịch mở cửa, đóng cửa đột xuất, loại xe và tầng thuộc bãi.
- Dùng RepeatableRead để các truy vấn nhìn cùng một snapshot dữ liệu.
- Ưu tiên trạng thái: OCCUPIED vật lý → MAINTENANCE → HELD bởi reservation → AVAILABLE.
- HELD trong kết quả bao gồm reservation CONFIRMED còn chặn khung giờ; không chỉ booking chưa trả tiền.
- Các bộ đếm tính trên tập ô đã lọc. Kết quả tham khảo không thay thế khóa chống đặt chỗ trùng khi ghi.

### Chi tiết booking

`GET /api/v1/bookings/{bookingId}` — bắt buộc JWT.

Chủ booking được xem; người khác phải có quyền LOOKUP tại đúng bãi do Identity xác minh. Không lấy actor từ body. Booking không tồn tại trả 404. QR không được khôi phục từ hash nonce: lấy QR bằng endpoint SCRUM-49 riêng.

### Giải phóng hold hết hạn

`HoldExpiryWorker` quét mỗi 10 giây, dùng Repository trong scope mới mỗi lượt.

Chỉ xử lý PENDING_PAYMENT quá hold_expires_at; kiểm tra lại dưới khóa VEHICLE → SLOT theo thứ tự ổn định, cập nhật EXPIRED, release reservation HELD và ghi audit trong cùng transaction. Không release reservation CONFIRMED hoặc assignment vật lý đang mở.

**Chính sách Hàn chốt là 5 phút.** Luồng tạo booking đọc hold_minutes của policy và worker đọc hold_expires_at; không hard-code thêm số phút. Fixture demo hiện ghi 5. Lượt khôi phục không sửa dữ liệu policy của database Development; cần xác nhận database đang dùng có hold_minutes = 5 khi test thủ công.

## 3. SCRUM-49 đã có những chức năng nào?

### Cấp QR

`POST /api/v1/bookings/{bookingId}/qr` — JWT, body rỗng.

Kiểm tra account qua Identity; chỉ chủ booking hoặc người có LOOKUP đúng bãi được cấp. Booking phải CONFIRMED, còn hạn đến bãi và có tài nguyên/reservation hợp lệ. Repository kiểm tra lại dưới khóa rồi thu hồi QR chưa dùng trước đó và lưu QR mới trong cùng transaction.

QR gồm claims booking/bãi/xe/nonce/hạn dùng, ký HMAC-SHA256; nonce ngẫu nhiên 256 bit. Khóa ký lấy từ cấu hình riêng, tối thiểu 32 byte; database chỉ giữ hash nonce. Đây là chữ ký bảo vệ tính toàn vẹn, không phải mã hóa che nội dung QR.

### Staff check-in một lần

`POST /api/v1/check-in` — JWT + Idempotency-Key.

1. Hỏi Identity quyền CHECK_IN tại đúng bãi trước khi giữ transaction database.
2. Xác minh chữ ký, thời hạn và bãi của QR.
3. Khóa key theo actor, rồi VEHICLE → SLOT; kiểm tra booking/reservation CONFIRMED.
4. Kiểm tra xe, ô, bãi, cổng ENTRY/BOTH, giờ đến, lịch hoạt động và closure.
5. Chuẩn hóa biển số quan sát và đối chiếu cả snapshot booking lẫn biển số xe hiện tại.
6. Consume QR có điều kiện: chưa dùng, chưa thu hồi, chưa hết hạn và đúng hash/expiry.
7. Cùng transaction: tạo session ACTIVE, assignment vật lý, booking CHECKED_IN/version, release reservation, audit và outcome chống retry trùng.
8. Chỉ trả kết quả sau commit; lỗi bất kỳ rollback cả consume và các thay đổi nghiệp vụ.

Cùng actor/key/body trả lại outcome cũ khi còn qua được bước xác minh QR/quyền. Key mới dùng QR đã consume hoặc key cũ đổi body bị từ chối. Retry sau khi QR hết hạn cũng bị chặn ở bước xác minh. Release reservation lúc check-in không làm ô AVAILABLE vì đã có assignment vật lý.

Không có lệnh điều khiển barrier thật trong phạm vi này; không được coi mỗi response 200 là một lần mở cổng mới.

## 4. Kiến trúc và thứ tự đọc code

```text
HTTP Controller → MediatR → ValidationBehavior → Handler
                                            → interface Repository / QR / FacilityAccess
Persistence → PostgreSQL, khóa, transaction, snapshot
Infrastructure → ký QR, gRPC Identity, Worker
Domain → quy tắc biển số và giờ hoạt động
```

Application chỉ tham chiếu project Domain và các thư viện MediatR/FluentValidation; Domain không tham chiếu project triển khai. Controller chỉ nhận/trả HTTP, lấy actor từ JWT và gọi MediatR. SQL nằm ở Persistence; gọi Identity qua adapter, không truy vấn database Identity từ nghiệp vụ Parking.

Đọc theo thứ tự sau trong `src/Services/Parking`:

1. Application/DTOs: hiểu dữ liệu vào/ra.
2. Application/Features/ParkingLots/Queries/GetLotAvailabilityQueryHandler.cs.
3. Persistence/Repositories/ParkingRepository.Availability.cs.
4. Application/Features/Bookings/Queries và ParkingRepository.Lookup.cs.
5. Infrastructure/BackgroundServices/HoldExpiryWorker.cs và ParkingRepository.HoldExpiry.cs.
6. Application/Features/Bookings/Commands/IssueBookingQrCommandHandler.cs, Infrastructure/Services/QrTokenService.cs, ParkingRepository.Qr.cs.
7. CheckInCommandHandler.cs và ParkingRepository.CheckIn.cs.

Repository tách thành partial files nhưng vẫn là một class dùng chung connection factory và đồng hồ. Không tách booking/session/slot thành các service khác nhau vì chúng cần một transaction nguyên tử.

## 5. Kiểm chứng ngày 27/10

| Kiểm tra | Kết quả thực tế |
|---|---|
| Parking API sau khôi phục và làm sạch | Build thành công, 0 warnings / 0 errors |
| Identity local dùng làm dependency | Build thành công, 0 warnings / 0 errors; không sửa source |
| Project tests sau thay bảy cases mô phỏng | Build thành công, 0 warnings / 0 errors |
| Format whitespace trong phạm vi file được chọn | Thành công bằng folder mode |
| Git diff --check phạm vi Parking/tests | Không có lỗi whitespace |
| Hash 200 file ngoài phạm vi Parking | Không thay đổi |
| Chạy tests sau lần chỉnh cuối | **Không hoàn tất: Application Control chặn nạp test DLL, 0 tests được thực thi** |

Lượt chạy trước khi thay bảy cases đã discover 52 tests: 11 pass, 41 fail vì FileLoadException / 0x800711C7 khi Windows nạp Domain/Infrastructure/AI assemblies. Không coi 41 lỗi nạp DLL là lỗi nghiệp vụ; cũng không coi chúng là pass. Sau chỉnh cuối, chính test DLL bị policy chặn ở discovery, nên không có kết quả pass runtime nào cho phiên bản cuối. Exit code là 1 và TRX báo Failed.

Chưa thể xác nhận toàn bộ hai task đã qua acceptance/runtime chỉ dựa trên build. Không tắt hoặc thay đổi Application Control của Windows trong lượt này. Hàn cần chạy lại từ terminal/Visual Studio thông thường trong môi trường cho phép DLL của dự án.

Bằng chứng local:

- Build Identity/Parking: `C:/Users/LOQ/Documents/Codex/2026-10-17/hi/work/parking-restored-20261027-final-verification.log` (phần build tests trong log này có lỗi namespace trung gian, đã sửa; xem log build tests mới bên dưới).
- Build tests cuối đã sửa: `C:/Users/LOQ/Documents/Codex/2026-10-17/hi/work/parking-restored-20261027-final-test-build.log`.
- Chạy tests cuối: `C:/Users/LOQ/Documents/Codex/2026-10-17/hi/work/parking-restored-20261027-final-tests.log`.
- TRX cuối: `artifacts/microservices/scrum48-49/with-identity/results/restored-final.trx`.
- Kết quả trước lần làm sạch tests: `artifacts/microservices/scrum48-49/with-identity/results/scrum48-49.trx`.

Có hai architecture tests, các unit/validator/domain tests và workflows database/HTTP. Không dùng số tests cũ 50/52 làm kết quả của lần khôi phục này.

Các database tạm của bộ integration tests có tên scrum49_it_<random>, chỉ dùng localhost. Bộ tests không xóa bảng Development. Lượt này kiểm tra hash xác nhận 200 file Identity/Payment/AI/shared/contracts/database không bị thay đổi source.

## 6. Cách chạy lại và test bằng Postman

Mở Developer PowerShell hoặc terminal bình thường tại repo:

```powershell
cd D:\OJT\parking
.\scripts\Test-ParkingScrum48-49.ps1 -Offline
# Khi Identity local có LOOKUP/CHECK_IN và bootstrap/config phù hợp:
.\scripts\Test-ParkingScrum48-49.ps1 -Offline -IncludeIdentityIntegration
```

Script đọc connection local từ cấu hình/User Secrets hoặc PARKING_TEST_ADMIN_CONNECTION; tài khoản PostgreSQL cần quyền CREATEDB. Không dán connection string/mật khẩu vào báo cáo hoặc Git. Script dừng với exit khác 0 nếu build/test thất bại.

Import `postman/Han-Scrum48-49.postman_collection.json`, điền credentials/IDs local:

- Kiểm tra /health/ready của Parking.
- Đăng nhập lấy access token; Bearer chỉ chứa chuỗi token, không dán cả JSON hay refreshToken.
- Availability: đúng khoảng/tầng/loại xe; thử khoảng đảo ngược, bãi đóng cửa.
- Chi tiết booking: owner 200; thiếu JWT 401; người khác không có scope 403.
- Booking pending không cấp QR được; chạy luồng Payment của nhóm tới CONFIRMED rồi cấp QR.
- Staff đúng bãi + plate/cổng đúng → tạo một session; quét lại bằng key mới bị từ chối.
- Retry cùng key/body → cùng session; không tạo thêm assignment.
- Thử sai plate, sai cổng và QR cũ sau cấp lại; các trường hợp lỗi không được consume QR.
- Booking chưa trả tiền quá hạn: worker chuyển EXPIRED; xe đang đỗ vẫn OCCUPIED.

Không tự UPDATE booking sang CONFIRMED để tuyên bố đã test provider Payment thật. HTTP integration test gửi sự kiện thanh toán qua gRPC trong môi trường test, không chứng minh tích hợp ngân hàng/provider bên ngoài.

## 7. Những điểm chưa được nghiệm thu

- UAT với provider Payment thực tế, giao diện Staff và phần cứng cổng.
- Identity của nhóm phải hỗ trợ LOOKUP/CHECK_IN đúng assignment; source base cũ có thể từ chối hai capability này. Parking không tự bỏ kiểm tra quyền để cho test qua.
- Xác nhận policy 5 phút trong database Development đang chạy; source vẫn đọc cấu hình policy.
- Windows/Application Control và môi trường chạy tests phải cho phép nạp các DLL build từ dự án để hoàn tất kiểm chứng runtime.

Tài liệu đối chiếu: AGENTS.md, docs/06-CODING-STANDARDS.md, docs/microservices/ARCHITECTURE.md, docs/S2-04_Availability_Hold_Expiry_Design.md, docs/S2-05_QR_CheckIn_Design.md, docs/S2-05_Validation.md và source schema/test fixtures. Các nguồn Classroom trong thiết kế là tham chiếu đã lưu trước đây; lượt này không tuyên bố đã đăng nhập và đọc lại trực tiếp Classroom/Jira.
