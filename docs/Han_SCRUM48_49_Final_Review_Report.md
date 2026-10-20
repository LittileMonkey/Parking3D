# Báo cáo SCRUM-48 / SCRUM-49 — phạm vi Parking

Người phụ trách: Hàn / XuanHan105205. Ngày rà soát: 19/10/2026.
Base đối chiếu: `cd5a60b` trên `dev`.

## Kết luận về phạm vi bàn giao

Theo yêu cầu của Hàn, bản publish chỉ chứa source Parking, đăng ký Parking.Persistence trong solution,
Postman, script/tests và tài liệu đi kèm. Không chứa thay đổi source Identity, đăng ký Identity.Persistence
trong solution hoặc thay đổi shared ServiceDefaults. Các bản sửa đó được giữ tại local để test.

Đây là thay đổi phạm vi sau lần báo cáo 52/52 tests trước đó. Không dùng kết quả của Identity local
để tuyên bố tích hợp hoàn tất trên Identity nguyên trạng ở `dev`.

## Chức năng Parking đã triển khai

| Nhóm | Trách nhiệm / hàm chính |
|---|---|
| SCRUM-48 availability | `GetLotAvailabilityQueryHandler` gọi `GetLotAvailabilityAsync`; lọc thời gian, loại xe, tầng, giờ hoạt động, closure và occupancy |
| SCRUM-48 detail | `GetBookingDetailQueryHandler` kiểm tra owner hoặc LOOKUP đúng bãi; repository trả DTO, không trả nonce hash làm QR |
| QR sau thanh toán | `IssueBookingQrCommandHandler.Handle` chỉ cấp cho CONFIRMED và còn arrival deadline; owner hoặc người có LOOKUP |
| QR cryptography | `QrTokenService.GenerateToken` / `TryValidateAndExtract`; HMAC, nonce ngẫu nhiên, expiry, booking/lot/vehicle binding |
| Lưu/cấp lại QR | `SaveIssuedQrTokenAsync`; khóa VEHICLE -> SLOT, kiểm tra lại state, thu hồi QR cũ và lưu QR mới trong transaction |
| Check-in | `CheckInCommandHandler` hỏi Identity CHECK_IN trước transaction; `CheckInAsync` kiểm tra plate/gate/time/lot/slot/state |
| Tác động một lần | Consume QR có điều kiện, một session ACTIVE và physical assignment; cùng actor/key/body trả outcome cũ trong hạn xác minh QR |
| Rollback/occupancy | QR/session/booking/audit/outcome cùng commit hoặc rollback; release reservation không làm slot AVAILABLE khi xe còn ở bãi |
| Hold expiry | Đọc `hold_minutes` từ policy; fixture 5 phút theo chốt Hàn; giữ physical occupancy |

Camera/ANPR tự động, barrier phần cứng, walk-in, override, check-out và SignalR chưa nằm trong phần triển khai này.
Biển số quan sát được Staff nhập/xác minh. Payload QR cần được frontend render thành ảnh.

## Dependency cần owner Identity cung cấp

Identity trên base chỉ nhận USER/ADMIN/OCR/GATE/CASH/REPORT, chưa nhận LOOKUP/CHECK_IN.
Parking cần:

- USER: account ACTIVE, không bị khóa.
- LOOKUP: Staff/Manager có assignment đúng lot, chưa revoke và còn hiệu lực.
- CHECK_IN: PARKING_STAFF có assignment đúng lot, chưa revoke và còn hiệu lực.
- Host Identity chạy được với cấu hình JWT, connection và internal gRPC service key phù hợp.

Giữ nguyên kiểm tra quyền, không cho Parking tự bypass authorization. Nếu Identity chưa hỗ trợ,
Staff lookup/check-in có thể trả 403. Hàn cần phối hợp owner Identity trước khi merge/nghiệm thu tích hợp.
Các sửa local về bootstrap, JWT validation, nullable, public registration và logging không thuộc PR Parking.

## Kết quả kiểm chứng và cách hiểu

Bản kiểm tra độc lập được export từ staging index: chứa đúng source sẽ publish, dùng Identity và
shared ServiceDefaults nguyên trạng theo base; không dùng source Identity sửa local.

- Parking API và dependencies build: **0 warnings, 0 errors**.
- Test project build: **0 errors, 15 warnings từ source Identity nguyên trạng**; không sửa source người khác để xóa warnings.
- Lượt chạy mặc định chọn **50 tests**: 38 unit/invariant/architecture và 12 PostgreSQL workflow tests.
- Hai tests có trait `Dependency=IdentityIntegration` được loại khỏi lượt Parking độc lập và script thông báo rõ.
- Lần chạy 52/52 trước đây là bằng chứng lịch sử trên bản local có sửa Identity, không phải toàn bộ phạm vi publish.

Kết quả counters và đường dẫn TRX của lượt Parking độc lập được ghi trong [S2-05_Validation.md](S2-05_Validation.md).
Không có số liệu phần trăm code coverage. Restore offline không phải dependency audit online.

## Clean Architecture và khả năng đọc code

- Domain: chuẩn hóa biển số và các quy tắc thuần; không tham chiếu Application/HTTP/DB.
- Application: DTO, command/query, validator, handler và interface; không tham chiếu triển khai Npgsql/gRPC/QR.
- Infrastructure: ký QR và gọi gRPC qua hợp đồng Application.
- Persistence: SQL, khóa và transaction; điều kiện ghi được kiểm tra lại dưới khóa.
- API: nhận HTTP/JWT/header và trả response envelope; composition root đăng ký triển khai.

Đã tách command/validator/handler, bỏ using thừa, làm gọn service/controller/DI và thêm comment tiếng Việt.
Hai architecture tests bảo vệ hướng assembly references, không chứng minh mọi nguyên tắc SOLID của cả repo.
Repository check-in còn nhiều bước vì transaction phải nguyên tử; không chia thành nhiều commit DB chỉ để giảm số dòng.

## Cấu hình và Git

Parking connection/password, JWT/gRPC/QR keys ở User Secrets/environment; các trường nhạy cảm trong
appsettings được để trống. Máy khác phải cấu hình riêng. Không đưa secrets vào Postman hoặc commit.
Các default từng có trong lịch sử Git không tự biến mất khi đổi appsettings; dùng credentials riêng khi triển khai.

Source Identity và shared logging đã sửa vẫn xuất hiện là thay đổi chưa commit tại máy Hàn.
Không dùng `git add .` cho các lần commit tiếp theo; chỉ stage file thuộc Parking được giao.
Bản backup phần local được lưu ngoài repo trong workspace Codex, không đưa lên GitHub.

## Chạy lại và nghiệm thu

```powershell
# Phạm vi Parking, không cần hành vi Identity mới
.\scripts\Test-ParkingScrum48-49.ps1 -Offline

# Chỉ chạy khi có host/source Identity tương thích từ owner, hoặc dùng bản local để thử tích hợp
.\scripts\Test-ParkingScrum48-49.ps1 -Offline -IncludeIdentityIntegration
```

Sau khi owner cung cấp Identity tương thích: test login, booking pending bị chặn QR, payment CONFIRMED,
lấy QR, Customer check-in bị từ chối, Staff đúng bãi/xe vào thành công, quét lại bị từ chối, availability OCCUPIED.
Kiểm tra retry giữ nguyên session; sai biển số không làm mất QR. Payment thực tế, UI và barrier cần UAT với nhóm.

Tài liệu: [API design](S2-05_QR_CheckIn_Design.md), [validation](S2-05_Validation.md),
[Postman](../postman/Han-Scrum48-49.postman_collection.json).
