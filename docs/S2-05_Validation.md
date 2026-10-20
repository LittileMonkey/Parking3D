# SCRUM-48 / SCRUM-49 — kiểm thử bản publish chỉ Parking

Ngày 19/10/2026, base `cd5a60b`. Theo yêu cầu của Hàn, PR không chứa thay đổi source Identity
hoặc shared ServiceDefaults. Các bản sửa Identity chỉ giữ tại local.

## Kết quả trên đúng nội dung chuẩn bị publish

Đã export staging index sang thư mục kiểm tra độc lập. Identity/shared code trong bản này giống base,
khác với bản Identity chỉnh local. Chạy:

```powershell
.\scripts\Test-ParkingScrum48-49.ps1 -Offline
```

| Hạng mục | Kết quả |
|---|---|
| Parking API và dependencies | 0 warnings, 0 errors |
| Test project | 0 errors; 15 warnings có sẵn từ source Identity trên base |
| Unit/invariant/architecture | 38 passed |
| PostgreSQL workflows không cần capability Identity mới | 12 passed |
| Tổng được chọn trong mode Parking | **50 passed, 0 failed, 0 skipped** |
| Hai tests IdentityIntegration | Không được chọn trong mode Parking; dependency chưa sẵn sàng trên base |

TRX trong bản kiểm tra độc lập:
`artifacts/microservices/scrum48-49/parking-only/results/scrum48-49.trx`.
Thời gian tests khoảng 21 giây, ngoài restore/build.

Script in rõ bộ lọc `Dependency!=IdentityIntegration`; hai tests bị loại không được tính thành pass/skip.
Bộ tests gồm cả tests sẵn của dự án, không phải tất cả là tests mới của SCRUM-49. Không suy ra phần trăm coverage.

## Phạm vi đã chứng minh trong mode Parking

- Hold theo policy fixture 5 phút; expiry pending giải phóng reservation đúng điều kiện.
- Availability: range/type/level/closure; GiST chặn booking overlap; physical occupancy được bảo vệ.
- Payment inbox xử lý confirmation/replay qua handler gRPC trong test, không phải provider thực tế.
- QR HMAC/nonce/expiry/parser, cấp lại thu hồi QR cũ; pending không đủ điều kiện cấp QR.
- Check-in repository từ chối sai plate/gate/time/maintenance và QR hết hạn/thu hồi/đã dùng.
- Check-in tạo đúng một session ACTIVE, assignment vật lý, audit và version; slot vẫn OCCUPIED.
- 10 request đồng thời chỉ một lần tạo phiên; retry cùng key/body không tạo thêm phiên; key đổi body bị từ chối.
- Lỗi audit sau consume rollback toàn bộ, retry sau khi gỡ lỗi giả lập thành công.
- Hai architecture checks bảo vệ Domain/Application không tham chiếu layer triển khai bên ngoài.

Các tests repository không thay thế kiểm chứng authorization qua Identity thật.

## Lượt tích hợp riêng khi dependency sẵn sàng

```powershell
.\scripts\Test-ParkingScrum48-49.ps1 -Offline -IncludeIdentityIntegration
```

Mode này build Identity/Parking và chọn đủ 52 tests, gồm:

1. `StaffScopeCustomerDeniedAndRevokedAssignmentAreCheckedAgainstIdentityDatabase`.
2. `RealHttpJwtGrpcScopePaymentAndSingleUseQrWorkflow`.

Lượt 52/52 pass trước đây dùng source Identity đã sửa riêng ở local, gồm LOOKUP/CHECK_IN,
bootstrap/configuration và public register protection. Những sửa đổi đó không thuộc PR Parking.
Không tuyên bố hai tests này pass với Identity nguyên trạng. Owner Identity cần cung cấp host tương thích.

## Dữ liệu và giới hạn

Test tạo database `scrum49_it_<random>` trên PostgreSQL local rồi dọn riêng; không xóa bảng Development.
Mode HTTP mở host ở port trống và dọn đúng process của test. Restore offline không phải vulnerability audit.

Còn cần UAT với Identity tương thích, Payment/provider thực tế, frontend Staff và barrier theo phạm vi nhóm.
Identity base có thể trả 403 cho LOOKUP/CHECK_IN dù JWT hợp lệ; không bỏ kiểm tra quyền ở Parking.

Postman: `postman/Han-Scrum48-49.postman_collection.json` (11 requests, không chứa mật khẩu/token).
Điền credentials và IDs local, chạy 01–06, thanh toán qua luồng nhóm tới CONFIRMED rồi chạy 07–11.
Staff cần assignment đúng bãi; Customer cần verified vehicle access. Không tự đổi booking bằng SQL để
coi là bằng chứng provider hoạt động. Visual Studio đang pause thì Continue để nhận response.
