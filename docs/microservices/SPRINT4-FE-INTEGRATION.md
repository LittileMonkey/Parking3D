# Tích hợp FE với BE Sprint 4

Bản sửa hoàn thiện backend cho SCRUM-80 và SCRUM-110 đến SCRUM-114. Backend đã qua 310 test trên PostgreSQL 17/Redis 7, build 0 lỗi và 0 cảnh báo. Compose config và Docker build Parking bằng .NET 9 đã thành công.

## Contract FE cần cập nhật

1. Chuẩn hóa loại xe gửi lên check-in. Car dùng CAR, Motorcycle dùng MOTORBIKE. Xe vãng lai để qrPayload rỗng/null. bookingId trong response có thể null.
2. Khi API check-in trả HTTP 409 và errorCode PLATE_MISMATCH, hiển thị luồng xác nhận ngoại lệ. Gửi allowMismatchOverride=true, overrideReason dài 10–500 ký tự và evidence camera.
3. Upload ảnh qua POST /api/v1/parking-lots/{lotId}/evidence với JWT và Idempotency-Key. Body có contentType và imageBase64. Dùng result.reference trong evidence[].reference. Đọc ảnh qua GET cùng route thêm /{evidenceId}. Contract và sơ đồ tại [EVIDENCE-API.md](EVIDENCE-API.md).
4. Mọi POST/PATCH của incidents và shift-handovers cần Idempotency-Key. Thiếu key trả 400 với errorCode IDEMPOTENCY_KEY_REQUIRED. Giữ key và payload khi retry cùng thao tác. Khi thay đổi nội dung hoặc bắt đầu thao tác mới, cấp key mới.
5. Các cập nhật gửi expectedVersion từ response hiện tại. Khi nhận 409 do dữ liệu thay đổi, tải lại bản ghi/version, giữ nội dung đang nhập và cho người dùng xác nhận lại.
6. GET /api/v1/parking-lots/{lotId}/layout trả levels → zones → slots với position{x,y,z}, rotationY và size{x,y,z}. Kết hợp cấu trúc này với availability/SignalR theo slotId để hiển thị trạng thái động.

FE hiện có thêm ba trường tùy chọn trong BackendCheckInPayload ở src/services/api.ts để đồng bộ contract override. Các màn hình và service FE tiếp tục cần truyền các trường này và giữ vòng đời key như trên.

## Chuẩn bị database và demo

- Database đã tồn tại cần migration 009_handover_integrity.sql và 010_incident_evidence.sql. Script Seed-DockerDemo.ps1 đã áp dụng hai migration này trước bước seed.
- Compose đã có Redis và ConnectionStrings__Redis của Parking.
- Script seed bổ sung bản đồ PUBLISHED, assignment Manager cho bootstrap Admin và ca Staff/Manager để kiểm tra bàn giao hai phía. Tài khoản lấy từ file .env Development bị gitignore.
- Ảnh PNG/JPEG tối đa 4 MiB được lưu riêng trong Parking PostgreSQL. API upload/read yêu cầu quyền hiện tại theo bãi.

## Kiểm chứng và phần nghiệm thu tiếp theo

```powershell
dotnet build Parking.Microservices.slnx --no-restore
node artifacts/six-tickets/run-isolated-tests.cjs --docker
```

Runner tạo PostgreSQL 17/Redis tạm và dọn container sau lượt chạy. Các test bao gồm HTTP/JWT/gRPC, replay request, version conflict, ràng buộc đa bãi, ảnh sai định dạng, quyền bị thu hồi và fixture seed lặp lại trên dữ liệu cũ.

Script seed toàn stack và các thao tác trình duyệt cần nghiệm thu khi FE ghép contract. Test FE gần nhất đạt 13/13 và build thành công. Các kết quả này chưa chứng minh toàn bộ luồng trình duyệt với bản FE tích hợp mới.
